import { AssetCategoryCode, PriceSource, Prisma, TaskPriority, TaskStatus, TransactionType } from '@prisma/client';
import { PrismaService } from './prisma.service';
type CreateAssetDto = {
    categoryCode: AssetCategoryCode;
    symbol: string;
    name: string;
    unit: string;
    notes?: string;
};
type CreateTransactionDto = {
    assetId: number;
    type: TransactionType;
    quantity: number;
    price: number;
    fee?: number;
    executedAt: string;
    settledAt?: string;
    note?: string;
};
type CreatePriceDto = {
    assetId: number;
    price: number;
    source?: PriceSource;
    capturedAt: string;
};
type CreateTaskDto = {
    title: string;
    description: string;
    note?: string;
    status?: TaskStatus;
    priority?: TaskPriority;
    dueDate: string;
    owner: string;
    category: string;
    isFinancialPlan?: boolean;
    financialTargetAmount?: number;
    financialCurrentAmount?: number;
    progress?: number;
};
type UpdateTaskDto = Partial<CreateTaskDto>;
type PushSubscriptionDto = {
    endpoint: string;
    expirationTime?: number | null;
    keys: {
        p256dh: string;
        auth: string;
    };
    userAgent?: string;
    platform?: string;
};
type SendPushNotificationDto = {
    title: string;
    body: string;
    url?: string;
};
export declare class FinanceController {
    private readonly prisma;
    constructor(prisma: PrismaService);
    getCategories(): Promise<{
        id: number;
        code: import(".prisma/client").$Enums.AssetCategoryCode;
        name: string;
        isEnabled: boolean;
        createdAt: Date;
        updatedAt: Date;
    }[]>;
    getAssets(): Promise<{
        summary: {
            holdingQuantity: number;
            totalCost: number;
            latestPrice: number;
            marketValue: number;
            profitLoss: number;
        };
        category: {
            id: number;
            code: import(".prisma/client").$Enums.AssetCategoryCode;
            name: string;
            isEnabled: boolean;
            createdAt: Date;
            updatedAt: Date;
        };
        transactions: {
            id: number;
            createdAt: Date;
            updatedAt: Date;
            executedAt: Date;
            assetId: number;
            type: import(".prisma/client").$Enums.TransactionType;
            quantity: Prisma.Decimal;
            price: Prisma.Decimal;
            fee: Prisma.Decimal;
            settledAt: Date | null;
            note: string | null;
        }[];
        priceSnapshots: {
            id: number;
            createdAt: Date;
            capturedAt: Date;
            assetId: number;
            price: Prisma.Decimal;
            source: import(".prisma/client").$Enums.PriceSource;
        }[];
        symbol: string;
        id: number;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        categoryId: number;
        unit: string;
        notes: string | null;
    }[]>;
    createAsset(body: CreateAssetDto): Promise<{
        category: {
            id: number;
            code: import(".prisma/client").$Enums.AssetCategoryCode;
            name: string;
            isEnabled: boolean;
            createdAt: Date;
            updatedAt: Date;
        };
    } & {
        symbol: string;
        id: number;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        categoryId: number;
        unit: string;
        notes: string | null;
    }>;
    getAssetDetail(id: number): Promise<{
        summary: {
            holdingQuantity: number;
            totalCost: number;
            latestPrice: number;
            marketValue: number;
            profitLoss: number;
        };
        category: {
            id: number;
            code: import(".prisma/client").$Enums.AssetCategoryCode;
            name: string;
            isEnabled: boolean;
            createdAt: Date;
            updatedAt: Date;
        };
        transactions: {
            id: number;
            createdAt: Date;
            updatedAt: Date;
            executedAt: Date;
            assetId: number;
            type: import(".prisma/client").$Enums.TransactionType;
            quantity: Prisma.Decimal;
            price: Prisma.Decimal;
            fee: Prisma.Decimal;
            settledAt: Date | null;
            note: string | null;
        }[];
        priceSnapshots: {
            id: number;
            createdAt: Date;
            capturedAt: Date;
            assetId: number;
            price: Prisma.Decimal;
            source: import(".prisma/client").$Enums.PriceSource;
        }[];
        symbol: string;
        id: number;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        categoryId: number;
        unit: string;
        notes: string | null;
    }>;
    createTransaction(body: CreateTransactionDto): Promise<{
        id: number;
        createdAt: Date;
        updatedAt: Date;
        executedAt: Date;
        assetId: number;
        type: import(".prisma/client").$Enums.TransactionType;
        quantity: Prisma.Decimal;
        price: Prisma.Decimal;
        fee: Prisma.Decimal;
        settledAt: Date | null;
        note: string | null;
    }>;
    getTransactions(): Promise<({
        asset: {
            category: {
                id: number;
                code: import(".prisma/client").$Enums.AssetCategoryCode;
                name: string;
                isEnabled: boolean;
                createdAt: Date;
                updatedAt: Date;
            };
        } & {
            symbol: string;
            id: number;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            categoryId: number;
            unit: string;
            notes: string | null;
        };
    } & {
        id: number;
        createdAt: Date;
        updatedAt: Date;
        executedAt: Date;
        assetId: number;
        type: import(".prisma/client").$Enums.TransactionType;
        quantity: Prisma.Decimal;
        price: Prisma.Decimal;
        fee: Prisma.Decimal;
        settledAt: Date | null;
        note: string | null;
    })[]>;
    deleteTransaction(id: number): Promise<{
        id: number;
        createdAt: Date;
        updatedAt: Date;
        executedAt: Date;
        assetId: number;
        type: import(".prisma/client").$Enums.TransactionType;
        quantity: Prisma.Decimal;
        price: Prisma.Decimal;
        fee: Prisma.Decimal;
        settledAt: Date | null;
        note: string | null;
    }>;
    createPrice(body: CreatePriceDto): Promise<{
        id: number;
        createdAt: Date;
        capturedAt: Date;
        assetId: number;
        price: Prisma.Decimal;
        source: import(".prisma/client").$Enums.PriceSource;
    }>;
    updateGoldPriceAutomatically(body: {
        assetId: number;
        capturedAt?: string;
    }): Promise<{
        assetId: number;
        assetName: string;
        buy: number;
        sell: number;
        snapshot: {
            id: number;
            createdAt: Date;
            capturedAt: Date;
            assetId: number;
            price: Prisma.Decimal;
            source: import(".prisma/client").$Enums.PriceSource;
        };
    }>;
    getLatestPrices(): Promise<{
        assetId: number;
        symbol: string;
        assetName: string;
        category: {
            id: number;
            code: import(".prisma/client").$Enums.AssetCategoryCode;
            name: string;
            isEnabled: boolean;
            createdAt: Date;
            updatedAt: Date;
        };
        latestPrice: {
            id: number;
            createdAt: Date;
            capturedAt: Date;
            assetId: number;
            price: Prisma.Decimal;
            source: import(".prisma/client").$Enums.PriceSource;
        };
    }[]>;
    getTasks(): Promise<{
        note: string;
        dueDate: string;
        financialTargetAmount: number;
        financialCurrentAmount: number;
        id: number;
        title: string;
        description: string;
        status: TaskStatus;
        priority: TaskPriority;
        owner: string;
        category: string;
        isFinancialPlan: boolean;
        progress: number;
        createdAt: Date;
        updatedAt: Date;
    }[]>;
    getTaskSummary(): Promise<{
        totalTasks: number;
        inProgressTasks: number;
        dueSoonTasks: number;
        completedTasks: number;
        financialPlanningTasks: number;
        averageFinancialProgress: number;
    }>;
    createTask(body: CreateTaskDto): Promise<{
        note: string;
        dueDate: string;
        financialTargetAmount: number;
        financialCurrentAmount: number;
        id: number;
        title: string;
        description: string;
        status: TaskStatus;
        priority: TaskPriority;
        owner: string;
        category: string;
        isFinancialPlan: boolean;
        progress: number;
        createdAt: Date;
        updatedAt: Date;
    }>;
    updateTask(id: number, body: UpdateTaskDto): Promise<{
        note: string;
        dueDate: string;
        financialTargetAmount: number;
        financialCurrentAmount: number;
        id: number;
        title: string;
        description: string;
        status: TaskStatus;
        priority: TaskPriority;
        owner: string;
        category: string;
        isFinancialPlan: boolean;
        progress: number;
        createdAt: Date;
        updatedAt: Date;
    }>;
    deleteTask(id: number): Promise<{
        id: number;
        createdAt: Date;
        updatedAt: Date;
        category: string;
        note: string | null;
        title: string;
        description: string;
        status: import(".prisma/client").$Enums.TaskStatus;
        priority: import(".prisma/client").$Enums.TaskPriority;
        dueDate: Date;
        owner: string;
        isFinancialPlan: boolean;
        financialTargetAmount: Prisma.Decimal;
        financialCurrentAmount: Prisma.Decimal;
        progress: number;
        dueReminderSentAt: Date | null;
    }>;
    savePushSubscription(body: PushSubscriptionDto): Promise<{
        id: number;
        createdAt: Date;
        updatedAt: Date;
        endpoint: string;
        p256dh: string;
        auth: string;
        expirationTime: bigint | null;
        userAgent: string | null;
        platform: string | null;
        isActive: boolean;
        lastUsedAt: Date | null;
    }>;
    getPushPublicKey(): {
        publicKey: string;
    };
    sendPushNotification(body: SendPushNotificationDto): Promise<{
        sent: number;
        failed: number;
        total: number;
    }>;
    getDashboard(): Promise<{
        totals: {
            totalCost: number;
            totalMarketValue: number;
            totalProfitLoss: number;
        };
        byCategory: {
            categoryCode: import(".prisma/client").$Enums.AssetCategoryCode;
            categoryName: string;
            totalCost: number;
            totalMarketValue: number;
            totalProfitLoss: number;
        }[];
        assets: {
            holdingQuantity: number;
            totalCost: number;
            latestPrice: number;
            marketValue: number;
            profitLoss: number;
            id: number;
            symbol: string;
            name: string;
            unit: string;
            categoryCode: import(".prisma/client").$Enums.AssetCategoryCode;
            categoryName: string;
        }[];
    }>;
    getGoldPrice(): Promise<{
        buy: number;
        sell: number;
    }>;
    private parseGoldPriceValue;
    private normalizeTaskProgress;
    private normalizeTaskAmount;
    private ensureWebPushConfigured;
    private getValidatedWebPushConfig;
    private isValidBase64UrlValue;
    private calculateTaskProgress;
    private serializeTask;
    private calculateAssetSummary;
    private calculateSavingSummary;
    private round;
}
export {};
