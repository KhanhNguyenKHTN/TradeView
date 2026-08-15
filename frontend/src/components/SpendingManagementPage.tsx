import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type {
  ExpenseCategory,
  ExpenseCategoryFormState,
  ExpenseEntry,
  ExpenseEntryFormState,
  ExpenseFrequency,
  ExtraIncomeFormState,
  ExtraIncomeItem,
  MonthlyIncomeFormState,
  RecurringExpense,
  RecurringExpenseFormState,
  SpendingSummary,
} from '../types/app';
import { formatCurrency, formatDateTime } from '../utils/appFormatters';

type SpendingManagementPageProps = {
  month: string;
  summary: SpendingSummary | null;
  categories: ExpenseCategory[];
  recurringExpenses: RecurringExpense[];
  expenseEntries: ExpenseEntry[];
  monthlyIncomeForm: MonthlyIncomeFormState;
  extraIncomeForm: ExtraIncomeFormState;
  expenseCategoryForm: ExpenseCategoryFormState;
  recurringExpenseForm: RecurringExpenseFormState;
  expenseEntryForm: ExpenseEntryFormState;
  submitting: boolean;
  onMonthChange: (month: string) => void;
  onMonthlyIncomeFormChange: (form: MonthlyIncomeFormState) => void;
  onExtraIncomeFormChange: (form: ExtraIncomeFormState) => void;
  onExpenseCategoryFormChange: (form: ExpenseCategoryFormState) => void;
  onRecurringExpenseFormChange: (form: RecurringExpenseFormState) => void;
  onExpenseEntryFormChange: (form: ExpenseEntryFormState) => void;
  onSubmitMonthlyIncome: () => void;
  onSubmitExtraIncome: () => void;
  onDeleteExtraIncome: (id: number) => void;
  onSubmitExpenseCategory: () => void;
  onSubmitRecurringExpense: () => void;
  onToggleRecurringExpense: (item: RecurringExpense) => void;
  onDeleteRecurringExpense: (id: number) => void;
  onPrefillExpenseEntryFromRecurring: (item: RecurringExpense) => void;
  onSubmitExpenseEntry: () => void;
  onDeleteExpenseEntry: (id: number) => void;
};

type SpendingDialogType =
  | 'MONTHLY_INCOME'
  | 'EXTRA_INCOME'
  | 'EXPENSE_CATEGORY'
  | 'RECURRING_EXPENSE'
  | 'EXPENSE_ENTRY'
  | null;

type DeleteDialogState =
  | {
      type: 'EXTRA_INCOME';
      id: number;
      title: string;
    }
  | {
      type: 'RECURRING_EXPENSE';
      id: number;
      title: string;
    }
  | {
      type: 'EXPENSE_ENTRY';
      id: number;
      title: string;
    }
  | null;

const frequencyLabels: Record<ExpenseFrequency, string> = {
  DAILY: 'Hàng ngày',
  WEEKLY: 'Hàng tuần',
  MONTHLY: 'Hàng tháng',
  YEARLY: 'Hàng năm',
};

const weekdayLabels = [
  'Chủ nhật',
  'Thứ 2',
  'Thứ 3',
  'Thứ 4',
  'Thứ 5',
  'Thứ 6',
  'Thứ 7',
];

function formatMonthLabel(month: string) {
  if (!month) {
    return '';
  }

  const [year, monthNumber] = month.split('-');
  return `Tháng ${monthNumber}/${year}`;
}

function formatSchedule(item: RecurringExpense) {
  switch (item.frequency) {
    case 'DAILY':
      return 'Mỗi ngày';
    case 'WEEKLY':
      return item.dayOfWeek != null
        ? `Mỗi ${weekdayLabels[item.dayOfWeek]}`
        : 'Hàng tuần';
    case 'MONTHLY':
      return item.dayOfMonth != null ? `Ngày ${item.dayOfMonth} hàng tháng` : 'Hàng tháng';
    case 'YEARLY':
      return item.monthOfYear != null
        ? `Tháng ${item.monthOfYear}${item.dayOfMonth ? `, ngày ${item.dayOfMonth}` : ''}`
        : 'Hàng năm';
    default:
      return '';
  }
}

function renderDelta(value: number) {
  const className = value >= 0 ? 'profit' : 'loss';
  return <strong className={className}>{`${value >= 0 ? '+' : ''}${formatCurrency(value)}`}</strong>;
}

function sanitizeCurrencyInput(value: string) {
  return value.replace(/\D/g, '');
}

function formatCurrencyInputValue(value: string) {
  if (!value) {
    return '';
  }

  const normalizedValue = sanitizeCurrencyInput(value);

  if (!normalizedValue) {
    return '';
  }

  return new Intl.NumberFormat('vi-VN').format(Number(normalizedValue));
}

type DialogShellProps = {
  title: string;
  subtitle: string;
  onClose: () => void;
  children: ReactNode;
};

function DialogShell({ title, subtitle, onClose, children }: DialogShellProps) {
  return (
    <div className="dialog-overlay" role="presentation" onClick={onClose}>
      <div
        className="dialog-panel spending-dialog-panel"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="row">
          <div>
            <span className="section-kicker">{subtitle}</span>
            <h2>{title}</h2>
          </div>
          <button type="button" className="dialog-close" onClick={onClose} aria-label="Đóng">
            ×
          </button>
        </div>
        <div className="mt-2">{children}</div>
      </div>
    </div>
  );
}

export default function SpendingManagementPage({
  month,
  summary,
  categories,
  recurringExpenses,
  expenseEntries,
  monthlyIncomeForm,
  extraIncomeForm,
  expenseCategoryForm,
  recurringExpenseForm,
  expenseEntryForm,
  submitting,
  onMonthChange,
  onMonthlyIncomeFormChange,
  onExtraIncomeFormChange,
  onExpenseCategoryFormChange,
  onRecurringExpenseFormChange,
  onExpenseEntryFormChange,
  onSubmitMonthlyIncome,
  onSubmitExtraIncome,
  onDeleteExtraIncome,
  onSubmitExpenseCategory,
  onSubmitRecurringExpense,
  onToggleRecurringExpense,
  onDeleteRecurringExpense,
  onPrefillExpenseEntryFromRecurring,
  onSubmitExpenseEntry,
  onDeleteExpenseEntry,
}: SpendingManagementPageProps) {
  const [activeDialog, setActiveDialog] = useState<SpendingDialogType>(null);
  const [deleteDialog, setDeleteDialog] = useState<DeleteDialogState>(null);

  const recurringOptions = useMemo(
    () =>
      recurringExpenses.map((item) => ({
        value: String(item.id),
        label: `${item.title} • ${formatCurrency(item.amount)}`,
      })),
    [recurringExpenses],
  );

  const selectedRecurringExpense =
    recurringExpenses.find((item) => String(item.id) === expenseEntryForm.recurringExpenseId) ?? null;

  const categorySpending = summary?.expenses.byCategory ?? [];
  const extraIncomeItems = summary?.income.extraItems ?? [];

  const maxCategorySpend = Math.max(
    ...categorySpending.map((item) => item.totalSpent),
    0,
  );

  const handleConfirmDelete = () => {
    if (!deleteDialog) {
      return;
    }

    if (deleteDialog.type === 'EXTRA_INCOME') {
      onDeleteExtraIncome(deleteDialog.id);
    }

    if (deleteDialog.type === 'RECURRING_EXPENSE') {
      onDeleteRecurringExpense(deleteDialog.id);
    }

    if (deleteDialog.type === 'EXPENSE_ENTRY') {
      onDeleteExpenseEntry(deleteDialog.id);
    }

    setDeleteDialog(null);
  };

  return (
    <section className="section stack spending-page">
      <div className="section-heading">
        <div>
          <span className="section-kicker">Quản lý chi tiêu</span>
          <h2>{formatMonthLabel(month)}</h2>
        </div>
        <div className="spending-month-picker">
          <label htmlFor="spending-month">Chọn tháng</label>
          <input
            id="spending-month"
            type="month"
            value={month}
            onChange={(event) => onMonthChange(event.target.value)}
          />
        </div>
      </div>

      <div className="stats-grid">
        <article className="stat-card">
          <span className="stat-label">Doanh thu tháng</span>
          <strong>{formatCurrency(summary?.income.total ?? 0)}</strong>
          {/* <span className="stat-subtle">
            Cố định: {formatCurrency(summary?.income.fixed ?? 0)} • Thu thêm:{' '}
            {formatCurrency(summary?.income.extra ?? 0)}
          </span> */}
        </article>
        <article className="stat-card">
          <span className="stat-label">Đã chi thực tế</span>
          <strong>{formatCurrency(summary?.expenses.actualTotal ?? 0)}</strong>
        </article>
        <article className="stat-card">
          <span className="stat-label">Đang dành cho tương lai</span>
          <strong>{formatCurrency(summary?.expenses.reservedForFuture ?? 0)}</strong>
        </article>
        <article className="stat-card">
          <span className="stat-label">Thực còn dư</span>
          <strong>{formatCurrency(summary?.remainingBalance ?? 0)}</strong>
        </article>
      </div>

      <div className="panel category-card">
        <div className="section-heading">
          <div>
            <span className="section-kicker">So sánh tháng trước</span>
            <h3>{summary?.comparisonWithPreviousMonth.month || 'Chưa có dữ liệu'}</h3>
          </div>
        </div>
        <div className="spending-comparison-grid">
          <div>
            <span>Chênh lệch doanh thu</span>
            {renderDelta(summary?.comparisonWithPreviousMonth.incomeDelta ?? 0)}
          </div>
          <div>
            <span>Chênh lệch đã chi</span>
            {renderDelta(summary?.comparisonWithPreviousMonth.spendingDelta ?? 0)}
          </div>
          <div>
            <span>Chênh lệch dành trước</span>
            {renderDelta(summary?.comparisonWithPreviousMonth.reservedDelta ?? 0)}
          </div>
          <div>
            <span>Chênh lệch còn dư</span>
            {renderDelta(summary?.comparisonWithPreviousMonth.remainingDelta ?? 0)}
          </div>
        </div>
      </div>

      <div className="panel stack">
        <div className="section-heading">
          <div>
            <span className="section-kicker">Biểu đồ chi tiêu theo nhóm trong {formatMonthLabel(month)}</span>
          </div>
        </div>

        <div className="spending-chart">
          {categorySpending.length > 0 ? (
            categorySpending.map((item) => {
              const heightPercent =
                maxCategorySpend > 0 ? Math.max((item.totalSpent / maxCategorySpend) * 100, 8) : 8;

              return (
                <div className="spending-chart-item" key={item.categoryId}>
                  <div className="spending-chart-value">{formatCurrency(item.totalSpent)}</div>
                  <div className="spending-chart-bar-track">
                    <div
                      className="spending-chart-bar-fill"
                      style={{ height: `${heightPercent}%` }}
                      title={`${item.categoryName}: ${formatCurrency(item.totalSpent)}`}
                    />
                  </div>
                  <div className="spending-chart-label">{item.categoryName}</div>
                </div>
              );
            })
          ) : (
            <div className="spending-chart-empty">Chưa có dữ liệu để hiển thị biểu đồ chi tiêu tháng.</div>
          )}
        </div>
      </div>

      <div className="panel stack">
        <div className="section-heading">
          <div>
            <span className="section-kicker">Nhập liệu chi tiêu</span>
          </div>
        </div>

        <div className="spending-action-grid">
          <button
            type="button"
            className="primary-button"
            disabled={submitting}
            onClick={() => setActiveDialog('MONTHLY_INCOME')}
          >
            Doanh thu tháng
          </button>
          <button
            type="button"
            className="primary-button"
            disabled={submitting}
            onClick={() => setActiveDialog('EXTRA_INCOME')}
          >
            Khoản thu ngoài
          </button>
          <button
            type="button"
            className="primary-button"
            disabled={submitting}
            onClick={() => setActiveDialog('EXPENSE_CATEGORY')}
          >
            Nhóm chi tiêu
          </button>
          <button
            type="button"
            className="primary-button"
            disabled={submitting}
            onClick={() => setActiveDialog('RECURRING_EXPENSE')}
          >
            Khoản chi định kỳ
          </button>
          <button
            type="button"
            className="primary-button"
            disabled={submitting}
            onClick={() => setActiveDialog('EXPENSE_ENTRY')}
          >
            Chi tiêu thực tế
          </button>
        </div>
      </div>

      <div className="spending-layout">
        <div className="panel stack category-card vw-80">
          <div className="section-heading">
            <div>
              <span className="section-kicker">Tổng Doanh thu</span>
            </div>
          </div>

          <div className="spending-summary-list">
            <div className="spending-summary-item">
              <span>Doanh thu cố định</span>
              <strong>{formatCurrency(summary?.income.fixed ?? 0)}</strong>
            </div>
            <div className="spending-summary-item">
              <span>Tổng khoản thu ngoài</span>
              <strong>{formatCurrency(summary?.income.extra ?? 0)}</strong>
            </div>
            <div className="spending-summary-item">
              <span>Tổng doanh thu tháng</span>
              <strong>{formatCurrency(summary?.income.total ?? 0)}</strong>
            </div>
          </div>

          <div className="table-wrapper mt-2">
            <table>
              <thead>
                <tr>
                  <th>Khoản thu</th>
                  <th>Ngày</th>
                  <th>Số tiền</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {extraIncomeItems.map((item: ExtraIncomeItem) => (
                  <tr key={item.id}>
                    <td>
                      <div className="asset-cell">
                        <strong>{item.title}</strong>
                        <span>{item.note || 'Không có ghi chú'}</span>
                      </div>
                    </td>
                    <td>{formatDateTime(item.receivedAt)}</td>
                    <td>{formatCurrency(item.amount)}</td>
                    <td className="cell-actions">
                      <button
                        type="button"
                        className="danger-button icon-button"
                        disabled={submitting}
                        aria-label="Xóa khoản thu ngoài"
                        title="Xóa khoản thu ngoài"
                        onClick={() =>
                          setDeleteDialog({
                            type: 'EXTRA_INCOME',
                            id: item.id,
                            title: item.title,
                          })
                        }
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                ))}
                {extraIncomeItems.length === 0 ? (
                  <tr>
                    <td colSpan={4}>Chưa có khoản thu ngoài trong tháng này.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel stack category-card vw-80">
          <div className="section-heading">
            <div>
              <span className="section-kicker">Khoản chi định kỳ</span>
            </div>
          </div>

          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Khoản chi</th>
                  <th>Chu kỳ</th>
                  <th>Số tiền</th>
                  <th>Nhóm</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {recurringExpenses.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div className="asset-cell">
                        <strong>{item.title}</strong>
                        <span>{item.note || 'Không có ghi chú'}</span>
                      </div>
                    </td>
                    <td>
                      <div className="asset-cell">
                        <strong>{frequencyLabels[item.frequency]}</strong>
                        <span>{formatSchedule(item)}</span>
                      </div>
                    </td>
                    <td>{formatCurrency(item.amount)}</td>
                    <td>{item.category?.name ?? 'Chưa có nhóm'}</td>
                    <td className="cell-actions">
                      <button
                        type="button"
                        className="secondary-button icon-button"
                        disabled={submitting}
                        aria-label="Nhập nhanh"
                        title="Nhập nhanh"
                        onClick={() => {
                          onPrefillExpenseEntryFromRecurring(item);
                          setActiveDialog('EXPENSE_ENTRY');
                        }}
                      >
                        ⚡
                      </button>
                      <button
                        type="button"
                        className="secondary-button icon-button"
                        disabled={submitting}
                        aria-label={item.isActive ? 'Tạm dừng khoản chi định kỳ' : 'Bật lại khoản chi định kỳ'}
                        title={item.isActive ? 'Tạm dừng khoản chi định kỳ' : 'Bật lại khoản chi định kỳ'}
                        onClick={() => onToggleRecurringExpense(item)}
                      >
                        {item.isActive ? '⏸️' : '▶️'}
                      </button>
                      <button
                        type="button"
                        className="danger-button icon-button"
                        disabled={submitting}
                        aria-label="Xóa khoản chi định kỳ"
                        title="Xóa khoản chi định kỳ"
                        onClick={() =>
                          setDeleteDialog({
                            type: 'RECURRING_EXPENSE',
                            id: item.id,
                            title: item.title,
                          })
                        }
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                ))}
                {recurringExpenses.length === 0 ? (
                  <tr>
                    <td colSpan={5}>Chưa có khoản chi định kỳ nào.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel stack category-card vw-80">
          <div className="section-heading">
            <div>
              <span className="section-kicker">Danh sách chi tiêu</span>
            </div>
          </div>

          {selectedRecurringExpense ? (
            <div className="inline-hint">
              Đang dùng mẫu nhanh từ khoản định kỳ: <strong>{selectedRecurringExpense.title}</strong>
            </div>
          ) : null}

          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Nội dung</th>
                  <th>Ngày</th>
                  <th>Số tiền</th>
                  <th>Nhóm</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {expenseEntries.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div className="asset-cell">
                        <strong>{item.title}</strong>
                        <span>
                          {item.recurringExpense
                            ? `Từ mẫu: ${item.recurringExpense.title}`
                            : item.note || 'Không có ghi chú'}
                        </span>
                      </div>
                    </td>
                    <td>{formatDateTime(item.spentAt)}</td>
                    <td>{formatCurrency(item.amount)}</td>
                    <td>{item.category?.name ?? 'Chưa có nhóm'}</td>
                    <td className="cell-actions">
                      <button
                        type="button"
                        className="danger-button icon-button"
                        disabled={submitting}
                        aria-label="Xóa chi tiêu thực tế"
                        title="Xóa chi tiêu thực tế"
                        onClick={() =>
                          setDeleteDialog({
                            type: 'EXPENSE_ENTRY',
                            id: item.id,
                            title: item.title,
                          })
                        }
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                ))}
                {expenseEntries.length === 0 ? (
                  <tr>
                    <td colSpan={5}>Chưa có chi tiêu thực tế trong tháng này.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel stack category-card vw-80">
          <div className="section-heading">
            <div>
              <span className="section-kicker">Tổng hợp chi tiêu tháng</span>
            </div>
          </div>

          <div className="spending-category-list">
            {categorySpending.map((item) => (
              <div className="spending-category-item" key={item.categoryId}>
                <span>{item.categoryName}</span>
                <strong>{formatCurrency(item.totalSpent)}</strong>
              </div>
            ))}
            {categorySpending.length === 0 ? (
              <div className="spending-category-item">
                <span>Chưa có dữ liệu nhóm chi tiêu</span>
                <strong>{formatCurrency(0)}</strong>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {activeDialog === 'MONTHLY_INCOME' ? (
        <DialogShell
          title=""
          subtitle="Doanh thu cố định theo tháng"
          onClose={() => setActiveDialog(null)}
        >
          <div className="form-grid">
            <label>
              <span>Tháng</span>
              <input
                type="month"
                value={monthlyIncomeForm.month}
                onChange={(event) =>
                  onMonthlyIncomeFormChange({
                    ...monthlyIncomeForm,
                    month: event.target.value,
                  })
                }
              />
            </label>
            <label>
              <span>Số tiền</span>
              <input
                type="text"
                inputMode="numeric"
                value={formatCurrencyInputValue(monthlyIncomeForm.amount)}
                onChange={(event) =>
                  onMonthlyIncomeFormChange({
                    ...monthlyIncomeForm,
                    amount: sanitizeCurrencyInput(event.target.value),
                  })
                }
              />
            </label>
            <label className="form-grid-full">
              <span>Ghi chú</span>
              <input
                type="text"
                value={monthlyIncomeForm.note}
                onChange={(event) =>
                  onMonthlyIncomeFormChange({
                    ...monthlyIncomeForm,
                    note: event.target.value,
                  })
                }
              />
            </label>
          </div>
          <div className="spending-dialog-actions">
            <button type="button" className="secondary-button" onClick={() => setActiveDialog(null)}>
              Hủy
            </button>
            <button
              type="button"
              className="primary-button"
              disabled={submitting}
              onClick={() => {
                onSubmitMonthlyIncome();
                setActiveDialog(null);
              }}
            >
              Lưu doanh thu tháng
            </button>
          </div>
        </DialogShell>
      ) : null}

      {activeDialog === 'EXTRA_INCOME' ? (
        <DialogShell
          title=""
          subtitle="Thêm khoản thu ngoài"
          onClose={() => setActiveDialog(null)}
        >
          <div className="form-grid">
            <label>
              <span>Số tiền</span>
              <input
                type="text"
                inputMode="numeric"
                value={formatCurrencyInputValue(extraIncomeForm.amount)}
                onChange={(event) =>
                  onExtraIncomeFormChange({
                    ...extraIncomeForm,
                    amount: sanitizeCurrencyInput(event.target.value),
                  })
                }
              />
            </label>
            <label>
              <span>Ngày nhận</span>
              <input
                type="date"
                value={extraIncomeForm.receivedAt}
                onChange={(event) =>
                  onExtraIncomeFormChange({
                    ...extraIncomeForm,
                    receivedAt: event.target.value,
                  })
                }
              />
            </label>
            <label className="form-grid-full">
              <span>Nội dung</span>
              <input
                type="text"
                value={extraIncomeForm.title}
                onChange={(event) =>
                  onExtraIncomeFormChange({
                    ...extraIncomeForm,
                    title: event.target.value,
                  })
                }
              />
            </label>
            <label className="form-grid-full">
              <span>Ghi chú</span>
              <input
                type="text"
                value={extraIncomeForm.note}
                onChange={(event) =>
                  onExtraIncomeFormChange({
                    ...extraIncomeForm,
                    note: event.target.value,
                  })
                }
              />
            </label>
          </div>
          <div className="spending-dialog-actions">
            <button type="button" className="secondary-button" onClick={() => setActiveDialog(null)}>
              Hủy
            </button>
            <button
              type="button"
              className="primary-button"
              disabled={submitting}
              onClick={() => {
                onSubmitExtraIncome();
                setActiveDialog(null);
              }}
            >
              Thêm khoản thu ngoài
            </button>
          </div>
        </DialogShell>
      ) : null}

      {activeDialog === 'EXPENSE_CATEGORY' ? (
        <DialogShell
          title=""
          subtitle="Thêm nhóm chi tiêu"
          onClose={() => setActiveDialog(null)}
        >
          <div className="form-grid">
            <label>
              <span>Tên nhóm</span>
              <input
                type="text"
                value={expenseCategoryForm.name}
                onChange={(event) =>
                  onExpenseCategoryFormChange({
                    ...expenseCategoryForm,
                    name: event.target.value,
                  })
                }
              />
            </label>
            <label>
              <span>Màu</span>
              <input
                type="color"
                className='color-picker'
                value={expenseCategoryForm.color}
                onChange={(event) =>
                  onExpenseCategoryFormChange({
                    ...expenseCategoryForm,
                    color: event.target.value,
                  })
                }
              />
            </label>
          </div>
          <div className="spending-dialog-actions">
            <button type="button" className="secondary-button" onClick={() => setActiveDialog(null)}>
              Hủy
            </button>
            <button
              type="button"
              className="primary-button"
              disabled={submitting}
              onClick={() => {
                onSubmitExpenseCategory();
                setActiveDialog(null);
              }}
            >
              Thêm nhóm chi tiêu
            </button>
          </div>
        </DialogShell>
      ) : null}

      {activeDialog === 'RECURRING_EXPENSE' ? (
        <DialogShell
          title=""
          subtitle="Tạo khoản chi định kỳ"
          onClose={() => setActiveDialog(null)}
        >
          <div className="form-grid">
            <label>
              <span>Nhóm chi tiêu</span>
              <select
                value={recurringExpenseForm.categoryId}
                onChange={(event) =>
                  onRecurringExpenseFormChange({
                    ...recurringExpenseForm,
                    categoryId: event.target.value,
                  })
                }
              >
                <option value="">Chọn nhóm</option>
                {categories.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Chu kỳ</span>
              <select
                value={recurringExpenseForm.frequency}
                onChange={(event) =>
                  onRecurringExpenseFormChange({
                    ...recurringExpenseForm,
                    frequency: event.target.value as ExpenseFrequency,
                  })
                }
              >
                {Object.entries(frequencyLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-grid-full">
              <span>Nội dung</span>
              <input
                type="text"
                value={recurringExpenseForm.title}
                onChange={(event) =>
                  onRecurringExpenseFormChange({
                    ...recurringExpenseForm,
                    title: event.target.value,
                  })
                }
              />
            </label>
            <label>
              <span>Số tiền</span>
              <input
                type="text"
                inputMode="numeric"
                value={formatCurrencyInputValue(recurringExpenseForm.amount)}
                onChange={(event) =>
                  onRecurringExpenseFormChange({
                    ...recurringExpenseForm,
                    amount: sanitizeCurrencyInput(event.target.value),
                  })
                }
              />
            </label>
            <label>
              <span>Ngày bắt đầu</span>
              <input
                type="date"
                value={recurringExpenseForm.startDate}
                onChange={(event) =>
                  onRecurringExpenseFormChange({
                    ...recurringExpenseForm,
                    startDate: event.target.value,
                  })
                }
              />
            </label>
            {recurringExpenseForm.frequency === 'WEEKLY' ? (
              <label>
                <span>Thứ</span>
                <select
                  value={recurringExpenseForm.dayOfWeek}
                  onChange={(event) =>
                    onRecurringExpenseFormChange({
                      ...recurringExpenseForm,
                      dayOfWeek: event.target.value,
                    })
                  }
                >
                  <option value="">Chọn thứ</option>
                  {weekdayLabels.map((label, index) => (
                    <option key={label} value={index}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {recurringExpenseForm.frequency === 'MONTHLY' ||
            recurringExpenseForm.frequency === 'YEARLY' ? (
              <label>
                <span>Ngày trong tháng</span>
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={recurringExpenseForm.dayOfMonth}
                  onChange={(event) =>
                    onRecurringExpenseFormChange({
                      ...recurringExpenseForm,
                      dayOfMonth: event.target.value,
                    })
                  }
                />
              </label>
            ) : null}
            {recurringExpenseForm.frequency === 'YEARLY' ? (
              <label>
                <span>Tháng trong năm</span>
                <input
                  type="number"
                  min="1"
                  max="12"
                  value={recurringExpenseForm.monthOfYear}
                  onChange={(event) =>
                    onRecurringExpenseFormChange({
                      ...recurringExpenseForm,
                      monthOfYear: event.target.value,
                    })
                  }
                />
              </label>
            ) : null}
            <label>
              <span>Ngày kết thúc</span>
              <input
                type="date"
                value={recurringExpenseForm.endDate}
                onChange={(event) =>
                  onRecurringExpenseFormChange({
                    ...recurringExpenseForm,
                    endDate: event.target.value,
                  })
                }
              />
            </label>
            <label className="form-grid-full">
              <span>Ghi chú</span>
              <input
                type="text"
                value={recurringExpenseForm.note}
                onChange={(event) =>
                  onRecurringExpenseFormChange({
                    ...recurringExpenseForm,
                    note: event.target.value,
                  })
                }
              />
            </label>
          </div>
          <div className="spending-dialog-actions">
            <button type="button" className="secondary-button" onClick={() => setActiveDialog(null)}>
              Hủy
            </button>
            <button
              type="button"
              className="primary-button"
              disabled={submitting}
              onClick={() => {
                onSubmitRecurringExpense();
                setActiveDialog(null);
              }}
            >
              Tạo khoản chi định kỳ
            </button>
          </div>
        </DialogShell>
      ) : null}

      {activeDialog === 'EXPENSE_ENTRY' ? (
        <DialogShell
          title=""
          subtitle="Thêm chi tiêu thực tế"
          onClose={() => setActiveDialog(null)}
        >
          <div className="form-grid">
            <label>
              <span>Khoản chi định kỳ</span>
              <select
                value={expenseEntryForm.recurringExpenseId}
                onChange={(event) => {
                  const nextRecurringExpenseId = event.target.value;
                  const matchedRecurring =
                    recurringExpenses.find((item) => String(item.id) === nextRecurringExpenseId) ??
                    null;

                  onExpenseEntryFormChange({
                    ...expenseEntryForm,
                    recurringExpenseId: nextRecurringExpenseId,
                    categoryId: matchedRecurring
                      ? String(matchedRecurring.categoryId)
                      : expenseEntryForm.categoryId,
                    amount: matchedRecurring
                      ? String(matchedRecurring.amount)
                      : expenseEntryForm.amount,
                    title: matchedRecurring ? matchedRecurring.title : expenseEntryForm.title,
                    note: matchedRecurring?.note ?? expenseEntryForm.note,
                  });
                }}
              >
                <option value="">Chọn để nhập nhanh</option>
                {recurringOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Nhóm chi tiêu</span>
              <select
                value={expenseEntryForm.categoryId}
                onChange={(event) =>
                  onExpenseEntryFormChange({
                    ...expenseEntryForm,
                    categoryId: event.target.value,
                  })
                }
              >
                <option value="">Chọn nhóm</option>
                {categories.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-grid-full">
              <span>Nội dung</span>
              <input
                type="text"
                value={expenseEntryForm.title}
                onChange={(event) =>
                  onExpenseEntryFormChange({
                    ...expenseEntryForm,
                    title: event.target.value,
                  })
                }
              />
            </label>
            <label>
              <span>Số tiền</span>
              <input
                type="text"
                inputMode="numeric"
                value={formatCurrencyInputValue(expenseEntryForm.amount)}
                onChange={(event) =>
                  onExpenseEntryFormChange({
                    ...expenseEntryForm,
                    amount: sanitizeCurrencyInput(event.target.value),
                  })
                }
              />
            </label>
            <label>
              <span>Ngày</span>
              <input
                type="date"
                value={expenseEntryForm.spentAt}
                onChange={(event) =>
                  onExpenseEntryFormChange({
                    ...expenseEntryForm,
                    spentAt: event.target.value,
                  })
                }
              />
            </label>
            <label className="form-grid-full">
              <span>Ghi chú</span>
              <input
                type="text"
                value={expenseEntryForm.note}
                onChange={(event) =>
                  onExpenseEntryFormChange({
                    ...expenseEntryForm,
                    note: event.target.value,
                  })
                }
              />
            </label>
          </div>

          {selectedRecurringExpense ? (
            <div className="inline-hint">
              Đang dùng mẫu nhanh từ khoản định kỳ: <strong>{selectedRecurringExpense.title}</strong>
            </div>
          ) : null}

          <div className="spending-dialog-actions">
            <button type="button" className="secondary-button" onClick={() => setActiveDialog(null)}>
              Hủy
            </button>
            <button
              type="button"
              className="primary-button"
              disabled={submitting}
              onClick={() => {
                onSubmitExpenseEntry();
                setActiveDialog(null);
              }}
            >
              Lưu chi tiêu thực tế
            </button>
          </div>
        </DialogShell>
      ) : null}

      {deleteDialog ? (
        <DialogShell
          title="Xác nhận xóa"
          subtitle="Cảnh báo"
          onClose={() => setDeleteDialog(null)}
        >
          <div className="spending-confirm-content">
            <p>
              Bạn có chắc muốn xóa <strong>{deleteDialog.title}</strong>?
            </p>
            <p>Thao tác này không thể hoàn tác.</p>
          </div>
          <div className="spending-dialog-actions">
            <button type="button" className="secondary-button" onClick={() => setDeleteDialog(null)}>
              Hủy
            </button>
            <button
              type="button"
              className="danger-button"
              disabled={submitting}
              onClick={handleConfirmDelete}
            >
              Xóa
            </button>
          </div>
        </DialogShell>
      ) : null}
    </section>
  );
}