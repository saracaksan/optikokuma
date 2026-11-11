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
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
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
    exams: '<path d="M7 3h8l4 4v14H7z"/><path d="M15 3v4h4M10 12h6M10 16h6"/>',
    forms: '<rect x="5" y="3" width="14" height="18" rx="2"/><circle cx="9.5" cy="9" r="1.3"/><circle cx="14.5" cy="9" r="1.3"/><circle cx="9.5" cy="14" r="1.3"/><circle cx="14.5" cy="14" r="1.3"/>',
    admin: '<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M17 11a3 3 0 1 0 0-6M21 20c0-2.5-1.6-4.6-4-5.5"/>',
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

/* ------------------------------------------------------------------ API */
function isNetErr(e) { return e instanceof TypeError || (e && (e.name === 'AbortError' || e.code === 'NET')); }
function setOnline(v) { if (App.state.online !== v) { App.state.online = v; App.updateTopbar && App.updateTopbar(); if (v && App.hooks.onOnline) App.hooks.onOnline(); } }

/** Sunucu adresi: kullanıcının girdiği; yoksa config.js'te yöneticinin tanımladığı. */
const getApiUrl = () => Settings.get('apiUrl', '') || String((window.OPTIK_CONFIG && window.OPTIK_CONFIG.apiUrl) || '');
async function api(action, params, opt) {
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
async function getStudents(okulKodu) {
  try { return (await cached('students:' + okulKodu, 'listStudents', { okulKodu: String(okulKodu) })).students || []; }
  catch (e) { return []; }
}
function examCfg(ex) { const c = Scoring.normalizeCfg(ex.config || {}); return c; }

const DEFAULT_FOOTER = 'Sıraç AKSAN · Optik Sistem';
const formFooter = () => String(Settings.get('formFooter', DEFAULT_FOOTER) || '');

/** Sınavın okuma şablonunu döndürür (hazır katalog formu, kayıtlı şablon, harici form ya da otomatik). */
function resolveTemplate(ex) {
  const cfg = examCfg(ex), id = ex.config && ex.config.templateId;
  if (id) {
    const std = Katalog.parseStd(id);
    if (std) return { tpl: OMR.buildTemplate(Katalog.formOpts(std.entry, { nup: std.nup, digits: std.d, schoolDigits: std.sd, examName: ex.name, footer: formFooter() })), name: `Hazır form: ${std.entry.name}${std.nup > 1 ? ` · ${std.nup}/sayfa` : ''}`, custom: false, std: true };
    const t = App.state.templates.find(x => x.templateId === id);
    if (t && t.json) {
      if (t.json.kind === 'custom') return { tpl: t.json, name: t.name, custom: true };
      if (t.json.kind === 'generated' && t.json.opts) return { tpl: OMR.buildTemplate(t.json.opts), name: t.name, custom: false };
    }
  }
  return { tpl: OMR.buildTemplate({ title: 'OPTİK CEVAP KAĞIDI', examName: ex.name, questions: cfg.total, choices: cfg.choices, digits: 8, booklets: ex.config.booklets || Object.keys(cfg.keys), nup: 1, sections: cfg.sections, layout: 'lanes', footer: formFooter() }), name: 'Otomatik (1/sayfa, 8 haneli no)', custom: false, auto: true };
}
/** Bir sınav için beklenen form kimliği (okunan kodla karşılaştırılır); harici formlarda yok. */
function examFormCode(ex) { try { const t = resolveTemplate(ex).tpl; return t.kind === 'generated' ? t.formCode : null; } catch (e) { return null; } }

/* ------------------------------------------------------------------ kabuk */
const NAV = [
  { id: 'scan', label: 'Okut', roles: null }, { id: 'queue', label: 'Kuyruk', roles: null }, { id: 'results', label: 'Sonuçlar', roles: null },
  { id: 'exams', label: 'Sınavlar', roles: null }, { id: 'forms', label: 'Formlar', roles: null }, { id: 'admin', label: 'Yönetim', roles: ['admin', 'il', 'ilce', 'okul'] }, { id: 'settings', label: 'Ayarlar', roles: null }
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
  const S = App.state; S.view = view;
  $$('.nav button').forEach(b => b.classList.toggle('active', b.dataset.id === view));
  const main = $('#main'); if (!main) return; clear(main);
  if (App.cleanup) { try { App.cleanup(); } catch (e) { } App.cleanup = null; }
  try { App.views[view](main); } catch (e) { console.error(e); main.append(h('div', { class: 'alert bad' }, 'Bu sayfa açılırken hata oluştu: ' + e.message)); }
  window.scrollTo(0, 0);
};

App.renderShell = function () {
  const S = App.state, u = S.user, app = clear($('#app'));
  const items = NAV.filter(n => !n.roles || n.roles.includes(u.role));
  app.append(h('div', { class: 'shell' },
    h('div', { class: 'topbar' }, h('span', { class: 'title' }, 'Optik Okuma Sistemi'), h('span', { id: 'tb-status', class: 'pill' }, ''),
      h('div', { class: 'who' }, h('div', null, u.name || u.username), h('div', { class: 'small' }, ROLE_LABEL[u.role] || u.role))),
    h('nav', { class: 'nav', 'aria-label': 'Ana menü' }, items.map(n => h('button', { 'data-id': n.id, onclick: () => App.go(n.id) }, icon(n.id), h('span', null, n.label), n.id === 'queue' ? h('span', { id: 'nav-badge', class: 'badge hidden' }, '0') : null, n.id === 'admin' ? h('span', { id: 'admin-badge', class: 'badge hidden', title: 'Onay bekleyen başvuru' }, '0') : null))),
    h('main', { id: 'main' })));
  App.updateTopbar(); if (App.refreshQueueCount) App.refreshQueueCount();
};

App.sessionExpired = function (msg) {
  if (App._expiring) return; App._expiring = true;
  App.state.token = ''; Settings.set('token', ''); App.state.user = null;
  App.renderLogin(msg || 'Oturum süresi doldu. Yeniden giriş yapın. (Kuyruktaki okutmalar cihazda saklanmaya devam eder.)');
  setTimeout(() => { App._expiring = false; }, 500);
};

/* ------------------------------------------------------------------ giriş */
App.renderLogin = function (msg) {
  const app = clear($('#app'));
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
  app.append(h('div', { class: 'login' }, h('img', { class: 'logo', src: 'icon.svg', alt: '' }), h('h1', null, 'Optik Okuma Sistemi'),
    msg ? h('div', { class: 'alert warn' }, msg) : null, h('div', { class: 'card' }, form),
    h('p', { class: 'center', style: { margin: '.2rem 0 .6rem' } }, h('a', { href: '#/kayit', id: 'f-register' }, 'Üye ol: öğretmen veya okul kaydı')),
    h('p', { class: 'muted small center' }, 'Okul, ilçe ve il bazlı optik okuma, puanlama ve karşılaştırma.')));
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
