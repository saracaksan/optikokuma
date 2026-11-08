/* boot.js — başlatma, servis çalışanı kaydı */
'use strict';

App.start = async function () {
  App.renderShell();
  const first = App.state.user.role === 'okul' ? 'scan' : 'scan';
  App.go(first);
  try { await refreshBase(); if (App.state.view === first) App.go(first); }
  catch (e) { if (e.code !== 'AUTH') toast(isNetErr(e) ? 'Çevrimdışı: kayıtlı veriler kullanılıyor.' : e.message, isNetErr(e) ? '' : 'bad'); }
  if (Settings.get('autoSync', true) && App.state.online) App.syncQueue();
};

(async function boot() {
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    try { await navigator.serviceWorker.register('sw.js'); } catch (e) { console.warn('Servis çalışanı kaydedilemedi', e); }
  }
  const token = Settings.get('token', ''), user = await DB.get('kv', 'user');
  if (token && user && Settings.get('apiUrl', '')) { App.state.token = token; App.state.user = user; await App.start(); }
  else App.renderLogin();
})();
