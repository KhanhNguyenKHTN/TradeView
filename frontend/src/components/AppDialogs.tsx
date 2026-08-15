import type { FormEvent } from 'react';
import type {
  AssetFormState,
  AssetOption,
  Category,
  CategoryCode,
  LatestTransaction,
  PriceFormState,
  PriceSource,
  TaskFormValues,
  TaskItem,
  TaskPriority,
  TaskStatus,
  TransactionFormState,
  TransactionType,
} from '../types/app';
import { formatDateTime } from '../utils/appFormatters';

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

type DeleteTransactionDialogProps = {
  transaction: LatestTransaction;
  submitting: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

type DeleteTaskDialogProps = {
  open: boolean;
  task: TaskItem | null;
  submitting: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

type TaskStatusPriorityDialogProps = {
  open: boolean;
  task: TaskItem | null;
  submitting: boolean;
  status: TaskStatus;
  priority: TaskPriority;
  onClose: () => void;
  onStatusChange: (status: TaskStatus) => void;
  onPriorityChange: (priority: TaskPriority) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function DeleteTransactionDialog({
  transaction,
  submitting,
  onClose,
  onConfirm,
}: DeleteTransactionDialogProps) {
  return (
    <div
      className="dialog-overlay"
      onClick={() => {
        if (!submitting) {
          onClose();
        }
      }}
    >
      <div className="dialog-panel" onClick={(event) => event.stopPropagation()}>
        <div className="section-heading">
          <div className="center">
            <span className="section-kicker">Xóa giao dịch</span>
          </div>
          <button
            type="button"
            className="dialog-close"
            onClick={onClose}
            disabled={submitting}
          >
            X
          </button>
        </div>

        <div className="quick-actions-hint mt-2">
          <p>
            Bạn có chắc muốn xóa giao dịch của <strong>{transaction.asset.name}</strong> (
            {transaction.asset.symbol}) tại thời điểm{' '}
            <strong>{formatDateTime(transaction.executedAt)}</strong>?
          </p>
          <p>Thao tác này không thể hoàn tác.</p>
        </div>

        <div className="row mt-2">
          <button
            type="button"
            className="secondary-button"
            onClick={onClose}
            disabled={submitting}
          >
            Hủy
          </button>
          <button
            type="button"
            className="primary-button"
            onClick={onConfirm}
            disabled={submitting}
          >
            Xác nhận xóa
          </button>
        </div>
      </div>
    </div>
  );
}

type TransactionDialogProps = {
  open: boolean;
  submitting: boolean;
  form: TransactionFormState;
  assetOptions: AssetOption[];
  isSavingTransaction: boolean;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onChange: (updater: (current: TransactionFormState) => TransactionFormState) => void;
};

export function TransactionDialog({
  open,
  submitting,
  form,
  assetOptions,
  isSavingTransaction,
  onClose,
  onSubmit,
  onChange,
}: TransactionDialogProps) {
  if (!open) {
    return null;
  }

  return (
    <div
      className="dialog-overlay"
      onClick={() => {
        if (!submitting) {
          onClose();
        }
      }}
    >
      <div className="dialog-panel" onClick={(event) => event.stopPropagation()}>
        <div className="section-heading mb-2">
          <div className="center">
            <span className="section-kicker">Nhập giao dịch mới</span>
          </div>
          <button
            type="button"
            className="dialog-close"
            onClick={onClose}
            disabled={submitting}
          >
            X
          </button>
        </div>

        <form className="form-grid mt-2" onSubmit={onSubmit}>
          <label>
            Tài sản
            <select
              value={form.assetId}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  assetId: event.target.value,
                }))
              }
              disabled={submitting || assetOptions.length === 0}
            >
              {assetOptions.length === 0 ? (
                <option value="">Chưa có tài sản, hãy tạo mới trước</option>
              ) : null}
              {assetOptions.map((asset) => (
                <option key={asset.id} value={asset.value}>
                  {asset.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            Loại giao dịch
            <select
              value={form.type}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  type: event.target.value as TransactionType,
                }))
              }
              disabled={submitting}
            >
              <option value="BUY">{isSavingTransaction ? 'Mở sổ' : 'Mua'}</option>
              <option value="SELL">{isSavingTransaction ? 'Đóng sổ' : 'Bán'}</option>
            </select>
          </label>

          <label>
            Số lượng
            <input
              type="number"
              min="0"
              step="0.0001"
              placeholder="0.00"
              value={form.quantity}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  quantity: event.target.value,
                }))
              }
              disabled={submitting}
              required
            />
          </label>

          <label>
            {isSavingTransaction ? 'Lãi suất năm (%)' : 'Giá khớp lệnh'}
            <input
              type={isSavingTransaction ? 'number' : 'text'}
              min="0"
              step={isSavingTransaction ? '0.01' : undefined}
              inputMode={isSavingTransaction ? undefined : 'numeric'}
              placeholder={isSavingTransaction ? 'Ví dụ: 5.8' : '0'}
              value={
                isSavingTransaction ? form.price : formatCurrencyInputValue(form.price)
              }
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  price: isSavingTransaction
                    ? event.target.value
                    : sanitizeCurrencyInput(event.target.value),
                }))
              }
              disabled={submitting}
              required
            />
          </label>

          <label>
            Phí giao dịch
            <input
              type="text"
              inputMode="numeric"
              placeholder="0"
              value={formatCurrencyInputValue(form.fee)}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  fee: sanitizeCurrencyInput(event.target.value),
                }))
              }
              disabled={submitting}
            />
          </label>

          <label>
            {isSavingTransaction ? 'Ngày mở sổ' : 'Ngày giao dịch'}
            <input
              type="date"
              value={form.executedAt}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  executedAt: event.target.value,
                }))
              }
              disabled={submitting}
              required
            />
          </label>

          {isSavingTransaction ? (
            <label>
              Ngày tất toán
              <input
                type="date"
                value={form.settledAt}
                onChange={(event) =>
                  onChange((current) => ({
                    ...current,
                    settledAt: event.target.value,
                  }))
                }
                disabled={submitting}
              />
            </label>
          ) : null}

          <label className="full-width">
            Ghi chú
            <textarea
              rows={4}
              placeholder={
                isSavingTransaction
                  ? 'Ví dụ: sổ 6 tháng, lĩnh lãi cuối kỳ'
                  : 'Ví dụ: mua tích lũy dài hạn'
              }
              value={form.note}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  note: event.target.value,
                }))
              }
              disabled={submitting}
            />
          </label>

          <button
            type="submit"
            className="primary-button"
            disabled={submitting || assetOptions.length === 0}
          >
            Lưu giao dịch
          </button>
        </form>
      </div>
    </div>
  );
}

type PriceDialogProps = {
  open: boolean;
  submitting: boolean;
  form: PriceFormState;
  assetOptions: AssetOption[];
  isAutoGoldPriceUpdate: boolean;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onChange: (updater: (current: PriceFormState) => PriceFormState) => void;
};

export function PriceDialog({
  open,
  submitting,
  form,
  assetOptions,
  isAutoGoldPriceUpdate,
  onClose,
  onSubmit,
  onChange,
}: PriceDialogProps) {
  if (!open) {
    return null;
  }

  return (
    <div
      className="dialog-overlay"
      onClick={() => {
        if (!submitting) {
          onClose();
        }
      }}
    >
      <div className="dialog-panel" onClick={(event) => event.stopPropagation()}>
        <div className="section-heading">
          <div>
            <span className="section-kicker">Giá thị trường</span>
          </div>
          <button
            type="button"
            className="dialog-close"
            onClick={onClose}
            disabled={submitting}
          >
            X
          </button>
        </div>

        <form className="form-grid" onSubmit={onSubmit}>
          <label>
            Tài sản
            <select
              value={form.assetId}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  assetId: event.target.value,
                }))
              }
              disabled={submitting || assetOptions.length === 0}
            >
              {assetOptions.length === 0 ? (
                <option value="">Không có tài sản cần cập nhật giá</option>
              ) : null}
              {assetOptions.map((asset) => (
                <option key={asset.id} value={asset.value}>
                  {asset.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            Nguồn giá
            <select
              value={form.source}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  source: event.target.value as PriceSource,
                }))
              }
              disabled={submitting}
            >
              <option value="AUTO">AUTO</option>
              <option value="MANUAL">MANUAL</option>
            </select>
          </label>

          <label>
            Giá hiện tại
            <input
              type="text"
              inputMode="numeric"
              placeholder={
                isAutoGoldPriceUpdate ? 'Giá sẽ được lấy tự động từ web vàng' : '0'
              }
              value={formatCurrencyInputValue(form.price)}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  price: sanitizeCurrencyInput(event.target.value),
                }))
              }
              disabled={submitting || isAutoGoldPriceUpdate}
              required={!isAutoGoldPriceUpdate}
            />
            {isAutoGoldPriceUpdate ? (
              <span className="input-preview">
                Chế độ AUTO sẽ lấy giá mua vàng nhẫn khâu 9999 và tự tính lại dashboard.
              </span>
            ) : null}
          </label>

          <label>
            Thời điểm ghi nhận
            <input
              type="datetime-local"
              value={form.capturedAt}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  capturedAt: event.target.value,
                }))
              }
              disabled={submitting}
              required
            />
          </label>

          <button
            type="submit"
            className="primary-button"
            disabled={submitting || assetOptions.length === 0}
          >
            Cập nhật giá
          </button>
        </form>
      </div>
    </div>
  );
}

type AssetDialogProps = {
  open: boolean;
  submitting: boolean;
  form: AssetFormState;
  categories: Category[];
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onChange: (updater: (current: AssetFormState) => AssetFormState) => void;
};

const taskStatusOptions: Array<{ value: TaskStatus; label: string }> = [
  { value: 'TODO', label: 'Cần làm' },
  { value: 'IN_PROGRESS', label: 'Đang làm' },
  { value: 'DONE', label: 'Hoàn thành' },
  { value: 'BLOCKED', label: 'Tạm dừng' },
];

const taskPriorityOptions: Array<{ value: TaskPriority; label: string }> = [
  { value: 'LOW', label: 'Thấp' },
  { value: 'MEDIUM', label: 'Trung bình' },
  { value: 'HIGH', label: 'Cao' },
  { value: 'URGENT', label: 'Khẩn cấp' },
];

type TaskDialogProps = {
  open: boolean;
  submitting: boolean;
  title: string;
  submitLabel: string;
  form: TaskFormValues;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onChange: (updater: (current: TaskFormValues) => TaskFormValues) => void;
};

export function TaskDialog({
  open,
  submitting,
  title,
  submitLabel,
  form,
  onClose,
  onSubmit,
  onChange,
}: TaskDialogProps) {
  if (!open) {
    return null;
  }

  return (
    <div
      className="dialog-overlay"
      onClick={() => {
        if (!submitting) {
          onClose();
        }
      }}
    >
      <div className="dialog-panel" onClick={(event) => event.stopPropagation()}>
        <div className="section-heading mb-2">
          <div>
            <span className="section-kicker">{title}</span>
          </div>
          <button
            type="button"
            className="dialog-close"
            onClick={onClose}
            disabled={submitting}
          >
            X
          </button>
        </div>

        <form className="form-grid mt-2" onSubmit={onSubmit}>
          <label>
            Tên task
            <input
              type="text"
              placeholder="Ví dụ: Chuẩn bị ngân sách tháng tới"
              value={form.title}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  title: event.target.value,
                }))
              }
              disabled={submitting}
              required
            />
          </label>

          <label>
            Nhóm task
            <input
              type="text"
              placeholder="Ví dụ: Kế hoạch tài chính"
              value={form.category}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  category: event.target.value,
                }))
              }
              disabled={submitting}
              required
            />
          </label>

          <label>
            Người phụ trách
            <input
              type="text"
              placeholder="Ví dụ: Khánh"
              value={form.owner}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  owner: event.target.value,
                }))
              }
              disabled={submitting}
              required
            />
          </label>

          <label>
            Hạn hoàn thành
            <input
              type="datetime-local"
              value={form.dueDate}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  dueDate: event.target.value,
                }))
              }
              disabled={submitting}
              required
            />
          </label>

          <label>
            Trạng thái
            <select
              value={form.status}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  status: event.target.value as TaskStatus,
                }))
              }
              disabled={submitting}
            >
              {taskStatusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            Ưu tiên
            <select
              value={form.priority}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  priority: event.target.value as TaskPriority,
                }))
              }
              disabled={submitting}
            >
              {taskPriorityOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="full-width">
            Mô tả
            <textarea
              rows={3}
              placeholder="Mô tả ngắn gọn task cần thực hiện..."
              value={form.description}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
              disabled={submitting}
            />
          </label>

          <label className="full-width">
            Ghi chú
            <textarea
              rows={4}
              placeholder="Cập nhật tình hình xử lý task..."
              value={form.note}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  note: event.target.value,
                }))
              }
              disabled={submitting}
            />
          </label>

          <label>
            Kế hoạch tài chính
            <select
              value={form.isFinancialPlan ? 'YES' : 'NO'}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  isFinancialPlan: event.target.value === 'YES',
                  financialTargetAmount:
                    event.target.value === 'YES'
                      ? current.financialTargetAmount || '0'
                      : '0',
                  financialCurrentAmount:
                    event.target.value === 'YES'
                      ? current.financialCurrentAmount || '0'
                      : '0',
                  progress: event.target.value === 'YES' ? current.progress || '0' : '0',
                }))
              }
              disabled={submitting}
            >
              <option value="NO">Không</option>
              <option value="YES">Có</option>
            </select>
          </label>

          {form.isFinancialPlan ? (
            <>
              <label>
                Mục tiêu tài chính
                <input
                  type="text"
                  inputMode="numeric"
                  value={formatCurrencyInputValue(form.financialTargetAmount)}
                  onChange={(event) =>
                    onChange((current) => {
                      const financialTargetAmount = sanitizeCurrencyInput(event.target.value);
                      const target = Number(financialTargetAmount || 0);
                      const currentAmount = Number(current.financialCurrentAmount || 0);
                      const progress =
                        target > 0
                          ? String(Math.min(100, Math.max(0, Math.round((currentAmount / target) * 100))))
                          : '0';

                      return {
                        ...current,
                        financialTargetAmount,
                        progress,
                      };
                    })
                  }
                  disabled={submitting}
                />
              </label>

              <label>
                Số tiền hiện có
                <input
                  type="text"
                  inputMode="numeric"
                  value={formatCurrencyInputValue(form.financialCurrentAmount)}
                  onChange={(event) =>
                    onChange((current) => {
                      const financialCurrentAmount = sanitizeCurrencyInput(event.target.value);
                      const target = Number(current.financialTargetAmount || 0);
                      const currentAmount = Number(financialCurrentAmount || 0);
                      const progress =
                        target > 0
                          ? String(Math.min(100, Math.max(0, Math.round((currentAmount / target) * 100))))
                          : '0';

                      return {
                        ...current,
                        financialCurrentAmount,
                        progress,
                      };
                    })
                  }
                  disabled={submitting}
                />
              </label>

              <label>
                Tiến độ (%)
                <input type="number" value={form.progress} disabled />
              </label>
            </>
          ) : (
            <div />
          )}

          <div>
          </div>
          <button type="submit" className="primary-button" disabled={submitting}>
            {submitLabel}
          </button>
        </form>
      </div>
    </div>
  );
}

export function DeleteTaskDialog({
  open,
  task,
  submitting,
  onClose,
  onConfirm,
}: DeleteTaskDialogProps) {
  if (!open || !task) {
    return null;
  }

  return (
    <div
      className="dialog-overlay"
      onClick={() => {
        if (!submitting) {
          onClose();
        }
      }}
    >
      <div className="dialog-panel" onClick={(event) => event.stopPropagation()}>
        <div className="section-heading">
          <div className="center">
            <span className="section-kicker">Xóa task</span>
          </div>
          <button
            type="button"
            className="dialog-close"
            onClick={onClose}
            disabled={submitting}
          >
            X
          </button>
        </div>

        <div className="quick-actions-hint mt-2">
          <p>
            Bạn có chắc muốn xóa task <strong>{task.title}</strong>?
          </p>
          <p>Thao tác này không thể hoàn tác.</p>
        </div>

        <div className="row mt-2">
          <button
            type="button"
            className="secondary-button"
            onClick={onClose}
            disabled={submitting}
          >
            Hủy
          </button>
          <button
            type="button"
            className="primary-button"
            onClick={onConfirm}
            disabled={submitting}
          >
            Xác nhận xóa
          </button>
        </div>
      </div>
    </div>
  );
}

export function TaskStatusPriorityDialog({
  open,
  task,
  submitting,
  status,
  priority,
  onClose,
  onStatusChange,
  onPriorityChange,
  onSubmit,
}: TaskStatusPriorityDialogProps) {
  if (!open || !task) {
    return null;
  }

  return (
    <div
      className="dialog-overlay"
      onClick={() => {
        if (!submitting) {
          onClose();
        }
      }}
    >
      <div className="dialog-panel" onClick={(event) => event.stopPropagation()}>
        <div className="section-heading mb-2">
          <div>
            <span className="section-kicker">Cập nhật nhanh</span>
            <h2>{task.title}</h2>
          </div>
          <button
            type="button"
            className="dialog-close"
            onClick={onClose}
            disabled={submitting}
          >
            X
          </button>
        </div>

        <form className="form-grid mt-2" onSubmit={onSubmit}>
          <label>
            Trạng thái
            <select
              value={status}
              onChange={(event) => onStatusChange(event.target.value as TaskStatus)}
              disabled={submitting}
            >
              {taskStatusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            Ưu tiên
            <select
              value={priority}
              onChange={(event) => onPriorityChange(event.target.value as TaskPriority)}
              disabled={submitting}
            >
              {taskPriorityOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <div className="row full-width">
            <button
              type="button"
              className="secondary-button"
              onClick={onClose}
              disabled={submitting}
            >
              Hủy
            </button>
            <button type="submit" className="primary-button" disabled={submitting}>
              Lưu cập nhật
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function AssetDialog({
  open,
  submitting,
  form,
  categories,
  onClose,
  onSubmit,
  onChange,
}: AssetDialogProps) {
  if (!open) {
    return null;
  }

  return (
    <div
      className="dialog-overlay"
      onClick={() => {
        if (!submitting) {
          onClose();
        }
      }}
    >
      <div className="dialog-panel" onClick={(event) => event.stopPropagation()}>
        <div className="section-heading">
          <div>
            <span className="section-kicker">Danh mục mới</span>
            <h2>Thêm tài sản theo dõi</h2>
          </div>
          <button
            type="button"
            className="dialog-close"
            onClick={onClose}
            disabled={submitting}
          >
            X
          </button>
        </div>

        <form className="form-grid" onSubmit={onSubmit}>
          <label>
            Danh mục đầu tư
            <select
              value={form.categoryCode}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  categoryCode: event.target.value as CategoryCode,
                }))
              }
              disabled={submitting || categories.length === 0}
            >
              {categories.map((category) => (
                <option key={category.id} value={category.code}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Mã tài sản
            <input
              type="text"
              placeholder="BTC / FPT / SJC..."
              value={form.symbol}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  symbol: event.target.value,
                }))
              }
              disabled={submitting}
              required
            />
          </label>

          <label>
            Tên tài sản
            <input
              type="text"
              placeholder="Bitcoin, Vàng SJC..."
              value={form.name}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
              disabled={submitting}
              required
            />
          </label>

          <label>
            Đơn vị
            <input
              type="text"
              placeholder="coin, chỉ, cổ phiếu..."
              value={form.unit}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  unit: event.target.value,
                }))
              }
              disabled={submitting}
              required
            />
          </label>

          <label className="full-width">
            Ghi chú
            <textarea
              rows={3}
              placeholder="Mô tả thêm về tài sản"
              value={form.notes}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  notes: event.target.value,
                }))
              }
              disabled={submitting}
            />
          </label>

          <button
            type="submit"
            className="primary-button"
            disabled={submitting || categories.length === 0}
          >
            Tạo tài sản
          </button>
        </form>
      </div>
    </div>
  );
}