/* analiz.js — Sınav analiz programı: sistemdeki sınavlar + dışarıdan eklenen (yayınevi vb.) sınavlar bir arada.
 * Sekmeler: Sınav listesi (D/Y/N, puan, dereceler, ortalamalar) · Gelişim (net/puan artışı) · Karşılaştırma (sınav ve sınıf özetleri, grafik). */
'use strict';

const AN = { okul: '', cls: '', q: '', sel: new Set(), selInit: false, metric: 'net', lesson: '', tab: 'list', stu: '', stuLesson: '', ls: 'genel', autoAll: {}, examId: '', data: new Map(), names: new Map(), loading: new Set(), sort: { key: 'puan', dir: -1 }, dsort: { key: 'ad', dir: 1 }, busyMsg: '' };
const anSumQ = L => L.reduce((a, x) => a + (x.count || 0), 0);
const anNk = s => DisCore.nk(s);
const anDate = d => (d ? String(d).slice(0, 10) : '');
const anFmtDate = d => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d || ''); return m ? `${m[3]}.${m[2]}.${m[1]}` : (d || ''); };

/** Analizin okulunu ortak seçimle eşitler (ortak okul varsa o; yoksa il/ilçe/düzey süzgecine uymayan okulun yerine süzgeçteki ilk okul). Değiştiyse true. */
function anSyncOkul(schools) {
  const g = Sel.okul(schools, '');
  if (g) { if (g !== String(AN.okul)) { anSetOkul(g); return true; } return false; }
  const cur = schoolByCode(AN.okul);
  if (cur && !Sel.fits(cur)) { const f = schools.find(s => Sel.fits(s)); if (f) { anSetOkul(f.okulKodu); return true; } }
  return false;
}
/** Okul değişince analiz durumunu sıfırlar (sınav seçimi, yüklü veriler, sınıf). Yeniden yüklemeyi çağıran yapar. */
function anSetOkul(code) { AN.okul = String(code); Settings.set('anOkul', AN.okul); AN.sel.clear(); AN.data.clear(); AN.selInit = false; AN.cls = ''; AN.examId = ''; }

/* ---------------------------------------------------------------- veri */
function anNormInt(D) {
  const cfg = D.exam.config || {}, lessons = D.sections.map(s => ({ name: s.name, count: s.count || 0 }));
  const rows = D.rows.map(r => ({ okulKodu: String(r.okulKodu), no: normNo(r.ogrNo), ad: r.ad || '', sinif: r.sinif || '', sec: r.sec.map(s => [s[0], s[1], s[2], s[3]]), D: r.D, Y: r.Y, B: r.B, net: r.net, puan: r.puan, rk: { snf: r.rSinif, okul: r.rOkul, ilce: r.rIlce, il: r.rIl, genel: r.rGenel }, registered: r.registered !== false }));
  return { id: D.exam.examId, ext: false, name: D.exam.name, date: anDate(D.exam.date), kaynak: 'Sistem', lessons, penalty: cfg.penalty || 0, puanAdi: 'Puan', rows, avg: null, avgOkul: null, totalQ: anSumQ(lessons), cohortN: D.cohort ? D.cohort.n : rows.length };
}
function anNormExt(d) {
  const ex = d.exam, c = ex.config, lessons = c.lessons.map(l => ({ name: l.name, count: l.count || 0 })), tq = anSumQ(lessons);
  const rows = d.rows.map(r => {
    const sec = lessons.map((l, i) => { const s = r.sec[i] || [null, null, null]; return [s[0], s[1], (s[0] != null && s[1] != null && l.count) ? Math.max(l.count - s[0] - s[1], 0) : null, s[2]]; });
    const sum = k => sec.reduce((a, s) => a + (s[k] || 0), 0), t = r.tot || [];
    const D = t[0] != null ? t[0] : sum(0), Y = t[1] != null ? t[1] : sum(1), net = t[2] != null ? t[2] : DisCore.r2(sum(3));
    return { okulKodu: String(ex.okulKodu), no: normNo(r.ogrNo), ad: r.ad || '', sinif: r.sinif || '', sec, D, Y, B: tq ? Math.max(tq - D - Y, 0) : null, net, puan: r.puan, rk: r.rk || {}, registered: r.registered };
  });
  const toAvg = a => a ? { sec: lessons.map((l, i) => { const s = (a.sec || [])[i] || [null, null, null]; return [s[0], s[1], null, s[2]]; }), D: a.tot[0], Y: a.tot[1], net: a.tot[2], puan: a.puan } : null;
  return { id: ex.examId, ext: true, name: ex.name, date: anDate(ex.date), kaynak: ex.kaynak || 'Dış sınav', lessons, penalty: c.penalty || 0, puanAdi: c.puanAdi || 'Puan', rows, avg: toAvg(c.avg), avgOkul: toAvg(c.avgOkul), totalQ: tq, cohortN: rows.length, meta: ex };
}
function anAvgOf(rows, nL) {
  const m = (f) => { const v = rows.map(f).filter(x => x != null && !isNaN(x)); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
  const sec = []; for (let i = 0; i < nL; i++) sec.push([m(r => r.sec[i] && r.sec[i][0]), m(r => r.sec[i] && r.sec[i][1]), m(r => r.sec[i] && r.sec[i][2]), m(r => r.sec[i] && r.sec[i][3])]);
  return { sec, D: m(r => r.D), Y: m(r => r.Y), B: m(r => r.B), net: m(r => r.net), puan: m(r => r.puan), computed: true };
}
async function anLoad(entry) {
  if (AN.data.has(entry.id)) return AN.data.get(entry.id);
  let n;
  if (entry.ext) n = anNormExt(await cached('ext:' + entry.id, 'getExternal', { examId: entry.id }));
  else n = anNormInt(await cached('results:' + entry.id, 'getResults', { examId: entry.id }));
  const st = await anStudents(AN.okul); n.rows.forEach(r => { if (!r.ad) { const s = st.get(r.no); if (s) { r.ad = (s.ad + ' ' + (s.soyad || '')).trim(); if (!r.sinif) r.sinif = String(s.sinif || ''); } } });
  AN.data.set(entry.id, n); return n;
}
async function anStudents(code) {
  const k = String(code); if (AN.names.has(k)) return AN.names.get(k);
  const m = new Map(); (await getStudents(k)).forEach(s => m.set(normNo(s.ogrNo), s)); AN.names.set(k, m); return m;
}
const anCatalog = () => {
  const S = App.state, out = [];
  S.exams.forEach(e => out.push({ id: e.examId, ext: false, name: e.name, date: anDate(e.date), kaynak: 'Sistem', raw: e }));
  Dis.list.filter(e => String(e.okulKodu) === String(AN.okul)).forEach(e => out.push({ id: e.examId, ext: true, name: e.name, date: anDate(e.date), kaynak: e.kaynak || 'Dış sınav', raw: e }));
  return out.sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999') || a.name.localeCompare(b.name, 'tr'));
};
const anSelected = () => anCatalog().filter(e => AN.sel.has(e.id) && AN.data.has(e.id)).map(e => AN.data.get(e.id));
const anRows = n => n.rows.filter(r => r.okulKodu === String(AN.okul));

/* ---------------------------------------------------------------- ölçütler */
const METRICS = [['net', 'Net'], ['puan', 'Puan'], ['pct', 'Başarı %'], ['D', 'Doğru'], ['Y', 'Yanlış']];
function anVal(r, n, metric, lesson) {
  const li = lesson ? n.lessons.findIndex(l => anNk(l.name) === anNk(lesson)) : -1;
  if (lesson) { if (li < 0) return null; const s = r.sec[li]; if (!s) return null; const c = n.lessons[li].count; return metric === 'D' ? s[0] : metric === 'Y' ? s[1] : metric === 'pct' ? (c && s[3] != null ? s[3] / c * 100 : null) : s[3]; }
  return metric === 'D' ? r.D : metric === 'Y' ? r.Y : metric === 'puan' ? r.puan : metric === 'pct' ? (n.totalQ && r.net != null ? r.net / n.totalQ * 100 : null) : r.net;
}
const anFmt = (v, metric) => v == null ? '–' : metric === 'pct' ? nf(v, 1) + '%' : nf(v, 2);
const anDelta = (d, metric) => { if (d == null) return ''; const eps = metric === 'pct' ? 0.05 : 0.005, flat = Math.abs(d) < eps; return h('span', { class: 'an-d ' + (flat ? '' : d > 0 ? 'up' : 'down'), title: 'Önceki sınava göre değişim' }, flat ? '＝' : (d > 0 ? '▲ +' : '▼ −') + (metric === 'pct' ? nf(Math.abs(d), 1) + ' puan' : nf(Math.abs(d), 2))); };
const anLessons = ns => { const m = new Map(); ns.forEach(n => n.lessons.forEach(l => { if (!m.has(anNk(l.name))) m.set(anNk(l.name), l.name); })); return Array.from(m.values()); };
const anClasses = ns => Array.from(new Set(ns.flatMap(n => anRows(n).map(r => r.sinif).filter(Boolean)))).sort((a, b) => String(a).localeCompare(String(b), 'tr', { numeric: true }));
function anFilter(rows) { const t = AN.q.trim().toLocaleLowerCase('tr'); return rows.filter(r => (!AN.cls || r.sinif === AN.cls) && (!t || (r.no + ' ' + r.ad).toLocaleLowerCase('tr').includes(t))); }
const badge = en => h('span', { class: 'pill ' + (en.ext ? 'warn' : 'brand'), title: en.ext ? 'Dışarıdan eklenen sınav' : 'Bu sistemde okutulan sınav' }, en.ext ? 'Dış · ' + en.kaynak : 'Sistem');

/** SVG çizgi grafik: series [{name, pts:[{x:etiket, y:sayı|null}], cls}] */
function anChart(labels, series, opt) {
  opt = opt || {}; const W = 640, Ht = 220, pl = 44, pr = 14, pt = 16, pb = 44, ys = series.flatMap(s => s.pts.map(p => p.y)).filter(v => v != null);
  if (!ys.length || labels.length < 1) return h('div', { class: 'muted small' }, 'Grafik için yeterli veri yok.');
  let lo = Math.min(...ys), hi = Math.max(...ys); if (lo === hi) { lo -= 1; hi += 1; } const pad = (hi - lo) * .12; lo -= pad; hi += pad;
  const X = i => pl + (labels.length === 1 ? (W - pl - pr) / 2 : i * (W - pl - pr) / (labels.length - 1)), Y = v => pt + (1 - (v - lo) / (hi - lo)) * (Ht - pt - pb);
  const ns = 'http://www.w3.org/2000/svg', el = (t, a, txt) => { const e = document.createElementNS(ns, t); Object.entries(a || {}).forEach(([k, v]) => e.setAttribute(k, v)); if (txt != null) e.textContent = txt; return e; };
  const svg = el('svg', { viewBox: `0 0 ${W} ${Ht}`, class: 'an-chart', role: 'img', 'aria-label': opt.label || 'Sınavlara göre değişim' });
  for (let i = 0; i <= 3; i++) { const v = lo + (hi - lo) * i / 3, y = Y(v); svg.append(el('line', { x1: pl, x2: W - pr, y1: y, y2: y, class: 'an-grid' }), el('text', { x: pl - 6, y: y + 4, 'text-anchor': 'end', class: 'an-ax' }, nf(v, opt.pct ? 0 : 1))); }
  labels.forEach((l, i) => { const t = el('text', { x: X(i), y: Ht - pb + 16, 'text-anchor': 'middle', class: 'an-ax' }, l.length > 14 ? l.slice(0, 13) + '…' : l); t.append(el('title', {}, l)); svg.append(t); });
  series.forEach((s, si) => {
    const pts = s.pts.map((p, i) => p.y == null ? null : [X(i), Y(p.y), p.y]).filter(Boolean);
    if (pts.length > 1) svg.append(el('polyline', { points: pts.map(p => p[0] + ',' + p[1]).join(' '), class: 'an-line s' + si, fill: 'none' }));
    pts.forEach(p => { const c = el('circle', { cx: p[0], cy: p[1], r: 4, class: 'an-dot s' + si }); c.append(el('title', {}, `${s.name}: ${nf(p[2], 2)}`)); svg.append(c, el('text', { x: p[0], y: p[1] - 9, 'text-anchor': 'middle', class: 'an-val s' + si }, nf(p[2], opt.pct ? 1 : 2))); });
  });
  const wrap = h('div', { class: 'an-chartwrap' }, svg);
  if (series.length > 1) wrap.append(h('div', { class: 'row small', style: { justifyContent: 'center', gap: '1rem' } }, series.map((s, i) => h('span', null, h('span', { class: 'an-key s' + i }), ' ', s.name))));
  return wrap;
}
function anSpark(vals) {
  const v = vals.filter(x => x != null); if (v.length < 2) return h('span', { class: 'muted' }, '–');
  const lo = Math.min(...v), hi = Math.max(...v), W = 80, Ht = 22, n = vals.length, ns = 'http://www.w3.org/2000/svg'; const svg = document.createElementNS(ns, 'svg'); svg.setAttribute('viewBox', `0 0 ${W} ${Ht}`); svg.setAttribute('class', 'an-spark'); svg.setAttribute('aria-hidden', 'true');
  const pts = vals.map((x, i) => x == null ? null : [n === 1 ? W / 2 : 2 + i * (W - 4) / (n - 1), hi === lo ? Ht / 2 : 2 + (1 - (x - lo) / (hi - lo)) * (Ht - 4)]).filter(Boolean);
  const pl = document.createElementNS(ns, 'polyline'); pl.setAttribute('points', pts.map(p => p.join(',')).join(' ')); pl.setAttribute('class', 'an-line s0'); pl.setAttribute('fill', 'none'); svg.append(pl);
  const last = pts[pts.length - 1], c = document.createElementNS(ns, 'circle'); c.setAttribute('cx', last[0]); c.setAttribute('cy', last[1]); c.setAttribute('r', 2.5); c.setAttribute('class', 'an-dot s0'); svg.append(c); return svg;
}

/** Yazdır: uygulama kabuğu gizlenir, yalnızca analiz içeriği basılır (veli karnesindeki pt-printing kuralı). */
function anPrint() {
  if (AN.tab === 'karne' && typeof krPending === 'function' && krPending()) return toast('Karneler hazırlanıyor; birkaç saniye bekleyip yeniden deneyin.', 'warn');
  document.body.classList.add('pt-printing');
  // Karneler A4 dikey, diğer analiz çıktıları A4 yatay basılır (kâğıt yönü bu sayfa kuralıyla belirlenir).
  const pg = document.createElement('style'); pg.id = 'an-page-style'; pg.textContent = AN.tab === 'karne' ? '@page { size: A4 portrait; margin: 10mm; }' : '@page { size: A4 landscape; margin: 10mm; }'; document.head.appendChild(pg);
  const done = () => { document.body.classList.remove('pt-printing'); pg.remove(); window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done); setTimeout(() => window.print(), 50);
}

/* Sekme kayıt defteri: analiz-ogr.js öğrenci / sınıf / ders / liste sekmelerini buraya ekler. { id, label, filters:[], render(pane, sel, ctx), export(sel, ctx) } */
const ANTABS = [];
/* Sekmeler gruplanmış sırayla gösterilir: Sınav · Kişi ve gruplar · Kıyas · Çıktı. Sekme kimlikleri (an-tab-<id>) sabittir. */
const AN_GROUPS = [['Sınav', ['list', 'cmp']], ['Kim / hangi grup', ['ogr', 'sinif', 'ders', 'okul']], ['Kıyas ve liste', ['kars', 'dev', 'listeler']], ['Çıktı', ['karne']]];
const AN_ORDER = AN_GROUPS.flatMap(g => g[1]), AN_LABEL = { list: 'Sınav listesi', dev: 'Gelişim (net artışı)', cmp: 'Sınav özeti' };
/** Bu sekmeler ilk açılışta okulun bütün sınavlarını analize katar. */
const AN_AUTOALL = ['ogr', 'sinif', 'ders', 'listeler', 'okul', 'kars', 'karne'];

/* ---------------------------------------------------------------- görünüm */
App.views.analiz = function (root) {
  const S = App.state, u = S.user;
  const schools = S.schools.slice().sort((a, b) => String(a.okulAdi).localeCompare(String(b.okulAdi), 'tr'));
  anSyncOkul(schools);
  if (!AN.okul || !schoolByCode(AN.okul)) AN.okul = String((u.okulKodu && schoolByCode(u.okulKodu)) ? u.okulKodu : (Settings.get('anOkul', '') && schoolByCode(Settings.get('anOkul', '')) ? Settings.get('anOkul', '') : (schools[0] ? schools[0].okulKodu : '')));
  const top = h('div'), body = h('div', { id: 'an-body' });
  root.append(h('div', { class: 'row between no-print' }, h('h1', null, 'Sınav analizi'), h('div', { class: 'row' },
    h('button', { class: 'btn primary', id: 'an-add', onclick: () => anAdd('upload') }, '+ Dış sınav ekle'), h('button', { class: 'btn', id: 'an-addrow', onclick: () => anAdd('grid') }, 'Satır satır gir'), h('button', { class: 'btn', id: 'an-tpl', onclick: () => Dis.templateModal() }, '⬇ Excel şablonu'))), top, body);
  if (!schools.length) { body.append(h('div', { class: 'empty card' }, 'Önce bir okul ve öğrenci listesi ekleyin (Yönetim → Okullar).')); return; }

  async function anAdd(tab) { if (!Dis.loaded) await Dis.load().catch(() => { }); Dis.editor({ okulKodu: AN.okul, tab, onSaved: id => { AN.data.delete(id); AN.sel.add(id); draw(); loadSelected(); } }); }
  async function init() {
    clear(body).append(h('div', { class: 'card muted' }, 'Sınavlar yükleniyor…'));
    try { await Dis.load(); } catch (e) { if (!Dis.loaded) { Dis.list = []; body.append(h('div', { class: 'alert warn' }, 'Dış sınav listesi alınamadı: ' + e.message)); } }
    if (!AN.selInit) { const c = anCatalog(); c.slice(-4).forEach(e => AN.sel.add(e.id)); AN.selInit = true; }
    draw(); loadSelected();
  }
  async function loadSelected() {
    const need = anCatalog().filter(e => AN.sel.has(e.id) && !AN.data.has(e.id) && !AN.loading.has(e.id)); if (!need.length) return;
    need.forEach(e => AN.loading.add(e.id)); drawStatus();
    for (let i = 0; i < need.length; i += 3) await Promise.all(need.slice(i, i + 3).map(async e => { try { await anLoad(e); } catch (er) { AN.sel.delete(e.id); toast(`"${e.name}" yüklenemedi: ${er.message}`, 'bad'); } finally { AN.loading.delete(e.id); } }));
    if (App.state.view === 'analiz') draw();
  }
  const selectAll = () => { anCatalog().forEach(e => AN.sel.add(e.id)); draw(); loadSelected(); };
  const openStudent = no => { AN.stu = String(no); AN.stuLesson = ''; AN.tab = 'ogr'; if (!anCatalog().every(e => AN.sel.has(e.id))) selectAll(); else draw(); window.scrollTo(0, 0); };
  const ctx = { renderTab: () => renderTab(), draw: () => draw(), openStudent, selectAll, loadSelected };
  function drawStatus() { const s = $('#an-status'); if (s) s.textContent = AN.loading.size ? `${AN.loading.size} sınav yükleniyor…` : ''; }

  function draw() {
    if (App.state.view !== 'analiz') return;
    if (anSyncOkul(schools)) { init(); return; }   // başka ekranda/üstteki pencerede okul değiştiyse analiz de ona geçer
    clear(top); clear(body); const cat = anCatalog(), sel = anSelected();
    const okulSel = h('select', { id: 'an-okul', onchange: e => { anSetOkul(e.target.value); init(); } }, schools.map(s => h('option', { value: s.okulKodu }, schoolLabel(s)))); okulSel.value = AN.okul;
    top.append(h('div', { class: 'card no-print' }, h('div', { class: 'row an-f', style: { marginBottom: '.6rem' } }, h('b', null, 'Okul'), schoolPicker(okulSel, schools), h('span', { id: 'an-status', class: 'small muted' })), examTable(cat)));
    if (!sel.length) { body.append(h('div', { class: 'empty card' }, AN.loading.size ? 'Sınavlar yükleniyor…' : 'Analiz için yukarıdan en az bir sınav seçin. Dışarıdan sınav eklemek için "+ Dış sınav ekle"yi kullanın.')); return; }
    const classes = anClasses(sel), lessons = anLessons(sel); if (AN.cls && !classes.includes(AN.cls)) AN.cls = '';
    const q = h('input', { type: 'search', id: 'an-q', placeholder: 'Ad, no ara…', value: AN.q, oninput: e => { AN.q = e.target.value; renderTab(); } });
    const cls = h('select', { id: 'an-cls', onchange: e => { AN.cls = e.target.value; renderTab(); } }, h('option', { value: '' }, 'Tüm sınıflar'), classes.map(c => h('option', { value: c }, c))); cls.value = AN.cls;
    const met = h('select', { id: 'an-metric', onchange: e => { AN.metric = e.target.value; renderTab(); } }, METRICS.map(([v, l]) => h('option', { value: v }, l))); met.value = AN.metric;
    const les = h('select', { id: 'an-lesson', onchange: e => { AN.lesson = e.target.value; renderTab(); } }, h('option', { value: '' }, 'Tüm dersler (toplam)'), lessons.map(l => h('option', { value: l }, l))); les.value = AN.lesson;
    const tabLabel = id => AN_LABEL[id] || (ANTABS.find(t => t.id === id) || {}).label;
    if (!AN_ORDER.some(id => id === AN.tab && tabLabel(id))) AN.tab = 'list';
    const tabBtn = id => h('button', { id: 'an-tab-' + id, class: AN.tab === id ? 'active' : '', onclick: () => { AN.tab = id; if (AN_AUTOALL.includes(id) && !AN.autoAll[AN.okul]) { AN.autoAll[AN.okul] = true; if (!anCatalog().every(e => AN.sel.has(e.id))) { selectAll(); return; } } draw(); } }, tabLabel(id));
    const tb = h('div', { class: 'tabs an-tabs no-print' }, AN_GROUPS.map(([g, ids], gi) => { const live = ids.filter(tabLabel); return live.length ? h('span', { class: 'tab-grp' + (gi ? ' sep' : ''), 'data-grp': g }, h('span', { class: 'tab-cap' }, g), live.map(tabBtn)) : null; }));
    const rt = ANTABS.find(t => t.id === AN.tab), fl = rt ? (rt.filters || []) : (AN.tab === 'list' ? ['q', 'cls'] : ['q', 'cls', 'metric', 'lesson']);
    const filt = h('div', { class: 'row an-f no-print', style: { marginBottom: '.7rem' } }, fl.includes('q') ? q : null, fl.includes('cls') ? cls : null, fl.includes('metric') ? [h('span', { class: 'small muted' }, 'Ölçüt:'), met] : null, fl.includes('lesson') ? les : null, h('span', { class: 'grow' }), (!rt || rt.export) ? h('button', { class: 'btn', id: 'an-xlsx', onclick: () => exportXlsx() }, '⬇ Excel') : null, h('button', { class: 'btn', id: 'an-print', title: 'Yazdırma penceresini açar; hedef olarak "PDF olarak kaydet" seçilebilir', onclick: () => anPrint() }, 'Yazdır / PDF'));
    const pane = h('div', { id: 'an-pane' }); body.append(tb, filt, pane); renderTab();
  }
  function renderTab() { const pane = $('#an-pane'); if (!pane) return; clear(pane); const sel = anSelected(); if (!sel.length) return; const rt = ANTABS.find(t => t.id === AN.tab); if (rt) rt.render(pane, sel, ctx); else ({ list: tabList, dev: tabDev, cmp: tabCmp })[AN.tab](pane, sel); drawStatus(); }

  /* ---- sınav seçim tablosu */
  function examTable(cat) {
    if (!cat.length) return h('div', { class: 'muted' }, 'Bu okul için sınav yok.');
    const rowsEl = cat.map(en => {
      const n = AN.data.get(en.id), mine = n ? anRows(n) : null, avgNet = mine && mine.length ? mine.reduce((a, r) => a + (r.net || 0), 0) / mine.length : null, pv = mine ? mine.filter(r => r.puan != null) : [], avgP = pv.length ? pv.reduce((a, r) => a + r.puan, 0) / pv.length : null;
      return h('tr', null, h('td', null, h('input', { type: 'checkbox', class: 'an-ck', 'data-id': en.id, 'aria-label': en.name + ' seç', checked: AN.sel.has(en.id), style: { width: 'auto', minHeight: 0 }, onchange: e => { e.target.checked ? AN.sel.add(en.id) : AN.sel.delete(en.id); if (e.target.checked) { drawStatus(); loadSelected(); } draw(); } })),
        h('td', { class: 'nowrap' }, anFmtDate(en.date)), h('td', null, en.name), h('td', null, badge(en)), h('td', { class: 'num' }, n ? n.totalQ : ''),
        h('td', { class: 'num' }, AN.loading.has(en.id) ? '…' : (n ? (mine.length || h('span', { class: 'muted', title: 'Bu okuldan katılım yok' }, '0')) : '')), h('td', { class: 'num' }, nf(avgNet)), h('td', { class: 'num' }, nf(avgP)),
        h('td', { class: 'nowrap' }, en.ext && en.raw.canEdit ? [h('button', { class: 'btn ghost sm an-edit', 'data-id': en.id, onclick: () => Dis.editor({ exam: en.raw, onSaved: id => { AN.data.delete(id); loadSelected(); draw(); } }) }, 'Düzenle'), h('button', { class: 'btn ghost sm an-del', 'data-id': en.id, onclick: () => Dis.remove(en.raw, () => { AN.sel.delete(en.id); AN.data.delete(en.id); draw(); }) }, 'Sil')] : null));
    });
    return h('div', null, h('div', { class: 'row', style: { marginBottom: '.4rem' } }, h('b', null, 'Sınavlar'), h('span', { class: 'small muted' }, 'İşaretlediğiniz sınavlar analize girer (sistem + dış).'), h('span', { class: 'grow' }),
      h('button', { class: 'btn sm', id: 'an-all', onclick: () => { cat.forEach(e => AN.sel.add(e.id)); draw(); loadSelected(); } }, 'Hepsini seç'), h('button', { class: 'btn sm', onclick: () => { AN.sel.clear(); draw(); } }, 'Temizle'), h('button', { class: 'btn sm', onclick: () => { AN.sel.clear(); cat.slice(-4).forEach(e => AN.sel.add(e.id)); draw(); loadSelected(); } }, 'Son 4')),
      h('div', { class: 'tablewrap', style: { maxHeight: '30vh' } }, h('table', null, h('thead', null, h('tr', null, ['', 'Tarih', 'Sınav', 'Kaynak', 'Soru', 'Öğrenci', 'Ort. net', 'Ort. puan', ''].map(x => h('th', null, x)))), h('tbody', null, rowsEl))));
  }

  /* ---- 1) Sınav listesi (PDF biçimi) */
  function tabList(pane, sel) {
    if (!AN.examId || !sel.find(n => n.id === AN.examId)) AN.examId = sel[sel.length - 1].id;
    const n = sel.find(x => x.id === AN.examId), exSel = h('select', { id: 'an-exam', onchange: e => { AN.examId = e.target.value; renderTab(); } }, sel.map(x => h('option', { value: x.id }, `${anFmtDate(x.date)} · ${x.name}`))); exSel.value = AN.examId;
    const all = anRows(n); DisCore.localRanks(all); let rows = anFilter(all), L = n.lessons;
    const key = AN.sort.key, dir = AN.sort.dir, gv = r => key === 'no' ? (/^\d+$/.test(r.no) ? +r.no : r.no) : key === 'ad' ? r.ad : key === 'sinif' ? r.sinif : key === 'net' ? r.net : key === 'sira' ? r.lOkul : (r.puan != null ? r.puan : r.net);
    rows = rows.slice().sort((a, b) => { const x = gv(a), y = gv(b); if (x == null && y == null) return 0; if (x == null) return 1; if (y == null) return -1; return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'tr', { numeric: true })) * dir; });
    const avgG = n.avg || anAvgOf(n.ext ? all : n.rows, L.length), avgO = n.avgOkul || anAvgOf(all, L.length);
    const sortTh = (label, k, cs) => h('th', { rowspan: cs ? 1 : 2, colspan: cs || 1, class: 'sortable center', title: 'Sırala', onclick: () => { AN.sort.dir = AN.sort.key === k ? -AN.sort.dir : (k === 'ad' || k === 'no' || k === 'sinif' || k === 'sira' ? 1 : -1); AN.sort.key = k; renderTab(); } }, label + (AN.sort.key === k ? (AN.sort.dir > 0 ? ' ▲' : ' ▼') : ''));
    const th = (t, o) => h('th', Object.assign({ class: 'center' }, o || {}), t);
    const thead = h('thead', null,
      h('tr', null, sortTh('Sıra', 'sira'), sortTh('Ö.No', 'no'), sortTh('İsim', 'ad'), sortTh('Sınıf', 'sinif'), L.map(l => th(`${l.name} (${l.count || '?'})`, { colspan: 3, class: 'center an-gl' })), th('Toplam', { colspan: 3, class: 'center an-gl' }), sortTh(n.puanAdi || 'Puan', 'puan'), th('Dereceler', { colspan: 5, class: 'center an-gl' }), th('%', { rowspan: 2 })),
      h('tr', null, L.map(() => ['D', 'Y', 'N'].map((x, i) => th(x, i === 0 ? { class: 'center an-gl' } : null))), ['D', 'Y', 'N'].map((x, i) => th(x, i === 0 ? { class: 'center an-gl' } : null)), ['Snf', 'Okul', 'İlçe', 'İl', 'Genel'].map((x, i) => th(x, i === 0 ? { class: 'center an-gl' } : null))));
    const cell = (v, d) => h('td', { class: 'num' }, v == null ? '' : nf(v, d == null ? 2 : d));
    const avgRow = (label, a, cls) => h('tr', { class: 'an-avg ' + cls }, h('td'), h('td'), h('td', { colspan: 2 }, label), L.map((l, i) => [cell(a.sec[i] && a.sec[i][0], 0), cell(a.sec[i] && a.sec[i][1], 0), cell(a.sec[i] && a.sec[i][3])]), cell(a.D, 0), cell(a.Y, 0), cell(a.net), cell(a.puan), h('td', { colspan: 6 }));
    const rk = (r, k, lk) => r.rk[k] != null ? h('td', { class: 'num' }, r.rk[k]) : (lk && r[lk] != null ? h('td', { class: 'num an-calc', title: 'Sistemde hesaplandı' }, r[lk]) : h('td'));
    const tbody = h('tbody', null, avgRow('Genel Ortalama' + (n.avg ? '' : (n.ext ? ' (hesaplanan)' : ' (yetki alanı)')), avgG, 'g'), avgRow('Okul Ortalaması' + (n.avgOkul ? '' : ' (hesaplanan)'), avgO, 'o'),
      rows.slice(0, 500).map(r => h('tr', { class: 'an-row', onclick: () => openStudent(r.no) }, h('td', { class: 'num' }, r.lOkul != null ? r.lOkul : ''), h('td', null, r.no), h('td', null, r.ad || h('span', { class: 'muted' }, '(adı yok)')), h('td', null, r.sinif),
        L.map((l, i) => [cell(r.sec[i][0], 0), cell(r.sec[i][1], 0), cell(r.sec[i][3])]), cell(r.D, 0), cell(r.Y, 0), h('td', { class: 'num' }, h('b', null, nf(r.net))), h('td', { class: 'num' }, r.puan == null ? '' : h('b', null, nf(r.puan, 3))),
        rk(r, 'snf', 'lSnf'), rk(r, 'okul', 'lOkul'), rk(r, 'ilce'), rk(r, 'il'), rk(r, 'genel'), r.rk.pct != null ? cell(r.rk.pct) : h('td'))));
    const tot = all.length, pctAvg = n.totalQ && avgO.net != null ? avgO.net / n.totalQ * 100 : null;
    pane.append(h('div', { class: 'row an-f no-print', style: { marginBottom: '.7rem' } }, exSel, badge(n), h('span', { class: 'small muted' }, `${rows.length}/${tot} öğrenci`), pctAvg != null ? h('span', { class: 'small muted' }, `okul ort. başarı %${nf(pctAvg, 1)}`) : null),
      h('div', { class: 'stats' }, [['öğrenci', tot], ['ort. net', nf(avgO.net)], ['ort. ' + (n.puanAdi || 'puan').toLocaleLowerCase('tr'), nf(avgO.puan)], ['en yüksek net', nf(Math.max(...all.map(r => r.net == null ? -1e9 : r.net)))]].map(([l, v]) => h('div', { class: 'stat' }, h('b', null, v), h('span', null, l)))),
      h('div', { class: 'tablewrap an-list', style: { marginTop: '.7rem' } }, h('table', { class: 'an-table' }, thead, tbody)),
      rows.length > 500 ? h('div', { class: 'small muted' }, 'İlk 500 satır gösteriliyor; hepsi için Excel indirin.') : null,
      h('p', { class: 'small muted' }, 'Eğik/soluk dereceler dosyada olmadığı için sistemde hesaplanmıştır (okul/sınıf içinde, ' + (n.puanAdi || 'puan') + 'a göre). Öğrenciye tıklayınca gelişimi açılır.'));
  }

  /* ---- 2) Gelişim */
  function devData(sel) {
    const m = new Map();
    sel.forEach((n, ni) => anRows(n).forEach(r => { const o = m.get(r.no) || { no: r.no, ad: '', sinif: '', vals: sel.map(() => null), rows: sel.map(() => null) }; if (r.ad) o.ad = r.ad; if (r.sinif) o.sinif = r.sinif; o.vals[ni] = anVal(r, n, AN.metric, AN.lesson); o.rows[ni] = r; m.set(r.no, o); }));
    return Array.from(m.values()).map(o => {
      const v = o.vals.map((x, i) => x == null ? null : { i, x }).filter(Boolean); o.first = v[0] ? v[0].x : null; o.last = v.length ? v[v.length - 1].x : null; o.k = v.length; o.chg = v.length > 1 ? o.last - o.first : null; o.step = v.length > 1 ? o.last - v[v.length - 2].x : null;
      o.deltas = o.vals.map((x, i) => { if (x == null) return null; const p = o.vals.slice(0, i).reverse().find(y => y != null); return p == null ? null : x - p; }); return o;
    });
  }
  function tabDev(pane, sel) {
    if (sel.length < 2) pane.append(h('div', { class: 'alert info' }, 'Net artışını görmek için en az iki sınav işaretleyin.'));
    sel = sel.slice().sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'));
    const tq = Array.from(new Set(sel.map(n => n.totalQ))); if (AN.metric === 'net' && !AN.lesson && tq.length > 1) pane.append(h('div', { class: 'alert warn' }, `Sınavların soru sayıları farklı (${tq.join(', ')}); net doğrudan kıyaslanamaz. "Başarı %" ya da "Puan" ölçütünü deneyin.`));
    if (AN.metric === 'puan' && AN.lesson) pane.append(h('div', { class: 'alert info' }, 'Ders bazında puan hesaplanmadığı için ders seçiliyken net gösterilir.'));
    const metric = (AN.metric === 'puan' && AN.lesson) ? 'net' : AN.metric;
    const old = AN.metric; AN.metric = metric; let data = anFilter(devData(sel).map(o => o)); AN.metric = old;
    const multi = data.filter(o => o.k > 1), up = multi.filter(o => o.chg > 0.005).length, down = multi.filter(o => o.chg < -0.005).length, avgChg = multi.length ? multi.reduce((a, o) => a + o.chg, 0) / multi.length : null;
    const best = multi.slice().sort((a, b) => b.chg - a.chg)[0];
    pane.append(h('div', { class: 'stats' }, [[data.length, 'öğrenci'], [multi.length, 'birden çok sınava girdi'], [up, 'artış'], [down, 'düşüş'], [avgChg == null ? '' : (avgChg > 0 ? '+' : '') + anFmt(avgChg, metric).replace('%', ''), 'ort. değişim (ilk→son)'], [best && best.chg > 0 ? `${best.ad || best.no} (+${anFmt(best.chg, metric).replace('%', '')})` : '', 'en çok artan']].map(([v, l]) => h('div', { class: 'stat' }, h('b', null, v), h('span', null, l)))));
    const k = AN.dsort.key, dir = AN.dsort.dir, gv = o => k === 'no' ? (/^\d+$/.test(o.no) ? +o.no : o.no) : k === 'ad' ? o.ad : k === 'sinif' ? o.sinif : k === 'step' ? o.step : k === 'chg' ? o.chg : o.last;
    data = data.slice().sort((a, b) => { const x = gv(a), y = gv(b); if (x == null && y == null) return 0; if (x == null) return 1; if (y == null) return -1; return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'tr', { numeric: true })) * dir; });
    const sh = (label, key, cls) => h('th', { class: 'sortable ' + (cls || ''), title: 'Sırala', onclick: () => { AN.dsort.dir = AN.dsort.key === key ? -AN.dsort.dir : (key === 'ad' || key === 'no' || key === 'sinif' ? 1 : -1); AN.dsort.key = key; renderTab(); } }, label + (AN.dsort.key === key ? (AN.dsort.dir > 0 ? ' ▲' : ' ▼') : ''));
    const thead = h('thead', null, h('tr', null, sh('Ö.No', 'no'), sh('İsim', 'ad'), sh('Sınıf', 'sinif'), sel.map(n => h('th', { class: 'center', title: `${n.name} · ${n.kaynak}` }, h('div', null, n.name.length > 18 ? n.name.slice(0, 17) + '…' : n.name), h('div', { class: 'small', style: { fontWeight: 400 } }, anFmtDate(n.date) + (n.ext ? ' · dış' : '')))), sh('Son değişim', 'step', 'center'), sh('İlk → son', 'chg', 'center'), h('th', { class: 'center' }, 'Gidiş')));
    const tbody = h('tbody', null, data.slice(0, 600).map(o => h('tr', { class: 'an-row', onclick: () => openStudent(o.no) }, h('td', null, o.no), h('td', null, o.ad || h('span', { class: 'muted' }, '(adı yok)')), h('td', null, o.sinif),
      o.vals.map((v, i) => h('td', { class: 'num' }, v == null ? h('span', { class: 'muted' }, '–') : [h('div', null, anFmt(v, metric)), anDelta(o.deltas[i], metric)])),
      h('td', { class: 'num' }, anDelta(o.step, metric)), h('td', { class: 'num' }, anDelta(o.chg, metric)), h('td', { class: 'center' }, anSpark(o.vals)))));
    pane.append(h('div', { class: 'tablewrap an-list', style: { marginTop: '.7rem' } }, h('table', { class: 'an-table', id: 'an-dev' }, thead, tbody)), data.length > 600 ? h('div', { class: 'small muted' }, 'İlk 600 satır gösteriliyor; hepsi için Excel indirin.') : null,
      h('p', { class: 'small muted' }, `Ölçüt: ${(METRICS.find(m => m[0] === metric) || [])[1]}${AN.lesson ? ' · ' + AN.lesson : ' · toplam'}. ▲/▼ değerleri öğrencinin bir önceki girdiği sınava göre değişimdir; "İlk → son" seçili sınavların ilkiyle sonuncusu arasındaki farktır. Sınavlar tarihe göre sıralanır.`));
  }

  /* ---- 3) Karşılaştırma */
  function tabCmp(pane, sel) {
    sel = sel.slice().sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'));
    const L = anLessons(sel), metric = AN.metric, lesson = AN.lesson;
    const stat = (n, rows) => { const vals = rows.map(r => anVal(r, n, metric, lesson)).filter(v => v != null); return { n: rows.length, avg: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null, max: vals.length ? Math.max(...vals) : null, min: vals.length ? Math.min(...vals) : null }; };
    const per = sel.map(n => { const all = anRows(n), mine = anFilter(all), a = anAvgOf(mine, n.lessons.length); return { n, st: stat(n, mine), stAll: stat(n, all), a, rows: mine }; });
    let prev = null; per.forEach(p => { p.d = prev && p.st.avg != null && prev.st.avg != null ? p.st.avg - prev.st.avg : null; p.dn = prev && p.a.net != null && prev.a.net != null ? p.a.net - prev.a.net : null; p.dp = prev && p.a.puan != null && prev.a.puan != null ? p.a.puan - prev.a.puan : null; prev = p; });
    const titleF = (AN.cls ? AN.cls + ' sınıfı' : 'Okul') + ' · ' + (METRICS.find(m => m[0] === metric) || [])[1] + (lesson ? ' · ' + lesson : '');
    const series = [{ name: 'Okul ortalaması', pts: per.map(p => ({ y: p.stAll.avg })) }]; if (AN.cls) series.push({ name: AN.cls + ' sınıfı', pts: per.map(p => ({ y: p.st.avg })) });
    pane.append(h('div', { class: 'card' }, h('h2', null, 'Sınavlara göre ortalama · ' + titleF), anChart(per.map(p => `${anFmtDate(p.n.date).slice(0, 5)} ${p.n.name}`), series, { pct: metric === 'pct', label: titleF })));
    pane.append(h('div', { class: 'card' }, h('h2', null, 'Sınav özeti'), h('div', { class: 'tablewrap' }, h('table', { class: 'an-table', id: 'an-cmp' }, h('thead', null, h('tr', null, ['Tarih', 'Sınav', 'Kaynak', 'Katılım', 'Ort. D', 'Ort. Y', 'Ort. net', 'Δ net', 'Ort. puan', 'Δ puan', 'Başarı %', 'En yüksek', 'En düşük'].map(x => h('th', { class: /^(Tarih|Sınav|Kaynak)$/.test(x) ? '' : 'num' }, x)))),
      h('tbody', null, per.map(p => h('tr', null, h('td', { class: 'nowrap' }, anFmtDate(p.n.date)), h('td', null, p.n.name), h('td', null, badge({ ext: p.n.ext, kaynak: p.n.kaynak })), h('td', { class: 'num' }, p.rows.length), h('td', { class: 'num' }, nf(p.a.D, 1)), h('td', { class: 'num' }, nf(p.a.Y, 1)), h('td', { class: 'num' }, h('b', null, nf(p.a.net))), h('td', { class: 'num' }, anDelta(p.dn, 'net')), h('td', { class: 'num' }, nf(p.a.puan)), h('td', { class: 'num' }, anDelta(p.dp, 'puan')),
        h('td', { class: 'num' }, p.n.totalQ && p.a.net != null ? nf(p.a.net / p.n.totalQ * 100, 1) + '%' : ''), h('td', { class: 'num' }, anFmt(p.st.max, metric)), h('td', { class: 'num' }, anFmt(p.st.min, metric)))))))));
    const lessonCell = (p, pi, l) => {
      const li = p.n.lessons.findIndex(x => anNk(x.name) === anNk(l)), v = li < 0 ? null : (p.a.sec[li] || [])[3]; let pv = null;
      for (let j = pi - 1; j >= 0 && pv == null; j--) { const lj = per[j].n.lessons.findIndex(x => anNk(x.name) === anNk(l)); if (lj >= 0) pv = (per[j].a.sec[lj] || [])[3]; }
      return h('td', { class: 'num' }, v == null ? h('span', { class: 'muted' }, '–') : [h('div', null, nf(v)), anDelta(pv == null ? null : v - pv, 'net')]);
    };
    const lessonRows = per.map((p, pi) => h('tr', null, h('td', null, `${anFmtDate(p.n.date).slice(0, 5)} · ${p.n.name}`), L.map(l => lessonCell(p, pi, l))));
    pane.append(h('div', { class: 'card' }, h('h2', null, 'Ders bazlı ortalama net'),
      h('div', { class: 'tablewrap' }, h('table', { class: 'an-table', id: 'an-lesson-tbl' }, h('thead', null, h('tr', null, h('th', null, 'Sınav'), L.map(l => h('th', { class: 'num' }, l)))), h('tbody', null, lessonRows))),
      h('p', { class: 'small muted' }, 'Aynı adlı dersler sınavlar arasında eşleştirilir; soru sayıları farklıysa netleri dikkatle kıyaslayın.')));
    const clsList = anClasses(sel);
    if (clsList.length > 1) pane.append(h('div', { class: 'card' }, h('h2', null, 'Sınıflara göre ortalama · ' + (METRICS.find(m => m[0] === metric) || [])[1] + (lesson ? ' · ' + lesson : '')), h('div', { class: 'tablewrap' }, h('table', { class: 'an-table', id: 'an-cls-tbl' }, h('thead', null, h('tr', null, h('th', null, 'Sınıf'), sel.map(n => h('th', { class: 'num' }, `${anFmtDate(n.date).slice(0, 5)} ${n.name.length > 14 ? n.name.slice(0, 13) + '…' : n.name}`)), h('th', { class: 'num' }, 'İlk → son'))),
      h('tbody', null, clsList.map(c => { const vs = sel.map(n => { const rs = anRows(n).filter(r => r.sinif === c).map(r => anVal(r, n, metric, lesson)).filter(v => v != null); return rs.length ? rs.reduce((a, b) => a + b, 0) / rs.length : null; }); const nn = vs.filter(v => v != null); return h('tr', null, h('td', null, c), vs.map((v, i) => { const p = vs.slice(0, i).reverse().find(x => x != null); return h('td', { class: 'num' }, v == null ? h('span', { class: 'muted' }, '–') : [h('div', null, anFmt(v, metric)), anDelta(p == null ? null : v - p, metric)]); }), h('td', { class: 'num' }, nn.length > 1 ? anDelta(nn[nn.length - 1] - nn[0], metric) : '')); }))))));
  }

  /* ---- Excel dışa aktarma */
  function exportXlsx() {
    const sel = anSelected(); if (!sel.length) return toast('Önce sınav seçin', 'warn');
    const rt = ANTABS.find(t => t.id === AN.tab); if (rt) return rt.export ? rt.export(sel, ctx) : toast('Bu sekme için Excel yok', 'warn');
    const school = schoolByCode(AN.okul), fn = s => String(s).replace(/[^\wığüşöçİĞÜŞÖÇ -]/g, '_').slice(0, 40);
    if (AN.tab === 'list') {
      const n = sel.find(x => x.id === AN.examId) || sel[sel.length - 1], all = anRows(n); DisCore.localRanks(all); const rows = anFilter(all).sort((a, b) => (b.puan != null ? b.puan : b.net) - (a.puan != null ? a.puan : a.net)), L = n.lessons;
      const sh = DisCore.buildTemplate({ lessons: L, puanAdi: n.puanAdi, penalty: n.penalty, examName: n.name, date: n.date, kaynak: n.kaynak, choices: 4 }); const sonuc = sh.find(s => s.name === 'Sonuçlar');
      const mk = (label, a) => [null, null, { v: label, s: 'avg' }, { v: null, s: 'avg' }, ...L.flatMap((l, i) => [a.sec[i] ? a.sec[i][0] : null, a.sec[i] ? a.sec[i][1] : null, a.sec[i] ? a.sec[i][3] : null].map(v => ({ v: v == null ? null : DisCore.r2(v), s: 'avgn' }))), ...[a.D, a.Y, a.net, a.puan].map(v => ({ v: v == null ? null : DisCore.r2(v), s: 'avgn' }))];
      const body = [mk('Genel Ortalama', n.avg || anAvgOf(all, L.length)), mk('Okul Ortalaması', n.avgOkul || anAvgOf(all, L.length))];
      rows.forEach((r, i) => body.push([i + 1, r.no, r.ad, r.sinif, ...L.flatMap((l, li) => [r.sec[li][0], r.sec[li][1], r.sec[li][3]]), r.D, r.Y, r.net, r.puan, r.rk.snf != null ? r.rk.snf : r.lSnf, r.rk.okul != null ? r.rk.okul : r.lOkul, r.rk.ilce, r.rk.il, r.rk.genel, r.rk.pct]));
      sonuc.rows = sonuc.rows.slice(0, 2).concat(body); const ordered = [sonuc, sh.find(s => s.name === 'Sınav Bilgisi'), sh.find(s => s.name === 'Dersler')];
      download(`${fn(n.name)}-sonuc-listesi.xlsx`, XlsxLite.write(ordered), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); toast('Excel indirildi (şablonla aynı düzende; tekrar yüklenebilir)', 'ok'); return;
    }
    const ord = sel.slice().sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999')), metric = AN.metric, lessonName = AN.lesson, mname = (METRICS.find(m => m[0] === metric) || [])[1] + (lessonName ? ' · ' + lessonName : '');
    if (AN.tab === 'dev') {
      const d = anFilter(devData(ord)).sort((a, b) => String(a.sinif).localeCompare(String(b.sinif), 'tr', { numeric: true }) || String(a.ad).localeCompare(String(b.ad), 'tr'));
      const head = ['Ö.No', 'İsim', 'Sınıf', ...ord.flatMap(n => [`${n.name} (${anFmtDate(n.date)}${n.ext ? ' · dış: ' + n.kaynak : ''})`, 'Δ']), 'Son değişim', 'İlk → son'].map(x => ({ v: x, s: 'h' }));
      const rows = [head].concat(d.map(o => [o.no, o.ad, o.sinif, ...o.vals.flatMap((v, i) => [v == null ? null : { v: DisCore.r2(v), s: 'n2' }, o.deltas[i] == null ? null : { v: DisCore.r2(o.deltas[i]), s: 'n2' }]), o.step == null ? null : { v: DisCore.r2(o.step), s: 'n2' }, o.chg == null ? null : { v: DisCore.r2(o.chg), s: 'n2' }]));
      download(`gelisim-${fn(mname)}.xlsx`, XlsxLite.write([{ name: 'Gelişim', rows, widths: [10, 28, 8, ...ord.flatMap(() => [24, 8]), 12, 12], freeze: { row: 1, col: 3 } }, { name: 'Bilgi', rows: [[{ v: 'Ölçüt', s: 'b' }, mname], [{ v: 'Okul', s: 'b' }, school ? school.okulAdi : ''], [{ v: 'Δ', s: 'b' }, 'Bir önceki girilen sınava göre değişim'], [{ v: 'Oluşturma', s: 'b' }, new Date().toLocaleString('tr-TR')]], widths: [14, 60] }]), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); toast('Excel indirildi', 'ok'); return;
    }
    const per = ord.map(n => { const rows = anFilter(anRows(n)), a = anAvgOf(rows, n.lessons.length); return [anFmtDate(n.date), n.name, n.ext ? 'Dış · ' + n.kaynak : 'Sistem', rows.length, a.D, a.Y, a.net, a.puan, n.totalQ && a.net != null ? a.net / n.totalQ * 100 : null]; });
    const rows = [['Tarih', 'Sınav', 'Kaynak', 'Katılım', 'Ort. D', 'Ort. Y', 'Ort. net', 'Ort. puan', 'Başarı %'].map(x => ({ v: x, s: 'h' }))].concat(per.map(r => r.map((v, i) => i >= 4 && v != null ? { v: DisCore.r2(v), s: 'n2' } : v)));
    download('sinav-karsilastirma.xlsx', XlsxLite.write([{ name: 'Karşılaştırma', rows, widths: [12, 34, 22, 9, 8, 8, 9, 10, 10], freeze: { row: 1 } }]), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); toast('Excel indirildi', 'ok');
  }
  App.cleanup = () => { };
  init();
};
