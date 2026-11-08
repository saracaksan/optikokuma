/* exams.js — sınav tanımı: kapsam, puanlama, cevap anahtarı, şablon */
'use strict';

const SCOPE_LABEL = { genel: 'Genel (tüm okullar)', il: 'İl', ilce: 'İlçe', okul: 'Okul' };
const STATUS = { draft: ['Taslak', ''], open: ['Okutmaya açık', 'ok'], closed: ['Kapalı', 'warn'] };
const PENALTIES = [['0', 'Yanlış doğruyu götürmez'], ['0.25', '4 yanlış 1 doğruyu götürür (¼)'], ['0.3333333333', '3 yanlış 1 doğruyu götürür (⅓)'], ['0.5', '2 yanlış 1 doğruyu götürür (½)']];

function scopeText(e) {
  if (e.scopeType === 'genel') return SCOPE_LABEL.genel;
  if (e.scopeType === 'ilce') return 'İlçe: ' + String(e.scopeValue).replace('|', ' / ');
  if (e.scopeType === 'okul') { const s = schoolByCode(e.scopeValue); return 'Okul: ' + (s ? s.okulAdi : e.scopeValue); }
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
        h('td', null, h('b', null, e.name)), h('td', null, e.date || ''), h('td', null, scopeText(e)), h('td', { class: 'num' }, cfg.total), h('td', null, h('span', { class: 'pill ' + st[1] }, st[0])),
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
    if (u.role !== 'okul') Array.from(new Set(sc.map(s => s.il + '|' + s.ilce))).sort().forEach(k => opts.push(['ilce', k, 'İlçe: ' + k.replace('|', ' / ')]));
    sc.slice().sort((a, b) => a.okulAdi.localeCompare(b.okulAdi, 'tr')).forEach(s => opts.push(['okul', String(s.okulKodu), 'Okul: ' + s.okulAdi + ' (' + s.ilce + ')']));
    return opts;
  }

  function editExam(ex) {
    const isNew = !ex, c0 = ex ? Object.assign({}, ex.config) : { sections: [{ name: 'Genel', count: 40, coef: 1 }], choices: 5, penalty: 0.25, method: 'net', base: 100, max: 500, keys: { A: '' }, booklets: ['A'], showKeys: true };
    const cfg0 = Scoring.normalizeCfg(c0);
    let sections = cfg0.sections.map(s => Object.assign({}, s));
    const keys = Object.assign({}, cfg0.keys); let booklets = (c0.booklets && c0.booklets.length ? c0.booklets : Object.keys(keys).length ? Object.keys(keys) : ['A']).slice();
    const name = h('input', { type: 'text', value: ex ? ex.name : '', placeholder: 'Örn: 8. Sınıf LGS Deneme 3' }), date = h('input', { type: 'date', value: ex ? ex.date : today() });
    const scopes = scopeOptions(), scopeSel = h('select', null, scopes.map((o, i) => h('option', { value: i }, o[2])));
    if (ex) { const i = scopes.findIndex(o => o[0] === ex.scopeType && o[1] === String(ex.scopeValue)); if (i >= 0) scopeSel.value = i; }
    else if (u.role === 'okul' && scopes.length) scopeSel.value = 0;
    if (u.role === 'okul') scopeSel.disabled = true;
    const preset = h('select', { onchange: () => { const p = Scoring.PRESETS[preset.value]; if (!p) return; sections = p.sections.map(s => Object.assign({}, s)); choices.value = p.choices; pen.value = String(p.penalty); methodSel.value = p.method; drawSections(); drawKeys(); drawMethod(); } },
      h('option', { value: '' }, 'Hazır ayar seç…'), Object.entries(Scoring.PRESETS).map(([k, p]) => h('option', { value: k }, p.label)));
    const choices = h('select', null, [3, 4, 5, 6].map(n => h('option', { value: n }, n + ' şık'))); choices.value = cfg0.choices;
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
    const tplSel = h('select', null, h('option', { value: '' }, 'Otomatik (1/sayfa, 8 haneli öğrenci no)'), S.templates.map(t => h('option', { value: t.templateId }, t.name + (t.json && t.json.kind === 'custom' ? ' (harici form)' : ''))));
    tplSel.value = (ex && ex.config.templateId) || '';
    const status = h('select', null, h('option', { value: 'open' }, 'Okutmaya açık'), h('option', { value: 'draft' }, 'Taslak (okutulamaz)'), h('option', { value: 'closed' }, 'Kapalı')); status.value = ex ? ex.status : 'open';
    const showKeys = h('input', { type: 'checkbox', checked: c0.showKeys !== false });
    const err = h('div');
    drawSections(); drawMethod(); drawKeys();
    const body = h('div', null,
      h('div', { class: 'grid' }, h('div', { class: 'field' }, h('label', null, 'Sınav adı'), name), h('div', { class: 'field' }, h('label', null, 'Tarih'), date), h('div', { class: 'field' }, h('label', null, 'Kapsam (hangi okullar katılır)'), scopeSel)),
      h('p', { class: 'small muted' }, 'Aynı sınavı birden çok okul okutur; sonuçlar tek havuzda toplanır ve okullar/ilçeler birbiriyle karşılaştırılır.'),
      h('h3', { style: { marginTop: '1rem' } }, 'Puanlama'), h('div', { class: 'grid' }, h('div', { class: 'field' }, h('label', null, 'Hazır ayar'), preset), h('div', { class: 'field' }, h('label', null, 'Şık sayısı'), choices), h('div', { class: 'field' }, h('label', null, 'Net kuralı'), pen), h('div', { class: 'field' }, h('label', null, 'Puan yöntemi'), methodSel)), methodBox,
      h('h3', { style: { marginTop: '1rem' } }, 'Ders / bölümler ve katsayılar'), secBox,
      h('h3', { style: { marginTop: '1rem' } }, 'Kitapçıklar ve cevap anahtarı'), h('div', { class: 'field', style: { maxWidth: '260px' } }, h('label', null, 'Kitapçık türleri (virgülle)'), bkIn), keyBox,
      h('h3', { style: { marginTop: '1rem' } }, 'Optik form'), h('div', { class: 'grid' }, h('div', { class: 'field' }, h('label', null, 'Okuma şablonu'), tplSel), h('div', { class: 'field' }, h('label', null, 'Durum'), status)),
      h('p', { class: 'small muted' }, '"Otomatik" şablonla basılacak form Formlar sayfasında "Sınavdan doldur" ile üretilir. Farklı bir form (ör. 8’li sığdırma ya da piyasadaki bir optik) kullanacaksanız şablonu Formlar sayfasında oluşturup buradan seçin.'),
      h('label', { class: 'row', style: { marginTop: '.4rem' } }, showKeys, 'Okul kullanıcıları cevap anahtarını görebilsin (okutma sırasında D/Y/B gösterilir)'), err);
    const dlg = modal(isNew ? 'Yeni sınav' : 'Sınavı düzenle', body, { size: 'wide', noBackdrop: true, buttons: [{ label: 'Vazgeç' }, { label: 'Kaydet', cls: 'primary', fn: async () => {
      clear(err); const sc = scopes[+scopeSel.value]; if (!name.value.trim()) { err.append(h('div', { class: 'alert bad' }, 'Sınav adı gerekli.')); return false; }
      if (!sc) { err.append(h('div', { class: 'alert bad' }, 'Kapsam seçin (önce Yönetim → Okullar bölümünden okul ekleyin).')); return false; }
      if (sections.some(s => !s.name.trim())) { err.append(h('div', { class: 'alert bad' }, 'Bölüm adları boş olamaz.')); return false; }
      const config = { sections: sections.map(s => ({ name: s.name.trim(), count: s.count, coef: s.coef })), choices: +choices.value, penalty: parseFloat(pen.value), method: methodSel.value, base: parseFloat(base.value), max: parseFloat(max.value), a: parseFloat(ca.value) || 0, b: parseFloat(cb.value) || 1,
        keys: Object.fromEntries(booklets.map(b => [b, keys[b] || ''])), booklets, templateId: tplSel.value, showKeys: showKeys.checked, stats: cfg0.stats };
      try {
        const r = await api('saveExam', { exam: { examId: ex && ex.examId, name: name.value.trim(), date: date.value, scopeType: sc[0], scopeValue: sc[1], status: status.value, config }, allowIssues: status.value !== 'open' });
        await refreshBase(); draw(); toast('Sınav kaydedildi', 'ok');
        if (r.issues && r.issues.length) toast('Uyarı: ' + r.issues[0], 'bad');
      } catch (e) { err.append(h('div', { class: 'alert bad' }, e.message)); return false; }
    } }] });
  }
  draw();
};
