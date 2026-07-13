import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import Redis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';

const OTP_TTL_SECONDS = 10 * 60;
/** Fixed OTP in development — no SMS required */
export const DEV_OTP_CODE = '123456';

export type AuthUser = {
  id: string;
  phone: string;
  displayName: string;
  avatarUrl: string | null;
};

@Injectable()
export class AuthService {
  private readonly redis: Redis;
  private readonly isDev: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {
    this.redis = new Redis(
      this.config.get<string>('REDIS_URL') ?? 'redis://localhost:6379',
      { maxRetriesPerRequest: 2, lazyConnect: false },
    );
    this.isDev = this.config.get<string>('NODE_ENV') !== 'production';
  }

  normalizePhone(phone: string): string {
    const trimmed = phone.trim().replace(/[\s()-]/g, '');
    if (!trimmed.startsWith('+') && /^\d+$/.test(trimmed)) {
      return `+${trimmed}`;
    }
    return trimmed;
  }

  private otpKey(phone: string): string {
    return `otp:${phone}`;
  }

  async sendOtp(rawPhone: string): Promise<{ ok: true; expiresIn: number; debugCode?: string }> {
    const phone = this.normalizePhone(rawPhone);
    const code = this.isDev ? DEV_OTP_CODE : String(Math.floor(100000 + Math.random() * 900000));

    await this.redis.set(this.otpKey(phone), code, 'EX', OTP_TTL_SECONDS);

    if (this.isDev) {
      console.log(`[auth] OTP for ${phone}: ${code} (dev stub — no SMS)`);
      return { ok: true, expiresIn: OTP_TTL_SECONDS, debugCode: code };
    }

    // Production: plug in Twilio / SNS here
    return { ok: true, expiresIn: OTP_TTL_SECONDS };
  }

  async verifyOtp(
    rawPhone: string,
    code: string,
    displayName?: string,
  ): Promise<{ accessToken: string; user: AuthUser; isNewUser: boolean }> {
    const phone = this.normalizePhone(rawPhone);
    const stored = await this.redis.get(this.otpKey(phone));

    if (!stored || stored !== code.trim()) {
      throw new UnauthorizedException('Invalid or expired OTP');
    }

    await this.redis.del(this.otpKey(phone));

    let user = await this.prisma.user.findUnique({ where: { phone } });
    let isNewUser = false;

    if (!user) {
      const name = displayName?.trim();
      if (!name) {
        throw new BadRequestException(
          'displayName is required for first-time signup',
        );
      }
      user = await this.prisma.user.create({
        data: {
          phone,
          displayName: name,
        },
      });
      isNewUser = true;
    }

    const accessToken = await this.jwt.signAsync({
      sub: user.id,
      phone: user.phone,
    });

    return {
      accessToken,
      isNewUser,
      user: {
        id: user.id,
        phone: user.phone,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
      },
    };
  }

  async validateUserById(userId: string): Promise<AuthUser | null> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return null;
    return {
      id: user.id,
      phone: user.phone,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
    };
  }
}
