/* AKSAN OMR Worker — hata yalıtımlı okuma ve önizleme üretimi */
importScripts('omr-core.js');
onmessage = function (e) {
  var d = e.data;
  try {
    var img = { gray: new Uint8Array(d.gray), w: d.w, h: d.h };
    var res = OMR.readPage(img, d.tpl, d.opts || {});
    var previews = [], frame = d.tpl.frame;
    if (res.ok) {
      var scale = Math.min(8, 1500 / Math.max(frame.w, frame.h));
      res.forms.forEach(function (f) {
        if (!f.ok) return;
        try {
          var rc = OMR.rectify(img, f.H, frame, scale);
          previews.push({ index: f.index, gray: rc.gray, w: rc.w, h: rc.h, s: scale });
        } catch (previewError) {
          // Önizleme üretilememesi başarılı optik okumayı geçersiz kılmaz.
          f.previewError = String(previewError && previewError.message || previewError);
        } finally { delete f.H; }
      });
    }
    var transfers = previews.map(function (p) { return p.gray.buffer; });
    postMessage({ id: d.id, res: res, previews: previews }, transfers);
  } catch (err) {
    postMessage({ id: d.id, error: String(err && err.message || err) });
  }
};
