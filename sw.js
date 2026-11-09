/* AKSAN OMR PWA — Service Worker 2.5.0
 * Uygulama kabuğunu çevrimdışı kullanım için önbelleğe alır.
 * POST istekleri ve farklı alan adlarına giden istekler önbelleğe alınmaz.
 * Güncelleme: VERSION değerini değiştirerek eski uygulama önbelleğini yeniler.
 */
'use strict';

const VERSION = 'aksan-omr-v5';

const SHELL = [
  './',
  'index.html',
  'style.css',
  'omr-core.js',
  'katalog.js',
  'scoring.js',
  'app.js',
  'queue.js',
  'scan.js',
  'camera.js',
  'results.js',
  'exams.js',
  'forms.js',
  'admin.js',
  'boot.js',
  'worker.js',
  'manifest.webmanifest',
  'icon.svg',
  'icon-192.png',
  'icon-512.png'
];

// PDF motorunun yardımcı dosyaları: bunlardan biri yoksa kurulum iptal edilmez.
const OPTIONAL = [
  'vendor/pdf.min.js',
  'vendor/pdf.worker.min.js',
  'vendor/wasm/jbig2.wasm',
  'vendor/wasm/openjpeg.wasm',
  'vendor/wasm/qcms_bg.wasm'
];

const APP_CACHE = VERSION;

function isSameOriginGet(request, url) {
  return request.method === 'GET' && url.origin === self.location.origin;
}

function isBackendRequest(url) {
  // Apps Script ve olası API uç noktaları hiçbir koşulda uygulama önbelleğine alınmaz.
  return /\/(exec|api)(\/|$)/i.test(url.pathname) ||
         /script\.google\.com|googleapis\.com/i.test(url.hostname);
}

async function cacheResponse(request, response) {
  if (!response || !response.ok || response.type === 'opaque') return;
  const cache = await caches.open(APP_CACHE);
  await cache.put(request, response.clone());
}

async function networkFirst(request, isNavigation) {
  const cache = await caches.open(APP_CACHE);

  try {
    const response = await fetch(request);
    if (response && response.ok) {
      // Yanıtı kullanıcıya geciktirmeden önbelleğe yaz.
      cacheResponse(request, response).catch(() => {});
    }
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) return cached;

    // Yalnızca sayfa gezinmelerinde ana sayfaya dön.
    if (isNavigation) {
      const home = await cache.match('index.html') || await cache.match('./');
      if (home) return home;
    }

    return new Response(
      isNavigation
        ? 'Uygulama çevrimdışı ve önbellekte başlangıç sayfası bulunamadı.'
        : 'İstenen dosya çevrimdışı önbellekte bulunamadı.',
      {
        status: 503,
        statusText: 'Service Unavailable',
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      }
    );
  }
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(APP_CACHE);

    // Temel dosyalardan biri eksikse kurulumun sessizce yarım kalmasını önlemek için
    // addAll kullanılır. Dosya yolları mevcut proje yapısıyla aynı tutulmuştur.
    await cache.addAll(SHELL);

    // PDF bağımlılıkları isteğe bağlıdır.
    await Promise.allSettled(
      OPTIONAL.map(path => cache.add(path))
    );

    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter(key => key !== APP_CACHE)
        .map(key => caches.delete(key))
    );

    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);

  // POST, başka alan adı ve API istekleri: servis çalışanı araya girmez.
  if (!isSameOriginGet(request, url) || isBackendRequest(url)) return;

  const isNavigation = request.mode === 'navigate';

  event.respondWith(networkFirst(request, isNavigation));
});
