/* boot.js — başlatma, servis çalışanı kaydı, adres yönlendirme (#/kayit = herkese açık üyelik sayfası) */
'use strict';

const isRegisterRoute = () => /^#\/kayit/.test(location.hash);

App.start = async function () {
  App.renderShell();
  const first = 'scan';
  App.go(first);
  try { await refreshBase(); if (App.state.view === first) App.go(first); }
  catch (e) { if (e.code !== 'AUTH') toast(isNetErr(e) ? 'Çevrimdışı: kayıtlı veriler kullanılıyor.' : e.message, isNetErr(e) ? '' : 'bad'); }
  App.refreshPending();
  if (Settings.get('autoSync', true) && App.state.online) App.syncQueue();
};

/** Onay bekleyen başvuru sayısı (yönetim menüsündeki rozet) */
App.refreshPending = async function () {
  const u = App.state.user; if (!u || u.role === 'ogretmen' || !App.state.online) return;
  try { const d = await api('me', null, { noAuthRedirect: true }); App.state.pending = d.pending || 0; App.updateTopbar(); } catch (e) { }
};

/** Oturum açıksa uygulamaya, değilse girişe dön */
App.backToApp = function () {
  history.replaceState(null, '', location.pathname + location.search);
  if (App.state.user && App.state.token) App.start(); else App.renderLogin();
};

(async function boot() {
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    try { await navigator.serviceWorker.register('sw.js'); } catch (e) { console.warn('Servis çalışanı kaydedilemedi', e); }
  }
  window.addEventListener('hashchange', () => { if (isRegisterRoute()) App.renderRegister(); else App.backToApp(); });
  const token = Settings.get('token', ''), user = await DB.get('kv', 'user');
  if (token && user) { App.state.token = token; App.state.user = user; }
  if (isRegisterRoute()) App.renderRegister();
  else if (token && user && getApiUrl()) await App.start();
  else App.renderLogin();
})();
