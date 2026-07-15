import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateJoinRequestDto } from '../families/dto/family.dto';

@Injectable()
export class JoinRequestsService {
  constructor(private readonly prisma: PrismaService) {}

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
        joinRequest: {
          id: existingRequest.id,
          status: existingRequest.status,
          inviteCode: existingRequest.inviteCode,
          createdAt: existingRequest.createdAt,
          family: {
            id: family.id,
            name: family.name,
            avatarUrl: family.avatarUrl,
          },
        },
        alreadyPending: true,
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

    // Pending membership placeholder so UI can show "waiting for approval"
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

    return {
      joinRequest: {
        id: joinRequest.id,
        status: joinRequest.status,
        inviteCode: joinRequest.inviteCode,
        createdAt: joinRequest.createdAt,
        family: {
          id: family.id,
          name: family.name,
          avatarUrl: family.avatarUrl,
        },
      },
      alreadyPending: false,
    };
  }
}
