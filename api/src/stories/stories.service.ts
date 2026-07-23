import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStoryDto } from './dto/stories.dto';

const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class StoriesService {
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

  async create(userId: string, dto: CreateStoryDto) {
    await this.requireActiveMember(dto.familyId, userId);

    const ttlMs = (dto.expiresInSeconds ?? 24 * 60 * 60) * 1000;
    const expiresAt = new Date(Date.now() + Math.min(ttlMs, DAY_MS));

    const story = await this.prisma.story.create({
      data: {
        familyId: dto.familyId,
        authorUserId: userId,
        mediaType: dto.mediaType,
        url: dto.url,
        expiresAt,
      },
      include: {
        author: {
          select: { id: true, displayName: true, avatarUrl: true },
        },
      },
    });

    return {
      story: {
        id: story.id,
        familyId: story.familyId,
        mediaType: story.mediaType,
        url: story.url,
        expiresAt: story.expiresAt,
        createdAt: story.createdAt,
        author: story.author,
        viewedByMe: false,
      },
    };
  }

  /**
   * Returns active (non-expired) stories grouped by author for the ring UI.
   */
  async listForFamily(familyId: string, userId: string) {
    await this.requireActiveMember(familyId, userId);
    const now = new Date();

    // Soft-hide expired; opportunistic cleanup of old rows
    await this.prisma.story.deleteMany({
      where: { familyId, expiresAt: { lt: new Date(now.getTime() - DAY_MS) } },
    });

    const stories = await this.prisma.story.findMany({
      where: { familyId, expiresAt: { gt: now } },
      orderBy: { createdAt: 'asc' },
      include: {
        author: {
          select: { id: true, displayName: true, avatarUrl: true },
        },
        views: {
          where: { viewerUserId: userId },
          select: { viewerUserId: true },
        },
      },
    });

    type Group = {
      author: {
        id: string;
        displayName: string;
        avatarUrl: string | null;
      };
      hasUnseen: boolean;
      stories: Array<{
        id: string;
        mediaType: string;
        url: string;
        expiresAt: Date;
        createdAt: Date;
        viewedByMe: boolean;
      }>;
    };

    const groups = new Map<string, Group>();
    for (const s of stories) {
      const viewedByMe = s.views.length > 0;
      const existing = groups.get(s.authorUserId);
      const item = {
        id: s.id,
        mediaType: s.mediaType,
        url: s.url,
        expiresAt: s.expiresAt,
        createdAt: s.createdAt,
        viewedByMe,
      };
      if (!existing) {
        groups.set(s.authorUserId, {
          author: s.author,
          hasUnseen: !viewedByMe,
          stories: [item],
        });
      } else {
        existing.stories.push(item);
        if (!viewedByMe) existing.hasUnseen = true;
      }
    }

    // Own ring first, then unseen, then seen — alphabetical within buckets
    const list = [...groups.values()];
    list.sort((a, b) => {
      const aSelf = a.author.id === userId ? 0 : 1;
      const bSelf = b.author.id === userId ? 0 : 1;
      if (aSelf !== bSelf) return aSelf - bSelf;
      const aUnseen = a.hasUnseen ? 0 : 1;
      const bUnseen = b.hasUnseen ? 0 : 1;
      if (aUnseen !== bUnseen) return aUnseen - bUnseen;
      return a.author.displayName.localeCompare(b.author.displayName);
    });

    return { rings: list };
  }

  async markViewed(storyId: string, userId: string) {
    const story = await this.prisma.story.findUnique({
      where: { id: storyId },
    });
    if (!story) throw new NotFoundException('Story not found');
    if (story.expiresAt <= new Date()) {
      throw new NotFoundException('Story expired');
    }
    await this.requireActiveMember(story.familyId, userId);

    await this.prisma.storyView.upsert({
      where: {
        storyId_viewerUserId: { storyId, viewerUserId: userId },
      },
      create: { storyId, viewerUserId: userId },
      update: { viewedAt: new Date() },
    });

    return { ok: true };
  }

  async listViewers(storyId: string, userId: string) {
    const story = await this.prisma.story.findUnique({
      where: { id: storyId },
    });
    if (!story) throw new NotFoundException('Story not found');
    await this.requireActiveMember(story.familyId, userId);

    if (story.authorUserId !== userId) {
      throw new ForbiddenException('Only the author can see viewers');
    }

    const views = await this.prisma.storyView.findMany({
      where: { storyId },
      orderBy: { viewedAt: 'desc' },
      include: {
        viewer: {
          select: { id: true, displayName: true, avatarUrl: true },
        },
      },
    });

    return {
      viewers: views.map((v) => ({
        id: v.viewer.id,
        displayName: v.viewer.displayName,
        avatarUrl: v.viewer.avatarUrl,
        viewedAt: v.viewedAt,
      })),
    };
  }
}
