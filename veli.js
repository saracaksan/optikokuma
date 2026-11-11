/* veli.js — öğrenci / veli sorgulama sayfası (#/ogrenci ya da okula özel #/ogrenci/<okulKodu>). Giriş gerekmez.
 * Akış: okul (il → ilçe → okul) → sınıf → okul numarası (+ okul veli kodu verdiyse) → "sorgulamaya açık" denemelerin sonucu.
 * Gizlilik: okul numarası ve veli kodu cihazda saklanmaz; yalnızca il/ilçe/okul seçimi hatırlanır. Sonuç 10 dakika sonra kendiliğinden kapanır. */
'use strict';

App.renderPortal = function () {
  const app = clear($('#app'));
  let hashCode = ''; try { hashCode = decodeURIComponent((location.hash.match(/^#\/ogrenci\/([^/?#]+)/) || [])[1] || ''); } catch (e) { }
  const S = { places: null, schools: [], school: null, classes: [], needCode: false, data: null, sel: 0, timer: null, gen: 0 };
  const root = h('div', { class: 'pt' });
  app.append(root);

  const f = (v, d) => (v == null || v === '' || isNaN(v)) ? '—' : nf(v, d == null ? 2 : d);
  const fd = (d) => /^\d{4}-\d{2}-\d{2}/.test(String(d || '')) ? String(d).slice(8, 10) + '.' + String(d).slice(5, 7) + '.' + String(d).slice(0, 4) : String(d || '');
  const rk = (a) => a && a[0] ? a[0] + ' / ' + a[1] : '—';
  const field = (label, input, hint) => h('div', { class: 'field' }, h('label', null, label), input, hint ? h('span', { class: 'small muted' }, hint) : null);
  const back = () => h('a', { href: '#', id: 'pt-back', class: 'noprint', onclick: e => { e.preventDefault(); stopTimer(); App.backToApp(); } }, App.state.user ? '← Uygulamaya dön' : '← Giriş sayfası');
  const stopTimer = () => { if (S.timer) { clearTimeout(S.timer); S.timer = null; } };
  const errText = (e) => isNetErr(e) ? 'Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edip tekrar deneyin.' : e.message;

  /* ============================== SORGULAMA FORMU ============================== */
  function drawForm(notice) {
    stopTimer(); S.data = null; S.school = null; S.classes = []; S.gen++; const gen = S.gen;
    clear(root);
    const err = h('div', { id: 'pt-err' });
    const il = h('select', { id: 'pt-il' }), ilce = h('select', { id: 'pt-ilce' }), okul = h('select', { id: 'pt-okul' }), sinif = h('select', { id: 'pt-sinif' });
    const duzey = h('select', { id: 'pt-duzey' }, h('option', { value: '' }, 'Tüm düzeyler'), DUZEYLER.map(d => h('option', { value: d }, d)));
    const ara = h('input', { type: 'search', id: 'pt-ara', placeholder: 'Okul adının bir bölümünü yazın', autocomplete: 'off' });
    const no = h('input', { type: 'text', id: 'pt-no', inputmode: 'numeric', autocomplete: 'off', maxlength: 20, placeholder: 'Örn: 125' });
    const kod = h('input', { type: 'text', id: 'pt-kod', inputmode: 'numeric', autocomplete: 'off', maxlength: 12, placeholder: 'Okulun verdiği veli kodu' });
    const kodField = field('Veli kodu', kod, 'Bu kod okulunuz tarafından verilir.'); kodField.hidden = !S.needCode;
    const hp = h('div', { class: 'hp', 'aria-hidden': 'true' }, h('label', null, 'Bu alanı boş bırakın'), h('input', { type: 'text', name: 'website', id: 'pt-website', tabindex: '-1', autocomplete: 'off' }));
    const btn = h('button', { class: 'btn primary', id: 'pt-send', style: { width: '100%', marginTop: '.8rem' } }, 'Sonuçlarımı göster');
    const info = h('div', { class: 'small muted', id: 'pt-info' });
    const schoolBox = h('div'), classBox = h('div');

    const showErr = (msg, kind) => clear(err).append(msg ? h('div', { class: 'alert ' + (kind || 'bad'), role: 'alert' }, msg) : '');

    /* ---- okul seçimi ---- */
    const fillOkul = () => {
      const d = duzey.value, q = trKeyLite(ara.value), list = S.schools.filter(s => (!d || s.tur === d) && (!q || trKeyLite(s.okulAdi).includes(q)));
      clear(okul).append(h('option', { value: '' }, S.schools.length ? (list.length ? 'Okulu seçin…' : '(eşleşen okul yok)') : '(önce il ve ilçe seçin)'), list.map(s => h('option', { value: s.okulKodu }, s.okulAdi + (s.tur ? ' · ' + s.tur : ''))));
      if (S.school && list.some(s => s.okulKodu === S.school.okulKodu)) okul.value = S.school.okulKodu;
    };
    const fillIlce = () => { const p = (S.places || []).find(x => x.il === il.value); clear(ilce).append(h('option', { value: '' }, 'İlçe seçin…'), (p ? p.ilceler : []).map(x => h('option', { value: x }, x))); S.schools = []; fillOkul(); };
    async function loadSchools() {
      S.schools = []; fillOkul(); info.textContent = '';
      if (!il.value || !ilce.value) return;
      try { S.schools = (await api('publicSchools', { il: il.value, ilce: ilce.value }, { noAuthRedirect: true })).schools || []; } catch (e) { showErr(errText(e)); }
      if (gen !== S.gen) return; fillOkul(); info.textContent = S.schools.length ? S.schools.length + ' okul listelendi' : 'Bu ilçede kayıtlı okul yok.';
    }
    async function loadClasses(code) {
      S.classes = []; S.school = null; clear(classBox); showErr('');
      if (!code) return;
      try {
        const d = await api('portalClasses', { okulKodu: code }, { noAuthRedirect: true }); if (gen !== S.gen) return;
        S.school = { okulKodu: code, okulAdi: d.okulAdi }; S.classes = d.siniflar || [];
        Settings.set('portalOkul', code);
      } catch (e) { if (gen !== S.gen) return; showErr(errText(e)); return; }
      drawClassBox();
    }
    function drawClassBox() {
      clear(classBox);
      if (!S.classes.length) { classBox.append(h('div', { class: 'alert info' }, 'Bu okulda henüz öğrenci listesi yüklenmemiş. Okulunuzla iletişime geçin.')); return; }
      clear(sinif).append(h('option', { value: '' }, 'Sınıfı seçin…'), S.classes.map(c => h('option', { value: c }, c)));
      classBox.append(h('div', { class: 'grid' }, field('Sınıf', sinif), field('Okul numarası', no)), kodField);
    }

    il.addEventListener('change', () => { Settings.set('portalIl', il.value); Settings.set('portalIlce', ''); Settings.set('portalOkul', ''); S.school = null; clear(classBox); fillIlce(); });
    ilce.addEventListener('change', () => { Settings.set('portalIlce', ilce.value); S.school = null; clear(classBox); loadSchools(); });
    duzey.addEventListener('change', fillOkul); ara.addEventListener('input', fillOkul);
    okul.addEventListener('change', () => loadClasses(okul.value));
    [no, kod].forEach(x => x.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); btn.click(); } }));

    /* ---- gönder ---- */
    btn.addEventListener('click', async () => {
      showErr('');
      if (!S.school) return showErr('Önce okulunuzu seçin.');
      if (!sinif.value) return showErr('Sınıfınızı seçin.');
      if (!no.value.trim()) return showErr('Okul numarasını yazın.');
      btn.disabled = true; const t = btn.textContent; btn.textContent = 'Sorgulanıyor…';
      try {
        const d = await api('portalLookup', { okulKodu: S.school.okulKodu, sinif: sinif.value, ogrNo: no.value.trim(), veliKodu: kod.value.trim(), website: $('#pt-website').value }, { noAuthRedirect: true });
        if (gen !== S.gen) return;
        S.data = d; S.sel = 0; drawResult(); return;
      } catch (e) {
        if (gen !== S.gen) return;
        if (e.code === 'VELIKODU') { S.needCode = true; kodField.hidden = false; showErr(e.message); kod.focus(); }
        else showErr(errText(e), e.code === 'THROTTLE' ? 'warn' : 'bad');
      }
      btn.disabled = false; btn.textContent = t;
    });

    /* ---- sayfa ---- */
    const head = [h('p', { style: { margin: 0 } }, back()), h('h1', null, 'Öğrenci / Veli Sorgulama'),
      h('p', { class: 'muted small center', style: { marginTop: 0 } }, 'Okulunuzu, sınıfınızı ve okul numaranızı seçerek deneme sınavı sonuçlarınıza ulaşabilirsiniz. Giriş gerekmez.')];
    if (notice) head.push(h('div', { class: 'alert info', id: 'pt-notice' }, notice));
    const form = h('div', { class: 'card' }, h('h2', null, '1. Okulunuzu seçin'), schoolBox, h('h2', { style: { marginTop: '1rem' } }, '2. Sınıf ve okul numarası'), classBox, hp, err, btn,
      h('p', { class: 'small muted', style: { marginBottom: 0 } }, 'Yalnızca öğretmeniniz sonuçları "öğrenci/veli sorgulamasına açık" yaptığı denemeler görünür. Başkasının bilgilerine ulaşılamaz; adınız kısmen gizlenerek gösterilir. Okul numarası ve veli kodu bu cihazda saklanmaz.'));
    root.append(...head, form);
    window.scrollTo(0, 0);

    const schoolPicker = () => {
      clear(schoolBox).append(h('div', { class: 'grid' }, field('İl', il), field('İlçe', ilce), field('Okul düzeyi', duzey), field('Okul ara', ara)), field('Okul', okul), info);
      clear(il).append(h('option', { value: '' }, 'İl seçin…'), (S.places || []).map(p => h('option', { value: p.il }, p.il))); fillIlce();
    };

    /** Okula özel bağlantı (#/ogrenci/<okulKodu>): okul sabit, yalnızca sınıf ve numara istenir. */
    async function fixedSchool(code) {
      clear(schoolBox).append(h('div', { class: 'muted small' }, 'Okul yükleniyor…'));
      try {
        const d = await api('portalClasses', { okulKodu: code }, { noAuthRedirect: true }); if (gen !== S.gen) return;
        S.school = { okulKodu: code, okulAdi: d.okulAdi }; S.classes = d.siniflar || [];
        clear(schoolBox).append(h('div', { class: 'pt-school' }, h('strong', { id: 'pt-okuladi' }, d.okulAdi), ' ', h('a', { href: '#/ogrenci', id: 'pt-change' }, 'Okulu değiştir')));
        drawClassBox();
      } catch (e) {
        if (gen !== S.gen) return;
        if (e.code === 'NOURL') return needUrl();
        hashCode = ''; history.replaceState(null, '', '#/ogrenci'); showErr(isNetErr(e) ? errText(e) : 'Bu bağlantıdaki okul bulunamadı. Okulunuzu listeden seçin.', 'warn'); start();
      }
    }
    function needUrl() { clear(schoolBox); App.urlPrompt(schoolBox, () => { S.places = null; start(); }); clear(classBox); btn.hidden = true; }

    async function start() {
      btn.hidden = false;
      if (!getApiUrl()) return needUrl();
      if (hashCode) return fixedSchool(hashCode);
      clear(schoolBox).append(h('div', { class: 'muted small' }, 'Okullar yükleniyor…'));
      try { if (!S.places) S.places = (await api('publicSchools', {}, { noAuthRedirect: true })).iller || []; } catch (e) { if (gen !== S.gen) return; clear(schoolBox); if (e.code === 'NOURL') return needUrl(); showErr(errText(e)); return; }
      if (gen !== S.gen) return;
      if (!S.places.length) { clear(schoolBox).append(h('div', { class: 'alert warn' }, 'Sistemde henüz kayıtlı okul yok.')); btn.hidden = true; return; }
      schoolPicker();
      /* son seçimi geri yükle (yalnızca il / ilçe / okul) */
      const pi = Settings.get('portalIl', ''), pj = Settings.get('portalIlce', ''), po = Settings.get('portalOkul', '');
      if (pi && S.places.some(p => p.il === pi)) {
        il.value = pi; fillIlce();
        if (pj && ilce.querySelector('option[value="' + CSS.escape(pj) + '"]')) { ilce.value = pj; await loadSchools(); if (gen !== S.gen) return; if (po && S.schools.some(s => s.okulKodu === po)) { okul.value = po; await loadClasses(po); } }
      }
    }
    start();
  }
  /** Okul adı aramasında Türkçe harf / büyük-küçük harf farkını yok sayar */
  function trKeyLite(s) { return String(s || '').replace(/İ/g, 'i').replace(/I/g, 'ı').toLowerCase().replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ş/g, 's').replace(/ü/g, 'u').replace(/\s+/g, ' ').trim(); }

  /* ============================== SONUÇ EKRANI ============================== */
  function stat(label, value, kind) { return h('div', { class: 'pt-stat ' + (kind || '') }, h('div', { class: 'v' }, String(value)), h('div', { class: 'l' }, label)); }

  function drawResult() {
    clear(root); window.scrollTo(0, 0);
    stopTimer(); S.timer = setTimeout(() => { if (document.body.contains(root) && S.data) drawForm('Güvenliğiniz için oturum süresi doldu; sonuçlar ekrandan kaldırıldı. Yeniden sorgulayabilirsiniz.'); }, 10 * 60 * 1000);
    const d = S.data, o = d.ogrenci, exams = d.exams || [];
    const top = h('div', { class: 'card pt-who' },
      h('div', null, h('h2', { id: 'pt-name', style: { margin: 0 } }, o.ad || 'Öğrenci'), h('div', { class: 'muted small', id: 'pt-meta' }, `${o.okulAdi} · ${o.sinif} · No: ${o.ogrNo}`)),
      h('div', { class: 'noprint pt-actions' }, h('button', { class: 'btn sm', id: 'pt-print', onclick: doPrint }, '🖨 Yazdır'), h('button', { class: 'btn sm', id: 'pt-newq', onclick: () => { S.needCode = false; drawForm(); } }, 'Başka sorgu')));
    root.append(h('p', { style: { margin: 0 } }, back()), top);

    if (!exams.length) {
      root.append(h('div', { class: 'alert info', id: 'pt-empty' }, 'Bu öğrenci için sorgulamaya açılmış bir deneme sonucu bulunamadı. Öğretmeniniz sonuçları yayımladığında burada görünecek.'));
      return;
    }
    const detail = h('div', { id: 'pt-detail' });
    if (exams.length > 1) {
      const rows = h('tbody');
      const paint = () => { clear(rows).append(...exams.map((ex, i) => h('tr', { class: 'pt-row' + (i === S.sel ? ' sel' : ''), 'data-i': i, tabindex: 0, role: 'button', onclick: () => pick(i), onkeydown: e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(i); } } },
        h('td', null, ex.name), h('td', { class: 'nowrap' }, fd(ex.date)), h('td', { class: 'right' }, f(ex.net)), h('td', { class: 'right' }, f(ex.puan)), h('td', { class: 'right nowrap' }, rk(ex.sira.sinif))))); };
      const pick = (i) => { S.sel = i; paint(); drawDetail(); };
      paint();
      root.append(h('div', { class: 'card noprint' }, h('h3', { style: { marginTop: 0 } }, 'Denemelerim'), h('div', { class: 'tablewrap' }, h('table', { class: 'tbl pt-trend', id: 'pt-trend' }, h('thead', null, h('tr', null, h('th', null, 'Deneme'), h('th', null, 'Tarih'), h('th', { class: 'right' }, 'Net'), h('th', { class: 'right' }, 'Puan'), h('th', { class: 'right' }, 'Sıra'))), rows)), h('p', { class: 'small muted', style: { marginBottom: 0 } }, 'Sıra = sınıfınızdaki sıranız. Ayrıntıyı görmek için bir denemeye dokunun.')));
    }
    root.append(detail);
    function drawDetail() { clear(detail).append(examView(exams[S.sel])); }
    drawDetail();
  }

  function examView(ex) {
    const total = ex.sections.reduce((a, s) => a + s.count, 0) || 1, hasPuan = ex.puan != null && !isNaN(ex.puan);
    const wrap = h('div', { class: 'pt-exam', id: 'pt-exam' });
    wrap.append(h('div', { class: 'card' }, h('h2', { style: { margin: 0 }, id: 'pt-exname' }, ex.name), h('div', { class: 'muted small' }, fd(ex.date) + (ex.booklet ? ' · Kitapçık ' + ex.booklet : '')),
      h('div', { class: 'pt-stats' }, stat('Doğru', ex.D, 'ok'), stat('Yanlış', ex.Y, 'bad'), stat('Boş', ex.B), stat('Net', f(ex.net), 'brand'), hasPuan ? stat('Puan', f(ex.puan), 'brand') : null)));

    /* sıralama */
    const S5 = [['Sınıf', ex.sira.sinif], ['Okul', ex.sira.okul], ['İlçe', ex.sira.ilce], ['İl', ex.sira.il], ['Sınav geneli', ex.sira.genel]];
    wrap.append(h('div', { class: 'card' }, h('h3', { style: { marginTop: 0 } }, 'Sıralamanız'), h('div', { class: 'pt-ranks' }, S5.map(([l, a]) => h('div', { class: 'pt-rank' }, h('div', { class: 'l' }, l), h('div', { class: 'v' }, a && a[0] ? h('span', null, h('b', null, a[0]), ' / ' + a[1]) : '—')))),
      h('p', { class: 'small muted', style: { marginBottom: 0 } }, 'Sıra, sınava katılan öğrenciler arasındaki yerinizi gösterir (örn. 3 / 28 = 28 öğrenci içinde 3.).')));

    /* karşılaştırma */
    const o = ex.ort, bar = (v, kind) => h('div', { class: 'pt-bar' }, h('i', { class: kind || '', style: { width: Math.max(0, Math.min(100, (v || 0) / total * 100)) + '%' } }));
    const cmp = [['Siz', ex.net, hasPuan ? ex.puan : null, 'me'], ['Sınıf ortalaması' + (o.sinifN ? ' (' + o.sinifN + ' öğrenci)' : ''), o.sinifNet, o.sinifPuan, ''], ['Okul ortalaması', o.okulNet, o.okulPuan, ''], ['Sınav geneli ortalama', o.genelNet, o.genelPuan, '']];
    wrap.append(h('div', { class: 'card' }, h('h3', { style: { marginTop: 0 } }, 'Ortalamalarla karşılaştırma'),
      h('div', { class: 'tablewrap' }, h('table', { class: 'tbl' }, h('thead', null, h('tr', null, h('th', null, ''), h('th', null, ''), h('th', { class: 'right' }, 'Net'), hasPuan ? h('th', { class: 'right' }, 'Puan') : null)),
        h('tbody', null, cmp.map(([l, n, p, k]) => h('tr', { class: k === 'me' ? 'pt-me' : '' }, h('td', null, l), h('td', { class: 'pt-barcell' }, n == null ? '' : bar(n, k)), h('td', { class: 'right' }, f(n)), hasPuan ? h('td', { class: 'right' }, f(p)) : null))))),
      o.sinifNet == null ? h('p', { class: 'small muted', style: { marginBottom: 0 } }, 'Sınıfta sınava giren öğrenci sayısı 3\'ten az olduğu için sınıf ortalaması gösterilmez.') : null));

    /* ders ders */
    wrap.append(h('div', { class: 'card' }, h('h3', { style: { marginTop: 0 } }, 'Ders ders sonuçlar'), h('div', { class: 'tablewrap' }, h('table', { class: 'tbl', id: 'pt-sections' },
      h('thead', null, h('tr', null, h('th', null, 'Ders'), h('th', { class: 'right c-soru' }, 'Soru'), h('th', { class: 'right' }, 'D'), h('th', { class: 'right' }, 'Y'), h('th', { class: 'right' }, 'B'), h('th', { class: 'right' }, 'Net'), h('th', { class: 'right' }, 'Okul ort.'), h('th', { class: 'right' }, 'Genel ort.'))),
      h('tbody', null, ex.sections.map(s => h('tr', null, h('td', null, s.name), h('td', { class: 'right c-soru' }, s.count), h('td', { class: 'right' }, s.D), h('td', { class: 'right' }, s.Y), h('td', { class: 'right' }, s.B), h('td', { class: 'right' }, h('b', null, f(s.net))), h('td', { class: 'right muted' }, f(s.okulOrt)), h('td', { class: 'right muted' }, f(s.genelOrt)))),
        h('tr', { class: 'pt-total' }, h('td', null, 'Toplam'), h('td', { class: 'right c-soru' }, total), h('td', { class: 'right' }, ex.D), h('td', { class: 'right' }, ex.Y), h('td', { class: 'right' }, ex.B), h('td', { class: 'right' }, h('b', null, f(ex.net))), h('td'), h('td')))))));

    /* cevaplar */
    if (ex.answers) wrap.append(answerCard(ex));
    return wrap;
  }

  function answerCard(ex) {
    const a = String(ex.answers || ''), k = ex.key == null ? null : String(ex.key), card = h('div', { class: 'card', id: 'pt-answers' });
    card.append(h('h3', { style: { marginTop: 0 } }, k == null ? 'İşaretledikleriniz' : 'Cevaplarınız ve doğru cevaplar'));
    if (k == null) card.append(h('p', { class: 'small muted' }, 'Bu denemede cevap anahtarı yayımlanmıyor; yalnızca işaretlediğiniz şıklar listelenir.'));
    else card.append(h('div', { class: 'pt-legend small' }, h('span', { class: 'qc ok' }, 'Doğru'), h('span', { class: 'qc bad' }, 'Yanlış'), h('span', { class: 'qc blank' }, 'Boş'), h('span', { class: 'qc skip' }, 'Hesaba katılmadı / iptal')));
    let q = 0;
    ex.sections.forEach(s => {
      const g = h('div', { class: 'qgrid' });
      for (let i = 0; i < s.count; i++, q++) {
        const ans = a.charAt(q) || '-', key = k == null ? null : (k.charAt(q) || '.'), multi = ans === '*', blank = ans === '-' || (multi && !ex.multiIsWrong);
        let cls = 'qc', sub = '';
        if (key == null) { if (blank) cls += ' blank'; }
        else if (key === '.') cls += ' skip';
        else if (key === '*') { cls += ' ok'; sub = 'iptal'; }
        else if (blank) { cls += ' blank'; sub = 'Doğru: ' + key; }
        else if (ans === key) cls += ' ok';
        else { cls += ' bad'; sub = 'Doğru: ' + key; }
        const shown = ans === '-' ? '–' : multi ? '×' : ans;
        g.append(h('div', { class: cls, title: `${q + 1}. soru` + (multi ? ' — birden fazla işaret' : '') }, h('span', { class: 'n' }, q + 1), h('b', null, shown), sub ? h('i', null, sub) : null));
      }
      card.append(h('div', { class: 'pt-sec' }, s.name), g);
    });
    return card;
  }

  function doPrint() {
    document.body.classList.add('pt-printing');
    const done = () => { document.body.classList.remove('pt-printing'); window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done); window.print();
  }

  drawForm();
};
