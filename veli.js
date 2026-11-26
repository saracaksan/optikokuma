/* veli.js — Veli / Öğrenci Sonuç Sorgulama, Gmail/E-posta Üyeliği & Otomatik Eylem Planı
 * Sıraç Aksan Optik Okuma · Telif Hakkı © Sıraç AKSAN (İzinsiz kopyalamak, dağıtmak veya telif atmak ayıptır.)
 *
 * Üç giriş/erişim yolu:
 *  1) Hızlı Sorgu (girişsiz): İl → İlçe → Okul → Sınıf → Okul No (+ varsa Veli Kodu)
 *  2) Veli Girişi: Gmail / e-posta + parola ile tek tıkla öğrencinin tüm sınav sonuçları ve eylem planı
 *  3) Veli Üyeliği: Gmail / e-posta + cep telefonu + okul/sınıf/öğrenci no (+ veli kodu) ile kalıcı hesap açma
 * WhatsApp bağlantısı (#/ogrenci?okul=...&sinif=...&no=...&kod=...) ile açıldığında okul, sınıf ve numara otomatik dolar.
 */
'use strict';

const Veli = (() => {
  const DUZEYLER = ['Okul öncesi', 'İlkokul', 'Ortaokul', 'Lise', 'Diğer'];
  let idleTimer = 0;

  function clearIdle() { if (idleTimer) { clearTimeout(idleTimer); idleTimer = 0; } }
  function startIdle(onExpire) {
    clearIdle();
    idleTimer = setTimeout(() => { onExpire && onExpire(); }, 10 * 60 * 1000);
  }

  function parseQuery() {
    const out = {};
    const parseStr = s => {
      const qi = s.indexOf('?');
      if (qi >= 0) new URLSearchParams(s.slice(qi + 1)).forEach((v, k) => { out[k] = v; });
    };
    parseStr(String(location.search || ''));
    parseStr(String(location.hash || ''));
    return out;
  }

  function safeBack() {
    clearIdle();
    try { history.replaceState(null, '', location.pathname + location.search); } catch (x) { }
    if (typeof App !== 'undefined' && typeof App.backToApp === 'function') App.backToApp();
    else if (typeof App !== 'undefined' && App.state && App.state.user) { App.renderShell(); App.go(App.state.view || 'scan'); }
    else if (typeof App !== 'undefined' && typeof App.renderLogin === 'function') App.renderLogin();
  }

  function renderResult(root, data, onBack) {
    clear(root);
    startIdle(() => {
      toast('Güvenlik nedeniyle sonuç ekranı kapatıldı; yeniden sorgulayabilirsiniz.', 'warn', 6000);
      onBack();
    });

    const ogr = data.ogrenci || {}, exams = data.exams || [];
    root.append(
      h('div', { class: 'card' },
        h('div', { class: 'row between' },
          h('div', null,
            h('h2', { style: { margin: '0 0 .2rem' } }, ogr.ad || 'Öğrenci Sonuçları'),
            h('div', { class: 'small muted' }, `${ogr.okulAdi || ''} · ${[ogr.ilce, ogr.il].filter(Boolean).join(' / ')} · Sınıf: ${ogr.sinif || '–'} · No: ${ogr.ogrNo || '–'}`)
          ),
          h('div', { class: 'row no-print' },
            h('button', { class: 'btn sm', onclick: () => window.print() }, '🖨 Yazdır / PDF'),
            h('button', { class: 'btn sm primary', onclick: () => { clearIdle(); onBack(); } }, 'Başka sorgu')
          )
        )
      )
    );

    if (!exams.length) {
      root.append(h('div', { class: 'card empty' }, 'Henüz veli sorgulamasına açık sınav sonucu bulunmuyor. Öğretmeniniz sonuçları yayımladığında burada görünecektir.'));
      return;
    }

    exams.forEach(ex => {
      const sira = ex.sira || {}, ort = ex.ort || {};
      const rk = arr => (Array.isArray(arr) && arr[0] != null ? `${arr[0]} / ${arr[1] || ''}` : '–');
      const secs = ex.sections || [];
      const plan = ex.eylemPlani || [];

      const card = h('div', { class: 'card', style: { marginTop: '.8rem' } },
        h('div', { class: 'row between' },
          h('div', null,
            h('h3', { style: { margin: 0 } }, ex.name || 'Sınav'),
            h('div', { class: 'small muted' }, `${ex.date || ''}${ex.booklet ? ' · Kitapçık ' + ex.booklet : ''}`)
          ),
          h('span', { class: 'pill brand' }, ex.puan != null ? `Puan: ${nf(ex.puan, 2)}` : `Net: ${nf(ex.net, 2)}`)
        ),
        h('div', { class: 'stats', style: { marginTop: '.7rem' } },
          h('div', { class: 'stat' }, h('b', null, `${ex.D ?? 0}D / ${ex.Y ?? 0}Y / ${ex.B ?? 0}B`), h('span', null, 'Doğru / Yanlış / Boş')),
          h('div', { class: 'stat' }, h('b', null, nf(ex.net, 2)), h('span', null, 'Toplam Net')),
          h('div', { class: 'stat' }, h('b', null, ex.puan != null ? nf(ex.puan, 2) : '–'), h('span', null, 'Puan')),
          h('div', { class: 'stat' }, h('b', null, rk(sira.sinif)), h('span', null, 'Sınıf Sırası')),
          h('div', { class: 'stat' }, h('b', null, rk(sira.okul)), h('span', null, 'Okul Sırası')),
          h('div', { class: 'stat' }, h('b', null, rk(sira.genel)), h('span', null, 'Genel Sıra'))
        ),
        h('div', { class: 'small muted', style: { marginTop: '.5rem' } },
          [
            ort.sinifNet != null ? `Sınıf ort. net: ${nf(ort.sinifNet, 2)}` : null,
            ort.okulNet != null ? `Okul ort. net: ${nf(ort.okulNet, 2)}` : null,
            ort.genelNet != null ? `Genel ort. net: ${nf(ort.genelNet, 2)}` : null
          ].filter(Boolean).join(' · ')
        )
      );

      if (secs.length) {
        card.append(
          h('h4', { style: { margin: '.9rem 0 .4rem' } }, 'Ders Bazlı Sonuçlar'),
          h('div', { class: 'tablewrap' },
            h('table', { class: 'zebra-tbl' },
              h('thead', null, h('tr', null, ['Ders', 'Soru', 'D', 'Y', 'B', 'Net', 'Okul Ort.', 'Genel Ort.'].map((t, i) => h('th', { class: i > 0 ? 'num' : '' }, t)))),
              h('tbody', null, secs.map(s => h('tr', null,
                h('td', null, h('b', null, s.name)),
                h('td', { class: 'num' }, s.count ?? ''),
                h('td', { class: 'num' }, s.D ?? 0),
                h('td', { class: 'num' }, s.Y ?? 0),
                h('td', { class: 'num' }, s.B ?? 0),
                h('td', { class: 'num' }, h('b', null, nf(s.net, 2))),
                h('td', { class: 'num' }, s.okulOrt != null ? nf(s.okulOrt, 2) : '–'),
                h('td', { class: 'num' }, s.genelOrt != null ? nf(s.genelOrt, 2) : '–')
              )))
            )
          )
        );
      }

      if (plan.length) {
        card.append(
          h('h4', { style: { margin: '.9rem 0 .4rem' } }, 'Kişiye Özel Konu / Kazanım Eylem Planı'),
          h('p', { class: 'small muted', style: { margin: '0 0 .4rem' } }, 'Yanlış ve boş bırakılan sorulara göre önceliklendirilmiş çalışma önerileridir:'),
          h('div', { class: 'tablewrap' },
            h('table', { class: 'zebra-tbl' },
              h('thead', null, h('tr', null, ['Öncelik', 'Ders', 'Konu / Kazanım', 'Çalışma Önerisi'].map(t => h('th', null, t)))),
              h('tbody', null, plan.map(st => h('tr', null,
                h('td', { class: 'num' }, h('b', null, '#' + st.oncelik)),
                h('td', null, h('b', null, st.ders)),
                h('td', null, st.kod ? `[${st.kod}] ${st.konu}` : st.konu),
                h('td', { class: 'small' }, st.detay)
              )))
            )
          )
        );
      }

      if (ex.answers) {
        const ans = String(ex.answers || ''), key = ex.key ? String(ex.key) : '';
        const chips = [];
        for (let i = 0; i < ans.length; i++) {
          const a = ans.charAt(i) || '-', k = key ? (key.charAt(i) || '.') : '';
          let cls = 'b';
          if (k === '*') cls = 'd';
          else if (k && k !== '.') cls = a === '-' ? 'b' : (a === k ? 'd' : 'y');
          chips.push(h('span', { class: 'qc ' + cls, title: `${i + 1}. soru: işaret ${a}${k ? ' · doğru ' + k : ''}` },
            h('small', null, i + 1), h('b', null, a === '-' ? '·' : a), k && k !== '.' && k !== '*' && a !== k ? h('small', { style: { color: '#2563eb' } }, k) : null));
        }
        card.append(
          h('details', { style: { marginTop: '.7rem' } },
            h('summary', { class: 'small' }, key ? 'Cevaplarınız ve Doğru Cevaplar' : 'İşaretlediğiniz Cevaplar'),
            h('div', { class: 'cam-strip', style: { marginTop: '.4rem' } }, chips)
          )
        );
      }

      root.append(card);
    });
  }

  function renderPublic() {
    clearIdle();
    const app = clear($('#app'));
    const q = parseQuery();
    const wrap = h('div', { class: 'page', style: { maxWidth: '860px', margin: '0 auto', padding: '1rem' } });
    app.append(wrap);

    let mode = 'sorgu'; // 'sorgu' | 'giris' | 'uye'
    let places = [];
    let schoolList = [];
    const st = {
      il: '', ilce: '', duzey: '', ara: '',
      okulKodu: q.okul || q.okulKodu || q.k || '',
      okulAdi: '',
      sinif: q.sinif || q.s || '',
      ogrNo: q.no || q.ogrNo || q.n || '',
      veliKodu: q.kod || q.vk || q.veliKodu || ''
    };

    const tabBar = h('div', { class: 'tabs no-print', style: { marginBottom: '.8rem' } });
    const content = h('div');

    wrap.append(
      h('div', { class: 'row between no-print', style: { marginBottom: '.6rem' } },
        h('a', { href: '#', onclick: e => { e.preventDefault(); safeBack(); } }, '← Giriş sayfasına dön'),
        h('a', { href: '#/kilavuz/veli-sorgu', onclick: e => { e.preventDefault(); location.hash = '#/kilavuz/veli-sorgu'; } }, '? Yardım')
      ),
      h('h1', { style: { margin: '0 0 .3rem' } }, 'Sıraç Aksan Optik Okuma · Veli & Öğrenci Portalı'),
      h('p', { class: 'small muted no-print', style: { marginTop: 0 } }, 'Okul numaranızla hızlıca sonuç ve eylem planı sorgulayabilir ya da Gmail/e-posta hesabınızla üye olarak tek tıkla giriş yapabilirsiniz.'),
      tabBar,
      content,
      typeof saCopyrightFooter === 'function' ? saCopyrightFooter() : null
    );

    function drawTabs() {
      clear(tabBar).append(
        [['sorgu', 'Hızlı Sonuç Sorgula'], ['giris', 'Veli Girişi (Gmail / E-posta)'], ['uye', 'Veli Üyeliği Oluştur']].map(([id, lbl]) =>
          h('button', { type: 'button', class: mode === id ? 'active' : '', onclick: () => { mode = id; drawTabs(); drawPane(); } }, lbl)
        )
      );
    }

    async function loadPlaces() {
      if (places.length) return;
      try { const d = await api('publicSchools', {}, { open: true, noAuthRedirect: true }); places = d.iller || []; } catch (e) { places = []; }
    }

    function buildSchoolSelector(onClassReady) {
      const preBanner = h('div', { class: 'hidden', style: { gridColumn: '1/-1' } });
      const ilSel = h('select', { onchange: () => { st.il = ilSel.value; st.ilce = ''; fillIlce(); } }, h('option', { value: '' }, 'İl seçin…'));
      const ilceSel = h('select', { onchange: async () => { st.ilce = ilceSel.value; await loadSchools(); } }, h('option', { value: '' }, 'İlçe seçin…'));
      const duzeySel = h('select', { onchange: () => { st.duzey = duzeySel.value; fillSchools(); } }, h('option', { value: '' }, 'Tüm düzeyler'), DUZEYLER.map(d => h('option', { value: d }, d)));
      const araIn = h('input', { type: 'search', placeholder: 'Okul ara…', oninput: () => { st.ara = araIn.value.trim().toLocaleLowerCase('tr'); fillSchools(); } });
      const schSel = h('select', { onchange: async () => { st.okulKodu = schSel.value; st.okulAdi = ''; await loadClasses(); } }, h('option', { value: '' }, 'Okul seçin…'));
      const sinifSel = h('select', { onchange: () => { st.sinif = sinifSel.value; } }, h('option', { value: '' }, 'Sınıfı seçin…'));

      function fillIl() {
        clear(ilSel).append(h('option', { value: '' }, 'İl seçin…'), places.map(p => h('option', { value: p.il }, p.il)));
        if (st.il) ilSel.value = st.il;
      }
      function fillIlce() {
        const hit = places.find(p => p.il === st.il);
        const list = hit ? (hit.ilceler || []) : [];
        clear(ilceSel).append(h('option', { value: '' }, 'İlçe seçin…'), list.map(x => h('option', { value: x }, x)));
        if (st.ilce && list.includes(st.ilce)) ilceSel.value = st.ilce;
      }
      async function loadSchools() {
        schoolList = [];
        if (!st.il || !st.ilce) { fillSchools(); return; }
        try { const d = await api('publicSchools', { il: st.il, ilce: st.ilce }, { open: true, noAuthRedirect: true }); schoolList = d.schools || []; } catch (e) { schoolList = []; }
        fillSchools();
      }
      function fillSchools() {
        const filtered = schoolList.filter(s => (!st.duzey || s.tur === st.duzey) && (!st.ara || String(s.okulAdi || '').toLocaleLowerCase('tr').includes(st.ara)));
        clear(schSel).append(h('option', { value: '' }, filtered.length ? `Okul seçin (${filtered.length})…` : 'Okul bulunamadı'), filtered.map(s => h('option', { value: s.okulKodu }, s.okulAdi)));
        if (st.okulKodu && filtered.some(s => String(s.okulKodu) === String(st.okulKodu))) schSel.value = String(st.okulKodu);
      }
      async function loadClasses() {
        clear(sinifSel).append(h('option', { value: '' }, 'Sınıfı seçin…'));
        if (!st.okulKodu) return;
        try {
          const d = await api('portalClasses', { okulKodu: st.okulKodu }, { open: true, noAuthRedirect: true });
          const cls = d.siniflar || [];
          st.okulAdi = d.okulAdi || st.okulAdi;
          if (st.okulAdi) {
            clear(preBanner).append(h('div', { class: 'alert ok', style: { marginBottom: '.2rem' } }, `Seçili okul: `, h('b', null, st.okulAdi), ` (Kod: ${st.okulKodu})`));
            preBanner.classList.remove('hidden');
            if (!Array.from(schSel.options).some(o => o.value === String(st.okulKodu))) {
              schSel.append(h('option', { value: String(st.okulKodu) }, st.okulAdi));
              schSel.value = String(st.okulKodu);
            }
          }
          clear(sinifSel).append(h('option', { value: '' }, cls.length ? 'Sınıfı seçin…' : 'Sınıf kaydı yok'), cls.map(c => h('option', { value: c }, c)));
          if (st.sinif) {
            const match = cls.find(c => String(c).toLocaleLowerCase('tr') === String(st.sinif).toLocaleLowerCase('tr'));
            if (match) { st.sinif = match; sinifSel.value = match; }
          }
          onClassReady && onClassReady(d);
        } catch (e) { toast(e.message, 'bad'); }
      }

      loadPlaces().then(() => { fillIl(); fillIlce(); if (st.okulKodu) loadClasses(); });

      return {
        el: h('div', { class: 'grid' },
          preBanner,
          h('div', { class: 'field' }, h('label', null, 'İl'), ilSel),
          h('div', { class: 'field' }, h('label', null, 'İlçe'), ilceSel),
          h('div', { class: 'field' }, h('label', null, 'Okul düzeyi'), duzeySel),
          h('div', { class: 'field' }, h('label', null, 'Okul ara'), araIn),
          h('div', { class: 'field', style: { gridColumn: '1/-1' } }, h('label', null, 'Okul'), schSel),
          h('div', { class: 'field' }, h('label', null, 'Sınıf'), sinifSel)
        ),
        sinifSel
      };
    }

    function drawPane() {
      clear(content);
      const errBox = h('div');

      if (mode === 'giris') {
        const emIn = h('input', { type: 'email', placeholder: 'ornek@gmail.com', autocomplete: 'email' });
        const pwIn = h('input', { type: 'password', placeholder: 'Parolanız', autocomplete: 'current-password' });
        const btn = h('button', {
          class: 'btn primary',
          onclick: async () => {
            clear(errBox);
            if (!emIn.value.trim() || !pwIn.value) { errBox.append(h('div', { class: 'alert bad' }, 'E-posta ve parola gerekli.')); return; }
            btn.disabled = true;
            try {
              const d = await api('veliLogin', { email: emIn.value.trim(), password: pwIn.value }, { open: true, noAuthRedirect: true });
              renderResult(content, d, () => { drawTabs(); drawPane(); });
            } catch (e) {
              errBox.append(h('div', { class: 'alert bad' }, e.message));
              btn.disabled = false;
            }
          }
        }, 'Giriş Yap ve Sonuçları Gör');

        content.append(
          h('div', { class: 'card' },
            h('h2', { style: { marginTop: 0 } }, 'Veli Girişi (Gmail / E-posta)'),
            h('p', { class: 'small muted' }, 'Daha önce oluşturduğunuz veli hesabınızla giriş yaparak öğrencinizin tüm sınav sonuçlarına ve kişisel eylem planına ulaşabilirsiniz.'),
            h('div', { class: 'grid' },
              h('div', { class: 'field' }, h('label', null, 'Gmail / E-posta'), emIn),
              h('div', { class: 'field' }, h('label', null, 'Parola'), pwIn)
            ),
            h('div', { class: 'row', style: { marginTop: '.7rem' } }, btn),
            errBox
          )
        );
        return;
      }

      if (mode === 'uye') {
        const schUI = buildSchoolSelector();
        const noIn = h('input', { type: 'text', inputmode: 'numeric', placeholder: 'Okul numarası', value: st.ogrNo });
        const vkIn = h('input', { type: 'text', placeholder: 'Okulun verdiği veli kodu (varsa)', value: st.veliKodu });
        const adIn = h('input', { type: 'text', placeholder: 'Veli Ad Soyad (isteğe bağlı)' });
        const emIn = h('input', { type: 'email', placeholder: 'ornek@gmail.com' });
        const telIn = h('input', { type: 'tel', placeholder: '05xx xxx xx xx' });
        const pwIn = h('input', { type: 'password', placeholder: 'En az 6 karakter parola' });
        const btn = h('button', {
          class: 'btn primary',
          onclick: async () => {
            clear(errBox);
            if (!st.okulKodu || !st.sinif || !noIn.value.trim()) { errBox.append(h('div', { class: 'alert bad' }, 'Okul, sınıf ve öğrenci numarasını doldurun.')); return; }
            if (!emIn.value.trim() || !telIn.value.trim() || pwIn.value.length < 6) { errBox.append(h('div', { class: 'alert bad' }, 'Gmail/e-posta, cep telefonu ve en az 6 karakterli parola gerekli.')); return; }
            btn.disabled = true;
            try {
              await api('veliRegister', {
                okulKodu: st.okulKodu, sinif: st.sinif, ogrNo: noIn.value.trim(), veliKodu: vkIn.value.trim(),
                ad: adIn.value.trim(), email: emIn.value.trim(), telefon: telIn.value.trim(), password: pwIn.value
              }, { open: true, noAuthRedirect: true });
              toast('Veli üyeliğiniz oluşturuldu! Şimdi giriş yapabilirsiniz.', 'ok');
              mode = 'giris';
              drawTabs();
              drawPane();
            } catch (e) {
              errBox.append(h('div', { class: 'alert bad' }, e.message));
              btn.disabled = false;
            }
          }
        }, 'Veli Üyeliğini Tamamla');

        content.append(
          h('div', { class: 'card' },
            h('h2', { style: { marginTop: 0 } }, 'Veli Üyeliği Oluştur (Gmail + Telefon)'),
            h('p', { class: 'small muted' }, 'Çocuğunuzun okulunu, sınıfını ve okul numarasını doğrulayarak kendi Gmail hesabınızla kalıcı veli üyeliği oluşturun.'),
            schUI.el,
            h('div', { class: 'grid', style: { marginTop: '.6rem' } },
              h('div', { class: 'field' }, h('label', null, 'Öğrenci Okul No'), noIn),
              h('div', { class: 'field' }, h('label', null, 'Veli Kodu (okul verdiyse)'), vkIn),
              h('div', { class: 'field' }, h('label', null, 'Veli Ad Soyad'), adIn),
              h('div', { class: 'field' }, h('label', null, 'Cep Telefonu (WhatsApp)'), telIn),
              h('div', { class: 'field' }, h('label', null, 'Gmail / E-posta'), emIn),
              h('div', { class: 'field' }, h('label', null, 'Parola (en az 6 karakter)'), pwIn)
            ),
            h('div', { class: 'row', style: { marginTop: '.7rem' } }, btn),
            errBox
          )
        );
        return;
      }

      // Hızlı Sorgu (girişsiz)
      const schUI = buildSchoolSelector();
      const noIn = h('input', { type: 'text', inputmode: 'numeric', placeholder: 'Örn: 125', value: st.ogrNo, oninput: e => { st.ogrNo = e.target.value; } });
      const vkWrap = h('div', { class: 'field' });
      const vkIn = h('input', { type: 'text', placeholder: 'Okulun verdiği veli kodu (varsa)', value: st.veliKodu, oninput: e => { st.veliKodu = e.target.value; } });
      vkWrap.append(h('label', null, 'Veli Kodu (varsa)'), vkIn);

      const btn = h('button', {
        class: 'btn primary',
        onclick: async () => {
          clear(errBox);
          if (!st.okulKodu || !st.sinif || !noIn.value.trim()) { errBox.append(h('div', { class: 'alert bad' }, 'Lütfen okul, sınıf ve okul numarasını seçin/yazın.')); return; }
          btn.disabled = true;
          try {
            const d = await api('portalLookup', { okulKodu: st.okulKodu, sinif: st.sinif, ogrNo: noIn.value.trim(), veliKodu: vkIn.value.trim() }, { open: true, noAuthRedirect: true });
            renderResult(content, d, () => { drawTabs(); drawPane(); });
          } catch (e) {
            errBox.append(h('div', { class: 'alert bad' }, e.message));
            btn.disabled = false;
          }
        }
      }, 'Sonuçlarımı Göster');

      content.append(
        h('div', { class: 'card' },
          h('h2', { style: { marginTop: 0 } }, 'Hızlı Sonuç Sorgulama'),
          schUI.el,
          h('div', { class: 'grid', style: { marginTop: '.6rem' } },
            h('div', { class: 'field' }, h('label', null, 'Öğrenci Okul Numarası'), noIn),
            vkWrap
          ),
          h('div', { class: 'row', style: { marginTop: '.7rem' } }, btn),
          errBox
        )
      );
    }

    drawTabs();
    drawPane();
  }

  return { renderPublic };
})();

// Tüm olası yönlendirme adlarıyla uyumlu dışa aktarım
App.renderPortal = () => Veli.renderPublic();
App.renderVeli = () => Veli.renderPublic();
window.Portal = { render: () => Veli.renderPublic(), open: () => Veli.renderPublic() };

// WhatsApp bağlantıları (#/ogrenci?okul=...&sinif=...&no=...) ve ana sayfa tıklamaları için doğrudan yönlendirici
(function () {
  const checkVeliHash = () => {
    if (String(location.hash || '').startsWith('#/ogrenci')) {
      Veli.renderPublic();
    }
  };
  window.addEventListener('hashchange', checkVeliHash);
  window.addEventListener('DOMContentLoaded', () => { setTimeout(checkVeliHash, 30); });
  if (document.readyState !== 'loading') setTimeout(checkVeliHash, 30);
})();
