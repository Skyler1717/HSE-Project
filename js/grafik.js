/* grafik.js — Visualisasi ringan tanpa pustaka luar: batang, kolom, garis, donat, heatmap,
   matriks risiko 5×5, piramida hierarki pengendalian, serta ilustrasi bahaya (SVG).
   Aksesibilitas: setiap grafik punya label langsung (angka tertulis), judul untuk pembaca layar,
   penanda bentuk berbeda per seri, dan pola/tekstur (aktif pada tema Aksesibel). */
(function () {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  let idSeq = 0;
  function el(tag, a, ...anak) {
    const e = document.createElementNS(NS, tag);
    if (a) for (const [k, v] of Object.entries(a)) { if (v === null || v === undefined || v === false) continue; if (k === 'text') e.textContent = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v); }
    anak.flat(Infinity).forEach(c => { if (c) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return e;
  }
  function hh(tag, a, ...anak) {
    const e = document.createElement(tag);
    if (a) for (const [k, v] of Object.entries(a)) { if (v === null || v === undefined || v === false) continue; if (k === 'class') e.className = v; else if (k === 'text') e.textContent = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (k === 'style') e.style.cssText = v; else e.setAttribute(k, v); }
    anak.flat(Infinity).forEach(c => { if (c !== null && c !== undefined && c !== false) e.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c); });
    return e;
  }
  function akar(w, h, label, kls) {
    const s = el('svg', { viewBox: '0 0 ' + w + ' ' + h, class: 'grafik-svg ' + (kls || ''), role: 'img', 'aria-label': label, preserveAspectRatio: 'xMidYMid meet' });
    s.appendChild(el('title', { text: label }));
    return s;
  }
  // Pola/tekstur untuk membedakan kategori tanpa mengandalkan warna (dipakai di tema Aksesibel)
  function polaDefs(s) {
    const id = 'p' + (++idSeq); const d = el('defs');
    const mk = (n, isi) => { const p = el('pattern', { id: id + n, width: 8, height: 8, patternUnits: 'userSpaceOnUse' }, isi); d.appendChild(p); };
    mk('a', [el('path', { d: 'M0 8L8 0', class: 'pola-garis' })]);
    mk('b', [el('circle', { cx: 4, cy: 4, r: 1.6, class: 'pola-titik' })]);
    mk('c', [el('path', { d: 'M0 4h8M4 0v8', class: 'pola-garis' })]);
    mk('d', [el('path', { d: 'M0 0L8 8M8 0L0 8', class: 'pola-garis' })]);
    s.appendChild(d); return i => 'url(#' + id + 'abcd'[i % 4] + ')';
  }
  const WARNA = ['w-1', 'w-2', 'w-3', 'w-4', 'w-5', 'w-6', 'w-7', 'w-8'];
  const BENTUK = ['lingkaran', 'kotak', 'segitiga', 'belah'];
  function penanda(x, y, bentuk, kls) {
    if (bentuk === 'kotak') return el('rect', { x: x - 3.5, y: y - 3.5, width: 7, height: 7, class: kls });
    if (bentuk === 'segitiga') return el('path', { d: `M${x} ${y - 4.5}L${x + 4.5} ${y + 3.5}H${x - 4.5}Z`, class: kls });
    if (bentuk === 'belah') return el('path', { d: `M${x} ${y - 5}L${x + 5} ${y}L${x} ${y + 5}L${x - 5} ${y}Z`, class: kls });
    return el('circle', { cx: x, cy: y, r: 3.8, class: kls });
  }
  const fmt = n => (Math.round(n * 10) / 10).toLocaleString('id-ID');

  // ---------- Batang horizontal (HTML, label langsung) ----------
  function batang(items, opsi) {
    opsi = opsi || {}; const maks = Math.max(1, ...items.map(x => x.n)); const total = items.reduce((a, x) => a + x.n, 0);
    if (!items.length || !total) return hh('p', { class: 'kosong kecil', text: opsi.kosong || 'Belum ada data.' });
    return hh('ul', { class: 'g-batang', role: 'list' }, items.map((x, i) => hh(opsi.onKlik ? 'li' : 'li', { class: 'g-baris' },
      hh(opsi.onKlik ? 'button' : 'span', { class: 'g-label', type: opsi.onKlik ? 'button' : null, onclick: opsi.onKlik ? () => opsi.onKlik(x) : null, title: x.ket || null }, x.ikon || null, hh('span', { text: x.label })),
      hh('span', { class: 'g-jalur', 'aria-hidden': 'true' }, hh('span', { class: 'g-isi ' + (x.w ? 'w-' + x.w : WARNA[i % 8]) + ' pola-' + (i % 4), style: 'width:' + Math.max(2, x.n / maks * 100) + '%' })),
      hh('span', { class: 'g-n' }, hh('strong', { text: fmt(x.n) }), opsi.persen !== false ? hh('small', { text: ' ' + Math.round(x.n / total * 100) + '%' }) : null))));
  }

  // ---------- Kolom vertikal (SVG) ----------
  function kolom(labels, nilai, opsi) {
    opsi = opsi || {}; const W = 460, H = 210, kiri = 26, bawah = 30, atas = 18;
    const s = akar(W, H, opsi.judul || 'Grafik kolom', 'g-kolom'); const pola = polaDefs(s);
    const maks = Math.max(1, ...nilai); const lebar = (W - kiri - 8) / labels.length;
    for (let i = 0; i <= 4; i++) { const y = atas + (H - atas - bawah) * i / 4; s.appendChild(el('line', { x1: kiri, x2: W - 4, y1: y, y2: y, class: 'g-grid' })); s.appendChild(el('text', { x: kiri - 6, y: y + 4, class: 'g-sumbu', 'text-anchor': 'end', text: String(Math.round(maks * (1 - i / 4))) })); }
    labels.forEach((lb, i) => {
      const v = nilai[i] || 0, tinggi = (H - atas - bawah) * v / maks, x = kiri + i * lebar + lebar * .15, w = lebar * .7, y = H - bawah - tinggi;
      const kls = (opsi.warna && opsi.warna[i]) || 'w-1';
      s.appendChild(el('rect', { x, y, width: w, height: Math.max(0, tinggi), rx: 2, class: 'g-bar ' + kls }, el('title', { text: lb + ': ' + v })));
      s.appendChild(el('rect', { x, y, width: w, height: Math.max(0, tinggi), class: 'g-pola', fill: pola(opsi.pola ? opsi.pola[i] || 0 : 0) }));
      if (v) s.appendChild(el('text', { x: x + w / 2, y: y - 4, class: 'g-nilai', 'text-anchor': 'middle', text: String(v) }));
      if (!opsi.lompat || i % opsi.lompat === 0) s.appendChild(el('text', { x: x + w / 2, y: H - bawah + 16, class: 'g-sumbu', 'text-anchor': 'middle', text: lb }));
    });
    return s;
  }

  // ---------- Garis multi-seri (SVG) ----------
  function garis(labels, seri, opsi) {
    opsi = opsi || {}; const W = 560, H = 250, kiri = 30, kanan = 130, bawah = 30, atas = 16;
    const s = akar(W, H, opsi.judul || 'Grafik tren', 'g-garis');
    const maks = Math.max(1, ...seri.flatMap(x => x.data)); const dx = (W - kiri - kanan) / Math.max(1, labels.length - 1);
    const Y = v => atas + (H - atas - bawah) * (1 - v / maks);
    for (let i = 0; i <= 4; i++) { const y = atas + (H - atas - bawah) * i / 4; s.appendChild(el('line', { x1: kiri, x2: W - kanan, y1: y, y2: y, class: 'g-grid' })); s.appendChild(el('text', { x: kiri - 6, y: y + 4, class: 'g-sumbu', 'text-anchor': 'end', text: String(Math.round(maks * (1 - i / 4))) })); }
    labels.forEach((lb, i) => { if (!opsi.lompat || i % opsi.lompat === 0) s.appendChild(el('text', { x: kiri + i * dx, y: H - 10, class: 'g-sumbu', 'text-anchor': 'middle', text: lb })); });
    const posLabel = [];
    seri.forEach((sr, j) => {
      const kls = sr.w ? 'w-' + sr.w : WARNA[j % 8];
      const d = sr.data.map((v, i) => (i ? 'L' : 'M') + (kiri + i * dx) + ' ' + Y(v)).join('');
      s.appendChild(el('path', { d, class: 'g-jalur-garis ' + kls, 'stroke-dasharray': ['', '6 4', '2 4', '10 3 2 3'][j % 4] || null }));
      sr.data.forEach((v, i) => { const m = penanda(kiri + i * dx, Y(v), BENTUK[j % 4], 'g-titik ' + kls); m.appendChild(el('title', { text: sr.nama + ' · ' + labels[i] + ': ' + v })); s.appendChild(m); });
      let yl = Y(sr.data[sr.data.length - 1]); while (posLabel.some(p => Math.abs(p - yl) < 13)) yl += 13; posLabel.push(yl);
      s.appendChild(penanda(W - kanan + 12, yl - 4, BENTUK[j % 4], 'g-titik ' + kls));
      s.appendChild(el('text', { x: W - kanan + 20, y: yl, class: 'g-label-seri', text: sr.nama + ' (' + sr.data[sr.data.length - 1] + ')' }));
    });
    return s;
  }

  // ---------- Donat (SVG + legenda berangka) ----------
  function donat(items, opsi) {
    opsi = opsi || {}; const total = items.reduce((a, x) => a + x.n, 0);
    if (!total) return hh('p', { class: 'kosong kecil', text: 'Belum ada data.' });
    const s = akar(160, 160, opsi.judul || 'Diagram donat', 'g-donat'); const pola = polaDefs(s);
    let a0 = -Math.PI / 2;
    items.forEach((x, i) => {
      const a1 = a0 + x.n / total * Math.PI * 2, besar = a1 - a0 > Math.PI ? 1 : 0, R = 70, r = 42;
      const p = (a, rr) => [80 + rr * Math.cos(a), 80 + rr * Math.sin(a)];
      const [x0, y0] = p(a0, R), [x1, y1] = p(Math.min(a1, a0 + Math.PI * 2 - 1e-4), R), [x2, y2] = p(Math.min(a1, a0 + Math.PI * 2 - 1e-4), r), [x3, y3] = p(a0, r);
      const d = `M${x0} ${y0}A${R} ${R} 0 ${besar} 1 ${x1} ${y1}L${x2} ${y2}A${r} ${r} 0 ${besar} 0 ${x3} ${y3}Z`;
      const kls = x.w ? 'w-' + x.w : WARNA[i % 8];
      s.appendChild(el('path', { d, class: 'g-irisan ' + kls }, el('title', { text: x.label + ': ' + x.n })));
      s.appendChild(el('path', { d, class: 'g-pola', fill: pola(i) }));
      a0 = a1;
    });
    s.appendChild(el('text', { x: 80, y: 78, 'text-anchor': 'middle', class: 'g-tengah', text: String(total) }));
    s.appendChild(el('text', { x: 80, y: 96, 'text-anchor': 'middle', class: 'g-sumbu', text: opsi.satuan || 'catatan' }));
    return hh('div', { class: 'g-donat-wadah' }, s, hh('ul', { class: 'g-legenda' }, items.map((x, i) => hh('li', {},
      hh('span', { class: 'g-kunci ' + (x.w ? 'w-' + x.w : WARNA[i % 8]) + ' pola-' + (i % 4), 'aria-hidden': 'true' }), hh('span', { text: x.label }), hh('strong', { text: x.n + ' (' + Math.round(x.n / total * 100) + '%)' })))));
  }

  // ---------- Heatmap (tabel HTML, angka tertulis di sel) ----------
  function heatmap(barisLabel, kolomLabel, nilai, opsi) {
    opsi = opsi || {}; const maks = Math.max(1, ...nilai.flat());
    const tingkat = v => v === 0 ? 0 : Math.min(4, Math.ceil(v / maks * 4));
    return hh('div', { class: 'tabel-gulir' }, hh('table', { class: 'g-heatmap' }, hh('caption', { class: 'sr', text: opsi.judul || 'Heatmap' }),
      hh('thead', {}, hh('tr', {}, hh('th', { scope: 'col', text: opsi.sudut || '' }), kolomLabel.map(k => hh('th', { scope: 'col', title: k.ket || k.label || k }, k.ikon || null, hh('span', { text: k.label || k }))))),
      hh('tbody', {}, barisLabel.map((b, i) => hh('tr', {}, hh('th', { scope: 'row', text: b.label || b }), kolomLabel.map((k, j) => {
        const v = nilai[i][j] || 0;
        return hh('td', { class: 'hm-' + tingkat(v) }, v && opsi.onKlik ? hh('button', { type: 'button', 'aria-label': (b.label || b) + ', ' + (k.label || k) + ': ' + v, onclick: () => opsi.onKlik(i, j), text: String(v) }) : hh('span', { text: v ? String(v) : '·' }));
      }))))));
  }

  // ---------- Matriks risiko 5×5 (dampak × kemungkinan) ----------
  const LBL_D = ['Tidak signifikan', 'Minor', 'Sedang', 'Mayor', 'Katastrofik'], LBL_K = ['Hampir tidak mungkin', 'Jarang', 'Mungkin', 'Sering', 'Hampir pasti'];
  function matriks(jumlah, opsi) {
    opsi = opsi || {}; const level = opsi.level || (s => s <= 4 ? 0 : s <= 9 ? 1 : s <= 14 ? 2 : 3);
    const nama = opsi.namaLevel || ['Rendah', 'Sedang', 'Tinggi', 'Sangat tinggi'], simbol = ['○', '△', '◇', '✕'];
    const g = hh('div', { class: 'g-matriks', role: 'grid', 'aria-label': 'Matriks risiko 5 kali 5: dampak (baris) dan kemungkinan (kolom)' });
    g.appendChild(hh('div', { class: 'm-sumbu-y', 'aria-hidden': 'true' }, hh('span', { text: 'DAMPAK →' })));
    const isi = hh('div', { class: 'm-isi' });
    for (let d = 5; d >= 1; d--) {
      const baris = hh('div', { class: 'm-baris', role: 'row' }, hh('div', { class: 'm-lbl', role: 'rowheader', title: LBL_D[d - 1] }, hh('strong', { text: String(d) }), hh('small', { text: LBL_D[d - 1] })));
      for (let k = 1; k <= 5; k++) {
        const skor = d * k, lv = level(skor), n = (jumlah[d] && jumlah[d][k]) || 0;
        baris.appendChild(hh('button', { type: 'button', role: 'gridcell', class: 'm-sel lv-' + lv + (n ? ' ada' : ''), disabled: !n || !opsi.onKlik ? true : null,
          'aria-label': 'Dampak ' + d + ', kemungkinan ' + k + ', skor ' + skor + ' (' + nama[lv] + '): ' + n + ' catatan', onclick: () => opsi.onKlik && opsi.onKlik(d, k) },
          hh('span', { class: 'm-skor', text: simbol[lv] + ' ' + skor }), n ? hh('strong', { class: 'm-n', text: String(n) }) : null));
      }
      isi.appendChild(baris);
    }
    isi.appendChild(hh('div', { class: 'm-baris m-kaki', 'aria-hidden': 'true' }, hh('div', { class: 'm-lbl' }), LBL_K.map((t, i) => hh('div', { class: 'm-lbl-k' }, hh('strong', { text: String(i + 1) }), hh('small', { text: t })))));
    isi.appendChild(hh('div', { class: 'm-sumbu-x', 'aria-hidden': 'true', text: 'KEMUNGKINAN →' }));
    g.appendChild(isi);
    return hh('div', {}, g, hh('ul', { class: 'm-legenda' }, nama.map((t, i) => hh('li', {}, hh('span', { class: 'm-kunci lv-' + i, text: simbol[i] }), t))));
  }

  // ---------- Piramida hierarki pengendalian (SVG interaktif) ----------
  function piramida(tingkat, opsi) {
    opsi = opsi || {}; const W = 360, H = 250, n = tingkat.length, t = H / n;
    const s = akar(W, H, 'Piramida hierarki pengendalian: paling efektif di atas', 'g-piramida');
    tingkat.forEach((x, i) => {
      // Terbalik: eliminasi (paling efektif) paling lebar di atas
      const lebarAtas = W - i * (W / n) * .62, lebarBawah = W - (i + 1) * (W / n) * .62;
      const xa = (W - lebarAtas) / 2, xb = (W - lebarBawah) / 2, y = i * t;
      const g = el('g', { class: 'pir-lapis pir-' + i + (opsi.aktif === x.level ? ' aktif' : ''), tabindex: opsi.onKlik ? 0 : null, role: opsi.onKlik ? 'button' : null,
        'aria-label': x.nama + (x.n != null ? ': ' + x.n : '') + '. ' + (x.ket || ''), onclick: () => opsi.onKlik && opsi.onKlik(x), onkeydown: e => { if ((e.key === 'Enter' || e.key === ' ') && opsi.onKlik) { e.preventDefault(); opsi.onKlik(x); } } },
        el('path', { d: `M${xa} ${y + 2}H${xa + lebarAtas}L${xb + lebarBawah} ${y + t - 2}H${xb}Z`, class: 'pir-bentuk' }),
        el('text', { x: W / 2, y: y + t / 2 - 2, 'text-anchor': 'middle', class: 'pir-teks', text: (i + 1) + '. ' + x.nama }),
        x.n != null ? el('text', { x: W / 2, y: y + t / 2 + 14, 'text-anchor': 'middle', class: 'pir-sub', text: x.n + ' ' + (opsi.satuan || 'tindakan') }) : null);
      s.appendChild(g);
    });
    return s;
  }

  // ---------- Ilustrasi bahaya (adegan SVG sederhana) ----------
  // Figur orang: kepala + badan; pose memengaruhi sudut tubuh.
  function orang(x, y, sk, pose, kls) {
    const g = el('g', { class: 'il-orang ' + (kls || ''), transform: `translate(${x} ${y}) scale(${sk || 1})` });
    g.appendChild(el('circle', { cx: 0, cy: -34, r: 7, class: 'il-kepala' }));
    g.appendChild(el('path', { d: 'M-8 -42a8 8 0 0 1 16 0z', class: 'il-helm' }));
    const P = {
      berdiri: 'M0 -26V-6M0 -22l-9 10M0 -22l9 10M0 -6l-7 18M0 -6l7 18',
      jatuh: 'M0 -26l6 18M0 -22l-12 -4M0 -22l12 -10M6 -8l-12 14M6 -8l12 10',
      membungkuk: 'M0 -26l14 12M6 -20l4 16M10 -18l10 10M14 -14l-4 24M14 -14l10 22',
      tergelincir: 'M0 -26l-4 18M0 -22l-12 2M0 -22l10 -10M-4 -8l18 4M-4 -8l-16 14',
      angkat: 'M0 -26V-6M0 -20l-10 8M0 -20l10 8M0 -6l-7 18M0 -6l7 18'
    };
    g.appendChild(el('path', { d: P[pose] || P.berdiri, class: 'il-badan' }));
    return g;
  }
  const garisLantai = (y) => el('path', { d: `M6 ${y}H114`, class: 'il-lantai' });
  const ADEGAN = {
    ketinggian: () => [garisLantai(110), el('path', { d: 'M30 110L46 24M58 110L74 24M34 92h28M38 74h28M42 56h28M45 38h28', class: 'il-garis' }), orang(78, 46, .9, 'jatuh', 'il-bahaya'), el('path', { d: 'M96 52v36m-6-8l6 8 6-8', class: 'il-panah' }), el('circle', { cx: 98, cy: 104, r: 6, class: 'il-tanda' })],
    listrik: () => [el('path', { d: 'M18 86c18 0 18-26 36-26s16 18 30 18', class: 'il-garis' }), el('rect', { x: 84, y: 66, width: 20, height: 24, rx: 4, class: 'il-benda' }), el('path', { d: 'M90 66v-8M98 66v-8', class: 'il-garis' }), el('path', { d: 'M56 18L40 54h14l-8 30 26-40H58l10-26z', class: 'il-petir' })],
    kimia: () => [el('path', { d: 'M48 20h24M52 20v22L32 90a6 6 0 0 0 6 8h44a6 6 0 0 0 6-8L68 42V20', class: 'il-benda' }), el('path', { d: 'M38 76h44', class: 'il-garis' }), el('circle', { cx: 52, cy: 84, r: 4, class: 'il-tanda' }), el('circle', { cx: 66, cy: 88, r: 3, class: 'il-tanda' }), el('path', { d: 'M54 14c-4-6 4-8 0-14M66 14c-4-6 4-8 0-14', class: 'il-uap' }), el('path', { d: 'M96 70c4 6 6 9 6 12a6 6 0 0 1-12 0c0-3 2-6 6-12z', class: 'il-tetes' })],
    api: () => [garisLantai(108), el('path', { d: 'M60 104c-22 0-30-18-22-34 4 10 10 12 12 10-4-14 4-30 18-38-2 14 6 20 12 26 8 8 10 20 4 28-4 6-12 8-24 8z', class: 'il-api' }), el('path', { d: 'M60 104c-8 0-12-8-8-14 2 4 6 4 6 2 0-6 4-10 8-12 0 6 6 10 6 16 0 4-4 8-12 8z', class: 'il-api-dalam' })],
    ledakan: () => [el('path', { d: 'M60 8l8 22 20-12-6 22 24 2-20 14 16 18-24-4 2 24-18-16-16 16 2-24-24 4 16-18-20-14 24-2-6-22 20 12z', class: 'il-ledak' }), el('rect', { x: 50, y: 50, width: 20, height: 40, rx: 8, class: 'il-benda' })],
    tertimpa: () => [garisLantai(110), el('path', { d: 'M14 20h40M14 44h40M18 20v90M50 20v90', class: 'il-garis' }), el('rect', { x: 62, y: 18, width: 22, height: 18, rx: 2, class: 'il-benda', transform: 'rotate(18 73 27)' }), el('path', { d: 'M70 42l-2 8M78 40l0 8M86 42l2 8', class: 'il-panah' }), orang(76, 92, .9, 'berdiri', 'il-bahaya')],
    terjepit: () => [el('circle', { cx: 46, cy: 60, r: 22, class: 'il-roda' }), el('circle', { cx: 82, cy: 60, r: 16, class: 'il-roda' }), el('circle', { cx: 46, cy: 60, r: 6, class: 'il-benda' }), el('circle', { cx: 82, cy: 60, r: 5, class: 'il-benda' }), el('path', { d: 'M60 96c2-14 4-20 4-30h6c0 10 2 16 4 30', class: 'il-tangan' }), el('path', { d: 'M64 30l4-12M72 30l-4-12', class: 'il-panah' })],
    panas: () => [el('circle', { cx: 32, cy: 30, r: 14, class: 'il-matahari' }), el('path', { d: 'M32 8v-6M32 58v-6M10 30H4M60 30h-6M16 14l-4-4M48 46l4 4M48 14l4-4M16 46l-4 4', class: 'il-sinar' }), garisLantai(110), orang(76, 94, .95, 'berdiri'), el('path', { d: 'M90 54c2 3 3 5 3 6a3 3 0 0 1-6 0c0-1 1-3 3-6z', class: 'il-tetes' }), el('rect', { x: 100, y: 46, width: 8, height: 40, rx: 4, class: 'il-benda' }), el('circle', { cx: 104, cy: 88, r: 7, class: 'il-tanda' })],
    bising: () => [el('path', { d: 'M18 50h14l18-16v52L32 70H18z', class: 'il-benda' }), el('path', { d: 'M60 46c6 6 6 22 0 28M70 38c12 12 12 32 0 44M80 30c18 18 18 42 0 60', class: 'il-gelombang' }), el('path', { d: 'M98 52c0-10 14-10 14 2 0 8-8 8-8 16 0 6-6 6-8 2', class: 'il-garis' })],
    biologi: () => [el('path', { d: 'M24 96l50-50M66 38l16 16M74 30l20 20M90 14l-8 8M86 20l14 14', class: 'il-garis' }), el('rect', { x: 34, y: 58, width: 40, height: 14, rx: 2, class: 'il-benda', transform: 'rotate(-45 54 65)' }), el('path', { d: 'M24 96l-8 8', class: 'il-panah' }), el('circle', { cx: 92, cy: 88, r: 12, class: 'il-tanda' }), el('circle', { cx: 92, cy: 88, r: 4, class: 'il-benda' })],
    ergonomi: () => [garisLantai(110), orang(54, 92, 1, 'membungkuk'), el('rect', { x: 70, y: 88, width: 26, height: 20, rx: 2, class: 'il-benda' }), el('circle', { cx: 60, cy: 72, r: 6, class: 'il-tanda' })],
    licin: () => [garisLantai(110), el('ellipse', { cx: 62, cy: 108, rx: 30, ry: 4, class: 'il-genangan' }), orang(62, 92, 1, 'tergelincir', 'il-bahaya'), el('path', { d: 'M92 30l12 20H80z', class: 'il-rambu' })],
    ruang: () => [el('ellipse', { cx: 60, cy: 40, rx: 30, ry: 8, class: 'il-benda' }), el('path', { d: 'M30 40v56c0 4 14 8 30 8s30-4 30-8V40', class: 'il-garis' }), el('path', { d: 'M44 80c4-6 10-6 14 0s10 6 14 0M44 66c4-6 10-6 14 0s10 6 14 0', class: 'il-uap' }), el('path', { d: 'M60 4v26', class: 'il-garis' })],
    radiasi: () => [el('circle', { cx: 60, cy: 60, r: 8, class: 'il-benda' }), [0, 120, 240].map(a => el('path', { d: 'M60 60L60 22A38 38 0 0 1 92.9 41z', class: 'il-tanda', transform: `rotate(${a + 30} 60 60)` }))],
    psikososial: () => [el('path', { d: 'M16 24h52v32H38l-12 10V56H16z', class: 'il-benda' }), el('path', { d: 'M52 62h52v30H94v10L82 92H52z', class: 'il-tanda' }), el('path', { d: 'M42 32v12M42 50v2', class: 'il-garis' })],
    limbah: () => [el('path', { d: 'M30 34h60l-6 72H36z', class: 'il-benda' }), el('path', { d: 'M24 34h72M50 34v-8h20v8', class: 'il-garis' }), el('circle', { cx: 60, cy: 70, r: 12, class: 'il-tanda' })],
    hujan: () => [el('path', { d: 'M28 58a16 16 0 0 1 4-31 22 22 0 0 1 42-4 18 18 0 0 1 18 35z', class: 'il-awan' }), [36, 54, 72, 90].map((x, i) => el('path', { d: `M${x} ${70 + (i % 2) * 6}l-6 14`, class: 'il-hujan' }))],
    angin: () => [el('path', { d: 'M10 40h66a12 12 0 1 0-12-12M10 62h88a12 12 0 1 1-12 12M10 84h50', class: 'il-gelombang' })],
    petir: () => [el('path', { d: 'M28 56a16 16 0 0 1 4-31 22 22 0 0 1 42-4 18 18 0 0 1 18 35z', class: 'il-awan' }), el('path', { d: 'M62 52l-14 26h12l-8 26 24-34H64l8-18z', class: 'il-petir' })]
  };
  const PETA_IL = { ketinggian: 'ketinggian', listrik: 'listrik', kimia: 'kimia', kebakaran: 'api', api: 'api', ledakan: 'ledakan', tertimpa: 'tertimpa', terjepit: 'terjepit', panas: 'panas', bising: 'bising', biologi: 'biologi', ergonomi: 'ergonomi', licin: 'licin', ruang_terbatas: 'ruang', ruang: 'ruang', radiasi: 'radiasi', psikososial: 'psikososial', limbah: 'limbah', hujan: 'hujan', angin: 'angin', petir: 'petir' };
  function ilustrasi(id, opsi) {
    opsi = opsi || {}; const kunci = PETA_IL[id] || 'api';
    const s = akar(120, 120, opsi.label || ('Ilustrasi ' + kunci), 'il il-' + kunci + (opsi.serius ? ' il-serius' : '') + (opsi.animasi === false ? '' : ' il-anim'));
    if (opsi.serius) s.appendChild(el('rect', { x: 2, y: 2, width: 116, height: 116, rx: 14, class: 'il-bingkai-serius' }));
    (ADEGAN[kunci] || ADEGAN.api)().flat(Infinity).forEach(c => s.appendChild(c));
    return s;
  }
  // Rambu peringatan bergaya ISO 7010 (segitiga) — untuk bahaya serius/fatal (tegas, tidak lucu)
  function rambu(id, label) {
    const s = akar(120, 108, 'Rambu peringatan: ' + (label || id), 'rambu');
    s.appendChild(el('path', { d: 'M60 6L114 100H6z', class: 'rambu-segitiga' }));
    const g = el('g', { transform: 'translate(33 40) scale(.45)' }); (ADEGAN[PETA_IL[id] || 'api'] || ADEGAN.api)().flat(Infinity).forEach(c => g.appendChild(c));
    s.appendChild(g); return s;
  }
  // Maskot edukasi "Si Aman" (untuk tips risiko rendah–sedang saja)
  function maskot(ekspresi) {
    const s = akar(90, 90, 'Si Aman, maskot keselamatan', 'maskot');
    s.appendChild(el('circle', { cx: 45, cy: 50, r: 30, class: 'mk-wajah' }));
    s.appendChild(el('path', { d: 'M15 44a30 30 0 0 1 60 0z', class: 'mk-helm' }));
    s.appendChild(el('rect', { x: 12, y: 40, width: 66, height: 7, rx: 3.5, class: 'mk-helm' }));
    s.appendChild(el('circle', { cx: 35, cy: 56, r: 3.5, class: 'mk-mata' })); s.appendChild(el('circle', { cx: 55, cy: 56, r: 3.5, class: 'mk-mata' }));
    s.appendChild(el('path', { d: ekspresi === 'cemas' ? 'M36 70q9-6 18 0' : 'M35 66q10 9 20 0', class: 'mk-mulut' }));
    s.appendChild(el('path', { d: 'M40 30h10M45 25v10', class: 'mk-salib' }));
    return s;
  }

  window.K3Grafik = { batang, kolom, garis, donat, heatmap, matriks, piramida, ilustrasi, rambu, maskot };
})();
