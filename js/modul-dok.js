/* modul-dok.js — SOP & dokumen (ekstraksi teks di perangkat: PDF, DOCX, TXT, gambar/OCR), laporan bulanan,
   status sinkronisasi Google Sheets, lokasi cuaca, dan uji tampilan buta warna. */
(function () {
  'use strict';
  const A = window.K3App, I = window.K3Intel, G = window.K3Grafik;
  if (!A || !I || !G || !A.tab) return;
  const { h, ikon, badge, tombol, sibuk, bidang, pilih, toast, tampil, halaman, kosong, pergi, peran, namaUnit, kat, LS, konfirmasi, JENIS } = A;
  const API = A.API, qs = A.qs;
  const CDN = 'https://cdn.jsdelivr.net/npm/';
  const PUSTAKA = {
    pdf: CDN + 'pdfjs-dist@3.11.174/legacy/build/pdf.min.js', pdfWorker: CDN + 'pdfjs-dist@3.11.174/legacy/build/pdf.worker.min.js',
    docx: CDN + 'mammoth@1.8.0/mammoth.browser.min.js', ocr: CDN + 'tesseract.js@5.1.1/dist/tesseract.min.js', ocrWorker: CDN + 'tesseract.js@5.1.1/dist/worker.min.js', ocrCore: CDN + 'tesseract.js-core@5.1.1'
  };
  const dimuat = {};
  function muatSkrip(src) {
    if (dimuat[src]) return dimuat[src];
    dimuat[src] = new Promise((ok, gagal) => { const s = document.createElement('script'); s.src = src; s.crossOrigin = 'anonymous'; s.onload = ok; s.onerror = () => { delete dimuat[src]; gagal(new Error('Komponen pembaca dokumen gagal dimuat. Periksa internet.')); }; document.head.appendChild(s); });
    return dimuat[src];
  }
  const JENIS_DOK = { sop: 'SOP', ik: 'Instruksi kerja', kebijakan: 'Kebijakan', pedoman: 'Pedoman', formulir: 'Formulir', lainnya: 'Lainnya' };
  const STATUS_DOK = { aktif: ['✓ Aktif', 'rk-0'], diganti: ['⚠ Versi lama (diganti)', 'rk-2'], nonaktif: ['✕ Nonaktif', 'rk-x'] };
  const badgeDok = s => badge((STATUS_DOK[s] || [s])[0], (STATUS_DOK[s] || [, 'netral'])[1]);
  const statusTinjau = d => !d.tanggal_tinjau || d.status !== 'aktif' ? null : d.tanggal_tinjau < I.tanggalLokal() ? badge('⚠ Lewat tanggal tinjau', 'rk-3') : d.tanggal_tinjau <= I.geserHari(I.tanggalLokal(), 30) ? badge('△ Tinjau ≤ 30 hari', 'rk-1') : null;
  // Rantai versi: dari versi tertua sampai terbaru (dokumen lama tidak pernah hilang diam-diam)
  function rantaiVersi(dok, d) {
    let awal = d; const lihat = new Set([d.id]);
    while (awal.menggantikan) { const x = dok.find(z => z.id === awal.menggantikan); if (!x || lihat.has(x.id)) break; lihat.add(x.id); awal = x; }
    const out = [awal]; let k = awal;
    for (;;) { const n = dok.find(z => z.menggantikan === k.id && !out.includes(z)); if (!n) break; out.push(n); k = n; }
    return out;
  }

  // ---------- Ekstraksi teks (di perangkat; berkas tidak dikirim ke layanan lain) ----------
  function potong(teks, mulai) {
    const out = []; let buf = '', n = mulai || 1;
    String(teks).split(/\n\s*\n/).forEach(par => { if ((buf + '\n\n' + par).length > 2500 && buf) { out.push({ halaman: n++, teks: buf.trim() }); buf = ''; } buf += (buf ? '\n\n' : '') + par; });
    if (buf.trim()) out.push({ halaman: n, teks: buf.trim() });
    return out.flatMap(b => b.teks.length > 18000 ? [{ halaman: b.halaman, teks: b.teks.slice(0, 18000) }] : [b]);
  }
  let ocrWorker = null;
  async function ocr(gambar, info) {
    await muatSkrip(PUSTAKA.ocr);
    if (!ocrWorker) { info('Menyiapkan pembaca teks gambar (OCR, ±15 MB sekali unduh)…'); ocrWorker = await window.Tesseract.createWorker(['ind', 'eng'], 1, { workerPath: PUSTAKA.ocrWorker, corePath: PUSTAKA.ocrCore }); }
    const r = await ocrWorker.recognize(gambar); return (r.data && r.data.text || '').trim();
  }
  async function ekstrak(berkas, info) {
    const nama = berkas.name.toLowerCase();
    if (berkas.size > 20 * 1024 * 1024) throw new Error('Berkas terlalu besar (maks. 20 MB)');
    if (/\.txt$/.test(nama) || berkas.type === 'text/plain') return { metode: 'teks', bagian: potong(await berkas.text()) };
    if (/\.docx$/.test(nama)) {
      info('Membaca DOCX…'); await muatSkrip(PUSTAKA.docx);
      const r = await window.mammoth.extractRawText({ arrayBuffer: await berkas.arrayBuffer() }); return { metode: 'docx', bagian: potong(r.value) };
    }
    if (/\.pdf$/.test(nama) || berkas.type === 'application/pdf') {
      info('Membaca PDF…'); await muatSkrip(PUSTAKA.pdf);
      const lib = window.pdfjsLib;
      if (!lib.GlobalWorkerOptions.workerSrc) { const t = await (await fetch(PUSTAKA.pdfWorker)).text(); lib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(new Blob([t], { type: 'text/javascript' })); }
      const pdf = await lib.getDocument({ data: new Uint8Array(await berkas.arrayBuffer()), isEvalSupported: false }).promise;
      const bagian = []; let metode = 'pdf';
      for (let i = 1; i <= Math.min(pdf.numPages, 300); i++) {
        info('Membaca halaman ' + i + ' dari ' + pdf.numPages + '…');
        const hal = await pdf.getPage(i); const tc = await hal.getTextContent();
        let teks = tc.items.map(x => x.str + (x.hasEOL ? '\n' : ' ')).join('').replace(/[ \t]+/g, ' ').trim();
        if (teks.length < 20) { // halaman hasil pindai → OCR
          metode = 'ocr'; info('Halaman ' + i + ' berupa gambar, menjalankan OCR…');
          const vp = hal.getViewport({ scale: 2 }); const c = document.createElement('canvas'); c.width = vp.width; c.height = vp.height;
          await hal.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise; teks = await ocr(c, info);
        }
        if (teks) bagian.push({ halaman: i, teks: teks.slice(0, 18000) });
      }
      return { metode, bagian };
    }
    if (/\.(png|jpe?g)$/.test(nama) || /^image\/(png|jpeg)$/.test(berkas.type)) { info('Membaca teks dari gambar (OCR)…'); return { metode: 'ocr', bagian: potong(await ocr(berkas, info)) }; }
    throw new Error('Format belum didukung. Gunakan PDF, DOCX, TXT, PNG, atau JPG.');
  }
  A.ekstrakDokumen = ekstrak;

  // =====================================================================
  // SOP & DOKUMEN
  // =====================================================================
  async function hSop() {
    const q = qs(); let dok;
    try { dok = await API.daftarDokumen(); } catch (e) { return tampil(halaman('SOP & dokumen', '/sop', [h('div', { class: 'kartu bahaya-kotak' }, h('p', { text: e.message }))])); }
    if (q.get('unggah') && peran() === 'k3rs') return formUnggah(dok);
    if (q.get('id')) return bacaDok(dok, q.get('id'), +q.get('hal') || null);
    const cari = h('input', { type: 'search', placeholder: 'Cari isi SOP, misalnya: LOTO panel listrik', 'aria-label': 'Cari isi dokumen', value: q.get('q') || '' });
    const hasil = h('div', { 'aria-live': 'polite' });
    const jalan = () => A.jalankanCari('SOP ' + cari.value, hasil);
    const grup = s => dok.filter(d => d.status === s);
    const kartuDok = d => h('a', { class: 'kartu dok' + (d.status !== 'aktif' ? ' lama' : ''), href: '#/sop?id=' + encodeURIComponent(d.id) },
      h('span', { class: 'ikon-kotak' }, ikon('sop')), h('span', { class: 'teks-menu' }, h('strong', { text: d.judul }), h('small', { text: [JENIS_DOK[d.jenis], d.nomor, 'v' + d.versi, d.berlaku_mulai ? 'berlaku ' + A.tgl(d.berlaku_mulai) : null, d.unit_id ? namaUnit(d.unit_id) : 'Semua unit'].filter(Boolean).join(' · ') }), statusTinjau(d)), badgeDok(d.status));
    tampil(halaman('SOP & dokumen', '/sop', [
      h('form', { class: 'kartu cari-kotak', onsubmit: e => { e.preventDefault(); jalan(); } }, h('div', { class: 'baris-tanya' }, cari, h('button', { type: 'submit', class: 'btn utama' }, ikon('cari'), 'Cari')),
        h('p', { class: 'kecil', text: 'Pencarian teks penuh di isi dokumen. Hasil selalu menyebut judul, nomor, versi, dan halaman sumber.' })),
      hasil,
      peran() === 'k3rs' ? h('div', { class: 'tombol-baris' }, h('a', { class: 'btn utama', href: '#/sop?unggah=1' }, ikon('tambah'), 'Unggah dokumen')) : null,
      h('section', {}, h('h2', { class: 'judul-bagian', text: 'Dokumen aktif (' + grup('aktif').length + ')' }), h('div', { class: 'grid-menu' }, grup('aktif').length ? grup('aktif').map(kartuDok) : [kosong('Belum ada dokumen aktif.')])),
      grup('diganti').length ? h('details', { class: 'kartu' }, h('summary', { text: 'Versi lama yang sudah diganti (' + grup('diganti').length + ') — bukan SOP aktif' }), h('div', { class: 'grid-menu' }, grup('diganti').map(kartuDok))) : null,
      grup('nonaktif').length ? h('details', { class: 'kartu' }, h('summary', { text: 'Nonaktif (' + grup('nonaktif').length + ')' }), h('div', { class: 'grid-menu' }, grup('nonaktif').map(kartuDok))) : null]));
    if (q.get('q')) jalan();
  }
  async function bacaDok(dok, id, halSorot) {
    const d = dok.find(x => x.id === id); if (!d) return tampil(halaman('Dokumen', '/sop', [kosong('Dokumen tidak ditemukan atau Anda tidak berwenang.')], { kembali: true }));
    const isi = await API.isiDokumen(id); const baru = d.status === 'diganti' ? dok.find(x => x.menggantikan === d.id) : null;
    const ubah = async st => { if (!await konfirmasi('Ubah status dokumen?', 'Status menjadi "' + st + '". Tercatat di log.', 'Ya')) return; await API.ubahDokumen(id, { status: st }); toast('Status diperbarui', 'ok'); A.jalankan(); };
    tampil(halaman(d.judul, '/sop', [
      h('section', { class: 'kartu' }, h('div', { class: 'kartu-kepala' }, h('h2', { text: d.judul }), badgeDok(d.status)),
        h('p', { class: 'kecil', text: [JENIS_DOK[d.jenis], d.nomor || 'tanpa nomor', 'versi ' + d.versi, d.berlaku_mulai ? 'berlaku sejak ' + A.tgl(d.berlaku_mulai) : null, d.unit_id ? 'unit ' + namaUnit(d.unit_id) : 'semua unit', 'teks: ' + d.metode_ekstraksi].filter(Boolean).join(' · ') }),
        h('dl', { class: 'rincian' }, h('dt', { text: 'Pemilik dokumen' }), h('dd', { text: d.pemilik || '—' }), h('dt', { text: 'Tanggal tinjau ulang' }), h('dd', {}, d.tanggal_tinjau ? A.tgl(d.tanggal_tinjau) + ' ' : '—', statusTinjau(d)),
          h('dt', { text: 'Disahkan/diunggah' }), h('dd', { text: A.tgl(d.dibuat_pada) + ' oleh K3RS' }), d.catatan_revisi ? [h('dt', { text: 'Catatan revisi' }), h('dd', { text: d.catatan_revisi })] : null),
        rantaiVersi(dok, d).length > 1 ? h('div', {}, h('h3', { text: 'Riwayat versi' }), h('ol', { class: 'jejak-daftar' }, rantaiVersi(dok, d).map(v => h('li', {}, v.id === d.id ? h('strong', { text: 'v' + v.versi + ' (dokumen ini)' }) : h('a', { href: '#/sop?id=' + encodeURIComponent(v.id), text: 'v' + v.versi }), ' · ' + (v.berlaku_mulai ? 'berlaku ' + A.tgl(v.berlaku_mulai) + ' · ' : ''), badgeDok(v.status), v.catatan_revisi ? h('small', { text: ' — ' + v.catatan_revisi }) : null)))) : null,
        d.status !== 'aktif' ? h('p', { class: 'catatan-batas' }, ikon('awas'), h('span', { text: 'Dokumen ini BUKAN versi aktif.' + (baru ? ' Versi berlaku: ' : '') }), baru ? h('a', { href: '#/sop?id=' + encodeURIComponent(baru.id), text: baru.judul + ' v' + baru.versi }) : null) : null,
        h('div', { class: 'tombol-baris' }, d.path ? tombol([ikon('unduh'), 'Buka berkas asli'], async ev => { await sibuk(ev.currentTarget, async () => { const u = await API.urlDokumen(d.path); if (u) window.open(u, '_blank', 'noopener'); }).catch(() => {}); }, 'kedua') : null,
          tombol([ikon('suara'), 'Bacakan halaman ' + (halSorot || 1)], () => A.bacakan(((isi.find(b => b.halaman === (halSorot || 1)) || isi[0] || {}).teks || '').slice(0, 1500)), 'teks'),
          peran() === 'k3rs' ? [d.status !== 'nonaktif' ? tombol('Nonaktifkan', () => ubah('nonaktif'), 'teks') : tombol('Aktifkan', () => ubah('aktif'), 'teks'), h('a', { class: 'btn teks', href: '#/sop?unggah=1&ganti=' + encodeURIComponent(d.id) }, ikon('muat'), 'Unggah versi baru')] : null)),
      h('section', { class: 'kartu dok-isi' }, isi.length ? isi.map(b => h('article', { class: 'dok-hal' + (b.halaman === halSorot ? ' sorot' : ''), id: 'hal-' + b.halaman }, h('h3', { text: 'Halaman/bagian ' + b.halaman }), h('p', { class: 'teks-dok', text: b.teks }))) : kosong('Isi teks belum tersedia.')),
      peran() === 'k3rs' ? A.panelJejak('dokumen', d.id) : null], { kembali: true }));
    if (halSorot) { const el = document.getElementById('hal-' + halSorot); if (el) el.scrollIntoView({ block: 'start' }); }
  }
  function formUnggah(dok) {
    const ganti = qs().get('ganti'); const lama = dok.find(x => x.id === ganti);
    const berkas = h('input', { type: 'file', accept: '.pdf,.docx,.txt,.png,.jpg,.jpeg,application/pdf,text/plain,image/png,image/jpeg,application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    const judul = h('input', { required: true, maxlength: 200, value: lama ? lama.judul : '' }), nomor = h('input', { maxlength: 60, value: lama ? lama.nomor : '' });
    const versi = h('input', { required: true, maxlength: 20, value: lama ? String((+lama.versi || 0) + 1 || '') : '1' }), jenis = pilih(Object.entries(JENIS_DOK), lama ? lama.jenis : 'sop');
    const berlaku = h('input', { type: 'date', value: I.tanggalLokal() }), unit = pilih([['', 'Semua unit'], ...A.S.ref.unit.map(u => [u.id, u.nama])], lama ? lama.unit_id || '' : '');
    const tambahTahun = (t, n) => { const x = new Date(t + 'T12:00:00Z'); x.setUTCFullYear(x.getUTCFullYear() + n); return x.toISOString().slice(0, 10); };
    const pemilik = h('input', { maxlength: 80, value: lama ? lama.pemilik || '' : '', placeholder: 'Contoh: Komite K3RS' }), tinjau = h('input', { type: 'date', value: tambahTahun(I.tanggalLokal(), 2) });
    const catatanRev = h('input', { maxlength: 500, placeholder: lama ? 'Apa yang berubah dari versi ' + lama.versi + '?' : 'Contoh: terbitan pertama' });
    const gantiSel = pilih([['', '— tidak menggantikan dokumen lain —'], ...dok.filter(x => x.status === 'aktif').map(x => [x.id, x.judul + ' v' + x.versi])], ganti || '');
    const info = h('p', { class: 'kecil', 'aria-live': 'polite' }), pratinjau = h('div', { class: 'pratinjau-dok' });
    let hasil = null;
    berkas.addEventListener('change', async () => {
      const f = berkas.files[0]; hasil = null; pratinjau.replaceChildren(); if (!f) return;
      if (!judul.value) judul.value = f.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ');
      try {
        const r = await ekstrak(f, t => { info.textContent = t; });
        hasil = r; info.textContent = r.bagian.length ? 'Teks terbaca: ' + r.bagian.length + ' halaman/bagian (' + r.metode.toUpperCase() + '). Periksa dan perbaiki bila ada salah baca.' : 'Tidak ada teks terbaca. Tulis isi secara manual di bawah.';
        if (!r.bagian.length) r.bagian = [{ halaman: 1, teks: '' }];
        pratinjau.replaceChildren(...r.bagian.map(b => bidang('Halaman/bagian ' + b.halaman, h('textarea', { rows: 6, maxlength: 18000, value: b.teks, oninput: e => { b.teks = e.target.value; } }))));
      } catch (e) { info.textContent = ''; toast(e.message, 'galat'); }
    });
    const btn = h('button', { type: 'submit', class: 'btn utama besar' }, ikon('simpan'), 'Simpan dokumen');
    tampil(halaman(lama ? 'Versi baru: ' + lama.judul : 'Unggah dokumen', '/sop', [h('form', { class: 'kartu', onsubmit: async e => {
      e.preventDefault(); const f = berkas.files[0];
      if (!f) return toast('Pilih berkas', 'galat'); if (!hasil) return toast('Tunggu sampai teks selesai dibaca', 'galat');
      const bagian = hasil.bagian.filter(b => b.teks.trim()); if (!bagian.length) return toast('Isi teks dokumen kosong', 'galat');
      if (gantiSel.value && !catatanRev.value.trim()) return toast('Tulis catatan revisi untuk versi baru', 'galat');
      const meta = { judul: judul.value.trim(), nomor: nomor.value.trim(), versi: versi.value.trim(), jenis: jenis.value, berlaku_mulai: berlaku.value || null, unit_id: unit.value ? +unit.value : null, menggantikan: gantiSel.value || null, metode_ekstraksi: hasil.metode, status: 'aktif' };
      if (pemilik.value.trim()) meta.pemilik = pemilik.value.trim(); if (tinjau.value) meta.tanggal_tinjau = tinjau.value; if (catatanRev.value.trim()) meta.catatan_revisi = catatanRev.value.trim();
      await sibuk(btn, async () => { const id = await API.simpanDokumen(meta, bagian, f); toast('Dokumen tersimpan dan dapat dicari', 'ok'); pergi('/sop?id=' + encodeURIComponent(id)); }).catch(() => {});
    } }, bidang('Berkas (PDF, DOCX, TXT, PNG, JPG · maks. 20 MB)', berkas, 'Teks dibaca di perangkat ini. PDF hasil pindai dan gambar dibaca dengan OCR.'), info,
      bidang('Judul', judul), h('div', { class: 'tiga' }, bidang('Nomor dokumen', nomor), bidang('Versi', versi), bidang('Jenis', jenis)), h('div', { class: 'tiga' }, bidang('Berlaku mulai', berlaku), bidang('Berlaku untuk', unit), bidang('Menggantikan', gantiSel)),
      h('div', { class: 'tiga' }, bidang('Pemilik dokumen', pemilik), bidang('Tanggal tinjau ulang', tinjau, 'Bawaan 2 tahun; notifikasi muncul 30 hari sebelumnya.'), bidang('Catatan revisi', catatanRev)),
      pratinjau, btn)], { kembali: true, sempit: true }));
  }

  // =====================================================================
  // LAPORAN BULANAN (angka dari agregasi basis data, bukan dikarang AI)
  // =====================================================================
  async function hBulanan() {
    const kini = I.tanggalLokal(); const d = new Date(kini.slice(0, 7) + '-15T12:00:00Z'); d.setUTCMonth(d.getUTCMonth() - 1);
    const periode = qs().get('p') || d.toISOString().slice(0, 7);
    const pilihan = I.deretBulan(18).reverse().map(b => [b, new Date(b + '-15T12:00:00Z').toLocaleDateString('id-ID', { month: 'long', year: 'numeric', timeZone: 'UTC' })]);
    let r, s;
    try { [r, s] = await Promise.all([API.ringkasanBulanan(periode + '-01'), API.ringkasanBulanan(I.deretBulan(2, periode + '-01')[0] + '-01')]); }
    catch (e) { return tampil(halaman('Laporan bulanan', '/bulanan', [h('div', { class: 'kartu bahaya-kotak' }, h('p', { text: e.message }))])); }
    const nama = pilihan.find(x => x[0] === periode)?.[1] || periode;
    const delta = (a, b, kebalikan) => { if (a == null || b == null) return null; const x = a - b; if (!x) return h('small', { class: 'delta', text: '= sama' }); const naik = x > 0; return h('small', { class: 'delta ' + ((naik !== !!kebalikan) ? 'naik' : 'turun'), text: (naik ? '▲ +' : '▼ ') + (Math.round(x * 10) / 10) + ' vs bulan lalu' }); };
    const ub = (label, a, b, ik, kebalikan, satuan) => h('div', { class: 'angka' }, h('span', { class: 'ikon-kotak' }, ikon(ik)), h('span', { class: 'n', text: a == null ? '—' : a + (satuan || '') }), h('span', { class: 'lbl', text: label }), delta(a, b, kebalikan));
    const bar = (o, nm) => G.batang(Object.entries(o || {}).map(([k, n]) => ({ label: nm ? nm(k) : k, n })).sort((a, b) => b.n - a.n));
    // Insight otomatis (aturan; hanya membandingkan angka yang sudah dihitung)
    const ins = [];
    if (r.laporan_total > s.laporan_total) ins.push('Jumlah laporan naik dari ' + s.laporan_total + ' menjadi ' + r.laporan_total + '. Periksa apakah karena bahaya meningkat atau budaya lapor membaik.');
    if (r.laporan_total < s.laporan_total) ins.push('Jumlah laporan turun dari ' + s.laporan_total + ' menjadi ' + r.laporan_total + '. Pastikan penurunan bukan karena pelaporan melemah.');
    if ((r.per_jenis || {}).kejadian) ins.push(r.per_jenis.kejadian + ' kejadian/cedera tercatat; setiap kejadian perlu investigasi akar masalah.');
    if (r.capa_terlambat) ins.push(r.capa_terlambat + ' CAPA melewati target — prioritaskan dalam rapat K3 bulanan.');
    if (r.persen_selesai_bulan_ini != null && r.persen_selesai_bulan_ini < 50) ins.push('Baru ' + r.persen_selesai_bulan_ini + '% laporan bulan ini yang tertutup.');
    if (r.inspeksi_kepatuhan_rata != null && r.inspeksi_kepatuhan_rata < 85) ins.push('Kepatuhan inspeksi rata-rata ' + r.inspeksi_kepatuhan_rata + '% (di bawah 85%).');
    if (r.pemantauan_melebihi) ins.push(r.pemantauan_melebihi + ' hasil pemantauan di luar ambang; tindak lanjuti dengan pengendalian rekayasa.');
    if (!ins.length) ins.push('Tidak ada perubahan menonjol dibanding bulan sebelumnya.');
    const csv = () => A.unduh('laporan-bulanan-' + periode + '.csv', A.keCSV(Object.entries(r).filter(([, v]) => typeof v !== 'object').map(([k, v]) => ({ k, v, p: s[k] })), [['k', 'indikator'], ['v', nama], ['p', 'bulan sebelumnya']]));
    tampil(halaman('Laporan bulanan', '/bulanan', [
      h('div', { class: 'tombol-baris antara no-print' }, pilih(pilihan, periode, { 'aria-label': 'Periode', onchange: e => pergi('/bulanan?p=' + e.target.value) }),
        h('div', { class: 'tombol-baris' }, tombol([ikon('cetak'), 'Cetak / PDF'], () => window.print(), 'kedua'), tombol([ikon('unduh'), 'CSV'], csv, 'kedua'),
          peran() === 'k3rs' ? tombol([ikon('sinkron'), 'Arsipkan & kirim ke Sheets'], async ev => { await sibuk(ev.currentTarget, async () => { await API.buatLaporanBulanan(periode + '-01', true); toast('Laporan ' + nama + ' diarsipkan' + (API.mode === 'demo' ? '' : ' dan diantrekan ke Google Sheets'), 'ok'); }).catch(() => {}); }, 'utama') : null)),
      h('section', { class: 'kartu laporan-bulan-kepala' }, A.kunciMerek('kecil'), h('div', {}, h('h2', { text: 'Laporan K3 — ' + nama }), h('p', { class: 'kecil', text: (A.S.ref.pengaturan.nama_instansi || '') + ' · dihitung ' + I.formatWaktu(r.dihitung_pada || new Date()) + ' WITA dari basis data · data sesuai hak akses Anda' }))),
      h('div', { class: 'grid-angka' }, ub('Total laporan', r.laporan_total, s.laporan_total, 'dokumen'), ub('Hazard', (r.per_jenis || {}).bahaya || 0, (s.per_jenis || {}).bahaya || 0, 'awas'),
        ub('Nyaris celaka', (r.per_jenis || {}).nyaris_celaka || 0, (s.per_jenis || {}).nyaris_celaka || 0, 'tanda'), ub('Kejadian / cedera', (r.per_jenis || {}).kejadian || 0, (s.per_jenis || {}).kejadian || 0, 'awas', true),
        ub('CAPA ditutup', r.capa_ditutup, s.capa_ditutup, 'berhasil'), ub('CAPA terbuka (akhir bulan)', r.capa_terbuka_akhir_bulan, s.capa_terbuka_akhir_bulan, 'jam', true), ub('CAPA terlambat', r.capa_terlambat, s.capa_terlambat, 'jam', true),
        ub('Penyelesaian laporan bulan ini', r.persen_selesai_bulan_ini, s.persen_selesai_bulan_ini, 'centang', false, '%'), ub('Inspeksi', r.inspeksi_jumlah, s.inspeksi_jumlah, 'inspeksi'), ub('Temuan inspeksi', r.inspeksi_temuan, s.inspeksi_temuan, 'awas', true),
        ub('Kepatuhan inspeksi', r.inspeksi_kepatuhan_rata, s.inspeksi_kepatuhan_rata, 'inspeksi', false, '%'), ub('JSA dibuat', r.jsa_jumlah, s.jsa_jumlah, 'jsa'), ub('Pemantauan di luar ambang', r.pemantauan_melebihi, s.pemantauan_melebihi, 'monitor', true), ub('Keluhan kesehatan kerja', r.keluhan_kesehatan, s.keluhan_kesehatan, 'virus', true)),
      h('section', { class: 'kartu' }, h('h2', {}, ikon('otak'), ' Insight otomatis'), h('ul', {}, ins.map(t => h('li', { text: t }))), h('p', { class: 'kecil', text: 'Insight disusun dengan aturan dari angka di atas; tidak ada angka yang ditebak.' })),
      h('div', { class: 'dasbor-grid' },
        h('section', { class: 'kartu' }, h('h2', { text: 'Distribusi tingkat risiko' }), bar(r.per_tingkat)), h('section', { class: 'kartu' }, h('h2', { text: 'Per jenis bahaya' }), bar(r.per_kategori, k => kat(k).nama)),
        h('section', { class: 'kartu' }, h('h2', { text: 'Per unit' }), bar(r.per_unit)), h('section', { class: 'kartu' }, h('h2', { text: 'Per jenis laporan' }), bar(r.per_jenis, k => (JENIS[k] || k).split(' /')[0])))]));
  }

  // =====================================================================
  // GOOGLE SHEETS — status & pengaturan (K3RS)
  // =====================================================================
  async function hSinkron() {
    let r; try { r = await API.sinkronRingkas(); } catch (e) { return tampil(halaman('Google Sheets', '/admin', [h('div', { class: 'kartu bahaya-kotak' }, h('p', { text: e.message }))], { kembali: true })); }
    const ps = r.per_status || {};
    const tokenKotak = h('div', { 'aria-live': 'polite' });
    const buatToken = async ev => {
      if (r.token_terpasang && !await konfirmasi('Ganti token?', 'Token lama berhenti berlaku. Apps Script harus diisi token baru.', 'Ganti', true)) return;
      const b = new Uint8Array(32); crypto.getRandomValues(b); const t = btoa(String.fromCharCode(...b)).replace(/[+/=]/g, c => ({ '+': '-', '/': '_', '=': '' }[c]));
      await sibuk(ev.currentTarget, async () => { await API.sinkronToken(t); tokenKotak.replaceChildren(h('div', { class: 'kartu peringatan' }, h('strong', { text: 'Token baru (hanya ditampilkan sekali):' }), h('code', { class: 'kode-token', text: t }),
        tombol([ikon('salin'), 'Salin'], async () => { try { await navigator.clipboard.writeText(t); toast('Token disalin', 'ok'); } catch (e) { toast('Salin manual', 'galat'); } }, 'kedua kecil'), h('p', { class: 'kecil', text: 'Tempel di Apps Script: Project Settings → Script properties → HSE_TOKEN. Jangan bagikan token ini.' }))); r.token_terpasang = true; }).catch(() => {});
    };
    tampil(halaman('Google Sheets', '/admin', [
      API.mode === 'demo' ? h('p', { class: 'catatan-batas' }, ikon('info'), h('span', { text: 'Mode demo: sinkronisasi hanya berjalan setelah aplikasi tersambung ke Supabase.' })) : null,
      h('div', { class: 'grid-angka' }, A.ubin('Menunggu', ps.menunggu || 0, 'Akan dikirim pada jadwal berikutnya', '', 'jam'), A.ubin('Sedang diproses', ps.diproses || 0, '', '', 'sinkron'), A.ubin('Terkirim', ps.terkirim || 0, '', '', 'berhasil'), A.ubin('Gagal', ps.gagal || 0, 'Dicoba ulang otomatis (maks. 10x)', ps.gagal ? 'merah' : '', 'awas')),
      h('section', { class: 'kartu' }, h('div', { class: 'kartu-kepala' }, h('h2', { text: 'Sambungan' }), badge(r.token_terpasang ? '✓ Token terpasang' : '✕ Belum ada token', r.token_terpasang ? 'rk-0' : 'rk-2')),
        h('ol', {}, h('li', { text: 'Buat Google Spreadsheet baru → Extensions → Apps Script.' }), h('li', { text: 'Salin isi berkas integrasi/google-sheets/Kode.gs dari repositori ke editor Apps Script.' }),
          h('li', { text: 'Isi Script properties: SUPABASE_URL, SUPABASE_ANON_KEY (kunci publik), dan HSE_TOKEN (buat di bawah).' }), h('li', { text: 'Jalankan fungsi pasang() sekali, lalu izinkan akses. Sinkronisasi berjalan tiap 10 menit.' })),
        h('div', { class: 'tombol-baris' }, tombol([ikon('kunci'), r.token_terpasang ? 'Ganti token' : 'Buat token'], buatToken, 'utama'),
          tombol([ikon('muat'), 'Ulang yang gagal'], async ev => { await sibuk(ev.currentTarget, async () => { const n = await API.sinkronUlang(null, true); toast(n + ' baris diantrekan ulang', 'ok'); A.jalankan(); }).catch(() => {}); }, 'kedua'),
          tombol([ikon('sinkron'), 'Sinkron ulang semua data'], async ev => { if (!await konfirmasi('Kirim ulang semua data?', 'Semua catatan diantrekan ulang. Data di Sheets diperbarui berdasarkan ID, tidak digandakan.', 'Kirim ulang')) return; await sibuk(ev.currentTarget, async () => { const n = await API.sinkronUlang(null, false); toast(n + ' baris diantrekan', 'ok'); A.jalankan(); }).catch(() => {}); }, 'kedua')), tokenKotak),
      h('section', { class: 'kartu' }, h('h2', { text: 'Kegagalan terakhir' }), (r.gagal_terakhir || []).length ? h('div', { class: 'tabel-gulir' }, h('table', { class: 'tabel tumpuk' }, h('thead', {}, h('tr', {}, ['Data', 'ID', 'Percobaan', 'Galat'].map(t => h('th', { scope: 'col', text: t })))),
        h('tbody', {}, r.gagal_terakhir.map(g => h('tr', {}, h('td', { 'data-label': 'Data', text: g.tabel }), h('td', { 'data-label': 'ID', text: String(g.id).slice(0, 13) }), h('td', { 'data-label': 'Percobaan', text: String(g.percobaan) }), h('td', { 'data-label': 'Galat', text: g.galat })))))) : h('p', { class: 'ok-teks' }, ikon('centang'), ' Tidak ada kegagalan.')),
      h('section', { class: 'kartu' }, h('h2', { text: 'Log pengiriman' }), (r.log || []).length ? h('ul', {}, r.log.map(l => h('li', { text: I.formatWaktu(l.pada) + ' · ' + l.jenis + ' · ' + l.jumlah + ' baris' + (l.galat ? ' · ' + l.galat : '') }))) : h('p', { class: 'kecil', text: 'Belum ada pengiriman.' }))], { kembali: true }));
  }

  // =====================================================================
  // UJI TAMPILAN BUTA WARNA (simulasi protanopia, deuteranopia, tritanopia, skala abu)
  // =====================================================================
  function filterSvg() {
    const NS = 'http://www.w3.org/2000/svg', s = document.createElementNS(NS, 'svg'); s.setAttribute('class', 'tersembunyi'); s.setAttribute('aria-hidden', 'true');
    const M = { protan: '0.567 0.433 0 0 0 0.558 0.442 0 0 0 0 0.242 0.758 0 0 0 0 0 1 0', deutan: '0.625 0.375 0 0 0 0.7 0.3 0 0 0 0 0.3 0.7 0 0 0 0 0 1 0', tritan: '0.95 0.05 0 0 0 0 0.433 0.567 0 0 0 0.475 0.525 0 0 0 0 0 1 0' };
    const defs = document.createElementNS(NS, 'defs');
    Object.entries(M).forEach(([k, v]) => { const f = document.createElementNS(NS, 'filter'); f.setAttribute('id', 'sim-' + k); const m = document.createElementNS(NS, 'feColorMatrix'); m.setAttribute('type', 'matrix'); m.setAttribute('values', v); f.appendChild(m); defs.appendChild(f); });
    const f = document.createElementNS(NS, 'filter'); f.setAttribute('id', 'sim-abu'); const m = document.createElementNS(NS, 'feColorMatrix'); m.setAttribute('type', 'saturate'); m.setAttribute('values', '0'); f.appendChild(m); defs.appendChild(f);
    s.appendChild(defs); return s;
  }
  function contohPanel() {
    return h('div', { class: 'uji-panel' }, h('div', { class: 'chip-baris' }, A.badgeTingkat(3), A.badgeTingkat(8), A.badgeTingkat(12), A.badgeTingkat(20)),
      h('div', { class: 'chip-baris' }, A.badgeStatus('baru'), A.badgeStatus('dalam_tindak_lanjut'), A.badgeStatus('tertutup'), A.K3Status ? A.K3Status('melebihi') : null),
      G.batang([{ label: 'Rendah', n: 4, w: 'aman' }, { label: 'Sedang', n: 6, w: 'waspada' }, { label: 'Tinggi', n: 3, w: 'tinggi' }, { label: 'Sangat tinggi', n: 2, w: 'kritis' }], { persen: false }),
      G.matriks({ 4: { 3: 2 }, 2: { 2: 1 }, 5: { 4: 1 } }));
  }
  function hUjiWarna() {
    const sim = [['normal', 'Penglihatan normal'], ['protan', 'Protanopia (merah lemah)'], ['deutan', 'Deuteranopia (hijau lemah)'], ['tritan', 'Tritanopia (biru lemah)'], ['abu', 'Skala abu (buta warna total)']];
    tampil(halaman('Uji tampilan buta warna', '/akun', [filterSvg(),
      h('p', { class: 'kecil', text: 'Simulasi bagaimana tampilan tema saat ini terlihat oleh pengguna dengan gangguan penglihatan warna. Informasi tetap terbaca bila setiap status memiliki simbol (○ △ ◇ ✕ ✓ ▲) dan teks, bukan hanya warna. Tema "Aksesibel" menambahkan pola dan kontras lebih tinggi.' }),
      h('div', { class: 'tombol-baris' }, ['bentenan', 'navy', 'aksesibel'].map(t => tombol(t === 'bentenan' ? 'Tema Bentenan' : t === 'navy' ? 'Tema Navy' : 'Tema Aksesibel', () => { LS.set('k3_skema', t); A.terapkanTema(); }, LS.get('k3_skema', 'bentenan') === t ? 'utama kecil' : 'kedua kecil'))),
      h('div', { class: 'uji-grid' }, sim.map(([id, label]) => h('section', { class: 'kartu' }, h('h2', { text: label }), h('div', { class: 'sim sim-' + id }, contohPanel()))))], { kembali: true }));
  }

  // ---------- Lokasi cuaca di Pengaturan (K3RS) ----------
  const pengaturanAsli = A.RUTE['/pengaturan'];
  A.RUTE['/pengaturan'] = async function () {
    await pengaturanAsli();
    const p = A.S.ref.pengaturan; const isi = document.getElementById('konten'); if (!isi) return;
    const lat = h('input', { type: 'number', step: '0.00001', min: -90, max: 90, value: p.lintang != null ? p.lintang : 1.4748, required: true }), lon = h('input', { type: 'number', step: '0.00001', min: -180, max: 180, value: p.bujur != null ? p.bujur : 124.8421, required: true });
    const btn = h('button', { type: 'submit', class: 'btn kedua' }, ikon('simpan'), 'Simpan lokasi');
    isi.appendChild(h('form', { class: 'kartu', onsubmit: async e => { e.preventDefault(); await sibuk(btn, async () => { await API.simpanPengaturan({ lintang: +lat.value, bujur: +lon.value }); A.S.ref = await API.referensi(); LS.del('k3_cuaca'); toast('Lokasi cuaca tersimpan', 'ok'); }).catch(() => {}); } },
      h('h2', {}, ikon('awan'), ' Lokasi rumah sakit untuk peringatan cuaca'), h('p', { class: 'kecil', text: 'Koordinat dipakai untuk mengambil prakiraan cuaca gratis dari Open-Meteo. Bawaan: Manado.' }),
      h('div', { class: 'dua' }, bidang('Lintang', lat), bidang('Bujur', lon)),
      navigator.geolocation ? tombol([ikon('lokasi'), 'Pakai lokasi perangkat ini'], () => navigator.geolocation.getCurrentPosition(pos => { lat.value = pos.coords.latitude.toFixed(5); lon.value = pos.coords.longitude.toFixed(5); }, () => toast('Lokasi tidak diizinkan', 'galat')), 'teks') : null, btn));
  };

  Object.assign(A.RUTE, { '/sop': hSop, '/bulanan': hBulanan, '/sinkron': hSinkron, '/uji-warna': hUjiWarna });
  Object.assign(A.HAK, { '/bulanan': ['k3rs', 'pj_unit'], '/sinkron': ['k3rs'] });
})();
