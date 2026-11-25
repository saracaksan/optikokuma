/* sw.js — Service Worker (çevrimdışı önbellek ve sürüm yönetimi)
 * Sıraç Aksan Optik Okuma · Telif Hakkı © Sıraç AKSAN (İzinsiz kopyalamak, dağıtmak veya telif atmak ayıptır.)
 */
'use strict';

const CACHE = 'optik-v24';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './config.js',
  './manifest.json',
  './scoring.js',
  './omr.js',
  './omr-detect.js',
  './katalog.js',
  './worker.js',
  './app.js',
  './exams.js',
  './forms.js',
  './forms-ai.js',
  './scan.js',
  './camera.js',
  './queue.js',
  './results.js',
  './analiz.js',
  './analiz-viz.js',
  './analiz-ogr.js',
  './analiz-sinif.js',
  './analiz-okul.js',
  './analiz-karne.js',
  './dis-sinav.js',
  './admin.js',
  './veli.js',
  './veli-wa.js',
  './kilavuz.js',
  './kilavuz-icerik.js',
  './kilavuz-icerik-2.js'
];

self.addEventListener('install', (ev) => {
  ev.waitUntil(
    caches.open(CACHE).then((cache) =>
      Promise.all(
        ASSETS.map((url) =>
          cache.add(new Request(url, { cache: 'reload' })).catch(() => { /* eksik opsiyonel dosya kurulumu durdurmasın */ })
        )
      )
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (ev) => {
  ev.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (ev) => {
  const req = ev.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Apps Script / harici API çağrıları her zaman ağdan gider, önbelleğe alınmaz
  if (url.origin !== location.origin) return;

  // Gezinme ve uygulama dosyaları: ağ öncelikli, çevrimdışında önbellekten dön
  ev.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.ok && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match('./index.html')))
  );
});
