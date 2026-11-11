/* kayit.js — herkese açık üyelik sayfası (#/kayit): öğretmen üyeliği ve okul kaydı. Giriş gerekmez; başvurular yetkili onayına gider. */
'use strict';

const IL_81 = ['Adana', 'Adıyaman', 'Afyonkarahisar', 'Ağrı', 'Aksaray', 'Amasya', 'Ankara', 'Antalya', 'Ardahan', 'Artvin', 'Aydın', 'Balıkesir', 'Bartın', 'Batman', 'Bayburt', 'Bilecik', 'Bingöl', 'Bitlis', 'Bolu', 'Burdur', 'Bursa', 'Çanakkale', 'Çankırı', 'Çorum', 'Denizli', 'Diyarbakır', 'Düzce', 'Edirne', 'Elazığ', 'Erzincan', 'Erzurum', 'Eskişehir', 'Gaziantep', 'Giresun', 'Gümüşhane', 'Hakkari', 'Hatay', 'Iğdır', 'Isparta', 'İstanbul', 'İzmir', 'Kahramanmaraş', 'Karabük', 'Karaman', 'Kars', 'Kastamonu', 'Kayseri', 'Kırıkkale', 'Kırklareli', 'Kırşehir', 'Kilis', 'Kocaeli', 'Konya', 'Kütahya', 'Malatya', 'Manisa', 'Mardin', 'Mersin', 'Muğla', 'Muş', 'Nevşehir', 'Niğde', 'Ordu', 'Osmaniye', 'Rize', 'Sakarya', 'Samsun', 'Siirt', 'Sinop', 'Sivas', 'Şanlıurfa', 'Şırnak', 'Tekirdağ', 'Tokat', 'Trabzon', 'Tunceli', 'Uşak', 'Van', 'Yalova', 'Yozgat', 'Zonguldak'];
const DUZEYLER = ['Okul öncesi', 'İlkokul', 'Ortaokul', 'Lise', 'Diğer'];

/** Sunucu adresi tanımlı değilse (config.js boş ve bu cihazda girilmemiş) adres isteyen kutu. Yalnızca Google Apps Script adresi kabul edilir. */
App.urlPrompt = function (box, onSaved) {
  const u = h('input', { type: 'url', id: 'rg-url', placeholder: 'https://script.google.com/macros/s/…/exec', autocomplete: 'off' });
  box.append(h('div', { class: 'alert warn' }, 'Bu site için sunucu adresi tanımlı değil. Yöneticinizden adresi isteyin ya da aşağıya yapıştırın.'), h('div', { class: 'field' }, h('label', null, 'Sunucu adresi (Apps Script /exec)'), u),
    h('button', { class: 'btn', style: { marginTop: '.5rem' }, onclick: () => { const v = u.value.trim(); if (!/^https:\/\/script\.google(usercontent)?\.com\/.+/.test(v)) return toast('Adres https://script.google.com/macros/s/…/exec biçiminde olmalı.', 'bad'); Settings.set('apiUrl', v); onSaved(); } }, 'Kaydet'));
};

App.renderRegister = function () {
  const app = clear($('#app')), S = { tab: 'ogretmen', places: null };
  const back = h('a', { href: '#', id: 'rg-back', onclick: e => { e.preventDefault(); App.backToApp(); } }, App.state.user ? '← Uygulamaya dön' : '← Girişe dön');
  const body = h('div');
  const tabs = h('div', { class: 'tabs', role: 'tablist' });
  const root = h('div', { class: 'reg' }, h('p', { style: { margin: 0 } }, back), h('h1', null, 'Üye ol'),
    h('p', { class: 'muted small center', style: { marginTop: 0 } }, 'Başvurunuz, ilgili yetkilinin onayından sonra etkinleşir. Parolanız özetlenerek saklanır; düz metin olarak tutulmaz.'), tabs, body);
  app.append(root);

  const drawTabs = () => clear(tabs).append(...[['ogretmen', 'Öğretmen üyeliği'], ['okul', 'Okul kaydı (okul yöneticisi)']].map(([id, l]) => h('button', { id: 'rg-tab-' + id, role: 'tab', class: S.tab === id ? 'active' : '', onclick: () => { S.tab = id; drawTabs(); draw(); } }, l)));
  const draw = () => { S.gen = (S.gen || 0) + 1; clear(body); (S.tab === 'ogretmen' ? teacherForm : schoolForm)(body); };

  async function loadPlaces() {
    if (S.places) return S.places;
    if (!getApiUrl()) throw Object.assign(new Error('Sunucu adresi tanımlı değil.'), { code: 'NOURL' });
    S.places = (await api('publicSchools', {}, { noAuthRedirect: true })).iller || []; return S.places;
  }
  const field = (label, input, hint) => h('div', { class: 'field' }, h('label', null, label), input, hint ? h('span', { class: 'small muted' }, hint) : null);
  const inp = (attrs) => h('input', Object.assign({ type: 'text', autocomplete: 'off' }, attrs));
  const honeypot = () => h('div', { class: 'hp', 'aria-hidden': 'true' }, h('label', null, 'Bu alanı boş bırakın'), h('input', { type: 'text', name: 'website', id: 'rg-website', tabindex: '-1', autocomplete: 'off' }));
  const needUrl = (box) => App.urlPrompt(box, () => { S.places = null; draw(); });
  const done = (box, title, text) => { clear(box).append(h('div', { class: 'card', id: 'rg-done' }, h('h2', null, title), h('p', null, text), h('p', { class: 'small muted' }, 'Onaylanıp onaylanmadığını, giriş sayfasında kullanıcı adı ve parolanızla denediğinizde görebilirsiniz.'), h('button', { class: 'btn primary', onclick: () => App.backToApp() }, 'Giriş sayfasına git'))); window.scrollTo(0, 0); };
  const passPair = () => { const a = inp({ type: 'password', id: 'rg-pass', autocomplete: 'new-password', placeholder: 'En az 8 karakter' }), b = inp({ type: 'password', id: 'rg-pass2', autocomplete: 'new-password' }); return { a, b, node: h('div', { class: 'grid' }, field('Parola', a), field('Parola (tekrar)', b)) }; };
  const submitter = (btn, err, fn) => async () => { clear(err); btn.disabled = true; const t = btn.textContent; btn.textContent = 'Gönderiliyor…'; try { await fn(); } catch (e) { err.append(h('div', { class: 'alert bad' }, isNetErr(e) ? 'Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edin.' : e.message)); } btn.disabled = false; btn.textContent = t; };

  /* ---------------- öğretmen ---------------- */
  function teacherForm(box) {
    const err = h('div'), il = h('select', { id: 'rg-il' }), ilce = h('select', { id: 'rg-ilce' }), duzey = h('select', { id: 'rg-duzey' }, h('option', { value: '' }, 'Tüm düzeyler'), DUZEYLER.map(d => h('option', { value: d }, d))), okul = h('select', { id: 'rg-okul' });
    const name = inp({ id: 'rg-name', placeholder: 'Ad Soyad', autocomplete: 'name' }), brans = inp({ id: 'rg-brans', placeholder: 'Örn: Fen Bilimleri' }), tel = inp({ id: 'rg-tel', type: 'tel', placeholder: '05xx xxx xx xx', autocomplete: 'tel' }), mail = inp({ id: 'rg-mail', type: 'email', placeholder: 'ornek@eposta.com', autocomplete: 'email' });
    const user = inp({ id: 'rg-user', autocapitalize: 'none', spellcheck: 'false', placeholder: 'küçük harf, rakam, . _ -' }), pw = passPair(), hp = honeypot(), btn = h('button', { class: 'btn primary', id: 'rg-send', style: { width: '100%', marginTop: '.8rem' } }, 'Başvur');
    const info = h('div', { class: 'small muted' }); let schools = [];
    const fillOkul = () => { const d = duzey.value, list = schools.filter(s => !d || s.tur === d); clear(okul).append(h('option', { value: '' }, list.length ? 'Okulunuzu seçin…' : '(bu düzeyde okul yok)'), list.map(s => h('option', { value: s.okulKodu }, s.okulAdi + ' · ' + s.tur))); };
    const fillIlce = () => { const p = S.places.find(x => x.il === il.value); clear(ilce).append(h('option', { value: '' }, 'İlçe seçin…'), (p ? p.ilceler : []).map(x => h('option', { value: x }, x))); schools = []; fillOkul(); };
    async function loadSchools() { schools = []; fillOkul(); if (!il.value || !ilce.value) return; try { schools = (await api('publicSchools', { il: il.value, ilce: ilce.value }, { noAuthRedirect: true })).schools || []; } catch (e) { clear(err).append(h('div', { class: 'alert bad' }, e.message)); } fillOkul(); info.textContent = schools.length ? `${schools.length} okul listelendi` : 'Bu ilçede kayıtlı okul yok.'; }
    il.addEventListener('change', fillIlce); ilce.addEventListener('change', loadSchools); duzey.addEventListener('change', fillOkul);
    btn.addEventListener('click', submitter(btn, err, async () => {
      if (!okul.value) throw new Error('Okulunuzu listeden seçin.');
      if (pw.a.value !== pw.b.value) throw new Error('Parolalar aynı değil.');
      const r = await api('registerTeacher', { okulKodu: okul.value, name: name.value, brans: brans.value, telefon: tel.value, eposta: mail.value, username: user.value.trim().toLowerCase(), password: pw.a.value, website: $('#rg-website').value }, { noAuthRedirect: true });
      done(box, 'Başvurunuz alındı', `${r.okulAdi ? r.okulAdi + ' için ' : ''}öğretmen üyeliği başvurunuz onaya gönderildi. Okul yöneticiniz (ya da ilçe/il yetkilisi) onayladığında giriş yapabilirsiniz.`);
    }));
    const gen = S.gen; box.append(h('div', { class: 'card' }, h('div', { class: 'muted small' }, 'Yükleniyor…')));
    loadPlaces().then(places => {
      if (gen !== S.gen) return; clear(box);
      if (!places.length) { box.append(h('div', { class: 'card' }, h('div', { class: 'alert warn' }, 'Sistemde henüz kayıtlı okul yok. Önce okul yöneticisinin "Okul kaydı" sekmesinden okulunu kaydetmesi ve onaylanması gerekir.'))); return; }
      clear(il).append(h('option', { value: '' }, 'İl seçin…'), places.map(p => h('option', { value: p.il }, p.il))); fillIlce();
      box.append(h('div', { class: 'card' }, h('h2', null, 'Okulunuzu seçin'), h('div', { class: 'grid' }, field('İl', il), field('İlçe', ilce), field('Okul düzeyi', duzey), field('Okul', okul)), info),
        h('div', { class: 'card' }, h('h2', null, 'Bilgileriniz'), h('div', { class: 'grid' }, field('Ad soyad', name), field('Branş', brans), field('Telefon (isteğe bağlı)', tel), field('E-posta (isteğe bağlı)', mail)),
          h('h2', { style: { marginTop: '1rem' } }, 'Giriş bilgileriniz'), h('div', { class: 'grid' }, field('Kullanıcı adı', user)), pw.node, hp, err, btn,
          h('p', { class: 'small muted' }, 'Üye olduktan sonra kendi sınavlarınızı oluşturup okutabilirsiniz. Sınavlarınızı ve sonuçlarını yalnızca siz ve okul yöneticiniz görür.')));
    }).catch(e => { if (gen !== S.gen) return; clear(box); if (e.code === 'NOURL') needUrl(box); else box.append(h('div', { class: 'alert bad' }, isNetErr(e) ? 'Sunucuya ulaşılamadı. İnternet bağlantınızı ve sunucu adresini kontrol edin.' : e.message)); });
  }

  /* ---------------- okul ---------------- */
  function schoolForm(box) {
    if (!getApiUrl()) { needUrl(box); return; }
    const err = h('div'), il = h('select', { id: 'rg-il' }, h('option', { value: '' }, 'İl seçin…'), IL_81.map(x => h('option', { value: x }, x))), ilce = inp({ id: 'rg-ilce', list: 'rg-ilce-list', placeholder: 'İlçe adı' }), dl = h('datalist', { id: 'rg-ilce-list' });
    const duzey = h('select', { id: 'rg-duzey' }, h('option', { value: '' }, 'Düzey seçin…'), DUZEYLER.map(d => h('option', { value: d }, d)));
    const ad = inp({ id: 'rg-okuladi', placeholder: 'Örn: Atatürk Ortaokulu' }), kod = inp({ id: 'rg-kod', inputmode: 'numeric', placeholder: 'MEB kurum kodu (rakam)' });
    const mudur = inp({ id: 'rg-mudur', placeholder: 'Okul müdürünün adı soyadı' }), tel = inp({ id: 'rg-tel', type: 'tel', placeholder: '05xx xxx xx xx' }), mail = inp({ id: 'rg-mail', type: 'email', placeholder: 'okul@eposta.com' }), adres = h('textarea', { id: 'rg-adres', rows: 3, placeholder: 'Mahalle, cadde/sokak, no, ilçe/il', maxlength: 300 });
    const yetkili = inp({ id: 'rg-name', placeholder: 'Boş bırakırsanız müdür adı kullanılır' }), user = inp({ id: 'rg-user', autocapitalize: 'none', spellcheck: 'false', placeholder: 'küçük harf, rakam, . _ -' }), pw = passPair(), hp = honeypot(), btn = h('button', { class: 'btn primary', id: 'rg-send', style: { width: '100%', marginTop: '.8rem' } }, 'Okulu kaydet ve onaya gönder');
    il.addEventListener('change', async () => { clear(dl); if (!il.value) return; try { const p = (await loadPlaces()).find(x => x.il === il.value); dl.append(...(p ? p.ilceler : []).map(x => h('option', { value: x }))); } catch (e) { } });
    btn.addEventListener('click', submitter(btn, err, async () => {
      if (pw.a.value !== pw.b.value) throw new Error('Parolalar aynı değil.');
      const r = await api('registerSchool', { il: il.value, ilce: ilce.value, okulAdi: ad.value, okulKodu: kod.value.trim(), duzey: duzey.value, mudur: mudur.value, telefon: tel.value, eposta: mail.value, adres: adres.value, name: yetkili.value, username: user.value.trim().toLowerCase(), password: pw.a.value, website: $('#rg-website').value }, { noAuthRedirect: true });
      done(box, 'Okul kaydınız alındı', `${r.okulAdi || 'Okulunuz'} için kayıt başvurusu ilgili il/ilçe yetkilisinin onayına gönderildi. Onaylanınca kullanıcı adınızla okul yöneticisi olarak giriş yapar ve öğretmenlerinizin başvurularını onaylayabilirsiniz; öğretmenler üye olurken okulunuzu listeden seçer.`);
    }));
    clear(box).append(h('div', { class: 'card' }, h('h2', null, 'Okul bilgileri'), h('div', { class: 'grid' }, field('İl', il), field('İlçe', ilce, 'Listede yoksa yazın'), field('Okul düzeyi', duzey), field('Okul adı', ad), field('Kurum kodu', kod)), dl),
      h('div', { class: 'card' }, h('h2', null, 'Okul müdürü ve iletişim'), h('div', { class: 'grid' }, field('Müdür adı soyadı', mudur), field('Telefon', tel), field('E-posta', mail)), field('Adres', adres)),
      h('div', { class: 'card' }, h('h2', null, 'Yönetici hesabı'), h('p', { class: 'small muted', style: { marginTop: 0 } }, 'Okulunuz onaylanınca bu hesapla okul yöneticisi olarak giriş yaparsınız.'), h('div', { class: 'grid' }, field('Yetkili adı soyadı', yetkili), field('Kullanıcı adı', user)), pw.node, hp, err, btn,
        h('p', { class: 'small muted' }, 'Girdiğiniz müdür, telefon, e-posta ve adres bilgileri yalnızca onay yetkililerine görünür; kayıt sayfasında herkese yalnızca okul adı ve düzeyi listelenir.')));
    loadPlaces().catch(() => { });
  }

  drawTabs(); draw();
};
