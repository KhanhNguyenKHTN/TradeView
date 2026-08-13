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
import PushNotificationSection from './components/PushNotificationSection';
import TaskManagementPage from './components/TaskManagementPage';
import type {
  AppPage,
  AssetFormState,
  AssetOption,
  Category,
  DashboardResponse,
  LatestPrice,
  LatestTransaction,
  PriceFormState,
  TaskEditableField,
  TaskFormValues,
  TaskItem,
  TaskSummary,
  TaskViewFilter,
  TaskViewMode,
  TransactionFormState,
} from './types/app';
import { toDateInputValue, toDateTimeLocalValue } from './utils/appFormatters';

type PushPermissionState = NotificationPermission | 'unsupported';

type PushDebugEntry = {
  time: string;
  message: string;
};

type PushSubscriptionPayload = {
  endpoint: string;
  expirationTime: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
};

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

function encodePushKey(value: ArrayBuffer | null) {
  if (!value) {
    return '';
  }

  const bytes = new Uint8Array(value);
  let binary = '';

  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary);
}

function base64UrlToUint8Array(base64Url: string) {
  const normalizedValue = base64Url.trim().replace(/\s+/g, '');
  const padding = '='.repeat((4 - (normalizedValue.length % 4)) % 4);
  const base64 = `${normalizedValue}${padding}`.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64);
  const output = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    output[index] = binary.charCodeAt(index);
  }

  return output;
}

function serializePushSubscription(subscription: PushSubscription): PushSubscriptionPayload {
  return {
    endpoint: subscription.endpoint,
    expirationTime: subscription.expirationTime,
    keys: {
      p256dh: encodePushKey(subscription.getKey('p256dh')),
      auth: encodePushKey(subscription.getKey('auth')),
    },
  };
}

function getPushPermissionLabel(permission: PushPermissionState) {
  switch (permission) {
    case 'granted':
      return 'Đã bật thông báo';
    case 'denied':
      return 'Thông báo đang bị chặn';
    case 'unsupported':
      return 'Thiết bị/trình duyệt chưa hỗ trợ';
    default:
      return 'Chưa bật thông báo';
  }
}

function isIosDevice() {
  if (typeof navigator === 'undefined') {
    return false;
  }

  const userAgent = navigator.userAgent || '';
  return /iPhone|iPad|iPod/i.test(userAgent);
}

function isStandaloneDisplayMode() {
  if (typeof window === 'undefined') {
    return false;
  }

  const standaloneNavigator = window.navigator as Navigator & {
    standalone?: boolean;
  };

  return (
    window.matchMedia?.('(display-mode: standalone)').matches === true ||
    standaloneNavigator.standalone === true
  );
}

function formatPushError(error: unknown) {
  if (axios.isAxiosError(error)) {
    return JSON.stringify(
      {
        type: 'AxiosError',
        message: error.message,
        code: error.code,
        status: error.response?.status,
        statusText: error.response?.statusText,
        responseData: error.response?.data,
      },
      null,
      2,
    );
  }

  if (error instanceof Error) {
    const errorWithCause = error as Error & { cause?: unknown };
    return JSON.stringify(
      {
        type: error.name,
        message: error.message,
        stack: error.stack,
        cause: errorWithCause.cause ?? null,
      },
      null,
      2,
    );
  }

  return JSON.stringify(
    {
      type: typeof error,
      value: error,
    },
    null,
    2,
  );
}

const emptyDashboard: DashboardResponse = {
  totals: {
    totalCost: 0,
    totalMarketValue: 0,
    totalProfitLoss: 0,
  },
  byCategory: [],
  assets: [],
};

const emptyTaskSummary: TaskSummary = {
  totalTasks: 0,
  inProgressTasks: 0,
  dueSoonTasks: 0,
  completedTasks: 0,
  financialPlanningTasks: 0,
  averageFinancialProgress: 0,
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
  const [activePage, setActivePage] = useState<AppPage>('DASHBOARD');
  const [taskFilter, setTaskFilter] = useState<TaskViewFilter>('ALL');
  const [taskViewMode, setTaskViewMode] = useState<TaskViewMode>('CARD');
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [taskSummary, setTaskSummary] = useState<TaskSummary>(emptyTaskSummary);
  const [autoGoldRefreshTriggered, setAutoGoldRefreshTriggered] = useState(false);
  const [pushPermission, setPushPermission] = useState<PushPermissionState>(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'unsupported';
    }

    return Notification.permission;
  });
  const [pushDebugLog, setPushDebugLog] = useState<PushDebugEntry[]>([]);
  const [lastPushErrorDetails, setLastPushErrorDetails] = useState('');
  const [isEnablingPush, setIsEnablingPush] = useState(false);
  const [isSendingTestPush, setIsSendingTestPush] = useState(false);
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

  const appendPushDebugLog = (message: string) => {
    const entry = {
      time: new Date().toISOString(),
      message,
    };

    console.log('[push-debug]', entry);
    setPushDebugLog((current) => [...current.slice(-29), entry]);
  };

  const loadData = async () => {
    setLoading(true);
    setErrorMessage('');

    try {
      const [
        dashboardRes,
        categoriesRes,
        transactionsRes,
        pricesRes,
        tasksRes,
        taskSummaryRes,
      ] = await Promise.all([
        api.get<DashboardResponse>('/dashboard'),
        api.get<Category[]>('/categories'),
        api.get<LatestTransaction[]>('/transactions'),
        api.get<LatestPrice[]>('/prices/latest'),
        api.get<TaskItem[]>('/tasks'),
        api.get<TaskSummary>('/tasks/summary'),
      ]);

      const loadedDashboard = dashboardRes.data;
      const loadedCategories = categoriesRes.data;
      const loadedTransactions = transactionsRes.data;
      const loadedPrices = pricesRes.data;
      const loadedTasks = tasksRes.data;
      const loadedTaskSummary = taskSummaryRes.data;

      setDashboard(loadedDashboard);
      setCategories(loadedCategories);
      setTransactions(loadedTransactions);
      setLatestPrices(loadedPrices);
      setTasks(loadedTasks);
      setTaskSummary(loadedTaskSummary);

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
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setPushPermission('unsupported');
      return;
    }

    setPushPermission(Notification.permission);
  }, [isAuthenticated]);

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

  const filteredTasks = useMemo(
    () =>
      taskFilter === 'ALL'
        ? tasks
        : tasks.filter((task) => task.status === taskFilter),
    [taskFilter, tasks],
  );

  const handleTaskChange = async (
    taskId: number,
    field: TaskEditableField,
    value: string | boolean,
  ) => {
    const previousTasks = tasks;
    const previousTaskSummary = taskSummary;

    setTasks((currentTasks) =>
      currentTasks.map((task) => {
        if (task.id !== taskId) {
          return task;
        }

        if (field === 'progress') {
          return {
            ...task,
            progress: Number(value),
            updatedAt: new Date().toISOString(),
          };
        }

        if (field === 'isFinancialPlan') {
          return {
            ...task,
            isFinancialPlan: Boolean(value),
            progress: value ? task.progress : 0,
            updatedAt: new Date().toISOString(),
          };
        }

        return {
          ...task,
          [field]: value,
          updatedAt: new Date().toISOString(),
        };
      }),
    );

    try {
      await api.patch(`/tasks/${taskId}`, {
        [field]:
          field === 'progress'
            ? Number(value)
            : field === 'isFinancialPlan'
              ? Boolean(value)
              : value,
      });

      const [tasksRes, taskSummaryRes] = await Promise.all([
        api.get<TaskItem[]>('/tasks'),
        api.get<TaskSummary>('/tasks/summary'),
      ]);

      setTasks(tasksRes.data);
      setTaskSummary(taskSummaryRes.data);
    } catch (error) {
      setTasks(previousTasks);
      setTaskSummary(previousTaskSummary);

      if (axios.isAxiosError(error)) {
        showToast(
          'error',
          error.response?.data?.message || error.message || 'Không thể cập nhật task.',
        );
      } else {
        showToast('error', 'Không thể cập nhật task.');
      }
    }
  };

  const handleCreateTask = async (values: TaskFormValues) => {
    setSubmitting(true);
    clearToast();

    try {
      await api.post('/tasks', {
        title: values.title.trim(),
        description: values.description.trim(),
        note: values.note.trim(),
        status: values.status,
        priority: values.priority,
        dueDate: new Date(values.dueDate).toISOString(),
        owner: values.owner.trim(),
        category: values.category.trim(),
        isFinancialPlan: values.isFinancialPlan,
        progress: values.isFinancialPlan ? Number(values.progress || 0) : 0,
      });

      showToast('success', 'Đã thêm task thành công.');
      await loadData();
    } catch (error) {
      if (axios.isAxiosError(error)) {
        showToast(
          'error',
          error.response?.data?.message || error.message || 'Không thể tạo task.',
        );
      } else {
        showToast('error', 'Không thể tạo task.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteTask = async (taskId: number) => {
    setSubmitting(true);
    clearToast();

    try {
      await api.delete(`/tasks/${taskId}`);
      showToast('success', 'Đã xóa task thành công.');
      await loadData();
    } catch (error) {
      if (axios.isAxiosError(error)) {
        showToast(
          'error',
          error.response?.data?.message || error.message || 'Không thể xóa task.',
        );
      } else {
        showToast('error', 'Không thể xóa task.');
      }
    } finally {
      setSubmitting(false);
    }
  };

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
      setTasks([]);
      setTaskSummary(emptyTaskSummary);
    setAutoGoldRefreshTriggered(false);
    setLoading(false);
  };

  const handleEnablePushNotifications = async () => {
    const iosDevice = isIosDevice();
    const standaloneMode = isStandaloneDisplayMode();
    const hasWindow = typeof window !== 'undefined';
    const hasNotification = hasWindow && 'Notification' in window;
    const hasServiceWorker = typeof navigator !== 'undefined' && 'serviceWorker' in navigator;
    const hasPushManager = hasWindow && 'PushManager' in window;
    const isSecureContextValue = typeof window !== 'undefined' ? window.isSecureContext : false;

    setLastPushErrorDetails('');
    setPushDebugLog([]);

    appendPushDebugLog(`userAgent=${typeof navigator !== 'undefined' ? navigator.userAgent : 'n/a'}`);
    appendPushDebugLog(`platform=${typeof navigator !== 'undefined' ? navigator.platform : 'n/a'}`);
    appendPushDebugLog(`isIosDevice=${String(iosDevice)}`);
    appendPushDebugLog(`isStandaloneDisplayMode=${String(standaloneMode)}`);
    appendPushDebugLog(`isSecureContext=${String(isSecureContextValue)}`);
    appendPushDebugLog(`Notification supported=${String(hasNotification)}`);
    appendPushDebugLog(`serviceWorker supported=${String(hasServiceWorker)}`);
    appendPushDebugLog(`PushManager supported=${String(hasPushManager)}`);
    appendPushDebugLog(
      `Notification.permission=${hasNotification ? Notification.permission : 'unsupported'}`,
    );

    if (!hasWindow || !hasNotification || !hasServiceWorker || !hasPushManager) {
      appendPushDebugLog('Browser capability check failed.');
      showToast(
        'error',
        'Thiết bị hoặc trình duyệt hiện tại chưa hỗ trợ Web Push.',
      );
      setPushPermission('unsupported');
      setLastPushErrorDetails(
        JSON.stringify(
          {
            hasWindow,
            hasNotification,
            hasServiceWorker,
            hasPushManager,
            isSecureContext: isSecureContextValue,
            iosDevice,
            standaloneMode,
          },
          null,
          2,
        ),
      );
      return;
    }

    if (iosDevice && !standaloneMode) {
      const iosStandaloneMessage =
        'iPhone/iPad cần mở web app từ Home Screen (Add to Home Screen) rồi mới bật được Web Push.';
      appendPushDebugLog(iosStandaloneMessage);
      setLastPushErrorDetails(
        JSON.stringify(
          {
            reason: 'IOS_NOT_STANDALONE',
            iosDevice,
            standaloneMode,
            userAgent: navigator.userAgent,
          },
          null,
          2,
        ),
      );
      showToast('error', iosStandaloneMessage);
      return;
    }

    setIsEnablingPush(true);
    clearToast();

    try {
      appendPushDebugLog('Requesting notification permission...');
      const permission = await Notification.requestPermission();
      setPushPermission(permission);
      appendPushDebugLog(`Permission result=${permission}`);

      if (permission !== 'granted') {
        const permissionMessage =
          permission === 'denied'
            ? 'Bạn đã chặn thông báo. Hãy mở lại quyền thông báo trong cài đặt trình duyệt.'
            : 'Bạn chưa cấp quyền thông báo.';

        appendPushDebugLog(`Permission not granted: ${permission}`);
        setLastPushErrorDetails(
          JSON.stringify(
            {
              reason: 'PERMISSION_NOT_GRANTED',
              permission,
              iosDevice,
              standaloneMode,
            },
            null,
            2,
          ),
        );
        showToast('error', permissionMessage);
        return;
      }

      appendPushDebugLog('Waiting for service worker ready...');
      const [{ data }, registration] = await Promise.all([
        api.get<{ publicKey: string }>('/push-public-key'),
        navigator.serviceWorker.ready,
      ]);

      appendPushDebugLog(`Service worker scope=${registration.scope}`);
      appendPushDebugLog(
        `Service worker active=${String(Boolean(registration.active))}, waiting=${String(
          Boolean(registration.waiting),
        )}, installing=${String(Boolean(registration.installing))}`,
      );

      const publicKey = data.publicKey?.trim();
      appendPushDebugLog(`Fetched VAPID public key length=${publicKey?.length ?? 0}`);

      if (!publicKey) {
        throw new Error('WEB_PUSH_PUBLIC_KEY chưa được cấu hình hợp lệ.');
      }

      const applicationServerKey = base64UrlToUint8Array(publicKey);
      appendPushDebugLog(
        `Converted applicationServerKey byteLength=${applicationServerKey.byteLength}`,
      );

      const existingSubscription = await registration.pushManager.getSubscription();
      appendPushDebugLog(
        `Existing subscription found=${String(Boolean(existingSubscription))}`,
      );

      const subscription =
        existingSubscription ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey,
        }));

      appendPushDebugLog(`Subscription endpoint=${subscription.endpoint}`);
      appendPushDebugLog(
        `Subscription expirationTime=${String(subscription.expirationTime)}`,
      );

      const payload = {
        ...serializePushSubscription(subscription),
        userAgent: navigator.userAgent,
        platform: navigator.platform,
      };

      appendPushDebugLog('Sending subscription payload to backend...');
      await api.post('/push-subscriptions', payload);
      appendPushDebugLog('Subscription saved successfully on backend.');

      showToast(
        'success',
        'Đã bật thông báo thành công. Khi server gửi Web Push, thiết bị hỗ trợ của bạn trên Windows, Android hoặc iPhone/iPad sẽ hiển thị thông báo.',
      );
    } catch (error) {
      const formattedError = formatPushError(error);
      appendPushDebugLog(`Push flow failed: ${formattedError}`);
      setLastPushErrorDetails(formattedError);

      if (axios.isAxiosError(error)) {
        showToast(
          'error',
          error.response?.data?.message ||
            error.message ||
            'Không thể bật thông báo đẩy.',
        );
      } else if (error instanceof Error) {
        showToast('error', error.message || 'Không thể bật thông báo đẩy.');
      } else {
        showToast('error', 'Không thể bật thông báo đẩy.');
      }
    } finally {
      setIsEnablingPush(false);
    }
  };

  const handleSendTestPushNotification = async () => {
    setIsSendingTestPush(true);
    clearToast();

    try {
      appendPushDebugLog('Sending test push notification...');
      const response = await api.post<{
        sent: number;
        failed: number;
        total: number;
      }>('/push-notifications/send', {
        title: 'TradeView test notification',
        body: 'Nếu bạn thấy thông báo này, Web Push đang hoạt động bình thường.',
        url: '/',
      });

      appendPushDebugLog(
        `Test push response: sent=${response.data.sent}, failed=${response.data.failed}, total=${response.data.total}`,
      );

      if (response.data.total === 0) {
        showToast(
          'error',
          'Chưa có thiết bị nào đăng ký nhận push. Hãy bấm "Bật thông báo" trước.',
        );
        return;
      }

      if (response.data.sent > 0) {
        showToast(
          'success',
          `Đã gửi thông báo test thành công tới ${response.data.sent}/${response.data.total} subscription.`,
        );
        return;
      }

      showToast(
        'error',
        'Server đã thử gửi thông báo test nhưng không có subscription nào nhận thành công.',
      );
    } catch (error) {
      const formattedError = formatPushError(error);
      appendPushDebugLog(`Test push failed: ${formattedError}`);
      setLastPushErrorDetails(formattedError);

      if (axios.isAxiosError(error)) {
        showToast(
          'error',
          error.response?.data?.message ||
            error.message ||
            'Không thể gửi thông báo test.',
        );
      } else if (error instanceof Error) {
        showToast('error', error.message || 'Không thể gửi thông báo test.');
      } else {
        showToast('error', 'Không thể gửi thông báo test.');
      }
    } finally {
      setIsSendingTestPush(false);
    }
  };

  const handleShowLocalNotification = async () => {
    clearToast();

    try {
      appendPushDebugLog('Triggering local Notification API test...');

      if (typeof window === 'undefined' || !('Notification' in window)) {
        throw new Error('Trình duyệt hiện tại không hỗ trợ Notification API.');
      }

      if (Notification.permission !== 'granted') {
        throw new Error(
          `Notification.permission hiện tại là "${Notification.permission}", chưa thể hiển thị notification cục bộ.`,
        );
      }

      const notification = new Notification('TradeView local notification test', {
        body: 'Nếu bạn thấy popup này, vấn đề không nằm ở Windows Notification API cơ bản.',
        tag: `tradeview-local-${Date.now()}`,
        requireInteraction: true,
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
      };

      appendPushDebugLog('Local Notification API call completed.');
      showToast(
        'success',
        'Đã gọi Notification API cục bộ. Nếu vẫn không thấy popup, nguyên nhân nhiều khả năng nằm ở Windows/trình duyệt đang chặn hiển thị toast.',
      );
    } catch (error) {
      const formattedError = formatPushError(error);
      appendPushDebugLog(`Local notification test failed: ${formattedError}`);
      setLastPushErrorDetails(formattedError);

      if (error instanceof Error) {
        showToast('error', error.message);
      } else {
        showToast('error', 'Không thể hiển thị thông báo cục bộ.');
      }
    }
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
      <PushNotificationSection
        pushPermission={pushPermission}
        isEnablingPush={isEnablingPush}
        isSendingTestPush={isSendingTestPush}
        lastPushErrorDetails={lastPushErrorDetails}
        pushDebugLog={pushDebugLog}
        getPushPermissionLabel={getPushPermissionLabel}
        isIosDevice={isIosDevice}
        isStandaloneDisplayMode={isStandaloneDisplayMode}
        onEnablePushNotifications={handleEnablePushNotifications}
        onShowLocalNotification={handleShowLocalNotification}
        onSendTestPushNotification={handleSendTestPushNotification}
      />

      <AppHeader
        activePage={activePage}
        totalMarketValue={dashboard.totals.totalMarketValue}
        totalProfitLoss={dashboard.totals.totalProfitLoss}
        onNavigate={setActivePage}
        onLogout={handleLogout}
        showFinancialSummary={activePage === 'DASHBOARD'}
      />

      <LoadingSection loading={loading} />

      <ToastStack
        errorMessage={errorMessage}
        successMessage={successMessage}
        onClose={clearToast}
      />

      {activePage === 'DASHBOARD' ? (
        <>
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
        </>
      ) : (
        <TaskManagementPage
          tasks={filteredTasks}
          summary={taskSummary}
          activeFilter={taskFilter}
          viewMode={taskViewMode}
          submitting={submitting}
          onFilterChange={setTaskFilter}
          onViewModeChange={setTaskViewMode}
          onCreateTask={(values) => {
            void handleCreateTask(values);
          }}
          onTaskChange={(taskId, field, value) => {
            void handleTaskChange(taskId, field, value);
          }}
          onDeleteTask={(taskId) => {
            void handleDeleteTask(taskId);
          }}
        />
      )}

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