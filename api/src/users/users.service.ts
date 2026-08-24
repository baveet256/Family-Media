import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { UpdateUserDto } from '../families/dto/family.dto';
import { buildDisplayName, splitDisplayName } from '../common/names';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
  ) {}

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.deletedAt) throw new NotFoundException('User not found');

    const memberships = await this.prisma.familyMembership.findMany({
      where: { userId, status: { in: ['active', 'pending'] } },
      include: { family: true },
      orderBy: { joinedAt: 'asc' },
    });

    const joinRequests = await this.prisma.joinRequest.findMany({
      where: { userId, status: { in: ['pending', 'approved'] } },
      include: {
        family: true,
        onboardingAnswers: { select: { questionKey: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const persons = await this.prisma.person.findMany({
      where: { userId, isPlaceholder: false },
      select: { id: true, familyId: true },
    });
    const personByFamily = new Map(persons.map((p) => [p.familyId, p.id]));

    const families = memberships.map((m) => {
      const settings =
        m.family.settings &&
        typeof m.family.settings === 'object' &&
        !Array.isArray(m.family.settings)
          ? (m.family.settings as {
              require_approval?: boolean;
              who_can_invite?: string;
            })
          : {};
      return {
        id: m.family.id,
        name: m.family.name,
        avatarUrl: m.family.avatarUrl,
        // Withheld until approved, so an unapproved joiner cannot invite others.
        inviteCode: m.status === 'active' ? m.family.inviteCode : null,
        role: m.role,
        status: m.status,
        personId: personByFamily.get(m.family.id) ?? null,
        settings: {
          requireApproval: settings.require_approval ?? true,
          whoCanInvite: settings.who_can_invite ?? 'admin',
        },
      };
    });

    const pendingJoinRequests = joinRequests
      .filter((jr) => jr.status === 'pending')
      .map((jr) => ({
        id: jr.id,
        status: jr.status,
        hasOnboarding: jr.onboardingAnswers.some((a) => a.questionKey === 'parent'),
        family: {
          id: jr.family.id,
          name: jr.family.name,
          avatarUrl: jr.family.avatarUrl,
        },
        createdAt: jr.createdAt,
      }));

    // Needs onboarding if they have a pending join request without parent answers
    const needsOnboardingRequest = pendingJoinRequests.find((jr) => !jr.hasOnboarding);

    const activeWithoutPerson = families.find(
      (f) => f.status === 'active' && !f.personId,
    );

    const [contextRow, connectionMemberships] = await Promise.all([
      this.prisma.userActiveContext.findUnique({
        where: { userId },
        include: {
          family: true,
          connection: {
            include: {
              memberships: {
                where: { status: 'active' },
                include: { family: true },
              },
            },
          },
        },
      }),
      this.prisma.connectionMembership.findMany({
        where: {
          status: 'active',
          familyId: { in: families.filter((f) => f.status === 'active').map((f) => f.id) },
          connection: { status: 'active' },
        },
        include: {
          connection: {
            include: {
              memberships: {
                where: { status: 'active' },
                include: { family: true },
              },
            },
          },
        },
      }),
    ]);

    const connectionsMap = new Map<
      string,
      {
        id: string;
        name: string | null;
        feedPolicy: string;
        families: Array<{
          id: string;
          name: string;
          avatarUrl: string | null;
        }>;
      }
    >();
    for (const cm of connectionMemberships) {
      if (!connectionsMap.has(cm.connectionId)) {
        connectionsMap.set(cm.connectionId, {
          id: cm.connection.id,
          name: cm.connection.name,
          feedPolicy: cm.connection.feedPolicy,
          families: cm.connection.memberships.map((m) => ({
            id: m.family.id,
            name: m.family.name,
            avatarUrl: m.family.avatarUrl,
          })),
        });
      }
    }

    let context: {
      familyId: string;
      family: { id: string; name: string; avatarUrl: string | null };
      connectionId: string | null;
      connection: {
        id: string;
        name: string | null;
        feedPolicy: string;
        families: Array<{
          id: string;
          name: string;
          avatarUrl: string | null;
        }>;
      } | null;
    } | null = null;

    if (contextRow) {
      context = {
        familyId: contextRow.familyId,
        family: {
          id: contextRow.family.id,
          name: contextRow.family.name,
          avatarUrl: contextRow.family.avatarUrl,
        },
        connectionId: contextRow.connectionId,
        connection: contextRow.connection
          ? {
              id: contextRow.connection.id,
              name: contextRow.connection.name,
              feedPolicy: contextRow.connection.feedPolicy,
              families: contextRow.connection.memberships.map((m) => ({
                id: m.family.id,
                name: m.family.name,
                avatarUrl: m.family.avatarUrl,
              })),
            }
          : null,
      };
    } else {
      const firstActive = families.find((f) => f.status === 'active');
      if (firstActive) {
        context = {
          familyId: firstActive.id,
          family: {
            id: firstActive.id,
            name: firstActive.name,
            avatarUrl: firstActive.avatarUrl,
          },
          connectionId: null,
          connection: null,
        };
      }
    }

    return {
      user: this.auth.serializeUser(user),
      families,
      connections: [...connectionsMap.values()],
      context,
      pendingJoinRequests,
      needsProfile: !user.firstName && !user.displayName,
      needsFamily:
        memberships.filter((m) => m.status === 'active').length === 0 &&
        pendingJoinRequests.length === 0,
      needsOnboarding: !!needsOnboardingRequest || !!activeWithoutPerson,
      onboardingJoinRequestId:
        needsOnboardingRequest?.id ??
        joinRequests.find(
          (jr) =>
            jr.status === 'approved' &&
            !personByFamily.has(jr.familyId) &&
            !jr.onboardingAnswers.some((a) => a.questionKey === 'parent'),
        )?.id ??
        null,
    };
  }

  async updateMe(userId: string, dto: UpdateUserDto) {
    const existing = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });

    let firstName = existing.firstName;
    let lastName = existing.lastName;

    if (dto.firstName !== undefined || dto.lastName !== undefined) {
      firstName =
        dto.firstName !== undefined ? dto.firstName.trim() : existing.firstName;
      lastName =
        dto.lastName !== undefined ? dto.lastName.trim() : existing.lastName;
    } else if (dto.displayName !== undefined) {
      const split = splitDisplayName(dto.displayName);
      firstName = split.firstName;
      lastName = split.lastName;
    }

    const displayName = buildDisplayName(firstName, lastName);

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        firstName,
        lastName,
        displayName,
        ...(dto.avatarUrl !== undefined ? { avatarUrl: dto.avatarUrl } : {}),
        ...(dto.status !== undefined ? { status: dto.status.trim() } : {}),
      },
    });

    // Keep linked person rows in sync
    await this.prisma.person.updateMany({
      where: { userId },
      data: {
        firstName,
        lastName,
        displayName,
        ...(dto.avatarUrl !== undefined ? { avatarUrl: dto.avatarUrl } : {}),
      },
    });

    return { user: this.auth.serializeUser(user) };
  }

  async exportMyData(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.deletedAt) throw new NotFoundException('User not found');

    const [
      memberships,
      persons,
      posts,
      comments,
      reactions,
      stories,
      messages,
      notifications,
      auditEvents,
    ] = await Promise.all([
      this.prisma.familyMembership.findMany({
        where: { userId },
        include: { family: { select: { id: true, name: true, inviteCode: true } } },
      }),
      this.prisma.person.findMany({ where: { userId } }),
      this.prisma.post.findMany({
        where: { authorUserId: userId },
        include: { media: true },
      }),
      this.prisma.postComment.findMany({ where: { authorUserId: userId } }),
      this.prisma.postReaction.findMany({ where: { userId } }),
      this.prisma.story.findMany({ where: { authorUserId: userId } }),
      this.prisma.message.findMany({
        where: { senderUserId: userId },
        take: 5000,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.notification.findMany({
        where: { userId },
        take: 500,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.auditEvent.findMany({
        where: { actorUserId: userId },
        take: 500,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      exportedAt: new Date().toISOString(),
      user: this.auth.serializeUser(user),
      memberships,
      persons,
      posts,
      comments,
      reactions,
      stories,
      messages,
      notifications,
      auditEvents,
    };
  }

  async deleteAccount(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.deletedAt) throw new NotFoundException('User not found');

    const scrubPhone = `deleted_${userId.replace(/-/g, '').slice(0, 16)}`;

    await this.prisma.$transaction(async (tx) => {
      await tx.deviceToken.deleteMany({ where: { userId } });
      await tx.userActiveContext.deleteMany({ where: { userId } });
      await tx.notification.deleteMany({ where: { userId } });

      await tx.familyMembership.updateMany({
        where: { userId, status: { not: 'removed' } },
        data: { status: 'removed' },
      });

      await tx.person.updateMany({
        where: { userId },
        data: { userId: null, phone: null, avatarUrl: null },
      });

      await tx.message.updateMany({
        where: { senderUserId: userId },
        data: { body: '[deleted]', mediaUrl: null },
      });

      await tx.user.update({
        where: { id: userId },
        data: {
          phone: scrubPhone,
          displayName: 'Deleted user',
          firstName: 'Deleted',
          lastName: 'user',
          avatarUrl: null,
          deletedAt: new Date(),
        },
      });
    });

    return { ok: true, deletedAt: new Date().toISOString() };
  }
}
