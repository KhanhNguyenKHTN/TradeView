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

export type ExpenseFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';

export type MonthlyIncome = {
  id?: number;
  month: string;
  amount: number;
  note: string;
  createdAt: string | null;
  updatedAt: string | null;
};

export type ExtraIncomeItem = {
  id: number;
  amount: number;
  title: string;
  note: string;
  receivedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type ExpenseCategory = {
  id: number;
  name: string;
  color: string | null;
  isEnabled: boolean;
};

export type RecurringExpense = {
  id: number;
  categoryId: number;
  title: string;
  amount: number;
  frequency: ExpenseFrequency;
  dayOfWeek: number | null;
  dayOfMonth: number | null;
  monthOfYear: number | null;
  startDate: string;
  endDate: string | null;
  note: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  category: ExpenseCategory | null;
};

export type ExpenseEntry = {
  id: number;
  categoryId: number;
  recurringExpenseId: number | null;
  amount: number;
  title: string;
  note: string;
  spentAt: string;
  createdAt: string;
  updatedAt: string;
  category: ExpenseCategory | null;
  recurringExpense: {
    id: number;
    title: string;
    amount: number;
    frequency: ExpenseFrequency;
  } | null;
};

export type SpendingSummary = {
  month: string;
  income: {
    fixed: number;
    extra: number;
    total: number;
    monthlyIncome: MonthlyIncome;
    extraItems: ExtraIncomeItem[];
  };
  expenses: {
    actualTotal: number;
    reservedForFuture: number;
    actualItems: ExpenseEntry[];
    recurringItems: RecurringExpense[];
    byCategory: {
      categoryId: number;
      categoryName: string;
      totalSpent: number;
    }[];
  };
  remainingBalance: number;
  comparisonWithPreviousMonth: {
    month: string;
    incomeDelta: number;
    spendingDelta: number;
    reservedDelta: number;
    remainingDelta: number;
  };
};

export type MonthlyIncomeFormState = {
  month: string;
  amount: string;
  note: string;
};

export type ExtraIncomeFormState = {
  amount: string;
  title: string;
  note: string;
  receivedAt: string;
};

export type ExpenseCategoryFormState = {
  name: string;
  color: string;
};

export type RecurringExpenseFormState = {
  categoryId: string;
  title: string;
  amount: string;
  frequency: ExpenseFrequency;
  dayOfWeek: string;
  dayOfMonth: string;
  monthOfYear: string;
  startDate: string;
  endDate: string;
  note: string;
  isActive: boolean;
};

export type ExpenseEntryFormState = {
  categoryId: string;
  recurringExpenseId: string;
  amount: string;
  title: string;
  note: string;
  spentAt: string;
};

export type AppPage = 'DASHBOARD' | 'TASKS' | 'SPENDING';

export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE' | 'BLOCKED';

export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export type TaskViewFilter = 'ALL' | TaskStatus;
export type TaskViewMode = 'CARD' | 'GRID';

export type TaskItem = {
  id: number;
  title: string;
  description: string;
  note: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string;
  owner: string;
  category: string;
  isFinancialPlan: boolean;
  financialTargetAmount: number;
  financialCurrentAmount: number;
  progress: number;
  createdAt: string;
  updatedAt: string;
};

export type TaskSummary = {
  totalTasks: number;
  inProgressTasks: number;
  dueSoonTasks: number;
  completedTasks: number;
  financialPlanningTasks: number;
  averageFinancialProgress: number;
};

export type TaskFormValues = {
  title: string;
  description: string;
  note: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string;
  owner: string;
  category: string;
  isFinancialPlan: boolean;
  financialTargetAmount: string;
  financialCurrentAmount: string;
  progress: string;
};

export type TaskEditableField =
  | 'title'
  | 'description'
  | 'note'
  | 'status'
  | 'priority'
  | 'dueDate'
  | 'owner'
  | 'category'
  | 'isFinancialPlan'
  | 'financialTargetAmount'
  | 'financialCurrentAmount'
  | 'progress';
