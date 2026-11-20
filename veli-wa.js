/* veli-wa.js — Yönetim → "Veli WhatsApp": öğrencinin sınav sonucunu anne ve/veya babasına kişiye özel WhatsApp mesajı olarak hazırlar.
 *
 * Akış: okul + sınav (+ sınıf) seç → "Mesajları hazırla" (sunucu telefonları, veli kodlarını ve sonuç özetini verir)
 *       → şablonu düzenle, önizle → ya satırdan "WhatsApp'ta aç" (elle) ya da "Eklenti için kuyruğu kopyala" (Chrome eklentisi)
 *       → gönderilenleri "Gönderildi" diye işaretle (aynı kişiye ikinci kez gitmesin).
 * Mesaj metni burada, şablondan kurulur; sunucu yalnızca veriyi ve gönderim kaydını tutar.
 * Eklenti kuyruk biçimi (değişmez): [{ id, n, t, ad }]  id = "sınav|okul|no|anne|baba" · n = ülke kodlu numara · t = metin · ad = ekranda görünen ad. */
'use strict';

const WA_DEFAULT_TPL = [
  'Sayın Veli,',
  '',
  '{okul} {sinif} sınıfı öğrencisi {adsoyad} için “{sinav}” ({tarih}) sonucu:',
  '• Puan: {puan}',
  '• Net: {net} (Doğru {D} · Yanlış {Y} · Boş {B})',
  '• Sınıf sırası: {siraSinif} · Okul sırası: {siraOkul}',
  '{dersler}',
  '',
  'Tüm sınav sonuçlarını ve analizini görmek için:',
  '{link}',
  'Okul numarası: {no} · Sınıf: {sinif}',
  'Veli kodu: {kod}',
  '',
  'İyi günler dileriz.'
].join('\n');
const WA_PLACEHOLDERS = [
  ['okul', 'Okul adı'], ['sinif', 'Sınıf'], ['adsoyad', 'Ad Soyad'], ['ad', 'Ad'], ['soyad', 'Soyad'], ['no', 'Okul numarası'], ['kod', 'Veli kodu'],
  ['sinav', 'Sınav adı'], ['tarih', 'Sınav tarihi'], ['puan', 'Puan'], ['net', 'Net'], ['D', 'Doğru'], ['Y', 'Yanlış'], ['B', 'Boş'],
  ['siraSinif', 'Sınıf sırası'], ['siraOkul', 'Okul sırası'], ['siraIlce', 'İlçe sırası'], ['siraIl', 'İl sırası'], ['dersler', 'Ders ders netler'], ['link', 'Giriş bağlantısı'], ['kime', 'Anne / Baba']
];
const WA_KEYS = WA_PLACEHOLDERS.map(x => x[0]);
const WA_DAILY = 60;          // eklentinin varsayılan günlük sınırı
const WA_SHOW = 200;          // tabloda gösterilen en çok alıcı

/** Şablonu doldurur. Bir satırda değeri boş olan yer tutucu varsa o satır hiç yazılmaz (ör. veli kodu yoksa "Veli kodu:" satırı çıkar). */
function waRender(tpl, vals) {
  const out = [];
  String(tpl || '').split('\n').forEach(line => {
    let drop = false;
    const t = line.replace(/\{(\w+)\}/g, (m, k) => { if (!Object.prototype.hasOwnProperty.call(vals, k)) return m; const v = vals[k]; if (v === '' || v == null) { drop = true; return ''; } return String(v); });
    if (!drop) out.push(t.replace(/[ \t]+$/g, ''));
  });
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
const waDate = d => /^\d{4}-\d{2}-\d{2}/.test(String(d || '')) ? String(d).slice(8, 10) + '.' + String(d).slice(5, 7) + '.' + String(d).slice(0, 4) : String(d || '');
const waKime = t => t ? (t.ikisi ? 'Anne/Baba' : t.kime === 'anne' ? 'Anne' : 'Baba') : '';
/** Veliye giden giriş bağlantısı: okul sabit, sınıf ve numara hazır; veli kodu bağlantıda değil mesaj metninde. */
function waLink(okulKodu, row) {
  const base = location.origin + location.pathname.replace(/index\.html$/, '');
  return `${base}#/ogrenci/${encodeURIComponent(okulKodu)}?n=${encodeURIComponent(row.ogrNo)}${row.sinif ? '&s=' + encodeURIComponent(row.sinif) : ''}`;
}
function waVals(ctx, row, t) {
  const so = row.sonuc || {}, sira = so.sira || {}, rk = a => (a && a[0] && a[1] > 1) ? `${a[0]} / ${a[1]}` : '', secs = so.sections || [];
  return {
    okul: ctx.okulAdi, okulKodu: ctx.okulKodu, sinif: row.sinif, ad: row.ad, soyad: row.soyad, adsoyad: `${row.ad} ${row.soyad}`.trim(), no: row.ogrNo, kod: row.veliKodu || '',
    sinav: ctx.exam.name, tarih: waDate(ctx.exam.date), puan: nf(so.puan, 2), net: nf(so.net, 2), D: so.D == null ? '' : so.D, Y: so.Y == null ? '' : so.Y, B: so.B == null ? '' : so.B,
    siraSinif: rk(sira.sinif), siraOkul: rk(sira.okul), siraIlce: rk(sira.ilce), siraIl: rk(sira.il),
    dersler: secs.length > 1 ? secs.map(x => `${x.name}: ${nf(x.net, 2)} net`).join('\n') : '', link: waLink(ctx.okulKodu, row), kime: waKime(t)
  };
}
/** Henüz kuyruk hazırlanmamışken önizleme için uydurma öğrenci. */
const WA_SAMPLE = {
  ctx: { okulAdi: 'Örnek Ortaokulu', okulKodu: '10001', exam: { name: 'Deneme Sınavı 1', date: new Date().toISOString().slice(0, 10) } },
  row: { ogrNo: '125', ad: 'Ayşe', soyad: 'Yılmaz', sinif: '8-A', veliKodu: '482913', sonuc: { puan: 412.5, net: 68.25, D: 72, Y: 7, B: 11, sira: { sinif: [3, 28], okul: [12, 140], ilce: [0, 0], il: [0, 0] }, sections: [{ name: 'Türkçe', net: 17.5 }, { name: 'Matematik', net: 14.25 }, { name: 'Fen Bilimleri', net: 16.5 }, { name: 'İnkılap', net: 9.5 }, { name: 'Din Kültürü', net: 9 }, { name: 'İngilizce', net: 1.5 }] } }
};
/** Şablondaki tanınmayan {yer tutucu}ları döndürür. */
const waUnknown = tpl => Array.from(new Set((String(tpl || '').match(/\{(\w+)\}/g) || []).map(x => x.slice(1, -1)).filter(k => !WA_KEYS.includes(k))));

function waTab(pane) {
  const S = App.state, u = S.user;
  const st = { ctx: null, rows: [], sel: new Set(), prev: 0 };
  const schoolSel = h('select', { id: 'wa-school' }, h('option', { value: '' }, 'Okul seçin…'), S.schools.map(s => h('option', { value: s.okulKodu }, schoolLabel(s)))), schoolPick = schoolPicker(schoolSel, S.schools);
  const examSel = h('select', { id: 'wa-exam' }), classSel = h('select', { id: 'wa-class' });
  const hedefSel = h('select', { id: 'wa-hedef' }, h('option', { value: 'hepsi' }, 'Anne ve baba'), h('option', { value: 'anne' }, 'Yalnız anne'), h('option', { value: 'baba' }, 'Yalnız baba'));
  const tekrar = h('input', { type: 'checkbox', id: 'wa-tekrar' }), kodUret = h('input', { type: 'checkbox', id: 'wa-kod', checked: true });
  const prepBtn = h('button', { class: 'btn primary', id: 'wa-prepare' }, 'Mesajları hazırla');
  const info = h('div', { id: 'wa-info' }), out = h('div', { id: 'wa-out' });
  if (u.role === 'okul' && S.schools[0]) schoolSel.value = S.schools[0].okulKodu;
  else if (!schoolSel.value) { const last = Settings.get('waSchool', ''); if (S.schools.some(s => String(s.okulKodu) === String(last))) schoolSel.value = last; }

  /* ---------------- sınav ve sınıf listeleri ---------------- */
  const covers = (ex, sc) => !sc ? false : ex.scopeType === 'genel' ? true : ex.scopeType === 'il' ? sc.il === ex.scopeValue : ex.scopeType === 'ilce' ? `${sc.il}|${sc.ilce}` === ex.scopeValue : String(sc.okulKodu) === String(ex.scopeValue);
  function fillExams() {
    const sc = schoolByCode(schoolSel.value), list = (S.exams || []).filter(e => e.status !== 'draft' && covers(e, sc)).sort((a, b) => String(b.date).localeCompare(String(a.date)));
    clear(examSel).append(...(list.length ? list : [null]).map(e => e ? h('option', { value: e.examId }, `${waDate(e.date)} · ${e.name}${e.config && e.config.veli ? '' : ' (veli sorgusu kapalı)'}`) : h('option', { value: '' }, schoolSel.value ? '(bu okul için sonuçlanmış sınav yok)' : '(önce okul seçin)')));
  }
  async function fillClasses() {
    const code = schoolSel.value; clear(classSel).append(h('option', { value: '' }, 'Tüm sınıflar'));
    if (!code) return;
    const list = await getStudents(code); if (schoolSel.value !== code) return;
    clear(classSel).append(h('option', { value: '' }, 'Tüm sınıflar'), ...Array.from(new Set(list.map(x => x.sinif).filter(Boolean))).sort((a, b) => String(a).localeCompare(String(b), 'tr', { numeric: true })).map(c => h('option', { value: c }, c)));
  }
  schoolSel.addEventListener('change', () => { Settings.set('waSchool', schoolSel.value); st.ctx = null; clear(out); clear(info); fillExams(); fillClasses(); });

  /* ---------------- şablon ---------------- */
  const tpl = h('textarea', { id: 'wa-tpl', rows: 15, spellcheck: 'false', style: { letterSpacing: 0, fontFamily: 'inherit' } });
  tpl.value = Settings.get('waTpl', WA_DEFAULT_TPL) || WA_DEFAULT_TPL;
  const tplWarn = h('div', { id: 'wa-tpl-warn' }), prevSel = h('select', { id: 'wa-prev' }), prevBox = h('pre', { id: 'wa-preview', style: { whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: '.4rem 0 0', padding: '.7rem .8rem', borderRadius: '10px', background: 'var(--ok-soft, #e7f5ec)', fontFamily: 'inherit', fontSize: '.92rem' } });
  const prevInfo = h('div', { class: 'small muted', id: 'wa-prev-info' });
  const chips = h('div', { class: 'chips' }, WA_PLACEHOLDERS.map(([k, l]) => h('button', { type: 'button', class: 'chip', title: l, 'data-ph': k, onclick: () => { const a = tpl.selectionStart == null ? tpl.value.length : tpl.selectionStart, b = tpl.selectionEnd == null ? a : tpl.selectionEnd; tpl.setRangeText('{' + k + '}', a, b, 'end'); tpl.focus(); tpl.dispatchEvent(new Event('input')); } }, '{' + k + '}')));
  function entries() {
    const res = [];
    st.rows.forEach(row => row.targets.forEach(t => res.push({ row, t, key: t.key, n: t.n, text: waRender(tpl.value, waVals(st.ctx, row, t)) })));
    return res;
  }
  function drawPreview() {
    clear(tplWarn);
    const unk = waUnknown(tpl.value); if (unk.length) tplWarn.append(h('div', { class: 'alert warn' }, 'Tanınmayan yer tutucu: ' + unk.map(k => '{' + k + '}').join(', ') + ' (olduğu gibi gönderilir).'));
    if (!st.ctx || !st.rows.length) { prevBox.textContent = waRender(tpl.value, waVals(WA_SAMPLE.ctx, WA_SAMPLE.row, { kime: 'anne' })); prevInfo.style.color = ''; prevInfo.textContent = 'Uydurma bir öğrenciyle örnek görünüm. Gerçek önizleme için “Mesajları hazırla”ya basın.'; return; }
    const row = st.rows[Math.min(st.prev, st.rows.length - 1)], t = row.targets[0], txt = waRender(tpl.value, waVals(st.ctx, row, t));
    prevBox.textContent = txt; prevInfo.textContent = `${txt.length} karakter${txt.length > 1000 ? ' — uzun mesajlar WhatsApp bağlantısında kesilebilir, kısaltın.' : ''}`;
    prevInfo.style.color = txt.length > 1000 ? 'var(--warn)' : '';
  }
  tpl.addEventListener('input', () => { Settings.set('waTpl', tpl.value); drawPreview(); if (st.ctx) drawTable(); });
  prevSel.addEventListener('change', () => { st.prev = Number(prevSel.value) || 0; drawPreview(); });

  /* ---------------- kuyruk hazırlama ---------------- */
  async function prepare() {
    clear(info); clear(out);
    if (!schoolSel.value) return info.append(h('div', { class: 'alert bad', role: 'alert' }, 'Önce okulu seçin.'));
    if (!examSel.value) return info.append(h('div', { class: 'alert bad', role: 'alert' }, 'Bu okul için seçilebilir sınav yok (taslak sınavlar listelenmez).'));
    prepBtn.disabled = true; const old = prepBtn.textContent; prepBtn.textContent = 'Hazırlanıyor…';
    try {
      const d = await api('waQueue', { okulKodu: schoolSel.value, examId: examSel.value, sinif: classSel.value || undefined, hedef: hedefSel.value, tekrar: tekrar.checked, kodUret: kodUret.checked }, { timeout: 120000 });
      st.ctx = { okulAdi: d.okulAdi, okulKodu: d.okulKodu, exam: d.exam }; st.rows = d.rows; st.sel = new Set(); st.prev = 0; st.res = d;
      st.rows.forEach(r => r.targets.forEach(t => { if (!t.sent) st.sel.add(t.key); }));
      drawResult();
    } catch (e) { info.append(h('div', { class: 'alert bad', role: 'alert' }, e.message)); }
    prepBtn.disabled = false; prepBtn.textContent = old;
  }
  prepBtn.addEventListener('click', prepare);

  /* ---------------- sonuç: uyarılar + tablo + aktarma ---------------- */
  const tableBox = h('div', { id: 'wa-table' }), selInfo = h('span', { class: 'small muted', id: 'wa-selinfo' });
  function drawResult() {
    const d = st.res, c = d.counts;
    clear(out);
    const notes = [];
    if (!d.exam.veliAcik) notes.push(h('div', { class: 'alert warn', id: 'wa-w-veli' }, 'Bu sınav “öğrenci/veli sorgulamasına açık” değil: veli giriş yapınca sonucu GÖRMEZ. Önce Sınavlar bölümünden sınavı düzenleyip bu seçeneği işaretleyin.'));
    if (d.codesCreated) notes.push(h('div', { class: 'alert info', id: 'wa-w-kod' }, `${d.codesCreated} öğrenciye veli kodu üretildi ve mesaja yazıldı. Kodu olan öğrencinin sonucuna artık yalnızca kodu bilen veli ulaşır. Tüm kodları Öğrenciler sekmesinden de indirebilirsiniz.`));
    if (d.truncated) notes.push(h('div', { class: 'alert warn' }, 'Çok sayıda alıcı var; ilk 1000’i listelendi. Sınıf seçerek bölün.'));
    const skipTxt = [c.telefonYok ? `${c.telefonYok} öğrencide telefon yok` : '', c.sonucYok ? `${c.sonucYok} öğrencinin bu sınavda sonucu yok` : '', c.gonderilmis ? `${c.gonderilmis} öğrenciye daha önce gönderilmiş` : '', c.gecersiz ? `${c.gecersiz} öğrenci numarası geçersiz` : ''].filter(Boolean);
    const skipped = d.skipped.length ? h('details', { class: 'small', id: 'wa-skipped' }, h('summary', null, 'Atlananlar: ' + skipTxt.join(' · ')), h('div', { class: 'tablewrap', style: { maxHeight: '220px', marginTop: '.4rem' } }, h('table', null, h('tbody', null, d.skipped.map(x => h('tr', null, h('td', null, x.sinif), h('td', null, x.ogrNo), h('td', null, `${x.ad} ${x.soyad}`), h('td', null, x.neden))))))) : null;
    out.append(
      h('div', { class: 'card' }, h('h2', null, `${d.exam.name} — ${st.rows.length} öğrenciye mesaj hazır`), h('p', { class: 'small muted', style: { marginTop: 0 } }, `${d.okulAdi} · ${c.ogrenci} öğrenciden ${c.hazir} tanesi hazır.`), ...notes, skipped),
      st.rows.length ? h('div', { class: 'card' }, h('h2', null, 'Alıcılar'), h('div', { class: 'row', style: { marginBottom: '.5rem' } },
        h('button', { class: 'btn sm', id: 'wa-all', onclick: () => { entries().forEach(e => st.sel.add(e.key)); drawTable(); } }, 'Hepsini seç'),
        h('button', { class: 'btn sm', id: 'wa-none', onclick: () => { st.sel.clear(); drawTable(); } }, 'Seçimi kaldır'),
        h('button', { class: 'btn sm', id: 'wa-first', onclick: () => { st.sel.clear(); entries().slice(0, 50).forEach(e => st.sel.add(e.key)); drawTable(); } }, 'İlk 50’yi seç'), selInfo), tableBox,
        h('div', { class: 'card', style: { marginTop: '1rem' } }, h('h2', null, 'WhatsApp eklentisiyle gönder'), extBox())) : null,
      h('div', { class: 'card' }, h('h2', null, 'Gönderilenleri işaretle'), markBox()));
    // önizleme öğrenci listesi
    clear(prevSel).append(...st.rows.slice(0, 300).map((r, i) => h('option', { value: i }, `${r.sinif} · ${r.ogrNo} · ${r.ad} ${r.soyad}`)));
    drawTable(); drawPreview();
  }

  function drawTable() {
    const all = entries(), shown = all.slice(0, WA_SHOW);
    selInfo.textContent = `${Array.from(st.sel).filter(k => all.some(e => e.key === k)).length} / ${all.length} alıcı seçili${all.length > shown.length ? ` (tabloda ilk ${shown.length} gösteriliyor)` : ''}`;
    clear(tableBox).append(h('div', { class: 'tablewrap' }, h('table', null, h('thead', null, h('tr', null, h('th', null, ''), h('th', null, 'Sınıf'), h('th', null, 'No'), h('th', null, 'Öğrenci'), h('th', null, 'Alıcı'), h('th', null, 'Numara'), h('th', null, ''))),
      h('tbody', null, shown.map(e => h('tr', { 'data-key': e.key },
        h('td', null, h('input', { type: 'checkbox', class: 'wa-chk', 'aria-label': 'Seç', checked: st.sel.has(e.key), onchange: ev => { ev.target.checked ? st.sel.add(e.key) : st.sel.delete(e.key); drawSelInfo(); } })),
        h('td', null, e.row.sinif), h('td', null, e.row.ogrNo), h('td', null, `${e.row.ad} ${e.row.soyad}`), h('td', null, waKime(e.t) + (e.t.sent ? ' · gönderilmişti' : '')), h('td', { class: 'mono' }, telShow(e.n)),
        h('td', { class: 'right nowrap' },
          h('a', { class: 'btn sm', 'data-act': 'open', href: `https://wa.me/${e.n}?text=${encodeURIComponent(e.text)}`, target: '_blank', rel: 'noopener' }, 'WhatsApp’ta aç'), ' ',
          h('button', { class: 'btn sm', 'data-act': 'sent', onclick: () => markSent([e.key]) }, 'Gönderdim'))))))));
    drawExt();
  }
  function drawSelInfo() { const all = entries(); selInfo.textContent = `${all.filter(e => st.sel.has(e.key)).length} / ${all.length} alıcı seçili`; drawExt(); }

  /* ---------------- eklenti ---------------- */
  const extInfo = h('div', { id: 'wa-ext-info', class: 'small' }), extTa = h('textarea', { rows: 3, id: 'wa-ext-ta', class: 'hidden', readOnly: true, style: { marginTop: '.5rem' } });
  const selected = () => entries().filter(e => st.sel.has(e.key));
  const queueJson = () => JSON.stringify(selected().map(e => ({ id: e.key, n: e.n, t: e.text, ad: `${e.row.ad} ${e.row.soyad} (${waKime(e.t)})` })));
  function drawExt() {
    const n = selected().length; clear(extInfo);
    extInfo.append(h('span', null, `${n} alıcı seçili.`), n > WA_DAILY ? h('div', { class: 'alert warn', id: 'wa-w-limit' }, `Eklenti günde en fazla ${WA_DAILY} mesaj gönderir (WhatsApp hesabınızı korumak için). Fazlası ertesi gün gönderilsin: “İlk 50’yi seç”i kullanın, gönderilenleri işaretleyin, sonra tekrar hazırlayın.`) : null);
    copyBtn.disabled = dlBtn.disabled = !n;
  }
  const copyBtn = h('button', { class: 'btn primary', id: 'wa-copy', onclick: async () => {
    const j = queueJson();
    try { await navigator.clipboard.writeText(j); toast('Kuyruk kopyalandı: WhatsApp Web’deki eklenti panelinde “Yükle”ye yapıştırın', 'ok', 5000); extTa.classList.add('hidden'); }
    catch (e) { extTa.value = j; extTa.classList.remove('hidden'); extTa.select(); toast('Kopyalanamadı; kutudaki metni elle kopyalayın (Ctrl+A, Ctrl+C)', 'warn', 6000); }
  } }, 'Eklenti için kuyruğu kopyala');
  const dlBtn = h('button', { class: 'btn', id: 'wa-dl', onclick: () => download(`veli-kuyruk-${st.ctx.okulKodu}.json`, queueJson(), 'application/json') }, 'JSON olarak indir');
  function extBox() {
    return h('div', null,
      h('ol', { class: 'small', style: { margin: '0 0 .6rem 1.1rem', padding: 0 } },
        h('li', null, 'Eklentiyi bir kez kurun: ', h('a', { href: 'whatsapp-eklentisi.zip', download: '', id: 'wa-ext-zip' }, 'whatsapp-eklentisi.zip'), ' → klasöre çıkarın → Chrome’da ', h('span', { class: 'mono' }, 'chrome://extensions'), ' → Geliştirici modu → “Paketlenmemiş öğe yükle”.'),
        h('li', null, 'web.whatsapp.com’u açıp QR ile giriş yapın.'), h('li', null, 'Aşağıdaki düğmeyle kuyruğu kopyalayın; eklenti panelinde yapıştırıp “Yükle” → “Başlat”.'),
        h('li', null, 'Bitince eklentide “Gönderilenleri kopyala”, aşağıdaki “Gönderilenleri işaretle” kutusuna yapıştırın.')),
      h('div', { class: 'row' }, copyBtn, dlBtn), extInfo, extTa,
      h('div', { class: 'alert warn small', style: { marginTop: '.6rem' } }, 'WhatsApp otomatik/toplu gönderimi kullanım şartlarında kısıtlar; hesap kısıtlanabilir veya kapatılabilir. Eklenti yavaş ve sınırlı çalışır ama riski sıfırlamaz: ilk denemeyi 2–3 kişiyle yapın, mümkünse okulun ayrı bir hattını kullanın. Veli telefonları ve sonuçlar kişisel veridir (KVKK): velilerin bu amaçla bilgilendirilmesini/iznini okulunuz sağlamalıdır.'));
  }

  /* ---------------- gönderildi işaretleme ---------------- */
  async function markSent(keys) {
    if (!st.ctx || !keys.length) return;
    try {
      const r = await api('waMarkSent', { okulKodu: st.ctx.okulKodu, examId: st.ctx.exam.examId, keys });
      const set = new Set(keys);
      st.rows.forEach(row => row.targets.forEach(t => { if (set.has(t.key)) t.sent = true; }));
      if (!tekrar.checked) { st.rows = st.rows.filter(row => { row.targets = row.targets.filter(t => !set.has(t.key)); return row.targets.length; }); }
      keys.forEach(k => st.sel.delete(k));
      toast(`${r.marked} gönderim kaydedildi${r.already ? `, ${r.already} zaten kayıtlıydı` : ''}${r.ignored ? `, ${r.ignored} geçersiz kod yok sayıldı` : ''}`, 'ok');
      st.res.counts.hazir = st.rows.length; drawResult(); return r;
    } catch (e) { toast(e.message, 'bad', 8000); }
  }
  function markBox() {
    const ta = h('textarea', { rows: 3, id: 'wa-mark-ta', placeholder: '["E1a2b3c|10001|101|anne", "E1a2b3c|10001|101|baba"]', style: { letterSpacing: 0 } });
    const msg = h('div', { id: 'wa-mark-msg' });
    return h('div', null, h('p', { class: 'small muted', style: { marginTop: 0 } }, 'Eklentide “Gönderilenleri kopyala”ya basıp çıkan listeyi buraya yapıştırın. İşaretlenenler bir sonraki hazırlıkta tekrar gelmez. Elle (“WhatsApp’ta aç”) gönderdiklerinizi satırdaki “Gönderdim” ile işaretleyin.'),
      ta, h('div', { class: 'row', style: { marginTop: '.5rem' } }, h('button', { class: 'btn primary', id: 'wa-mark', onclick: async ev => {
        clear(msg); let keys;
        try { const v = JSON.parse(ta.value); keys = (Array.isArray(v) ? v : []).map(String); } catch (e) { keys = ta.value.split(/[\s,;"\[\]]+/).filter(x => x.split('|').length === 4); }
        if (!keys.length) return msg.append(h('div', { class: 'alert bad' }, 'Geçerli bir gönderim listesi bulunamadı.'));
        const b = ev.currentTarget; b.disabled = true; const r = await markSent(keys); b.disabled = false;
        if (r) { ta.value = ''; msg.append(h('div', { class: 'alert ok' }, `${r.marked} yeni gönderim işaretlendi.`)); }
      } }, 'Gönderilenleri işaretle')), msg);
  }

  /* ---------------- sayfa ---------------- */
  fillExams(); fillClasses();
  const field = (l, el) => h('div', { class: 'field' }, h('label', null, l), el);
  pane.append(
    h('div', { class: 'card' }, h('h2', null, 'Veli WhatsApp mesajları'),
      h('p', { class: 'small muted', style: { marginTop: 0 } }, 'Her öğrencinin sonucu, anne ve/veya babasının telefonuna kişiye özel mesaj olarak hazırlanır: kısa sonuç özeti ve velinin uygulamaya nasıl gireceği (okul, sınıf, okul numarası, veli kodu). Veli bağlantıdan girince bu sınav ve geçmiş tüm sınavlarının analizini görür. Telefonlar Öğrenciler sekmesinden (ya da Excel yapıştırarak) girilir.'),
      h('div', { class: 'grid' }, field('Okul', schoolPick), field('Sınav', examSel), field('Sınıf', classSel), field('Alıcı', hedefSel)),
      h('label', { class: 'row', style: { margin: '.6rem 0 .1rem' } }, kodUret, 'Veli kodu olmayan öğrencilere kod üret ve mesaja yaz (önerilir)'),
      h('label', { class: 'row', style: { margin: '.1rem 0 .6rem' } }, tekrar, 'Daha önce gönderilenlere de yeniden hazırla'),
      h('div', { class: 'row' }, prepBtn), info),
    h('div', { class: 'card' }, h('h2', null, 'Mesaj şablonu'), h('p', { class: 'small muted', style: { marginTop: 0 } }, 'Yer tutucuya tıklayınca imlecin olduğu yere eklenir. Değeri boş olan yer tutucunun satırı (ör. veli kodu yoksa) mesajdan çıkar. Şablon bu cihazda saklanır.'),
      chips, tpl, tplWarn, h('div', { class: 'row', style: { marginTop: '.4rem' } }, h('button', { class: 'btn sm', id: 'wa-reset', onclick: () => { tpl.value = WA_DEFAULT_TPL; tpl.dispatchEvent(new Event('input')); } }, 'Varsayılana dön')),
      h('div', { class: 'row between', style: { marginTop: '.6rem' } }, h('strong', null, 'Önizleme'), prevSel), prevBox, prevInfo),
    out);
  drawPreview();
}
