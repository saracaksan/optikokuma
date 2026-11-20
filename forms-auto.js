/* forms-auto.js — HARİCİ optik formu kendiliğinden tanıma ve ELLE DÜZENLEME ekranı
 *
 * Akış: boş formu yükle (bilgisayar: dosya/PDF · telefon: fotoğraf çek) → omr-detect.js formu düzeltir (4 köşe karesi YA DA kenardaki çizgiler:
 * iki yan çizgi / tek yan çizgi), bütün baloncukları milimetrik bulur, blokları (satır × sütun) ve rollerini tahmin eder (soru, öğrenci no, kurum kodu,
 * kitapçık, ad / soyad harf ızgarası) → kullanıcı görür ve DÜZELTİR:
 *   · rol, ders adı, şık/alfabe harfleri, soru–şık sayısı, okuma yönü
 *   · çerçeveyi tuvalde sürükleyerek taşıma, kenar/köşe tutamaçlarıyla büyütme-küçültme, ok tuşları ve düğmelerle MİLİM MİLİM (0,5 piksel adım) ayar
 *   · kenara satır/sütun ekleme-çıkarma, yanlış birleşmiş bloğu bölme (yatay/dikey, tuvalde tıklayarak), ayrı ama aynı olanı birleştirme
 *   · bulunamayan bölümü dikdörtgen çizerek ekleme (silik baskıda satır × sütun sayısını yazarak), baloncuklara oturtma, geri al / yinele
 * → isteğe bağlı yapay zekâ (Claude / Gemini / OpenAI / uyumlu; seviye: hızlı → en yetenekli; ya da API'siz: görüntüyü sohbet uygulamasına yapıştırıp yanıtı geri yapıştırma)
 * ders adı / harf önerir (konum üretmez) → işaretli bir formla dener → "Onayla ve kaydet".
 */
'use strict';

const AU = { an: null, img: null, name: '', file: '', sel: '', frame: 'auto', aiSnap: null, aiNotes: [], aiAvail: null, ai: null, aiPick: { provider: '', tier: '' }, aiUsed: null, saved: null, match: null, busy: '', err: '',
  zoom: 1, tool: '', step: 1, hist: [], fut: [], autosnap: true, showUncov: true, edited: false, drag: null, hover: null, k: 1, api: null };
const AU_COL = { questions: '#e11d48', studentNo: '#2563eb', schoolCode: '#0d9488', booklet: '#9333ea', name: '#d97706', surname: '#92400e', ignore: '#94a3b8' };
const AU_ROLES = [['questions', 'Soru bloğu'], ['studentNo', 'Öğrenci numarası'], ['schoolCode', 'Kurum kodu'], ['booklet', 'Kitapçık türü'], ['name', 'Ad (harf ızgarası)'], ['surname', 'Soyad (harf ızgarası)'], ['ignore', 'Yok say']];
const AU_SHORT = { questions: 'Soru', studentNo: 'No', schoolCode: 'Kurum', booklet: 'Kitapçık', name: 'Ad', surname: 'Soyad', ignore: 'Yok' };
/** Çerçeve (formun düzeltilmesini sağlayan işaretler) türleri: köşe karesi olmayan formlarda kenardaki kısa siyah çizgiler (zamanlama izi) kullanılır. */
const AU_FRAMES = [['auto', 'Otomatik (önerilir)'], ['corners', 'Dört köşe karesi'], ['sides', 'İki yan çizgi (sol ve sağ kenar)'], ['track', 'Tek yan çizgi (yalnızca bir kenar)']];
const AU_FRAME_TR = { corners: 'dört köşe karesi', sides: 'iki yan çizgi (sol+sağ)', track: 'tek yan çizgi' };
const AU_TIERS = [['', 'Yönetici ayarı'], ['fast', 'Hızlı'], ['balanced', 'Dengeli'], ['best', 'En yetenekli']];
const AU_STEPS = [0.5, 1, 2, 5, 10, 25];
const AU_NAMEROLE = r => r === 'name' || r === 'surname';

/** Rol değişince bloğun ekseni: rakam alanında rakam başına bir SÜTUN (10 satır) ya da bir SATIR (10 sütun); soru bloğunda satır = soru. */
function auAxis(b, role) {
  if (role === 'name' || role === 'surname') { const al = n => n >= 20 && n <= 40; return al(b.rows) && !al(b.cols) ? 'col' : al(b.cols) && !al(b.rows) ? 'row' : b.rows >= b.cols ? 'col' : 'row'; }   // alfabe boyutu = harf sayısı; öbür boyut = harf konumu
  if (role === 'studentNo' || role === 'schoolCode') return b.rows === 10 ? 'col' : b.cols === 10 ? 'row' : 'col';
  if (role === 'booklet') return b.rows === 1 ? 'row' : 'col';
  return 'row';
}
const auQn = b => b.axis === 'row' ? b.rows : b.cols, auK = b => b.axis === 'row' ? b.cols : b.rows;
/** Çizilen/oluşan bloğa rol tahmini (mevcut bloklara göre). */
function auGuessRole(b, used) {
  const has = r => used.some(x => x.role === r);
  if ((b.rows === 10 && b.cols >= 4 && b.cols <= 14) || (b.cols === 10 && b.rows >= 4 && b.rows <= 14)) return has('studentNo') ? (has('schoolCode') ? 'questions' : 'schoolCode') : 'studentNo';
  if ((b.rows >= 24 && b.rows <= 34 && b.cols >= 9) || (b.cols >= 24 && b.cols <= 34 && b.rows >= 9)) return has('name') ? (has('surname') ? 'questions' : 'surname') : 'name';
  if ((b.rows === 1 && b.cols >= 2 && b.cols <= 6) || (b.cols === 1 && b.rows >= 2 && b.rows <= 6)) return has('booklet') ? 'questions' : 'booklet';
  return 'questions';
}
/** Bloğun dış dikdörtgeni (merkezler ± yarım baloncuk + 3 px). */
const auBox = (b, an) => { const w = (b.bw || an.bsz.w) / 2 + 3, hh = (b.bh || an.bsz.h) / 2 + 3; return { x0: b.x0 - w, y0: b.y0 - hh, x1: b.x1 + w, y1: b.y1 + hh }; };
const auInBox = (B, p) => p.x >= B.x0 && p.x <= B.x1 && p.y >= B.y0 && p.y <= B.y1;

function auAnalyze(img, frame) {
  if (!window.OMRDetect) throw new Error('Tanıma modülü yüklenemedi (omr-detect.js). Sayfayı yenileyin.');
  return OMRDetect.analyze(img, { frame: frame || 'auto' });
}
/** Türkçe büyük harf ve yalnızca harf: ad/soyad ızgarası harfleri */
const auAlpha = s => String(s || '').toLocaleUpperCase('tr').replace(/[^A-ZÇĞİÖŞÜ]/g, '');

/* Klavye: ok tuşları seçili bloğu adım kadar kaydırır (Shift ×5, Alt ×0,5); Ctrl+Z / Ctrl+Y geri al / yinele; Del siler; Esc seçimi/aracı bırakır. Tek dinleyici. */
document.addEventListener('keydown', e => { const a = AU.api; if (a && a.alive()) a.key(e); });

function autoTab(pane, redraw) {
  const S = App.state, root = h('div'); pane.append(root);
  let cv = null, base = null, listEl = null, editBox = null, barEl = null, summary = null; const rows = new Map();
  let lastKey = '', lastAt = 0, raf = 0;

  const pickIn = h('input', { type: 'file', accept: 'image/*,application/pdf,.pdf', class: 'hidden', id: 'au-file', onchange: e => { const f = e.target.files[0]; e.target.value = ''; if (f) load(f); } });
  const camIn = h('input', { type: 'file', accept: 'image/*', capture: 'environment', class: 'hidden', id: 'au-cam', onchange: e => { const f = e.target.files[0]; e.target.value = ''; if (f) load(f); } });
  const testIn = h('input', { type: 'file', accept: 'image/*,application/pdf,.pdf', class: 'hidden', id: 'au-test', onchange: e => { const f = e.target.files[0]; e.target.value = ''; if (f) tryRead(f); } });

  const resetEdit = () => { AU.hist = []; AU.fut = []; AU.zoom = 1; AU.tool = ''; AU.edited = false; AU.drag = null; AU.hover = null; AU.sel = ''; lastKey = ''; };
  async function loadAi(force) {
    try { const st = await api('aiStatus', force ? { refresh: true } : {}, { noAuthRedirect: true }); AU.ai = st; AU.aiAvail = !!st.available; } catch (e) { AU.ai = null; AU.aiAvail = false; }
  }
  /** Çerçeve türünü elle seçip aynı görüntüyü yeniden çözümler (bloklara yapılan düzeltmeler sıfırlanır). */
  async function reframe(kind) {
    if (!AU.img) return; AU.frame = kind; AU.busy = 'Çerçeve türüne göre yeniden çözümleniyor…'; AU.saved = null; AU.match = null; AU.aiSnap = null; AU.aiNotes = []; AU.aiUsed = null; resetEdit(); draw();
    try {
      await new Promise(r => setTimeout(r, 30));
      const an = auAnalyze(AU.img, kind);
      if (!an.ok) { AU.an = null; AU.err = an.error || 'Form çözümlenemedi.'; } else { AU.err = ''; AU.an = an; AU.sel = ''; }
    } catch (e) { AU.an = null; AU.err = e.message; }
    AU.busy = ''; draw();
  }
  async function load(f) {
    AU.busy = 'Form çözümleniyor…'; AU.saved = null; AU.match = null; AU.aiSnap = null; AU.aiNotes = []; AU.aiUsed = null; AU.frame = 'auto'; AU.img = null; AU.err = ''; resetEdit(); draw();
    try {
      await new Promise(r => setTimeout(r, 30));
      const isPdf = f.type === 'application/pdf' || /\.pdf$/i.test(f.name || ''), img = await loadGray(isPdf ? (await pdfSources(f))[0] : f);
      AU.img = img; AU.file = f.name || 'form'; AU.name = AU.name || String(f.name || '').replace(/\.[^.]+$/, '').slice(0, 60);
      await new Promise(r => setTimeout(r, 10));
      const an = auAnalyze(img, 'auto');
      if (!an.ok) { AU.an = null; AU.busy = ''; AU.err = an.error || 'Form çözümlenemedi.'; draw(); return; }
      AU.err = ''; AU.an = an; AU.sel = '';
      // aynı form daha önce tanıtılmış mı?
      const known = S.templates.filter(t => t.json && t.json.auto && t.json.anchors && t.json.groups);
      if (known.length) { try { const r = OMRDetect.identify(img, known.map(t => t.json)); if (r.ok && r.best && r.best.score >= 0.6 && r.confident) AU.match = { name: known[r.best.index].name, score: r.best.score, id: known[r.best.index].templateId }; } catch (e) { } }
    } catch (e) { AU.an = null; AU.err = e.message; }
    AU.busy = ''; draw();
    if (AU.an && AU.aiAvail === null) { await loadAi(false); draw(); }
  }

  /* ---------------------------------------------------------------- yardımcılar */
  const selB = () => AU.an && AU.sel ? AU.an.blocks.find(b => b.id === AU.sel) : null;
  const startQ = b => { let q = 0; for (const x of AU.an.blocks) { if (x === b) return q; if (x.role === 'questions') q += auQn(x); } return q; };
  const BUB = () => AU.an.bubbles || [];
  const fmt = v => String(Math.round(v * 100) / 100).replace('.', ',');

  /* ---------------------------------------------------------------- tuval */
  function overlay(ctx, an, scale, opt) {
    opt = opt || {}; const k = opt.ui ? Math.max(1, AU.k) : Math.max(1, scale * 1.4);
    an.blocks.forEach(b => {
      const B = auBox(b, an), x0 = B.x0 * scale, y0 = B.y0 * scale, x1 = B.x1 * scale, y1 = B.y1 * scale, col = AU_COL[b.role] || '#888', on = b.id === AU.sel, bw = b.bw || an.bsz.w, bh = b.bh || an.bsz.h;
      ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = (on ? 4 : 2.2) * k; if (b.role === 'ignore') ctx.setLineDash([8 * k, 6 * k]);
      ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
      if (on && !opt.noDots) {
        const miss = new Set((b.missing || []).map(m => m[0] * 100000 + m[1])); ctx.lineWidth = 1.4 * k;
        b.ys.forEach((y, r) => b.xs.forEach((x, c) => { ctx.strokeStyle = miss.has(r * 100000 + c) ? '#ef4444' : col; ctx.beginPath(); ctx.ellipse(x * scale, y * scale, bw / 2 * scale, bh / 2 * scale, 0, 0, 7); ctx.stroke(); }));
      }
      ctx.restore();
      const label = `${b.id} ${AU_SHORT[b.role]}${b.name ? ' · ' + b.name : ''}${b.manual ? ' ✎' : ''}`, fs = opt.ui ? Math.round(12.5 * k) : Math.max(11, Math.round(15 * Math.max(1, scale * 1.3)));
      ctx.font = `600 ${fs}px sans-serif`; const tw = ctx.measureText(label).width + 10, ty = opt.below ? y1 + 1 : Math.max(0, y0 - fs - 4);
      ctx.fillStyle = col; ctx.fillRect(x0, ty, tw, fs + 4); ctx.fillStyle = '#fff'; ctx.textBaseline = 'top'; ctx.fillText(label, x0 + 5, ty + 2);
    });
  }
  const HANDLES = { nw: ['left', 'top'], n: [null, 'top'], ne: ['right', 'top'], e: ['right', null], se: ['right', 'bottom'], s: [null, 'bottom'], sw: ['left', 'bottom'], w: ['left', null] };
  const handlePos = (B, k) => { const mx = (B.x0 + B.x1) / 2, my = (B.y0 + B.y1) / 2; return { nw: [B.x0, B.y0], n: [mx, B.y0], ne: [B.x1, B.y0], e: [B.x1, my], se: [B.x1, B.y1], s: [mx, B.y1], sw: [B.x0, B.y1], w: [B.x0, my] }[k]; };
  const CURSORS = { nw: 'nwse-resize', se: 'nwse-resize', ne: 'nesw-resize', sw: 'nesw-resize', n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize' };
  /** Tuvale çizilen düzenleme katmanı: kapsanmayan baloncuklar, seçili bloğun harf/rakam/soru numaraları, tutamaçlar, bölme kılavuzu, çizilen dikdörtgen. */
  function overlayUi(ctx, an) {
    const k = Math.max(0.5, AU.k), lw = Math.max(1, k), b = selB();
    if (AU.showUncov && BUB().length) {
      const boxes = an.blocks.map(x => auBox(x, an)); ctx.save(); ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 1.5 * lw; ctx.setLineDash([3 * lw, 3 * lw]);
      BUB().forEach(q => { if (boxes.some(B => q.cx >= B.x0 && q.cx <= B.x1 && q.cy >= B.y0 && q.cy <= B.y1)) return; ctx.beginPath(); ctx.ellipse(q.cx, q.cy, q.bw / 2, q.bh / 2, 0, 0, 7); ctx.stroke(); });
      ctx.restore();
    }
    if (b) {
      const col = AU_COL[b.role] || '#888', labs = OMRDetect.labelsOf(b), ax = OMRDetect.labelAxis(b), bw = b.bw || an.bsz.w, bh = b.bh || an.bsz.h, fs = Math.max(8, Math.min(bh * 0.55, bw * 0.7));
      ctx.save(); ctx.font = `700 ${fs}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(2, fs * 0.28); ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.fillStyle = col;
      b.ys.forEach((y, r) => b.xs.forEach((x, c) => { const t = String(labs[ax === 'row' ? c : r] == null ? '' : labs[ax === 'row' ? c : r]); ctx.strokeText(t, x, y + fs * 0.05); ctx.fillText(t, x, y + fs * 0.05); }));
      // numaralar: soru bloğunda soru numarası, rakam/harf alanında hane numarası
      const num = b.role === 'questions' ? startQ(b) : 0, f2 = Math.max(8, fs * 0.8); ctx.font = `600 ${f2}px sans-serif`; ctx.lineWidth = Math.max(2, f2 * 0.3); ctx.fillStyle = b.role === 'questions' ? '#111' : '#475569';
      if (b.role !== 'ignore' && b.role !== 'booklet') {
        const per = b.role === 'questions' ? b.axis : (b.axis === 'row' ? 'row' : 'col');   // numara hangi eksende: 'row' = her satıra, 'col' = her sütuna
        if (per === 'row') { ctx.textAlign = 'right'; b.ys.forEach((y, r) => { const t = String(num + r + 1); ctx.strokeText(t, b.x0 - bw / 2 - 5, y); ctx.fillText(t, b.x0 - bw / 2 - 5, y); }); }
        else { ctx.textAlign = 'center'; b.xs.forEach((x, c) => { const t = String(num + c + 1); ctx.strokeText(t, x, b.y0 - bh / 2 - f2 * 0.8); ctx.fillText(t, x, b.y0 - bh / 2 - f2 * 0.8); }); }
      }
      ctx.restore();
      const B = auBox(b, an), hs = 5.5 * k; ctx.save(); ctx.fillStyle = '#fff'; ctx.strokeStyle = col; ctx.lineWidth = 1.6 * lw;
      Object.keys(HANDLES).forEach(n => { const [x, y] = handlePos(B, n); ctx.beginPath(); ctx.rect(x - hs, y - hs, 2 * hs, 2 * hs); ctx.fill(); ctx.stroke(); }); ctx.restore();
    }
    if (AU.hover && (AU.tool === 'splitH' || AU.tool === 'splitV')) {
      const t = hitBlock(AU.hover) || b; if (t) {
        const dir = AU.tool === 'splitH' ? 'row' : 'col', n = OMRDetect.splitIndexAt(t, dir, dir === 'row' ? AU.hover.y : AU.hover.x), total = dir === 'row' ? t.rows : t.cols;
        if (n >= 1 && n < total) {
          const a = dir === 'row' ? t.ys : t.xs, pos = (a[n - 1] + a[n]) / 2, B = auBox(t, an); ctx.save(); ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 2.5 * lw; ctx.setLineDash([8 * lw, 5 * lw]); ctx.beginPath();
          if (dir === 'row') { ctx.moveTo(B.x0 - 6 * k, pos); ctx.lineTo(B.x1 + 6 * k, pos); } else { ctx.moveTo(pos, B.y0 - 6 * k); ctx.lineTo(pos, B.y1 + 6 * k); }
          ctx.stroke(); ctx.setLineDash([]); ctx.font = `700 ${Math.round(12 * k)}px sans-serif`; ctx.fillStyle = '#ef4444'; ctx.textBaseline = 'bottom'; ctx.fillText(`${n}. ${dir === 'row' ? 'satırdan' : 'sütundan'} sonra böl`, dir === 'row' ? B.x0 : pos + 4 * k, dir === 'row' ? pos - 3 * k : B.y0 - 2 * k); ctx.restore();
        }
      }
    }
    const d = AU.drag; if (d && d.kind === 'rect') { ctx.save(); ctx.strokeStyle = '#2563eb'; ctx.fillStyle = 'rgba(37,99,235,.12)'; ctx.lineWidth = 2.5 * lw; ctx.setLineDash([8 * lw, 5 * lw]); const x = Math.min(d.x0, d.x1), y = Math.min(d.y0, d.y1), w = Math.abs(d.x1 - d.x0), hh = Math.abs(d.y1 - d.y0); ctx.fillRect(x, y, w, hh); ctx.strokeRect(x, y, w, hh); ctx.restore(); }
  }
  function paint() {
    if (!cv || !AU.an) return; const an = AU.an, r = an.rectified;
    if (!base || base.w !== r.w || base.src !== r.gray) { const c = document.createElement('canvas'); c.width = r.w; c.height = r.h; const x = c.getContext('2d'), id = x.createImageData(r.w, r.h), d = id.data, g = r.gray; for (let i = 0, j = 0; i < g.length; i++, j += 4) { d[j] = d[j + 1] = d[j + 2] = g[i]; d[j + 3] = 255; } x.putImageData(id, 0, 0); base = { c, w: r.w, src: r.gray }; }
    if (cv.width !== r.w || cv.height !== r.h) { cv.width = r.w; cv.height = r.h; }
    const bb = cv.getBoundingClientRect(); AU.k = bb.width ? r.w / bb.width : 1;
    const cx = cv.getContext('2d'); cx.drawImage(base.c, 0, 0); overlay(cx, an, 1, { ui: true }); overlayUi(cx, an);
  }
  const paintNow = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; paint(); }); };
  /** Yapay zekâya gidecek görüntü: düzeltilmiş form + blok kimlikleri (uzun kenar ≤ 1568 px) */
  function overlayJpeg() {
    const an = AU.an, r = an.rectified, sc = Math.min(1, 1568 / Math.max(r.w, r.h)), c = document.createElement('canvas'); c.width = Math.round(r.w * sc); c.height = Math.round(r.h * sc);
    const x = c.getContext('2d'); if (!base) paint(); x.drawImage(base.c, 0, 0, c.width, c.height); const keep = AU.sel; AU.sel = ''; overlay(x, an, sc, { noDots: true, below: true }); AU.sel = keep;
    return c.toDataURL('image/jpeg', 0.82).split(',')[1];
  }
  const toCv = e => { const b = cv.getBoundingClientRect(), s = cv.width / b.width; return { x: (e.clientX - b.left) * s, y: (e.clientY - b.top) * s }; };
  /** Noktayı içeren en küçük blok (iç içe/üst üste bloklarda küçük olan öncelikli). */
  function hitBlock(p) {
    const an = AU.an; return an.blocks.filter(k => auInBox(auBox(k, an), p)).sort((a, c) => (a.rows * a.cols) - (c.rows * c.cols))[0] || null;
  }
  function hitHandle(b, p) {
    const B = auBox(b, AU.an), R = 11 * Math.max(0.5, AU.k); let best = null, bd = 1e9;
    Object.keys(HANDLES).forEach(n => { const [x, y] = handlePos(B, n), d = Math.max(Math.abs(p.x - x), Math.abs(p.y - y)); if (d <= R && d < bd) { bd = d; best = n; } });
    return best;
  }
  function select(id, scroll) {
    AU.sel = id; rows.forEach((el, k) => el.classList.toggle('sel', k === id)); paint(); renderEdit();
    if (scroll && id && rows.get(id)) rows.get(id).scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  /* ---------------------------------------------------------------- geçmiş (geri al / yinele) ve düzenleme çekirdeği */
  const snapshot = () => JSON.stringify({ blocks: AU.an.blocks, order: !!AU.an.keepOrder, sel: AU.sel });
  function restore(s) { const o = JSON.parse(s); AU.an.blocks = o.blocks; AU.an.keepOrder = o.order; AU.sel = AU.an.blocks.some(b => b.id === o.sel) ? o.sel : ''; refresh(); }
  function undo() { if (!AU.hist.length) return toast('Geri alınacak işlem yok.'); AU.fut.push(snapshot()); restore(AU.hist.pop()); lastKey = ''; }
  function redo() { if (!AU.fut.length) return toast('Yinelenecek işlem yok.'); AU.hist.push(snapshot()); restore(AU.fut.pop()); lastKey = ''; }
  function commit(before) { AU.hist.push(before); if (AU.hist.length > 80) AU.hist.shift(); AU.fut = []; AU.edited = true; }
  /** Bir düzenleme yapar: fn() false dönerse hiçbir şey değişmemiş sayılır. key aynıysa ve 1,5 sn içindeyse tek geri alma adımı olarak birleşir. */
  function edit(key, fn, opts) {
    opts = opts || {}; const before = snapshot(), res = fn(); if (res === false) return false;
    const now = Date.now(); if (!(key && key === lastKey && now - lastAt < 1500)) commit(before); else { AU.fut = []; AU.edited = true; }
    lastKey = key || ''; lastAt = now; if (opts.structural) AU.aiSnap = null; refresh(); return true;
  }
  /** Yapı değişikliği (böl/birleştir/ekle/sil/sıra): sıralamayı düzenle, kimlikleri yeniden ver, `pick` bloğunu seç. */
  function structural(fn, msg) {
    return edit(null, () => { const pick = fn(); if (pick === false) return false; OMRDetect.tidy(AU.an.blocks, { keepOrder: !!AU.an.keepOrder }); AU.sel = pick && pick.id ? pick.id : ''; if (msg) toast(msg, 'ok'); return true; }, { structural: true });
  }
  function refresh() { if (!AU.an) return; renderList(); renderEdit(); drawSummary(); drawBar(); paint(); }

  /* ---------------------------------------------------------------- blok işlemleri */
  const nudge = (dx, dy) => { const b = selB(); if (!b) return toast('Önce bir blok seçin.'); edit('mv:' + b.id, () => { OMRDetect.moveBlock(b, dx, dy, BUB()); }); };
  function edgeOp(edge, kind, out) {
    const b = selB(); if (!b) return toast('Önce bir blok seçin.');
    if (kind === 'px') { const ok = edit('ed:' + b.id + edge, () => OMRDetect.stretchEdge(b, edge, (out ? 1 : -1) * AU.step, BUB())); if (!ok) toast('Bu kenar bu yönde ayarlanamadı (tek satır/sütunlu blok ya da baloncuklar çok sıkışırdı). "Satır/sütun ekle" veya "çıkar" düğmesini kullanın.', 'bad', 6000); }
    else edit('ln:' + b.id + edge, () => { OMRDetect.addLines(b, edge, out ? 1 : -1, { bubbles: BUB(), pitch: AU.an.pitch }); });
  }
  function setCounts(b, nq, nk) {
    const rows0 = b.axis === 'row' ? nq : nk, cols0 = b.axis === 'row' ? nk : nq;
    edit('cnt:' + b.id, () => { OMRDetect.setGrid(b, rows0, cols0, { bubbles: BUB(), pitch: AU.an.pitch }); });
  }
  function snapOne() {
    const b = selB(); if (!b) return; let st = null;
    if (!BUB().length) return toast('Bu formda otomatik bulunan baloncuk yok.', 'bad');
    edit(null, () => { st = OMRDetect.snapBlock(b, BUB()); });
    if (st) toast(st.after === st.total ? `Tüm baloncuklara oturdu (${st.total}/${st.total}).` : `${st.after}/${st.total} baloncuğa oturdu; kalanlar için konumu elle ayarlayın ya da satır/sütun sayısını düzeltin.`, st.after >= 0.9 * st.total ? 'ok' : 'bad', 5000);
  }
  function regrid() {
    const b = selB(); if (!b) return;
    const ok = edit(null, () => OMRDetect.regridBlock(b, BUB()), { structural: false });
    toast(ok ? `Dikdörtgenin içindeki baloncuklar yeniden sayıldı: ${b.rows} satır × ${b.cols} sütun.` : 'Dikdörtgenin içinde yeterli baloncuk bulunamadı; satır/sütun sayısını elle yazın.', ok ? 'ok' : 'bad', 5000);
  }
  function delBlock(b) { structural(() => { AU.an.blocks.splice(AU.an.blocks.indexOf(b), 1); return null; }, `${b.id} silindi (Geri al ile döner).`); }
  function orderMove(b, d) {
    const i = AU.an.blocks.indexOf(b), j = i + d; if (j < 0 || j >= AU.an.blocks.length) return;
    structural(() => { AU.an.keepOrder = true; const a = AU.an.blocks; [a[i], a[j]] = [a[j], a[i]]; return b; });
  }
  function resetOrder() { structural(() => { AU.an.keepOrder = false; return selB(); }, 'Bloklar yeniden okuma sırasına (soldan sağa sütunlar, yukarıdan aşağı) dizildi.'); }
  function splitDlg(b) {
    const defRow = b.rows >= 2, dir = h('select', { id: 'au-split-dir' }, b.rows >= 2 ? h('option', { value: 'row' }, 'Satırdan böl (alt alta iki bölüm)') : null, b.cols >= 2 ? h('option', { value: 'col' }, 'Sütundan böl (yan yana iki bölüm)') : null);
    if (!defRow) dir.value = 'col';
    const n = h('input', { type: 'number', min: 1, id: 'au-split-n', style: { width: '90px' } }), info = h('div', { class: 'small muted' });
    const sync = reset => { const d = dir.value, total = d === 'row' ? b.rows : b.cols; n.max = total - 1; if (reset) n.value = OMRDetect.suggestSplit(b, d) || Math.floor(total / 2); info.textContent = `${total} ${d === 'row' ? 'satır' : 'sütun'} var. İlk ${n.value} ${d === 'row' ? 'satır' : 'sütun'} bir bölüm, kalanı öbür bölüm olur. Başlangıç değeri, kafesteki en geniş boşluktan önerilmiştir; tuvalde de "Yatay böl / Dikey böl" araçlarıyla tıklayarak bölebilirsiniz.`; };
    dir.onchange = () => sync(true); n.oninput = () => sync(false); sync(true);
    modal('Bloğu böl', h('div', null, h('p', null, `${b.id}: ${b.rows} satır × ${b.cols} sütun. Tek blok olarak görünen iki bölümü ayırın.`), h('div', { class: 'field' }, h('label', null, 'Yön'), dir), h('div', { class: 'row', style: { marginTop: '.5rem' } }, h('label', null, 'Kaçıncıdan SONRA:'), n), info), { buttons: [{ label: 'Vazgeç' }, { label: 'Böl', cls: 'primary', fn: () => {
      const d = dir.value, total = d === 'row' ? b.rows : b.cols, k = parseInt(n.value); if (!(k >= 1 && k < total)) { toast(`1 ile ${total - 1} arası bir sayı girin`, 'bad'); return false; }
      let a = null; if (!structural(() => { if (!OMRDetect.splitBlock(AU.an.blocks, b.id, k, d, true)) return false; a = AU.an.blocks.find(x => x.id === b.id + 'a'); return a; }, 'Blok ikiye bölündü. Her parçanın türünü sağdan kontrol edin.')) { toast('Bu blok bölünemedi.', 'bad'); return false; }
    } }] });
  }
  function splitAt(t, dir, p) {
    const n = OMRDetect.splitIndexAt(t, dir, dir === 'row' ? p.y : p.x), total = dir === 'row' ? t.rows : t.cols; if (!(n >= 1 && n < total)) return toast('Çizgiyi bloğun içinde, iki satır/sütun arasına koyun.', 'bad');
    setTool(''); structural(() => { if (!OMRDetect.splitBlock(AU.an.blocks, t.id, n, dir, true)) return false; return AU.an.blocks.find(x => x.id === t.id + 'a'); }, `${t.id} ${n}. ${dir === 'row' ? 'satırdan' : 'sütundan'} sonra bölündü.`);
  }
  function mergeDlg(b) {
    const others = AU.an.blocks.filter(x => x !== b), cand = others.map(x => ({ x, r: OMRDetect.mergeBlocks(b, x, BUB()) })), first = cand.find(c => c.r.ok);
    if (!others.length) return toast('Birleştirilecek başka blok yok.', 'bad');
    const sel = h('select', { id: 'au-merge-with' }, cand.map(c => h('option', { value: c.x.id }, `${c.x.id} · ${AU_SHORT[c.x.role]} · ${c.x.rows}×${c.x.cols}${c.r.ok ? '' : ' (birleşmez)'}`))); if (first) sel.value = first.x.id;
    modal('Blokları birleştir', h('div', null, h('p', null, `${b.id} (${b.rows}×${b.cols}) ile seçeceğiniz bloğu tek bloğa çevirin. Alt alta birleştirmek için sütunları, yan yana birleştirmek için satırları aynı hizada olmalı. Olmazsa önce konumu/sayıyı eşitleyin.`), h('div', { class: 'field' }, h('label', null, 'Birleştirilecek blok'), sel)), { buttons: [{ label: 'Vazgeç' }, { label: 'Birleştir', cls: 'primary', fn: () => {
      const o = AU.an.blocks.find(x => x.id === sel.value), r = o && OMRDetect.mergeBlocks(b, o, BUB()); if (!r || !r.ok) { toast((r && r.error) || 'Birleştirilemedi.', 'bad', 7000); return false; }
      structural(() => { const A = AU.an.blocks; A[A.indexOf(b)] = r.block; A.splice(A.indexOf(o), 1); return r.block; }, `Birleştirildi: ${r.block.rows} satır × ${r.block.cols} sütun.`);
    } }] });
  }
  /** Yeni blok ekler; rol tahmin edilir, kullanıcı sağdan düzeltir. */
  function addBlock(blk, how) {
    structural(() => { const used = AU.an.blocks.filter(x => x.role !== 'ignore'); blk.role = auGuessRole(blk, used); blk.axis = auAxis(blk, blk.role); blk.manual = true; AU.an.blocks.push(blk); return blk; },
      `Bölüm eklendi (${blk.rows} satır × ${blk.cols} sütun${how ? ', ' + how : ''}). Türünü sağdan kontrol edin.`);
    const nb = AU.an.blocks.find(x => x.id === AU.sel); if (nb) { renderEdit(); rows.get(nb.id) && rows.get(nb.id).scrollIntoView({ block: 'nearest' }); }
  }
  function gridDlg(rect, why) {
    const nr = h('input', { type: 'number', min: 1, max: 400, value: 10, id: 'au-g-rows', style: { width: '90px' } }), nc = h('input', { type: 'number', min: 1, max: 400, value: 5, id: 'au-g-cols', style: { width: '90px' } });
    modal('Elle ızgara oluştur', h('div', null, h('p', null, why || 'Bu dikdörtgenin içinde baloncuk bulunamadı (baskı silik olabilir).'), h('p', null, 'Satır ve sütun sayısını yazın; baloncuklar dikdörtgene eşit aralıkla yerleştirilir. Sonra konumu milim milim ayarlayabilirsiniz.'), h('div', { class: 'row' }, h('label', null, 'Satır:'), nr, h('label', null, 'Sütun:'), nc)), { buttons: [{ label: 'Vazgeç' }, { label: 'Oluştur', cls: 'primary', fn: () => {
      const r = OMRDetect.blockFromRect(BUB(), rect, { grid: true, rows: parseInt(nr.value), cols: parseInt(nc.value), bw: AU.an.bsz.w, bh: AU.an.bsz.h }); if (!r.ok) { toast(r.error, 'bad'); return false; } addBlock(r.block, 'elle ızgara');
    } }] });
  }
  function finishRect(d) {
    const rect = { x0: Math.min(d.x0, d.x1), y0: Math.min(d.y0, d.y1), x1: Math.max(d.x0, d.x1), y1: Math.max(d.y0, d.y1) }; setTool('');
    if (rect.x1 - rect.x0 < 10 * AU.k || rect.y1 - rect.y0 < 10 * AU.k) return toast('Dikdörtgen çok küçük: bölümün tamamını çevreleyecek şekilde sürükleyin.', 'bad');
    const r = OMRDetect.blockFromRect(BUB(), rect, {}); if (r.ok) addBlock(r.block, 'baloncuklardan'); else gridDlg(rect, r.error);
  }
  function setTool(t) {
    AU.tool = AU.tool === t ? '' : t; AU.hover = null; AU.drag = null; if (cv) cv.style.cursor = AU.tool ? 'crosshair' : ''; drawBar(); paint();
    if (AU.tool === 'add') toast('Eklenecek bölümün çevresine, tuvalde sol üstten sağ alta doğru dikdörtgen çizin.', '', 5000);
    if (AU.tool === 'splitH' || AU.tool === 'splitV') toast(AU.tool === 'splitH' ? 'Bölmek istediğiniz yere (iki satır arasına) tuvalde tıklayın.' : 'Bölmek istediğiniz yere (iki sütun arasına) tuvalde tıklayın.', '', 5000);
  }
  function setZoom(z, focus) {
    AU.zoom = Math.max(1, Math.min(8, z)); if (!cv) return; cv.style.width = (AU.zoom * 100) + '%'; paint(); drawBar(); if (focus) focusSel();
  }
  function focusSel() {
    const b = selB(); if (!b || !cv) return; const wrap = cv.parentElement, B = auBox(b, AU.an), per = cv.clientWidth / cv.width;
    wrap.scrollLeft = ((B.x0 + B.x1) / 2) * per - wrap.clientWidth / 2; wrap.scrollTop = ((B.y0 + B.y1) / 2) * per - wrap.clientHeight / 2;
  }
  function fitSel() {
    const b = selB(); if (!b || !cv) return toast('Önce yakınlaştırılacak bloğu seçin.'); const wrap = cv.parentElement, B = auBox(b, AU.an), baseW = wrap.clientWidth / cv.width;
    setZoom(0.85 * Math.min(wrap.clientWidth / (B.x1 - B.x0), wrap.clientHeight / (B.y1 - B.y0)) / baseW, true);
  }

  /* ---------------------------------------------------------------- tuvalde işaretçi: seç, taşı, kenardan çek, çiz */
  function onDown(e) {
    if (!AU.an || (e.button != null && e.button > 0)) return; const p = toCv(e), b = selB();
    if (AU.tool === 'add') { AU.drag = { kind: 'rect', x0: p.x, y0: p.y, x1: p.x, y1: p.y }; cv.setPointerCapture(e.pointerId); e.preventDefault(); return; }
    if (AU.tool === 'splitH' || AU.tool === 'splitV') { const t = hitBlock(p) || b; if (!t) return toast('Bölünecek bloğun üstüne tıklayın.', 'bad'); splitAt(t, AU.tool === 'splitH' ? 'row' : 'col', p); e.preventDefault(); return; }
    let kind = null, handle = null, target = b;
    if (b) { handle = hitHandle(b, p); if (handle) kind = 'edge'; else if (auInBox(auBox(b, AU.an), p)) kind = 'move'; }
    if (!kind) { const t = hitBlock(p); if (!t) { if (AU.sel) select(''); return; } target = t; kind = 'move'; if (t.id !== AU.sel) select(t.id, true); }
    AU.drag = { kind, handle, b: target, start: p, xs: target.xs.slice(), ys: target.ys.slice(), before: snapshot(), moved: false, shift: e.shiftKey };
    cv.setPointerCapture(e.pointerId); e.preventDefault();
  }
  function onMove(e) {
    if (!AU.an) return; const p = toCv(e), d = AU.drag;
    if (!d) {
      if (AU.tool === 'splitH' || AU.tool === 'splitV') { AU.hover = p; paintNow(); return; }
      const b = selB(); let cur = AU.tool ? 'crosshair' : ''; if (!AU.tool && b) { const hh = hitHandle(b, p); cur = hh ? CURSORS[hh] : auInBox(auBox(b, AU.an), p) ? 'move' : ''; } cv.style.cursor = cur; return;
    }
    if (d.kind === 'rect') { d.x1 = p.x; d.y1 = p.y; paintNow(); return; }
    const dx = p.x - d.start.x, dy = p.y - d.start.y; if (!d.moved && Math.hypot(dx, dy) / Math.max(0.5, AU.k) < 3) return; d.moved = true;
    const b = d.b; b.xs = d.xs.slice(); b.ys = d.ys.slice(); OMRDetect.refit(b, BUB());
    if (d.kind === 'move') OMRDetect.moveBlock(b, dx, dy, BUB());
    else {
      const [ex, ey] = HANDLES[d.handle], gap = a => a.length > 1 ? (a[a.length - 1] - a[0]) / (a.length - 1) : 1.6 * (b.bw || AU.an.bsz.w);
      [[ex, ex === 'left' ? -dx : dx, gap(d.xs)], [ey, ey === 'top' ? -dy : dy, gap(d.ys)]].forEach(([edge, out, pitch]) => {
        if (!edge) return; if (d.shift) { const n = Math.round(out / pitch); if (n) OMRDetect.addLines(b, edge, n, { bubbles: BUB(), pitch }); } else OMRDetect.stretchEdge(b, edge, out, BUB());
      });
      b.manual = true;
    }
    paintNow();
  }
  function onUp(e) {
    const d = AU.drag; if (!d) return; AU.drag = null; try { cv.releasePointerCapture(e.pointerId); } catch (x) { }
    if (d.kind === 'rect') { finishRect(d); return; }
    if (!d.moved) { paint(); return; }
    if (AU.autosnap && !d.shift && BUB().length) OMRDetect.snapBlock(d.b, BUB());
    d.b.manual = true; commit(d.before); lastKey = ''; AU.aiSnap = d.shift ? null : AU.aiSnap; refresh();
  }
  function onCancel() { const d = AU.drag; AU.drag = null; if (d && d.b && d.xs) { d.b.xs = d.xs; d.b.ys = d.ys; OMRDetect.refit(d.b, BUB()); } paint(); }
  function onTouchStart(e) {   // dokunmatik: seçili bloğun üstünde sürükleme sayfayı kaydırmasın; boşlukta kaydırma serbest
    if (!AU.an || !e.touches[0]) return; const t = e.touches[0], p = toCv(t), b = selB();
    if (AU.tool || (b && (hitHandle(b, p) || auInBox(auBox(b, AU.an), p)))) e.preventDefault();
  }

  /* ---------------------------------------------------------------- klavye (tek dinleyici: dosyanın başında) */
  AU.api = {
    alive: () => !!(cv && document.body.contains(cv) && AU.an && !AU.busy),
    key: e => {
      const t = e.target, tag = t && t.tagName; if (/^(INPUT|TEXTAREA|SELECT)$/.test(tag) || (t && t.isContentEditable) || document.querySelector('.overlay')) return;
      const mod = e.ctrlKey || e.metaKey, kk = String(e.key).toLowerCase();
      if (mod && kk === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; } if (mod && kk === 'y') { e.preventDefault(); redo(); return; }
      if (e.key === 'Escape') { if (AU.tool) setTool(AU.tool); else if (AU.sel) select(''); return; }
      const b = selB(); if (!b) return;
      const st = AU.step * (e.shiftKey ? 5 : e.altKey ? 0.5 : 1), mv = { ArrowLeft: [-st, 0], ArrowRight: [st, 0], ArrowUp: [0, -st], ArrowDown: [0, st] }[e.key];
      if (mv && !mod) { e.preventDefault(); nudge(mv[0], mv[1]); return; }
      if (e.key === 'Delete') { e.preventDefault(); delBlock(b); }
    }
  };

  /* ---------------------------------------------------------------- doğrulama ve yapay zekâ */
  function problems() {
    const an = AU.an, used = an.blocks.filter(b => b.role !== 'ignore'), out = [];
    ['studentNo', 'schoolCode', 'booklet', 'name', 'surname'].forEach(r => { const n = used.filter(b => b.role === r).length; if (n > 1) out.push(`${n} blok "${AU_ROLES.find(x => x[0] === r)[1]}" seçilmiş; yalnızca ilki kullanılır. Fazlasını "Yok say" yapın.`); });
    if (!used.some(b => b.role === 'questions')) out.push('Soru bloğu yok.');
    if (used.some(b => b.role === 'surname') && !used.some(b => b.role === 'name')) out.push('Soyad ızgarası var ama ad ızgarası seçilmemiş; ad-soyad yan yana okunsun diye ilgili bloğu "Ad" olarak işaretleyin.');
    if (!used.some(b => b.role === 'studentNo')) out.push('Öğrenci numarası alanı seçilmemiş: okutulan formda öğrenci no okunmaz (numarayı elle girmeniz gerekir).');
    for (let i = 0; i < used.length; i++) for (let j = i + 1; j < used.length; j++) {   // üst üste binen bloklar
      const A = auBox(used[i], an), B = auBox(used[j], an), w = Math.min(A.x1, B.x1) - Math.max(A.x0, B.x0), hh = Math.min(A.y1, B.y1) - Math.max(A.y0, B.y0);
      if (w > 0 && hh > 0 && w * hh > 0.25 * Math.min((A.x1 - A.x0) * (A.y1 - A.y0), (B.x1 - B.x0) * (B.y1 - B.y0))) out.push(`${used[i].id} ve ${used[j].id} üst üste biniyor; biri fazla ya da yanlış bölünmüş olabilir (birleştirin, taşıyın veya silin).`);
    }
    if (BUB().length) used.forEach(b => { if (b.manual && b.fill < 0.6) out.push(`${b.id}: ızgaranın yalnızca %${Math.round(b.fill * 100)}'i gerçek baloncuklara denk geliyor. "Baloncuklara oturt" deneyin ya da konumu/sayıyı düzeltin (baskı silikse bu normal olabilir).`); });
    return out;
  }
  const letters = (b, k) => { const s = String(b.labels || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); return s.slice(0, k); };
  async function aiRun(btn) {
    const an = AU.an; btn.disabled = true; const old = btn.textContent; btn.textContent = 'Yapay zekâ inceliyor…';
    try {
      const r = await api('aiAnalyzeForm', { image: overlayJpeg(), mediaType: 'image/jpeg', provider: AU.aiPick.provider || undefined, tier: AU.aiPick.tier || undefined, blocks: an.blocks.map(b => ({ id: b.id, rows: b.rows, cols: b.cols, role: b.role, glyph: b.glyph })) }, { timeout: 150000 });
      AU.aiUsed = { name: r.providerName || r.provider || '', model: r.model || '', tier: r.tier || '', failed: (r.tried || []).filter(t => !t.ok).length };
      applyAi(r); draw();
    } catch (e) {
      if (e.code === 'AISCOPE') modal('Yapay zekâ için Apps Script izni gerekli', h('div', null, h('p', null, e.message), h('p', { class: 'small muted' }, 'Bu izin verilene kadar form tanıma yapay zekâsız (yalnızca görüntü işlemeyle) çalışmaya devam eder.')), { buttons: [{ label: 'Tamam', cls: 'primary' }] });
      else toast(e.code === 'NOAI' ? 'Yapay zekâ anahtarı tanımlı değil; tanıma yapay zekâsız devam eder.' : e.message, 'bad', 8000);
      btn.disabled = false; btn.textContent = old;
    }
  }
  /** Yapay zekâ yanıtını (sunucudan ya da elle yapıştırılan) bloklara uygular; geri alınabilir. Dönüş: değişen blok sayısı. */
  function applyAi(r) {
    const an = AU.an; AU.aiSnap = an.blocks.map(b => ({ id: b.id, role: b.role, axis: b.axis, name: b.name, labels: b.labels, ai: b.ai })); let n = 0;
    (r.blocks || []).forEach(s => {
      const b = an.blocks.find(x => x.id === s.id); if (!b) return; const ch = [], kept = [], lock = b.set || {};
      if (s.role && s.role !== b.role && AU_COL[s.role] && s.confidence >= 0.6) { if (lock.role) kept.push(`tür (${AU_SHORT[s.role] || s.role} önerildi)`); else { b.role = s.role; b.axis = auAxis(b, s.role); ch.push('rol'); } }
      if (b.role === 'questions' && s.name && String(s.name).trim() !== (b.name || '')) { if (lock.name) kept.push(`ders adı ("${String(s.name).slice(0, 20)}" önerildi)`); else { b.name = String(s.name).slice(0, 40); ch.push('ders adı'); } }
      if ((b.role === 'questions' || b.role === 'booklet') && s.labels && s.labels.length === auK(b) && /^[A-Z]+$/.test(s.labels) && s.labels !== letters(b, auK(b))) { if (lock.labels) kept.push(`harfler (${s.labels} önerildi)`); else { b.labels = s.labels; ch.push('harfler'); } }
      b.ai = { ch, kept, note: s.note || '', conf: s.confidence }; if (ch.length) n++;
    });
    if (r.title && !AU.name) AU.name = String(r.title).slice(0, 60); AU.aiNotes = (r.notes || []).slice(0, 6).map(x => String(x).slice(0, 200));
    const nk = (r.blocks || []).reduce((t, x) => { const b = an.blocks.find(y => y.id === x.id); return t + (b && b.ai && b.ai.kept ? b.ai.kept.length : 0); }, 0);
    toast((n ? `Yapay zekâ ${n} blok için öneri uyguladı. Kontrol edin.` : 'Yapay zekâ mevcut tahminlerle aynı görüşte.') + (nk ? ` Elle yaptığınız ${nk} ayar korundu.` : ''), 'ok'); return n;
  }
  function aiUndo() { if (!AU.aiSnap) return; AU.aiSnap.forEach(s => { const b = AU.an.blocks.find(x => x.id === s.id); if (b) { b.role = s.role; b.axis = s.axis; b.name = s.name; b.labels = s.labels; b.ai = s.ai; } }); AU.aiSnap = null; AU.aiNotes = []; AU.aiUsed = null; draw(); }
  /* ---------------------------------------------------------------- API'siz yapay zekâ: görüntü + hazır istem → herhangi bir (ücretsiz) sohbet uygulaması → JSON yanıtını geri yapıştır */
  const AI_ROLE_TXT = '"questions" (answer bubbles for numbered questions), "studentNo" (digit columns for the student number), "schoolCode" (digit columns for a school/institution code), "booklet" (choose booklet type A/B/C/D), "name" (letter grid where the student FIRST NAME is coded: one column per letter position, one row per alphabet letter), "surname" (the same for the SURNAME), "ignore" (anything else, e.g. printed letters or a sample)';
  function aiPromptText() {
    const an = AU.an, list = an.blocks.map(b => `${b.id}: ${b.rows} rows x ${b.cols} columns (my current guess: ${b.role})`).join('\n');
    return 'You are given a scan or photo of a BLANK optical answer sheet (OMR form) used in Turkish school exams (LGS, TYT, AYT, school and publisher trial exams). It may be printed in black, blue, pink or purple ink.\n' +
      'Image processing software has already located every bubble block. Each block is outlined in colour and labelled with an id such as b1, b2 (the label sits at the outline\'s top-left or bottom-left corner). You do NOT locate anything. Thin timing bars along the sheet edges are not blocks.\n\nBlocks found:\n' + list + '\n\n' +
      'For every id decide its meaning from what is printed on the sheet. Never invent what you cannot read; use an empty string and say so in "note".\nRoles: ' + AI_ROLE_TXT + '.\n' +
      'For "questions": name = the printed lesson/section heading of that block (e.g. "TÜRKÇE"), labels = the printed choice letters in order (e.g. "ABCDE"), startNo = the first printed question number. For digit blocks labels = "0123456789" unless printed differently. For booklet blocks labels = the printed booklet letters. For name/surname blocks leave labels empty.\n' +
      'Reply with ONLY one JSON object, no explanation and no code fence: {"title":string,"blocks":[{"id":string,"role":string,"name":string,"labels":string,"startNo":number|null,"confidence":number,"note":string}],"notes":[string]}';
  }
  /** Elle yapıştırılan yanıtı (kod çiti, açıklama vb. olabilir) doğrulayıp applyAi biçimine çevirir. */
  function parseAiPaste(text) {
    const t = String(text || ''), a = t.indexOf('{'), z = t.lastIndexOf('}'); if (a < 0 || z <= a) throw new Error('Yanıtta JSON bulunamadı. Sohbet uygulamasının verdiği { ile başlayan bloğu eksiksiz yapıştırın.');
    let o; try { o = JSON.parse(t.slice(a, z + 1)); } catch (e) { throw new Error('JSON okunamadı (' + e.message + '). Yanıtın tamamını, başındaki { ve sonundaki } dahil yapıştırdığınızdan emin olun.'); }
    const arr = Array.isArray(o.blocks) ? o.blocks : Array.isArray(o) ? o : null; if (!arr) throw new Error('Yanıtta "blocks" listesi yok.');
    const ids = new Set(AU.an.blocks.map(b => b.id)), blocks = [], unknown = [];
    arr.forEach(x => {
      if (!x || typeof x.id !== 'string') return; if (!ids.has(x.id)) { unknown.push(x.id); return; }
      let c = Number(x.confidence); if (!isFinite(c)) c = 0.8; if (c > 1) c = c / 100;
      blocks.push({ id: x.id, role: AU_COL[x.role] ? x.role : '', name: String(x.name == null ? '' : x.name).slice(0, 40), labels: String(x.labels == null ? '' : x.labels).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12), confidence: c, note: String(x.note || '').slice(0, 160) });
    });
    if (!blocks.length) throw new Error('Yanıttaki kimliklerin hiçbiri bu formdaki bloklarla eşleşmedi (' + (unknown.slice(0, 4).join(', ') || 'boş liste') + '). Görüntüdeki b1, b2… etiketlerini kullanması gerekir.');
    return { blocks, title: typeof o.title === 'string' ? o.title : '', notes: (Array.isArray(o.notes) ? o.notes : []).map(String), unknown };
  }
  async function copyText(txt, ta) {
    try { await navigator.clipboard.writeText(txt); return true; } catch (e) { }
    try { ta.focus(); ta.select(); return document.execCommand('copy'); } catch (e) { return false; }
  }
  function aiManualDlg() {
    const b64 = overlayJpeg(), url = 'data:image/jpeg;base64,' + b64, prompt = aiPromptText();
    const ta = h('textarea', { id: 'au-ai-prompt', rows: 6, readonly: true, spellcheck: false, style: { width: '100%', fontSize: '.78rem' }, onclick: e => e.target.select() }, prompt), paste = h('textarea', { id: 'au-ai-paste', rows: 6, placeholder: 'Sohbet uygulamasının verdiği JSON yanıtını buraya yapıştırın…', spellcheck: false, style: { width: '100%', fontSize: '.8rem' } });
    const blob = () => { const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new Blob([u], { type: 'image/jpeg' }); };
    const copyImg = async () => {
      try { const im = new Image(); await new Promise((res, rej) => { im.onload = res; im.onerror = rej; im.src = url; }); const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight; c.getContext('2d').drawImage(im, 0, 0); const png = await new Promise(r => c.toBlob(r, 'image/png')); await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]); toast('Görüntü panoya kopyalandı. Sohbet kutusuna Ctrl+V ile yapıştırın.', 'ok'); }
      catch (e) { toast('Bu tarayıcı görüntüyü panoya kopyalayamadı; "Görüntüyü indir"i kullanıp sohbet uygulamasına dosya olarak yükleyin.', 'bad', 7000); }
    };
    modal('API anahtarı olmadan yapay zekâ', h('div', { id: 'au-ai-manual' },
      h('p', { class: 'small' }, 'Ücretsiz bir sohbet uygulaması (Gemini, ChatGPT, Claude, Copilot, Le Chat…) görüntü yüklemeyi destekliyorsa API anahtarına gerek kalmaz. Yalnızca BOŞ form görüntüsü ve blok listesi gider; öğrenci bilgisi yoktur.'),
      h('div', { class: 'au-step' }, h('b', null, '1. Görüntü'), h('div', { class: 'row', style: { marginTop: '.3rem', alignItems: 'flex-start' } }, h('img', { src: url, alt: 'Bloklar numaralı form', style: { maxHeight: '170px', maxWidth: '45%', border: '1px solid var(--line)', borderRadius: '6px' } }),
        h('div', { class: 'row', style: { flexDirection: 'column', alignItems: 'stretch', gap: '.3rem' } }, h('button', { class: 'btn sm', id: 'au-ai-dl', onclick: () => download('form-bloklari.jpg', blob()) }, 'Görüntüyü indir'), h('button', { class: 'btn sm', id: 'au-ai-copyimg', onclick: copyImg }, 'Görüntüyü kopyala')))),
      h('div', { class: 'au-step' }, h('b', null, '2. İstem'), h('div', { class: 'small muted' }, 'Sohbete önce görüntüyü, sonra bu metni gönderin (istem İngilizcedir; yanıtın dili önemli değil).'), ta, h('button', { class: 'btn sm', id: 'au-ai-copyprompt', style: { marginTop: '.3rem' }, onclick: async () => toast(await copyText(prompt, ta) ? 'İstem kopyalandı.' : 'Kopyalanamadı: metne tıklayıp Ctrl+C yapın.', 'ok') }, 'İstemi kopyala')),
      h('div', { class: 'au-step' }, h('b', null, '3. Yanıt'), h('div', { class: 'small muted' }, 'Yanıt { ile başlayan tek bir JSON olmalı. Kod çiti ya da açıklama olsa da sorun değil; bulunup okunur. Uygulamadan sonra "Önerileri geri al" ile dönebilirsiniz.'), paste)),
    { buttons: [{ label: 'Vazgeç' }, { label: 'Yanıtı uygula', cls: 'primary', fn: () => {
      let r; try { r = parseAiPaste(paste.value); } catch (e) { toast(e.message, 'bad', 8000); return false; }
      AU.aiUsed = { name: 'Elle (sohbet uygulaması)', model: '', tier: '', failed: 0 }; applyAi(r); if (r.unknown.length) toast('Şu kimlikler formda yok, atlandı: ' + r.unknown.slice(0, 5).join(', '), 'bad', 6000); draw();
    } }] });
  }
  /** Seçime göre kullanılacak sağlayıcı ve (tahmini) model: sunucunun yaptığı en yeni model keşfi sonucu. */
  function aiPlanText() {
    const st = AU.ai; if (!st || !st.available) return '';
    const ok = (st.providers || []).filter(x => x.ok), P = ok.find(x => x.id === (AU.aiPick.provider || st.primary)) || ok[0]; if (!P) return '';
    const tier = AU.aiPick.tier || st.tier || 'balanced', m = P.manualModel || (P.models && (P.models[tier === 'auto' ? 'balanced' : tier] || P.models.balanced || P.models.best || P.models.fast)) || '';
    return `${P.name}${m ? ' · ' + m : ''}`;
  }
  function aiPicker() {
    const st = AU.ai, ok = ((st && st.providers) || []).filter(x => x.ok); if (!st || !st.available) return null;
    const ps = h('select', { id: 'au-ai-prov', 'aria-label': 'Yapay zekâ sağlayıcısı', onchange: e => { AU.aiPick.provider = e.target.value; draw(); } }, h('option', { value: '' }, 'Yönetici ayarı'), ...ok.map(x => h('option', { value: x.id }, x.name))), ts = h('select', { id: 'au-ai-tier', 'aria-label': 'Hız veya yetenek düzeyi', onchange: e => { AU.aiPick.tier = e.target.value; draw(); } }, AU_TIERS.map(([v, l]) => h('option', { value: v }, l)));
    ps.value = AU.aiPick.provider; ts.value = AU.aiPick.tier;
    return h('div', { class: 'grid', style: { marginTop: '.5rem' } }, ok.length > 1 ? h('div', { class: 'field' }, h('label', null, 'Yapay zekâ'), ps) : null, h('div', { class: 'field' }, h('label', null, 'Hız ↔ yetenek'), ts));
  }

  /* ---------------------------------------------------------------- deneme okuması ve kayıt */
  const testOut = h('div', { id: 'au-testout' });
  async function tryRead(f) {
    const mt = OMRDetect.makeTemplate(AU.an); if (mt.error) return toast(mt.error, 'bad');
    clear(testOut).append(h('p', { class: 'muted' }, 'Okunuyor…'));
    try {
      const isPdf = f.type === 'application/pdf' || /\.pdf$/i.test(f.name || ''), img = await loadGray(isPdf ? (await pdfSources(f))[0] : f), out = await runRead(img, mt.tpl, {}), r = out.res;
      if (!r || !r.ok || !r.forms || !r.forms[0]) { const sd = mt.tpl.frameKind; clear(testOut).append(h('div', { class: 'alert bad' }, (out.error || (r && r.error) || 'Okunamadı') + (sd ? ' Formun kenarlarındaki çizgiler ve tüm baloncuk alanları net görünmeli.' : ' Formda dört köşe işareti görünmeli.'))); return; }
      const fm = r.forms[0], ans = fm.answers || '', marked = ans.split('').filter(c => /[A-H]/.test(c)).length, flags = (fm.flags || []).filter(x => x.q).length, fit = r.fit && r.fit.score != null ? ` · şablonla örtüşme %${Math.round(r.fit.score * 100)}` : '';
      const who = [fm.name, fm.surname].filter(Boolean).join(' ');
      let p = 0; const lines = mt.tpl.lessons.map(l => { const t = ans.slice(p, p + l.count); p += l.count; return `${l.name}: ${t}`; });
      clear(testOut).append(h('div', { class: 'alert ok' }, `Okundu${fit}. Öğrenci no: ${fm.studentNo || '—'}${who ? ' · Ad Soyad: ' + who : ''}${fm.schoolCode ? ' · Kurum kodu: ' + fm.schoolCode : ''}${fm.booklet ? ' · Kitapçık: ' + fm.booklet : ''} · ${marked}/${ans.length} soru işaretli, ${flags} şüpheli`), h('div', { class: 'mono small', style: { whiteSpace: 'pre-wrap', wordBreak: 'break-all' } }, lines.join('\n')),
        h('p', { class: 'small muted' }, 'Cevapları kâğıttakilerle karşılaştırın. Hatalı bir ders/harf görürseniz blokları düzeltip yeniden deneyin.'));
    } catch (e) { clear(testOut).append(h('div', { class: 'alert bad' }, e.message)); }
  }
  async function save() {
    const mt = OMRDetect.makeTemplate(AU.an); if (mt.error) return toast(mt.error, 'bad');
    const name = AU.name.trim(); if (!name) return toast('Şablona bir ad verin.', 'bad');
    const tpl = mt.tpl; tpl.meta = { src: String(AU.file).slice(0, 60), ai: !!AU.aiSnap, edited: !!AU.edited, at: new Date().toISOString().slice(0, 10) };
    if (JSON.stringify(tpl).length > 45000) return toast('Şablon çok büyük (45 KB sınırı).', 'bad');
    try { const r = await api('saveTemplate', { name, template: tpl }); await refreshBase(); AU.saved = { id: r.templateId, name, tpl }; toast('Şablon kaydedildi', 'ok'); draw(); } catch (e) { toast(e.message, 'bad'); }
  }

  /* ---------------------------------------------------------------- liste, düzenleme paneli, araç çubuğu */
  function blockRow(b, q0) {
    const col = AU_COL[b.role], isQ = b.role === 'questions', isBk = b.role === 'booklet', k = auK(b);
    const roleSel = h('select', { 'aria-label': 'Blok türü', onchange: e => { const nv = e.target.value; edit(null, () => { const old = b.role; b.role = nv; b.set = Object.assign({}, b.set, { role: 1 }); b.axis = auAxis(b, nv); if (nv !== 'questions') b.name = ''; if (old !== nv && (['studentNo', 'schoolCode'].includes(nv) || AU_NAMEROLE(nv) || AU_NAMEROLE(old))) b.labels = ''; }); } }, AU_ROLES.map(([v, l]) => h('option', { value: v }, l))); roleSel.value = b.role;
    const el = h('div', { class: 'blk' + (b.id === AU.sel ? ' sel' : ''), 'data-id': b.id, style: { borderLeftColor: col }, onclick: e => { if (!/^(INPUT|SELECT|BUTTON|OPTION)$/.test(e.target.tagName)) select(b.id, false); } },
      h('div', { class: 'row between' }, h('span', { class: 'row' }, h('span', { class: 'pill', style: { background: col, color: '#fff' } }, b.id), h('b', null, `${b.rows} × ${b.cols}`), b.manual ? h('span', { class: 'pill brand', title: 'Elle düzenlendi' }, '✎ elle') : null, b.conf === 'low' ? h('span', { class: 'pill bad' }, 'kontrol') : b.conf === 'med' ? h('span', { class: 'pill warn' }, 'emin değil') : null), roleSel),
      isQ ? h('div', { class: 'grid', style: { marginTop: '.4rem' } },
        h('div', { class: 'field' }, h('label', null, 'Ders / bölüm adı'), h('input', { type: 'text', maxlength: 40, value: b.name || '', placeholder: 'örn: TÜRKÇE', 'data-f': 'name', oninput: e => { b.name = e.target.value; b.set = Object.assign({}, b.set, { name: b.name.trim() ? 1 : 0 }); paintSoon(); sumSoon(); } })),
        h('div', { class: 'field' }, h('label', null, `Şık harfleri (${k} şık)`), h('input', { type: 'text', maxlength: 12, value: letters(b, k) || '', placeholder: 'ABCDEFGH'.slice(0, k), 'data-f': 'labels', oninput: e => { b.labels = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); b.set = Object.assign({}, b.set, { labels: b.labels ? 1 : 0 }); paintSoon(); } }))) : null,
      isBk ? h('div', { class: 'field', style: { marginTop: '.4rem' } }, h('label', null, `Kitapçık harfleri (${k})`), h('input', { type: 'text', maxlength: 8, value: letters(b, k) || '', placeholder: 'ABCD'.slice(0, k), 'data-f': 'labels', oninput: e => { b.labels = e.target.value.toUpperCase().replace(/[^A-Z]/g, ''); b.set = Object.assign({}, b.set, { labels: b.labels ? 1 : 0 }); paintSoon(); } })) : null,
      AU_NAMEROLE(b.role) ? h('div', { class: 'field', style: { marginTop: '.4rem' } }, h('label', null, `Alfabe (${k} harf, sırayla)`), h('input', { type: 'text', maxlength: 40, value: auAlpha(b.labels) || '', placeholder: OMRDetect.defaultAlphabet(k).join(''), 'data-f': 'labels', oninput: e => { b.labels = auAlpha(e.target.value); b.set = Object.assign({}, b.set, { labels: b.labels ? 1 : 0 }); paintSoon(); } }), h('div', { class: 'small muted' }, 'Boş bırakırsanız Türkçe alfabe (ABCÇDEFGĞH…) varsayılır; formdaki harf sırası farklıysa buraya yazın.')) : null,
      h('div', { class: 'small muted', style: { marginTop: '.3rem' } }, isQ ? `Sorular ${q0 + 1}–${q0 + auQn(b)} (${auQn(b)} soru)` : b.role === 'ignore' ? 'Okumaya katılmaz.' : b.role === 'booklet' ? 'Kitapçık türü işareti' : AU_NAMEROLE(b.role) ? `${auQn(b)} harflik ${b.role === 'name' ? 'ad' : 'soyad'} alanı (öğrenci adını/soyadını okur)` : `${auQn(b)} haneli ${b.role === 'studentNo' ? 'öğrenci numarası' : 'kurum kodu'}`,
        isQ && b.axis === 'row' && b.rows >= 2 ? h('button', { class: 'btn sm ghost', style: { marginLeft: '.6rem' }, onclick: () => splitDlg(b) }, 'Böl…') : null),
      b.why ? h('div', { class: 'small', style: { color: 'var(--warn)', marginTop: '.2rem' } }, b.why) : null,
      b.ai ? h('div', { class: 'small', style: { color: 'var(--brand)', marginTop: '.2rem' } }, `Yapay zekâ: ${b.ai.ch.length ? b.ai.ch.join(', ') + ' önerdi' : 'aynı görüşte'}${b.ai.kept && b.ai.kept.length ? ' · elle ayarınız korundu: ' + b.ai.kept.join(', ') : ''}${b.ai.note ? ' · ' + b.ai.note : ''}`) : null);
    rows.set(b.id, el); return el;
  }
  function renderList() {
    if (!listEl) return; const top = listEl.scrollTop; clear(listEl); rows.clear(); let q = 0;
    AU.an.blocks.forEach(b => { listEl.append(blockRow(b, q)); if (b.role === 'questions') q += auQn(b); }); listEl.scrollTop = top;
  }
  let pt = 0, st = 0; const paintSoon = () => { clearTimeout(pt); pt = setTimeout(paint, 120); }, sumSoon = () => { clearTimeout(st); st = setTimeout(drawSummary, 150); };
  function drawSummary() {
    if (!summary) return; clear(summary); const an = AU.an; if (!an) return; const mt = OMRDetect.makeTemplate(an), pr = problems();
    if (mt.error) summary.append(h('div', { class: 'alert bad' }, mt.error));
    else { const t = mt.tpl; summary.append(h('div', { class: 'chips' }, h('span', { class: 'chip brand' }, `${t.questions} soru · ${t.choices} şık`), t.digits ? h('span', { class: 'chip' }, `${t.digits} haneli öğrenci no`) : null, t.schoolDigits ? h('span', { class: 'chip' }, `${t.schoolDigits} haneli kurum kodu`) : null, t.nameLen ? h('span', { class: 'chip' }, `ad: ${t.nameLen} harf`) : null, t.surnameLen ? h('span', { class: 'chip' }, `soyad: ${t.surnameLen} harf`) : null, h('span', { class: 'chip' }, `çerçeve: ${AU_FRAME_TR[an.frameKind] || 'dört köşe karesi'}`), t.booklets.length ? h('span', { class: 'chip' }, `Kitapçık ${t.booklets.join('/')}`) : null, h('span', { class: 'chip' }, `${t.lessons.length} ders`), h('span', { class: 'chip' }, `baloncuk ≈ ${Math.round(t.bsz.w)} px`)),
        h('div', { class: 'small muted', style: { marginTop: '.3rem' } }, t.lessons.map(l => `${l.name} ${l.count}`).join(' · '))); }
    pr.forEach(m => summary.append(h('div', { class: 'alert warn' }, m)));
    const sv = $('#au-save'); if (sv) sv.disabled = !!mt.error;
  }
  const eBtn = (id, label, fn, cls, title) => h('button', { class: 'btn sm ' + (cls || ''), id, type: 'button', title: title || label, onclick: fn }, label);
  function renderEdit() {
    if (!editBox) return; clear(editBox); const b = selB(), an = AU.an;
    if (!b) { editBox.append(h('p', { class: 'small muted', id: 'au-edit-hint', style: { margin: 0 } }, 'Düzenlemek için tuvaldeki bir çerçeveye ya da sağdaki listeden bir bloğa tıklayın. Seçili çerçeveyi sürükleyerek taşıyın, kenar ve köşe tutamaçlarından çekerek büyütüp küçültün; milimetrik ayar için buradaki düğmeleri ya da klavyedeki ok tuşlarını kullanın. Yanlış birleşmiş bölümleri "Böl", ayrı kalmış olanları "Birleştir", bulunamayanı tuvalde "Bölüm ekle" ile düzeltin.'));
      return; }
    const total = b.rows * b.cols, qA = b.role === 'questions' ? b.axis : (b.axis === 'row' ? 'row' : 'col'), nq = qA === 'row' ? b.rows : b.cols, nk = qA === 'row' ? b.cols : b.rows;   // nq: soru/hane/harf konumu sayısı · nk: şık/rakam/alfabe sayısı
    const L = { questions: ['Soru sayısı', 'Şık sayısı'], studentNo: ['Hane sayısı', 'Rakam sayısı (10)'], schoolCode: ['Hane sayısı', 'Rakam sayısı (10)'], name: ['Harf sayısı (ad uzunluğu)', 'Alfabe sayısı'], surname: ['Harf sayısı (soyad uzunluğu)', 'Alfabe sayısı'], booklet: ['Satır', 'Kitapçık şık sayısı'], ignore: ['Satır', 'Sütun'] }[b.role] || ['Satır', 'Sütun'];
    const nI = h('input', { type: 'number', min: 1, max: 400, value: nq, id: 'au-nq', 'aria-label': L[0], style: { width: '80px' }, onchange: e => setCounts(b, parseInt(e.target.value) || nq, nk) });
    const kI = h('input', { type: 'number', min: 1, max: 400, value: nk, id: 'au-nk', 'aria-label': L[1], style: { width: '80px' }, onchange: e => setCounts(b, nq, parseInt(e.target.value) || nk) });
    const axSel = h('select', { id: 'au-axis', 'aria-label': 'Okuma yönü', onchange: e => { const nv = e.target.value; edit(null, () => { b.axis = nv; b.labels = ''; }); } },
      b.role === 'questions' ? [h('option', { value: 'row' }, 'Her satır bir soru (şıklar yatay)'), h('option', { value: 'col' }, 'Her sütun bir soru (şıklar dikey)')]
        : b.role === 'booklet' ? [h('option', { value: 'row' }, 'Şıklar yatay (soldan sağa)'), h('option', { value: 'col' }, 'Şıklar dikey (yukarıdan aşağı)')]
          : b.role === 'ignore' ? [h('option', { value: b.axis }, '—')]
            : [h('option', { value: 'col' }, 'Her sütun bir hane/harf (rakamlar/alfabe dikey)'), h('option', { value: 'row' }, 'Her satır bir hane/harf (rakamlar/alfabe yatay)')]); axSel.value = b.axis; axSel.disabled = b.role === 'ignore';
    const stepBtns = AU_STEPS.map(v => h('button', { class: 'btn sm' + (AU.step === v ? ' primary' : ''), type: 'button', 'data-step': v, id: 'au-step-' + String(v).replace('.', '_'), onclick: () => { AU.step = v; renderEdit(); } }, fmt(v)));
    const pad = h('div', { class: 'au-pad', role: 'group', 'aria-label': 'Bloğu kaydır' },
      h('span'), eBtn('au-mv-up', '▲', () => nudge(0, -AU.step), '', 'Yukarı'), h('span'), eBtn('au-mv-left', '◀', () => nudge(-AU.step, 0), '', 'Sola'), h('span', { class: 'au-padc small muted' }, `${fmt(AU.step)} px`), eBtn('au-mv-right', '▶', () => nudge(AU.step, 0), '', 'Sağa'), h('span'), eBtn('au-mv-down', '▼', () => nudge(0, AU.step), '', 'Aşağı'), h('span'));
    const edgeRow = (edge, name, unit) => h('div', { class: 'au-edge' }, h('b', null, name), h('span', { class: 'row', style: { gap: '.25rem' } }, eBtn(`au-e-${edge}-px-in`, '− daralt', () => edgeOp(edge, 'px', false), '', `${name} kenarı içe ${fmt(AU.step)} px`), eBtn(`au-e-${edge}-px-out`, '+ genişlet', () => edgeOp(edge, 'px', true), '', `${name} kenarı dışa ${fmt(AU.step)} px`)),
      h('span', { class: 'row', style: { gap: '.25rem' } }, eBtn(`au-e-${edge}-ln-in`, `− ${unit}`, () => edgeOp(edge, 'ln', false), '', `${name} kenarından bir ${unit} çıkar`), eBtn(`au-e-${edge}-ln-out`, `+ ${unit}`, () => edgeOp(edge, 'ln', true), '', `${name} kenarına bir ${unit} ekle`)));
    const missTxt = BUB().length ? `${b.n}/${total} baloncuk gerçek baloncuğa denk${b.err >= 0 ? ` · sapma ≈ ${fmt(b.err)} px` : ''}` : '';
    editBox.append(
      h('div', { class: 'row between' }, h('span', { class: 'row' }, h('span', { class: 'pill', style: { background: AU_COL[b.role], color: '#fff' } }, b.id), h('b', null, AU_ROLES.find(x => x[0] === b.role)[1]), h('span', { class: 'muted small' }, `${b.rows} satır × ${b.cols} sütun`)),
        missTxt ? h('span', { class: 'pill ' + (b.n === total ? 'ok' : b.n >= 0.6 * total ? 'warn' : 'bad'), id: 'au-match-stat' }, missTxt) : null),
      h('div', { class: 'au-sec' }, h('div', { class: 'lbl' }, 'Adım (piksel) — küçük adım = daha ince (milim milim) ayar'), h('div', { class: 'row', style: { gap: '.25rem' } }, stepBtns)),
      h('div', { class: 'au-sec au-two' }, h('div', null, h('div', { class: 'lbl' }, 'Bloğu kaydır (ok tuşları da çalışır; Shift ×5, Alt ×0,5)'), pad),
        h('div', null, h('div', { class: 'lbl' }, 'Kenarlar: daralt/genişlet ya da satır/sütun ekle-çıkar'), edgeRow('left', 'Sol', 'sütun'), edgeRow('right', 'Sağ', 'sütun'), edgeRow('top', 'Üst', 'satır'), edgeRow('bottom', 'Alt', 'satır'))),
      h('div', { class: 'au-sec grid' }, h('div', { class: 'field' }, h('label', { for: 'au-nq' }, L[0]), nI), h('div', { class: 'field' }, h('label', { for: 'au-nk' }, L[1]), kI), h('div', { class: 'field' }, h('label', { for: 'au-axis' }, 'Okuma yönü'), axSel),
        h('div', { class: 'field' }, h('label', null, `Baloncuk boyutu: ${fmt(b.bw)} × ${fmt(b.bh)} px`), h('div', { class: 'row', style: { gap: '.25rem' } }, eBtn('au-bsz-dn', '−', () => edit('bs:' + b.id, () => { OMRDetect.resizeBubbles(b, -Math.min(AU.step, 3), BUB()); }), '', 'Baloncuk boyutunu küçült'), eBtn('au-bsz-up', '+', () => edit('bs:' + b.id, () => { OMRDetect.resizeBubbles(b, Math.min(AU.step, 3), BUB()); }), '', 'Baloncuk boyutunu büyüt')))),
      h('div', { class: 'au-sec row' }, eBtn('au-snap', 'Baloncuklara oturt', snapOne, 'primary', 'Izgarayı bulunan gerçek baloncuklara hizalar'), eBtn('au-regrid', 'Dikdörtgeni yeniden say', regrid, '', 'Dikdörtgenin içindeki baloncuklardan satır/sütun sayısını yeniden bulur'), eBtn('au-split', 'Böl…', () => splitDlg(b), '', 'Tek görünen iki bölümü ayır'), eBtn('au-merge', 'Birleştir…', () => mergeDlg(b), '', 'Başka bir blokla tek blok yap'),
        eBtn('au-up', '▲ Sıra', () => orderMove(b, -1), 'ghost', 'Soru sırasında yukarı al'), eBtn('au-down', '▼ Sıra', () => orderMove(b, 1), 'ghost', 'Soru sırasında aşağı al'), eBtn('au-del', 'Sil', () => delBlock(b), 'danger', 'Bu bloğu kaldır (Geri al ile döner)')),
      orderNote());
    function orderNote() { return an.keepOrder ? h('div', { class: 'small muted' }, 'Soru sırası elle belirlendi. ', h('button', { class: 'btn sm ghost', id: 'au-resetorder', onclick: resetOrder }, 'Okuma sırasına dön')) : h('div', { class: 'small muted' }, 'Sorular soldan sağa sütunlar, her sütunda yukarıdan aşağı numaralanır. Sürükleyerek taşıma: Shift tuşuyla kenardan çekince satır/sütun eklenir-çıkarılır.'); }
  }
  function drawBar() {
    if (!barEl) return; clear(barEl); const t = AU.tool, tb = (id, label, tool, title) => h('button', { class: 'btn sm' + (t === tool ? ' primary' : ''), type: 'button', id, title, 'aria-pressed': t === tool ? 'true' : 'false', onclick: () => setTool(tool) }, label), z = AU.zoom;
    barEl.append(h('div', { class: 'row', style: { gap: '.3rem' } },
      tb('au-t-add', '＋ Bölüm ekle', 'add', 'Tuvalde dikdörtgen çizerek bulunamayan bir bölümü ekle'), tb('au-t-splith', '⎯ Yatay böl', 'splitH', 'Bir bloğu iki satır arasından alt alta ikiye ayır'), tb('au-t-splitv', '⏐ Dikey böl', 'splitV', 'Bir bloğu iki sütun arasından yan yana ikiye ayır'),
      h('span', { class: 'au-sep' }), eBtn('au-undo', '↶ Geri al', undo, AU.hist.length ? '' : 'ghost', 'Ctrl+Z'), eBtn('au-redo', '↷ Yinele', redo, AU.fut.length ? '' : 'ghost', 'Ctrl+Y'),
      h('span', { class: 'au-sep' }), h('span', { class: 'small muted' }, 'Yakınlaştır'), ...[1, 2, 3, 4, 6].map(v => h('button', { class: 'btn sm' + (Math.abs(z - v) < 0.05 ? ' primary' : ''), type: 'button', id: 'au-z-' + v, onclick: () => setZoom(v, v > 1) }, v === 1 ? 'Sığdır' : '×' + v)), eBtn('au-focus', 'Bloğa git', fitSel, '', 'Seçili bloğu büyüt ve ortala')),
      h('div', { class: 'row', style: { gap: '.8rem', marginTop: '.25rem' } },
        h('label', { class: 'small row', style: { gap: '.3rem', cursor: 'pointer' } }, h('input', { type: 'checkbox', id: 'au-showb', checked: AU.showUncov, onchange: e => { AU.showUncov = e.target.checked; paint(); } }), 'Hiçbir bloğa girmeyen baloncukları göster (turuncu)'),
        h('label', { class: 'small row', style: { gap: '.3rem', cursor: 'pointer' } }, h('input', { type: 'checkbox', id: 'au-autosnap', checked: AU.autosnap, onchange: e => { AU.autosnap = e.target.checked; } }), 'Sürükleyip bırakınca baloncuklara oturt')));
  }

  /* ---------------------------------------------------------------- çizim */
  function draw() {
    clear(root); rows.clear(); const an = AU.an;
    const drop = h('div', { class: 'drop', id: 'au-drop', ondragover: e => { e.preventDefault(); drop.classList.add('over'); }, ondragleave: () => drop.classList.remove('over'), ondrop: e => { e.preventDefault(); drop.classList.remove('over'); const f = e.dataTransfer.files[0]; if (f) load(f); } },
      h('div', null, h('b', null, an ? 'Başka bir form tanıt' : 'Boş (işaretsiz) optik formu buraya bırakın'), h('div', { class: 'small muted' }, 'JPG, PNG veya PDF · bilgisayarda tarama dosyası, telefonda fotoğraf')),
      h('div', { class: 'row', style: { justifyContent: 'center', marginTop: '.6rem' } }, h('button', { class: 'btn primary', id: 'au-pick', onclick: () => pickIn.click() }, 'Dosya seç'), h('button', { class: 'btn', id: 'au-cambtn', onclick: () => camIn.click() }, 'Fotoğraf çek')), pickIn, camIn);
    const frameSel = h('select', { id: 'au-frame', disabled: !!AU.busy, onchange: e => reframe(e.target.value) }, AU_FRAMES.map(([v, l]) => h('option', { value: v }, l))); frameSel.value = AU.frame;
    const frameRow = AU.img ? h('div', { class: 'field', style: { marginTop: '.7rem' } }, h('label', { for: 'au-frame' }, 'Çerçeve türü (formu düzeltmek için kullanılan işaretler)'), frameSel,
      h('div', { class: 'small muted', id: 'au-frame-note' }, an ? `Tanınan: ${AU_FRAME_TR[an.frameKind] || an.frameKind}. Yanlışsa başka bir tür seçin (bloklarda yaptığınız düzeltmeler sıfırlanır).` : 'Otomatik tanıma olmadıysa formdaki işarete göre türü elle seçin.')) : null;
    root.append(h('div', { class: 'card' }, h('h2', null, 'Harici formu otomatik tanıt'),
      h('p', { class: 'small muted', style: { marginTop: 0 } }, 'Piyasadaki herhangi bir optik formun (LGS/YKS denemeleri, yayınevi ve okul denemeleri; siyah, mavi, pembe ya da mor baskı) BOŞ bir örneğini yükleyin. Sistem formu dört köşe karesinden — köşe karesi yoksa kenarlardaki çizgilerden (iki kenarda ya da yalnızca bir kenarda) — düzeltir, baloncukları milimetrik bulur; soru bloklarını, öğrenci numarasını, kurum kodunu ve ad-soyad harf ızgaralarını tanır. Tanınan bölümleri siz kontrol eder, gerekirse tuvalde sürükleyerek, milim milim kaydırarak, genişletip daraltarak, bölerek ya da birleştirerek düzeltirsiniz; onaylayınca kayıtlı form olur ve sonraki bütün formlar ona göre okunur. Form tamamen görünmeli, düz ve gölgesiz olmalı.'), drop, frameRow));
    if (AU.busy) { root.append(h('div', { class: 'card' }, h('p', { class: 'muted' }, AU.busy))); return; }
    if (AU.err && !an) root.append(h('div', { class: 'alert bad', id: 'au-err' }, AU.err, h('div', { class: 'small', style: { marginTop: '.3rem' } }, 'Çerçeve türünü yukarıdan elle seçip yeniden deneyin (dört köşe karesi / iki yan çizgi / tek yan çizgi). Hiçbiri olmazsa "Elle tanımla" sekmesini kullanın.')));
    if (!an) return;
    if (AU.saved) { root.append(h('div', { class: 'card' }, h('div', { class: 'alert ok', id: 'au-saved' }, `"${AU.saved.name}" kayıtlı form olarak eklendi (${AU.saved.tpl.questions} soru).`), h('div', { class: 'row' }, h('button', { class: 'btn primary', id: 'au-mkexam', onclick: () => { App.newExam = { templateId: AU.saved.id }; App.go('exams'); } }, 'Bu formla sınav oluştur'), h('button', { class: 'btn', id: 'au-coded', onclick: () => codedPrint({ templateId: AU.saved.id, name: AU.saved.name, json: AU.saved.tpl }) }, 'Kodlu baskı (öğrenci no/ad üzerine)'), h('button', { class: 'btn', onclick: () => { AU.an = null; AU.saved = null; AU.name = ''; AU.img = null; resetEdit(); draw(); } }, 'Başka form tanıt')))); return; }
    cv = h('canvas', { id: 'au-canvas', 'aria-label': 'Tanınan form düzeni', tabindex: 0, onpointerdown: onDown, onpointermove: onMove, onpointerup: onUp, onpointercancel: onCancel, style: { width: (AU.zoom * 100) + '%', touchAction: 'pan-x pan-y pinch-zoom' } });
    cv.addEventListener('touchstart', onTouchStart, { passive: false }); const wrap = h('div', { class: 'canvaswrap' }, cv);
    barEl = h('div', { class: 'au-bar', id: 'au-bar' }); editBox = h('div', { id: 'au-edit' }); summary = h('div', { id: 'au-summary' }); listEl = h('div', { class: 'blocks', id: 'au-blocks' });
    if (AU.match) root.append(h('div', { class: 'alert info', id: 'au-match' }, `Bu form zaten kayıtlı görünüyor: "${AU.match.name}" (örtüşme %${Math.round(AU.match.score * 100)}). Aynı formu tekrar kaydetmeniz gerekmez; sınav ayarlarında o şablonu seçin.`));
    an.warnings.forEach(w => root.append(h('div', { class: 'alert warn' }, w)));
    const aiBtn = h('button', { class: 'btn', id: 'au-ai', onclick: ev => aiRun(ev.currentTarget) }, 'Yapay zekâ ile ders adı ve harfleri öner'), plan = aiPlanText();
    root.append(h('div', { class: 'review wide' },
      h('div', { class: 'au-left' }, h('div', { class: 'card' }, h('h3', null, 'Tanınan düzen'), h('p', { class: 'small muted', style: { marginTop: 0 } }, `${an.nBubbles} baloncuk bulundu, ${an.blocks.length} blok. Renkli çerçeveler tanınan bloklardır. Birine tıklayın: baloncuk daireleri, okuma harfleri/rakamları ve soru numaraları görünür; çerçeveyi sürükleyip kenar/köşe kutucuklarından çekebilirsiniz. Daireler gerçek baloncuklarla çakışmalı (kırmızı daire = o yerde baloncuk bulunamadı).`), barEl, wrap, h('div', { class: 'chips', style: { marginTop: '.4rem' } }, AU_ROLES.map(([v, l]) => h('span', { class: 'chip', style: { borderLeft: '4px solid ' + AU_COL[v] } }, l)))),
        h('div', { class: 'card', id: 'au-editcard' }, h('h3', null, 'Seçili bloğu düzenle'), editBox)),
      h('div', null,
        h('div', { class: 'card' }, h('h3', null, 'Bloklar'), listEl,
          AU.aiAvail ? aiPicker() : null,
          h('div', { class: 'row', style: { marginTop: '.6rem' } }, AU.aiAvail ? aiBtn : null, h('button', { class: 'btn', id: 'au-ai-manualbtn', title: 'Anahtar gerekmez: görüntüyü ve hazır istemi kendi sohbet uygulamanıza yapıştırır, yanıtı buraya getirirsiniz', onclick: aiManualDlg }, 'API\'siz yapay zekâ (sohbet uygulamasıyla)'), AU.aiSnap ? h('button', { class: 'btn ghost', id: 'au-ai-undo', onclick: aiUndo }, 'Önerileri geri al') : null),
          AU.aiAvail && plan ? h('p', { class: 'small muted', id: 'au-ai-plan' }, `Kullanılacak: ${plan} (en yeni sürüm sunucudan otomatik seçilir; sağlayıcı yanıt vermezse yedeğe geçilir).`) : null,
          AU.aiUsed ? h('p', { class: 'small', id: 'au-ai-used', style: { color: 'var(--brand)' } }, `Son öneri: ${AU.aiUsed.name}${AU.aiUsed.model ? ' · ' + AU.aiUsed.model : ''}${AU.aiUsed.failed ? ` · ${AU.aiUsed.failed} deneme başarısız olup yedek kullanıldı` : ''}`) : null,
          AU.aiAvail === false ? h('p', { class: 'small muted' }, 'Otomatik yapay zekâ önerisi kapalı (yönetici "Yönetim ▸ Yapay zekâ" bölümünden bir sağlayıcının anahtarını eklemedi). Tanıma yapay zekâsız çalışır; ders adlarını elle yazabilir ya da yukarıdaki "API\'siz yapay zekâ" düğmesiyle ücretsiz bir sohbet uygulamasından yardım alabilirsiniz.') : null,
          AU.aiNotes.length ? h('div', { class: 'alert info' }, AU.aiNotes.join(' · ')) : null),
        h('div', { class: 'card' }, h('h3', null, 'Özet'), summary,
          h('div', { class: 'field', style: { marginTop: '.7rem' } }, h('label', null, 'Şablon adı'), h('input', { type: 'text', id: 'au-name', value: AU.name, placeholder: 'Örn: XYZ Yayınları LGS Deneme', oninput: e => { AU.name = e.target.value; } })),
          h('div', { class: 'row', style: { marginTop: '.6rem' } }, h('button', { class: 'btn', id: 'au-try', onclick: () => testIn.click() }, 'İşaretli bir formla dene'), h('button', { class: 'btn primary', id: 'au-save', onclick: save }, 'Onayla ve kaydet'), testIn), testOut))));
    refresh();
  }
  draw();
}
