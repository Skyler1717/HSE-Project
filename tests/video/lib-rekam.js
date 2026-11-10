// Perekam adegan video: tangkapan layar Chromium via CDP screencast (JPEG kualitas tinggi) → MP4 1920×1080 30 fps.
// Menambahkan kursor tiruan yang bergerak halus, efek klik, zoom halus, dan lower third — hanya untuk perekaman.
const fs = require('fs'), path = require('path');
const { execFileSync } = require('child_process');
const L = require('../browser/lib-supabase.js');
const LEBAR = 1440, TINGGI = 810, SKALA = 1920 / 1440;
const tunggu = ms => new Promise(r => setTimeout(r, ms));

// Skrip yang disuntik ke setiap halaman: kursor, riak klik, zoom, lower third.
const SUNTIK = `(() => {
  if (window.__rek) return; window.__rek = 1;
  const pasang = () => {
    if (document.getElementById('__kursor')) return;
    const st = document.createElement('style'); st.textContent = \`
      #__kursor{position:fixed;left:0;top:0;width:26px;height:26px;z-index:2147483647;pointer-events:none;transform:translate(-100px,-100px);transition:none;filter:drop-shadow(0 2px 3px rgba(0,0,0,.35))}
      .__riak{position:fixed;width:16px;height:16px;margin:-8px 0 0 -8px;border-radius:50%;border:3px solid #B8202E;z-index:2147483646;pointer-events:none;animation:__riak .6s ease-out forwards}
      @keyframes __riak{from{opacity:.9;transform:scale(.4)}to{opacity:0;transform:scale(3.2)}}
      #__lt{position:fixed;left:48px;bottom:44px;z-index:2147483645;pointer-events:none;font-family:Inter,system-ui,sans-serif;opacity:0;transform:translateX(-30px);transition:opacity .5s ease,transform .5s ease}
      #__lt.on{opacity:1;transform:none}
      #__lt .b1{display:inline-block;background:#B8202E;color:#fff;font-weight:700;font-size:26px;padding:10px 20px 10px 18px;border-radius:6px 6px 6px 0;letter-spacing:.2px}
      #__lt .b2{display:block;width:max-content;max-width:900px;background:rgba(17,24,39,.92);color:#fff;font-size:19px;padding:8px 18px;border-radius:0 6px 6px 6px}
      #__sorot{position:fixed;z-index:2147483644;pointer-events:none;border:3px solid #F5B700;border-radius:10px;box-shadow:0 0 0 9999px rgba(0,0,0,.28);opacity:0;transition:all .45s ease}
      #__sorot.on{opacity:1}
      html{scroll-behavior:smooth}\`;
    document.documentElement.appendChild(st);
    const k = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); k.id = '__kursor'; k.setAttribute('viewBox', '0 0 24 24');
    k.innerHTML = '<path d="M4 2l15 11.5-6.6 1.1 3.9 7.2-2.6 1.4-3.9-7.3L4 20z" fill="#fff" stroke="#111" stroke-width="1.4" stroke-linejoin="round"/>';
    document.documentElement.appendChild(k);
    const lt = document.createElement('div'); lt.id = '__lt'; document.documentElement.appendChild(lt);
    const so = document.createElement('div'); so.id = '__sorot'; document.documentElement.appendChild(so);
    if (window.__pos) k.style.transform = 'translate(' + window.__pos[0] + 'px,' + window.__pos[1] + 'px)';
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', pasang); else pasang();
  addEventListener('mousemove', e => { window.__pos = [e.clientX, e.clientY]; const k = document.getElementById('__kursor'); if (k) k.style.transform = 'translate(' + e.clientX + 'px,' + e.clientY + 'px)'; }, true);
  addEventListener('mousedown', e => { const r = document.createElement('div'); r.className = '__riak'; r.style.left = e.clientX + 'px'; r.style.top = e.clientY + 'px'; document.documentElement.appendChild(r); setTimeout(() => r.remove(), 700); }, true);
})();`;

let posisi = [LEBAR * 0.6, TINGGI * 0.55];
async function konteks(browser, opsi = {}) {
  const ctx = await L.konteks(browser, Object.assign({ viewport: { width: LEBAR, height: TINGGI }, deviceScaleFactor: SKALA, bypassCSP: true }, opsi));
  await ctx.addInitScript(SUNTIK);
  return ctx;
}
async function masuk(browser, email) {
  const ctx = await konteks(browser); const p = await L.masuk(ctx, email); await p.evaluate(SUNTIK); await tunggu(1200); return p;
}
async function halamanLokal(browser, berkas) { // halaman motion graphics lokal
  const ctx = await browser.newContext({ viewport: { width: LEBAR, height: TINGGI }, deviceScaleFactor: SKALA });
  const p = await ctx.newPage(); await p.goto('file://' + berkas); await p.waitForLoadState('load'); return p;
}
async function buka(p, rute) { await L.buka(p, rute); await p.evaluate(SUNTIK).catch(() => {}); await p.mouse.move(posisi[0], posisi[1]); await tunggu(400); }

// Gerak kursor halus (ease-in-out) ke elemen/koordinat
async function gerak(p, target, ms = 900) {
  let x, y;
  if (typeof target === 'string') { const el = p.locator(target).first(); await el.scrollIntoViewIfNeeded().catch(() => {}); const b = await el.boundingBox(); if (!b) throw new Error('tidak ditemukan: ' + target); x = b.x + b.width / 2; y = b.y + b.height / 2; }
  else [x, y] = target;
  const [x0, y0] = posisi, n = Math.max(12, Math.round(ms / 16));
  for (let i = 1; i <= n; i++) { const t = i / n, e = t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; await p.mouse.move(x0 + (x - x0) * e, y0 + (y - y0) * e); await tunggu(ms / n); }
  posisi = [x, y];
}
async function klik(p, target, ms) { await gerak(p, target, ms); await tunggu(150); await p.mouse.down(); await tunggu(90); await p.mouse.up(); await tunggu(250); }
async function ketik(p, target, teks, jeda = 38) { await klik(p, target); await p.keyboard.type(teks, { delay: jeda }); }
async function gulir(p, dy, ms = 1200) { const n = Math.round(ms / 30); for (let i = 0; i < n; i++) { await p.mouse.wheel(0, dy / n); await tunggu(30); } }
async function zoom(p, selektor, skala = 1.6, ms = 900) {
  await p.evaluate(([s, k, ms]) => { const h = document.body; let ox = innerWidth / 2, oy = innerHeight / 2;
    if (s) { const el = document.querySelector(s); if (el) { const b = el.getBoundingClientRect(); ox = b.left + b.width / 2; oy = b.top + b.height / 2; } }
    h.style.transition = 'transform ' + ms + 'ms cubic-bezier(.4,0,.2,1)'; h.style.transformOrigin = ox + 'px ' + (oy + scrollY) + 'px'; h.style.transform = 'scale(' + k + ')'; }, [selektor, skala, ms]);
  await tunggu(ms);
}
async function zoomLepas(p, ms = 800) { await p.evaluate(ms => { document.body.style.transform = 'none'; }, ms); await tunggu(ms); }
async function sorot(p, selektor, pad = 8) {
  await p.evaluate(([s, pad]) => { const so = document.getElementById('__sorot'), el = document.querySelector(s); if (!so) return; if (!el) { so.classList.remove('on'); return; } const b = el.getBoundingClientRect();
    Object.assign(so.style, { left: (b.left - pad) + 'px', top: (b.top - pad) + 'px', width: (b.width + 2 * pad) + 'px', height: (b.height + 2 * pad) + 'px' }); so.classList.add('on'); }, [selektor, pad]);
}
const sorotLepas = p => p.evaluate(() => { const so = document.getElementById('__sorot'); if (so) so.classList.remove('on'); });
async function judulBawah(p, judul, sub) {
  await p.evaluate(([j, s]) => { const lt = document.getElementById('__lt'); if (!lt) return; lt.classList.remove('on'); lt.innerHTML = ''; const a = document.createElement('span'); a.className = 'b1'; a.textContent = j; lt.appendChild(a);
    if (s) { const b = document.createElement('span'); b.className = 'b2'; b.textContent = s; lt.appendChild(b); } requestAnimationFrame(() => lt.classList.add('on')); }, [judul, sub || '']);
}
const judulLepas = p => p.evaluate(() => { const lt = document.getElementById('__lt'); if (lt) lt.classList.remove('on'); });

// Rekam satu adegan: jalankan fungsi aksi, pastikan durasi minimum, susun MP4.
async function rekam(p, keluar, durasi, aksi, opsi = {}) {
  const dir = keluar + '.frames'; fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  const cdp = await p.context().newCDPSession(p); const bingkai = []; let n = 0;
  cdp.on('Page.screencastFrame', async f => { const nama = path.join(dir, String(n++).padStart(6, '0') + '.jpg'); fs.writeFileSync(nama, Buffer.from(f.data, 'base64')); bingkai.push([nama, f.metadata.timestamp]); cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {}); });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: opsi.maxW || 1920, maxHeight: opsi.maxH || 1080, everyNthFrame: 1 });
  // paksa satu bingkai awal
  await p.evaluate(() => { const d = document.createElement('i'); document.documentElement.appendChild(d); requestAnimationFrame(() => d.remove()); });
  const t0 = Date.now() / 1000; await tunggu(120);
  await aksi();
  const sisa = durasi - (Date.now() / 1000 - t0); if (sisa > 0) await tunggu(sisa * 1000);
  const t1 = Date.now() / 1000;
  await cdp.send('Page.stopScreencast'); await tunggu(150); await cdp.detach().catch(() => {});
  if (!bingkai.length) throw new Error('tidak ada bingkai: ' + keluar);
  const awal = bingkai[0][1]; let daftar = '';
  bingkai.forEach(([f, ts], i) => { const akhir = i + 1 < bingkai.length ? bingkai[i + 1][1] : awal + (t1 - t0); daftar += "file '" + f + "'\nduration " + Math.max(0.001, akhir - ts).toFixed(4) + '\n'; });
  daftar += "file '" + bingkai[bingkai.length - 1][0] + "'\n";
  fs.writeFileSync(dir + '/daftar.txt', daftar);
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', dir + '/daftar.txt', '-vf', (opsi.vf || 'scale=1920:1080:flags=lanczos') + ',fps=30,format=yuv420p', '-t', String(durasi), '-c:v', 'libx264', '-preset', 'medium', '-crf', '16', '-r', '30', keluar]);
  if (!process.env.SIMPAN_BINGKAI) fs.rmSync(dir, { recursive: true, force: true });
  return t1 - t0;
}
module.exports = { konteks, masuk, halamanLokal, buka, gerak, klik, ketik, gulir, zoom, zoomLepas, sorot, sorotLepas, judulBawah, judulLepas, rekam, tunggu, SUNTIK };
