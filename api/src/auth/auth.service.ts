import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomInt } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { SendOtpDto, VerifyOtpDto } from './dto/otp.dto';
import { splitDisplayName } from '../common/names';

const OTP_TTL_SECONDS = 300;

function normalizePhone(phone: string): string {
  const trimmed = phone.trim();
  if (trimmed.startsWith('+')) {
    return `+${trimmed.slice(1).replace(/\D/g, '')}`;
  }
  return trimmed.replace(/\D/g, '');
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async sendOtp(dto: SendOtpDto) {
    const phone = normalizePhone(dto.phone);
    if (phone.replace(/\D/g, '').length < 8) {
      throw new BadRequestException('Invalid phone number');
    }

    const otp = String(randomInt(100000, 1000000));
    await this.redis.client.set(`otp:${phone}`, otp, 'EX', OTP_TTL_SECONDS);

    const devMode =
      (this.config.get<string>('OTP_DEV_MODE') ?? 'true').toLowerCase() !==
      'false';

    // SMS provider stub — in production, send via Twilio/WhatsApp here.
    console.log(`[OTP stub] phone=${phone} code=${otp}`);

    return {
      ok: true,
      phone,
      expiresInSeconds: OTP_TTL_SECONDS,
      ...(devMode ? { devOtp: otp } : {}),
    };
  }

  async verifyOtp(dto: VerifyOtpDto) {
    const phone = normalizePhone(dto.phone);
    const key = `otp:${phone}`;
    const stored = await this.redis.client.get(key);
    if (!stored || stored !== dto.otp) {
      throw new UnauthorizedException('Invalid or expired OTP');
    }
    await this.redis.client.del(key);

    let user = await this.prisma.user.findUnique({ where: { phone } });
    const isNewUser = !user;

    if (user?.deletedAt) {
      throw new UnauthorizedException('This account has been deleted');
    }

    if (!user) {
      const name = dto.displayName?.trim() || '';
      const split = splitDisplayName(name);
      user = await this.prisma.user.create({
        data: {
          phone,
          firstName: split.firstName,
          lastName: split.lastName,
          displayName: name,
        },
      });
    } else if (dto.displayName?.trim() && !user.firstName && !user.displayName) {
      const split = splitDisplayName(dto.displayName);
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          firstName: split.firstName,
          lastName: split.lastName,
          displayName: dto.displayName.trim(),
        },
      });
    }

    const accessToken = await this.jwt.signAsync({
      sub: user.id,
      phone: user.phone,
    });

    const memberships = await this.prisma.familyMembership.findMany({
      where: { userId: user.id, status: 'active' },
      include: { family: true },
      orderBy: { joinedAt: 'asc' },
    });

    return {
      accessToken,
      isNewUser,
      user: this.serializeUser(user),
      families: memberships.map((m) => ({
        id: m.family.id,
        name: m.family.name,
        avatarUrl: m.family.avatarUrl,
        inviteCode: m.family.inviteCode,
        role: m.role,
        settings: m.family.settings,
      })),
      needsProfile: !user.firstName && !user.displayName,
      needsFamily: memberships.length === 0,
    };
  }

  serializeUser(user: {
    id: string;
    phone: string;
    firstName?: string;
    lastName?: string;
    displayName: string;
    avatarUrl: string | null;
    status?: string;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: user.id,
      phone: user.phone,
      firstName: user.firstName ?? '',
      lastName: user.lastName ?? '',
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      status: user.status ?? '',
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
