import { PrismaService } from './prisma.service';
export declare class TaskReminderService {
    private readonly prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    handleDueTaskReminders(): Promise<void>;
    private buildTaskReminderBody;
    private sendPushNotificationToAllSubscribers;
    private ensureWebPushConfigured;
    private getValidatedWebPushConfig;
    private isValidBase64UrlValue;
}
