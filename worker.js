/* worker.js — AKSAN OMR arka plan okuyucusu.
   Protokol uyumluluğu: {id, gray, w, h, tpl, opts} -> {id, res, previews}
   Büyük görüntüler ana arayüzü meşgul etmeden işlenir. */
'use strict';

importScripts('omr-core.js');

var WORKER_VERSION = '2.4.0-aksan-worker';
var MAX_PIXELS = 30000000;
var busy = false;

function errorText(err) {
  if (!err) return 'Bilinmeyen okuma hatası';
  return String(err.message || err.name || err).slice(0, 500);
}

function sendError(id, message, code) {
  self.postMessage({
    id: id,
    error: message,
    code: code || 'OMR_WORKER_ERROR',
    workerVersion: WORKER_VERSION
  });
}

function validate(d) {
  if (!d || typeof d !== 'object') throw new Error('İş isteği boş veya geçersiz.');
  if (d.id === undefined || d.id === null) throw new Error('İstek kimliği (id) eksik.');
  var w = Number(d.w), h = Number(d.h);
  if (!Number.isInteger(w) || !Number.isInteger(h) || w < 1 || h < 1) {
    throw new Error('Görüntü genişliği veya yüksekliği geçersiz.');
  }
  if (w * h > MAX_PIXELS) throw new Error('Görüntü 30 megapiksel sınırını aşıyor. Daha küçük görüntü yükleyin.');
  if (!d.gray || typeof d.gray.byteLength !== 'number') throw new Error('Görüntü piksel verisi bulunamadı.');
  if (d.gray.byteLength !== w * h) throw new Error('Piksel verisinin boyutu görüntü ölçüleriyle uyuşmuyor.');
  if (!d.tpl || !d.tpl.frame || !Array.isArray(d.tpl.groups)) throw new Error('Okuma şablonu eksik veya bozuk.');
  if (typeof OMR === 'undefined' || typeof OMR.readPage !== 'function' || typeof OMR.rectify !== 'function') {
    throw new Error('OMR çekirdeği yüklenemedi veya uyumlu değil.');
  }
  return { w: w, h: h };
}

function processRequest(d) {
  var size = validate(d);
  var img = { gray: new Uint8Array(d.gray), w: size.w, h: size.h };
  var started = Date.now();
  var res = OMR.readPage(img, d.tpl, d.opts || {});
  var previews = [];
  var frame = d.tpl.frame;
  var scale = Math.min(8, 1500 / Math.max(frame.w, frame.h));

  if (res && res.ok && Array.isArray(res.forms)) {
    res.forms.forEach(function (form) {
      if (!form || !form.ok || !form.H) return;
      var rc = OMR.rectify(img, form.H, frame, scale);
      if (rc && rc.gray && rc.w > 0 && rc.h > 0) {
        // Preview tamponu ana iş parçacığına aktarılır; kopyalanmaz.
        previews.push({
          index: form.index,
          gray: rc.gray instanceof Uint8Array ? rc.gray : new Uint8Array(rc.gray),
          w: rc.w,
          h: rc.h,
          s: scale
        });
      }
      // Homografi büyük/karmaşık sonucu ana arayüze taşınmaz.
      delete form.H;
    });
  }

  return {
    id: d.id,
    res: res,
    previews: previews,
    workerVersion: WORKER_VERSION,
    elapsedMs: Date.now() - started,
    image: { w: size.w, h: size.h, pixels: size.w * size.h }
  };
}

self.onmessage = function (event) {
  var d = event && event.data;
  var id = d && d.id;
  if (busy) {
    sendError(id, 'Okuyucu meşgul. Önceki işlem tamamlandıktan sonra tekrar deneyin.', 'WORKER_BUSY');
    return;
  }
  busy = true;
  try {
    var output = processRequest(d);
    var transfer = [];
    output.previews.forEach(function (p) {
      if (p.gray && p.gray.buffer) transfer.push(p.gray.buffer);
    });
    self.postMessage(output, transfer);
  } catch (err) {
    sendError(id, errorText(err), 'OMR_READ_FAILED');
  } finally {
    busy = false;
  }
};

// Ana uygulamanın sürüm/sağlık kontrolü yapabilmesi için basit ping desteği.

self.addEventListener('message', function (event) {
  var d = event && event.data;
  if (d && d.type === 'ping') {
    self.postMessage({ id: d.id, type: 'pong', workerVersion: WORKER_VERSION, coreVersion: OMR.VERSION || 'unknown' });
  }
});
