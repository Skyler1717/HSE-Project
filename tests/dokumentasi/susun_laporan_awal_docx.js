// Laporan pendahuluan (tahap pertama MASTER PROMPT dokumentasi): pemetaan awal A–H sebelum dokumen akhir.
// Bukti: kode sumber v2.2.0, uji otomatis, UAT persona (data sintetis), tangkapan layar nyata lingkungan uji lokal.
const fs = require('fs'), path = require('path');
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, ShadingType, AlignmentType, HeadingLevel, PageOrientation, ImageRun, BorderStyle, LevelFormat, Footer, PageNumber, TableOfContents, VerticalAlign } = require('docx');
const ROOT = path.resolve(__dirname, '../..'), FONT = 'Times New Roman', UK = 24; // 12 pt di seluruh dokumen, termasuk tabel
const KELUAR = ROOT + '/docs/dokumentasi/Laporan_Pendahuluan_Pemetaan_Dokumentasi_HSE_Project.docx';

const INGGRIS = ['Progressive Web App', 'Row Level Security', 'Edge Function', 'push notification', 'Permit to Work', 'Stop Work Authority', 'Job Safety Analysis', 'Root Cause Analysis', 'Corrective and Preventive Action',
  'toolbox meeting', 'Design Science Research', 'User Acceptance Testing', 'end-to-end', 'screenshot', 'dashboard', 'login', 'offline', 'online', 'frontend', 'backend', 'server', 'browser', 'headless', 'risk register',
  'traceability', 'usability', 'low code', 'hand-coded', 'service worker', 'smoke test', 'emulator', 'Web Speech API', 'feature', 'workflow', 'audit trail', 'pre-test', 'post-test', 'checklist', 'dark mode', 'light mode',
  'IMPLEMENTED AND VERIFIED', 'PARTIALLY FUNCTIONAL', 'AVAILABLE BUT NOT FULLY TESTED', 'PLANNED', 'NOT YET IMPLEMENTED', 'BLOCKED', 'NOT APPLICABLE', 'NOT YET ESTABLISHED', 'SCREENSHOT REQUIRED',
  'PROPOSED CRITERION', 'PROPOSED ACCEPTANCE CRITERION', 'REQUIRES RESEARCHER VALIDATION', 'PASS', 'FAIL', 'Multi-Factor Authentication', 'Authenticator Assurance Level', 'Apps Script', 'spreadsheet', 'cron',
  'Operational Definition', 'Feature ID', 'Main Function', 'Intended User', 'How to Use', 'Required Input', 'Expected Output', 'Advantages', 'Why Necessary', 'Research Problem', 'Design Principle',
  'Evaluation Indicator', 'Measurement Method', 'Success/Acceptance Criteria', 'Evidence Source', 'Implementation Status', 'Feature/Variable', 'color vision deficiency', 'contrast ratio', 'ex-ante', 'artificial evaluation',
  'single-case', 'embedded', 'Fishbone', 'Five Why', 'Safety First', 'upload', 'download', 'route', 'hash routing', 'token', 'demo mode', 'deployment', 'repository', 'commit', 'scenario-based testing'];
const pola = new RegExp('(?<![\\p{L}\\d-])(' + INGGRIS.sort((a, b) => b.length - a.length).map(x => x.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')).join('|') + ')(?![\\p{L}\\d])', 'gu');
function runs(teks, o = {}) {
  teks = String(teks ?? ''); const out = []; let i = 0; const r = (t, it) => new TextRun({ text: t, font: FONT, size: UK, bold: o.bold, italics: it });
  for (const m of teks.matchAll(pola)) { if (m.index > i) out.push(r(teks.slice(i, m.index), o.italics)); out.push(r(m[0], !o.italics)); i = m.index + m[0].length; }
  if (i < teks.length) out.push(r(teks.slice(i), o.italics)); return out;
}
const tebal = (t, o = {}) => String(t).split(/(\*\*[^*]+\*\*)/).filter(Boolean).flatMap(s => s.startsWith('**') ? runs(s.slice(2, -2), Object.assign({}, o, { bold: true })) : runs(s, o));
const P = (t, o = {}) => new Paragraph({ children: tebal(t, o), alignment: o.align || AlignmentType.JUSTIFIED, spacing: { line: 360, after: 120 }, indent: o.indent ? { firstLine: 567 } : undefined, keepNext: o.keepNext });
const H1 = t => new Paragraph({ heading: HeadingLevel.HEADING_1, children: runs(t, { bold: true }), alignment: AlignmentType.CENTER, spacing: { before: 240, after: 240, line: 360 }, pageBreakBefore: true });
const H2 = t => new Paragraph({ heading: HeadingLevel.HEADING_2, children: runs(t, { bold: true }), spacing: { before: 240, after: 120, line: 360 }, keepNext: true });
const B = t => new Paragraph({ children: tebal(t), numbering: { reference: 'poin', level: 0 }, alignment: AlignmentType.JUSTIFIED, spacing: { line: 360, after: 60 } });
let nTabel = 0, nGambar = 0;
const CapT = t => new Paragraph({ children: runs('Tabel ' + (++nTabel) + '. ' + t, { bold: true }), alignment: AlignmentType.CENTER, spacing: { before: 200, after: 100, line: 360 }, keepNext: true });
const CapG = t => new Paragraph({ children: runs('Gambar ' + (++nGambar) + '. ' + t, { bold: true }), alignment: AlignmentType.CENTER, spacing: { before: 60, after: 120, line: 360 } });
const Sumber = t => new Paragraph({ children: runs('Sumber: ' + t), alignment: AlignmentType.LEFT, spacing: { after: 200 } });
const garis = { style: BorderStyle.SINGLE, size: 4, color: '808080' };
const WARNA = { 'IMPLEMENTED AND VERIFIED': 'E2EFDA', 'PARTIALLY FUNCTIONAL': 'FCE4D6', 'AVAILABLE BUT NOT FULLY TESTED': 'FFF2CC', 'PLANNED': 'DDEBF7', 'NOT YET IMPLEMENTED': 'F8CBAD', 'BLOCKED': 'FFE699', 'NOT APPLICABLE': 'EDEDED' };
function tabel(kepala, baris, lebar, kolStatus) {
  const sel = (t, kep, w, warna) => new TableCell({ width: { size: w, type: WidthType.DXA }, verticalAlign: VerticalAlign.TOP, margins: { top: 40, bottom: 40, left: 80, right: 80 }, borders: { top: garis, bottom: garis, left: garis, right: garis },
    shading: kep ? { type: ShadingType.CLEAR, fill: 'D9D9D9', color: 'auto' } : warna ? { type: ShadingType.CLEAR, fill: warna, color: 'auto' } : undefined,
    children: String(t ?? '').split('\n').map(x => new Paragraph({ children: tebal(x, { bold: kep }), alignment: kep ? AlignmentType.CENTER : AlignmentType.LEFT, spacing: { line: 240, after: 0 } })) });
  return new Table({ width: { size: lebar.reduce((a, b) => a + b, 0), type: WidthType.DXA }, columnWidths: lebar,
    rows: [new TableRow({ tableHeader: true, cantSplit: true, children: kepala.map((k, i) => sel(k, true, lebar[i])) })].concat(baris.map(r => new TableRow({ cantSplit: true, children: r.map((c, i) => sel(c, false, lebar[i], i === kolStatus ? WARNA[String(c).split('\n')[0]] : undefined)) }))) });
}
function gambar(f, w) { const p = ROOT + '/docs/dokumentasi/tangkapan/' + f; const lebar = w || 430; return new Paragraph({ alignment: AlignmentType.CENTER, keepNext: true, spacing: { before: 120, after: 40 }, children: [new ImageRun({ type: 'jpg', data: fs.readFileSync(p), transformation: { width: lebar, height: Math.round(lebar * 860 / 1280) } })] }); }

// ===================== DATA =====================
const STATUS_DEF = [
  ['IMPLEMENTED AND VERIFIED', 'Kode ada pada versi 2.2.0 dan perilakunya lulus pengujian yang terdokumentasi (uji otomatis dan/atau kasus UAT berstatus PASS) di lingkungan uji lokal. Bukan bukti berjalan di produksi.'],
  ['PARTIALLY FUNCTIONAL', 'Fitur berjalan, tetapi pengujian menemukan ketidaksesuaian dengan kebutuhan rumah sakit (kasus UAT berstatus FAIL) atau sebagian fungsinya belum ada.'],
  ['AVAILABLE BUT NOT FULLY TESTED', 'Kode ada dan halaman terbuka tanpa galat (smoke test), tetapi belum ada skenario uji yang memeriksa perilakunya.'],
  ['PLANNED', 'Tertulis sebagai usulan (berkas SQL usulan, dokumen rencana); belum menjadi bagian aplikasi yang aktif.'],
  ['NOT YET IMPLEMENTED', 'Kebutuhan teridentifikasi (dari UAT atau prinsip desain), tetapi tidak ada kodenya.'],
  ['BLOCKED', 'Kode ada, tetapi tidak dapat diuji/dioperasikan tanpa konfigurasi atau akses eksternal milik pemilik proyek.'],
  ['NOT APPLICABLE', 'Komponen pendukung pengujian/demonstrasi yang bukan kapabilitas operasional.']];

// [ID, fitur, modul/rute, peran, status, bukti, catatan]
const P_ALL = 'Semua peran', PJ = 'pj_unit, k3rs', K3 = 'k3rs';
const FITUR = [
  ['F-01', 'Pemilihan tema warna (3 tema) sebelum masuk dan di Akun', 'Inti · /tema, /akun', P_ALL, 'IMPLEMENTED AND VERIFIED', 'e2e.js skenario 1; tangkapan TEMA_* (dokumen ini)', 'Disimpan di peramban (localStorage), bukan di profil server.'],
  ['F-02', 'Masuk akun dan MFA untuk K3RS', 'Inti · /masuk, /mfa', P_ALL, 'IMPLEMENTED AND VERIFIED', 'UAT-01; login_supabase.js', 'Diuji pada server uji (aal2), bukan pada proyek Supabase produksi.'],
  ['F-03', 'Menu dan hak akses berbasis peran (RLS)', 'Inti · HAK di app.js; RLS basis data', P_ALL, 'IMPLEMENTED AND VERIFIED', 'UAT-04; tests/db/10_uji_rls_modul.sql', 'Keberadaan RLS bukan bukti keamanan menyeluruh; audit keamanan produksi belum dilakukan.'],
  ['F-04', 'Beranda (ringkasan, tombol lapor besar)', 'Inti · /beranda', P_ALL, 'IMPLEMENTED AND VERIFIED', 'UAT-02', ''],
  ['F-05', 'Informasi cuaca di beranda/Intelligence (Open-Meteo)', 'Intelligence · /beranda, /intel', P_ALL, 'AVAILABLE BUT NOT FULLY TESTED', 'smoke.js (layanan cuaca diblokir saat uji)', 'Bergantung layanan publik pihak ketiga.'],
  ['F-06', 'Formulir lapor bahaya/insiden (jenis, kategori, unit, lokasi, uraian, mendesak, foto)', 'Inti · /lapor', P_ALL, 'IMPLEMENTED AND VERIFIED', 'UAT-05, UAT-09, UAT-19', 'Kekurangan dicatat terpisah (F-44, F-45).'],
  ['F-07', 'Laporan anonim tanpa jejak identitas dan foto + kode lacak', 'Inti · /lapor, /lacak', P_ALL, 'IMPLEMENTED AND VERIFIED', 'UAT-21; constraint anonim_tanpa_jejak (01_setup.sql)', 'Anonimitas di tingkat data; log jaringan penyedia layanan tidak dinilai.'],
  ['F-08', 'Pelaporan dengan suara ("Ceritakan dengan suara")', 'Inti · /lapor; asisten.js', P_ALL, 'AVAILABLE BUT NOT FULLY TESTED', 'Tidak ada uji (Web Speech API tidak tersedia pada peramban headless)', 'Masih perlu menekan tombol; belum memenuhi "tanpa sentuhan layar" (D1).'],
  ['F-09', 'Antrean offline dan draf laporan', 'Inti · app.js (k3_antrean, k3_draf)', P_ALL, 'AVAILABLE BUT NOT FULLY TESTED', 'Tidak ada skenario uji khusus', 'Idempotensi id_klien diuji di basis data, bukan alur offline di peramban.'],
  ['F-10', 'Penilaian risiko Dampak × Kemungkinan dan pita risiko', 'Inti · /lapor, /pengaturan', PJ, 'PARTIALLY FUNCTIONAL', 'UAT-06 FAIL, UAT-07 FAIL', 'Klasifikasi berdasar skor; register RS memakai matriks per sel.'],
  ['F-11', 'Laporan saya (riwayat laporan pelapor)', 'Inti · /laporan-saya', P_ALL, 'AVAILABLE BUT NOT FULLY TESTED', 'smoke.js', ''],
  ['F-12', 'Daftar laporan unit/semua (filter, cari, paginasi server)', 'Lanjutan · /semua', PJ, 'IMPLEMENTED AND VERIFIED', 'UAT-13; e2e_supabase.js (1.250+ laporan)', ''],
  ['F-13', 'Penetapan penanggung jawab dan target tanggal', 'Inti · /laporan/:id', PJ, 'IMPLEMENTED AND VERIFIED', 'UAT-18; trigger trg_laporan_aturan (D3)', 'Penugasan pada modul inti tidak membuat notifikasi server (F-46).'],
  ['F-14', 'Daftar tugas PJ', 'Lanjutan · /tugas', PJ, 'IMPLEMENTED AND VERIFIED', 'UAT-18, UAT-26', ''],
  ['F-15', 'Tindak lanjut dengan hierarki pengendalian dan bukti', 'Inti · /laporan/:id', PJ, 'IMPLEMENTED AND VERIFIED', 'UAT-26; e2e_supabase.js', ''],
  ['F-16', 'Aturan penutupan sah: tertutup hanya oleh K3RS, wajib PJ, bukti, dan pengendalian fisik; APD/administratif → terkendali sementara', 'Inti · trigger basis data', K3, 'IMPLEMENTED AND VERIFIED', 'trg_laporan_aturan (01_setup.sql); e2e.js; e2e_supabase.js', 'Penutupan tercatat ≠ bukti risiko di tempat kerja telah hilang.'],
  ['F-17', 'Daftar periksa D2/D3/D4 pada detail laporan', 'Inti · /laporan/:id', PJ, 'AVAILABLE BUT NOT FULLY TESTED', 'Kode app.js baris 737–739; belum ada tangkapan layar', ''],
  ['F-18', 'Riwayat perubahan dan jejak audit per laporan', 'Inti · /laporan/:id', PJ, 'IMPLEMENTED AND VERIFIED', 'UAT-30; tests/db/20_uji_jejak.sql', ''],
  ['F-19', 'Log aktivitas sistem', 'Admin · /log', K3, 'AVAILABLE BUT NOT FULLY TESTED', 'smoke.js', ''],
  ['F-20', 'Dasbor: angka ringkas, titik putus empat tahap, kesenjangan catatan', 'Inti · /dasbor', PJ, 'IMPLEMENTED AND VERIFIED', 'UAT-14; tangkapan TEMA_*_dasbor', 'Angka = hitungan catatan, bukan ukuran tingkat keselamatan.'],
  ['F-21', 'Ekspor CSV format daftar risiko', 'Inti · /ekspor', PJ, 'PARTIALLY FUNCTIONAL', 'UAT-12 FAIL', 'Kolom opsi teknik pengendalian salah dipetakan.'],
  ['F-22', 'Laporan bulanan (rekap, cetak)', 'Dokumen · /bulanan', PJ, 'IMPLEMENTED AND VERIFIED', 'UAT-31', ''],
  ['F-23', 'Inspeksi terpandu (daftar periksa)', 'Kerja · /inspeksi', P_ALL, 'IMPLEMENTED AND VERIFIED', 'UAT-15, UAT-16; e2e.js', ''],
  ['F-24', 'JSA dengan langkah awal otomatis dan deteksi bahaya', 'Kerja · /jsa', P_ALL, 'IMPLEMENTED AND VERIFIED', 'UAT-17; e2e.js', 'Saran otomatis berbasis kata kunci, perlu telaah manusia.'],
  ['F-25', 'Pemantauan K3 (pengukuran berkala)', 'Kerja · /pemantauan', P_ALL, 'IMPLEMENTED AND VERIFIED', 'e2e.js (mode demo)', 'Belum diuji pada mode Supabase.'],
  ['F-26', 'Izin kerja (PTW) terhubung JSA, Stop Work Authority', 'Izin · /izin', P_ALL, 'IMPLEMENTED AND VERIFIED', 'UAT-29; e2e_supabase.js', ''],
  ['F-27', 'Toolbox meeting dengan presensi QR', 'Izin · /kegiatan, /hadir', P_ALL, 'IMPLEMENTED AND VERIFIED', 'UAT-27; e2e_supabase.js', ''],
  ['F-28', 'Pelatihan, pre-test/post-test, kompetensi, sertifikat', 'Izin · /kegiatan', P_ALL, 'IMPLEMENTED AND VERIFIED', 'UAT-28; e2e_supabase.js', ''],
  ['F-29', 'Investigasi dan RCA (Five Why, Fishbone) dengan persetujuan berpemisahan tugas', 'Lanjutan · /investigasi', PJ, 'IMPLEMENTED AND VERIFIED', 'UAT-22, 23, 25, 36; e2e_supabase.js', ''],
  ['F-30', 'CAPA lintas modul dan verifikasi efektivitas', 'Lanjutan · /capa', PJ, 'IMPLEMENTED AND VERIFIED', 'UAT-24; e2e_supabase.js', 'Verifikasi efektivitas = isian penilai, bukan pengukuran risiko.'],
  ['F-31', 'Pusat notifikasi dalam aplikasi', 'Izin · /notifikasi', P_ALL, 'IMPLEMENTED AND VERIFIED', 'UAT-03, UAT-32', ''],
  ['F-32', 'Notifikasi email dan push (Edge Function kirim-notifikasi)', 'Server · supabase/functions', '—', 'BLOCKED', 'UAT-33 BLOCKED; logika: tests/notifikasi/uji_logika.mjs', 'Belum dipasang; kunci penyedia belum dikonfigurasi pemilik proyek.'],
  ['F-33', 'Sinkron satu arah ke Google Sheets (Apps Script)', 'Dokumen · /sinkron; Kode.gs', K3, 'BLOCKED', 'UAT-34 BLOCKED; logika: tests/sheets/uji_apps_script.js', 'Status produksi DATA BELUM TERSEDIA — MEMERLUKAN VERIFIKASI.'],
  ['F-34', 'HSE Intelligence (ringkasan, tren, peringatan dini)', 'Intelligence · /intel', P_ALL, 'AVAILABLE BUT NOT FULLY TESTED', 'smoke.js', 'Hasil analitik belum divalidasi terhadap data rujukan.'],
  ['F-35', 'Pencarian cerdas lintas modul', 'Intelligence · /cari', P_ALL, 'IMPLEMENTED AND VERIFIED', 'e2e.js; e2e_supabase.js', ''],
  ['F-36', 'Asisten (panduan percakapan, suara keluar)', 'Inti · /asisten', P_ALL, 'AVAILABLE BUT NOT FULLY TESTED', 'smoke.js', 'Aturan lokal; bukan model bahasa.'],
  ['F-37', 'Pustaka SOP: unggah TXT/PDF/DOCX/gambar dengan OCR', 'Dokumen · /sop', P_ALL, 'IMPLEMENTED AND VERIFIED', 'e2e.js (5 format)', ''],
  ['F-38', 'Uji tampilan buta warna (simulasi protan/deutan/tritan/abu)', 'Dokumen · /uji-warna', P_ALL, 'AVAILABLE BUT NOT FULLY TESTED', 'smoke.js', 'Simulasi visual, bukan uji dengan pengguna.'],
  ['F-39', 'Pengelolaan pengguna dan peran', 'Admin · /pengguna', K3, 'IMPLEMENTED AND VERIFIED', 'e2e.js; e2e_supabase.js; UAT-01', ''],
  ['F-40', 'Pengaturan (unit, jenis bahaya, pita risiko) dan ekspor "Konfigurasi untuk replikasi" (JSON)', 'Admin · /pengaturan', K3, 'AVAILABLE BUT NOT FULLY TESTED', 'smoke.js; UAT-07 (pita)', 'Ekspor konfigurasi replikasi belum diuji.'],
  ['F-41', 'Kode QR per unit/lokasi', 'Admin · /qr', K3, 'AVAILABLE BUT NOT FULLY TESTED', 'smoke.js', ''],
  ['F-42', 'Perlindungan identitas pasien pada uraian', 'Inti · /lapor', P_ALL, 'IMPLEMENTED AND VERIFIED', 'UAT-11', ''],
  ['F-43', 'Tampilan responsif ponsel (360 px) dan PWA (service worker)', 'Inti · sw.js, css', P_ALL, 'PARTIALLY FUNCTIONAL', 'UAT-37 (responsif); smoke.js LEBAR=360', 'Instalasi PWA dan cache offline belum diuji (service worker diblokir saat uji).'],
  ['F-44', 'Isian "sebab/penyebab" wajib untuk register risiko', '—', PJ, 'NOT YET IMPLEMENTED', 'UAT-10 FAIL', ''],
  ['F-45', 'Tanggal kejadian terpisah dari tanggal kirim', '—', P_ALL, 'NOT YET IMPLEMENTED', 'UAT-20 FAIL', 'Berpengaruh pada analisis waktu tunda pelaporan.'],
  ['F-46', 'Notifikasi server saat penugasan pada modul inti', '—', PJ, 'NOT YET IMPLEMENTED', 'UAT-18 (catatan)', ''],
  ['F-47', 'Penilaian ulang risiko residual setelah pengendalian', '—', PJ, 'NOT YET IMPLEMENTED', 'UAT-35 FAIL', ''],
  ['F-48', 'Matriks risiko 5×5 yang dapat diatur per sel', '—', K3, 'NOT YET IMPLEMENTED', 'UAT-07 (rekomendasi)', ''],
  ['F-49', 'Kanal pelaporan sepenuhnya tanpa sentuhan layar (D1 penuh)', '—', P_ALL, 'NOT YET IMPLEMENTED', 'Analisis kode (F-08 perlu menekan tombol)', ''],
  ['F-50', 'Peran Admin Utama', 'supabase/usulan/10_admin_utama.sql', '—', 'PLANNED', 'Berkas usulan; tidak termasuk migrasi utama', 'Penerapan produksi DATA BELUM TERSEDIA — MEMERLUKAN VERIFIKASI.'],
  ['F-51', 'Operasi produksi (GitHub Pages + proyek Supabase produksi)', 'Penerapan', '—', 'BLOCKED', 'UAT-38 BLOCKED', 'Belum ada bukti data/konfigurasi produksi yang dapat diperiksa.'],
  ['F-52', 'Mode demo (?demo=1) dan data contoh [DEMO]', 'Inti · api.js', '—', 'NOT APPLICABLE', 'e2e.js', 'Untuk demonstrasi/pengujian, bukan kapabilitas operasional.']];

const TEMA = [
  ['ID tema (kode)', 'bentenan', 'navy', 'aksesibel'],
  ['Nama di aplikasi', 'Bentenan Merah & Putih', 'Navy & Putih', 'Aksesibel (ramah buta warna)'],
  ['Deskripsi di aplikasi (kutipan)', '"Identitas utama: merah, putih, dan motif tenun Bentenan Sulawesi Utara."', '"Navy berkelas dengan motif Bentenan; kontras tinggi dan tenang untuk kerja panjang."', '"Kontras tinggi, warna aman untuk buta warna, setiap status punya ikon, label, dan pola."'],
  ['Warna utama (CSS)', '#B8202E (merah), navy #253247, latar gading', '#1F3A68 (navy), aksen #C2333F; sidebar #13213A', '#0B3D91; status palet Okabe–Ito: #0072B2, #E69F00, #D55E00, ungu #5A1A72'],
  ['Perlakuan khusus', 'Motif bentenan.svg; tema bawaan', 'Motif bentenan-navy.svg; tombol lapor tetap merah', 'Huruf 16,5 px, tautan bergaris bawah, cincin fokus hitam-kuning, batas 2 px, pola arsir pada sel matriks dan grafik'],
  ['Varian gelap', 'Ya (prefers-color-scheme/data-theme)', 'Ya', 'Tidak ada varian gelap khusus — DATA BELUM TERSEDIA — MEMERLUKAN VERIFIKASI'],
  ['Penyimpanan pilihan', 'localStorage k3_skema per peramban', 'Sama', 'Sama'],
  ['Bukti teknis', 'e2e.js; tangkapan nyata', 'e2e.js (navy diterapkan); tangkapan nyata', 'Tangkapan nyata; /uji-warna (simulasi)'],
  ['Bukti evaluasi pengguna', 'Tidak ada', 'Tidak ada ("tenang untuk kerja panjang" adalah klaim desain, belum diuji)', 'Tidak ada (komentar CSS menyebut "WCAG 2.2 AA" — belum diverifikasi dengan pengukuran)']];

// Tahap K3 (a)–(d)
const TAHAP = [
  ['(a) Pelaporan/pencatatan bahaya', 'Pelapor (semua peran)', 'F-06, F-07, F-08, F-09, F-10, F-23, F-24, F-25, F-42', 'Laporan bernomor, status "baru"; kode lacak bila anonim', 'Dasbor: "Tercatat, belum ditugaskan"', 'D1 (sebagian)'],
  ['(b) Penetapan penanggung jawab', 'PJ unit, K3RS', 'F-12, F-13, F-14, F-31', 'Satu PJ dan target tanggal (wajib oleh trigger untuk status lanjut)', 'Dasbor: "Ditugaskan, belum ada tindakan"; "Tanpa penanggung jawab"; "Tanpa tanggal target"', 'D2, D3'],
  ['(c) Tindak lanjut pengendalian', 'PJ unit', 'F-15, F-26, F-27, F-28, F-29, F-30', 'Tindak lanjut dengan level hierarki dan bukti; status "dalam tindak lanjut"/"terkendali sementara"', 'Dasbor: "Ditangani, belum ditutup"; "Pengendalian baru APD/administratif"', 'D2, D4'],
  ['(d) Pemantauan status penyelesaian', 'K3RS, PJ unit', 'F-16, F-17, F-18, F-20, F-22, F-21, F-33', 'Status "tertutup" (K3RS) atau "terkendali sementara"; riwayat dan jejak audit; rekap bulanan', 'Dasbor: "Terkendali sementara", "Tertutup", "Tidak dilanjutkan"', 'D2, D3, D4']];

const HILANG = [
  ['Tangkapan layar', 'Tangkapan nyata tiga tema (beranda, dasbor, tugas, halaman tema) — sudah diambil untuk dokumen ini dari lingkungan uji lokal (data [DEMO]).', 'Tersedia'],
  ['Tangkapan layar', 'Detail laporan dengan daftar periksa D2/D3/D4, penolakan penutupan tanpa bukti fisik, /pengaturan (ekspor konfigurasi replikasi), /qr, /log, /asisten, /intel, /uji-warna, /pemantauan, /lacak, alur offline.', 'SCREENSHOT REQUIRED — BELUM TERSEDIA (dapat diambil dari lingkungan uji lokal pada tahap berikut)'],
  ['Tangkapan layar', 'Seluruh layar dari lingkungan produksi (URL publik + Supabase produksi).', 'SCREENSHOT REQUIRED — BELUM TERSEDIA (memerlukan akses/izin pemilik)'],
  ['Tangkapan layar', 'Tampilan pada ponsel nyata dan mode gelap ketiga tema.', 'SCREENSHOT REQUIRED — BELUM TERSEDIA'],
  ['Bukti produksi', 'Versi yang berjalan di produksi, status migrasi SQL, Edge Function, jadwal pg_cron, pemicu Apps Script.', 'DATA BELUM TERSEDIA — MEMERLUKAN VERIFIKASI'],
  ['Definisi penelitian', 'Rumusan final D1–D5 oleh peneliti (draf 2.7.3 menyatakan masih akan ditulis; D5 bertanda [PERLU KEPUTUSAN]).', 'NOT YET ESTABLISHED'],
  ['Ambang penerimaan', 'Ambang untuk indikator fitur (mis. ketepatan aturan penutupan, kelengkapan isian).', 'PROPOSED CRITERION — MEMERLUKAN VALIDASI PENELITI'],
  ['Keselarasan judul', 'Draf disertasi menyebut "aplikasi mobile K3 berbasis low code"; HSE Project ditulis tangan (JavaScript, hand-coded) di atas backend terkelola.', 'Perlu keputusan peneliti'],
  ['Metodologi usability', 'Draf menetapkan TAM3/SUS tidak dipakai (keputusan C-2); evaluasi usability tema tidak dapat diklaim.', 'NOT APPLICABLE kecuali peneliti menyetujui metode'],
  ['Status data UAT', 'UAT persona memakai data sintetis SIMULASI_UAT, persona simulasi, tanggal skenario 25 Sep–16 Okt 2026, dijalankan 10 Nov 2026.', 'Bukti fungsional, bukan evaluasi lapangan']];

const OPDEF_KOL = ['No', 'Feature ID', 'Feature/Variable', 'Operational Definition', 'Main Function', 'Intended User', 'How to Use', 'Required Input', 'Expected Output', 'Advantages', 'Why Necessary', 'Research Problem', 'Design Principle', 'Evaluation Indicator', 'Measurement Method', 'Success/Acceptance Criteria', 'Evidence Source', 'Implementation Status'];
const OPDEF_CONTOH = [
  ['1', 'F-13', 'Penetapan penanggung jawab', 'Tindakan PJ unit/K3RS menetapkan tepat satu pengguna sebagai PJ dan satu target tanggal pada laporan, tercatat di kolom pj_id dan target_tanggal.', 'Memastikan tiap butir punya pemilik dan tenggat', 'PJ unit, K3RS', 'Buka laporan → Tugaskan → pilih PJ dan tanggal → Simpan', 'Laporan berstatus baru; PJ; tanggal', 'Status "ditugaskan"; entri riwayat', 'Penolakan oleh basis data bila PJ/tanggal kosong', 'Menutup titik putus tahap (b)', 'RM2', 'D2, D3', 'Proporsi laporan berstatus lanjut yang memiliki PJ dan tanggal', 'Kueri basis data atas data uji; uji trigger', 'PROPOSED CRITERION — MEMERLUKAN VALIDASI PENELITI', 'UAT-18; trg_laporan_aturan', 'IMPLEMENTED AND VERIFIED'],
  ['2', 'F-16', 'Penutupan sah', 'Perubahan status ke "tertutup" yang diterima sistem hanya bila dilakukan K3RS, ada PJ, ada tindak lanjut level eliminasi/substitusi/rekayasa, dan ada bukti (teks ≥5 karakter atau foto).', 'Mencegah penutupan administratif', 'K3RS', 'Detail laporan → Ubah status → Tertutup', 'Tindak lanjut + bukti', 'Status "tertutup" atau pesan penolakan', 'Aturan ditegakkan di server, tidak hanya di antarmuka', 'Membedakan pengendalian fisik dari sementara', 'RM3/RM4', 'D2, D4', 'Ketepatan keputusan terima/tolak pada set kasus uji', 'Uji skenario berpasangan (valid/tidak valid)', 'PROPOSED CRITERION — MEMERLUKAN VALIDASI PENELITI', 'e2e.js; e2e_supabase.js; 01_setup.sql', 'IMPLEMENTED AND VERIFIED']];

const SELARAS = [
  ['RM1 / T1 (kesenjangan kebijakan–pelaksanaan)', 'E2, E1', 'Tidak langsung: F-20 (kesenjangan catatan) menampilkan pola, tetapi evaluasi RM1 berbasis E2, bukan aplikasi', 'K6', 'Lemah (pendukung)'],
  ['RM2 / T1 (alur, peran, titik putus)', 'E2, E3', 'F-13, F-14, F-20 (titik putus empat tahap), F-18', 'K2', 'Kuat'],
  ['RM3 / T2 (prinsip desain dari hambatan)', 'E3, E2', 'F-07/F-08 (D1 sebagian), F-13 (D2, D3), F-15/F-16 (D2, D4), F-17', 'K2 (100% fitur terlacak)', 'Kuat untuk D2–D4; sebagian untuk D1'],
  ['RM4 / T3 (konformansi, ketahanan, sensitivitas)', 'E2', 'F-10, F-21 relevan dengan pemetaan register; K1/K3/K4 dinilai pada E2, bukan pada aplikasi', 'K1, K3, K4', 'NOT YET ESTABLISHED untuk aplikasi'],
  ['RM5 / T4 (paket replikasi)', 'E4', 'F-40 (ekspor konfigurasi replikasi); D5 bertanda [PERLU KEPUTUSAN]', 'K5', 'Sebagian'],
  ['DSR (embedded single-case, ex-ante artificial evaluation)', 'E1–E4', 'Aplikasi sebagai artefak instansiasi; UAT persona = demonstrasi fungsional, bukan uji lapangan', '—', 'Perlu penegasan bab metodologi']];

const UKUR = [
  ['Fungsional', 'Apakah fitur berperilaku sesuai spesifikasi?', 'Skenario uji otomatis dan UAT (PASS/FAIL/BLOCKED)', 'Matriks uji, log uji', 'PROPOSED CRITERION — MEMERLUKAN VALIDASI PENELITI'],
  ['Kualitas data', 'Kelengkapan dan konsistensi isian wajib (PJ, tanggal, bukti, level pengendalian)', 'Kueri basis data atas data uji; tidak memakai data produksi tanpa izin', 'Hasil kueri', 'PROPOSED CRITERION — MEMERLUKAN VALIDASI PENELITI'],
  ['Keterlacakan (K2)', 'Apakah tiap fitur terlacak ke hambatan/prinsip/RM?', 'Matriks keterlacakan fitur–prinsip–RM', 'Tabel keterlacakan', 'K2 dari draf: 100% fitur terlacak (ambang milik draf)'],
  ['Integrasi', 'Apakah data mengalir antarmodul (laporan→investigasi→CAPA; JSA→PTW; Sheets)?', 'Uji ujung-ke-ujung', 'e2e_supabase.js', 'PROPOSED CRITERION — MEMERLUKAN VALIDASI PENELITI'],
  ['Keamanan', 'Apakah akses dibatasi sesuai peran dan identitas pelapor anonim tidak tersimpan?', 'Uji RLS, uji constraint; audit keamanan terpisah', 'tests/db', 'Lulus uji ≠ aman; audit independen belum ada'],
  ['Aksesibilitas visual tema', 'Rasio kontras warna teks/latar per tema', 'Pengukuran teknis rasio kontras (tanpa responden)', 'Perhitungan dari token CSS', 'PROPOSED CRITERION — MEMERLUKAN VALIDASI PENELITI'],
  ['Usability', 'Kemudahan penggunaan', 'Hanya bila metodologi disetujui peneliti (draf mengecualikan TAM3/SUS)', '—', 'NOT APPLICABLE saat ini']];

const KEPUTUSAN = [
  'Setujui atau koreksi definisi tujuh kelas status dan penetapan status pada Tabel 3 (terutama F-08, F-17, F-40, F-43).',
  'Tetapkan apakah bukti UAT persona (data sintetis) boleh dipakai sebagai sumber bukti fungsional di dokumen akhir, dengan label yang jelas.',
  'Berikan rumusan final D1–D5 atau izinkan pemakaian rumusan kandidat dari Tabel 3.4 draf dengan label "kandidat".',
  'Tentukan ambang penerimaan untuk indikator yang belum memiliki ambang (atau biarkan berlabel PROPOSED CRITERION).',
  'Tentukan sikap terhadap ketidaksesuaian istilah "berbasis low code" pada judul disertasi.',
  'Tentukan apakah tangkapan layar produksi diperlukan; bila ya, sediakan akses atau ambil sendiri dengan akun uji.',
  'Konfirmasi bahwa dokumen akhir memakai lingkungan uji lokal (data [DEMO]) untuk seluruh tangkapan layar.'];

// ===================== SUSUN =====================
const L_P = 9026, L_L = 13958; // lebar isi A4 potret/lanskap (margin 1440)
const potret = { page: { size: { width: 11906, height: 16838 }, margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } } };
const lanskap = { page: { size: { width: 11906, height: 16838, orientation: PageOrientation.LANDSCAPE }, margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } } };
const kaki = { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: UK })] })] }) };
const rekap = FITUR.reduce((a, f) => (a[f[4]] = (a[f[4]] || 0) + 1, a), {});

const s1 = [
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 2400, after: 240, line: 360 }, children: runs('LAPORAN PENDAHULUAN', { bold: true }) }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 240, line: 360 }, children: runs('PEMETAAN AWAL UNTUK DOKUMENTASI KOMPREHENSIF APLIKASI HSE PROJECT: FITUR, ALUR KERJA, DESAIN UI/UX, PANDUAN PENGGUNAAN, DAN DEFINISI OPERASIONAL', { bold: true }) }),
  P('Tahap pertama sesuai butir 17 permintaan: pemetaan awal untuk diverifikasi sebelum dokumen akhir disusun.', { align: AlignmentType.CENTER }),
  P('Versi aplikasi yang diperiksa: 2.2.0 (cabang kerja repositori). Tanggal pemeriksaan: 10 November 2026.', { align: AlignmentType.CENTER }),
  P('Status dokumen: DRAF UNTUK VERIFIKASI PENELITI — bukan dokumen akhir.', { align: AlignmentType.CENTER, bold: true }),
  new Paragraph({ pageBreakBefore: true, alignment: AlignmentType.CENTER, children: runs('DAFTAR ISI', { bold: true }), spacing: { after: 200 } }),
  new TableOfContents('Daftar Isi', { hyperlink: true, headingStyleRange: '1-2' }),
  P('(Perbarui bidang daftar isi di Word: klik kanan → Update Field.)'),

  H1('A. Gambaran Umum Aplikasi'),
  P('HSE Project adalah aplikasi web progresif (Progressive Web App) untuk pencatatan dan tindak lanjut bahaya keselamatan dan kesehatan kerja (K3) rumah sakit. Antarmuka ditulis dengan JavaScript tanpa kerangka kerja (hand-coded) dan dilayani sebagai berkas statis; data, autentikasi, dan aturan akses berada di layanan basis data terkelola (PostgreSQL dengan Row Level Security, fungsi dan trigger). Sinkron ke Google Sheets memakai Apps Script; notifikasi email/push disiapkan sebagai Edge Function tetapi belum dipasang.', { indent: true }),
  P('Peran pengguna di kode: petugas (pelapor), pj_unit (penanggung jawab unit), dan k3rs (Komite/Koordinator K3, wajib MFA tingkat aal2). Peran Admin Utama hanya ada sebagai berkas SQL usulan.', { indent: true }),
  P('**Dasar bukti pemetaan ini**: (1) kode sumber versi 2.2.0; (2) uji otomatis (tests/db, tests/browser, tests/sheets, tests/notifikasi) di lingkungan uji lokal PostgreSQL 16 dengan emulator; (3) UAT persona 38 kasus dengan data sintetis SIMULASI_UAT (30 PASS, 5 FAIL, 3 BLOCKED); (4) tangkapan layar nyata dari lingkungan uji lokal dengan data [DEMO]. Tidak ada bukti dari lingkungan produksi yang diperiksa; seluruh klaim "terverifikasi" dalam laporan ini berarti terverifikasi di lingkungan uji.', { indent: true }),
  P('**Batasan**: dokumen ini tidak menyatakan aplikasi efektif menurunkan risiko, tidak menyatakan aplikasi aman hanya karena ada login dan peran, dan tidak menyamakan status "tertutup" dengan hilangnya risiko di tempat kerja.', { indent: true }),

  H1('B. Inventaris Tiga Tema'),
  P('Tiga tema ditemukan di kode (konstanta SKEMA di js/app.js dan blok CSS 9c–9d). Tema dipilih sebelum masuk atau di halaman Akun dan disimpan per peramban. Tidak ada bukti evaluasi pengguna untuk ketiga tema; perbandingan di bawah bersifat deskriptif.', { indent: true }),
  CapT('Inventaris dan perbandingan tiga tema'),
  tabel(['Aspek', 'Tema 1', 'Tema 2', 'Tema 3'], TEMA.map(r => r), [2000, 2342, 2342, 2342]),
  Sumber('js/app.js baris 314–316; css/app.css blok 9c–9d; e2e.js.'),
  ...['bentenan', 'navy', 'aksesibel'].flatMap((t, i) => [gambar('TEMA_' + t + '_dasbor.jpg'), CapG('Dasbor dengan tema ' + TEMA[1][i + 1] + ' (tangkapan nyata, lingkungan uji lokal, akun PJ IPSRS, data [DEMO])')]),
  P('Tangkapan tambahan per tema (beranda, tugas, halaman pilih tema) telah disimpan di docs/dokumentasi/tangkapan/ dan akan dipakai di dokumen akhir.', { indent: true }),
];

const s2 = [
  H1('C. Inventaris Fitur Lengkap'),
  P('Definisi kelas status yang dipakai:'),
  CapT('Definisi kelas status implementasi'),
  tabel(['Status', 'Definisi kerja dalam dokumen ini'], STATUS_DEF, [3600, 10358], 0),
  P('Rekap: ' + Object.entries(rekap).map(([k, v]) => k + ' = ' + v).join('; ') + ' (total ' + FITUR.length + ' butir).'),
  CapT('Inventaris fitur dan status implementasi'),
  tabel(['ID', 'Fitur', 'Modul · rute', 'Peran', 'Status', 'Sumber bukti', 'Catatan'], FITUR, [700, 3200, 1900, 1200, 2000, 2558, 2400], 4),
  Sumber('Kode sumber v2.2.0; tests/; docs/uat/lampiran/matriks_pengujian_fungsional.csv.'),

  H1('D. Pemetaan Awal Alur Kerja Empat Tahap'),
  CapT('Pemetaan fitur ke empat tahap alur K3'),
  tabel(['Tahap', 'Aktor', 'Fitur', 'Keluaran tercatat', 'Titik putus yang terlihat di dasbor', 'Prinsip terkait'], TAHAP, [2300, 1500, 2600, 2900, 2858, 1800]),
  Sumber('trg_laporan_aturan (supabase/01_setup.sql); hDasbor (js/app.js).'),
  P('Catatan: pemetaan prinsip D1–D5 memakai rumusan kandidat dari Tabel 3.4 draf disertasi; rumusan final belum ditetapkan peneliti.'),
];

const s3 = [
  H1('E. Dokumentasi dan Tangkapan Layar yang Belum Tersedia'),
  CapT('Daftar kekurangan bukti'),
  tabel(['Jenis', 'Uraian', 'Status'], HILANG, [1800, 4600, 2626]),
  H1('F. Struktur Awal Tabel Definisi Operasional'),
  P('Tabel induk di dokumen akhir memakai 18 kolom sesuai permintaan, satu baris per fitur (F-01 sampai F-52), dicetak lanskap. Kolom: ' + OPDEF_KOL.join(', ') + '.', { indent: true }),
  P('Dua baris contoh di bawah menunjukkan cara pengisian; nilai ambang sengaja tidak diisi angka sampai divalidasi peneliti.', { indent: true }),
];
const s4 = [
  CapT('Contoh pengisian tabel definisi operasional (2 baris)'),
  tabel(OPDEF_KOL.slice(0, 9), OPDEF_CONTOH.map(r => r.slice(0, 9)), [500, 800, 1300, 2700, 1700, 1100, 1900, 1500, 2458]),
  CapT('Contoh pengisian tabel definisi operasional (lanjutan)'),
  tabel(['No', ...OPDEF_KOL.slice(9)], OPDEF_CONTOH.map(r => [r[0], ...r.slice(9)]), [500, 1700, 1500, 900, 900, 1900, 1700, 1958, 1700, 1200]),
  H1('G. Matriks Keselarasan dengan Disertasi'),
  CapT('Keselarasan fitur dengan RM, tujuan, bukti, dan kriteria'),
  tabel(['RM / Tujuan', 'Bukti (E)', 'Fitur terkait', 'Kriteria (K)', 'Kekuatan keselarasan'], SELARAS, [3300, 1300, 5258, 1900, 2200]),
  Sumber('Draft_Disertasi_K3_ODSK_Final.docx (RM1–RM5, T1–T4, E1–E4, K1–K6, Tabel 3.4).'),
  H1('H. Usulan Kerangka Pengukuran dan Evaluasi'),
  CapT('Usulan dimensi evaluasi fitur'),
  tabel(['Dimensi', 'Pertanyaan', 'Metode', 'Sumber bukti', 'Kriteria'], UKUR, [2000, 3400, 3500, 2058, 3000]),
  P('Evaluasi ini menilai artefak (apakah aturan dan fungsi bekerja seperti dirancang), selaras dengan evaluasi ex-ante artificial evaluation pada draf. Kerangka ini tidak mengukur efektivitas di tempat kerja.', { indent: true }),
  H2('Keputusan yang diperlukan dari peneliti sebelum dokumen akhir'),
  ...KEPUTUSAN.map(B)];

const doc = new Document({ creator: 'HSE Project', title: 'Laporan Pendahuluan Dokumentasi HSE Project',
  styles: { default: { document: { run: { font: FONT, size: UK } } }, paragraphStyles: [{ id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', run: { font: FONT, size: UK, bold: true, color: '000000' } }, { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', run: { font: FONT, size: UK, bold: true, color: '000000' } }] },
  numbering: { config: [{ reference: 'poin', levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 567, hanging: 360 } } } }] }] },
  sections: [{ properties: potret, footers: kaki, children: s1 }, { properties: lanskap, footers: kaki, children: s2 }, { properties: potret, footers: kaki, children: s3 }, { properties: lanskap, footers: kaki, children: s4 }] });
Packer.toBuffer(doc).then(b => { fs.mkdirSync(path.dirname(KELUAR), { recursive: true }); fs.writeFileSync(KELUAR, b); console.log('ok', KELUAR, b.length, rekap); });
