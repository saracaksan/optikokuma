/* results.js — sıralama, okul/ilçe/il karşılaştırma, madde analizi, dışa aktarma, karne */
'use strict';

const RS = { examId: '', data: null, analysis: null, tab: 'students', q: '', school: '', cls: '', sort: { key: 'rGenel', dir: 1 }, cmpSchool: '', cmpIl: '' };

/** Sıralanabilir tablo. cols: [{k,label,num,get,fmt,cls}] */
function dataTable(cols, rows, opt) {
  opt = opt || {}; const sort = opt.sort || { key: null, dir: 1 }, box = h('div', { class: 'tablewrap' });
  const draw = () => {
    const col = cols.find(c => c.k === sort.key), list = rows.slice();
    if (col) list.sort((a, b) => { const x = col.get ? col.get(a) : a[col.k], y = col.get ? col.get(b) : b[col.k]; const r = (typeof x === 'number' && typeof y === 'number') ? x - y : String(x == null ? '' : x).localeCompare(String(y == null ? '' : y), 'tr'); return r * sort.dir; });
    const shown = list.slice(0, opt.limit || 1000);
    clear(box).append(h('table', null, h('thead', null, h('tr', null, cols.map(c => h('th', { class: (c.num ? 'num ' : '') + 'sortable', title: 'Sırala', onclick: () => { sort.dir = sort.key === c.k ? -sort.dir : 1; sort.key = c.k; draw(); } }, c.label + (sort.key === c.k ? (sort.dir > 0 ? ' ▲' : ' ▼') : ''))))),
      h('tbody', null, shown.map(r => h('tr', { class: opt.mine && opt.mine(r) ? 'mine' : '', onclick: opt.onRow ? () => opt.onRow(r) : null, style: opt.onRow ? { cursor: 'pointer' } : null }, cols.map(c => { const v = c.get ? c.get(r) : r[c.k]; return h('td', { class: c.num ? 'num' : '' }, c.render ? c.render(r, v) : (c.num ? nf(v) : v)); }))))),
      list.length > shown.length ? h('div', { class: 'small muted', style: { padding: '.5rem' } }, `İlk ${shown.length} satır gösteriliyor (toplam ${list.length}). Hepsi için CSV indirin.`) : null);
  };
  draw(); box.redraw = draw; return box;
}
const barCell = (v, max, mine) => h('span', null, h('span', { class: 'bar' + (mine ? ' mine' : ''), style: { width: Math.max(2, 140 * (v / (max || 1))) + 'px' } }), ' ', nf(v));

async function loadResults(examId, force) {
  const d = await cached('results:' + examId, 'getResults', { examId });
  RS.data = d; RS.analysis = null; return d;
}

App.views.results = function (root) {
  const S = App.state, exams = S.exams;
  if (!RS.examId || !examById(RS.examId)) RS.examId = (Settings.get('resExam', '') && examById(Settings.get('resExam', ''))) ? Settings.get('resExam', '') : (exams[0] ? exams[0].examId : '');
  const exSel = h('select', { id: 'rs-exam' }, exams.length ? exams.map(e => h('option', { value: e.examId }, `${e.name}${e.date ? ' · ' + e.date : ''}${e.personal && e.owner !== S.user.username ? ' · ' + (e.ownerName || e.owner) : ''}`)) : h('option', { value: '' }, '(sınav yok)'));
  const body = h('div');
  root.append(h('div', { class: 'row between' }, h('h1', null, 'Sonuçlar'), h('div', { class: 'row' }, exSel, h('button', { class: 'btn', onclick: () => load(true) }, '↻ Yenile'))), body);
  if (RS.examId) exSel.value = RS.examId;
  exSel.addEventListener('change', () => { RS.examId = exSel.value; Settings.set('resExam', RS.examId); RS.q = RS.school = RS.cls = ''; load(); });

  async function load() {
    clear(body); if (!RS.examId) { body.append(h('div', { class: 'empty card' }, 'Henüz sınav yok.')); return; }
    body.append(h('div', { class: 'card muted' }, 'Sonuçlar hesaplanıyor…'));
    try { await loadResults(RS.examId); } catch (e) { clear(body).append(h('div', { class: 'alert bad' }, e.message)); return; }
    render();
  }

  function render() {
    const D = RS.data; clear(body);
    if (!D.rows.length && !D.schools.length) { body.append(h('div', { class: 'empty card' }, 'Bu sınav için henüz sonuç yok. "Okut" ile form okutup kuyruğu gönderin.')); return; }
    const c = D.cohort;
    body.append(h('div', { class: 'card' }, h('div', { class: 'stats' },
      h('div', { class: 'stat' }, h('b', null, c.n), h('span', null, 'katılımcı (tüm okullar)')), h('div', { class: 'stat' }, h('b', null, D.schools.length), h('span', null, 'okul')),
      h('div', { class: 'stat' }, h('b', null, nf(c.meanNet)), h('span', null, 'genel ort. net')), h('div', { class: 'stat' }, h('b', null, nf(c.sdNet)), h('span', null, 'standart sapma')), h('div', { class: 'stat' }, h('b', null, nf(c.maxNet)), h('span', null, 'en yüksek net'))),
      D.exam.config.method === 'std500' ? h('p', { class: 'small muted', style: { margin: '.7rem 0 0' } }, 'Puan; ders netlerinin bu sınava katılan tüm öğrenciler üzerinden standart puana çevrilip katsayılarla toplanması ve 100–500 aralığına ölçeklenmesiyle hesaplanır. Resmî LGS/YKS puanından farklı olabilir; ülke genelindeki ortalama ve standart sapma bu denemede kullanılmaz.') : null));
    const tabs = [['students', 'Öğrenciler'], ['schools', 'Okul karşılaştırma'], ['ilce', 'İlçe / İl'], ['items', 'Madde analizi'], ['karne', 'Karne']];
    const tb = h('div', { class: 'tabs' }, tabs.map(([id, l]) => h('button', { class: RS.tab === id ? 'active' : '', onclick: () => { RS.tab = id; render(); } }, l)));
    body.append(tb); const pane = h('div'); body.append(pane);
    ({ students: tabStudents, schools: tabSchools, ilce: tabIlce, items: tabItems, karne: tabKarne })[RS.tab](pane, D);
  }

  /* ---- öğrenciler ---- */
  function tabStudents(pane, D) {
    const rows = D.rows, secs = D.sections;
    const schools = Array.from(new Map(rows.map(r => [r.okulKodu, r.okulAdi]))), classes = Array.from(new Set(rows.map(r => r.sinif).filter(Boolean))).sort();
    const q = h('input', { type: 'search', placeholder: 'Ad, no ara…', value: RS.q, oninput: e => { RS.q = e.target.value; apply(); } });
    const sch = h('select', { onchange: e => { RS.school = e.target.value; apply(); } }, h('option', { value: '' }, 'Tüm okullar'), schools.map(([k, v]) => h('option', { value: k }, v)));
    const cls = h('select', { onchange: e => { RS.cls = e.target.value; apply(); } }, h('option', { value: '' }, 'Tüm sınıflar'), classes.map(k => h('option', { value: k }, k)));
    sch.value = RS.school; cls.value = RS.cls;
    const cols = [
      { k: 'rGenel', label: 'Genel sıra', num: true, render: r => `${r.rGenel}/${r.rGenelN}` }, { k: 'rIlce', label: 'İlçe', num: true, render: r => `${r.rIlce}/${r.rIlceN}` }, { k: 'rIl', label: 'İl', num: true, render: r => `${r.rIl}/${r.rIlN}` },
      { k: 'rOkul', label: 'Okul', num: true, render: r => `${r.rOkul}/${r.rOkulN}` }, { k: 'rSinif', label: 'Sınıf', num: true, render: r => r.sinif ? `${r.rSinif}/${r.rSinifN}` : '' },
      { k: 'ogrNo', label: 'No' }, { k: 'ad', label: 'Ad Soyad', render: (r, v) => v || h('span', { class: 'muted' }, '(listede yok)') }, { k: 'sinif', label: 'Sınıf' }, { k: 'okulAdi', label: 'Okul' }, { k: 'booklet', label: 'Kit.' },
      ...secs.map((s, j) => ({ k: 'n' + j, label: s.name + ' net', num: true, get: r => r.secNets[j] })),
      { k: 'D', label: 'D', num: true }, { k: 'Y', label: 'Y', num: true }, { k: 'B', label: 'B', num: true }, { k: 'net', label: 'Net', num: true }, { k: 'puan', label: 'Puan', num: true, render: (r, v) => h('b', null, nf(v)) }];
    const holder = h('div'), count = h('span', { class: 'muted small' });
    let filtered = [];
    function apply() {
      const t = RS.q.trim().toLocaleLowerCase('tr');
      filtered = rows.filter(r => (!RS.school || r.okulKodu === RS.school) && (!RS.cls || r.sinif === RS.cls) && (!t || (r.ogrNo + ' ' + r.ad).toLocaleLowerCase('tr').includes(t)));
      count.textContent = `${filtered.length} öğrenci`; clear(holder).append(dataTable(cols, filtered, { sort: RS.sort, limit: 400, onRow: r => karneModal(r) }));
    }
    pane.append(h('div', { class: 'row', style: { marginBottom: '.7rem' } }, q, sch, cls, count, h('span', { class: 'grow' }), h('button', { class: 'btn', onclick: () => exportRows(filtered) }, 'CSV indir')), holder);
    if (S.user.role !== 'admin') pane.append(h('p', { class: 'small muted' }, 'Yetki alanınızdaki öğrenciler listelenir; sıralamalar tüm katılımcılar içindeki konumunuzu gösterir.'));
    apply();
  }
  function exportRows(rows) {
    const D = RS.data, head = ['Genel sıra', 'İl sırası', 'İlçe sırası', 'Okul sırası', 'Sınıf sırası', 'Okul kodu', 'Okul', 'İl', 'İlçe', 'No', 'Ad Soyad', 'Sınıf', 'Kitapçık',
      ...D.sections.flatMap(s => [s.name + ' D', s.name + ' Y', s.name + ' B', s.name + ' Net', s.name + ' Std']), 'Toplam D', 'Toplam Y', 'Toplam B', 'Net', 'Puan', 'Cevaplar'];
    const out = [head].concat(rows.slice().sort((a, b) => a.rGenel - b.rGenel).map(r => [r.rGenel, r.rIl, r.rIlce, r.rOkul, r.sinif ? r.rSinif : '', r.okulKodu, r.okulAdi, r.il, r.ilce, r.ogrNo, r.ad, r.sinif, r.booklet,
      ...r.sec.flatMap((s, j) => [s[0], s[1], s[2], nf(s[3], 3), nf(r.secStd ? r.secStd[j] : '', 2)]), r.D, r.Y, r.B, nf(r.net, 3), nf(r.puan, 3), r.answers]));
    download(`${D.exam.name.replace(/[^\wığüşöçİĞÜŞÖÇ -]/g, '_')}-sonuclar.csv`, toCSV(out)); toast('CSV indirildi (Excel ile açılır)', 'ok');
  }

  /* ---- okul karşılaştırma ---- */
  function tabSchools(pane, D) {
    const secs = D.sections, ils = Array.from(new Set(D.schools.map(s => s.il))).sort(), ilceler = Array.from(new Set(D.schools.map(s => s.il + '|' + s.ilce))).sort();
    const f1 = h('select', { onchange: e => { RS.cmpIl = e.target.value; render(); } }, h('option', { value: '' }, 'Tüm il/ilçeler'), ils.map(i => h('option', { value: 'il:' + i }, i + ' (il)')), ilceler.map(i => h('option', { value: 'ilce:' + i }, i.replace('|', ' / '))));
    f1.value = RS.cmpIl;
    let list = D.schools.slice(); if (RS.cmpIl.startsWith('il:')) list = list.filter(s => s.il === RS.cmpIl.slice(3)); else if (RS.cmpIl.startsWith('ilce:')) list = list.filter(s => s.il + '|' + s.ilce === RS.cmpIl.slice(5));
    list.sort((a, b) => b.puan - a.puan); list.forEach((s, i) => { s.rankF = i + 1; });
    const max = Math.max(...list.map(s => s.puan), 1), mean = D.stats.map(s => s.mean);
    pane.append(h('div', { class: 'row', style: { marginBottom: '.7rem' } }, f1, h('span', { class: 'muted small' }, `${list.length} okul`), h('span', { class: 'grow' }),
      h('button', { class: 'btn', onclick: () => download('okul-karsilastirma.csv', toCSV([['Sıra', 'Okul kodu', 'Okul', 'İl', 'İlçe', 'Öğrenci', 'Ort. net', 'Ort. puan', ...secs.map(s => s.name + ' ort. net')], ...list.map(s => [s.rankF, s.key, s.label, s.il, s.ilce, s.n, nf(s.net, 3), nf(s.puan, 3), ...s.sec.map(v => nf(v, 3))])])) }, 'CSV indir')));
    pane.append(h('div', { class: 'card' }, h('h2', null, 'Ortalama puana göre okullar'), h('div', { class: 'compare' }, list.slice(0, 60).map(s => [h('div', { class: 'name', title: s.label }, `${s.rankF}. ${s.label}`), h('div', { class: 'right small' }, `${s.n} öğr.`), h('div', null, barCell(s.puan, max, s.mine))]))));
    const cols = [{ k: 'rankF', label: 'Sıra', num: true }, { k: 'label', label: 'Okul' }, { k: 'ilce', label: 'İlçe' }, { k: 'il', label: 'İl' }, { k: 'n', label: 'Öğrenci', num: true }, { k: 'net', label: 'Ort. net', num: true }, { k: 'puan', label: 'Ort. puan', num: true, render: (r, v) => h('b', null, nf(v)) },
      ...secs.map((s, j) => ({ k: 's' + j, label: s.name, num: true, get: r => r.sec[j], render: (r, v) => { const d = v - mean[j]; return h('span', null, nf(v), ' ', h('span', { class: 'small', style: { color: d >= 0 ? 'var(--ok)' : 'var(--bad)' } }, (d >= 0 ? '+' : '') + nf(d, 1))); } }))];
    pane.append(h('div', { class: 'card' }, h('h2', null, 'Ders bazlı ortalama net'), h('p', { class: 'small muted' }, 'Yeşil/kırmızı: genel ortalamaya göre fark. Başlığa tıklayarak sıralayın.'), dataTable(cols, list, { sort: { key: 'rankF', dir: 1 }, mine: r => r.mine })));
  }

  function tabIlce(pane, D) {
    const secs = D.sections, mk = (title, list) => {
      const max = Math.max(...list.map(s => s.puan), 1);
      const cols = [{ k: 'rank', label: 'Sıra', num: true }, { k: 'label', label: title }, { k: 'n', label: 'Öğrenci', num: true }, { k: 'net', label: 'Ort. net', num: true }, { k: 'puan', label: 'Ort. puan', num: true, render: (r, v) => barCell(v, max) }, ...secs.map((s, j) => ({ k: 's' + j, label: s.name, num: true, get: r => r.sec[j] }))];
      return h('div', { class: 'card' }, h('h2', null, title + ' karşılaştırması'), dataTable(cols, list, { sort: { key: 'rank', dir: 1 } }));
    };
    pane.append(mk('İlçe', D.ilceler), mk('İl', D.iller));
  }

  /* ---- madde analizi ---- */
  async function tabItems(pane, D) {
    pane.append(h('div', { class: 'card muted' }, 'Madde analizi yükleniyor…'));
    try { if (!RS.analysis) RS.analysis = await cached('analysis:' + RS.examId, 'getAnalysis', { examId: RS.examId }); } catch (e) { clear(pane).append(h('div', { class: 'alert bad' }, e.message)); return; }
    const A = RS.analysis; clear(pane);
    const sel = h('select', { onchange: e => { RS.cmpSchool = e.target.value; tabItemsDraw(); } }, h('option', { value: '' }, 'Okul karşılaştırması yok'), A.schoolNames.map(s => h('option', { value: s.okulKodu }, s.okulAdi)));
    sel.value = RS.cmpSchool; const holder = h('div');
    pane.append(h('div', { class: 'row', style: { marginBottom: '.7rem' } }, h('span', { class: 'muted small' }, 'Doğru yapan yüzdesi (genel) ve seçili okul:'), sel), holder);
    function tabItemsDraw() {
      const cs = RS.cmpSchool, cols = [{ k: 'q', label: 'Soru', num: true }, { k: 'section', label: 'Ders' }, { k: 'key', label: 'Anahtar' }, { k: 'pct', label: '% doğru (genel)', num: true, render: (r, v) => barCell(v, 100) },
        ...(cs ? [{ k: 'sp', label: '% doğru (okul)', num: true, get: r => (A.bySchool[cs] || [])[r.q - 1] || 0, render: (r, v) => barCell(v, 100, true) }, { k: 'dp', label: 'Fark', num: true, get: r => ((A.bySchool[cs] || [])[r.q - 1] || 0) - r.pct, render: (r, v) => h('span', { style: { color: v >= 0 ? 'var(--ok)' : 'var(--bad)' } }, (v >= 0 ? '+' : '') + nf(v, 1)) }] : []),
        { k: 'wrong', label: 'Yanlış', num: true }, { k: 'blank', label: 'Boş', num: true }, { k: 'opt', label: 'Şık dağılımı', get: r => Object.keys(r.opt).sort().map(o => `${o}:${r.opt[o]}`).join('  ') }];
      const secAgg = {}; A.items.forEach(it => { const o = secAgg[it.section] || (secAgg[it.section] = { n: 0, p: 0 }); o.n++; o.p += it.pct; });
      clear(holder).append(h('div', { class: 'chips', style: { marginBottom: '.6rem' } }, Object.entries(secAgg).map(([k, v]) => h('span', { class: 'chip' }, `${k}: ort. %${nf(v.p / v.n, 1)}`))), dataTable(cols, A.items.map(x => Object.assign({}, x)), { sort: { key: 'q', dir: 1 }, limit: 400 }),
        h('p', { class: 'small muted' }, '% doğru düşük olan sorular zor, çok yüksek olanlar kolay; yanlışların tek şıkta yığılması çeldiricinin işlediğine ya da anahtar hatasına işaret edebilir.'));
    }
    tabItemsDraw();
  }

  /* ---- karne ---- */
  function tabKarne(pane, D) {
    const schools = Array.from(new Map(D.rows.map(r => [r.okulKodu, r.okulAdi])));
    const sch = h('select', null, h('option', { value: '' }, 'Tüm okullarım'), schools.map(([k, v]) => h('option', { value: k }, v))), cls = h('select', null, h('option', { value: '' }, 'Tüm sınıflar'), Array.from(new Set(D.rows.map(r => r.sinif).filter(Boolean))).sort().map(k => h('option', { value: k }, k)));
    pane.append(h('div', { class: 'card' }, h('h2', null, 'Öğrenci karneleri'), h('p', { class: 'muted small' }, 'Her öğrenci için ayrı A4 sayfa: ders bazlı D/Y/B/net, standart puan, okul-ilçe-il-genel sıralaması, ortalamalarla karşılaştırma ve cevap-anahtar tablosu. Yazdırma penceresinde "PDF olarak kaydet" seçebilirsiniz. Tek bir öğrencinin karnesi için "Öğrenciler" sekmesinde satıra tıklayın.'),
      h('div', { class: 'row' }, sch, cls, h('button', { class: 'btn primary', onclick: () => { const rows = D.rows.filter(r => (!sch.value || r.okulKodu === sch.value) && (!cls.value || r.sinif === cls.value)).sort((a, b) => (a.sinif || '').localeCompare(b.sinif || '', 'tr') || a.rOkul - b.rOkul); if (!rows.length) return toast('Seçimde öğrenci yok', 'bad'); if (rows.length > 300 && !confirm(`${rows.length} karne hazırlanacak. Devam?`)) return; printKarne(rows); } }, 'Karneleri yazdır / PDF'))));
  }
  function karneEl(r) {
    const D = RS.data, secs = D.sections, ex = D.exam, sc = D.schools.find(s => s.key === r.okulKodu), keys = (ex.config.keys || {}), key = keys[r.booklet] || keys[Object.keys(keys)[0]] || '';
    let q = 0;
    const answers = h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '2px 4px', fontSize: '8.5pt' } });
    for (let i = 0; i < r.answers.length; i++) { const a = r.answers[i], k = key[i]; const ok = k && (k === '*' || a === k), col = !k ? '#555' : a === '-' ? '#888' : ok ? '#117a3d' : '#b3261e'; answers.append(h('span', { style: { color: col, minWidth: '52px' } }, `${i + 1}:${a === '-' ? '·' : a}${k ? (a === '-' ? '' : ok ? '✓' : '✗' + (k === '*' ? '' : '(' + k + ')')) : ''}`)); }
    const th = s => ({ border: '1px solid #999', padding: '3px 6px', textAlign: s || 'right', fontSize: '10pt' });
    return h('div', { class: 'karne' },
      h('div', { style: { display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #000', paddingBottom: '4px', marginBottom: '8px' } }, h('div', null, h('div', { style: { fontSize: '15pt', fontWeight: 700 } }, ex.name), h('div', { style: { fontSize: '10pt' } }, ex.date || '')), h('div', { style: { textAlign: 'right', fontSize: '10pt' } }, 'ÖĞRENCİ KARNESİ')),
      h('table', { style: { width: '100%', fontSize: '11pt', marginBottom: '8px', borderCollapse: 'collapse' } }, h('tbody', null,
        h('tr', null, h('td', { style: { padding: '2px 0' } }, h('b', null, 'Ad Soyad: '), r.ad || '—'), h('td', null, h('b', null, 'No: '), r.ogrNo), h('td', null, h('b', null, 'Sınıf: '), r.sinif || '—'), h('td', null, h('b', null, 'Kitapçık: '), r.booklet || '—')),
        h('tr', null, h('td', { colspan: 4 }, h('b', null, 'Okul: '), `${r.okulAdi} (${r.ilce}/${r.il})`)))),
      h('table', { style: { width: '100%', borderCollapse: 'collapse', marginBottom: '10px' } },
        h('thead', null, h('tr', null, ['Ders', 'Soru', 'D', 'Y', 'B', 'Net', 'Std. puan', 'Okul ort.', 'Genel ort.'].map((t, i) => h('th', { style: Object.assign(th(i ? 'right' : 'left'), { background: '#eee' }) }, t)))),
        h('tbody', null, secs.map((s, j) => h('tr', null, h('td', { style: th('left') }, s.name), h('td', { style: th() }, s.count), h('td', { style: th() }, r.sec[j][0]), h('td', { style: th() }, r.sec[j][1]), h('td', { style: th() }, r.sec[j][2]), h('td', { style: th() }, h('b', null, nf(r.sec[j][3]))), h('td', { style: th() }, nf(r.secStd ? r.secStd[j] : '', 1)), h('td', { style: th() }, sc ? nf(sc.sec[j]) : ''), h('td', { style: th() }, nf(D.stats[j].mean)))),
          h('tr', null, h('td', { style: Object.assign(th('left'), { fontWeight: 700 }) }, 'TOPLAM'), h('td', { style: th() }, secs.reduce((a, s) => a + s.count, 0)), h('td', { style: th() }, r.D), h('td', { style: th() }, r.Y), h('td', { style: th() }, r.B), h('td', { style: Object.assign(th(), { fontWeight: 700 }) }, nf(r.net)), h('td', { style: th() }, ''), h('td', { style: th() }, sc ? nf(sc.net) : ''), h('td', { style: th() }, nf(D.cohort.meanNet))))),
      h('div', { style: { display: 'flex', gap: '10px', marginBottom: '10px' } },
        h('div', { style: { border: '2px solid #000', padding: '6px 14px', textAlign: 'center', minWidth: '120px' } }, h('div', { style: { fontSize: '9pt' } }, 'PUAN'), h('div', { style: { fontSize: '22pt', fontWeight: 700 } }, nf(r.puan, 3))),
        h('table', { style: { flex: 1, borderCollapse: 'collapse' } }, h('tbody', null, [['Sınıf', r.rSinif, r.rSinifN, r.sinif], ['Okul', r.rOkul, r.rOkulN], ['İlçe', r.rIlce, r.rIlceN], ['İl', r.rIl, r.rIlN], ['Genel (tüm katılımcılar)', r.rGenel, r.rGenelN]].filter(x => x[3] !== '').map(x => h('tr', null, h('td', { style: th('left') }, x[0] + ' sırası'), h('td', { style: th() }, h('b', null, x[1]), ' / ', x[2])))))),
      h('div', { style: { fontSize: '10pt', fontWeight: 700, margin: '4px 0' } }, 'Cevap tablosu', key ? ' (✓ doğru, ✗ yanlış (doğru şık), · boş)' : ''), answers,
      h('div', { style: { marginTop: '10px', fontSize: '8pt', color: '#555' } }, D.exam.config.method === 'std500' ? 'Puan, bu sınava katılan öğrencilerin ortalama ve standart sapmasına göre hesaplanmış deneme puanıdır; resmî sınav puanı yerine geçmez.' : ''));
  }
  function printKarne(rows) {
    const pa = clear($('#printArea')); rows.forEach(r => pa.append(karneEl(r)));
    const done = () => { clear(pa); window.removeEventListener('afterprint', done); }; window.addEventListener('afterprint', done); setTimeout(() => window.print(), 100);
  }
  function karneModal(r) {
    const el = karneEl(r); el.style.background = '#fff'; el.style.color = '#000'; el.style.padding = '12px';
    modal('Öğrenci karnesi', el, { size: 'wide', buttons: [{ label: 'Kapat' }, { label: 'Yazdır / PDF', cls: 'primary', keepOpen: true, fn: () => printKarne([r]) }] });
  }
  load();
};
