import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { TaskStatus } from '@prisma/client';
import * as webpush from 'web-push';
import { PrismaService } from './prisma.service';

@Injectable()
export class TaskReminderService {
  private readonly logger = new Logger(TaskReminderService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron('0 * * * * *')
  async handleDueTaskReminders() {
    const now = new Date();
    console.log('run job: ', now);

    const dueTasks = await this.prisma.task.findMany({
      where: {
        status: {
          not: TaskStatus.DONE,
        },
        dueReminderSentAt: null,
        dueDate: {
          lte: now,
        },
      },
      orderBy: [
        { dueDate: 'asc' },
        { id: 'asc' },
      ],
      take: 20,
    });

    if (dueTasks.length === 0) {
      return;
    }
    console.log('Due task: ', dueTasks);
    for (const task of dueTasks) {
      try {
        const sendResult = await this.sendPushNotificationToAllSubscribers({
          title: `Task đến hạn: ${task.title}`,
          body: this.buildTaskReminderBody(task.description, task.owner, task.category),
          url: '/',
        });

        if (sendResult.sent > 0) {
          await this.prisma.task.update({
            where: { id: task.id },
            data: {
              dueReminderSentAt: now,
            },
          });
        }

        console.log('Send result: ', sendResult);
        this.logger.log(
          `Processed due reminder for task ${task.id}: sent=${sendResult.sent}, failed=${sendResult.failed}, total=${sendResult.total}`,
        );
      } catch (error) {
        console.log('Error: ', error);
        this.logger.error(
          `Failed to process due reminder for task ${task.id}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
  }

  private buildTaskReminderBody(
    description: string,
    owner: string,
    category: string,
  ) {
    const parts = [
      owner ? `Owner: ${owner}` : '',
      category ? `Category: ${category}` : '',
      description?.trim() || '',
    ].filter(Boolean);

    const message = parts.join(' • ');

    if (message.length <= 180) {
      return message;
    }

    return `${message.slice(0, 177)}...`;
  }

  private async sendPushNotificationToAllSubscribers(payload: {
    title: string;
    body: string;
    url: string;
  }) {
    this.ensureWebPushConfigured();

    const subscriptions = await this.prisma.pushSubscription.findMany({
      where: {
        isActive: true,
      },
      orderBy: { id: 'asc' },
    });

    if (subscriptions.length === 0) {
      return {
        sent: 0,
        failed: 0,
        total: 0,
      };
    }

    const serializedPayload = JSON.stringify(payload);

    let sent = 0;
    let failed = 0;

    await Promise.all(
      subscriptions.map(async (subscription) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: subscription.endpoint,
              expirationTime: subscription.expirationTime
                ? Number(subscription.expirationTime)
                : null,
              keys: {
                p256dh: subscription.p256dh,
                auth: subscription.auth,
              },
            },
            serializedPayload,
          );

          sent += 1;

          await this.prisma.pushSubscription.update({
            where: { id: subscription.id },
            data: {
              lastUsedAt: new Date(),
              isActive: true,
            },
          });
        } catch (error) {
          failed += 1;

          const statusCode =
            typeof error === 'object' &&
            error !== null &&
            'statusCode' in error &&
            typeof (error as { statusCode?: unknown }).statusCode === 'number'
              ? (error as { statusCode: number }).statusCode
              : null;

          if (statusCode === 404 || statusCode === 410) {
            await this.prisma.pushSubscription.update({
              where: { id: subscription.id },
              data: {
                isActive: false,
              },
            });
          }
        }
      }),
    );

    return {
      sent,
      failed,
      total: subscriptions.length,
    };
  }

  private ensureWebPushConfigured() {
    const { publicKey, privateKey, subject } = this.getValidatedWebPushConfig(true);

    webpush.setVapidDetails(subject, publicKey, privateKey);
  }

  private getValidatedWebPushConfig(requirePrivateKey = false) {
    const publicKey = process.env.WEB_PUSH_PUBLIC_KEY?.trim();
    const privateKey = process.env.WEB_PUSH_PRIVATE_KEY?.trim();
    const subject =
      process.env.WEB_PUSH_SUBJECT?.trim() || 'mailto:admin@tradeview.local';

    if (!publicKey) {
      throw new BadRequestException('WEB_PUSH_PUBLIC_KEY chưa được cấu hình.');
    }

    if (!this.isValidBase64UrlValue(publicKey) || publicKey.length < 60) {
      throw new BadRequestException(
        'WEB_PUSH_PUBLIC_KEY không hợp lệ. Giá trị phải là VAPID public key chuẩn base64url.',
      );
    }

    if (requirePrivateKey) {
      if (!privateKey) {
        throw new BadRequestException('WEB_PUSH_PRIVATE_KEY chưa được cấu hình.');
      }

      if (!this.isValidBase64UrlValue(privateKey) || privateKey.length < 40) {
        throw new BadRequestException(
          'WEB_PUSH_PRIVATE_KEY không hợp lệ. Giá trị phải là VAPID private key chuẩn base64url.',
        );
      }
    }

    return {
      publicKey,
      privateKey: privateKey ?? '',
      subject,
    };
  }

  private isValidBase64UrlValue(value: string) {
    return /^[A-Za-z0-9_-]+$/.test(value);
  }
}