/*  scoring.js — puanlama motoru (net, katsayı, standart puan, sıralama, madde analizi)
 *  Aynı dosya hem PWA'da hem Google Apps Script'te (Scoring.gs olarak) çalışır.
 *  Apps Script'e kopyalamak için:  node tools/build.js
 */
var Scoring = (function () {
  'use strict';

  /* Hazır sınav türleri. Katsayılar ve yöntem her sınavda düzenlenebilir.
     Resmî puan, yıllık ulusal ortalama/standart sapmaya bağlıdır; buradaki hesap okul/ilçe
     denemeleri için aynı mantığı kendi katılımcı grubunuz üzerinden uygular. */
  var PRESETS = {
    lgs: {
      label: 'LGS (90 soru, 4 şık, 3 yanlış 1 doğruyu götürür)', choices: 4, penalty: 1 / 3, method: 'std500',
      sections: [
        { name: 'Türkçe', count: 20, coef: 4 }, { name: 'Matematik', count: 20, coef: 4 }, { name: 'Fen Bilimleri', count: 20, coef: 4 },
        { name: 'T.C. İnkılap Tarihi', count: 10, coef: 1 }, { name: 'Din Kültürü', count: 10, coef: 1 }, { name: 'Yabancı Dil', count: 10, coef: 1 }]
    },
    tyt: {
      label: 'TYT (120 soru, 5 şık, 4 yanlış 1 doğruyu götürür)', choices: 5, penalty: 0.25, method: 'std500',
      sections: [
        { name: 'Türkçe', count: 40, coef: 0.33 }, { name: 'Sosyal Bilimler', count: 20, coef: 0.17 },
        { name: 'Temel Matematik', count: 40, coef: 0.33 }, { name: 'Fen Bilimleri', count: 20, coef: 0.17 }]
    },
    ayt_say: {
      label: 'AYT Sayısal (80 soru) — katsayıları kontrol edin', choices: 5, penalty: 0.25, method: 'std500',
      sections: [{ name: 'Matematik', count: 40, coef: 1 }, { name: 'Fizik', count: 14, coef: 1 }, { name: 'Kimya', count: 13, coef: 1 }, { name: 'Biyoloji', count: 13, coef: 1 }]
    },
    ayt_ea: {
      label: 'AYT Eşit Ağırlık (80 soru) — katsayıları kontrol edin', choices: 5, penalty: 0.25, method: 'std500',
      sections: [{ name: 'Matematik', count: 40, coef: 1 }, { name: 'Edebiyat-Sosyal Bil. 1', count: 40, coef: 1 }]
    },
    ayt_soz: {
      label: 'AYT Sözel (80 soru) — katsayıları kontrol edin', choices: 5, penalty: 0.25, method: 'std500',
      sections: [{ name: 'Edebiyat-Sosyal Bil. 1', count: 40, coef: 1 }, { name: 'Sosyal Bilimler 2', count: 40, coef: 1 }]
    },
    genel40: {
      label: 'Genel deneme (40 soru, 5 şık, yanlış götürmez, 100 üzerinden)', choices: 5, penalty: 0, method: 'net',
      sections: [{ name: 'Genel', count: 40, coef: 1 }]
    },
    genel20: {
      label: 'Kısa yazılı / konu testi (20 soru, 4 şık)', choices: 4, penalty: 0.25, method: 'net',
      sections: [{ name: 'Test', count: 20, coef: 1 }]
    }
  };

  function num(v, d) { v = parseFloat(String(v).replace(',', '.')); return isFinite(v) ? v : d; }

  /** Sınav ayarını güvenli/tam hale getirir. */
  function normalizeCfg(c) {
    c = c || {};
    var sections = (c.sections && c.sections.length ? c.sections : [{ name: 'Genel', count: 40, coef: 1 }]).map(function (s, i) {
      return { name: String(s.name || 'Bölüm ' + (i + 1)), count: Math.max(1, Math.round(num(s.count, 1))), coef: num(s.coef, 1) };
    });
    var total = 0; sections.forEach(function (s) { total += s.count; });
    var keys = {}; Object.keys(c.keys || {}).forEach(function (b) { keys[b] = String(c.keys[b] || '').toUpperCase().replace(/\s+/g, ''); });
    return {
      sections: sections, total: total, choices: Math.round(num(c.choices, 5)), penalty: Math.max(0, num(c.penalty, 0)),
      method: c.method || 'net', base: num(c.base, 100), max: num(c.max, 500), a: num(c.a, 0), b: num(c.b, 1),
      keys: keys, multiIsWrong: !!c.multiIsWrong, stats: c.stats || null, templateId: c.templateId || '', booklets: c.booklets || Object.keys(keys)
    };
  }

  /** Bir öğrencinin cevaplarını anahtara göre puanlar (D/Y/B ve net). */
  function scoreStudent(cfgIn, booklet, answers) {
    var cfg = cfgIn.total ? cfgIn : normalizeCfg(cfgIn);
    answers = String(answers || '');
    var bk = (booklet && cfg.keys[booklet]) ? booklet : (Object.keys(cfg.keys)[0] || '');
    var key = cfg.keys[bk] || '';
    var out = { booklet: bk, keyMissing: !key, bookletGuessed: !(booklet && cfg.keys[booklet]), sections: [], D: 0, Y: 0, B: 0, net: 0 };
    var q = 0;
    cfg.sections.forEach(function (s) {
      var d = 0, y = 0, b = 0;
      for (var i = 0; i < s.count; i++, q++) {
        var k = key.charAt(q) || '.', a = answers.charAt(q) || '-';
        if (k === '.') { continue; }                  // anahtarda tanımsız: hesaba katma
        if (k === '*') { d++; continue; }             // iptal soru: herkese doğru
        if (a === '-' || (a === '*' && !cfg.multiIsWrong)) b++;
        else if (a === k) d++;
        else y++;
      }
      var net = d - y * cfg.penalty;
      out.sections.push({ name: s.name, count: s.count, D: d, Y: y, B: b, net: Math.round(net * 1000) / 1000 });
      out.D += d; out.Y += y; out.B += b; out.net += net;
    });
    out.net = Math.round(out.net * 1000) / 1000;
    return out;
  }

  function meanSd(arr) {
    var n = arr.length; if (!n) return { mean: 0, sd: 0 };
    var m = 0; arr.forEach(function (v) { m += v; }); m /= n;
    var s = 0; arr.forEach(function (v) { s += (v - m) * (v - m); });
    return { mean: m, sd: Math.sqrt(s / n) };
  }

  /**
   * Katılımcı grubu üzerinden puan hesabı.
   * rows: [{secNets:[...], net}]   → her satıra puan, secStd (standart puanlar) eklenir.
   * Döndürür: {stats:[{mean,sd}], aMin, aMax}
   */
  function finalizeCohort(cfgIn, rows) {
    var cfg = cfgIn.total ? cfgIn : normalizeCfg(cfgIn);
    var ns = cfg.sections.length, stats = [], sumCoef = 0, maxW = 0, i, j;
    cfg.sections.forEach(function (s) { sumCoef += s.coef; maxW += s.coef * s.count; });
    for (j = 0; j < ns; j++) {
      var arr = rows.map(function (r) { return r.secNets[j]; });
      var st = meanSd(arr);
      if (cfg.stats && cfg.stats[j] && cfg.stats[j].sd > 0) st = { mean: num(cfg.stats[j].mean, st.mean), sd: num(cfg.stats[j].sd, st.sd) };
      stats.push(st);
    }
    var aMin = Infinity, aMax = -Infinity;
    rows.forEach(function (r) {
      var A = 0; r.secStd = [];
      for (j = 0; j < ns; j++) {
        var z = stats[j].sd > 0 ? (r.secNets[j] - stats[j].mean) / stats[j].sd : 0, S = 50 + 10 * z;
        r.secStd.push(Math.round(S * 100) / 100); A += cfg.sections[j].coef * S;
      }
      r.A = A; if (A < aMin) aMin = A; if (A > aMax) aMax = A;
    });
    if (cfg.stats && cfg.stats.aMin != null && cfg.stats.aMax != null) { aMin = cfg.stats.aMin; aMax = cfg.stats.aMax; }
    rows.forEach(function (r) {
      var p;
      if (cfg.method === 'std500') {
        p = aMax > aMin ? cfg.base + (cfg.max - cfg.base) * (r.A - aMin) / (aMax - aMin) : (cfg.base + cfg.max) / 2;
      } else if (cfg.method === 'stdw') {
        p = cfg.a + cfg.b * (sumCoef ? r.A / sumCoef : 0);
      } else {                                     // 'net': ağırlıklı net → 100 üzerinden
        var w = 0; for (j = 0; j < ns; j++) w += cfg.sections[j].coef * r.secNets[j];
        p = maxW ? Math.max(0, w) / maxW * 100 : 0;
      }
      r.puan = Math.round(p * 1000) / 1000;
    });
    return { stats: stats, aMin: aMin === Infinity ? 0 : aMin, aMax: aMax === -Infinity ? 0 : aMax };
  }

  /** Standart yarışma sıralaması (eşitlerde aynı sıra: 1,2,2,4). groupFn(row) → grup anahtarı */
  function rankRows(rows, field, groupFn) {
    var groups = {};
    rows.forEach(function (r) { var g = groupFn ? groupFn(r) : 'all'; (groups[g] = groups[g] || []).push(r); });
    Object.keys(groups).forEach(function (g) {
      var list = groups[g].slice().sort(function (a, b) { return (b.puan - a.puan) || (b.net - a.net); });
      var rank = 0;
      list.forEach(function (r, i) {
        if (i === 0 || r.puan !== list[i - 1].puan || r.net !== list[i - 1].net) rank = i + 1;
        r[field] = rank; r[field + 'N'] = list.length;
      });
    });
  }

  /** Madde analizi (soru sırasına göre). rows: [{booklet, answers, group}] */
  function itemStats(cfgIn, rows) {
    var cfg = cfgIn.total ? cfgIn : normalizeCfg(cfgIn), res = [], q, sec = [];
    cfg.sections.forEach(function (s, si) { for (var i = 0; i < s.count; i++) sec.push(si); });
    for (q = 0; q < cfg.total; q++) res.push({ q: q + 1, section: cfg.sections[sec[q]].name, n: 0, correct: 0, wrong: 0, blank: 0, opt: {} });
    rows.forEach(function (r) {
      var bk = (r.booklet && cfg.keys[r.booklet]) ? r.booklet : Object.keys(cfg.keys)[0], key = cfg.keys[bk] || '';
      for (q = 0; q < cfg.total; q++) {
        var k = key.charAt(q) || '.', a = String(r.answers || '').charAt(q) || '-', it = res[q];
        if (k === '.') continue;
        it.n++;
        if (k === '*') { it.correct++; continue; }
        if (a === '-' || a === '*') it.blank++; else { it.opt[a] = (it.opt[a] || 0) + 1; if (a === k) it.correct++; else it.wrong++; }
      }
    });
    res.forEach(function (it, i) { it.pct = it.n ? Math.round(it.correct / it.n * 1000) / 10 : 0; it.key = (cfg.keys[Object.keys(cfg.keys)[0]] || '').charAt(i); });
    return res;
  }

  /** Cevap anahtarı metnini doğrula; sorun listesi döndürür. */
  function checkKeys(cfgIn) {
    var cfg = cfgIn.total ? cfgIn : normalizeCfg(cfgIn), issues = [], ok = 'ABCDEFGH'.slice(0, cfg.choices) + '*.';
    Object.keys(cfg.keys).forEach(function (b) {
      var k = cfg.keys[b];
      if (k.length !== cfg.total) issues.push('Kitapçık ' + b + ': ' + k.length + ' karakter var, ' + cfg.total + ' olmalı.');
      for (var i = 0; i < k.length; i++) if (ok.indexOf(k.charAt(i)) < 0) { issues.push('Kitapçık ' + b + ', soru ' + (i + 1) + ': geçersiz "' + k.charAt(i) + '".'); break; }
    });
    if (!Object.keys(cfg.keys).length) issues.push('Cevap anahtarı girilmemiş.');
    return issues;
  }

  return { PRESETS: PRESETS, normalizeCfg: normalizeCfg, scoreStudent: scoreStudent, finalizeCohort: finalizeCohort, rankRows: rankRows, itemStats: itemStats, checkKeys: checkKeys, meanSd: meanSd };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = Scoring;
