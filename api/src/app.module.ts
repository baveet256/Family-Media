import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
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
    ConfigModule.forRoot({ isGlobal: true }),
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
})
export class AppModule {}
