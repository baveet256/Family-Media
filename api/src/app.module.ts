import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { FamiliesModule } from './families/families.module';
import { HealthModule } from './health/health.module';
import { JoinRequestsModule } from './join-requests/join-requests.module';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    RedisModule,
    HealthModule,
    AuthModule,
    UsersModule,
    FamiliesModule,
    JoinRequestsModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
