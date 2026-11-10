// Alat bantu: jalankan aplikasi dalam MODE SUPABASE terhadap server uji lokal (tests/server/rest-uji.js)
const fs = require('fs'), path = require('path');
const UMD = fs.readFileSync(path.join(__dirname, '..', '.cache', 'sb/package/dist/umd/supabase.js'));
const REST = process.env.HSE_REST || 'http://localhost:3101';
const APP = process.env.HSE_URL || 'http://localhost:8765';
const SANDI = 'Uji-Sandi-2026';
async function konteks(browser, opsi) {
  const ctx = await browser.newContext(Object.assign({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' }, opsi || {}));
  await ctx.route('https://cdn.jsdelivr.net/npm/@supabase/**', r => r.fulfill({ body: UMD, contentType: 'application/javascript' }));
  await ctx.route('https://fkynbegfeodymincuucy.supabase.co/**', async r => {
    const q = r.request(); const u = new URL(q.url());
    const h = Object.assign({}, q.headers()); delete h.host;
    try {
      const resp = await fetch(REST + u.pathname + u.search, { method: q.method(), headers: h, body: ['GET', 'HEAD'].includes(q.method()) ? undefined : q.postDataBuffer() });
      const hdr = {}; resp.headers.forEach((v, k) => { hdr[k] = v; });
      await r.fulfill({ status: resp.status, headers: hdr, body: Buffer.from(await resp.arrayBuffer()) });
    } catch (e) { await r.abort(); }
  });
  await ctx.route('https://api.open-meteo.com/**', r => r.fulfill({ status: 503, body: '{}' }));
  return ctx;
}
async function masuk(ctx, email) {
  const p = await ctx.newPage(); const galat = [];
  p.on('pageerror', e => galat.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) galat.push(m.text()); });
  await p.goto(APP + '/#/masuk'); await p.evaluate(() => localStorage.setItem('k3_skema_dipilih', 'true')); await p.reload();
  await p.waitForSelector('input[type=email]'); await p.fill('input[type=email]', email); await p.fill('input[type=password]', SANDI);
  await p.click('form button[type=submit]'); await p.waitForFunction(() => /beranda/.test(location.hash), null, { timeout: 15000 });
  p.galat = galat; return p;
}
const buka = async (p, rute) => {
  const sama = await p.evaluate(r => location.hash === '#' + r, rute).catch(() => false);
  if (sama) await p.evaluate(() => window.K3App.jalankan()); else await p.goto(APP + '/#' + rute);
  await p.waitForTimeout(700);
};
module.exports = { konteks, masuk, buka, APP, SANDI };
