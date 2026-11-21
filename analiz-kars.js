/* analiz-kars.js — Karşılaştır sekmesi: işaretli sınavlardan herhangi ikisini (A ↔ B) okul, sınıf ya da tek öğrenci düzeyinde karşılaştırır.
 * Örnek: 1. sınav ↔ 3. sınav, 1. ↔ 4. sınav, son ↔ önceki. Ölçüt: başarı % / net / puan; isteğe bağlı tek ders.
 * İçerik: özet kutuları, otomatik değerlendirme, ders ve sınıf karşılaştırması, öğrenci saçılım grafiği (A'ya karşı B), başarı dağılımının değişimi,
 * bir önceki sınava göre adım adım değişim, en çok yükselen / düşen öğrenciler (Ö.No ile eşleştirilir). Excel ve yazdır.
 * Soru sayıları ya da puan türleri farklıysa net / puan kıyaslanmaz; başarı yüzdesine geçilir ve nedeni yazılır. */
'use strict';

AN.kA = ''; AN.kB = ''; AN.kScope = 'okul'; AN.kMetric = 'pct'; AN.kLesson = ''; AN.kStu = '';
let ksLast = null;
const KS_MET = {
  pct: { l: 'Başarı %', f: ogP, d: d => ogSgn(d, 1, ' puan'), eps: .05, ax: v => nf(v, 0) + '%' },
  net: { l: 'Net', f: v => (v == null ? '–' : nf(v, 2)), d: d => ogSgn(d, 2), eps: .005, ax: v => nf(v, 0) },
  puan: { l: 'Puan', f: v => (v == null ? '–' : nf(v, 1)), d: d => ogSgn(d, 1), eps: .05, ax: v => nf(v, 0) }
};
const ksCut = (s, n) => { s = String(s == null ? '' : s); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
const ksDelta = (d, m) => anDelta(d, m === 'pct' ? 'pct' : 'net');
/** Bir öğrencinin (satırın) seçilen ölçütteki değeri; nk verilmişse yalnızca o dersin değeri. */
function ksVal(r, n, m, nk) {
  if (nk) { const li = ogLi(n, nk); if (li < 0) return null; const s = r.sec[li]; if (!s || s[3] == null) return null; const c = n.lessons[li].count; return m === 'pct' ? (c ? s[3] / c * 100 : null) : s[3]; }
  return m === 'pct' ? ogPct(r.net, n.totalQ) : m === 'net' ? r.net : r.puan;
}
/** İstenen ölçüt iki sınav için geçerli mi? Değilse başarı yüzdesine geçilir ve nedeni döner. */
function ksResolve(A, B, metric, nk) {
  let m = metric, warn = '';
  if (nk) {
    const la = ogLi(A, nk), lb = ogLi(B, nk), nm = la >= 0 ? A.lessons[la].name : nk;
    if (m === 'puan') { m = 'pct'; warn = 'Ders seçiliyken puan hesaplanmadığı için başarı % gösteriliyor.'; }
    else if (m === 'net' && la >= 0 && lb >= 0 && A.lessons[la].count !== B.lessons[lb].count) { m = 'pct'; warn = `${nm} dersinin soru sayıları farklı (${A.lessons[la].count} / ${B.lessons[lb].count}); net doğrudan kıyaslanamaz, başarı % gösteriliyor.`; }
  } else if (m === 'net' && A.totalQ !== B.totalQ) { m = 'pct'; warn = `Sınavların soru sayıları farklı (${A.totalQ} / ${B.totalQ}); net doğrudan kıyaslanamaz, başarı % gösteriliyor.`; }
  else if (m === 'puan') {
    const pa = A.puanAdi || 'Puan', pb = B.puanAdi || 'Puan', ha = anRows(A).some(r => r.puan != null), hb = anRows(B).some(r => r.puan != null);
    if (pa !== pb) { m = 'pct'; warn = `Puan türleri farklı (${pa} / ${pb}); birbirine karıştırılmaz, başarı % gösteriliyor.`; }
    else if (!ha || !hb) { m = 'pct'; warn = 'Sınavlardan birinde puan bilgisi yok; başarı % gösteriliyor.'; }
  }
  return { m, warn };
}
/** İki sınavın (isteğe bağlı sınıf süzgeciyle) değerleri ve Ö.No ile eşleşen çiftler. */
function ksPairs(A, B, m, nk, cls, nameOf) {
  const va = new Map(), vb = new Map();
  snRowsOf(A, cls).forEach(r => { const v = ksVal(r, A, m, nk); if (v != null) va.set(r.no, { r, v }); });
  snRowsOf(B, cls).forEach(r => { const v = ksVal(r, B, m, nk); if (v != null) vb.set(r.no, { r, v }); });
  const pairs = []; va.forEach((a, no) => { const b = vb.get(no); if (b) pairs.push({ no, a: a.v, b: b.v, d: b.v - a.v, ad: nameOf(no, b.r) || nameOf(no, a.r), sinif: b.r.sinif || a.r.sinif }); });
  return { va, vb, pairs, nA: va.size, nB: vb.size, avgA: ogMean(Array.from(va.values()).map(x => x.v)), avgB: ogMean(Array.from(vb.values()).map(x => x.v)), pA: ogMean(pairs.map(p => p.a)), pB: ogMean(pairs.map(p => p.b)) };
}
const ksBands = vals => { const b = [0, 0, 0, 0, 0]; vals.forEach(v => { if (v != null) b[snBand(v)]++; }); return b; };

function karsRender(pane, sel, ctx) {
  const exams = ogSorted(sel), roster = ogRoster(exams), classes = anClasses(exams), school = schoolByCode(AN.okul);
  if (exams.length < 2) { pane.append(h('div', { class: 'alert info', id: 'ks-need' }, 'Karşılaştırmak için en az iki sınav işaretleyin (yukarıdaki sınav tablosundan).')); return; }
  const ids = exams.map(n => n.id);
  if (!ids.includes(AN.kB)) AN.kB = ids[ids.length - 1];
  if (!ids.includes(AN.kA)) { const b0 = ids.indexOf(AN.kB); AN.kA = b0 > 0 ? ids[b0 - 1] : ids[1]; }
  const A = exams.find(n => n.id === AN.kA), B = exams.find(n => n.id === AN.kB), ai = ids.indexOf(AN.kA), bi = ids.indexOf(AN.kB);
  // --- ders listesi (iki sınavda da bulunanlar)
  const bothL = Array.from(ogLessonMap().values()).filter(x => ogLi(A, x.nk) >= 0 && ogLi(B, x.nk) >= 0);
  if (AN.kLesson && !bothL.some(x => x.nk === AN.kLesson)) AN.kLesson = '';
  const nk = AN.kLesson, lessonName = nk ? (bothL.find(x => x.nk === nk) || {}).name : '';
  const { m, warn } = ksResolve(A, B, AN.kMetric, nk), MT = KS_MET[m];
  const scope = AN.kScope;
  if (scope === 'sinif') { if (!classes.includes(AN.cls)) AN.cls = classes[0] || ''; }
  const cls = scope === 'sinif' ? AN.cls : '';
  if (scope === 'ogr' && !AN.kStu && AN.stu) AN.kStu = AN.stu;
  const nameOf = (no, r) => (r && r.ad) || (roster.get(no) || {}).ad || '';

  // --- denetim çubuğu
  const opt = (n, i) => h('option', { value: n.id }, `${i + 1}. ${anFmtDate(n.date)} · ${n.name}`);
  const selA = h('select', { id: 'ks-a', 'aria-label': 'Sınav A', onchange: e => { AN.kA = e.target.value; ctx.renderTab(); } }, exams.map(opt)); selA.value = AN.kA;
  const selB = h('select', { id: 'ks-b', 'aria-label': 'Sınav B', onchange: e => { AN.kB = e.target.value; ctx.renderTab(); } }, exams.map(opt)); selB.value = AN.kB;
  const setAB = (a, b) => { AN.kA = a; AN.kB = b; ctx.renderTab(); };
  const n = exams.length;
  const row1 = h('div', { class: 'row an-f' }, h('b', null, 'Sınav A'), selA, h('button', { class: 'btn sm', id: 'ks-swap', title: 'A ile B yer değiştirir', onclick: () => setAB(AN.kB, AN.kA) }, '⇄'), h('b', null, 'Sınav B'), selB,
    h('span', { class: 'grow' }), h('span', { class: 'small muted' }, 'Hızlı:'), h('button', { class: 'btn sm', id: 'ks-last', onclick: () => setAB(ids[n - 2], ids[n - 1]) }, 'Önceki ↔ son'), h('button', { class: 'btn sm', id: 'ks-firstlast', onclick: () => setAB(ids[0], ids[n - 1]) }, 'İlk ↔ son'));
  const clsSel = h('select', { id: 'ks-cls', 'aria-label': 'Sınıf', onchange: e => { AN.cls = e.target.value; ctx.renderTab(); } }, classes.map(c => h('option', { value: c }, c + ' sınıfı'))); clsSel.value = cls;
  const lesSel = h('select', { id: 'ks-lesson', 'aria-label': 'Ders', onchange: e => { AN.kLesson = e.target.value; ctx.renderTab(); } }, h('option', { value: '' }, 'Tüm dersler (toplam)'), bothL.map(x => h('option', { value: x.nk }, x.name))); lesSel.value = nk;
  const q = h('input', { type: 'search', id: 'ks-q', placeholder: 'Öğrenci no ya da ad…', autocomplete: 'off', 'aria-label': 'Öğrenci ara' }), hits = h('div', { class: 'og-hits', id: 'ks-hits' });
  const pickStu = no => { AN.kStu = no; ctx.renderTab(); };
  const paint = () => { clear(hits); const f = ogFind(roster, q.value); if (q.value.trim() && !f.length) hits.append(h('span', { class: 'small muted' }, 'Eşleşen öğrenci yok.')); f.forEach(s => hits.append(h('button', { type: 'button', class: 'btn sm og-hit', 'data-no': s.no, onclick: () => pickStu(s.no) }, `${s.no} · ${s.ad || '(adı yok)'}${s.sinif ? ' · ' + s.sinif : ''}`))); };
  q.addEventListener('input', paint); q.addEventListener('keydown', e => { if (e.key === 'Enter') { const f = ogFind(roster, q.value); if (f.length) pickStu(f[0].no); } });
  const stuInfo = scope === 'ogr' && AN.kStu ? roster.get(AN.kStu) : null; if (scope === 'ogr' && AN.kStu && !stuInfo) AN.kStu = '';
  const row2 = h('div', { class: 'row an-f', style: { marginTop: '.5rem' } }, h('b', null, 'Düzey'), ogSeg([['okul', 'Okul'], ['sinif', 'Sınıf'], ['ogr', 'Öğrenci']], scope, k => { AN.kScope = k; ctx.renderTab(); }),
    scope === 'sinif' ? clsSel : null, scope === 'ogr' ? q : null, h('b', { style: { marginLeft: '.6rem' } }, 'Ölçüt'), ogSeg(Object.keys(KS_MET).map(k => [k, KS_MET[k].l]), AN.kMetric, k => { AN.kMetric = k; ctx.renderTab(); }), lesSel);
  pane.append(h('div', { class: 'card no-print', id: 'ks-ctl' }, row1, row2, scope === 'ogr' ? hits : null));
  if (warn) pane.append(h('div', { class: 'alert warn small', id: 'ks-warn' }, warn));
  if (A.id === B.id) pane.append(h('div', { class: 'alert info small' }, 'A ve B aynı sınav; fark sıfır çıkar. Farklı iki sınav seçin.'));
  snPrintHead(pane, 'Sınav karşılaştırma raporu');
  const S = { exams, roster, classes, school, A, B, ai, bi, m, MT, nk, lessonName, cls, nameOf, bothL, ctx, scope };
  if (scope === 'ogr') ksStudentView(pane, S); else ksGroupView(pane, S);
}

/* ---- okul / sınıf düzeyi */
function ksGroupView(pane, S) {
  const { exams, roster, classes, school, A, B, ai, bi, m, MT, nk, lessonName, cls, nameOf, bothL, ctx } = S, eps = MT.eps;
  const P = ksPairs(A, B, m, nk, cls, nameOf), scopeName = cls ? cls + ' sınıfı' : (school ? school.okulAdi : 'Okul'), ttl = (lessonName ? lessonName + ' · ' : '') + MT.l;
  const dAll = P.avgA != null && P.avgB != null ? P.avgB - P.avgA : null, dPair = P.pA != null && P.pB != null ? P.pB - P.pA : null;
  const up = P.pairs.filter(p => p.d > eps).length, down = P.pairs.filter(p => p.d < -eps).length, same = P.pairs.length - up - down, np = P.pairs.length;
  const rosterN = Array.from(roster.values()).filter(s => !cls || s.sinif === cls).length, kA = snRowsOf(A, cls).length, kB = snRowsOf(B, cls).length;
  const aName = `A · ${ksCut(A.name, 20)}`, bName = `B · ${ksCut(B.name, 20)}`, sA = { name: aName, c: 1 }, sB = { name: bName, c: 2 };
  pane.append(h('div', { class: 'card og-head', id: 'ks-head' }, h('div', { class: 'row between' }, h('div', null, h('h2', { style: { marginBottom: '.1rem' } }, `${A.name}  →  ${B.name}`), h('div', { class: 'small muted' }, `${scopeName} · ${ttl} · A: ${anFmtDate(A.date)} (${ai + 1}. sınav) · B: ${anFmtDate(B.date)} (${bi + 1}. sınav)`)), h('span', { class: 'pill ' + (dAll == null ? '' : dAll > eps ? 'ok' : dAll < -eps ? 'bad' : '') }, dAll == null ? 'veri yok' : dAll > eps ? 'B daha yüksek' : dAll < -eps ? 'B daha düşük' : 'değişim yok')),
    h('div', { class: 'stats', style: { marginTop: '.7rem' } }, ogStat(MT.f(P.avgA), 'A ortalaması', `${P.nA} öğrenci`), ogStat(MT.f(P.avgB), 'B ortalaması', `${P.nB} öğrenci`), ogStat(dAll == null ? '' : MT.d(dAll), 'ortalama değişim (B − A)', 'tüm katılımcılar'), ogStat(dPair == null ? '' : MT.d(dPair), 'ortak öğrencilerde değişim', `${np} öğrenci iki sınavda da var`),
      ogStat(up, 'yükselen öğrenci', np ? `%${nf(up / np * 100, 0)}` : ''), ogStat(down, 'düşen öğrenci', np ? `%${nf(down / np * 100, 0)}` : ''), ogStat(same, 'değişmeyen'), ogStat(rosterN ? `%${nf(kA / Math.max(rosterN, kA) * 100, 0)} → %${nf(kB / Math.max(rosterN, kB) * 100, 0)}` : '', 'katılım A → B', `${kA} → ${kB} öğrenci`))));

  // --- ders ders (yalnızca ders seçili değilse)
  const lrows = nk ? [] : bothL.map(x => { const p = ksPairs(A, B, 'pct', x.nk, cls, nameOf); return { x, a: p.avgA, b: p.avgB, d: p.avgA != null && p.avgB != null ? p.avgB - p.avgA : null, dp: p.pA != null && p.pB != null ? p.pB - p.pA : null, np: p.pairs.length, up: p.pairs.filter(q => q.d > .05).length, down: p.pairs.filter(q => q.d < -.05).length }; }).filter(r => r.a != null || r.b != null);
  // --- sınıf sınıf (yalnızca okul düzeyinde)
  const crows = !cls ? anClasses([A, B]).map(c => { const p = ksPairs(A, B, m, nk, c, nameOf); return { sinif: c, a: p.avgA, b: p.avgB, d: p.avgA != null && p.avgB != null ? p.avgB - p.avgA : null, np: p.pairs.length, up: p.pairs.filter(q => q.d > eps).length, down: p.pairs.filter(q => q.d < -eps).length, nA: p.nA, nB: p.nB }; }).filter(r => r.a != null || r.b != null) : [];
  // --- bir önceki sınava göre adımlar
  const steps = exams.slice(1).map((n, i) => { const p0 = exams[i]; const k = nk && ogLi(p0, nk) >= 0 && ogLi(n, nk) >= 0 ? nk : ''; const pp = ksPairs(p0, n, 'pct', k, cls, nameOf); return { n, p0, a: pp.avgA, b: pp.avgB, d: pp.avgA != null && pp.avgB != null ? pp.avgB - pp.avgA : null, np: pp.pairs.length, up: pp.pairs.filter(q => q.d > .05).length, down: pp.pairs.filter(q => q.d < -.05).length, sel: n.id === B.id }; });
  // --- değerlendirme
  const notes = [];
  if (dAll != null) notes.push(`${scopeName} ${ttl} ortalaması: ${MT.f(P.avgA)} (${A.name}) → ${MT.f(P.avgB)} (${B.name}); fark ${MT.d(dAll)}${Math.abs(dAll) < eps ? ' (değişim yok)' : dAll > 0 ? ' (B daha yüksek)' : ' (B daha düşük)'}.`);
  else notes.push('Seçilen sınavlardan birinde bu ölçüt için veri yok.');
  if (np) notes.push(`İki sınava da giren ${np} öğrenciden ${up} tanesi (%${nf(up / np * 100, 0)}) yükseldi, ${down} tanesi (%${nf(down / np * 100, 0)}) düştü, ${same} tanesi aynı kaldı; ortak öğrencilerin ortalama değişimi ${MT.d(dPair)}.`);
  if (P.nA !== P.nB || np < Math.max(P.nA, P.nB)) notes.push(`Yalnızca A'ya giren ${P.nA - np}, yalnızca B'ye giren ${P.nB - np} öğrenci var; öğrenci bazlı değişimler ortak ${np} öğrenci üzerindendir (Ö.No ile eşleştirilir).`);
  const lv = lrows.filter(r => r.d != null).sort((x, y) => y.d - x.d); if (lv.length >= 2) { const a = lv[0], z = lv[lv.length - 1], bits = []; if (a.d > .05) bits.push(`en çok yükselen ders ${a.x.name} (${ogSgn(a.d, 1, ' puan')})`); if (z.d < -.05) bits.push(`en çok düşen ders ${z.x.name} (${ogSgn(z.d, 1, ' puan')})`); if (bits.length) notes.push(bits.join('; ').replace(/^./, c => c.toLocaleUpperCase('tr')) + ' (başarı %).'); }
  const cv = crows.filter(r => r.d != null).sort((x, y) => y.d - x.d); if (cv.length >= 2) { const a = cv[0], z = cv[cv.length - 1], bits = []; if (a.d > eps) bits.push(`en çok yükselen sınıf ${a.sinif} (${MT.d(a.d)})`); if (z.d < -eps) bits.push(`en çok düşen sınıf ${z.sinif} (${MT.d(z.d)})`); if (bits.length) notes.push(bits.join('; ').replace(/^./, c => c.toLocaleUpperCase('tr')) + '.'); }
  if (np >= 2) { const byD = P.pairs.slice().sort((x, y) => y.d - x.d), a = byD[0], z = byD[byD.length - 1]; const bits = []; if (a.d > eps) bits.push(`en çok yükselen: ${a.ad || a.no} (${MT.f(a.a)} → ${MT.f(a.b)}, ${MT.d(a.d)})`); if (z.d < -eps) bits.push(`en çok düşen: ${z.ad || z.no} (${MT.f(z.a)} → ${MT.f(z.b)}, ${MT.d(z.d)})`); if (bits.length) notes.push(bits.join('; ').replace(/^./, c => c.toLocaleUpperCase('tr')) + '.'); }
  snNote(pane, 'ks-notes', notes);

  // --- ders karşılaştırması
  if (lrows.length) {
    pane.append(h('div', { class: 'card', id: 'ks-lessons-card' }, h('h2', null, 'Ders ders karşılaştırma · başarı %'), AnViz.bars({ rows: lrows.map(r => ({ label: r.x.name, vals: [r.a, r.b] })), series: [sA, sB], fmt: v => nf(v, 1) + '%', max: 100, min: 0, xFmt: v => v + '%', label: 'Ders karşılaştırması' }),
      h('div', { class: 'tablewrap', style: { marginTop: '.5rem' } }, h('table', { class: 'an-table', id: 'ks-lessons' }, h('thead', null, h('tr', null, h('th', null, 'Ders'), ['A', 'B', 'Değişim', 'Ortak öğr. değişimi', 'Ortak öğrenci', 'Yükselen', 'Düşen'].map(x => h('th', { class: 'num' }, x)))),
        h('tbody', null, lrows.map(r => h('tr', { class: 'an-row', onclick: () => { AN.kLesson = r.x.nk; S.ctx.renderTab(); window.scrollTo(0, 0); } }, h('td', null, h('span', { class: 'vz-key vz-b' + r.x.slot }), ' ', r.x.name), h('td', { class: 'num' }, ogP(r.a)), h('td', { class: 'num' }, ogP(r.b)), h('td', { class: 'num', style: snHeat(r.d, 0, 15) }, r.d == null ? '' : ogSgn(r.d, 1, ' puan')), h('td', { class: 'num' }, r.dp == null ? '' : ogSgn(r.dp, 1, ' puan')), h('td', { class: 'num' }, r.np), h('td', { class: 'num' }, r.up), h('td', { class: 'num' }, r.down)))))),
      h('p', { class: 'small muted' }, 'Ders karşılaştırması her zaman başarı yüzdesi üzerindendir (soru sayıları farklı olsa da doğru kıyas için). Bir derse tıklayınca bütün sayfa o dersin A ↔ B karşılaştırmasına döner.')));
  }
  // --- sınıf karşılaştırması
  if (crows.length) {
    pane.append(h('div', { class: 'card', id: 'ks-classes-card' }, h('h2', null, 'Sınıf sınıf karşılaştırma · ' + ttl), AnViz.bars({ rows: crows.map(r => ({ label: r.sinif, sub: `${r.nA} → ${r.nB} öğrenci`, vals: [r.a, r.b] })), series: [sA, sB], fmt: m === 'pct' ? v => nf(v, 1) + '%' : v => nf(v, m === 'net' ? 2 : 1), min: 0, max: m === 'pct' ? 100 : null, xFmt: m === 'pct' ? v => v + '%' : v => nf(v, 0), label: 'Sınıf karşılaştırması' }),
      h('div', { class: 'tablewrap', style: { marginTop: '.5rem' } }, h('table', { class: 'an-table', id: 'ks-classes' }, h('thead', null, h('tr', null, h('th', null, 'Sınıf'), ['A', 'B', 'Değişim', 'Ortak öğrenci', 'Yükselen', 'Düşen'].map(x => h('th', { class: 'num' }, x)))),
        h('tbody', null, crows.map(r => h('tr', { class: 'an-row', onclick: () => { AN.kScope = 'sinif'; AN.cls = r.sinif; S.ctx.renderTab(); window.scrollTo(0, 0); } }, h('td', null, h('b', null, r.sinif)), h('td', { class: 'num' }, MT.f(r.a)), h('td', { class: 'num' }, MT.f(r.b)), h('td', { class: 'num', style: snHeat(r.d, 0, m === 'pct' ? 15 : 3) }, r.d == null ? '' : MT.d(r.d)), h('td', { class: 'num' }, r.np), h('td', { class: 'num' }, r.up), h('td', { class: 'num' }, r.down)))))),
      h('p', { class: 'small muted' }, 'Bir sınıfa tıklayınca karşılaştırma o sınıfa daralır.')));
  }
  // --- öğrenci saçılımı
  if (np >= 2) {
    const pc = m === 'pct';
    pane.append(h('div', { class: 'card', id: 'ks-scatter-card' }, h('h2', null, 'Öğrenci öğrenci: A ↔ B · ' + ttl),
      AnViz.scatter({ points: P.pairs.map(p => ({ x: p.a, y: p.b, label: p.ad || p.no, sub: p.sinif, g: p.d >= -eps ? 0 : 1 })), series: [{ name: 'B\'de yükselen / aynı', c: 1, shape: 'circle' }, { name: 'B\'de düşen', c: 2, shape: 'diamond' }], lo: pc ? 0 : null, hi: pc ? 100 : null, fmt: MT.f, axFmt: MT.ax, xTitle: `A · ${ksCut(A.name, 30)}`, yTitle: `B · ${ksCut(B.name, 30)}`, xName: 'A · ' + ksCut(A.name, 16), yName: 'B · ' + ksCut(B.name, 16), upText: 'B\'de yükselenler', downText: 'B\'de düşenler', label: 'A ve B sınavı öğrenci dağılımı', tableLabel: 'Öğrenci tablosu (değişime göre sıralı)' }),
      h('p', { class: 'small muted' }, 'Her nokta iki sınava da giren bir öğrencidir. Kesikli köşegen “değişim yok” çizgisidir: köşegenin üstündekiler B sınavında yükselmiş, altındakiler düşmüştür. Noktanın üzerine gelince öğrencinin adı ve değerleri görünür.')));
  }
  // --- dağılım değişimi
  const bA = ksBands(snRowsOf(A, cls).map(r => ksVal(r, A, 'pct', nk))), bB = ksBands(snRowsOf(B, cls).map(r => ksVal(r, B, 'pct', nk)));
  if (bA.some(v => v) || bB.some(v => v)) pane.append(h('div', { class: 'card', id: 'ks-dist-card' }, h('h2', null, 'Başarı dağılımının değişimi (öğrenci sayısı)'), AnViz.cols({ cats: SN_BANDS.map((b, i) => ({ label: '%' + b, tip: 'Başarı %' + b, vals: [bA[i], bB[i]] })), series: [sA, sB], int: true, label: 'Dağılım değişimi' }), h('p', { class: 'small muted' }, 'A ve B sınavına giren tüm öğrencilerin (ortak olmayanlar dahil) başarı yüzdesi aralıkları. B sütunları sağa kayıyorsa sınav genel olarak daha başarılı geçmiştir.')));
  // --- bir önceki sınava göre adımlar
  const stp = steps.filter(r => r.d != null);
  if (stp.length) pane.append(h('div', { class: 'card', id: 'ks-steps-card' }, h('h2', null, 'Bir önceki sınava göre değişim · sınav sınav (başarı %)'), AnViz.bars({ rows: stp.map(r => ({ label: r.n.name, sub: 'önceki: ' + r.p0.name, vals: [r.d] })), series: [{ name: 'Önceki sınava göre değişim (puan)', c: 1 }], fmt: v => ogSgn(v, 1, ' puan') || '0', xFmt: v => nf(v, 0), label: 'Adım adım değişim' }),
    h('div', { class: 'tablewrap', style: { marginTop: '.5rem' } }, h('table', { class: 'an-table', id: 'ks-steps' }, h('thead', null, h('tr', null, h('th', null, 'Sınav'), h('th', null, 'Önceki sınav'), ['Önceki', 'Bu sınav', 'Değişim', 'Ortak öğr.', 'Yükselen', 'Düşen'].map(x => h('th', { class: 'num' }, x)))),
      h('tbody', null, stp.map(r => h('tr', { class: r.sel ? 'sn-cur' : '' }, h('td', null, r.n.name), h('td', null, r.p0.name), h('td', { class: 'num' }, ogP(r.a)), h('td', { class: 'num' }, ogP(r.b)), h('td', { class: 'num', style: snHeat(r.d, 0, 15) }, ogSgn(r.d, 1, ' puan')), h('td', { class: 'num' }, r.np), h('td', { class: 'num' }, r.up), h('td', { class: 'num' }, r.down)))))),
    h('p', { class: 'small muted' }, 'Seçili sınavların her biri kendinden bir önceki seçili sınavla karşılaştırılır. Sınav sayıları farklı olsa da başarı yüzdesi kullanıldığı için kıyas doğrudur.')));
  // --- yükselen / düşen
  const cols = [{ label: 'Ö.No', cell: p => h('td', { class: 'nowrap' }, p.no) }, { label: 'Ad Soyad', cell: p => h('td', null, p.ad || '(adı yok)') }, !cls ? { label: 'Sınıf', cell: p => h('td', null, p.sinif) } : null, { label: 'A', num: true, cell: p => h('td', { class: 'num' }, MT.f(p.a)) }, { label: 'B', num: true, cell: p => h('td', { class: 'num' }, MT.f(p.b)) }, { label: 'Değişim', num: true, cell: p => h('td', { class: 'num', style: snHeat(p.d, 0, m === 'pct' ? 15 : 3) }, ksDelta(p.d, m)) }].filter(Boolean);
  const gain = P.pairs.filter(p => p.d > eps).sort((x, y) => y.d - x.d).slice(0, 10), loss = P.pairs.filter(p => p.d < -eps).sort((x, y) => x.d - y.d).slice(0, 10);
  if (np) pane.append(h('div', { class: 'sn-grid2' }, h('div', { class: 'card' }, h('h2', null, 'En çok yükselen 10 öğrenci'), gain.length ? snTable('ks-gain', cols, gain, { onRow: p => S.ctx.openStudent(p.no) }) : h('div', { class: 'muted small' }, 'Yükselen öğrenci yok.')), h('div', { class: 'card' }, h('h2', null, 'En çok düşen 10 öğrenci'), loss.length ? snTable('ks-loss', cols, loss, { onRow: p => S.ctx.openStudent(p.no) }) : h('div', { class: 'muted small' }, 'Düşen öğrenci yok.'))));
  // --- Excel için
  ksLast = { file: `karsilastirma-${(A.name + '-' + B.name).replace(/[^\w-]+/g, '_').slice(0, 50)}.xlsx`, sheets: () => {
    const ozet = { name: 'Özet', widths: [34, 70], rows: [[{ v: 'Kapsam', s: 'b' }, scopeName], [{ v: 'Ölçüt', s: 'b' }, ttl], [{ v: 'Sınav A', s: 'b' }, `${A.name} (${anFmtDate(A.date)})`], [{ v: 'Sınav B', s: 'b' }, `${B.name} (${anFmtDate(B.date)})`], [{ v: 'A ortalaması', s: 'b' }, ogN2(P.avgA)], [{ v: 'B ortalaması', s: 'b' }, ogN2(P.avgB)], [{ v: 'Ortalama değişim (B − A)', s: 'b' }, ogN2(dAll)], [{ v: 'Ortak öğrenci', s: 'b' }, np], [{ v: 'Yükselen / düşen / aynı', s: 'b' }, `${up} / ${down} / ${same}`], [], [{ v: 'Değerlendirme', s: 'b' }]].concat(notes.map(t => [null, t])) };
    const out = [ozet];
    if (lrows.length) out.push({ name: 'Dersler', rows: [ogHd(['Ders', 'A %', 'B %', 'Değişim (puan)', 'Ortak öğrenci değişimi', 'Ortak öğrenci', 'Yükselen', 'Düşen'])].concat(lrows.map(r => [r.x.name, ogN2(r.a), ogN2(r.b), ogN2(r.d), ogN2(r.dp), r.np, r.up, r.down])), widths: [24, 10, 10, 14, 20, 14, 10, 10] });
    if (crows.length) out.push({ name: 'Sınıflar', rows: [ogHd(['Sınıf', 'A', 'B', 'Değişim', 'A öğrenci', 'B öğrenci', 'Ortak öğrenci', 'Yükselen', 'Düşen'])].concat(crows.map(r => [r.sinif, ogN2(r.a), ogN2(r.b), ogN2(r.d), r.nA, r.nB, r.np, r.up, r.down])), widths: [14, 10, 10, 12, 11, 11, 13, 10, 10] });
    out.push({ name: 'Öğrenciler', rows: [ogHd(['Ö.No', 'Ad Soyad', 'Sınıf', 'A', 'B', 'Değişim'])].concat(P.pairs.slice().sort((x, y) => y.d - x.d).map(p => [p.no, p.ad, p.sinif, ogN2(p.a), ogN2(p.b), ogN2(p.d)])), widths: [12, 28, 10, 10, 10, 10], freeze: { row: 1 } });
    out.push({ name: 'Adım adım', rows: [ogHd(['Sınav', 'Önceki sınav', 'Önceki %', 'Bu sınav %', 'Değişim (puan)', 'Ortak öğrenci', 'Yükselen', 'Düşen'])].concat(stp.map(r => [r.n.name, r.p0.name, ogN2(r.a), ogN2(r.b), ogN2(r.d), r.np, r.up, r.down])), widths: [28, 28, 11, 11, 14, 13, 10, 10] });
    return out;
  } };
}

/* ---- tek öğrenci düzeyi */
function ksStudentView(pane, S) {
  const { roster, school, A, B, ai, bi, m, MT, nk, lessonName, bothL, ctx } = S, no = AN.kStu, eps = MT.eps;
  if (!no) { pane.append(h('div', { class: 'empty card', id: 'ks-empty' }, h('p', null, 'Bir öğrencinin numarasını ya da adını yazın; iki sınavdaki sonuçlarını ders ders karşılaştırın.'), h('p', { class: 'small muted' }, 'Sınıf ve okul karşılaştırması için üstteki “Düzey” düğmelerini kullanın.'))); ksLast = null; return; }
  const info = roster.get(no) || { no, ad: '', sinif: '' }, rA = anRows(A).find(r => r.no === no) || null, rB = anRows(B).find(r => r.no === no) || null;
  const name = (rB && rB.ad) || (rA && rA.ad) || info.ad || ('Öğrenci ' + no), sinif = (rB && rB.sinif) || (rA && rA.sinif) || info.sinif || '';
  const ttl = (lessonName ? lessonName + ' · ' : '') + MT.l;
  const vA = rA ? ksVal(rA, A, m, nk) : null, vB = rB ? ksVal(rB, B, m, nk) : null, d = vA != null && vB != null ? vB - vA : null;
  const avg = (n, c) => ogMean(snRowsOf(n, c).map(r => ksVal(r, n, m, nk)));
  const cA = avg(A, rA ? rA.sinif : sinif), cB = avg(B, rB ? rB.sinif : sinif), oA = avg(A, ''), oB = avg(B, ''), dC = cA != null && cB != null ? cB - cA : null, dO = oA != null && oB != null ? oB - oA : null;
  const kA = rA ? ogRanks(A, rA) : null, kB = rB ? ogRanks(B, rB) : null, rk = (k, f, fn) => (k && k[f] != null ? k[f] + (k[fn] ? '/' + k[fn] : '') : '–');
  const aName = `A · ${ksCut(A.name, 20)}`, bName = `B · ${ksCut(B.name, 20)}`;
  pane.append(h('div', { class: 'card og-head', id: 'ks-head' }, h('div', { class: 'row between' }, h('div', null, h('h2', { style: { marginBottom: '.1rem' } }, name), h('div', { class: 'small muted' }, `No ${no}${sinif ? ' · ' + sinif : ''}${school ? ' · ' + school.okulAdi : ''} · ${ttl}`), h('div', { class: 'small muted' }, `A: ${A.name} (${anFmtDate(A.date)}) → B: ${B.name} (${anFmtDate(B.date)})`)),
    h('div', { class: 'row no-print' }, h('button', { class: 'btn sm', id: 'ks-open', onclick: () => ctx.openStudent(no) }, 'Tüm sınavları (Öğrenci sekmesi)'))),
    h('div', { class: 'stats', style: { marginTop: '.7rem' } }, ogStat(MT.f(vA), 'A', rA ? '' : 'sınava girmemiş'), ogStat(MT.f(vB), 'B', rB ? '' : 'sınava girmemiş'), ogStat(d == null ? '' : MT.d(d), 'değişim (B − A)'), ogStat(cA != null || cB != null ? `${MT.f(cA)} → ${MT.f(cB)}` : '', 'sınıf ortalaması A → B', dC != null ? MT.d(dC) : ''), ogStat(oA != null || oB != null ? `${MT.f(oA)} → ${MT.f(oB)}` : '', 'okul ortalaması A → B', dO != null ? MT.d(dO) : ''),
      ogStat(kA || kB ? `${rk(kA, 'snf', 'snfN')} → ${rk(kB, 'snf', 'snfN')}` : '', 'sınıf sırası A → B'), ogStat(kA || kB ? `${rk(kA, 'okul', 'okulN')} → ${rk(kB, 'okul', 'okulN')}` : '', 'okul sırası A → B'))));
  if (!rA || !rB) pane.append(h('div', { class: 'alert warn', id: 'ks-miss' }, `${name} ${!rA && !rB ? 'her iki sınava da girmemiş' : !rA ? A.name + ' sınavına girmemiş' : B.name + ' sınavına girmemiş'}; karşılaştırma yapılamaz.`));
  // --- ders ders
  const lr = nk || !rA || !rB ? [] : bothL.map(x => { const la = ogLi(A, x.nk), lb = ogLi(B, x.nk), sa = rA.sec[la] || [], sb = rB.sec[lb] || [], ca = A.lessons[la].count, cb = B.lessons[lb].count, pa = ca && sa[3] != null ? sa[3] / ca * 100 : null, pb = cb && sb[3] != null ? sb[3] / cb * 100 : null, la2 = snLV(A, rA.sinif, x.nk), lb2 = snLV(B, rB.sinif, x.nk); return { x, pa, pb, d: pa != null && pb != null ? pb - pa : null, ca: la2, cb: lb2, dc: la2 != null && lb2 != null ? lb2 - la2 : null, gap: pb != null && lb2 != null ? pb - lb2 : null, na: sa[3], nb: sb[3], D: [sa[0], sa[1], sa[2]], D2: [sb[0], sb[1], sb[2]] }; }).filter(r => r.pa != null || r.pb != null);
  const notes = [];
  if (d != null) notes.push(`${name}: ${ttl} ${MT.f(vA)} (${A.name}) → ${MT.f(vB)} (${B.name}); fark ${MT.d(d)}${Math.abs(d) < eps ? ' (değişim yok)' : d > 0 ? ' (yükseliş)' : ' (düşüş)'}.`);
  if (d != null && dC != null) notes.push(`Aynı dönemde sınıf ortalaması ${MT.d(dC)} değişti; öğrenci sınıfa göre ${d - dC > eps ? 'daha fazla yükseldi' : d - dC < -eps ? 'daha az yükseldi / daha çok düştü' : 'benzer değişti'} (fark ${MT.d(d - dC)}).`);
  if (kA && kB && kA.okul != null && kB.okul != null) notes.push(`Okul sırası: ${rk(kA, 'okul', 'okulN')} → ${rk(kB, 'okul', 'okulN')}` + (kA.snf != null && kB.snf != null ? `; sınıf sırası: ${rk(kA, 'snf', 'snfN')} → ${rk(kB, 'snf', 'snfN')}` : '') + '.');
  const lv = lr.filter(r => r.d != null).sort((x, y) => y.d - x.d); if (lv.length >= 2) { const a = lv[0], z = lv[lv.length - 1], bits = []; if (a.d > .05) bits.push(`en çok yükselen ders ${a.x.name} (${ogP(a.pa)} → ${ogP(a.pb)}, ${ogSgn(a.d, 1, ' puan')})`); if (z.d < -.05) bits.push(`en çok düşen ders ${z.x.name} (${ogP(z.pa)} → ${ogP(z.pb)}, ${ogSgn(z.d, 1, ' puan')})`); if (bits.length) notes.push(bits.join('; ').replace(/^./, c => c.toLocaleUpperCase('tr')) + '.'); }
  const gp = lr.filter(r => r.gap != null).sort((x, y) => y.gap - x.gap); if (gp.length >= 2) notes.push(`B sınavında sınıf ortalamasına göre en güçlü ders ${gp[0].x.name} (${ogSgn(gp[0].gap, 1, ' puan')}), en zayıf ders ${gp[gp.length - 1].x.name} (${ogSgn(gp[gp.length - 1].gap, 1, ' puan')}).`);
  snNote(pane, 'ks-notes', notes);
  if (lr.length) {
    pane.append(h('div', { class: 'card', id: 'ks-lessons-card' }, h('h2', null, 'Ders ders karşılaştırma · başarı %'), AnViz.bars({ rows: lr.map(r => ({ label: r.x.name, vals: [r.pa, r.pb, r.cb] })), series: [{ name: aName, c: 1 }, { name: bName, c: 2 }, { name: 'Sınıf ort. · B', color: 'var(--v0)' }], fmt: v => nf(v, 1) + '%', max: 100, min: 0, xFmt: v => v + '%', label: 'Öğrenci ders karşılaştırması' }),
      h('div', { class: 'tablewrap', style: { marginTop: '.5rem' } }, h('table', { class: 'an-table', id: 'ks-lessons' }, h('thead', null, h('tr', null, h('th', null, 'Ders'), ['A', 'B', 'Değişim', 'Sınıf A', 'Sınıf B', 'Sınıf değişimi', 'B\'de sınıfa göre'].map(x => h('th', { class: 'num' }, x)))),
        h('tbody', null, lr.map(r => h('tr', null, h('td', null, h('span', { class: 'vz-key vz-b' + r.x.slot }), ' ', r.x.name), h('td', { class: 'num', title: `${r.D[0] ?? ''}D ${r.D[1] ?? ''}Y ${r.D[2] ?? ''}B · net ${nf(r.na)}` }, ogP(r.pa)), h('td', { class: 'num', title: `${r.D2[0] ?? ''}D ${r.D2[1] ?? ''}Y ${r.D2[2] ?? ''}B · net ${nf(r.nb)}` }, ogP(r.pb)), h('td', { class: 'num', style: snHeat(r.d, 0, 15) }, r.d == null ? '' : ogSgn(r.d, 1, ' puan')), h('td', { class: 'num' }, ogP(r.ca)), h('td', { class: 'num' }, ogP(r.cb)), h('td', { class: 'num' }, r.dc == null ? '' : ogSgn(r.dc, 1, ' puan')), h('td', { class: 'num', style: snHeat(r.gap, 0, 15) }, r.gap == null ? '' : ogSgn(r.gap, 1, ' puan'))))))),
      h('p', { class: 'small muted' }, 'Sınıf sütunları öğrencinin sınıfının o sınavdaki ders ortalamasıdır. “B\'de sınıfa göre”: öğrencinin B sınavındaki ders başarısı ile sınıf ortalaması arasındaki fark (mavi: önünde, kırmızı: gerisinde). Ders karşılaştırması başarı yüzdesi üzerindendir.')));
  }
  if (rA && rB) pane.append(h('div', { class: 'card' }, h('h2', null, 'Doğru · yanlış · boş'), AnViz.cols({ cats: [{ label: 'A', sub: ksCut(A.name, 11), tip: `${A.name} · ${anFmtDate(A.date)}`, vals: [rA.D, rA.Y, rA.B] }, { label: 'B', sub: ksCut(B.name, 11), tip: `${B.name} · ${anFmtDate(B.date)}`, vals: [rB.D, rB.Y, rB.B] }], series: [{ name: 'Doğru', c: 1 }, { name: 'Yanlış', c: 2 }, { name: 'Boş', color: 'var(--v0)' }], stack: true, int: true, totals: true, label: 'Doğru yanlış boş' }), h('p', { class: 'small muted' }, `Sınavlardaki toplam soru sayısı: A ${A.totalQ}, B ${B.totalQ}.`)));
  ksLast = { file: `ogrenci-${no}-karsilastirma.xlsx`, sheets: () => {
    const out = [{ name: 'Özet', widths: [34, 70], rows: [[{ v: 'Öğrenci', s: 'b' }, name], [{ v: 'No', s: 'b' }, no], [{ v: 'Sınıf', s: 'b' }, sinif], [{ v: 'Ölçüt', s: 'b' }, ttl], [{ v: 'Sınav A', s: 'b' }, `${A.name} (${anFmtDate(A.date)})`], [{ v: 'Sınav B', s: 'b' }, `${B.name} (${anFmtDate(B.date)})`], [{ v: 'A', s: 'b' }, ogN2(vA)], [{ v: 'B', s: 'b' }, ogN2(vB)], [{ v: 'Değişim (B − A)', s: 'b' }, ogN2(d)], [{ v: 'Sınıf ort. A / B', s: 'b' }, `${MT.f(cA)} / ${MT.f(cB)}`], [{ v: 'Okul ort. A / B', s: 'b' }, `${MT.f(oA)} / ${MT.f(oB)}`], [], [{ v: 'Değerlendirme', s: 'b' }]].concat(notes.map(t => [null, t])) }];
    if (lr.length) out.push({ name: 'Dersler', rows: [ogHd(['Ders', 'A %', 'B %', 'Değişim (puan)', 'Sınıf A %', 'Sınıf B %', 'Sınıf değişimi', 'B\'de sınıfa göre'])].concat(lr.map(r => [r.x.name, ogN2(r.pa), ogN2(r.pb), ogN2(r.d), ogN2(r.ca), ogN2(r.cb), ogN2(r.dc), ogN2(r.gap)])), widths: [24, 10, 10, 14, 11, 11, 14, 16] });
    return out;
  } };
}

function karsExport() { const m = ksLast; if (!m) return toast('Önce bir öğrenci seçin', 'warn'); ogDownload(m.file, m.sheets()); }
ANTABS.push({ id: 'kars', label: 'Karşılaştır', filters: [], render: karsRender, export: karsExport });
