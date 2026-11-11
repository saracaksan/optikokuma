/*  omr-core.js — bağımlılıksız optik okuma motoru + form üretici
 *  Tarayıcıda (window.OMR) ve Node'da (require) çalışır.
 *
 *  Kavramlar
 *  - Sayfa (A4) 4 köşe işareti + üst kenarda yön çubuğu taşır.
 *  - 1/2/4/8 sığdırmada her form kendi küçük köşe işaretlerine sahiptir (ince hizalama).
 *  - Şablon (template): çerçeve (frame) + 4 çapa noktası + baloncuk grupları.
 *    Üretilen şablonlarda birim mm'dir. Dış (özel) şablonlarda birim, örnek görüntüdeki piksel.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.OMR = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ------------------------------------------------------------------ */
  /*  Sayfa geometrisi                                                   */
  /* ------------------------------------------------------------------ */
  const PAGE = { w: 210, h: 297 };
  const PAGE_MARK = { size: 5, centers: [[8, 8], [202, 8], [202, 289], [8, 289]] }; // TL,TR,BR,BL
  const ORIENT_BAR = { x0: 75, x1: 135, y: 8, t: 2 };
  const LOCAL_MARK = 3.5, LOCAL_INSET = 3.5, GAP = 6;
  const LOCAL_BAR = { f0: 0.35, f1: 0.65, t: 1.3 };   // 2/4/6/8'li formlarda her formun kendi yön çubuğu (kesilmiş formu tek başına okumak için)
  const GRID = { 1: { c: 1, r: 1 }, 2: { c: 1, r: 2 }, 4: { c: 2, r: 2 }, 6: { c: 2, r: 3 }, 8: { c: 2, r: 4 } };
  const NUPS = [1, 2, 4, 6, 8];
  const AREA = { x: 15, y: 16, w: 180, h: 265 };
  const LETTERS = 'ABCDEFGH';
  const CODE_CELLS = 33;   // 1 başlangıç + 24 bit kimlik + 8 bit sağlama

  function pageForms(nup) {
    if (nup === 1) return [{ x: 0, y: 0, w: PAGE.w, h: PAGE.h }];
    const g = GRID[nup];
    if (!g) throw new Error('Sayfaya sığdırma 1, 2, 4, 6 veya 8 olmalı');
    const w = (AREA.w - (g.c - 1) * GAP) / g.c, h = (AREA.h - (g.r - 1) * GAP) / g.r, out = [];
    for (let r = 0; r < g.r; r++) for (let c = 0; c < g.c; c++)
      out.push({ x: AREA.x + c * (w + GAP), y: AREA.y + r * (h + GAP), w, h });
    return out;
  }

  /* form yerleşim sabitleri (yalnız sayfaya sığdırma sayısına bağlıdır; form kimlik kodu bu yüzden her şablondan okunabilir) */
  function modeInfo(nup) {
    const F = pageForms(nup)[0], mode = nup === 1 ? 'full' : (nup <= 4 ? 'compact' : 'mini');
    const cont = nup === 1 ? { x: 16, y: 15, w: 178, h: 268 } : { x: 8, y: 7, w: F.w - 16, h: F.h - 14 };
    const m = {
      full: { hh: 27, boxH: 6, fs: 2.4 }, compact: { hh: 12, boxH: 4.5, fs: 2.1 }, mini: { hh: 6.5, boxH: 0, fs: 1.6 }
    }[mode];
    const cp = Math.min(2.0, cont.w * 0.7 / CODE_CELLS), cellH = cp * 1.05, footH = cellH + 1.8;
    return Object.assign({ F, mode, cont, cp, cellW: cp * 0.72, cellH, footH, codeW: CODE_CELLS * cp }, m);
  }
  /** Form kimlik kodu hücrelerinin merkezleri (form koordinatı, mm) ve kâğıt örnekleme noktaları */
  function codeGeometry(nup) {
    const mi = modeInfo(nup), y = mi.cont.y + mi.cont.h - mi.cellH / 2, x0 = mi.cont.x + mi.cont.w - mi.codeW;
    return { cells: Array.from({ length: CODE_CELLS }, (_, i) => [x0 + (i + 0.5) * mi.cp, y]), cellW: mi.cellW, cellH: mi.cellH, paperY: y - mi.cellH / 2 - 0.9, x0, cp: mi.cp };
  }
  function fnv24(str) {
    let h = 0x811c9dc5; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return ((h >>> 8) ^ h) & 0xFFFFFF;
  }
  const codeCheck = v => ((v >>> 16) + (v >>> 8 & 255) * 3 + (v & 255) * 5 + 0x5A) & 255;
  function codeBits(v) {   // [1, 24 bit, 8 bit sağlama]
    const bits = [1]; for (let i = 23; i >= 0; i--) bits.push((v >>> i) & 1);
    const c = codeCheck(v); for (let i = 7; i >= 0; i--) bits.push((c >>> i) & 1);
    return bits;
  }
  /** Şablonun okuma geometrisini belirleyen ayarlardan 24 bitlik kimlik */
  function formCodeOf(o) {
    const sec = (o.sections || []).map(s => Math.round(s.count || 0)).join(',');
    return fnv24(['v2', o.nup, o.choices, o.digits, o.schoolDigits | 0, (o.booklets || []).join(''), o.layout || 'seq', o.maxRows | 0, o.questions, sec, o.restartNumbers === false ? 0 : 1].join('|'));
  }
  const codeHex = v => v.toString(16).toUpperCase().padStart(6, '0');

  /* ------------------------------------------------------------------ */
  /*  Form (şablon) üretici                                              */
  /* ------------------------------------------------------------------ */
  function buildTemplate(o) {
    // layout: 'seq'   = soruları sırayla sütunlara dizer (eski; bölüm adları tek satır başlıkta)
    //         'lanes' = her ders kendi sütununda yan yana, ders başlığıyla (küçük dersler alt alta istiflenir)
    //         'dense' = dersler sütunlara sıkı yerleşir (sığmayan durumda otomatik denenir)
    // maxRows: bir sütundaki en çok soru (0 = otomatik) · restartNumbers: her derste numaralar 1'den başlar
    // schoolDigits: kurum (okul) kodu baloncuk hane sayısı (0 = yok) · footer: formun altındaki küçük yazı
    o = Object.assign({ title: 'OPTİK CEVAP KAĞIDI', questions: 40, choices: 5, digits: 5, schoolDigits: 0, booklets: [], nup: 1, sections: [], examName: '', layout: 'seq', maxRows: 0, restartNumbers: true, footer: '', instructions: true }, o || {});
    const nup = o.nup, forms = pageForms(nup), F = forms[0], mi = modeInfo(nup);
    const N = o.questions, k = o.choices, d = o.digits, sd = o.schoolDigits | 0, B = o.booklets.length;
    if (k < 2 || k > 8) throw new Error('Şık sayısı 2-8 olmalı');
    if (sd < 0 || sd > 12 || d < 0 || d > 12) throw new Error('Hane sayısı 0-12 olmalı');
    let frame, anchors, anchorSize;
    const cont = mi.cont;
    if (nup === 1) { frame = { w: PAGE.w, h: PAGE.h }; anchors = PAGE_MARK.centers.map(a => a.slice()); anchorSize = PAGE_MARK.size; }
    else { frame = { w: F.w, h: F.h }; const i = LOCAL_INSET; anchorSize = LOCAL_MARK; anchors = [[i, i], [F.w - i, i], [F.w - i, F.h - i], [i, F.h - i]]; }
    const mode = mi.mode, hh = mi.hh, boxH = mi.boxH;
    const footText = String(o.footer || '').trim(), twoRow = !!footText && footText.length * mi.fs * 0.5 > cont.w - mi.codeW - 3;   // yazı kod şeridinin yanına sığmıyorsa üst satıra
    const footH = mi.footH + (twoRow ? mi.fs + 0.9 : 0);
    const lanesWanted = !!(o.layout && o.layout !== 'seq' && o.sections.length);
    if (lanesWanted) {
      const sc = o.sections.reduce((a, s) => a + Math.round(s.count || 0), 0);
      if (sc !== N) throw new Error(`Derslerin soru toplamı (${sc}) form soru sayısına (${N}) eşit olmalı.`);
      if (o.sections.some(s => !(s.count >= 1))) throw new Error('Her dersin soru sayısı en az 1 olmalı.');
    }
    const R = o.maxRows > 0 ? Math.round(o.maxRows) : Infinity;
    const capH = (mode === 'mini' || !o.sections.length || lanesWanted) ? 0 : 4.5;
    const hdrH = mode === 'mini' ? 3.4 : 4.8;   // ders başlığı yüksekliği (lanes/dense)
    const pitches = nup >= 6 ? [4.2, 3.8, 3.5, 3.2, 3.0, 2.8] : [5.2, 4.8, 4.4, 4.0, 3.7, 3.4, 3.2, 3.0];

    // Ders sütunlarını planla: her ders kendi sütununda; küçük dersler aynı sütunda alt alta istiflenir.
    function planLanes(lay, p, qh, qw, colW, colGap, gapSz) {
      const usedH = m => (m - 1) * p + Math.floor((m - 1) / 5) * gapSz + p;
      const block = n => hdrH + usedH(n);
      const maxRows = rem => { let m = 0; while (m < 400 && hdrH + usedH(m + 1) <= rem) m++; return m; };
      const maxBlock = Math.max(...o.sections.map(s => block(Math.min(Math.round(s.count), R))));
      const cap = lay === 'dense' ? qh : Math.min(qh, maxBlock + 4 * p), between = p * 0.9;
      const lanes = []; let q = 1, fail = false;
      o.sections.forEach((s, si) => {
        const n = Math.round(s.count), full = block(n);
        if (full <= cap && n <= R) {
          const cur = lanes[lanes.length - 1];
          if (cur && cur.used + between + full <= cap && cur.rows + n <= R) { cur.segs.push({ si, q, n, y: cur.used + between }); cur.used += between + full; cur.rows += n; }
          else lanes.push({ segs: [{ si, q, n, y: 0 }], used: full, rows: n });
        } else {   // tek sütuna sığmayan (ya da sütun başına sınırı aşan) ders birkaç sütuna eşit bölünür
          const mr = Math.min(maxRows(qh), R); if (mr < 1) { fail = true; return; }
          const kk = Math.ceil(n / mr), per = Math.ceil(n / kk); let left = n, qq = q;
          while (left > 0) { const m = Math.min(per, left); lanes.push({ segs: [{ si, q: qq, n: m, y: 0 }], used: block(m), rows: m }); left -= m; qq += m; }
        }
        q += n;
      });
      if (fail || lanes.some(l => l.used > qh + 1e-6)) return null;
      const Ln = lanes.length; if (Ln * colW + (Ln - 1) * colGap > qw) return null;
      return lanes;
    }

    // yan çubuk (öğrenci no · kurum kodu · kitapçık) yerleşimi denemeleri: alt alta / yan yana, etiketli / etiketsiz
    const fieldsList = [];
    if (d > 0) fieldsList.push({ id: 'no', role: 'studentNo', label: 'ÖĞRENCİ NO', n: d, box: 'no' });
    if (sd > 0) fieldsList.push({ id: 'sc', role: 'schoolCode', label: 'KURUM KODU', n: sd, box: 'sc' });
    const labHs = mode === 'mini' ? (sd > 0 ? [2.4] : [2.4, 0]) : [3.6];
    function sidebar(p, labH, arr) {
      // dönüş: {w, h, place:[{f, x, y}], bkPos}
      const minW = mode === 'full' ? 20 : 0, wOf = f => Math.max(f.n * p, minW), place = [];
      let w = 0, h = 0;
      if (arr === 'stack') {
        fieldsList.forEach(f => { place.push({ f, x: 0, y: h }); w = Math.max(w, wOf(f)); h += labH + boxH + 10 * p + 3; });
        if (fieldsList.length) h -= 3;
      } else {
        let x = 0; fieldsList.forEach(f => { place.push({ f, x, y: 0 }); x += wOf(f) + 3; h = Math.max(h, labH + boxH + 10 * p); }); w = Math.max(0, x - 3);
      }
      let bkPos = null;
      if (B > 0) {
        const by = fieldsList.length ? h + 3 : 0, inline = mode === 'mini';   // küçük formda etiket baloncukların soluna yazılır (yükseklik kazanılır)
        bkPos = { x: 0, y: by, inline }; h = by + (inline ? 0 : labH) + p; w = Math.max(w, B * p + (inline ? 5 : 0));
      }
      return { w: w + 4, h, place, bkPos };
    }

    let chosen = null;
    const cands = lanesWanted ? (o.layout === 'dense' ? ['dense'] : ['lanes', 'dense']) : ['seq'];
    for (const lay of cands) {
      for (const p of pitches) {
        let sb = null, labH = 0;
        for (const arr of ['stack', 'side']) { for (const lh of labHs) { const s = sidebar(p, lh, arr); if (s.h <= cont.h - hh - footH) { sb = Object.assign(s, { arr }); labH = lh; break; } } if (sb) break; }
        if (!sb && (d > 0 || sd > 0 || B > 0)) continue;
        if (!sb) sb = { w: 0, h: 0, place: [], bkPos: null, arr: 'stack' };
        const sbW = (d > 0 || sd > 0 || B > 0) ? sb.w : 0;
        const qx = cont.x + sbW, qy = cont.y + hh + capH, qw = cont.w - sbW, qh = cont.h - hh - capH - footH;
        const gapSz = p * 0.45, numW = Math.max(4.4, p * 1.25), colGap = Math.max(2.6, p * 0.7), colW = numW + k * p;
        if (lay === 'seq') {
          const usedH = m => (m - 1) * p + Math.floor((m - 1) / 5) * gapSz + p;
          let mMax = 0; while (usedH(mMax + 1) <= qh && mMax < N && mMax < R) mMax++;
          if (mMax < 1) continue;
          const cols = Math.ceil(N / mMax), mUse = Math.ceil(N / cols);
          if (cols * colW + (cols - 1) * colGap > qw) continue;
          chosen = { p, sb, labH, sbW, qx, qy, qw, qh, gapSz, numW, colGap, cols, mUse, colW, lay };
        } else {
          const lanes = planLanes(lay, p, qh, qw, colW, colGap, gapSz);
          if (!lanes) continue;
          chosen = { p, sb, labH, sbW, qx, qy, qw, qh, gapSz, numW, colGap, colW, lanes, lay };
        }
        break;
      }
      if (chosen) break;
    }
    if (!chosen) throw new Error(`${N} soru, ${k} şık bu sığdırmaya (${nup}/sayfa) sığmıyor. Sığdırmayı azaltın, soru/şık/hane sayısını düşürün veya sütun başına soru sınırını kaldırın.`);
    const { p, sb, labH, qx, qy, qw, gapSz, numW, colGap, cols, mUse, colW } = chosen;
    const r = p * 0.38;
    const groups = [], decor = [];
    const T = (x, y, s, size, extra) => decor.push(Object.assign({ t: 'text', x, y, s, size }, extra || {}));
    const RC = (x, y, w, h, extra) => decor.push(Object.assign({ t: 'rect', x, y, w, h, sw: 0.25 }, extra || {}));
    const L = (x1, y1, x2, y2, extra) => decor.push(Object.assign({ t: 'line', x1, y1, x2, y2, sw: 0.25 }, extra || {}));
    // başlık metnini genişliğe sığdır (küçült, gerekirse kısalt)
    const fitText = (str, size, maxw) => {
      let s = String(str), cut = false; const w = (t, z) => t.length * z * 0.6;
      let z = size; if (w(s, z) > maxw) z = Math.max(size * 0.72, maxw / (s.length * 0.6));
      while (s.length > 2 && w(s, z) > maxw) { s = s.slice(0, -1); cut = true; }
      return { s: cut ? s.replace(/\s+$/, '') + '…' : s, z };
    };

    /** Ders başlığı: sığıyorsa tam ad, değilse kısa ad, o da sığmazsa kısaltma */
    const pickLabel = (sec, size, maxw) => {
      const w = (t, z) => t.length * z * 0.6, full = String(sec.name), sh = String(sec.short || sec.name);
      for (const c of [full, sh]) if (w(c, size) <= maxw) return { s: c, z: size };
      const ab = sh.length > 5 ? sh.replace(/\s+/g, ' ').slice(0, 4).replace(/\s+$/, '') + '.' : sh;
      return fitText(w(sh, size * 0.8) <= maxw ? sh : ab, size, maxw);
    };

    // başlık
    const title = mode === 'full' ? (o.examName ? `${o.title} — ${o.examName}` : o.title) : (o.examName || o.title);
    if (mode === 'full') {
      T(cont.x + cont.w / 2, cont.y + 6, title, 5.2, { anchor: 'middle', bold: true });
      const fy = cont.y + 11;
      decor.push({ t: 'field', x: cont.x, y: fy, w: 86, h: 7, label: 'ADI SOYADI', key: 'name' });
      decor.push({ t: 'field', x: cont.x + 90, y: fy, w: 56, h: 7, label: 'OKUL', key: 'school' });
      decor.push({ t: 'field', x: cont.x + 150, y: fy, w: 28, h: 7, label: 'SINIF / ŞUBE', key: 'cls' });
      if (o.instructions) T(cont.x, cont.y + 22.6, 'Kurşun kalem veya koyu tükenmez kalemle baloncuğu tamamen doldurun. Değiştirmek için eski işareti temizce silin.', 2.3, { fill: '#555' });
      L(cont.x, cont.y + hh - 1, cont.x + cont.w, cont.y + hh - 1, { sw: 0.4 });
    } else if (mode === 'compact') {
      const tf = fitText(title, 3.4, cont.w * (nup === 2 ? 0.5 : 0.52) - 2);
      T(cont.x, cont.y + 3.6, tf.s, tf.z, { bold: true });
      decor.push({ t: 'field', x: cont.x + cont.w * 0.52, y: cont.y, w: cont.w * 0.48, h: 6.2, label: 'ADI SOYADI', key: 'name', small: true });
      L(cont.x, cont.y + hh - 1, cont.x + cont.w, cont.y + hh - 1, { sw: 0.3 });
    } else {
      const tf = fitText(title, 2.4, cont.w * 0.5 - 1.5);
      T(cont.x, cont.y + 2.6, tf.s, tf.z, { bold: true });
      decor.push({ t: 'field', x: cont.x + cont.w * 0.5, y: cont.y, w: cont.w * 0.5, h: 4.4, label: '', key: 'name', small: true });
    }

    // yan çubuk: öğrenci no · kurum kodu · kitapçık
    const sy0 = cont.y + hh, lfs = mode === 'mini' ? 1.6 : 2.5;
    sb.place.forEach(({ f, x, y }) => {
      const x0 = cont.x + x, yy = sy0 + y;
      if (labH) T(x0, yy + (mode === 'mini' ? 1.8 : 2.6), f.label, lfs, { bold: true });
      const byy = yy + labH;
      if (boxH) for (let i = 0; i < f.n; i++) RC(x0 + i * p + 0.3, byy, p - 0.6, boxH, { key: f.box + i });
      const ys0 = byy + boxH + p / 2;
      groups.push({ id: f.id, role: f.role, axis: 'col', labels: '0123456789'.split(''), xs: Array.from({ length: f.n }, (_, i) => x0 + i * p + p / 2), ys: Array.from({ length: 10 }, (_, j) => ys0 + j * p) });
    });
    if (B > 0) {
      const inl = sb.bkPos.inline, x0 = cont.x + sb.bkPos.x + (inl ? 5 : 0), yy = sy0 + sb.bkPos.y, bl = inl ? 0 : labH;
      if (inl) T(cont.x + sb.bkPos.x, yy + p / 2 + 0.6, 'KİT.', lfs, { bold: true });
      else if (labH) T(x0, yy + 2.6, 'KİTAPÇIK', lfs, { bold: true });
      groups.push({ id: 'bk', role: 'booklet', axis: 'row', labels: o.booklets.slice(), xs: o.booklets.map((_, i) => x0 + i * p + p / 2), ys: [yy + bl + p / 2] });
    }
    // bölüm başlığı (eski yerleşim: tek satır özet)
    if (capH && o.sections.length) {
      let q = 1; const parts = [];
      for (const s of o.sections) { parts.push(`${s.name} ${q}-${q + s.count - 1}`); q += s.count; }
      T(qx, cont.y + hh + 2.6, parts.join('  ·  '), 2.2, { fill: '#444' });
    }
    // sorular
    const LET = LETTERS.slice(0, k).split('');
    const restart = lanesWanted && o.restartNumbers !== false;
    const secStart = []; { let q = 1; (o.sections || []).forEach((s, i) => { secStart[i] = q; q += Math.round(s.count || 0); }); }
    if (chosen.lanes) {
      const lanes = chosen.lanes, Ln = lanes.length;
      const extra = Ln > 1 ? Math.min(12, (qw - (Ln * colW + (Ln - 1) * colGap)) / (Ln - 1)) : 0, hs = mode === 'mini' ? 2.0 : 2.7;
      let gi = 0;
      lanes.forEach((ln, li) => {
        const x0 = qx + li * (colW + colGap + extra);
        ln.segs.forEach(sg => {
          const sec = o.sections[sg.si], y0 = qy + sg.y, base = restart ? sg.q - secStart[sg.si] + 1 : sg.q;
          const ft = pickLabel(sec, hs, colW);   // başlıkta yalnızca ders adı (soru numaraları zaten satır başlarında basılı)
          T(x0, y0 + hdrH - 1.6, ft.s, ft.z, { bold: true });
          L(x0, y0 + hdrH - 0.8, x0 + colW, y0 + hdrH - 0.8, { sw: 0.2 });
          const ys = Array.from({ length: sg.n }, (_, i) => y0 + hdrH + p / 2 + i * p + Math.floor(i / 5) * gapSz);
          const xs = Array.from({ length: k }, (_, j) => x0 + numW + p / 2 + j * p);
          groups.push({ id: 'q' + (gi++), role: 'questions', axis: 'row', labels: LET, xs, ys, qStart: sg.q, sec: sg.si, secQ0: secStart[sg.si], numStart: base });
          for (let i = 0; i < sg.n; i++) T(x0 + numW - 1.2, ys[i] + Math.min(p * 0.3, 1.1), String(base + i), Math.min(p * 0.68, 3), { anchor: 'end' });
        });
      });
    } else {
      const extra = Math.min(12, cols > 1 ? (qw - (cols * colW + (cols - 1) * colGap)) / (cols - 1) : 0);
      for (let c = 0; c < cols; c++) {
        const q0 = c * mUse + 1, rows = Math.min(mUse, N - c * mUse); if (rows <= 0) break;
        const x0 = qx + c * (colW + colGap + extra);
        const ys = Array.from({ length: rows }, (_, i) => qy + p / 2 + i * p + Math.floor(i / 5) * gapSz);
        const xs = Array.from({ length: k }, (_, j) => x0 + numW + p / 2 + j * p);
        groups.push({ id: 'q' + c, role: 'questions', axis: 'row', labels: LET, xs, ys, qStart: q0, numStart: q0 });
        for (let i = 0; i < rows; i++) T(x0 + numW - 1.2, ys[i] + Math.min(p * 0.3, 1.1), String(q0 + i), Math.min(p * 0.68, 3), { anchor: 'end' });
      }
    }

    // alt şerit: küçük yazı (sol) + form kimlik kodu (sağ). Kod, sistemin hangi formun okunduğunu tanımasını sağlar.
    const code = formCodeOf(o), cg = codeGeometry(nup), bits = codeBits(code);
    cg.cells.forEach((c, i) => { if (bits[i]) RC(c[0] - cg.cellW / 2, c[1] - cg.cellH / 2, cg.cellW, cg.cellH, { fill: '#000', sw: 0, code: true }); });
    if (footText) {
      const textW = twoRow ? cont.w : cont.w - mi.codeW - 3, textY = twoRow ? cont.y + cont.h - mi.cellH - 1.1 : cont.y + cont.h - 0.7;
      const ft = fitText(footText, mi.fs, textW); T(cont.x, textY, ft.s, ft.z, { fill: '#777' });
    }
    L(cont.x, cont.y + cont.h - footH - 0.6, cont.x + cont.w, cont.y + cont.h - footH - 0.6, { sw: 0.15, stroke: '#bbb' });

    return {
      kind: 'generated', version: 2, opts: o, nup, frame, anchors, anchorSize, r, pitch: p, layoutUsed: chosen.lay, formCode: code, formCodeHex: codeHex(code),
      localBar: nup > 1 ? { x0: F.w * LOCAL_BAR.f0, x1: F.w * LOCAL_BAR.f1, y: LOCAL_INSET, t: LOCAL_BAR.t } : null,
      questions: N, choices: k, digits: d, schoolDigits: sd, booklets: o.booklets.slice(), groups, decor, orient: true
    };
  }

  /* ------------------------------------------------------------------ */
  /*  SVG çıktısı (yazdırma)                                             */
  /* ------------------------------------------------------------------ */
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const FONT = "font-family=\"Arial, Helvetica, sans-serif\"";

  function formInnerSVG(tpl, data) {
    data = data || {}; const fill = data.fill || null, out = [];
    for (const dcr of tpl.decor) {
      if (dcr.t === 'text') out.push(`<text x="${dcr.x}" y="${dcr.y}" font-size="${dcr.size}" ${FONT} ${dcr.bold ? 'font-weight="bold"' : ''} text-anchor="${dcr.anchor || 'start'}" fill="${dcr.fill || '#222'}">${esc(dcr.s)}</text>`);
      else if (dcr.t === 'line') out.push(`<line x1="${dcr.x1}" y1="${dcr.y1}" x2="${dcr.x2}" y2="${dcr.y2}" stroke="${dcr.stroke || '#222'}" stroke-width="${dcr.sw}"/>`);
      else if (dcr.t === 'rect' && dcr.fill) out.push(`<rect x="${dcr.x.toFixed(3)}" y="${dcr.y.toFixed(3)}" width="${dcr.w.toFixed(3)}" height="${dcr.h.toFixed(3)}" fill="${dcr.fill}"/>`);
      else if (dcr.t === 'rect') {
        let txt = '';
        const mk = dcr.key && /^(no|sc)(\d+)$/.exec(dcr.key), val = mk ? (mk[1] === 'no' ? data.studentNo : data.schoolCode) : '';
        if (mk && val) {
          const ch = String(val)[+mk[2]];
          if (ch) txt = `<text x="${dcr.x + dcr.w / 2}" y="${dcr.y + dcr.h * 0.72}" font-size="${dcr.h * 0.62}" ${FONT} text-anchor="middle" fill="#222">${esc(ch)}</text>`;
        }
        out.push(`<rect x="${dcr.x}" y="${dcr.y}" width="${dcr.w}" height="${dcr.h}" fill="none" stroke="#555" stroke-width="${dcr.sw}"/>${txt}`);
      } else if (dcr.t === 'field') {
        const v = data[dcr.key] || '';
        out.push(`<rect x="${dcr.x}" y="${dcr.y}" width="${dcr.w}" height="${dcr.h}" fill="none" stroke="#555" stroke-width="0.25"/>`);
        if (dcr.label) out.push(`<text x="${dcr.x + 0.8}" y="${dcr.y + 2.3}" font-size="1.9" ${FONT} fill="#666">${esc(dcr.label)}</text>`);
        if (v) out.push(`<text x="${dcr.x + 1.2}" y="${dcr.y + dcr.h - (dcr.label ? 1.4 : 1.1)}" font-size="${dcr.small ? 2.8 : 3.6}" ${FONT} fill="#111">${esc(v)}</text>`);
      }
    }
    const r = tpl.r, fs = r * 1.15;
    for (const g of tpl.groups) {
      for (let ri = 0; ri < g.ys.length; ri++) for (let ci = 0; ci < g.xs.length; ci++) {
        const lab = g.axis === 'row' ? g.labels[ci] : g.labels[ri];
        out.push(`<circle cx="${g.xs[ci].toFixed(3)}" cy="${g.ys[ri].toFixed(3)}" r="${r.toFixed(3)}" fill="none" stroke="#7a7a7a" stroke-width="0.22"/>`);
        out.push(`<text x="${g.xs[ci].toFixed(3)}" y="${(g.ys[ri] + fs * 0.36).toFixed(3)}" font-size="${fs.toFixed(3)}" ${FONT} text-anchor="middle" fill="#8a8a8a">${esc(lab)}</text>`);
      }
    }
    if (fill) {   // test / demo için işaretlenmiş form
      let js = fill.seed || 7; const jr = () => (js = (js * 1664525 + 1013904223) % 4294967296) / 4294967296;
      const dot = (x, y, col, rs) => {
        const c = col || fill.color || '#1c1c1c';
        if (fill.sloppy && !col) {   // özensiz işaret: kaymış/eliptik leke ya da karalama (gerçek öğrenci işaretlerini taklit eder)
          if (jr() < 0.45) { const a = jr() * 180, rx = r * (0.62 + jr() * 0.5), ry = r * (0.5 + jr() * 0.45); out.push(`<ellipse cx="${(x + (jr() - 0.5) * r * 0.7).toFixed(3)}" cy="${(y + (jr() - 0.5) * r * 0.7).toFixed(3)}" rx="${rx.toFixed(3)}" ry="${ry.toFixed(3)}" transform="rotate(${a.toFixed(0)} ${x.toFixed(3)} ${y.toFixed(3)})" fill="${c}" opacity="${(0.78 + jr() * 0.2).toFixed(2)}"/>`); }
          else { const n = 3 + Math.floor(jr() * 3), sw = r * (0.5 + jr() * 0.25); let d = ''; for (let i = 0; i < n; i++) { const t = (i + 0.5) / n * 2 - 1, a = 0.9 * r; d += `M${(x - a).toFixed(3)} ${(y + t * a * 0.8 + (jr() - 0.5) * 0.3).toFixed(3)}L${(x + a).toFixed(3)} ${(y + t * a * 0.8 - 0.6 * r * (jr() - 0.2)).toFixed(3)}`; } out.push(`<path d="${d}" stroke="${c}" stroke-width="${sw.toFixed(3)}" stroke-linecap="round" fill="none" opacity="0.88"/>`); }
          return;
        }
        out.push(`<circle cx="${x.toFixed(3)}" cy="${y.toFixed(3)}" r="${(r * (rs || fill.rscale || 0.86)).toFixed(3)}" fill="${c}"/>`);
      };
      for (const g of tpl.groups) {
        if ((g.role === 'studentNo' && fill.studentNo) || (g.role === 'schoolCode' && fill.schoolCode)) {
          const val = String(g.role === 'studentNo' ? fill.studentNo : fill.schoolCode);
          for (let i = 0; i < g.xs.length; i++) { const ch = val[i]; const j = g.labels.indexOf(ch); if (j >= 0) dot(g.xs[i], g.ys[j]); }
        } else if (g.role === 'booklet' && fill.booklet) {
          const j = g.labels.indexOf(fill.booklet); if (j >= 0) dot(g.xs[j], g.ys[0]);
        } else if (g.role === 'questions' && fill.answers) {
          for (let i = 0; i < g.ys.length; i++) {
            const a = fill.answers[g.qStart - 1 + i]; if (!a || a === '-') continue;
            for (const ch of a === '*' ? [g.labels[0], g.labels[1]] : [a]) { const j = g.labels.indexOf(ch); if (j >= 0) dot(g.xs[j], g.ys[i]); }
            const gh = fill.ghost && fill.ghost[g.qStart - 1 + i];   // silinmiş (soluk) eski işaret
            if (gh) { const j = g.labels.indexOf(gh); if (j >= 0) dot(g.xs[j], g.ys[i], '#d2d2d2', 0.95); }
          }
        }
      }
    }
    return out.join('');
  }

  function markSVG(cx, cy, s) { return `<rect x="${cx - s / 2}" y="${cy - s / 2}" width="${s}" height="${s}" fill="#000"/>`; }

  /** Kesim çizgileri (2/4/6/8'li sayfalar): formların arasındaki boşluğun ortasında, kesilince her formun etrafında pay kalır */
  function cutLinesSVG(nup) {
    const g = GRID[nup]; if (!g) return '';
    const pos = pageForms(nup), xs = [], ys = [];
    for (let c = 0; c <= g.c; c++) xs.push(c === 0 ? AREA.x - GAP / 2 : (c === g.c ? AREA.x + AREA.w + GAP / 2 : pos[c].x - GAP / 2));
    for (let r = 0; r <= g.r; r++) ys.push(r === 0 ? AREA.y - GAP / 2 : (r === g.r ? AREA.y + AREA.h + GAP / 2 : pos[r * g.c].y - GAP / 2));
    const st = 'stroke="#8a8a8a" stroke-width="0.2" stroke-dasharray="2.2 1.6"', out = [];
    xs.forEach(x => out.push(`<line x1="${x.toFixed(2)}" y1="${ys[0].toFixed(2)}" x2="${x.toFixed(2)}" y2="${ys[ys.length - 1].toFixed(2)}" ${st}/>`));
    ys.forEach(y => out.push(`<line x1="${xs[0].toFixed(2)}" y1="${y.toFixed(2)}" x2="${xs[xs.length - 1].toFixed(2)}" y2="${y.toFixed(2)}" ${st}/>`));
    out.push(`<text x="${xs[0].toFixed(2)}" y="${(ys[0] - 1).toFixed(2)}" font-size="2" ${FONT} fill="#8a8a8a">kesim çizgisi (formları bu çizgiler boyunca kesin)</text>`);
    return out.join('');
  }

  /** Tek A4 sayfa SVG'si. forms: her form için {name, school, cls, studentNo, schoolCode, fill} */
  function renderPageSVG(tpl, forms, ropts) {
    forms = forms || [{}]; ropts = ropts || {};
    const parts = [`<svg xmlns="http://www.w3.org/2000/svg" width="210mm" height="297mm" viewBox="0 0 ${PAGE.w} ${PAGE.h}"><rect width="210" height="297" fill="#fff"/>`];
    for (const c of PAGE_MARK.centers) parts.push(markSVG(c[0], c[1], PAGE_MARK.size));
    parts.push(`<rect x="${ORIENT_BAR.x0}" y="${ORIENT_BAR.y - ORIENT_BAR.t / 2}" width="${ORIENT_BAR.x1 - ORIENT_BAR.x0}" height="${ORIENT_BAR.t}" fill="#000"/>`);
    const pos = pageForms(tpl.nup);
    if (tpl.nup > 1 && ropts.cutLines !== false) parts.push(cutLinesSVG(tpl.nup));
    pos.forEach((f, i) => {
      const data = forms[i];
      if (tpl.nup === 1) { parts.push(formInnerSVG(tpl, data)); return; }
      parts.push(`<g transform="translate(${f.x.toFixed(3)},${f.y.toFixed(3)})">`);
      for (const a of tpl.anchors) parts.push(markSVG(a[0], a[1], tpl.anchorSize));
      if (tpl.localBar) parts.push(`<rect x="${tpl.localBar.x0.toFixed(3)}" y="${(tpl.localBar.y - tpl.localBar.t / 2).toFixed(3)}" width="${(tpl.localBar.x1 - tpl.localBar.x0).toFixed(3)}" height="${tpl.localBar.t}" fill="#000"/>`);
      parts.push(formInnerSVG(tpl, data || {}));
      parts.push('</g>');
    });
    parts.push('</svg>');
    return parts.join('');
  }

  /* ------------------------------------------------------------------ */
  /*  Görüntü işleme yardımcıları                                        */
  /* ------------------------------------------------------------------ */
  function rgbaToGray(rgba, w, h) {
    const g = new Uint8Array(w * h);
    // parlaklık + en koyu kanal karışımı: siyah/gri aynı kalır; kırmızı, mavi, yeşil, SARI vurgulayıcı gibi renkli işaretler de koyu görünür
    for (let i = 0, j = 0; i < g.length; i++, j += 4) {
      const r = rgba[j], gg = rgba[j + 1], b = rgba[j + 2], lum = (r * 77 + gg * 150 + b * 29) >> 8, mn = r < gg ? (r < b ? r : b) : (gg < b ? gg : b);
      g[i] = (mn * 5 + lum * 3) >> 3;
    }
    return g;
  }
  function boxDown(g, w, h, f) {
    const W = Math.floor(w / f), H = Math.floor(h / f), o = new Uint8Array(W * H), n = f * f;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let s = 0; for (let yy = 0; yy < f; yy++) { const row = (y * f + yy) * w + x * f; for (let xx = 0; xx < f; xx++) s += g[row + xx]; }
      o[y * W + x] = (s / n) | 0;
    }
    return o;
  }
  function rotateGray(g, w, h, k) { // k: saat yönünde 90° adım sayısı
    k = ((k % 4) + 4) % 4; if (!k) return { gray: g, w, h };
    const nw = k % 2 ? h : w, nh = k % 2 ? w : h, o = new Uint8Array(nw * nh);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let nx, ny;
      if (k === 1) { nx = h - 1 - y; ny = x; } else if (k === 2) { nx = w - 1 - x; ny = h - 1 - y; } else { nx = y; ny = w - 1 - x; }
      o[ny * nw + nx] = g[y * w + x];
    }
    return { gray: o, w: nw, h: nh };
  }
  function adaptiveBinary(g, w, h) { // 1 = mürekkep
    const win = Math.max(25, Math.round(Math.min(w, h) * 0.08)) | 1, half = win >> 1;
    const I = new Float64Array((w + 1) * (h + 1));
    for (let y = 0; y < h; y++) { let row = 0; for (let x = 0; x < w; x++) { row += g[y * w + x]; I[(y + 1) * (w + 1) + x + 1] = I[y * (w + 1) + x + 1] + row; } }
    const out = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
      const y0 = Math.max(0, y - half), y1 = Math.min(h, y + half + 1);
      for (let x = 0; x < w; x++) {
        const x0 = Math.max(0, x - half), x1 = Math.min(w, x + half + 1);
        const s = I[y1 * (w + 1) + x1] - I[y0 * (w + 1) + x1] - I[y1 * (w + 1) + x0] + I[y0 * (w + 1) + x0];
        const mean = s / ((x1 - x0) * (y1 - y0)), v = g[y * w + x];
        out[y * w + x] = (v < mean * 0.78 && v < 170) ? 1 : 0;
      }
    }
    return out;
  }
  function findBlobs(bin, w, h, minA, maxA) {
    const lab = new Uint8Array(w * h), stack = new Int32Array(w * h), blobs = [];
    for (let i = 0; i < bin.length; i++) {
      if (!bin[i] || lab[i]) continue;
      let sp = 0, area = 0, sx = 0, sy = 0, x0 = w, y0 = h, x1 = 0, y1 = 0;
      stack[sp++] = i; lab[i] = 1;
      while (sp) {
        const p = stack[--sp], y = (p / w) | 0, x = p - y * w;
        area++; sx += x; sy += y; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        if (x > 0 && bin[p - 1] && !lab[p - 1]) { lab[p - 1] = 1; stack[sp++] = p - 1; }
        if (x < w - 1 && bin[p + 1] && !lab[p + 1]) { lab[p + 1] = 1; stack[sp++] = p + 1; }
        if (y > 0 && bin[p - w] && !lab[p - w]) { lab[p - w] = 1; stack[sp++] = p - w; }
        if (y < h - 1 && bin[p + w] && !lab[p + w]) { lab[p + w] = 1; stack[sp++] = p + w; }
      }
      if (area < minA || area > maxA) continue;
      const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
      blobs.push({ cx: sx / area, cy: sy / area, area, bw, bh, fill: area / (bw * bh), touches: x0 === 0 || y0 === 0 || x1 === w - 1 || y1 === h - 1 });
    }
    return blobs;
  }
  function otsu(vals) {
    const hist = new Float64Array(256); for (const v of vals) hist[v]++;
    let total = vals.length, sum = 0; for (let i = 0; i < 256; i++) sum += i * hist[i];
    // Tam keskin (anti-alias'sız) görüntülerde yalnızca iki gri değer vardır (ör. 0 ve 255) ve sınıflar arası varyans
    // aralarındaki tüm eşiklerde aynıdır: ilk değeri (0) seçmek ön planı yok eder. Bu yüzden en iyi platonun ortası alınır.
    let sB = 0, wB = 0, best = 0, lo = 128, hi = 128;
    for (let i = 0; i < 256; i++) {
      wB += hist[i]; if (!wB) continue; const wF = total - wB; if (!wF) break;
      sB += i * hist[i]; const mB = sB / wB, mF = (sum - sB) / wF, v = wB * wF * (mB - mF) * (mB - mF);
      if (v > best * (1 + 1e-9)) { best = v; lo = hi = i; } else if (v >= best * (1 - 1e-9) && best > 0) hi = i;
    }
    return Math.round((lo + hi) / 2);
  }
  function percentile(arr, q) { const a = Array.from(arr).sort((x, y) => x - y); return a[Math.min(a.length - 1, Math.floor(q * a.length))]; }

  /* ---- homografi ---- */
  function solve(A, b) {
    const n = b.length; for (let i = 0; i < n; i++) A[i].push(b[i]);
    for (let c = 0; c < n; c++) {
      let m = c; for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[m][c])) m = r;
      if (Math.abs(A[m][c]) < 1e-12) return null; [A[c], A[m]] = [A[m], A[c]];
      for (let r = c + 1; r < n; r++) { const f = A[r][c] / A[c][c]; for (let k = c; k <= n; k++) A[r][k] -= f * A[c][k]; }
    }
    const x = new Array(n);
    for (let i = n - 1; i >= 0; i--) { let s = A[i][n]; for (let j = i + 1; j < n; j++) s -= A[i][j] * x[j]; x[i] = s / A[i][i]; }
    return x;
  }
  function homography(src, dst) { // src -> dst, 4 nokta
    const A = [], b = [];
    for (let i = 0; i < 4; i++) {
      const [x, y] = src[i], [u, v] = dst[i];
      A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
      A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
    }
    const s = solve(A, b); return s ? [s[0], s[1], s[2], s[3], s[4], s[5], s[6], s[7], 1] : null;
  }
  function applyH(H, x, y) { const w = H[6] * x + H[7] * y + H[8]; return [(H[0] * x + H[1] * y + H[2]) / w, (H[3] * x + H[4] * y + H[5]) / w]; }
  function bil(g, w, h, x, y) {
    if (x < 0 || y < 0 || x > w - 1 || y > h - 1) return 255;
    const x0 = x | 0, y0 = y | 0, x1 = Math.min(x0 + 1, w - 1), y1 = Math.min(y0 + 1, h - 1), fx = x - x0, fy = y - y0;
    const a = g[y0 * w + x0], b = g[y0 * w + x1], c = g[y1 * w + x0], d = g[y1 * w + x1];
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  }
  function polyArea(p) { let s = 0; for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; s += a[0] * b[1] - b[0] * a[1]; } return Math.abs(s) / 2; }
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

  /* ---- 4 köşe işareti bulma ---- */
  function markLike(b, maxDim) {
    return !b.touches && b.fill > 0.42 && b.bw / b.bh > 0.55 && b.bw / b.bh < 1.8 && Math.min(b.bw, b.bh) >= maxDim * 0.005 && Math.max(b.bw, b.bh) <= maxDim * 0.09;
  }
  function pickQuad(blobs, W, H, aspect) {
    const maxDim = Math.max(W, H);
    const cands = blobs.filter(b => markLike(b, maxDim));
    let best = null;
    for (const seed of cands) {
      const grp = cands.filter(c => c.area >= seed.area * 0.5 && c.area <= seed.area * 2);
      if (grp.length < 4) continue;
      const pick = (f) => grp.reduce((m, c) => (f(c) > f(m) ? c : m), grp[0]);
      const tl = pick(c => -(c.cx + c.cy)), br = pick(c => c.cx + c.cy), tr = pick(c => c.cx - c.cy), bl = pick(c => c.cy - c.cx);
      const q = [tl, tr, br, bl];
      if (new Set(q).size < 4) continue;
      const P = q.map(c => [c.cx, c.cy]);
      const top = dist(P[0], P[1]), bot = dist(P[3], P[2]), lef = dist(P[0], P[3]), rig = dist(P[1], P[2]);
      if (Math.min(top, bot, lef, rig) < maxDim * 0.1) continue;
      if (top / bot < 0.55 || top / bot > 1.8 || lef / rig < 0.55 || lef / rig > 1.8) continue;
      const asp = ((top + bot) / 2) / ((lef + rig) / 2);
      if (aspect) { const e = Math.min(Math.abs(asp / aspect - 1), Math.abs(asp * aspect - 1)); if (e > 0.4) continue; }
      const areas = q.map(c => c.area); if (Math.max(...areas) / Math.min(...areas) > 3) continue;
      const score = polyArea(P); if (!best || score > best.score) best = { score, P };
    }
    return best ? best.P : null;
  }
  function sortClockwiseFromTL(P) {
    const cx = P.reduce((s, p) => s + p[0], 0) / 4, cy = P.reduce((s, p) => s + p[1], 0) / 4;
    const s = P.slice().sort((a, b) => Math.atan2(a[1] - cy, a[0] - cx) - Math.atan2(b[1] - cy, b[0] - cx));
    let t = 0; for (let i = 1; i < 4; i++) if (s[i][0] + s[i][1] < s[t][0] + s[t][1]) t = i;
    return [s[t], s[(t + 1) % 4], s[(t + 2) % 4], s[(t + 3) % 4]];
  }

  function refineMark(g, w, h, ex, ey, pxPerMm, sizeMm, search) {
    const SR = search || 4.6, half = Math.round(SR * pxPerMm), x0 = Math.max(0, Math.round(ex) - half), y0 = Math.max(0, Math.round(ey) - half);
    const x1 = Math.min(w, Math.round(ex) + half + 1), y1 = Math.min(h, Math.round(ey) + half + 1), ww = x1 - x0, hh = y1 - y0;
    if (ww < 8 || hh < 8) return null;
    const vals = new Uint8Array(ww * hh); for (let y = 0; y < hh; y++) for (let x = 0; x < ww; x++) vals[y * ww + x] = g[(y0 + y) * w + x0 + x];
    const th = otsu(vals), lo = percentile(vals, 0.05), hi = percentile(vals, 0.9);
    if (hi - lo < 50) return null;
    const bin = new Uint8Array(ww * hh); for (let i = 0; i < bin.length; i++) bin[i] = vals[i] < th ? 1 : 0;
    const expA = (sizeMm * pxPerMm) ** 2;
    const bl = findBlobs(bin, ww, hh, expA * 0.35, expA * 2.4).filter(b => b.fill > 0.5 && b.bw / b.bh > 0.6 && b.bw / b.bh < 1.7);
    let best = null;
    for (const b of bl) { const d = Math.hypot(b.cx + x0 - ex, b.cy + y0 - ey); if (d < SR * 0.717 * pxPerMm && (!best || d < best.d)) best = { d, x: b.cx + x0, y: b.cy + y0 }; }
    return best;
  }

  /** Yön çubuğu koyuluğu: çubuk boyunca her noktada, çizgiye dik ±span aralığındaki en koyu değer alınır
   *  (mercek bozulması / kıvrık kâğıt çubuğu eğriltse de bulunur); sonra ortalama. 0..1 */
  function barScore(g, w, h, Hc, x0, x1, y, span, paper) {
    let s = 0, n = 0;
    for (let t = 0; t <= 24; t++) {
      let mx = 0;
      for (let k = -4; k <= 4; k++) { const p = applyH(Hc, x0 + (x1 - x0) * t / 24, y + span * k / 4), d = (paper - bil(g, w, h, p[0], p[1])) / paper; if (d > mx) mx = d; }
      s += mx; n++;
    }
    return s / n;
  }

  /** Bulunan köşe işaretlerine bakıp kullanıcıya hangi köşenin eksik olduğunu söyler. */
  function describeMarks(blobs, W, Hh) {
    const maxDim = Math.max(W, Hh), cands = blobs.filter(b => markLike(b, maxDim));
    let grp = [];
    for (const sd of cands) { const g2 = cands.filter(c => c.area >= sd.area * 0.5 && c.area <= sd.area * 2); if (g2.length > grp.length) grp = g2; }
    const n = Math.min(4, grp.length);
    if (n === 3) {
      const P = grp.slice(0, 3).map(c => [c.cx, c.cy]), cx = (P[0][0] + P[1][0] + P[2][0]) / 3, cy = (P[0][1] + P[1][1] + P[2][1]) / 3;
      let best = null; for (let i = 0; i < 3; i++) { const a = P[i], b = P[(i + 1) % 3], c = P[(i + 2) % 3], q = [b[0] + c[0] - a[0], b[1] + c[1] - a[1]], d = Math.abs(dist(b, c) - dist(a, q)); if (!best || d < best.d) best = { d, q }; }
      const q = best.q, out = q[0] < 0 || q[1] < 0 || q[0] > W || q[1] > Hh;
      return { n, where: (q[1] < Hh / 2 ? 'üst' : 'alt') + '-' + (q[0] < W / 2 ? 'sol' : 'sağ'), out };
    }
    return { n, where: '', out: false };
  }
  function missingMsg(info) {
    if (info.n === 3) return `4 köşe işaretinden 3'ü bulundu; görüntünün ${info.where} köşesindeki işaret ${info.out ? 'kadraj dışında kalmış' : 'görünmüyor (gölge, parlama ya da buruşma olabilir)'}. Formun 4 köşesindeki siyah kareler tam görünmeli.`;
    return `Köşe işaretleri bulunamadı (${info.n}/4). Formun 4 köşesindeki siyah kareler ve tüm sayfa görüntüde olmalı; ekran görüntüsünde sayfanın tamamını alın.`;
  }

  /* ------------------------------------------------------------------ */
  /*  Yerel hizalama                                                     */
  /*  4 köşe yalnızca düz kâğıtta tam doğrudur. Kıvrık kâğıt, mercek bozulması ya da yazıcı ölçek hatası sayfa ortasında  */
  /*  1-3 mm kayma yapar; bu yüzden her baloncuk bloğu (ders sütunu, öğrenci no, kurum kodu) kendi basılı baloncuk       */
  /*  çizgilerine bakılarak ince ayarla hizalanır (blok içinde üst/orta/alt bant ayrı kaydırılır).                        */
  /* ------------------------------------------------------------------ */
  function boxBlur(g, w, h, rad) {
    const I = new Float64Array((w + 1) * (h + 1)), o = new Float32Array(w * h);
    for (let y = 0; y < h; y++) { let row = 0; for (let x = 0; x < w; x++) { row += g[y * w + x]; I[(y + 1) * (w + 1) + x + 1] = I[y * (w + 1) + x + 1] + row; } }
    for (let y = 0; y < h; y++) {
      const y0 = Math.max(0, y - rad), y1 = Math.min(h, y + rad + 1);
      for (let x = 0; x < w; x++) {
        const x0 = Math.max(0, x - rad), x1 = Math.min(w, x + rad + 1);
        o[y * w + x] = (I[y1 * (w + 1) + x1] - I[y0 * (w + 1) + x1] - I[y1 * (w + 1) + x0] + I[y0 * (w + 1) + x0]) / ((x1 - x0) * (y1 - y0));
      }
    }
    return o;
  }
  function makeAlign(g, w, h) {
    const f = Math.max(1, Math.ceil(Math.max(w, h) / 1600)), base = f === 1 ? g : boxDown(g, w, h, f), W = Math.floor(w / f), Hh = Math.floor(h / f), cache = {};
    return { f, W, Hh, blur: rad => cache[rad] || (cache[rad] = boxBlur(base, W, Hh, rad)) };
  }
  const AL_ANG = Array.from({ length: 10 }, (_, i) => i / 10 * Math.PI * 2 + 0.2);

  /** Bir baloncuk bloğunu üst/orta/alt bantlara bölüp her bandın kaymasını (birim) çizgi eşleştirmesiyle kestirir.
   *  dönüş: [{x, y, ux, uy, w}]  (x,y: bant merkezi, form birimi; w: tepe belirginliği) */
  function alignBands(AL, H, tpl, gr) {
    const rows = gr.ys.length, cols = gr.xs.length, p = tpl.pitch, r = tpl.r, res = [];
    if (!p || !r) return res;
    const cx = gr.xs.reduce((a, b) => a + b, 0) / cols, cy = gr.ys.reduce((a, b) => a + b, 0) / rows;
    const c0 = applyH(H, cx, cy), ex = applyH(H, cx + p, cy), ey = applyH(H, cx, cy + p), f = AL.f;
    const Jx = [(ex[0] - c0[0]) / p / f, (ex[1] - c0[1]) / p / f], Jy = [(ey[0] - c0[0]) / p / f, (ey[1] - c0[1]) / p / f];   // birim → çalışma pikseli
    const sw = Math.hypot(Jx[0], Jx[1]), rPx = r * sw;
    if (rPx < 3.4 || rPx > 60) return res;                                        // çözünürlük çok düşük (ya da çok yüksek): bu bloğu olduğu gibi oku
    const G = AL.blur(Math.max(1, Math.round(0.2 * rPx))), W = AL.W, Hh = AL.Hh;
    const gap = p - 2 * r, rOut = r + Math.max(0.3 * gap, 0.16 * r);
    const ring = rho => AL_ANG.map(a => [(Jx[0] * Math.cos(a) + Jy[0] * Math.sin(a)) * rho, (Jx[1] * Math.cos(a) + Jy[1] * Math.sin(a)) * rho]);
    const RR = ring(r), RO = ring(rOut), RC = ring(0.45 * r);
    const toW = pt => [(pt[0] - (f - 1) / 2) / f, (pt[1] - (f - 1) / 2) / f];
    const B = [];
    for (let ri = 0; ri < rows; ri++) for (let ci = 0; ci < cols; ci++) {
      const c = toW(applyH(H, gr.xs[ci], gr.ys[ri]));
      let cen = 0, pap = 0; for (let k = 0; k < RC.length; k++) { cen += bil(G, W, Hh, c[0] + RC[k][0], c[1] + RC[k][1]); pap += bil(G, W, Hh, c[0] + RO[k][0], c[1] + RO[k][1]); }
      if (cen < pap * 0.8) continue;                                                 // dolu (işaretli) baloncuk çizgi bilgisi taşımaz
      B.push({ ri, x: c[0], y: c[1] });
    }
    const nb = Math.max(1, Math.round(rows / 7)), N = 4, st = 0.11 * p;
    for (let b = 0; b < nb; b++) {
      const r0 = Math.floor(b * rows / nb), r1 = Math.floor((b + 1) * rows / nb), sel = B.filter(q => q.ri >= r0 && q.ri < r1);
      if (sel.length < 6) continue;
      const S = []; let sum = 0, sum2 = 0, best = -1e9, bi = 0, bj = 0;
      for (let j = -N; j <= N; j++) { const row = []; for (let i = -N; i <= N; i++) {
        const ux = i * st, uy = j * st, dx = Jx[0] * ux + Jy[0] * uy, dy = Jx[1] * ux + Jy[1] * uy; let v = 0;
        for (const q of sel) {
          const X = q.x + dx, Y = q.y + dy; let bb = 0, cc = 0;
          for (let k = 0; k < RR.length; k++) { bb += bil(G, W, Hh, X + RR[k][0], Y + RR[k][1]); cc += bil(G, W, Hh, X + RO[k][0], Y + RO[k][1]); }
          v += (cc - bb) / RR.length;
        }
        v /= sel.length; row.push(v); sum += v; sum2 += v * v; if (v > best) { best = v; bi = i; bj = j; }
      } S.push(row); }
      const n = (2 * N + 1) ** 2, mean = sum / n, sd = Math.sqrt(Math.max(1e-9, sum2 / n - mean * mean)), at = (i, j) => S[j + N][i + N];
      let isPeak = Math.abs(bi) < N && Math.abs(bj) < N; if (isPeak) for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) if ((di || dj) && at(bi + di, bj + dj) >= best) isPeak = false;
      if (!isPeak || best < 0.8 || (best - mean) / sd < 2.2) continue;
      const par = (m, c, pl) => { const dn = m - 2 * c + pl; return Math.abs(dn) < 1e-9 ? 0 : Math.max(-0.5, Math.min(0.5, 0.5 * (m - pl) / dn)); };
      const fx = par(at(bi - 1, bj), at(bi, bj), at(bi + 1, bj)), fy = par(at(bi, bj - 1), at(bi, bj), at(bi, bj + 1));
      const ys = sel.map(q => q.ri), rc = (Math.min(...ys) + Math.max(...ys)) / 2, ri0 = Math.max(0, Math.min(rows - 1, Math.round(rc)));
      res.push({ x: cx, y: gr.ys[ri0], ux: (bi + fx) * st, uy: (bj + fy) * st, w: Math.min(3, (best - mean) / sd / 3) });
    }
    return res;
  }

  /** Sayfa genelinde yumuşak kayma alanı: bant kestirimlerine dayanıklı (Tukey) en küçük kareler ile 2. derece polinom uydurur. */
  function alignPage(AL, H, tpl) {
    const pts = []; tpl.groups.forEach(gr => pts.push(...alignBands(AL, H, tpl, gr)));
    const info = { bands: pts.length, used: 0, max: 0, rms: 0, at: () => [0, 0] };
    if (pts.length < 8) return info;                                              // az kanıtla düzeltme yapma (yanlış kaydırmaktan iyidir)
    const fw = tpl.frame.w, fh = tpl.frame.h, nx = p => (p.x - fw / 2) / (fw / 2), ny = p => (p.y - fh / 2) / (fh / 2);
    const deg = pts.length >= 16 ? 2 : 1, terms = (x, y) => deg === 2 ? [1, x, y, x * x, x * y, y * y] : [1, x, y], K = deg === 2 ? 6 : 3;
    const fit = (wts, key) => {
      const A = Array.from({ length: K }, () => new Array(K).fill(0)), b = new Array(K).fill(0);
      pts.forEach((q, i) => { if (!wts[i]) return; const t = terms(nx(q), ny(q)); for (let a = 0; a < K; a++) { b[a] += wts[i] * t[a] * q[key]; for (let c = 0; c < K; c++) A[a][c] += wts[i] * t[a] * t[c]; } });
      for (let a = 0; a < K; a++) A[a][a] += 1e-6;
      return solve(A, b);
    };
    let wts = pts.map(q => q.w), cx = null, cy = null;
    for (let it = 0; it < 6; it++) {
      cx = fit(wts, 'ux'); cy = fit(wts, 'uy'); if (!cx || !cy) return info;
      const res = pts.map(q => { const t = terms(nx(q), ny(q)); let px = 0, py = 0; for (let a = 0; a < K; a++) { px += cx[a] * t[a]; py += cy[a] * t[a]; } return Math.hypot(q.ux - px, q.uy - py); });
      const sorted = res.slice().sort((a, b) => a - b), med = sorted[Math.floor(sorted.length / 2)], sc = Math.max(0.1 * tpl.pitch, 1.4826 * med) * 2.5;
      wts = pts.map((q, i) => res[i] < sc ? q.w * (1 - (res[i] / sc) ** 2) ** 2 : 0);
    }
    const inl = wts.filter(v => v > 0).length; info.used = inl;
    if (inl < Math.max(6, Math.ceil(pts.length * 0.6))) return info;
    { let sr = 0, sw2 = 0; pts.forEach((q, i) => { if (!wts[i]) return; const t = terms(nx(q), ny(q)); let px = 0, py = 0; for (let a = 0; a < K; a++) { px += cx[a] * t[a]; py += cy[a] * t[a]; } sr += wts[i] * ((q.ux - px) ** 2 + (q.uy - py) ** 2); sw2 += wts[i]; });
      info.resid = Math.sqrt(sr / Math.max(1e-9, sw2)); if (info.resid > 0.14 * tpl.pitch) return info; }   // kestirimler birbiriyle tutarsız: kâğıt düzgün bir bozulma göstermiyor
    const lim = 0.44 * tpl.pitch;
    info.at = (x, y) => {
      const t = terms((x - fw / 2) / (fw / 2), (y - fh / 2) / (fh / 2)); let px = 0, py = 0; for (let a = 0; a < K; a++) { px += cx[a] * t[a]; py += cy[a] * t[a]; }
      const m = Math.hypot(px, py); if (m > lim * 1.6) { px *= lim * 1.6 / m; py *= lim * 1.6 / m; } return [px, py];
    };
    let mx = 0, sq = 0, n = 0; for (const gr of tpl.groups) for (const y of gr.ys) { const o = info.at(gr.xs.reduce((a, b) => a + b, 0) / gr.xs.length, y); const m = Math.hypot(o[0], o[1]); mx = Math.max(mx, m); sq += m * m; n++; }
    info.max = mx; info.rms = Math.sqrt(sq / Math.max(1, n)); info.ok = true;
    return info;
  }

  /* ------------------------------------------------------------------ */
  /*  Baloncuk okuma                                                     */
  /* ------------------------------------------------------------------ */
  const INNER = (() => { const o = [[0, 0]]; for (const [rf, n] of [[0.35, 6], [0.75, 12]]) for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2 + 0.3; o.push([Math.cos(a) * rf, Math.sin(a) * rf]); } return o; })();
  const RING = (() => { const o = []; for (const [rf, n] of [[1.55, 10], [1.85, 10]]) for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2 + 0.15; o.push([Math.cos(a) * rf, Math.sin(a) * rf]); } return o; })();

  function bubbleDark(g, w, h, H, cx, cy, r) {
    let si = 0; const inner = r * 0.62;
    for (const [ox, oy] of INNER) { const p = applyH(H, cx + ox * inner, cy + oy * inner); si += bil(g, w, h, p[0], p[1]); }
    const mi = si / INNER.length, ring = [];
    for (const [ox, oy] of RING) { const p = applyH(H, cx + ox * r, cy + oy * r); ring.push(bil(g, w, h, p[0], p[1])); }
    ring.sort((a, b) => a - b); const paper = Math.max(ring[Math.floor(ring.length * 0.7)], 40);
    return Math.min(1, Math.max(0, (paper - mi) / paper));
  }

  function decideLine(sc, T) {
    let i1 = 0; for (let i = 1; i < sc.length; i++) if (sc[i] > sc[i1]) i1 = i;
    const s1 = sc[i1]; let s2 = 0, i2 = -1;
    for (let i = 0; i < sc.length; i++) if (i !== i1 && sc[i] > s2) { s2 = sc[i]; i2 = i; }
    if (s1 < T) return { idx: -1, flag: s1 > T - 0.07 ? 'weak' : '' };
    if (s2 >= T && s2 >= 0.72 * s1) return { idx: -2, flag: 'multi' };
    let flag = '';
    if (s2 >= T * 0.8 && s2 >= 0.45 * s1) flag = 'erase';
    else if (s1 < T + 0.08) flag = 'weak';
    return { idx: i1, flag };
  }

  function readFrame(g, w, h, H, tpl, AL) {
    const all = [];
    const al = (AL && tpl.kind === 'generated') ? alignPage(AL, H, tpl) : null;
    const raw = tpl.groups.map((gr, gi) => {
      const lines = [], gx = gr.xs.reduce((a, b) => a + b, 0) / gr.xs.length, ox = ri => al && al.ok ? al.at(gx, gr.ys[ri])[0] : 0, oy = ri => al && al.ok ? al.at(gx, gr.ys[ri])[1] : 0;
      if (gr.axis === 'row') for (let ri = 0; ri < gr.ys.length; ri++) lines.push(gr.xs.map(x => bubbleDark(g, w, h, H, x + ox(ri), gr.ys[ri] + oy(ri), tpl.r)));
      else for (let ci = 0; ci < gr.xs.length; ci++) lines.push(gr.ys.map((y, ri) => bubbleDark(g, w, h, H, gr.xs[ci] + ox(ri), y + oy(ri), tpl.r)));
      for (const l of lines) for (const v of l) all.push(v);
      return lines;
    });
    const baseline = percentile(all, 0.5), T = Math.min(0.55, Math.max(0.28, baseline + 0.2));
    const res = { studentNo: '', schoolCode: '', booklet: '', fields: {}, flags: [], groups: [], threshold: T, baseline };
    if (al) res.align = { ok: !!al.ok, max: al.max, rms: al.rms, bands: al.bands, used: al.used };
    const ans = {};
    tpl.groups.forEach((gr, gi) => {
      const lines = raw[gi].map((sc, li) => {
        const dcd = decideLine(sc, T);
        const v = dcd.idx >= 0 ? gr.labels[dcd.idx] : (dcd.idx === -2 ? '*' : '-');
        return { v, d: sc, flag: dcd.flag };
      });
      res.groups.push({ id: gr.id, role: gr.role, axis: gr.axis, lines });
      if (gr.role === 'questions') lines.forEach((l, i) => {
        const q = gr.qStart + i; ans[q] = l.v;
        if (l.flag === 'multi' || l.flag === 'erase' || l.flag === 'weak') res.flags.push({ q, type: l.flag });
      });
      else if (gr.role === 'studentNo') {
        res.studentNo = lines.map((l, i) => { if (l.v === '-' || l.v === '*') { res.flags.push({ field: 'studentNo', col: i, type: l.v === '*' ? 'multi' : 'blank' }); return '?'; } return l.v; }).join('');
      } else if (gr.role === 'schoolCode') {
        res.schoolCode = lines.map(l => (l.v === '-' || l.v === '*') ? '?' : l.v).join('');
        lines.forEach((l, i) => { if (l.v === '*') res.flags.push({ field: 'schoolCode', col: i, type: 'multi' }); });
      } else if (gr.role === 'booklet') {
        res.booklet = lines[0].v === '-' || lines[0].v === '*' ? '' : lines[0].v;
        if (lines[0].v === '*') res.flags.push({ field: 'booklet', type: 'multi' });
      } else res.fields[gr.id] = lines.map(l => l.v).join('');
    });
    const n = tpl.questions || Object.keys(ans).length; let s = '';
    for (let q = 1; q <= n; q++) s += ans[q] || '-';
    res.answers = s;
    if (tpl.kind === 'generated') res.formCode = readFormCode(g, w, h, H, tpl.nup);
    return res;
  }

  /** Formun altındaki ikili kimlik kodunu çözer (hangi form olduğunu anlamak için). H: form koordinatı(mm) → görüntü pikseli */
  function readFormCode(g, w, h, H, nup) {
    let cg; try { cg = codeGeometry(nup); } catch (e) { return { ok: false, code: -1 }; }
    const rr = Math.min(cg.cellW, cg.cellH) * 0.28, OFF = [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]];
    const samp = (x, y, r2) => { let s = 0; for (const [ox, oy] of OFF) { const p = applyH(H, x + ox * r2, y + oy * r2); s += bil(g, w, h, p[0], p[1]); } return s / OFF.length; };
    const vals = cg.cells.map(c => samp(c[0], c[1], rr));
    let paper = 0, n = 0; for (let i = 0; i < cg.cells.length; i += 2) { paper += samp(cg.cells[i][0], cg.paperY, 0.4); n++; } paper /= n;
    const ink = vals[0]; if (paper - ink < 40) return { ok: false, code: -1 };
    const thr = ink + (paper - ink) * 0.5, bits = vals.map(v => v < thr ? 1 : 0);
    if (bits[0] !== 1) return { ok: false, code: -1 };
    let v = 0, c = 0; for (let i = 1; i <= 24; i++) v = v * 2 + bits[i]; for (let i = 25; i < CODE_CELLS; i++) c = c * 2 + bits[i];
    if (c !== codeCheck(v)) return { ok: false, code: -1 };
    return { ok: true, code: v, hex: codeHex(v) };
  }

  /* ------------------------------------------------------------------ */
  /*  Sayfa okuma (köşe bulma, yön, sığdırma)                            */
  /* ------------------------------------------------------------------ */
  function pxPerUnit(H, ux, uy, span) { const a = applyH(H, ux, uy), b = applyH(H, ux + span, uy); return dist(a, b) / span; }

  function readPageCore(img, tpl, opts) {
    opts = opts || {};
    const g = img.gray, w = img.w, h = img.h;
    const out = { ok: false, error: '', forms: [], orientation: 0, corners: null, notes: [] };
    const f = Math.max(1, Math.ceil(Math.max(w, h) / (opts.workDim || 1600)));
    const work = f === 1 ? g : boxDown(g, w, h, f), W = Math.floor(w / f), Hh = Math.floor(h / f);
    const nup = tpl.nup || 1;
    const pageAnchors = (tpl.kind === 'generated' && nup > 1) ? PAGE_MARK.centers : tpl.anchors;
    const aw = Math.hypot(pageAnchors[1][0] - pageAnchors[0][0], pageAnchors[1][1] - pageAnchors[0][1]);
    const ah = Math.hypot(pageAnchors[3][0] - pageAnchors[0][0], pageAnchors[3][1] - pageAnchors[0][1]);

    let ordered = null, Hp = null;
    if (opts.corners) { ordered = opts.corners; Hp = homography(pageAnchors, ordered); }
    else {
      const bin = adaptiveBinary(work, W, Hh);
      const minA = Math.max(9, (Math.max(W, Hh) * 0.005) ** 2 * 0.6);
      const blobs = findBlobs(bin, W, Hh, minA, (Math.max(W, Hh) * 0.09) ** 2);
      const P = pickQuad(blobs, W, Hh, aw / ah);
      if (!P) { out.error = missingMsg(describeMarks(blobs, W, Hh)); return out; }
      const full = P.map(p => [p[0] * f + (f - 1) / 2, p[1] * f + (f - 1) / 2]);
      const base = sortClockwiseFromTL(full);
      if (tpl.orient) {
        const paper = percentile(work.length > 200000 ? work.filter((_, i) => i % 7 === 0) : work, 0.9) || 200;
        let best = -1, bestS = -9, second = -9;
        for (let r = 0; r < 4; r++) {
          const cand = [0, 1, 2, 3].map(i => base[(i + r) % 4]), Hc = homography(pageAnchors, cand); if (!Hc) continue;
          const s = barScore(g, w, h, Hc, ORIENT_BAR.x0, ORIENT_BAR.x1, ORIENT_BAR.y, 1.9, paper);
          if (s > bestS) { second = bestS; bestS = s; best = r; } else if (s > second) second = s;
        }
        if (best < 0 || bestS < 0.3 || bestS - second < 0.2) { out.error = 'Sayfa doğrulanamadı: 4 köşe işareti ve üst kenardaki siyah çubuk görüntüde tam görünmeli. Köşelerden biri kadraj dışında kalmış olabilir.'; out.corners = base; return out; }
        out.orientation = best * 90;
        ordered = [0, 1, 2, 3].map(i => base[(i + best) % 4]);
      } else ordered = [0, 1, 2, 3].map(i => base[(i + ((opts.rot || 0) % 4 + 4) % 4) % 4]);   // harici formlarda yön: elle döndürme
      Hp = homography(pageAnchors, ordered);
      // sayfa köşe işaretlerini tam çözünürlükte yeniden bul (küçültülmüş görüntüdeki merkez ~1 px hatalıdır)
      if (Hp && tpl.kind === 'generated') {
        const sc0 = pxPerUnit(Hp, pageAnchors[0][0], pageAnchors[0][1], 10);
        const pm = pageAnchors.map(a => { const e = applyH(Hp, a[0], a[1]), r = refineMark(g, w, h, e[0], e[1], sc0, PAGE_MARK.size, 3.4); return r ? [r.x, r.y] : e; });
        const H2 = homography(pageAnchors, pm); if (H2 && dist(pm[0], ordered[0]) < sc0 * 3) { ordered = pm; Hp = H2; }
      }
    }
    out.corners = ordered;
    if (!Hp) { out.error = 'Köşe noktalarından dönüşüm hesaplanamadı.'; return out; }

    const AL = tpl.kind === 'generated' && nup === 1 && !opts.noAlign ? makeAlign(g, w, h) : null;   // 2/4/6/8'li formlar kendi köşe işaretleriyle zaten yerel hizalanır
    const forms = (tpl.kind === 'generated') ? pageForms(nup) : [{ x: 0, y: 0, w: tpl.frame.w, h: tpl.frame.h }];
    const scale = pxPerUnit(Hp, pageAnchors[0][0], pageAnchors[0][1], 10);
    forms.forEach((F, idx) => {
      let Hf = null, refined = 0, offs = [];
      if (tpl.kind === 'generated' && nup > 1) {
        const px = tpl.anchors.map(a => {
          const e = applyH(Hp, F.x + a[0], F.y + a[1]);
          const r = refineMark(g, w, h, e[0], e[1], scale, tpl.anchorSize);
          if (r) { refined++; offs.push(Math.hypot(r.x - e[0], r.y - e[1]) / scale); return [r.x, r.y]; } return e;
        });
        Hf = homography(tpl.anchors, px);
      } else if (tpl.kind === 'generated') Hf = Hp;
      else Hf = Hp;
      if (!Hf) { out.forms.push({ index: idx, ok: false, error: 'Dönüşüm hesaplanamadı' }); return; }
      const r = readFrame(g, w, h, Hf, tpl, AL);
      r.index = idx; r.ok = true; r.H = Hf; r.refinedMarks = refined; r.markShiftMm = offs.length ? Math.max(...offs) : 0;
      out.forms.push(r);
    });
    out.ok = out.forms.some(x => x.ok);
    if (out.ok && tpl.kind === 'generated' && nup > 1 && !opts.corners && !out.forms.some(f => f.ok && f.refinedMarks >= 3)) {
      out.ok = false; out.forms = []; out.error = 'Bu görüntü bir tam sayfa gibi okunamadı (formların kendi köşe işaretleri bulunamadı).';
    }
    return out;
  }

  /** Kesilmiş tek form (2/4/6/8'li sayfadan): formun kendi 4 köşe işareti + yön çubuğu ile okunur. */
  function readSingle(img, tpl, opts) {
    opts = opts || {};
    const g = img.gray, w = img.w, h = img.h, out = { ok: false, error: '', forms: [], orientation: 0, corners: null, notes: [], single: true };
    const f = Math.max(1, Math.ceil(Math.max(w, h) / (opts.workDim || 1600))), work = f === 1 ? g : boxDown(g, w, h, f), W = Math.floor(w / f), Hh = Math.floor(h / f);
    const A = tpl.anchors, aw = dist(A[0], A[1]), ah = dist(A[0], A[3]), bar = tpl.localBar;
    const bin = adaptiveBinary(work, W, Hh), minA = Math.max(9, (Math.max(W, Hh) * 0.005) ** 2 * 0.6);
    const blobsS = findBlobs(bin, W, Hh, minA, (Math.max(W, Hh) * 0.09) ** 2), P = pickQuad(blobsS, W, Hh, aw / ah);
    if (!P) { out.error = missingMsg(describeMarks(blobsS, W, Hh)); return out; }
    const base = sortClockwiseFromTL(P.map(p => [p[0] * f + (f - 1) / 2, p[1] * f + (f - 1) / 2]));
    let ordered;
    if (opts.corners) ordered = opts.corners;
    else {
      const paper = percentile(work.length > 200000 ? work.filter((_, i) => i % 7 === 0) : work, 0.9) || 200;
      let best = -1, bestS = -9, second = -9;
      for (let r = 0; r < 4; r++) {
        const cand = [0, 1, 2, 3].map(i => base[(i + r) % 4]), Hc = homography(A, cand); if (!Hc) continue;
        const s = barScore(g, w, h, Hc, bar.x0, bar.x1, bar.y, 1.5, paper);
        if (s > bestS) { second = bestS; bestS = s; best = r; } else if (s > second) second = s;
      }
      if (best < 0 || bestS < 0.3 || bestS - second < 0.2) { out.error = 'Form doğrulanamadı: 4 köşe işareti ve üst kenardaki siyah çubuk görünmeli.'; out.corners = base; return out; }
      out.orientation = best * 90; ordered = [0, 1, 2, 3].map(i => base[(i + best) % 4]);
    }
    out.corners = ordered;
    const Hp = homography(A, ordered); if (!Hp) { out.error = 'Köşe noktalarından dönüşüm hesaplanamadı.'; return out; }
    const scale = pxPerUnit(Hp, A[0][0], A[0][1], 10); let refined = 0;
    const px = A.map(a => { const e = applyH(Hp, a[0], a[1]), r = refineMark(g, w, h, e[0], e[1], scale, tpl.anchorSize); if (r) { refined++; return [r.x, r.y]; } return e; });
    const Hf = homography(A, px); if (!Hf) { out.error = 'Dönüşüm hesaplanamadı.'; return out; }
    const r = readFrame(g, w, h, Hf, tpl, null); r.index = 0; r.ok = true; r.H = Hf; r.refinedMarks = refined; r.markShiftMm = 0;
    out.forms.push(r); out.ok = true; return out;
  }

  /** Sayfa okuma: önce tam sayfa; olmazsa (2/4/6/8'li formda) kesilmiş tek form olarak dener. */
  function readPage(img, tpl, opts) {
    const res = readPageCore(img, tpl, opts);
    if (res.ok || !(tpl.kind === 'generated' && tpl.nup > 1) || (opts && opts.noSingle)) return res;
    const one = readSingle(img, tpl, opts);
    if (one.ok) return one;
    if (!res.error || /bulunamadı|doğrulanamadı|tam sayfa gibi/.test(res.error)) res.error = 'Form okunamadı: 4 köşe işareti (ve üstteki siyah çubuk) görünür olmalı. Tam sayfa ya da kesilmiş tek form olabilir.';
    return res;
  }

  /** Canlı kamera karesi için hızlı inceleme: köşe işaretleri, netlik, ışık. aspects: kabul edilen köşe dörtgeni en-boy oranları */
  function probe(g, w, h, aspects) {
    const bin = adaptiveBinary(g, w, h), maxDim = Math.max(w, h), minA = Math.max(9, (maxDim * 0.005) ** 2 * 0.6);
    const blobs = findBlobs(bin, w, h, minA, (maxDim * 0.09) ** 2), cands = blobs.filter(b => markLike(b, maxDim));
    let quad = null, qa = 0;
    for (const asp of (aspects && aspects.length ? aspects : [0])) { const P = pickQuad(blobs, w, h, asp); if (P) { const a = polyArea(P); if (a > qa) { qa = a; quad = P; } } }
    let nMarks = 0; for (const sd of cands) { const n = cands.filter(c => c.area >= sd.area * 0.5 && c.area <= sd.area * 2).length; if (n > nMarks) nMarks = n; }
    const sorted = quad ? sortClockwiseFromTL(quad) : null;
    // ışık/netlik: dörtgenin içi (yoksa tüm kare)
    let x0 = 0, y0 = 0, x1 = w, y1 = h;
    if (sorted) { x0 = Math.max(1, Math.floor(Math.min(...sorted.map(p => p[0])))); x1 = Math.min(w - 1, Math.ceil(Math.max(...sorted.map(p => p[0])))); y0 = Math.max(1, Math.floor(Math.min(...sorted.map(p => p[1])))); y1 = Math.min(h - 1, Math.ceil(Math.max(...sorted.map(p => p[1])))); }
    let s = 0, s2 = 0, n = 0; const hist = new Uint32Array(256);
    for (let y = y0 + 1; y < y1 - 1; y += 2) for (let x = x0 + 1; x < x1 - 1; x += 2) {
      const c = g[y * w + x], lap = 4 * c - g[y * w + x - 1] - g[y * w + x + 1] - g[(y - 1) * w + x] - g[(y + 1) * w + x];
      s += lap; s2 += lap * lap; n++; hist[c]++;
    }
    let lo = 0, hi = 255, acc = 0; for (let i = 0; i < 256; i++) { acc += hist[i]; if (acc >= n * 0.01) { lo = i; break; } } acc = 0; for (let i = 255; i >= 0; i--) { acc += hist[i]; if (acc >= n * 0.25) { hi = i; break; } }
    const contrast = Math.max(1, hi - lo), lapVar = n ? s2 / n - (s / n) ** 2 : 0;
    return { quad: sorted, nMarks: Math.min(4, nMarks), cands: cands.map(c => [c.cx, c.cy]), sharp: lapVar / (contrast * contrast), contrast, paper: hi };
  }


  /** Şablon bilinmeden formun altındaki kimlik kodunu bulur (tam sayfa ya da kesilmiş tek form; 1/2/4/6/8'li). */
  function detectFormCode(img, opts) {
    opts = opts || {};
    const g = img.gray, w = img.w, h = img.h, f = Math.max(1, Math.ceil(Math.max(w, h) / (opts.workDim || 1600)));
    const work = f === 1 ? g : boxDown(g, w, h, f), W = Math.floor(w / f), Hh = Math.floor(h / f), maxDim = Math.max(W, Hh);
    const blobs = findBlobs(adaptiveBinary(work, W, Hh), W, Hh, Math.max(9, (maxDim * 0.005) ** 2 * 0.6), (maxDim * 0.09) ** 2);
    const paper = percentile(work.length > 200000 ? work.filter((_, i) => i % 7 === 0) : work, 0.9) || 200;
    const toFull = P => sortClockwiseFromTL(P.map(p => [p[0] * f + (f - 1) / 2, p[1] * f + (f - 1) / 2]));
    const orient = (base, A, x0, x1, y, dys) => {
      let best = -1, bestS = -9, second = -9;
      for (let r = 0; r < 4; r++) {
        const cand = [0, 1, 2, 3].map(i => base[(i + r) % 4]), Hc = homography(A, cand); if (!Hc) continue;
        const s = barScore(g, w, h, Hc, x0, x1, y, dys[dys.length - 1] * 3.6, paper);
        if (s > bestS) { second = bestS; bestS = s; best = r; } else if (s > second) second = s;
      }
      return best >= 0 && bestS >= 0.3 && bestS - second >= 0.2 ? [0, 1, 2, 3].map(i => base[(i + best) % 4]) : null;
    };
    // 1) tam sayfa
    const PA = PAGE_MARK.centers, Pq = pickQuad(blobs, W, Hh, dist(PA[0], PA[1]) / dist(PA[0], PA[3]));
    if (Pq) {
      const ord = orient(toFull(Pq), PA, ORIENT_BAR.x0, ORIENT_BAR.x1, ORIENT_BAR.y, [-0.5, 0, 0.5]), Hp = ord && homography(PA, ord);
      if (Hp) {
        const c1 = readFormCode(g, w, h, Hp, 1); if (c1.ok) return { nup: 1, code: c1.code, hex: c1.hex, single: false };
        const scale = pxPerUnit(Hp, PA[0][0], PA[0][1], 10);
        for (const nup of [8, 6, 4, 2]) for (const F of pageForms(nup)) {   // küçük formlardan başla (4'lü formun işaretleri 8'lininkilerle çakışır)
          const A = [[LOCAL_INSET, LOCAL_INSET], [F.w - LOCAL_INSET, LOCAL_INSET], [F.w - LOCAL_INSET, F.h - LOCAL_INSET], [LOCAL_INSET, F.h - LOCAL_INSET]];
          let ref = 0; const px = A.map(a => { const e = applyH(Hp, F.x + a[0], F.y + a[1]), r = refineMark(g, w, h, e[0], e[1], scale, LOCAL_MARK); if (r) ref++; return r ? [r.x, r.y] : e; });
          if (ref < 3) continue;   // bu sığdırmanın form köşe işaretleri orada yok → başka bir sığdırma
          const Hf = homography(A, px); if (!Hf) continue; const c = readFormCode(g, w, h, Hf, nup); if (c.ok) return { nup, code: c.code, hex: c.hex, single: false };
        }
      }
    }
    // 2) kesilmiş tek form
    for (const nup of [8, 6, 4, 2]) {
      const F = pageForms(nup)[0], A = [[LOCAL_INSET, LOCAL_INSET], [F.w - LOCAL_INSET, LOCAL_INSET], [F.w - LOCAL_INSET, F.h - LOCAL_INSET], [LOCAL_INSET, F.h - LOCAL_INSET]];
      const Q = pickQuad(blobs, W, Hh, dist(A[0], A[1]) / dist(A[0], A[3])); if (!Q) continue;
      const ord = orient(toFull(Q), A, F.w * LOCAL_BAR.f0, F.w * LOCAL_BAR.f1, LOCAL_INSET, [-0.4, 0, 0.4]), Hp = ord && homography(A, ord); if (!Hp) continue;
      const scale = pxPerUnit(Hp, A[0][0], A[0][1], 10);
      const px = A.map(a => { const e = applyH(Hp, a[0], a[1]), r = refineMark(g, w, h, e[0], e[1], scale, LOCAL_MARK); return r ? [r.x, r.y] : e; });
      const Hf = homography(A, px); if (!Hf) continue; const c = readFormCode(g, w, h, Hf, nup); if (c.ok) return { nup, code: c.code, hex: c.hex, single: true };
    }
    return null;
  }

  /** Üretilmiş (mm) tek sayfa şablonunu piksel birimli "harici form" şablonuna çevirir (test ve örnek amaçlı). */
  function toCustom(t, s) {
    return {
      kind: 'custom', version: 1, orient: false, nup: 1, frame: { w: t.frame.w * s, h: t.frame.h * s },
      anchors: t.anchors.map(a => [a[0] * s, a[1] * s]), anchorSize: t.anchorSize * s, r: t.r * s, pitch: t.pitch * s,
      questions: t.questions, choices: t.choices, digits: t.digits, booklets: t.booklets.slice(),
      groups: t.groups.map(g => ({ id: g.id, role: g.role, axis: g.axis, labels: g.labels.slice(), xs: g.xs.map(v => v * s), ys: g.ys.map(v => v * s), qStart: g.qStart })), decor: []
    };
  }

  /** Önizleme: çerçeveyi düzeltilmiş gri görüntü olarak üret (px/birim = s) */
  function rectify(img, H, frame, s) {
    const W = Math.round(frame.w * s), Hh = Math.round(frame.h * s), o = new Uint8ClampedArray(W * Hh);
    for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) { const p = applyH(H, x / s, y / s); o[y * W + x] = bil(img.gray, img.w, img.h, p[0], p[1]); }
    return { gray: o, w: W, h: Hh };
  }

  return {
    PAGE, PAGE_MARK, ORIENT_BAR, LETTERS, pageForms, buildTemplate, renderPageSVG, formInnerSVG,
    NUPS, CODE_CELLS, LOCAL_BAR, detectFormCode, codeGeometry, formCodeOf, codeHex, readFormCode, cutLinesSVG, modeInfo, probe, readSingle,
    rgbaToGray, boxDown, rotateGray, adaptiveBinary, findBlobs, homography, applyH, readPage, readFrame, rectify, decideLine, refineMark, toCustom, pxPerUnit, makeAlign, alignPage
  };
});
