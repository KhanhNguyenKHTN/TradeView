import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import axios from 'axios';
import './App.css';

type CategoryCode = 'GOLD' | 'SAVING' | 'STOCK' | 'COIN';
type TransactionType = 'BUY' | 'SELL';
type PriceSource = 'AUTO' | 'MANUAL';

type Category = {
  id: number;
  code: CategoryCode;
  name: string;
  isEnabled: boolean;
};

type CategorySummary = {
  categoryCode: CategoryCode;
  categoryName: string;
  totalCost: number;
  totalMarketValue: number;
  totalProfitLoss: number;
};

type AssetSummary = {
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

type DashboardResponse = {
  totals: {
    totalCost: number;
    totalMarketValue: number;
    totalProfitLoss: number;
  };
  byCategory: CategorySummary[];
  assets: AssetSummary[];
};

type LatestTransaction = {
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

type LatestPrice = {
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

type AssetFormState = {
  categoryCode: CategoryCode;
  symbol: string;
  name: string;
  unit: string;
  notes: string;
};

type TransactionFormState = {
  assetId: string;
  type: TransactionType;
  quantity: string;
  price: string;
  fee: string;
  executedAt: string;
  settledAt: string;
  note: string;
};

type PriceFormState = {
  assetId: string;
  source: PriceSource;
  price: string;
  capturedAt: string;
};

const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL?.trim() || 'http://localhost:3000/api';

const api = axios.create({
  baseURL: apiBaseUrl,
});

const emptyDashboard: DashboardResponse = {
  totals: {
    totalCost: 0,
    totalMarketValue: 0,
    totalProfitLoss: 0,
  },
  byCategory: [],
  assets: [],
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('vi-VN', {
    maximumFractionDigits: 4,
  }).format(value);
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

function formatCurrencyPreview(value: string) {
  const normalizedValue = value.trim().replace(/,/g, '');
  const parsedValue = Number(normalizedValue);

  if (!normalizedValue || Number.isNaN(parsedValue)) {
    return '';
  }

  return formatCurrency(parsedValue);
}

function toDateInputValue(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function toDateTimeLocalValue(date = new Date()) {
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60 * 1000);
  return localDate.toISOString().slice(0, 16);
}

function App() {
  const [dashboard, setDashboard] = useState<DashboardResponse>(emptyDashboard);
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<LatestTransaction[]>([]);
  const [latestPrices, setLatestPrices] = useState<LatestPrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [autoGoldRefreshTriggered, setAutoGoldRefreshTriggered] = useState(false);
  const [isTransactionDialogOpen, setIsTransactionDialogOpen] = useState(false);
  const [isPriceDialogOpen, setIsPriceDialogOpen] = useState(false);
  const [isAssetDialogOpen, setIsAssetDialogOpen] = useState(false);
  const [transactionPendingDelete, setTransactionPendingDelete] =
    useState<LatestTransaction | null>(null);

  const [assetForm, setAssetForm] = useState<AssetFormState>({
    categoryCode: 'GOLD',
    symbol: '',
    name: '',
    unit: '',
    notes: '',
  });

  const [transactionForm, setTransactionForm] = useState<TransactionFormState>({
    assetId: '',
    type: 'BUY',
    quantity: '',
    price: '',
    fee: '',
    executedAt: toDateInputValue(),
    settledAt: '',
    note: '',
  });

  const [priceForm, setPriceForm] = useState<PriceFormState>({
    assetId: '',
    source: 'MANUAL',
    price: '',
    capturedAt: toDateTimeLocalValue(),
  });

  const loadData = async () => {
    setErrorMessage('');

    try {
      const [dashboardRes, categoriesRes, transactionsRes, pricesRes] =
        await Promise.all([
          api.get<DashboardResponse>('/dashboard'),
          api.get<Category[]>('/categories'),
          api.get<LatestTransaction[]>('/transactions'),
          api.get<LatestPrice[]>('/prices/latest'),
        ]);

      const loadedDashboard = dashboardRes.data;
      const loadedCategories = categoriesRes.data;
      const loadedTransactions = transactionsRes.data;
      const loadedPrices = pricesRes.data;

      setDashboard(loadedDashboard);
      setCategories(loadedCategories);
      setTransactions(loadedTransactions);
      setLatestPrices(loadedPrices);

      setAssetForm((current) => ({
        ...current,
        categoryCode:
          loadedCategories.find((category) => category.code === current.categoryCode)
            ?.code ??
          loadedCategories[0]?.code ??
          'GOLD',
      }));

      setTransactionForm((current) => ({
        ...current,
        assetId:
          loadedDashboard.assets.find(
            (asset) => String(asset.id) === current.assetId,
          )?.id.toString() ??
          loadedDashboard.assets[0]?.id.toString() ??
          '',
      }));

      setPriceForm((current) => ({
        ...current,
        assetId:
          loadedDashboard.assets
            .filter((asset) => asset.categoryCode !== 'SAVING')
            .find((asset) => String(asset.id) === current.assetId)
            ?.id.toString() ??
          loadedDashboard.assets
            .filter((asset) => asset.categoryCode !== 'SAVING')[0]
            ?.id.toString() ??
          '',
      }));
    } catch (error) {
      if (axios.isAxiosError(error)) {
        setErrorMessage(
          error.response?.data?.message ||
            error.message ||
            'Không thể tải dữ liệu từ backend.',
        );
      } else {
        setErrorMessage('Không thể tải dữ liệu từ backend.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    if (loading || autoGoldRefreshTriggered || dashboard.assets.length === 0) {
      return;
    }

    const autoGoldAsset = latestPrices.find(
      (item) =>
        item.category.code === 'GOLD' && item.latestPrice?.source === 'AUTO',
    );

    if (!autoGoldAsset) {
      return;
    }

    setAutoGoldRefreshTriggered(true);

    void (async () => {
      try {
        await api.post('/prices/auto/gold', {
          assetId: autoGoldAsset.assetId,
          capturedAt: new Date().toISOString(),
        });
        await loadData();
      } catch (error) {
        if (axios.isAxiosError(error)) {
          setErrorMessage(
            error.response?.data?.message ||
              error.message ||
              'Không thể tự động cập nhật giá vàng.',
          );
        } else {
          setErrorMessage('Không thể tự động cập nhật giá vàng.');
        }
      }
    })();
  }, [autoGoldRefreshTriggered, dashboard.assets.length, latestPrices, loading]);

  const trackedAssetsCount = dashboard.assets.length;

  const selectedTransactionAsset =
    dashboard.assets.find((asset) => String(asset.id) === transactionForm.assetId) ??
    null;
  const isSavingTransaction = selectedTransactionAsset?.categoryCode === 'SAVING';

  const transactionAssetOptions = useMemo(
    () =>
      dashboard.assets.map((asset) => ({
        id: asset.id,
        value: String(asset.id),
        label: `${asset.name} (${asset.symbol})`,
      })),
    [dashboard.assets],
  );

  const priceAssetOptions = useMemo(
    () =>
      dashboard.assets
        .filter((asset) => asset.categoryCode !== 'SAVING')
        .map((asset) => ({
          id: asset.id,
          value: String(asset.id),
          label: `${asset.name} (${asset.symbol})`,
        })),
    [dashboard.assets],
  );

  const visibleLatestPrices = useMemo(
    () => latestPrices.filter((item) => item.category.code !== 'SAVING'),
    [latestPrices],
  );

  const selectedPriceAsset =
    dashboard.assets.find((asset) => String(asset.id) === priceForm.assetId) ?? null;
  const isAutoGoldPriceUpdate =
    priceForm.source === 'AUTO' && selectedPriceAsset?.categoryCode === 'GOLD';

  const handleDeleteTransaction = async (transactionId: number) => {
    setSubmitting(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      await api.delete(`/transactions/${transactionId}`);
      setSuccessMessage('Đã xóa giao dịch thành công.');
      await loadData();
    } catch (error) {
      if (axios.isAxiosError(error)) {
        setErrorMessage(
          error.response?.data?.message ||
            error.message ||
            'Không thể xóa giao dịch.',
        );
      } else {
        setErrorMessage('Không thể xóa giao dịch.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateAsset = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      await api.post('/assets', {
        categoryCode: assetForm.categoryCode,
        symbol: assetForm.symbol.trim().toUpperCase(),
        name: assetForm.name.trim(),
        unit: assetForm.unit.trim(),
        notes: assetForm.notes.trim() || undefined,
      });

      setAssetForm((current) => ({
        ...current,
        symbol: '',
        name: '',
        unit: '',
        notes: '',
      }));
      setSuccessMessage('Đã tạo tài sản mới thành công.');
      setIsAssetDialogOpen(false);
      await loadData();
    } catch (error) {
      if (axios.isAxiosError(error)) {
        setErrorMessage(
          error.response?.data?.message ||
            error.message ||
            'Không thể tạo tài sản.',
        );
      } else {
        setErrorMessage('Không thể tạo tài sản.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateTransaction = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      await api.post('/transactions', {
        assetId: Number(transactionForm.assetId),
        type: transactionForm.type,
        quantity: Number(transactionForm.quantity),
        price: Number(transactionForm.price),
        fee: Number(transactionForm.fee || 0),
        executedAt: new Date(transactionForm.executedAt).toISOString(),
        settledAt: transactionForm.settledAt
          ? new Date(transactionForm.settledAt).toISOString()
          : undefined,
        note: transactionForm.note.trim() || undefined,
      });

      setTransactionForm((current) => ({
        ...current,
        quantity: '',
        price: '',
        fee: '',
        note: '',
        executedAt: toDateInputValue(),
        settledAt: '',
      }));
      setSuccessMessage('Đã lưu giao dịch thành công.');
      setIsTransactionDialogOpen(false);
      await loadData();
    } catch (error) {
      if (axios.isAxiosError(error)) {
        setErrorMessage(
          error.response?.data?.message ||
            error.message ||
            'Không thể lưu giao dịch.',
        );
      } else {
        setErrorMessage('Không thể lưu giao dịch.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreatePrice = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      if (isAutoGoldPriceUpdate) {
        await api.post('/prices/auto/gold', {
          assetId: Number(priceForm.assetId),
          capturedAt: new Date(priceForm.capturedAt).toISOString(),
        });
      } else {
        await api.post('/prices', {
          assetId: Number(priceForm.assetId),
          source: priceForm.source,
          price: Number(priceForm.price),
          capturedAt: new Date(priceForm.capturedAt).toISOString(),
        });
      }

      setPriceForm((current) => ({
        ...current,
        price: '',
        capturedAt: toDateTimeLocalValue(),
      }));
      setSuccessMessage(
        isAutoGoldPriceUpdate
          ? 'Đã tự động cập nhật giá vàng thành công.'
          : 'Đã cập nhật giá hiện tại thành công.',
      );
      setIsPriceDialogOpen(false);
      await loadData();
    } catch (error) {
      if (axios.isAxiosError(error)) {
        setErrorMessage(
          error.response?.data?.message ||
            error.message ||
            'Không thể cập nhật giá.',
        );
      } else {
        setErrorMessage('Không thể cập nhật giá.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page">
      <header className="hero-section">
        <div>
          <span className="eyebrow">Khánh Thảo</span>
          <h1>Tài chính Gia Đình</h1>
          <p className="hero-text">
            Quản lý tài chính, đầu tư của gia đình.
          </p>
        </div>
        <div className="hero-card mt-2">
          <div className="hero-card-label">Tổng tài chính hiện tại</div>
          <div className="hero-card-value">
            {formatCurrency(dashboard.totals.totalMarketValue)}
          </div>
          <div
            className={`hero-card-profit ${
              dashboard.totals.totalProfitLoss >= 0 ? 'profit' : 'loss'
            }`}
          >
            {dashboard.totals.totalProfitLoss >= 0 ? '+' : ''}
            {formatCurrency(dashboard.totals.totalProfitLoss)}
          </div>
        </div>
      </header>

      {loading ? (
        <section className="section">
          <div className="panel">
            <h2>Đang tải dữ liệu từ backend...</h2>
          </div>
        </section>
      ) : null}

      {errorMessage ? (
        <section className="section">
          <div className="panel">
            <strong className="loss">{errorMessage}</strong>
          </div>
        </section>
      ) : null}

      {successMessage ? (
        <section className="section">
          <div className="panel">
            <strong className="profit">{successMessage}</strong>
          </div>
        </section>
      ) : null}

      <section className="stats-grid">
        <article className="stat-card">
          <span className="stat-label">Tổng vốn</span>
          <strong>{formatCurrency(dashboard.totals.totalCost)}</strong>
        </article>
        <article className="stat-card">
          <span className="stat-label">Giá trị thị trường</span>
          <strong>{formatCurrency(dashboard.totals.totalMarketValue)}</strong>
        </article>
        <article className="stat-card">
          <span className="stat-label">Lãi / lỗ tạm tính</span>
          <strong
            className={dashboard.totals.totalProfitLoss >= 0 ? 'profit' : 'loss'}
          >
            {dashboard.totals.totalProfitLoss >= 0 ? '+' : ''}
            {formatCurrency(dashboard.totals.totalProfitLoss)}
          </strong>
        </article>
        <article className="stat-card">
          <span className="stat-label">Số tài sản đang theo dõi</span>
          <strong>{trackedAssetsCount}</strong>
        </article>
      </section>

      <section className="section">
        <div className="section-heading">
          <div>
            <span className="section-kicker">Dashboard</span>
            <h2>Tổng hợp theo danh mục đầu tư</h2>
          </div>
        </div>

        <div className="category-flex">
          {dashboard.byCategory.map((category) => (
            <article className="category-card" key={category.categoryCode}>
              <div className="category-card-header">
                <h3>{category.categoryName}</h3>
                <span
                  className={
                    category.totalProfitLoss >= 0 ? 'badge positive' : 'badge negative'
                  }
                >
                  {category.totalProfitLoss >= 0 ? 'Đang lãi' : 'Đang lỗ'}
                </span>
              </div>
              <dl className="category-metrics">
                <div>
                  <dt>Tổng vốn</dt>
                  <dd>{formatCurrency(category.totalCost)}</dd>
                </div>
                <div>
                  <dt>Giá trị hiện tại</dt>
                  <dd>{formatCurrency(category.totalMarketValue)}</dd>
                </div>
                <div>
                  <dt>Lãi / lỗ</dt>
                  <dd
                    className={
                      category.totalProfitLoss >= 0 ? 'profit' : 'loss'
                    }
                  >
                    {category.totalProfitLoss >= 0 ? '+' : ''}
                    {formatCurrency(category.totalProfitLoss)}
                  </dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="panel">
          <div className="section-heading">
            <div>
              <span className="section-kicker">Danh mục đầu tư</span>
              <h2>Tài sản đang quản lý</h2>
            </div>
          </div>

          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Tài sản</th>
                  <th>Danh mục</th>
                  <th>Số lượng</th>
                  <th>Giá hiện tại</th>
                  <th>Giá trị</th>
                  <th>Lãi / lỗ</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.assets.map((asset) => (
                  <tr key={asset.id}>
                    <td>
                      <div className="asset-cell">
                        <strong>{asset.name}</strong>
                        <span>{asset.symbol}</span>
                      </div>
                    </td>
                    <td>{asset.categoryName}</td>
                    <td>
                      <div className="asset-cell">
                        <strong>
                          {formatNumber(asset.holdingQuantity)} {asset.unit}
                        </strong>
                        <span>Tổng số lượng đang nắm giữ</span>
                      </div>
                    </td>
                    <td>{formatCurrency(asset.latestPrice)}</td>
                    <td>{formatCurrency(asset.marketValue)}</td>
                    <td className={asset.profitLoss >= 0 ? 'profit' : 'loss'}>
                      {asset.profitLoss >= 0 ? '+' : ''}
                      {formatCurrency(asset.profitLoss)}
                    </td>
                  </tr>
                ))}
                {dashboard.assets.length === 0 ? (
                  <tr>
                    <td colSpan={6}>Chưa có tài sản nào trong hệ thống.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel stack">
          <div className="section-heading">
            <div>
              <span className="section-kicker">Giá hiện tại</span>
              <h2>Auto hoặc manual</h2>
            </div>
          </div>

          <div className="price-list">
            {visibleLatestPrices.map((item) => (
              <div className="price-row" key={item.assetId}>
                <div>
                  <strong>{item.assetName}</strong>
                  <p>
                    {item.symbol} •{' '}
                    {item.latestPrice
                      ? formatDateTime(item.latestPrice.capturedAt)
                      : 'Chưa có giá'}
                  </p>
                </div>
                <div className="price-value">
                  <strong>
                    {item.latestPrice
                      ? formatCurrency(Number(item.latestPrice.price))
                      : '—'}
                  </strong>
                  <span
                    className={
                      item.latestPrice?.source === 'AUTO' ? 'badge info' : 'badge'
                    }
                  >
                    {item.latestPrice?.source ?? 'N/A'}
                  </span>
                </div>
              </div>
            ))}
            {visibleLatestPrices.length === 0 ? (
              <p>Không có dữ liệu giá hiện tại cho các danh mục có theo dõi giá.</p>
            ) : null}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="panel">
          <div className="section-heading">
            <div>
              <span className="section-kicker">Thao tác nhanh</span>
              <h2>Nhập dữ liệu khi cần</h2>
            </div>
          </div>

          <div className="actions-row">
            <button
              type="button"
              className="primary-button"
              onClick={() => setIsTransactionDialogOpen(true)}
              disabled={transactionAssetOptions.length === 0}
            >
              Thêm giao dịch
            </button>
            <button
              type="button"
              className="primary-button secondary-button"
              onClick={() => setIsPriceDialogOpen(true)}
              disabled={priceAssetOptions.length === 0}
            >
              Cập nhật giá
            </button>
            <button
              type="button"
              className="primary-button secondary-button"
              onClick={() => setIsAssetDialogOpen(true)}
              disabled={categories.length === 0}
            >
              Tạo tài sản
            </button>
          </div>

          <div className="quick-actions-hint">
            {transactionAssetOptions.length === 0 ? (
              <p>Chưa có tài sản nào để nhập giao dịch. Hãy tạo tài sản trước.</p>
            ) : null}
            {priceAssetOptions.length === 0 ? (
              <p>
                Không có tài sản cần cập nhật giá. Sổ tiết kiệm không dùng mục giá
                hiện tại.
              </p>
            ) : null}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="panel">
          <div className="section-heading">
            <div>
              <span className="section-kicker">Hoạt động gần đây</span>
              <h2>Giao dịch mới nhất</h2>
            </div>
          </div>

          <div className="activity-list mt-2">
            {transactions.map((transaction) => (
              <div className="activity-row" key={transaction.id}>
                <div className='row'>
                  <div>
                    <strong>{transaction.asset.name}</strong>
                  </div>
                  <span
                    className={
                      transaction.type === 'BUY' ? 'badge positive' : 'badge negative'
                    }
                  >
                    {transaction.asset.category.code === 'SAVING'
                      ? transaction.type === 'BUY'
                        ? 'MỞ SỔ'
                        : 'ĐÓNG SỔ'
                      : transaction.type}
                  </span>
                </div>
                <div className="activity-meta w-100">
                  <div>
                    <strong>
                      {formatNumber(Number(transaction.quantity))}{' '}
                      {transaction.asset.category.code === 'SAVING' ? 'gửi @ ' : 'x '}
                      {transaction.asset.category.code === 'SAVING'
                        ? `${formatNumber(Number(transaction.price))}%/năm`
                        : formatCurrency(Number(transaction.price))}
                    </strong>
                    <p>
                      {transaction.asset.symbol} • {formatDateTime(transaction.executedAt)}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="primary-button mt-2"
                    onClick={() => setTransactionPendingDelete(transaction)}
                    disabled={submitting}
                  >
                    Xóa
                  </button>
                </div>
              </div>
            ))}
            {transactions.length === 0 ? <p>Chưa có giao dịch nào.</p> : null}
          </div>
        </div>
      </section>

      {transactionPendingDelete ? (
        <div
          className="dialog-overlay"
          onClick={() => {
            if (!submitting) {
              setTransactionPendingDelete(null);
            }
          }}
        >
          <div className="dialog-panel" onClick={(event) => event.stopPropagation()}>
            <div className="section-heading">
              <div className='center'>
                <span className="section-kicker">Xóa giao dịch</span>
              </div>
              <button
                type="button"
                className="dialog-close"
                onClick={() => setTransactionPendingDelete(null)}
                disabled={submitting}
              >
                X
              </button>
            </div>

            <div className="quick-actions-hint mt-2">
              <p>
                Bạn có chắc muốn xóa giao dịch của{' '}
                <strong>{transactionPendingDelete.asset.name}</strong> (
                {transactionPendingDelete.asset.symbol}) tại thời điểm{' '}
                <strong>{formatDateTime(transactionPendingDelete.executedAt)}</strong>?
              </p>
              <p>Thao tác này không thể hoàn tác.</p>
            </div>

            <div className="row mt-2">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setTransactionPendingDelete(null)}
                disabled={submitting}
              >
                Hủy
              </button>
              <button
                type="button"
                className="primary-button"
                onClick={() => {
                  void handleDeleteTransaction(transactionPendingDelete.id);
                  setTransactionPendingDelete(null);
                }}
                disabled={submitting}
              >
                Xác nhận xóa
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isTransactionDialogOpen ? (
        <div
          className="dialog-overlay"
          onClick={() => {
            if (!submitting) {
              setIsTransactionDialogOpen(false);
            }
          }}
        >
          <div className="dialog-panel" onClick={(event) => event.stopPropagation()}>
            <div className="section-heading mb-2">
              <div className='center'>
                <span className="section-kicker">Nhập giao dịch mới</span>
              </div>
              <button
                type="button"
                className="dialog-close"
                onClick={() => setIsTransactionDialogOpen(false)}
                disabled={submitting}
              >
                X
              </button>
            </div>

            <form className="form-grid mt-2" onSubmit={handleCreateTransaction}>
              <label>
                Tài sản
                <select
                  value={transactionForm.assetId}
                  onChange={(event) =>
                    setTransactionForm((current) => ({
                      ...current,
                      assetId: event.target.value,
                    }))
                  }
                  disabled={submitting || transactionAssetOptions.length === 0}
                >
                  {transactionAssetOptions.length === 0 ? (
                    <option value="">Chưa có tài sản, hãy tạo mới trước</option>
                  ) : null}
                  {transactionAssetOptions.map((asset) => (
                    <option key={asset.id} value={asset.value}>
                      {asset.label}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Loại giao dịch
                <select
                  value={transactionForm.type}
                  onChange={(event) =>
                    setTransactionForm((current) => ({
                      ...current,
                      type: event.target.value as TransactionType,
                    }))
                  }
                  disabled={submitting}
                >
                  <option value="BUY">
                    {isSavingTransaction ? 'Mở sổ' : 'Mua'}
                  </option>
                  <option value="SELL">
                    {isSavingTransaction ? 'Đóng sổ' : 'Bán'}
                  </option>
                </select>
              </label>

              <label>
                Số lượng
                <input
                  type="number"
                  min="0"
                  step="0.0001"
                  placeholder="0.00"
                  value={transactionForm.quantity}
                  onChange={(event) =>
                    setTransactionForm((current) => ({
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
                  value={transactionForm.price}
                  onChange={(event) =>
                    setTransactionForm((current) => ({
                      ...current,
                      price: event.target.value,
                    }))
                  }
                  disabled={submitting}
                  required
                />
                {!isSavingTransaction && formatCurrencyPreview(transactionForm.price) ? (
                  <span className="input-preview">
                    {formatCurrencyPreview(transactionForm.price)}
                  </span>
                ) : null}
              </label>

              <label>
                Phí giao dịch
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0"
                  value={transactionForm.fee}
                  onChange={(event) =>
                    setTransactionForm((current) => ({
                      ...current,
                      fee: event.target.value,
                    }))
                  }
                  disabled={submitting}
                />
                {formatCurrencyPreview(transactionForm.fee) ? (
                  <span className="input-preview">
                    {formatCurrencyPreview(transactionForm.fee)}
                  </span>
                ) : null}
              </label>

              <label>
                {isSavingTransaction ? 'Ngày mở sổ' : 'Ngày giao dịch'}
                <input
                  type="date"
                  value={transactionForm.executedAt}
                  onChange={(event) =>
                    setTransactionForm((current) => ({
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
                    value={transactionForm.settledAt}
                    onChange={(event) =>
                      setTransactionForm((current) => ({
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
                  value={transactionForm.note}
                  onChange={(event) =>
                    setTransactionForm((current) => ({
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
                disabled={submitting || transactionAssetOptions.length === 0}
              >
                Lưu giao dịch
              </button>
            </form>
          </div>
        </div>
      ) : null}

      {isPriceDialogOpen ? (
        <div
          className="dialog-overlay"
          onClick={() => {
            if (!submitting) {
              setIsPriceDialogOpen(false);
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
                onClick={() => setIsPriceDialogOpen(false)}
                disabled={submitting}
              >
                X
              </button>
            </div>

            <form className="form-grid" onSubmit={handleCreatePrice}>
              <label>
                Tài sản
                <select
                  value={priceForm.assetId}
                  onChange={(event) =>
                    setPriceForm((current) => ({
                      ...current,
                      assetId: event.target.value,
                    }))
                  }
                  disabled={submitting || priceAssetOptions.length === 0}
                >
                  {priceAssetOptions.length === 0 ? (
                    <option value="">Không có tài sản cần cập nhật giá</option>
                  ) : null}
                  {priceAssetOptions.map((asset) => (
                    <option key={asset.id} value={asset.value}>
                      {asset.label}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Nguồn giá
                <select
                  value={priceForm.source}
                  onChange={(event) =>
                    setPriceForm((current) => ({
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
                  value={priceForm.price}
                  onChange={(event) =>
                    setPriceForm((current) => ({
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
                ) : formatCurrencyPreview(priceForm.price) ? (
                  <span className="input-preview">
                    {formatCurrencyPreview(priceForm.price)}
                  </span>
                ) : null}
              </label>

              <label>
                Thời điểm ghi nhận
                <input
                  type="datetime-local"
                  value={priceForm.capturedAt}
                  onChange={(event) =>
                    setPriceForm((current) => ({
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
                disabled={submitting || priceAssetOptions.length === 0}
              >
                Cập nhật giá
              </button>
            </form>
          </div>
        </div>
      ) : null}

      {isAssetDialogOpen ? (
        <div
          className="dialog-overlay"
          onClick={() => {
            if (!submitting) {
              setIsAssetDialogOpen(false);
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
                onClick={() => setIsAssetDialogOpen(false)}
                disabled={submitting}
              >
                X
              </button>
            </div>

            <form className="form-grid" onSubmit={handleCreateAsset}>
              <label>
                Danh mục đầu tư
                <select
                  value={assetForm.categoryCode}
                  onChange={(event) =>
                    setAssetForm((current) => ({
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
                  value={assetForm.symbol}
                  onChange={(event) =>
                    setAssetForm((current) => ({
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
                  value={assetForm.name}
                  onChange={(event) =>
                    setAssetForm((current) => ({
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
                  value={assetForm.unit}
                  onChange={(event) =>
                    setAssetForm((current) => ({
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
                  value={assetForm.notes}
                  onChange={(event) =>
                    setAssetForm((current) => ({
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
      ) : null}
    </div>
  );
}

export default App;