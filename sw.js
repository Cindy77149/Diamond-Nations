const CACHE = 'diamond-nations-v88';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './style.css',
  './game-core.js',
  './game.js',
  './players-all.js',
  './players-data.js',
  './nations-data.js',
  './packs-data.js',
  './coaches-data.js',
  './eras-data.js',
  './nations/tw.js',
  './nations/jp.js',
  './nations/us.js',
  './nations/do.js',
  './nations/ve.js',
  './nations/kr.js',
  './nations/cu.js',
  './nations/pr.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const { request } = e;
  const acceptsHtml = request.headers.get('accept')?.includes('text/html');

  // HTML 一律優先抓新版，避免畫面一直卡在舊快取
  if (request.mode === 'navigate' || acceptsHtml) {
    e.respondWith(
      fetch(request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request, { ignoreSearch: true }).then(cached => cached || caches.match('./index.html', { ignoreSearch: true })))
    );
    return;
  }

  e.respondWith(
    caches.match(request, { ignoreSearch: true }).then(cached => cached || fetch(request))
  );
});
