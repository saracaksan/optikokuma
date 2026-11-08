/* forms.js — form tasarlama/yazdırma (1/2/4/8 sığdırma) ve harici optik şablon tanımlama */
'use strict';

const FM = { tab: 'design', opts: null };

App.views.forms = function (root) {
  const tabs = [['design', 'Form tasarla ve yazdır'], ['custom', 'Harici optik tanımla']];
  const tb = h('div', { class: 'tabs' }), pane = h('div');
  const draw = () => { clear(tb).append(...tabs.map(([id, l]) => h('button', { class: FM.tab === id ? 'active' : '', onclick: () => { FM.tab = id; draw(); } }, l))); clear(pane); (FM.tab === 'design' ? designTab : customTab)(pane); };
  root.append(h('h1', null, 'Optik formlar'), tb, pane); draw();
};

/* ================================================================ tasarla / yazdır */
function designTab(pane) {
  const S = App.state, o = FM.opts || { title: 'OPTİK CEVAP KAĞIDI', examName: '', questions: 40, choices: 5, digits: 8, booklets: ['A', 'B'], nup: 1, sections: [] };
  FM.opts = o; let templateId = FM.templateId || '';
  const inp = (key, type, extra) => h('input', Object.assign({ type: type || 'text', value: o[key], oninput: e => { o[key] = type === 'number' ? (parseInt(e.target.value) || 0) : e.target.value; refresh(); } }, extra || {}));
  const nupSel = h('select', { onchange: e => { o.nup = +e.target.value; refresh(); } }, [[1, 'Sayfada 1 form (A4 tam)'], [2, 'Sayfada 2 form'], [4, 'Sayfada 4 form'], [8, 'Sayfada 8 form']].map(([v, l]) => h('option', { value: v }, l))); nupSel.value = o.nup;
  const choiceSel = h('select', { onchange: e => { o.choices = +e.target.value; refresh(); } }, [2, 3, 4, 5, 6, 7, 8].map(n => h('option', { value: n }, n + ' şık'))); choiceSel.value = o.choices;
  const bk = h('input', { type: 'text', value: o.booklets.join(','), placeholder: 'A,B (kitapçık yoksa boş bırakın)', oninput: e => { o.booklets = Array.from(new Set(e.target.value.toUpperCase().split(/[^A-Z]+/).filter(Boolean))).slice(0, 6); refresh(); } });
  const exSel = h('select', { onchange: () => {
    const ex = examById(exSel.value); if (!ex) return; const cfg = examCfg(ex);
    Object.assign(o, { examName: ex.name, questions: cfg.total, choices: cfg.choices, booklets: (ex.config.booklets || Object.keys(cfg.keys)).slice(), sections: cfg.sections.map(s => ({ name: s.name, count: s.count })), digits: o.digits || 8 });
    FM.opts = o; clear(pane); designTab(pane);
  } }, h('option', { value: '' }, 'Sınavdan doldur…'), S.exams.map(e => h('option', { value: e.examId }, e.name)));
  const preview = h('div', { class: 'preview' }), msg = h('div');
  function build() {
    try { return OMR.buildTemplate(Object.assign({}, o, { sections: o.sections || [] })); }
    catch (e) {
      let cap = 0; for (let q = Math.min(o.questions - 1, 200); q >= 1; q--) { try { OMR.buildTemplate(Object.assign({}, o, { questions: q, sections: [] })); cap = q; break; } catch (e2) { } }
      return { error: e.message + (cap ? ` Bu ayarlarla (${o.nup}/sayfa, ${o.choices} şık, ${o.digits} haneli no) en fazla ${cap} soru sığar.` : ' Öğrenci no hane sayısını veya şık sayısını azaltmayı deneyin.') };
    }
  }
  function refresh() {
    const t = build(); clear(msg);
    if (t.error) { clear(preview); msg.append(h('div', { class: 'alert bad' }, t.error)); return; }
    preview.innerHTML = OMR.renderPageSVG(t, [{ name: 'Ad Soyad (örnek)', school: 'Okul', cls: '8-A', studentNo: '12345678'.slice(0, o.digits) }]);
    msg.append(h('div', { class: 'chips' }, h('span', { class: 'chip' }, `Baloncuk aralığı ${t.pitch} mm`), h('span', { class: 'chip' }, `${t.groups.filter(g => g.role === 'questions').length} sütun`)));
  }
  const tplList = h('div');
  function drawTpl() {
    clear(tplList); const mine = S.templates.filter(t => t.json && t.json.kind === 'generated');
    if (!mine.length) { tplList.append(h('p', { class: 'small muted' }, 'Kayıtlı form şablonu yok.')); return; }
    tplList.append(h('div', { class: 'tablewrap', style: { maxHeight: '240px' } }, h('table', null, h('tbody', null, S.templates.map(t => h('tr', null, h('td', null, t.name), h('td', { class: 'small muted' }, t.json && t.json.kind === 'custom' ? 'harici form' : (t.json && t.json.opts ? `${t.json.opts.questions} soru · ${t.json.opts.nup}/sayfa` : '')),
      h('td', { class: 'right nowrap' }, t.json && t.json.kind === 'generated' ? h('button', { class: 'btn sm', onclick: () => { FM.opts = Object.assign({}, t.json.opts); FM.templateId = t.templateId; clear(pane); designTab(pane); } }, 'Aç') : null,
        h('button', { class: 'btn sm danger', onclick: async () => { if (!(await confirmBox(`"${t.name}" şablonu silinsin mi? Bu şablonu kullanan sınavlar otomatik şablona döner.`, 'Sil', true))) return; try { await api('deleteTemplate', { templateId: t.templateId }); await refreshBase(); drawTpl(); } catch (e) { toast(e.message, 'bad'); } } }, 'Sil'))))))));
  }
  async function saveTpl() {
    const t = build(); if (t.error) return toast(t.error, 'bad');
    const nm = h('input', { type: 'text', value: (o.examName || o.title) + ` (${o.nup}/sayfa)` });
    modal('Şablonu kaydet', h('div', null, h('div', { class: 'field' }, h('label', null, 'Şablon adı'), nm), h('p', { class: 'small muted' }, 'Kaydedilen şablon sınav ayarlarında seçilir; okutma bu şablona göre yapılır. Formu yazdırdıktan sonra boyutunu/ayarını değiştirmeyin.')), { buttons: [{ label: 'Vazgeç' }, { label: 'Kaydet', cls: 'primary', fn: async () => {
      try { const r = await api('saveTemplate', { templateId: templateId || undefined, name: nm.value, template: { kind: 'generated', opts: Object.assign({}, o) } }); FM.templateId = templateId = r.templateId; await refreshBase(); drawTpl(); toast('Şablon kaydedildi', 'ok'); } catch (e) { toast(e.message, 'bad'); return false; }
    } }] });
  }
  function printSheets(formsList) {
    const t = build(); if (t.error) return toast(t.error, 'bad');
    const per = t.nup, pa = clear($('#printArea'));
    for (let i = 0; i < formsList.length; i += per) { const sh = h('div', { class: 'sheet' }); sh.innerHTML = OMR.renderPageSVG(t, formsList.slice(i, i + per)); pa.append(sh); }
    const done = () => { clear(pa); window.removeEventListener('afterprint', done); }; window.addEventListener('afterprint', done); setTimeout(() => window.print(), 150);
  }
  const copies = h('input', { type: 'number', min: 1, max: 500, value: 8, style: { width: '90px' } });
  const schSel = h('select', null, h('option', { value: '' }, 'Okul seçin…'), S.schools.map(s => h('option', { value: s.okulKodu }, schoolLabel(s)))), prefill = h('input', { type: 'checkbox', checked: true }), clsSel = h('select', null, h('option', { value: '' }, 'Tüm sınıflar'));
  let stu = [];
  schSel.addEventListener('change', async () => { stu = schSel.value ? await getStudents(schSel.value) : []; clear(clsSel).append(h('option', { value: '' }, 'Tüm sınıflar'), ...Array.from(new Set(stu.map(s => s.sinif).filter(Boolean))).sort().map(c => h('option', { value: c }, c))); info.textContent = stu.length ? `${stu.length} öğrenci` : 'Bu okulda öğrenci listesi yok.'; });
  const info = h('span', { class: 'small muted' });

  pane.append(h('div', { class: 'review' },
    h('div', null,
      h('div', { class: 'card' }, h('h2', null, 'Form ayarları'),
        h('div', { class: 'field' }, h('label', null, 'Mevcut sınavdan al'), exSel),
        h('div', { class: 'grid', style: { marginTop: '.7rem' } }, h('div', { class: 'field' }, h('label', null, 'Form başlığı'), inp('title')), h('div', { class: 'field' }, h('label', null, 'Sınav adı (başlıkta görünür)'), inp('examName')),
          h('div', { class: 'field' }, h('label', null, 'Soru sayısı'), inp('questions', 'number', { min: 1, max: 200 })), h('div', { class: 'field' }, h('label', null, 'Şık sayısı'), choiceSel),
          h('div', { class: 'field' }, h('label', null, 'Öğrenci no hane sayısı (0 = yok)'), inp('digits', 'number', { min: 0, max: 12 })), h('div', { class: 'field' }, h('label', null, 'Kitapçık türleri'), bk),
          h('div', { class: 'field' }, h('label', null, 'Sayfaya sığdırma'), nupSel)),
        msg, h('div', { class: 'row', style: { marginTop: '.7rem' } }, h('button', { class: 'btn primary', onclick: saveTpl }, 'Şablonu kaydet'), h('span', { class: 'small muted' }, 'Kaydedince sınavlarda seçilebilir.'))),
      h('div', { class: 'card' }, h('h2', null, 'Yazdır'),
        h('div', { class: 'row' }, h('label', { class: 'lbl' }, 'Boş form sayfası:'), copies, h('button', { class: 'btn', id: 'fm-print-blank', onclick: () => { const n = Math.max(1, Math.min(500, +copies.value || 1)), t = build(); if (t.error) return toast(t.error, 'bad'); printSheets(Array.from({ length: n * t.nup }, () => ({}))); } }, 'Boş formları yazdır')),
        h('hr', { style: { border: 0, borderTop: '1px solid var(--line)', margin: '1rem 0' } }),
        h('div', { class: 'row' }, schSel, clsSel, info), h('label', { class: 'row', style: { margin: '.5rem 0' } }, prefill, 'Öğrenci numarasını baloncuklara da işle (kişiye özel form)'),
        h('button', { class: 'btn', onclick: () => { if (!stu.length) return toast('Önce öğrenci listesi olan bir okul seçin.', 'bad'); const sch = schoolByCode(schSel.value); const list = stu.filter(s => !clsSel.value || s.sinif === clsSel.value).sort((a, b) => (a.sinif || '').localeCompare(b.sinif || '', 'tr') || String(a.ogrNo).localeCompare(String(b.ogrNo), undefined, { numeric: true }));
          if (!list.length) return toast('Seçimde öğrenci yok.', 'bad'); const dg = o.digits;
          printSheets(list.map(s => { const no = String(s.ogrNo).padStart(dg, '0').slice(-dg || undefined); return { name: `${s.ad} ${s.soyad}`.trim(), school: sch ? sch.okulAdi : '', cls: s.sinif, studentNo: dg ? no : '', fill: prefill.checked && dg ? { studentNo: no } : null }; })); } }, 'Öğrenci listesinden kişiye özel yazdır'),
        h('p', { class: 'small muted' }, 'Yazdırma penceresinde ölçek "%100 / Gerçek boyut", kenar boşluğu "Yok" olmalı; "Sayfaya sığdır" kapalı olsun. Köşe işaretleri bozulmadan çıkmalı. PDF olarak kaydetmek için yazıcı yerine "PDF olarak kaydet"i seçin.')),
      h('div', { class: 'card' }, h('h2', null, 'Kayıtlı şablonlar'), tplList)),
    h('div', null, h('div', { class: 'card' }, h('h2', null, 'Önizleme'), preview))));
  refresh(); drawTpl();
}

/* ================================================================ harici optik */
function customTab(pane) {
  const S = App.state;
  const T = { img: null, name: '', anchors: [], groups: [], pending: null, mode: 'anchor', ref: null, zoom: 1 };
  const cv = h('canvas'), cx = cv.getContext('2d'), wrap = h('div', { class: 'tcanvas' }, cv), side = h('div'), msg = h('div', { class: 'alert info' });
  const fileIn = h('input', { type: 'file', accept: 'image/*', class: 'hidden', onchange: async e => { const f = e.target.files[0]; if (!f) return; try { T.img = await loadGray(f); T.anchors = []; T.groups = []; T.mode = 'anchor'; fit(); paint(); drawSide(); } catch (er) { toast(er.message, 'bad'); } e.target.value = ''; } });
  function fit() { const w = Math.min(1100, T.img.w); T.zoom = w / T.img.w; cv.width = Math.round(T.img.w * T.zoom); cv.height = Math.round(T.img.h * T.zoom); const id = cx.createImageData(cv.width, cv.height); T.ref = id; const g = T.img.gray; for (let y = 0; y < cv.height; y++) for (let x = 0; x < cv.width; x++) { const v = g[Math.min(T.img.h - 1, Math.round(y / T.zoom)) * T.img.w + Math.min(T.img.w - 1, Math.round(x / T.zoom))], o = (y * cv.width + x) * 4; id.data[o] = id.data[o + 1] = id.data[o + 2] = v; id.data[o + 3] = 255; } }
  const COL = { questions: '#e11d48', studentNo: '#2563eb', booklet: '#9333ea' };
  function geom(g) {   // grup tanımından xs/ys üret
    const n = g.n, m = g.m, p0 = g.p0, p1 = g.p1, gapEvery = g.gapEvery || 0, gr = g.gapRatio || 0;
    const colsOf = g.axis === 'row' ? m : n, rowsOf = g.axis === 'row' ? n : m;       // axis row: satır=soru, sütun=şık
    const xs = [], ys = [];
    for (let c = 0; c < colsOf; c++) xs.push(colsOf > 1 ? p0[0] + (p1[0] - p0[0]) * c / (colsOf - 1) : p0[0]);
    const steps = rowsOf - 1, extra = (g.axis === 'row' && gapEvery) ? Math.floor(steps / gapEvery) * gr : 0, unit = steps + extra;
    for (let r = 0; r < rowsOf; r++) { const e = (g.axis === 'row' && gapEvery) ? Math.floor(r / gapEvery) * gr : 0; ys.push(rowsOf > 1 ? p0[1] + (p1[1] - p0[1]) * (r + e) / unit : p0[1]); }
    return { xs, ys };
  }
  const ZOOMS = [100, 150, 200, 300]; let zi = 0;
  function zoomBy(d) { zi = Math.max(0, Math.min(ZOOMS.length - 1, zi + d)); cv.style.width = ZOOMS[zi] + '%'; }   // yalnız görüntü boyutu; tıklama koordinatı gerçek ekran boyutundan hesaplanır
  function paint() {
    if (!T.img) return; cx.putImageData(T.ref, 0, 0); const z = T.zoom;
    T.anchors.forEach((a, i) => { cx.strokeStyle = '#16a34a'; cx.lineWidth = 2; cx.strokeRect(a[0] * z - 9, a[1] * z - 9, 18, 18); cx.fillStyle = '#16a34a'; cx.font = '14px sans-serif'; cx.fillText(['SÜ', 'SaÜ', 'SaA', 'SA'][i], a[0] * z + 12, a[1] * z - 10); });
    T.groups.forEach(g => { const { xs, ys } = geom(g), r = (g.r || 8) * z; cx.strokeStyle = COL[g.role]; cx.lineWidth = 1.5; ys.forEach(y => xs.forEach(x => { cx.beginPath(); cx.arc(x * z, y * z, r, 0, 7); cx.stroke(); })); });
    if (T.pending && T.pending.p0) { cx.fillStyle = '#f59e0b'; cx.beginPath(); cx.arc(T.pending.p0[0] * z, T.pending.p0[1] * z, 6, 0, 7); cx.fill(); }
  }
  function estimate(x, y) {   // tıklanan köşe işaretinin ortası ve boyutu
    const half = 60, x0 = Math.max(0, Math.round(x) - half), y0 = Math.max(0, Math.round(y) - half), x1 = Math.min(T.img.w, Math.round(x) + half), y1 = Math.min(T.img.h, Math.round(y) + half), w = x1 - x0, hh = y1 - y0, p = new Uint8Array(w * hh);
    for (let j = 0; j < hh; j++) for (let i = 0; i < w; i++) p[j * w + i] = T.img.gray[(y0 + j) * T.img.w + x0 + i];
    // küçük kırpıkta uyarlanabilir eşik, işaretin içini boş bırakır: kırpığın kendi açık/koyu aralığından genel eşik kullan
    const srt = Array.from(p).sort((a, b) => a - b), lo = srt[Math.floor(srt.length * 0.03)], hi = srt[Math.floor(srt.length * 0.9)], thr = (lo + hi) / 2, bin = new Uint8Array(p.length);
    if (hi - lo > 50) for (let i = 0; i < p.length; i++) bin[i] = p[i] < thr ? 1 : 0;
    const bl = OMR.findBlobs(bin, w, hh, 30, 6000).filter(b => b.fill > 0.5 && !b.touches), cxp = x - x0, cyp = y - y0;
    let best = null; bl.forEach(b => { const d = Math.hypot(b.cx - cxp, b.cy - cyp); if (d < 30 && (!best || d < best.d)) best = { d, x: b.cx + x0, y: b.cy + y0, s: (b.bw + b.bh) / 2 }; });
    return best || { x, y, s: 20 };
  }
  cv.addEventListener('click', e => {
    if (!T.img) return; const b = cv.getBoundingClientRect(), x = (e.clientX - b.left) * (cv.width / b.width) / T.zoom, y = (e.clientY - b.top) * (cv.height / b.height) / T.zoom;
    if (T.mode === 'anchor') { if (T.anchors.length < 4) { const a = estimate(x, y); T.anchors.push([a.x, a.y]); T.anchorSize = a.s; if (T.anchors.length === 4) T.mode = 'idle'; } }
    else if (T.mode === 'p0') { T.pending.p0 = [x, y]; T.mode = 'p1'; }
    else if (T.mode === 'p1') { T.pending.p1 = [x, y]; T.mode = 'idle'; finishGroup(); }
    paint(); drawSide();
  });
  let gform = { role: 'questions', n: 20, m: 5, gapEvery: 5, gapRatio: 0.45, r: 8 };
  function finishGroup() {
    const g = Object.assign({}, gform, { p0: T.pending.p0, p1: T.pending.p1 }); const { xs, ys } = geom(g);
    const pitch = Math.min(xs.length > 1 ? Math.abs(xs[1] - xs[0]) : 1e9, ys.length > 1 ? Math.abs(ys[1] - ys[0]) : 1e9); g.r = Math.round(Math.min(isFinite(pitch) ? pitch * 0.36 : 8, 40) * 10) / 10 || 8;
    g.id = g.role === 'questions' ? 'q' + T.groups.filter(x => x.role === 'questions').length : g.role === 'studentNo' ? 'no' : 'bk'; T.groups.push(g); T.pending = null; paint(); drawSide();
  }
  function drawSide() {
    clear(side);
    const aOk = T.anchors.length === 4;
    msg.textContent = !T.img ? '1) Boş (işaretsiz) optik formun net bir taramasını yükleyin.' : !aOk ? `2) Formun 4 köşe işaretini sırayla tıklayın: sol-üst, sağ-üst, sağ-alt, sol-alt (${T.anchors.length}/4). En dıştaki, birbirine benzeyen siyah işaretleri seçin.` :
      T.mode === 'p0' ? '3) Bloğun İLK baloncuğunun (sol-üst) ortasına tıklayın.' : T.mode === 'p1' ? '3) Bloğun SON baloncuğunun (sağ-alt) ortasına tıklayın.' : '3) Bölümleri tek tek ekleyin (sorular, öğrenci no, kitapçık). Çember çakışmasını görsel olarak kontrol edin.';
    side.append(msg, h('div', { class: 'row' }, h('button', { class: 'btn primary', id: 'cu-pick', onclick: () => fileIn.click() }, T.img ? 'Başka görüntü' : 'Boş form görüntüsü yükle'),
      T.img ? h('button', { class: 'btn', 'aria-label': 'Yakınlaştır', title: 'Yakınlaştır', onclick: () => zoomBy(1) }, '＋') : null, T.img ? h('button', { class: 'btn', 'aria-label': 'Uzaklaştır', title: 'Uzaklaştır', onclick: () => zoomBy(-1) }, '－') : null, T.anchors.length ? h('button', { class: 'btn', onclick: () => { T.anchors = []; T.mode = 'anchor'; paint(); drawSide(); } }, 'Köşeleri sıfırla') : null));
    if (!aOk) return;
    const role = h('select', { onchange: e => { gform.role = e.target.value; Object.assign(gform, e.target.value === 'questions' ? { n: 20, m: 5, gapEvery: 5, gapRatio: .45 } : e.target.value === 'studentNo' ? { n: 8, m: 10, gapEvery: 0, gapRatio: 0 } : { n: 1, m: 4, gapEvery: 0, gapRatio: 0 }); drawSide(); } }, [['questions', 'Soru bloğu'], ['studentNo', 'Öğrenci numarası'], ['booklet', 'Kitapçık türü']].map(([v, l]) => h('option', { value: v }, l))); role.value = gform.role;
    gform.axis = gform.role === 'questions' ? 'row' : gform.role === 'studentNo' ? 'col' : 'row';
    const num = (label, key, min) => h('div', { class: 'field' }, h('label', null, label), h('input', { type: 'number', min: min == null ? 0 : min, step: 'any', value: gform[key], oninput: e => { gform[key] = parseFloat(e.target.value) || 0; } }));
    const labelsIn = h('input', { type: 'text', value: gform.labels || (gform.role === 'booklet' ? 'ABCD' : ''), placeholder: 'ABCD', oninput: e => { gform.labels = e.target.value.toUpperCase(); } });
    side.append(h('div', { class: 'card', style: { marginTop: '.8rem' } }, h('h3', null, 'Yeni blok'), h('div', { class: 'field' }, h('label', null, 'Blok türü'), role),
      h('div', { class: 'grid', style: { marginTop: '.5rem' } },
        gform.role === 'questions' ? [num('Soru sayısı (satır)', 'n', 1), num('Şık sayısı', 'm', 2), num('Her kaç satırda boşluk (0=yok)', 'gapEvery'), num('Boşluk oranı (satır aralığına göre)', 'gapRatio')] : gform.role === 'studentNo' ? [num('Hane sayısı', 'n', 1)] : [h('div', { class: 'field' }, h('label', null, 'Kitapçık harfleri'), labelsIn)]),
      h('button', { class: 'btn', style: { marginTop: '.6rem' }, id: 'cu-addgroup', onclick: () => { if (gform.role === 'booklet') gform.m = Math.max(2, (labelsIn.value || 'ABCD').length); T.pending = { }; T.mode = 'p0'; drawSide(); } }, 'Köşe baloncuklarını tıklayarak yerleştir')),
      T.groups.length ? h('div', { class: 'card' }, h('h3', null, 'Tanımlı bloklar'), T.groups.map((g, i) => h('div', { class: 'row between', style: { marginBottom: '.3rem' } }, h('span', null, h('span', { class: 'pill', style: { background: COL[g.role], color: '#fff' } }, g.role === 'questions' ? 'Soru' : g.role === 'studentNo' ? 'No' : 'Kit.'), ` ${g.n}×${g.m}`),
        h('span', { class: 'row' }, h('label', { class: 'small row' }, 'yarıçap', h('input', { type: 'number', step: '0.5', value: g.r, style: { width: '70px' }, onchange: e => { g.r = parseFloat(e.target.value) || g.r; paint(); } })), h('button', { class: 'btn sm ghost', onclick: () => { T.groups.splice(i, 1); paint(); drawSide(); } }, '✕'))))) : null,
      T.groups.length ? h('div', { class: 'card' }, h('h3', null, 'Dene ve kaydet'),
        h('div', { class: 'row' }, h('button', { class: 'btn', onclick: () => testFile.click() }, 'İşaretli bir form ile dene')), testOut,
        h('div', { class: 'field', style: { marginTop: '.7rem' } }, h('label', null, 'Şablon adı'), h('input', { type: 'text', id: 'cu-name', value: T.name, placeholder: 'Örn: XYZ Yayınları 90 soruluk optik', oninput: e => { T.name = e.target.value; } })),
        h('div', { class: 'row', style: { marginTop: '.6rem' } }, h('button', { class: 'btn primary', id: 'cu-save', onclick: save }, 'Şablonu kaydet'))) : null);
  }
  const testOut = h('div'), testFile = h('input', { type: 'file', accept: 'image/*', class: 'hidden', onchange: async e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return; const tpl = build(); if (tpl.error) return toast(tpl.error, 'bad');
    clear(testOut).append(h('p', { class: 'muted' }, 'Okunuyor…'));
    try { const img = await loadGray(f), out = await runRead(img, tpl, {}), r = out.res; if (!r || !r.ok) { clear(testOut).append(h('div', { class: 'alert bad' }, (out.error || (r && r.error) || 'Okunamadı') + ' (köşe işaretlerini ve yönü kontrol edin)')); return; }
      const fm = r.forms[0]; clear(testOut).append(h('div', { class: 'alert ok' }, `Okundu. Öğrenci no: ${fm.studentNo || '—'}${fm.booklet ? ' · Kitapçık: ' + fm.booklet : ''} · ${fm.answers.split('').filter(c => /[A-H]/.test(c)).length} işaretli, ${fm.flags.filter(x => x.q).length} şüpheli soru`), h('div', { class: 'mono small', style: { wordBreak: 'break-all' } }, fm.answers)); } catch (er) { clear(testOut).append(h('div', { class: 'alert bad' }, er.message)); }
  } });
  function build() {
    if (T.anchors.length < 4) return { error: 'Önce 4 köşe işaretini seçin.' };
    const qs = T.groups.filter(g => g.role === 'questions'); if (!qs.length) return { error: 'En az bir soru bloğu ekleyin.' };
    let q = 1; const groups = []; let choices = 0, digits = 0, booklets = [];
    T.groups.forEach(g => { const { xs, ys } = geom(g), round = a => a.map(v => Math.round(v * 100) / 100);
      if (g.role === 'questions') { groups.push({ id: 'q' + groups.length, role: 'questions', axis: 'row', labels: 'ABCDEFGH'.slice(0, g.m).split(''), xs: round(xs), ys: round(ys), qStart: q }); q += g.n; choices = Math.max(choices, g.m); }
      else if (g.role === 'studentNo') { groups.push({ id: 'no', role: 'studentNo', axis: 'col', labels: '0123456789'.split(''), xs: round(xs), ys: round(ys) }); digits = g.n; }
      else { const lb = (g.labels || 'ABCD').slice(0, g.m).split(''); groups.push({ id: 'bk', role: 'booklet', axis: 'row', labels: lb, xs: round(xs), ys: round(ys) }); booklets = lb; } });
    const rs = T.groups.map(g => g.r), r = rs.reduce((a, b) => a + b, 0) / rs.length;
    return { kind: 'custom', version: 1, orient: false, nup: 1, frame: { w: T.img.w, h: T.img.h }, anchors: T.anchors.map(a => [Math.round(a[0] * 100) / 100, Math.round(a[1] * 100) / 100]), anchorSize: Math.round((T.anchorSize || 20) * 10) / 10, r: Math.round(r * 100) / 100, pitch: r / 0.38, questions: q - 1, choices, digits, booklets, groups, decor: [] };
  }
  async function save() {
    const t = build(); if (t.error) return toast(t.error, 'bad'); if (!T.name.trim()) return toast('Şablon adı girin.', 'bad');
    try { await api('saveTemplate', { name: T.name.trim(), template: t }); await refreshBase(); toast(`Şablon kaydedildi (${t.questions} soru). Sınav ayarlarında seçebilirsiniz.`, 'ok'); } catch (e) { toast(e.message, 'bad'); }
  }
  pane.append(h('div', { class: 'card' }, h('p', { class: 'muted', style: { marginTop: 0 } }, 'Piyasadaki bir optik formu okutmak için: boş formun taramasını yükleyin, 4 köşe işaretini ve baloncuk bloklarını gösterin. Şablon kaydedilir ve o form tipi sınavlarda seçilir. Form tarama sırasında dik (en fazla 45° eğik) olmalıdır; baloncuk çizimleri gerçek baloncuklarla çakışana dek yarıçapı ayarlayın.')),
    h('div', { class: 'review wide' }, h('div', null, wrap), h('div', null, side)), fileIn, testFile); drawSide();
}
