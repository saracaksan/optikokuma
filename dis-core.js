/* dis-core.js — dış sınav (örn. yayınevi LGS denemesi) sonuç listesi: Excel şablonu üretimi ve tablo çözümleme. Saf mantık; arayüz dis-sinav.js'de.
 *
 * Biçim (kullanıcının örnek "Sınav Sonuç Listesi"ne uygun):
 *   Sıra | Ö.No | İsim | Sınıf | <Ders> D Y N … | Toplam D Y N | <Puan> | Dereceler: Snf Okul İlçe İl Genel | Yüzde
 *   üstte "Genel Ortalama" ve "Okul Ortalaması" satırları.
 * Satır modeli (sunucudaki DisSonuc ile aynı): { ogrNo, ad, sinif, sec:[[D,Y,N]…ders sayısı kadar], tot:[D,Y,N], puan, rk:{snf,okul,ilce,il,genel,pct} } */
(function (root) {
  'use strict';
  const nk = s => String(s == null ? '' : s).toLocaleLowerCase('tr').replace(/ı/g, 'i').replace(/ş/g, 's').replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ç/g, 'c').replace(/̇/g, '').replace(/\s+/g, ' ').trim();
  const text = v => (v == null ? '' : String(v)).trim();
  const r2 = v => Math.round(v * 100) / 100;
  /** "18,67", "1.234,5", "% 0,84", 12 → sayı; anlaşılmazsa null */
  function num(v) {
    if (typeof v === 'number') return isFinite(v) ? v : null;
    let s = text(v).replace(/[%\s]/g, ''); if (!s || s === '-' || s === '–') return null;
    if (s.includes(',') && s.includes('.')) s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
    else s = s.replace(',', '.');
    if (!/^[-+]?\d*\.?\d+(e[-+]?\d+)?$/i.test(s)) return null;
    const n = parseFloat(s); return isFinite(n) ? n : null;
  }
  const normNo = v => { const s = typeof v === 'number' ? String(Math.round(v)) : text(v); return /^\d+$/.test(s) ? s.replace(/^0+(?=\d)/, '') : s; };

  const LGS_LESSONS = [{ name: 'Türkçe', count: 20, short: 'TÜR' }, { name: 'Tarih', count: 10, short: 'TAR' }, { name: 'Din K.ve A.B.', count: 10, short: 'DİN' }, { name: 'İngilizce', count: 10, short: 'İNG' }, { name: 'Matematik', count: 20, short: 'MAT' }, { name: 'Fen', count: 20, short: 'FEN' }];
  const PRESETS = [
    { id: 'lgs', label: 'LGS (6 ders · 90 soru)', lessons: LGS_LESSONS, penalty: 1 / 3, puanAdi: 'LGS Puanı', choices: 4 },
    { id: 'lgs-sade', label: 'LGS (ders başına 20 soru)', lessons: [{ name: 'Türkçe', count: 20 }, { name: 'Matematik', count: 20 }, { name: 'Fen', count: 20 }, { name: 'T.C. İnkılap', count: 10 }, { name: 'İngilizce', count: 10 }, { name: 'Din K.ve A.B.', count: 10 }], penalty: 1 / 3, puanAdi: 'LGS Puanı', choices: 4 },
    { id: 'tyt', label: 'TYT (4 ders · 120 soru)', lessons: [{ name: 'Türkçe', count: 40 }, { name: 'Sosyal Bilimler', count: 20 }, { name: 'Temel Matematik', count: 40 }, { name: 'Fen Bilimleri', count: 20 }], penalty: 0.25, puanAdi: 'TYT Puanı', choices: 5 },
    { id: 'diger', label: 'Diğer (dersleri kendim yazacağım)', lessons: [{ name: 'Ders 1', count: 20 }, { name: 'Ders 2', count: 20 }], penalty: 0, puanAdi: 'Puan', choices: 4 }
  ];
  const PENALTIES = [{ v: 0, label: 'Yanlış doğruyu götürmez' }, { v: 1 / 3, label: '3 yanlış 1 doğruyu götürür (LGS)' }, { v: 0.25, label: '4 yanlış 1 doğruyu götürür (YKS)' }, { v: 0.5, label: '2 yanlış 1 doğruyu götürür' }];
  const penaltyToDiv = p => (p > 0 ? Math.round(1 / p * 100) / 100 : 0), divToPenalty = d => (d > 0 ? 1 / d : 0);

  /* ================================================================ ŞABLON */
  const H = v => ({ v, s: 'h' }), HX = { v: null, s: 'h' }, SUB = v => ({ v, s: 'sub' }), SUBX = { v: null, s: 'sub' };
  /** opt: { lessons, puanAdi, penalty, examName, date, kaynak } → XlsxLite.write'a verilecek sayfalar */
  function buildTemplate(opt) {
    opt = opt || {}; const L = (opt.lessons && opt.lessons.length ? opt.lessons : LGS_LESSONS), puanAdi = opt.puanAdi || 'Puan';
    const widths = [6, 10, 30, 8]; L.forEach(() => widths.push(5.5, 5.5, 7.5)); widths.push(6.5, 6.5, 8, 11, 6, 6, 6, 6, 7, 8);
    const top = [H('Sıra'), H('Ö.No'), H('İsim'), H('Sınıf')], sub = [HX, HX, HX, HX], merges = ['A1:A2', 'B1:B2', 'C1:C2', 'D1:D2'];
    let c = 4;
    L.forEach(l => { top.push(H(l.name), HX, HX); sub.push(SUB('D'), SUB('Y'), SUB('N')); merges.push(`${colName(c)}1:${colName(c + 2)}1`); c += 3; });
    top.push(H('Toplam'), HX, HX); sub.push(SUB('D'), SUB('Y'), SUB('N')); merges.push(`${colName(c)}1:${colName(c + 2)}1`); c += 3;
    top.push(H(puanAdi)); sub.push(HX); merges.push(`${colName(c)}1:${colName(c)}2`); c += 1;
    top.push(H('Dereceler'), HX, HX, HX, HX); ['Snf', 'Okul', 'İlçe', 'İl', 'Genel'].forEach(x => sub.push(SUB(x))); merges.push(`${colName(c)}1:${colName(c + 4)}1`); c += 5;
    top.push(H('Genel %')); sub.push(HX); merges.push(`${colName(c)}1:${colName(c)}2`);
    const avgRow = label => { const r = [null, null, { v: label, s: 'avg' }, { v: null, s: 'avg' }]; for (let i = 0; i < L.length * 3 + 3; i++) r.push({ v: null, s: 'avgn' }); r.push({ v: null, s: 'avgn' }); return r; };
    const sonuc = { name: 'Sonuçlar', widths, freeze: { row: 4, col: 3 }, merges, tabColor: 'FF14507A', rows: [top, sub, avgRow('Genel Ortalama'), avgRow('Okul Ortalaması')] };

    const examName = opt.examName || '', info = {
      name: 'Sınav Bilgisi', widths: [34, 34, 70], tabColor: 'FF1B7F4B', rows: [
        [H('Alan'), H('Değer'), H('Açıklama')],
        ['Sınav adı', examName, { v: 'Listede görünecek ad. Örn: DARGE 1. LGS Denemesi', s: 'note' }],
        ['Tarih (YYYY-AA-GG)', opt.date || '', { v: 'Örn: 2026-11-10. Sınavlar bu tarihe göre sıralanır, "net artışı" buna göre hesaplanır.', s: 'note' }],
        ['Kaynak / kurum', opt.kaynak || '', { v: 'Sınavı hazırlayan yayın ya da kurum. Örn: DARGE Yayınları, MEB, Okul Deneme', s: 'note' }],
        ['Puan adı', puanAdi, { v: 'Puan sütununun adı. Örn: LGS Puanı', s: 'note' }],
        ['Seçenek sayısı', opt.choices || 4, { v: '4 (A-D) ya da 5 (A-E). Yalnızca bilgi amaçlı.', s: 'note' }],
        ['Kaç yanlış 1 doğruyu götürür', penaltyToDiv(opt.penalty == null ? 1 / 3 : opt.penalty), { v: '3 → 3 yanlış 1 doğruyu götürür (LGS). 0 → yanlış götürmez. Net sütunu boş bırakılırsa bu kurala göre hesaplanır.', s: 'note' }]
      ]
    };
    const dersler = { name: 'Dersler', widths: [28, 14, 12, 60], tabColor: 'FF1B7F4B', rows: [[H('Ders'), H('Soru sayısı'), H('Kısa ad'), H('Not')]].concat(L.map((l, i) => [l.name, l.count, l.short || '', i === 0 ? { v: 'Ders adları "Sonuçlar" sayfasındaki sütun başlıklarıyla aynı olmalıdır. Soru sayıları başarı yüzdesi ve boş sayısı için kullanılır.', s: 'note' } : null])) };

    const ex = (no, ad, sinif, vals, puan, rk) => {
      const row = [rk[5] ? 1 : null, no, ad, sinif]; let tD = 0, tY = 0, tN = 0;
      L.forEach((l, i) => { const [d, y] = vals[i % vals.length], n = r2(d - y * (opt.penalty == null ? 1 / 3 : opt.penalty)); row.push(d, y, { v: n, s: 'n2' }); tD += d; tY += y; tN += n; });
      row.push(tD, tY, { v: r2(tN), s: 'n2' }, { v: puan, s: 'n2' }, rk[0], rk[1], rk[2], rk[3], rk[4], { v: rk[5], s: 'n2' }); return row;
    };
    const exRows = [top, sub, avgRow('Genel Ortalama'), avgRow('Okul Ortalaması')];
    const exA = ex('1001', 'ÖRNEK ÖĞRENCİ BİR', '8-A', [[Math.max(L[0].count - 2, 0), 1], [Math.max(L[1] ? L[1].count - 1 : 0, 0), 0]], 421.5, [1, 1, 1, 2, 9, 0.5]);
    const exB = ex('1002', 'ÖRNEK ÖĞRENCİ İKİ', '8-A', [[Math.max(L[0].count - 6, 0), 3], [Math.max(L[1] ? L[1].count - 4 : 0, 0), 2]], 366.25, [2, 3, 4, 6, 40, 3.2]);
    exRows.push(exA, exB);
    const ornek = { name: 'Örnek', widths, freeze: { row: 4, col: 3 }, merges, tabColor: 'FFA15C00', rows: exRows };

    const aciklama = {
      name: 'Açıklama', widths: [110], tabColor: 'FF5D6B79', rows: [
        [{ v: 'Dış sınav sonuç listesi şablonu — nasıl doldurulur?', s: 'b' }], [null],
        [{ v: '1) "Sınav Bilgisi" sayfasına sınavın adını, tarihini ve kaynağını (yayınevi/kurum) yazın.', s: 'note' }],
        [{ v: '2) "Sonuçlar" sayfasına, 3. satırdan itibaren öğrencileri alt alta yazın. Zorunlu olan tek sütun Ö.No\'dur (öğrenci listesindeki numara). İsim/Sınıf boşsa sistemdeki öğrenci kaydından tamamlanır.', s: 'note' }],
        [{ v: '3) Her ders için D (doğru), Y (yanlış), N (net) yazın. N boş bırakılırsa D ve Y\'den hesaplanır. Toplam D/Y/N de boşsa derslerden toplanır.', s: 'note' }],
        [{ v: '4) Puan ve Dereceler (Snf, Okul, İlçe, İl, Genel) isteğe bağlıdır. Boş bırakılan derecelerden Snf/Okul sistemde hesaplanır.', s: 'note' }],
        [{ v: '5) "Genel Ortalama" ve "Okul Ortalaması" satırları isteğe bağlıdır; doldurulursa analizde karşılaştırma olarak gösterilir. Boş bırakabilir, silebilirsiniz.', s: 'note' }],
        [{ v: '6) Farklı dersler için "Dersler" sayfasını ve "Sonuçlar" başlıklarını birlikte değiştirin ya da uygulamadaki "Şablon indir" ekranında dersleri seçerek yeni şablon alın.', s: 'note' }],
        [{ v: '7) "Örnek" sayfası doldurulmuş bir örnektir; yüklenmez. Hazır olunca dosyayı uygulamada Analiz → Dış sınav ekle → Excel yükle ile seçin.', s: 'note' }],
        [{ v: '8) Ondalıklar virgülle (18,67) ya da noktayla (18.67) yazılabilir. CSV olarak kaydederseniz ayraç ; ya da , olabilir.', s: 'note' }]
      ]
    };
    return [info, sonuc, dersler, ornek, aciklama];
  }
  function colName(i) { let s = ''; for (i++; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + (i - 1) % 26) + s; return s; }

  /* ================================================================ ÇÖZÜMLEME */
  const DYN = { d: 'D', dogru: 'D', y: 'Y', yanlis: 'Y', n: 'N', net: 'N', b: 'B', bos: 'B' };
  const SUFFIX = /^(.*?)[\s_.\-/]+(d|doğru|dogru|y|yanlış|yanlis|n|net|b|boş|bos)$/i;
  const isNoHdr = c => /^(o\.?\s?no|ogr\.?\s?no|ogrenci\s?no|okul\s?no|numara|no)$/.test(nk(c));
  function rankOf(t) {
    t = nk(t);
    if (/(^|\b)(snf|sinif|sube)\b.*(derece|sira)|^snf$/.test(t)) return 'snf';
    if (/okul.*(derece|sira)|^okul$/.test(t)) return 'okul';
    if (/ilce.*(derece|sira)|^ilce$/.test(t)) return 'ilce';
    if (/^il\b.*(derece|sira)|^il$/.test(t)) return 'il';
    if (/genel.*(derece|sira)|^genel$/.test(t)) return 'genel';
    if (/yuzde|%/.test(t)) return 'pct';
    return null;
  }
  function fixedOf(t) {
    const k = nk(t); if (!k) return null;
    if (/^(sira|s\.?\s?no)$/.test(k)) return { type: 'sira' };
    if (isNoHdr(t)) return { type: 'no' };
    if (/^(isim|adi soyadi|ad soyad|ad-soyad|ogrenci adi soyadi|ogrenci adi|ogrenci|adi|ad)$/.test(k)) return { type: 'ad' };
    if (/^(soyadi|soyad)$/.test(k)) return { type: 'soyad' };
    if (/^(sinif|sube|sinif\/sube|sinifi)$/.test(k)) return { type: 'sinif' };
    const r = rankOf(t); if (r && (r === 'pct' || /(derece|sira)/.test(k))) return { type: 'rk', f: r };
    if (/puan/.test(k) && !/ortalama/.test(k)) return { type: 'puan' };
    return null;
  }

  /** rows: Excel/CSV tablosu (dizi dizi). opt: { penalty, lessonCounts:{nk(ad):sayı} } → { lessons, rows, avg, avgOkul, cols, warnings, error } */
  function parseSheet(rows, opt) {
    opt = opt || {}; const warnings = [];
    rows = (rows || []).map(r => (r || []).slice());
    let hr = -1;
    for (let i = 0; i < Math.min(rows.length, 30); i++) if (rows[i].some(isNoHdr)) { hr = i; break; }
    if (hr < 0) return { error: 'Başlık satırı bulunamadı. İlk satırlardan birinde "Ö.No" (öğrenci numarası) sütunu olmalı. Şablonu indirip aynı düzeni kullanın.' };
    const next = rows[hr + 1] || [], twoRow = next.filter(c => DYN[nk(c)] === 'D' || DYN[nk(c)] === 'Y' || (DYN[nk(c)] === 'N')).length >= 3 && next.filter(c => isNoHdr(c)).length === 0;
    const width = Math.max(rows[hr].length, twoRow ? next.length : 0), cols = [], lessonIdx = new Map(), lessons = []; let carry = '';
    const lessonOf = name => { const k = nk(name); if (!lessonIdx.has(k)) { lessonIdx.set(k, lessons.length); lessons.push({ name: text(name), k, count: (opt.lessonCounts && opt.lessonCounts[k]) || 0 }); } return lessonIdx.get(k); };
    for (let c = 0; c < width; c++) {
      let top = text(rows[hr][c]), sub = twoRow ? text(next[c]) : ''; let d = null;
      if (twoRow) {
        if (top) carry = top; else if (sub) top = carry; else carry = '';
        const f = DYN[nk(sub)];
        if (f && top) d = /^(genel\s*)?toplam$/.test(nk(top)) ? { type: 'tot', f } : { type: 'les', li: lessonOf(top), f };
        else if (/derece/.test(nk(top)) && rankOf(sub)) d = { type: 'rk', f: rankOf(sub) };
        else if (rankOf(sub) === 'pct') d = { type: 'rk', f: 'pct' };
        else d = fixedOf((top + ' ' + sub).trim()) || fixedOf(top) || (sub ? fixedOf(sub) : null);
        if (d && d.type === 'rk' && !/derece|sira|yuzde|%/.test(nk(top + ' ' + sub))) d = null;
      } else {
        const m = SUFFIX.exec(top);
        if (m && DYN[nk(m[2])] && m[1].trim()) d = /^(genel\s*)?toplam$/.test(nk(m[1])) ? { type: 'tot', f: DYN[nk(m[2])] } : { type: 'les', li: lessonOf(m[1].trim()), f: DYN[nk(m[2])] };
        else d = fixedOf(top);
      }
      cols[c] = d;
    }
    if (!lessons.length) return { error: 'Ders sütunları bulunamadı. Her ders için D, Y, N alt başlıkları (ya da "Türkçe D", "Türkçe Y", "Türkçe N") gerekir.' };
    if (!cols.some(c => c && c.type === 'no')) return { error: '"Ö.No" sütunu bulunamadı.' };
    const nL = lessons.length, out = [], avgs = {}; let skippedNoNo = 0, bad = 0;
    for (let i = hr + (twoRow ? 2 : 1); i < rows.length; i++) {
      const r = rows[i]; if (!r || !r.some(v => text(v) !== '')) continue;
      const lab = r.slice(0, 5).map(v => (typeof v === 'number' ? '' : nk(v))).find(t => /ortalama|ortalamasi/.test(t));
      const val = cc => { const v = {}; r.forEach((x, ci) => { const d = cols[ci]; if (d && (d.type === 'les' || d.type === 'tot' || d.type === 'puan')) { const n = num(x); if (n != null) (d.type === 'les' ? (v['l' + d.li] = v['l' + d.li] || {}) : d.type === 'tot' ? (v.tot = v.tot || {}) : v)[d.type === 'puan' ? 'puan' : d.f] = n; } }); return v; };
      if (lab) {
        const kind = /okul/.test(lab) ? 'okul' : /sinif|ilce|il\b/.test(lab) ? null : 'genel'; if (!kind) continue;
        const v = val(), sec = []; for (let l = 0; l < nL; l++) { const o = v['l' + l] || {}; sec.push([o.D == null ? null : o.D, o.Y == null ? null : o.Y, o.N == null ? null : o.N]); }
        const t = v.tot || {}; avgs[kind] = { sec, tot: [t.D == null ? null : t.D, t.Y == null ? null : t.Y, t.N == null ? null : t.N], puan: v.puan == null ? null : v.puan }; continue;
      }
      let no = '', ad = '', soyad = '', sinif = '', puan = null; const rk = {};
      r.forEach((x, ci) => { const d = cols[ci]; if (!d) return; if (d.type === 'no') no = normNo(x); else if (d.type === 'ad') ad = text(x); else if (d.type === 'soyad') soyad = text(x); else if (d.type === 'sinif') sinif = text(x); else if (d.type === 'rk') { const n = num(x); if (n != null) rk[d.f] = n; } });
      const v = val(); puan = v.puan == null ? null : v.puan; ad = (ad + ' ' + soyad).trim();
      if (!no) { if (ad || Object.keys(v).length) skippedNoNo++; continue; }
      const sec = []; let any = false; for (let l = 0; l < nL; l++) { const o = v['l' + l] || {}; sec.push([o.D == null ? null : o.D, o.Y == null ? null : o.Y, o.N == null ? null : o.N]); if (o.D != null || o.Y != null || o.N != null) any = true; }
      const t = v.tot || {}; if (!any && puan == null && t.D == null) { bad++; continue; }
      out.push({ ogrNo: no, ad, sinif, sec, tot: [t.D == null ? null : t.D, t.Y == null ? null : t.Y, t.N == null ? null : t.N], puan, rk });
    }
    if (skippedNoNo) warnings.push(`${skippedNoNo} satırda Ö.No yok; bu satırlar atlandı.`);
    if (bad) warnings.push(`${bad} satırda hiç sonuç değeri yok; atlandı.`);
    if (!out.length) return { error: 'Öğrenci satırı bulunamadı. Ö.No ve en az bir ders sonucu içeren satırlar gerekir.' };
    const seen = new Set(), dup = []; out.forEach(r => { if (seen.has(r.ogrNo)) dup.push(r.ogrNo); seen.add(r.ogrNo); });
    if (dup.length) warnings.push(`Aynı Ö.No birden fazla satırda var (${Array.from(new Set(dup)).slice(0, 6).join(', ')}${dup.length > 6 ? '…' : ''}); sonuncusu geçerli olur.`);
    return { lessons, rows: out, avg: avgs.genel || null, avgOkul: avgs.okul || null, cols, twoRow, headerRow: hr, warnings };
  }

  /** Eksik net/toplamları tamamlar; ders soru sayıları bilinmiyorsa D+Y üst sınırından tahmin eder. Yeni nesne döndürmez, yerinde düzeltir. */
  function complete(parsed, penalty) {
    penalty = penalty || 0; const L = parsed.lessons;
    const fix = (sec, tot) => {
      let sD = 0, sY = 0, sN = 0, okN = true;
      sec.forEach(s => { if (s[2] == null && s[0] != null && s[1] != null) s[2] = r2(s[0] - s[1] * penalty); sD += s[0] || 0; sY += s[1] || 0; if (s[2] == null) okN = false; else sN += s[2]; });
      if (tot) { if (tot[0] == null) tot[0] = sD; if (tot[1] == null) tot[1] = sY; if (tot[2] == null && okN) tot[2] = r2(sN); if (tot[2] == null) tot[2] = r2(tot[0] - tot[1] * penalty); }
    };
    parsed.rows.forEach(r => fix(r.sec, r.tot));
    [parsed.avg, parsed.avgOkul].forEach(a => { if (a) { a.sec.forEach(s => { if (s[2] == null && s[0] != null && s[1] != null) s[2] = r2(s[0] - s[1] * penalty); }); if (a.tot[2] == null && a.tot[0] != null && a.tot[1] != null) a.tot[2] = r2(a.tot[0] - a.tot[1] * penalty); } });
    L.forEach((l, i) => { if (!l.count) { let mx = 0; parsed.rows.forEach(r => { mx = Math.max(mx, (r.sec[i][0] || 0) + (r.sec[i][1] || 0)); }); l.count = mx; l.guessed = true; } });
    return parsed;
  }

  /** Çalışma kitabı sayfaları ({name, rows}) → { exam:{name,date,kaynak,puanAdi,choices,penalty}, parsed, warnings } */
  function parseWorkbook(wb) {
    const sheets = wb.sheets || []; const by = n => sheets.find(s => nk(s.name).startsWith(n));
    const info = {}, counts = {}, shorts = {};
    const bi = by('sinav bilgisi') || by('bilgi');
    if (bi) bi.rows.forEach(r => {
      const k = nk(r[0]), v = r[1]; if (!k || v == null || text(v) === '') return;
      if (/^sinav adi|^adi$|^ad$/.test(k)) info.name = text(v); else if (/^tarih/.test(k)) info.date = dateText(v); else if (/kaynak|kurum|yayin/.test(k)) info.kaynak = text(v);
      else if (/^puan/.test(k)) info.puanAdi = text(v); else if (/secenek/.test(k)) info.choices = num(v) || 4;
      else if (/yanlis/.test(k)) { const n = num(String(v).match(/[\d.,]+/) ? String(v).match(/[\d.,]+/)[0] : v); if (n != null) info.penalty = n >= 1 ? divToPenalty(n) : n; }
    });
    const dd = by('dersler'); if (dd) dd.rows.slice(1).forEach(r => { const k = nk(r[0]); if (k && num(r[1]) != null) { counts[k] = Math.round(num(r[1])); shorts[k] = text(r[2]); } });
    let rs = by('sonuc') || sheets.find(s => !/^(sinav bilgisi|dersler|aciklama|ornek)/.test(nk(s.name)) && s.rows.some(r => r.some(isNoHdr))) || sheets.find(s => s.rows.some(r => r.some(isNoHdr)));
    if (!rs) return { error: 'Başlık satırı bulunamadı. Tabloda "Ö.No" (öğrenci numarası) başlıklı bir sütun ve ders başına D/Y/N sütunları olmalı; "Sonuçlar" sayfası yoksa ilk sayfa okunur. Hazır şablonu indirip aynı düzeni kullanın.' };
    const parsed = parseSheet(rs.rows, { lessonCounts: counts }); if (parsed.error) return parsed;
    parsed.lessons.forEach(l => { if (shorts[l.k]) l.short = shorts[l.k]; });
    const exam = { name: info.name || '', date: info.date || '', kaynak: info.kaynak || '', puanAdi: info.puanAdi || '', choices: info.choices || 0, penalty: info.penalty };
    return { exam, parsed, warnings: parsed.warnings.slice(), sheetName: rs.name };
  }
  /** Excel seri tarihi ya da metin → YYYY-AA-GG */
  function dateText(v) {
    if (typeof v === 'number' && v > 20000 && v < 80000) return new Date(Math.round((v - 25569) * 86400000)).toISOString().slice(0, 10);
    const s = text(v), m = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/.exec(s); if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : s;
  }

  /** Sunucuya gidecek satırlar (ders sayısı kadar sec, null'lar korunur) */
  const toServerRows = rows => { const m = new Map(); rows.forEach(r => { m.delete(r.ogrNo); m.set(r.ogrNo, { ogrNo: r.ogrNo, ad: r.ad || '', sinif: r.sinif || '', sec: r.sec, tot: r.tot, puan: r.puan, rk: r.rk || {} }); }); return Array.from(m.values()); };   // aynı Ö.No: sonuncusu geçerli

  /** Dereceleri eksik satırlar için hesaplar (aynı sınav içinde, puana — yoksa nete — göre). Sonuç: { snf, okul } yerel sıralar + N'ler. */
  function localRanks(rows) {
    const key = r => (r.puan != null ? r.puan : (r.tot && r.tot[2] != null ? r.tot[2] : (r.net != null ? r.net : -1e9)));
    const rank = (list, prop) => { const s = list.slice().sort((a, b) => key(b) - key(a)); let last = null, pos = 0; s.forEach((r, i) => { if (last === null || key(r) !== last) { pos = i + 1; last = key(r); } r[prop] = pos; r[prop + 'N'] = s.length; }); };
    const byCls = {}; rows.forEach(r => { (byCls[r.sinif || ''] = byCls[r.sinif || ''] || []).push(r); });
    rank(rows, 'lOkul'); Object.keys(byCls).forEach(k => rank(byCls[k], 'lSnf')); return rows;
  }

  const api = { nk, num, normNo, r2, LGS_LESSONS, PRESETS, PENALTIES, penaltyToDiv, divToPenalty, buildTemplate, parseSheet, parseWorkbook, complete, toServerRows, localRanks, dateText, colName };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.DisCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
