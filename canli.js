/* canli.js — canlı arayüz: dosya seçici durumu, tıklama / seçim animasyonları, "çalışıyor" geri bildirimi.
   app.js'ten sonra yüklenir. Görünüm kuralları style.css'te ("Canlı arayüz"); hareketler prefers-reduced-motion'a saygı duyar. */
'use strict';

/* ------------------------------------------------------------------ dosya seçici
   Tarayıcının "Dosya seçilmedi" yazısı yerine, seçilen dosyanın adı ve boyutu görünür; okunurken dönen simge ve üstte çubuk çalışır.
   Modüller seçimden sonra input.value = '' yapsa bile durum çipi kalır (dosya bilgisi değişiklikten hemen önce kopyalanır).
   app.js h(), <input type=file> için onchange'i FilePick.wrap ile sarar; böylece tüm dosya girişleri otomatik çalışır. */
const FilePick = (() => {
  const SVGNS = 'http://www.w3.org/2000/svg';
  const size = n => n < 1024 ? n + ' B' : n < 1048576 ? nf(n / 1024, 0) + ' KB' : nf(n / 1048576, 1) + ' MB';
  const desc = fl => fl.length === 1 ? fl[0].name : fl.length + ' dosya';
  const total = fl => fl.reduce((t, f) => t + (f.size || 0), 0);
  const tik = () => { const s = document.createElementNS(SVGNS, 'svg'); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('class', 'fp-tik'); s.setAttribute('aria-hidden', 'true'); const p = document.createElementNS(SVGNS, 'path'); p.setAttribute('d', 'M5 12.5l4.5 4.5L19 7'); s.append(p); return s; };

  /** Girişin yanındaki durum çipi (yoksa oluşturur; giriş sayfadaysa hemen yanına yerleştirir). */
  function chip(inp) {
    if (!inp._fp) inp._fp = h('span', { class: 'fp-chip', role: 'status', 'aria-live': 'polite' });
    if (!inp._fp.parentNode && inp.parentNode) inp.after(inp._fp);   // henüz hiçbir yere konmadıysa girişin yanına
    return inp._fp;
  }
  /** state: empty | busy | done | error */
  function show(inp, files, state) {
    const c = chip(inp); c.className = 'fp-chip ' + state; clear(c); c.dataset.state = state;
    const host = inp.closest('.fp'); if (host) { host.classList.toggle('has', state !== 'empty'); host.dataset.state = state; }
    if (state === 'empty') { c.append('Henüz dosya seçilmedi'); c.removeAttribute('title'); return; }
    c.title = files.map(f => f.name).join('\n');
    const lead = state === 'busy' ? h('i', { class: 'fp-spin', 'aria-hidden': 'true' }) : state === 'done' ? tik() : h('b', { 'aria-hidden': 'true' }, '!');
    c.append(lead, h('span', { class: 'fp-name' }, desc(files)), h('span', { class: 'fp-size' }, '· ' + size(total(files))), state === 'busy' ? h('span', { class: 'fp-st' }, 'okunuyor…') : state === 'done' ? h('span', { class: 'fp-st' }, 'seçildi') : h('span', { class: 'fp-st' }, 'okunamadı'));
  }
  /** Bir onchange işleyicisini sarar: seçilen dosyayı gösterir, işleyici bitene (en az 0,6 sn) kadar "okunuyor" der. */
  function wrap(handler) {
    return function (e) {
      const inp = e.target, files = Array.from(inp.files || []).map(f => ({ name: f.name, size: f.size }));
      if (!files.length) return handler.call(this, e);
      show(inp, files, 'busy'); Busy.start(true);
      let r; try { r = handler.call(this, e); } catch (er) { show(inp, files, 'error'); Busy.end(); throw er; }
      Promise.all([Promise.resolve(r).then(() => true, () => false), sleep(600)]).then(([ok]) => { show(inp, files, ok ? 'done' : 'error'); Busy.end(); });
      return r;
    };
  }
  /** Görünür dosya seçici: büyük düğme + durum çipi + sürükle-bırak. input: h('input', {type:'file', …}); döner: yerleştirilecek öğe. */
  function field(inp, o) {
    o = o || {}; inp.classList.add('fp-native');
    const btn = h('label', { class: 'btn primary fp-btn' }, h('span', { class: 'fp-ico', 'aria-hidden': 'true' }, '📎'), o.label || 'Dosya seç', inp);
    const box = h('div', { class: 'fp' }, btn); chip(inp); box.append(inp._fp); show(inp, [], 'empty');
    ['dragenter', 'dragover'].forEach(ev => box.addEventListener(ev, x => { x.preventDefault(); box.classList.add('over'); }));
    ['dragleave', 'drop'].forEach(ev => box.addEventListener(ev, x => { x.preventDefault(); box.classList.remove('over'); }));
    box.addEventListener('drop', x => { const fl = x.dataTransfer && x.dataTransfer.files; if (fl && fl.length) { try { inp.files = fl; inp.dispatchEvent(new Event('change', { bubbles: true })); } catch (er) { } } });
    return box;
  }
  return { wrap, field, show, chip, size };
})();

/* ------------------------------------------------------------------ tıklama, seçim ve geçiş hareketleri */
(function () {
  const reduce = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const pop = (el, ms) => { if (!el || reduce()) return; el.classList.remove('pop'); requestAnimationFrame(() => { el.classList.add('pop'); setTimeout(() => el.classList.remove('pop'), ms || 700); }); };

  // düğmelere basınca: dalga + pembe halka (kısa)
  document.addEventListener('pointerdown', e => {
    const b = e.target.closest && e.target.closest('.btn, .tabs button'); if (!b || b.disabled || reduce()) return;
    const r = b.getBoundingClientRect(), d = Math.max(r.width, r.height) * 2, x = (e.clientX || r.left + r.width / 2) - r.left - d / 2, y = (e.clientY || r.top + r.height / 2) - r.top - d / 2;
    const rip = h('span', { class: 'rip', 'aria-hidden': 'true', style: { width: d + 'px', height: d + 'px', left: x + 'px', top: y + 'px' } }); b.append(rip); setTimeout(() => rip.remove(), 650);
    b.classList.remove('zap'); requestAnimationFrame(() => { b.classList.add('zap'); setTimeout(() => b.classList.remove('zap'), 500); });
  }, true);

  // seçim kutuları, liste seçimleri, onay kutuları: seçilince "pop"; seçim değişince kısa "çalışıyor" atışı
  document.addEventListener('change', e => {
    const t = e.target; if (!t || !t.matches) return;
    if (t.matches('select')) { pop(t); Busy.pulse(450); }
    else if (t.matches('input[type=checkbox], input[type=radio]')) { pop(t.closest('.stuitem') || t, 520); }
  }, true);

  // sayfa geçişi: yeni ekran yumuşakça yerine gelir
  const go = App.go;
  App.go = function (view) {
    const r = go.apply(this, arguments), m = document.getElementById('main');
    if (m && !reduce()) { m.classList.remove('enter'); requestAnimationFrame(() => m.classList.add('enter')); }
    return r;
  };
})();
