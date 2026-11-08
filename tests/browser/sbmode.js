const { chromium } = require('playwright'); const fs = require('fs');
const UMD = fs.readFileSync(require('path').join(__dirname, '..', '.cache', 'sb/package/dist/umd/supabase.js'));
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ serviceWorkers: 'block' });
  const panggilan = new Set();
  await ctx.route('https://cdn.jsdelivr.net/npm/@supabase/**', r => r.fulfill({ body: UMD, contentType: 'application/javascript' }));
  await ctx.route('https://*.supabase.co/**', async r => {
    const u = r.request().url(), m = r.request().method(); panggilan.add(m + ' ' + u.replace(/\?.*/, ''));
    const h = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
    if (m === 'OPTIONS') return r.fulfill({ status: 200, headers: h });
    const j = (b, s) => r.fulfill({ status: s || 200, headers: h, contentType: 'application/json', body: JSON.stringify(b) });
    if (u.includes('/auth/v1/token')) return j({ access_token: 'x.eyJzdWIiOiJ1MSIsImV4cCI6OTk5OTk5OTk5OSwiYWFsIjoiYWFsMiJ9.x', token_type: 'bearer', expires_in: 3600, expires_at: 9999999999, refresh_token: 'r', user: { id: 'u1', email: 'a@rs.id', aud: 'authenticated', factors: [] } });
    if (u.includes('/auth/v1/')) return j({});
    if (u.includes('/rest/v1/profil')) return j({ id: 'u1', nama_tampilan: 'Admin', peran: 'k3rs', unit_id: null, aktif: true });
    if (u.includes('/rest/v1/pengaturan')) return j({ id: 1, nama_instansi: 'RS Uji', wajib_mfa_admin: false, hari_eskalasi: 2, pita_risiko: [{ maks: 4, label: 'Rendah' }, { maks: 9, label: 'Sedang' }, { maks: 14, label: 'Tinggi' }, { maks: 25, label: 'Sangat Tinggi' }], zona_waktu: 'Asia/Makassar' });
    if (u.includes('/rest/v1/unit')) return j([{ id: 1, kode: 'IGD', nama: 'IGD', aktif: true }]);
    if (u.includes('/rest/v1/kategori')) return j([{ kode: 'fisik', nama: 'Fisik', contoh: '', urutan: 1, aktif: true }]);
    if (u.includes('/rest/v1/laporan')) return j([{ id: 'l1', nomor: 'K3-1', jenis: 'kejadian', kategori_kode: 'fisik', unit_id: 1, lokasi: 'Lorong', uraian: 'terpeleset lantai basah', mendesak: true, anonim: false, dampak: 3, kemungkinan: 4, skor: 12, status: 'baru', tanggal_lapor: '2026-11-06', dibuat_pada: '2026-11-06T14:00:00Z' }]);
    if (u.includes('/rest/v1/tindak_lanjut')) return j([]);
    if (/\/rest\/v1\/(jsa|inspeksi|pemantauan|dokumen|ai_riwayat)/.test(u) || u.includes('/rpc/cari_dokumen') || u.includes('/rpc/ringkasan_bulanan'))
      return j({ code: 'PGRST205', message: "Could not find the table 'public.jsa' in the schema cache" }, 404);
    return j([]);
  });
  const p = await ctx.newPage(); const galat = []; p.on('pageerror', e => galat.push(e.message));
  await p.goto('http://localhost:8765/#/masuk'); await p.evaluate(() => { localStorage.setItem('k3_skema_dipilih', 'true'); }); await p.reload();
  await p.fill('input[type=email]', 'a@rs.id'); await p.fill('input[type=password]', 'x'); await p.click('form button[type=submit]'); await p.waitForTimeout(1200);
  for (const r of ['/intel', '/jsa', '/sop', '/bulanan', '/cari?q=kejadian%20lantai']) {
    await p.goto('http://localhost:8765/#' + r); await p.waitForTimeout(900);
    const t = await p.textContent('main'); console.log(r.padEnd(26), /belum diaktifkan|belum aktif/.test(t) ? 'pesan "modul belum aktif" tampil' : '', /K3-1/.test(t) ? '+ laporan K3-1 tetap dianalisis' : '', /Terjadi kendala/.test(t) ? 'KENDALA' : '');
  }
  console.log('galat JS:', galat.length ? galat : 'tidak ada');
  console.log([...panggilan].filter(x => /rest|rpc/.test(x)).join('\n'));
  await b.close();
})();
