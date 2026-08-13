self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  const payload = (() => {
    if (!event.data) {
      return {
        title: 'KT Family',
        body: 'Bạn có thông báo mới.',
        url: '/',
      };
    }

    try {
      return event.data.json();
    } catch {
      return {
        title: 'KT Family',
        body: event.data.text(),
        url: '/',
      };
    }
  })();

  const title = payload.title || 'KT Family';
  const body = payload.body || 'Bạn có thông báo mới.';
  const url = payload.url || '/';
  const timestamp = Date.now();

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag: `tradeview-${timestamp}`,
      renotify: true,
      requireInteraction: true,
      silent: false,
      timestamp,
      data: {
        url,
        timestamp,
      },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          client.focus();
          if ('navigate' in client) {
            client.navigate(targetUrl);
          }
          return;
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }

      return undefined;
    }),
  );
});