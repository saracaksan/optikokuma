/* analiz-okul.js — Okul sekmesi: tek okulun bütünü (sınıf ve öğrenci sekmelerinden ayrı).
 * Sınav sınav gelişim (ortalama, medyan, çeyrekler), katılım, sınıfların karşılaştırması, ders × sınıf, derslerin güçlü/zayıf yönleri,
 * başarı dağılımı (öğrenci ve sınav bazında), öne çıkanlar (en yüksek / dikkat edilecek / en çok gelişen ve gerileyen), otomatik değerlendirme, Excel ve yazdır.
 * Yardımcılar analiz-ogr.js / analiz-sinif.js'tedir; sekme ANTABS kayıt defterine eklenir. */
'use strict';

let okLast = null;
const okSort = a => a.filter(x => x != null && isFinite(x)).sort((x, y) => x - y);
const okQ = (a, q) => { const v = okSort(a); if (!v.length) return null; const p = (v.length - 1) * q, lo = Math.floor(p), hi = Math.ceil(p); return v[lo] + (v[hi] - v[lo]) * (p - lo); };
const okStd = a => { const v = okSort(a); if (v.length < 2) return null; const m = v.reduce((p, q) => p + q, 0) / v.length; return Math.sqrt(v.reduce((p, q) => p + (q - m) * (q - m), 0) / (v.length - 1)); };
/** Sıra sıra yüzde aralığı renkleri (açıktan koyuya, tek renk tonu): düşük başarı açık, yüksek başarı koyu. */
const OK_BAND_COLORS = ['#cfe1f7', '#9cc3ef', '#5c9ae0', '#2a78d6', '#17488a'];
/** Bir sınavın okul düzeyi özeti. rosterN: kayıtlı öğrenci sayısı. */
function okExamStat(n, rosterN, sc) {
  const rows = anRows(n), pcts = rows.map(r => ogPct(r.net, n.totalQ)).filter(v => v != null), nets = rows.map(r => r.net), pu = sc.ids.has(n.id) ? rows.map(r => r.puan) : [];
  const avg = ogMean(pcts), k = rows.length, bands = [0, 0, 0, 0, 0]; pcts.forEach(v => { bands[snBand(v)]++; });
  return { n, k, part: rosterN || k ? k / Math.max(rosterN, k) * 100 : null, avg, med: okQ(pcts, .5), q1: okQ(pcts, .25), q3: okQ(pcts, .75), max: pcts.length ? Math.max(...pcts) : null, min: pcts.length ? Math.min(...pcts) : null, std: okStd(pcts), net: ogMean(nets), puan: ogMean(pu), D: ogMean(rows.map(r => r.D)), Y: ogMean(rows.map(r => r.Y)), B: ogMean(rows.map(r => r.B)), bands };
}

function okulRender(pane, sel, ctx) {
  const exams = ogSorted(sel), roster = ogRoster(exams), classes = anClasses(exams), sc = snScale(exams), lm = snPresent(exams), nEx = exams.length, school = schoolByCode(AN.okul);
  const L = ogLbl(exams), S = ogSub(exams), F = ogFull(exams), rosterN = roster.size, all = snStudents(exams, roster), taken = all.filter(s => s.took > 0), ranked = snRank(taken, 'avg');
  const st = exams.map(n => okExamStat(n, rosterN, sc)), av = st.map(x => x.avg), li = snLastIdx(av), pi = li >= 0 ? snPrevIdx(av, li) : -1, slope = ogSlope(av), bi = snArgMax(av), wi = snArgMin(av), dL = li >= 0 && pi >= 0 ? av[li] - av[pi] : null;
  snPrintHead(pane, 'Okul analiz raporu');
  // --- sınıflar ve dersler (özet verileri)
  const cRows = classes.map(c => { const ps = exams.map(n => snGV(n, c, 'pct', sc)), rn = Array.from(roster.values()).filter(s => s.sinif === c).length, ts = taken.filter(s => s.sinif === c); return { sinif: c, n: rn, took: ts.length, ps, avg: ogMean(ps), part: ogMean(exams.map(n => (rn ? snRowsOf(n, c).length / rn * 100 : null))), les: lm.map(x => ogMean(exams.map(n => snLV(n, c, x.nk)))) }; });
  const cRank = cRows.filter(r => r.avg != null).sort((a, b) => b.avg - a.avg), oA = lm.map(x => ogMean(exams.map(n => snLV(n, '', x.nk)))), oPer = lm.map(x => exams.map(n => snLV(n, '', x.nk)));
  const hi60 = taken.filter(s => s.avg != null && s.avg >= 60).length, lo40 = taken.filter(s => s.avg != null && s.avg < 40).length, withGain = taken.filter(s => s.gain != null), up = withGain.filter(s => s.gain > .05).length, down = withGain.filter(s => s.gain < -.05).length;
  const lessRank = lm.map((x, i) => ({ x, i, v: oA[i], f: snFirstIdx(oPer[i]), l: snLastIdx(oPer[i]) })).filter(o => o.v != null);
  lessRank.forEach(o => { o.d = o.f >= 0 && o.l > o.f ? oPer[o.i][o.l] - oPer[o.i][o.f] : null; o.cBest = null; o.cWorst = null; const cv = cRows.map(r => ({ c: r.sinif, v: r.les[o.i] })).filter(q => q.v != null).sort((a, b) => b.v - a.v); if (cv.length) { o.cBest = cv[0]; o.cWorst = cv[cv.length - 1]; if (cv.length < 2) o.cWorst = null; } });

  // --- başlık + özet kutuları
  pane.append(h('div', { class: 'card og-head', id: 'ok-head' }, h('div', { class: 'row between' }, h('div', null, h('h2', { style: { marginBottom: '.1rem' } }, school ? school.okulAdi : 'Okul'), h('div', { class: 'small muted' }, `${nEx} sınav · ${rosterN} kayıtlı öğrenci · ${classes.length} sınıf`)), h('span', { class: 'pill ' + (taken.length >= rosterN ? 'ok' : 'warn') }, `${taken.length} öğrenci sınava girdi`)),
    h('div', { class: 'stats', style: { marginTop: '.7rem' } }, ogStat(ogP(ogMean(av)), 'ort. başarı', 'tüm seçili sınavlar'), ogStat(li >= 0 ? ogP(av[li]) : '', 'son sınav ort. başarı', dL != null ? `${dL > 0 ? '▲' : dL < 0 ? '▼' : '＝'} ${ogSgn(dL, 1, ' puan')} önceki sınava göre` : ''), ogStat(slope != null ? ogSgn(slope, 1, ' puan') : '', 'sınav başına değişim', ogTrendWord(slope)),
      ogStat(bi >= 0 ? ogP(av[bi]) : '', 'en iyi sınav', bi >= 0 ? exams[bi].name : ''), ogStat(ogMean(st.map(x => x.part)) != null ? '%' + nf(ogMean(st.map(x => x.part)), 0) : '', 'ort. katılım'), ogStat(taken.length ? '%' + nf(hi60 / taken.length * 100, 0) : '', 'ortalaması %60+ olan', `${hi60} öğrenci`), ogStat(taken.length ? '%' + nf(lo40 / taken.length * 100, 0) : '', 'ortalaması %40 altı', `${lo40} öğrenci`))));

  // --- değerlendirme
  const notes = [];
  if (li >= 0) { const f0 = snFirstIdx(av); notes.push(f0 !== li ? `Okul ortalama başarısı: ${ogP(av[f0])} → ${ogP(av[li])} (ilk sınavdan sonuncuya ${ogSgn(av[li] - av[f0], 1, ' puan')}); sınav başına ortalama değişim ${ogSgn(slope, 1, ' puan')} (${ogTrendWord(slope)}).` : `Okul ortalama başarısı ${ogP(av[li])} (tek sınav).`); }
  if (bi >= 0 && wi >= 0 && bi !== wi) notes.push(`En yüksek ortalama ${ogP(av[bi])} (${exams[bi].name}); en düşük ${ogP(av[wi])} (${exams[wi].name}).`);
  if (cRank.length > 1) notes.push(`Sınıflar: en yüksek ortalama ${cRank[0].sinif} (${ogP(cRank[0].avg)}), en düşük ${cRank[cRank.length - 1].sinif} (${ogP(cRank[cRank.length - 1].avg)}); aradaki fark ${nf(cRank[0].avg - cRank[cRank.length - 1].avg, 1)} puan.`);
  if (lessRank.length >= 2) { const byV = lessRank.slice().sort((a, b) => b.v - a.v); notes.push(`En güçlü ders: ${byV[0].x.name} (${ogP(byV[0].v)}); en zayıf ders: ${byV[byV.length - 1].x.name} (${ogP(byV[byV.length - 1].v)}).`); const byD = lessRank.filter(o => o.d != null).sort((a, b) => b.d - a.d); if (byD.length >= 2) { const a = byD[0], z = byD[byD.length - 1], bits = []; if (a.d >= 2) bits.push(`en çok yükselen ders ${a.x.name} (${ogSgn(a.d, 1, ' puan')})`); if (z.d <= -2) bits.push(`en çok düşen ders ${z.x.name} (${ogSgn(z.d, 1, ' puan')})`); if (bits.length) notes.push(bits.join('; ').replace(/^./, c => c.toLocaleUpperCase('tr')) + ' (ilk → son sınav).'); } }
  if (st.length) { const mp = st.filter(x => x.part != null); if (mp.length) { const lowP = mp.reduce((a, x) => (x.part < a.part ? x : a)); notes.push(`Ortalama katılım %${nf(ogMean(mp.map(x => x.part)), 0)}; en düşük katılım ${lowP.n.name} sınavında (%${nf(lowP.part, 0)}).`); } }
  if (taken.length) notes.push(`${taken.length} öğrenciden ${hi60} tanesinin (%${nf(hi60 / taken.length * 100, 0)}) ortalaması %60 ve üzerinde, ${lo40} tanesinin (%${nf(lo40 / taken.length * 100, 0)}) %40'ın altında.`);
  if (withGain.length) notes.push(`İlk ve son sınav arasında ilerlemesi ölçülebilen ${withGain.length} öğrenciden ${up} tanesi yükseldi, ${down} tanesi düştü.`);
  if (exams.some(n => n.totalQ !== exams[0].totalQ)) notes.push(`Not: sınavların soru sayıları farklı (${Array.from(new Set(exams.map(n => n.totalQ))).join(', ')}); karşılaştırmalar başarı yüzdesi üzerinden yapılır.`);
  snNote(pane, 'ok-notes', notes);

  // --- sınav sınav gelişim
  pane.append(h('div', { class: 'card' }, h('h2', null, 'Sınav sınav gelişim · başarı %'),
    AnViz.line({ labels: L, sub: S, full: F, label: 'Okul gelişimi', fmt: v => nf(v, 1) + '%', yFmt: v => nf(v, 0) + '%', floor: 0, ceil: 100, series: [{ name: 'Ortalama', c: 1, pts: av }, { name: 'Medyan', c: 2, dash: true, pts: st.map(x => x.med) }, { name: 'Üst çeyrek (%75)', c: 3, dash: true, pts: st.map(x => x.q3) }, { name: 'Alt çeyrek (%25)', c: 4, dash: true, pts: st.map(x => x.q1) }] }),
    h('p', { class: 'small muted' }, 'Üst / alt çeyrek: öğrencilerin dörtte biri bu değerin üstünde / altındadır; ortalamayla medyan arasındaki fark dağılımın çarpıklığını gösterir.')));
  const rowsEx = st.map((x, i) => { const p = i ? snPrevIdx(av, i) : -1, d = p >= 0 && av[i] != null ? av[i] - av[p] : null, n = x.n; return h('tr', null, h('td', { class: 'nowrap' }, anFmtDate(n.date)), h('td', null, n.name), h('td', null, badge({ ext: n.ext, kaynak: n.kaynak })), h('td', { class: 'num' }, n.totalQ), h('td', { class: 'num' }, `${x.k} / ${Math.max(rosterN, x.k)}`), h('td', { class: 'num' }, x.part == null ? '' : '%' + nf(x.part, 0)), h('td', { class: 'num' }, nf(x.net)), h('td', { class: 'num' }, x.puan == null ? '' : nf(x.puan, 1)), h('td', { class: 'num', style: snHeat(x.avg, ogMean(av)) }, h('b', null, ogP(x.avg))), h('td', { class: 'num' }, d == null ? '' : anDelta(d, 'pct')), h('td', { class: 'num' }, ogP(x.med)), h('td', { class: 'num' }, ogP(x.q3)), h('td', { class: 'num' }, ogP(x.q1)), h('td', { class: 'num' }, ogP(x.max)), h('td', { class: 'num' }, ogP(x.min)), h('td', { class: 'num' }, x.std == null ? '' : nf(x.std, 1))); });
  pane.append(h('div', { class: 'card' }, h('h2', null, 'Sınav sınav özet'), h('div', { class: 'tablewrap' }, h('table', { class: 'an-table', id: 'ok-exams' }, h('thead', null, h('tr', null, ['Tarih', 'Sınav', 'Kaynak'].map(x => h('th', null, x)), ['Soru', 'Katılan', 'Katılım', 'Ort. net', 'Ort. ' + sc.name.toLocaleLowerCase('tr'), 'Ort. başarı', 'Değişim', 'Medyan', 'Üst çeyrek', 'Alt çeyrek', 'En yüksek', 'En düşük', 'Std. sapma'].map(x => h('th', { class: 'num' }, x)))), h('tbody', null, rowsEx))),
    sc.mixed ? h('p', { class: 'small muted' }, `Puan türleri farklı (${sc.names.join(', ')}); puan sütununda yalnızca ${sc.name} sınavları gösterilir.`) : null));
  // --- katılım + D/Y/B
  pane.append(h('div', { class: 'sn-grid2' },
    h('div', { class: 'card' }, h('h2', null, 'Katılım'), AnViz.cols({ cats: st.map((x, i) => ({ label: L[i], sub: S[i], tip: `${F[i]} · ${x.k} / ${Math.max(rosterN, x.k)} öğrenci`, vals: [x.k, Math.max(0, rosterN - x.k)] })), series: [{ name: 'Katılan', c: 1 }, { name: 'Girmeyen', color: 'var(--v0)' }], stack: true, int: true, label: 'Okul katılımı' })),
    h('div', { class: 'card' }, h('h2', null, 'Ortalama doğru · yanlış · boş'), AnViz.cols({ cats: st.map((x, i) => ({ label: L[i], sub: S[i], tip: F[i] + ` · ${exams[i].totalQ} soru`, vals: [x.D, x.Y, x.B] })), series: [{ name: 'Doğru', c: 1 }, { name: 'Yanlış', c: 2 }, { name: 'Boş', color: 'var(--v0)' }], stack: true, fmt: v => nf(v, 1), label: 'Okul doğru yanlış boş' }))));

  // --- sınıfların karşılaştırması
  if (classes.length) {
    const opAll = exams.map(n => snGV(n, '', 'pct', sc)), clsAll = { sinif: 'Okul', n: rosterN, took: taken.length, ps: opAll, avg: ogMean(opAll), part: ogMean(st.map(x => x.part)), les: oA, all: true };
    const cc = [{ label: 'Sınıf', cell: r => h('td', null, h('b', null, r.sinif)) }, { label: 'Öğrenci', num: true, cell: r => h('td', { class: 'num' }, r.took === r.n ? r.n : `${r.took} / ${r.n}`) }, { label: 'Katılım', num: true, cell: r => h('td', { class: 'num' }, r.part == null ? '' : '%' + nf(r.part, 0)) }]
      .concat(exams.map((n, i) => ({ label: L[i], num: true, title: F[i], cell: r => snCell(r.ps[i], opAll[i]) })), [{ label: 'Ort.', num: true, cell: r => h('td', { class: 'num' }, h('b', null, ogP(r.avg))) }, { label: 'Son değ.', num: true, cell: r => { const a = snLastIdx(r.ps), b = a >= 0 ? snPrevIdx(r.ps, a) : -1; return h('td', { class: 'num' }, a >= 0 && b >= 0 ? anDelta(r.ps[a] - r.ps[b], 'pct') : ''); } }, { label: 'Gelişim', cell: r => h('td', null, anSpark(r.ps)) }]);
    pane.append(h('div', { class: 'card' }, h('h2', null, 'Sınıfların karşılaştırması · ortalama başarı %'),
      cRank.length ? AnViz.bars({ rows: cRank.map(r => ({ label: r.sinif, sub: `${r.took} öğrenci`, vals: [r.avg] })), series: [{ name: 'Sınıf ortalaması', c: 1 }], fmt: v => nf(v, 1) + '%', max: 100, min: 0, xFmt: v => v + '%', label: 'Sınıf ortalamaları' }) : null,
      h('h3', { class: 'og-h3' }, 'Sınıf × sınav'), snTable('ok-classes', cc, cRows.concat(clsAll), { onRow: r => { if (!r.all) { AN.cls = r.sinif; AN.tab = 'sinif'; ctx.draw(); window.scrollTo(0, 0); } }, cls: r => (r.all ? 'sn-all' : '') }),
      h('p', { class: 'small muted' }, 'Hücre rengi okul ortalamasından farktır (mavi: üstünde, kırmızı: altında). Bir sınıfa tıklayınca Sınıf sekmesinde ayrıntısı açılır.')));
    if (lm.length) pane.append(h('div', { class: 'card' }, h('h2', null, 'Sınıf × ders · ortalama başarı %'), h('div', { class: 'tablewrap' }, h('table', { class: 'an-table', id: 'ok-matrix' }, h('thead', null, h('tr', null, h('th', null, 'Sınıf'), lm.map(x => h('th', { class: 'num' }, x.name)), h('th', { class: 'num' }, 'Genel'))),
      h('tbody', null, cRows.map(r => h('tr', { class: 'an-row', onclick: () => { AN.cls = r.sinif; AN.tab = 'sinif'; ctx.draw(); window.scrollTo(0, 0); } }, h('td', null, h('b', null, r.sinif)), r.les.map((v, i) => snCell(v, oA[i])), h('td', { class: 'num' }, h('b', null, ogP(r.avg))))),
        h('tr', { class: 'sn-all' }, h('td', null, 'Okul'), oA.map(v => h('td', { class: 'num' }, ogP(v))), h('td', { class: 'num' }, ogP(ogMean(av))))))),
      h('p', { class: 'small muted' }, 'Hücre rengi dersin okul ortalamasından farktır; koyu mavi o dersteki en güçlü, kırmızı en zayıf sınıfı gösterir.')));
  }

  // --- dersler
  if (lessRank.length) {
    const ordL = lessRank.slice().sort((a, b) => b.v - a.v);
    pane.append(h('div', { class: 'card' }, h('h2', null, 'Derslerin güçlü ve zayıf yönleri · ortalama başarı %'), AnViz.bars({ rows: ordL.map(o => ({ label: o.x.name, vals: [o.v] })), series: [{ name: 'Okul', c: 1 }], fmt: v => nf(v, 1) + '%', max: 100, min: 0, xFmt: v => v + '%', label: 'Ders başarıları' }),
      h('h3', { class: 'og-h3' }, 'Ders başarısının sınavlara göre gidişi'), AnViz.line({ labels: L, sub: S, full: F, label: 'Ders gidişi', fmt: v => nf(v, 1) + '%', yFmt: v => nf(v, 0) + '%', floor: 0, ceil: 100, missText: 'bu sınavda yok', series: lm.slice(0, 8).map((x, i) => ({ name: x.name, c: x.slot, pts: oPer[i] })) }),
      h('h3', { class: 'og-h3' }, 'Ders özeti'), h('div', { class: 'tablewrap' }, h('table', { class: 'an-table', id: 'ok-lessons' }, h('thead', null, h('tr', null, h('th', null, 'Ders'), ['Ort. başarı', 'İlk → son', 'En iyi sınıf', 'En düşük sınıf', 'Gidiş'].map(x => h('th', { class: x === 'Gidiş' ? '' : 'num' }, x)))),
        h('tbody', null, ordL.map(o => h('tr', null, h('td', null, h('span', { class: 'vz-key vz-b' + o.x.slot }), ' ', o.x.name), h('td', { class: 'num' }, h('b', null, ogP(o.v))), h('td', { class: 'num', style: o.d != null ? snHeat(o.d, 0, 15) : null }, o.d == null ? '' : ogSgn(o.d, 1, ' puan')), h('td', { class: 'num' }, o.cBest ? `${o.cBest.c} ${ogP(o.cBest.v)}` : ''), h('td', { class: 'num' }, o.cWorst ? `${o.cWorst.c} ${ogP(o.cWorst.v)}` : ''), h('td', null, anSpark(oPer[o.i]))))))),
      h('p', { class: 'small muted' }, '“İlk → son”: dersin ilk ve son geçtiği sınav arasındaki okul ortalaması farkı (yüzde puan).')));
  }

  // --- dağılım
  const byCls = classes.length > 1, bd = snBandsOf(taken.map(s => [s.avg, s.sinif]), byCls, classes);
  pane.append(h('div', { class: 'card' }, h('h2', null, 'Başarı dağılımı'), h('h3', { class: 'og-h3' }, 'Öğrencilerin ortalama başarı % aralıkları'), AnViz.cols({ cats: bd.cats, series: bd.series, stack: byCls, int: true, label: 'Başarı dağılımı' }),
    h('h3', { class: 'og-h3' }, 'Sınav sınav dağılım (öğrenci sayısı)'), AnViz.cols({ cats: st.map((x, i) => ({ label: L[i], sub: S[i], tip: F[i] + ` · ${x.k} öğrenci`, vals: x.bands.slice() })), series: SN_BANDS.map((b, i) => ({ name: '%' + b, color: OK_BAND_COLORS[i] })), stack: true, int: true, label: 'Sınav sınav dağılım' }),
    h('p', { class: 'small muted' }, 'Koyu renk yüksek başarıyı gösterir; sütunların koyu kısmı büyüdükçe sınav daha başarılı geçmiştir.' + (byCls && classes.length > 8 ? ' Üstteki grafikte ilk 8 sınıf gösteriliyor.' : ''))));

  // --- öne çıkanlar
  const baseCols = snStuCols({ cls: true, nEx }).concat([{ label: 'Ort. başarı', num: true, cell: s => h('td', { class: 'num' }, h('b', null, ogP(s.avg))) }, { label: 'Gelişim', cell: s => h('td', null, anSpark(s.pct)) }]);
  const top = ranked.slice(0, 10), bottom = ranked.slice().reverse().slice(0, 10);
  if (taken.length) pane.append(h('div', { class: 'sn-grid2' }, h('div', { class: 'card' }, h('h2', null, 'Ortalamada ilk 10 öğrenci'), snTable('ok-top', baseCols, top, { onRow: s => ctx.openStudent(s.no) })), h('div', { class: 'card' }, h('h2', null, 'Ortalaması en düşük 10 öğrenci'), snTable('ok-bottom', baseCols, bottom, { onRow: s => ctx.openStudent(s.no) }))));
  const gainers = withGain.slice().sort((a, b) => b.gain - a.gain).filter(s => s.gain > 0).slice(0, 8), losers = withGain.slice().sort((a, b) => a.gain - b.gain).filter(s => s.gain < 0).slice(0, 8);
  const gcols = [{ label: 'Ö.No', cell: s => h('td', { class: 'nowrap' }, s.no) }, { label: 'Ad Soyad', cell: s => h('td', null, s.ad || '(adı yok)') }, { label: 'Sınıf', cell: s => h('td', null, s.sinif) }, { label: 'İlk', num: true, cell: s => h('td', { class: 'num' }, ogP(s.first)) }, { label: 'Son', num: true, cell: s => h('td', { class: 'num' }, ogP(s.last)) }, { label: 'Değişim', num: true, cell: s => h('td', { class: 'num' }, anDelta(s.gain, 'pct')) }, { label: 'Gelişim', cell: s => h('td', null, anSpark(s.pct)) }];
  if (withGain.length) pane.append(h('div', { class: 'sn-grid2' }, h('div', { class: 'card' }, h('h2', null, 'En çok gelişen öğrenciler (ilk → son)'), gainers.length ? snTable('ok-gain', gcols, gainers, { onRow: s => ctx.openStudent(s.no) }) : h('div', { class: 'muted small' }, 'Yükselen öğrenci yok.')), h('div', { class: 'card' }, h('h2', null, 'Dikkat: en çok gerileyen öğrenciler (ilk → son)'), losers.length ? snTable('ok-loss', gcols, losers, { onRow: s => ctx.openStudent(s.no) }) : h('div', { class: 'muted small' }, 'Gerileyen öğrenci yok.'))));
  okLast = { exams, st, cRows, lm, oA, oPer, lessRank, taken: ranked, all, nEx, notes, school, rosterN, classes, hi60, lo40, up, down, av };
}

function okulExport(sel, ctx) {
  const m = okLast; if (!m) return; const { exams, st, cRows, lm, oA, lessRank, taken, nEx, notes, school, rosterN, av } = m;
  const ozet = { name: 'Özet', widths: [30, 70], rows: [[{ v: 'Okul', s: 'b' }, school ? school.okulAdi : ''], [{ v: 'Sınav sayısı', s: 'b' }, nEx], [{ v: 'Kayıtlı öğrenci', s: 'b' }, rosterN], [{ v: 'Sınava giren öğrenci', s: 'b' }, taken.length], [{ v: 'Ortalama başarı %', s: 'b' }, ogN2(ogMean(av))], [], [{ v: 'Değerlendirme', s: 'b' }]].concat(notes.map(t => [null, t])) };
  const ex = [ogHd(['Tarih', 'Sınav', 'Kaynak', 'Soru', 'Katılan', 'Kayıtlı', 'Katılım %', 'Ort. net', 'Ort. puan', 'Ort. başarı %', 'Medyan %', 'Üst çeyrek %', 'Alt çeyrek %', 'En yüksek %', 'En düşük %', 'Std. sapma', 'Ort. D', 'Ort. Y', 'Ort. B', ...SN_BANDS.map(b => '%' + b + ' aralığı (öğrenci)')])].concat(st.map(x => [anFmtDate(x.n.date), x.n.name, x.n.ext ? 'Dış · ' + x.n.kaynak : 'Sistem', x.n.totalQ, x.k, Math.max(rosterN, x.k), ogN2(x.part), ogN2(x.net), ogN2(x.puan), ogN2(x.avg), ogN2(x.med), ogN2(x.q3), ogN2(x.q1), ogN2(x.max), ogN2(x.min), ogN2(x.std), ogN2(x.D), ogN2(x.Y), ogN2(x.B), ...x.bands]));
  const cl = [ogHd(['Sınıf', 'Kayıtlı öğrenci', 'Sınava giren', 'Katılım %', ...exams.map(n => n.name + ' (ort. %)'), 'Ort. %', ...lm.map(x => x.name + ' (ort. %)')])].concat(cRows.map(r => [r.sinif, r.n, r.took, ogN2(r.part), ...r.ps.map(ogN2), ogN2(r.avg), ...r.les.map(ogN2)]));
  const ds = [ogHd(['Ders', 'Ort. başarı %', 'İlk → son (puan)', 'En iyi sınıf', 'En iyi sınıf %', 'En düşük sınıf', 'En düşük sınıf %'])].concat(lessRank.slice().sort((a, b) => b.v - a.v).map(o => [o.x.name, ogN2(o.v), ogN2(o.d), o.cBest ? o.cBest.c : '', o.cBest ? ogN2(o.cBest.v) : null, o.cWorst ? o.cWorst.c : '', o.cWorst ? ogN2(o.cWorst.v) : null]));
  const stu = [ogHd(['Sıra', 'Ö.No', 'Ad Soyad', 'Sınıf', 'Girdiği sınav', ...exams.map(n => n.name + ' (%)'), 'Ort. başarı %', 'İlk → son (puan)'])].concat(taken.map(s => [s.rank, s.no, s.ad, s.sinif, `${s.took} / ${nEx}`, ...s.pct.map(ogN2), ogN2(s.avg), ogN2(s.gain)]));
  ogDownload(`okul-analizi-${((school && school.okulAdi) || 'okul').replace(/[^\w-]+/g, '_').slice(0, 40)}.xlsx`, [ozet, { name: 'Sınav sınav', rows: ex, freeze: { row: 1, col: 2 } }, { name: 'Sınıflar', rows: cl, freeze: { row: 1, col: 1 } }, { name: 'Dersler', rows: ds, freeze: { row: 1 } }, { name: 'Öğrenciler', rows: stu, freeze: { row: 1, col: 3 } }]);
}
ANTABS.push({ id: 'okul', label: 'Okul', filters: [], render: okulRender, export: okulExport });
