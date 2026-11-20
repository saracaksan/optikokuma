/* kur.js — "Uygulamayı yükle" (PWA): Android ve masaüstü Chrome/Edge'de tek dokunuşla (beforeinstallprompt),
 * iPhone/iPad'de ise Safari'nin "Ana Ekrana Ekle" adımlarını gösteren yönlendirme.
 * Uygulama zaten yüklü ve ana ekrandan açılmışsa hiçbir yükleme düğmesi görünmez.
 * Bu dosya, "beforeinstallprompt" olayını kaçırmamak için diğer betiklerden ÖNCE yüklenir; arayüz yardımcıları (h, modal, toast)
 * yalnızca çağrı anında kullanılır. */
'use strict';

const Install = (() => {
  const ua = navigator.userAgent || '', plat = navigator.platform || '';
  const ios = /iPad|iPhone|iPod/.test(ua) || (plat === 'MacIntel' && navigator.maxTouchPoints > 1);
  const android = /Android/i.test(ua);
  const iosOther = ios && /CriOS|FxiOS|EdgiOS|OPiOS|GSA\//.test(ua);          // iPhone'da Chrome / Firefox / Edge
  const inApp = /FBAN|FBAV|Instagram|MicroMessenger|Snapchat|Line\/|Twitter|TikTok|; wv\)/i.test(ua) || (ios && !/Safari\//.test(ua) && !iosOther);
  const samsung = /SamsungBrowser/i.test(ua), firefox = /Firefox|FxiOS/i.test(ua), edge = /Edg\//.test(ua);
  const phone = ios || android, KEY = 'optinet-install-dismiss';
  let deferred = null, installed = false; const subs = [];

  const standalone = () => {
    try { if (navigator.standalone === true) return true; return ['standalone', 'fullscreen', 'minimal-ui'].some(m => window.matchMedia('(display-mode: ' + m + ')').matches); } catch (e) { return false; }
  };
  const visible = () => !installed && !standalone();
  const notify = () => { for (let i = subs.length - 1; i >= 0; i--) { const s = subs[i]; if (s.el && !s.el.isConnected && s.seen) { subs.splice(i, 1); continue; } if (s.el && s.el.isConnected) s.seen = true; try { s.fn(); } catch (e) { } } };
  /** Bir öğenin görünürlüğünü (yüklü değilse göster) kendiliğinden günceller */
  const track = (el, extra) => { const fn = () => { el.hidden = !visible() || (extra ? !extra() : false); }; subs.push({ el, fn, seen: false }); fn(); return el; };

  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; notify(); });
  window.addEventListener('appinstalled', () => { deferred = null; installed = true; clearBanner(); notify(); try { toast('OptiNet yüklendi. Ana ekranınızdan açabilirsiniz.'); } catch (e) { } });
  try { window.matchMedia('(display-mode: standalone)').addEventListener('change', notify); } catch (e) { }

  /* ---- adım adım yönergeler ---- */
  const svg = (paths, cls) => { const NS = 'http://www.w3.org/2000/svg', s = document.createElementNS(NS, 'svg'); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('width', '20'); s.setAttribute('height', '20'); s.setAttribute('class', 'inst-ico ' + (cls || '')); s.setAttribute('aria-hidden', 'true'); paths.forEach(d => { const p = document.createElementNS(NS, 'path'); p.setAttribute('d', d); s.append(p); }); return s; };
  const ICONS = {
    paylas: () => svg(['M12 3v12', 'M8 7l4-4 4 4', 'M7 11H6a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1']),
    ekle: () => svg(['M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z', 'M12 8v8', 'M8 12h8']),
    yukle: () => svg(['M12 3v12', 'M7 11l5 5 5-5', 'M5 21h14'])
  };
  /** **kalın** ve {simge} işaretlerini düğümlere çevirir */
  const md = s => String(s).split(/(\*\*.+?\*\*|\{\w+\})/).filter(Boolean).map(t => (t[0] === '*' ? h('b', null, t.slice(2, -2)) : t[0] === '{' && ICONS[t.slice(1, -1)] ? ICONS[t.slice(1, -1)]() : t));
  const steps = list => h('ol', { class: 'inst-steps' }, list.map(s => h('li', null, md(s))));
  function guide() {
    if (inApp) return { title: 'Önce tarayıcıda açın', body: [h('p', null, md('Bu sayfa WhatsApp, Instagram gibi bir uygulamanın **içinde** açılmış; buradan yüklenemez.')), steps(['Sağ üstteki **⋯** (ya da **⋮**) menüsüne dokunun.', ios ? '**Safari\'de aç** seçeneğini seçin.' : '**Tarayıcıda aç** (Chrome) seçeneğini seçin.', 'Açılan sayfada **Yükle** düğmesine yeniden dokunun.'])] };
    if (ios && !iosOther) return { title: 'iPhone / iPad: Ana Ekrana Ekle', body: [steps(['Safari\'de ekranın altındaki (iPad\'de üstteki) **Paylaş** {paylas} düğmesine dokunun. Düğmeyi görmüyorsanız sağ alttaki **⋯** menüsünden **Paylaş**\'ı seçin.', 'Açılan listeyi yukarı kaydırıp **Ana Ekrana Ekle** {ekle} satırına dokunun.', 'Adı **OptiNet** olarak bırakın, sağ üstteki **Ekle**\'ye dokunun.', 'OptiNet simgesi ana ekranınızda belirir; oradan açınca tam ekran, adres çubuğu olmadan çalışır.']), h('p', { class: 'small muted' }, 'Bu adımlar yalnızca bir kez gerekir. Okutulan kâğıtlar internet yokken de cihazda saklanır, bağlanınca gönderilir.')] };
    if (ios) return { title: 'iPhone / iPad: Ana Ekrana Ekle', body: [steps(['Adres çubuğunun yanındaki (ya da altındaki) **Paylaş** {paylas} düğmesine dokunun.', '**Ana Ekrana Ekle** {ekle} satırını seçin ve **Ekle**\'ye dokunun.']), h('p', { class: 'small muted' }, md('Paylaş menüsünde **Ana Ekrana Ekle** görünmüyorsa bu sayfayı **Safari**\'de açıp aynı adımları uygulayın (iOS 16.4 ve üzeri dışındaki sürümlerde yalnızca Safari ile eklenebilir).'))] };
    if (samsung) return { title: 'Samsung Internet: Uygulamayı yükle', body: [steps(['Adres çubuğunun sağındaki **Yükle** {yukle} simgesine dokunun.', 'Simge yoksa **☰** menüsünden **Geçerli sayfayı ekle → Ana ekran**\'ı seçin.', '**Yükle** / **Ekle**\'ye dokunun.'])] };
    if (android) return { title: 'Android: Uygulamayı yükle', body: [steps([firefox ? 'Sağ üstteki **⋮** menüsüne dokunun, **Yükle**\'yi seçin.' : 'Sağ üstteki **⋮** menüsüne dokunun, **Uygulamayı yükle** (ya da **Ana ekrana ekle**) seçeneğini seçin.', 'Açılan kutuda **Yükle**\'ye dokunun.', 'OptiNet simgesi ana ekranınızda (ve uygulama listenizde) belirir.']), h('p', { class: 'small muted' }, 'Seçenek görünmüyorsa sayfayı yenileyip birkaç saniye bekleyin. Uygulama zaten yüklüyse ana ekranınızda OptiNet simgesini arayın.')] };
    if (firefox) return { title: 'Bu tarayıcıda yüklenemiyor', body: [h('p', null, md('Firefox masaüstünde uygulama yükleme desteklenmiyor. **Chrome** ya da **Edge** ile açıp adres çubuğundaki **Yükle** {yukle} simgesini kullanabilirsiniz.'))] };
    return { title: 'Bilgisayara yükle', body: [steps(['Adres çubuğunun sağındaki **Yükle** {yukle} simgesine tıklayın (Edge\'de: **⋯ → Uygulamalar → Bu siteyi uygulama olarak yükle**).', 'Açılan kutuda **Yükle**\'ye tıklayın.', 'OptiNet ayrı bir pencerede, kendi simgesiyle açılır.']), h('p', { class: 'small muted' }, md('Safari (Mac): **Dosya → Dock\'a Ekle**. Seçenek yoksa Chrome ya da Edge kullanın.'))] };
  }
  function help() {
    const g = guide(); modal(g.title, h('div', { class: 'inst-help' }, g.body, h('p', { class: 'small muted', style: { marginBottom: 0 } }, 'Yükleyince: ana ekrandan tek dokunuşla açılır, tam ekran çalışır ve internet olmasa da okutmaya devam edebilirsiniz.')), { buttons: [{ label: 'Tamam', cls: 'primary' }] });
  }

  /** Yükle: tarayıcı hazırsa yerel yükleme kutusunu açar, değilse yönergeleri gösterir */
  async function start() {
    if (deferred) {
      const d = deferred; deferred = null; notify();
      try { await d.prompt(); const c = await d.userChoice; if (!c || c.outcome !== 'accepted') { try { toast('Yükleme iptal edildi. İsterseniz "Yükle" düğmesinden yeniden deneyebilirsiniz.'); } catch (e) { } } }
      catch (e) { help(); }
      return;
    }
    help();
  }

  /* ---- arayüz parçaları ---- */
  const logoSrc = 'icon-192.png';
  /** Giriş ve veli sayfalarında gösterilen kart */
  function card() {
    const el = h('div', { class: 'install-card no-print', id: 'install-card' }, h('img', { src: logoSrc, alt: '', width: 44, height: 44 }),
      h('div', { class: 't' }, h('b', null, ios || android ? 'OptiNet\'i telefonunuza yükleyin' : 'OptiNet\'i bilgisayara yükleyin'), h('span', { class: 'small muted' }, 'Ana ekrandan tek dokunuşla açılır, internet yokken de çalışır.')),
      h('button', { class: 'btn primary', type: 'button', id: 'install-btn', onclick: start }, ios ? 'Ana ekrana ekle' : 'Uygulamayı kur'));
    return track(el);
  }
  /** Üst çubuktaki küçük düğme */
  function topButton() {
    const el = h('button', { class: 'btn sm install-top no-print', type: 'button', id: 'install-top', title: 'OptiNet\'i ana ekrana / bilgisayara kur', 'aria-label': 'Uygulamayı kur', onclick: start }, ICONS.yukle(), h('span', { class: 'it-txt' }, ' Uygulamayı kur'));
    return track(el);
  }
  const dismissedRecently = () => { try { const t = +localStorage.getItem(KEY) || 0; return t && Date.now() - t < 14 * 864e5; } catch (e) { return false; } };
  function clearBanner() { const b = document.getElementById('install-banner'); if (b) b.remove(); }
  /** Telefonlarda uygulamaya girince bir kez gösterilen kapatılabilir şerit (14 gün hatırlar) */
  function banner() {
    clearBanner(); if (!phone || !visible() || dismissedRecently()) return null;
    const close = () => { try { localStorage.setItem(KEY, String(Date.now())); } catch (e) { } clearBanner(); };
    const el = h('div', { class: 'install-banner no-print', id: 'install-banner', role: 'region', 'aria-label': 'Uygulamayı yükle' }, h('img', { src: logoSrc, alt: '', width: 40, height: 40 }),
      h('div', { class: 't' }, h('b', null, 'OptiNet\'i ana ekrana ekleyin'), h('span', { class: 'small muted' }, 'Daha hızlı açılır, çevrimdışı çalışır.')),
      h('button', { class: 'btn primary sm', type: 'button', id: 'install-banner-btn', onclick: () => { close(); start(); } }, ios ? 'Nasıl?' : 'Kur'),
      h('button', { class: 'btn ghost sm', type: 'button', id: 'install-banner-x', 'aria-label': 'Şimdilik gösterme', onclick: close }, '✕'));
    document.body.append(el); return track(el);
  }
  return { env: { ios, android, iosOther, inApp, samsung, firefox, edge, phone }, standalone, visible, start, help, card, topButton, banner, clearBanner, hasPrompt: () => !!deferred };
})();
