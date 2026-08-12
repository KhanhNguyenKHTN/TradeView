export type CategoryCode = 'GOLD' | 'SAVING' | 'STOCK' | 'COIN';

export type TransactionType = 'BUY' | 'SELL';

export type PriceSource = 'AUTO' | 'MANUAL';

export type Category = {
  id: number;
  code: CategoryCode;
  name: string;
  isEnabled: boolean;
};

export type CategorySummary = {
  categoryCode: CategoryCode;
  categoryName: string;
  totalCost: number;
  totalMarketValue: number;
  totalProfitLoss: number;
};

export type AssetSummary = {
  id: number;
  symbol: string;
  name: string;
  unit: string;
  categoryCode: CategoryCode;
  categoryName: string;
  holdingQuantity: number;
  totalCost: number;
  latestPrice: number;
  marketValue: number;
  profitLoss: number;
};

export type DashboardResponse = {
  totals: {
    totalCost: number;
    totalMarketValue: number;
    totalProfitLoss: number;
  };
  byCategory: CategorySummary[];
  assets: AssetSummary[];
};

export type LatestTransaction = {
  id: number;
  type: TransactionType;
  quantity: string;
  price: string;
  fee: string;
  executedAt: string;
  settledAt?: string | null;
  note: string | null;
  asset: {
    id: number;
    symbol: string;
    name: string;
    category: Category;
  };
};

export type LatestPrice = {
  assetId: number;
  symbol: string;
  assetName: string;
  category: Category;
  latestPrice: {
    id: number;
    price: string;
    source: PriceSource;
    capturedAt: string;
  } | null;
};

export type AssetFormState = {
  categoryCode: CategoryCode;
  symbol: string;
  name: string;
  unit: string;
  notes: string;
};

export type TransactionFormState = {
  assetId: string;
  type: TransactionType;
  quantity: string;
  price: string;
  fee: string;
  executedAt: string;
  settledAt: string;
  note: string;
};

export type PriceFormState = {
  assetId: string;
  source: PriceSource;
  price: string;
  capturedAt: string;
};

export type AssetOption = {
  id: number;
  value: string;
  label: string;
};