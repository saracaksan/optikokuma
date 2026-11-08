/* admin.js — okullar, öğrenciler, kullanıcılar (il/ilçe/okul hiyerarşisi) */
'use strict';

const AD = { tab: 'schools' };
const deTR = s => String(s || '').toLocaleLowerCase('tr').replace(/[ıİ]/g, 'i').replace(/[şŞ]/g, 's').replace(/[ğĞ]/g, 'g').replace(/[üÜ]/g, 'u').replace(/[öÖ]/g, 'o').replace(/[çÇ]/g, 'c').replace(/[^a-z0-9]/g, '');
/** Başlık satırı varsa sütunları adından, yoksa sırayla eşler. fields: {anahtar: [takma adlar]} */
function mapTable(table, fields) {
  if (!table.length) return [];
  const keys = Object.keys(fields), head = table[0].map(deTR); let idx = null;
  const found = keys.map(k => head.findIndex(x => fields[k].some(a => x === deTR(a))));
  if (found.filter(i => i >= 0).length >= Math.min(2, keys.length)) idx = found;
  const rows = idx ? table.slice(1) : table;
  return rows.map(r => { const o = {}; keys.forEach((k, i) => { const c = idx ? idx[i] : i; o[k] = c >= 0 ? (r[c] || '') : ''; }); return o; });
}

App.views.admin = function (root) {
  const tabs = [['schools', 'Okullar'], ['students', 'Öğrenciler'], ['users', 'Kullanıcılar']];
  const tb = h('div', { class: 'tabs' }), pane = h('div');
  const draw = () => { clear(tb).append(...tabs.map(([id, l]) => h('button', { class: AD.tab === id ? 'active' : '', onclick: () => { AD.tab = id; draw(); } }, l))); clear(pane); ({ schools: schoolsTab, students: studentsTab, users: usersTab })[AD.tab](pane); };
  root.append(h('h1', null, 'Yönetim'), tb, pane); draw();
};

/** Yapıştır / dosyadan yükle kutusu */
function importBox(hint, onImport) {
  const ta = h('textarea', { rows: 6, placeholder: hint, style: { letterSpacing: 0 } }), fi = h('input', { type: 'file', accept: '.csv,.txt,.tsv', class: 'hidden', onchange: async e => { const f = e.target.files[0]; if (f) ta.value = await readFileText(f); e.target.value = ''; } }), out = h('div');
  return h('div', null, ta, h('div', { class: 'row', style: { marginTop: '.5rem' } }, h('button', { class: 'btn primary', onclick: async ev => {
    const b = ev.target; b.disabled = true; clear(out); try { const rows = parseTable(ta.value); if (!rows.length) throw new Error('Yüklenecek veri yok.'); const r = await onImport(rows); out.append(h('div', { class: 'alert ok' }, `${r.added} eklendi, ${r.updated} güncellendi.`), r.skipped && r.skipped.length ? h('div', { class: 'alert warn' }, `${r.skipped.length} satır atlandı: ` + r.skipped.slice(0, 5).join('; ') + (r.skipped.length > 5 ? '…' : '')) : null); ta.value = ''; } catch (e) { out.append(h('div', { class: 'alert bad' }, e.message)); } b.disabled = false;
  } }, 'Yükle'), h('button', { class: 'btn', onclick: () => fi.click() }, 'CSV dosyası seç'), fi), out);
}

function schoolsTab(pane) {
  const S = App.state, list = h('div');
  const drawList = () => {
    clear(list); const q = h('input', { type: 'search', placeholder: 'Okul ara…' }), holder = h('div');
    const paint = () => { const t = q.value.toLocaleLowerCase('tr'); const rows = S.schools.filter(s => !t || (s.okulAdi + s.okulKodu + s.ilce + s.il).toLocaleLowerCase('tr').includes(t)); clear(holder).append(dataTable([{ k: 'okulKodu', label: 'Kod' }, { k: 'okulAdi', label: 'Okul' }, { k: 'ilce', label: 'İlçe' }, { k: 'il', label: 'İl' }], rows, { sort: { key: 'il', dir: 1 }, limit: 300 })); };
    q.addEventListener('input', paint); list.append(h('div', { class: 'row', style: { marginBottom: '.5rem' } }, q, h('span', { class: 'muted small' }, `${S.schools.length} okul`)), holder); paint();
  };
  pane.append(h('div', { class: 'card' }, h('h2', null, 'Okul ekle / güncelle'), h('p', { class: 'small muted' }, 'Excel\'den sütunları kopyalayıp yapıştırın. Sütunlar: ', h('span', { class: 'mono' }, 'okulKodu · okulAdi · il · ilce'), ' (ilk satır başlık olabilir). Aynı kodlu okul güncellenir.'),
    importBox('okulKodu\tokulAdi\til\tilce\n10001\tAtatürk Ortaokulu\tİstanbul\tEsenyurt', async rows => { const r = await api('importSchools', { rows: mapTable(rows, { okulKodu: ['okulKodu', 'kod', 'okul kodu'], okulAdi: ['okulAdi', 'okul', 'okul adı', 'ad'], il: ['il'], ilce: ['ilce', 'ilçe'] }) }); await refreshBase(); drawList(); return r; })),
    h('div', { class: 'card' }, h('h2', null, 'Kayıtlı okullar'), list)); drawList();
}

function studentsTab(pane) {
  const S = App.state, sel = h('select', null, h('option', { value: '' }, 'Okul seçin…'), S.schools.map(s => h('option', { value: s.okulKodu }, schoolLabel(s)))), body = h('div');
  if (S.user.role === 'okul' && S.schools[0]) sel.value = S.schools[0].okulKodu;
  async function load() {
    clear(body); if (!sel.value) return; Settings.set('admSchool', sel.value);
    const code = sel.value, st = await getStudents(code), holder = h('div');
    body.append(h('div', { class: 'card' }, h('h2', null, 'Öğrenci ekle / güncelle'), h('p', { class: 'small muted' }, 'Sütunlar: ', h('span', { class: 'mono' }, 'ogrNo · ad · soyad · sinif'), '. Aynı numaralı öğrenci güncellenir. Okutulan form numarası bu listeyle doğrulanır, sonuçlarda isim görünür.'),
      importBox('ogrNo\tad\tsoyad\tsinif\n101\tAli\tYılmaz\t8-A', async rows => { const r = await api('importStudents', { okulKodu: code, rows: mapTable(rows, { ogrNo: ['ogrNo', 'no', 'numara', 'öğrenci no', 'ogrenci no'], ad: ['ad', 'adi', 'isim'], soyad: ['soyad', 'soyadi'], sinif: ['sinif', 'sınıf', 'sube', 'şube'] }) }); await load(); return r; })),
      h('div', { class: 'card' }, h('h2', null, `Öğrenci listesi (${st.length})`), holder));
    holder.append(dataTable([{ k: 'ogrNo', label: 'No' }, { k: 'ad', label: 'Ad' }, { k: 'soyad', label: 'Soyad' }, { k: 'sinif', label: 'Sınıf' }], st, { sort: { key: 'sinif', dir: 1 }, limit: 300 }));
  }
  sel.addEventListener('change', load); const last = Settings.get('admSchool', ''); if (!sel.value && S.schools.some(s => String(s.okulKodu) === String(last))) sel.value = last;
  pane.append(h('div', { class: 'card' }, h('div', { class: 'field' }, h('label', null, 'Okul'), sel)), body); load();
}

function usersTab(pane) {
  const S = App.state, u = S.user, box = h('div');
  const roles = u.role === 'admin' ? ['admin', 'il', 'ilce', 'okul'] : u.role === 'il' ? ['ilce', 'okul'] : ['okul'];
  async function load() {
    clear(box).append(h('div', { class: 'card muted' }, 'Yükleniyor…'));
    let users; try { users = (await api('listUsers')).users; } catch (e) { clear(box).append(h('div', { class: 'alert bad' }, e.message)); return; }
    clear(box).append(h('div', { class: 'card' }, h('div', { class: 'row between' }, h('h2', null, 'Kullanıcılar'), h('button', { class: 'btn primary', id: 'us-new', onclick: () => edit(null) }, '+ Yeni kullanıcı')),
      dataTable([{ k: 'username', label: 'Kullanıcı adı' }, { k: 'name', label: 'Ad' }, { k: 'role', label: 'Rol', get: r => ROLE_LABEL[r.role] || r.role }, { k: 'where', label: 'Yetki alanı', get: r => r.role === 'okul' ? ((schoolByCode(r.okulKodu) || {}).okulAdi || r.okulKodu) : r.role === 'ilce' ? `${r.ilce} / ${r.il}` : r.role === 'il' ? r.il : 'Tümü' }, { k: 'active', label: 'Durum', get: r => r.active ? 'Aktif' : 'Pasif' }], users, { sort: { key: 'role', dir: 1 }, onRow: r => edit(r) }),
      h('p', { class: 'small muted' }, 'Düzenlemek için satıra tıklayın. Parolayı boş bırakırsanız değişmez.')));
  }
  function edit(r) {
    const isNew = !r, f = Object.assign({ username: '', name: '', role: roles[roles.length - 1], il: u.role !== 'admin' ? u.il : '', ilce: u.role === 'ilce' ? u.ilce : '', okulKodu: '', active: true }, r || {});
    const un = h('input', { type: 'text', value: f.username, disabled: !isNew, autocapitalize: 'none' }), nm = h('input', { type: 'text', value: f.name }), pw = h('input', { type: 'password', autocomplete: 'new-password', placeholder: isNew ? 'En az 6 karakter' : '(değişmesin)' });
    const role = h('select', { onchange: () => { f.role = role.value; drawWhere(); } }, roles.map(x => h('option', { value: x }, ROLE_LABEL[x]))); role.value = f.role; if (!isNew) role.disabled = u.role !== 'admin';
    const ils = Array.from(new Set(S.schools.map(s => s.il))).sort(), whereBox = h('div'), act = h('input', { type: 'checkbox', checked: f.active }), err = h('div');
    const ilSel = h('select', null, ils.map(x => h('option', { value: x }, x))), ilceSel = h('select'), schSel = h('select', null, S.schools.map(s => h('option', { value: s.okulKodu }, schoolLabel(s))));
    ilSel.value = f.il; const fillIlce = () => { clear(ilceSel).append(...Array.from(new Set(S.schools.filter(s => s.il === ilSel.value).map(s => s.ilce))).sort().map(x => h('option', { value: x }, x))); if (f.ilce) ilceSel.value = f.ilce; }; ilSel.addEventListener('change', () => { f.ilce = ''; fillIlce(); }); fillIlce(); schSel.value = f.okulKodu;
    function drawWhere() { clear(whereBox); if (f.role === 'il') whereBox.append(h('div', { class: 'field' }, h('label', null, 'İl'), ilSel)); else if (f.role === 'ilce') whereBox.append(h('div', { class: 'grid' }, h('div', { class: 'field' }, h('label', null, 'İl'), ilSel), h('div', { class: 'field' }, h('label', null, 'İlçe'), ilceSel))); else if (f.role === 'okul') whereBox.append(h('div', { class: 'field' }, h('label', null, 'Okul'), schSel)); }
    drawWhere();
    modal(isNew ? 'Yeni kullanıcı' : 'Kullanıcıyı düzenle', h('div', null, h('div', { class: 'grid' }, h('div', { class: 'field' }, h('label', null, 'Kullanıcı adı'), un), h('div', { class: 'field' }, h('label', null, 'Ad / kurum'), nm), h('div', { class: 'field' }, h('label', null, 'Rol'), role), h('div', { class: 'field' }, h('label', null, 'Parola'), pw)), h('div', { style: { marginTop: '.7rem' } }, whereBox), h('label', { class: 'row', style: { marginTop: '.7rem' } }, act, 'Aktif'), err), {
      buttons: [{ label: 'Vazgeç' }, { label: 'Kaydet', cls: 'primary', fn: async () => { clear(err); try { await api('saveUser', { username: un.value, name: nm.value, role: role.value, il: ilSel.value, ilce: ilceSel.value, okulKodu: schSel.value, password: pw.value || undefined, active: act.checked }); toast('Kaydedildi', 'ok'); load(); } catch (e) { err.append(h('div', { class: 'alert bad' }, e.message)); return false; } } }] });
  }
  pane.append(box); load();
}
