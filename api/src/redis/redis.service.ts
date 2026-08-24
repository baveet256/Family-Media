import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { isProduction } from '../config/env.validation';

@Injectable()
export class RedisService implements OnModuleDestroy {
  readonly client: Redis;

  constructor(config: ConfigService) {
    const url = config.get<string>('REDIS_URL');
    if (!url && isProduction()) {
      // Silently falling back to an unauthenticated localhost Redis would put
      // OTP material on an unintended host.
      throw new Error('REDIS_URL is required in production');
    }
    this.client = new Redis(url ?? 'redis://localhost:6379', {
      maxRetriesPerRequest: 3,
      lazyConnect: false,
    });
  }

  async onModuleDestroy() {
    await this.client.quit();
  }
}
