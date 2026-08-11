import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import axios from 'axios';
import * as cheerio from 'cheerio';
import {
  AssetCategoryCode,
  PriceSource,
  Prisma,
  PrismaClient,
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
