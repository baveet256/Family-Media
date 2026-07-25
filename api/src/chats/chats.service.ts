import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateChatDto, SendMessageDto } from './dto/chats.dto';

@Injectable()
export class ChatsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  private async requireActiveMember(familyId: string, userId: string) {
    if (!familyId) {
      throw new BadRequestException('familyId is required');
    }
    const membership = await this.prisma.familyMembership.findUnique({
      where: { familyId_userId: { familyId, userId } },
    });
    if (!membership || membership.status !== 'active') {
      throw new ForbiddenException('Active family membership required');
    }
    return membership;
  }

  private async requireParticipant(chatId: string, userId: string) {
    const participant = await this.prisma.chatParticipant.findUnique({
      where: { chatId_userId: { chatId, userId } },
      include: { chat: true },
    });
    if (!participant) {
      throw new ForbiddenException('Not a participant in this chat');
    }
    return participant;
  }

  /** Group admin actions apply only to circles people made themselves. */
  private async requireChatAdmin(chatId: string, userId: string) {
    const participant = await this.requireParticipant(chatId, userId);
    if (participant.chat.scope !== 'custom') {
      throw new BadRequestException(
        participant.chat.scope === 'family'
          ? 'The Family room is managed automatically'
          : 'Congregation circles follow the connected families automatically',
      );
    }
    if (participant.chat.type !== 'group') {
      throw new BadRequestException('Not a group chat');
    }
    if (participant.role !== 'admin') {
      throw new ForbiddenException('Only a group admin can do that');
    }
    return participant;
  }

  async listMembers(familyId: string, userId: string) {
    await this.requireActiveMember(familyId, userId);
    const memberships = await this.prisma.familyMembership.findMany({
      where: { familyId, status: 'active' },
      include: {
        user: {
          select: { id: true, displayName: true, avatarUrl: true, phone: true },
        },
      },
      orderBy: { joinedAt: 'asc' },
    });

    type MemberRow = {
      id: string;
      displayName: string;
      avatarUrl: string | null;
      phone: string | null;
      role?: string;
      viaTag: string | null;
      connectionId: string | null;
      connectionName: string | null;
      source: 'family' | 'connection';
    };

    const byId = new Map<string, MemberRow>();
    for (const m of memberships) {
      byId.set(m.user.id, {
        id: m.user.id,
        displayName: m.user.displayName,
        avatarUrl: m.user.avatarUrl,
        phone: m.user.phone,
        role: m.role,
        viaTag: null,
        connectionId: null,
        connectionName: null,
        source: 'family',
      });
    }

    // People from connected families (e.g. via marriage), tagged for reference
    const viaMap = await this.buildViaTagMap(familyId);
    for (const [uid, meta] of viaMap) {
      if (byId.has(uid)) continue;
      byId.set(uid, {
        id: uid,
        displayName: meta.displayName,
        avatarUrl: meta.avatarUrl,
        phone: meta.phone,
        viaTag: meta.viaTag,
        connectionId: meta.connectionId,
        connectionName: meta.connectionName,
        source: 'connection',
      });
    }

    return { members: [...byId.values()] };
  }

  async listChats(familyId: string, userId: string) {
    await this.requireActiveMember(familyId, userId);

    // Ensure family-wide group exists
    await this.ensureFamilyGroupChat(familyId);
    await this.ensureCongregationChats(familyId);
    const viaMap = await this.buildViaTagMap(familyId);

    // Include chats hosted by connected families so both sides see DMs
    const connected = await this.prisma.connectionMembership.findMany({
      where: {
        familyId,
        status: 'active',
        connection: { status: 'active' },
      },
      include: {
        connection: {
          include: {
            memberships: {
              where: { status: 'active', familyId: { not: familyId } },
              select: { familyId: true },
            },
          },
        },
      },
    });
    const relatedFamilyIds = [
      familyId,
      ...new Set(
        connected.flatMap((c) =>
          c.connection.memberships.map((m) => m.familyId),
        ),
      ),
    ];

    const participations = await this.prisma.chatParticipant.findMany({
      where: {
        userId,
        chat: { familyId: { in: relatedFamilyIds } },
      },
      include: {
        chat: {
          include: {
            participants: {
              include: {
                user: {
                  select: {
                    id: true,
                    displayName: true,
                    avatarUrl: true,
                  },
                },
              },
            },
            messages: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              include: {
                sender: {
                  select: { id: true, displayName: true },
                },
              },
            },
          },
        },
      },
    });

    const chats = await Promise.all(
      participations.map(async (p) => {
        const lastMessage = p.chat.messages[0] ?? null;
        const unread = await this.prisma.message.count({
          where: {
            chatId: p.chatId,
            senderUserId: { not: userId },
            createdAt: p.lastReadAt
              ? { gt: p.lastReadAt }
              : undefined,
          },
        });

        const others = p.chat.participants
          .filter((x) => x.userId !== userId)
          .map((x) => x.user);

        const title =
          p.chat.type === 'group'
            ? p.chat.name || 'Group'
            : others[0]?.displayName || 'Chat';

        const viaTag =
          p.chat.type === 'direct' && others[0]
            ? viaMap.get(others[0].id)?.viaTag ?? null
            : null;

        return {
          id: p.chat.id,
          familyId: p.chat.familyId,
          type: p.chat.type,
          scope: p.chat.scope,
          name: p.chat.name,
          title,
          viaTag,
          connectionId: p.chat.connectionId,
          familyCount: p.chat.subsetKey
            ? p.chat.subsetKey.split(',').length
            : null,
          myRole: p.role,
          participants: p.chat.participants.map((x) => ({
            id: x.user.id,
            displayName: x.user.displayName,
            avatarUrl: x.user.avatarUrl,
            role: x.role,
            viaTag: viaMap.get(x.user.id)?.viaTag ?? null,
          })),
          lastMessage: lastMessage
            ? {
                id: lastMessage.id,
                body: lastMessage.body,
                mediaUrl: lastMessage.mediaUrl,
                createdAt: lastMessage.createdAt,
                sender: lastMessage.sender,
              }
            : null,
          unreadCount: unread,
          updatedAt: lastMessage?.createdAt ?? p.chat.createdAt,
        };
      }),
    );

    chats.sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );

    return { chats };
  }

  async createChat(userId: string, dto: CreateChatDto) {
    await this.requireActiveMember(dto.familyId, userId);

    const uniqueOthers = [...new Set(dto.participantUserIds)].filter(
      (id) => id !== userId,
    );

    if (dto.type === 'direct') {
      if (uniqueOthers.length !== 1) {
        throw new BadRequestException('Direct chat needs exactly one other user');
      }
      const otherId = uniqueOthers[0];
      await this.assertChatParticipants(dto.familyId, [otherId]);

      const existing = await this.findDirectChat(dto.familyId, userId, otherId);
      if (existing) {
        return { chat: await this.getChatSummary(existing.id, userId) };
      }

      const chat = await this.prisma.chat.create({
        data: {
          familyId: dto.familyId,
          type: 'direct',
          scope: 'custom',
          createdByUserId: userId,
          participants: {
            create: [
              { userId, lastReadAt: new Date() },
              { userId: otherId },
            ],
          },
        },
      });
      return { chat: await this.getChatSummary(chat.id, userId) };
    }

    // group
    if (!dto.name?.trim()) {
      throw new BadRequestException('Group chat requires a name');
    }
    if (uniqueOthers.length < 1) {
      throw new BadRequestException('Group needs at least one other member');
    }
    await this.assertChatParticipants(dto.familyId, uniqueOthers);

    const chat = await this.prisma.chat.create({
      data: {
        familyId: dto.familyId,
        type: 'group',
        scope: 'custom',
        name: dto.name.trim(),
        createdByUserId: userId,
        participants: {
          // Whoever starts the circle runs it.
          create: [
            { userId, role: 'admin', lastReadAt: new Date() },
            ...uniqueOthers.map((id) => ({ userId: id })),
          ],
        },
      },
    });
    return { chat: await this.getChatSummary(chat.id, userId) };
  }

  async getChatDetail(chatId: string, userId: string) {
    const me = await this.requireParticipant(chatId, userId);
    const chat = await this.prisma.chat.findUniqueOrThrow({
      where: { id: chatId },
      include: {
        participants: {
          orderBy: { joinedAt: 'asc' },
          include: {
            user: {
              select: {
                id: true,
                displayName: true,
                avatarUrl: true,
                status: true,
              },
            },
          },
        },
        createdBy: { select: { id: true, displayName: true } },
      },
    });

    const viaMap = await this.buildViaTagMap(chat.familyId);
    const families = chat.subsetKey
      ? await this.prisma.family.findMany({
          where: { id: { in: chat.subsetKey.split(',') } },
          select: { id: true, name: true },
        })
      : [];

    return {
      chat: {
        id: chat.id,
        type: chat.type,
        scope: chat.scope,
        name: chat.name,
        title:
          chat.type === 'group'
            ? chat.name || 'Group'
            : chat.participants.find((p) => p.userId !== userId)?.user
                .displayName || 'Chat',
        connectionId: chat.connectionId,
        families,
        createdBy: chat.createdBy,
        canManage: chat.scope === 'custom' && me.role === 'admin',
        myRole: me.role,
        participants: chat.participants.map((p) => ({
          id: p.user.id,
          displayName: p.user.displayName,
          avatarUrl: p.user.avatarUrl,
          status: p.user.status,
          role: p.role,
          viaTag: viaMap.get(p.user.id)?.viaTag ?? null,
        })),
      },
    };
  }

  async renameChat(chatId: string, userId: string, name: string) {
    await this.requireChatAdmin(chatId, userId);
    const trimmed = name.trim();
    if (!trimmed) throw new BadRequestException('Group needs a name');
    await this.prisma.chat.update({
      where: { id: chatId },
      data: { name: trimmed },
    });
    return this.getChatDetail(chatId, userId);
  }

  async addParticipants(chatId: string, userId: string, userIds: string[]) {
    const me = await this.requireChatAdmin(chatId, userId);
    const toAdd = [...new Set(userIds)];
    if (!toAdd.length) throw new BadRequestException('Nobody to add');
    await this.assertChatParticipants(me.chat.familyId, toAdd);
    await this.prisma.chatParticipant.createMany({
      data: toAdd.map((id) => ({ chatId, userId: id })),
      skipDuplicates: true,
    });
    return this.getChatDetail(chatId, userId);
  }

  async removeParticipant(chatId: string, userId: string, targetId: string) {
    await this.requireChatAdmin(chatId, userId);
    if (targetId === userId) {
      throw new BadRequestException('Use leave to remove yourself');
    }
    const target = await this.prisma.chatParticipant.findUnique({
      where: { chatId_userId: { chatId, userId: targetId } },
    });
    if (!target) throw new BadRequestException('Not in this group');
    await this.prisma.chatParticipant.delete({
      where: { chatId_userId: { chatId, userId: targetId } },
    });
    return this.getChatDetail(chatId, userId);
  }

  async setParticipantRole(
    chatId: string,
    userId: string,
    targetId: string,
    role: 'admin' | 'member',
  ) {
    await this.requireChatAdmin(chatId, userId);
    const target = await this.prisma.chatParticipant.findUnique({
      where: { chatId_userId: { chatId, userId: targetId } },
    });
    if (!target) throw new BadRequestException('Not in this group');
    if (targetId === userId && role === 'member') {
      const otherAdmins = await this.prisma.chatParticipant.count({
        where: { chatId, role: 'admin', userId: { not: userId } },
      });
      if (!otherAdmins) {
        throw new BadRequestException(
          'Make someone else an admin before stepping down',
        );
      }
    }
    await this.prisma.chatParticipant.update({
      where: { chatId_userId: { chatId, userId: targetId } },
      data: { role },
    });
    return this.getChatDetail(chatId, userId);
  }

  async leaveChat(chatId: string, userId: string) {
    const me = await this.requireParticipant(chatId, userId);
    if (me.chat.scope !== 'custom' || me.chat.type !== 'group') {
      throw new BadRequestException(
        me.chat.scope === 'congregation'
          ? 'Congregation circles follow the connected families'
          : 'You can only leave circles you were added to',
      );
    }

    await this.prisma.chatParticipant.delete({
      where: { chatId_userId: { chatId, userId } },
    });

    const remaining = await this.prisma.chatParticipant.findMany({
      where: { chatId },
      orderBy: { joinedAt: 'asc' },
    });
    if (!remaining.length) {
      await this.prisma.chat.delete({ where: { id: chatId } });
      return { ok: true, deleted: true };
    }
    // Never leave a circle without someone in charge.
    if (!remaining.some((p) => p.role === 'admin')) {
      await this.prisma.chatParticipant.update({
        where: { chatId_userId: { chatId, userId: remaining[0].userId } },
        data: { role: 'admin' },
      });
    }
    return { ok: true, deleted: false };
  }

  async getMessages(
    chatId: string,
    userId: string,
    opts: { after?: string; limit?: number } = {},
  ) {
    await this.requireParticipant(chatId, userId);
    const limit = Math.min(Math.max(opts.limit ?? 50, 1), 100);

    const messages = await this.prisma.message.findMany({
      where: {
        chatId,
        ...(opts.after
          ? { createdAt: { gt: new Date(opts.after) } }
          : {}),
      },
      orderBy: { createdAt: opts.after ? 'asc' : 'desc' },
      take: limit,
      include: {
        sender: {
          select: { id: true, displayName: true, avatarUrl: true },
        },
      },
    });

    const ordered = opts.after ? messages : messages.reverse();

    // Mark read when fetching
    await this.prisma.chatParticipant.update({
      where: { chatId_userId: { chatId, userId } },
      data: { lastReadAt: new Date() },
    });

    return {
      messages: ordered.map((m) => ({
        id: m.id,
        body: m.body,
        mediaUrl: m.mediaUrl,
        createdAt: m.createdAt,
        sender: m.sender,
      })),
    };
  }

  async sendMessage(chatId: string, userId: string, dto: SendMessageDto) {
    await this.requireParticipant(chatId, userId);
    if (!dto.body?.trim() && !dto.mediaUrl) {
      throw new BadRequestException('Message needs body or mediaUrl');
    }

    const message = await this.prisma.message.create({
      data: {
        chatId,
        senderUserId: userId,
        body: dto.body?.trim() || null,
        mediaUrl: dto.mediaUrl || null,
      },
      include: {
        sender: {
          select: { id: true, displayName: true, avatarUrl: true },
        },
      },
    });

    await this.prisma.chatParticipant.update({
      where: { chatId_userId: { chatId, userId } },
      data: { lastReadAt: new Date() },
    });

    const others = await this.prisma.chatParticipant.findMany({
      where: { chatId, userId: { not: userId } },
      select: { userId: true },
    });
    const preview =
      message.body?.slice(0, 80) ||
      (message.mediaUrl ? 'Sent a photo' : 'New message');
    void this.notifications.notifyMany(
      others.map((o) => o.userId),
      {
        type: 'chat_message',
        title: message.sender.displayName || 'New message',
        body: preview,
        data: { chatId, messageId: message.id },
      },
    );

    return {
      message: {
        id: message.id,
        body: message.body,
        mediaUrl: message.mediaUrl,
        createdAt: message.createdAt,
        sender: message.sender,
      },
    };
  }

  async markRead(chatId: string, userId: string) {
    await this.requireParticipant(chatId, userId);
    await this.prisma.chatParticipant.update({
      where: { chatId_userId: { chatId, userId } },
      data: { lastReadAt: new Date() },
    });
    return { ok: true };
  }

  /** Called from family create — family-wide group chat. */
  async createFamilyWideChat(familyId: string, founderUserId: string) {
    const existing = await this.prisma.chat.findFirst({
      where: { familyId, type: 'group', scope: 'family' },
    });
    if (existing) return existing;

    return this.prisma.chat.create({
      data: {
        familyId,
        type: 'group',
        scope: 'family',
        name: 'Family',
        participants: {
          create: [{ userId: founderUserId, lastReadAt: new Date() }],
        },
      },
    });
  }

  private async ensureFamilyGroupChat(familyId: string) {
    const existing = await this.prisma.chat.findFirst({
      where: { familyId, type: 'group', scope: 'family' },
    });
    if (existing) {
      // Add any active members missing from Family chat
      const members = await this.prisma.familyMembership.findMany({
        where: { familyId, status: 'active' },
        select: { userId: true },
      });
      const current = await this.prisma.chatParticipant.findMany({
        where: { chatId: existing.id },
        select: { userId: true },
      });
      const have = new Set(current.map((c) => c.userId));
      const missing = members.filter((m) => !have.has(m.userId));
      if (missing.length) {
        await this.prisma.chatParticipant.createMany({
          data: missing.map((m) => ({ chatId: existing.id, userId: m.userId })),
          skipDuplicates: true,
        });
      }
      return existing;
    }

    const founder = await this.prisma.familyMembership.findFirst({
      where: { familyId, role: 'admin', status: 'active' },
    });
    if (!founder) return null;
    return this.createFamilyWideChat(familyId, founder.userId);
  }

  /**
   * Every combination of families worth its own room: all subsets of size >= 2.
   * Three families give 3C2 + 3C3 = 4 rooms, four give 4C2 + 4C3 + 4C4 = 11.
   * Past four the lattice grows faster than anyone would use, so we keep only
   * the pairs and the all-hands room.
   */
  private familySubsets(familyIds: string[]): string[][] {
    const sorted = [...new Set(familyIds)].sort();
    const n = sorted.length;
    if (n < 2) return [];

    const pairsAndAll = () => {
      const out: string[][] = [];
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) out.push([sorted[i], sorted[j]]);
      }
      if (n > 2) out.push(sorted);
      return out;
    };
    if (n > 4) return pairsAndAll();

    const out: string[][] = [];
    for (let mask = 1; mask < 1 << n; mask++) {
      const subset = sorted.filter((_, i) => (mask >> i) & 1);
      if (subset.length >= 2) out.push(subset);
    }
    return out;
  }

  /**
   * Keep a congregation room in existence for every family combination in every
   * connection this family belongs to, with membership tracking the families.
   */
  private async ensureCongregationChats(familyId: string) {
    const myConnections = await this.prisma.connectionMembership.findMany({
      where: { familyId, status: 'active', connection: { status: 'active' } },
      include: {
        connection: {
          include: {
            memberships: {
              where: { status: 'active' },
              include: { family: { select: { id: true, name: true } } },
            },
          },
        },
      },
    });
    if (!myConnections.length) return;

    const allFamilyIds = [
      ...new Set(
        myConnections.flatMap((c) =>
          c.connection.memberships.map((m) => m.familyId),
        ),
      ),
    ];
    const memberships = await this.prisma.familyMembership.findMany({
      where: { familyId: { in: allFamilyIds }, status: 'active' },
      select: { familyId: true, userId: true },
    });
    const usersByFamily = new Map<string, string[]>();
    for (const m of memberships) {
      const list = usersByFamily.get(m.familyId) ?? [];
      list.push(m.userId);
      usersByFamily.set(m.familyId, list);
    }

    for (const cm of myConnections) {
      const conn = cm.connection;
      const nameById = new Map(
        conn.memberships.map((m) => [m.familyId, m.family.name]),
      );
      const subsets = this.familySubsets([...nameById.keys()]).filter((s) =>
        s.includes(familyId),
      );
      if (!subsets.length) continue;

      const wanted = subsets.map((subset) => ({
        subset,
        subsetKey: subset.join(','),
        // Family names read better than ids, and the room is self-describing.
        name: subset
          .map((id) => nameById.get(id) ?? 'Family')
          .sort((a, b) => a.localeCompare(b))
          .join(' · '),
        userIds: [...new Set(subset.flatMap((id) => usersByFamily.get(id) ?? []))],
      }));

      const existing = await this.prisma.chat.findMany({
        where: {
          connectionId: conn.id,
          subsetKey: { in: wanted.map((w) => w.subsetKey) },
        },
        select: { id: true, subsetKey: true, name: true },
      });
      const byKey = new Map(existing.map((c) => [c.subsetKey!, c]));

      for (const w of wanted) {
        const found = byKey.get(w.subsetKey);
        if (!found) {
          await this.prisma.chat.create({
            data: {
              // The lowest-sorted family hosts the row; membership is what counts.
              familyId: w.subset[0],
              type: 'group',
              scope: 'congregation',
              connectionId: conn.id,
              subsetKey: w.subsetKey,
              name: w.name,
              participants: {
                create: w.userIds.map((userId) => ({ userId })),
              },
            },
          });
          continue;
        }
        if (found.name !== w.name) {
          await this.prisma.chat.update({
            where: { id: found.id },
            data: { name: w.name },
          });
        }
      }

      // Re-read so freshly created rooms are included in the membership sync.
      const rooms = await this.prisma.chat.findMany({
        where: {
          connectionId: conn.id,
          subsetKey: { in: wanted.map((w) => w.subsetKey) },
        },
        select: { id: true, subsetKey: true, participants: { select: { userId: true } } },
      });
      const wantedByKey = new Map(wanted.map((w) => [w.subsetKey, w]));

      const toAdd: Array<{ chatId: string; userId: string }> = [];
      const toDrop: Array<{ chatId: string; userId: string }> = [];
      for (const room of rooms) {
        const want = wantedByKey.get(room.subsetKey!);
        if (!want) continue;
        const have = new Set(room.participants.map((p) => p.userId));
        const should = new Set(want.userIds);
        for (const uid of should) {
          if (!have.has(uid)) toAdd.push({ chatId: room.id, userId: uid });
        }
        for (const uid of have) {
          if (!should.has(uid)) toDrop.push({ chatId: room.id, userId: uid });
        }
      }
      if (toAdd.length) {
        await this.prisma.chatParticipant.createMany({
          data: toAdd,
          skipDuplicates: true,
        });
      }
      for (const d of toDrop) {
        await this.prisma.chatParticipant.delete({
          where: { chatId_userId: { chatId: d.chatId, userId: d.userId } },
        });
      }
    }
  }

  /** Family members + people from active connected families (via marriage, etc.) */
  private async assertChatParticipants(familyId: string, userIds: string[]) {
    if (!userIds.length) return;
    const familyMembers = await this.prisma.familyMembership.findMany({
      where: {
        familyId,
        userId: { in: userIds },
        status: 'active',
      },
      select: { userId: true },
    });
    const ok = new Set(familyMembers.map((m) => m.userId));
    const missing = userIds.filter((id) => !ok.has(id));
    if (!missing.length) return;

    const viaMap = await this.buildViaTagMap(familyId);
    const stillMissing = missing.filter((id) => !viaMap.has(id));
    if (stillMissing.length) {
      throw new BadRequestException(
        'Participants must be family members or from a connected family',
      );
    }
  }

  /**
   * Map userId → via tag for people in families linked by an active connection.
   * Tag looks like: "via Vikram & Aisha"
   */
  private async buildViaTagMap(familyId: string) {
    type ViaMeta = {
      displayName: string;
      avatarUrl: string | null;
      phone: string | null;
      viaTag: string;
      connectionId: string;
      connectionName: string | null;
    };
    const map = new Map<string, ViaMeta>();

    const memberships = await this.prisma.connectionMembership.findMany({
      where: {
        familyId,
        status: 'active',
        connection: { status: 'active' },
      },
      include: {
        connection: {
          include: {
            memberships: {
              where: { status: 'active', familyId: { not: familyId } },
              include: {
                family: {
                  include: {
                    memberships: {
                      where: { status: 'active' },
                      include: {
                        user: {
                          select: {
                            id: true,
                            displayName: true,
                            avatarUrl: true,
                            phone: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            bridgeLinks: {
              where: { linkType: 'spouse' },
              take: 1,
              include: {
                personA: { select: { firstName: true, displayName: true } },
                personB: { select: { firstName: true, displayName: true } },
              },
            },
          },
        },
      },
    });

    for (const cm of memberships) {
      const conn = cm.connection;
      const bridge = conn.bridgeLinks[0];
      const couple =
        bridge != null
          ? `${bridge.personA.firstName || bridge.personA.displayName} & ${bridge.personB.firstName || bridge.personB.displayName}`
          : null;
      const label = conn.name?.trim() || couple || 'connection';
      const viaTag = `via ${label}`;

      for (const other of conn.memberships) {
        for (const m of other.family.memberships) {
          if (!map.has(m.user.id)) {
            map.set(m.user.id, {
              displayName: m.user.displayName,
              avatarUrl: m.user.avatarUrl,
              phone: m.user.phone,
              viaTag,
              connectionId: conn.id,
              connectionName: conn.name,
            });
          }
        }
      }
    }

    return map;
  }

  private async findDirectChat(
    familyId: string,
    userA: string,
    userB: string,
  ) {
    const candidates = await this.prisma.chat.findMany({
      where: {
        familyId,
        type: 'direct',
        participants: { some: { userId: userA } },
      },
      include: { participants: true },
    });
    return (
      candidates.find((c) => {
        const ids = c.participants.map((p) => p.userId).sort();
        return (
          ids.length === 2 &&
          ids[0] === [userA, userB].sort()[0] &&
          ids[1] === [userA, userB].sort()[1]
        );
      }) ?? null
    );
  }

  private async getChatSummary(chatId: string, userId: string) {
    const chat = await this.prisma.chat.findUniqueOrThrow({
      where: { id: chatId },
      include: {
        participants: {
          include: {
            user: {
              select: { id: true, displayName: true, avatarUrl: true },
            },
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });
    const viaMap = await this.buildViaTagMap(chat.familyId);
    const others = chat.participants
      .filter((p) => p.userId !== userId)
      .map((p) => p.user);
    const viaTag =
      chat.type === 'direct' && others[0]
        ? viaMap.get(others[0].id)?.viaTag ?? null
        : null;
    return {
      id: chat.id,
      familyId: chat.familyId,
      type: chat.type,
      scope: chat.scope,
      name: chat.name,
      title:
        chat.type === 'group'
          ? chat.name || 'Group'
          : others[0]?.displayName || 'Chat',
      viaTag,
      connectionId: chat.connectionId,
      familyCount: chat.subsetKey ? chat.subsetKey.split(',').length : null,
      myRole:
        chat.participants.find((p) => p.userId === userId)?.role ?? 'member',
      participants: chat.participants.map((p) => ({
        id: p.user.id,
        displayName: p.user.displayName,
        avatarUrl: p.user.avatarUrl,
        role: p.role,
        viaTag: viaMap.get(p.user.id)?.viaTag ?? null,
      })),
      lastMessage: chat.messages[0]
        ? {
            id: chat.messages[0].id,
            body: chat.messages[0].body,
            mediaUrl: chat.messages[0].mediaUrl,
            createdAt: chat.messages[0].createdAt,
          }
        : null,
      unreadCount: 0,
      updatedAt: chat.messages[0]?.createdAt ?? chat.createdAt,
    };
  }
}
