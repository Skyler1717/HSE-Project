// Produksi Video 2 — dokumenter teknis: kode sumber asli, keluaran terminal asli, diagram, dan rekaman aplikasi.
// node produksi_v2.js <dir_kerja> [adegan,...]
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const R = require('./lib-rekam.js');
const DIR = process.argv[2], OUT = path.join(DIR, process.env.KLIP || 'klip', 'v2'); fs.mkdirSync(OUT, { recursive: true });
const ROOT = path.resolve(__dirname, '../..');
const hljs = require(path.join(DIR, 'hl', 'node_modules', 'highlight.js'));
const HLCSS = path.join(DIR, 'hl', 'node_modules', 'highlight.js', 'styles', 'github-dark.css');
const G = JSON.parse(fs.readFileSync(path.join(DIR, process.env.AUDIO || 'audio', 'v2', 'garis_waktu.json')));
const TERM = f => fs.readFileSync(path.join(DIR, 'term', f), 'utf8').replace(/\s+$/, '');
const TRANS = 0.4;
const MG = path.join(__dirname, 'mg', 'mg.html') + '?img=' + path.join(DIR, 'mg'), PANEL = path.join(__dirname, 'mg', 'panel.html');
const hanya = process.argv[3] ? process.argv[3].split(',') : null;

// Sorot sintaks seluruh potongan lalu pecah per baris dengan menjaga span yang terbuka
function kode(berkas, a, b, bahasa) {
  const baris = fs.readFileSync(path.join(ROOT, berkas), 'utf8').split('\n').slice(a - 1, b).join('\n');
  const html = hljs.highlight(baris, { language: bahasa, ignoreIllegals: true }).value;
  const out = []; let buka = [];
  for (const l of html.split('\n')) {
    let s = buka.join('') + l; const re = /<span[^>]*>|<\/span>/g; let m; const st = [...buka];
    while ((m = re.exec(l))) { if (m[0] === '</span>') st.pop(); else st.push(m[0]); }
    s += '</span>'.repeat(st.length); out.push(s); buka = st;
  }
  return { mode: 'kode', berkas, mulaiBaris: a, html: out };
}

(async () => {
  const b = await chromium.launch();
  const T = id => G.find(g => g.id === id).kalimat.map(k => k.mulai);
  const D = id => G.find(g => g.id === id).durasi + (id === G[G.length - 1].id ? 0 : TRANS);
  const H = {};
  const akun = async k => H[k] || (H[k] = await R.masuk(b, k + '@demo.hse'));
  async function adegan(id, potongan) {
    if (hanya && !hanya.includes(id)) return;
    const tt = T(id), total = D(id); let sisa = total, mulaiSeg = 0; const bag = [];
    for (let i = 0; i < potongan.length; i++) {
      const pt = potongan[i]; const dur = i === potongan.length - 1 ? sisa : (pt.sampai !== undefined ? tt[pt.sampai] - mulaiSeg : pt.durasi); sisa -= dur;
      const f = path.join(OUT, id + '_' + i + '.mp4'); const tLokal = tt.map(x => x - mulaiSeg);
      try {
        if (pt.mg) { const p = await R.halamanLokal(b, MG + (pt.judul ? '&judul=' + encodeURIComponent(pt.judul) : '')); await R.rekam(p, f, dur, () => p.evaluate(c => mulai(c), { a: pt.mg, t: pt.t || tLokal })); await p.context().close(); }
        else if (pt.panel) { const p = await R.halamanLokal(b, PANEL); await p.addStyleTag({ path: HLCSS }); const d = Object.assign({ skala: SK }, pt.panel); await R.rekam(p, f, dur, () => { p.evaluate(d => { mulai(d); }, d); }); await p.context().close(); }
        else { const p = await akun(pt.akun); if (pt.rute) { await R.buka(p, pt.rute); await R.tunggu(900); } if (pt.siapkan) await pt.siapkan(p); await R.rekam(p, f, dur, async () => { try { await pt.aksi(p); } catch (e) { console.log('  ! aksi', id, i, e.message.split('\n')[0]); } }); await R.judulLepas(p).catch(() => {}); }
        bag.push(f);
      } catch (e) { console.log('  ! potongan', id, i, e.message.split('\n')[0]); }
      mulaiSeg += dur;
    }
    const daftar = path.join(OUT, id + '.txt'); fs.writeFileSync(daftar, bag.map(f => "file '" + f + "'").join('\n'));
    execFileSync('ffmpeg', ['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', daftar, '-c', 'copy', path.join(OUT, id + '.mp4')]);
    console.log('adegan', id, total.toFixed(1), 'dtk');
  }
  const SK = +(process.env.TEMPO || 1);
  const K = (f, a, b, bhs, judul, sub, fokus) => Object.assign(kode(f, a, b, bhs), { judul, sub, skala: SK, fokus: fokus.map(x => Object.assign({}, x, { t: x.t * SK })) });

  await adegan('v2s1', [{ mg: 'judul2' }]);
  await adegan('v2s2', [{ mg: 'teknologi' }]);
  await adegan('v2s3', [
    { sampai: 1, panel: K('index.html', 1, 36, 'xml', 'Titik masuk aplikasi', 'index.html — CSP ketat dan urutan modul', [{ t: .5, a: 6, b: 6, label: 'Content-Security-Policy: skrip hanya dari situs sendiri & CDN tepercaya' }, { t: 5, a: 24, b: 35, label: 'config.js → api.js → app.js → modul fitur' }]) },
    { sampai: 2, panel: K('js/app.js', 1003, 1030, 'javascript', 'Routing berbasis hash', 'js/app.js', [{ t: .3, a: 1007, b: 1011, label: 'RUTE: alamat → fungsi halaman' }, { t: 3.5, a: 1012, b: 1012, label: 'HAK: peran yang boleh membuka' }, { t: 6, a: 1026, b: 1028, label: 'Pemeriksaan peran sebelum halaman dirender' }]) },
    { sampai: 3, panel: K('js/app.js', 108, 128, 'javascript', 'Membangun antarmuka tanpa template HTML', 'js/app.js — fungsi h()', [{ t: .3, a: 111, b: 113, label: 'createElement: elemen dibuat langsung' }, { t: 4, a: 115, b: 116, label: 'textContent & CSSOM: teks pengguna tidak dieksekusi' }]) },
    { panel: K('js/api.js', 1, 12, 'javascript', 'Satu lapisan data, dua mode', 'js/api.js', [{ t: .3, a: 1, b: 5, label: 'Mode Supabase (data nyata) atau mode demo' }, { t: 5, a: 9, b: 9, label: 'supabase-js 2.45.4 dimuat dari CDN' }]) }]);
  await adegan('v2s3b', [
    { akun: 'petugas.kesling', rute: '/lapor', siapkan: async p => {
        await p.evaluate(() => { const o = document.createElement('div'); o.id = '__net'; o.style.cssText = 'position:fixed;right:18px;top:170px;width:430px;max-height:560px;overflow:hidden;z-index:2147483640;background:rgba(13,17,23,.96);color:#e6edf3;border-radius:12px;box-shadow:0 20px 50px rgba(0,0,0,.45);font:13.5px/1.45 DejaVu Sans Mono,monospace;padding:14px 16px;white-space:pre-wrap'; o.textContent = 'Jaringan (permintaan ke API)\n— menunggu —'; document.documentElement.appendChild(o); });
        p.removeAllListeners('response');
        p.on('response', async r => { const u = r.url(); if (!/\/rest\/v1\/rpc\/kirim_laporan/.test(u)) return; let isi = ''; try { isi = JSON.stringify(JSON.parse(r.request().postData() || '{}'), null, 1); } catch (e) { } let res = ''; try { res = await r.text(); } catch (e) { }
          await p.evaluate(([m, isi, st, res]) => { const o = document.getElementById('__net'); if (o) o.textContent = 'POST /rest/v1/rpc/kirim_laporan\n\nIsi permintaan (JSON):\n' + isi + '\n\nRespons ' + st + ':\n' + res; }, ['POST', isi, r.status(), res]).catch(() => {}); });
        await p.selectOption('select[aria-label="Unit"]', { label: 'IPSRS' }); const d = await p.$('summary:has-text("Tambahkan keterangan")'); if (d) await d.click(); },
      aksi: async p => { await R.judulBawah(p, 'Validasi di frontend', 'Tombol kirim aktif setelah jenis bahaya dipilih'); await R.sorot(p, '#btn-kirim'); await R.tunggu(1500); await R.sorotLepas(p);
        await R.klik(p, '[data-kat="mekanik"]', 800); await R.ketik(p, 'main textarea', '[DEMO] Kabel listrik terkelupas di lorong servis', 16); await R.tunggu(600); await R.sorot(p, '#btn-kirim'); await R.tunggu(1800); await R.sorotLepas(p);
        const sisa = 10 - 0; await R.tunggu(Math.max(0, (T('v2s3b')[1] - 8.5) * 1000));
        await R.judulBawah(p, 'Permintaan ke server', 'RPC kirim_laporan → respons nomor laporan'); await R.klik(p, '#btn-kirim', 800); await R.tunggu(2500); await R.sorot(p, '#__net'); await R.tunggu(3500); await R.sorotLepas(p); } }]);
  await adegan('v2s4', [
    { sampai: 2, panel: K('supabase/01_setup.sql', 273, 313, 'pgsql', 'Logika bisnis di basis data', 'supabase/01_setup.sql — fungsi kirim_laporan', [
      { t: .3, a: 280, b: 283, label: 'SECURITY DEFINER + pemeriksaan peran pengguna' }, { t: 5, a: 288, b: 293, label: 'Validasi jenis, kategori, unit, panjang teks' }, { t: 9, a: 294, b: 296, label: 'Identitas pasien diperiksa lagi di server' },
      { t: 13.2, a: 284, b: 287, label: 'ID klien: laporan tidak tergandakan' }, { t: 17.5, a: 303, b: 313, label: 'Nomor K3-YYMMDD-urut; pelapor anonim tidak disimpan' }]) },
    { sampai: 3, panel: K('supabase/01_setup.sql', 383, 396, 'pgsql', 'Perubahan status hanya lewat fungsi server', 'supabase/01_setup.sql — ubah_status', [{ t: .3, a: 383, b: 386, label: 'Baris dikunci (FOR UPDATE) selama diproses' }, { t: 6, a: 390, b: 395, label: 'Aturan alur: siapa boleh, dari status apa' }]) },
    { panel: K('supabase/23_modul_lanjutan.sql', 314, 327, 'pgsql', 'Trigger: notifikasi otomatis', 'supabase/23_modul_lanjutan.sql', [{ t: .3, a: 315, b: 324, label: 'Laporan kejadian → notifikasi WAJIB ke K3RS' }, { t: 4.5, a: 326, b: 326, label: 'AFTER INSERT pada tabel laporan' }]) }]);
  await adegan('v2s5', [
    { sampai: 1, panel: { mode: 'term', judul: 'Skema basis data', sub: 'Kueri ke basis data uji yang dibangun dari migrasi repositori', berkas: 'psql — hse_demo', blok: [
      { perintah: 'psql -c "select (tabel, fungsi, trigger, kebijakan RLS) di skema public"', keluaran: TERM('stat.txt'), henti: 900 }, { perintah: 'psql -c "select tablename, count(*) from pg_policies group by 1 order by 2 desc limit 8"', keluaran: TERM('pol.txt'), jeda: 50 }] } },
    { sampai: 4, mg: 'erd' },
    { panel: K('supabase/23_modul_lanjutan.sql', 225, 240, 'pgsql', 'Mencegah duplikasi & data tidak konsisten', 'supabase/23_modul_lanjutan.sql', [{ t: .3, a: 232, b: 233, label: 'CHECK: format tautan dan panjang teks dibatasi' }, { t: 4, a: 237, b: 237, label: 'UNIQUE (penerima, kunci): satu peristiwa = satu notifikasi' }]) }]);
  await adegan('v2s6', [
    { sampai: 1, panel: K('integrasi/google-sheets/Kode.gs', 1, 21, 'javascript', 'Google Apps Script → Google Sheets', 'integrasi/google-sheets/Kode.gs', [{ t: .3, a: 2, b: 3, label: 'Satu arah: Supabase sumber resmi, Sheets cermin' }]) },
    { sampai: 3, panel: K('integrasi/google-sheets/Kode.gs', 47, 84, 'javascript', 'Pemicu & sinkronisasi', 'integrasi/google-sheets/Kode.gs', [{ t: .3, a: 48, b: 54, label: 'pasang(): pemicu waktu tiap 10 menit' }, { t: 4, a: 58, b: 64, label: 'Ambil antrean lewat RPC sinkron_ambil + token' }, { t: 11.5, a: 68, b: 75, label: 'Tulis per id (upsert); catat sukses/gagal' }, { t: 16, a: 76, b: 76, label: 'Laporkan hasil lewat sinkron_lapor' }]) },
    { mg: 'arsitektur', t: [0, 1, 2.5, 4], judul: 'Jalur integrasi yang terbukti di kode (produksi belum diperiksa langsung)' }]);
  await adegan('v2s7', [{ mg: 'alur' }]);
  await adegan('v2s8', [
    { sampai: 1, mg: 'aman' },
    { sampai: 2, akun: 'petugas.farmasi', rute: '/semua', aksi: async p => { await R.judulBawah(p, 'Uji hak akses', 'Akun petugas membuka risk register'); await R.gerak(p, 'main', 900); await R.sorot(p, 'main .kosong, main .kartu'); await R.tunggu(2500);
      const n = await p.evaluate(() => window.K3Api.halaman('laporan', {}).then(r => r.total)); await R.sorotLepas(p);
      await p.evaluate(n => { const o = document.createElement('div'); o.style.cssText = 'position:fixed;right:30px;top:180px;width:520px;z-index:2147483640;background:rgba(13,17,23,.96);color:#e6edf3;border-radius:12px;font:16px/1.5 DejaVu Sans Mono,monospace;padding:18px 20px;white-space:pre-wrap;box-shadow:0 20px 50px rgba(0,0,0,.45)'; o.textContent = '> K3Api.halaman("laporan")   // panggil API langsung\n\ntotal: ' + n + '\n\nRLS hanya mengembalikan laporan milik petugas ini.'; document.documentElement.appendChild(o); }, n);
      await R.judulBawah(p, 'Row Level Security', 'Pembatasan di server, bukan hanya tombol'); } },
    { panel: K('supabase/01_setup.sql', 543, 550, 'pgsql', 'Hak baca per kolom', 'supabase/01_setup.sql', [{ t: .3, a: 546, b: 549, label: 'pelapor_id, kode_lacak_hash, id_klien tidak diberikan' }]) }]);
  await adegan('v2s9', [
    { sampai: 1, panel: { mode: 'term', judul: 'Riwayat pengembangan', sub: 'git log (cabang pengembangan)', berkas: 'bash — HSE-Project', blok: [{ perintah: 'git log --oneline -10', keluaran: TERM('git.txt'), jeda: 120 }] } },
    { sampai: 2, panel: { mode: 'term', judul: 'Migrasi basis data bernomor', sub: 'aman dijalankan ulang, masing-masing dengan rollback', berkas: 'bash — HSE-Project', blok: [{ perintah: 'ls supabase', keluaran: TERM('sql.txt'), jeda: 90 }] } },
    { sampai: 3, panel: { mode: 'term', judul: 'Uji regresi otomatis', sub: 'dijalankan ulang untuk video ini', berkas: 'bash — HSE-Project', blok: [
      { perintah: 'tests/db/jalankan.sh | tail -2', keluaran: TERM('db.txt'), henti: 400 }, { perintah: 'node tests/notifikasi/uji_logika.mjs | tail -1', keluaran: TERM('notif.txt'), henti: 400 },
      { perintah: 'grep -E "E2E mode Supabase|Smoke 51" docs/qa/LAPORAN_QA.md', keluaran: TERM('qa.txt'), henti: 400 }, { perintah: 'node -e "rekap status UAT persona"   # tests/uat/hasil_uat.json', keluaran: TERM('uat.txt') }] } },
    { mg: 'rencana' }]);
  await adegan('v2s10', [{ sampai: 1, mg: 'arsitektur', t: [0, 1, 2.5, 4], judul: 'HSE Project — arsitektur akhir' }, { mg: 'tutup2' }]);
  await b.close();
})();
