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
  Put,
  Query,
} from '@nestjs/common';
import axios from 'axios';
import * as cheerio from 'cheerio';
import * as webpush from 'web-push';
import {
  AssetCategoryCode,
  ExpenseFrequency,
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

type UpsertMonthlyIncomeDto = {
  month: string;
  amount: number;
  note?: string;
};

type CreateExtraIncomeDto = {
  amount: number;
  title: string;
  note?: string;
  receivedAt: string;
};

type CreateExpenseCategoryDto = {
  name: string;
  color?: string;
};

type CreateRecurringExpenseDto = {
  categoryId: number;
  title: string;
  amount: number;
  frequency: ExpenseFrequency;
  dayOfWeek?: number;
  dayOfMonth?: number;
  monthOfYear?: number;
  startDate: string;
  endDate?: string;
  note?: string;
  isActive?: boolean;
};

type UpdateRecurringExpenseDto = Partial<CreateRecurringExpenseDto>;

type CreateExpenseEntryDto = {
  categoryId: number;
  recurringExpenseId?: number;
  amount: number;
  title: string;
  note?: string;
  spentAt: string;
};

type UpdateExpenseEntryDto = Partial<CreateExpenseEntryDto>;

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
        (data as Record<string, unknown>).dueReminderSentAt = null;
      }
    }

    if (body.priority !== undefined) {
      data.priority = body.priority;
    }

    if (body.dueDate !== undefined) {
      data.dueDate = new Date(body.dueDate);
      (data as Record<string, unknown>).dueReminderSentAt = null;
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

  @Get('income-monthly')
  async getMonthlyIncome(@Query('month') month?: string) {
    const normalizedMonth = this.normalizeMonthKey(month);

    const income = await this.prisma.monthlyIncome.findUnique({
      where: { month: normalizedMonth },
    });

    return income
      ? this.serializeMonthlyIncome(income)
      : {
          month: normalizedMonth,
          amount: 0,
          note: '',
          createdAt: null,
          updatedAt: null,
        };
  }

  @Put('income-monthly/:month')
  async upsertMonthlyIncome(
    @Param('month') month: string,
    @Body() body: Omit<UpsertMonthlyIncomeDto, 'month'>,
  ) {
    const normalizedMonth = this.normalizeMonthKey(month);

    return this.serializeMonthlyIncome(
      await this.prisma.monthlyIncome.upsert({
        where: { month: normalizedMonth },
        update: {
          amount: new Prisma.Decimal(this.normalizeMoney(body.amount)),
          note: body.note?.trim() || null,
        },
        create: {
          month: normalizedMonth,
          amount: new Prisma.Decimal(this.normalizeMoney(body.amount)),
          note: body.note?.trim() || null,
        },
      }),
    );
  }

  @Get('extra-incomes')
  async getExtraIncomes(@Query('month') month?: string) {
    const { start, end } = this.getMonthRange(month);

    const items = await this.prisma.extraIncome.findMany({
      where: {
        receivedAt: {
          gte: start,
          lt: end,
        },
      },
      orderBy: [{ receivedAt: 'desc' }, { id: 'desc' }],
    });

    return items.map((item) => this.serializeExtraIncome(item));
  }

  @Post('extra-incomes')
  async createExtraIncome(@Body() body: CreateExtraIncomeDto) {
    return this.serializeExtraIncome(
      await this.prisma.extraIncome.create({
        data: {
          amount: new Prisma.Decimal(this.normalizeMoney(body.amount)),
          title: body.title.trim(),
          note: body.note?.trim() || null,
          receivedAt: new Date(body.receivedAt),
        },
      }),
    );
  }

  @Delete('extra-incomes/:id')
  async deleteExtraIncome(@Param('id', ParseIntPipe) id: number) {
    return this.prisma.extraIncome.delete({
      where: { id },
    });
  }

  @Get('expense-categories')
  async getExpenseCategories() {
    return this.prisma.expenseCategory.findMany({
      where: { isEnabled: true },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
  }

  @Post('expense-categories')
  async createExpenseCategory(@Body() body: CreateExpenseCategoryDto) {
    return this.prisma.expenseCategory.create({
      data: {
        name: body.name.trim(),
        color: body.color?.trim() || null,
      },
    });
  }

  @Get('recurring-expenses')
  async getRecurringExpenses() {
    const items = await this.prisma.recurringExpense.findMany({
      include: {
        category: true,
      },
      orderBy: [{ isActive: 'desc' }, { frequency: 'asc' }, { title: 'asc' }],
    });

    return items.map((item) => this.serializeRecurringExpense(item));
  }

  @Post('recurring-expenses')
  async createRecurringExpense(@Body() body: CreateRecurringExpenseDto) {
    this.validateRecurringExpense(body);

    return this.serializeRecurringExpense(
      await this.prisma.recurringExpense.create({
        data: {
          categoryId: body.categoryId,
          title: body.title.trim(),
          amount: new Prisma.Decimal(this.normalizeMoney(body.amount)),
          frequency: body.frequency,
          dayOfWeek: body.dayOfWeek ?? null,
          dayOfMonth: body.dayOfMonth ?? null,
          monthOfYear: body.monthOfYear ?? null,
          startDate: new Date(body.startDate),
          endDate: body.endDate ? new Date(body.endDate) : null,
          note: body.note?.trim() || null,
          isActive: body.isActive ?? true,
        },
        include: {
          category: true,
        },
      }),
    );
  }

  @Patch('recurring-expenses/:id')
  async updateRecurringExpense(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateRecurringExpenseDto,
  ) {
    const existing = await this.prisma.recurringExpense.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new Error(`Recurring expense ${id} not found`);
    }

    const nextPayload: CreateRecurringExpenseDto = {
      categoryId: body.categoryId ?? existing.categoryId,
      title: body.title ?? existing.title,
      amount:
        body.amount ??
        Number((existing as { amount: Prisma.Decimal }).amount),
      frequency: body.frequency ?? existing.frequency,
      dayOfWeek: body.dayOfWeek ?? existing.dayOfWeek ?? undefined,
      dayOfMonth: body.dayOfMonth ?? existing.dayOfMonth ?? undefined,
      monthOfYear: body.monthOfYear ?? existing.monthOfYear ?? undefined,
      startDate: (body.startDate ? new Date(body.startDate) : existing.startDate).toISOString(),
      endDate:
        body.endDate !== undefined
          ? body.endDate
          : existing.endDate?.toISOString(),
      note: body.note ?? existing.note ?? undefined,
      isActive: body.isActive ?? existing.isActive,
    };

    this.validateRecurringExpense(nextPayload);

    return this.serializeRecurringExpense(
      await this.prisma.recurringExpense.update({
        where: { id },
        data: {
          categoryId: body.categoryId,
          title: body.title?.trim(),
          amount:
            body.amount !== undefined
              ? new Prisma.Decimal(this.normalizeMoney(body.amount))
              : undefined,
          frequency: body.frequency,
          dayOfWeek: body.dayOfWeek !== undefined ? body.dayOfWeek : undefined,
          dayOfMonth:
            body.dayOfMonth !== undefined ? body.dayOfMonth : undefined,
          monthOfYear:
            body.monthOfYear !== undefined ? body.monthOfYear : undefined,
          startDate: body.startDate ? new Date(body.startDate) : undefined,
          endDate:
            body.endDate !== undefined
              ? body.endDate
                ? new Date(body.endDate)
                : null
              : undefined,
          note: body.note !== undefined ? body.note.trim() || null : undefined,
          isActive: body.isActive,
        },
        include: {
          category: true,
        },
      }),
    );
  }

  @Delete('recurring-expenses/:id')
  async deleteRecurringExpense(@Param('id', ParseIntPipe) id: number) {
    return this.prisma.recurringExpense.delete({
      where: { id },
    });
  }

  @Get('expense-entries')
  async getExpenseEntries(@Query('month') month?: string) {
    const { start, end } = this.getMonthRange(month);

    const items = await this.prisma.expenseEntry.findMany({
      where: {
        spentAt: {
          gte: start,
          lt: end,
        },
      },
      include: {
        category: true,
        recurringExpense: true,
      },
      orderBy: [{ spentAt: 'desc' }, { id: 'desc' }],
    });

    return items.map((item) => this.serializeExpenseEntry(item));
  }

  @Post('expense-entries')
  async createExpenseEntry(@Body() body: CreateExpenseEntryDto) {
    return this.serializeExpenseEntry(
      await this.prisma.expenseEntry.create({
        data: {
          categoryId: body.categoryId,
          recurringExpenseId: body.recurringExpenseId ?? null,
          amount: new Prisma.Decimal(this.normalizeMoney(body.amount)),
          title: body.title.trim(),
          note: body.note?.trim() || null,
          spentAt: new Date(body.spentAt),
        },
        include: {
          category: true,
          recurringExpense: true,
        },
      }),
    );
  }

  @Patch('expense-entries/:id')
  async updateExpenseEntry(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateExpenseEntryDto,
  ) {
    return this.serializeExpenseEntry(
      await this.prisma.expenseEntry.update({
        where: { id },
        data: {
          categoryId: body.categoryId,
          recurringExpenseId:
            body.recurringExpenseId !== undefined
              ? body.recurringExpenseId || null
              : undefined,
          amount:
            body.amount !== undefined
              ? new Prisma.Decimal(this.normalizeMoney(body.amount))
              : undefined,
          title: body.title?.trim(),
          note: body.note !== undefined ? body.note.trim() || null : undefined,
          spentAt: body.spentAt ? new Date(body.spentAt) : undefined,
        },
        include: {
          category: true,
          recurringExpense: true,
        },
      }),
    );
  }

  @Delete('expense-entries/:id')
  async deleteExpenseEntry(@Param('id', ParseIntPipe) id: number) {
    return this.prisma.expenseEntry.delete({
      where: { id },
    });
  }

  @Get('spending-summary')
  async getSpendingSummary(@Query('month') month?: string) {
    const normalizedMonth = this.normalizeMonthKey(month);
    const { start, end } = this.getMonthRange(normalizedMonth);
    const previousMonth = this.shiftMonth(normalizedMonth, -1);

    const [monthlyIncome, extraIncomes, expenseEntries, recurringExpenses] =
      await Promise.all([
        this.prisma.monthlyIncome.findUnique({
          where: { month: normalizedMonth },
        }),
        this.prisma.extraIncome.findMany({
          where: {
            receivedAt: {
              gte: start,
              lt: end,
            },
          },
        }),
        this.prisma.expenseEntry.findMany({
          where: {
            spentAt: {
              gte: start,
              lt: end,
            },
          },
          include: {
            category: true,
            recurringExpense: true,
          },
        }),
        this.prisma.recurringExpense.findMany({
          where: {
            isActive: true,
          },
          include: {
            category: true,
          },
        }),
      ]);

    const expectedRecurring = recurringExpenses.filter((item) =>
      this.isRecurringExpenseDueInMonth(item, normalizedMonth),
    );

    const reservedForFuture = expectedRecurring.reduce((sum, recurring) => {
      const matchedEntry = expenseEntries.find(
        (entry) =>
          entry.recurringExpenseId === recurring.id &&
          this.isDateInMonth(entry.spentAt, normalizedMonth),
      );

      return sum + (matchedEntry ? 0 : Number(recurring.amount));
    }, 0);

    const totalFixedIncome = Number(monthlyIncome?.amount ?? 0);
    const totalExtraIncome = extraIncomes.reduce(
      (sum, item) => sum + Number(item.amount),
      0,
    );
    const totalSpent = expenseEntries.reduce(
      (sum, item) => sum + Number(item.amount),
      0,
    );
    const remainingBalance =
      totalFixedIncome + totalExtraIncome - totalSpent - reservedForFuture;

    const previousSummary = await this.buildSpendingSummary(previousMonth);

    const spendingByCategoryMap = new Map<string, { categoryId: number; categoryName: string; totalSpent: number }>();

    expenseEntries.forEach((entry) => {
      const key = String(entry.categoryId);
      const current = spendingByCategoryMap.get(key);

      if (current) {
        current.totalSpent += Number(entry.amount);
      } else {
        spendingByCategoryMap.set(key, {
          categoryId: entry.categoryId,
          categoryName: entry.category.name,
          totalSpent: Number(entry.amount),
        });
      }
    });

    return {
      month: normalizedMonth,
      income: {
        fixed: this.round(totalFixedIncome),
        extra: this.round(totalExtraIncome),
        total: this.round(totalFixedIncome + totalExtraIncome),
        monthlyIncome: monthlyIncome
          ? this.serializeMonthlyIncome(monthlyIncome)
          : {
              month: normalizedMonth,
              amount: 0,
              note: '',
              createdAt: null,
              updatedAt: null,
            },
        extraItems: extraIncomes.map((item) => this.serializeExtraIncome(item)),
      },
      expenses: {
        actualTotal: this.round(totalSpent),
        reservedForFuture: this.round(reservedForFuture),
        actualItems: expenseEntries.map((item) => this.serializeExpenseEntry(item)),
        recurringItems: expectedRecurring.map((item) =>
          this.serializeRecurringExpense(item),
        ),
        byCategory: Array.from(spendingByCategoryMap.values())
          .map((item) => ({
            ...item,
            totalSpent: this.round(item.totalSpent),
          }))
          .sort((a, b) => b.totalSpent - a.totalSpent),
      },
      remainingBalance: this.round(remainingBalance),
      comparisonWithPreviousMonth: {
        month: previousMonth,
        incomeDelta: this.round(
          totalFixedIncome + totalExtraIncome - previousSummary.incomeTotal,
        ),
        spendingDelta: this.round(totalSpent - previousSummary.actualSpent),
        reservedDelta: this.round(
          reservedForFuture - previousSummary.reservedForFuture,
        ),
        remainingDelta: this.round(
          remainingBalance - previousSummary.remainingBalance,
        ),
      },
    };
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

  private serializeMonthlyIncome(item: {
    id: number;
    month: string;
    amount: Prisma.Decimal;
    note: string | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: item.id,
      month: item.month,
      amount: Number(item.amount),
      note: item.note ?? '',
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    };
  }

  private serializeExtraIncome(item: {
    id: number;
    amount: Prisma.Decimal;
    title: string;
    note: string | null;
    receivedAt: Date;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: item.id,
      amount: Number(item.amount),
      title: item.title,
      note: item.note ?? '',
      receivedAt: item.receivedAt.toISOString(),
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    };
  }

  private serializeRecurringExpense(
    item: {
      id: number;
      categoryId: number;
      title: string;
      amount: Prisma.Decimal;
      frequency: ExpenseFrequency;
      dayOfWeek: number | null;
      dayOfMonth: number | null;
      monthOfYear: number | null;
      startDate: Date;
      endDate: Date | null;
      note: string | null;
      isActive: boolean;
      createdAt: Date;
      updatedAt: Date;
      category?: {
        id: number;
        name: string;
        color: string | null;
        isEnabled: boolean;
      };
    },
  ) {
    return {
      id: item.id,
      categoryId: item.categoryId,
      title: item.title,
      amount: Number(item.amount),
      frequency: item.frequency,
      dayOfWeek: item.dayOfWeek,
      dayOfMonth: item.dayOfMonth,
      monthOfYear: item.monthOfYear,
      startDate: item.startDate.toISOString(),
      endDate: item.endDate?.toISOString() ?? null,
      note: item.note ?? '',
      isActive: item.isActive,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
      category: item.category ?? null,
    };
  }

  private serializeExpenseEntry(
    item: {
      id: number;
      categoryId: number;
      recurringExpenseId: number | null;
      amount: Prisma.Decimal;
      title: string;
      note: string | null;
      spentAt: Date;
      createdAt: Date;
      updatedAt: Date;
      category?: {
        id: number;
        name: string;
        color: string | null;
        isEnabled: boolean;
      };
      recurringExpense?: {
        id: number;
        title: string;
        amount: Prisma.Decimal;
        frequency: ExpenseFrequency;
      } | null;
    },
  ) {
    return {
      id: item.id,
      categoryId: item.categoryId,
      recurringExpenseId: item.recurringExpenseId,
      amount: Number(item.amount),
      title: item.title,
      note: item.note ?? '',
      spentAt: item.spentAt.toISOString(),
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
      category: item.category ?? null,
      recurringExpense: item.recurringExpense
        ? {
            id: item.recurringExpense.id,
            title: item.recurringExpense.title,
            amount: Number(item.recurringExpense.amount),
            frequency: item.recurringExpense.frequency,
          }
        : null,
    };
  }

  private normalizeMoney(value: number) {
    if (!Number.isFinite(value) || Number.isNaN(value)) {
      throw new BadRequestException('Số tiền không hợp lệ.');
    }

    return Math.max(0, Math.round(value * 100) / 100);
  }

  private normalizeMonthKey(value?: string) {
    const rawValue = value?.trim();

    if (!rawValue) {
      const currentDate = new Date();
      const year = currentDate.getFullYear();
      const month = String(currentDate.getMonth() + 1).padStart(2, '0');
      return `${year}-${month}`;
    }

    if (!/^\d{4}-\d{2}$/.test(rawValue)) {
      throw new BadRequestException('Tháng phải có định dạng YYYY-MM.');
    }

    const [, monthText] = rawValue.split('-');
    const month = Number(monthText);

    if (month < 1 || month > 12) {
      throw new BadRequestException('Tháng không hợp lệ.');
    }

    return rawValue;
  }

  private getMonthRange(month?: string) {
    const normalizedMonth = this.normalizeMonthKey(month);
    const [yearText, monthText] = normalizedMonth.split('-');
    const year = Number(yearText);
    const monthNumber = Number(monthText) - 1;
    const start = new Date(year, monthNumber, 1);
    const end = new Date(year, monthNumber + 1, 1);

    return { start, end };
  }

  private shiftMonth(month: string, delta: number) {
    const normalizedMonth = this.normalizeMonthKey(month);
    const [yearText, monthText] = normalizedMonth.split('-');
    const shiftedDate = new Date(Number(yearText), Number(monthText) - 1 + delta, 1);

    return `${shiftedDate.getFullYear()}-${String(shiftedDate.getMonth() + 1).padStart(2, '0')}`;
  }

  private isDateInMonth(date: Date, month: string) {
    const normalizedMonth = this.normalizeMonthKey(month);
    return date.toISOString().slice(0, 7) === normalizedMonth;
  }

  private validateRecurringExpense(body: CreateRecurringExpenseDto) {
    if (!body.title?.trim()) {
      throw new BadRequestException('Tên khoản chi định kỳ là bắt buộc.');
    }

    this.normalizeMoney(body.amount);

    if (body.frequency === ExpenseFrequency.WEEKLY) {
      if (body.dayOfWeek === undefined || body.dayOfWeek < 0 || body.dayOfWeek > 6) {
        throw new BadRequestException('Khoản chi hàng tuần cần dayOfWeek từ 0 đến 6.');
      }
    }

    if (body.frequency === ExpenseFrequency.MONTHLY) {
      if (
        body.dayOfMonth === undefined ||
        body.dayOfMonth < 1 ||
        body.dayOfMonth > 31
      ) {
        throw new BadRequestException('Khoản chi hàng tháng cần dayOfMonth từ 1 đến 31.');
      }
    }

    if (body.frequency === ExpenseFrequency.YEARLY) {
      if (
        body.dayOfMonth === undefined ||
        body.dayOfMonth < 1 ||
        body.dayOfMonth > 31 ||
        body.monthOfYear === undefined ||
        body.monthOfYear < 1 ||
        body.monthOfYear > 12
      ) {
        throw new BadRequestException(
          'Khoản chi hàng năm cần monthOfYear từ 1 đến 12 và dayOfMonth từ 1 đến 31.',
        );
      }
    }
  }

  private isRecurringExpenseDueInMonth(
    item: {
      frequency: ExpenseFrequency;
      dayOfWeek: number | null;
      dayOfMonth: number | null;
      monthOfYear: number | null;
      startDate: Date;
      endDate: Date | null;
    },
    month: string,
  ) {
    const normalizedMonth = this.normalizeMonthKey(month);
    const { start, end } = this.getMonthRange(normalizedMonth);

    if (item.startDate >= end) {
      return false;
    }

    if (item.endDate && item.endDate < start) {
      return false;
    }

    if (item.frequency === ExpenseFrequency.DAILY) {
      return true;
    }

    if (item.frequency === ExpenseFrequency.WEEKLY) {
      return item.dayOfWeek !== null;
    }

    if (item.frequency === ExpenseFrequency.MONTHLY) {
      return item.dayOfMonth !== null;
    }

    if (item.frequency === ExpenseFrequency.YEARLY) {
      return item.monthOfYear === start.getMonth() + 1 && item.dayOfMonth !== null;
    }

    return false;
  }

  private async buildSpendingSummary(month: string) {
    const normalizedMonth = this.normalizeMonthKey(month);
    const { start, end } = this.getMonthRange(normalizedMonth);

    const [monthlyIncome, extraIncomes, expenseEntries, recurringExpenses] =
      await Promise.all([
        this.prisma.monthlyIncome.findUnique({
          where: { month: normalizedMonth },
        }),
        this.prisma.extraIncome.findMany({
          where: {
            receivedAt: {
              gte: start,
              lt: end,
            },
          },
        }),
        this.prisma.expenseEntry.findMany({
          where: {
            spentAt: {
              gte: start,
              lt: end,
            },
          },
        }),
        this.prisma.recurringExpense.findMany({
          where: {
            isActive: true,
          },
        }),
      ]);

    const reservedForFuture = recurringExpenses
      .filter((item) => this.isRecurringExpenseDueInMonth(item, normalizedMonth))
      .reduce((sum, recurring) => {
        const matchedEntry = expenseEntries.find(
          (entry) => entry.recurringExpenseId === recurring.id,
        );

        return sum + (matchedEntry ? 0 : Number(recurring.amount));
      }, 0);

    const incomeTotal =
      Number(monthlyIncome?.amount ?? 0) +
      extraIncomes.reduce((sum, item) => sum + Number(item.amount), 0);
    const actualSpent = expenseEntries.reduce(
      (sum, item) => sum + Number(item.amount),
      0,
    );
    const remainingBalance = incomeTotal - actualSpent - reservedForFuture;

    return {
      incomeTotal: this.round(incomeTotal),
      actualSpent: this.round(actualSpent),
      reservedForFuture: this.round(reservedForFuture),
      remainingBalance: this.round(remainingBalance),
    };
  }

  private round(value: number) {
    return Math.round(value * 100) / 100;
  }
}
