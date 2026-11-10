// Melengkapi basis data demonstrasi (hse_demo) lewat aplikasi: dokumen SOP contoh dan satu izin kerja yang disahkan & aktif.
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const L = require('../browser/lib-supabase.js');
const sql = q => execFileSync('psql', ['-d', 'hse_demo', '-tAq', '-c', q]).toString().trim();
const tunggu = ms => new Promise(r => setTimeout(r, ms));
async function dialogYa(p) { await p.waitForSelector('dialog [data-ya]', { timeout: 8000 }); await p.click('dialog [data-ya]'); }
(async () => {
  const b = await chromium.launch(); const H = {};
  for (const [k, e] of [['p1', 'p1.koordinator'], ['pj', 'pj.ipsrs'], ['sup', 'pj.kesling']]) H[k] = await L.masuk(await L.konteks(b), e + '@demo.hse');
  // 1) Dokumen SOP contoh (teks sintetis, metode manual)
  const DOK = [
    ['SOP Penggunaan APAR', 'SOP/K3/001', 'sop', 'Koordinator K3', ['[DEMO] Tarik pin pengaman, arahkan selang ke pangkal api, tekan tuas, sapukan dari sisi ke sisi (PASS). Laporkan setiap penggunaan APAR kepada tim K3.']],
    ['SOP Lockout/Tagout Pekerjaan Listrik', 'SOP/IPSRS/014', 'sop', 'Koordinator IPSRS', ['[DEMO] Identifikasi sumber energi, matikan MCB, pasang gembok dan label, uji tidak bertegangan sebelum bekerja.']],
    ['Pedoman Penanganan Tumpahan B3', 'PDM/K3/007', 'pedoman', 'Koordinator K3', ['[DEMO] Amankan area, gunakan APD sesuai SDS, serap dengan spill kit, kemas sebagai limbah B3, laporkan kejadian.']]];
  for (const [judul, nomor, jenis, pemilik, bag] of DOK) {
    if (+sql("select count(*) from dokumen where nomor = '" + nomor + "'")) continue;
    await H.p1.evaluate(a => window.K3Api.simpanDokumen({ judul: a[0], nomor: a[1], versi: '2', jenis: a[2], status: 'aktif', pemilik: a[3], metode_ekstraksi: 'manual', berlaku_mulai: '2026-01-02', tanggal_tinjau: '2027-01-02', catatan_revisi: 'Revisi berkala (data demonstrasi)' }, a[4].map((t, i) => ({ halaman: i + 1, teks: t })), null), [judul, nomor, jenis, pemilik, bag]);
  }
  console.log('dokumen', sql('select count(*) from dokumen'));
  // 2) Izin kerja: periksa butir → ajukan → supervisor → tinjauan K3 → sahkan → mulai
  const izin = sql("select id from izin_kerja where status = 'draf' order by dibuat_pada limit 1");
  if (izin) {
    const pj = H.pj; await L.buka(pj, '/izin?id=' + izin); await pj.waitForSelector('.ceklis-baris');
    const n = await pj.$$eval('.ceklis-baris', e => e.length); for (let i = 0; i < n; i++) await pj.click('.ceklis-baris >> nth=' + i + ' >> text=✓ Ya');
    await pj.click('text=Ajukan'); await dialogYa(pj); await tunggu(1200);
    await L.buka(H.sup, '/izin?id=' + izin); await H.sup.click('text=Setujui (supervisor)'); await dialogYa(H.sup); await tunggu(1000);
    await L.buka(H.p1, '/izin?id=' + izin); await H.p1.click('text=Setujui tinjauan K3'); await dialogYa(H.p1); await tunggu(1000);
    await H.p1.click('text=Sahkan izin'); await dialogYa(H.p1); await tunggu(1000);
    await L.buka(pj, '/izin?id=' + izin); await pj.click('button:has-text("Mulai pekerjaan")'); await dialogYa(pj); await tunggu(1000);
    console.log('izin', sql("select nomor || ':' || status from izin_kerja where id = '" + izin + "'"));
  }
  await b.close();
})();
