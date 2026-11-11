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
  const u = App.state.user;
  const tabs = u.role === 'okul' ? [['students', 'Öğrenciler'], ['users', 'Öğretmenler'], ['apps', 'Başvurular']] : [['schools', 'Okullar'], ['students', 'Öğrenciler'], ['users', 'Kullanıcılar'], ['apps', 'Başvurular']];
  if (!tabs.some(t => t[0] === AD.tab)) AD.tab = tabs[0][0];
  const tb = h('div', { class: 'tabs' }), pane = h('div');
  const lab = (id, l) => id === 'apps' && App.state.pending ? [l, h('span', { class: 'badge', style: { position: 'static', marginLeft: '.4rem', display: 'inline-block' } }, App.state.pending)] : l;
  const draw = () => { clear(tb).append(...tabs.map(([id, l]) => h('button', { id: 'ad-tab-' + id, class: AD.tab === id ? 'active' : '', onclick: () => { AD.tab = id; draw(); } }, lab(id, l)))); clear(pane); ({ schools: schoolsTab, students: studentsTab, users: usersTab, apps: appsTab })[AD.tab](pane); };
  root.append(h('h1', null, 'Yönetim'), tb, pane); draw(); App.refreshPending && App.refreshPending();
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
    const paint = () => { const t = q.value.toLocaleLowerCase('tr'); const rows = S.schools.filter(s => !t || (s.okulAdi + s.okulKodu + s.ilce + s.il).toLocaleLowerCase('tr').includes(t)); clear(holder).append(dataTable([{ k: 'okulKodu', label: 'Kod' }, { k: 'okulAdi', label: 'Okul' }, { k: 'tur', label: 'Düzey' }, { k: 'ilce', label: 'İlçe' }, { k: 'il', label: 'İl' }, S.schools.some(x => x.mudur) ? { k: 'mudur', label: 'Müdür' } : null, S.schools.some(x => x.telefon) ? { k: 'telefon', label: 'Telefon' } : null].filter(Boolean), rows, { sort: { key: 'il', dir: 1 }, limit: 300 })); };
    q.addEventListener('input', paint); list.append(h('div', { class: 'row', style: { marginBottom: '.5rem' } }, q, h('span', { class: 'muted small' }, `${S.schools.length} okul`)), holder); paint();
  };
  pane.append(h('div', { class: 'card' }, h('h2', null, 'Okul ekle / güncelle'), h('p', { class: 'small muted' }, 'Excel\'den sütunları kopyalayıp yapıştırın. Sütunlar: ', h('span', { class: 'mono' }, 'okulKodu · okulAdi · il · ilce'), ' (isteğe bağlı: ', h('span', { class: 'mono' }, 'tur'), ' = Okul öncesi / İlkokul / Ortaokul / Lise; boşsa okul adından çıkarılır). Aynı kodlu okul güncellenir. Okul yöneticileri okullarını kendileri de kaydedebilir (Başvurular sekmesi).'),
    importBox('okulKodu\tokulAdi\til\tilce\n10001\tAtatürk Ortaokulu\tİstanbul\tEsenyurt', async rows => { const r = await api('importSchools', { rows: mapTable(rows, { okulKodu: ['okulKodu', 'kod', 'okul kodu'], okulAdi: ['okulAdi', 'okul', 'okul adı', 'ad'], il: ['il'], ilce: ['ilce', 'ilçe'], tur: ['tur', 'tür', 'düzey', 'duzey'] }) }); await refreshBase(); drawList(); return r; })),
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
  const S = App.state, u = S.user, box = h('div'), teacherOnly = u.role === 'okul';
  const roles = u.role === 'admin' ? ['admin', 'il', 'ilce', 'okul', 'ogretmen'] : u.role === 'il' ? ['ilce', 'okul', 'ogretmen'] : u.role === 'ilce' ? ['okul', 'ogretmen'] : ['ogretmen'];
  const whereOf = r => (r.role === 'okul' || r.role === 'ogretmen') ? ((schoolByCode(r.okulKodu) || {}).okulAdi || r.okulKodu) : r.role === 'ilce' ? `${r.ilce} / ${r.il}` : r.role === 'il' ? r.il : 'Tümü';
  async function load() {
    clear(box).append(h('div', { class: 'card muted' }, 'Yükleniyor…'));
    let users; try { users = (await api('listUsers')).users; } catch (e) { clear(box).append(h('div', { class: 'alert bad' }, e.message)); return; }
    clear(box).append(h('div', { class: 'card' }, h('div', { class: 'row between' }, h('h2', null, teacherOnly ? 'Okulumun öğretmenleri' : 'Kullanıcılar'), h('button', { class: 'btn primary', id: 'us-new', onclick: () => edit(null) }, teacherOnly ? '+ Öğretmen ekle' : '+ Yeni kullanıcı')),
      teacherOnly ? h('p', { class: 'small muted' }, 'Öğretmenler kendileri de üye olabilir (Başvurular sekmesindeki bağlantı). Buradan doğrudan ekleyip parola verebilir, pasifleştirebilirsiniz. Öğretmenin sınavlarını ve sonuçlarını siz görebilirsiniz.') : null,
      dataTable([{ k: 'username', label: 'Kullanıcı adı' }, { k: 'name', label: 'Ad' }, { k: 'role', label: 'Rol', get: r => ROLE_LABEL[r.role] || r.role }, { k: 'brans', label: 'Branş' }, { k: 'where', label: 'Yetki alanı', get: whereOf }, { k: 'active', label: 'Durum', get: r => r.active ? 'Aktif' : 'Pasif' }], users, { sort: { key: 'role', dir: 1 }, onRow: r => edit(r) }),
      h('p', { class: 'small muted' }, 'Düzenlemek için satıra tıklayın. Parolayı boş bırakırsanız değişmez.')));
  }
  function edit(r) {
    const isNew = !r, f = Object.assign({ username: '', name: '', role: roles[roles.length - 1], il: u.role !== 'admin' ? u.il : '', ilce: u.role === 'ilce' ? u.ilce : '', okulKodu: u.role === 'okul' ? u.okulKodu : '', active: true, brans: '', telefon: '', eposta: '' }, r || {});
    const un = h('input', { type: 'text', value: f.username, disabled: !isNew, autocapitalize: 'none', id: 'us-username' }), nm = h('input', { type: 'text', value: f.name, id: 'us-name' }), pw = h('input', { type: 'password', autocomplete: 'new-password', id: 'us-pass', placeholder: isNew ? 'En az 6 karakter' : '(değişmesin)' });
    const role = h('select', { id: 'us-role', onchange: () => { f.role = role.value; drawWhere(); } }, roles.map(x => h('option', { value: x }, ROLE_LABEL[x]))); role.value = f.role; role.disabled = (!isNew && u.role !== 'admin') || roles.length === 1;
    const ils = Array.from(new Set(S.schools.map(s => s.il))).sort(), whereBox = h('div'), act = h('input', { type: 'checkbox', checked: f.active }), err = h('div');
    const brans = h('input', { type: 'text', value: f.brans || '', id: 'us-brans', placeholder: 'Örn: Fen Bilimleri' }), tel = h('input', { type: 'tel', value: f.telefon || '', id: 'us-tel' }), mail = h('input', { type: 'email', value: f.eposta || '', id: 'us-mail' });
    const ilSel = h('select', null, ils.map(x => h('option', { value: x }, x))), ilceSel = h('select'), schSel = h('select', { id: 'us-school' }, S.schools.map(s => h('option', { value: s.okulKodu }, schoolLabel(s))));
    ilSel.value = f.il; const fillIlce = () => { clear(ilceSel).append(...Array.from(new Set(S.schools.filter(s => s.il === ilSel.value).map(s => s.ilce))).sort().map(x => h('option', { value: x }, x))); if (f.ilce) ilceSel.value = f.ilce; }; ilSel.addEventListener('change', () => { f.ilce = ''; fillIlce(); }); fillIlce();
    if (f.okulKodu) schSel.value = f.okulKodu; else if (S.schools[0]) schSel.value = S.schools[0].okulKodu; schSel.disabled = u.role === 'okul';
    function drawWhere() {
      clear(whereBox);
      if (f.role === 'il') whereBox.append(h('div', { class: 'field' }, h('label', null, 'İl'), ilSel));
      else if (f.role === 'ilce') whereBox.append(h('div', { class: 'grid' }, h('div', { class: 'field' }, h('label', null, 'İl'), ilSel), h('div', { class: 'field' }, h('label', null, 'İlçe'), ilceSel)));
      else if (f.role === 'okul' || f.role === 'ogretmen') whereBox.append(h('div', { class: 'field' }, h('label', null, 'Okul'), schSel),
        h('div', { class: 'grid', style: { marginTop: '.7rem' } }, f.role === 'ogretmen' ? h('div', { class: 'field' }, h('label', null, 'Branş'), brans) : null, h('div', { class: 'field' }, h('label', null, 'Telefon'), tel), h('div', { class: 'field' }, h('label', null, 'E-posta'), mail)),
        f.role === 'ogretmen' ? h('p', { class: 'small muted' }, 'Öğretmen kendi sınavlarını oluşturur ve okutur. Bu sınavları ve sonuçlarını yalnızca kendisi, okul yöneticisi ve sistem yöneticisi görür; diğer öğretmenler ve ilçe/il yetkilileri göremez.') : null);
    }
    drawWhere();
    modal(isNew ? 'Yeni kullanıcı' : 'Kullanıcıyı düzenle', h('div', null, h('div', { class: 'grid' }, h('div', { class: 'field' }, h('label', null, 'Kullanıcı adı'), un), h('div', { class: 'field' }, h('label', null, 'Ad / kurum'), nm), h('div', { class: 'field' }, h('label', null, 'Rol'), role), h('div', { class: 'field' }, h('label', null, 'Parola'), pw)), h('div', { style: { marginTop: '.7rem' } }, whereBox), h('label', { class: 'row', style: { marginTop: '.7rem' } }, act, 'Aktif'), err), {
      buttons: [{ label: 'Vazgeç' }, { label: 'Kaydet', cls: 'primary', fn: async () => { clear(err); try { await api('saveUser', { username: un.value, name: nm.value, role: role.value, il: ilSel.value, ilce: ilceSel.value, okulKodu: schSel.value, password: pw.value || undefined, active: act.checked, brans: brans.value, telefon: tel.value, eposta: mail.value }); toast('Kaydedildi', 'ok'); load(); } catch (e) { err.append(h('div', { class: 'alert bad' }, e.message)); return false; } } }] });
  }
  pane.append(box); load();
}

/* ---- başvurular: öğretmen üyelikleri ve okul kayıtları (onay / red) + kayıt bağlantısı */
function appsTab(pane) {
  const S = App.state, u = S.user, box = h('div'); let mode = 'bekleyen';
  const regUrl = location.origin + location.pathname.replace(/index\.html$/, '') + '#/kayit', cfgSet = !!(window.OPTIK_CONFIG && window.OPTIK_CONFIG.apiUrl);
  const copy = async (text, el) => { try { await navigator.clipboard.writeText(text); toast('Kopyalandı', 'ok'); } catch (e) { el.select(); toast('Seçildi; Ctrl+C ile kopyalayın.'); } };
  const link = h('input', { type: 'text', readOnly: true, value: regUrl, id: 'ap-link', onfocus: e => e.target.select() });
  pane.append(h('div', { class: 'card' }, h('h2', null, 'Üyelik bağlantısı'),
    h('p', { class: 'small muted', style: { marginTop: 0 } }, u.role === 'okul' ? 'Öğretmenlerinize bu bağlantıyı gönderin. Okulunuzu listeden seçerek üye olurlar; başvurularını burada onaylarsınız.' : 'Bu bağlantı herkese açıktır: öğretmenler il → ilçe → okul seçerek üye olur, okul yöneticileri okullarını kaydeder. Başvurular ilgili yetkilinin onayına düşer.'),
    h('div', { class: 'linkbox' }, link, h('button', { class: 'btn', id: 'ap-copy', onclick: () => copy(regUrl, link) }, 'Kopyala')),
    !cfgSet && u.role === 'admin' ? h('div', { class: 'alert warn' }, h('b', null, 'Önemli: '), 'Öğretmenler sunucu adresini bilmeden üye olabilsin diye GitHub’da ', h('span', { class: 'mono' }, 'config.js'), ' dosyasını şöyle düzenleyin (siteye yeniden yükleme birkaç dakika sürer):', h('pre', { class: 'cfg' }, `window.OPTIK_CONFIG = { apiUrl: '${getApiUrl() || 'https://script.google.com/macros/s/…/exec'}' };`)) : null),
    box);
  async function load() {
    clear(box).append(h('div', { class: 'card muted' }, 'Yükleniyor…'));
    let d; try { d = await api('listApplications', { durum: mode === 'tum' ? 'hepsi' : undefined }); } catch (e) { clear(box).append(h('div', { class: 'alert bad' }, e.message)); return; }
    S.pending = d.pending || 0; App.updateTopbar();
    const tbtn = (id, l) => h('button', { class: mode === id ? 'active' : '', id: 'ap-mode-' + id, onclick: () => { mode = id; load(); } }, l);
    clear(box).append(h('div', { class: 'card' }, h('h2', null, 'Başvurular'), h('div', { class: 'tabs' }, tbtn('bekleyen', `Onay bekleyen (${d.pending || 0})`), tbtn('tum', 'Tümü (son 300)')),
      d.applications.length ? d.applications.map(card) : h('div', { class: 'empty muted' }, mode === 'bekleyen' ? 'Onay bekleyen başvuru yok.' : 'Başvuru yok.')));
  }
  function when(v) { const t = new Date(v); return isNaN(t) ? '' : t.toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' }); }
  function card(a) {
    const isSchool = a.tur === 'okul', kv = [['Kullanıcı adı', a.username], ['Okul', `${a.okulAdi} · ${a.duzey || ''} · kod ${a.okulKodu}`], ['İl / ilçe', `${a.il} / ${a.ilce}`], isSchool ? ['Müdür', a.mudur] : ['Branş', a.brans], ['Telefon', a.telefon], ['E-posta', a.eposta], isSchool ? ['Adres', a.adres] : null, ['Başvuru', when(a.createdAt)]].filter(x => x && x[1]);
    const st = { beklemede: ['Onay bekliyor', 'warn'], onay: ['Onaylandı', 'ok'], red: ['Reddedildi', 'bad'] }[a.durum] || [a.durum, ''];
    return h('div', { class: 'app-card', 'data-app': a.username },
      h('div', { class: 'row between' }, h('b', null, (isSchool ? '🏫 Okul kaydı · ' : '👤 Öğretmen üyeliği · ') + a.name), h('span', { class: 'pill ' + st[1] }, st[0])),
      h('dl', { class: 'kv' }, kv.map(([k, v]) => [h('dt', null, k), h('dd', null, v)])),
      a.conflict ? h('div', { class: 'alert bad' }, a.conflict + ' Bu başvuru onaylanamaz; reddedin.') : null,
      a.durum !== 'beklemede' ? h('div', { class: 'small muted' }, `${a.decidedBy} · ${when(a.decidedAt)}${a.not ? ' · Not: ' + a.not : ''}`) : h('div', { class: 'row' },
        h('button', { class: 'btn primary sm', 'data-act': 'onay', disabled: !!a.conflict, onclick: ev => decide(a, 'onay', '', ev.target) }, 'Onayla'),
        h('button', { class: 'btn danger sm', 'data-act': 'red', onclick: () => reject(a) }, 'Reddet')));
  }
  async function decide(a, karar, not, btn) {
    if (btn) btn.disabled = true;
    try { const r = await api('decideApplication', { id: a.id, karar, not }); S.pending = r.pending || 0; if (a.tur === 'okul' && karar === 'onay') await refreshBase(); toast(karar === 'onay' ? 'Onaylandı: hesap açıldı' : 'Reddedildi', 'ok'); App.updateTopbar(); }
    catch (e) { toast(e.message, 'bad'); if (btn) btn.disabled = false; }
    load();
  }
  function reject(a) {
    const note = h('input', { type: 'text', id: 'ap-note', maxlength: 200, placeholder: 'Başvurana görünür (isteğe bağlı)' });
    modal('Başvuruyu reddet', h('div', null, h('p', null, `${a.name} (${a.username}) başvurusu reddedilsin mi?`), h('div', { class: 'field' }, h('label', null, 'Gerekçe'), note)), { buttons: [{ label: 'Vazgeç' }, { label: 'Reddet', cls: 'danger', fn: async () => { await decide(a, 'red', note.value, null); } }] });
  }
  load();
}
