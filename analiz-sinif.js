/* analiz-sinif.js — Sınıf Analizi sekmesi, ortak analiz yardımcıları ve Sınıf Bazlı Ortak Kazanım Eylem Planı
 * Sıraç Aksan Optik Okuma · Telif Hakkı © Sıraç AKSAN (İzinsiz kopyalamak, dağıtmak veya telif atmak ayıptır.)
 * Yardımcılar (snScale, snPresent, snStudents, snRank, snTable, snHeat vb.) analiz-okul.js, analiz-ogr.js ve analiz-karne.js tarafından paylaşılır.
 */
'use strict';

const SN_BANDS = ['0–20', '20–40', '40–60', '60–80', '80–100'];
let snLast = null;

function snNormKey(s) {
  return String(s || '').toLocaleLowerCase('tr')
    .replace(/[ıİ]/g, 'i').replace(/[şŞ]/g, 's').replace(/[ğĞ]/g, 'g')
    .replace(/[üÜ]/g, 'u').replace(/[öÖ]/g, 'o').replace(/[çÇ]/g, 'c')
    .replace(/[^a-z0-9]/g, '');
}

function snBand(v) {
  if (v == null || !isFinite(v)) return 0;
  if (v < 20) return 0;
  if (v < 40) return 1;
  if (v < 60) return 2;
  if (v < 80) return 3;
  return 4;
}

function snFirstIdx(a) { for (let i = 0; i < a.length; i++) if (a[i] != null && isFinite(a[i])) return i; return -1; }
function snLastIdx(a) { for (let i = a.length - 1; i >= 0; i--) if (a[i] != null && isFinite(a[i])) return i; return -1; }
function snPrevIdx(a, from) { for (let i = from - 1; i >= 0; i--) if (a[i] != null && isFinite(a[i])) return i; return -1; }
function snArgMax(a) { let bi = -1, bv = -Infinity; a.forEach((v, i) => { if (v != null && isFinite(v) && v > bv) { bv = v; bi = i; } }); return bi; }
function snArgMin(a) { let wi = -1, wv = Infinity; a.forEach((v, i) => { if (v != null && isFinite(v) && v < wv) { wv = v; wi = i; } }); return wi; }

function snScale(exams) {
  const counts = new Map();
  (exams || []).forEach(n => {
    const nm = (n.puanAdi || 'Puan').trim();
    counts.set(nm, (counts.get(nm) || 0) + 1);
  });
  const names = Array.from(counts.keys());
  let topName = names[0] || 'Puan', topCnt = -1;
  counts.forEach((cnt, nm) => { if (cnt > topCnt) { topCnt = cnt; topName = nm; } });
  const ids = new Set((exams || []).filter(n => ((n.puanAdi || 'Puan').trim() === topName)).map(n => n.id));
  return { name: topName, names, mixed: names.length > 1, ids };
}

function snPresent(exams) {
  const map = new Map();
  let slot = 1;
  (exams || []).forEach(n => {
    (n.lessons || []).forEach(l => {
      const nk = snNormKey(l.name);
      if (!nk) return;
      if (!map.has(nk)) {
        map.set(nk, { nk, name: l.name, slot: ((slot - 1) % 8) + 1 });
        slot++;
      }
    });
  });
  return Array.from(map.values());
}

function snRowsOf(n, cls) {
  const rows = anRows(n) || [];
  return cls ? rows.filter(r => String(r.sinif || '') === String(cls)) : rows;
}

function snGV(n, cls, metric, sc) {
  const rows = snRowsOf(n, cls);
  if (!rows.length) return null;
  if (metric === 'net') return ogMean(rows.map(r => r.net));
  if (metric === 'puan') return (sc && !sc.ids.has(n.id)) ? null : ogMean(rows.map(r => r.puan));
  return ogMean(rows.map(r => ogPct(r.net, n.totalQ)));
}

function snLV(n, cls, nk) {
  const lessons = n.lessons || [];
  const idx = lessons.findIndex(l => snNormKey(l.name) === nk);
  if (idx < 0 || !lessons[idx].count) return null;
  const rows = snRowsOf(n, cls);
  if (!rows.length) return null;
  const cnt = lessons[idx].count, pen = n.penalty || 0;
  const vals = rows.map(r => {
    const sec = r.sec && r.sec[idx];
    if (!sec) return null;
    const net = sec[3] != null ? Number(sec[3]) : (Number(sec[0] || 0) - Number(sec[1] || 0) * pen);
    return ogPct(net, cnt);
  }).filter(v => v != null);
  return ogMean(vals);
}

function snStudents(exams, roster) {
  const lm = snPresent(exams);
  const out = [];
  roster.forEach((info, no) => {
    const pct = [], nets = [], puans = [];
    const lmap = new Map();
    let took = 0;
    exams.forEach(n => {
      const r = (anRows(n) || []).find(x => normNo(x.no || x.ogrNo) === normNo(no));
      if (!r) { pct.push(null); nets.push(null); puans.push(null); return; }
      took++;
      const p = ogPct(r.net, n.totalQ);
      pct.push(p);
      nets.push(r.net != null ? Number(r.net) : null);
      puans.push(r.puan != null ? Number(r.puan) : null);
      (n.lessons || []).forEach((l, li) => {
        const sec = r.sec && r.sec[li];
        if (!sec || !l.count) return;
        const nk = snNormKey(l.name);
        const net = sec[3] != null ? Number(sec[3]) : (Number(sec[0] || 0) - Number(sec[1] || 0) * (n.penalty || 0));
        const lp = ogPct(net, l.count);
        if (lp != null) {
          if (!lmap.has(nk)) lmap.set(nk, []);
          lmap.get(nk).push(lp);
        }
      });
    });
    const fi = snFirstIdx(pct), li = snLastIdx(pct), pi = li >= 0 ? snPrevIdx(pct, li) : -1;
    const lavg = new Map();
    lm.forEach(x => { lavg.set(x.nk, lmap.has(x.nk) ? ogMean(lmap.get(x.nk)) : null); });
    out.push({
      no,
      ad: info.ad || '',
      sinif: info.sinif || '',
      took,
      pct,
      nets,
      puans,
      avg: ogMean(pct),
      avgNet: ogMean(nets),
      avgPuan: ogMean(puans),
      first: fi >= 0 ? pct[fi] : null,
      last: li >= 0 ? pct[li] : null,
      gain: fi >= 0 && li > fi ? pct[li] - pct[fi] : null,
      dLast: li >= 0 && pi >= 0 ? pct[li] - pct[pi] : null,
      lavg,
      rank: null
    });
  });
  return out;
}

function snRank(list, key) {
  const k = key || 'avg';
  const sorted = list.slice().sort((a, b) => {
    const va = a[k] == null ? -Infinity : a[k];
    const vb = b[k] == null ? -Infinity : b[k];
    return vb - va || String(a.ad || '').localeCompare(String(b.ad || ''), 'tr');
  });
  let r = 0;
  sorted.forEach((item, i) => {
    if (item[k] == null) { item.rank = null; return; }
    if (i === 0 || item[k] !== sorted[i - 1][k]) r = i + 1;
    item.rank = r;
  });
  return sorted;
}

function snHeat(v, ref, span) {
  if (v == null || ref == null || !isFinite(v) || !isFinite(ref)) return null;
  const d = v - ref, lim = span || 20, t = Math.max(-1, Math.min(1, d / lim));
  if (Math.abs(t) < 0.05) return null;
  const alpha = (0.08 + Math.abs(t) * 0.24).toFixed(2);
  return { background: t > 0 ? `rgba(37,99,235,${alpha})` : `rgba(220,38,38,${alpha})` };
}

function snCell(v, ref) {
  return h('td', { class: 'num', style: snHeat(v, ref) }, ogP(v));
}

function snPrintHead(pane, title) {
  const sch = schoolByCode(AN.okul);
  pane.append(h('div', { class: 'print-only', style: { marginBottom: '.6rem', borderBottom: '1px solid #cbd5e1', paddingBottom: '.35rem' } },
    h('b', null, sch ? sch.okulAdi : 'Okul'), ' · ', title, ' · ', new Date().toLocaleDateString('tr-TR')));
}

function snNote(pane, id, notes) {
  if (!notes || !notes.length) return;
  pane.append(h('div', { class: 'card', id },
    h('h2', null, 'Değerlendirme'),
    h('ul', { class: 'kr-notes', style: { margin: 0, paddingLeft: '1.2rem' } }, notes.map(t => h('li', null, t)))));
}

function snTable(id, cols, rows, opt) {
  opt = opt || {};
  return h('div', { class: 'tablewrap' },
    h('table', { class: 'an-table zebra-tbl', id },
      h('thead', null, h('tr', null, cols.map(c => h('th', { class: c.num ? 'num' : '', title: c.title || '' }, c.label)))),
      h('tbody', null, rows.map(r => {
        const cls = (opt.onRow ? 'an-row ' : '') + (opt.cls ? opt.cls(r) : '');
        return h('tr', { class: cls.trim(), onclick: opt.onRow ? () => opt.onRow(r) : null }, cols.map(c => c.cell(r)));
      }))
    )
  );
}

function snStuCols(opt) {
  opt = opt || {};
  const cols = [
    { label: 'Sıra', num: true, cell: s => h('td', { class: 'num' }, s.rank ?? '') },
    { label: 'Ö.No', cell: s => h('td', { class: 'nowrap mono' }, s.no) },
    { label: 'Ad Soyad', cell: s => h('td', null, s.ad || '(adı yok)') }
  ];
  if (opt.cls) cols.push({ label: 'Sınıf', cell: s => h('td', null, s.sinif || '') });
  cols.push({ label: 'Sınav', num: true, cell: s => h('td', { class: 'num' }, `${s.took} / ${opt.nEx || 0}`) });
  return cols;
}

function snBandsOf(pairs, byCls, classes) {
  const showCls = byCls ? (classes || []).slice(0, 8) : [''];
  const matrix = SN_BANDS.map(() => showCls.map(() => 0));
  (pairs || []).forEach(([v, c]) => {
    if (v == null || !isFinite(v)) return;
    const bi = snBand(v);
    if (!byCls) { matrix[bi][0]++; return; }
    const ci = showCls.indexOf(c);
    if (ci >= 0) matrix[bi][ci]++;
  });
  return {
    cats: SN_BANDS.map((b, i) => ({ label: '%' + b, vals: matrix[i] })),
    series: byCls ? showCls.map((c, i) => ({ name: c, c: (i % 8) + 1 })) : [{ name: 'Öğrenci', c: 1 }]
  };
}

function snGroupSeries(exams, classes, cls, fn) {
  if (cls) {
    return [
      { name: cls + ' sınıfı', c: 1, pts: exams.map(n => fn(n, cls)) },
      { name: 'Okul ortalaması', c: 2, dash: true, pts: exams.map(n => fn(n, '')) }
    ];
  }
  const ser = [{ name: 'Okul ortalaması', c: 1, pts: exams.map(n => fn(n, '')) }];
  (classes || []).slice(0, 6).forEach((c, i) => {
    ser.push({ name: c, c: ((i + 1) % 8) + 1, dash: true, pts: exams.map(n => fn(n, c)) });
  });
  return ser;
}

/* ================================================================ SINIF BAZLI ORTAK KAZANIM EYLEM PLANI */
/**
 * Seçili sınıf (veya tüm okul) için sınavlardaki ortak yanlış/boş soruları ve ders eksiklerini
 * analiz ederek Zümre / Sınıf Rehberlik toplantılarına hazır ortak eylem planı üretir.
 */
function snBuildClassActionPlan(exams, cls) {
  const topicAgg = new Map();
  const lessonAgg = new Map();
  let totalParticipants = 0;

  (exams || []).forEach(ex => {
    const rows = snRowsOf(ex, cls);
    if (!rows.length) return;
    totalParticipants += rows.length;

    const kazList = (ex.config && Array.isArray(ex.config.kazanimlar)) ? ex.config.kazanimlar : [];
    const byQ = new Map(kazList.map(k => [Number(k.soru), k]));
    const keys = (ex.config && ex.config.keys) || {};
    const defKey = keys[Object.keys(keys)[0] || ''] || '';

    // Ders ortalamaları
    (ex.lessons || []).forEach((l, li) => {
      if (!l.count) return;
      let sumPct = 0, cnt = 0, sumY = 0, sumB = 0;
      rows.forEach(r => {
        const sec = r.sec && r.sec[li];
        if (!sec) return;
        const d = Number(sec[0] || 0), y = Number(sec[1] || 0), b = Number(sec[2] || 0);
        const net = sec[3] != null ? Number(sec[3]) : (d - y * (ex.penalty || 0));
        sumPct += ogPct(net, l.count) || 0;
        sumY += y; sumB += b; cnt++;
      });
      if (!cnt) return;
      const cur = lessonAgg.get(l.name) || { ders: l.name, pctSum: 0, n: 0, avgY: 0, avgB: 0 };
      cur.pctSum += (sumPct / cnt);
      cur.avgY += (sumY / cnt);
      cur.avgB += (sumB / cnt);
      cur.n++;
      lessonAgg.set(l.name, cur);
    });

    // Soru / Kazanım bazlı ortak eksikler
    if (defKey) {
      const qLen = defKey.length;
      for (let q = 1; q <= qLen; q++) {
        let wrong = 0, blank = 0, valid = 0;
        rows.forEach(r => {
          const bk = (r.booklet && keys[r.booklet]) ? r.booklet : Object.keys(keys)[0] || '';
          const kCh = (keys[bk] || defKey).charAt(q - 1);
          const aCh = String(r.answers || '').charAt(q - 1) || '-';
          if (!kCh || kCh === '.' || kCh === '*') return;
          valid++;
          if (aCh === '-' || aCh === '*') blank++;
          else if (aCh !== kCh) wrong++;
        });
        if (!valid) continue;
        const miss = wrong + blank;
        const missRate = (miss / valid) * 100;
        if (missRate < 35) continue; // %35 ve üzeri ortak eksik olarak önceliklendirilir

        const kz = byQ.get(q);
        let ders = (kz && kz.ders) ? kz.ders : '';
        if (!ders) {
          let acc = 0;
          for (const l of (ex.lessons || [])) {
            acc += Number(l.count || 0);
            if (q <= acc) { ders = l.name; break; }
          }
        }
        const konu = kz ? (kz.konu || kz.kod || `${q}. soru kazanımı`) : `${ex.name} · ${q}. soru`;
        const gk = `${ders}||${konu}`;
        const cur = topicAgg.get(gk) || { ders: ders || 'Genel', kod: kz ? (kz.kod || '') : '', konu, missSum: 0, validSum: 0, wrongSum: 0, blankSum: 0, sorular: [] };
        cur.missSum += miss;
        cur.validSum += valid;
        cur.wrongSum += wrong;
        cur.blankSum += blank;
        cur.sorular.push(q);
        topicAgg.set(gk, cur);
      }
    }
  });

  const steps = [];
  if (topicAgg.size) {
    Array.from(topicAgg.values())
      .map(x => Object.assign({}, x, { rate: x.validSum ? (x.missSum / x.validSum) * 100 : 0 }))
      .sort((a, b) => b.rate - a.rate)
      .slice(0, 10)
      .forEach((g, idx) => {
        const advice = g.rate >= 65
          ? 'Sınıf genelinde kritik konu eksiği → Ders içinde 1–2 saatlik toplu konu tekrarı ve pekiştirme fasikülü uygulanmalı.'
          : 'Orta düzeyde yaygın hata → Örnek soru çözümü + DYK / etüt saatinde kazanım testi ile telafi edilmeli.';
        steps.push({
          oncelik: idx + 1,
          ders: g.ders,
          baslik: g.kod ? `[${g.kod}] ${g.konu}` : g.konu,
          oran: Math.round(g.rate * 10) / 10,
          etkilenen: `${g.missSum} / ${g.validSum} (${g.wrongSum}Y, ${g.blankSum}B)`,
          detay: `Sorular: ${g.sorular.join(', ')} → ${advice}`
        });
      });
  } else if (lessonAgg.size) {
    Array.from(lessonAgg.values())
      .map(x => ({ ders: x.ders, avgPct: x.pctSum / Math.max(1, x.n), avgY: x.avgY / Math.max(1, x.n), avgB: x.avgB / Math.max(1, x.n) }))
      .sort((a, b) => a.avgPct - b.avgPct)
      .slice(0, 5)
      .forEach((l, idx) => {
        steps.push({
          oncelik: idx + 1,
          ders: l.ders,
          baslik: `${l.ders} — Sınıf Ort. %${nf(l.avgPct, 1)}`,
          oran: Math.round((100 - l.avgPct) * 10) / 10,
          etkilenen: `Ort. ${nf(l.avgY, 1)}Y · ${nf(l.avgB, 1)}B`,
          detay: 'Sınavlara kazanım haritası yüklendiğinde soru bazlı hedefler görünür; mevcut durumda bu derste haftalık tekrar etüdü önerilir.'
        });
      });
  }

  return { scope: cls ? cls + ' sınıfı' : 'Tüm okul', participants: totalParticipants, steps };
}

function snClassActionPlanCard(exams, cls) {
  const plan = snBuildClassActionPlan(exams, cls);
  if (!plan.steps.length) return null;
  return h('div', { class: 'card', id: 'sn-action-plan' },
    h('div', { class: 'row between' },
      h('h2', { style: { margin: 0 } }, `Sınıf Bazlı Ortak Kazanım Eylem Planı · ${plan.scope}`),
      h('span', { class: 'pill brand' }, `${plan.steps.length} öncelikli konu`)
    ),
    h('p', { class: 'small muted', style: { margin: '.35rem 0 .6rem' } }, 'Sınıfın %35 ve üzerinde yanlış/boş bıraktığı ortak kazanımlar öncelik sırasıyla listelenir (zümre ve rehberlik toplantıları için yazdırılabilir).'),
    h('div', { class: 'tablewrap' },
      h('table', { class: 'an-table zebra-tbl' },
        h('thead', null, h('tr', null, ['Öncelik', 'Ders', 'Ortak Eksik Konu / Kazanım', 'Hata+Boş %', 'Etkilenen', 'Önerilen Zümre / Sınıf Eylemi'].map((t, i) => h('th', { class: i === 3 ? 'num' : '' }, t)))),
        h('tbody', null, plan.steps.map(st => h('tr', null,
          h('td', { class: 'num' }, h('b', null, '#' + st.oncelik)),
          h('td', null, h('b', null, st.ders)),
          h('td', null, st.baslik),
          h('td', { class: 'num', style: { color: st.oran >= 65 ? 'var(--bad)' : 'var(--warn)', fontWeight: '700' } }, '%' + nf(st.oran, 1)),
          h('td', { class: 'small nowrap' }, st.etkilenen),
          h('td', { class: 'small' }, st.detay)
        )))
      )
    )
  );
}

/* ================================================================ SINIF SEKMESİ */
function sinifRender(pane, sel, ctx) {
  const exams = ogSorted(sel), roster = ogRoster(exams), classes = anClasses(exams), sc = snScale(exams), lm = snPresent(exams), nEx = exams.length;
  const cls = AN.cls && classes.includes(AN.cls) ? AN.cls : '';
  const scopeName = cls ? cls + ' sınıfı' : 'Tüm okul';
  const L = ogLbl(exams), S = ogSub(exams), F = ogFull(exams);
  const all = snStudents(exams, roster), grp = all.filter(s => !cls || s.sinif === cls), taken = grp.filter(s => s.took > 0), ranked = snRank(taken, 'avg');
  const rosterN = Array.from(roster.values()).filter(s => !cls || s.sinif === cls).length;
  const gp = exams.map(n => snGV(n, cls, 'pct', sc)), op = exams.map(n => snGV(n, '', 'pct', sc));
  const li = snLastIdx(gp), pi = li >= 0 ? snPrevIdx(gp, li) : -1, slope = ogSlope(gp), dL = li >= 0 && pi >= 0 ? gp[li] - gp[pi] : null;
  const part = exams.map(n => (rosterN ? snRowsOf(n, cls).length / Math.max(rosterN, snRowsOf(n, cls).length) * 100 : null));
  const gA = lm.map(x => ogMean(exams.map(n => snLV(n, cls, x.nk)))), oA = lm.map(x => ogMean(exams.map(n => snLV(n, '', x.nk))));

  snPrintHead(pane, 'Sınıf analiz raporu · ' + scopeName);

  // Üst özet
  pane.append(h('div', { class: 'card og-head', id: 'sn-head' },
    h('div', { class: 'row between' },
      h('div', null,
        h('h2', { style: { marginBottom: '.1rem' } }, scopeName),
        h('div', { class: 'small muted' }, `${nEx} sınav · ${rosterN} kayıtlı öğrenci · ${taken.length} öğrenci sınava girdi`)
      ),
      h('span', { class: 'pill brand' }, ogTrendWord(slope))
    ),
    h('div', { class: 'stats', style: { marginTop: '.7rem' } },
      ogStat(ogP(ogMean(gp)), 'ort. başarı', cls ? 'okul ort. ' + ogP(ogMean(op)) : 'tüm sınavlar'),
      ogStat(li >= 0 ? ogP(gp[li]) : '–', 'son sınav başarı', dL != null ? `${dL > 0 ? '▲' : dL < 0 ? '▼' : '＝'} ${ogSgn(dL, 1, ' puan')}` : ''),
      ogStat(slope != null ? ogSgn(slope, 1, ' puan') : '–', 'sınav başına değişim', ogTrendWord(slope)),
      ogStat(ogMean(part) != null ? '%' + nf(ogMean(part), 0) : '–', 'ort. katılım')
    )
  ));

  // Sınıf Bazlı Ortak Kazanım Eylem Planı
  const planCard = snClassActionPlanCard(exams, cls);
  if (planCard) pane.append(planCard);

  // Gelişim grafiği
  pane.append(h('div', { class: 'card' },
    h('h2', null, 'Sınav sınav gelişim · başarı %'),
    AnViz.line({
      labels: L, sub: S, full: F, label: scopeName + ' gelişimi',
      fmt: v => nf(v, 1) + '%', yFmt: v => nf(v, 0) + '%', floor: 0, ceil: 100,
      series: snGroupSeries(exams, classes, cls, (n, c) => snGV(n, c, 'pct', sc))
    })
  ));

  // Ders × sınav ısı tablosu
  if (lm.length) {
    pane.append(h('div', { class: 'card' },
      h('h2', null, 'Ders × sınav başarı %'),
      h('div', { class: 'tablewrap' },
        h('table', { class: 'an-table zebra-tbl', id: 'sn-lessons' },
          h('thead', null, h('tr', null,
            h('th', null, 'Ders'),
            exams.map((n, i) => h('th', { class: 'num', title: F[i] }, L[i])),
            h('th', { class: 'num' }, 'Ort.'),
            cls ? h('th', { class: 'num' }, 'Okul ort.') : null
          )),
          h('tbody', null, lm.map((x, i) => h('tr', null,
            h('td', null, h('span', { class: 'vz-key vz-b' + x.slot }), ' ', x.name),
            exams.map(n => snCell(snLV(n, cls, x.nk), snLV(n, '', x.nk))),
            h('td', { class: 'num' }, h('b', null, ogP(gA[i]))),
            cls ? h('td', { class: 'num' }, ogP(oA[i])) : null
          )))
        )
      )
    ));
  }

  // Başarı dağılımı
  const bd = snBandsOf(taken.map(s => [s.avg, s.sinif]), false, classes);
  pane.append(h('div', { class: 'card' },
    h('h2', null, 'Başarı dağılımı'),
    AnViz.cols({ cats: bd.cats, series: bd.series, stack: false, int: true, label: 'Sınıf başarı dağılımı' })
  ));

  // Öğrenci sıralaması
  const stuCols = snStuCols({ cls: !cls, nEx }).concat(
    exams.map((n, i) => ({ label: L[i], num: true, title: F[i], cell: s => snCell(s.pct[i], gp[i]) })),
    [
      { label: 'Ort. %', num: true, cell: s => h('td', { class: 'num' }, h('b', null, ogP(s.avg))) },
      { label: 'Son değ.', num: true, cell: s => h('td', { class: 'num' }, s.dLast == null ? '' : anDelta(s.dLast, 'pct')) },
      { label: 'Gelişim', cell: s => h('td', null, anSpark(s.pct)) }
    ]
  );
  pane.append(h('div', { class: 'card' },
    h('h2', null, `Öğrenci sıralaması (${ranked.length})`),
    ranked.length
      ? snTable('sn-students', stuCols, ranked, { onRow: s => ctx.openStudent(s.no) })
      : h('div', { class: 'empty' }, 'Bu sınıfta sınava giren öğrenci yok.')
  ));

  snLast = { exams, cls, scopeName, ranked, lm, gA, oA, gp, nEx, rosterN };
}

function sinifExport(sel, ctx) {
  const m = snLast;
  if (!m) return;
  const { exams, cls, scopeName, ranked, lm, gA, oA, nEx } = m;
  const plan = snBuildClassActionPlan(exams, cls);

  const stuRows = [ogHd(['Sıra', 'Ö.No', 'Ad Soyad', 'Sınıf', 'Girdiği sınav', ...exams.map(n => n.name + ' (%)'), 'Ort. %', 'Son değişim'])].concat(
    ranked.map(s => [s.rank, s.no, s.ad, s.sinif, `${s.took}/${nEx}`, ...s.pct.map(ogN2), ogN2(s.avg), ogN2(s.dLast)])
  );
  const lesRows = [ogHd(['Ders', ...exams.map(n => n.name + ' (%)'), 'Sınıf Ort. %', 'Okul Ort. %'])].concat(
    lm.map((x, i) => [x.name, ...exams.map(n => ogN2(snLV(n, cls, x.nk))), ogN2(gA[i]), ogN2(oA[i])])
  );
  const sheets = [
    { name: 'Öğrenciler', rows: stuRows, freeze: { row: 1, col: 3 } },
    { name: 'Dersler', rows: lesRows, freeze: { row: 1, col: 1 } }
  ];
  if (plan.steps.length) {
    sheets.unshift({
      name: 'Sınıf Eylem Planı',
      rows: [ogHd(['Öncelik', 'Ders', 'Ortak Eksik Konu / Kazanım', 'Hata+Boş %', 'Etkilenen', 'Önerilen Eylem'])].concat(
        plan.steps.map(st => [st.oncelik, st.ders, st.baslik, st.oran, st.etkilenen, st.detay])
      )
    });
  }
  ogDownload(`sinif-analizi-${scopeName.replace(/[^\w-]+/g, '_').slice(0, 40)}.xlsx`, sheets);
}

ANTABS.push({ id: 'sinif', label: 'Sınıf', filters: ['cls'], render: sinifRender, export: sinifExport });
