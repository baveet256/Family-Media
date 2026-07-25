import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, RelationshipType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../audit/audit.service';
import { CreateJoinRequestDto } from '../families/dto/family.dto';
import {
  PersonRefDto,
  SubmitOnboardingDto,
} from './dto/onboarding.dto';
import { buildDisplayName, splitDisplayName } from '../common/names';

type Tx = Prisma.TransactionClient;

function canonicalPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

@Injectable()
export class JoinRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
  ) {}

  private async requireAdmin(familyId: string, userId: string) {
    const membership = await this.prisma.familyMembership.findUnique({
      where: { familyId_userId: { familyId, userId } },
    });
    if (
      !membership ||
      membership.status !== 'active' ||
      membership.role !== 'admin'
    ) {
      throw new ForbiddenException('Admin access required');
    }
    return membership;
  }

  async create(userId: string, dto: CreateJoinRequestDto) {
    const code = dto.inviteCode.trim().toUpperCase();
    const family = await this.prisma.family.findUnique({
      where: { inviteCode: code },
    });
    if (!family) {
      throw new NotFoundException('Invalid invite code');
    }

    const existingMembership = await this.prisma.familyMembership.findUnique({
      where: { familyId_userId: { familyId: family.id, userId } },
    });
    if (existingMembership && existingMembership.status !== 'removed') {
      throw new ConflictException('You are already a member of this family');
    }

    const existingRequest = await this.prisma.joinRequest.findFirst({
      where: {
        familyId: family.id,
        userId,
        status: 'pending',
      },
    });
    if (existingRequest) {
      return {
        joinRequest: this.serializeRequest(existingRequest, family),
        alreadyPending: true,
        needsOnboarding: true,
      };
    }

    const joinRequest = await this.prisma.joinRequest.create({
      data: {
        familyId: family.id,
        userId,
        inviteCode: code,
        status: 'pending',
      },
    });

    if (!existingMembership) {
      await this.prisma.familyMembership.create({
        data: {
          familyId: family.id,
          userId,
          role: 'member',
          status: 'pending',
        },
      });
    }

    const admins = await this.prisma.familyMembership.findMany({
      where: { familyId: family.id, role: 'admin', status: 'active' },
      select: { userId: true },
    });
    const requester = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { displayName: true },
    });
    void this.notifications.notifyMany(
      admins.map((a) => a.userId),
      {
        type: 'join_request',
        title: 'New join request',
        body: `${requester?.displayName || 'Someone'} wants to join ${family.name}`,
        data: { familyId: family.id, joinRequestId: joinRequest.id },
      },
    );

    return {
      joinRequest: this.serializeRequest(joinRequest, family),
      alreadyPending: false,
      needsOnboarding: true,
    };
  }

  async submitOnboarding(
    joinRequestId: string,
    userId: string,
    dto: SubmitOnboardingDto,
  ) {
    const joinRequest = await this.prisma.joinRequest.findUnique({
      where: { id: joinRequestId },
      include: { family: true, onboardingAnswers: true },
    });
    if (!joinRequest) throw new NotFoundException('Join request not found');
    if (joinRequest.userId !== userId) {
      throw new ForbiddenException('Not your join request');
    }
    if (joinRequest.status === 'rejected') {
      throw new BadRequestException('Join request was rejected');
    }
    if (joinRequest.status === 'approved') {
      const existingPerson = await this.prisma.person.findFirst({
        where: { familyId: joinRequest.familyId, userId },
      });
      if (existingPerson) {
        throw new ConflictException('Onboarding already committed');
      }
    }

    this.validatePersonRef(dto.parent, 'parent');
    if (dto.spouse) this.validatePersonRef(dto.spouse, 'spouse');
    for (const sib of dto.siblings ?? []) {
      this.validatePersonRef(sib, 'sibling');
    }

    // Ensure referenced personIds exist in this family
    await this.assertPersonRefsInFamily(joinRequest.familyId, [
      dto.parent,
      dto.spouse ?? undefined,
      ...(dto.siblings ?? []),
    ]);

    await this.prisma.$transaction(async (tx) => {
      await tx.onboardingAnswer.deleteMany({
        where: { joinRequestId },
      });

      await tx.onboardingAnswer.create({
        data: {
          joinRequestId,
          questionKey: 'parent',
          answerJson: dto.parent as unknown as Prisma.InputJsonValue,
        },
      });

      if (dto.spouse) {
        await tx.onboardingAnswer.create({
          data: {
            joinRequestId,
            questionKey: 'spouse',
            answerJson: dto.spouse as unknown as Prisma.InputJsonValue,
          },
        });
      }

      if (dto.siblings?.length) {
        await tx.onboardingAnswer.create({
          data: {
            joinRequestId,
            questionKey: 'siblings',
            answerJson: dto.siblings as unknown as Prisma.InputJsonValue,
          },
        });
      }
    });

    const settings =
      joinRequest.family.settings &&
      typeof joinRequest.family.settings === 'object' &&
      !Array.isArray(joinRequest.family.settings)
        ? (joinRequest.family.settings as { require_approval?: boolean })
        : {};

    // Auto-approve when family doesn't require approval
    if (
      joinRequest.status === 'pending' &&
      settings.require_approval === false
    ) {
      return this.approve(joinRequestId, /*adminId*/ userId, {
        selfAutoApprove: true,
      });
    }

    return {
      ok: true,
      joinRequestId,
      status: joinRequest.status,
      awaitingApproval: joinRequest.status === 'pending',
      message:
        joinRequest.status === 'pending'
          ? 'Answers saved. Waiting for admin approval.'
          : 'Answers saved.',
    };
  }

  async approve(
    joinRequestId: string,
    adminUserId: string,
    opts: { selfAutoApprove?: boolean } = {},
  ) {
    const joinRequest = await this.prisma.joinRequest.findUnique({
      where: { id: joinRequestId },
      include: {
        user: true,
        family: true,
        onboardingAnswers: true,
      },
    });
    if (!joinRequest) throw new NotFoundException('Join request not found');
    if (joinRequest.status === 'approved') {
      return { ok: true, alreadyApproved: true };
    }
    if (joinRequest.status === 'rejected') {
      throw new BadRequestException('Cannot approve a rejected request');
    }

    if (!opts.selfAutoApprove) {
      await this.requireAdmin(joinRequest.familyId, adminUserId);
    }

    const parentAnswer = joinRequest.onboardingAnswers.find(
      (a) => a.questionKey === 'parent',
    );
    if (!parentAnswer) {
      throw new BadRequestException(
        'Joiner must complete onboarding (parent required) before approval',
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.person.findFirst({
        where: { familyId: joinRequest.familyId, userId: joinRequest.userId },
      });
      if (existing) {
        throw new ConflictException('User already has a tree node');
      }

      const newPerson = await tx.person.create({
        data: {
          familyId: joinRequest.familyId,
          userId: joinRequest.userId,
          firstName: joinRequest.user.firstName || '',
          lastName: joinRequest.user.lastName || '',
          displayName:
            joinRequest.user.displayName ||
            buildDisplayName(
              joinRequest.user.firstName,
              joinRequest.user.lastName,
            ) ||
            joinRequest.user.phone,
          avatarUrl: joinRequest.user.avatarUrl,
          isPlaceholder: false,
        },
      });

      const parentRef = parentAnswer.answerJson as unknown as PersonRefDto;
      const parentId = await this.resolvePersonRef(
        tx,
        joinRequest.familyId,
        parentRef,
      );
      if (parentId === newPerson.id) {
        throw new BadRequestException('Cannot be your own parent');
      }
      await this.createEdge(
        tx,
        joinRequest.familyId,
        parentId,
        newPerson.id,
        'parent_of',
      );

      const spouseAnswer = joinRequest.onboardingAnswers.find(
        (a) => a.questionKey === 'spouse',
      );
      if (spouseAnswer) {
        const spouseRef = spouseAnswer.answerJson as unknown as PersonRefDto;
        const spouseId = await this.resolvePersonRef(
          tx,
          joinRequest.familyId,
          spouseRef,
        );
        if (spouseId === newPerson.id) {
          throw new BadRequestException('Cannot be your own spouse');
        }
        const [a, b] = canonicalPair(newPerson.id, spouseId);
        await this.createEdge(tx, joinRequest.familyId, a, b, 'spouse_of');
      }

      const siblingsAnswer = joinRequest.onboardingAnswers.find(
        (a) => a.questionKey === 'siblings',
      );
      if (siblingsAnswer && Array.isArray(siblingsAnswer.answerJson)) {
        for (const sib of siblingsAnswer.answerJson as unknown as PersonRefDto[]) {
          const sibId = await this.resolvePersonRef(
            tx,
            joinRequest.familyId,
            sib,
          );
          if (sibId === newPerson.id) continue;
          const [a, b] = canonicalPair(newPerson.id, sibId);
          await this.createEdge(tx, joinRequest.familyId, a, b, 'sibling_of');
          // Also link sibling to same parent if not already
          await this.createEdge(
            tx,
            joinRequest.familyId,
            parentId,
            sibId,
            'parent_of',
          );
        }
      }

      await tx.joinRequest.update({
        where: { id: joinRequestId },
        data: { status: 'approved' },
      });

      await tx.familyMembership.update({
        where: {
          familyId_userId: {
            familyId: joinRequest.familyId,
            userId: joinRequest.userId,
          },
        },
        data: { status: 'active', role: 'member' },
      });

      return newPerson;
    });

    await this.audit.log({
      actorUserId: adminUserId,
      familyId: joinRequest.familyId,
      entityType: 'join_request',
      entityId: joinRequestId,
      action: 'join_request.approve',
      meta: { personId: result.id, userId: joinRequest.userId },
    });
    void this.notifications.notify({
      userId: joinRequest.userId,
      type: 'join_request',
      title: 'Welcome to the family',
      body: `Your request to join ${joinRequest.family.name} was approved`,
      data: { familyId: joinRequest.familyId },
    });

    return {
      ok: true,
      personId: result.id,
      familyId: joinRequest.familyId,
      status: 'approved' as const,
    };
  }

  async reject(joinRequestId: string, adminUserId: string) {
    const joinRequest = await this.prisma.joinRequest.findUnique({
      where: { id: joinRequestId },
    });
    if (!joinRequest) throw new NotFoundException('Join request not found');
    await this.requireAdmin(joinRequest.familyId, adminUserId);
    if (joinRequest.status !== 'pending') {
      throw new BadRequestException('Only pending requests can be rejected');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.joinRequest.update({
        where: { id: joinRequestId },
        data: { status: 'rejected' },
      });
      await tx.familyMembership.updateMany({
        where: {
          familyId: joinRequest.familyId,
          userId: joinRequest.userId,
          status: 'pending',
        },
        data: { status: 'removed' },
      });
    });

    return { ok: true, status: 'rejected' as const };
  }

  private serializeRequest(
    joinRequest: {
      id: string;
      status: string;
      inviteCode: string | null;
      createdAt: Date;
    },
    family: { id: string; name: string; avatarUrl: string | null },
  ) {
    return {
      id: joinRequest.id,
      status: joinRequest.status,
      inviteCode: joinRequest.inviteCode,
      createdAt: joinRequest.createdAt,
      family: {
        id: family.id,
        name: family.name,
        avatarUrl: family.avatarUrl,
      },
    };
  }

  private validatePersonRef(ref: PersonRefDto, label: string) {
    if (!ref.personId && !ref.name?.trim()) {
      throw new BadRequestException(
        `${label}: provide personId or name for a placeholder`,
      );
    }
  }

  private async assertPersonRefsInFamily(
    familyId: string,
    refs: Array<PersonRefDto | undefined>,
  ) {
    const ids = refs
      .filter((r): r is PersonRefDto => !!r?.personId)
      .map((r) => r.personId!);
    if (!ids.length) return;
    const found = await this.prisma.person.findMany({
      where: { familyId, id: { in: ids } },
      select: { id: true },
    });
    if (found.length !== new Set(ids).size) {
      throw new BadRequestException('One or more personIds are invalid');
    }
  }

  private async resolvePersonRef(
    tx: Tx,
    familyId: string,
    ref: PersonRefDto,
  ): Promise<string> {
    if (ref.personId) {
      const person = await tx.person.findFirst({
        where: { id: ref.personId, familyId },
      });
      if (!person) throw new BadRequestException('Invalid personId');
      return person.id;
    }

    const split = splitDisplayName(ref.name!.trim());
    const created = await tx.person.create({
      data: {
        familyId,
        firstName: split.firstName,
        lastName: split.lastName,
        displayName: ref.name!.trim(),
        phone: ref.phone?.trim() || null,
        isPlaceholder: true,
      },
    });
    return created.id;
  }

  private async createEdge(
    tx: Tx,
    familyId: string,
    fromPersonId: string,
    toPersonId: string,
    type: RelationshipType,
  ) {
    await tx.relationship.upsert({
      where: {
        familyId_fromPersonId_toPersonId_type: {
          familyId,
          fromPersonId,
          toPersonId,
          type,
        },
      },
      create: {
        familyId,
        fromPersonId,
        toPersonId,
        type,
        source: 'onboarding',
      },
      update: {},
    });
  }
}
