/* app.js — çekirdek: arayüz yardımcıları, yerel veri (IndexedDB), API istemcisi, kabuk, giriş, ayarlar */
'use strict';

const App = { state: { user: null, token: '', exams: [], schools: [], templates: [], online: navigator.onLine, view: 'scan', pending: 0 }, views: {}, hooks: {} };

/* ------------------------------------------------------------------ yardımcılar */
// Element.append: null/false değerleri atlar, iç içe dizileri düzleştirir ("null" metni oluşmasın diye)
(function () { const orig = Element.prototype.append; Element.prototype.append = function (...n) { return orig.apply(this, n.flat(Infinity).filter(x => x != null && x !== false)); }; })();
function add(el, kids) {
  for (const k of kids.flat(Infinity)) { if (k == null || k === false) continue; el.append(k.nodeType ? k : document.createTextNode(String(k))); }
  return el;
}
function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  let val;
  if (attrs) for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), (k === 'onchange' && tag === 'input' && attrs.type === 'file' && typeof FilePick !== 'undefined') ? FilePick.wrap(v) : v);
    else if (k === 'value') val = v;
    else if (k === 'checked' || k === 'disabled' || k === 'selected' || k === 'multiple' || k === 'readOnly') el[k] = !!v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  add(el, kids);
  if (val !== undefined) el.value = val;
  return el;
}
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const clear = el => { while (el.firstChild) el.removeChild(el.firstChild); return el; };
const nf = (v, d = 2) => (v == null || v === '' || isNaN(v)) ? '' : Number(v).toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: d });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const normNo = v => { const s = String(v == null ? '' : v).trim(); return /^\d+$/.test(s) ? s.replace(/^0+(?=\d)/, '') : s; };
const today = () => new Date().toISOString().slice(0, 10);

function toast(msg, kind, ms) {
  const t = h('div', { class: 'toast ' + (kind || '') }, msg);
  $('#toasts').append(t);
  setTimeout(() => t.remove(), ms || (kind === 'bad' ? 6000 : 3200));
}

function modal(title, body, opts) {
  opts = opts || {};
  const close = () => { ov.remove(); document.removeEventListener('keydown', onKey); if (opts.onClose) opts.onClose(); };
  const onKey = e => { if (e.key === 'Escape' && !opts.noEsc) close(); };
  const foot = h('footer');
  (opts.buttons || []).forEach(b => foot.append(h('button', { class: 'btn ' + (b.cls || ''), onclick: async ev => { if (b.keepOpen) { b.fn && b.fn(ev, close); } else { if (b.fn) { const r = await b.fn(ev, close); if (r === false) return; } close(); } } }, b.label)));
  const ov = h('div', { class: 'overlay', onmousedown: e => { if (e.target === ov && !opts.noBackdrop) close(); } },
    h('div', { class: 'modal ' + (opts.size || ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
      h('header', null, h('h2', null, title), h('button', { class: 'btn ghost sm', 'aria-label': 'Kapat', onclick: close }, '✕')),
      h('div', { class: 'body' }, body), opts.buttons && opts.buttons.length ? foot : null));
  document.body.append(ov); document.addEventListener('keydown', onKey);
  return { close, el: ov };
}
function confirmBox(msg, okLabel, danger) {
  return new Promise(res => {
    let done = false; const fin = v => { if (!done) { done = true; res(v); } };
    modal('Onay', h('p', null, msg), { onClose: () => fin(false), buttons: [{ label: 'Vazgeç' }, { label: okLabel || 'Evet', cls: danger ? 'danger' : 'primary', fn: () => { fin(true); } }] });
  });
}
function icon(name) {
  const P = {
    scan: '<path d="M4 7V5a1 1 0 0 1 1-1h2M17 4h2a1 1 0 0 1 1 1v2M20 17v2a1 1 0 0 1-1 1h-2M7 20H5a1 1 0 0 1-1-1v-2"/><path d="M4 12h16"/>',
    queue: '<path d="M12 3v12m0 0-4-4m4 4 4-4"/><path d="M5 19h14"/>',
    results: '<path d="M5 20V10M12 20V4M19 20v-7"/>',
    analiz: '<path d="M4 19h16"/><path d="M5 15l4-5 3 3 5-7"/><path d="M14 6h3v3"/>',
    exams: '<path d="M7 3h8l4 4v14H7z"/><path d="M15 3v4h4M10 12h6M10 16h6"/>',
    forms: '<rect x="5" y="3" width="14" height="18" rx="2"/><circle cx="9.5" cy="9" r="1.3"/><circle cx="14.5" cy="9" r="1.3"/><circle cx="9.5" cy="14" r="1.3"/><circle cx="14.5" cy="14" r="1.3"/>',
    admin: '<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M17 11a3 3 0 1 0 0-6M21 20c0-2.5-1.6-4.6-4-5.5"/>',
    guide: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.5a2.5 2.5 0 1 1 3.6 2.2c-.8.4-1.2 1-1.2 1.8M12 17h.01"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/>'
  };
  const s = document.createElement('span'); s.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' + (P[name] || '') + '</svg>'; return s.firstChild;
}

/* CSV / Excel'den yapıştırılan metni tabloya çevir */
function parseTable(text) {
  text = String(text || '').replace(/^﻿/, '').replace(/\r\n?/g, '\n').trim(); if (!text) return [];
  const first = text.split('\n')[0], delim = first.includes('\t') ? '\t' : (first.split(';').length >= first.split(',').length ? ';' : ',');
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"' && !cur) q = true;
    else if (c === delim) { row.push(cur); cur = ''; }
    else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
    else cur += c;
  }
  row.push(cur); rows.push(row);
  return rows.map(r => r.map(x => x.trim())).filter(r => r.some(x => x !== ''));
}
function toCSV(rows) {
  const esc = v => {
    v = v == null ? '' : String(v);
    if (/^[=+@\t\r]/.test(v) || (/^-/.test(v) && !/^-[\d.,]+$/.test(v))) v = "'" + v;      // Excel formül enjeksiyonu: =, +, @, - ile başlayan metinler (sayılar hariç) etkisizleştirilir
    return /[;"\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
  };
  return '﻿' + rows.map(r => r.map(esc).join(';')).join('\r\n');    // BOM + ; : Türkçe Excel'de doğrudan açılır
}
function download(name, data, type) {
  const blob = data instanceof Blob ? data : new Blob([data], { type: type || 'text/csv;charset=utf-8' });
  const a = h('a', { href: URL.createObjectURL(blob), download: name }); document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
}
function readFileText(file) { return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(r.error); r.readAsText(file, 'utf-8'); }); }

/* ------------------------------------------------------------------ yerel veri */
const Settings = {
  get(k, d) { try { const v = localStorage.getItem('optik.' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('optik.' + k, JSON.stringify(v)); } catch (e) { } }
};
const DB = {
  _p: null,
  open() {
    if (this._p) return this._p;
    this._p = new Promise((res, rej) => {
      const r = indexedDB.open('optik-db', 1);
      r.onupgradeneeded = () => { const d = r.result; d.createObjectStore('kv'); d.createObjectStore('queue', { keyPath: 'id' }); };
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    });
    return this._p;
  },
  async tx(store, mode, fn) { const db = await this.open(); return new Promise((res, rej) => { const t = db.transaction(store, mode), s = t.objectStore(store); let out; Promise.resolve(fn(s)).then(v => { out = v; }); t.oncomplete = () => res(out); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error); }); },
  req(r) { return new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); },
  get(store, key) { return this.open().then(db => this.req(db.transaction(store).objectStore(store).get(key))).catch(() => undefined); },
  put(store, val, key) { return this.open().then(db => new Promise((res, rej) => { const t = db.transaction(store, 'readwrite'); key === undefined ? t.objectStore(store).put(val) : t.objectStore(store).put(val, key); t.oncomplete = () => res(); t.onerror = () => rej(t.error); })); },
  del(store, key) { return this.open().then(db => new Promise((res, rej) => { const t = db.transaction(store, 'readwrite'); t.objectStore(store).delete(key); t.oncomplete = () => res(); t.onerror = () => rej(t.error); })); },
  all(store) { return this.open().then(db => this.req(db.transaction(store).objectStore(store).getAll())).catch(() => []); },
  clear(store) { return this.open().then(db => new Promise((res, rej) => { const t = db.transaction(store, 'readwrite'); t.objectStore(store).clear(); t.oncomplete = () => res(); t.onerror = () => rej(t.error); })); }
};

/* ------------------------------------------------------------------ çalışıyor göstergesi
   Sayfanın en üstünde ince pembe ilerleme çubuğu: ağ isteği sürerken görünür; kısa işlemlerde de kısa bir "çalışıyor" atışı verir. */
const Busy = {
  n: 0, shown: 0, tShow: 0, tHide: 0, bar: null,
  el() { if (!this.bar) { this.bar = h('div', { id: 'netbar', 'aria-hidden': 'true' }, h('i')); document.body.append(this.bar); } return this.bar; },
  _show() { clearTimeout(this.tHide); this.el().classList.add('on'); if (!this.shown) this.shown = Date.now(); },
  _hide() { clearTimeout(this.tShow); const wait = this.shown ? Math.max(0, 450 - (Date.now() - this.shown)) : 0; clearTimeout(this.tHide); this.tHide = setTimeout(() => { if (this.n > 0) return; if (this.bar) this.bar.classList.remove('on'); this.shown = 0; }, wait); },
  start(now) { this.n++; if (now) this._show(); else if (this.n === 1) { clearTimeout(this.tShow); this.tShow = setTimeout(() => { if (this.n > 0) this._show(); }, 120); } },
  end() { if (this.n > 0) this.n--; if (this.n === 0) this._hide(); },
  pulse(ms) { this.start(true); setTimeout(() => this.end(), ms || 500); },
  track(p, now) { this.start(now); return Promise.resolve(p).finally(() => this.end()); }
};

/* ------------------------------------------------------------------ API */
function isNetErr(e) { return e instanceof TypeError || (e && (e.name === 'AbortError' || e.code === 'NET')); }
function setOnline(v) { if (App.state.online !== v) { App.state.online = v; App.updateTopbar && App.updateTopbar(); if (v && App.hooks.onOnline) App.hooks.onOnline(); } }

/** Sunucu adresi: kullanıcının girdiği; yoksa config.js'te yöneticinin tanımladığı. */
const getApiUrl = () => Settings.get('apiUrl', '') || String((window.OPTIK_CONFIG && window.OPTIK_CONFIG.apiUrl) || '');
async function api(action, params, opt) {
  const quiet = opt && opt.quiet; if (!quiet) Busy.start();
  try { return await apiCall(action, params, opt); } finally { if (!quiet) Busy.end(); }
}
async function apiCall(action, params, opt) {
  const url = getApiUrl();
  if (!url) { const e = new Error('Sunucu adresi (Apps Script /exec) girilmemiş. Ayarlar sayfasından ekleyin.'); e.code = 'NOURL'; throw e; }
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), (opt && opt.timeout) || 90000);
  let res;
  try {
    res = await fetch(url, { method: 'POST', redirect: 'follow', signal: ctl.signal, headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(Object.assign({ action, token: App.state.token }, params || {})) });
  } finally { clearTimeout(timer); }
  let j; try { j = await res.json(); } catch (e) { const er = new Error('Sunucudan geçersiz yanıt geldi. Apps Script dağıtımı "Herkes" erişimine açık ve /exec adresi doğru mu?'); er.code = 'BADRESP'; throw er; }
  setOnline(true);
  if (!j.ok) { const er = new Error(j.error || 'Sunucu hatası'); er.code = j.code || ''; if (er.code === 'AUTH' && !(opt && opt.noAuthRedirect)) App.sessionExpired(er.message); throw er; }
  return j.data;
}
async function cached(key, action, params) {
  try { const d = await api(action, params); await DB.put('kv', d, key); return d; }
  catch (e) {
    if (isNetErr(e)) { setOnline(false); const d = await DB.get('kv', key); if (d) return d; }
    throw e;
  }
}

/* ------------------------------------------------------------------ ortak veri */
async function refreshBase(force) {
  const S = App.state;
  const safe = async (key, act) => { try { return await cached(key, act); } catch (e) { if (e.code === 'AUTH') throw e; const d = await DB.get('kv', key); if (d) return d; throw e; } };
  const [ex, sc, tp] = await Promise.all([safe('exams', 'listExams'), safe('schools', 'listSchools'), safe('templates', 'listTemplates')]);
  S.exams = ex.exams || []; S.schools = sc.schools || []; S.templates = tp.templates || [];
  if (App.updateTopbar) App.updateTopbar();
}
const examById = id => App.state.exams.find(e => e.examId === id);
const schoolByCode = c => App.state.schools.find(s => String(s.okulKodu) === String(c));
function schoolLabel(s) { return s ? `${s.okulAdi} · ${s.ilce}/${s.il} (${s.okulKodu})` : ''; }

/* ------------------------------------------------------------------ ortak seçim: il / ilçe / düzey / okul
   Tüm ekranlardaki okul seçicileri bu depoyu okur ve yazar: bir yerde yapılan il / ilçe / düzey / okul seçimi her ekranda (sınav oluşturma,
   okutma, analiz, formlar, yönetim…) etkin kalır; cihazda saklanır. Arama metni (q) ortak değildir. */
const Sel = (() => {
  const KEYS = ['il', 'ilce', 'tur', 'okul'], v = { il: '', ilce: '', tur: '', okul: '' }, subs = new Set(); let depth = 0;
  { const s = Settings.get('secim', null); if (s && typeof s === 'object') KEYS.forEach(k => { if (typeof s[k] === 'string') v[k] = s[k]; }); }
  return {
    v,
    /** p: { il, ilce, tur, okul } (verilenler yazılır). src: değişikliği yapan öğe (kendine bildirim gitmez). Değişiklik olduysa true. */
    set(p, src) {
      let ch = false; KEYS.forEach(k => { if (p && p[k] !== undefined && String(p[k]) !== v[k]) { v[k] = String(p[k]); ch = true; } });
      if (!ch) return false; Settings.set('secim', v);
      if (depth > 3) return true; depth++;
      try { Array.from(subs).forEach(s => { if (s.src === src) return; if (s.el && !s.el.isConnected) { if (s.seen) subs.delete(s); return; } s.seen = true; try { s.fn(v, src); } catch (e) { console.error(e); } }); } finally { depth--; }
      return true;
    },
    /** fn(v, src): seçim başka bir yerde değişince çağrılır. el ekrandan kalkınca abonelik kendiliğinden düşer. Döner: aboneliği bırakan işlev. */
    on(fn, el, src) { const s = { fn, el, src, seen: false }; subs.add(s); return () => subs.delete(s); },
    /** Okul, ortak il/ilçe/düzey süzgecine uyuyor mu? */
    fits(s) { return !!s && (!v.il || s.il === v.il) && (!v.ilce || s.ilce === v.ilce) && (!v.tur || s.tur === v.tur); },
    /** Ortak okul seçili ve verilen listede varsa onu, yoksa fb'yi döndürür. */
    okul(schools, fb) { const c = v.okul; return c && (schools || []).some(s => String(s.okulKodu) === c) ? c : fb; }
  };
})();

/* ------------------------------------------------------------------ okul seçimi: il → ilçe → düzey (+ arama)
   Uzun okul listesini adım adım daraltır. Yalnızca ayırt edici olan süzgeçler görünür (tek il varsa il kutusu çıkmaz). */
const spNorm = v => String(v == null ? '' : v).toLocaleLowerCase('tr').replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ş/g, 's').replace(/ü/g, 'u').replace(/̇/g, '');
const spUniq = a => Array.from(new Set(a.filter(Boolean))).sort((x, y) => String(x).localeCompare(String(y), 'tr'));
/** schools: okul dizisi. onChange(liste, kullanıcıDeğiştirdi) süzgeç her değiştiğinde çağrılır. Döner: { el, list(), any (görünür süzgeç var mı), set({il,ilce,tur,q}), destroy() }
 *  Süzgeçler (il/ilçe/düzey) ortak seçimden (Sel) başlar ve her değişiklikte ona yazılır; başka ekrandaki/üstteki süzgeçler de birlikte güncellenir.
 *  opts: { keep: bu okulun görünür kalması için süzgeçleri gevşet, shared: false → ortak seçimden bağımsız } */
function schoolFilterBar(schools, onChange, opts) {
  opts = opts || {}; const shared = opts.shared !== false, me = opts.me || {};
  const all = (schools || []).slice().sort((a, b) => String(a.okulAdi).localeCompare(String(b.okulAdi), 'tr'));
  const f = { il: shared ? Sel.v.il : '', ilce: shared ? Sel.v.ilce : '', tur: shared ? Sel.v.tur : '', q: '' }, ils = spUniq(all.map(s => s.il));
  if (opts.keep) { const k = all.find(s => String(s.okulKodu) === String(opts.keep)); if (k) { if ((f.il && f.il !== k.il) || (f.ilce && f.ilce !== k.ilce)) { f.il = k.il; f.ilce = k.ilce; } if (f.tur && f.tur !== k.tur) f.tur = ''; } }
  let seenV = { il: f.il, ilce: f.ilce, tur: f.tur };
  const sel = (cls, label, change) => h('select', { class: 'sp-' + cls, 'aria-label': label, onchange: change });
  const ilSel = sel('il', 'İl', e => { f.il = e.target.value; f.ilce = ''; f.tur = ''; paint(true); });
  const ilceSel = sel('ilce', 'İlçe', e => { f.ilce = e.target.value; f.tur = ''; paint(true); });
  const turSel = sel('tur', 'Okul düzeyi', e => { f.tur = e.target.value; paint(true); });
  let timer = 0;
  const q = h('input', { type: 'search', class: 'sp-q', placeholder: 'Okul adı / kodu ara…', 'aria-label': 'Okul ara', autocomplete: 'off', oninput: e => { f.q = e.target.value; clearTimeout(timer); timer = setTimeout(() => paint(true), 200); } });
  const count = h('span', { class: 'sp-n small muted', 'aria-live': 'polite' });
  const el = h('div', { class: 'sp-bar' }, ilSel, ilceSel, turSel, q, count);
  const inArea = s => (!f.il || s.il === f.il) && (!f.ilce || s.ilce === f.ilce);
  const list = () => { const t = spNorm(f.q).trim(); return all.filter(s => inArea(s) && (!f.tur || s.tur === f.tur) && (!t || spNorm(s.okulAdi + ' ' + s.okulKodu + ' ' + s.ilce + ' ' + s.il).includes(t))); };
  const fillSel = (node, first, vals, cur) => { clear(node).append(h('option', { value: '' }, first), ...vals.map(v => h('option', { value: v }, v))); node.value = vals.indexOf(cur) >= 0 ? cur : ''; return node.value; };
  /** user: true = kullanıcı değiştirdi (ortak seçime yazılır), 'sync' = başka ekrandaki süzgeçle eşitlendi, false = ilk çizim */
  const paint = user => {
    fillSel(ilSel, 'Tüm iller', ils, f.il); f.il = ilSel.value;
    const ilceVals = spUniq(all.filter(s => !f.il || s.il === f.il).map(s => s.ilce)); f.ilce = fillSel(ilceSel, 'Tüm ilçeler', ilceVals, f.ilce);
    const turVals = spUniq(all.filter(inArea).map(s => s.tur)); f.tur = fillSel(turSel, 'Tüm düzeyler', turVals, f.tur);
    ilSel.hidden = ils.length < 2; ilceSel.hidden = ilceVals.length < 2; turSel.hidden = turVals.length < 2 && !f.tur; q.hidden = all.length < 8 && !f.q;
    if (user === true && shared) {
      seenV = { il: f.il, ilce: f.ilce, tur: f.tur }; Sel.set(seenV, me);
      // süzgeç seçili okulu dışarıda bırakıyorsa ortak okul seçimi temizlenir (il/ilçe/düzey ile okul çelişmesin)
      const k = Sel.v.okul && all.find(s => String(s.okulKodu) === Sel.v.okul); if (k && !(inArea(k) && (!f.tur || k.tur === f.tur))) Sel.set({ okul: '' }, me);
    }
    const l = list(), active = !!(f.il || f.ilce || f.tur || f.q);
    count.textContent = active || all.length >= 8 ? `${l.length} okul` : ''; count.hidden = !count.textContent;
    onChange && onChange(l, !!user);
  };
  const off = shared ? Sel.on(v => { if (v.il === seenV.il && v.ilce === seenV.ilce && v.tur === seenV.tur) return; seenV = { il: v.il, ilce: v.ilce, tur: v.tur }; Object.assign(f, seenV); paint('sync'); }, el, me) : () => { };
  paint(false);
  return { el, list, get any() { return !(ilSel.hidden && ilceSel.hidden && turSel.hidden && q.hidden); }, set(v) { Object.assign(f, v || {}); paint(true); }, destroy: off };
}
/** Var olan okul <select>'ini süzgeçli hale getirir (id, value, change olayı aynen çalışır). Seçenek yoksa/tek okul varsa select'i olduğu gibi döndürür.
 *  Dönen öğeyi sayfaya koyun. İlk seçenek value="" ise yer tutucu olarak korunur.
 *  Seçili okul ortak seçimdendir (Sel.okul): başlangıçta onu gösterir, kullanıcı değiştirince ona yazar, başka ekrandaki seçici değişince eşitlenir.
 *  opts: { extra: [{value,label}] listenin başında sabit özel seçenekler (örn. "otomatik"), shared: false → ortak seçimden bağımsız } */
function schoolPicker(sel, schools, opts) {
  opts = opts || {};
  if (sel.disabled || !schools || schools.length < 2) return sel;
  const shared = opts.shared !== false, extra = opts.extra || [], me = {};
  const ph = sel.querySelector('option[value=""]'), phText = ph ? ph.textContent : '';
  const has = c => schools.some(s => String(s.okulKodu) === String(c)), isExtra = v => extra.some(e => e.value === v);
  let init = sel.value; if (shared && !isExtra(init)) { const g = Sel.v.okul; if (g && has(g)) init = g; }
  const fill = (list, user) => {
    const cur = sel.value, sameIlce = new Set(list.map(s => s.ilce)).size === 1;
    clear(sel);
    if (ph) sel.append(h('option', { value: '' }, phText));
    extra.forEach(e => sel.append(h('option', { value: e.value }, e.label)));
    if (!list.length) sel.append(h('option', { value: '', disabled: true }, '(bu süzgeçle okul yok)'));
    list.forEach(s => sel.append(h('option', { value: s.okulKodu }, sameIlce ? `${s.okulAdi} (${s.okulKodu})` : schoolLabel(s))));
    if (isExtra(cur) || list.some(s => String(s.okulKodu) === String(cur))) sel.value = cur; else if (!ph && extra.length) sel.value = extra[0].value; else if (!ph && list.length) sel.value = String(list[0].okulKodu); else sel.value = '';
    if (user && sel.value !== cur && !(list.length === 0 && !ph && !extra.length)) sel.dispatchEvent(new Event('change', { bubbles: true }));
  };
  if (init) sel.value = init;
  const bar = schoolFilterBar(schools, fill, { keep: isExtra(init) ? '' : init, me, shared });
  if (shared) {
    sel.addEventListener('change', () => { if (!isExtra(sel.value)) Sel.set({ okul: sel.value }, me); });
    Sel.on(v => { const c = v.okul; if (c && c !== sel.value && sel.isConnected && !sel.disabled && Array.from(sel.options).some(o => o.value === c && !o.disabled)) { sel.value = c; sel.dispatchEvent(new Event('change', { bubbles: true })); } }, sel, me);
  }
  if (!bar.any) { bar.destroy(); if (init) sel.value = init; return sel; }
  if (init) sel.value = init;
  sel.classList.add('sp-main');
  const box = h('div', { class: 'sp' }, bar.el, sel); box.select = sel; box.bar = bar; return box;
}
async function getStudents(okulKodu) {
  try { return (await cached('students:' + okulKodu, 'listStudents', { okulKodu: String(okulKodu) })).students || []; }
  catch (e) { return []; }
}
function examCfg(ex) { const c = Scoring.normalizeCfg(ex.config || {}); return c; }

const DEFAULT_FOOTER = 'Sıraç AKSAN · Sıraç Aksan Optik Okuma';
const APP_NAME = 'Sıraç Aksan Optik Okuma';
function saCopyrightFooter() {
  return h('footer', { class: 'sa-copyright' },
    h('b', null, 'Telif Hakkı © Sıraç AKSAN'),
    ' — Sıraç Aksan Optik Okuma. Emeğe saygı gösteriniz; izinsiz kopyalamak, dağıtmak veya telif atmak ayıptır.'
  );
}
const formFooter = () => String(Settings.get('formFooter', DEFAULT_FOOTER) || '');

/** Harici formu sınavın ders/soru yapısına uyarlar (formda 20'şer soruluk bloklar, sınavda farklı sayılar). Birebir uyuyorsa şablon aynen döner. */
function projectForExam(json, cfg, formMap) {
  if (!window.OMRDetect || !OMRDetect.projectTemplate || !Array.isArray(json.groups)) return { tpl: json };
  const pj = OMRDetect.projectTemplate(json, cfg.sections, formMap);
  if (pj.error) return pj;
  if (pj.fs.total === json.questions && pj.fs.slots.every((v, i) => v === i + 1)) return { tpl: json, fs: pj.fs, mapped: false };
  return { tpl: pj.tpl, fs: pj.fs, mapped: true };
}

/** Sınavın okuma şablonunu döndürür (hazır katalog formu, kayıtlı şablon, harici form ya da otomatik). */
function resolveTemplate(ex) {
  const cfg = examCfg(ex), id = ex.config && ex.config.templateId;
  if (id) {
    const std = Katalog.parseStd(id);
    if (std) return { tpl: OMR.buildTemplate(Katalog.formOpts(std.entry, { nup: std.nup, digits: std.d, schoolDigits: std.sd, examName: ex.name, footer: formFooter() })), name: `Hazır form: ${std.entry.name}${std.nup > 1 ? ` · ${std.nup}/sayfa` : ''}`, custom: false, std: true };
    const t = App.state.templates.find(x => x.templateId === id);
    if (t && t.json) {
      if (t.json.kind === 'custom') {
        const pj = projectForExam(t.json, cfg, ex.config && ex.config.formMap);
        return pj.error ? { tpl: t.json, name: t.name, custom: true, mapError: pj.error } : { tpl: pj.tpl, name: t.name, custom: true, mapped: pj.mapped ? pj.fs : null, formQuestions: t.json.questions };
      }
      if (t.json.kind === 'generated' && t.json.opts) return { tpl: OMR.buildTemplate(t.json.opts), name: t.name, custom: false };
    }
  }
  return { tpl: OMR.buildTemplate({ title: 'OPTİK CEVAP KAĞIDI', examName: ex.name, questions: cfg.total, choices: cfg.choices, digits: 8, booklets: ex.config.booklets || Object.keys(cfg.keys), nup: 1, sections: cfg.sections, layout: 'lanes', footer: formFooter() }), name: 'Otomatik (1/sayfa, 8 haneli no)', custom: false, auto: true };
}
/** Bir sınav için beklenen form kimliği (okunan kodla karşılaştırılır); harici formlarda yok. */
function examFormCode(ex) { try { const t = resolveTemplate(ex).tpl; return t.kind === 'generated' ? t.formCode : null; } catch (e) { return null; } }

/* ------------------------------------------------------------------ kabuk */
const NAV = [
  { id: 'scan', label: 'Okut', roles: null }, { id: 'queue', label: 'Kuyruk', roles: null }, { id: 'results', label: 'Sonuçlar', roles: null }, { id: 'analiz', label: 'Analiz', roles: null },
  { id: 'exams', label: 'Sınavlar', roles: null }, { id: 'forms', label: 'Formlar', roles: null }, { id: 'admin', label: 'Yönetim', roles: ['admin', 'il', 'ilce', 'okul'] }, { id: 'settings', label: 'Ayarlar', roles: null }, { id: 'guide', label: 'Kılavuz', roles: null }
];
const ROLE_LABEL = { admin: 'Yönetici', il: 'İl yetkilisi', ilce: 'İlçe yetkilisi', okul: 'Okul yöneticisi', ogretmen: 'Öğretmen' };
/** Bu sınava okutma yapılabilir mi (sunucu aynı kuralı uygular): öğretmen yalnızca kendi sınavına; kişisel sınava yalnızca sahibi. */
const canScanExam = e => e.status === 'open' && e.canScan !== false;

App.updateTopbar = function () {
  const tb = $('#tb-status'); if (!tb) return;
  tb.className = 'pill ' + (App.state.online ? '' : 'warn'); tb.textContent = App.state.online ? 'Çevrimiçi' : 'Çevrimdışı';
  const b = $('#nav-badge'); if (b && App.queueCount !== undefined) { b.textContent = App.queueCount; b.classList.toggle('hidden', !App.queueCount); }
  const pb = $('#admin-badge'); if (pb) { pb.textContent = App.state.pending || 0; pb.classList.toggle('hidden', !App.state.pending); }
};

App.go = function (view) {
  const S = App.state; S.view = view; if (view !== 'guide' && typeof Guide !== 'undefined') Guide.state.from = '';
  $$('.nav button').forEach(b => b.classList.toggle('active', b.dataset.id === view));
  const main = $('#main'); if (!main) return; clear(main);
  if (App.cleanup) { try { App.cleanup(); } catch (e) { } App.cleanup = null; }
  try { App.views[view](main); } catch (e) { console.error(e); main.append(h('div', { class: 'alert bad' }, 'Bu sayfa açılırken hata oluştu: ' + e.message)); }
  main.append(saCopyrightFooter());
  window.scrollTo(0, 0);
};

App.renderShell = function () {
  document.title = APP_NAME;
  const S = App.state, u = S.user, app = clear($('#app'));
  const items = NAV.filter(n => !n.roles || n.roles.includes(u.role));
  app.append(h('div', { class: 'shell' },
    h('div', { class: 'topbar' }, h('span', { class: 'title' }, h('img', { class: 'tb-logo', src: 'icon.svg', alt: '' }), APP_NAME), h('span', { id: 'tb-status', class: 'pill' }, ''), h('button', { class: 'tb-help no-print', type: 'button', id: 'tb-help', title: 'Bu ekranın kullanım kılavuzu', 'aria-label': 'Kullanım kılavuzu', onclick: () => Guide.openContext() }, '?'), Install.topButton(),
      h('div', { class: 'who' }, h('div', null, u.name || u.username), h('div', { class: 'small' }, ROLE_LABEL[u.role] || u.role))),
    h('nav', { class: 'nav', 'aria-label': 'Ana menü' }, items.map(n => h('button', { 'data-id': n.id, onclick: () => App.go(n.id) }, icon(n.id), h('span', null, n.label), n.id === 'queue' ? h('span', { id: 'nav-badge', class: 'badge hidden' }, '0') : null, n.id === 'admin' ? h('span', { id: 'admin-badge', class: 'badge hidden', title: 'Onay bekleyen başvuru' }, '0') : null))),
    h('main', { id: 'main' })));
  App.updateTopbar(); if (App.refreshQueueCount) App.refreshQueueCount(); Install.banner();
};

App.sessionExpired = function (msg) {
  if (App._expiring) return; App._expiring = true;
  App.state.token = ''; Settings.set('token', ''); App.state.user = null;
  App.renderLogin(msg || 'Oturum süresi doldu. Yeniden giriş yapın. (Kuyruktaki okutmalar cihazda saklanmaya devam eder.)');
  setTimeout(() => { App._expiring = false; }, 500);
};

/* ------------------------------------------------------------------ giriş */
App.renderLogin = function (msg) {
  const app = clear($('#app')); Install.clearBanner();
  const cfgUrl = String((window.OPTIK_CONFIG && window.OPTIK_CONFIG.apiUrl) || '');
  const url = h('input', { type: 'url', id: 'f-url', placeholder: 'https://script.google.com/macros/s/…/exec', value: getApiUrl(), autocomplete: 'off' });
  const un = h('input', { type: 'text', id: 'f-user', autocomplete: 'username', autocapitalize: 'none', spellcheck: 'false', value: Settings.get('lastUser', '') });
  const pw = h('input', { type: 'password', id: 'f-pass', autocomplete: 'current-password' });
  const err = h('div', { class: 'alert bad hidden', id: 'f-err' });
  const btn = h('button', { class: 'btn primary', type: 'submit', style: { width: '100%' } }, 'Giriş yap');
  const form = h('form', { onsubmit: async ev => {
    ev.preventDefault(); err.classList.add('hidden'); btn.disabled = true; btn.textContent = 'Giriş yapılıyor…';
    try {
      const u = url.value.trim(); if (!/^https:\/\/script\.google(usercontent)?\.com\/.+/.test(u) && !/^https?:\/\/(localhost|127\.0\.0\.1)/.test(u)) throw new Error('Adres https://script.google.com/macros/s/…/exec biçiminde olmalı.');
      Settings.set('apiUrl', u === cfgUrl ? '' : u);   // yöneticinin config.js adresiyle aynıysa ayrıca saklanmaz (adres sonradan değişirse kendiliğinden güncellenir)
      const d = await api('login', { username: un.value.trim(), password: pw.value }, { noAuthRedirect: true });
      App.state.token = d.token; App.state.user = d.user; Settings.set('token', d.token); Settings.set('lastUser', un.value.trim()); await DB.put('kv', d.user, 'user');
      await App.start();
    } catch (e) { err.textContent = isNetErr(e) ? 'Sunucuya ulaşılamadı. İnternet bağlantısını ve adresi kontrol edin.' : e.message; err.classList.remove('hidden'); btn.disabled = false; btn.textContent = 'Giriş yap'; }
  } },
    cfgUrl && getApiUrl() === cfgUrl ? h('details', { class: 'small' }, h('summary', null, 'Sunucu adresi (yöneticiniz tanımladı)'), h('div', { class: 'field', style: { marginTop: '.4rem' } }, url)) : h('div', { class: 'field' }, h('label', { for: 'f-url' }, 'Sunucu adresi (Apps Script)'), url),
    h('div', { class: 'field', style: { marginTop: '.7rem' } }, h('label', { for: 'f-user' }, 'Kullanıcı adı'), un),
    h('div', { class: 'field', style: { margin: '.7rem 0' } }, h('label', { for: 'f-pass' }, 'Parola'), pw), err, btn);
  app.append(h('div', { class: 'login' }, h('img', { class: 'logo', src: 'icon.svg', alt: '' }), h('h1', null, APP_NAME), h('p', { class: 'center', style: { margin: '-.2rem 0 .6rem', fontWeight: 600, color: 'var(--brand)' } }, 'Optik okuma ve sınav analiz sistemi'),
    msg ? h('div', { class: 'alert warn' }, msg) : null, h('div', { class: 'card' }, form),
    Install.card(),
    h('p', { class: 'center', style: { margin: '.2rem 0 .6rem' } }, h('a', { href: '#/kayit', id: 'f-register' }, 'Üye ol: öğretmen veya okul kaydı')),
    h('p', { class: 'center', style: { margin: '.2rem 0 .6rem' } }, h('a', { href: '#/ogrenci', id: 'f-portal' }, 'Öğrenci / veli: sonuç sorgulama')),
    h('p', { class: 'center', style: { margin: '.2rem 0 .6rem' } }, h('a', { href: '#/kilavuz', id: 'f-guide' }, 'Kullanım kılavuzu')),
    h('p', { class: 'muted small center' }, 'Okul, ilçe ve il bazlı optik okuma, puanlama ve karşılaştırma.'),
    saCopyrightFooter()));
};

/* ------------------------------------------------------------------ ayarlar */
App.views.settings = function (root) {
  const S = App.state, u = S.user;
  const url = h('input', { type: 'url', value: getApiUrl() });
  const auto = h('input', { type: 'checkbox', checked: Settings.get('autoSync', true), onchange: e => { Settings.set('autoSync', e.target.checked); if (e.target.checked && App.syncQueue) App.syncQueue(); } });
  const strict = h('input', { type: 'checkbox', checked: Settings.get('strictFlags', true), onchange: e => Settings.set('strictFlags', e.target.checked) });
  const ft = h('input', { type: 'text', maxlength: 60, value: formFooter(), placeholder: DEFAULT_FOOTER });
  const o = h('input', { type: 'password', autocomplete: 'current-password' }), n = h('input', { type: 'password', autocomplete: 'new-password' }), msg = h('div');
  root.append(
    h('h1', null, 'Ayarlar'),
    h('div', { class: 'card' }, h('h2', null, 'Hesap'),
      h('p', null, h('b', null, u.name || u.username), ' · ', ROLE_LABEL[u.role] || u.role, (u.role === 'okul' || u.role === 'ogretmen') ? ` · ${(schoolByCode(u.okulKodu) || {}).okulAdi || 'okul kodu ' + u.okulKodu}` : u.role === 'ilce' ? ` · ${u.ilce}/${u.il}` : u.role === 'il' ? ` · ${u.il}` : ''),
      h('div', { class: 'row' },
        h('button', { class: 'btn', onclick: async () => { try { await refreshBase(); toast('Veriler yenilendi', 'ok'); } catch (e) { toast(e.message, 'bad'); } } }, 'Verileri yenile'),
        h('button', { class: 'btn danger', onclick: async () => {
          const pend = App.queueCount || 0;
          if (pend && !(await confirmBox(`Gönderilmemiş ${pend} okutma var. Çıkış yapsanız da cihazda saklanır, ama gönderilmesi için tekrar giriş gerekir. Çıkılsın mı?`, 'Çık', true))) return;
          App.state.token = ''; Settings.set('token', ''); App.state.user = null; App.renderLogin();
        } }, 'Çıkış yap'))),
    h('div', { class: 'card' }, h('h2', null, 'Bağlantı ve senkronizasyon'),
      h('div', { class: 'field' }, h('label', null, 'Sunucu adresi (Apps Script /exec)'), url),
      h('label', { class: 'row', style: { margin: '.7rem 0 .2rem' } }, auto, 'Çevrimiçi olunca kuyruğu otomatik gönder'),
      h('label', { class: 'row', style: { margin: '.2rem 0 .7rem' } }, strict, 'Zayıf / silinmiş işaretleri de "kontrol gerekli" say (önerilir)'),
      h('div', { class: 'row' }, h('button', { class: 'btn primary', onclick: () => { Settings.set('apiUrl', url.value.trim()); toast('Kaydedildi', 'ok'); } }, 'Adresi kaydet'),
        h('button', { class: 'btn', onclick: async () => { try { Settings.set('apiUrl', url.value.trim()); const t0 = Date.now(); await api('me'); toast(`Bağlantı tamam (${Date.now() - t0} ms)`, 'ok'); } catch (e) { toast(e.message, 'bad'); } } }, 'Bağlantıyı dene'))),
    h('div', { class: 'card' }, h('h2', null, 'Öğrenci / veli sorgulama bağlantısı'), h('p', { class: 'small muted', style: { marginTop: 0 } }, 'Öğrenci ve veliler bu bağlantıdan okul → sınıf → okul numarasıyla sonuçlarını görür. Yalnızca, sınavı düzenlerken "öğrenci/veli sorgulamasına açık" işaretlenen sınavlar görünür.'), (() => { const l = h('input', { type: "text", readOnly: true, id: 'st-portal-link', value: location.origin + location.pathname.replace(/index\.html$/, '') + '#/ogrenci', onfocus: e => e.target.select() }); return h('div', { class: 'linkbox' }, l, h('button', { class: 'btn', onclick: async () => { try { await navigator.clipboard.writeText(l.value); toast('Kopyalandı', 'ok'); } catch (e) { l.select(); } } }, 'Kopyala')); })()),
    u.role === 'ogretmen' ? h('div', { class: 'card' }, h('h2', null, 'Öğretmen hesabı'), h('p', { class: 'small muted', style: { margin: 0 } }, 'Oluşturduğunuz sınavlar ve sonuçları yalnızca siz ve okul yöneticiniz görür; aynı okuldaki diğer öğretmenler ve ilçe/il yetkilileri göremez. Okulunuzun ortak (kurumsal) sınavlarını yalnızca görüntülersiniz; okutmayı okul yöneticisi yapar.')) : null,
    h('div', { class: 'card' }, h('h2', null, 'Form görünümü'),
      h('div', { class: 'field' }, h('label', null, 'Basılan formların altındaki küçük yazı'), ft),
      h('p', { class: 'small muted' }, 'Boş bırakırsanız yazı basılmaz. Form kimlik kodu (sağ alttaki siyah kareler) her zaman basılır; sistem hangi formun okutulduğunu bu koddan tanır.'),
      h('button', { class: 'btn', onclick: () => { Settings.set('formFooter', ft.value.trim()); toast('Kaydedildi', 'ok'); } }, 'Kaydet')),
    h('div', { class: 'card' }, h('h2', null, 'Parola değiştir'),
      h('div', { class: 'grid' }, h('div', { class: 'field' }, h('label', null, 'Eski parola'), o), h('div', { class: 'field' }, h('label', null, 'Yeni parola (en az 6, yönetici için 8)'), n)), msg,
      h('div', { class: 'row', style: { marginTop: '.7rem' } }, h('button', { class: 'btn', onclick: async () => {
        clear(msg); try { await api('changePassword', { oldPassword: o.value, newPassword: n.value }); o.value = n.value = ''; msg.append(h('div', { class: 'alert ok' }, 'Parola değiştirildi.')); } catch (e) { msg.append(h('div', { class: 'alert bad' }, e.message)); }
      } }, 'Değiştir'))),
    h('div', { class: 'card' }, h('h2', null, 'Uygulama'),
      h('p', { class: 'small muted' }, 'Bu sayfayı tarayıcı menüsünden "Ana ekrana ekle / Uygulamayı yükle" ile telefona veya bilgisayara kurabilirsiniz. Kurulduktan sonra internet olmadan da açılır ve okutma yapabilirsiniz.'),
      h('p', { class: 'small muted' }, 'Sürüm 1.0 · okuma motoru: tarayıcıda çalışır, görüntüler cihazdan dışarı gönderilmez; sunucuya yalnızca işaretli cevaplar gider.')));
};
