import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { validateEnv } from './config/env.validation';
import { AuthModule } from './auth/auth.module';
import { CalendarModule } from './calendar/calendar.module';
import { ChatsModule } from './chats/chats.module';
import { ConnectionsModule } from './connections/connections.module';
import { AuditModule } from './audit/audit.module';
import { FamiliesModule } from './families/families.module';
import { GamesModule } from './games/games.module';
import { HealthModule } from './health/health.module';
import { JoinRequestsModule } from './join-requests/join-requests.module';
import { MediaModule } from './media/media.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PostsModule } from './posts/posts.module';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { StoriesModule } from './stories/stories.module';
import { TreeModule } from './tree/tree.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    // Baseline abuse protection for every route. Auth routes override the
    // 'default' bucket via @Throttle, so the name here must stay 'default'.
    ThrottlerModule.forRoot([
      { name: 'default', ttl: 60_000, limit: 120 },
      { name: 'burst', ttl: 1_000, limit: 20 },
    ]),
    PrismaModule,
    RedisModule,
    HealthModule,
    AuthModule,
    UsersModule,
    FamiliesModule,
    JoinRequestsModule,
    TreeModule,
    PostsModule,
    MediaModule,
    StoriesModule,
    ChatsModule,
    ConnectionsModule,
    GamesModule,
    CalendarModule,
    AuditModule,
    NotificationsModule,
  ],
  controllers: [AppController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
