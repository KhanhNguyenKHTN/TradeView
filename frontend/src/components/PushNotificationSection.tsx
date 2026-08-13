type PushPermissionState = NotificationPermission | 'unsupported';

type PushDebugEntry = {
  time: string;
  message: string;
};

type PushNotificationSectionProps = {
  pushPermission: PushPermissionState;
  isEnablingPush: boolean;
  isSendingTestPush: boolean;
  lastPushErrorDetails: string;
  pushDebugLog: PushDebugEntry[];
  getPushPermissionLabel: (permission: PushPermissionState) => string;
  isIosDevice: () => boolean;
  isStandaloneDisplayMode: () => boolean;
  onEnablePushNotifications: () => void | Promise<void>;
  onShowLocalNotification: () => void | Promise<void>;
  onSendTestPushNotification: () => void | Promise<void>;
};

function PushNotificationSection({
  pushPermission,
  isEnablingPush,
  isSendingTestPush,
  lastPushErrorDetails,
  pushDebugLog,
  getPushPermissionLabel,
  isIosDevice,
  isStandaloneDisplayMode,
  onEnablePushNotifications,
  onShowLocalNotification,
  onSendTestPushNotification,
}: PushNotificationSectionProps) {
  void isSendingTestPush;
  void lastPushErrorDetails;
  void pushDebugLog;
  void isIosDevice;
  void isStandaloneDisplayMode;
  void onShowLocalNotification;
  void onSendTestPushNotification;

  if (pushPermission === 'unsupported' || pushPermission === 'granted') {
    return null;
  }

  return (
    <section className="section">
      <div className="panel">
        <div className="section-heading">
          <div>
            <span className="section-kicker">Thông báo</span>
            <h2>Web Push cho Safari / Home Screen</h2>
          </div>
        </div>

        <div className="quick-actions-hint">
          <p>
            Trạng thái: <strong>{getPushPermissionLabel(pushPermission)}</strong>
          </p>
          <p>
            iPhone/iPad: mở bằng Safari, chọn <strong>Chia sẻ - Thêm vào Màn hình chính</strong>
          </p>
          <p>
            Mở lại từ <strong>icon ngoài màn hình chính</strong>, rồi bấm nút bên dưới để cấp quyền thông báo.
          </p>
          <p>
            Android/Windows: chỉ cần dùng trình duyệt có hỗ trợ Web Push và cấp quyền thông báo.
          </p>
        </div>

        <div className="row mt-2">
          <button
            type="button"
            className="primary-button"
            onClick={() => {
              void onEnablePushNotifications();
            }}
            disabled={isEnablingPush}
          >
            {isEnablingPush ? 'Đang bật thông báo...' : 'Bật thông báo'}
          </button>

          {/* <button
            type="button"
            className="secondary-button"
            onClick={() => {
              onShowLocalNotification();
            }}
            disabled={
              pushPermission === 'unsupported' || pushPermission !== 'granted'
            }
          >
            Hiện thông báo cục bộ
          </button>

          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              void onSendTestPushNotification();
            }}
            disabled={
              isSendingTestPush ||
              pushPermission === 'unsupported' ||
              pushPermission !== 'granted'
            }
          >
            {isSendingTestPush ? 'Đang gửi test...' : 'Gửi thông báo test'}
          </button> */}
        </div>

        {/* <div className="quick-actions-hint mt-2">
          <p>
            <strong>Debug nhanh:</strong>
          </p>
          <p>iPhone chỉ hoạt động khi mở từ Home Screen và website chạy HTTPS.</p>
          <p>
            Trên Windows/Android, hãy bấm lần lượt <strong>Hiện thông báo cục bộ</strong> rồi{' '}
            <strong>Gửi thông báo test</strong> để xác minh tách biệt giữa Notification API cơ bản và Web Push.
          </p>
          <p>
            Nếu lỗi, kéo xuống phần debug bên dưới và copy toàn bộ nội dung <strong>Chi tiết lỗi</strong>.
          </p>
        </div>

        <div className="panel mt-2">
          <h3>Push debug</h3>
          <p>
            iOS device: <strong>{isIosDevice() ? 'Yes' : 'No'}</strong> · Standalone:{' '}
            <strong>{isStandaloneDisplayMode() ? 'Yes' : 'No'}</strong> · Secure context:{' '}
            <strong>{typeof window !== 'undefined' && window.isSecureContext ? 'Yes' : 'No'}</strong>
          </p>
          <p>
            Notification: <strong>{typeof window !== 'undefined' && 'Notification' in window ? 'Yes' : 'No'}</strong> ·
            Service Worker:{' '}
            <strong>{typeof navigator !== 'undefined' && 'serviceWorker' in navigator ? 'Yes' : 'No'}</strong> ·
            PushManager: <strong>{typeof window !== 'undefined' && 'PushManager' in window ? 'Yes' : 'No'}</strong>
          </p>

          <details className="mt-2" open>
            <summary>Nhật ký debug</summary>
            <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {pushDebugLog.length > 0
                ? pushDebugLog
                    .map((entry) => `[${entry.time}] ${entry.message}`)
                    .join('\n')
                : 'Chưa có log. Hãy bấm "Bật thông báo" để bắt đầu debug.'}
            </pre>
          </details>

          <details className="mt-2" open={Boolean(lastPushErrorDetails)}>
            <summary>Chi tiết lỗi</summary>
            <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {lastPushErrorDetails || 'Chưa có lỗi nào được ghi nhận.'}
            </pre>
          </details>
        </div> */}
      </div>
    </section>
  );
}

export default PushNotificationSection;