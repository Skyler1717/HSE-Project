// Produksi Video 1 — rekaman adegan (aplikasi asli + grafik gerak) sesuai garis waktu narasi.
// node produksi_v1.js <dir_kerja>   (butuh: hse_demo, rest-uji :3101, http.server :8765, audio/v1/garis_waktu.json)
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const R = require('./lib-rekam.js'), L = require('../browser/lib-supabase.js');
const DIR = process.argv[2], OUT = path.join(DIR, 'klip', 'v1'); fs.mkdirSync(OUT, { recursive: true });
const G = JSON.parse(fs.readFileSync(path.join(DIR, 'audio', 'v1', 'garis_waktu.json')));
const sql = q => execFileSync('psql', ['-d', 'hse_demo', '-tAq', '-c', q]).toString().trim();
const TRANS = 0.4; // tumpang tindih transisi antaradegan
const MG = 'file://' + path.join(__dirname, 'mg', 'mg.html') + '?img=' + path.join(DIR, 'mg');
const ID = { inv: sql("select id from investigasi limit 1"), tbm: sql("select id from kegiatan where tipe='toolbox' limit 1"), ins: sql("select id from inspeksi order by dibuat_pada limit 1"), izin: sql("select id from izin_kerja where status='aktif' limit 1"),
  dok: sql("select id from dokumen where nomor='SOP/IPSRS/014'"), lapBaru: sql("select id from laporan where uraian like '[DEMO] Kabel terkelupas%' and status='ditugaskan' order by dibuat_pada desc limit 1") || sql("select id from laporan where status='baru' limit 1") };
const hanya = process.argv[3] ? process.argv[3].split(',') : null;

(async () => {
  const b = await chromium.launch();
  const H = {};
  const akun = async k => H[k] || (H[k] = await R.masuk(b, { P1: 'p1.koordinator', P2: 'p2.hira', P3: 'p3.insiden', pt: 'petugas.kesling', pj: 'pj.ipsrs' }[k] + '@demo.hse'));
  const T = id => G.find(g => g.id === id).kalimat.map(k => k.mulai);
  const D = id => G.find(g => g.id === id).durasi + (id === G[G.length - 1].id ? 0 : TRANS);
  async function adegan(id, potongan) { // potongan: [{akun|mg, durasi, aksi}]
    if (hanya && !hanya.includes(id)) return;
    const total = D(id); let sisa = total; const bag = [];
    for (let i = 0; i < potongan.length; i++) {
      const pt = potongan[i], dur = i === potongan.length - 1 ? sisa : pt.durasi; sisa -= dur;
      const f = path.join(OUT, id + '_' + i + '.mp4');
      try {
        if (pt.mg) { const p = await R.halamanLokal(b, MG.replace('file://', '')); await R.rekam(p, f, dur, async () => { await p.evaluate(c => mulai(c), { a: pt.mg, t: T(id) }); }); await p.context().close(); }
        else if (pt.ponsel) { await rekamPonsel(f, dur, pt); }
        else { const p = await akun(pt.akun); await p.keyboard.press('Escape').catch(() => {}); await p.evaluate(() => document.querySelectorAll('dialog[open]').forEach(d => d.close())).catch(() => {}); if (pt.rute) { await R.buka(p, pt.rute); await R.tunggu(pt.siap || 900); } if (pt.siapkan) await pt.siapkan(p); await R.zoomLepas(p, 1).catch(() => {}); await R.rekam(p, f, dur, async () => { try { await pt.aksi(p); } catch (e) { console.log('  ! aksi', id, i, e.message.split('\n')[0]); } }); await R.judulLepas(p).catch(() => {}); await R.sorotLepas(p).catch(() => {}); }
        bag.push(f);
      } catch (e) { console.log('  ! potongan', id, i, e.message.split('\n')[0]); }
    }
    const daftar = path.join(OUT, id + '.txt'); fs.writeFileSync(daftar, bag.map(f => "file '" + f + "'").join('\n'));
    execFileSync('ffmpeg', ['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', daftar, '-c', 'copy', path.join(OUT, id + '.mp4')]);
    console.log('adegan', id, total.toFixed(1), 'dtk');
  }
  async function rekamPonsel(f, dur, pt) {
    const ctx = await R.konteks(b, { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const p = await L.masuk(ctx, 'petugas.kesling@demo.hse'); await p.evaluate(R.SUNTIK); await R.tunggu(1200);
    if (pt.rute) { await R.buka(p, pt.rute); await R.tunggu(800); }
    const mentah = f.replace('.mp4', '_hp.mp4');
    await R.rekam(p, mentah, dur, () => pt.aksi(p), { maxW: 780, maxH: 1688, vf: 'scale=-2:980:flags=lanczos' });
    const bg = f.replace('.mp4', '_bg.png'); const pb = await R.halamanLokal(b, MG.replace('file://', '')); await pb.evaluate(() => mulai({ a: 'ponsel', t: [0] })); await R.tunggu(400); await pb.screenshot({ path: bg }); await pb.context().close();
    execFileSync('ffmpeg', ['-y', '-v', 'error', '-loop', '1', '-i', bg, '-i', mentah, '-filter_complex', '[0]scale=1920:1080[b];[b][1]overlay=1100:50:shortest=1,format=yuv420p', '-t', String(dur), '-r', '30', '-c:v', 'libx264', '-crf', '16', f]);
    await ctx.close();
  }

  // ---------------- Adegan ----------------
  await adegan('v1s1', [{ mg: 'buka' }]);
  await adegan('v1s2', [{ mg: 'masalah' }]);
  await adegan('v1s3', [
    { akun: 'P1', rute: '/beranda', durasi: T('v1s3')[1] + 1.2, aksi: async p => { await R.judulBawah(p, 'Satu platform K3', 'Beranda & navigasi modul'); await R.gerak(p, [720, 320], 900);
      for (const t of ['Laporan & risk register', 'JSA', 'Izin kerja (PTW)', 'Inspeksi', 'Investigasi & RCA', 'Pelatihan & toolbox']) { await R.gerak(p, 'nav a:has-text("' + t + '"), aside a:has-text("' + t + '")', 520); await R.tunggu(200); } } },
    { ponsel: true, rute: '/beranda', aksi: async p => { await R.tunggu(1200); await p.mouse.move(195, 300); await R.gulir(p, 420, 1800); await R.tunggu(800); await R.gulir(p, -420, 1200); } }]);
  await adegan('v1s4a', [
    { akun: 'pt', rute: '/lapor', durasi: T('v1s4a')[1] + 1.6,
      siapkan: async p => { await p.selectOption('select[aria-label="Unit"]', { label: 'Kesehatan Lingkungan' }); await p.click('[data-kat="biologi"]'); const d = await p.$('summary:has-text("Tambahkan keterangan")'); if (d) await d.click(); await p.evaluate(() => { const t = document.querySelector('main textarea'); scrollTo(0, t.getBoundingClientRect().top + scrollY - 260); }); await R.tunggu(500); },
      aksi: async p => { await R.judulBawah(p, 'Lapor bahaya', 'Cepat, dari ponsel atau komputer'); await R.sorot(p, '.tile.dipilih'); await R.tunggu(900); await R.sorotLepas(p);
      await R.ketik(p, 'main textarea', 'Safety box penuh, pasien No. RM 556677 di dekatnya', 14); await R.tunggu(500);
      await R.sorot(p, '.privasi .kartu'); await R.judulBawah(p, 'Perlindungan privasi', 'Identitas pasien terdeteksi otomatis'); await R.tunggu(1600); await R.sorotLepas(p); await R.klik(p, 'button:has-text("Samarkan otomatis")', 500); await R.sorot(p, 'main textarea'); await R.tunggu(900); } },
    { akun: 'P1', rute: '/semua', aksi: async p => { await R.judulBawah(p, 'Risk register', 'Pencarian & paginasi di server'); await R.ketik(p, 'input[aria-label^="Cari nomor"]', 'listrik', 60); await R.tunggu(1300); await R.sorot(p, '.daftar-server tbody tr'); await R.tunggu(1400); await R.sorotLepas(p);
      await R.buka(p, '/laporan/' + ID.lapBaru); await R.tunggu(700); await R.judulBawah(p, 'Penilaian risiko', 'Dampak × kemungkinan, penanggung jawab, tenggat');
      const sel = await p.$$('form.aksi select'); await R.gerak(p, 'form.aksi', 700); if (sel[1]) { await sel[1].selectOption('4'); await R.tunggu(400); await sel[2].selectOption('3'); }
      await R.sorot(p, 'form.aksi .skor'); await R.tunggu(1500); } }]);
  await adegan('v1s4b', [
    { akun: 'P2', rute: '/jsa?baru=1&pekerjaan=' + encodeURIComponent('Penggantian lampu koridor memakai tangga'), durasi: T('v1s4b')[1] + .2, aksi: async p => { await R.judulBawah(p, 'Job Safety Analysis', 'Langkah & bahaya disusun otomatis');
      await R.klik(p, 'text=Buat langkah awal otomatis', 800); await R.tunggu(900); await p.selectOption('form.form-jsa select >> nth=0', { label: 'IPSRS' }).catch(() => {}); await R.gulir(p, 520, 1800); await R.tunggu(600); await R.klik(p, 'text=Simpan JSA', 800); await R.tunggu(700);
      await R.judulBawah(p, 'Validasi keselamatan', 'Peringatan bila hanya mengandalkan APD/administratif'); } },
    { akun: 'P2', rute: '/inspeksi?id=' + ID.ins, durasi: (D('v1s4b') - T('v1s4b')[1]) / 2, aksi: async p => { await R.judulBawah(p, 'Inspeksi terpandu', 'Skor kepatuhan & temuan'); await R.gerak(p, [700, 300], 800); await R.tunggu(800); await R.gulir(p, 360, 1600); } },
    { akun: 'pj', rute: '/izin?id=' + ID.izin, aksi: async p => { await R.judulBawah(p, 'Izin kerja (PTW)', 'Aktif hanya setelah disahkan'); await R.sorot(p, '.stepper, .langkah-alur, ol'); await R.tunggu(1600); await R.sorotLepas(p);
      const t = await p.$('button:has-text("HENTIKAN PEKERJAAN")'); if (t) { await R.gerak(p, 'button:has-text("HENTIKAN PEKERJAAN")', 900); await R.sorot(p, '.swa-tombol'); await R.judulBawah(p, 'Stop Work Authority', 'Setiap petugas di unit dapat menghentikan pekerjaan'); } } }]);
  await adegan('v1s4c', [
    { akun: 'P3', rute: '/notifikasi', durasi: T('v1s4c')[1] + .2, aksi: async p => { await R.judulBawah(p, 'Notifikasi wajib', 'Kejadian baru langsung ke tim K3'); await R.sorot(p, '.daftar-peringatan > *:first-child'); await R.tunggu(1800); } },
    { akun: 'P3', rute: '/investigasi?id=' + ID.inv, aksi: async p => { await R.judulBawah(p, 'Investigasi & RCA', 'Kronologi · 5 Why · Fishbone');
      await R.klik(p, '[role=tab]:has-text("Fishbone")', 800); await R.tunggu(700); await R.zoom(p, '.fishbone-svg', 1.3); await R.tunggu(2200); await R.zoomLepas(p);
      await R.klik(p, '[role=tab]:has-text("5 Why")', 700); await R.tunggu(1500); await R.klik(p, '[role=tab]:has-text("CAPA")', 700); await R.judulBawah(p, 'CAPA', 'Penanggung jawab, tenggat, verifikasi efektivitas'); await R.tunggu(1500); } }]);
  await adegan('v1s4d', [
    { akun: 'P1', rute: '/kegiatan?id=' + ID.tbm, durasi: T('v1s4d')[1] + .2, aksi: async p => { await R.judulBawah(p, 'Toolbox meeting & pelatihan', 'Presensi QR · pre/post-test · kompetensi'); await R.klik(p, 'text=Tampilkan QR presensi', 900); await R.tunggu(600); await R.sorot(p, '.qr-hadir'); await R.tunggu(2000); } },
    { akun: 'P1', rute: '/sop?id=' + ID.dok, durasi: (D('v1s4d') - T('v1s4d')[1]) / 2, aksi: async p => { await R.judulBawah(p, 'SOP & dokumen', 'Pemilik, versi, tanggal tinjau'); await R.gerak(p, [700, 380], 900); await R.gulir(p, 280, 1300); } },
    { akun: 'P1', rute: '/pengguna', aksi: async p => { await R.judulBawah(p, 'Pengguna & peran', 'Petugas · PJ unit · K3RS'); await R.gerak(p, 'select', 900).catch(() => {}); await R.gulir(p, 300, 1500); } }]);
  await adegan('v1s4e', [
    { akun: 'P1', rute: '/intel?tab=risiko', durasi: T('v1s4e')[1] + 1.2, aksi: async p => { await R.judulBawah(p, 'HSE Intelligence', 'Pola risiko dari data laporan'); await R.gerak(p, [760, 420], 900); await R.gulir(p, 380, 1600); await R.tunggu(500); await R.buka(p, '/intel?tab=tren'); await R.tunggu(1500); } },
    { akun: 'P1', rute: '/cari', aksi: async p => { await R.judulBawah(p, 'Pencarian cerdas', 'Berbasis aturan yang transparan'); await R.gerak(p, '.baris-tanya input', 600); await R.klik(p, 'button:has-text("Laporan mendesak yang masih terbuka")', 700); await R.tunggu(1600); await R.sorot(p, 'main .kartu:nth-of-type(2), main section:nth-of-type(2)'); await R.gulir(p, 260, 1300); } }]);
  await adegan('v1s5', [{ mg: 'beda' }]);
  await adegan('v1s6', [
    { akun: 'P1', rute: '/dasbor', durasi: T('v1s6')[1] + .2, aksi: async p => { await R.judulBawah(p, 'Dasbor', 'Status tindak lanjut & titik putus alur'); await R.gerak(p, [800, 420], 900); await R.sorot(p, 'main .kartu-angka, main section'); await R.tunggu(1600); await R.sorotLepas(p); await R.gulir(p, 450, 2200); } },
    { akun: 'P1', rute: '/bulanan', aksi: async p => { await p.selectOption('main select >> nth=0', { index: 0 }); await R.judulBawah(p, 'Laporan bulanan', 'Dihitung dari basis data, siap dicetak'); await R.tunggu(1200); await R.gulir(p, 380, 2000); } }]);
  await adegan('v1s7', [{ mg: 'tutup' }]);
  await b.close();
})();
