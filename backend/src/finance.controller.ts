import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import axios from 'axios';
import * as cheerio from 'cheerio';
import * as webpush from 'web-push';
import {
  AssetCategoryCode,
  PriceSource,
  Prisma,
  TaskPriority,
  TaskStatus,
  TransactionType,
} from '@prisma/client';
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

@Controller('api')
export class FinanceController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('categories')
  async getCategories() {
    return this.prisma.assetCategory.findMany({
      where: { isEnabled: true },
      orderBy: { id: 'asc' },
    });
  }

  @Get('assets')
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

  @Post('assets')
  async createAsset(@Body() body: CreateAssetDto) {
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

  @Get('assets/:id')
  async getAssetDetail(@Param('id', ParseIntPipe) id: number) {
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

  @Post('transactions')
  async createTransaction(@Body() body: CreateTransactionDto) {
    return this.prisma.transaction.create({
      data: {
        assetId: body.assetId,
        type: body.type,
        quantity: new Prisma.Decimal(body.quantity),
        price: new Prisma.Decimal(body.price),
        fee: new Prisma.Decimal(body.fee ?? 0),
        executedAt: new Date(body.executedAt),
        settledAt: body.settledAt ? new Date(body.settledAt) : null,
        note: body.note,
      },
    });
  }

  @Get('transactions')
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

  @Delete('transactions/:id')
  async deleteTransaction(@Param('id', ParseIntPipe) id: number) {
    return this.prisma.transaction.delete({
      where: { id },
    });
  }

  @Post('prices')
  async createPrice(@Body() body: CreatePriceDto) {
    return this.prisma.priceSnapshot.create({
      data: {
        assetId: body.assetId,
        price: new Prisma.Decimal(body.price),
        source: body.source ?? PriceSource.MANUAL,
        capturedAt: new Date(body.capturedAt),
      },
    });
  }

  @Post('prices/auto/gold')
  async updateGoldPriceAutomatically(
    @Body() body: { assetId: number; capturedAt?: string },
  ) {
    const asset = await this.prisma.asset.findUnique({
      where: { id: body.assetId },
      include: { category: true },
    });

    if (!asset) {
      throw new Error(`Asset ${body.assetId} not found`);
    }

    if (asset.category.code !== AssetCategoryCode.GOLD) {
      throw new BadRequestException(
        `Asset ${body.assetId} is not a GOLD asset`,
      );
    }

    const goldPrice = await this.getGoldPrice();

    const snapshot = await this.prisma.priceSnapshot.create({
      data: {
        assetId: asset.id,
        price: new Prisma.Decimal(goldPrice.buy),
        source: PriceSource.AUTO,
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

  @Get('prices/latest')
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

  @Get('tasks')
  async getTasks() {
    const tasks = await this.prisma.task.findMany({
      orderBy: [{ status: 'asc' }, { dueDate: 'asc' }, { id: 'desc' }],
    });

    return tasks.map((task) => this.serializeTask(task));
  }

  @Get('tasks/summary')
  async getTaskSummary() {
    const tasks = await this.prisma.task.findMany();

    const inProgressTasks = tasks.filter(
      (task) => task.status === TaskStatus.IN_PROGRESS,
    ).length;
    const completedTasks = tasks.filter(
      (task) => task.status === TaskStatus.DONE,
    ).length;
    const financialTasks = tasks.filter((task) => task.isFinancialPlan);
    const now = new Date();

    const dueSoonTasks = tasks.filter((task) => {
      if (task.status === TaskStatus.DONE) {
        return false;
      }

      const diffTime = task.dueDate.getTime() - now.getTime();
      const diffDays = diffTime / (1000 * 60 * 60 * 24);

      return diffDays <= 7;
    }).length;

    const averageFinancialProgress =
      financialTasks.length > 0
        ? Math.round(
            financialTasks.reduce((sum, task) => sum + task.progress, 0) /
              financialTasks.length,
          )
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

  @Post('tasks')
  async createTask(@Body() body: CreateTaskDto) {
    return this.serializeTask(
      await this.prisma.task.create({
        data: {
          title: body.title.trim(),
          description: body.description.trim(),
          note: body.note?.trim() || null,
          status: body.status ?? TaskStatus.TODO,
          priority: body.priority ?? TaskPriority.MEDIUM,
          dueDate: new Date(body.dueDate),
          owner: body.owner.trim(),
          category: body.category.trim(),
          isFinancialPlan: body.isFinancialPlan ?? false,
          financialTargetAmount: this.normalizeTaskAmount(
            body.isFinancialPlan ? body.financialTargetAmount ?? 0 : 0,
          ),
          financialCurrentAmount: this.normalizeTaskAmount(
            body.isFinancialPlan ? body.financialCurrentAmount ?? 0 : 0,
          ),
          progress: this.calculateTaskProgress(
            body.isFinancialPlan ?? false,
            body.financialTargetAmount ?? 0,
            body.financialCurrentAmount ?? 0,
            body.progress,
          ),
          dueReminderSentAt: null,
        },
      }),
    );
  }

  @Patch('tasks/:id')
  async updateTask(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateTaskDto,
  ) {
    const existingTask = await this.prisma.task.findUnique({
      where: { id },
    });

    if (!existingTask) {
      throw new Error(`Task ${id} not found`);
    }

    const data: Prisma.TaskUncheckedUpdateInput = {};

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

      if (
        existingTask.status === TaskStatus.DONE &&
        body.status !== TaskStatus.DONE
      ) {
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
    const nextFinancialTargetAmount =
      body.financialTargetAmount !== undefined
        ? body.financialTargetAmount
        : Number((existingTask as { financialTargetAmount?: Prisma.Decimal | number | null }).financialTargetAmount ?? 0);
    const nextFinancialCurrentAmount =
      body.financialCurrentAmount !== undefined
        ? body.financialCurrentAmount
        : Number((existingTask as { financialCurrentAmount?: Prisma.Decimal | number | null }).financialCurrentAmount ?? 0);

    if (body.isFinancialPlan !== undefined) {
      data.isFinancialPlan = body.isFinancialPlan;
    }

    if (body.financialTargetAmount !== undefined || !nextIsFinancialPlan) {
      (data as Record<string, unknown>).financialTargetAmount = this.normalizeTaskAmount(
        nextIsFinancialPlan ? nextFinancialTargetAmount : 0,
      );
    }

    if (body.financialCurrentAmount !== undefined || !nextIsFinancialPlan) {
      (data as Record<string, unknown>).financialCurrentAmount = this.normalizeTaskAmount(
        nextIsFinancialPlan ? nextFinancialCurrentAmount : 0,
      );
    }

    if (
      body.progress !== undefined ||
      body.isFinancialPlan !== undefined ||
      body.financialTargetAmount !== undefined ||
      body.financialCurrentAmount !== undefined
    ) {
      data.progress = this.calculateTaskProgress(
        nextIsFinancialPlan,
        nextFinancialTargetAmount,
        nextFinancialCurrentAmount,
        body.progress,
      );
    }

    return this.serializeTask(
      await this.prisma.task.update({
        where: { id },
        data,
      }),
    );
  }

  @Delete('tasks/:id')
  async deleteTask(@Param('id', ParseIntPipe) id: number) {
    return this.prisma.task.delete({
      where: { id },
    });
  }

  @Post('push-subscriptions')
  async savePushSubscription(@Body() body: PushSubscriptionDto) {
    this.ensureWebPushConfigured();

    if (!body.endpoint?.trim() || !body.keys?.p256dh?.trim() || !body.keys?.auth?.trim()) {
      throw new BadRequestException('Push subscription không hợp lệ.');
    }

    const endpoint = body.endpoint.trim();

    return this.prisma.pushSubscription.upsert({
      where: {
        endpoint,
      },
      update: {
        p256dh: body.keys.p256dh.trim(),
        auth: body.keys.auth.trim(),
        expirationTime:
          body.expirationTime === null || body.expirationTime === undefined
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
        expirationTime:
          body.expirationTime === null || body.expirationTime === undefined
            ? null
            : BigInt(Math.trunc(body.expirationTime)),
        userAgent: body.userAgent?.trim() || null,
        platform: body.platform?.trim() || null,
        isActive: true,
        lastUsedAt: new Date(),
      },
    });
  }

  @Get('push-public-key')
  getPushPublicKey() {
    const { publicKey } = this.getValidatedWebPushConfig();

    return { publicKey };
  }

  @Post('push-notifications/send')
  async sendPushNotification(@Body() body: SendPushNotificationDto) {
    this.ensureWebPushConfigured();

    const title = body.title?.trim();
    const messageBody = body.body?.trim();

    if (!title || !messageBody) {
      throw new BadRequestException('Tiêu đề và nội dung thông báo là bắt buộc.');
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
            payload,
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
              ? ((error as { statusCode: number }).statusCode)
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

  @Get('dashboard')
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

    const totals = assetSummaries.reduce(
      (acc, asset) => {
        acc.totalCost += asset.totalCost;
        acc.totalMarketValue += asset.marketValue;
        acc.totalProfitLoss += asset.profitLoss;
        return acc;
      },
      {
        totalCost: 0,
        totalMarketValue: 0,
        totalProfitLoss: 0,
      },
    );

    const enabledCategories = await this.prisma.assetCategory.findMany({
      where: { isEnabled: true },
      orderBy: { id: 'asc' },
    });

    const byCategory = enabledCategories.map((category) => {
      const items = assetSummaries.filter(
        (asset) => asset.categoryCode === category.code,
      );

      return {
        categoryCode: category.code,
        categoryName: category.name,
        totalCost: this.round(items.reduce((sum, item) => sum + item.totalCost, 0)),
        totalMarketValue: this.round(
          items.reduce((sum, item) => sum + item.marketValue, 0),
        ),
        totalProfitLoss: this.round(
          items.reduce((sum, item) => sum + item.profitLoss, 0),
        ),
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

  async getGoldPrice(): Promise<{
    buy: number;
    sell: number;
  }> {
    let html: string;

    try {
      const response = await axios.get<string>(
        'https://hoakimnguyen.com/tra-cuu-gia-vang/',
        {
          timeout: 10_000,
          responseType: 'text',
        },
      );
      html = response.data;
    } catch (error) {
      throw new Error(
        `Failed to request gold price page: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
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

  private parseGoldPriceValue(value: string) {
    const normalizedValue = value.replace(/\./g, '').replace(/,/g, '').trim();
    const parsedValue = Number(normalizedValue);

    if (!normalizedValue || Number.isNaN(parsedValue)) {
      throw new Error(`Failed to parse gold price value: ${value}`);
    }

    return parsedValue * 1000;
  }

  private normalizeTaskProgress(value: number) {
    return Math.min(100, Math.max(0, Math.round(value)));
  }

  private normalizeTaskAmount(value: number) {
    if (!Number.isFinite(value) || Number.isNaN(value)) {
      return 0;
    }

    return Math.max(0, Math.round(value * 100) / 100);
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

  private calculateTaskProgress(
    isFinancialPlan: boolean,
    financialTargetAmount: number,
    financialCurrentAmount: number,
    manualProgress?: number,
  ) {
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

  private serializeTask(task: {
    id: number;
    title: string;
    description: string;
    note: string | null;
    status: TaskStatus;
    priority: TaskPriority;
    dueDate: Date;
    owner: string;
    category: string;
    isFinancialPlan: boolean;
    progress: number;
    createdAt: Date;
    updatedAt: Date;
    financialTargetAmount?: Prisma.Decimal | number | null;
    financialCurrentAmount?: Prisma.Decimal | number | null;
  }) {
    return {
      ...task,
      note: task.note ?? '',
      dueDate: task.dueDate.toISOString(),
      financialTargetAmount: Number(task.financialTargetAmount ?? 0),
      financialCurrentAmount: Number(task.financialCurrentAmount ?? 0),
    };
  }

  private calculateAssetSummary(
    asset: {
      transactions: {
        type: TransactionType;
        quantity: Prisma.Decimal;
        price: Prisma.Decimal;
        fee: Prisma.Decimal;
      }[];
      priceSnapshots: {
        price: Prisma.Decimal;
      }[];
    } & Record<string, unknown>,
  ) {
    let holdingQuantity = 0;
    let totalCost = 0;

    for (const transaction of asset.transactions) {
      const quantity = Number(transaction.quantity);
      const price = Number(transaction.price);
      const fee = Number(transaction.fee);

      if (transaction.type === TransactionType.BUY) {
        holdingQuantity += quantity;
        totalCost += quantity * price + fee;
      } else {
        const averageCost = holdingQuantity > 0 ? totalCost / holdingQuantity : 0;
        holdingQuantity -= quantity;
        totalCost -= averageCost * quantity;
        totalCost -= fee;
      }
    }

    const assetCategoryCode =
      typeof asset.category === 'object' &&
      asset.category !== null &&
      'code' in asset.category
        ? (asset.category.code as AssetCategoryCode)
        : null;

    if (assetCategoryCode === AssetCategoryCode.SAVING) {
      return this.calculateSavingSummary(asset as typeof asset & {
        transactions: {
          type: TransactionType;
          quantity: Prisma.Decimal;
          price: Prisma.Decimal;
          fee: Prisma.Decimal;
          executedAt: Date;
          settledAt?: Date | null;
        }[];
      });
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

  private calculateSavingSummary(
    asset: {
      transactions: {
        type: TransactionType;
        quantity: Prisma.Decimal;
        price: Prisma.Decimal;
        fee: Prisma.Decimal;
        executedAt: Date;
        settledAt?: Date | null;
      }[];
    },
  ) {
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

      const effectiveEndDate =
        endDate.getTime() > startDate.getTime() ? endDate : startDate;
      const holdingDays = Math.max(
        0,
        Math.floor(
          (effectiveEndDate.getTime() - startDate.getTime()) /
            (1000 * 60 * 60 * 24),
        ),
      );
      const interest =
        depositAmount * (annualRatePercent / 100) * (holdingDays / 365);

      if (transaction.type === TransactionType.BUY) {
        principal += depositAmount;
        accruedInterest += interest;
        currentRate = annualRatePercent;
        principal -= fee;
      } else {
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

  private round(value: number) {
    return Math.round(value * 100) / 100;
  }
}
