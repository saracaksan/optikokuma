/* scan.js — okutma: görüntü yükle → oku → incele → kuyruğa ekle */
'use strict';

const SC = { examId: '', okulKodu: '', forms: [], students: [], studentMap: {}, busy: false, tplInfo: null, worker: null, seq: 0 };

function examCovers(ex, s) {
  switch (ex.scopeType) {
    case 'genel': return true; case 'il': return s.il === ex.scopeValue;
    case 'ilce': return (s.il + '|' + s.ilce) === ex.scopeValue; case 'okul': return String(s.okulKodu) === String(ex.scopeValue);
  } return false;
}

/* ---------------------------------------------------------------- görüntü yükleme / okuma */
/* ---- PDF (çok sayfalı tarama): pdf.js uygulamayla birlikte gelir, internet gerekmez ---- */
let pdfjsP = null; const PDFDOCS = new WeakMap();
function loadPdfJs() {
  if (!pdfjsP) pdfjsP = import('./vendor/pdf.min.js').then(m => { m.GlobalWorkerOptions.workerSrc = new URL('vendor/pdf.worker.min.js', document.baseURI).href; return m; });
  return pdfjsP;
}
async function getPdfDoc(file) {
  if (PDFDOCS.has(file)) return PDFDOCS.get(file);
  const pdfjs = await loadPdfJs(), data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data, wasmUrl: new URL('vendor/wasm/', document.baseURI).href }).promise; PDFDOCS.set(file, doc); return doc;
}
async function pdfSources(file) {
  const doc = await getPdfDoc(file);
  return Array.from({ length: doc.numPages }, (_, i) => ({ kind: 'pdf', file, page: i + 1, name: `${file.name} · s.${i + 1}` }));
}
async function renderPdfPage(src) {
  const doc = await getPdfDoc(src.file), page = await doc.getPage(src.page), v1 = page.getViewport({ scale: 1 });
  const vp = page.getViewport({ scale: 2800 / Math.max(v1.width, v1.height) });          // uzun kenar ≈ 2800 px (A4'te ~240 dpi)
  const cv = document.createElement('canvas'); cv.width = Math.round(vp.width); cv.height = Math.round(vp.height);
  const cx = cv.getContext('2d', { willReadFrequently: true }); cx.fillStyle = '#fff'; cx.fillRect(0, 0, cv.width, cv.height);
  await page.render({ canvasContext: cx, canvas: cv, viewport: vp }).promise;
  const d = cx.getImageData(0, 0, cv.width, cv.height); page.cleanup();
  return { gray: OMR.rgbaToGray(d.data, cv.width, cv.height), w: cv.width, h: cv.height };
}

async function loadGray(file) {
  if (file.kind === 'pdf') return renderPdfPage(file);
  let bmp;
  try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
  catch (e) { try { bmp = await createImageBitmap(file); } catch (e2) { throw new Error('Görüntü açılamadı (JPG veya PNG kullanın).'); } }
  const sc = Math.min(1, 4200 / Math.max(bmp.width, bmp.height)), w = Math.round(bmp.width * sc), hh = Math.round(bmp.height * sc);
  const cv = document.createElement('canvas'); cv.width = w; cv.height = hh;
  const cx = cv.getContext('2d', { willReadFrequently: true }); cx.drawImage(bmp, 0, 0, w, hh); if (bmp.close) bmp.close();
  const d = cx.getImageData(0, 0, w, hh);
  return { gray: OMR.rgbaToGray(d.data, w, hh), w, h: hh };
}

function runRead(img, tpl, opts) {
  return new Promise(resolve => {
    const fallback = () => {
      try {
        const res = OMR.readPage(img, tpl, opts || {}), previews = [], frame = tpl.frame, s = Math.min(8, 1500 / Math.max(frame.w, frame.h));
        if (res.ok) res.forms.forEach(f => { if (!f.ok) return; const rc = OMR.rectify(img, f.H, frame, s); previews.push({ index: f.index, gray: rc.gray, w: rc.w, h: rc.h, s }); delete f.H; });
        resolve({ res, previews });
      } catch (e) { resolve({ error: e.message }); }
    };
    if (typeof Worker === 'undefined') return fallback();
    try {
      if (!SC.worker) SC.worker = new Worker('worker.js');
      const id = ++SC.seq, w = SC.worker;
      const on = e => { if (e.data.id !== id) return; w.removeEventListener('message', on); w.removeEventListener('error', onErr); resolve(e.data); };
      const onErr = () => { w.removeEventListener('message', on); w.removeEventListener('error', onErr); SC.worker = null; fallback(); };
      w.addEventListener('message', on); w.addEventListener('error', onErr);
      const copy = img.gray.slice();                       // orijinali (elle köşe vb. için) bozmamak için kopya aktarılır
      w.postMessage({ id, gray: copy.buffer, w: img.w, h: img.h, tpl, opts: opts || {} }, [copy.buffer]);
    } catch (e) { fallback(); }
  });
}

function grayToBlob(p) {
  const cv = document.createElement('canvas'); cv.width = p.w; cv.height = p.h; const cx = cv.getContext('2d'), id = cx.createImageData(p.w, p.h), d = id.data, g = p.gray;
  for (let i = 0, j = 0; i < g.length; i++, j += 4) { d[j] = d[j + 1] = d[j + 2] = g[i]; d[j + 3] = 255; }
  cx.putImageData(id, 0, 0); return new Promise(r => cv.toBlob(b => r(b), 'image/jpeg', 0.85));
}

function parseNo(group) {
  const v = group.lines.map(l => l.v); let a = 0, b = v.length;
  while (a < b && v[a] === '-') a++; while (b > a && v[b - 1] === '-') b--;
  const mid = v.slice(a, b);
  if (!mid.length) return { no: '', bad: 'Öğrenci no işaretlenmemiş' };
  if (mid.some(x => x === '-' || x === '*')) return { no: mid.map(x => /\d/.test(x) ? x : '?').join(''), bad: 'Öğrenci no okunamadı (eksik/çift işaret)' };
  return { no: mid.join('') };
}

/* ---------------------------------------------------------------- kayıt değerlendirme */
function evaluate(rec, ctx) {
  const reasons = [], strict = Settings.get('strictFlags', true);
  const cnt = t => rec.flags.filter(f => f.q && f.type === t).length;
  const multi = cnt('multi'), erase = cnt('erase'), weak = cnt('weak');
  if (multi) reasons.push(`${multi} soruda birden fazla işaret`);
  if (erase) reasons.push(`${erase} soruda silinti / soluk ikinci işaret`);
  if (strict && weak) reasons.push(`${weak} soruda zayıf işaret`);
  const hard = [];   // öğretmen onayından sonra da dikkat gerektiren (işaret şüphesi dışındaki) sorunlar
  if (rec.noBad) hard.push(rec.noBad);
  else if (ctx.students.length && !ctx.studentMap[normNo(rec.studentNo)]) hard.push('Öğrenci listede yok');
  if (ctx.needBooklet && !rec.booklet) hard.push('Kitapçık türü işaretlenmemiş');
  if (ctx.dups[normNo(rec.studentNo)] > 1) hard.push('Aynı numara bu oturumda birden fazla formda');
  if (rec.bkConflict) hard.push('Kitapçık çift işaretli');
  reasons.push(...hard); rec.hard = hard; rec.reasons = reasons; if (rec.status !== 'saved') rec.status = reasons.length ? 'check' : 'ok';
}
function evalAll() {
  const ex = examById(SC.examId); if (!ex) return;
  const cfg = examCfg(ex), ctx = { students: SC.students, studentMap: SC.studentMap, needBooklet: Object.keys(cfg.keys).length > 1, dups: {} };
  SC.forms.forEach(r => { if (!r.error && !r.removed && r.studentNo && !r.noBad) { const k = normNo(r.studentNo); ctx.dups[k] = (ctx.dups[k] || 0) + 1; } });
  SC.forms.forEach(r => { if (!r.error && !r.removed) evaluate(r, ctx); });
}

async function makeRecords(file, out, tpl, cfgBooklets) {
  const { res, previews, error } = out;
  if (error || !res || !res.ok) return [{ uid: ++SC.seq, file, fileName: file.name, error: error || (res && res.error) || 'Okunamadı', status: 'error', flags: [], reasons: [] }];
  const recs = [];
  for (const f of res.forms) {
    if (!f.ok) { recs.push({ uid: ++SC.seq, file, fileName: file.name, formIdx: f.index, error: f.error || 'Form okunamadı', status: 'error', flags: [], reasons: [] }); continue; }
    const pv = previews.find(p => p.index === f.index), blob = pv ? await grayToBlob(pv) : null;
    const gno = f.groups.find(g => g.role === 'studentNo'), pn = gno ? parseNo(gno) : { no: '' };
    const bk = f.booklet || (cfgBooklets.length === 1 ? cfgBooklets[0] : '');
    recs.push({
      uid: ++SC.seq, file, fileName: file.name + (res.forms.length > 1 ? ` · form ${f.index + 1}` : ''), formIdx: f.index, orient: res.orientation,
      studentNo: pn.no, noBad: pn.bad || '', booklet: bk, bkConflict: !!f.flags.find(x => x.field === 'booklet' && x.type === 'multi'),
      answers: f.answers, orig: f.answers, flags: f.flags.filter(x => x.q), groups: f.groups, edits: {}, blob, pv: pv ? { w: pv.w, h: pv.h, s: pv.s } : null, status: 'check', reasons: []
    });
  }
  return recs;
}

/* ---------------------------------------------------------------- ana görünüm */
App.views.scan = function (root) {
  const S = App.state;
  const open = S.exams.filter(e => e.status === 'open');
  if (!SC.examId || !examById(SC.examId)) SC.examId = Settings.get('scanExam', '') && examById(Settings.get('scanExam', '')) ? Settings.get('scanExam', '') : (open[0] ? open[0].examId : '');
  const exSel = h('select', { id: 'sc-exam' }, open.length ? open.map(e => h('option', { value: e.examId }, `${e.name}${e.date ? ' · ' + e.date : ''}`)) : h('option', { value: '' }, '(açık sınav yok)'));
  const scSel = h('select', { id: 'sc-school' });
  const info = h('div'), listBox = h('div'), progBox = h('div');
  const fileIn = h('input', { type: 'file', accept: 'image/*,application/pdf,.pdf', multiple: true, class: 'hidden', onchange: e => { handle(Array.from(e.target.files)); e.target.value = ''; } });
  const camIn = h('input', { type: 'file', accept: 'image/*', capture: 'environment', class: 'hidden', onchange: e => { handle(Array.from(e.target.files)); e.target.value = ''; } });
  const drop = h('div', { class: 'drop', id: 'sc-drop' },
    h('p', { style: { margin: '0 0 .6rem' } }, 'Taranmış formları (PDF, JPG, PNG) buraya bırakın ya da seçin. Çok sayfalı PDF sayfa sayfa okunur.'),
    h('div', { class: 'row', style: { justifyContent: 'center' } },
      h('button', { class: 'btn primary', id: 'sc-pick', onclick: () => fileIn.click() }, 'Dosya seç'),
      h('button', { class: 'btn', onclick: () => camIn.click() }, 'Kamera ile çek')),
    h('p', { class: 'small muted', style: { margin: '.7rem 0 0' } }, 'İpucu: formun 4 köşe işareti ve üstteki siyah çubuk görünsün; düz ışık, gölgesiz. Tarayıcı 200–300 dpi en güvenilir sonucu verir.'));
  ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', e => handle(Array.from(e.dataTransfer.files)));

  async function selectExam(id) {
    SC.examId = id; Settings.set('scanExam', id);
    const ex = examById(id); clear(scSel); clear(info);
    if (!ex) { info.append(h('div', { class: 'alert warn' }, 'Okutma için açık bir sınav yok. "Sınavlar" sayfasından sınav oluşturun veya yöneticinizden isteyin.')); drop.classList.add('hidden'); return; }
    drop.classList.remove('hidden');
    const schools = S.schools.filter(s => examCovers(ex, s));
    if (!schools.length) scSel.append(h('option', { value: '' }, '(bu sınavda yetkili olduğunuz okul yok)'));
    schools.forEach(s => scSel.append(h('option', { value: s.okulKodu }, schoolLabel(s))));
    const last = Settings.get('scanSchool', ''); if (schools.some(s => String(s.okulKodu) === String(last))) scSel.value = last;
    SC.tplInfo = resolveTemplate(ex); const cfg = examCfg(ex), t = SC.tplInfo.tpl;
    info.append(h('div', { class: 'chips' }, h('span', { class: 'chip' }, 'Şablon: ' + SC.tplInfo.name), h('span', { class: 'chip' }, `${cfg.total} soru · ${cfg.choices} şık`), h('span', { class: 'chip' }, Object.keys(cfg.keys).length ? 'Cevap anahtarı: ' + Object.keys(cfg.keys).join(', ') : 'Cevap anahtarı görünmüyor'), t.nup > 1 ? h('span', { class: 'chip' }, `Sayfada ${t.nup} form`) : null));
    if (t.questions !== cfg.total || t.choices !== cfg.choices) info.append(h('div', { class: 'alert bad' }, `Şablon (${t.questions} soru, ${t.choices} şık) sınav ayarıyla (${cfg.total} soru, ${cfg.choices} şık) uyuşmuyor. Sınav düzenleme sayfasından şablonu düzeltin.`));
    await selectSchool(scSel.value);
  }
  async function selectSchool(code) {
    SC.okulKodu = code; Settings.set('scanSchool', code); SC.students = code ? await getStudents(code) : []; SC.studentMap = {};
    SC.students.forEach(s => { SC.studentMap[normNo(s.ogrNo)] = s; });
    let st = $('#sc-stu'); if (st) st.remove();
    info.append(h('div', { id: 'sc-stu', class: 'small muted', style: { marginTop: '.4rem' } }, SC.students.length ? `Öğrenci listesi: ${SC.students.length} kayıt (numaralar listeyle doğrulanır)` : 'Bu okul için öğrenci listesi yok; numaralar listeyle doğrulanamaz. Yönetim → Öğrenciler bölümünden yükleyebilirsiniz.'));
    evalAll(); renderList();
  }
  exSel.addEventListener('change', () => { SC.forms = []; selectExam(exSel.value); });
  scSel.addEventListener('change', () => selectSchool(scSel.value));

  async function handle(files) {
    if (SC.busy) return toast('Önceki okutma sürüyor, bekleyin.', 'bad');
    const ex = examById(SC.examId); if (!ex) return toast('Önce sınav seçin.', 'bad');
    if (!SC.okulKodu) return toast('Önce okul seçin.', 'bad');
    SC.busy = true; const src = [];
    for (const f of files) {
      if (/pdf/i.test(f.type) || /\.pdf$/i.test(f.name)) {
        try { src.push(...(await pdfSources(f))); } catch (e) { toast(`${f.name}: PDF açılamadı (${e.message}). Bozuk ya da şifreli olabilir; JPG/PNG olarak da kaydedebilirsiniz.`, 'bad'); }
      } else if (/^image\//.test(f.type) || /\.(jpe?g|png|webp|bmp)$/i.test(f.name)) src.push(f);
    }
    files = src; if (!files.length) { SC.busy = false; return; } const tpl = SC.tplInfo.tpl, cfg = examCfg(ex), bks = ex.config.booklets || Object.keys(cfg.keys);
    for (let i = 0; i < files.length; i++) {
      clear(progBox).append(h('div', { class: 'card' }, h('div', { class: 'small muted' }, `Okunuyor: ${files[i].name} (${i + 1}/${files.length})`), h('div', { class: 'progress' }, h('div', { style: { width: (100 * i / files.length) + '%' } }))));
      let recs;
      try { const img = await loadGray(files[i]); const out = await runRead(img, tpl, {}); recs = await makeRecords(files[i], out, tpl, bks); }
      catch (e) { recs = [{ uid: ++SC.seq, file: files[i], fileName: files[i].name, error: e.message, status: 'error', flags: [], reasons: [] }]; }
      SC.forms.push(...recs); evalAll(); renderList(); await sleep(0);
    }
    clear(progBox); SC.busy = false; renderList();
  }

  /* ---- liste ---- */
  function renderList() {
    clear(listBox); const ex = examById(SC.examId); if (!ex || !SC.forms.length) return;
    const cfg = examCfg(ex), f = SC.forms.filter(x => !x.removed);
    const ok = f.filter(x => x.status === 'ok'), chk = f.filter(x => x.status === 'check'), err = f.filter(x => x.status === 'error'), sv = f.filter(x => x.status === 'saved');
    listBox.append(h('div', { class: 'card' },
      h('div', { class: 'stats' }, h('div', { class: 'stat' }, h('b', null, f.length - err.length), h('span', null, 'form okundu')), h('div', { class: 'stat' }, h('b', { style: { color: 'var(--ok)' } }, ok.length), h('span', null, 'hatasız')),
        h('div', { class: 'stat' }, h('b', { style: { color: chk.length ? 'var(--warn)' : '' } }, chk.length), h('span', null, 'kontrol gerekli')), h('div', { class: 'stat' }, h('b', { style: { color: err.length ? 'var(--bad)' : '' } }, err.length), h('span', null, 'okunamadı')), h('div', { class: 'stat' }, h('b', null, sv.length), h('span', null, 'kuyruğa eklendi'))),
      h('div', { class: 'row', style: { marginTop: '.8rem' } },
        h('button', { class: 'btn primary', id: 'sc-saveok', disabled: !ok.length, onclick: () => saveMany(ok) }, `Hatasız olanları kuyruğa ekle (${ok.length})`),
        chk.length ? h('button', { class: 'btn', onclick: () => openReview(SC.forms.indexOf(chk[0])) }, `Kontrol gerekenleri incele (${chk.length})`) : null,
        h('button', { class: 'btn ghost', onclick: async () => { if (!SC.forms.some(x => x.status !== 'saved') || await confirmBox('Listedeki işlenmemiş okutmalar temizlensin mi?', 'Temizle', true)) { SC.forms = []; renderList(); } } }, 'Listeyi temizle'))));
    const wrap = h('div', { class: 'card' }, h('h2', null, 'Okunan formlar'));
    SC.forms.forEach((r, idx) => {
      if (r.removed) return;
      if (r.status === 'error') {
        wrap.append(h('div', { class: 'formcard check' }, h('span', null, '⚠'), h('div', null, h('b', null, r.fileName), h('div', { class: 'small' }, r.error)),
          h('div', { class: 'row' }, h('button', { class: 'btn sm', onclick: () => manualCorners(r) }, 'Köşeleri elle işaretle'), SC.tplInfo.custom ? h('button', { class: 'btn sm', onclick: () => reread(r, { rot: 1 }) }, '↻ Yön') : null, h('button', { class: 'btn sm ghost', onclick: () => { r.removed = true; renderList(); } }, '✕'))));
        return;
      }
      const stu = SC.studentMap[normNo(r.studentNo)], sc = cfg.keys && Object.keys(cfg.keys).length ? Scoring.scoreStudent(cfg, r.booklet, r.answers) : null;
      wrap.append(h('div', { class: 'formcard ' + (r.status === 'check' ? 'check' : r.status === 'saved' ? 'saved' : '') },
        h('span', { title: r.status }, r.status === 'ok' ? '✓' : r.status === 'saved' ? '⬆' : '⚠'),
        h('div', null, h('div', null, h('span', { class: 'no' }, r.studentNo || '—'), ' ', h('span', null, stu ? `${stu.ad} ${stu.soyad}` : ''), ' ', r.booklet ? h('span', { class: 'pill' }, 'Kit. ' + r.booklet) : null),
          h('div', { class: 'small ' + (r.reasons.length ? '' : 'muted') }, r.status === 'saved' ? 'Kuyruğa eklendi' : (r.reasons.length ? r.reasons.join(' · ') : 'Sorun yok'), sc ? ` · D ${sc.D} Y ${sc.Y} B ${sc.B} · net ${nf(sc.net)}` : '', h('span', { class: 'muted' }, ' · ' + r.fileName))),
        h('div', { class: 'row' }, h('button', { class: 'btn sm', onclick: () => openReview(idx) }, r.status === 'saved' ? 'Göster' : 'İncele'))));
    });
    listBox.append(wrap);
  }

  async function reread(r, extra) {
    const ex = examById(SC.examId), cfg = examCfg(ex), bks = ex.config.booklets || Object.keys(cfg.keys);
    try {
      const img = await loadGray(r.file); r.rot = ((r.rot || 0) + ((extra && extra.rot) || 0)) % 4;
      const out = await runRead(img, SC.tplInfo.tpl, Object.assign({ rot: r.rot }, extra && extra.corners ? { corners: extra.corners } : {}));
      const recs = await makeRecords(r.file, out, SC.tplInfo.tpl, bks), at = SC.forms.indexOf(r);
      recs.forEach(x => { x.rot = r.rot; }); SC.forms.splice(at, 1, ...recs); evalAll(); renderList();
      if (recs[0] && recs[0].status === 'error') toast(recs[0].error, 'bad');
    } catch (e) { toast(e.message, 'bad'); }
  }

  /* ---- kuyruğa ekleme ---- */
  async function commit(r) {
    const ex = examById(SC.examId), cfg = examCfg(ex), sch = schoolByCode(SC.okulKodu);
    if (r.answers.length !== cfg.total) throw new Error(`Cevap sayısı (${r.answers.length}) sınavdaki soru sayısıyla (${cfg.total}) uyuşmuyor. Şablonu kontrol edin.`);
    const no = normNo(r.studentNo); if (!/^\d+$/.test(no)) throw new Error('Geçerli bir öğrenci numarası girin.');
    const stu = SC.studentMap[no];
    const bk = r.booklet || (Object.keys(cfg.keys).length === 1 ? Object.keys(cfg.keys)[0] : '');
    const res = await Queue.add({ examId: ex.examId, examName: ex.name, okulKodu: String(SC.okulKodu), okulAdi: sch ? sch.okulAdi : '', ogrNo: no, ad: stu ? `${stu.ad} ${stu.soyad}` : '', booklet: bk, answers: r.answers, flags: r.flags.slice(0, 40).map(f => ({ q: f.q, t: f.type })), scannedAt: new Date().toISOString() });
    r.status = 'saved'; return res;
  }
  async function saveMany(list) {
    let n = 0, rep = 0; for (const r of list) { try { const x = await commit(r); n++; if (x.replaced) rep++; } catch (e) { toast(`${r.fileName}: ${e.message}`, 'bad'); } }
    renderList(); toast(`${n} form kuyruğa eklendi` + (rep ? ` (${rep} tanesi önceki okutmanın yerine geçti)` : ''), 'ok');
    if (Settings.get('autoSync', true) && App.state.online) App.syncQueue();
  }

  /* ---- inceleme penceresi ---- */
  function openReview(idx0) {
    let idx = idx0, activeQ = 1, onlyFlags = false, dlg;
    const ex = examById(SC.examId), cfg = examCfg(ex), tpl = SC.tplInfo.tpl, labels = 'ABCDEFGH'.slice(0, cfg.choices).split('');
    const qpos = {}; tpl.groups.filter(g => g.role === 'questions').forEach(g => g.ys.forEach((y, i) => { qpos[g.qStart + i] = { xs: g.xs, y, labels: g.labels }; }));
    const body = h('div');
    const img = new Image(); let curBlobUrl = '';
    const canvas = h('canvas'), wrap = h('div', { class: 'canvaswrap', onclick: () => wrap.classList.toggle('zoom') }, canvas);
    const grid = h('div', { class: 'agrid', tabindex: '0' }), fields = h('div'), sumBox = h('div', { class: 'small' });
    function cur() { return SC.forms[idx]; }

    function draw() {
      const r = cur(); if (!r || !r.pv || !img.complete) return;
      canvas.width = r.pv.w; canvas.height = r.pv.h; const cx = canvas.getContext('2d'); cx.drawImage(img, 0, 0); const s = r.pv.s, rad = tpl.r * s * 1.12;
      cx.lineWidth = Math.max(2, rad * 0.22);
      for (let q = 1; q <= cfg.total; q++) {
        const p = qpos[q]; if (!p) continue; const a = r.answers[q - 1], fl = r.flags.find(f => f.q === q), ed = r.edits[q];
        if (q === activeQ) { cx.fillStyle = 'rgba(255,214,0,.28)'; cx.fillRect((p.xs[0] - tpl.r * 2.2) * s, (p.y - tpl.r * 1.5) * s, (p.xs[p.xs.length - 1] - p.xs[0] + tpl.r * 4.4) * s, tpl.r * 3 * s); }
        if (a === '*') { cx.strokeStyle = '#ff7a00'; p.xs.forEach(x => { cx.beginPath(); cx.arc(x * s, p.y * s, rad, 0, 7); cx.stroke(); }); continue; }
        const j = p.labels.indexOf(a);
        if (j >= 0) { cx.strokeStyle = ed ? '#2d6df6' : (fl ? '#ff7a00' : '#16a34a'); cx.beginPath(); cx.arc(p.xs[j] * s, p.y * s, rad, 0, 7); cx.stroke(); }
        else if (fl && fl.type === 'weak') { cx.strokeStyle = '#ff7a00'; cx.setLineDash([4, 4]); p.xs.forEach(x => { cx.beginPath(); cx.arc(x * s, p.y * s, rad, 0, 7); cx.stroke(); }); cx.setLineDash([]); }
      }
      const gno = tpl.groups.find(g => g.role === 'studentNo');
      if (gno) { const lines = r.groups.find(g => g.role === 'studentNo').lines; cx.strokeStyle = '#16a34a'; lines.forEach((l, ci) => { const j = gno.labels.indexOf(l.v); if (j >= 0) { cx.beginPath(); cx.arc(gno.xs[ci] * s, gno.ys[j] * s, rad, 0, 7); cx.stroke(); } else if (l.v === '*') { cx.strokeStyle = '#ff7a00'; gno.ys.forEach(y => { cx.beginPath(); cx.arc(gno.xs[ci] * s, y * s, rad, 0, 7); cx.stroke(); }); cx.strokeStyle = '#16a34a'; } }); }
      const gbk = tpl.groups.find(g => g.role === 'booklet');
      if (gbk && r.booklet) { const j = gbk.labels.indexOf(r.booklet); if (j >= 0) { cx.strokeStyle = '#16a34a'; cx.beginPath(); cx.arc(gbk.xs[j] * s, gbk.ys[0] * s, rad, 0, 7); cx.stroke(); } }
      // aktif sorunun satırına kaydır
      if (p0()) { const cont = wrap, sc = cont.clientWidth / canvas.width, p = p0(); cont.scrollTop = Math.max(0, p.y * s * sc - cont.clientHeight / 2); }
    }
    const p0 = () => qpos[activeQ];

    function setAns(q, a) { const r = cur(); const arr = r.answers.split(''); if (arr[q - 1] === a) return; arr[q - 1] = a; r.answers = arr.join(''); r.edits[q] = true; r.edited = true; paintGrid(); draw(); paintSummary(); }
    function paintGrid() {
      const r = cur(); clear(grid); const flagged = new Set(r.flags.map(f => f.q));
      for (let q = 1; q <= cfg.total; q++) {
        if (onlyFlags && !flagged.has(q) && !r.edits[q]) continue;
        const a = r.answers[q - 1];
        grid.append(h('div', { class: 'acell' + (a === '-' ? ' blank' : '') + (flagged.has(q) ? ' flag' : '') + (q === activeQ ? ' active' : '') + (r.edits[q] ? ' chg' : ''), 'data-q': q, onclick: () => {
          activeQ = q; const nx = a === '*' ? labels[0] : ['-', ...labels][(['-', ...labels].indexOf(a) + 1) % (labels.length + 1)]; setAns(q, nx);
        } }, h('small', null, q), h('b', null, a === '-' ? '·' : a)));
      }
      if (!grid.children.length) grid.append(h('div', { class: 'muted small', style: { gridColumn: '1/-1', padding: '.5rem' } }, 'Sorunlu soru yok.'));
    }
    function paintSummary() {
      const r = cur(); clear(sumBox);
      const sc = Object.keys(cfg.keys).length ? Scoring.scoreStudent(cfg, r.booklet, r.answers) : null;
      const blanks = r.answers.split('').filter(c => c === '-').length, multi = r.answers.split('').filter(c => c === '*').length;
      sumBox.append(h('div', null, `${cfg.total} sorudan ${cfg.total - blanks - multi} işaretli, ${blanks} boş`, multi ? `, ${multi} çoklu işaret` : '', sc ? ` · D ${sc.D} · Y ${sc.Y} · B ${sc.B} · net ${nf(sc.net)}` : ''));
    }
    function paintFields() {
      const r = cur(); clear(fields);
      const no = h('input', { type: 'text', inputmode: 'numeric', value: r.studentNo, class: 'mono', oninput: e => { r.studentNo = e.target.value.replace(/[^0-9?]/g, ''); r.noBad = /\?/.test(r.studentNo) || !r.studentNo ? 'Öğrenci no okunamadı' : ''; const st = SC.studentMap[normNo(r.studentNo)]; nm.textContent = st ? `${st.ad} ${st.soyad} · ${st.sinif || ''}` : (SC.students.length ? 'Listede yok' : ''); nm.style.color = st || !SC.students.length ? '' : 'var(--bad)'; } });
      const st0 = SC.studentMap[normNo(r.studentNo)], nm = h('div', { class: 'small', style: { color: st0 || !SC.students.length ? '' : 'var(--bad)' } }, st0 ? `${st0.ad} ${st0.soyad} · ${st0.sinif || ''}` : (SC.students.length ? 'Listede yok' : ''));
      const bks = ex.config.booklets || Object.keys(cfg.keys);
      const bk = h('select', { value: r.booklet, onchange: e => { r.booklet = e.target.value; r.bkConflict = false; paintSummary(); } }, h('option', { value: '' }, '— seçilmedi —'), bks.map(b => h('option', { value: b }, b)));
      fields.append(h('div', { class: 'grid' }, h('div', { class: 'field' }, h('label', null, 'Öğrenci no'), no, nm), h('div', { class: 'field' }, h('label', null, 'Kitapçık'), bk)));
      if (r.reasons.length) fields.append(h('div', { class: 'alert warn' }, r.reasons.join(' · ')));
    }
    function paintAll() {
      const r = cur(); if (!r) return dlg.close();
      if (curBlobUrl) URL.revokeObjectURL(curBlobUrl);
      if (r.blob) { curBlobUrl = URL.createObjectURL(r.blob); img.onload = draw; img.src = curBlobUrl; }
      paintFields(); paintGrid(); paintSummary(); title.textContent = `${r.fileName}  (${visible().indexOf(idx) + 1}/${visible().length})`;
      navBtns();
    }
    const visible = () => SC.forms.map((r, i) => (r.removed || r.status === 'error') ? -1 : i).filter(i => i >= 0);
    const title = h('span');
    const prev = h('button', { class: 'btn', onclick: () => go(-1) }, '◀ Önceki'), next = h('button', { class: 'btn', onclick: () => go(1) }, 'Sonraki ▶');
    const go = d => { const v = visible(), p = v.indexOf(idx), n = v[p + d]; if (n !== undefined) { idx = n; activeQ = 1; paintAll(); } };
    const navBtns = () => { const v = visible(), p = v.indexOf(idx); prev.disabled = p <= 0; next.disabled = p >= v.length - 1; };
    const fix = async () => {
      const r = cur(); evalAll();
      if (r.hard.length && !(await confirmBox('Bu formda hâlâ uyarılar var: ' + r.hard.join('; ') + '. Yine de kuyruğa eklensin mi?', 'Ekle'))) return;
      try { const x = await commit(r); toast(x.replaced ? 'Önceki okutmanın yerine geçti' : 'Kuyruğa eklendi', 'ok'); } catch (e) { return toast(e.message, 'bad'); }
      const v = visible(), nxt = v.find(i => i > idx && SC.forms[i].status !== 'saved'); evalAll(); renderList();
      if (nxt !== undefined) { idx = nxt; activeQ = 1; paintAll(); } else { dlg.close(); if (Settings.get('autoSync', true) && App.state.online) App.syncQueue(); }
    };
    body.append(h('div', { class: 'review' }, h('div', null, wrap, h('p', { class: 'small muted' }, 'Yeşil: okunan işaret · Turuncu: şüpheli · Mavi: sizin düzeltmeniz. Büyütmek için görüntüye dokunun.')),
      h('div', null, fields, h('div', { class: 'row between', style: { margin: '.6rem 0 .3rem' } }, h('b', null, 'Cevaplar'), h('label', { class: 'small row' }, h('input', { type: 'checkbox', onchange: e => { onlyFlags = e.target.checked; paintGrid(); } }), 'yalnız sorunlular')),
        grid, h('p', { class: 'small muted' }, 'Hücreye dokununca cevap döner (· → A → B …). Klavye: ', h('span', { class: 'kb' }, 'A–E'), ' cevap, ', h('span', { class: 'kb' }, 'Boşluk'), ' boş, ', h('span', { class: 'kb' }, '← →'), ' soru değiştir.'), sumBox)));
    const onKey = e => {
      if (/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) return;
      const k = e.key.toUpperCase();
      if (labels.includes(k)) { setAns(activeQ, k); if (activeQ < cfg.total) activeQ++; paintGrid(); draw(); e.preventDefault(); }
      else if (k === ' ' || k === 'BACKSPACE' || k === '-') { setAns(activeQ, '-'); if (activeQ < cfg.total) activeQ++; paintGrid(); draw(); e.preventDefault(); }
      else if (k === 'ARROWRIGHT' || k === 'ARROWDOWN') { activeQ = Math.min(cfg.total, activeQ + 1); paintGrid(); draw(); e.preventDefault(); }
      else if (k === 'ARROWLEFT' || k === 'ARROWUP') { activeQ = Math.max(1, activeQ - 1); paintGrid(); draw(); e.preventDefault(); }
    };
    document.addEventListener('keydown', onKey);
    dlg = modal('Form incelemesi', h('div', null, h('div', { class: 'small muted', style: { marginBottom: '.5rem' } }, title), body), {
      size: 'full', noBackdrop: true, onClose: () => { document.removeEventListener('keydown', onKey); if (curBlobUrl) URL.revokeObjectURL(curBlobUrl); evalAll(); renderList(); },
      buttons: [
        { label: 'Bu formu at', cls: 'danger', fn: () => { cur().removed = true; return true; } },
        SC.tplInfo.custom ? { label: '↻ Yönü değiştir', keepOpen: true, fn: (e, close) => { const r = cur(); close(); reread(r, { rot: 1 }); } } : { label: 'Köşeleri elle işaretle', keepOpen: true, fn: (e, close) => { const r = cur(); close(); manualCorners(r); } },
        { label: 'Kapat' }, { label: 'Onayla ve kuyruğa ekle', cls: 'primary', keepOpen: true, fn: fix }]
    });
    const foot = $('footer', dlg.el); if (foot) { foot.prepend(next); foot.prepend(prev); }
    paintAll(); setTimeout(() => { try { grid.focus(); } catch (e) { } }, 50);
  }

  /* ---- elle köşe işaretleme ---- */
  async function manualCorners(r) {
    let img; try { img = await loadGray(r.file); } catch (e) { return toast(e.message, 'bad'); }
    const tpl = SC.tplInfo.tpl, pts = [], names = ['sol-üst', 'sağ-üst', 'sağ-alt', 'sol-alt'];
    const dispW = Math.min(1000, img.w), k = img.w / dispW, cv = h('canvas'); cv.width = dispW; cv.height = Math.round(img.h / k);
    const cx = cv.getContext('2d'), id = cx.createImageData(cv.width, cv.height);
    for (let y = 0; y < cv.height; y++) for (let x = 0; x < cv.width; x++) { const v = img.gray[Math.min(img.h - 1, Math.round(y * k)) * img.w + Math.min(img.w - 1, Math.round(x * k))], o = (y * cv.width + x) * 4; id.data[o] = id.data[o + 1] = id.data[o + 2] = v; id.data[o + 3] = 255; }
    const msg = h('div', { class: 'alert info' }), paint = () => {
      cx.putImageData(id, 0, 0); cx.fillStyle = '#e11'; cx.strokeStyle = '#e11'; cx.lineWidth = 2; pts.forEach((p, i) => { cx.beginPath(); cx.arc(p[0] / k, p[1] / k, 8, 0, 7); cx.stroke(); cx.fillText(String(i + 1), p[0] / k + 10, p[1] / k - 10); });
      msg.textContent = pts.length < 4 ? `${pts.length + 1}. noktaya dokunun: formun ${names[pts.length]} köşe işaretinin ortası` : '4 nokta işaretlendi. "Oku" ile devam edin.';
    };
    cv.addEventListener('click', e => { if (pts.length >= 4) return; const b = cv.getBoundingClientRect(); pts.push([(e.clientX - b.left) * (cv.width / b.width) * k, (e.clientY - b.top) * (cv.height / b.height) * k]); paint(); });
    paint();
    modal('Köşeleri elle işaretle', h('div', null, msg, h('div', { class: 'tcanvas' }, cv), h('p', { class: 'small muted' }, 'Formu dik tutulmuş haliyle düşünün: sırayla sol-üst, sağ-üst, sağ-alt, sol-alt köşe işaretleri.')), {
      size: 'wide', buttons: [{ label: 'Son noktayı geri al', keepOpen: true, fn: () => { pts.pop(); paint(); } }, { label: 'Vazgeç' }, {
        label: 'Oku', cls: 'primary', fn: () => {
          if (pts.length < 4) { toast('4 köşeyi de işaretleyin', 'bad'); return false; }
          const A = tpl.kind === 'generated' && tpl.nup > 1 ? OMR.PAGE_MARK.centers : tpl.anchors, aw = Math.hypot(A[1][0] - A[0][0], A[1][1] - A[0][1]), ah = Math.hypot(A[3][0] - A[0][0], A[3][1] - A[0][1]);
          const d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]), scale = (d(pts[0], pts[1]) / aw + d(pts[0], pts[3]) / ah) / 2, sizePx = (tpl.kind === 'generated' && tpl.nup > 1 ? OMR.PAGE_MARK.size : tpl.anchorSize) * scale;
          const ref = pts.map(p => { const q = OMR.refineMark(img.gray, img.w, img.h, p[0], p[1], 1, sizePx, Math.max(12, Math.max(img.w, img.h) * 0.03)); return q ? [q.x, q.y] : p; });
          reread(r, { corners: ref });
        }
      }]
    });
  }

  root.append(h('h1', null, 'Optik okutma'),
    h('div', { class: 'card' }, h('div', { class: 'grid' }, h('div', { class: 'field' }, h('label', { for: 'sc-exam' }, 'Sınav'), exSel), h('div', { class: 'field' }, h('label', { for: 'sc-school' }, 'Okul'), scSel)), info),
    drop, fileIn, camIn, progBox, listBox);
  if (SC.examId) exSel.value = SC.examId;
  selectExam(exSel.value || '');
};
