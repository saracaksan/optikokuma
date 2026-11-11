/* Servis çalışanı: uygulama kabuğunu önbelleğe alır (çevrimdışı açılış). API istekleri (Apps Script) asla önbelleğe alınmaz. */
const VERSION = 'optik-v7';
const SHELL = ['./', 'index.html', 'config.js', 'style.css', 'omr-core.js', 'katalog.js', 'scoring.js', 'app.js', 'queue.js', 'scan.js', 'camera.js', 'results.js', 'exams.js', 'forms.js', 'admin.js', 'kayit.js', 'veli.js', 'boot.js', 'worker.js', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png'];
const OPTIONAL = ['vendor/pdf.min.js', 'vendor/pdf.worker.min.js', 'vendor/wasm/jbig2.wasm', 'vendor/wasm/openjpeg.wasm', 'vendor/wasm/qcms_bg.wasm'];   // PDF okuma; indirilemezse kurulum yine de tamamlanır
self.addEventListener('install', e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL).then(() => Promise.allSettled(OPTIONAL.map(u => c.add(u))))).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;     // POST ve başka alan adları: ağa bırak
  e.respondWith(
    fetch(e.request).then(r => { if (r.ok) { const cp = r.clone(); caches.open(VERSION).then(c => c.put(e.request, cp)); } return r; })   // önce ağ (güncel kod)
      .catch(() => caches.match(e.request).then(r => r || caches.match('index.html')))
  );
});
