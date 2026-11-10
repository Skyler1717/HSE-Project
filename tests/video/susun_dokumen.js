// Dokumen pendukung produksi video (Word): naskah, storyboard, diagram, fitur yang didemonstrasikan, yang belum terverifikasi, catatan QC.
// node susun_dokumen.js <dir_kerja> <keluar.docx>
const fs = require('fs'), path = require('path');
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, ShadingType, AlignmentType, HeadingLevel, ImageRun, BorderStyle, LevelFormat, Footer, PageNumber, TableOfContents, VerticalAlign, PageOrientation } = require('docx');
const { V1, V2 } = require('./naskah.js');
const [DIR, KELUAR] = process.argv.slice(2);
const QC = JSON.parse(fs.readFileSync(path.join(DIR, 'final', 'qc.json'), 'utf8'));
const G1 = JSON.parse(fs.readFileSync(path.join(DIR, 'audio', 'v1', 'garis_waktu.json'))), G2 = JSON.parse(fs.readFileSync(path.join(DIR, 'audio', 'v2', 'garis_waktu.json')));
const FONT = 'Times New Roman';
const INGGRIS = ['Professional Product Showcase', 'Technical Architecture Documentary', 'Progressive Web App', 'Row Level Security', 'Edge Function', 'service worker', 'service role', 'screen recording', 'storyboard', 'voice-over', 'lower third', 'motion graphics', 'screencast',
  'frontend', 'backend', 'framework', 'build', 'dashboard', 'risk register', 'Job Safety Analysis', 'toolbox meeting', 'Stop Work Authority', 'Fishbone', '5 Why', 'trigger', 'constraint', 'upsert', 'rollback', 'commit', 'repository', 'deployment', 'browser', 'subtitle', 'crossfade', 'ducking', 'loudness',
  'syntax highlighting', 'request', 'response', 'token', 'hash', 'pre-test', 'post-test', 'low-code', 'stock footage', 'Smarter Safety. Better Management. Safer Workplace.', 'Building a Smarter Safety Future', 'quality control', 'render', 'timeline', 'push', 'email', 'open source', 'cursor', 'zoom', 'highlight', 'Entity Relationship Diagram', 'Data Flow Diagram', 'diphone', 'text-to-speech', 'mastering'];
const pola = new RegExp('(?<![\\p{L}\\d-])(' + INGGRIS.sort((a, b) => b.length - a.length).map(x => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')(?![\\p{L}\\d])', 'gu');
function runs(t, o = {}) { t = String(t ?? ''); const sz = o.size || 24; const out = []; let i = 0;
  for (const m of t.matchAll(pola)) { if (m.index > i) out.push(new TextRun({ text: t.slice(i, m.index), font: FONT, size: sz, bold: o.bold })); out.push(new TextRun({ text: m[0], font: FONT, size: sz, bold: o.bold, italics: true })); i = m.index + m[0].length; }
  if (i < t.length) out.push(new TextRun({ text: t.slice(i), font: FONT, size: sz, bold: o.bold })); return out; }
const fmt = (t, o = {}) => String(t).split(/(\*\*[^*]+\*\*)/).filter(Boolean).flatMap(s => s.startsWith('**') ? runs(s.slice(2, -2), Object.assign({}, o, { bold: true })) : runs(s, o));
const P = (t, o = {}) => new Paragraph({ children: fmt(t, o), alignment: o.align || AlignmentType.JUSTIFIED, spacing: { line: 360, after: 120, before: o.before || 0 }, indent: o.indent ? { firstLine: 567 } : undefined });
const H1 = (t, putus = true) => new Paragraph({ heading: HeadingLevel.HEADING_1, children: runs(t, { bold: true }), alignment: AlignmentType.CENTER, spacing: { before: 240, after: 240 }, pageBreakBefore: putus });
const H2 = t => new Paragraph({ heading: HeadingLevel.HEADING_2, children: runs(t, { bold: true }), spacing: { before: 240, after: 120 }, keepNext: true });
const B = t => new Paragraph({ children: fmt(t), numbering: { reference: 'poin', level: 0 }, spacing: { line: 360, after: 60 }, alignment: AlignmentType.JUSTIFIED });
const Cap = t => new Paragraph({ children: runs(t, { bold: true, size: 22 }), alignment: AlignmentType.CENTER, spacing: { before: 60, after: 200 } });
const garis = { style: BorderStyle.SINGLE, size: 4, color: '808080' };
function tabel(kepala, baris, lebar, uk = 20) {
  const sel = (t, kep, w) => new TableCell({ width: { size: w, type: WidthType.DXA }, verticalAlign: VerticalAlign.TOP, margins: { top: 40, bottom: 40, left: 70, right: 70 }, borders: { top: garis, bottom: garis, left: garis, right: garis }, shading: kep ? { type: ShadingType.CLEAR, fill: 'D9D9D9', color: 'auto' } : undefined,
    children: String(t ?? '').split('\n').map(x => new Paragraph({ children: fmt(x, { size: uk, bold: kep }), spacing: { line: 250, after: 0 }, alignment: kep ? AlignmentType.CENTER : AlignmentType.LEFT })) });
  return new Table({ width: { size: lebar.reduce((a, b) => a + b, 0), type: WidthType.DXA }, columnWidths: lebar, rows: [new TableRow({ tableHeader: true, children: kepala.map((k, i) => sel(k, true, lebar[i])) })].concat(baris.map(r => new TableRow({ children: r.map((c, i) => sel(c, false, lebar[i])) }))) });
}
const mmss = t => Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0');
const img = (f, w, h) => new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 120, after: 40 }, children: [new ImageRun({ type: 'png', data: fs.readFileSync(f), transformation: { width: w, height: h } })] });
const LP = 11906 - 2268 - 1701, LL = 16838 - 3402;

const isi = [], lanskap = [], akhir = [];
isi.push(new Paragraph({ spacing: { before: 2000 }, children: [] }));
isi.push(P('DOKUMEN PENDUKUNG PRODUKSI VIDEO', { bold: true, align: AlignmentType.CENTER }));
isi.push(P('HSE PROJECT — PROFESSIONAL PRODUCT SHOWCASE & TECHNICAL ARCHITECTURE DOCUMENTARY', { bold: true, align: AlignmentType.CENTER }));
isi.push(P('Naskah, storyboard, diagram, daftar fitur yang didemonstrasikan, komponen yang belum terverifikasi, dan catatan kualitas', { align: AlignmentType.CENTER, before: 400 }));
isi.push(P('Versi aplikasi yang direkam: 2.2.0 · Tanggal produksi: ' + QC.tanggal, { align: AlignmentType.CENTER, before: 400 }));

isi.push(H1('RINGKASAN PRODUKSI'));
isi.push(tabel(['Berkas', 'Durasi', 'Spesifikasi teknis (hasil ffprobe)'], QC.video.map(v => [v.nama, mmss(v.durasi) + ' (' + v.durasi.toFixed(1) + ' dtk)', v.spes]), [3400, 1500, LP - 4900], 20));
isi.push(P('Proses yang benar-benar dilakukan:', { before: 200 }));
['**Eksplorasi:** kode sumber repositori (frontend, migrasi SQL, Apps Script, Edge Function) dan basis data uji yang dibangun dari migrasi tersebut.', '**Perekaman layar:** aplikasi HSE Project versi 2.2.0 yang asli, dijalankan di Chromium pada 1920×1080 (screencast JPEG kualitas 92, disusun menjadi 30 fps), dengan kursor, efek klik, sorotan, dan lower third yang ditambahkan saat perekaman.',
  '**Data:** basis data demonstrasi terpisah (hse_demo) berisi data sintetis bertanda [DEMO]; bukan data rumah sakit dan bukan produksi.', '**Grafik gerak & diagram:** HTML/SVG yang dianimasikan dan direkam dengan cara yang sama; setiap kotak dan relasi diturunkan dari kode atau skema yang diperiksa.',
  '**Kode & terminal:** potongan kode diambil langsung dari berkas repositori (nomor baris asli) dengan syntax highlighting; keluaran terminal adalah hasil perintah yang dijalankan saat produksi.', '**Audio:** narasi text-to-speech luring (espeak-ng + suara diphone MBROLA id1), musik latar orisinal yang disintesis (bebas lisensi), ducking otomatis, normalisasi loudness −16 LUFS.',
  '**Subtitle:** Bahasa Indonesia, dibakar ke video dan juga disertakan sebagai trek subtitle serta berkas .srt terpisah.'].forEach(t => isi.push(B(t)));

isi.push(H1('BATASAN DAN KEJUJURAN PRODUKSI'));
['**Situs produksi, Supabase Dashboard, dan Google Apps Script tidak dapat diakses** dari lingkungan produksi video (kebijakan jaringan memblokir; dashboard dan editor juga memerlukan login akun pemilik). Karena itu konfigurasi produksi tidak diperiksa langsung; yang ditampilkan adalah kode repositori dan basis data uji yang dibangun dari migrasi yang sama.',
  '**Voice-over adalah suara sintetis**, bukan pengisi suara profesional. Layanan suara neural tidak dapat dijangkau. Naskah, berkas narasi terpisah (.wav), dan subtitle disertakan agar narasi dapat direkam ulang oleh pengisi suara manusia tanpa menyunting gambar.',
  '**Tidak ada stock footage tempat kerja nyata.** Tidak tersedia sumber footage berlisensi; adegan pembuka memakai ilustrasi bahaya dari aplikasi sendiri, bukan rekaman pekerja.',
  '**Resolusi 1920×1080 (Full HD).** Sumber rekaman tidak mendukung 4K tanpa menaikkan skala buatan.', '**Musik bersifat sintetis** (pad, bas, arpeggio, perkusi lembut), bukan rekaman orkestra.',
  '**Klaim dibatasi pada yang terbukti:** fitur yang belum aktif (email/push, matriks 5×5 per sel, risiko residual) disebut sebagai rencana. Tidak ada perbandingan dengan produk pesaing. Istilah "low-code" tidak dipakai karena aplikasi ditulis dengan JavaScript tangan di atas layanan backend terkelola.'].forEach(t => isi.push(B(t)));

// Naskah + storyboard (lanskap)
function sb(V, G, judul) {
  lanskap.push(H1(judul, lanskap.length > 0));
  lanskap.push(tabel(['Adegan', 'Waktu', 'Visual & materi rekaman', 'Narasi (subtitle)'], V.map(a => { const g = G.find(x => x.id === a.id); const t0 = G.slice(0, G.indexOf(g)).reduce((s, x) => s + x.durasi, 0); return [a.id + '\n' + a.judul, mmss(t0) + '–' + mmss(t0 + g.durasi), a.visual, a.kalimat.join(' ')]; }),
    [1600, 1300, 4300, LL - 7200], 19));
}
sb(V1, G1, 'NASKAH DAN STORYBOARD VIDEO 1 — PROFESSIONAL PRODUCT SHOWCASE');
sb(V2, G2, 'NASKAH DAN STORYBOARD VIDEO 2 — TECHNICAL ARCHITECTURE DOCUMENTARY');

// Diagram
akhir.push(H1('DIAGRAM', false));
akhir.push(P('Diagram berikut adalah bingkai dari grafik gerak di video. Isinya diturunkan dari kode sumber dan skema basis data uji; komponen yang belum aktif diberi garis putus-putus atau label "belum".', { indent: true }));
for (const [f, c] of QC.diagram) { akhir.push(img(f, 600, 338)); akhir.push(Cap(c)); }

akhir.push(H1('FITUR YANG BERHASIL DIDEMONSTRASIKAN'));
akhir.push(tabel(['Fitur', 'Video / adegan', 'Bukti di rekaman'], QC.fitur, [2600, 1700, LP - 4300], 20));
akhir.push(H1('KOMPONEN YANG BELUM DAPAT DIVERIFIKASI'));
akhir.push(tabel(['Komponen', 'Alasan', 'Cara memverifikasi'], QC.belum, [2400, 2700, LP - 5100], 20));
akhir.push(H1('CATATAN KUALITAS DAN REKOMENDASI'));
akhir.push(H2('Hasil pemeriksaan kualitas (otomatis)'));
akhir.push(tabel(['Pemeriksaan', 'Hasil'], QC.cek, [3600, LP - 3600], 20));
akhir.push(H2('Rekomendasi'));
QC.rekomendasi.forEach(t => akhir.push(B(t)));

const footer = new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 20 })] })] });
const A4 = { width: 11906, height: 16838 };
const doc = new Document({ styles: { default: { document: { run: { font: FONT, size: 24 } } }, paragraphStyles: [{ id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size: 24, bold: true }, paragraph: { spacing: { before: 240, after: 240 }, keepNext: true, outlineLevel: 0 } }, { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size: 24, bold: true }, paragraph: { spacing: { before: 240, after: 120 }, keepNext: true, outlineLevel: 1 } }] },
  numbering: { config: [{ reference: 'poin', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 567, hanging: 283 } } } }] }] },
  sections: [{ properties: { page: { size: A4, margin: { top: 1701, bottom: 1701, left: 2268, right: 1701 } } }, footers: { default: footer }, children: isi },
    { properties: { page: { size: Object.assign({}, A4, { orientation: PageOrientation.LANDSCAPE }), margin: { top: 1701, bottom: 1701, left: 1701, right: 1701 } } }, footers: { default: footer }, children: lanskap },
    { properties: { page: { size: A4, margin: { top: 1701, bottom: 1701, left: 2268, right: 1701 } } }, footers: { default: footer }, children: akhir }] });
Packer.toBuffer(doc).then(b => { fs.writeFileSync(KELUAR, b); console.log('ditulis', KELUAR); });
