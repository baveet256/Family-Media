import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  CreateBridgeLinkDto,
  CreateConnectionInviteDto,
  RespondConnectionInviteDto,
  UpdateConnectionDto,
  UpdateContextDto,
} from './dto/connections.dto';

const INVITE_INCLUDE = {
  fromFamily: true,
  toFamily: true,
  initiatedBy: { select: { id: true, displayName: true, avatarUrl: true } },
  fromPerson: {
    select: {
      id: true,
      displayName: true,
      firstName: true,
      lastName: true,
      avatarUrl: true,
    },
  },
} satisfies Prisma.ConnectionInviteInclude;

@Injectable()
export class ConnectionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  private async requireAdmin(familyId: string, userId: string) {
    const membership = await this.prisma.familyMembership.findUnique({
      where: { familyId_userId: { familyId, userId } },
    });
    if (!membership || membership.status !== 'active' || membership.role !== 'admin') {
      throw new ForbiddenException('Family admin required');
    }
    return membership;
  }

  private async requireActiveMember(familyId: string, userId: string) {
    const membership = await this.prisma.familyMembership.findUnique({
      where: { familyId_userId: { familyId, userId } },
    });
    if (!membership || membership.status !== 'active') {
      throw new ForbiddenException('Active family membership required');
    }
    return membership;
  }

  private async requireConnectionAccess(connectionId: string, userId: string) {
    const connection = await this.prisma.connection.findUnique({
      where: { id: connectionId },
      include: {
        memberships: {
          where: { status: 'active' },
          include: { family: true },
        },
      },
    });
    if (!connection || connection.status === 'dissolved') {
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
    return { connection, myMembership, familyIds };
  }

  serializeConnection(
    c: {
      id: string;
      name: string | null;
      feedPolicy: string;
      status: string;
      createdAt: Date;
      memberships?: Array<{
        familyId: string;
        status: string;
        family: { id: string; name: string; avatarUrl: string | null };
      }>;
      bridgeLinks?: Array<{
        id: string;
        familyAId: string;
        familyBId: string;
        personAId: string;
        personBId: string;
        linkType: string;
        personA?: { id: string; displayName: string; avatarUrl: string | null };
        personB?: { id: string; displayName: string; avatarUrl: string | null };
      }>;
    },
  ) {
    return {
      id: c.id,
      name: c.name,
      feedPolicy: c.feedPolicy,
      status: c.status,
      createdAt: c.createdAt,
      families: (c.memberships ?? [])
        .filter((m) => m.status === 'active')
        .map((m) => ({
          id: m.family.id,
          name: m.family.name,
          avatarUrl: m.family.avatarUrl,
        })),
      bridgeLinks: (c.bridgeLinks ?? []).map((b) => ({
        id: b.id,
        linkType: b.linkType,
        familyAId: b.familyAId,
        familyBId: b.familyBId,
        personA: b.personA
          ? {
              id: b.personA.id,
              displayName: b.personA.displayName,
              avatarUrl: b.personA.avatarUrl,
            }
          : { id: b.personAId },
        personB: b.personB
          ? {
              id: b.personB.id,
              displayName: b.personB.displayName,
              avatarUrl: b.personB.avatarUrl,
            }
          : { id: b.personBId },
      })),
    };
  }

  async listForUser(userId: string) {
    const memberships = await this.prisma.familyMembership.findMany({
      where: { userId, status: 'active' },
      select: { familyId: true },
    });
    const familyIds = memberships.map((m) => m.familyId);
    if (!familyIds.length) return { connections: [] };

    const connections = await this.prisma.connection.findMany({
      where: {
        status: 'active',
        memberships: {
          some: { familyId: { in: familyIds }, status: 'active' },
        },
      },
      include: {
        memberships: { include: { family: true } },
        bridgeLinks: {
          include: {
            personA: {
              select: { id: true, displayName: true, avatarUrl: true },
            },
            personB: {
              select: { id: true, displayName: true, avatarUrl: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      connections: connections.map((c) => this.serializeConnection(c)),
    };
  }

  async getById(connectionId: string, userId: string) {
    const { connection } = await this.requireConnectionAccess(
      connectionId,
      userId,
    );
    const full = await this.prisma.connection.findUniqueOrThrow({
      where: { id: connection.id },
      include: {
        memberships: { include: { family: true } },
        bridgeLinks: {
          include: {
            personA: {
              select: { id: true, displayName: true, avatarUrl: true },
            },
            personB: {
              select: { id: true, displayName: true, avatarUrl: true },
            },
          },
        },
      },
    });
    return { connection: this.serializeConnection(full) };
  }

  async createInvite(userId: string, dto: CreateConnectionInviteDto) {
    await this.requireAdmin(dto.fromFamilyId, userId);

    let toFamilyId = dto.toFamilyId;
    if (!toFamilyId && dto.toFamilyInviteCode) {
      const family = await this.prisma.family.findUnique({
        where: { inviteCode: dto.toFamilyInviteCode.trim().toUpperCase() },
      });
      if (!family) throw new NotFoundException('Family not found for invite code');
      toFamilyId = family.id;
    }
    if (!toFamilyId) {
      throw new BadRequestException('toFamilyId or toFamilyInviteCode required');
    }
    if (toFamilyId === dto.fromFamilyId) {
      throw new BadRequestException('Cannot connect a family to itself');
    }

    const toAdmin = await this.prisma.familyMembership.findFirst({
      where: { familyId: toFamilyId, role: 'admin', status: 'active' },
    });
    if (!toAdmin) {
      throw new BadRequestException('Target family has no active admin');
    }

    if (dto.connectionId) {
      const { connection, familyIds } = await this.requireConnectionAccess(
        dto.connectionId,
        userId,
      );
      if (!familyIds.includes(dto.fromFamilyId)) {
        throw new ForbiddenException('Your family is not in this connection');
      }
      if (connection.memberships.some((m) => m.familyId === toFamilyId)) {
        throw new ConflictException('Family already in this connection');
      }
      await this.requireAdmin(dto.fromFamilyId, userId);
    } else {
      // New connection: block if these two already share an active connection
      const existing = await this.prisma.connection.findFirst({
        where: {
          status: 'active',
          AND: [
            {
              memberships: {
                some: { familyId: dto.fromFamilyId, status: 'active' },
              },
            },
            {
              memberships: {
                some: { familyId: toFamilyId, status: 'active' },
              },
            },
          ],
        },
      });
      if (existing) {
        throw new ConflictException(
          'These families are already connected. Invite into that connection instead.',
        );
      }
    }

    if (dto.fromPersonId) {
      const person = await this.prisma.person.findUnique({
        where: { id: dto.fromPersonId },
      });
      if (!person || person.familyId !== dto.fromFamilyId) {
        throw new BadRequestException(
          'The person marrying must belong to your family',
        );
      }
    }

    const pending = await this.prisma.connectionInvite.findFirst({
      where: {
        fromFamilyId: dto.fromFamilyId,
        toFamilyId,
        status: 'pending',
        connectionId: dto.connectionId ?? null,
      },
    });
    if (pending) {
      throw new ConflictException('A pending invite already exists');
    }

    const invite = await this.prisma.connectionInvite.create({
      data: {
        fromFamilyId: dto.fromFamilyId,
        toFamilyId,
        initiatedByUserId: userId,
        connectionId: dto.connectionId,
        proposedName: dto.proposedName?.trim() || null,
        proposedFeedPolicy: dto.proposedFeedPolicy ?? 'separate_feeds',
        fromPersonId: dto.fromPersonId ?? null,
      },
      include: INVITE_INCLUDE,
    });

    const toAdmins = await this.prisma.familyMembership.findMany({
      where: { familyId: toFamilyId, role: 'admin', status: 'active' },
      select: { userId: true },
    });
    void this.notifications.notifyMany(
      toAdmins.map((a) => a.userId),
      {
        type: 'connection_invite',
        title: 'Connection invite',
        body: invite.fromPerson
          ? `${invite.fromFamily.name} says ${invite.fromPerson.displayName} is marrying into ${invite.toFamily.name}`
          : `${invite.fromFamily.name} wants to connect with ${invite.toFamily.name}`,
        data: { inviteId: invite.id, fromFamilyId: dto.fromFamilyId },
      },
    );

    return { invite: this.serializeInvite(invite) };
  }

  async listInvites(userId: string) {
    const adminFamilies = await this.prisma.familyMembership.findMany({
      where: { userId, role: 'admin', status: 'active' },
      select: { familyId: true },
    });
    const familyIds = adminFamilies.map((f) => f.familyId);
    if (!familyIds.length) {
      return { incoming: [], outgoing: [] };
    }

    const [incoming, outgoing] = await Promise.all([
      this.prisma.connectionInvite.findMany({
        where: { toFamilyId: { in: familyIds }, status: 'pending' },
        include: { ...INVITE_INCLUDE, connection: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.connectionInvite.findMany({
        where: { fromFamilyId: { in: familyIds }, status: 'pending' },
        include: { ...INVITE_INCLUDE, connection: true },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      incoming: incoming.map((i) => this.serializeInvite(i)),
      outgoing: outgoing.map((i) => this.serializeInvite(i)),
    };
  }

  async respondInvite(
    inviteId: string,
    userId: string,
    dto: RespondConnectionInviteDto,
  ) {
    const invite = await this.prisma.connectionInvite.findUnique({
      where: { id: inviteId },
      include: INVITE_INCLUDE,
    });
    if (!invite) throw new NotFoundException('Invite not found');
    if (invite.status !== 'pending') {
      throw new BadRequestException('Invite is no longer pending');
    }
    await this.requireAdmin(invite.toFamilyId, userId);

    if (dto.action === 'decline') {
      const updated = await this.prisma.connectionInvite.update({
        where: { id: inviteId },
        data: { status: 'declined' },
        include: INVITE_INCLUDE,
      });
      return { invite: this.serializeInvite(updated), connection: null };
    }

    const toPerson = dto.toPersonId
      ? await this.prisma.person.findUnique({ where: { id: dto.toPersonId } })
      : null;
    if (dto.toPersonId) {
      if (!toPerson || toPerson.familyId !== invite.toFamilyId) {
        throw new BadRequestException(
          'The person marrying must belong to your family',
        );
      }
      if (!invite.fromPerson) {
        throw new BadRequestException(
          'The inviting family did not name anyone to marry',
        );
      }
    }
    const marriage =
      invite.fromPerson && toPerson
        ? { from: invite.fromPerson, to: toPerson }
        : null;

    // accept
    const result = await this.prisma.$transaction(async (tx) => {
      let connectionId = invite.connectionId;
      let connection;

      if (connectionId) {
        connection = await tx.connection.findUniqueOrThrow({
          where: { id: connectionId },
        });
        if (connection.status !== 'active') {
          throw new BadRequestException('Connection is not active');
        }
        await tx.connectionMembership.create({
          data: {
            connectionId,
            familyId: invite.toFamilyId,
            status: 'active',
          },
        });
      } else {
        const couple = marriage
          ? `${marriage.from.firstName ?? marriage.from.displayName} & ${
              marriage.to.firstName ?? marriage.to.displayName
            }`
          : null;
        const name =
          dto.name?.trim() ||
          invite.proposedName ||
          couple ||
          `${invite.fromFamily.name} & ${invite.toFamily.name}`;
        const feedPolicy = dto.feedPolicy ?? invite.proposedFeedPolicy;

        connection = await tx.connection.create({
          data: {
            name,
            feedPolicy,
            status: 'active',
            memberships: {
              create: [
                { familyId: invite.fromFamilyId, status: 'active' },
                { familyId: invite.toFamilyId, status: 'active' },
              ],
            },
          },
        });
        connectionId = connection.id;
      }

      if (marriage) {
        await tx.bridgeLink.create({
          data: {
            connectionId: connectionId!,
            familyAId: invite.fromFamilyId,
            personAId: marriage.from.id,
            familyBId: invite.toFamilyId,
            personBId: marriage.to.id,
            linkType: 'spouse',
          },
        });
      }

      const updatedInvite = await tx.connectionInvite.update({
        where: { id: inviteId },
        data: { status: 'accepted', connectionId },
        include: INVITE_INCLUDE,
      });

      const full = await tx.connection.findUniqueOrThrow({
        where: { id: connectionId },
        include: {
          memberships: { include: { family: true } },
          bridgeLinks: {
            include: {
              personA: {
                select: { id: true, displayName: true, avatarUrl: true },
              },
              personB: {
                select: { id: true, displayName: true, avatarUrl: true },
              },
            },
          },
        },
      });

      return { invite: updatedInvite, connection: full };
    });

    await this.audit.log({
      actorUserId: userId,
      familyId: invite.toFamilyId,
      entityType: 'connection',
      entityId: result.connection.id,
      action: 'connection.accept',
      meta: {
        fromFamilyId: invite.fromFamilyId,
        toFamilyId: invite.toFamilyId,
      },
    });

    const fromAdmins = await this.prisma.familyMembership.findMany({
      where: {
        familyId: invite.fromFamilyId,
        role: 'admin',
        status: 'active',
      },
      select: { userId: true },
    });
    void this.notifications.notifyMany(
      fromAdmins.map((a) => a.userId).filter((id) => id !== userId),
      {
        type: 'connection_invite',
        title: 'Connection accepted',
        body: `${invite.toFamily.name} accepted the connection`,
        data: { connectionId: result.connection.id },
      },
    );

    return {
      invite: this.serializeInvite(result.invite),
      connection: this.serializeConnection(result.connection),
    };
  }

  async updateConnection(
    connectionId: string,
    userId: string,
    dto: UpdateConnectionDto,
  ) {
    const { connection, familyIds } = await this.requireConnectionAccess(
      connectionId,
      userId,
    );
    // Any admin of a member family can update
    const admin = await this.prisma.familyMembership.findFirst({
      where: {
        userId,
        role: 'admin',
        status: 'active',
        familyId: { in: familyIds },
      },
    });
    if (!admin) throw new ForbiddenException('Family admin required');

    const updated = await this.prisma.connection.update({
      where: { id: connection.id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() || null } : {}),
        ...(dto.feedPolicy !== undefined ? { feedPolicy: dto.feedPolicy } : {}),
      },
      include: {
        memberships: { include: { family: true } },
        bridgeLinks: {
          include: {
            personA: {
              select: { id: true, displayName: true, avatarUrl: true },
            },
            personB: {
              select: { id: true, displayName: true, avatarUrl: true },
            },
          },
        },
      },
    });
    return { connection: this.serializeConnection(updated) };
  }

  async addBridgeLink(
    connectionId: string,
    userId: string,
    dto: CreateBridgeLinkDto,
  ) {
    const { familyIds } = await this.requireConnectionAccess(
      connectionId,
      userId,
    );
    const admin = await this.prisma.familyMembership.findFirst({
      where: {
        userId,
        role: 'admin',
        status: 'active',
        familyId: { in: familyIds },
      },
    });
    if (!admin) throw new ForbiddenException('Family admin required');

    const [personA, personB] = await Promise.all([
      this.prisma.person.findUnique({ where: { id: dto.personAId } }),
      this.prisma.person.findUnique({ where: { id: dto.personBId } }),
    ]);
    if (!personA || !personB) {
      throw new NotFoundException('Person not found');
    }
    if (!familyIds.includes(personA.familyId) || !familyIds.includes(personB.familyId)) {
      throw new BadRequestException(
        'Both persons must belong to families in this connection',
      );
    }
    if (personA.familyId === personB.familyId) {
      throw new BadRequestException(
        'Bridge link must connect persons from different families',
      );
    }

    const link = await this.prisma.bridgeLink.create({
      data: {
        connectionId,
        familyAId: personA.familyId,
        personAId: personA.id,
        familyBId: personB.familyId,
        personBId: personB.id,
        linkType: dto.linkType ?? 'spouse',
      },
      include: {
        personA: {
          select: { id: true, displayName: true, avatarUrl: true },
        },
        personB: {
          select: { id: true, displayName: true, avatarUrl: true },
        },
      },
    });

    await this.audit.log({
      actorUserId: userId,
      entityType: 'bridge_link',
      entityId: link.id,
      action: 'bridge.create',
      meta: {
        connectionId,
        personAId: personA.id,
        personBId: personB.id,
      },
    });

    return {
      bridgeLink: {
        id: link.id,
        linkType: link.linkType,
        familyAId: link.familyAId,
        familyBId: link.familyBId,
        personA: link.personA,
        personB: link.personB,
      },
    };
  }

  async getConnectionTree(connectionId: string, userId: string) {
    const { familyIds } = await this.requireConnectionAccess(
      connectionId,
      userId,
    );

    const [families, persons, relationships, bridges, connection] =
      await Promise.all([
        this.prisma.family.findMany({
          where: { id: { in: familyIds } },
          select: { id: true, name: true, avatarUrl: true },
        }),
        this.prisma.person.findMany({
          where: { familyId: { in: familyIds } },
          select: {
            id: true,
            familyId: true,
            firstName: true,
            lastName: true,
            displayName: true,
            avatarUrl: true,
            userId: true,
            isPlaceholder: true,
          },
        }),
        this.prisma.relationship.findMany({
          where: { familyId: { in: familyIds } },
          select: {
            id: true,
            familyId: true,
            fromPersonId: true,
            toPersonId: true,
            type: true,
            source: true,
          },
        }),
        this.prisma.bridgeLink.findMany({
          where: { connectionId },
          include: {
            personA: {
              select: { id: true, displayName: true, avatarUrl: true },
            },
            personB: {
              select: { id: true, displayName: true, avatarUrl: true },
            },
          },
        }),
        this.prisma.connection.findUniqueOrThrow({
          where: { id: connectionId },
        }),
      ]);

    const trees = families.map((f) => ({
      family: f,
      nodes: persons
        .filter((p) => p.familyId === f.id)
        .map((p) => ({
          id: p.id,
          firstName: p.firstName,
          lastName: p.lastName,
          displayName: p.displayName,
          avatarUrl: p.avatarUrl,
          userId: p.userId,
          isPlaceholder: p.isPlaceholder,
        })),
      edges: relationships
        .filter((r) => r.familyId === f.id)
        .map((r) => ({
          id: r.id,
          fromPersonId: r.fromPersonId,
          toPersonId: r.toPersonId,
          type: r.type,
          source: r.source,
        })),
    }));

    return {
      connection: {
        id: connection.id,
        name: connection.name,
        feedPolicy: connection.feedPolicy,
      },
      trees,
      bridgeLinks: bridges.map((b) => ({
        id: b.id,
        linkType: b.linkType,
        familyAId: b.familyAId,
        familyBId: b.familyBId,
        personA: b.personA,
        personB: b.personB,
      })),
    };
  }

  async getContext(userId: string) {
    const ctx = await this.prisma.userActiveContext.findUnique({
      where: { userId },
      include: {
        family: true,
        connection: {
          include: {
            memberships: { include: { family: true } },
          },
        },
      },
    });

    if (!ctx) {
      const first = await this.prisma.familyMembership.findFirst({
        where: { userId, status: 'active' },
        include: { family: true },
        orderBy: { joinedAt: 'asc' },
      });
      if (!first) {
        return { context: null };
      }
      return {
        context: {
          familyId: first.familyId,
          family: {
            id: first.family.id,
            name: first.family.name,
            avatarUrl: first.family.avatarUrl,
          },
          connectionId: null,
          connection: null,
        },
      };
    }

    return {
      context: {
        familyId: ctx.familyId,
        family: {
          id: ctx.family.id,
          name: ctx.family.name,
          avatarUrl: ctx.family.avatarUrl,
        },
        connectionId: ctx.connectionId,
        connection: ctx.connection
          ? {
              id: ctx.connection.id,
              name: ctx.connection.name,
              feedPolicy: ctx.connection.feedPolicy,
              families: ctx.connection.memberships
                .filter((m) => m.status === 'active')
                .map((m) => ({
                  id: m.family.id,
                  name: m.family.name,
                  avatarUrl: m.family.avatarUrl,
                })),
            }
          : null,
      },
    };
  }

  async setContext(userId: string, dto: UpdateContextDto) {
    await this.requireActiveMember(dto.familyId, userId);

    let connectionId =
      dto.connectionId === undefined ? undefined : dto.connectionId;

    if (connectionId) {
      const { familyIds } = await this.requireConnectionAccess(
        connectionId,
        userId,
      );
      if (!familyIds.includes(dto.familyId)) {
        throw new BadRequestException(
          'Active family must be a member of the selected connection',
        );
      }
    } else if (dto.connectionId === null) {
      connectionId = null;
    }

    const existing = await this.prisma.userActiveContext.findUnique({
      where: { userId },
    });

    const data: Prisma.UserActiveContextUncheckedCreateInput = {
      userId,
      familyId: dto.familyId,
      connectionId:
        connectionId !== undefined
          ? connectionId
          : (existing?.connectionId ?? null),
    };

    // If only family changed and connectionId was omitted, clear invalid connection
    if (dto.connectionId === undefined && existing?.connectionId) {
      try {
        const { familyIds } = await this.requireConnectionAccess(
          existing.connectionId,
          userId,
        );
        if (!familyIds.includes(dto.familyId)) {
          data.connectionId = null;
        }
      } catch {
        data.connectionId = null;
      }
    }

    await this.prisma.userActiveContext.upsert({
      where: { userId },
      create: data,
      update: {
        familyId: data.familyId,
        connectionId: data.connectionId,
      },
    });

    return this.getContext(userId);
  }

  private serializeInvite(
    invite: {
      id: string;
      connectionId: string | null;
      fromFamilyId: string;
      toFamilyId: string;
      status: string;
      proposedName: string | null;
      proposedFeedPolicy: string;
      createdAt: Date;
      fromFamily: { id: string; name: string; avatarUrl: string | null };
      toFamily: { id: string; name: string; avatarUrl: string | null };
      initiatedBy: {
        id: string;
        displayName: string;
        avatarUrl: string | null;
      };
      fromPerson?: {
        id: string;
        displayName: string;
        firstName: string | null;
        lastName: string | null;
        avatarUrl: string | null;
      } | null;
      connection?: { id: string; name: string | null } | null;
    },
  ) {
    return {
      id: invite.id,
      connectionId: invite.connectionId,
      status: invite.status,
      proposedName: invite.proposedName,
      proposedFeedPolicy: invite.proposedFeedPolicy,
      createdAt: invite.createdAt,
      fromFamily: {
        id: invite.fromFamily.id,
        name: invite.fromFamily.name,
        avatarUrl: invite.fromFamily.avatarUrl,
      },
      toFamily: {
        id: invite.toFamily.id,
        name: invite.toFamily.name,
        avatarUrl: invite.toFamily.avatarUrl,
      },
      initiatedBy: invite.initiatedBy,
      fromPerson: invite.fromPerson ?? null,
      existingConnection: invite.connection
        ? { id: invite.connection.id, name: invite.connection.name }
        : null,
    };
  }
}
