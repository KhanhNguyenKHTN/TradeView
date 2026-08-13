"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var TaskReminderService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaskReminderService = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const client_1 = require("@prisma/client");
const webpush = __importStar(require("web-push"));
const prisma_service_1 = require("./prisma.service");
let TaskReminderService = TaskReminderService_1 = class TaskReminderService {
    prisma;
    logger = new common_1.Logger(TaskReminderService_1.name);
    constructor(prisma) {
        this.prisma = prisma;
    }
    async handleDueTaskReminders() {
        const now = new Date();
        console.log('run job: ', now);
        const dueTasks = await this.prisma.task.findMany({
            where: {
                status: {
                    not: client_1.TaskStatus.DONE,
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
                this.logger.log(`Processed due reminder for task ${task.id}: sent=${sendResult.sent}, failed=${sendResult.failed}, total=${sendResult.total}`);
            }
            catch (error) {
                console.log('Error: ', error);
                this.logger.error(`Failed to process due reminder for task ${task.id}: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
    }
    buildTaskReminderBody(description, owner, category) {
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
    async sendPushNotificationToAllSubscribers(payload) {
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
        await Promise.all(subscriptions.map(async (subscription) => {
            try {
                await webpush.sendNotification({
                    endpoint: subscription.endpoint,
                    expirationTime: subscription.expirationTime
                        ? Number(subscription.expirationTime)
                        : null,
                    keys: {
                        p256dh: subscription.p256dh,
                        auth: subscription.auth,
                    },
                }, serializedPayload);
                sent += 1;
                await this.prisma.pushSubscription.update({
                    where: { id: subscription.id },
                    data: {
                        lastUsedAt: new Date(),
                        isActive: true,
                    },
                });
            }
            catch (error) {
                failed += 1;
                const statusCode = typeof error === 'object' &&
                    error !== null &&
                    'statusCode' in error &&
                    typeof error.statusCode === 'number'
                    ? error.statusCode
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
        }));
        return {
            sent,
            failed,
            total: subscriptions.length,
        };
    }
    ensureWebPushConfigured() {
        const { publicKey, privateKey, subject } = this.getValidatedWebPushConfig(true);
        webpush.setVapidDetails(subject, publicKey, privateKey);
    }
    getValidatedWebPushConfig(requirePrivateKey = false) {
        const publicKey = process.env.WEB_PUSH_PUBLIC_KEY?.trim();
        const privateKey = process.env.WEB_PUSH_PRIVATE_KEY?.trim();
        const subject = process.env.WEB_PUSH_SUBJECT?.trim() || 'mailto:admin@tradeview.local';
        if (!publicKey) {
            throw new common_1.BadRequestException('WEB_PUSH_PUBLIC_KEY chưa được cấu hình.');
        }
        if (!this.isValidBase64UrlValue(publicKey) || publicKey.length < 60) {
            throw new common_1.BadRequestException('WEB_PUSH_PUBLIC_KEY không hợp lệ. Giá trị phải là VAPID public key chuẩn base64url.');
        }
        if (requirePrivateKey) {
            if (!privateKey) {
                throw new common_1.BadRequestException('WEB_PUSH_PRIVATE_KEY chưa được cấu hình.');
            }
            if (!this.isValidBase64UrlValue(privateKey) || privateKey.length < 40) {
                throw new common_1.BadRequestException('WEB_PUSH_PRIVATE_KEY không hợp lệ. Giá trị phải là VAPID private key chuẩn base64url.');
            }
        }
        return {
            publicKey,
            privateKey: privateKey ?? '',
            subject,
        };
    }
    isValidBase64UrlValue(value) {
        return /^[A-Za-z0-9_-]+$/.test(value);
    }
};
exports.TaskReminderService = TaskReminderService;
__decorate([
    (0, schedule_1.Cron)('0 * * * * *'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], TaskReminderService.prototype, "handleDueTaskReminders", null);
exports.TaskReminderService = TaskReminderService = TaskReminderService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], TaskReminderService);
//# sourceMappingURL=task-reminder.service.js.map