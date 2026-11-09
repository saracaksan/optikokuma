/*  katalog.js — hazır optik form + sınav programı kataloğu
 *  Her kayıt hem optik formun yerleşimini (ders ders sütunlar) hem de puanlama ayarını (soru sayısı,
 *  katsayı, yanlış kuralı, puan yöntemi) taşır. Tarayıcıda (window.Katalog) ve Node'da çalışır.
 *
 *  Hazır formlar sunucuya kaydedilmez: sınav ayarında templateId = "std:<kayıt>@<sayfaya sığdırma>" olarak tutulur
 *  ve form her cihazda bu kayıttan aynı şekilde üretilir (çevrimdışı da çalışır).
 *
 *  Not: Resmî sınavların (ÖSYM / MEB) ders ve soru sayıları yıllara göre değişebilir; katsayılar ve puan formülleri de
 *  her yıl sınavdan sonra açıklanır. Buradaki değerler okul/ilçe denemeleri için başlangıç ayarıdır, sınav ekranında düzenlenir.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Katalog = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const S = (name, count, coef, short) => ({ name, short: short || name, count, coef: coef == null ? 1 : coef });
  const ORTA = { choices: 4, penalty: 1 / 3 }, LISE = { choices: 5, penalty: 0.25 };

  const GROUPS = [
    { id: 'lgs', label: 'LGS ve ortaokul denemeleri', note: '4 şık · 3 yanlış 1 doğruyu götürür' },
    { id: 'tyt', label: 'TYT', note: '5 şık · 4 yanlış 1 doğruyu götürür' },
    { id: 'ayt', label: 'AYT', note: '5 şık · 4 yanlış 1 doğruyu götürür' },
    { id: 'kpss', label: 'KPSS · ALES · DGS · YDS', note: 'ÖSYM sınavları · 5 şık' },
    { id: 'coklu', label: 'Çok dersli kısa denemeler', note: 'Okul içi yazılı / deneme için' },
    { id: 'tek', label: 'Tek ders optikleri', note: 'Dersin sınavdaki soru sayısıyla hazır' }
  ];

  const E = [];
  const add = (o) => E.push(Object.assign({ digits: 8, booklets: ['A', 'B'], layout: 'lanes', method: 'std500', base: 100, max: 500 }, o));

  /* ------------------------------------------------------------------ LGS */
  add({
    id: 'lgs-90', group: 'lgs', name: 'LGS Deneme — 90 soru (6 ders)', desc: 'Sözel + sayısal oturum tek optikte. Standart puan 100–500.', ...ORTA, booklets: ['A', 'B', 'C', 'D'],
    sections: [S('Türkçe', 20, 4), S('Matematik', 20, 4), S('Fen Bilimleri', 20, 4, 'Fen Bil.'), S('T.C. İnkılap Tarihi ve Atatürkçülük', 10, 1, 'İnkılap'), S('Din Kültürü ve Ahlak Bilgisi', 10, 1, 'Din K.'), S('Yabancı Dil', 10, 1, 'Yab. Dil')]
  });
  add({
    id: 'lgs-sozel', group: 'lgs', name: 'LGS Sözel oturum — 50 soru', desc: 'Türkçe, İnkılap, Din Kültürü, Yabancı Dil.', ...ORTA, booklets: ['A', 'B', 'C', 'D'],
    sections: [S('Türkçe', 20, 4), S('T.C. İnkılap Tarihi ve Atatürkçülük', 10, 1, 'İnkılap'), S('Din Kültürü ve Ahlak Bilgisi', 10, 1, 'Din K.'), S('Yabancı Dil', 10, 1, 'Yab. Dil')]
  });
  add({
    id: 'lgs-sayisal', group: 'lgs', name: 'LGS Sayısal oturum — 40 soru', desc: 'Matematik ve Fen Bilimleri.', ...ORTA, booklets: ['A', 'B', 'C', 'D'],
    sections: [S('Matematik', 20, 4), S('Fen Bilimleri', 20, 4, 'Fen Bil.')]
  });
  add({
    id: 'tmf-60', group: 'lgs', name: 'Türkçe · Matematik · Fen — 3 × 20 = 60 soru', desc: 'Üç dersten 20’şer soru, eşit ağırlık.', ...ORTA, method: 'net',
    sections: [S('Türkçe', 20), S('Matematik', 20), S('Fen Bilimleri', 20, 1, 'Fen Bil.')]
  });
  add({
    id: 'tmfs-80', group: 'lgs', name: 'Türkçe · Matematik · Fen · Sosyal — 4 × 20 = 80 soru', desc: 'Ortaokul genel deneme.', ...ORTA, method: 'net',
    sections: [S('Türkçe', 20), S('Matematik', 20), S('Fen Bilimleri', 20, 1, 'Fen Bil.'), S('Sosyal Bilgiler', 20, 1, 'Sosyal')]
  });

  /* ------------------------------------------------------------------ TYT */
  add({
    id: 'tyt-120', group: 'tyt', name: 'TYT Deneme — 120 soru (4 test)', desc: 'Türkçe 40, Sosyal 20, Temel Matematik 40, Fen 20. Katsayılar eşit; ÖSYM yıllık katsayısını sınavda girin.', ...LISE,
    sections: [S('Türkçe', 40), S('Sosyal Bilimler', 20, 1, 'Sosyal'), S('Temel Matematik', 40, 1, 'T. Mat.'), S('Fen Bilimleri', 20, 1, 'Fen')]
  });
  add({
    id: 'tyt-sozel', group: 'tyt', name: 'TYT Türkçe + Sosyal — 60 soru', desc: 'Sözel bölüm.', ...LISE,
    sections: [S('Türkçe', 40), S('Sosyal Bilimler', 20, 1, 'Sosyal')]
  });
  add({
    id: 'tyt-sayisal', group: 'tyt', name: 'TYT Matematik + Fen — 60 soru', desc: 'Sayısal bölüm.', ...LISE,
    sections: [S('Temel Matematik', 40, 1, 'T. Mat.'), S('Fen Bilimleri', 20, 1, 'Fen')]
  });

  /* ------------------------------------------------------------------ AYT */
  add({
    id: 'ayt-say', group: 'ayt', name: 'AYT Sayısal — 80 soru', desc: 'Matematik 40, Fizik 14, Kimya 13, Biyoloji 13. Katsayılar 2024 SAY değerleridir; düzenleyin.', ...LISE,
    sections: [S('Matematik', 40, 3.19), S('Fizik', 14, 2.43), S('Kimya', 13, 3.07), S('Biyoloji', 13, 2.51)]
  });
  add({
    id: 'ayt-ea', group: 'ayt', name: 'AYT Eşit Ağırlık — 80 soru', desc: 'Matematik 40, Edebiyat 24, Tarih-1 10, Coğrafya-1 6. Katsayılar eşit; düzenleyin.', ...LISE,
    sections: [S('Matematik', 40), S('Türk Dili ve Edebiyatı', 24, 1, 'Edebiyat'), S('Tarih-1', 10), S('Coğrafya-1', 6, 1, 'Coğ-1')]
  });
  add({
    id: 'ayt-soz', group: 'ayt', name: 'AYT Sözel — 80 soru', desc: 'Edebiyat-Sosyal 1 ve Sosyal 2 testleri. Katsayılar eşit; düzenleyin.', ...LISE,
    sections: [S('Türk Dili ve Edebiyatı', 24, 1, 'Edebiyat'), S('Tarih-1', 10), S('Coğrafya-1', 6, 1, 'Coğ-1'), S('Tarih-2', 11), S('Coğrafya-2', 11, 1, 'Coğ-2'), S('Felsefe Grubu', 12, 1, 'Felsefe'), S('Din Kültürü / Ek Felsefe', 6, 1, 'Din K.')]
  });
  add({
    id: 'ayt-160', group: 'ayt', name: 'AYT tam — 160 soru (tüm testler)', desc: 'Dört testin hepsi tek optikte. Her öğrenci alanına göre 2 testi (80 soru) cevaplar.', ...LISE,
    sections: [S('Matematik', 40), S('Fizik', 14), S('Kimya', 13), S('Biyoloji', 13), S('Türk Dili ve Edebiyatı', 24, 1, 'Edebiyat'), S('Tarih-1', 10), S('Coğrafya-1', 6, 1, 'Coğ-1'), S('Tarih-2', 11), S('Coğrafya-2', 11, 1, 'Coğ-2'), S('Felsefe Grubu', 12, 1, 'Felsefe'), S('Din Kültürü / Ek Felsefe', 6, 1, 'Din K.')]
  });

  /* ------------------------------------------------------------------ KPSS · ALES · DGS · YDS */
  add({
    id: 'kpss-lisans', group: 'kpss', name: 'KPSS Lisans GY-GK — 120 soru', desc: 'Genel Yetenek 60 (Türkçe 30, Matematik 30), Genel Kültür 60. Genel Yetenek ve Genel Kültür %50’şer ağırlıkla, ağırlıklı net → 100 üzerinden.', ...LISE, method: 'net',
    sections: [S('Türkçe', 30, 0.25), S('Matematik', 30, 0.25, 'Matematik'), S('Tarih', 27, 0.225), S('Coğrafya', 18, 0.15), S('Vatandaşlık', 9, 0.075, 'Vatandaş.'), S('Güncel Bilgiler', 6, 0.05, 'Güncel')]
  });
  add({
    id: 'ales-100', group: 'kpss', name: 'ALES — 100 soru (Sözel 50 + Sayısal 50)', desc: 'Sözel ve Sayısal bölüm eşit ağırlık.', ...LISE, method: 'net',
    sections: [S('Sözel', 50), S('Sayısal', 50)]
  });
  add({
    id: 'dgs-100', group: 'kpss', name: 'DGS — 100 soru (Sayısal 50 + Sözel 50)', desc: 'Sayısal ve Sözel bölüm eşit ağırlık.', ...LISE, method: 'net',
    sections: [S('Sayısal', 50), S('Sözel', 50)]
  });
  add({
    id: 'yds-80', group: 'kpss', name: 'YDS / YÖKDİL — 80 soru', desc: 'Yanlış doğruyu götürmez; puan = doğru ÷ 80 × 100.', choices: 5, penalty: 0, method: 'net',
    sections: [S('Yabancı Dil', 80, 1, 'Yabancı Dil')]
  });

  /* ------------------------------------------------------------------ çok dersli kısa denemeler */
  add({ id: 'tm-40', group: 'coklu', name: 'Türkçe · Matematik — 2 × 20 = 40 soru', desc: 'İki ders yan yana.', ...ORTA, method: 'net', sections: [S('Türkçe', 20), S('Matematik', 20)] });
  add({ id: 'tmf-30', group: 'coklu', name: 'Türkçe · Matematik · Fen — 3 × 10 = 30 soru', desc: 'Kısa deneme.', ...ORTA, method: 'net', sections: [S('Türkçe', 10), S('Matematik', 10), S('Fen Bilimleri', 10, 1, 'Fen Bil.')] });
  add({ id: 'dort-40', group: 'coklu', name: 'Dört ders — 4 × 10 = 40 soru', desc: 'Türkçe, Matematik, Fen, Sosyal.', ...ORTA, method: 'net', sections: [S('Türkçe', 10), S('Matematik', 10), S('Fen Bilimleri', 10, 1, 'Fen Bil.'), S('Sosyal Bilgiler', 10, 1, 'Sosyal')] });
  add({ id: 'genel-40', group: 'coklu', name: 'Genel deneme — 40 soru (tek bölüm), 5 şık', desc: 'Yanlış doğruyu götürmez, 100 üzerinden.', choices: 5, penalty: 0, method: 'net', sections: [S('Genel', 40)] });
  add({ id: 'konu-20', group: 'coklu', name: 'Konu testi / kısa yazılı — 20 soru, 4 şık', desc: '4 yanlış 1 doğruyu götürür.', choices: 4, penalty: 0.25, method: 'net', sections: [S('Test', 20)] });
  add({ id: 'quiz-10', group: 'coklu', name: 'Mini sınav — 10 soru, 4 şık', desc: 'Yanlış doğruyu götürmez. 8’li sığdırmaya uygun.', choices: 4, penalty: 0, method: 'net', digits: 6, booklets: ['A', 'B'], sections: [S('Test', 10)] });

  /* ------------------------------------------------------------------ tek ders */
  // [id, ad, kısa ad, [[soru sayısı, açıklama, seviye], ...]]   seviye: o = ortaokul (4 şık, ⅓), l = lise (5 şık, ¼)
  const LESSONS = [
    ['turkce', 'Türkçe', 'Türkçe', [[20, 'LGS', 'o'], [40, 'TYT', 'l'], [10, '', 'o'], [15, '', 'o'], [25, '', 'o'], [30, '', 'o']]],
    ['mat', 'Matematik', 'Matematik', [[20, 'LGS', 'o'], [40, 'TYT / AYT', 'l'], [10, '', 'o'], [15, '', 'o'], [25, '', 'o'], [30, '', 'o']]],
    ['fen', 'Fen Bilimleri', 'Fen Bil.', [[20, 'LGS', 'o'], [20, 'TYT', 'l'], [10, '', 'o'], [15, '', 'o'], [25, '', 'o'], [30, '', 'o']]],
    ['sosyal', 'Sosyal Bilgiler / Sosyal Bilimler', 'Sosyal', [[20, 'TYT', 'l'], [10, '', 'o'], [15, '', 'o'], [20, '', 'o'], [25, '', 'o']]],
    ['ink', 'T.C. İnkılap Tarihi ve Atatürkçülük', 'İnkılap', [[10, 'LGS', 'o'], [15, '', 'o'], [20, '', 'o']]],
    ['din', 'Din Kültürü ve Ahlak Bilgisi', 'Din K.', [[10, 'LGS', 'o'], [5, 'TYT', 'l'], [6, 'AYT', 'l'], [15, '', 'o'], [20, '', 'o']]],
    ['ing', 'Yabancı Dil (İngilizce)', 'Yab. Dil', [[10, 'LGS', 'o'], [20, '', 'o'], [30, '', 'l'], [80, 'YDS', 'l']]],
    ['edeb', 'Türk Dili ve Edebiyatı', 'Edebiyat', [[24, 'AYT', 'l'], [20, '', 'l'], [30, '', 'l'], [40, '', 'l']]],
    ['geo', 'Geometri', 'Geometri', [[10, 'TYT', 'l'], [20, '', 'l'], [30, '', 'l']]],
    ['fiz', 'Fizik', 'Fizik', [[7, 'TYT', 'l'], [14, 'AYT', 'l'], [20, '', 'l']]],
    ['kim', 'Kimya', 'Kimya', [[7, 'TYT', 'l'], [13, 'AYT', 'l'], [20, '', 'l']]],
    ['biy', 'Biyoloji', 'Biyoloji', [[6, 'TYT', 'l'], [13, 'AYT', 'l'], [20, '', 'l']]],
    ['tar', 'Tarih', 'Tarih', [[5, 'TYT', 'l'], [10, 'AYT Tarih-1', 'l'], [11, 'AYT Tarih-2', 'l'], [20, '', 'l']]],
    ['cog', 'Coğrafya', 'Coğrafya', [[5, 'TYT', 'l'], [6, 'AYT Coğ-1', 'l'], [11, 'AYT Coğ-2', 'l'], [20, '', 'l']]],
    ['fel', 'Felsefe', 'Felsefe', [[5, 'TYT', 'l'], [12, 'AYT', 'l'], [20, '', 'l']]]
  ];

  function singleEntry(lessonId, count, choices) {
    const L = LESSONS.find(l => l[0] === lessonId); count = Math.round(+count); choices = +choices || 4;
    if (!L || !(count >= 1 && count <= 200)) return null;
    const pen = choices === 4 || choices === 3 ? 1 / 3 : 0.25;
    return {
      id: `tek-${lessonId}-${count}-${choices}`, group: 'tek', name: `${L[1]} — ${count} soru`, desc: `${choices} şık`, choices, penalty: pen, method: 'net', digits: 8, booklets: ['A', 'B'], layout: 'lanes', base: 100, max: 500,
      sections: [S(L[1], count, 1, L[2])]
    };
  }
  // hazır tek ders listesi: her dersin resmî sınavlardaki soru sayıları (açıklaması olanlar)
  const seen = new Set();
  LESSONS.forEach(l => l[3].forEach(([n, lab, lv]) => {
    if (!lab) return;
    const e = singleEntry(l[0], n, lv === 'o' ? 4 : 5); if (!e || seen.has(e.id)) return; seen.add(e.id);
    e.name = `${l[1]} — ${n} soru (${lab})`; e.desc = `${e.choices} şık · ${e.penalty ? (e.penalty === 0.25 ? '4' : '3') + ' yanlış 1 doğruyu götürür' : 'yanlış götürmez'}`; E.push(e);
  }));
  // YDS tek ders: ceza yok
  const yds = E.find(e => e.id === 'tek-ing-80-5'); if (yds) { yds.penalty = 0; yds.desc = '5 şık · yanlış doğruyu götürmez'; }

  /* ------------------------------------------------------------------ yardımcılar */
  const byId = id => {
    let e = E.find(x => x.id === id); if (e) return e;
    const m = /^tek-([a-z]+)-(\d+)-(\d)$/.exec(String(id || '')); return m ? singleEntry(m[1], +m[2], +m[3]) : null;
  };
  const total = e => e.sections.reduce((a, s) => a + s.count, 0);
  const penText = p => !p ? 'yanlış götürmez' : (Math.abs(p - 0.25) < 1e-6 ? '4 yanlış 1 doğruyu götürür' : Math.abs(p - 1 / 3) < 1e-6 ? '3 yanlış 1 doğruyu götürür' : `yanlış × ${(+p).toFixed(2)}`);

  /** buildTemplate seçenekleri (okunacak ve yazdırılacak form). over: {nup, digits, schoolDigits, examName, footer, booklets, maxRows} */
  function formOpts(e, over) {
    over = over || {};
    return {
      title: over.title || 'OPTİK CEVAP KAĞIDI', examName: over.examName || '', questions: total(e), choices: e.choices, digits: over.digits != null ? over.digits : e.digits, schoolDigits: over.schoolDigits | 0,
      booklets: (over.booklets || e.booklets).slice(), nup: over.nup || 1, layout: e.layout || 'lanes', maxRows: over.maxRows | 0, restartNumbers: true, instructions: true, footer: over.footer || '',
      sections: e.sections.map(s => ({ name: s.name, short: s.short, count: s.count }))
    };
  }
  /** Sınav ayarı (Scoring.normalizeCfg girdisi) */
  function examConfig(e) {
    return { sections: e.sections.map(s => ({ name: s.name, count: s.count, coef: s.coef })), choices: e.choices, penalty: e.penalty, method: e.method, base: e.base || 100, max: e.max || 500, a: 0, b: 1, booklets: e.booklets.slice() };
  }
  /** Sınav ayarlarında saklanan hazır form kimliği: std:<kayıt>@<sayfada kaç form>[k<kurum kodu hane>][n<öğrenci no hane>] */
  const stdId = (id, nup, o) => `std:${id}@${nup || 1}${o && o.sd ? 'k' + o.sd : ''}${o && o.d != null ? 'n' + o.d : ''}`;
  function parseStd(tid) {
    const m = /^std:([A-Za-z0-9\-_]+)@(\d)(?:k(\d+))?(?:n(\d+))?$/.exec(String(tid || '')); if (!m) return null;
    const entry = byId(m[1]); if (!entry) return null; const nup = +m[2]; if (![1, 2, 4, 6, 8].includes(nup)) return null;
    return { entry, nup, sd: m[3] ? +m[3] : 0, d: m[4] != null ? +m[4] : entry.digits };
  }

  return { GROUPS, ENTRIES: E, LESSONS, byId, singleEntry, total, penText, formOpts, examConfig, stdId, parseStd };
});
