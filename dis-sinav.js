/* dis-sinav.js — dış sınavlar: Excel şablonu indir, Excel/CSV yükle, satır satır gir/düzenle, sil. (Çözümleme mantığı dis-core.js'de.) */
'use strict';

const Dis = { list: [], loaded: false };
Dis.load = async function () { const d = await cached('ext:list', 'listExternal'); Dis.list = d.exams || []; Dis.loaded = true; return Dis.list; };
Dis.kaynaklar = () => Array.from(new Set(Dis.list.map(e => e.kaynak).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'tr'));

/* ---------------------------------------------------------------- ortak parçalar */
function dxLessonEditor(lessons, onChange, opt) {
  const box = h('div', { class: 'dx-lessons' });
  const draw = () => {
    clear(box);
    lessons.forEach((l, i) => box.append(h('div', { class: 'row dx-lrow', style: { marginBottom: '.3rem', flexWrap: 'nowrap' } },
      h('input', { type: 'text', class: 'dx-lname', value: l.name, placeholder: 'Ders adı', style: { flex: '0 1 16rem', width: '16rem' }, 'aria-label': 'Ders adı', onchange: e => { l.name = e.target.value.trim() || ('Ders ' + (i + 1)); onChange(); } }),
      h('input', { class: 'dx-lcount', type: 'number', min: 0, max: 500, value: l.count || 0, style: { width: '5.5rem' }, 'aria-label': 'Soru sayısı', onchange: e => { l.count = Math.max(0, Math.round(+e.target.value || 0)); onChange(); } }), h('span', { class: 'small muted' }, 'soru'),
      lessons.length > 1 && !(opt && opt.fixed) ? h('button', { class: 'btn ghost sm', title: 'Dersi kaldır', onclick: () => { lessons.splice(i, 1); draw(); onChange(true); } }, '✕') : null)));
    if (!(opt && opt.fixed) && lessons.length < 12) box.append(h('button', { class: 'btn sm dx-ladd', onclick: () => { lessons.push({ name: 'Ders ' + (lessons.length + 1), count: 10 }); draw(); onChange(true); } }, '+ Ders ekle'));
  };
  draw(); box.redraw = draw; return box;
}
const dxPenaltySelect = (value, onchange) => {
  const sel = h('select', { class: 'dx-pen', onchange: e => onchange(parseFloat(e.target.value)) }, DisCore.PENALTIES.map(p => h('option', { value: p.v }, p.label)));
  const near = DisCore.PENALTIES.find(p => Math.abs(p.v - value) < 1e-6);
  if (!near) sel.append(h('option', { value }, `Özel (${DisCore.penaltyToDiv(value)} yanlış 1 doğruyu götürür)`));
  sel.value = String(near ? near.v : value); return sel;
};
const dxDecode = buf => { const u = new Uint8Array(buf); let t = new TextDecoder('utf-8').decode(u); if (t.includes('�')) { try { t = new TextDecoder('windows-1254').decode(u); } catch (e) { } } return t; };
async function dxReadFile(file) {
  const buf = await file.arrayBuffer(), u = new Uint8Array(buf.slice(0, 4));
  if (u[0] === 0x50 && u[1] === 0x4B) return XlsxLite.read(buf);                    // .xlsx (zip)
  if (u[0] === 0xD0 && u[1] === 0xCF) throw new Error('Bu eski biçimde bir Excel dosyası (.xls). Excel\'de "Farklı kaydet → Excel Çalışma Kitabı (.xlsx)" ya da CSV olarak kaydedip yükleyin.');
  return { sheets: [{ name: 'CSV', rows: parseTable(dxDecode(buf)) }] };
}

/* ---------------------------------------------------------------- şablon indirme */
Dis.templateModal = function (init) {
  init = init || {}; const pre = DisCore.PRESETS[0];
  const st = { lessons: (init.lessons || pre.lessons).map(l => ({ name: l.name, count: l.count, short: l.short })), puanAdi: init.puanAdi || pre.puanAdi, penalty: init.penalty == null ? pre.penalty : init.penalty };
  const lessonBox = dxLessonEditor(st.lessons, () => { }), penHold = h('div'), puan = h('input', { type: 'text', id: 'dxt-puan', value: st.puanAdi, oninput: e => { st.puanAdi = e.target.value; } });
  const drawPen = () => clear(penHold).append(dxPenaltySelect(st.penalty, v => { st.penalty = v; }));
  drawPen();
  const preset = h('select', { id: 'dxt-preset', onchange: e => { const p = DisCore.PRESETS.find(x => x.id === e.target.value); if (!p) return; st.lessons.splice(0, st.lessons.length, ...p.lessons.map(l => ({ name: l.name, count: l.count, short: l.short }))); st.puanAdi = p.puanAdi; st.penalty = p.penalty; puan.value = p.puanAdi; lessonBox.redraw(); drawPen(); } }, DisCore.PRESETS.map(p => h('option', { value: p.id }, p.label)));
  const body = h('div', null,
    h('p', { class: 'small muted', style: { marginTop: 0 } }, 'Dışarıdan aldığınız sonuç listesi (örn. yayınevi LGS denemesi) ile aynı düzende bir Excel dosyası indirirsiniz: Sıra, Ö.No, İsim, Sınıf, her ders için D-Y-N, Toplam, Puan, Dereceler ve Genel/Okul Ortalaması satırları. Sınavdaki derslere göre sütunlar oluşur.'),
    h('div', { class: 'grid' }, h('div', { class: 'field' }, h('label', null, 'Hazır düzen'), preset), h('div', { class: 'field' }, h('label', null, 'Puan sütununun adı'), puan), h('div', { class: 'field' }, h('label', null, 'Yanlış kuralı'), penHold)),
    h('div', { class: 'field', style: { marginTop: '.7rem' } }, h('label', null, 'Dersler ve soru sayıları (sütunlar bu derslere göre oluşur)'), lessonBox));
  modal('Dış sınav · Excel şablonu indir', body, {
    size: 'wide', buttons: [{ label: 'Kapat' },
    { label: 'CSV şablonu', fn: () => { dxDownloadCsvTemplate(st); return false; } },
    { label: '⬇ Excel şablonunu indir (.xlsx)', cls: 'primary', fn: () => { dxDownloadTemplate(st); return false; } }]
  });
};
function dxDownloadTemplate(st) {
  const lessons = st.lessons.filter(l => l.name.trim()); if (!lessons.length) return toast('En az bir ders gerekli', 'bad');
  download('dis-sinav-sablonu.xlsx', XlsxLite.write(DisCore.buildTemplate({ lessons, puanAdi: st.puanAdi, penalty: st.penalty, date: today() })), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); toast('Şablon indirildi: doldurup "Excel/CSV yükle" ile ekleyin', 'ok');
}
function dxDownloadCsvTemplate(st) {
  const L = st.lessons.filter(l => l.name.trim()), head = ['Ö.No', 'İsim', 'Sınıf'];
  L.forEach(l => head.push(l.name + ' D', l.name + ' Y', l.name + ' N')); head.push('Toplam D', 'Toplam Y', 'Toplam N', st.puanAdi, 'Sınıf Derecesi', 'Okul Derecesi', 'İlçe Derecesi', 'İl Derecesi', 'Genel Derece', 'Genel Yüzde');
  download('dis-sinav-sablonu.csv', toCSV([head]), 'text/csv;charset=utf-8'); toast('CSV şablonu indirildi', 'ok');
}

/* ---------------------------------------------------------------- yükle / satır satır düzenle */
/** opts: { exam?: mevcut dış sınav (düzenleme), okulKodu?, tab: 'upload'|'grid', onSaved(examId) } */
Dis.editor = async function (opts) {
  opts = opts || {}; const S = App.state, ex = opts.exam || null, pre = DisCore.PRESETS[0];
  const schools = S.schools.slice().sort((a, b) => String(a.okulAdi).localeCompare(String(b.okulAdi), 'tr'));
  const st = {
    examId: ex ? ex.examId : null, okulKodu: String(ex ? ex.okulKodu : (Sel.okul(schools, '') || opts.okulKodu || (S.user.okulKodu) || (schools[0] && schools[0].okulKodu) || '')),
    name: ex ? ex.name : '', date: ex ? ex.date : today(), kaynak: ex ? ex.kaynak : '', puanAdi: ex ? ex.config.puanAdi : pre.puanAdi, choices: ex ? ex.config.choices : 4, penalty: ex ? ex.config.penalty : pre.penalty,
    lessons: ex ? ex.config.lessons.map(l => ({ name: l.name, count: l.count, short: l.short })) : pre.lessons.map(l => ({ name: l.name, count: l.count, short: l.short })),
    rows: [], avg: ex ? ex.config.avg : null, avgOkul: ex ? ex.config.avgOkul : null, tab: opts.tab || (ex ? 'grid' : 'upload'), students: new Map(), target: ex ? ex.examId : '', mode: ex ? 'replace' : 'merge', warnings: [], touched: {}, showRanks: false
  };
  if (ex) { try { st.rows = (await cached('ext:' + ex.examId, 'getExternal', { examId: ex.examId })).rows.map(r => ({ ogrNo: r.ogrNo, ad: r.ad, sinif: r.sinif, sec: r.sec.map(s => s.slice()), tot: (r.tot || [null, null, null]).slice(), puan: r.puan, rk: Object.assign({}, r.rk) })); } catch (e) { toast(e.message, 'bad'); return; } }
  const el = {}; let dlg;
  const nL = () => st.lessons.length;
  const loadStudents = async () => { st.students = new Map(); (await getStudents(st.okulKodu)).forEach(s => st.students.set(normNo(s.ogrNo), s)); };
  await loadStudents();

  /* ---- üst alanlar */
  const field = (label, node, cls) => h('div', { class: 'field ' + (cls || '') }, h('label', null, label), node);
  el.okul = h('select', { id: 'dx-okul', disabled: !!ex, onchange: async e => { st.okulKodu = e.target.value; st.target = ''; await loadStudents(); drawTarget(); drawSummary(); } }, schools.map(s => h('option', { value: s.okulKodu }, schoolLabel(s))));
  el.okul.value = st.okulKodu; const okulPick = schoolPicker(el.okul, schools); if (el.okul.value) st.okulKodu = el.okul.value;
  el.name = h('input', { type: 'text', id: 'dx-name', value: st.name, placeholder: 'Örn: DARGE 1. LGS Denemesi', oninput: e => { st.name = e.target.value; st.touched.name = 1; } });
  el.date = h('input', { id: 'dx-date', type: 'date', value: st.date, oninput: e => { st.date = e.target.value; st.touched.date = 1; } });
  el.kaynak = h('input', { type: 'text', id: 'dx-kaynak', value: st.kaynak, list: 'dx-kaynak-list', placeholder: 'Yayınevi / kurum', oninput: e => { st.kaynak = e.target.value; st.touched.kaynak = 1; } });
  el.puan = h('input', { type: 'text', id: 'dx-puan', value: st.puanAdi, oninput: e => { st.puanAdi = e.target.value; st.touched.puan = 1; } });
  const penHold = h('div'); const drawPen = () => clear(penHold).append(dxPenaltySelect(st.penalty, v => { st.penalty = v; st.touched.pen = 1; st.rows.forEach(recalc); if (st.tab === 'grid') drawGrid(); }));
  drawPen();
  const targetHold = h('div');
  function drawTarget() {
    clear(targetHold); if (ex) return;
    const mine = Dis.list.filter(e => String(e.okulKodu) === String(st.okulKodu));
    if (!mine.length) return;
    const sel = h('select', { id: 'dx-target', onchange: e => { st.target = e.target.value; const t = mine.find(x => x.examId === st.target); if (t) { st.name = t.name; st.date = t.date || st.date; st.kaynak = t.kaynak || ''; el.name.value = st.name; el.date.value = st.date; el.kaynak.value = st.kaynak; } drawTarget(); } },
      h('option', { value: '' }, 'Yeni sınav olarak kaydet'), mine.map(t => h('option', { value: t.examId }, `Mevcut sınava ekle: ${t.name}${t.date ? ' · ' + t.date : ''} (${t.n} öğr.)`))); sel.value = st.target;
    targetHold.append(field('Nereye kaydedilsin?', sel), st.target ? h('div', { class: 'field', style: { marginTop: '.4rem' } }, h('label', null, 'Mevcut sınavda aynı öğrenciler varsa'),
      h('select', { id: 'dx-mode', onchange: e => { st.mode = e.target.value; } }, h('option', { value: 'merge' }, 'Aynı numaralıları güncelle, diğerlerini koru'), h('option', { value: 'replace' }, 'Önceki tüm sonuçları sil, yenileriyle değiştir')), h('span', { class: 'small muted' }, 'Dersler mevcut sınavdakiyle ada göre eşleştirilir.')) : null);
    if (st.mode !== 'merge' && st.mode !== 'replace') st.mode = 'merge'; const m = $('#dx-mode'); if (m) m.value = st.mode;
  }
  drawTarget();
  const head = h('div', null,
    h('div', { class: 'grid' }, field('Okul', okulPick, 'dx-okulfield'), field('Sınav adı', el.name), field('Tarih', el.date), field('Kaynak / kurum', el.kaynak), field('Puan adı', el.puan), field('Yanlış kuralı', penHold)),
    h('datalist', { id: 'dx-kaynak-list' }, Dis.kaynaklar().map(k => h('option', { value: k }))), targetHold);

  /* ---- Excel / CSV yükle sekmesi */
  const summary = h('div', { id: 'dx-summary' });
  el.file = h('input', { id: 'dx-file', type: 'file', accept: '.xlsx,.xlsm,.csv,.tsv,.txt', onchange: async e => { const f = e.target.files[0]; if (f) await parseInput(() => dxReadFile(f), f.name); e.target.value = ''; } });
  el.paste = h('textarea', { id: 'dx-paste', rows: 5, placeholder: 'Excel\'den kopyaladığınız tabloyu (başlık satırı dahil) buraya yapıştırabilirsiniz…', style: { width: '100%' } });
  const uploadPane = h('div', null,
    h('div', { class: 'row', style: { marginBottom: '.6rem' } }, FilePick.field(el.file, { label: 'Excel / CSV dosyası seç' }), h('button', { class: 'btn', id: 'dx-tpl', onclick: () => Dis.templateModal({ lessons: st.lessons, puanAdi: st.puanAdi, penalty: st.penalty }) }, '⬇ Hazır Excel şablonunu indir')),
    h('details', null, h('summary', { class: 'small' }, 'Ya da tabloyu yapıştır'), el.paste, h('div', { class: 'row end', style: { marginTop: '.4rem' } }, h('button', { class: 'btn sm', id: 'dx-parse', onclick: () => { const t = el.paste.value; if (!t.trim()) return toast('Önce tabloyu yapıştırın', 'warn'); parseInput(async () => ({ sheets: [{ name: 'Yapıştırılan', rows: parseTable(t) }] }), 'yapıştırılan tablo'); } }, 'Çözümle'))),
    summary);

  async function parseInput(getWb, label) {
    clear(summary).append(h('div', { class: 'muted small' }, 'Dosya çözümleniyor…'));
    let res;
    try { res = DisCore.parseWorkbook(await getWb()); } catch (e) { clear(summary).append(h('div', { class: 'alert bad' }, e.message)); return; }
    if (res.error) { clear(summary).append(h('div', { class: 'alert bad' }, res.error)); return; }
    const e = res.exam, p = res.parsed;
    if (e.name && !st.touched.name) { st.name = e.name; el.name.value = e.name; } else if (!st.name) { st.name = String(label || '').replace(/\.[a-z0-9]+$/i, ''); el.name.value = st.name; }
    if (e.date && !st.touched.date) { st.date = e.date; el.date.value = e.date; }
    if (e.kaynak && !st.touched.kaynak) { st.kaynak = e.kaynak; el.kaynak.value = e.kaynak; }
    if (e.puanAdi && !st.touched.puan) { st.puanAdi = e.puanAdi; el.puan.value = e.puanAdi; }
    if (e.penalty != null && !st.touched.pen) { st.penalty = e.penalty; drawPen(); }
    if (e.choices) st.choices = e.choices;
    DisCore.complete(p, st.penalty);
    st.lessons = p.lessons.map(l => ({ name: l.name, count: l.count, short: l.short, guessed: l.guessed })); st.rows = p.rows; st.avg = p.avg; st.avgOkul = p.avgOkul; st.warnings = res.warnings.slice(); st.fileLabel = label;
    drawSummary(); drawLessonBox();
  }
  function matchInfo() {
    let known = 0; const miss = []; st.rows.forEach(r => { if (st.students.has(normNo(r.ogrNo))) known++; else miss.push(r); }); return { known, miss };
  }
  function drawSummary() {
    clear(summary); if (!st.rows.length) return;
    const { known, miss } = matchInfo(), school = schoolByCode(st.okulKodu);
    summary.append(h('div', { class: 'card', style: { marginTop: '.8rem', marginBottom: 0 } },
      h('div', { class: 'row' }, h('b', null, `${st.rows.length} öğrenci`), h('span', { class: 'pill brand' }, `${nL()} ders`), st.avg ? h('span', { class: 'pill' }, 'Genel ortalama var') : null, st.avgOkul ? h('span', { class: 'pill' }, 'Okul ortalaması var') : null, st.fileLabel ? h('span', { class: 'small muted' }, st.fileLabel) : null),
      h('div', { class: 'small', style: { margin: '.4rem 0' } }, st.lessons.map(l => `${l.name} (${l.count}${l.guessed ? '?' : ''})`).join(' · ')),
      st.lessons.some(l => l.guessed) ? h('div', { class: 'small muted' }, '? = soru sayısı dosyada yok; en yüksek D+Y değerinden tahmin edildi. "Satır satır / düzenle" sekmesinde düzeltebilirsiniz.') : null,
      st.students.size ? h('div', { class: 'alert ' + (miss.length ? 'warn' : 'ok'), id: 'dx-match' }, `${known} öğrenci ${school ? school.okulAdi : 'okul'} öğrenci listesindeki numaralarla eşleşti` + (miss.length ? `; ${miss.length} öğrenci listede yok (${miss.slice(0, 5).map(r => r.ogrNo).join(', ')}${miss.length > 5 ? '…' : ''}). Yine de eklenir; analizde dosyadaki adıyla görünür.` : '.'))
        : h('div', { class: 'alert info' }, 'Bu okulun öğrenci listesi boş; öğrenciler dosyadaki ad ve sınıfla eklenir.'),
      st.warnings.map(w => h('div', { class: 'alert warn' }, w)),
      h('div', { class: 'small muted' }, 'Kontrol etmek/düzeltmek için "Satır satır / düzenle" sekmesine bakın; hazırsanız "Kaydet ve aktar".')));
  }

  /* ---- satır satır sekmesi */
  const gridHold = h('div', { id: 'dx-grid' }), lessonHold = h('div');
  function drawLessonBox() { clear(lessonHold); const b = dxLessonEditor(st.lessons, structural => { if (structural) { st.rows.forEach(r => { while (r.sec.length < nL()) r.sec.push([null, null, null]); r.sec.length = nL(); recalc(r); }); } if (st.tab === 'grid') drawGrid(); }, { fixed: !!(ex && false) }); lessonHold.append(b); }
  function recalc(r) {
    let tD = 0, tY = 0, tN = 0;
    r.sec.forEach(s => { if (s[0] != null || s[1] != null) s[2] = DisCore.r2((s[0] || 0) - (s[1] || 0) * st.penalty); tD += s[0] || 0; tY += s[1] || 0; tN += s[2] || 0; });
    r.tot = [tD, tY, DisCore.r2(tN)];
  }
  const blankRow = () => ({ ogrNo: '', ad: '', sinif: '', sec: st.lessons.map(() => [null, null, null]), tot: [0, 0, 0], puan: null, rk: {} });
  function drawGrid() {
    clear(gridHold); const L = st.lessons, MAX = 300, rows = st.rows.slice(0, MAX), refs = [];
    const inp = (v, cb, w, extra) => h('input', Object.assign({ type: 'text', value: v == null ? '' : v, style: { width: w || '3.4rem', minHeight: '30px', padding: '.2rem .3rem', textAlign: extra && extra.left ? 'left' : 'right' }, onchange: e => cb(e.target.value, e.target) }, extra && extra.attrs));
    const thead = h('thead', null, h('tr', null, h('th', null, '#'), h('th', null, 'Ö.No'), h('th', null, 'Ad Soyad'), h('th', null, 'Sınıf'), L.map(l => h('th', { colspan: 3, class: 'center', style: { borderLeft: '1px solid var(--line)' } }, l.name)), h('th', { colspan: 3, class: 'center', style: { borderLeft: '1px solid var(--line)' } }, 'Toplam'), h('th', null, st.puanAdi || 'Puan'), st.showRanks ? ['Snf', 'Okul', 'İlçe', 'İl', 'Genel', 'Yüzde'].map(x => h('th', null, x)) : null, h('th', null, '')),
      h('tr', null, h('th'), h('th'), h('th'), h('th'), L.map(() => ['D', 'Y', 'N'].map((x, i) => h('th', { class: 'center', style: i === 0 ? { borderLeft: '1px solid var(--line)' } : null }, x))), ['D', 'Y', 'N'].map((x, i) => h('th', { class: 'center', style: i === 0 ? { borderLeft: '1px solid var(--line)' } : null }, x)), h('th'), st.showRanks ? ['', '', '', '', '', ''].map(() => h('th')) : null, h('th')));
    const tbody = h('tbody');
    rows.forEach((r, ri) => {
      const ref = {}; refs[ri] = ref; const upd = () => { L.forEach((l, li) => { ref['n' + li].textContent = nf(r.sec[li][2]); }); ref.tD.textContent = nf(r.tot[0]); ref.tY.textContent = nf(r.tot[1]); ref.tN.textContent = nf(r.tot[2]); };
      const numCell = (get, set, w) => h('td', null, inp(get(), (v, t) => { const n = DisCore.num(v); set(n); t.value = n == null ? '' : n; }, w));
      const tr = h('tr', null,
        h('td', { class: 'muted small' }, ri + 1),
        h('td', null, inp(r.ogrNo, (v, t) => { r.ogrNo = DisCore.normNo(v); t.value = r.ogrNo; const s = st.students.get(normNo(r.ogrNo)); if (s) { if (!r.ad) { r.ad = (s.ad + ' ' + (s.soyad || '')).trim(); ref.ad.value = r.ad; } if (!r.sinif) { r.sinif = String(s.sinif || ''); ref.sinif.value = r.sinif; } } }, '5.2rem', { left: true, attrs: { 'data-c': 'no', inputmode: 'numeric' } })),
        h('td', null, (ref.ad = inp(r.ad, v => { r.ad = v.trim(); }, '12rem', { left: true, attrs: { 'data-c': 'ad' } }))),
        h('td', null, (ref.sinif = inp(r.sinif, v => { r.sinif = v.trim(); }, '3.6rem', { left: true, attrs: { 'data-c': 'sinif' } }))),
        L.map((l, li) => [
          h('td', { style: { borderLeft: '1px solid var(--line)' } }, inp(r.sec[li][0], (v, t) => { const n = DisCore.num(v); r.sec[li][0] = n; t.value = n == null ? '' : n; recalc(r); upd(); }, '3rem', { attrs: { 'data-c': 'd' + li, inputmode: 'numeric' } })),
          h('td', null, inp(r.sec[li][1], (v, t) => { const n = DisCore.num(v); r.sec[li][1] = n; t.value = n == null ? '' : n; recalc(r); upd(); }, '3rem', { attrs: { 'data-c': 'y' + li, inputmode: 'numeric' } })),
          h('td', { class: 'num muted' }, (ref['n' + li] = h('span', null, nf(r.sec[li][2]))))]),
        h('td', { class: 'num', style: { borderLeft: '1px solid var(--line)' } }, (ref.tD = h('span', null, nf(r.tot[0])))), h('td', { class: 'num' }, (ref.tY = h('span', null, nf(r.tot[1])))), h('td', { class: 'num' }, h('b', null, (ref.tN = h('span', null, nf(r.tot[2]))))),
        numCell(() => r.puan, n => { r.puan = n; }, '4.6rem'),
        st.showRanks ? ['snf', 'okul', 'ilce', 'il', 'genel', 'pct'].map(k => numCell(() => r.rk[k], n => { if (n == null) delete r.rk[k]; else r.rk[k] = n; }, '3.4rem')) : null,
        h('td', null, h('button', { class: 'btn ghost sm', title: 'Satırı sil', onclick: () => { st.rows.splice(ri, 1); drawGrid(); drawSummary(); } }, '✕')));
      tr.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); e.target.dispatchEvent(new Event('change')); const c = e.target.getAttribute('data-c'), nx = tbody.children[ri + 1]; const t = nx && c ? nx.querySelector(`[data-c="${c}"]`) : null; if (t) { t.focus(); t.select && t.select(); } else if (!nx) { st.rows.push(blankRow()); drawGrid(); const last = $$('#dx-grid tbody tr').pop(); const f = last && last.querySelector('[data-c="no"]'); if (f) f.focus(); } } });
      tbody.append(tr);
    });
    gridHold.append(
      h('div', { class: 'row', style: { marginBottom: '.5rem' } }, h('button', { class: 'btn sm primary', id: 'dx-add', onclick: () => { st.rows.push(blankRow()); drawGrid(); const last = $$('#dx-grid tbody tr').pop(); const f = last && last.querySelector('[data-c="no"]'); if (f) f.focus(); } }, '+ Öğrenci satırı ekle'),
        h('button', { class: 'btn sm', onclick: () => { for (let i = 0; i < 5; i++) st.rows.push(blankRow()); drawGrid(); } }, '+5 satır'),
        h('label', { class: 'small row', style: { gap: '.3rem' } }, h('input', { type: 'checkbox', id: 'dx-ranks', checked: st.showRanks, style: { width: 'auto', minHeight: 0 }, onchange: e => { st.showRanks = e.target.checked; drawGrid(); } }), 'Dereceleri de gir (Snf/Okul/İlçe/İl/Genel)'),
        h('span', { class: 'grow' }), h('span', { class: 'small muted' }, `${st.rows.length} satır`), st.rows.length ? h('button', { class: 'btn ghost sm', onclick: async () => { if (await confirmBox('Tablodaki tüm satırlar silinsin mi?', 'Sil', true)) { st.rows = []; drawGrid(); drawSummary(); } } }, 'Temizle') : null),
      h('div', { class: 'small muted', style: { marginBottom: '.4rem' } }, 'D ve Y\'yi girin; Net ve Toplam otomatik hesaplanır. Ö.No öğrenci listesindeyse ad ve sınıf otomatik gelir. Enter bir alt satıra geçer.'),
      st.rows.length ? h('div', { class: 'tablewrap', style: { maxHeight: '48vh' } }, h('table', { class: 'dx-grid' }, thead, tbody)) : h('div', { class: 'empty card' }, 'Henüz satır yok. "+ Öğrenci satırı ekle" ile başlayın ya da Excel/CSV yükleyin.'),
      st.rows.length > MAX ? h('div', { class: 'small muted' }, `Ekranda ilk ${MAX} satır düzenlenebilir; ${st.rows.length} satırın tamamı kaydedilir.`) : null);
  }
  const gridPane = h('div', null, h('div', { class: 'field', style: { marginBottom: '.6rem' } }, h('label', null, 'Dersler ve soru sayıları'), lessonHold), gridHold); drawLessonBox();

  /* ---- sekmeler */
  const pane = h('div'), tabsEl = h('div', { class: 'tabs' });
  const drawTabs = () => {
    clear(tabsEl).append([['upload', 'Excel / CSV yükle', 'dx-tab-upload'], ['grid', 'Satır satır gir / düzenle', 'dx-tab-grid']].map(([id, l, tid]) => h('button', { id: tid, class: st.tab === id ? 'active' : '', onclick: () => { st.tab = id; drawTabs(); } }, l)));
    clear(pane).append(st.tab === 'upload' ? uploadPane : gridPane); if (st.tab === 'upload') drawSummary(); else drawGrid();
  };
  drawTabs();
  const body = h('div', { class: 'dx' }, head, h('hr', { style: { border: 0, borderTop: '1px solid var(--line)', margin: '.9rem 0' } }), tabsEl, pane, h('div', { id: 'dx-progress', class: 'small muted' }));

  /* ---- kaydet */
  function validate() {
    if (!st.okulKodu) return 'Okul seçin.'; if (!st.name.trim()) return 'Sınav adı gerekli.';
    if (!st.lessons.length || st.lessons.some(l => !l.name.trim())) return 'Ders adları boş olamaz.';
    const names = st.lessons.map(l => DisCore.nk(l.name)); if (new Set(names).size !== names.length) return 'Aynı adlı iki ders var.';
    const rows = st.rows.filter(r => r.ogrNo); if (!rows.length) return 'Kaydedilecek öğrenci satırı yok (Ö.No dolu olmalı).';
    return '';
  }
  async function save(btn, close) {
    const err = validate(); if (err) { toast(err, 'bad'); return false; }
    const prog = $('#dx-progress'); btn && (btn.disabled = true);
    try {
      let target = ex || (st.target ? Dis.list.find(t => t.examId === st.target) : null), lessons = st.lessons, rows = st.rows.filter(r => r.ogrNo).map(r => Object.assign({}, r));
      let cfg = { lessons: lessons.map(l => ({ name: l.name.trim(), count: l.count || 0, short: l.short || '' })), choices: st.choices, penalty: st.penalty, puanAdi: st.puanAdi.trim() || 'Puan', avg: st.avg, avgOkul: st.avgOkul };
      if (target && !ex) {      // mevcut sınava ekleme: dersleri mevcut sınavınkiyle ada göre eşleştir
        const tc = target.config, idx = tc.lessons.map(tl => lessons.findIndex(l => DisCore.nk(l.name) === DisCore.nk(tl.name)));
        const missing = tc.lessons.filter((_, i) => idx[i] < 0).map(l => l.name), extra = lessons.filter(l => !tc.lessons.some(tl => DisCore.nk(tl.name) === DisCore.nk(l.name))).map(l => l.name);
        if (idx.every(i => i < 0)) throw new Error('Bu dosyadaki dersler seçilen sınavdaki derslerle eşleşmiyor.');
        if ((missing.length || extra.length) && !(await confirmBox(`Dersler tam uyuşmuyor.${missing.length ? ' Dosyada olmayan: ' + missing.join(', ') + '.' : ''}${extra.length ? ' Sınavda olmayan (atlanacak): ' + extra.join(', ') + '.' : ''} Devam edilsin mi?`, 'Devam'))) { btn && (btn.disabled = false); return false; }
        rows.forEach(r => { r.sec = idx.map(i => (i >= 0 && r.sec[i]) ? r.sec[i] : [null, null, null]); });
        cfg = { lessons: tc.lessons, choices: tc.choices, penalty: tc.penalty, puanAdi: tc.puanAdi, avg: tc.avg || st.avg, avgOkul: tc.avgOkul || st.avgOkul };
      }
      rows.forEach(r => { const s = st.students.get(normNo(r.ogrNo)); if (s) { if (!r.ad) r.ad = (s.ad + ' ' + (s.soyad || '')).trim(); if (!r.sinif) r.sinif = String(s.sinif || ''); } });
      prog.textContent = 'Sınav kaydediliyor…';
      const saved = await api('saveExternal', { exam: { examId: target ? target.examId : undefined, name: st.name.trim(), date: st.date, kaynak: st.kaynak.trim(), okulKodu: st.okulKodu, config: cfg } });
      const send = DisCore.toServerRows(rows), CH = 300; let added = 0, updated = 0, skipped = 0; const replace = ex ? true : (target ? st.mode === 'replace' : true);
      for (let i = 0; i < send.length; i += CH) { prog.textContent = `Öğrenci sonuçları gönderiliyor… ${Math.min(i + CH, send.length)}/${send.length}`; const r = await api('importExternal', { examId: saved.examId, rows: send.slice(i, i + CH), reset: replace && i === 0 }, { timeout: 120000 }); added += r.added; updated += r.updated; skipped += r.skipped; }
      await Dis.load().catch(() => { }); await DB.del('kv', 'ext:' + saved.examId).catch(() => { });
      toast(`Dış sınav kaydedildi: ${added + updated} öğrenci${updated ? ` (${updated} güncellendi)` : ''}${skipped ? `, ${skipped} satır atlandı` : ''}`, 'ok'); close(); if (opts.onSaved) opts.onSaved(saved.examId); return false;
    } catch (e) { toast(e.message, 'bad'); clear($('#dx-progress')); btn && (btn.disabled = false); return false; }
  }
  dlg = modal(ex ? 'Dış sınavı düzenle' : 'Dış sınav ekle', body, { size: 'full', noBackdrop: true, buttons: [{ label: 'Vazgeç' }, { label: 'Kaydet ve aktar', cls: 'primary', keepOpen: true, fn: (ev, close) => { const b = ev.currentTarget; save(b, close); } }] });
  const sb = $$('.overlay footer .btn.primary').pop(); if (sb) sb.id = 'dx-save';
  return dlg;
};

Dis.remove = async function (ex, done) {
  if (!(await confirmBox(`"${ex.name}" dış sınavı ve ${ex.n} öğrencinin sonucu silinsin mi? Bu işlem geri alınamaz.`, 'Sil', true))) return;
  try { await api('deleteExternal', { examId: ex.examId }); await DB.del('kv', 'ext:' + ex.examId).catch(() => { }); await Dis.load().catch(() => { }); toast('Dış sınav silindi', 'ok'); if (done) done(); } catch (e) { toast(e.message, 'bad'); }
};
