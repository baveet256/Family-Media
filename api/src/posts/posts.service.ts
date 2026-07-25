import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CommentPostDto,
  CreatePostDto,
  ReactPostDto,
  UpdatePostShareDto,
} from './dto/posts.dto';

@Injectable()
export class PostsService {
  constructor(private readonly prisma: PrismaService) {}

  private async requireActiveMember(familyId: string, userId: string) {
    const membership = await this.prisma.familyMembership.findUnique({
      where: { familyId_userId: { familyId, userId } },
    });
    if (!membership || membership.status !== 'active') {
      throw new ForbiddenException('Active family membership required');
    }
    return membership;
  }

  private serializePost(
    post: {
      id: string;
      familyId: string;
      connectionId?: string | null;
      caption: string | null;
      visibility: string;
      createdAt: Date;
      author: {
        id: string;
        displayName: string;
        avatarUrl: string | null;
      };
      media: Array<{
        id: string;
        mediaType: string;
        url: string;
        thumbnailUrl: string | null;
        sortOrder: number;
      }>;
      reactions: Array<{
        emoji: string;
        userId: string;
        user: { id: string; displayName: string };
      }>;
      comments: Array<{
        id: string;
        body: string;
        createdAt: Date;
        author: {
          id: string;
          displayName: string;
          avatarUrl: string | null;
        };
      }>;
      _count?: { comments: number; reactions: number };
    },
    viewerUserId?: string,
  ) {
    const reactionCounts: Record<string, number> = {};
    for (const r of post.reactions) {
      reactionCounts[r.emoji] = (reactionCounts[r.emoji] ?? 0) + 1;
    }
    const myReaction =
      viewerUserId != null
        ? (post.reactions.find((r) => r.userId === viewerUserId)?.emoji ?? null)
        : null;

    return {
      id: post.id,
      familyId: post.familyId,
      connectionId: post.connectionId ?? null,
      caption: post.caption,
      visibility: post.visibility,
      createdAt: post.createdAt,
      author: {
        id: post.author.id,
        displayName: post.author.displayName,
        avatarUrl: post.author.avatarUrl,
      },
      media: post.media
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((m) => ({
          id: m.id,
          mediaType: m.mediaType,
          url: m.url,
          thumbnailUrl: m.thumbnailUrl,
          sortOrder: m.sortOrder,
        })),
      reactions: {
        counts: reactionCounts,
        total: post.reactions.length,
        mine: myReaction,
      },
      comments: post.comments.map((c) => ({
        id: c.id,
        body: c.body,
        createdAt: c.createdAt,
        author: {
          id: c.author.id,
          displayName: c.author.displayName,
          avatarUrl: c.author.avatarUrl,
        },
      })),
      commentCount: post._count?.comments ?? post.comments.length,
    };
  }

  private postInclude = {
    author: {
      select: { id: true, displayName: true, avatarUrl: true },
    },
    media: true,
    reactions: {
      include: {
        user: { select: { id: true, displayName: true } },
      },
    },
    comments: {
      orderBy: { createdAt: 'asc' as const },
      include: {
        author: {
          select: { id: true, displayName: true, avatarUrl: true },
        },
      },
    },
    _count: { select: { comments: true, reactions: true } },
  };

  async create(userId: string, dto: CreatePostDto) {
    await this.requireActiveMember(dto.familyId, userId);

    if (!dto.caption?.trim() && !(dto.media && dto.media.length)) {
      throw new BadRequestException('Post needs a caption or media');
    }

    const visibility = dto.visibility ?? 'family';
    let connectionId: string | null = null;

    if (visibility === 'connection') {
      if (!dto.connectionId) {
        throw new BadRequestException(
          'connectionId required when visibility is connection',
        );
      }
      const membership = await this.prisma.connectionMembership.findFirst({
        where: {
          connectionId: dto.connectionId,
          familyId: dto.familyId,
          status: 'active',
        },
        include: { connection: true },
      });
      if (!membership || membership.connection.status !== 'active') {
        throw new BadRequestException(
          'Family is not an active member of this connection',
        );
      }
      connectionId = dto.connectionId;
    }

    const post = await this.prisma.post.create({
      data: {
        familyId: dto.familyId,
        authorUserId: userId,
        caption: dto.caption?.trim() || null,
        visibility,
        connectionId,
        media: dto.media?.length
          ? {
              create: dto.media.map((m, i) => ({
                mediaType: m.mediaType,
                url: m.url,
                thumbnailUrl: m.thumbnailUrl,
                sortOrder: m.sortOrder ?? i,
              })),
            }
          : undefined,
      },
      include: this.postInclude,
    });

    return { post: this.serializePost(post, userId) };
  }

  async getConnectionFeed(
    connectionId: string,
    userId: string,
    opts: { familyId?: string; cursor?: string; limit?: number } = {},
  ) {
    const connection = await this.prisma.connection.findUnique({
      where: { id: connectionId },
      include: {
        memberships: { where: { status: 'active' } },
      },
    });
    if (!connection || connection.status !== 'active') {
      throw new NotFoundException('Connection not found');
    }

    const familyIds = connection.memberships.map((m) => m.familyId);
    const myMembership = await this.prisma.familyMembership.findFirst({
      where: {
        userId,
        status: 'active',
        familyId: { in: familyIds },
      },
    });
    if (!myMembership) {
      throw new ForbiddenException('Not a member of this connection');
    }

    const limit = Math.min(Math.max(opts.limit ?? 20, 1), 50);

    let where: Prisma.PostWhereInput;

    if (connection.feedPolicy === 'separate_feeds') {
      const focusFamilyId = opts.familyId ?? myMembership.familyId;
      if (!familyIds.includes(focusFamilyId)) {
        throw new BadRequestException('familyId is not in this connection');
      }
      // Connection members may toggle between member-family feeds
      where = { familyId: focusFamilyId };
    } else {
      // unified_feed: own-family posts + connection-shared posts from all member families
      where = {
        OR: [
          { familyId: myMembership.familyId },
          {
            connectionId,
            visibility: 'connection',
            familyId: { in: familyIds },
          },
        ],
      };
    }

    const posts = await this.prisma.post.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(opts.cursor
        ? { cursor: { id: opts.cursor }, skip: 1 }
        : {}),
      include: this.postInclude,
    });

    const hasMore = posts.length > limit;
    const page = hasMore ? posts.slice(0, limit) : posts;
    const nextCursor = hasMore ? page[page.length - 1]?.id : null;

    return {
      posts: page.map((p) => this.serializePost(p, userId)),
      nextCursor,
      feedPolicy: connection.feedPolicy,
    };
  }

  async getFeed(
    familyId: string,
    userId: string,
    opts: { cursor?: string; limit?: number } = {},
  ) {
    await this.requireActiveMember(familyId, userId);
    const limit = Math.min(Math.max(opts.limit ?? 20, 1), 50);

    const posts = await this.prisma.post.findMany({
      where: { familyId },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(opts.cursor
        ? { cursor: { id: opts.cursor }, skip: 1 }
        : {}),
      include: this.postInclude,
    });

    const hasMore = posts.length > limit;
    const page = hasMore ? posts.slice(0, limit) : posts;
    const nextCursor = hasMore ? page[page.length - 1]?.id : null;

    return {
      posts: page.map((p) => this.serializePost(p, userId)),
      nextCursor,
    };
  }

  async getPost(postId: string, userId: string) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      include: this.postInclude,
    });
    if (!post) throw new NotFoundException('Post not found');
    await this.requireActiveMember(post.familyId, userId);
    return { post: this.serializePost(post, userId) };
  }

  async react(postId: string, userId: string, dto: ReactPostDto) {
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post) throw new NotFoundException('Post not found');
    await this.requireActiveMember(post.familyId, userId);

    const emoji = dto.emoji.trim();
    const existing = await this.prisma.postReaction.findUnique({
      where: { postId_userId: { postId, userId } },
    });

    // Toggle off if same emoji; otherwise upsert
    if (existing?.emoji === emoji) {
      await this.prisma.postReaction.delete({
        where: { postId_userId: { postId, userId } },
      });
      return this.getPost(postId, userId);
    }

    await this.prisma.postReaction.upsert({
      where: { postId_userId: { postId, userId } },
      create: { postId, userId, emoji },
      update: { emoji },
    });

    return this.getPost(postId, userId);
  }

  async comment(postId: string, userId: string, dto: CommentPostDto) {
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post) throw new NotFoundException('Post not found');
    await this.requireActiveMember(post.familyId, userId);

    await this.prisma.postComment.create({
      data: {
        postId,
        authorUserId: userId,
        body: dto.body.trim(),
      },
    });

    return this.getPost(postId, userId);
  }

  async listMyPosts(familyId: string, userId: string) {
    await this.requireActiveMember(familyId, userId);
    const posts = await this.prisma.post.findMany({
      where: { familyId, authorUserId: userId },
      orderBy: { createdAt: 'desc' },
      include: this.postInclude,
    });
    return { posts: posts.map((p) => this.serializePost(p, userId)) };
  }

  async updateShare(postId: string, userId: string, dto: UpdatePostShareDto) {
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post) throw new NotFoundException('Post not found');
    if (post.authorUserId !== userId) {
      throw new ForbiddenException('Only the author can change sharing');
    }

    let connectionId: string | null = null;
    if (dto.visibility === 'connection') {
      const targetConnectionId = dto.connectionId ?? post.connectionId;
      if (!targetConnectionId) {
        throw new BadRequestException('connectionId required');
      }
      const membership = await this.prisma.connectionMembership.findFirst({
        where: {
          connectionId: targetConnectionId,
          familyId: post.familyId,
          status: 'active',
        },
        include: { connection: true },
      });
      if (!membership || membership.connection.status !== 'active') {
        throw new BadRequestException(
          'Family is not an active member of this connection',
        );
      }
      connectionId = targetConnectionId;
    }

    const updated = await this.prisma.post.update({
      where: { id: postId },
      data: {
        visibility: dto.visibility,
        connectionId,
      },
      include: this.postInclude,
    });
    return { post: this.serializePost(updated, userId) };
  }
}
