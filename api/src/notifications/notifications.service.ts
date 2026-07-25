import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type NotifyInput = {
  userId: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
};

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async notify(input: NotifyInput) {
    const notification = await this.prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        dataJson: (input.data ?? {}) as Prisma.InputJsonValue,
      },
    });

    // Best-effort Expo push
    const devices = await this.prisma.deviceToken.findMany({
      where: { userId: input.userId },
    });
    if (devices.length) {
      await this.sendExpoPush(
        devices.map((d) => d.token),
        input.title,
        input.body,
        { ...(input.data ?? {}), notificationId: notification.id, type: input.type },
      );
    }

    return notification;
  }

  async notifyMany(userIds: string[], input: Omit<NotifyInput, 'userId'>) {
    const unique = [...new Set(userIds)];
    await Promise.all(
      unique.map((userId) => this.notify({ ...input, userId })),
    );
  }

  async list(userId: string, opts: { unreadOnly?: boolean; limit?: number } = {}) {
    const limit = Math.min(Math.max(opts.limit ?? 40, 1), 100);
    const rows = await this.prisma.notification.findMany({
      where: {
        userId,
        ...(opts.unreadOnly ? { readAt: null } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    const unreadCount = await this.prisma.notification.count({
      where: { userId, readAt: null },
    });
    return {
      notifications: rows.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        body: n.body,
        data: n.dataJson,
        readAt: n.readAt,
        createdAt: n.createdAt,
      })),
      unreadCount,
    };
  }

  async markRead(userId: string, notificationId: string) {
    await this.prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { readAt: new Date() },
    });
    return { ok: true };
  }

  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { ok: true };
  }

  async registerDevice(userId: string, token: string, platform?: string) {
    const cleaned = token.trim();
    return this.prisma.deviceToken.upsert({
      where: { token: cleaned },
      create: {
        userId,
        token: cleaned,
        platform: platform || 'unknown',
      },
      update: {
        userId,
        platform: platform || 'unknown',
      },
    });
  }

  async removeDevice(userId: string, token: string) {
    await this.prisma.deviceToken.deleteMany({
      where: { userId, token: token.trim() },
    });
    return { ok: true };
  }

  private async sendExpoPush(
    tokens: string[],
    title: string,
    body: string,
    data: Record<string, unknown>,
  ) {
    const messages = tokens
      .filter((t) => t.startsWith('ExponentPushToken') || t.startsWith('ExpoPushToken'))
      .map((to) => ({
        to,
        sound: 'default',
        title,
        body,
        data,
      }));
    if (!messages.length) return;

    try {
      const res = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messages),
      });
      if (!res.ok) {
        this.logger.warn(`Expo push failed: ${res.status}`);
      }
    } catch (e) {
      this.logger.warn(`Expo push error: ${e instanceof Error ? e.message : e}`);
    }
  }
}
