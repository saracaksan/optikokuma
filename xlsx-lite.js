/* xlsx-lite.js — kütüphanesiz, küçük .xlsx yazıcı/okuyucu (şablon indirme + Excel'den yükleme)
 * write(sheets) → Blob   sheets: [{ name, rows:[[hücre…]], widths:[…], merges:['A1:A2'…], freeze:{row,col}, tabColor }]
 *   hücre: null | sayı | metin | { v, s:'h'|'b'|'n2'|'note'|'txt'|'avg'|'sub'|'ok', }
 * read(ArrayBuffer) → Promise<{ sheets:[{ name, rows:[[…]] }] }>   (sıkıştırma için tarayıcının DecompressionStream'i kullanılır)
 * Not: yalnızca bu uygulamanın ihtiyacı olan alt küme: metin/sayı hücreleri, birleştirilmiş hücreler, kaydırma dondurma. */
(function (root) {
  'use strict';
  const enc = new TextEncoder(), dec = new TextDecoder('utf-8');
  const T = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; T[n] = c >>> 0; }
  const crc32 = b => { let c = ~0; for (let i = 0; i < b.length; i++) c = T[(c ^ b[i]) & 255] ^ (c >>> 8); return (~c) >>> 0; };
  const xe = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
  const colName = i => { let s = ''; for (i++; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + (i - 1) % 26) + s; return s; };
  const colIndex = ref => { const m = /^([A-Z]+)/i.exec(ref); let n = 0; if (m) for (const ch of m[1].toUpperCase()) n = n * 26 + ch.charCodeAt(0) - 64; return n - 1; };

  /* ---------------------------------------------------------------- yazıcı */
  const STYLES = { h: 1, b: 2, n2: 3, note: 4, txt: 5, avg: 6, sub: 7, avgn: 8, ok: 9 };
  const STYLES_XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<fonts count="4"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font><font><i/><sz val="10"/><color rgb="FF5D6B79"/><name val="Calibri"/></font></fonts>' +
    '<fills count="6"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF14507A"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE3EEF6"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFF1D6"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE2F4EA"/><bgColor indexed="64"/></patternFill></fill></fills>' +
    '<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FFB8C4CF"/></left><right style="thin"><color rgb="FFB8C4CF"/></right><top style="thin"><color rgb="FFB8C4CF"/></top><bottom style="thin"><color rgb="FFB8C4CF"/></bottom><diagonal/></border></borders>' +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    '<cellXfs count="10">' +
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
    '<xf numFmtId="0" fontId="2" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>' +
    '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
    '<xf numFmtId="2" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
    '<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>' +
    '<xf numFmtId="49" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
    '<xf numFmtId="0" fontId="1" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>' +
    '<xf numFmtId="0" fontId="1" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>' +
    '<xf numFmtId="2" fontId="1" fillId="4" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"/>' +
    '<xf numFmtId="0" fontId="1" fillId="5" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>' +
    '</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';

  function sheetXml(sh) {
    const rows = sh.rows || [], widths = sh.widths || [];
    let x = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">';
    if (sh.tabColor) x += `<sheetPr><tabColor rgb="${sh.tabColor}"/></sheetPr>`;
    x += '<sheetViews><sheetView workbookViewId="0"' + (sh.first ? ' tabSelected="1"' : '') + '>';
    if (sh.freeze) { const r = sh.freeze.row || 0, c = sh.freeze.col || 0; x += `<pane${c ? ` xSplit="${c}"` : ''}${r ? ` ySplit="${r}"` : ''} topLeftCell="${colName(c)}${r + 1}" activePane="${r && c ? 'bottomRight' : r ? 'bottomLeft' : 'topRight'}" state="frozen"/>`; }
    x += '</sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/>';
    if (widths.length) x += '<cols>' + widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('') + '</cols>';
    x += '<sheetData>';
    rows.forEach((row, ri) => {
      if (!row) return; let cells = '';
      row.forEach((c, ci) => {
        if (c == null || c === '') { if (!(c && c.s)) return; }
        let v = c, s = 0; if (c && typeof c === 'object') { v = c.v; s = STYLES[c.s] || 0; }
        const ref = colName(ci) + (ri + 1), st = s ? ` s="${s}"` : '';
        if (v == null || v === '') cells += `<c r="${ref}"${st}/>`;
        else if (typeof v === 'number' && isFinite(v)) cells += `<c r="${ref}"${st}><v>${v}</v></c>`;
        else if (typeof v === 'boolean') cells += `<c r="${ref}"${st} t="b"><v>${v ? 1 : 0}</v></c>`;
        else cells += `<c r="${ref}"${st} t="inlineStr"><is><t xml:space="preserve">${xe(v)}</t></is></c>`;
      });
      const ht = sh.rowHeights && sh.rowHeights[ri]; x += `<row r="${ri + 1}"${ht ? ` ht="${ht}" customHeight="1"` : ''}>${cells}</row>`;
    });
    x += '</sheetData>';
    if (sh.merges && sh.merges.length) x += `<mergeCells count="${sh.merges.length}">` + sh.merges.map(m => `<mergeCell ref="${m}"/>`).join('') + '</mergeCells>';
    return x + '<pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/><pageSetup orientation="landscape" fitToHeight="0"/></worksheet>';
  }

  function zipStore(files) {
    const chunks = [], cd = []; let off = 0; const d = new Date();
    const dt = ((d.getFullYear() - 1980) << 9 | (d.getMonth() + 1) << 5 | d.getDate()) & 0xFFFF, tm = (d.getHours() << 11 | d.getMinutes() << 5 | (d.getSeconds() >> 1)) & 0xFFFF;
    for (const f of files) {
      const name = enc.encode(f.name), data = f.data, crc = crc32(data);
      const lh = new DataView(new ArrayBuffer(30)); lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true); lh.setUint16(10, tm, true); lh.setUint16(12, dt, true);
      lh.setUint32(14, crc, true); lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true); lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
      chunks.push(new Uint8Array(lh.buffer), name, data);
      const ch = new DataView(new ArrayBuffer(46)); ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true); ch.setUint16(12, tm, true); ch.setUint16(14, dt, true);
      ch.setUint32(16, crc, true); ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true); ch.setUint16(28, name.length, true); ch.setUint32(42, off, true);
      cd.push(new Uint8Array(ch.buffer), name); off += 30 + name.length + data.length;
    }
    const cdSize = cd.reduce((a, b) => a + b.length, 0), end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true); end.setUint32(12, cdSize, true); end.setUint32(16, off, true);
    return new Blob([...chunks, ...cd, new Uint8Array(end.buffer)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }
  const safeName = (n, i) => String(n || 'Sayfa' + (i + 1)).replace(/[\[\]:*?\/\\]/g, ' ').trim().slice(0, 31) || 'Sayfa' + (i + 1);
  function write(sheets) {
    sheets = sheets.map((s, i) => Object.assign({}, s, { name: safeName(s.name, i), first: i === 0 }));
    const NS = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
    const files = [
      { name: '[Content_Types].xml', text: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' + sheets.map((s, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('') + '</Types>' },
      { name: '_rels/.rels', text: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
      { name: 'xl/workbook.xml', text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook ${NS}><bookViews><workbookView activeTab="0"/></bookViews><sheets>` + sheets.map((s, i) => `<sheet name="${xe(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('') + '</sheets></workbook>' },
      { name: 'xl/_rels/workbook.xml.rels', text: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + sheets.map((s, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('') + `<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
      { name: 'xl/styles.xml', text: STYLES_XML }
    ].concat(sheets.map((s, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, text: sheetXml(s) })));
    return zipStore(files.map(f => ({ name: f.name, data: enc.encode(f.text) })));
  }

  /* ---------------------------------------------------------------- okuyucu */
  const MAX_UNZIPPED = 40 * 1024 * 1024, MAX_ENTRIES = 400;
  async function inflateRaw(u8) {
    if (typeof DecompressionStream === 'undefined') { const e = new Error('Bu tarayıcı .xlsx açamıyor (DecompressionStream yok). Dosyayı CSV olarak kaydedip yükleyin.'); e.code = 'NOZIP'; throw e; }
    const ds = new DecompressionStream('deflate-raw'), w = ds.writable.getWriter(); w.write(u8).catch(() => { }); w.close().catch(() => { });
    return new Uint8Array(await new Response(ds.readable).arrayBuffer());
  }
  async function unzip(buf, want) {
    const u8 = new Uint8Array(buf), dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength); let e = u8.length - 22;
    while (e >= 0 && e > u8.length - 70000 && dv.getUint32(e, true) !== 0x06054b50) e--;
    if (e < 0 || dv.getUint32(e, true) !== 0x06054b50) { const er = new Error('Dosya bir Excel (.xlsx) dosyası gibi görünmüyor. Eski .xls ise "Farklı kaydet → Excel Çalışma Kitabı (.xlsx)" ya da CSV seçin.'); er.code = 'NOTZIP'; throw er; }
    const n = dv.getUint16(e + 10, true); let p = dv.getUint32(e + 16, true); const out = new Map(); let total = 0;
    if (n > MAX_ENTRIES) throw new Error('Excel dosyası beklenenden çok parça içeriyor.');
    for (let i = 0; i < n; i++) {
      if (dv.getUint32(p, true) !== 0x02014b50) break;
      const method = dv.getUint16(p + 10, true), cs = dv.getUint32(p + 20, true), us = dv.getUint32(p + 24, true), nl = dv.getUint16(p + 28, true), el = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), lo = dv.getUint32(p + 42, true);
      const name = dec.decode(u8.subarray(p + 46, p + 46 + nl)); p += 46 + nl + el + cl;
      if (!want(name)) continue;
      total += us; if (total > MAX_UNZIPPED || us > MAX_UNZIPPED) throw new Error('Excel dosyası çok büyük (açılmış boyut sınırı aşıldı).');
      const ds = lo + 30 + dv.getUint16(lo + 26, true) + dv.getUint16(lo + 28, true), raw = u8.subarray(ds, ds + cs);
      out.set(name, method === 0 ? raw : method === 8 ? await inflateRaw(raw) : null);
      if (out.get(name) === null) throw new Error('Desteklenmeyen sıkıştırma yöntemi.');
    }
    return out;
  }
  const parseXml = t => { const d = new DOMParser().parseFromString(t, 'application/xml'); if (d.getElementsByTagName('parsererror').length) throw new Error('Excel dosyasının içeriği okunamadı.'); return d; };
  const kids = (el, tag) => Array.from(el.getElementsByTagName(tag));
  const textOf = si => kids(si, 't').filter(t => t.parentNode.nodeName !== 'rPh').map(t => t.textContent).join('');

  async function read(buf) {
    const files = await unzip(buf, n => /^xl\/(workbook\.xml|_rels\/workbook\.xml\.rels|sharedStrings\.xml|worksheets\/[^/]+\.xml)$/i.test(n));
    const get = n => { const b = files.get(n); return b ? dec.decode(b) : null; };
    const wb = get('xl/workbook.xml'); if (!wb) throw new Error('Excel çalışma kitabı bulunamadı.');
    const rels = {}; const rx = get('xl/_rels/workbook.xml.rels');
    if (rx) kids(parseXml(rx), 'Relationship').forEach(r => { let t = r.getAttribute('Target') || ''; t = t.replace(/^\//, ''); rels[r.getAttribute('Id')] = /^xl\//.test(t) ? t : 'xl/' + t; });
    const ss = []; const sx = get('xl/sharedStrings.xml'); if (sx) kids(parseXml(sx), 'si').forEach(si => ss.push(textOf(si)));
    const out = [];
    for (const s of kids(parseXml(wb), 'sheet')) {
      const rid = s.getAttribute('r:id') || s.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id'), file = rels[rid]; const xml = file && get(file); if (!xml) continue;
      const doc = parseXml(xml), rows = [];
      for (const row of kids(doc, 'row')) {
        const ri = (parseInt(row.getAttribute('r'), 10) || rows.length + 1) - 1; if (ri > 30000) break; const arr = [];
        for (const c of Array.from(row.childNodes)) {
          if (c.nodeName !== 'c') continue;
          const ci = colIndex(c.getAttribute('r') || ''); if (ci < 0 || ci > 300) continue;
          const t = c.getAttribute('t'), vEl = Array.from(c.childNodes).find(n => n.nodeName === 'v'), v = vEl ? vEl.textContent : null; let val = null;
          if (t === 's') val = v == null ? null : (ss[parseInt(v, 10)] == null ? null : ss[parseInt(v, 10)]);
          else if (t === 'inlineStr') { const is = Array.from(c.childNodes).find(n => n.nodeName === 'is'); val = is ? textOf(is) : null; }
          else if (t === 'str') val = v;
          else if (t === 'b') val = v === '1';
          else if (t === 'e') val = null;
          else if (v != null && v !== '') { const f = parseFloat(v); val = isFinite(f) ? f : v; }
          if (val !== null && val !== '') { while (arr.length < ci) arr.push(null); arr[ci] = val; }
        }
        while (rows.length < ri) rows.push([]);
        rows[ri] = arr;
      }
      const merges = kids(doc, 'mergeCell').map(m => m.getAttribute('ref'));
      out.push({ name: s.getAttribute('name') || '', rows, merges });
    }
    return { sheets: out };
  }

  const api = { write, read, colName, colIndex, crc32 };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.XlsxLite = api;
})(typeof window !== 'undefined' ? window : globalThis);
