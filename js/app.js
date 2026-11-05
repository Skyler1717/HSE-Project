/* app.js — Tampilan dan alur aplikasi "Lapor K3".
   Semua teks dari pengguna ditampilkan dengan textContent (bukan innerHTML) agar aman dari XSS. */
(function () {
  'use strict';
  const API = window.K3Api, AS = window.K3Asisten, QR = window.K3QR;
  const $app = document.getElementById('app');
  const S = { sesi: null, ref: null, cacheLaporan: null };

  // ---------- Label ----------
  const STATUS = { baru: 'Baru', ditugaskan: 'Ditugaskan', dalam_tindak_lanjut: 'Sedang ditangani', terkendali_sementara: 'Terkendali sementara', tertutup: 'Tertutup', tidak_dilanjutkan: 'Tidak dilanjutkan' };
  const STATUS_KET = { baru: 'Diterima, menunggu tim K3RS', ditugaskan: 'Sudah ada penanggung jawab dan tanggal target', dalam_tindak_lanjut: 'Perbaikan sedang dikerjakan', terkendali_sementara: 'Baru dikendalikan dengan APD/aturan; perbaikan fisik masih diperlukan', tertutup: 'Bahaya sudah diperbaiki secara fisik dan diverifikasi', tidak_dilanjutkan: 'Tidak dilanjutkan (lihat alasan)' };
  const JENIS = { bahaya: 'Bahaya / kondisi tidak aman', nyaris_celaka: 'Nyaris celaka', kejadian: 'Kejadian / cedera' };
  const LEVEL = { eliminasi: 'Eliminasi (hilangkan bahaya)', substitusi: 'Substitusi (ganti yang lebih aman)', rekayasa: 'Rekayasa teknik (perbaiki/ubah fisik)', administratif: 'Administratif (aturan, rambu, pelatihan)', apd: 'APD (alat pelindung diri)' };
  const PERAN = { petugas: 'Petugas', pj_unit: 'Penanggung jawab unit', k3rs: 'K3RS / Admin' };
  const IKON_KAT = { biologi: 'virus', kimia: 'labu', fisik: 'tetes', ergonomi: 'angkat', psikososial: 'pesan', mekanik: 'petir', kebakaran: 'api', limbah: 'sampah' };

  // ---------- Ikon garis (SVG, dibuat lewat DOM; tanpa innerHTML) ----------
  // Bergaya garis 24×24; sebagian bentuk mengikuti gaya set ikon Lucide (lisensi ISC).
  // Kode: 'c x,y,r' = lingkaran, 'r x,y,w,h,rx' = persegi, selainnya = path.
  const IK = {
    beranda: ['M3 10.5 12 3l9 7.5', 'M5 9.5V21h14V9.5', 'M10 21v-6h4v6'],
    tambah: ['M12 5v14', 'M5 12h14'],
    dokumen: ['M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z', 'M14 3v6h6', 'M8 13h8', 'M8 17h5'],
    bantuan: ['c12,12,9', 'M9.1 9a3 3 0 0 1 5.8 1c0 2-3 2.5-3 4', 'M12 17.5h.01'],
    pengguna: ['c12,8,4', 'M4 21a8 8 0 0 1 16 0'],
    tugas: ['r8,2,8,4,1', 'M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2', 'M12 11h4', 'M12 16h4', 'M8 11h.01', 'M8 16h.01'],
    grafik: ['M3 3v18h18', 'M8 17v-4', 'M13 17V9', 'M18 17V6'],
    atur: ['M4 21v-7', 'M4 10V3', 'M12 21v-9', 'M12 8V3', 'M20 21v-5', 'M20 12V3', 'M2 14h4', 'M10 8h4', 'M18 16h4'],
    daftar: ['M8 6h13', 'M8 12h13', 'M8 18h13', 'M3 6h.01', 'M3 12h.01', 'M3 18h.01'],
    kunci: ['c7.5,15.5,4.5', 'M10.7 12.3 21 2', 'M16 7l3 3', 'M19 4l2 2'],
    robot: ['M12 8V4H8', 'r4,8,16,12,2', 'M2 14h2', 'M20 14h2', 'M15 13v2', 'M9 13v2'],
    kamera: ['M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z', 'c12,13,3'],
    mik: ['r9,2,6,12,3', 'M19 10v1a7 7 0 0 1-14 0v-1', 'M12 18v4'],
    unduh: ['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', 'M7 10l5 5 5-5', 'M12 15V3'],
    cetak: ['M6 9V2h12v7', 'M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2', 'r6,14,12,8,1'],
    orang: ['c9,7,4', 'M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2', 'M16 3.13a4 4 0 0 1 0 7.75', 'M21 21v-2a4 4 0 0 0-3-3.85'],
    qr: ['r3,3,7,7,1', 'r14,3,7,7,1', 'r3,14,7,7,1', 'M14 14h3v3h-3z', 'M21 14v.01', 'M14 21h7', 'M21 17v4'],
    riwayat: ['M3 12a9 9 0 1 0 3-6.7L3 8', 'M3 3v5h5', 'M12 7v5l3 2'],
    paket: ['M16.5 9.4 7.5 4.2', 'M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4a2 2 0 0 0 1-1.7z', 'M3.3 7 12 12l8.7-5', 'M12 22V12'],
    perisai: ['M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z', 'M12 8v4', 'M12 16h.01'],
    awas: ['M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h16.9a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z', 'M12 9v4', 'M12 17h.01'],
    centang: ['M20 6 9 17l-5-5'],
    silang: ['M18 6 6 18', 'M6 6l12 12'],
    kiri: ['M19 12H5', 'M12 19l-7-7 7-7'],
    kanan: ['M9 18l6-6-6-6'],
    keluar: ['M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4', 'M16 17l5-5-5-5', 'M21 12H9'],
    gembok: ['r4,11,16,10,2', 'M8 11V7a4 4 0 0 1 8 0v4'],
    jam: ['c12,12,9', 'M12 7v5l3 2'],
    kalender: ['r3,5,18,16,2', 'M16 3v4', 'M8 3v4', 'M3 10h18'],
    lokasi: ['M12 22s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z', 'c12,10,2.5'],
    gedung: ['M3 21h18', 'M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16', 'M9 7h2', 'M13 7h2', 'M9 11h2', 'M13 11h2', 'M10 21v-4h4v4'],
    kotakmasuk: ['M22 12h-6l-2 3h-4l-2-3H2', 'M5.5 5.1 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.8 4H7.2a2 2 0 0 0-1.7 1.1z'],
    berhasil: ['c12,12,9', 'M8.5 12.5l2.5 2.5 5-5'],
    larang: ['M7.9 2h8.2L22 7.9v8.2L16.1 22H7.9L2 16.1V7.9z', 'M12 8v4', 'M12 16h.01'],
    info: ['c12,12,9', 'M12 16v-4', 'M12 8h.01'],
    kirim: ['M22 2 11 13', 'M22 2l-7 20-4-9-9-4z'],
    mata: ['M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z', 'c12,12,3'],
    muat: ['M21 12a9 9 0 1 1-2.6-6.4L21 8', 'M21 3v5h-5'],
    hapus: ['M3 6h18', 'M8 6V4h8v2', 'M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6', 'M10 11v6', 'M14 11v6'],
    salin: ['r9,9,12,12,2', 'M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1'],
    pensil: ['M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z'],
    simpan: ['M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z', 'M17 21v-8H7v8', 'M7 3v5h8'],
    lonceng: ['M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9', 'M10.3 21a1.9 1.9 0 0 0 3.4 0'],
    sinyal: ['M2 8.8a15 15 0 0 1 20 0', 'M5 12.9a10 10 0 0 1 14 0', 'M8.5 16.4a5 5 0 0 1 7 0', 'M12 20h.01'],
    putus: ['M2 2l20 20', 'M8.5 16.5a5 5 0 0 1 7 0', 'M2 8.8a15 15 0 0 1 4.2-2.7', 'M10.7 5.1A15 15 0 0 1 22 8.8', 'M5 12.9a10 10 0 0 1 5.2-2.8', 'M16.8 10.9a10 10 0 0 1 2.2 2', 'M12 20h.01'],
    lapisan: ['M12 2 2 7l10 5 10-5z', 'M2 17l10 5 10-5', 'M2 12l10 5 10-5'],
    kisi: ['r3,3,7,7,1', 'r14,3,7,7,1', 'r14,14,7,7,1', 'r3,14,7,7,1'],
    target: ['c12,12,9', 'c12,12,5', 'c12,12,1'],
    tanda: ['M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z', 'M4 22v-7'],
    virus: ['c12,12,4', 'M12 2v4', 'M12 18v4', 'M2 12h4', 'M18 12h4', 'M4.9 4.9l2.8 2.8', 'M16.3 16.3l2.8 2.8', 'M4.9 19.1l2.8-2.8', 'M16.3 7.7l2.8-2.8'],
    labu: ['M9 3h6', 'M10 3v6.5L4.6 18.4A1.7 1.7 0 0 0 6 21h12a1.7 1.7 0 0 0 1.4-2.6L14 9.5V3', 'M7 15h10'],
    tetes: ['M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z', 'M9.5 14.5a2.5 2.5 0 0 0 2.5 2.5'],
    angkat: ['c8,4.5,2', 'M8 7v6l-3 8', 'M8 13l3 8', 'M8 9l5 2', 'r13,8,8,6,1'],
    pesan: ['M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z', 'M12 7v4', 'M12 14h.01'],
    petir: ['M13 2 3 14h9l-1 8 10-12h-9z'],
    api: ['M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.4-.5-2-1-3-1.1-2.1-.2-4 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.2.4-2.3 1-3.3.4 1.4 1.4 2.8 2.5 2.8z'],
    sampah: ['M3 6h18', 'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6', 'M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2', 'M10 11v6', 'M14 11v6']
  };
  const NS_SVG = 'http://www.w3.org/2000/svg';
  function ikon(nama, kls) {
    const s = document.createElementNS(NS_SVG, 'svg');
    s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('class', 'ik' + (kls ? ' ' + kls : ''));
    s.setAttribute('aria-hidden', 'true'); s.setAttribute('focusable', 'false');
    (IK[nama] || IK.info).forEach(d => {
      let el;
      if (d[0] === 'c') { const [x, y, r] = d.slice(1).split(','); el = document.createElementNS(NS_SVG, 'circle'); el.setAttribute('cx', x); el.setAttribute('cy', y); el.setAttribute('r', r); }
      else if (d[0] === 'r') { const [x, y, w, hh, rx] = d.slice(1).split(','); el = document.createElementNS(NS_SVG, 'rect'); el.setAttribute('x', x); el.setAttribute('y', y); el.setAttribute('width', w); el.setAttribute('height', hh); el.setAttribute('rx', rx || 0); }
      else { el = document.createElementNS(NS_SVG, 'path'); el.setAttribute('d', d); }
      s.appendChild(el);
    });
    return s;
  }
  const ikonKat = kode => ikon(IKON_KAT[kode] || 'awas');

  // ---------- Alat bantu ----------
  function h(tag, a, ...anak) {
    const el = document.createElement(tag);
    if (a) for (const [k, v] of Object.entries(a)) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k === 'value') el.value = v;
      else if (k === 'checked') el.checked = !!v;
      else el.setAttribute(k, v === true ? '' : v);
    }
    anak.flat(Infinity).forEach(c => { if (c === null || c === undefined || c === false) return; el.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c); });
    return el;
  }
  const LS = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* penuh/diblokir */ } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* */ } }
  };
  const SS = { get(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { sessionStorage.setItem(k, v); } catch (e) { /* */ } }, del(k) { try { sessionStorage.removeItem(k); } catch (e) { /* */ } } };
  const tgl = d => { if (!d) return '—'; const x = new Date(String(d).length === 10 ? d + 'T00:00:00' : d); return isNaN(x) ? String(d) : x.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }); };
  const hariIni = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const namaUnit = id => ((S.ref && S.ref.unit.find(u => String(u.id) === String(id))) || {}).nama || '—';
  const kat = kode => (S.ref && S.ref.kategori.find(k => k.kode === kode)) || { nama: kode, kode };
  const peran = () => S.sesi && S.sesi.profil && S.sesi.profil.aktif ? S.sesi.profil.peran : null;
  const tingkat = skor => { if (skor == null) return 'Belum dinilai'; const p = (S.ref.pengaturan.pita_risiko || []).slice().sort((a, b) => a.maks - b.maks); return (p.find(x => skor <= x.maks) || {}).label || '—'; };

  // Kelas warna tingkat risiko berdasarkan urutan pita (bukan nama label): rk-0 terendah … rk-3 tertinggi
  const kelasTingkat = skor => {
    if (skor == null || !S.ref) return 'rk-x';
    const p = (S.ref.pengaturan.pita_risiko || []).slice().sort((a, b) => a.maks - b.maks);
    const i = p.findIndex(x => skor <= x.maks); if (i < 0) return 'rk-x';
    return 'rk-' + Math.min(3, Math.round(i * 3 / Math.max(1, p.length - 1)));
  };
  const badgeTingkat = skor => badge(skor == null ? 'Belum dinilai' : 'Risiko ' + tingkat(skor) + ' · ' + skor, kelasTingkat(skor));
  const inisial = n => String(n || '?').trim().split(/\s+/).slice(0, 2).map(x => x[0]).join('').toUpperCase() || '?';
  function kosong(teks) { return h('div', { class: 'kosong-wadah' }, h('div', { class: 'motif-kecil', 'aria-hidden': 'true' }), h('p', { class: 'kosong', text: teks })); }

  function toast(pesan, jenis) {
    let w = document.querySelector('.toast-wadah');
    if (!w) { w = h('div', { class: 'toast-wadah', 'aria-live': 'polite' }); document.body.appendChild(w); }
    const t = h('div', { class: 'toast ' + (jenis || ''), role: jenis === 'galat' ? 'alert' : 'status' },
      ikon(jenis === 'galat' ? 'larang' : jenis === 'ok' ? 'berhasil' : 'info'), h('span', { text: pesan }));
    w.appendChild(t); setTimeout(() => t.remove(), jenis === 'galat' ? 6000 : 3500);
  }
  // Dialog konfirmasi untuk tindakan penting (tutup, batalkan, keluar, hapus). Mengembalikan true/false.
  function konfirmasi(judul, pesan, labelYa, bahaya) {
    return new Promise(selesai => {
      const d = h('dialog', { class: 'dialog', 'aria-labelledby': 'dlg-judul' });
      if (typeof d.showModal !== 'function') { selesai(window.confirm(judul + '\n\n' + pesan)); return; }
      const tutup = v => { d.close(); d.remove(); selesai(v); };
      d.append(h('div', { class: 'dialog-isi' }, h('div', { class: 'dialog-ikon' + (bahaya ? ' bahaya' : '') }, ikon(bahaya ? 'awas' : 'info')),
        h('h2', { id: 'dlg-judul', text: judul }), h('p', { text: pesan })),
        h('div', { class: 'dialog-aksi' }, tombol('Batal', () => tutup(false), 'kedua'), tombol(labelYa || 'Ya, lanjutkan', () => tutup(true), 'utama', { 'data-ya': '1' })));
      d.addEventListener('cancel', e => { e.preventDefault(); tutup(false); });
      document.body.appendChild(d); d.showModal();
    });
  }
  function tampil(...isi) {
    $app.replaceChildren(...isi.flat(Infinity).filter(x => x !== null && x !== undefined && x !== false));
    window.scrollTo(0, 0);
    const judul = $app.querySelector('h1'); if (judul) { judul.setAttribute('tabindex', '-1'); judul.focus({ preventScroll: true }); }
  }
  function pergi(rute) { if (location.hash === '#' + rute) jalankan(); else location.hash = rute; }
  const badge = (teks, kls) => h('span', { class: 'badge ' + (kls || ''), text: teks });
  const badgeStatus = s => badge(STATUS[s] || s, 'st-' + s);
  function tombol(teks, aksi, kls, attr) { return h('button', Object.assign({ type: 'button', class: 'btn ' + (kls || ''), onclick: aksi }, attr || {}), teks); }
  async function sibuk(btn, fn) {
    let isiAsli = null;
    if (btn) { btn.disabled = true; isiAsli = Array.from(btn.childNodes); btn.setAttribute('aria-busy', 'true'); btn.replaceChildren(h('span', { class: 'putar', 'aria-hidden': 'true' }), 'Memproses…'); }
    try { return await fn(); } catch (e) { toast(e.message || String(e), 'galat'); throw e; }
    finally { if (btn) { btn.disabled = false; btn.removeAttribute('aria-busy'); btn.replaceChildren(...isiAsli); } }
  }
  function bidang(label, input, bantuan) { return h('label', { class: 'bidang' }, h('span', { class: 'label', text: label }), input, bantuan ? h('small', { class: 'bantu', text: bantuan }) : null); }
  function pilih(opsi, nilai, attr) {
    const s = h('select', attr || {});
    opsi.forEach(([v, t]) => { const o = h('option', { value: v, text: t }); if (String(v) === String(nilai)) o.selected = true; s.appendChild(o); });
    return s;
  }
  function kodeLacakBaru() {
    const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; const b = new Uint8Array(12); crypto.getRandomValues(b);
    const s = Array.from(b, x => A[x % 32]).join(''); return s.slice(0, 4) + '-' + s.slice(4, 8) + '-' + s.slice(8);
  }
  async function kecilkanFoto(file) {
    if (!/^image\/(jpeg|png|webp|heic|heif)$/i.test(file.type) && !/\.(jpe?g|png|webp|heic)$/i.test(file.name)) throw new Error('Hanya foto (JPG/PNG/WEBP) yang boleh diunggah');
    if (file.size > 15 * 1024 * 1024) throw new Error('Foto terlalu besar (maks. 15 MB sebelum diperkecil)');
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((ok, gagal) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => gagal(new Error('Foto tidak dapat dibaca')); i.src = url; });
      const maks = 1280, r = Math.min(1, maks / Math.max(img.width, img.height));
      const c = document.createElement('canvas'); c.width = Math.round(img.width * r); c.height = Math.round(img.height * r);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); // menggambar ulang = data lokasi (EXIF) terbuang
      const blob = await new Promise(ok => c.toBlob(ok, 'image/jpeg', 0.72));
      if (!blob || blob.size > 5 * 1024 * 1024) throw new Error('Foto tetap terlalu besar setelah diperkecil');
      return blob;
    } finally { URL.revokeObjectURL(url); }
  }
  const blobKeDataUrl = b => new Promise(ok => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(b); });
  async function dataUrlKeBlob(u) { return (await fetch(u)).blob(); }

  // ---------- Antrean offline ----------
  const KUNCI_ANTREAN = 'k3_antrean', KUNCI_DRAF = 'k3_draf';
  async function kirimAntrean() {
    const q = LS.get(KUNCI_ANTREAN, []); if (!q.length || !S.sesi || !navigator.onLine) return;
    const sisa = [];
    for (const item of q) {
      try {
        if (item.foto && !item.data.foto_path) item.data.foto_path = await API.unggahFoto(await dataUrlKeBlob(item.foto));
        await API.kirimLaporan(item.data);
      } catch (e) { if (e.jaringan) { sisa.push(item); } else { item.galat = e.message; sisa.push(item); } }
    }
    LS.set(KUNCI_ANTREAN, sisa);
    const terkirim = q.length - sisa.length;
    if (terkirim > 0) { toast(terkirim + ' laporan dari antrean berhasil dikirim', 'ok'); S.cacheLaporan = null; }
  }
  window.addEventListener('online', () => kirimAntrean());

  // ---------- Kerangka halaman ----------
  const logoImg = () => h('img', { src: 'assets/logo.png', alt: '', width: 36, height: 36 });
  const namaHSE = (putih, kls) => h('img', { src: putih ? 'assets/nama-hse-putih.svg' : 'assets/nama-hse.svg', alt: 'HSE', class: 'merek-hse' + (kls ? ' ' + kls : '') });
  // Penanda koneksi & antrean (memakai fitur antrean offline yang sudah ada)
  function penandaKoneksi() {
    const n = LS.get(KUNCI_ANTREAN, []).length;
    if (navigator.onLine && !n) return null;
    return h('span', { class: 'koneksi' + (navigator.onLine ? '' : ' luring'), role: 'status' },
      ikon(navigator.onLine ? 'kotakmasuk' : 'putus'), navigator.onLine ? n + ' menunggu dikirim' : 'Luring' + (n ? ' · ' + n + ' antrean' : ''));
  }
  function perbaruiKoneksi() { const w = document.querySelector('.bilah-kanan'); if (!w) return; const lama = w.querySelector('.koneksi'); const baru = penandaKoneksi(); if (lama) lama.remove(); if (baru) w.prepend(baru); }
  window.addEventListener('offline', perbaruiKoneksi); window.addEventListener('online', perbaruiKoneksi);

  function bilahAtas(judul, kembali) {
    return h('header', { class: 'bilah' },
      kembali ? h('button', { type: 'button', class: 'kembali', 'aria-label': 'Kembali', onclick: () => history.length > 1 ? history.back() : pergi('/beranda') }, ikon('kiri')) : h('span', { class: 'logo', 'aria-hidden': 'true' }, logoImg()),
      h('h1', { text: judul }),
      h('div', { class: 'bilah-kanan' }, penandaKoneksi(), API.mode === 'demo' ? badge('MODE DEMO', 'demo') : null));
  }
  function navBawah(aktif) {
    const p = peran(); if (!p) return null;
    const item = { petugas: [['/beranda', 'beranda', 'Beranda'], ['/lapor', 'tambah', 'Lapor'], ['/laporan-saya', 'dokumen', 'Laporan saya'], ['/bantuan', 'bantuan', 'Bantuan'], ['/akun', 'pengguna', 'Akun']],
      pj_unit: [['/beranda', 'beranda', 'Beranda'], ['/lapor', 'tambah', 'Lapor'], ['/tugas', 'tugas', 'Tugas'], ['/dasbor', 'grafik', 'Dasbor'], ['/akun', 'pengguna', 'Akun']],
      k3rs: [['/beranda', 'beranda', 'Beranda'], ['/semua', 'daftar', 'Laporan'], ['/dasbor', 'grafik', 'Dasbor'], ['/admin', 'atur', 'Admin'], ['/akun', 'pengguna', 'Akun']] }[p];
    return h('nav', { class: 'navbawah', 'aria-label': 'Menu utama' }, item.map(([r, i, t]) =>
      h('a', { href: '#' + r, class: aktif === r ? 'aktif' : '', 'aria-current': aktif === r ? 'page' : null }, ikon(i), h('span', { text: t }))));
  }
  // Sidebar desktop: hanya rute yang sudah ada dan diizinkan untuk peran (lihat HAK di bawah)
  function sidebar(aktif) {
    const p = peran(); if (!p) return null;
    const kini = (location.hash.slice(1) || '/beranda').split('?')[0];
    const tautan = (r, i, t, kls) => { const on = r === kini || (r === aktif && !SIDEBAR_SEMUA().includes(kini)); return h('a', { href: '#' + r, class: 'sb-tautan' + (kls ? ' ' + kls : '') + (on && !kls ? ' aktif' : ''), 'aria-current': on && !kls ? 'page' : null }, ikon(i), h('span', { text: t })); };
    const grup = (label, isi) => h('div', { class: 'sb-grup' }, label ? h('div', { class: 'sb-label', text: label }) : null, isi);
    const menu = [];
    menu.push(grup(null, [tautan('/lapor', 'tambah', 'Lapor bahaya', 'lapor'), tautan('/beranda', 'beranda', 'Beranda')]));
    if (p === 'k3rs') menu.push(grup('Pengelolaan', [tautan('/semua', 'daftar', 'Semua laporan'), tautan('/tugas', 'tugas', 'Tugas saya'), tautan('/dasbor', 'grafik', 'Dasbor')]));
    if (p === 'pj_unit') menu.push(grup('Unit saya', [tautan('/tugas', 'tugas', 'Tugas saya'), tautan('/semua', 'daftar', 'Laporan unit'), tautan('/dasbor', 'grafik', 'Dasbor'), tautan('/ekspor', 'unduh', 'Ekspor data')]));
    menu.push(grup('Pelaporan', [tautan('/laporan-saya', 'dokumen', 'Laporan saya'), tautan('/lacak', 'kunci', 'Lacak dengan kode'), tautan('/asisten', 'robot', 'Asisten K3')]));
    if (p === 'k3rs') menu.push(grup('Administrasi', [tautan('/pengguna', 'orang', 'Pengguna & peran'), tautan('/pengaturan', 'atur', 'Pengaturan'), tautan('/qr', 'qr', 'Kode QR unit'), tautan('/ekspor', 'unduh', 'Ekspor data'), tautan('/log', 'riwayat', 'Log aktivitas'), tautan('/admin', 'kisi', 'Semua menu admin')]));
    menu.push(grup('Lainnya', [tautan('/bantuan', 'bantuan', 'Bantuan'), tautan('/akun', 'pengguna', 'Akun')]));
    const nama = S.sesi.profil.nama_tampilan;
    return h('aside', { class: 'sidebar', 'aria-label': 'Navigasi samping' },
      h('a', { class: 'sb-merek', href: '#/beranda' }, logoImg(), h('span', { class: 'nama' }, namaHSE(true), h('span', { class: 'sub', text: (S.ref && S.ref.pengaturan.nama_instansi) || 'Sistem K3 rumah sakit' }))),
      h('nav', { 'aria-label': 'Menu utama (samping)' }, menu),
      h('div', { class: 'sb-motif', 'aria-hidden': 'true' }),
      h('div', { class: 'sb-pengguna' }, h('span', { class: 'avatar', 'aria-hidden': 'true', text: inisial(nama) }),
        h('div', { class: 'info-p' }, h('strong', { text: nama }), h('span', { text: PERAN[p] })),
        h('button', { type: 'button', class: 'sb-keluar', 'aria-label': 'Keluar', title: 'Keluar', onclick: mintaKeluar }, ikon('keluar'))));
  }
  const SIDEBAR_SEMUA = () => ['/lapor', '/beranda', '/semua', '/tugas', '/dasbor', '/ekspor', '/laporan-saya', '/lacak', '/asisten', '/pengguna', '/pengaturan', '/qr', '/log', '/admin', '/bantuan', '/akun'];
  function halaman(judul, rute, isi, opsi) {
    opsi = opsi || {};
    return [h('div', { class: 'kerangka' }, sidebar(rute),
      h('div', { class: 'kolom' }, bilahAtas(judul, opsi.kembali), h('main', { class: 'isi' + (opsi.sempit ? ' sempit' : ''), id: 'konten' }, isi))),
      navBawah(rute), tombolAsisten()];
  }
  function peringatanData() {
    return h('p', { class: 'catatan-data' }, ikon('awas'), h('span', { text: 'Uji coba hanya dengan DATA CONTOH. Data nyata baru boleh dipakai setelah persetujuan etik dan keputusan pengelola data rumah sakit.' }));
  }

  // ---------- Masuk ----------
  function hMasuk() {
    const email = h('input', { type: 'email', autocomplete: 'username', required: true, inputmode: 'email', maxlength: 120 });
    const sandi = h('input', { type: 'password', autocomplete: 'current-password', required: true, maxlength: 72 });
    const btn = h('button', { type: 'submit', class: 'btn utama besar' }, 'MASUK');
    const form = h('form', { class: 'kartu', onsubmit: async e => {
      e.preventDefault();
      await sibuk(btn, async () => { await API.masuk(email.value, sandi.value); sandi.value = ''; await muatSesi(); pergi(SS.get('k3_tujuan') || '/beranda'); SS.del('k3_tujuan'); }).catch(() => {});
    } }, h('div', {}, h('h1', { text: 'Masuk' }), h('p', { class: 'kecil', text: 'Gunakan akun yang diberikan admin K3RS.' })),
      bidang('Email', email), bidang('Kata sandi', sandi), btn,
      h('p', { class: 'kecil', text: 'Lupa kata sandi atau belum punya akun? Hubungi admin K3RS. Akun baru aktif setelah disetujui admin.' }));
    const demo = API.mode === 'demo' ? h('section', { class: 'kartu demo-kotak' },
      h('div', { class: 'kartu-kepala' }, h('h2', { text: 'Coba cepat' }), badge('MODE DEMO', 'demo')),
      h('p', { class: 'kecil', text: 'Basis data belum disambungkan. Pilih peran untuk mencoba dengan data contoh yang tersimpan di HP ini saja:' }),
      API.akunDemo().map(a => tombol([ikon(a.peran === 'k3rs' ? 'perisai' : a.peran === 'pj_unit' ? 'tugas' : 'pengguna'), 'Masuk sebagai ' + PERAN[a.peran]], async ev => { await sibuk(ev.currentTarget, async () => { await API.masuk(a.email, a.sandi); await muatSesi(); pergi('/beranda'); }).catch(() => {}); }, 'kedua', { 'data-peran': a.peran }))) : null;
    // Siluet perbukitan sederhana (aksen kedaerahan, dekoratif)
    const bukit = document.createElementNS(NS_SVG, 'svg'); bukit.setAttribute('class', 'bukit'); bukit.setAttribute('viewBox', '0 0 600 80'); bukit.setAttribute('preserveAspectRatio', 'none'); bukit.setAttribute('aria-hidden', 'true');
    const jalur = document.createElementNS(NS_SVG, 'path'); jalur.setAttribute('d', 'M0 80V58l70-22 60 14 90-40 70 28 50-12 80 30 60-18 120 28v14z'); jalur.setAttribute('fill', '#fff'); bukit.appendChild(jalur);
    tampil(h('div', { class: 'masuk-layar' },
      h('section', { class: 'masuk-merek', 'aria-label': 'Tentang aplikasi' },
        h('div', { class: 'masuk-logo' }, h('span', { class: 'logo-putih' }, h('img', { src: 'assets/logo.png', alt: '', width: 44, height: 44 })), h('span', { class: 'nama' }, namaHSE(true, 'besar'))),
        h('p', { class: 'tagline', text: 'Laporkan bahaya di tempat kerja dalam 3 ketukan.' }),
        h('ul', { class: 'nilai' },
          h('li', {}, ikon('centang'), h('span', { text: 'Tanpa menyalahkan siapa pun — boleh tanpa nama, dengan kode lacak.' })),
          h('li', {}, ikon('tugas'), h('span', { text: 'Setiap laporan punya satu penanggung jawab dan tanggal target.' })),
          h('li', {}, ikon('gembok'), h('span', { text: 'Teks yang memuat identitas pasien ditolak otomatis.' }))),
        h('p', { class: 'asal', text: 'Motif aksen terinspirasi kain tenun Bentenan, Sulawesi Utara.' }), bukit),
      h('main', { class: 'masuk-form', id: 'konten' }, form, demo, peringatanData())));
  }

  // ---------- MFA (khusus K3RS) ----------
  async function hMfa() {
    const faktor = await API.mfaFaktor().catch(() => []);
    const kode = h('input', { inputmode: 'numeric', autocomplete: 'one-time-code', pattern: '[0-9]{6}', maxlength: 6, placeholder: '6 angka' });
    if (faktor.length) {
      const btn = h('button', { type: 'submit', class: 'btn utama besar' }, 'VERIFIKASI');
      tampil(halaman('Verifikasi 2 langkah', '/mfa', [
        h('p', { text: 'Akun admin dilindungi verifikasi 2 langkah (MFA). Buka aplikasi autentikator di HP Anda (mis. Google Authenticator) dan ketik 6 angka yang tampil.' }),
        h('form', { class: 'kartu', onsubmit: async e => { e.preventDefault(); await sibuk(btn, async () => { await API.mfaVerifikasi(faktor[0].id, kode.value); await muatSesi(); pergi('/beranda'); }).catch(() => {}); } }, bidang('Kode 6 angka', kode), btn),
        tombol('Keluar', keluar, 'teks')]));
    } else {
      let daftar;
      try { daftar = await API.mfaDaftar(); } catch (e) { toast(e.message, 'galat'); return; }
      const btn = h('button', { type: 'submit', class: 'btn utama besar' }, 'AKTIFKAN');
      tampil(halaman('Aktifkan verifikasi 2 langkah', '/mfa', [
        h('ol', { class: 'langkah' },
          h('li', { text: 'Pasang aplikasi gratis "Google Authenticator" atau "Microsoft Authenticator" di HP Anda.' }),
          h('li', { text: 'Di aplikasi itu, tekan tanda + lalu "Pindai kode QR", arahkan ke kotak di bawah.' }),
          h('li', { text: 'Ketik 6 angka yang muncul, lalu tekan AKTIFKAN.' })),
        h('div', { class: 'qr-mfa' }, h('img', { src: daftar.qr, alt: 'Kode QR untuk aplikasi autentikator', width: 200, height: 200 })),
        h('details', {}, h('summary', { text: 'Tidak bisa memindai? Ketik kunci ini manual' }), h('code', { class: 'rahasia', text: daftar.rahasia })),
        h('form', { class: 'kartu', onsubmit: async e => { e.preventDefault(); await sibuk(btn, async () => { await API.mfaVerifikasi(daftar.factorId, kode.value); await muatSesi(); toast('Verifikasi 2 langkah aktif', 'ok'); pergi('/beranda'); }).catch(() => {}); } }, bidang('Kode 6 angka', kode), btn),
        tombol('Keluar', keluar, 'teks')]));
    }
  }

  // ---------- Beranda ----------
  async function hBeranda() {
    const p = peran(), nama = S.sesi.profil.nama_tampilan;
    const antrean = LS.get(KUNCI_ANTREAN, []);
    const kiri = [], kanan = [];
    const tglPanjang = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    kiri.push(h('section', { class: 'kartu sambutan', 'aria-label': 'Sambutan' },
      h('span', { class: 'tanggal', text: tglPanjang }),
      h('h2', {}, 'Halo, ', h('span', { text: nama })),
      h('span', { class: 'peran-teks' }, ikon(p === 'k3rs' ? 'perisai' : p === 'pj_unit' ? 'tugas' : 'pengguna'), h('span', { text: PERAN[p] + (S.sesi.profil.unit_id ? ' · ' + namaUnit(S.sesi.profil.unit_id) : '') }))));
    kiri.push(h('a', { href: '#/lapor', class: 'btn lapor-raksasa', role: 'button' }, ikon('awas'), 'LAPOR BAHAYA'));
    kiri.push(h('p', { class: 'kecil', text: 'Ketuk tombol merah, pilih jenis bahaya, lalu kirim. Tanpa menyalahkan siapa pun.' }));
    const isi = kanan;
    if (antrean.length) isi.push(h('div', { class: 'kartu peringatan' }, h('div', { class: 'kartu-kepala' }, h('span', { class: 'ikon-kotak kuning' }, ikon('kotakmasuk')), h('strong', { text: antrean.length + ' laporan menunggu dikirim' })), h('p', { class: 'kecil', text: 'Tersimpan di HP ini. Akan terkirim otomatis saat ada internet.' }),
      antrean.some(a => a.galat) ? h('p', { class: 'galat-teks', text: 'Sebagian gagal: ' + antrean.filter(a => a.galat).map(a => a.galat).join('; ') }) : null,
      h('div', { class: 'tombol-baris' }, tombol([ikon('kirim'), 'Kirim sekarang'], () => kirimAntrean().then(() => jalankan()), 'kedua'),
        antrean.some(a => a.galat) ? tombol('Hapus yang gagal', async () => { if (!await konfirmasi('Hapus laporan yang gagal?', 'Laporan di antrean yang gagal terkirim akan dihapus dari HP ini dan tidak dapat dikembalikan.', 'Hapus', true)) return; LS.set(KUNCI_ANTREAN, antrean.filter(a => !a.galat)); jalankan(); }, 'teks') : null)));
    // Pengingat tindak lanjut
    try {
      const L = await ambilLaporan();
      const pengingat = [];
      if (p === 'pj_unit' || p === 'k3rs') {
        const tugas = L.filter(l => l.pj_id === S.sesi.profil.id && ['ditugaskan', 'dalam_tindak_lanjut'].includes(l.status));
        const telat = tugas.filter(l => l.target_tanggal && l.target_tanggal < hariIni());
        const dekat = tugas.filter(l => l.target_tanggal && l.target_tanggal >= hariIni() && (new Date(l.target_tanggal) - new Date(hariIni())) / 864e5 <= 2);
        if (telat.length) pengingat.push(['merah', telat.length + ' tugas Anda melewati tanggal target', '#/tugas']);
        if (dekat.length) pengingat.push(['kuning', dekat.length + ' tugas jatuh tempo dalam 2 hari', '#/tugas']);
      }
      if (p === 'k3rs') {
        const baru = L.filter(l => l.status === 'baru');
        const mendesak = L.filter(l => l.mendesak && ['baru', 'ditugaskan', 'dalam_tindak_lanjut'].includes(l.status));
        if (baru.length) pengingat.push(['kuning', baru.length + ' laporan baru belum ditugaskan', '#/semua?status=baru']);
        if (mendesak.length) pengingat.push(['merah', mendesak.length + ' laporan mendesak belum selesai', '#/semua?mendesak=1']);
      }
      const milik = new Set(await API.laporanSaya().catch(() => []));
      const dilihat = LS.get('k3_dilihat', {});
      const kabar = L.filter(l => milik.has(l.id) && dilihat[l.id] && dilihat[l.id] !== l.diperbarui_pada);
      if (kabar.length) pengingat.push(['hijau', 'Ada kabar baru pada ' + kabar.length + ' laporan Anda', '#/laporan-saya']);
      const warnaIkon = { merah: ['awas', 'merah'], kuning: ['jam', 'kuning'], hijau: ['lonceng', 'hijau'] };
      isi.push(h('section', { class: 'pengingat', 'aria-label': 'Perlu perhatian' }, h('div', { class: 'judul-bagian', text: 'Perlu perhatian' }),
        pengingat.length ? pengingat.map(([w, t, href]) => h('a', { class: 'kartu ingat ' + w, href }, h('span', { class: 'ikon-kotak ' + warnaIkon[w][1] }, ikon(warnaIkon[w][0])), h('span', { text: t }), ikon('kanan', 'panah')))
          : h('div', { class: 'kartu ingat hijau' }, h('span', { class: 'ikon-kotak hijau' }, ikon('berhasil')), h('span', { text: 'Tidak ada pengingat saat ini.' }))));
    } catch (e) { if (!e.jaringan) toast(e.message, 'galat'); }
    const menu = (href, i, judul, ket) => h('a', { class: 'kartu menu', href }, h('span', { class: 'ikon-kotak' }, ikon(i)), h('span', { class: 'teks-menu' }, h('strong', { text: judul }), h('small', { text: ket })), ikon('kanan'));
    const cepat = [menu('#/laporan-saya', 'dokumen', 'Laporan saya', 'Status laporan yang Anda kirim'), menu('#/lacak', 'kunci', 'Lacak dengan kode', 'Untuk laporan tanpa nama')];
    if (p === 'pj_unit') cepat.push(menu('#/semua', 'daftar', 'Laporan unit', 'Semua laporan di unit Anda'), menu('#/ekspor', 'unduh', 'Ekspor data', 'CSV untuk rapat unit'));
    if (p === 'k3rs') cepat.push(menu('#/tugas', 'tugas', 'Tugas saya', 'Laporan yang Anda tangani'));
    cepat.push(menu('#/bantuan', 'bantuan', 'Bantuan', 'Cara melapor & arti status'), menu('#/asisten', 'robot', 'Asisten K3', 'Lapor dengan suara, tanya jawab'));
    const bawah = [h('div', { class: 'judul-bagian', text: 'Akses cepat' }), h('div', { class: 'grid-menu' }, cepat)];
    tampil(halaman('Beranda', '/beranda', [h('div', { class: 'beranda-grid' }, h('div', { class: 'b-atas' }, kiri), h('div', { class: 'b-samping' }, kanan), h('div', { class: 'b-bawah' }, bawah)), peringatanData()]));
  }

  async function ambilLaporan(paksa) {
    if (!S.cacheLaporan || paksa) S.cacheLaporan = await API.daftarLaporan();
    return S.cacheLaporan;
  }

  // ---------- Formulir lapor (3 ketukan) ----------
  function hLapor() {
    const ref = S.ref, draf = LS.get(KUNCI_DRAF, {});
    const unitQR = SS.get('k3_unit_qr');
    const unitAwal = draf.unit_id || (unitQR && (ref.unit.find(u => u.kode === unitQR) || {}).id) || S.sesi.profil.unit_id || LS.get('k3_unit_terakhir', '');
    const st = { kategori: draf.kategori || null, jenis: draf.jenis || 'bahaya', saran: null, foto: null };
    const simpanDraf = () => LS.set(KUNCI_DRAF, { kategori: st.kategori, jenis: st.jenis, unit_id: unitSel.value, uraian: uraian.value, lokasi: lokasi.value, mendesak: mendesak.checked });

    const unitSel = pilih([['', '— pilih unit —']].concat(ref.unit.filter(u => u.aktif).map(u => [u.id, u.nama])), unitAwal, { required: true, onchange: simpanDraf, 'aria-label': 'Unit' });
    const tiles = h('div', { class: 'grid-kategori', role: 'radiogroup', 'aria-label': 'Jenis bahaya' });
    function gambarTiles() {
      tiles.replaceChildren(...ref.kategori.filter(k => k.aktif).map(k => h('button', { type: 'button', role: 'radio', 'aria-checked': String(st.kategori === k.kode), class: 'tile' + (st.kategori === k.kode ? ' dipilih' : ''), 'data-kat': k.kode,
        onclick: () => { st.kategori = k.kode; gambarTiles(); simpanDraf(); perbaruiKirim(); } },
        h('span', { class: 'ikon', 'aria-hidden': 'true' }, ikonKat(k.kode)), h('span', { class: 'nama', text: k.nama }), h('small', { text: k.contoh }))));
    }
    gambarTiles();
    const uraian = h('textarea', { rows: 3, maxlength: 1000, placeholder: 'Apa yang terjadi / apa bahayanya? (boleh kosong)', oninput: () => { simpanDraf(); analisis(); } });
    uraian.value = draf.uraian || '';
    const lokasi = h('input', { maxlength: 120, placeholder: 'Contoh: lorong dekat lift (boleh kosong)', oninput: simpanDraf });
    lokasi.value = draf.lokasi || '';
    const mendesak = h('input', { type: 'checkbox', onchange: simpanDraf }); mendesak.checked = !!draf.mendesak;
    const anonim = h('input', { type: 'checkbox', onchange: () => { kotakFoto.hidden = anonim.checked; ketAnon.hidden = !anonim.checked; if (anonim.checked) { st.foto = null; pratinjau.replaceChildren(); } } });
    const ketAnon = h('p', { class: 'info', hidden: true, text: 'Nama Anda tidak disimpan. Anda akan mendapat KODE LACAK untuk melihat perkembangan. Foto dinonaktifkan agar tidak meninggalkan jejak.' });
    const jenisSel = pilih(Object.entries(JENIS), st.jenis, { onchange: e => { st.jenis = e.target.value; simpanDraf(); }, 'aria-label': 'Jenis laporan' });
    const saranKotak = h('div', { class: 'saran', 'aria-live': 'polite' });
    const privasiKotak = h('div', { class: 'privasi', 'aria-live': 'assertive' });
    const pratinjau = h('div', { class: 'pratinjau' });
    const inputFoto = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp', capture: 'environment', class: 'tersembunyi', onchange: async e => {
      const f = e.target.files[0]; if (!f) return;
      try { st.foto = await kecilkanFoto(f); const u = URL.createObjectURL(st.foto); pratinjau.replaceChildren(h('img', { src: u, alt: 'Pratinjau foto' }), tombol('Hapus foto', () => { st.foto = null; pratinjau.replaceChildren(); inputFoto.value = ''; }, 'teks')); }
      catch (err) { toast(err.message, 'galat'); inputFoto.value = ''; }
    } });
    const kotakFoto = h('div', { class: 'bidang' }, h('span', { class: 'label', text: 'Foto (opsional)' }), h('button', { type: 'button', class: 'btn kedua', onclick: () => inputFoto.click() }, ikon('kamera'), 'Tambah foto'), inputFoto, pratinjau,
      h('small', { class: 'bantu', text: 'Jangan memotret wajah pasien atau dokumen pasien.' }));
    const btnMik = AS.bisaDengar() ? h('button', { type: 'button', class: 'btn kedua', 'aria-label': 'Ceritakan dengan suara', onclick: () => {
      const isiMik = () => btnMik.replaceChildren(ikon('mik'), 'Ceritakan dengan suara');
      btnMik.replaceChildren(h('span', { class: 'putar', 'aria-hidden': 'true' }), 'Mendengarkan…');
      AS.dengar(t => { uraian.value = t; }, () => { isiMik(); simpanDraf(); analisis(); }, m => { toast(m, 'galat'); isiMik(); });
    } }, ikon('mik'), 'Ceritakan dengan suara') : null;

    function analisis() {
      const t = uraian.value;
      const temuan = AS.cekIdentitas(t + ' ' + lokasi.value);
      privasiKotak.replaceChildren();
      if (temuan.length) privasiKotak.appendChild(h('div', { class: 'kartu bahaya-kotak' },
        h('div', { class: 'kartu-kepala' }, h('span', { class: 'ikon-kotak merah' }, ikon('larang')), h('strong', { text: 'Tampaknya ada identitas pasien: ' + [...new Set(temuan.map(x => x.jenis))].join(', ') })),
        h('p', { text: 'Laporan K3 tidak boleh memuat nama, NIK, atau No. RM pasien.' }),
        tombol('Samarkan otomatis', () => { uraian.value = AS.samarkan(uraian.value); lokasi.value = AS.samarkan(lokasi.value); simpanDraf(); analisis(); }, 'utama')));
      saranKotak.replaceChildren();
      const s = AS.sarankanKategori(t); st.saran = s;
      if (s) saranKotak.appendChild(h('div', { class: 'kartu saran-kotak' },
        ikon('robot'), h('span', { text: 'Saran asisten: ' }), h('strong', { text: kat(s.kategori).nama }),
        h('small', { text: ' (kata: ' + s.kata.join(', ') + (s.keyakinan === 'rendah' ? '; keyakinan rendah' : '') + ')' }),
        st.kategori !== s.kategori ? tombol('Pakai saran', () => { st.kategori = s.kategori; gambarTiles(); simpanDraf(); perbaruiKirim(); analisis(); }, 'kedua kecil') : h('span', { class: 'ok-teks' }, ikon('centang'), ' dipakai')));
      const m = AS.cekMendesak(t);
      if (m.mendesak && !mendesak.checked) saranKotak.appendChild(h('div', { class: 'kartu saran-kotak' }, ikon('awas'), h('span', { text: 'Ada kata "' + m.kata.join('", "') + '". Tandai MENDESAK?' }), tombol('Ya, tandai', () => { mendesak.checked = true; simpanDraf(); analisis(); }, 'kedua kecil')));
      perbaruiKirim();
    }
    const btnKirim = h('button', { type: 'button', class: 'btn utama besar', id: 'btn-kirim', onclick: () => kirim() }, ikon('kirim'), 'KIRIM LAPORAN');
    function perbaruiKirim() { btnKirim.disabled = !st.kategori; btnKirim.title = st.kategori ? '' : 'Pilih jenis bahaya dulu'; }

    async function kirim() {
      if (!st.kategori) return toast('Pilih jenis bahaya dulu', 'galat');
      if (!unitSel.value) { unitSel.focus(); return toast('Pilih unit dulu', 'galat'); }
      if (AS.cekIdentitas(uraian.value + ' ' + lokasi.value).length) return toast('Hapus identitas pasien dulu (tekan "Samarkan otomatis")', 'galat');
      const data = { jenis: st.jenis, kategori: st.kategori, unit_id: +unitSel.value, uraian: uraian.value.trim(), lokasi: lokasi.value.trim(), mendesak: mendesak.checked, anonim: anonim.checked,
        id_klien: crypto.randomUUID(), kode_lacak: anonim.checked ? kodeLacakBaru() : null,
        ai_kategori: st.saran ? st.saran.kategori : null, ai_diterima: st.saran ? st.saran.kategori === st.kategori : undefined };
      LS.set('k3_unit_terakhir', data.unit_id);
      await sibuk(btnKirim, async () => {
        let hasil, tertunda = false;
        try {
          if (st.foto && !data.anonim) data.foto_path = await API.unggahFoto(st.foto);
          hasil = await API.kirimLaporan(data);
        } catch (e) {
          if (!e.jaringan) throw e;
          const q = LS.get(KUNCI_ANTREAN, []);
          q.push({ data, foto: st.foto && !data.anonim && !data.foto_path ? await blobKeDataUrl(st.foto) : null, pada: new Date().toISOString() });
          LS.set(KUNCI_ANTREAN, q); tertunda = true;
        }
        LS.del(KUNCI_DRAF); SS.del('k3_unit_qr'); S.cacheLaporan = null;
        hSelesai(hasil, data, tertunda);
      }).catch(() => {});
    }

    const langkah = (n, t) => h('div', { class: 'judul-bagian' }, h('span', { class: 'nomor-langkah', text: String(n) }), h('span', { text: t }));
    tampil(halaman('Lapor bahaya', '/lapor', [
      h('p', { class: 'langkah-kecil', text: 'Ketuk jenis bahaya, lalu tekan KIRIM. Bagian lain boleh dikosongkan.' }),
      langkah(1, 'Unit / ruangan'),
      h('div', { class: 'kartu ringkas' }, bidang('Unit / ruangan', unitSel, unitQR ? 'Terisi dari kode QR unit' : null)),
      langkah(2, 'Jenis bahaya'),
      tiles,
      langkah(3, 'Keterangan & pilihan'),
      h('details', { class: 'kartu', open: !!(draf.uraian || draf.lokasi) },
        h('summary', {}, ikon('pensil'), h('span', { text: 'Tambahkan keterangan (opsional)' })),
        btnMik, bidang('Ceritakan singkat', uraian), saranKotak, privasiKotak,
        bidang('Lokasi tepatnya', lokasi), bidang('Jenis laporan', jenisSel), kotakFoto),
      h('div', { class: 'kartu' },
        h('label', { class: 'saklar' }, mendesak, h('span', { text: 'MENDESAK — perlu ditangani segera' })),
        h('label', { class: 'saklar' }, anonim, h('span', { text: 'Kirim tanpa nama (anonim)' })), ketAnon),
      h('p', { class: 'privasi-tetap' }, ikon('gembok'), h('span', { text: 'Jangan tulis nama, NIK, atau nomor rekam medis pasien. Laporan ini untuk memperbaiki kondisi kerja, bukan untuk menyalahkan.' })),
      h('div', { class: 'kirim-lekat' }, btnKirim),
      h('p', { class: 'kecil', text: 'Darurat (kebakaran, orang cedera berat)? Selamatkan diri dan hubungi ' + (ref.pengaturan.nomor_darurat || 'nomor darurat rumah sakit') + '. Aplikasi ini bukan alat panggilan darurat.' })
    ], { kembali: true, sempit: true }));
    analisis();
  }

  function hSelesai(hasil, data, tertunda) {
    const isi = [h('div', { class: 'kartu sukses' }, h('div', { class: 'besar-ikon' + (tertunda ? ' tunda' : ''), 'aria-hidden': 'true' }, ikon(tertunda ? 'kotakmasuk' : 'centang')),
      h('h2', { text: tertunda ? 'Tersimpan di HP' : 'Terima kasih, laporan terkirim' }),
      h('p', { text: tertunda ? 'Sinyal sedang tidak ada. Laporan akan dikirim otomatis ketika internet kembali.' : 'Nomor laporan: ' + hasil.nomor + '. Tim K3RS akan menetapkan penanggung jawab dan tindak lanjut. Status bisa dilihat kapan saja.' }))];
    if (data.anonim) {
      isi.push(h('div', { class: 'kartu kode-lacak' }, h('p', { text: 'KODE LACAK Anda (catat atau foto layar ini):' }), h('div', { class: 'kode', text: data.kode_lacak }),
        tombol([ikon('salin'), 'Salin kode'], () => { navigator.clipboard && navigator.clipboard.writeText(data.kode_lacak).then(() => toast('Kode disalin', 'ok')).catch(() => toast('Salin manual', 'galat')); }, 'kedua'),
        tombol('Simpan kode di HP ini', () => { const k = LS.get('k3_kode_saya', []); k.push({ kode: data.kode_lacak, tgl: hariIni() }); LS.set('k3_kode_saya', k); toast('Kode disimpan di HP ini saja', 'ok'); }, 'teks'),
        h('small', { class: 'bantu', text: 'Kode ini satu-satunya cara melihat perkembangan laporan tanpa nama. Jangan simpan di HP bersama yang dipakai orang lain.' })));
    }
    isi.push(h('div', { class: 'tombol-baris' }, tombol([ikon('tambah'), 'Lapor lagi'], () => pergi('/lapor'), 'kedua besar'), tombol('Ke beranda', () => pergi('/beranda'), 'teks besar')));
    tampil(halaman('Laporan', '/lapor', isi, { sempit: true }));
    if (!tertunda) AS.bacakan('Terima kasih. Laporan terkirim.');
  }

  // ---------- Daftar laporan ----------
  function kartuLaporan(l) {
    const telat = l.target_tanggal && l.target_tanggal < hariIni() && ['ditugaskan', 'dalam_tindak_lanjut'].includes(l.status);
    return h('a', { class: 'kartu laporan' + (l.mendesak ? ' mendesak' : ''), href: '#/laporan/' + l.id },
      h('div', { class: 'kepala-lap' }, h('span', { class: 'ikon-kotak' }, ikonKat(l.kategori_kode)),
        h('div', { class: 'judul-lap' }, h('div', { class: 'baris' }, h('strong', { text: kat(l.kategori_kode).nama }), badgeStatus(l.status)),
          h('div', { class: 'meta' }, h('span', { text: l.nomor }), h('span', {}, ikon('gedung'), namaUnit(l.unit_id)), h('span', {}, ikon('kalender'), tgl(l.tanggal_lapor))))),
      l.uraian ? h('p', { class: 'cuplikan', text: l.uraian.length > 110 ? l.uraian.slice(0, 110) + '…' : l.uraian }) : null,
      h('div', { class: 'kaki-lap' },
        l.mendesak ? badge('MENDESAK', 'merah') : null, l.skor != null ? badgeTingkat(l.skor) : null, l.contoh ? badge('CONTOH', 'abu') : null, l.anonim ? badge('Anonim', 'abu') : null,
        l.target_tanggal ? h('span', { class: 'target' + (telat ? ' telat' : '') }, ikon('jam'), 'Target: ' + tgl(l.target_tanggal) + (telat ? ' (terlambat)' : '')) : null));
  }
  // Tampilan tabel untuk layar lebar (data dan tautan sama dengan kartu)
  function tabelLaporan(L) {
    const kolom = ['Nomor', 'Jenis bahaya', 'Unit', 'Tanggal', 'Risiko', 'Target', 'Status'];
    return h('div', { class: 'tabel-gulir tampilan-tabel' }, h('table', { class: 'tabel tabel-laporan' },
      h('thead', {}, h('tr', {}, kolom.map(t => h('th', { scope: 'col', text: t })))),
      h('tbody', {}, L.map(l => {
        const telat = l.target_tanggal && l.target_tanggal < hariIni() && ['ditugaskan', 'dalam_tindak_lanjut'].includes(l.status);
        return h('tr', { onclick: e => { if (!e.target.closest('a')) pergi('/laporan/' + l.id); } },
          h('td', {}, h('a', { href: '#/laporan/' + l.id, text: l.nomor }), l.mendesak ? h('div', { class: 'mendesak-penanda' }, ikon('awas'), 'Mendesak') : null),
          h('td', {}, h('span', { class: 'sel-kat' }, ikonKat(l.kategori_kode), kat(l.kategori_kode).nama), l.uraian ? h('div', { class: 'kecil', text: l.uraian.length > 70 ? l.uraian.slice(0, 70) + '…' : l.uraian }) : null),
          h('td', { text: namaUnit(l.unit_id) }), h('td', { class: 'angka-tab', text: tgl(l.tanggal_lapor) }),
          h('td', {}, badgeTingkat(l.skor)),
          h('td', {}, l.target_tanggal ? h('span', { class: 'target' + (telat ? ' telat' : ''), text: tgl(l.target_tanggal) + (telat ? ' (terlambat)' : '') }) : h('span', { class: 'kecil', text: '—' })),
          h('td', {}, badgeStatus(l.status)));
      }))));
  }
  function daftar(L, teksKosong) { return L.length ? h('div', { class: 'daftar-wadah' }, h('div', { class: 'daftar tampilan-kartu' }, L.map(kartuLaporan)), tabelLaporan(L)) : kosong(teksKosong); }

  async function hLaporanSaya() {
    const [L, milik] = await Promise.all([ambilLaporan(true), API.laporanSaya()]);
    const set = new Set(milik); const punya = L.filter(l => set.has(l.id));
    const dilihat = LS.get('k3_dilihat', {}); punya.forEach(l => { if (!dilihat[l.id]) dilihat[l.id] = l.diperbarui_pada; }); LS.set('k3_dilihat', dilihat);
    const kode = LS.get('k3_kode_saya', []);
    tampil(halaman('Laporan saya', '/laporan-saya', [
      h('p', { class: 'kecil', text: 'Laporan dengan nama Anda. Laporan tanpa nama dilihat lewat kode lacak.' }),
      daftar(punya, 'Belum ada laporan. Tekan "Lapor" untuk membuat laporan.'),
      h('a', { class: 'btn kedua', href: '#/lacak' }, ikon('kunci'), 'Lacak laporan tanpa nama'),
      kode.length ? h('div', { class: 'kartu' }, h('h2', { text: 'Kode lacak tersimpan di HP ini' }), kode.map(k => h('a', { class: 'baris-kode', href: '#/lacak?kode=' + encodeURIComponent(k.kode) }, ikon('kunci'), k.kode + ' · ' + tgl(k.tgl)))) : null]));
  }

  function paramHash() { const q = location.hash.split('?')[1] || ''; return new URLSearchParams(q); }

  async function hDaftarSemua(rute, judul) {
    const L = await ambilLaporan(true), P = paramHash();
    const f = { status: P.get('status') || '', unit: P.get('unit') || '', kategori: '', cari: '', mendesak: P.get('mendesak') === '1' };
    const wadah = h('div', { class: 'daftar' });
    const gambar = () => {
      let x = L;
      if (rute === '/tugas') x = x.filter(l => l.pj_id === S.sesi.profil.id);
      if (f.status) x = x.filter(l => f.status === 'terbuka' ? ['baru', 'ditugaskan', 'dalam_tindak_lanjut'].includes(l.status) : l.status === f.status);
      if (f.unit) x = x.filter(l => String(l.unit_id) === f.unit);
      if (f.kategori) x = x.filter(l => l.kategori_kode === f.kategori);
      if (f.mendesak) x = x.filter(l => l.mendesak);
      if (f.cari) x = x.filter(l => (l.nomor + ' ' + l.uraian + ' ' + l.lokasi).toLowerCase().includes(f.cari.toLowerCase()));
      if (rute === '/tugas') x = x.slice().sort((a, b) => String(a.target_tanggal || '9').localeCompare(String(b.target_tanggal || '9')));
      wadah.replaceChildren(h('p', { class: 'jumlah-hasil', 'aria-live': 'polite', text: x.length + ' laporan' + (x.length !== L.length && rute !== '/tugas' ? ' dari ' + L.length : '') }), daftar(x, 'Tidak ada laporan yang cocok dengan saringan.'));
    };
    const filter = h('div', { class: 'kartu filter' },
      pilih([['', 'Semua status'], ['terbuka', 'Belum selesai']].concat(Object.entries(STATUS)), f.status, { 'aria-label': 'Saring status', onchange: e => { f.status = e.target.value; gambar(); } }),
      pilih([['', 'Semua unit']].concat(S.ref.unit.map(u => [u.id, u.nama])), f.unit, { 'aria-label': 'Saring unit', onchange: e => { f.unit = e.target.value; gambar(); } }),
      pilih([['', 'Semua jenis bahaya']].concat(S.ref.kategori.map(k => [k.kode, k.nama])), '', { 'aria-label': 'Saring jenis bahaya', onchange: e => { f.kategori = e.target.value; gambar(); } }),
      h('input', { type: 'search', placeholder: 'Cari nomor/kata…', 'aria-label': 'Cari', oninput: e => { f.cari = e.target.value; gambar(); } }),
      h('label', { class: 'saklar' }, h('input', { type: 'checkbox', checked: f.mendesak, onchange: e => { f.mendesak = e.target.checked; gambar(); } }), h('span', { text: 'Hanya mendesak' })));
    gambar();
    tampil(halaman(judul, rute, [filter, wadah]));
  }

  // ---------- Detail laporan ----------
  async function hDetail(id) {
    const d = await API.detailLaporan(id); const l = d.laporan;
    if (!l) { tampil(halaman('Laporan', '', [kosong('Laporan tidak ditemukan atau Anda tidak berwenang melihatnya.')], { kembali: true })); return; }
    const dilihat = LS.get('k3_dilihat', {}); if (dilihat[l.id]) { dilihat[l.id] = l.diperbarui_pada; LS.set('k3_dilihat', dilihat); }
    const p = peran(), sayaPJ = l.pj_id === S.sesi.profil.id, isK3 = p === 'k3rs';
    // Penanda empat tahap (a)–(d) — hanya visualisasi status yang sudah ada
    const idxTahap = { baru: 0, ditugaskan: 1, dalam_tindak_lanjut: 2, terkendali_sementara: 3, tertutup: 4 }[l.status];
    const tahap = l.status === 'tidak_dilanjutkan' ? null : h('ol', { class: 'tahap', 'aria-label': 'Tahap penanganan' },
      ['Tercatat', 'Penanggung jawab', 'Tindak lanjut', l.status === 'terkendali_sementara' ? 'Terkendali sementara' : 'Tertutup'].map((t, i) =>
        h('li', { class: i < idxTahap || (i === 0 && idxTahap > 0) ? 'selesai' : i === idxTahap ? (l.status === 'terkendali_sementara' ? 'sementara' : 'kini') : idxTahap === 4 && i === 3 ? 'selesai' : '', 'aria-current': i === Math.min(idxTahap, 3) ? 'step' : null, text: t })));
    const info = h('div', { class: 'kartu' },
      h('div', { class: 'kepala-detail' }, h('span', { class: 'ikon-kotak' }, ikonKat(l.kategori_kode)),
        h('div', { class: 'judul-lap' }, h('h2', { text: kat(l.kategori_kode).nama }), h('span', { class: 'kecil', text: l.nomor + ' · ' + JENIS[l.jenis] })), badgeStatus(l.status)),
      h('p', { class: 'ket-status', text: STATUS_KET[l.status] }), tahap,
      h('div', { class: 'kaki-lap' }, l.mendesak ? badge('MENDESAK', 'merah') : null, badgeTingkat(l.skor), l.contoh ? badge('DATA CONTOH', 'abu') : null)),
      rincian = h('div', { class: 'kartu' }, h('h2', { text: 'Rincian' }),
      h('dl', { class: 'rincian' },
        h('dt', { text: 'Nomor' }), h('dd', { text: l.nomor }),
        h('dt', { text: 'Jenis' }), h('dd', { text: JENIS[l.jenis] }),
        h('dt', { text: 'Unit' }), h('dd', { text: namaUnit(l.unit_id) }),
        h('dt', { text: 'Lokasi' }), h('dd', { text: l.lokasi || '—' }),
        h('dt', { text: 'Tanggal lapor' }), h('dd', { text: tgl(l.tanggal_lapor) }),
        h('dt', { text: 'Uraian' }), h('dd', { text: l.uraian || '—' }),
        h('dt', { text: 'Mendesak' }), h('dd', { text: l.mendesak ? 'Ya' : 'Tidak' }),
        h('dt', { text: 'Pelapor' }), h('dd', {}, l.anonim ? 'Anonim' : (isK3 ? tombol('Lihat nama (tercatat di log)', async ev => { const b = ev.currentTarget; const n = await sibuk(b, () => API.namaPelapor(l.id)).catch(() => null); if (n) b.replaceWith(document.createTextNode(n)); }, 'teks kecil') : 'Dirahasiakan')),
        h('dt', { text: 'Target selesai' }), h('dd', { text: tgl(l.target_tanggal) }),
        h('dt', { text: 'Risiko (D×K)' }), h('dd', { text: l.skor ? l.dampak + ' × ' + l.kemungkinan + ' = ' + l.skor + ' (' + tingkat(l.skor) + ')' : 'Belum dinilai' }),
        h('dt', { text: 'Pengendalian' }), h('dd', { text: l.level_pengendalian ? LEVEL[l.level_pengendalian] : '—' })));
    const foto = h('div', { class: 'foto-wadah' });
    if (l.foto_path) API.urlFoto(l.foto_path).then(u => { if (u) foto.appendChild(h('img', { src: u, alt: 'Foto laporan', loading: 'lazy' })); }).catch(() => {});
    const linimasa = h('div', { class: 'kartu' }, h('div', { class: 'kartu-kepala' }, h('h2', { text: 'Riwayat status' }), ikon('riwayat')),
      h('ol', { class: 'linimasa' }, d.riwayat.map(r => h('li', {}, h('strong', { text: STATUS[r.ke] }), h('span', { class: 'kecil', text: ' · ' + tgl(r.pada) }), r.catatan ? h('div', { class: 'kecil', text: r.catatan }) : null))));
    const tlKotak = h('div', { class: 'kartu' }, h('div', { class: 'kartu-kepala' }, h('h2', { text: 'Tindak lanjut' }), ikon('tugas')),
      d.tindak_lanjut.length ? h('ul', { class: 'daftar-tl' }, d.tindak_lanjut.map(t => {
        const li = h('li', { class: ['eliminasi', 'substitusi', 'rekayasa'].includes(t.level_pengendalian) ? 'fisik' : 'sementara' }, h('div', { class: 'baris' }, h('strong', { text: LEVEL[t.level_pengendalian] }), h('span', { class: 'kecil', text: tgl(t.dibuat_pada) })), h('p', { text: t.uraian }), t.bukti_teks ? h('p', { class: 'kecil', text: 'Bukti: ' + t.bukti_teks }) : null);
        if (t.bukti_foto_path) API.urlFoto(t.bukti_foto_path).then(u => { if (u) li.appendChild(h('img', { src: u, alt: 'Foto bukti', loading: 'lazy' })); }).catch(() => {});
        return li;
      })) : kosong('Belum ada tindak lanjut.'));
    const aksi = [];
    if (isK3 && !['tertutup', 'tidak_dilanjutkan'].includes(l.status)) aksi.push(await formTugaskan(l));
    if ((isK3 || (p === 'pj_unit' && sayaPJ)) && ['ditugaskan', 'dalam_tindak_lanjut', 'terkendali_sementara'].includes(l.status)) aksi.push(formTL(l));
    aksi.push(formStatus(l, d.tindak_lanjut, isK3, p === 'pj_unit' && sayaPJ));
    tampil(halaman('Detail laporan', '', [h('div', { class: 'detail-grid' }, h('div', { class: 'detail-utama' }, info, foto, rincian, linimasa, tlKotak), h('div', { class: 'detail-samping' }, aksi))], { kembali: true }));
  }

  async function formTugaskan(l) {
    const pj = await API.daftarPJ().catch(() => []);
    const pjSel = pilih([['', '— pilih penanggung jawab —']].concat(pj.map(x => [x.id, x.nama + ' · ' + PERAN[x.peran] + (x.unit_id ? ' · ' + namaUnit(x.unit_id) : '')])), l.pj_id || '', { required: true });
    const tgt = h('input', { type: 'date', min: hariIni(), value: l.target_tanggal || '', required: true });
    const opsi = [1, 2, 3, 4, 5].map(n => [n, String(n)]);
    const D = pilih(opsi, l.dampak || 3), K = pilih(opsi, l.kemungkinan || 3);
    const hasil = h('p', { class: 'skor' });
    const hitung = () => { const s = D.value * K.value; hasil.className = 'skor ' + kelasTingkat(s); hasil.textContent = 'Skor ' + s + ' → ' + tingkat(s); };
    D.onchange = hitung; K.onchange = hitung; hitung();
    const cat = h('input', { maxlength: 300, placeholder: 'Pesan untuk penanggung jawab (opsional)' });
    const btn = h('button', { type: 'submit', class: 'btn utama' }, l.status === 'baru' ? 'TUGASKAN' : 'SIMPAN PERUBAHAN');
    return h('form', { class: 'kartu aksi', onsubmit: async e => { e.preventDefault(); await sibuk(btn, async () => { await API.tugaskan(l.id, pjSel.value, tgt.value, D.value, K.value, cat.value); toast('Tersimpan', 'ok'); S.cacheLaporan = null; jalankan(); }).catch(() => {}); } },
      h('h2', {}, ikon('pengguna'), 'Tahap (b): Penanggung jawab & penilaian risiko'),
      bidang('Penanggung jawab', pjSel), bidang('Tanggal target selesai', tgt),
      h('div', { class: 'dua' }, bidang('Dampak (1–5)', D), bidang('Kemungkinan (1–5)', K)), hasil,
      bidang('Catatan', cat), btn);
  }

  function formTL(l) {
    const uraian = h('textarea', { rows: 3, maxlength: 1000, required: true, minlength: 5, placeholder: 'Apa yang sudah dikerjakan?' });
    const lvl = pilih(Object.entries(LEVEL), 'rekayasa');
    const bukti = h('input', { maxlength: 500, placeholder: 'Contoh: foto sebelum-sesudah, nomor SPK perbaikan' });
    let fotoBlob = null; const prev = h('div', { class: 'pratinjau' });
    const inF = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp', capture: 'environment', class: 'tersembunyi', onchange: async e => {
      const f = e.target.files[0]; if (!f) return;
      try { fotoBlob = await kecilkanFoto(f); prev.replaceChildren(h('img', { src: URL.createObjectURL(fotoBlob), alt: 'Pratinjau bukti' })); } catch (err) { toast(err.message, 'galat'); }
    } });
    const btn = h('button', { type: 'submit', class: 'btn utama' }, 'SIMPAN TINDAK LANJUT');
    return h('form', { class: 'kartu aksi', onsubmit: async e => {
      e.preventDefault();
      if (AS.cekIdentitas(uraian.value + ' ' + bukti.value).length) return toast('Hapus identitas pasien dari teks', 'galat');
      await sibuk(btn, async () => { const path = fotoBlob ? await API.unggahFoto(fotoBlob) : null; await API.tambahTL(l.id, uraian.value, lvl.value, bukti.value, path); toast('Tindak lanjut tersimpan', 'ok'); S.cacheLaporan = null; jalankan(); }).catch(() => {});
    } }, h('h2', {}, ikon('tugas'), 'Tahap (c): Tindak lanjut pengendalian'),
      h('p', { class: 'kecil', text: 'Utamakan tingkat atas: eliminasi → substitusi → rekayasa. Aturan/rambu dan APD hanya "terkendali sementara".' }),
      bidang('Uraian tindakan', uraian), bidang('Tingkat pengendalian', lvl), bidang('Bukti perubahan', bukti),
      h('button', { type: 'button', class: 'btn kedua', onclick: () => inF.click() }, ikon('kamera'), 'Foto bukti (opsional)'), inF, prev, btn);
  }

  function formStatus(l, tls, isK3, isPJ) {
    const tombolList = [];
    const cat = h('input', { maxlength: 300, placeholder: 'Catatan/alasan' });
    // Konfirmasi sebelum perubahan status penting; aturan tetap ditegakkan di server
    const TANYA = { tertutup: ['Tutup laporan ini?', 'Laporan dinyatakan tertutup setelah diverifikasi. Server akan menolak bila belum ada tindak lanjut tingkat fisik dengan bukti.', 'Ya, tutup', false],
      tidak_dilanjutkan: ['Tidak dilanjutkan?', 'Laporan akan dihentikan dengan alasan pada kolom catatan. Pelapor dapat melihat status ini.', 'Ya, hentikan', true],
      dalam_tindak_lanjut: ['Buka kembali laporan?', 'Laporan kembali ke status "Sedang ditangani". Alasan pada kolom catatan wajib diisi.', 'Ya, buka kembali', false] };
    const ubahKe = (ke, label, kls) => tombol(label, async ev => { const b = ev.currentTarget; if (TANYA[ke] && !await konfirmasi(...TANYA[ke])) return; await sibuk(b, async () => { await API.ubahStatus(l.id, ke, cat.value); toast('Status diperbarui', 'ok'); S.cacheLaporan = null; jalankan(); }).catch(() => {}); }, kls);
    if ((isK3 || isPJ) && l.status === 'dalam_tindak_lanjut') tombolList.push(ubahKe('terkendali_sementara', 'Tandai terkendali sementara', 'kedua'));
    if (isK3 && ['dalam_tindak_lanjut', 'terkendali_sementara'].includes(l.status)) tombolList.push(ubahKe('tertutup', [ikon('centang'), 'Verifikasi & TUTUP'], 'utama'));
    if (isK3 && ['baru', 'ditugaskan'].includes(l.status)) tombolList.push(ubahKe('tidak_dilanjutkan', 'Tidak dilanjutkan', 'teks'));
    if (isK3 && ['tertutup', 'terkendali_sementara', 'tidak_dilanjutkan'].includes(l.status)) tombolList.push(ubahKe('dalam_tindak_lanjut', 'Buka kembali', 'teks'));
    if (!tombolList.length) return null;
    const fisik = tls.some(t => ['eliminasi', 'substitusi', 'rekayasa'].includes(t.level_pengendalian) && ((t.bukti_teks || '').trim().length >= 5 || t.bukti_foto_path));
    const butir = (ok, t) => h('li', { class: ok ? 'ya' : 'tidak' }, ikon(ok ? 'berhasil' : 'larang'), h('span', { text: (ok ? 'Terpenuhi: ' : 'Belum: ') + t }));
    return h('div', { class: 'kartu aksi' }, h('h2', {}, ikon('berhasil'), 'Tahap (d): Status & penutupan'),
      isK3 ? h('ul', { class: 'cek' },
        butir(!!l.pj_id, 'Ada satu penanggung jawab (D2)'),
        butir(fisik, 'Ada bukti perubahan pada tingkat fisik (D2, D4)'),
        butir(!!l.target_tanggal, 'Status dan tanggal tercatat (D3)')) : null,
      bidang('Catatan', cat), h('div', { class: 'tombol-baris' }, tombolList));
  }

  // ---------- Lacak kode ----------
  function hLacak() {
    const kode = h('input', { maxlength: 20, autocomplete: 'off', placeholder: 'XXXX-XXXX-XXXX', class: 'kode-input', value: paramHash().get('kode') || '' });
    const hasil = h('div', { 'aria-live': 'polite' });
    const btn = h('button', { type: 'submit', class: 'btn utama besar' }, 'LIHAT PERKEMBANGAN');
    const cari = async () => sibuk(btn, async () => {
      const r = await API.cekKode(kode.value);
      if (!r) { hasil.replaceChildren(kosong('Kode tidak ditemukan. Periksa kembali huruf dan angkanya.')); return; }
      hasil.replaceChildren(h('div', { class: 'kartu' }, h('div', { class: 'baris' }, h('strong', { text: r.kategori + ' · ' + r.unit }), badgeStatus(r.status)),
        h('p', { class: 'kecil', text: r.nomor + ' · dilaporkan ' + tgl(r.tanggal_lapor) }), h('p', { text: STATUS_KET[r.status] }),
        h('h3', { text: 'Riwayat' }), h('ol', { class: 'linimasa' }, (r.riwayat || []).map(x => h('li', {}, h('strong', { text: STATUS[x.ke] }), ' · ' + tgl(x.tanggal)))),
        h('h3', { text: 'Yang sudah dilakukan' }), (r.tindak_lanjut || []).length ? h('ul', { class: 'daftar-tl' }, r.tindak_lanjut.map(t => h('li', {}, h('div', { class: 'baris' }, h('strong', { text: LEVEL[t.level] }), h('span', { class: 'kecil', text: tgl(t.tanggal) })), h('p', { text: t.uraian })))) : kosong('Belum ada tindakan tercatat.')));
    }).catch(() => {});
    tampil(halaman('Lacak laporan', '/lacak', [h('p', { class: 'info' }, ikon('kunci'), h('span', { text: 'Masukkan kode lacak yang Anda terima saat mengirim laporan tanpa nama.' })),
      h('form', { class: 'kartu', onsubmit: e => { e.preventDefault(); cari(); } }, bidang('Kode lacak', kode), btn), hasil], { kembali: true, sempit: true }));
    if (kode.value) cari();
  }

  // ---------- Dasbor ----------
  function batang(judul, data, catatan, warna) {
    const arr = Array.isArray(data) ? data : Object.entries(data).map(([label, n]) => ({ label, n }));
    const maks = Math.max(1, ...arr.map(x => x.n));
    return h('section', { class: 'kartu' }, h('h2', { text: judul }), catatan ? h('p', { class: 'kecil', text: catatan }) : null,
      arr.length ? h('div', { class: 'batang-wadah' }, arr.map(x => { const isi = h('div', { class: 'batang-isi' }); isi.style.width = Math.max(2, Math.round(x.n / maks * 100)) + '%';
        const w = warna ? warna(x) : x.w;
        return h('div', { class: 'batang' + (w ? ' w-' + w : ''), role: 'img', 'aria-label': x.label + ': ' + x.n }, h('span', { class: 'batang-label', text: x.label }), h('div', { class: 'batang-jalur', 'aria-hidden': 'true' }, isi), h('span', { class: 'batang-n', 'aria-hidden': 'true', text: String(x.n) })); })) : kosong('Belum ada data.'));
  }
  async function hDasbor() {
    const s = await API.statistik();
    const angka = (label, n, kls, href, ik) => h(href ? 'a' : 'div', { class: 'angka ' + (kls || ''), href: href || null }, h('span', { class: 'ikon-kotak ' + (kls === 'merah' ? 'merah' : kls === 'kuning' ? 'kuning' : '') }, ikon(ik || 'grafik')), h('span', { class: 'n', text: String(n) }), h('span', { class: 'lbl', text: label }));
    const WARNA_STATUS = { baru: 'info', ditugaskan: '', dalam_tindak_lanjut: 'waspada', terkendali_sementara: 'tinggi', tertutup: 'aman', tidak_dilanjutkan: 'netral' };
    const pitaUrut = (S.ref.pengaturan.pita_risiko || []).slice().sort((a, b) => a.maks - b.maks);
    const warnaTingkat = x => { const i = pitaUrut.findIndex(p => p.label === x.label); if (i < 0) return 'netral'; return ['aman', 'waspada', 'tinggi', 'kritis'][Math.min(3, Math.round(i * 3 / Math.max(1, pitaUrut.length - 1)))]; };
    const tp = s.titik_putus, ks = s.kesenjangan;
    tampil(halaman('Dasbor', '/dasbor', [
      h('p', { class: 'catatan-batas' }, ikon('info'), h('span', { text: 'Angka di bawah hanya hitungan laporan yang tercatat di aplikasi. Bukan ukuran tingkat keselamatan, bukan perbandingan antarwaktu, dan bukan dasar menilai kinerja seseorang.' })),
      h('div', { class: 'grid-angka' }, angka('Total laporan', s.total, '', null, 'dokumen'), angka('Mendesak belum selesai', s.mendesak_terbuka, 'merah', '#/semua?mendesak=1', 'awas'),
        angka('Melewati target', s.terlambat, 'kuning', null, 'jam'), angka('Baru > ' + S.ref.pengaturan.hari_eskalasi + ' hari belum ditugaskan', s.baru_lewat_eskalasi, 'kuning', '#/semua?status=baru', 'kotakmasuk')),
      h('div', { class: 'dasbor-grid' },
        batang('Titik putus alur empat tahap', [
          { label: '(a) Tercatat, belum ditugaskan', n: tp.a_belum_ditugaskan, w: 'info' }, { label: '(b) Ditugaskan, belum ada tindakan', n: tp.b_belum_ditindaklanjuti },
          { label: '(c) Ditangani, belum ditutup', n: tp.c_belum_ditutup, w: 'waspada' }, { label: '(d) Terkendali sementara', n: tp.d_terkendali_sementara, w: 'tinggi' },
          { label: '(d) Tertutup', n: tp.d_tertutup, w: 'aman' }, { label: 'Tidak dilanjutkan', n: tp.tidak_dilanjutkan, w: 'netral' }], 'Menunjukkan di tahap mana catatan berhenti (pemetaan titik putus).'),
        batang('Kesenjangan catatan', [{ label: 'Tanpa penanggung jawab', n: ks.tanpa_pj }, { label: 'Tanpa tanggal target', n: ks.tanpa_target }, { label: 'Belum dinilai risikonya', n: ks.tanpa_skor }, { label: 'Pengendalian baru APD/administratif', n: ks.hanya_adm_apd, w: 'waspada' }]),
        batang('Per tingkat risiko', s.per_tingkat, null, warnaTingkat), batang('Per status', Object.entries(s.per_status).map(([k, n]) => ({ label: STATUS[k] || k, n, w: WARNA_STATUS[k] }))),
        batang('Per jenis bahaya', s.per_kategori), batang('Per unit', s.per_unit),
        batang('Per tingkat pengendalian', Object.entries(s.per_level).map(([k, n]) => ({ label: k === 'belum' ? 'Belum ada' : (LEVEL[k] || k).split(' (')[0], n, w: ['eliminasi', 'substitusi', 'rekayasa'].includes(k) ? 'aman' : k === 'belum' ? 'netral' : 'waspada' }))),
        h('section', { class: 'kartu' }, h('div', { class: 'kartu-kepala' }, h('h2', { text: 'Asisten K3' }), ikon('robot')), h('p', { text: 'Laporan dengan saran kategori dari asisten: ' + s.ai.dengan_saran + '; saran yang dipakai pelapor: ' + s.ai.diterima + '. Angka ini untuk menilai ketepatan asisten, bukan kinerja petugas.' })))
    ]));
  }

  // ---------- Admin ----------
  function hAdmin() {
    const m = [['/pengguna', 'orang', 'Pengguna & peran', 'Aktifkan akun, atur peran dan unit'], ['/pengaturan', 'atur', 'Pengaturan, unit, kategori', 'Instansi, pita risiko, MFA'], ['/qr', 'qr', 'Cetak kode QR unit', 'Tempel di dinding unit'], ['/ekspor', 'unduh', 'Ekspor CSV & cadangan', 'Laporan, tindak lanjut, log'],
      ['/log', 'riwayat', 'Log aktivitas', 'Siapa, kapan, apa'], ['/riset', 'mik', 'Bahan wawancara pra–pasca (Lampiran D)', 'Pedoman wawancara'], ['/paket', 'paket', 'Paket replikasi (8 komponen)', 'Ketersediaan berkas'], ['/bantuan', 'bantuan', 'Bantuan & peta hambatan', 'Cara pakai dan batas klaim']];
    tampil(halaman('Admin K3RS', '/admin', h('div', { class: 'grid-menu admin-grid' }, m.map(([r, i, t, k]) => h('a', { class: 'kartu menu', href: '#' + r }, h('span', { class: 'ikon-kotak' }, ikon(i)), h('span', { class: 'teks-menu' }, h('strong', { text: t }), h('small', { text: k })), ikon('kanan'))))));
  }

  async function hPengguna() {
    const P = await API.daftarPengguna();
    const baris = u => {
      const pr = pilih(Object.entries(PERAN), u.peran), un = pilih([['', '— tanpa unit —']].concat(S.ref.unit.map(x => [x.id, x.nama])), u.unit_id || '');
      const ak = h('input', { type: 'checkbox', checked: u.aktif });
      const btn = tombol('Simpan', async ev => { await sibuk(ev.currentTarget, async () => { await API.aturPengguna(u.id, pr.value, un.value ? +un.value : null, ak.checked); toast('Tersimpan', 'ok'); }).catch(() => {}); }, 'kedua kecil');
      const diri = u.id === S.sesi.profil.id;
      if (diri) { pr.disabled = true; ak.disabled = true; btn.disabled = true; }
      return h('div', { class: 'kartu pengguna' + (u.aktif ? '' : ' menunggu') }, h('div', { class: 'kepala-p' }, h('span', { class: 'avatar', 'aria-hidden': 'true', text: inisial(u.nama) }),
        h('div', {}, h('strong', { text: u.nama }), h('div', { class: 'kecil', text: (u.email || '') + ' · sejak ' + tgl(u.dibuat) + (diri ? ' · (akun Anda)' : '') })), u.aktif ? badge('Aktif', 'rk-0') : badge('Menunggu persetujuan', 'rk-1')),
        h('div', { class: 'dua' }, bidang('Peran', pr), bidang('Unit', un)), h('label', { class: 'saklar' }, ak, h('span', { text: 'Aktif (boleh memakai aplikasi)' })), btn);
    };
    tampil(halaman('Pengguna', '/admin', [
      h('p', { class: 'kecil', text: 'Akun baru dibuat di Supabase (Authentication → Users → Add user) atau mendaftar sendiri bila diizinkan, lalu diaktifkan di sini. Pengguna belum aktif ditampilkan paling atas.' }),
      h('div', { class: 'daftar daftar-pengguna' }, P.map(baris))], { kembali: true }));
  }

  function hPengaturan() {
    const p = S.ref.pengaturan;
    const nama = h('input', { value: p.nama_instansi, maxlength: 120 }), darurat = h('input', { value: p.nomor_darurat, maxlength: 60 });
    const esk = h('input', { type: 'number', min: 1, max: 30, value: p.hari_eskalasi });
    const pita = (p.pita_risiko || []).map(x => ({ maks: h('input', { type: 'number', min: 1, max: 25, value: x.maks }), label: h('input', { value: x.label, maxlength: 30 }) }));
    const mfa = h('input', { type: 'checkbox', checked: p.wajib_mfa_admin });
    const btn = h('button', { type: 'submit', class: 'btn utama' }, 'SIMPAN PENGATURAN');
    const fUmum = h('form', { class: 'kartu', onsubmit: async e => {
      e.preventDefault();
      const pr = pita.map(x => ({ maks: +x.maks.value, label: x.label.value.trim() })).sort((a, b) => a.maks - b.maks);
      if (pr[pr.length - 1].maks !== 25 || pr.some(x => !x.label)) return toast('Batas pita terakhir harus 25 dan semua label diisi', 'galat');
      await sibuk(btn, async () => { await API.simpanPengaturan({ nama_instansi: nama.value.trim(), nomor_darurat: darurat.value.trim(), hari_eskalasi: +esk.value, pita_risiko: pr, wajib_mfa_admin: mfa.checked }); await muatRef(); toast('Pengaturan tersimpan', 'ok'); }).catch(() => {});
    } }, h('h2', { text: 'Umum' }), bidang('Nama instansi', nama), bidang('Nomor darurat internal', darurat), bidang('Eskalasi laporan baru (hari)', esk),
      h('h3', { text: 'Pita tingkat risiko (skor 1–25)' }), h('p', { class: 'kecil', text: '[Asumsi desain — sesuaikan dengan SK/pedoman manajemen risiko rumah sakit dan konfirmasi promotor].' }),
      pita.map(x => h('div', { class: 'dua' }, bidang('Skor sampai', x.maks), bidang('Label', x.label))),
      h('label', { class: 'saklar' }, mfa, h('span', { text: 'Wajibkan verifikasi 2 langkah (MFA) untuk admin — sangat dianjurkan tetap menyala' })), btn);
    const unitBaru = { kode: h('input', { maxlength: 20, placeholder: 'KODE (mis. RAD)' }), nama: h('input', { maxlength: 80, placeholder: 'Nama unit' }) };
    const fUnit = h('div', { class: 'kartu' }, h('h2', { text: 'Unit / ruangan' }),
      S.ref.unit.map(u => { const n = h('input', { value: u.nama, maxlength: 80, 'aria-label': 'Nama unit ' + u.kode }); const a = h('input', { type: 'checkbox', checked: u.aktif });
        return h('div', { class: 'baris-edit' }, h('code', { text: u.kode }), n, h('label', { class: 'saklar kecil' }, a, h('span', { text: 'aktif' })), tombol('Simpan', async ev => { await sibuk(ev.currentTarget, async () => { await API.simpanUnit({ id: u.id, nama: n.value.trim(), aktif: a.checked }); await muatRef(); toast('Tersimpan', 'ok'); }).catch(() => {}); }, 'kedua kecil')); }),
      h('div', { class: 'baris-edit' }, unitBaru.kode, unitBaru.nama, tombol('Tambah', async ev => { await sibuk(ev.currentTarget, async () => { await API.simpanUnit({ kode: unitBaru.kode.value.trim().toUpperCase(), nama: unitBaru.nama.value.trim() }); await muatRef(); hPengaturan(); toast('Unit ditambahkan', 'ok'); }).catch(() => {}); }, 'utama kecil')));
    const fKat = h('div', { class: 'kartu' }, h('h2', { text: 'Jenis bahaya' }),
      S.ref.kategori.map(k => { const n = h('input', { value: k.nama, maxlength: 40 }), c = h('input', { value: k.contoh, maxlength: 160 }), a = h('input', { type: 'checkbox', checked: k.aktif });
        return h('div', { class: 'baris-edit kolom' }, h('code', { text: k.kode }), n, c, h('label', { class: 'saklar kecil' }, a, h('span', { text: 'aktif' })), tombol('Simpan', async ev => { await sibuk(ev.currentTarget, async () => { await API.simpanKategori({ kode: k.kode, nama: n.value.trim(), contoh: c.value.trim(), aktif: a.checked }); await muatRef(); toast('Tersimpan', 'ok'); }).catch(() => {}); }, 'kedua kecil')); }));
    const fKonf = h('div', { class: 'kartu' }, h('h2', { text: 'Konfigurasi untuk replikasi' }), h('p', { class: 'kecil', text: 'Unduh konfigurasi (unit, jenis bahaya, pita risiko) sebagai berkas JSON. Bagian dari komponen "konfigurasi dan versi platform" paket replikasi.' }),
      tombol([ikon('unduh'), 'Unduh konfigurasi.json'], () => unduh('konfigurasi-k3.json', JSON.stringify({ versi_aplikasi: VERSI, diekspor: new Date().toISOString(), unit: S.ref.unit, kategori: S.ref.kategori, pengaturan: Object.assign({}, S.ref.pengaturan, { nama_instansi: '[disamarkan]' }) }, null, 2), 'application/json'), 'kedua'));
    tampil(halaman('Pengaturan', '/admin', [fUmum, fUnit, fKat, fKonf, API.mode === 'demo' ? tombol([ikon('muat'), 'Atur ulang data demo'], async () => { if (!await konfirmasi('Atur ulang data demo?', 'Semua data contoh di HP ini dikembalikan ke keadaan awal.', 'Atur ulang', true)) return; API.reset(); location.reload(); }, 'teks') : null], { kembali: true, sempit: true }));
  }

  function hQR() {
    const dasar = location.origin + location.pathname;
    const pilihan = new Set();
    const kartu = h('div', { class: 'qr-cetak' });
    const gambar = () => kartu.replaceChildren(...S.ref.unit.filter(u => pilihan.has(u.id)).map(u => {
      const url = dasar + '?unit=' + encodeURIComponent(u.kode) + '#/lapor';
      let svg; try { svg = QR.svg(url, 200); } catch (e) { svg = h('p', { class: 'galat-teks', text: e.message }); }
      return h('div', { class: 'qr-kartu' }, h('strong', { text: 'LAPOR BAHAYA K3' }), svg, h('div', { class: 'qr-unit', text: u.nama }), h('small', { text: 'Pindai dengan kamera HP. Tanpa menyalahkan siapa pun.' }));
    }));
    tampil(halaman('Kode QR unit', '/admin', [
      h('p', { class: 'kecil no-print', text: 'Pilih unit, lalu tekan Cetak. Tempel di dinding unit. Saat dipindai, formulir terbuka dengan unit sudah terisi (pelapor tetap harus masuk).' }),
      h('div', { class: 'kartu no-print pilih-unit' }, S.ref.unit.filter(u => u.aktif).map(u => h('label', { class: 'saklar kecil' }, h('input', { type: 'checkbox', onchange: e => { e.target.checked ? pilihan.add(u.id) : pilihan.delete(u.id); gambar(); } }), h('span', { text: u.nama })))),
      tombol([ikon('cetak'), 'Cetak'], () => window.print(), 'utama no-print'), kartu], { kembali: true }));
  }

  // ---------- Ekspor ----------
  const VERSI = '1.1.0';
  function sel(v) { let s = v === null || v === undefined ? '' : (typeof v === 'object' ? JSON.stringify(v) : String(v)); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
  function keCSV(baris, kolom) { return '﻿' + [kolom.map(k => sel(k[1])).join(',')].concat(baris.map(r => kolom.map(k => sel(typeof k[0] === 'function' ? k[0](r) : r[k[0]])).join(','))).join('\r\n'); }
  function unduh(nama, isi, tipe) { const b = new Blob([isi], { type: tipe || 'text/csv;charset=utf-8' }); const a = h('a', { href: URL.createObjectURL(b), download: nama }); document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); }
  async function hEkspor() {
    const isK3 = peran() === 'k3rs', tg = hariIni();
    const pjNama = isK3 ? Object.fromEntries((await API.daftarPJ().catch(() => [])).map(x => [x.id, x.nama])) : {};
    const kolomLap = [['nomor', 'nomor'], ['tanggal_lapor', 'tanggal_lapor'], ['jenis', 'jenis'], [r => kat(r.kategori_kode).nama, 'jenis_bahaya'], [r => namaUnit(r.unit_id), 'unit'], ['lokasi', 'lokasi'], ['uraian', 'uraian'],
      ['mendesak', 'mendesak'], ['anonim', 'anonim'], ['dampak', 'dampak'], ['kemungkinan', 'kemungkinan'], ['skor', 'skor'], [r => tingkat(r.skor), 'tingkat_risiko'], ['status', 'status'],
      [r => pjNama[r.pj_id] || (r.pj_id ? '(PJ)' : ''), 'penanggung_jawab'], ['target_tanggal', 'target_tanggal'], ['level_pengendalian', 'tingkat_pengendalian'], ['ditutup_pada', 'ditutup_pada'],
      ['ai_kategori_saran', 'saran_asisten'], ['ai_saran_diterima', 'saran_dipakai'], ['contoh', 'data_contoh']];
    const aksi = [
      ['Laporan (CSV)', async () => unduh('laporan-k3-' + tg + '.csv', keCSV(await ambilLaporan(true), kolomLap)), 'laporan'],
      ['Tindak lanjut (CSV)', async () => { const L = Object.fromEntries((await ambilLaporan()).map(l => [l.id, l.nomor])); unduh('tindak-lanjut-' + tg + '.csv', keCSV(await API.semuaTindakLanjut(), [[r => L[r.laporan_id], 'nomor_laporan'], ['dibuat_pada', 'tanggal'], ['level_pengendalian', 'tingkat_pengendalian'], ['uraian', 'uraian'], ['bukti_teks', 'bukti'], [r => r.bukti_foto_path ? 'ada' : '', 'foto_bukti']])); }, 'tindak_lanjut'],
      ['Riwayat status (CSV)', async () => { const L = Object.fromEntries((await ambilLaporan()).map(l => [l.id, l.nomor])); unduh('riwayat-status-' + tg + '.csv', keCSV(await API.semuaRiwayat(), [[r => L[r.laporan_id], 'nomor_laporan'], ['dari', 'dari'], ['ke', 'ke'], ['pada', 'pada'], ['catatan', 'catatan']])); }, 'riwayat'],
      ['Format daftar risiko (CSV)', async () => {
        const L = await ambilLaporan(true), T = await API.semuaTindakLanjut();
        const akhirTL = id => { const t = T.filter(x => x.laporan_id === id); return t.length ? t[t.length - 1].uraian : ''; };
        unduh('format-register-' + tg + '.csv', keCSV(L, [[r => namaUnit(r.unit_id), 'UNIT'], ['nomor', 'NO'], [r => kat(r.kategori_kode).nama, 'KATEGORI RISIKO'], ['uraian', 'SEBAB / URAIAN'], ['lokasi', 'AREA / LOKASI'],
          ['dampak', 'DAMPAK (D)'], ['kemungkinan', 'PROBABILITAS (P)'], ['skor', 'SKOR'], [r => tingkat(r.skor), 'PERINGKAT RISIKO'], [r => LEVEL[r.level_pengendalian] || '', 'OPSI TEKNIK PENGENDALIAN'],
          [r => akhirTL(r.id), 'URAIAN PENANGANAN RISIKO'], [r => pjNama[r.pj_id] || '', 'PEMILIK RISIKO'], ['target_tanggal', 'TARGET WAKTU'], [r => STATUS[r.status], 'STATUS']]));
      }, 'register']];
    if (isK3) aksi.push(['Log aktivitas (CSV)', async () => unduh('log-aktivitas-' + tg + '.csv', keCSV(await API.logAktivitas(), [['pada', 'pada'], ['peran', 'peran'], ['aksi', 'aksi'], ['objek', 'objek'], ['objek_id', 'objek_id'], ['ringkas', 'ringkas'], [r => r.aktor ? 'tercatat' : 'kosong (anonim/sistem)', 'aktor']])), 'log'],
      ['Cadangan lengkap (JSON)', async () => unduh('cadangan-k3-' + tg + '.json', JSON.stringify({ versi_aplikasi: VERSI, diekspor: new Date().toISOString(), referensi: S.ref, laporan: await ambilLaporan(true), tindak_lanjut: await API.semuaTindakLanjut(), riwayat: await API.semuaRiwayat() }, null, 1), 'application/json'), 'cadangan']);
    tampil(halaman('Ekspor data', '/admin', [
      h('p', { class: 'info', text: 'Berkas tidak memuat identitas pelapor. Simpan berkas di tempat aman milik rumah sakit; jangan dibagikan lewat grup pesan. Setiap ekspor tercatat di log.' + (isK3 ? '' : ' Sebagai PJ unit, Anda hanya mengekspor laporan unit Anda.') }),
      h('div', { class: 'daftar' }, aksi.map(([t, f, j]) => tombol([ikon('unduh'), t], async ev => { await sibuk(ev.currentTarget, async () => { await f(); API.catatEkspor(j); }).catch(() => {}); }, 'kedua')))], { kembali: true }));
  }

  async function hLog() {
    const L = await API.logAktivitas();
    tampil(halaman('Log aktivitas', '/admin', [h('p', { class: 'kecil', text: 'Siapa (peran), kapan, apa. Isi uraian laporan tidak dicatat. Aktor kosong = pelapor anonim.' }),
      L.length ? h('div', { class: 'tabel-gulir' }, h('table', { class: 'tabel tumpuk' }, h('thead', {}, h('tr', {}, ['Waktu', 'Peran', 'Aksi', 'Objek', 'Ringkas'].map(t => h('th', { scope: 'col', text: t })))),
        h('tbody', {}, L.slice(0, 300).map(r => h('tr', {}, h('td', { 'data-label': 'Waktu', class: 'angka-tab', text: new Date(r.pada).toLocaleString('id-ID') }), h('td', { 'data-label': 'Peran', text: r.peran ? PERAN[r.peran] || r.peran : '—' }), h('td', { 'data-label': 'Aksi' }, h('code', { text: r.aksi })), h('td', { 'data-label': 'Objek', text: r.objek_id || '—' }), h('td', { 'data-label': 'Ringkas', text: r.ringkas || '—' }))))))
        : kosong('Belum ada aktivitas tercatat.')], { kembali: true }));
  }

  // ---------- Bahan riset (Lampiran D) ----------
  function hRiset() {
    const Q = [
      ['Alur kerja K3 di unit', 'Bagaimana Bapak/Ibu biasanya menangani sebuah bahaya di unit, mulai dari bahaya itu dicatat sampai dinyatakan selesai?', 'Bagaimana Bapak/Ibu menangani sebuah bahaya di unit dengan aplikasi, mulai dari bahaya itu dicatat sampai dinyatakan selesai?', 'Siapa saja yang terlibat pada setiap langkah itu? · Pada langkah mana penanganan biasanya berhenti atau tertunda?'],
      ['Hambatan pelaporan dan penanganan', 'Apa saja yang membuat Bapak/Ibu atau rekan kerja sulit melaporkan atau menindaklanjuti sebuah bahaya saat ini?', 'Sesudah memakai aplikasi, apa saja yang membuat Bapak/Ibu atau rekan kerja sulit melaporkan atau menindaklanjuti sebuah bahaya?', 'Bisakah Bapak/Ibu menceritakan satu kejadian yang menggambarkan hal itu? · Apa yang Bapak/Ibu lakukan saat menghadapinya?'],
      ['Kejelasan langkah dan fitur', 'Bagian mana dari cara pencatatan bahaya yang dipakai sekarang yang menurut Bapak/Ibu jelas, dan bagian mana yang tidak jelas?', 'Bagian mana dari aplikasi yang menurut Bapak/Ibu jelas, dan bagian mana yang tidak jelas?', 'Apa yang Bapak/Ibu pahami dari bagian itu? · Informasi apa yang Bapak/Ibu cari tetapi tidak ditemukan?'],
      ['Kecocokan dengan sumber daya dan kebiasaan', 'Bagaimana cara pencatatan bahaya yang dipakai sekarang berjalan dengan waktu, tenaga, dan perangkat yang tersedia di unit?', 'Bagaimana aplikasi berjalan dengan waktu, tenaga, dan perangkat yang tersedia di unit?', 'Pada situasi kerja seperti apa hal itu paling terasa? · Kebiasaan kerja apa yang berubah dan apa yang tetap sama?'],
      ['Hal yang perlu diperbaiki', 'Bila cara penanganan bahaya di unit dapat diubah, apa yang menurut Bapak/Ibu perlu diubah?', 'Bila aplikasi dapat diubah, apa yang menurut Bapak/Ibu perlu diubah?', 'Mengapa hal itu penting bagi Bapak/Ibu? · Siapa yang paling merasakan perubahan itu?']];
    tampil(halaman('Bahan wawancara pra–pasca', '/admin', [
      h('p', { class: 'catatan-batas', text: '[PROTOKOL/RANCANGAN — instrumen penelitian lanjutan] Pedoman ini disalin dari Lampiran D draf. Wawancara hanya boleh dilakukan setelah persetujuan etik dan lembar persetujuan (Lampiran C). Jawaban wawancara TIDAK disimpan di aplikasi ini (minimisasi data); catat di formulir D.3 yang disimpan peneliti.' }),
      h('div', { class: 'kartu' }, h('h2', { text: 'Pembukaan (dibacakan)' }), h('p', { text: '“Terima kasih atas kesediaan Bapak/Ibu. Wawancara ini membahas cara bahaya di unit dicatat dan ditangani. Tidak ada jawaban benar atau salah. Bapak/Ibu boleh tidak menjawab atau berhenti kapan saja. Apakah Bapak/Ibu mengizinkan percakapan ini direkam?”' })),
      Q.map((q, i) => h('div', { class: 'kartu' }, h('h3', { text: (i + 1) + '. ' + q[0] }), h('p', {}, h('strong', { text: 'PRE: ' }), q[1]), h('p', {}, h('strong', { text: 'POST: ' }), q[2]), h('p', { class: 'kecil' }, h('strong', { text: 'Probe: ' }), q[3]))),
      h('div', { class: 'kartu' }, h('h2', { text: 'Penutup (dibacakan)' }), h('p', { text: '“Apakah ada hal lain tentang penanganan bahaya di unit yang ingin Bapak/Ibu sampaikan? Terima kasih. Rekaman dan catatan akan dirahasiakan sebagaimana dijelaskan pada lembar informasi.”' })),
      tombol([ikon('unduh'), 'Unduh formulir kosong D.3 (CSV)'], () => unduh('formulir-D3-catatan-jawaban.csv', keCSV([], [['a', 'Kode partisipan'], ['b', 'Tanggal'], ['c', 'Sesi (PRE/POST)'], ['d', 'No pertanyaan'], ['e', 'Kutipan (verbatim)'], ['f', 'Kode tema']])), 'kedua')], { kembali: true }));
  }

  function hPaket() {
    const K = [
      ['Spesifikasi fungsional', 'Dokumen BRD & SRS (docs/) — tersedia'],
      ['Model data dan aturan status', 'supabase/01_setup.sql (tabel, pemicu aturan D2–D4) — tersedia'],
      ['Konfigurasi dan versi platform', 'config.js, Pengaturan → Unduh konfigurasi.json, versi aplikasi ' + VERSI + ' — tersedia'],
      ['Kodebook dan register', '[PERLU ISI oleh peneliti] — di luar aplikasi'],
      ['Protokol evaluasi', '[PERLU ISI oleh peneliti — ambang dikunci di G1]'],
      ['Rubrik kesamaan konteks', '[PERLU ISI oleh peneliti — empat kriteria konteks]'],
      ['Panduan adaptasi', 'Panduan_Membuat_Aplikasi_K3.docx + README — tersedia'],
      ['Pernyataan batas klaim dan ketentuan penggunaan', 'Menu Bantuan → Batas klaim; README — tersedia']];
    tampil(halaman('Paket replikasi', '/admin', [h('p', { class: 'kecil', text: 'Delapan komponen paket replikasi menurut draf (Bab III, kriteria K5). Status di bawah hanya menunjukkan ketersediaan berkas, bukan penilaian K5.' }),
      h('ol', { class: 'paket' }, K.map(([a, b]) => h('li', {}, h('strong', { text: a }), h('div', { class: 'kecil', text: b }))))], { kembali: true }));
  }

  // ---------- Bantuan ----------
  function hBantuan() {
    const peta = [
      ['Takut disalahkan / identitas terbuka', 'D1', 'Lapor tanpa nama + kode lacak; nama pelapor disembunyikan dari PJ unit; foto dimatikan pada laporan anonim'],
      ['Tidak tahu cara/tempat melapor', 'D1', '3 ketukan; kode QR per unit; 8 jenis bahaya bergambar; asisten tanya-jawab'],
      ['Formulir rumit, tidak ada waktu', 'D1', 'Isian opsional; dikte suara; simpan draf otomatis; antrean saat sinyal lemah'],
      ['Umpan balik lambat/tidak ada', 'D2, D3', 'Status dan riwayat terlihat oleh pelapor (juga lewat kode lacak); pemberitahuan kabar baru di beranda'],
      ['Tidak jelas siapa yang menangani', 'D2', 'Satu penanggung jawab wajib sebelum ditangani; tanggal target wajib'],
      ['Penanganan berhenti di tengah', 'D3', 'Dasbor titik putus (a)–(d); pengingat tugas terlambat; eskalasi laporan baru'],
      ['Penutupan hanya di atas kertas (APD/aturan)', 'D4', 'Status tertutup hanya untuk eliminasi/substitusi/rekayasa dengan bukti; APD/administratif = terkendali sementara'],
      ['Sulit diterapkan di rumah sakit lain', 'D5', 'Unit, jenis bahaya, dan pita risiko dapat diatur; konfigurasi dapat diunduh; paket replikasi 8 komponen']];
    tampil(halaman('Bantuan', '/bantuan', [
      h('div', { class: 'kartu' }, h('h2', { text: 'Cara melapor' }), h('ol', {}, h('li', { text: 'Tekan LAPOR BAHAYA.' }), h('li', { text: 'Ketuk gambar jenis bahaya.' }), h('li', { text: 'Tekan KIRIM.' })),
        h('p', { class: 'kecil', text: 'Tambahan opsional: cerita singkat (bisa dengan suara), lokasi, foto, tanda mendesak, kirim tanpa nama.' })),
      h('div', { class: 'kartu' }, h('h2', { text: 'Arti status' }), h('dl', { class: 'rincian' }, Object.keys(STATUS).map(k => [h('dt', { text: STATUS[k] }), h('dd', { text: STATUS_KET[k] })]))),
      h('div', { class: 'kartu' }, h('h2', { text: 'Privasi' }), h('ul', {},
        h('li', { text: 'Jangan menulis nama, NIK, atau nomor rekam medis pasien. Aplikasi memeriksa dan menolak teks seperti itu.' }),
        h('li', { text: 'Laporan dengan nama: nama hanya dapat dibuka K3RS dan setiap pembukaan tercatat di log.' }),
        h('li', { text: 'Laporan tanpa nama: nama tidak disimpan; waktu lapor hanya dicatat tanggalnya.' }),
        h('li', { text: 'Data dipakai untuk memperbaiki kondisi kerja, bukan untuk menghukum.' }))),
      h('div', { class: 'kartu' }, h('h2', { text: 'Peta hambatan → prinsip desain → fitur' }), h('p', { class: 'kecil', text: 'Hambatan diambil dari pustaka pada draf (bukan dari wawancara; E3 dijeda). Prinsip D1–D5 berstatus hipotesis desain.' }),
        h('div', { class: 'tabel-gulir' }, h('table', { class: 'tabel tumpuk' }, h('thead', {}, h('tr', {}, h('th', { scope: 'col', text: 'Hambatan' }), h('th', { scope: 'col', text: 'Prinsip' }), h('th', { scope: 'col', text: 'Fitur' }))), h('tbody', {}, peta.map(r => h('tr', {}, r.map((c, i) => h('td', { 'data-label': ['Hambatan', 'Prinsip', 'Fitur'][i], text: c })))))))),
      h('div', { class: 'kartu' }, h('h2', { text: 'Batas klaim' }), h('p', { text: 'Aplikasi ini adalah komponen operasional rancangan sistem K3 empat tahap pada satu rumah sakit. Aplikasi tidak diklaim mengubah angka kecelakaan, tidak diklaim berhasil di rumah sakit lain, dan belum diaudit keamanan secara independen. Uji coba memakai data contoh.' })),
      h('p', { class: 'kecil', text: 'Versi aplikasi ' + VERSI + ' · mode ' + API.mode })]));
  }

  // ---------- Asisten (panel percakapan) ----------
  function tombolAsisten() {
    const r = (location.hash.slice(1) || '').split('?')[0];
    if (!peran() || r === '/asisten' || r === '/lapor') return null;
    return h('a', { href: '#/asisten', class: 'fab', 'aria-label': 'Buka Asisten K3', title: 'Asisten K3' }, ikon('robot'));
  }
  function hAsisten() {
    const log = h('div', { class: 'obrolan', 'aria-live': 'polite' });
    const bicara = (siapa, teks, suara) => { log.appendChild(h('div', { class: 'gelembung ' + siapa, text: teks })); log.scrollTop = log.scrollHeight; if (suara && siapa === 'as') AS.bacakan(teks); };
    const masukan = h('input', { placeholder: 'Ketik pertanyaan…', maxlength: 200, 'aria-label': 'Pertanyaan untuk asisten' });
    const tanya = t => { if (!t.trim()) return; bicara('saya', t); bicara('as', AS.jawab(t)); masukan.value = ''; };
    let laporanSuara = null;
    function alurSuara() {
      bicara('as', 'Silakan ceritakan bahayanya. Contoh: "lantai licin di depan radiologi".', true);
      setTimeout(() => AS.dengar(() => {}, teks => {
        if (!teks) { bicara('as', 'Saya tidak menangkap suara. Tekan tombol mikrofon lagi.'); return; }
        bicara('saya', teks);
        if (AS.cekIdentitas(teks).length) { bicara('as', 'Ada identitas pasien dalam cerita. Saya samarkan dulu.'); teks = AS.samarkan(teks); }
        const s = AS.sarankanKategori(teks), m = AS.cekMendesak(teks);
        const unitId = (SS.get('k3_unit_qr') && (S.ref.unit.find(u => u.kode === SS.get('k3_unit_qr')) || {}).id) || S.sesi.profil.unit_id || LS.get('k3_unit_terakhir', null);
        if (!s || !unitId) { LS.set(KUNCI_DRAF, { uraian: teks, kategori: s ? s.kategori : null, mendesak: m.mendesak }); bicara('as', 'Saya sudah menyiapkan formulir. Lengkapi ' + (!s ? 'jenis bahaya' : 'unit') + ' lalu tekan KIRIM.', true); setTimeout(() => pergi('/lapor'), 1500); return; }
        laporanSuara = { jenis: 'bahaya', kategori: s.kategori, unit_id: +unitId, uraian: teks, lokasi: '', mendesak: m.mendesak, anonim: false, id_klien: crypto.randomUUID(), ai_kategori: s.kategori, ai_diterima: true };
        const ringkas = 'Saya catat: ' + kat(s.kategori).nama + ' di ' + namaUnit(unitId) + (m.mendesak ? ', MENDESAK' : '') + '. Kirim sekarang? Jawab "ya" atau "tidak".';
        bicara('as', ringkas, true); tampilKonfirmasi();
        setTimeout(() => AS.dengar(() => {}, j => { const a = AS.artiJawabanYa(j || ''); if (a === 'ya') kirimSuara(); else if (a === 'tidak') batalSuara(); }, () => {}), 4200);
      }, msg => bicara('as', msg)), 2600);
    }
    const konfirmasi = h('div', { class: 'tombol-baris' });
    function tampilKonfirmasi() { konfirmasi.replaceChildren(tombol([ikon('centang'), 'Ya, kirim'], kirimSuara, 'utama'), tombol([ikon('pensil'), 'Ubah di formulir'], () => { LS.set(KUNCI_DRAF, laporanSuara); pergi('/lapor'); }, 'kedua'), tombol('Batal', batalSuara, 'teks')); }
    async function kirimSuara() {
      if (!laporanSuara) return; const d = laporanSuara; laporanSuara = null; konfirmasi.replaceChildren();
      try { const r = await API.kirimLaporan(d); bicara('as', 'Terkirim. Nomor ' + r.nomor + '. Terima kasih.', true); S.cacheLaporan = null; }
      catch (e) { if (e.jaringan) { const q = LS.get(KUNCI_ANTREAN, []); q.push({ data: d, foto: null }); LS.set(KUNCI_ANTREAN, q); bicara('as', 'Sinyal tidak ada. Laporan disimpan dan dikirim otomatis nanti.', true); } else bicara('as', 'Gagal: ' + e.message, true); }
    }
    function batalSuara() { laporanSuara = null; konfirmasi.replaceChildren(); bicara('as', 'Baik, dibatalkan.', true); }
    tampil(halaman('Asisten K3', '/asisten', [
      h('p', { class: 'info' }, ikon('robot'), h('span', { text: 'Asisten bekerja di dalam HP (tanpa internet, tanpa mengirim teks ke pihak lain). Saran asisten selalu perlu Anda periksa.' })),
      log, konfirmasi,
      h('div', { class: 'chip-baris' }, ['Cara melapor', 'Lapor tanpa nama', 'Siapa yang melihat laporan saya?', 'Lacak laporan', 'Darurat'].map(t => tombol(t, () => tanya(t), 'chip'))),
      h('form', { class: 'baris-tanya', onsubmit: e => { e.preventDefault(); tanya(masukan.value); } }, masukan, h('button', { type: 'submit', class: 'btn kedua' }, ikon('kirim'), 'Tanya')),
      AS.bisaDengar() ? tombol([ikon('mik'), 'Lapor dengan suara'], alurSuara, 'utama besar') : h('p', { class: 'kecil', text: 'Input suara belum didukung peramban ini. Gunakan ikon mikrofon pada papan ketik HP di formulir.' })], { kembali: true }));
    bicara('as', 'Halo, saya Asisten K3. Saya bisa membantu melapor dengan suara, menyarankan jenis bahaya, dan menjawab pertanyaan singkat.');
  }

  // ---------- Akun ----------
  function hAkun() {
    const nama = h('input', { value: S.sesi.profil.nama_tampilan, maxlength: 80 });
    const s1 = h('input', { type: 'password', autocomplete: 'new-password', minlength: 10, maxlength: 72 }), s2 = h('input', { type: 'password', autocomplete: 'new-password', maxlength: 72 });
    const b1 = h('button', { type: 'submit', class: 'btn kedua' }, 'Simpan nama'), b2 = h('button', { type: 'submit', class: 'btn kedua' }, 'Ganti kata sandi');
    const tema = LS.get('k3_tema', 'otomatis');
    tampil(halaman('Akun', '/akun', [
      h('div', { class: 'kartu profil-kepala' }, h('span', { class: 'avatar', 'aria-hidden': 'true', text: inisial(S.sesi.profil.nama_tampilan) }),
        h('div', {}, h('strong', { text: S.sesi.profil.nama_tampilan }), h('span', { class: 'kecil', text: S.sesi.email }), h('span', { class: 'kecil', text: PERAN[peran()] + (S.sesi.profil.unit_id ? ' · ' + namaUnit(S.sesi.profil.unit_id) : '') }),
          peran() === 'k3rs' ? h('span', { class: 'kecil', text: 'Verifikasi 2 langkah: ' + (S.sesi.aal === 'aal2' ? 'aktif untuk sesi ini' : 'belum') }) : null)),
      h('form', { class: 'kartu', onsubmit: async e => { e.preventDefault(); await sibuk(b1, async () => { await API.ubahNama(nama.value); await muatSesi(); toast('Nama tersimpan', 'ok'); }).catch(() => {}); } }, bidang('Nama tampilan', nama), b1),
      h('form', { class: 'kartu', onsubmit: async e => {
        e.preventDefault();
        if (s1.value !== s2.value) return toast('Kedua kata sandi tidak sama', 'galat');
        if (!(s1.value.length >= 10 && /[a-z]/.test(s1.value) && /[A-Z]/.test(s1.value) && /\d/.test(s1.value))) return toast('Minimal 10 karakter dengan huruf besar, huruf kecil, dan angka', 'galat');
        await sibuk(b2, async () => { await API.gantiSandi(s1.value); s1.value = s2.value = ''; toast('Kata sandi diganti', 'ok'); }).catch(() => {});
      } }, bidang('Kata sandi baru', s1, 'Minimal 10 karakter: huruf besar, huruf kecil, angka.'), bidang('Ulangi kata sandi baru', s2), b2),
      h('div', { class: 'kartu' }, bidang('Tampilan', pilih([['otomatis', 'Ikuti HP'], ['terang', 'Terang'], ['gelap', 'Gelap']], tema, { onchange: e => { LS.set('k3_tema', e.target.value); terapkanTema(); } })),
        tombol([ikon('hapus'), 'Hapus data aplikasi di HP ini (draf, antrean, kode)'], async () => { if (!await konfirmasi('Hapus data di HP ini?', 'Draf, antrean yang belum terkirim, dan kode lacak yang tersimpan di HP ini akan dihapus. Laporan yang sudah terkirim tidak terpengaruh.', 'Hapus', true)) return; [KUNCI_DRAF, KUNCI_ANTREAN, 'k3_kode_saya', 'k3_dilihat', 'k3_unit_terakhir'].forEach(LS.del); toast('Data lokal dihapus', 'ok'); }, 'teks')),
      tombol([ikon('keluar'), 'KELUAR'], mintaKeluar, 'bahaya besar')], { sempit: true }));
  }
  async function keluar() { await API.keluar(); S.sesi = null; S.cacheLaporan = null; pergi('/masuk'); }
  async function mintaKeluar() { if (await konfirmasi('Keluar dari aplikasi?', 'Anda perlu masuk lagi untuk melapor atau melihat laporan. Antrean yang belum terkirim tetap tersimpan di HP ini.', 'Keluar')) keluar(); }

  function terapkanTema() { const t = LS.get('k3_tema', 'otomatis'); if (t === 'otomatis') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', t === 'gelap' ? 'dark' : 'light'); }

  // ---------- Sesi & rute ----------
  async function muatRef() { S.ref = await API.referensi(); }
  async function muatSesi() { S.sesi = await API.sesi(); if (S.sesi && S.sesi.profil && S.sesi.profil.aktif) await muatRef(); }

  const RUTE = {
    '/beranda': hBeranda, '/lapor': hLapor, '/laporan-saya': hLaporanSaya, '/lacak': hLacak, '/bantuan': hBantuan, '/akun': hAkun, '/asisten': hAsisten,
    '/tugas': () => hDaftarSemua('/tugas', 'Tugas saya'), '/semua': () => hDaftarSemua('/semua', peran() === 'k3rs' ? 'Semua laporan' : 'Laporan unit'),
    '/dasbor': hDasbor, '/admin': hAdmin, '/pengguna': hPengguna, '/pengaturan': hPengaturan, '/qr': hQR, '/ekspor': hEkspor, '/log': hLog, '/riset': hRiset, '/paket': hPaket, '/mfa': hMfa
  };
  const HAK = { '/tugas': ['pj_unit', 'k3rs'], '/semua': ['pj_unit', 'k3rs'], '/dasbor': ['pj_unit', 'k3rs'], '/ekspor': ['pj_unit', 'k3rs'], '/admin': ['k3rs'], '/pengguna': ['k3rs'], '/pengaturan': ['k3rs'], '/qr': ['k3rs'], '/log': ['k3rs'], '/riset': ['k3rs'], '/paket': ['k3rs'] };

  async function jalankan() {
    const hash = location.hash.slice(1) || '/beranda';
    const rute = hash.split('?')[0];
    document.body.classList.add('sedang-memuat');
    try {
      if (!S.sesi) { if (rute !== '/masuk') SS.set('k3_tujuan', hash); return hMasuk(); }
      if (!S.sesi.profil || !S.sesi.profil.aktif) {
        return tampil(bilahAtas('Menunggu persetujuan'), h('main', { class: 'isi sempit', id: 'konten' }, h('div', { class: 'kartu sukses' }, h('div', { class: 'besar-ikon tunda', 'aria-hidden': 'true' }, ikon('jam')), h('h2', { text: 'Akun belum aktif' }), h('p', { text: 'Akun Anda (' + S.sesi.email + ') sudah terdaftar tetapi belum diaktifkan oleh admin K3RS. Silakan hubungi admin, lalu masuk kembali.' }), tombol([ikon('keluar'), 'Keluar'], keluar, 'kedua'))));
      }
      const wajibMfa = peran() === 'k3rs' && S.ref.pengaturan.wajib_mfa_admin && S.sesi.aal !== 'aal2';
      if (wajibMfa && rute !== '/mfa') return pergi('/mfa');
      if (rute === '/masuk') return pergi('/beranda');
      if (rute.startsWith('/laporan/')) return await hDetail(decodeURIComponent(rute.slice(9)));
      const f = RUTE[rute]; if (!f) return pergi('/beranda');
      if (HAK[rute] && !HAK[rute].includes(peran())) return tampil(halaman('Tidak berwenang', '', [kosong('Halaman ini bukan untuk peran Anda.')], { kembali: true }));
      await f();
    } catch (e) {
      tampil(halaman('Terjadi kendala', '', [h('div', { class: 'kartu bahaya-kotak' }, h('div', { class: 'kartu-kepala' }, h('span', { class: 'ikon-kotak merah' }, ikon(e.jaringan ? 'putus' : 'awas')), h('strong', { text: e.jaringan ? 'Tidak ada koneksi internet' : 'Terjadi kendala' })), h('p', { text: e.jaringan ? 'Laporan baru tetap bisa dibuat dan akan dikirim nanti.' : e.message }), h('div', { class: 'tombol-baris' }, tombol([ikon('muat'), 'Coba lagi'], () => jalankan(), 'kedua'), tombol('Ke formulir lapor', () => pergi('/lapor'), 'teks')))], { kembali: true }));
    } finally { document.body.classList.remove('sedang-memuat'); }
  }

  async function mulai() {
    terapkanTema();
    const q = new URLSearchParams(location.search); const u = q.get('unit');
    if (u && /^[A-Z0-9_-]{2,20}$/.test(u)) SS.set('k3_unit_qr', u);
    try { await API.init(); await muatSesi(); }
    catch (e) { tampil(bilahAtas('HSE'), h('main', { class: 'isi sempit', id: 'konten' }, h('div', { class: 'kartu bahaya-kotak' }, h('div', { class: 'kartu-kepala' }, h('span', { class: 'ikon-kotak merah' }, ikon('awas')), h('strong', { text: 'Aplikasi belum dapat dimuat' })), h('p', { text: e.message }), tombol([ikon('muat'), 'Muat ulang'], () => location.reload(), 'kedua')))); return; }
    window.addEventListener('hashchange', jalankan);
    await jalankan();
    kirimAntrean();
    if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
  mulai();
})();
