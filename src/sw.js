import { precacheAndRoute } from 'workbox-precaching';

// Precachear todos los assets generados por Vite
precacheAndRoute(self.__WB_MANIFEST);

self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : { title: 'Recordatorio', body: 'Es hora de tu pastilla.' };
  
  const options = {
    body: data.body,
    icon: data.icon || '/pwa-192x192.png',
    badge: '/favicon.png',
    vibrate: [200, 100, 200],
    data: {
      url: '/'
    }
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow('/')
  );
});
