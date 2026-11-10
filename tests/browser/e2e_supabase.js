// Uji ujung-ke-ujung MODE SUPABASE: tampilan → API → server REST uji → PostgreSQL (RLS, pemicu, fungsi sungguhan).
// Prasyarat: tests/server/siapkan_e2e.sh, node tests/server/rest-uji.js 3101, situs di :8765.
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const L = require('./lib-supabase.js');
const sql = q => execFileSync('psql', ['-d', 'hse_e2e', '-tAq', '-c', q]).toString().trim();
const hasil = []; const ok = (b, m) => { hasil.push((b ? 'LULUS ' : 'GAGAL ') + m); if (!b) console.log('GAGAL', m); };
const tunggu = ms => new Promise(r => setTimeout(r, ms));
async function dialogYa(p) { await p.waitForSelector('dialog [data-ya]'); await p.click('dialog [data-ya]'); }
async function jawabPrompt(p, teks) { p.once('dialog', d => d.accept(teks)); }
(async () => {
  const b = await chromium.launch(); const ctx = {}; const hal = {};
  for (const [k, email] of [['a', 'k3rs@uji.id'], ['f', 'k3rs2@uji.id'], ['b', 'pj.ipsrs@uji.id'], ['c', 'petugas@uji.id'], ['d', 'pj.igd@uji.id']]) { ctx[k] = await L.konteks(b); hal[k] = await L.masuk(ctx[k], email); }
  const { a, f, b: pj, c: pt, d: igd } = hal;
  try {
    // ---------- Data awal lewat API aplikasi (frontend → DB) ----------
    const ipsrs = +sql("select id from unit where kode='IPSRS'");
    await pt.evaluate(u => window.K3Api.kirimLaporan({ jenis: 'kejadian', kategori: 'mekanik', unit_id: u, uraian: 'Teknisi tersengat listrik ringan saat mengganti lampu', lokasi: 'Lorong lantai 2', mendesak: true, anonim: false }), ipsrs);
    const lapId = sql("select id from laporan where uraian like 'Teknisi tersengat%'");
    ok(!!lapId, 'laporan kejadian dikirim petugas lewat aplikasi tersimpan di basis data');
    ok(+sql("select count(*) from notifikasi where kunci = 'laporan_baru:" + lapId + "' and wajib") === 2, 'laporan kejadian baru → notifikasi WAJIB ke kedua K3RS');
    await pj.evaluate(u => window.K3Api.simpanModul('jsa', { pekerjaan: 'Perbaikan panel listrik lantai 2', unit_id: u, lokasi: 'Panel L2', status: 'draf', langkah: [{ langkah: 'Isolasi panel', uraian_bahaya: 'Sengatan listrik', bahaya: ['listrik'], dampak: 4, kemungkinan: 3, kontrol: { eliminasi: 'Matikan MCB', rekayasa: 'Gembok LOTO', apd: 'Sarung tangan isolasi' } }] }), ipsrs);
    const jsaId = sql("select id from jsa where pekerjaan like 'Perbaikan panel%'");
    await a.evaluate(id => window.K3Api.simpanModul('jsa', { id, status: 'disetujui' }), jsaId);
    ok(sql("select status from jsa where id='" + jsaId + "'") === 'disetujui', 'JSA dibuat PJ dan disetujui K3RS lewat aplikasi');

    // ---------- Hak akses ----------
    await L.buka(pt, '/investigasi'); ok(/bukan untuk peran Anda/.test(await pt.textContent('main')), 'petugas tidak dapat membuka halaman investigasi');
    ok(await pt.evaluate(() => window.K3Api.halaman('investigasi', {}).then(r => r.total)) === 0, 'petugas memanggil API investigasi langsung → 0 baris (RLS)');

    // ---------- Investigasi & RCA (UI, sebagai PJ IPSRS) ----------
    await L.buka(pj, '/investigasi'); await pj.waitForSelector('text=Mulai investigasi');
    ok(/Perlu investigasi/.test(await pj.textContent('main')), 'daftar "perlu investigasi" menampilkan kejadian baru');
    await pj.click('text=Mulai investigasi'); await pj.waitForSelector('form button[type=submit]'); await pj.fill('form input[maxlength="200"]', 'Mengganti lampu plafon');
    await pj.click('form button[type=submit]'); await pj.waitForFunction(() => /investigasi\?id=/.test(location.hash));
    const invId = decodeURIComponent((await pj.evaluate(() => location.hash)).match(/id=([^&]+)/)[1]);
    ok(sql("select laporan_id from investigasi where id='" + invId + "'") === lapId, 'investigasi dibuat dari Incident ID yang benar');
    await pj.click('text=Mulai analisis'); await dialogYa(pj); await tunggu(800);
    await pj.click('[role=tab]:has-text("Kronologi")'); await pj.click('text=Tambah peristiwa'); await pj.fill('.baris-item input >> nth=0', '08.10'); await pj.fill('.baris-item input >> nth=1', 'Teknisi membuka penutup lampu tanpa mematikan MCB');
    await pj.click('[role=tab]:has-text("Penyebab")'); await pj.fill('textarea >> nth=2', 'Kontak dengan kabel bertegangan');
    await pj.click('[role=tab]:has-text("5 Why")'); await pj.click('text=Tambah rantai penyebab');
    await pj.fill('.rantai-why input >> nth=0', 'Teknisi tersengat listrik'); await pj.fill('.why-daftar input >> nth=0', 'MCB tidak dimatikan');
    await pj.click('text=Tambah "Mengapa?"'); await pj.fill('.why-daftar input >> nth=1', 'Tidak ada prosedur LOTO untuk lampu');
    await pj.fill('.rantai-why input[placeholder="Penyebab sistemik"]', 'Prosedur LOTO belum mencakup pekerjaan penerangan');
    await pj.click('[role=tab]:has-text("Fishbone")'); await pj.fill('input[maxlength="300"]', 'Teknisi tersengat listrik');
    await pj.click('details.fb-kat:has-text("Metode") summary'); await pj.click('details.fb-kat:has-text("Metode") >> text=Tambah penyebab');
    await pj.fill('details.fb-kat:has-text("Metode") .fb-item input >> nth=0', 'LOTO tidak diterapkan'); await pj.check('details.fb-kat:has-text("Metode") .fb-item input[type=checkbox]');
    await pj.click('details.fb-kat:has-text("Metode") >> text=Sub-penyebab'); await pj.fill('.fb-sub-daftar input >> nth=0', 'Gembok LOTO tidak tersedia');
    ok(/LOTO tidak diterapkan/.test(await pj.textContent('.fishbone-svg')), 'Fishbone: penyebab tampil di diagram secara langsung');
    await pj.click('button:has-text("Simpan")'); await tunggu(900);
    const inv = JSON.parse(sql("select json_build_object('k', kronologi, 'p', penyebab_langsung, 'w', lima_why, 'f', fishbone) from investigasi where id='" + invId + "'"));
    ok(inv.k.length === 1 && inv.p && inv.w[0].why.length === 2 && inv.w[0].akar.includes('LOTO') && inv.f.kategori.metode[0].akar === true && inv.f.kategori.metode[0].sub[0] === 'Gembok LOTO tidak tersedia', 'kronologi, penyebab, 5 Why (2 tingkat), dan Fishbone (akar + sub) tersimpan di basis data');
    await pj.click('text=Ajukan persetujuan'); await dialogYa(pj); await tunggu(800);
    ok(sql("select status from investigasi where id='" + invId + "'") === 'analisis', 'pengajuan tanpa CAPA ditolak server');
    await pj.click('[role=tab]:has-text("CAPA")'); await pj.selectOption('form select >> nth=0', { index: 1 }); await pj.fill('form textarea', 'Tambahkan pekerjaan penerangan ke prosedur LOTO dan sediakan gembok');
    await pj.click('form button[type=submit]'); await tunggu(900);
    const capaId = sql("select id from capa where investigasi_id='" + invId + "'");
    ok(!!capaId && sql("select akar_masalah from capa where id='" + capaId + "'").includes('LOTO'), 'CAPA dibuat dari akar masalah dan tertaut ke investigasi');
    await pj.click('text=Ajukan persetujuan'); await dialogYa(pj); await tunggu(900);
    ok(sql("select status from investigasi where id='" + invId + "'") === 'menunggu_persetujuan', 'investigasi lengkap berhasil diajukan');
    await L.buka(a, '/investigasi?id=' + invId); await jawabPrompt(a, 'Analisis lengkap dan akar masalah tepat'); await a.click('button:has-text("Setujui")'); await tunggu(900);
    ok(sql("select status || ':' || disetujui_oleh from investigasi where id='" + invId + "'") === 'disetujui:00000000-0000-0000-0000-00000000000a', 'K3RS (bukan ketua) menyetujui investigasi lewat aplikasi; penyetuju tercatat');
    // CAPA: PJ melapor selesai, K3RS lain memverifikasi
    await L.buka(pj, '/capa?id=' + capaId); await pj.fill('textarea', 'Prosedur LOTO direvisi dan 5 gembok dibagikan'); await pj.click('text=Tandai selesai'); await tunggu(900);
    ok(sql("select status from capa where id='" + capaId + "'") === 'selesai', 'PJ menandai CAPA selesai dengan bukti');
    await L.buka(f, '/capa?id=' + capaId); await f.fill('textarea', 'Inspeksi 2 minggu: LOTO diterapkan pada semua pekerjaan lampu'); await f.click('button:has-text("Efektif")'); await tunggu(900);
    ok(sql("select status from capa where id='" + capaId + "'") === 'terverifikasi', 'K3RS memverifikasi efektivitas CAPA');
    await L.buka(a, '/investigasi?id=' + invId); await a.click('text=Tutup investigasi'); await dialogYa(a); await tunggu(900);
    ok(sql("select status from investigasi where id='" + invId + "'") === 'ditutup', 'investigasi ditutup: alur Insiden → Investigasi → RCA → CAPA → Verifikasi → Penutupan lengkap');
    // ---------- IZIN KERJA (PTW) ----------
    await L.buka(pj, '/izin?baru=1'); await pj.waitForSelector('.grid-templat');
    await pj.click('.kartu.templat:has-text("listrik")');
    await pj.fill('form.form-izin input[maxlength="160"] >> nth=0', 'Penggantian MCB panel L2');
    await pj.selectOption('form.form-izin select >> nth=1', { label: 'Kepala Ruang IGD · Penanggung jawab unit' });
    const mulai = await pj.evaluate(() => { const d = new Date(Date.now() - 5 * 60e3); const p = n => String(n).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + 'T' + p(d.getHours()) + ':' + p(d.getMinutes()); });
    await pj.fill('form.form-izin input[type=datetime-local] >> nth=0', mulai);
    await pj.selectOption('form.form-izin select >> nth=2', { index: 1 }); await tunggu(200);
    ok(/Isolasi panel/.test(await pj.inputValue('form.form-izin textarea >> nth=1')), 'PTW: bahaya & pengendalian diambil dari JSA rujukan');
    await pj.click('text=Simpan sebagai draf'); await pj.waitForFunction(() => /izin\?id=/.test(location.hash));
    const izinId = decodeURIComponent((await pj.evaluate(() => location.hash)).match(/id=([^&]+)/)[1]);
    ok(sql("select status || ':' || jsa_id from izin_kerja where id='" + izinId + "'") === 'draf:' + jsaId, 'PTW draf tersimpan dengan rujukan JSA');
    ok(!(await pj.$('text=Mulai pekerjaan')), 'tombol "Mulai pekerjaan" tidak tersedia sebelum izin disahkan');
    const r0 = await pj.evaluate(id => window.K3Api.izinProses(id, 'mulai').then(() => 'lolos', e => e.message), izinId);
    ok(/setelah izin disahkan/.test(r0), 'server menolak memulai pekerjaan sebelum izin disahkan');
    await pj.click('text=Ajukan'); await dialogYa(pj); await tunggu(900);
    ok(sql("select status from izin_kerja where id='" + izinId + "'") === 'draf', 'pengajuan dengan daftar periksa kosong ditolak');
    const n = await pj.$$eval('.ceklis-baris', e => e.length); for (let i = 0; i < n; i++) await pj.check('input[name=ck' + i + '][value]:nth-of-type(1)').catch(() => {});
    for (let i = 0; i < n; i++) await pj.click('.ceklis-baris >> nth=' + i + ' >> text=✓ Ya');
    await pj.click('text=Ajukan'); await dialogYa(pj); await tunggu(1200);
    ok(sql("select status from izin_kerja where id='" + izinId + "'") === 'diajukan', 'PTW diajukan setelah semua butir wajib terpenuhi');
    await L.buka(igd, '/izin?id=' + izinId); await igd.click('text=Setujui (supervisor)'); await dialogYa(igd); await tunggu(900);
    await L.buka(a, '/izin?id=' + izinId); await a.click('text=Setujui tinjauan K3'); await dialogYa(a); await tunggu(900);
    await a.click('text=Sahkan izin'); await dialogYa(a); await tunggu(900);
    ok(sql("select status || ':' || petugas_k3_id || ':' || pengesah_id from izin_kerja where id='" + izinId + "'") === 'disahkan:00000000-0000-0000-0000-00000000000a:00000000-0000-0000-0000-00000000000a', 'PTW: supervisor → tinjauan K3 → pengesahan berjalan di aplikasi');
    await L.buka(pj, '/izin?id=' + izinId); await pj.click('button:has-text("Mulai pekerjaan")'); await dialogYa(pj); await tunggu(900);
    ok(sql("select status from izin_kerja where id='" + izinId + "'") === 'aktif', 'pekerjaan dimulai setelah izin disahkan');
    await L.buka(pt, '/izin?id=' + izinId); ok(/STOP WORK AUTHORITY/.test(await pt.textContent('main')), 'petugas melihat izin aktif di unitnya beserta tombol Stop Work');
    await jawabPrompt(pt, 'Ada genangan air di bawah panel'); await pt.click('button:has-text("HENTIKAN PEKERJAAN")'); await tunggu(1000);
    ok(sql("select status from izin_kerja where id='" + izinId + "'") === 'ditangguhkan', 'Stop Work: petugas menghentikan pekerjaan dari aplikasi');
    ok(+sql("select count(*) from notifikasi where kategori='izin' and penerima_id in ('00000000-0000-0000-0000-00000000000b','00000000-0000-0000-0000-00000000000d') and judul like '%DITANGGUHKAN%'") === 2, 'penangguhan → notifikasi wajib ke pemohon dan supervisor');
    await L.buka(a, '/izin?id=' + izinId); await jawabPrompt(a, 'Genangan dikeringkan dan sumber bocor ditutup'); await a.click('button:has-text("Lanjutkan pekerjaan")'); await tunggu(900);
    await a.evaluate(id => window.K3Api.simpanModul('jsa', { id, langkah: [{ langkah: 'Isolasi panel', uraian_bahaya: 'Sengatan listrik', bahaya: ['listrik'], dampak: 5, kemungkinan: 3, kontrol: { eliminasi: 'Matikan MCB', rekayasa: 'LOTO' } }] }), jsaId);
    ok(sql("select status || ':' || perlu_tinjau from izin_kerja where id='" + izinId + "'") === 'ditangguhkan:true', 'JSA diubah setelah izin aktif → izin ditangguhkan & wajib ditinjau ulang');
    await L.buka(a, '/izin?id=' + izinId); ok(/Perlu ditinjau ulang/.test(await a.textContent('main')), 'peringatan "perlu ditinjau ulang" tampil di aplikasi');
    // Dasbor PTW sesuai basis data
    await L.buka(a, '/izin'); await a.waitForSelector('.spi'); const kartu = await a.textContent('.spi');
    ok(kartu.includes(sql("select count(*) from izin_kerja")) && /Ditangguhkan/.test(kartu), 'dasbor PTW menampilkan angka dari basis data');

    // ---------- TOOLBOX MEETING (QR) & PELATIHAN ----------
    await L.buka(pj, '/kegiatan?baru=toolbox'); await pj.fill('form input[maxlength="160"]', 'LOTO pada pekerjaan penerangan');
    const sekarang = await pj.evaluate(() => { const d = new Date(); const p = n => String(n).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + 'T' + p(d.getHours()) + ':' + p(d.getMinutes()); });
    await pj.fill('form input[type=datetime-local]', sekarang); await pj.click('form button[type=submit]'); await pj.waitForFunction(() => /kegiatan\?id=/.test(location.hash));
    const kegId = decodeURIComponent((await pj.evaluate(() => location.hash)).match(/id=([^&]+)/)[1]);
    ok(/^TBM-/.test(sql("select nomor from kegiatan where id='" + kegId + "'")), 'toolbox meeting dijadwalkan (nomor TBM otomatis)');
    await pj.fill('input[aria-label="Cari rekan"]', 'Teknisi'); await pj.waitForSelector('.chip-baris button:has-text("Teknisi IPSRS")'); await pj.click('.chip-baris button:has-text("Teknisi IPSRS")'); await tunggu(800);
    ok(+sql("select count(*) from kegiatan_peserta where kegiatan_id='" + kegId + "'") === 1 && +sql("select count(*) from notifikasi where penerima_id='00000000-0000-0000-0000-00000000000c' and kategori='kegiatan'") === 1, 'peserta ditambahkan dan mendapat notifikasi undangan');
    await pj.click('text=Tampilkan QR presensi'); await pj.waitForSelector('.qr-hadir svg'); const kode = (await pj.textContent('.qr-hadir')).match(/Kode: (\w+)/)[1];
    ok(kode.length === 12, 'penyelenggara menampilkan QR presensi');
    await L.buka(pt, '/hadir?k=' + kode); ok(/Kehadiran tercatat/.test(await pt.textContent('main')), 'peserta presensi lewat tautan QR');
    ok(sql("select kehadiran || ':' || cara_hadir from kegiatan_peserta where kegiatan_id='" + kegId + "'") === 'hadir:qr', 'kehadiran QR tercatat di basis data');
    await L.buka(a, '/kegiatan?baru=pelatihan'); await a.fill('form input[maxlength="160"]', 'Penggunaan APAR'); await a.fill('form input[type=datetime-local]', sekarang); await a.fill('form input[placeholder^="kosong"]', '24');
    await a.click('form button[type=submit]'); await a.waitForFunction(() => /kegiatan\?id=/.test(location.hash));
    const trnId = decodeURIComponent((await a.evaluate(() => location.hash)).match(/id=([^&]+)/)[1]);
    await a.fill('input[aria-label="Cari rekan"]', 'Teknisi'); await a.waitForSelector('.chip-baris button:has-text("Teknisi IPSRS")'); await a.click('.chip-baris button:has-text("Teknisi IPSRS")'); await tunggu(800);
    await a.selectOption('select[aria-label="Kehadiran Teknisi IPSRS"]', 'hadir'); await a.fill('input[aria-label="Nilai pre-test Teknisi IPSRS"]', '45'); await a.fill('input[aria-label="Nilai post-test Teknisi IPSRS"]', '90');
    await a.selectOption('select[aria-label="Kompetensi Teknisi IPSRS"]', 'kompeten'); await a.click('button[aria-label="Simpan Teknisi IPSRS"]'); await tunggu(900);
    ok(sql("select kompetensi from kegiatan_peserta where kegiatan_id='" + trnId + "'") === 'belum_dinilai', 'kompeten tanpa metode asesmen ditolak (kehadiran ≠ kompetensi)');
    await a.fill('input[aria-label="Metode asesmen Teknisi IPSRS"]', 'Praktik memadamkan api'); await a.click('button[aria-label="Simpan Teknisi IPSRS"]'); await tunggu(900);
    ok(sql("select nilai_pre || '/' || nilai_post || ':' || kompetensi || ':' || (sertifikat_nomor is not null) from kegiatan_peserta where kegiatan_id='" + trnId + "'") === '45.00/90.00:kompeten:true', 'pre-test 45 dan post-test 90 tersimpan di kolom yang benar; sertifikat terbit');
    await L.buka(pt, '/kegiatan?saya=1'); ok(/Penggunaan APAR/.test(await pt.textContent('main')) && /TRN-/.test(await pt.textContent('main')), 'peserta melihat riwayat pelatihan & sertifikatnya');

    // ---------- NOTIFIKASI ----------
    await L.buka(pt, '/beranda'); await pt.waitForFunction(() => { const e = document.querySelector('.lonceng-n'); return e && !e.hidden; }, null, { timeout: 8000 });
    const belum = +sql("select count(*) from notifikasi where penerima_id='00000000-0000-0000-0000-00000000000c' and dibaca_pada is null");
    ok(belum >= 1, 'lonceng menampilkan notifikasi server yang belum dibaca (' + belum + ')');
    await L.buka(pt, '/notifikasi'); await pt.waitForSelector('.daftar-peringatan'); ok(/Toolbox meeting: LOTO/.test(await pt.textContent('main')), 'kotak masuk menampilkan undangan toolbox');
    await pt.click('text=Tandai semua dibaca'); await tunggu(900);
    ok(+sql("select count(*) from notifikasi where penerima_id='00000000-0000-0000-0000-00000000000c' and dibaca_pada is null") === 0 && +sql("select count(*) from notifikasi where dibaca_pada is null and penerima_id <> '00000000-0000-0000-0000-00000000000c'") > 0, '"tandai semua dibaca" hanya untuk milik sendiri');
    await L.buka(pt, '/notifikasi?tab=atur'); await pt.uncheck('label:has-text("Pelatihan & toolbox") input'); await pt.click('text=Simpan pengaturan'); await tunggu(800);
    ok(sql("select kategori_mati::text from preferensi_notifikasi where profil_id='00000000-0000-0000-0000-00000000000c'") === '{kegiatan}', 'preferensi kategori notifikasi tersimpan');
    ok(+sql("select count(*) from (select penerima_id, kunci, count(*) from notifikasi group by 1,2 having count(*) > 1) x") === 0, 'tidak ada notifikasi ganda di seluruh alur');

    // ---------- PAGINASI SISI SERVER (1.250 laporan) ----------
    sql("insert into laporan(nomor, jenis, kategori_kode, unit_id, lokasi, uraian, status, tanggal_lapor, dibuat_pada, contoh) select 'PG-' || lpad(g::text, 5, '0'), case when g % 5 = 0 then 'kejadian' else 'bahaya' end, 'fisik', " + ipsrs + ", 'Gudang ' || (g % 7), case when g % 10 = 0 then 'Rak miring berbahaya' else 'Lantai licin ' || g end, case when g % 3 = 0 then 'tertutup' else 'baru' end::status_t, current_date - (g % 200), now() - make_interval(mins => g), true from generate_series(1, 1250) g");
    await L.buka(a, '/semua'); await a.waitForSelector('.pager');
    const total = +sql("select count(*) from laporan");
    ok((await a.textContent('.pager')).includes('1–25 dari ' + total.toLocaleString('id-ID')), 'paginasi: 25 baris per halaman dengan total dari basis data (' + total + ')');
    await a.selectOption('select[aria-label="Status"]', 'baru'); await tunggu(900);
    const baru = +sql("select count(*) from laporan where status = 'baru'");
    await a.click('button[aria-label="Halaman berikutnya"] >> nth=0'); await tunggu(900);
    const teksPager = await a.textContent('.pager');
    ok(teksPager.includes('26–50 dari ' + baru.toLocaleString('id-ID')) && !(await a.textContent('.daftar-server')).includes('Tertutup'), 'filter status tetap berlaku saat pindah ke halaman 2');
    await a.fill('input[aria-label^="Cari nomor"]', 'rak miring'); await tunggu(1200);
    const rak = +sql("select count(*) from laporan where status='baru' and cari ilike '%rak miring%'");
    ok((await a.textContent('.pager')).includes('dari ' + rak) && (await a.textContent('.pager')).includes('1–'), 'pencarian di server + kembali ke halaman 1 (' + rak + ' hasil)');
    await a.selectOption('select[aria-label="Jumlah per halaman"] >> nth=0', '100'); await tunggu(900);
    ok((await a.$$eval('.daftar-server .tabel-laporan tbody tr', r => r.length)) === Math.min(100, rak), 'ukuran halaman 100 diterapkan');
    const unduhan = a.waitForEvent('download'); await a.click('text=Ekspor CSV'); const d = await unduhan; const isi = require('fs').readFileSync(await d.path(), 'utf8');
    ok(isi.trim().split('\n').length - 1 === rak, 'ekspor CSV berisi seluruh data hasil filter (' + rak + ' baris), bukan hanya halaman aktif');
    const cepat = Date.now(); await a.evaluate(() => window.K3Api.halaman('laporan', { halaman: 40, ukuran: 25 })); ok(Date.now() - cepat < 1500, 'halaman ke-40 dimuat cepat (' + (Date.now() - cepat) + ' ms)');
    sql("insert into laporan(nomor, jenis, kategori_kode, unit_id, lokasi, uraian, status, tanggal_lapor, contoh) select 'PL-' || lpad(g::text, 5, '0'), 'bahaya', 'fisik', (select min(id) from unit where id <> " + ipsrs + "), 'Unit lain', 'Data unit lain ' || g, 'baru', current_date, true from generate_series(1, 30) g");
    await L.buka(pj, '/semua'); await pj.waitForSelector('.pager'); const pjTotal = +sql("select count(*) from laporan where unit_id = " + ipsrs + " or pj_id = '00000000-0000-0000-0000-00000000000b' or pelapor_id = '00000000-0000-0000-0000-00000000000b'");
    ok((await pj.textContent('.pager')).includes('dari ' + pjTotal.toLocaleString('id-ID')), 'PJ unit: total paginasi sesuai hak aksesnya (' + pjTotal + ' dari ' + sql("select count(*) from laporan") + ' laporan)');

    console.log(hasil.join('\n')); hasil.length = 0;
    require('fs').writeFileSync(__dirname + '/.e2e_state.json', JSON.stringify({ jsaId, invId, capaId, ipsrs }));
  } catch (e) { console.log(hasil.join('\n')); console.log('BERHENTI:', e.message.split('\n')[0]); for (const k of Object.keys(hal)) await hal[k].screenshot({ path: '/tmp/claude-0/-home-user-HSE-Project/19ed16c3-474c-5395-bf66-36a8b0b11e0f/scratchpad/gagal-' + k + '.png' }).catch(() => {}); process.exitCode = 1; }
  for (const k of Object.keys(hal)) if (hal[k].galat.length) console.log('galat JS', k, hal[k].galat.slice(0, 3));
  await b.close();
})();
