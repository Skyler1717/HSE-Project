/* qr.js — Pembuat kode QR kecil tanpa pustaka luar (mode byte, koreksi galat M, versi 1–6).
   Cukup untuk alamat aplikasi + kode unit (maks. 106 byte). Hasil: matriks boolean. */
(function () {
  'use strict';
  // [jumlah kodeword EC per blok, jumlah blok, kodeword data per blok]
  const TABEL_M = { 1: [10, 1, 16], 2: [16, 1, 28], 3: [26, 1, 44], 4: [18, 2, 32], 5: [24, 2, 43], 6: [16, 4, 27] };
  const ALIGN = { 1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34] };

  // Aritmetika Galois Field 256
  const EXP = new Array(512), LOG = new Array(256);
  (function () { let x = 1; for (let i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11d; } for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255]; })();
  const mul = (a, b) => (a === 0 || b === 0) ? 0 : EXP[LOG[a] + LOG[b]];
  function polaGenerator(n) {
    let g = [1];
    for (let i = 0; i < n; i++) {
      const next = new Array(g.length + 1).fill(0);
      for (let j = 0; j < g.length; j++) { next[j] ^= g[j]; next[j + 1] ^= mul(g[j], EXP[i]); }
      g = next;
    }
    return g;
  }
  function kodeEC(data, n) {
    const gen = polaGenerator(n), res = data.concat(new Array(n).fill(0));
    for (let i = 0; i < data.length; i++) {
      const c = res[i]; if (c === 0) continue;
      for (let j = 0; j < gen.length; j++) res[i + j] ^= mul(gen[j], c);
    }
    return res.slice(data.length);
  }

  function buat(teks) {
    const bytes = Array.from(new TextEncoder().encode(teks));
    let ver = 0;
    for (let v = 1; v <= 6; v++) { const t = TABEL_M[v]; if (t[1] * t[2] - 2 >= bytes.length) { ver = v; break; } }
    if (!ver) throw new Error('Teks terlalu panjang untuk kode QR (maks. 106 karakter)');
    const [ecLen, nBlok, dataPerBlok] = TABEL_M[ver], kapasitas = nBlok * dataPerBlok;
    // Bit stream: mode byte (0100), panjang 8 bit, data, terminator, padding
    const bits = [];
    const tulis = (val, len) => { for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
    tulis(4, 4); tulis(bytes.length, 8); bytes.forEach(b => tulis(b, 8));
    tulis(0, Math.min(4, kapasitas * 8 - bits.length));
    while (bits.length % 8) bits.push(0);
    const data = [];
    for (let i = 0; i < bits.length; i += 8) data.push(parseInt(bits.slice(i, i + 8).join(''), 2));
    for (let p = 0; data.length < kapasitas; p++) data.push(p % 2 ? 0x11 : 0xec);
    // Bagi blok, hitung EC, sisipkan
    const blokData = [], blokEC = [];
    for (let b = 0; b < nBlok; b++) { const d = data.slice(b * dataPerBlok, (b + 1) * dataPerBlok); blokData.push(d); blokEC.push(kodeEC(d, ecLen)); }
    const akhir = [];
    for (let i = 0; i < dataPerBlok; i++) blokData.forEach(d => akhir.push(d[i]));
    for (let i = 0; i < ecLen; i++) blokEC.forEach(e => akhir.push(e[i]));

    const n = ver * 4 + 17;
    const m = [], cadang = [];
    for (let i = 0; i < n; i++) { m.push(new Array(n).fill(false)); cadang.push(new Array(n).fill(false)); }
    const set = (r, c, v) => { m[r][c] = v; cadang[r][c] = true; };
    function finder(r, c) {
      for (let i = -1; i <= 7; i++) for (let j = -1; j <= 7; j++) {
        const rr = r + i, cc = c + j; if (rr < 0 || cc < 0 || rr >= n || cc >= n) continue;
        const di = (i >= 0 && i <= 6 && (j === 0 || j === 6)) || (j >= 0 && j <= 6 && (i === 0 || i === 6)) || (i >= 2 && i <= 4 && j >= 2 && j <= 4);
        set(rr, cc, di);
      }
    }
    finder(0, 0); finder(0, n - 7); finder(n - 7, 0);
    for (let i = 8; i < n - 8; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
    const al = ALIGN[ver];
    for (const r of al) for (const c of al) {
      if (cadang[r][c]) continue;
      for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) set(r + i, c + j, Math.max(Math.abs(i), Math.abs(j)) !== 1);
    }
    // Cadangkan area format + modul gelap
    for (let i = 0; i < 9; i++) { if (!cadang[8][i]) set(8, i, false); if (!cadang[i][8]) set(i, 8, false); }
    for (let i = 0; i < 8; i++) { set(8, n - 1 - i, false); set(n - 1 - i, 8, false); }
    set(n - 8, 8, true);
    // Tempatkan data (zig-zag)
    const dataBits = [];
    akhir.forEach(b => { for (let i = 7; i >= 0; i--) dataBits.push((b >>> i) & 1); });
    let idx = 0, naik = true;
    for (let c = n - 1; c > 0; c -= 2) {
      if (c === 6) c--;
      for (let k = 0; k < n; k++) {
        const r = naik ? n - 1 - k : k;
        for (let d = 0; d < 2; d++) {
          const cc = c - d;
          if (cadang[r][cc]) continue;
          m[r][cc] = idx < dataBits.length ? dataBits[idx] === 1 : false; idx++;
        }
      }
      naik = !naik;
    }
    const MASK = [
      (r, c) => (r + c) % 2 === 0, (r) => r % 2 === 0, (r, c) => c % 3 === 0, (r, c) => (r + c) % 3 === 0,
      (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0, (r, c) => (r * c) % 2 + (r * c) % 3 === 0,
      (r, c) => ((r * c) % 2 + (r * c) % 3) % 2 === 0, (r, c) => ((r + c) % 2 + (r * c) % 3) % 2 === 0];
    function bitsFormat(mask) {
      const d = (0 << 3) | mask; // M = 00
      let v = d << 10;
      for (let i = 14; i >= 10; i--) if ((v >>> i) & 1) v ^= 0x537 << (i - 10);
      return ((d << 10) | v) ^ 0x5412;
    }
    function terapkan(mask) {
      const x = m.map(r => r.slice());
      for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (!cadang[r][c] && MASK[mask](r, c)) x[r][c] = !x[r][c];
      const f = bitsFormat(mask);
      const bit = i => ((f >>> i) & 1) === 1;
      // salinan pertama (dekat pola kiri-atas)
      for (let i = 0; i <= 5; i++) x[i][8] = bit(i);
      x[7][8] = bit(6); x[8][8] = bit(7); x[8][7] = bit(8);
      for (let i = 9; i < 15; i++) x[8][14 - i] = bit(i);
      // salinan kedua
      for (let i = 0; i < 8; i++) x[8][n - 1 - i] = bit(i);
      for (let i = 8; i < 15; i++) x[n - 15 + i][8] = bit(i);
      x[n - 8][8] = true;
      return x;
    }
    function penalti(x) {
      let p = 0;
      for (let r = 0; r < n; r++) for (const baris of [true, false]) {
        let run = 1;
        for (let c = 1; c < n; c++) {
          const a = baris ? x[r][c] : x[c][r], b = baris ? x[r][c - 1] : x[c - 1][r];
          if (a === b) { run++; if (run === 5) p += 3; else if (run > 5) p++; } else run = 1;
        }
      }
      for (let r = 0; r < n - 1; r++) for (let c = 0; c < n - 1; c++) {
        const v = x[r][c]; if (v === x[r + 1][c] && v === x[r][c + 1] && v === x[r + 1][c + 1]) p += 3;
      }
      let gelap = 0; x.forEach(r => r.forEach(v => { if (v) gelap++; }));
      p += Math.floor(Math.abs(gelap * 20 - n * n * 10) / (n * n)) * 10;
      return p;
    }
    let terbaik = null, pMin = Infinity;
    for (let k = 0; k < 8; k++) { const x = terapkan(k), p = penalti(x); if (p < pMin) { pMin = p; terbaik = x; } }
    return terbaik;
  }

  // Menghasilkan elemen <svg> (aman: tanpa innerHTML)
  function svg(teks, ukuran) {
    const mat = buat(teks), n = mat.length, tepi = 4, total = n + tepi * 2;
    const NS = 'http://www.w3.org/2000/svg';
    const el = document.createElementNS(NS, 'svg');
    el.setAttribute('viewBox', '0 0 ' + total + ' ' + total);
    el.setAttribute('width', ukuran || 220); el.setAttribute('height', ukuran || 220);
    el.setAttribute('role', 'img'); el.setAttribute('aria-label', 'Kode QR');
    const bg = document.createElementNS(NS, 'rect');
    bg.setAttribute('width', total); bg.setAttribute('height', total); bg.setAttribute('fill', '#fff');
    el.appendChild(bg);
    let d = '';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (mat[r][c]) d += 'M' + (c + tepi) + ' ' + (r + tepi) + 'h1v1h-1z';
    const path = document.createElementNS(NS, 'path');
    path.setAttribute('d', d); path.setAttribute('fill', '#000');
    el.appendChild(path);
    return el;
  }
  window.K3QR = { buat, svg };
})();
