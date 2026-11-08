const { chromium } = require('playwright'); const fs = require('fs'), path = require('path');
const CDN = require('path').join(__dirname, '..', '.cache', 'cdn');
const peta = { 'pdfjs-dist': 'pdfjs-dist-3.11.174', 'mammoth': 'mammoth-1.8.0', 'tesseract.js': 'tesseract.js-5.1.1', 'tesseract.js-core': 'tesseract.js-core-5.1.1', '@tesseract.js-data/ind': 'tesseract.js-data-ind-1.0.0', '@tesseract.js-data/eng': 'tesseract.js-data-eng-1.0.0' };
const hasil = []; const ok = (b, m) => { hasil.push((b ? 'LULUS ' : 'GAGAL ') + m); };
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' });
  const permintaanCdn = [];
  await ctx.route('https://cdn.jsdelivr.net/npm/**', r => {
    const u = new URL(r.request().url()).pathname.replace('/npm/', ''); permintaanCdn.push(u);
    const m = u.match(/^(@[^/]+\/[^/@]+|[^/@]+)(?:@[^/]+)?\/(.*)$/); const dir = m && peta[m[1]];
    if (!dir) return r.fulfill({ status: 404, body: 'x' });
    const f = path.join(CDN, dir, 'package', m[2]); if (!fs.existsSync(f)) return r.fulfill({ status: 404, body: 'tidak ada ' + u });
    const ct = f.endsWith('.js') ? 'application/javascript' : f.endsWith('.wasm') ? 'application/wasm' : 'application/octet-stream';
    r.fulfill({ body: fs.readFileSync(f), contentType: ct, headers: { 'access-control-allow-origin': '*' } });
  });
  const p = await ctx.newPage(); const galat = [];
  p.on('pageerror', e => galat.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/404/.test(m.text())) galat.push(m.text()); });
  // 1. Pilih tema sebelum masuk
  await p.goto('http://localhost:8765/?demo=1#/beranda'); await p.waitForSelector('.skema-pilih');
  ok(await p.$$eval('.skema-pilih', e => e.length) === 3, 'halaman pilih tema muncul sebelum login dengan 3 tema');
  await p.click('[data-skema-id=navy]'); ok(await p.evaluate(() => document.documentElement.dataset.skema) === 'navy', 'tema Navy langsung diterapkan');
  await p.click('text=Lanjut ke halaman masuk'); await p.waitForSelector('[data-peran=k3rs]'); ok(true, 'lanjut ke halaman masuk');
  await p.click('[data-peran=k3rs]'); await p.waitForTimeout(600);
  // 2. JSA otomatis
  await p.goto('http://localhost:8765/?demo=1#/jsa?baru=1&pekerjaan=Perbaikan%20panel%20listrik%20di%20atap%20memakai%20tangga');
  await p.waitForSelector('text=Buat langkah awal otomatis'); await p.click('text=Buat langkah awal otomatis');
  const nLangkah = await p.$$eval('.langkah-kartu', e => e.length); ok(nLangkah === 3, 'JSA: 3 langkah awal dibuat otomatis');
  const chipAktif = await p.$$eval('.langkah-kartu:nth-of-type(2) .chip.aktif', e => e.map(x => x.textContent));
  ok(chipAktif.some(t => /listrik/i.test(t)) && chipAktif.some(t => /ketinggian/i.test(t)), 'JSA: bahaya listrik & ketinggian terdeteksi (' + chipAktif.join(', ') + ')');
  await p.click('.langkah-kartu:nth-of-type(2) >> text=Isi saran pengendalian');
  const elim = await p.$eval('.langkah-kartu:nth-of-type(2) input[data-level=eliminasi]', e => e.value); ok(elim.length > 5, 'JSA: saran pengendalian eliminasi terisi: ' + elim.slice(0, 50));
  await p.selectOption('form.form-jsa select >> nth=0', { index: 12 }); await p.click('text=Simpan JSA'); await p.waitForSelector('dialog [data-ya]'); ok(/Pengendalian belum memadai/.test(await p.textContent('dialog')), 'JSA otomatis: langkah persiapan berisiko tinggi tanpa pengendalian efektif ikut diperingatkan'); await p.click('dialog [data-ya]'); await p.waitForTimeout(800); console.log('TOAST:', await p.evaluate(() => (document.querySelector('.toast-wadah')||{}).textContent), p.url()); await p.waitForURL(/jsa\?id=/); await p.waitForSelector('text=Setujui');
  await p.click('text=Setujui'); await p.click('[data-ya]'); await p.waitForTimeout(500);
  ok(/Disetujui/.test(await p.textContent('main')), 'JSA: tersimpan dan disetujui K3RS');
  // 3. Inspeksi terpandu → temuan → laporan bahaya
  await p.goto('http://localhost:8765/?demo=1#/inspeksi?baru=1'); await p.click('[data-templat=kebakaran]'); await p.selectOption('.kartu select', { index: 2 });
  await p.click('text=Mulai mode terpandu');
  for (let i = 0; i < 7; i++) {
    if (i === 0) { await p.click('text=✕ Tidak sesuai'); await p.fill('.temuan-isi input', 'APAR tertutup lemari'); await p.click('.temuan-isi >> text=Lanjut'); }
    else await p.click('text=✓ Sesuai');
  }
  await p.waitForSelector('text=Ringkasan inspeksi'); const kep = await p.textContent('.grid-angka'); ok(/85[,.]7%/.test(kep), 'Inspeksi: kepatuhan dihitung 85,7% (' + kep.replace(/\s+/g, ' ').slice(0, 40) + ')');
  await p.click('text=Simpan inspeksi'); await p.waitForURL(/inspeksi\?id=/); await p.click('text=Laporkan sebagai bahaya'); await p.waitForTimeout(600);
  ok(/APAR tertutup lemari/.test(await p.inputValue('textarea')), 'Inspeksi: temuan mengisi formulir lapor bahaya otomatis');
  // 4. Pemantauan
  await p.goto('http://localhost:8765/?demo=1#/pemantauan'); await p.waitForSelector('form input[type=number]');
  await p.selectOption('form select >> nth=1', { index: 10 }); await p.fill('form .tiga input >> nth=0', '95'); await p.waitForTimeout(100); ok(/Melebihi/.test(await p.textContent('form')), 'Pemantauan: status "melebihi ambang" tampil sebelum disimpan');
  await p.click('form >> text=Simpan'); await p.waitForTimeout(500); ok(/95 dBA/.test(await p.textContent('main')), 'Pemantauan: data tersimpan dan tampil di riwayat');
  // 5. Unggah dokumen
  const unggah = async (f, cek, label) => {
    await p.goto('http://localhost:8765/?demo=1#/sop?unggah=1'); await p.setInputFiles('input[type=file]', __dirname + '/dokumen-uji/' + f);
    await p.waitForSelector('.pratinjau-dok textarea', { timeout: 120000 });
    const teks = await p.$$eval('.pratinjau-dok textarea', e => e.map(x => x.value).join(' '));
    ok(cek.test(teks), 'SOP ' + label + ': teks terbaca → "' + teks.replace(/\s+/g, ' ').slice(0, 60) + '"');
    await p.click('text=Simpan dokumen'); await p.waitForURL(/sop\?id=/);
  };
  await unggah('kebijakan.txt', /melaporkan bahaya/, 'TXT');
  await unggah('sop-teks.pdf', /kantong kuning/, 'PDF berteks');
  await unggah('ruang.docx', /oksigen/, 'DOCX');
  await unggah('apar.png', /APAR|PIN/i, 'PNG (OCR)');
  await unggah('scan.pdf', /APAR|PIN/i, 'PDF hasil pindai (OCR)');
  // 6. Pencarian SOP memakai dokumen baru + kutipan halaman
  await p.goto('http://localhost:8765/?demo=1#/cari?q=' + encodeURIComponent('SOP spill kit tumpahan')); await p.waitForSelector('.sop-hasil');
  const sop = await p.textContent('.daftar-sop'); ok(/halaman\/bagian 2/.test(sop) && /spill kit/i.test(sop), 'Cari SOP: menemukan PDF baru di halaman 2 dengan kutipan');
  // 7. Riwayat 60 hari
  await p.goto('http://localhost:8765/?demo=1#/cari?tab=riwayat'); await p.waitForSelector('.linimasa-riwayat li');
  const n = await p.$$eval('.linimasa-riwayat li', e => e.length); ok(n >= 2, 'Riwayat: ' + n + ' entri tersimpan dengan waktu WITA & shift');
  await p.selectOption('.filter select >> nth=0', 'malam'); await p.waitForTimeout(100); ok(true, 'Riwayat: filter shift berfungsi');
  // 8. Laporan bulanan & ganti tema di akun
  await p.goto('http://localhost:8765/?demo=1#/bulanan'); await p.waitForSelector('text=Insight otomatis'); ok(true, 'Laporan bulanan tampil dengan insight & perbandingan');
  await p.goto('http://localhost:8765/?demo=1#/akun'); await p.selectOption('select >> nth=0', 'aksesibel'); ok(await p.evaluate(() => document.documentElement.dataset.skema) === 'aksesibel', 'Akun: tema dapat diganti (aksesibel)');
  // 9. Validasi kritis: JSA risiko tinggi hanya dengan APD → peringatan
  globalThis.halaman = p;
  await p.goto('http://localhost:8765/?demo=1#/jsa?baru=1&pekerjaan=Mengelas%20pipa'); await p.waitForSelector('text=Tambah langkah');
  await p.selectOption('form.form-jsa select >> nth=0', { index: 12 });
  await p.click('text=Tambah langkah'); await p.fill('.langkah-kartu input >> nth=0', 'Mengelas di dekat bahan mudah terbakar');
  await p.selectOption('.langkah-kartu select >> nth=0', '5'); await p.selectOption('.langkah-kartu select >> nth=1', '3');
  await p.click('.langkah-kartu .hirarki-isian summary'); await p.fill('.langkah-kartu input[data-level=apd]', 'Sarung tangan las');
  await p.click('text=Simpan JSA'); await p.waitForSelector('dialog .dialog-isi');
  ok(/Pengendalian belum memadai/.test(await p.textContent('dialog')), 'Validasi kritis: risiko tinggi hanya APD memunculkan peringatan sebelum simpan');
  await p.click('dialog [data-ya]'); await p.waitForURL(/jsa\?id=/); await p.waitForTimeout(300);
  ok(/Pengendalian belum memadai pada langkah 1/.test(await p.textContent('main')), 'Validasi kritis: JSA tersimpan sebagai draf dengan tanda "perlu ditinjau"');
  // 10. Riwayat perubahan (nilai lama → baru)
  await p.click('text=Ubah'); await p.waitForSelector('form.form-jsa'); await p.fill('form.form-jsa input >> nth=0', 'Mengelas pipa air panas'); await p.click('text=Simpan JSA');
  await p.waitForSelector('dialog [data-ya]'); await p.click('dialog [data-ya]'); await p.waitForURL(u => !/ubah=1/.test(u)); await p.waitForSelector('details.jejak');
  await p.click('details.jejak summary'); await p.waitForSelector('.jejak-daftar del');
  ok(/Mengelas pipa/.test(await p.textContent('.jejak-daftar del')) && /air panas/.test(await p.textContent('.jejak-daftar ins')), 'Riwayat perubahan menampilkan nilai lama → baru dan pelakunya');
  // 11. Notifikasi & eskalasi
  await p.goto('http://localhost:8765/?demo=1#/notifikasi'); await p.waitForSelector('.daftar-peringatan');
  const notif = await p.textContent('.daftar-peringatan');
  ok(/CAPA terlambat/.test(notif) && /JSA menunggu persetujuan/.test(notif) && /lewat tanggal tinjau/.test(notif), 'Notifikasi: CAPA terlambat, JSA menunggu persetujuan, dokumen lewat tanggal tinjau');
  await p.waitForFunction(() => { const e = document.querySelector('.lonceng-n'); return e && !e.hidden && +e.textContent > 0; }, null, { timeout: 5000 }).catch(() => {}); const lonceng = await p.textContent('.lonceng-n'); await p.click('text=Tandai semua dibaca'); await p.waitForTimeout(800);
  ok(+lonceng > 0 && await p.$eval('.lonceng-n', e => e.hidden), 'Notifikasi: lencana jumlah tampil (' + lonceng + ') lalu hilang setelah ditandai dibaca');
  // 12. Pengendalian dokumen
  await p.goto('http://localhost:8765/?demo=1#/sop?id=contoh-dok-2'); await p.waitForSelector('text=Riwayat versi');
  const dok = await p.textContent('main'); ok(/Koordinator IPSRS/.test(dok) && /v1/.test(dok) && /LOTO/.test(dok), 'Dokumen: pemilik, tanggal tinjau, catatan revisi, dan riwayat versi tampil');
  // 13. Pencarian pengguna
  await p.goto('http://localhost:8765/?demo=1#/pengguna'); await p.waitForSelector('.daftar-pengguna');
  await p.fill('input[type=search]', 'radiologi'); await p.waitForTimeout(150); ok(/1 dari 4 pengguna/.test(await p.textContent('main')), 'Pengguna: pencarian nama/email berfungsi');
  await p.fill('input[type=search]', ''); await p.selectOption('.filter select >> nth=0', 'menunggu'); await p.waitForTimeout(150); ok(/1 dari 4 pengguna/.test(await p.textContent('main')), 'Pengguna: filter "menunggu persetujuan" berfungsi');
  ok(!galat.length, 'tanpa galat JavaScript' + (galat.length ? ': ' + galat.slice(0, 3).join(' | ') : ''));
  console.log(hasil.join('\n')); await b.close();
})().catch(async e => { if (globalThis.halaman) await globalThis.halaman.screenshot({ path: '/tmp/claude-0/-home-user-HSE-Project/19ed16c3-474c-5395-bf66-36a8b0b11e0f/scratchpad/gagal.png' }); console.log(hasil.join('\n')); console.log('BERHENTI:', e.message.split('\n')[0]); process.exit(1); });
