/* modul-lanjut.js — Paginasi sisi server, Investigasi & RCA (5 Why, Fishbone), CAPA, Izin Kerja (PTW),
   Toolbox Meeting & Pelatihan, dan Pusat Notifikasi. Semua aturan ditegakkan di basis data (supabase/23_modul_lanjutan.sql);
   tampilan hanya menyembunyikan tombol yang memang tidak berlaku. */
(function () {
  'use strict';
  const A = window.K3App, I = window.K3Intel, G = window.K3Grafik;
  if (!A || !I || !G || !A.tab) return;
  const { h, ikon, badge, tombol, sibuk, bidang, pilih, toast, tampil, halaman, kosong, pergi, peran, namaUnit, kat, LS, konfirmasi, LEVEL, JENIS } = A;
  const API = A.API, qs = A.qs;
  const saya = () => A.S.sesi.profil.id, unitSaya = () => A.S.sesi.profil.unit_id;
  const staf = () => ['k3rs', 'pj_unit'].includes(peran()), k3 = () => peran() === 'k3rs';
  const WITA = d => d ? new Date(d).toLocaleString('id-ID', { timeZone: 'Asia/Makassar', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
  const keLokal = d => { if (!d) return ''; const x = new Date(d); const p = n => String(n).padStart(2, '0'); return x.getFullYear() + '-' + p(x.getMonth() + 1) + '-' + p(x.getDate()) + 'T' + p(x.getHours()) + ':' + p(x.getMinutes()); };
  const dariLokal = v => v ? new Date(v).toISOString() : null;
  const opsiUnit = (semua) => (k3() || semua ? A.S.ref.unit.filter(u => u.aktif) : A.S.ref.unit.filter(u => u.id === unitSaya())).map(u => [u.id, u.nama]);
  let supervisorCache = null;
  const daftarSupervisor = async () => supervisorCache || (supervisorCache = await API.daftarSupervisor());
  function galatHalaman(judul, rute, e) {
    tampil(halaman(judul, rute, [h('div', { class: 'kartu bahaya-kotak' }, h('div', { class: 'kartu-kepala' }, h('span', { class: 'ikon-kotak merah' }, ikon('awas')), h('strong', { text: e.belumSiap ? 'Modul belum tersedia' : 'Terjadi kendala' })), h('p', { text: e.message }))]));
  }
  // Langkah alur kerja (stepper) — status saat ini diberi tanda; status cabang (ditolak/ditangguhkan/…) ditampilkan terpisah
  function stepper(langkah, aktif, cabang) {
    const i = langkah.findIndex(x => x[0] === aktif);
    return h('div', {}, h('ol', { class: 'stepper', 'aria-label': 'Tahap alur kerja' }, langkah.map(([k, t], j) => h('li', { class: j < i ? 'lewat' : j === i ? 'kini' : '', 'aria-current': j === i ? 'step' : null }, h('span', { class: 'st-tanda', text: j < i ? '✓' : String(j + 1) }), h('span', { text: t })))),
      cabang ? h('p', { class: 'cabang-status', role: 'status' }, ikon('awas'), h('strong', { text: cabang })) : null);
  }

  // =====================================================================
  // PAGINASI SISI SERVER (komponen umum)
  // =====================================================================
  function pager(st, total, ubah) {
    const halamanAkhir = Math.max(1, Math.ceil(total / st.ukuran)), awal = total ? (st.halaman - 1) * st.ukuran + 1 : 0, akhir = Math.min(total, st.halaman * st.ukuran);
    const ke = n => { st.halaman = Math.min(halamanAkhir, Math.max(1, n)); ubah(); };
    return h('nav', { class: 'pager', 'aria-label': 'Halaman data' },
      h('span', { class: 'kecil', 'aria-live': 'polite', text: total ? awal + '–' + akhir + ' dari ' + total.toLocaleString('id-ID') + ' data' : '0 data' }),
      h('div', { class: 'pager-tombol' },
        tombol('«', () => ke(1), 'kedua kecil', { 'aria-label': 'Halaman pertama', disabled: st.halaman <= 1 }),
        tombol('‹', () => ke(st.halaman - 1), 'kedua kecil', { 'aria-label': 'Halaman sebelumnya', disabled: st.halaman <= 1 }),
        h('span', { class: 'pager-hal', text: 'Hal. ' + st.halaman + ' / ' + halamanAkhir }),
        tombol('›', () => ke(st.halaman + 1), 'kedua kecil', { 'aria-label': 'Halaman berikutnya', disabled: st.halaman >= halamanAkhir }),
        tombol('»', () => ke(halamanAkhir), 'kedua kecil', { 'aria-label': 'Halaman terakhir', disabled: st.halaman >= halamanAkhir })),
      pilih([[10, '10 / hal'], [25, '25 / hal'], [50, '50 / hal'], [100, '100 / hal']], st.ukuran, { 'aria-label': 'Jumlah per halaman', onchange: e => { st.ukuran = +e.target.value; st.halaman = 1; ubah(); } }));
  }
  // Pengendali daftar: memanggil server setiap filter/halaman berubah; filter tetap saat pindah halaman
  function daftarServer(cfg) {
    const st = Object.assign({ halaman: 1, ukuran: LS.get('k3_ukuran_hal', 25) }, cfg.awal || {});
    const isi = h('div', { class: 'daftar-server', 'aria-busy': 'false' }), atas = h('div'), bawah = h('div');
    let urutan = 0, terakhir = null;
    const muat = async () => {
      LS.set('k3_ukuran_hal', st.ukuran);
      const ini = ++urutan; isi.setAttribute('aria-busy', 'true'); isi.classList.add('memuat-data');
      try {
        const r = await API.halaman(cfg.tabel, Object.assign(cfg.opsi(st), { halaman: st.halaman, ukuran: st.ukuran }));
        if (ini !== urutan) return; terakhir = r;
        if (r.baris.length === 0 && st.halaman > 1 && r.total > 0) { st.halaman = Math.ceil(r.total / st.ukuran); return muat(); }
        isi.replaceChildren(r.baris.length ? cfg.render(r.baris) : kosong(cfg.kosong || 'Tidak ada data yang cocok dengan filter.'));
        atas.replaceChildren(pager(st, r.total, muat)); bawah.replaceChildren(r.total > st.ukuran ? pager(st, r.total, muat) : h('span'));
      } catch (e) { if (ini !== urutan) return; isi.replaceChildren(h('div', { class: 'kartu bahaya-kotak' }, h('p', { text: e.message }), tombol([ikon('muat'), 'Coba lagi'], muat, 'kedua'))); }
      finally { if (ini === urutan) { isi.setAttribute('aria-busy', 'false'); isi.classList.remove('memuat-data'); } }
    };
    const ekspor = async btn => {
      await sibuk(btn, async () => {
        const semua = await API.semuaTersaring(cfg.tabel, cfg.opsi(st));
        A.unduh(cfg.namaEkspor + '-' + I.tanggalLokal() + '.csv', A.keCSV(semua, cfg.kolomEkspor)); toast(semua.length + ' baris diekspor (sesuai filter)', 'ok');
        API.catatEkspor && API.catatEkspor(cfg.namaEkspor + ' (' + semua.length + ')');
      }).catch(() => {});
    };
    return { st, muat, el: h('div', { class: 'daftar-server-wadah' }, atas, isi, bawah), tombolEkspor: cfg.kolomEkspor ? tombol([ikon('unduh'), 'Ekspor CSV'], ev => ekspor(ev.currentTarget), 'kedua kecil') : null, ulang: () => { st.halaman = 1; muat(); }, terakhir: () => terakhir };
  }
  A.daftarServer = daftarServer;
  const inputCari = (ph, fn) => { let t; return h('input', { type: 'search', placeholder: ph, 'aria-label': ph, oninput: e => { clearTimeout(t); t = setTimeout(() => fn(e.target.value), 350); } }); };

  // ---------- Daftar laporan / risk register (server) ----------
  async function hLaporanServer(rute, judul) {
    const P = A.paramHash();
    const f = { status: P.get('status') || '', unit: P.get('unit') || '', kategori: '', jenis: P.get('jenis') || '', cari: '', mendesak: P.get('mendesak') === '1', dari: '', sampai: '', urut: rute === '/tugas' ? 'target_tanggal' : 'dibuat_pada' };
    const ctl = daftarServer({ tabel: 'laporan', namaEkspor: rute === '/tugas' ? 'tugas-saya' : 'risk-register', kosong: rute === '/tugas' ? 'Tidak ada tugas sesuai filter.' : 'Tidak ada laporan yang cocok.',
      opsi: () => ({ filter: [rute === '/tugas' ? ['pj_id', 'eq', saya()] : null, f.status === 'terbuka' ? ['status', 'in', ['baru', 'ditugaskan', 'dalam_tindak_lanjut']] : ['status', 'eq', f.status], ['unit_id', 'eq', f.unit], ['kategori_kode', 'eq', f.kategori], ['jenis', 'eq', f.jenis], f.mendesak ? ['mendesak', 'eq', true] : null].filter(Boolean),
        cari: { kolom: ['cari'], teks: f.cari }, rentang: { kolom: 'tanggal_lapor', dari: f.dari, sampai: f.sampai }, urut: f.urut, naik: f.urut === 'target_tanggal' }),
      render: L => A.daftarLaporanEl(L, ''),
      kolomEkspor: [['nomor', 'nomor'], ['tanggal_lapor', 'tanggal'], [r => JENIS[r.jenis] || r.jenis, 'jenis'], [r => kat(r.kategori_kode).nama, 'kategori'], [r => namaUnit(r.unit_id), 'unit'], ['lokasi', 'lokasi'], ['uraian', 'uraian'], ['dampak', 'dampak'], ['kemungkinan', 'kemungkinan'], ['skor', 'skor'], [r => r.skor == null ? '' : A.tingkat(r.skor), 'tingkat'], ['status', 'status'], ['target_tanggal', 'target'], ['level_pengendalian', 'pengendalian'], [r => r.mendesak ? 'ya' : '', 'mendesak']] });
    const ubah = (k, v) => { f[k] = v; ctl.ulang(); };
    const filter = h('div', { class: 'kartu filter filter-luas' },
      inputCari('Cari nomor, lokasi, uraian…', v => ubah('cari', v)),
      pilih([['', 'Semua status'], ['terbuka', 'Belum selesai']].concat(Object.entries(A.STATUS)), f.status, { 'aria-label': 'Status', onchange: e => ubah('status', e.target.value) }),
      pilih([['', 'Semua unit']].concat(A.S.ref.unit.map(u => [u.id, u.nama])), f.unit, { 'aria-label': 'Unit', onchange: e => ubah('unit', e.target.value) }),
      pilih([['', 'Semua jenis bahaya']].concat(A.S.ref.kategori.map(k => [k.kode, k.nama])), '', { 'aria-label': 'Jenis bahaya', onchange: e => ubah('kategori', e.target.value) }),
      pilih([['', 'Semua jenis laporan']].concat(Object.entries(JENIS).map(([k, v]) => [k, v.split(' /')[0]])), f.jenis, { 'aria-label': 'Jenis laporan', onchange: e => ubah('jenis', e.target.value) }),
      bidang('Dari tanggal', h('input', { type: 'date', onchange: e => ubah('dari', e.target.value) })), bidang('Sampai tanggal', h('input', { type: 'date', onchange: e => ubah('sampai', e.target.value) })),
      pilih([['dibuat_pada', 'Terbaru'], ['tanggal_lapor', 'Tanggal lapor'], ['skor', 'Skor risiko tertinggi'], ['target_tanggal', 'Target terdekat']], f.urut, { 'aria-label': 'Urutkan', onchange: e => { f.urut = e.target.value; ctl.ulang(); } }),
      h('label', { class: 'saklar' }, h('input', { type: 'checkbox', checked: f.mendesak, onchange: e => ubah('mendesak', e.target.checked) }), h('span', { text: 'Hanya mendesak' })), ctl.tombolEkspor);
    tampil(halaman(judul, rute, [filter, ctl.el]));
    ctl.muat();
  }

  // ---------- Pengguna (server) ----------
  async function hPenggunaServer() {
    const f = { q: '', status: '', peran: '' }; const st = { halaman: 1, ukuran: LS.get('k3_ukuran_hal', 25) };
    const isi = h('div', { class: 'daftar daftar-pengguna' }), pg = h('div');
    const baris = u => {
      const pr = pilih(Object.entries(A.PERAN), u.peran), un = pilih([['', '— tanpa unit —']].concat(A.S.ref.unit.map(x => [x.id, x.nama])), u.unit_id || '');
      const ak = h('input', { type: 'checkbox', checked: u.aktif }); const diri = u.id === saya();
      const btn = tombol('Simpan', async ev => { await sibuk(ev.currentTarget, async () => { await API.aturPengguna(u.id, pr.value, un.value ? +un.value : null, ak.checked); toast('Tersimpan', 'ok'); }).catch(() => {}); }, 'kedua kecil');
      if (diri) { pr.disabled = true; ak.disabled = true; btn.disabled = true; }
      return h('div', { class: 'kartu pengguna' + (u.aktif ? '' : ' menunggu') }, h('div', { class: 'kepala-p' }, h('span', { class: 'avatar', 'aria-hidden': 'true', text: A.inisial(u.nama) }),
        h('div', {}, h('strong', { text: u.nama }), h('div', { class: 'kecil', text: (u.email || '') + ' · sejak ' + A.tgl(u.dibuat) + (diri ? ' · (akun Anda)' : '') })), u.aktif ? badge('✓ Aktif', 'rk-0') : badge('△ Menunggu persetujuan', 'rk-1')),
        h('div', { class: 'dua' }, bidang('Peran', pr), bidang('Unit', un)), h('label', { class: 'saklar' }, ak, h('span', { text: 'Aktif (boleh memakai aplikasi)' })), btn);
    };
    const muat = async () => {
      LS.set('k3_ukuran_hal', st.ukuran);
      try { const r = await API.daftarPenggunaHalaman(f.q, f.status, f.peran, st.ukuran, (st.halaman - 1) * st.ukuran);
        isi.replaceChildren(...(r.baris.length ? r.baris.map(baris) : [kosong('Tidak ada pengguna yang cocok.')])); pg.replaceChildren(pager(st, r.total, muat)); }
      catch (e) { isi.replaceChildren(h('p', { class: 'galat-teks', text: e.message })); }
    };
    const ubah = (k, v) => { f[k] = v; st.halaman = 1; muat(); };
    tampil(halaman('Pengguna', '/admin', [h('p', { class: 'kecil', text: 'Akun baru dibuat di Supabase (Authentication → Users) lalu diaktifkan di sini. Pengguna yang menunggu persetujuan ditampilkan paling atas.' }),
      h('div', { class: 'kartu filter' }, inputCari('Cari nama atau email…', v => ubah('q', v)),
        pilih([['', 'Semua status'], ['menunggu', 'Menunggu persetujuan'], ['aktif', 'Aktif']], '', { 'aria-label': 'Filter status', onchange: e => ubah('status', e.target.value) }),
        pilih([['', 'Semua peran']].concat(Object.entries(A.PERAN)), '', { 'aria-label': 'Filter peran', onchange: e => ubah('peran', e.target.value) })), pg, isi], { kembali: true }));
    muat();
  }

  // =====================================================================
  // INVESTIGASI KECELAKAAN & ANALISIS AKAR MASALAH
  // =====================================================================
  const ST_INV = { draf: ['✎ Draf', 'rk-x'], analisis: ['↻ Analisis', 'rk-1'], menunggu_persetujuan: ['◇ Menunggu persetujuan', 'rk-2'], disetujui: ['✓ Disetujui', 'rk-0'], ditutup: ['■ Ditutup', 'netral'], dibatalkan: ['– Dibatalkan', 'rk-x'] };
  const badgeInv = s => badge((ST_INV[s] || [s])[0], (ST_INV[s] || [, 'netral'])[1]);
  const KAT_FB = [['manusia', 'Manusia (Man)'], ['mesin', 'Mesin/Peralatan (Machine)'], ['metode', 'Metode (Method)'], ['material', 'Material'], ['pengukuran', 'Pengukuran (Measurement)'], ['lingkungan', 'Lingkungan (Environment)']];

  async function hInvestigasi() {
    const q = qs();
    if (q.get('id')) return detailInvestigasi(q.get('id'), q.get('tab') || 'ringkasan', q.get('cetak') === '1');
    if (q.get('baru')) return mulaiInvestigasi(q.get('baru'));
    const f = { status: '', cari: '' };
    const ctl = daftarServer({ tabel: 'investigasi', namaEkspor: 'investigasi', kosong: 'Belum ada investigasi.',
      opsi: () => ({ filter: [['status', 'eq', f.status]], cari: { kolom: ['nomor', 'lokasi', 'akar_masalah'], teks: f.cari } }),
      render: X => h('div', { class: 'daftar' }, X.map(x => h('a', { class: 'kartu laporan', href: '#/investigasi?id=' + encodeURIComponent(x.id) },
        h('div', { class: 'kartu-kepala' }, h('strong', { text: x.nomor + ' · ' + (x.lokasi || namaUnit(x.unit_id)) }), badgeInv(x.status)),
        h('div', { class: 'meta kecil', text: namaUnit(x.unit_id) + ' · dibuat ' + A.tgl(x.dibuat_pada) + (x.akar_masalah ? ' · akar: ' + x.akar_masalah.slice(0, 80) : '') })))),
      kolomEkspor: [['nomor', 'nomor'], [r => namaUnit(r.unit_id), 'unit'], ['lokasi', 'lokasi'], ['status', 'status'], ['penyebab_langsung', 'penyebab_langsung'], ['penyebab_dasar', 'penyebab_dasar'], ['akar_masalah', 'akar_masalah'], ['dibuat_pada', 'dibuat'], ['disetujui_pada', 'disetujui'], ['ditutup_pada', 'ditutup']] });
    // Kejadian/nyaris celaka 90 hari yang belum diinvestigasi
    const perlu = h('div');
    (async () => {
      try {
        const [L, inv] = await Promise.all([API.halaman('laporan', { filter: [['jenis', 'in', ['kejadian', 'nyaris_celaka']]], rentang: { kolom: 'tanggal_lapor', dari: I.geserHari(I.tanggalLokal(), -89) }, ukuran: 100 }),
          API.halaman('investigasi', { kolom: 'laporan_id,status', filter: [['status', 'neq', 'dibatalkan']], ukuran: 100 })]);
        const sudah = new Set(inv.baris.map(x => x.laporan_id)); const x = L.baris.filter(l => !sudah.has(l.id));
        perlu.replaceChildren(h('section', { class: 'kartu' }, h('div', { class: 'kartu-kepala' }, h('h2', { text: 'Perlu investigasi (90 hari)' }), badge(x.length + ' kejadian', x.length ? 'rk-2' : 'rk-0')),
          x.length ? h('div', { class: 'daftar-ringkas' }, x.slice(0, 20).map(l => h('div', { class: 'baris-ringkas' }, h('strong', { text: l.nomor }), h('span', { text: A.tgl(l.tanggal_lapor) + ' · ' + (JENIS[l.jenis] || '').split(' /')[0] + ' · ' + kat(l.kategori_kode).nama + ' · ' + namaUnit(l.unit_id) }),
            staf() ? h('a', { class: 'btn kedua kecil', href: '#/investigasi?baru=' + encodeURIComponent(l.id) }, ikon('cari'), 'Mulai investigasi') : null))) : h('p', { class: 'ok-teks' }, ikon('centang'), ' Semua kejadian sudah diinvestigasi.')));
      } catch (e) { perlu.replaceChildren(h('p', { class: 'galat-teks', text: 'Daftar kejadian belum dapat dimuat: ' + e.message })); }
    })();
    const filter = h('div', { class: 'kartu filter' }, inputCari('Cari nomor, lokasi, akar masalah…', v => { f.cari = v; ctl.ulang(); }),
      pilih([['', 'Semua status']].concat(Object.entries(ST_INV).map(([k, v]) => [k, v[0]])), '', { 'aria-label': 'Status', onchange: e => { f.status = e.target.value; ctl.ulang(); } }), ctl.tombolEkspor);
    tampil(halaman('Investigasi & analisis akar masalah', '/investigasi', [h('p', { class: 'kecil', text: 'Alur: laporan kejadian → investigasi → analisis akar masalah (5 Why/Fishbone) → CAPA → persetujuan K3RS → verifikasi → penutupan.' }), perlu, filter, ctl.el]));
    ctl.muat();
  }
  async function mulaiInvestigasi(laporanId) {
    let l, sup;
    try { [l, sup] = await Promise.all([API.ambilSatu('laporan', laporanId), daftarSupervisor()]); } catch (e) { return galatHalaman('Investigasi baru', '/investigasi', e); }
    if (!l) return galatHalaman('Investigasi baru', '/investigasi', new Error('Laporan tidak ditemukan atau tidak berwenang.'));
    const ketua = pilih(sup.map(s => [s.id, s.nama + ' · ' + A.PERAN[s.peran]]), saya());
    const waktu = h('input', { type: 'datetime-local', value: keLokal(l.anonim ? null : l.dibuat_pada) }), lokasi = h('input', { maxlength: 160, value: l.lokasi || '' }), pekerjaan = h('input', { maxlength: 200 });
    const btn = h('button', { type: 'submit', class: 'btn utama besar' }, ikon('cari'), 'Buat investigasi');
    tampil(halaman('Investigasi baru', '/investigasi', [
      h('section', { class: 'kartu' }, h('h2', { text: 'Laporan sumber: ' + l.nomor }), h('p', { text: (JENIS[l.jenis] || '') + ' · ' + kat(l.kategori_kode).nama + ' · ' + namaUnit(l.unit_id) }), h('p', { class: 'kecil', text: l.uraian || '' }), A.badgeTingkat(l.skor)),
      h('form', { class: 'kartu', onsubmit: async e => { e.preventDefault(); await sibuk(btn, async () => {
        const r = await API.simpanBaris('investigasi', { laporan_id: l.id, ketua_id: ketua.value, waktu_kejadian: dariLokal(waktu.value), lokasi: lokasi.value.trim(), pekerjaan: pekerjaan.value.trim() });
        toast('Investigasi ' + r.nomor + ' dibuat', 'ok'); pergi('/investigasi?id=' + encodeURIComponent(r.id));
      }).catch(() => {}); } }, bidang('Ketua tim investigasi', ketua, 'Ketua mendapat notifikasi penugasan.'), h('div', { class: 'dua' }, bidang('Waktu kejadian', waktu), bidang('Lokasi', lokasi)), bidang('Pekerjaan saat kejadian', pekerjaan), btn)], { kembali: true, sempit: true }));
  }

  // Fishbone (Ishikawa) — diagram SVG dari data kategori
  function diagramFishbone(fb) {
    const NS = 'http://www.w3.org/2000/svg', el = (t, a, ...k) => { const e = document.createElementNS(NS, t); for (const [x, v] of Object.entries(a || {})) if (v != null) e.setAttribute(x, v); k.forEach(c => c && e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c)); return e; };
    const W = 1000, H = 560, Y = H / 2, kepalaX = 830;
    const s = el('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'fishbone-svg', role: 'img', 'aria-label': 'Diagram fishbone: ' + (fb.masalah || 'masalah') });
    s.appendChild(el('title', {}, 'Diagram fishbone (Ishikawa)'));
    s.appendChild(el('line', { x1: 40, y1: Y, x2: kepalaX, y2: Y, class: 'fb-tulang' }));
    s.appendChild(el('path', { d: `M${kepalaX} ${Y - 70}L${W - 10} ${Y - 70}L${W - 10} ${Y + 70}L${kepalaX} ${Y + 70}Z`, class: 'fb-kepala' }));
    const fo = el('foreignObject', { x: kepalaX + 6, y: Y - 64, width: W - kepalaX - 22, height: 128 }); const div = document.createElement('div'); div.className = 'fb-masalah'; div.textContent = fb.masalah || 'Tuliskan pernyataan masalah'; fo.appendChild(div); s.appendChild(fo);
    KAT_FB.forEach(([k, label], i) => {
      const atas = i % 2 === 0, kol = Math.floor(i / 2), xs = 120 + kol * 250, yu = atas ? 40 : H - 40;
      s.appendChild(el('line', { x1: xs, y1: yu, x2: xs + 160, y2: Y, class: 'fb-cabang' }));
      s.appendChild(el('text', { x: xs - 10, y: atas ? yu - 12 : yu + 22, class: 'fb-kategori' }, label.split(' (')[0]));
      ((fb.kategori || {})[k] || []).slice(0, 5).forEach((c, j) => {
        const t = (j + 1) / 6, x = xs + 160 * t, y = yu + (Y - yu) * t;
        s.appendChild(el('line', { x1: x - 90, y1: y, x2: x, y2: y, class: 'fb-sebab' + (c.akar ? ' akar' : '') }));
        s.appendChild(el('text', { x: x - 92, y: y - 4, class: 'fb-teks' + (c.akar ? ' akar' : ''), 'text-anchor': 'end' }, (c.akar ? '★ ' : '') + String(c.teks || '').slice(0, 34)));
        (c.sub || []).slice(0, 2).forEach((sb, m) => s.appendChild(el('text', { x: x - 92, y: y + 12 + m * 12, class: 'fb-sub', 'text-anchor': 'end' }, '↳ ' + String(sb).slice(0, 34))));
      });
    });
    return s;
  }
  function unduhSvg(svg, nama) {
    const salin = svg.cloneNode(true); salin.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    const gaya = document.createElementNS('http://www.w3.org/2000/svg', 'style'); gaya.textContent = '.fb-tulang{stroke:#1B2534;stroke-width:5}.fb-cabang{stroke:#1B2534;stroke-width:3}.fb-sebab{stroke:#707782;stroke-width:2}.fb-sebab.akar{stroke:#B8202E;stroke-width:3}.fb-kepala{fill:#FBEAE9;stroke:#B8202E;stroke-width:3}.fb-kategori{font:700 18px sans-serif;fill:#1B2534}.fb-teks{font:13px sans-serif;fill:#1B2534}.fb-teks.akar{fill:#B8202E;font-weight:700}.fb-sub{font:11px sans-serif;fill:#555}.fb-masalah{font:700 15px sans-serif;color:#1B2534;padding:6px}';
    salin.insertBefore(gaya, salin.firstChild);
    A.unduh(nama + '.svg', new XMLSerializer().serializeToString(salin), 'image/svg+xml');
  }

  async function detailInvestigasi(id, tabAwal, cetak) {
    let x, capa, lap, sup;
    try { x = await API.ambilSatu('investigasi', id); if (!x) throw new Error('Investigasi tidak ditemukan atau Anda tidak berwenang membukanya.');
      [capa, lap, sup] = await Promise.all([API.daftarDari('capa', 'investigasi_id', id, 'dibuat_pada'), API.ambilSatu('laporan', x.laporan_id).catch(() => null), daftarSupervisor().catch(() => [])]); }
    catch (e) { return galatHalaman('Investigasi', '/investigasi', e); }
    const bisaUbah = ['draf', 'analisis'].includes(x.status) && (k3() || x.ketua_id === saya());
    const namaSup = idp => (sup.find(s => s.id === idp) || {}).nama || '—';
    const d = JSON.parse(JSON.stringify(x)); d.fishbone = d.fishbone && d.fishbone.kategori ? d.fishbone : { masalah: d.fishbone && d.fishbone.masalah || '', kategori: {} };
    let tab = tabAwal; const wadah = h('div'), tabBar = h('div'); let kotor = false;
    const tandai = () => { kotor = true; };
    const masukan = (k, ph, multi) => { const e = h(multi ? 'textarea' : 'input', { maxlength: 2000, rows: multi ? 3 : null, placeholder: ph || '', disabled: !bisaUbah, oninput: ev => { d[k] = ev.target.value; tandai(); } }); e.value = d[k] || ''; return e; };
    const daftarBaris = (k, kolom, judulTambah) => {
      const w = h('div', { class: 'baris-editor' });
      const gambar = () => w.replaceChildren(...(d[k] || []).map((r, i) => h('div', { class: 'baris-item' }, kolom.map(([kk, ph, tipe]) => { const e = h('input', { type: tipe || 'text', placeholder: ph, maxlength: 500, disabled: !bisaUbah, 'aria-label': ph, oninput: ev => { r[kk] = ev.target.value; tandai(); } }); e.value = r[kk] || ''; return e; }),
        bisaUbah ? tombol([ikon('hapus')], () => { d[k].splice(i, 1); tandai(); gambar(); }, 'teks kecil', { 'aria-label': 'Hapus baris' }) : null)),
        bisaUbah ? tombol([ikon('tambah'), judulTambah], () => { (d[k] = d[k] || []).push({}); tandai(); gambar(); }, 'kedua kecil') : null);
      gambar(); return w;
    };
    const simpan = async (btn, diam) => {
      if (!bisaUbah) return;
      await sibuk(btn, async () => {
        const data = { id, ketua_id: d.ketua_id, tim: d.tim, waktu_kejadian: d.waktu_kejadian, lokasi: d.lokasi, pekerjaan: d.pekerjaan, pihak_terkait: d.pihak_terkait, kronologi: (d.kronologi || []).filter(r => (r.uraian || '').trim()),
          bukti: d.bukti, saksi: (d.saksi || []).filter(r => (r.nama || '').trim()), tindakan_tidak_aman: d.tindakan_tidak_aman, kondisi_tidak_aman: d.kondisi_tidak_aman, penyebab_langsung: d.penyebab_langsung, penyebab_dasar: d.penyebab_dasar,
          lima_why: d.lima_why, fishbone: d.fishbone, akar_masalah: d.akar_masalah };
        Object.assign(x, await API.simpanBaris('investigasi', data)); kotor = false; if (!diam) toast('Investigasi tersimpan', 'ok');
      });
    };
    const ubahStatus = async (ke, judul, butuhCatatan) => {
      let catatan = '';
      if (butuhCatatan) { catatan = (window.prompt(judul + '\nTulis catatan (wajib):') || '').trim(); if (catatan.length < 5) return toast('Catatan minimal 5 huruf', 'galat'); }
      else if (!await konfirmasi(judul, 'Status investigasi ' + x.nomor + ' akan berubah. Perubahan tercatat di jejak audit.', 'Ya, lanjutkan', ke === 'dibatalkan')) return;
      try { if (kotor) await simpan(null, true); await API.simpanBaris('investigasi', Object.assign({ id, status: ke }, catatan ? { catatan_persetujuan: catatan } : {})); toast('Status: ' + (ST_INV[ke] || [ke])[0], 'ok'); A.jalankan(); }
      catch (e) { toast(e.message, 'galat'); }
    };
    // ---- Tab-tab ----
    const tRingkasan = () => {
      const ket = pilih(sup.map(s => [s.id, s.nama]), d.ketua_id, { disabled: !bisaUbah, onchange: e => { d.ketua_id = e.target.value; tandai(); } });
      const wkt = h('input', { type: 'datetime-local', value: keLokal(d.waktu_kejadian), disabled: !bisaUbah, onchange: e => { d.waktu_kejadian = dariLokal(e.target.value); tandai(); } });
      return [h('section', { class: 'kartu' }, h('h2', { text: 'Kejadian' }), lap ? h('p', {}, h('a', { href: '#/laporan/' + encodeURIComponent(lap.id), text: lap.nomor }), ' · ' + (JENIS[lap.jenis] || '') + ' · ' + kat(lap.kategori_kode).nama + ' · ', A.badgeTingkat(lap.skor)) : null,
        lap ? h('p', { class: 'kecil', text: lap.uraian || '' }) : null,
        h('div', { class: 'dua' }, bidang('Waktu kejadian', wkt), bidang('Lokasi', masukan('lokasi'))), h('div', { class: 'dua' }, bidang('Pekerjaan saat kejadian', masukan('pekerjaan')), bidang('Pihak terkait', masukan('pihak_terkait', 'Contoh: teknisi IPSRS, pasien kamar 3')))),
        h('section', { class: 'kartu' }, h('h2', { text: 'Tim investigasi' }), bidang('Ketua tim', ket), daftarBaris('tim', [['nama', 'Nama anggota'], ['peran', 'Peran (mis. ahli listrik)']], 'Tambah anggota'))];
    };
    const tKronologi = () => {
      const unggah = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp', class: 'tersembunyi', onchange: async e => {
        const f = e.target.files[0]; if (!f) return;
        try { const blob = await A.kecilkanFoto(f); const path = await API.unggahFoto(blob); (d.bukti = d.bukti || []).push({ jenis: 'foto', path, keterangan: f.name.slice(0, 80) }); tandai(); await simpan(null, true); toast('Foto bukti tersimpan', 'ok'); gambar(); }
        catch (err) { toast(err.message, 'galat'); } e.target.value = '';
      } });
      const daftarBukti = h('div', { class: 'galeri-bukti' });
      (d.bukti || []).forEach((b, i) => {
        const kartu = h('figure', { class: 'bukti' }, b.jenis === 'foto' ? h('div', { class: 'bukti-foto', text: 'Memuat foto…' }) : h('div', { class: 'bukti-ikon' }, ikon('dokumen')),
          h('figcaption', {}, h('input', { value: b.keterangan || '', maxlength: 200, disabled: !bisaUbah, 'aria-label': 'Keterangan bukti', oninput: e => { b.keterangan = e.target.value; tandai(); } }),
            bisaUbah ? tombol([ikon('hapus')], () => { d.bukti.splice(i, 1); tandai(); gambar(); }, 'teks kecil', { 'aria-label': 'Hapus bukti' }) : null));
        if (b.jenis === 'foto' && b.path) API.urlFoto(b.path).then(u => { const w = kartu.querySelector('.bukti-foto'); if (u && w) w.replaceChildren(h('img', { src: u, alt: b.keterangan || 'Foto bukti' })); }).catch(() => {});
        daftarBukti.appendChild(kartu);
      });
      return [h('section', { class: 'kartu' }, h('h2', { text: 'Kronologi' }), h('p', { class: 'kecil', text: 'Urutkan dari awal sampai akhir. Tulis fakta, bukan kesimpulan.' }), daftarBaris('kronologi', [['waktu', 'Waktu (mis. 08.10)'], ['uraian', 'Apa yang terjadi']], 'Tambah peristiwa'),
          (d.kronologi || []).length ? h('ol', { class: 'linimasa-kronologi' }, d.kronologi.filter(r => r.uraian).map(r => h('li', {}, h('strong', { text: r.waktu || '—' }), h('span', { text: r.uraian })))) : null),
        h('section', { class: 'kartu' }, h('h2', { text: 'Bukti' }), daftarBukti, bisaUbah ? h('div', { class: 'tombol-baris' }, tombol([ikon('kamera'), 'Tambah foto bukti'], () => unggah.click(), 'kedua'), tombol([ikon('dokumen'), 'Tambah catatan bukti'], () => { (d.bukti = d.bukti || []).push({ jenis: 'catatan', keterangan: '' }); tandai(); gambar(); }, 'kedua'), unggah) : null),
        h('section', { class: 'kartu' }, h('h2', { text: 'Keterangan saksi' }), daftarBaris('saksi', [['nama', 'Nama/jabatan saksi'], ['keterangan', 'Keterangan singkat']], 'Tambah saksi'))];
    };
    const tPenyebab = () => [h('section', { class: 'kartu' }, h('h2', { text: 'Penyebab' }),
      h('div', { class: 'dua' }, bidang('Tindakan tidak aman (unsafe act)', masukan('tindakan_tidak_aman', '', true)), bidang('Kondisi tidak aman (unsafe condition)', masukan('kondisi_tidak_aman', '', true))),
      bidang('Penyebab langsung (immediate cause) — wajib', masukan('penyebab_langsung', 'Apa yang langsung menyebabkan kejadian?', true)),
      bidang('Penyebab dasar (underlying cause)', masukan('penyebab_dasar', 'Faktor manusia/pekerjaan/sistem di baliknya', true)),
      bidang('Ringkasan akar masalah', masukan('akar_masalah', 'Kesimpulan akar masalah dari 5 Why / Fishbone', true)))];
    const tLimaWhy = () => {
      d.lima_why = d.lima_why || []; const w = h('div', { class: 'rantai-daftar' });
      const gambarR = () => w.replaceChildren(...d.lima_why.map((c, ci) => {
        c.why = c.why && c.why.length ? c.why : ['']; const inp = (k, ph) => { const e = h('input', { maxlength: 500, placeholder: ph, disabled: !bisaUbah, 'aria-label': ph, oninput: ev => { c[k] = ev.target.value; tandai(); } }); e.value = c[k] || ''; return e; };
        return h('section', { class: 'kartu rantai-why' }, h('div', { class: 'kartu-kepala' }, h('h3', { text: 'Rantai penyebab ' + (ci + 1) }), bisaUbah ? tombol([ikon('hapus'), 'Hapus rantai'], () => { d.lima_why.splice(ci, 1); tandai(); gambarR(); }, 'teks kecil') : null),
          bidang('Pernyataan masalah', inp('masalah', 'Contoh: tangga tergelincir saat dipakai')),
          h('ol', { class: 'why-daftar' }, c.why.map((y, yi) => h('li', {}, h('span', { class: 'why-label', text: 'Mengapa ' + (yi + 1) + '?' }),
            (() => { const e = h('input', { maxlength: 500, disabled: !bisaUbah, 'aria-label': 'Mengapa ' + (yi + 1), oninput: ev => { c.why[yi] = ev.target.value; tandai(); } }); e.value = y || ''; return e; })(),
            bisaUbah && c.why.length > 1 ? tombol([ikon('silang')], () => { c.why.splice(yi, 1); tandai(); gambarR(); }, 'teks kecil', { 'aria-label': 'Hapus pertanyaan ini' }) : null))),
          bisaUbah && c.why.length < 10 ? tombol([ikon('tambah'), 'Tambah "Mengapa?"'], () => { c.why.push(''); tandai(); gambarR(); }, 'kedua kecil') : null,
          h('p', { class: 'kecil', text: 'Tidak harus tepat lima. Berhenti ketika menemukan penyebab yang dapat dikendalikan sistem.' }),
          h('div', { class: 'dua' }, bidang('Akar masalah teridentifikasi', inp('akar', 'Penyebab sistemik')), bidang('Bukti pendukung', inp('bukti', 'Foto, catatan, keterangan saksi'))),
          bidang('Usulan tindakan', inp('tindakan', 'Tindakan untuk menghilangkan akar masalah')));
      }), bisaUbah ? tombol([ikon('tambah'), 'Tambah rantai penyebab'], () => { d.lima_why.push({ masalah: '', why: [''], akar: '', bukti: '', tindakan: '' }); tandai(); gambarR(); }, 'kedua') : null);
      gambarR(); return [h('p', { class: 'kecil', text: 'Satu kejadian dapat memiliki beberapa rantai penyebab.' }), w];
    };
    const tFishbone = () => {
      const fb = d.fishbone; fb.kategori = fb.kategori || {};
      const diag = h('div', { class: 'fishbone-wadah' }, diagramFishbone(fb));
      const segar = () => diag.replaceChildren(diagramFishbone(fb));
      const masalah = h('input', { maxlength: 300, value: fb.masalah || '', disabled: !bisaUbah, oninput: e => { fb.masalah = e.target.value; tandai(); segar(); } });
      const editor = h('div', { class: 'fb-editor' });
      const gambarE = () => editor.replaceChildren(...KAT_FB.map(([k, label]) => {
        const L = fb.kategori[k] = fb.kategori[k] || [];
        return h('details', { class: 'kartu fb-kat', open: L.length ? true : null }, h('summary', { text: label + ' (' + L.length + ')' }),
          L.map((c, ci) => h('div', { class: 'fb-item' },
            h('div', { class: 'baris-item' }, (() => { const e = h('input', { maxlength: 200, placeholder: 'Penyebab', 'aria-label': 'Penyebab ' + label, disabled: !bisaUbah, oninput: ev => { c.teks = ev.target.value; tandai(); segar(); } }); e.value = c.teks || ''; return e; })(),
              h('label', { class: 'saklar kecil' }, h('input', { type: 'checkbox', checked: !!c.akar, disabled: !bisaUbah, onchange: ev => { c.akar = ev.target.checked; tandai(); segar(); } }), h('span', { text: 'Akar masalah' })),
              bisaUbah ? tombol([ikon('hapus')], () => { L.splice(ci, 1); tandai(); gambarE(); segar(); }, 'teks kecil', { 'aria-label': 'Hapus penyebab' }) : null),
            h('div', { class: 'fb-sub-daftar' }, (c.sub = c.sub || []).map((sb, si) => h('div', { class: 'baris-item' }, h('span', { 'aria-hidden': 'true', text: '↳' }),
              (() => { const e = h('input', { maxlength: 200, placeholder: 'Sub-penyebab', 'aria-label': 'Sub-penyebab', disabled: !bisaUbah, oninput: ev => { c.sub[si] = ev.target.value; tandai(); segar(); } }); e.value = sb || ''; return e; })(),
              bisaUbah ? tombol([ikon('silang')], () => { c.sub.splice(si, 1); tandai(); gambarE(); segar(); }, 'teks kecil', { 'aria-label': 'Hapus sub-penyebab' }) : null)),
              bisaUbah ? tombol([ikon('tambah'), 'Sub-penyebab'], () => { c.sub.push(''); tandai(); gambarE(); }, 'teks kecil') : null))),
          bisaUbah ? tombol([ikon('tambah'), 'Tambah penyebab'], () => { L.push({ teks: '', sub: [], akar: false }); tandai(); gambarE(); segar(); }, 'kedua kecil') : null);
      }));
      gambarE();
      return [h('section', { class: 'kartu' }, bidang('Kepala ikan (masalah)', masalah), diag, h('div', { class: 'tombol-baris' }, tombol([ikon('unduh'), 'Unduh diagram (SVG)'], () => unduhSvg(diag.querySelector('svg'), 'fishbone-' + x.nomor), 'kedua kecil'), h('span', { class: 'kecil', text: '★ = ditandai sebagai akar masalah' }))), editor];
    };
    const tCapa = () => {
      const akar = [...new Set([d.akar_masalah, ...(d.lima_why || []).map(c => c.akar), ...KAT_FB.flatMap(([k]) => ((d.fishbone.kategori || {})[k] || []).filter(c => c.akar).map(c => c.teks))].filter(Boolean))];
      const bisaTambah = ['draf', 'analisis', 'menunggu_persetujuan'].includes(x.status) && (k3() || x.ketua_id === saya());
      const fAkar = pilih([['', '— pilih akar masalah —']].concat(akar.map(a => [a, a.slice(0, 90)])), ''), fTindakan = h('textarea', { rows: 2, maxlength: 1000, required: true });
      const fJenis = pilih([['korektif', 'Korektif (memperbaiki penyebab)'], ['preventif', 'Preventif (mencegah terulang)']], 'korektif'), fLevel = pilih(Object.entries(LEVEL), 'rekayasa');
      const fPrio = pilih([['sedang', 'Sedang'], ['tinggi', 'Tinggi'], ['kritis', 'Kritis'], ['rendah', 'Rendah']], 'sedang'), fPj = pilih(sup.map(s => [s.id, s.nama]), x.ketua_id), fTarget = h('input', { type: 'date', required: true, min: I.tanggalLokal(), value: I.geserHari(I.tanggalLokal(), 14) });
      const btn = h('button', { type: 'submit', class: 'btn utama' }, ikon('tambah'), 'Buat CAPA');
      return [h('section', { class: 'kartu' }, h('h2', { text: 'CAPA dari investigasi ini (' + capa.length + ')' }), capa.length ? daftarCapaEl(capa) : h('p', { class: 'kecil', text: 'Belum ada CAPA. Minimal satu CAPA diperlukan sebelum investigasi diajukan.' })),
        bisaTambah ? h('form', { class: 'kartu', onsubmit: async e => { e.preventDefault(); await sibuk(btn, async () => {
          await API.simpanBaris('capa', { sumber: 'investigasi', investigasi_id: id, unit_id: x.unit_id, akar_masalah: fAkar.value, tindakan: fTindakan.value.trim(), jenis: fJenis.value, level_pengendalian: fLevel.value, prioritas: fPrio.value, pj_id: fPj.value, target_tanggal: fTarget.value });
          toast('CAPA dibuat dan penanggung jawab diberi tahu', 'ok'); capa = await API.daftarDari('capa', 'investigasi_id', id, 'dibuat_pada'); gambar();
        }).catch(() => {}); } }, h('h2', { text: 'Buat CAPA' }), bidang('Akar masalah yang ditangani', fAkar), bidang('Tindakan', fTindakan),
          h('div', { class: 'dua' }, bidang('Jenis', fJenis), bidang('Tingkat pengendalian', fLevel)), h('div', { class: 'tiga' }, bidang('Prioritas', fPrio), bidang('Penanggung jawab', fPj), bidang('Target', fTarget)),
          h('p', { class: 'kecil', text: 'Utamakan eliminasi, substitusi, atau rekayasa. APD/administratif saja jarang menghilangkan akar masalah.' }), btn) : null];
    };
    const tabs = [['ringkasan', 'Ringkasan & tim', 'orang'], ['kronologi', 'Kronologi & bukti', 'riwayat'], ['penyebab', 'Penyebab', 'awas'], ['why', '5 Why', 'daftar'], ['fishbone', 'Fishbone', 'kisi'], ['capa', 'CAPA (' + capa.length + ')', 'tugas']];
    function gambar() {
      tabBar.replaceChildren(A.tab(tabs.map(t => t[0] === 'capa' ? ['capa', 'CAPA (' + capa.length + ')', 'tugas'] : t), tab, t => { tab = t; history.replaceState(null, '', '#/investigasi?id=' + encodeURIComponent(id) + '&tab=' + t); gambar(); }));
      wadah.replaceChildren(...({ ringkasan: tRingkasan, kronologi: tKronologi, penyebab: tPenyebab, why: tLimaWhy, fishbone: tFishbone, capa: tCapa }[tab] || tRingkasan)());
    }
    const aksi = [];
    if (bisaUbah) aksi.push(tombol([ikon('simpan'), 'Simpan'], ev => simpan(ev.currentTarget).catch(() => {}), 'utama'));
    if (x.status === 'draf' && bisaUbah) aksi.push(tombol([ikon('kanan'), 'Mulai analisis'], () => ubahStatus('analisis', 'Mulai tahap analisis?')));
    if (x.status === 'analisis' && bisaUbah) aksi.push(tombol([ikon('kirim'), 'Ajukan persetujuan'], () => ubahStatus('menunggu_persetujuan', 'Ajukan hasil investigasi untuk disetujui K3RS?'), 'utama'));
    if (x.status === 'menunggu_persetujuan' && k3() && x.ketua_id !== saya()) { aksi.push(tombol([ikon('centang'), 'Setujui'], () => ubahStatus('disetujui', 'Setujui hasil investigasi', true), 'utama')); aksi.push(tombol([ikon('kiri'), 'Kembalikan untuk diperbaiki'], () => ubahStatus('analisis', 'Kembalikan ke tahap analisis', true), 'kedua')); }
    if (x.status === 'disetujui' && k3()) { aksi.push(tombol([ikon('berhasil'), 'Tutup investigasi'], () => ubahStatus('ditutup', 'Tutup investigasi? CAPA yang masih berjalan tetap dipantau di menu CAPA.'), 'utama')); aksi.push(tombol([ikon('kiri'), 'Buka kembali'], () => ubahStatus('analisis', 'Buka kembali ke tahap analisis', true), 'teks')); }
    if (['draf', 'analisis'].includes(x.status) && bisaUbah) aksi.push(tombol([ikon('silang'), 'Batalkan'], () => ubahStatus('dibatalkan', 'Batalkan investigasi ini?'), 'teks'));
    aksi.push(h('a', { class: 'btn teks', href: '#/investigasi?id=' + encodeURIComponent(id) + '&cetak=1' }, ikon('cetak'), 'Laporan cetak'));
    if (cetak) return laporanCetakInvestigasi(x, capa, lap, namaSup);
    tampil(halaman('Investigasi ' + x.nomor, '/investigasi', [
      h('section', { class: 'kartu' }, h('div', { class: 'kartu-kepala' }, h('h2', { text: x.nomor + ' · ' + (x.lokasi || namaUnit(x.unit_id)) }), badgeInv(x.status)),
        stepper([['draf', 'Draf'], ['analisis', 'Analisis'], ['menunggu_persetujuan', 'Persetujuan'], ['disetujui', 'Disetujui'], ['ditutup', 'Ditutup']], x.status, x.status === 'dibatalkan' ? 'Investigasi dibatalkan' : null),
        h('p', { class: 'kecil', text: 'Ketua: ' + namaSup(x.ketua_id) + ' · Unit: ' + namaUnit(x.unit_id) + (x.disetujui_pada ? ' · Disetujui ' + WITA(x.disetujui_pada) : '') + (x.catatan_persetujuan ? ' · Catatan: ' + x.catatan_persetujuan : '') }),
        h('div', { class: 'tombol-baris' }, aksi)),
      tabBar, wadah, k3() ? A.panelJejak('investigasi', id) : null], { kembali: true }));
    gambar();
  }
  function laporanCetakInvestigasi(x, capa, lap, namaSup) {
    const fb = x.fishbone && x.fishbone.kategori ? x.fishbone : { masalah: '', kategori: {} };
    tampil(halaman('Laporan investigasi ' + x.nomor, '/investigasi', [h('article', { class: 'kartu laporan-cetak' },
      h('div', { class: 'laporan-bulan-kepala' }, A.kunciMerek('kecil'), h('div', {}, h('h2', { text: 'Laporan Investigasi ' + x.nomor }), h('p', { class: 'kecil', text: (A.S.ref.pengaturan.nama_instansi || '') + ' · dicetak ' + WITA(new Date()) + ' WITA' }))),
      h('dl', { class: 'rincian' }, h('dt', { text: 'Laporan sumber' }), h('dd', { text: lap ? lap.nomor + ' · ' + (JENIS[lap.jenis] || '') : '—' }), h('dt', { text: 'Waktu & lokasi' }), h('dd', { text: WITA(x.waktu_kejadian) + ' · ' + (x.lokasi || '—') }),
        h('dt', { text: 'Ketua tim' }), h('dd', { text: namaSup(x.ketua_id) }), h('dt', { text: 'Anggota' }), h('dd', { text: (x.tim || []).map(t => t.nama + (t.peran ? ' (' + t.peran + ')' : '')).join(', ') || '—' }), h('dt', { text: 'Status' }), h('dd', { text: (ST_INV[x.status] || [x.status])[0] })),
      h('h3', { text: 'Kronologi' }), h('ol', {}, (x.kronologi || []).map(r => h('li', { text: (r.waktu ? r.waktu + ' — ' : '') + r.uraian }))),
      h('h3', { text: 'Penyebab' }), h('p', {}, h('strong', { text: 'Tindakan tidak aman: ' }), x.tindakan_tidak_aman || '—'), h('p', {}, h('strong', { text: 'Kondisi tidak aman: ' }), x.kondisi_tidak_aman || '—'),
      h('p', {}, h('strong', { text: 'Penyebab langsung: ' }), x.penyebab_langsung || '—'), h('p', {}, h('strong', { text: 'Penyebab dasar: ' }), x.penyebab_dasar || '—'), h('p', {}, h('strong', { text: 'Akar masalah: ' }), x.akar_masalah || '—'),
      (x.lima_why || []).map((c, i) => [h('h3', { text: '5 Why — rantai ' + (i + 1) + ': ' + (c.masalah || '') }), h('ol', {}, (c.why || []).filter(Boolean).map(y => h('li', { text: y }))), h('p', {}, h('strong', { text: 'Akar: ' }), c.akar || '—')]),
      h('h3', { text: 'Fishbone' }), h('div', { class: 'fishbone-wadah' }, diagramFishbone(fb)),
      h('h3', { text: 'CAPA' }), capa.length ? h('table', { class: 'tabel' }, h('thead', {}, h('tr', {}, ['Nomor', 'Tindakan', 'Jenis', 'PJ', 'Target', 'Status'].map(t => h('th', { text: t })))),
        h('tbody', {}, capa.map(c => h('tr', {}, h('td', { text: c.nomor }), h('td', { text: c.tindakan }), h('td', { text: c.jenis }), h('td', { text: namaSup(c.pj_id) }), h('td', { text: A.tgl(c.target_tanggal) }), h('td', { text: (ST_CAPA[c.status] || [c.status])[0] }))))) : h('p', { text: '—' }),
      h('div', { class: 'tombol-baris no-print' }, tombol([ikon('cetak'), 'Cetak / simpan PDF'], () => window.print(), 'utama')))], { kembali: true }));
  }

  // =====================================================================
  // CAPA LINTAS MODUL
  // =====================================================================
  const ST_CAPA = { terbuka: ['● Terbuka', 'rk-1'], dalam_proses: ['↻ Dalam proses', 'rk-1'], selesai: ['◇ Selesai, perlu verifikasi', 'rk-2'], terverifikasi: ['✓ Terverifikasi efektif', 'rk-0'], tidak_efektif: ['✕ Tidak efektif', 'rk-3'], dibatalkan: ['– Dibatalkan', 'rk-x'] };
  const PRIO = { rendah: ['○ Rendah', 'rk-0'], sedang: ['△ Sedang', 'rk-1'], tinggi: ['◇ Tinggi', 'rk-2'], kritis: ['✕ Kritis', 'rk-3'] };
  const telatCapa = c => ['terbuka', 'dalam_proses', 'tidak_efektif'].includes(c.status) && c.target_tanggal < I.tanggalLokal();
  function daftarCapaEl(X) {
    return h('div', { class: 'daftar' }, X.map(c => h('a', { class: 'kartu laporan' + (telatCapa(c) ? ' telat' : ''), href: '#/capa?id=' + encodeURIComponent(c.id) },
      h('div', { class: 'kartu-kepala' }, h('strong', { text: c.nomor + ' · ' + c.tindakan.slice(0, 80) }), badge((ST_CAPA[c.status] || [c.status])[0], (ST_CAPA[c.status] || [, 'netral'])[1])),
      h('div', { class: 'baris' }, badge((PRIO[c.prioritas] || [c.prioritas])[0], (PRIO[c.prioritas] || [, 'netral'])[1]), h('small', { text: c.sumber + ' · ' + c.jenis + ' · ' + (LEVEL[c.level_pengendalian] || '').split(' (')[0] + ' · target ' + A.tgl(c.target_tanggal) }), telatCapa(c) ? badge('✕ Terlambat', 'rk-3') : null))));
  }
  async function hCapa() {
    const q = qs(); if (q.get('id')) return detailCapa(q.get('id'));
    const f = { status: q.get('status') || '', sumber: '', prioritas: '', saya: !k3(), cari: '', telat: false };
    const ctl = daftarServer({ tabel: 'capa', namaEkspor: 'capa', kosong: 'Tidak ada CAPA sesuai filter.',
      opsi: () => ({ filter: [f.status === 'aktif' ? ['status', 'in', ['terbuka', 'dalam_proses', 'tidak_efektif']] : ['status', 'eq', f.status], ['sumber', 'eq', f.sumber], ['prioritas', 'eq', f.prioritas], f.saya ? ['pj_id', 'eq', saya()] : null,
        f.telat ? ['target_tanggal', 'lt', I.tanggalLokal()] : null, f.telat ? ['status', 'in', ['terbuka', 'dalam_proses', 'tidak_efektif']] : null].filter(Boolean), cari: { kolom: ['nomor', 'tindakan', 'akar_masalah'], teks: f.cari }, urut: 'target_tanggal', naik: true }),
      render: daftarCapaEl, kolomEkspor: [['nomor', 'nomor'], ['sumber', 'sumber'], [r => namaUnit(r.unit_id), 'unit'], ['akar_masalah', 'akar_masalah'], ['tindakan', 'tindakan'], ['jenis', 'jenis'], ['level_pengendalian', 'pengendalian'], ['prioritas', 'prioritas'], ['target_tanggal', 'target'], ['status', 'status'], ['bukti', 'bukti'], ['hasil_verifikasi', 'hasil_verifikasi']] });
    const ubah = (k, v) => { f[k] = v; ctl.ulang(); };
    tampil(halaman('CAPA (tindakan korektif & preventif)', '/capa', [
      h('p', { class: 'kecil', text: 'Tindakan dari investigasi, toolbox meeting, dan pelatihan. Tindak lanjut laporan bahaya tetap dikelola di "Tugas & CAPA" pada laporannya.' }),
      h('div', { class: 'kartu filter filter-luas' }, inputCari('Cari nomor, tindakan, akar masalah…', v => ubah('cari', v)),
        pilih([['', 'Semua status'], ['aktif', 'Belum selesai']].concat(Object.entries(ST_CAPA).map(([k, v]) => [k, v[0]])), f.status, { 'aria-label': 'Status', onchange: e => ubah('status', e.target.value) }),
        pilih([['', 'Semua sumber'], ['investigasi', 'Investigasi'], ['toolbox', 'Toolbox meeting'], ['pelatihan', 'Pelatihan']], '', { 'aria-label': 'Sumber', onchange: e => ubah('sumber', e.target.value) }),
        pilih([['', 'Semua prioritas']].concat(Object.entries(PRIO).map(([k, v]) => [k, v[0]])), '', { 'aria-label': 'Prioritas', onchange: e => ubah('prioritas', e.target.value) }),
        h('label', { class: 'saklar' }, h('input', { type: 'checkbox', checked: f.saya, onchange: e => ubah('saya', e.target.checked) }), h('span', { text: 'Hanya tugas saya' })),
        h('label', { class: 'saklar' }, h('input', { type: 'checkbox', onchange: e => ubah('telat', e.target.checked) }), h('span', { text: 'Hanya terlambat' })), ctl.tombolEkspor), ctl.el]));
    ctl.muat();
  }
  async function detailCapa(id) {
    let c, sup; try { c = await API.ambilSatu('capa', id); if (!c) throw new Error('CAPA tidak ditemukan atau Anda tidak berwenang.'); sup = await daftarSupervisor().catch(() => []); } catch (e) { return galatHalaman('CAPA', '/capa', e); }
    const nama = idp => (sup.find(s => s.id === idp) || {}).nama || '—';
    const sayaPj = c.pj_id === saya(), bukti = h('textarea', { rows: 3, maxlength: 1000 }); bukti.value = c.bukti || '';
    const hasil = h('textarea', { rows: 3, maxlength: 1000, placeholder: 'Contoh: diperiksa 30 hari, tidak ada genangan/kejadian berulang' });
    const kirimStatus = async (ke, data) => { try { await API.simpanBaris('capa', Object.assign({ id, status: ke }, data || {})); toast('Status CAPA: ' + (ST_CAPA[ke] || [ke])[0], 'ok'); A.jalankan(); } catch (e) { toast(e.message, 'galat'); } };
    const tautan = c.investigasi_id ? h('a', { href: '#/investigasi?id=' + encodeURIComponent(c.investigasi_id) + '&tab=capa', text: 'Lihat investigasi' }) : c.kegiatan_id ? h('a', { href: '#/kegiatan?id=' + encodeURIComponent(c.kegiatan_id), text: 'Lihat kegiatan' }) : null;
    tampil(halaman('CAPA ' + c.nomor, '/capa', [
      h('section', { class: 'kartu' }, h('div', { class: 'kartu-kepala' }, h('h2', { text: c.tindakan }), badge((ST_CAPA[c.status] || [c.status])[0], (ST_CAPA[c.status] || [, 'netral'])[1])),
        stepper([['terbuka', 'Terbuka'], ['dalam_proses', 'Dalam proses'], ['selesai', 'Selesai'], ['terverifikasi', 'Terverifikasi']], c.status === 'tidak_efektif' ? 'selesai' : c.status, c.status === 'tidak_efektif' ? 'Dinilai belum efektif — perlu tindakan ulang' : c.status === 'dibatalkan' ? 'Dibatalkan' : null),
        h('dl', { class: 'rincian' }, h('dt', { text: 'Sumber' }), h('dd', {}, c.sumber + ' ', tautan), h('dt', { text: 'Akar masalah' }), h('dd', { text: c.akar_masalah || '—' }), h('dt', { text: 'Jenis & pengendalian' }), h('dd', { text: c.jenis + ' · ' + (LEVEL[c.level_pengendalian] || '') }),
          h('dt', { text: 'Prioritas' }), h('dd', {}, badge((PRIO[c.prioritas] || [c.prioritas])[0], (PRIO[c.prioritas] || [, 'netral'])[1])), h('dt', { text: 'Penanggung jawab' }), h('dd', { text: nama(c.pj_id) }),
          h('dt', { text: 'Target' }), h('dd', {}, A.tgl(c.target_tanggal) + ' ', telatCapa(c) ? badge('✕ Terlambat', 'rk-3') : null), h('dt', { text: 'Bukti pelaksanaan' }), h('dd', { text: c.bukti || '—' }),
          h('dt', { text: 'Verifikasi efektivitas' }), h('dd', { text: c.hasil_verifikasi ? c.hasil_verifikasi + ' (' + nama(c.diverifikasi_oleh) + ', ' + WITA(c.diverifikasi_pada) + ')' : '—' }))),
      sayaPj && ['terbuka', 'dalam_proses', 'tidak_efektif'].includes(c.status) ? h('section', { class: 'kartu' }, h('h2', { text: 'Laporkan kemajuan' }), bidang('Bukti pelaksanaan', bukti, 'Wajib sebelum menandai selesai.'),
        h('div', { class: 'tombol-baris' }, c.status !== 'dalam_proses' ? tombol([ikon('muat'), 'Tandai dalam proses'], () => kirimStatus('dalam_proses', { bukti: bukti.value.trim() }), 'kedua') : null,
          tombol([ikon('centang'), 'Tandai selesai'], () => kirimStatus('selesai', { bukti: bukti.value.trim() }), 'utama'))) : null,
      k3() && c.status === 'selesai' && !sayaPj ? h('section', { class: 'kartu' }, h('h2', { text: 'Verifikasi efektivitas' }), bidang('Hasil verifikasi', hasil, 'Periksa di lapangan: apakah akar masalah benar-benar hilang?'),
        h('div', { class: 'tombol-baris' }, tombol([ikon('centang'), 'Efektif'], () => kirimStatus('terverifikasi', { hasil_verifikasi: hasil.value.trim() }), 'utama'), tombol([ikon('silang'), 'Belum efektif'], () => kirimStatus('tidak_efektif', { hasil_verifikasi: hasil.value.trim() }), 'bahaya'))) : null,
      k3() && c.status === 'selesai' && sayaPj ? h('p', { class: 'catatan-batas' }, ikon('info'), h('span', { text: 'Verifikasi harus dilakukan K3RS lain, bukan penanggung jawab CAPA.' })) : null,
      k3() && ['terbuka', 'dalam_proses'].includes(c.status) ? h('div', { class: 'tombol-baris' }, tombol([ikon('silang'), 'Batalkan CAPA'], async () => { if (await konfirmasi('Batalkan CAPA?', 'CAPA tetap tercatat dengan status dibatalkan.', 'Batalkan', true)) kirimStatus('dibatalkan'); }, 'teks')) : null,
      k3() ? A.panelJejak('capa', id) : null], { kembali: true }));
  }
  A.daftarCapaEl = daftarCapaEl; A.ST_CAPA = ST_CAPA;
  A.lanjut = { stepper, galatHalaman, WITA, keLokal, dariLokal, opsiUnit, daftarSupervisor, inputCari, pager };

  Object.assign(A.RUTE, { '/semua': () => hLaporanServer('/semua', peran() === 'k3rs' ? 'Laporan & risk register' : 'Laporan unit'), '/tugas': () => hLaporanServer('/tugas', 'Tugas saya'),
    '/pengguna': hPenggunaServer, '/investigasi': hInvestigasi, '/capa': hCapa });
  Object.assign(A.HAK, { '/investigasi': ['k3rs', 'pj_unit'], '/capa': ['k3rs', 'pj_unit'] });
})();
