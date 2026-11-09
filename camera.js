/* camera.js — canlı kamera: 4 köşe işareti görününce kendiliğinden okur, ekranda yönlendirir, doğru/yanlışı anında gösterir.
   Kullanım: Camera.open({ tpl, cfg, examName, process(blob,img)→kayıtlar, commit(kayıt), who(kayıt), review(kayıt), discard(kayıt), onClose() }) */
'use strict';

const Camera = (function () {
  const WORK = 800;            // canlı analiz için kare boyutu (uzun kenar; performans/tespit dengesi)
  const TICK = 150;            // analiz aralığı (ms)
  const HOLD = 6;              // sabit kalması gereken ardışık kare sayısı (~0,8 sn)
  const EDGE = 0.015;          // köşe kadraj kenarına bu orandan yakınsa "uzaklaşın"
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

  /** Köşe dörtgeni için kabul edilen en-boy oranları (tam sayfa ve kesilmiş form) */
  function aspectsOf(tpl) {
    const a = tpl.anchors, loc = dist(a[0], a[1]) / dist(a[0], a[3]);
    if (tpl.kind === 'generated' && tpl.nup > 1 && typeof OMR !== 'undefined' && OMR.PAGE_MARK) { const P = OMR.PAGE_MARK.centers; return [dist(P[0], P[1]) / dist(P[0], P[3]), loc]; }
    return [loc];
  }

  /** Soru → basılı numara / ders etiketi */
  function labelsOf(tpl) {
    const secs = (tpl.opts && tpl.opts.sections) || [], out = {};
    tpl.groups.filter(g => g.role === 'questions').forEach(g => g.ys.forEach((y, i) => {
      const q = g.qStart + i, sn = g.sec !== undefined && secs.length > 1 ? secs[g.sec] : null;
      out[q] = { n: (g.numStart || g.qStart) + i, sec: sn ? String(sn.short || sn.name) : '', sid: sn ? g.sec : -1 };
    }));
    return out;
  }

  function open(ctx) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return toast('Bu tarayıcıda kamera kullanılamıyor (güvenli bağlantı — https — gerekir).', 'bad');
    const tpl = ctx.tpl, cfg = ctx.cfg, ASP = aspectsOf(tpl), QL = labelsOf(tpl);
    const S = {
      stream: null, track: null, timer: 0, startSeq: 0, closed: false, phase: 'search', armed: true, lost: 0, hist: [], sheetFor: null,
      auto: Settings.get('camAutoSave', true), facing: 'environment', torch: false, torchOK: false, n: 0, saved: 0, recs: [], ri: 0, ms: 0
    };

    /* ---------------------------------------------------------------- arayüz */
    const video = h('video', { class: 'cam-video' }); video.setAttribute('playsinline', ''); video.setAttribute('autoplay', ''); video.muted = true;
    const ov = h('canvas', { class: 'cam-ov' });
    const hintIcon = h('span', { class: 'cam-hint-ic' }), hintTxt = h('span', { class: 'cam-hint-tx' });
    const hint = h('div', { class: 'cam-hint idle', 'aria-live': 'polite' }, hintIcon, hintTxt);
    const sub = h('div', { class: 'cam-sub' });
    const bar = h('div', { class: 'cam-bar' }, h('i'));
    const stat = h('div', { class: 'cam-stat' });
    const flash = h('div', { class: 'cam-flash' });
    const sheet = h('div', { class: 'cam-sheet hidden' });
    const btnClose = h('button', { class: 'cam-btn', 'aria-label': 'Kapat', onclick: () => close() }, '✕');
    const btnTorch = h('button', { class: 'cam-btn hidden', 'aria-label': 'Fener', onclick: () => toggleTorch() }, '🔦');
    const btnFlip = h('button', { class: 'cam-btn', 'aria-label': 'Kamerayı değiştir', onclick: () => { S.facing = S.facing === 'environment' ? 'user' : 'environment'; start(); } }, '⟲');
    const btnShot = h('button', { class: 'cam-shot', 'aria-label': 'Şimdi çek', onclick: () => capture(true) }, h('i'));
    const chkAuto = h('input', { type: 'checkbox', checked: S.auto, onchange: e => { S.auto = e.target.checked; Settings.set('camAutoSave', S.auto); } });
    const root = h('div', { class: 'cam', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Canlı kamera' },
      video, ov,
      h('div', { class: 'cam-top' }, btnClose, h('div', { class: 'cam-title' }, ctx.examName || 'Canlı okuma'), btnTorch, btnFlip),
      h('div', { class: 'cam-mid' }, hint, sub, bar),
      h('div', { class: 'cam-bottom' }, h('label', { class: 'cam-auto' }, chkAuto, ' Sorunsuz formları otomatik kuyruğa ekle'), btnShot, stat),
      flash, sheet);
    document.body.append(root); document.body.classList.add('cam-open');

    function setHint(txt, kind, icon, subtxt) {
      hint.className = 'cam-hint ' + (kind || 'idle'); hintTxt.textContent = txt; hintIcon.textContent = icon || ''; sub.textContent = subtxt || '';
    }
    function setBar(p) { bar.firstChild.style.width = Math.round(Math.max(0, Math.min(1, p)) * 100) + '%'; bar.classList.toggle('on', p > 0); }
    function paintStat() { stat.textContent = `Okunan ${S.n} · Kuyruğa eklenen ${S.saved}`; }
    paintStat();

    /* ---------------------------------------------------------------- kamera */
    const work = document.createElement('canvas'), wctx = work.getContext('2d', { willReadFrequently: true });
    async function start() {
      const seq = ++S.startSeq;
      stopStream(); setHint('Yüksek çözünürlüklü kamera açılıyor…', 'busy', '⏳');
      // Cihazın bildirdiği çözünürlük üst sınırını hedefle; desteklenmeyen değeri zorunlu kılma.
      const portrait = window.innerHeight > window.innerWidth;
      const idealW = portrait ? 2160 : 3840, idealH = portrait ? 3840 : 2160;
      const primary = { video: {
        facingMode: { ideal: S.facing },
        width: { ideal: idealW }, height: { ideal: idealH },
        frameRate: { ideal: 30, max: 30 }
      }, audio: false };
      const tries = [primary,
        { video: { facingMode: { ideal: S.facing }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false },
        { video: { facingMode: { ideal: S.facing } }, audio: false },
        { video: true, audio: false }];
      let err = null, stream = null;
      for (const c of tries) {
        try { stream = await navigator.mediaDevices.getUserMedia(c); err = null; break; }
        catch (e) { err = e; if (e && /NotAllowed|Security/.test(e.name)) break; }
      }
      if (S.closed || seq !== S.startSeq) { if (stream) stream.getTracks().forEach(t => t.stop()); return; }
      if (!stream) {
        const denied = err && /NotAllowed|Security/.test(err.name);
        setHint(denied ? 'Kamera izni verilmedi' : 'Kamera açılamadı', 'bad', '⚠', denied ? 'Tarayıcının adres çubuğundan bu site için kamera iznini açın, sonra tekrar deneyin. Ya da Fotoğraf çek / Dosya seç ile devam edin.' : 'Kamera başka bir uygulamada açık olabilir. Fotoğraf çek / Dosya seç ile devam edebilirsiniz.');
        return;
      }
      S.stream = stream; video.srcObject = stream;
      try { await video.play(); } catch (e) { }
      if (S.closed || seq !== S.startSeq) { stopStream(); return; }
      S.track = stream.getVideoTracks()[0];
      try {
        const cap = S.track.getCapabilities ? S.track.getCapabilities() : {};
        const adv = [];
        if (cap.focusMode && cap.focusMode.includes('continuous')) adv.push({ focusMode: 'continuous' });
        if (cap.exposureMode && cap.exposureMode.includes('continuous')) adv.push({ exposureMode: 'continuous' });
        if (cap.whiteBalanceMode && cap.whiteBalanceMode.includes('continuous')) adv.push({ whiteBalanceMode: 'continuous' });
        if (cap.torch) { S.torchOK = true; }
        if (adv.length) await S.track.applyConstraints({ advanced: adv });
        btnTorch.classList.toggle('hidden', !S.torchOK); btnTorch.classList.remove('on');
        const set = S.track.getSettings ? S.track.getSettings() : {};
        S.cameraInfo = { width: set.width || video.videoWidth, height: set.height || video.videoHeight };
      } catch (e) {
        const set = S.track.getSettings ? S.track.getSettings() : {};
        S.cameraInfo = { width: set.width || video.videoWidth, height: set.height || video.videoHeight };
      }
      S.phase = 'search'; S.hist = []; S.lost = 0; S.armed = true;
      clearTimeout(S.timer); S.timer = setTimeout(tick, TICK);
    }
    function stopStream() {
      if (S.stream) { S.stream.getTracks().forEach(t => t.stop()); S.stream = null; }
      if (video.srcObject) video.srcObject = null;
      S.track = null;
    }
    async function toggleTorch() {
      if (!S.track) return;
      try { S.torch = !S.torch; await S.track.applyConstraints({ advanced: [{ torch: S.torch }] }); btnTorch.classList.toggle('on', S.torch); } catch (e) { S.torch = false; toast('Fener açılamadı.', 'bad'); }
    }

    /* ---------------------------------------------------------------- canlı analiz */
    function frameGray() {
      const vw = video.videoWidth, vh = video.videoHeight; if (!vw || !vh) return null;
      const sc = Math.min(1, WORK / Math.max(vw, vh)), w = Math.max(32, Math.round(vw * sc)), hh = Math.max(32, Math.round(vh * sc));
      if (work.width !== w || work.height !== hh) { work.width = w; work.height = hh; }
      wctx.drawImage(video, 0, 0, w, hh);
      const d = wctx.getImageData(0, 0, w, hh);
      return { gray: OMR.rgbaToGray(d.data, w, hh), w, h: hh };
    }

    function tick() {
      if (S.closed) return;
      S.timer = setTimeout(tick, TICK);
      if (S.phase === 'reading') return;
      const f = frameGray(); if (!f) return;
      const t0 = performance.now();
      let p; try { p = OMR.probe(f.gray, f.w, f.h, ASP); } catch (e) { return; }
      S.ms = performance.now() - t0;
      analyze(p, f);
    }

    /** Ekran (CSS px) ↔ kare eşlemesi */
    function view(f) {
      const cw = root.clientWidth, ch = root.clientHeight, k = Math.min(cw / f.w, ch / f.h);
      return { cw, ch, k, ox: (cw - f.w * k) / 2, oy: (ch - f.h * k) / 2 };
    }
    function drawOverlay(f, p, state, prog) {
      const vw = view(f), dpr = Math.min(2, window.devicePixelRatio || 1);
      if (ov.width !== Math.round(vw.cw * dpr) || ov.height !== Math.round(vw.ch * dpr)) { ov.width = Math.round(vw.cw * dpr); ov.height = Math.round(vw.ch * dpr); }
      const c = ov.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, vw.cw, vw.ch);
      const X = x => vw.ox + x * vw.k, Y = y => vw.oy + y * vw.k;
      const col = state === 'ok' ? '#22c55e' : state === 'warn' ? '#f59e0b' : state === 'bad' ? '#ef4444' : 'rgba(255,255,255,.85)';
      // kılavuz çerçeve (formun oranında, kadrajın ortasında)
      const G = guideRect(f, p && p.quad ? p.quad : null);
      c.lineWidth = 2; c.strokeStyle = 'rgba(255,255,255,.55)'; c.setLineDash([8, 6]);
      c.strokeRect(X(G.x), Y(G.y), G.w * vw.k, G.h * vw.k); c.setLineDash([]);
      // köşe parantezleri
      const L = Math.min(G.w, G.h) * vw.k * 0.12; c.lineWidth = 4; c.strokeStyle = col; c.lineCap = 'round';
      [[G.x, G.y, 1, 1], [G.x + G.w, G.y, -1, 1], [G.x + G.w, G.y + G.h, -1, -1], [G.x, G.y + G.h, 1, -1]].forEach(([x, y, sx, sy]) => { c.beginPath(); c.moveTo(X(x) + sx * L, Y(y)); c.lineTo(X(x), Y(y)); c.lineTo(X(x), Y(y) + sy * L); c.stroke(); });
      if (p && p.quad) {
        c.lineWidth = 3; c.strokeStyle = col; c.fillStyle = state === 'ok' ? 'rgba(34,197,94,.14)' : 'rgba(245,158,11,.10)';
        c.beginPath(); p.quad.forEach((q, i) => { i ? c.lineTo(X(q[0]), Y(q[1])) : c.moveTo(X(q[0]), Y(q[1])); }); c.closePath(); c.fill(); c.stroke();
        p.quad.forEach(q => { c.beginPath(); c.arc(X(q[0]), Y(q[1]), 9, 0, 7); c.fillStyle = col; c.fill(); c.lineWidth = 2; c.strokeStyle = '#fff'; c.stroke(); });
        if (prog > 0) { const cx = (p.quad[0][0] + p.quad[2][0]) / 2, cy = (p.quad[0][1] + p.quad[2][1]) / 2; c.beginPath(); c.arc(X(cx), Y(cy), 34, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * prog); c.lineWidth = 7; c.strokeStyle = '#22c55e'; c.stroke(); }
      } else if (p && p.cands) {
        p.cands.forEach(q => { c.beginPath(); c.arc(X(q[0]), Y(q[1]), 7, 0, 7); c.lineWidth = 2; c.strokeStyle = 'rgba(255,255,255,.7)'; c.stroke(); });
      }
    }
    /** Formun oranında, kadraja sığan kılavuz dikdörtgen (dörtgenin yönüne göre dik/yatay) */
    function guideRect(f, quad) {
      let asp = ASP[0];
      if (quad) { const a = ((dist(quad[0], quad[1]) + dist(quad[3], quad[2])) / 2) / ((dist(quad[0], quad[3]) + dist(quad[1], quad[2])) / 2); if ((a - 1) * (asp - 1) < 0) asp = 1 / asp; }
      else if (f.w > f.h && asp < 1) asp = asp;   // yatay kadrajda dik form: kılavuz yine dik
      const mw = f.w * 0.9, mh = f.h * 0.9; let gw = Math.min(mw, mh * asp), gh = gw / asp;
      return { x: (f.w - gw) / 2, y: (f.h - gh) / 2, w: gw, h: gh };
    }

    function analyze(p, f) {
      const G = guideRect(f, p.quad);
      if (S.phase === 'result') {                    // sonuç gösterilirken: form kameradan çekilince kapat
        if (!p.quad) { S.lost++; if (S.lost > 8 && S.sheetFor && S.sheetFor.autoHide) hideSheet(); } else S.lost = 0;
        drawOverlay(f, p, 'idle', 0); return;
      }
      if (!p.quad) {
        S.hist = []; S.lost++; if (S.lost > 6) S.armed = true;
        const n = p.nMarks | 0;
        setHint(n >= 2 ? `Köşe işaretleri aranıyor (${n}/4)` : 'Formu kameraya gösterin', 'idle', '▢', n >= 2 ? 'Formun 4 köşesindeki siyah kareler ve üstteki çubuk görünmeli; düz tutun.' : 'Formun 4 köşesindeki siyah kareler kadrajın içinde olmalı.');
        setBar(0); drawOverlay(f, p, 'idle', 0); return;
      }
      S.lost = 0;
      const q = p.quad, top = dist(q[0], q[1]), bot = dist(q[3], q[2]), lef = dist(q[0], q[3]), rig = dist(q[1], q[2]);
      const cx = (q[0][0] + q[1][0] + q[2][0] + q[3][0]) / 4, cy = (q[0][1] + q[1][1] + q[2][1] + q[3][1]) / 4;
      const area = Math.abs((q[0][0] * q[1][1] - q[1][0] * q[0][1]) + (q[1][0] * q[2][1] - q[2][0] * q[1][1]) + (q[2][0] * q[3][1] - q[3][0] * q[2][1]) + (q[3][0] * q[0][1] - q[0][0] * q[3][1])) / 2;
      const fill = Math.sqrt(area / (G.w * G.h));
      const dx = (cx - f.w / 2) / f.w, dy = (cy - f.h / 2) / f.h;
      const nearEdge = q.some(a => a[0] < f.w * EDGE || a[0] > f.w * (1 - EDGE) || a[1] < f.h * EDGE || a[1] > f.h * (1 - EDGE));
      const skew = Math.max(Math.abs(top / bot - 1), Math.abs(lef / rig - 1));
      root.setAttribute('data-dbg', JSON.stringify({ fill: +fill.toFixed(2), dx: +dx.toFixed(2), dy: +dy.toFixed(2), skew: +skew.toFixed(2), contrast: p.contrast, paper: p.paper, sharp: +p.sharp.toFixed(4), ms: Math.round(S.ms) }));
      let msg = '', icon = '', kind = 'warn', subt = '';
      if (nearEdge) { msg = 'Biraz uzaklaşın'; icon = '⤢'; subt = 'Köşelerden biri kadrajın kenarında.'; }
      else if (fill < 0.62) { msg = 'Yaklaşın'; icon = '⤡'; subt = 'Form kılavuz çerçeveyi doldursun.'; }
      else if (fill > 1.08) { msg = 'Biraz uzaklaşın'; icon = '⤢'; subt = 'Form çerçeveden büyük.'; }
      else if (Math.abs(dx) > 0.07 && Math.abs(dx) >= Math.abs(dy)) { msg = dx > 0 ? 'Sağa kaydırın' : 'Sola kaydırın'; icon = dx > 0 ? '→' : '←'; subt = 'Formu kılavuz çerçevenin ortasına getirin.'; }
      else if (Math.abs(dy) > 0.07) { msg = dy > 0 ? 'Aşağı kaydırın' : 'Yukarı kaydırın'; icon = dy > 0 ? '↓' : '↑'; subt = 'Formu kılavuz çerçevenin ortasına getirin.'; }
      else if (skew > 0.14) { msg = 'Telefonu forma paralel tutun'; icon = '◫'; subt = 'Form eğik görünüyor; kamerayı formun tam üstüne alın.'; }
      else if (p.paper < 95 || p.contrast < 60) { msg = 'Işık yetersiz'; icon = '☀'; subt = 'Daha aydınlık bir yer ya da fener deneyin.'; }
      else if (p.sharp < 0.0035) { msg = 'Net değil, sabit tutun'; icon = '◌'; subt = 'Kamera odaklanana kadar bekleyin; gerekirse biraz uzaklaşın.'; }
      if (msg) { S.hist = []; setHint(msg, kind, icon, subt); setBar(0); drawOverlay(f, p, 'warn', 0); return; }
      if (!S.armed) { setHint('Sonraki formu getirin', 'idle', '✓', 'Bu form okundu. Yeni forma geçince otomatik okunur.'); setBar(0); drawOverlay(f, p, 'ok', 0); return; }
      // sabitlik
      S.hist.push(q.map(a => [a[0], a[1]])); if (S.hist.length > HOLD) S.hist.shift();
      let still = S.hist.length >= 2;
      if (still) { const ref = S.hist[S.hist.length - 1], lim = Math.hypot(f.w, f.h) * 0.012; for (const hq of S.hist) for (let i = 0; i < 4; i++) if (dist(hq[i], ref[i]) > lim) still = false; }
      if (!still) { S.hist = S.hist.slice(-1); setHint('Sabit tutun', 'ok', '✓', 'Form doğru yerde.'); setBar(0.15); drawOverlay(f, p, 'ok', 0.15); return; }
      const prog = S.hist.length / HOLD;
      setHint(prog >= 1 ? 'Okunuyor…' : 'Sabit tutun…', 'ok', '✓', 'Form doğru yerde, otomatik okunacak.'); setBar(prog); drawOverlay(f, p, 'ok', prog);
      if (S.hist.length >= HOLD) capture(false);
    }

    /* ---------------------------------------------------------------- çekim ve okuma */
    async function capture(manual) {
      if (S.phase === 'reading' || !video.videoWidth) return;
      if (S.phase === 'result') hideSheet();
      S.phase = 'reading'; S.hist = []; setBar(0); setHint('Okunuyor…', 'busy', '⏳', 'Form işleniyor.');
      flash.classList.add('on'); setTimeout(() => flash.classList.remove('on'), 160);
      let recs = [];
      try {
        const vw = video.videoWidth, vh = video.videoHeight;
        // Tam çözünürlüğü koru; çok büyük sensör karelerinde bellek tüketimini sınırla.
        const maxEdge = 5000, maxPixels = 24_000_000;
        const sc = Math.min(1, maxEdge / Math.max(vw, vh), Math.sqrt(maxPixels / (vw * vh)));
        const cv = document.createElement('canvas');
        cv.width = Math.round(vw * sc); cv.height = Math.round(vh * sc);
        const cx = cv.getContext('2d', { willReadFrequently: true }); cx.drawImage(video, 0, 0, cv.width, cv.height);
        const d = cx.getImageData(0, 0, cv.width, cv.height), img = { gray: OMR.rgbaToGray(d.data, cv.width, cv.height), w: cv.width, h: cv.height };
        const blob = await new Promise((resolve, reject) => cv.toBlob(b => b ? resolve(b) : reject(new Error('Kamera görüntüsü JPEG olarak hazırlanamadı.')), 'image/jpeg', 0.94));
        recs = await ctx.process(blob, img);
      } catch (e) { recs = [{ error: e.message || 'Okunamadı', status: 'error', flags: [], reasons: [] }]; }
      if (S.closed) return;
      showResult(recs, manual);
    }

    /* ---------------------------------------------------------------- sonuç */
    const keyOf = r => { const ks = cfg.keys || {}, names = Object.keys(ks); if (!names.length) return ''; return ks[r.booklet] || ks[names[0]] || ''; };
    function scoreOf(r) { return Object.keys(cfg.keys || {}).length ? Scoring.scoreStudent(cfg, r.booklet, r.answers) : null; }
    function verdict(r, q) {       // 'd' doğru, 'y' yanlış, 'b' boş, 'm' çoklu, 'n' anahtar yok/iptal
      const k = keyOf(r).charAt(q - 1) || '.', a = r.answers.charAt(q - 1) || '-';
      if (k === '.') return a === '-' ? 'b' : a === '*' ? 'm' : 'n';
      if (k === '*') return 'd';
      if (a === '-') return 'b'; if (a === '*') return cfg.multiIsWrong ? 'y' : 'm';
      return a === k ? 'd' : 'y';
    }

    /** Düzeltilmiş (düzleştirilmiş) form görüntüsü üzerine doğru/yanlış işaretleri çizer */
    function paintForm(cv, img, r) {
      const pv = r.pv; cv.width = pv.w; cv.height = pv.h; const c = cv.getContext('2d'); c.drawImage(img, 0, 0);
      const s = pv.s, rad = tpl.r * s * 1.18, key = keyOf(r); c.lineWidth = Math.max(2.5, rad * 0.26);
      const ring = (x, y, stroke, fillc, dash) => { c.beginPath(); c.arc(x * s, y * s, rad, 0, 7); if (fillc) { c.fillStyle = fillc; c.fill(); } c.strokeStyle = stroke; c.setLineDash(dash || []); c.stroke(); c.setLineDash([]); };
      tpl.groups.filter(g => g.role === 'questions').forEach(g => g.ys.forEach((y, i) => {
        const q = g.qStart + i, a = r.answers.charAt(q - 1) || '-', k = key.charAt(q - 1) || '.', v = verdict(r, q), ja = g.labels.indexOf(a), jk = g.labels.indexOf(k);
        if (v === 'd') { if (ja >= 0) ring(g.xs[ja], y, '#16a34a', 'rgba(34,197,94,.35)'); }
        else if (v === 'y') { if (ja >= 0) ring(g.xs[ja], y, '#dc2626', 'rgba(239,68,68,.35)'); if (jk >= 0) ring(g.xs[jk], y, '#2563eb', null, [5, 4]); }
        else if (v === 'b') { if (jk >= 0) ring(g.xs[jk], y, '#2563eb', null, [5, 4]); }
        else if (v === 'm') { g.xs.forEach(x => ring(x, y, '#f59e0b')); if (jk >= 0) ring(g.xs[jk], y, '#2563eb', null, [5, 4]); }
        else if (ja >= 0) ring(g.xs[ja], y, '#2563eb');
      }));
      ['studentNo', 'schoolCode'].forEach(role => {
        const gg = tpl.groups.find(g => g.role === role), rg = r.groups && r.groups.find(g => g.role === role); if (!gg || !rg) return;
        rg.lines.forEach((l, ci) => { const j = gg.labels.indexOf(l.v); if (j >= 0) ring(gg.xs[ci], gg.ys[j], '#16a34a'); else if (l.v === '*') gg.ys.forEach(y => ring(gg.xs[ci], y, '#f59e0b')); });
      });
      const gb = tpl.groups.find(g => g.role === 'booklet');
      if (gb && r.booklet) { const j = gb.labels.indexOf(r.booklet); if (j >= 0) ring(gb.xs[j], gb.ys[0], '#16a34a'); }
    }

    function hideSheet() { sheet.classList.add('hidden'); clear(sheet); S.sheetFor = null; S.phase = 'search'; S.hist = []; S.lost = 0; }

    async function showResult(recs, manual) {
      S.recs = recs; S.ri = 0; S.n += recs.filter(r => !r.error).length; paintStat();
      const good = recs.filter(r => !r.error);
      // hatalı okumaları listeden temizle
      recs.filter(r => r.error && ctx.discard).forEach(r => { try { ctx.discard(r); } catch (e) { } });
      if (!good.length) {
        const msg = (recs[0] && recs[0].error) || 'Form okunamadı';
        S.phase = 'result'; S.armed = false; S.sheetFor = { autoHide: false };
        clear(sheet).append(h('div', { class: 'cam-card bad' }, h('div', { class: 'cam-res-h' }, h('b', null, '✕ Okunamadı')), h('p', null, msg),
          h('p', { class: 'small' }, 'Formun 4 köşesi ve üstteki siyah çubuk görünür, düz ve net olmalı; gölge düşürmeyin.'),
          h('div', { class: 'row' }, h('button', { class: 'btn primary', onclick: () => { S.armed = true; hideSheet(); } }, 'Tekrar dene'), h('button', { class: 'btn', onclick: () => close() }, 'Kapat'))));
        sheet.classList.remove('hidden'); setHint('Okunamadı', 'bad', '✕', msg); return;
      }
      // sorunsuzları otomatik kaydet
      if (S.auto) for (const r of good) if (r.status === 'ok') { try { await ctx.commit(r); S.saved++; r.camSaved = true; } catch (e) { r.camErr = e.message; } }
      paintStat(); renderSheet();
    }

    async function renderSheet() {
      const r = S.recs.filter(x => !x.error)[S.ri] || null; if (!r) return;
      const good = S.recs.filter(x => !x.error), sc = scoreOf(r), who = ctx.who ? ctx.who(r) : { name: '', school: '' };
      const st = r.camSaved || r.status === 'saved' ? 'saved' : r.status;
      S.phase = 'result'; S.armed = false; S.sheetFor = { autoHide: st === 'saved' };
      const head = st === 'saved' ? h('div', { class: 'cam-res-h ok' }, h('b', null, '✓ Okundu ve kuyruğa eklendi'))
        : st === 'ok' ? h('div', { class: 'cam-res-h ok' }, h('b', null, '✓ Hatasız okundu'))
          : h('div', { class: 'cam-res-h warn' }, h('b', null, '⚠ Kontrol gerekli'));
      const cv = h('canvas', { class: 'cam-form' }), strip = h('div', { class: 'cam-strip' });
      const secs = sc && sc.sections.length > 1 ? h('div', { class: 'cam-secs' }, sc.sections.map(x => h('span', { class: 'chip' }, `${x.name} ${x.D}D ${x.Y}Y ${x.B}B`))) : null;
      // soru soru liste
      let last = -2; const nq = cfg.total, items = [];
      for (let q = 1; q <= nq; q++) {
        const L = QL[q] || { n: q, sec: '', sid: -1 }, v = verdict(r, q), a = r.answers.charAt(q - 1) || '-';
        if (L.sec && L.sid !== last) items.push(h('div', { class: 'cam-seg' }, L.sec)); last = L.sid;
        items.push(h('span', { class: 'qc ' + v, title: `${L.sec ? L.sec + ' ' : ''}${L.n}. soru` }, h('small', null, L.n), h('b', null, a === '-' ? '·' : a)));
      }
      strip.append(...items);
      const multi = good.length > 1 ? h('div', { class: 'cam-multi' }, good.map((x, i) => h('button', { class: 'btn sm' + (i === S.ri ? ' primary' : ''), onclick: () => { S.ri = i; renderSheet(); } }, `Form ${i + 1}${x.studentNo ? ' · ' + x.studentNo : ''}`))) : null;
      const acts = [];
      if (st !== 'saved') acts.push(h('button', { class: 'btn primary', onclick: async () => { try { await ctx.commit(r); r.camSaved = true; S.saved++; paintStat(); renderSheet(); } catch (e) { toast(e.message, 'bad'); } } }, 'Kuyruğa ekle'));
      acts.push(h('button', { class: 'btn', onclick: () => { S.armed = true; hideSheet(); } }, st === 'saved' ? 'Sonraki form' : 'Yeniden çek'));
      if (st !== 'saved') acts.push(h('button', { class: 'btn', onclick: () => { close(); ctx.review && ctx.review(r); } }, 'Düzelt / incele'));
      if (st !== 'saved' && ctx.discard) acts.push(h('button', { class: 'btn ghost', onclick: () => { ctx.discard(r); S.recs = S.recs.filter(x => x !== r); if (S.recs.some(x => !x.error)) { S.ri = 0; renderSheet(); } else { S.armed = true; hideSheet(); } } }, 'At'));
      clear(sheet).append(h('div', { class: 'cam-card ' + (st === 'saved' || st === 'ok' ? 'ok' : 'warn') }, head, multi,
        h('div', { class: 'cam-who' }, h('span', { class: 'no mono' }, r.studentNo || '—'), ' ', h('span', null, who.name || ''), r.booklet ? h('span', { class: 'pill' }, 'Kit. ' + r.booklet) : null, who.school ? h('span', { class: 'pill' }, who.school) : null),
        sc ? h('div', { class: 'cam-score' }, h('span', { class: 'd' }, h('b', null, sc.D), ' doğru'), h('span', { class: 'y' }, h('b', null, sc.Y), ' yanlış'), h('span', { class: 'b' }, h('b', null, sc.B), ' boş'), h('span', { class: 'n' }, 'net ', h('b', null, nf(sc.net))))
          : h('div', { class: 'small muted' }, 'Bu sınav için cevap anahtarı girilmediği için doğru/yanlış hesaplanamadı; okunan işaretler gösteriliyor.'),
        secs, r.reasons && r.reasons.length ? h('div', { class: 'alert warn small' }, r.reasons.join(' · ')) : null,
        r.camErr ? h('div', { class: 'alert bad small' }, r.camErr) : null,
        h('div', { class: 'cam-legend small' }, h('span', { class: 'lg d' }, 'doğru'), h('span', { class: 'lg y' }, 'yanlış'), h('span', { class: 'lg k' }, 'doğru cevap'), h('span', { class: 'lg m' }, 'çoklu işaret')),
        r.blob ? h('div', { class: 'cam-formwrap' }, cv) : null,
        h('details', { class: 'cam-det' }, h('summary', null, 'Soru soru sonuçlar'), strip),
        h('div', { class: 'row cam-acts' }, acts)));
      sheet.classList.remove('hidden');
      const kind = st === 'saved' || st === 'ok' ? 'ok' : 'warn';
      setHint(st === 'saved' ? 'Okundu ✓' : st === 'ok' ? 'Okundu ✓' : 'Kontrol gerekli', kind, kind === 'ok' ? '✓' : '⚠', sc ? `${sc.D} doğru · ${sc.Y} yanlış · ${sc.B} boş · net ${nf(sc.net)}` : '');
      if (r.blob) {
        const url = URL.createObjectURL(r.blob), im = new Image();
        im.onload = () => { paintForm(cv, im, r); URL.revokeObjectURL(url); }; im.src = url;
      }
    }

    /* ---------------------------------------------------------------- kapatma */
    function onKey(e) { if (e.key === 'Escape') close(); }
    document.addEventListener('keydown', onKey);
    function close() {
      if (S.closed) return; S.closed = true; S.startSeq++; clearTimeout(S.timer); stopStream();
      document.removeEventListener('keydown', onKey); root.remove(); document.body.classList.remove('cam-open');
      try { ctx.onClose && ctx.onClose(); } catch (e) { console.error(e); }
    }
    start();
    return { close, state: S };
  }
  return { open, aspectsOf };
})();
