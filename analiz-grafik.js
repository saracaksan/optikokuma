/* analiz-grafik.js — Analiz ekranı grafikleri (SVG, kütüphanesiz): çizgi, yatay çubuk, sütun / yığılmış sütun, ısı rengi.
 * Kurallar: ince işaretler (çizgi 2px, çubuk ≤24px, veri ucu 4px yuvarlak), işaretler arasında 2px yüzey boşluğu, 2 seriden fazlaysa her zaman gösterge,
 * üzerine gelince (ya da klavyeyle ←/→) araç ipucu, her grafiğin altında "Tablo görünümü"; renkler tema değişkenlerinden (--v1…--v8, açık/koyu ayrı).
 * Metinler asla seri rengini taşımaz; kimlik renkli işaretle (çizgi anahtarı) verilir. Etiketler textContent ile yazılır. */
'use strict';

const AnViz = (() => {
  const NS = 'http://www.w3.org/2000/svg';
  const sv = (t, a, txt) => { const e = document.createElementNS(NS, t); if (a) for (const k in a) if (a[k] != null && a[k] !== false) e.setAttribute(k, a[k]); if (txt != null) e.textContent = txt; return e; };
  const cut = (s, n) => { s = String(s == null ? '' : s); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
  const num = v => v != null && v !== '' && isFinite(v);
  const niceStep = raw => { const p = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p; };
  /** Temiz eksen değerleri: { ticks, lo, hi } */
  function ticks(lo, hi, n, int) {
    if (hi - lo < 1e-9) { lo -= 1; hi += 1; }
    let st = niceStep((hi - lo) / (n || 4)); if (int) st = Math.max(1, Math.round(st));
    const a = Math.floor(lo / st + 1e-9), b = Math.ceil(hi / st - 1e-9), out = [];
    for (let i = a; i <= b; i++) out.push(Math.round(i * st * 1e6) / 1e6);
    return { ticks: out, lo: out[0], hi: out[out.length - 1] };
  }
  const slotOf = c => (c >= 1 && c <= 8 ? c : 0);
  const keyEl = (c, dash, color) => h('span', { class: 'vz-key vz-b' + (color ? 0 : slotOf(c)) + (dash ? ' dash' : ''), style: color ? { background: color } : null });
  const fillOf = s => ({ class: 'vz-f' + (s.color ? 0 : slotOf(s.c)), style: s.color ? 'fill:' + s.color : null });

  function fillTip(tipEl, head, rows) {
    clear(tipEl).append(h('div', { class: 'vz-th' }, head), ...rows.map(r => h('div', { class: 'vz-tr' }, r.c != null || r.color ? keyEl(r.c, r.dash, r.color) : h('span', { class: 'vz-key none' }), h('b', null, r.v), h('span', { class: 'vz-tn' }, r.n))));
  }
  /** Araç ipucunu kutuya göre konumlandırır (taşmasın diye kenarlara yaslar). px: kutu içinde x, py: kutu içinde y (üst kenar) */
  function placeTip(tipEl, box, px, py) {
    tipEl.hidden = false; const bw = box.clientWidth || 600, tw = tipEl.offsetWidth || 160, th = tipEl.offsetHeight || 60;
    const left = Math.max(4, Math.min(bw - tw - 4, px - tw / 2)); let top = py - th - 10; if (top < 0) top = Math.min(py + 14, Math.max(0, (box.clientHeight || 200) - th));
    tipEl.style.left = left + 'px'; tipEl.style.top = top + 'px';
  }
  const legend = (series, onToggle, hidden) => series.length < 2 ? null : h('div', { class: 'vz-legend' }, series.map(s => {
    const b = h('button', { type: 'button', class: 'vz-lg' + (hidden && hidden.has(s.name) ? ' off' : ''), 'aria-pressed': hidden && hidden.has(s.name) ? 'false' : 'true', title: onToggle ? 'Göster / gizle' : s.name, onclick: onToggle ? () => onToggle(s) : null }, keyEl(s.c, s.dash, s.color), h('span', null, s.name));
    if (!onToggle) { b.disabled = true; b.classList.add('static'); } return b;
  }));
  function tableView(head, rows, label) {
    return h('details', { class: 'vz-details no-print' }, h('summary', null, label || 'Tablo görünümü'), h('div', { class: 'tablewrap' }, h('table', { class: 'an-table' }, h('thead', null, h('tr', null, head.map((x, i) => h('th', { class: i ? 'num' : '' }, x)))), h('tbody', null, rows.map(r => h('tr', null, r.map((x, i) => h('td', { class: i ? 'num' : '' }, x == null || x === '' ? '–' : x))))))));
  }

  /* ------------------------------------------------------------ çizgi grafik
   o: { labels:[satır1], sub:[satır2], full:[araç ipucu başlığı], series:[{name,c:1..8,dash,pts:[sayı|null]}], fmt(v), yMin, yMax, invert, int, label, pad }  */
  function line(o) {
    const n = o.labels.length, W = 720, H = o.h || 250, pl = 50, pr = 52, pt = 16, pb = o.sub ? 56 : 40, fmt = o.fmt || (v => nf(v, 1));
    const hidden = new Set(), wrap = h('div', { class: 'vz' }), box = h('div', { class: 'vz-box', tabindex: '0' }), tipEl = h('div', { class: 'vz-tip', role: 'status', hidden: true }), lgHold = h('div'), svgHold = h('div');
    let cur = -1, geo = null;
    box.append(svgHold, tipEl);
    const draw = () => {
      const vis = o.series.filter(s => !hidden.has(s.name)), ys = vis.flatMap(s => s.pts).filter(num);
      clear(svgHold); if (!ys.length || n < 1) { svgHold.append(h('div', { class: 'muted small' }, 'Grafik için yeterli veri yok.')); geo = null; return; }
      let lo = o.yMin != null ? o.yMin : Math.min(...ys), hi = o.yMax != null ? o.yMax : Math.max(...ys); if (o.yMin == null || o.yMax == null) { const p = (hi - lo || 1) * (o.pad != null ? o.pad : .12); if (o.yMin == null) lo -= p; if (o.yMax == null) hi += p; }
      const T = ticks(lo, hi, 4, o.int), mn = Math.min(...ys), mx = Math.max(...ys);
      const fl = o.yMin != null ? o.yMin : (o.floor != null && mn >= o.floor ? o.floor : null), ce = o.yMax != null ? o.yMax : (o.ceil != null && mx <= o.ceil ? o.ceil : null);
      if (fl != null) { T.ticks = T.ticks.filter(v => v >= fl - 1e-9); if (!T.ticks.length || (o.yMin != null ? T.ticks[0] > fl + 1e-9 : T.ticks[0] > mn + 1e-9)) T.ticks.unshift(fl); }
      if (ce != null) { T.ticks = T.ticks.filter(v => v <= ce + 1e-9); if (!T.ticks.length || (o.yMax != null ? T.ticks[T.ticks.length - 1] < ce - 1e-9 : T.ticks[T.ticks.length - 1] < mx - 1e-9)) T.ticks.push(ce); }
      lo = T.ticks[0]; hi = T.ticks[T.ticks.length - 1]; if (hi === lo) hi = lo + 1;
      const X = i => n === 1 ? pl + (W - pl - pr) / 2 : pl + i * (W - pl - pr) / (n - 1), Y = v => pt + (o.invert ? (v - lo) / (hi - lo) : 1 - (v - lo) / (hi - lo)) * (H - pt - pb);
      const svg = sv('svg', { viewBox: `0 0 ${W} ${H}`, class: 'vz-svg', role: 'img', 'aria-label': (o.label || 'Grafik') + ': ' + vis.map(s => s.name).join(', ') });
      T.ticks.forEach(v => { const y = Y(v); svg.append(sv('line', { x1: pl, x2: W - pr, y1: y, y2: y, class: 'vz-grid' }), sv('text', { x: pl - 8, y: y + 4, 'text-anchor': 'end', class: 'vz-ax' }, o.yFmt ? o.yFmt(v) : nf(v, o.int ? 0 : 1))); });
      const step = Math.ceil(n / 10);
      o.labels.forEach((l, i) => { if (n > 10 && i % step && i !== n - 1) return; const x = X(i), t = sv('text', { x, y: H - pb + 16, 'text-anchor': 'middle', class: 'vz-ax' }, cut(l, 8)); svg.append(t); if (o.sub && o.sub[i]) svg.append(sv('text', { x, y: H - pb + 29, 'text-anchor': 'middle', class: 'vz-ax sub' }, cut(o.sub[i], n > 7 ? 10 : 14))); });
      const cross = sv('line', { x1: 0, x2: 0, y1: pt, y2: H - pb, class: 'vz-cross', visibility: 'hidden' }); svg.append(cross);
      const ends = [];
      vis.forEach(s => {
        const pts = s.pts.map((v, i) => num(v) ? [X(i), Y(v), v] : null).filter(Boolean);
        if (pts.length > 1) svg.append(sv('polyline', { points: pts.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' '), class: 'vz-line vz-s' + slotOf(s.c) + (s.dash ? ' dash' : ''), fill: 'none' }));
        pts.forEach(p => svg.append(sv('circle', { cx: p[0], cy: p[1], r: s.dash ? 3 : 4, class: 'vz-dot vz-f' + slotOf(s.c) })));
        if (pts.length) ends.push({ x: pts[pts.length - 1][0], y: pts[pts.length - 1][1], v: pts[pts.length - 1][2], dash: s.dash });
      });
      if (vis.length <= 4) { ends.sort((a, b) => a.y - b.y); let last = -99; ends.forEach(e => { if (e.dash && vis.length > 1) return; const ty = Math.max(e.y, last + 13); if (ty > H - pb - 2) return; last = ty; svg.append(sv('text', { x: e.x + 8, y: ty + 4, 'text-anchor': 'start', class: 'vz-val' }, fmt(e.v))); }); }
      const hl = sv('g', {}); svg.append(hl);
      const hit = sv('rect', { x: pl - 6, y: pt - 6, width: W - pl - pr + 12, height: H - pt - pb + 12, fill: 'transparent', class: 'vz-hit' }); svg.append(hit);
      svgHold.append(svg); geo = { svg, X, Y, cross, hl, vis, W, H };
      const at = ev => { const r = svg.getBoundingClientRect(), x = (ev.clientX - r.left) / r.width * W; let bi = 0, bd = 1e9; for (let i = 0; i < n; i++) { const d = Math.abs(X(i) - x); if (d < bd) { bd = d; bi = i; } } show(bi); };
      hit.addEventListener('pointermove', at); hit.addEventListener('pointerdown', at); hit.addEventListener('pointerleave', () => off());
      if (cur >= 0) show(cur);
    };
    const show = i => {
      if (!geo) return; cur = i; const { X, Y, cross, hl, vis, svg, W: gw } = geo, x = X(i); cross.setAttribute('x1', x); cross.setAttribute('x2', x); cross.setAttribute('visibility', 'visible'); clear(hl);
      const rows = []; let topY = 1e9;
      vis.forEach(s => { const v = s.pts[i]; if (num(v)) { hl.append(sv('circle', { cx: x, cy: Y(v), r: 6, class: 'vz-ring vz-s' + slotOf(s.c) })); topY = Math.min(topY, Y(v)); rows.push({ c: s.c, dash: s.dash, v: fmt(v), n: s.name }); } else rows.push({ c: s.c, dash: s.dash, v: '–', n: s.name + (o.missText ? ' · ' + o.missText : '') }); });
      fillTip(tipEl, (o.full && o.full[i]) || (o.labels[i] + (o.sub && o.sub[i] ? ' · ' + o.sub[i] : '')), rows);
      const rect = svg.getBoundingClientRect(), boxR = box.getBoundingClientRect(), k = rect.width / gw;
      placeTip(tipEl, box, rect.left - boxR.left + x * k, rect.top - boxR.top + (topY === 1e9 ? 40 : topY) * k);
    };
    const off = () => { cur = -1; tipEl.hidden = true; if (geo) { geo.cross.setAttribute('visibility', 'hidden'); clear(geo.hl); } };
    box.addEventListener('keydown', e => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); show(Math.max(0, Math.min(n - 1, (cur < 0 ? (e.key === 'ArrowLeft' ? n : -1) : cur) + (e.key === 'ArrowLeft' ? -1 : 1)))); } else if (e.key === 'Escape') off(); });
    box.addEventListener('blur', off);
    const lg = () => { clear(lgHold).append(legend(o.series, s => { hidden.has(s.name) ? hidden.delete(s.name) : (o.series.length - hidden.size > 1 && hidden.add(s.name)); lg(); draw(); }, hidden) || ''); };
    wrap.append(box, lgHold, tableView(['Sınav'].concat(o.series.map(s => s.name)), o.labels.map((l, i) => [(o.full && o.full[i]) || l].concat(o.series.map(s => num(s.pts[i]) ? fmt(s.pts[i]) : ''))), o.tableLabel));
    lg(); draw(); return wrap;
  }

  /* ------------------------------------------------------------ yatay gruplu çubuk
   o: { rows:[{label, vals:[sayı|null], sub}], series:[{name,c}], fmt, max, min, lw, label } */
  function bars(o) {
    const g = o.series.length, W = 720, lw = o.lw || 150, pr = 58, bh = g > 2 ? 12 : 16, gap = 2, rowH = g * bh + (g - 1) * gap + 12, top = 6, fmt = o.fmt || (v => nf(v, 1));
    const vals = o.rows.flatMap(r => r.vals).filter(num); const wrap = h('div', { class: 'vz' }), box = h('div', { class: 'vz-box' }), tipEl = h('div', { class: 'vz-tip', role: 'status', hidden: true }); box.append(tipEl);
    if (!vals.length) return h('div', { class: 'muted small' }, 'Grafik için yeterli veri yok.');
    let lo = Math.min(0, ...vals, o.min != null ? o.min : 0), hi = Math.max(...vals, o.max != null ? o.max : 0); const T = ticks(lo, hi, 4); lo = T.lo; hi = T.hi; if (hi === lo) hi = lo + 1;
    const H = top + o.rows.length * rowH + 24, X = v => lw + (v - lo) / (hi - lo) * (W - lw - pr), x0 = X(0);
    const svg = sv('svg', { viewBox: `0 0 ${W} ${H}`, class: 'vz-svg', role: 'img', 'aria-label': o.label || 'Çubuk grafik' });
    T.ticks.forEach(v => { const x = X(v); svg.append(sv('line', { x1: x, x2: x, y1: top, y2: H - 20, class: 'vz-grid' }), sv('text', { x, y: H - 6, 'text-anchor': 'middle', class: 'vz-ax' }, o.xFmt ? o.xFmt(v) : nf(v, 0))); });
    svg.append(sv('line', { x1: x0, x2: x0, y1: top, y2: H - 20, class: 'vz-base' }));
    const rowEls = [];
    o.rows.forEach((r, ri) => {
      const y0 = top + ri * rowH, band = sv('rect', { x: 0, y: y0, width: W, height: rowH, class: 'vz-band', visibility: 'hidden' }); svg.append(band);
      const lt = sv('text', { x: lw - 10, y: y0 + (rowH - 12) / 2 + 4, 'text-anchor': 'end', class: 'vz-lab' }, cut(r.label, 22)); lt.append(sv('title', {}, r.label)); svg.append(lt);
      r.vals.forEach((v, si) => { if (!num(v)) return; const y = y0 + 3 + si * (bh + gap), x1 = X(v), a = Math.min(x0, x1), w = Math.abs(x1 - x0), rr = Math.min(4, bh / 2, w);
        const d = x1 >= x0 ? `M${a},${y}H${a + w - rr}Q${a + w},${y} ${a + w},${y + rr}V${y + bh - rr}Q${a + w},${y + bh} ${a + w - rr},${y + bh}H${a}Z` : `M${a + w},${y}H${a + rr}Q${a},${y} ${a},${y + rr}V${y + bh - rr}Q${a},${y + bh} ${a + rr},${y + bh}H${a + w}Z`;
        svg.append(sv('path', Object.assign({ d }, fillOf(o.series[si]))));
        if (g <= 3 || si === 0) svg.append(sv('text', { x: x1 >= x0 ? x1 + 5 : x1 - 5, y: y + bh / 2 + 4, 'text-anchor': x1 >= x0 ? 'start' : 'end', class: 'vz-val l' }, fmt(v))); });
      const hit = sv('rect', { x: 0, y: y0, width: W, height: rowH, fill: 'transparent', class: 'vz-hit' }); svg.append(hit); rowEls.push(band);
      const sh = ev => { rowEls.forEach(b => b.setAttribute('visibility', 'hidden')); band.setAttribute('visibility', 'visible'); fillTip(tipEl, r.label + (r.sub ? ' · ' + r.sub : ''), o.series.map((s, si) => ({ c: s.c, color: s.color, dash: s.dash, v: num(r.vals[si]) ? fmt(r.vals[si]) : '–', n: s.name })));
        const rect = svg.getBoundingClientRect(), boxR = box.getBoundingClientRect(), k = rect.width / W; placeTip(tipEl, box, Math.max(lw * k, Math.min(rect.width - 40, (ev && ev.clientX != null ? ev.clientX - boxR.left : lw * k + 80))), rect.top - boxR.top + y0 * k); };
      hit.addEventListener('pointermove', sh); hit.addEventListener('pointerdown', sh); hit.addEventListener('pointerleave', () => { tipEl.hidden = true; band.setAttribute('visibility', 'hidden'); });
    });
    box.prepend(svg);
    wrap.append(box, legend(o.series, null) || '', tableView([o.corner || ''].concat(o.series.map(s => s.name)), o.rows.map(r => [r.label + (r.sub ? ' · ' + r.sub : '')].concat(r.vals.map(v => num(v) ? fmt(v) : ''))), o.tableLabel));
    return wrap;
  }

  /* ------------------------------------------------------------ sütun / yığılmış sütun
   o: { cats:[{label, sub, vals:[...]}], series:[{name,c}], stack, fmt, yMax, int, label } */
  function cols(o) {
    const g = o.series.length, nc = o.cats.length, W = 720, H = o.h || 230, pl = 46, pr = 14, pt = 18, pb = o.cats.some(c => c.sub) ? 52 : 38, fmt = o.fmt || (v => nf(v, o.int ? 0 : 1));
    const wrap = h('div', { class: 'vz' }), box = h('div', { class: 'vz-box' }), tipEl = h('div', { class: 'vz-tip', role: 'status', hidden: true }); box.append(tipEl);
    const tot = c => c.vals.reduce((a, v) => a + (num(v) ? v : 0), 0), all = o.stack ? o.cats.map(tot) : o.cats.flatMap(c => c.vals).filter(num);
    if (!nc || !all.length) return h('div', { class: 'muted small' }, 'Grafik için yeterli veri yok.');
    const T = ticks(0, Math.max(o.yMax || 0, ...all, o.int ? 1 : 0.0001), 4, o.int), hi = T.hi, Y = v => pt + (1 - v / hi) * (H - pt - pb), band = (W - pl - pr) / nc, base = Y(0);
    const svg = sv('svg', { viewBox: `0 0 ${W} ${H}`, class: 'vz-svg', role: 'img', 'aria-label': o.label || 'Sütun grafik' });
    T.ticks.forEach(v => svg.append(sv('line', { x1: pl, x2: W - pr, y1: Y(v), y2: Y(v), class: 'vz-grid' }), sv('text', { x: pl - 8, y: Y(v) + 4, 'text-anchor': 'end', class: 'vz-ax' }, o.yFmt ? o.yFmt(v) : nf(v, o.int ? 0 : 1))));
    svg.append(sv('line', { x1: pl, x2: W - pr, y1: base, y2: base, class: 'vz-base' }));
    const cw = Math.max(3, Math.min(24, o.stack ? band * .6 : (band * .72 - (g - 1) * 2) / g)), step = Math.ceil(nc / 12), rect = (x, y, w, hh, rTop) => { const r = Math.min(4, w / 2, hh); return rTop ? `M${x},${y + hh}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + hh}Z` : `M${x},${y}H${x + w}V${y + hh}H${x}Z`; };
    const bandEls = [];
    o.cats.forEach((c, ci) => {
      const cx = pl + band * ci + band / 2, bg = sv('rect', { x: pl + band * ci, y: pt, width: band, height: H - pt - pb, class: 'vz-band', visibility: 'hidden' }); svg.append(bg); bandEls.push(bg);
      if (nc <= 12 || ci % step === 0 || ci === nc - 1) { svg.append(sv('text', { x: cx, y: H - pb + 15, 'text-anchor': 'middle', class: 'vz-ax' }, cut(c.label, nc > 8 ? 9 : 12))); if (c.sub) svg.append(sv('text', { x: cx, y: H - pb + 28, 'text-anchor': 'middle', class: 'vz-ax sub' }, cut(c.sub, 11))); }
      if (o.stack) { let acc = 0; const segs = c.vals.map((v, si) => ({ v: num(v) ? v : 0, si })).filter(s => s.v > 0); segs.forEach((s, k) => { const yb = Y(acc) - (k ? 2 : 0), yt = Y(acc + s.v), hh = yb - yt; acc += s.v; if (hh > 0.5) svg.append(sv('path', Object.assign({ d: rect(cx - cw / 2, yt, cw, hh, k === segs.length - 1) }, fillOf(o.series[s.si])))); });
        if (o.totals && nc <= 12) svg.append(sv('text', { x: cx, y: Y(acc) - 5, 'text-anchor': 'middle', class: 'vz-val' }, fmt(acc))); }
      else c.vals.forEach((v, si) => { if (!num(v)) return; const x = cx - (g * cw + (g - 1) * 2) / 2 + si * (cw + 2), y = Y(Math.max(v, 0)), hh = Math.abs(Y(v) - base); if (hh > 0) svg.append(sv('path', Object.assign({ d: rect(x, y, cw, hh, true) }, fillOf(o.series[si])))); if (nc <= 12 && g <= 2 && hh >= 0) svg.append(sv('text', { x: x + cw / 2, y: y - 5, 'text-anchor': 'middle', class: 'vz-val' }, fmt(v))); });
      const hit = sv('rect', { x: pl + band * ci, y: pt, width: band, height: H - pt - pb + 12, fill: 'transparent', class: 'vz-hit' }); svg.append(hit);
      const sh = () => { bandEls.forEach(b => b.setAttribute('visibility', 'hidden')); bg.setAttribute('visibility', 'visible'); const rows = o.series.map((s, si) => ({ c: s.c, color: s.color, v: num(c.vals[si]) ? fmt(c.vals[si]) : '–', n: s.name })); if (o.stack && g > 1) rows.push({ v: fmt(tot(c)), n: 'Toplam' });
        fillTip(tipEl, c.tip || (c.label + (c.sub ? ' · ' + c.sub : '')), rows); const r = svg.getBoundingClientRect(), bR = box.getBoundingClientRect(), k = r.width / W; placeTip(tipEl, box, r.left - bR.left + cx * k, r.top - bR.top + (o.stack ? Y(tot(c)) : Y(Math.max(...c.vals.filter(num), 0))) * k); };
      hit.addEventListener('pointermove', sh); hit.addEventListener('pointerdown', sh); hit.addEventListener('pointerleave', () => { tipEl.hidden = true; bg.setAttribute('visibility', 'hidden'); });
    });
    box.prepend(svg);
    wrap.append(box, legend(o.series, null) || '', tableView([o.corner || ''].concat(o.series.map(s => s.name)), o.cats.map(c => [(c.tip || c.label) + (c.sub && !c.tip ? ' · ' + c.sub : '')].concat(c.vals.map(v => num(v) ? fmt(v) : ''))), o.tableLabel));
    return wrap;
  }

  /* ------------------------------------------------------------ ısı rengi (tablo hücreleri için)
   Ayrışan: ortaya göre mavi (üstte) ↔ kırmızı (altta); metin rengi değişmez (tema mürekkebi). */
  const BLUE = [42, 120, 214], RED = [227, 73, 72];
  function heat(v, mid, span) { if (!num(v) || !span) return ''; const t = Math.max(-1, Math.min(1, (v - mid) / span)), c = t >= 0 ? BLUE : RED, a = Math.min(.5, Math.abs(t) * .5); return a < .03 ? '' : `rgba(${c[0]},${c[1]},${c[2]},${a.toFixed(2)})`; }
  function seq(v, lo, hi) { if (!num(v) || hi <= lo) return ''; const t = Math.max(0, Math.min(1, (v - lo) / (hi - lo))); return t < .03 ? '' : `rgba(${BLUE[0]},${BLUE[1]},${BLUE[2]},${(t * .5).toFixed(2)})`; }

  return { line, bars, cols, heat, seq, ticks, legend, tableView, keyEl };
})();
