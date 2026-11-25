/**
 * SIRAÇ AKSAN OPTİK OKUMA — Google Apps Script arka ucu (Sheets = veri tabanı)
 * Telif Hakkı © Sıraç AKSAN — İzinsiz kopyalamak, dağıtmak veya telif atmak ayıptır.
 *
 * Kurulum özeti (ayrıntı README.md'de):
 *  1) Yeni bir Google E-Tablo açın → Uzantılar → Apps Script.
 *  2) Code.gs, Scoring.gs ve appsscript.json içeriklerini yapıştırın.
 *  3) E-Tabloyu yenileyin → "Optik Sistem" menüsü → 1) Kurulum, 2) Yönetici oluştur.
 *  4) Dağıt → Yeni dağıtım → Web uygulaması: "Çalıştıran: Ben", "Erişim: Herkes".
 *  5) /exec ile biten adresi PWA'ya girin.
 */

// Sütunlar yalnızca SONA eklenir: mevcut E-Tablo, kurulum/ilk istekte kendiliğinden güncellenir (ensureSchema_).
var HEADERS = {
  Users: ['username', 'name', 'role', 'il', 'ilce', 'okulKodu', 'salt', 'hash', 'active', 'brans', 'telefon', 'eposta', 'createdBy', 'createdAt'],
  Schools: ['okulKodu', 'okulAdi', 'il', 'ilce', 'tur', 'mudur', 'telefon', 'eposta', 'adres'],
  Students: ['okulKodu', 'ogrNo', 'ad', 'soyad', 'sinif', 'veliKodu', 'anneTel', 'babaTel'],
  Exams: ['examId', 'name', 'date', 'owner', 'scopeType', 'scopeValue', 'status', 'config', 'createdAt', 'ownerRole'],
  Templates: ['templateId', 'name', 'owner', 'json'],
  Gonderim: ['key', 'examId', 'okulKodu', 'ogrNo', 'kime', 'zaman', 'kullanici', 'durum', 'hataKodu', 'hataMesaj'],
  VeliHesap: ['email', 'telefon', 'okulKodu', 'ogrNo', 'salt', 'hash', 'ad', 'createdAt'],
  DisSinav: ['examId', 'name', 'date', 'kaynak', 'okulKodu', 'owner', 'ownerRole', 'config', 'createdAt'],
  DisSonuc: ['key', 'examId', 'ogrNo', 'ad', 'sinif', 'data', 'updatedAt'],
  Basvurular: ['id', 'tur', 'durum', 'username', 'name', 'il', 'ilce', 'okulKodu', 'okulAdi', 'duzey', 'mudur', 'telefon', 'eposta', 'adres', 'brans', 'salt', 'hash', 'createdAt', 'decidedBy', 'decidedAt', 'not']
};
var RESULT_HEADERS = ['key', 'examId', 'okulKodu', 'ogrNo', 'booklet', 'answers', 'secStats', 'D', 'Y', 'B', 'net', 'flags', 'scannedAt', 'submittedBy', 'updatedAt'];
var RESULT_TEXT_COLS = [1, 3, 4, 5, 6];
// Metin olarak saklanacak alanlar (baştaki sıfırlar, telefon, tarih/saat metni E-Tablo tarafından dönüştürülmesin)
var TEXT_FIELDS = ['username', 'okulKodu', 'ogrNo', 'sinif', 'salt', 'hash', 'examId', 'scopeType', 'scopeValue', 'templateId', 'telefon', 'id', 'date', 'createdAt', 'decidedAt', 'veliKodu', 'anneTel', 'babaTel', 'key', 'kime', 'zaman', 'kullanici'];
var TEXT_COLS = {};
Object.keys(HEADERS).forEach(function (n) { TEXT_COLS[n] = []; HEADERS[n].forEach(function (c, i) { if (TEXT_FIELDS.indexOf(c) >= 0) TEXT_COLS[n].push(i + 1); }); });
var ROLES = ['admin', 'il', 'ilce', 'okul', 'ogretmen'];
var SCHEMA_VERSION = '7-veli-wa';
var TOKEN_DAYS = 14;
var PBKDF_ROUNDS = 300;
var MEM_ = {};
// Herkese açık kayıt (öğretmen / okul) kötüye kullanım sınırları
var REG_PER_HOUR = 120, REG_PER_USER_HOUR = 20, MAX_PENDING = 300, MAX_PENDING_SCHOOL = 50, MAX_TEACHER_EXAMS = 150;
var DUZEYLER = ['Okul öncesi', 'İlkokul', 'Ortaokul', 'Lise', 'Diğer'];
var IL_LISTESI = ['Adana', 'Adıyaman', 'Afyonkarahisar', 'Ağrı', 'Aksaray', 'Amasya', 'Ankara', 'Antalya', 'Ardahan', 'Artvin', 'Aydın', 'Balıkesir', 'Bartın', 'Batman', 'Bayburt', 'Bilecik', 'Bingöl', 'Bitlis', 'Bolu', 'Burdur', 'Bursa',
  'Çanakkale', 'Çankırı', 'Çorum', 'Denizli', 'Diyarbakır', 'Düzce', 'Edirne', 'Elazığ', 'Erzincan', 'Erzurum', 'Eskişehir', 'Gaziantep', 'Giresun', 'Gümüşhane', 'Hakkari', 'Hatay', 'Iğdır', 'Isparta', 'İstanbul', 'İzmir', 'Kahramanmaraş', 'Karabük', 'Karaman', 'Kars',
  'Kastamonu', 'Kayseri', 'Kırıkkale', 'Kırklareli', 'Kırşehir', 'Kilis', 'Kocaeli', 'Konya', 'Kütahya', 'Malatya', 'Manisa', 'Mardin', 'Mersin', 'Muğla', 'Muş', 'Nevşehir', 'Niğde', 'Ordu', 'Osmaniye', 'Rize', 'Sakarya', 'Samsun', 'Siirt', 'Sinop', 'Sivas',
  'Şanlıurfa', 'Şırnak', 'Tekirdağ', 'Tokat', 'Trabzon', 'Tunceli', 'Uşak', 'Van', 'Yalova', 'Yozgat', 'Zonguldak'];

/* ============================ MENÜ / KURULUM ============================ */

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Sıraç Aksan Optik Okuma')
    .addItem('1) Kurulumu çalıştır', 'setup')
    .addItem('2) Yönetici oluştur', 'createAdminPrompt')
    .addItem('3) Demo veri yükle (isteğe bağlı)', 'seedDemo')
    .addItem('Web adresi nasıl alınır?', 'howToDeploy')
    .addToUi();
}

function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var props = PropertiesService.getScriptProperties();
  props.setProperty('SS_ID', ss.getId());
  if (!props.getProperty('SECRET')) props.setProperty('SECRET', Utilities.getUuid() + Utilities.getUuid());
  MEM_ = {};
  ensureSchema_();
  var msg = 'Kurulum tamam. Şimdi "2) Yönetici oluştur" menüsünü çalıştırın.';
  try { SpreadsheetApp.getUi().alert(msg); } catch (e) { Logger.log(msg); }
}

/** Sayfaları ve başlık satırlarını güncel şemaya getirir. Veri silmez; yalnızca eksik sayfa/sütun ekler.
 *  Kod güncellenip yeni sürüm dağıtıldığında ilk istekte kendiliğinden çalışır. */
function ensureSchema_() {
  var props = PropertiesService.getScriptProperties();
  if (!props.getProperty('SS_ID')) return;
  var ss = ss_();
  Object.keys(HEADERS).forEach(function (name) {
    var h = HEADERS[name], sh = ss.getSheetByName(name) || ss.insertSheet(name);
    if (sh.getMaxColumns() < h.length) sh.insertColumnsAfter(sh.getMaxColumns(), h.length - sh.getMaxColumns());
    var cur = sh.getRange(1, 1, 1, h.length).getValues()[0];
    if (cur.join('|') !== h.join('|')) sh.getRange(1, 1, 1, h.length).setValues([h]).setFontWeight('bold').setBackground('#e8f0fe');
    (TEXT_COLS[name] || []).forEach(function (c) { sh.getRange(2, c, Math.max(1, sh.getMaxRows() - 1), 1).setNumberFormat('@'); });   // sürüm değişiminde bir kez: numara/kod/sınıf metin kalsın
    sh.setFrozenRows(1);
  });
  props.setProperty('SCHEMA', SCHEMA_VERSION);
  MEM_ = { ss: MEM_.ss };
}

function createAdminPrompt() {
  var ui = SpreadsheetApp.getUi();
  var u = ui.prompt('Yönetici kullanıcı adı', 'Örn: admin', ui.ButtonSet.OK_CANCEL);
  if (u.getSelectedButton() !== ui.Button.OK) return;
  var p = ui.prompt('Yönetici parolası', 'En az 8 karakter. (E-Tabloda saklanmaz, yalnızca özeti saklanır.)', ui.ButtonSet.OK_CANCEL);
  if (p.getSelectedButton() !== ui.Button.OK) return;
  createUser_({ username: u.getResponseText(), name: 'Yönetici', role: 'admin', password: p.getResponseText(), active: true });
  ui.alert('Yönetici oluşturuldu: ' + u.getResponseText().trim().toLowerCase());
}

function howToDeploy() {
  SpreadsheetApp.getUi().alert('Dağıt → Yeni dağıtım → Tür: Web uygulaması\nÇalıştıran: Ben\nErişimi olan: Herkes\n\n"Dağıt" dedikten sonra çıkan ve /exec ile biten adresi PWA ayarlarına yapıştırın.\nKodu değiştirirseniz: Dağıt → Dağıtımları yönet → Düzenle → Yeni sürüm.');
}

/* ============================ HTTP GİRİŞ NOKTALARI ============================ */

function doGet() { return json_({ ok: true, service: 'sirac-aksan-optik-okuma', appName: 'Sıraç Aksan Optik Okuma', copyright: 'Telif Hakkı © Sıraç AKSAN — İzinsiz kopyalamak, dağıtmak veya telif atmak ayıptır.', time: new Date().toISOString() }); }

function doPost(e) {
  var out;
  try {
    var req = JSON.parse(e.postData.contents || '{}');
    var a = ACTIONS[req.action];
    if (!a) throw new Error('Bilinmeyen işlem: ' + req.action);
    var ps = PropertiesService.getScriptProperties();
    if (ps.getProperty('SS_ID') && ps.getProperty('SCHEMA') !== SCHEMA_VERSION) withLock_(ensureSchema_);   // kod güncellendiyse sayfa/sütunları tamamla
    var user = null;
    if (!a.open) user = authUser_(req.token);
    if (a.pre) a.pre(req);   // kilide girmeden önce hız sınırı
    var run = function () { return a.fn(user, req); };
    var data = a.write ? withLock_(run) : run();
    out = { ok: true, data: data };
  } catch (err) {
    out = { ok: false, error: String(err && err.message || err), code: err && err.code || '' };
  }
  return json_(out);
}

function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function withLock_(fn) {
  var lock = LockService.getScriptLock(); lock.waitLock(25000);
  try { var r = fn(); SpreadsheetApp.flush(); return r; } finally { lock.releaseLock(); }
}
function fail_(msg, code) { var e = new Error(msg); e.code = code || ''; return e; }

/* ============================ SHEETS YARDIMCILARI ============================ */

function ss_() {
  if (MEM_.ss) return MEM_.ss;
  var id = PropertiesService.getScriptProperties().getProperty('SS_ID');
  if (!id) throw fail_('Kurulum yapılmamış (Optik Sistem → Kurulum).');
  return (MEM_.ss = SpreadsheetApp.openById(id));
}
function sheet_(name) { var s = ss_().getSheetByName(name); if (!s) throw fail_('Sayfa yok: ' + name + ' (Kurulum çalıştırın)'); return s; }
function objs_(sh, headers) {
  var last = sh.getLastRow(); if (last < 2) return [];
  var vals = sh.getRange(2, 1, last - 1, headers.length).getValues(), out = [];
  for (var i = 0; i < vals.length; i++) {
    var o = { _r: i + 2 }, empty = true;
    for (var c = 0; c < headers.length; c++) { var v = vals[i][c]; o[headers[c]] = (v === null || v === undefined) ? '' : v; if (v !== '' && v !== null) empty = false; }
    if (!empty) out.push(o);
  }
  return out;
}
function table_(name) { if (!MEM_[name]) MEM_[name] = objs_(sheet_(name), HEADERS[name]); return MEM_[name]; }
function dirty_(name) { delete MEM_[name]; }
/** Yeni E-Tablo sayfası 1000 satırla gelir; yazmadan önce gerekirse satır ekler (aksi halde "aralık sayfa dışında" hatası olur). */
function ensureRows_(sh, lastNeeded) {
  var max = sh.getMaxRows();
  if (lastNeeded > max) sh.insertRowsAfter(max, Math.max(lastNeeded - max, 500));
}
function writeRows_(sh, rows, textCols) {
  var start = Math.max(2, sh.getLastRow() + 1);
  ensureRows_(sh, start + rows.length - 1);
  (textCols || []).forEach(function (c) { sh.getRange(start, c, rows.length, 1).setNumberFormat('@'); });   // numara/kodlar metin kalsın (baştaki sıfırlar)
  sh.getRange(start, 1, rows.length, rows[0].length).setValues(rows);
}
function append_(name, list) {
  if (!list.length) return;
  var sh = sheet_(name), h = HEADERS[name];
  var rows = list.map(function (o) { return h.map(function (k) { return o[k] === undefined ? '' : o[k]; }); });
  writeRows_(sh, rows, TEXT_COLS[name]);
  dirty_(name);
}
function updateRow_(name, o) {
  var sh = sheet_(name), h = HEADERS[name];
  sh.getRange(o._r, 1, 1, h.length).setValues([h.map(function (k) { return o[k] === undefined ? '' : o[k]; })]);
  dirty_(name);
}
function deleteRow_(name, o) { sheet_(name).deleteRow(o._r); dirty_(name); }
function str_(v) { return String(v === undefined || v === null ? '' : v).trim(); }
function normNo_(v) { var s = str_(v); return /^\d+$/.test(s) ? s.replace(/^0+(?=\d)/, '') : s; }
function normCode_(v) { return str_(v); }
function now_() { return new Date().toISOString(); }
function newId_(p) { return p + Utilities.getUuid().replace(/-/g, '').slice(0, 10); }

/* ---- metin yardımcıları (herkese açık formlardan gelen veri için) ---- */
function trLower_(s) { return String(s).replace(/İ/g, 'i').replace(/I/g, 'ı').toLowerCase(); }
function trUpper_(s) { return String(s).replace(/i/g, 'İ').replace(/ı/g, 'I').toUpperCase(); }
/** İl/ilçe karşılaştırma anahtarı: büyük-küçük harf, Türkçe karakter ve boşluk farkını yok sayar */
function trKey_(s) { return trLower_(s).replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ş/g, 's').replace(/ü/g, 'u').replace(/[^a-z0-9]/g, ''); }
function titleTr_(s) { return str_(s).split(/(\s+|-)/).map(function (w) { return /^(\s+|-)$/.test(w) || !w ? w : trUpper_(w.charAt(0)) + trLower_(w.slice(1)); }).join(''); }
/** Serbest metin: kontrol karakterlerini ve baştaki formül işaretlerini (= + - @) temizler, uzunluğu sınırlar (E-Tablo formül enjeksiyonu) */
function clean_(v, max) {
  var s = str_(v).replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim();
  while (s && '=+-@\'"'.indexOf(s.charAt(0)) >= 0) s = s.slice(1).trim();
  return s.slice(0, max || 120);
}
/** Telefon → WhatsApp biçimi (yalnızca rakam, ülke kodlu): 0532 111 22 33 → 905321112233. Yurt dışı için + ya da 00 ile başlayın. Boş → ''. */
function telNorm_(v, label) {
  var raw = str_(v); if (!raw) return '';
  var intl = /^(\+|00)/.test(raw.replace(/[\s()\-.]/g, '')), d = digits_(raw), nm = label || 'Telefon';
  if (intl) { if (d.indexOf('00') === 0) d = d.slice(2); }
  else if (d.length === 10 && d.charAt(0) === '5') d = '90' + d;
  else if (d.length === 11 && d.charAt(0) === '0') d = '90' + d.slice(1);
  else if (d.length === 12 && d.indexOf('90') === 0) { /* zaten ülke kodlu */ }
  else throw fail_(nm + ' geçersiz: 05xx xxx xx xx biçiminde yazın (yurt dışı numara için +ülke kodu ile).');
  if (d.indexOf('90') === 0) { if (!/^905\d{9}$/.test(d)) throw fail_(nm + ' bir cep telefonu olmalı (05xx xxx xx xx); WhatsApp sabit hatta ulaşmaz.'); }
  else if (!/^[1-9]\d{7,14}$/.test(d)) throw fail_(nm + ' geçersiz.');
  return d;
}
function digits_(v) { return String(v === undefined || v === null ? '' : v).replace(/\D/g, ''); }
function validEmail_(v) { return /^[^\s@<>]{1,64}@[^\s@<>]{1,200}\.[^\s@<>]{2,}$/.test(v) && v.length <= 120; }
function dateStr_(v) {   // E-Tablo tarih hücresine çevirdiyse geri metne çevir
  if (v && typeof v.getTime === 'function') { var d = new Date(v.getTime()); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  return str_(v).slice(0, 10);
}
/** Basit hız sınırı (CacheService, sabit pencere). IP bilgisi Apps Script'te yoktur; sınır genel ve kullanıcı adı başınadır. */
function throttle_(key, limit, ttl, msg) {
  var c = CacheService.getScriptCache(), n = Number(c.get(key) || 0);
  if (n >= limit) throw fail_(msg || 'Çok fazla kayıt denemesi yapıldı. Lütfen bir süre sonra tekrar deneyin.', 'THROTTLE');
  c.put(key, String(n + 1), ttl || 3600);
}
function hourKey_() { return new Date().toISOString().slice(0, 13); }

function resultsSheet_(examId, createIfMissing) {
  var name = 'R_' + examId, sh = ss_().getSheetByName(name);
  if (!sh && createIfMissing) {
    sh = ss_().insertSheet(name);
    sh.getRange(1, 1, 1, RESULT_HEADERS.length).setValues([RESULT_HEADERS]).setFontWeight('bold').setBackground('#e6f4ea');
    sh.setFrozenRows(1);
    [1, 3, 4, 5, 6].forEach(function (c) { sh.getRange(2, c, Math.max(1, sh.getMaxRows() - 1), 1).setNumberFormat('@'); });
  }
  return sh;
}

/* ============================ KİMLİK DOĞRULAMA ============================ */

function b64_(bytes) { return Utilities.base64Encode(bytes); }
function hashPass_(salt, pass) {
  var h = salt + ':' + pass;
  for (var i = 0; i < PBKDF_ROUNDS; i++) h = b64_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, h + salt, Utilities.Charset.UTF_8));
  return h;
}
function secret_() { return PropertiesService.getScriptProperties().getProperty('SECRET'); }
function signToken_(username) {
  var p = Utilities.base64EncodeWebSafe(JSON.stringify({ u: username, e: Date.now() + TOKEN_DAYS * 86400000 }));
  return p + '.' + Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(p, secret_()));
}
function authUser_(token) {
  if (!token || String(token).indexOf('.') < 0) throw fail_('Oturum yok. Giriş yapın.', 'AUTH');
  var parts = String(token).split('.');
  var sig = Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(parts[0], secret_()));
  if (sig !== parts[1]) throw fail_('Oturum geçersiz.', 'AUTH');
  var pl = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[0])).getDataAsString());
  if (!pl.e || pl.e < Date.now()) throw fail_('Oturum süresi doldu. Yeniden giriş yapın.', 'AUTH');
  var u = findUser_(pl.u);
  if (!u || String(u.active).toLowerCase() === 'false') throw fail_('Kullanıcı pasif veya silinmiş.', 'AUTH');
  return u;
}
function findUser_(username) {
  username = str_(username).toLowerCase();
  var t = table_('Users');
  for (var i = 0; i < t.length; i++) if (str_(t[i].username).toLowerCase() === username) return t[i];
  return null;
}
function publicUser_(u) { return { username: u.username, name: u.name, role: u.role, il: u.il, ilce: u.ilce, okulKodu: String(u.okulKodu || ''), brans: u.brans || '' }; }

/** Kullanıcı oluşturur/günceller. p.salt+p.hash verilirse (onaylanan başvuru) parola yeniden özetlenmez. */
function createUser_(p) {
  var username = str_(p.username).toLowerCase();
  if (!/^[a-z0-9._-]{3,40}$/.test(username)) throw fail_('Kullanıcı adı 3-40 karakter; harf, rakam, . _ - kullanılabilir.');
  if (ROLES.indexOf(p.role) < 0) throw fail_('Geçersiz rol.');
  var existing = findUser_(username), salt = Utilities.getUuid().slice(0, 12);
  var rec = existing || {};
  rec.username = username; rec.name = clean_(p.name, 80) || username; rec.role = p.role; rec.il = str_(p.il); rec.ilce = str_(p.ilce); rec.okulKodu = normCode_(p.okulKodu);
  rec.active = p.active === false ? 'false' : 'true';
  if (p.brans !== undefined) rec.brans = clean_(p.brans, 60);
  if (p.telefon !== undefined) rec.telefon = digits_(p.telefon).slice(0, 15);
  if (p.eposta !== undefined) rec.eposta = clean_(p.eposta, 120);
  if (!existing) { rec.createdBy = str_(p.createdBy); rec.createdAt = now_(); }
  if (p.salt && p.hash) { rec.salt = String(p.salt); rec.hash = String(p.hash); }
  else if (p.password) {
    if (String(p.password).length < (p.role === 'admin' ? 8 : 6)) throw fail_('Parola çok kısa (yönetici ≥ 8, diğer ≥ 6 karakter).');
    if (String(p.password).length > 100) throw fail_('Parola çok uzun.');
    rec.salt = salt; rec.hash = hashPass_(salt, p.password);
  } else if (!existing) throw fail_('Yeni kullanıcı için parola gerekli.');
  if (existing) updateRow_('Users', rec); else append_('Users', [rec]);
  return rec;
}

function aLogin(_, p) {
  var username = str_(p.username).toLowerCase().slice(0, 60), cache = CacheService.getScriptCache(), fk = 'fail_' + username, pass = String(p.password || '');
  if (Number(cache.get(fk) || 0) >= 8) throw fail_('Çok fazla hatalı deneme. 10 dakika sonra tekrar deneyin.');
  var u = findUser_(username), okPass = !!u && hashPass_(String(u.salt), pass) === String(u.hash);
  if (!u || !okPass || String(u.active).toLowerCase() === 'false') {
    var msg = 'Kullanıcı adı veya parola hatalı.', code = '';
    if (u && okPass) { msg = 'Hesabınız pasif. Yöneticinizle iletişime geçin.'; code = 'INACTIVE'; }
    else if (!u) { var ap = applicationStatusMsg_(username, pass); if (ap) { msg = ap; code = 'PENDING'; } }
    if (!code) cache.put(fk, String(Number(cache.get(fk) || 0) + 1), 600);
    throw fail_(msg, code);
  }
  cache.remove(fk);
  return { token: signToken_(u.username), user: publicUser_(u), pending: pendingFor_(u) };
}
/** Kullanıcı henüz oluşmadıysa: parolası eşleşen başvurunun durumunu söyler (parola doğrulanmadan hiçbir bilgi verilmez). */
function applicationStatusMsg_(username, pass) {
  var t = table_('Basvurular');
  for (var i = t.length - 1; i >= 0; i--) {
    if (str_(t[i].username).toLowerCase() !== username || !t[i].hash) continue;
    if (hashPass_(String(t[i].salt), pass) !== String(t[i].hash)) return '';
    if (t[i].durum === 'beklemede') return 'Başvurunuz henüz onaylanmadı. Onaylandığında aynı kullanıcı adı ve parolayla giriş yapabilirsiniz.';
    if (t[i].durum === 'red') return 'Başvurunuz onaylanmadı' + (t[i].not ? ': ' + t[i].not : '.') + ' Gerekirse yeniden başvurabilirsiniz.';
    return '';
  }
  return '';
}
function aMe(user) { return { user: publicUser_(user), pending: pendingFor_(user) }; }
function aChangePassword(user, p) {
  if (hashPass_(String(user.salt), String(p.oldPassword || '')) !== String(user.hash)) throw fail_('Eski parola hatalı.');
  createUser_({ username: user.username, name: user.name, role: user.role, il: user.il, ilce: user.ilce, okulKodu: user.okulKodu, password: p.newPassword, active: true });
  return {};
}

/* ============================ YETKİ KURALLARI ============================ */

/** Okul düzeyi: kayıtta varsa o, yoksa okul adından çıkarılır (Okul öncesi / İlkokul / Ortaokul / Lise / Diğer). */
function schoolTur_(s) {
  var t = str_(s.tur); if (DUZEYLER.indexOf(t) >= 0) return t;
  var n = trLower_(s.okulAdi);
  if (/anaokul|ana okul|anasınıf|kreş/.test(n)) return 'Okul öncesi';
  if (/ilkokul|ilköğretim/.test(n)) return 'İlkokul';
  if (/ortaokul/.test(n)) return 'Ortaokul';
  if (/lise|mesleki|teknik/.test(n)) return 'Lise';
  return 'Diğer';
}
function schoolMap_() {
  if (MEM_.sm) return MEM_.sm;
  var m = {}; table_('Schools').forEach(function (s) { m[String(s.okulKodu)] = { okulKodu: String(s.okulKodu), okulAdi: s.okulAdi, il: s.il, ilce: s.ilce, tur: schoolTur_(s) }; });
  return (MEM_.sm = m);
}
function canSeeSchool_(u, s) {
  if (!s) return false;
  if (u.role === 'admin') return true;
  if (u.role === 'il') return s.il === u.il;
  if (u.role === 'ilce') return s.il === u.il && s.ilce === u.ilce;
  return String(s.okulKodu) === String(u.okulKodu);   // okul ve öğretmen: yalnızca kendi okulu
}
function examCovers_(ex, s) {
  switch (ex.scopeType) {
    case 'genel': return true;
    case 'il': return s.il === ex.scopeValue;
    case 'ilce': return (s.il + '|' + s.ilce) === ex.scopeValue;
    case 'okul': return String(s.okulKodu) === String(ex.scopeValue);
    case 'okullar': {
      var list = String(ex.scopeValue || '').split(',').map(function (x) { return x.trim(); }).filter(Boolean);
      return list.indexOf(String(s.okulKodu)) >= 0;
    }
  }
  return false;
}
/** Öğretmenin kendi sınavı ("kişisel"): yalnızca sahibi, yönetici ve o okulun okul yöneticisi görür.
 *  Aynı okuldaki diğer öğretmenler ile ilçe/il yetkilileri GÖRMEZ. */
function isPersonal_(ex) { return ex.ownerRole === 'ogretmen'; }
function examVisible_(u, ex) {
  if (u.role === 'admin' || ex.owner === u.username) return true;
  if (isPersonal_(ex)) return u.role === 'okul' && String(u.okulKodu) === String(ex.scopeValue);
  var sm = schoolMap_();
  for (var k in sm) if (canSeeSchool_(u, sm[k]) && examCovers_(ex, sm[k])) return true;
  return false;
}
/** Sonuç gönderme/silme: kişisel sınavda yalnızca sahibi (ve yönetici); kurumsal sınavda öğretmen gönderemez (salt okunur). */
function canSubmit_(u, ex) {
  if (u.role === 'admin') return true;
  if (isPersonal_(ex)) return ex.owner === u.username;
  return u.role !== 'ogretmen';
}
function getExam_(id) {
  var t = table_('Exams');
  for (var i = 0; i < t.length; i++) if (String(t[i].examId) === String(id)) return t[i];
  return null;
}
function requireExam_(u, id) {
  var ex = getExam_(id); if (!ex) throw fail_('Sınav bulunamadı.');
  if (!examVisible_(u, ex)) throw fail_('Bu sınava erişim yetkiniz yok.');
  return ex;
}
function userName_(username) {
  if (!MEM_.un) { MEM_.un = {}; table_('Users').forEach(function (x) { MEM_.un[str_(x.username).toLowerCase()] = x.name; }); }
  return MEM_.un[str_(username).toLowerCase()] || username;
}
function examForClient_(u, ex) {
  var cfg = {}; try { cfg = JSON.parse(ex.config || '{}'); } catch (e) { }
  var isOwner = u.role === 'admin' || ex.owner === u.username;
  if (!isOwner && cfg.showKeys === false) cfg.keys = {};
  return { examId: ex.examId, name: ex.name, date: dateStr_(ex.date), owner: ex.owner, ownerName: userName_(ex.owner), personal: isPersonal_(ex), scopeType: ex.scopeType, scopeValue: ex.scopeValue, status: ex.status, config: cfg, canEdit: isOwner, canScan: canSubmit_(u, ex) };
}

/** Kullanıcı yönetimi yetkisi. x: mevcut kullanıcı kaydı ya da {role, il, ilce, okulKodu}.
 *  admin: herkes · il: kendi ilindeki ilçe/okul/öğretmen · ilçe: kendi ilçesindeki okul/öğretmen · okul: kendi okulunun öğretmenleri. */
function canManageUser_(u, x) {
  if (u.role === 'admin') return true;
  if (u.role === 'il') return str_(x.il) === str_(u.il) && (x.role === 'ilce' || x.role === 'okul' || x.role === 'ogretmen');
  if (u.role === 'ilce') return str_(x.il) === str_(u.il) && str_(x.ilce) === str_(u.ilce) && (x.role === 'okul' || x.role === 'ogretmen');
  if (u.role === 'okul') return x.role === 'ogretmen' && String(x.okulKodu) === String(u.okulKodu) && String(u.okulKodu) !== '';
  return false;
}
/** Öğretmenin kendi kayıtlı şablonları yalnızca sahibine, yöneticiye ve aynı okulun okul yöneticisine görünür; diğerleri herkese açıktır. */
function templateVisible_(u, t) {
  if (u.role === 'admin' || t.owner === u.username) return true;
  var o = findUser_(t.owner);
  if (!o || o.role !== 'ogretmen') return true;
  return u.role === 'okul' && String(u.okulKodu) === String(o.okulKodu);
}

/** Başvuruyu kimler görüp karara bağlayabilir:
 *  okul başvurusu → yönetici, ilgili il ve ilçe yetkilisi · öğretmen başvurusu → o okulun okul yöneticisi, ilçe, il, yönetici. */
function appVisible_(u, a) {
  if (u.role === 'admin') return true;
  if (a.tur === 'okul') {
    if (u.role === 'il') return a.il === u.il;
    if (u.role === 'ilce') return a.il === u.il && a.ilce === u.ilce;
    return false;
  }
  if (u.role === 'okul') return String(a.okulKodu) === String(u.okulKodu) && String(u.okulKodu) !== '';
  if (u.role === 'ilce') return a.il === u.il && a.ilce === u.ilce;
  if (u.role === 'il') return a.il === u.il;
  return false;
}
function pendingFor_(u) {
  if (u.role === 'ogretmen') return 0;
  return table_('Basvurular').filter(function (a) { return a.durum === 'beklemede' && appVisible_(u, a); }).length;
}

/* ============================ SINAVLAR / ŞABLONLAR ============================ */

function aListExams(u) {
  return { exams: table_('Exams').filter(function (e) { return examVisible_(u, e); }).map(function (e) { return examForClient_(u, e); }) };
}

function validScope_(u, scopeType, scopeValue) {
  if (u.role === 'admin') return true;
  var sm = schoolMap_();
  if (scopeType === 'okullar') {
    var codes = String(scopeValue || '').split(',').map(function (x) { return x.trim(); }).filter(Boolean);
    if (!codes.length) return false;
    return codes.every(function (code) { return !!sm[code] && canSeeSchool_(u, sm[code]); });
  }
  var ok = false;
  for (var k in sm) { var s = sm[k]; if (canSeeSchool_(u, s) && examCovers_({ scopeType: scopeType, scopeValue: scopeValue }, s)) { ok = true; break; } }
  if (!ok) return false;
  // kapsam, kullanıcının yetki alanını aşmamalı
  if (scopeType === 'genel') return false;
  if (scopeType === 'il') return u.role === 'il' && scopeValue === u.il;
  if (scopeType === 'ilce') return (u.role === 'il' || u.role === 'ilce') && (u.role === 'il' ? scopeValue.split('|')[0] === u.il : scopeValue === u.il + '|' + u.ilce);
  return true;
}

/** Harici formla eşleme (sınav dersi → formdaki ders bloğu / başlangıç satırı). Yalnız PWA kullanır; sunucu temizleyip saklar. */
/** Sınav kazanım listesini temizler: [{ ders, soru, kod, konu }]. En çok 300 soru. */
function cleanKazanimlar_(list) {
  if (!Array.isArray(list)) return undefined;
  var out = [];
  list.slice(0, 300).forEach(function (x, i) {
    if (!x || typeof x !== 'object') return;
    var konu = clean_(x.konu || x.kazanim || x.title, 220);
    var ders = clean_(x.ders || x.section, 60);
    var kod = clean_(x.kod || x.code, 40);
    var soru = parseInt(x.soru || x.q || (i + 1), 10);
    if (!konu && !kod) return;
    out.push({ soru: isFinite(soru) && soru >= 1 && soru <= 300 ? soru : (i + 1), ders: ders, kod: kod, konu: konu });
  });
  return out.length ? out : undefined;
}
function formMap_(m) {
  if (!Array.isArray(m)) return undefined;
  var out = m.slice(0, 60).map(function (x) { x = x || {}; var l = parseInt(x.l, 10), s = parseInt(x.s, 10); return { l: isFinite(l) && l >= 0 && l < 200 ? l : -1, s: isFinite(s) && s > 0 && s < 5000 ? s : 0 }; });
  return out.some(function (x) { return x.l >= 0 || x.s > 0; }) ? out : undefined;
}
function aSaveExam(u, p) {
  var x = p.exam || {};
  var name = clean_(x.name, 120); if (!name) throw fail_('Sınav adı gerekli.');
  var existing = x.examId ? getExam_(x.examId) : null;
  if (existing && !(u.role === 'admin' || existing.owner === u.username)) throw fail_('Bu sınavı düzenleme yetkiniz yok.');
  var scopeType = x.scopeType || (u.role === 'okul' || u.role === 'ogretmen' ? 'okul' : 'ilce');
  var scopeValue = str_(x.scopeValue);
  if (existing && isPersonal_(existing)) { scopeType = 'okul'; scopeValue = String(existing.scopeValue); }   // kişisel sınavın kapsamı sabit (yönetici düzenlese de)
  else if (u.role === 'okul' || u.role === 'ogretmen') { scopeType = 'okul'; scopeValue = String(u.okulKodu); }
  if (scopeType === 'genel') scopeValue = '';
  if (scopeType === 'okullar') {
    var seenSc = {}, uniqSc = [];
    scopeValue.split(',').forEach(function (v) { v = normCode_(v); if (v && !seenSc[v]) { seenSc[v] = 1; uniqSc.push(v); } });
    scopeValue = uniqSc.join(',');
  }
  if (!(existing && isPersonal_(existing)) && !validScope_(u, scopeType, scopeValue)) throw fail_('Bu kapsamda sınav oluşturma yetkiniz yok.');
  if (!existing && u.role === 'ogretmen') {
    var mine = table_('Exams').filter(function (e) { return e.owner === u.username; }).length;
    if (mine >= MAX_TEACHER_EXAMS) throw fail_('Sınav sayısı sınırına ulaşıldı (' + MAX_TEACHER_EXAMS + '). Eski sınavları silin.');
  }
  var cfg = Scoring.normalizeCfg(x.config || {});
  var raw = x.config || {};
  var issues = Scoring.checkKeys(cfg);
  var status = ['draft', 'open', 'closed'].indexOf(x.status) >= 0 ? x.status : 'open';
  if (status === 'open' && issues.length && !p.allowIssues) throw fail_('Cevap anahtarı sorunları: ' + issues.slice(0, 4).join(' | '));
  var stored = JSON.stringify({
    sections: cfg.sections, choices: cfg.choices, penalty: cfg.penalty, method: cfg.method, base: cfg.base, max: cfg.max, a: cfg.a, b: cfg.b,
    keys: cfg.keys, multiIsWrong: cfg.multiIsWrong, stats: cfg.stats, templateId: str_(raw.templateId), formMap: formMap_(raw.formMap), kazanimlar: cleanKazanimlar_(raw.kazanimlar), booklets: raw.booklets || Object.keys(cfg.keys), showKeys: raw.showKeys !== false, veli: raw.veli === true
  });
  if (existing) {
    existing.name = name; existing.date = str_(x.date); existing.scopeType = scopeType; existing.scopeValue = scopeValue; existing.status = status; existing.config = stored;
    updateRow_('Exams', existing);
    refreshStored_(existing);
    return { examId: existing.examId, issues: issues };
  }
  var rec = { examId: newId_('E'), name: name, date: str_(x.date) || now_().slice(0, 10), owner: u.username, scopeType: scopeType, scopeValue: scopeValue, status: status, config: stored, createdAt: now_(), ownerRole: u.role === 'ogretmen' ? 'ogretmen' : '' };
  append_('Exams', [rec]);
  return { examId: rec.examId, issues: issues };
}

function refreshStored_(ex) {   // anahtar değişince sayfadaki D/Y/B/net sütunlarını güncelle
  var sh = resultsSheet_(ex.examId, false); if (!sh || sh.getLastRow() < 2) return;
  var cfg = Scoring.normalizeCfg(JSON.parse(ex.config)), n = sh.getLastRow() - 1;
  var vals = sh.getRange(2, 1, n, RESULT_HEADERS.length).getValues();
  vals.forEach(function (r) {
    var sc = Scoring.scoreStudent(cfg, String(r[4]), String(r[5]));
    r[6] = JSON.stringify(sc.sections.map(function (s) { return [s.D, s.Y, s.B]; })); r[7] = sc.D; r[8] = sc.Y; r[9] = sc.B; r[10] = sc.net;
  });
  sh.getRange(2, 1, n, RESULT_HEADERS.length).setValues(vals);
}

function aDeleteExam(u, p) {
  var ex = getExam_(p.examId); if (!ex) throw fail_('Sınav bulunamadı.');
  if (!(u.role === 'admin' || ex.owner === u.username)) throw fail_('Yetkiniz yok.');
  deleteRow_('Exams', ex);
  var sh = resultsSheet_(ex.examId, false); if (sh) ss_().deleteSheet(sh);
  return {};
}

function aListTemplates(u) { return { templates: table_('Templates').filter(function (t) { return templateVisible_(u, t); }).map(function (t) { return { templateId: t.templateId, name: t.name, owner: t.owner, json: safeParse_(t.json) }; }) }; }
function safeParse_(s) { try { return JSON.parse(s); } catch (e) { return null; } }
function aSaveTemplate(u, p) {
  var name = str_(p.name); if (!name) throw fail_('Şablon adı gerekli.');
  var json = JSON.stringify(p.template || {});
  if (json.length > 45000) throw fail_('Şablon çok büyük.');
  var id = p.templateId, existing = null;
  if (id) { var t = table_('Templates'); for (var i = 0; i < t.length; i++) if (String(t[i].templateId) === String(id)) existing = t[i]; }
  if (existing) {
    if (!(u.role === 'admin' || existing.owner === u.username)) throw fail_('Bu şablonu düzenleme yetkiniz yok.');
    existing.name = name; existing.json = json; updateRow_('Templates', existing); return { templateId: existing.templateId };
  }
  var rec = { templateId: newId_('T'), name: name, owner: u.username, json: json };
  append_('Templates', [rec]); return { templateId: rec.templateId };
}

function aDeleteTemplate(u, p) {
  var t = table_('Templates');
  for (var i = 0; i < t.length; i++) if (String(t[i].templateId) === String(p.templateId)) {
    if (!(u.role === 'admin' || t[i].owner === u.username)) throw fail_('Bu şablonu silme yetkiniz yok.');
    deleteRow_('Templates', t[i]); return {};
  }
  throw fail_('Şablon bulunamadı.');
}

/* ============================ DIŞ SINAVLAR (başka kaynaktan gelen sonuç listeleri) ============================ */
/* Yayınevi / kurum / deneme platformunun verdiği sonuç listesi (ders başına D/Y/N, toplam, puan, dereceler) olduğu gibi saklanır.
 * Cevap anahtarı ve optik okuma gerekmez. Bir dış sınav tek okula aittir; "Sınav analizi" ekranı bunları kendi sınavlarımızla birlikte gösterir.
 * Görünürlük sınavlarla aynı kural: okulu görebilen kullanıcı görür; öğretmenin kendi aktardığı liste kişiseldir (sahibi, yönetici ve okul yöneticisi görür). */
var EXT_MAX_ROWS_CALL = 700, EXT_MAX_ROWS_EXAM = 5000, EXT_MAX_EXAMS_SCHOOL = 300, EXT_MAX_LESSONS = 12;
function extGet_(id) { var t = table_('DisSinav'); for (var i = 0; i < t.length; i++) if (String(t[i].examId) === String(id)) return t[i]; return null; }
function extVisible_(u, ex) {
  if (u.role === 'admin' || ex.owner === u.username) return true;
  if (ex.ownerRole === 'ogretmen') return u.role === 'okul' && String(u.okulKodu) === String(ex.okulKodu);
  return canSeeSchool_(u, schoolMap_()[String(ex.okulKodu)]);
}
function extCanEdit_(u, ex) { return u.role === 'admin' || ex.owner === u.username || (u.role === 'okul' && String(u.okulKodu) === String(ex.okulKodu)); }
function extRequire_(u, id) { var ex = extGet_(id); if (!ex || !extVisible_(u, ex)) throw fail_('Dış sınav bulunamadı.'); return ex; }
function extCfg_(s) { var c = safeParse_(s) || {}; return { lessons: c.lessons || [], choices: c.choices || 4, penalty: c.penalty == null ? 0 : c.penalty, puanAdi: c.puanAdi || 'Puan', avg: c.avg || null, avgOkul: c.avgOkul || null }; }
function extForClient_(u, ex, n) {
  var sch = schoolMap_()[String(ex.okulKodu)] || {};
  return { examId: ex.examId, name: ex.name, date: dateStr_(ex.date), kaynak: ex.kaynak, okulKodu: String(ex.okulKodu), okulAdi: sch.okulAdi || '', owner: ex.owner, ownerName: userName_(ex.owner), personal: ex.ownerRole === 'ogretmen', config: extCfg_(ex.config), n: n, canEdit: extCanEdit_(u, ex), external: true };
}
function aListExternal(u) {
  var cnt = {}; table_('DisSonuc').forEach(function (r) { cnt[r.examId] = (cnt[r.examId] || 0) + 1; });
  return { exams: table_('DisSinav').filter(function (e) { return extVisible_(u, e); }).map(function (e) { return extForClient_(u, e, cnt[e.examId] || 0); }) };
}
function numOrNull_(v, lo, hi) { if (v === '' || v === null || v === undefined) return null; var n = parseFloat(String(v).replace(',', '.')); if (!isFinite(n)) return null; return Math.max(lo, Math.min(hi, n)); }
function cleanExtCfg_(c) {
  c = c || {};
  var lessons = (c.lessons || []).slice(0, EXT_MAX_LESSONS).map(function (l, i) { return { name: clean_(l && l.name, 40) || ('Ders ' + (i + 1)), count: Math.round(numOrNull_(l && l.count, 0, 500) || 0), short: clean_(l && l.short, 12) }; });
  if (!lessons.length) throw fail_('En az bir ders gerekli.');
  var cleanAvg = function (a) { return a && a.sec ? { sec: a.sec.slice(0, lessons.length).map(cleanTri_), tot: cleanTri_(a.tot), puan: numOrNull_(a.puan, 0, 100000) } : null; };
  return { lessons: lessons, choices: Math.round(numOrNull_(c.choices, 2, 8) || 4), penalty: numOrNull_(c.penalty, 0, 1) || 0, puanAdi: clean_(c.puanAdi, 30) || 'Puan', avg: cleanAvg(c.avg), avgOkul: cleanAvg(c.avgOkul) };
}
function cleanTri_(t) { t = t || []; return [numOrNull_(t[0], 0, 100000), numOrNull_(t[1], 0, 100000), numOrNull_(t[2], -100000, 100000)]; }
function aSaveExternal(u, p) {
  var e = p.exam || {}, name = clean_(e.name, 80); if (!name) throw fail_('Sınav adı gerekli.');
  var code = str_(e.okulKodu), sch = schoolMap_()[code]; if (!sch || !canSeeSchool_(u, sch)) throw fail_('Bu okul için dış sınav ekleme yetkiniz yok.');
  var cfg = JSON.stringify(cleanExtCfg_(e.config)), ex = e.examId ? extGet_(e.examId) : null;
  if (ex) {
    if (!extCanEdit_(u, ex)) throw fail_('Bu sınavı düzenleme yetkiniz yok.');
    ex.name = name; ex.date = clean_(e.date, 10); ex.kaynak = clean_(e.kaynak, 60); ex.config = cfg; updateRow_('DisSinav', ex); return { examId: ex.examId };
  }
  var same = 0; table_('DisSinav').forEach(function (x) { if (String(x.okulKodu) === code) same++; });
  if (same >= EXT_MAX_EXAMS_SCHOOL) throw fail_('Bu okul için en fazla ' + EXT_MAX_EXAMS_SCHOOL + ' dış sınav tutulabilir; eskileri silin.');
  var rec = { examId: newId_('X'), name: name, date: clean_(e.date, 10), kaynak: clean_(e.kaynak, 60), okulKodu: code, owner: u.username, ownerRole: u.role, config: cfg, createdAt: now_() };
  append_('DisSinav', [rec]); return { examId: rec.examId };
}
function cleanExtRow_(r, nL) {
  r = r || {}; var sec = []; for (var i = 0; i < nL; i++) sec.push(cleanTri_((r.sec || [])[i]));
  var ad = clean_(r.ad, 80), no = normNo_(clean_(r.ogrNo, 20));
  if (!no && !ad) return null;
  var rk = {}; ['snf', 'okul', 'ilce', 'il', 'genel'].forEach(function (k) { var v = numOrNull_((r.rk || {})[k], 0, 10000000); if (v !== null) rk[k] = v; });
  var pct = numOrNull_((r.rk || {}).pct, 0, 100); if (pct !== null) rk.pct = pct;
  return { no: no, ad: ad, sinif: clean_(r.sinif, 12), data: { s: sec, t: cleanTri_(r.tot), p: numOrNull_(r.puan, 0, 100000), r: rk } };
}
/** Satırları ekler. p.reset = true → önce bu sınavın tüm satırları silinir (ilk parça). p.merge → aynı numaralıyı günceller. */
function aImportExternal(u, p) {
  var ex = extRequire_(u, p.examId); if (!extCanEdit_(u, ex) && !(ex.ownerRole !== 'ogretmen' && u.role !== 'ogretmen' && canSeeSchool_(u, schoolMap_()[String(ex.okulKodu)]))) throw fail_('Bu sınava satır ekleme yetkiniz yok.');
  var rows = p.rows || []; if (rows.length > EXT_MAX_ROWS_CALL) throw fail_('Tek seferde en fazla ' + EXT_MAX_ROWS_CALL + ' satır gönderilebilir.');
  var cfg = extCfg_(ex.config), nL = cfg.lessons.length;
  var all = table_('DisSonuc'), mine = all.filter(function (r) { return String(r.examId) === String(ex.examId); });
  if (p.reset && mine.length) { deleteRows_('DisSonuc', mine); mine = []; }
  var byKey = {}; mine.forEach(function (r) { byKey[r.key] = r; });
  var add = [], upd = [], bad = 0, seen = {};
  rows.forEach(function (raw) {
    var r = cleanExtRow_(raw, nL); if (!r) { bad++; return; }
    var key = ex.examId + '|' + (r.no || ('n:' + trKey_(r.ad)));
    if (seen[key]) { bad++; return; } seen[key] = 1;
    var rec = { key: key, examId: ex.examId, ogrNo: r.no, ad: r.ad, sinif: r.sinif, data: JSON.stringify(r.data), updatedAt: now_() };
    if (byKey[key]) { rec._r = byKey[key]._r; upd.push(rec); } else add.push(rec);
  });
  if (mine.length + add.length > EXT_MAX_ROWS_EXAM) throw fail_('Bir dış sınavda en fazla ' + EXT_MAX_ROWS_EXAM + ' öğrenci tutulabilir.');
  upd.forEach(function (rec) { updateRow_('DisSonuc', rec); });
  append_('DisSonuc', add);
  return { added: add.length, updated: upd.length, skipped: bad };
}
function aGetExternal(u, p) {
  var ex = extRequire_(u, p.examId), st = studentMap_(), code = String(ex.okulKodu);
  var rows = table_('DisSonuc').filter(function (r) { return String(r.examId) === String(ex.examId); }).map(function (r) {
    var d = safeParse_(r.data) || {}, s = st[code + '|' + normNo_(r.ogrNo)];
    return { ogrNo: normNo_(r.ogrNo), ad: str_(r.ad) || (s ? (s.ad + ' ' + s.soyad).trim() : ''), sinif: str_(r.sinif) || (s ? str_(s.sinif) : ''), sec: d.s || [], tot: d.t || [null, null, null], puan: d.p == null ? null : d.p, rk: d.r || {}, registered: !!s };
  });
  return { exam: extForClient_(u, ex, rows.length), rows: rows };
}
function aDeleteExternal(u, p) {
  var ex = extRequire_(u, p.examId); if (!extCanEdit_(u, ex)) throw fail_('Bu sınavı silme yetkiniz yok.');
  deleteRows_('DisSonuc', table_('DisSonuc').filter(function (r) { return String(r.examId) === String(ex.examId); }));
  deleteRow_('DisSinav', ex); return {};
}
function aDeleteExternalRow(u, p) {
  var ex = extRequire_(u, p.examId); if (!extCanEdit_(u, ex)) throw fail_('Bu sınavı düzenleme yetkiniz yok.');
  var no = normNo_(p.ogrNo), hit = table_('DisSonuc').filter(function (r) { return String(r.examId) === String(ex.examId) && normNo_(r.ogrNo) === no; });
  return { deleted: deleteRows_('DisSonuc', hit) };
}

/* ============================ OKUL / ÖĞRENCİ / KULLANICI ============================ */

function aListSchools(u) {
  var rich = u.role === 'admin' || u.role === 'il' || u.role === 'ilce';   // müdür/iletişim bilgisi yalnızca üst yetkililere
  return { schools: table_('Schools').map(function (s) {
    var o = { okulKodu: String(s.okulKodu), okulAdi: s.okulAdi, il: s.il, ilce: s.ilce, tur: schoolTur_(s) };
    if (rich) { o.mudur = s.mudur || ''; o.telefon = String(s.telefon || ''); o.eposta = s.eposta || ''; o.adres = s.adres || ''; }
    return o;
  }).filter(function (s) { return canSeeSchool_(u, s); }) };
}
function aImportSchools(u, p) {
  if (u.role === 'okul' || u.role === 'ogretmen') throw fail_('Okul ekleme yetkiniz yok.');
  var t = table_('Schools'), byCode = {}; t.forEach(function (s) { byCode[String(s.okulKodu)] = s; });
  var add = [], upd = 0, skipped = [];
  (p.rows || []).forEach(function (r, i) {
    var code = normCode_(r.okulKodu), name = clean_(r.okulAdi, 120), il = str_(r.il), ilce = str_(r.ilce), tur = DUZEYLER.indexOf(str_(r.tur)) >= 0 ? str_(r.tur) : '';
    if (!code || !name || !il || !ilce) { skipped.push('Satır ' + (i + 1) + ': eksik alan'); return; }
    if (!canSeeSchool_(u, { okulKodu: code, il: il, ilce: ilce })) { skipped.push('Satır ' + (i + 1) + ': yetki alanınız dışında'); return; }
    if (byCode[code]) { var o = byCode[code]; o.okulAdi = name; o.il = il; o.ilce = ilce; if (tur) o.tur = tur; updateRow_('Schools', o); upd++; }
    else { var rec = { okulKodu: code, okulAdi: name, il: il, ilce: ilce, tur: tur }; byCode[code] = rec; add.push(rec); }
  });
  append_('Schools', add); if (add.length || upd) bumpSchools_();
  return { added: add.length, updated: upd, skipped: skipped };
}

function aListStudents(u, p) {
  var sch = schoolMap_()[String(p.okulKodu)];
  if (!canSeeSchool_(u, sch)) throw fail_('Bu okul için yetkiniz yok.');
  var tel = p.tel === true && u.role !== 'ogretmen';   // veli telefonları yalnızca okul yöneticisi ve üstüne (okutma önbelleğine gitmez)
  return { students: table_('Students').filter(function (s) { return String(s.okulKodu) === String(p.okulKodu); }).map(function (s) {
    var o = { ogrNo: String(s.ogrNo), ad: s.ad, soyad: s.soyad, sinif: s.sinif };
    if (tel) { o.anneTel = String(s.anneTel || ''); o.babaTel = String(s.babaTel || ''); o.veliKodu = str_(s.veliKodu) ? 1 : 0; }
    return o;
  }) };
}
function bumpStudents_() { PropertiesService.getScriptProperties().setProperty('STUVER', String(Date.now())); }
function aImportStudents(u, p) {
  if (u.role === 'ogretmen') throw fail_('Öğrenci listesini okul yöneticisi yükler.');
  var code = normCode_(p.okulKodu), sch = schoolMap_()[code];
  if (!canSeeSchool_(u, sch)) throw fail_('Bu okul için yetkiniz yok.');
  var t = table_('Students'), idx = {}; t.forEach(function (s) { if (String(s.okulKodu) === code) idx[normNo_(s.ogrNo)] = s; });
  var add = [], upd = 0, skipped = [];
  (p.rows || []).forEach(function (r, i) {
    var no = normNo_(r.ogrNo); if (!no) { skipped.push('Satır ' + (i + 1) + ': öğrenci no yok'); return; }
    var ad = clean_(r.ad, 60), soyad = clean_(r.soyad, 60), sinif = clean_(r.sinif, 20), vk = clean_(r.veliKodu, 20).replace(/\s+/g, ''), tels = {};
    ['anneTel', 'babaTel'].forEach(function (k) {
      if (str_(r[k]) === '') return;
      try { tels[k] = telNorm_(r[k], k === 'anneTel' ? 'Anne telefonu' : 'Baba telefonu'); } catch (e) { skipped.push('Satır ' + (i + 1) + ': ' + String(e.message).split(':')[0] + ' geçersiz, telefon yok sayıldı'); }
    });
    if (idx[no] && idx[no]._r) { var s = idx[no]; s.ad = ad; s.soyad = soyad; s.sinif = sinif; if (vk) s.veliKodu = vk; Object.keys(tels).forEach(function (k) { s[k] = tels[k]; }); updateRow_('Students', s); upd++; }
    else if (idx[no]) { idx[no].ad = ad; idx[no].soyad = soyad; idx[no].sinif = sinif; if (vk) idx[no].veliKodu = vk; Object.keys(tels).forEach(function (k) { idx[no][k] = tels[k]; }); }
    else { var rec = { okulKodu: code, ogrNo: no, ad: ad, soyad: soyad, sinif: sinif, veliKodu: vk, anneTel: tels.anneTel || '', babaTel: tels.babaTel || '' }; idx[no] = rec; add.push(rec); }
  });
  append_('Students', add); bumpStudents_();
  return { added: add.length, updated: upd, skipped: skipped };
}
function newVeliKod_() { return String(100000 + parseInt(Utilities.getUuid().replace(/-/g, '').slice(0, 10), 16) % 900000); }
/** vals: { satırNo: kod } → Öğrenciler sayfasının veliKodu sütununa tek seferde yazar (metin biçimi). */
function writeVeliCodes_(vals) {
  if (!Object.keys(vals).length) return;
  var col = HEADERS.Students.indexOf('veliKodu') + 1, sh = sheet_('Students'), last = sh.getLastRow();
  if (last < 2) return;
  var rg = sh.getRange(2, col, last - 1, 1), cv = rg.getValues();
  Object.keys(vals).forEach(function (r) { cv[Number(r) - 2][0] = vals[r]; });
  rg.setNumberFormat('@'); rg.setValues(cv); dirty_('Students');
}
/** Öğrencilere veli kodu üretir (6 haneli). Kodu olmayanlara üretir; hepsi:true ise tümünü yeniler. Okul listesini kod sütunuyla döndürür (yazdırıp dağıtmak için). */
function aGenerateParentCodes(u, p) {
  if (u.role === 'ogretmen') throw fail_('Veli kodlarını okul yöneticisi üretir.');
  var code = normCode_(p.okulKodu), sch = schoolMap_()[code];
  if (!canSeeSchool_(u, sch)) throw fail_('Bu okul için yetkiniz yok.');
  var out = [], vals = {};
  table_('Students').forEach(function (s) {
    if (String(s.okulKodu) !== code) return;
    var cur = str_(s.veliKodu);
    if (!cur || p.hepsi === true) { cur = newVeliKod_(); vals[s._r] = cur; }
    out.push({ ogrNo: String(s.ogrNo), ad: s.ad, soyad: s.soyad, sinif: s.sinif, veliKodu: cur });
  });
  writeVeliCodes_(vals);
  out.sort(function (a, b) { return sinifCmp_(a.sinif, b.sinif) || (Number(a.ogrNo) - Number(b.ogrNo)) || trCmp_(a.ogrNo, b.ogrNo); });
  return { okulAdi: sch.okulAdi, students: out, created: Object.keys(vals).length };
}

function aListUsers(u) {
  if (u.role === 'ogretmen') throw fail_('Yetkiniz yok.');
  return {
    users: table_('Users').filter(function (x) { return canManageUser_(u, x); }).map(function (x) {
      var o = publicUser_(x); o.active = String(x.active) !== 'false'; o.telefon = String(x.telefon || ''); o.eposta = x.eposta || ''; o.createdBy = x.createdBy || ''; return o;
    })
  };
}
function aSaveUser(u, p) {
  var role = str_(p.role), code = normCode_(p.okulKodu), il = str_(p.il), ilce = str_(p.ilce);
  if (ROLES.indexOf(role) < 0) throw fail_('Geçersiz rol.');
  if (role === 'okul' || role === 'ogretmen') {
    if (u.role === 'okul') code = String(u.okulKodu);
    var s = schoolMap_()[code]; if (!s) throw fail_('Okul kodu bulunamadı: ' + code);
    if (!canSeeSchool_(u, s)) throw fail_('Bu okul için kullanıcı oluşturamazsınız.');
    il = s.il; ilce = s.ilce;
  } else if (role === 'ilce') {
    if (u.role === 'il') il = u.il;
    if (!il || !ilce) throw fail_('İl ve ilçe gerekli.');
    code = '';
  } else if (role === 'il') { if (!il) throw fail_('İl gerekli.'); ilce = ''; code = ''; }
  else { il = ilce = code = ''; }
  if (!canManageUser_(u, { role: role, il: il, ilce: ilce, okulKodu: code })) throw fail_('Bu rolü veya kapsamı atayamazsınız.');
  var ex = findUser_(p.username);
  if (ex && !canManageUser_(u, ex)) throw fail_('Bu kullanıcıyı düzenleyemezsiniz.');   // başka yetki alanındaki hesap devralınamaz
  createUser_({ username: p.username, name: p.name, role: role, il: il, ilce: ilce, okulKodu: code, password: p.password, active: p.active !== false, brans: p.brans, telefon: p.telefon, eposta: p.eposta, createdBy: u.username });
  return {};
}

/* ============================ SONUÇ GÖNDERME ============================ */

function aSubmit(u, p) {
  var ex = requireExam_(u, p.examId);
  if (!canSubmit_(u, ex)) throw fail_('Bu sınava sonuç gönderme yetkiniz yok' + (u.role === 'ogretmen' ? ' (okul sınavları yalnızca görüntülenir).' : '.'));
  if (ex.status !== 'open') throw fail_('Sınav okutmaya açık değil (durum: ' + ex.status + ').');
  var code = normCode_(p.okulKodu), sch = schoolMap_()[code];
  if (!sch) throw fail_('Okul bulunamadı: ' + code);
  if (!canSeeSchool_(u, sch)) throw fail_('Bu okul için gönderme yetkiniz yok.');
  if (!examCovers_(ex, sch)) throw fail_('Bu sınav bu okulu kapsamıyor.');
  var cfg = Scoring.normalizeCfg(JSON.parse(ex.config || '{}'));
  var sh = resultsSheet_(ex.examId, true), n = RESULT_HEADERS.length, last = sh.getLastRow();
  var keyRows = {};
  if (last >= 2) sh.getRange(2, 1, last - 1, 1).getValues().forEach(function (r, i) { keyRows[String(r[0])] = i + 2; });
  var pending = {}, newRows = [], updByRow = {}, out = [], t = now_();
  (p.items || []).forEach(function (it) {
    var res = { clientId: it.clientId, ogrNo: str_(it.ogrNo) };
    try {
      var no = normNo_(it.ogrNo); if (!/^\d+$/.test(no)) throw new Error('Geçersiz öğrenci no');
      var ans = str_(it.answers).toUpperCase();
      if (ans.length !== cfg.total) throw new Error('Cevap uzunluğu ' + ans.length + ', beklenen ' + cfg.total);
      if (!/^[A-H*-]+$/.test(ans)) throw new Error('Cevaplarda geçersiz karakter');
      var bk = str_(it.booklet).toUpperCase().slice(0, 3);
      var sc = Scoring.scoreStudent(cfg, bk, ans);
      var key = ex.examId + '|' + code + '|' + no;
      var row = [key, ex.examId, code, no, bk, ans, JSON.stringify(sc.sections.map(function (s) { return [s.D, s.Y, s.B]; })), sc.D, sc.Y, sc.B, sc.net,
        JSON.stringify(it.flags || []).slice(0, 400), str_(it.scannedAt) || t, u.username, t];
      if (keyRows[key]) { updByRow[keyRows[key]] = row; res.status = 'updated'; }   // aynı pakette tekrar gelirse son kayıt geçerli
      else if (pending[key] !== undefined) { newRows[pending[key]] = row; res.status = 'updated'; }
      else { pending[key] = newRows.length; newRows.push(row); res.status = 'new'; }
      res.net = sc.net; res.keyMissing = sc.keyMissing;
    } catch (e) { res.status = 'error'; res.error = String(e.message || e); }
    out.push(res);
  });
  var updRows = Object.keys(updByRow);
  if (updRows.length > 40) {
    var all = sh.getRange(2, 1, last - 1, n).getValues();
    updRows.forEach(function (r) { all[Number(r) - 2] = updByRow[r]; });
    sh.getRange(2, 1, all.length, n).setValues(all);
  } else updRows.forEach(function (r) { sh.getRange(Number(r), 1, 1, n).setValues([updByRow[r]]); });
  if (newRows.length) writeRows_(sh, newRows, RESULT_TEXT_COLS);
  return { results: out, added: newRows.length, updated: updRows.length };
}

function aDeleteResult(u, p) {
  var ex = requireExam_(u, p.examId), sch = schoolMap_()[normCode_(p.okulKodu)];
  if (!canSubmit_(u, ex) || !canSeeSchool_(u, sch)) throw fail_('Yetkiniz yok.');
  var sh = resultsSheet_(ex.examId, false); if (!sh) return { deleted: 0 };
  var key = ex.examId + '|' + normCode_(p.okulKodu) + '|' + normNo_(p.ogrNo), last = sh.getLastRow(), del = 0;
  if (last >= 2) { var ks = sh.getRange(2, 1, last - 1, 1).getValues(); for (var i = ks.length - 1; i >= 0; i--) if (String(ks[i][0]) === key) { sh.deleteRow(i + 2); del++; } }
  return { deleted: del };
}

/* ============================ HESAPLAMA / RAPOR ============================ */

function studentMap_() {
  var m = {}; table_('Students').forEach(function (s) { m[String(s.okulKodu) + '|' + normNo_(s.ogrNo)] = s; });
  return m;
}


function finalizeCohortRealistic_(cfg, rows) {
  var info = Scoring.finalizeCohort(cfg, rows);
  if (!rows.length) return info;
  var ns = cfg.sections.length, penalty = Math.max(0, Number(cfg.penalty) || 0), j;
  var stats = [];
  for (j = 0; j < ns; j++) {
    var st = (info && info.stats && info.stats[j]) ? info.stats[j] : Scoring.meanSd(rows.map(function (r) { return r.secNets[j]; }));
    var minSd = Math.max(1, cfg.sections[j].count * 0.18);
    var sd = (st && st.sd > minSd) ? st.sd : minSd;
    var mean = (st && isFinite(st.mean)) ? st.mean : (cfg.sections[j].count * 0.45);
    stats.push({ mean: mean, sd: sd });
  }
  var aFull = 0, aMinTheo = 0;
  for (j = 0; j < ns; j++) {
    var cnt = cfg.sections[j].count, coef = cfg.sections[j].coef;
    var sFull = 50 + 10 * ((cnt - stats[j].mean) / stats[j].sd);
    var minNet = penalty > 0 ? (-cnt * penalty) : 0;
    var sLow = 50 + 10 * ((minNet - stats[j].mean) / stats[j].sd);
    aFull += coef * sFull;
    aMinTheo += coef * sLow;
  }
  if (cfg.stats && cfg.stats.aMin != null && cfg.stats.aMax != null) {
    aMinTheo = Number(cfg.stats.aMin);
    aFull = Number(cfg.stats.aMax);
  }
  rows.forEach(function (r) {
    var A = 0, allFull = true;
    r.secStd = [];
    for (j = 0; j < ns; j++) {
      var net = Number(r.secNets[j]) || 0;
      if (net < cfg.sections[j].count - 0.0001) allFull = false;
      var z = (net - stats[j].mean) / stats[j].sd, S = 50 + 10 * z;
      r.secStd.push(Math.round(S * 100) / 100);
      A += cfg.sections[j].coef * S;
    }
    r.A = A;
    var p;
    if (cfg.method === 'coef500') {
      if (allFull) p = cfg.max;
      else {
        var wSum = 0;
        for (j = 0; j < ns; j++) wSum += cfg.sections[j].coef * (Number(r.secNets[j]) || 0);
        p = Math.max(0, Math.min(cfg.max - 0.001, cfg.base + wSum));
      }
    } else if (cfg.method === 'std500') {
      if (allFull) p = cfg.max;
      else if (aFull > aMinTheo) p = Math.max(cfg.base, Math.min(cfg.max - 0.001, cfg.base + (cfg.max - cfg.base) * (A - aMinTheo) / (aFull - aMinTheo)));
      else p = cfg.base;
    } else {
      return;
    }
    r.puan = Math.round(p * 1000) / 1000;
  });
  return { stats: stats, aMin: aMinTheo, aMax: aFull };
}

function computeExam_(ex) {
  var cfg = Scoring.normalizeCfg(JSON.parse(ex.config || '{}'));
  var sh = resultsSheet_(ex.examId, false), res = sh ? objs_(sh, RESULT_HEADERS) : [];
  var sm = schoolMap_(), st = studentMap_();
  var rows = res.map(function (r) {
    var code = String(r.okulKodu), ogr = normNo_(r.ogrNo), sc = Scoring.scoreStudent(cfg, String(r.booklet), String(r.answers));
    var sch = sm[code] || { okulKodu: code, okulAdi: code, il: '?', ilce: '?' }, s = st[code + '|' + ogr];
    return {
      okulKodu: code, okulAdi: sch.okulAdi, il: sch.il, ilce: sch.ilce, ogrNo: ogr, ad: s ? (s.ad + ' ' + s.soyad).trim() : '', sinif: s ? String(s.sinif) : '',
      booklet: sc.booklet, answers: String(r.answers), D: sc.D, Y: sc.Y, B: sc.B, net: sc.net, sec: sc.sections.map(function (x) { return [x.D, x.Y, x.B, x.net]; }),
      secNets: sc.sections.map(function (x) { return x.net; }), registered: !!s, scannedAt: r.scannedAt
    };
  });
  var info = finalizeCohortRealistic_(cfg, rows);
  Scoring.rankRows(rows, 'rGenel');
  Scoring.rankRows(rows, 'rIl', function (r) { return r.il; });
  Scoring.rankRows(rows, 'rIlce', function (r) { return r.il + '|' + r.ilce; });
  Scoring.rankRows(rows, 'rOkul', function (r) { return r.okulKodu; });
  Scoring.rankRows(rows, 'rSinif', function (r) { return r.okulKodu + '|' + r.sinif; });
  return { cfg: cfg, rows: rows, info: info };
}

function summarize_(rows, keyFn, labelFn, nSec) {
  var g = {};
  rows.forEach(function (r) {
    var k = keyFn(r), o = g[k] || (g[k] = { key: k, label: labelFn(r), n: 0, net: 0, puan: 0, sec: [], il: r.il, ilce: r.ilce });
    o.n++; o.net += r.net; o.puan += r.puan;
    for (var j = 0; j < nSec; j++) o.sec[j] = (o.sec[j] || 0) + r.secNets[j];
  });
  var list = Object.keys(g).map(function (k) {
    var o = g[k]; o.net = round_(o.net / o.n); o.puan = round_(o.puan / o.n); o.sec = o.sec.map(function (v) { return round_(v / o.n); }); return o;
  });
  list.sort(function (a, b) { return b.puan - a.puan; });
  list.forEach(function (o, i) { o.rank = i + 1; });
  return list;
}
function round_(v) { return Math.round(v * 100) / 100; }

function aResults(u, p) {
  var ex = requireExam_(u, p.examId), c = computeExam_(ex), nSec = c.cfg.sections.length, sm = schoolMap_();
  var mine = c.rows.filter(function (r) { return canSeeSchool_(u, sm[r.okulKodu]); });
  mine.forEach(function (r) { delete r.A; });   // secStd (ders bazlı standart puan) karne için istemciye gider
  var schoolsAll = summarize_(c.rows, function (r) { return r.okulKodu; }, function (r) { return r.okulAdi; }, nSec);
  schoolsAll.forEach(function (s) { s.mine = canSeeSchool_(u, sm[s.key]); });
  var allNet = c.rows.map(function (r) { return r.net; }), ms = Scoring.meanSd(allNet);
  return {
    exam: examForClient_(u, ex), sections: c.cfg.sections, stats: c.info.stats,
    cohort: { n: c.rows.length, meanNet: round_(ms.mean), sdNet: round_(ms.sd), maxNet: allNet.length ? Math.max.apply(null, allNet) : 0 },
    rows: mine,
    schools: schoolsAll,
    ilceler: summarize_(c.rows, function (r) { return r.il + '|' + r.ilce; }, function (r) { return r.ilce + ' (' + r.il + ')'; }, nSec),
    iller: summarize_(c.rows, function (r) { return r.il; }, function (r) { return r.il; }, nSec)
  };
}

function aAnalysis(u, p) {
  var ex = requireExam_(u, p.examId), c = computeExam_(ex), sm = schoolMap_();
  var items = Scoring.itemStats(c.cfg, c.rows);
  var mineRows = c.rows.filter(function (r) { return canSeeSchool_(u, sm[r.okulKodu]); });
  var bySchool = {}, groups = {};
  mineRows.forEach(function (r) { (groups[r.okulKodu] = groups[r.okulKodu] || []).push(r); });
  Object.keys(groups).slice(0, 60).forEach(function (code) { bySchool[code] = Scoring.itemStats(c.cfg, groups[code]).map(function (x) { return x.pct; }); });
  return { items: items, bySchool: bySchool, schoolNames: Object.keys(bySchool).map(function (k) { return { okulKodu: k, okulAdi: (sm[k] || {}).okulAdi || k }; }) };
}

/* ============================ ÜYELİK / BAŞVURU / ONAY ============================ */
/* Herkese açık iki başvuru türü vardır; ikisi de "beklemede" olarak kaydedilir ve yetkili onaylayınca hesap oluşur:
 *  - öğretmen: sistemdeki bir okulu seçerek üye olur → o okulun okul yöneticisi / ilçe / il / yönetici onaylar
 *  - okul: okul yöneticisi okulunu (müdür, telefon, e-posta, adres) kaydeder → ilgili il / ilçe yetkilisi veya yönetici onaylar
 * Parola başvuru anında özetlenir (düz metin saklanmaz); karar verilince hesap bu özetle açılır. */

function bumpSchools_() { PropertiesService.getScriptProperties().setProperty('SCHVER', String(Date.now())); delete MEM_.sm; delete MEM_.ilm; }
function trCmp_(a, b) { var x = trKey_(a), y = trKey_(b); return x < y ? -1 : x > y ? 1 : 0; }

/** İl yazımı: sistemde zaten kayıtlı yazımla eşleşir (büyük/küçük harf ve Türkçe karakter farkı yok sayılır), yoksa 81 il listesine bakılır. */
function canonIl_(v) {
  var k = trKey_(v); if (!k) return '';
  if (!MEM_.ilm) { var m = {}; IL_LISTESI.forEach(function (x) { m[trKey_(x)] = x; }); table_('Schools').forEach(function (s) { if (s.il) m[trKey_(s.il)] = s.il; }); MEM_.ilm = m; }
  return MEM_.ilm[k] || '';
}
function canonIlce_(il, v) {
  var k = trKey_(v); if (!k) return '';
  var t = table_('Schools');
  for (var i = 0; i < t.length; i++) if (t[i].il === il && trKey_(t[i].ilce) === k) return t[i].ilce;
  return titleTr_(clean_(v, 40));
}
function usernameTaken_(username) {
  if (findUser_(username)) return true;
  var t = table_('Basvurular');
  for (var i = 0; i < t.length; i++) if (t[i].durum === 'beklemede' && str_(t[i].username).toLowerCase() === username) return true;
  return false;
}
function checkAccount_(p) {
  var username = str_(p.username).toLowerCase(), pass = String(p.password || '');
  if (!/^[a-z0-9._-]{3,40}$/.test(username)) throw fail_('Kullanıcı adı 3-40 karakter; küçük harf, rakam, nokta, alt çizgi, tire kullanılabilir.');
  if (usernameTaken_(username)) throw fail_('Bu kullanıcı adı kullanılıyor. Başka bir ad seçin.');
  if (pass.length < 8) throw fail_('Parola en az 8 karakter olmalı.');
  if (pass.length > 100) throw fail_('Parola çok uzun.');
  return username;
}
function checkContact_(p, phoneRequired, mailRequired) {
  var tel = digits_(p.telefon), mail = str_(p.eposta).toLowerCase();
  if (tel || phoneRequired) { if (tel.charAt(0) === '9' && tel.charAt(1) === '0' && tel.length === 12) tel = tel.slice(2); if (!/^0?\d{10}$/.test(tel)) throw fail_('Telefon numarası 10 veya 11 haneli olmalı (örn. 05xx xxx xx xx).'); }
  if (mail || mailRequired) { if (!validEmail_(mail)) throw fail_('Geçerli bir e-posta adresi girin.'); }
  return { telefon: tel, eposta: mail };
}
function pendingApps_() { return table_('Basvurular').filter(function (a) { return a.durum === 'beklemede'; }); }

/** Kayıt isteği kilide girmeden önce: bot tuzağı alanı doluysa sınır harcanmaz; genel ve kullanıcı adı başına saatlik sınır. */
function preRegister_(req) {
  if (str_(req.website)) return;
  throttle_('reg_all_' + hourKey_(), REG_PER_HOUR);
  throttle_('reg_u_' + trKey_(str_(req.username).slice(0, 60)).slice(0, 40) + '_' + hourKey_(), REG_PER_USER_HOUR);   // önbellek anahtarı en çok 250 karakter
}

/** Kayıt sayfasının seçim listeleri. Parametresiz: il → ilçe listesi. il+ilce ile: o ilçedeki okullar (düzey süzgeci istemcide). Herkese açık, önbellekli. */
function aPublicSchools(_, p) {
  var ver = PropertiesService.getScriptProperties().getProperty('SCHVER') || '0', cache = CacheService.getScriptCache();
  var il = str_(p.il).slice(0, 60), ilce = str_(p.ilce).slice(0, 60), key = 'pubsch_' + ver + '_' + (il ? trKey_(il) + '_' + trKey_(ilce) : 'places');
  var hit = cache.get(key); if (hit) { try { return JSON.parse(hit); } catch (e) { } }
  var out, t = table_('Schools');
  if (!il) {
    var g = {};
    t.forEach(function (s) { if (s.il && s.ilce) (g[s.il] = g[s.il] || {})[s.ilce] = 1; });
    out = { iller: Object.keys(g).sort(trCmp_).map(function (k) { return { il: k, ilceler: Object.keys(g[k]).sort(trCmp_) }; }) };
  } else {
    var list = t.filter(function (s) { return s.il === il && s.ilce === ilce; }).map(function (s) { return { okulKodu: String(s.okulKodu), okulAdi: s.okulAdi, tur: schoolTur_(s) }; });
    list.sort(function (a, b) { return trCmp_(a.okulAdi, b.okulAdi); });
    out = { schools: list.slice(0, 2000) };
  }
  var js = JSON.stringify(out); if (js.length < 90000) cache.put(key, js, 600);
  return out;
}

function aRegisterTeacher(_, p) {
  if (str_(p.website)) return { durum: 'beklemede' };   // bot tuzağı: gizli alan dolu → sessizce kabul etmiş gibi davran
  var sch = schoolMap_()[normCode_(p.okulKodu)];
  if (!sch) throw fail_('Okul bulunamadı. Listeden okulunuzu seçin. Okulunuz listede yoksa önce okul yöneticisinin okulu kaydetmesi gerekir.');
  var name = clean_(p.name, 80); if (name.length < 3) throw fail_('Ad soyadınızı yazın.');
  var username = checkAccount_(p), ct = checkContact_(p, false, false);
  var pend = pendingApps_();
  if (pend.length >= MAX_PENDING) throw fail_('Bekleyen başvuru sayısı çok fazla. Lütfen daha sonra tekrar deneyin.');
  if (pend.filter(function (a) { return String(a.okulKodu) === sch.okulKodu; }).length >= MAX_PENDING_SCHOOL) throw fail_('Bu okul için bekleyen başvuru sayısı çok fazla. Okul yöneticisi başvuruları karara bağlayınca tekrar deneyin.');
  var salt = Utilities.getUuid().slice(0, 12);
  append_('Basvurular', [{ id: newId_('B'), tur: 'ogretmen', durum: 'beklemede', username: username, name: name, il: sch.il, ilce: sch.ilce, okulKodu: sch.okulKodu, okulAdi: sch.okulAdi, duzey: sch.tur,
    telefon: ct.telefon, eposta: ct.eposta, brans: clean_(p.brans, 60), salt: salt, hash: hashPass_(salt, String(p.password)), createdAt: now_() }]);
  return { durum: 'beklemede', okulAdi: sch.okulAdi };
}

function aRegisterSchool(_, p) {
  if (str_(p.website)) return { durum: 'beklemede' };
  var il = canonIl_(p.il); if (!il) throw fail_('Geçerli bir il seçin.');
  var ilce = canonIlce_(il, p.ilce); if (ilce.length < 2) throw fail_('İlçe adı gerekli.');
  var okulAdi = clean_(p.okulAdi, 120); if (okulAdi.length < 5) throw fail_('Okul adını tam yazın.');
  var code = normCode_(p.okulKodu); if (!/^\d{3,10}$/.test(code)) throw fail_('Kurum kodu 3-10 haneli rakam olmalı.');
  var duzey = str_(p.duzey); if (DUZEYLER.indexOf(duzey) < 0) throw fail_('Okul düzeyini seçin.');
  var mudur = clean_(p.mudur, 80); if (mudur.length < 3) throw fail_('Okul müdürünün adı soyadı gerekli.');
  var adres = clean_(p.adres, 300); if (adres.length < 8) throw fail_('Okul adresi gerekli.');
  var ct = checkContact_(p, true, true);
  if (schoolMap_()[code]) throw fail_('Bu kurum kodu sistemde zaten kayıtlı. Okulunuz kayıtlıysa öğretmen olarak üye olabilirsiniz.');
  var pend = pendingApps_();
  if (pend.some(function (a) { return a.tur === 'okul' && String(a.okulKodu) === code; })) throw fail_('Bu kurum kodu için onay bekleyen bir başvuru var.');
  if (pend.length >= MAX_PENDING) throw fail_('Bekleyen başvuru sayısı çok fazla. Lütfen daha sonra tekrar deneyin.');
  var username = checkAccount_(p), yetkili = clean_(p.name, 80) || mudur, salt = Utilities.getUuid().slice(0, 12);
  append_('Basvurular', [{ id: newId_('B'), tur: 'okul', durum: 'beklemede', username: username, name: yetkili, il: il, ilce: ilce, okulKodu: code, okulAdi: okulAdi, duzey: duzey, mudur: mudur,
    telefon: ct.telefon, eposta: ct.eposta, adres: adres, salt: salt, hash: hashPass_(salt, String(p.password)), createdAt: now_() }]);
  return { durum: 'beklemede', okulAdi: okulAdi };
}

function findApp_(id) { var t = table_('Basvurular'); for (var i = 0; i < t.length; i++) if (String(t[i].id) === String(id)) return t[i]; return null; }
function appForClient_(a) {
  var o = { id: a.id, tur: a.tur, durum: a.durum, username: a.username, name: a.name, il: a.il, ilce: a.ilce, okulKodu: String(a.okulKodu), okulAdi: a.okulAdi, duzey: a.duzey, mudur: a.mudur || '', telefon: String(a.telefon || ''), eposta: a.eposta || '', adres: a.adres || '', brans: a.brans || '',
    createdAt: String(a.createdAt), decidedBy: a.decidedBy || '', decidedAt: String(a.decidedAt || ''), not: a.not || '', conflict: '' };
  if (a.durum === 'beklemede') {
    if (findUser_(a.username)) o.conflict = 'Bu kullanıcı adı artık kullanımda.';
    else if (a.tur === 'okul' && schoolMap_()[String(a.okulKodu)]) o.conflict = 'Bu kurum kodu sistemde zaten kayıtlı: ' + schoolMap_()[String(a.okulKodu)].okulAdi + '.';
    else if (a.tur === 'ogretmen' && !schoolMap_()[String(a.okulKodu)]) o.conflict = 'Okul sistemde artık yok.';
  }
  return o;
}
function aListApplications(u, p) {
  if (u.role === 'ogretmen') throw fail_('Yetkiniz yok.');
  var all = p.durum === 'hepsi';
  var list = table_('Basvurular').filter(function (a) { return appVisible_(u, a) && (all || a.durum === 'beklemede'); });
  list.sort(function (a, b) { return String(b.createdAt) < String(a.createdAt) ? -1 : 1; });
  return { applications: list.slice(0, 300).map(appForClient_), pending: pendingFor_(u) };
}
function aDecideApplication(u, p) {
  if (u.role === 'ogretmen') throw fail_('Yetkiniz yok.');
  var a = findApp_(p.id); if (!a || !appVisible_(u, a)) throw fail_('Başvuru bulunamadı.');
  if (a.durum !== 'beklemede') throw fail_('Bu başvuru zaten karara bağlanmış.');
  var karar = p.karar === 'onay' ? 'onay' : p.karar === 'red' ? 'red' : ''; if (!karar) throw fail_('Karar: onay veya red.');
  if (karar === 'onay') {
    if (findUser_(a.username)) throw fail_('Bu kullanıcı adı artık kullanımda. Başvuruyu reddedin; başvuran başka bir adla yeniden başvurabilir.');
    var code = String(a.okulKodu);
    if (a.tur === 'okul') {
      if (schoolMap_()[code]) throw fail_('Bu kurum kodu sistemde zaten kayıtlı. Başvuruyu reddedin.');
      append_('Schools', [{ okulKodu: code, okulAdi: a.okulAdi, il: a.il, ilce: a.ilce, tur: a.duzey, mudur: a.mudur, telefon: String(a.telefon || ''), eposta: a.eposta, adres: a.adres }]);
      bumpSchools_();
      createUser_({ username: a.username, name: a.name, role: 'okul', il: a.il, ilce: a.ilce, okulKodu: code, salt: a.salt, hash: a.hash, active: true, telefon: a.telefon, eposta: a.eposta, createdBy: u.username });
    } else {
      var sch = schoolMap_()[code]; if (!sch) throw fail_('Okul sistemde bulunamadı. Başvuruyu reddedin.');
      createUser_({ username: a.username, name: a.name, role: 'ogretmen', il: sch.il, ilce: sch.ilce, okulKodu: code, salt: a.salt, hash: a.hash, active: true, brans: a.brans, telefon: a.telefon, eposta: a.eposta, createdBy: u.username });
    }
    a.salt = ''; a.hash = '';   // hesap açıldı; başvurudaki parola özeti silinir
  }
  a.durum = karar; a.decidedBy = u.username; a.decidedAt = now_(); a.not = clean_(p.not, 200);
  updateRow_('Basvurular', a);
  return { id: a.id, durum: karar, pending: pendingFor_(u) };
}

/* ============================ ÖĞRENCİ / VELİ SORGULAMA (girişsiz) ============================ */
/* Veli/öğrenci: okul → sınıf → okul numarası. Yalnızca sınavı açan kişi "öğrenci/veli sorgulamasına aç" demişse sonuç görünür.
 * Öğrencide veli kodu tanımlıysa (isteğe bağlı) o da istenir. Kimlik doğrulaması her sorguda yeniden yapılır; oturum tutulmaz.
 * Korumalar: öğrenci başına hatalı deneme kilidi, okul başına ve genel saatlik sınır, hata iletisinde "yok" ile "yanlış" ayrımı yapılmaz,
 * ad maskelenir, başkasının verisi (yalnızca toplu ortalama) döndürülmez. */
var PORTAL_FAIL_STUDENT = 6, PORTAL_PER_SCHOOL_HOUR = 600, PORTAL_PER_HOUR = 6000, PORTAL_MAX_EXAMS = 12;
function sinifKey_(v) { return trKey_(v); }
function sinifCmp_(a, b) { var x = parseInt(a, 10), y = parseInt(b, 10); if (!isNaN(x) && !isNaN(y) && x !== y) return x - y; return trCmp_(String(a), String(b)); }
function maskName_(s) { return str_(s).split(/\s+/).filter(Boolean).map(function (w) { return w.length <= 2 ? w.charAt(0) + '*' : w.slice(0, 2) + new Array(Math.min(w.length - 1, 8)).join('*'); }).join(' '); }
function prePortal_(req) {
  if (str_(req.website)) return;
  var code = normCode_(req.okulKodu).slice(0, 20), msg = 'Sorgulama şu an çok yoğun. Lütfen biraz sonra tekrar deneyin.';
  throttle_('pl_all_' + hourKey_(), PORTAL_PER_HOUR, 3600, msg);
  throttle_('pl_sch_' + code + '_' + hourKey_(), PORTAL_PER_SCHOOL_HOUR, 3600, msg);
}
/** Okulun sınıfları (sorgulama formundaki seçim listesi) */
function aPortalClasses(_, p) {
  var code = normCode_(p.okulKodu), sch = schoolMap_()[code]; if (!sch) throw fail_('Okul bulunamadı.');
  var cache = CacheService.getScriptCache(), key = 'pcls_' + (PropertiesService.getScriptProperties().getProperty('STUVER') || '0') + '_' + code.slice(0, 20), hit = cache.get(key);
  if (hit) { try { return JSON.parse(hit); } catch (e) { } }
  var seen = {}, list = [];
  table_('Students').forEach(function (s) { if (String(s.okulKodu) === code && str_(s.sinif)) { var k = sinifKey_(s.sinif); if (!seen[k]) { seen[k] = 1; list.push(str_(s.sinif)); } } });
  list.sort(sinifCmp_);
  var out = { okulAdi: sch.okulAdi, siniflar: list }; cache.put(key, JSON.stringify(out), 600); return out;
}
function avg_(arr) { if (!arr.length) return null; var t = 0; arr.forEach(function (v) { t += v; }); return round_(t / arr.length); }
function aPortalLookup(_, p) {
  var generic = 'Bilgiler eşleşmedi. Okulu, sınıfı ve okul numarasını kontrol edin.';
  var code = normCode_(p.okulKodu).slice(0, 20), no = normNo_(p.ogrNo).slice(0, 20), sinif = str_(p.sinif).slice(0, 20), cache = CacheService.getScriptCache(), fk = 'pl_f_' + code + '_' + no;
  if (str_(p.website)) throw fail_(generic);
  if (Number(cache.get(fk) || 0) >= PORTAL_FAIL_STUDENT) throw fail_('Çok fazla hatalı deneme yapıldı. Bir saat sonra tekrar deneyin ya da okulunuza başvurun.', 'THROTTLE');
  var sch = schoolMap_()[code], st = sch && no ? studentMap_()[code + '|' + no] : null, ok = !!st && !!sinif && sinifKey_(st.sinif) === sinifKey_(sinif);
  if (!ok) { cache.put(fk, String(Number(cache.get(fk) || 0) + 1), 3600); throw fail_(generic); }
  var vk = str_(st.veliKodu);
  if (vk && str_(p.veliKodu).replace(/\s+/g, '') !== vk) { cache.put(fk, String(Number(cache.get(fk) || 0) + 1), 3600); throw fail_('Bu öğrenci için okulun verdiği veli kodu gerekli (ya da hatalı).', 'VELIKODU'); }
  cache.remove(fk);
  var exams = table_('Exams').filter(function (e) { var c = safeParse_(e.config); return c && c.veli === true && e.status !== 'draft' && examCovers_(e, sch); });
  exams.sort(function (a, b) { return String(dateStr_(b.date)) < String(dateStr_(a.date)) ? -1 : 1; });
  var sk = sinifKey_(st.sinif), items = [];
  exams.slice(0, PORTAL_MAX_EXAMS).forEach(function (ex) {
    var c = computeExam_(ex), me = null;
    for (var i = 0; i < c.rows.length; i++) if (c.rows[i].okulKodu === code && c.rows[i].ogrNo === no) { me = c.rows[i]; break; }
    if (!me) return;
    var cls = c.rows.filter(function (r) { return r.okulKodu === code && sinifKey_(r.sinif) === sk; }), okl = c.rows.filter(function (r) { return r.okulKodu === code; });
    var nSec = c.cfg.sections.length, showKeys = (safeParse_(ex.config) || {}).showKeys !== false;
    var secOrt = function (rows, j) { return avg_(rows.map(function (r) { return r.secNets[j]; })); };
    items.push({
      examId: ex.examId, name: ex.name, date: dateStr_(ex.date), method: c.cfg.method, choices: c.cfg.choices, penalty: c.cfg.penalty,
      puan: me.puan, net: me.net, D: me.D, Y: me.Y, B: me.B, booklet: me.booklet,
      sections: c.cfg.sections.map(function (s, j) { return { name: s.name, count: s.count, D: me.sec[j][0], Y: me.sec[j][1], B: me.sec[j][2], net: me.sec[j][3], okulOrt: secOrt(okl, j), genelOrt: secOrt(c.rows, j) }; }),
      sira: { sinif: [me.rSinif, me.rSinifN], okul: [me.rOkul, me.rOkulN], ilce: [me.rIlce, me.rIlceN], il: [me.rIl, me.rIlN], genel: [me.rGenel, me.rGenelN] },
      ort: { sinifN: cls.length, sinifNet: cls.length >= 3 ? avg_(cls.map(function (r) { return r.net; })) : null, sinifPuan: cls.length >= 3 ? avg_(cls.map(function (r) { return r.puan; })) : null,
        okulNet: avg_(okl.map(function (r) { return r.net; })), okulPuan: avg_(okl.map(function (r) { return r.puan; })), genelNet: avg_(c.rows.map(function (r) { return r.net; })), genelPuan: avg_(c.rows.map(function (r) { return r.puan; })) },
      answers: me.answers, key: showKeys ? (c.cfg.keys[me.booklet] || '') : null, multiIsWrong: !!c.cfg.multiIsWrong,
      kazanimlar: (safeParse_(ex.config) || {}).kazanimlar || [],
      eylemPlani: buildPortalActionPlan_(c.cfg, me, (safeParse_(ex.config) || {}).kazanimlar || [])
    });
  });
  return { ogrenci: { okulAdi: sch.okulAdi, il: sch.il, ilce: sch.ilce, sinif: str_(st.sinif), ogrNo: no, ad: maskName_((str_(st.ad) + ' ' + str_(st.soyad)).trim()) }, exams: items };
}

/* ============================ VELİ WHATSAPP: GÖNDERİM KUYRUĞU ============================ */
var WA_MAX_ROWS = 1000, WA_MAX_SKIP_LIST = 200;
function waKey_(examId, code, no, kime) { return [examId, code, no, kime].join('|'); }

/** Bir sınav + okul (+ sınıf / seçili öğrenciler) için velilere gidecek mesaj verisini hazırlar. Metni istemci şablondan kurar (kuyruk = {id,n,t,ad}).
 *  Her öğrenci için: anne/baba numarası, veli kodu ve o sınavdaki sonuç özeti. Veli kodu olmayanlara (mesaja yazılabilsin diye) üretilir (p.kodUret !== false).
 *  Önceden gönderilmiş (Gönderim sayfasında kaydı olan) alıcılar p.tekrar === true değilse atlanır. Öğretmen hesabı kullanamaz. */
function aWaQueue(u, p) {
  if (u.role === 'ogretmen') throw fail_('Veli mesajlarını okul yöneticisi hazırlar.');
  var code = normCode_(p.okulKodu), sch = schoolMap_()[code];
  if (!sch || !canSeeSchool_(u, sch)) throw fail_('Bu okul için yetkiniz yok.');
  var ex = requireExam_(u, p.examId);
  if (ex.status === 'draft') throw fail_('Taslak durumundaki sınavın sonuçları velilere gönderilemez.');
  if (!examCovers_(ex, sch)) throw fail_('Bu sınav seçilen okulu kapsamıyor.');
  var hedef = ['anne', 'baba'].indexOf(p.hedef) >= 0 ? p.hedef : 'hepsi', tekrar = p.tekrar === true, kodUret = p.kodUret !== false;
  var sinifF = str_(p.sinif) ? sinifKey_(p.sinif) : '', pick = null;
  if (Array.isArray(p.ogrNos) && p.ogrNos.length) { pick = {}; p.ogrNos.slice(0, 5000).forEach(function (x) { pick[normNo_(x)] = 1; }); }
  var cfgx = safeParse_(ex.config) || {}, c = computeExam_(ex), byNo = {};
  c.rows.forEach(function (r) { if (r.okulKodu === code) byNo[r.ogrNo] = r; });
  var sent = {};
  table_('Gonderim').forEach(function (g) { if (String(g.examId) === String(ex.examId) && String(g.okulKodu) === code) sent[str_(g.key)] = 1; });
  var students = table_('Students').filter(function (s) {
    if (String(s.okulKodu) !== code) return false;
    if (sinifF && sinifKey_(s.sinif) !== sinifF) return false;
    return !pick || pick[normNo_(s.ogrNo)];
  });
  students.sort(function (a, b) { return sinifCmp_(a.sinif, b.sinif) || (Number(a.ogrNo) - Number(b.ogrNo)) || trCmp_(String(a.ogrNo), String(b.ogrNo)); });
  var rows = [], skipped = [], counts = { ogrenci: students.length, hazir: 0, telefonYok: 0, sonucYok: 0, gonderilmis: 0, gecersiz: 0 }, need = {}, created = 0;
  function skip(s, reason, k) { counts[k]++; if (skipped.length < WA_MAX_SKIP_LIST) skipped.push({ ogrNo: String(s.ogrNo), ad: s.ad, soyad: s.soyad, sinif: s.sinif, neden: reason }); }
  students.forEach(function (s) {
    var no = normNo_(s.ogrNo), me = byNo[no];
    if (no.indexOf('|') >= 0) { skip(s, 'Öğrenci numarası geçersiz karakter içeriyor', 'gecersiz'); return; }
    if (!me) { skip(s, 'Bu sınavda sonucu yok', 'sonucYok'); return; }
    var anne = str_(s.anneTel), baba = str_(s.babaTel), tg = [], same = !!anne && anne === baba;
    if (anne && hedef !== 'baba') tg.push({ kime: 'anne', n: anne, ikisi: same && hedef === 'hepsi' });
    if (baba && hedef !== 'anne' && !(same && hedef === 'hepsi')) tg.push({ kime: 'baba', n: baba, ikisi: false });
    if (!tg.length) { skip(s, 'Seçilen alıcı için telefon kayıtlı değil', 'telefonYok'); return; }
    tg.forEach(function (t) {
      t.key = waKey_(ex.examId, code, no, t.kime);
      t.sent = !!sent[t.key] || (t.kime === 'baba' && same && !!sent[waKey_(ex.examId, code, no, 'anne')]);
    });
    var todo = tekrar ? tg : tg.filter(function (t) { return !t.sent; });
    if (!todo.length) { skip(s, 'Daha önce gönderildi', 'gonderilmis'); return; }
    var vk = str_(s.veliKodu);
    if (!vk && kodUret) { vk = newVeliKod_(); need[s._r] = vk; s.veliKodu = vk; created++; }
    counts.hazir++;
    var cn = c.cfg.sections;
    rows.push({
      ogrNo: no, ad: str_(s.ad), soyad: str_(s.soyad), sinif: str_(s.sinif), veliKodu: vk,
      targets: todo.map(function (t) { return { kime: t.kime, n: t.n, key: t.key, ikisi: t.ikisi, sent: t.sent }; }),
      sonuc: {
        puan: me.puan, net: me.net, D: me.D, Y: me.Y, B: me.B, booklet: me.booklet,
        sira: { sinif: [me.rSinif, me.rSinifN], okul: [me.rOkul, me.rOkulN], ilce: [me.rIlce, me.rIlceN], il: [me.rIl, me.rIlN], genel: [me.rGenel, me.rGenelN] },
        sections: cn.map(function (sec, j) { return { name: sec.name, count: sec.count, D: me.sec[j][0], Y: me.sec[j][1], B: me.sec[j][2], net: me.sec[j][3] }; })
      }
    });
  });
  writeVeliCodes_(need);
  var truncated = rows.length > WA_MAX_ROWS; if (truncated) rows = rows.slice(0, WA_MAX_ROWS);
  return {
    okulAdi: sch.okulAdi, okulKodu: code, il: sch.il, ilce: sch.ilce,
    exam: { examId: ex.examId, name: ex.name, date: dateStr_(ex.date), method: c.cfg.method, veliAcik: cfgx.veli === true },
    rows: rows, skipped: skipped, counts: counts, codesCreated: created, truncated: truncated
  };
}


/** Veli/öğrenci sorgulama ekranı için sınav bazlı otomatik eylem planı üretir. */
function buildPortalActionPlan_(cfg, me, kazList) {
  var byQ = {};
  (kazList || []).forEach(function (k) { byQ[Number(k.soru)] = k; });
  var keyStr = (cfg.keys && cfg.keys[me.booklet]) || (cfg.keys && cfg.keys[Object.keys(cfg.keys)[0]]) || '';
  var ansStr = String(me.answers || '');
  var grouped = {};
  if (keyStr && ansStr) {
    for (var q = 1; q <= keyStr.length; q++) {
      var kCh = keyStr.charAt(q - 1), aCh = ansStr.charAt(q - 1) || '-';
      if (!kCh || kCh === '.' || kCh === '*') continue;
      if (aCh !== kCh) {
        var kz = byQ[q];
        var ders = (kz && kz.ders) ? kz.ders : '';
        if (!ders) {
          var acc = 0;
          for (var si = 0; si < cfg.sections.length; si++) {
            acc += cfg.sections[si].count;
            if (q <= acc) { ders = cfg.sections[si].name; break; }
          }
        }
        var konu = kz ? (kz.konu || kz.kod || (q + '. soru')) : (ders + ' — ' + q + '. soru');
        var gk = ders + '||' + konu;
        if (!grouped[gk]) grouped[gk] = { ders: ders || 'Genel', kod: kz ? (kz.kod || '') : '', konu: konu, yanlis: 0, bos: 0, sorular: [] };
        if (aCh === '-' || aCh === '*') grouped[gk].bos++; else grouped[gk].yanlis++;
        grouped[gk].sorular.push(q);
      }
    }
  }
  return Object.keys(grouped).slice(0, 8).map(function (k, idx) {
    var g = grouped[k];
    return {
      oncelik: idx + 1,
      ders: g.ders,
      kod: g.kod,
      konu: g.konu,
      detay: g.yanlis + ' yanlış, ' + g.bos + ' boş (Sorular: ' + g.sorular.join(', ') + ') → Konu tekrarı + 25 kazanım sorusu.'
    };
  });
}

/** Veli Gmail/e-posta + telefon + okul/öğrenci no + veli kodu ile kalıcı veli hesabı oluşturur. */
function aVeliRegister(_, p) {
  if (str_(p.website)) return { ok: true };
  var email = str_(p.email).toLowerCase(), tel = telNorm_(p.telefon, 'Veli telefonu');
  if (!validEmail_(email)) throw fail_('Geçerli bir Gmail / e-posta adresi girin.');
  var pass = String(p.password || '');
  if (pass.length < 6) throw fail_('Parola en az 6 karakter olmalı.');
  var code = normCode_(p.okulKodu), no = normNo_(p.ogrNo), sinif = str_(p.sinif);
  var sch = schoolMap_()[code], st = sch && no ? studentMap_()[code + '|' + no] : null;
  if (!st || !sinif || sinifKey_(st.sinif) !== sinifKey_(sinif)) throw fail_('Okul, sınıf veya öğrenci numarası eşleşmedi.');
  var vk = str_(st.veliKodu);
  if (vk && str_(p.veliKodu).replace(/\s+/g, '') !== vk) throw fail_('Bu öğrenci için okulun verdiği veli kodu gerekli veya hatalı.', 'VELIKODU');
  var existing = table_('VeliHesap').filter(function (v) { return str_(v.email).toLowerCase() === email; })[0];
  if (existing) throw fail_('Bu e-posta adresi ile zaten kayıt yapılmış. Giriş yapabilirsiniz.');
  var salt = Utilities.getUuid().slice(0, 12);
  append_('VeliHesap', [{ email: email, telefon: tel, okulKodu: code, ogrNo: no, salt: salt, hash: hashPass_(salt, pass), ad: clean_(p.ad, 80) || (st.ad + ' ' + st.soyad).trim(), createdAt: now_() }]);
  return { registered: true, email: email, okulKodu: code, ogrNo: no };
}

/** Veli Gmail/e-posta + parola ile giriş yapar ve doğrudan öğrencisinin sonuçlarını + eylem planını alır. */
function aVeliLogin(_, p) {
  var email = str_(p.email).toLowerCase(), pass = String(p.password || '');
  var v = table_('VeliHesap').filter(function (x) { return str_(x.email).toLowerCase() === email; })[0];
  if (!v || hashPass_(String(v.salt), pass) !== String(v.hash)) throw fail_('E-posta veya parola hatalı.');
  var st = studentMap_()[String(v.okulKodu) + '|' + normNo_(v.ogrNo)];
  if (!st) throw fail_('Kayıtlı öğrenci bulunamadı; okulunuzla iletişime geçin.');
  return aPortalLookup(null, { okulKodu: v.okulKodu, sinif: st.sinif, ogrNo: v.ogrNo, veliKodu: st.veliKodu });
}

/** Eklentinin "gönderildi" diye bildirdiği alıcı anahtarlarını (examId|okulKodu|ogrNo|anne/baba) Gönderim sayfasına işler; bir daha kuyruğa girmezler. Tekrar çağrı zarar vermez. */
function aWaMarkSent(u, p) {
  if (u.role === 'ogretmen') throw fail_('Yetkiniz yok.');
  var code = normCode_(p.okulKodu), sch = schoolMap_()[code];
  if (!sch || !canSeeSchool_(u, sch)) throw fail_('Bu okul için yetkiniz yok.');
  var ex = requireExam_(u, p.examId), have = {}, st = studentMap_(), add = [], ignored = 0, already = 0, failed = 0, stamp = now_();
  table_('Gonderim').forEach(function (g) { if (String(g.examId) === String(ex.examId) && String(g.okulKodu) === code && str_(g.durum || 'ok') === 'ok') have[str_(g.key)] = 1; });
  var items = Array.isArray(p.results) && p.results.length ? p.results : (Array.isArray(p.keys) ? p.keys.map(function (k) { return { key: k, status: 'ok' }; }) : []);
  items.slice(0, 2000).forEach(function (it) {
    var k = str_(it && it.key), a = k.split('|'), stVal = it && it.status === 'err' ? 'err' : 'ok';
    if (a.length !== 4 || a[0] !== String(ex.examId) || a[1] !== code || (a[3] !== 'anne' && a[3] !== 'baba') || !st[code + '|' + a[2]]) { ignored++; return; }
    if (stVal === 'ok' && have[k]) { already++; return; }
    if (stVal === 'ok') have[k] = 1; else failed++;
    add.push({ key: k, examId: a[0], okulKodu: a[1], ogrNo: a[2], kime: a[3], zaman: stamp, kullanici: u.username, durum: stVal, hataKodu: clean_(it.code, 30), hataMesaj: clean_(it.error, 200) });
  });
  append_('Gonderim', add);
  return { marked: add.length - failed, failed: failed, already: already, ignored: ignored };
}

/* ============================ OKUL / ÖĞRENCİ: TEK KAYIT EKLE · DÜZENLE · SİL ============================ */

/** Tek satırlık (ardışık) silmeleri gruplayarak sayfa satırlarını siler (yüzlerce öğrenciyi satır satır silmek dakikalar sürer). */
function deleteRows_(name, list) {
  if (!list.length) return 0;
  var sh = sheet_(name), rows = list.map(function (o) { return o._r; }).sort(function (a, b) { return b - a; }), i = 0, n = 0;
  if (sh.getMaxRows() - rows.length < 3) sh.insertRowsAfter(sh.getMaxRows(), 100);   // E-Tablo tüm satırların silinmesine izin vermez
  while (i < rows.length) {
    var end = rows[i], start = end; i++;
    while (i < rows.length && rows[i] === start - 1) { start = rows[i]; i++; }
    sh.deleteRows(start, end - start + 1); n += end - start + 1;
  }
  dirty_(name); return n;
}

/** Tek okul ekler ya da günceller. p.yeni === true ise var olan kodun üzerine yazmaz. Okul kodu anahtardır, değiştirilemez. */
function aSaveSchool(u, p) {
  if (u.role === 'okul' || u.role === 'ogretmen') throw fail_('Okul ekleme/düzenleme yetkiniz yok. Okul kaydı için "Üye ol" bağlantısını kullanın.');
  var code = normCode_(p.okulKodu);
  if (!/^[0-9A-Za-z._-]{2,20}$/.test(code)) throw fail_('Okul kodu 2-20 karakter olmalı (harf, rakam, nokta, alt çizgi, tire).');
  var name = clean_(p.okulAdi, 120); if (name.length < 3) throw fail_('Okul adını yazın.');
  var il = canonIl_(p.il); if (!il) throw fail_('Geçerli bir il yazın (örn. İstanbul).');
  var ilce = canonIlce_(il, p.ilce); if (ilce.length < 2) throw fail_('İlçe gerekli.');
  if (!canSeeSchool_(u, { okulKodu: code, il: il, ilce: ilce })) throw fail_('Bu il/ilçe yetki alanınızın dışında.');
  var tur = DUZEYLER.indexOf(str_(p.tur)) >= 0 ? str_(p.tur) : '';
  var ex = null; table_('Schools').forEach(function (x) { if (String(x.okulKodu) === code) ex = x; });
  var info = { mudur: clean_(p.mudur, 80), telefon: digits_(p.telefon).slice(0, 15), eposta: clean_(p.eposta, 120).toLowerCase(), adres: clean_(p.adres, 300) };
  if (info.eposta && !validEmail_(info.eposta)) throw fail_('E-posta adresi geçersiz.');
  if (ex) {
    if (p.yeni === true) throw fail_('Bu okul kodu zaten kayıtlı: ' + ex.okulAdi + '.');
    if (!canSeeSchool_(u, ex)) throw fail_('Bu okulu düzenleme yetkiniz yok.');
    ex.okulAdi = name; ex.il = il; ex.ilce = ilce; if (tur) ex.tur = tur;
    if (p.mudur !== undefined) ex.mudur = info.mudur; if (p.telefon !== undefined) ex.telefon = info.telefon; if (p.eposta !== undefined) ex.eposta = info.eposta; if (p.adres !== undefined) ex.adres = info.adres;
    updateRow_('Schools', ex); bumpSchools_();
    return { okulKodu: code, updated: true };
  }
  append_('Schools', [{ okulKodu: code, okulAdi: name, il: il, ilce: ilce, tur: tur, mudur: info.mudur, telefon: info.telefon, eposta: info.eposta, adres: info.adres }]);
  bumpSchools_();
  return { okulKodu: code, added: true };
}

/** Okulu ve öğrenci listesini siler. Okula bağlı AKTİF kullanıcı varsa reddeder (önce Kullanıcılar sekmesinden pasifleştirilmeli).
 *  Eski sınav sonuçları silinmez; okul adı yerine kod görünür. */
function aDeleteSchool(u, p) {
  if (u.role === 'okul' || u.role === 'ogretmen') throw fail_('Okul silme yetkiniz yok.');
  var code = normCode_(p.okulKodu), sch = null; table_('Schools').forEach(function (x) { if (String(x.okulKodu) === code) sch = x; });
  if (!sch) throw fail_('Okul bulunamadı.');
  if (!canSeeSchool_(u, sch)) throw fail_('Bu okulu silme yetkiniz yok.');
  var users = table_('Users').filter(function (x) { return (x.role === 'okul' || x.role === 'ogretmen') && String(x.okulKodu) === code && String(x.active).toLowerCase() !== 'false'; });
  if (users.length) throw fail_('Bu okula bağlı ' + users.length + ' aktif kullanıcı var (' + users.slice(0, 3).map(function (x) { return x.username; }).join(', ') + (users.length > 3 ? '…' : '') + '). Önce Kullanıcılar sekmesinden pasifleştirin.', 'INUSE');
  var stu = table_('Students').filter(function (s) { return String(s.okulKodu) === code; });
  deleteRows_('Students', stu); deleteRows_('Schools', [sch]);
  bumpSchools_(); bumpStudents_();
  return { okulKodu: code, deletedStudents: stu.length };
}

/** Tek öğrenci ekler/günceller. p.yeni === true: var olan numaranın üzerine yazmaz. p.eskiNo: numarayı değiştirmek için eski numara (eski sonuçlar eski numarada kalır). */
function aSaveStudent(u, p) {
  if (u.role === 'ogretmen') throw fail_('Öğrenci listesini okul yöneticisi düzenler.');
  var code = normCode_(p.okulKodu), sch = schoolMap_()[code];
  if (!canSeeSchool_(u, sch)) throw fail_('Bu okul için yetkiniz yok.');
  var no = normNo_(p.ogrNo); if (!/^\d{1,12}$/.test(no)) throw fail_('Öğrenci numarası yalnızca rakam olmalı (en çok 12 hane).');
  var ad = clean_(p.ad, 60); if (!ad) throw fail_('Öğrencinin adı gerekli.');
  var soyad = clean_(p.soyad, 60), sinif = clean_(p.sinif, 20), vk = clean_(p.veliKodu, 20).replace(/\s+/g, '');
  var anneTel = p.anneTel === undefined ? undefined : telNorm_(p.anneTel, 'Anne telefonu'), babaTel = p.babaTel === undefined ? undefined : telNorm_(p.babaTel, 'Baba telefonu');
  var idx = {}; table_('Students').forEach(function (s) { if (String(s.okulKodu) === code) idx[normNo_(s.ogrNo)] = s; });
  var hasOld = p.eskiNo !== undefined && p.eskiNo !== '', old = hasOld ? normNo_(p.eskiNo) : no, rec = idx[old];
  if (hasOld && !rec) throw fail_('Düzenlenen öğrenci bulunamadı.');
  if (old !== no && idx[no]) throw fail_('Bu okulda ' + no + ' numaralı başka bir öğrenci var.');
  if (!hasOld && rec && p.yeni === true) throw fail_('Bu okulda ' + no + ' numaralı öğrenci zaten var (' + (rec.ad + ' ' + rec.soyad).trim() + ').');
  if (rec) {
    rec.ogrNo = no; rec.ad = ad; rec.soyad = soyad; rec.sinif = sinif; if (p.veliKodu !== undefined) rec.veliKodu = vk;
    if (anneTel !== undefined) rec.anneTel = anneTel; if (babaTel !== undefined) rec.babaTel = babaTel;
    updateRow_('Students', rec); bumpStudents_(); return { ogrNo: no, updated: true };
  }
  append_('Students', [{ okulKodu: code, ogrNo: no, ad: ad, soyad: soyad, sinif: sinif, veliKodu: vk, anneTel: anneTel || '', babaTel: babaTel || '' }]);
  bumpStudents_(); return { ogrNo: no, added: true };
}

/** Seçilen öğrencileri siler (p.ogrNolar: dizi, en çok 2000). Eski sınav sonuçları silinmez. */
function aDeleteStudents(u, p) {
  if (u.role === 'ogretmen') throw fail_('Öğrenci listesini okul yöneticisi düzenler.');
  var code = normCode_(p.okulKodu), sch = schoolMap_()[code];
  if (!canSeeSchool_(u, sch)) throw fail_('Bu okul için yetkiniz yok.');
  var nos = {}, n = 0; (p.ogrNolar || []).slice(0, 2000).forEach(function (v) { var k = normNo_(v); if (k) { nos[k] = 1; n++; } });
  if (!n) throw fail_('Silinecek öğrenci seçilmedi.');
  var hit = table_('Students').filter(function (s) { return String(s.okulKodu) === code && nos[normNo_(s.ogrNo)]; });
  var del = deleteRows_('Students', hit); bumpStudents_();
  return { deleted: del };
}

/* ============================ YAPAY ZEKÂ: HARİCİ FORM ANLAMLANDIRMA (ÇOKLU SAĞLAYICI) ============================ */
/* Yapay zekâ yalnızca ANLAM önerir (ders adı, şık harfleri, bloğun rolü). Baloncukların konumu tarayıcıdaki görüntü işlemeyle (milimetrik) bulunur;
 * model konum üretmez. Anahtarlar yalnızca Betik Özellikleri'nde durur, istemciye hiç gönderilmez (arayüzde yalnızca son 4 hane görünür).
 *
 * Sağlayıcılar ve Betik Özellikleri (hepsi isteğe bağlı; anahtarı olan sağlayıcı kullanılır, anahtarsız sistem yapay zekâsız da çalışır):
 *   Anthropic : ANTHROPIC_API_KEY   [ANTHROPIC_MODEL, ANTHROPIC_VERSION, ANTHROPIC_AUTH (bearer|x-api-key), ANTHROPIC_URL, ANTHROPIC_WORKSPACE_ID]
 *   Gemini    : GEMINI_API_KEY (veya GOOGLE_API_KEY)   [GEMINI_MODEL]
 *   OpenAI    : OPENAI_API_KEY   [OPENAI_MODEL]
 *   Uyumlu    : COMPAT_API_KEY + COMPAT_BASE_URL (örn. https://openrouter.ai/api/v1) + COMPAT_MODEL   [COMPAT_NAME]  (OpenRouter, Mistral, DeepSeek, xAI, Groq...)
 *   Seçim     : AI_PROVIDER = auto | anthropic | gemini | openai | compat      AI_TIER = auto | fast | balanced | best
 * Model adı yazılmazsa her sağlayıcının KENDİ model listesi (GET /models) sorulur, adlardan seviye (hızlı / dengeli / en güçlü) ve sürüm çıkarılır,
 * en yeni sürüm seçilir; liste 6 saat önbellekte tutulur. Böylece yeni model çıkınca kod değişmeden otomatik güncel sürüme geçilir.
 * Seçilen model hata verirse sıradaki model / sağlayıcı denenir (en çok AI_MAX_TRIES deneme). */
var AI_USER_PER_HOUR = 40, AI_ALL_PER_DAY = 1000, AI_MAX_B64 = 4500000, AI_MAX_TRIES = 4, AI_MODELS_TTL = 21600;
var AI_ROLES = ['questions', 'studentNo', 'schoolCode', 'booklet', 'name', 'surname', 'ignore'];
var AI_TOK_ = 3000;   // çıktı belirteç sınırı; tam yerleşim (mode:'layout') isteğinde büyür
var AI_TIERS = ['fast', 'balanced', 'best'];
var AI_PROVIDERS = [
  { id: 'anthropic', name: 'Anthropic (Claude)', keyProps: ['ANTHROPIC_API_KEY'], modelProp: 'ANTHROPIC_MODEL', defaults: { fast: 'claude-haiku-5-5', balanced: 'claude-sonnet-5-5', best: 'claude-opus-5-5' } },
  { id: 'gemini', name: 'Google (Gemini)', keyProps: ['GEMINI_API_KEY', 'GOOGLE_API_KEY'], modelProp: 'GEMINI_MODEL', defaults: { fast: 'gemini-3.5-flash-lite', balanced: 'gemini-3.6-flash', best: 'gemini-3.1-pro-preview' } },
  { id: 'openai', name: 'OpenAI', keyProps: ['OPENAI_API_KEY'], modelProp: 'OPENAI_MODEL', defaults: { fast: 'gpt-6-luna', balanced: 'gpt-6.1-sol', best: 'gpt-6-astra' } },
  { id: 'compat', name: 'OpenAI uyumlu (özel)', keyProps: ['COMPAT_API_KEY'], modelProp: 'COMPAT_MODEL', defaults: {} }
];
function aiDef_(id) { for (var i = 0; i < AI_PROVIDERS.length; i++) if (AI_PROVIDERS[i].id === id) return AI_PROVIDERS[i]; return null; }
function aiModelName_(v) { v = str_(v); return /^[A-Za-z0-9][A-Za-z0-9._:\/\-]{1,99}$/.test(v) ? v : ''; }
function aiBase_(v) { v = str_(v).replace(/\/+$/, ''); return /^https:\/\/[^\s"'<>]{4,200}$/.test(v) ? v : ''; }

/** Tüm sağlayıcıların ayarı (anahtarlar yalnızca sunucuda). */
function aiCfg_() {
  var ps = PropertiesService.getScriptProperties(), list = [];
  AI_PROVIDERS.forEach(function (d) {
    var key = ''; d.keyProps.forEach(function (k) { if (!key) key = str_(ps.getProperty(k)); });
    var mv = trLower_(str_(ps.getProperty(d.modelProp))), c = { id: d.id, name: d.name, def: d, key: key, hasKey: !!key, model: mv === 'auto' ? '' : aiModelName_(ps.getProperty(d.modelProp)) };
    if (d.id === 'anthropic') {
      c.version = str_(ps.getProperty('ANTHROPIC_VERSION')); c.auth = trLower_(str_(ps.getProperty('ANTHROPIC_AUTH')));
      c.url = str_(ps.getProperty('ANTHROPIC_URL')) || 'https://api.anthropic.com/v1/messages'; c.workspace = str_(ps.getProperty('ANTHROPIC_WORKSPACE_ID'));
    }
    if (d.id === 'compat') { c.base = aiBase_(ps.getProperty('COMPAT_BASE_URL')); c.label = clean_(ps.getProperty('COMPAT_NAME'), 40); if (c.label) c.name = c.label; }
    c.ok = !!key && (d.id !== 'compat' || (!!c.base && !!c.model));
    list.push(c);
  });
  var pv = trLower_(str_(ps.getProperty('AI_PROVIDER'))), tr = trLower_(str_(ps.getProperty('AI_TIER')));
  return { providers: list, provider: pv === 'auto' || aiDef_(pv) ? pv : 'auto', tier: AI_TIERS.indexOf(tr) >= 0 ? tr : 'auto' };
}
function aiKeyHint_(k) { return !k ? '' : (k.length >= 12 ? '••••' + k.slice(-4) : '••••'); }
function aiKeyTag_(k) { var h = 7; for (var i = 0; i < k.length; i++) h = (h * 31 + k.charCodeAt(i)) % 1000003; return h.toString(36); }

/* ---- HTTP ---- */
function aiHttp_(method, url, headers, body) {
  var o = { method: method, headers: headers || {}, muteHttpExceptions: true };
  if (body) { o.contentType = 'application/json'; o.payload = JSON.stringify(body); }
  var r;
  try { r = UrlFetchApp.fetch(url, o); }
  catch (e) {
    var em = String(e && e.message || e);
    if (/external_request|izinler.{0,40}yeterli|not have permission|permission.{0,40}UrlFetchApp|UrlFetchApp.{0,60}(permission|izin)/i.test(em)) throw fail_(AI_SCOPE_MSG, 'AISCOPE');
    throw fail_('Sağlayıcıya bağlanılamadı: ' + em.replace(/\s+/g, ' ').slice(0, 200), 'AIERR');
  }
  var txt = String(r.getContentText() || '');
  return { code: r.getResponseCode(), text: txt, json: safeParse_(txt) };
}
var AI_SCOPE_MSG = 'Apps Script, dış bağlantı (UrlFetchApp) izni almamış. Düzeltmek için: (1) Apps Script → Proje ayarları → "appsscript.json bildirim dosyasını düzenleyicide göster" kutusunu işaretleyin, appsscript.json içindeki oauthScopes listesinde ' +
  '"https://www.googleapis.com/auth/script.external_request" bulunsun (pakettekini yapıştırın); (2) düzenleyicide işlev olarak izinleriVer\'i seçip Çalıştır deyin ve açılan izin penceresinde İzin ver\'i seçin; (3) Dağıt → Dağıtımları yönet → kalem → Sürüm: Yeni sürüm → Dağıt. Sonra bu ekranda tekrar deneyin.';
/** Düzenleyiciden bir kez çalıştırın: dış bağlantı iznini ister (yapay zekâ için gerekli). */
function izinleriVer() {
  var r = UrlFetchApp.fetch('https://www.google.com/generate_204', { muteHttpExceptions: true });
  Logger.log('Dış bağlantı izni tamam (HTTP ' + r.getResponseCode() + '). Şimdi Dağıt → Dağıtımları yönet → Yeni sürüm.');
}
function aiErrText_(c, r) {
  var j = r.json, m = j && j.error ? (typeof j.error === 'string' ? j.error : (j.error.message || '')) : (j && j.message ? j.message : '');
  m = String(m || r.text || '').replace(/\s+/g, ' ').slice(0, 220);
  if (c.key) m = m.split(c.key).join('***');
  return m;
}
function aiErr_(c, r) {
  var code = r.code, em = aiErrText_(c, r), keyName = c.def.keyProps[0];
  if (/model_not_found|does not have access to model|model .{0,60}(not found|does not exist|not supported)|is not found for api version|unknown model/i.test(em)) return fail_(c.name + ': model kullanılamıyor. ' + em, 'AIMODEL');
  if (code === 401 || code === 403 || (code === 400 && /api[ _-]?key/i.test(em))) return fail_(c.name + ' anahtarı reddedildi (' + code + '). ' + keyName + ' değerini kontrol edin. Ayrıntı: ' + em, 'AIKEY');
  if (code === 404) return fail_(c.name + ': model bulunamadı. ' + em, 'AIMODEL');
  if (code === 429 || code === 503 || code === 529) return fail_(c.name + ' şu an yoğun veya kota doldu (' + code + '). ' + em, 'AIBUSY');
  return fail_(c.name + ' isteği başarısız (' + code + '): ' + em, 'AIERR');
}
function aiOk_(r) { return r.code >= 200 && r.code < 300 && r.json; }

/* ---- Anthropic: başlık kümeleri (ayarlıysa yalnızca o; değilse önce güncel Bearer + yeni sürüm, olmazsa x-api-key + 2023-06-01; çalışan küme önbelleğe alınır) ---- */
function aiAnthSets_(c) {
  function mk(auth, version) { var h = { 'anthropic-version': version }; if (auth === 'x-api-key') h['x-api-key'] = c.key; else h['Authorization'] = 'Bearer ' + c.key; if (c.workspace) h['anthropic-workspace-id'] = c.workspace; return h; }
  if (c.auth || c.version) return [mk(c.auth || 'bearer', c.version || '2026-10-21')];
  var sets = [mk('bearer', '2026-10-21'), mk('x-api-key', '2023-06-01')], tag = 'aih_' + aiKeyTag_(c.key), hit = '';
  try { hit = CacheService.getScriptCache().get(tag); } catch (e) { }
  if (hit === '1') sets.reverse();
  return sets;
}
function aiAnthFetch_(c, method, url, body) {
  var sets = aiAnthSets_(c), last = null;
  for (var i = 0; i < sets.length; i++) {
    var r = aiHttp_(method, url, sets[i], body);
    if (aiOk_(r)) {
      if (sets.length > 1) { try { CacheService.getScriptCache().put('aih_' + aiKeyTag_(c.key), sets[i]['x-api-key'] ? '1' : '0', AI_MODELS_TTL); } catch (e) { } }
      return r;
    }
    last = r;
    var em = aiErrText_(c, r);
    if (!(r.code === 401 || r.code === 403 || (r.code === 400 && /version|header|auth/i.test(em)))) break;
  }
  throw aiErr_(c, last);
}

/* ---- Model listeleri (her sağlayıcının kendi uç noktası) ---- */
function aiListModels_(c) {
  var out = [], r;
  if (c.id === 'anthropic') {
    r = aiAnthFetch_(c, 'get', c.url.replace(/\/messages\/?$/, '/models') + '?limit=1000');
    (r.json.data || []).forEach(function (m) { if (m && m.id) out.push(String(m.id)); });
  } else if (c.id === 'gemini') {
    var tok = '';
    for (var pg = 0; pg < 4; pg++) {
      r = aiHttp_('get', 'https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000' + (tok ? '&pageToken=' + encodeURIComponent(tok) : ''), { 'x-goog-api-key': c.key });
      if (!aiOk_(r)) throw aiErr_(c, r);
      (r.json.models || []).forEach(function (m) {
        var methods = m && m.supportedGenerationMethods;
        if (m && m.name && (!methods || methods.indexOf('generateContent') >= 0)) out.push(String(m.name).replace(/^models\//, ''));
      });
      tok = r.json.nextPageToken || ''; if (!tok) break;
    }
  } else {
    r = aiHttp_('get', (c.id === 'openai' ? 'https://api.openai.com/v1' : c.base) + '/models', { 'Authorization': 'Bearer ' + c.key });
    if (!aiOk_(r)) throw aiErr_(c, r);
    (r.json.data || []).forEach(function (m) { if (m && m.id) out.push(String(m.id)); });
  }
  return out;
}

/* ---- Model adından seviye + sürüm çıkarma ---- */
function aiClassify_(pid, rawId) {
  var id = String(rawId).replace(/^models\//, ''), low = id.toLowerCase(), m, parts, ver, date, fam, tier, w;
  if (pid === 'anthropic') {
    if (!/^claude-/.test(low) || /^claude-(2|instant)/.test(low)) return null;
    fam = /haiku/.test(low) ? ['fast', 1] : /sonnet/.test(low) ? ['balanced', 1] : /opus/.test(low) ? ['best', 2] : /(fable|mythos)/.test(low) ? ['best', 3] : null;
    if (!fam) return null;
    parts = low.replace(/^claude-/, '').split('-'); ver = []; date = 0;
    parts.forEach(function (x) { if (/^\d{1,2}$/.test(x)) ver.push(Number(x)); else if (/^\d{6,8}$/.test(x)) date = Number(x); });
    return { id: id, tier: fam[0], key: [fam[1]].concat(ver), stable: true, snap: date > 0 };
  }
  if (pid === 'gemini') {
    if (!/^gemini-\d/.test(low) || /(image|tts|embedding|live|audio|aqa|imagen|veo|robotics|computer|exp|learnlm|gemma|nano|banana|customtools|deep-research)/.test(low)) return null;
    tier = /flash-lite/.test(low) ? 'fast' : /flash/.test(low) ? 'balanced' : /pro/.test(low) ? 'best' : null;
    if (!tier) return null;
    m = /^gemini-(\d+)(?:\.(\d+))?/.exec(low);
    return { id: id, tier: tier, key: [Number(m[1]), Number(m[2] || 0)], stable: !/preview/.test(low), snap: /-\d{3}$|-\d{2}-\d{4}$|-\d{4}$/.test(low) };
  }
  if (pid === 'openai') {
    if (!/^gpt-\d/.test(low) || /^gpt-(3|4)(-|$)/.test(low) || /^gpt-3/.test(low) || /(audio|realtime|transcribe|tts|image|embedding|moderation|search|codex|instruct|chat-latest|deep-research|computer|-pro|oss|safeguard|diarize|vision)/.test(low)) return null;
    m = /^gpt-(\d+)(?:\.(\d+))?/.exec(low);
    if (/luna|nano/.test(low)) { tier = 'fast'; w = 1; }
    else if (/terra/.test(low)) { tier = 'balanced'; w = 1; }
    else if (/sol|mini/.test(low)) { tier = 'balanced'; w = 2; }
    else if (/astra/.test(low)) { tier = 'best'; w = 3; }
    else if (/^gpt-\d+(\.\d+)?o?(-\d{4}-\d{2}-\d{2})?$/.test(low)) { tier = 'best'; w = 2; }
    else { tier = 'balanced'; w = 0; }   // tanınmayan yeni ad: yine de aday olsun, hata verirse sıradakine geçilir
    return { id: id, tier: tier, key: [Number(m[1]), Number(m[2] || 0), w], stable: !/preview/.test(low), snap: /-\d{4}-\d{2}-\d{2}$|-\d{4}$/.test(low) };
  }
  return null;
}
function aiCmp_(a, b) {   // en yeni / en güçlü başa
  var n = Math.max(a.key.length, b.key.length);
  for (var i = 0; i < n; i++) { var x = a.key[i] || 0, y = b.key[i] || 0; if (x !== y) return y - x; }
  if (a.stable !== b.stable) return a.stable ? -1 : 1;
  if (a.snap !== b.snap) return a.snap ? 1 : -1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}
/** Kimlik listesinden seviye başına sıralı adaylar: { fast:[ids], balanced:[ids], best:[ids] } */
function aiRank_(pid, ids) {
  var by = { fast: [], balanced: [], best: [] }, seen = {}, out = {};
  (ids || []).forEach(function (id) { var k = aiClassify_(pid, id); if (k && !seen[k.id]) { seen[k.id] = 1; by[k.tier].push(k); } });
  AI_TIERS.forEach(function (t) { by[t].sort(aiCmp_); out[t] = by[t].map(function (k) { return k.id; }); });
  return out;
}
/** Sağlayıcının kullanılabilir modelleri (önbellekli). force=true → yeniden sor. */
function aiModels_(c, force) {
  if (c.id === 'compat') return { ids: c.model ? [c.model] : [], listed: false, err: '' };
  var cache = CacheService.getScriptCache(), key = 'aim_' + c.id + '_' + aiKeyTag_(c.key), hit = null;
  if (!force) { try { hit = safeParse_(cache.get(key)); } catch (e) { } if (hit && hit.ids) return hit; }
  var ids = null, err = '';
  try { ids = aiListModels_(c); } catch (e) { err = String(e && e.message || e).slice(0, 200); }
  var rk = ids ? aiRank_(c.id, ids) : { fast: [], balanced: [], best: [] }, keep = [];
  AI_TIERS.forEach(function (t) { keep = keep.concat(rk[t].slice(0, 12)); });
  var out = { ids: keep, listed: !!ids, err: err };
  try { cache.put(key, JSON.stringify(out), ids ? AI_MODELS_TTL : 300); } catch (e) { }
  return out;
}
/** Seviye başına seçilen model: liste varsa listeden, yoksa yerleşik varsayılan. */
function aiPicks_(c, md) {
  var rk = aiRank_(c.id, md.ids), p = {};
  AI_TIERS.forEach(function (t) { p[t] = rk[t][0] || (md.listed ? '' : (c.def.defaults[t] || '')); });
  return { picks: p, ranked: rk };
}

/* ---- Aday planı ---- */
var AI_ORDER_ = { auto: ['balanced', 'best', 'fast'], balanced: ['balanced', 'best', 'fast'], fast: ['fast', 'balanced', 'best'], best: ['best', 'balanced', 'fast'] };
function aiPlan_(c, tier, model, force, md0) {
  var out = [], seen = {};
  function add(m, t, src) { if (m && !seen[m]) { seen[m] = 1; out.push({ c: c, model: m, tier: t, source: src }); } }
  if (model) add(model, 'manual', 'request');
  if (c.model) add(c.model, 'manual', 'config');
  if (c.id === 'compat') return out;
  var md = md0 || aiModels_(c, force), pk = aiPicks_(c, md).picks;
  (AI_ORDER_[tier] || AI_ORDER_.auto).forEach(function (t) { add(pk[t], t, md.listed ? 'list' : 'default'); });
  return out;
}
/** Sağlayıcılar arası sıra: birincil sağlayıcının ilk 2 adayı, sonra diğerlerinin ilk 2'si, sonra kalanlar. */
function aiChain_(cfg, prov, tier, model) {
  var active = cfg.providers.filter(function (c) { return c.ok; });
  if (prov && prov !== 'auto') { var one = active.filter(function (c) { return c.id === prov; }); if (!one.length) throw fail_('Seçilen yapay zekâ sağlayıcısı tanımlı değil.', 'NOAI'); active = one.concat(active.filter(function (c) { return c.id !== prov; })); }
  else if (cfg.provider !== 'auto') { var pri = active.filter(function (c) { return c.id === cfg.provider; }); active = pri.concat(active.filter(function (c) { return c.id !== cfg.provider; })); }
  var plans = active.map(function (c, i) {
    var md = aiModels_(c, false);
    return aiPlan_(c, tier, i === 0 && model && md.ids.indexOf(model) >= 0 ? model : '', false, md);
  });
  var out = [];
  [0, 2].forEach(function (from) { plans.forEach(function (pl) { pl.slice(from, from === 0 ? 2 : 10).forEach(function (x) { out.push(x); }); }); });
  return out;
}

/* ---- Sağlayıcıya özel çağrılar ---- */
function aiRunAnthropic_(c, model, system, text, img, mt) {
  var parts = []; if (img) parts.push({ type: 'image', source: { type: 'base64', media_type: mt, data: img } }); parts.push({ type: 'text', text: text });
  var r = aiAnthFetch_(c, 'post', c.url, { model: model, max_tokens: AI_TOK_, system: system, messages: [{ role: 'user', content: parts }] }), out = '';
  (r.json.content || []).forEach(function (x) { if (x && x.type === 'text') out += x.text; });
  return out;
}
function aiRunGemini_(c, model, system, text, img, mt) {
  var parts = []; if (img) parts.push({ inlineData: { mimeType: mt, data: img } }); parts.push({ text: text });
  var r = aiHttp_('post', 'https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':generateContent', { 'x-goog-api-key': c.key },
    { systemInstruction: { parts: [{ text: system }] }, contents: [{ role: 'user', parts: parts }], generationConfig: { maxOutputTokens: 8192, responseMimeType: 'application/json' } });
  if (!aiOk_(r)) throw aiErr_(c, r);
  var cand = r.json.candidates && r.json.candidates[0], out = '';
  ((cand && cand.content && cand.content.parts) || []).forEach(function (x) { if (x && x.text && !x.thought) out += x.text; });
  if (!out) throw fail_(c.name + ' yanıt vermedi' + (r.json.promptFeedback && r.json.promptFeedback.blockReason ? ' (engellendi: ' + r.json.promptFeedback.blockReason + ')' : '') + '.', 'AIERR');
  return out;
}
function aiRunOpenAI_(c, model, system, text, img, mt) {
  var url = (c.id === 'openai' ? 'https://api.openai.com/v1' : c.base) + '/chat/completions', content = [{ type: 'text', text: text }];
  if (img) content.push({ type: 'image_url', image_url: { url: 'data:' + mt + ';base64,' + img, detail: 'high' } });
  var variants = c.id === 'openai' ? [['max_completion_tokens', true], ['max_completion_tokens', false]] : [['max_tokens', true], ['max_tokens', false], ['max_completion_tokens', false]], r = null;
  for (var i = 0; i < variants.length; i++) {
    var body = { model: model, messages: [{ role: 'system', content: system }, { role: 'user', content: content }] };
    body[variants[i][0]] = Math.max(6000, AI_TOK_); if (variants[i][1]) body.response_format = { type: 'json_object' };
    r = aiHttp_('post', url, { 'Authorization': 'Bearer ' + c.key }, body);
    if (aiOk_(r)) break;
    if (!(r.code === 400 && /response_format|json_object|max_tokens|max_completion_tokens|unsupported|not supported|unrecognized/i.test(aiErrText_(c, r)))) break;
  }
  if (!aiOk_(r)) throw aiErr_(c, r);
  var msg = r.json.choices && r.json.choices[0] && r.json.choices[0].message, out = '';
  if (msg && typeof msg.content === 'string') out = msg.content;
  else if (msg && Array.isArray(msg.content)) msg.content.forEach(function (x) { if (x && x.text) out += x.text; });
  if (!out) throw fail_(c.name + ' yanıt vermedi' + (msg && msg.refusal ? ' (reddetti)' : '') + '.', 'AIERR');
  return out;
}
function aiRun_(cand, system, text, img, mt) {
  var c = cand.c;
  if (c.id === 'anthropic') return aiRunAnthropic_(c, cand.model, system, text, img, mt);
  if (c.id === 'gemini') return aiRunGemini_(c, cand.model, system, text, img, mt);
  return aiRunOpenAI_(c, cand.model, system, text, img, mt);
}
function aiExtractJson_(text) {
  var s = String(text || ''), a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a < 0 || b <= a) return null;
  return safeParse_(s.slice(a, b + 1));
}
/** Adayları sırayla dene; ilk geçerli sonucu döndür. check(text) geçerli nesne ya da null döndürür. */
function aiTry_(chain, system, text, img, mt, check) {
  var tried = [], dead = {}, firstErr = null, n = 0;
  if (!chain.length) throw fail_('Kullanılabilir yapay zekâ modeli bulunamadı. Ayarlardan model adını elle yazın.', 'AIMODEL');
  for (var i = 0; i < chain.length && n < AI_MAX_TRIES; i++) {
    var cand = chain[i]; if (dead[cand.c.id]) continue; n++;
    var t0 = Date.now();
    try {
      var out = aiRun_(cand, system, text, img, mt), val = check(out);
      if (!val) throw fail_(cand.c.name + ' yanıtı çözümlenemedi.', 'AIPARSE');
      tried.push({ provider: cand.c.id, model: cand.model, ok: true, ms: Date.now() - t0 });
      return { value: val, raw: out, cand: cand, tried: tried };
    } catch (err) {
      var code = err && err.code || 'AIERR';
      tried.push({ provider: cand.c.id, model: cand.model, ok: false, code: code, ms: Date.now() - t0 });
      if (!firstErr) firstErr = err;
      if (code === 'AISCOPE') break;   // izin sorunu tüm sağlayıcılar için aynı: boşuna denemeyin
      if (code === 'AIKEY') dead[cand.c.id] = 1;
      if (code === 'AIMODEL') { try { aiModels_(cand.c, true); } catch (e) { } }   // liste eskimiş olabilir: sıradaki istekte yenilensin
    }
  }
  var e = fail_((firstErr && firstErr.message || 'Yapay zekâ yanıt vermedi.') + (tried.length > 1 ? ' (Denenen: ' + tried.map(function (t) { return t.provider + '/' + t.model + (t.ok ? '' : ' ' + t.code); }).join(', ') + ')' : ''), firstErr && firstErr.code || 'AIERR');
  e.tried = tried; throw e;
}

var AI_SYSTEM_ = 'You analyse a scan or photo of a BLANK optical answer sheet (OMR form) used in Turkish school exams (LGS, TYT, AYT, school and publisher trial exams). The sheet may be printed in black, blue, pink or purple ink. ' +
  'Image processing software has already located every bubble block; each block is outlined in colour and labelled with an id such as b1, b2. You do NOT locate anything. Thin timing bars along the sheet edges are not blocks. ' +
  'For every id decide its meaning from what is printed on the sheet. Never invent what you cannot read; use an empty string or null and say so in "note". ' +
  'Roles: "questions" (answer bubbles for numbered questions), "studentNo" (digit columns for the student number), "schoolCode" (digit columns for a school/institution code), "booklet" (choose booklet type A/B/C/D), ' +
  '"name" (letter grid where the student FIRST NAME is coded: one column per letter position, one row per alphabet letter), "surname" (the same for the SURNAME), "ignore" (anything else, e.g. printed letters or a sample). ' +
  'For "questions": name = the printed lesson/section heading of that block (e.g. "TÜRKÇE"), labels = the printed choice letters in order (e.g. "ABCDE"), startNo = the first printed question number. ' +
  'For digit blocks labels = "0123456789" unless printed differently. For booklet blocks labels = the printed booklet letters. For name/surname blocks leave labels empty. ' +
  'Reply with ONLY one JSON object: {"title":string,"blocks":[{"id":string,"role":string,"name":string,"labels":string,"startNo":number|null,"confidence":number,"note":string}],"notes":[string]}.';

/** Tam yerleşim (mode:'layout'): yapay zekâ bölüm kutularını, satır/sütun sayılarını, yönü, türü, adı ve harfleri verir; istemci (forms-ai.js) kutuları gerçek baloncuklara oturtur. İstem forms-ai.js promptText ile aynı içeriktedir. */
var AI_LAYOUT_SYSTEM_ = 'You are given a scan or photo of a BLANK optical answer sheet (OMR form) used in Turkish school exams (LGS, TYT, AYT, school and publisher trial exams). It may be printed in black, blue, pink or purple ink. The image has already been straightened. ' +
  'Describe the COMPLETE layout of the sheet\'s bubble areas so that software can read marked sheets: where every bubble block is, how many rows and columns of bubbles it has, and what it means. ' +
  'COORDINATES: all positions are in tenths of a percent of the image: x = 0 at the left edge and 1000 at the right edge; y = 0 at the top edge and 1000 at the bottom edge. A light blue dashed grid is drawn every 100 units and labelled on the image edges (top/bottom labels are x, left/right labels are y); read positions against it. ' +
  'Give each block as box = [left, top, right, bottom], tightly enclosing the OUTER EDGES of its outermost bubbles (not printed numbers, letters or headings). ' +
  'BLOCK = one regular rectangular grid of equally spaced bubbles, e.g. the questions of one lesson, the student-number digits, the school-code digits, the booklet-type bubbles, the name letter grid, the surname letter grid. Give different lessons/sections their own block; never merge separate sections and never split one regular grid. Timing bars along the sheet edges, logos, instructions and printed sample bubbles are not blocks. ' +
  'COUNTING: rows = number of horizontal lines of bubbles; cols = number of vertical lines of bubbles. Count them one by one in the image; never estimate from the size. ' +
  'AXIS: "row" when every ROW is one item (one question, or one digit/letter position) and its options run left to right; "col" when every COLUMN is one item and its options run top to bottom. Typical: question blocks "row"; student-number and name/surname grids "col". ' +
  'ROLES: "questions" (answer bubbles for numbered questions), "studentNo" (digit columns for the student number), "schoolCode" (digit columns for a school/institution code), "booklet" (choose booklet type A/B/C/D), "name" (letter grid where the student FIRST NAME is coded: one column per letter position, one row per alphabet letter), "surname" (the same for the SURNAME), "ignore" (anything else that has bubbles but must not be read, e.g. a printed sample). ' +
  'FIELDS: for "questions": name = the printed lesson/section heading of that block (e.g. "TÜRKÇE"), labels = the printed choice letters in order (e.g. "ABCDE"), startNo = the first printed question number. For digit blocks labels = "0123456789" unless printed differently. For booklet blocks labels = the printed booklet letters. For name/surname blocks labels = the printed alphabet in order if shown, otherwise empty. Never invent what you cannot read: use "" or null and say so in "note". ' +
  'The user message lists the blocks image-processing software already found (same units). They are usually right but may be wrong: blocks can be missed (faint print, name grids), merged, split or false. Return EVERY bubble block of the sheet: repeat each correct detected block with its id and action "keep" (and fill role/name/labels/startNo); give corrected values with action "edit" for a wrong one; add a missed block with id null and action "add"; mark a detected block that is not a bubble block with action "remove". ' +
  'Reply with ONLY one JSON object: {"schema":"optinet-layout/1","unit":"permille","title":string,"blocks":[{"id":string|null,"action":"keep"|"edit"|"add"|"remove","role":string,"name":string,"labels":string,"startNo":number|null,"box":[left,top,right,bottom],"rows":number,"cols":number,"axis":"row"|"col","confidence":number,"note":string}],"notes":[string]}.';
var AI_ACTIONS_ = ['keep', 'edit', 'add', 'remove'];
/** Tam yerleşim yanıtını temizler: yalnızca bilinen alanlar, sınırlı uzunluk ve sayı aralıkları (istemci ayrıca yeniden doğrular). */
function aiLayoutClean_(j) {
  var out = [], num = function (v, lo, hi) { var n = Math.round(Number(v)); return isFinite(n) && n >= lo && n <= hi ? n : 0; };
  (j.blocks || []).slice(0, 80).forEach(function (b) {
    if (!b || typeof b !== 'object') return;
    var id = clean_(b.id, 8); if (!/^b\d{1,3}[a-z]?$/.test(id)) id = '';
    var box = null; if (Array.isArray(b.box) && b.box.length >= 4) { box = b.box.slice(0, 4).map(function (v) { v = Number(v); return isFinite(v) ? Math.round(v * 10) / 10 : NaN; }); if (box.some(function (v) { return isNaN(v) || v < -5 || v > 5000; })) box = null; }
    var st = Number(b.startNo), cf = Number(b.confidence), ax = String(b.axis || '').toLowerCase();
    out.push({ id: id, action: AI_ACTIONS_.indexOf(String(b.action || '').toLowerCase()) >= 0 ? String(b.action).toLowerCase() : '', role: AI_ROLES.indexOf(b.role) >= 0 ? b.role : '',
      name: clean_(b.name, 40), labels: String(b.labels == null ? '' : b.labels).replace(/[^A-Za-z0-9\u00C7\u011E\u0130\u00D6\u015E\u00DC\u00E7\u011F\u0131\u00F6\u015F\u00FC]/g, '').slice(0, 60), startNo: isFinite(st) && st >= 1 && st <= 1000 ? Math.round(st) : null,
      box: box, rows: num(b.rows, 1, 400), cols: num(b.cols, 1, 400), axis: ax === 'row' || ax === 'col' ? ax : '', confidence: Math.max(0, Math.min(1, cf > 1 ? cf / 100 : (isFinite(cf) ? cf : 0.8))), note: clean_(b.note, 160) });
  });
  return out;
}

function aiReqPrefs_(cfg, p) {
  var prov = trLower_(str_(p.provider)), tier = trLower_(str_(p.tier));
  return { provider: prov === 'auto' || aiDef_(prov) ? prov : '', tier: AI_TIERS.indexOf(tier) >= 0 || tier === 'auto' ? tier : cfg.tier, model: aiModelName_(p.model) };
}

function aAiAnalyzeForm(u, p) {
  var cfg = aiCfg_(), any = cfg.providers.some(function (c) { return c.ok; });
  if (!any) throw fail_('Yapay zekâ anahtarı tanımlı değil. Sistem yöneticisi ayarlardan (veya Betik Özellikleri\'nden) ANTHROPIC_API_KEY, GEMINI_API_KEY, OPENAI_API_KEY veya COMPAT_API_KEY eklemelidir. (Anahtarsız da tanıma çalışır; yapay zekâ yalnızca ders adı/harf önerir.)', 'NOAI');
  var img = String(p.image || '').replace(/^data:image\/\w+;base64,/, '');
  if (!/^[A-Za-z0-9+\/=]+$/.test(img) || img.length < 1000) throw fail_('Görüntü geçersiz.');
  if (img.length > AI_MAX_B64) throw fail_('Görüntü çok büyük; daha küçük gönderin.');
  var mt = p.mediaType === 'image/png' ? 'image/png' : 'image/jpeg', pr = aiReqPrefs_(cfg, p);
  throttle_('ai_u_' + trKey_(u.username).slice(0, 40) + '_' + hourKey_(), AI_USER_PER_HOUR, 3600, 'Saatlik yapay zekâ analiz sınırına ulaştınız. Bir süre sonra tekrar deneyin.');
  throttle_('ai_all_' + new Date().toISOString().slice(0, 10), AI_ALL_PER_DAY, 86400, 'Günlük yapay zekâ analiz sınırına ulaşıldı.');
  var layout = p.mode === 'layout';
  var blocks = (Array.isArray(p.blocks) ? p.blocks : []).slice(0, layout ? 80 : 40).map(function (b) {
    var bx = layout && Array.isArray(b.box) && b.box.length >= 4 ? b.box.slice(0, 4).map(function (v) { return Math.max(0, Math.min(1000, Math.round(Number(v) || 0))); }) : null, ax = String(b.axis || '').toLowerCase();
    return { id: clean_(b.id, 8), rows: Number(b.rows) | 0, cols: Number(b.cols) | 0, guess: AI_ROLES.indexOf(b.role) >= 0 ? b.role : '', digitGlyphs: b.glyph === 'digit' ? true : b.glyph === 'letter' ? false : null, box: bx, axis: ax === 'row' || ax === 'col' ? ax : '' };
  }).filter(function (b) { return /^b\d{1,3}[a-z]?$/.test(b.id); });
  if (!blocks.length && !layout) throw fail_('Çözümlenecek blok yok.');
  var ids = {}; blocks.forEach(function (b) { ids[b.id] = b; });
  var text = 'Detected blocks (id: rows x columns, software guess): ' + blocks.map(function (b) { return b.id + ': ' + b.rows + 'x' + b.cols + (b.guess ? ' (guess ' + b.guess + ')' : ''); }).join('; ') +
    '. A row is one bubble line left-to-right. In question blocks usually each ROW is one question and each COLUMN one choice. In digit blocks each COLUMN is one digit position and the 10 ROWS are 0-9. ' +
    'In name/surname blocks each COLUMN is one letter position and the ~29 ROWS are the alphabet.' +
    (p.hint ? ' User note: ' + clean_(p.hint, 200) : '') + ' Return the JSON now.';
  if (layout) {
    AI_TOK_ = 8000;
    text = 'Detected blocks (id: [left, top, right, bottom] in tenths of a percent, rows x columns, axis, software guess): ' + (blocks.length ? blocks.map(function (b) { return b.id + ': ' + (b.box ? '[' + b.box.join(', ') + ']' : '[?]') + ', ' + b.rows + 'x' + b.cols + (b.axis ? ', each ' + (b.axis === 'row' ? 'ROW' : 'COLUMN') + ' is one item' : '') + (b.guess ? ', guess ' + b.guess : ''); }).join('; ') : '(nothing was found automatically)') + '.' +
      (p.hint ? ' User note: ' + clean_(p.hint, 200) : '') + ' Return the JSON now.';
  }
  var chain = aiChain_(cfg, pr.provider, pr.tier, pr.model);
  if (layout) {
    var lres = aiTry_(chain, AI_LAYOUT_SYSTEM_, text, img, mt, function (out) { var j = aiExtractJson_(out); return j && Array.isArray(j.blocks) && j.blocks.length ? j : null; }), lj = lres.value;
    var un = String(lj.unit || '').toLowerCase().replace(/[^a-z]/g, '').slice(0, 12), im = lj.image && typeof lj.image === 'object' ? { width: Number(lj.image.width) || 0, height: Number(lj.image.height) || 0 } : null;
    return { schema: 'optinet-layout/1', mode: 'layout', unit: un, image: im, title: clean_(lj.title, 80), blocks: aiLayoutClean_(lj), notes: (Array.isArray(lj.notes) ? lj.notes : []).slice(0, 8).map(function (x) { return clean_(x, 200); }).filter(Boolean),
      provider: lres.cand.c.id, providerName: lres.cand.c.name, model: lres.cand.model, tier: lres.cand.tier, tried: lres.tried };
  }
  var res = aiTry_(chain, AI_SYSTEM_, text, img, mt, function (out) { var j = aiExtractJson_(out); return j && Array.isArray(j.blocks) && j.blocks.length ? j : null; }), j = res.value, list = [], seen = {};
  j.blocks.forEach(function (b) {
    var id = clean_(b && b.id, 8); if (!ids[id] || seen[id]) return; seen[id] = 1;
    var role = AI_ROLES.indexOf(b.role) >= 0 ? b.role : '', labels = String(b.labels || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12), st = Number(b.startNo);
    list.push({ id: id, role: role, name: clean_(b.name, 40), labels: labels, startNo: isFinite(st) && st >= 1 && st <= 500 ? Math.round(st) : null, confidence: Math.max(0, Math.min(1, Number(b.confidence) || 0)), note: clean_(b.note, 160) });
  });
  return { title: clean_(j.title, 80), blocks: list, notes: (Array.isArray(j.notes) ? j.notes : []).slice(0, 6).map(function (x) { return clean_(x, 200); }).filter(Boolean),
    provider: res.cand.c.id, providerName: res.cand.c.name, model: res.cand.model, tier: res.cand.tier, tried: res.tried };
}

/** Arayüz için durum: hangi sağlayıcı hazır, hangi model seçilir (yönetici ayrıca ayarları görür; anahtarlar maskelidir). */
function aiStatusFull_(u, force) {
  var cfg = aiCfg_(), isAdmin = u && u.role === 'admin', provs = [];
  cfg.providers.forEach(function (c) {
    var o = { id: c.id, name: c.name, ok: c.ok, hasKey: c.hasKey, manualModel: c.model, models: { fast: '', balanced: '', best: '' }, list: [], source: 'none', listError: '' };
    if (c.ok) {
      var md = aiModels_(c, force), pk = aiPicks_(c, md);
      o.models = pk.picks; o.source = c.id === 'compat' ? 'manual' : md.listed ? 'list' : 'default'; o.listError = md.listed ? '' : md.err;
      AI_TIERS.forEach(function (t) { pk.ranked[t].slice(0, 6).forEach(function (id) { if (o.list.indexOf(id) < 0) o.list.push(id); }); });
      if (c.id === 'compat' && c.model) o.list = [c.model];
    }
    provs.push(o);
  });
  var primary = null; provs.forEach(function (o) { if (o.ok && !primary && (cfg.provider === 'auto' || cfg.provider === o.id)) primary = o; });
  if (!primary) provs.forEach(function (o) { if (o.ok && !primary) primary = o; });
  var tierPick = AI_ORDER_[cfg.tier][0], out = { available: !!primary, provider: cfg.provider, tier: cfg.tier, model: primary ? (primary.manualModel || primary.models[tierPick] || '') : '', primary: primary ? primary.id : '',
    providers: provs.filter(function (o) { return isAdmin || o.ok; }).map(function (o) { return isAdmin ? o : { id: o.id, name: o.name, ok: o.ok, models: o.models, list: o.list }; }) };
  if (isAdmin) {
    out.config = { provider: cfg.provider, tier: cfg.tier, keys: {}, models: {}, compatUrl: '', compatName: '' };
    cfg.providers.forEach(function (c) { out.config.keys[c.id] = aiKeyHint_(c.key); out.config.models[c.id] = c.model; if (c.id === 'compat') { out.config.compatUrl = c.base || ''; out.config.compatName = c.label || ''; } });
  }
  return out;
}
function aAiStatus(u, p) { return aiStatusFull_(u, !!(p && p.refresh && u && u.role === 'admin')); }

/** Yönetici: sağlayıcı/seviye/model/anahtar ayarlarını Betik Özellikleri'ne yazar. Anahtarlar yalnızca yazılır, geri okunmaz. */
function aAiSaveConfig(u, p) {
  if (u.role !== 'admin') throw fail_('Yetkiniz yok.');
  var ps = PropertiesService.getScriptProperties(), set = {}, del = [];
  if (p.provider !== undefined) { var pv = trLower_(str_(p.provider)); if (pv !== 'auto' && !aiDef_(pv)) throw fail_('Geçersiz sağlayıcı.'); set.AI_PROVIDER = pv; }
  if (p.tier !== undefined) { var tr = trLower_(str_(p.tier)); if (tr !== 'auto' && AI_TIERS.indexOf(tr) < 0) throw fail_('Geçersiz seviye.'); set.AI_TIER = tr; }
  AI_PROVIDERS.forEach(function (d) {
    if (p.models && p.models[d.id] !== undefined) {
      var m = str_(p.models[d.id]);
      if (!m || trLower_(m) === 'auto') del.push(d.modelProp); else if (aiModelName_(m)) set[d.modelProp] = m; else throw fail_('Geçersiz model adı: ' + clean_(m, 40));
    }
    var k = p.keys && p.keys[d.id];
    if (typeof k === 'string' && k.trim()) {
      k = k.trim(); if (!/^[\x21-\x7e]{8,400}$/.test(k)) throw fail_(d.name + ' anahtarı geçersiz görünüyor (boşluk/Türkçe karakter olmamalı, en az 8 karakter).');
      set[d.keyProps[0]] = k; for (var i = 1; i < d.keyProps.length; i++) del.push(d.keyProps[i]);
    }
    if (Array.isArray(p.clearKeys) && p.clearKeys.indexOf(d.id) >= 0) d.keyProps.forEach(function (n) { del.push(n); });
  });
  if (p.compatUrl !== undefined) { var cu = str_(p.compatUrl); if (!cu) del.push('COMPAT_BASE_URL'); else if (aiBase_(cu)) set.COMPAT_BASE_URL = aiBase_(cu); else throw fail_('Uyumlu sağlayıcı adresi https:// ile başlamalıdır.'); }
  if (p.compatName !== undefined) { var cn = clean_(p.compatName, 40); if (cn) set.COMPAT_NAME = cn; else del.push('COMPAT_NAME'); }
  Object.keys(set).forEach(function (k) { ps.setProperty(k, set[k]); });
  del.forEach(function (k) { ps.deleteProperty(k); });
  return aiStatusFull_(u, true);
}

/** Yönetici: seçilen sağlayıcı/seviye ile küçük bir yazı isteği gönderir; anahtar, model seçimi ve gecikmeyi gösterir. */
function aAiTest(u, p) {
  if (u.role !== 'admin') throw fail_('Yetkiniz yok.');
  throttle_('ai_t_' + trKey_(u.username).slice(0, 40) + '_' + hourKey_(), 30, 3600, 'Saatlik yapay zekâ deneme sınırına ulaştınız.');
  var cfg = aiCfg_(), pr = aiReqPrefs_(cfg, p), c = null;
  cfg.providers.forEach(function (x) { if (!c && x.ok && (!pr.provider || pr.provider === 'auto' || pr.provider === x.id)) c = x; });
  if (!c) throw fail_('Seçilen sağlayıcı için anahtar tanımlı değil.', 'NOAI');
  var plan = aiPlan_(c, pr.tier, pr.model, !!p.refresh);
  if (!plan.length) throw fail_(c.name + ' için kullanılabilir model bulunamadı. Model adını elle yazın.', 'AIMODEL');
  var res = aiTry_(plan.slice(0, 3), 'Reply with one JSON object only.', 'Return exactly {"ok":true}', null, '', function (out) { return aiExtractJson_(out) || (/ok/i.test(out) ? { ok: true } : null); });
  return { provider: c.id, providerName: c.name, model: res.cand.model, tier: res.cand.tier, source: res.cand.source, ms: res.tried[res.tried.length - 1].ms, tried: res.tried, reply: clean_(res.raw, 80) };
}


/**
 * İl / İlçe / Admin için bölgesel ortak sınav ve okul özet raporu.
 * Filtreler: il, ilce (isteğe bağlı), examId (isteğe bağlı; boşsa ortak sınavlar taranır).
 */
function aRegionalOverview(u, p) {
  p = p || {};
  if (u.role === 'ogretmen') throw fail_('Yetkiniz yok.');
  var sm = schoolMap_(), targetIl = str_(p.il) || (u.role === 'il' || u.role === 'ilce' ? u.il : '');
  var targetIlce = str_(p.ilce) || (u.role === 'ilce' ? u.ilce : '');
  if (u.role === 'il' && targetIl && targetIl !== u.il) throw fail_('Kendi iliniz dışını görüntüleme yetkiniz yok.');
  if (u.role === 'ilce' && ((targetIl && targetIl !== u.il) || (targetIlce && targetIlce !== u.ilce))) throw fail_('Kendi ilçeniz dışını görüntüleme yetkiniz yok.');

  var schools = Object.keys(sm).map(function (k) { return sm[k]; }).filter(function (s) {
    if (!canSeeSchool_(u, s)) return false;
    if (targetIl && s.il !== targetIl) return false;
    if (targetIlce && s.ilce !== targetIlce) return false;
    return true;
  });
  var allowedCodes = {};
  schools.forEach(function (s) { allowedCodes[String(s.okulKodu)] = s; });

  var stuCounts = {};
  table_('Students').forEach(function (st) {
    var c = String(st.okulKodu);
    if (allowedCodes[c]) stuCounts[c] = (stuCounts[c] || 0) + 1;
  });

  var exams = table_('Exams').filter(function (ex) {
    if (!examVisible_(u, ex)) return false;
    if (p.examId && String(ex.examId) !== String(p.examId)) return false;
    return true;
  });

  var schoolAgg = {};
  Object.keys(allowedCodes).forEach(function (c) {
    var s = allowedCodes[c];
    schoolAgg[c] = { okulKodu: c, okulAdi: s.okulAdi, il: s.il, ilce: s.ilce, tur: s.tur, ogrenciSayisi: stuCounts[c] || 0, katilimToplam: 0, netToplam: 0, puanToplam: 0, pctToplam: 0, sinavSayisi: 0, dersNetleri: {} };
  });

  var examSummaries = [];
  exams.forEach(function (ex) {
    var c = computeExam_(ex);
    var inAreaRows = c.rows.filter(function (r) { return !!allowedCodes[String(r.okulKodu)]; });
    if (!inAreaRows.length) return;
    var bySch = {};
    inAreaRows.forEach(function (r) {
      var code = String(r.okulKodu);
      if (!bySch[code]) bySch[code] = { okulKodu: code, okulAdi: allowedCodes[code].okulAdi, ilce: allowedCodes[code].ilce, n: 0, sumNet: 0, sumPuan: 0, sumPct: 0, secSum: [] };
      var b = bySch[code];
      var pct = c.cfg.total > 0 ? Math.max(0, Math.min(100, (r.net / c.cfg.total) * 100)) : 0;
      b.n++; b.sumNet += r.net; b.sumPuan += r.puan; b.sumPct += pct;
      for (var j = 0; j < c.cfg.sections.length; j++) {
        b.secSum[j] = (b.secSum[j] || 0) + (r.secNets[j] || 0);
      }
    });

    var schList = Object.keys(bySch).map(function (code) {
      var b = bySch[code];
      var avgNet = round_(b.sumNet / b.n), avgPuan = round_(b.sumPuan / b.n), avgPct = round_(b.sumPct / b.n);
      var secAvgs = c.cfg.sections.map(function (sec, j) {
        var sAvg = round_((b.secSum[j] || 0) / b.n);
        if (schoolAgg[code]) {
          if (!schoolAgg[code].dersNetleri[sec.name]) schoolAgg[code].dersNetleri[sec.name] = { sum: 0, n: 0 };
          schoolAgg[code].dersNetleri[sec.name].sum += sAvg;
          schoolAgg[code].dersNetleri[sec.name].n++;
        }
        return { name: sec.name, count: sec.count, avgNet: sAvg, avgPct: sec.count > 0 ? round_(Math.max(0, (sAvg / sec.count) * 100)) : 0 };
      });
      if (schoolAgg[code]) {
        schoolAgg[code].katilimToplam += b.n;
        schoolAgg[code].netToplam += avgNet;
        schoolAgg[code].puanToplam += avgPuan;
        schoolAgg[code].pctToplam += avgPct;
        schoolAgg[code].sinavSayisi++;
      }
      return { okulKodu: code, okulAdi: b.okulAdi, ilce: b.ilce, n: b.n, avgNet: avgNet, avgPuan: avgPuan, avgPct: avgPct, sections: secAvgs };
    }).sort(function (a, b) { return b.avgPuan - a.avgPuan || b.avgNet - a.avgNet; });

    schList.forEach(function (s, idx) { s.rank = idx + 1; });

    var totNet = 0, totPuan = 0, totPct = 0;
    inAreaRows.forEach(function (r) {
      totNet += r.net; totPuan += r.puan;
      totPct += c.cfg.total > 0 ? Math.max(0, Math.min(100, (r.net / c.cfg.total) * 100)) : 0;
    });

    examSummaries.push({
      examId: ex.examId, name: ex.name, date: dateStr_(ex.date), scopeType: ex.scopeType, totalQ: c.cfg.total,
      participantCount: inAreaRows.length, schoolCount: schList.length,
      avgNet: round_(totNet / inAreaRows.length), avgPuan: round_(totPuan / inAreaRows.length), avgPct: round_(totPct / inAreaRows.length),
      schools: schList
    });
  });

  var schoolsOut = Object.keys(schoolAgg).map(function (c) {
    var a = schoolAgg[c], cnt = a.sinavSayisi || 1;
    var dersOrt = {};
    Object.keys(a.dersNetleri).forEach(function (dn) {
      dersOrt[dn] = round_(a.dersNetleri[dn].sum / a.dersNetleri[dn].n);
    });
    return {
      okulKodu: a.okulKodu, okulAdi: a.okulAdi, il: a.il, ilce: a.ilce, tur: a.tur,
      ogrenciSayisi: a.ogrenciSayisi, sinavSayisi: a.sinavSayisi, katilimToplam: a.katilimToplam,
      avgNet: a.sinavSayisi ? round_(a.netToplam / cnt) : null,
      avgPuan: a.sinavSayisi ? round_(a.puanToplam / cnt) : null,
      avgPct: a.sinavSayisi ? round_(a.pctToplam / cnt) : null,
      dersOrt: dersOrt
    };
  }).sort(function (a, b) { return (b.avgPuan == null ? -1 : b.avgPuan) - (a.avgPuan == null ? -1 : a.avgPuan); });

  schoolsOut.forEach(function (s, idx) { s.rank = idx + 1; });

  return {
    il: targetIl, ilce: targetIlce,
    schoolCount: schoolsOut.length,
    totalStudents: schoolsOut.reduce(function (s, x) { return s + x.ogrenciSayisi; }, 0),
    schools: schoolsOut,
    exams: examSummaries
  };
}

/* ============================ ROUTER ============================ */

var ACTIONS = {
  login: { open: true, fn: aLogin },
  publicSchools: { open: true, fn: aPublicSchools },
  registerTeacher: { open: true, write: true, pre: preRegister_, fn: aRegisterTeacher },
  registerSchool: { open: true, write: true, pre: preRegister_, fn: aRegisterSchool },
  listApplications: { fn: aListApplications },
  decideApplication: { fn: aDecideApplication, write: true },
  portalClasses: { open: true, pre: prePortal_, fn: aPortalClasses },
  portalLookup: { open: true, pre: prePortal_, fn: aPortalLookup },
  veliRegister: { open: true, write: true, pre: preRegister_, fn: aVeliRegister },
  veliLogin: { open: true, pre: prePortal_, fn: aVeliLogin },
  generateParentCodes: { fn: aGenerateParentCodes, write: true },
  waQueue: { fn: aWaQueue, write: true },
  waMarkSent: { fn: aWaMarkSent, write: true },
  me: { fn: aMe },
  changePassword: { fn: aChangePassword, write: true },
  listExams: { fn: aListExams },
  listExternal: { fn: aListExternal },
  saveExternal: { fn: aSaveExternal, write: true },
  importExternal: { fn: aImportExternal, write: true },
  getExternal: { fn: aGetExternal },
  deleteExternal: { fn: aDeleteExternal, write: true },
  deleteExternalRow: { fn: aDeleteExternalRow, write: true },
  saveExam: { fn: aSaveExam, write: true },
  deleteExam: { fn: aDeleteExam, write: true },
  listTemplates: { fn: aListTemplates },
  saveTemplate: { fn: aSaveTemplate, write: true },
  deleteTemplate: { fn: aDeleteTemplate, write: true },
  listSchools: { fn: aListSchools },
  importSchools: { fn: aImportSchools, write: true },
  saveSchool: { fn: aSaveSchool, write: true },
  deleteSchool: { fn: aDeleteSchool, write: true },
  listStudents: { fn: aListStudents },
  importStudents: { fn: aImportStudents, write: true },
  saveStudent: { fn: aSaveStudent, write: true },
  deleteStudents: { fn: aDeleteStudents, write: true },
  aiStatus: { fn: aAiStatus },
  aiSaveConfig: { fn: aAiSaveConfig, write: true },
  aiTest: { fn: aAiTest },
  aiAnalyzeForm: { fn: aAiAnalyzeForm },
  listUsers: { fn: aListUsers },
  saveUser: { fn: aSaveUser, write: true },
  submitResults: { fn: aSubmit, write: true },
  deleteResult: { fn: aDeleteResult, write: true },
  getResults: { fn: aResults },
  getAnalysis: { fn: aAnalysis },
  regionalOverview: { fn: aRegionalOverview }
};

/* ============================ DEMO VERİ ============================ */

function seedDemo() {
  var ps = PropertiesService.getScriptProperties();
  if (!ps.getProperty('SS_ID')) setup();
  var admin = findUser_('demo-admin');
  if (!admin) createUser_({ username: 'demo-admin', name: 'Demo Yönetici', role: 'admin', password: 'demo-admin-1234', active: true });
  var schools = [['10001', 'Atatürk Ortaokulu', 'İstanbul', 'Esenyurt'], ['10002', 'Cumhuriyet Ortaokulu', 'İstanbul', 'Esenyurt'], ['10003', 'Fatih Ortaokulu', 'İstanbul', 'Beylikdüzü'],
    ['20001', 'Mevlana Ortaokulu', 'Konya', 'Selçuklu'], ['20002', 'Yunus Emre Ortaokulu', 'Konya', 'Meram']];
  aImportSchools({ role: 'admin' }, { rows: schools.map(function (s) { return { okulKodu: s[0], okulAdi: s[1], il: s[2], ilce: s[3] }; }) });
  var names = ['Ali', 'Ayşe', 'Mehmet', 'Fatma', 'Mustafa', 'Zeynep', 'Emre', 'Elif', 'Can', 'Defne'], sur = ['Yılmaz', 'Kaya', 'Demir', 'Çelik', 'Şahin', 'Aydın'];
  var preset = Scoring.PRESETS.lgs, key = '', i, j;
  for (i = 0; i < 90; i++) key += 'ABCD'.charAt((i * 7 + 3) % 4);
  var ex = aSaveExam({ role: 'admin', username: 'demo-admin' }, { exam: { name: 'Demo LGS Denemesi 1', scopeType: 'genel', status: 'open', config: { sections: preset.sections, choices: 4, penalty: preset.penalty, method: 'std500', keys: { A: key }, booklets: ['A'] } } });
  var items = {};
  schools.forEach(function (s, si) {
    var stu = [], res = [];
    for (i = 1; i <= 25; i++) {
      stu.push({ ogrNo: String(100 + i), ad: names[(i + si) % 10], soyad: sur[(i * 3 + si) % 6], sinif: '8-' + 'AB'.charAt(i % 2) });
      var skill = 0.35 + 0.12 * si / 4 + ((i * 37 + si * 11) % 100) / 100 * 0.45, ans = '';
      for (j = 0; j < 90; j++) { var r = ((i * 131 + j * 17 + si * 29) % 100) / 100; ans += r < skill ? key.charAt(j) : (r > 0.93 ? '-' : 'ABCD'.charAt((j + i) % 4)); }
      res.push({ clientId: 'd' + si + '_' + i, ogrNo: String(100 + i), booklet: 'A', answers: ans });
    }
    aImportStudents({ role: 'admin' }, { okulKodu: s[0], rows: stu });
    aSubmit({ role: 'admin', username: 'demo-admin' }, { examId: ex.examId, okulKodu: s[0], items: res });
  });
  // okul yöneticisi, iki fen öğretmeni (her biri kendi sınavını görür), bekleyen iki başvuru
  [['demo-okul', 'Atatürk Ortaokulu Yöneticisi', 'okul', 'demo-okul-1234', ''], ['demo-fen1', 'Zeynep Kaya (Fen Bilimleri)', 'ogretmen', 'demo-fen1-1234', 'Fen Bilimleri'], ['demo-fen2', 'Murat Demir (Fen Bilimleri)', 'ogretmen', 'demo-fen2-1234', 'Fen Bilimleri']].forEach(function (d) {
    if (!findUser_(d[0])) createUser_({ username: d[0], name: d[1], role: d[2], il: 'İstanbul', ilce: 'Esenyurt', okulKodu: '10001', password: d[3], active: true, brans: d[4], createdBy: 'demo-admin' });
  });
  var key20 = ''; for (i = 0; i < 20; i++) key20 += 'ABCD'.charAt((i * 5 + 1) % 4);
  ['demo-fen1', 'demo-fen2'].forEach(function (un, ti) {
    var tu = findUser_(un), mine = table_('Exams').filter(function (e) { return e.owner === un; });
    if (mine.length) return;
    var tex = aSaveExam(tu, { exam: { name: (ti ? 'Fen 8-B Konu Testi: Basınç' : 'Fen 8-A Konu Testi: DNA ve Genetik'), scopeType: 'okul', scopeValue: '10001', status: 'open', config: { sections: [{ name: 'Fen Bilimleri', count: 20, coef: 1 }], choices: 4, penalty: 0.25, method: 'net', keys: { A: key20 }, booklets: ['A'] } } });
    var its = []; for (i = 1; i <= 10; i++) { var sk = 0.4 + ((i * 29 + ti * 13) % 50) / 100, an = ''; for (j = 0; j < 20; j++) an += (((i * 31 + j * 11 + ti * 7) % 100) / 100 < sk) ? key20.charAt(j) : 'ABCD'.charAt((j + i) % 4); its.push({ clientId: 'f' + ti + '_' + i, ogrNo: String(100 + i + ti * 10), booklet: 'A', answers: an }); }
    aSubmit(tu, { examId: tex.examId, okulKodu: '10001', items: its });
  });
  try { aRegisterTeacher(null, { name: 'Ayşe Bekleyen', brans: 'Matematik', okulKodu: '10001', username: 'demo-bekleyen', password: 'demo-bekleyen-1234', telefon: '05321112233' }); } catch (e) { }
  try { aRegisterSchool(null, { il: 'Konya', ilce: 'Karatay', okulAdi: 'Demo Yeni Ortaokulu', okulKodu: '20099', duzey: 'Ortaokul', mudur: 'Ahmet Demirci', telefon: '05325554433', eposta: 'mudur@example.com', adres: 'Örnek Mah. Okul Cad. No:1 Karatay/Konya', username: 'demo-yeniokul', password: 'demo-yeniokul-1234' }); } catch (e) { }
  var msg = 'Demo yüklendi. Yönetici: demo-admin / demo-admin-1234 · Okul: demo-okul / demo-okul-1234 · Öğretmenler: demo-fen1 / demo-fen1-1234, demo-fen2 / demo-fen2-1234 (demo sonrası bu kullanıcıları pasifleştirin). Başvurular sekmesinde 2 bekleyen başvuru var.';
  try { SpreadsheetApp.getUi().alert(msg); } catch (e) { Logger.log(msg); }
}
