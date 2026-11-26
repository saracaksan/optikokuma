/* analiz-ogr.js — Öğrenci Analizi sekmesi, ortak og* yardımcıları ve Kişiye Özel Konu/Kazanım Eylem Planı
 * Sıraç Aksan Optik Okuma · Telif Hakkı © Sıraç AKSAN (İzinsiz kopyalamak, dağıtmak veya telif atmak ayıptır.)
 * Yardımcılar (ogSorted, ogRoster, ogModel, ogFind, ogMean, ogPct, ogP, ogSgn, ogSlope, ogTrendWord, ogLbl, ogSub, ogFull, ogStat, ogNotes, ogN2, ogHd, ogDownload, ogSeg)
 * analiz-sinif.js, analiz-okul.js ve analiz-karne.js tarafından paylaşılır.
 */
'use strict';

/* ================================================================ ORTAK YARDIMCILAR (og*) */
const OG_MET = {
  pct: { l: 'Başarı %', f: v => (v == null || !isFinite(v)) ? '–' : '%' + nf(v, 1), u: ' puan', d: 1 },
  net: { l: 'Net', f: v => (v == null || !isFinite(v)) ? '–' : nf(v, 2), u: ' net', d: 2 },
  puan: { l: 'Puan', f: v => (v == null || !isFinite(v)) ? '–' : nf(v, 1), u: ' puan', d: 1 }
};
function ogKey(r, li) {
  if (!r || typeof r !== 'object') return anNk(r);
  if (li != null && li >= 0) {
    const s = r.sec && r.sec[li];
    return s && s[3] != null ? Number(s[3]) : null;
  }
  return r.puan != null ? Number(r.puan) : (r.net != null ? Number(r.net) : null);
}
const ogSorted = sel => (sel || []).slice().sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999') || String(a.name || '').localeCompare(String(b.name || ''), 'tr'));
const ogMean = arr => { const v = (arr || []).filter(x => x != null && isFinite(x)); return v.length ? v.reduce((a, b) => a + Number(b), 0) / v.length : null; };
const ogPct = (net, totalQ) => (net != null && isFinite(net) && totalQ > 0) ? Math.max(0, Math.min(100, (Number(net) / Number(totalQ)) * 100)) : null;
const ogP = v => (v == null || !isFinite(v)) ? '–' : '%' + nf(v, 1);
const ogSgn = (v, d = 1, unit = '') => (v == null || !isFinite(v)) ? '' : `${v > 0 ? '+' : ''}${nf(v, d)}${unit}`;
const ogN2 = v => (v == null || !isFinite(v)) ? null : { v: Math.round(Number(v) * 100) / 100, s: 'n2' };
const ogHd = cols => (cols || []).map(x => ({ v: x, s: 'h' }));
const ogByName = (a, b) => String(a.ad || '').localeCompare(String(b.ad || ''), 'tr') || String(a.no || '').localeCompare(String(b.no || ''), undefined, { numeric: true });

function ogSlope(arr) {
  const pts = [];
  (arr || []).forEach((v, i) => { if (v != null && isFinite(v)) pts.push([i, Number(v)]); });
  if (pts.length < 2) return null;
  const n = pts.length, mx = pts.reduce((a, p) => a + p[0], 0) / n, my = pts.reduce((a, p) => a + p[1], 0) / n;
  let num = 0, den = 0;
  pts.forEach(([x, y]) => { num += (x - mx) * (y - my); den += (x - mx) * (x - mx); });
  return den ? num / den : 0;
}

function ogTrendWord(sl) {
  if (sl == null || !isFinite(sl)) return 'tek sınav';
  if (sl >= 2.5) return 'güçlü yükseliş';
  if (sl >= 0.6) return 'yükseliş eğilimi';
  if (sl <= -2.5) return 'belirgin düşüş';
  if (sl <= -0.6) return 'düşüş eğilimi';
  return 'dengeli seyir';
}

const ogLbl = exams => (exams || []).map(n => { const s = String(n.name || ''); return s.length > 14 ? s.slice(0, 13) + '…' : s; });
const ogSub = exams => (exams || []).map(n => anFmtDate(n.date).slice(0, 5));
const ogFull = exams => (exams || []).map(n => `${n.name || ''}${n.date ? ' (' + anFmtDate(n.date) + ')' : ''}`);
const ogStat = (v, l, sub) => h('div', { class: 'stat' }, h('b', null, v == null || v === '' ? '–' : v), h('span', null, l), sub ? h('small', { class: 'muted' }, sub) : null);

function ogSeg(items, val, onChange) {
  return h('div', { class: 'seg' }, (items || []).map(([id, lbl]) =>
    h('button', { type: 'button', class: 'btn sm' + (val === id ? ' primary' : ''), onclick: () => onChange(id) }, lbl)
  ));
}

function ogDownload(filename, sheets) {
  if (typeof XlsxLite !== 'undefined' && XlsxLite.write) {
    download(filename, XlsxLite.write(sheets), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    toast('Excel indirildi', 'ok');
  } else {
    toast('Excel kütüphanesi (xlsx-lite.js) bulunamadı.', 'bad');
  }
}

/** Seçili sınavlardaki tüm benzersiz dersleri (anNk(ad) → { nk, name, slot, count }) haritası olarak döndürür. */
function ogLessonMap(exams) {
  const m = new Map();
  let slot = 1;
  (exams || []).forEach(n => {
    (n.lessons || []).forEach(l => {
      const nk = anNk(l && l.name);
      if (!nk) return;
      if (!m.has(nk)) {
        m.set(nk, { nk, name: l.name, slot: ((slot - 1) % 8) + 1, count: l.count || 0 });
        slot++;
      } else if (l.count && !m.get(nk).count) {
        m.get(nk).count = l.count;
      }
    });
  });
  return m;
}

/** Okul öğrenci listesi + seçili sınavlardaki tüm öğrencileri tek haritada toplar (key = normNo). */
function ogRoster(exams) {
  const m = new Map();
  const cachedNames = AN.names && AN.names.get(String(AN.okul));
  if (cachedNames) {
    cachedNames.forEach((s, no) => {
      const k = normNo(no);
      m.set(k, { no: k, ad: `${s.ad || ''} ${s.soyad || ''}`.trim(), sinif: String(s.sinif || '') });
    });
  }
  (exams || []).forEach(n => {
    (anRows(n) || []).forEach(r => {
      const k = normNo(r.no || r.ogrNo);
      if (!k) return;
      const cur = m.get(k) || { no: k, ad: '', sinif: '' };
      if (!cur.ad && r.ad) cur.ad = String(r.ad).trim();
      if (!cur.sinif && r.sinif) cur.sinif = String(r.sinif).trim();
      m.set(k, cur);
    });
  });
  return m;
}

function ogFind(roster, q) {
  const t = String(q || '').trim().toLocaleLowerCase('tr');
  const all = Array.from(roster.values()).sort(ogByName);
  if (!t) return all.slice(0, 40);
  return all.filter(s => `${s.no} ${s.ad} ${s.sinif}`.toLocaleLowerCase('tr').includes(t)).slice(0, 40);
}

/** Tek öğrenci için tüm seçili sınavların ve derslerin ayrıntılı analiz modelini üretir. */
function ogModel(stuNo, exams, roster) {
  const no = normNo(stuNo);
  const info = roster.get(no) || { no, ad: '', sinif: '' };
  const per = [];
  const lesMap = new Map();
  let slot = 1;

  (exams || []).forEach(n => {
    const allR = anRows(n) || [];
    const r = allR.find(x => normNo(x.no || x.ogrNo) === no) || null;
    const clsName = (r && r.sinif) || info.sinif || '';
    const clsRows = clsName ? allR.filter(x => String(x.sinif || '') === String(clsName)) : allR;
    const okPct = ogMean(allR.map(x => ogPct(x.net, n.totalQ)));
    const clsPct = ogMean(clsRows.map(x => ogPct(x.net, n.totalQ)));
    const pct = r ? ogPct(r.net, n.totalQ) : null;

    // Sıralama bilgisi (dosyada varsa o, yoksa okul/sınıf içi hesaplanan)
    let rk = null;
    if (r) {
      const sortedOk = allR.slice().sort((a, b) => (b.puan != null ? b.puan : b.net) - (a.puan != null ? a.puan : a.net));
      const sortedCls = clsRows.slice().sort((a, b) => (b.puan != null ? b.puan : b.net) - (a.puan != null ? a.puan : a.net));
      const okIdx = sortedOk.findIndex(x => normNo(x.no || x.ogrNo) === no);
      const clsIdx = sortedCls.findIndex(x => normNo(x.no || x.ogrNo) === no);
      rk = {
        snf: (r.rk && r.rk.snf != null) ? r.rk.snf : (clsIdx >= 0 ? clsIdx + 1 : null),
        snfN: clsRows.length || null,
        okul: (r.rk && r.rk.okul != null) ? r.rk.okul : (okIdx >= 0 ? okIdx + 1 : null),
        okulN: allR.length || null
      };
    }

    per.push({ n, r, pct, cls: { pct: clsPct }, ok: { pct: okPct }, rk });

    // Ders bazlı toplama
    (n.lessons || []).forEach((l, li) => {
      const nk = anNk(l.name);
      if (!nk) return;
      if (!lesMap.has(nk)) {
        lesMap.set(nk, { nk, name: l.name, slot: ((slot - 1) % 8) + 1, Ds: [], Ys: [], Bs: [], nets: [], pcts: [], clsPcts: [], rows: [] });
        slot++;
      }
      const entry = lesMap.get(nk);
      const sec = r && r.sec && r.sec[li];
      if (sec && l.count) {
        const d = Number(sec[0] || 0), y = Number(sec[1] || 0), b = sec[2] != null ? Number(sec[2]) : Math.max(0, l.count - d - y);
        const net = sec[3] != null ? Number(sec[3]) : (d - y * (n.penalty || 0));
        const lp = ogPct(net, l.count);
        const clsLp = ogMean(clsRows.map(x => {
          const sx = x.sec && x.sec[li];
          if (!sx) return null;
          const nx = sx[3] != null ? Number(sx[3]) : (Number(sx[0] || 0) - Number(sx[1] || 0) * (n.penalty || 0));
          return ogPct(nx, l.count);
        }));
        entry.Ds.push(d); entry.Ys.push(y); entry.Bs.push(b); entry.nets.push(net);
        if (lp != null) entry.pcts.push(lp);
        if (clsLp != null) entry.clsPcts.push(clsLp);
        entry.rows.push({ n, d, y, b, net, pct: lp });
      } else {
        entry.rows.push(null);
      }
    });
  });

  const les = Array.from(lesMap.values()).map(e => ({
    nk: e.nk, name: e.name, slot: e.slot,
    D: ogMean(e.Ds), Y: ogMean(e.Ys), B: ogMean(e.Bs), net: ogMean(e.nets),
    pct: ogMean(e.pcts), clsPct: ogMean(e.clsPcts), rows: e.rows
  }));

  return {
    no,
    ad: info.ad || '',
    sinif: info.sinif || '',
    per,
    taken: per.filter(p => !!p.r),
    les
  };
}

function ogNotes(m) {
  const out = [], took = m.taken || [], pcs = took.map(p => p.pct).filter(v => v != null);
  if (!took.length) return out;
  if (pcs.length >= 2) {
    const diff = pcs[pcs.length - 1] - pcs[0];
    out.push(`İlk sınavdan son sınava genel başarı: %${nf(pcs[0], 1)} → %${nf(pcs[pcs.length - 1], 1)} (${ogSgn(diff, 1, ' puan')}; ${ogTrendWord(ogSlope(pcs))}).`);
  } else if (pcs.length === 1) {
    out.push(`Girilen sınavda genel başarı yüzdesi %${nf(pcs[0], 1)} olarak gerçekleşti.`);
  }
  const clsAvg = ogMean(took.map(p => p.cls.pct)), myAvg = ogMean(pcs);
  if (myAvg != null && clsAvg != null) {
    const d = myAvg - clsAvg;
    out.push(`Ortalama başarı (%${nf(myAvg, 1)}) sınıf ortalamasının (%${nf(clsAvg, 1)}) ${Math.abs(d) < 1 ? 'hemen yanında' : (d > 0 ? nf(d, 1) + ' puan üzerinde' : nf(Math.abs(d), 1) + ' puan altında')}.`);
  }
  const les = (m.les || []).filter(l => l.pct != null).sort((a, b) => b.pct - a.pct);
  if (les.length >= 2) {
    out.push(`En yüksek başarı ${les[0].name} (%${nf(les[0].pct, 1)}), en çok destek gereken ders ${les[les.length - 1].name} (%${nf(les[les.length - 1].pct, 1)}).`);
  }
  const miss = (m.per ? m.per.length : 0) - took.length;
  if (miss > 0) out.push(`Seçili sınavlardan ${miss} tanesine katılım sağlanmamış.`);
  return out;
}

/* ================================================================ KİŞİYE ÖZEL KONU / KAZANIM EYLEM PLANI */
function ogBuildActionPlan(stuNo, exams, roster) {
  const no = normNo(stuNo);
  const s = roster.get(no);
  const weakTopics = [];
  const lessonGaps = new Map();

  (exams || []).forEach(ex => {
    const r = (anRows(ex) || ex.rows || []).find(x => normNo(x.no || x.ogrNo) === no);
    if (!r) return;
    const kazList = (ex.config && Array.isArray(ex.config.kazanimlar)) ? ex.config.kazanimlar : [];
    const byQ = new Map(kazList.map(k => [Number(k.soru), k]));
    const keys = (ex.config && ex.config.keys) || {};
    const bk = (r.booklet && keys[r.booklet]) ? r.booklet : Object.keys(keys)[0] || '';
    const keyStr = keys[bk] || '';
    const ansStr = String(r.answers || '');

    // Ders bazlı eksikler
    (ex.lessons || []).forEach((l, idx) => {
      const sec = (r.sec && r.sec[idx]) || null;
      if (!sec || !l.count) return;
      const d = Number(sec[0] || 0), y = Number(sec[1] || 0), b = sec[2] != null ? Number(sec[2]) : Math.max(0, l.count - d - y);
      const net = sec[3] != null ? Number(sec[3]) : (d - y * (ex.penalty || 0));
      const pct = Math.max(0, Math.min(100, (net / l.count) * 100));
      const cur = lessonGaps.get(l.name) || { ders: l.name, pctSum: 0, n: 0, wrong: 0, blank: 0 };
      cur.pctSum += pct;
      cur.n += 1;
      cur.wrong += y;
      cur.blank += b;
      lessonGaps.set(l.name, cur);
    });

    // Kazanım bazlı yanlış/boş sorular
    if (keyStr && ansStr) {
      for (let q = 1; q <= keyStr.length; q++) {
        const kCh = keyStr.charAt(q - 1);
        const aCh = ansStr.charAt(q - 1) || '-';
        if (!kCh || kCh === '.' || kCh === '*') continue;
        const isWrong = aCh !== '-' && aCh !== '*' && aCh !== kCh;
        const isBlank = aCh === '-' || aCh === '*';
        if (isWrong || isBlank) {
          const kz = byQ.get(q);
          const topicLabel = kz ? (kz.konu || kz.kod || `${q}. soru kazanımı`) : `${q}. soru (${ex.name})`;
          const dersLabel = (kz && kz.ders) ? kz.ders : ogLessonOfQ_(ex, q);
          weakTopics.push({
            examName: ex.name,
            soru: q,
            ders: dersLabel || 'Genel',
            kod: kz ? (kz.kod || '') : '',
            konu: topicLabel,
            durum: isWrong ? 'Yanlış' : 'Boş'
          });
        }
      }
    }
  });

  const prioritizedLessons = Array.from(lessonGaps.values())
    .map(x => ({ ders: x.ders, avgPct: x.pctSum / Math.max(1, x.n), wrong: x.wrong, blank: x.blank }))
    .sort((a, b) => a.avgPct - b.avgPct);

  const steps = [];
  if (weakTopics.length) {
    const grouped = new Map();
    weakTopics.forEach(w => {
      const key = `${w.ders}||${w.konu}`;
      const g = grouped.get(key) || { ders: w.ders, kod: w.kod, konu: w.konu, yanlis: 0, bos: 0, sorular: [] };
      if (w.durum === 'Yanlış') g.yanlis++; else g.bos++;
      g.sorular.push(w.soru);
      grouped.set(key, g);
    });
    Array.from(grouped.values()).slice(0, 8).forEach((g, idx) => {
      steps.push({
        oncelik: idx + 1,
        ders: g.ders,
        baslik: g.kod ? `[${g.kod}] ${g.konu}` : g.konu,
        detay: `${g.yanlis} yanlış, ${g.bos} boş (Sorular: ${g.sorular.join(', ')}) → Önce konu özeti tekrarı, ardından 25–30 yeni nesil/kazanım sorusu.`
      });
    });
  } else if (prioritizedLessons.length) {
    prioritizedLessons.slice(0, 4).forEach((l, idx) => {
      steps.push({
        oncelik: idx + 1,
        ders: l.ders,
        baslik: `${l.ders} — Ort. Başarı %${nf(l.avgPct, 1)}`,
        detay: `Toplam ${l.wrong} yanlış ve ${l.blank} boş tespit edildi → Haftalık 2 gün düzenli soru pratiği ve yanlış defteri tutma.`
      });
    });
  }

  return {
    studentName: s ? (s.ad || no) : no,
    weakTopics,
    prioritizedLessons,
    steps
  };
}

function ogLessonOfQ_(ex, qNo) {
  let acc = 0;
  for (const l of (ex.lessons || [])) {
    const cnt = Number(l.count || 0);
    if (qNo > acc && qNo <= acc + cnt) return l.name;
    acc += cnt;
  }
  return '';
}

function ogActionPlanCard(stuNo, exams, roster) {
  const plan = ogBuildActionPlan(stuNo, exams, roster);
  if (!plan.steps.length) return null;
  return h('div', { class: 'card', id: 'og-action-plan' },
    h('div', { class: 'row between' },
      h('h2', { style: { margin: 0 } }, 'Otomatik Konu / Kazanım Eylem Planı'),
      h('span', { class: 'pill brand' }, `${plan.steps.length} öncelikli adım`)
    ),
    h('p', { class: 'small muted', style: { margin: '.35rem 0 .6rem' } }, `${plan.studentName} için denemelerdeki yanlış/boş sorular ve ders başarılarına göre otomatik oluşturulmuş bireysel çalışma planıdır.`),
    h('div', { class: 'tablewrap' },
      h('table', { class: 'an-table zebra-tbl' },
        h('thead', null, h('tr', null, ['Öncelik', 'Ders', 'Konu / Kazanım', 'Çalışma & Eylem Adımı'].map(x => h('th', null, x)))),
        h('tbody', null, plan.steps.map(st => h('tr', null,
          h('td', { class: 'num' }, h('b', null, '#' + st.oncelik)),
          h('td', null, h('b', null, st.ders)),
          h('td', null, st.baslik),
          h('td', { class: 'small' }, st.detay)
        )))
      )
    )
  );
}

/* ================================================================ ÖĞRENCİ SEKMESİ */
let ogLast = null;

function ogRender(pane, sel, ctx) {
  const exams = ogSorted(sel);
  const roster = ogRoster(exams);
  const classes = anClasses(exams);
  const stuNo = AN.stu && roster.has(normNo(AN.stu)) ? normNo(AN.stu) : '';
  if (!stuNo && AN.stu) AN.stu = '';

  snPrintHead(pane, 'Öğrenci gelişim analizi');

  const qInput = h('input', {
    type: 'search',
    id: 'og-q',
    placeholder: 'Öğrenci no veya ad soyad yazın…',
    autocomplete: 'off',
    oninput: () => paintHits()
  });
  const clsSel = h('select', {
    id: 'og-cls',
    onchange: e => { AN.cls = e.target.value; paintHits(); }
  }, h('option', { value: '' }, 'Tüm sınıflar'), classes.map(c => h('option', { value: c }, c)));
  if (AN.cls && classes.includes(AN.cls)) clsSel.value = AN.cls;

  const hits = h('div', { class: 'og-hits', id: 'og-hits' });
  function paintHits() {
    clear(hits);
    const list = ogFind(roster, qInput.value).filter(s => !clsSel.value || s.sinif === clsSel.value).slice(0, 30);
    if (!list.length) {
      hits.append(h('span', { class: 'small muted' }, 'Eşleşen öğrenci bulunamadı.'));
      return;
    }
    list.forEach(s => {
      const on = s.no === stuNo;
      hits.append(h('button', {
        type: 'button',
        class: 'btn sm og-hit' + (on ? ' primary' : ''),
        onclick: () => { AN.stu = s.no; ctx.draw(); }
      }, `${s.no} · ${s.ad || '(adı yok)'}${s.sinif ? ' · ' + s.sinif : ''}`));
    });
  }
  paintHits();

  pane.append(
    h('div', { class: 'card no-print', id: 'og-pick' },
      h('div', { class: 'row an-f' }, h('b', null, 'Öğrenci Seç'), qInput, clsSel),
      hits
    )
  );

  if (!stuNo) {
    ogLast = null;
    pane.append(h('div', { class: 'empty card' }, 'Analizini ve kişiye özel eylem planını görmek için yukarıdan bir öğrenci seçin.'));
    return;
  }

  const m = ogModel(stuNo, exams, roster);
  ogLast = m;
  const took = m.taken, per = m.per;
  const pcs = took.map(p => p.pct).filter(v => v != null);
  const nets = took.map(p => p.r.net).filter(v => v != null);
  const last = took[took.length - 1], prevT = took[took.length - 2];
  const dL = last && prevT && last.pct != null && prevT.pct != null ? last.pct - prevT.pct : null;
  const gain = pcs.length > 1 ? pcs[pcs.length - 1] - pcs[0] : null;
  const clsAvg = ogMean(took.map(p => p.cls.pct));

  pane.append(
    h('div', { class: 'card og-head', id: 'og-head' },
      h('div', { class: 'row between' },
        h('div', null,
          h('h2', { style: { marginBottom: '.1rem' } }, m.ad || '(adı yok)'),
          h('div', { class: 'small muted' }, `No: ${m.no} · Sınıf: ${m.sinif || '–'} · Katılım: ${took.length} / ${per.length} sınav`)
        ),
        h('div', { class: 'row no-print' },
          h('button', { class: 'btn sm primary', onclick: () => { AN.krMode = 'ogr'; AN.krStu = m.no; AN.tab = 'karne'; ctx.draw(); window.scrollTo(0, 0); } }, '📄 Karnesini Aç'),
          h('span', { class: 'pill brand' }, ogTrendWord(ogSlope(pcs)))
        )
      ),
      h('div', { class: 'stats', style: { marginTop: '.7rem' } },
        ogStat(ogP(ogMean(pcs)), 'ort. başarı', clsAvg != null ? 'sınıf ort. ' + ogP(clsAvg) : ''),
        ogStat(nets.length ? nf(ogMean(nets), 2) : '–', 'ort. net', `${took.length} sınav`),
        ogStat(last && last.pct != null ? ogP(last.pct) : '–', 'son sınav başarı', dL != null ? ogSgn(dL, 1, ' puan') : ''),
        ogStat(gain != null ? ogSgn(gain, 1, ' puan') : '–', 'ilk → son değişim', 'seçili sınavlar')
      )
    )
  );

  // Otomatik Konu / Kazanım Eylem Planı
  const planCard = ogActionPlanCard(stuNo, exams, roster);
  if (planCard) pane.append(planCard);

  // Değerlendirme notları
  const notes = ogNotes(m);
  if (notes.length) snNote(pane, 'og-notes', notes);

  // Başarı gelişim grafiği
  if (per.length && typeof AnViz !== 'undefined') {
    pane.append(
      h('div', { class: 'card' },
        h('h2', null, 'Başarı Gelişim Grafiği (%)'),
        AnViz.line({
          labels: ogLbl(per.map(p => p.n)),
          sub: ogSub(per.map(p => p.n)),
          full: ogFull(per.map(p => p.n)),
          label: (m.ad || m.no) + ' gelişim',
          fmt: v => nf(v, 1) + '%',
          yFmt: v => nf(v, 0) + '%',
          floor: 0,
          ceil: 100,
          missText: 'girmedi',
          series: [
            { name: 'Öğrenci', c: 1, pts: per.map(p => p.r ? p.pct : null) },
            { name: 'Sınıf ort.', c: 2, dash: true, pts: per.map(p => p.r ? p.cls.pct : null) },
            { name: 'Okul ort.', c: 3, dash: true, pts: per.map(p => p.r ? p.ok.pct : null) }
          ]
        })
      )
    );
  }

  // Sınav sonuçları tablosu
  pane.append(
    h('div', { class: 'card' },
      h('h2', null, 'Sınav Sonuçları'),
      h('div', { class: 'tablewrap' },
        h('table', { class: 'an-table zebra-tbl' },
          h('thead', null, h('tr', null, ['Tarih', 'Sınav', 'D', 'Y', 'B', 'Net', 'Başarı %', 'Sınıf Ort. %'].map((x, i) => h('th', { class: i >= 2 ? 'num' : '' }, x)))),
          h('tbody', null, per.map(p => {
            if (!p.r) return h('tr', { class: 'kr-miss' }, h('td', { class: 'nowrap' }, anFmtDate(p.n.date)), h('td', null, p.n.name), h('td', { colspan: 6 }, 'Sınava girmedi'));
            return h('tr', null,
              h('td', { class: 'nowrap' }, anFmtDate(p.n.date)),
              h('td', null, p.n.name),
              h('td', { class: 'num' }, p.r.D ?? ''),
              h('td', { class: 'num' }, p.r.Y ?? ''),
              h('td', { class: 'num' }, p.r.B ?? ''),
              h('td', { class: 'num' }, h('b', null, nf(p.r.net))),
              h('td', { class: 'num' }, h('b', null, ogP(p.pct))),
              h('td', { class: 'num' }, ogP(p.cls.pct))
            );
          }))
        )
      )
    )
  );
}

function ogStudentExport(sel, ctx) {
  const m = ogLast;
  if (!m) return toast('Önce bir öğrenci seçin', 'warn');
  const exams = ogSorted(sel);
  const plan = ogBuildActionPlan(m.no, exams, ogRoster(exams));
  const rows = [ogHd(['Tarih', 'Sınav', 'D', 'Y', 'B', 'Net', 'Başarı %', 'Sınıf Ort. %'])].concat(
    m.per.map(p => p.r
      ? [anFmtDate(p.n.date), p.n.name, p.r.D, p.r.Y, p.r.B, ogN2(p.r.net), ogN2(p.pct), ogN2(p.cls.pct)]
      : [anFmtDate(p.n.date), p.n.name, '', '', '', '', 'Girmedi', ''])
  );
  const sheets = [{ name: 'Sonuçlar', rows, freeze: { row: 1, col: 2 } }];
  if (plan.steps.length) {
    sheets.push({
      name: 'Eylem Planı',
      rows: [ogHd(['Öncelik', 'Ders', 'Konu / Kazanım', 'Eylem Adımı'])].concat(plan.steps.map(s => [s.oncelik, s.ders, s.baslik, s.detay]))
    });
  }
  ogDownload(`ogrenci-analiz-${m.no}.xlsx`, sheets);
}

ANTABS.push({ id: 'ogr', label: 'Öğrenci', filters: [], render: ogRender, export: ogStudentExport });
