const { chromium } = require('playwright');
const fs = require('fs');
const UMD = fs.readFileSync(require('path').join(__dirname, '..', '.cache', 'sb/package/dist/umd/supabase.js'));
const RUTE = ['/beranda','/intel','/intel?tab=risiko','/intel?tab=tren','/intel?tab=cuaca','/intel?tab=kartu','/cari','/cari?q=near%20miss%20shift%20malam%2060%20hari%20terakhir','/cari?q=SOP%20listrik','/cari?tab=riwayat',
  '/jsa','/jsa?id=contoh-jsa-0','/jsa?baru=1&pekerjaan=ganti%20lampu%20plafon%20pakai%20tangga','/inspeksi','/inspeksi?id=contoh-ins-2','/inspeksi?baru=1','/pemantauan','/pemantauan?jenis=kesehatan','/sop','/sop?id=contoh-dok-2&hal=2','/sop?unggah=1',
  '/bulanan','/sinkron','/uji-warna','/menu','/tema','/akun','/dasbor','/semua','/tugas','/admin','/pengaturan','/bantuan','/lapor','/laporan-saya','/asisten','/notifikasi','/pengguna','/log','/qr','/ekspor','/lacak','/mfa','/uji-warna'];
const CUACA = JSON.stringify({ current: { time: '2026-11-07T13:00', temperature_2m: 33, relative_humidity_2m: 72, apparent_temperature: 39, precipitation: 6, weather_code: 95, wind_speed_10m: 30, wind_gusts_10m: 55 },
  hourly: { time: Array.from({length:48},(_,i)=>'2026-11-0'+(7+Math.floor((13+i)/24))+'T'+String((13+i)%24).padStart(2,'0')+':00'), temperature_2m: Array(48).fill(31), apparent_temperature: Array(48).fill(37), precipitation_probability: Array(48).fill(80), precipitation: Array(48).fill(2), weather_code: Array(48).fill(63), wind_gusts_10m: Array(48).fill(42) } });
(async () => {
  const b = await chromium.launch(); let masalah = 0;
  for (const akun of ['k3rs','pj_unit','petugas']) {
    const ctx = await b.newContext({ viewport: { width: +(process.env.LEBAR || 1280), height: 860 }, serviceWorkers: 'block' });
    await ctx.route('https://api.open-meteo.com/**', r => r.fulfill({ body: CUACA, contentType: 'application/json', headers: {'access-control-allow-origin':'*'} }));
    const p = await ctx.newPage(); const err = [];
    p.on('pageerror', e => err.push('JS: ' + e.message)); p.on('console', m => { if (m.type() === 'error') err.push('CONSOLE: ' + m.text()); });
    await p.goto('http://localhost:8765/?demo=1#/masuk'); await p.waitForTimeout(300);
    if (await p.$('.skema-pilih')) { await p.click('text=Lanjut ke halaman masuk'); }
    await p.waitForSelector('[data-peran=' + akun + ']'); await p.click('[data-peran=' + akun + ']'); await p.waitForTimeout(600);
    for (const r of RUTE) {
      err.length = 0;
      await p.goto('http://localhost:8765/?demo=1#' + r); await p.waitForTimeout(r.includes('cuaca') ? 900 : 450);
      const h1 = await p.evaluate(() => (document.querySelector('h1') || {}).textContent || '');
      const galat = await p.evaluate(() => /Terjadi kendala/.test(document.body.innerText));
      const lebih = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      if (lebih > 0) { masalah++; console.log(akun, r, 'OVERFLOW horizontal', lebih, 'px'); }
      if (err.length || galat) { masalah++; console.log(akun, r, '| h1:', h1, '|', galat ? 'HALAMAN KENDALA' : '', err.slice(0, 3).join(' || ').slice(0, 400)); }
    }
    await ctx.close();
  }
  console.log('selesai, masalah:', masalah); await b.close();
})();
