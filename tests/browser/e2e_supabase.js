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
    console.log(hasil.join('\n')); hasil.length = 0;
    require('fs').writeFileSync(__dirname + '/.e2e_state.json', JSON.stringify({ jsaId, invId, capaId, ipsrs }));
  } catch (e) { console.log(hasil.join('\n')); console.log('BERHENTI:', e.message.split('\n')[0]); for (const k of Object.keys(hal)) await hal[k].screenshot({ path: '/tmp/claude-0/-home-user-HSE-Project/19ed16c3-474c-5395-bf66-36a8b0b11e0f/scratchpad/gagal-' + k + '.png' }).catch(() => {}); process.exitCode = 1; }
  for (const k of Object.keys(hal)) if (hal[k].galat.length) console.log('galat JS', k, hal[k].galat.slice(0, 3));
  await b.close();
})();
