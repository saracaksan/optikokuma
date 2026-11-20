/* analiz-sinif.js — Sınıf ve Ders sekmeleri + ortak öğrenci özetleri (snStudents), tablo yardımcıları.
 * Sınıf: sınıf (ya da tüm okul) için sınav sınav gelişim, katılım, ders başarısı, sınıf karşılaştırması, dağılım, öğrenci sıralaması.
 * Ders: ders × sınıf ısı haritası, ders gelişimi, D/Y/B, dağılım, ilk ve son 10 öğrenci.
 * ogMean/ogPct/… yardımcıları analiz-ogr.js'tedir; sekmeler ANTABS kayıt defterine eklenir. */
'use strict';

AN.snMetric = 'pct'; AN.snSort = { key: 'avg', dir: -1 }; AN.dersSel = '';
let snLast = null, drLast = null;

/* ---------------------------------------------------------------- ortak yardımcılar */
const SN_BANDS = ['0–20', '20–40', '40–60', '60–80', '80–100'];
const snBand = v => Math.max(0, Math.min(4, Math.floor(v / 20)));
const snRowsOf = (n, sinif) => anRows(n).filter(r => !sinif || r.sinif === sinif);
/** Puan türleri karıştırılmaz: en çok kullanılan (eşitse en yeni) tür esas alınır. */
function snScale(exams) {
  const by = new Map(); exams.forEach((n, i) => { if (anRows(n).some(r => r.puan != null)) { const k = n.puanAdi || 'Puan', e = by.get(k) || { name: k, ids: new Set(), last: -1 }; e.ids.add(n.id); e.last = i; by.set(k, e); } });
  const all = Array.from(by.values()).sort((a, b) => b.ids.size - a.ids.size || b.last - a.last), d = all[0];
  return { name: d ? d.name : 'Puan', ids: d ? d.ids : new Set(), mixed: all.length > 1, names: all.map(e => e.name) };
}
const snVal = (r, n, metric, sc) => (metric === 'pct' ? ogPct(r.net, n.totalQ) : metric === 'net' ? r.net : (sc.ids.has(n.id) ? r.puan : null));
const snGV = (n, sinif, metric, sc) => ogMean(snRowsOf(n, sinif).map(r => snVal(r, n, metric, sc)));
/** Bir dersin başarı yüzdesi ortalaması (sınav n, sınıf sinif ya da '' = okul). */
function snLV(n, sinif, nk) { const li = ogLi(n, nk); if (li < 0) return null; const c = n.lessons[li].count; return c ? ogMean(snRowsOf(n, sinif).map(r => (r.sec[li] && r.sec[li][3] != null ? r.sec[li][3] / c * 100 : null))) : null; }
function snLD(n, sinif, nk) { const li = ogLi(n, nk); if (li < 0) return null; const rows = snRowsOf(n, sinif).filter(r => r.sec[li] && r.sec[li][3] != null); return { count: n.lessons[li].count, k: rows.length, D: ogMean(rows.map(r => r.sec[li][0])), Y: ogMean(rows.map(r => r.sec[li][1])), B: ogMean(rows.map(r => r.sec[li][2])), net: ogMean(rows.map(r => r.sec[li][3])) }; }
const snPresent = exams => Array.from(ogLessonMap().values()).filter(x => exams.some(n => ogLi(n, x.nk) >= 0));
const snFirstIdx = a => a.findIndex(v => v != null), snLastIdx = a => { for (let i = a.length - 1; i >= 0; i--) if (a[i] != null) return i; return -1; };
const snPrevIdx = (a, i) => { for (let k = i - 1; k >= 0; k--) if (a[k] != null) return k; return -1; };

/** Öğrenci özetleri: sınav sınav başarı %, net, puan, ders ortalamaları, eğilim. Hiç sınava girmeyen kayıtlı öğrenciler took = 0 ile gelir. */
function snStudents(exams, roster) {
  const map = new Map(), sc = snScale(exams), blank = () => exams.map(() => null);
  const mk = (no, info) => ({ no, ad: info.ad || '', sinif: info.sinif || '', pct: blank(), net: blank(), puan: blank(), lp: new Map(), took: 0 });
  exams.forEach((n, ei) => anRows(n).forEach(r => {
    let s = map.get(r.no); if (!s) { s = mk(r.no, roster.get(r.no) || {}); map.set(r.no, s); }
    if (r.ad) s.ad = r.ad; if (r.sinif) s.sinif = r.sinif;
    s.pct[ei] = ogPct(r.net, n.totalQ); s.net[ei] = r.net; s.puan[ei] = sc.ids.has(n.id) ? r.puan : null; s.took++;
    n.lessons.forEach((l, i) => { const k = anNk(l.name), v = r.sec[i] && l.count && r.sec[i][3] != null ? r.sec[i][3] / l.count * 100 : null; let a = s.lp.get(k); if (!a) { a = blank(); s.lp.set(k, a); } a[ei] = v; });
  }));
  roster.forEach((info, no) => { if (!map.has(no)) map.set(no, mk(no, info)); });
  const out = Array.from(map.values());
  out.forEach(s => {
    const v = s.pct.filter(x => x != null); s.avg = ogMean(s.pct); s.avgNet = ogMean(s.net); s.avgPuan = ogMean(s.puan);
    s.first = v.length ? v[0] : null; s.last = v.length ? v[v.length - 1] : null; s.prev = v.length > 1 ? v[v.length - 2] : null; s.dLast = s.last != null && s.prev != null ? s.last - s.prev : null;
    s.slope = ogSlope(s.pct); s.gain = v.length > 1 ? v[v.length - 1] - v[0] : null; s.max = v.length ? Math.max(...v) : null; s.min = v.length ? Math.min(...v) : null;
    s.lavg = new Map(); s.lp.forEach((a, k) => s.lavg.set(k, ogMean(a)));
  });
  return out;
}
/** Sıra numarası verir (eşit değere aynı sıra); değeri olmayanlar sıralanmaz. Sıralı listeyi döner. */
function snRank(list, key, field) {
  field = field || 'rank'; const f = s => (s[key] == null ? null : Math.round(s[key] * 1e4)), v = list.filter(s => f(s) != null).sort((a, b) => f(b) - f(a)); let r = 0, prev = null;
  v.forEach((s, i) => { if (f(s) !== prev) { r = i + 1; prev = f(s); } s[field] = r; }); list.filter(s => f(s) == null).forEach(s => { s[field] = null; }); return v;
}
const snGet = (s, k) => (k === 'no' ? s.no : k === 'ad' ? s.ad : k === 'sinif' ? s.sinif : k === 'took' ? s.took : k === 'avg' ? s.avg : k === 'net' ? s.avgNet : k === 'dLast' ? s.dLast : k === 'slope' ? s.slope : k === 'rank' ? s.rank : k[0] === 'e' && /^e\d+$/.test(k) ? s.pct[+k.slice(1)] : k.startsWith('l:') ? s.lavg.get(k.slice(2)) : null);
function snSort(list, st) {
  return list.slice().sort((a, b) => { const x = snGet(a, st.key), y = snGet(b, st.key); if (x == null && y == null) return 0; if (x == null) return 1; if (y == null) return -1; if (typeof x === 'string' || typeof y === 'string') return String(x).localeCompare(String(y), 'tr', { numeric: true }) * st.dir; return (x - y) * st.dir; });
}
/** Genel tablo: cols = [{label, num, sk, title, cell(row, i)}], o = { sort, onSort, onRow, limit, cls(row) } */
function snTable(id, cols, rows, o) {
  o = o || {}; const st = o.sort, lim = o.limit || 400;
  const th = cols.map(c => h('th', { class: (c.num ? 'num ' : '') + (c.sk ? 'sortable' : ''), title: c.title || (c.sk ? 'Sırala' : null), onclick: c.sk && o.onSort ? () => o.onSort(c.sk) : null }, c.label + (st && c.sk && st.key === c.sk ? (st.dir > 0 ? ' ▲' : ' ▼') : '')));
  const body = rows.slice(0, lim).map((r, i) => h('tr', { class: (o.onRow ? 'an-row ' : '') + (o.cls ? o.cls(r) : ''), 'data-no': r.no != null ? r.no : null, onclick: o.onRow ? () => o.onRow(r) : null }, cols.map(c => c.cell(r, i))));
  return h('div', null, h('div', { class: 'tablewrap an-list' }, h('table', { class: 'an-table', id }, h('thead', null, h('tr', null, th)), h('tbody', null, body))), rows.length > lim ? h('div', { class: 'small muted' }, `İlk ${lim} satır gösteriliyor; tamamı için Excel'e aktarın.`) : null);
}
const snHeat = (v, mid, span) => ({ background: AnViz.heat(v, mid, span || 25) });
const snCell = (v, mid, txt) => h('td', { class: 'num', style: snHeat(v, mid) }, v == null ? '' : (txt || ogP)(v));
const snStuCols = (o) => [
  { label: 'Sıra', num: true, sk: 'rank', cell: s => h('td', { class: 'num' }, s.rank == null ? '' : s.rank) },
  { label: 'Ö.No', sk: 'no', cell: s => h('td', { class: 'nowrap' }, s.no) },
  { label: 'Ad Soyad', sk: 'ad', cell: s => h('td', null, s.ad || '(adı yok)') },
  o.cls ? { label: 'Sınıf', sk: 'sinif', cell: s => h('td', null, s.sinif) } : null,
  { label: 'Sınav', num: true, sk: 'took', title: 'Girdiği sınav sayısı', cell: s => h('td', { class: 'num' }, `${s.took} / ${o.nEx}`) }].filter(Boolean);
const snBandsOf = (vals, byClass, classes) => {
  const cur = classes.slice(0, 8), cats = SN_BANDS.map((b, i) => ({ label: '%' + b, tip: 'Başarı %' + b, vals: byClass ? cur.map(() => 0) : [0] }));
  vals.forEach(([v, c]) => { if (v == null) return; const i = snBand(v); if (byClass) { const k = cur.indexOf(c); if (k >= 0) cats[i].vals[k]++; } else cats[i].vals[0]++; });
  return { cats, series: byClass ? cur.map((c, i) => ({ name: c, c: i + 1 })) : [{ name: 'Öğrenci sayısı', c: 1 }] };
};
const snNote = (pane, id, lines) => lines.length && pane.append(h('div', { class: 'card' }, h('h2', null, 'Değerlendirme'), h('ul', { class: 'og-notes', id }, lines.map(t => h('li', null, t)))));
const snPrintHead = (pane, title) => { const school = schoolByCode(AN.okul); pane.append(h('div', { class: 'print-only og-ph' }, h('b', null, title), ' · ', school ? school.okulAdi : '', ' · ', new Date().toLocaleDateString('tr-TR'))); };
const snArgMax = a => { let b = -1; a.forEach((v, i) => { if (v != null && (b < 0 || v > a[b])) b = i; }); return b; }, snArgMin = a => { let b = -1; a.forEach((v, i) => { if (v != null && (b < 0 || v < a[b])) b = i; }); return b; };
/** Sınıf serileri: sınıf seçiliyse [sınıf, okul], değilse her sınıf (en çok 8) + okul ortalaması */
const snGroupSeries = (exams, classes, cur, f) => (cur ? [{ name: cur, c: 1, pts: exams.map(n => f(n, cur)) }, { name: 'Okul ortalaması', c: 0, dash: true, pts: exams.map(n => f(n, '')) }]
  : classes.slice(0, 8).map((c, i) => ({ name: c, c: i + 1, pts: exams.map(n => f(n, c)) })).concat([{ name: 'Okul ortalaması', c: 0, dash: true, pts: exams.map(n => f(n, '')) }]));

/* ================================================================ SINIF sekmesi */
function snClassRender(pane, sel, ctx) {
  const exams = ogSorted(sel), roster = ogRoster(exams), classes = anClasses(exams), sc = snScale(exams), metric = AN.snMetric, MT = OG_MET[metric], nEx = exams.length;
  if (AN.cls && !classes.includes(AN.cls)) AN.cls = '';
  const cur = AN.cls, all = snStudents(exams, roster), grp = all.filter(s => !cur || s.sinif === cur), taken = grp.filter(s => s.took > 0), ranked = snRank(taken, 'avg');
  const L = ogLbl(exams), S = ogSub(exams), F = ogFull(exams), lm = snPresent(exams), rosterN = Array.from(roster.values()).filter(s => !cur || s.sinif === cur).length, name = cur ? cur + ' sınıfı' : 'Tüm okul';
  const clsSel = h('select', { id: 'sn-cls', onchange: e => { AN.cls = e.target.value; ctx.renderTab(); } }, h('option', { value: '' }, 'Tüm okul'), classes.map(c => h('option', { value: c }, c + ' sınıfı'))); clsSel.value = cur;
  pane.append(h('div', { class: 'card no-print' }, h('div', { class: 'row an-f' }, h('b', null, 'Sınıf'), clsSel, h('span', { class: 'small muted' }, 'Ölçüt'), ogSeg(Object.keys(OG_MET).map(k => [k, OG_MET[k].l]), metric, k => { AN.snMetric = k; ctx.renderTab(); }))));
  snPrintHead(pane, name + ' · sınav analiz raporu');
  // --- özet
  const gp = exams.map(n => snGV(n, cur, 'pct', sc)), op = exams.map(n => snGV(n, '', 'pct', sc)), li = snLastIdx(gp), pi = li >= 0 ? snPrevIdx(gp, li) : -1, bi = snArgMax(gp), slope = ogSlope(gp);
  const part = exams.map(n => (rosterN ? snRowsOf(n, cur).length / rosterN * 100 : null)), top = ranked[0];
  const dL = li >= 0 && pi >= 0 ? gp[li] - gp[pi] : null;
  pane.append(h('div', { class: 'card og-head', id: 'sn-head' }, h('div', { class: 'row between' }, h('div', null, h('h2', { style: { marginBottom: '.1rem' } }, name), h('div', { class: 'small muted' }, `${nEx} sınav · ${rosterN} kayıtlı öğrenci`)), h('span', { class: 'pill ' + (taken.length === rosterN ? 'ok' : 'warn') }, `${taken.length} öğrenci sınava girdi`)),
    h('div', { class: 'stats', style: { marginTop: '.7rem' } }, ogStat(ogP(ogMean(gp)), 'ort. başarı', cur ? 'okul ' + ogP(ogMean(op)) : ''), ogStat(li >= 0 ? ogP(gp[li]) : '', 'son sınav ort. başarı', dL != null ? `${dL > 0 ? '▲' : dL < 0 ? '▼' : '＝'} ${ogSgn(dL, 1, ' puan')} önceki sınava göre` : ''),
      ogStat(slope != null ? ogSgn(slope, 1, ' puan') : '', 'sınav başına değişim', ogTrendWord(slope)), ogStat(bi >= 0 ? ogP(gp[bi]) : '', 'en iyi sınav', bi >= 0 ? exams[bi].name : ''), ogStat(ogMean(part) != null ? '%' + nf(ogMean(part), 0) : '', 'ort. katılım'), ogStat(top ? top.ad : '', 'ortalamada birinci', top ? ogP(top.avg) + (cur ? '' : ' · ' + top.sinif) : ''))));
  // --- ders başarıları (özet)
  const gA = lm.map(x => ogMean(exams.map(n => snLV(n, cur, x.nk)))), oA = lm.map(x => ogMean(exams.map(n => snLV(n, '', x.nk))));
  // --- sınıf sıralaması (sınıf karşılaştırması için)
  const cRows = classes.map(c => { const ps = exams.map(n => snGV(n, c, 'pct', sc)), st = all.filter(s => s.sinif === c && s.took > 0), rn = Array.from(roster.values()).filter(s => s.sinif === c).length; return { sinif: c, n: rn, took: st.length, ps, avg: ogMean(ps), part: ogMean(exams.map(n => (rn ? snRowsOf(n, c).length / rn * 100 : null))), les: lm.map(x => ogMean(exams.map(n => snLV(n, c, x.nk)))), ok: all.filter(s => s.sinif === c) }; });
  const cRank = cRows.filter(r => r.avg != null).sort((a, b) => b.avg - a.avg);
  const notes = [];
  { const f0 = snFirstIdx(gp); if (li >= 0) notes.push(f0 !== li ? `${name} ortalama başarısı: ${ogP(gp[f0])} → ${ogP(gp[li])} (ilk sınavdan sonuncuya ${ogSgn(gp[li] - gp[f0], 1, ' puan')}); sınav başına ortalama değişim ${ogSgn(slope, 1, ' puan')} (${ogTrendWord(slope)}).` : `${name} ortalama başarısı ${ogP(gp[li])} (tek sınav).`); }
  if (cur && cRank.length > 1) { const k = cRank.findIndex(r => r.sinif === cur); if (k >= 0) notes.push(`${cur} sınıfı ortalama başarıda ${cRank.length} sınıf içinde ${k + 1}. sırada (okul ortalaması ${ogP(ogMean(op))}).`); }
  if (!cur && cRank.length > 1) notes.push(`En yüksek ortalama: ${cRank[0].sinif} (${ogP(cRank[0].avg)}); en düşük: ${cRank[cRank.length - 1].sinif} (${ogP(cRank[cRank.length - 1].avg)}). Fark ${nf(cRank[0].avg - cRank[cRank.length - 1].avg, 1)} puan.`);
  const lessD = lm.map((x, i) => ({ x, v: gA[i], d: gA[i] != null && oA[i] != null ? gA[i] - oA[i] : null })).filter(o => o.v != null);
  if (lessD.length >= 2) { const byV = lessD.slice().sort((a, b) => b.v - a.v); notes.push(`En güçlü ders: ${byV[0].x.name} (${ogP(byV[0].v)}); en zayıf ders: ${byV[byV.length - 1].x.name} (${ogP(byV[byV.length - 1].v)}).`); }
  if (cur && lessD.filter(o => o.d != null).length >= 2) { const byD = lessD.filter(o => o.d != null).sort((a, b) => b.d - a.d), a = byD[0], z = byD[byD.length - 1]; notes.push(`Okul ortalamasına göre en önde: ${a.x.name} (${ogSgn(a.d, 1, ' puan')}); en geride: ${z.x.name} (${ogSgn(z.d, 1, ' puan')}).`); }
  const weak = taken.filter(s => s.avg != null && s.avg < 40).length, drop = taken.filter(s => s.dLast != null && s.dLast <= -10).length;
  if (taken.length) notes.push(`${weak} öğrencinin ortalaması %40'ın altında; son sınavda ${drop} öğrenci 10 puan veya daha fazla düştü. Ayrıntı için "Başarı listeleri → Dikkat edilecekler".`);
  if (exams.some(n => n.totalQ !== exams[0].totalQ)) notes.push(`Not: sınavların soru sayıları farklı (${Array.from(new Set(exams.map(n => n.totalQ))).join(', ')}); karşılaştırmalar başarı yüzdesi üzerinden yapılır.`);
  snNote(pane, 'sn-notes', notes);
  // --- gelişim
  pane.append(h('div', { class: 'card' }, h('h2', null, 'Sınav sınav gelişim · ' + MT.l),
    metric === 'puan' && sc.mixed ? h('div', { class: 'alert warn small' }, `Puan türleri farklı (${sc.names.join(', ')}); grafikte yalnızca ${sc.name} sınavları gösterilir.`) : null,
    metric === 'net' && new Set(exams.map(n => n.totalQ)).size > 1 ? h('div', { class: 'alert warn small' }, 'Sınavların soru sayıları farklı; net doğrudan kıyaslanamaz — "Başarı %" kullanın.') : null,
    AnViz.line({ labels: L, sub: S, full: F, label: name + ' gelişimi', fmt: MT.f, floor: 0, ceil: metric === 'pct' ? 100 : null, series: snGroupSeries(exams, classes, cur, (n, s) => snGV(n, s, metric, sc)) }),
    h('p', { class: 'small muted' }, cur ? 'Kesikli çizgi okul ortalamasıdır.' : 'Her çizgi bir sınıftır; kesikli çizgi okul ortalamasıdır. Ayrı bir sınıfa bakmak için yukarıdan seçin ya da sınıf tablosunda satıra tıklayın.')));
  // --- katılım
  pane.append(h('div', { class: 'card' }, h('h2', null, 'Katılım'), AnViz.cols({ cats: exams.map((n, i) => { const k = snRowsOf(n, cur).length; return { label: L[i], sub: S[i], tip: `${F[i]} · ${k} / ${Math.max(rosterN, k)} öğrenci`, vals: [k, Math.max(0, rosterN - k)] }; }), series: [{ name: 'Katılan', c: 1 }, { name: 'Girmeyen', color: 'var(--v0)' }], stack: true, int: true, label: name + ' katılımı' })));
  // --- dersler
  if (lm.length) {
    pane.append(h('div', { class: 'card' }, h('h2', null, 'Ders ders başarı (ortalama başarı %)'), AnViz.bars({ rows: lm.map((x, i) => ({ label: x.name, vals: cur ? [gA[i], oA[i]] : [oA[i]] })), series: cur ? [{ name: cur, c: 1 }, { name: 'Okul', c: 2 }] : [{ name: 'Okul', c: 1 }], fmt: v => nf(v, 1) + '%', max: 100, xFmt: v => v + '%', label: 'Ders başarıları' })));
    const lmid = i => (cur ? null : oA[i]);
    pane.append(h('div', { class: 'card' }, h('h2', null, 'Ders × sınav (başarı %)'), h('div', { class: 'tablewrap' }, h('table', { class: 'an-table', id: 'sn-lesson-exam' }, h('thead', null, h('tr', null, h('th', null, 'Ders'), exams.map((n, i) => h('th', { class: 'num', title: F[i] }, L[i])), h('th', { class: 'num' }, 'Ort.'))),
      h('tbody', null, lm.map((x, i) => h('tr', null, h('td', null, h('span', { class: 'vz-key vz-b' + x.slot }), ' ', x.name), exams.map(n => { const v = snLV(n, cur, x.nk), mid = cur ? snLV(n, '', x.nk) : lmid(i); return snCell(v, mid); }), h('td', { class: 'num' }, h('b', null, ogP(gA[i])))))))),
    h('p', { class: 'small muted' }, cur ? 'Hücre rengi okul ortalamasından farktır (mavi: üstünde, kırmızı: altında).' : 'Hücre rengi dersin okul ortalamasından farktır (mavi: üstünde, kırmızı: altında).')));
  }
  // --- sınıf karşılaştırması
  const clsCols = [{ label: 'Sınıf', cell: r => h('td', null, h('b', null, r.sinif)) }, { label: 'Öğrenci', num: true, cell: r => h('td', { class: 'num' }, r.took === r.n ? r.n : `${r.took} / ${r.n}`) }, { label: 'Katılım', num: true, cell: r => h('td', { class: 'num' }, r.part == null ? '' : '%' + nf(r.part, 0)) }]
    .concat(exams.map((n, i) => ({ label: L[i], num: true, title: F[i], cell: r => snCell(r.ps[i], op[i]) })), [{ label: 'Ort.', num: true, cell: r => h('td', { class: 'num' }, h('b', null, ogP(r.avg))) }, { label: 'Son değ.', num: true, cell: r => { const a = snLastIdx(r.ps), b = a >= 0 ? snPrevIdx(r.ps, a) : -1; return h('td', { class: 'num' }, a >= 0 && b >= 0 ? anDelta(r.ps[a] - r.ps[b], 'pct') : ''); } }, { label: 'Gelişim', cell: r => h('td', null, anSpark(r.ps)) }],
      lm.map((x, i) => ({ label: x.name, num: true, title: x.name + ' ortalama başarı %', cell: r => snCell(r.les[i], oA[i]) })));
  const clsAll = { sinif: 'Okul', n: roster.size, took: all.filter(s => s.took > 0).length, ps: op, avg: ogMean(op), part: ogMean(exams.map(n => (roster.size ? snRowsOf(n, '').length / roster.size * 100 : null))), les: oA, all: true };
  if (classes.length) pane.append(h('div', { class: 'card' }, h('h2', null, 'Sınıf karşılaştırması'), snTable('sn-classes', clsCols, cRows.concat(clsAll), { onRow: r => { if (!r.all) { AN.cls = r.sinif; ctx.renderTab(); window.scrollTo(0, 0); } }, cls: r => (r.sinif === cur ? 'sn-cur ' : '') + (r.all ? 'sn-all' : '') }),
    h('p', { class: 'small muted' }, 'Hücre rengi okul ortalamasından farktır. Bir sınıfa tıklayınca o sınıfın ayrıntısı açılır.')));
  // --- dağılım
  const byCls = !cur && classes.length > 1, bd = snBandsOf(taken.map(s => [s.avg, s.sinif]), byCls, classes);
  pane.append(h('div', { class: 'card' }, h('h2', null, 'Başarı dağılımı (öğrencilerin ortalama başarı %)'), AnViz.cols({ cats: bd.cats, series: bd.series, stack: byCls, int: true, label: 'Başarı dağılımı' }), h('p', { class: 'small muted' }, 'Her öğrencinin girdiği sınavlardaki ortalama başarı yüzdesine göre kaç öğrenci hangi aralıkta.' + (byCls && classes.length > 8 ? ' İlk 8 sınıf gösteriliyor.' : ''))));
  // --- öğrenci sıralaması
  const st = AN.snSort, rows = snSort(taken, st), cols = snStuCols({ cls: !cur, nEx })
    .concat(exams.map((n, i) => ({ label: L[i], num: true, sk: 'e' + i, title: F[i] + ' · başarı %', cell: s => snCell(s.pct[i], gp[i]) })),
      [{ label: 'Ort. başarı', num: true, sk: 'avg', cell: s => h('td', { class: 'num' }, h('b', null, ogP(s.avg))) }, { label: 'Ort. net', num: true, sk: 'net', cell: s => h('td', { class: 'num' }, nf(s.avgNet)) }, { label: 'Son değ.', num: true, sk: 'dLast', title: 'Son sınavın bir öncekine göre başarı % farkı', cell: s => h('td', { class: 'num' }, s.dLast == null ? '' : anDelta(s.dLast, 'pct')) }, { label: 'Gelişim', cell: s => h('td', null, anSpark(s.pct)) }],
      lm.map((x, i) => ({ label: x.name, num: true, sk: 'l:' + x.nk, title: x.name + ' ortalama başarı %', cell: s => snCell(s.lavg.get(x.nk), gA[i]) })));
  pane.append(h('div', { class: 'card' }, h('h2', null, 'Öğrenci sıralaması · ' + name), snTable('sn-students', cols, rows, { sort: st, onSort: k => { AN.snSort = { key: k, dir: st.key === k ? -st.dir : (k === 'ad' || k === 'no' || k === 'sinif' || k === 'rank' ? 1 : -1) }; ctx.renderTab(); }, onRow: s => ctx.openStudent(s.no) }),
    h('p', { class: 'small muted' }, 'Sıra, girdiği sınavların ortalama başarı yüzdesine göre verilir; girmediği sınavlar ortalamaya katılmaz. Başlığa tıklayınca sıralama değişir, satıra tıklayınca öğrencinin ayrıntılı analizi açılır. Hücre rengi sınıf (ya da okul) ortalamasına göre farktır.')));
  // --- ders birincileri
  if (lm.length && taken.length) {
    const tr3 = x => taken.filter(s => s.lavg.get(x.nk) != null).sort((a, b) => b.lavg.get(x.nk) - a.lavg.get(x.nk)).slice(0, 3);
    pane.append(h('div', { class: 'card' }, h('h2', null, 'Ders birincileri'), h('div', { class: 'tablewrap' }, h('table', { class: 'an-table', id: 'sn-toppers' }, h('thead', null, h('tr', null, h('th', null, 'Ders'), h('th', null, '1.'), h('th', null, '2.'), h('th', null, '3.'))),
      h('tbody', null, lm.map(x => { const t = tr3(x); return h('tr', null, h('td', null, x.name), [0, 1, 2].map(k => h('td', null, t[k] ? [t[k].ad || t[k].no, h('span', { class: 'small muted' }, ` ${ogP(t[k].lavg.get(x.nk))}${cur ? '' : ' · ' + t[k].sinif}`)] : ''))); }))))));
  }
  snLast = { exams, L, lm, cur, name, rows, cRows, clsAll, gp, op, nEx, sc, classes };
}
function snClassExport(sel, ctx) {
  const m = snLast; if (!m) return;
  const { exams, lm, cur, name, rows, cRows, clsAll, op, nEx } = m;
  const stu = [ogHd(['Sıra', 'Ö.No', 'Ad Soyad', 'Sınıf', 'Girdiği sınav', ...exams.map(n => n.name + ' (başarı %)'), 'Ort. başarı %', 'Ort. net', 'Son değişim (puan)', ...lm.map(x => x.name + ' (ort. %)')])]
    .concat(rows.map(s => [s.rank, s.no, s.ad, s.sinif, `${s.took} / ${nEx}`, ...s.pct.map(ogN2), ogN2(s.avg), ogN2(s.avgNet), ogN2(s.dLast), ...lm.map(x => ogN2(s.lavg.get(x.nk)))]));
  const cls = [ogHd(['Sınıf', 'Kayıtlı öğrenci', 'Sınava giren', 'Katılım %', ...exams.map(n => n.name + ' (ort. %)'), 'Ort. %', ...lm.map(x => x.name + ' (ort. %)')])]
    .concat(cRows.concat(clsAll).map(r => [r.sinif, r.n, r.took, ogN2(r.part), ...r.ps.map(ogN2), ogN2(r.avg), ...r.les.map(ogN2)]));
  const les = [ogHd(['Ders', ...exams.map(n => n.name + ' (' + (cur || 'okul') + ' ort. %)'), 'Ort. %'])].concat(lm.map(x => { const v = exams.map(n => snLV(n, cur, x.nk)); return [x.name, ...v.map(ogN2), ogN2(ogMean(v))]; }));
  ogDownload(`sinif-analizi-${(cur || 'okul').replace(/[^\w-]+/g, '_')}.xlsx`, [{ name: 'Öğrenci sıralaması', rows: stu }, { name: 'Sınıf karşılaştırması', rows: cls }, { name: 'Ders x sınav', rows: les }]);
}
ANTABS.push({ id: 'sinif', label: 'Sınıf', filters: [], render: snClassRender, export: snClassExport });

/* ================================================================ DERS sekmesi */
function snLessonRender(pane, sel, ctx) {
  const exams = ogSorted(sel), roster = ogRoster(exams), classes = anClasses(exams), lm = snPresent(exams), nEx = exams.length;
  if (!lm.length) { pane.append(h('div', { class: 'empty card' }, 'Seçili sınavlarda ders bilgisi yok.')); return; }
  if (AN.cls && !classes.includes(AN.cls)) AN.cls = '';
  if (!AN.dersSel || !lm.some(x => x.nk === AN.dersSel)) AN.dersSel = lm[0].nk;
  const cur = AN.cls, LS = lm.find(x => x.nk === AN.dersSel), nk = LS.nk, sc = snScale(exams), all = snStudents(exams, roster), grp = all.filter(s => !cur || s.sinif === cur);
  const L = ogLbl(exams), S = ogSub(exams), F = ogFull(exams), name = (cur ? cur + ' sınıfı' : 'Tüm okul') + ' · ' + LS.name;
  const clsSel = h('select', { id: 'dr-cls', onchange: e => { AN.cls = e.target.value; ctx.renderTab(); } }, h('option', { value: '' }, 'Tüm okul'), classes.map(c => h('option', { value: c }, c + ' sınıfı'))); clsSel.value = cur;
  pane.append(h('div', { class: 'card no-print' }, h('div', { class: 'row an-f' }, h('b', null, 'Ders'), h('div', { class: 'row og-chips', id: 'dr-chips', style: { gap: '.35rem' } }, lm.map(x => h('button', { type: 'button', class: 'btn sm' + (x.nk === nk ? ' primary' : ''), 'data-id': x.nk, onclick: () => { AN.dersSel = x.nk; ctx.renderTab(); } }, x.name))), h('span', { class: 'grow' }), h('b', null, 'Sınıf'), clsSel)));
  snPrintHead(pane, name + ' · ders analiz raporu');
  const gl = exams.map(n => snLV(n, cur, nk)), ol = exams.map(n => snLV(n, '', nk)), dby = exams.map(n => snLD(n, cur, nk)), li = snLastIdx(gl), pi = li >= 0 ? snPrevIdx(gl, li) : -1, slope = ogSlope(gl), bi = snArgMax(gl), wi = snArgMin(gl);
  const withL = grp.filter(s => s.lavg.get(nk) != null), ranked = snRank(withL.map(s => Object.assign(s, { _v: s.lavg.get(nk) })), '_v'), dL = li >= 0 && pi >= 0 ? gl[li] - gl[pi] : null;
  const cAvg = classes.map(c => ({ sinif: c, v: ogMean(exams.map(n => snLV(n, c, nk))) })).filter(o => o.v != null).sort((a, b) => b.v - a.v);
  pane.append(h('div', { class: 'card og-head', id: 'dr-head' }, h('div', { class: 'row between' }, h('div', null, h('h2', { style: { marginBottom: '.1rem' } }, name), h('div', { class: 'small muted' }, `${nEx} sınav · ${withL.length} öğrenci`)), h('span', { class: 'pill' }, h('span', { class: 'vz-key vz-b' + LS.slot }), ' ' + LS.name)),
    h('div', { class: 'stats', style: { marginTop: '.7rem' } }, ogStat(ogP(ogMean(gl)), 'ort. başarı', cur ? 'okul ' + ogP(ogMean(ol)) : ''), ogStat(li >= 0 ? ogP(gl[li]) : '', 'son sınav', dL != null ? `${dL > 0 ? '▲' : dL < 0 ? '▼' : '＝'} ${ogSgn(dL, 1, ' puan')} önceki sınava göre` : ''), ogStat(slope != null ? ogSgn(slope, 1, ' puan') : '', 'sınav başına değişim', ogTrendWord(slope)),
      ogStat(bi >= 0 ? ogP(gl[bi]) : '', 'en iyi sınav', bi >= 0 ? exams[bi].name : ''), ogStat(wi >= 0 ? ogP(gl[wi]) : '', 'en düşük sınav', wi >= 0 ? exams[wi].name : ''), ogStat(ranked[0] ? (ranked[0].ad || ranked[0].no) : '', 'dersin birincisi', ranked[0] ? ogP(ranked[0]._v) + (cur ? '' : ' · ' + ranked[0].sinif) : ''))));
  const notes = [];
  if (li >= 0) { const f = snFirstIdx(gl); notes.push(`${LS.name} başarısı${f !== li ? `: ${ogP(gl[f])} → ${ogP(gl[li])} (${ogSgn(gl[li] - gl[f], 1, ' puan')}); ${ogTrendWord(slope)}` : ': ' + ogP(gl[li])}.`); }
  if (cur && ogMean(ol) != null && ogMean(gl) != null) notes.push(`${cur} sınıfı okul ortalamasının ${nf(Math.abs(ogMean(gl) - ogMean(ol)), 1)} puan ${ogMean(gl) >= ogMean(ol) ? 'üstünde' : 'altında'}.`);
  if (!cur && cAvg.length > 1) notes.push(`En başarılı sınıf: ${cAvg[0].sinif} (${ogP(cAvg[0].v)}); en düşük: ${cAvg[cAvg.length - 1].sinif} (${ogP(cAvg[cAvg.length - 1].v)}).`);
  const low = withL.filter(s => s._v < 40).length; if (withL.length) notes.push(low ? `${withL.length} öğrenciden ${low} tanesinin bu dersteki ortalaması %40'ın altında.` : `Hiçbir öğrencinin bu dersteki ortalaması %40'ın altında değil.`);
  snNote(pane, 'dr-notes', notes);
  // --- ders × sınıf ısı haritası
  const lAvgC = c => lm.map(x => ogMean(exams.map(n => snLV(n, c, x.nk)))), oAll = lAvgC(''), perC = classes.map(c => ({ c, v: lAvgC(c) }));
  pane.append(h('div', { class: 'card' }, h('h2', null, 'Ders × sınıf (ortalama başarı %)'), h('div', { class: 'tablewrap' }, h('table', { class: 'an-table', id: 'dr-matrix' }, h('thead', null, h('tr', null, h('th', null, 'Ders'), classes.map(c => h('th', { class: 'num' + (c === cur ? ' sn-cur' : '') }, c)), h('th', { class: 'num' }, 'Okul'))),
    h('tbody', null, lm.map((x, i) => h('tr', { class: 'an-row' + (x.nk === nk ? ' sn-cur' : ''), 'data-id': x.nk, onclick: () => { AN.dersSel = x.nk; ctx.renderTab(); } }, h('td', null, h('span', { class: 'vz-key vz-b' + x.slot }), ' ', x.name), perC.map(o => snCell(o.v[i], oAll[i])), h('td', { class: 'num' }, h('b', null, ogP(oAll[i])))))))),
    h('p', { class: 'small muted' }, 'Hücre rengi sınıfın okul ortalamasından farkıdır (mavi: üstünde, kırmızı: altında). Satıra tıklayınca o ders açılır.')));
  // --- ders gelişimi
  pane.append(h('div', { class: 'card' }, h('h2', null, LS.name + ' · sınav sınav başarı %'), AnViz.line({ labels: L, sub: S, full: F, label: LS.name + ' gelişimi', fmt: v => nf(v, 1) + '%', yFmt: v => nf(v, 0) + '%', floor: 0, ceil: 100, series: snGroupSeries(exams, classes, cur, (n, s) => snLV(n, s, nk)) })));
  // --- D/Y/B
  pane.append(h('div', { class: 'card' }, h('h2', null, LS.name + ' · ortalama doğru · yanlış · boş'), AnViz.cols({ cats: exams.map((n, i) => { const d = dby[i]; return { label: L[i], sub: S[i], tip: `${F[i]}${d ? ` · ${d.count} soru · ${d.k} öğrenci` : ''}`, vals: d ? [d.D, d.Y, d.B] : [null, null, null] }; }), series: [{ name: 'Doğru', c: 1 }, { name: 'Yanlış', c: 2 }, { name: 'Boş', color: 'var(--v0)' }], stack: true, fmt: v => nf(v, 1), label: LS.name + ' doğru yanlış boş' })));
  // --- dersler karşılaştırması
  const gAll = lm.map(x => ogMean(exams.map(n => snLV(n, cur, x.nk)))), ord = lm.map((x, i) => ({ x, v: gAll[i], o: oAll[i] })).filter(o => o.v != null).sort((a, b) => b.v - a.v);
  pane.append(h('div', { class: 'card' }, h('h2', null, 'Derslerin karşılaştırması · ' + (cur ? cur + ' sınıfı' : 'okul')), AnViz.bars({ rows: ord.map(o => ({ label: o.x.name, vals: cur ? [o.v, o.o] : [o.v] })), series: cur ? [{ name: cur, c: 1 }, { name: 'Okul', c: 2 }] : [{ name: 'Okul', c: 1 }], fmt: v => nf(v, 1) + '%', max: 100, xFmt: v => v + '%', label: 'Ders karşılaştırması' }), h('p', { class: 'small muted' }, 'En güçlü dersten en zayıfa doğru sıralıdır.')));
  // --- dağılım
  const byCls = !cur && classes.length > 1, bd = snBandsOf(withL.map(s => [s._v, s.sinif]), byCls, classes);
  pane.append(h('div', { class: 'card' }, h('h2', null, LS.name + ' · başarı dağılımı'), AnViz.cols({ cats: bd.cats, series: bd.series, stack: byCls, int: true, label: LS.name + ' dağılımı' })));
  // --- sınav tablosu
  pane.append(h('div', { class: 'card' }, h('h2', null, LS.name + ' · sınav sınav'), h('div', { class: 'tablewrap' }, h('table', { class: 'an-table', id: 'dr-exams' }, h('thead', null, h('tr', null, ['Tarih', 'Sınav', 'Soru', 'Öğrenci', 'Ort. D', 'Ort. Y', 'Ort. B', 'Ort. net', 'Başarı %', 'Okul %'].map((t, i) => h('th', { class: i > 1 ? 'num' : '' }, t)))),
    h('tbody', null, exams.map((n, i) => { const d = dby[i]; return h('tr', null, h('td', { class: 'nowrap' }, anFmtDate(n.date)), h('td', null, n.name), d ? [h('td', { class: 'num' }, d.count), h('td', { class: 'num' }, d.k), h('td', { class: 'num' }, nf(d.D, 1)), h('td', { class: 'num' }, nf(d.Y, 1)), h('td', { class: 'num' }, nf(d.B, 1)), h('td', { class: 'num' }, nf(d.net)), snCell(gl[i], ol[i]), h('td', { class: 'num' }, ogP(ol[i]))] : h('td', { colspan: 8, class: 'muted' }, 'Bu sınavda bu ders yok')); }))))));
  // --- ilk / son 10
  const vcols = snStuCols({ cls: !cur, nEx }).filter(c => c.label !== 'Sıra' && c.label !== 'Sınav').concat([{ label: 'Ders başarısı', num: true, cell: s => h('td', { class: 'num' }, h('b', null, ogP(s._v))) }, { label: 'Gelişim', cell: s => h('td', null, anSpark(s.lp.get(nk) || [])) }]), rk = c => [{ label: 'Sıra', num: true, cell: s => h('td', { class: 'num' }, s.rank) }].concat(c);
  const topS = withL.slice().sort((a, b) => b._v - a._v).slice(0, 10), botS = withL.slice().sort((a, b) => a._v - b._v).slice(0, 10);
  if (withL.length) pane.append(h('div', { class: 'sn-grid2' }, h('div', { class: 'card' }, h('h2', null, 'En başarılı 10 öğrenci'), snTable('dr-top', rk(vcols), topS, { onRow: s => ctx.openStudent(s.no) })), h('div', { class: 'card' }, h('h2', null, 'En düşük 10 öğrenci'), snTable('dr-bottom', rk(vcols), botS, { onRow: s => ctx.openStudent(s.no) }))));
  drLast = { exams, lm, cur, nk, LS, classes, oAll, perC, withL, gl, ol, nEx, all };
}
function snLessonExport(sel, ctx) {
  const m = drLast; if (!m) return; const { exams, lm, cur, LS, classes, oAll, perC, withL, gl, ol, nk } = m;
  const mat = [ogHd(['Ders', ...classes, 'Okul'])].concat(lm.map((x, i) => [x.name, ...perC.map(o => ogN2(o.v[i])), ogN2(oAll[i])]));
  const ex = [ogHd(['Sınav', 'Tarih', (cur || 'Okul') + ' ort. başarı %', 'Okul ort. başarı %'])].concat(exams.map((n, i) => [n.name, anFmtDate(n.date), ogN2(gl[i]), ogN2(ol[i])]));
  const stu = [ogHd(['Sıra', 'Ö.No', 'Ad Soyad', 'Sınıf', LS.name + ' ort. başarı %', ...exams.map(n => n.name + ' (%)')])].concat(withL.slice().sort((a, b) => a.rank - b.rank).map(s => [s.rank, s.no, s.ad, s.sinif, ogN2(s._v), ...(s.lp.get(nk) || []).map(ogN2)]));
  ogDownload(`ders-analizi-${LS.name.replace(/[^\w-]+/g, '_')}.xlsx`, [{ name: 'Ders x sınıf', rows: mat }, { name: 'Sınav sınav', rows: ex }, { name: 'Öğrenciler', rows: stu }]);
}
ANTABS.push({ id: 'ders', label: 'Ders', filters: [], render: snLessonRender, export: snLessonExport });
