/* Офлайн-оболонка: precache + stale-while-revalidate. */
const CACHE = 'rookh-v1';
const ASSETS = [
  './', './index.html', './manifest.webmanifest',
  './css/app.css?v=1', './css/app.css',
  './js/main.js?v=1', './js/main.js',
  './js/util.js', './js/db.js', './js/state.js', './js/engine.js', './js/recipes.js',
  './js/photos.js', './js/ui.js', './js/actions.js', './js/backup.js', './js/backup-actions.js',
  './js/notifications.js',
  './js/render/index.js', './js/render/common.js', './js/render/today.js',
  './js/render/habit.js', './js/render/stats.js', './js/render/settings.js',
  './js/render/editor.js', './js/render/sheets.js',
  './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.allSettled(ASSETS.map(a => c.add(a)))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(r => { caches.open(CACHE).then(c => c.put('./index.html', r.clone())); return r; })
        .catch(() => caches.match('./index.html').then(r => r || caches.match('./')))
    );
    return;
  }
  e.respondWith(
    caches.match(req).then(cached => {
      const net = fetch(req).then(r => {
        if (r && r.status === 200) caches.open(CACHE).then(c => c.put(req, r.clone()));
        return r;
      }).catch(() => cached || new Response('', { status: 504, statusText: 'offline' }));
      return cached || net;
    })
  );
});
