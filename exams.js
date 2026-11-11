/* exams.js — sınav tanımı: kapsam, puanlama, cevap anahtarı, şablon */
'use strict';

const SCOPE_LABEL = { genel: 'Genel (tüm okullar)', il: 'İl', ilce: 'İlçe', okul: 'Okul' };
const STATUS = { draft: ['Taslak', ''], open: ['Okutmaya açık', 'ok'], closed: ['Kapalı', 'warn'] };
const PENALTIES = [['0', 'Yanlış doğruyu götürmez'], ['0.25', '4 yanlış 1 doğruyu götürür (¼)'], ['0.3333333333', '3 yanlış 1 doğruyu götürür (⅓)'], ['0.5', '2 yanlış 1 doğruyu götürür (½)']];

function scopeText(e) {
  if (e.scopeType === 'genel') return SCOPE_LABEL.genel;
  if (e.scopeType === 'ilce') return 'İlçe: ' + String(e.scopeValue).replace('|', ' / ');
  if (e.scopeType === 'okul') { const s = schoolByCode(e.scopeValue); return (e.personal ? 'Kişisel · ' : 'Okul: ') + (s ? s.okulAdi : e.scopeValue); }
  return 'İl: ' + e.scopeValue;
}

App.views.exams = function (root) {
  const S = App.state, u = S.user, box = h('div');
  root.append(h('div', { class: 'row between' }, h('h1', null, 'Sınavlar'), h('button', { class: 'btn primary', id: 'ex-new', onclick: () => editExam(null) }, '+ Yeni sınav')), box);
  function draw() {
    clear(box); const list = S.exams.slice().sort((a, b) => String(b.date).localeCompare(String(a.date)));
    if (!list.length) { box.append(h('div', { class: 'empty card' }, 'Henüz sınav yok. "Yeni sınav" ile başlayın.')); return; }
    box.append(h('div', { class: 'card' }, h('div', { class: 'tablewrap' }, h('table', null,
      h('thead', null, h('tr', null, ['Sınav', 'Tarih', 'Kapsam', 'Soru', 'Durum', ''].map(t => h('th', null, t)))),
      h('tbody', null, list.map(e => { const cfg = examCfg(e), st = STATUS[e.status] || ['?', '']; return h('tr', null,
        h('td', null, h('b', null, e.name), e.personal && e.owner !== u.username ? h('div', { class: 'small muted' }, 'Öğretmen: ' + (e.ownerName || e.owner)) : null), h('td', null, e.date || ''), h('td', null, scopeText(e)), h('td', { class: 'num' }, cfg.total), h('td', null, h('span', { class: 'pill ' + st[1] }, st[0])),
        h('td', { class: 'right nowrap' }, e.canEdit ? h('span', { class: 'row end' },
          h('button', { class: 'btn sm', onclick: () => editExam(e) }, 'Düzenle'),
          h('button', { class: 'btn sm', onclick: () => setStatus(e, e.status === 'open' ? 'closed' : 'open') }, e.status === 'open' ? 'Kapat' : 'Aç'),
          h('button', { class: 'btn sm danger', onclick: () => delExam(e) }, 'Sil')) : h('span', { class: 'muted small' }, 'yalnız görüntüleme'))); }))))));
  }
  async function setStatus(e, st) {
    try { await api('saveExam', { exam: { examId: e.examId, name: e.name, date: e.date, scopeType: e.scopeType, scopeValue: e.scopeValue, status: st, config: e.config }, allowIssues: st !== 'open' }); await refreshBase(); draw(); toast('Durum güncellendi', 'ok'); } catch (er) { toast(er.message, 'bad'); }
  }
  async function delExam(e) {
    if (!(await confirmBox(`"${e.name}" sınavı ve tüm okutulmuş sonuçları kalıcı olarak silinsin mi?`, 'Sil', true))) return;
    try { await api('deleteExam', { examId: e.examId }); await refreshBase(); draw(); toast('Silindi', 'ok'); } catch (er) { toast(er.message, 'bad'); }
  }

  function scopeOptions() {
    const opts = [], sc = S.schools;
    if (u.role === 'admin') opts.push(['genel', '', SCOPE_LABEL.genel]);
    if (u.role === 'admin' || u.role === 'il') Array.from(new Set(sc.map(s => s.il))).sort().forEach(il => { if (u.role === 'admin' || il === u.il) opts.push(['il', il, 'İl: ' + il]); });
    if (u.role !== 'okul' && u.role !== 'ogretmen') Array.from(new Set(sc.map(s => s.il + '|' + s.ilce))).sort().forEach(k => opts.push(['ilce', k, 'İlçe: ' + k.replace('|', ' / ')]));
    sc.slice().sort((a, b) => a.okulAdi.localeCompare(b.okulAdi, 'tr')).forEach(s => opts.push(['okul', String(s.okulKodu), 'Okul: ' + s.okulAdi + ' (' + s.ilce + ')']));
    return opts;
  }

  function editExam(ex, init) {
    const isNew = !ex, c0 = ex ? Object.assign({}, ex.config) : { sections: [{ name: 'Genel', count: 40, coef: 1 }], choices: 5, penalty: 0.25, method: 'net', base: 100, max: 500, keys: { A: '' }, booklets: ['A'], showKeys: true };
    const cfg0 = Scoring.normalizeCfg(c0);
    let sections = cfg0.sections.map(s => Object.assign({}, s));
    const keys = Object.assign({}, cfg0.keys); let booklets = (c0.booklets && c0.booklets.length ? c0.booklets : Object.keys(keys).length ? Object.keys(keys) : ['A']).slice();
    const name = h('input', { type: 'text', value: ex ? ex.name : '', placeholder: 'Örn: 8. Sınıf LGS Deneme 3' }), date = h('input', { type: 'date', value: ex ? ex.date : today() });
    const scopes = scopeOptions(), scopeSel = h('select', null, scopes.map((o, i) => h('option', { value: i }, o[2])));
    if (ex) { const i = scopes.findIndex(o => o[0] === ex.scopeType && o[1] === String(ex.scopeValue)); if (i >= 0) scopeSel.value = i; }
    else if ((u.role === 'okul' || u.role === 'ogretmen') && scopes.length) scopeSel.value = 0;
    if (u.role === 'okul' || u.role === 'ogretmen' || (ex && ex.personal)) scopeSel.disabled = true;
    const preset = h('select', { onchange: () => { const e = Katalog.byId(preset.value); if (e) applyEntry(e, true); } },
      h('option', { value: '' }, 'Hazır sınav programı seç…'), Katalog.GROUPS.filter(g => g.id !== 'tek').map(g => h('optgroup', { label: g.label }, Katalog.ENTRIES.filter(e => e.group === g.id).map(e => h('option', { value: e.id }, e.name)))));
    function applyEntry(e, setForm) {
      const c = Katalog.examConfig(e); sections = c.sections.map(x => Object.assign({}, x)); choices.value = c.choices;
      { const m = PENALTIES.find(p => Math.abs(parseFloat(p[0]) - c.penalty) < 1e-6); if (m) pen.value = m[0]; }
      methodSel.value = c.method; base.value = c.base; max.value = c.max; booklets = c.booklets.slice(); bkIn.value = booklets.join(',');
      if (setForm) { tplSel.value = 'std:' + e.id; stdNup.value = (init && init.nup) || 1; drawStd(); }
      drawSections(); drawKeys(); drawMethod();
    }
    const choices = h('select', null, [2, 3, 4, 5, 6].map(n => h('option', { value: n }, n + ' şık'))); choices.value = cfg0.choices;
    const pen = h('select', null, PENALTIES.map(([v, l]) => h('option', { value: v }, l)));
    { const cur = cfg0.penalty, m = PENALTIES.find(p => Math.abs(parseFloat(p[0]) - cur) < 1e-6); if (m) pen.value = m[0]; else { pen.append(h('option', { value: String(cur) }, `Özel (${cur})`)); pen.value = String(cur); } }
    const methodSel = h('select', { onchange: drawMethod }, h('option', { value: 'net' }, 'Ağırlıklı net → 100 üzerinden puan'), h('option', { value: 'std500' }, 'Standart puan → 100–500 (LGS/YKS tarzı)'), h('option', { value: 'stdw' }, 'Ortalama standart puan (a + b·ort.)')); methodSel.value = cfg0.method;
    const base = h('input', { type: 'number', value: cfg0.base, step: 'any' }), max = h('input', { type: 'number', value: cfg0.max, step: 'any' }), ca = h('input', { type: 'number', value: cfg0.a, step: 'any' }), cb = h('input', { type: 'number', value: cfg0.b, step: 'any' });
    const methodBox = h('div'); function drawMethod() { clear(methodBox); if (methodSel.value === 'std500') methodBox.append(h('div', { class: 'grid' }, h('div', { class: 'field' }, h('label', null, 'En düşük puan'), base), h('div', { class: 'field' }, h('label', null, 'En yüksek puan'), max))); else if (methodSel.value === 'stdw') methodBox.append(h('div', { class: 'grid' }, h('div', { class: 'field' }, h('label', null, 'a (sabit)'), ca), h('div', { class: 'field' }, h('label', null, 'b (çarpan)'), cb))); }
    const secBox = h('div'), total = h('span', { class: 'chip' });
    function drawSections() {
      clear(secBox); const tbl = h('table', null, h('thead', null, h('tr', null, ['Bölüm / ders', 'Soru sayısı', 'Katsayı', ''].map(t => h('th', null, t)))), h('tbody', null, sections.map((s, i) => h('tr', null,
        h('td', null, h('input', { type: 'text', value: s.name, oninput: e => { s.name = e.target.value; drawKeys(); } })), h('td', { style: { width: '110px' } }, h('input', { type: 'number', min: 1, value: s.count, oninput: e => { s.count = Math.max(1, parseInt(e.target.value) || 1); updTotal(); drawKeys(); } })),
        h('td', { style: { width: '110px' } }, h('input', { type: 'number', step: 'any', value: s.coef, oninput: e => { s.coef = parseFloat(String(e.target.value).replace(',', '.')) || 0; } })), h('td', null, sections.length > 1 ? h('button', { class: 'btn sm ghost', onclick: () => { sections.splice(i, 1); drawSections(); drawKeys(); } }, '✕') : null)))));
      secBox.append(h('div', { class: 'tablewrap', style: { maxHeight: 'none' } }, tbl), h('div', { class: 'row', style: { marginTop: '.5rem' } }, h('button', { class: 'btn sm', onclick: () => { sections.push({ name: 'Yeni ders', count: 10, coef: 1 }); drawSections(); drawKeys(); } }, '+ Bölüm ekle'), total)); updTotal();
    }
    const totalN = () => sections.reduce((a, s) => a + (s.count || 0), 0);
    function updTotal() { total.textContent = `Toplam ${totalN()} soru`; }
    const bkIn = h('input', { type: 'text', value: booklets.join(','), placeholder: 'A,B', oninput: e => { booklets = Array.from(new Set(e.target.value.toUpperCase().split(/[^A-Z]+/).filter(Boolean))).slice(0, 6); if (!booklets.length) booklets = ['A']; drawKeys(); } });
    const keyBox = h('div');
    function normKey(t) { return String(t || '').toUpperCase().replace(/[^A-H*.]/g, ''); }   // boşluk, satır sonu, virgül vb. temizlenir
    function drawKeys() {
      clear(keyBox); let q = 1; const parts = sections.map(s => { const t = `${s.name}: ${q}–${q + s.count - 1}`; q += s.count; return t; });
      keyBox.append(h('div', { class: 'small muted' }, 'Bölümler: ' + parts.join(' · ')));
      booklets.forEach(b => {
        const info = h('span', { class: 'small' }), ta = h('textarea', { rows: 3, spellcheck: 'false', placeholder: 'Örn: ABCDABCD… (Excel\'den kopyalanan sütun da olur). İptal soru için *' }, keys[b] || '');
        const upd = () => { const k = normKey(ta.value); keys[b] = k; const n = totalN(), bad = k.length !== n; info.textContent = `${k.length} / ${n} karakter` + (bad ? (k.length < n ? ' — eksik' : ' — fazla') : ' ✓'); info.style.color = bad ? 'var(--bad)' : 'var(--ok)'; };
        ta.addEventListener('input', upd); ta.addEventListener('blur', () => { ta.value = normKey(ta.value); upd(); }); upd();
        keyBox.append(h('div', { class: 'field', style: { marginTop: '.6rem' } }, h('label', null, `Kitapçık ${b} cevap anahtarı `, info), ta));
      });
    }
    const curId = (ex && ex.config.templateId) || '', curStd = Katalog.parseStd(curId);
    const stdEntries = Katalog.ENTRIES.slice(); if (curStd && !stdEntries.find(e => e.id === curStd.entry.id)) stdEntries.push(curStd.entry);
    const tplSel = h('select', { onchange: () => drawStd() }, h('option', { value: '' }, 'Otomatik (1/sayfa, 8 haneli öğrenci no)'),
      S.templates.length ? h('optgroup', { label: 'Kayıtlı şablonlarım' }, S.templates.map(t => h('option', { value: t.templateId }, t.name + (t.json && t.json.kind === 'custom' ? ' (harici form)' : '')))) : null,
      Katalog.GROUPS.map(g => h('optgroup', { label: 'Hazır form · ' + g.label }, stdEntries.filter(e => e.group === g.id).map(e => h('option', { value: 'std:' + e.id }, e.name)))));
    const stdNup = h('select', { onchange: () => drawStd() }, [1, 2, 4, 6, 8].map(n => h('option', { value: n }, NUP_LABELS[n]))), stdD = h('select', null, [0, 4, 5, 6, 7, 8, 9, 10, 12].map(n => h('option', { value: n }, n ? `${n} haneli öğrenci no` : 'Öğrenci no yok'))), stdSd = h('select', null, [0, 3, 4, 5, 6, 7, 8, 9, 10].map(n => h('option', { value: n }, n ? `${n} haneli kurum kodu` : 'Kurum kodu yok'))), stdBox = h('div', { class: 'grid' }, h('div', { class: 'field' }, h('label', null, 'Sayfaya sığdırma'), stdNup), h('div', { class: 'field' }, h('label', null, 'Öğrenci no'), stdD), h('div', { class: 'field' }, h('label', null, 'Kurum kodu'), stdSd)), stdInfo = h('div', { class: 'small muted' });
    stdD.value = 8; stdSd.value = 0;
    if (curStd) { tplSel.value = 'std:' + curStd.entry.id; stdNup.value = curStd.nup; stdD.value = curStd.d; stdSd.value = curStd.sd; } else tplSel.value = curId;
    function drawStd() {
      const on = tplSel.value.startsWith('std:'); stdBox.style.display = on ? '' : 'none'; clear(stdInfo);
      if (on) { const e = Katalog.byId(tplSel.value.slice(4)); if (e) { const r = tryBuild(Katalog.formOpts(e, { nup: +stdNup.value, digits: +stdD.value, schoolDigits: +stdSd.value })); stdInfo.append(r.error ? h('span', { style: { color: 'var(--bad)' } }, r.error) : `Form: ${Katalog.total(e)} soru · ders ders sütunlar, numaralar her derste 1’den başlar · form kimliği ${r.tpl.formCodeHex}`); } }
    }
    stdD.addEventListener('change', drawStd); stdSd.addEventListener('change', drawStd);
    const status = h('select', null, h('option', { value: 'open' }, 'Okutmaya açık'), h('option', { value: 'draft' }, 'Taslak (okutulamaz)'), h('option', { value: 'closed' }, 'Kapalı')); status.value = ex ? ex.status : 'open';
    const showKeys = h('input', { type: 'checkbox', checked: c0.showKeys !== false }), veli = h('input', { type: 'checkbox', checked: c0.veli === true, id: 'ex-veli' });
    const err = h('div');
    drawSections(); drawMethod(); drawKeys(); drawStd();
    if (init && init.entryId) { const e = Katalog.byId(init.entryId); if (e) { preset.value = e.group !== 'tek' ? e.id : ''; applyEntry(e, true); if (init.nup) stdNup.value = init.nup; if (init.d != null) stdD.value = init.d; stdSd.value = init.sd || 0; drawStd(); } }
    const body = h('div', null,
      h('div', { class: 'grid' }, h('div', { class: 'field' }, h('label', null, 'Sınav adı'), name), h('div', { class: 'field' }, h('label', null, 'Tarih'), date), h('div', { class: 'field' }, h('label', null, 'Kapsam (hangi okullar katılır)'), scopeSel)),
      u.role === 'ogretmen' ? h('p', { class: 'small muted' }, 'Bu sınav kişiseldir: yalnızca siz ve okul yöneticiniz görür; aynı okuldaki diğer öğretmenler ve ilçe/il yetkilileri göremez.') : h('p', { class: 'small muted' }, 'Aynı sınavı birden çok okul okutur; sonuçlar tek havuzda toplanır ve okullar/ilçeler birbiriyle karşılaştırılır.'),
      h('h3', { style: { marginTop: '1rem' } }, 'Puanlama'), h('div', { class: 'grid' }, h('div', { class: 'field' }, h('label', null, 'Hazır ayar'), preset), h('div', { class: 'field' }, h('label', null, 'Şık sayısı'), choices), h('div', { class: 'field' }, h('label', null, 'Net kuralı'), pen), h('div', { class: 'field' }, h('label', null, 'Puan yöntemi'), methodSel)), methodBox,
      h('h3', { style: { marginTop: '1rem' } }, 'Ders / bölümler ve katsayılar'), secBox,
      h('h3', { style: { marginTop: '1rem' } }, 'Kitapçıklar ve cevap anahtarı'), h('div', { class: 'field', style: { maxWidth: '260px' } }, h('label', null, 'Kitapçık türleri (virgülle)'), bkIn), keyBox,
      h('h3', { style: { marginTop: '1rem' } }, 'Optik form'), h('div', { class: 'grid' }, h('div', { class: 'field' }, h('label', null, 'Optik form (okuma şablonu)'), tplSel), h('div', { class: 'field' }, h('label', null, 'Durum'), status)), stdBox, stdInfo,
      h('p', { class: 'small muted' }, 'Hazır formu Formlar → Hazır şablonlar sayfasından yazdırın; okutma aynı formu otomatik tanır. Kendi formunuzu Formlar → Tasarla bölümünde oluşturup kaydederseniz burada "Kayıtlı şablonlarım" altında seçersiniz.'),
      h('label', { class: 'row', style: { marginTop: '.4rem' } }, showKeys, 'Okul kullanıcıları cevap anahtarını görebilsin (okutma sırasında D/Y/B gösterilir)'),
      h('label', { class: 'row', style: { marginTop: '.4rem' } }, veli, 'Sonuçlar öğrenci/veli sorgulamasına açık olsun (okul + sınıf + okul numarasıyla; taslak sınavlar hariç). Kapalıyken öğrenciler hiçbir şey göremez.'), err);
    const dlg = modal(isNew ? 'Yeni sınav' : 'Sınavı düzenle', body, { size: 'wide', noBackdrop: true, buttons: [{ label: 'Vazgeç' }, { label: 'Kaydet', cls: 'primary', fn: async () => {
      clear(err); const sc = scopes[+scopeSel.value]; if (!name.value.trim()) { err.append(h('div', { class: 'alert bad' }, 'Sınav adı gerekli.')); return false; }
      if (!sc) { err.append(h('div', { class: 'alert bad' }, 'Kapsam seçin (önce Yönetim → Okullar bölümünden okul ekleyin).')); return false; }
      if (sections.some(s => !s.name.trim())) { err.append(h('div', { class: 'alert bad' }, 'Bölüm adları boş olamaz.')); return false; }
      let templateId = tplSel.value;
      if (templateId.startsWith('std:')) {
        const e = Katalog.byId(templateId.slice(4)), r = e && tryBuild(Katalog.formOpts(e, { nup: +stdNup.value, digits: +stdD.value, schoolDigits: +stdSd.value }));
        if (!e || r.error) { err.append(h('div', { class: 'alert bad' }, 'Seçilen hazır form bu ayarlarla sığmıyor: ' + ((r && r.error) || ''))); return false; }
        if (Katalog.total(e) !== totalN()) { err.append(h('div', { class: 'alert bad' }, `Seçilen hazır form ${Katalog.total(e)} soruluk, sınavınızda ${totalN()} soru var. Soru sayılarını eşitleyin ya da başka form seçin.`)); return false; }
        const miss = booklets.filter(b => !e.booklets.includes(b)); if (miss.length) { err.append(h('div', { class: 'alert bad' }, `Bu hazır formda kitapçık ${miss.join(', ')} yok (formdaki: ${e.booklets.join(', ')}). Kitapçık türlerini düzeltin ya da "Formlar → Tasarla"dan kendi formunuzu kaydedin.`)); return false; }
        templateId = Katalog.stdId(e.id, +stdNup.value, { sd: +stdSd.value, d: +stdD.value });
      } else if (templateId) {
        const t = S.templates.find(x => x.templateId === templateId);
        if (t && t.json && t.json.kind === 'generated' && t.json.opts && t.json.opts.questions !== totalN()) { err.append(h('div', { class: 'alert bad' }, `Seçilen şablon ${t.json.opts.questions} soruluk, sınavınızda ${totalN()} soru var.`)); return false; }
      }
      const config = { sections: sections.map(s => ({ name: s.name.trim(), count: s.count, coef: s.coef })), choices: +choices.value, penalty: parseFloat(pen.value), method: methodSel.value, base: parseFloat(base.value), max: parseFloat(max.value), a: parseFloat(ca.value) || 0, b: parseFloat(cb.value) || 1,
        keys: Object.fromEntries(booklets.map(b => [b, keys[b] || ''])), booklets, templateId, showKeys: showKeys.checked, veli: veli.checked, stats: cfg0.stats };
      try {
        const r = await api('saveExam', { exam: { examId: ex && ex.examId, name: name.value.trim(), date: date.value, scopeType: sc[0], scopeValue: sc[1], status: status.value, config }, allowIssues: status.value !== 'open' });
        await refreshBase(); draw(); toast('Sınav kaydedildi', 'ok');
        if (r.issues && r.issues.length) toast('Uyarı: ' + r.issues[0], 'bad');
      } catch (e) { err.append(h('div', { class: 'alert bad' }, e.message)); return false; }
    } }] });
  }
  draw();
  if (App.newExam) { const n = App.newExam; App.newExam = null; editExam(null, n); }
};
