/* OptiNet — Veli Sonuç Mesajı (WhatsApp Web içinde çalışır)  ·  v1.1.1
   Uygulamada Yönetim → Veli WhatsApp sekmesinden kopyalanan kuyruğu sırayla gönderir: [{ id, n, t, ad }]
   id = alıcı kimliği (gönderildi işaretlemek için) · n = ülke kodlu numara (yalnız rakam) · t = mesaj metni · ad = panelde görünen ad.
   Her mesaj arasında rastgele bekleme (en az 8 sn), günlük sınır ve sorunlu numaraları atlama vardır. */
(function () {
  'use strict';
  if (window.__okulWaYuklu) return; window.__okulWaYuklu = true;
  const K = 'okulwa_kuyruk', G = 'okulwa_gun';
  const MIN_BEKLE = 8;               // sn — bunun altına inilemez
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const rnd = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
  const oku = async (k) => (await chrome.storage.local.get(k))[k] || null;
  const yaz = (k, v) => chrome.storage.local.set({ [k]: v });
  const bugun = () => new Date().toISOString().slice(0, 10);
  const ACIKLAMA = { 'gecersiz-numara': 'numara WhatsApp’ta kayıtlı değil', 'zaman-asimi': 'sohbet açılmadı (zaman aşımı)', 'gonderilemedi': 'gönderildiği doğrulanamadı — telefonda sohbeti kontrol edin' };
  let panel, ust, log;

  function gonderUrl(it) { return 'https://web.whatsapp.com/send?phone=' + encodeURIComponent(it.n) + '&text=' + encodeURIComponent(it.t) + '&app_absent=0'; }

  function arayuz() {
    if (panel) return;
    panel = document.createElement('div');
    panel.id = 'okulwa-panel';
    panel.style.cssText = 'position:fixed;right:14px;bottom:14px;z-index:2147483647;width:330px;background:#fff;color:#12322e;border:2px solid #2f9d57;border-radius:14px;box-shadow:0 8px 30px rgba(0,0,0,.25);font:13px/1.4 Segoe UI,Arial,sans-serif;padding:10px';
    panel.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center"><b>🏫 Veli sonuç mesajı</b><button id="okulwa-k" style="border:0;background:none;cursor:pointer;font-size:16px">–</button></div>' +
      '<div id="okulwa-g"><textarea id="okulwa-ta" placeholder="Uygulamadaki Veli WhatsApp sekmesinden kopyaladığınız kuyruğu buraya yapıştırın" style="width:100%;height:70px;margin:6px 0;border:1px solid #bbb;border-radius:8px;padding:6px;box-sizing:border-box"></textarea>' +
      '<div style="display:flex;gap:6px;align-items:center;margin-bottom:6px">Bekleme <input id="okulwa-a" type="number" min="8" value="12" style="width:48px"> – <input id="okulwa-b" type="number" min="9" value="25" style="width:48px"> sn · günlük en çok <input id="okulwa-c" type="number" min="1" value="60" style="width:48px"></div>' +
      '<div style="display:flex;gap:6px;flex-wrap:wrap"><button id="okulwa-y" class="okb">Yükle</button><button id="okulwa-s" class="okb" style="background:#2f9d57;color:#fff">▶ Başlat</button><button id="okulwa-p" class="okb">⏸ Duraklat</button><button id="okulwa-x" class="okb">■ Sıfırla</button><button id="okulwa-c2" class="okb">Gönderilenleri kopyala</button><button id="okulwa-c3" class="okb">Sorunluları kopyala</button></div>' +
      '<div id="okulwa-d" style="margin-top:8px;font-weight:600"></div><div id="okulwa-l" style="margin-top:4px;max-height:120px;overflow:auto;font-size:12px"></div></div>';
    document.body.appendChild(panel);
    const st = document.createElement('style');
    st.textContent = '#okulwa-panel .okb{border:1px solid #bbb;background:#f3f3f3;border-radius:8px;padding:5px 9px;cursor:pointer;font:inherit}';
    document.head.appendChild(st);
    ust = panel.querySelector('#okulwa-d'); log = panel.querySelector('#okulwa-l');
    panel.querySelector('#okulwa-k').onclick = () => { const g = panel.querySelector('#okulwa-g'); g.style.display = g.style.display === 'none' ? '' : 'none'; };
    panel.querySelector('#okulwa-y').onclick = yukle;
    panel.querySelector('#okulwa-s').onclick = baslat;
    panel.querySelector('#okulwa-p').onclick = async () => { const s = await oku(K); if (s) { s.calisiyor = false; await yaz(K, s); durum('Duraklatıldı.'); } };
    panel.querySelector('#okulwa-x').onclick = async () => { await chrome.storage.local.remove(K); log.innerHTML = ''; durum('Sıfırlandı.'); };
    panel.querySelector('#okulwa-c2').onclick = async () => {
      const s = await oku(K); if (!s) return;
      const ok = s.sonuc.filter((x) => x.d === 'gonderildi').map((x) => x.id);
      s.kopyalandi = ok.length; await yaz(K, s);
      try { await navigator.clipboard.writeText(JSON.stringify(ok)); durum(ok.length + ' gönderim kodu kopyalandı — uygulamada Veli WhatsApp → “Gönderilenleri işaretle” kutusuna yapıştırın.'); } catch (e) { panel.querySelector('#okulwa-ta').value = JSON.stringify(ok); durum('Kodlar kutuya yazıldı, kopyalayın.'); }
    };
    panel.querySelector('#okulwa-c3').onclick = async () => {
      const s = await oku(K); if (!s) return;
      const kotu = s.sonuc.filter((x) => x.d !== 'gonderildi').map((x) => x.ad + ' — ' + ACIKLAMA[x.d]).join('\n') || 'Sorunlu alıcı yok.';
      try { await navigator.clipboard.writeText(kotu); durum('Sorunlu alıcılar kopyalandı (veliyi telefonla arayın).'); } catch (e) { panel.querySelector('#okulwa-ta').value = kotu; durum('Liste kutuya yazıldı, kopyalayın.'); }
    };
  }
  function durum(m) { if (ust) ust.textContent = m; }
  function satir(m) { if (log) { const d = document.createElement('div'); d.textContent = m; log.prepend(d); } }

  async function yukle() {
    let q;
    try { q = JSON.parse(panel.querySelector('#okulwa-ta').value); } catch (e) { durum('Geçersiz kuyruk: portaldan tekrar kopyalayın.'); return; }
    if (!Array.isArray(q) || !q.length || !q.every((x) => x && x.n && x.t && x.id)) { durum('Kuyruk biçimi hatalı.'); return; }
    if (!q.every((x) => /^[1-9]\d{7,14}$/.test(String(x.n)))) { durum('Kuyrukta geçersiz numara var (yalnız rakam, ülke kodlu olmalı).'); return; }
    if (new Set(q.map((x) => String(x.id))).size !== q.length) { durum('Kuyrukta aynı kimlik birden fazla: aynı kişiye iki kez gönderilmesin diye reddedildi.'); return; }
    const eski = await oku(K), kayip = eski && eski.sonuc ? eski.sonuc.filter((x) => x.d === 'gonderildi').length - (eski.kopyalandi || 0) : 0;
    if (kayip > 0 && !confirm(kayip + ' gönderimin kaydı henüz kopyalanmadı; yeni kuyruk yüklenirse bu liste silinir ve uygulamada işaretlenemez (aynı kişilere tekrar gidebilir). Yine de yüklensin mi?')) { durum('Yükleme iptal edildi. Önce “Gönderilenleri kopyala”ya basın.'); return; }
    await yaz(K, { kuyruk: q, idx: 0, faz: 'git', calisiyor: false, sonuc: [], bekleA: 12, bekleB: 25, sinir: 60, sonraki: 0 });
    durum(q.length + ' alıcı yüklendi. “Başlat”a basın.');
  }
  async function baslat() {
    const s = await oku(K); if (!s) { durum('Önce kuyruğu yükleyin.'); return; }
    const a = Math.max(MIN_BEKLE, +panel.querySelector('#okulwa-a').value || 12), b = Math.max(a + 1, +panel.querySelector('#okulwa-b').value || 25);
    s.bekleA = a; s.bekleB = b; s.sinir = Math.max(1, +panel.querySelector('#okulwa-c').value || 60); s.calisiyor = true;
    await yaz(K, s); tick();
  }

  async function bekle(sel, ms) { const t0 = Date.now(); while (Date.now() - t0 < ms) { const e = typeof sel === 'function' ? sel() : document.querySelector(sel); if (e) return e; await sleep(400); } return null; }
  const yazma = () => document.querySelector('footer div[contenteditable="true"]');
  const gonderBtn = () => { const e = document.querySelector('footer button[aria-label="Send"], footer button[aria-label="Gönder"], footer [data-icon="send"], footer [data-icon="wds-ic-send-filled"]'); return e ? (e.closest('button') || e) : null; };
  const gecersiz = () => { const d = document.querySelector('div[role="dialog"], [data-animate-modal-popup="true"]'); return d && /invalid|geçersiz|not on WhatsApp|WhatsApp'ta değil|bulunamad/i.test(d.innerText) ? d : null; };

  let calisan = false;
  async function tick() {
    if (calisan) return; calisan = true;
    try {
      for (;;) {
        const s = await oku(K); if (!s || !s.calisiyor) { calisan = false; return; }
        const gun = (await oku(G)) || { t: bugun(), n: 0 }; if (gun.t !== bugun()) { gun.t = bugun(); gun.n = 0; }
        if (s.idx >= s.kuyruk.length) { s.calisiyor = false; await yaz(K, s); durum('✓ Bitti: ' + s.sonuc.filter((x) => x.d === 'gonderildi').length + ' gönderildi, ' + s.sonuc.filter((x) => x.d !== 'gonderildi').length + ' sorunlu.'); calisan = false; return; }
        if (gun.n >= s.sinir) { s.calisiyor = false; await yaz(K, s); durum('Günlük sınıra ulaşıldı (' + s.sinir + '). Yarın devam edebilirsiniz.'); calisan = false; return; }
        const it = s.kuyruk[s.idx];
        if (s.faz === 'bekle') {
          const kal = s.sonraki - Date.now();
          if (kal > 0) { durum('Sonraki mesaj ' + Math.ceil(kal / 1000) + ' sn sonra… (' + (s.idx + 1) + '/' + s.kuyruk.length + ')'); await sleep(Math.min(kal, 1000)); continue; }
          s.faz = 'git'; await yaz(K, s); continue;
        }
        if (s.faz === 'git') { s.faz = 'gonder'; await yaz(K, s); durum((s.idx + 1) + '/' + s.kuyruk.length + ' — ' + it.ad + ' açılıyor…'); location.href = gonderUrl(it); calisan = false; return; }
        /* faz === 'gonder' : sohbet sayfasındayız */
        if (location.href.indexOf('phone=' + encodeURIComponent(it.n)) < 0 && location.href.indexOf('phone=' + it.n) < 0) { s.faz = 'git'; await yaz(K, s); continue; }
        durum((s.idx + 1) + '/' + s.kuyruk.length + ' — ' + it.ad + ' gönderiliyor…');
        const e = await bekle(() => gecersiz() || (yazma() && gonderBtn() ? 1 : null), 45000);
        let d;
        if (!e) d = 'zaman-asimi';
        else if (e !== 1) { d = 'gecersiz-numara'; const b = e.querySelector('button'); if (b) b.click(); }
        else {
          await sleep(rnd(1200, 2600));
          const b = gonderBtn(); if (b) b.click();
          await sleep(2500);
          const kutu = yazma(); d = kutu && kutu.innerText.trim() === '' ? 'gonderildi' : 'gonderilemedi';
        }
        s.sonuc.push({ id: it.id, ad: it.ad, d }); satir((d === 'gonderildi' ? '✓ ' : '✖ ') + it.ad + (d === 'gonderildi' ? '' : ' — ' + d));
        if (d === 'gonderildi') { gun.n++; await yaz(G, gun); }
        s.idx++; s.faz = 'bekle'; s.sonraki = Date.now() + rnd(s.bekleA, s.bekleB) * 1000; await yaz(K, s);
        if (s.idx >= s.kuyruk.length) continue;
      }
    } finally { calisan = false; }
  }

  (async function init() {
    await sleep(1500); arayuz();
    const s = await oku(K);
    if (s) { durum(s.calisiyor ? 'Devam ediyor…' : (s.idx >= s.kuyruk.length ? 'Kuyruk bitti.' : s.kuyruk.length + ' alıcı yüklü, ' + s.idx + ' gönderildi. “Başlat”a basın.')); s.sonuc.slice(-6).forEach((x) => satir((x.d === 'gonderildi' ? '✓ ' : '✖ ') + x.ad)); if (s.calisiyor) tick(); }
    else durum('Kuyruk yok. Portalda “Eklenti için kuyruğu kopyala”ya basıp buraya yapıştırın.');
  })();
})();
