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
  const tabs = u.role === 'okul' ? [['students', 'Öğrenciler'], ['users', 'Öğretmenler'], ['wa', 'Veli WhatsApp'], ['apps', 'Başvurular']] : [['schools', 'Okullar'], ['students', 'Öğrenciler'], ['users', 'Kullanıcılar'], ['wa', 'Veli WhatsApp'], ['apps', 'Başvurular']].concat(u.role === 'admin' ? [['ai', 'Yapay zekâ']] : []);
  if (!tabs.some(t => t[0] === AD.tab)) AD.tab = tabs[0][0];
  const tb = h('div', { class: 'tabs' }), pane = h('div');
  const lab = (id, l) => id === 'apps' && App.state.pending ? [l, h('span', { class: 'badge', style: { position: 'static', marginLeft: '.4rem', display: 'inline-block' } }, App.state.pending)] : l;
  const draw = () => { clear(tb).append(...tabs.map(([id, l]) => h('button', { id: 'ad-tab-' + id, class: AD.tab === id ? 'active' : '', onclick: () => { AD.tab = id; draw(); } }, lab(id, l)))); clear(pane); ({ schools: schoolsTab, students: studentsTab, users: usersTab, wa: waTab, apps: appsTab, ai: aiTab })[AD.tab](pane); };
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
    clear(list); const holder = h('div');
    const paint = rows => { clear(holder).append(dataTable([{ k: 'okulKodu', label: 'Kod' }, { k: 'okulAdi', label: 'Okul' }, { k: 'tur', label: 'Düzey' }, { k: 'ilce', label: 'İlçe' }, { k: 'il', label: 'İl' }, S.schools.some(x => x.mudur) ? { k: 'mudur', label: 'Müdür' } : null, S.schools.some(x => x.telefon) ? { k: 'telefon', label: 'Telefon' } : null, { k: '_act', label: '', render: r => h('span', { class: 'row nowrap' }, h('button', { class: 'btn sm', 'data-act': 'edit', onclick: ev => { ev.stopPropagation(); schoolForm(r, afterChange); } }, 'Düzenle'), h('button', { class: 'btn sm danger', 'data-act': 'del', onclick: ev => { ev.stopPropagation(); deleteSchool(r, afterChange); } }, 'Sil')) }].filter(Boolean), rows, { sort: { key: 'il', dir: 1 }, limit: 300 })); };
    const bar = schoolFilterBar(S.schools, rows => paint(rows)); list.append(h('div', { class: 'row', style: { marginBottom: '.5rem' } }, bar.el, h('button', { class: 'btn primary', id: 'sc-new', onclick: () => schoolForm(null, afterChange) }, '+ Okul ekle')), holder);
  };
  const afterChange = () => drawList();
  pane.append(h('div', { class: 'card' }, h('h2', null, 'Okul ekle / güncelle'), h('p', { class: 'small muted' }, 'Excel\'den sütunları kopyalayıp yapıştırın. Sütunlar: ', h('span', { class: 'mono' }, 'okulKodu · okulAdi · il · ilce'), ' (isteğe bağlı: ', h('span', { class: 'mono' }, 'tur'), ' = Okul öncesi / İlkokul / Ortaokul / Lise; boşsa okul adından çıkarılır). Aynı kodlu okul güncellenir. Okul yöneticileri okullarını kendileri de kaydedebilir (Başvurular sekmesi).'),
    importBox('okulKodu\tokulAdi\til\tilce\n10001\tAtatürk Ortaokulu\tİstanbul\tEsenyurt', async rows => { const r = await api('importSchools', { rows: mapTable(rows, { okulKodu: ['okulKodu', 'kod', 'okul kodu'], okulAdi: ['okulAdi', 'okul', 'okul adı', 'ad'], il: ['il'], ilce: ['ilce', 'ilçe'], tur: ['tur', 'tür', 'düzey', 'duzey'] }) }); await refreshBase(); drawList(); return r; })),
    h('div', { class: 'card' }, h('h2', null, 'Kayıtlı okullar'), list)); drawList();
}

/** Veli telefonları yalnızca okul yöneticisi ve üstüne gelir ve çevrim dışı önbelleğe yazılmaz; sunucuya ulaşılamazsa telefonsuz (önbellekli) liste döner. */
async function getStudentsTel(code) {
  try { return (await api('listStudents', { okulKodu: String(code), tel: true })).students || []; }
  catch (e) { return getStudents(code); }
}
/** 905321112233 → 0532 111 22 33 (gösterim); başka biçimler +ülkekodu ile. */
function telShow(n) {
  n = String(n || ''); if (!n) return '';
  const m = n.match(/^90(5\d{2})(\d{3})(\d{2})(\d{2})$/); return m ? `0${m[1]} ${m[2]} ${m[3]} ${m[4]}` : '+' + n;
}
const telChips = x => x.anneTel === undefined ? '' : h('span', { class: 'chips' }, h('span', { class: 'chip ' + (x.anneTel ? 'ok' : ''), title: x.anneTel ? 'Anne: ' + telShow(x.anneTel) : 'Anne telefonu yok' }, 'Anne'), h('span', { class: 'chip ' + (x.babaTel ? 'ok' : ''), title: x.babaTel ? 'Baba: ' + telShow(x.babaTel) : 'Baba telefonu yok' }, 'Baba'));

function studentsTab(pane) {
  const S = App.state, sel = h('select', null, h('option', { value: '' }, 'Okul seçin…'), S.schools.map(s => h('option', { value: s.okulKodu }, schoolLabel(s)))), body = h('div'), pick = schoolPicker(sel, S.schools);
  if (S.user.role === 'okul' && S.schools[0]) sel.value = S.schools[0].okulKodu;
  async function load() {
    clear(body); if (!sel.value) return; Settings.set('admSchool', sel.value);
    const code = sel.value, st = await getStudentsTel(code), holder = h('div');
    body.append(h('div', { class: 'card' }, h('h2', null, 'Öğrenci ekle / güncelle'), h('p', { class: 'small muted' }, 'Sütunlar: ', h('span', { class: 'mono' }, 'ogrNo · ad · soyad · sinif · anneTel · babaTel'), ' (telefonlar isteğe bağlı, 0532 111 22 33 biçimi; velilere WhatsApp için “Veli WhatsApp” sekmesinde kullanılır). Aynı numaralı öğrenci güncellenir. Okutulan form numarası bu listeyle doğrulanır, sonuçlarda isim görünür.'),
      importBox('ogrNo\tad\tsoyad\tsinif\tanneTel\tbabaTel\n101\tAli\tYılmaz\t8-A\t0532 111 22 33\t0533 222 33 44', async rows => { const r = await api('importStudents', { okulKodu: code, rows: mapTable(rows, { ogrNo: ['ogrNo', 'no', 'numara', 'öğrenci no', 'ogrenci no'], ad: ['ad', 'adi', 'isim'], soyad: ['soyad', 'soyadi'], sinif: ['sinif', 'sınıf', 'sube', 'şube'], anneTel: ['annetel', 'anne tel', 'anne telefon', 'anne telefonu', 'anne cep', 'anne gsm', 'anne'], babaTel: ['babatel', 'baba tel', 'baba telefon', 'baba telefonu', 'baba cep', 'baba gsm', 'baba'], veliKodu: ['velikodu', 'veli kodu', 'veli_kodu', 'veli kod', 'pin'] }) }); await load(); return r; })),
      h('div', { class: 'card' }, h('h2', null, 'Öğrenci / veli sorgulaması'), h('p', { class: 'small muted', style: { marginTop: 0 } }, 'Öğrenci ve veliler, sınav sahibi "öğrenci/veli sorgulamasına açık" dediği sınavların sonucunu ', h('b', null, 'okul → sınıf → okul numarası'), ' ile görür (bağlantı: Ayarlar). İsterseniz her öğrenciye bir ', h('b', null, 'veli kodu'), ' verin: kodu olan öğrenci için sorgulamada bu kod da istenir (numaranın tahmin edilerek denenmesini önler). Öğrenci listesindeki ad, sorgulama sayfasında maskelenir (Ay** Öz****).'),
        h('div', { class: 'row' }, h('button', { class: 'btn primary', id: 'st-codes', onclick: async ev => { const b = ev.currentTarget; b.disabled = true; try { const r = await api('generateParentCodes', { okulKodu: code }); download(`veli-kodlari-${code}.csv`, toCSV([['Sınıf', 'No', 'Ad', 'Soyad', 'Veli kodu'], ...r.students.map(x => [x.sinif, x.ogrNo, x.ad, x.soyad, x.veliKodu])])); toast(`${r.students.length} öğrencinin veli kodu indirildi` + (r.created ? ` (${r.created} yeni üretildi)` : ''), 'ok'); } catch (e) { toast(e.message, 'bad'); } b.disabled = false; } }, 'Veli kodlarını üret / CSV indir'), h('button', { class: 'btn danger', id: 'st-codes-all', onclick: async ev => { const b = ev.currentTarget; if (!confirm('Bu okuldaki TÜM öğrencilerin veli kodları yenilenecek; eski kodlar geçersiz olur. Devam edilsin mi?')) return; b.disabled = true; try { const r = await api('generateParentCodes', { okulKodu: code, hepsi: true }); download(`veli-kodlari-${code}.csv`, toCSV([['Sınıf', 'No', 'Ad', 'Soyad', 'Veli kodu'], ...r.students.map(x => [x.sinif, x.ogrNo, x.ad, x.soyad, x.veliKodu])])); toast(`${r.students.length} öğrencinin veli kodu yenilendi ve indirildi`, 'ok'); } catch (e) { toast(e.message, 'bad'); } b.disabled = false; } }, 'Tümünü yenile'), h('span', { class: 'small muted' }, 'Kodu olmayanlara 6 haneli kod üretilir; olanlar değişmez. CSV\'yi yazdırıp velilere dağıtın.'))),
      h('div', { class: 'card' }, h('div', { class: 'row between' }, h('h2', null, `Öğrenci listesi (${st.length})`), h('button', { class: 'btn primary', id: 'st-new', onclick: () => studentForm(code, null, load) }, '+ Öğrenci ekle')), holder));
    holder.append(studentManager(code, st, load));
  }
  sel.addEventListener('change', load); const last = Settings.get('admSchool', ''); if (!sel.value && S.schools.some(s => String(s.okulKodu) === String(last))) sel.value = last;
  pane.append(h('div', { class: 'card' }, h('div', { class: 'field' }, h('label', null, 'Okul'), pick)), body); load();
}

/* ---- okul ekle / düzenle / sil (yalnızca yönetici, il ve ilçe yetkilisi; sunucu yetkiyi ayrıca denetler) */
const DUZEY_LISTESI = ['Okul öncesi', 'İlkokul', 'Ortaokul', 'Lise', 'Diğer'];
function schoolForm(sch, onDone) {
  const S = App.state, u = S.user, isNew = !sch;
  const f = Object.assign({ okulKodu: '', okulAdi: '', il: u.role === 'admin' ? '' : (u.il || ''), ilce: u.role === 'ilce' ? (u.ilce || '') : '', tur: '', mudur: '', telefon: '', eposta: '', adres: '' }, sch || {});
  const inp = (k, extra) => h('input', Object.assign({ type: 'text', id: 'sc-f-' + k, value: f[k] || '', oninput: e => { f[k] = e.target.value; } }, extra || {}));
  const ilList = h('datalist', { id: 'sc-il-list' }, Array.from(new Set(S.schools.map(x => x.il))).sort((a, b) => a.localeCompare(b, 'tr')).map(x => h('option', { value: x }))), ilceList = h('datalist', { id: 'sc-ilce-list' });
  const fillIlce = () => { clear(ilceList).append(...Array.from(new Set(S.schools.filter(x => x.il === f.il).map(x => x.ilce))).sort((a, b) => a.localeCompare(b, 'tr')).map(x => h('option', { value: x }))); };
  const il = inp('il', { list: 'sc-il-list', disabled: u.role !== 'admin', oninput: e => { f.il = e.target.value; fillIlce(); } }), ilce = inp('ilce', { list: 'sc-ilce-list', disabled: u.role === 'ilce' }); fillIlce();
  const tur = h('select', { id: 'sc-f-tur', onchange: e => { f.tur = e.target.value; } }, h('option', { value: '' }, 'Okul adından çıkar'), DUZEY_LISTESI.map(x => h('option', { value: x }, x))); tur.value = f.tur || '';
  const err = h('div');
  modal(isNew ? 'Okul ekle' : 'Okulu düzenle', h('div', null,
    h('div', { class: 'grid' }, h('div', { class: 'field' }, h('label', null, 'Okul kodu'), inp('okulKodu', { disabled: !isNew, autocapitalize: 'none', placeholder: 'Örn: 10001' })), h('div', { class: 'field' }, h('label', null, 'Okul adı'), inp('okulAdi')),
      h('div', { class: 'field' }, h('label', null, 'İl'), il), h('div', { class: 'field' }, h('label', null, 'İlçe'), ilce), h('div', { class: 'field' }, h('label', null, 'Düzey'), tur), h('div', { class: 'field' }, h('label', null, 'Müdür'), inp('mudur')),
      h('div', { class: 'field' }, h('label', null, 'Telefon'), inp('telefon', { type: 'tel' })), h('div', { class: 'field' }, h('label', null, 'E-posta'), inp('eposta', { type: 'email' }))),
    h('div', { class: 'field', style: { marginTop: '.7rem' } }, h('label', null, 'Adres'), inp('adres')), ilList, ilceList, err,
    !isNew ? h('p', { class: 'small muted' }, 'Okul kodu değiştirilemez (öğrenci, kullanıcı ve sonuçlar bu koda bağlıdır).') : null), {
    buttons: [{ label: 'Vazgeç' }, { label: 'Kaydet', cls: 'primary', fn: async () => {
      clear(err); try { await api('saveSchool', { okulKodu: f.okulKodu, okulAdi: f.okulAdi, il: f.il, ilce: f.ilce, tur: f.tur, mudur: f.mudur, telefon: f.telefon, eposta: f.eposta, adres: f.adres, yeni: isNew }); await refreshBase(); toast(isNew ? 'Okul eklendi' : 'Okul güncellendi', 'ok'); onDone && onDone(); }
      catch (e) { err.append(h('div', { class: 'alert bad' }, e.message)); return false; }
    } }] });
}
async function deleteSchool(sch, onDone) {
  const n = (await getStudents(sch.okulKodu)).length;
  if (!(await confirmBox(`"${sch.okulAdi}" (${sch.okulKodu}) okulu${n ? ` ve ${n} öğrencilik listesi` : ''} silinsin mi? Daha önce okutulan sınav sonuçları silinmez ama okul adı yerine kodu görünür. Bu işlem geri alınamaz.`, 'Okulu sil', true))) return;
  try { const r = await api('deleteSchool', { okulKodu: sch.okulKodu }); await DB.del('kv', 'students:' + sch.okulKodu); await refreshBase(); toast(`Okul silindi${r.deletedStudents ? ` (${r.deletedStudents} öğrenci)` : ''}`, 'ok'); onDone && onDone(); }
  catch (e) { toast(e.message, 'bad', 9000); }
}

/* ---- öğrenci ekle / düzenle / sil */
function studentForm(code, stu, onDone) {
  const isNew = !stu, f = Object.assign({ ogrNo: '', ad: '', soyad: '', sinif: '', anneTel: '', babaTel: '' }, stu || {}), err = h('div'), hasTel = isNew || stu.anneTel !== undefined;
  f.anneTel = telShow(f.anneTel); f.babaTel = telShow(f.babaTel);
  const inp = (k, label, extra) => h('div', { class: 'field' }, h('label', null, label), h('input', Object.assign({ type: 'text', id: 'st-f-' + k, value: f[k] || '', oninput: e => { f[k] = e.target.value; } }, extra || {})));
  modal(isNew ? 'Öğrenci ekle' : 'Öğrenciyi düzenle', h('div', null, h('div', { class: 'grid' }, inp('ogrNo', 'Okul numarası', { inputmode: 'numeric', autocomplete: 'off' }), inp('sinif', 'Sınıf / şube', { placeholder: '8-A' }), inp('ad', 'Ad'), inp('soyad', 'Soyad')),
    hasTel ? h('div', { class: 'grid', style: { marginTop: '.6rem' } }, inp('anneTel', 'Anne telefonu (WhatsApp)', { type: 'tel', placeholder: '0532 111 22 33', autocomplete: 'off' }), inp('babaTel', 'Baba telefonu (WhatsApp)', { type: 'tel', placeholder: '0533 222 33 44', autocomplete: 'off' })) : h('p', { class: 'small muted' }, 'Veli telefonları şu an çevrim dışı olduğu için gösterilmiyor; kaydederseniz mevcut telefonlar korunur.'),
    hasTel ? h('p', { class: 'small muted' }, 'Yalnızca cep telefonu (05xx…). Yurt dışı numara için +ülke kodu yazın. Boş bırakırsanız numara silinir. Telefonlar yalnızca okul yöneticisi ve üst yetkililerce görülür.') : null, err,
    !isNew ? h('p', { class: 'small muted' }, 'Numarayı değiştirirseniz bu öğrencinin daha önceki sınav sonuçları eski numarada kalır.') : null), {
    buttons: [{ label: 'Vazgeç' }, { label: 'Kaydet', cls: 'primary', fn: async () => {
      clear(err); try { await api('saveStudent', Object.assign({ okulKodu: code, ogrNo: f.ogrNo, ad: f.ad, soyad: f.soyad, sinif: f.sinif, yeni: isNew, eskiNo: isNew ? undefined : stu.ogrNo }, hasTel ? { anneTel: f.anneTel, babaTel: f.babaTel } : {})); toast(isNew ? 'Öğrenci eklendi' : 'Öğrenci güncellendi', 'ok'); onDone && onDone(); }
      catch (e) { err.append(h('div', { class: 'alert bad' }, e.message)); return false; }
    } }] });
}
/** Seçmeli öğrenci tablosu: arama, sınıf süzgeci, tekli/çoklu silme. onChange: liste değişince yeniden yükleme. */
function studentManager(code, students, onChange) {
  const box = h('div'), q = h('input', { type: 'search', id: 'st-q', placeholder: 'Ad, soyad veya numara ara…' }), cls = h('select', { id: 'st-cls' }, h('option', { value: '' }, 'Tüm sınıflar'), ...Array.from(new Set(students.map(x => x.sinif).filter(Boolean))).sort((a, b) => String(a).localeCompare(String(b), 'tr', { numeric: true })).map(c => h('option', { value: c }, c)));
  const telCol = students.some(x => x.anneTel !== undefined), sel = new Set(), holder = h('div'), delBtn = h('button', { class: 'btn danger', id: 'st-del-sel', disabled: true }, 'Seçilenleri sil'), info = h('span', { class: 'small muted' });
  const view = () => { const t = deTR(q.value); return students.filter(x => (!cls.value || x.sinif === cls.value) && (!t || deTR(x.ad + x.soyad + x.ogrNo).includes(t))).sort((a, b) => String(a.sinif || '').localeCompare(String(b.sinif || ''), 'tr', { numeric: true }) || String(a.ogrNo).localeCompare(String(b.ogrNo), undefined, { numeric: true })); };
  const sync = () => { delBtn.disabled = !sel.size; delBtn.textContent = sel.size ? `Seçilenleri sil (${sel.size})` : 'Seçilenleri sil'; };
  function paint() {
    const list = view(), shown = list.slice(0, 500), all = h('input', { type: 'checkbox', id: 'st-all', 'aria-label': 'Görünenlerin hepsini seç', checked: shown.length > 0 && shown.every(x => sel.has(x.ogrNo)), onchange: e => { shown.forEach(x => e.target.checked ? sel.add(x.ogrNo) : sel.delete(x.ogrNo)); paint(); } });
    info.textContent = `${list.length} öğrenci${list.length > shown.length ? ` (ilk ${shown.length} gösteriliyor)` : ''}`;
    clear(holder).append(h('div', { class: 'tablewrap' }, h('table', null, h('thead', null, h('tr', null, h('th', null, all), h('th', null, 'No'), h('th', null, 'Ad'), h('th', null, 'Soyad'), h('th', null, 'Sınıf'), telCol ? h('th', null, 'Veli tel.') : null, h('th', null, ''))),
      h('tbody', null, shown.map(x => h('tr', { 'data-no': x.ogrNo }, h('td', null, h('input', { type: 'checkbox', class: 'st-chk', 'aria-label': `${x.ad} ${x.soyad} seç`, checked: sel.has(x.ogrNo), onchange: e => { e.target.checked ? sel.add(x.ogrNo) : sel.delete(x.ogrNo); sync(); } })), h('td', null, x.ogrNo), h('td', null, x.ad), h('td', null, x.soyad), h('td', null, x.sinif), telCol ? h('td', null, telChips(x)) : null,
        h('td', { class: 'right nowrap' }, h('button', { class: 'btn sm', 'data-act': 'edit', onclick: () => studentForm(code, x, onChange) }, 'Düzenle'), ' ', h('button', { class: 'btn sm danger', 'data-act': 'del', onclick: () => removeStudents([x]) }, 'Sil'))))))), !shown.length ? h('p', { class: 'muted small' }, students.length ? 'Eşleşen öğrenci yok.' : 'Bu okulda öğrenci yok. Yukarıdan ekleyin veya listeyi yapıştırın.') : null);
    sync();
  }
  async function removeStudents(list) {
    if (!list.length) return;
    const msg = list.length === 1 ? `${list[0].ad} ${list[0].soyad} (${list[0].ogrNo}) silinsin mi?` : `Seçilen ${list.length} öğrenci silinsin mi?`;
    if (!(await confirmBox(msg + ' Daha önceki sınav sonuçları silinmez.', 'Sil', true))) return;
    try { const r = await api('deleteStudents', { okulKodu: code, ogrNolar: list.map(x => x.ogrNo) }); toast(`${r.deleted} öğrenci silindi`, 'ok'); onChange && onChange(); }
    catch (e) { toast(e.message, 'bad'); }
  }
  delBtn.addEventListener('click', () => removeStudents(students.filter(x => sel.has(x.ogrNo))));
  q.addEventListener('input', paint); cls.addEventListener('change', paint);
  box.append(h('div', { class: 'row', style: { marginBottom: '.5rem' } }, q, cls, delBtn, info), holder); paint(); return box;
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


/* ------------------------------------------------------------------ yapay zekâ ayarları (yalnızca sistem yöneticisi)
 * Anahtarlar yalnızca sunucuda (Apps Script Betik Özellikleri) durur: bu ekran onları yazar ama geri okuyamaz (maskeli ipucu görünür).
 * Model alanı boşsa sunucu sağlayıcının güncel model listesini çeker ve seçilen seviyenin (hızlı / dengeli / en yetenekli) en yeni modelini kullanır. */
/** OpenAI uyumlu, ücretsiz katmanı olan hizmetler için hazır doldurma (model adları değişebilir; "Dene" ile doğrulanır). */
const COMPAT_PRESETS = [
  { id: 'groq', name: 'Groq', url: 'https://api.groq.com/openai/v1', model: 'qwen/qwen3.8-27b', tip: 'console.groq.com: ücretsiz anahtar, dakikalık/günlük sınırlı' },
  { id: 'openrouter', name: 'OpenRouter', url: 'https://openrouter.ai/api/v1', model: 'openrouter/free', tip: 'openrouter.ai: ücretsiz modeller yönlendirici; günlük istek sınırı düşük' },
  { id: 'mistral', name: 'Mistral', url: 'https://api.mistral.ai/v1', model: 'mistral-small-latest', tip: 'console.mistral.ai: ücretsiz "Experiment" katmanı' }
];
function aiTab(pane) {
  const box = h('div', { id: 'ai-box' }); pane.append(box);
  const TIER_L = { auto: 'Otomatik (dengeli)', fast: 'Hızlı', balanced: 'Dengeli', best: 'En yetenekli' }, SRC_L = { list: 'sağlayıcının güncel model listesi', default: 'yerleşik varsayılan (liste alınamadı)', manual: 'elle girilmiş model', none: '' };
  let st = null, d = null;
  const fresh = s0 => ({ provider: s0.config.provider || 'auto', tier: s0.config.tier || 'auto', keys: {}, clear: [], models: Object.assign({}, s0.config.models), compatUrl: s0.config.compatUrl || '', compatName: s0.config.compatName || '' });
  async function load(refresh) {
    clear(box).append(h('p', { class: 'muted' }, refresh ? 'Sağlayıcıların model listeleri yeniden taranıyor…' : 'Yükleniyor…'));
    try { st = await api('aiStatus', refresh ? { refresh: true } : {}); d = fresh(st); draw(); } catch (e) { clear(box).append(h('div', { class: 'alert bad' }, e.message)); }
  }
  const field = (label, input, hint) => h('div', { class: 'field' }, h('label', null, label), input, hint ? h('div', { class: 'small muted' }, hint) : null);
  const select = (id, opts, val, on) => { const el = h('select', { id, onchange: e => on(e.target.value) }, opts.map(([v, l]) => h('option', { value: v }, l))); el.value = val; return el; };
  function provCard(o) {
    const isC = o.id === 'compat', hint = st.config.keys[o.id], out = h('div', { id: 'ai-test-out-' + o.id }), cleared = d.clear.includes(o.id);
    const keyIn = h('input', { type: 'password', id: 'ai-key-' + o.id, autocomplete: 'new-password', spellcheck: false, placeholder: hint && !cleared ? 'Kayıtlı anahtarı değiştirmek için yenisini yapıştırın' : 'API anahtarını yapıştırın', oninput: e => { d.keys[o.id] = e.target.value; } });
    const mdl = h('input', { type: 'text', id: 'ai-model-' + o.id, value: d.models[o.id] || '', placeholder: isC ? 'Zorunlu: model adı' : 'otomatik (en yeni)', autocomplete: 'off', oninput: e => { d.models[o.id] = e.target.value.trim(); } });
    const testBtn = h('button', { class: 'btn sm', id: 'ai-test-' + o.id, onclick: async ev => {
      const b = ev.currentTarget; b.disabled = true; clear(out).append(h('span', { class: 'muted small' }, 'Deneniyor…'));
      try { const r = await api('aiTest', { provider: o.id, tier: d.tier, model: d.models[o.id] || undefined }, { timeout: 120000 }); clear(out).append(h('div', { class: 'alert ok' }, `Çalışıyor: ${r.providerName} · ${r.model} · ${r.ms} ms${r.tried && r.tried.length > 1 ? ` (${r.tried.length - 1} yedek denendi)` : ''}`)); }
      catch (e) { clear(out).append(h('div', { class: 'alert bad' }, e.message)); }
      b.disabled = false;
    } }, 'Dene');
    return h('div', { class: 'card', 'data-prov': o.id },
      h('div', { class: 'row between' }, h('h3', { style: { margin: 0 } }, o.name), h('span', { class: 'pill ' + (o.ok && !cleared ? 'ok' : 'warn') }, o.ok && !cleared ? 'hazır' : isC && o.hasKey ? 'adres/model eksik' : 'anahtar yok')),
      h('div', { class: 'grid', style: { marginTop: '.5rem' } },
        field('API anahtarı' + (hint ? ` (kayıtlı: ${hint})` : ''), keyIn, 'Yalnızca sunucuya yazılır; bir daha gösterilmez.'),
        field(isC ? 'Model adı' : 'Model (isteğe bağlı)', mdl, isC ? '' : 'Boş = en yeni model kendiliğinden seçilir. Belirli bir modele kilitlemek için adını yazın.')),
      isC ? h('div', { class: 'grid' }, field('Hizmet adresi', h('input', { type: 'text', id: 'ai-compat-url', value: d.compatUrl, placeholder: 'https://…/v1', oninput: e => { d.compatUrl = e.target.value.trim(); } }), 'OpenAI uyumlu /chat/completions sunan hizmetin taban adresi (https).'), field('Görünen ad', h('input', { type: 'text', id: 'ai-compat-name', value: d.compatName, placeholder: 'örn: Groq', oninput: e => { d.compatName = e.target.value; } }))) : null,
      isC ? h('div', { class: 'small', style: { marginTop: '.3rem' } }, h('span', { class: 'muted' }, 'Ücretsiz katmanı olan hizmetler için hazır doldur: '), ...COMPAT_PRESETS.map(pr => h('button', { class: 'btn sm', id: 'ai-preset-' + pr.id, type: 'button', title: pr.tip, style: { marginRight: '.25rem' }, onclick: () => { d.compatUrl = pr.url; d.compatName = pr.name; d.models.compat = pr.model; draw(); } }, pr.name)), h('div', { class: 'muted' }, 'Anahtarı hizmetin sitesinden ücretsiz alıp yukarıya yapıştırın. Ücretsiz katman sınırları ve model adları sık değişir; görüntü destekleyen güncel bir model adını hizmetin model sayfasından kontrol edin (Dene düğmesi çalışıp çalışmadığını gösterir). Ücretsiz katmanlarda gönderilen veri sağlayıcı tarafından kaydedilebilir; yalnızca boş form görüntüsü gider, öğrenci bilgisi gitmez.')) : null,
      o.ok ? h('div', { class: 'small', style: { marginTop: '.4rem' } }, h('b', null, 'Seçilen modeller: '), ['fast', 'balanced', 'best'].map(t => `${TIER_L[t]}: ${o.models[t] || '—'}`).join(' · '), o.source !== 'none' ? h('span', { class: 'muted' }, ` — kaynak: ${SRC_L[o.source] || o.source}`) : null) : null,
      o.ok && o.listError ? h('div', { class: 'small', style: { color: 'var(--warn)' } }, 'Model listesi alınamadı: ' + o.listError) : null,
      h('div', { class: 'row', style: { marginTop: '.5rem' } }, o.ok ? testBtn : null, hint && !cleared ? h('button', { class: 'btn sm danger', id: 'ai-clear-' + o.id, onclick: () => { d.clear.push(o.id); delete d.keys[o.id]; draw(); } }, 'Anahtarı sil') : null, cleared ? h('span', { class: 'small', style: { color: 'var(--warn)' } }, 'Kaydedince anahtar silinir.') : null), out);
  }
  async function save(btn) {
    btn.disabled = true;
    try {
      const keys = {}; Object.keys(d.keys).forEach(k => { if (d.keys[k].trim()) keys[k] = d.keys[k].trim(); });
      const clearKeys = d.clear.filter(k => !keys[k]), models = {}; st.providers.forEach(o => { models[o.id] = d.models[o.id] || ''; });
      st = await api('aiSaveConfig', { provider: d.provider, tier: d.tier, models, keys, clearKeys, compatUrl: d.compatUrl, compatName: d.compatName }, { timeout: 120000 }); d = fresh(st); toast('Yapay zekâ ayarları kaydedildi', 'ok'); draw();
    } catch (e) { toast(e.message, 'bad', 8000); btn.disabled = false; }
  }
  function draw() {
    clear(box); const ready = st.providers.filter(o => o.ok).length;
    box.append(h('div', { class: 'card' }, h('h2', null, 'Yapay zekâ ayarları'),
      h('p', { class: 'small muted', style: { marginTop: 0 } }, 'Harici form tanıtılırken yapay zekâ yalnızca ders adı, şık harfleri ve blok türü önerir; baloncukların konumunu hesaplamaz (konum, görüntü işlemeyle milimetrik bulunur). Anahtar eklemek zorunlu değildir. Birden fazla sağlayıcı ekleyebilirsiniz: biri yanıt vermezse sıradakine geçilir. Model alanı boş bırakılırsa sunucu her seferinde (6 saatlik önbellekle) sağlayıcının güncel model listesini okur ve en yeni sürümü seçer; yeni model çıkınca ayar değiştirmeniz gerekmez.'),
      h('div', { class: 'grid' },
        field('Öncelikli sağlayıcı', select('ai-provider', [['auto', 'Otomatik (hazır olan ilk)']].concat(st.providers.map(o => [o.id, o.name])), d.provider, v => { d.provider = v; })),
        field('Hız ↔ yetenek', select('ai-tier', [['auto', TIER_L.auto], ['fast', 'Hızlı (en ucuz, en az bekleme)'], ['balanced', 'Dengeli'], ['best', 'En yetenekli (en yavaş)']], d.tier, v => { d.tier = v; }), 'Kullanıcılar ekranda kendi seçimlerini de yapabilir; seçmezlerse bu ayar kullanılır.')),
      h('div', { class: 'row', style: { marginTop: '.4rem' } }, h('button', { class: 'btn primary', id: 'ai-save', onclick: ev => save(ev.currentTarget) }, 'Kaydet'), h('button', { class: 'btn', id: 'ai-refresh', onclick: () => load(true) }, 'Modelleri yeniden tara'), h('span', { class: 'small muted' }, `${ready} sağlayıcı hazır`))),
      ...st.providers.map(provCard));
  }
  load(false);
}
