const { chromium } = require('playwright');
const fs = require('fs');
const UMD = fs.readFileSync(require('path').join(__dirname, '..', '.cache', 'sb/package/dist/umd/supabase.js'));
(async () => {
  const b = await chromium.launch();
  const calls = [];
  async function setup(ctx) {
    await ctx.route('https://cdn.jsdelivr.net/**', r => r.fulfill({ body: UMD, contentType: 'application/javascript' }));
    await ctx.route('https://*.supabase.co/**', async r => {
      const u = r.request().url(); calls.push(r.request().method() + ' ' + u);
      const h = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
      if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 200, headers: h });
      if (u.includes('/auth/v1/token')) {
        const body = JSON.parse(r.request().postData());
        if (body.password !== 'benar123') return r.fulfill({ status: 400, headers: h, contentType: 'application/json', body: JSON.stringify({ error: 'invalid_grant', error_description: 'Invalid login credentials', code: 'invalid_credentials', msg: 'Invalid login credentials' }) });
        return r.fulfill({ status: 200, headers: h, contentType: 'application/json', body: JSON.stringify({ access_token: 'x.eyJzdWIiOiJ1MSIsImV4cCI6OTk5OTk5OTk5OX0.x', token_type: 'bearer', expires_in: 3600, expires_at: 9999999999, refresh_token: 'r', user: { id: 'u1', email: body.email, aud: 'authenticated', role: 'authenticated', factors: [] } }) });
      }
      if (u.includes('/rest/v1/profil')) return r.fulfill({ status: 200, headers: h, contentType: 'application/json', body: JSON.stringify({ id: 'u1', nama_tampilan: 'Uji', peran: 'pelapor', unit_id: 1, aktif: true }) });
      return r.fulfill({ status: 200, headers: h, contentType: 'application/json', body: '[]' });
    });
  }
  for (const [n, vp] of [['desktop', { width: 1440, height: 900 }], ['tablet', { width: 820, height: 1180 }], ['mobile', { width: 390, height: 844 }], ['mobile-sempit', { width: 320, height: 640 }]]) {
    for (const scheme of ['light', 'dark']) {
      const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: 1, colorScheme: scheme, serviceWorkers: 'block' });
      await setup(ctx); const p = await ctx.newPage();
      p.on('pageerror', e => console.log('ERR', e.message));
      await p.goto('http://localhost:8765/#/masuk'); await p.evaluate(() => localStorage.setItem('k3_skema_dipilih', 'true')); await p.reload(); await p.waitForSelector('.masuk-logo'); await p.waitForTimeout(400);
      await p.screenshot({ path: `${n}-${scheme}.png` });
      const ov = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      if (ov > 0) console.log(n, 'horizontal overflow', ov);
      await ctx.close();
    }
  }
  // login flow
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  await setup(ctx); const p = await ctx.newPage();
  await p.goto('http://localhost:8765/#/masuk'); await p.waitForSelector('.skema-pilih'); await p.click('text=Lanjut ke halaman masuk'); await p.waitForSelector('input[type=email]');
  await p.fill('input[type=email]', 'petugas@rs.id'); await p.fill('input[type=password]', 'salah');
  await p.click('form button[type=submit]'); await p.waitForTimeout(800);
  await p.screenshot({ path: 'mobile-galat.png' });
  console.log('error shown:', await p.evaluate(() => document.querySelector('.masuk-form')?.innerText.match(/salah|Galat|gagal|sandi[^\n]*/i)?.[0]));
  await p.fill('input[type=password]', 'benar123'); await p.click('form button[type=submit]'); await p.waitForTimeout(1500);
  console.log('after login hash:', await p.evaluate(() => location.hash));
  await p.screenshot({ path: 'mobile-setelah-masuk.png' });
  console.log([...new Set(calls)].join('\n'));
  await b.close();
})();
