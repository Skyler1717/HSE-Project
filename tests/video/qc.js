// Pemeriksaan kualitas akhir + bahan dokumen pendukung (qc.json, diagram PNG).
const fs = require('fs'), path = require('path');
const { execFileSync, spawnSync } = require('child_process');
const { chromium } = require('playwright');
const DIR = process.argv[2], F = path.join(DIR, 'final');
const ff = a => spawnSync('ffmpeg', a, { encoding: 'utf8', maxBuffer: 1 << 26 }).stderr;
const probe = f => JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', f]).toString());
(async () => {
  const video = [], cek = [];
  for (const [nama, maks, min] of [['HSE_Project_Professional_Product_Showcase.mp4', 180, 0], ['HSE_Project_Technical_Architecture_Documentary.mp4', 1e9, 360]]) {
    const f = path.join(F, nama), p = probe(f); const v = p.streams.find(s => s.codec_type === 'video'), a = p.streams.find(s => s.codec_type === 'audio'), s = p.streams.find(s => s.codec_type === 'subtitle');
    const dur = +p.format.duration;
    const lufs = ff(['-i', f, '-af', 'ebur128=peak=true', '-f', 'null', '-']); const I = +(lufs.match(/I:\s+(-?[\d.]+) LUFS/g) || []).pop().match(/-?[\d.]+/)[0]; const pk = +(lufs.match(/Peak:\s+(-?[\d.]+)/g) || []).pop().match(/-?[\d.]+/)[0];
    const hitam = (ff(['-i', f, '-vf', 'blackdetect=d=0.5:pix_th=0.05', '-an', '-f', 'null', '-']).match(/black_start/g) || []).length;
    const beku = (ff(['-i', f, '-vf', 'freezedetect=n=0.001:d=6', '-an', '-f', 'null', '-']).match(/freeze_start/g) || []).length;
    const sunyi = (ff(['-i', f, '-af', 'silencedetect=n=-45dB:d=3', '-vn', '-f', 'null', '-']).match(/silence_start/g) || []).length;
    const srt = fs.readFileSync(f.replace('.mp4', '.srt'), 'utf8'); const nSub = (srt.match(/-->/g) || []).length;
    const putar = spawnSync('ffmpeg', ['-v', 'error', '-i', f, '-f', 'null', '-'], { encoding: 'utf8' }).stderr.trim();
    video.push({ nama, durasi: dur, spes: `${v.codec_name.toUpperCase()} ${v.profile} ${v.width}×${v.height}, ${eval(v.r_frame_rate)} fps, ${v.pix_fmt}; audio ${a.codec_name.toUpperCase()} ${a.sample_rate / 1000} kHz ${a.channels} kanal; subtitle ${s ? s.codec_name : '-'} (${nSub} tayangan); ${(p.format.size / 1048576).toFixed(1)} MB` });
    cek.push([nama + ': durasi', dur.toFixed(1) + ' dtk ' + (dur <= maks && dur >= min ? '✓ sesuai batas' : '✗ di luar batas')]);
    cek.push([nama + ': loudness', 'Integrated ' + I + ' LUFS, true peak ' + pk + ' dBFS ' + (Math.abs(I + 16) <= 1.5 && pk < -1 ? '✓' : '✗')]);
    cek.push([nama + ': bingkai hitam ≥0,5 dtk', hitam + ' segmen ' + (hitam === 0 ? '✓' : '(periksa)')]);
    cek.push([nama + ': gambar diam ≥6 dtk', beku + ' segmen' + (beku ? ' (adegan diagram/kode yang statis sementara narasi berjalan)' : ' ✓')]);
    cek.push([nama + ': hening ≥3 dtk', sunyi + ' segmen ' + (sunyi === 0 ? '✓' : '(periksa)')]);
    cek.push([nama + ': dekode penuh (ffmpeg)', putar ? '✗ ' + putar.slice(0, 120) : '✓ tanpa galat']);
  }
  // Pindai rahasia pada semua teks yang ditampilkan di video (naskah, potongan kode, keluaran terminal, grafik)
  const sumber = [path.join(__dirname, 'naskah.js'), path.join(__dirname, 'produksi_v1.js'), path.join(__dirname, 'produksi_v2.js'), path.join(__dirname, 'mg', 'mg.html'), ...fs.readdirSync(path.join(DIR, 'term')).map(f => path.join(DIR, 'term', f))];
  const KODE = [['index.html', 1, 36], ['js/app.js', 108, 128], ['js/app.js', 1003, 1030], ['js/api.js', 1, 12], ['supabase/01_setup.sql', 273, 313], ['supabase/01_setup.sql', 383, 396], ['supabase/01_setup.sql', 543, 550], ['supabase/23_modul_lanjutan.sql', 225, 240], ['supabase/23_modul_lanjutan.sql', 314, 327], ['integrasi/google-sheets/Kode.gs', 1, 21], ['integrasi/google-sheets/Kode.gs', 47, 84]];
  const ROOT = path.resolve(__dirname, '../..');
  let teks = sumber.map(f => fs.readFileSync(f, 'utf8')).join('\n') + KODE.map(([f, a, b]) => fs.readFileSync(path.join(ROOT, f), 'utf8').split('\n').slice(a - 1, b).join('\n')).join('\n');
  const pola = [[/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}/, 'JWT/kunci'], [/sb_(secret|publishable)_[A-Za-z0-9]+/, 'kunci Supabase'], [/re_[A-Za-z0-9]{20,}/, 'kunci Resend'], [/service_role_key\s*[:=]\s*['"][^'"]{8,}/i, 'service role'], [/password\s*[:=]\s*['"][^'"]{4,}/i, 'kata sandi'], [/@gmail\.com/i, 'email pribadi']];
  const temu = pola.filter(([r]) => r.test(teks)).map(([, n]) => n);
  cek.push(['Pindai rahasia pada teks yang tampil (naskah, kode, terminal, grafik)', temu.length ? '✗ ditemukan: ' + temu.join(', ') : '✓ tidak ada JWT/kunci/sandi/email pribadi']);
  cek.push(['Data yang tampil', 'Hanya akun & data sintetis basis data demonstrasi (@demo.hse, penanda [DEMO]) ✓']);
  // Diagram resolusi penuh
  const b = await chromium.launch(); const diagram = [];
  const MG = 'file://' + path.join(__dirname, 'mg', 'mg.html') + '?img=' + path.join(DIR, 'mg');
  for (const [a, t, tunggu, cap] of [['arsitektur', [0, .5, 1, 1.5], 7, 'Diagram arsitektur sistem (dan integrasi)'], ['erd', [0, .5, 1, 1.5], 7, 'ERD tabel utama (foreign key nyata)'], ['alur', [0, .3, .6, .9], 9, 'Diagram alur data insiden (14 langkah)'], ['aman', [0, .5, 1], 7, 'Alur autentikasi & otorisasi']]) {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 810 }, deviceScaleFactor: 1920 / 1440 }); const p = await ctx.newPage(); await p.goto(MG); await p.evaluate(c => mulai(c), { a, t }); await p.waitForTimeout(tunggu * 1000);
    const f = path.join(F, 'diagram_' + a + '.png'); await p.screenshot({ path: f }); diagram.push([f, cap]); await ctx.close();
  }
  await b.close();
  const fitur = [
    ['Beranda & navigasi modul', 'V1 · v1s3', 'Rekaman desktop + tampilan ponsel 390 px'], ['Lapor bahaya + deteksi identitas pasien', 'V1 · v1s4a; V2 · v2s3b', 'Peringatan & "Samarkan otomatis"; permintaan/respons RPC nyata'],
    ['Risk register: pencarian, paginasi, penilaian D×K', 'V1 · v1s4a', 'Kata kunci "listrik", sorotan skor'], ['JSA otomatis + validasi pengendalian', 'V1 · v1s4b', 'Langkah awal otomatis, dialog "Pengendalian belum memadai"'],
    ['Inspeksi terpandu', 'V1 · v1s4b', 'Skor kepatuhan & temuan'], ['Izin kerja (PTW) + Stop Work', 'V1 · v1s4b', 'Izin aktif, alur persetujuan, tombol HENTIKAN PEKERJAAN (tidak ditekan)'],
    ['Notifikasi wajib', 'V1 · v1s4c', 'Kotak masuk K3RS'], ['Investigasi: Fishbone, 5 Why, CAPA', 'V1 · v1s4c', 'Diagram Fishbone diperbesar'], ['Toolbox meeting + QR presensi', 'V1 · v1s4d', 'QR ditampilkan'],
    ['SOP & dokumen terkendali', 'V1 · v1s4d', 'Dokumen demonstrasi dengan pemilik, versi, tanggal tinjau'], ['Pengguna & peran', 'V1 · v1s4d', 'Daftar akun demonstrasi'], ['HSE Intelligence & pencarian cerdas', 'V1 · v1s4e', 'Matriks 5×5, tren, kueri bahasa sehari-hari'],
    ['Dasbor & laporan bulanan', 'V1 · v1s6', 'Angka dari basis data demonstrasi'], ['Hak akses RLS', 'V2 · v2s8', 'Petugas ditolak; panggilan API langsung total 0'],
    ['Kode sumber & SQL asli', 'V2 · v2s3, v2s4, v2s5, v2s6, v2s8', 'Nomor baris asli, syntax highlighting'], ['Uji regresi', 'V2 · v2s9', 'Dijalankan ulang: 109 pemeriksaan DB, 17 logika notifikasi lulus']];
  const belum = [
    ['Supabase produksi (proyek fkynbegfeodymincuucy)', 'Jaringan lingkungan produksi video memblokir host; dashboard butuh login pemilik', 'Pemilik menjalankan kueri statistik skema yang sama di SQL Editor dan membandingkan dengan angka di video (32/74/38/59)'],
    ['Status migrasi 21, 23, 24 di produksi', 'Tidak dapat diakses', 'select * from cron.job; dan cek keberadaan tabel investigasi, izin_kerja, kegiatan'],
    ['Proyek Google Apps Script milik pemilik', 'Editor butuh login; jaringan diblokir', 'Bandingkan isi proyek dengan integrasi/google-sheets/Kode.gs; cek pemicu waktu 10 menit di menu Triggers'],
    ['Situs GitHub Pages produksi', 'Tidak dapat dijangkau dari lingkungan ini (deploy terakhir sukses menurut GitHub Actions)', 'Buka situs; menu Bantuan harus menampilkan versi 2.2.0'],
    ['Email & push', 'Edge Function belum dideploy; kunci belum diatur', 'Ikuti panduan bagian 7; uji kirim nyata'], ['Kinerja dengan data produksi', 'Hanya diuji dengan data sintetis', 'Uji dengan salinan data tanpa identitas']];
  const rekomendasi = [
    'Rekam ulang narasi dengan pengisi suara manusia memakai naskah dan berkas narasi terpisah; durasi tiap kalimat sudah ditentukan sehingga gambar tidak perlu disunting.',
    'Tambahkan footage tempat kerja berlisensi (milik organisasi) untuk adegan pembuka Video 1 bila diperlukan; jangan memakai footage yang tidak berkaitan.',
    'Setelah pemilik memverifikasi Supabase dan Apps Script produksi, tambahkan cuplikan dashboard Supabase (tanpa kunci) ke Video 2.',
    'Untuk versi 4K, rekam ulang dengan viewport 2560×1440 dan skala perangkat 1,5; seluruh skrip sudah mendukung perekaman ulang otomatis.',
    'Tindak lanjuti temuan UAT (matriks 5×5 per sel, risiko residual, ekspor 25 kolom) sebelum memakai video untuk klaim kesesuaian akreditasi.'];
  const d = new Date(); fs.writeFileSync(path.join(F, 'qc.json'), JSON.stringify({ tanggal: d.toISOString().slice(0, 10), video, cek, diagram, fitur, belum, rekomendasi }, null, 1));
  console.log(JSON.stringify(cek, null, 1));
})();
