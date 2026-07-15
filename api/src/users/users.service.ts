import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { UpdateUserDto } from '../families/dto/family.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
  ) {}

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const memberships = await this.prisma.familyMembership.findMany({
      where: { userId, status: { in: ['active', 'pending'] } },
      include: { family: true },
      orderBy: { joinedAt: 'asc' },
    });

    const joinRequests = await this.prisma.joinRequest.findMany({
      where: { userId, status: 'pending' },
      include: { family: true },
      orderBy: { createdAt: 'desc' },
    });

    return {
      user: this.auth.serializeUser(user),
      families: memberships.map((m) => {
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
          inviteCode: m.family.inviteCode,
          role: m.role,
          status: m.status,
          settings: {
            requireApproval: settings.require_approval ?? true,
            whoCanInvite: settings.who_can_invite ?? 'admin',
          },
        };
      }),
      pendingJoinRequests: joinRequests.map((jr) => ({
        id: jr.id,
        status: jr.status,
        family: {
          id: jr.family.id,
          name: jr.family.name,
          avatarUrl: jr.family.avatarUrl,
        },
        createdAt: jr.createdAt,
      })),
      needsProfile: !user.displayName,
      needsFamily:
        memberships.filter((m) => m.status === 'active').length === 0 &&
        joinRequests.length === 0,
    };
  }

  async updateMe(userId: string, dto: UpdateUserDto) {
    const data: { displayName?: string; avatarUrl?: string | null } = {};
    if (dto.displayName !== undefined) {
      data.displayName = dto.displayName.trim();
    }
    if (dto.avatarUrl !== undefined) {
      data.avatarUrl = dto.avatarUrl;
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data,
    });

    return { user: this.auth.serializeUser(user) };
  }
}
