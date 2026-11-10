// Dokumentasi tangkapan layar per fitur, langkah demi langkah, untuk satu tema.
// Tampilan ponsel 390×844 (DSF 1,5). Data: basis data uji lokal (salinan hse_demo, data [DEMO]); bukan produksi.
// Elemen yang ditekan pada langkah berikutnya diberi bingkai kuning (penanda dokumentasi, bukan bagian aplikasi).
// node rekam_fitur.js <tema: bentenan|navy|aksesibel> <dir_keluar> [fitur,...]
// Prasyarat: PGDATABASE=hse_dok node tests/server/rest-uji.js 3101 ; python3 -m http.server 8765 (akar repo)
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const fs = require('fs'), path = require('path');
const L = require('../browser/lib-supabase.js');
const [TEMA, OUT, HANYA] = process.argv.slice(2);
const DIR = path.join(OUT, TEMA); fs.mkdirSync(DIR, { recursive: true });
const hanya = HANYA ? HANYA.split(',') : null;
const sql = q => execFileSync('psql', ['-d', process.env.DOK_DB || 'hse_dok', '-tAq', '-c', q]).toString().trim();
const tidur = ms => new Promise(r => setTimeout(r, ms));
const MANIFEST = []; let fitur = null, nLangkah = 0;
const CUACA = path.join(OUT, 'cuaca_cache.json');
const wita = (hari = 0) => new Date(Date.now() + hari * 864e5 + 8 * 3600e3).toISOString().slice(0, 10);
const lokal = (menit = 0) => new Date(Date.now() + menit * 60e3 + 8 * 3600e3).toISOString().slice(0, 16); // WITA = zona waktu peramban (Asia/Makassar)

async function konteks(b, opsi = {}) {
  const ctx = await L.konteks(b, Object.assign({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1.5, isMobile: false, hasTouch: false, acceptDownloads: true, bypassCSP: true, timezoneId: 'Asia/Makassar', locale: 'id-ID' }, opsi));
  // Simulasi luring: permintaan ke API (yang dilayani emulator lewat route) ikut diputus saat ctx.__luring = true
  await ctx.route('https://fkynbegfeodymincuucy.supabase.co/**', r => ctx.__luring ? r.abort('internetdisconnected') : r.fallback());
  await ctx.addInitScript(t => { try { localStorage.setItem('k3_skema', JSON.stringify(t)); } catch (e) { } }, TEMA);
  // Cuaca: data nyata Open-Meteo diambil sekali (curl melalui proksi lingkungan) lalu dipakai ulang agar ketiga tema sama
  await ctx.route('https://api.open-meteo.com/**', async r => {
    const u = r.request().url(); let cache = {}; try { cache = JSON.parse(fs.readFileSync(CUACA, 'utf8')); } catch (e) { }
    const kunci = u.replace(/&_=\d+/, '');
    if (!cache[kunci]) { try { cache[kunci] = execFileSync('curl', ['-s', '-m', '15', u]).toString(); fs.writeFileSync(CUACA, JSON.stringify(cache)); } catch (e) { return r.fulfill({ status: 503, body: '{}' }); } }
    r.fulfill({ status: 200, contentType: 'application/json', body: cache[kunci], headers: { 'access-control-allow-origin': '*' } });
  });
  await ctx.addInitScript(() => {
    const pasang = () => { if (document.getElementById('__dokcss')) return; const s = document.createElement('style'); s.id = '__dokcss';
      s.textContent = '.__dok{outline:4px solid #F5B700 !important;outline-offset:3px !important;box-shadow:0 0 0 9px rgba(245,183,0,.30) !important;border-radius:10px} .toast-wadah{z-index:2147483646}';
      document.documentElement.appendChild(s); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', pasang); else pasang();
  });
  return ctx;
}
async function akun(b, email) { const ctx = await konteks(b); const p = await L.masuk(ctx, email); await tidur(1200); p.on('dialog', d => d.accept(p.__jawab || '')); return p; }
const buka = async (p, r) => { await L.buka(p, r); await tidur(900); };

function mulai(id, nama) { fitur = { id, nama, langkah: [] }; MANIFEST.push(fitur); nLangkah = 0; }
// Ambil satu langkah: gulir ke elemen fokus (bila ada), beri bingkai pada elemen yang akan ditekan, simpan JPEG.
async function foto(p, judul, ket, o = {}) {
  nLangkah++; const kode = fitur.id + '_' + String(nLangkah).padStart(2, '0');
  try {
    if (o.atas) await p.evaluate(() => scrollTo(0, 0));
    if (o.sorot) { const el = p.locator(o.sorot).first(); if (!o.ke) await el.evaluate(e => e.scrollIntoView({ block: 'center' })).catch(() => {}); await el.evaluate(e => (e.closest('button,a,label,select,input,textarea,summary,dialog,form,ul.cek,ol,.kartu') || e).classList.add('__dok')).catch(() => {}); }
    await tidur(o.tunggu || 450);
    await p.screenshot({ path: path.join(DIR, kode + '.jpg'), type: 'jpeg', quality: 80 });
    if (o.sorot) await p.locator('.__dok').evaluateAll(es => es.forEach(e => e.classList.remove('__dok'))).catch(() => {});
    fitur.langkah.push({ kode, judul, ket });
  } catch (e) { console.log('  ! foto', kode, e.message.split('\n')[0]); fitur.langkah.push({ kode, judul, ket, gagal: true }); }
}
// scrollIntoView di dalam evaluate tidak bisa memakai fungsi luar; pakai 'start' dengan sedikit ruang atas
async function ke(p, sel, blok = 'start') { await p.locator(sel).first().evaluate((e, b) => { e.scrollIntoView({ block: b }); if (b === 'start') scrollBy(0, -70); }, blok).catch(() => {}); await tidur(250); }
const ya = async p => { await p.waitForSelector('dialog [data-ya]', { timeout: 8000 }); await p.click('dialog [data-ya]'); await tidur(900); };
async function bagian(id, nama, fn) {
  if (hanya && !hanya.includes(id)) return;
  mulai(id, nama); console.log('==', id, nama);
  try { await fn(); } catch (e) { console.log('  ! fitur', id, e.message.split('\n')[0]); fitur.galat = e.message.split('\n')[0]; }
}

(async () => {
  const b = await chromium.launch();
  const K = await akun(b, 'p1.koordinator@demo.hse');      // K3RS — Demo Koordinator K3
  const P3 = await akun(b, 'p3.insiden@demo.hse');         // K3RS — Demo Pengelola Insiden
  const PJ = await akun(b, 'pj.ipsrs@demo.hse');           // PJ unit IPSRS
  const PT = await akun(b, 'petugas.kesling@demo.hse');    // Petugas Kesling
  const PF = await akun(b, 'petugas.farmasi@demo.hse');    // Petugas Farmasi
  const S = {};

  // ---------------- F-01 & F-02: tema sebelum masuk, halaman masuk, MFA ----------------
  await bagian('F-01', 'Pemilihan tema warna', async () => {
    const ctx = await konteks(b); const p = await ctx.newPage(); await p.goto(L.APP + '/#/beranda'); await p.waitForSelector('.skema-pilih'); await tidur(700);
    await foto(p, 'Halaman pilih tampilan sebelum masuk', 'Saat aplikasi dibuka pertama kali di sebuah perangkat, pengguna diminta memilih satu dari tiga tema. Kartu tema yang aktif ditandai. Pratinjau kecil pada tiap kartu memperlihatkan warna tombol dan label status.', { sorot: '.skema-pilih.dipilih' });
    await ke(p, 'text=Lanjut ke halaman masuk', 'center');
    await foto(p, 'Melanjutkan ke halaman masuk', 'Setelah memilih tema, pengguna menekan "Lanjut ke halaman masuk". Pilihan tema disimpan di perangkat ini (bukan di akun) sehingga dapat berbeda antar-perangkat.', { sorot: 'text=Lanjut ke halaman masuk' });
    await p.click('text=Lanjut ke halaman masuk'); await p.waitForSelector('input[type=email]'); await tidur(700);
    S.ctxMasuk = p;
    await buka(K, '/akun'); await ke(K, 'h2:has-text("Tema & tampilan")');
    await foto(K, 'Mengganti tema dari halaman Akun', 'Setelah masuk, tema dapat diganti kapan saja melalui Menu → Akun → bagian "Tema & tampilan". Perubahan langsung diterapkan ke seluruh halaman tanpa memuat ulang.', { sorot: 'main select >> nth=0' });
    await buka(K, '/tema'); await foto(K, 'Halaman pratinjau tema', 'Tombol "Lihat pratinjau tema" membuka halaman yang sama dengan halaman awal untuk membandingkan ketiga tema sebelum menyimpan.', { sorot: 'text=Simpan tema' });
  });
  await bagian('F-02', 'Masuk akun dan MFA untuk K3RS', async () => {
    const p = S.ctxMasuk || await (await konteks(b)).newPage(); if (!S.ctxMasuk) { await p.goto(L.APP + '/#/masuk'); }
    await p.evaluate(() => scrollTo(0, 0)); await foto(p, 'Halaman masuk', 'Halaman masuk meminta email dan kata sandi akun yang dibuat oleh Admin K3RS. Tidak ada pendaftaran bebas; akun baru menunggu persetujuan.', {});
    await p.fill('input[type=email]', 'p1.koordinator@demo.hse'); await p.fill('input[type=password]', L.SANDI);
    await foto(p, 'Mengisi email dan kata sandi', 'Isi email dan kata sandi, lalu tekan tombol masuk. Contoh ini memakai akun uji "Demo Koordinator K3" pada lingkungan uji lokal.', { sorot: 'form button[type=submit]' });
    await p.click('form button[type=submit]'); await p.waitForFunction(() => /beranda/.test(location.hash), null, { timeout: 15000 }); await tidur(1200);
    await foto(p, 'Berhasil masuk ke Beranda', 'Setelah berhasil, aplikasi membuka Beranda sesuai peran akun. Nama dan peran (K3RS / Admin) tampil pada kartu sambutan.', {});
    await buka(K, '/mfa');
    await foto(K, 'Aktivasi verifikasi dua langkah (MFA)', 'Akun K3RS wajib memakai verifikasi dua langkah. Pengguna memindai kode QR dengan aplikasi autentikator, lalu mengetik 6 angka. Catatan: server uji lokal langsung memberi tingkat aal2, sehingga langkah ini hanya diperlihatkan tampilannya.', { sorot: 'input[placeholder="6 angka"]' });
    await p.context().close();
  });

  // ---------------- F-03: menu berbasis peran ----------------
  await bagian('F-03', 'Menu dan hak akses berbasis peran', async () => {
    await buka(PT, '/menu'); await foto(PT, 'Menu untuk peran Petugas', 'Petugas hanya melihat menu yang dibutuhkan untuk melapor dan melihat laporannya sendiri. Menu pengelolaan tidak ditampilkan.', { atas: true });
    await buka(PJ, '/menu'); await foto(PJ, 'Menu untuk peran Penanggung jawab unit', 'PJ unit mendapat menu tambahan: laporan unit, tugas, dasbor, ekspor, dan modul investigasi/CAPA untuk unitnya.', { atas: true });
    await buka(K, '/menu'); await foto(K, 'Menu untuk peran K3RS', 'K3RS melihat semua menu, termasuk bagian Administrasi (pengguna, pengaturan, Google Sheets, log aktivitas).', { atas: true });
    await ke(K, 'h2:has-text("Administrasi")'); await foto(K, 'Bagian Administrasi (khusus K3RS)', 'Bagian Administrasi hanya muncul untuk K3RS. Halaman di dalamnya juga diperiksa ulang oleh aturan rute dan oleh RLS di basis data.', {});
    await buka(PF, '/semua'); await foto(PF, 'Penolakan halaman di luar peran', 'Bila petugas membuka alamat halaman yang bukan untuk perannya (contoh: daftar semua laporan), aplikasi menolak. Data juga dibatasi oleh Row Level Security di server, sehingga pemanggilan API langsung hanya mengembalikan laporan milik petugas itu.', { atas: true });
  });

  // ---------------- F-04: beranda ----------------
  await bagian('F-04', 'Beranda', async () => {
    await buka(K, '/beranda'); await foto(K, 'Beranda — kartu sambutan dan tombol LAPOR BAHAYA', 'Beranda menampilkan tanggal, nama, peran, dan tombol besar "LAPOR BAHAYA" agar pelaporan dapat dimulai dengan satu ketukan.', { atas: true, sorot: 'text=LAPOR BAHAYA' });
    await ke(K, 'text=PERLU PERHATIAN'); await foto(K, 'Beranda — Perlu perhatian dan akses cepat', 'Bagian "Perlu perhatian" menghitung laporan yang belum ditugaskan dan laporan mendesak yang belum selesai; menekan kartu membuka daftar terkait.', {});
    await buka(PT, '/beranda'); await foto(PT, 'Beranda untuk peran Petugas', 'Untuk petugas, beranda berfokus pada pelaporan dan status laporan yang pernah dikirim.', { atas: true });
  });

  // ---------------- F-06: lapor bahaya ----------------
  await bagian('F-06', 'Formulir lapor bahaya/insiden', async () => {
    await buka(PT, '/lapor'); await PT.evaluate(() => localStorage.removeItem('k3_draf'));
    await foto(PT, 'Membuka formulir Lapor bahaya', 'Tekan "LAPOR BAHAYA" di beranda atau "Lapor" di navigasi bawah. Formulir dibuat bertahap: (1) unit/ruangan, (2) jenis bahaya, lalu keterangan opsional.', { atas: true, sorot: 'select[aria-label="Unit"]' });
    await PT.selectOption('select[aria-label="Unit"]', { label: 'IPSRS' });
    await ke(PT, '[data-kat="mekanik"]', 'center');
    await foto(PT, 'Memilih jenis bahaya', 'Pilih unit, lalu ketuk salah satu dari delapan kartu jenis bahaya. Setiap kartu memuat contoh agar pelapor tidak perlu mengetahui istilah teknis.', { sorot: '[data-kat="mekanik"]' });
    await PT.click('[data-kat="mekanik"]');
    const d = await PT.$('details:has(summary:has-text("Tambahkan keterangan"))'); if (d && !(await d.evaluate(e => e.open))) await PT.click('summary:has-text("Tambahkan keterangan")');
    await PT.fill('main textarea', '[DEMO] Kabel listrik terkelupas di dekat panel lorong servis, terkena percikan air saat hujan.');
    await PT.fill('input[placeholder^="Contoh: lorong"]', 'Lorong servis lantai 1');
    await ke(PT, 'main textarea');
    await foto(PT, 'Menambahkan keterangan (opsional)', 'Bagian "Tambahkan keterangan" memuat jenis laporan, uraian, lokasi, tanda mendesak, foto, dan pilihan anonim. Uraian dan lokasi boleh kosong agar pelaporan tetap cepat.', { sorot: 'main textarea' });
    await ke(PT, '#btn-kirim', 'center');
    await foto(PT, 'Mengirim laporan', 'Tombol "KIRIM LAPORAN" aktif setelah unit dan jenis bahaya dipilih. Tekan tombol untuk mengirim.', { sorot: '#btn-kirim' });
    await PT.click('#btn-kirim'); await tidur(2000);
    S.lap = sql("select id from laporan order by dibuat_pada desc limit 1"); S.nomor = sql("select nomor from laporan where id='" + S.lap + "'");
    await foto(PT, 'Laporan terkirim dan bernomor', 'Server memberi nomor laporan unik (format K3-TTBBHH-urut) dan status "Baru". Laporan langsung masuk ke daftar unit dan ke dasbor K3RS.', { atas: true });
  });
  await bagian('F-42', 'Perlindungan identitas pasien pada uraian', async () => {
    await buka(PT, '/lapor'); await PT.selectOption('select[aria-label="Unit"]', { label: 'Rawat Inap' }).catch(() => PT.selectOption('select[aria-label="Unit"]', { index: 2 })); await PT.click('[data-kat="fisik"]');
    const d = await PT.$('details:has(summary:has-text("Tambahkan keterangan"))'); if (d && !(await d.evaluate(e => e.open))) await PT.click('summary:has-text("Tambahkan keterangan")');
    await PT.fill('main textarea', 'Pasien No. RM 123456 hampir terpeleset di kamar mandi karena lantai basah'); await tidur(500);
    await ke(PT, 'main textarea');
    await foto(PT, 'Peringatan identitas pasien', 'Bila uraian memuat pola identitas pasien (nomor rekam medis, nama dengan sapaan, tanggal lahir), aplikasi menampilkan peringatan dan menahan pengiriman. Pemeriksaan yang sama dijalankan lagi di server.', { sorot: 'text=Samarkan otomatis' });
    await PT.click('text=Samarkan otomatis').catch(() => {}); await tidur(500); await ke(PT, 'main textarea');
    await foto(PT, 'Identitas disamarkan otomatis', 'Tombol "Samarkan otomatis" mengganti bagian yang terdeteksi dengan penanda sehingga laporan dapat dikirim tanpa identitas pasien.', { sorot: 'main textarea' });
    await PT.fill('main textarea', ''); await PT.evaluate(() => localStorage.removeItem('k3_draf'));
  });
  await bagian('F-07', 'Laporan anonim dan kode lacak', async () => {
    await buka(PF, '/lapor'); await PF.evaluate(() => localStorage.removeItem('k3_draf'));
    await PF.selectOption('select[aria-label="Unit"]', { label: 'Farmasi' }); await PF.click('[data-kat="psikososial"]');
    const d = await PF.$('details:has(summary:has-text("Tambahkan keterangan"))'); if (d && !(await d.evaluate(e => e.open))) await PF.click('summary:has-text("Tambahkan keterangan")');
    await PF.fill('main textarea', '[DEMO] Beban kerja shift malam berlebih; satu petugas melayani dua depo.');
    await PF.check('label:has-text("anonim") input').catch(async () => { const c = await PF.$$('main input[type=checkbox]'); await c[c.length - 1].check(); }); await tidur(300);
    await ke(PF, 'label:has-text("anonim")', 'center');
    await foto(PF, 'Mengaktifkan pilihan anonim', 'Centang pilihan anonim. Kolom foto disembunyikan dan muncul penjelasan bahwa nama pelapor tidak disimpan. Basis data menolak laporan anonim yang memuat identitas pelapor atau foto.', { sorot: 'label:has-text("anonim")' });
    await PF.click('#btn-kirim'); await PF.waitForSelector('.kode-lacak .kode', { timeout: 20000 }); S.kode = (await PF.textContent('.kode-lacak .kode')).trim();
    await foto(PF, 'Kode lacak diberikan', 'Setelah terkirim, pelapor menerima kode lacak. Kode ini satu-satunya cara melihat perkembangan laporan anonim, jadi perlu disalin atau dicatat.', { atas: true, sorot: '.kode-lacak' });
    await buka(PF, '/lacak'); await PF.fill('main input', S.kode);
    await foto(PF, 'Memasukkan kode di halaman Lacak', 'Buka Menu → Lacak laporan tanpa nama, ketik kode, lalu tekan "LIHAT PERKEMBANGAN".', { sorot: 'text=LIHAT PERKEMBANGAN' });
    await PF.click('text=LIHAT PERKEMBANGAN'); await tidur(1500);
    await foto(PF, 'Status laporan anonim', 'Halaman menampilkan status dan tahap penanganan tanpa mengungkap siapa pelapornya.', { atas: true });
  });
  await bagian('F-08', 'Pelaporan dengan suara', async () => {
    await buka(PT, '/lapor'); const d = await PT.$('details:has(summary:has-text("Tambahkan keterangan"))'); if (d && !(await d.evaluate(e => e.open))) await PT.click('summary:has-text("Tambahkan keterangan")');
    await ke(PT, 'text=Ceritakan dengan suara', 'center');
    await foto(PT, 'Tombol "Ceritakan dengan suara" di formulir', 'Pada peramban yang mendukung pengenalan suara, tombol ini mengubah ucapan berbahasa Indonesia menjadi teks uraian. Tombol hanya muncul bila peramban mendukung.', { sorot: 'text=Ceritakan dengan suara' });
    await buka(PT, '/asisten'); await ke(PT, 'text=Lapor dengan suara', 'center');
    await foto(PT, 'Alur "Lapor dengan suara" di Asisten', 'Asisten menyediakan alur tanya-jawab suara untuk menyusun laporan, lalu meminta konfirmasi sebelum mengirim. Pengenalan suara tidak dapat dijalankan pada peramban uji otomatis, sehingga hanya tampilannya yang didokumentasikan.', { sorot: 'text=Lapor dengan suara' });
  });
  await bagian('F-09', 'Antrean offline dan draf laporan', async () => {
    await buka(PT, '/lapor'); await PT.evaluate(() => localStorage.removeItem('k3_draf'));
    await PT.selectOption('select[aria-label="Unit"]', { label: 'Kesehatan Lingkungan' }).catch(() => {}); await PT.click('[data-kat="limbah"]');
    PT.context().__luring = true; await PT.context().setOffline(true); await tidur(800);
    await foto(PT, 'Koneksi terputus saat melapor', 'Ketika perangkat kehilangan koneksi, penanda koneksi berubah. Formulir tetap dapat diisi dan dikirim.', { atas: true });
    await ke(PT, '#btn-kirim', 'center'); await PT.click('#btn-kirim'); await tidur(2500);
    await foto(PT, 'Laporan disimpan di antrean', 'Laporan yang gagal terkirim disimpan di antrean perangkat, bukan dibuang. Pengguna diberi tahu bahwa laporan akan dikirim saat koneksi kembali.', { atas: true });
    PT.context().__luring = false; await PT.context().setOffline(false); await tidur(800); await buka(PT, '/beranda'); await tidur(1500);
    await foto(PT, 'Antrean terkirim saat daring kembali', 'Saat koneksi kembali, antrean dikirim otomatis atau melalui tombol "Kirim sekarang". Pengenal klien unik mencegah laporan tercatat ganda.', { atas: true, sorot: 'text=Kirim sekarang' });
    await PT.click('text=Kirim sekarang').catch(() => {}); await tidur(1500);
  });
  await bagian('F-11', 'Laporan saya', async () => {
    await buka(PT, '/laporan-saya'); await foto(PT, 'Daftar laporan yang pernah dikirim', 'Menu "Laporan saya" menampilkan laporan milik pengguna beserta status terkininya. Laporan anonim tidak muncul di sini; gunakan kode lacak.', { atas: true, sorot: 'main a.baris-ringkas, main .kartu a >> nth=0' });
    await PT.locator('main a[href*="laporan/"]').first().click().catch(() => {}); await tidur(1200);
    await foto(PT, 'Detail laporan dari sisi pelapor', 'Pelapor dapat melihat tahap penanganan (Tercatat → Penanggung jawab → Tindak lanjut → Tertutup) dan riwayat status, tetapi tidak dapat mengubahnya.', { atas: true });
  });

  // ---------------- Empat tahap pada laporan F-06 ----------------
  await bagian('F-13', 'Penetapan penanggung jawab dan penilaian risiko', async () => {
    await buka(K, '/laporan/' + S.lap); await foto(K, 'Laporan baru di sisi K3RS', 'K3RS membuka laporan berstatus "Baru". Penanda tahap di bagian atas memperlihatkan posisi laporan pada alur empat tahap.', { atas: true, sorot: 'ol.tahap' });
    await ke(K, 'form.aksi'); await foto(K, 'Formulir Tahap (b)', 'Formulir "Tahap (b): Penanggung jawab & penilaian risiko" berisi pilihan PJ, tanggal target, nilai Dampak dan Kemungkinan (1–5), serta catatan.', { sorot: 'form.aksi' });
    const pj = K.locator('form.aksi select').first(); const op = await pj.locator('option').allTextContents(); await pj.selectOption({ index: Math.max(1, op.findIndex(x => /PJ IPSRS/.test(x))) });
    await K.fill('form.aksi input[type=date]', wita(7)); const sel = K.locator('form.aksi select'); await sel.nth(1).selectOption('4'); await sel.nth(2).selectOption('3'); await K.fill('form.aksi input[placeholder^="Pesan"]', 'Isolasi kabel dan cek panel');
    await ke(K, 'form.aksi .skor', 'center');
    await foto(K, 'Skor risiko dihitung otomatis', 'Skor = Dampak × Kemungkinan dan langsung diberi tingkat sesuai pita risiko di Pengaturan. Catatan: register risiko rumah sakit memakai matriks per sel; perbedaan ini tercatat sebagai keterbatasan.', { sorot: 'form.aksi .skor' });
    await ke(K, 'form.aksi button[type=submit]', 'center'); await foto(K, 'Menyimpan penugasan', 'Tekan "TUGASKAN". Server menolak status lanjutan tanpa PJ dan tanggal target (prinsip D3).', { sorot: 'form.aksi button[type=submit]' });
    await K.click('form.aksi button[type=submit]'); await tidur(1500);
    await foto(K, 'Status berubah menjadi Ditugaskan', 'Status laporan menjadi "Ditugaskan"; penanda tahap maju ke "Penanggung jawab".', { atas: true, sorot: 'ol.tahap' });
  });
  await bagian('F-14', 'Daftar tugas penanggung jawab', async () => {
    await buka(PJ, '/tugas'); await foto(PJ, 'Tugas untuk PJ unit', 'PJ unit membuka Menu → Tugas & CAPA. Daftar memuat laporan yang ditugaskan kepadanya, dengan filter, pencarian, dan urutan.', { atas: true });
    await PJ.fill('input[aria-label^="Cari nomor"]', S.nomor); await tidur(1500); await ke(PJ, 'main a:has-text("' + S.nomor + '")', 'center'); await foto(PJ, 'Laporan yang baru ditugaskan', 'Laporan dari langkah sebelumnya muncul dengan nomor, unit, tanggal, dan status. Ketuk untuk membuka detailnya.', { sorot: 'main a:has-text("' + S.nomor + '")' });
  });
  await bagian('F-15', 'Tindak lanjut dengan hierarki pengendalian', async () => {
    await buka(PJ, '/laporan/' + S.lap); await ke(PJ, 'h2:has-text("Tahap (c)")');
    await foto(PJ, 'Formulir Tahap (c)', 'PJ mengisi uraian tindakan, memilih tingkat pengendalian (eliminasi, substitusi, rekayasa, administratif, APD), dan bukti perubahan. Teks pengingat menganjurkan tingkat atas.', { sorot: 'form.aksi:has(h2:has-text("Tahap (c)"))' });
    const f = PJ.locator('form.aksi:has(h2:has-text("Tahap (c)"))');
    await f.locator('textarea').fill('Area diberi rambu bahaya listrik dan petugas diwajibkan sarung tangan isolasi sementara.'); await f.locator('select').selectOption('apd'); await f.locator('input[placeholder^="Contoh"]').fill('Foto rambu terpasang');
    await foto(PJ, 'Mencatat tindakan sementara (APD)', 'Contoh tindakan awal: rambu dan APD. Tingkat ini sah dicatat, tetapi hanya dapat membawa laporan ke status "terkendali sementara", bukan "tertutup" (prinsip D4).', { sorot: 'form.aksi:has(h2:has-text("Tahap (c)")) button[type=submit]' });
    await f.locator('button[type=submit]').click(); await tidur(1500);
    await ke(PJ, 'h2:has-text("Tindak lanjut")'); await foto(PJ, 'Tindak lanjut tersimpan', 'Tindakan tersimpan di daftar tindak lanjut dengan penanda "sementara". Status laporan menjadi "Sedang ditangani".', {});
  });
  await bagian('F-16', 'Aturan penutupan sah dan daftar periksa D2–D4', async () => {
    await buka(K, '/laporan/' + S.lap); await ke(K, 'h2:has-text("Tahap (d)")');
    await foto(K, 'Daftar periksa penutupan', 'Panel "Tahap (d)" menampilkan tiga syarat: satu penanggung jawab (D2), bukti perubahan tingkat fisik (D2, D4), serta status dan tanggal tercatat (D3). Syarat yang belum terpenuhi ditandai.', { sorot: 'ul.cek' });
    await K.click('text=Verifikasi & TUTUP'); await K.waitForSelector('dialog [data-ya]'); await tidur(400);
    await foto(K, 'Konfirmasi penutupan', 'K3RS menekan "Verifikasi & TUTUP". Aplikasi meminta konfirmasi dan mengingatkan bahwa server akan menolak bila belum ada pengendalian fisik dengan bukti.', { sorot: 'dialog [data-ya]' });
    await K.click('dialog [data-ya]'); await tidur(1200);
    await foto(K, 'Penutupan ditolak server', 'Karena tindakan baru setingkat APD, server menolak perubahan ke "tertutup" dan pesan kesalahan ditampilkan. Aturan ini ditegakkan oleh trigger basis data, bukan hanya oleh tombol.', {});
    S.tl2 = true; await buka(PJ, '/laporan/' + S.lap); const f = PJ.locator('form.aksi:has(h2:has-text("Tahap (c)"))');
    await f.locator('textarea').fill('Kabel diganti dengan kabel berpelindung dan dipasang conduit tahan air; panel diberi penutup.'); await f.locator('select').selectOption('rekayasa'); await f.locator('input[placeholder^="Contoh"]').fill('Foto sebelum-sesudah, SPK perbaikan IPSRS');
    await ke(PJ, 'h2:has-text("Tahap (c)")'); await foto(PJ, 'PJ mencatat pengendalian rekayasa', 'PJ menambahkan tindakan tingkat rekayasa dengan bukti. Inilah perubahan pada tingkat fisik yang disyaratkan untuk penutupan.', { sorot: 'form.aksi:has(h2:has-text("Tahap (c)")) select' });
    await f.locator('button[type=submit]').click(); await tidur(1500);
    await buka(K, '/laporan/' + S.lap); await ke(K, 'h2:has-text("Tahap (d)")');
    await foto(K, 'Semua syarat terpenuhi', 'Daftar periksa kini menunjukkan ketiga syarat terpenuhi.', { sorot: 'ul.cek' });
    await K.fill('.kartu.aksi:has(h2:has-text("Tahap (d)")) input', 'Diverifikasi saat ronde K3'); await K.click('text=Verifikasi & TUTUP'); await ya(K); await tidur(800);
    await foto(K, 'Laporan tertutup', 'Status menjadi "Tertutup" dan keempat tahap selesai. Status tertutup berarti syarat pencatatan terpenuhi; status ini bukan bukti bahwa risiko di tempat kerja telah hilang.', { atas: true, sorot: 'ol.tahap' });
  });
  await bagian('F-18', 'Riwayat status dan jejak perubahan', async () => {
    await buka(K, '/laporan/' + S.lap); await ke(K, 'h2:has-text("Riwayat status")');
    await foto(K, 'Riwayat status', 'Setiap perubahan status tercatat dengan tanggal dan catatan, termasuk penugasan dan penutupan.', { sorot: 'ol.linimasa' });
    await ke(K, 'details.jejak'); await K.click('details.jejak summary').catch(() => {}); await tidur(800); await ke(K, 'details.jejak');
    await foto(K, 'Jejak perubahan (nilai lama → baru)', 'Panel jejak (khusus K3RS) memperlihatkan siapa mengubah apa, kapan, serta nilai lama dan baru.', { sorot: 'details.jejak' });
    await ke(K, 'text=Lihat nama', 'center'); await foto(K, 'Melihat nama pelapor tercatat di log', 'Nama pelapor disembunyikan secara bawaan. K3RS dapat membukanya, dan tindakan itu sendiri dicatat di log aktivitas.', { sorot: 'text=Lihat nama' });
  });

  // ---------------- Daftar, dasbor, ekspor, bulanan, log ----------------
  await bagian('F-12', 'Daftar laporan dan risk register', async () => {
    await buka(K, '/semua'); await foto(K, 'Daftar laporan unit/semua', 'Halaman "Laporan & risk register" memuat pencarian, filter status, unit, jenis bahaya, jenis laporan, rentang tanggal, dan urutan.', { atas: true, sorot: 'input[aria-label^="Cari nomor"]' });
    await K.fill('input[aria-label^="Cari nomor"]', 'kabel'); await tidur(1500);
    await foto(K, 'Mencari dengan kata kunci', 'Pencarian berjalan di server sehingga tetap cepat untuk ribuan laporan.', { atas: true });
    await K.fill('input[aria-label^="Cari nomor"]', ''); await K.selectOption('select[aria-label="Status"]', { index: 2 }).catch(() => {}); await tidur(1500);
    await ke(K, '.pager'); await foto(K, 'Filter dan paginasi', 'Filter status dan penanda halaman (jumlah data, halaman ke-, ukuran halaman) membantu menelusuri register.', { sorot: '.pager' });
  });
  await bagian('F-20', 'Dasbor', async () => {
    await buka(K, '/dasbor'); await foto(K, 'Ringkasan angka', 'Dasbor dibuka dengan catatan bahwa angka hanyalah hitungan catatan, bukan ukuran tingkat keselamatan atau kinerja seseorang. Kartu memperlihatkan total, mendesak belum selesai, melewati target, dan laporan baru yang belum ditugaskan.', { atas: true });
    await ke(K, 'h2:has-text("Titik putus")'); await foto(K, 'Titik putus alur empat tahap', 'Grafik ini menunjukkan di tahap mana catatan berhenti: (a) tercatat belum ditugaskan, (b) ditugaskan belum ada tindakan, (c) ditangani belum ditutup, (d) terkendali sementara/tertutup.', { sorot: '.kartu:has(h2:has-text("Titik putus"))' });
    await ke(K, 'h2:has-text("Kesenjangan catatan")'); await foto(K, 'Kesenjangan catatan', 'Kesenjangan catatan menghitung laporan tanpa PJ, tanpa tanggal target, belum dinilai risikonya, dan pengendalian yang baru setingkat APD/administratif.', { sorot: '.kartu:has(h2:has-text("Kesenjangan catatan"))' });
    await ke(K, 'h2:has-text("Per tingkat risiko")'); await foto(K, 'Sebaran per tingkat risiko dan status', 'Grafik batang per tingkat risiko, status, jenis bahaya, unit, dan tingkat pengendalian.', {});
  });
  await bagian('F-21', 'Ekspor CSV', async () => {
    await buka(K, '/ekspor'); await foto(K, 'Pilihan ekspor', 'Halaman Ekspor menyediakan CSV laporan, tindak lanjut, riwayat status, format daftar risiko, log aktivitas, dan cadangan JSON. Setiap ekspor dicatat di log.', { atas: true, sorot: 'text=Format daftar risiko (CSV)' });
    await K.click('text=Laporan (CSV)'); await tidur(1500);
    await foto(K, 'Berkas diunduh', 'Berkas CSV diunduh ke perangkat. Keterbatasan: kolom format daftar risiko belum sama dengan 25 kolom register rumah sakit.', { atas: true });
  });
  await bagian('F-22', 'Laporan bulanan', async () => {
    await buka(K, '/bulanan'); await K.selectOption('select[aria-label="Periode"]', { index: 0 }).catch(() => {}); await tidur(1800);
    await foto(K, 'Laporan bulanan', 'Pilih periode; laporan menyusun rekap jumlah laporan, risiko, dan tindak lanjut untuk rapat Komite.', { atas: true, sorot: 'select[aria-label="Periode"]' });
    await ke(K, 'h2:has-text("Insight otomatis")'); await foto(K, 'Insight otomatis', 'Kalimat ringkasan disusun otomatis dari angka bulan itu dan bulan sebelumnya.', {});
    await ke(K, 'text=Cetak / PDF', 'center'); await foto(K, 'Cetak, CSV, dan arsip', 'Laporan dapat dicetak/disimpan sebagai PDF atau diunduh sebagai CSV.', { sorot: 'text=Cetak / PDF' });
  });
  await bagian('F-19', 'Log aktivitas', async () => {
    await buka(K, '/log'); await foto(K, 'Log aktivitas sistem', 'Log mencatat masuk, ekspor, perubahan pengaturan, dan pembukaan nama pelapor beserta waktu dan pelakunya. Hanya K3RS yang dapat membukanya.', { atas: true });
  });

  // ---------------- Modul kerja ----------------
  await bagian('F-23', 'Inspeksi terpandu', async () => {
    await buka(P3, '/inspeksi'); await foto(P3, 'Daftar inspeksi', 'Menu Inspeksi menampilkan riwayat inspeksi dan tombol "Mulai inspeksi".', { atas: true, sorot: 'text=Mulai inspeksi' });
    await buka(P3, '/inspeksi?baru=1'); await P3.click('[data-templat=kebakaran]'); await P3.selectOption('main .kartu select', { label: 'IPSRS' }).catch(() => P3.selectOption('main .kartu select', { index: 2 }));
    await foto(P3, 'Memilih daftar periksa dan unit', 'Pilih templat daftar periksa (contoh: kebakaran/APAR) dan unit yang diinspeksi, lalu pilih mode terpandu atau isi sebagai daftar.', { sorot: 'text=Mulai mode terpandu' });
    await P3.click('text=Mulai mode terpandu'); await tidur(700);
    await foto(P3, 'Mode terpandu: satu pertanyaan per layar', 'Mode terpandu menampilkan satu butir per layar dengan tombol besar "Sesuai" / "Tidak sesuai", cocok dipakai sambil berjalan.', { sorot: 'text=✕ Tidak sesuai' });
    await P3.click('text=✕ Tidak sesuai'); await P3.fill('.temuan-isi input', '[DEMO] APAR lantai 2 terhalang troli');
    await foto(P3, 'Mencatat temuan', 'Butir "Tidak sesuai" wajib diberi catatan temuan.', { sorot: '.temuan-isi' });
    await P3.click('.temuan-isi >> text=Lanjut');
    for (let i = 0; i < 12; i++) { if (await P3.$('text=Ringkasan inspeksi')) break; await P3.click('text=✓ Sesuai').catch(() => {}); await tidur(250); }
    await P3.waitForSelector('text=Ringkasan inspeksi'); await foto(P3, 'Ringkasan dan skor kepatuhan', 'Setelah butir terakhir, aplikasi menghitung skor kepatuhan dan jumlah temuan.', { atas: true });
    await P3.click('text=Simpan inspeksi'); await tidur(1500);
    await foto(P3, 'Inspeksi tersimpan', 'Inspeksi tersimpan dengan nomor. Temuan dapat langsung diteruskan sebagai laporan bahaya.', { atas: true, sorot: 'text=Laporkan sebagai bahaya' });
    await P3.click('text=Laporkan sebagai bahaya').catch(() => {}); await tidur(900);
    await foto(P3, 'Temuan menjadi laporan bahaya', 'Formulir lapor terisi otomatis dari temuan inspeksi sehingga temuan masuk alur empat tahap.', { atas: true });
    await P3.evaluate(() => localStorage.removeItem('k3_draf'));
  });
  await bagian('F-24', 'Job Safety Analysis (JSA)', async () => {
    await buka(P3, '/jsa'); await foto(P3, 'Daftar JSA', 'Menu JSA menampilkan JSA beserta statusnya dan tombol "Buat JSA".', { atas: true, sorot: 'text=Buat JSA' });
    await buka(P3, '/jsa?baru=1&pekerjaan=' + encodeURIComponent('Perbaikan panel listrik di atap memakai tangga')); await P3.waitForSelector('form.form-jsa');
    await foto(P3, 'Formulir JSA baru', 'Isi nama pekerjaan dan unit. Tombol "Buat langkah awal otomatis" menyusun langkah dan bahaya awal dari nama pekerjaan.', { sorot: 'text=Buat langkah awal otomatis' });
    await P3.click('text=Buat langkah awal otomatis'); await tidur(900); await ke(P3, '.langkah-kartu >> nth=1');
    await foto(P3, 'Langkah dan bahaya terdeteksi', 'Setiap langkah diberi penanda bahaya (contoh: listrik, ketinggian). Saran ini berbasis kata kunci dan tetap harus ditelaah penyusun.', { sorot: '.langkah-kartu >> nth=1' });
    await P3.click('.langkah-kartu:nth-of-type(2) >> text=Isi saran pengendalian').catch(() => {}); await tidur(500); await ke(P3, '.langkah-kartu >> nth=1');
    await foto(P3, 'Saran pengendalian berjenjang', 'Saran pengendalian diisi per tingkat hierarki (eliminasi sampai APD) dan dapat disunting.', { sorot: '.langkah-kartu >> nth=1' });
    await P3.selectOption('form.form-jsa select >> nth=0', { label: 'IPSRS' }).catch(() => P3.selectOption('form.form-jsa select >> nth=0', { index: 12 }));
    await P3.click('text=Simpan JSA'); await tidur(700);
    if (await P3.$('dialog [data-ya]')) { await foto(P3, 'Peringatan pengendalian belum memadai', 'Langkah berisiko tinggi yang hanya dikendalikan dengan APD/administratif memunculkan peringatan sebelum disimpan.', { sorot: 'dialog .dialog-isi' }); await ya(P3); }
    await tidur(800); await foto(P3, 'JSA tersimpan', 'JSA tersimpan sebagai draf dan menunggu persetujuan K3RS lain sebelum dapat dirujuk izin kerja.', { atas: true });
  });
  await bagian('F-25', 'Pemantauan K3', async () => {
    await buka(K, '/pemantauan'); await foto(K, 'Formulir pengukuran', 'Pemantauan mencatat hasil pengukuran lingkungan kerja (contoh: kebisingan, pencahayaan) atau kesehatan kerja, lengkap dengan ambang.', { atas: true });
    await K.selectOption('main form select >> nth=1', { index: 10 }).catch(() => {}); await K.fill('main form .tiga input >> nth=0', '95').catch(() => {}); await tidur(300);
    await ke(K, 'main form', 'start'); await foto(K, 'Status ambang langsung terlihat', 'Saat nilai diisi, aplikasi langsung menandai apakah hasil melebihi ambang, sebelum disimpan.', { sorot: 'main form' });
    await K.click('main form >> text=Simpan'); await tidur(1200); await ke(K, 'h2:has-text("Riwayat")');
    await foto(K, 'Riwayat dan hasil di luar ambang', 'Data tersimpan di riwayat; hasil di luar ambang dikumpulkan di bagian tersendiri.', {});
  });
  await bagian('F-26', 'Izin kerja (PTW) dan Stop Work Authority', async () => {
    await buka(PJ, '/izin'); await foto(PJ, 'Dasbor izin kerja', 'Halaman Izin kerja menampilkan jumlah izin per status, grafik per jenis/unit/lokasi, dan daftar izin.', { atas: true, sorot: 'text=Ajukan izin' });
    await buka(PJ, '/izin?baru=1'); await PJ.waitForSelector('.grid-templat'); await foto(PJ, 'Memilih jenis pekerjaan', 'Pilih jenis izin (panas, ketinggian, listrik, ruang terbatas, dan lainnya). Setiap jenis memiliki daftar periksa sendiri.', { sorot: '.kartu.templat:has-text("listrik")' });
    await PJ.click('.kartu.templat:has-text("listrik")'); await PJ.getByLabel('Nama pekerjaan').fill('[DEMO] Perbaikan panel listrik lorong servis');
    await PJ.selectOption('form.form-izin select >> nth=1', { index: 1 }).catch(() => {});
    const o = await PJ.$$eval('form.form-izin select >> nth=2 >> option', x => x.map(y => y.textContent)).catch(() => []);
    if (o.length > 1) await PJ.selectOption('form.form-izin select >> nth=2', { index: 1 }).catch(() => {}); await tidur(500);
    await ke(PJ, 'form.form-izin'); await foto(PJ, 'Mengisi formulir izin', 'Isi pekerjaan, supervisor, waktu, dan JSA rujukan. Bahaya dan pengendalian dari JSA yang disetujui tersalin otomatis.', { sorot: 'form.form-izin select >> nth=2' });
    await ke(PJ, 'text=Simpan sebagai draf', 'center'); await foto(PJ, 'Menyimpan draf', 'Simpan sebagai draf, lalu isi daftar periksa dan ajukan.', { sorot: 'text=Simpan sebagai draf' });
    await PJ.click('text=Simpan sebagai draf'); await tidur(1800);
    await foto(PJ, 'Detail izin berstatus draf', 'Izin memperoleh nomor PTW. Alur persetujuan: diajukan → supervisor → tinjauan K3 → pengesahan → aktif → selesai → ditutup. Pekerjaan tidak dapat dimulai sebelum disahkan.', { atas: true });
    const aktif = sql("select id from izin_kerja where status='aktif' limit 1");
    if (aktif) { await buka(K, '/izin?id=' + aktif); await foto(K, 'Izin aktif', 'Izin yang sedang berjalan menampilkan waktu berlaku, daftar periksa, dan tombol "HENTIKAN PEKERJAAN".', { atas: true });
      await ke(K, '.swa-tombol', 'center'); await foto(K, 'Stop Work Authority', 'Siapa pun yang berwenang dapat menekan "HENTIKAN PEKERJAAN" bila menemukan kondisi tidak aman; aplikasi meminta uraian kondisi tersebut.', { sorot: '.swa-tombol' });
      K.__jawab = 'Ditemukan kabel bertegangan tanpa LOTO di area kerja'; await K.click('.swa-tombol'); await tidur(1500); K.__jawab = '';
      await foto(K, 'Izin ditangguhkan', 'Izin berubah menjadi "Ditangguhkan" dan hanya K3RS yang dapat melanjutkannya setelah tindakan dicatat.', { atas: true }); }
  });
  await bagian('F-27', 'Toolbox meeting dan presensi QR', async () => {
    await buka(K, '/kegiatan'); await foto(K, 'Kalender kegiatan', 'Menu Pelatihan & toolbox menampilkan kalender, daftar, dasbor, dan riwayat. Kehadiran dicatat terpisah dari kompetensi.', { atas: true, sorot: 'text=Toolbox meeting' });
    await buka(K, '/kegiatan?baru=toolbox'); await K.fill('form input[maxlength="160"]', '[DEMO] Penanganan tumpahan B3'); await K.fill('form input[type=datetime-local]', lokal());
    await foto(K, 'Membuat toolbox meeting', 'Isi topik, waktu, dan lokasi. Nomor TBM diberikan otomatis setelah disimpan.', { atas: true, sorot: 'form button[type=submit]' });
    await K.click('form button[type=submit]'); await K.waitForFunction(() => /kegiatan\?id=/.test(location.hash)); await tidur(900);
    for (const nm of ['Kesling', 'Farmasi']) { await K.fill('input[aria-label="Cari rekan"]', nm); await K.waitForSelector('.chip-baris button:has-text("Petugas ' + nm + '")'); await K.click('.chip-baris button:has-text("Petugas ' + nm + '")'); await tidur(900); }
    await ke(K, 'input[aria-label="Cari rekan"]'); await foto(K, 'Menambah peserta', 'Cari rekan dengan nama, lalu ketuk untuk menambahkannya sebagai peserta.', { sorot: 'input[aria-label="Cari rekan"]' });
    await K.click('text=Tampilkan QR presensi'); await K.waitForSelector('.qr-hadir svg'); const kode = (await K.textContent('.qr-hadir')).match(/Kode: (\w+)/)[1]; await ke(K, '.qr-hadir', 'center');
    await foto(K, 'QR presensi', 'Penyelenggara menampilkan kode QR. Peserta memindainya dengan kamera ponsel.', { sorot: '.qr-hadir' });
    await buka(PT, '/hadir?k=' + kode); await tidur(800);
    await foto(PT, 'Peserta tercatat hadir', 'Setelah memindai, peserta yang sudah masuk akun langsung tercatat hadir dengan cara "QR".', { atas: true });
    await buka(K, '/kegiatan?id=' + sql("select id from kegiatan order by dibuat_pada desc limit 1")); await ke(K, 'table, .tabel-peserta, input[aria-label="Cari rekan"]');
    await foto(K, 'Daftar hadir diperbarui', 'Daftar peserta di sisi penyelenggara menunjukkan siapa yang hadir melalui QR dan siapa yang belum.', {});
  });
  await bagian('F-28', 'Pelatihan, pre-test/post-test, kompetensi, sertifikat', async () => {
    await buka(K, '/kegiatan?baru=pelatihan'); await K.fill('form input[maxlength="160"]', '[DEMO] Penggunaan APAR dan Code Red'); await K.fill('form input[type=datetime-local]', lokal()); await K.fill('form input[placeholder^="kosong"]', '24').catch(() => {});
    await foto(K, 'Membuat pelatihan', 'Pelatihan diisi seperti toolbox, ditambah masa berlaku sertifikat (bulan).', { atas: true, sorot: 'form button[type=submit]' });
    await K.click('form button[type=submit]'); await K.waitForFunction(() => /kegiatan\?id=/.test(location.hash)); await tidur(900);
    await K.fill('input[aria-label="Cari rekan"]', 'Kesling'); await K.waitForSelector('.chip-baris button:has-text("Petugas Kesling")'); await K.click('.chip-baris button:has-text("Petugas Kesling")'); await tidur(900);
    const n = 'Demo Petugas Kesling';
    await K.selectOption(`select[aria-label="Kehadiran ${n}"]`, 'hadir'); await K.fill(`input[aria-label="Nilai pre-test ${n}"]`, '50'); await K.fill(`input[aria-label="Nilai post-test ${n}"]`, '85'); await K.selectOption(`select[aria-label="Kompetensi ${n}"]`, 'kompeten');
    await ke(K, `input[aria-label="Nilai pre-test ${n}"]`, 'center'); await foto(K, 'Mengisi kehadiran, nilai, dan kompetensi', 'Isi kehadiran, nilai pre-test dan post-test, serta hasil kompetensi untuk tiap peserta.', { sorot: `input[aria-label="Nilai post-test ${n}"]` });
    await K.click(`button[aria-label="Simpan ${n}"]`); await tidur(1200); await ke(K, `input[aria-label="Metode asesmen ${n}"]`, 'center');
    await foto(K, 'Metode asesmen wajib', 'Bila status "Kompeten" disimpan tanpa metode asesmen, server menolak dengan pesan aturan basis data (kompetensi berbasis asesmen). Isian "Metode asesmen" harus diisi lebih dahulu.', { sorot: `input[aria-label="Metode asesmen ${n}"]` });
    await K.fill(`input[aria-label="Metode asesmen ${n}"]`, 'Praktik memadamkan api dengan APAR'); await K.click(`button[aria-label="Simpan ${n}"]`); await tidur(1300);
    await ke(K, `input[aria-label="Metode asesmen ${n}"]`, 'center'); await foto(K, 'Sertifikat terbit', 'Dengan metode asesmen, status menjadi kompeten dan nomor sertifikat terbit beserta masa berlakunya.', {});
  });
  await bagian('F-29', 'Investigasi dan analisis akar masalah (RCA)', async () => {
    await buka(P3, '/investigasi'); await foto(P3, 'Daftar laporan yang perlu investigasi', 'Menu Investigasi menampilkan laporan kejadian/nyaris celaka 90 hari terakhir yang belum diinvestigasi, serta daftar investigasi.', { atas: true, sorot: 'text=Mulai investigasi' });
    await P3.click('text=Mulai investigasi'); await P3.waitForSelector('form button[type=submit]'); await P3.fill('form input[maxlength="200"]', 'Mengangkut kantong limbah medis ke TPS').catch(() => {});
    await foto(P3, 'Membuka investigasi', 'Isi aktivitas saat kejadian dan susunan tim, lalu simpan. Investigasi tertaut ke laporan asal.', { atas: true, sorot: 'form button[type=submit]' });
    await P3.click('form button[type=submit]'); await P3.waitForFunction(() => /investigasi\?id=/.test(location.hash)); S.inv = decodeURIComponent((await P3.evaluate(() => location.hash)).match(/id=([^&]+)/)[1]); await tidur(900);
    await foto(P3, 'Investigasi baru', 'Investigasi memperoleh nomor INV dan status awal. Tekan "Mulai analisis" untuk membuka tab RCA.', { atas: true, sorot: 'text=Mulai analisis' });
    await P3.click('text=Mulai analisis'); await ya(P3);
    await P3.click('[role=tab]:has-text("Kronologi")'); await P3.click('text=Tambah peristiwa'); await P3.fill('.baris-item input >> nth=0', '07.40'); await P3.fill('.baris-item input >> nth=1', 'Petugas mengikat kantong kuning dari ruang tindakan tanpa memeriksa isi');
    await ke(P3, '[role=tab]:has-text("Kronologi")'); await foto(P3, 'Tab Kronologi', 'Peristiwa dicatat berurutan dengan jam dan uraian.', { sorot: '.baris-item' });
    await P3.click('[role=tab]:has-text("Penyebab")'); await P3.fill('textarea >> nth=2', 'Jarum bekas dibuang ke kantong kuning, bukan ke safety box').catch(() => {});
    await ke(P3, '[role=tab]:has-text("Penyebab")'); await foto(P3, 'Tab Penyebab', 'Penyebab langsung, kondisi, dan faktor dasar dicatat terpisah.', {});
    await P3.click('[role=tab]:has-text("5 Why")'); await P3.click('text=Tambah rantai penyebab'); await P3.fill('.rantai-why input >> nth=0', 'Petugas tertusuk jarum');
    await P3.fill('.why-daftar input >> nth=0', 'Jarum ada di kantong kuning'); await P3.click('text=Tambah "Mengapa?"'); await P3.fill('.why-daftar input >> nth=1', 'Safety box di ruang tindakan penuh');
    await P3.click('text=Tambah "Mengapa?"'); await P3.fill('.why-daftar input >> nth=2', 'Tidak ada jadwal penggantian safety box'); await P3.fill('.rantai-why input[placeholder="Penyebab sistemik"]', 'Belum ada prosedur pemantauan isi safety box');
    await ke(P3, '.rantai-why'); await foto(P3, 'Tab 5 Why', 'Rantai "Mengapa?" disusun bertingkat sampai penyebab sistemik.', { sorot: '.rantai-why' });
    await P3.click('[role=tab]:has-text("Fishbone")'); await P3.fill('input[maxlength="300"]', 'Petugas Kesling tertusuk jarum');
    await P3.click('details.fb-kat:has-text("Metode") summary'); await P3.click('details.fb-kat:has-text("Metode") >> text=Tambah penyebab');
    await P3.fill('details.fb-kat:has-text("Metode") .fb-item input >> nth=0', 'Tidak ada jadwal ganti safety box'); await P3.check('details.fb-kat:has-text("Metode") .fb-item input[type=checkbox]');
    await ke(P3, 'details.fb-kat:has-text("Metode")'); await foto(P3, 'Tab Fishbone — isian per kategori', 'Penyebab dikelompokkan per kategori (manusia, metode, mesin, material, lingkungan, manajemen). Centang menandai akar masalah.', { sorot: 'details.fb-kat:has-text("Metode")' });
    await P3.click('button:has-text("Simpan")'); await tidur(1000); await ke(P3, 'svg'); await foto(P3, 'Diagram Fishbone', 'Isian Fishbone tersimpan; kepala ikan (masalah) dan cabang kategori digambar otomatis sebagai diagram tulang ikan di bawahnya.', {});
    await P3.click('text=Ajukan persetujuan'); await ya(P3); await tidur(600);
    await foto(P3, 'Pengajuan ditolak bila CAPA belum ada', 'Server menolak pengajuan persetujuan sebelum ada CAPA untuk akar masalah.', { atas: true });
    await P3.click('[role=tab]:has-text("CAPA")'); await P3.selectOption('form select >> nth=0', { index: 1 }); await P3.fill('form textarea', 'Tetapkan jadwal pemeriksaan dan penggantian safety box (≤3/4 penuh)');
    const pjSel = await P3.$$('form select'); for (const s of pjSel.slice(1)) { const o = await s.$$eval('option', x => x.map(y => y.textContent)); const i = o.findIndex(x => /PJ Kesling/.test(x)); if (i > 0) await s.selectOption({ index: i }); }
    await ke(P3, 'form textarea', 'center'); await foto(P3, 'Tab CAPA — membuat tindakan', 'Pilih akar masalah, tulis tindakan korektif/preventif, pilih PJ dan target. CAPA tertaut ke investigasi.', { sorot: 'form button[type=submit]' });
    await P3.click('form button[type=submit]'); await tidur(1000); await P3.click('text=Ajukan persetujuan'); await ya(P3); await tidur(600);
    await foto(P3, 'Menunggu persetujuan', 'Investigasi diajukan. Ketua tim tidak boleh menyetujui investigasinya sendiri (pemisahan tugas).', { atas: true });
    await buka(K, '/investigasi?id=' + S.inv); K.__jawab = 'Analisis memadai'; await ke(K, 'button:has-text("Setujui")', 'center');
    await foto(K, 'K3RS lain menyetujui', 'K3RS lain membuka investigasi dan menekan "Setujui" dengan catatan.', { sorot: 'button:has-text("Setujui")' });
    await K.click('button:has-text("Setujui")'); await tidur(1300); K.__jawab = '';
    await foto(K, 'Investigasi disetujui', 'Status menjadi disetujui; nama penyetuju dan waktunya tercatat.', { atas: true });
    const [pop] = await Promise.all([K.context().waitForEvent('page', { timeout: 6000 }).catch(() => null), K.click('text=Laporan cetak')]);
    if (!pop) { await tidur(1200); await foto(K, 'Laporan cetak investigasi', 'Laporan cetak memuat kronologi, 5 Why, Fishbone, dan CAPA untuk rapat Komite.', { atas: true }); }
    if (pop) { await pop.setViewportSize({ width: 390, height: 844 }); await tidur(1500); await pop.evaluate(() => { window.print = () => {}; }); await foto(pop, 'Laporan cetak investigasi', 'Laporan cetak memuat kronologi, 5 Why, Fishbone, dan CAPA untuk rapat Komite.', { atas: true }); await pop.close(); }
  });
  await bagian('F-30', 'CAPA lintas modul', async () => {
    await buka(K, '/capa'); await foto(K, 'Daftar CAPA', 'Menu CAPA lintas modul mengumpulkan tindakan dari investigasi, inspeksi, kegiatan, dan sumber lain, dengan filter status, sumber, dan prioritas.', { atas: true });
    await K.locator('main a[href*="capa?id="]').first().click().catch(() => {}); await tidur(1200);
    await foto(K, 'Detail CAPA', 'Detail CAPA menampilkan sumber, akar masalah, PJ, target, dan kemajuan.', { atas: true });
    await K.evaluate(() => scrollTo(0, document.body.scrollHeight)); await tidur(400);
    await foto(K, 'Pembaruan dan verifikasi efektivitas', 'PJ memperbarui kemajuan; penutupan memerlukan verifikasi efektivitas oleh penilai. Verifikasi ini berupa penilaian, bukan pengukuran risiko.', {});
  });
  await bagian('F-31', 'Pusat notifikasi dalam aplikasi', async () => {
    await buka(K, '/notifikasi'); await foto(K, 'Kotak masuk', 'Lonceng di bilah atas menunjukkan jumlah belum dibaca. Kotak masuk memuat notifikasi laporan baru, CAPA, izin kerja, dan kegiatan.', { atas: true });
    await K.click('[role=tab]:has-text("Perlu perhatian")'); await tidur(900); await foto(K, 'Perlu perhatian', 'Tab ini menghitung butir yang perlu ditindaklanjuti: CAPA terlambat, JSA menunggu persetujuan, dokumen lewat tanggal tinjau.', { atas: true });
    await K.click('[role=tab]:has-text("Pengaturan")'); await tidur(900); await foto(K, 'Pengaturan notifikasi', 'Pengguna memilih kategori yang ingin diterima. Kategori bertanda WAJIB tidak dapat dimatikan. Saluran email/push belum aktif di lingkungan ini.', { atas: true });
    await K.click('[role=tab]:has-text("Kotak masuk")'); await tidur(700); await K.click('text=Tandai semua dibaca'); await tidur(1000);
    await foto(K, 'Tandai semua dibaca', 'Tombol "Tandai semua dibaca" hanya mengubah notifikasi milik akun sendiri.', { atas: true });
  });

  // ---------------- Intelligence, cari, asisten, SOP ----------------
  await bagian('F-34', 'HSE Intelligence', async () => {
    await buka(K, '/intel'); await tidur(1200); await foto(K, 'Peringatan dini dan serah terima shift', 'HSE Intelligence menganalisis data yang boleh dilihat pengguna: angka 30 hari, peringatan dini, dan ringkasan serah terima shift.', { atas: true });
    await ke(K, 'h2:has-text("Serah terima shift")'); await foto(K, 'Ringkasan serah terima shift', 'Ringkasan dapat disalin atau dibacakan dengan suara.', { sorot: 'text=Salin ringkasan' });
    await K.click('text=Peta risiko'); await tidur(1200); await foto(K, 'Peta risiko (matriks 5 × 5)', 'Tab Peta risiko menampilkan matriks Dampak × Kemungkinan dengan jumlah catatan per sel; simbol ○ △ ◇ ✕ membedakan tingkat tanpa bergantung warna. Ketuk sel untuk melihat catatannya.', { atas: true });
    await K.click('text=Tren & epidemiologi'); await tidur(1200); await foto(K, 'Tren dan epidemiologi', 'Tren laporan per jenis selama enam bulan dan distribusi laporan per jam. Laporan anonim tidak dihitung pada distribusi jam untuk menjaga privasi.', { atas: true });
    await K.click('text=Kartu & hierarki'); await tidur(1200); await foto(K, 'Analisis bahaya pekerjaan dan piramida hierarki', 'Pengguna mengetik nama pekerjaan untuk melihat bahaya, skenario, dan pengendalian yang disarankan. Piramida menghitung tindak lanjut tercatat per tingkat hierarki pengendalian.', { atas: true });
  });
  await bagian('F-05', 'Informasi cuaca', async () => {
    await buka(K, '/intel'); await K.click('text=Cuaca'); await tidur(2500);
    await foto(K, 'Tab Cuaca', 'Tab Cuaca mengambil prakiraan dari layanan publik Open-Meteo untuk koordinat rumah sakit di Pengaturan, lalu menerjemahkannya menjadi peringatan kerja (panas, hujan lebat, angin).', { atas: true });
    await K.evaluate(() => scrollBy(0, 600)); await tidur(400); await foto(K, 'Prakiraan dan anjuran', 'Prakiraan per jam/hari disertai anjuran K3. Data cuaca diambil langsung dari layanan publik saat dokumentasi dibuat.', {});
  });
  await bagian('F-35', 'Pencarian cerdas lintas modul', async () => {
    await buka(K, '/cari'); await foto(K, 'Halaman Cari', 'Pencarian memahami kalimat sehari-hari dan menyediakan contoh pertanyaan.', { atas: true, sorot: 'input[aria-label="Kata pencarian"]' });
    await buka(K, '/cari?q=' + encodeURIComponent('kabel listrik')); await tidur(2000); await foto(K, 'Hasil pencarian', 'Hasil dikelompokkan per modul (laporan, inspeksi, JSA, SOP) dengan kutipan.', { atas: true });
    await buka(K, '/cari?tab=riwayat'); await tidur(1000); await foto(K, 'Riwayat 60 hari', 'Tab riwayat menampilkan linimasa 60 hari dengan waktu WITA dan shift.', { atas: true });
  });
  await bagian('F-36', 'Asisten', async () => {
    await buka(PT, '/asisten'); await foto(PT, 'Asisten K3', 'Asisten menjawab pertanyaan umum berdasarkan aturan lokal (bukan model bahasa) dan menyediakan tombol pintasan.', { atas: true, sorot: 'text=Cara melapor' });
    await PT.click('text=Cara melapor'); await tidur(700); await foto(PT, 'Jawaban asisten', 'Jawaban muncul sebagai percakapan dan dapat dibacakan.', {});
    await PT.fill('input[aria-label="Pertanyaan untuk asisten"]', 'Siapa yang melihat laporan saya?'); await PT.press('input[aria-label="Pertanyaan untuk asisten"]', 'Enter'); await tidur(900); await PT.evaluate(() => { const l = document.querySelectorAll('main .gelembung, main [class*=bicara], main [class*=pesan]'); if (l.length) l[l.length - 1].scrollIntoView({ block: 'center' }); });
    await foto(PT, 'Bertanya dengan kalimat sendiri', 'Pengguna dapat mengetik pertanyaan sendiri.', {});
  });
  await bagian('F-37', 'Pustaka SOP dan dokumen', async () => {
    await buka(K, '/sop'); await foto(K, 'Daftar dokumen aktif', 'Pustaka memuat SOP dan kebijakan dengan pemilik, tanggal tinjau, dan versi.', { atas: true, sorot: 'text=Unggah dokumen' });
    await K.locator('main a[href*="sop?id="]').first().click().catch(() => {}); await tidur(1000); await foto(K, 'Detail dokumen dan riwayat versi', 'Detail dokumen menampilkan isi, pemilik, tanggal tinjau, dan riwayat versi.', { atas: true });
    await buka(K, '/sop?unggah=1'); await K.setInputFiles('input[type=file]', path.join(__dirname, '../browser/dokumen-uji/kebijakan.txt')); await K.waitForSelector('.pratinjau-dok textarea', { timeout: 60000 }); await tidur(500);
    await foto(K, 'Mengunggah dokumen', 'Unggah TXT/PDF/DOCX/gambar; teks dibaca otomatis (gambar dan PDF pindaian melalui OCR) dan ditampilkan untuk diperiksa.', { atas: true, sorot: '.pratinjau-dok' });
    await K.click('text=Simpan dokumen'); await tidur(1300); await foto(K, 'Dokumen tersimpan', 'Dokumen tersimpan dan dapat ditemukan melalui pencarian.', { atas: true });
  });
  await bagian('F-38', 'Uji tampilan buta warna', async () => {
    await buka(K, '/uji-warna'); await foto(K, 'Simulasi buta warna', 'Halaman ini menyimulasikan tampilan tema saat ini untuk protanopia, deuteranopia, tritanopia, dan skala abu. Status tetap terbaca karena memakai simbol dan teks.', { atas: true });
    await ke(K, 'h2:has-text("Tritanopia")'); await foto(K, 'Tritanopia dan skala abu', 'Simulasi ini alat bantu visual; bukan uji dengan pengguna buta warna.', {});
  });

  // ---------------- Administrasi ----------------
  await bagian('F-39', 'Pengelolaan pengguna dan peran', async () => {
    await buka(K, '/pengguna'); await foto(K, 'Daftar pengguna', 'Admin K3RS melihat semua akun dengan pencarian dan filter status/peran.', { atas: true });
    await K.fill('input[aria-label^="Cari nama"]', 'farmasi'); await tidur(1200); await foto(K, 'Mengubah peran dan unit', 'Peran, unit, dan status aktif diubah per akun lalu disimpan. Perubahan dicatat di log.', { atas: true, sorot: 'main .kartu.pengguna select >> nth=0' });
  });
  await bagian('F-40', 'Pengaturan dan konfigurasi untuk replikasi', async () => {
    await buka(K, '/pengaturan'); await foto(K, 'Pengaturan umum', 'Nama rumah sakit dan pengaturan umum.', { atas: true });
    await ke(K, 'text=Pita tingkat risiko'); await foto(K, 'Pita tingkat risiko', 'Batas skor dan label tiap tingkat risiko dapat diatur.', {});
    await ke(K, 'h2:has-text("Unit / ruangan")'); await foto(K, 'Unit dan jenis bahaya', 'Daftar unit/ruangan dan jenis bahaya dapat ditambah atau diubah.', {});
    await ke(K, 'h2:has-text("Konfigurasi untuk replikasi")'); await foto(K, 'Konfigurasi untuk replikasi', 'Tombol "Unduh konfigurasi.json" mengekspor unit, jenis bahaya, dan pita risiko agar rumah sakit lain dapat memulai dengan pengaturan yang sama.', { sorot: 'text=Unduh konfigurasi.json' });
    await ke(K, 'h2:has-text("Lokasi rumah sakit")'); await foto(K, 'Lokasi untuk peringatan cuaca', 'Koordinat rumah sakit dipakai fitur cuaca.', {});
  });
  await bagian('F-41', 'Kode QR per unit/lokasi', async () => {
    await buka(K, '/qr'); await foto(K, 'Memilih unit untuk QR', 'Centang unit yang akan dicetak kodenya.', { atas: true });
    for (const u of ['IPSRS', 'Farmasi']) await K.check('main label:has-text("' + u + '") input').catch(() => {}); await tidur(800); await ke(K, 'main svg');
    await foto(K, 'QR siap cetak', 'Kode QR ditempel di lokasi; memindainya membuka formulir lapor dengan unit sudah terisi.', { sorot: 'text=Cetak' });
  });
  await bagian('F-53', 'Akun pengguna dan Bantuan', async () => {
    await buka(PT, '/akun'); await foto(PT, 'Halaman Akun', 'Ubah nama tampilan, kata sandi, tema, atau keluar. Tersedia tombol untuk menghapus draf/antrean di perangkat.', { atas: true });
    await buka(PT, '/bantuan'); await foto(PT, 'Halaman Bantuan', 'Bantuan menjelaskan cara melapor, arti status, privasi, dan HSE Intelligence.', { atas: true });
  });

  const keluar = path.join(OUT, 'manifest.json'); let lama = []; try { lama = JSON.parse(fs.readFileSync(keluar, 'utf8')); } catch (e) { }
  if (TEMA === 'bentenan' || !lama.length) { const gab = hanya ? lama.filter(x => !MANIFEST.some(m => m.id === x.id)).concat(MANIFEST) : MANIFEST; fs.writeFileSync(keluar, JSON.stringify(gab, null, 1)); }
  console.log('selesai', TEMA, MANIFEST.reduce((a, f) => a + f.langkah.length, 0), 'langkah; gagal:', MANIFEST.flatMap(f => f.langkah.filter(l => l.gagal).map(l => l.kode)).join(',') || '-', '; galat fitur:', MANIFEST.filter(f => f.galat).map(f => f.id + ':' + f.galat).join(' | ') || '-');
  await b.close();
})();
