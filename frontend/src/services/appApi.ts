import axios from 'axios';
import type {
  Category,
  DashboardResponse,
  ExpenseCategory,
  ExpenseEntry,
  ExtraIncomeItem,
  LatestPrice,
  LatestTransaction,
  MonthlyIncome,
  PaginatedResponse,
  PaginationState,
  RecurringExpense,
  SpendingSummary,
  TaskItem,
  TaskSummary,
} from '../types/app';

const baseURL =
  import.meta.env.VITE_API_BASE_URL?.trim() || 'https://trade-view-be.onrender.com';

export const api = axios.create({
  baseURL,
});

export async function fetchDashboard() {
  const response = await api.get<DashboardResponse>('/dashboard');
  return response.data;
}

export async function fetchCategories() {
  const response = await api.get<Category[]>('/categories');
  return response.data;
}

export async function fetchTransactions(pagination: PaginationState) {
  const response = await api.get<PaginatedResponse<LatestTransaction>>('/transactions', {
    params: pagination,
  });
  return response.data;
}

export async function fetchLatestPrices() {
  const response = await api.get<LatestPrice[]>('/prices/latest');
  return response.data;
}

export async function fetchTasks(pagination: PaginationState) {
  const response = await api.get<PaginatedResponse<TaskItem>>('/tasks', {
    params: pagination,
  });
  return response.data;
}

export async function fetchTaskSummary() {
  const response = await api.get<TaskSummary>('/tasks/summary');
  return response.data;
}

export async function fetchMonthlyIncome(month: string) {
  const response = await api.get<MonthlyIncome>('/income-monthly', {
    params: { month },
  });
  return response.data;
}

export async function fetchExtraIncomes(month: string) {
  const response = await api.get<ExtraIncomeItem[]>('/extra-incomes', {
    params: { month },
  });
  return response.data;
}

export async function fetchExpenseCategories() {
  const response = await api.get<ExpenseCategory[]>('/expense-categories');
  return response.data;
}

export async function fetchRecurringExpenses() {
  const response = await api.get<RecurringExpense[]>('/recurring-expenses');
  return response.data;
}

export async function fetchExpenseEntries(month: string) {
  const response = await api.get<ExpenseEntry[]>('/expense-entries', {
    params: { month },
  });
  return response.data;
}

export async function fetchSpendingSummary(month: string) {
  const response = await api.get<SpendingSummary>('/spending-summary', {
    params: { month },
  });
  return response.data;
}