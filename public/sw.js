/* Unclinq service worker — minimal + safe.
 * Purpose: make the app installable (Add to Home Screen) and speed up repeat
 * loads, WITHOUT ever serving stale HTML or caching API responses.
 *
 * Strategy:
 *  - /api/*            → never handled here (always network; lives on api.unclinq.com anyway)
 *  - cross-origin      → ignored (Meta pixel, PostHog, fonts, etc.)
 *  - /assets/* (hashed, immutable) → cache-first (safe: filenames change per build)
 *  - navigations/HTML  → network-first, fall back to cache only when offline
 */
const CACHE = 'unclinq-v2';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // let cross-origin (API/pixel/fonts) pass through
  if (url.pathname.startsWith('/api')) return;      // never cache API

  // Hashed build assets are immutable → cache-first.
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const hit = await cache.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) cache.put(req, res.clone());
      return res;
    })());
    return;
  }

  // Navigations / everything else → network-first (fresh HTML online),
  // fall back to the last-cached page (or the app shell) when offline.
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const res = await fetch(req);
      if (res.ok && req.mode === 'navigate') cache.put(req, res.clone());
      return res;
    } catch (_) {
      const hit = await cache.match(req);
      return hit || (await cache.match('/')) || Response.error();
    }
  })());
});

/* ── Web Push ──────────────────────────────────────────────────────────────
 * Payload (JSON) sent from backend/src/services/push.js:
 *   { title, body, url, icon, badge, tag }
 * `url` is where a tap should take the user (defaults to the app root).
 */
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (_) { data = {}; }

  const title = data.title || 'Unclinq';
  const options = {
    body: data.body || '',
    icon: data.icon || '/icon-192.png',
    badge: data.badge || '/icon-192.png',
    tag: data.tag || undefined,
    data: { url: data.url || '/' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/';
  // Absolute (https://app.unclinq.com/...) or path-relative — both resolve here.
  const url = new URL(target, self.location.origin).href;

  event.waitUntil((async () => {
    const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    // If the app is already open, focus it (and route it, for hash links).
    for (const client of clientList) {
      if ('focus' in client) {
        client.focus();
        if ('navigate' in client && client.url !== url) client.navigate(url).catch(() => {});
        return;
      }
    }
    if (self.clients.openWindow) await self.clients.openWindow(url);
  })());
});
