import { Injectable, Logger } from '@nestjs/common';
import {
  HealthCheckError,
  HealthIndicator,
  HealthIndicatorResult,
} from '@nestjs/terminus';
import { PrismaService } from '../prisma/prisma.service';
import Redis from 'ioredis';
import { isProduction } from '../config/env.validation';

const healthLogger = new Logger('Health');

/**
 * /health is unauthenticated, so infrastructure error text (hostnames, driver
 * details) is logged rather than returned to the caller in production.
 */
function healthDetail(scope: string, error: unknown): { message: string } {
  const message = error instanceof Error ? error.message : String(error);
  healthLogger.error(`${scope}: ${message}`);
  return { message: isProduction() ? 'unavailable' : message };
}

@Injectable()
export class DatabaseHealthIndicator extends HealthIndicator {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return this.getStatus(key, true);
    } catch (error) {
      throw new HealthCheckError(
        'Database check failed',
        this.getStatus(key, false, healthDetail('Database check failed', error)),
      );
    }
  }
}

@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
  private readonly redis: Redis;

  constructor() {
    super();
    this.redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      await this.redis.connect();
      const pong = await this.redis.ping();
      await this.redis.quit();
      const isHealthy = pong === 'PONG';
      if (!isHealthy) {
        throw new Error('Redis ping failed');
      }
      return this.getStatus(key, true);
    } catch (error) {
      try {
        await this.redis.quit();
      } catch {
        // ignore cleanup errors
      }
      throw new HealthCheckError(
        'Redis check failed',
        this.getStatus(key, false, healthDetail('Redis check failed', error)),
      );
    }
  }
}
