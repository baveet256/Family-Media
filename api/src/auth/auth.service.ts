import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHmac, randomInt, timingSafeEqual } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { SendOtpDto, VerifyOtpDto } from './dto/otp.dto';
import { splitDisplayName } from '../common/names';
import { isProduction, resolveJwtSecret } from '../config/env.validation';

const OTP_TTL_SECONDS = 300;
/** Attempts allowed per issued code before it is burned. */
const OTP_MAX_ATTEMPTS = 5;
/** Minimum gap between sends for the same phone, to limit SMS abuse. */
const OTP_RESEND_COOLDOWN_SECONDS = 60;

function normalizePhone(phone: string): string {
  const trimmed = phone.trim();
  if (trimmed.startsWith('+')) {
    return `+${trimmed.slice(1).replace(/\D/g, '')}`;
  }
  return trimmed.replace(/\D/g, '');
}

function safeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger('Auth');

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Codes are stored as a keyed digest so a Redis dump or backup does not
   * hand over usable one-time passwords.
   */
  private hashOtp(phone: string, otp: string): string {
    const pepper = resolveJwtSecret(this.config.get<string>('JWT_SECRET'));
    return createHmac('sha256', pepper).update(`${phone}:${otp}`).digest('hex');
  }

  /** Dev echo of the OTP is only ever possible outside production. */
  private isOtpDevMode(): boolean {
    if (isProduction()) return false;
    return (
      (this.config.get<string>('OTP_DEV_MODE') ?? 'false').toLowerCase() ===
      'true'
    );
  }

  async sendOtp(dto: SendOtpDto) {
    const phone = normalizePhone(dto.phone);
    if (phone.replace(/\D/g, '').length < 8) {
      throw new BadRequestException('Invalid phone number');
    }

    const cooldownKey = `otp:cooldown:${phone}`;
    const fresh = await this.redis.client.set(
      cooldownKey,
      '1',
      'EX',
      OTP_RESEND_COOLDOWN_SECONDS,
      'NX',
    );
    if (fresh === null) {
      const retryIn = await this.redis.client.ttl(cooldownKey);
      throw new HttpException(
        `Please wait ${retryIn > 0 ? retryIn : OTP_RESEND_COOLDOWN_SECONDS}s before requesting another code`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const otp = String(randomInt(100000, 1000000));
    await this.redis.client.set(
      `otp:${phone}`,
      this.hashOtp(phone, otp),
      'EX',
      OTP_TTL_SECONDS,
    );
    await this.redis.client.del(`otp:attempts:${phone}`);

    const devMode = this.isOtpDevMode();

    // SMS provider stub — in production, send via Twilio/WhatsApp here.
    if (devMode) {
      this.logger.debug(`[OTP stub] phone=${phone} code=${otp}`);
    } else {
      this.logger.log('OTP issued');
    }

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
    const attemptsKey = `otp:attempts:${phone}`;

    const stored = await this.redis.client.get(key);
    if (!stored) {
      throw new UnauthorizedException('Invalid or expired OTP');
    }

    const attempts = await this.redis.client.incr(attemptsKey);
    if (attempts === 1) {
      await this.redis.client.expire(attemptsKey, OTP_TTL_SECONDS);
    }
    if (attempts > OTP_MAX_ATTEMPTS) {
      // Burn the code so an attacker cannot keep guessing within the TTL.
      await this.redis.client.del(key);
      throw new HttpException(
        'Too many incorrect attempts. Request a new code.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (!safeEquals(stored, this.hashOtp(phone, dto.otp))) {
      throw new UnauthorizedException('Invalid or expired OTP');
    }
    await this.redis.client.del(key, attemptsKey);

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
