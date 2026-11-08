/* Okuma işçisi: görüntü işleme arayüzü dondurmadan arka planda çalışır. */
importScripts('omr-core.js');
onmessage = function (e) {
  var d = e.data;
  try {
    var img = { gray: new Uint8Array(d.gray), w: d.w, h: d.h };
    var res = OMR.readPage(img, d.tpl, d.opts || {});
    var previews = [], frame = d.tpl.frame;
    if (res.ok) {
      var s = Math.min(8, 1500 / Math.max(frame.w, frame.h));
      res.forms.forEach(function (f) {
        if (!f.ok) return;
        var rc = OMR.rectify(img, f.H, frame, s);
        previews.push({ index: f.index, gray: rc.gray, w: rc.w, h: rc.h, s: s });
        delete f.H;
      });
    }
    postMessage({ id: d.id, res: res, previews: previews }, previews.map(function (p) { return p.gray.buffer; }));
  } catch (err) { postMessage({ id: d.id, error: String(err && err.message || err) }); }
};
