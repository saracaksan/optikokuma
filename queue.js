/* queue.js — çevrimdışı kuyruk ve senkronizasyon */
'use strict';

const Queue = {
  key: it => `${it.examId}|${it.okulKodu}|${normNo(it.ogrNo)}`,
  all() { return DB.all('queue').then(l => l.sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))); },
  async add(item) {
    const all = await this.all(), k = this.key(item), dup = all.find(x => this.key(x) === k);
    item.id = dup ? dup.id : 'q' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    item.createdAt = new Date().toISOString(); item.status = 'pending'; item.error = '';
    await DB.put('queue', item); await App.refreshQueueCount(); return { replaced: !!dup };
  },
  find(examId, okulKodu, ogrNo) { return this.all().then(a => a.find(x => x.examId === examId && String(x.okulKodu) === String(okulKodu) && normNo(x.ogrNo) === normNo(ogrNo))); },
  async remove(id) { await DB.del('queue', id); await App.refreshQueueCount(); }
};

App.refreshQueueCount = async function () {
  const all = await Queue.all(); App.queueCount = all.filter(x => x.status !== 'sent').length; App.updateTopbar();
  return all;
};

let syncing = false;
/** Bekleyen okutmaları sunucuya gönderir. Dönüş: {sent, failed, offline} */
App.syncQueue = async function (opt) {
  opt = opt || {};
  if (syncing || !App.state.user) return { sent: 0, failed: 0, busy: true };
  syncing = true; const out = { sent: 0, failed: 0, offline: false };
  try {
    const all = await Queue.all(), todo = all.filter(x => x.status === 'pending' || (opt.retryErrors && x.status === 'error'));
    const groups = {}; todo.forEach(x => { (groups[x.examId + '|' + x.okulKodu] = groups[x.examId + '|' + x.okulKodu] || []).push(x); });
    for (const g of Object.values(groups)) {
      for (let i = 0; i < g.length; i += 60) {
        const chunk = g.slice(i, i + 60);
        let data;
        try {
          data = await api('submitResults', { examId: chunk[0].examId, okulKodu: chunk[0].okulKodu, items: chunk.map(x => ({ clientId: x.id, ogrNo: x.ogrNo, booklet: x.booklet, answers: x.answers, flags: x.flags, scannedAt: x.scannedAt })) });
        } catch (e) {
          if (isNetErr(e)) { setOnline(false); out.offline = true; return out; }
          if (e.code === 'AUTH') return out;
          for (const x of chunk) { x.status = 'error'; x.error = e.message; await DB.put('queue', x); out.failed++; }
          continue;
        }
        const byId = {}; data.results.forEach(r => { byId[r.clientId] = r; });
        for (const x of chunk) {
          const r = byId[x.id];
          if (r && r.status !== 'error') { x.status = 'sent'; x.error = ''; x.sentAt = new Date().toISOString(); x.net = r.net; out.sent++; }
          else { x.status = 'error'; x.error = r ? r.error : 'Yanıt yok'; out.failed++; }
          await DB.put('queue', x);
        }
      }
    }
  } finally { syncing = false; await App.refreshQueueCount(); if (App.state.view === 'queue' && App.views.queueRefresh) App.views.queueRefresh(); }
  return out;
};

App.hooks.onOnline = () => { if (Settings.get('autoSync', true)) App.syncQueue(); };
window.addEventListener('online', () => { setOnline(true); });
window.addEventListener('offline', () => { App.state.online = false; App.updateTopbar(); });
setInterval(() => { if (App.state.user && App.state.online && Settings.get('autoSync', true) && (App.queueCount || 0) > 0) App.syncQueue(); }, 45000);

App.views.queue = function (root) {
  const body = h('div');
  root.append(h('h1', null, 'Gönderim kuyruğu'), body);
  const render = async () => {
    const all = await Queue.all(); clear(body);
    const pend = all.filter(x => x.status === 'pending'), err = all.filter(x => x.status === 'error'), sent = all.filter(x => x.status === 'sent');
    body.append(h('div', { class: 'card' },
      h('div', { class: 'stats' },
        h('div', { class: 'stat' }, h('b', null, pend.length), h('span', null, 'gönderilmeyi bekliyor')),
        h('div', { class: 'stat' }, h('b', { style: { color: err.length ? 'var(--bad)' : '' } }, err.length), h('span', null, 'hatalı')),
        h('div', { class: 'stat' }, h('b', null, sent.length), h('span', null, 'gönderildi'))),
      h('div', { class: 'row', style: { marginTop: '.8rem' } },
        h('button', { class: 'btn primary', disabled: !pend.length && !err.length, onclick: async ev => {
          ev.target.disabled = true; ev.target.textContent = 'Gönderiliyor…';
          const r = await App.syncQueue({ retryErrors: true });
          if (r.offline) toast('Sunucuya ulaşılamadı. Kayıtlar cihazda saklanıyor, bağlantı gelince gönderilir.', 'bad'); else toast(`${r.sent} kayıt gönderildi` + (r.failed ? `, ${r.failed} hatalı` : ''), r.failed ? 'bad' : 'ok');
          render();
        } }, 'Şimdi gönder'),
        sent.length ? h('button', { class: 'btn', onclick: async () => { for (const x of sent) await DB.del('queue', x.id); await App.refreshQueueCount(); render(); } }, 'Gönderilenleri listeden temizle') : null),
      !App.state.online ? h('div', { class: 'alert warn' }, 'Şu an çevrimdışısınız. Okutmalar cihazda güvende; internet gelince ' + (Settings.get('autoSync', true) ? 'otomatik gönderilir.' : '"Şimdi gönder" ile gönderebilirsiniz.')) : null));
    if (!all.length) { body.append(h('div', { class: 'empty card' }, 'Kuyruk boş. "Okut" sayfasından form okutun.')); return; }
    const byExam = {}; all.forEach(x => { (byExam[x.examName || x.examId] = byExam[x.examName || x.examId] || []).push(x); });
    for (const [name, list] of Object.entries(byExam)) {
      body.append(h('div', { class: 'card' }, h('h2', null, name), h('div', { class: 'tablewrap' }, h('table', null,
        h('thead', null, h('tr', null, ['Okul', 'No', 'Ad', 'Kit.', 'Durum', ''].map(t => h('th', null, t)))),
        h('tbody', null, list.slice().reverse().map(x => h('tr', null,
          h('td', null, (schoolByCode(x.okulKodu) || {}).okulAdi || x.okulKodu), h('td', { class: 'mono' }, x.ogrNo), h('td', null, x.ad || ''), h('td', null, x.booklet || ''),
          h('td', null, x.status === 'sent' ? h('span', { class: 'pill ok' }, 'Gönderildi') : x.status === 'error' ? h('span', { class: 'pill bad', title: x.error }, 'Hata: ' + (x.error || '').slice(0, 60)) : h('span', { class: 'pill warn' }, 'Bekliyor')),
          h('td', { class: 'right' }, x.status !== 'sent' ? h('button', { class: 'btn sm ghost', title: 'Kuyruktan sil', onclick: async () => { if (await confirmBox('Bu okutma kuyruktan silinsin mi? Gönderilmemiş veri kaybolur.', 'Sil', true)) { await Queue.remove(x.id); render(); } } }, '✕') : null))))))));
    }
  };
  App.views.queueRefresh = render; render();
  App.cleanup = () => { App.views.queueRefresh = null; };
};
