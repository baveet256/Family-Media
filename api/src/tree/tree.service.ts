import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { buildDisplayName } from '../common/names';

@Injectable()
export class TreeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  private async requireMember(familyId: string, userId: string) {
    const membership = await this.prisma.familyMembership.findUnique({
      where: { familyId_userId: { familyId, userId } },
    });
    if (!membership || membership.status === 'removed') {
      throw new ForbiddenException('Not a member of this family');
    }
    // Pending members can view tree to pick parents during onboarding
    return membership;
  }

  /** Own family, or a family joined via an active connection */
  private async requireMemberOrConnected(familyId: string, userId: string) {
    const direct = await this.prisma.familyMembership.findUnique({
      where: { familyId_userId: { familyId, userId } },
    });
    if (direct && direct.status !== 'removed') return direct;

    const myFamilies = await this.prisma.familyMembership.findMany({
      where: { userId, status: 'active' },
      select: { familyId: true },
    });
    const myIds = myFamilies.map((m) => m.familyId);
    if (!myIds.length) {
      throw new ForbiddenException('Not a member of this family');
    }

    const linked = await this.prisma.connectionMembership.findFirst({
      where: {
        familyId,
        status: 'active',
        connection: {
          status: 'active',
          memberships: {
            some: { familyId: { in: myIds }, status: 'active' },
          },
        },
      },
    });
    if (!linked) {
      throw new ForbiddenException('Not a member of this family');
    }
    return null;
  }

  async getTree(familyId: string, userId: string) {
    const membership = await this.requireMember(familyId, userId);
    // Pending members see the shape of the tree to pick their parents during
    // onboarding, but not everyone's contact details.
    const canSeeContactDetails = membership.status === 'active';

    const family = await this.prisma.family.findUnique({
      where: { id: familyId },
    });
    if (!family) throw new NotFoundException('Family not found');

    const [persons, relationships] = await Promise.all([
      this.prisma.person.findMany({
        where: { familyId },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.relationship.findMany({
        where: { familyId },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    return {
      family: {
        id: family.id,
        name: family.name,
        avatarUrl: family.avatarUrl,
      },
      nodes: persons.map((p) => ({
        id: p.id,
        firstName: p.firstName,
        lastName: p.lastName,
        displayName: p.displayName,
        avatarUrl: p.avatarUrl,
        userId: p.userId,
        isPlaceholder: p.isPlaceholder,
        phone: canSeeContactDetails ? p.phone : null,
      })),
      edges: relationships.map((r) => ({
        id: r.id,
        fromPersonId: r.fromPersonId,
        toPersonId: r.toPersonId,
        type: r.type,
        source: r.source,
      })),
    };
  }

  async listPersons(familyId: string, userId: string) {
    await this.requireMember(familyId, userId);
    const persons = await this.prisma.person.findMany({
      where: { familyId },
      orderBy: { displayName: 'asc' },
    });
    return {
      persons: persons.map((p) => ({
        id: p.id,
        firstName: p.firstName,
        lastName: p.lastName,
        displayName: p.displayName,
        avatarUrl: p.avatarUrl,
        userId: p.userId,
        isPlaceholder: p.isPlaceholder,
      })),
    };
  }

  async getPerson(personId: string, userId: string) {
    const person = await this.prisma.person.findUnique({
      where: { id: personId },
      include: {
        family: { select: { id: true, name: true } },
        user: { select: { id: true, status: true } },
      },
    });
    if (!person) throw new NotFoundException('Person not found');
    const viaMembership = await this.requireMemberOrConnected(
      person.familyId,
      userId,
    );
    // null means access was granted through an active connection; a direct
    // membership still has to be active to see contact details.
    const canSeeContactDetails =
      !viaMembership || viaMembership.status === 'active';

    const [asChild, asParent, spouses, siblings] = await Promise.all([
      this.prisma.relationship.findMany({
        where: {
          familyId: person.familyId,
          type: 'parent_of',
          toPersonId: personId,
        },
        include: { fromPerson: true },
      }),
      this.prisma.relationship.findMany({
        where: {
          familyId: person.familyId,
          type: 'parent_of',
          fromPersonId: personId,
        },
        include: { toPerson: true },
      }),
      this.prisma.relationship.findMany({
        where: {
          familyId: person.familyId,
          type: 'spouse_of',
          OR: [{ fromPersonId: personId }, { toPersonId: personId }],
        },
        include: { fromPerson: true, toPerson: true },
      }),
      this.prisma.relationship.findMany({
        where: {
          familyId: person.familyId,
          type: 'sibling_of',
          OR: [{ fromPersonId: personId }, { toPersonId: personId }],
        },
        include: { fromPerson: true, toPerson: true },
      }),
    ]);

    const parents = asChild.map((r) => ({
      id: r.fromPerson.id,
      displayName: r.fromPerson.displayName,
      isPlaceholder: r.fromPerson.isPlaceholder,
    }));
    const children = asParent.map((r) => ({
      id: r.toPerson.id,
      displayName: r.toPerson.displayName,
      isPlaceholder: r.toPerson.isPlaceholder,
    }));
    const dedupe = <T extends { id: string }>(list: T[]) => {
      const seen = new Set<string>();
      return list.filter((item) => {
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      });
    };
    let spouseList = dedupe(
      spouses.map((r) => {
        const other =
          r.fromPersonId === personId ? r.toPerson : r.fromPerson;
        return {
          id: other.id,
          displayName: other.displayName,
          isPlaceholder: other.isPlaceholder,
        };
      }),
    );
    const siblingList = dedupe(
      siblings.map((r) => {
        const other =
          r.fromPersonId === personId ? r.toPerson : r.fromPerson;
        return {
          id: other.id,
          displayName: other.displayName,
          isPlaceholder: other.isPlaceholder,
        };
      }),
    );

    // Cross-family marriage bridges (e.g. Vikram ↔ Aisha)
    const bridges = await this.prisma.bridgeLink.findMany({
      where: {
        OR: [{ personAId: personId }, { personBId: personId }],
        connection: { status: 'active' },
      },
      include: {
        personA: true,
        personB: true,
        familyA: { select: { name: true } },
        familyB: { select: { name: true } },
      },
    });
    for (const b of bridges) {
      if (b.linkType !== 'spouse') continue;
      const other = b.personAId === personId ? b.personB : b.personA;
      const otherFamily =
        b.personAId === personId ? b.familyB.name : b.familyA.name;
      if (!spouseList.some((s) => s.id === other.id)) {
        spouseList.push({
          id: other.id,
          displayName: `${other.displayName} (${otherFamily})`,
          isPlaceholder: other.isPlaceholder,
        });
      }
    }

    const parts: string[] = [];
    if (parents.length) {
      parts.push(`child of ${parents.map((p) => p.displayName).join(' & ')}`);
    }
    if (spouseList.length) {
      parts.push(
        `spouse of ${spouseList.map((p) => p.displayName).join(', ')}`,
      );
    }
    if (siblingList.length) {
      parts.push(
        `sibling of ${siblingList.map((p) => p.displayName).join(', ')}`,
      );
    }
    if (children.length) {
      parts.push(
        `parent of ${children.map((p) => p.displayName).join(', ')}`,
      );
    }

    return {
      person: {
        id: person.id,
        familyId: person.familyId,
        firstName: person.firstName,
        lastName: person.lastName,
        displayName: person.displayName,
        avatarUrl: person.avatarUrl,
        userId: person.userId,
        isPlaceholder: person.isPlaceholder,
        phone: canSeeContactDetails ? person.phone : null,
        status: person.user?.status || '',
        birthDate: canSeeContactDetails ? person.birthDate : null,
        deathDate: canSeeContactDetails ? person.deathDate : null,
        family: person.family,
      },
      parents,
      children,
      spouses: spouseList,
      siblings: siblingList,
      /** Whether holding this face can offer a chat: they're on the app, not you. */
      canMessage: !!person.userId && person.userId !== userId,
      isMe: person.userId === userId,
      summary: parts.length ? parts.join('; ') : 'No relationships yet',
    };
  }

  async updatePerson(
    personId: string,
    userId: string,
    dto: {
      firstName?: string;
      lastName?: string;
      avatarUrl?: string | null;
    },
  ) {
    const person = await this.prisma.person.findUnique({
      where: { id: personId },
    });
    if (!person) throw new NotFoundException('Person not found');

    const membership = await this.prisma.familyMembership.findUnique({
      where: { familyId_userId: { familyId: person.familyId, userId } },
    });
    if (!membership || membership.status !== 'active') {
      throw new ForbiddenException('Active family membership required');
    }
    const canEdit =
      person.userId === userId || membership.role === 'admin';
    if (!canEdit) {
      throw new ForbiddenException(
        'Only the linked member or a family admin can edit this person',
      );
    }

    const firstName =
      dto.firstName !== undefined ? dto.firstName.trim() : person.firstName;
    const lastName =
      dto.lastName !== undefined ? dto.lastName.trim() : person.lastName;
    const displayName = buildDisplayName(firstName, lastName) || person.displayName;

    const updated = await this.prisma.person.update({
      where: { id: personId },
      data: {
        firstName,
        lastName,
        displayName,
        ...(dto.avatarUrl !== undefined ? { avatarUrl: dto.avatarUrl } : {}),
      },
    });

    if (person.userId) {
      await this.prisma.user.update({
        where: { id: person.userId },
        data: {
          firstName,
          lastName,
          displayName,
          ...(dto.avatarUrl !== undefined ? { avatarUrl: dto.avatarUrl } : {}),
        },
      });
    }

    return {
      person: {
        id: updated.id,
        familyId: updated.familyId,
        firstName: updated.firstName,
        lastName: updated.lastName,
        displayName: updated.displayName,
        avatarUrl: updated.avatarUrl,
        userId: updated.userId,
        isPlaceholder: updated.isPlaceholder,
      },
    };
  }

  async requestRelationshipChange(
    userId: string,
    dto: {
      familyId: string;
      fromPersonId: string;
      toPersonId: string;
      type: 'parent_of' | 'spouse_of' | 'sibling_of';
      action: 'create' | 'delete';
      note?: string;
    },
  ) {
    const membership = await this.prisma.familyMembership.findUnique({
      where: { familyId_userId: { familyId: dto.familyId, userId } },
    });
    if (!membership || membership.status !== 'active') {
      throw new ForbiddenException('Active family membership required');
    }

    const [from, to] = await Promise.all([
      this.prisma.person.findUnique({ where: { id: dto.fromPersonId } }),
      this.prisma.person.findUnique({ where: { id: dto.toPersonId } }),
    ]);
    if (!from || !to || from.familyId !== dto.familyId || to.familyId !== dto.familyId) {
      throw new BadRequestException('Persons must belong to this family');
    }
    if (from.id === to.id) {
      throw new BadRequestException('Cannot relate a person to themselves');
    }

    if (dto.action === 'delete') {
      const existing = await this.prisma.relationship.findFirst({
        where: {
          familyId: dto.familyId,
          fromPersonId: dto.fromPersonId,
          toPersonId: dto.toPersonId,
          type: dto.type,
        },
      });
      if (!existing) {
        throw new NotFoundException('Relationship not found');
      }
    }

    const request = await this.prisma.relationshipChangeRequest.create({
      data: {
        familyId: dto.familyId,
        requestedByUserId: userId,
        fromPersonId: dto.fromPersonId,
        toPersonId: dto.toPersonId,
        type: dto.type,
        action: dto.action,
        note: dto.note?.trim() || null,
      },
      include: {
        fromPerson: { select: { id: true, displayName: true } },
        toPerson: { select: { id: true, displayName: true } },
        requestedBy: {
          select: { id: true, displayName: true, avatarUrl: true },
        },
      },
    });

    await this.audit.log({
      actorUserId: userId,
      familyId: dto.familyId,
      entityType: 'relationship_change_request',
      entityId: request.id,
      action: 'relationship.request',
      meta: {
        type: dto.type,
        action: dto.action,
        fromPersonId: dto.fromPersonId,
        toPersonId: dto.toPersonId,
      },
    });

    const admins = await this.prisma.familyMembership.findMany({
      where: { familyId: dto.familyId, role: 'admin', status: 'active' },
      select: { userId: true },
    });
    await this.notifications.notifyMany(
      admins.map((a) => a.userId).filter((id) => id !== userId),
      {
        type: 'relationship_request',
        title: 'Relationship change requested',
        body: `${request.requestedBy.displayName || 'A member'} requested a tree correction`,
        data: { familyId: dto.familyId, requestId: request.id },
      },
    );

    return { request: this.serializeChangeRequest(request) };
  }

  async listRelationshipRequests(familyId: string, userId: string) {
    const membership = await this.prisma.familyMembership.findUnique({
      where: { familyId_userId: { familyId, userId } },
    });
    if (!membership || membership.status !== 'active') {
      throw new ForbiddenException('Active family membership required');
    }

    const requests = await this.prisma.relationshipChangeRequest.findMany({
      where: {
        familyId,
        ...(membership.role === 'admin' ? {} : { requestedByUserId: userId }),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        fromPerson: { select: { id: true, displayName: true } },
        toPerson: { select: { id: true, displayName: true } },
        requestedBy: {
          select: { id: true, displayName: true, avatarUrl: true },
        },
      },
    });

    return { requests: requests.map((r) => this.serializeChangeRequest(r)) };
  }

  async reviewRelationshipRequest(
    requestId: string,
    userId: string,
    action: 'approve' | 'reject',
  ) {
    const request = await this.prisma.relationshipChangeRequest.findUnique({
      where: { id: requestId },
      include: {
        fromPerson: { select: { id: true, displayName: true } },
        toPerson: { select: { id: true, displayName: true } },
        requestedBy: {
          select: { id: true, displayName: true, avatarUrl: true },
        },
      },
    });
    if (!request) throw new NotFoundException('Request not found');
    if (request.status !== 'pending') {
      throw new BadRequestException('Request is no longer pending');
    }

    const membership = await this.prisma.familyMembership.findUnique({
      where: {
        familyId_userId: { familyId: request.familyId, userId },
      },
    });
    if (!membership || membership.status !== 'active' || membership.role !== 'admin') {
      throw new ForbiddenException('Family admin required');
    }

    if (action === 'reject') {
      const updated = await this.prisma.relationshipChangeRequest.update({
        where: { id: requestId },
        data: {
          status: 'rejected',
          reviewedByUserId: userId,
          reviewedAt: new Date(),
        },
        include: {
          fromPerson: { select: { id: true, displayName: true } },
          toPerson: { select: { id: true, displayName: true } },
          requestedBy: {
            select: { id: true, displayName: true, avatarUrl: true },
          },
        },
      });
      await this.audit.log({
        actorUserId: userId,
        familyId: request.familyId,
        entityType: 'relationship_change_request',
        entityId: requestId,
        action: 'relationship.reject',
      });
      await this.notifications.notify({
        userId: request.requestedByUserId,
        type: 'relationship_request',
        title: 'Relationship change declined',
        body: 'An admin declined your tree correction request',
        data: { familyId: request.familyId, requestId },
      });
      return { request: this.serializeChangeRequest(updated) };
    }

    // approve
    await this.prisma.$transaction(async (tx) => {
      if (request.action === 'create') {
        await tx.relationship.upsert({
          where: {
            familyId_fromPersonId_toPersonId_type: {
              familyId: request.familyId,
              fromPersonId: request.fromPersonId,
              toPersonId: request.toPersonId,
              type: request.type,
            },
          },
          create: {
            familyId: request.familyId,
            fromPersonId: request.fromPersonId,
            toPersonId: request.toPersonId,
            type: request.type,
            source: 'admin',
          },
          update: {},
        });
        // mirror spouse/sibling
        if (request.type === 'spouse_of' || request.type === 'sibling_of') {
          await tx.relationship.upsert({
            where: {
              familyId_fromPersonId_toPersonId_type: {
                familyId: request.familyId,
                fromPersonId: request.toPersonId,
                toPersonId: request.fromPersonId,
                type: request.type,
              },
            },
            create: {
              familyId: request.familyId,
              fromPersonId: request.toPersonId,
              toPersonId: request.fromPersonId,
              type: request.type,
              source: 'admin',
            },
            update: {},
          });
        }
      } else {
        await tx.relationship.deleteMany({
          where: {
            familyId: request.familyId,
            OR: [
              {
                fromPersonId: request.fromPersonId,
                toPersonId: request.toPersonId,
                type: request.type,
              },
              ...(request.type === 'spouse_of' || request.type === 'sibling_of'
                ? [
                    {
                      fromPersonId: request.toPersonId,
                      toPersonId: request.fromPersonId,
                      type: request.type,
                    },
                  ]
                : []),
            ],
          },
        });
      }

      await tx.relationshipChangeRequest.update({
        where: { id: requestId },
        data: {
          status: 'approved',
          reviewedByUserId: userId,
          reviewedAt: new Date(),
        },
      });
    });

    await this.audit.log({
      actorUserId: userId,
      familyId: request.familyId,
      entityType: 'relationship',
      entityId: requestId,
      action:
        request.action === 'create'
          ? 'relationship.create'
          : 'relationship.delete',
      meta: {
        type: request.type,
        fromPersonId: request.fromPersonId,
        toPersonId: request.toPersonId,
      },
    });

    await this.notifications.notify({
      userId: request.requestedByUserId,
      type: 'relationship_request',
      title: 'Relationship change approved',
      body: 'An admin approved your tree correction',
      data: { familyId: request.familyId, requestId },
    });

    const updated = await this.prisma.relationshipChangeRequest.findUniqueOrThrow({
      where: { id: requestId },
      include: {
        fromPerson: { select: { id: true, displayName: true } },
        toPerson: { select: { id: true, displayName: true } },
        requestedBy: {
          select: { id: true, displayName: true, avatarUrl: true },
        },
      },
    });
    return { request: this.serializeChangeRequest(updated) };
  }

  private serializeChangeRequest(r: {
    id: string;
    familyId: string;
    type: string;
    action: string;
    note: string | null;
    status: string;
    createdAt: Date;
    reviewedAt?: Date | null;
    fromPerson: { id: string; displayName: string };
    toPerson: { id: string; displayName: string };
    requestedBy: { id: string; displayName: string; avatarUrl: string | null };
  }) {
    return {
      id: r.id,
      familyId: r.familyId,
      type: r.type,
      action: r.action,
      note: r.note,
      status: r.status,
      createdAt: r.createdAt,
      reviewedAt: r.reviewedAt ?? null,
      fromPerson: r.fromPerson,
      toPerson: r.toPerson,
      requestedBy: r.requestedBy,
    };
  }
}
