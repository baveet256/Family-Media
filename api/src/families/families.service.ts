import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateFamilyDto,
  InviteByPhoneDto,
  UpdateFamilyDto,
} from './dto/family.dto';
import { splitDisplayName } from '../common/names';

type FamilySettings = {
  require_approval?: boolean;
  who_can_invite?: string;
};

function settingsOf(raw: Prisma.JsonValue): FamilySettings {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as FamilySettings;
  }
  return {};
}

function generateInviteCode(): string {
  // 8-char alphanumeric, easy to type / encode in QR
  return randomBytes(6).toString('base64url').slice(0, 8).toUpperCase();
}

@Injectable()
export class FamiliesService {
  private readonly logger = new Logger('Families');

  constructor(private readonly prisma: PrismaService) {}

  private async requireAdmin(familyId: string, userId: string) {
    const membership = await this.prisma.familyMembership.findUnique({
      where: {
        familyId_userId: { familyId, userId },
      },
    });
    if (!membership || membership.status !== 'active' || membership.role !== 'admin') {
      throw new ForbiddenException('Admin access required');
    }
    return membership;
  }

  private serializeFamily(family: {
    id: string;
    name: string;
    avatarUrl: string | null;
    inviteCode: string;
    settings: Prisma.JsonValue;
    createdAt: Date;
  }) {
    const settings = settingsOf(family.settings);
    return {
      id: family.id,
      name: family.name,
      avatarUrl: family.avatarUrl,
      inviteCode: family.inviteCode,
      settings: {
        requireApproval: settings.require_approval ?? true,
        whoCanInvite: settings.who_can_invite ?? 'admin',
      },
      createdAt: family.createdAt,
    };
  }

  async create(userId: string, dto: CreateFamilyDto) {
    let inviteCode = generateInviteCode();
    for (let attempt = 0; attempt < 5; attempt++) {
      const clash = await this.prisma.family.findUnique({
        where: { inviteCode },
      });
      if (!clash) break;
      inviteCode = generateInviteCode();
    }

    const family = await this.prisma.$transaction(async (tx) => {
      const created = await tx.family.create({
        data: {
          name: dto.name.trim(),
          avatarUrl: dto.avatarUrl,
          inviteCode,
          settings: {
            require_approval: dto.requireApproval ?? true,
            who_can_invite: 'admin',
          },
        },
      });

      await tx.familyMembership.create({
        data: {
          familyId: created.id,
          userId,
          role: 'admin',
          status: 'active',
        },
      });

      const founder = await tx.user.findUniqueOrThrow({ where: { id: userId } });
      const displayName =
        founder.displayName ||
        [founder.firstName, founder.lastName].filter(Boolean).join(' ') ||
        founder.phone;
      await tx.person.create({
        data: {
          familyId: created.id,
          userId,
          firstName: founder.firstName || splitDisplayName(displayName).firstName,
          lastName: founder.lastName || splitDisplayName(displayName).lastName,
          displayName,
          avatarUrl: founder.avatarUrl,
          isPlaceholder: false,
        },
      });

      await tx.chat.create({
        data: {
          familyId: created.id,
          type: 'group',
          name: 'Family',
          participants: {
            create: [{ userId, lastReadAt: new Date() }],
          },
        },
      });

      return created;
    });

    return {
      family: this.serializeFamily(family),
      role: 'admin' as const,
    };
  }

  async getById(familyId: string, userId: string) {
    const membership = await this.prisma.familyMembership.findUnique({
      where: { familyId_userId: { familyId, userId } },
    });
    if (!membership || membership.status === 'removed') {
      throw new ForbiddenException('Not a member of this family');
    }

    const family = await this.prisma.family.findUnique({
      where: { id: familyId },
    });
    if (!family) throw new NotFoundException('Family not found');

    const serialized = this.serializeFamily(family);
    return {
      family:
        membership.status === 'active'
          ? serialized
          : { ...serialized, inviteCode: null },
      role: membership.role,
      status: membership.status,
    };
  }

  async update(familyId: string, userId: string, dto: UpdateFamilyDto) {
    await this.requireAdmin(familyId, userId);
    const family = await this.prisma.family.findUnique({
      where: { id: familyId },
    });
    if (!family) throw new NotFoundException('Family not found');

    const current = settingsOf(family.settings);
    const nextSettings: FamilySettings = { ...current };
    if (dto.requireApproval !== undefined) {
      nextSettings.require_approval = dto.requireApproval;
    }

    const updated = await this.prisma.family.update({
      where: { id: familyId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.avatarUrl !== undefined ? { avatarUrl: dto.avatarUrl } : {}),
        settings: nextSettings as Prisma.InputJsonValue,
      },
    });

    return { family: this.serializeFamily(updated) };
  }

  async inviteByPhone(familyId: string, userId: string, dto: InviteByPhoneDto) {
    await this.requireAdmin(familyId, userId);
    const family = await this.prisma.family.findUnique({
      where: { id: familyId },
    });
    if (!family) throw new NotFoundException('Family not found');

    const phone = dto.phone.trim();
    const deepLink = `familymedia://join?code=${family.inviteCode}`;
    // SMS stub — replace with Twilio/WhatsApp later. Never log the recipient
    // phone or the invite code: logs are long-lived and widely readable.
    this.logger.log(`Invite issued for family ${family.id}`);

    return {
      ok: true,
      phone,
      inviteCode: family.inviteCode,
      deepLink,
      smsStub: true,
      message: `Invite logged for ${phone} (SMS stub). Share code ${family.inviteCode}.`,
    };
  }

  async listJoinRequests(familyId: string, userId: string) {
    await this.requireAdmin(familyId, userId);
    const requests = await this.prisma.joinRequest.findMany({
      where: { familyId },
      include: {
        user: true,
        onboardingAnswers: { select: { questionKey: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      joinRequests: requests.map((jr) => ({
        id: jr.id,
        status: jr.status,
        inviteCode: jr.inviteCode,
        createdAt: jr.createdAt,
        hasOnboarding: jr.onboardingAnswers.some((a) => a.questionKey === 'parent'),
        onboardingKeys: jr.onboardingAnswers.map((a) => a.questionKey),
        user: {
          id: jr.user.id,
          phone: jr.user.phone,
          displayName: jr.user.displayName,
          avatarUrl: jr.user.avatarUrl,
        },
      })),
    };
  }
}
