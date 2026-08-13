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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FinanceController = void 0;
const common_1 = require("@nestjs/common");
const axios_1 = __importDefault(require("axios"));
const cheerio = __importStar(require("cheerio"));
const webpush = __importStar(require("web-push"));
const client_1 = require("@prisma/client");
const prisma_service_1 = require("./prisma.service");
let FinanceController = class FinanceController {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getCategories() {
        return this.prisma.assetCategory.findMany({
            where: { isEnabled: true },
            orderBy: { id: 'asc' },
        });
    }
    async getAssets() {
        const assets = await this.prisma.asset.findMany({
            where: {
                category: {
                    isEnabled: true,
                },
            },
            include: {
                category: true,
                transactions: {
                    orderBy: { executedAt: 'asc' },
                },
                priceSnapshots: {
                    orderBy: { capturedAt: 'desc' },
                    take: 1,
                },
            },
            orderBy: [{ categoryId: 'asc' }, { name: 'asc' }],
        });
        return assets.map((asset) => {
            const summary = this.calculateAssetSummary(asset);
            return {
                ...asset,
                summary,
            };
        });
    }
    async createAsset(body) {
        const category = await this.prisma.assetCategory.findUnique({
            where: { code: body.categoryCode },
        });
        if (!category) {
            throw new Error(`Category ${body.categoryCode} not found`);
        }
        if (!category.isEnabled) {
            throw new Error(`Category ${body.categoryCode} is disabled`);
        }
        return this.prisma.asset.create({
            data: {
                categoryId: category.id,
                symbol: body.symbol,
                name: body.name,
                unit: body.unit,
                notes: body.notes,
            },
            include: {
                category: true,
            },
        });
    }
    async getAssetDetail(id) {
        const asset = await this.prisma.asset.findUnique({
            where: { id },
            include: {
                category: true,
                transactions: {
                    orderBy: { executedAt: 'desc' },
                },
                priceSnapshots: {
                    orderBy: { capturedAt: 'desc' },
                },
            },
        });
        if (!asset) {
            throw new Error(`Asset ${id} not found`);
        }
        return {
            ...asset,
            summary: this.calculateAssetSummary(asset),
        };
    }
    async createTransaction(body) {
        return this.prisma.transaction.create({
            data: {
                assetId: body.assetId,
                type: body.type,
                quantity: new client_1.Prisma.Decimal(body.quantity),
                price: new client_1.Prisma.Decimal(body.price),
                fee: new client_1.Prisma.Decimal(body.fee ?? 0),
                executedAt: new Date(body.executedAt),
                settledAt: body.settledAt ? new Date(body.settledAt) : null,
                note: body.note,
            },
        });
    }
    async getTransactions() {
        return this.prisma.transaction.findMany({
            include: {
                asset: {
                    include: {
                        category: true,
                    },
                },
            },
            orderBy: { executedAt: 'desc' },
        });
    }
    async deleteTransaction(id) {
        return this.prisma.transaction.delete({
            where: { id },
        });
    }
    async createPrice(body) {
        return this.prisma.priceSnapshot.create({
            data: {
                assetId: body.assetId,
                price: new client_1.Prisma.Decimal(body.price),
                source: body.source ?? client_1.PriceSource.MANUAL,
                capturedAt: new Date(body.capturedAt),
            },
        });
    }
    async updateGoldPriceAutomatically(body) {
        const asset = await this.prisma.asset.findUnique({
            where: { id: body.assetId },
            include: { category: true },
        });
        if (!asset) {
            throw new Error(`Asset ${body.assetId} not found`);
        }
        if (asset.category.code !== client_1.AssetCategoryCode.GOLD) {
            throw new common_1.BadRequestException(`Asset ${body.assetId} is not a GOLD asset`);
        }
        const goldPrice = await this.getGoldPrice();
        const snapshot = await this.prisma.priceSnapshot.create({
            data: {
                assetId: asset.id,
                price: new client_1.Prisma.Decimal(goldPrice.buy),
                source: client_1.PriceSource.AUTO,
                capturedAt: body.capturedAt ? new Date(body.capturedAt) : new Date(),
            },
        });
        return {
            assetId: asset.id,
            assetName: asset.name,
            buy: goldPrice.buy,
            sell: goldPrice.sell,
            snapshot,
        };
    }
    async getLatestPrices() {
        const assets = await this.prisma.asset.findMany({
            where: {
                category: {
                    isEnabled: true,
                },
            },
            include: {
                category: true,
                priceSnapshots: {
                    orderBy: { capturedAt: 'desc' },
                    take: 1,
                },
            },
            orderBy: { id: 'asc' },
        });
        return assets.map((asset) => ({
            assetId: asset.id,
            symbol: asset.symbol,
            assetName: asset.name,
            category: asset.category,
            latestPrice: asset.priceSnapshots[0] ?? null,
        }));
    }
    async getTasks() {
        const tasks = await this.prisma.task.findMany({
            orderBy: [{ status: 'asc' }, { dueDate: 'asc' }, { id: 'desc' }],
        });
        return tasks.map((task) => this.serializeTask(task));
    }
    async getTaskSummary() {
        const tasks = await this.prisma.task.findMany();
        const inProgressTasks = tasks.filter((task) => task.status === client_1.TaskStatus.IN_PROGRESS).length;
        const completedTasks = tasks.filter((task) => task.status === client_1.TaskStatus.DONE).length;
        const financialTasks = tasks.filter((task) => task.isFinancialPlan);
        const now = new Date();
        const dueSoonTasks = tasks.filter((task) => {
            if (task.status === client_1.TaskStatus.DONE) {
                return false;
            }
            const diffTime = task.dueDate.getTime() - now.getTime();
            const diffDays = diffTime / (1000 * 60 * 60 * 24);
            return diffDays <= 7;
        }).length;
        const averageFinancialProgress = financialTasks.length > 0
            ? Math.round(financialTasks.reduce((sum, task) => sum + task.progress, 0) /
                financialTasks.length)
            : 0;
        return {
            totalTasks: tasks.length,
            inProgressTasks,
            dueSoonTasks,
            completedTasks,
            financialPlanningTasks: financialTasks.length,
            averageFinancialProgress,
        };
    }
    async createTask(body) {
        return this.serializeTask(await this.prisma.task.create({
            data: {
                title: body.title.trim(),
                description: body.description.trim(),
                note: body.note?.trim() || null,
                status: body.status ?? client_1.TaskStatus.TODO,
                priority: body.priority ?? client_1.TaskPriority.MEDIUM,
                dueDate: new Date(body.dueDate),
                owner: body.owner.trim(),
                category: body.category.trim(),
                isFinancialPlan: body.isFinancialPlan ?? false,
                financialTargetAmount: this.normalizeTaskAmount(body.isFinancialPlan ? body.financialTargetAmount ?? 0 : 0),
                financialCurrentAmount: this.normalizeTaskAmount(body.isFinancialPlan ? body.financialCurrentAmount ?? 0 : 0),
                progress: this.calculateTaskProgress(body.isFinancialPlan ?? false, body.financialTargetAmount ?? 0, body.financialCurrentAmount ?? 0, body.progress),
                dueReminderSentAt: null,
            },
        }));
    }
    async updateTask(id, body) {
        const existingTask = await this.prisma.task.findUnique({
            where: { id },
        });
        if (!existingTask) {
            throw new Error(`Task ${id} not found`);
        }
        const data = {};
        if (body.title !== undefined) {
            data.title = body.title.trim();
        }
        if (body.description !== undefined) {
            data.description = body.description.trim();
        }
        if (body.note !== undefined) {
            data.note = body.note.trim() || null;
        }
        if (body.status !== undefined) {
            data.status = body.status;
            if (existingTask.status === client_1.TaskStatus.DONE &&
                body.status !== client_1.TaskStatus.DONE) {
                data.dueReminderSentAt = null;
            }
        }
        if (body.priority !== undefined) {
            data.priority = body.priority;
        }
        if (body.dueDate !== undefined) {
            data.dueDate = new Date(body.dueDate);
            data.dueReminderSentAt = null;
        }
        if (body.owner !== undefined) {
            data.owner = body.owner.trim();
        }
        if (body.category !== undefined) {
            data.category = body.category.trim();
        }
        const nextIsFinancialPlan = body.isFinancialPlan ?? existingTask.isFinancialPlan;
        const nextFinancialTargetAmount = body.financialTargetAmount !== undefined
            ? body.financialTargetAmount
            : Number(existingTask.financialTargetAmount ?? 0);
        const nextFinancialCurrentAmount = body.financialCurrentAmount !== undefined
            ? body.financialCurrentAmount
            : Number(existingTask.financialCurrentAmount ?? 0);
        if (body.isFinancialPlan !== undefined) {
            data.isFinancialPlan = body.isFinancialPlan;
        }
        if (body.financialTargetAmount !== undefined || !nextIsFinancialPlan) {
            data.financialTargetAmount = this.normalizeTaskAmount(nextIsFinancialPlan ? nextFinancialTargetAmount : 0);
        }
        if (body.financialCurrentAmount !== undefined || !nextIsFinancialPlan) {
            data.financialCurrentAmount = this.normalizeTaskAmount(nextIsFinancialPlan ? nextFinancialCurrentAmount : 0);
        }
        if (body.progress !== undefined ||
            body.isFinancialPlan !== undefined ||
            body.financialTargetAmount !== undefined ||
            body.financialCurrentAmount !== undefined) {
            data.progress = this.calculateTaskProgress(nextIsFinancialPlan, nextFinancialTargetAmount, nextFinancialCurrentAmount, body.progress);
        }
        return this.serializeTask(await this.prisma.task.update({
            where: { id },
            data,
        }));
    }
    async deleteTask(id) {
        return this.prisma.task.delete({
            where: { id },
        });
    }
    async savePushSubscription(body) {
        this.ensureWebPushConfigured();
        if (!body.endpoint?.trim() || !body.keys?.p256dh?.trim() || !body.keys?.auth?.trim()) {
            throw new common_1.BadRequestException('Push subscription không hợp lệ.');
        }
        const endpoint = body.endpoint.trim();
        return this.prisma.pushSubscription.upsert({
            where: {
                endpoint,
            },
            update: {
                p256dh: body.keys.p256dh.trim(),
                auth: body.keys.auth.trim(),
                expirationTime: body.expirationTime === null || body.expirationTime === undefined
                    ? null
                    : BigInt(Math.trunc(body.expirationTime)),
                userAgent: body.userAgent?.trim() || null,
                platform: body.platform?.trim() || null,
                isActive: true,
                lastUsedAt: new Date(),
            },
            create: {
                endpoint,
                p256dh: body.keys.p256dh.trim(),
                auth: body.keys.auth.trim(),
                expirationTime: body.expirationTime === null || body.expirationTime === undefined
                    ? null
                    : BigInt(Math.trunc(body.expirationTime)),
                userAgent: body.userAgent?.trim() || null,
                platform: body.platform?.trim() || null,
                isActive: true,
                lastUsedAt: new Date(),
            },
        });
    }
    getPushPublicKey() {
        const { publicKey } = this.getValidatedWebPushConfig();
        return { publicKey };
    }
    async sendPushNotification(body) {
        this.ensureWebPushConfigured();
        const title = body.title?.trim();
        const messageBody = body.body?.trim();
        if (!title || !messageBody) {
            throw new common_1.BadRequestException('Tiêu đề và nội dung thông báo là bắt buộc.');
        }
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
        const payload = JSON.stringify({
            title,
            body: messageBody,
            url: body.url?.trim() || '/',
        });
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
                }, payload);
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
                    ? (error.statusCode)
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
    async getDashboard() {
        const assets = await this.prisma.asset.findMany({
            where: {
                category: {
                    isEnabled: true,
                },
            },
            include: {
                category: true,
                transactions: {
                    orderBy: { executedAt: 'asc' },
                },
                priceSnapshots: {
                    orderBy: { capturedAt: 'desc' },
                    take: 1,
                },
            },
            orderBy: [{ categoryId: 'asc' }, { name: 'asc' }],
        });
        const assetSummaries = assets.map((asset) => ({
            id: asset.id,
            symbol: asset.symbol,
            name: asset.name,
            unit: asset.unit,
            categoryCode: asset.category.code,
            categoryName: asset.category.name,
            ...this.calculateAssetSummary(asset),
        }));
        const totals = assetSummaries.reduce((acc, asset) => {
            acc.totalCost += asset.totalCost;
            acc.totalMarketValue += asset.marketValue;
            acc.totalProfitLoss += asset.profitLoss;
            return acc;
        }, {
            totalCost: 0,
            totalMarketValue: 0,
            totalProfitLoss: 0,
        });
        const enabledCategories = await this.prisma.assetCategory.findMany({
            where: { isEnabled: true },
            orderBy: { id: 'asc' },
        });
        const byCategory = enabledCategories.map((category) => {
            const items = assetSummaries.filter((asset) => asset.categoryCode === category.code);
            return {
                categoryCode: category.code,
                categoryName: category.name,
                totalCost: this.round(items.reduce((sum, item) => sum + item.totalCost, 0)),
                totalMarketValue: this.round(items.reduce((sum, item) => sum + item.marketValue, 0)),
                totalProfitLoss: this.round(items.reduce((sum, item) => sum + item.profitLoss, 0)),
            };
        });
        return {
            totals: {
                ...totals,
                totalCost: this.round(totals.totalCost),
                totalMarketValue: this.round(totals.totalMarketValue),
                totalProfitLoss: this.round(totals.totalProfitLoss),
            },
            byCategory,
            assets: assetSummaries,
        };
    }
    async getGoldPrice() {
        let html;
        try {
            const response = await axios_1.default.get('https://hoakimnguyen.com/tra-cuu-gia-vang/', {
                timeout: 10_000,
                responseType: 'text',
            });
            html = response.data;
        }
        catch (error) {
            throw new Error(`Failed to request gold price page: ${error instanceof Error ? error.message : String(error)}`);
        }
        const $ = cheerio.load(html);
        let buyText = '';
        let sellText = '';
        $('tr').each((_, row) => {
            const cells = $(row)
                .find('td')
                .map((__, cell) => $(cell).text().replace(/\s+/g, ' ').trim())
                .get();
            if (cells.length < 3) {
                return;
            }
            if (cells[0] === 'Vàng nhẫn khâu 9999') {
                buyText = cells[1];
                sellText = cells[2];
            }
        });
        if (!buyText || !sellText) {
            throw new Error('Gold product "Vàng nhẫn khâu 9999" not found');
        }
        const buy = this.parseGoldPriceValue(buyText);
        const sell = this.parseGoldPriceValue(sellText);
        return { buy, sell };
    }
    parseGoldPriceValue(value) {
        const normalizedValue = value.replace(/\./g, '').replace(/,/g, '').trim();
        const parsedValue = Number(normalizedValue);
        if (!normalizedValue || Number.isNaN(parsedValue)) {
            throw new Error(`Failed to parse gold price value: ${value}`);
        }
        return parsedValue * 1000;
    }
    normalizeTaskProgress(value) {
        return Math.min(100, Math.max(0, Math.round(value)));
    }
    normalizeTaskAmount(value) {
        if (!Number.isFinite(value) || Number.isNaN(value)) {
            return 0;
        }
        return Math.max(0, Math.round(value * 100) / 100);
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
    calculateTaskProgress(isFinancialPlan, financialTargetAmount, financialCurrentAmount, manualProgress) {
        if (!isFinancialPlan) {
            return 0;
        }
        const normalizedTarget = this.normalizeTaskAmount(financialTargetAmount);
        const normalizedCurrent = this.normalizeTaskAmount(financialCurrentAmount);
        if (normalizedTarget > 0) {
            return this.normalizeTaskProgress((normalizedCurrent / normalizedTarget) * 100);
        }
        return this.normalizeTaskProgress(manualProgress ?? 0);
    }
    serializeTask(task) {
        return {
            ...task,
            note: task.note ?? '',
            dueDate: task.dueDate.toISOString(),
            financialTargetAmount: Number(task.financialTargetAmount ?? 0),
            financialCurrentAmount: Number(task.financialCurrentAmount ?? 0),
        };
    }
    calculateAssetSummary(asset) {
        let holdingQuantity = 0;
        let totalCost = 0;
        for (const transaction of asset.transactions) {
            const quantity = Number(transaction.quantity);
            const price = Number(transaction.price);
            const fee = Number(transaction.fee);
            if (transaction.type === client_1.TransactionType.BUY) {
                holdingQuantity += quantity;
                totalCost += quantity * price + fee;
            }
            else {
                const averageCost = holdingQuantity > 0 ? totalCost / holdingQuantity : 0;
                holdingQuantity -= quantity;
                totalCost -= averageCost * quantity;
                totalCost -= fee;
            }
        }
        const assetCategoryCode = typeof asset.category === 'object' &&
            asset.category !== null &&
            'code' in asset.category
            ? asset.category.code
            : null;
        if (assetCategoryCode === client_1.AssetCategoryCode.SAVING) {
            return this.calculateSavingSummary(asset);
        }
        const latestPrice = asset.priceSnapshots[0]
            ? Number(asset.priceSnapshots[0].price)
            : 0;
        const marketValue = holdingQuantity * latestPrice;
        const profitLoss = marketValue - totalCost;
        return {
            holdingQuantity: this.round(holdingQuantity),
            totalCost: this.round(totalCost),
            latestPrice: this.round(latestPrice),
            marketValue: this.round(marketValue),
            profitLoss: this.round(profitLoss),
        };
    }
    calculateSavingSummary(asset) {
        let principal = 0;
        let accruedInterest = 0;
        let currentRate = 0;
        for (const transaction of asset.transactions) {
            const depositAmount = Number(transaction.quantity);
            const annualRatePercent = Number(transaction.price);
            const fee = Number(transaction.fee);
            const startDate = new Date(transaction.executedAt);
            const endDate = transaction.settledAt
                ? new Date(transaction.settledAt)
                : new Date();
            const effectiveEndDate = endDate.getTime() > startDate.getTime() ? endDate : startDate;
            const holdingDays = Math.max(0, Math.floor((effectiveEndDate.getTime() - startDate.getTime()) /
                (1000 * 60 * 60 * 24)));
            const interest = depositAmount * (annualRatePercent / 100) * (holdingDays / 365);
            if (transaction.type === client_1.TransactionType.BUY) {
                principal += depositAmount;
                accruedInterest += interest;
                currentRate = annualRatePercent;
                principal -= fee;
            }
            else {
                principal -= depositAmount;
                accruedInterest -= interest;
                principal -= fee;
            }
        }
        const totalCost = principal;
        const marketValue = principal + accruedInterest;
        const profitLoss = accruedInterest;
        return {
            holdingQuantity: this.round(principal),
            totalCost: this.round(totalCost),
            latestPrice: this.round(currentRate),
            marketValue: this.round(marketValue),
            profitLoss: this.round(profitLoss),
        };
    }
    round(value) {
        return Math.round(value * 100) / 100;
    }
};
exports.FinanceController = FinanceController;
__decorate([
    (0, common_1.Get)('categories'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], FinanceController.prototype, "getCategories", null);
__decorate([
    (0, common_1.Get)('assets'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], FinanceController.prototype, "getAssets", null);
__decorate([
    (0, common_1.Post)('assets'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], FinanceController.prototype, "createAsset", null);
__decorate([
    (0, common_1.Get)('assets/:id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], FinanceController.prototype, "getAssetDetail", null);
__decorate([
    (0, common_1.Post)('transactions'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], FinanceController.prototype, "createTransaction", null);
__decorate([
    (0, common_1.Get)('transactions'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], FinanceController.prototype, "getTransactions", null);
__decorate([
    (0, common_1.Delete)('transactions/:id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], FinanceController.prototype, "deleteTransaction", null);
__decorate([
    (0, common_1.Post)('prices'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], FinanceController.prototype, "createPrice", null);
__decorate([
    (0, common_1.Post)('prices/auto/gold'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], FinanceController.prototype, "updateGoldPriceAutomatically", null);
__decorate([
    (0, common_1.Get)('prices/latest'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], FinanceController.prototype, "getLatestPrices", null);
__decorate([
    (0, common_1.Get)('tasks'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], FinanceController.prototype, "getTasks", null);
__decorate([
    (0, common_1.Get)('tasks/summary'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], FinanceController.prototype, "getTaskSummary", null);
__decorate([
    (0, common_1.Post)('tasks'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], FinanceController.prototype, "createTask", null);
__decorate([
    (0, common_1.Patch)('tasks/:id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", Promise)
], FinanceController.prototype, "updateTask", null);
__decorate([
    (0, common_1.Delete)('tasks/:id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], FinanceController.prototype, "deleteTask", null);
__decorate([
    (0, common_1.Post)('push-subscriptions'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], FinanceController.prototype, "savePushSubscription", null);
__decorate([
    (0, common_1.Get)('push-public-key'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], FinanceController.prototype, "getPushPublicKey", null);
__decorate([
    (0, common_1.Post)('push-notifications/send'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], FinanceController.prototype, "sendPushNotification", null);
__decorate([
    (0, common_1.Get)('dashboard'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], FinanceController.prototype, "getDashboard", null);
exports.FinanceController = FinanceController = __decorate([
    (0, common_1.Controller)('api'),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], FinanceController);
//# sourceMappingURL=finance.controller.js.map