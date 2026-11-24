/* kilavuz.js — uygulama içi KULLANIM KILAVUZU (motor). İçerik: kilavuz-icerik.js (Guide.define ile yüklenir).
 *
 * - Rol süzgeci: Veli/öğrenci · Öğretmen · Okul yöneticisi (idareci) · İlçe/il yetkilisi · Sistem yöneticisi (+ "Tümü").
 *   Giriş yapmış kullanıcıda kendi rolü seçili gelir; üst roller alt rollerin konularını da görür.
 * - Arama: Türkçe karakter duyarsız (ı/i, ş/s, ğ/g…), tüm sözcükler geçmeli, başlık > anahtar sözcük > metin sıralı, sonuçta vurgulu özet.
 * - Konu sayfası: adım adım yönergeler, düğme adları [[böyle]] gösterilir, menü yolları {{böyle}}; "ekranı aç" düğmesiyle ilgili ekrana/sekmeye gider.
 * - Yazdır / PDF: seçili konu ya da (rol süzgecindeki) tüm kılavuz A4 olarak yazdırılır ("PDF olarak kaydet").
 * - Girişsiz de açılır: #/kilavuz ve #/kilavuz/<konu> (veli sorgulama, üyelik ve giriş sayfasından bağlantı verilir).
 * - Her ekranda üst çubukta "?" düğmesi: bulunulan ekran/sekme için ilgili konuyu açar (Guide.contextTopic).
 * İçerik biçimi (kilavuz-icerik.js): bkz. dosyanın başındaki açıklama. */
'use strict';

const Guide = (() => {
  const AUDS = [['veli', 'Veli / öğrenci'], ['ogretmen', 'Öğretmen'], ['okul', 'Okul yöneticisi'], ['yetkili', 'İlçe / il yetkilisi'], ['admin', 'Sistem yöneticisi']];
  const LVL = { veli: 0, ogretmen: 1, okul: 2, yetkili: 3, admin: 4 };
  const AUD_OF_ROLE = { ogretmen: 'ogretmen', okul: 'okul', ilce: 'yetkili', il: 'yetkili', admin: 'admin' };
  const BADGE = { herkes: 'Herkes', veli: 'Veli / öğrenci', ogretmen: 'Öğretmen ve üstü', okul: 'Okul yöneticisi ve üstü', yetkili: 'İlçe/il yetkilisi ve sistem yöneticisi', admin: 'Yalnız sistem yöneticisi' };
  const D = { cats: [], topics: [], quick: [], roadmap: {}, intro: '' };
  const G = { filter: '', q: '', topic: '', from: '', pubTopic: '' };
  const byId = id => D.topics.find(t => t.id === id);
  const catOf = t => D.cats.find(c => c.id === t.cat) || { title: '' };

  /** Konular kategori sırasına göre (kararlı) dizilir: önceki/sonraki gezintisi içindekiler sırasıyla gider. */
  function order() { const ix = id => { const i = D.cats.findIndex(c => c.id === id); return i < 0 ? 999 : i; }; D.topics = D.topics.map((t, i) => [t, i]).sort((a, b) => ix(a[0].cat) - ix(b[0].cat) || a[1] - b[1]).map(x => x[0]); }
  function define(d) { D.cats = d.cats || []; D.topics = d.topics || []; D.quick = d.quick || []; D.roadmap = d.roadmap || {}; D.intro = d.intro || ''; D.topics.forEach(t => { delete t._p; delete t._n; }); order(); }
  /** Ek konular (içerik birden çok dosyaya bölünmüştür) */
  function add(ts) { D.topics.push(...ts); order(); }

  /* ---------------------------------------------------------------- arama */
  /** Türkçe duyarsız küçük harf; karakter karakter 1:1 eşlenir (vurgu için konumlar korunur). */
  const norm = s => String(s == null ? '' : s).replace(/İ/g, 'i').replace(/I/g, 'ı').toLowerCase().replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ş/g, 's').replace(/ü/g, 'u').replace(/â/g, 'a').replace(/î/g, 'i').replace(/û/g, 'u');
  const strip = s => String(s == null ? '' : s).replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\[\[([^\]]+)\]\]/g, '$1').replace(/`([^`]+)`/g, '$1').replace(/\{\{([^}]+)\}\}/g, '$1').replace(/\(\(([a-z0-9-]+)\|([^)]+)\)\)/g, '$2');
  const strs = x => Array.isArray(x) ? x.flatMap(strs) : [x];
  /** Bir konunun düz metni (işaretsiz, tek boşluklu) */
  function plain(t) {
    if (t._p != null) return t._p;
    const parts = [t.title, t.sum || ''];
    (t.body || []).forEach(b => { const k = b[0]; if (k === 'table') { parts.push(...strs(b[1]), ...strs(b[2])); } else if (k === 'flow') { b[1].forEach(s => parts.push(...strs(s))); } else parts.push(...strs(b.slice(1))); });
    t._p = strip(parts.join(' ')).replace(/\s+/g, ' ').trim(); t._n = norm(t._p); return t._p;
  }
  const tokens = q => norm(q).split(/\s+/).filter(x => x.length > 0);
  function search(q, filter) {
    const tk = tokens(q); if (!tk.length) return [];
    const res = [];
    D.topics.forEach(t => {
      if (!shows(t, filter)) return;
      plain(t); const nt = norm(t.title), nk = norm(t.kw || ''), nb = t._n; let sc = 0, ok = true;
      for (const w of tk) {
        const inT = nt.includes(w), inK = nk.includes(w), inB = nb.includes(w);
        if (!inT && !inK && !inB) { ok = false; break; }
        sc += (inT ? 10 : 0) + (inK ? 6 : 0) + (inB ? 1 + Math.min(5, nb.split(w).length - 1) * .2 : 0);
      }
      if (ok) res.push({ t, sc });
    });
    return res.sort((a, b) => b.sc - a.sc).map(r => r.t);
  }
  function snippet(t, tk) {
    const p = plain(t), nt = t._n; let at = -1;
    for (const w of tk) { const i = nt.indexOf(w); if (i >= 0 && (at < 0 || i < at)) at = i; }
    if (at < 0) return p.slice(0, 150);
    const a = Math.max(0, at - 60), b = Math.min(p.length, at + 110);
    return (a ? '… ' : '') + p.slice(a, b).trim() + (b < p.length ? ' …' : '');
  }
  /** Metni vurgulu düğümlere böler */
  function hl(text, tk) {
    text = String(text);
    if (!tk || !tk.length) return [text];
    const nt = norm(text), rg = [];
    tk.forEach(w => { let i = 0; while ((i = nt.indexOf(w, i)) >= 0) { rg.push([i, i + w.length]); i += w.length; } });
    if (!rg.length) return [text];
    rg.sort((a, b) => a[0] - b[0]); const m = [];
    rg.forEach(r => { const l = m[m.length - 1]; if (l && r[0] <= l[1]) l[1] = Math.max(l[1], r[1]); else m.push(r.slice()); });
    const out = []; let p = 0;
    m.forEach(([a, b]) => { if (a > p) out.push(text.slice(p, a)); out.push(h('mark', null, text.slice(a, b))); p = b; });
    if (p < text.length) out.push(text.slice(p));
    return out;
  }

  /* ---------------------------------------------------------------- rol süzgeci */
  function myAud() { const u = App.state && App.state.user; return u ? (AUD_OF_ROLE[u.role] || 'ogretmen') : ''; }
  function shows(t, f) {
    if (!f || f === 'tum') return true;
    const a = t.aud || 'herkes';
    if (a === 'herkes') return true;
    if (f === 'veli') return a === 'veli';
    return a !== 'veli' && LVL[a] <= LVL[f];
  }
  const count = f => D.topics.filter(t => shows(t, f)).length;
  function defaultFilter(pub, topicId) {
    const m = myAud(); if (m) return m;
    const t = topicId && byId(topicId); return t && t.aud === 'veli' ? 'veli' : 'tum';
  }

  /* ---------------------------------------------------------------- satır içi ve blok çizimi */
  const TOK = /(\*\*[^*]+\*\*|\[\[[^\]]+\]\]|`[^`]+`|\{\{[^}]+\}\}|\(\([a-z0-9-]+\|[^)]+\)\))/;
  function inline(text, tk, o) {
    const out = [];
    String(text).split(TOK).forEach(part => {
      if (!part) return; let m;
      if ((m = part.match(/^\*\*([^*]+)\*\*$/))) out.push(h('b', null, ...hl(m[1], tk)));
      else if ((m = part.match(/^\[\[([^\]]+)\]\]$/))) out.push(h('span', { class: 'gd-ui' }, ...hl(m[1], tk)));
      else if ((m = part.match(/^`([^`]+)`$/))) out.push(h('code', { class: 'mono' }, m[1]));
      else if ((m = part.match(/^\{\{([^}]+)\}\}$/))) out.push(h('span', { class: 'gd-path' }, ...hl(m[1], tk)));
      else if ((m = part.match(/^\(\(([a-z0-9-]+)\|([^)]+)\)\)$/))) out.push(o && o.print ? h('span', { class: 'gd-lnk' }, m[2]) : h('a', { href: '#/kilavuz/' + m[1], class: 'gd-lnk', 'data-topic': m[1], onclick: e => { e.preventDefault(); open(m[1]); } }, ...hl(m[2], tk)));
      else out.push(...hl(part, tk));
    });
    return out;
  }
  const NOTE = { tip: 'İpucu', warn: 'Dikkat', info: 'Bilgi' };
  function block(b, tk, o) {
    const k = b[0], I = x => inline(x, tk, o);
    if (k === 'p') return h('p', null, ...I(b[1]));
    if (k === 'h') return h('h3', { class: 'gd-h' }, ...I(b[1]));
    if (k === 'ul') return h('ul', { class: 'gd-ul' }, b[1].map(x => h('li', null, ...I(x))));
    if (k === 'steps') return h('ol', { class: 'gd-steps' }, b[1].map(x => { const a = Array.isArray(x) ? x : [x]; return h('li', null, h('div', { class: 'gd-st' }, ...I(a[0])), a[1] ? h('div', { class: 'gd-sd' }, ...I(a[1])) : null); }));
    if (NOTE[k]) return h('div', { class: 'gd-note ' + k }, h('b', null, NOTE[k] + ': '), ...I(b[1]));
    if (k === 'table') return h('div', { class: 'tablewrap gd-tw' }, h('table', { class: 'gd-tbl' }, h('thead', null, h('tr', null, b[1].map(c => h('th', null, ...I(c))))), h('tbody', null, b[2].map(r => h('tr', null, r.map(c => h('td', null, ...I(c))))))));
    if (k === 'flow') return h('div', { class: 'gd-flow' }, b[1].map((s, i) => h('div', { class: 'gd-fs' }, h('span', { class: 'gd-fn' }, String(i + 1)), h('b', null, ...I(s[0])), s[1] ? h('small', null, ...I(s[1])) : null)));
    return null;
  }

  /* ---------------------------------------------------------------- ekrana gitme */
  const TABSET = { forms: t => { FM.tab = t; }, admin: t => { AD.tab = t; }, results: t => { RS.tab = t; }, analiz: t => { AN.tab = t; } };
  const VIEW_ROLES = { admin: ['admin', 'il', 'ilce', 'okul'] };
  function canGo(g) {
    const u = App.state && App.state.user; if (!u) return false;
    const nav = (typeof NAV !== 'undefined' ? NAV : []).find(n => n.id === g.view);
    if (!nav) return false;
    if (nav.roles && !nav.roles.includes(u.role)) return false;
    return !g.roles || g.roles.includes(u.role);
  }
  function goTo(g) {
    if (!canGo(g)) return;
    try { if (g.tab && TABSET[g.view]) TABSET[g.view](g.tab); } catch (e) { }
    if (g.newExam) App.newExam = {};
    if (document.querySelector('.nav')) App.go(g.view);
    else { try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { } App.start(g.view); }
  }
  /** Bulunulan ekran/sekme için ilgili kılavuz konusu */
  function contextTopic() {
    const v = App.state.view, pick = (map, key, dflt) => map[key] || dflt;
    try {
      if (v === 'forms') return pick({ catalog: 'form-katalog', design: 'form-tasarla', auto: 'form-harici-otomatik', custom: 'form-elle' }, FM.tab, 'form-secenek');
      if (v === 'admin') return pick({ schools: 'yon-okullar', students: 'yon-ogrenciler', users: 'yon-kullanicilar', wa: 'wa-mesaj', apps: 'yon-basvurular', ai: 'yon-ai' }, AD.tab, 'yon-ogrenciler');
      if (v === 'results') return pick({ students: 'sonuc-ogr', schools: 'sonuc-okul', ilce: 'sonuc-ilce', items: 'sonuc-madde', karne: 'sonuc-karne' }, RS.tab, 'sonuc-ogr');
      if (v === 'analiz') return pick({ list: 'an-list', ogr: 'an-ogr', sinif: 'an-sinif', ders: 'an-ders', okul: 'an-okul', kars: 'an-kars', dev: 'an-dev', cmp: 'an-ozet', listeler: 'an-listeler', karne: 'an-karne' }, AN.tab, 'an-baslangic');
    } catch (e) { }
    return { scan: 'okut-adimlar', queue: 'kuyruk', exams: 'sinav-yeni', settings: 'ayarlar' }[v] || '';
  }
  function openContext() {
    G.from = App.state.view === 'guide' ? G.from : App.state.view; G.q = '';
    const id = contextTopic(); G.topic = id && byId(id) ? id : '';
    if (G.topic && !shows(byId(G.topic), G.filter || myAud())) G.filter = 'tum';
    App.go('guide');
  }
  function open(id) {
    const t = byId(id); if (!t) return;
    G.topic = id; G.q = '';
    if (!shows(t, G.filter)) G.filter = 'tum';
    if (G.redraw) G.redraw(true);
  }

  /* ---------------------------------------------------------------- konu sayfası */
  function goButtons(t) {
    const gs = t.go ? (Array.isArray(t.go) ? t.go : [t.go]) : []; if (!gs.length) return null;
    const logged = !!(App.state && App.state.user);
    return h('div', { class: 'gd-go no-print' }, gs.map(g => g.href
      ? h('a', { class: 'btn primary sm gd-gobtn', href: g.href }, '→ ' + (g.label || 'Sayfayı aç'))
      : canGo(g)
      ? h('button', { class: 'btn primary sm gd-gobtn', 'data-view': g.view, onclick: () => goTo(g) }, '→ ' + (g.label || 'Bu ekranı aç'))
      : h('span', { class: 'small muted gd-nogo' }, logged ? `(${g.label || 'Bu ekran'}: rolünüzde bu ekran yok)` : `(${g.label || 'Bu ekran'}: giriş yaptıktan sonra açılır)`)));
  }
  function topicEl(t, o) {
    o = o || {}; const tk = o.tk || [];
    const el = h('article', { class: 'gd-topic', id: 'gd-t-' + t.id, 'data-topic': t.id },
      h('div', { class: 'gd-meta' }, h('span', { class: 'gd-cat' }, catOf(t).title), h('span', { class: 'pill brand gd-aud' }, BADGE[t.aud || 'herkes'])),
      h('h2', null, ...hl(t.title, tk)), t.sum ? h('p', { class: 'gd-sum' }, ...inline(t.sum, tk, o)) : null);
    (t.body || []).forEach(b => { const n = block(b, tk, o); if (n) el.append(n); });
    if (!o.print) {
      el.append(goButtons(t));
      const rel = (t.see || []).map(byId).filter(Boolean);
      if (rel.length) el.append(h('div', { class: 'gd-rel no-print' }, h('b', null, 'İlgili konular: '), rel.map((r, i) => [i ? ' · ' : '', h('a', { href: '#/kilavuz/' + r.id, class: 'gd-lnk', onclick: e => { e.preventDefault(); open(r.id); } }, r.title)])));
    }
    return el;
  }

  /* ---------------------------------------------------------------- yazdırma */
  function printDoc(list, label) {
    if (!list.length) return toast('Yazdırılacak konu yok', 'bad');
    const cats = D.cats.filter(c => list.some(t => t.cat === c.id));
    const doc = h('div', { class: 'gd-doc' },
      h('div', { class: 'gd-cover' }, h('h1', null, 'OptiNet kullanım kılavuzu'), h('div', { class: 'gd-cv-sub' }, label), h('div', { class: 'gd-cv-date' }, new Date().toLocaleDateString('tr-TR', { dateStyle: 'long' }))),
      list.length > 1 ? h('div', { class: 'gd-pt' }, h('h2', null, 'İçindekiler'), cats.map(c => h('div', { class: 'gd-pt-c' }, h('b', null, c.title), h('ol', null, list.filter(t => t.cat === c.id).map(t => h('li', null, t.title)))))) : null,
      cats.map(c => h('section', { class: 'gd-pc' }, list.length > 1 ? h('h1', { class: 'gd-pc-h' }, c.title) : null, list.filter(t => t.cat === c.id).map(t => topicEl(t, { print: true })))));
    const pa = clear($('#printArea')); pa.append(doc);
    const st = h('style', { id: 'gd-page' }); st.textContent = '@page { size: A4; margin: 14mm 15mm; }'; document.head.append(st);
    const done = () => { clear(pa); st.remove(); window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done); setTimeout(() => window.print(), 150);
  }

  /* ---------------------------------------------------------------- ekran */
  function mount(root, opts) {
    opts = opts || {}; const pub = !!opts.pub, mobile = () => window.matchMedia && window.matchMedia('(max-width: 899px)').matches;
    if (opts.topic && byId(opts.topic)) { G.topic = opts.topic; G.q = ''; }
    if (!G.filter || (pub && opts.topic)) G.filter = defaultFilter(pub, G.topic);
    if (G.topic && byId(G.topic) && !shows(byId(G.topic), G.filter)) G.filter = 'tum';
    const logged = !!(App.state && App.state.user), mine = myAud();
    const roleBox = h('div', { class: 'gd-roles no-print', role: 'group', 'aria-label': 'Kılavuzu şu role göre göster' }), tocBox = h('details', { class: 'gd-toc no-print' }), main = h('div', { class: 'gd-main', id: 'gd-main' });
    tocBox.open = !mobile();
    const q = h('input', { type: 'search', id: 'gd-q', class: 'gd-q', placeholder: 'Kılavuzda ara: örn. cevap anahtarı, kamera, karne, veli kodu…', value: G.q, 'aria-label': 'Kılavuzda ara', autocomplete: 'off', oninput: e => { G.q = e.target.value; clearTimeout(q._t); q._t = setTimeout(() => drawMain(), 120); } });
    const curList = () => D.topics.filter(t => shows(t, G.filter));
    const label = () => G.filter === 'tum' ? 'Tüm konular' : (AUDS.find(a => a[0] === G.filter) || [0, ''])[1] + ' için';

    function drawRoles() {
      clear(roleBox).append(h('span', { class: 'small muted' }, 'Kimin için:'), [['tum', 'Tümü']].concat(AUDS).map(([id, l]) => h('button', { class: 'gd-role' + (G.filter === id ? ' on' : ''), id: 'gd-role-' + id, type: 'button', 'aria-pressed': String(G.filter === id), onclick: () => { G.filter = id; if (G.topic && !shows(byId(G.topic) || {}, id)) G.topic = ''; draw(); } }, l, h('small', null, String(count(id))), id === mine ? h('span', { class: 'gd-me', title: 'Sizin rolünüz' }, ' ★') : null)));
    }
    function drawToc() {
      const list = curList(); const open = tocBox.open; clear(tocBox);
      tocBox.append(h('summary', null, 'İçindekiler ', h('span', { class: 'small muted' }, `(${list.length} konu)`)),
        h('button', { class: 'gd-home' + (!G.topic && !G.q.trim() ? ' on' : ''), id: 'gd-home', type: 'button', onclick: () => { G.topic = ''; G.q = ''; q.value = ''; draw(); } }, '⌂ Başlangıç'),
        D.cats.map(c => { const ts = list.filter(t => t.cat === c.id); return ts.length ? h('details', { class: 'gd-cat', open: true }, h('summary', null, c.title), ts.map(t => h('button', { class: 'gd-ti' + (G.topic === t.id ? ' on' : ''), type: 'button', 'data-topic': t.id, onclick: () => { G.topic = t.id; G.q = ''; q.value = ''; if (mobile()) tocBox.open = false; draw(true); } }, t.title))) : null; }));
      tocBox.open = open;
    }
    function homeView() {
      const list = curList(), box = h('div', { class: 'gd-home-v' });
      box.append(h('div', { class: 'card' }, h('h2', { style: { marginTop: 0 } }, 'Hoş geldiniz'), h('p', null, ...inline(D.intro, [])),
        logged ? h('p', { class: 'small muted' }, `Giriş rolünüz: ${(AUDS.find(a => a[0] === mine) || [0, ''])[1]}. Konular buna göre süzüldü; "Tümü" ile bütün kılavuzu görebilirsiniz.`) : h('p', { class: 'small muted' }, 'Giriş yapmadan da okuyabilirsiniz. Üstteki düğmelerden kendinize uygun rolü seçin.')));
      const qk = D.quick.filter(x => shows({ aud: x.aud || 'herkes' }, G.filter) && byId(x.go));
      if (qk.length) box.append(h('div', { class: 'card' }, h('h2', { style: { marginTop: 0 } }, 'Ne yapmak istiyorsunuz?'), h('div', { class: 'gd-quick' }, qk.map(x => h('button', { class: 'gd-qk', type: 'button', 'data-go': x.go, onclick: () => open(x.go) }, h('b', null, x.t), h('span', { class: 'small muted' }, x.d))))));
      const rms = G.filter === 'tum' ? AUDS : AUDS.filter(a => a[0] === G.filter);
      const rmEls = rms.map(([id, l]) => { const ids = (D.roadmap[id] || []).filter(x => byId(x)); return ids.length ? h('details', { class: 'gd-rm', open: rms.length === 1 }, h('summary', null, `${l}: başlangıç yol haritası`), h('ol', null, ids.map(x => h('li', null, h('a', { href: '#/kilavuz/' + x, class: 'gd-lnk', onclick: e => { e.preventDefault(); open(x); } }, byId(x).title), byId(x).sum ? h('span', { class: 'small muted' }, ' — ' + strip(byId(x).sum)) : null)))) : null; }).filter(Boolean);
      if (rmEls.length) box.append(h('div', { class: 'card' }, h('h2', { style: { marginTop: 0 } }, 'Yol haritası'), rmEls));
      box.append(h('div', { class: 'gd-cats' }, D.cats.map(c => { const ts = list.filter(t => t.cat === c.id); return ts.length ? h('div', { class: 'card gd-catcard' }, h('h3', { style: { marginTop: 0 } }, c.title), c.desc ? h('p', { class: 'small muted' }, c.desc) : null, h('ul', { class: 'gd-ul' }, ts.map(t => h('li', null, h('a', { href: '#/kilavuz/' + t.id, class: 'gd-lnk', onclick: e => { e.preventDefault(); open(t.id); } }, t.title))))) : null; })));
      return box;
    }
    function searchView(qs) {
      const tk = tokens(qs), res = search(qs, G.filter), box = h('div', { class: 'gd-res' });
      box.append(h('p', { class: 'small muted', id: 'gd-count' }, res.length ? `${res.length} konu bulundu (${label()}).` : `"${qs}" için sonuç yok (${label()}).`));
      if (!res.length) { box.append(h('div', { class: 'card empty' }, 'Sonuç bulunamadı. Daha kısa ya da başka bir sözcük deneyin', G.filter !== 'tum' ? h('span', null, ' ya da ', h('button', { class: 'btn sm', id: 'gd-all', onclick: () => { G.filter = 'tum'; draw(); } }, 'Tüm roller'), ' ile arayın') : null, '.')); return box; }
      res.slice(0, 40).forEach(t => box.append(h('a', { class: 'card gd-hit', href: '#/kilavuz/' + t.id, 'data-topic': t.id, onclick: e => { e.preventDefault(); G.topic = t.id; G.q = ''; q.value = ''; draw(true); } }, h('div', { class: 'gd-meta' }, h('span', { class: 'gd-cat' }, catOf(t).title), h('span', { class: 'pill brand gd-aud' }, BADGE[t.aud || 'herkes'])), h('b', null, ...hl(t.title, tk)), h('div', { class: 'small muted' }, ...hl(snippet(t, tk), tk)))));
      return box;
    }
    function topicView(t) {
      const list = curList(), i = list.findIndex(x => x.id === t.id), prev = list[i - 1], next = list[i + 1];
      const box = h('div', null,
        h('div', { class: 'gd-tools no-print' },
          opts.from || G.from ? h('button', { class: 'btn sm', id: 'gd-back', onclick: () => App.go(G.from) }, '← Geri dön') : null,
          h('span', { class: 'grow' }),
          h('button', { class: 'btn sm', id: 'gd-link', onclick: () => { const u = location.origin + location.pathname + '#/kilavuz/' + t.id; navigator.clipboard && navigator.clipboard.writeText ? navigator.clipboard.writeText(u).then(() => toast('Bağlantı kopyalandı', 'ok'), () => toast(u)) : toast(u); } }, 'Bağlantıyı kopyala'),
          h('button', { class: 'btn sm', id: 'gd-print-one', onclick: () => printDoc([t], 'Konu: ' + t.title) }, 'Bu konuyu yazdır')),
        h('div', { class: 'card gd-card' }, topicEl(t)),
        h('div', { class: 'gd-pn no-print' }, prev ? h('button', { class: 'btn', id: 'gd-prev', onclick: () => { G.topic = prev.id; draw(true); } }, '◀ ' + prev.title) : h('span'), next ? h('button', { class: 'btn', id: 'gd-next', onclick: () => { G.topic = next.id; draw(true); } }, next.title + ' ▶') : h('span')));
      return box;
    }
    function drawMain(scroll) {
      const qs = G.q.trim(); clear(main);
      if (qs) main.append(searchView(qs)); else if (G.topic && byId(G.topic)) main.append(topicView(byId(G.topic))); else main.append(homeView());
      if (scroll) window.scrollTo(0, 0);
      drawToc();
    }
    function draw(scroll) { drawRoles(); drawMain(scroll); }
    G.redraw = scroll => { if (!document.body.contains(main)) { G.redraw = null; return; } q.value = G.q; draw(scroll); };

    const head = h('div', { class: 'gd-head no-print' },
      pub ? h('div', { class: 'row between', style: { marginBottom: '.4rem' } }, h('a', { href: '#', id: 'gd-exit', onclick: e => { e.preventDefault(); try { history.replaceState(null, '', location.pathname + location.search); } catch (x) { } App.backToApp(); } }, logged ? '← Uygulamaya dön' : '← Giriş sayfasına dön')) : null,
      h('div', { class: 'row between' }, h('h1', { style: { margin: 0 } }, 'Kullanım kılavuzu'), h('div', { class: 'row' },
        h('button', { class: 'btn', id: 'gd-print-all', onclick: () => printDoc(curList(), label()), title: 'Seçili rolün tüm konularını A4 olarak yazdırır; yazdırma penceresinde "PDF olarak kaydet" seçebilirsiniz' }, 'Tümünü yazdır / PDF'))),
      h('div', { class: 'gd-bar' }, q), roleBox);
    root.append(head, h('div', { class: 'gd' }, tocBox, main));
    draw();
  }

  /* ---------------------------------------------------------------- girişsiz sayfa (#/kilavuz[/konu]) */
  const fromHash = () => { const m = /^#\/kilavuz(?:\/([a-z0-9-]+))?/.exec(location.hash || ''); return m ? (m[1] || '') : null; };
  function renderPublic() {
    const id = fromHash(); const app = clear($('#app'));
    const root = h('div', { class: 'gd-page' }); app.append(root); mount(root, { pub: true, topic: id || '' });
    window.scrollTo(0, 0);
  }

  return { define, add, mount, open, openContext, contextTopic, search, shows, plain, norm, topics: () => D.topics, cats: () => D.cats, quick: () => D.quick, roadmap: () => D.roadmap, byId, canGo, goTo, fromHash, renderPublic, printDoc, state: G, AUDS };
})();

App.views.guide = function (root) { Guide.mount(root, {}); };
App.renderGuidePublic = () => Guide.renderPublic();
