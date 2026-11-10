// Penyusun dokumen akhir: Dokumentasi Komprehensif Aplikasi HSE Project (fitur aktif/tersedia saja).
// node susun_dokumen_akhir.js <dir_rekam (manifest.json)> <dir_triptik (jpg + dims.json)> <keluar.docx>
const fs = require('fs'), path = require('path');
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, ShadingType, AlignmentType, HeadingLevel, PageOrientation, ImageRun, BorderStyle, LevelFormat, Footer, PageNumber, TableOfContents, VerticalAlign } = require('docx');
const { F, GRUP, IAV, ABNFT, PF, PC } = require('./data_fitur.js');
const [REKAM, TRIP, KELUAR] = process.argv.slice(2);
const ROOT = path.resolve(__dirname, '../..');
const MAN = JSON.parse(fs.readFileSync(path.join(REKAM, 'manifest.json'), 'utf8'));
const DIMS = JSON.parse(fs.readFileSync(path.join(TRIP, 'dims.json'), 'utf8'));
const LANGKAH = Object.fromEntries(MAN.map(m => [m.id, m.langkah.filter(l => !l.gagal && DIMS[l.kode])]));
const FONT = 'Times New Roman', UK = 24;

// ---------- Istilah asing (dicetak miring) ----------
const INGGRIS = ['Progressive Web App', 'Row Level Security', 'Edge Function', 'Permit to Work', 'Stop Work Authority', 'Job Safety Analysis', 'Root Cause Analysis', 'Corrective and Preventive Action', 'toolbox meeting',
  'Design Science Research', 'User Acceptance Testing', 'end-to-end', 'screenshot', 'dashboard', 'login', 'offline', 'online', 'frontend', 'backend', 'server', 'browser', 'headless', 'risk register', 'traceability', 'usability',
  'low code', 'frugal innovation', 'hand-coded', 'service worker', 'smoke test', 'emulator', 'Web Speech API', 'audit trail', 'pre-test', 'post-test', 'checklist', 'dark mode', 'IMPLEMENTED AND VERIFIED', 'PARTIALLY FUNCTIONAL',
  'AVAILABLE BUT NOT FULLY TESTED', 'NOT YET ESTABLISHED', 'PROPOSED CRITERION', 'PASS', 'FAIL', 'BLOCKED', 'Apps Script', 'spreadsheet', 'Operational Definition', 'Feature ID', 'Main Function', 'Intended User', 'How to Use',
  'Required Input', 'Expected Output', 'Advantages', 'Why Necessary', 'Research Problem', 'Design Principle', 'Evaluation Indicator', 'Measurement Method', 'Success/Acceptance Criteria', 'Evidence Source', 'Implementation Status',
  'Feature/Variable', 'No', 'ex-ante', 'artificial evaluation', 'single-case', 'embedded', 'Fishbone', 'Five Why', '5 Why', 'Safety First', 'upload', 'download', 'hash routing', 'repository', 'commit', 'scenario-based testing', 'Multi-Factor Authentication',
  'Authenticator Assurance Level', 'Open-Meteo', 'Open Source', 'open source', 'near miss', 'Lockout/Tagout', 'Okabe–Ito', 'Web Content Accessibility Guidelines', 'contrast ratio', 'viewport', 'deviceScaleFactor', 'Playwright', 'Chromium',
  'Time-based One-Time Password', 'free tier', 'cloud', 'mobile', 'mobile-first', 'tap target', 'progressive disclosure', 'affordance', 'feedback', 'error prevention', 'heatmap', 'nascent design theory', 'Hazard Identification and Risk Assessment', 'Safety Data Sheet'];
const pola = new RegExp('(?<![\\p{L}\\d-])(' + INGGRIS.sort((a, b) => b.length - a.length).map(x => x.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')).join('|') + ')(?![\\p{L}\\d])', 'gu');
function runs(teks, o = {}) {
  teks = String(teks ?? ''); const out = []; let i = 0; const r = (t, it) => new TextRun({ text: t, font: FONT, size: UK, bold: o.bold, italics: it });
  for (const m of teks.matchAll(pola)) { if (m.index > i) out.push(r(teks.slice(i, m.index), o.italics)); out.push(r(m[0], !o.italics)); i = m.index + m[0].length; }
  if (i < teks.length) out.push(r(teks.slice(i), o.italics)); return out;
}
const tebal = (t, o = {}) => String(t).split(/(\*\*[^*]+\*\*)/).filter(Boolean).flatMap(s => s.startsWith('**') ? runs(s.slice(2, -2), Object.assign({}, o, { bold: true })) : runs(s, o));
const P = (t, o = {}) => new Paragraph({ children: tebal(t, o), alignment: o.align || AlignmentType.JUSTIFIED, spacing: { line: 360, before: o.before || 0, after: o.after ?? 120 }, indent: o.indent ? { firstLine: 567 } : undefined, keepNext: o.keepNext, keepLines: true });
const H1 = (t, putus = true) => new Paragraph({ heading: HeadingLevel.HEADING_1, children: t.split('\n').flatMap((x, i) => i ? [new TextRun({ break: 1, font: FONT, size: UK }), ...runs(x, { bold: true })] : runs(x, { bold: true })), alignment: AlignmentType.CENTER, spacing: { before: 240, after: 240, line: 360 }, pageBreakBefore: putus, keepNext: true });
const H2 = t => new Paragraph({ heading: HeadingLevel.HEADING_2, children: runs(t, { bold: true }), spacing: { before: 240, after: 120, line: 360 }, keepNext: true });
const H3 = (t, putus) => new Paragraph({ heading: HeadingLevel.HEADING_3, children: runs(t, { bold: true }), spacing: { before: 200, after: 100, line: 360 }, keepNext: true, pageBreakBefore: !!putus });
const SUB = t => new Paragraph({ children: runs(t, { bold: true }), spacing: { before: 120, after: 60, line: 360 }, keepNext: true });
let nDaftar = 0;
const daftarAngka = arr => { nDaftar++; return arr.map(t => new Paragraph({ children: tebal(t), numbering: { reference: 'angka', level: 0, instance: nDaftar }, alignment: AlignmentType.JUSTIFIED, spacing: { line: 360, after: 40 } })); };
const B = t => new Paragraph({ children: tebal(t), numbering: { reference: 'poin', level: 0 }, alignment: AlignmentType.JUSTIFIED, spacing: { line: 360, after: 40 } });
let nTabel = 0, nGambar = 0; const DAFTAR_GAMBAR = [], DAFTAR_TABEL = [];
const CapT = t => { nTabel++; DAFTAR_TABEL.push(['Tabel ' + nTabel, t]); return new Paragraph({ children: runs('Tabel ' + nTabel + '. ' + t, { bold: true }), alignment: AlignmentType.CENTER, spacing: { before: 200, after: 100, line: 360 }, keepNext: true }); };
const CapG = (t, kode) => { nGambar++; DAFTAR_GAMBAR.push(['Gambar ' + nGambar, t, kode || '']); return new Paragraph({ children: runs('Gambar ' + nGambar + '. ' + t, { bold: true }), alignment: AlignmentType.CENTER, spacing: { before: 60, after: 80, line: 360 }, keepNext: true }); };
const Sumber = t => new Paragraph({ children: runs('Sumber: ' + t), alignment: AlignmentType.LEFT, spacing: { after: 200, line: 360 } });
const garis = { style: BorderStyle.SINGLE, size: 4, color: '808080' };
const WARNA = { [IAV]: 'E2EFDA', [PF]: 'FCE4D6', [ABNFT]: 'FFF2CC' };
function tabel(kepala, baris, lebar, kolStatus) {
  const sel = (t, kep, w, warna) => new TableCell({ width: { size: w, type: WidthType.DXA }, verticalAlign: VerticalAlign.TOP, margins: { top: 40, bottom: 40, left: 80, right: 80 }, borders: { top: garis, bottom: garis, left: garis, right: garis },
    shading: kep ? { type: ShadingType.CLEAR, fill: 'D9D9D9', color: 'auto' } : warna ? { type: ShadingType.CLEAR, fill: warna, color: 'auto' } : undefined,
    children: String(t ?? '').split('\n').map(x => new Paragraph({ children: tebal(x, { bold: kep }), alignment: kep ? AlignmentType.CENTER : AlignmentType.LEFT, spacing: { line: 240, after: 0 } })) });
  return new Table({ width: { size: lebar.reduce((a, b) => a + b, 0), type: WidthType.DXA }, columnWidths: lebar,
    rows: [new TableRow({ tableHeader: true, cantSplit: true, children: kepala.map((k, i) => sel(k, true, lebar[i])) })].concat(baris.map(r => new TableRow({ cantSplit: true, children: r.map((c, i) => sel(c, false, lebar[i], i === kolStatus ? WARNA[String(c).split('\n')[0]] : undefined)) }))) });
}
function gambarFile(f, lebarCm, w, h) { const lebar = Math.round(lebarCm / 2.54 * 96); return new Paragraph({ alignment: AlignmentType.CENTER, keepNext: true, spacing: { before: 120, after: 40 }, children: [new ImageRun({ type: 'jpg', data: fs.readFileSync(f), transformation: { width: lebar, height: Math.round(lebar * h / w) } })] }); }

// ---------- Kontras warna (pengukuran teknis dari token CSS, bukan evaluasi pengguna) ----------
const lum = hx => { const c = [1, 3, 5].map(i => parseInt(hx.slice(i, i + 2), 16) / 255).map(v => v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const kontras = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const KONTRAS = [
  ['Bentenan Merah & Putih', 'Teks utama #343A40 di latar #FAF9F7', '#343A40', '#FAF9F7'], ['Bentenan Merah & Putih', 'Teks sekunder #646B76 di latar #FAF9F7', '#646B76', '#FAF9F7'], ['Bentenan Merah & Putih', 'Teks putih di tombol utama #B8202E', '#FFFFFF', '#B8202E'],
  ['Navy & Putih', 'Teks utama #343A40 di latar #FAF9F7', '#343A40', '#FAF9F7'], ['Navy & Putih', 'Teks putih di tombol utama #1F3A68', '#FFFFFF', '#1F3A68'], ['Navy & Putih', 'Teks putih di tombol lapor #C2333F', '#FFFFFF', '#C2333F'],
  ['Aksesibel', 'Teks utama #111418 di latar #FFFFFF', '#111418', '#FFFFFF'], ['Aksesibel', 'Teks sekunder #3A3F47 di latar #FFFFFF', '#3A3F47', '#FFFFFF'], ['Aksesibel', 'Teks putih di tombol utama #0B3D91', '#FFFFFF', '#0B3D91']]
  .map(([t, d, a, b]) => { const r = kontras(a, b); return [t, d, r.toFixed(2) + ' : 1', r >= 7 ? 'Memenuhi 4,5 : 1 dan 7 : 1' : r >= 4.5 ? 'Memenuhi 4,5 : 1' : 'Di bawah 4,5 : 1']; });

// ---------- Halaman ----------
const L_P = 9026, L_L = 13958;
const potret = { page: { size: { width: 11906, height: 16838 }, margin: { top: 1440, bottom: 1440, left: 1701, right: 1440 } } };
const lanskap = { page: { size: { width: 11906, height: 16838, orientation: PageOrientation.LANDSCAPE }, margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } } };
const kaki = { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: UK })] })] }) };
const L_ISI = 11906 - 1701 - 1440; // lebar isi potret (twip)

const urut = GRUP.flatMap(g => g[1]);
const jumlahStatus = urut.reduce((a, id) => (a[F[id].status] = (a[F[id].status] || 0) + 1, a), {});
const totLangkah = urut.reduce((a, id) => a + (LANGKAH[id] || []).length, 0);

// =============== HALAMAN JUDUL & DAFTAR ISI ===============
const s0 = [
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 2000, after: 360, line: 360 }, children: runs('DOKUMENTASI KOMPREHENSIF APLIKASI HSE PROJECT:', { bold: true }) }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 600, line: 360 }, children: runs('FITUR, ALUR KERJA, DESAIN UI/UX, PANDUAN PENGGUNAAN, DAN DEFINISI OPERASIONAL', { bold: true }) }),
  P('Versi aplikasi yang didokumentasikan: 2.2.0', { align: AlignmentType.CENTER }),
  P('Lingkup: fitur yang tersedia dan aktif pada versi tersebut', { align: AlignmentType.CENTER }),
  P('Tangkapan layar: aplikasi asli, lingkungan uji lokal dengan data demonstrasi [DEMO], tiga tema tampilan', { align: AlignmentType.CENTER }),
  P('Tanggal penyusunan: 10 November 2026', { align: AlignmentType.CENTER, after: 1200 }),
  P('Dokumen pendukung penelitian disertasi (rancangan sistem K3 dengan aplikasi mobile berbasis inovasi frugal)', { align: AlignmentType.CENTER }),
  new Paragraph({ pageBreakBefore: true, alignment: AlignmentType.CENTER, children: runs('DAFTAR ISI', { bold: true }), spacing: { after: 200 } }),
  new TableOfContents('Daftar Isi', { hyperlink: true, headingStyleRange: '1-3' }),
  P('Catatan: bila daftar isi belum tampil, klik kanan pada daftar isi lalu pilih Update Field.', { before: 200 })];

// =============== BAB 1 ===============
const s1 = [
  H1('BAB 1\nPENDAHULUAN'),
  H2('1.1 Tujuan dokumen'),
  P('Dokumen ini menjelaskan setiap fitur HSE Project yang tersedia dan aktif pada versi 2.2.0: kegunaan, cara memakainya langkah demi langkah, tampilan pada tiga tema, masukan dan keluaran, kelebihan dan keterbatasannya, serta kaitannya dengan rumusan masalah, prinsip desain, dan kriteria evaluasi pada draf disertasi. Bagian akhir memuat tabel definisi operasional untuk setiap fitur dan kerangka evaluasinya.', { indent: true }),
  H2('1.2 Ruang lingkup'),
  P('Dokumen hanya memuat fitur yang tersedia dan dapat dijalankan pada versi 2.2.0. Seluruhnya berjumlah ' + urut.length + ' bagian fitur, didokumentasikan dalam ' + totLangkah + ' langkah, dan setiap langkah ditampilkan pada tiga tema (Bentenan Merah & Putih, Navy & Putih, dan Aksesibel). Dokumentasi berfokus pada tampilan luar aplikasi (antarmuka dan pengalaman pengguna); konfigurasi produksi tidak termasuk ruang lingkup.', { indent: true }),
  H2('1.3 Sumber bukti dan batasan'),
  P('Bukti yang dipakai adalah (1) kode sumber versi 2.2.0; (2) uji otomatis di lingkungan uji lokal (PostgreSQL 16 dengan emulator layanan basis data); (3) UAT berbasis persona dengan data sintetis berlabel SIMULASI_UAT, yang menurut keputusan peneliti boleh dipakai sebagai bukti fungsional dengan label yang jelas; dan (4) tangkapan layar aplikasi asli yang direkam otomatis dengan peramban Chromium pada tampilan ponsel 390 × 844 piksel.', { indent: true }),
  P('Seluruh data pada tangkapan layar adalah data demonstrasi berpenanda [DEMO] dan akun uji (domain demo.hse); tidak ada data pasien, pegawai, atau responden nyata. Bingkai kuning pada sebagian tangkapan layar adalah penanda dokumentasi yang menunjukkan elemen yang ditekan pada langkah tersebut; bingkai itu bukan bagian aplikasi. Data cuaca diambil langsung dari layanan publik Open-Meteo saat dokumentasi dibuat.', { indent: true }),
  P('**Batas klaim.** Dokumen ini tidak menyatakan bahwa aplikasi terbukti menurunkan risiko atau meningkatkan keselamatan; status "tertutup" pada aplikasi berarti syarat pencatatan terpenuhi, bukan bukti bahwa risiko di tempat kerja telah hilang. Keberadaan login, peran, dan RLS tidak cukup untuk menyatakan aplikasi aman. Tidak ada klaim bahwa salah satu tema meningkatkan produktivitas atau usability, karena belum ada evaluasi pengguna. Dokumen ini juga tidak menjamin publikasi ilmiah.', { indent: true }),
  H2('1.4 Kedudukan aplikasi sebagai inovasi frugal'),
  P('Sesuai keputusan peneliti, istilah "berbasis low code" pada draf disertasi diganti dengan "berbasis inovasi frugal" (frugal innovation). Dalam dokumen ini, inovasi frugal dipakai secara deskriptif untuk ciri-ciri yang dapat diperiksa pada kode dan arsitektur HSE Project, yaitu:', { indent: true }),
  B('berjalan di peramban ponsel yang sudah dimiliki pegawai sebagai Progressive Web App, tanpa perangkat khusus dan tanpa distribusi melalui toko aplikasi;'),
  B('antarmuka berupa berkas statis yang dapat dilayani dari hosting statis, sedangkan data dan aturan berada di layanan basis data terkelola;'),
  B('memakai komponen sumber terbuka dan layanan publik gratis (misalnya Open-Meteo untuk cuaca, pembaca PDF/DOCX dan OCR di perangkat);'),
  B('asisten dan analisis HSE Intelligence dihitung di perangkat dengan aturan lokal, tanpa layanan kecerdasan buatan berbayar;'),
  B('tetap dapat menyimpan laporan saat sinyal hilang (antrean luring) dan mencerminkan data ke Google Sheets yang sudah biasa dipakai.'),
  P('Ciri-ciri tersebut menggambarkan pilihan rancangan, bukan hasil evaluasi biaya. Perbandingan biaya dengan alternatif lain belum dilakukan dan berstatus NOT YET ESTABLISHED.', { indent: true }),
  H2('1.5 Konvensi status dan label'),
  CapT('Kelas status implementasi yang dipakai'),
  tabel(['Status', 'Arti dalam dokumen ini', 'Jumlah fitur'], [
    [IAV, 'Kode ada dan perilakunya lulus pengujian terdokumentasi (uji otomatis dan/atau kasus UAT berstatus PASS) di lingkungan uji lokal.', String(jumlahStatus[IAV] || 0)],
    [PF, 'Fitur berjalan, tetapi pengujian menemukan ketidaksesuaian dengan kebutuhan rumah sakit pada sebagian fungsinya.', String(jumlahStatus[PF] || 0)],
    [ABNFT, 'Kode ada dan dapat dijalankan (didokumentasikan pada dokumen ini), tetapi belum ada skenario uji yang memeriksa perilakunya secara sistematis.', String(jumlahStatus[ABNFT] || 0)]], [2900, 4365, 1500], 0),
  P('Label lain: PROPOSED CRITERION — MEMERLUKAN VALIDASI PENELITI untuk kriteria penerimaan yang belum ditetapkan peneliti; NOT YET ESTABLISHED untuk kaitan atau klaim yang belum dapat dibuktikan.', { before: 120 })];

// =============== BAB 2 ===============
const s2 = [
  H1('BAB 2\nGAMBARAN UMUM APLIKASI'),
  H2('2.1 Fungsi utama'),
  P('HSE Project adalah aplikasi web progresif untuk pencatatan dan tindak lanjut bahaya keselamatan dan kesehatan kerja (K3) di rumah sakit. Aplikasi mengikuti alur empat tahap: (a) pelaporan/pencatatan bahaya, (b) penetapan penanggung jawab, (c) tindak lanjut pengendalian, dan (d) pemantauan status penyelesaian. Di sekitar alur inti terdapat modul pendukung: inspeksi, JSA, pemantauan lingkungan, izin kerja, pelatihan dan toolbox meeting, investigasi dan CAPA, notifikasi, HSE Intelligence, pencarian, pustaka SOP, dan administrasi.', { indent: true }),
  H2('2.2 Arsitektur ringkas'),
  P('Antarmuka ditulis dengan JavaScript tanpa kerangka kerja dan dibuka melalui peramban. Data, autentikasi, dan aturan bisnis berada di basis data PostgreSQL terkelola; aturan penting (misalnya syarat penutupan laporan) ditegakkan oleh fungsi dan trigger di server sehingga tidak bergantung pada tombol di layar. Hak baca data dibatasi per peran dengan Row Level Security. Google Sheets dipakai sebagai cermin satu arah melalui Apps Script.', { indent: true }),
  H2('2.3 Peran pengguna'),
  CapT('Peran pengguna dan cakupan menunya'),
  tabel(['Peran', 'Siapa', 'Menu utama', 'Akun uji pada dokumen ini'], [
    ['Petugas', 'Pegawai unit yang melapor', 'Beranda, Lapor, Laporan saya, Lacak, Inspeksi, JSA, Izin kerja, Pelatihan & toolbox, Asisten, Bantuan', 'Demo Petugas Kesling; Demo Petugas Farmasi'],
    ['PJ unit', 'Penanggung jawab unit/instalasi', 'Menu petugas + Laporan unit, Tugas & CAPA, Dasbor, Ekspor, Laporan bulanan, Investigasi', 'Demo PJ IPSRS'],
    ['K3RS', 'Komite/Koordinator K3 rumah sakit (wajib MFA)', 'Semua menu, termasuk Administrasi: Pengguna & peran, Pengaturan, Google Sheets, Log aktivitas, Kode QR', 'Demo Koordinator K3; Demo Pengelola Insiden']], [1500, 2200, 3265, 1800]),
  Sumber('aturan rute dan menu pada js/app.js; akun uji basis data demo.'),
  H2('2.4 Navigasi'),
  P('Pada ponsel, navigasi bawah berisi lima tombol: Beranda, Lapor, Intelijen, Cari, dan Menu. Lonceng notifikasi berada di kanan atas, dan tombol asisten mengambang di kanan bawah. Pada layar lebar, menu tampil sebagai bilah samping. Seluruh tangkapan layar pada Bab 5 memakai tampilan ponsel karena aplikasi dirancang untuk dipakai di lapangan.', { indent: true })];

// =============== BAB 3 ===============
const TEMA = [['Bentenan Merah & Putih', 'bentenan', 'Identitas utama: merah, putih, dan motif tenun Bentenan Sulawesi Utara.', 'Merah #B8202E, navy #253247, latar gading #FAF9F7', 'Motif Bentenan merah; tema bawaan'],
  ['Navy & Putih', 'navy', 'Navy berkelas dengan motif Bentenan; kontras tinggi dan tenang untuk kerja panjang.', 'Navy #1F3A68, aksen merah #C2333F, bilah samping #13213A', 'Motif Bentenan navy; tombol lapor tetap merah'],
  ['Aksesibel (ramah buta warna)', 'aksesibel', 'Kontras tinggi, warna aman untuk buta warna, setiap status punya ikon, label, dan pola.', 'Biru #0B3D91; status palet Okabe–Ito (#0072B2, #E69F00, #D55E00, ungu #5A1A72)', 'Huruf 16,5 px, tautan bergaris bawah, cincin fokus hitam-kuning, batas 2 px, pola arsir pada sel matriks dan grafik']];
const UIUX = [
  ['Tombol LAPOR BAHAYA besar di beranda dan tombol Lapor di navigasi bawah', 'Memperpendek jalan menuju pelaporan', 'F-04, F-06', 'Tangkapan layar'],
  ['Delapan kartu jenis bahaya bergambar beserta contoh', 'Pelapor tidak perlu mengetahui istilah teknis', 'F-06', 'Tangkapan layar'],
  ['Isian wajib hanya unit dan jenis bahaya; keterangan lain dibuka bertahap (progressive disclosure)', 'Mengurangi beban mengisi di lapangan', 'F-06', 'UAT-05, UAT-09'],
  ['Status memakai simbol, teks, dan warna sekaligus (○ △ ◇ ✕ ✓)', 'Status tetap terbaca tanpa bergantung warna', 'Semua daftar; F-38', 'Simulasi buta warna'],
  ['Penanda tahap (Tercatat → PJ → Tindak lanjut → Tertutup) pada detail laporan', 'Memperlihatkan posisi butir pada alur empat tahap', 'F-13, F-16', 'Tangkapan layar'],
  ['Daftar periksa D2–D4 pada panel penutupan', 'Syarat penutupan terlihat sebelum server menolak', 'F-16', 'Kode; tangkapan layar'],
  ['Dialog konfirmasi sebelum aksi penting (tutup, hentikan, setujui)', 'Mencegah salah tekan (error prevention)', 'F-16, F-26, F-29', 'Tangkapan layar'],
  ['Peringatan identitas pasien sebelum kirim', 'Mencegah data pasien masuk catatan K3', 'F-42', 'UAT-11'],
  ['Mode inspeksi terpandu satu butir per layar dengan tombol besar', 'Dapat dipakai sambil berjalan', 'F-23', 'UAT-15'],
  ['Catatan "angka bukan ukuran keselamatan" di dasbor', 'Mencegah salah tafsir angka sebagai kinerja', 'F-20', 'Tangkapan layar'],
  ['Navigasi bawah pada ponsel dan bilah samping pada layar lebar', 'Tata letak menyesuaikan perangkat (mobile-first)', 'F-43', 'UAT-37 (360 px tanpa gulir samping)']];
const s3 = [
  H1('BAB 3\nTIGA TEMA DAN RASIONAL DESAIN UI/UX'),
  H2('3.1 Inventaris tiga tema'),
  P('Tiga tema ditemukan pada kode (daftar SKEMA di js/app.js dan blok CSS tema). Tema dipilih sebelum masuk atau melalui halaman Akun, lalu disimpan di perangkat. Perbandingan berikut bersifat deskriptif; tidak ada bukti evaluasi pengguna untuk ketiga tema.', { indent: true }),
  CapT('Perbandingan tiga tema'),
  tabel(['Aspek', ...TEMA.map(t => t[0])], [
    ['Deskripsi di aplikasi', ...TEMA.map(t => '"' + t[2] + '"')], ['Warna utama', ...TEMA.map(t => t[3])], ['Perlakuan khusus', ...TEMA.map(t => t[4])],
    ['Varian gelap', 'Ya', 'Ya', 'Tidak ada varian gelap khusus'], ['Penyimpanan pilihan', 'Di perangkat', 'Di perangkat', 'Di perangkat'], ['Bukti evaluasi pengguna', 'Belum ada', 'Belum ada', 'Belum ada']], [1900, 2288, 2288, 2289]),
  Sumber('js/app.js (SKEMA); css/app.css blok tema.'),
  ...TEMA.flatMap(t => [gambarFile(ROOT + '/docs/dokumentasi/tangkapan/TEMA_' + t[1] + '_dasbor.jpg', 14, 1280, 860), CapG('Dasbor pada layar lebar dengan tema ' + t[0] + ' (tangkapan nyata, akun Demo PJ IPSRS, data [DEMO])')]),
  H2('3.2 Pengukuran teknis kontras warna'),
  P('Rasio kontras dihitung dari kode warna pada CSS memakai rumus luminans relatif WCAG. Ini pengukuran teknis atas pasangan warna, bukan uji dengan pengguna; ambang 4,5 : 1 (teks normal) dan 7 : 1 (tingkat lebih ketat) dipakai sebagai rujukan standar, bukan kriteria penelitian.', { indent: true }),
  CapT('Rasio kontras pasangan warna utama per tema'),
  tabel(['Tema', 'Pasangan warna', 'Rasio', 'Terhadap rujukan WCAG'], KONTRAS, [2200, 3565, 1300, 1700]),
  Sumber('perhitungan dari token warna css/app.css.'),
  H2('3.3 Rasional desain UI/UX'),
  P('Tabel berikut menghubungkan keputusan desain yang terlihat pada antarmuka dengan alasannya. Kolom bukti menunjukkan di mana keputusan itu dapat diperiksa; tidak satu pun keputusan diklaim meningkatkan usability karena evaluasi pengguna belum dilakukan.', { indent: true }),
  CapT('Keputusan desain UI/UX dan alasannya'),
  tabel(['Keputusan desain', 'Alasan', 'Fitur', 'Bukti yang tersedia'], UIUX, [3300, 2765, 1200, 1500]),
  H2('3.4 Tampilan responsif (F-43)'),
  P('Aplikasi menyesuaikan tata letak dengan lebar layar: bilah samping pada layar lebar (Gambar 1–3) dan navigasi bawah pada ponsel (seluruh gambar Bab 5). UAT-37 mencatat tidak ada gulir horizontal pada lebar 360 piksel. Status fitur ini PARTIALLY FUNCTIONAL karena pemasangan sebagai aplikasi (PWA) dan cache luring belum diuji.', { indent: true })];

// =============== BAB 4 ===============
const TAHAP = [
  ['(a) Pelaporan/pencatatan bahaya', 'Pelapor (semua peran)', 'F-06, F-42, F-07, F-08, F-09, F-23, F-24, F-25', 'Laporan bernomor berstatus Baru; kode lacak bila anonim', '"Tercatat, belum ditugaskan"', 'D1 (sebagian)'],
  ['(b) Penetapan penanggung jawab', 'K3RS', 'F-13, F-14, F-31', 'Satu PJ, tanggal target, skor risiko; status Ditugaskan', '"Ditugaskan, belum ada tindakan"; "Tanpa penanggung jawab"; "Tanpa tanggal target"', 'D2, D3'],
  ['(c) Tindak lanjut pengendalian', 'PJ unit', 'F-15, F-26, F-27, F-28, F-29, F-30', 'Tindak lanjut bertingkat hierarki dengan bukti; status Sedang ditangani/Terkendali sementara', '"Ditangani, belum ditutup"; "Pengendalian baru APD/administratif"', 'D2, D4'],
  ['(d) Pemantauan status penyelesaian', 'K3RS, PJ unit', 'F-16, F-18, F-20, F-22, F-21, F-19', 'Status Tertutup (K3RS) atau Terkendali sementara; riwayat dan jejak', '"Terkendali sementara"; "Tertutup"; "Tidak dilanjutkan"', 'D2, D3, D4']];
const s4 = [
  H1('BAB 4\nALUR KERJA EMPAT TAHAP'),
  P('Alur inti aplikasi mengikuti empat tahap penanganan bahaya. Contoh lengkap satu laporan dari awal sampai tertutup didokumentasikan berurutan pada subbab 5.2.1 (pelaporan), 5.3.1 (penugasan), 5.3.3 (tindak lanjut), dan 5.3.4 (penutupan sah), termasuk penolakan server ketika penutupan hanya didukung pengendalian APD.', { indent: true }),
  CapT('Pemetaan fitur ke empat tahap alur'),
  tabel(['Tahap', 'Aktor', 'Fitur', 'Keluaran tercatat', 'Titik putus yang terlihat di dasbor', 'Prinsip'], TAHAP, [2000, 1300, 2300, 3200, 3358, 1800]),
  Sumber('trigger trg_laporan_aturan (supabase/01_setup.sql); dasbor (js/app.js).'),
  P('Aturan yang ditegakkan basis data pada alur ini: (1) status Ditugaskan, Sedang ditangani, Terkendali sementara, dan Tertutup memerlukan PJ dan tanggal target (D3); (2) status Tertutup hanya dapat ditetapkan K3RS dan memerlukan tindak lanjut tingkat eliminasi, substitusi, atau rekayasa dengan bukti (D2, D4); (3) status Terkendali sementara memerlukan sekurang-kurangnya satu tindak lanjut.', { indent: true, before: 120 })];

// =============== BAB 5 ===============
const s5 = [H1('BAB 5\nDOKUMENTASI FITUR DAN PANDUAN PENGGUNAAN'),
  P('Setiap subbab memuat ringkasan fitur, penjelasan, langkah penggunaan, masukan dan keluaran, kelebihan, keterbatasan, definisi operasional singkat, dan tangkapan layar setiap langkah. Setiap gambar menampilkan langkah yang sama pada tiga tema, dari kiri ke kanan: Bentenan Merah & Putih, Navy & Putih, dan Aksesibel. Penjelasan langkah ditulis di bawah gambar.', { indent: true }),
  P('Seluruh tangkapan layar diambil dari aplikasi versi 2.2.0 pada lingkungan uji lokal, tampilan ponsel 390 × 844 piksel, dengan data demonstrasi [DEMO], pada 10 November 2026. Basis data dipulihkan ke keadaan awal yang sama sebelum perekaman setiap tema sehingga isi ketiga kolom setara.', { indent: true })];
const LEBAR_TRIP = 15.0;
GRUP.forEach(([judul, ids], gi) => {
  s5.push(H2('5.' + (gi + 1) + ' ' + judul));
  ids.forEach((id, fi) => {
    const f = F[id], ls = LANGKAH[id] || [];
    s5.push(H3('5.' + (gi + 1) + '.' + (fi + 1) + ' ' + id + ' ' + f.nama, fi > 0));
    s5.push(tabel(['Atribut', 'Keterangan'], [['ID fitur', id], ['Menu / letak', f.modul], ['Peran pengguna', f.peran], ['Status implementasi', f.status], ['Bukti uji', f.bukti], ['Prinsip desain terkait', f.D], ['Rumusan masalah terkait', f.RM]], [2600, L_ISI - 2600], -1));
    s5.push(SUB('Penjelasan'), P(f.jelas, { indent: true }));
    if (ls.length) { s5.push(SUB('Langkah penggunaan')); s5.push(...daftarAngka(ls.map(l => l.judul + '.'))); }
    s5.push(SUB('Masukan dan keluaran'), P('Masukan: ' + f.input + '. Keluaran: ' + f.output + '.'));
    s5.push(SUB('Kelebihan'), P(f.kelebihan), SUB('Keterbatasan'), P(f.batas));
    s5.push(SUB('Definisi operasional'), P(f.opdef.def));
    ls.forEach((l, i) => {
      const [w, h] = DIMS[l.kode];
      s5.push(gambarFile(path.join(TRIP, l.kode + '.jpg'), LEBAR_TRIP, w, h));
      s5.push(CapG(id + ' langkah ' + (i + 1) + ' — ' + l.judul, l.kode));
      s5.push(P(l.ket, { indent: true, after: 200 }));
    });
  });
});

// =============== BAB 6: TABEL DEFINISI OPERASIONAL (lanskap) ===============
const cara = id => F[id].modul + ': ' + (LANGKAH[id] || []).slice(0, 4).map(l => l.judul.toLowerCase()).join(' → ');
const BARIS = urut.map((id, i) => ({ no: String(i + 1), id, f: F[id] }));
const s6 = [
  H1('BAB 6\nTABEL DEFINISI OPERASIONAL FITUR'),
  P('Tabel induk definisi operasional terdiri atas 18 kolom. Agar tetap terbaca dengan huruf 12 pt, tabel disajikan dalam tiga bagian yang dihubungkan oleh kolom No dan Feature ID. Definisi ditulis dalam kalimat sederhana: apa yang dihitung atau diamati, oleh siapa, dan apa yang dianggap terjadi. Kriteria yang belum ditetapkan peneliti diberi label PROPOSED CRITERION — MEMERLUKAN VALIDASI PENELITI.', { indent: true }),
  CapT('Definisi operasional — bagian 1: definisi, fungsi, pengguna, dan cara pakai'),
  tabel(['No', 'Feature ID', 'Feature/Variable (Fitur)', 'Operational Definition (Definisi operasional)', 'Main Function (Fungsi utama)', 'Intended User (Pengguna)', 'How to Use (Cara pakai)'],
    BARIS.map(r => [r.no, r.id, r.f.nama, r.f.opdef.def, r.f.opdef.fungsi, r.f.peran, cara(r.id)]), [600, 1000, 2000, 3858, 1700, 1600, 3200]),
  CapT('Definisi operasional — bagian 2: masukan, keluaran, kelebihan, alasan, dan rumusan masalah'),
  tabel(['No', 'Feature ID', 'Required Input (Masukan)', 'Expected Output (Keluaran)', 'Advantages (Kelebihan)', 'Why Necessary (Alasan diperlukan)', 'Research Problem (Rumusan masalah)'],
    BARIS.map(r => [r.no, r.id, r.f.input, r.f.output, r.f.kelebihan, r.f.opdef.perlu, r.f.RM]), [600, 1000, 2600, 2300, 2900, 2958, 1600]),
  CapT('Definisi operasional — bagian 3: prinsip, indikator, pengukuran, kriteria, bukti, dan status'),
  tabel(['No', 'Feature ID', 'Design Principle (Prinsip)', 'Evaluation Indicator (Indikator)', 'Measurement Method (Metode)', 'Success/Acceptance Criteria (Kriteria)', 'Evidence Source (Bukti)', 'Implementation Status (Status)'],
    BARIS.map(r => [r.no, r.id, r.f.D, r.f.opdef.ind, r.f.opdef.metode, r.f.opdef.kriteria === PC ? PC : r.f.opdef.kriteria + (/PROPOSED/.test(r.f.opdef.kriteria) ? '' : ' (' + PC + ')'), r.f.bukti, r.f.status]), [600, 1000, 1500, 2300, 1800, 2658, 1800, 2300], 7),
  Sumber('data fitur pada tests/dokumentasi/data_fitur.js; bukti uji pada tests/ dan docs/uat.')];

// =============== BAB 7: KERANGKA EVALUASI ===============
const UKUR = [
  ['Fungsional', 'Apakah fitur berperilaku sesuai spesifikasi?', 'Skenario uji otomatis dan UAT (PASS/FAIL)', 'tests/browser, tests/uat', PC],
  ['Penegakan aturan (D2–D4)', 'Apakah server menolak status yang melanggar aturan?', 'Pasangan kasus uji sah dan tidak sah', 'tests/db; e2e_supabase.js; Gambar F-16', PC],
  ['Kualitas data', 'Apakah isian kunci (PJ, tanggal, bukti, tingkat pengendalian) lengkap?', 'Kueri basis data atas data uji; data produksi hanya dengan izin', 'Hasil kueri', PC],
  ['Keterlacakan (K2)', 'Apakah tiap fitur terlacak ke prinsip dan rumusan masalah?', 'Matriks keterlacakan (Bab 8)', 'Tabel keterlacakan', 'Ambang draf: 100% fitur terlacak (milik draf)'],
  ['Integrasi', 'Apakah data mengalir antarmodul (laporan → investigasi → CAPA; JSA → izin kerja; inspeksi → laporan)?', 'Uji ujung-ke-ujung', 'e2e_supabase.js; Gambar F-23, F-26, F-29', PC],
  ['Keamanan', 'Apakah akses sesuai peran dan identitas pelapor anonim tidak tersimpan?', 'Uji RLS dan constraint; audit keamanan terpisah', 'tests/db', 'Lulus uji tidak sama dengan aman; audit independen belum ada'],
  ['Kontras visual tema', 'Apakah pasangan warna utama memenuhi rasio kontras rujukan?', 'Perhitungan rasio dari token CSS', 'Tabel pada subbab 3.2', PC]];
const HASIL = urut.map(id => [id, F[id].nama, F[id].bukti, F[id].status]);
const s7 = [
  H1('BAB 7\nKERANGKA EVALUASI FITUR'),
  P('Kerangka ini menilai artefak, yaitu apakah aturan dan fungsi bekerja seperti dirancang, selaras dengan evaluasi ex-ante artificial evaluation pada draf disertasi. Kerangka ini tidak mengukur efektivitas di tempat kerja. Usability tidak dimasukkan karena draf disertasi mengecualikan TAM3/SUS dan belum ada metode pengganti yang disetujui.', { indent: true }),
  CapT('Dimensi evaluasi fitur'),
  tabel(['Dimensi', 'Pertanyaan', 'Metode', 'Sumber bukti', 'Kriteria'], UKUR, [1700, 2300, 1900, 1500, 1365]),
  CapT('Ringkasan bukti uji per fitur aktif'),
  tabel(['ID', 'Fitur', 'Bukti uji', 'Status'], HASIL, [800, 3100, 2900, 1965], 3),
  Sumber('docs/uat/lampiran/matriks_pengujian_fungsional.csv; tests/README.md.')];

// =============== BAB 8: KETERLACAKAN DISERTASI ===============
const RM = [
  ['RM1', '"Bagaimana kesenjangan kebijakan–pelaksanaan penutupan bahaya tampak pada register lintas-unit (E2) dan dokumentasi visual (E1) di rumah sakit yang diteliti?"', 'T1', 'K6'],
  ['RM2', '"Bagaimana alur dan pembagian peran penutupan bahaya berlangsung menurut E2 dan E3, dan di titik mana alur terputus?"', 'T1', 'K2 (melalui peta alur)'],
  ['RM3', '"Prinsip desain apa yang dapat diturunkan dari hambatan pelaporan (E3), klausul standar, dan set derivasi E2 untuk sistem penutupan bahaya dengan aplikasi mobile berbasis inovasi frugal, dan apakah setiap hambatan tercatat terpetakan pada sebuah prinsip?" *', 'T2', 'K2'],
  ['RM4', '"Sejauh mana rancangan memenuhi kriteria konformansi (K1), ketahanan (K3: kesesuaian pada set uji tahan), dan sensitivitas ambang (K4)?"', 'T3', 'K1, K3, K4'],
  ['RM5', '"Sejauh mana paket replikasi memenuhi rubrik kelengkapan dan kesamaan konteks (K5)?"', 'T4', 'K5']];
const DPR = [
  ['D1', 'Kanal pelaporan tanpa sentuhan layar dan tanpa jejak identitas', 'F-07 (tanpa jejak identitas); F-08 (suara, masih perlu sentuhan); F-41, F-09, F-04 (mempermudah kanal)', 'Sebagian: syarat "tanpa jejak identitas" terinstansiasi; syarat "tanpa sentuhan layar" belum'],
  ['D2', 'Status "tertutup" sah bila ada satu penanggung jawab dan satu bukti perubahan', 'F-13, F-15, F-16, F-14, F-30', 'Terinstansiasi dan ditegakkan server'],
  ['D3', 'Status dan tanggal pada tiap item', 'F-13, F-18, F-20, F-11, F-12, F-22, F-19', 'Terinstansiasi dan ditegakkan server'],
  ['D4', 'Penutupan sah mensyaratkan bukti pada level fisik; administratif atau APD berstatus terkendali sementara', 'F-15, F-16, F-24, F-26', 'Terinstansiasi dan ditegakkan server'],
  ['D5', 'Hipotesis keteralihan pada empat kriteria kesamaan konteks', 'F-40 (ekspor konfigurasi untuk paket replikasi)', 'Sebagian; empat kriteria kesamaan konteks berstatus NOT YET ESTABLISHED']];
const T = id => { const d = F[id].D; const t = []; if (/D[1-4]/.test(d)) t.push('T2'); if (/RM2/.test(F[id].RM)) t.push('T1'); if (/D5/.test(d)) t.push('T4'); if (id === 'F-16' || id === 'F-13') t.push('T3'); return [...new Set(t)].join(', ') || '—'; };
const K = id => { const d = F[id].D; const k = []; if (/D[1-5]/.test(d)) k.push('K2'); if (id === 'F-16' || id === 'F-13' || id === 'F-15') k.push('K3'); if (/D5/.test(d)) k.push('K5'); return k.join(', ') || 'NOT YET ESTABLISHED'; };
const E = id => /D[1-5]/.test(F[id].D) ? 'E4 (sumber hipotesis prinsip)' + (['F-13', 'F-15', 'F-16'].includes(id) ? '; E2 (set uji tahan dibaca terhadap aturan)' : '') : '—';
const BAB = id => /D[1-5]/.test(F[id].D) ? 'Bab III (Tabel 3.3; spesifikasi); Bab IV (K2' + (/D5/.test(F[id].D) ? ', K5' : '') + ')' : (/RM2/.test(F[id].RM) ? 'Bab IV (peta alur, pendukung)' : '—');
const nPrinsip = urut.filter(id => /D[1-5]/.test(F[id].D) && !/^Pendukung/.test(F[id].D)).length;
const s8 = [
  H1('BAB 8\nMATRIKS KETERLACAKAN DENGAN DISERTASI'),
  H2('8.1 Rumusan masalah, tujuan, dan kriteria'),
  CapT('Rumusan masalah RM1–RM5 dan pasangannya'),
  tabel(['Kode', 'Rumusan masalah (dikutip dari draf)', 'Tujuan', 'Kriteria'], RM, [800, 5865, 900, 1200]),
  P('* Sesuai keputusan peneliti, frasa "berbasis low code" pada RM3 dan tujuan umum diganti "berbasis inovasi frugal". Draf disertasi perlu diselaraskan dengan perubahan ini.', { before: 120 }),
  P('Tujuan: T1 memetakan kesenjangan dan titik putus alur (RM1, RM2); T2 merancang prinsip desain dan spesifikasi (RM3); T3 menganalisis kesesuaian rancangan pada kriteria K1, K3, K4 (RM4); T4 menyusun paket replikasi dan kelengkapan komponennya (RM5). Aset bukti: E1 dokumentasi visual (dijeda), E2 register risiko per unit (satu-satunya bukti empiris), E3 transkrip wawancara (dijeda), E4 dokumen konsep artefak. Kriteria: K1 konformansi klausul (≥ 80%), K2 keterlacakan (100% hambatan terpetakan, 100% fitur terlacak, 10/10 komponen), K3 ketahanan pada set uji tahan (≥ 70% tanpa kelas gagal sistematis), K4 sensitivitas ambang (putusan stabil), K5 kelengkapan paket replikasi (8/8 komponen dan 4 kriteria kesamaan konteks), K6 kesepakatan antarpengkode (κ ≥ 0,61 dan ≥ 80%).', { indent: true }),
  H2('8.2 Prinsip desain D1–D5 dan fitur yang menginstansiasinya'),
  P('Rumusan D1–D5 di bawah adalah rumusan pada draf disertasi (Tabel 3.3) yang dipakai sebagai rumusan final sesuai keputusan peneliti.', { indent: true }),
  CapT('Prinsip desain dan instansiasinya pada aplikasi'),
  tabel(['Kode', 'Prinsip desain', 'Fitur yang menginstansiasi', 'Status instansiasi'], DPR, [700, 2900, 3065, 2100])];
const s8b = [
  H2('8.3 Matriks keterlacakan per fitur'),
  CapT('Matriks keterlacakan fitur aktif'),
  tabel(['ID', 'Fitur', 'Prinsip (D)', 'Rumusan masalah (RM)', 'Tujuan (T)', 'Aset bukti (E)', 'Kriteria (K)', 'Bab disertasi'], urut.map(id => [id, F[id].nama, F[id].D, F[id].RM, T(id), E(id), K(id), BAB(id)]), [800, 2400, 1800, 1600, 900, 2200, 2300, 1958]),
  P('Dari ' + urut.length + ' fitur aktif, ' + nPrinsip + ' fitur menginstansiasi sekurang-kurangnya satu prinsip D1–D5; sisanya adalah fitur pendukung operasional. Karena K2 mensyaratkan 100% fitur terlacak, peneliti perlu memutuskan apakah fitur pendukung dikeluarkan dari spesifikasi artefak penelitian atau dipetakan ke prinsip tertentu. Sampai keputusan itu dibuat, kaitan fitur pendukung dengan K2 berstatus NOT YET ESTABLISHED.', { indent: true, before: 120 })];

// =============== BAB 9: PRIORITAS ===============
const PRIOR = [
  ['P1', 'F-13 penilaian risiko', 'Menyesuaikan penentuan tingkat risiko dengan matriks per sel yang dipakai register RS', 'Konformansi dengan register (RM4/K1)'],
  ['P1', 'F-21 ekspor', 'Menyamakan kolom "format daftar risiko" dengan template register RS', 'Data dapat dibandingkan dengan E2'],
  ['P1', 'F-06 formulir lapor', 'Menambah tanggal kejadian terpisah dan pilihan isian sebab untuk entri register', 'Temuan UAT-10 dan UAT-20'],
  ['P1', 'Bukti lingkungan nyata', 'Menjalankan ulang skenario utama pada lingkungan produksi dengan akun uji, tanpa data pasien', 'Status saat ini hanya terverifikasi di lingkungan uji'],
  ['P2', 'F-08, F-09', 'Uji pada ponsel nyata untuk input suara dan antrean luring', 'Status AVAILABLE BUT NOT FULLY TESTED'],
  ['P2', 'F-14, F-31', 'Notifikasi saat laporan ditugaskan kepada PJ', 'Temuan UAT-18'],
  ['P2', 'F-28', 'Pesan penolakan yang mudah dipahami (bukan pesan teknis basis data)', 'Tangkapan F-28 langkah 3'],
  ['P2', 'F-40, F-41, F-34', 'Skenario uji untuk ekspor konfigurasi, pemindaian QR, dan angka HSE Intelligence', 'Status AVAILABLE BUT NOT FULLY TESTED'],
  ['P3', 'F-01, F-38', 'Evaluasi tema dengan metode yang disetujui peneliti; simpan tema per akun; varian gelap tema Aksesibel', 'Belum ada evaluasi pengguna'],
  ['P3', 'F-02', 'Pengujian alur MFA pada layanan autentikasi sebenarnya', 'Server uji melewati faktor kedua']];
const s9 = [
  H1('BAB 9\nPRIORITAS PENGUATAN FITUR'),
  P('Prioritas disusun dari keterbatasan fitur aktif dan kekurangan bukti. P1 berkaitan langsung dengan kesesuaian terhadap register rumah sakit dan kriteria disertasi; P2 melengkapi bukti dan alur; P3 penyempurnaan tampilan. Urutan ini adalah usulan dan memerlukan keputusan peneliti.', { indent: true }),
  CapT('Usulan prioritas penguatan'),
  tabel(['Prioritas', 'Fitur/area', 'Usulan', 'Alasan'], PRIOR, [1100, 1900, 3600, 2165])];

// =============== BAB 10: PENUTUP ===============
const s10 = [
  H1('BAB 10\nPENUTUP'),
  P('HSE Project versi 2.2.0 memiliki ' + urut.length + ' bagian fitur aktif yang didokumentasikan pada ' + totLangkah + ' langkah dan tiga tema. Alur inti empat tahap berjalan pada lingkungan uji, dan prinsip D2, D3, serta D4 ditegakkan oleh basis data: laporan tidak dapat ditutup tanpa satu penanggung jawab, tanggal, dan bukti pengendalian tingkat fisik. Prinsip D1 baru terpenuhi sebagian (tanpa jejak identitas sudah, tanpa sentuhan layar belum), dan D5 baru didukung oleh ekspor konfigurasi.', { indent: true }),
  P('Seluruh bukti berasal dari lingkungan uji dengan data demonstrasi dan data sintetis. Dokumen ini tidak membuktikan efektivitas aplikasi di tempat kerja, tidak menyatakan aplikasi aman hanya karena memiliki login dan peran, dan tidak menyatakan salah satu tema lebih baik. Kriteria penerimaan yang belum ditetapkan tetap berlabel PROPOSED CRITERION — MEMERLUKAN VALIDASI PENELITI.', { indent: true })];

// =============== LAMPIRAN ===============
const SINGKAT = [['APD', 'Alat pelindung diri'], ['CAPA', 'Corrective and Preventive Action (tindakan korektif dan preventif)'], ['CSV', 'Comma-separated values (berkas teks berkolom)'], ['DSR', 'Design Science Research'],
  ['IPSRS', 'Instalasi Pemeliharaan Sarana Rumah Sakit'], ['JSA', 'Job Safety Analysis (analisis keselamatan pekerjaan)'], ['K3', 'Keselamatan dan kesehatan kerja'], ['K3RS', 'Keselamatan dan kesehatan kerja rumah sakit (peran Komite/Koordinator K3)'],
  ['Kesling', 'Kesehatan lingkungan'], ['MFA', 'Multi-Factor Authentication (verifikasi dua langkah)'], ['OCR', 'Optical character recognition (pembacaan teks dari gambar)'], ['PJ', 'Penanggung jawab'], ['PTW', 'Permit to Work (izin kerja)'],
  ['PWA', 'Progressive Web App'], ['QR', 'Quick Response (kode dua dimensi)'], ['RCA', 'Root Cause Analysis (analisis akar masalah)'], ['RLS', 'Row Level Security (pembatasan baris data per pengguna)'], ['SOP', 'Standar operasional prosedur'],
  ['SWA', 'Stop Work Authority (wewenang menghentikan pekerjaan)'], ['TBM', 'Toolbox meeting'], ['TOTP', 'Time-based One-Time Password'], ['UAT', 'User Acceptance Testing'], ['UI/UX', 'Antarmuka dan pengalaman pengguna'], ['WCAG', 'Web Content Accessibility Guidelines'], ['WITA', 'Waktu Indonesia Tengah']];
const lampA = [H1('LAMPIRAN A\nREGISTER TANGKAPAN LAYAR'), P('Setiap baris merujuk satu gambar tiga tema pada Bab 5. Gambar tertanam di dokumen ini; berkas sumber per tema memakai kode berkas yang sama dan dapat direkam ulang dengan langkah pada Lampiran C.', { indent: true })];
const lampB = [H1('LAMPIRAN B\nDAFTAR SINGKATAN'), CapT('Daftar singkatan'), tabel(['Singkatan', 'Kepanjangan / arti'], SINGKAT, [1800, L_ISI - 1800])];
const lampC = [H1('LAMPIRAN C\nCARA MEREKAM ULANG DOKUMENTASI'),
  P('Tangkapan layar dapat direkam ulang dari repositori. Basis data uji dipulihkan dari templat sebelum setiap tema, lalu skrip perekam menjalankan seluruh langkah fitur dengan peramban Chromium.', { indent: true }),
  ...daftarAngka(['Sajikan aplikasi: python3 -m http.server 8765 dari akar repositori.', 'Siapkan basis data uji hse_dok_tpl sebagai salinan basis data demo.', 'Rekam ketiga tema: tests/dokumentasi/jalankan_rekam.sh <folder_keluar>.', 'Gabungkan tiga tema per langkah: python3 tests/dokumentasi/susun_triptik.py <folder_keluar> <folder_triptik>.', 'Susun dokumen: node tests/dokumentasi/susun_dokumen_akhir.js <folder_keluar> <folder_triptik> <berkas.docx>.'])];

// Register gambar diisi setelah Bab 5 tersusun (nomor gambar sudah diketahui)
const REG = DAFTAR_GAMBAR.filter(g => g[2]).map(g => [g[0], g[2], g[1].replace(/^F-\d+ langkah \d+ — /, ''), g[2].slice(0, 4)]);
lampA.push(CapT('Register tangkapan layar fitur'), tabel(['Gambar', 'Kode berkas', 'Isi', 'Fitur'], REG, [1300, 1500, 4865, 1100]));

const gaya = { default: { document: { run: { font: FONT, size: UK } } }, paragraphStyles: ['Heading1', 'Heading2', 'Heading3'].map((id, i) => ({ id, name: 'Heading ' + (i + 1), basedOn: 'Normal', next: 'Normal', run: { font: FONT, size: UK, bold: true, color: '000000' }, paragraph: { spacing: { line: 360 } } })) };
const doc = new Document({ creator: 'HSE Project', title: 'Dokumentasi Komprehensif Aplikasi HSE Project', styles: gaya,
  numbering: { config: [{ reference: 'poin', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 567, hanging: 283 } } } }] },
    { reference: 'angka', levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 567, hanging: 360 } } } }] }] },
  sections: [{ properties: potret, footers: kaki, children: [...s0, ...s1, ...s2, ...s3] }, { properties: lanskap, footers: kaki, children: s4 }, { properties: potret, footers: kaki, children: s5 },
    { properties: lanskap, footers: kaki, children: s6 }, { properties: potret, footers: kaki, children: [...s7, ...s8] }, { properties: lanskap, footers: kaki, children: s8b },
    { properties: potret, footers: kaki, children: [...s9, ...s10, ...lampA, ...lampB, ...lampC] }] });
Packer.toBuffer(doc).then(b => { fs.writeFileSync(KELUAR, b); console.log('ok', KELUAR, (b.length / 1e6).toFixed(1) + ' MB', 'gambar', nGambar, 'tabel', nTabel, 'langkah', totLangkah, jumlahStatus); });
