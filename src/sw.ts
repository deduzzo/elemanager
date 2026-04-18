/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { clientsClaim } from 'workbox-core';

declare const self: ServiceWorkerGlobalScope;

self.skipWaiting();
clientsClaim();
cleanupOutdatedCaches();

// __WB_MANIFEST injected by Workbox at build time
precacheAndRoute(self.__WB_MANIFEST ?? []);

self.addEventListener('push', (event) => {
  let data: { title?: string; body?: string; url?: string } = {};
  try {
    data = event.data?.json() ?? {};
  } catch {
    data = { body: event.data?.text() ?? '' };
  }
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'Elemanager', {
      body: data.body ?? '',
      icon: '/pwa-192.png',
      badge: '/favicon.svg',
      data: { url: data.url ?? '/' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data as { url?: string })?.url ?? '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(url) && 'focus' in client) return client.focus();
      }
      return self.clients.openWindow(url);
    }),
  );
});
