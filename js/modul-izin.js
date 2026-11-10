/* modul-izin.js — Izin Kerja (PTW), Toolbox Meeting & Pelatihan, Presensi QR, Pusat Notifikasi. */
(function () {
  'use strict';
  const A = window.K3App, I = window.K3Intel, G = window.K3Grafik;
  if (!A || !A.lanjut) return;
  const { h, ikon, badge, tombol, sibuk, bidang, pilih, toast, tampil, halaman, kosong, pergi, peran, namaUnit, LS, konfirmasi } = A;
  const { stepper, galatHalaman, WITA, keLokal, dariLokal, opsiUnit, daftarSupervisor, inputCari } = A.lanjut;
  const API = A.API, qs = A.qs;
  const saya = () => A.S.sesi.profil.id, unitSaya = () => A.S.sesi.profil.unit_id;
  const staf = () => ['k3rs', 'pj_unit'].includes(peran()), k3 = () => peran() === 'k3rs';
  const tanya = (judul, min) => { const t = (window.prompt(judul) || '').trim(); if (min && t.length < min) { toast('Isian minimal ' + min + ' huruf', 'galat'); return null; } return t; };

  // =====================================================================
  // IZIN KERJA (PERMIT TO WORK)
  // =====================================================================
  const ST_IZIN = { draf: ['✎ Draf', 'rk-x'], diajukan: ['● Menunggu supervisor', 'rk-1'], tinjau_k3: ['● Menunggu tinjauan K3', 'rk-1'], menunggu_pengesahan: ['● Menunggu pengesahan', 'rk-1'],
    disahkan: ['✓ Disahkan (belum mulai)', 'rk-0'], aktif: ['▶ AKTIF', 'rk-0'], selesai_kerja: ['■ Pekerjaan selesai', 'netral'], ditutup: ['■ Ditutup', 'netral'],
    ditolak: ['✕ Ditolak', 'rk-3'], ditangguhkan: ['⏸ DITANGGUHKAN', 'rk-3'], dibatalkan: ['– Dibatalkan', 'rk-x'], kedaluwarsa: ['⌛ Kedaluwarsa', 'rk-2'] };
  const badgeIzin = s => badge((ST_IZIN[s] || [s])[0], 'izin-st ' + (ST_IZIN[s] || [, 'netral'])[1]);
  const IKON_IZIN = { panas: 'api', ketinggian: 'tangga', listrik: 'petir', ruang_terbatas: 'awas' };
  const ALUR = [['draf', 'Draf'], ['diajukan', 'Supervisor'], ['tinjau_k3', 'Tinjauan K3'], ['menunggu_pengesahan', 'Pengesahan'], ['disahkan', 'Disahkan'], ['aktif', 'Aktif'], ['selesai_kerja', 'Selesai'], ['ditutup', 'Ditutup']];
  let jenisCache = null; const jenisIzin = async () => jenisCache || (jenisCache = await API.jenisIzin());

  async function hIzin() {
    const q = qs();
    if (q.get('id')) return detailIzin(q.get('id'));
    if (q.get('baru')) return formIzin();
    if (q.get('master')) return masterIzin();
    let J; try { J = await jenisIzin(); } catch (e) { return galatHalaman('Izin kerja (PTW)', '/izin', e); }
    const namaJenis = k => (J.find(j => j.kode === k) || {}).nama || k;
    const f = { status: q.get('status') || '', jenis: '', unit: '', dari: '', sampai: '', saya: false, cari: '' };
    const dasbor = h('div');
    const muatDasbor = async () => {
      try {
        const r = await API.izinRingkas(f.dari || null, f.sampai || null);
        const ub = (l, n, kls, ik, st) => h('button', { type: 'button', class: 'angka ' + (kls || ''), onclick: () => { f.status = st; sel.value = st; ctl.ulang(); } }, h('span', { class: 'ikon-kotak ' + (kls === 'merah' ? 'merah' : kls === 'kuning' ? 'kuning' : '') }, ikon(ik)), h('span', { class: 'n', text: String(n) }), h('span', { class: 'lbl', text: l }));
        dasbor.replaceChildren(h('div', { class: 'grid-angka spi' }, ub('Total izin', r.total, '', 'dokumen', ''), ub('Menunggu persetujuan', r.menunggu, r.menunggu ? 'kuning' : '', 'jam', 'menunggu'), ub('Aktif sekarang', r.aktif, '', 'petir', 'aktif'),
            ub('Ditangguhkan', r.ditangguhkan, r.ditangguhkan ? 'merah' : '', 'awas', 'ditangguhkan'), ub('Kedaluwarsa', r.kedaluwarsa, r.kedaluwarsa ? 'kuning' : '', 'jam', 'kedaluwarsa'), ub('Selesai/ditutup', r.selesai, '', 'berhasil', 'selesai'), ub('Ditolak', r.ditolak, '', 'silang', 'ditolak'), ub('Perlu tinjau ulang', r.perlu_tinjau, r.perlu_tinjau ? 'merah' : '', 'muat', '')),
          h('div', { class: 'intel-grid' }, h('section', { class: 'kartu' }, h('h2', { text: 'Per jenis pekerjaan' }), G.batang(Object.entries(r.per_jenis || {}).map(([k, n]) => ({ label: namaJenis(k), n, ikon: ikon(IKON_IZIN[k] || 'dokumen') })))),
            h('section', { class: 'kartu' }, h('h2', { text: 'Per unit/departemen' }), G.batang(Object.entries(r.per_unit || {}).map(([k, n]) => ({ label: k, n, w: 'navy' })), { persen: false })),
            h('section', { class: 'kartu' }, h('h2', { text: 'Per lokasi (10 teratas)' }), G.batang(Object.entries(r.per_lokasi || {}).map(([k, n]) => ({ label: k, n, w: 'waspada' })), { persen: false }))));
      } catch (e) { dasbor.replaceChildren(h('p', { class: 'galat-teks', text: e.message })); }
    };
    const statusFilter = () => f.status === 'menunggu' ? ['status', 'in', ['diajukan', 'tinjau_k3', 'menunggu_pengesahan']] : f.status === 'selesai' ? ['status', 'in', ['selesai_kerja', 'ditutup']] : ['status', 'eq', f.status];
    const ctl = A.daftarServer({ tabel: 'izin_kerja', namaEkspor: 'izin-kerja', kosong: 'Tidak ada izin kerja sesuai filter.',
      opsi: () => ({ filter: [statusFilter(), ['jenis', 'eq', f.jenis], ['unit_id', 'eq', f.unit], f.saya ? ['pemohon_id', 'eq', saya()] : null].filter(Boolean), cari: { kolom: ['nomor', 'pekerjaan', 'lokasi'], teks: f.cari }, rentang: { kolom: 'mulai', dari: f.dari, sampai: f.sampai }, urut: 'mulai' }),
      render: X => h('div', { class: 'daftar' }, X.map(x => h('a', { class: 'kartu laporan izin-kartu st-' + x.status, href: '#/izin?id=' + encodeURIComponent(x.id) },
        h('div', { class: 'kartu-kepala' }, h('span', { class: 'izin-judul' }, h('span', { class: 'ikon-kotak' }, ikon(IKON_IZIN[x.jenis] || 'dokumen')), h('strong', { text: x.nomor + ' · ' + x.pekerjaan })), badgeIzin(x.status)),
        h('div', { class: 'meta kecil', text: namaJenis(x.jenis) + ' · ' + namaUnit(x.unit_id) + (x.lokasi ? ' · ' + x.lokasi : '') + ' · ' + WITA(x.mulai) + ' → ' + WITA(x.selesai) }), x.perlu_tinjau ? badge('⚠ Perlu tinjau ulang (JSA berubah)', 'rk-3') : null))),
      kolomEkspor: [['nomor', 'nomor'], ['jenis', 'jenis'], ['pekerjaan', 'pekerjaan'], [r => namaUnit(r.unit_id), 'unit'], ['lokasi', 'lokasi'], ['mulai', 'mulai'], ['selesai', 'selesai'], ['status', 'status'], ['jumlah_pekerja', 'jumlah_pekerja'], [r => r.perlu_tinjau ? 'ya' : '', 'perlu_tinjau']] });
    const ubah = (k, v) => { f[k] = v; ctl.ulang(); if (['dari', 'sampai'].includes(k)) muatDasbor(); };
    const sel = pilih([['', 'Semua status'], ['menunggu', 'Menunggu persetujuan'], ['selesai', 'Selesai/ditutup']].concat(Object.entries(ST_IZIN).map(([k, v]) => [k, v[0]])), f.status, { 'aria-label': 'Status', onchange: e => ubah('status', e.target.value) });
    tampil(halaman('Izin kerja (PTW)', '/izin', [
      h('div', { class: 'tombol-baris antara' }, h('p', { class: 'kecil', text: 'Pekerjaan panas, di ketinggian, listrik, dan ruang terbatas wajib memiliki izin yang disahkan dan berdasarkan JSA. Siapa pun boleh menghentikan pekerjaan yang tidak aman (Stop Work).' }),
        h('div', { class: 'tombol-baris' }, staf() ? h('a', { class: 'btn utama', href: '#/izin?baru=1' }, ikon('tambah'), 'Ajukan izin') : null, k3() ? h('a', { class: 'btn teks', href: '#/izin?master=1' }, ikon('atur'), 'Atur daftar periksa') : null)),
      dasbor,
      h('div', { class: 'kartu filter filter-luas' }, inputCari('Cari nomor, pekerjaan, lokasi…', v => ubah('cari', v)), sel,
        pilih([['', 'Semua jenis']].concat(J.map(j => [j.kode, j.nama])), '', { 'aria-label': 'Jenis', onchange: e => ubah('jenis', e.target.value) }),
        pilih([['', 'Semua unit']].concat(A.S.ref.unit.map(u => [u.id, u.nama])), '', { 'aria-label': 'Unit', onchange: e => ubah('unit', e.target.value) }),
        bidang('Mulai dari', h('input', { type: 'date', onchange: e => ubah('dari', e.target.value) })), bidang('Sampai', h('input', { type: 'date', onchange: e => ubah('sampai', e.target.value) })),
        h('label', { class: 'saklar' }, h('input', { type: 'checkbox', onchange: e => ubah('saya', e.target.checked) }), h('span', { text: 'Pengajuan saya' })), ctl.tombolEkspor), ctl.el]));
    muatDasbor(); ctl.muat();
  }

  async function formIzin() {
    let J, sup, JSA;
    try { [J, sup, JSA] = await Promise.all([jenisIzin(), daftarSupervisor(), API.daftarModul('jsa')]); } catch (e) { return galatHalaman('Ajukan izin kerja', '/izin', e); }
    J = J.filter(j => j.aktif);
    let jenis = J[0] && J[0].kode;
    const pilihJenis = h('div', { class: 'grid-templat', role: 'radiogroup', 'aria-label': 'Jenis izin' });
    const gambarJenis = () => pilihJenis.replaceChildren(...J.map(j => h('button', { type: 'button', class: 'kartu templat' + (j.kode === jenis ? ' dipilih' : ''), role: 'radio', 'aria-checked': String(j.kode === jenis), onclick: () => { jenis = j.kode; gambarJenis(); } },
      G.ilustrasi({ panas: 'api', ketinggian: 'ketinggian', listrik: 'listrik', ruang_terbatas: 'ruang' }[j.kode] || 'api', { label: j.nama }), h('strong', { text: j.nama }), h('small', { text: (j.ceklis || []).length + ' butir periksa' + (j.butuh_uji_gas ? ' · uji atmosfer' : '') }))));
    gambarJenis();
    const sekarang = new Date(); sekarang.setMinutes(0, 0, 0); const m0 = new Date(sekarang.getTime() + 3600e3), s0 = new Date(sekarang.getTime() + 5 * 3600e3);
    const pekerjaan = h('input', { required: true, maxlength: 160 }), lokasi = h('input', { maxlength: 160 }), unit = pilih(opsiUnit(), unitSaya() || '', { required: true });
    const supervisor = pilih([['', '— pilih supervisor —']].concat(sup.filter(s => s.id !== saya()).map(s => [s.id, s.nama + ' · ' + A.PERAN[s.peran]])), '', { required: true });
    const mulai = h('input', { type: 'datetime-local', required: true, value: keLokal(m0) }), selesai = h('input', { type: 'datetime-local', required: true, value: keLokal(s0) });
    const deskripsi = h('textarea', { rows: 2, maxlength: 2000 }), pelaksana = h('input', { maxlength: 500, placeholder: 'Nama pekerja/kontraktor' }), jumlah = h('input', { type: 'number', min: 1, max: 500, value: 1 });
    const peralatan = h('input', { maxlength: 1000 }), darurat = h('textarea', { rows: 2, maxlength: 1000, placeholder: 'Contoh: APAR di lokasi, P3K, nomor darurat, rencana penyelamatan' });
    const jsaOk = JSA.filter(j => j.status === 'disetujui');
    const jsa = pilih([['', jsaOk.length ? '— pilih JSA yang disetujui —' : '— belum ada JSA disetujui —']].concat(jsaOk.map(j => [j.id, j.nomor + ' · ' + j.pekerjaan + ' (' + namaUnit(j.unit_id) + ')'])), '', { required: true });
    const bahaya = h('textarea', { rows: 3, maxlength: 2000 }), kendali = h('textarea', { rows: 3, maxlength: 2000 }), infoJsa = h('div', { 'aria-live': 'polite' });
    jsa.addEventListener('change', () => {
      const j = JSA.find(x => x.id === jsa.value); if (!j) return infoJsa.replaceChildren();
      bahaya.value = (j.langkah || []).map(s => (s.langkah || '') + ': ' + (s.uraian_bahaya || '-') + (s.dampak && s.kemungkinan ? ' [skor ' + s.dampak * s.kemungkinan + ']' : '')).join('\n').slice(0, 2000);
      kendali.value = (j.langkah || []).flatMap(s => I.URUTAN_KONTROL.filter(l => (s.kontrol || {})[l]).map(l => I.NAMA_KONTROL[l] + ': ' + s.kontrol[l])).join('\n').slice(0, 2000);
      infoJsa.replaceChildren(h('p', { class: 'kecil' }, 'Risiko tertinggi JSA: ', A.badgeTingkat(j.skor_maks || null), ' · bahaya dan pengendalian disalin ke izin (dapat dilengkapi).'));
    });
    const btn = h('button', { type: 'submit', class: 'btn utama besar' }, ikon('simpan'), 'Simpan sebagai draf');
    tampil(halaman('Ajukan izin kerja', '/izin', [h('form', { class: 'form-izin', onsubmit: async e => {
      e.preventDefault();
      if (new Date(selesai.value) <= new Date(mulai.value)) return toast('Waktu selesai harus setelah waktu mulai', 'galat');
      await sibuk(btn, async () => {
        const r = await API.simpanBaris('izin_kerja', { jenis, pekerjaan: pekerjaan.value.trim(), lokasi: lokasi.value.trim(), unit_id: +unit.value, supervisor_id: supervisor.value, mulai: dariLokal(mulai.value), selesai: dariLokal(selesai.value),
          deskripsi: deskripsi.value.trim(), pelaksana: pelaksana.value.trim(), jumlah_pekerja: +jumlah.value || 1, peralatan: peralatan.value.trim(), jsa_id: jsa.value || null, bahaya: bahaya.value.trim(), pengendalian: kendali.value.trim(), kesiapan_darurat: darurat.value.trim() });
        toast('Draf izin ' + r.nomor + ' tersimpan. Isi daftar periksa lalu ajukan.', 'ok'); pergi('/izin?id=' + encodeURIComponent(r.id));
      }).catch(() => {});
    } },
      h('section', { class: 'kartu' }, h('h2', { text: '1. Jenis pekerjaan' }), pilihJenis),
      h('section', { class: 'kartu' }, h('h2', { text: '2. Pekerjaan' }), bidang('Nama pekerjaan', pekerjaan), h('div', { class: 'dua' }, bidang('Unit/departemen', unit), bidang('Lokasi', lokasi)),
        h('div', { class: 'dua' }, bidang('Mulai', mulai), bidang('Selesai (maks. 72 jam)', selesai)), bidang('Deskripsi', deskripsi), h('div', { class: 'tiga' }, bidang('Pelaksana', pelaksana), bidang('Jumlah pekerja', jumlah), bidang('Supervisor', supervisor)), bidang('Peralatan', peralatan)),
      h('section', { class: 'kartu' }, h('h2', { text: '3. Dasar identifikasi bahaya' }), bidang('JSA rujukan (wajib)', jsa), infoJsa, h('p', { class: 'kecil' }, 'Belum ada JSA? ', h('a', { href: '#/jsa?baru=1', text: 'Buat JSA baru' }), ' lalu minta persetujuan K3RS.'),
        bidang('Identifikasi bahaya & penilaian risiko', bahaya), bidang('Pengendalian yang wajib diterapkan', kendali), bidang('Kesiapan darurat', darurat)),
      h('div', { class: 'kirim-lekat' }, btn))], { kembali: true, sempit: true }));
  }

  async function detailIzin(id) {
    let x, J, jsa, jurnal, sup;
    try { x = await API.ambilSatu('izin_kerja', id); if (!x) throw new Error('Izin tidak ditemukan atau Anda tidak berwenang.');
      [J, jsa, jurnal, sup] = await Promise.all([jenisIzin(), x.jsa_id ? API.daftarModul('jsa').then(L => L.find(j => j.id === x.jsa_id) || null).catch(() => null) : null, API.daftarDari('izin_jurnal', 'izin_id', id, 'pada'), staf() ? daftarSupervisor().catch(() => []) : []]); }
    catch (e) { return galatHalaman('Izin kerja', '/izin', e); }
    const jn = J.find(j => j.kode === x.jenis) || { nama: x.jenis };
    const nama = idp => (sup.find(s => s.id === idp) || {}).nama || (idp === saya() ? A.S.sesi.profil.nama_tampilan : '—');
    const pemohon = x.pemohon_id === saya(), isiDraf = ['draf', 'ditolak'].includes(x.status) && pemohon;
    const kini = Date.now(), selesaiMs = new Date(x.selesai).getTime(), sisaJam = (selesaiMs - kini) / 3600e3;
    const ceklis = JSON.parse(JSON.stringify(x.ceklis || [])), gas = Object.assign({}, x.uji_gas || {});
    const proses = async (aksi, catatan, data, pesanKonfirmasi) => {
      if (pesanKonfirmasi && !await konfirmasi(pesanKonfirmasi[0], pesanKonfirmasi[1], pesanKonfirmasi[2] || 'Ya, lanjutkan', !!pesanKonfirmasi[3])) return;
      try { const r = await API.izinProses(id, aksi, catatan || '', data || {}); toast(r && r.pesan || 'Tersimpan', r && r.status === 'kedaluwarsa' ? 'galat' : 'ok'); A.jalankan(); } catch (e) { toast(e.message, 'galat'); }
    };
    const simpanCeklis = async btn => { await sibuk(btn, async () => { await API.simpanBaris('izin_kerja', { id, ceklis, uji_gas: gas }); toast('Daftar periksa tersimpan', 'ok'); }).catch(() => {}); };
    // Aksi sesuai peran & status (server tetap memeriksa)
    const aksi = [];
    if (isiDraf) aksi.push(tombol([ikon('kirim'), 'Ajukan'], async ev => { await simpanCeklis(ev.currentTarget); proses('ajukan', '', {}, ['Ajukan izin kerja?', 'Pastikan daftar periksa diisi sesuai kondisi lapangan.']); }, 'utama'));
    if (x.status === 'diajukan' && x.supervisor_id === saya()) { aksi.push(tombol([ikon('centang'), 'Setujui (supervisor)'], () => proses('setujui_supervisor', '', {}, ['Setujui sebagai supervisor?', 'Izin diteruskan ke K3RS untuk ditinjau.']), 'utama')); }
    if (x.status === 'tinjau_k3' && k3()) aksi.push(tombol([ikon('centang'), 'Setujui tinjauan K3'], () => proses('setujui_k3', '', {}, ['Tinjauan K3 sesuai?', 'Izin diteruskan untuk pengesahan.']), 'utama'));
    if (x.status === 'menunggu_pengesahan' && k3()) aksi.push(tombol([ikon('perisai'), 'Sahkan izin'], () => proses('sahkan', '', {}, ['Sahkan izin kerja?', 'Pengesah harus berbeda dari pemohon dan supervisor. JSA rujukan harus tetap disetujui.']), 'utama'));
    if ((x.status === 'diajukan' && (x.supervisor_id === saya() || k3())) || (['tinjau_k3', 'menunggu_pengesahan'].includes(x.status) && k3())) aksi.push(tombol([ikon('silang'), 'Tolak'], () => { const c = tanya('Alasan penolakan:', 5); if (c) proses('tolak', c); }, 'kedua'));
    if (x.status === 'disahkan' && (pemohon || x.supervisor_id === saya() || k3())) aksi.push(tombol([ikon('kanan'), 'Mulai pekerjaan'], () => proses('mulai', '', {}, ['Mulai pekerjaan sekarang?', 'Pastikan semua pengendalian sudah diterapkan di lapangan.']), 'utama'));
    if (x.status === 'aktif' && (pemohon || x.supervisor_id === saya() || k3())) aksi.push(tombol([ikon('berhasil'), 'Pekerjaan selesai'], () => proses('selesai_kerja', '', {}, ['Tandai pekerjaan selesai?', 'K3RS akan memeriksa area sebelum izin ditutup.']), 'utama'));
    if (x.status === 'ditangguhkan' && k3() && !x.perlu_tinjau) aksi.push(tombol([ikon('kanan'), 'Lanjutkan pekerjaan'], () => { const c = tanya('Tindakan yang sudah dilakukan sebelum dilanjutkan:', 5); if (c) proses('lanjutkan', c); }, 'utama'));
    if (x.perlu_tinjau && k3() && !pemohon) aksi.push(tombol([ikon('muat'), 'Tinjau ulang JSA'], () => { const c = tanya('Hasil tinjauan ulang terhadap perubahan JSA:', 5); if (c) proses('tinjau_ulang', c); }, 'utama'));
    if (['disahkan', 'aktif'].includes(x.status) && (pemohon || x.supervisor_id === saya()) && !x.perpanjangan_diminta) aksi.push(tombol([ikon('jam'), 'Minta perpanjangan'], () => {
      const baru = window.prompt('Waktu selesai baru (format: YYYY-MM-DD HH:MM, WITA):', keLokal(new Date(selesaiMs + 2 * 3600e3)).replace('T', ' ')); if (!baru) return;
      const c = tanya('Alasan perpanjangan:', 5); if (c) proses('minta_perpanjangan', c, { selesai_baru: new Date(baru.replace(' ', 'T')).toISOString() });
    }, 'kedua'));
    if (x.perpanjangan_diminta && k3() && !pemohon) aksi.push(tombol([ikon('centang'), 'Setujui perpanjangan s.d. ' + WITA(x.perpanjangan_diminta)], () => { const c = tanya('Catatan persetujuan perpanjangan:', 0); if (c !== null) proses('setujui_perpanjangan', c || 'Disetujui'); }, 'utama'));
    if (['selesai_kerja', 'kedaluwarsa', 'ditangguhkan'].includes(x.status) && k3()) {
      const aman = h('input', { type: 'checkbox' });
      aksi.push(h('div', { class: 'tutup-izin' }, h('label', { class: 'saklar' }, aman, h('span', { text: 'Saya memastikan pekerjaan selesai/dihentikan dan area sudah aman' })),
        tombol([ikon('gembok'), 'Tutup izin'], () => { if (!aman.checked) return toast('Centang konfirmasi area aman', 'galat'); const c = tanya('Catatan penutupan (opsional):', 0); proses('tutup', c || 'Area aman', { area_aman: true }); }, 'utama')));
    }
    if (['draf', 'diajukan', 'tinjau_k3', 'menunggu_pengesahan', 'disahkan', 'ditolak'].includes(x.status) && (pemohon || k3())) aksi.push(tombol([ikon('silang'), 'Batalkan izin'], () => proses('batalkan', 'Dibatalkan', {}, ['Batalkan izin kerja?', 'Izin tidak dapat dipakai lagi.', 'Batalkan', true]), 'teks'));
    const swa = ['disahkan', 'aktif'].includes(x.status) ? h('section', { class: 'kartu swa' }, h('div', {}, h('strong', { text: 'STOP WORK AUTHORITY' }), h('p', { class: 'kecil', text: 'Siapa pun yang melihat kondisi tidak aman WAJIB menghentikan pekerjaan ini.' })),
      tombol([ikon('larang'), 'HENTIKAN PEKERJAAN'], () => { const c = tanya('Kondisi tidak aman yang ditemukan:', 5); if (c) proses('tangguhkan', c); }, 'swa-tombol')) : null;
    // Daftar periksa
    const tabelCeklis = h('div', { class: 'ceklis-izin' }, ceklis.map((c, i) => h('div', { class: 'ceklis-baris' + (c.wajib ? ' wajib' : '') },
      h('span', { class: 'ceklis-butir' }, c.wajib ? h('strong', { class: 'tanda-wajib', title: 'Wajib', text: 'WAJIB' }) : null, c.butir),
      isiDraf ? h('div', { class: 'radio-baris', role: 'radiogroup', 'aria-label': c.butir }, [['ya', '✓ Ya'], ['tidak', '✕ Tidak'], ['na', '– N/A']].map(([v, l]) => h('label', { class: 'pil' }, h('input', { type: 'radio', name: 'ck' + i, checked: c.nilai === v, onchange: () => { c.nilai = v; } }), l)))
        : badge(c.nilai === 'ya' ? '✓ Ya' : c.nilai === 'tidak' ? '✕ Tidak' : c.nilai === 'na' ? '– N/A' : '? Belum', c.nilai === 'ya' ? 'rk-0' : c.nilai === 'tidak' ? 'rk-3' : 'rk-x'))));
    const kolomGas = [['o2', 'O₂ (%)', '19,5–23,5'], ['lel', 'LEL (%)', '< 10'], ['h2s', 'H₂S (ppm)', '< 10'], ['co', 'CO (ppm)', '< 25']];
    const ujiGas = (J.find(j => j.kode === x.jenis) || {}).butuh_uji_gas ? h('section', { class: 'kartu' }, h('h2', { text: 'Uji atmosfer' }), h('p', { class: 'kecil', text: 'Batas umum di bawah adalah rujukan minimum; ikuti prosedur RS dan ulangi pengukuran selama pekerjaan.' }),
      h('div', { class: 'tiga' }, kolomGas.map(([k, l, bts]) => bidang(l + ' · aman ' + bts, h('input', { type: 'number', step: 'any', value: gas[k] != null ? gas[k] : '', disabled: !isiDraf, oninput: e => { gas[k] = e.target.value === '' ? null : +e.target.value; } })))),
      bidang('Waktu & petugas pengukur', h('input', { maxlength: 120, value: gas.oleh || '', disabled: !isiDraf, oninput: e => { gas.oleh = e.target.value; } }))) : null;
    const sisa = ['disahkan', 'aktif'].includes(x.status) ? badge(sisaJam > 0 ? (sisaJam < 2 ? '⌛ Berakhir dalam ' + Math.max(1, Math.round(sisaJam * 60)) + ' menit' : 'Berlaku ' + Math.floor(sisaJam) + ' jam lagi') : '⌛ Lewat masa berlaku', sisaJam < 2 ? 'rk-2' : 'netral') : null;
    tampil(halaman('Izin ' + x.nomor, '/izin', [
      x.perlu_tinjau ? h('div', { class: 'peringatan-dini lv-3', role: 'alert' }, h('span', { class: 'pd-ikon', 'aria-hidden': 'true' }, ikon('awas')), h('span', { class: 'pd-isi' }, h('span', { class: 'pd-tingkat', text: '✕ Perlu ditinjau ulang' }), h('strong', { text: x.alasan_tinjau || 'JSA rujukan berubah' }), h('small', { text: 'Pekerjaan tidak dapat dimulai/dilanjutkan sampai K3RS meninjau ulang.' }))) : null,
      h('section', { class: 'kartu izin-kepala st-' + x.status }, h('div', { class: 'kartu-kepala' }, h('span', { class: 'izin-judul' }, h('span', { class: 'ikon-kotak' }, ikon(IKON_IZIN[x.jenis] || 'dokumen')), h('h2', { text: x.pekerjaan })), badgeIzin(x.status)),
        h('p', { class: 'kecil', text: x.nomor + ' · ' + jn.nama + ' · ' + namaUnit(x.unit_id) + (x.lokasi ? ' · ' + x.lokasi : '') }),
        h('p', {}, h('strong', { text: 'Berlaku: ' }), WITA(x.mulai) + ' → ' + WITA(x.selesai) + ' WITA ', sisa),
        stepper(ALUR, ['ditolak', 'ditangguhkan', 'dibatalkan', 'kedaluwarsa'].includes(x.status) ? (jurnal.length ? jurnal[jurnal.length - 1].dari : 'draf') : x.status, ['ditolak', 'ditangguhkan', 'dibatalkan', 'kedaluwarsa'].includes(x.status) ? (ST_IZIN[x.status][0] + (x.catatan_status ? ' — ' + x.catatan_status : '')) : null),
        h('div', { class: 'tombol-baris' }, aksi)),
      swa,
      h('section', { class: 'kartu' }, h('h2', { text: 'Rincian pekerjaan' }), h('dl', { class: 'rincian' }, h('dt', { text: 'Pemohon' }), h('dd', { text: nama(x.pemohon_id) }), h('dt', { text: 'Supervisor' }), h('dd', { text: nama(x.supervisor_id) }),
        h('dt', { text: 'Petugas K3 peninjau' }), h('dd', { text: x.petugas_k3_id ? nama(x.petugas_k3_id) : '—' }), h('dt', { text: 'Pengesah' }), h('dd', { text: x.pengesah_id ? nama(x.pengesah_id) : '—' }),
        h('dt', { text: 'Pelaksana' }), h('dd', { text: (x.pelaksana || '—') + ' · ' + x.jumlah_pekerja + ' orang' }), h('dt', { text: 'Peralatan' }), h('dd', { text: x.peralatan || '—' }), h('dt', { text: 'Deskripsi' }), h('dd', { text: x.deskripsi || '—' }), h('dt', { text: 'Kesiapan darurat' }), h('dd', { text: x.kesiapan_darurat || '—' }))),
      h('section', { class: 'kartu' }, h('div', { class: 'kartu-kepala' }, h('h2', { text: 'JSA, bahaya & pengendalian' }), jsa ? h('a', { class: 'btn teks kecil', href: '#/jsa?id=' + encodeURIComponent(jsa.id) }, ikon('jsa'), jsa.nomor) : badge('Tanpa JSA', 'rk-3')),
        jsa ? h('p', { class: 'kecil' }, 'Status JSA: ' + jsa.status + ' · risiko tertinggi ', A.badgeTingkat(jsa.skor_maks || null), x.jsa_versi ? ' · versi saat disahkan ' + WITA(x.jsa_versi) : '') : null,
        h('h3', { text: 'Bahaya' }), h('p', { class: 'teks-dok', text: x.bahaya || '—' }), h('h3', { text: 'Pengendalian wajib' }), h('p', { class: 'teks-dok', text: x.pengendalian || '—' })),
      h('section', { class: 'kartu' }, h('div', { class: 'kartu-kepala' }, h('h2', { text: 'Daftar periksa ' + jn.nama }), isiDraf ? tombol([ikon('simpan'), 'Simpan'], ev => simpanCeklis(ev.currentTarget), 'kedua kecil') : null),
        h('p', { class: 'kecil', text: 'Daftar periksa membantu, tetapi tidak menggantikan pengujian atmosfer, isolasi energi, kompetensi pekerja, dan rencana penyelamatan sesuai prosedur.' }), tabelCeklis),
      ujiGas,
      h('section', { class: 'kartu' }, h('h2', { text: 'Jurnal izin' }), jurnal.length ? h('ol', { class: 'linimasa-kronologi' }, jurnal.map(j => h('li', {}, h('strong', { text: WITA(j.pada) }), h('span', { text: j.aksi.replace(/_/g, ' ') + (j.dari !== j.ke ? ' (' + (j.dari || '—') + ' → ' + j.ke + ')' : '') + (j.catatan ? ' — ' + j.catatan : '') + (j.oleh ? ' · ' + nama(j.oleh) : ' · sistem') })))) : h('p', { class: 'kecil', text: 'Belum ada catatan.' })),
      k3() ? A.panelJejak('izin_kerja', id) : null], { kembali: true }));
  }

  async function masterIzin() {
    if (!k3()) return galatHalaman('Daftar periksa izin', '/izin', new Error('Hanya K3RS'));
    let J; try { J = await API.jenisIzin(); } catch (e) { return galatHalaman('Daftar periksa izin', '/izin', e); }
    const kartu = j => {
      const L = JSON.parse(JSON.stringify(j.ceklis || [])); const w = h('div');
      const gambar = () => w.replaceChildren(...L.map((c, i) => h('div', { class: 'baris-item' }, (() => { const e = h('input', { maxlength: 200, 'aria-label': 'Butir periksa', oninput: ev => { c.butir = ev.target.value; } }); e.value = c.butir || ''; return e; })(),
        h('label', { class: 'saklar kecil' }, h('input', { type: 'checkbox', checked: !!c.wajib, onchange: ev => { c.wajib = ev.target.checked; } }), h('span', { text: 'Wajib' })), tombol([ikon('hapus')], () => { L.splice(i, 1); gambar(); }, 'teks kecil', { 'aria-label': 'Hapus butir' }))),
        tombol([ikon('tambah'), 'Tambah butir'], () => { L.push({ butir: '', wajib: false }); gambar(); }, 'kedua kecil'));
      gambar();
      const aktif = h('input', { type: 'checkbox', checked: j.aktif }), gasCb = h('input', { type: 'checkbox', checked: j.butuh_uji_gas }), nm = h('input', { value: j.nama, maxlength: 80 });
      return h('details', { class: 'kartu' }, h('summary', { text: j.nama + ' (' + L.length + ' butir)' }), bidang('Nama', nm), w,
        h('label', { class: 'saklar' }, gasCb, h('span', { text: 'Wajib uji atmosfer' })), h('label', { class: 'saklar' }, aktif, h('span', { text: 'Aktif' })),
        tombol([ikon('simpan'), 'Simpan'], async ev => { await sibuk(ev.currentTarget, async () => { await API.simpanJenisIzin({ kode: j.kode, nama: nm.value.trim(), ceklis: L.filter(c => (c.butir || '').trim()), butuh_uji_gas: gasCb.checked, aktif: aktif.checked, urutan: j.urutan }); jenisCache = null; toast('Tersimpan. Berlaku untuk izin baru.', 'ok'); }).catch(() => {}); }, 'utama'));
    };
    const kode = h('input', { maxlength: 30, placeholder: 'contoh: angkat_berat' }), nmBaru = h('input', { maxlength: 80, placeholder: 'contoh: Pengangkatan beban berat' });
    tampil(halaman('Daftar periksa izin kerja', '/izin', [h('p', { class: 'kecil', text: 'Perubahan berlaku untuk izin yang dibuat sesudahnya; izin lama tetap memakai daftar periksa saat dibuat.' }), J.map(kartu),
      h('section', { class: 'kartu' }, h('h2', { text: 'Tambah jenis izin' }), h('div', { class: 'dua' }, bidang('Kode (huruf kecil, garis bawah)', kode), bidang('Nama', nmBaru)),
        tombol([ikon('tambah'), 'Tambah'], async ev => { if (!/^[a-z_]{2,30}$/.test(kode.value)) return toast('Kode 2–30 huruf kecil/garis bawah', 'galat'); await sibuk(ev.currentTarget, async () => { await API.simpanJenisIzin({ kode: kode.value, nama: nmBaru.value.trim(), ceklis: [], urutan: J.length + 1 }); jenisCache = null; A.jalankan(); }).catch(() => {}); }, 'kedua'))], { kembali: true }));
  }

  // =====================================================================
  // TOOLBOX MEETING & PELATIHAN
  // =====================================================================
  const ST_KEG = { terjadwal: ['● Terjadwal', 'rk-1'], selesai: ['✓ Selesai', 'rk-0'], dibatalkan: ['– Dibatalkan', 'rk-x'] };
  const HADIR = { belum: '? Belum', hadir: '✓ Hadir', absen: '✕ Absen', izin: '– Izin' };
  const tipeLabel = t => t === 'toolbox' ? 'Toolbox meeting' : 'Pelatihan';
  async function hKegiatan() {
    const q = qs();
    if (q.get('id')) return detailKegiatan(q.get('id'));
    if (q.get('baru')) return formKegiatan(null, q.get('baru'));
    if (q.get('ubah')) return formKegiatan(q.get('ubah'));
    if (q.get('sertifikat')) return sertifikat(q.get('sertifikat'));
    let tab = q.get('saya') ? 'saya' : q.get('tab') || 'kalender';
    const wadah = h('div'), tb = h('div');
    const gambar = () => { tb.replaceChildren(A.tab([['kalender', 'Kalender', 'kalender'], ['daftar', 'Daftar', 'daftar'], ['dasbor', 'Dasbor', 'grafik'], ['saya', 'Riwayat saya', 'pengguna']], tab, t => { tab = t; gambar(); }));
      ({ kalender: tKalender, daftar: tDaftar, dasbor: tDasbor, saya: tSaya }[tab])(wadah); };
    tampil(halaman('Pelatihan & toolbox meeting', '/kegiatan', [h('div', { class: 'tombol-baris antara' }, h('p', { class: 'kecil', text: 'Kehadiran dicatat terpisah dari kompetensi: kompetensi dinilai dengan metode asesmen.' }),
      staf() ? h('div', { class: 'tombol-baris' }, h('a', { class: 'btn utama', href: '#/kegiatan?baru=toolbox' }, ikon('tambah'), 'Toolbox meeting'), h('a', { class: 'btn kedua', href: '#/kegiatan?baru=pelatihan' }, ikon('tambah'), 'Pelatihan')) : null), tb, wadah]));
    gambar();
  }
  async function tKalender(w) {
    let bulan = new Date(); bulan.setDate(1);
    const gambar = async () => {
      const awal = new Date(bulan), akhir = new Date(bulan.getFullYear(), bulan.getMonth() + 1, 0);
      const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
      let r; try { r = await API.halaman('kegiatan', { rentang: { kolom: 'mulai', dari: iso(awal), sampai: iso(akhir) }, urut: 'mulai', naik: true, ukuran: 100 }); } catch (e) { return w.replaceChildren(h('div', { class: 'kartu bahaya-kotak' }, h('p', { text: e.message }))); }
      const perHari = {}; r.baris.forEach(k => { const t = new Date(k.mulai).getDate(); (perHari[t] = perHari[t] || []).push(k); });
      const sel = []; const geser = (awal.getDay() + 6) % 7; for (let i = 0; i < geser; i++) sel.push(h('div', { class: 'kal-sel kosong', 'aria-hidden': 'true' }));
      for (let t = 1; t <= akhir.getDate(); t++) { const hariIni = iso(new Date(bulan.getFullYear(), bulan.getMonth(), t)) === I.tanggalLokal();
        sel.push(h('div', { class: 'kal-sel' + (hariIni ? ' hari-ini' : ''), role: 'gridcell', 'aria-label': t + ' — ' + (perHari[t] || []).length + ' kegiatan' }, h('span', { class: 'kal-tgl', text: String(t) }),
          (perHari[t] || []).map(k => h('a', { class: 'kal-acara ' + k.tipe + (k.status === 'dibatalkan' ? ' batal' : ''), href: '#/kegiatan?id=' + encodeURIComponent(k.id), title: k.judul },
            h('span', { text: new Date(k.mulai).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' ' + (k.tipe === 'toolbox' ? '◆ ' : '● ') + k.judul }))))); }
      w.replaceChildren(h('section', { class: 'kartu' }, h('div', { class: 'kartu-kepala' }, tombol('‹', () => { bulan.setMonth(bulan.getMonth() - 1); gambar(); }, 'kedua kecil', { 'aria-label': 'Bulan sebelumnya' }),
        h('h2', { text: bulan.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }) }), tombol('›', () => { bulan.setMonth(bulan.getMonth() + 1); gambar(); }, 'kedua kecil', { 'aria-label': 'Bulan berikutnya' })),
        h('div', { class: 'kal-kepala', 'aria-hidden': 'true' }, ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].map(x => h('span', { text: x }))), h('div', { class: 'kalender', role: 'grid' }, sel),
        h('p', { class: 'kecil', text: '◆ Toolbox meeting · ● Pelatihan · ' + r.total + ' kegiatan bulan ini' })));
    };
    gambar();
  }
  function tDaftar(w) {
    const f = { tipe: '', status: '', unit: '', dari: '', sampai: '', cari: '' };
    const ctl = A.daftarServer({ tabel: 'kegiatan', namaEkspor: 'kegiatan', kosong: 'Belum ada kegiatan.',
      opsi: () => ({ filter: [['tipe', 'eq', f.tipe], ['status', 'eq', f.status], ['unit_id', 'eq', f.unit]], cari: { kolom: ['nomor', 'judul', 'topik'], teks: f.cari }, rentang: { kolom: 'mulai', dari: f.dari, sampai: f.sampai }, urut: 'mulai' }),
      render: X => h('div', { class: 'daftar' }, X.map(k => h('a', { class: 'kartu laporan', href: '#/kegiatan?id=' + encodeURIComponent(k.id) }, h('div', { class: 'kartu-kepala' }, h('strong', { text: (k.tipe === 'toolbox' ? '◆ ' : '● ') + k.judul }), badge(ST_KEG[k.status][0], ST_KEG[k.status][1])),
        h('div', { class: 'meta kecil', text: k.nomor + ' · ' + tipeLabel(k.tipe) + ' · ' + WITA(k.mulai) + ' · ' + k.durasi_menit + ' menit · ' + namaUnit(k.unit_id) + (k.lokasi ? ' · ' + k.lokasi : '') })))),
      kolomEkspor: [['nomor', 'nomor'], ['tipe', 'tipe'], ['judul', 'judul'], ['kategori', 'kategori'], ['mulai', 'mulai'], ['durasi_menit', 'durasi_menit'], [r => namaUnit(r.unit_id), 'unit'], ['lokasi', 'lokasi'], ['pemateri', 'pemateri'], ['status', 'status']] });
    const ubah = (k, v) => { f[k] = v; ctl.ulang(); };
    w.replaceChildren(h('div', { class: 'kartu filter filter-luas' }, inputCari('Cari judul, topik…', v => ubah('cari', v)), pilih([['', 'Semua tipe'], ['toolbox', 'Toolbox meeting'], ['pelatihan', 'Pelatihan']], '', { 'aria-label': 'Tipe', onchange: e => ubah('tipe', e.target.value) }),
      pilih([['', 'Semua status']].concat(Object.entries(ST_KEG).map(([k, v]) => [k, v[0]])), '', { 'aria-label': 'Status', onchange: e => ubah('status', e.target.value) }),
      pilih([['', 'Semua unit']].concat(A.S.ref.unit.map(u => [u.id, u.nama])), '', { 'aria-label': 'Unit', onchange: e => ubah('unit', e.target.value) }),
      bidang('Dari', h('input', { type: 'date', onchange: e => ubah('dari', e.target.value) })), bidang('Sampai', h('input', { type: 'date', onchange: e => ubah('sampai', e.target.value) })), ctl.tombolEkspor), ctl.el);
    ctl.muat();
  }
  async function tDasbor(w) {
    let r; try { r = await API.kegiatanRingkas(I.geserHari(I.tanggalLokal(), -364), null); } catch (e) { return w.replaceChildren(h('div', { class: 'kartu bahaya-kotak' }, h('p', { text: e.message }))); }
    const pr = v => v == null ? '—' : String(v).replace('.', ',') + '%';
    w.replaceChildren(h('p', { class: 'kecil', text: '12 bulan terakhir, sesuai data yang boleh Anda lihat.' }),
      h('div', { class: 'grid-angka spi' }, A.ubin('Pelatihan', r.pelatihan, '', '', 'jsa'), A.ubin('Toolbox meeting', r.toolbox, '', '', 'pesan'), A.ubin('Peserta (unik)', r.peserta_unik, r.peserta + ' kehadiran tercatat', '', 'orang'),
        A.ubin('Tingkat kehadiran', pr(r.tingkat_hadir), 'Kegiatan yang sudah selesai', r.tingkat_hadir != null && r.tingkat_hadir < 80 ? 'kuning' : '', 'centang'), A.ubin('Pelatihan terlaksana', pr(r.pelatihan_selesai_persen), 'Dari pelatihan yang jadwalnya sudah lewat', '', 'berhasil'),
        A.ubin('Rata-rata post-test', r.rata_post == null ? '—' : r.rata_post, 'Pre-test: ' + (r.rata_pre == null ? '—' : r.rata_pre), '', 'grafik'), A.ubin('Akan datang', r.akan_datang, '', '', 'kalender'), A.ubin('Belum diselesaikan', r.terlambat, 'Jadwal lewat, status masih terjadwal', r.terlambat ? 'kuning' : '', 'jam')),
      h('div', { class: 'intel-grid' }, h('section', { class: 'kartu' }, h('h2', { text: 'Efektivitas: pre-test vs post-test' }), r.rata_pre == null ? h('p', { class: 'kecil', text: 'Belum ada nilai pre/post-test.' }) : G.batang([{ label: 'Rata-rata pre-test', n: +r.rata_pre, w: 'netral' }, { label: 'Rata-rata post-test', n: +r.rata_post, w: 'aman' }], { persen: false }),
        h('p', { class: 'kecil', text: 'Kompeten: ' + r.kompeten + ' dari ' + r.dinilai + ' peserta yang dinilai. Kehadiran tidak sama dengan kompetensi.' })),
        h('section', { class: 'kartu' }, h('h2', { text: 'Per unit/departemen' }), G.batang(Object.entries(r.per_unit || {}).map(([k, n]) => ({ label: k, n, w: 'navy' })), { persen: false })),
        h('section', { class: 'kartu' }, h('h2', { text: 'Pelatihan per kategori' }), G.batang(Object.entries(r.per_kategori || {}).map(([k, n]) => ({ label: k, n })), { persen: false }))));
  }
  async function tSaya(w) {
    try {
      const P = await API.halaman('kegiatan_peserta', { filter: [['profil_id', 'eq', saya()]], urut: 'id', ukuran: 100 });
      const ids = P.baris.map(p => p.kegiatan_id); const K = ids.length ? (await API.halaman('kegiatan', { filter: [['id', 'in', ids]], ukuran: 100 })).baris : [];
      const keg = id => K.find(k => k.id === id) || {};
      w.replaceChildren(P.baris.length ? h('div', { class: 'tabel-gulir' }, h('table', { class: 'tabel tumpuk' }, h('thead', {}, h('tr', {}, ['Kegiatan', 'Tanggal', 'Kehadiran', 'Pre / Post', 'Kompetensi', 'Sertifikat'].map(t => h('th', { scope: 'col', text: t })))),
        h('tbody', {}, P.baris.map(p => h('tr', {}, h('td', { 'data-label': 'Kegiatan' }, h('a', { href: '#/kegiatan?id=' + encodeURIComponent(p.kegiatan_id), text: keg(p.kegiatan_id).judul || '—' })), h('td', { 'data-label': 'Tanggal', text: WITA(keg(p.kegiatan_id).mulai) }),
          h('td', { 'data-label': 'Kehadiran', text: HADIR[p.kehadiran] }), h('td', { 'data-label': 'Pre / Post', text: (p.nilai_pre == null ? '—' : p.nilai_pre) + ' / ' + (p.nilai_post == null ? '—' : p.nilai_post) }),
          h('td', { 'data-label': 'Kompetensi', text: { belum_dinilai: 'Belum dinilai', kompeten: '✓ Kompeten', belum_kompeten: '✕ Belum kompeten' }[p.kompetensi] }),
          h('td', { 'data-label': 'Sertifikat' }, p.sertifikat_nomor ? h('a', { href: '#/kegiatan?sertifikat=' + p.id, text: p.sertifikat_nomor + (p.sertifikat_berlaku_sampai ? ' (s.d. ' + A.tgl(p.sertifikat_berlaku_sampai) + ')' : '') }) : '—')))))) : kosong('Belum ada riwayat pelatihan atau toolbox meeting.'));
    } catch (e) { w.replaceChildren(h('div', { class: 'kartu bahaya-kotak' }, h('p', { text: e.message }))); }
  }
  async function formKegiatan(idUbah, tipeBaru) {
    let lama = null, sup;
    try { if (idUbah) lama = await API.ambilSatu('kegiatan', idUbah); sup = await daftarSupervisor(); } catch (e) { return galatHalaman('Kegiatan', '/kegiatan', e); }
    const tipe = lama ? lama.tipe : (tipeBaru === 'pelatihan' ? 'pelatihan' : 'toolbox');
    const v = (k, d) => lama ? lama[k] : d;
    const judul = h('input', { required: true, maxlength: 160, value: v('judul', '') }), kategori = h('input', { maxlength: 60, value: v('kategori', ''), placeholder: tipe === 'pelatihan' ? 'Contoh: Kebakaran, Ergonomi' : 'Topik K3' });
    const tujuan = h('textarea', { rows: 2, maxlength: 1000 }); tujuan.value = v('tujuan', '');
    const topik = h('textarea', { rows: 3, maxlength: 2000, placeholder: 'Poin pembahasan' }); topik.value = v('topik', '');
    const materi = h('textarea', { rows: 3, maxlength: 6000, placeholder: 'Ringkasan materi atau tautan ke SOP' }); materi.value = v('materi', '');
    const pemateri = h('input', { maxlength: 120, value: v('pemateri', '') }), lokasi = h('input', { maxlength: 120, value: v('lokasi', '') }), unit = pilih(opsiUnit(), v('unit_id', unitSaya() || ''), { required: true });
    const supervisor = pilih([['', '— tidak ada —']].concat(sup.map(s => [s.id, s.nama])), v('supervisor_id', ''));
    const mulai = h('input', { type: 'datetime-local', required: true, value: keLokal(v('mulai', new Date(Date.now() + 86400e3))) }), durasi = h('input', { type: 'number', min: 5, max: 1440, value: v('durasi_menit', tipe === 'toolbox' ? 15 : 120) });
    const berlaku = h('input', { type: 'number', min: 1, max: 120, value: v('berlaku_bulan', '') || '', placeholder: 'kosong = tidak kedaluwarsa' });
    const btn = h('button', { type: 'submit', class: 'btn utama besar' }, ikon('simpan'), lama ? 'Simpan perubahan' : 'Jadwalkan');
    tampil(halaman((lama ? 'Ubah ' : 'Jadwalkan ') + tipeLabel(tipe).toLowerCase(), '/kegiatan', [h('form', { class: 'kartu', onsubmit: async e => {
      e.preventDefault(); await sibuk(btn, async () => {
        const data = { judul: judul.value.trim(), kategori: kategori.value.trim(), tujuan: tujuan.value.trim(), topik: topik.value.trim(), materi: materi.value.trim(), pemateri: pemateri.value.trim(), lokasi: lokasi.value.trim(), unit_id: +unit.value,
          supervisor_id: supervisor.value || null, mulai: dariLokal(mulai.value), durasi_menit: +durasi.value, berlaku_bulan: tipe === 'pelatihan' && berlaku.value ? +berlaku.value : null };
        if (lama) data.id = lama.id; else data.tipe = tipe;
        const r = await API.simpanBaris('kegiatan', data); toast(lama ? 'Perubahan tersimpan; peserta diberi tahu bila jadwal berubah' : 'Kegiatan ' + r.nomor + ' dijadwalkan', 'ok'); pergi('/kegiatan?id=' + encodeURIComponent(r.id || lama.id));
      }).catch(() => {});
    } }, bidang('Judul', judul), h('div', { class: 'dua' }, bidang('Kategori', kategori), bidang('Pemateri/trainer', pemateri)), tipe === 'pelatihan' ? bidang('Tujuan pelatihan', tujuan) : null, bidang('Topik pembahasan', topik), bidang('Materi', materi),
      h('div', { class: 'dua' }, bidang('Mulai', mulai), bidang('Durasi (menit)', durasi)), h('div', { class: 'dua' }, bidang('Unit/departemen', unit), bidang('Lokasi', lokasi)), bidang('Supervisor', supervisor),
      tipe === 'pelatihan' ? bidang('Masa berlaku sertifikat (bulan)', berlaku) : null, btn)], { kembali: true, sempit: true }));
  }
  async function detailKegiatan(id) {
    let k, P, capa;
    try { k = await API.ambilSatu('kegiatan', id); if (!k) throw new Error('Kegiatan tidak ditemukan atau Anda tidak berwenang.'); [P, capa] = await Promise.all([API.daftarDari('kegiatan_peserta', 'kegiatan_id', id, 'nama'), API.daftarDari('capa', 'kegiatan_id', id, 'dibuat_pada').catch(() => [])]); }
    catch (e) { return galatHalaman('Kegiatan', '/kegiatan', e); }
    const penyelenggara = k3() || k.dibuat_oleh === saya() || k.supervisor_id === saya() || (peran() === 'pj_unit' && k.unit_id === unitSaya());
    const latihan = k.tipe === 'pelatihan', bisaUbah = penyelenggara && k.status !== 'dibatalkan';
    const qrWadah = h('div', { class: 'qr-hadir' });
    const tampilQr = async () => { try { const kode = await API.kegiatanKode(id); const url = location.origin + location.pathname + '#/hadir?k=' + encodeURIComponent(kode);
      qrWadah.replaceChildren(A.QR.svg(url, 220), h('p', { class: 'kecil', text: 'Peserta memindai kode ini dengan aplikasi HSE (login) untuk presensi. Berlaku 30 menit sebelum s.d. 60 menit setelah kegiatan. Kode: ' + kode })); } catch (e) { toast(e.message, 'galat'); } };
    const barisPeserta = p => {
      const hadir = pilih(Object.entries(HADIR), p.kehadiran, { disabled: !bisaUbah, 'aria-label': 'Kehadiran ' + p.nama });
      const pre = h('input', { type: 'number', min: 0, max: 100, step: '0.5', value: p.nilai_pre == null ? '' : p.nilai_pre, disabled: !bisaUbah, 'aria-label': 'Nilai pre-test ' + p.nama });
      const post = h('input', { type: 'number', min: 0, max: 100, step: '0.5', value: p.nilai_post == null ? '' : p.nilai_post, disabled: !bisaUbah, 'aria-label': 'Nilai post-test ' + p.nama });
      const evals = pilih([['', '—'], [1, '1'], [2, '2'], [3, '3'], [4, '4'], [5, '5']], p.evaluasi || '', { disabled: !bisaUbah, 'aria-label': 'Evaluasi ' + p.nama });
      const komp = pilih([['belum_dinilai', 'Belum dinilai'], ['kompeten', '✓ Kompeten'], ['belum_kompeten', '✕ Belum kompeten']], p.kompetensi, { disabled: !bisaUbah, 'aria-label': 'Kompetensi ' + p.nama });
      const metode = h('input', { maxlength: 200, value: p.metode_asesmen || '', placeholder: 'Metode asesmen (praktik, observasi, tes)', disabled: !bisaUbah, 'aria-label': 'Metode asesmen ' + p.nama });
      const simpan = tombol([ikon('simpan')], async ev => { await sibuk(ev.currentTarget, async () => {
        const n = v => v === '' ? null : +v;
        const r = await API.simpanBaris('kegiatan_peserta', Object.assign({ id: p.id, kehadiran: hadir.value }, latihan ? { nilai_pre: n(pre.value), nilai_post: n(post.value), evaluasi: n(evals.value), kompetensi: komp.value, metode_asesmen: metode.value.trim() } : {}));
        Object.assign(p, r); toast('Tersimpan' + (r.sertifikat_nomor ? ' · sertifikat ' + r.sertifikat_nomor : ''), 'ok'); gambarPeserta();
      }).catch(() => {}); }, 'kedua kecil', { 'aria-label': 'Simpan ' + p.nama });
      return h('tr', {}, h('td', { 'data-label': 'Peserta', text: p.nama }), h('td', { 'data-label': 'Kehadiran' }, hadir, p.cara_hadir === 'qr' ? h('small', { text: ' (QR)' }) : null),
        latihan ? [h('td', { 'data-label': 'Pre-test' }, pre), h('td', { 'data-label': 'Post-test' }, post), h('td', { 'data-label': 'Evaluasi' }, evals), h('td', { 'data-label': 'Kompetensi' }, komp, metode),
          h('td', { 'data-label': 'Sertifikat' }, p.sertifikat_nomor ? h('a', { href: '#/kegiatan?sertifikat=' + p.id, text: p.sertifikat_nomor }) : '—')] : null,
        bisaUbah ? h('td', { 'data-label': 'Aksi' }, simpan, tombol([ikon('hapus')], async () => { if (!await konfirmasi('Hapus peserta?', p.nama + ' dihapus dari daftar.', 'Hapus', true)) return; try { await API.hapusBaris('kegiatan_peserta', p.id); P = P.filter(z => z.id !== p.id); gambarPeserta(); } catch (e) { toast(e.message, 'galat'); } }, 'teks kecil', { 'aria-label': 'Hapus ' + p.nama })) : null);
    };
    const tabelP = h('div');
    const gambarPeserta = () => {
      const hadirN = P.filter(p => p.kehadiran === 'hadir').length, pre = P.filter(p => p.nilai_pre != null), post = P.filter(p => p.nilai_post != null);
      const rata = L => L.length ? Math.round(L.reduce((s, p) => s + +p.nilai_pre * 0 + +((p.nilai_post != null && L === post) ? p.nilai_post : p.nilai_pre), 0) / L.length * 10) / 10 : null;
      tabelP.replaceChildren(h('p', { class: 'kecil', text: P.length + ' peserta · hadir ' + hadirN + (P.length ? ' (' + Math.round(hadirN / P.length * 100) + '%)' : '') + (latihan && pre.length ? ' · rata-rata pre-test ' + rata(pre) + ' → post-test ' + (post.length ? rata(post) : '—') : '') }),
        P.length ? h('div', { class: 'tabel-gulir' }, h('table', { class: 'tabel tumpuk tabel-peserta' }, h('thead', {}, h('tr', {}, ['Peserta', 'Kehadiran'].concat(latihan ? ['Pre-test', 'Post-test', 'Evaluasi (1–5)', 'Kompetensi', 'Sertifikat'] : [], bisaUbah ? ['Aksi'] : []).map(t => h('th', { scope: 'col', text: t })))), h('tbody', {}, P.map(barisPeserta)))) : kosong('Belum ada peserta.'));
    };
    gambarPeserta();
    const cariRekan = h('input', { type: 'search', placeholder: 'Cari nama rekan…', 'aria-label': 'Cari rekan' }), hasilRekan = h('div', { class: 'chip-baris' }), namaLuar = h('input', { maxlength: 80, placeholder: 'Atau tulis nama peserta dari luar sistem' });
    let tRekan; cariRekan.addEventListener('input', () => { clearTimeout(tRekan); tRekan = setTimeout(async () => { try { const R = await API.daftarRekan(cariRekan.value, k3() ? null : k.unit_id);
      hasilRekan.replaceChildren(...R.filter(r => !P.some(p => p.profil_id === r.id)).slice(0, 12).map(r => tombol([ikon('tambah'), r.nama], async () => { try { const x = await API.simpanBaris('kegiatan_peserta', { kegiatan_id: id, profil_id: r.id, nama: r.nama }); P.push(x); gambarPeserta(); toast(r.nama + ' ditambahkan & diberi tahu', 'ok'); } catch (e) { toast(e.message, 'galat'); } }, 'chip'))); } catch (e) { toast(e.message, 'galat'); } }, 300); });
    const ubahStatus = async ke => { if (!await konfirmasi(ke === 'selesai' ? 'Tandai kegiatan selesai?' : 'Batalkan kegiatan?', ke === 'selesai' ? 'Pastikan kehadiran sudah dicatat.' : 'Peserta akan diberi tahu.', 'Ya', ke === 'dibatalkan')) return; try { await API.simpanBaris('kegiatan', { id, status: ke }); toast('Status diperbarui', 'ok'); A.jalankan(); } catch (e) { toast(e.message, 'galat'); } };
    const catatan = h('textarea', { rows: 3, maxlength: 4000, disabled: !bisaUbah }); catatan.value = k.catatan || '';
    const isu = h('textarea', { rows: 3, maxlength: 4000, disabled: !bisaUbah, placeholder: 'Temuan/isu keselamatan yang muncul' }); isu.value = k.isu_keselamatan || '';
    const fTindakan = h('input', { maxlength: 1000, placeholder: 'Tindakan perbaikan' }), fTarget = h('input', { type: 'date', min: I.tanggalLokal(), value: I.geserHari(I.tanggalLokal(), 7) });
    let pjSel = h('span'); if (penyelenggara) daftarSupervisor().then(S => { pjSel.replaceWith(pjSel = pilih(S.map(s => [s.id, s.nama]), saya())); }).catch(() => {});
    tampil(halaman(tipeLabel(k.tipe) + ' ' + k.nomor, '/kegiatan', [
      h('section', { class: 'kartu' }, h('div', { class: 'kartu-kepala' }, h('h2', { text: (k.tipe === 'toolbox' ? '◆ ' : '● ') + k.judul }), badge(ST_KEG[k.status][0], ST_KEG[k.status][1])),
        h('p', { class: 'kecil', text: k.nomor + ' · ' + WITA(k.mulai) + ' WITA · ' + k.durasi_menit + ' menit · ' + namaUnit(k.unit_id) + (k.lokasi ? ' · ' + k.lokasi : '') + (k.pemateri ? ' · pemateri ' + k.pemateri : '') }),
        k.tujuan ? h('p', {}, h('strong', { text: 'Tujuan: ' }), k.tujuan) : null, k.topik ? h('p', { class: 'teks-dok', text: k.topik }) : null, k.materi ? h('details', {}, h('summary', { text: 'Materi' }), h('p', { class: 'teks-dok', text: k.materi })) : null,
        bisaUbah ? h('div', { class: 'tombol-baris' }, h('a', { class: 'btn kedua', href: '#/kegiatan?ubah=' + encodeURIComponent(id) }, ikon('pensil'), 'Ubah jadwal'), k.status === 'terjadwal' ? tombol([ikon('qr'), 'Tampilkan QR presensi'], tampilQr, 'kedua') : null,
          k.status === 'terjadwal' ? tombol([ikon('berhasil'), 'Tandai selesai'], () => ubahStatus('selesai'), 'utama') : null, k.status === 'terjadwal' ? tombol([ikon('silang'), 'Batalkan'], () => ubahStatus('dibatalkan'), 'teks') : null) : null, qrWadah),
      h('section', { class: 'kartu' }, h('h2', { text: 'Peserta & ' + (latihan ? 'penilaian' : 'kehadiran') }), latihan ? h('p', { class: 'kecil', text: 'Kompetensi hanya dapat diisi untuk peserta yang hadir, dengan metode asesmen. Sertifikat terbit otomatis untuk peserta kompeten.' }) : null, tabelP,
        bisaUbah ? h('div', { class: 'tambah-peserta' }, cariRekan, hasilRekan, h('div', { class: 'baris-tanya' }, namaLuar, tombol([ikon('tambah'), 'Tambah'], async () => { const n = namaLuar.value.trim(); if (!n) return; try { const x = await API.simpanBaris('kegiatan_peserta', { kegiatan_id: id, nama: n }); P.push(x); namaLuar.value = ''; gambarPeserta(); } catch (e) { toast(e.message, 'galat'); } }, 'kedua'))) : null),
      h('section', { class: 'kartu' }, h('h2', { text: 'Catatan & temuan keselamatan' }), bidang('Catatan kegiatan', catatan), bidang('Isu keselamatan', isu),
        bisaUbah ? h('div', { class: 'tombol-baris' }, tombol([ikon('simpan'), 'Simpan catatan'], async ev => { await sibuk(ev.currentTarget, async () => { await API.simpanBaris('kegiatan', { id, catatan: catatan.value.trim(), isu_keselamatan: isu.value.trim() }); toast('Tersimpan', 'ok'); }).catch(() => {}); }, 'kedua'),
          tombol([ikon('awas'), 'Laporkan isu sebagai bahaya'], () => { if (!isu.value.trim()) return toast('Tulis isu keselamatan dulu', 'galat'); LS.set(A.KUNCI_DRAF, { jenis: 'bahaya', unit_id: k.unit_id, uraian: ('Dari ' + tipeLabel(k.tipe).toLowerCase() + ' ' + k.nomor + ': ' + isu.value.trim()).slice(0, 1000), lokasi: k.lokasi || '', mendesak: false }); pergi('/lapor'); }, 'teks')) : null),
      h('section', { class: 'kartu' }, h('h2', { text: 'Tindakan (CAPA) dari kegiatan ini (' + capa.length + ')' }), capa.length ? A.daftarCapaEl(capa) : h('p', { class: 'kecil', text: 'Belum ada tindakan.' }),
        penyelenggara && k.status !== 'dibatalkan' ? h('div', { class: 'baris-tanya' }, fTindakan, pjSel, fTarget, tombol([ikon('tambah'), 'Buat CAPA'], async ev => {
          if (fTindakan.value.trim().length < 5) return toast('Tulis tindakan (min. 5 huruf)', 'galat');
          await sibuk(ev.currentTarget, async () => { await API.simpanBaris('capa', { sumber: k.tipe === 'toolbox' ? 'toolbox' : 'pelatihan', kegiatan_id: id, unit_id: k.unit_id, akar_masalah: isu.value.trim().slice(0, 1000), tindakan: fTindakan.value.trim(), jenis: 'korektif', level_pengendalian: 'administratif', prioritas: 'sedang', pj_id: pjSel.value || saya(), target_tanggal: fTarget.value }); toast('CAPA dibuat', 'ok'); A.jalankan(); }).catch(() => {});
        }, 'utama')) : null),
      k3() ? A.panelJejak('kegiatan', id) : null], { kembali: true }));
  }
  async function sertifikat(pid) {
    try {
      const p = (await API.halaman('kegiatan_peserta', { filter: [['id', 'eq', pid]], urut: 'id', ukuran: 1 })).baris[0]; if (!p || !p.sertifikat_nomor) throw new Error('Sertifikat tidak ditemukan.');
      const k = await API.ambilSatu('kegiatan', p.kegiatan_id);
      tampil(halaman('Sertifikat', '/kegiatan', [h('article', { class: 'sertifikat-kartu' }, A.kunciMerek('kecil'), h('p', { class: 'kecil', text: A.S.ref.pengaturan.nama_instansi || '' }), h('h2', { text: 'SERTIFIKAT KOMPETENSI' }), h('p', { text: 'diberikan kepada' }), h('h1', { class: 'sert-nama', text: p.nama }),
        h('p', { text: 'yang telah mengikuti dan dinilai KOMPETEN pada pelatihan' }), h('h3', { text: k.judul }), h('p', { class: 'kecil', text: 'Tanggal ' + WITA(k.mulai) + ' · metode asesmen: ' + p.metode_asesmen }),
        h('p', {}, h('strong', { text: 'Nomor: ' + p.sertifikat_nomor })), p.sertifikat_berlaku_sampai ? h('p', { text: 'Berlaku sampai ' + A.tgl(p.sertifikat_berlaku_sampai) }) : null, tombol([ikon('cetak'), 'Cetak'], () => window.print(), 'utama no-print'))], { kembali: true }));
    } catch (e) { galatHalaman('Sertifikat', '/kegiatan', e); }
  }
  async function hHadir() {
    const kode = qs().get('k') || '';
    try { const r = await API.kegiatanHadir(kode); tampil(halaman('Presensi', '/kegiatan', [h('section', { class: 'kartu sukses' }, h('div', { class: 'besar-ikon', 'aria-hidden': 'true' }, ikon('centang')), h('h2', { text: 'Kehadiran tercatat' }), h('p', { text: r.kegiatan + ' (' + r.nomor + ')' }), h('a', { class: 'btn kedua', href: '#/kegiatan?id=' + encodeURIComponent(r.id) }, 'Lihat kegiatan'))])); }
    catch (e) { galatHalaman('Presensi', '/kegiatan', e); }
  }

  // =====================================================================
  // PUSAT NOTIFIKASI (kotak masuk server + pengingat + pengaturan)
  // =====================================================================
  const KAT_NOTIF = { insiden: 'Insiden', investigasi: 'Investigasi', capa: 'CAPA', izin: 'Izin kerja', kegiatan: 'Pelatihan & toolbox', sistem: 'Sistem' };
  const IK_NOTIF = { insiden: 'awas', investigasi: 'cari', capa: 'tugas', izin: 'dokumen', kegiatan: 'kalender', sistem: 'info' };
  A.jumlahNotifServer = async () => { if (API.mode === 'demo') return 0; try { return (await API.halaman('notifikasi', { kolom: 'id', filter: [['dibaca_pada', 'is', null]], ukuran: 1 })).total; } catch (e) { return 0; } };
  async function hNotifikasiPusat() {
    let tab = qs().get('tab') || (API.mode === 'demo' ? 'pengingat' : 'masuk');
    const w = h('div'), tb = h('div');
    const gambar = () => { tb.replaceChildren(A.tab([['masuk', 'Kotak masuk', 'lonceng'], ['pengingat', 'Perlu perhatian', 'awas'], ['atur', 'Pengaturan', 'atur']], tab, t => { tab = t; gambar(); })); ({ masuk: tMasuk, pengingat: tPengingat, atur: tAtur }[tab])(w); };
    tampil(halaman('Notifikasi', '/notifikasi', [tb, w])); gambar();
  }
  function tMasuk(w) {
    const f = { kategori: '', status: 'belum' };
    const ctl = A.daftarServer({ tabel: 'notifikasi', kosong: 'Tidak ada notifikasi.',
      opsi: () => ({ filter: [['kategori', 'eq', f.kategori], f.status === 'belum' ? ['dibaca_pada', 'is', null] : f.status === 'sudah' ? ['dibaca_pada', 'not.is', null] : null].filter(x => x && !(x[1] === 'not.is')), urut: 'dibuat_pada' }),
      render: X => h('div', { class: 'daftar-peringatan', role: 'list' }, X.map(n => { const el = A.peringatan(n.wajib ? 3 : 1, n.judul, (n.isi ? n.isi + ' · ' : '') + KAT_NOTIF[n.kategori] + ' · ' + WITA(n.dibuat_pada), IK_NOTIF[n.kategori], n.tautan || null);
        if (n.dibaca_pada) el.classList.add('dibaca'); el.addEventListener('click', () => { if (!n.dibaca_pada) API.tandaiDibaca([n.id]).catch(() => {}); }); return el; })) });
    w.replaceChildren(h('div', { class: 'kartu filter' }, pilih([['belum', 'Belum dibaca'], ['', 'Semua']], 'belum', { 'aria-label': 'Status baca', onchange: e => { f.status = e.target.value; ctl.ulang(); } }),
      pilih([['', 'Semua kategori']].concat(Object.entries(KAT_NOTIF)), '', { 'aria-label': 'Kategori', onchange: e => { f.kategori = e.target.value; ctl.ulang(); } }),
      tombol([ikon('centang'), 'Tandai semua dibaca'], async ev => { await sibuk(ev.currentTarget, async () => { const n = await API.tandaiDibaca(null); toast(n + ' notifikasi ditandai dibaca', 'ok'); ctl.ulang(); const el = document.querySelector('.lonceng-n'); if (el) { delete el.dataset.diisi; el.hidden = true; } }).catch(() => {}); }, 'kedua')), ctl.el);
    ctl.muat();
  }
  async function tPengingat(w) {
    try { await A.isiPengingat(w); } catch (e) { w.replaceChildren(h('p', { class: 'galat-teks', text: e.message })); }
  }
  async function tAtur(w) {
    let p; try { p = await API.preferensiNotif(); } catch (e) { return w.replaceChildren(h('div', { class: 'kartu bahaya-kotak' }, h('p', { text: e.message }))); }
    const email = h('input', { type: 'checkbox', checked: p.email }), mati = new Set(p.kategori_mati || []);
    const vapid = (window.K3_CONFIG || {}).VAPID_PUBLIC_KEY || '', bisaPush = vapid && 'serviceWorker' in navigator && 'PushManager' in window && location.protocol === 'https:';
    const push = h('input', { type: 'checkbox', checked: p.push, disabled: !bisaPush });
    const ubahPush = async on => {
      if (!on) { try { const reg = await navigator.serviceWorker.ready; const s = await reg.pushManager.getSubscription(); if (s) { await API.hapusLanggananPush(s.endpoint); await s.unsubscribe(); } } catch (e) { /* abaikan */ } return; }
      if (await Notification.requestPermission() !== 'granted') throw new Error('Izin notifikasi ditolak di peramban');
      const reg = await navigator.serviceWorker.ready; const kunci = Uint8Array.from(atob(vapid.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - vapid.length % 4) % 4)), c => c.charCodeAt(0));
      const s = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: kunci }); const j = s.toJSON();
      await API.simpanLanggananPush({ endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth });
    };
    const btn = tombol([ikon('simpan'), 'Simpan pengaturan'], async ev => { await sibuk(ev.currentTarget, async () => {
      if (push.checked !== p.push) await ubahPush(push.checked);
      await API.simpanPreferensiNotif({ email: email.checked, push: push.checked, kategori_mati: [...mati] }); p.push = push.checked; toast('Pengaturan notifikasi tersimpan', 'ok');
    }).catch(() => {}); }, 'utama');
    w.replaceChildren(h('section', { class: 'kartu' }, h('h2', { text: 'Saluran' }), h('label', { class: 'saklar' }, h('input', { type: 'checkbox', checked: true, disabled: true }), h('span', { text: 'Di aplikasi (selalu aktif)' })),
      h('label', { class: 'saklar' }, email, h('span', { text: 'Email ke ' + (A.S.sesi.email || '') })),
      h('label', { class: 'saklar' }, push, h('span', { text: 'Push di perangkat ini' + (bisaPush ? '' : ' — belum tersedia (admin perlu mengatur kunci VAPID, dan aplikasi harus dibuka lewat https)') }))),
      h('section', { class: 'kartu' }, h('h2', { text: 'Kategori' }), h('p', { class: 'kecil', text: 'Notifikasi WAJIB (insiden/kejadian, penugasan, CAPA terlambat, izin ditangguhkan/perlu tinjau) tetap dikirim walaupun kategorinya dimatikan, sesuai kebijakan K3.' }),
        Object.entries(KAT_NOTIF).map(([k, l]) => h('label', { class: 'saklar' }, h('input', { type: 'checkbox', checked: !mati.has(k), onchange: e => { e.target.checked ? mati.delete(k) : mati.add(k); } }), h('span', { text: l })))), btn);
  }

  Object.assign(A.RUTE, { '/izin': hIzin, '/kegiatan': hKegiatan, '/hadir': hHadir, '/notifikasi': hNotifikasiPusat });
})();
