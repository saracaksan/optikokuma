/* analiz-ogr.js — Öğrenci bazlı analiz (Analiz → Öğrenci) ve sınıf/ders/liste sekmelerinin ortak yardımcıları.
 * Bir öğrencinin numarası ya da adı yazılınca: girdiği / girmediği sınavlar, net · puan · başarı % gelişimi (sınıf ve okul ortalamasıyla),
 * ders ders başarı ve ders sıraları, genel / sınıf / okul sıraları, sınav × ders tablosu, otomatik değerlendirme, yazdır ve Excel. */
'use strict';

AN.stuMetric = 'pct';

/* ---------------------------------------------------------------- ortak yardımcılar (analiz-sinif.js de kullanır) */
const ogMean = a => { const v = a.filter(x => x != null && isFinite(x)); return v.length ? v.reduce((p, q) => p + q, 0) / v.length : null; };
const ogSorted = ex => ex.slice().sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999') || a.name.localeCompare(b.name, 'tr'));
const ogPct = (net, q) => (q && net != null ? net / q * 100 : null);
const ogP = v => (v == null ? '–' : '%' + nf(v, 1));
const ogSgn = (v, d, suf) => (v == null ? '' : (v > 0 ? '+' : v < 0 ? '−' : '') + nf(Math.abs(v), d == null ? 1 : d) + (suf || ''));
const ogLbl = ex => ex.map(n => anFmtDate(n.date).slice(0, 5)), ogSub = ex => ex.map(n => n.name), ogFull = ex => ex.map(n => n.name + ' · ' + anFmtDate(n.date) + (n.ext ? ' · ' + n.kaynak : ''));
/** En küçük kareler eğimi (sınav başına değişim); en az iki değer gerekir. */
function ogSlope(vals) {
  const v = vals.filter(x => x != null && isFinite(x)), n = v.length; if (n < 2) return null;
  let sx = 0, sy = 0, sxy = 0, sxx = 0; v.forEach((y, x) => { sx += x; sy += y; sxy += x * y; sxx += x * x; }); const den = n * sxx - sx * sx; return den ? (n * sxy - sx * sy) / den : null;
}
/** Tüm yüklü sınavlardaki ders adları (ilk görülme sırasıyla); renk yuvası derse sabit bağlıdır. */
function ogLessonMap() {
  const m = new Map(); ogSorted(Array.from(AN.data.values())).forEach(n => n.lessons.forEach(l => { const k = anNk(l.name); if (!m.has(k)) m.set(k, { nk: k, name: l.name, slot: Math.min(m.size + 1, 8) }); })); return m;
}
const ogLi = (n, nk) => { n._li = n._li || new Map(n.lessons.map((l, i) => [anNk(l.name), i])); const i = n._li.get(nk); return i == null ? -1 : i; };
/** Bir sınavda okul ('' ) ya da sınıf ortalamaları (önbellekli). */
function ogGroup(n, sinif) {
  const key = sinif || '*'; n._g = n._g || {}; if (n._g[key]) return n._g[key];
  const rows = anRows(n).filter(r => !sinif || r.sinif === sinif), a = anAvgOf(rows, n.lessons.length);
  return (n._g[key] = { rows, n: rows.length, a, net: a.net, puan: a.puan, D: a.D, Y: a.Y, B: a.B, pct: ogPct(a.net, n.totalQ), rk: {},
    sec: n.lessons.map((l, i) => { const s = a.sec[i] || []; return { D: s[0], Y: s[1], B: s[2], net: s[3], pct: l.count && s[3] != null ? s[3] / l.count * 100 : null }; }) });
}
const ogKey = (r, li) => (li < 0 ? (r.puan != null ? r.puan : r.net) : (r.sec[li] ? r.sec[li][3] : null));
/** Grup içi sıra: [sıra, grup büyüklüğü] — eşit değere aynı sıra verilir. */
function ogRankIn(g, r, li) {
  const keys = g.rk[li] || (g.rk[li] = g.rows.map(x => ogKey(x, li)).filter(v => v != null)), k = ogKey(r, li); if (k == null) return null;
  let c = 1; for (let i = 0; i < keys.length; i++) if (keys[i] > k) c++; return [c, keys.length];
}
/** Sıralar: dosyada/sunucuda varsa onlar, yoksa sistemde hesaplanan (puana, yoksa nete göre). */
function ogRanks(n, r) {
  const gs = ogGroup(n, r.sinif), go = ogGroup(n, ''), ls = ogRankIn(gs, r, -1), lo = ogRankIn(go, r, -1), rk = r.rk || {};
  return { snf: rk.snf != null ? rk.snf : (ls ? ls[0] : null), snfN: ls ? ls[1] : null, okul: rk.okul != null ? rk.okul : (lo ? lo[0] : null), okulN: lo ? lo[1] : null, ilce: rk.ilce, il: rk.il, genel: rk.genel };
}
const ogRoster = exams => {
  const m = new Map(); const nm = AN.names.get(String(AN.okul)); if (nm) nm.forEach((s, no) => m.set(no, { no, ad: (s.ad + ' ' + (s.soyad || '')).trim(), sinif: String(s.sinif || '') }));
  exams.forEach(n => anRows(n).forEach(r => { const o = m.get(r.no) || { no: r.no, ad: '', sinif: '' }; if (r.ad) o.ad = r.ad; if (r.sinif) o.sinif = r.sinif; m.set(r.no, o); })); return m;
};
function ogFind(roster, text, limit) {
  const t = spNorm(text).trim(), toks = t.split(/\s+/).filter(Boolean); if (!toks.length) return [];
  const sc = s => { const nm = spNorm(s.ad), words = nm.split(/\s+/); if (s.no === t || s.no === normNo(t)) return 0; if (/^\d+$/.test(t) && s.no.startsWith(normNo(t))) return 1; return toks.every(k => words.some(w => w.startsWith(k)) || nm.includes(k)) ? 2 : -1; };
  return Array.from(roster.values()).map(s => [sc(s), s]).filter(x => x[0] >= 0).sort((a, b) => a[0] - b[0] || String(a[1].sinif).localeCompare(String(b[1].sinif), 'tr', { numeric: true }) || a[1].ad.localeCompare(b[1].ad, 'tr')).slice(0, limit || 12).map(x => x[1]);
}
const ogByName = (a, b) => String(a.ad).localeCompare(String(b.ad), 'tr') || String(a.no).localeCompare(String(b.no), 'tr', { numeric: true });
/** Excel: sayfa başlığı + tablo */
function ogDownload(name, sheets) { download(name, XlsxLite.write(sheets), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); toast('Excel indirildi', 'ok'); }
const ogHd = a => a.map(x => ({ v: x, s: 'h' })), ogN2 = v => (v == null || !isFinite(v) ? null : { v: DisCore.r2(v), s: 'n2' });
const ogSeg = (items, cur, onPick, cls) => h('div', { class: 'tabs og-seg no-print' + (cls ? ' ' + cls : '') }, items.map(([id, l]) => h('button', { type: 'button', class: cur === id ? 'active' : '', 'data-id': id, id: 'og-seg-' + id, onclick: () => onPick(id) }, l)));
const ogStat = (v, l, sub) => h('div', { class: 'stat' }, h('b', null, v == null || v === '' ? '–' : v), h('span', null, l), sub ? h('span', { class: 'small' }, sub) : null);

/* ---------------------------------------------------------------- öğrenci modeli */
function ogModel(no, exams, roster) {
  exams = ogSorted(exams); const info = roster.get(no) || { no, ad: '', sinif: '' }, lm = ogLessonMap();
  const per = exams.map(n => {
    const r = anRows(n).find(x => x.no === no) || null, cls = ogGroup(n, r ? r.sinif : info.sinif), ok = ogGroup(n, '');
    const p = { n, r, cls, ok, pct: r ? ogPct(r.net, n.totalQ) : null, rk: r ? ogRanks(n, r) : null, les: [] };
    if (r) p.les = n.lessons.map((l, i) => { const s = r.sec[i] || [], gc = cls.sec[i], go = ok.sec[i]; return { nk: anNk(l.name), name: l.name, count: l.count, D: s[0], Y: s[1], B: s[2], net: s[3], pct: l.count && s[3] != null ? s[3] / l.count * 100 : null, clsNet: gc.net, clsPct: gc.pct, okNet: go.net, okPct: go.pct, rkS: ogRankIn(cls, r, i), rkO: ogRankIn(ok, r, i) }; });
    return p;
  });
  const taken = per.filter(p => p.r), sinif = (taken.length ? taken[taken.length - 1].r.sinif : '') || info.sinif;
  const ad = (taken.map(p => p.r.ad).filter(Boolean).pop()) || info.ad || ('Öğrenci ' + no);
  // ders toplulaştırma
  const les = [];
  lm.forEach(L => { const rows = per.map(p => (p.r ? p.les.find(x => x.nk === L.nk) || null : null)); const got = rows.filter(Boolean); if (!got.length) return;
    const pcts = got.map(x => x.pct); les.push({ nk: L.nk, name: L.name, slot: L.slot, rows, k: got.length, pct: ogMean(pcts), net: ogMean(got.map(x => x.net)), D: ogMean(got.map(x => x.D)), Y: ogMean(got.map(x => x.Y)), B: ogMean(got.map(x => x.B)), clsPct: ogMean(got.map(x => x.clsPct)), okPct: ogMean(got.map(x => x.okPct)),
      first: pcts.filter(v => v != null)[0], last: pcts.filter(v => v != null).slice(-1)[0], slope: ogSlope(pcts), rkS: ogMean(got.map(x => x.rkS && x.rkS[0])), rkO: ogMean(got.map(x => x.rkO && x.rkO[0])), best: got.reduce((a, x) => (x.pct != null && (!a || x.pct > a.pct) ? x : a), null), worst: got.reduce((a, x) => (x.pct != null && (!a || x.pct < a.pct) ? x : a), null) }); });
  return { no, ad, sinif, per, taken, les, lm };
}
const ogTrendWord = (s, unit) => (s == null ? '' : s > 1 ? 'yükseliş eğilimi' : s < -1 ? 'düşüş eğilimi' : 'dengeli seyir');
/** Puan türleri (Puan, LGS Puanı …) birbirine karıştırılmaz: en çok kullanılan (eşitse en yeni) tür esas alınır. */
function ogPuanScale(took) {
  const by = new Map(); took.forEach((p, i) => { if (p.r && p.r.puan != null) { const k = p.n.puanAdi || 'Puan', e = by.get(k) || { name: k, ids: new Set(), last: -1 }; e.ids.add(p.n.id); e.last = i; by.set(k, e); } });
  const all = Array.from(by.values()).sort((a, b) => b.ids.size - a.ids.size || b.last - a.last), dom = all[0];
  return { name: dom ? dom.name : 'Puan', ids: dom ? dom.ids : new Set(), mixed: all.length > 1, names: all.map(e => e.name) };
}
/** Otomatik değerlendirme cümleleri (yalnızca verilerden; yorum katmaz). */
function ogNotes(m) {
  const out = [], took = m.taken, miss = m.per.filter(p => !p.r), P = took.map(p => p.pct), pc = P.filter(v => v != null);
  out.push(`Katıldığı sınav: ${took.length} / ${m.per.length}.` + (miss.length ? ` Girmediği: ${miss.map(p => p.n.name).join(', ')}.` : ''));
  if (pc.length >= 2) { const sl = ogSlope(pc); out.push(`Başarı yüzdesi: ${ogP(pc[0])} → ${ogP(pc[pc.length - 1])} (ilk sınavdan sonuncuya ${ogSgn(pc[pc.length - 1] - pc[0], 1, ' puan')}); sınav başına ortalama değişim ${ogSgn(sl, 1, ' puan')} (${ogTrendWord(sl)}).`); }
  else if (pc.length === 1) out.push(`Tek sınav var: başarı yüzdesi ${ogP(pc[0])}. Gelişim için en az iki sınav gerekir.`);
  const PS = ogPuanScale(took), pu = took.filter(p => PS.ids.has(p.n.id)).map(p => p.r.puan); if (pu.length >= 2) out.push(`${PS.name}: ${nf(pu[0], 1)} → ${nf(pu[pu.length - 1], 1)} (${ogSgn(pu[pu.length - 1] - pu[0], 1)}); en yüksek ${nf(Math.max(...pu), 1)}.` + (PS.mixed ? ` Puan türleri farklı olduğu için (${PS.names.join(', ')}) yalnızca ${PS.name} sınavları karşılaştırıldı.` : ''));
  const withP = took.filter(p => p.pct != null); if (withP.length >= 2) { const hi = withP.reduce((a, p) => (p.pct > a.pct ? p : a)), lo = withP.reduce((a, p) => (p.pct < a.pct ? p : a)); out.push(`En yüksek başarı ${ogP(hi.pct)} (${hi.n.name}), en düşük ${ogP(lo.pct)} (${lo.n.name}).`); }
  const ls = m.les.filter(l => l.pct != null); if (ls.length >= 2) {
    const d = l => (l.clsPct != null ? l.pct - l.clsPct : null), byD = ls.filter(l => d(l) != null).sort((a, b) => d(b) - d(a));
    if (byD.length >= 2) { const s = byD[0], w = byD[byD.length - 1]; out.push(`Sınıf ortalamasına göre en güçlü ders: ${s.name} (${ogP(s.pct)}, sınıf ${ogP(s.clsPct)}, ${ogSgn(d(s), 1, ' puan')}); en zayıf ders: ${w.name} (${ogP(w.pct)}, sınıf ${ogP(w.clsPct)}, ${ogSgn(d(w), 1, ' puan')}).`); }
    else { const s = ls.slice().sort((a, b) => b.pct - a.pct); out.push(`En yüksek başarı: ${s[0].name} (${ogP(s[0].pct)}); en düşük: ${s[s.length - 1].name} (${ogP(s[s.length - 1].pct)}).`); }
    const ch = ls.filter(l => l.k >= 2 && l.first != null && l.last != null).map(l => ({ l, d: l.last - l.first })).sort((a, b) => b.d - a.d);
    if (ch.length >= 2) { const up = ch[0], dn = ch[ch.length - 1]; const bits = []; if (up.d >= 5) bits.push(`en çok gelişen ders: ${up.l.name} (${ogP(up.l.first)} → ${ogP(up.l.last)}, ${ogSgn(up.d, 1, ' puan')})`); if (dn.d <= -5) bits.push(`en çok gerileyen ders: ${dn.l.name} (${ogP(dn.l.first)} → ${ogP(dn.l.last)}, ${ogSgn(dn.d, 1, ' puan')})`); if (bits.length) out.push(bits.join('; ').replace(/^./, c => c.toLocaleUpperCase('tr')) + '.'); }
  }
  const rk = k => took.map(p => p.rk && p.rk[k]).filter(v => v != null); const ro = rk('okul'), rs = rk('snf'); if (ro.length >= 2) out.push(`Okul sırası: ${ro[0]} → ${ro[ro.length - 1]}` + (rs.length >= 2 ? `; sınıf sırası: ${rs[0]} → ${rs[rs.length - 1]}` : '') + ' (ilk → son sınav).');
  const last = took[took.length - 1]; if (last && last.cls.net != null && last.r.net != null && last.cls.n >= 3) out.push(`Son sınavda (${last.n.name}) sınıf ortalamasının ${nf(Math.abs(last.r.net - last.cls.net), 2)} net ${last.r.net >= last.cls.net ? 'üstünde' : 'altında'}.`);
  const tq = Array.from(new Set(m.per.map(p => p.n.totalQ))); if (tq.length > 1) out.push(`Not: sınavların soru sayıları farklı (${tq.join(', ')}); karşılaştırmalar bu yüzden başarı yüzdesi üzerinden yapılır.`);
  return out;
}

/* ---------------------------------------------------------------- Öğrenci sekmesi */
const OG_MET = { pct: { l: 'Başarı %', f: v => nf(v, 1) + '%' }, net: { l: 'Net', f: v => nf(v, 2) }, puan: { l: 'Puan', f: v => nf(v, 1) } };
function ogStudentRender(pane, sel, ctx) {
  const exams = ogSorted(sel), roster = ogRoster(exams), school = schoolByCode(AN.okul);
  // --- arama
  const q = h('input', { type: 'search', id: 'og-q', placeholder: 'Öğrenci no ya da ad yazın…', autocomplete: 'off', 'aria-label': 'Öğrenci ara' }), hits = h('div', { class: 'og-hits', id: 'og-hits' });
  const pick = no => ctx.openStudent(no);
  const paintHits = () => { clear(hits); const f = ogFind(roster, q.value); if (q.value.trim() && !f.length) hits.append(h('span', { class: 'small muted' }, 'Eşleşen öğrenci yok.')); f.forEach(s => hits.append(h('button', { type: 'button', class: 'btn sm og-hit', 'data-no': s.no, onclick: () => pick(s.no) }, `${s.no} · ${s.ad || '(adı yok)'}${s.sinif ? ' · ' + s.sinif : ''}`))); };
  q.addEventListener('input', paintHits); q.addEventListener('keydown', e => { if (e.key === 'Enter') { const f = ogFind(roster, q.value); if (f.length) pick(f[0].no); } });
  const classes = Array.from(new Set(Array.from(roster.values()).map(s => s.sinif).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'tr', { numeric: true }));
  const info = AN.stu ? roster.get(AN.stu) : null; if (AN.stu && !info) AN.stu = '';
  const clsSel = h('select', { id: 'og-cls', onchange: e => { AN.cls = e.target.value; ctx.renderTab(); } }, h('option', { value: '' }, 'Sınıfa göre seç…'), classes.map(c => h('option', { value: c }, c))); clsSel.value = classes.includes(AN.cls) ? AN.cls : '';
  const mates = info ? Array.from(roster.values()).filter(s => s.sinif === info.sinif).sort(ogByName) : [], mi = info ? mates.findIndex(s => s.no === info.no) : -1;
  const nav = info && mates.length > 1 ? [h('button', { class: 'btn sm', id: 'og-prev', title: 'Sınıftaki önceki öğrenci', onclick: () => pick(mates[(mi - 1 + mates.length) % mates.length].no) }, '‹ Önceki'), h('button', { class: 'btn sm', id: 'og-next', title: 'Sınıftaki sonraki öğrenci', onclick: () => pick(mates[(mi + 1) % mates.length].no) }, 'Sonraki ›')] : null;
  pane.append(h('div', { class: 'card no-print og-search' }, h('div', { class: 'row an-f' }, h('b', null, 'Öğrenci'), q, clsSel, nav), hits));
  if (AN.cls && !q.value) { const inCls = Array.from(roster.values()).filter(s => s.sinif === AN.cls).sort(ogByName); hits.append(inCls.map(s => h('button', { type: 'button', class: 'btn sm og-hit' + (s.no === AN.stu ? ' primary' : ''), 'data-no': s.no, onclick: () => pick(s.no) }, `${s.no} · ${s.ad || '(adı yok)'}`))); }
  if (!AN.stu) { pane.append(h('div', { class: 'empty card' }, h('p', null, 'Bir öğrencinin numarasını ya da adını yazın; tüm sınavlarındaki gelişimini, ders başarısını ve sıralarını görün.'), h('p', { class: 'small muted' }, 'Ya da sınıf seçip listeden bir öğrenciye tıklayın. Sınav listesi ve Gelişim tablolarında bir satıra tıklamak da öğrenciyi açar.'))); return; }
  const unsel = anCatalog().filter(e => !AN.sel.has(e.id)); if (unsel.length) pane.append(h('div', { class: 'alert info no-print' }, `${unsel.length} sınav işaretli değil, öğrenci analizine girmiyor. `, h('button', { class: 'btn sm', id: 'og-all', onclick: () => ctx.selectAll() }, 'Hepsini dahil et')));
  const m = ogModel(AN.stu, exams, roster), took = m.taken, per = m.per, metric = AN.stuMetric, MT = OG_MET[metric];
  const ex = per.map(p => p.n), L = ogLbl(ex), S = ogSub(ex), F = ogFull(ex), lm = m.lm;
  // --- başlık + özet kutuları
  const pcs = took.map(p => p.pct).filter(v => v != null), PS = ogPuanScale(took), pus = took.filter(p => PS.ids.has(p.n.id)).map(p => p.r.puan), nets = took.map(p => p.r.net).filter(v => v != null), last = took[took.length - 1], prevT = took[took.length - 2];
  const slope = ogSlope(pcs), bestP = pus.length ? took.reduce((a, p) => (PS.ids.has(p.n.id) && p.r.puan != null && (!a || p.r.puan > a.r.puan) ? p : a), null) : null, okR = took.map(p => p.rk && p.rk.okul).filter(v => v != null);
  const dLast = last && prevT && last.pct != null && prevT.pct != null ? last.pct - prevT.pct : null;
  pane.append(h('div', { class: 'print-only og-ph' }, h('b', null, 'Öğrenci analiz raporu'), ' · ', school ? school.okulAdi : '', ' · ', new Date().toLocaleDateString('tr-TR')));
  pane.append(h('div', { class: 'card og-head', id: 'og-head' }, h('div', { class: 'row between' }, h('div', null, h('h2', { style: { marginBottom: '.1rem' } }, m.ad), h('div', { class: 'small muted' }, `No ${m.no}${m.sinif ? ' · ' + m.sinif : ''}${school ? ' · ' + school.okulAdi : ''}`)), h('span', { class: 'pill ' + (took.length === per.length ? 'ok' : 'warn') }, `${took.length} / ${per.length} sınava girdi`)),
    h('div', { class: 'stats', style: { marginTop: '.7rem' } }, ogStat(took.length ? nf(ogMean(nets), 2) : '', 'ort. net'), ogStat(pcs.length ? ogP(ogMean(pcs)) : '', 'ort. başarı'), ogStat(pus.length ? nf(ogMean(pus), 1) : '', 'ort. ' + PS.name), ogStat(bestP ? nf(bestP.r.puan, 1) : '', 'en yüksek ' + PS.name, bestP ? bestP.n.name : ''),
      ogStat(last && last.pct != null ? ogP(last.pct) : '', 'son sınav başarısı', dLast != null ? `${dLast > 0 ? '▲' : dLast < 0 ? '▼' : '＝'} ${ogSgn(dLast, 1, ' puan')} önceki sınava göre` : ''), ogStat(slope != null ? ogSgn(slope, 1, ' puan') : '', 'sınav başına değişim', ogTrendWord(slope)), ogStat(okR.length ? Math.min(...okR) : '', 'en iyi okul sırası', okR.length && last && last.rk && last.rk.okul != null ? `son: ${last.rk.okul}${last.rk.okulN ? ' / ' + last.rk.okulN : ''}` : ''))));
  if (!took.length) { pane.append(h('div', { class: 'alert warn' }, 'Bu öğrenci işaretli sınavların hiçbirine girmemiş.')); return; }
  pane.append(h('div', { class: 'card' }, h('h2', null, 'Değerlendirme'), h('ul', { class: 'og-notes', id: 'og-notes' }, ogNotes(m).map(t => h('li', null, t)))));
  // --- gelişim grafiği
  const val = (p, kind) => { const g = kind === 'stu' ? null : kind === 'cls' ? p.cls : p.ok; if (metric === 'puan' && !PS.ids.has(p.n.id)) return null; if (kind === 'stu') return !p.r ? null : metric === 'pct' ? p.pct : metric === 'net' ? p.r.net : p.r.puan; return metric === 'pct' ? g.pct : metric === 'net' ? g.net : g.puan; };
  const tqv = Array.from(new Set(ex.map(n => n.totalQ)));
  const sm = (id, l) => ogSeg(Object.keys(OG_MET).map(k => [k, OG_MET[k].l]), metric, k => { AN.stuMetric = k; ctx.renderTab(); });
  pane.append(h('div', { class: 'card' }, h('div', { class: 'row between' }, h('h2', null, 'Gelişim · ' + MT.l), sm()),
    metric === 'puan' && PS.mixed ? h('div', { class: 'alert warn small' }, `Puan türleri farklı (${PS.names.join(', ')}); grafikte yalnızca ${PS.name} sınavları gösterilir. Tüm sınavlar için "Başarı %" kullanın.`) : null,
    metric === 'net' && tqv.length > 1 ? h('div', { class: 'alert warn small' }, `Sınavların soru sayıları farklı (${tqv.join(', ')}); net doğrudan kıyaslanamaz — "Başarı %" kullanın.`) : null,
    AnViz.line({ labels: L, sub: S, full: F, label: 'Öğrenci gelişimi', fmt: MT.f, missText: metric === 'puan' ? 'bu puan türünde değil' : 'girmedi', floor: 0, ceil: metric === 'pct' ? 100 : null, series: [{ name: 'Öğrenci', c: 1, pts: per.map(p => val(p, 'stu')) }, { name: 'Sınıf ortalaması' + (m.sinif ? ' (' + m.sinif + ')' : ''), c: 2, dash: true, pts: per.map(p => val(p, 'cls')) }, { name: 'Okul ortalaması', c: 3, dash: true, pts: per.map(p => val(p, 'ok')) }] }),
    h('p', { class: 'small muted' }, 'Öğrencinin girmediği sınavlarda çizgi bir sonraki sınava atlar; sınıf ve okul ortalamaları o sınavın tüm katılımcılarındandır.')));
  // --- sıralama
  const hasRank = took.some(p => p.rk && (p.rk.okul != null || p.rk.snf != null));
  if (hasRank) pane.append(h('div', { class: 'card' }, h('h2', null, 'Sıralama (1 = en iyi)'), AnViz.line({ labels: L, sub: S, full: per.map((p, i) => p.rk ? `${F[i]} · Sınıf ${p.rk.snf != null ? p.rk.snf + (p.rk.snfN ? '/' + p.rk.snfN : '') : '–'} · Okul ${p.rk.okul != null ? p.rk.okul + (p.rk.okulN ? '/' + p.rk.okulN : '') : '–'}${p.rk.ilce != null ? ' · İlçe ' + p.rk.ilce : ''}${p.rk.il != null ? ' · İl ' + p.rk.il : ''}${p.rk.genel != null ? ' · Genel ' + p.rk.genel : ''}` : F[i] + ' · girmedi'), label: 'Sıralama', invert: true, int: true, yMin: 1, fmt: v => nf(v, 0), missText: 'girmedi', series: [{ name: 'Okul sırası', c: 1, pts: per.map(p => p.rk ? p.rk.okul : null) }, { name: 'Sınıf sırası', c: 2, pts: per.map(p => p.rk ? p.rk.snf : null) }] }),
    h('p', { class: 'small muted' }, 'Dosyada/sunucuda sıra varsa o, yoksa sistemde hesaplanan sıra (puana, yoksa nete göre) gösterilir. İlçe / il / genel sıraları yalnızca dosyada varsa tabloda ve ipucunda görünür.')));
  // --- ders ders
  const lessons = m.les, lsel = AN.stuLesson && lessons.find(l => l.nk === AN.stuLesson) ? AN.stuLesson : '';
  const chips = h('div', { class: 'row og-chips no-print', style: { gap: '.35rem', margin: '.2rem 0 .6rem' } }, [{ nk: '', name: 'Tüm dersler' }].concat(lessons).map(l => h('button', { type: 'button', class: 'btn sm' + (l.nk === lsel ? ' primary' : ''), 'data-id': l.nk, onclick: () => { AN.stuLesson = l.nk; ctx.renderTab(); } }, l.name)));
  const lcard = h('div', { class: 'card', id: 'og-lessons' }, h('h2', null, 'Ders ders başarı'), chips);
  if (!lsel) {
    lcard.append(h('h3', { class: 'og-h3' }, 'Ders profili (ortalama başarı %)'), AnViz.bars({ rows: lessons.map(l => ({ label: l.name, vals: [l.pct, l.clsPct, l.okPct] })), series: [{ name: 'Öğrenci', c: 1 }, { name: 'Sınıf ortalaması', c: 2 }, { name: 'Okul ortalaması', c: 3 }], fmt: v => nf(v, 1) + '%', max: 100, min: 0, xFmt: v => v + '%', label: 'Ders profili' }),
      h('h3', { class: 'og-h3' }, 'Derslere göre başarı % (sınav sınav)'), AnViz.line({ labels: L, sub: S, full: F, label: 'Ders başarıları', fmt: v => nf(v, 1) + '%', missText: 'girmedi', yFmt: v => nf(v, 0) + '%', floor: 0, ceil: 100, series: lessons.slice(0, 8).map(l => ({ name: l.name, c: l.slot, pts: l.rows.map(x => (x ? x.pct : null)) })) }),
      h('h3', { class: 'og-h3' }, 'Doğru · yanlış · boş (toplam)'), AnViz.cols({ cats: took.map(p => ({ label: anFmtDate(p.n.date).slice(0, 5), sub: p.n.name, tip: F[per.indexOf(p)], vals: [p.r.D, p.r.Y, p.r.B] })), series: [{ name: 'Doğru', c: 1 }, { name: 'Yanlış', c: 2 }, { name: 'Boş', color: 'var(--v0)' }], stack: true, int: true, label: 'Doğru yanlış boş' }));
  } else {
    const l = lessons.find(x => x.nk === lsel), rowsL = l.rows, tk = per.map((p, i) => ({ p, x: rowsL[i], i })).filter(o => o.x);
    lcard.append(h('div', { class: 'stats' }, ogStat(ogP(l.pct), 'ort. başarı', `sınıf ${ogP(l.clsPct)} · okul ${ogP(l.okPct)}`), ogStat(nf(l.net, 2), 'ort. net'), ogStat(`${nf(l.D, 1)} / ${nf(l.Y, 1)} / ${nf(l.B, 1)}`, 'ort. D / Y / B'), ogStat(l.rkS != null ? nf(l.rkS, 1) : '', 'ort. sınıf sırası (ders)'), ogStat(l.rkO != null ? nf(l.rkO, 1) : '', 'ort. okul sırası (ders)'), ogStat(l.slope != null ? ogSgn(l.slope, 1, ' puan') : '', 'sınav başına değişim', ogTrendWord(l.slope))),
      h('h3', { class: 'og-h3' }, l.name + ' · başarı %'), AnViz.line({ labels: L, sub: S, full: F, label: l.name + ' başarısı', fmt: v => nf(v, 1) + '%', missText: 'girmedi', yFmt: v => nf(v, 0) + '%', floor: 0, ceil: 100, series: [{ name: 'Öğrenci', c: 1, pts: rowsL.map(x => (x ? x.pct : null)) }, { name: 'Sınıf ortalaması', c: 2, dash: true, pts: rowsL.map(x => (x ? x.clsPct : null)) }, { name: 'Okul ortalaması', c: 3, dash: true, pts: rowsL.map(x => (x ? x.okPct : null)) }] }),
      h('h3', { class: 'og-h3' }, l.name + ' · doğru · yanlış · boş'), AnViz.cols({ cats: tk.map(o => ({ label: anFmtDate(o.p.n.date).slice(0, 5), sub: o.p.n.name, tip: `${F[o.i]} · ${o.x.count} soru`, vals: [o.x.D, o.x.Y, o.x.B] })), series: [{ name: 'Doğru', c: 1 }, { name: 'Yanlış', c: 2 }, { name: 'Boş', color: 'var(--v0)' }], stack: true, int: true, label: l.name + ' doğru yanlış boş' }),
      h('h3', { class: 'og-h3' }, l.name + ' · ders sırası (1 = en iyi)'), AnViz.line({ labels: L, sub: S, full: per.map((p, i) => { const x = rowsL[i]; return x ? `${F[i]} · Sınıf ${x.rkS ? x.rkS[0] + '/' + x.rkS[1] : '–'} · Okul ${x.rkO ? x.rkO[0] + '/' + x.rkO[1] : '–'}` : F[i] + ' · girmedi'; }), label: l.name + ' sırası', invert: true, int: true, yMin: 1, fmt: v => nf(v, 0), missText: 'girmedi', series: [{ name: 'Okul sırası', c: 1, pts: rowsL.map(x => (x && x.rkO ? x.rkO[0] : null)) }, { name: 'Sınıf sırası', c: 2, pts: rowsL.map(x => (x && x.rkS ? x.rkS[0] : null)) }] }));
  }
  pane.append(lcard);
  // --- sınav sınav tablo
  const heatSpan = 25, thL = lessons.map(l => h('th', { class: 'num' }, l.name));
  const rowsT = per.map(p => {
    if (!p.r) return h('tr', { class: 'og-miss' }, h('td', { class: 'nowrap' }, anFmtDate(p.n.date)), h('td', null, p.n.name), h('td', null, badge({ ext: p.n.ext, kaynak: p.n.kaynak })), h('td', { colspan: 7 + lessons.length, class: 'muted' }, 'Bu sınava girmedi'));
    const i = took.indexOf(p), pv = took[i - 1], dn = pv && p.r.net != null && pv.r.net != null && p.n.totalQ === pv.n.totalQ ? p.r.net - pv.r.net : null, dp = pv && p.r.puan != null && pv.r.puan != null && (p.n.puanAdi || 'Puan') === (pv.n.puanAdi || 'Puan') ? p.r.puan - pv.r.puan : null, rk = p.rk;
    const rkc = (v, n) => h('td', { class: 'num' }, v == null ? '' : n ? `${v}/${n}` : v);
    return h('tr', null, h('td', { class: 'nowrap' }, anFmtDate(p.n.date)), h('td', null, p.n.name), h('td', null, badge({ ext: p.n.ext, kaynak: p.n.kaynak })), h('td', { class: 'num' }, `${p.r.D ?? ''} / ${p.r.Y ?? ''} / ${p.r.B ?? ''}`), h('td', { class: 'num' }, h('b', null, nf(p.r.net)), anDelta(dn, 'net')), h('td', { class: 'num', title: p.n.puanAdi || 'Puan' }, p.r.puan == null ? '' : [h('b', null, nf(p.r.puan, 2)), anDelta(dp, 'puan')]),
      h('td', { class: 'num', style: { background: AnViz.heat(p.pct, p.cls.pct, heatSpan) } }, ogP(p.pct)), h('td', { class: 'num' }, nf(p.cls.net)), rkc(rk.snf, rk.snfN), rkc(rk.okul, rk.okulN), h('td', { class: 'num' }, rk.ilce == null ? '' : rk.ilce), h('td', { class: 'num' }, rk.il == null ? '' : rk.il), h('td', { class: 'num' }, rk.genel == null ? '' : rk.genel),
      lessons.map(l => { const x = p.les.find(y => y.nk === l.nk); return x ? h('td', { class: 'num', style: { background: AnViz.heat(x.pct, x.clsPct, heatSpan) }, title: `${x.D}D ${x.Y}Y ${x.B}B · ${ogP(x.pct)} · sınıf ort. net ${nf(x.clsNet)} · sıra sınıf ${x.rkS ? x.rkS[0] + '/' + x.rkS[1] : '–'}, okul ${x.rkO ? x.rkO[0] + '/' + x.rkO[1] : '–'}` }, nf(x.net)) : h('td'); }));
  });
  pane.append(h('div', { class: 'card' }, h('h2', null, 'Sınav sınav sonuçlar'), h('div', { class: 'tablewrap' }, h('table', { class: 'an-table', id: 'og-exams' }, h('thead', null, h('tr', null, ['Tarih', 'Sınav', 'Kaynak'].map(x => h('th', null, x)), ['D / Y / B', 'Net', 'Puan', 'Başarı %', 'Sınıf ort. net', 'Sınıf sırası', 'Okul sırası', 'İlçe', 'İl', 'Genel'].map(x => h('th', { class: 'num' }, x)), thL)), h('tbody', null, rowsT))),
    h('p', { class: 'small muted' }, 'Ders sütunları net gösterir; hücre rengi dersin başarı yüzdesinin sınıf ortalamasından farkıdır (mavi: üstünde, kırmızı: altında). Üzerine gelince D/Y/B, yüzde ve ders sırası görünür.')));
  // --- ders özeti tablosu
  pane.append(h('div', { class: 'card' }, h('h2', null, 'Ders özeti'), h('div', { class: 'tablewrap' }, h('table', { class: 'an-table', id: 'og-lesson-sum' }, h('thead', null, h('tr', null, ['Ders'].map(x => h('th', null, x)), ['Sınav', 'Ort. D', 'Ort. Y', 'Ort. B', 'Ort. net', 'Ort. başarı', 'Sınıf ort.', 'Fark', 'Okul ort.', 'Ders sırası (sınıf)', 'Ders sırası (okul)', 'En iyi', 'En düşük', 'Gidiş'].map(x => h('th', { class: 'num' }, x)))),
    h('tbody', null, lessons.map(l => { const d = l.clsPct != null && l.pct != null ? l.pct - l.clsPct : null; return h('tr', null, h('td', null, h('span', { class: 'vz-key vz-b' + l.slot }), ' ', l.name), h('td', { class: 'num' }, l.k), h('td', { class: 'num' }, nf(l.D, 1)), h('td', { class: 'num' }, nf(l.Y, 1)), h('td', { class: 'num' }, nf(l.B, 1)), h('td', { class: 'num' }, h('b', null, nf(l.net))), h('td', { class: 'num' }, ogP(l.pct)), h('td', { class: 'num' }, ogP(l.clsPct)), h('td', { class: 'num', style: { background: AnViz.heat(d, 0, 15) } }, ogSgn(d, 1, ' puan')), h('td', { class: 'num' }, ogP(l.okPct)), h('td', { class: 'num' }, l.rkS == null ? '' : nf(l.rkS, 1)), h('td', { class: 'num' }, l.rkO == null ? '' : nf(l.rkO, 1)), h('td', { class: 'num', title: l.best ? l.best.pct && '' : '' }, l.best ? ogP(l.best.pct) : ''), h('td', { class: 'num' }, l.worst ? ogP(l.worst.pct) : ''), h('td', { class: 'center' }, anSpark(l.rows.map(x => (x ? x.pct : null))))); })))),
    h('p', { class: 'small muted' }, '“Ders sırası” öğrencinin o dersteki netinin sınıfta/okulda kaçıncı olduğudur (girdiği sınavların ortalaması). Fark: öğrencinin ders başarısı ile sınıf ortalaması arasındaki yüzde puan farkıdır.')));
}

/* ---------------------------------------------------------------- Excel (öğrenci karnesi) */
function ogStudentExport(sel, ctx) {
  const exams = ogSorted(sel), roster = ogRoster(exams); if (!AN.stu || !roster.get(AN.stu)) return toast('Önce bir öğrenci seçin', 'warn');
  const m = ogModel(AN.stu, exams, roster), school = schoolByCode(AN.okul), lessons = m.les;
  const ozet = { name: 'Özet', widths: [24, 70], rows: [[{ v: 'Öğrenci', s: 'b' }, m.ad], [{ v: 'No', s: 'b' }, m.no], [{ v: 'Sınıf', s: 'b' }, m.sinif], [{ v: 'Okul', s: 'b' }, school ? school.okulAdi : ''], [{ v: 'Katıldığı sınav', s: 'b' }, `${m.taken.length} / ${m.per.length}`], [], [{ v: 'Değerlendirme', s: 'b' }]].concat(ogNotes(m).map(t => [null, t])) };
  const head = ['Tarih', 'Sınav', 'Kaynak', 'Girdi', 'Doğru', 'Yanlış', 'Boş', 'Net', 'Puan', 'Başarı %', 'Sınıf ort. net', 'Sınıf ort. başarı %', 'Okul ort. başarı %', 'Sınıf sırası', 'Okul sırası', 'İlçe', 'İl', 'Genel'].concat(lessons.flatMap(l => [l.name + ' D', l.name + ' Y', l.name + ' Net', l.name + ' %']));
  const rows = [ogHd(head)].concat(m.per.map(p => { const r = p.r, rk = p.rk || {}; return [anFmtDate(p.n.date), p.n.name, p.n.ext ? 'Dış · ' + p.n.kaynak : 'Sistem', r ? 'Evet' : 'Hayır', r ? r.D : null, r ? r.Y : null, r ? r.B : null, r ? ogN2(r.net) : null, r && r.puan != null ? ogN2(r.puan) : null, ogN2(p.pct), ogN2(p.cls.net), ogN2(p.cls.pct), ogN2(p.ok.pct), rk.snf, rk.okul, rk.ilce, rk.il, rk.genel].concat(lessons.flatMap(l => { const x = r ? p.les.find(y => y.nk === l.nk) : null; return x ? [x.D, x.Y, ogN2(x.net), ogN2(x.pct)] : [null, null, null, null]; })); }));
  const lrows = [ogHd(['Ders', 'Sınav sayısı', 'Ort. D', 'Ort. Y', 'Ort. B', 'Ort. net', 'Ort. başarı %', 'Sınıf ort. %', 'Okul ort. %', 'Ders sırası (sınıf)', 'Ders sırası (okul)'])].concat(lessons.map(l => [l.name, l.k, ogN2(l.D), ogN2(l.Y), ogN2(l.B), ogN2(l.net), ogN2(l.pct), ogN2(l.clsPct), ogN2(l.okPct), ogN2(l.rkS), ogN2(l.rkO)]));
  ogDownload(`ogrenci-${m.no}-analiz.xlsx`, [ozet, { name: 'Sınavlar', rows, widths: [11, 30, 22, 7].concat(Array(14).fill(10), lessons.flatMap(() => [7, 7, 9, 9])), freeze: { row: 1, col: 2 } }, { name: 'Dersler', rows: lrows, widths: [24, 12, 9, 9, 9, 10, 13, 12, 12, 16, 16], freeze: { row: 1 } }]);
}

ANTABS.push({ id: 'ogr', label: 'Öğrenci', filters: [], render: ogStudentRender, export: ogStudentExport });
