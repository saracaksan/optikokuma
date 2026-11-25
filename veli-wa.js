/* veli-wa.js — Veli WhatsApp Gönderim Merkezi (Normal + Business, Çoklu Tarayıcı Eklenti Köprüsü & Hata Raporu)
 * Sıraç Aksan Optik Okuma · Telif Hakkı © Sıraç AKSAN (İzinsiz kopyalamak, dağıtmak veya telif atmak ayıptır.)
 *
 * admin.js içindeki `waTab(pane)` sekmesini sağlar.
 * - Tarayıcıyı (Chrome, Edge, Brave, Opera, Firefox) otomatik algılar ve kurulum adımlarını gösterir.
 * - 1 öğrenci, 2 öğrenci, seçili sınıf veya tüm okul (100–500+ öğrenci) seçimi yapılabilir.
 * - WhatsApp Normal ve WhatsApp Business Web ile arka planda eklenti üzerinden otomatik gönderim kuyruğu oluşturur.
 * - Gönderilemeyenler ve eklentiden dönen hata kodları (WA_LOGIN, WA_NOT_ON_WA, WA_TIMEOUT vb.) nedenleriyle raporlanır.
 */
'use strict';

const WA_DEFAULT_TPL = [
  'Sayın Veli, *{adsoyad}* ({sinif} · No: {no}) öğrencimizin *{sinav}* sonucu:',
  '📊 Puan: *{puan}* | Net: *{net}* ({dyb})',
  '🏅 Sınıf Sırası: {siraSinif} | Okul Sırası: {siraOkul}',
  '{dersler}',
  '🔑 Veli Kodu: *{kod}*',
  '📋 Detaylı karne ve Eylem Planı: {link}'
].join('\n');

const WA_ERROR_INFO = {
  WA_LOGIN: 'WhatsApp Web oturumu açık değil. web.whatsapp.com sayfasında QR kodu okutun.',
  WA_NOT_ON_WA: 'Bu telefon numarası WhatsApp’ta kayıtlı değil veya numara hatalı.',
  WA_INVALID_PHONE: 'Telefon numarası biçimi geçersiz (05xx xxx xx xx olmalı).',
  WA_TIMEOUT: 'Sayfa/sohbet zaman aşımına uğradı; internet bağlantısını kontrol edip tekrar deneyin.',
  WA_SEND_BTN: 'Gönder düğmesi bulunamadı (WhatsApp Web arayüzü geç yüklendi).',
  WA_RATE_LIMIT: 'Kısa sürede çok fazla mesaj denendi; gönderim aralığını artırın (örn. 10–15 sn).',
  WA_TAB_CLOSED: 'Arka plandaki WhatsApp Web sekmesi kapatıldı.'
};

function waDetectBrowser() {
  const ua = navigator.userAgent || '';
  if (/Firefox\//i.test(ua)) return { id: 'firefox', name: 'Mozilla Firefox', url: 'about:debugging#/runtime/this-firefox', steps: '1) Adres çubuğuna about:debugging#/runtime/this-firefox yazın. 2) "Geçici Eklenti Yükle" → eklenti klasöründeki manifest.json dosyasını seçin.' };
  if (/Edg\//i.test(ua)) return { id: 'edge', name: 'Microsoft Edge', url: 'edge://extensions', steps: '1) Adres çubuğuna edge://extensions yazın. 2) Sol alttan "Geliştirici modu"nu açın. 3) "Paketlenmemiş yükle" → eklenti klasörünü seçin.' };
  if (/OPR\//i.test(ua)) return { id: 'opera', name: 'Opera', url: 'opera://extensions', steps: '1) opera://extensions açın. 2) Geliştirici modunu açın. 3) "Paketlenmemiş öğe yükle" → eklenti klasörünü seçin.' };
  if (navigator.brave) return { id: 'brave', name: 'Brave', url: 'brave://extensions', steps: '1) brave://extensions açın. 2) Geliştirici modunu açın. 3) "Paketlenmemiş öğe yükle" → eklenti klasörünü seçin.' };
  return { id: 'chrome', name: 'Google Chrome', url: 'chrome://extensions', steps: '1) Adres çubuğuna chrome://extensions yazın. 2) Sağ üstten "Geliştirici modu"nu açın. 3) "Paketlenmemiş öğe yükle" → eklenti klasörünü seçin.' };
}

function waFormatMsg(tpl, row, data) {
  const s = row.sonuc || {}, rk = s.sira || {};
  const rkTxt = a => (Array.isArray(a) && a[0] != null ? `${a[0]}/${a[1] || ''}` : '');
  const dersler = (s.sections || []).map(x => `• ${x.name}: ${x.D}D ${x.Y}Y (${nf(x.net, 2)} net)`).join('\n');
  const base = location.origin + location.pathname.replace(/index\.html$/, '');
  const link = `${base}#/ogrenci?okul=${encodeURIComponent(data.okulKodu)}&sinif=${encodeURIComponent(row.sinif || '')}&no=${encodeURIComponent(row.ogrNo)}`;
  const map = {
    adsoyad: `${row.ad || ''} ${row.soyad || ''}`.trim(),
    ad: row.ad || '',
    soyad: row.soyad || '',
    sinif: row.sinif || '',
    no: row.ogrNo || '',
    okul: data.okulAdi || '',
    sinav: (data.exam && data.exam.name) || '',
    tarih: (data.exam && data.exam.date) || '',
    puan: s.puan != null ? nf(s.puan, 2) : '',
    net: s.net != null ? nf(s.net, 2) : '',
    dyb: `${s.D ?? 0}D ${s.Y ?? 0}Y ${s.B ?? 0}B`,
    siraSinif: rkTxt(rk.sinif),
    siraOkul: rkTxt(rk.okul),
    siraIlce: rkTxt(rk.ilce),
    siraGenel: rkTxt(rk.genel),
    dersler,
    kod: row.veliKodu || '',
    link
  };
  return String(tpl || WA_DEFAULT_TPL).split('\n').map(line => {
    let emptyHit = false;
    const out = line.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, k) => {
      const v = map[k];
      if (v === undefined) return `{${k}}`;
      if (v === '') emptyHit = true;
      return v;
    });
    return emptyHit && /\{/.test(line) && !out.replace(/[^a-zA-Z0-9ğüşıöçĞÜŞİÖÇ]/g, '').length ? null : out;
  }).filter(x => x !== null).join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function waTab(pane) {
  const S = App.state, br = waDetectBrowser();
  const selSch = h('select', null, h('option', { value: '' }, 'Okul seçin…'), S.schools.map(s => h('option', { value: s.okulKodu }, schoolLabel(s))));
  if (S.user.role === 'okul' && S.schools[0]) selSch.value = S.schools[0].okulKodu;
  else {
    const last = Settings.get('admSchool', '');
    if (S.schools.some(s => String(s.okulKodu) === String(last))) selSch.value = last;
  }

  const selExam = h('select');
  const selCls = h('select', null, h('option', { value: '' }, 'Tüm sınıflar'));
  const selTarget = h('select', null,
    h('option', { value: 'hepsi' }, 'Anne ve Baba'),
    h('option', { value: 'anne' }, 'Yalnız Anne'),
    h('option', { value: 'baba' }, 'Yalnız Baba')
  );
  const selWaType = h('select', null,
    h('option', { value: 'web' }, 'WhatsApp Web (Normal & Business)'),
    h('option', { value: 'business' }, 'WhatsApp Business Web')
  );
  const inDelay = h('input', { type: 'number', min: 5, max: 60, value: Settings.get('waDelay', 10), style: { width: '90px' }, onchange: e => Settings.set('waDelay', Math.max(5, parseInt(e.target.value) || 10)) });
  const chkCode = h('input', { type: 'checkbox', checked: true });
  const chkRepeat = h('input', { type: 'checkbox', checked: false });

  const tplTa = h('textarea', {
    rows: 6,
    value: Settings.get('waTpl', WA_DEFAULT_TPL),
    style: { width: '100%', fontFamily: 'inherit' },
    oninput: () => { Settings.set('waTpl', tplTa.value); drawPreview(); }
  });

  const placeholders = ['{adsoyad}', '{sinif}', '{no}', '{sinav}', '{puan}', '{net}', '{dyb}', '{siraSinif}', '{siraOkul}', '{dersler}', '{kod}', '{link}'];
  const phBar = h('div', { class: 'row', style: { gap: '.25rem', flexWrap: 'wrap', marginTop: '.35rem' } },
    h('span', { class: 'small muted' }, 'Yer tutucu ekle: '),
    placeholders.map(ph => h('button', {
      type: 'button',
      class: 'btn sm ghost',
      onclick: () => {
        const p = tplTa.selectionStart || tplTa.value.length;
        tplTa.value = tplTa.value.slice(0, p) + ph + tplTa.value.slice(tplTa.selectionEnd || p);
        Settings.set('waTpl', tplTa.value);
        drawPreview();
        tplTa.focus();
      }
    }, ph))
  );

  const outBox = h('div');
  const prevBox = h('pre', { class: 'cfg', style: { whiteSpace: 'pre-wrap', margin: '.4rem 0 0', fontSize: '.85rem' } });
  const reportBox = h('div');
  let lastData = null;
  const pickedKeys = new Set();
  const extLogs = [];

  function fillExams() {
    const code = selSch.value;
    const sch = schoolByCode(code);
    const list = S.exams.filter(e => e.status !== 'draft' && (!sch || examCovers(e, sch))).sort((a, b) => String(b.date).localeCompare(String(a.date)));
    clear(selExam).append(
      h('option', { value: '' }, list.length ? 'Sınav seçin…' : 'Uygun sınav yok'),
      list.map(e => h('option', { value: e.examId }, `${e.name}${e.date ? ' · ' + e.date : ''}`))
    );
  }
  async function fillClasses() {
    clear(selCls).append(h('option', { value: '' }, 'Tüm sınıflar'));
    if (!selSch.value) return;
    const st = await getStudents(selSch.value);
    const cls = Array.from(new Set(st.map(x => x.sinif).filter(Boolean))).sort((a, b) => String(a).localeCompare(String(b), 'tr', { numeric: true }));
    cls.forEach(c => selCls.append(h('option', { value: c }, c)));
  }

  selSch.addEventListener('change', () => { Settings.set('admSchool', selSch.value); fillExams(); fillClasses(); });
  fillExams(); fillClasses();

  function drawPreview() {
    if (!lastData || !lastData.rows || !lastData.rows.length) {
      prevBox.textContent = 'Önizleme için önce "Mesajları Hazırla" düğmesine basın.';
      return;
    }
    prevBox.textContent = waFormatMsg(tplTa.value, lastData.rows[0], lastData);
  }

  function buildQueuePayload() {
    if (!lastData) return [];
    const items = [];
    lastData.rows.forEach(row => {
      const text = waFormatMsg(tplTa.value, row, lastData);
      (row.targets || []).forEach(t => {
        if (!pickedKeys.has(t.key)) return;
        items.push({
          key: t.key,
          phone: t.n,
          name: `${row.ad} ${row.soyad} (${t.kime})`.trim(),
          sinif: row.sinif || '',
          ogrNo: row.ogrNo,
          text
        });
      });
    });
    return items;
  }

  function renderQueue() {
    clear(outBox);
    if (!lastData) return;
    const d = lastData, c = d.counts || {};
    const allTargets = [];
    d.rows.forEach(r => (r.targets || []).forEach(t => allTargets.push({ r, t })));

    const selCountEl = h('span', { class: 'pill brand' }, `Seçili: ${pickedKeys.size} mesaj`);
    const updateSelCount = () => { selCountEl.textContent = `Seçili: ${pickedKeys.size} mesaj`; };

    const btnCopyExt = h('button', {
      class: 'btn primary',
      onclick: async () => {
        const q = buildQueuePayload();
        if (!q.length) return toast('En az bir alıcı seçin.', 'warn');
        const payload = {
          app: 'sirac-aksan-optik-okuma',
          examId: d.exam.examId,
          okulKodu: d.okulKodu,
          waType: selWaType.value,
          delaySec: Math.max(5, parseInt(inDelay.value) || 10),
          items: q
        };
        const jsonStr = JSON.stringify(payload);
        try { window.postMessage({ type: 'OPTIK_WA_START', payload }, '*'); } catch (e) { }
        try {
          await navigator.clipboard.writeText(jsonStr);
          toast(`${q.length} mesajlık kuyruk panoya kopyalandı ve eklentiye iletildi.`, 'ok', 6000);
        } catch (e) {
          toast('Eklentiye sinyal gönderildi; panoya kopyalamak için tarayıcı izni gerekir.', 'warn');
        }
      }
    }, '🚀 Eklentiyle Arka Planda Gönder / Kuyruğu Kopyala');

    const btnMarkAll = h('button', {
      class: 'btn',
      onclick: async () => {
        const keys = Array.from(pickedKeys);
        if (!keys.length) return toast('İşaretlenecek alıcı yok.', 'warn');
        try {
          const r = await api('waMarkSent', { examId: d.exam.examId, okulKodu: d.okulKodu, keys });
          toast(`${r.marked} alıcı gönderildi olarak işlendi.`, 'ok');
          prepare();
        } catch (e) { toast(e.message, 'bad'); }
      }
    }, '✓ Seçilenleri Gönderildi İşaretle');

    outBox.append(
      !d.exam.veliAcik ? h('div', { class: 'alert warn' }, 'Dikkat: Bu sınav "öğrenci/veli sorgulamasına açık" değil. Velilerin linkten detayları görebilmesi için Sınavlar ekranından bu seçeneği açın.') : null,
      h('div', { class: 'card' },
        h('div', { class: 'stats' },
          h('div', { class: 'stat' }, h('b', null, c.ogrenci || 0), h('span', null, 'öğrenci')),
          h('div', { class: 'stat' }, h('b', { style: { color: 'var(--ok)' } }, allTargets.length), h('span', null, 'gönderime hazır mesaj')),
          h('div', { class: 'stat' }, h('b', null, c.telefonYok || 0), h('span', null, 'telefonu yok')),
          h('div', { class: 'stat' }, h('b', null, c.gonderilmis || 0), h('span', null, 'önceden gönderilmiş'))
        ),
        h('div', { class: 'row', style: { marginTop: '.7rem' } },
          selCountEl,
          h('button', { class: 'btn sm', onclick: () => { allTargets.forEach(x => pickedKeys.add(x.t.key)); renderQueue(); } }, 'Tümünü Seç'),
          h('button', { class: 'btn sm ghost', onclick: () => { pickedKeys.clear(); renderQueue(); } }, 'Seçimi Temizle'),
          btnCopyExt,
          btnMarkAll
        ),
        allTargets.length
          ? h('div', { class: 'tablewrap', style: { marginTop: '.7rem', maxHeight: '380px' } },
              h('table', { class: 'zebra-tbl' },
                h('thead', null, h('tr', null, ['', 'Sınıf', 'No', 'Öğrenci', 'Alıcı', 'Telefon', 'Veli Kodu', 'İşlem'].map(t => h('th', null, t)))),
                h('tbody', null, allTargets.map(({ r, t }) => {
                  const ck = h('input', {
                    type: 'checkbox',
                    checked: pickedKeys.has(t.key),
                    onchange: () => { if (ck.checked) pickedKeys.add(t.key); else pickedKeys.delete(t.key); updateSelCount(); }
                  });
                  return h('tr', null,
                    h('td', null, ck),
                    h('td', null, r.sinif || ''),
                    h('td', { class: 'mono' }, r.ogrNo),
                    h('td', null, h('b', null, `${r.ad} ${r.soyad}`)),
                    h('td', null, t.ikisi ? 'Anne & Baba' : (t.kime === 'anne' ? 'Anne' : 'Baba')),
                    h('td', { class: 'mono' }, telShow(t.n)),
                    h('td', { class: 'mono' }, r.veliKodu || '–'),
                    h('td', { class: 'nowrap' },
                      h('a', {
                        class: 'btn sm',
                        href: `https://wa.me/${t.n}?text=${encodeURIComponent(waFormatMsg(tplTa.value, r, d))}`,
                        target: '_blank',
                        rel: 'noopener'
                      }, 'WhatsApp’ta Aç'),
                      ' ',
                      h('button', {
                        class: 'btn sm ghost',
                        onclick: async () => {
                          try { await api('waMarkSent', { examId: d.exam.examId, okulKodu: d.okulKodu, keys: [t.key] }); toast('Gönderildi işaretlendi', 'ok'); prepare(); }
                          catch (e) { toast(e.message, 'bad'); }
                        }
                      }, '✓')
                    )
                  );
                }))
              )
            )
          : h('div', { class: 'empty', style: { marginTop: '.6rem' } }, 'Seçilen filtrede gönderime hazır yeni mesaj yok.')
      ),
      d.skipped && d.skipped.length
        ? h('div', { class: 'card' },
            h('div', { class: 'row between' },
              h('h3', { style: { margin: 0 } }, `Atlanan / Gönderilemeyen Öğrenciler (${d.skipped.length})`),
              h('button', {
                class: 'btn sm',
                onclick: () => download(`wa-atlananlar-${d.okulKodu}.csv`, toCSV([['Sınıf', 'No', 'Ad', 'Soyad', 'Neden'], ...d.skipped.map(x => [x.sinif, x.ogrNo, x.ad, x.soyad, x.neden])]))
              }, 'CSV İndir')
            ),
            h('div', { class: 'tablewrap', style: { maxHeight: '240px', marginTop: '.5rem' } },
              h('table', { class: 'zebra-tbl' },
                h('thead', null, h('tr', null, ['Sınıf', 'No', 'Ad Soyad', 'Gönderilmeme Nedeni'].map(t => h('th', null, t)))),
                h('tbody', null, d.skipped.map(x => h('tr', null, h('td', null, x.sinif || ''), h('td', { class: 'mono' }, x.ogrNo), h('td', null, `${x.ad || ''} ${x.soyad || ''}`), h('td', null, x.neden))))
              )
            )
          )
        : null
    );
    drawPreview();
  }

  function renderExtReport() {
    clear(reportBox);
    if (!extLogs.length) return;
    const okN = extLogs.filter(x => x.status === 'ok').length;
    const errList = extLogs.filter(x => x.status === 'err');
    reportBox.append(
      h('div', { class: 'card' },
        h('div', { class: 'row between' },
          h('h3', { style: { margin: 0 } }, `Eklenti Gönderim Raporu (${okN} başarılı, ${errList.length} hatalı)`),
          h('button', {
            class: 'btn sm',
            onclick: () => download(`wa-gonderim-raporu.csv`, toCSV([['Öğrenci', 'Telefon', 'Durum', 'Hata Kodu', 'Açıklama'], ...extLogs.map(x => [x.name, x.phone, x.status === 'ok' ? 'Gönderildi' : 'Hata', x.code || '', x.error || WA_ERROR_INFO[x.code] || ''])]))
          }, 'Raporu CSV İndir')
        ),
        h('div', { class: 'tablewrap', style: { maxHeight: '240px', marginTop: '.5rem' } },
          h('table', { class: 'zebra-tbl' },
            h('thead', null, h('tr', null, ['Alıcı', 'Telefon', 'Durum', 'Hata Kodu', 'Hata Nedeni & Çözüm'].map(t => h('th', null, t)))),
            h('tbody', null, extLogs.map(x => h('tr', null,
              h('td', null, x.name || ''),
              h('td', { class: 'mono' }, telShow(x.phone)),
              h('td', null, h('span', { class: 'pill ' + (x.status === 'ok' ? 'ok' : 'bad') }, x.status === 'ok' ? 'Gönderildi' : 'Hata')),
              h('td', { class: 'mono small' }, x.code || '–'),
              h('td', { class: 'small' }, x.status === 'ok' ? 'Başarıyla iletildi' : (x.error || WA_ERROR_INFO[x.code] || 'Bilinmeyen hata'))
            )))
          )
        )
      )
    );
  }

  // Eklentiden gelen canlı gönderim sonuçlarını dinle ve sunucuya kaydet
  window.addEventListener('message', async ev => {
    if (!ev.data || ev.data.type !== 'OPTIK_WA_RESULT') return;
    const res = ev.data.result || {};
    extLogs.push(res);
    renderExtReport();
    if (lastData && res.key) {
      try {
        await api('waMarkSent', { examId: lastData.exam.examId, okulKodu: lastData.okulKodu, results: [{ key: res.key, status: res.status, code: res.code, error: res.error }] });
      } catch (e) { }
    }
  });

  async function prepare() {
    if (!selSch.value || !selExam.value) return toast('Lütfen okul ve sınav seçin.', 'warn');
    clear(outBox); outBox.append(h('div', { class: 'card empty' }, 'Mesaj kuyruğu hazırlanıyor…'));
    try {
      lastData = await api('waQueue', {
        okulKodu: selSch.value,
        examId: selExam.value,
        sinif: selCls.value || undefined,
        hedef: selTarget.value,
        kodUret: chkCode.checked,
        tekrar: chkRepeat.checked
      });
      pickedKeys.clear();
      (lastData.rows || []).forEach(r => (r.targets || []).forEach(t => pickedKeys.add(t.key)));
      renderQueue();
    } catch (e) {
      clear(outBox);
      outBox.append(h('div', { class: 'alert bad' }, e.message));
    }
  }

  pane.append(
    h('div', { class: 'card' },
      h('div', { class: 'row between' },
        h('h2', { style: { margin: 0 } }, 'Veli WhatsApp Gönderim Merkezi'),
        h('span', { class: 'pill brand' }, `Algılanan Tarayıcı: ${br.name}`)
      ),
      h('p', { class: 'small muted', style: { marginTop: '.35rem' } },
        `Tarayıcınız (${br.name}) için arka plan eklentisi kurulumu: ${br.steps} `,
        h('a', { href: '#/kilavuz/wa-mesaj', onclick: e => { e.preventDefault(); location.hash = '#/kilavuz/wa-mesaj'; } }, 'Detaylı Kılavuz & Hata Kodları →')
      ),
      h('div', { class: 'grid' },
        h('div', { class: 'field' }, h('label', null, 'Okul'), selSch),
        h('div', { class: 'field' }, h('label', null, 'Sınav'), selExam),
        h('div', { class: 'field' }, h('label', null, 'Sınıf'), selCls),
        h('div', { class: 'field' }, h('label', null, 'Alıcı'), selTarget),
        h('div', { class: 'field' }, h('label', null, 'WhatsApp Türü'), selWaType),
        h('div', { class: 'field' }, h('label', null, 'Mesaj Arası Bekleme (sn)'), inDelay)
      ),
      h('div', { class: 'row', style: { marginTop: '.5rem' } },
        h('label', { class: 'row small' }, chkCode, ' Veli kodu olmayanlara otomatik üret'),
        h('label', { class: 'row small' }, chkRepeat, ' Daha önce gönderilenleri de listele'),
        h('span', { class: 'grow' }),
        h('button', { class: 'btn primary', onclick: prepare }, 'Mesajları Hazırla')
      )
    ),
    h('div', { class: 'card' },
      h('h3', { style: { marginTop: 0 } }, 'Özelleştirilebilir Mesaj Şablonu & Canlı Önizleme'),
      tplTa,
      phBar,
      prevBox
    ),
    reportBox,
    outBox
  );
  drawPreview();
}
