// Penyusun laporan UAT (.docx) dari hasil eksekusi nyata tests/uat/hasil_uat.json
const fs = require('fs'), path = require('path');
const D = require('docx');
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, ShadingType, AlignmentType, HeadingLevel, PageOrientation, ImageRun, PageBreak, BorderStyle, LevelFormat, Footer, PageNumber, TableOfContents, VerticalAlign } = D;
const ROOT = require('path').resolve(__dirname, '../..');
const J = JSON.parse(fs.readFileSync(ROOT + '/tests/uat/hasil_uat.json', 'utf8'));
const R = Object.fromEntries(J.hasil.map(r => [r.id, r]));
const FONT = 'Times New Roman';

// ---------- Istilah bahasa Inggris (dicetak miring) ----------
const INGGRIS = ['User Acceptance Testing', 'scenario-based testing', 'Row Level Security', 'Edge Function', 'push notification', 'Stop Work Authority', 'Permit to Work', 'Job Safety Analysis', 'Root Cause Analysis',
  'Corrective and Preventive Action', 'toolbox meeting', 'Loss Prevention', 'Loss Reduction', 'Risk Transfer', 'Risk Prevention', 'octopus wiring', 'life-support', 'life support', 'safety box', 'spill kit', 'eyewash', 'safety shower',
  'expected result', 'actual result', 'test case', 'risk register', 'dashboard', 'screenshot', 'browser', 'headless', 'frontend', 'backend', 'server', 'login', 'logout', 'viewport', 'pre-test', 'post-test', 'checklist', 'hazard', 'near miss',
  'Fishbone', 'Five Why', 'Extreme', 'High', 'Moderate', 'Low', 'PASS', 'FAIL', 'BLOCKED', 'NOT TESTED', 'software', 'open source', 'timestamp', 'online', 'offline', 'upload', 'download', 'spreadsheet', 'smartphone', 'desktop', 'mock',
  'Automatic Rescue Device', 'Hazard Identification and Risk Assessment', 'Medical Devices', 'feedback', 'usability', 'traceability', 'end-to-end', 'emulator', 'Progressive Web App', 'commit', 'repository', 'script', 'deployment', 'workflow', 'email', 'badge', 'stepper', 'hashing'];
const pola = new RegExp('(?<![\\p{L}\\d-])(' + INGGRIS.sort((a, b) => b.length - a.length).map(x => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')(?![\\p{L}\\d])', 'gu');
function runs(teks, o = {}) {
  teks = String(teks ?? '');
  if (teks.includes('~~')) return teks.split(/(~~[^~]+~~)/).filter(Boolean).flatMap(x => x.startsWith('~~') ? [new TextRun({ text: x.slice(2, -2), font: FONT, size: o.size || 24, bold: o.bold, italics: !o.italics })] : runs(x, o));
  const out = []; let i = 0;
  for (const m of teks.matchAll(pola)) { if (m.index > i) out.push(new TextRun({ text: teks.slice(i, m.index), font: FONT, size: o.size || 24, bold: o.bold, italics: o.italics })); out.push(new TextRun({ text: m[0], font: FONT, size: o.size || 24, bold: o.bold, italics: !o.italics })); i = m.index + m[0].length; }
  if (i < teks.length) out.push(new TextRun({ text: teks.slice(i), font: FONT, size: o.size || 24, bold: o.bold, italics: o.italics }));
  return out;
}
// Paragraf; teks boleh berisi **tebal**
function P(teks, o = {}) {
  const bag = String(teks).split(/(\*\*[^*]+\*\*)/).filter(Boolean).flatMap(s => s.startsWith('**') ? runs(s.slice(2, -2), Object.assign({}, o, { bold: true })) : runs(s, o));
  return new Paragraph({ children: bag, alignment: o.align || AlignmentType.JUSTIFIED, spacing: { line: o.line || 360, before: o.before || 0, after: o.after ?? 120 }, indent: o.indent ? { firstLine: 567 } : undefined, keepNext: o.keepNext });
}
const H1 = (t, tanpaPutus) => new Paragraph({ heading: HeadingLevel.HEADING_1, children: runs(t, { bold: true, size: 24 }), alignment: AlignmentType.CENTER, spacing: { before: 240, after: 240 }, pageBreakBefore: !tanpaPutus });
const H2 = t => new Paragraph({ heading: HeadingLevel.HEADING_2, children: runs(t, { bold: true, size: 24 }), spacing: { before: 240, after: 120 }, keepNext: true });
const H3 = t => new Paragraph({ heading: HeadingLevel.HEADING_3, children: runs(t, { bold: true, italics: false, size: 24 }), spacing: { before: 180, after: 80 }, keepNext: true });
const B = (t, lvl = 0) => new Paragraph({ children: String(t).split(/(\*\*[^*]+\*\*)/).filter(Boolean).flatMap(s => s.startsWith('**') ? runs(s.slice(2, -2), { bold: true }) : runs(s)), numbering: { reference: 'poin', level: lvl }, spacing: { line: 360, after: 60 }, alignment: AlignmentType.JUSTIFIED });
const N = (t, ref = 'angka') => new Paragraph({ children: String(t).split(/(\*\*[^*]+\*\*)/).filter(Boolean).flatMap(s => s.startsWith('**') ? runs(s.slice(2, -2), { bold: true }) : runs(s)), numbering: { reference: ref, level: 0 }, spacing: { line: 360, after: 60 }, alignment: AlignmentType.JUSTIFIED });
const Cap = t => new Paragraph({ children: runs(t, { bold: true, size: 24 }), alignment: AlignmentType.CENTER, spacing: { before: 120, after: 80 }, keepNext: true });
const Sumber = t => new Paragraph({ children: runs(t, { size: 20, italics: false }), spacing: { before: 40, after: 200 } });

const garis = { style: BorderStyle.SINGLE, size: 4, color: '808080' };
function tabel(kepala, baris, lebar, o = {}) {
  const total = lebar.reduce((a, b) => a + b, 0); const ukuran = o.size || 20;
  const sel = (t, kep, w, warna) => new TableCell({ width: { size: w, type: WidthType.DXA }, verticalAlign: VerticalAlign.TOP, margins: { top: 40, bottom: 40, left: 70, right: 70 },
    shading: kep ? { type: ShadingType.CLEAR, fill: 'D9D9D9', color: 'auto' } : (warna ? { type: ShadingType.CLEAR, fill: warna, color: 'auto' } : undefined), borders: { top: garis, bottom: garis, left: garis, right: garis },
    children: String(t ?? '').split('\n').map(x => new Paragraph({ children: String(x).split(/(\*\*[^*]+\*\*)/).filter(Boolean).flatMap(s => s.startsWith('**') ? runs(s.slice(2, -2), { size: ukuran, bold: true }) : runs(s, { size: ukuran, bold: kep })), alignment: kep ? AlignmentType.CENTER : AlignmentType.LEFT, spacing: { line: 240, after: 0 } })) });
  return new Table({ width: { size: total, type: WidthType.DXA }, columnWidths: lebar,
    rows: [new TableRow({ tableHeader: true, cantSplit: true, children: kepala.map((k, i) => sel(k, true, lebar[i])) })].concat(baris.map(r => new TableRow({ cantSplit: !!o.cantSplit, children: r.map((c, i) => sel(c, false, lebar[i], o.warna && o.warna(r, i))) }))) });
}
const warnaStatus = (r, i, kol) => i === kol ? ({ PASS: 'E2EFDA', FAIL: 'F8CBAD', BLOCKED: 'FFE699', 'NOT TESTED': 'EDEDED' })[r[kol]] : undefined;
const gambar = (f, lebarPx, tinggiPx) => new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 120, after: 60 }, keepNext: true, children: [new ImageRun({ type: 'jpg', data: fs.readFileSync(ROOT + '/docs/uat/bukti/' + f), transformation: { width: lebarPx, height: tinggiPx } })] });

// ---------- Data ----------
const rekap = J.hasil.reduce((a, r) => (a[r.status] = (a[r.status] || 0) + 1, a), {});
const tglEks = '10 November 2026';
const NAMA_P = { P1: 'Persona 1 — Koordinator & Pengelola K3', P2: 'Persona 2 — Identifikasi Bahaya & Risiko', P3: 'Persona 3 — Insiden, Pelaporan & Tindak Lanjut' };
const HARI = [['2026-09-25', 'Jumat, 25 September 2026', 1], ['2026-09-28', 'Senin, 28 September 2026', 1], ['2026-09-29', 'Selasa, 29 September 2026', 1], ['2026-09-30', 'Rabu, 30 September 2026', 1], ['2026-10-01', 'Kamis, 1 Oktober 2026', 1], ['2026-10-02', 'Jumat, 2 Oktober 2026', 1],
  ['2026-10-05', 'Senin, 5 Oktober 2026', 2], ['2026-10-06', 'Selasa, 6 Oktober 2026', 2], ['2026-10-07', 'Rabu, 7 Oktober 2026', 2], ['2026-10-08', 'Kamis, 8 Oktober 2026', 2], ['2026-10-09', 'Jumat, 9 Oktober 2026', 2],
  ['2026-10-12', 'Senin, 12 Oktober 2026', 3], ['2026-10-13', 'Selasa, 13 Oktober 2026', 3], ['2026-10-14', 'Rabu, 14 Oktober 2026', 3], ['2026-10-15', 'Kamis, 15 Oktober 2026', 3], ['2026-10-16', 'Jumat, 16 Oktober 2026', 3]];
const tglPendek = iso => { const [y, m, d] = iso.split('-'); return +d + ' ' + ['', 'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'][+m] + ' ' + y; };

// Catatan log harian per kasus (alasan, data, kesulitan, tanggapan persona simulasi, rekomendasi)
const LOG = {
  'UAT-01': ['Memastikan akun dan hak akses Koordinator sebelum pengujian.', 'Akun sintetis P1 (peran K3RS, Admin Utama).', 'Tidak ada.', 'Menu dikelompokkan jelas; modul baru langsung terlihat.', '—'],
  'UAT-02': ['Orientasi: menemukan jalur kerja identifikasi bahaya.', 'Akun sintetis P2.', 'Tidak ada.', 'Tombol Lapor mudah ditemukan; JSA dan Inspeksi berada di menu Operasional.', '—'],
  'UAT-03': ['Memahami notifikasi yang wajib diterima pengelola insiden.', 'Akun sintetis P3.', 'Saluran push/email belum tersedia di lingkungan uji.', 'Penjelasan notifikasi wajib memudahkan; perlu kepastian kapan email aktif.', 'Aktifkan dan uji email/push di produksi.'],
  'UAT-04': ['Memastikan kerahasiaan register antarunit.', 'Akun petugas Farmasi (sintetis).', 'Tidak ada.', 'Pembatasan akses sesuai kebutuhan kerahasiaan.', '—'],
  'UAT-05': ['Mencatat bahaya listrik yang juga ada pada register RS (R.38).', 'Uraian octopus wiring, unit Rawat Inap.', 'Isian uraian tersembunyi di bagian "Tambahkan keterangan (opsional)".', 'Cepat diisi; namun uraian semestinya tidak tersembunyi untuk entri register.', 'Tampilkan isian uraian/sebab secara default untuk peran K3RS.'],
  'UAT-06': ['Menyamakan peringkat dengan register RS.', 'Dampak 5, Probabilitas 2.', 'Peringkat aplikasi berbeda dari dokumen RS.', 'Membingungkan: dokumen RS menyatakan Extreme, aplikasi menyatakan Tinggi.', 'Sediakan matriks 5×5 per sel (lihat G-01).'],
  'UAT-07': ['Mencari pengaturan agar peringkat sesuai matriks RS.', '25 sel matriks RS.', 'Pengaturan hanya berupa pita skor.', 'Tidak dapat disesuaikan tanpa perubahan aplikasi.', 'Tambahkan mode matriks dan label (Low/Moderate/High/Extreme).'],
  'UAT-08': ['Membangun register uji dari risiko MFK/B3 RS.', '8 risiko sintetis berbasis dokumen (tabel 7.1).', 'Tidak ada kolom sebab, pengendalian yang ada, opsi penanganan, dan residual.', 'Data inti tersimpan; struktur belum selengkap template RS.', 'Lihat G-03 dan G-06.'],
  'UAT-09': ['Menguji validasi minimum formulir.', 'Uraian tanpa jenis bahaya.', 'Tidak ada.', 'Validasi jelas.', '—'],
  'UAT-10': ['Menguji kelengkapan entri register.', 'Laporan tanpa uraian.', 'Entri tanpa uraian diterima.', 'Untuk register, entri tanpa sebab/risiko tidak bermakna.', 'Wajibkan uraian untuk entri register oleh K3RS.'],
  'UAT-11': ['Memastikan data pasien tidak masuk laporan K3.', 'Teks berisi nomor RM sintetis.', 'Tidak ada.', 'Perlindungan privasi sangat membantu.', '—'],
  'UAT-12': ['Menyiapkan bahan rapat Komite dalam format register RS.', 'Ekspor CSV format daftar risiko.', '16 kolom template RS belum ada padanannya.', 'Masih perlu salin-tempel manual ke template RS.', 'Samakan struktur ekspor dengan template 25 kolom.'],
  'UAT-13': ['Mencari risiko IPAL untuk pemantauan.', 'Kata kunci "IPAL".', 'Tidak ada.', 'Pencarian dan paginasi cepat.', '—'],
  'UAT-14': ['Membaca kondisi umum K3.', 'Dasbor.', 'Tidak ada.', 'Ringkas; ada peringatan bahwa angka bukan ukuran keselamatan.', '—'],
  'UAT-15': ['Inspeksi penyimpanan B3 (rujukan register B3 R.1).', 'Daftar periksa B3, 2 temuan sintetis.', 'Tidak ada.', 'Skor kepatuhan langsung terhitung.', 'Hubungkan temuan inspeksi ke register/CAPA secara otomatis.'],
  'UAT-16': ['Menguji kelengkapan bukti temuan.', 'Butir tidak sesuai tanpa catatan.', 'Tidak ada.', 'Validasi mencegah temuan tanpa keterangan.', '—'],
  'UAT-17': ['Analisis pekerjaan berisiko (rujukan register MFK R24).', 'JSA penggantian baterai ARD.', 'Tidak ada.', 'Langkah otomatis dan peringatan hierarki pengendalian membantu.', '—'],
  'UAT-18': ['Memastikan pemilik risiko mengetahui tugasnya.', 'Penugasan ke PJ IPSRS.', 'Tidak ada notifikasi server untuk penugasan laporan.', 'PJ harus membuka daftar tugas sendiri.', 'Tambahkan notifikasi penugasan (G-07).'],
  'UAT-19': ['Mensimulasikan kecelakaan kerja biologis (rujukan R25).', 'Laporan kejadian tertusuk jarum (sintetis).', 'Tidak ada.', 'Notifikasi wajib langsung ke Komite.', '—'],
  'UAT-20': ['Memeriksa kelengkapan data awal insiden.', 'Formulir Lapor jenis Kejadian.', 'Tidak ada tanggal/jam kejadian dan tindakan pertama.', 'Data awal insiden kurang untuk tren dan pelaporan.', 'Tambahkan isian waktu kejadian dan penanganan awal (G-04).'],
  'UAT-21': ['Memastikan pelaporan tanpa nama tetap dapat ditelusuri.', 'Laporan psikososial anonim.', 'Tidak ada.', 'Kode lacak memberi rasa aman pelapor.', '—'],
  'UAT-22': ['Melakukan RCA atas insiden tertusuk jarum.', 'Kronologi, 5 Why (3 tingkat), Fishbone.', 'Langkah cukup banyak (6 tab).', 'Terstruktur dan diagram langsung terbentuk.', 'Sediakan contoh/templat RCA insiden tajam.'],
  'UAT-23': ['Menguji aturan kelengkapan investigasi.', 'Pengajuan tanpa CAPA.', 'Tidak ada.', 'Aturan mencegah investigasi tanpa tindak lanjut.', '—'],
  'UAT-24': ['Menetapkan tindakan korektif.', 'CAPA ke PJ Kesling.', 'Tidak ada.', 'Keterkaitan akar masalah–CAPA jelas.', '—'],
  'UAT-25': ['Menjamin pemisahan tugas persetujuan.', 'Persetujuan oleh P3 (ditolak) dan P1.', 'Tidak ada.', 'Pemisahan tugas sesuai tata kelola.', '—'],
  'UAT-26': ['Menutup risiko setelah pengendalian.', 'Tindak lanjut rekayasa oleh PJ IPSRS.', 'Tidak ada penilaian residual.', 'Alur status jelas.', 'Lihat G-06.'],
  'UAT-27': ['Sosialisasi penanganan tumpahan B3.', 'Toolbox, 2 peserta, presensi QR.', 'Tidak ada.', 'Presensi QR praktis.', '—'],
  'UAT-28': ['Pelatihan APAR/Code Red (rujukan register MFK R1).', 'Nilai pre/post sintetis 50/85.', 'Tidak ada.', 'Pemisahan kehadiran dan kompetensi tepat.', '—'],
  'UAT-29': ['Mengendalikan pekerjaan listrik berisiko.', 'PTW listrik merujuk JSA ARD.', 'Tidak ada.', 'Bahaya dari JSA tersalin otomatis; izin tidak bisa dimulai sebelum disahkan.', '—'],
  'UAT-30': ['Menelusuri riwayat insiden.', 'Kata kunci "tertusuk jarum".', 'Detail laporan tidak menautkan investigasi.', 'Penelusuran harus berpindah modul.', 'Tampilkan tautan investigasi pada detail laporan (G-08).'],
  'UAT-31': ['Menyiapkan rekap bulanan rapat Komite.', 'Laporan bulanan November 2026.', 'Bawaan halaman adalah bulan sebelumnya.', 'Rekap lengkap dan dapat dicetak.', '—'],
  'UAT-32': ['Mengelola notifikasi.', 'Kotak masuk P1.', 'Tidak ada.', 'Tandai semua dibaca hanya berlaku untuk akun sendiri.', '—'],
  'UAT-33': ['Memastikan notifikasi sampai di luar aplikasi.', 'Antrean email.', 'Belum dikonfigurasi.', '—', 'Konfigurasi dan uji di produksi.'],
  'UAT-34': ['Memeriksa cermin data di Sheets.', 'Halaman sinkron.', 'Tidak terhubung ke produksi.', '—', 'Uji bersama pemilik spreadsheet.'],
  'UAT-35': ['Menilai risiko residual seperti kolom 20–23 register RS.', 'Risiko kebakaran (R1).', 'Tidak ada isian residual.', 'Register belum dapat menunjukkan efektivitas pengendalian.', 'Tambahkan penilaian inherent dan residual (G-06).'],
  'UAT-36': ['Menyiapkan dokumen investigasi untuk rapat.', 'Laporan cetak investigasi.', 'Tidak ada.', 'Lengkap untuk diarsipkan.', '—'],
  'UAT-37': ['Memastikan dapat dipakai di ponsel.', 'Viewport 360 px.', 'Tidak ada.', 'Tampilan rapi di ponsel.', '—'],
  'UAT-38': ['Memastikan data di produksi.', '—', 'Tidak ada akses produksi.', '—', 'Lakukan UAT ulang oleh pengguna nyata di produksi/staging.'] };
// Rencana untuk hari tanpa kasus uji (NOT TESTED)
const RENCANA = {
  P1: 'Meninjau dasbor dan status tindak lanjut (rencana; tidak dijalankan sebagai kasus uji terpisah).',
  P2: 'Verifikasi lapangan atas risiko yang dicatat (aktivitas di luar aplikasi; tidak diuji).',
  P3: 'Memantau laporan masuk dan status CAPA (rencana; tidak dijalankan sebagai kasus uji terpisah).' };

// Dataset register (dari skrip uji)
const REG = [
  ['RR-01', 'UAT-05/06', '2026-09-28', 'P2', 'Rawat Inap', 'Penggunaan alat medis & elektronik di ruang perawatan', 'Stop kontak bertumpuk (octopus wiring), kabel rol tidak standar', 'Mekanik/Listrik', 'Korsleting, sengatan listrik, kebakaran, alat life-support mati', 5, 2, 'Pengecekan panel berkala; stop kontak UPS merah (register RS R.38)', 'Stop kontak dinding permanen; penarikan kabel rol tidak standar', 'PJ IPSRS (sintetis)', 'R.38'],
  ['RR-02', 'UAT-08', '2026-09-30', 'P2', 'IPSRS (Gedung RS)', 'Pemeliharaan sistem proteksi kebakaran', 'Sistem proteksi kebakaran bermasalah', 'Kebakaran/Darurat', 'Korban jiwa, kerugian materi', 5, 3, 'SOP APAR, SOP Code Red', 'Pelatihan Code Red seluruh petugas; perbaikan sistem', 'PJ IPSRS (sintetis)', 'MFK R1'],
  ['RR-03', 'UAT-08', '2026-09-30', 'P2', 'IPSRS (lift pasien)', 'Operasional lift-bed', 'Baterai ARD belum diganti', 'Mekanik/Listrik', 'Pengguna terjebak saat listrik padam', 5, 4, 'Usulan anggaran baterai', 'Pemeliharaan bulanan pihak ketiga; penggantian baterai', 'PJ IPSRS (sintetis)', 'MFK R24'],
  ['RR-04', 'UAT-08', '2026-09-30', 'P2', 'Kesling (TPS)', 'Pengangkutan limbah medis', 'Jarum/benda tajam di kantong kuning', 'Limbah', 'Tertusuk jarum, infeksi', 5, 3, 'SOP pemilahan dan pewadahan', 'Pelaporan ke PPI; pengawasan pemilahan di ruangan', 'PJ Kesling (sintetis)', 'MFK R25'],
  ['RR-05', 'UAT-08', '2026-09-30', 'P2', 'Gizi (dapur)', 'Pengolahan makanan', 'Bahan mudah terbakar di dapur', 'Kebakaran/Darurat', 'Kebakaran dapur', 5, 2, 'SOP penyimpanan B3', 'Penyimpanan di tempat aman', 'PJ IPSRS (sintetis)', 'MFK R27'],
  ['RR-06', 'UAT-08', '2026-09-30', 'P2', 'Radiologi', 'Pemeriksaan X-ray', 'Paparan radiasi pengion', 'Fisik', 'Gangguan kesehatan jangka panjang', 5, 4, 'SOP APD, TLD', 'Kepatuhan APD; pemantauan dosis', 'PJ IPSRS (sintetis)*', 'MFK R28'],
  ['RR-07', 'UAT-08', '2026-09-30', 'P2', 'Farmasi (gudang B3)', 'Penyimpanan B3', 'Ruang/lemari B3 belum standar', 'Kimia/B3', 'Luka bakar kimia, keracunan, pencemaran', 4, 4, 'Label B3, SDS, APD, SOP', 'Lemari B3 standar, spill kit, pelatihan, inspeksi rutin', 'PJ IPSRS (sintetis)*', 'B3 R.1'],
  ['RR-08', 'UAT-08', '2026-09-30', 'P2', 'IPSRS (HVAC)', 'Operasional tata udara', 'HVAC rusak', 'Mekanik/Listrik', 'Sirkulasi udara tidak memenuhi syarat', 3, 2, 'SOP pemeliharaan AC', 'Perbaikan dan pemeliharaan AC', 'PJ IPSRS (sintetis)', 'MFK R33'],
  ['RR-09', 'UAT-08', '2026-09-30', 'P2', 'Kesling (IPAL)', 'Pengolahan air limbah', 'IPAL tidak dipelihara rutin', 'Limbah', 'Kualitas air limbah di atas baku mutu', 5, 4, 'SOP pemeliharaan IPAL', 'Pemeliharaan IPAL rutin', 'PJ Kesling (sintetis)', 'MFK R35']];
const MAT = J.matriks_rs; const levelRS = (d, p) => ({ L: 'Low', M: 'Moderate', H: 'High', E: 'Extreme' })[MAT[p][d - 1]];
const pitaApp = s => s <= 4 ? 'Rendah' : s <= 9 ? 'Sedang' : s <= 14 ? 'Tinggi' : 'Sangat Tinggi';

// ---------- Lampiran CSV ----------
const csv = (baris) => '﻿' + baris.map(r => r.map(c => { const s = String(c ?? ''); return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(',')).join('\r\n');
const LAMP = ROOT + '/docs/uat/lampiran/';
fs.writeFileSync(LAMP + 'dataset_risk_register_SIMULASI_UAT.csv', csv([['penanda', 'kode_kasus', 'id_uji', 'tanggal_skenario', 'persona', 'unit_lokasi', 'aktivitas', 'sumber_bahaya', 'jenis_bahaya', 'konsekuensi', 'dampak', 'probabilitas', 'skor', 'peringkat_matriks_RS', 'peringkat_aplikasi', 'pengendalian_ada', 'rekomendasi', 'pj_simulasi', 'target', 'rujukan_dokumen', 'status_uji']]
  .concat(REG.map(r => ['SIMULASI_UAT', r[0], r[1], r[2], r[3], r[4], r[5], r[6], r[7], r[8], r[9], r[10], r[9] * r[10], levelRS(r[9], r[10]), pitaApp(r[9] * r[10]), r[11], r[12], r[13], r[0] === 'RR-01' ? '+7 hari dari eksekusi' : '+14 hari dari eksekusi', r[14], R[r[1].split('/')[0]].status]))));
const INS = [
  ['IN-01', 'UAT-19/22/23/24/25/36', '2026-10-07', 'P3', 'Kesling – jalur angkut limbah ke TPS', 'Kejadian', 'Biologi/Limbah', 'Petugas tertusuk jarum suntik bekas di kantong kuning', 'Mendesak', 'Investigasi INV, 5 Why 3 tingkat, Fishbone (Metode), CAPA ke PJ Kesling, disetujui P1', 'MFK R25'],
  ['IN-02', 'UAT-21', '2026-10-07', 'P3', 'Farmasi – depo', 'Bahaya (anonim)', 'Psikososial', 'Beban kerja shift malam berlebih', 'Tidak', 'Kode lacak; status Baru', '—'],
  ['IN-03', 'UAT-10', '2026-09-30', 'P2', 'IPSRS', 'Bahaya', 'Fisik', '(uraian kosong — uji validasi)', 'Tidak', 'Diterima sistem (temuan G-02)', '—']];
fs.writeFileSync(LAMP + 'dataset_insiden_SIMULASI_UAT.csv', csv([['penanda', 'kode_kasus', 'id_uji', 'tanggal_skenario', 'persona', 'unit_lokasi', 'jenis_laporan', 'kategori', 'uraian', 'mendesak', 'tindak_lanjut_di_aplikasi', 'rujukan_dokumen']].concat(INS.map(r => ['SIMULASI_UAT'].concat(r)))));
const OPS = [
  ['OP-01', 'UAT-15', 'Inspeksi', 'Farmasi – Gudang B3', 'Daftar periksa "Bahan kimia / B3" (7 butir)', '2 temuan: spill kit tidak lengkap; formalin & klorin berdampingan', R['UAT-15'].aktual],
  ['OP-02', 'UAT-16', 'Inspeksi', 'IPSRS', 'Daftar periksa "Keselamatan listrik"', 'Butir tidak sesuai tanpa catatan (uji validasi)', R['UAT-16'].aktual],
  ['OP-03', 'UAT-17', 'JSA', 'IPSRS – ruang mesin lift', 'Penggantian baterai ARD lift-bed memakai tangga', 'Langkah & bahaya otomatis; peringatan pengendalian', R['UAT-17'].aktual],
  ['OP-04', 'UAT-29', 'Izin kerja (PTW)', 'IPSRS', 'Izin kerja listrik merujuk JSA OP-03', 'Draf; mulai sebelum disahkan ditolak', R['UAT-29'].aktual],
  ['OP-05', 'UAT-27', 'Toolbox meeting', 'Kesling & Farmasi', 'Penanganan tumpahan B3', '2 peserta, 1 presensi QR', R['UAT-27'].aktual],
  ['OP-06', 'UAT-28', 'Pelatihan', 'Kesling', 'Penggunaan APAR dan Code Red', 'Pre 50 / post 85; kompetensi dengan metode asesmen', R['UAT-28'].aktual]];
fs.writeFileSync(LAMP + 'dataset_jsa_inspeksi_kegiatan_SIMULASI_UAT.csv', csv([['penanda', 'kode', 'id_uji', 'modul', 'unit_lokasi', 'objek', 'data_uji', 'hasil_aktual']].concat(OPS.map(r => ['SIMULASI_UAT'].concat(r)))));
fs.writeFileSync(LAMP + 'matriks_pengujian_fungsional.csv', csv([['id', 'persona', 'tanggal_skenario', 'fitur', 'skenario', 'langkah', 'diharapkan', 'aktual', 'status', 'bukti', 'catatan', 'dijalankan_utc']].concat(J.hasil.map(r => [r.id, r.persona, r.tanggal, r.fitur, r.skenario, r.langkah, r.diharapkan, r.aktual, r.status, r.bukti, r.catatan, r.dijalankan]))));

// ---------- Isi dokumen ----------
const isi = [];
const A4 = { width: 11906, height: 16838 };
const lebarPotret = 11906 - 2268 - 1701; // margin kiri 4 cm, kanan 3 cm
const lebarLanskap = 16838 - 1701 - 1701;

// Halaman judul
const judul = [
  new Paragraph({ spacing: { before: 1800 }, children: [] }),
  P('LAPORAN PENGUJIAN PENERIMAAN PENGGUNA (UAT) BERBASIS PERSONA', { bold: true, align: AlignmentType.CENTER, after: 0 }),
  P('APLIKASI HSE PROJECT VERSI 2.2.0', { bold: true, align: AlignmentType.CENTER, after: 240 }),
  P('Simulasi Tiga Anggota Komite K3 dengan Konteks RSUD ODSK Provinsi Sulawesi Utara', { align: AlignmentType.CENTER, after: 960 }),
  P('Jenis dokumen: laporan pengujian (simulasi persona, bukan studi dengan partisipan manusia)', { align: AlignmentType.CENTER, after: 0 }),
  P('Periode skenario: 25 September – 16 Oktober 2026 (hari kerja)', { align: AlignmentType.CENTER, after: 0 }),
  P('Tanggal eksekusi pengujian otomatis: ' + tglEks, { align: AlignmentType.CENTER, after: 0 }),
  P('Lingkungan: basis data uji terpisah (hse_uat), bukan produksi', { align: AlignmentType.CENTER, after: 960 }),
  P('Penanda data uji: SIMULASI_UAT', { bold: true, align: AlignmentType.CENTER }),
];
isi.push(...judul);

// Pernyataan integritas
isi.push(H1('PERNYATAAN INTEGRITAS DAN BATASAN'));
[
  'Dokumen ini disusun dengan ketentuan berikut, dan pembaca diminta menafsirkan seluruh isi laporan dalam batasan tersebut.',
].forEach(t => isi.push(P(t, { indent: true })));
[
  '**Persona adalah simulasi.** Ketiga persona anggota Komite K3 bukan orang sungguhan dan bukan responden. Tanggapan persona pada log harian merupakan interpretasi penguji berdasarkan bukti sistem, bukan pendapat pengguna nyata.',
  '**Tanggal skenario berbeda dengan tanggal eksekusi.** Jadwal 25 September–16 Oktober 2026 adalah kerangka skenario. Seluruh kasus uji benar-benar dijalankan secara otomatis pada ' + tglEks + ' (waktu UTC tercatat per kasus dalam lampiran). Laporan ini tidak menyatakan bahwa aplikasi telah digunakan selama tiga minggu.',
  '**Lingkungan uji, bukan produksi.** Pengujian berjalan pada aplikasi versi 2.2.0 yang sama dengan yang dipublikasikan, tetapi terhubung ke basis data PostgreSQL uji (hse_uat) melalui emulator REST lokal. Tidak ada data produksi Supabase yang dibaca, diubah, atau dihapus.',
  '**Data sintetis.** Semua akun, nama, dan isian bertanda SIMULASI_UAT. Uraian risiko diringkas dari dokumen risk register RSUD ODSK yang diberikan pengguna sebagai rujukan skenario, tetapi entri di aplikasi tetap data uji dan tidak boleh dibaca sebagai data operasional rumah sakit. Nama penyusun dokumen rumah sakit tidak dicantumkan.',
  '**Bukti.** Setiap hasil aktual dibaca dari antarmuka dan/atau basis data uji oleh skrip, disertai tangkapan layar asli dari eksekusi (folder docs/uat/bukti). Tidak ada tangkapan layar yang disunting.',
  '**Status apa adanya.** Kasus yang tidak dapat dijalankan diberi status BLOCKED atau NOT TESTED dan tidak dihitung sebagai PASS. Eksekusi awal skrip sempat menghasilkan 21 BLOCKED akibat selektor skrip yang keliru (bukan kesalahan aplikasi); skrip diperbaiki dan seluruh rangkaian dijalankan ulang dari basis data kosong. Hasil yang dilaporkan adalah eksekusi terakhir.',
  '**Tidak ada skor instrumen.** Laporan tidak memuat skor SUS, TAM, atau instrumen penelitian lain karena tidak ada responden nyata.'
].forEach(t => isi.push(B(t)));

// Daftar isi
isi.push(H1('DAFTAR ISI'));
isi.push(new TableOfContents('Daftar Isi', { hyperlink: true, headingStyleRange: '1-2' }));
isi.push(P('(Perbarui daftar isi di Microsoft Word: klik kanan → Update Field.)', { size: 20, align: AlignmentType.LEFT }));
isi.push(H1('DAFTAR SINGKATAN'));
isi.push(tabel(['Singkatan', 'Kepanjangan / arti'], [['API','~~Application Programming Interface~~'],['APAR','Alat Pemadam Api Ringan'],['APD','Alat Pelindung Diri'],['ARD','~~Automatic Rescue Device~~ (dokumen RS menulis ~~Automatic Rescue Switch~~)'],['B3','Bahan Berbahaya dan Beracun'],['CAPA','~~Corrective and Preventive Action~~ (tindakan korektif dan preventif)'],['CSSD','~~Central Sterile Supply Department~~ (instalasi sterilisasi pusat)'],['CSV','~~Comma-Separated Values~~'],['D','Dampak (~~consequence~~)'],['GHS','~~Globally Harmonized System~~ (sistem klasifikasi dan pelabelan bahan kimia)'],['HIRA','~~Hazard Identification and Risk Assessment~~'],['HVAC','~~Heating, Ventilation, and Air Conditioning~~'],['ICU','~~Intensive Care Unit~~'],['IGD','Instalasi Gawat Darurat'],['INS / INV','Awalan nomor inspeksi / investigasi di aplikasi'],['IPAL','Instalasi Pengolahan Air Limbah'],['IPSRS','Instalasi Pemeliharaan Sarana dan Prasarana Rumah Sakit'],['ISO','~~International Organization for Standardization~~'],['JSA','~~Job Safety Analysis~~ (analisis keselamatan pekerjaan)'],['JSON','~~JavaScript Object Notation~~'],['K3','Keselamatan dan Kesehatan Kerja'],['K3RS','Keselamatan dan Kesehatan Kerja Rumah Sakit; juga nama peran pengelola K3 di aplikasi'],['KARS','Komisi Akreditasi Rumah Sakit'],['Kesling','Kesehatan Lingkungan'],['LOTO','~~Lockout/Tagout~~ (penguncian dan penandaan sumber energi)'],['MFA','~~Multi-Factor Authentication~~'],['MFK','Manajemen Fasilitas dan Keselamatan'],['NIK','Nomor Induk Kependudukan'],['P','Probabilitas (~~likelihood~~)'],['PJ','Penanggung Jawab'],['PPI','Pencegahan dan Pengendalian Infeksi'],['PTW','~~Permit to Work~~ (izin kerja)'],['PWA','~~Progressive Web App~~'],['QR','~~Quick Response~~ (kode batang dua dimensi)'],['RCA','~~Root Cause Analysis~~ (analisis akar masalah)'],['RLS','~~Row Level Security~~ (pembatasan akses per baris data)'],['RM','Rekam Medis'],['RS','Rumah Sakit'],['RSUD','Rumah Sakit Umum Daerah'],['SDS / MSDS','~~Safety Data Sheet~~ / ~~Material Safety Data Sheet~~'],['SIMRS','Sistem Informasi Manajemen Rumah Sakit'],['SOP / SPO','~~Standard Operating Procedure~~ / Standar Prosedur Operasional'],['SPM','Standar Pelayanan Minimal'],['SUS','~~System Usability Scale~~'],['SWA','~~Stop Work Authority~~ (wewenang menghentikan pekerjaan)'],['TAM','~~Technology Acceptance Model~~'],['TBM / TRN','Awalan nomor ~~toolbox meeting~~ / pelatihan (~~training~~) di aplikasi'],['TLD','~~Thermoluminescent Dosimeter~~'],['TPS','Tempat Penampungan Sementara (limbah)'],['UAT','~~User Acceptance Testing~~ (pengujian penerimaan pengguna)'],['UPS','~~Uninterruptible Power Supply~~'],['UTC','~~Coordinated Universal Time~~'],['VAPID','~~Voluntary Application Server Identification~~ (kunci untuk ~~push notification~~)'],['WITA','Waktu Indonesia Tengah']], [2000, lebarPotret - 2000], { size: 22 }));
isi.push(H1('DAFTAR ISTILAH ASING'));
isi.push(P('Istilah bahasa asing dicetak miring di seluruh dokumen. Arti yang diberikan adalah arti dalam konteks laporan ini.', { indent: true }));
isi.push(tabel(['Istilah asing', 'Arti dalam bahasa Indonesia'], [['~~actual result~~','hasil aktual yang teramati'],['~~backend~~','bagian sistem di sisi server'],['~~badge~~','lencana penanda jumlah'],['~~browser~~','peramban web'],['~~checklist~~','daftar periksa'],['~~commit~~','satuan perubahan tercatat pada repositori kode'],['~~dashboard~~','dasbor; halaman ringkasan'],['~~deployment~~','penerbitan aplikasi ke server'],['~~desktop~~','komputer meja/laptop'],['~~download~~ / ~~upload~~','unduh / unggah'],['~~Edge Function~~','fungsi server kecil yang dijalankan Supabase'],['~~email~~','surat elektronik (surel)'],['~~emulator~~','perangkat lunak peniru layanan'],['~~end-to-end~~','dari ujung ke ujung (seluruh alur)'],['~~expected result~~','hasil yang diharapkan'],['~~Extreme~~ / ~~High~~ / ~~Moderate~~ / ~~Low~~','peringkat risiko sangat tinggi / tinggi / sedang / rendah'],['~~eyewash~~','pancuran pembilas mata'],['~~FAIL~~ / ~~PASS~~ / ~~BLOCKED~~ / ~~NOT TESTED~~','gagal / lulus / terhambat / belum diuji'],['~~feedback~~','umpan balik'],['~~Fishbone~~','diagram tulang ikan (Ishikawa) untuk analisis penyebab'],['~~Five Why~~ (5 Why)','teknik bertanya "mengapa" berulang untuk menemukan akar masalah'],['~~frontend~~','bagian antarmuka di sisi pengguna'],['~~hashing~~','pengubahan data menjadi sidik unik satu arah'],['~~hazard~~','bahaya'],['~~headless~~','peramban tanpa tampilan layar'],['~~life support~~','alat penunjang hidup'],['~~login~~ / ~~logout~~','masuk / keluar akun'],['~~Loss Prevention~~ / ~~Loss Reduction~~','pencegahan kerugian / pengurangan kerugian'],['~~mock~~','tiruan untuk pengujian'],['~~near miss~~','nyaris celaka'],['~~octopus wiring~~','stop kontak/kabel bertumpuk'],['~~offline~~ / ~~online~~','tanpa / dengan koneksi internet'],['~~open source~~','sumber terbuka'],['~~post-test~~ / ~~pre-test~~','uji sesudah / sebelum pelatihan'],['~~push notification~~','notifikasi dorong ke perangkat'],['~~repository~~','tempat penyimpanan kode'],['~~Risk Prevention~~ / ~~Risk Transfer~~','pencegahan risiko / pengalihan risiko'],['~~risk register~~','daftar risiko'],['~~safety box~~','wadah limbah benda tajam'],['~~safety shower~~','pancuran darurat'],['~~scenario-based testing~~','pengujian berbasis skenario'],['~~screenshot~~','tangkapan layar'],['~~script~~','skrip; rangkaian perintah program'],['~~server~~','komputer penyedia layanan'],['~~smartphone~~','ponsel pintar'],['~~software~~','perangkat lunak'],['~~spill kit~~','perlengkapan penanganan tumpahan'],['~~spreadsheet~~','lembar kerja'],['~~stepper~~','penanda tahapan alur'],['~~test case~~','kasus uji'],['~~timestamp~~','penanda waktu'],['~~toolbox meeting~~','pertemuan singkat keselamatan sebelum bekerja'],['~~traceability~~','ketertelusuran'],['~~usability~~','kebergunaan'],['~~viewport~~','area tampilan layar'],['~~workflow~~','alur kerja']], [3200, lebarPotret - 3200], { size: 22 }));

// BAB 1
isi.push(H1('BAB 1 PENDAHULUAN'));
isi.push(H2('1.1 Latar Belakang'));
isi.push(P('HSE Project adalah aplikasi web progresif (Progressive Web App) untuk pelaporan bahaya, pengelolaan risk register, inspeksi, Job Safety Analysis (JSA), izin kerja, investigasi kecelakaan, CAPA, serta pelatihan dan toolbox meeting di rumah sakit. Sebelum aplikasi digunakan oleh Komite K3, kesesuaiannya dengan cara kerja Komite perlu diuji dari sudut pandang pengguna, tidak hanya dari sisi teknis.', { indent: true }));
isi.push(P('Pengujian ini memakai pendekatan User Acceptance Testing berbasis skenario dengan tiga persona simulasi. Skenario disusun dari dokumen risk register RSUD ODSK tahun 2026 yang diberikan pengguna, sehingga kasus uji mencerminkan jenis risiko yang benar-benar tercatat di dokumen tersebut.', { indent: true }));
isi.push(H2('1.2 Tujuan'));
['Mengidentifikasi fitur yang benar-benar tersedia dan alur kerjanya.', 'Menguji alur kerja ketiga persona secara langsung pada antarmuka aplikasi dengan data sintetis.', 'Membandingkan keluaran aplikasi dengan format dan metode penilaian risiko pada dokumen rumah sakit.', 'Mendokumentasikan fitur yang berjalan baik, ketidaksesuaian, dan rekomendasi perbaikan berdasarkan bukti.'].forEach(t => isi.push(N(t, 'tujuan')));
isi.push(H2('1.3 Ruang Lingkup dan Batasan'));
isi.push(P('Ruang lingkup mencakup 38 kasus uji pada modul: masuk dan hak akses, formulir lapor, penilaian risiko, risk register, dasbor, ekspor, inspeksi, JSA, izin kerja, pelaporan insiden, laporan anonim, investigasi dan RCA, CAPA, toolbox meeting, pelatihan, notifikasi, laporan bulanan, pencarian, dan tampilan ponsel. Batasan: tidak ada akses ke Supabase produksi, Google Sheets produksi, maupun layanan email/push. Kasus yang memerlukan akses tersebut berstatus BLOCKED.', { indent: true }));

// BAB 2 Metode
isi.push(H1('BAB 2 METODE PENGUJIAN'));
isi.push(H2('2.1 Desain'));
isi.push(P('Desain pengujian adalah scenario-based testing dengan persona (Cooper, 1999) dan dokumentasi kasus uji mengikuti struktur umum ISO/IEC/IEEE 29119-3: identitas, langkah, expected result, actual result, status, dan bukti. Setiap kasus dijalankan oleh skrip otomatis Playwright yang meniru tindakan pengguna pada antarmuka (klik, isi formulir, unduh). Pada beberapa kasus yang memerlukan banyak entri, data dimasukkan melalui pustaka klien aplikasi yang sama (K3Api) yang dipakai antarmuka; cara ini tetap melewati aturan akses dan validasi basis data, dan dinyatakan pada kolom catatan.', { indent: true }));
isi.push(H2('2.2 Lingkungan Uji'));
isi.push(tabel(['Komponen', 'Keterangan'], [
  ['Aplikasi', 'HSE Project versi 2.2.0 (commit db5d04d pada cabang main, yang juga dipublikasikan di GitHub Pages)'],
  ['Basis data', 'PostgreSQL 16 lokal, basis data hse_uat dibuat ulang dari skrip migrasi 01, 10, 20, 21, 23 (sama dengan yang disiapkan untuk produksi)'],
  ['Layanan API', 'Emulator REST/Auth lokal (tests/server/rest-uji.js) meneruskan identitas pengguna ke PostgreSQL sehingga aturan Row Level Security yang diuji adalah aturan basis data sebenarnya'],
  ['Peramban', 'Chromium headless (Playwright); layar 1280×860 px, dan 360 px untuk uji ponsel'],
  ['Skrip uji', 'tests/uat/uat_komite_k3.js dan tests/uat/siapkan_uat.sh (tersimpan di repository)'],
  ['Hasil mentah', 'tests/uat/hasil_uat.json; tangkapan layar docs/uat/bukti/UAT-xx.jpg'],
  ['Waktu eksekusi', tglEks + ', ' + J.dijalankan.replace('T', ' ').slice(0, 16) + ' UTC (akhir eksekusi)']], [2600, lebarPotret - 2600], { size: 22 }));
isi.push(H2('2.3 Akun Uji Sintetis'));
isi.push(tabel(['Akun (sintetis)', 'Peran di aplikasi', 'Fungsi dalam skenario'], [
  ['SIMULASI_UAT P1 Koordinator K3', 'K3RS, Admin Utama', 'Persona 1'], ['SIMULASI_UAT P2 Identifikasi Bahaya', 'K3RS', 'Persona 2'], ['SIMULASI_UAT P3 Insiden & Tindak Lanjut', 'K3RS', 'Persona 3'],
  ['SIMULASI_UAT PJ IPSRS', 'PJ unit IPSRS', 'Pemilik risiko teknis'], ['SIMULASI_UAT PJ Kesling', 'PJ unit Kesehatan Lingkungan', 'Pemilik risiko limbah, PJ CAPA'],
  ['SIMULASI_UAT Petugas Kesling', 'Petugas', 'Pelapor insiden, peserta pelatihan'], ['SIMULASI_UAT Petugas Farmasi', 'Petugas', 'Pelapor anonim, uji hak akses']], [3400, 2400, lebarPotret - 5800], { size: 22 }));
isi.push(H2('2.4 Definisi Status dan Klasifikasi Temuan'));
isi.push(tabel(['Status', 'Arti'], [['PASS', 'Fungsi berjalan sesuai hasil yang diharapkan.'], ['FAIL', 'Ditemukan ketidaksesuaian yang dapat direproduksi terhadap hasil yang diharapkan persona/dokumen RS.'], ['BLOCKED', 'Tidak dapat diuji karena kendala akses atau dependensi.'], ['NOT TESTED', 'Belum diuji.']], [2000, lebarPotret - 2000], { size: 22 }));
isi.push(P('Temuan dibedakan menjadi: (a) bug aktual, yaitu perilaku yang menyimpang dari rancangan aplikasi; (b) kesenjangan kebutuhan, yaitu aplikasi berjalan sesuai rancangan tetapi tidak memenuhi kebutuhan atau format rumah sakit; dan (c) rekomendasi, yaitu usulan perbaikan yang tidak berasal dari kegagalan.', { indent: true, before: 120 }));

// BAB 3 Dokumen
isi.push(H1('BAB 3 ANALISIS DOKUMEN PENDUKUNG'));
isi.push(H2('3.1 Dokumen yang Diperiksa'));
isi.push(tabel(['Dokumen', 'Isi pokok', 'Pemanfaatan'], [
  ['Risk Register (Daftar Risiko) RSUD ODSK Tahun 2026 (PDF, 60 hlm.)', 'R.1–R.102 risiko klinis, R.103–R.137 risiko non-klinis; 25 kolom (inherent, opsi penanganan, residual)', 'Struktur kolom acuan; contoh R.37–R.38 (radiasi, listrik)'],
  ['Risk Register Keselamatan 2026 – MFK (PDF, 2 hlm.)', '15 risiko fasilitas: proteksi kebakaran, air bersih, lift ARD, limbah tajam, oksigen, dapur, radiasi, listrik, pasien jatuh, B3, life support, HVAC, jamur, IPAL, keracunan makanan', 'Sumber utama skenario RR-02 s.d. RR-09 dan IN-01'],
  ['Risk Register Peralatan Medis 2026 – MFK (PDF, 1 hlm.)', '6 risiko alat medis (sengatan listrik, infant warmer, radiasi panas, sinar X, kalibrasi, ventilator)', 'Validasi matriks peringkat'],
  ['Risk Register Bahan B3 2026 (PDF, 4 hlm.; 1 hlm. berisi)', '3 risiko B3 (tumpahan/paparan, penggunaan, inventarisasi)', 'Skenario RR-07, inspeksi OP-01, toolbox OP-05'],
  ['Daftar Risiko Unit Gizi (XLSX)', '2 risiko (distribusi makanan terlambat, salah identifikasi pasien)', 'Pembanding label peringkat']], [3300, 3400, lebarPotret - 6700], { size: 20 }));
isi.push(H2('3.2 Matriks Peringkat Risiko yang Digunakan Rumah Sakit'));
isi.push(P('Dokumen rumah sakit tidak memuat legenda matriks. Matriks pada Tabel 3.2 diturunkan dari seluruh pasangan dampak–probabilitas beserta peringkatnya yang tercantum di register MFK Keselamatan (30 pasangan inherent dan residual) dan register Peralatan Medis (12 pasangan). Ke-42 pasangan tersebut konsisten 100% dengan matriks ini. Bentuk matriks sama dengan matriks penilaian risiko yang lazim dipakai dalam akreditasi rumah sakit: peringkat ditentukan oleh sel, bukan oleh hasil kali. Contohnya, dampak 5 selalu Extreme walaupun probabilitasnya 1.', { indent: true }));
isi.push(Cap('Tabel 3.2 Matriks peringkat risiko yang diturunkan dari register RS'));
const nmL = { L: 'Low', M: 'Moderate', H: 'High', E: 'Extreme' }, wrn = { L: 'C6E0B4', M: 'FFF2CC', H: 'F8CBAD', E: 'FF7C80' };
isi.push(tabel(['Probabilitas \\ Dampak', '1', '2', '3', '4', '5'], [5, 4, 3, 2, 1].map(p => [String(p)].concat(MAT[p].split('').map(c => nmL[c]))), [2400].concat(Array(5).fill(Math.floor((lebarPotret - 2400) / 5))),
  { size: 20, warna: (r, i) => i > 0 ? wrn[MAT[r[0]][i - 1]] : undefined }));
isi.push(Sumber('Sumber: diolah dari Risk Register Keselamatan dan Risk Register Peralatan Medis RSUD ODSK 2026 (42 pasangan, 0 pengecualian).'));
isi.push(H2('3.3 Ketidakkonsistenan pada Dokumen Rumah Sakit'));
isi.push(P('Pemeriksaan dokumen menemukan beberapa ketidakkonsistenan. Temuan ini adalah observasi atas dokumen, bukan atas aplikasi, dan perlu dikonfirmasi oleh pemilik dokumen (PERLU VERIFIKASI):', { indent: true }));
['Label peringkat berbeda antar-dokumen: Low/Moderate/High/Extreme (MFK, register utama), SANGAT TINGGI/SEDANG (B3, Gizi), serta Sangat Rendah/Rendah (sebagian register utama).',
  'Register B3: risiko R.1 dan R.2 residual tertulis dampak 3, probabilitas 3, tetapi skor 6 (seharusnya 9). Peringkat D3×P3 tertulis "SEDANG", sedangkan pada register MFK D3×P3 = High.',
  'Register B3 R.3 dan register Gizi nomor 2: kolom peringkat residual berisi angka "2", bukan label.',
  'Register Peralatan Medis: kode risiko R20 dipakai untuk empat risiko berbeda.',
  'Register MFK nomor 1: penanganan "Hindari risiko" tetapi pembiayaan "Retensi risiko"; kombinasi ini perlu dijelaskan dalam pedoman pengisian.'].forEach(t => isi.push(B(t)));
isi.push(P('Ketidakkonsistenan tersebut menunjukkan manfaat aplikasi yang menghitung skor dan peringkat secara otomatis, dengan syarat metode perhitungannya sama dengan metode rumah sakit (lihat temuan G-01).', { indent: true, before: 120 }));

// BAB 4 Fitur aktual
isi.push(H1('BAB 4 FITUR DAN ALUR KERJA YANG TERSEDIA'));
isi.push(P('Fitur di bawah diidentifikasi dari kode sumber dan diverifikasi dengan membuka halaman pada lingkungan uji. Keberadaan menu tidak dianggap bukti bahwa fitur berfungsi; status fungsi ditentukan oleh hasil kasus uji pada Bab 8.', { indent: true }));
isi.push(tabel(['Modul', 'Rute', 'Alur utama', 'Diuji pada'], [
  ['Lapor bahaya/kejadian', '/lapor, /lacak', 'Unit → jenis bahaya → keterangan (opsional) → kirim; anonim dengan kode lacak', 'UAT-05, 09–11, 19–21'],
  ['Risk register', '/semua, /laporan/:id', 'Baru → ditugaskan (PJ, target, D×P) → tindak lanjut → tertutup', 'UAT-06, 08, 13, 18, 26, 35'],
  ['Dasbor & laporan bulanan', '/dasbor, /bulanan', 'Ringkasan dan rekap per bulan, cetak/CSV', 'UAT-14, 31'],
  ['Inspeksi terpandu', '/inspeksi', 'Pilih daftar periksa → isi → ringkasan → simpan', 'UAT-15, 16'],
  ['JSA', '/jsa', 'Langkah otomatis → bahaya → hierarki pengendalian → persetujuan K3RS', 'UAT-17, 29'],
  ['Izin kerja (PTW)', '/izin', 'Draf → supervisor → tinjauan K3 → pengesahan → aktif → selesai → ditutup', 'UAT-29'],
  ['Investigasi & RCA', '/investigasi', 'Dari laporan kejadian → kronologi → 5 Why → Fishbone → CAPA → persetujuan → penutupan', 'UAT-22–25, 36'],
  ['CAPA lintas modul', '/capa', 'Tindakan → PJ → selesai dengan bukti → verifikasi efektivitas', 'UAT-24'],
  ['Pelatihan & toolbox', '/kegiatan, /hadir', 'Jadwal → peserta → QR presensi → nilai → kompetensi → sertifikat', 'UAT-27, 28'],
  ['Notifikasi', '/notifikasi', 'Kotak masuk, tandai dibaca, pengaturan kategori; email/push via antrean', 'UAT-03, 32, 33'],
  ['Ekspor & Sheets', '/ekspor, /sinkron', 'CSV laporan, format daftar risiko, cadangan JSON; cermin Google Sheets', 'UAT-12, 34'],
  ['Hak akses', 'semua', 'Petugas, PJ unit, K3RS; aturan di basis data (RLS)', 'UAT-04, 25']], [2300, 1500, lebarPotret - 2300 - 1500 - 1700, 1700], { size: 20 }));

// BAB 5 Persona
isi.push(H1('BAB 5 PROFIL TIGA PERSONA SIMULASI'));
const persona = [
  ['P1', 'Koordinator dan Pengelola K3', 'Memahami manajemen K3RS; memimpin rapat Komite; memerlukan gambaran kondisi dan kepatuhan tindak lanjut.', 'Dasbor, risk register, penugasan, persetujuan investigasi, laporan bulanan, pelatihan/toolbox, notifikasi, ekspor.', 'Informasi akurat dan siap dilaporkan ke direksi dalam format RS.', 'Masuk ke aplikasi 2–3 kali seminggu, meninjau ringkasan, menyetujui.'],
  ['P2', 'Pengelola Identifikasi Bahaya dan Risiko', 'Berfokus pada HIRA, inspeksi, JSA, dan pengendalian; mengenal pekerjaan IPSRS/Kesling.', 'Formulir lapor, penilaian D×P, register, inspeksi, JSA, PTW, ekspor register.', 'Formulir praktis dan penilaian risiko yang sama dengan matriks RS.', 'Paling sering memasukkan data, terutama pada minggu pertama.'],
  ['P3', 'Pengelola Insiden, Pelaporan, dan Tindak Lanjut', 'Berfokus pada laporan insiden, investigasi, rekomendasi, dan pemantauan CAPA.', 'Notifikasi, laporan kejadian, anonim/lacak, investigasi & RCA, CAPA, pencarian riwayat, laporan cetak.', 'Kronologi dan bukti terstruktur; status penyelesaian jelas.', 'Aktif saat ada kejadian (minggu kedua) dan saat penelusuran (minggu ketiga).']];
persona.forEach(p => { isi.push(H2('5.' + p[0].slice(1) + ' ' + NAMA_P[p[0]] + ' (simulasi)')); isi.push(tabel(['Aspek', 'Uraian'], [['Karakteristik', p[2]], ['Fitur yang diuji', p[3]], ['Kebutuhan utama', p[4]], ['Pola penggunaan dalam skenario', p[5]], ['Akun uji', 'SIMULASI_UAT ' + p[0] + ' (peran K3RS)']], [2800, lebarPotret - 2800], { size: 22 })); });

// BAB 6 Matriks aktivitas
isi.push(H1('BAB 6 RENCANA DAN MATRIKS AKTIVITAS TIGA MINGGU'));
isi.push(P('Tabel 6.1 memetakan setiap hari kerja skenario ke kasus uji per persona. Sabtu dan Minggu tidak berisi aktivitas. Kolom berisi tanda "—" berarti tidak ada kasus uji yang dijalankan untuk persona tersebut pada hari itu. Seluruh kasus dieksekusi pada ' + tglEks + '.', { indent: true }));
isi.push(Cap('Tabel 6.1 Matriks aktivitas (ID kasus uji per hari dan persona)'));
const perHari = (iso, p) => J.hasil.filter(r => r.tanggal === iso && r.persona === p).map(r => r.id + ' (' + r.status + ')').join('\n') || '—';
const fokus = { 1: 'Orientasi, akses, dasbor, identifikasi bahaya, risk register', 2: 'Operasional: inspeksi, JSA, pelaporan, investigasi, tindak lanjut', 3: 'Lanjutan: pelatihan, PTW, evaluasi, pelaporan, penilaian akhir' };
isi.push(tabel(['Mg', 'Hari/tanggal skenario', 'P1 Koordinator', 'P2 HIRA', 'P3 Insiden'], HARI.map(([iso, label, mg]) => [String(mg), label, perHari(iso, 'P1'), perHari(iso, 'P2'), perHari(iso, 'P3')]), [500, 2200, 1745, 1745, lebarPotret - 6190], { size: 20, cantSplit: true }));
isi.push(P('Fokus minggu: Minggu 1 — ' + fokus[1] + '; Minggu 2 — ' + fokus[2] + '; Minggu 3 — ' + fokus[3] + '.', { before: 120 }));

// BAB 7 Dataset (lanskap)
const isiLanskap1 = [];
isiLanskap1.push(H1('BAB 7 DATASET SKENARIO', true));
isiLanskap1.push(P('Semua dataset bertanda SIMULASI_UAT dan tersedia dalam format CSV pada folder docs/uat/lampiran. Kolom "Rujukan" menunjukkan kode risiko pada dokumen RS yang dijadikan dasar uraian; nilai dampak dan probabilitas mengikuti nilai inherent dokumen tersebut. Penanggung jawab dan target waktu adalah nilai simulasi.', { indent: true }));
isiLanskap1.push(Cap('Tabel 7.1 Dataset skenario risk register'));
isiLanskap1.push(tabel(['Kode', 'ID uji', 'Tgl skenario', 'Persona', 'Unit/lokasi', 'Aktivitas', 'Sumber bahaya', 'Jenis', 'Potensi konsekuensi', 'D', 'P', 'Peringkat matriks RS', 'Peringkat aplikasi (skor)', 'Pengendalian ada', 'Rekomendasi', 'PJ simulasi', 'Rujukan', 'Status uji'],
  REG.map(r => [r[0], r[1], tglPendek(r[2]), r[3], r[4], r[5], r[6], r[7], r[8], String(r[9]), String(r[10]), levelRS(r[9], r[10]), pitaApp(r[9] * r[10]) + ' (' + r[9] * r[10] + ')', r[11], r[12], r[13], r[14], R[r[1].split('/')[0]].status]),
  [560, 620, 720, 480, 900, 1000, 1080, 700, 1050, 300, 300, 760, 860, 1050, 1080, 760, 520, 600].map(x => Math.round(x * lebarLanskap / 13360)), { size: 16, warna: (r, i) => i === 17 ? warnaStatus(r, i, 17) : undefined }));
isiLanskap1.push(Sumber('* Unit Radiologi dan Farmasi tidak memiliki akun PJ sintetis; penugasan diarahkan ke PJ IPSRS sebagai penyederhanaan skenario. Target waktu: +7/+14 hari dari tanggal eksekusi. Catatan kendala aplikasi untuk seluruh baris: tidak ada isian sebab, pengendalian yang sudah ada, opsi penanganan, pembiayaan, dan residual (G-03, G-06).'));
isiLanskap1.push(Cap('Tabel 7.2 Dataset skenario pelaporan insiden'));
isiLanskap1.push(tabel(['Kode', 'ID uji', 'Tgl skenario', 'Persona', 'Unit/lokasi', 'Jenis', 'Kategori', 'Uraian (sintetis)', 'Mendesak', 'Alur di aplikasi', 'Rujukan'], INS.map(r => [r[0], r[1], tglPendek(r[2]), r[3], r[4], r[5], r[6], r[7], r[8], r[9], r[10]]),
  [700, 1300, 900, 600, 1500, 900, 900, 2000, 700, 2800, 900].map(x => Math.round(x * lebarLanskap / 13200)), { size: 18 }));
isiLanskap1.push(Cap('Tabel 7.3 Dataset JSA, inspeksi, izin kerja, toolbox, dan pelatihan'));
isiLanskap1.push(tabel(['Kode', 'ID uji', 'Modul', 'Unit/lokasi', 'Objek', 'Data uji', 'Hasil aktual'], OPS.map(r => r.slice()), [700, 800, 1300, 1600, 2400, 2600, 4000].map(x => Math.round(x * lebarLanskap / 13400)), { size: 18 }));

// BAB 8 Matriks pengujian fungsional
const isiLanskap2 = [];
isiLanskap2.push(H1('BAB 8 MATRIKS PENGUJIAN FUNGSIONAL'));
isiLanskap2.push(P('Rekapitulasi hasil: PASS ' + (rekap.PASS || 0) + ', FAIL ' + (rekap.FAIL || 0) + ', BLOCKED ' + (rekap.BLOCKED || 0) + ', NOT TESTED 0, dari ' + J.hasil.length + ' kasus. Tidak ada galat JavaScript yang tercatat selama eksekusi (' + J.galat_js.length + ' galat). Kolom bukti merujuk berkas tangkapan layar pada docs/uat/bukti.', { indent: true }));
isiLanskap2.push(Cap('Tabel 8.1 Matriks pengujian fungsional'));
isiLanskap2.push(tabel(['ID', 'Persona / tgl skenario', 'Fitur', 'Skenario', 'Langkah pengujian', 'Hasil yang diharapkan', 'Hasil aktual (dari bukti)', 'Status', 'Bukti', 'Catatan'],
  J.hasil.map(r => [r.id, r.persona + '\n' + tglPendek(r.tanggal), r.fitur, r.skenario, r.langkah, r.diharapkan, r.aktual, r.status, r.bukti || '—', r.catatan || '—']),
  [620, 820, 1050, 1450, 1650, 1450, 2600, 900, 760, 1720].map(x => Math.round(x * lebarLanskap / 13020)), { size: 16, warna: (r, i) => warnaStatus(r, i, 7) }));

// BAB 3 log harian (lanskap)
const isiLanskap3 = [];
isiLanskap3.push(H1('BAB 9 LOG PENGGUNAAN HARIAN PER PERSONA'));
isiLanskap3.push(P('Log disusun per hari kerja skenario. Kolom "Hasil aktual" menyalin hasil eksekusi. Kolom "Tanggapan persona" adalah interpretasi penguji (simulasi), bukan pendapat responden. Hari tanpa kasus uji ditandai NOT TESTED beserta aktivitas yang direncanakan.', { indent: true }));
for (const p of ['P1', 'P2', 'P3']) {
  isiLanskap3.push(H2('9.' + p.slice(1) + ' ' + NAMA_P[p]));
  const baris = [];
  for (const [iso, label] of HARI) {
    const ks = J.hasil.filter(r => r.tanggal === iso && r.persona === p);
    if (!ks.length) { baris.push([label, '—', RENCANA[p], '—', '—', '—', 'NOT TESTED', '—', '—', '—']); continue; }
    for (const r of ks) { const l = LOG[r.id]; baris.push([label, r.id + '\n' + r.fitur, r.skenario, l[1], l[0], r.diharapkan, r.status + ': ' + r.aktual, l[2], l[3], l[4]]); }
  }
  isiLanskap3.push(tabel(['Hari/tanggal', 'ID / fitur dibuka', 'Yang ingin dilakukan', 'Data dimasukkan/diperiksa', 'Alasan', 'Hasil yang diharapkan', 'Hasil aktual terbukti', 'Kesulitan', 'Tanggapan persona (simulasi)', 'Rekomendasi'], baris,
    [1100, 1100, 1450, 1250, 1300, 1350, 2500, 1150, 1300, 1150].map(x => Math.round(x * lebarLanskap / 13650)), { size: 16, warna: (r, i) => i === 6 ? ({ P: 'E2EFDA', F: 'F8CBAD', B: 'FFE699', N: 'EDEDED' })[r[6][0]] : undefined }));
}

// BAB 10 dst (potret)
const isi2 = [];
isi2.push(H1('BAB 10 DAFTAR BUG, KESENJANGAN, DAN KENDALA', true));
isi2.push(H2('10.1 Bug Aktual'));
isi2.push(P('Pada eksekusi akhir tidak ditemukan bug aktual, yaitu perilaku yang menyimpang dari rancangan aplikasi, dan tidak ada galat JavaScript. Bug yang ditemukan saat pengujian teknis sebelum UAT (antara lain kolom rahasia kode_hadir yang menggagalkan pembacaan kegiatan, dan hilangnya tombol "Tandai semua dibaca" pada pengingat) telah diperbaiki sebelum UAT dan dicatat pada docs/qa/LAPORAN_QA.md. Ketiadaan bug pada 38 kasus tidak berarti aplikasi bebas bug; cakupan uji terbatas pada skenario dalam laporan ini.', { indent: true }));
isi2.push(H2('10.2 Kesenjangan Kebutuhan (dapat direproduksi)'));
const GAP = [
  ['G-01', 'UAT-06, UAT-07', 'Tinggi', 'Metode peringkat risiko berbeda dengan RS. Aplikasi memakai pita skor (D×P); RS memakai matriks per sel. Contoh: D5×P2 = 10 → aplikasi "Tinggi", RS "Extreme". Ditemukan ' + J.konflik_pita + ' pasangan sel yang membuat pita skor apa pun tidak dapat menyamai matriks RS.', 'Peringkat di aplikasi dan dokumen akreditasi berbeda; risiko berdampak katastrofik dapat tampak lebih rendah.'],
  ['G-02', 'UAT-10', 'Sedang', 'Laporan tanpa uraian diterima; isian uraian tersembunyi di bagian opsional.', 'Entri register tanpa sebab/risiko.'],
  ['G-03', 'UAT-12', 'Tinggi', 'Ekspor "Format daftar risiko" berisi 14 kolom; 16 kolom template RS belum ada padanannya: ' + J.kolom_hilang.join(', ') + '. Kolom "Opsi teknik pengendalian" diisi hierarki pengendalian, bukan opsi penanganan risiko RS.', 'Register tetap harus disusun ulang secara manual untuk akreditasi.'],
  ['G-04', 'UAT-20', 'Sedang', 'Formulir laporan kejadian tidak memiliki tanggal/jam kejadian, korban, dan tindakan pertama; tanggal laporan = tanggal kirim.', 'Analisis tren dan pelaporan kecelakaan kerja kurang akurat bila laporan terlambat.'],
  ['G-05', 'UAT-35', 'Tinggi', 'Tidak ada penilaian risiko residual terpisah dari inherent; mengubah D/P menimpa nilai awal.', 'Efektivitas pengendalian (kolom 20–23 register RS) tidak dapat ditunjukkan.'],
  ['G-06', 'UAT-08, UAT-26', 'Sedang', 'Tidak ada isian "pengendalian yang sudah ada", "pembiayaan risiko", dan "perlu penanganan?".', 'Bagian evaluasi risiko register RS tidak terwakili.'],
  ['G-07', 'UAT-18', 'Rendah', 'Penugasan laporan ke PJ tidak membuat notifikasi server (berbeda dengan CAPA/PTW). PJ melihatnya di daftar tugas dan pengingat terhitung.', 'Tugas baru dapat terlewat.'],
  ['G-08', 'UAT-30', 'Rendah', 'Detail laporan tidak menautkan investigasi yang dibuat dari laporan tersebut.', 'Penelusuran insiden memerlukan perpindahan modul.']];
isi2.push(tabel(['Kode', 'Kasus', 'Prioritas', 'Uraian', 'Dampak bagi Komite'], GAP, [700, 1100, 900, lebarPotret - 700 - 1100 - 900 - 2000, 2000], { size: 20 }));
isi2.push(H2('10.3 Kendala yang Belum Dapat Diuji (BLOCKED)'));
['UAT-33: email dan push belum aktif. Antrean pengiriman terisi, tetapi Edge Function, kunci Resend, dan VAPID belum dipasang.', 'UAT-34: sinkron Google Sheets produksi tidak dapat diakses dari lingkungan uji.', 'UAT-38: penyimpanan di Supabase produksi tidak diverifikasi; UAT sengaja tidak menulis ke produksi.'].forEach(t => isi2.push(B(t)));
isi2.push(H2('10.4 Dugaan dan Observasi Lain (belum dikonfirmasi)'));
['Laporan bulanan secara bawaan menampilkan bulan sebelumnya. Hal ini wajar untuk rapat bulanan, tetapi sempat terbaca sebagai "data kosong".', 'Pada laporan bulanan, tindak lanjut laporan dihitung sebagai "CAPA". Istilah ini perlu diselaraskan dengan modul CAPA lintas modul agar tidak membingungkan (perlu konfirmasi pengguna).', 'Durasi eksekusi per kasus pada hasil mentah adalah waktu skrip otomatis, bukan waktu kerja manusia, sehingga tidak dipakai sebagai ukuran efisiensi.'].forEach(t => isi2.push(B(t)));

isi2.push(H1('BAB 11 FITUR YANG BERJALAN BAIK'));
const BAIK = J.hasil.filter(r => r.status === 'PASS');
isi2.push(P('Sebanyak ' + BAIK.length + ' kasus berstatus PASS. Fitur yang paling relevan bagi Komite K3:', { indent: true }));
['Hak akses berbasis peran di basis data: petugas tidak dapat membuka register; ketua tim investigasi tidak dapat menyetujui investigasinya sendiri (UAT-04, UAT-25).', 'Perlindungan identitas pasien pada formulir lapor (UAT-11).', 'Notifikasi wajib kejadian ke seluruh anggota Komite (UAT-19) dan tandai-dibaca yang hanya berlaku untuk akun sendiri (UAT-32).', 'Laporan anonim dengan kode lacak; identitas pelapor tidak tersimpan (UAT-21).',
  'Investigasi terstruktur: kronologi, 5 Why bertingkat, Fishbone, aturan wajib CAPA, laporan cetak (UAT-22–24, UAT-36).', 'Inspeksi terpandu dengan skor kepatuhan otomatis dan validasi catatan temuan (UAT-15, UAT-16).', 'JSA dengan langkah otomatis dan peringatan hierarki pengendalian, terhubung ke izin kerja yang tidak dapat dimulai sebelum disahkan (UAT-17, UAT-29).', 'Toolbox meeting dengan presensi QR; pelatihan yang memisahkan kehadiran dari kompetensi (UAT-27, UAT-28).', 'Risk register dengan pencarian dan paginasi sisi server, dasbor, dan laporan bulanan yang angkanya sama dengan basis data (UAT-13, UAT-14, UAT-31).', 'Tampilan ponsel 360 px tanpa gulir horizontal (UAT-37).'].forEach(t => isi2.push(B(t)));

isi2.push(H1('BAB 12 EVALUASI KEMUDAHAN PENGGUNAAN'));
isi2.push(P('Evaluasi berikut bersifat kualitatif dan didasarkan pada bukti pelaksanaan kasus uji, misalnya jumlah isian, jumlah langkah, dan pesan sistem. Evaluasi ini bukan hasil kuesioner dan tidak memuat skor SUS/TAM.', { indent: true }));
const UX = [['Kemudahan memahami menu', 'Menu dikelompokkan (Operasional K3, Dokumen & Laporan); modul baru terlihat (UAT-01).', 'Tombol Lapor menonjol; JSA/Inspeksi mudah ditemukan (UAT-02).', 'Investigasi dan CAPA terpisah dari laporan; penelusuran perlu pindah modul (UAT-30).'],
  ['Kemudahan mempelajari', 'Alur status empat tahap ditampilkan sebagai stepper.', 'Langkah JSA otomatis membantu pemula (UAT-17).', 'RCA memiliki 6 tab; perlu contoh pengisian.'],
  ['Kemudahan input data', 'Penugasan PJ satu formulir.', 'Formulir lapor 6 isian; uraian tersembunyi (UAT-05, UAT-10).', 'Laporan kejadian tanpa waktu kejadian (UAT-20).'],
  ['Kejelasan istilah K3', 'Dasbor menegaskan angka bukan ukuran keselamatan.', 'Label Rendah/Sedang/Tinggi berbeda dengan Low–Extreme RS (UAT-06).', 'Istilah 5 Why, Fishbone, CAPA sesuai praktik.'],
  ['Kecepatan menyelesaikan pekerjaan', 'Pencarian dan paginasi cepat (UAT-13).', 'Ekspor register perlu diolah ulang (UAT-12).', 'Notifikasi wajib langsung (UAT-19).'],
  ['Kejelasan hasil dan laporan', 'Laporan bulanan dapat dicetak/CSV (UAT-31).', 'Tidak ada risiko residual (UAT-35).', 'Laporan cetak investigasi lengkap (UAT-36).'],
  ['Kesesuaian dengan pekerjaan Komite', 'Baik untuk pemantauan dan persetujuan.', 'Belum sesuai format register akreditasi (G-01, G-03, G-05).', 'Baik untuk investigasi; data awal insiden perlu dilengkapi (G-04).']];
isi2.push(tabel(['Aspek', 'P1 Koordinator', 'P2 HIRA', 'P3 Insiden'], UX, [2200, Math.floor((lebarPotret - 2200) / 3), Math.floor((lebarPotret - 2200) / 3), lebarPotret - 2200 - 2 * Math.floor((lebarPotret - 2200) / 3)], { size: 20 }));
isi2.push(P('Fitur yang paling membantu (simulasi): P1 — dasbor dan laporan bulanan; P2 — inspeksi terpandu dan JSA otomatis; P3 — investigasi terstruktur dan notifikasi wajib. Fitur yang paling perlu diperbaiki: P1 — ekspor format register RS; P2 — matriks peringkat dan risiko residual; P3 — data awal insiden dan tautan laporan–investigasi.', { indent: true, before: 120 }));

isi2.push(H1('BAB 13 REKOMENDASI PERBAIKAN BERDASARKAN PRIORITAS'));
isi2.push(tabel(['Prioritas', 'Rekomendasi', 'Dasar', 'Ukuran keberhasilan'], [
  ['1 (Tinggi)', 'Tambahkan mode matriks 5×5 yang dapat diatur per sel dan label Low/Moderate/High/Extreme; gunakan di formulir, register, ekspor, dan dasbor.', 'G-01; UAT-06/07', '25 sel aplikasi = Tabel 3.2'],
  ['2 (Tinggi)', 'Lengkapi entri register: sebab, risiko, dampak, pengendalian yang sudah ada, opsi penanganan (hindari/kurangi/transfer/retensi), pembiayaan, serta penilaian inherent dan residual terpisah.', 'G-03, G-05, G-06', 'Ekspor memuat 25 kolom template RS'],
  ['3 (Tinggi)', 'Ekspor "Format register RS" dengan urutan kolom 1–25 identik dengan template rumah sakit.', 'G-03; UAT-12', 'Berkas dapat langsung dilampirkan untuk akreditasi'],
  ['4 (Sedang)', 'Laporan kejadian: tanggal/jam kejadian, korban (tanpa identitas pasien), dan tindakan pertama (mis. pasca-pajanan).', 'G-04; UAT-20', 'Tren insiden memakai tanggal kejadian'],
  ['5 (Sedang)', 'Untuk peran K3RS, tampilkan uraian secara default dan wajibkan uraian pada entri register.', 'G-02; UAT-05/10', 'Tidak ada entri register tanpa uraian'],
  ['6 (Sedang)', 'Aktifkan dan uji email/push di produksi; lakukan UAT ulang dengan pengguna nyata.', 'UAT-33/38', 'Status "terkirim" dan email diterima'],
  ['7 (Rendah)', 'Notifikasi saat laporan ditugaskan ke PJ; tautan investigasi pada detail laporan.', 'G-07, G-08', 'PJ menerima notifikasi; tautan tampil'],
  ['8 (Rendah)', 'Pedoman pengisian register yang menyeragamkan label dan kode risiko antar-unit.', 'Bab 3.3', 'Tidak ada lagi label/skor yang tidak konsisten']], [1300, lebarPotret - 1300 - 1700 - 2000, 1700, 2000], { size: 20 }));

isi2.push(H1('BAB 14 RINGKASAN HASIL PENGUJIAN'));
isi2.push(P('Pengujian berbasis tiga persona simulasi menjalankan ' + J.hasil.length + ' kasus uji pada aplikasi HSE Project versi 2.2.0 di lingkungan uji terpisah. Hasilnya: PASS ' + rekap.PASS + ', FAIL ' + rekap.FAIL + ', BLOCKED ' + rekap.BLOCKED + ', dan tidak ada galat JavaScript. Alur operasional (pelaporan, hak akses, inspeksi, JSA, izin kerja, investigasi–CAPA, pelatihan, notifikasi di aplikasi) berjalan sesuai rancangan pada skenario yang diuji.', { indent: true }));
isi2.push(P('Keenam FAIL bukan kerusakan program. Semuanya adalah kesenjangan antara rancangan aplikasi dan kebutuhan Komite K3/format register RSUD ODSK. Kesenjangan terpenting adalah metode peringkat risiko yang berbeda (G-01), ketiadaan risiko residual (G-05), dan struktur ekspor yang belum mengikuti template 25 kolom (G-03). Selama kesenjangan ini belum ditutup, aplikasi lebih tepat diposisikan sebagai alat pelaporan dan pemantauan daripada pengganti dokumen risk register akreditasi.', { indent: true }));
isi2.push(P('Hasil ini tidak dapat digeneralisasi sebagai efektivitas aplikasi di rumah sakit, karena tidak melibatkan pengguna nyata, tidak berjalan di lingkungan produksi, dan tidak berlangsung selama periode tiga minggu yang sesungguhnya.', { indent: true }));

isi2.push(H1('LAMPIRAN A. DATA SINTETIS (CSV)'));
isi2.push(P('Berkas berikut tersedia di folder docs/uat/lampiran pada repository, dikodekan UTF-8 dengan BOM, dan dapat dibuka di Microsoft Excel atau diimpor ke Google Sheets:', { indent: true }));
['dataset_risk_register_SIMULASI_UAT.csv — 9 baris (Tabel 7.1).', 'dataset_insiden_SIMULASI_UAT.csv — 3 baris (Tabel 7.2).', 'dataset_jsa_inspeksi_kegiatan_SIMULASI_UAT.csv — 6 baris (Tabel 7.3).', 'matriks_pengujian_fungsional.csv — 38 baris (Tabel 8.1), termasuk waktu eksekusi UTC tiap kasus.', 'Hasil mentah: tests/uat/hasil_uat.json; ekspor asli aplikasi: docs/uat/bukti/UAT-12-ekspor.csv.'].forEach(t => isi2.push(B(t)));
isi2.push(P('Cara mengulang pengujian:', { before: 120, keepNext: true }));
['tests/uat/siapkan_uat.sh (membuat basis data hse_uat dan akun sintetis)', 'PGDATABASE=hse_uat node tests/server/rest-uji.js 3101', 'python3 -m http.server 8765 (dari akar repository)', 'node tests/uat/uat_komite_k3.js'].forEach(t => isi2.push(N(t, 'ulang')));

isi2.push(H1('LAMPIRAN B. BUKTI YANG MASIH HARUS DIKUMPULKAN'));
isi2.push(tabel(['No', 'Bukti/informasi', 'Dari', 'Keperluan'], [
  ['1', 'Legenda/pedoman matriks risiko resmi RS (SK Direktur atau panduan manajemen risiko)', 'Komite Mutu/K3 RS', 'Mengonfirmasi Tabel 3.2 (PERLU VERIFIKASI)'],
  ['2', 'Keputusan label peringkat baku (Low–Extreme atau Rendah–Sangat Tinggi)', 'Komite Mutu/K3 RS', 'Konfigurasi aplikasi'],
  ['3', 'Konfirmasi koreksi register B3 (skor 3×3) dan kode R20 ganda', 'Penyusun register', 'Bab 3.3'],
  ['4', 'Daftar unit, struktur organisasi, dan PJ risiko yang berlaku', 'Bagian SDM/K3 RS', 'Akun dan penugasan nyata'],
  ['5', 'Persetujuan etik/izin bila UAT dilakukan dengan pengguna nyata', 'Manajemen RS/komisi etik', 'Studi lanjutan'],
  ['6', 'Hasil UAT oleh anggota Komite K3 nyata (log, tangkapan layar, kuesioner bila diperlukan)', 'Komite K3 RS', 'Mengganti simulasi'],
  ['7', 'Verifikasi migrasi 20, 21, 23 di Supabase produksi', 'Pemilik proyek', 'UAT-38'],
  ['8', 'Kunci Resend/VAPID dan bukti email/push diterima', 'Pemilik proyek', 'UAT-33'],
  ['9', 'Akses spreadsheet Google Sheets produksi', 'Pemilik proyek', 'UAT-34'],
  ['10', 'SOP pelaporan kecelakaan kerja dan formulir insiden RS', 'Komite K3 RS', 'Menyelaraskan G-04']], [600, 4200, 2000, lebarPotret - 6800], { size: 20 }));

isi2.push(H1('LAMPIRAN C. CUPLIKAN BUKTI TANGKAPAN LAYAR'));
const GB = [['UAT-06.jpg', 'Gambar C.1 UAT-06: D5×P2 ditampilkan "Skor 10 → Tinggi" (RS: Extreme)'], ['UAT-17.jpg', 'Gambar C.2 UAT-17: peringatan pengendalian belum memadai pada JSA'], ['UAT-22.jpg', 'Gambar C.3 UAT-22: investigasi dengan diagram Fishbone'], ['UAT-27.jpg', 'Gambar C.4 UAT-27: toolbox meeting dengan QR presensi']];
GB.forEach(([f, c]) => { isi2.push(gambar(f, 520, 349)); isi2.push(Cap(c)); });
isi2.push(P('Tangkapan layar lainnya (total 37 berkas) tersedia di docs/uat/bukti dengan nama sesuai ID kasus.', { before: 120 }));

isi2.push(H1('DAFTAR PUSTAKA'));
['Cooper, A. (1999). The Inmates Are Running the Asylum. Indianapolis: Sams Publishing.', 'International Organization for Standardization. (2018). ISO 31000:2018 Risk management — Guidelines. Geneva: ISO.', 'ISO/IEC/IEEE. (2021). ISO/IEC/IEEE 29119-3:2021 Software and systems engineering — Software testing — Part 3: Test documentation. Geneva: ISO.', 'Kementerian Kesehatan Republik Indonesia. (2016). Peraturan Menteri Kesehatan Nomor 66 Tahun 2016 tentang Keselamatan dan Kesehatan Kerja Rumah Sakit. Jakarta: Kemenkes RI.', 'RSUD ODSK Provinsi Sulawesi Utara. (2026). Risk Register (Daftar Risiko) Tahun 2026; Risk Register Keselamatan (MFK); Risk Register Peralatan Medis (MFK); Register Risiko Bahan B3; Daftar Risiko Unit Gizi [dokumen internal, diberikan pengguna].']
  .forEach(t => isi2.push(new Paragraph({ children: runs(t), spacing: { line: 360, after: 120 }, indent: { left: 567, hanging: 567 }, alignment: AlignmentType.JUSTIFIED })));

// ---------- Rakit ----------
const footer = new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 20 })] })] });
const potret = { page: { size: A4, margin: { top: 1701, bottom: 1701, left: 2268, right: 1701 } } };
const lanskap = { page: { size: Object.assign({}, A4, { orientation: PageOrientation.LANDSCAPE }), margin: { top: 1701, bottom: 1701, left: 1701, right: 1701 } } };
const doc = new Document({
  creator: 'Tim pengujian HSE Project (simulasi persona)', title: 'Laporan UAT Berbasis Persona — HSE Project 2.2.0', description: 'Pengujian penerimaan pengguna berbasis tiga persona simulasi Komite K3',
  styles: { default: { document: { run: { font: FONT, size: 24 } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size: 24, bold: true }, paragraph: { spacing: { before: 240, after: 240 }, keepNext: true, outlineLevel: 0 } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size: 24, bold: true }, paragraph: { spacing: { before: 240, after: 120 }, keepNext: true, outlineLevel: 1 } },
      { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size: 24, bold: true }, paragraph: { spacing: { before: 180, after: 80 }, keepNext: true, outlineLevel: 2 } }] },
  numbering: { config: [
    { reference: 'poin', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 567, hanging: 283 } }, run: { font: FONT } } }, { level: 1, format: LevelFormat.BULLET, text: '–', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 1134, hanging: 283 } } } }] },
    ...['angka', 'tujuan', 'ulang'].map(r => ({ reference: r, levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 567, hanging: 425 } }, run: { font: FONT } } }] }))] },
  features: { updateFields: true },
  sections: [
    { properties: potret, footers: { default: footer }, children: isi },
    { properties: lanskap, footers: { default: footer }, children: isiLanskap1.concat(isiLanskap2, isiLanskap3) },
    { properties: potret, footers: { default: footer }, children: isi2 }] });
Packer.toBuffer(doc).then(buf => { const out = ROOT + '/docs/uat/Laporan_UAT_Persona_Komite_K3_HSE_Project.docx'; fs.writeFileSync(out, buf); console.log('ditulis', out, buf.length); });
