// Penyusun dokumen Word "Lampiran Bukti UAT": skrip uji, hasil mentah, berkas CSV, dan seluruh tangkapan layar.
const fs = require('fs'), path = require('path');
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, ShadingType, AlignmentType, HeadingLevel, PageOrientation, ImageRun, BorderStyle, LevelFormat, Footer, PageNumber, TableOfContents, VerticalAlign } = require('docx');
const ROOT = path.resolve(__dirname, '../..');
const FONT = 'Times New Roman';
const J = JSON.parse(fs.readFileSync(ROOT + '/tests/uat/hasil_uat.json', 'utf8'));
// Daftar istilah Inggris diambil dari penyusun laporan utama agar konsisten
const INGGRIS = eval(fs.readFileSync(__dirname + '/susun_laporan_docx.js', 'utf8').match(/const INGGRIS = (\[[^\]]+\]);/)[1]);
const pola = new RegExp('(?<![\\p{L}\\d-])(' + INGGRIS.sort((a, b) => b.length - a.length).map(x => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')(?![\\p{L}\\d])', 'gu');
function runs(teks, o = {}) {
  teks = String(teks ?? ''); const sz = o.size || 24;
  if (teks.includes('~~')) return teks.split(/(~~[^~]+~~)/).filter(Boolean).flatMap(x => x.startsWith('~~') ? [new TextRun({ text: x.slice(2, -2), font: FONT, size: sz, bold: o.bold, italics: true })] : runs(x, o));
  const out = []; let i = 0;
  for (const m of teks.matchAll(pola)) { if (m.index > i) out.push(new TextRun({ text: teks.slice(i, m.index), font: FONT, size: sz, bold: o.bold })); out.push(new TextRun({ text: m[0], font: FONT, size: sz, bold: o.bold, italics: true })); i = m.index + m[0].length; }
  if (i < teks.length) out.push(new TextRun({ text: teks.slice(i), font: FONT, size: sz, bold: o.bold }));
  return out;
}
const fmt = (t, o = {}) => String(t).split(/(\*\*[^*]+\*\*)/).filter(Boolean).flatMap(s => s.startsWith('**') ? runs(s.slice(2, -2), Object.assign({}, o, { bold: true })) : runs(s, o));
const P = (t, o = {}) => new Paragraph({ children: fmt(t, o), alignment: o.align || AlignmentType.JUSTIFIED, spacing: { line: 360, after: o.after ?? 120, before: o.before || 0 }, indent: o.indent ? { firstLine: 567 } : undefined, keepNext: o.keepNext });
const H1 = (t, tanpa) => new Paragraph({ heading: HeadingLevel.HEADING_1, children: runs(t, { bold: true }), alignment: AlignmentType.CENTER, spacing: { before: 240, after: 240 }, pageBreakBefore: !tanpa });
const H2 = t => new Paragraph({ heading: HeadingLevel.HEADING_2, children: runs(t, { bold: true }), spacing: { before: 240, after: 120 }, keepNext: true });
const B = t => new Paragraph({ children: fmt(t), numbering: { reference: 'poin', level: 0 }, spacing: { line: 360, after: 60 }, alignment: AlignmentType.JUSTIFIED });
const Cap = t => new Paragraph({ children: runs(t, { bold: true, size: 22 }), alignment: AlignmentType.CENTER, spacing: { before: 60, after: 240 } });
// Kode program: Times New Roman 9 pt, tanpa pemiringan otomatis (kode bukan teks berbahasa Inggris), baris dipertahankan
const kode = teks => teks.replace(/\t/g, '  ').split('\n').map(b => new Paragraph({ children: [new TextRun({ text: b || ' ', font: FONT, size: 18 })], spacing: { line: 220, after: 0 }, shading: { type: ShadingType.CLEAR, fill: 'F2F2F2', color: 'auto' } }));
const garis = { style: BorderStyle.SINGLE, size: 4, color: '808080' };
function tabel(kepala, baris, lebar, ukuran = 18) {
  const sel = (t, kep, w, warna) => new TableCell({ width: { size: w, type: WidthType.DXA }, verticalAlign: VerticalAlign.TOP, margins: { top: 30, bottom: 30, left: 60, right: 60 }, borders: { top: garis, bottom: garis, left: garis, right: garis },
    shading: kep ? { type: ShadingType.CLEAR, fill: 'D9D9D9', color: 'auto' } : (warna ? { type: ShadingType.CLEAR, fill: warna, color: 'auto' } : undefined),
    children: String(t ?? '').split('\n').map(x => new Paragraph({ children: runs(x, { size: ukuran, bold: kep }), spacing: { line: 240, after: 0 }, alignment: kep ? AlignmentType.CENTER : AlignmentType.LEFT })) });
  const ws = { PASS: 'E2EFDA', FAIL: 'F8CBAD', BLOCKED: 'FFE699' };
  return new Table({ width: { size: lebar.reduce((a, b) => a + b, 0), type: WidthType.DXA }, columnWidths: lebar,
    rows: [new TableRow({ tableHeader: true, children: kepala.map((k, i) => sel(k, true, lebar[i])) })].concat(baris.map(r => new TableRow({ children: r.map((c, i) => sel(c, false, lebar[i], ws[c])) }))) });
}
function bacaCSV(f) {
  const t = fs.readFileSync(f, 'utf8').replace(/^﻿/, ''); const rows = []; let r = [], c = '', q = false;
  for (let i = 0; i < t.length; i++) { const ch = t[i];
    if (q) { if (ch === '"' && t[i + 1] === '"') { c += '"'; i++; } else if (ch === '"') q = false; else c += ch; }
    else if (ch === '"') q = true; else if (ch === ',') { r.push(c); c = ''; } else if (ch === '\n') { r.push(c.replace(/\r$/, '')); rows.push(r); r = []; c = ''; } else c += ch; }
  if (c || r.length) { r.push(c.replace(/\r$/, '')); rows.push(r); } return rows;
}
const A4 = { width: 11906, height: 16838 }, LP = 11906 - 2268 - 1701, LL = 16838 - 3402;
const bagi = (n, total, bobot) => { const b = bobot || Array(n).fill(1), s = b.reduce((a, x) => a + x, 0); const w = b.map(x => Math.floor(x * total / s)); w[n - 1] += total - w.reduce((a, x) => a + x, 0); return w; };

// ---------- Isi ----------
const s1 = [], s2 = [], s3 = [];
s1.push(new Paragraph({ spacing: { before: 2000 }, children: [] }));
s1.push(P('LAMPIRAN BUKTI PENGUJIAN', { bold: true, align: AlignmentType.CENTER, after: 0 }));
s1.push(P('PENGUJIAN PENERIMAAN PENGGUNA (UAT) BERBASIS PERSONA', { bold: true, align: AlignmentType.CENTER, after: 0 }));
s1.push(P('APLIKASI HSE PROJECT VERSI 2.2.0', { bold: true, align: AlignmentType.CENTER, after: 600 }));
s1.push(P('Pendamping dokumen "Laporan UAT Berbasis Persona — HSE Project 2.2.0"', { align: AlignmentType.CENTER, after: 0 }));
s1.push(P('Isi: skrip uji, hasil mentah, data CSV, dan tangkapan layar asli', { align: AlignmentType.CENTER, after: 0 }));
s1.push(P('Tanggal eksekusi: 10 November 2026 · Lingkungan: basis data uji hse_uat (bukan produksi)', { align: AlignmentType.CENTER, after: 600 }));
s1.push(P('Seluruh data bertanda SIMULASI_UAT dan bersifat sintetis.', { bold: true, align: AlignmentType.CENTER }));

s1.push(H1('PENGANTAR'));
s1.push(P('Dokumen ini memuat bukti mentah pengujian agar setiap hasil pada laporan utama dapat ditelusuri (traceability). Isi lampiran disalin apa adanya dari berkas di repository, tanpa penyuntingan isi:', { indent: true }));
[['Lampiran 1', 'Skrip uji (tests/uat/siapkan_uat.sh, tests/uat/uat_komite_k3.js) dan skrip penyusun dokumen.'], ['Lampiran 2', 'Hasil mentah eksekusi (tests/uat/hasil_uat.json).'], ['Lampiran 3', 'Empat berkas CSV (docs/uat/lampiran) dan ekspor asli aplikasi UAT-12.'], ['Lampiran 4', '37 tangkapan layar asli (docs/uat/bukti), satu per kasus uji.']].forEach(([a, b]) => s1.push(B('**' + a + '.** ' + b)));
s1.push(P('Konvensi penulisan: teks laporan memakai Times New Roman 12 pt dan istilah bahasa asing dicetak miring. Kode program dan data mentah ditulis Times New Roman 9 pt tanpa pemiringan, karena merupakan salinan literal berkas dan bukan kalimat bahasa Inggris. Tabel data memakai 9 pt agar muat di halaman.', { indent: true, before: 120 }));
s1.push(H1('DAFTAR ISI'));
s1.push(new TableOfContents('Daftar Isi', { hyperlink: true, headingStyleRange: '1-2' }));
s1.push(P('(Perbarui daftar isi di Microsoft Word: klik kanan → Update Field.)', { size: 20, align: AlignmentType.LEFT }));

// Lampiran 1
s1.push(H1('LAMPIRAN 1. SKRIP UJI'));
for (const [f, ket] of [['tests/uat/siapkan_uat.sh', 'Menyiapkan basis data uji hse_uat (skema sama dengan migrasi produksi) dan tujuh akun sintetis.'], ['tests/uat/uat_komite_k3.js', 'Menjalankan 38 kasus uji tiga persona melalui peramban Chromium (Playwright), membaca hasil dari antarmuka dan basis data, serta menyimpan tangkapan layar.'], ['tests/uat/susun_laporan_docx.js', 'Menyusun laporan utama (.docx) dan berkas CSV dari hasil mentah.'], ['tests/uat/susun_lampiran_docx.js', 'Menyusun dokumen lampiran ini.']]) {
  const isi = fs.readFileSync(ROOT + '/' + f, 'utf8');
  s1.push(H2(f)); s1.push(P(ket + ' Panjang: ' + isi.split('\n').length + ' baris.', { indent: true }));
  s1.push(...kode(isi));
}
// Lampiran 2
s1.push(H1('LAMPIRAN 2. HASIL MENTAH (hasil_uat.json)'));
const rekap = J.hasil.reduce((a, r) => (a[r.status] = (a[r.status] || 0) + 1, a), {});
s1.push(P('Berkas dihasilkan otomatis oleh skrip pada akhir eksekusi ' + J.dijalankan + ' (UTC). Ringkasan: PASS ' + rekap.PASS + ', FAIL ' + rekap.FAIL + ', BLOCKED ' + rekap.BLOCKED + '; galat JavaScript ' + J.galat_js.length + '; pasangan sel matriks yang bertentangan dengan pita skor: ' + J.konflik_pita + '. Isi lengkap berkas:', { indent: true }));
s1.push(...kode(JSON.stringify(J, null, 1)));

// Lampiran 3 (lanskap)
s2.push(H1('LAMPIRAN 3. BERKAS CSV', true));
s2.push(P('Tabel berikut adalah isi lengkap berkas CSV (UTF-8 dengan BOM). Baris pertama tiap tabel adalah kepala kolom asli berkas.', { indent: true }));
const CSV = [['docs/uat/lampiran/dataset_risk_register_SIMULASI_UAT.csv', 'Dataset skenario risk register'], ['docs/uat/lampiran/dataset_insiden_SIMULASI_UAT.csv', 'Dataset skenario pelaporan insiden'], ['docs/uat/lampiran/dataset_jsa_inspeksi_kegiatan_SIMULASI_UAT.csv', 'Dataset JSA, inspeksi, izin kerja, toolbox, dan pelatihan'],
  ['docs/uat/lampiran/matriks_pengujian_fungsional.csv', 'Matriks pengujian fungsional (38 kasus)'], ['docs/uat/bukti/UAT-12-ekspor.csv', 'Ekspor asli aplikasi "Format daftar risiko (CSV)" pada UAT-12']];
CSV.forEach(([f, judul], k) => {
  const rows = bacaCSV(ROOT + '/' + f); const n = rows[0].length;
  s2.push(H2('3.' + (k + 1) + ' ' + judul)); s2.push(P('Berkas: ' + f + ' — ' + (rows.length - 1) + ' baris data, ' + n + ' kolom.', { after: 80 }));
  const bobot = rows[0].map((_, i) => Math.min(8, Math.max(3.2, Math.max(...rows.map(r => Math.min(60, (r[i] || '').length))) / 6)));
  s2.push(tabel(rows[0], rows.slice(1), bagi(n, LL, bobot), n > 14 ? 14 : 18));
});

// Lampiran 4 tangkapan layar
s3.push(H1('LAMPIRAN 4. TANGKAPAN LAYAR ASLI', true));
s3.push(P('Setiap gambar adalah tangkapan layar yang diambil skrip tepat setelah kasus uji selesai (resolusi 1280×860 px; UAT-37 pada lebar 360 px). Gambar tidak disunting. UAT-38 tidak memiliki tangkapan layar karena tidak dapat dijalankan (BLOCKED). Berkas UAT-36-cetak.jpg adalah halaman laporan cetak investigasi.', { indent: true }));
const gb = fs.readdirSync(ROOT + '/docs/uat/bukti').filter(f => f.endsWith('.jpg')).sort();
const R = Object.fromEntries(J.hasil.map(r => [r.id, r]));
const ukuran = buf => { let i = 2; while (i < buf.length) { const m = buf[i + 1], l = buf.readUInt16BE(i + 2); if (m >= 0xC0 && m <= 0xC3) return [buf.readUInt16BE(i + 7), buf.readUInt16BE(i + 5)]; i += 2 + l; } return [1280, 860]; };
gb.forEach((f, k) => {
  const id = f.match(/UAT-\d+/)[0], r = R[id] || {}; const data = fs.readFileSync(ROOT + '/docs/uat/bukti/' + f); const [w, h] = ukuran(data);
  const lebar = 450, tinggi = Math.min(560, Math.round(h * lebar / w)), lebar2 = Math.round(w * tinggi / h);
  s3.push(new Paragraph({ alignment: AlignmentType.CENTER, keepNext: true, pageBreakBefore: k % 2 === 0 && k > 0, spacing: { before: 120, after: 40 }, children: [new ImageRun({ type: 'jpg', data, transformation: { width: lebar2, height: tinggi } })] }));
  s3.push(Cap('Gambar 4.' + (k + 1) + ' ' + f + ' — ' + id + (r.persona ? ' (' + r.persona + ', ' + r.status + '): ' + r.skenario : '')));
});

const footer = new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 20 })] })] });
const potret = { page: { size: A4, margin: { top: 1701, bottom: 1701, left: 2268, right: 1701 } } };
const lanskap = { page: { size: Object.assign({}, A4, { orientation: PageOrientation.LANDSCAPE }), margin: { top: 1701, bottom: 1701, left: 1701, right: 1701 } } };
const hd = (id, nm, lv) => ({ id, name: nm, basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size: 24, bold: true }, paragraph: { spacing: { before: 240, after: 120 }, keepNext: true, outlineLevel: lv } });
const doc = new Document({ creator: 'Tim pengujian HSE Project (simulasi persona)', title: 'Lampiran Bukti UAT — HSE Project 2.2.0',
  styles: { default: { document: { run: { font: FONT, size: 24 } } }, paragraphStyles: [hd('Heading1', 'Heading 1', 0), hd('Heading2', 'Heading 2', 1)] },
  numbering: { config: [{ reference: 'poin', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 567, hanging: 283 } } } }] }] },
  features: { updateFields: true },
  sections: [{ properties: potret, footers: { default: footer }, children: s1 }, { properties: lanskap, footers: { default: footer }, children: s2 }, { properties: potret, footers: { default: footer }, children: s3 }] });
Packer.toBuffer(doc).then(b => { const out = ROOT + '/docs/uat/Lampiran_Bukti_UAT_HSE_Project.docx'; fs.writeFileSync(out, b); console.log('ditulis', out, b.length); });
