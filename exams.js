/* exams.js — sınav tanımı: kapsam, puanlama, cevap anahtarı, şablon */
'use strict';

const SCOPE_LABEL = { genel: 'Genel (tüm okullar)', il: 'İl', ilce: 'İlçe', okul: 'Okul', okullar: 'Seçili okullar (çoklu)' };
const STATUS = { draft: ['Taslak', ''], open: ['Okutmaya açık', 'ok'], closed: ['Kapalı', 'warn'] };
const PENALTIES = [['0', 'Yanlış doğruyu götürmez'], ['0.25', '4 yanlış 1 doğruyu götürür (¼)'], ['0.3333333333', '3 yanlış 1 doğruyu götürür (⅓)'], ['0.5', '2 yanlış 1 doğruyu götürür (½)']];

function scopeText(e) {
  if (e.scopeType === 'genel') return SCOPE_LABEL.genel;
  if (e.scopeType === 'ilce') return 'İlçe: ' + String(e.scopeValue).replace('|', ' / ');
  if (e.scopeType === 'okul') { const s = schoolByCode(e.scopeValue); return (e.personal ? 'Kişisel · ' : 'Okul: ') + (s ? s.okulAdi : e.scopeValue); }
  if (e.scopeType === 'okullar') {
    const codes = String(e.scopeValue || '').split(',').map(x => x.trim()).filter(Boolean);
    const names = codes.map(c => { const s = schoolByCode(c); return s ? s.okulAdi : c; });
    const head = names.slice(0, 2).join(', ') + (names.length > 2 ? ` … (+${names.length - 2})` : '');
    return `Seçili okullar (${codes.length}): ${head}`;
  }
  return 'İl: ' + e.scopeValue;
}

App.views.exams = function (root) {
  const S = App.state, u = S.user, box = h('div');
  root.append(h('div', { class: 'row between' }, h('h1', null, 'Sınavlar'), h('button', { class: 'btn primary', id: 'ex-new', onclick: () => editExam(null) }, '+ Yeni sınav')), box);
  function draw() {
    clear(box); const list = S.exams.slice().sort((a, b) => String(b.date).localeCompare(String(a.date)));
    if (!list.length) { box.append(h('div', { class: 'empty card' }, 'Henüz sınav yok. "Yeni sınav" ile başlayın.')); return; }
    box.append(h('div', { class: 'card' }, h('div', { class: 'tablewrap' }, h('table', { class: 'zebra-tbl' },
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
    if (u.role !== 'okul' && u.role !== 'ogretmen' && sc.length > 1) opts.push(['okullar', '', 'Seçili okullar (çoklu tikleme)']);
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
    const name = h('input', { type: 'text', id: 'ex-name', value: ex ? ex.name : '', placeholder: 'Örn: 8. Sınıf LGS Deneme 3' }), date = h('input', { type: 'date', value: ex ? ex.date : today() });
    const scopes = scopeOptions(), scopeSel = h('select', null, scopes.map((o, i) => h('option', { value: i }, o[2])));
    const pickedSchools = new Set(ex && ex.scopeType === 'okullar' ? String(ex.scopeValue || '').split(',').map(x => x.trim()).filter(Boolean) : []);
    if (ex) {
      const i = ex.scopeType === 'okullar'
        ? scopes.findIndex(o => o[0] === 'okullar')
        : scopes.findIndex(o => o[0] === ex.scopeType && o[1] === String(ex.scopeValue));
      if (i >= 0) scopeSel.value = i;
    } else if ((u.role === 'okul' || u.role === 'ogretmen') && scopes.length) scopeSel.value = 0;
    if (u.role === 'okul' || u.role === 'ogretmen' || (ex && ex.personal)) scopeSel.disabled = true;
    // Çoklu okul tikleme kutusu (yönetici / il / ilçe modunda 2, 5, 10 veya istenen sayıda okul seçimi)
    const msBox = h('div', { class: 'multi-school-box hidden', id: 'ex-multi-schools' });
    let msVisibleRows = S.schools.slice();
    function drawMultiSchools() {
      const o = scopes[+scopeSel.value];
      const isMulti = !scopeSel.disabled && o && o[0] === 'okullar';
      msBox.classList.toggle('hidden', !isMulti);
      if (!isMulti) return;
      clear(msBox);
      const cnt = h('span', { class: 'small' }, h('b', null, `Seçili: ${pickedSchools.size} okul`), ' (üstteki il / ilçe / arama süzgecini kullanarak istediğiniz kadar okul tikleyebilirsiniz)');
      const head = h('div', { class: 'ms-head' }, cnt, h('div', { class: 'row' },
        h('button', { type: 'button', class: 'btn sm', onclick: () => { msVisibleRows.forEach(s => pickedSchools.add(String(s.okulKodu))); drawMultiSchools(); } }, 'Görünenleri seç'),
        h('button', { type: 'button', class: 'btn sm ghost', onclick: () => { pickedSchools.clear(); drawMultiSchools(); } }, 'Temizle')));
      const listEl = h('div', { class: 'ms-list' });
      const ordered = msVisibleRows.slice().sort((a, b) => a.okulAdi.localeCompare(b.okulAdi, 'tr'));
      if (!ordered.length) {
        listEl.append(h('div', { class: 'small muted', style: { padding: '.4rem' } }, 'Bu süzgece uyan okul yok.'));
      } else {
        ordered.forEach(s => {
          const code = String(s.okulKodu), on = pickedSchools.has(code);
          const ck = h('input', { type: 'checkbox', checked: on, onchange: () => {
            if (ck.checked) pickedSchools.add(code); else pickedSchools.delete(code);
            lbl.classList.toggle('on', ck.checked);
            cnt.firstChild.textContent = `Seçili: ${pickedSchools.size} okul`;
          } });
          const lbl = h('label', { class: 'ms-item' + (on ? ' on' : '') }, ck, h('span', null, `${s.okulAdi} `, h('span', { class: 'small muted' }, `(${s.ilce})`)));
          listEl.append(lbl);
        });
      }
      msBox.append(head, listEl);
    }
    // Kapsam: il / ilçe / düzey süzgeçleri ortak seçimle gelir (diğer ekranlarla aynı); yeni sınavda kapsam seçili okul → ilçe → il'e göre başlar
    let scopeBox = scopeSel;
    if (!scopeSel.disabled && S.schools.length > 1) {
      const hint = h('div', { class: 'small muted', id: 'ex-scope-hint' });
      const g = Sel.v; let want = -1;
      if (!ex) { if (g.okul) want = scopes.findIndex(o => o[0] === 'okul' && o[1] === g.okul); if (want < 0 && g.ilce) want = scopes.findIndex(o => o[0] === 'ilce' && (g.il ? o[1] === g.il + '|' + g.ilce : o[1].split('|')[1] === g.ilce)); if (want < 0 && g.il) want = scopes.findIndex(o => o[0] === 'il' && o[1] === g.il); }
      if (want >= 0) { scopeSel.value = want; hint.textContent = 'Kapsam, seçili ' + scopes[want][2].replace(/^(Okul|İlçe|İl): /, m => m.toLowerCase()) + ' olarak ayarlandı; değiştirmek için listeden başka kapsam seçin.'; }
      const fillScope = rows => {
        msVisibleRows = rows.slice();
        const cur = scopeSel.value, codes = new Set(rows.map(s => String(s.okulKodu))), ils = new Set(rows.map(s => s.il)), ilces = new Set(rows.map(s => s.il + '|' + s.ilce));
        clear(scopeSel).append(scopes.map((o, i) => [i, o]).filter(([, o]) => o[0] === 'genel' || o[0] === 'okullar' || (o[0] === 'il' && ils.has(o[1])) || (o[0] === 'ilce' && ilces.has(o[1])) || (o[0] === 'okul' && codes.has(o[1]))).map(([i, o]) => h('option', { value: i }, o[2])));
        scopeSel.value = cur; if (scopeSel.value !== cur) scopeSel.selectedIndex = 0;
        drawMultiSchools();
      };
      const bar = schoolFilterBar(S.schools, fillScope, { keep: want >= 0 && scopes[want][0] === 'okul' ? scopes[want][1] : '' });
      if (want >= 0) scopeSel.value = want;
      scopeSel.addEventListener('change', () => { const o = scopes[+scopeSel.value]; hint.textContent = ''; if (o && o[0] === 'okul') Sel.set({ okul: o[1] }); drawMultiSchools(); });
      drawMultiSchools();
      scopeBox = h('div', { class: 'sp' }, bar.any ? bar.el : null, scopeSel, hint);
    }
    const SC_PRESETS = ['lgs_dershane', 'iokbs'].filter(k => Scoring.PRESETS && Scoring.PRESETS[k]);
    function applyScoringPreset(key) {
      const p = Scoring.PRESETS && Scoring.PRESETS[key]; if (!p) return;
      setSections(p.sections.map(x => Object.assign({}, x)));
      choices.value = p.choices;
      { const m = PENALTIES.find(x => Math.abs(parseFloat(x[0]) - p.penalty) < 1e-6); if (m) pen.value = m[0]; }
      methodSel.value = p.method; base.value = p.base != null ? p.base : 100; max.value = p.max != null ? p.max : 500;
      booklets = ['A', 'B']; bkIn.value = booklets.join(',');
      drawSections(); drawKeys(); drawMethod();
    }
    const preset = h('select', { onchange: () => {
      if (preset.value.startsWith('sc:')) { applyScoringPreset(preset.value.slice(3)); return; }
      const e = Katalog.byId(preset.value); if (e) applyEntry(e, true);
    } },
      h('option', { value: '' }, 'Hazır sınav programı seç…'),
      SC_PRESETS.length ? h('optgroup', { label: 'Dershane / Sabit Katsayılı (LGS · Bursluluk)' }, SC_PRESETS.map(k => h('option', { value: 'sc:' + k }, Scoring.PRESETS[k].label))) : null,
      Katalog.GROUPS.filter(g => g.id !== 'tek').map(g => h('optgroup', { label: g.label }, Katalog.ENTRIES.filter(e => e.group === g.id).map(e => h('option', { value: e.id }, e.name)))));
    function applyEntry(e, setForm) {
      const c = Katalog.examConfig(e); setSections(c.sections.map(x => Object.assign({}, x))); choices.value = c.choices;
      { const m = PENALTIES.find(p => Math.abs(parseFloat(p[0]) - c.penalty) < 1e-6); if (m) pen.value = m[0]; }
      methodSel.value = c.method; base.value = c.base; max.value = c.max; booklets = c.booklets.slice(); bkIn.value = booklets.join(',');
      if (setForm) { tplSel.value = 'std:' + e.id; stdNup.value = (init && init.nup) || 1; drawStd(); }
      drawSections(); drawKeys(); drawMethod();
    }
    const choices = h('select', null, [2, 3, 4, 5, 6].map(n => h('option', { value: n }, n + ' şık'))); choices.value = cfg0.choices;
    const pen = h('select', null, PENALTIES.map(([v, l]) => h('option', { value: v }, l)));
    { const cur = cfg0.penalty, m = PENALTIES.find(p => Math.abs(parseFloat(p[0]) - cur) < 1e-6); if (m) pen.value = m[0]; else { pen.append(h('option', { value: String(cur) }, `Özel (${cur})`)); pen.value = String(cur); } }
    const methodSel = h('select', { onchange: drawMethod },
      h('option', { value: 'coef500' }, 'Sabit taban + ders katsayısı (Dershane LGS / Bursluluk)'),
      h('option', { value: 'std500' }, 'Standart puan → 100–500 (LGS/YKS tarzı)'),
      h('option', { value: 'net' }, 'Ağırlıklı net → 100 üzerinden puan'),
      h('option', { value: 'stdw' }, 'Ortalama standart puan (a + b·ort.)')); methodSel.value = cfg0.method;
    const base = h('input', { type: 'number', value: cfg0.base, step: 'any' }), max = h('input', { type: 'number', value: cfg0.max, step: 'any' }), ca = h('input', { type: 'number', value: cfg0.a, step: 'any' }), cb = h('input', { type: 'number', value: cfg0.b, step: 'any' });
    const methodBox = h('div');
    function drawMethod() {
      clear(methodBox);
      if (methodSel.value === 'coef500') {
        methodBox.append(
          h('div', { class: 'grid' }, h('div', { class: 'field' }, h('label', null, 'Taban puan (0 net puanı)'), base), h('div', { class: 'field' }, h('label', null, 'Tavan puan (tam net)'), max)),
          h('p', { class: 'small muted', style: { margin: '.3rem 0 0' } }, 'Formül: Puan = Taban + Σ(Ders Neti × Katsayı). Aşağıdaki tablodan her dersin katsayısını ve taban puanı dilediğiniz gibi değiştirebilirsiniz; tüm sorular tam yapılmadıkça tavan (500) puan verilmez.'));
      } else if (methodSel.value === 'std500') {
        methodBox.append(h('div', { class: 'grid' }, h('div', { class: 'field' }, h('label', null, 'En düşük puan'), base), h('div', { class: 'field' }, h('label', null, 'En yüksek puan'), max)));
      } else if (methodSel.value === 'stdw') {
        methodBox.append(h('div', { class: 'grid' }, h('div', { class: 'field' }, h('label', null, 'a (sabit)'), ca), h('div', { class: 'field' }, h('label', null, 'b (çarpan)'), cb)));
      }
    }
    const secBox = h('div'), total = h('span', { class: 'chip' });
    function drawSections() {
      clear(secBox); const tbl = h('table', null, h('thead', null, h('tr', null, ['Bölüm / ders', 'Soru sayısı', 'Katsayı', ''].map(t => h('th', null, t)))), h('tbody', null, sections.map((s, i) => h('tr', null,
        h('td', null, h('input', { type: 'text', value: s.name, 'data-sec': i, oninput: e => { s.name = e.target.value; drawKeys(); refreshMap(); } })), h('td', { style: { width: '110px' } }, h('input', { type: 'number', min: 1, value: s.count, 'data-cnt': i, oninput: e => { s.count = Math.max(1, parseInt(e.target.value) || 1); updTotal(); drawKeys(); refreshMap(); } })),
        h('td', { style: { width: '110px' } }, h('input', { type: 'number', step: 'any', value: s.coef, oninput: e => { s.coef = parseFloat(String(e.target.value).replace(',', '.')) || 0; } })), h('td', null, sections.length > 1 ? h('button', { class: 'btn sm ghost', onclick: () => { sections.splice(i, 1); drawSections(); drawKeys(); drawStd(); } }, '✕') : null)))));
      secBox.append(h('div', { class: 'tablewrap', style: { maxHeight: 'none' } }, tbl), h('div', { class: 'row', style: { marginTop: '.5rem' } }, h('button', { class: 'btn sm', onclick: () => { sections.push({ name: 'Yeni ders', count: 10, coef: 1 }); drawSections(); drawKeys(); drawStd(); } }, '+ Bölüm ekle'), total)); updTotal();
    }
    const totalN = () => sections.reduce((a, s) => a + (s.count || 0), 0);
    function updTotal() { total.textContent = `Toplam ${totalN()} soru`; }
    const bkIn = h('input', { type: 'text', id: 'ex-booklets', value: booklets.join(','), placeholder: 'A,B', oninput: e => { booklets = Array.from(new Set(e.target.value.toUpperCase().split(/[^A-Z]+/).filter(Boolean))).slice(0, 6); if (!booklets.length) booklets = ['A']; drawKeys(); } });
    const keyBox = h('div');
    function normKey(t) { return String(t || '').toUpperCase().replace(/[^A-H*.]/g, ''); }   // boşluk, satır sonu, virgül vb. temizlenir
    /* Cevap anahtarı DERS DERS tutulur (her bölümün kendi kutusu); kaydederken kitapçık başına tek diziye birleştirilir. */
    function sliceKeys(flat) { let q = 0; sections.forEach(s => { s._k = s._k || {}; Object.keys(flat).forEach(b => { s._k[b] = String(flat[b] || '').slice(q, q + s.count); }); q += s.count; }); }
    const flatKeys = () => { const o = {}; booklets.forEach(b => { o[b] = sections.map(s => (s._k && s._k[b]) || '').join(''); }); return o; };
    function setSections(next) { const flat = flatKeys(); sections = next; sections.forEach(s => { s._k = {}; }); sliceKeys(flat); }
    sliceKeys(keys);
    { const fm = Array.isArray(c0.formMap) ? c0.formMap : []; sections.forEach((s, i) => { const m = fm[i]; if (m && m.l >= 0) s._l = m.l | 0; if (m && (m.s | 0) > 0) s._s = (m.s | 0) + 1; }); }
    const keyOf = (s, b) => normKey(s._k && s._k[b]);
    function keyProblems() {
      const out = [], ok = 'ABCDEFGH'.slice(0, +choices.value || 5) + '*.';
      booklets.forEach(b => sections.forEach(s => { const k = keyOf(s, b); if (k.length !== s.count) out.push(`${s.name || 'Bölüm'} (kitapçık ${b}): ${k.length}/${s.count} karakter`); else for (let i = 0; i < k.length; i++) if (ok.indexOf(k[i]) < 0) { out.push(`${s.name || 'Bölüm'} (kitapçık ${b}) ${i + 1}. soru: "${k[i]}" geçersiz`); break; } }));
      return out;
    }
    function drawKeys() {
      clear(keyBox); sections.forEach(s => { s._k = s._k || {}; });
      keyBox.append(h('div', { class: 'small muted' }, 'Cevap anahtarını her dersin kendi kutusuna girin (örn. ABCDABCDAB). İptal soru için *, tanımsız için nokta kullanılır. Derslerin soru sayısı formdaki soru sayısıyla aynı olmak zorunda değildir.'));
      booklets.forEach(b => {
        const rows = [], infos = [];
        sections.forEach((s, i) => {
          const info = h('span', { class: 'keyinfo small' }), inp = h('input', { type: 'text', class: 'keyin', spellcheck: 'false', autocomplete: 'off', id: `ex-key-${b}-${i}`, 'data-b': b, 'data-i': i, placeholder: `${s.count} karakter`, value: keyOf(s, b) });
          const upd = () => { const k = keyOf(s, b), bad = k.length !== s.count; info.textContent = `${k.length}/${s.count}` + (bad ? (k.length < s.count ? ' eksik' : ' fazla') : ' ✓'); info.style.color = bad ? 'var(--bad)' : 'var(--ok)'; };
          inp.addEventListener('input', () => { s._k[b] = inp.value.toUpperCase(); upd(); }); inp.addEventListener('blur', () => { inp.value = s._k[b] = keyOf(s, b); upd(); }); upd(); infos.push({ inp, upd });
          rows.push(h('div', { class: 'keyrow' }, h('label', { for: inp.id }, h('b', null, s.name || `Bölüm ${i + 1}`), h('span', { class: 'small muted' }, ` · ${s.count} soru`)), inp, info));
        });
        const all = h('textarea', { rows: 2, spellcheck: 'false', id: `ex-keyall-${b}`, placeholder: 'Tüm anahtarı tek seferde yapıştırın: art arda harfler (dersler sırayla bölünür) ya da her ders ayrı satırda.' });
        all.addEventListener('input', () => {
          const lines = String(all.value).split(/\r?\n/).filter(l => l.trim()); let parts;
          if (lines.length === sections.length && lines.length > 1) parts = lines.map(normKey); else { const flat = normKey(all.value); let q = 0; parts = sections.map(s => { const t = flat.slice(q, q + s.count); q += s.count; return t; }); }
          sections.forEach((s, i) => { s._k[b] = parts[i] || ''; infos[i].inp.value = s._k[b]; infos[i].upd(); });
        });
        keyBox.append(h('div', { class: 'keycard' }, h('div', { class: 'keyhead' }, h('b', null, `Kitapçık ${b} cevap anahtarı`)), ...rows, h('details', { class: 'keyall' }, h('summary', { class: 'small' }, 'Hepsini tek seferde yapıştır'), all)));
      });
    }
    const curId = (ex && ex.config.templateId) || '', curStd = Katalog.parseStd(curId);
    const stdEntries = Katalog.ENTRIES.slice(); if (curStd && !stdEntries.find(e => e.id === curStd.entry.id)) stdEntries.push(curStd.entry);
    const tplSel = h('select', { id: 'ex-tpl', onchange: () => drawStd() }, h('option', { value: '' }, 'Otomatik (1/sayfa, 8 haneli öğrenci no)'),
      S.templates.length ? h('optgroup', { label: 'Kayıtlı şablonlarım' }, S.templates.map(t => h('option', { value: t.templateId }, t.name + (t.json && t.json.kind === 'custom' ? ' (harici form)' : '')))) : null,
      Katalog.GROUPS.map(g => h('optgroup', { label: 'Hazır form · ' + g.label }, stdEntries.filter(e => e.group === g.id).map(e => h('option', { value: 'std:' + e.id }, e.name)))));
    const stdNup = h('select', { onchange: () => drawStd() }, [1, 2, 4, 6, 8].map(n => h('option', { value: n }, NUP_LABELS[n]))), stdD = h('select', null, [0, 4, 5, 6, 7, 8, 9, 10, 12].map(n => h('option', { value: n }, n ? `${n} haneli öğrenci no` : 'Öğrenci no yok'))), stdSd = h('select', null, [0, 3, 4, 5, 6, 7, 8, 9, 10].map(n => h('option', { value: n }, n ? `${n} haneli kurum kodu` : 'Kurum kodu yok'))), stdBox = h('div', { class: 'grid' }, h('div', { class: 'field' }, h('label', null, 'Sayfaya sığdırma'), stdNup), h('div', { class: 'field' }, h('label', null, 'Öğrenci no'), stdD), h('div', { class: 'field' }, h('label', null, 'Kurum kodu'), stdSd)), stdInfo = h('div', { class: 'small muted' });
    stdD.value = 8; stdSd.value = 0;
    if (curStd) { tplSel.value = 'std:' + curStd.entry.id; stdNup.value = curStd.nup; stdD.value = curStd.d; stdSd.value = curStd.sd; } else tplSel.value = curId;
    const tplOf = () => { const t = S.templates.find(x => x.templateId === tplSel.value); return t && t.json && t.json.kind === 'custom' && Array.isArray(t.json.lessons) ? t : null; };
    function applyTplLessons() {
      const t = tplOf(); if (!t) return; const j = t.json;
      setSections(j.lessons.map(l => ({ name: l.name, count: l.count, coef: 1 }))); if (j.choices >= 2 && j.choices <= 6) choices.value = j.choices;
      if (j.booklets && j.booklets.length) { booklets = j.booklets.slice(); bkIn.value = booklets.join(','); } drawSections(); drawKeys(); drawStd();
    }
    /* ---- sınav bölümleri ↔ formdaki ders blokları (formda 20'şer soru, sınavda farklı sayılar) ---- */
    const mapBox = h('div', { id: 'ex-map', class: 'exmap' }); let mapCells = [], mapSum = null;
    const mapSpec = () => sections.map(s => ({ l: s._l >= 0 ? s._l : -1, s: Math.max(0, (s._s | 0) - 1) }));
    const hasManualMap = () => sections.some(s => s._l >= 0 || (s._s | 0) > 1);
    function refreshMap() {
      const t = tplOf(); if (!t || !mapSum || !window.OMRDetect) return; const j = t.json, fs = OMRDetect.formSlots(sections, j.lessons, mapSpec());
      fs.plan.forEach((p, i) => { const c = mapCells[i]; if (!c) return; c.textContent = p.lesson >= 0 ? `${p.lessonName || 'form'} ${p.from}–${p.to}. soru` + (p.spill ? ' (bloğun sonunu aşar, sonraki bloğa taşar)' : '') + (p.shifted ? ' · önceki dersin ardından' : '') + (p.explicit ? ' · elle' : '') : `form satırı ${p.start + 1}–${p.end}`; c.style.color = ''; });
      clear(mapSum); mapSum.append(`Formda ${fs.formTotal} soru satırı var; sınavda ${fs.total} soru okunur, ${fs.unused} satır yok sayılır.`);
      if (fs.problems.length) mapSum.append(h('div', { class: 'alert bad small', id: 'ex-map-err' }, fs.problems.join(' ')));
    }
    function drawMap() {
      clear(mapBox); mapCells = []; mapSum = null; const t = tplOf(); if (!t) return; const j = t.json;
      const rows = sections.map((s, i) => {
        const sel = h('select', { id: `ex-map-l-${i}`, onchange: e => { s._l = +e.target.value; if (s._l < 0) { s._s = 1; st.value = 1; } refreshMap(); } }, h('option', { value: -1 }, 'Otomatik (adı/sırası)'), j.lessons.map((l, k) => h('option', { value: k }, `${l.name} (${l.count} soru)`)));
        sel.value = s._l >= 0 ? s._l : -1;
        const st = h('input', { type: 'number', min: 1, id: `ex-map-s-${i}`, value: s._s || 1, style: { width: '84px' }, oninput: e => { s._s = Math.max(1, parseInt(e.target.value) || 1); refreshMap(); } }), c = h('span', { class: 'small', id: `ex-map-r-${i}` });
        mapCells[i] = c; return h('tr', null, h('td', null, h('b', null, s.name || `Bölüm ${i + 1}`), h('div', { class: 'small muted' }, `${s.count} soru`)), h('td', null, sel), h('td', null, st), h('td', null, c));
      });
      mapSum = h('div', { class: 'small', id: 'ex-map-sum' });
      mapBox.append(h('h4', { style: { margin: '.6rem 0 .2rem' } }, 'Formla eşleme'),
        h('p', { class: 'small muted', style: { margin: '0 0 .3rem' } }, 'Formdaki her ders bloğu sınavdaki sorulardan fazla satır içerebilir (örn. formda 20, sınavda 10 soru): dersin soruları kendi bloğunun ilk satırlarına yerleşir, kalan satırlar okunmaz. Gerekirse bloğu ve başlangıç satırını elle seçin.'),
        h('div', { class: 'tablewrap', style: { maxHeight: 'none' } }, h('table', null, h('thead', null, h('tr', null, ['Sınav dersi', 'Formdaki blok', 'Başlangıç satırı', 'Sonuç'].map(x => h('th', null, x)))), h('tbody', null, rows))),
        h('div', { class: 'row', style: { marginTop: '.3rem' } }, mapSum, hasManualMap() ? h('button', { class: 'btn sm ghost', id: 'ex-map-auto', onclick: () => { sections.forEach(x => { x._l = -1; x._s = 1; }); drawMap(); } }, 'Hepsini otomatiğe çevir') : null));
      refreshMap();
    }
    function drawStd() {
      const on = tplSel.value.startsWith('std:'); stdBox.style.display = on ? '' : 'none'; clear(stdInfo);
      const ct = tplOf(); if (ct) { const j = ct.json, same = j.lessons.length === sections.length && j.lessons.every((l, i) => l.count === sections[i].count && l.name === sections[i].name); stdInfo.append(h('div', { class: 'row' }, h('span', { class: 'small', id: 'ex-form-info' }, `Harici form: ${j.questions} soru · ${j.choices} şık · ${j.lessons.map(l => `${l.name} ${l.count}`).join(' · ')}`), same ? null : h('button', { class: 'btn sm', id: 'ex-apply-lessons', onclick: applyTplLessons }, 'Dersleri bu formdan al')), mapBox); drawMap(); }
      if (on) { const e = Katalog.byId(tplSel.value.slice(4)); if (e) { const r = tryBuild(Katalog.formOpts(e, { nup: +stdNup.value, digits: +stdD.value, schoolDigits: +stdSd.value })); stdInfo.append(r.error ? h('span', { style: { color: 'var(--bad)' } }, r.error) : `Form: ${Katalog.total(e)} soru · ders ders sütunlar, numaralar her derste 1’den başlar · form kimliği ${r.tpl.formCodeHex}`); } }
    }
    stdD.addEventListener('change', drawStd); stdSd.addEventListener('change', drawStd);
    const status = h('select', { id: 'ex-status' }, h('option', { value: 'open' }, 'Okutmaya açık'), h('option', { value: 'draft' }, 'Taslak (okutulamaz)'), h('option', { value: 'closed' }, 'Kapalı')); status.value = ex ? ex.status : 'open';
    const showKeys = h('input', { type: 'checkbox', checked: c0.showKeys !== false }), veli = h('input', { type: 'checkbox', checked: c0.veli === true, id: 'ex-veli' });
    const err = h('div');
    // --- Kazanım / Konu Haritası (soru bazlı kazanım yükleme ve otomatik eylem planı kaynağı)
    let kazList = Array.isArray(c0.kazanimlar) ? c0.kazanimlar.map(k => Object.assign({}, k)) : [];
    const kazBox = h('div', { class: 'card', style: { background: 'var(--bg-soft, #f8fafc)', padding: '.8rem', marginBottom: '.6rem' } });
    function parseKazText(txt) {
      const lines = String(txt || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      const out = [];
      let autoQ = 1;
      lines.forEach(line => {
        const parts = line.split(/\t|;|\|/).map(x => x.trim());
        if (parts.length === 1 && !/^\d+$/.test(parts[0])) {
          out.push({ soru: autoQ++, ders: '', kod: '', konu: parts[0] });
          return;
        }
        const qNum = parseInt(parts[0], 10);
        if (isFinite(qNum) && qNum >= 1 && qNum <= 300) {
          if (parts.length >= 4) out.push({ soru: qNum, ders: parts[1], kod: parts[2], konu: parts.slice(3).join(' ') });
          else if (parts.length === 3) out.push({ soru: qNum, ders: parts[1], kod: '', konu: parts[2] });
          else out.push({ soru: qNum, ders: '', kod: '', konu: parts[1] || '' });
          autoQ = qNum + 1;
        } else if (parts.length >= 2) {
          out.push({ soru: autoQ++, ders: parts[0], kod: parts.length >= 3 ? parts[1] : '', konu: parts.slice(parts.length >= 3 ? 2 : 1).join(' ') });
        }
      });
      return out.filter(x => x.konu || x.kod);
    }
    function drawKaz() {
      clear(kazBox);
      const ta = h('textarea', {
        rows: 4,
        placeholder: 'Excel\'den yapıştırın veya satır satır yazın:\nÖrnek 1 (Soru \t Ders \t Kazanım Kodu \t Konu/Kazanım):\n1\tTürkçe\tT.8.3.5\tSözcükte Anlam ve Bağlam\n2\tTürkçe\tT.8.3.14\tParagrafta Ana Düşünce\nÖrnek 2 (Sadece soru sırasıyla konu adı):\nÜslü İfadeler\nKareköklü İfadeler',
        style: { width: '100%', fontSize: '.85rem' }
      });
      const fi = h('input', {
        type: 'file',
        accept: '.csv,.txt,.tsv',
        class: 'hidden',
        onchange: async e => {
          const f = e.target.files[0];
          if (f) { ta.value = await readFileText(f); }
          e.target.value = '';
        }
      });
      kazBox.append(
        h('p', { class: 'small muted', style: { marginTop: 0 } }, 'Denemenin soru bazlı kazanımlarını yüklerseniz, Öğrenci Analizi ekranında her öğrencinin yanlış/boş bıraktığı sorulara göre otomatik Konu/Kazanım Eylem Planı oluşturulur.'),
        ta,
        h('div', { class: 'row', style: { marginTop: '.45rem' } },
          h('button', { type: 'button', class: 'btn sm primary', onclick: () => {
            const parsed = parseKazText(ta.value);
            if (!parsed.length) return toast('Geçerli kazanım satırı bulunamadı.', 'warn');
            const byQ = new Map(kazList.map(x => [x.soru, x]));
            parsed.forEach(x => byQ.set(x.soru, x));
            kazList = Array.from(byQ.values()).sort((a, b) => a.soru - b.soru);
            ta.value = '';
            drawKaz();
            toast(`${parsed.length} kazanım eklendi/güncellendi.`, 'ok');
          } }, 'Kazanımları Listeye Ekle'),
          h('button', { type: 'button', class: 'btn sm', onclick: () => fi.click() }, 'CSV / TXT Seç'),
          fi,
          kazList.length ? h('button', { type: 'button', class: 'btn sm ghost', onclick: () => { kazList = []; drawKaz(); } }, 'Tümünü Temizle') : null,
          h('span', { class: 'grow' }),
          h('span', { class: 'pill ' + (kazList.length ? 'ok' : '') }, `${kazList.length} kazanım tanımlı`)
        ),
        kazList.length
          ? h('div', { class: 'tablewrap', style: { maxHeight: '180px', marginTop: '.5rem' } },
              h('table', { class: 'zebra-tbl' },
                h('thead', null, h('tr', null, ['Soru', 'Ders', 'Kazanım Kodu', 'Konu / Kazanım', ''].map(t => h('th', null, t)))),
                h('tbody', null, kazList.map((k, idx) => h('tr', null,
                  h('td', { class: 'num' }, k.soru),
                  h('td', null, k.ders || '–'),
                  h('td', { class: 'mono small' }, k.kod || '–'),
                  h('td', null, k.konu),
                  h('td', null, h('button', { type: 'button', class: 'btn sm ghost', onclick: () => { kazList.splice(idx, 1); drawKaz(); } }, '✕'))
                )))
              )
            )
          : null
      );
    }
    drawKaz();

    drawSections(); drawMethod(); drawKeys(); drawStd();
    if (init && init.templateId && S.templates.some(t => t.templateId === init.templateId)) { tplSel.value = init.templateId; applyTplLessons(); name.value = name.value || (S.templates.find(t => t.templateId === init.templateId) || {}).name || ''; }
    if (init && init.entryId) { const e = Katalog.byId(init.entryId); if (e) { preset.value = e.group !== 'tek' ? e.id : ''; applyEntry(e, true); if (init.nup) stdNup.value = init.nup; if (init.d != null) stdD.value = init.d; stdSd.value = init.sd || 0; drawStd(); } }
    const body = h('div', null,
      h('div', { class: 'grid' }, h('div', { class: 'field' }, h('label', null, 'Sınav adı'), name), h('div', { class: 'field' }, h('label', null, 'Tarih'), date), h('div', { class: 'field' }, h('label', null, 'Kapsam (hangi okullar katılır)'), scopeBox)),
      msBox,
      u.role === 'ogretmen' ? h('p', { class: 'small muted' }, 'Bu sınav kişiseldir: yalnızca siz ve okul yöneticiniz görür; aynı okuldaki diğer öğretmenler ve ilçe/il yetkilileri göremez.') : h('p', { class: 'small muted' }, 'Aynı sınavı birden çok okul okutur; sonuçlar tek havuzda toplanır ve okullar/ilçeler birbiriyle karşılaştırılır.'),
      h('h3', { style: { marginTop: '1rem' } }, 'Puanlama'), h('div', { class: 'grid' }, h('div', { class: 'field' }, h('label', null, 'Hazır ayar'), preset), h('div', { class: 'field' }, h('label', null, 'Şık sayısı'), choices), h('div', { class: 'field' }, h('label', null, 'Net kuralı'), pen), h('div', { class: 'field' }, h('label', null, 'Puan yöntemi'), methodSel)), methodBox,
      h('h3', { style: { marginTop: '1rem' } }, 'Ders / bölümler ve katsayılar'), secBox,
      h('h3', { style: { marginTop: '1rem' } }, 'Kitapçıklar ve cevap anahtarı'), h('div', { class: 'field', style: { maxWidth: '260px' } }, h('label', null, 'Kitapçık türleri (virgülle)'), bkIn), keyBox,
      h('h3', { style: { marginTop: '1rem' } }, 'Kazanımlar ve Konu Haritası (Otomatik Eylem Planı için)'), kazBox,
      h('h3', { style: { marginTop: '1rem' } }, 'Optik form'), h('div', { class: 'grid' }, h('div', { class: 'field' }, h('label', null, 'Optik form (okuma şablonu)'), tplSel), h('div', { class: 'field' }, h('label', null, 'Durum'), status)), stdBox, stdInfo,
      h('p', { class: 'small muted' }, 'Hazır formu Formlar → Hazır şablonlar sayfasından yazdırın; okutma aynı formu otomatik tanır. Kendi formunuzu Formlar → Tasarla bölümünde oluşturup kaydederseniz burada "Kayıtlı şablonlarım" altında seçersiniz.'),
      h('label', { class: 'row', style: { marginTop: '.4rem' } }, showKeys, 'Okul kullanıcıları cevap anahtarını görebilsin (okutma sırasında D/Y/B gösterilir)'),
      h('label', { class: 'row', style: { marginTop: '.4rem' } }, veli, 'Sonuçlar öğrenci/veli sorgulamasına açık olsun (okul + sınıf + okul numarasıyla; taslak sınavlar hariç). Kapalıyken öğrenciler hiçbir şey göremez.'), err);
    const dlg = modal(isNew ? 'Yeni sınav' : 'Sınavı düzenle', body, { size: 'wide', noBackdrop: true, buttons: [{ label: 'Vazgeç' }, { label: 'Kaydet', cls: 'primary', fn: async () => {
      clear(err); const sc = scopes[+scopeSel.value]; if (!name.value.trim()) { err.append(h('div', { class: 'alert bad' }, 'Sınav adı gerekli.')); return false; }
      if (!sc) { err.append(h('div', { class: 'alert bad' }, 'Kapsam seçin (önce Yönetim → Okullar bölümünden okul ekleyin).')); return false; }
      let scopeVal = sc[1];
      if (sc[0] === 'okullar') {
        if (!pickedSchools.size) { err.append(h('div', { class: 'alert bad' }, 'Çoklu okul seçimi için en az bir okul işaretleyin.')); return false; }
        scopeVal = Array.from(pickedSchools).join(',');
      }
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
        if (t && t.json && t.json.kind === 'custom' && Array.isArray(t.json.lessons) && window.OMRDetect) {
          const fs = OMRDetect.formSlots(sections, t.json.lessons, mapSpec());
          if (!fs.ok) { err.append(h('div', { class: 'alert bad', id: 'ex-save-maperr' }, 'Sınav dersleri formla eşleşmiyor: ' + (fs.problems.join(' ') || 'soru yok') + ' "Formla eşleme" bölümünden bloğu/başlangıç satırını ayarlayın ya da soru sayılarını düzeltin.')); return false; }
        } else if (t && t.json && t.json.kind === 'custom' && t.json.questions && t.json.questions !== totalN()) { err.append(h('div', { class: 'alert bad' }, `Seçilen form ${t.json.questions} soruluk, sınavınızda ${totalN()} soru var. Soru sayılarını eşitleyin ya da başka form seçin.`)); return false; }
        if (t && t.json && t.json.kind === 'generated' && t.json.opts && t.json.opts.questions !== totalN()) { err.append(h('div', { class: 'alert bad' }, `Seçilen şablon ${t.json.opts.questions} soruluk, sınavınızda ${totalN()} soru var.`)); return false; }
      }
      const kp = keyProblems();
      if (status.value === 'open' && kp.length) { err.append(h('div', { class: 'alert bad', id: 'ex-save-keyerr' }, 'Cevap anahtarı eksik ya da hatalı: ' + kp.slice(0, 4).join(' | ') + (kp.length > 4 ? ` … (+${kp.length - 4})` : '') + ' Anahtarı tamamlayın ya da durumu "Taslak" yapın.')); return false; }
      const fixKey = (s, b) => { const k = keyOf(s, b); return k.length >= s.count ? k.slice(0, s.count) : k + '.'.repeat(s.count - k.length); };
      const flat = Object.fromEntries(booklets.map(b => [b, sections.map(s => fixKey(s, b)).join('')]));
      const useMap = !!tplOf() && hasManualMap();
      const config = { sections: sections.map(s => ({ name: s.name.trim(), count: s.count, coef: s.coef })), choices: +choices.value, penalty: parseFloat(pen.value), method: methodSel.value, base: parseFloat(base.value), max: parseFloat(max.value), a: parseFloat(ca.value) || 0, b: parseFloat(cb.value) || 1,
        keys: flat, booklets, templateId, formMap: useMap ? mapSpec() : undefined, kazanimlar: kazList.length ? kazList : undefined, showKeys: showKeys.checked, veli: veli.checked, stats: cfg0.stats };
      try {
        const r = await api('saveExam', { exam: { examId: ex && ex.examId, name: name.value.trim(), date: date.value, scopeType: sc[0], scopeValue: scopeVal, status: status.value, config }, allowIssues: status.value !== 'open' });
        await refreshBase(); draw(); toast('Sınav kaydedildi', 'ok');
        if (r.issues && r.issues.length) toast('Uyarı: ' + r.issues[0], 'bad');
      } catch (e) { err.append(h('div', { class: 'alert bad' }, e.message)); return false; }
    } }] });
  }
  draw();
  if (App.newExam) { const n = App.newExam; App.newExam = null; editExam(null, n); }
};
