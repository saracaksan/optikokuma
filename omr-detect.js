/*  omr-detect.js — HARİCİ optik formu kendiliğinden tanıyan modül (tarayıcıda, worker'da ve Node'da çalışır)
 *
 *  analyze(img)            boş (işaretsiz) form görüntüsünden: 4 köşe işareti → düzeltilmiş çerçeve → tüm baloncuklar →
 *                          bloklar (satır × sütun) → rol tahmini (soru / öğrenci no / kurum kodu / kitapçık)
 *  makeTemplate(analysis)  (kullanıcının onayladığı) blokları okuma şablonuna çevirir (kind:'custom', auto:true)
 *  fit(img, tpl)           taranmış/fotoğraflanmış formun bu şablonla örtüşme oranı + yön (0/90/180/270) — şablonu kendiliğinden tanır
 *  identify(img, list)     birden çok şablon arasından formu bulur
 *  readAuto(img, tpl)      yönü ve köşeleri kendiliğinden bulup okur (worker ve ana iş parçacığı ortak kullanır)
 *
 *  Koordinat sistemi: şablon "çerçeve" pikselindedir. Çerçeve, 4 köşe işaretinin oluşturduğu dikdörtgendir (kenar payıyla); perspektif
 *  düzeltilmiştir. Okurken 4 işaret bu dikdörtgene eşlendiği için (homografi) baloncuk konumları tam oturur.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./omr-core.js'));
  else root.OMRDetect = factory(root.OMR);
})(typeof self !== 'undefined' ? self : this, function (OMR) {
  'use strict';

  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const mean = a => a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0;
  const median = a => { if (!a.length) return 0; const s = a.slice().sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
  const r2 = v => Math.round(v * 100) / 100;
  const LEVELS = [[0.78, 170], [0.86, 200], [0.92, 225]];   // adaptif eşik duyarlılığı: [ortalamaya oran, mutlak üst sınır]
  const DIGITS = '0123456789', LETTERS = 'ABCDEFGH';

  /* ------------------------------------------------------------------ görüntü işleme */
  function binarize(g, w, h, ratio, abs) {   // 1 = mürekkep (omr-core adaptiveBinary ile aynı, ayarlanabilir)
    const win = Math.max(25, Math.round(Math.min(w, h) * 0.08)) | 1, half = win >> 1, I = new Float64Array((w + 1) * (h + 1));
    for (let y = 0; y < h; y++) { let row = 0; for (let x = 0; x < w; x++) { row += g[y * w + x]; I[(y + 1) * (w + 1) + x + 1] = I[y * (w + 1) + x + 1] + row; } }
    const out = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
      const y0 = Math.max(0, y - half), y1 = Math.min(h, y + half + 1);
      for (let x = 0; x < w; x++) {
        const x0 = Math.max(0, x - half), x1 = Math.min(w, x + half + 1);
        const s = I[y1 * (w + 1) + x1] - I[y0 * (w + 1) + x1] - I[y1 * (w + 1) + x0] + I[y0 * (w + 1) + x0], m = s / ((x1 - x0) * (y1 - y0)), v = g[y * w + x];
        out[y * w + x] = (v < m * ratio && v < abs) ? 1 : 0;
      }
    }
    return out;
  }

  /** 4 köşe işaretini bulur (sol-üst, sağ-üst, sağ-alt, sol-alt; görüntü pikseli). Tam çözünürlükte inceltir. */
  function findAnchors(img, opts) {
    opts = opts || {};
    const g = img.gray, w = img.w, h = img.h, f = Math.max(1, Math.ceil(Math.max(w, h) / (opts.workDim || 1600)));
    const work = f === 1 ? g : OMR.boxDown(g, w, h, f), W = Math.floor(w / f), H = Math.floor(h / f), maxDim = Math.max(W, H);
    const blobs = OMR.findBlobs(OMR.adaptiveBinary(work, W, H), W, H, Math.max(9, (maxDim * 0.005) ** 2 * 0.6), (maxDim * 0.09) ** 2);
    const P = OMR.pickQuad(blobs, W, H, 0);
    if (!P) return { ok: false, error: 'Formda 4 köşe işareti (siyah dolu kareler) bulunamadı. İşaretlerin dördü de görünür, net ve kadrajın içinde olmalı.' };
    const near = P.map(p => { let b = null, bd = 1e9; blobs.forEach(o => { const d = Math.hypot(o.cx - p[0], o.cy - p[1]); if (d < bd) { bd = d; b = o; } }); return b; });
    const sizes = near.map(b => b ? Math.sqrt(b.area) * f : 0);
    const strong = near.every(b => b && b.fill >= 0.8 && Math.min(b.bw, b.bh) >= maxDim * 0.012);   // dolu, belirgin kareler (metin harfleri 4 köşe sanılmasın)
    const size = median(sizes) || 10, base = OMR.sortClockwiseFromTL(P.map(p => [p[0] * f + (f - 1) / 2, p[1] * f + (f - 1) / 2]));
    const corners = base.map(c => { const r = OMR.refineMark(g, w, h, c[0], c[1], 1, size, size + 4 * f); return r ? [r.x, r.y] : c; });
    return { ok: true, kind: 'corners', corners, size, strong };
  }

  /** Köşe işaretlerine (ya da yan çizgi uçlarına) göre formu düz dikdörtgene açar (çerçeve). opts.margin: çerçeve kenar payı (en uzun kenarın oranı, varsayılan 0.05).
   *  Çıktı: { gray, w, h, anchors(çerçevede), k, H(çerçeve→görüntü) } */
  function toFrame(img, corners, opts) {
    opts = opts || {};
    const aw = (dist(corners[0], corners[1]) + dist(corners[3], corners[2])) / 2, ah = (dist(corners[0], corners[3]) + dist(corners[1], corners[2])) / 2, mg = opts.margin != null ? opts.margin : 0.05;
    const k = Math.min(1, (opts.maxFrame || 2400) / (Math.max(aw, ah) * (1 + 2 * mg))), M = Math.round(mg * Math.max(aw, ah) * k);
    const fw = Math.round(aw * k) + 2 * M, fh = Math.round(ah * k) + 2 * M, A = [[M, M], [M + aw * k, M], [M + aw * k, M + ah * k], [M, M + ah * k]];
    const H = OMR.homography(A, corners); if (!H) return null;
    const rc = OMR.rectify(img, H, { w: fw, h: fh }, 1);
    return { gray: rc.gray, w: rc.w, h: rc.h, anchors: A, k, H };
  }

  /* ------------------------------------------------------------------ yan çizgiler (zamanlama izleri) */
  /*  Köşe karesi olmayan formlarda sol ve sağ kenardaki kısa siyah çizgiler (her satır için bir tane) formu sabitler.                */
  /*  İki iz bulunur; uçlardaki işaretler çerçeveyi (4 nokta) verir, bütün işaretler okurken homografiyi en küçük kareler ile inceltir. */

  /** Bağlı bileşenler + ikinci dereceden momentler: dikdörtgen eşdeğeri uzun/kısa kenar (L1, L2), yön ve doluluk (döndürmeden bağımsız). */
  function blobStats(bin, w, h, minA, maxA) {
    const lab = new Uint8Array(w * h), stack = new Int32Array(w * h), out = [];
    for (let i = 0; i < bin.length; i++) {
      if (!bin[i] || lab[i]) continue;
      let sp = 0, n = 0, sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0, x0 = w, y0 = h, x1 = 0, y1 = 0;
      stack[sp++] = i; lab[i] = 1;
      while (sp) {
        const p = stack[--sp], y = (p / w) | 0, x = p - y * w;
        n++; sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y;
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        if (x > 0 && bin[p - 1] && !lab[p - 1]) { lab[p - 1] = 1; stack[sp++] = p - 1; }
        if (x < w - 1 && bin[p + 1] && !lab[p + 1]) { lab[p + 1] = 1; stack[sp++] = p + 1; }
        if (y > 0 && bin[p - w] && !lab[p - w]) { lab[p - w] = 1; stack[sp++] = p - w; }
        if (y < h - 1 && bin[p + w] && !lab[p + w]) { lab[p + w] = 1; stack[sp++] = p + w; }
      }
      if (n < minA || n > maxA) continue;
      const cx = sx / n, cy = sy / n, vxx = sxx / n - cx * cx, vyy = syy / n - cy * cy, vxy = sxy / n - cx * cy, t = (vxx + vyy) / 2, d = Math.sqrt(Math.max(0, ((vxx - vyy) / 2) ** 2 + vxy * vxy));
      const L1 = Math.sqrt(12 * (t + d) + 1), L2 = Math.sqrt(12 * Math.max(0, t - d) + 1);
      out.push({ cx, cy, n, L1, L2, ang: 0.5 * Math.atan2(2 * vxy, vxx - vyy), solid: n / (L1 * L2), touches: x0 === 0 || y0 === 0 || x1 === w - 1 || y1 === h - 1 });
    }
    return out;
  }
  const angDiff = (a, b) => { const d = Math.abs(a - b) % Math.PI; return d > Math.PI / 2 ? Math.PI - d : d; };

  /** Boyutları (ve uzunsa yönleri) benzer dolu lekeleri kümeler: zamanlama işaretleri hep aynı boyuttadır. */
  function sizeClusters(cands) {
    const near = (a, b) => { const ra = a.L1 / a.L2, rb = b.L1 / b.L2; return Math.abs(a.L1 - b.L1) <= 0.25 * a.L1 + 1.5 && Math.abs(a.L2 - b.L2) <= 0.3 * a.L2 + 1.2 && Math.max(ra, rb) / Math.min(ra, rb) < 1.6 && (ra < 1.6 || rb < 1.6 || angDiff(a.ang, b.ang) < 0.35); };   // çubuk (uzun) ile dolu baloncuk (yuvarlak) aynı kümeye girmesin: işaretli formda çubukların yarısı baloncuk kümesine kayıyordu
    const use = cands.length > 2500 ? cands.filter((_, i) => i % Math.ceil(cands.length / 2500) === 0) : cands, mem = use.map(a => use.filter(b => near(a, b)));
    const order = use.map((_, i) => i).sort((i, j) => mem[j].length - mem[i].length), taken = new Set(), clusters = [];
    for (const i of order) {
      if (taken.has(use[i]) || mem[i].length < 12) continue;
      const m = mem[i].filter(b => !taken.has(b)); if (m.length < 12) continue;
      const ref = { L1: median(m.map(b => b.L1)), L2: median(m.map(b => b.L2)), ang: 0.5 * Math.atan2(mean(m.map(b => Math.sin(2 * b.ang))), mean(m.map(b => Math.cos(2 * b.ang)))) }, full = cands.filter(b => near(ref, b) && !taken.has(b));   // seyreltme yapıldıysa kümeyi tüm adaylarla tamamla
      full.forEach(b => taken.add(b)); clusters.push(full); if (clusters.length >= 3) break;
    }
    return clusters;
  }

  /** Noktalar içinden doğrusal dizileri (iz) çıkarır: Hough oylaması + en küçük kareler. Dönüş: [{ pts, dir, nrm, rho, lo, hi, len }] */
  function houghTracks(pts, tol, minCount, maxTracks) {
    const NA = 720, cosA = new Float64Array(NA), sinA = new Float64Array(NA); for (let a = 0; a < NA; a++) { const t = a * Math.PI / NA; cosA[a] = Math.cos(t); sinA[a] = Math.sin(t); }
    let diag = 0; pts.forEach(p => { diag = Math.max(diag, Math.hypot(p.cx, p.cy)); }); diag = Math.ceil(diag) + 2;
    const bw = Math.max(2, tol), nb = Math.ceil(2 * diag / bw) + 3, tracks = []; let rem = pts.slice();
    while (rem.length >= minCount && tracks.length < maxTracks) {
      const acc = new Uint16Array(NA * nb);
      for (const p of rem) for (let a = 0; a < NA; a++) acc[a * nb + Math.floor((p.cx * cosA[a] + p.cy * sinA[a] + diag) / bw)]++;
      let best = 0, ba = -1, bi = -1;
      for (let a = 0; a < NA; a++) for (let i = 0; i < nb - 1; i++) { const v = acc[a * nb + i] + acc[a * nb + i + 1]; if (v > best) { best = v; ba = a; bi = i; } }
      if (best < minCount) break;
      let nx = cosA[ba], ny = sinA[ba], rho = (bi + 1) * bw - diag, th = 0, inl = [];
      for (let it = 0; it < 5; it++) {   // oy kutusu açısal olarak kaba: önce geniş kabul bandı (uzun izin iki ucu da girsin), sonra daralt; her turda ana eksene (PCA) yeniden oturt
        const T = tol * [2.6, 1.9, 1.4, 1.1, 1][it]; inl = rem.filter(p => Math.abs(p.cx * nx + p.cy * ny - rho) <= T); if (inl.length < 3) break;
        const mx = mean(inl.map(p => p.cx)), my = mean(inl.map(p => p.cy)); let sxx = 0, syy = 0, sxy = 0; inl.forEach(p => { const dx = p.cx - mx, dy = p.cy - my; sxx += dx * dx; syy += dy * dy; sxy += dx * dy; });
        th = 0.5 * Math.atan2(2 * sxy, sxx - syy); nx = -Math.sin(th); ny = Math.cos(th); rho = mx * nx + my * ny;
      }
      inl = rem.filter(p => Math.abs(p.cx * nx + p.cy * ny - rho) <= tol); if (inl.length < minCount) break;
      const dir = [Math.cos(th), Math.sin(th)], pr = inl.map(p => p.cx * dir[0] + p.cy * dir[1]), lo = Math.min(...pr), hi = Math.max(...pr);
      tracks.push({ pts: inl, dir, nrm: [nx, ny], rho, lo, hi, len: hi - lo, cx: mean(inl.map(p => p.cx)), cy: mean(inl.map(p => p.cy)) });
      const set = new Set(inl); rem = rem.filter(p => !set.has(p));
    }
    return tracks;
  }

  /** İki iz içinden formun iki yan çizgi dizisini seçer: yaklaşık paralel, uzun, aralarında form genişliği kadar uzaklık, boyuna örtüşen, benzer sayıda işaretli. */
  function pickTrackPair(tracks, maxDim, ink) {
    let best = null;
    for (let i = 0; i < tracks.length; i++) for (let j = i + 1; j < tracks.length; j++) {
      const a = tracks[i], b = tracks[j];
      if (angDiff(Math.atan2(a.dir[1], a.dir[0]), Math.atan2(b.dir[1], b.dir[0])) > 0.2) continue;   // ≈ 11°: perspektifte iki kenar tam paralel görünmez
      const shorter = Math.min(a.len, b.len); if (shorter < 0.3 * maxDim) continue;
      const sep = Math.abs((b.cx - a.cx) * a.nrm[0] + (b.cy - a.cy) * a.nrm[1]); if (sep < 0.3 * shorter) continue;
      if (ink && ink.length > 20) {   // gerçek yan çizgiler sayfanın dış kenarındadır: iki iz, mürekkebin (yan yönde) kapladığı genişliğin çoğunu kapsamalı (içteki işaretli baloncuk sütunları değil)
        const pn = ink.map(p => p.cx * a.nrm[0] + p.cy * a.nrm[1]).sort((x, y) => x - y), ext = pn[Math.floor(pn.length * 0.99)] - pn[Math.floor(pn.length * 0.01)];
        if (sep < 0.6 * ext) continue;
      }
      const pa = a.pts.map(p => p.cx * a.dir[0] + p.cy * a.dir[1]), pb = b.pts.map(p => p.cx * a.dir[0] + p.cy * a.dir[1]);
      const lo = Math.max(Math.min(...pa), Math.min(...pb)), hi = Math.min(Math.max(...pa), Math.max(...pb)), ov = (hi - lo) / Math.min(a.len, b.len); if (ov < 0.6) continue;
      const cr = Math.min(a.pts.length, b.pts.length) / Math.max(a.pts.length, b.pts.length); if (cr < 0.5) continue;
      const score = (a.pts.length + b.pts.length) * Math.min(1, ov) * Math.min(1, sep / (0.6 * shorter)) * (0.5 + 0.5 * cr);
      if (!best || score > best.score) best = { score, a, b };
    }
    return best;
  }

  /** Tam çözünürlükte çizgi işaretinin merkezini alt-piksel doğrulukla bulur (koyuluk ağırlıklı). */
  function refineBar(g, w, h, ex, ey, L1, L2) {
    const half = Math.ceil(L1 * 0.8 + 4), x0 = Math.max(0, Math.round(ex) - half), y0 = Math.max(0, Math.round(ey) - half), x1 = Math.min(w, Math.round(ex) + half + 1), y1 = Math.min(h, Math.round(ey) + half + 1), ww = x1 - x0, hh = y1 - y0;
    if (ww < 6 || hh < 6) return null;
    const vals = new Uint8Array(ww * hh); for (let y = 0; y < hh; y++) for (let x = 0; x < ww; x++) vals[y * ww + x] = g[(y0 + y) * w + x0 + x];
    const lo = OMR.percentile(vals, 0.04), hi = OMR.percentile(vals, 0.9); if (hi - lo < 45) return null;
    const th = (lo + hi) / 2, bin = new Uint8Array(ww * hh); for (let i = 0; i < bin.length; i++) bin[i] = vals[i] < th ? 1 : 0;
    const A = L1 * L2, bl = OMR.findBlobs(bin, ww, hh, A * 0.35, A * 3); let best = null, bd = 1e9;
    bl.forEach(b => { const d = Math.hypot(b.cx + x0 - ex, b.cy + y0 - ey); if (d < bd) { bd = d; best = b; } });
    if (!best || bd > L1 * 0.6) return null;
    const bx0 = Math.max(0, Math.floor(best.cx - best.bw / 2 - 2)), bx1 = Math.min(ww - 1, Math.ceil(best.cx + best.bw / 2 + 2)), by0 = Math.max(0, Math.floor(best.cy - best.bh / 2 - 2)), by1 = Math.min(hh - 1, Math.ceil(best.cy + best.bh / 2 + 2));
    let s = 0, sx = 0, sy = 0;
    for (let y = by0; y <= by1; y++) for (let x = bx0; x <= bx1; x++) { const wgt = Math.min(1, Math.max(0, (hi - vals[y * ww + x]) / (hi - lo))); s += wgt; sx += wgt * x; sy += wgt * y; }
    return s > 0 ? [x0 + sx / s, y0 + sy / s] : [x0 + best.cx, y0 + best.cy];
  }

  const SIDE_MSG = 'Formda yan çizgiler (sol ve sağ kenardaki kısa siyah zamanlama işaretleri) bulunamadı. Çizgilerin her iki kenarda da, tam sayfa görünür, net ve düz olması gerekir.';
  /** Sol-sağ (ya da üst-alt) iki yan çizgi dizisini bulur. Dönüş: { ok, kind:'sides', corners (uç işaretler; sol-üstten saat yönü), marks (bütün işaretler, görüntü pikseli), size, markDims, tracks:[n1,n2] } */
  /** Yan çizgi / tek iz aramasının ortak hazırlığı: küçültülmüş görüntüde dolu çubuk adayları, boyut kümeleri ve Hough izleri (aynı görüntü için bir kez). */
  function sidePrep(img, opts) {
    opts = opts || {}; const memo = !opts.workDim, hit = memo ? MEMO.p.get(img) : undefined; if (hit !== undefined) return hit;
    const g = img.gray, w = img.w, h = img.h, f = Math.max(1, Math.ceil(Math.max(w, h) / (opts.workDim || 1600)));
    const work = f === 1 ? g : OMR.boxDown(g, w, h, f), W = Math.floor(w / f), H = Math.floor(h / f), maxDim = Math.max(W, H);
    const all = blobStats(OMR.adaptiveBinary(work, W, H), W, H, 8, (maxDim * 0.06) ** 2);
    const cands = all.filter(b => !b.touches && b.solid >= 0.8 && b.solid <= 1.25 && b.L2 >= 2.2 && b.L1 <= maxDim * 0.06 && b.L1 / b.L2 <= 16);
    let r = null;
    if (cands.length >= 16) {
      const tracks = [];
      sizeClusters(cands).forEach(cl => { const mL2 = median(cl.map(b => b.L2)), tol = Math.min(9, Math.max(3, 0.9 * mL2)); houghTracks(cl, tol, 10, 4).forEach(t => tracks.push(t)); });
      r = { g, w, h, f, W, H, maxDim, all, tracks };
    }
    if (memo) MEMO.p.set(img, r); return r;
  }
  /** Tam çözünürlükte işaret merkezini inceltir. */
  const refineMarkAt = (P, p) => { const c = [p.cx * P.f + (P.f - 1) / 2, p.cy * P.f + (P.f - 1) / 2]; return refineBar(P.g, P.w, P.h, c[0], c[1], p.L1 * P.f, p.L2 * P.f) || c; };

  function findSideMarks(img, opts) {
    const P = sidePrep(img, opts), fail = msg => ({ ok: false, kind: 'sides', error: msg || SIDE_MSG });
    if (!P) return fail();
    const g = P.g, w = P.w, h = P.h, f = P.f, maxDim = P.maxDim, all = P.all, tracks = P.tracks;
    const pr = pickTrackPair(tracks, maxDim, all.filter(b => !b.touches)); if (!pr) return fail();
    const dir = pr.a.dir, proj = p => p.cx * dir[0] + p.cy * dir[1], sa = pr.a.pts.slice().sort((p, q) => proj(p) - proj(q)), sb = pr.b.pts.slice().sort((p, q) => proj(p) - proj(q));
    const refine = p => refineMarkAt(P, p);
    const ra = sa.map(refine), rb = sb.map(refine), corners = OMR.sortClockwiseFromTL([ra[0], rb[0], rb[rb.length - 1], ra[ra.length - 1]]);
    const L1 = median(sa.concat(sb).map(p => p.L1)) * f, L2 = median(sa.concat(sb).map(p => p.L2)) * f;
    return { ok: true, kind: 'sides', corners, marks: ra.concat(rb), size: Math.max(L1, L2), markDims: { L1, L2 }, tracks: [ra.length, rb.length], strong: true };
  }

  /** Normalleştirilmiş en küçük kareler homografisi (n ≥ 4 nokta çifti): src → dst. */
  function homographyLS(src, dst) {
    const n = src.length; if (n < 4) return null;
    const nrm = P => { const cx = mean(P.map(p => p[0])), cy = mean(P.map(p => p[1])), md = mean(P.map(p => Math.hypot(p[0] - cx, p[1] - cy))) || 1, s = Math.SQRT2 / md; return { cx, cy, s, Q: P.map(p => [(p[0] - cx) * s, (p[1] - cy) * s]) }; };
    const a = nrm(src), b = nrm(dst), N = Array.from({ length: 8 }, () => new Array(9).fill(0));
    for (let i = 0; i < n; i++) {
      const [x, y] = a.Q[i], [u, v] = b.Q[i];
      for (const [r, rhs] of [[[x, y, 1, 0, 0, 0, -u * x, -u * y], u], [[0, 0, 0, x, y, 1, -v * x, -v * y], v]]) for (let j = 0; j < 8; j++) { for (let k = 0; k < 8; k++) N[j][k] += r[j] * r[k]; N[j][8] += r[j] * rhs; }
    }
    for (let c = 0; c < 8; c++) {   // Gauss yok etme (kısmi eksen seçimi)
      let m = c; for (let r = c + 1; r < 8; r++) if (Math.abs(N[r][c]) > Math.abs(N[m][c])) m = r;
      if (Math.abs(N[m][c]) < 1e-12) return null; [N[c], N[m]] = [N[m], N[c]];
      for (let r = c + 1; r < 8; r++) { const q = N[r][c] / N[c][c]; for (let k = c; k < 9; k++) N[r][k] -= q * N[c][k]; }
    }
    const x = new Array(8); for (let i = 7; i >= 0; i--) { let s = N[i][8]; for (let j = i + 1; j < 8; j++) s -= N[i][j] * x[j]; x[i] = s / N[i][i]; }
    const Hn = [x[0], x[1], x[2], x[3], x[4], x[5], x[6], x[7], 1];
    // H = T2⁻¹ · Hn · T1
    const T1 = [a.s, 0, -a.s * a.cx, 0, a.s, -a.s * a.cy, 0, 0, 1], T2i = [1 / b.s, 0, b.cx, 0, 1 / b.s, b.cy, 0, 0, 1];
    const mul = (A, B) => { const C = new Array(9).fill(0); for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) C[i * 3 + j] += A[i * 3 + k] * B[k * 3 + j]; return C; };
    const H = mul(T2i, mul(Hn, T1)); return H.map(v => v / H[8]);
  }

  /** Yan çizgi şablonunda okuma öncesi inceltme: ilk homografiye (uç işaretlerden) göre şablondaki her işareti görüntüdeki işaretle eşler, hepsiyle yeniden uydurur.
   *  Dönüş: { H, n, rms } ya da null (eşleşme yetersiz). sc: görüntü pikseli / çerçeve pikseli. */
  function refineByMarks(tpl, marks, H0, sc) {
    const tm = tpl.marks; if (!tm || tm.length < 8 || !marks || marks.length < 8 || !H0) return null;
    const tol = 0.4 * (tpl.markPitch || 20) * sc; let H = H0, pairs = [];
    for (let it = 0; it < 3; it++) {
      const cand = []; tm.forEach((m, i) => { const p = OMR.applyH(H, m[0], m[1]); marks.forEach((q, j) => { const d = Math.hypot(q[0] - p[0], q[1] - p[1]); if (d <= tol) cand.push([d, i, j]); }); });
      cand.sort((x, y) => x[0] - y[0]); const ui = new Set(), uj = new Set(); pairs = [];
      cand.forEach(([d, i, j]) => { if (!ui.has(i) && !uj.has(j)) { ui.add(i); uj.add(j); pairs.push([i, j, d]); } });
      if (pairs.length < 8) return null;
      const med = median(pairs.map(p => p[2])), keep = pairs.filter(p => p[2] <= Math.max(2.5, 3 * med)); if (keep.length < 8) return null;
      const Hn = homographyLS(keep.map(p => tm[p[0]]), keep.map(p => marks[p[1]])); if (!Hn) return null; H = Hn; pairs = keep;
    }
    const res = pairs.map(p => { const q = OMR.applyH(H, tm[p[0]][0], tm[p[0]][1]), m = marks[p[1]]; return Math.hypot(q[0] - m[0], q[1] - m[1]); });
    return { H, n: pairs.length, rms: Math.sqrt(mean(res.map(v => v * v))) };
  }

  /* ------------------------------------------------------------------ TEK yan çizgi (yalnızca bir kenarda zamanlama izi olan formlar) */
  /*  Tek iz çerçeveyi (perspektifi) belirlemez: yalnızca satır konumlarını, yönü ve ölçeği verir. Sayfanın içi bir "benzerlik dönüşümü" ile tahmin edilir;   */
  /*  sonra baloncukların kendisi (şablondaki merkezlerle eşleşerek) önce afin, sonra homografi olarak uydurulur. Düz tarama / hafif eğik fotoğrafta çalışır. */
  const TRACK_MSG = 'Formda tek yan çizgi (kenardaki kısa siyah zamanlama işaretleri) bulunamadı. İşaretlerin sütunu, sayfanın en dış kenarında, net ve tam görünür olmalı.';

  /** Tek iz adayı: uzun, düzenli aralıklı, tüm mürekkebin yalnız bir yanında (sayfanın dış kenarı) olan dizi. Dönüş: { t, side, ext, pitch, score } ya da null */
  function pickSingleTrack(P) {
    const ink = P.all.filter(b => !b.touches); let best = null;
    P.tracks.forEach(t => {
      if (t.pts.length < 12 || t.len < 0.35 * P.maxDim) return;
      const dir = t.dir, pr = t.pts.map(p => p.cx * dir[0] + p.cy * dir[1]).sort((a, b) => a - b), gaps = []; for (let i = 1; i < pr.length; i++) gaps.push(pr[i] - pr[i - 1]);
      const pitch = median(gaps); if (!(pitch > 2)) return;
      const reg = gaps.filter(g => (g > 0.72 * pitch && g < 1.3 * pitch) || (g > 1.72 * pitch && g < 2.3 * pitch)).length / gaps.length; if (reg < 0.8) return;
      const tol = Math.max(4, 2.5 * median(t.pts.map(p => p.L2))); let pos = 0, neg = 0;
      ink.forEach(b => { const d = (b.cx - t.cx) * t.nrm[0] + (b.cy - t.cy) * t.nrm[1]; if (Math.abs(d) <= tol) return; if (d > 0) pos++; else neg++; });
      const major = Math.max(pos, neg), minor = Math.min(pos, neg); if (major < 60 || minor > 0.02 * (major + minor) + 2) return;   // iz dış kenarda olmalı
      const side = pos >= neg ? 1 : -1, dd = []; ink.forEach(b => { const d = side * ((b.cx - t.cx) * t.nrm[0] + (b.cy - t.cy) * t.nrm[1]); if (d > tol) dd.push(d + 0.5 * b.L1); });
      dd.sort((a, b) => a - b); const ext = dd[Math.floor(0.995 * (dd.length - 1))]; if (!(ext >= 0.25 * t.len)) return;
      const score = t.pts.length * reg * Math.min(1, t.len / (0.8 * P.maxDim)); if (!best || score > best.score) best = { t, side, ext, pitch, score };
    });
    return best;
  }

  /** Tek yan çizgi dizisini bulur. Dönüş: findSideMarks ile aynı biçim (kind:'track'); corners = iz + içe doğru tahmini genişlikle kurulan dikdörtgen, tracks:[n]. */
  function findTrack(img, opts) {
    const P = sidePrep(img, opts), fail = msg => ({ ok: false, kind: 'track', error: msg || TRACK_MSG }); if (!P) return fail();
    const pk = pickSingleTrack(P); if (!pk) return fail();
    const t = pk.t, dir = t.dir, proj = p => p.cx * dir[0] + p.cy * dir[1], rs = t.pts.slice().sort((p, q) => proj(p) - proj(q)).map(p => refineMarkAt(P, p));
    const n = [pk.side * t.nrm[0], pk.side * t.nrm[1]], E1 = rs[0], E2 = rs[rs.length - 1], W = pk.ext * P.f;
    const corners = OMR.sortClockwiseFromTL([E1, E2, [E2[0] + n[0] * W, E2[1] + n[1] * W], [E1[0] + n[0] * W, E1[1] + n[1] * W]]);
    const L1 = median(t.pts.map(p => p.L1)) * P.f, L2 = median(t.pts.map(p => p.L2)) * P.f;
    return { ok: true, kind: 'track', single: true, corners, marks: rs, size: Math.max(L1, L2), markDims: { L1, L2 }, tracks: [rs.length], strong: true, pitch: pk.pitch * P.f };
  }

  /** (p0,p1) → (q0,q1) eşleyen benzerlik dönüşümü (döndürme + ölçek + öteleme; ayna yok), 3×3 homografi biçiminde. */
  function similarity(p0, p1, q0, q1) {
    const sc = dist(q0, q1) / (dist(p0, p1) || 1), th = Math.atan2(q1[1] - q0[1], q1[0] - q0[0]) - Math.atan2(p1[1] - p0[1], p1[0] - p0[0]), c = sc * Math.cos(th), sn = sc * Math.sin(th);
    return [c, -sn, q0[0] - (c * p0[0] - sn * p0[1]), sn, c, q0[1] - (sn * p0[0] + c * p0[1]), 0, 0, 1];
  }
  /** En küçük kareler afin dönüşümü (n ≥ 3, doğrusal olmayan noktalar): src → dst, 3×3 biçiminde. */
  function affineLS(src, dst) {
    const n = src.length; if (n < 3) return null; let sxx = 0, sxy = 0, sx = 0, syy = 0, sy = 0; const bx = [0, 0, 0], by = [0, 0, 0];
    for (let i = 0; i < n; i++) { const [x, y] = src[i], [u, v] = dst[i]; sxx += x * x; sxy += x * y; sx += x; syy += y * y; sy += y; bx[0] += x * u; bx[1] += y * u; bx[2] += u; by[0] += x * v; by[1] += y * v; by[2] += v; }
    const M = [[sxx, sxy, sx], [sxy, syy, sy], [sx, sy, n]], solve = b => {
      const A = M.map((r, i) => r.concat(b[i])); for (let c = 0; c < 3; c++) { let m = c; for (let r = c + 1; r < 3; r++) if (Math.abs(A[r][c]) > Math.abs(A[m][c])) m = r; if (Math.abs(A[m][c]) < 1e-9) return null; [A[c], A[m]] = [A[m], A[c]]; for (let r = c + 1; r < 3; r++) { const q = A[r][c] / A[c][c]; for (let k = c; k < 4; k++) A[r][k] -= q * A[c][k]; } }
      const x = [0, 0, 0]; for (let i = 2; i >= 0; i--) { let t = A[i][3]; for (let j = i + 1; j < 3; j++) t -= A[i][j] * x[j]; x[i] = t / A[i][i]; } return x;
    };
    const a = solve(bx), b = solve(by); return a && b ? [a[0], a[1], a[2], b[0], b[1], b[2], 0, 0, 1] : null;
  }

  /** Şablondaki zamanlama işaretlerini görüntüdeki işaretlerle SIRA düzeyinde eşler: uçlarda ≤2 eksik ya da fazla işarete ve iki yöne (ters/düz) izin verir.
   *  Her varsayım (görüntünün ilk/son işareti şablonun hangi işaretine denk) çizgi boyunca 1B bir ölçek+öteleme verir; öngörülen konuma ≤ 0.3 aralık yakın olanlar eşlenir. En çok eşleşen kazanır.
   *  Dönüş (yön başına en iyi): [{ rev, pairs: [[şablonİşaretXY, görüntüİşaretXY]], count }] */
  function alignMarks(tm, im) {
    const nt = tm.length, ni = im.length, t0 = tm[0], ux = tm[nt - 1][0] - t0[0], uy = tm[nt - 1][1] - t0[1], ul = Math.hypot(ux, uy) || 1, tau = tm.map(m => ((m[0] - t0[0]) * ux + (m[1] - t0[1]) * uy) / ul), pT = ul / Math.max(1, nt - 1);
    const tauAt = k => k < 0 ? tau[0] + k * pT : k >= nt ? tau[nt - 1] + (k - nt + 1) * pT : tau[k], out = [];
    [false, true].forEach(rev => {
      const q = rev ? im.slice().reverse() : im, q0 = q[0], vx = q[ni - 1][0] - q0[0], vy = q[ni - 1][1] - q0[1], vl = Math.hypot(vx, vy) || 1, sig = q.map(p => ((p[0] - q0[0]) * vx + (p[1] - q0[1]) * vy) / vl);
      let best = null;
      for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) {
        const dT = tauAt(nt - 1 - b) - tauAt(a); if (!(dT > 0)) continue;
        const al = (sig[ni - 1] - sig[0]) / dT; if (al < 0.2 || al > 5) continue;
        const match = (al, be, tolF) => { const tol = tolF * pT * al, pairs = []; let j0 = 0;
          for (let i = 0; i < nt; i++) { const pr = al * tau[i] + be; let bj = -1, bd = tol; for (let j = j0; j < ni; j++) { const d = Math.abs(sig[j] - pr); if (d < bd) { bd = d; bj = j; } if (sig[j] - pr > tol) break; } if (bj >= 0) { pairs.push([i, bj]); j0 = bj + 1; } }
          return pairs; };
        let pairs = match(al, sig[0] - al * tauAt(a), 0.3); if (pairs.length < 8) continue;
        // 5'li grup boşlukları gibi ince imza ancak dar kabul bandında ayrışır: ölçek+ötelemeyi eşleşmelerden yeniden uydur, dar bantla yeniden eşle
        const mt = mean(pairs.map(p => tau[p[0]])), ms = mean(pairs.map(p => sig[p[1]])); let sxx = 0, sxy = 0; pairs.forEach(p => { sxx += (tau[p[0]] - mt) ** 2; sxy += (tau[p[0]] - mt) * (sig[p[1]] - ms); });
        const al2 = sxx > 0 ? sxy / sxx : al, be2 = ms - al2 * mt; pairs = match(al2, be2, 0.15);
        const score = pairs.length - 0.01 * (Math.abs(a) + Math.abs(b)); if (!best || score > best.score) best = { score, pairs };
      }
      if (best && best.pairs.length >= 8) out.push({ rev, count: best.pairs.length, pairs: best.pairs.map(([i, j]) => [tm[i], rev ? im[ni - 1 - j] : im[j]]) });
    });
    return out;
  }

  /** Şablondaki baloncuk merkezlerini görüntüdeki baloncuklarla eşleyip dönüşümü (frame → görüntü) inceltir.
   *  İz çizgisine yakın bölgeden başlayıp (benzerlik dönüşümü orada en doğru) bant bant dışa doğru genişler; önce afin, sonra homografi. Zamanlama işaretleri her turda ek (ağırlıklı) eşleşme olarak katılır:
   *  baloncuk ızgarası kendine benzediği için tek başına "bir sıra/sütun kaymış" çözüme kilitlenebilir; işaretler satır kaydırmasını engeller.
   *  Dönüş: { H, n, rms } ya da null (yeterli eşleşme yok). */
  function refineByBubbles(img, tpl, H0, s, markPairs) {
    const exp = tpl.bsz ? { w: tpl.bsz.w * s, h: tpl.bsz.h * s } : { w: 2 * tpl.r * s, h: 2 * tpl.r * s }, tm = tpl.marks || [], t0 = tm[0], t1 = tm[tm.length - 1];
    const ux = t1[0] - t0[0], uy = t1[1] - t0[1], ul = Math.hypot(ux, uy) || 1, pts = []; let D = 1;
    tpl.groups.forEach(g => g.ys.forEach(y => g.xs.forEach(x => { const d = Math.abs((x - t0[0]) * uy - (y - t0[1]) * ux) / ul; D = Math.max(D, d); pts.push([x, y, d]); })));
    const cell = Math.max(exp.w, exp.h), key = (x, y) => Math.floor(x / cell) + ',' + Math.floor(y / cell);
    const SCHED = [[0.3, 1, 0.5], [0.55, 1, 0.5], [0.8, 1, 0.45], [1.01, 0, 0.45], [1.01, 0, 0.4], [1.01, 0, 0.4]];   // [bant, afin?, kabul (baloncuk boyutu oranı)]
    let H = H0, last = null;
    for (let it = 0; it < SCHED.length; it++) {
      const [band, aff, tl] = SCHED[it], rec = OMR.rectify(img, H, tpl.frame, s), det = detectBubbles(rec.gray, rec.w, rec.h, { expect: exp, level: 2 }); if (!det.list || det.list.length < 30) return last;
      const grid = new Map(); det.list.forEach(b => { const k = key(b.cx, b.cy); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(b); });
      const tol = tl * Math.min(exp.w, exp.h), cand = [];
      pts.forEach((pt, i) => { if (pt[2] > band * D) return; const px = pt[0] * s, py = pt[1] * s, cx = Math.floor(px / cell), cy = Math.floor(py / cell);
        for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) (grid.get((cx + a) + ',' + (cy + b)) || []).forEach(q => { const d = Math.hypot(q.cx - px, q.cy - py); if (d <= tol) cand.push([d, i, q]); }); });
      cand.sort((a, b) => a[0] - b[0]); const ui = new Set(), uq = new Set(), src = [], dst = [];
      cand.forEach(([d, i, q]) => { if (ui.has(i) || uq.has(q)) return; ui.add(i); uq.add(q); src.push(pts[i]); dst.push(OMR.applyH(H, q.cx / s, q.cy / s)); });
      const nb = src.length; if (nb < 20) return last;
      let nm = 0;   // zamanlama işaretleri: sıra düzeyinde kesin eşleşmiş çiftler her turda katılır (iki kat ağırlık); satır kaymasını engeller
      (markPairs || []).forEach(([m, q]) => { for (let k = 0; k < 2; k++) { src.push(m); dst.push(q); } nm++; });
      const fitf = (S, Dd) => aff ? affineLS(S, Dd) : homographyLS(S, Dd);
      let Hn = fitf(src, dst); if (!Hn) return last;
      const res = src.map((p, i) => { const q = OMR.applyH(Hn, p[0], p[1]); return Math.hypot(q[0] - dst[i][0], q[1] - dst[i][1]); }), md = median(res), thr = Math.max(1.5, 3 * md), keep = src.map((_, i) => i).filter(i => res[i] <= thr);
      if (keep.length >= 20 && keep.length < src.length) { const H2 = fitf(keep.map(i => src[i]), keep.map(i => dst[i])); if (H2) Hn = H2; }
      H = Hn; const fin = keep.map(i => { const q = OMR.applyH(H, src[i][0], src[i][1]); return Math.hypot(q[0] - dst[i][0], q[1] - dst[i][1]); });
      last = { H, n: nb, nMarks: nm, rms: Math.sqrt(mean(fin.map(v => v * v))) };
    }
    return last;
  }

  /** Tek yan çizgili şablon için yerleştirme: işaretler sıra düzeyinde eşlenir (iki yön), uçlardaki eşleşmiş işaretlerden benzerlik dönüşümü kurulur, sonra baloncuklarla inceltilir. */
  function fitTrack(img, tpl, opts) {
    opts = opts || {}; const A = opts.anchors || trackOf(img); if (!A.ok) return { ok: false, score: 0, error: A.error };
    const tm = tpl.marks; if (!tm || tm.length < 8) return { ok: false, score: 0, error: 'Şablonda yan çizgi bilgisi yok.' };
    const s = Math.min(1, 1500 / Math.max(tpl.frame.w, tpl.frame.h)), al = alignMarks(tm, A.marks); if (!al.length) return { ok: false, score: 0, error: 'Yan çizgi işaretleri şablonla eşleşmiyor (sıra/aralık uymuyor).' };
    const cand = al.map(c => { const pr = c.pairs, H = similarity(pr[0][0], pr[pr.length - 1][0], pr[0][1], pr[pr.length - 1][1]); return { c, H, m: matchScore(OMR.rectify(img, H, tpl.frame, s), tpl, s) }; }).sort((a, b) => b.m.score - a.m.score);
    let best = null;
    for (const k of cand) {
      const rf = refineByBubbles(img, tpl, k.H, s, k.c.pairs), H = rf ? rf.H : k.H, m = rf ? matchScore(OMR.rectify(img, H, tpl.frame, s), tpl, s) : k.m;
      if (!best || m.score > best.score) best = Object.assign(m, { H, rf, pairs: k.c.pairs.length });
      if (m.score >= 0.85) break;
    }
    const H = best.H, corners = tpl.anchors.map(a => OMR.applyH(H, a[0], a[1])), ang = Math.atan2(H[3], H[0]), rot = ((Math.round(ang / (Math.PI / 2)) % 4) + 4) % 4;
    const out = Object.assign({}, best, { rot, corners, marksUsed: best.pairs, markRms: best.rf ? r2(best.rf.rms) : 0, tracks: A.tracks.slice(), markFit: best.pairs / tm.length, trackMismatch: !tpl.tracks || A.tracks[0] !== tpl.tracks[0], expectTracks: tpl.tracks ? tpl.tracks.slice() : null, bubblesUsed: best.rf ? best.rf.n : 0 });
    delete out.H; delete out.rf; delete out.pairs; return Object.assign({ ok: true }, out);
  }

  const MEMO = { c: new WeakMap(), s: new WeakMap(), p: new WeakMap(), t: new WeakMap() };   // aynı görüntü için köşe / yan çizgi aramasını bir kez yap
  const cornersOf = img => { let r = MEMO.c.get(img); if (!r) { r = findAnchors(img); MEMO.c.set(img, r); } return r; };
  const sidesOf = img => { let r = MEMO.s.get(img); if (!r) { r = findSideMarks(img); MEMO.s.set(img, r); } return r; };
  const trackOf = img => { let r = MEMO.t.get(img); if (!r) { r = findTrack(img); MEMO.t.set(img, r); } return r; };

  /** Halka testi: lekenin sınır kutusuna oturan elips üzerinde mürekkep kapalı bir çember oluşturuyor mu? (baloncuk: evet; başlıktaki büyük harfler: hayır) */
  function ringCover(bin, w, h, b) {
    const rx = b.bw / 2, ry = b.bh / 2, d = Math.max(1.5, 0.09 * Math.min(b.bw, b.bh)), N = 24; let hit = 0;
    for (let k = 0; k < N; k++) {
      const t = 2 * Math.PI * k / N, c = Math.cos(t), s = Math.sin(t); let on = false;
      for (let o = -1; o <= 1 && !on; o++) { const x = Math.round(b.cx + (rx * 0.9 + o * d) * c), y = Math.round(b.cy + (ry * 0.9 + o * d) * s); if (x >= 0 && y >= 0 && x < w && y < h && bin[y * w + x]) on = true; }
      if (on) hit++;
    }
    return hit / N;
  }

  /* ------------------------------------------------------------------ baloncuk bulma */
  /** Adaylar içinde sayıca baskın boyut kümesi (aynı sayıdaysa en büyük: baloncuğun içindeki harf daha küçüktür). */
  function dominantSize(cand) {
    const use = cand.length > 4000 ? cand.filter((_, i) => i % Math.ceil(cand.length / 4000) === 0) : cand, cnt = new Array(use.length).fill(0);
    const near = (a, b) => Math.abs(a.bw - b.bw) <= 0.14 * a.bw + 1.5 && Math.abs(a.bh - b.bh) <= 0.14 * a.bh + 1.5;
    for (let i = 0; i < use.length; i++) for (let j = i; j < use.length; j++) if (near(use[i], use[j])) { cnt[i]++; if (j !== i) cnt[j]++; }
    const mx = Math.max(...cnt); let bi = -1;
    for (let i = 0; i < use.length; i++) if (cnt[i] >= mx * 0.8 && (bi < 0 || use[i].bw * use[i].bh > use[bi].bw * use[bi].bh)) bi = i;
    const ref = use[bi], mem = cand.filter(b => Math.abs(b.bw - ref.bw) <= 0.2 * ref.bw + 1 && Math.abs(b.bh - ref.bh) <= 0.2 * ref.bh + 1);
    return { list: mem, set: new Set(mem), bw: median(mem.map(b => b.bw)), bh: median(mem.map(b => b.bh)) };
  }
  /** Baloncuk boyut kipleri: önce baskın boyut, kalanlar içinde en çok 2 kip daha (en az 24 baloncuk). Her aday EN YAKIN kipe atanır (sınırda belirsizlik olmaz). Dönüş: [{ list, bw, bh }] (ilki baskın). */
  function sizeModes(cand) {
    const modes = []; let rest = cand;
    for (let k = 0; k < 3 && rest.length >= (k === 0 ? 6 : 24); k++) {
      const d = dominantSize(rest); if (k > 0 && d.list.length < 24) break;
      modes.push({ bw: d.bw, bh: d.bh }); rest = rest.filter(b => !(Math.abs(b.bw - d.bw) <= 0.14 * d.bw + 1.5 && Math.abs(b.bh - d.bh) <= 0.14 * d.bh + 1.5));
    }
    const lists = modes.map(() => []), dd = (v, m) => Math.max(0, Math.abs(v - m) - 1) / m;
    cand.forEach(b => { let bi = -1, bd = 1e9; modes.forEach((m, i) => { const d = Math.max(dd(b.bw, m.bw), dd(b.bh, m.bh)); if (d < bd) { bd = d; bi = i; } }); if (bd <= 0.2) lists[bi].push(b); });
    const out = modes.map((m, i) => ({ list: lists[i], bw: lists[i].length ? median(lists[i].map(b => b.bw)) : m.bw, bh: lists[i].length ? median(lists[i].map(b => b.bh)) : m.bh }));
    // ikincil kipler: baskın baloncuğa benzer boyutta (0.6–1.7 kat) ve baloncukların İÇİNDEKİ harf/rakam halkaları olmamalı
    const dom = out[0], keep = [dom], big = dom.list;
    for (let i = 1; i < out.length; i++) {
      const o = out[i], ratio = Math.sqrt((o.bw * o.bh) / (dom.bw * dom.bh)); if (ratio < 0.6 || ratio > 1.7) continue;
      const rad = 0.5 * Math.max(dom.bw, dom.bh), nested = o.list.filter(b => big.some(d => Math.abs(d.cx - b.cx) < rad && Math.abs(d.cy - b.cy) < rad)).length;
      if (nested > 0.3 * o.list.length) continue;
      keep.push(o);
    }
    return keep;
  }

  /** Düzeltilmiş çerçevede baskın boyutlu halka/dolu baloncukları bulur. opts.expect={w,h}: boyut biliniyorsa (eşleştirme) doğrudan kullanılır. */
  function detectBubbles(g, w, h, opts) {
    opts = opts || {};
    const maxDim = Math.max(w, h), exp = opts.expect || null;
    const minD = exp ? Math.max(4, Math.min(exp.w, exp.h) * 0.68) : Math.max(7, maxDim * 0.0045), maxD = exp ? Math.max(exp.w, exp.h) * 1.45 : maxDim * 0.05;
    const levels = opts.level != null ? [opts.level] : (exp ? [1] : [0, 1, 2]);
    let best = null;
    for (const lv of levels) {
      const bin = binarize(g, w, h, LEVELS[lv][0], LEVELS[lv][1]), blobs = OMR.findBlobs(bin, w, h, Math.max(6, minD * minD * 0.08), maxD * maxD);
      let cand = blobs.filter(b => !b.touches && b.bw >= minD && b.bh >= minD && b.bw <= maxD && b.bh <= maxD && b.bw / b.bh > 0.4 && b.bw / b.bh < 2.5 && b.fill > 0.1);
      cand = cand.filter(b => ringCover(bin, w, h, b) >= 0.75);
      if (opts.exclude) cand = cand.filter(b => !opts.exclude.some(e => Math.hypot(b.cx - e.x, b.cy - e.y) < e.r));
      let list, bw, bh, extra = [];
      if (exp) { list = cand.filter(b => Math.abs(b.bw - exp.w) <= exp.w * 0.32 && Math.abs(b.bh - exp.h) <= exp.h * 0.32); bw = exp.w; bh = exp.h; }
      else {
        if (cand.length < 6) { if (!best) best = { list: [], bw: 0, bh: 0, level: lv, total: 0 }; continue; }
        const modes = sizeModes(cand), d1 = modes[0]; list = d1.list; bw = d1.bw; bh = d1.bh;
        // ad-soyad harf ızgarası gibi alanlar cevap baloncuklarından küçük/büyük basılabilir: diğer boyut kipleri de ayrı blok kaynağı olur
        extra = modes.slice(1).map(m => ({ list: m.list.map(b => ({ cx: b.cx, cy: b.cy, bw: b.bw, bh: b.bh })), bw: m.bw, bh: m.bh }));
      }
      const r = { list: list.map(b => ({ cx: b.cx, cy: b.cy, bw: b.bw, bh: b.bh })), bw, bh, level: lv, extra };
      r.total = r.list.length + extra.reduce((t, e) => t + e.list.length, 0);
      if (!best || r.total > best.total * 1.02) best = r;
    }
    return best && best.list.length >= (exp ? 1 : 6) ? Object.assign({ ok: true }, best) : { ok: false, error: 'Formda baloncuk bulunamadı. Net, boş (işaretsiz) ve düz bir görüntü yükleyin.' };
  }

  /* ------------------------------------------------------------------ yapı çıkarma */
  function cluster1d(vals, tol) {
    const idx = vals.map((_, i) => i).sort((a, b) => vals[a] - vals[b]), cl = []; let cur = null;
    idx.forEach(i => { if (cur && vals[i] - cur.last <= tol) { cur.m.push(i); cur.last = vals[i]; } else { cur = { m: [i], last: vals[i] }; cl.push(cur); } });
    const as = new Array(vals.length); cl.forEach((c, k) => c.m.forEach(i => { as[i] = k; }));
    return { centers: cl.map(c => mean(c.m.map(i => vals[i]))), as };
  }

  /** Baloncukları komşuluk bağlarıyla bloklara (kafes) ayırır. Her bloğun kendi aralığı esas alınır; aralıktan belirgin büyük boşluk yeni bloktur. */
  function structure(list, bw, bh) {
    const n = list.length, P = list, ws = bw, hs = bh, tolY = 0.35 * hs, tolX = 0.35 * ws, INF = 1e9;
    const gapL = new Array(n).fill(INF), gapR = new Array(n).fill(INF), gapU = new Array(n).fill(INF), gapD = new Array(n).fill(INF), R = new Array(n).fill(-1), D = new Array(n).fill(-1);
    const byY = P.map((_, i) => i).sort((a, b) => P[a].cy - P[b].cy), byX = P.map((_, i) => i).sort((a, b) => P[a].cx - P[b].cx);
    for (let a = 0; a < n; a++) {   // aynı satırdaki en yakın sol/sağ komşu
      const i = byY[a];
      for (let b = a + 1; b < n && P[byY[b]].cy - P[i].cy <= tolY; b++) { const j = byY[b], dx = P[j].cx - P[i].cx; if (Math.abs(dx) < 0.6 * ws) continue; const [l, r] = dx > 0 ? [i, j] : [j, i], d = Math.abs(dx); if (d < gapR[l]) { gapR[l] = d; R[l] = r; } if (d < gapL[r]) gapL[r] = d; }
    }
    for (let a = 0; a < n; a++) {   // aynı sütundaki en yakın üst/alt komşu
      const i = byX[a];
      for (let b = a + 1; b < n && P[byX[b]].cx - P[i].cx <= tolX; b++) { const j = byX[b], dy = P[j].cy - P[i].cy; if (Math.abs(dy) < 0.6 * hs) continue; const [u, d0] = dy > 0 ? [i, j] : [j, i], d = Math.abs(dy); if (d < gapD[u]) { gapD[u] = d; D[u] = d0; } if (d < gapU[d0]) gapU[d0] = d; }
    }
    const par = P.map((_, i) => i), find = x => { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; }, uni = (a, b) => { a = find(a); b = find(b); if (a !== b) par[a] = b; };
    for (let i = 0; i < n; i++) {
      if (R[i] >= 0) { const j = R[i], ref = Math.min(gapL[i], gapR[j]), lim = ref < INF ? 1.6 * ref : 2.4 * ws; if (gapR[i] <= Math.min(lim, 5 * ws)) uni(i, j); }   // baloncuk dizisinde aralık baloncuk boyutunun birkaç katını aşmaz
      if (D[i] >= 0) { const j = D[i], ref = Math.min(gapU[i], gapD[j]), lim = ref < INF ? 1.75 * ref : 2.4 * hs; if (gapD[i] <= Math.min(lim, 5 * hs)) uni(i, j); }
    }
    const comp = new Map(); for (let i = 0; i < n; i++) { const k = find(i); if (!comp.has(k)) comp.set(k, []); comp.get(k).push(i); }
    const blocks = [];
    comp.forEach(mem => {
      if (mem.length < 2) return;
      const cx = cluster1d(mem.map(i => P[i].cx), tolX), cy = cluster1d(mem.map(i => P[i].cy), tolY), rows = cy.centers.length, cols = cx.centers.length;
      const occ = new Set(); mem.forEach((_, k) => occ.add(cy.as[k] * 1000 + cx.as[k]));
      if (mem.length < 3 && !(rows === 1 || cols === 1)) return;
      const xs = cx.centers.map((_, c) => mean(mem.filter((_, k) => cx.as[k] === c).map(i => P[i].cx))), ys = cy.centers.map((_, r) => mean(mem.filter((_, k) => cy.as[k] === r).map(i => P[i].cy)));
      const missing = []; for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (!occ.has(r * 1000 + c)) missing.push([r, c]);
      const cells = mem.map((i, k) => ({ r: cy.as[k], c: cx.as[k], cx: P[i].cx, cy: P[i].cy }));
      const cv = v => { if (v.length < 3) return 0; const d = v.slice(1).map((x, i) => x - v[i]), m = mean(d); return m > 0 ? Math.sqrt(mean(d.map(x => (x - m) * (x - m)))) / m : 0; };   // aralık düzensizliği (değişim katsayısı)
      blocks.push({ rows, cols, xs, ys, n: occ.size, fill: occ.size / (rows * cols), missing, x0: xs[0], x1: xs[cols - 1], y0: ys[0], y1: ys[rows - 1], cells, cvX: cv(xs), cvY: cv(ys) });
    });
    return { blocks: blocks.map(trimEdges), pitchX: median(gapR.filter(v => v < INF)), pitchY: median(gapD.filter(v => v < INF)) };
  }

  /** Bloğun kenarındaki neredeyse boş satır/sütunu (başlık yazısı, leke gibi yanlış pozitifler) budar: kenar doluluğu ≤ %34, gövde ≥ %75 ise kenar atılır. */
  function trimEdges(b) {
    for (let it = 0; it < 4; it++) {
      let cut = null;
      for (const dir of ['row', 'col']) {
        const n = dir === 'row' ? b.rows : b.cols, m = dir === 'row' ? b.cols : b.rows; if (n < 4) continue;
        const occ = new Array(n).fill(0); b.cells.forEach(c => { occ[dir === 'row' ? c.r : c.c]++; });
        const ratio = occ.map(v => v / m), body = median(ratio.slice(1, -1));
        if (body < 0.75) continue;
        if (ratio[0] <= 0.34) { cut = [dir, 1, n]; break; }
        if (ratio[n - 1] <= 0.34) { cut = [dir, 0, n - 1]; break; }
      }
      if (!cut) break;
      b = cutBlock(b, cut[0], cut[1], cut[2], '');
    }
    return b;
  }

  /** Baloncuğun içindeki harf/rakam deseni: rakam alanında AYNI SATIRDAKİ baloncuklar aynı rakamı, soru alanında AYNI SÜTUNDAKİLER aynı harfi taşır.
   *  Dönüş: 'digit' | 'letter' | '' (boş baloncuk / karar verilemedi). Okuma yapmaz; yalnızca iki deseni karşılaştırır. */
  function glyphStyle(g, w, h, b, bw, bh) {
    if (b.rows < 2 || b.cols < 2) return '';
    const S = 10, rx = 0.34 * bw, ry = 0.34 * bh, sig = new Map();
    const get = c => {
      const key = c.r * 1000 + c.c; if (sig.has(key)) return sig.get(key);
      const v = new Float32Array(S * S); let m = 0, m2 = 0;
      for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
        let s = 0; for (let q = 0; q < 2; q++) for (let p = 0; p < 2; p++) { const x = Math.min(w - 1, Math.max(0, Math.round(c.cx - rx + (i + (p + 0.5) / 2) / S * 2 * rx))), y = Math.min(h - 1, Math.max(0, Math.round(c.cy - ry + (j + (q + 0.5) / 2) / S * 2 * ry))); s += g[y * w + x]; }
        v[j * S + i] = s / 4; m += v[j * S + i];
      }
      m /= S * S; for (let k = 0; k < S * S; k++) { v[k] -= m; m2 += v[k] * v[k]; }
      const sd = Math.sqrt(m2 / (S * S)); let out = null;
      if (sd > 10) { const n = Math.sqrt(m2); for (let k = 0; k < S * S; k++) v[k] /= n; out = v; }   // düz (boş) baloncukta desen yok
      sig.set(key, out); return out;
    };
    const at = new Map(); b.cells.forEach(c => at.set(c.r * 1000 + c.c, c));
    const dot = (a, c) => { let s = 0; for (let k = 0; k < S * S; k++) s += a[k] * c[k]; return s; }, rowS = [], colS = [];
    b.cells.forEach(c => {
      const a = get(c); if (!a) return;
      const rt = at.get(c.r * 1000 + c.c + 1), dn = at.get((c.r + 1) * 1000 + c.c);
      if (rt) { const o = get(rt); if (o) rowS.push(dot(a, o)); }
      if (dn) { const o = get(dn); if (o) colS.push(dot(a, o)); }
    });
    if (rowS.length < 4 || colS.length < 4) return '';
    const dr = mean(rowS) - mean(colS);
    return dr > 0.05 ? 'digit' : dr < -0.05 ? 'letter' : '';   // bulanık fotoğrafta fark ≈ 0.10; boş (desensiz) baloncuklarda ≈ 0
  }

  /** Blokları okuma sırasına koyar: önce soldan sağa sütunlar, sütun içinde yukarıdan aşağı. */
  function readingOrder(bl) {
    if (!bl.length) return [];
    const w = median(bl.map(b => b.x1 - b.x0)) || 1, s = bl.slice().sort((a, b) => a.x0 - b.x0), colsG = [];
    s.forEach(b => { const c = colsG[colsG.length - 1]; if (c && b.x0 - c.x < Math.max(0.5 * w, 1)) c.m.push(b); else colsG.push({ x: b.x0, m: [b] }); });
    return colsG.flatMap(c => c.m.sort((a, b) => a.y0 - b.y0));
  }

  const ROLE_TR = { questions: 'Soru bloğu', studentNo: 'Öğrenci numarası', schoolCode: 'Kurum kodu', booklet: 'Kitapçık türü', name: 'Ad (harf ızgarası)', surname: 'Soyad (harf ızgarası)', ignore: 'Yok say' };
  /** Ad-soyad harf ızgarası için varsayılan alfabe (Türkçe 29 harf; 26 satırlıysa Latin; 32 satırlıysa Q W X eklenmiş). Formda farklıysa kullanıcı düzeltir. */
  const ALPHA_TR = 'ABCÇDEFGĞHIİJKLMNOÖPRSŞTUÜVYZ', ALPHA_EN = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  function defaultAlphabet(n) { if (n === 26) return Array.from(ALPHA_EN); const s = ALPHA_TR + 'QWX'; return Array.from(n <= s.length ? s.slice(0, n) : s + '?'.repeat(n - s.length)); }
  const isAlphaGrid = b => (b.rows >= 24 && b.rows <= 34 && b.cols >= 9 && b.cols <= 40) || (b.cols >= 24 && b.cols <= 34 && b.rows >= 9 && b.rows <= 40);

  /** Rol tahmini (geometri): 10 satırlık geniş blok → rakam alanı, tek satır/sütun → kitapçık, kalan → soru. Emin olunmayanlar 'conf: low'. */
  function guessRoles(blocks, warnings) {
    const digit = [], book = [], alpha = [];
    blocks.forEach(b => {
      b.role = 'questions'; b.conf = 'high'; b.why = '';
      const R = b.rows, C = b.cols;
      if (isAlphaGrid(b)) { b.role = 'name'; b.axis = R >= C ? 'col' : 'row'; alpha.push(b); const n = b.axis === 'col' ? R : C; if (n !== 29 && n !== 26) { b.conf = 'low'; b.why = `${n} harflik ızgara: alfabeyi (harf sırasını) kontrol edin.`; } }
      else if ((R === 1 && C >= 2 && C <= 6) || (C === 1 && R >= 2 && R <= 6)) { b.role = 'booklet'; book.push(b); b.conf = 'med'; b.why = 'Tek satırlık küçük blok: kitapçık türü gibi görünüyor.'; }
      else if (R === 10 && b.glyph === 'digit') { b.role = 'digit'; digit.push(b); }   // baloncuk içindeki rakamlar satır boyunca aynı: rakam alanı
      else if (R === 10 && b.glyph === 'letter') { /* aynı sütunda aynı harf: 10 soruluk bölüm */ }
      else if (R === 10 && C >= 6 && C <= 14) { b.role = 'digit'; digit.push(b); b.conf = 'med'; b.why = 'Baloncukların içi boş olduğundan rakam alanı varsayıldı (10 satır × ' + C + ' sütun); kontrol edin.'; }
      else if (C === 10 && R >= 4 && R <= 14) { b.role = 'digit'; b.axis = 'row'; digit.push(b); b.conf = 'low'; b.why = 'Rakamlar yatay dizilmiş görünüyor; satırlar rakam alanı olabilir.'; }
      else if (R === 10 && C >= 2 && C <= 5) { b.conf = 'low'; b.why = '10 satır × ' + C + ' sütun: 10 soruluk bölüm mü, rakam alanı mı? Kontrol edin.'; }
      else if (R < 3) { b.conf = 'low'; b.why = 'Çok küçük blok (' + R + ' satır). Gerçek bir soru bloğu mu?'; }
      // baskı yazısı (başlık, büyük harfler) baloncuk sanılabilir: harf araları düzensizdir, baloncuk dizileri ise eşit aralıklıdır
      if ((R === 1 || C === 1 || R < 3 || C < 3) && b.role === 'questions' && (b.cvX > 0.10 || b.cvY > 0.10)) { b.role = 'ignore'; b.conf = 'low'; b.why = 'Aralıkları düzensiz küçük dizi: baskı yazısı olabilir, yok sayıldı.'; }
      else if (b.role === 'questions' && Math.max(R, C) > 12 && Math.min(R, C) < 3) { b.role = 'ignore'; b.conf = 'low'; b.why = 'Tek satırlık uzun dizi (' + R + '×' + C + '): soru bloğu olamaz, yok sayıldı.'; }
      if (b.fill < 0.9 && b.conf === 'high') { b.conf = 'med'; b.why = `${b.missing.length} baloncuk bulunamadı (silik/eksik baskı olabilir).`; }
    });
    digit.sort((a, b) => (b.axis === 'row' ? b.rows : b.cols) - (a.axis === 'row' ? a.rows : a.cols) || a.x0 - b.x0);
    digit.forEach((b, i) => { b.role = i === 0 ? 'studentNo' : i === 1 ? 'schoolCode' : 'ignore'; if (i === 0 && digit.length > 1) { b.conf = b.conf === 'low' ? 'low' : 'med'; b.why = b.why || 'Birden çok rakam alanı var; hangisinin öğrenci no, hangisinin kurum kodu olduğunu kontrol edin.'; } if (i === 1) { b.conf = 'med'; b.why = b.why || 'İkinci rakam alanı kurum kodu varsayıldı; kontrol edin.'; } if (i > 1) { b.conf = 'low'; b.why = 'Fazladan rakam alanı: yok sayıldı.'; } });
    book.forEach((b, i) => { if (i > 0) { b.role = 'ignore'; b.conf = 'low'; b.why = 'Birden çok kitapçık alanı var; yalnızca ilki kullanıldı.'; } });
    // harf ızgaraları: okuma sırasına göre ilki ad, ikincisi soyad (yan yana ya da alt alta)
    alpha.sort((a, b) => Math.abs(a.y0 - b.y0) > 0.5 * Math.max(a.y1 - a.y0, b.y1 - b.y0) ? a.y0 - b.y0 : a.x0 - b.x0);
    alpha.forEach((b, i) => { b.role = i === 0 ? 'name' : i === 1 ? 'surname' : 'ignore'; if (i === 0 && alpha.length === 1) { b.conf = b.conf === 'low' ? 'low' : 'med'; b.why = b.why || 'Tek harf ızgarası var: ad (ya da ad-soyad) olarak varsayıldı; kontrol edin.'; } if (i === 1 && b.conf === 'high') { b.conf = 'med'; b.why = 'İkinci harf ızgarası soyad varsayıldı; adın ve soyadın sırasını kontrol edin.'; } if (i > 1) { b.conf = 'low'; b.why = 'Fazladan harf ızgarası: yok sayıldı.'; } });
    const choiceCounts = blocks.filter(b => b.role === 'questions' && b.rows >= 5).map(b => b.cols), mode = median(choiceCounts);
    blocks.forEach(b => { if (b.role === 'questions' && b.rows >= 5 && mode && b.cols !== mode) { b.conf = 'low'; b.why = `Diğer soru bloklarında ${mode} şık var, bunda ${b.cols}. Kontrol edin.`; } });
    if (!blocks.some(b => b.role === 'questions')) warnings.push('Soru bloğu bulunamadı.');
  }

  /* ------------------------------------------------------------------ ana çözümleme */
  /** img: {gray,w,h} — boş (işaretsiz) form. Dönüş: { ok, error | frame, anchors, anchorSize, r, pitch, bsz, blocks[], rectified, warnings[], corners } */
  /** Çerçeve belirleme: opts.frame = 'auto' (varsayılan) | 'corners' (4 köşe karesi) | 'sides' (sol-sağ iki yan çizgi) | 'track' (yalnızca bir kenarda yan çizgi).
   *  Otomatik: belirgin 4 köşe karesi varsa köşeler; yoksa yan çizgiler (metin harfleri yanlışlıkla "köşe" sanılmasın); ikisi de yoksa köşe sonucu. */
  function pickFrame(img, want) {
    if (want === 'track') return trackOf(img);
    const C = want === 'sides' ? null : cornersOf(img), S = want === 'corners' ? null : sidesOf(img);
    if (want === 'corners') return C; if (want === 'sides') return S.ok ? S : Object.assign({}, S, { error: S.error + ' Çizgi yalnızca bir kenarda ise "Tek yan çizgi" seçin.' });
    if (S.ok && !(C.ok && C.strong)) return S;
    const T = trackOf(img); if (T.ok && !(C.ok && C.strong)) return T;   // iki iz yok ama tek, düzenli ve dış kenarda bir iz var
    if (C.ok) return C; if (S.ok) return S;
    return { ok: false, error: C.error + ' Köşe karesi olmayan formlarda kenardaki kısa siyah çizgiler (zamanlama işaretleri) aranır (iki kenarda ya da tek kenarda); onlar da bulunamadı.' };
  }

  /** Bloğun [a0,a1) satır ya da sütun aralığını ayrı blok yapar. */
  const gapCv = v => { if (v.length < 3) return 0; const d = v.slice(1).map((x, i) => x - v[i]), m = mean(d); return m > 0 ? Math.sqrt(mean(d.map(x => (x - m) * (x - m)))) / m : 0; };
  function cutBlock(b, dir, a0, a1, suffix) {
    if (dir === 'row') {
      const ys = b.ys.slice(a0, a1), n = ys.length * b.cols, miss = b.missing.filter(m => m[0] >= a0 && m[0] < a1).map(m => [m[0] - a0, m[1]]);
      return Object.assign({}, b, { id: b.id + suffix, rows: ys.length, ys, y0: ys[0], y1: ys[ys.length - 1], missing: miss, n: n - miss.length, fill: (n - miss.length) / n, cvY: gapCv(ys), cells: b.cells.filter(c => c.r >= a0 && c.r < a1).map(c => Object.assign({}, c, { r: c.r - a0 })) });
    }
    const xs = b.xs.slice(a0, a1), n = b.rows * xs.length, miss = b.missing.filter(m => m[1] >= a0 && m[1] < a1).map(m => [m[0], m[1] - a0]);
    return Object.assign({}, b, { id: b.id + suffix, cols: xs.length, xs, x0: xs[0], x1: xs[xs.length - 1], missing: miss, n: n - miss.length, fill: (n - miss.length) / n, cvX: gapCv(xs), cells: b.cells.filter(c => c.c >= a0 && c.c < a1).map(c => Object.assign({}, c, { c: c.c - a0 })) });
  }
  /** Ad ve soyad harf ızgaraları birbirine yakınsa tek blok çıkar: sütunlar arasındaki belirgin geniş boşluktan ikiye ayır. */
  function autoSplitAlpha(blocks) {
    const out = [];
    blocks.forEach(b => {
      let done = false;
      [['col', b.rows >= 24 && b.rows <= 34 && b.cols >= 16, b.xs], ['row', b.cols >= 24 && b.cols <= 34 && b.rows >= 16, b.ys]].forEach(([dir, ok, ax]) => {
        if (done || !ok) return;
        const gp = ax.slice(1).map((v, i) => v - ax[i]), med = median(gp), mx = Math.max(...gp), k = gp.indexOf(mx) + 1;
        if (med > 0 && mx >= 1.2 * med && k >= 6 && ax.length - k >= 6) { out.push(cutBlock(b, dir, 0, k, 'a'), cutBlock(b, dir, k, ax.length, 'b')); done = true; }
      });
      if (!done) out.push(b);
    });
    return out;
  }

  function analyze(img, opts) {
    opts = opts || {};
    const A = pickFrame(img, opts.frame || 'auto'); if (!A.ok) return A;
    const kind = A.kind || 'corners', sides = kind === 'sides' || kind === 'track';
    const fr = toFrame(img, A.corners, Object.assign({}, opts, sides ? { margin: 0.12 } : {})); if (!fr) return { ok: false, error: 'Köşe noktalarından dönüşüm hesaplanamadı.' };
    const asz = A.size * fr.k; let marks = null, markPitch = 0, exclude = fr.anchors.map(a => ({ x: a[0], y: a[1], r: asz * 1.1 }));
    if (sides) {   // yan çizgi işaretlerini çerçeve pikseline çevir; baloncuk sanılmasın
      const Hi = OMR.homography(A.corners, fr.anchors); if (!Hi) return { ok: false, error: 'Yan çizgilerden dönüşüm hesaplanamadı.' };
      marks = A.marks.map(m => OMR.applyH(Hi, m[0], m[1])); exclude = marks.map(m => ({ x: m[0], y: m[1], r: asz * 0.8 }));
      const gaps = [], parts = []; let at = 0; A.tracks.forEach(n => { parts.push(marks.slice(at, at + n)); at += n; });
      parts.forEach(t => { const d = [t[t.length - 1][0] - t[0][0], t[t.length - 1][1] - t[0][1]], L = Math.hypot(d[0], d[1]) || 1, pr = t.map(m => (m[0] * d[0] + m[1] * d[1]) / L).sort((a, b) => a - b); for (let i = 1; i < pr.length; i++) gaps.push(pr[i] - pr[i - 1]); });
      markPitch = median(gaps);
    }
    const det = detectBubbles(fr.gray, fr.w, fr.h, { exclude });
    if (!det.ok) return Object.assign({ corners: A.corners }, det);
    const warnings = [], clusters = [{ list: det.list, bw: det.bw, bh: det.bh }].concat(det.extra || []);
    const sts = clusters.map(c => { const q = structure(c.list, c.bw, c.bh); q.blocks.forEach(b => { b.bw = c.bw; b.bh = c.bh; }); return q; });   // her baloncuk boyutu kendi kümesinde bloklanır
    const st = { pitchX: Math.min(...sts.map(q => q.pitchX || 1e9)), pitchY: Math.min(...sts.map(q => q.pitchY || 1e9)) };
    let blocks = readingOrder(autoSplitAlpha([].concat(...sts.map(q => q.blocks)))).map((b, i) => Object.assign(b, { id: 'b' + (i + 1) }));
    blocks.forEach(b => { b.glyph = glyphStyle(fr.gray, fr.w, fr.h, b, b.bw, b.bh); });
    guessRoles(blocks, warnings);
    blocks.forEach(b => { b.axis = b.axis || (b.role === 'studentNo' || b.role === 'schoolCode' ? 'col' : b.role === 'booklet' ? (b.rows === 1 ? 'row' : 'col') : 'row'); b.name = ''; b.labels = ''; });
    const total = clusters.reduce((t, c) => t + c.list.length, 0), inBlocks = blocks.reduce((s, b) => s + b.n, 0), used = blocks.filter(b => b.role !== 'ignore'), cells = used.reduce((s, b) => s + b.rows * b.cols, 0), miss = used.reduce((s, b) => s + b.missing.length, 0);
    if (total - inBlocks > 0) warnings.push(`${total - inBlocks} baloncuk hiçbir bloğa girmedi (tek başına kaldı).`);
    if (Math.min(...(used.length ? used : blocks).map(b => Math.min(b.bw, b.bh))) < 20 || (cells && miss / cells > 0.05)) warnings.push(`Görüntü çözünürlüğü düşük ya da baskı silik (baloncuk ≈ ${Math.round(Math.min(...(used.length ? used : blocks).map(b => Math.min(b.bw, b.bh))))} piksel${cells ? ', ' + miss + ' baloncuk bulunamadı' : ''}). En az 200 dpi tarayın veya formu yakından, düz ışıkta çekin; aksi halde bazı alanlar eksik tanınabilir.`);
    if (!used.some(b => b.role === 'studentNo')) warnings.push('Öğrenci numarası alanı bulunamadı. Bu formda yoksa sorun değil; varsa görüntüyü iyileştirip yeniden çözümleyin.');
    if (!sides && !A.strong) warnings.push('Köşelerde belirgin siyah kare bulunamadı; çerçeve metin/çizgilerden tahmin edilmiş olabilir. Formda köşe karesi yoksa "Çerçeve türü" olarak "Yan çizgiler"i seçin.');
    if (kind === 'track') warnings.push('Tek yan çizgili form: çerçeve yalnızca bir kenardaki çizgilerden ve baloncuk düzeninden kurulur. En iyi sonuç için tarayıcı kullanın; fotoğrafta formu düz ve dik açıyla çekin. Aksi hâlde okuma sırasında örtüşme düşük çıkabilir ve form reddedilir (yanlış okumaktansa).');
    if (kind === 'sides' && A.tracks[0] !== A.tracks[1]) warnings.push(`Sol ve sağ yan çizgi sayıları farklı (${A.tracks[0]} ve ${A.tracks[1]}). Silik ya da kesik bir çizgi olabilir; formun tamamı net ve düz görünmeli.`);
    return {
      ok: true, warnings, frameKind: kind, tracks: sides ? A.tracks.slice() : null, marks: marks ? marks.map(m => [r2(m[0]), r2(m[1])]) : null, markPitch: r2(markPitch), corners: A.corners, H: fr.H, anchorSize: r2(asz), frame: { w: fr.w, h: fr.h }, imgSize: { w: img.w, h: img.h }, anchors: fr.anchors.map(a => [r2(a[0]), r2(a[1])]), k: fr.k,
      bsz: { w: r2(det.bw), h: r2(det.bh), level: det.level }, r: r2(Math.min(det.bw, det.bh) / 2), pitch: r2(Math.min(st.pitchX || 1e9, st.pitchY || 1e9)), nBubbles: total,
      blocks, bubbles: [].concat(...clusters.map(c => c.list)), rectified: { gray: fr.gray, w: fr.w, h: fr.h }
    };
  }

  /** Bloğu k. satırdan (dir='row') ya da k. sütundan (dir='col') sonra ikiye böler. Satır bölme yalnızca satırı soru olan bloklarda anlamlıdır. */
  function splitBlock(blocks, id, after, dir, force) {
    dir = dir === 'col' ? 'col' : 'row'; const i = blocks.findIndex(b => b.id === id); if (i < 0) return false;
    const b = blocks[i]; if (dir === 'row' && b.axis === 'col' && !force) return false;
    const total = dir === 'row' ? b.rows : b.cols; if (!(after >= 1 && after < total)) return false;
    const x = cutBlock(b, dir, 0, after, 'a'), y = cutBlock(b, dir, after, total, 'b'); x.manual = y.manual = true;
    blocks.splice(i, 1, x, y); return true;
  }

  /* ------------------------------------------------------------------ elle düzenleme yardımcıları
   *  Blok = düzenli ızgara: xs[] sütun merkezleri, ys[] satır merkezleri (düzeltilmiş çerçeve pikseli), bw × bh baloncuk boyutu.
   *  Dikdörtgen = ızgaranın dış sınırı (merkezler ± yarım baloncuk). Her işlev bloğu yerinde değiştirir ve türev alanları (rows, cols, x0…, cells, missing, n, fill) yeniler.
   *  `bubbles` (analyze().bubbles) verilirse bulunan/eksik baloncuk sayımı gerçek baloncuklara göre yapılır. */
  const idxCache = new WeakMap();
  function bubbleIndex(list) {
    let ix = idxCache.get(list); if (ix) return ix;
    const cell = Math.max(8, median(list.map(b => Math.max(b.bw || 0, b.bh || 0))) || 16), map = new Map();
    list.forEach(b => { const k = Math.floor(b.cx / cell) + ',' + Math.floor(b.cy / cell); let a = map.get(k); if (!a) map.set(k, a = []); a.push(b); });
    ix = { cell, map }; idxCache.set(list, ix); return ix;
  }
  /** Merkezi dikdörtgenin (x0,y0)-(x1,y1) içinde kalan baloncuklar. */
  function bubblesIn(list, x0, y0, x1, y1) {
    if (!list || !list.length) return [];
    const ix = bubbleIndex(list), out = [];
    for (let i = Math.floor(x0 / ix.cell); i <= Math.floor(x1 / ix.cell); i++) for (let j = Math.floor(y0 / ix.cell); j <= Math.floor(y1 / ix.cell); j++) (ix.map.get(i + ',' + j) || []).forEach(b => { if (b.cx >= x0 && b.cx <= x1 && b.cy >= y0 && b.cy <= y1) out.push(b); });
    return out;
  }
  function nearestBubble(list, x, y, tol) {
    if (!list || !list.length) return null;
    const ix = bubbleIndex(list), R = Math.ceil(tol / ix.cell), ci = Math.floor(x / ix.cell), cj = Math.floor(y / ix.cell); let best = null, bd = tol;
    for (let i = ci - R; i <= ci + R; i++) for (let j = cj - R; j <= cj + R; j++) (ix.map.get(i + ',' + j) || []).forEach(b => { const d = Math.hypot(b.cx - x, b.cy - y); if (d <= bd) { bd = d; best = b; } });
    return best;
  }
  /** xs/ys → rows, cols, uçlar, cells, missing, n, fill. */
  function refit(b, bubbles) {
    b.xs = b.xs.slice().sort((p, q) => p - q).map(r2); b.ys = b.ys.slice().sort((p, q) => p - q).map(r2);
    b.rows = b.ys.length; b.cols = b.xs.length; b.x0 = b.xs[0]; b.x1 = b.xs[b.cols - 1]; b.y0 = b.ys[0]; b.y1 = b.ys[b.rows - 1]; b.cvX = gapCv(b.xs); b.cvY = gapCv(b.ys);
    const tol = 0.5 * Math.min(b.bw, b.bh), have = bubbles && bubbles.length, ds = []; b.cells = []; b.missing = [];
    for (let r = 0; r < b.rows; r++) for (let c = 0; c < b.cols; c++) {
      b.cells.push({ r, c, cx: b.xs[c], cy: b.ys[r] });
      if (have) { const q = nearestBubble(bubbles, b.xs[c], b.ys[r], tol); if (q) ds.push(Math.hypot(q.cx - b.xs[c], q.cy - b.ys[r])); else b.missing.push([r, c]); }
    }
    const total = b.rows * b.cols; b.n = total - b.missing.length; b.fill = total ? b.n / total : 0; b.err = ds.length ? r2(median(ds)) : -1;   // err: bulunan baloncuklara ortalama (ortanca) uzaklık, piksel; -1 = hiç bulunamadı
    return b;
  }
  const touch = (b, bubbles) => { refit(b, bubbles); b.manual = true; return b; };
  const MAX_LINES = 400;

  /** Bloğu (dx, dy) piksel kaydırır. */
  function moveBlock(b, dx, dy, bubbles) { b.xs = b.xs.map(v => v + dx); b.ys = b.ys.map(v => v + dy); return touch(b, bubbles); }
  /** Bir kenarı `delta` piksel DIŞA doğru çeker (negatif = içe); karşı kenar sabit kalır, aradaki satır/sütunlar orantılı yeniden dağılır.
   *  edge: 'left' | 'right' | 'top' | 'bottom'. Tek satır/sütunlu bloğun o yönde açıklığı olmadığından yapılamaz (false döner); komşu baloncuklar çok sıkışacaksa da false. */
  function stretchEdge(b, edge, delta, bubbles) {
    const horiz = edge === 'left' || edge === 'right', front = edge === 'left' || edge === 'top', ax = horiz ? b.xs : b.ys; if (ax.length < 2 || !isFinite(delta)) return false;
    const lo = ax[0], hi = ax[ax.length - 1], fixed = front ? hi : lo, moving = front ? lo : hi, nm = moving + (front ? -delta : delta);
    if ((nm - fixed) * (moving - fixed) <= 0 || Math.abs(nm - fixed) < (ax.length - 1) * 0.6 * (horiz ? b.bw : b.bh)) return false;
    const k = (nm - fixed) / (moving - fixed), out = ax.map(v => fixed + (v - fixed) * k); if (horiz) b.xs = out; else b.ys = out; touch(b, bubbles); return true;
  }
  /** Bir kenara n satır/sütun ekler (n > 0, mevcut aralıkla) ya da o kenardan |n| satır/sütun siler (n < 0; en az 1 kalır). opts: { pitch (tek satırlı blokta aralık), bubbles } */
  function addLines(b, edge, n, opts) {
    opts = opts || {}; const horiz = edge === 'left' || edge === 'right', front = edge === 'left' || edge === 'top', ax = (horiz ? b.xs : b.ys).slice(), size = horiz ? b.bw : b.bh;
    const gaps = ax.slice(1).map((v, i) => v - ax[i]), pitch = gaps.length ? median(gaps) : (opts.pitch || 1.6 * size);
    if (n > 0) for (let i = 0; i < n && ax.length < MAX_LINES; i++) { if (front) ax.unshift(ax[0] - pitch); else ax.push(ax[ax.length - 1] + pitch); }
    else for (let i = 0; i < -n && ax.length > 1; i++) { if (front) ax.shift(); else ax.pop(); }
    if (horiz) b.xs = ax; else b.ys = ax; return touch(b, opts.bubbles);
  }
  /** Satır/sütun sayısını verilen değere getirir (alt ve sağ kenardan ekler/siler). */
  function setGrid(b, rows, cols, opts) {
    rows = Math.max(1, Math.min(MAX_LINES, Math.round(rows) || b.rows)); cols = Math.max(1, Math.min(MAX_LINES, Math.round(cols) || b.cols));
    if (rows !== b.rows) addLines(b, 'bottom', rows - b.rows, opts); if (cols !== b.cols) addLines(b, 'right', cols - b.cols, opts); return b;
  }
  /** Baloncuk boyutunu (genişlik ve yükseklik) `d` piksel büyütür/küçültür. */
  function resizeBubbles(b, d, bubbles) { b.bw = Math.max(4, r2(b.bw + d)); b.bh = Math.max(4, r2(b.bh + d)); return touch(b, bubbles); }

  /** Izgarayı gerçek baloncuklara oturtur: önce en iyi örtüşen küçük kaydırmayı arar (en çok ±1 aralık), sonra her sütun/satırı komşu baloncukların ortalamasına çeker.
   *  Dönüş: { before, after, dx, dy, total } (örtüşen hücre sayıları). Baloncuk yoksa değişiklik yapmaz. */
  function snapBlock(b, bubbles) {
    const total = b.rows * b.cols, tol = 0.5 * Math.min(b.bw, b.bh);
    const score = (dx, dy) => { let s = 0; for (let r = 0; r < b.rows; r++) for (let c = 0; c < b.cols; c++) if (nearestBubble(bubbles, b.xs[c] + dx, b.ys[r] + dy, tol)) s++; return s; };
    if (!bubbles || !bubbles.length) return { before: 0, after: 0, dx: 0, dy: 0, total };
    const before = score(0, 0);
    const gx = b.cols > 1 ? (b.x1 - b.x0) / (b.cols - 1) : 1.6 * b.bw, gy = b.rows > 1 ? (b.y1 - b.y0) / (b.rows - 1) : 1.6 * b.bh, st = Math.max(1, 0.25 * Math.min(b.bw, b.bh)); let best = { s: before, dx: 0, dy: 0, d: 0 };
    if (before < total) for (let dy = -gy; dy <= gy + 1e-6; dy += st) for (let dx = -gx; dx <= gx + 1e-6; dx += st) { const s = score(dx, dy), d = Math.hypot(dx, dy); if (s > best.s || (s === best.s && s > before && d < best.d)) best = { s, dx, dy, d }; }
    b.xs = b.xs.map(v => v + best.dx); b.ys = b.ys.map(v => v + best.dy);
    const bandY0 = b.ys[0] - 0.6 * b.bh, bandY1 = b.ys[b.rows - 1] + 0.6 * b.bh, bandX0 = b.xs[0] - 0.6 * b.bw, bandX1 = b.xs[b.cols - 1] + 0.6 * b.bw;
    for (let pass = 0; pass < 2; pass++) {
      b.xs = b.xs.map(x => { const m = bubblesIn(bubbles, x - tol, bandY0, x + tol, bandY1); return m.length >= Math.min(b.rows, Math.max(1, Math.ceil(0.4 * b.rows))) ? median(m.map(q => q.cx)) : x; });
      b.ys = b.ys.map(y => { const m = bubblesIn(bubbles, bandX0, y - tol, bandX1, y + tol); return m.length >= Math.min(b.cols, Math.max(1, Math.ceil(0.4 * b.cols))) ? median(m.map(q => q.cy)) : y; });
    }
    touch(b, bubbles); return { before, after: b.n, dx: r2(best.dx), dy: r2(best.dy), total };
  }

  /** Izgara kuran ortak bölüm: merkez listesinden (tek blok, aralık kuralı olmadan) xs/ys çıkarır. */
  function gridBlock(list, bw, bh) {
    const tolX = 0.35 * bw, tolY = 0.35 * bh, cx = cluster1d(list.map(p => p.cx), tolX), cy = cluster1d(list.map(p => p.cy), tolY);
    const xs = cx.centers.map((_, c) => mean(list.filter((_, k) => cx.as[k] === c).map(p => p.cx))), ys = cy.centers.map((_, r) => mean(list.filter((_, k) => cy.as[k] === r).map(p => p.cy)));
    const b = { id: 'x', xs, ys, bw, bh, role: 'questions', axis: 'row', name: '', labels: '', conf: 'high', why: '', glyph: '' };
    return refit(b, list);
  }
  /** Çizilen dikdörtgenden (dış sınır: x0,y0,x1,y1) yeni blok üretir.
   *  1) İçinde en az 2 gerçek baloncuk varsa: baloncuk merkezlerinden tek ızgara (kenardaki yanlış pozitifler budanır).
   *  2) Yoksa (silik baskı) ve opts.rows/cols verilmişse: dikdörtgene eşit aralıklı rows×cols ızgara; sonra gerçek baloncuklara oturmayı dener.
   *  Dönüş: { ok, block, mode: 'bubbles'|'grid', error } */
  function blockFromRect(bubbles, rect, opts) {
    opts = opts || {}; const x0 = Math.min(rect.x0, rect.x1), x1 = Math.max(rect.x0, rect.x1), y0 = Math.min(rect.y0, rect.y1), y1 = Math.max(rect.y0, rect.y1);
    if (x1 - x0 < 6 || y1 - y0 < 6) return { ok: false, error: 'Dikdörtgen çok küçük.' };
    let dflt = bubbles && bubbles.length ? { w: median(bubbles.map(q => q.bw)), h: median(bubbles.map(q => q.bh)) } : null;
    if (dflt) { const s = 2 * Math.max(dflt.w, dflt.h), nb = bubblesIn(bubbles, x0 - s, y0 - s, x1 + s, y1 + s); if (nb.length >= 3) dflt = { w: median(nb.map(q => q.bw)), h: median(nb.map(q => q.bh)) }; }   // boyut: dikdörtgenin çevresindeki baloncuklardan (ad-soyad ızgarası gibi farklı boyutlu alanlar için)
    const bw = opts.bw || (dflt && dflt.w) || 0, bh = opts.bh || (dflt && dflt.h) || 0;
    const inside = opts.grid ? [] : bubblesIn(bubbles, x0, y0, x1, y1);
    if (inside.length >= 2) {
      const w = median(inside.map(q => q.bw)), h = median(inside.map(q => q.bh)); let b = gridBlock(inside, w, h);
      if (b.rows >= 1 && b.cols >= 1) { b = trimEdges(b); b.manual = true; return { ok: true, block: b, mode: 'bubbles' }; }
    }
    const rows = Math.round(opts.rows), cols = Math.round(opts.cols);
    if (!(rows >= 1 && cols >= 1) || !bw || !bh) return { ok: false, error: 'Bu dikdörtgenin içinde baloncuk bulunamadı. Satır ve sütun sayısını yazarak elle ızgara oluşturun.' };
    if (rows > MAX_LINES || cols > MAX_LINES) return { ok: false, error: 'Satır/sütun sayısı çok büyük.' };
    const line = (a0, a1, n, sz) => { const lo = a0 + sz / 2, hi = a1 - sz / 2; if (n === 1 || hi <= lo) return Array.from({ length: n }, (_, i) => n === 1 ? (a0 + a1) / 2 : lo + i * 1.6 * sz); return Array.from({ length: n }, (_, i) => lo + i * (hi - lo) / (n - 1)); };
    let b = refit({ id: 'x', xs: line(x0, x1, cols, bw), ys: line(y0, y1, rows, bh), bw, bh, role: 'questions', axis: 'row', name: '', labels: '', conf: 'high', why: '', glyph: '' }, bubbles);
    if (opts.snap !== false && bubbles && bubbles.length) snapBlock(b, bubbles);
    b.manual = true; return { ok: true, block: b, mode: 'grid' };
  }
  /** Var olan bloğun dikdörtgenini yeniden sayar: dikdörtgenin içindeki gerçek baloncuklardan ızgarayı yeniden kurar (sayılar değişebilir). */
  function regridBlock(b, bubbles) {
    const r = blockFromRect(bubbles, { x0: b.x0 - b.bw / 2 - 3, y0: b.y0 - b.bh / 2 - 3, x1: b.x1 + b.bw / 2 + 3, y1: b.y1 + b.bh / 2 + 3 }, { grid: false });
    if (!r.ok || r.mode !== 'bubbles') return false;
    ['xs', 'ys', 'bw', 'bh'].forEach(k => { b[k] = r.block[k]; }); touch(b, bubbles); return true;
  }
  /** İki bloğu tek bloğa birleştirir: alt alta (aynı sütunlar) ya da yan yana (aynı satırlar). Dönüş: { ok, block | error } (yeni blok a'nın rol ve ayarlarını taşır). */
  function mergeBlocks(a, b, bubbles) {
    const tx = 0.5 * Math.min(a.bw, b.bw), ty = 0.5 * Math.min(a.bh, b.bh), same = (p, q, t) => p.length === q.length && p.every((v, i) => Math.abs(v - q[i]) <= t);
    const stack = same(a.xs, b.xs, tx), side = same(a.ys, b.ys, ty); let xs, ys;
    if (stack && !side) { xs = a.xs.map((v, i) => (v + b.xs[i]) / 2); ys = a.ys.concat(b.ys); if (Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0) > 0) return { ok: false, error: 'Bloklar üst üste biniyor; önce birini kaydırın.' }; }
    else if (side && !stack) { ys = a.ys.map((v, i) => (v + b.ys[i]) / 2); xs = a.xs.concat(b.xs); if (Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) > 0) return { ok: false, error: 'Bloklar üst üste biniyor; önce birini kaydırın.' }; }
    else return { ok: false, error: stack && side ? 'İki blok aynı yerde duruyor.' : 'Bloklar birleştirilemiyor: alt alta birleştirmek için sütun sayıları ve konumları, yan yana birleştirmek için satır sayıları ve konumları aynı olmalı. Önce satır/sütun sayısını ve konumunu eşitleyin.' };
    const m = Object.assign({}, a, { xs, ys, bw: a.bw, bh: a.bh, id: a.id, manual: true, conf: 'high', why: '' }); return { ok: true, block: refit(m, bubbles) };
  }
  /** Bölme için akıllı öneri: kafesteki en geniş boşluğun öncesindeki satır/sütun sayısı (1…n-1). dir: 'row' | 'col'. */
  function suggestSplit(b, dir) {
    const ax = dir === 'col' ? b.xs : b.ys; if (ax.length < 2) return 0; const gp = ax.slice(1).map((v, i) => v - ax[i]); return gp.indexOf(Math.max(...gp)) + 1;
  }
  /** Piksel konumuna (çerçeve pikseli) göre bölme noktası: konumun ÖNCESİNDE kalan satır/sütun sayısı. */
  function splitIndexAt(b, dir, pos) { const ax = dir === 'col' ? b.xs : b.ys; return ax.filter(v => v < pos).length; }
  /** Bloğu okuma sırasına göre dizer ve b1, b2… kimliklerini yeniden verir (yerinde). opts.keepOrder: sırayı elle verildiği gibi bırak. */
  function tidy(blocks, opts) {
    const ord = opts && opts.keepOrder ? blocks.slice() : readingOrder(blocks); blocks.splice(0, blocks.length, ...ord); blocks.forEach((b, i) => { b.id = 'b' + (i + 1); }); return blocks;
  }
  /** Boş bir blok (elle ekleme): ızgara verilmişse onu kullanır. */
  function newBlock(role, grid) { return Object.assign({ id: 'x', role: role || 'questions', axis: 'row', name: '', labels: '', conf: 'high', why: '', glyph: '', manual: true }, grid); }
  /** Bloğun okuma etiketleri (seçenek ekseni boyunca): soru bloğunda A B C…, rakam alanında 0–9, ad/soyad ızgarasında alfabe. makeTemplate ile aynı kurallar. */
  function labelsOf(b) {
    const k = labelAxis(b) === 'row' ? b.cols : b.rows, given = String(b.labels || '').replace(/\s+/g, '');
    if (b.role === 'name' || b.role === 'surname') { const g = Array.from(given).slice(0, k); return g.length === k ? g : defaultAlphabet(k).map((c, i) => g[i] || c); }
    const dflt = b.role === 'studentNo' || b.role === 'schoolCode' ? DIGITS : LETTERS, out = given.slice(0, k).split(''); while (out.length < k) out.push(dflt[out.length] || String(out.length + 1)); return out;
  }
  /** labelsOf'un hangi eksende olduğu: 'row' = etiketler sütunlara (soldan sağa), 'col' = satırlara (yukarıdan aşağı) yazılır. */
  function labelAxis(b) { return b.role === 'questions' ? (b.axis === 'col' ? 'col' : 'row') : b.role === 'booklet' ? (b.axis === 'col' ? 'col' : 'row') : (b.axis === 'row' ? 'row' : 'col'); }

  /* ------------------------------------------------------------------ şablon üretimi */
  /** Çözümlemedeki (kullanıcı onaylı) blokları okuma şablonuna çevirir. Hata varsa { error } döner. */
  function makeTemplate(an) {
    const bl = an.blocks.filter(b => b.role !== 'ignore'), groups = [], secs = [], errors = [];
    let q = 1, choices = 0, digits = 0, schoolDigits = 0, booklets = [];
    const lab = (b, nLab, dflt) => { const s = String(b.labels || '').replace(/\s+/g, ''); const out = s.slice(0, nLab).split(''); while (out.length < nLab) out.push(dflt[out.length] || String(out.length + 1)); return out; };
    const nL = (b, axis) => axis === 'row' ? b.cols : b.rows, nN = (b, axis) => axis === 'row' ? b.rows : b.cols;   // satır eksenli: satır = soru, sütun = şık
    bl.filter(b => b.role === 'questions').forEach(b => {
      const axis = b.axis === 'col' ? 'col' : 'row', n = nN(b, axis), k = nL(b, axis), name = String(b.name || '').trim(), xs = b.xs.map(r2), ys = b.ys.map(r2);
      if (k < 2 || k > 8) { errors.push(`${b.id}: ${k} şık desteklenmiyor (2–8).`); return; }
      let si = secs.length - 1; if (!secs.length || (secs[si].name !== name) || !name) { secs.push({ name: name || `Bölüm ${secs.length + 1}`, count: 0, start: q }); si = secs.length - 1; }
      secs[si].count += n;
      groups.push({ id: 'q' + groups.length, role: 'questions', axis, labels: lab(b, k, LETTERS), xs, ys, qStart: q, sec: si, secQ0: secs[si].start, numStart: q - secs[si].start + 1 }); q += n; choices = Math.max(choices, k);
    });
    const num = (b, role, id) => {
      const axis = b.axis === 'row' ? 'row' : 'col', k = nL(b, axis), n = nN(b, axis);
      if (k !== 10) errors.push(`${b.id}: ${ROLE_TR[role]} bloğu 10 rakam (0–9) satırı/sütunu içermeli, bunda ${k} var.`);
      groups.push({ id, role, axis, labels: lab(b, k, DIGITS), xs: b.xs.map(r2), ys: b.ys.map(r2) }); return n;
    };
    const sn = bl.find(b => b.role === 'studentNo'), sc = bl.find(b => b.role === 'schoolCode'), bk = bl.find(b => b.role === 'booklet');
    if (sn) digits = num(sn, 'studentNo', 'no'); if (sc) schoolDigits = num(sc, 'schoolCode', 'sc');
    if (bk) { const axis = bk.axis === 'col' ? 'col' : 'row', k = nL(bk, axis), lb = lab(bk, k, 'ABCDEFGH'); booklets = lb.slice(); groups.push({ id: 'bk', role: 'booklet', axis, labels: lb, xs: bk.xs.map(r2), ys: bk.ys.map(r2) }); }
    const nameLens = { name: 0, surname: 0 };
    ['name', 'surname'].forEach(role => {
      const b = bl.find(x => x.role === role); if (!b) return;
      const axis = b.axis === 'row' ? 'row' : 'col', k = nL(b, axis), n = nN(b, axis), given = Array.from(String(b.labels || '').replace(/\s+/g, '')).slice(0, k);
      if (k < 20 || k > 40) { errors.push(`${b.id}: ${ROLE_TR[role]} bloğunda ${k} harf var (en az 20 beklenir).`); return; }
      const lb = given.length === k ? given : defaultAlphabet(k).map((c, i) => given[i] || c);
      groups.push({ id: role === 'name' ? 'ad' : 'soyad', role, axis, labels: lb, xs: b.xs.map(r2), ys: b.ys.map(r2) }); nameLens[role] = n;
    });
    if (!groups.some(g => g.role === 'questions')) errors.push('En az bir soru bloğu gerekli.');
    if (errors.length) return { error: errors.join(' ') };
    const qb0 = bl.find(b => b.role === 'questions'), refW = qb0 && qb0.bw ? qb0.bw : an.bsz.w, refH = qb0 && qb0.bh ? qb0.bh : an.bsz.h, rr = r2(Math.min(refW, refH) / 2);
    bl.forEach(b => { if (b.bw && Math.abs(Math.min(b.bw, b.bh) / 2 - rr) > 0.08 * rr) { const g = groups.find(x => x.xs[0] === r2(b.xs[0]) && x.ys[0] === r2(b.ys[0])); if (g) g.r = r2(Math.min(b.bw, b.bh) / 2); } });   // farklı boyutlu baloncuk alanı (örn. ad-soyad ızgarası)
    const tpl = {
      kind: 'custom', version: 3, auto: true, orient: false, nup: 1, frame: { w: an.frame.w, h: an.frame.h }, anchors: an.anchors.map(a => a.slice()), anchorSize: an.anchorSize, r: rr, pitch: an.pitch || rr / 0.38,
      bsz: { w: r2(refW), h: r2(refH), level: an.bsz.level }, questions: q - 1, choices, digits, schoolDigits, booklets, groups, decor: [], lessons: secs.map(s => ({ name: s.name, count: s.count })), nameLen: nameLens.name, surnameLen: nameLens.surname
    };
    if (an.imgSize && an.H && an.H.length === 9) tpl.page = { w: an.imgSize.w, h: an.imgSize.h, H: Array.from(an.H).map(v => +(+v).toPrecision(10)) };   // kodlu baskı: çerçeve piksel → taranan boş formun pikseli
    if ((an.frameKind === 'sides' || an.frameKind === 'track') && an.marks) { tpl.frameKind = an.frameKind; tpl.marks = an.marks.map(m => m.slice()); tpl.markPitch = an.markPitch; tpl.tracks = an.tracks.slice(); }
    if (secs.length > 1 || (secs.length === 1 && bl.some(b => b.name))) tpl.opts = { sections: secs.map(s => ({ name: s.name, count: s.count })) };   // inceleme penceresinde ders başlıkları
    return { tpl };
  }

  /* ------------------------------------------------------------------ sınav ↔ form soru eşlemesi
   * Formdaki ders blokları (örn. 3 × 20 soru) ile sınavdaki ders soru sayıları (örn. Türkçe 10, Matematik 21) aynı olmak zorunda değil.
   * Varsayılan: her sınav dersi formdaki ADI TUTAN (yoksa sıradaki) ders bloğunun ilk satırından başlar; kullanılmayan satırlar yok sayılır.
   * Bir ders bloğundan fazla soru içerirse taşan sorular sonraki bloğun satırlarına geçer ve sonraki ders bu satırların ardından başlar.
   * map: sınav bölümüne göre [{ l: form ders indeksi (-1/boş = otomatik), s: dersin kaçıncı satırından başlayacağı (0 tabanlı) }]            */
  const NORM_TR = { 'ı': 'i', 'İ': 'i', 'ş': 's', 'Ş': 's', 'ğ': 'g', 'Ğ': 'g', 'ü': 'u', 'Ü': 'u', 'ö': 'o', 'Ö': 'o', 'ç': 'c', 'Ç': 'c' };
  const normName = t => String(t || '').replace(/[ıİşŞğĞüÜöÖçÇ]/g, c => NORM_TR[c]).toLowerCase().replace(/[^a-z0-9]+/g, '');
  /** formLessons: [{name,count}] ; sections: [{name,count}] → { ok, slots[examQ-1] = formQ (1 tabanlı), plan[], problems[], unused, formTotal } */
  function formSlots(sections, formLessons, map) {
    const secs = (sections || []).map(s => ({ name: String(s.name || ''), count: Math.max(0, Math.round(+s.count || 0)) })), L = (formLessons || []).map(l => ({ name: String(l.name || ''), count: Math.max(0, Math.round(+l.count || 0)) }));
    const starts = [], ends = []; let ft = 0; L.forEach(l => { starts.push(ft); ft += l.count; ends.push(ft); });
    const mp = Array.isArray(map) ? map : [], used = new Set(), problems = [], plan = [];
    mp.forEach((m, i) => { if (i < secs.length && m && m.l >= 0 && m.l < L.length) used.add(m.l | 0); });
    const nameMatch = nm => {
      const n = normName(nm); if (!n) return -1;
      for (let i = 0; i < L.length; i++) if (!used.has(i) && normName(L[i].name) === n) return i;
      for (let i = 0; i < L.length; i++) { const f = normName(L[i].name); if (!used.has(i) && f.length >= 3 && n.length >= 3 && (f.includes(n) || n.includes(f))) return i; }
      return -1;
    };
    let prevEnd = 0, lastLi = -1; const slots = [], owner = [];
    secs.forEach((sc, i) => {
      const m = mp[i] || {}, hasL = m.l >= 0 && m.l < L.length, off = Math.max(0, (m.s | 0) || 0), explicit = hasL || off > 0;
      let li = -1;
      if (hasL) li = m.l | 0;
      else { li = nameMatch(sc.name); if (li < 0) { let c = lastLi + 1; while (c < L.length && used.has(c)) c++; li = c < L.length ? c : -1; } if (li >= 0) used.add(li); }
      let start = li >= 0 ? starts[li] + off : prevEnd, shifted = false;
      if (!explicit && li >= 0 && start < prevEnd) { start = prevEnd; shifted = true; }   // önceki ders taştıysa onun ardından başla
      if (li >= 0) lastLi = li;
      const end = start + sc.count, liEnd = li >= 0 ? ends[li] : ft, from = li >= 0 ? start - starts[li] + 1 : start + 1;
      let endLi = li; while (endLi >= 0 && endLi < L.length - 1 && end > ends[endLi]) endLi++;
      plan.push({ sec: i, name: sc.name, count: sc.count, lesson: li, lessonName: li >= 0 ? L[li].name : '', start, end, from, to: from + sc.count - 1, spill: li >= 0 && end > liEnd, shifted, explicit, lessonCount: li >= 0 ? L[li].count : 0, lastLesson: endLi });
      for (let k = 0; k < sc.count; k++) { slots.push(start + k + 1); owner.push(i); }
      prevEnd = Math.max(prevEnd, end);
    });
    plan.forEach(p => {
      if (p.end > ft) problems.push(`${p.name || 'Bölüm ' + (p.sec + 1)}: ${p.count} soru formda kalan ${Math.max(0, ft - p.start)} satıra sığmıyor (formda toplam ${ft} soru satırı var).`);
    });
    const taken = new Map();
    plan.forEach(p => { for (let q = p.start; q < p.end && q < ft; q++) { if (taken.has(q)) { const o = taken.get(q); if (o !== p.sec) { problems.push(`${plan[o].name || 'Bölüm ' + (o + 1)} ile ${p.name || 'Bölüm ' + (p.sec + 1)} aynı form satırlarını kullanıyor (form satırı ${q + 1}).`); return; } } else taken.set(q, p.sec); } });
    const total = slots.length;
    return { ok: problems.length === 0 && total > 0, slots, plan, problems: Array.from(new Set(problems)), unused: Math.max(0, ft - taken.size), formTotal: ft, total };
  }

  /** Şablonu sınavın ders/soru yapısına göre yeniden numaralar: yalnız kullanılan form satırları kalır; soru no = sınav soru no.
   *  Dönen şablonu okuma, inceleme ve kamera aynen kullanır (cevaplar doğrudan sınav sırasındadır). */
  function projectTemplate(tpl, sections, map) {
    const lessons = tpl.lessons && tpl.lessons.length ? tpl.lessons : [{ name: '', count: tpl.questions }];
    const fs = formSlots(sections, lessons, map); if (!fs.ok) return { error: fs.problems.join(' ') || 'Soru eşlemesi kurulamadı.', fs };
    const inv = new Map(); fs.slots.forEach((fq, i) => inv.set(fq, i + 1));
    const secOf = []; fs.plan.forEach(p => { for (let k = 0; k < p.count; k++) secOf.push(p.sec); });
    const secStart = []; { let q = 1; sections.forEach((s, i) => { secStart[i] = q; q += s.count; }); }
    const groups = []; let gi = 0;
    tpl.groups.forEach(g => {
      if (g.role !== 'questions') { groups.push(g); return; }
      const col = g.axis === 'col', arr = col ? g.xs : g.ys; let i = 0;
      while (i < arr.length) {
        const q0 = inv.get(g.qStart + i); if (!q0) { i++; continue; }
        let j = i; while (j + 1 < arr.length && inv.get(g.qStart + j + 1) === inv.get(g.qStart + j) + 1 && secOf[inv.get(g.qStart + j + 1) - 1] === secOf[q0 - 1]) j++;
        const si = secOf[q0 - 1], ng = Object.assign({}, g, { id: 'q' + gi++, qStart: q0, sec: si, secQ0: secStart[si], numStart: q0 - secStart[si] + 1 });
        if (col) ng.xs = g.xs.slice(i, j + 1); else ng.ys = g.ys.slice(i, j + 1);
        groups.push(ng); i = j + 1;
      }
    });
    const secsOut = sections.map(s => ({ name: s.name, count: s.count }));
    const out = Object.assign({}, tpl, { groups, questions: fs.total, lessons: secsOut, projected: true, formQuestions: tpl.questions, slots: fs.slots });
    out.opts = Object.assign({}, tpl.opts || {}, { sections: secsOut }); if (sections.length <= 1) delete out.opts.sections;
    return { tpl: out, fs };
  }

  /* ------------------------------------------------------------------ kodlu baskı (hazır formun üzerine, milimetrik)
   * Boş formun taramasından çıkan şablon, her baloncuğun çerçeve pikseli konumunu bilir. Bu konumlar tarama → kâğıt ölçeğiyle (tam sayfa tarama ya da dpi)
   * milimetreye çevrilir; öğrenci no, kurum kodu, ad–soyad ve kitapçık baloncukları DOLU olarak, yalnız onlar basılır. Yazıcı payı için kaydırma/ölçek ayarı vardır.
   * cal: { paper:'A4'|'A5'|'A3'|'Letter'|'custom', pw, ph, dpi (0 = tam sayfa), dx, dy (mm), sx, sy (%), dot (baloncuk doluluk oranı) , frameMm:{x,y,w,h} (sayfa bilgisi yoksa) } */
  const PAPERS = { A3: [297, 420], A4: [210, 297], A5: [148, 210], Letter: [215.9, 279.4] };
  const trUpper = t => String(t == null ? '' : t).toLocaleUpperCase('tr');
  const FOLD = { 'Ç': 'C', 'Ğ': 'G', 'İ': 'I', 'Ö': 'O', 'Ş': 'S', 'Ü': 'U', 'Â': 'A', 'Î': 'I', 'Û': 'U' };
  function overlayMap(tpl, cal) {
    cal = Object.assign({ paper: 'A4', pw: 210, ph: 297, dpi: 0, dx: 0, dy: 0, sx: 100, sy: 100, dot: 0.86 }, cal || {});
    let [w, h] = cal.paper === 'custom' ? [Math.max(50, +cal.pw || 210), Math.max(50, +cal.ph || 297)] : (PAPERS[cal.paper] || PAPERS.A4);
    const pg = tpl.page, warn = []; let land = false;
    if (pg) land = pg.w > pg.h; else land = !!cal.landscape;
    [w, h] = land ? [Math.max(w, h), Math.min(w, h)] : [Math.min(w, h), Math.max(w, h)];
    let base;
    if (pg && pg.H && pg.H.length === 9) {
      const dpi = +cal.dpi > 0 ? +cal.dpi : 0, kx = dpi ? 25.4 / dpi : w / pg.w, ky = dpi ? 25.4 / dpi : h / pg.h;
      if (!dpi) { const ar = (pg.w / pg.h) / (w / h); if (Math.abs(ar - 1) > 0.04) warn.push(`Taranan görüntünün en-boy oranı seçilen kâğıtla (${cal.paper}) uyuşmuyor; tarama sayfanın tamamını kapsamıyor olabilir. "Tarama çözünürlüğü (dpi)" girin ya da kâğıt boyutunu değiştirin.`); }
      base = (x, y) => { const q = OMR.applyH(pg.H, x, y); return [q[0] * kx, q[1] * ky]; };
    } else {
      const f = cal.frameMm, a = tpl.anchors && tpl.anchors.length >= 4 ? tpl.anchors : [[0, 0], [tpl.frame.w, 0], [tpl.frame.w, tpl.frame.h], [0, tpl.frame.h]];
      if (!f || !(f.w > 0) || !(f.h > 0)) return { error: 'Bu şablonda tarama (sayfa) bilgisi yok; milimetre ölçüsü bilinmiyor. Boş formu "Otomatik tanıt" sekmesinde yeniden çözümleyip şablonu güncelleyin ya da çerçevenin ölçüsünü elle girin.' };
      const ax = a[1][0] - a[0][0], ay = a[3][1] - a[0][1]; base = (x, y) => [f.x + (x - a[0][0]) / ax * f.w, f.y + (y - a[0][1]) / ay * f.h];
      warn.push('Şablonda tarama bilgisi yok; ölçü elle girilen çerçeve ölçüsünden hesaplanıyor.');
    }
    const sx = (+cal.sx || 100) / 100, sy = (+cal.sy || 100) / 100, dx = +cal.dx || 0, dy = +cal.dy || 0;
    const fn = (x, y) => { const q = base(x, y); return [q[0] * sx + dx, q[1] * sy + dy]; };
    const c0 = fn(tpl.frame.w / 2, tpl.frame.h / 2), c1 = fn(tpl.frame.w / 2 + 100, tpl.frame.h / 2), c2 = fn(tpl.frame.w / 2, tpl.frame.h / 2 + 100);
    const mmx = Math.hypot(c1[0] - c0[0], c1[1] - c0[1]) / 100, mmy = Math.hypot(c2[0] - c0[0], c2[1] - c0[1]) / 100;
    return { fn, paper: [w, h], mmPerPx: (mmx + mmy) / 2, mmx, mmy, warn, land };
  }
  const linesOf = g => g.axis === 'col' ? g.xs.length : g.ys.length;
  const spotAt = (g, i, j) => g.axis === 'col' ? [g.xs[i], g.ys[j]] : [g.xs[j], g.ys[i]];
  function labelIndex(g, ch) { let j = g.labels.indexOf(ch); if (j < 0 && FOLD[ch]) j = g.labels.indexOf(FOLD[ch]); return j; }
  /** Bir öğrencinin dolu olacak baloncukları (çerçeve pikseli) ve uyarıları.
   *  d: { studentNo, schoolCode, name, surname, booklet }; opts: { noAlign:'left'|'right', pad0Code:true } */
  function fillSpots(tpl, d, opts) {
    opts = Object.assign({ noAlign: 'left' }, opts || {}); d = d || {}; const spots = [], notes = [], seen = {};
    const put = (g, i, j, role) => { const p = spotAt(g, i, j); spots.push({ x: p[0], y: p[1], r: g.r || tpl.r, role }); };
    const digitsInto = (g, str, role, label) => {
      const n = linesOf(g); let s = String(str || '').replace(/\D/g, ''); if (!s) return;
      if (s.length > n) { notes.push(`${label} ${s.length} haneli, formda ${n} sütun var (fazlası kesildi).`); s = s.slice(0, n); }
      if (opts.noAlign === 'right') s = s.padStart(n, ' ');
      for (let i = 0; i < s.length; i++) { if (s[i] === ' ') continue; const j = g.labels.indexOf(s[i]); if (j >= 0) put(g, i, j, role); }
    };
    const textInto = (g, str, role, label) => {
      const n = linesOf(g), s = Array.from(trUpper(str).replace(/\s+/g, ' ').trim()); if (!s.length) return;
      if (s.length > n) notes.push(`${label} "${s.join('')}" ${s.length} harf; formda ${n} sütun var (fazlası kesildi).`);
      s.slice(0, n).forEach((ch, i) => { if (ch === ' ') return; const j = labelIndex(g, ch); if (j >= 0) put(g, i, j, role); else if (!seen[ch]) { seen[ch] = 1; notes.push(`${label}: "${ch}" harfi formda yok (atlandı).`); } });
    };
    const gName = tpl.groups.find(g => g.role === 'name'), gSur = tpl.groups.find(g => g.role === 'surname');
    for (const g of tpl.groups) {
      if (g.role === 'studentNo' && d.studentNo != null && d.studentNo !== '') digitsInto(g, d.studentNo, 'studentNo', 'Öğrenci no');
      else if (g.role === 'schoolCode' && d.schoolCode != null && d.schoolCode !== '') digitsInto(g, String(d.schoolCode).replace(/\D/g, '').padStart(linesOf(g), '0').slice(-linesOf(g)), 'schoolCode', 'Kurum kodu');
      else if (g.role === 'booklet' && d.booklet) { const j = g.labels.indexOf(String(d.booklet).toUpperCase()); if (j >= 0) put(g, 0, j, 'booklet'); }
    }
    // ad–soyad: iki ayrı blok varsa ayrı ayrı; tek blok varsa "AD SOYAD" art arda (arada boş sütun); yalnız soyad bloğu varsa soyad
    if (gName && gSur) { if (d.name) textInto(gName, d.name, 'name', 'Ad'); if (d.surname) textInto(gSur, d.surname, 'surname', 'Soyad'); }
    else if (gName) { const full = [d.name, d.surname].filter(Boolean).join(' '); if (full) textInto(gName, full, 'name', 'Ad soyad'); }
    else if (gSur && d.surname) textInto(gSur, d.surname, 'surname', 'Soyad');
    return { spots, notes };
  }
  /** Tek sayfa SVG (mm). mode: 'fill' = yalnız dolu baloncuklar · 'test' = hizalama sayfası (tüm baloncuk halkaları + çerçeve işaretlerinde artı + dolu baloncuklar) */
  function overlaySVG(tpl, d, cal, opts) {
    opts = Object.assign({ mode: 'fill', color: '#000' }, opts || {}); const m = overlayMap(tpl, cal); if (m.error) return { error: m.error };
    cal = Object.assign({ dot: 0.86 }, cal || {}); const [W, H] = m.paper, out = [`<svg xmlns="http://www.w3.org/2000/svg" width="${W}mm" height="${H}mm" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="#fff"/>`];
    const f = n => (+n).toFixed(3), fs = opts.mode === 'test' ? fillSpots(tpl, d || {}, opts) : fillSpots(tpl, d || {}, opts);
    if (opts.mode === 'test') {
      const sw = Math.max(0.08, m.mmPerPx * (tpl.r || 10) * 0.07);
      for (const g of tpl.groups) { const r = (g.r || tpl.r) * m.mmPerPx; for (let ri = 0; ri < g.ys.length; ri++) for (let ci = 0; ci < g.xs.length; ci++) { const p = m.fn(g.xs[ci], g.ys[ri]); out.push(`<circle cx="${f(p[0])}" cy="${f(p[1])}" r="${f(r)}" fill="none" stroke="#c0392b" stroke-width="${f(sw)}"/>`); } }
      const pts = (tpl.marks && tpl.marks.length ? tpl.marks : tpl.anchors || []).concat(tpl.anchors || []), L = 3;
      for (const a of pts) { const p = m.fn(a[0], a[1]); out.push(`<path d="M${f(p[0] - L)} ${f(p[1])}H${f(p[0] + L)}M${f(p[0])} ${f(p[1] - L)}V${f(p[1] + L)}" stroke="#2c6fbb" stroke-width="0.15" fill="none"/>`); }
      out.push(`<text x="${f(W / 2)}" y="${f(H - 4)}" font-size="2.3" text-anchor="middle" font-family="Arial,sans-serif" fill="#2c6fbb">HİZALAMA TESTİ · ${esc(cal.paper === 'custom' ? W + '×' + H + ' mm' : cal.paper)} · kaydırma ${(+cal.dx || 0).toFixed(1)} / ${(+cal.dy || 0).toFixed(1)} mm · ölçek %${(+cal.sx || 100).toFixed(2)} / %${(+cal.sy || 100).toFixed(2)} — kırmızı halka = baloncuk, mavi artı = işaret; formla üst üste denk gelmeli</text>`);
    }
    const dotR = Math.max(0.05, +cal.dot || 0.86);
    for (const s of fs.spots) { const p = m.fn(s.x, s.y); out.push(`<ellipse cx="${f(p[0])}" cy="${f(p[1])}" rx="${f(s.r * m.mmx * dotR)}" ry="${f(s.r * m.mmy * dotR)}" fill="${opts.color}"/>`); }
    out.push('</svg>'); return { svg: out.join(''), notes: fs.notes, warn: m.warn, spots: fs.spots.length, paper: m.paper };
  }
  function esc(t) { return String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

  /* ------------------------------------------------------------------ şablonla eşleştirme */
  function matchScore(rec, tpl, s) {
    const exp = tpl.bsz ? { w: tpl.bsz.w * s, h: tpl.bsz.h * s } : { w: 2 * tpl.r * s, h: 2 * tpl.r * s }, det = detectBubbles(rec.gray, rec.w, rec.h, { expect: exp, level: 2 });   // beklenen boyut ve halka testi yanlış pozitifleri zaten eler; küçültülmüş görüntüde ince halkalar silikleştiği için en duyarlı düzey
    const cell = Math.max(exp.w, exp.h), grid = new Map(), key = (x, y) => Math.floor(x / cell) + ',' + Math.floor(y / cell);
    (det.list || []).forEach(b => { const k = key(b.cx, b.cy); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(b); });
    const tol = 0.5 * Math.min(exp.w, exp.h); let tot = 0, hit = 0; const errs = [];
    tpl.groups.forEach(g => g.ys.forEach(y => g.xs.forEach(x => {
      tot++; const px = x * s, py = y * s, cx = Math.floor(px / cell), cy = Math.floor(py / cell); let best = 1e9;
      for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) (grid.get((cx + i) + ',' + (cy + j)) || []).forEach(b => { const d = Math.hypot(b.cx - px, b.cy - py); if (d < best) best = d; });
      if (best <= tol) { hit++; errs.push(best / s); }
    })));
    return { score: tot ? hit / tot : 0, hit, tot, err: errs.length ? median(errs) : 0, found: (det.list || []).length };
  }

  /** Taranmış/fotoğraflanmış görüntünün bu şablonla örtüşmesi ve yönü. opts: { rot (sabit yön), rotFirst, anchors (önceden bulunmuş) } */
  function fit(img, tpl, opts) {
    opts = opts || {};
    if (tpl.frameKind === 'track') return fitTrack(img, tpl, opts);
    const sides = tpl.frameKind === 'sides', A = opts.anchors || (sides ? sidesOf(img) : cornersOf(img)); if (!A.ok) return { ok: false, score: 0, error: A.error };
    const ta = dist(tpl.anchors[0], tpl.anchors[1]) / dist(tpl.anchors[0], tpl.anchors[3]);
    const order = opts.rot != null ? [opts.rot] : [0, 1, 2, 3].sort((a, b) => (a === opts.rotFirst ? -1 : 0) - (b === opts.rotFirst ? -1 : 0)), s = Math.min(1, 1500 / Math.max(tpl.frame.w, tpl.frame.h));
    let best = null;
    for (const r of order) {
      const o = [0, 1, 2, 3].map(i => A.corners[(i + r) % 4]), qa = dist(o[0], o[1]) / dist(o[0], o[3]);
      if (qa / ta < 0.55 || qa / ta > 1.8) continue;   // 90° dönük: en-boy oranı uymaz, boşuna hesaplama
      let H = OMR.homography(tpl.anchors, o), corners = o, rf = null; if (!H) continue;
      if (sides) {   // yan çizgi: uç işaretlerden ilk tahmin, sonra bütün işaretlerle en küçük kareler
        rf = refineByMarks(tpl, A.marks, H, dist(o[0], o[1]) / dist(tpl.anchors[0], tpl.anchors[1]));
        if (rf) { H = rf.H; corners = tpl.anchors.map(a => OMR.applyH(H, a[0], a[1])); }
      }
      const m = matchScore(OMR.rectify(img, H, tpl.frame, s), tpl, s);
      if (!best || m.score > best.score) best = Object.assign(m, { rot: r, corners, marksUsed: rf ? rf.n : 0, markRms: rf ? r2(rf.rms) : 0, tracks: sides ? A.tracks : null });
      if (m.score >= 0.92) break;
    }
    if (best && sides && tpl.tracks) {   // uçtaki bir işaret silik/kesik/fazlaysa satırlar sessizce bir sıra kayabilir: sayılar şablonla aynı değilse işaretle
      const a = best.tracks.slice().sort((x, y) => x - y), b = tpl.tracks.slice().sort((x, y) => x - y); best.trackMismatch = a[0] !== b[0] || a[1] !== b[1]; best.expectTracks = tpl.tracks.slice();
    }
    return best ? Object.assign({ ok: true }, best) : { ok: false, score: 0, error: 'Köşe dörtgeni şablonun en-boy oranına uymuyor.' };
  }

  /** Birden çok şablondan formu bulur. Dönüş: sıralı [{ index, score, rot }] */
  function identify(img, tpls, opts) {
    const fits = tpls.map((t, index) => ({ index, f: fit(img, t, opts) }));
    if (!fits.some(x => x.f.ok)) return { ok: false, error: fits.length ? fits[0].f.error : 'Kayıtlı şablon yok.', list: [] };
    const list = fits.map(({ index, f }) => ({ index, score: f.ok ? f.score : 0, rot: f.rot, corners: f.corners })).sort((a, b) => b.score - a.score);
    const b = list[0], sec = list[1] ? list[1].score : 0;
    return { ok: true, list, best: b, confident: !!b && b.score >= 0.3 && b.score >= 2 * sec + 0.05 };   // rastgele örtüşme ≈ 0.03–0.25; düşük çözünürlükte doğru şablon bile 0.5 civarı kalabilir
  }

  /** Yönü/köşeleri kendiliğinden bulup okur. tpl.auto olmayan (eski, elle tanımlı) şablonlarda doğrudan OMR.readPage'e düşer. */
  function readAuto(img, tpl, opts) {
    opts = Object.assign({}, opts); let info = null;
    if (tpl.auto && !opts.corners) {
      const f = fit(img, tpl, { rotFirst: opts.rotFirst });
      const isSd = tpl.frameKind === 'sides' || tpl.frameKind === 'track', minScore = tpl.frameKind === 'track' ? (f.trackMismatch ? 0.88 : 0.8) : tpl.frameKind === 'sides' ? (f.trackMismatch ? 0.7 : 0.45) : 0.3;
      if (f.ok && tpl.frameKind === 'track' && f.markFit < 0.85) { return { ok: false, forms: [], orientation: 0, corners: null, notes: [], fit: { score: f.score || 0, rot: -1, failed: true, markFit: f.markFit }, error: 'Tek yan çizginin satır işaretleri şablonla uyuşmuyor (sadece %' + Math.round(100 * f.markFit) + ' eşleşti): satırlar kaymış olabilir, yanlış okumamak için form reddedildi. Formu daha düz ve tam görünür çekin ya da tarayın.' }; }
      if (f.ok && f.score >= minScore) { opts.corners = f.corners; info = { score: f.score, rot: f.rot, err: f.err, marksUsed: f.marksUsed, markRms: f.markRms, tracks: f.tracks, expectTracks: f.expectTracks, trackMismatch: !!f.trackMismatch }; } else info = { score: f.score || 0, rot: -1, failed: true };
      if (info.failed && isSd) return { ok: false, forms: [], orientation: 0, corners: null, notes: [], fit: info, error: f.ok ? 'Form bu şablonla örtüşmüyor (yan çizgi bulundu ama baloncuk düzeni uymuyor). Doğru şablonu seçtiğinizden ve formun tam, düz görüntülendiğinden emin olun.' : (f.error || 'Yan çizgiler bulunamadı.') };
    }
    const res = OMR.readPage(img, tpl, opts); res.fit = info; return res;
  }

  return { LEVELS, ROLE_TR, ALPHA_TR, defaultAlphabet, findAnchors, findSideMarks, findTrack, homographyLS, toFrame, detectBubbles, structure, analyze, splitBlock, refit, moveBlock, stretchEdge, addLines, setGrid, resizeBubbles, snapBlock, blockFromRect, regridBlock, mergeBlocks, suggestSplit, splitIndexAt, tidy, newBlock, labelsOf, labelAxis, bubblesIn, nearestBubble, readingOrder, glyphStyle, makeTemplate, formSlots, projectTemplate, normName, overlayMap, fillSpots, overlaySVG, PAPERS, fit, identify, readAuto, matchScore };
});
