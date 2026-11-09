/* forms.js — hazır form kataloğu, form tasarlama/yazdırma (1/2/4/6/8 sığdırma) ve harici optik şablon tanımlama */
'use strict';

const FM = { tab: 'catalog', opts: null, templateId: '', cat: { nup: 1, d: 8, sd: 0 } };
const NUP_LABELS = { 1: 'Sayfada 1 form (A4 tam)', 2: 'Sayfada 2 form (yarım sayfa)', 4: 'Sayfada 4 form (kesilir)', 6: 'Sayfada 6 form (kesilir)', 8: 'Sayfada 8 form (kesilir)' };

App.views.forms = function (root) {
  const tabs = [['catalog', 'Hazır şablonlar'], ['design', 'Form tasarla ve yazdır'], ['custom', 'Harici optik tanımla']];
  const tb = h('div', { class: 'tabs' }), pane = h('div');
  const draw = () => { clear(tb).append(...tabs.map(([id, l]) => h('button', { class: FM.tab === id ? 'active' : '', onclick: () => { FM.tab = id; draw(); } }, l))); clear(pane); ({ catalog: catalogTab, design: designTab, custom: customTab }[FM.tab])(pane, draw); };
  root.append(h('h1', null, 'Optik formlar'), tb, pane); draw();
};

/** A4 sayfalarını yazdırır (gizli #printArea → window.print) */
function printForms(tpl, formsList) {
  const per = tpl.nup, pa = clear($('#printArea'));
  for (let i = 0; i < formsList.length; i += per) { const sh = h('div', { class: 'sheet' }); sh.innerHTML = OMR.renderPageSVG(tpl, formsList.slice(i, i + per)); pa.append(sh); }
  const done = () => { clear(pa); window.removeEventListener('afterprint', done); }; window.addEventListener('afterprint', done); setTimeout(() => window.print(), 150);
}
const PRINT_HINT = 'Yazdırma penceresinde ölçek "%100 / Gerçek boyut", kenar boşluğu "Yok" olmalı; "Sayfaya sığdır" kapalı olsun. Köşe işaretleri bozulmadan çıkmalı. PDF olarak kaydetmek için yazıcı yerine "PDF olarak kaydet"i seçin.';

/** Katalog kaydından tasarım ayarı (ders tablosu dahil) */
function optsFromEntry(e, over) {
  const o = Katalog.formOpts(e, Object.assign({ footer: formFooter() }, over || {}));
  return o;
}
/** Eski/eksik kayıtlı ayarları tasarım aracının beklediği biçime getirir */
function normOpts(o) {
  o = Object.assign({ title: 'OPTİK CEVAP KAĞIDI', examName: '', questions: 40, choices: 5, digits: 8, schoolDigits: 0, booklets: [], nup: 1, sections: [], layout: 'seq', maxRows: 0, restartNumbers: true, footer: formFooter(), instructions: true }, o || {});
  o.sections = (o.sections || []).map(s => ({ name: s.name, short: s.short, count: Math.round(s.count) || 1 }));
  if (!o.sections.length) o.sections = [{ name: 'Genel', count: o.questions || 40 }];
  o.questions = o.sections.reduce((a, s) => a + s.count, 0); o.booklets = (o.booklets || []).slice();
  return o;
}
function tryBuild(opts) { try { return { tpl: OMR.buildTemplate(opts) }; } catch (e) { return { error: e.message }; } }

/* ================================================================ hazır şablonlar */
function catalogTab(pane, redraw) {
  const C = FM.cat; let q = '';
  const search = h('input', { type: 'search', placeholder: 'Ara: LGS, TYT, KPSS, Türkçe, 20 soru…', oninput: e => { q = e.target.value.trim().toLocaleLowerCase('tr'); drawBody(); } });
  const nupSel = h('select', { onchange: e => { C.nup = +e.target.value; drawBody(); } }, [1, 2, 4, 6, 8].map(n => h('option', { value: n }, { 1: '1 form / sayfa', 2: '2 form / sayfa', 4: '4 form · kesilir', 6: '6 form · kesilir', 8: '8 form · kesilir' }[n]))); nupSel.value = C.nup;
  const dSel = h('select', { onchange: e => { C.d = +e.target.value; drawBody(); } }, [0, 4, 5, 6, 7, 8, 9, 10, 12].map(n => h('option', { value: n }, n ? `${n} hane öğrenci no` : 'Öğrenci no yok'))); dSel.value = C.d;
  const sdSel = h('select', { onchange: e => { C.sd = +e.target.value; drawBody(); } }, [0, 3, 4, 5, 6, 7, 8, 9, 10].map(n => h('option', { value: n }, n ? `${n} hane kurum kodu` : 'Kurum kodu yok'))); sdSel.value = C.sd;
  const body = h('div');
  const lessonSel = h('select'), cntSel = h('select'), chSel = h('select', null, [4, 5].map(n => h('option', { value: n }, n + ' şık'))), cntOwn = h('input', { type: 'number', min: 1, max: 200, placeholder: 'başka sayı', style: { width: '110px' } });
  Katalog.LESSONS.forEach(l => lessonSel.append(h('option', { value: l[0] }, l[1])));
  const fillCounts = () => { const l = Katalog.LESSONS.find(x => x[0] === lessonSel.value); clear(cntSel).append(...l[3].map(([n, lab]) => h('option', { value: n }, lab ? `${n} soru (${lab})` : `${n} soru`))); chSel.value = l[3][0][2] === 'l' ? 5 : 4; };
  lessonSel.addEventListener('change', fillCounts); fillCounts();
  const own = () => Katalog.singleEntry(lessonSel.value, +cntOwn.value || +cntSel.value, +chSel.value);

  const fo = (e, extra) => Katalog.formOpts(e, Object.assign({ nup: C.nup, digits: C.d, schoolDigits: C.sd, footer: formFooter() }, extra || {}));
  const cache = new Map();
  const fits = e => { const k = e.id + '|' + C.nup + '|' + C.d + '|' + C.sd; if (!cache.has(k)) cache.set(k, tryBuild(fo(e))); return cache.get(k); };
  function preview(e) {
    const r = fits(e); if (r.error) return toast(r.error, 'bad');
    const n = OMR.pageForms(C.nup).length, forms = Array.from({ length: n }, () => ({ name: 'Ad Soyad', school: 'Okul adı', cls: '8-A' }));
    const box = h('div', { class: 'preview' }); box.innerHTML = OMR.renderPageSVG(r.tpl, forms);
    modal(e.name, h('div', null, h('div', { class: 'chips', style: { marginBottom: '.5rem' } }, chipsFor(e, r.tpl)), box), { size: 'wide', buttons: [{ label: 'Kapat' }, { label: 'Yazdır…', cls: 'primary', keepOpen: false, fn: () => { setTimeout(() => printAsk(e), 50); } }] });
  }
  function printAsk(e) {
    const r = fits(e); if (r.error) return toast(r.error, 'bad');
    const n = h('input', { type: 'number', min: 1, max: 500, value: 1, style: { width: '90px' } });
    modal('Yazdır — ' + e.name, h('div', null, h('div', { class: 'row' }, h('label', null, 'Boş form sayfası sayısı:'), n), h('p', { class: 'small muted' }, `Her sayfada ${C.nup} form var${C.nup > 1 ? '; basılan çizgilerden kesin' : ''}. Kişiye özel (öğrenci adı/no basılı) form için "Tasarımda aç"ı kullanın. ${PRINT_HINT}`)), {
      buttons: [{ label: 'Vazgeç' }, { label: 'Yazdır', cls: 'primary', fn: () => { printForms(r.tpl, Array.from({ length: Math.max(1, Math.min(500, +n.value || 1)) * C.nup }, () => ({}))); } }]
    });
  }
  const chipsFor = (e, t) => [h('span', { class: 'chip' }, `${Katalog.total(e)} soru · ${e.choices} şık`), h('span', { class: 'chip' }, Katalog.penText(e.penalty)), h('span', { class: 'chip' }, `Baloncuk aralığı ${t.pitch} mm`), h('span', { class: 'chip' }, `Form kimliği ${t.formCodeHex}`)];
  function toDesign(e) { FM.opts = normOpts(optsFromEntry(e, { nup: C.nup, digits: C.d, schoolDigits: C.sd })); FM.templateId = ''; FM.tab = 'design'; redraw(); }
  function toExam(e) { App.newExam = { entryId: e.id, nup: C.nup, d: C.d, sd: C.sd }; App.go('exams'); }

  function card(e) {
    const r = fits(e), secs = e.sections.length > 1 ? e.sections.map(s => `${s.short || s.name} ${s.count}`).join(' · ') : '';
    return h('div', { class: 'catcard' + (r.error ? ' off' : ''), 'data-id': e.id },
      h('div', { class: 'cc-head' }, h('b', null, e.name), h('span', { class: 'small muted' }, e.desc)),
      secs ? h('div', { class: 'small cc-secs' }, secs) : null,
      h('div', { class: 'chips' }, h('span', { class: 'chip' }, `${e.choices} şık`), h('span', { class: 'chip' }, Katalog.penText(e.penalty)), e.method === 'std500' ? h('span', { class: 'chip brand' }, 'Standart puan 100–500') : h('span', { class: 'chip' }, 'Net → 100 puan'), r.error ? h('span', { class: 'chip bad' }, `${C.nup}/sayfa sığmıyor`) : h('span', { class: 'chip ok' }, `${r.tpl.pitch} mm aralık`)),
      r.error ? h('div', { class: 'small', style: { color: 'var(--bad)' } }, 'Bu sığdırma/hane ayarıyla sığmıyor; sayfada daha az form, daha az hane ya da kurum kodsuz deneyin.') : null,
      h('div', { class: 'row cc-btns' }, h('button', { class: 'btn sm', disabled: !!r.error, onclick: () => preview(e) }, 'Önizle'), h('button', { class: 'btn sm', disabled: !!r.error, onclick: () => printAsk(e) }, 'Yazdır'),
        h('button', { class: 'btn sm primary', onclick: () => toExam(e) }, 'Sınav oluştur'), h('button', { class: 'btn sm ghost', onclick: () => toDesign(e) }, 'Tasarımda aç')));
  }
  function ownBuilder() {
    const e = own(), r = e && fits(e);
    return h('div', { class: 'catcard own' }, h('div', { class: 'cc-head' }, h('b', null, 'Kendi tek ders optiğinizi oluşturun'), h('span', { class: 'small muted' }, 'Dersi ve soru sayısını seçin; numaralar 1’den başlar.')),
      h('div', { class: 'grid' }, h('div', { class: 'field' }, h('label', null, 'Ders'), lessonSel), h('div', { class: 'field' }, h('label', null, 'Soru sayısı'), h('div', { class: 'row' }, cntSel, cntOwn)), h('div', { class: 'field' }, h('label', null, 'Şık'), chSel)),
      h('div', { class: 'row cc-btns' }, h('button', { class: 'btn sm', onclick: () => { const x = own(); if (!x) return toast('Soru sayısı 1–200 olmalı', 'bad'); preview(x); } }, 'Önizle'), h('button', { class: 'btn sm', onclick: () => { const x = own(); if (!x) return toast('Soru sayısı 1–200 olmalı', 'bad'); printAsk(x); } }, 'Yazdır'),
        h('button', { class: 'btn sm primary', onclick: () => { const x = own(); if (!x) return toast('Soru sayısı 1–200 olmalı', 'bad'); toExam(x); } }, 'Sınav oluştur'), h('button', { class: 'btn sm ghost', onclick: () => { const x = own(); if (!x) return toast('Soru sayısı 1–200 olmalı', 'bad'); toDesign(x); } }, 'Tasarımda aç')));
  }
  function drawBody() {
    clear(body);
    const hit = e => !q || (e.name + ' ' + e.desc + ' ' + e.sections.map(s => s.name).join(' ')).toLocaleLowerCase('tr').includes(q);
    Katalog.GROUPS.forEach((g, gi) => {
      const list = Katalog.ENTRIES.filter(e => e.group === g.id && hit(e)); if (!list.length && !(g.id === 'tek' && !q)) return;
      const det = h('details', { class: 'catgroup', open: gi < 2 || !!q }, h('summary', null, h('b', null, g.label), h('span', { class: 'small muted' }, ` · ${g.note} · ${list.length} şablon`)));
      const grid = h('div', { class: 'catgrid' }); if (g.id === 'tek' && !q) grid.append(ownBuilder()); list.forEach(e => grid.append(card(e))); det.append(grid); body.append(det);
    });
    if (!body.children.length) body.append(h('p', { class: 'muted' }, 'Eşleşen şablon yok.'));
  }
  pane.append(h('div', { class: 'card' }, h('h2', null, 'Hazır optik formlar ve sınav programları'),
    h('p', { class: 'small muted', style: { marginTop: 0 } }, 'Her kayıt formu (ders ders sütunlar, her derste numaralar baştan) ve puanlama ayarını (katsayı, yanlış kuralı, puan yöntemi) birlikte getirir. Resmî sınavların yapısı yıllara göre değişebilir; "Sınav oluştur"dan sonra sınav ekranında düzenleyebilirsiniz.'),
    h('div', { class: 'toolbar' }, search, nupSel, dSel, sdSel)), body);
  drawBody();
}

/* ================================================================ tasarla / yazdır */
function designTab(pane, redraw) {
  const S = App.state, o = FM.opts = normOpts(FM.opts || {}); let templateId = FM.templateId || '';
  const inp = (key, type, extra) => h('input', Object.assign({ type: type || 'text', value: o[key], oninput: e => { o[key] = type === 'number' ? (parseInt(e.target.value) || 0) : e.target.value; refresh(); } }, extra || {}));
  const sel = (key, items, conv) => { const s = h('select', { onchange: e => { o[key] = conv ? conv(e.target.value) : e.target.value; refresh(); } }, items.map(([v, l]) => h('option', { value: v }, l))); s.value = o[key]; return s; };
  const nupSel = sel('nup', [1, 2, 4, 6, 8].map(n => [n, NUP_LABELS[n]]), Number);
  const choiceSel = sel('choices', [2, 3, 4, 5, 6, 7, 8].map(n => [n, n + ' şık']), Number);
  const layoutSel = sel('layout', [['lanes', 'Dersler yan yana (önerilen)'], ['dense', 'Dersler sıkı yerleşir'], ['seq', 'Tek liste (ders başlığı yok)']]);
  const rowsSel = sel('maxRows', [[0, 'Otomatik']].concat([5, 10, 15, 20, 25, 30, 40, 50].map(n => [n, `${n} soru`])), Number);
  const bk = h('input', { type: 'text', value: o.booklets.join(','), placeholder: 'A,B (kitapçık yoksa boş bırakın)', oninput: e => { o.booklets = Array.from(new Set(e.target.value.toUpperCase().split(/[^A-Z]+/).filter(Boolean))).slice(0, 8); refresh(); } });
  const exSel = h('select', { onchange: () => {
    const ex = examById(exSel.value); if (!ex) return; const cfg = examCfg(ex);
    Object.assign(o, { examName: ex.name, choices: cfg.choices, booklets: (ex.config.booklets || Object.keys(cfg.keys)).slice(), sections: cfg.sections.map(s => ({ name: s.name, count: s.count })), layout: 'lanes' }); normOpts(o); FM.opts = o; redraw();
  } }, h('option', { value: '' }, 'Sınavdan doldur…'), S.exams.map(e => h('option', { value: e.examId }, e.name)));
  const preview = h('div', { class: 'preview' }), msg = h('div'), totalBox = h('span', { class: 'chip brand' });

  /* ---- ders tablosu ---- */
  const secBox = h('div', { class: 'seclist' });
  function drawSecs() {
    clear(secBox);
    o.sections.forEach((s, i) => {
      const nm = h('input', { type: 'text', value: s.name, maxlength: 40, 'aria-label': 'Ders adı', oninput: e => { s.name = e.target.value; delete s.short; refresh(); } });
      const ct = h('input', { type: 'number', min: 1, max: 200, value: s.count, 'aria-label': 'Soru sayısı', oninput: e => { s.count = Math.max(1, Math.min(200, parseInt(e.target.value) || 1)); refresh(); } });
      secBox.append(h('div', { class: 'secrow' }, h('span', { class: 'secno' }, i + 1), nm, ct, h('button', { class: 'btn sm ghost', title: 'Yukarı', disabled: i === 0, onclick: () => { o.sections.splice(i - 1, 0, o.sections.splice(i, 1)[0]); drawSecs(); refresh(); } }, '↑'),
        h('button', { class: 'btn sm ghost', title: 'Dersi sil', disabled: o.sections.length < 2, onclick: () => { o.sections.splice(i, 1); drawSecs(); refresh(); } }, '✕')));
    });
  }
  const addSel = h('select', { onchange: e => { const l = Katalog.LESSONS.find(x => x[0] === e.target.value); if (l) { o.sections.push({ name: l[1], short: l[2], count: l[3][0][0] }); drawSecs(); refresh(); } e.target.value = ''; } },
    h('option', { value: '' }, '+ Ders ekle…'), Katalog.LESSONS.map(l => h('option', { value: l[0] }, `${l[1]} (${l[3][0][0]} soru)`)));

  function build() {
    o.questions = o.sections.reduce((a, s) => a + (s.count | 0), 0);
    const opts = Object.assign({}, o, { sections: o.sections.map(s => Object.assign({}, s)), footer: String(o.footer || '') });
    try { return OMR.buildTemplate(opts); }
    catch (e) {
      let cap = 0; for (let n = Math.min(o.questions - 1, 200); n >= 1; n--) { try { OMR.buildTemplate(Object.assign({}, opts, { questions: n, layout: 'seq', sections: [{ name: 'Genel', count: n }] })); cap = n; break; } catch (e2) { } }
      return { error: e.message + (cap ? ` Bu ayarlarla (${o.nup}/sayfa, ${o.choices} şık, ${o.digits} haneli no${o.schoolDigits ? ', ' + o.schoolDigits + ' haneli kurum kodu' : ''}) en fazla yaklaşık ${cap} soru sığar.` : ' Hane sayısını veya şık sayısını azaltmayı deneyin.') };
    }
  }
  function refresh() {
    const t = build(); clear(msg); totalBox.textContent = `Toplam ${o.questions} soru`;
    if (t.error) { clear(preview); msg.append(h('div', { class: 'alert bad' }, t.error)); return; }
    const sc = String(o.schoolDigits ? '7654321012'.slice(0, o.schoolDigits) : '');
    preview.innerHTML = OMR.renderPageSVG(t, [{ name: 'Ad Soyad (örnek)', school: 'Okul', cls: '8-A', studentNo: '12345678'.slice(0, o.digits), schoolCode: sc }]);
    msg.append(h('div', { class: 'chips' }, h('span', { class: 'chip' }, `Baloncuk aralığı ${t.pitch} mm`), h('span', { class: 'chip' }, `${t.groups.filter(g => g.role === 'questions').length} sütun`), h('span', { class: 'chip' }, `Form kimliği ${t.formCodeHex}`)));
    if (o.layout === 'lanes' && t.layoutUsed === 'dense') msg.append(h('div', { class: 'alert info', style: { marginTop: '.5rem' } }, 'Dersler yan yana sığmadığı için sıkı yerleşim kullanıldı. Daha az hane, daha az ders ya da sayfada daha az form seçerek yan yana yerleşimi deneyebilirsiniz.'));
  }
  const tplList = h('div');
  function drawTpl() {
    clear(tplList);
    if (!S.templates.length) { tplList.append(h('p', { class: 'small muted' }, 'Kayıtlı form şablonu yok.')); return; }
    tplList.append(h('div', { class: 'tablewrap', style: { maxHeight: '240px' } }, h('table', null, h('tbody', null, S.templates.map(t => h('tr', null, h('td', null, t.name), h('td', { class: 'small muted' }, t.json && t.json.kind === 'custom' ? 'harici form' : (t.json && t.json.opts ? `${t.json.opts.questions} soru · ${t.json.opts.nup}/sayfa` : '')),
      h('td', { class: 'right nowrap' }, t.json && t.json.kind === 'generated' ? h('button', { class: 'btn sm', onclick: () => { FM.opts = normOpts(t.json.opts); FM.templateId = t.templateId; redraw(); } }, 'Aç') : null,
        h('button', { class: 'btn sm danger', onclick: async () => { if (!(await confirmBox(`"${t.name}" şablonu silinsin mi? Bu şablonu kullanan sınavlar otomatik şablona döner.`, 'Sil', true))) return; try { await api('deleteTemplate', { templateId: t.templateId }); await refreshBase(); drawTpl(); } catch (e) { toast(e.message, 'bad'); } } }, 'Sil'))))))));
  }
  async function saveTpl() {
    const t = build(); if (t.error) return toast(t.error, 'bad');
    const nm = h('input', { type: 'text', value: (o.examName || o.title) + ` (${o.nup}/sayfa)` });
    modal('Şablonu kaydet', h('div', null, h('div', { class: 'field' }, h('label', null, 'Şablon adı'), nm), h('p', { class: 'small muted' }, 'Kaydedilen şablon sınav ayarlarında seçilir; okutma bu şablona göre yapılır. Formu yazdırdıktan sonra ayarlarını değiştirmeyin (form kimliği değişir).')), { buttons: [{ label: 'Vazgeç' }, { label: 'Kaydet', cls: 'primary', fn: async () => {
      try { const r = await api('saveTemplate', { templateId: templateId || undefined, name: nm.value, template: { kind: 'generated', opts: JSON.parse(JSON.stringify(o)) } }); FM.templateId = templateId = r.templateId; await refreshBase(); drawTpl(); toast('Şablon kaydedildi', 'ok'); } catch (e) { toast(e.message, 'bad'); return false; }
    } }] });
  }
  const copies = h('input', { type: 'number', min: 1, max: 500, value: 8, style: { width: '90px' } });
  const schSel = h('select', null, h('option', { value: '' }, 'Okul seçin…'), S.schools.map(s => h('option', { value: s.okulKodu }, schoolLabel(s)))), prefill = h('input', { type: 'checkbox', checked: true }), coded = h('input', { type: 'checkbox' }), clsSel = h('select', null, h('option', { value: '' }, 'Tüm sınıflar'));
  let stu = [];
  const info = h('span', { class: 'small muted' });
  schSel.addEventListener('change', async () => { stu = schSel.value ? await getStudents(schSel.value) : []; clear(clsSel).append(h('option', { value: '' }, 'Tüm sınıflar'), ...Array.from(new Set(stu.map(s => s.sinif).filter(Boolean))).sort().map(c => h('option', { value: c }, c))); info.textContent = stu.length ? `${stu.length} öğrenci` : 'Bu okulda öğrenci listesi yok.'; });
  function personalized() {
    const t = build(); if (t.error) return toast(t.error, 'bad');
    if (!stu.length) return toast('Önce öğrenci listesi olan bir okul seçin.', 'bad');
    const sch = schoolByCode(schSel.value), list = stu.filter(s => !clsSel.value || s.sinif === clsSel.value).sort((a, b) => (a.sinif || '').localeCompare(b.sinif || '', 'tr') || String(a.ogrNo).localeCompare(String(b.ogrNo), undefined, { numeric: true }));
    if (!list.length) return toast('Seçimde öğrenci yok.', 'bad');
    const dg = o.digits, sd = o.schoolDigits, sc = sd ? String(schSel.value).padStart(sd, '0').slice(-sd) : '';
    printForms(t, list.map(s => { const no = String(s.ogrNo).padStart(dg, '0').slice(-dg || undefined); return { name: `${s.ad} ${s.soyad}`.trim(), school: sch ? sch.okulAdi : '', cls: s.sinif, studentNo: dg ? no : '', schoolCode: sc, fill: coded.checked ? { studentNo: dg ? no : '', schoolCode: sc } : null }; }));
  }

  pane.append(h('div', { class: 'review' },
    h('div', null,
      h('div', { class: 'card' }, h('h2', null, 'Form ayarları'),
        h('div', { class: 'field' }, h('label', null, 'Mevcut sınavdan al'), exSel),
        h('div', { class: 'grid', style: { marginTop: '.7rem' } }, h('div', { class: 'field' }, h('label', null, 'Form başlığı'), inp('title')), h('div', { class: 'field' }, h('label', null, 'Sınav adı (başlıkta görünür)'), inp('examName'))),
        h('h3', { style: { margin: '1rem 0 .3rem' } }, 'Dersler ', totalBox), h('p', { class: 'small muted', style: { margin: '0 0 .4rem' } }, 'Her ders formda kendi sütununda, kendi başlığıyla ve 1’den başlayan numaralarla basılır. Dersler yan yana ya da alt alta olabilir; tek ders de olur.'),
        secBox, h('div', { class: 'row', style: { marginTop: '.4rem' } }, addSel, h('button', { class: 'btn sm', onclick: () => { o.sections.push({ name: 'Ders ' + (o.sections.length + 1), count: 10 }); drawSecs(); refresh(); } }, '+ Boş ders')),
        h('div', { class: 'grid', style: { marginTop: '1rem' } },
          h('div', { class: 'field' }, h('label', null, 'Şık sayısı'), choiceSel), h('div', { class: 'field' }, h('label', null, 'Sayfaya sığdırma'), nupSel),
          h('div', { class: 'field' }, h('label', null, 'Öğrenci no hane sayısı (0 = yok)'), inp('digits', 'number', { min: 0, max: 12 })), h('div', { class: 'field' }, h('label', null, 'Kurum kodu hane sayısı (0 = yok)'), inp('schoolDigits', 'number', { min: 0, max: 12 })),
          h('div', { class: 'field' }, h('label', null, 'Kitapçık türleri'), bk), h('div', { class: 'field' }, h('label', null, 'Yerleşim'), layoutSel),
          h('div', { class: 'field' }, h('label', null, 'Sütun başına en çok soru'), rowsSel), h('div', { class: 'field' }, h('label', null, 'Formun altındaki küçük yazı'), inp('footer', 'text', { maxlength: 60 }))),
        h('label', { class: 'row', style: { margin: '.6rem 0' } }, h('input', { type: 'checkbox', checked: o.restartNumbers !== false, onchange: e => { o.restartNumbers = e.target.checked; refresh(); } }), 'Her derste soru numaraları 1’den başlasın (karışıklığı önler)'),
        msg, h('div', { class: 'row', style: { marginTop: '.7rem' } }, h('button', { class: 'btn primary', onclick: saveTpl }, 'Şablonu kaydet'), h('span', { class: 'small muted' }, 'Kaydedince sınavlarda seçilebilir.'))),
      h('div', { class: 'card' }, h('h2', null, 'Yazdır'),
        h('div', { class: 'row' }, h('label', { class: 'lbl' }, 'Boş form sayfası:'), copies, h('button', { class: 'btn', id: 'fm-print-blank', onclick: () => { const n = Math.max(1, Math.min(500, +copies.value || 1)), t = build(); if (t.error) return toast(t.error, 'bad'); printForms(t, Array.from({ length: n * t.nup }, () => ({}))); } }, 'Boş formları yazdır')),
        h('hr', { style: { border: 0, borderTop: '1px solid var(--line)', margin: '1rem 0' } }),
        h('div', { class: 'row' }, schSel, clsSel, info),
        h('label', { class: 'row', style: { margin: '.5rem 0 .2rem' } }, prefill, 'Öğrenci adı, numarası ve kurum kodu kutulara yazılsın'),
        h('label', { class: 'row', style: { margin: '.2rem 0 .5rem' } }, coded, 'Numara ve kurum kodu baloncukları da önceden doldurulsun (kodlanmış form)'),
        h('button', { class: 'btn', id: 'fm-print-personal', onclick: personalized }, 'Öğrenci listesinden kişiye özel yazdır'),
        h('p', { class: 'small muted' }, PRINT_HINT)),
      h('div', { class: 'card' }, h('h2', null, 'Kayıtlı şablonlar'), tplList)),
    h('div', null, h('div', { class: 'card' }, h('h2', null, 'Önizleme'), preview))));
  drawSecs(); refresh(); drawTpl();
}

/* ================================================================ harici optik */
function customTab(pane) {
  const S = App.state;
  const T = { img: null, name: '', anchors: [], groups: [], pending: null, mode: 'anchor', ref: null, zoom: 1 };
  const cv = h('canvas'), cx = cv.getContext('2d'), wrap = h('div', { class: 'tcanvas' }, cv), side = h('div'), msg = h('div', { class: 'alert info' });
  const fileIn = h('input', { type: 'file', accept: 'image/*', class: 'hidden', onchange: async e => { const f = e.target.files[0]; if (!f) return; try { T.img = await loadGray(f); T.anchors = []; T.groups = []; T.mode = 'anchor'; fit(); paint(); drawSide(); } catch (er) { toast(er.message, 'bad'); } e.target.value = ''; } });
  function fit() { const w = Math.min(1100, T.img.w); T.zoom = w / T.img.w; cv.width = Math.round(T.img.w * T.zoom); cv.height = Math.round(T.img.h * T.zoom); const id = cx.createImageData(cv.width, cv.height); T.ref = id; const g = T.img.gray; for (let y = 0; y < cv.height; y++) for (let x = 0; x < cv.width; x++) { const v = g[Math.min(T.img.h - 1, Math.round(y / T.zoom)) * T.img.w + Math.min(T.img.w - 1, Math.round(x / T.zoom))], o = (y * cv.width + x) * 4; id.data[o] = id.data[o + 1] = id.data[o + 2] = v; id.data[o + 3] = 255; } }
  const COL = { questions: '#e11d48', studentNo: '#2563eb', schoolCode: '#0d9488', booklet: '#9333ea' };
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
    g.id = g.role === 'questions' ? 'q' + T.groups.filter(x => x.role === 'questions').length : g.role === 'studentNo' ? 'no' : g.role === 'schoolCode' ? 'sc' : 'bk'; T.groups.push(g); T.pending = null; paint(); drawSide();
  }
  function drawSide() {
    clear(side);
    const aOk = T.anchors.length === 4;
    msg.textContent = !T.img ? '1) Boş (işaretsiz) optik formun net bir taramasını yükleyin.' : !aOk ? `2) Formun 4 köşe işaretini sırayla tıklayın: sol-üst, sağ-üst, sağ-alt, sol-alt (${T.anchors.length}/4). En dıştaki, birbirine benzeyen siyah işaretleri seçin.` :
      T.mode === 'p0' ? '3) Bloğun İLK baloncuğunun (sol-üst) ortasına tıklayın.' : T.mode === 'p1' ? '3) Bloğun SON baloncuğunun (sağ-alt) ortasına tıklayın.' : '3) Bölümleri tek tek ekleyin (sorular, öğrenci no, kitapçık). Çember çakışmasını görsel olarak kontrol edin.';
    side.append(msg, h('div', { class: 'row' }, h('button', { class: 'btn primary', id: 'cu-pick', onclick: () => fileIn.click() }, T.img ? 'Başka görüntü' : 'Boş form görüntüsü yükle'),
      T.img ? h('button', { class: 'btn', 'aria-label': 'Yakınlaştır', title: 'Yakınlaştır', onclick: () => zoomBy(1) }, '＋') : null, T.img ? h('button', { class: 'btn', 'aria-label': 'Uzaklaştır', title: 'Uzaklaştır', onclick: () => zoomBy(-1) }, '－') : null, T.anchors.length ? h('button', { class: 'btn', onclick: () => { T.anchors = []; T.mode = 'anchor'; paint(); drawSide(); } }, 'Köşeleri sıfırla') : null));
    if (!aOk) return;
    const role = h('select', { onchange: e => { gform.role = e.target.value; Object.assign(gform, e.target.value === 'questions' ? { n: 20, m: 5, gapEvery: 5, gapRatio: .45 } : e.target.value === 'studentNo' ? { n: 8, m: 10, gapEvery: 0, gapRatio: 0 } : e.target.value === 'schoolCode' ? { n: 6, m: 10, gapEvery: 0, gapRatio: 0 } : { n: 1, m: 4, gapEvery: 0, gapRatio: 0 }); drawSide(); } }, [['questions', 'Soru bloğu'], ['studentNo', 'Öğrenci numarası'], ['schoolCode', 'Kurum kodu'], ['booklet', 'Kitapçık türü']].map(([v, l]) => h('option', { value: v }, l))); role.value = gform.role;
    gform.axis = gform.role === 'questions' ? 'row' : (gform.role === 'studentNo' || gform.role === 'schoolCode') ? 'col' : 'row';
    const num = (label, key, min) => h('div', { class: 'field' }, h('label', null, label), h('input', { type: 'number', min: min == null ? 0 : min, step: 'any', value: gform[key], oninput: e => { gform[key] = parseFloat(e.target.value) || 0; } }));
    const labelsIn = h('input', { type: 'text', value: gform.labels || (gform.role === 'booklet' ? 'ABCD' : ''), placeholder: 'ABCD', oninput: e => { gform.labels = e.target.value.toUpperCase(); } });
    side.append(h('div', { class: 'card', style: { marginTop: '.8rem' } }, h('h3', null, 'Yeni blok'), h('div', { class: 'field' }, h('label', null, 'Blok türü'), role),
      h('div', { class: 'grid', style: { marginTop: '.5rem' } },
        gform.role === 'questions' ? [num('Soru sayısı (satır)', 'n', 1), num('Şık sayısı', 'm', 2), num('Her kaç satırda boşluk (0=yok)', 'gapEvery'), num('Boşluk oranı (satır aralığına göre)', 'gapRatio')] : (gform.role === 'studentNo' || gform.role === 'schoolCode') ? [num('Hane sayısı', 'n', 1)] : [h('div', { class: 'field' }, h('label', null, 'Kitapçık harfleri'), labelsIn)]),
      h('button', { class: 'btn', style: { marginTop: '.6rem' }, id: 'cu-addgroup', onclick: () => { if (gform.role === 'booklet') gform.m = Math.max(2, (labelsIn.value || 'ABCD').length); T.pending = { }; T.mode = 'p0'; drawSide(); } }, 'Köşe baloncuklarını tıklayarak yerleştir')),
      T.groups.length ? h('div', { class: 'card' }, h('h3', null, 'Tanımlı bloklar'), T.groups.map((g, i) => h('div', { class: 'row between', style: { marginBottom: '.3rem' } }, h('span', null, h('span', { class: 'pill', style: { background: COL[g.role], color: '#fff' } }, g.role === 'questions' ? 'Soru' : g.role === 'studentNo' ? 'No' : g.role === 'schoolCode' ? 'Kurum' : 'Kit.'), ` ${g.n}×${g.m}`),
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
      const fm = r.forms[0]; clear(testOut).append(h('div', { class: 'alert ok' }, `Okundu. Öğrenci no: ${fm.studentNo || '—'}${fm.schoolCode ? ' · Kurum kodu: ' + fm.schoolCode : ''}${fm.booklet ? ' · Kitapçık: ' + fm.booklet : ''} · ${fm.answers.split('').filter(c => /[A-H]/.test(c)).length} işaretli, ${fm.flags.filter(x => x.q).length} şüpheli soru`), h('div', { class: 'mono small', style: { wordBreak: 'break-all' } }, fm.answers)); } catch (er) { clear(testOut).append(h('div', { class: 'alert bad' }, er.message)); }
  } });
  function build() {
    if (T.anchors.length < 4) return { error: 'Önce 4 köşe işaretini seçin.' };
    const qs = T.groups.filter(g => g.role === 'questions'); if (!qs.length) return { error: 'En az bir soru bloğu ekleyin.' };
    let q = 1; const groups = []; let choices = 0, digits = 0, schoolDigits = 0, booklets = [];
    T.groups.forEach(g => { const { xs, ys } = geom(g), round = a => a.map(v => Math.round(v * 100) / 100);
      if (g.role === 'questions') { groups.push({ id: 'q' + groups.length, role: 'questions', axis: 'row', labels: 'ABCDEFGH'.slice(0, g.m).split(''), xs: round(xs), ys: round(ys), qStart: q }); q += g.n; choices = Math.max(choices, g.m); }
      else if (g.role === 'studentNo') { groups.push({ id: 'no', role: 'studentNo', axis: 'col', labels: '0123456789'.split(''), xs: round(xs), ys: round(ys) }); digits = g.n; }
      else if (g.role === 'schoolCode') { groups.push({ id: 'sc', role: 'schoolCode', axis: 'col', labels: '0123456789'.split(''), xs: round(xs), ys: round(ys) }); schoolDigits = g.n; }
      else { const lb = (g.labels || 'ABCD').slice(0, g.m).split(''); groups.push({ id: 'bk', role: 'booklet', axis: 'row', labels: lb, xs: round(xs), ys: round(ys) }); booklets = lb; } });
    const rs = T.groups.map(g => g.r), r = rs.reduce((a, b) => a + b, 0) / rs.length;
    return { kind: 'custom', version: 1, orient: false, nup: 1, frame: { w: T.img.w, h: T.img.h }, anchors: T.anchors.map(a => [Math.round(a[0] * 100) / 100, Math.round(a[1] * 100) / 100]), anchorSize: Math.round((T.anchorSize || 20) * 10) / 10, r: Math.round(r * 100) / 100, pitch: r / 0.38, questions: q - 1, choices, digits, schoolDigits, booklets, groups, decor: [] };
  }
  async function save() {
    const t = build(); if (t.error) return toast(t.error, 'bad'); if (!T.name.trim()) return toast('Şablon adı girin.', 'bad');
    try { await api('saveTemplate', { name: T.name.trim(), template: t }); await refreshBase(); toast(`Şablon kaydedildi (${t.questions} soru). Sınav ayarlarında seçebilirsiniz.`, 'ok'); } catch (e) { toast(e.message, 'bad'); }
  }
  pane.append(h('div', { class: 'card' }, h('p', { class: 'muted', style: { marginTop: 0 } }, 'Piyasadaki bir optik formu okutmak için: boş formun taramasını yükleyin, 4 köşe işaretini ve baloncuk bloklarını gösterin. Şablon kaydedilir ve o form tipi sınavlarda seçilir. Form tarama sırasında dik (en fazla 45° eğik) olmalıdır; baloncuk çizimleri gerçek baloncuklarla çakışana dek yarıçapı ayarlayın.')),
    h('div', { class: 'review wide' }, h('div', null, wrap), h('div', null, side)), fileIn, testFile); drawSide();
}
