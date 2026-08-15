import type { ReactNode } from 'react';
import { displayPrice, formatCurrency, formatDateTime, formatNumber } from '../utils/appFormatters';
import type {
  AppPage,
  DashboardResponse,
  LatestPrice,
  LatestTransaction,
} from '../types/app';

type AppHeaderProps = {
  activePage: AppPage;
  totalMarketValue: number;
  totalProfitLoss: number;
  onNavigate: (page: AppPage) => void;
  onLogout: () => void;
  showFinancialSummary: boolean;
  notificationSection?: ReactNode;
};

export function AppHeader({
  activePage,
  totalMarketValue,
  totalProfitLoss,
  onNavigate,
  onLogout,
  showFinancialSummary,
  notificationSection,
}: AppHeaderProps) {
  return (
    <header className="hero-section">
      <div>
        <div className='relative'>
          <span className="eyebrow">Khánh Thảo</span>
          <button
            type="button"
            className="absolute secondary-button logout-button"
            onClick={onLogout}
            aria-label="Đăng xuất"
            title="Đăng xuất"
          >
            <span className="logout-button-icon" aria-hidden="true">
              ⍈
            </span>
            <span className="logout-button-label">Đăng xuất</span>
          </button>
        </div>
        {notificationSection}
        <h1>Gia Đình Khánh Thảo</h1>
        <p className="hero-text">
          Quản lý tài chính, đầu tư của gia đình và theo dõi các task cần làm.
        </p>
        <div className="header-nav" role="navigation" aria-label="Điều hướng chức năng">
          <ul className="header-nav-tabs" role="tablist" aria-label="Chuyển chức năng">
            <li
              className={`header-nav-tab-item ${
                activePage === 'DASHBOARD' ? 'header-nav-tab-item-active' : ''
              }`}
              role="tab"
              aria-selected={activePage === 'DASHBOARD'}
              tabIndex={0}
              onClick={() => onNavigate('DASHBOARD')}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onNavigate('DASHBOARD');
                }
              }}
            >
              Dashboard tài chính
            </li>
            <li
              className={`header-nav-tab-item ${
                activePage === 'SPENDING' ? 'header-nav-tab-item-active' : ''
              }`}
              role="tab"
              aria-selected={activePage === 'SPENDING'}
              tabIndex={0}
              onClick={() => onNavigate('SPENDING')}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onNavigate('SPENDING');
                }
              }}
            >
              Chi tiêu
            </li>
            <li
              className={`header-nav-tab-item ${
                activePage === 'TASKS' ? 'header-nav-tab-item-active' : ''
              }`}
              role="tab"
              aria-selected={activePage === 'TASKS'}
              tabIndex={0}
              onClick={() => onNavigate('TASKS')}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onNavigate('TASKS');
                }
              }}
            >
              Quản lý task
            </li>
          </ul>
        </div>
      </div>
      {showFinancialSummary ? (
        <div className="hero-card mt-2">
          <div className="row">
            <div className="hero-card-label">Tổng tài chính hiện tại</div>
          </div>
          <div className="hero-card-value">{formatCurrency(totalMarketValue)}</div>
          <div className={`hero-card-profit ${totalProfitLoss >= 0 ? 'profit' : 'loss'}`}>
            {totalProfitLoss >= 0 ? '+' : ''}
            {formatCurrency(totalProfitLoss)}
          </div>
        </div>
      ) : null}
    </header>
  );
}

type ToastStackProps = {
  errorMessage: string;
  successMessage: string;
  onClose: () => void;
};

export function ToastStack({
  errorMessage,
  successMessage,
  onClose,
}: ToastStackProps) {
  if (!errorMessage && !successMessage) {
    return null;
  }

  return (
    <div className="toast-stack" aria-live="polite" aria-atomic="true">
      {errorMessage ? (
        <div className="toast toast-error" role="alert">
          <strong>{errorMessage}</strong>
          <button type="button" className="toast-close" onClick={onClose}>
            ×
          </button>
        </div>
      ) : null}

      {successMessage ? (
        <div className="toast toast-success" role="status">
          <strong>{successMessage}</strong>
          <button type="button" className="toast-close" onClick={onClose}>
            ×
          </button>
        </div>
      ) : null}
    </div>
  );
}

type LoadingSectionProps = {
  loading: boolean;
};

export function LoadingSection({ loading }: LoadingSectionProps) {
  if (!loading) {
    return null;
  }

  return (
    <section className="section">
      <div className="panel">
        <h2>Đang tải dữ liệu từ backend...</h2>
      </div>
    </section>
  );
}

type StatsGridProps = {
  dashboard: DashboardResponse;
  trackedAssetsCount: number;
};

export function StatsGrid({ dashboard, trackedAssetsCount }: StatsGridProps) {
  return (
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
        <strong className={dashboard.totals.totalProfitLoss >= 0 ? 'profit' : 'loss'}>
          {dashboard.totals.totalProfitLoss >= 0 ? '+' : ''}
          {formatCurrency(dashboard.totals.totalProfitLoss)}
        </strong>
      </article>
      <article className="stat-card">
        <span className="stat-label">Số tài sản đang theo dõi</span>
        <strong>{trackedAssetsCount}</strong>
      </article>
    </section>
  );
}

type CategorySummarySectionProps = {
  dashboard: DashboardResponse;
};

export function CategorySummarySection({
  dashboard,
}: CategorySummarySectionProps) {
  return (
    <section className="section">
      <div className="section-heading">
        <div>
          <span className="section-kicker">Tổng hợp danh sách tài sản</span>
          <h2></h2>
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
                <dd className={category.totalProfitLoss >= 0 ? 'profit' : 'loss'}>
                  {category.totalProfitLoss >= 0 ? '+' : ''}
                  {formatCurrency(category.totalProfitLoss)}
                </dd>
              </div>
            </dl>
          </article>
        ))}
      </div>
    </section>
  );
}

type PortfolioSectionProps = {
  assets: DashboardResponse['assets'];
  latestPrices: LatestPrice[];
};

export function PortfolioSection({
  assets,
  latestPrices,
}: PortfolioSectionProps) {
  return (
    <section className="section">
      <div className="panel">
        <div className="section-heading">
          <div>
            <span className="section-kicker">Danh sách tài sản</span>
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
              {assets.map((asset) => (
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
                  <td>{displayPrice(asset)}</td>
                  <td>{formatCurrency(asset.marketValue)}</td>
                  <td className={asset.profitLoss >= 0 ? 'profit' : 'loss'}>
                    {asset.profitLoss >= 0 ? '+' : ''}
                    {formatCurrency(asset.profitLoss)}
                  </td>
                </tr>
              ))}
              {assets.length === 0 ? (
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
          </div>
        </div>

        <div className="price-list">
          {latestPrices.map((item) => (
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
                  className={item.latestPrice?.source === 'AUTO' ? 'badge info' : 'badge'}
                >
                  {item.latestPrice?.source ?? 'N/A'}
                </span>
              </div>
            </div>
          ))}
          {latestPrices.length === 0 ? (
            <p>Không có dữ liệu giá hiện tại cho các danh mục có theo dõi giá.</p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

type QuickActionsSectionProps = {
  canCreateTransaction: boolean;
  canCreatePrice: boolean;
  canCreateAsset: boolean;
  onOpenTransaction: () => void;
  onOpenPrice: () => void;
  onOpenAsset: () => void;
};

export function QuickActionsSection({
  canCreateTransaction,
  canCreatePrice,
  canCreateAsset,
  onOpenTransaction,
  onOpenPrice,
  onOpenAsset,
}: QuickActionsSectionProps) {
  return (
    <section className="section">
      <div className="panel">
        <div className="section-heading">
          <div>
            <span className="section-kicker">Thao tác nhanh</span>
          </div>
        </div>

        <div className="actions-row">
          <button
            type="button"
            className="primary-button"
            onClick={onOpenTransaction}
            disabled={!canCreateTransaction}
          >
            Thêm giao dịch
          </button>
          <button
            type="button"
            className="primary-button"
            onClick={onOpenPrice}
            disabled={!canCreatePrice}
          >
            Cập nhật giá
          </button>
          <button
            type="button"
            className="primary-button"
            onClick={onOpenAsset}
            disabled={!canCreateAsset}
          >
            Tạo tài sản
          </button>
        </div>

        <div className="quick-actions-hint">
          {!canCreateTransaction ? (
            <p>Chưa có tài sản nào để nhập giao dịch. Hãy tạo tài sản trước.</p>
          ) : null}
          {!canCreatePrice ? (
            <p>
              Không có tài sản cần cập nhật giá. Sổ tiết kiệm không dùng mục giá hiện
              tại.
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

type RecentTransactionsSectionProps = {
  transactions: LatestTransaction[];
  submitting: boolean;
  onRequestDelete: (transaction: LatestTransaction) => void;
};

export function RecentTransactionsSection({
  transactions,
  submitting,
  onRequestDelete,
}: RecentTransactionsSectionProps) {
  return (
    <section className="section">
      <div className="panel">
        <div className="section-heading">
          <div>
            <span className="section-kicker">Danh sách giao dịch</span>
          </div>
        </div>

        <div className="activity-list mt-2">
          {transactions.map((transaction) => (
            <div className="activity-row relative" key={transaction.id}>
              <div className="row">
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
              </div>
              
              <button
                type="button"
                className="danger-button icon-button absolute"
                onClick={() => onRequestDelete(transaction)}
                disabled={submitting}
              >
                🗑
              </button>
            </div>
          ))}
          {transactions.length === 0 ? <p>Chưa có giao dịch nào.</p> : null}
        </div>
      </div>
    </section>
  );
}