/*  forms-kod.js — Kodlu baskı: hazır (harici) formun üzerine öğrenciye özel dolu baloncuklar basar.
 *  Boş formun taramasından çıkan şablon her baloncuğun yerini bilir; konumlar kâğıt ölçeğine (tam sayfa tarama ya da dpi) çevrilir.
 *  Yazıcı payı için kaydırma (mm) ve ölçek (%) ayarı vardır; "Hizalama sayfası" düz kâğıda basılıp formun üzerine tutularak denenir. */
'use strict';

const KOD_DEF = { paper: 'A4', pw: 210, ph: 297, dpi: 0, dx: 0, dy: 0, sx: 100, sy: 100, dot: 86 };
const KOD_FIELDS = { studentNo: 'Öğrenci no', schoolCode: 'Kurum kodu', name: 'Ad–soyad', booklet: 'Kitapçık' };

/** Servis çalışanı/yazdırma CSS'i A4 varsayar; seçilen kâğıt için sayfa boyutunu geçici olarak ayarlar. */
function printSheets(svgs, paper) {
  const pa = clear($('#printArea')), [W, H] = paper || [210, 297];
  svgs.forEach(svg => { const sh = h('div', { class: 'sheet' }); sh.innerHTML = svg; pa.append(sh); });
  const st = h('style', { id: 'kod-page' }); st.textContent = `@media print { @page { size: ${W}mm ${H}mm; margin: 0; } #printArea .sheet { width: ${W}mm; height: ${H}mm; } #printArea .sheet svg { width: ${W}mm; height: ${H}mm; } }`;
  document.head.append(st);
  const done = () => { clear(pa); st.remove(); window.removeEventListener('afterprint', done); }; window.addEventListener('afterprint', done); setTimeout(() => window.print(), 150);
}

/** Kayıtlı harici şablon için kodlu baskı penceresi. t = { templateId, name, json } */
async function codedPrint(t) {
  const tpl = t.json, S = App.state, calKey = 'kodcal:' + t.templateId;
  if (!tpl || tpl.kind !== 'custom' || !Array.isArray(tpl.groups)) return toast('Kodlu baskı yalnızca harici (otomatik tanıtılan) formlarda vardır.', 'bad');
  const has = r => tpl.groups.some(g => g.role === r), hasName = has('name') || has('surname'), bothName = has('name') && has('surname');
  const cal = Object.assign({}, KOD_DEF, tpl.print || {}, Settings.get(calKey, {}) || {});
  const pick = Object.assign({ studentNo: has('studentNo'), schoolCode: has('schoolCode'), name: hasName, booklet: false }, Settings.get('kodpick', {}) || {});
  Object.keys(KOD_FIELDS).forEach(k => { if (!(k === 'name' ? hasName : has(k))) pick[k] = false; });
  let frameMm = Object.assign({ x: 8, y: 8, w: 194, h: 281 }, Settings.get(calKey + ':f', {}) || {});
  let stu = [], picked = new Set(), noAlign = Settings.get('kodalign', 'left');

  const num = (id, key, o) => { const el = h('input', Object.assign({ type: 'number', id, value: cal[key], style: { width: '92px' }, oninput: e => { cal[key] = e.target.value === '' ? KOD_DEF[key] : +e.target.value; preview(); } }, o || {})); return el; };
  const fld = (label, el, hint) => h('div', { class: 'field' }, h('label', null, label), el, hint ? h('div', { class: 'small muted' }, hint) : null);
  const paperSel = h('select', { id: 'kod-paper', onchange: e => { cal.paper = e.target.value; customBox.style.display = cal.paper === 'custom' ? '' : 'none'; preview(); } }, ['A4', 'A5', 'A3', 'Letter', 'custom'].map(p => h('option', { value: p }, p === 'custom' ? 'Özel ölçü…' : p === 'Letter' ? 'Letter (215,9×279,4)' : p)));
  paperSel.value = cal.paper;
  const customBox = h('div', { class: 'row', style: { display: cal.paper === 'custom' ? '' : 'none' } }, 'Genişlik', num('kod-pw', 'pw', { min: 50, max: 600, step: 0.1 }), 'Yükseklik (mm)', num('kod-ph', 'ph', { min: 50, max: 800, step: 0.1 }));
  const frameBox = h('div', { class: 'alert info small', style: { display: tpl.page ? 'none' : '' }, id: 'kod-nopage' }, 'Bu şablonda tarama (sayfa) bilgisi yok. Formu "Otomatik tanıt" sekmesinde yeniden çözümleyip kaydederseniz milimetre ölçüsü otomatik gelir. Şimdilik köşe işaretleri arasındaki ölçüyü elle girin (cetvelle): ',
    h('div', { class: 'row', style: { marginTop: '.3rem' } }, ['x', 'y', 'w', 'h'].map(k => h('label', { class: 'small' }, { x: 'Sol-üst işaretin soldan (mm) ', y: 'üstten (mm) ', w: 'İşaretler arası yatay (mm) ', h: 'dikey (mm) ' }[k], h('input', { type: 'number', id: 'kod-f' + k, step: 0.1, value: frameMm[k], style: { width: '84px' }, oninput: e => { frameMm[k] = +e.target.value || 0; Settings.set(calKey + ':f', frameMm); preview(); } })))));
  const alignSel = h('select', { id: 'kod-align', onchange: e => { noAlign = e.target.value; Settings.set('kodalign', noAlign); preview(); } }, h('option', { value: 'left' }, 'Sola dayalı (kalan sütunlar boş)'), h('option', { value: 'right' }, 'Sağa dayalı (baştaki sütunlar boş)')); alignSel.value = noAlign;
  const bkSel = h('select', { id: 'kod-bk', onchange: preview }, h('option', { value: '' }, 'Kitapçık işaretlenmesin'), (tpl.booklets || []).map(b => h('option', { value: b }, 'Kitapçık ' + b)));
  const chk = (k, label) => h('label', { class: 'row', style: { gap: '.4rem' } }, h('input', { type: 'checkbox', id: 'kod-pick-' + k, checked: !!pick[k], disabled: !(k === 'name' ? hasName : has(k)), onchange: e => { pick[k] = e.target.checked; Settings.set('kodpick', pick); preview(); } }), label);
  const calOf = () => Object.assign({}, cal, { dot: (+cal.dot || 86) / 100, frameMm: tpl.page ? undefined : frameMm });
  const dataOf = s => { const d = {}; if (!s) return d; if (pick.studentNo) d.studentNo = s.ogrNo; if (pick.schoolCode) d.schoolCode = s.okulKodu || schSel.value; if (pick.name) { d.name = s.ad; d.surname = s.soyad; } if (pick.booklet && bkSel.value) d.booklet = bkSel.value; return d; };
  const sample = () => ({ ogrNo: '1234567890'.slice(0, Math.max(1, Math.min(10, (tpl.digits | 0) || 7))), ad: 'AHMET CAN', soyad: 'ÇELİKÖZ', okulKodu: String(schSel.value || '1234567890').slice(0, 12) });

  const schSel = h('select', { id: 'kod-school' }, h('option', { value: '' }, 'Okul seçin…'), S.schools.map(s => h('option', { value: s.okulKodu }, schoolLabel(s)))), clsSel = h('select', { id: 'kod-class' }, h('option', { value: '' }, 'Tüm sınıflar')), schPick = schoolPicker(schSel, S.schools);
  const stuQ = h('input', { type: 'search', id: 'kod-q', placeholder: 'Öğrenci ara (ad, numara)…', oninput: () => paintStu() }), stuBox = h('div', { class: 'stulist', id: 'kod-list' }), pickInfo = h('span', { class: 'small muted', id: 'kod-pickinfo' });
  const visible = () => { const q = deTRs(stuQ.value); return stu.filter(s => (!clsSel.value || s.sinif === clsSel.value) && (!q || deTRs(s.ad + s.soyad + s.ogrNo).includes(q))).sort((a, b) => String(a.sinif || '').localeCompare(String(b.sinif || ''), 'tr', { numeric: true }) || String(a.ogrNo).localeCompare(String(b.ogrNo), undefined, { numeric: true })); };
  const chosen = () => stu.filter(s => picked.has(String(s.ogrNo))).sort((a, b) => String(a.sinif || '').localeCompare(String(b.sinif || ''), 'tr', { numeric: true }) || String(a.ogrNo).localeCompare(String(b.ogrNo), undefined, { numeric: true }));
  function paintStu() {
    const list = visible(), shown = list.slice(0, 300);
    clear(stuBox).append(shown.length ? shown.map(s => h('label', { class: 'stuitem', 'data-no': s.ogrNo }, h('input', { type: 'checkbox', class: 'kod-chk', checked: picked.has(String(s.ogrNo)), onchange: e => { e.target.checked ? picked.add(String(s.ogrNo)) : picked.delete(String(s.ogrNo)); sync(); } }), h('span', null, h('b', null, s.ogrNo), ' ', `${s.ad} ${s.soyad}`, s.sinif ? h('span', { class: 'small muted' }, ' · ' + s.sinif) : null))) : h('div', { class: 'small muted', style: { padding: '.6rem' } }, schSel.value ? 'Bu okulda öğrenci listesi yok.' : 'Önce okul seçin.'));
    sync();
  }
  function sync() { pickInfo.textContent = picked.size ? `${picked.size} öğrenci seçili` : 'Hiç öğrenci seçilmedi'; printBtn.textContent = picked.size ? `Seçilen ${picked.size} öğrenci için yazdır` : 'Seçilenler için yazdır'; printBtn.disabled = !picked.size; preview(); }
  schSel.addEventListener('change', async () => { picked.clear(); stuQ.value = ''; stu = schSel.value ? await getStudents(schSel.value) : []; clear(clsSel).append(h('option', { value: '' }, 'Tüm sınıflar'), ...Array.from(new Set(stu.map(s => s.sinif).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'tr', { numeric: true })).map(c => h('option', { value: c }, c))); paintStu(); });
  clsSel.addEventListener('change', paintStu);

  const prevBox = h('div', { class: 'kod-prev', id: 'kod-prev' }), notesBox = h('div', { class: 'small', id: 'kod-notes' });
  function preview() {
    clear(prevBox); clear(notesBox); const first = chosen()[0], s = first || sample(), r = OMRDetect.overlaySVG(tpl, dataOf(s), calOf(), { mode: 'test', noAlign });
    if (r.error) { prevBox.append(h('div', { class: 'alert bad', id: 'kod-err' }, r.error)); return; }
    prevBox.innerHTML = r.svg; const svg = prevBox.querySelector('svg'); if (svg) { svg.removeAttribute('width'); svg.removeAttribute('height'); svg.style.width = '100%'; svg.style.height = 'auto'; svg.style.border = '1px solid var(--line)'; }
    const all = (r.warn || []).concat(r.notes || []); notesBox.append(h('div', { class: 'muted' }, `Önizleme: ${first ? first.ad + ' ' + first.soyad : 'örnek öğrenci'} · ${r.spots} dolu baloncuk · kâğıt ${r.paper[0]}×${r.paper[1]} mm`), ...all.map(n => h('div', { class: 'alert info small', style: { margin: '.25rem 0' } }, n)));
  }
  function build(mode) {
    const list = mode === 'test' ? [chosen()[0] || sample()] : chosen(), svgs = [], notes = []; let paper = null;
    for (const s of list) { const r = OMRDetect.overlaySVG(tpl, dataOf(s), calOf(), { mode, noAlign }); if (r.error) { toast(r.error, 'bad'); return null; } svgs.push(r.svg); paper = r.paper; (r.notes || []).forEach(n => notes.push(`${s.ogrNo} ${s.ad} ${s.soyad}: ${n}`)); }
    return { svgs, paper, notes };
  }
  const printBtn = h('button', { class: 'btn primary', id: 'kod-print', disabled: true, onclick: () => { const b = build('fill'); if (!b) return; if (b.notes.length) toast(`${b.notes.length} uyarı: ${b.notes[0]}${b.notes.length > 1 ? ' …' : ''}`, 'warn', 7000); printSheets(b.svgs, b.paper); } }, 'Seçilenler için yazdır');
  const testBtn = h('button', { class: 'btn', id: 'kod-test', onclick: () => { const b = build('test'); if (b) printSheets(b.svgs, b.paper); } }, 'Hizalama sayfasını yazdır');
  const saveCal = async () => {
    Settings.set(calKey, cal);
    try { await api('saveTemplate', { templateId: t.templateId, name: t.name, template: Object.assign({}, tpl, { print: cal }) }); await refreshBase(); toast('Baskı ayarı şablona kaydedildi (tüm cihazlarda geçerli).', 'ok'); }
    catch (e) { toast('Bu cihazda kaydedildi; şablona yazılamadı: ' + e.message, 'warn', 6000); }
  };

  const body = h('div', { class: 'review kod' },
    h('div', null,
      h('div', { class: 'card' }, h('h3', { style: { margin: 0 } }, 'Öğrenciler'), h('div', { class: 'row' }, schPick, clsSel), h('div', { class: 'row', style: { margin: '.4rem 0' } }, stuQ, h('button', { class: 'btn sm', id: 'kod-pick-vis', onclick: () => { visible().forEach(s => picked.add(String(s.ogrNo))); paintStu(); } }, 'Görünenleri seç'), h('button', { class: 'btn sm', id: 'kod-pick-none', onclick: () => { picked.clear(); paintStu(); } }, 'Seçimi temizle'), pickInfo), stuBox),
      h('div', { class: 'card' }, h('h3', { style: { margin: 0 } }, 'Doldurulacak alanlar'), h('div', { class: 'row' }, chk('studentNo', 'Öğrenci no'), chk('schoolCode', 'Kurum kodu'), chk('name', bothName ? 'Ad ve soyad (ayrı bloklar)' : (hasName ? 'Ad soyad (tek blok, arada boş sütun)' : 'Ad–soyad')), chk('booklet', 'Kitapçık')),
        h('div', { class: 'grid' }, fld('Öğrenci no hizası', alignSel), has('booklet') ? fld('Kitapçık', bkSel) : null),
        h('p', { class: 'small muted', style: { margin: '.3rem 0 0' } }, 'Yalnız seçili alanların baloncukları dolu basılır; formun diğer yerleri (sorular, yazılar) basılmaz. Ad ve soyad formda ayrı bloklarsa ayrı, tek blokta ise art arda (ad, boşluk, soyad) kodlanır.')),
      h('div', { class: 'card' }, h('h3', { style: { margin: 0 } }, 'Kâğıt ve milimetrik ayar'),
        h('div', { class: 'grid' }, fld('Kâğıt', paperSel), fld('Tarama çözünürlüğü (dpi)', num('kod-dpi', 'dpi', { min: 0, max: 1200, step: 1 }), '0 = boş form sayfanın tamamı taranmış. Kırpılmış taramada gerçek dpi’yi yazın.')), customBox, frameBox,
        h('div', { class: 'grid', style: { marginTop: '.4rem' } }, fld('Sağa kaydır (mm)', num('kod-dx', 'dx', { step: 0.1, min: -30, max: 30 })), fld('Aşağı kaydır (mm)', num('kod-dy', 'dy', { step: 0.1, min: -30, max: 30 })), fld('Yatay ölçek (%)', num('kod-sx', 'sx', { step: 0.05, min: 90, max: 110 })), fld('Dikey ölçek (%)', num('kod-sy', 'sy', { step: 0.05, min: 90, max: 110 })), fld('Dolu baloncuk boyu (%)', num('kod-dot', 'dot', { step: 1, min: 40, max: 120 }))),
        h('div', { class: 'row', style: { marginTop: '.4rem' } }, h('button', { class: 'btn sm', id: 'kod-reset', onclick: () => { Object.assign(cal, { dx: 0, dy: 0, sx: 100, sy: 100, dot: 86 }); ['dx', 'dy', 'sx', 'sy', 'dot'].forEach(k => { const el = $('#kod-' + k); if (el) el.value = cal[k]; }); preview(); } }, 'Ayarı sıfırla'), h('button', { class: 'btn sm', id: 'kod-savecal', onclick: saveCal }, 'Ayarı şablona kaydet')),
        h('ol', { class: 'small muted', style: { margin: '.5rem 0 0 1rem', padding: 0 } }, h('li', null, 'Önce "Hizalama sayfası"nı düz kâğıda basın (ölçek %100, kenar boşluğu yok).'), h('li', null, 'Kâğıdı gerçek formun üzerine koyup ışığa tutun: kırmızı halkalar form baloncuklarının tam üstüne gelmeli.'), h('li', null, 'Kayma varsa kaydırma (mm) ve ölçek ayarını girin; yeniden basıp deneyin. Tutunca ayarı şablona kaydedin.'), h('li', null, 'Hazır formu yazıcıya aynı yönde (aynı yüz, üst kenar) koyarak "Seçilenler için yazdır" deyin.')))),
    h('div', null, h('div', { class: 'card', style: { position: 'sticky', top: '.5rem' } }, h('h3', { style: { margin: 0 } }, 'Önizleme (kırmızı: baloncuk konumları, siyah: basılacak dolu baloncuklar)'), prevBox, notesBox, h('div', { class: 'row', style: { marginTop: '.5rem' } }, testBtn, printBtn))));
  modal(`Kodlu baskı · ${t.name}`, body, { size: 'wide', noBackdrop: true, buttons: [{ label: 'Kapat' }] });
  // varsayılan okul: kullanıcının okulu varsa
  const mine = S.user && S.user.okulKodu && S.schools.find(s => String(s.okulKodu) === String(S.user.okulKodu)); if (mine) { schSel.value = mine.okulKodu; schSel.dispatchEvent(new Event('change')); } else paintStu();
}
