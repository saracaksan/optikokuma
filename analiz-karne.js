/* analiz-karne.js — Karneler sekmesi: A4 dikey, PDF'e dönüştürülebilir çıktılar.
 *  1) Öğrenci karnesi: tek öğrenci (başlık, özet kutuları, gelişim grafiği, sınav tablosu, ders tablosu, değerlendirme, imza alanı).
 *  2) Sınıf karneleri: seçilen sınıfın (ya da tüm okulun) her öğrencisi için ayrı sayfa — toplu yazdırma.
 *  3) Sınıf / okul raporu: özet sayfası + öğrenci (sınıf) listesi.
 * PDF kütüphanesi yoktur: "Yazdır / PDF" tarayıcının yazdırma penceresini açar, hedef olarak "PDF olarak kaydet" seçilir.
 * Karneler her zaman beyaz kâğıt görünümündedir (koyu temada da); işaretli sınavlar karneye girer. Yardımcılar analiz-ogr.js / analiz-sinif.js'tedir. */
'use strict';

AN.krMode = 'ogr'; AN.krStu = ''; AN.krCls = ''; AN.krScls = undefined; AN.krRcls = undefined; AN.krRank = true; AN.krNotes = true; AN.krChart = true; AN.krPlan = true; AN.krProfile = 'kocluk';
let krToken = 0, krBusy = false, krLast = null;
const krPending = () => krBusy;
const krDate = () => new Date().toLocaleDateString('tr-TR');
const krCut = (s, n) => { s = String(s || ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
const krDash = (a, b) => (a == null && b == null ? '' : `${a == null ? '–' : a} → ${b == null ? '–' : b}`);
/** Karnedeki tablo ve grafik: tablo görünümü ("details") ekran dışında anlamsız, kaldırılır. */
const krChart = el => { const d = el.querySelector && el.querySelector('.vz-details'); if (d) d.remove(); return el; };
const krKpi = (v, l, sub) => h('div', { class: 'kr-kpi' }, h('b', null, v == null || v === '' ? '–' : v), h('span', null, l), sub ? h('i', null, sub) : null);
const krHead = (title, school) => h('header', { class: 'kr-hd' }, h('div', { class: 'kr-sch' }, h('b', null, school ? school.okulAdi : 'Okul'), h('span', null, school ? [school.ilce, school.il].filter(Boolean).join(' / ') : '')), h('div', { class: 'kr-ttl' }, title), h('div', { class: 'kr-dt' }, krDate()));
const krRange = exams => (exams.length ? `${exams.length} sınav` + (exams[0].date && exams[exams.length - 1].date ? ` (${anFmtDate(exams[0].date)} – ${anFmtDate(exams[exams.length - 1].date)})` : '') : '');
const krFoot = who => h('footer', { class: 'kr-ft' }, h('div', { class: 'kr-sign' }, h('span', null, who ? who[0] : 'Sınıf rehber öğretmeni'), h('span', null, who ? who[1] : 'Okul müdürü')), h('div', { class: 'kr-gen' }, 'Sıraç Aksan Optik Okuma · Telif Hakkı © Sıraç AKSAN (İzinsiz kopyalamak veya telif atmak ayıptır) · ' + krDate()));
/** Ders başarısı çubuğu: dolgu öğrencinin yüzdesi, dikey çizgi sınıf ortalaması. */
const krBar = (p, c) => h('div', { class: 'kr-bar', title: `Başarı %${p == null ? '–' : nf(p, 1)}${c != null ? ' · sınıf ortalaması %' + nf(c, 1) : ''}` }, p != null ? h('u', { style: { width: Math.max(0, Math.min(100, p)) + '%' } }) : null, c != null ? h('i', { style: { left: Math.max(0, Math.min(100, c)) + '%' } }) : null);


/** Rapor profiline göre (Koçluk / Rehberlik / İdare) profesyonel pedagojik değerlendirme üretir. */
function krProComment(m, exams, profile) {
  const prof = profile || AN.krProfile || 'kocluk';
  const took = m.taken, pcs = took.map(p => p.pct).filter(v => v != null), les = (m.les || []).filter(l => l.pct != null);
  const parts = [];
  const meanP = pcs.length ? ogMean(pcs) : null;
  const sd = pcs.length >= 2 ? Math.sqrt(pcs.reduce((s, v) => s + (v - meanP) * (v - meanP), 0) / pcs.length) : 0;
  const diff = pcs.length >= 2 ? (pcs[pcs.length - 1] - pcs[0]) : 0;

  if (pcs.length >= 2) {
    const first = pcs[0], last = pcs[pcs.length - 1];
    const trendTxt = diff > 3 ? `belirgin bir yükseliş (${ogSgn(diff, 1, ' puan')})` : diff < -3 ? `düşüş eğilimi (${ogSgn(diff, 1, ' puan')})` : `dengeli bir seyir (${ogSgn(diff, 1, ' puan')})`;
    const stabTxt = sd <= 6 ? 'istikrarlı bir çalışma disiplini' : sd <= 12 ? 'orta düzeyde dalgalı bir seyir' : 'sınavdan sınava belirgin dalgalanma';
    parts.push(`Seçilen ${took.length} sınavda %${nf(first, 1)} → %${nf(last, 1)} ile ${trendTxt} ve ${stabTxt} gözlenmektedir (genel ortalama %${nf(meanP, 1)}).`);
  } else if (pcs.length === 1) {
    parts.push(`Değerlendirilen sınavda %${nf(pcs[0], 1)} genel başarı düzeyine ulaşmıştır.`);
  }

  let top = null, low = null;
  if (les.length >= 2) {
    const sorted = les.slice().sort((a, b) => b.pct - a.pct);
    top = sorted[0]; low = sorted[sorted.length - 1];
    parts.push(`Akademik profilde en güçlü ders ${top.name} (%${nf(top.pct, 1)}), öncelikli telafi gerektiren ders ${low.name} (%${nf(low.pct, 1)}) olarak öne çıkmaktadır.`);
  } else if (les.length === 1) {
    top = les[0];
    parts.push(`${top.name} dersinde ortalama %${nf(top.pct, 1)} başarı kaydedilmiştir.`);
  }

  // Boş/yanlış davranışı (sınav stratejisi analizi)
  const avgY = ogMean(took.map(p => p.r.Y)), avgB = ogMean(took.map(p => p.r.B));
  if (avgY != null && avgB != null) {
    if (avgY > avgB * 2.2 && avgY >= 6) {
      parts.push('Yanlış sayısının boş sayısına göre yüksek olması, emin olunmayan sorularda tahmin/acele işaretleme eğilimine işaret etmektedir; turlama tekniği ve soru kökü okuma pratiği önerilir.');
    } else if (avgB > avgY * 1.8 && avgB >= 8) {
      parts.push('Boş bırakılan soru oranının yüksek olması süre yönetimi veya konu eksiği kaynaklıdır; deneme süresini derslere bölerek deneme pratiği artırılmalıdır.');
    }
  }

  if (prof === 'kocluk') {
    if (low) parts.push(`Koçluk Hedefi: Önümüzdeki 2 haftalık periyotta ${low.name} dersindeki eksik kazanımlara günlük 25–30 soru ve konu özeti tekrarı ayrılmalı, ${top ? top.name : 'güçlü dersler'} haftalık karma testlerle korunmalıdır.`);
  } else if (prof === 'rehberlik') {
    const missedCount = (m.per ? m.per.length : 0) - took.length;
    if (missedCount > 0) parts.push(`Devam ve Takip Notu: Kapsamdaki ${missedCount} sınava katılım sağlanmamıştır; veli-öğrenci görüşmesinde sınav takibi ve motivasyon sürekliliği desteklenmelidir.`);
    if (sd > 12) parts.push('Sınav kaygısı, dikkat dağınıklığı veya hazırlık düzensizliği açısından rehberlik birimi ile bireysel görüşme planlanması faydalı olacaktır.');
  } else if (prof === 'idare') {
    const bandLabel = meanP >= 75 ? 'Üst Başarı Grubu (%75+)' : meanP >= 50 ? 'Orta / Gelişime Açık Grup (%50–74)' : 'Öncelikli Akademik Destek Grubu (%50 altı)';
    parts.push(`Kurul / İdare Sınıflandırması: ${bandLabel}. Destekleme ve Yetiştirme Kursları (DYK) ile bireysel etüt planlamasında önceliklendirilmelidir.`);
  }

  const hasSingle = exams.some(e => (e.lessons || []).length === 1), hasMulti = exams.some(e => (e.lessons || []).length > 1);
  if (hasSingle && hasMulti) {
    parts.push('Tek ders konu testleri ile çok dersli denemeler ders bazında ortak % başarı ölçeğinde değerlendirilmiştir.');
  }
  return parts.join(' ');
}

/* ---------------------------------------------------------------- öğrenci karnesi (tek sayfa) */
function krStudentPage(m, exams, school, opt) {
  const took = m.taken, per = m.per, lessons = m.les, last = took[took.length - 1], prevT = took[took.length - 2], pcs = took.map(p => p.pct).filter(v => v != null), nets = took.map(p => p.r.net).filter(v => v != null);
  const dL = last && prevT && last.pct != null && prevT.pct != null ? last.pct - prevT.pct : null, gain = pcs.length > 1 ? pcs[pcs.length - 1] - pcs[0] : null;
  const clsAvg = ogMean(took.map(p => p.cls.pct)), best = took.reduce((a, p) => (p.pct != null && (!a || p.pct > a.pct) ? p : a), null);
  const rkL = last && last.rk ? last.rk : null, hasPuan = took.some(p => p.r.puan != null), rk = (k, n) => (rkL && rkL[k] != null ? rkL[k] + (rkL[n] ? ' / ' + rkL[n] : '') : '');
  const kpis = [krKpi(`${took.length} / ${per.length}`, 'katıldığı sınav'), krKpi(ogP(ogMean(pcs)), 'ortalama başarı', clsAvg != null ? 'sınıf ort. ' + ogP(clsAvg) : ''), krKpi(last && last.pct != null ? ogP(last.pct) : '', 'son sınav başarısı', dL != null ? `${dL > 0 ? '▲' : dL < 0 ? '▼' : '＝'} ${ogSgn(dL, 1, ' puan')}` : ''), krKpi(gain != null ? ogSgn(gain, 1, ' puan') : '', 'ilk → son değişim', ogTrendWord(ogSlope(pcs)))]
    .concat(opt.rank ? [krKpi(rk('snf', 'snfN'), 'sınıf sırası (son sınav)'), krKpi(rk('okul', 'okulN'), 'okul sırası (son sınav)')] : [krKpi(nets.length ? nf(ogMean(nets), 2) : '', 'ortalama net'), krKpi(best ? ogP(best.pct) : '', 'en yüksek başarı', best ? krCut(best.n.name, 18) : '')]);
  const L = ogLbl(per.map(p => p.n)), S = ogSub(per.map(p => p.n)), F = ogFull(per.map(p => p.n));
  const sec = (t, ...kids) => h('section', { class: 'kr-sec' }, h('h3', null, t), ...kids);
  const profTitle = opt.profile === 'rehberlik' ? 'REHBERLİK & AKADEMİK GELİŞİM RAPORU' : opt.profile === 'idare' ? 'İDARE / KURUL DEĞERLENDİRME RAPORU' : 'ÖĞRENCİ SINAV & KOÇLUK KARNESİ';
  const page = h('section', { class: 'kr-page', 'data-no': m.no }, krHead(profTitle, school),
    h('div', { class: 'kr-id' }, h('div', null, h('span', null, 'Öğrenci'), h('b', null, m.ad)), h('div', null, h('span', null, 'Numara'), h('b', null, m.no)), h('div', null, h('span', null, 'Sınıf'), h('b', null, m.sinif || '–')), h('div', null, h('span', null, 'Kapsam'), h('b', null, krRange(exams)))),
    h('div', { class: 'kr-kpis' }, kpis));
  if (opt.chart && per.length) page.append(sec('Başarı gelişimi (%)', krChart(AnViz.line({ h: 190, labels: L, sub: S, full: F, label: m.ad + ' başarı gelişimi', fmt: v => nf(v, 1) + '%', yFmt: v => nf(v, 0) + '%', floor: 0, ceil: 100, missText: 'girmedi', series: [{ name: 'Öğrenci', c: 1, pts: per.map(p => (p.r ? p.pct : null)) }, { name: 'Sınıf ortalaması', c: 2, dash: true, pts: per.map(p => (p.r ? p.cls.pct : null)) }, { name: 'Okul ortalaması', c: 3, dash: true, pts: per.map(p => (p.r ? p.ok.pct : null)) }] }))));
  const head = ['Tarih', 'Sınav', 'D', 'Y', 'B', 'Net'].concat(hasPuan ? ['Puan'] : [], ['Başarı %', 'Sınıf ort. %', 'Fark'], opt.rank ? ['Sınıf sırası', 'Okul sırası'] : []);
  const rows = per.map(p => {
    if (!p.r) return h('tr', { class: 'kr-miss' }, h('td', { class: 'nowrap' }, anFmtDate(p.n.date)), h('td', null, p.n.name), h('td', { colspan: head.length - 2 }, 'Sınava girmedi'));
    const d = p.pct != null && p.cls.pct != null ? p.pct - p.cls.pct : null, r = p.rk || {}, rkc = (v, n) => h('td', { class: 'num' }, v == null ? '' : n ? `${v}/${n}` : v);
    return h('tr', null, h('td', { class: 'nowrap' }, anFmtDate(p.n.date)), h('td', null, p.n.name), h('td', { class: 'num' }, p.r.D ?? ''), h('td', { class: 'num' }, p.r.Y ?? ''), h('td', { class: 'num' }, p.r.B ?? ''), h('td', { class: 'num' }, h('b', null, nf(p.r.net))), hasPuan ? h('td', { class: 'num', title: p.n.puanAdi || 'Puan' }, p.r.puan == null ? '' : nf(p.r.puan, 1)) : null,
      h('td', { class: 'num', style: snHeat(p.pct, p.cls.pct) }, h('b', null, ogP(p.pct))), h('td', { class: 'num' }, ogP(p.cls.pct)), h('td', { class: 'num' }, d == null ? '' : ogSgn(d, 1)), opt.rank ? [rkc(r.snf, r.snfN), rkc(r.okul, r.okulN)] : null);
  });
  page.append(sec('Sınav sonuçları', h('table', { class: 'kr-table zebra-tbl' }, h('thead', null, h('tr', null, head.map((x, i) => h('th', { class: i > 1 ? 'num' : '' }, x)))), h('tbody', null, rows))));
  if (lessons.length) page.append(sec('Ders ders başarı', h('table', { class: 'kr-table zebra-tbl' }, h('thead', null, h('tr', null, h('th', null, 'Ders'), ['Ort. D', 'Ort. Y', 'Ort. B', 'Ort. net', 'Başarı %'].map(x => h('th', { class: 'num' }, x)), h('th', { class: 'kr-barcol' }, 'Başarı (çizgi: sınıf ort.)'), ['Sınıf ort. %', 'Fark'].map(x => h('th', { class: 'num' }, x)), h('th', null, 'Gidiş'))),
    h('tbody', null, lessons.map(l => { const d = l.pct != null && l.clsPct != null ? l.pct - l.clsPct : null; return h('tr', null, h('td', null, h('span', { class: 'vz-key vz-b' + l.slot }), ' ', l.name), h('td', { class: 'num' }, nf(l.D, 1)), h('td', { class: 'num' }, nf(l.Y, 1)), h('td', { class: 'num' }, nf(l.B, 1)), h('td', { class: 'num' }, nf(l.net)), h('td', { class: 'num', style: snHeat(l.pct, l.clsPct) }, h('b', null, ogP(l.pct))), h('td', { class: 'kr-barcol' }, krBar(l.pct, l.clsPct)), h('td', { class: 'num' }, ogP(l.clsPct)), h('td', { class: 'num' }, d == null ? '' : ogSgn(d, 1)), h('td', null, anSpark(l.rows.map(x => (x ? x.pct : null))))); })))));
  if (opt.notes) {
    const pro = krProComment(m, exams, opt.profile), notes = ogNotes(m).slice(0, 5);
    if (pro || notes.length) {
      const lbl = opt.profile === 'rehberlik' ? 'Rehberlik & Gelişim Analizi: ' : opt.profile === 'idare' ? 'Kurul & İdare Değerlendirmesi: ' : 'Eğitim Koçluğu Değerlendirmesi: ';
      page.append(sec('Profesyonel Gelişim ve Eğitim Koçluğu Değerlendirmesi',
        pro ? h('div', { class: 'karne-comment' }, h('b', null, lbl), pro) : null,
        notes.length ? h('ul', { class: 'kr-notes' }, notes.map(t => h('li', null, t))) : null));
    }
  }
  if (opt.plan !== false && typeof ogBuildActionPlan === 'function') {
    const plan = ogBuildActionPlan(m.no, exams, ogRoster(exams));
    if (plan && plan.steps && plan.steps.length) {
      page.append(sec('Kişiye Özel Konu / Kazanım Eylem Planı',
        h('table', { class: 'kr-table zebra-tbl' },
          h('thead', null, h('tr', null, ['Öncelik', 'Ders', 'Eksik Konu / Kazanım', 'Önerilen Çalışma Adımı'].map(x => h('th', null, x)))),
          h('tbody', null, plan.steps.slice(0, 6).map(st => h('tr', null,
            h('td', { class: 'num' }, h('b', null, '#' + st.oncelik)),
            h('td', null, h('b', null, st.ders)),
            h('td', null, st.baslik),
            h('td', null, st.detay)
          )))
        )
      ));
    }
  }
  page.append(krFoot());
  return page;
}

/* ---------------------------------------------------------------- sınıf / okul raporu */
function krReportPages(exams, roster, cls, opt) {
  const classes = anClasses(exams), sc = snScale(exams), lm = snPresent(exams), school = schoolByCode(AN.okul), name = cls ? cls + ' sınıfı' : 'Tüm okul', nEx = exams.length;
  const all = snStudents(exams, roster), grp = all.filter(s => !cls || s.sinif === cls), taken = grp.filter(s => s.took > 0), ranked = snRank(taken, 'avg'), rosterN = Array.from(roster.values()).filter(s => !cls || s.sinif === cls).length;
  const gp = exams.map(n => snGV(n, cls, 'pct', sc)), op = exams.map(n => snGV(n, '', 'pct', sc)), L = ogLbl(exams), S = ogSub(exams), F = ogFull(exams), li = snLastIdx(gp), pi = li >= 0 ? snPrevIdx(gp, li) : -1, bi = snArgMax(gp), slope = ogSlope(gp);
  const part = exams.map(n => (rosterN ? snRowsOf(n, cls).length / Math.max(rosterN, snRowsOf(n, cls).length) * 100 : null)), dL = li >= 0 && pi >= 0 ? gp[li] - gp[pi] : null;
  const hi60 = taken.filter(s => s.avg != null && s.avg >= 60).length, lo40 = taken.filter(s => s.avg != null && s.avg < 40).length;
  const sec = (t, ...kids) => h('section', { class: 'kr-sec' }, h('h3', null, t), ...kids);
  const p1 = h('section', { class: 'kr-page', 'data-kind': 'rapor' }, krHead((cls ? 'SINIF' : 'OKUL') + ' SINAV RAPORU', school),
    h('div', { class: 'kr-id kr-id3' }, h('div', null, h('span', null, 'Kapsam'), h('b', null, name)), h('div', null, h('span', null, 'Öğrenci'), h('b', null, `${taken.length} / ${rosterN} sınava girdi`)), h('div', null, h('span', null, 'Sınavlar'), h('b', null, krRange(exams)))),
    h('div', { class: 'kr-kpis' }, krKpi(ogP(ogMean(gp)), 'ortalama başarı', cls ? 'okul ' + ogP(ogMean(op)) : ''), krKpi(li >= 0 ? ogP(gp[li]) : '', 'son sınav ortalaması', dL != null ? `${dL > 0 ? '▲' : dL < 0 ? '▼' : '＝'} ${ogSgn(dL, 1, ' puan')}` : ''), krKpi(slope != null ? ogSgn(slope, 1, ' puan') : '', 'sınav başına değişim', ogTrendWord(slope)), krKpi(bi >= 0 ? ogP(gp[bi]) : '', 'en iyi sınav', bi >= 0 ? krCut(exams[bi].name, 18) : ''), krKpi(ogMean(part) != null ? '%' + nf(ogMean(part), 0) : '', 'ortalama katılım'), krKpi(taken.length ? `%${nf(hi60 / taken.length * 100, 0)} / %${nf(lo40 / taken.length * 100, 0)}` : '', 'ort. %60+ / %40 altı', `${hi60} / ${lo40} öğrenci`)));
  if (opt.chart) p1.append(sec('Sınav sınav başarı (%)', krChart(AnViz.line({ h: 190, labels: L, sub: S, full: F, label: name + ' gelişimi', fmt: v => nf(v, 1) + '%', yFmt: v => nf(v, 0) + '%', floor: 0, ceil: 100, series: snGroupSeries(exams, classes, cls, (n, s) => snGV(n, s, 'pct', sc)) }))));
  p1.append(sec('Sınav sonuçları', h('table', { class: 'kr-table zebra-tbl' }, h('thead', null, h('tr', null, ['Tarih', 'Sınav'].map(x => h('th', null, x)), ['Katılan', 'Katılım', 'Ort. başarı', 'Değişim'].concat(cls ? ['Okul ort.'] : [], ['En yüksek', 'En düşük']).map(x => h('th', { class: 'num' }, x)))),
    h('tbody', null, exams.map((n, i) => { const v = snRowsOf(n, cls).map(r => ogPct(r.net, n.totalQ)).filter(x => x != null), p = i ? snPrevIdx(gp, i) : -1, d = p >= 0 && gp[i] != null ? gp[i] - gp[p] : null; return h('tr', null, h('td', { class: 'nowrap' }, anFmtDate(n.date)), h('td', null, n.name), h('td', { class: 'num' }, snRowsOf(n, cls).length), h('td', { class: 'num' }, part[i] == null ? '' : '%' + nf(part[i], 0)), h('td', { class: 'num', style: snHeat(gp[i], ogMean(gp)) }, h('b', null, ogP(gp[i]))), h('td', { class: 'num' }, d == null ? '' : ogSgn(d, 1, ' puan')), cls ? h('td', { class: 'num' }, ogP(op[i])) : null, h('td', { class: 'num' }, v.length ? ogP(Math.max(...v)) : ''), h('td', { class: 'num' }, v.length ? ogP(Math.min(...v)) : '')); })))));
  if (lm.length) { const gA = lm.map(x => ogMean(exams.map(n => snLV(n, cls, x.nk)))), oA = lm.map(x => ogMean(exams.map(n => snLV(n, '', x.nk))));
    p1.append(sec('Ders ders başarı (ortalama %)', h('table', { class: 'kr-table zebra-tbl' }, h('thead', null, h('tr', null, h('th', null, 'Ders'), h('th', { class: 'num' }, 'Ort. başarı'), h('th', { class: 'kr-barcol' }, 'Başarı' + (cls ? ' (çizgi: okul ort.)' : '')), cls ? [h('th', { class: 'num' }, 'Okul ort.'), h('th', { class: 'num' }, 'Fark')] : null, h('th', null, 'Gidiş'))),
      h('tbody', null, lm.map((x, i) => { const d = cls && gA[i] != null && oA[i] != null ? gA[i] - oA[i] : null; return h('tr', null, h('td', null, h('span', { class: 'vz-key vz-b' + x.slot }), ' ', x.name), h('td', { class: 'num' }, h('b', null, ogP(gA[i]))), h('td', { class: 'kr-barcol' }, krBar(gA[i], cls ? oA[i] : null)), cls ? [h('td', { class: 'num' }, ogP(oA[i])), h('td', { class: 'num', style: snHeat(d, 0, 15) }, d == null ? '' : ogSgn(d, 1))] : null, h('td', null, anSpark(exams.map(n => snLV(n, cls, x.nk))))); }))))); }
  if (opt.notes) { const notes = []; if (li >= 0) { const f0 = snFirstIdx(gp); notes.push(f0 !== li ? `${name} ortalama başarısı: ${ogP(gp[f0])} → ${ogP(gp[li])} (${ogSgn(gp[li] - gp[f0], 1, ' puan')}); ${ogTrendWord(slope)}.` : `${name} ortalama başarısı ${ogP(gp[li])}.`); }
    const lv = lm.map(x => ({ x, v: ogMean(exams.map(n => snLV(n, cls, x.nk))) })).filter(o => o.v != null).sort((a, b) => b.v - a.v); if (lv.length >= 2) notes.push(`En güçlü ders: ${lv[0].x.name} (${ogP(lv[0].v)}); en zayıf ders: ${lv[lv.length - 1].x.name} (${ogP(lv[lv.length - 1].v)}).`);
    if (!cls && classes.length > 1) { const cr = classes.map(c => ({ c, v: ogMean(exams.map(n => snGV(n, c, 'pct', sc))) })).filter(o => o.v != null).sort((a, b) => b.v - a.v); if (cr.length > 1) notes.push(`En yüksek sınıf ortalaması ${cr[0].c} (${ogP(cr[0].v)}), en düşük ${cr[cr.length - 1].c} (${ogP(cr[cr.length - 1].v)}).`); }
    if (taken.length) notes.push(`${taken.length} öğrenciden ${hi60} tanesinin ortalaması %60 ve üzerinde, ${lo40} tanesinin %40'ın altındadır.`);
    if (exams.some(n => n.totalQ !== exams[0].totalQ)) notes.push(`Not: sınavların soru sayıları farklıdır (${Array.from(new Set(exams.map(n => n.totalQ))).join(', ')}); karşılaştırma başarı yüzdesi üzerindendir.`);
    if (notes.length) p1.append(sec('Değerlendirme', h('ul', { class: 'kr-notes' }, notes.map(t => h('li', null, t))))); }
  p1.append(krFoot(['Rehber öğretmen', 'Okul müdürü']));
  const pages = [p1];
  // --- 2. sayfa: sınıf raporunda öğrenci listesi; okul raporunda sınıf listesi
  const p2 = h('section', { class: 'kr-page kr-list', 'data-kind': 'liste' }, krHead((cls ? 'SINIF ÖĞRENCİ LİSTESİ' : 'SINIF LİSTESİ') + ' · ' + name, school));
  if (cls) {
    p2.append(h('table', { class: 'kr-table kr-wide zebra-tbl' }, h('thead', null, h('tr', null, ['Sıra', 'Ö.No', 'Ad Soyad'].map(x => h('th', null, x)), h('th', { class: 'num' }, 'Sınav'), exams.map((n, i) => h('th', { class: 'num', title: F[i] }, L[i])), ['Ort. %', 'Son değ.'].map(x => h('th', { class: 'num' }, x)))),
      h('tbody', null, ranked.map(s => h('tr', null, h('td', { class: 'num' }, s.rank), h('td', { class: 'nowrap' }, s.no), h('td', null, s.ad || '(adı yok)'), h('td', { class: 'num' }, `${s.took}/${nEx}`), s.pct.map((v, i) => h('td', { class: 'num', style: snHeat(v, gp[i]) }, v == null ? '' : nf(v, 0))), h('td', { class: 'num' }, h('b', null, ogP(s.avg))), h('td', { class: 'num' }, s.dLast == null ? '' : ogSgn(s.dLast, 1)))))));
    if (!ranked.length) p2.append(h('p', { class: 'muted' }, 'Bu sınıftan sınava giren öğrenci yok.'));
    p2.append(h('p', { class: 'kr-cap' }, 'Hücreler başarı yüzdesidir; renk sınıf ortalamasına göre farkı gösterir (mavi: üstünde, kırmızı: altında). Sıra, girilen sınavların ortalamasına göredir.'));
  } else {
    const cr = classes.map(c => { const ps = exams.map(n => snGV(n, c, 'pct', sc)), rn = Array.from(roster.values()).filter(s => s.sinif === c).length; return { c, rn, took: all.filter(s => s.sinif === c && s.took > 0).length, ps, avg: ogMean(ps) }; }).sort((a, b) => (b.avg == null ? -1 : b.avg) - (a.avg == null ? -1 : a.avg));
    p2.append(h('table', { class: 'kr-table kr-wide zebra-tbl' }, h('thead', null, h('tr', null, h('th', { class: 'num' }, 'Sıra'), h('th', null, 'Sınıf'), h('th', { class: 'num' }, 'Öğrenci'), exams.map((n, i) => h('th', { class: 'num', title: F[i] }, L[i])), h('th', { class: 'num' }, 'Ort. %'))),
      h('tbody', null, cr.map((r, i) => h('tr', null, h('td', { class: 'num' }, i + 1), h('td', null, h('b', null, r.c)), h('td', { class: 'num' }, r.took === r.rn ? r.rn : `${r.took}/${r.rn}`), r.ps.map((v, k) => h('td', { class: 'num', style: snHeat(v, op[k]) }, v == null ? '' : nf(v, 1))), h('td', { class: 'num' }, h('b', null, ogP(r.avg))))))));
    p2.append(h('p', { class: 'kr-cap' }, 'Hücreler sınıfın o sınavdaki ortalama başarı yüzdesidir; renk okul ortalamasına göre farkı gösterir.'));
  }
  p2.append(krFoot(['Rehber öğretmen', 'Okul müdürü'])); pages.push(p2);
  return pages;
}

/* ---------------------------------------------------------------- sekme */
function karneRender(pane, sel, ctx) {
  krToken++; krBusy = false;
  const exams = ogSorted(sel), roster = ogRoster(exams), classes = anClasses(exams), school = schoolByCode(AN.okul), mode = AN.krMode;
  const opt = { rank: AN.krRank, notes: AN.krNotes, chart: AN.krChart, plan: AN.krPlan, profile: AN.krProfile };
  const ck = mode === 'sinif' ? 'krScls' : mode === 'rapor' ? 'krRcls' : 'krCls';   // sınıf seçimi sekme moduna göre ayrı tutulur
  if (AN[ck] === undefined) AN[ck] = mode === 'sinif' && classes.length ? (AN.cls && classes.includes(AN.cls) ? AN.cls : classes[0]) : '';
  if (AN[ck] && !classes.includes(AN[ck])) AN[ck] = '';
  const cur = AN[ck];
  const stuNo = mode === 'ogr' ? (AN.krStu || AN.stu || '') : '';
  const q = h('input', { type: 'search', id: 'kr-q', placeholder: 'Öğrenci no ya da ad…', autocomplete: 'off', 'aria-label': 'Öğrenci ara' }), hits = h('div', { class: 'og-hits', id: 'kr-hits' });
  const pick = no => { AN.krStu = no; ctx.renderTab(); };
  const paint = () => { clear(hits); const f = ogFind(roster, q.value); if (q.value.trim() && !f.length) hits.append(h('span', { class: 'small muted' }, 'Eşleşen öğrenci yok.')); f.forEach(s => hits.append(h('button', { type: 'button', class: 'btn sm og-hit', 'data-no': s.no, onclick: () => pick(s.no) }, `${s.no} · ${s.ad || '(adı yok)'}${s.sinif ? ' · ' + s.sinif : ''}`))); };
  q.addEventListener('input', paint); q.addEventListener('keydown', e => { if (e.key === 'Enter') { const f = ogFind(roster, q.value); if (f.length) pick(f[0].no); } });
  const stuCls = h('select', { id: 'kr-stucls', 'aria-label': 'Sınıfa göre öğrenci seç', onchange: e => { AN.krCls = e.target.value; ctx.renderTab(); } }, h('option', { value: '' }, 'Sınıfa göre seç…'), classes.map(c => h('option', { value: c }, c))); stuCls.value = cur;
  const clsAll = h('select', { id: 'kr-cls', 'aria-label': 'Sınıf', onchange: e => { AN[ck] = e.target.value; ctx.renderTab(); } }, mode === 'rapor' ? h('option', { value: '' }, 'Tüm okul') : h('option', { value: '' }, 'Tüm sınıflar (' + classes.length + ')'), classes.map(c => h('option', { value: c }, c + ' sınıfı'))); clsAll.value = cur;
  const tog = (id, key, label) => h('label', { class: 'kr-tog' }, h('input', { type: 'checkbox', id, checked: AN[key], style: { width: 'auto', minHeight: 0 }, onchange: e => { AN[key] = e.target.checked; ctx.renderTab(); } }), ' ' + label);
  const status = h('span', { class: 'small muted', id: 'kr-status' }), printBtn = h('button', { class: 'btn primary', id: 'kr-print', onclick: () => anPrint() }, '🖨 Yazdır / PDF olarak kaydet');
  pane.append(h('div', { class: 'card no-print', id: 'kr-ctl' }, h('div', { class: 'row an-f' }, h('b', null, 'Karne'), ogSeg([['ogr', 'Öğrenci karnesi'], ['sinif', 'Sınıf karneleri (her öğrenci bir sayfa)'], ['rapor', 'Sınıf / okul raporu']], mode, k => { AN.krMode = k; ctx.renderTab(); }),
    mode === 'ogr' ? [q, stuCls] : clsAll, h('span', { class: 'grow' }), status, printBtn),
    h('div', { class: 'row an-f', style: { marginTop: '.5rem' } },
      ogSeg([['kocluk', 'Koçluk Raporu'], ['rehberlik', 'Rehberlik Raporu'], ['idare', 'İdare / Kurul']], AN.krProfile, p => { AN.krProfile = p; ctx.renderTab(); }),
      tog('kr-t-rank', 'krRank', 'Sıralamalar'),
      tog('kr-t-chart', 'krChart', 'Grafik'),
      tog('kr-t-notes', 'krNotes', 'Koçluk yorumu'),
      tog('kr-t-plan', 'krPlan', 'Eylem planı'),
      h('span', { class: 'small muted' }, `${exams.length} işaretli sınav karneye girer.`)),
    mode === 'ogr' ? hits : null,
    h('p', { class: 'small muted', style: { margin: '.5rem 0 0' } }, 'PDF için: “Yazdır / PDF” düğmesine basın, açılan pencerede hedef olarak “PDF olarak kaydet” seçin (kâğıt A4 dikey, arka plan grafikleri açık).')));
  if (mode === 'ogr' && cur && !q.value) { const inCls = Array.from(roster.values()).filter(s => s.sinif === cur).sort(ogByName); hits.append(inCls.map(s => h('button', { type: 'button', class: 'btn sm og-hit' + (s.no === stuNo ? ' primary' : ''), 'data-no': s.no, onclick: () => pick(s.no) }, `${s.no} · ${s.ad || '(adı yok)'}`))); }
  const wrap = h('div', { class: 'kr-wrap', id: 'kr-wrap' }); pane.append(wrap);
  krLast = { mode, exams, roster, cls: cur };
  if (mode === 'ogr') {
    if (!stuNo || !roster.get(stuNo)) { wrap.append(h('div', { class: 'empty card no-print', id: 'kr-empty' }, 'Bir öğrencinin numarasını ya da adını yazın ya da sınıf seçip listeden tıklayın; karnesi A4 sayfa olarak hazırlanır.')); status.textContent = ''; return; }
    const m = ogModel(stuNo, exams, roster); krLast.stu = m;
    if (!m.taken.length) { wrap.append(h('div', { class: 'alert warn' }, 'Bu öğrenci işaretli sınavların hiçbirine girmemiş; karne oluşturulamaz.')); return; }
    wrap.append(krStudentPage(m, exams, school, opt)); status.textContent = '1 karne hazır'; return;
  }
  if (mode === 'rapor') { const pages = krReportPages(exams, roster, cur, opt); pages.forEach(p => wrap.append(p)); status.textContent = `${pages.length} sayfa hazır`; return; }
  // --- sınıf karneleri: parça parça üretilir (çok öğrencili sınıflarda ekran donmasın)
  const list = Array.from(roster.values()).filter(s => !cur || s.sinif === cur).sort((a, b) => String(a.sinif).localeCompare(String(b.sinif), 'tr', { numeric: true }) || ogByName(a, b));
  const jobs = list.map(s => s.no); let i = 0, made = 0, skipped = 0; const token = krToken; krBusy = true; printBtn.disabled = true;
  if (!jobs.length) { wrap.append(h('div', { class: 'empty card no-print' }, 'Bu sınıfta öğrenci yok.')); krBusy = false; printBtn.disabled = false; return; }
  const step = () => {
    if (token !== krToken || !wrap.isConnected) return;
    const end = Math.min(jobs.length, i + 5);
    for (; i < end; i++) { const m = ogModel(jobs[i], exams, roster); if (!m.taken.length) { skipped++; continue; } wrap.append(krStudentPage(m, exams, school, opt)); made++; }
    status.textContent = i < jobs.length ? `Karneler hazırlanıyor… ${i} / ${jobs.length}` : `${made} karne hazır` + (skipped ? ` · ${skipped} öğrenci hiçbir sınava girmediği için karne yok` : '');
    if (i < jobs.length) setTimeout(step, 0); else { krBusy = false; printBtn.disabled = false; if (!made) wrap.append(h('div', { class: 'alert warn' }, 'Hiçbir öğrenci işaretli sınavlara girmemiş; karne yok.')); wrap.setAttribute('data-done', '1'); }
  };
  step();
}

function karneExport(sel, ctx) {
  const m = krLast; if (!m) return;
  if (m.mode === 'ogr') { if (!m.stu) return toast('Önce bir öğrenci seçin', 'warn'); const old = AN.stu; AN.stu = m.stu.no; try { ogStudentExport(sel, ctx); } finally { AN.stu = old; } return; }
  const { exams, roster } = m, cls = m.cls, all = snStudents(exams, roster).filter(s => !cls || s.sinif === cls), taken = all.filter(s => s.took > 0), lm = snPresent(exams);
  snRank(taken, 'avg');
  const rows = [ogHd(['Sıra', 'Ö.No', 'Ad Soyad', 'Sınıf', 'Girdiği sınav', ...exams.map(n => n.name + ' (başarı %)'), 'Ort. başarı %', 'Ort. net', 'Son değişim (puan)', ...lm.map(x => x.name + ' (ort. %)')])].concat(taken.slice().sort((a, b) => (a.rank == null ? 1e9 : a.rank) - (b.rank == null ? 1e9 : b.rank)).map(s => [s.rank, s.no, s.ad, s.sinif, `${s.took} / ${exams.length}`, ...s.pct.map(ogN2), ogN2(s.avg), ogN2(s.avgNet), ogN2(s.dLast), ...lm.map(x => ogN2(s.lavg.get(x.nk)))]));
  ogDownload(`karne-listesi-${(cls || 'okul').replace(/[^\w-]+/g, '_')}.xlsx`, [{ name: 'Karne listesi', rows, freeze: { row: 1, col: 3 } }]);
}
ANTABS.push({ id: 'karne', label: 'Karneler', filters: [], render: karneRender, export: karneExport });
