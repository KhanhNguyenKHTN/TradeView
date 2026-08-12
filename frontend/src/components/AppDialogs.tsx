import type { FormEvent } from 'react';
import type {
  AssetFormState,
  AssetOption,
  Category,
  CategoryCode,
  LatestTransaction,
  PriceFormState,
  PriceSource,
  TransactionFormState,
  TransactionType,
} from '../types/app';
import { formatCurrencyPreview, formatDateTime } from '../utils/appFormatters';

type DeleteTransactionDialogProps = {
  transaction: LatestTransaction;
  submitting: boolean;
  onClose: () => void;
  onConfirm: () => void;
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
              type="number"
              min="0"
              step="0.01"
              placeholder={isSavingTransaction ? 'Ví dụ: 5.8' : '0'}
              value={form.price}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  price: event.target.value,
                }))
              }
              disabled={submitting}
              required
            />
            {!isSavingTransaction && formatCurrencyPreview(form.price) ? (
              <span className="input-preview">{formatCurrencyPreview(form.price)}</span>
            ) : null}
          </label>

          <label>
            Phí giao dịch
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="0"
              value={form.fee}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  fee: event.target.value,
                }))
              }
              disabled={submitting}
            />
            {formatCurrencyPreview(form.fee) ? (
              <span className="input-preview">{formatCurrencyPreview(form.fee)}</span>
            ) : null}
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
              type="number"
              min="0"
              step="0.01"
              placeholder={
                isAutoGoldPriceUpdate ? 'Giá sẽ được lấy tự động từ web vàng' : '0'
              }
              value={form.price}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  price: event.target.value,
                }))
              }
              disabled={submitting || isAutoGoldPriceUpdate}
              required={!isAutoGoldPriceUpdate}
            />
            {isAutoGoldPriceUpdate ? (
              <span className="input-preview">
                Chế độ AUTO sẽ lấy giá mua vàng nhẫn khâu 9999 và tự tính lại dashboard.
              </span>
            ) : formatCurrencyPreview(form.price) ? (
              <span className="input-preview">{formatCurrencyPreview(form.price)}</span>
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