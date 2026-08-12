import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import axios from 'axios';
import './App.css';
import PasscodeGate from './components/PasscodeGate';
import {
  AppHeader,
  CategorySummarySection,
  LoadingSection,
  PortfolioSection,
  QuickActionsSection,
  RecentTransactionsSection,
  StatsGrid,
  ToastStack,
} from './components/DashboardSections';
import type {
  AssetFormState,
  AssetOption,
  Category,
  DashboardResponse,
  LatestPrice,
  LatestTransaction,
  PriceFormState,
  TransactionFormState,
} from './types/app';
import { toDateInputValue, toDateTimeLocalValue } from './utils/appFormatters';

const TransactionDialog = lazy(() =>
  import('./components/AppDialogs').then((module) => ({
    default: module.TransactionDialog,
  })),
);

const PriceDialog = lazy(() =>
  import('./components/AppDialogs').then((module) => ({
    default: module.PriceDialog,
  })),
);

const AssetDialog = lazy(() =>
  import('./components/AppDialogs').then((module) => ({
    default: module.AssetDialog,
  })),
);

const DeleteTransactionDialog = lazy(() =>
  import('./components/AppDialogs').then((module) => ({
    default: module.DeleteTransactionDialog,
  })),
);

const ACCESS_COOKIE_NAME = 'tradeview_passcode_access';
const ACCESS_COOKIE_DURATION_DAYS = 30;
const APP_PASSCODE = import.meta.env.VITE_APP_PASSCODE?.trim() || '123456';

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

function getCookie(name: string) {
  if (typeof document === 'undefined') {
    return '';
  }

  const cookie = document.cookie
    .split('; ')
    .find((item) => item.startsWith(`${name}=`));

  return cookie ? decodeURIComponent(cookie.split('=').slice(1).join('=')) : '';
}

function setCookie(name: string, value: string, days: number) {
  if (typeof document === 'undefined') {
    return;
  }

  const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

function deleteCookie(name: string) {
  if (typeof document === 'undefined') {
    return;
  }

  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax`;
}

function App() {
  const toastTimeoutRef = useRef<number | null>(null);
  const [dashboard, setDashboard] = useState<DashboardResponse>(emptyDashboard);
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<LatestTransaction[]>([]);
  const [latestPrices, setLatestPrices] = useState<LatestPrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [passcode, setPasscode] = useState('');
  const [rememberLogin, setRememberLogin] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => getCookie(ACCESS_COOKIE_NAME) === 'granted',
  );
  const [passcodeError, setPasscodeError] = useState('');
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

  const showToast = (type: 'success' | 'error', message: string) => {
    if (toastTimeoutRef.current) {
      window.clearTimeout(toastTimeoutRef.current);
    }

    if (type === 'success') {
      setErrorMessage('');
      setSuccessMessage(message);
    } else {
      setSuccessMessage('');
      setErrorMessage(message);
    }

    toastTimeoutRef.current = window.setTimeout(() => {
      setErrorMessage('');
      setSuccessMessage('');
      toastTimeoutRef.current = null;
    }, 3000);
  };

  const clearToast = () => {
    if (toastTimeoutRef.current) {
      window.clearTimeout(toastTimeoutRef.current);
      toastTimeoutRef.current = null;
    }

    setErrorMessage('');
    setSuccessMessage('');
  };

  const loadData = async () => {
    setLoading(true);
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
    if (!isAuthenticated) {
      setLoading(false);
      setAutoGoldRefreshTriggered(false);
      return;
    }

    setAutoGoldRefreshTriggered(false);
    void loadData();
  }, [isAuthenticated]);

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        window.clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (loading || autoGoldRefreshTriggered || dashboard.assets.length === 0) {
      return;
    }

    const autoGoldAsset = latestPrices.find(
      (item) => item.category.code === 'GOLD' && item.latestPrice?.source === 'AUTO',
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
          showToast(
            'error',
            error.response?.data?.message ||
              error.message ||
              'Không thể tự động cập nhật giá vàng.',
          );
        } else {
          showToast('error', 'Không thể tự động cập nhật giá vàng.');
        }
      }
    })();
  }, [autoGoldRefreshTriggered, dashboard.assets.length, latestPrices, loading]);

  const trackedAssetsCount = dashboard.assets.length;

  const selectedTransactionAsset =
    dashboard.assets.find((asset) => String(asset.id) === transactionForm.assetId) ??
    null;
  const isSavingTransaction = selectedTransactionAsset?.categoryCode === 'SAVING';

  const transactionAssetOptions = useMemo<AssetOption[]>(
    () =>
      dashboard.assets.map((asset) => ({
        id: asset.id,
        value: String(asset.id),
        label: `${asset.name} (${asset.symbol})`,
      })),
    [dashboard.assets],
  );

  const priceAssetOptions = useMemo<AssetOption[]>(
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

  const handlePasscodeSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPasscodeError('');
    clearToast();

    const sanitizedPasscode = passcode.replace(/\D/g, '');

    if (!/^\d{6}$/.test(sanitizedPasscode)) {
      setPasscodeError('Vui lòng nhập đúng passcode gồm 6 chữ số.');
      return;
    }

    if (sanitizedPasscode !== APP_PASSCODE) {
      setPasscodeError('Passcode không chính xác.');
      return;
    }

    if (rememberLogin) {
      setCookie(ACCESS_COOKIE_NAME, 'granted', ACCESS_COOKIE_DURATION_DAYS);
    } else {
      deleteCookie(ACCESS_COOKIE_NAME);
    }

    setIsAuthenticated(true);
    setPasscode('');
    showToast('success', 'Đăng nhập thành công.');
  };

  const handleLogout = () => {
    deleteCookie(ACCESS_COOKIE_NAME);
    setIsAuthenticated(false);
    setRememberLogin(false);
    setPasscode('');
    setPasscodeError('');
    clearToast();
    setDashboard(emptyDashboard);
    setCategories([]);
    setTransactions([]);
    setLatestPrices([]);
    setAutoGoldRefreshTriggered(false);
    setLoading(false);
  };

  const handleDeleteTransaction = async (transactionId: number) => {
    setSubmitting(true);
    clearToast();

    try {
      await api.delete(`/transactions/${transactionId}`);
      showToast('success', 'Đã xóa giao dịch thành công.');
      await loadData();
    } catch (error) {
      if (axios.isAxiosError(error)) {
        showToast(
          'error',
          error.response?.data?.message || error.message || 'Không thể xóa giao dịch.',
        );
      } else {
        showToast('error', 'Không thể xóa giao dịch.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateAsset = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    clearToast();

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
      showToast('success', 'Đã tạo tài sản mới thành công.');
      setIsAssetDialogOpen(false);
      await loadData();
    } catch (error) {
      if (axios.isAxiosError(error)) {
        showToast(
          'error',
          error.response?.data?.message || error.message || 'Không thể tạo tài sản.',
        );
      } else {
        showToast('error', 'Không thể tạo tài sản.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateTransaction = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    clearToast();

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
      showToast('success', 'Đã lưu giao dịch thành công.');
      setIsTransactionDialogOpen(false);
      await loadData();
    } catch (error) {
      if (axios.isAxiosError(error)) {
        showToast(
          'error',
          error.response?.data?.message || error.message || 'Không thể lưu giao dịch.',
        );
      } else {
        showToast('error', 'Không thể lưu giao dịch.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreatePrice = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    clearToast();

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
      showToast(
        'success',
        isAutoGoldPriceUpdate
          ? 'Đã tự động cập nhật giá vàng thành công.'
          : 'Đã cập nhật giá hiện tại thành công.',
      );
      setIsPriceDialogOpen(false);
      await loadData();
    } catch (error) {
      if (axios.isAxiosError(error)) {
        showToast(
          'error',
          error.response?.data?.message || error.message || 'Không thể cập nhật giá.',
        );
      } else {
        showToast('error', 'Không thể cập nhật giá.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const lazyFallback = (
    <div className="dialog-overlay">
      <div className="dialog-panel">
        <div className="panel">
          <h2>Đang tải biểu mẫu...</h2>
        </div>
      </div>
    </div>
  );

  if (!isAuthenticated) {
    return (
      <PasscodeGate
        passcode={passcode}
        passcodeError={passcodeError}
        rememberLogin={rememberLogin}
        onPasscodeChange={(value) => {
          setPasscode(value.replace(/\D/g, '').slice(0, 6));
          if (passcodeError) {
            setPasscodeError('');
          }
        }}
        onRememberLoginChange={setRememberLogin}
        onSubmit={handlePasscodeSubmit}
      />
    );
  }

  return (
    <div className="page">
      <AppHeader
        totalMarketValue={dashboard.totals.totalMarketValue}
        totalProfitLoss={dashboard.totals.totalProfitLoss}
        onLogout={handleLogout}
      />

      <LoadingSection loading={loading} />

      <ToastStack
        errorMessage={errorMessage}
        successMessage={successMessage}
        onClose={clearToast}
      />

      <StatsGrid dashboard={dashboard} trackedAssetsCount={trackedAssetsCount} />

      <CategorySummarySection dashboard={dashboard} />

      <PortfolioSection
        assets={dashboard.assets}
        latestPrices={visibleLatestPrices}
      />

      <QuickActionsSection
        canCreateTransaction={transactionAssetOptions.length > 0}
        canCreatePrice={priceAssetOptions.length > 0}
        canCreateAsset={categories.length > 0}
        onOpenTransaction={() => setIsTransactionDialogOpen(true)}
        onOpenPrice={() => setIsPriceDialogOpen(true)}
        onOpenAsset={() => setIsAssetDialogOpen(true)}
      />

      <RecentTransactionsSection
        transactions={transactions}
        submitting={submitting}
        onRequestDelete={setTransactionPendingDelete}
      />

      <Suspense fallback={lazyFallback}>
        {transactionPendingDelete ? (
          <DeleteTransactionDialog
            transaction={transactionPendingDelete}
            submitting={submitting}
            onClose={() => setTransactionPendingDelete(null)}
            onConfirm={() => {
              void handleDeleteTransaction(transactionPendingDelete.id);
              setTransactionPendingDelete(null);
            }}
          />
        ) : null}

        <TransactionDialog
          open={isTransactionDialogOpen}
          submitting={submitting}
          form={transactionForm}
          assetOptions={transactionAssetOptions}
          isSavingTransaction={Boolean(isSavingTransaction)}
          onClose={() => setIsTransactionDialogOpen(false)}
          onSubmit={handleCreateTransaction}
          onChange={setTransactionForm}
        />

        <PriceDialog
          open={isPriceDialogOpen}
          submitting={submitting}
          form={priceForm}
          assetOptions={priceAssetOptions}
          isAutoGoldPriceUpdate={Boolean(isAutoGoldPriceUpdate)}
          onClose={() => setIsPriceDialogOpen(false)}
          onSubmit={handleCreatePrice}
          onChange={setPriceForm}
        />

        <AssetDialog
          open={isAssetDialogOpen}
          submitting={submitting}
          form={assetForm}
          categories={categories}
          onClose={() => setIsAssetDialogOpen(false)}
          onSubmit={handleCreateAsset}
          onChange={setAssetForm}
        />
      </Suspense>
    </div>
  );
}

export default App;