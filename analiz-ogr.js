/* analiz-ogr.js — Öğrenci sekmesi ve kazanım/konu bazlı otomatik eylem planı (Sıraç Aksan Optik Okuma) */
'use strict';

/**
 * Seçili sınavların kazanımlarını ve öğrencinin yanlış/boş sorularını analiz ederek
 * kişiye özel Konu / Kazanım Eylem Planı üretir.
 */
function ogBuildActionPlan(stuNo, exams, roster) {
  const s = roster.get(stuNo);
  const weakTopics = [];
  const lessonGaps = new Map();

  (exams || []).forEach(ex => {
    const r = (ex.rows || []).find(x => String(x.ogrNo) === String(stuNo));
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
      const d = Number(sec[0] || 0), y = Number(sec[1] || 0), b = Number(sec[2] || 0);
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
    studentName: s ? ((s.ad || '') + ' ' + (s.soyad || '')).trim() || stuNo : stuNo,
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

/**
 * Öğrenci Analiz Sekmesi (ogRender & ogExport).
 * Harici analiz yardımcılarını (ogSorted, ogRoster, ogModel, ogFind, ogByName, ogMean, ogP, ogSgn, ogSlope, ogTrendWord, ogLbl, ogSub, ogFull, ogStat, ogNotes, ogPct, ogN2, ogDownload, ogHd) kullanır.
 */
let ogLast = null;

function ogRender(pane, sel, ctx) {
  const exams = ogSorted(sel);
  const roster = ogRoster(exams);
  const classes = anClasses(exams);
  const stuNo = AN.stu && roster.has(AN.stu) ? AN.stu : '';
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
    pane.append(h('div', { class: 'empty card' }, 'Analizini ve eylem planını görmek için yukarıdan bir öğrenci seçin.'));
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
        h('span', { class: 'pill brand' }, ogTrendWord(ogSlope(pcs)))
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
  if (per.length) {
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

  // Sınav sonuçları tablosu (zebra-tbl)
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
