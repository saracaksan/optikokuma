/* forms-ai.js — yapay zekâdan gelen TAM YERLEŞİM önerisini (bölüm kutuları, satır/sütun sayıları, yön, rol, ders adı, harfler, soru sırası)
 * otomatik tanıma sonucuyla birleştirir.
 *
 * İki yoldan aynı biçimde veri gelir:
 *   · dışarıdaki bir sohbet yapay zekâsı: uygulama görüntüyü (cetvelli) ve hazır istemi verir, kullanıcı JSON yanıtını yapıştırır ya da dosya olarak yükler;
 *   · uygulamanın kendi yapay zekâsı (sunucu: aiAnalyzeForm, mode:'layout').
 * Şema "optinet-layout/1": blocks[] = { id|null, action keep|edit|add|remove, role, name, labels, startNo, box:[sol,üst,sağ,alt] (binde), rows, cols, axis, confidence, note }.
 *
 * İlke: yapay zekâ konumu YAKLAŞIK verir, kesin konumu görüntü işleme verir. Kutu + satır/sütun sayısı, gerçek baloncuklara oturtularak sıradan (elle de
 * düzenlenebilir) bir bloğa çevrilir. Elle yaptığınız hiçbir şeyin (kilitli tür/ad/harf, elle taşınmış ya da boyutlandırılmış blok) üstüne yazılmaz; yapay zekâ
 * farklı bir şey düşünüyorsa bu "öneri" olarak bloğun üstünde durur ve tek dokunuşla uygulanır. Fonksiyonlar `an` (OMRDetect.analyze sonucu) üzerinde çalışır; DOM yok.
 */
'use strict';
const AiLayout = (() => {
  const SCHEMA = 'optinet-layout/1';
  const ROLES = ['questions', 'studentNo', 'schoolCode', 'booklet', 'name', 'surname', 'ignore'];
  const ALIAS = {
    questions: 'questions question answers answer answerbubbles mcq soru sorular cevap cevaplar', studentNo: 'studentno studentnumber studentid schoolnumber number no ogrencino ogrencinumarasi numara',
    schoolCode: 'schoolcode institutioncode kurumkodu okulkodu code', booklet: 'booklet bookelttype booklettype kitapcik kitapciktipi kitapciktur', name: 'name firstname givenname ad adi isim',
    surname: 'surname lastname familyname soyad soyadi', ignore: 'ignore other none decoration skip yoksay'
  };
  const ROLE_BY = {}; Object.keys(ALIAS).forEach(r => ALIAS[r].split(' ').forEach(a => { ROLE_BY[a] = r; }));
  const strip = s => String(s == null ? '' : s).toLowerCase().replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ş/g, 's').replace(/ü/g, 'u').replace(/[^a-z]/g, '');
  const roleOf = v => ROLE_BY[strip(v)] || '';
  const num = v => { const n = typeof v === 'string' ? parseFloat(v.replace(',', '.')) : Number(v); return isFinite(n) ? n : NaN; };
  const intIn = (v, lo, hi) => { const n = Math.round(num(v)); return n >= lo && n <= hi ? n : 0; };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const r1 = v => Math.round(v * 10) / 10;

  /* ------------------------------------------------------------------ biçim: JSON'u bul ve normalleştir */
  /** Metindeki ilk dengeli { … } ya da [ … ] bölümünü döndürür (dizgeleri ve kaçışları dikkate alır). */
  function balanced(t, from) {
    const open = t[from], close = open === '{' ? '}' : ']'; let depth = 0, ins = false, esc = false;
    for (let i = from; i < t.length; i++) {
      const c = t[i];
      if (ins) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') ins = false; continue; }
      if (c === '"') ins = true; else if (c === open) depth++; else if (c === close) { depth--; if (!depth) return t.slice(from, i + 1); }
    }
    return '';
  }
  const lenient = s => s.replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/\/\/[^\n"]*$/gm, '').replace(/,\s*([}\]])/g, '$1');
  /** Sohbet uygulamasının yanıtından (kod çiti, açıklama, akıllı tırnak, sondaki virgül olsa da) JSON nesnesini çıkarır. Hata: Error (Türkçe ileti). */
  function extractJson(text) {
    if (text && typeof text === 'object') return text;
    const t = String(text == null ? '' : text).replace(/^﻿/, ''); if (!t.trim()) throw new Error('Yanıt boş. Sohbet uygulamasının verdiği JSON\'u yapıştırın ya da dosyasını yükleyin.');
    const cands = [t.trim()], a = t.search(/[{[]/);
    if (a >= 0) { const bl = balanced(t, a); if (bl) cands.push(bl); const z = t.lastIndexOf(t[a] === '{' ? '}' : ']'); if (z > a) cands.push(t.slice(a, z + 1)); }
    let lastErr = '';
    for (const c of cands) for (const s of [c, lenient(c)]) { try { const o = JSON.parse(s); if (o && typeof o === 'object') return o; } catch (e) { lastErr = e.message; } }
    if (a < 0) throw new Error('Yanıtta JSON bulunamadı. Sohbet uygulamasının verdiği { ile başlayan bloğu eksiksiz yapıştırın.');
    throw new Error('JSON okunamadı (' + lastErr + '). Yanıtın tamamını, başındaki { ve sonundaki } dahil yapıştırdığınızdan emin olun; yanıt yarıda kesilmiş olabilir.');
  }
  function listOf(o, depth) {
    if (Array.isArray(o)) return o; if (!o || typeof o !== 'object' || (depth || 0) > 2) return null;
    for (const k of ['blocks', 'layout', 'regions', 'items', 'result', 'data']) { const v = o[k]; if (Array.isArray(v)) return v; if (v && typeof v === 'object') { const r = listOf(v, (depth || 0) + 1); if (r) return r; } }
    return null;
  }
  function rawBox(x) {
    const raw = x.box || x.bbox || x.rect || x.bounds || x.region || x.position || (('left' in x || 'x0' in x || 'xmin' in x) ? x : null); if (!raw) return null;
    let v = null;
    if (Array.isArray(raw) && raw.length >= 4) v = raw.slice(0, 4).map(num);
    else if (typeof raw === 'object') {
      const g = (...ks) => { for (const k of ks) if (raw[k] != null && raw[k] !== '') return num(raw[k]); return NaN; };
      let l = g('left', 'x0', 'xmin', 'x'), t = g('top', 'y0', 'ymin', 'y'), r = g('right', 'x1', 'xmax'), b = g('bottom', 'y1', 'ymax');
      if (!isFinite(r)) { const w = g('width', 'w'); if (isFinite(w) && isFinite(l)) r = l + w; } if (!isFinite(b)) { const hh = g('height', 'h'); if (isFinite(hh) && isFinite(t)) b = t + hh; }
      v = [l, t, r, b];
    }
    return v && v.every(isFinite) ? v : null;
  }
  const ACT = { keep: 'keep', edit: 'edit', add: 'add', remove: 'remove', delete: 'remove', drop: 'remove', new: 'add', create: 'add', added: 'add', update: 'edit', fix: 'edit', change: 'edit', modify: 'edit', confirm: 'keep', ok: 'keep' };
  function normEntry(x) {
    if (!x || typeof x !== 'object' || Array.isArray(x)) return null;
    let id = x.id == null ? '' : String(x.id).trim().toLowerCase().replace(/\s+/g, ''); if (!/^b\d{1,3}[a-z]?$/.test(id)) id = '';
    let c = num(x.confidence); if (!isFinite(c)) c = 0.8; if (c > 1) c = c / 100; c = clamp(c, 0, 1);
    const lab = x.labels != null ? x.labels : x.choices != null ? x.choices : x.options, ax = String(x.axis || x.direction || '').toLowerCase();
    return {
      id, action: ACT[String(x.action || '').toLowerCase().trim()] || '', role: roleOf(x.role != null ? x.role : x.type != null ? x.type : x.kind),
      name: String(x.name != null ? x.name : x.lesson != null ? x.lesson : x.heading != null ? x.heading : '').trim().slice(0, 40), labels: (Array.isArray(lab) ? lab.join('') : String(lab == null ? '' : lab)).replace(/\s+/g, '').slice(0, 60),
      startNo: intIn(x.startNo != null ? x.startNo : x.start_no != null ? x.start_no : x.start, 1, 1000), rows: intIn(x.rows, 1, 400), cols: intIn(x.cols != null ? x.cols : x.columns, 1, 400),
      axis: /^row/.test(ax) ? 'row' : /^col/.test(ax) ? 'col' : '', confidence: c, note: String(x.note != null ? x.note : x.notes != null ? x.notes : '').slice(0, 160), rawBox: rawBox(x)
    };
  }
  /** Yapay zekânın gördüğü görüntünün boyutu (overlayJpeg: uzun kenar ≤ 1568 px). */
  const sentSize = an => { const r = an.rectified, sc = Math.min(1, 1568 / Math.max(r.w, r.h)); return { w: Math.round(r.w * sc), h: Math.round(r.h * sc) }; };
  /** Yanıtı doğrular ve her kutuyu düzeltilmiş çerçevenin 0–1 oranına çevirir. Dönüş: { entries, title, notes, geometry, unit } ya da Error. */
  function normalize(o, an) {
    const arr = listOf(o); if (!arr) throw new Error('Yanıtta "blocks" listesi yok.');
    const ents = arr.map(normEntry).filter(Boolean); if (!ents.length) throw new Error('Yanıttaki blok listesi boş ya da okunamadı.');
    const vals = [].concat(...ents.map(e => e.rawBox || [])), mx = vals.length ? Math.max(...vals) : 0;
    let unit = strip(o && (o.unit || o.units || o.coordinates)); unit = /^(permille|perthousand|thousand|tenthsofpercent)/.test(unit) ? 'permille' : /^(percent|pct|percentage)/.test(unit) ? 'percent' : /^(fraction|normalized|norm|unit)/.test(unit) ? 'fraction' : /^(px|pixel)/.test(unit) ? 'px' : '';
    if (unit === 'fraction' && mx > 1.0001) unit = ''; if (unit === 'percent' && mx > 100.5) unit = ''; if (unit === 'permille' && mx > 1000.5) unit = ''; if (unit === 'permille' && vals.length >= 6 && mx <= 100.5) unit = 'percent';
    if (!unit) unit = !vals.length ? 'permille' : mx <= 1.0001 ? 'fraction' : mx <= 100.5 ? 'percent' : mx <= 1000.5 ? 'permille' : 'px';
    const sent = sentSize(an), im = o && (o.image || o.imageSize || {}), iw = num(im.width || im.w || o.imageWidth) || sent.w, ih = num(im.height || im.h || o.imageHeight) || sent.h;
    const dx = { fraction: 1, percent: 100, permille: 1000, px: iw }[unit], dy = { fraction: 1, percent: 100, permille: 1000, px: ih }[unit];
    ents.forEach(e => {
      e.box = null; if (!e.rawBox) return; let [l, t, r, b] = e.rawBox; if (r < l) [l, r] = [r, l]; if (b < t) [t, b] = [b, t];
      const f = [clamp(l / dx, 0, 1), clamp(t / dy, 0, 1), clamp(r / dx, 0, 1), clamp(b / dy, 0, 1)]; if (f[2] - f[0] >= 0.004 && f[3] - f[1] >= 0.004) e.box = f;
    });
    const geometry = ents.some(e => e.box || e.rows || e.cols || e.action === 'add' || e.action === 'remove');
    return { schema: SCHEMA, title: o && typeof o.title === 'string' ? o.title.slice(0, 80) : '', notes: (o && Array.isArray(o.notes) ? o.notes : []).map(x => String(x).slice(0, 200)).slice(0, 8), entries: ents, geometry, unit, complete: !(o && o.complete === false) };
  }
  /** Metin ya da nesneden normalleştirilmiş yanıt (Error fırlatabilir). */
  const parse = (textOrObj, an) => normalize(extractJson(textOrObj), an);
  /** Yanıtta konum/sayı/ekleme/silme bilgisi var mı? (yoksa yalnızca ders adı/harf yanıtıdır: eski basit akış). */
  function hasGeometry(textOrObj, an) { try { return normalize(extractJson(textOrObj), an).geometry; } catch (e) { return false; } }

  /* ------------------------------------------------------------------ geometri yardımcıları */
  const tight = (b, an) => { const w = (b.bw || an.bsz.w) / 2, h = (b.bh || an.bsz.h) / 2; return { x0: b.x0 - w, y0: b.y0 - h, x1: b.x1 + w, y1: b.y1 + h }; };
  const area = r => Math.max(0, r.x1 - r.x0) * Math.max(0, r.y1 - r.y0);
  const inter = (a, b) => ({ x0: Math.max(a.x0, b.x0), y0: Math.max(a.y0, b.y0), x1: Math.min(a.x1, b.x1), y1: Math.min(a.y1, b.y1) });
  const iou = (a, b) => { const i = area(inter(a, b)), u = area(a) + area(b) - i; return u > 0 ? i / u : 0; };
  /** Mevcut blokların binde cinsinden kutusu ve özellikleri (istemde ve sunucuya gönderilen liste). */
  function blocksInfo(an) {
    const R = an.rectified;
    return an.blocks.map(b => { const B = tight(b, an); return { id: b.id, role: b.role, rows: b.rows, cols: b.cols, axis: b.axis, name: b.name || '', glyph: b.glyph || '', box: [B.x0 / R.w, B.y0 / R.h, B.x1 / R.w, B.y1 / R.h].map(v => Math.round(clamp(v, 0, 1) * 1000)) }; });
  }
  /** Tuvale cetvel + ızgara çizer (yapay zekâ konumu ölçebilsin): her 100 binde bir kesikli çizgi, kenarlarda etiket. */
  function drawRuler(ctx, w, h) {
    const fs = Math.max(10, Math.round(Math.min(w, h) / 68)), dash = Math.max(3, w / 300); ctx.save(); ctx.lineWidth = Math.max(1, w / 1400); ctx.setLineDash([dash, dash]); ctx.strokeStyle = 'rgba(0,102,255,.38)';
    for (let u = 100; u < 1000; u += 100) { const x = u / 1000 * w, y = u / 1000 * h; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
    ctx.setLineDash([]); ctx.strokeStyle = 'rgba(0,70,200,.95)'; ctx.lineWidth = Math.max(1.2, w / 900);
    for (let u = 0; u <= 1000; u += 50) { const x = u / 1000 * w, y = u / 1000 * h, L = (u % 100 ? 0.55 : 1) * fs; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, L); ctx.moveTo(x, h); ctx.lineTo(x, h - L); ctx.moveTo(0, y); ctx.lineTo(L, y); ctx.moveTo(w, y); ctx.lineTo(w - L, y); ctx.stroke(); }
    ctx.font = `700 ${fs}px sans-serif`; ctx.textBaseline = 'middle';
    const tag = (t, x, y, al) => { const tw = ctx.measureText(t).width + 6; const x0 = al === 'center' ? x - tw / 2 : al === 'right' ? x - tw : x; ctx.fillStyle = 'rgba(255,255,255,.88)'; ctx.fillRect(x0, y - fs / 2 - 1, tw, fs + 2); ctx.fillStyle = '#0646b0'; ctx.textAlign = 'left'; ctx.fillText(t, x0 + 3, y); };
    for (let u = 0; u <= 1000; u += 100) {
      const x = u / 1000 * w, y = u / 1000 * h, al = u === 0 ? 'left' : u === 1000 ? 'right' : 'center';
      tag(String(u), x, fs * 1.9, al); tag(String(u), x, h - fs * 1.9, al);
      if (u > 0 && u < 1000) { tag(String(u), fs * 0.2, y, 'left'); tag(String(u), w - fs * 0.2, y, 'right'); }
    }
    ctx.restore();
  }

  /* ------------------------------------------------------------------ istem (dışarıdaki sohbet yapay zekâsı için) */
  const ROLE_TXT = '"questions" (answer bubbles for numbered questions), "studentNo" (digit columns for the student number), "schoolCode" (digit columns for a school/institution code), "booklet" (choose booklet type A/B/C/D), "name" (letter grid where the student FIRST NAME is coded: one column per letter position, one row per alphabet letter), "surname" (the same for the SURNAME), "ignore" (anything else that has bubbles but must not be read, e.g. a printed sample)';
  const JSON_FORMAT = '{"schema":"' + SCHEMA + '","unit":"permille","title":string,"blocks":[{"id":string|null,"action":"keep"|"edit"|"add"|"remove","role":string,"name":string,"labels":string,"startNo":number|null,"box":[left,top,right,bottom],"rows":number,"cols":number,"axis":"row"|"col","confidence":number,"note":string}],"notes":[string]}';
  function promptText(an, o) {
    o = o || {}; const info = blocksInfo(an);
    const list = info.length ? info.map(b => `${b.id}: box [${b.box.join(', ')}], ${b.rows} rows x ${b.cols} columns` + (b.axis ? `, each ${b.axis === 'row' ? 'ROW' : 'COLUMN'} is one item` : '') + `, my guess: ${b.role}`).join('\n') : '(nothing was found automatically)';
    return 'You are given a scan or photo of a BLANK optical answer sheet (OMR form) used in Turkish school exams (LGS, TYT, AYT, school and publisher trial exams). It may be printed in black, blue, pink or purple ink. The image has already been straightened.\n' +
      'Describe the COMPLETE layout of the sheet\'s bubble areas so that software can read marked sheets: where every bubble block is, how many rows and columns of bubbles it has, and what it means.\n\n' +
      'COORDINATES: all positions are in tenths of a percent of the image: x = 0 at the left edge and 1000 at the right edge; y = 0 at the top edge and 1000 at the bottom edge. ' +
      (o.ruler === false ? 'Estimate positions carefully against the image edges. ' : 'A light blue dashed grid is drawn every 100 units and labelled on the image edges (top/bottom labels are x, left/right labels are y); read positions against it. ') +
      'Give each block as box = [left, top, right, bottom], tightly enclosing the OUTER EDGES of its outermost bubbles (not printed numbers, letters or headings).\n\n' +
      'BLOCK = one regular rectangular grid of equally spaced bubbles, e.g. the questions of one lesson, the student-number digits, the school-code digits, the booklet-type bubbles, the name letter grid, the surname letter grid. Give different lessons/sections their own block; never merge separate sections and never split one regular grid. Timing bars along the sheet edges, logos, instructions and printed sample bubbles are not blocks.\n' +
      'COUNTING: rows = number of horizontal lines of bubbles; cols = number of vertical lines of bubbles. Count them one by one in the image; never estimate from the size.\n' +
      'AXIS: "row" when every ROW is one item (one question, or one digit/letter position) and its options run left to right; "col" when every COLUMN is one item and its options run top to bottom. Typical: question blocks "row"; student-number and name/surname grids "col".\n' +
      'ROLES: ' + ROLE_TXT + '.\n' +
      'FIELDS: for "questions": name = the printed lesson/section heading of that block (e.g. "TÜRKÇE"), labels = the printed choice letters in order (e.g. "ABCDE"), startNo = the first printed question number. For digit blocks labels = "0123456789" unless printed differently. For booklet blocks labels = the printed booklet letters. For name/surname blocks labels = the printed alphabet in order if shown (e.g. "ABCÇDEFGĞHIİJKLMNOÖPRSŞTUÜVYZ"), otherwise empty. Never invent what you cannot read: use "" or null and say so in "note".\n\n' +
      'DETECTED BLOCKS: image-processing software already found these (same units). ' + (o.outlines === false ? 'They are NOT drawn on the image; rely on the box coordinates.' : 'They are also outlined in colour on the image and labelled b1, b2… (the label sits at the outline\'s bottom-left corner).') + '\n' + list + '\n' +
      'They are usually right but may be wrong: blocks can be missed (faint print, name grids), merged, split or false. Return EVERY bubble block of the sheet: repeat each correct detected block with its id and action "keep" (and fill role/name/labels/startNo); give corrected values with action "edit" for a wrong one; add a missed block with id null and action "add"; mark a detected block that is not a bubble block with action "remove".\n\n' +
      'Reply with ONLY one JSON object, no explanation and no code fence:\n' + JSON_FORMAT;
  }

  /* ------------------------------------------------------------------ kutu + sayılar → gerçek baloncuklara oturmuş blok */
  /** Izgara hücrelerinin kaçı birbirinden FARKLI bir gerçek baloncuğa denk geliyor (sayı). */
  function uniqN(b, BU) {
    const seen = new Set(), tol = 0.5 * Math.min(b.bw, b.bh); let n = 0;
    b.ys.forEach(y => b.xs.forEach(x => { const q = window.OMRDetect.nearestBubble(BU, x, y, tol); if (q && !seen.has(q)) { seen.add(q); n++; } }));
    return n;
  }
  /** Yapay zekânın ızgarası, görüntüden kurulan bloğun bir kenarından ≥1,4 aralık taşıyor ve aralığı tutarlı mı? (silik/algılanmamış satır ya da sütun olabilir) */
  function extension(g, b) {
    const pitch = (v0, v1, n) => n > 1 ? (v1 - v0) / (n - 1) : 0, py = pitch(b.y0, b.y1, b.rows), px = pitch(b.x0, b.x1, b.cols), gy = pitch(g.y0, g.y1, g.rows), gx = pitch(g.x0, g.x1, g.cols);
    const okY = g.cols === b.cols && py > 0 && Math.max(b.y0 - g.y0, g.y1 - b.y1) >= 1.4 * py && Math.abs(gy - py) <= 0.12 * py, okX = g.rows === b.rows && px > 0 && Math.max(b.x0 - g.x0, g.x1 - b.x1) >= 1.4 * px && Math.abs(gx - px) <= 0.12 * px;
    return okY || okX;
  }
  /** Yapay zekâ kutusundan (rect: çerçeve pikseli) aday blok üretir: önce gerçek baloncuklardan (sayılar tutuyorsa en güvenilir), olmazsa verilen satır/sütunla ızgara.
   *  Dönüş: { b, mode: 'bubbles'|'grid', note } ya da null. */
  function candidate(an, e, rect) {
    const D = window.OMRDetect, BU = an.bubbles || [], pitch = an.pitch || 1.8 * an.bsz.w, want = e.rows && e.cols ? { rows: e.rows, cols: e.cols } : null;
    let bub = null;
    (want ? [0, 0.35, 0.7, 1.1] : [0.35]).forEach(k => {
      const rc = { x0: rect.x0 - k * pitch, y0: rect.y0 - k * pitch, x1: rect.x1 + k * pitch, y1: rect.y1 + k * pitch }, r = D.blockFromRect(BU, rc, {});
      if (!r.ok || r.mode !== 'bubbles') return;
      const b = r.block, d = want ? Math.min(Math.abs(b.rows - want.rows) + Math.abs(b.cols - want.cols), Math.abs(b.rows - want.cols) + Math.abs(b.cols - want.rows) + 0.5) : 0;
      if (!bub || d < bub.d) bub = { b, mode: 'bubbles', d };
    });
    if (bub && bub.d <= 0.5) { if (bub.d) bub.note = `Yapay zekâ ${want.rows}×${want.cols} dedi; görüntüde ${bub.b.rows}×${bub.b.cols} bulundu (satır/sütun yer değiştirmiş olabilir)`; return bub; }
    let grid = null;
    if (want) {
      const r = D.blockFromRect(BU, rect, { grid: true, rows: want.rows, cols: want.cols, snap: false });
      if (r.ok) { D.snapBlock(r.block, BU, { range: 1.5 }); grid = { b: r.block, mode: 'grid', d: 0 }; }
    }
    if (!bub) return grid;   // bu kutuda gerçek baloncuk yok (silik baskı): yalnızca yapay zekânın sayıları
    // İkisi de var ve sayılar uyuşmuyor: yapay zekânın ızgarası gerçekten DAHA ÇOK farklı baloncuğa oturuyorsa (kutu kaymış, görüntüden kurulan parçalı kalmış) o seçilir;
    // eşitse yapay zekâ muhtemelen yanlış saymıştır (ya da silik satır vardır): görüntü esas alınır, yapay zekânın sayısı öneri olarak saklanır.
    if (grid && uniqN(grid.b, BU) > uniqN(bub.b, BU)) return grid;
    if (grid && (uniqN(grid.b, BU) >= 0.85 * grid.b.rows * grid.b.cols || extension(grid.b, bub.b))) bub.alt = grid.b;
    bub.note = `Yapay zekâ ${want.rows}×${want.cols} dedi; görüntüde ${bub.b.rows}×${bub.b.cols} baloncuk bulundu, görüntü esas alındı`; return bub;
  }
  const geomOf = b => ({ xs: b.xs.slice(), ys: b.ys.slice(), bw: b.bw, bh: b.bh, rows: b.rows, cols: b.cols, n: b.n, total: b.rows * b.cols });
  function setGeom(an, b, g) { b.xs = g.xs.slice(); b.ys = g.ys.slice(); b.bw = g.bw; b.bh = g.bh; window.OMRDetect.refit(b, an.bubbles || []); b.why = ''; b.conf = 'high'; }

  /* ------------------------------------------------------------------ ad / harf / tür uygulaması (kilitlere saygılı) */
  function applyMeta(b, e, info, H) {
    const lock = b.set || {}, ch = info.ch, kept = info.kept, k = H.auK(b), conf = e.confidence;
    if (e.role && e.role !== b.role && conf >= 0.6) {
      if (lock.role) kept.push(`tür (${H.short[e.role] || e.role} önerildi)`);
      else { const old = b.role; b.role = e.role; b.axis = H.auAxis(b, e.role); if (e.role !== 'questions') b.name = ''; if (old !== e.role && (['studentNo', 'schoolCode'].includes(e.role) || e.role === 'name' || e.role === 'surname' || old === 'name' || old === 'surname')) b.labels = ''; ch.push('rol'); }
    }
    if (e.axis && e.axis !== b.axis && b.role !== 'ignore' && conf >= 0.6 && !b.manual) { b.axis = e.axis; if (!lock.labels) b.labels = ''; ch.push('yön'); }
    const kk = H.auK(b), cur = String(b.labels || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, kk);
    if (b.role === 'questions' && e.name && e.name !== (b.name || '')) { if (lock.name) kept.push(`ders adı ("${e.name.slice(0, 20)}" önerildi)`); else { b.name = e.name; ch.push('ders adı'); } }
    let L = '', same = true;
    if (e.labels) {
      if (b.role === 'questions' || b.role === 'booklet') { L = e.labels.toUpperCase().replace(/[^A-Z]/g, ''); same = L.length !== kk || L === cur; }
      else if (b.role === 'name' || b.role === 'surname') { L = H.auAlpha(e.labels); same = L.length !== kk || L === H.auAlpha(b.labels); }
      else if (b.role === 'studentNo' || b.role === 'schoolCode') { L = e.labels.replace(/\D/g, ''); same = L.length !== kk || L === cur || L === '0123456789'.slice(0, kk); }
    }
    if (L && !same) { if (lock.labels) kept.push(`harfler (${L.slice(0, 12)} önerildi)`); else { b.labels = L; ch.push(b.role === 'name' || b.role === 'surname' ? 'alfabe' : 'harfler'); } }
    return k;
  }

  /* ------------------------------------------------------------------ ana işlev */
  /** Normalleştirilmiş yanıtı `an.blocks` üzerine uygular (yerinde değiştirir; geri alma çağıran tarafta: snapshot). H = { auAxis, auGuessRole, auK, auAlpha, short }.
   *  Dönüş: rapor { edited, added, ignored, suggested, unseen, agree, notes, skipped, order, kept, lines[], changed, boxes[] } */
  function apply(an, resp, H) {
    const D = window.OMRDetect, R = an.rectified, W = R.w, Ht = R.h, BU = an.bubbles || [], blocks = an.blocks;
    const rep = { edited: [], added: [], ignored: [], suggested: [], unseen: [], agree: [], notes: [], skipped: [], order: false, kept: 0, lines: [], changed: false, boxes: [] };
    const ents = resp.entries.map(e => Object.assign({}, e, { rect: e.box ? { x0: e.box[0] * W, y0: e.box[1] * Ht, x1: e.box[2] * W, y1: e.box[3] * Ht } : null }));
    blocks.forEach(b => { b.ai = null; });
    // eşleştirme: önce kutu örtüşmesi (kimlikler kullanıcı düzenlemesiyle değişmiş olabilir), sonra kimlik
    const pairs = []; ents.forEach((e, i) => { if (e.rect) blocks.forEach((b, j) => { const v = iou(e.rect, tight(b, an)); if (v >= 0.3) pairs.push({ i, j, v }); }); });
    pairs.sort((p, q) => q.v - p.v);
    const mE = new Map(), mB = new Map(); pairs.forEach(p => { if (!mE.has(p.i) && !mB.has(p.j)) { mE.set(p.i, p.j); mB.set(p.j, p.i); } });
    ents.forEach((e, i) => { if (mE.has(i) || !e.id) return; const j = blocks.findIndex(b => b.id === e.id); if (j < 0 || mB.has(j)) return; if (e.rect && iou(e.rect, tight(blocks[j], an)) < 0.08) return; mE.set(i, j); mB.set(j, i); });
    const starts = new Map(), addedNow = [], keptMsgs = [];
    ents.forEach((e, i) => {
      const label = (e.role ? H.short[e.role] || e.role : 'blok') + (e.name ? ' · ' + e.name : '') + (e.id ? ' (' + e.id + ')' : '');
      if (e.rect) rep.boxes.push({ box: e.box, id: e.id, role: e.role, name: e.name });
      const j = mE.has(i) ? mE.get(i) : -1;
      if (j >= 0) {   // ---- var olan blok
        const b = blocks[j], info = { ch: [], kept: [], note: e.note, conf: e.confidence }, lock = b.set || {};
        if (e.startNo) starts.set(b, e.startNo);
        if (e.action === 'remove') {
          if (b.manual || lock.role) info.kept.push('"yok say" önerisi'); else if (b.role !== 'ignore') { b.role = 'ignore'; b.name = ''; b.axis = H.auAxis(b, 'ignore'); b.labels = ''; info.ch.push('yok sayıldı'); rep.ignored.push(b); }
          b.ai = info; if (info.kept.length) rep.kept += info.kept.length; return;
        }
        if (e.rect) {
          const c = candidate(an, e, e.rect);
          if (c) {
            const same = c.b.rows === b.rows && c.b.cols === b.cols;
            if (same) { rep.agree.push(b); if (c.note) info.note = [info.note, c.note].filter(Boolean).join(' · '); }
            else if (!b.manual && (c.b.n > b.n || b.n === 0)) { setGeom(an, b, geomOf(c.b)); b.manual = false; info.ch.push(`konum/sayı (${c.b.rows}×${c.b.cols})`); if (c.note) info.note = [info.note, c.note].filter(Boolean).join(' · '); }
            else { info.sugg = Object.assign(geomOf(c.b), { mode: c.mode }); rep.suggested.push(b); if (b.manual) info.kept.push(`konum/sayı (yapay zekâ ${c.b.rows}×${c.b.cols} önerdi)`); }
            if (c.alt && !info.sugg && !(c.alt.rows === b.rows && c.alt.cols === b.cols)) { info.sugg = Object.assign(geomOf(c.alt), { mode: 'grid' }); rep.suggested.push(b); }
          }
        }
        applyMeta(b, e, info, H); b.ai = info; if (info.ch.length) rep.edited.push(b); rep.kept += info.kept.length; return;
      }
      // ---- yeni blok
      if (e.action === 'remove') return;   // olmayan bir şeyi silme önerisi
      if (!e.rect) { rep.skipped.push(`${label}: konum (box) verilmediği için eklenemedi`); return; }
      const c = candidate(an, e, e.rect); if (!c) { rep.skipped.push(`${label}: görüntüde baloncuk bulunamadı; "Bölüm ekle" ile çizin`); return; }
      const nb = c.b, T = tight(nb, an), dup = blocks.find(x => area(inter(T, tight(x, an))) > 0.5 * area(T));
      if (dup) { rep.skipped.push(`${label}: ${dup.id} ile çakışıyor${mB.has(blocks.indexOf(dup)) ? '' : ' (o blok yapay zekâ listesinde yok)'}; blok bölünmesi gerekebilir (Böl…)`); return; }
      nb.id = 'x'; nb.role = e.role || H.auGuessRole(nb, blocks.filter(x => x.role !== 'ignore')); nb.axis = e.axis || H.auAxis(nb, nb.role); nb.manual = false; nb.set = undefined;
      const info = { ch: ['eklendi'], kept: [], note: [e.note, c.note].filter(Boolean).join(' · '), conf: e.confidence, added: true };
      if (e.startNo) starts.set(nb, e.startNo);
      const e2 = Object.assign({}, e, { role: '', axis: '' }); applyMeta(nb, e2, { ch: [], kept: [] }, H);
      if (c.alt && !(c.alt.rows === nb.rows && c.alt.cols === nb.cols)) { info.sugg = Object.assign(geomOf(c.alt), { mode: 'grid' }); rep.suggested.push(nb); }
      if (c.mode === 'grid' && nb.fill < 0.6) { nb.why = 'Izgara gerçek baloncuklarla yeterince örtüşmüyor (silik baskı ya da yanlış konum olabilir); konumu kontrol edin.'; nb.conf = 'low'; }
      nb.ai = info; blocks.push(nb); addedNow.push(nb); rep.added.push(nb); mB.set(blocks.length - 1, i);
    });
    // yapay zekâ listesine hiç girmeyen (tespit edilmiş) bloklar: sil­meden işaretle
    if (resp.complete !== false) blocks.forEach((b, j) => { if (!mB.has(j) && !addedNow.includes(b) && b.role !== 'ignore') { b.ai = { ch: [], kept: [], note: '', conf: null, unseen: true }; rep.unseen.push(b); } });
    // soru sırası: bütün soru bloklarına farklı başlangıç numarası verildiyse sırayı onlara göre kur (elle verilmiş sıra korunur)
    const qs = blocks.filter(b => b.role === 'questions');
    if (!an.keepOrder && qs.length >= 2 && qs.every(b => starts.has(b))) {
      const nos = qs.map(b => starts.get(b));
      if (new Set(nos).size === nos.length) { const sorted = qs.slice().sort((a, c) => starts.get(a) - starts.get(c)); if (sorted.some((b, i) => b !== qs[i])) { let k = 0; const out = blocks.map(b => b.role === 'questions' ? sorted[k++] : b); blocks.splice(0, blocks.length, ...out); an.keepOrder = true; rep.order = true; } }
    }
    D.tidy(blocks, { keepOrder: !!an.keepOrder });
    const ids = a => a.map(b => b.id).join(', ');
    if (rep.edited.length) rep.lines.push(`${rep.edited.length} blok güncellendi (${ids(rep.edited)}).`);
    if (rep.added.length) rep.lines.push(`${rep.added.length} yeni bölüm eklendi: ${rep.added.map(b => `${b.id} ${H.short[b.role] || ''}`.trim()).join(', ')}.`);
    if (rep.ignored.length) rep.lines.push(`${rep.ignored.length} bölüm "yok say" yapıldı (${ids(rep.ignored)}); gerçek bölümse türünü geri seçin.`);
    if (rep.suggested.length) rep.lines.push(`${rep.suggested.length} blokta yapay zekâ farklı konum/sayı önerdi (${ids(rep.suggested)}); blok satırındaki "Yapay zekâ önerisini uygula" ile deneyin (otomatik tanıma korundu).`);
    if (rep.unseen.length) rep.lines.push(`${ids(rep.unseen)}: yapay zekâ bu bloğu listesine almadı (yanlış tespit olabilir; gerekirse "Yok say" ya da Sil).`);
    if (rep.order) rep.lines.push('Soru sırası, yapay zekânın verdiği başlangıç numaralarına göre ayarlandı.');
    if (rep.kept) rep.lines.push(`Elle yaptığınız ${rep.kept} ayar korundu.`);
    rep.skipped.forEach(s => rep.lines.push('Atlandı — ' + s + '.'));
    rep.changed = !!(rep.edited.length || rep.added.length || rep.ignored.length || rep.suggested.length || rep.unseen.length || rep.order || blocks.some(b => b.ai));
    if (!rep.lines.length) rep.lines.push('Yapay zekâ otomatik tanımayla aynı görüşte: değişiklik gerekmedi.');
    return rep;
  }
  /** Bir bloğun bekleyen yapay zekâ önerisini (konum/sayı) uygular; true = uygulandı. */
  function applySuggestion(an, b) {
    const s = b.ai && b.ai.sugg; if (!s) return false; setGeom(an, b, s); b.ai.sugg = null; b.ai.ch = (b.ai.ch || []).concat(`konum/sayı (${b.rows}×${b.cols})`); return true;
  }
  return { SCHEMA, ROLES, extractJson, parse, normalize, hasGeometry, blocksInfo, drawRuler, promptText, candidate, apply, applySuggestion, sentSize, tight };
})();
if (typeof window !== 'undefined') window.AiLayout = AiLayout;
