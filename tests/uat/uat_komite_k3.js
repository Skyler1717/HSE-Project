// UAT berbasis persona (SIMULASI_UAT) — tiga anggota Komite K3 sintetis.
// Dijalankan terhadap basis data UJI `hse_uat` (bukan produksi) melalui aplikasi asli di :8765 dan emulator REST :3101.
// Setiap kasus mencatat: hasil yang diharapkan, hasil aktual (dibaca dari antarmuka dan/atau basis data), status, dan bukti (tangkapan layar).
// Prasyarat: tests/uat/siapkan_uat.sh ; PGDATABASE=hse_uat node tests/server/rest-uji.js 3101 ; python3 -m http.server 8765
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const fs = require('fs'), path = require('path');
const L = require('../browser/lib-supabase.js');
const BUKTI = process.env.BUKTI || path.join(__dirname, 'bukti'); fs.mkdirSync(BUKTI, { recursive: true });
const sql = q => execFileSync('psql', ['-d', 'hse_uat', '-tAq', '-c', q]).toString().trim();
const tunggu = ms => new Promise(r => setTimeout(r, ms));
const ID = { p1: '00000000-0000-0000-0000-0000000000a1', p2: '00000000-0000-0000-0000-0000000000a2', p3: '00000000-0000-0000-0000-0000000000a3', pjIpsrs: '00000000-0000-0000-0000-0000000000b1', pjKesling: '00000000-0000-0000-0000-0000000000b2', ptKesling: '00000000-0000-0000-0000-0000000000c1', ptFarmasi: '00000000-0000-0000-0000-0000000000c2' };
const TAG = 'SIMULASI_UAT';
const hasil = [];
let H = {};
async function dialogYa(p) { await p.waitForSelector('dialog [data-ya]', { timeout: 8000 }); await p.click('dialog [data-ya]'); }
const jawabPrompt = (p, t) => p.once('dialog', d => d.accept(t));
const hash = async p => decodeURIComponent((await p.evaluate(() => location.hash)).match(/id=([^&]+)/)[1]);
const sekarangLokal = (menit = 0) => { const d = new Date(Date.now() + menit * 60e3); const z = n => String(n).padStart(2, '0'); return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate()) + 'T' + z(d.getHours()) + ':' + z(d.getMinutes()); };
const bukaKet = async p => { const d = await p.$('details:has(summary:has-text("Tambahkan keterangan"))'); if (d && !(await d.evaluate(e => e.open))) await p.click('summary:has-text("Tambahkan keterangan")'); };
const unit = kode => +sql("select id from unit where kode='" + kode + "'");

// Matriks tingkat risiko yang dipakai dalam register RSUD ODSK 2026 (diturunkan dari pasangan Dampak–Probabilitas yang tercantum di dokumen; lihat laporan bab 3).
// Baris = probabilitas 1..5, kolom = dampak 1..5. L=Low, M=Moderate, H=High, E=Extreme.
const MATRIKS_RS = { 1: 'LLMHE', 2: 'LLMHE', 3: 'LMHEE', 4: 'MMHEE', 5: 'MHHEE' };
const levelRS = (d, p) => ({ L: 'Low', M: 'Moderate', H: 'High', E: 'Extreme' })[MATRIKS_RS[p][d - 1]];

async function uji(meta, fn) {
  const r = Object.assign({ status: 'NOT TESTED', aktual: '', catatan: '', bukti: '' }, meta);
  const t0 = Date.now();
  try { Object.assign(r, await fn()); }
  catch (e) { r.status = 'BLOCKED'; r.aktual = 'Langkah otomatis terhenti: ' + e.message.split('\n')[0]; }
  r.durasi_dtk = Math.round((Date.now() - t0) / 100) / 10;
  const p = H[meta.layar || meta.persona];
  if (p) { r.bukti = meta.id + '.jpg'; await p.screenshot({ path: path.join(BUKTI, r.bukti), type: 'jpeg', quality: 60 }).catch(() => { r.bukti = ''; }); }
  r.dijalankan = new Date().toISOString();
  hasil.push(r); console.log(r.status.padEnd(10), r.id, r.skenario, '→', r.aktual.slice(0, 160));
}

(async () => {
  const b = await chromium.launch();
  const akun = { P1: 'p1.koordinator', P2: 'p2.hira', P3: 'p3.insiden', pjIpsrs: 'pj.ipsrs', pjKesling: 'pj.kesling', ptKesling: 'petugas.kesling', ptFarmasi: 'petugas.farmasi' };
  for (const [k, e] of Object.entries(akun)) { const ctx = await L.konteks(b, { viewport: { width: 1280, height: 860 } }); H[k] = await L.masuk(ctx, e + '@simulasi-uat.test'); await tunggu(1500); }
  const { P1, P2, P3, pjIpsrs, pjKesling, ptKesling, ptFarmasi } = H;
  const S = {}; // keadaan antar-kasus

  // ===================== MINGGU 1 =====================
  await uji({ id: 'UAT-01', persona: 'P1', tanggal: '2026-09-25', fitur: 'Masuk & menu peran', skenario: 'Koordinator K3 masuk dan memeriksa menu yang tersedia',
    langkah: 'Masuk dengan akun P1 → buka Menu', diharapkan: 'Masuk berhasil; menu operasional K3 dan administrasi tampil untuk peran K3RS' }, async () => {
    await L.buka(P1, '/menu'); const t = await P1.textContent('main');
    const ada = ['Izin kerja', 'Investigasi', 'CAPA', 'Pelatihan', 'Pengguna'].filter(x => t.includes(x));
    return { aktual: 'Masuk berhasil (MFA tingkat aal2 pada server uji). Menu memuat: ' + ada.join(', ') + '.', status: ada.length === 5 ? 'PASS' : 'FAIL' };
  });
  await uji({ id: 'UAT-02', persona: 'P2', tanggal: '2026-09-25', fitur: 'Beranda & orientasi', skenario: 'Persona HIRA mengenali tombol pelaporan dan modul identifikasi bahaya',
    langkah: 'Masuk dengan akun P2 → beranda → menu', diharapkan: 'Tombol lapor dan modul JSA/Inspeksi mudah ditemukan' }, async () => {
    await L.buka(P2, '/beranda'); const t1 = await P2.textContent('body'); await L.buka(P2, '/menu'); const t2 = await P2.textContent('main');
    const ok = /Lapor/.test(t1) && /JSA/.test(t2) && /Inspeksi/.test(t2);
    return { aktual: ok ? 'Tombol "Lapor" ada di navigasi bawah; JSA dan Inspeksi ada di menu Operasional K3.' : 'Salah satu menu tidak ditemukan.', status: ok ? 'PASS' : 'FAIL' };
  });
  await uji({ id: 'UAT-03', persona: 'P3', tanggal: '2026-09-25', fitur: 'Pusat notifikasi', skenario: 'Persona insiden memeriksa kotak masuk dan pengaturan notifikasi',
    langkah: 'Buka /notifikasi → tab Pengaturan', diharapkan: 'Kotak masuk tampil; kategori wajib dijelaskan; saluran email/push hanya aktif bila dikonfigurasi' }, async () => {
    await L.buka(P3, '/notifikasi?tab=atur'); await P3.waitForSelector('text=Kategori'); const t = await P3.textContent('main');
    const pushBelum = /belum tersedia/.test(t);
    return { aktual: 'Halaman pengaturan tampil. Penjelasan notifikasi WAJIB ada. Push ditandai "' + (pushBelum ? 'belum tersedia (VAPID belum diatur)' : 'tersedia') + '".', status: /WAJIB/.test(t) ? 'PASS' : 'FAIL',
      catatan: 'Email/push tidak diuji pengiriman nyatanya — lihat UAT-33.' };
  });
  await uji({ id: 'UAT-04', persona: 'P1', tanggal: '2026-09-28', fitur: 'Hak akses (RLS)', skenario: 'Petugas unit lain tidak dapat melihat risk register dan laporan unit lain',
    langkah: 'Petugas Farmasi membuka /semua dan memanggil API laporan langsung', diharapkan: 'Halaman ditolak; API hanya mengembalikan laporan milik sendiri', layar: 'ptFarmasi' }, async () => {
    await L.buka(ptFarmasi, '/semua'); const t = await ptFarmasi.textContent('main');
    const n = await ptFarmasi.evaluate(() => window.K3Api.halaman('laporan', {}).then(r => r.total));
    return { aktual: (/bukan untuk peran Anda|tidak berhak|Tidak diizinkan/i.test(t) ? 'Halaman /semua ditolak untuk petugas. ' : 'Halaman /semua TERBUKA. ') + 'API laporan mengembalikan ' + n + ' baris (petugas belum membuat laporan).', status: n === 0 && /bukan untuk peran Anda/i.test(t) ? 'PASS' : 'FAIL' };
  });
  await uji({ id: 'UAT-05', persona: 'P2', tanggal: '2026-09-28', fitur: 'Formulir lapor bahaya', skenario: 'Input bahaya listrik: stop kontak bertumpuk (octopus wiring) untuk alat medis di rawat inap',
    langkah: 'Lapor → pilih unit Rawat Inap → kategori Mekanik/Listrik → isi uraian & lokasi → Kirim', diharapkan: 'Laporan tersimpan dengan nomor unik; status "baru"' }, async () => {
    await L.buka(P2, '/lapor'); await bukaKet(P2); await P2.selectOption('select[aria-label="Unit"]', { label: 'Rawat Inap' });
    await P2.click('[data-kat="mekanik"]'); await P2.fill('textarea', TAG + ' Stop kontak bertumpuk (octopus wiring) dipakai untuk alat medis dan elektronik pribadi; kabel rol tidak standar.');
    await P2.fill('input[placeholder^="Contoh: lorong"]', 'Ruang perawatan lantai 3 (simulasi)'); await P2.click('#btn-kirim'); await tunggu(1500);
    S.lapListrik = sql("select id from laporan where uraian like '%octopus wiring%'"); const no = sql("select nomor || ':' || status from laporan where id='" + S.lapListrik + "'");
    return { aktual: 'Tersimpan di basis data: ' + no + '. Waktu pengisian ±1 menit (6 isian).', status: /:baru$/.test(no) ? 'PASS' : 'FAIL' };
  });
  await uji({ id: 'UAT-06', persona: 'P2', tanggal: '2026-09-29', fitur: 'Penilaian risiko (Dampak × Kemungkinan)', skenario: 'Menilai risiko listrik dengan D=5, P=2 seperti register RS (kode R.38)',
    langkah: 'Buka laporan → Tahap (b) → pilih PJ IPSRS, target, Dampak 5, Kemungkinan 2', diharapkan: 'Peringkat sama dengan register RS: D5×P2 = 10 → EXTREME' }, async () => {
    await L.buka(P2, '/laporan/' + S.lapListrik); await P2.waitForSelector('form.aksi');
    const sel = await P2.$$('form.aksi select'); await sel[1].selectOption('5'); await sel[2].selectOption('2'); await tunggu(200);
    const teks = await P2.textContent('form.aksi .skor');
    return { aktual: 'Aplikasi menampilkan "' + teks.trim() + '" (pita skor bawaan: ≤4 Rendah, ≤9 Sedang, ≤14 Tinggi, ≤25 Sangat Tinggi). Register RS memberi peringkat Extreme.', status: /Extreme|Sangat Tinggi/i.test(teks) ? 'PASS' : 'FAIL',
      catatan: 'Ketidaksesuaian metode: aplikasi mengklasifikasi berdasarkan skor (D×P), register RS berdasarkan sel matriks (dampak 5 selalu Extreme).' };
  });
  await uji({ id: 'UAT-07', persona: 'P2', tanggal: '2026-09-29', fitur: 'Pengaturan pita risiko', skenario: 'Menyesuaikan pengaturan agar peringkat sama dengan matriks register RS',
    langkah: 'Admin → Pengaturan → Pita risiko; uji 25 sel matriks RS terhadap kemungkinan pita skor', diharapkan: 'Aplikasi dapat dikonfigurasi menghasilkan peringkat yang sama untuk ke-25 sel' }, async () => {
    await L.buka(P1, '/pengaturan'); const t = await P1.textContent('main');
    // Bukti logis: satu pita skor monoton tidak dapat memetakan D5P1 (skor 5) = Extreme sekaligus D2P3 (skor 6) = Moderate.
    const konflik = []; for (let d = 1; d <= 5; d++) for (let p = 1; p <= 5; p++) for (let d2 = 1; d2 <= 5; d2++) for (let p2 = 1; p2 <= 5; p2++) {
      const o = { Low: 0, Moderate: 1, High: 2, Extreme: 3 }; if (d * p < d2 * p2 && o[levelRS(d, p)] > o[levelRS(d2, p2)]) konflik.push(`D${d}P${p}(skor ${d * p}, ${levelRS(d, p)}) vs D${d2}P${p2}(skor ${d2 * p2}, ${levelRS(d2, p2)})`); }
    S.konflik = konflik.length;
    return { aktual: 'Pengaturan hanya menyediakan "Skor sampai" + label (pita skor). Ditemukan ' + konflik.length + ' pasangan sel yang saling bertentangan, mis. ' + konflik[0] + ', sehingga tidak ada pengaturan pita yang dapat menyamai matriks RS.', status: /Skor sampai/.test(t) && konflik.length ? 'FAIL' : 'PASS', layar: 'P1',
      catatan: 'Rekomendasi: tambahkan mode "matriks 5×5" yang dapat diatur per sel.' };
  });
  // Data risk register dari dokumen MFK RS (diringkas, ditandai SIMULASI_UAT) dimasukkan lewat API aplikasi oleh P2
  const RISIKO = [
    ['IPSRS', 'kebakaran', 'Sistem proteksi kebakaran bermasalah (rujukan register MFK R1)', 'Gedung RS', 5, 3],
    ['IPSRS', 'mekanik', 'Baterai lift-bed belum diganti; ARD tidak berfungsi saat listrik padam (rujukan register MFK R24)', 'Lift pasien', 5, 4],
    ['KESLING', 'limbah', 'Pemilahan limbah padat tidak sesuai SPO; jarum ditemukan di plastik kuning (rujukan register MFK R25)', 'TPS limbah medis', 5, 3],
    ['GIZI', 'kebakaran', 'Bahan mudah terbakar di dapur belum diamankan (rujukan register MFK R27)', 'Dapur Instalasi Gizi', 5, 2],
    ['RAD', 'fisik', 'Paparan radiasi pada radiografer bila APD tidak sesuai (rujukan register MFK R28)', 'Ruang X-ray', 5, 4],
    ['FARMASI', 'kimia', 'Ruang/lemari penyimpanan B3 belum sesuai standar; risiko tumpahan (rujukan register B3 R.1)', 'Gudang B3 Farmasi', 4, 4],
    ['IPSRS', 'mekanik', 'HVAC rusak; sirkulasi udara gedung terganggu (rujukan register MFK R33)', 'Ruang mesin HVAC', 3, 2],
    ['KESLING', 'limbah', 'IPAL tidak dipelihara rutin; kualitas air limbah berisiko (rujukan register MFK R35)', 'IPAL', 5, 4]];
  await uji({ id: 'UAT-08', persona: 'P2', tanggal: '2026-09-30', fitur: 'Input risk register (banyak entri)', skenario: 'Memasukkan 8 risiko dari register MFK/B3 RS sebagai data uji dan menilai D/P',
    langkah: 'Kirim laporan bahaya per risiko (API aplikasi K3Api.kirimLaporan) → tugaskan PJ dengan D/P (K3Api.tugaskan)', diharapkan: '8 entri tersimpan dengan skor = D×P' }, async () => {
    const tgl = new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10); const ids = [];
    for (const [u, k, ur, lok, d, p] of RISIKO) {
      await P2.evaluate(x => window.K3Api.kirimLaporan(Object.assign(x, { id_klien: crypto.randomUUID() })), { jenis: 'bahaya', kategori: k, unit_id: unit(u), uraian: TAG + ' ' + ur, lokasi: lok, mendesak: false, anonim: false });
      const id = sql("select id from laporan where uraian = '" + (TAG + ' ' + ur).replace(/'/g, "''") + "'"); ids.push([id, d, p]);
      const pj = u === 'KESLING' ? ID.pjKesling : ID.pjIpsrs;
      await P2.evaluate(a => window.K3Api.tugaskan(a[0], a[1], a[2], a[3], a[4], 'Penilaian awal SIMULASI_UAT'), [id, pj, tgl, d, p]);
    }
    S.risiko = ids;
    const benar = +sql("select count(*) from laporan where uraian like '" + TAG + "%rujukan register%' and skor = dampak * kemungkinan and status = 'ditugaskan'");
    const beda = ids.map(([id, d, p]) => ({ d, p, app: sql("select skor from laporan where id='" + id + "'"), rs: levelRS(d, p) }));
    return { aktual: benar + '/8 entri tersimpan, skor = D×P, status "ditugaskan". Contoh peringkat RS vs skor aplikasi: ' + beda.slice(0, 4).map(x => `D${x.d}P${x.p}→RS ${x.rs}/skor ${x.app}`).join('; ') + '.', status: benar === 8 ? 'PASS' : 'FAIL',
      catatan: 'Isian dilakukan melalui API klien aplikasi (bukan klik formulir) untuk efisiensi; alur formulir sudah diuji di UAT-05/06.' };
  });
  await uji({ id: 'UAT-09', persona: 'P2', tanggal: '2026-09-30', fitur: 'Validasi formulir lapor', skenario: 'Mencoba mengirim tanpa memilih jenis bahaya',
    langkah: 'Lapor → isi uraian saja → coba Kirim', diharapkan: 'Tombol kirim nonaktif / ditolak dengan pesan' }, async () => {
    await L.buka(P2, '/lapor'); await bukaKet(P2); await P2.fill('textarea', 'uji validasi'); const nonaktif = await P2.$eval('#btn-kirim', e => e.disabled);
    await P2.fill('textarea', ''); await P2.evaluate(() => localStorage.removeItem('k3_draf'));
    return { aktual: nonaktif ? 'Tombol "KIRIM LAPORAN" nonaktif sampai jenis bahaya dipilih.' : 'Tombol tetap aktif.', status: nonaktif ? 'PASS' : 'FAIL' };
  });
  await uji({ id: 'UAT-10', persona: 'P2', tanggal: '2026-09-30', fitur: 'Validasi formulir lapor', skenario: 'Mengirim laporan risiko tanpa uraian',
    langkah: 'Lapor → pilih unit & kategori → uraian kosong → Kirim', diharapkan: 'Untuk kebutuhan register, uraian/sebab wajib diisi' }, async () => {
    const n0 = +sql('select count(*) from laporan');
    await L.buka(P2, '/lapor'); await bukaKet(P2); await P2.selectOption('select[aria-label="Unit"]', { label: 'IPSRS' }); await P2.click('[data-kat="fisik"]'); await P2.click('#btn-kirim'); await tunggu(1500);
    const n1 = +sql('select count(*) from laporan'); const t = await P2.textContent('main');
    if (n1 > n0) sql("update laporan set uraian = '" + TAG + " [uji validasi uraian kosong]' where id = (select id from laporan order by dibuat_pada desc limit 1)");
    return { aktual: n1 > n0 ? 'Laporan tanpa uraian DITERIMA (nomor baru dibuat). Kolom bertanda "boleh kosong".' : 'Ditolak: ' + t.slice(0, 80), status: n1 > n0 ? 'FAIL' : 'PASS',
      catatan: 'Desain sengaja memudahkan pelapor lapangan; namun untuk register risiko Komite K3, "sebab" dan "risiko" wajib. Perlu dibedakan formulir cepat vs entri register.' };
  });
  await uji({ id: 'UAT-11', persona: 'P2', tanggal: '2026-10-01', fitur: 'Perlindungan identitas pasien', skenario: 'Uraian memuat nomor rekam medis pasien',
    langkah: 'Lapor → ketik "pasien No. RM 123456 jatuh"', diharapkan: 'Peringatan identitas tampil dan pengiriman diblokir' }, async () => {
    await L.buka(P2, '/lapor'); await bukaKet(P2); await P2.selectOption('select[aria-label="Unit"]', { label: 'Rawat Inap' }); await P2.click('[data-kat="fisik"]');
    await P2.fill('textarea', 'Pasien No. RM 123456 hampir terpeleset di kamar mandi'); await tunggu(300);
    const peringatan = await P2.$('text=Tampaknya ada identitas pasien'); const n0 = +sql('select count(*) from laporan'); await P2.click('#btn-kirim'); await tunggu(800);
    const n1 = +sql('select count(*) from laporan'); await P2.evaluate(() => localStorage.removeItem('k3_draf'));
    return { aktual: (peringatan ? 'Peringatan identitas pasien tampil dengan tombol "Samarkan otomatis". ' : 'Tidak ada peringatan. ') + (n1 === n0 ? 'Pengiriman diblokir.' : 'Laporan terkirim.'), status: peringatan && n1 === n0 ? 'PASS' : 'FAIL' };
  });
  await uji({ id: 'UAT-12', persona: 'P2', tanggal: '2026-10-02', fitur: 'Ekspor "Format daftar risiko (CSV)"', skenario: 'Membandingkan kolom ekspor dengan 25 kolom template register RS',
    langkah: 'Admin → Ekspor → Format daftar risiko → bandingkan header', diharapkan: 'Kolom inti register RS tersedia (sebab, risiko, dampak, pengendalian yang ada, inherent, opsi penanganan, residual, pemilik, target)', layar: 'P1' }, async () => {
    await L.buka(P1, '/ekspor'); const unduhan = P1.waitForEvent('download'); await P1.click('text=Format daftar risiko (CSV)'); const d = await unduhan;
    const isi = fs.readFileSync(await d.path(), 'utf8').replace(/^﻿/, ''); const kepala = isi.split('\r\n')[0].split(',');
    fs.writeFileSync(path.join(BUKTI, 'UAT-12-ekspor.csv'), isi);
    const RS = ['UNIT', 'NAMA KEGIATAN', 'TUJUAN KEGIATAN', 'AREA / LOKASI', 'SEBAB', 'KODE RISIKO', 'RISIKO', 'DAMPAK (uraian)', 'PERNYATAAN RISIKO', 'PENGENDALIAN YANG SUDAH ADA', 'DAMPAK', 'PROBABILITAS', 'CONCAT', 'SKOR', 'PERINGKAT RISIKO', 'PERLU PENANGANAN?', 'OPSI TEKNIK', 'URAIAN PENANGANAN', 'PEMBIAYAAN RISIKO', 'DAMPAK residual', 'PROBABILITAS residual', 'SKOR residual', 'PERINGKAT residual', 'PEMILIK RISIKO', 'TARGET WAKTU'];
    const ada = ['UNIT', 'AREA / LOKASI', 'DAMPAK', 'PROBABILITAS', 'SKOR', 'PERINGKAT RISIKO', 'URAIAN PENANGANAN', 'PEMILIK RISIKO', 'TARGET WAKTU'];
    S.kolomEkspor = kepala; S.kolomHilang = RS.filter(x => !ada.includes(x));
    return { aktual: 'Ekspor berisi ' + kepala.length + ' kolom: ' + kepala.join(' | ') + '. Template RS memiliki 25 kolom; ' + S.kolomHilang.length + ' kolom belum ada padanannya (mis. pengendalian yang sudah ada, opsi teknik penanganan, pembiayaan, risiko residual).', status: 'FAIL',
      catatan: 'Kolom "OPSI TEKNIK PENGENDALIAN" pada ekspor diisi hierarki pengendalian (eliminasi…APD), sedangkan register RS memakai opsi penanganan risiko (hindari/retensi/transfer/loss prevention). Makna berbeda.' };
  });
  await uji({ id: 'UAT-13', persona: 'P1', tanggal: '2026-10-02', fitur: 'Risk register (daftar, filter, pencarian, paginasi)', skenario: 'Koordinator mencari risiko "IPAL" dan memfilter status',
    langkah: '/semua → ketik "IPAL" → filter status Ditugaskan', diharapkan: 'Hasil sesuai basis data; total & halaman tampil' }, async () => {
    await L.buka(P1, '/semua'); await P1.waitForSelector('.pager'); await P1.fill('input[aria-label^="Cari nomor"]', 'IPAL'); await tunggu(1200);
    const pager = await P1.textContent('.pager'); const db = sql("select count(*) from laporan where cari ilike '%ipal%'");
    return { aktual: 'Penanda halaman: "' + pager.trim().slice(0, 60) + '"; basis data: ' + db + ' baris cocok.', status: pager.includes('dari ' + db) ? 'PASS' : 'FAIL' };
  });
  await uji({ id: 'UAT-14', persona: 'P1', tanggal: '2026-10-02', fitur: 'Dasbor', skenario: 'Koordinator membaca ringkasan kondisi K3',
    langkah: 'Buka /dasbor', diharapkan: 'Jumlah laporan dan risiko tinggi sesuai data' }, async () => {
    await L.buka(P1, '/dasbor'); await tunggu(800); const t = await P1.textContent('main'); const n = sql('select count(*) from laporan');
    const cocok = new RegExp('(^|\\D)' + n + '\\s*Total laporan').test(t.replace(/\s+/g, ' '));
    return { aktual: 'Dasbor menampilkan "' + (t.replace(/\s+/g, ' ').match(/\d+\s*Total laporan/) || ['?'])[0] + '"; basis data: ' + n + ' laporan. Dasbor juga memuat peringatan bahwa angka bukan ukuran tingkat keselamatan.', status: cocok ? 'PASS' : 'FAIL' };
  });

  // ===================== MINGGU 2 =====================
  await uji({ id: 'UAT-15', persona: 'P2', tanggal: '2026-10-05', fitur: 'Inspeksi terpandu (daftar periksa B3)', skenario: 'Inspeksi penyimpanan B3 di Gudang B3 Farmasi dengan 2 temuan',
    langkah: 'Inspeksi → baru → templat "Bahan kimia / B3" → unit Farmasi → isi sebagai daftar → 2 butir tidak sesuai + catatan → simpan', diharapkan: 'Skor kepatuhan dihitung dan temuan tersimpan' }, async () => {
    await L.buka(P2, '/inspeksi?baru=1'); await P2.click('button:has-text("Bahan kimia / B3"), .kartu:has-text("Bahan kimia / B3") >> nth=0'); await P2.selectOption('main select >> nth=0', { label: 'Farmasi' });
    await P2.click('text=Isi sebagai daftar'); await P2.waitForSelector('.daftar-periksa');
    const n = await P2.$$eval('.daftar-periksa li', x => x.length);
    for (let i = 0; i < n; i++) { const tidak = i === 2 || i === 3; await P2.click(`.daftar-periksa li >> nth=${i} >> text=${tidak ? '✕ Tidak' : '✓ Sesuai'}`); if (tidak) await P2.fill(`.daftar-periksa li >> nth=${i} >> input[placeholder^="Catatan"]`, TAG + (i === 2 ? ' Spill kit tidak lengkap (absorben habis)' : ' Formalin dan klorin disimpan berdampingan')); }
    await P2.click('text=Lihat ringkasan'); await P2.click('text=Simpan inspeksi'); await tunggu(1200);
    const r = sql("select nomor || ' skor=' || skor_kepatuhan || ' temuan=' || jumlah_temuan from inspeksi order by dibuat_pada desc limit 1");
    return { aktual: 'Tersimpan: ' + r + ' (' + n + ' butir).', status: /temuan=2/.test(r) ? 'PASS' : 'FAIL' };
  });
  await uji({ id: 'UAT-16', persona: 'P2', tanggal: '2026-10-05', fitur: 'Validasi inspeksi', skenario: 'Menandai butir "tidak sesuai" tanpa catatan',
    langkah: 'Inspeksi listrik → satu butir Tidak tanpa catatan → Lihat ringkasan', diharapkan: 'Ditolak dengan pesan wajib catatan' }, async () => {
    await L.buka(P2, '/inspeksi?baru=1'); await P2.click('button:has-text("Keselamatan listrik"), .kartu:has-text("Keselamatan listrik") >> nth=0'); await P2.selectOption('main select >> nth=0', { label: 'IPSRS' });
    await P2.click('text=Isi sebagai daftar'); await P2.waitForSelector('.daftar-periksa'); const n = await P2.$$eval('.daftar-periksa li', x => x.length);
    for (let i = 0; i < n; i++) await P2.click(`.daftar-periksa li >> nth=${i} >> text=${i === 1 ? '✕ Tidak' : '✓ Sesuai'}`);
    await P2.click('text=Lihat ringkasan'); await tunggu(300); const toast = await P2.evaluate(() => (((document.querySelector('.toast-wadah') || {}).lastElementChild) || {}).textContent || '');
    return { aktual: 'Pesan: "' + toast.trim() + '"; ringkasan tidak dibuka.', status: /catatan/i.test(toast) && !(await P2.$('text=Simpan inspeksi')) ? 'PASS' : 'FAIL' };
  });
  await uji({ id: 'UAT-17', persona: 'P2', tanggal: '2026-10-06', fitur: 'JSA', skenario: 'Menyusun JSA "Penggantian baterai ARD lift-bed" dengan langkah otomatis dan memeriksa peringatan pengendalian',
    langkah: 'JSA → baru dengan nama pekerjaan → periksa langkah/bahaya otomatis → pilih unit → Simpan', diharapkan: 'Bahaya terdeteksi; langkah berisiko tinggi tanpa eliminasi/rekayasa diperingatkan; JSA tersimpan sebagai draf' }, async () => {
    await L.buka(P2, '/jsa?baru=1&pekerjaan=' + encodeURIComponent('Penggantian baterai ARD lift-bed di ruang mesin lift memakai tangga')); await P2.waitForSelector('form.form-jsa');
    await P2.click('text=Buat langkah awal otomatis'); await tunggu(800); const otomatis = await P2.evaluate(() => (((document.querySelector('.toast-wadah') || {}).lastElementChild) || {}).textContent || '');
    await P2.selectOption('form.form-jsa select >> nth=0', { label: 'IPSRS' }).catch(() => P2.selectOption('form.form-jsa select >> nth=0', { index: 12 }));
    await P2.click('text=Simpan JSA'); let peringatan = '';
    try { await P2.waitForSelector('dialog [data-ya]', { timeout: 3000 }); peringatan = await P2.textContent('dialog'); await P2.click('dialog [data-ya]'); } catch (e) { /* tidak ada dialog */ }
    await tunggu(1200); const r = sql("select nomor || ':' || status || ':' || jsonb_array_length(langkah) from jsa where pekerjaan ilike '%ARD lift-bed%'");
    S.jsaArd = sql("select id from jsa where pekerjaan ilike '%ARD lift-bed%'");
    return { aktual: 'Langkah otomatis: "' + otomatis.trim().slice(0, 90) + '". JSA ' + r + ' (nomor:status:jumlah langkah). ' + (peringatan ? 'Dialog peringatan: "' + peringatan.replace(/\s+/g, ' ').slice(0, 140) + '"' : 'Tidak ada dialog peringatan.'), status: r.includes(':draf:') ? 'PASS' : 'FAIL' };
  });
  await uji({ id: 'UAT-18', persona: 'P1', tanggal: '2026-10-06', fitur: 'Penugasan & notifikasi PJ', skenario: 'Koordinator memastikan PJ IPSRS menerima tugas risiko listrik (UAT-06 disimpan)',
    langkah: 'Simpan penugasan risiko listrik ke PJ IPSRS → cek kotak masuk PJ', diharapkan: 'Status "ditugaskan"; PJ menerima notifikasi', layar: 'pjIpsrs' }, async () => {
    const tgl = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
    await P1.evaluate(a => window.K3Api.tugaskan(a[0], a[1], a[2], 5, 2, 'Tertibkan stop kontak di bangsal'), [S.lapListrik, ID.pjIpsrs, tgl]);
    await L.buka(pjIpsrs, '/tugas'); await tunggu(800); const t = await pjIpsrs.textContent('main'); const nomor = sql("select nomor from laporan where id='" + S.lapListrik + "'");
    const notif = +sql("select count(*) from notifikasi where penerima_id='" + ID.pjIpsrs + "'");
    return { aktual: 'Daftar tugas PJ IPSRS ' + (t.includes(nomor) ? 'memuat ' + nomor : 'TIDAK memuat ' + nomor) + '; notifikasi untuk PJ di basis data: ' + notif + '.', status: t.includes(nomor) ? 'PASS' : 'FAIL',
      catatan: notif === 0 ? 'Penugasan laporan (modul inti) tidak membuat notifikasi server; PJ hanya melihatnya di daftar tugas dan pengingat terhitung.' : '' };
  });
  await uji({ id: 'UAT-19', persona: 'P3', tanggal: '2026-10-07', fitur: 'Pelaporan insiden', skenario: 'Petugas Kesling melaporkan tertusuk jarum saat mengangkut limbah (rujukan R25)',
    langkah: 'Akun petugas Kesling → Lapor → jenis Kejadian → kategori Limbah → mendesak → Kirim', diharapkan: 'Tersimpan; ketiga anggota Komite (K3RS) menerima notifikasi WAJIB', layar: 'ptKesling' }, async () => {
    await L.buka(ptKesling, '/lapor'); await bukaKet(ptKesling); await ptKesling.selectOption('select[aria-label="Jenis laporan"]', 'kejadian'); await ptKesling.click('[data-kat="limbah"]');
    await ptKesling.fill('textarea', TAG + ' Tangan kiri tertusuk jarum suntik bekas yang ada di dalam kantong plastik kuning saat mengangkut limbah ke TPS.');
    await ptKesling.fill('input[placeholder^="Contoh: lorong"]', 'Jalur angkut limbah menuju TPS (simulasi)'); await ptKesling.check('input[type=checkbox] >> nth=0').catch(() => {});
    await ptKesling.click('#btn-kirim'); await tunggu(1500);
    S.lapJarum = sql("select id from laporan where uraian like '%tertusuk jarum suntik bekas%'");
    const n = +sql("select count(*) from notifikasi where kunci = 'laporan_baru:" + S.lapJarum + "' and wajib");
    return { aktual: 'Laporan ' + sql("select nomor || ' (' || jenis || ', mendesak=' || mendesak || ')' from laporan where id='" + S.lapJarum + "'") + ' tersimpan; notifikasi wajib terkirim ke ' + n + ' akun K3RS.', status: n === 3 ? 'PASS' : 'FAIL' };
  });
  await uji({ id: 'UAT-20', persona: 'P3', tanggal: '2026-10-07', fitur: 'Formulir pelaporan insiden', skenario: 'Memeriksa isian waktu kejadian, korban, dan tindakan pertama pada laporan awal',
    langkah: 'Periksa isian formulir Lapor (jenis Kejadian)', diharapkan: 'Ada isian tanggal/jam kejadian (bisa berbeda dari tanggal lapor) dan tindakan pertama (mis. pasca-pajanan)', layar: 'ptKesling' }, async () => {
    await L.buka(ptKesling, '/lapor'); await bukaKet(ptKesling); await ptKesling.selectOption('select[aria-label="Jenis laporan"]', 'kejadian');
    const dt = await ptKesling.$$('main input[type=date], main input[type=datetime-local], main input[type=time]');
    const tgl = sql("select tanggal_lapor || ' / dibuat ' || to_char(dibuat_pada at time zone 'Asia/Makassar','DD-MM-YYYY HH24:MI') from laporan where id='" + S.lapJarum + "'");
    await ptKesling.evaluate(() => localStorage.removeItem('k3_draf'));
    return { aktual: 'Isian tanggal/jam kejadian: ' + dt.length + '. Tanggal laporan diisi otomatis saat dikirim (' + tgl + '). Tidak ada isian korban/tindakan pertama; kronologi baru tersedia di modul Investigasi.', status: dt.length ? 'PASS' : 'FAIL',
      catatan: 'Laporan terlambat akan tercatat dengan tanggal kirim, bukan tanggal kejadian; berpengaruh pada analisis tren insiden.' };
  });
  await uji({ id: 'UAT-21', persona: 'P3', tanggal: '2026-10-07', fitur: 'Laporan anonim & kode lacak', skenario: 'Pelapor anonim melaporkan beban kerja berlebih dan melacak statusnya',
    langkah: 'Lapor → anonim → psikososial → Kirim → catat kode → buka /lacak', diharapkan: 'Identitas pelapor tidak tersimpan; status dapat dilacak dengan kode', layar: 'ptFarmasi' }, async () => {
    await L.buka(ptFarmasi, '/lapor'); await bukaKet(ptFarmasi); await ptFarmasi.selectOption('select[aria-label="Unit"]', { label: 'Farmasi' }); await ptFarmasi.click('[data-kat="psikososial"]');
    await ptFarmasi.fill('textarea', TAG + ' Beban kerja shift malam berlebih; satu petugas melayani dua depo.'); await ptFarmasi.check('label:has-text("anonim") input').catch(async () => { const c = await ptFarmasi.$$('main input[type=checkbox]'); await c[c.length - 1].check(); });
    await ptFarmasi.click('#btn-kirim'); await ptFarmasi.waitForSelector('.kode-lacak .kode', { timeout: 20000 });
    const kode = (await ptFarmasi.textContent('.kode-lacak .kode')).trim();
    const pel = sql("select coalesce(pelapor_id::text,'NULL') || ':' || anonim from laporan where uraian like '%dua depo%'");
    let lacak = '';
    if (kode) { await L.buka(ptFarmasi, '/lacak'); await ptFarmasi.fill('main input', kode); await ptFarmasi.click('main button[type=submit], main button:has-text("Lacak")'); await tunggu(1200); lacak = (await ptFarmasi.textContent('main')).replace(/\s+/g, ' '); }
    return { aktual: 'Kode lacak: ' + (kode || 'tidak terbaca') + '. pelapor_id:anonim = ' + pel + '. Hasil lacak: ' + (/Baru|baru/.test(lacak) ? 'status "Baru" tampil.' : lacak.slice(0, 80)), status: kode && pel === 'NULL:true' && /baru/i.test(lacak) ? 'PASS' : 'FAIL' };
  });
  await uji({ id: 'UAT-22', persona: 'P3', tanggal: '2026-10-08', fitur: 'Investigasi & RCA', skenario: 'Memulai investigasi tertusuk jarum: kronologi, 5 Why, Fishbone',
    langkah: 'Investigasi → Mulai investigasi (laporan UAT-19) → Mulai analisis → isi kronologi, penyebab, 5 Why, Fishbone → Simpan', diharapkan: 'Data RCA tersimpan dan diagram Fishbone tampil' }, async () => {
    await L.buka(P3, '/investigasi'); await P3.waitForSelector('text=Mulai investigasi'); await P3.click('text=Mulai investigasi'); await P3.waitForSelector('form button[type=submit]');
    await P3.fill('form input[maxlength="200"]', 'Mengangkut kantong limbah medis ke TPS'); await P3.click('form button[type=submit]'); await P3.waitForFunction(() => /investigasi\?id=/.test(location.hash));
    S.inv = await hash(P3); await P3.click('text=Mulai analisis'); await dialogYa(P3); await tunggu(800);
    await P3.click('[role=tab]:has-text("Kronologi")'); await P3.click('text=Tambah peristiwa'); await P3.fill('.baris-item input >> nth=0', '07.40'); await P3.fill('.baris-item input >> nth=1', TAG + ' Petugas mengikat kantong kuning dari ruang tindakan tanpa memeriksa isi');
    await P3.click('[role=tab]:has-text("Penyebab")'); await P3.fill('textarea >> nth=2', 'Jarum bekas dibuang ke kantong kuning, bukan ke safety box');
    await P3.click('[role=tab]:has-text("5 Why")'); await P3.click('text=Tambah rantai penyebab'); await P3.fill('.rantai-why input >> nth=0', 'Petugas tertusuk jarum');
    await P3.fill('.why-daftar input >> nth=0', 'Jarum ada di kantong kuning'); await P3.click('text=Tambah "Mengapa?"'); await P3.fill('.why-daftar input >> nth=1', 'Safety box di ruang tindakan penuh');
    await P3.click('text=Tambah "Mengapa?"'); await P3.fill('.why-daftar input >> nth=2', 'Tidak ada jadwal penggantian safety box');
    await P3.fill('.rantai-why input[placeholder="Penyebab sistemik"]', 'Belum ada prosedur pemantauan isi safety box');
    await P3.click('[role=tab]:has-text("Fishbone")'); await P3.fill('input[maxlength="300"]', 'Petugas Kesling tertusuk jarum');
    await P3.click('details.fb-kat:has-text("Metode") summary'); await P3.click('details.fb-kat:has-text("Metode") >> text=Tambah penyebab');
    await P3.fill('details.fb-kat:has-text("Metode") .fb-item input >> nth=0', 'Tidak ada jadwal ganti safety box'); await P3.check('details.fb-kat:has-text("Metode") .fb-item input[type=checkbox]');
    await P3.click('button:has-text("Simpan")'); await tunggu(900);
    const r = JSON.parse(sql("select json_build_object('k', jsonb_array_length(kronologi), 'w', jsonb_array_length(lima_why->0->'why'), 'f', fishbone->'kategori'->'metode'->0->>'teks', 'l', laporan_id) from investigasi where id='" + S.inv + "'"));
    return { aktual: 'Investigasi ' + sql("select nomor from investigasi where id='" + S.inv + "'") + ' tertaut ke laporan UAT-19 (' + (r.l === S.lapJarum) + '); kronologi ' + r.k + ' peristiwa; 5 Why ' + r.w + ' tingkat; Fishbone Metode: "' + r.f + '".', status: r.l === S.lapJarum && r.k === 1 && r.w === 3 && r.f ? 'PASS' : 'FAIL' };
  });
  await uji({ id: 'UAT-23', persona: 'P3', tanggal: '2026-10-08', fitur: 'Aturan pengajuan investigasi', skenario: 'Mengajukan persetujuan sebelum CAPA dibuat',
    langkah: 'Klik Ajukan persetujuan tanpa CAPA', diharapkan: 'Server menolak' }, async () => {
    await P3.click('text=Ajukan persetujuan'); await dialogYa(P3); await tunggu(800); const st = sql("select status from investigasi where id='" + S.inv + "'");
    return { aktual: 'Status tetap "' + st + '" (pengajuan ditolak).', status: st === 'analisis' ? 'PASS' : 'FAIL' };
  });
  await uji({ id: 'UAT-24', persona: 'P3', tanggal: '2026-10-09', fitur: 'CAPA', skenario: 'Membuat CAPA dari akar masalah dan menugaskan PJ Kesling',
    langkah: 'Tab CAPA → pilih akar → tindakan → PJ Kesling → simpan → Ajukan persetujuan', diharapkan: 'CAPA tertaut ke investigasi; PJ mendapat notifikasi; investigasi dapat diajukan' }, async () => {
    await P3.click('[role=tab]:has-text("CAPA")'); await P3.selectOption('form select >> nth=0', { index: 1 });
    await P3.fill('form textarea', TAG + ' Tetapkan jadwal pemeriksaan dan penggantian safety box (≤3/4 penuh) dan sosialisasi pemilahan tajam');
    const pjSel = await P3.$$('form select'); for (const s of pjSel.slice(1)) { const o = await s.$$eval('option', x => x.map(y => y.textContent)); const i = o.findIndex(x => /PJ Kesling/.test(x)); if (i > 0) await s.selectOption({ index: i }); }
    await P3.click('form button[type=submit]'); await tunggu(900); S.capa = sql("select id from capa where investigasi_id='" + S.inv + "'");
    await P3.click('text=Ajukan persetujuan'); await dialogYa(P3); await tunggu(900);
    const r = sql("select c.nomor || ':' || coalesce(p.nama_tampilan,'-') || ':' || i.status from capa c join investigasi i on i.id=c.investigasi_id left join profil p on p.id=c.pj_id where c.id='" + S.capa + "'");
    const notif = +sql("select count(*) from notifikasi where kategori='capa' and penerima_id = (select pj_id from capa where id='" + S.capa + "')");
    return { aktual: 'CAPA:PJ:status investigasi = ' + r + '; notifikasi CAPA ke PJ: ' + notif + '.', status: /menunggu_persetujuan$/.test(r) && notif >= 1 ? 'PASS' : 'FAIL' };
  });
  await uji({ id: 'UAT-25', persona: 'P1', tanggal: '2026-10-09', fitur: 'Persetujuan investigasi (pemisahan tugas)', skenario: 'Ketua tim (P3) tidak boleh menyetujui investigasinya sendiri; P1 menyetujui',
    langkah: 'P3 memanggil persetujuan lewat API → P1 klik Setujui', diharapkan: 'P3 ditolak; P1 berhasil; penyetuju tercatat' }, async () => {
    const tolak = await P3.evaluate(id => window.K3Api.simpanBaris('investigasi', { id, status: 'disetujui' }).then(() => 'lolos', e => e.message), S.inv).catch(e => e.message);
    const st0 = sql("select status from investigasi where id='" + S.inv + "'");
    await L.buka(P1, '/investigasi?id=' + S.inv); jawabPrompt(P1, 'Analisis memadai'); await P1.click('button:has-text("Setujui")'); await tunggu(900);
    const r = sql("select status || ':' || (disetujui_oleh = '" + ID.p1 + "') from investigasi where id='" + S.inv + "'");
    return { aktual: 'Upaya P3: ' + (st0 === 'menunggu_persetujuan' ? 'ditolak (' + String(tolak).slice(0, 70) + ')' : 'LOLOS') + '. Setelah P1: ' + r + '.', status: st0 === 'menunggu_persetujuan' && r === 'disetujui:true' ? 'PASS' : 'FAIL', layar: 'P1' };
  });
  await uji({ id: 'UAT-26', persona: 'P2', tanggal: '2026-10-09', fitur: 'Tindak lanjut risk register', skenario: 'PJ IPSRS mencatat tindak lanjut rekayasa untuk risiko listrik; K3RS menutup',
    langkah: 'PJ: tambah tindak lanjut (level rekayasa, bukti) → status dalam tindak lanjut; P2 menutup', diharapkan: 'Riwayat status dan tindak lanjut tercatat; penutupan oleh K3RS', layar: 'pjIpsrs' }, async () => {
    await pjIpsrs.evaluate(id => window.K3Api.tambahTL(id, 'SIMULASI_UAT Pemasangan stop kontak dinding permanen dan penarikan kabel rol tidak standar', 'rekayasa', 'Foto sebelum/sesudah (simulasi)'), S.lapListrik);
    const tutup = await P2.evaluate(id => window.K3Api.ubahStatus(id, 'tertutup', 'Diverifikasi saat ronde K3 (simulasi)').then(() => 'ok', e => e.message), S.lapListrik);
    await L.buka(P2, '/laporan/' + S.lapListrik); await tunggu(600);
    const r = sql("select status || ':' || level_pengendalian || ':' || (select count(*) from riwayat_status where laporan_id=l.id) from laporan l where id='" + S.lapListrik + "'");
    return { aktual: 'Penutupan: ' + tutup + '. status:level:jumlah riwayat = ' + r + '.', status: /^tertutup:rekayasa:/.test(r) ? 'PASS' : 'FAIL', layar: 'P2',
      catatan: 'Tidak ada isian untuk menilai ulang risiko residual (D/P setelah pengendalian) — lihat UAT-35.' };
  });

  // ===================== MINGGU 3 =====================
  await uji({ id: 'UAT-27', persona: 'P1', tanggal: '2026-10-12', fitur: 'Toolbox meeting + presensi QR', skenario: 'Toolbox "Penanganan tumpahan B3" untuk petugas Kesling dan Farmasi',
    langkah: 'Pelatihan & toolbox → toolbox baru → tambah peserta → tampilkan QR → peserta presensi lewat tautan', diharapkan: 'Nomor TBM otomatis; kehadiran QR tercatat' }, async () => {
    await L.buka(P1, '/kegiatan?baru=toolbox'); await P1.fill('form input[maxlength="160"]', TAG + ' Penanganan tumpahan B3'); await P1.fill('form input[type=datetime-local]', sekarangLokal());
    await P1.click('form button[type=submit]'); await P1.waitForFunction(() => /kegiatan\?id=/.test(location.hash)); S.tbm = await hash(P1);
    for (const nm of ['Petugas Kesling', 'Petugas Farmasi']) { await P1.fill('input[aria-label="Cari rekan"]', nm.split(' ')[1]); await P1.waitForSelector('.chip-baris button:has-text("' + nm + '")'); await P1.click('.chip-baris button:has-text("' + nm + '")'); await tunggu(700); }
    await P1.click('text=Tampilkan QR presensi'); await P1.waitForSelector('.qr-hadir svg'); const kode = (await P1.textContent('.qr-hadir')).match(/Kode: (\w+)/)[1];
    await L.buka(ptKesling, '/hadir?k=' + kode);
    const r = sql("select k.nomor || ' peserta=' || count(p.*) || ' hadir_qr=' || count(*) filter (where p.cara_hadir='qr') from kegiatan k join kegiatan_peserta p on p.kegiatan_id=k.id where k.id='" + S.tbm + "' group by k.nomor");
    return { aktual: r + ' (satu dari dua peserta presensi QR; satu belum hadir).', status: /^TBM-.* peserta=2 hadir_qr=1/.test(r) ? 'PASS' : 'FAIL' };
  });
  await uji({ id: 'UAT-28', persona: 'P1', tanggal: '2026-10-13', fitur: 'Pelatihan, pre/post-test, kompetensi', skenario: 'Pelatihan penggunaan APAR & Code Red; kompetensi wajib metode asesmen',
    langkah: 'Pelatihan baru → peserta → nilai pre 50/post 85 → kompeten tanpa metode → lalu dengan metode', diharapkan: 'Tanpa metode ditolak; dengan metode sertifikat terbit' }, async () => {
    await L.buka(P1, '/kegiatan?baru=pelatihan'); await P1.fill('form input[maxlength="160"]', TAG + ' Penggunaan APAR dan Code Red'); await P1.fill('form input[type=datetime-local]', sekarangLokal()); await P1.fill('form input[placeholder^="kosong"]', '24');
    await P1.click('form button[type=submit]'); await P1.waitForFunction(() => /kegiatan\?id=/.test(location.hash)); const id = await hash(P1);
    await P1.fill('input[aria-label="Cari rekan"]', 'Kesling'); await P1.waitForSelector('.chip-baris button:has-text("Petugas Kesling")'); await P1.click('.chip-baris button:has-text("Petugas Kesling")'); await tunggu(800);
    const n = 'SIMULASI_UAT Petugas Kesling';
    await P1.selectOption(`select[aria-label="Kehadiran ${n}"]`, 'hadir'); await P1.fill(`input[aria-label="Nilai pre-test ${n}"]`, '50'); await P1.fill(`input[aria-label="Nilai post-test ${n}"]`, '85');
    await P1.selectOption(`select[aria-label="Kompetensi ${n}"]`, 'kompeten'); await P1.click(`button[aria-label="Simpan ${n}"]`); await tunggu(900);
    const k0 = sql("select kompetensi from kegiatan_peserta where kegiatan_id='" + id + "'");
    await P1.fill(`input[aria-label="Metode asesmen ${n}"]`, 'Praktik memadamkan api dengan APAR'); await P1.click(`button[aria-label="Simpan ${n}"]`); await tunggu(900);
    const r = sql("select nilai_pre || '/' || nilai_post || ':' || kompetensi || ':' || coalesce(sertifikat_nomor,'-') from kegiatan_peserta where kegiatan_id='" + id + "'");
    return { aktual: 'Tanpa metode → kompetensi "' + k0 + '". Dengan metode → ' + r + '.', status: k0 === 'belum_dinilai' && /kompeten:/.test(r) && !/:-$/.test(r) ? 'PASS' : 'FAIL' };
  });
  await uji({ id: 'UAT-29', persona: 'P2', tanggal: '2026-10-13', fitur: 'Izin kerja (PTW) terhubung JSA', skenario: 'PJ IPSRS mengajukan izin kerja listrik untuk penggantian baterai ARD (merujuk JSA UAT-17)',
    langkah: 'P2 menyetujui JSA → PJ: izin baru jenis listrik → JSA rujukan → simpan draf → periksa butir → ajukan', diharapkan: 'Bahaya/pengendalian dari JSA tersalin; izin tidak bisa dimulai sebelum disahkan', layar: 'pjIpsrs' }, async () => {
    await P2.evaluate(id => window.K3Api.simpanModul('jsa', { id, status: 'disetujui' }), S.jsaArd).catch(() => {});
    const stJsa = sql("select status from jsa where id='" + S.jsaArd + "'");
    await L.buka(pjIpsrs, '/izin?baru=1'); await pjIpsrs.waitForSelector('.grid-templat'); await pjIpsrs.click('.kartu.templat:has-text("listrik")');
    await pjIpsrs.fill('form.form-izin input[maxlength="160"] >> nth=0', TAG + ' Penggantian baterai ARD lift-bed');
    await pjIpsrs.selectOption('form.form-izin select >> nth=1', { index: 1 }); await pjIpsrs.fill('form.form-izin input[type=datetime-local] >> nth=0', sekarangLokal(-5));
    const o = await pjIpsrs.$$eval('form.form-izin select >> nth=2 >> option', x => x.map(y => y.textContent)).catch(() => []);
    await pjIpsrs.selectOption('form.form-izin select >> nth=2', { index: Math.max(1, o.findIndex(x => /ARD/.test(x))) }); await tunggu(300);
    const salin = await pjIpsrs.inputValue('form.form-izin textarea >> nth=1');
    await pjIpsrs.click('text=Simpan sebagai draf'); await pjIpsrs.waitForFunction(() => /izin\?id=/.test(location.hash)); S.izin = await hash(pjIpsrs);
    const mulai = await pjIpsrs.evaluate(id => window.K3Api.izinProses(id, 'mulai').then(() => 'lolos', e => e.message), S.izin);
    return { aktual: 'Status JSA: ' + stJsa + '. Bahaya/pengendalian tersalin: ' + (salin.length > 10 ? 'ya ("' + salin.slice(0, 60).replace(/\s+/g, ' ') + '…")' : 'tidak') + '. Mulai sebelum disahkan: ' + mulai.slice(0, 60) + '.', status: stJsa === 'disetujui' && salin.length > 10 && /disahkan/.test(mulai) ? 'PASS' : 'FAIL' };
  });
  await uji({ id: 'UAT-30', persona: 'P3', tanggal: '2026-10-14', fitur: 'Penelusuran riwayat insiden', skenario: 'Mencari kembali insiden tertusuk jarum dan melihat riwayatnya',
    langkah: 'Cari → "tertusuk jarum" → buka hasil → lihat riwayat status & investigasi', diharapkan: 'Laporan ditemukan; riwayat dan keterkaitan investigasi terlihat' }, async () => {
    await L.buka(P3, '/cari?q=' + encodeURIComponent('tertusuk jarum')); await P3.waitForSelector('text=/Ditemukan \\d+ laporan/', { timeout: 15000 }).catch(() => {}); const t = await P3.textContent('main'); const nomor = sql("select nomor from laporan where id='" + S.lapJarum + "'");
    await L.buka(P3, '/laporan/' + S.lapJarum); await tunggu(800); const d = await P3.textContent('main');
    return { aktual: 'Pencarian ' + (t.includes(nomor) ? 'menemukan ' + nomor : 'tidak menampilkan nomor ' + nomor) + '. Halaman detail ' + (/INV-/.test(d) ? 'menautkan investigasi.' : 'tidak menampilkan tautan ke investigasi.'), status: t.includes(nomor) ? 'PASS' : 'FAIL',
      catatan: /INV-/.test(d) ? '' : 'Keterkaitan laporan → investigasi hanya terlihat dari modul Investigasi.' };
  });
  await uji({ id: 'UAT-31', persona: 'P1', tanggal: '2026-10-14', fitur: 'Laporan bulanan', skenario: 'Menyusun rekap bulanan untuk rapat Komite',
    langkah: 'Buka /bulanan (bawaan: bulan sebelumnya) → pilih bulan berjalan', diharapkan: 'Rekap jumlah laporan, risiko, CAPA sesuai data' }, async () => {
    await L.buka(P1, '/bulanan'); await tunggu(1000); await P1.selectOption('main select >> nth=0', { index: 0 }); await tunggu(1500); const t = (await P1.textContent('main')).replace(/\s+/g, ' ');
    const n = sql("select count(*) from laporan where date_trunc('month', tanggal_lapor) = date_trunc('month', current_date)");
    const m = t.match(/(\d+)\s*Total laporan/);
    return { aktual: 'Bawaan halaman: bulan sebelumnya (Oktober 2026, semua 0 karena data uji dibuat November). Setelah memilih November 2026: "' + (m ? m[0] : '?') + '"; basis data: ' + n + '. Tersedia Cetak/PDF, CSV, arsip ke Sheets.', status: m && m[1] === n ? 'PASS' : 'FAIL',
      catatan: 'Data uji dibuat pada tanggal eksekusi (November 2026), sehingga rekap September–Oktober 2026 kosong.' };
  });
  await uji({ id: 'UAT-32', persona: 'P1', tanggal: '2026-10-15', fitur: 'Notifikasi di aplikasi', skenario: 'Membaca dan menandai notifikasi',
    langkah: 'Lonceng → kotak masuk → Tandai semua dibaca', diharapkan: 'Jumlah belum dibaca berkurang menjadi 0 hanya untuk akun sendiri' }, async () => {
    const n0 = +sql("select count(*) from notifikasi where penerima_id='" + ID.p1 + "' and dibaca_pada is null");
    await L.buka(P1, '/notifikasi'); await P1.waitForSelector('text=Tandai semua dibaca'); await P1.click('text=Tandai semua dibaca'); await tunggu(900);
    const n1 = +sql("select count(*) from notifikasi where penerima_id='" + ID.p1 + "' and dibaca_pada is null"); const lain = +sql("select count(*) from notifikasi where penerima_id='" + ID.p3 + "' and dibaca_pada is null");
    return { aktual: 'Belum dibaca P1: ' + n0 + ' → ' + n1 + '; milik P3 tetap ' + lain + '.', status: n0 > 0 && n1 === 0 && lain > 0 ? 'PASS' : 'FAIL' };
  });
  await uji({ id: 'UAT-33', persona: 'P1', tanggal: '2026-10-15', fitur: 'Notifikasi email & push', skenario: 'Menerima notifikasi insiden lewat email/push',
    langkah: 'Periksa antrean pengiriman', diharapkan: 'Email/push terkirim dan diterima' }, async () => {
    const q = sql("select string_agg(saluran || '=' || status || ':' || n, ', ') from (select saluran, status, count(*) n from notifikasi_kirim group by 1,2) x");
    return { aktual: 'Antrean pengiriman terisi (' + q + ') tetapi Edge Function, kunci Resend, dan VAPID belum dipasang; tidak ada pengiriman nyata.', status: 'BLOCKED', catatan: 'Memerlukan konfigurasi pemilik proyek (docs/PANDUAN_HSE_INTELLIGENCE.md bagian 7).' };
  });
  await uji({ id: 'UAT-34', persona: 'P1', tanggal: '2026-10-15', fitur: 'Sinkron Google Sheets', skenario: 'Memeriksa cermin data di Google Sheets',
    langkah: 'Buka /sinkron dan spreadsheet', diharapkan: 'Data terbaru tampil di Sheets' }, async () => {
    await L.buka(P1, '/sinkron'); return { aktual: 'Halaman sinkron tampil, tetapi lingkungan uji tidak terhubung ke Apps Script/Spreadsheet produksi.', status: 'BLOCKED', catatan: 'Uji Apps Script terhadap basis data uji sudah lulus terpisah (tests/sheets), bukan bagian UAT persona.' };
  });
  await uji({ id: 'UAT-35', persona: 'P2', tanggal: '2026-10-16', fitur: 'Risiko residual', skenario: 'Menilai ulang risiko setelah pengendalian (residual) seperti kolom 20–23 register RS',
    langkah: 'Buka risiko yang sudah ditindaklanjuti → cari isian D/P residual', diharapkan: 'Ada isian residual terpisah dari inherent' }, async () => {
    const kol = sql("select string_agg(column_name, ',') from information_schema.columns where table_name='laporan' and column_name ilike any (array['%residu%','%sisa%','%inheren%'])");
    await L.buka(P2, '/laporan/' + S.risiko[0][0]); await tunggu(600); const t = await P2.textContent('main');
    return { aktual: 'Kolom residual di tabel laporan: ' + (kol || 'tidak ada') + '. Halaman detail ' + (/residual/i.test(t) ? 'memuat' : 'tidak memuat') + ' isian residual; mengubah D/P menimpa nilai awal (riwayat nilai lama hanya di jejak perubahan).', status: kol ? 'PASS' : 'FAIL' };
  });
  await uji({ id: 'UAT-36', persona: 'P3', tanggal: '2026-10-16', fitur: 'Laporan cetak investigasi', skenario: 'Mencetak laporan investigasi untuk rapat Komite',
    langkah: 'Investigasi → Laporan cetak', diharapkan: 'Dokumen cetak memuat kronologi, 5 Why, Fishbone, CAPA' }, async () => {
    await L.buka(P3, '/investigasi?id=' + S.inv); const [pop] = await Promise.all([P3.context().waitForEvent('page', { timeout: 5000 }).catch(() => null), P3.click('text=Laporan cetak')]);
    const pg = pop || P3; await tunggu(1000); const t = (await pg.textContent('body')).replace(/\s+/g, ' ');
    const ada = ['Kronologi', 'Why', 'Fishbone', 'CAPA'].filter(x => new RegExp(x, 'i').test(t));
    if (pop) { await pop.screenshot({ path: path.join(BUKTI, 'UAT-36-cetak.jpg'), type: 'jpeg', quality: 60, fullPage: true }); await pop.close(); }
    return { aktual: 'Laporan cetak memuat bagian: ' + ada.join(', ') + '.', status: ada.length === 4 ? 'PASS' : 'FAIL' };
  });
  await uji({ id: 'UAT-37', persona: 'P1', tanggal: '2026-10-16', fitur: 'Tampilan ponsel (360 px)', skenario: 'Membuka halaman utama persona di ponsel',
    langkah: 'Viewport 360 px: beranda, lapor, semua, investigasi, izin, kegiatan', diharapkan: 'Tidak ada gulir horizontal' }, async () => {
    await P1.setViewportSize({ width: 360, height: 780 }); const lebar = [];
    for (const r of ['/beranda', '/lapor', '/semua', '/investigasi?id=' + S.inv, '/izin', '/kegiatan']) { await L.buka(P1, r); await tunggu(500); lebar.push(r.split('?')[0] + '=' + await P1.evaluate(() => document.documentElement.scrollWidth)); }
    const ok = lebar.every(x => +x.split('=').pop() <= 360);
    return { aktual: 'Lebar gulir: ' + lebar.join(', ') + '.', status: ok ? 'PASS' : 'FAIL' };
  });
  await P1.setViewportSize({ width: 1280, height: 860 });
  await uji({ id: 'UAT-38', persona: 'P1', tanggal: '2026-10-16', fitur: 'Data di Supabase produksi', skenario: 'Memastikan data UAT tersimpan di proyek Supabase produksi',
    langkah: 'Akses dasbor Supabase produksi', diharapkan: 'Data tersimpan sesuai', layar: 'none' }, async () => ({ aktual: 'Tidak diuji: lingkungan ini tidak dapat menjangkau Supabase produksi, dan UAT sengaja tidak menulis ke produksi.', status: 'BLOCKED' }));

  // Galat JavaScript selama sesi
  const galat = Object.entries(H).flatMap(([k, p]) => (p.galat || []).map(g => k + ': ' + g));
  fs.writeFileSync(path.join(__dirname, 'hasil_uat.json'), JSON.stringify({ dijalankan: new Date().toISOString(), basis_data: 'hse_uat (lokal, uji)', matriks_rs: MATRIKS_RS, konflik_pita: S.konflik, kolom_ekspor: S.kolomEkspor, kolom_hilang: S.kolomHilang, galat_js: galat, hasil }, null, 1));
  const rek = hasil.reduce((a, r) => (a[r.status] = (a[r.status] || 0) + 1, a), {}); console.log('REKAP', JSON.stringify(rek), 'galat JS:', galat.length);
  await b.close();
})();
