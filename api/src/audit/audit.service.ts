import { ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(input: {
    actorUserId?: string | null;
    familyId?: string | null;
    entityType: string;
    entityId?: string | null;
    action: string;
    meta?: Record<string, unknown>;
  }) {
    return this.prisma.auditEvent.create({
      data: {
        actorUserId: input.actorUserId ?? null,
        familyId: input.familyId ?? null,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        action: input.action,
        metaJson: (input.meta ?? {}) as Prisma.InputJsonValue,
      },
    });
  }

  async listForFamily(familyId: string, userId: string, limit = 50) {
    const membership = await this.prisma.familyMembership.findUnique({
      where: { familyId_userId: { familyId, userId } },
    });
    if (!membership || membership.status === 'removed') {
      throw new ForbiddenException('Not a member of this family');
    }
    if (membership.role !== 'admin') {
      throw new ForbiddenException('Family admin required to view audit log');
    }

    const events = await this.prisma.auditEvent.findMany({
      where: { familyId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 100),
      include: {
        actor: {
          select: { id: true, displayName: true, avatarUrl: true },
        },
      },
    });
    return {
      events: events.map((e) => ({
        id: e.id,
        action: e.action,
        entityType: e.entityType,
        entityId: e.entityId,
        meta: e.metaJson,
        createdAt: e.createdAt,
        actor: e.actor,
      })),
    };
  }
}
