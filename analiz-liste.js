/* analiz-liste.js — Başarı listeleri sekmesi (Analiz → Başarı listeleri).
 * Genel sıralama, ders sıralaması, en çok gelişen / gerileyen, dikkat edilecekler, katılım matrisi, sınav birincileri.
 * Ortak yardımcılar analiz-ogr.js ve analiz-sinif.js'tedir. Her liste Excel'e aktarılabilir ve yazdırılabilir. */
'use strict';

AN.ls = 'genel'; AN.lsMetric = 'pct'; AN.lsMin = 1; AN.lsThr = 40; AN.lsLesson = '';
let lsLast = null;
const LS_TYPES = [['genel', 'Genel sıralama'], ['ders', 'Ders sıralaması'], ['gelisim', 'Gelişenler / gerileyenler'], ['dikkat', 'Dikkat edilecekler'], ['katilim', 'Katılım'], ['ilk3', 'Sınav birincileri']];
const lsTrim = s => String(s == null ? '' : s).replace(/[^\w-]+/g, '_');

/** Sıra ve sınıf sırası (sınıf içindeki sıra) hesaplar: key alanına göre; list sıralı döner. */
function lsRanks(list, key) {
  const v = snRank(list, key, 'rank'), by = new Map(); list.forEach(s => { if (s[key] != null) (by.get(s.sinif) || by.set(s.sinif, []).get(s.sinif)).push(s); });
  by.forEach(a => snRank(a, key, 'crank')); return v;
}
function lsRender(pane, sel, ctx) {
  const exams = ogSorted(sel), roster = ogRoster(exams), classes = anClasses(exams), sc = snScale(exams), all = snStudents(exams, roster), nEx = exams.length;
  if (AN.cls && !classes.includes(AN.cls)) AN.cls = '';
  if (AN.lsMin > nEx) AN.lsMin = 1;
  const cur = AN.cls, grp = all.filter(s => !cur || s.sinif === cur), taken = grp.filter(s => s.took > 0), lm = snPresent(exams), L = ogLbl(exams), F = ogFull(exams), name = cur ? cur + ' sınıfı' : 'Tüm okul';
  if (!AN.lsLesson || !lm.some(x => x.nk === AN.lsLesson)) AN.lsLesson = lm.length ? lm[0].nk : '';
  const clsSel = h('select', { id: 'ls-cls', onchange: e => { AN.cls = e.target.value; ctx.renderTab(); } }, h('option', { value: '' }, 'Tüm okul'), classes.map(c => h('option', { value: c }, c + ' sınıfı'))); clsSel.value = cur;
  const extra = [];
  if (AN.ls === 'genel') {
    extra.push(h('span', { class: 'small muted' }, 'Ölçüt'), ogSeg(Object.keys(OG_MET).map(k => [k, OG_MET[k].l]), AN.lsMetric, k => { AN.lsMetric = k; ctx.renderTab(); }));
  }
  if (AN.ls === 'genel' || AN.ls === 'gelisim') {
    const mn = h('select', { id: 'ls-min', onchange: e => { AN.lsMin = +e.target.value; ctx.renderTab(); } }, Array.from({ length: nEx }, (_, i) => h('option', { value: i + 1 }, `En az ${i + 1} sınav`))); mn.value = String(AN.lsMin); extra.push(mn);
  }
  if (AN.ls === 'ders' && lm.length) { const ls = h('select', { id: 'ls-les', onchange: e => { AN.lsLesson = e.target.value; ctx.renderTab(); } }, lm.map(x => h('option', { value: x.nk }, x.name))); ls.value = AN.lsLesson; extra.push(h('span', { class: 'small muted' }, 'Ders'), ls); }
  if (AN.ls === 'dikkat') { extra.push(h('span', { class: 'small muted' }, 'Başarı sınırı %'), h('input', { type: 'number', id: 'ls-thr', min: 0, max: 100, step: 5, value: AN.lsThr, style: { width: '5.5rem' }, onchange: e => { const v = parseFloat(e.target.value); AN.lsThr = isFinite(v) ? Math.max(0, Math.min(100, v)) : 40; ctx.renderTab(); } })); }
  pane.append(h('div', { class: 'card no-print' }, ogSeg(LS_TYPES, AN.ls, k => { AN.ls = k; ctx.renderTab(); }, 'ls-seg'), h('div', { class: 'row an-f', style: { marginTop: '.6rem' } }, h('b', null, 'Sınıf'), clsSel, extra)));
  snPrintHead(pane, name + ' · ' + (LS_TYPES.find(t => t[0] === AN.ls) || [])[1]);
  const open = s => ctx.openStudent(s.no), spark = s => h('td', null, anSpark(s.pct)), noCols = snStuCols({ cls: !cur, nEx }), sheets = [];
  const stuHead = ['Ö.No', 'Ad Soyad', 'Sınıf'], stuRow = s => [s.no, s.ad, s.sinif];
  const card = (title, body, note) => pane.append(h('div', { class: 'card' }, h('h2', null, title), body, note ? h('p', { class: 'small muted' }, note) : null));
  const cRankCol = !cur && classes.length > 1 ? [{ label: 'Sınıf sırası', num: true, cell: s => h('td', { class: 'num' }, s.crank == null ? '' : s.crank) }] : [];

  if (AN.ls === 'genel') {
    const M = AN.lsMetric, key = '_m'; const list = taken.filter(s => s.took >= AN.lsMin); list.forEach(s => { s[key] = M === 'pct' ? s.avg : M === 'net' ? s.avgNet : s.avgPuan; });
    const rows = lsRanks(list, key), fm = OG_MET[M].f, last = s => s.last;
    const cols = noCols.concat(cRankCol, [{ label: 'Ort. ' + OG_MET[M].l + (M === 'puan' ? ' (' + sc.name + ')' : ''), num: true, cell: s => h('td', { class: 'num' }, h('b', null, s[key] == null ? '' : fm(s[key]))) }, { label: 'En yüksek %', num: true, cell: s => h('td', { class: 'num' }, ogP(s.max)) }, { label: 'Son sınav %', num: true, cell: s => h('td', { class: 'num' }, ogP(last(s))) }, { label: 'Son değ.', num: true, cell: s => h('td', { class: 'num' }, s.dLast == null ? '' : anDelta(s.dLast, 'pct')) }, { label: 'Gelişim', cell: spark }]);
    card('Genel başarı sıralaması · ' + name, snTable('ls-table', cols, rows, { onRow: open, limit: 500 }), 'Girdiği sınavların ortalamasına göre sıralanır; girmediği sınavlar ortalamaya katılmaz' + (M === 'puan' && sc.mixed ? `. Puan türleri farklı olduğu için yalnızca ${sc.name} sınavları hesaba katıldı` : '') + (AN.lsMin > 1 ? `. En az ${AN.lsMin} sınava giren öğrenciler gösterilir` : '') + '.');
    sheets.push({ name: 'Genel sıralama', rows: [ogHd(['Sıra', ...stuHead, 'Girdiği sınav', 'Sınıf sırası', 'Ort. ' + OG_MET[M].l, 'En yüksek %', 'Son sınav %', 'Son değişim (puan)'])].concat(rows.map(s => [s.rank, ...stuRow(s), `${s.took} / ${nEx}`, s.crank, ogN2(s[key]), ogN2(s.max), ogN2(s.last), ogN2(s.dLast)])) });
  } else if (AN.ls === 'ders') {
    const x = lm.find(o => o.nk === AN.lsLesson);
    if (!x) { pane.append(h('div', { class: 'empty card' }, 'Seçili sınavlarda ders bilgisi yok.')); return; }
    const list = taken.filter(s => s.lavg.get(x.nk) != null); list.forEach(s => { s._v = s.lavg.get(x.nk); });
    const rows = lsRanks(list, '_v'), cols = noCols.filter(c => c.label !== 'Sınav').concat(cRankCol, [{ label: x.name + ' ort. %', num: true, cell: s => h('td', { class: 'num' }, h('b', null, ogP(s._v))) }, { label: 'Son sınav %', num: true, cell: s => { const a = s.lp.get(x.nk) || [], i = snLastIdx(a); return h('td', { class: 'num' }, i >= 0 ? ogP(a[i]) : ''); } }, { label: 'Gelişim', cell: s => h('td', null, anSpark(s.lp.get(x.nk) || [])) }]);
    card(x.name + ' sıralaması · ' + name, snTable('ls-table', cols, rows, { onRow: open, limit: 500 }), 'Öğrencinin girdiği sınavlardaki ' + x.name + ' başarı yüzdesinin ortalamasına göre sıralanır.');
    sheets.push({ name: x.name.slice(0, 28) + ' sıralaması', rows: [ogHd(['Sıra', ...stuHead, 'Sınıf sırası', x.name + ' ort. %', ...exams.map(n => n.name + ' (%)')])].concat(rows.map(s => [s.rank, ...stuRow(s), s.crank, ogN2(s._v), ...(s.lp.get(x.nk) || []).map(ogN2)])) });
  } else if (AN.ls === 'gelisim') {
    const list = taken.filter(s => s.took >= Math.max(2, AN.lsMin) && s.gain != null), up = list.filter(s => s.gain > 0).sort((a, b) => b.gain - a.gain).slice(0, 15), dn = list.filter(s => s.gain < 0).sort((a, b) => a.gain - b.gain).slice(0, 15);
    const cols = [{ label: 'Ö.No', cell: s => h('td', { class: 'nowrap' }, s.no) }, { label: 'Ad Soyad', cell: s => h('td', null, s.ad || '(adı yok)') }].concat(!cur ? [{ label: 'Sınıf', cell: s => h('td', null, s.sinif) }] : [], [{ label: 'İlk %', num: true, cell: s => h('td', { class: 'num' }, ogP(s.first)) }, { label: 'Son %', num: true, cell: s => h('td', { class: 'num' }, ogP(s.last)) }, { label: 'Fark', num: true, cell: s => h('td', { class: 'num' }, anDelta(s.gain, 'pct')) }, { label: 'Eğilim', num: true, title: 'Sınav başına ortalama değişim (puan)', cell: s => h('td', { class: 'num' }, ogSgn(s.slope, 1)) }, { label: 'Gelişim', cell: spark }]);
    if (!list.length) pane.append(h('div', { class: 'empty card' }, 'Gelişimi görmek için öğrencinin en az iki sınava girmiş olması gerekir.'));
    else {
      pane.append(h('div', { class: 'sn-grid2' }, h('div', { class: 'card' }, h('h2', null, 'En çok gelişenler'), up.length ? snTable('ls-up', cols, up, { onRow: open }) : h('div', { class: 'muted small' }, 'Gelişen öğrenci yok.')), h('div', { class: 'card' }, h('h2', null, 'En çok gerileyenler'), dn.length ? snTable('ls-down', cols, dn, { onRow: open }) : h('div', { class: 'muted small' }, 'Gerileyen öğrenci yok.'))),
        h('p', { class: 'small muted' }, 'Fark, öğrencinin girdiği ilk ve son sınavın başarı yüzdesi arasındaki farktır (yüzde puan); farklı soru sayılı sınavlar bu yüzden kıyaslanabilir.'));
    }
    const mk = a => a.map(s => [...stuRow(s), ogN2(s.first), ogN2(s.last), ogN2(s.gain), ogN2(s.slope)]), hd = ogHd([...stuHead, 'İlk sınav %', 'Son sınav %', 'Fark (puan)', 'Sınav başına değişim']);
    sheets.push({ name: 'En çok gelişenler', rows: [hd].concat(mk(up)) }, { name: 'En çok gerileyenler', rows: [hd].concat(mk(dn)) });
  } else if (AN.ls === 'dikkat') {
    const thr = AN.lsThr, out = [];
    grp.forEach(s => {
      const why = [], idx = s.pct.map((v, i) => (v != null ? i : -1)).filter(i => i >= 0), vals = idx.map(i => s.pct[i]);
      if (s.took === 0) why.push('Hiçbir sınava girmedi');
      else {
        if (s.avg != null && s.avg < thr) why.push(`Ortalama ${ogP(s.avg)} (sınır %${nf(thr, 0)})`);
        if (s.last != null && s.last < thr && !(s.avg != null && s.avg < thr)) why.push(`Son sınav ${ogP(s.last)} (sınır %${nf(thr, 0)})`);
        let streak = 0; for (let k = vals.length - 1; k > 0 && vals[k] < vals[k - 1] - 0.05; k--) streak++;
        if (streak >= 2) why.push(`${streak} sınavdır düşüyor (${ogP(vals[vals.length - 1 - streak])} → ${ogP(vals[vals.length - 1])})`);
        if (s.dLast != null && s.dLast <= -10) why.push(`Son sınavda ${nf(Math.abs(s.dLast), 1)} puan düştü`);
        const miss = exams.filter((n, i) => s.pct[i] == null); if (miss.length) why.push(`${miss.length} sınava girmedi (${miss.slice(0, 3).map(n => n.name).join(', ')}${miss.length > 3 ? '…' : ''})`);
      }
      if (why.length) out.push({ s, why });
    });
    out.sort((a, b) => b.why.length - a.why.length || (a.s.avg == null ? -1 : b.s.avg == null ? 1 : a.s.avg - b.s.avg));
    const count = f => out.filter(o => o.why.some(w => w.startsWith(f))).length;
    pane.append(h('div', { class: 'card' }, h('div', { class: 'stats', id: 'ls-dik-sum' }, ogStat(out.length, 'öğrenci dikkat listesinde', `${grp.length} öğrenciden`), ogStat(count('Ortalama'), `ortalaması %${nf(thr, 0)} altında`), ogStat(count('Son sınav'), 'son sınavı sınırın altında'), ogStat(count('Son sınavda'), 'son sınavda 10+ puan düştü'), ogStat(count('Hiçbir') + out.filter(o => o.why.some(w => /sınava girmedi/.test(w))).length, 'sınava girmeyen / eksik girenler'))));
    const cols = [{ label: 'Ö.No', cell: o => h('td', { class: 'nowrap' }, o.s.no) }, { label: 'Ad Soyad', cell: o => h('td', null, o.s.ad || '(adı yok)') }].concat(!cur ? [{ label: 'Sınıf', cell: o => h('td', null, o.s.sinif) }] : [], [{ label: 'Neden', cell: o => h('td', null, h('ul', { class: 'ls-why' }, o.why.map(w => h('li', null, w)))) }, { label: 'Ort. %', num: true, cell: o => h('td', { class: 'num' }, ogP(o.s.avg)) }, { label: 'Son %', num: true, cell: o => h('td', { class: 'num' }, ogP(o.s.last)) }, { label: 'Gelişim', cell: o => h('td', null, anSpark(o.s.pct)) }]);
    card('Dikkat edilecek öğrenciler · ' + name, out.length ? snTable('ls-table', cols.map(c => c), out.map(o => Object.assign(o, { no: o.s.no })), { onRow: o => open(o.s), limit: 500 }) : h('div', { class: 'muted' }, 'Bu ölçütlere uyan öğrenci yok.'), 'Ölçütler: ortalama ya da son sınav başarısı sınırın altında, art arda iki ya da daha fazla düşüş, son sınavda 10 puan ve üzeri düşüş, girmediği sınavlar. Satıra tıklayınca öğrencinin ayrıntısı açılır.');
    sheets.push({ name: 'Dikkat edilecekler', rows: [ogHd([...stuHead, 'Neden', 'Ort. %', 'Son sınav %'])].concat(out.map(o => [...stuRow(o.s), o.why.join('; '), ogN2(o.s.avg), ogN2(o.s.last)])) });
  } else if (AN.ls === 'katilim') {
    const rows = grp.slice().sort((a, b) => (a.took - b.took) || String(a.sinif).localeCompare(String(b.sinif), 'tr', { numeric: true }) || String(a.ad).localeCompare(String(b.ad), 'tr'));
    const cols = [{ label: 'Ö.No', cell: s => h('td', { class: 'nowrap' }, s.no) }, { label: 'Ad Soyad', cell: s => h('td', null, s.ad || '(adı yok)') }].concat(!cur ? [{ label: 'Sınıf', cell: s => h('td', null, s.sinif) }] : [],
      exams.map((n, i) => ({ label: L[i], num: true, title: F[i], cell: s => h('td', { class: 'num ' + (s.pct[i] == null ? 'ls-miss' : 'ls-ok') }, s.pct[i] == null ? '–' : '✓') })), [{ label: 'Girdiği', num: true, cell: s => h('td', { class: 'num' }, h('b', null, `${s.took} / ${nEx}`)) }]);
    const per = exams.map(n => snRowsOf(n, cur).length);
    card('Katılım matrisi · ' + name, snTable('ls-table', cols, rows, { onRow: open, limit: 500 }), 'Katılan öğrenci sayıları: ' + exams.map((n, i) => `${L[i]} → ${per[i]}`).join(' · ') + '. Eksik girenler listenin başında.');
    sheets.push({ name: 'Katılım', rows: [ogHd([...stuHead, ...exams.map(n => n.name), 'Girdiği sınav'])].concat(rows.map(s => [...stuRow(s), ...s.pct.map(v => (v == null ? 'Girmedi' : 'Girdi')), `${s.took} / ${nEx}`])) });
  } else if (AN.ls === 'ilk3') {
    const top3 = (n, sinif) => snRowsOf(n, sinif).filter(r => ogKey(r, -1) != null).sort((a, b) => ogKey(b, -1) - ogKey(a, -1)).slice(0, 3);
    const lab = (r, n) => { const v = ogKey(r, -1); return [r.ad || r.no, h('span', { class: 'small muted' }, ` ${nf(v, n.puanAdi && r.puan != null ? 1 : 2)}${!cur ? ' · ' + r.sinif : ''}`)]; };
    card('Sınav birincileri · ' + name, h('div', { class: 'tablewrap' }, h('table', { class: 'an-table', id: 'ls-table' }, h('thead', null, h('tr', null, h('th', null, 'Tarih'), h('th', null, 'Sınav'), h('th', null, '1.'), h('th', null, '2.'), h('th', null, '3.'))),
      h('tbody', null, exams.map(n => { const t = top3(n, cur); return h('tr', { class: 'an-row', onclick: () => { const r = t[0]; if (r) ctx.openStudent(r.no); } }, h('td', { class: 'nowrap' }, anFmtDate(n.date)), h('td', null, n.name), [0, 1, 2].map(k => h('td', null, t[k] ? lab(t[k], n) : ''))); })))), 'Sıralama, sınavın puanına (yoksa nete) göredir; yanındaki değer puan ya da nettir.');
    sheets.push({ name: 'Sınav birincileri', rows: [ogHd(['Tarih', 'Sınav', '1.', '1. değer', '2.', '2. değer', '3.', '3. değer'])].concat(exams.map(n => { const t = top3(n, cur); return [anFmtDate(n.date), n.name, ...[0, 1, 2].flatMap(k => (t[k] ? [(t[k].ad || t[k].no) + (cur ? '' : ' (' + t[k].sinif + ')'), ogN2(ogKey(t[k], -1))] : ['', null]))]; })) });
    if (!cur && classes.length > 1) {
      card('Sınıf birincileri', h('div', { class: 'tablewrap' }, h('table', { class: 'an-table', id: 'ls-cls-table' }, h('thead', null, h('tr', null, h('th', null, 'Sınav'), classes.map(c => h('th', null, c)))),
        h('tbody', null, exams.map(n => h('tr', null, h('td', null, n.name), classes.map(c => { const t = top3(n, c)[0]; return h('td', null, t ? lab(t, n) : ''); })))))));
      sheets.push({ name: 'Sınıf birincileri', rows: [ogHd(['Sınav', ...classes])].concat(exams.map(n => [n.name, ...classes.map(c => { const t = top3(n, c)[0]; return t ? (t.ad || t.no) + ' (' + nf(ogKey(t, -1), 2) + ')' : ''; })])) });
    }
  }
  lsLast = { sheets, name: lsTrim((LS_TYPES.find(t => t[0] === AN.ls) || [])[1] || 'liste') + '-' + lsTrim(cur || 'okul') };
}
function lsExport() { if (!lsLast || !lsLast.sheets.length) { toast('Aktarılacak liste yok', 'warn'); return; } ogDownload(`basari-listesi-${lsLast.name}.xlsx`, lsLast.sheets); }
ANTABS.push({ id: 'listeler', label: 'Başarı listeleri', filters: [], render: lsRender, export: lsExport });
