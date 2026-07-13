import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuthService, DEV_OTP_CODE } from './auth.service';

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => {
    const store = new Map<string, string>();
    return {
      set: jest.fn(async (key: string, value: string) => {
        store.set(key, value);
        return 'OK';
      }),
      get: jest.fn(async (key: string) => store.get(key) ?? null),
      del: jest.fn(async (key: string) => {
        store.delete(key);
        return 1;
      }),
    };
  });
});

describe('AuthService', () => {
  const prisma = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  };

  const jwt = {
    signAsync: jest.fn().mockResolvedValue('test-token'),
  };

  const config = {
    get: jest.fn((key: string) => {
      if (key === 'REDIS_URL') return 'redis://localhost:6379';
      if (key === 'NODE_ENV') return 'development';
      return undefined;
    }),
  };

  let service: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AuthService(
      prisma as never,
      jwt as unknown as JwtService,
      config as unknown as ConfigService,
    );
  });

  it('normalizes phone numbers', () => {
    expect(service.normalizePhone('5551234567')).toBe('+5551234567');
    expect(service.normalizePhone('+1 (555) 123-4567')).toBe('+15551234567');
  });

  it('sends a fixed OTP in development', async () => {
    const result = await service.sendOtp('+15551234567');
    expect(result.ok).toBe(true);
    expect(result.debugCode).toBe(DEV_OTP_CODE);
  });

  it('creates a new user on first verify', async () => {
    await service.sendOtp('+15551234567');
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({
      id: 'u1',
      phone: '+15551234567',
      displayName: 'Ada',
      avatarUrl: null,
    });

    const result = await service.verifyOtp(
      '+15551234567',
      DEV_OTP_CODE,
      'Ada',
    );

    expect(result.isNewUser).toBe(true);
    expect(result.accessToken).toBe('test-token');
    expect(result.user.displayName).toBe('Ada');
  });

  it('rejects bad OTP', async () => {
    await service.sendOtp('+15551234567');
    await expect(
      service.verifyOtp('+15551234567', '000000'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
