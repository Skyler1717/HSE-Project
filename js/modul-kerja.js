/* modul-kerja.js — JSA, Inspeksi terpandu (dengan suara), dan Pemantauan K3 (lingkungan & kesehatan kerja). */
(function () {
  'use strict';
  const A = window.K3App, I = window.K3Intel, G = window.K3Grafik, AS = window.K3Asisten;
  if (!A || !I || !G || !A.tab) return;
  const { h, ikon, badge, tombol, sibuk, bidang, pilih, toast, tampil, halaman, kosong, pergi, peran, namaUnit, kat, LS, konfirmasi } = A;
  const API = A.API, qs = A.qs, bacakan = A.bacakan;
  const staf = () => ['k3rs', 'pj_unit'].includes(peran());
  const unitSaya = () => A.S.sesi.profil.unit_id;
  const opsiUnit = () => (peran() === 'k3rs' ? A.S.ref.unit.filter(u => u.aktif) : A.S.ref.unit.filter(u => u.id === unitSaya())).map(u => [u.id, u.nama]);
  const opsiShift = [['', '— shift —'], ['pagi', 'Pagi 07–14'], ['siang', 'Siang 14–21'], ['malam', 'Malam 21–07']];
  const angka = (v) => v === '' || v == null ? null : +v;
  const STATUS_JSA = { draf: ['Draf', 'rk-1', '✎'], disetujui: ['Disetujui', 'rk-0', '✓'], selesai: ['Selesai', 'netral', '■'], dibatalkan: ['Dibatalkan', 'rk-x', '✕'] };
  const badgeJsa = s => badge((STATUS_JSA[s] || [s])[2] + ' ' + (STATUS_JSA[s] || [s])[0], (STATUS_JSA[s] || [, 'netral'])[1]);
  const STATUS_PM = { normal: ['✓ Memenuhi', 'rk-0'], melebihi: ['▲ Melebihi ambang', 'rk-3'], kurang: ['▼ Di bawah ambang', 'rk-2'], tidak_ada: ['— Tanpa nilai', 'rk-x'] };
  A.K3Status = s => badge((STATUS_PM[s] || [s])[0], (STATUS_PM[s] || [, 'netral'])[1]);
  function galatModul(e) { return halaman('Modul belum siap', '', [h('div', { class: 'kartu bahaya-kotak' }, h('strong', { text: e.belumSiap ? 'Modul belum diaktifkan' : 'Terjadi kendala' }), h('p', { text: e.message }))], { kembali: true }); }

  // =====================================================================
  // JSA — Job Safety Analysis
  // =====================================================================
  async function hJsa() {
    const q = qs(); let daftar;
    try { daftar = await API.daftarModul('jsa'); } catch (e) { return tampil(galatModul(e)); }
    if (q.get('baru')) return formJsa(null, q.get('pekerjaan') || '');
    if (q.get('id')) { const j = daftar.find(x => x.id === q.get('id')); if (!j) return tampil(halaman('JSA', '/jsa', [kosong('JSA tidak ditemukan atau bukan untuk unit Anda.')], { kembali: true })); return q.get('ubah') ? formJsa(j) : detailJsa(j); }
    let filter = '';
    const isi = h('div', { class: 'daftar' });
    const gambar = () => { const x = daftar.filter(j => !filter || j.status === filter);
      isi.replaceChildren(...(x.length ? x.map(j => { const bh = [...new Set((j.langkah || []).flatMap(s => s.bahaya || []))];
        return h('a', { class: 'kartu laporan jsa-kartu', href: '#/jsa?id=' + encodeURIComponent(j.id) },
          h('div', { class: 'kartu-kepala' }, h('strong', { text: j.pekerjaan }), badgeJsa(j.status)),
          h('div', { class: 'meta kecil', text: j.nomor + ' · ' + namaUnit(j.unit_id) + (j.lokasi ? ' · ' + j.lokasi : '') + ' · ' + A.tgl(j.tanggal) + (j.shift ? ' · shift ' + j.shift : '') + (j.luar_ruangan ? ' · luar ruangan' : '') }),
          h('div', { class: 'baris' }, A.badgeTingkat(j.skor_maks || null), h('span', { class: 'bahaya-ikon' }, bh.slice(0, 5).map(b => h('span', { class: 'chip-ikon', title: (I.BAHAYA[b] || {}).judul }, ikon(A.ikonBahaya[b] || 'awas')))), h('small', { text: (j.langkah || []).length + ' langkah' })));
      }) : [kosong('Belum ada JSA' + (filter ? ' dengan status ini' : '') + '.')]));
    };
    tampil(halaman('Job Safety Analysis (JSA)', '/jsa', [
      h('div', { class: 'tombol-baris antara' }, pilih([['', 'Semua status'], ...Object.entries(STATUS_JSA).map(([k, v]) => [k, v[0]])], '', { 'aria-label': 'Filter status', onchange: e => { filter = e.target.value; gambar(); } }),
        staf() ? h('a', { class: 'btn utama', href: '#/jsa?baru=1' }, ikon('tambah'), 'Buat JSA') : null),
      h('p', { class: 'kecil', text: staf() ? 'JSA dibuat PJ unit/K3RS dan disetujui K3RS. Bahaya dan pengendalian dapat disarankan otomatis, tetapi wajib diperiksa di lapangan.' : 'JSA untuk pekerjaan di unit Anda. Baca sebelum mulai bekerja.' }), isi]));
    gambar();
  }

  function formJsa(lama, pekerjaanAwal) {
    const j = lama ? JSON.parse(JSON.stringify(lama)) : { pekerjaan: pekerjaanAwal || '', unit_id: unitSaya() || '', lokasi: '', tanggal: I.tanggalLokal(), shift: I.shiftSekarang(), luar_ruangan: false, pj_nama: '', target_tanggal: '', status: 'draf', langkah: [] };
    const pekerjaan = h('input', { required: true, maxlength: 160, value: j.pekerjaan, placeholder: 'Contoh: mengganti lampu plafon di lorong lantai 2' });
    const unit = pilih([['', '— pilih unit —'], ...opsiUnit()], j.unit_id, { required: true });
    const lokasi = h('input', { maxlength: 120, value: j.lokasi || '' }), tanggal = h('input', { type: 'date', value: j.tanggal || '', required: true });
    const shift = pilih(opsiShift, j.shift || ''), pj = h('input', { maxlength: 80, value: j.pj_nama || '', placeholder: 'Nama/jabatan penanggung jawab' }), target = h('input', { type: 'date', value: j.target_tanggal || '' });
    const luar = h('input', { type: 'checkbox', checked: !!j.luar_ruangan });
    const wadahLangkah = h('div', { class: 'langkah-jsa' });
    const deteksi = s => I.deteksiBahaya((s.langkah || '') + ' ' + (s.uraian_bahaya || '') + ' ' + pekerjaan.value + (luar.checked ? ' luar ruangan' : '')).map(x => x.id);
    function gambarLangkah() {
      wadahLangkah.replaceChildren(...j.langkah.map((s, i) => {
        s.kontrol = s.kontrol || {}; s.bahaya = s.bahaya || [];
        const kuat = I.URUTAN_KONTROL.find(l => (s.kontrol[l] || '').trim()); const r = I.residual(+s.dampak || 1, +s.kemungkinan || 1, kuat);
        const ubahNilai = (k, v) => { s[k] = v; gambarLangkah(); };
        const inp = (k, ph) => { const e = h('input', { maxlength: 200, value: s[k] || '', placeholder: ph, oninput: ev => { s[k] = ev.target.value; } }); return e; };
        return h('fieldset', { class: 'kartu langkah-kartu' }, h('legend', { text: 'Langkah ' + (i + 1) }),
          bidang('Uraian langkah kerja', inp('langkah', 'Contoh: memasang tangga')),
          h('div', { class: 'baris-saran' }, bidang('Bahaya pada langkah ini', inp('uraian_bahaya', 'Contoh: tangga tergelincir, jatuh')),
            tombol([ikon('otak'), 'Sarankan'], () => { const b = deteksi(s); s.bahaya = b; if (!s.uraian_bahaya && b.length) s.uraian_bahaya = b.map(x => I.BAHAYA[x].skenario[0]).join('; '); if (!s.dampak && b.length) s.dampak = Math.max(...b.map(x => Math.min(5, I.BAHAYA[x].keparahan))); gambarLangkah(); if (!b.length) toast('Tidak ada bahaya yang dikenali dari teks. Isi manual.', 'info'); }, 'kedua kecil')),
          h('div', { class: 'chip-baris' }, Object.keys(I.BAHAYA).map(b => h('button', { type: 'button', class: 'chip' + (s.bahaya.includes(b) ? ' aktif' : ''), 'aria-pressed': String(s.bahaya.includes(b)), onclick: () => { s.bahaya = s.bahaya.includes(b) ? s.bahaya.filter(x => x !== b) : s.bahaya.concat(b); gambarLangkah(); } }, ikon(A.ikonBahaya[b] || 'awas'), I.BAHAYA[b].judul))),
          h('div', { class: 'dua' }, bidang('Dampak (1–5)', pilih([['', '—'], [1, '1 Tidak signifikan'], [2, '2 Minor'], [3, '3 Sedang'], [4, '4 Mayor'], [5, '5 Katastrofik']], s.dampak || '', { onchange: e => ubahNilai('dampak', angka(e.target.value)) })),
            bidang('Kemungkinan (1–5)', pilih([['', '—'], [1, '1 Hampir tidak mungkin'], [2, '2 Jarang'], [3, '3 Mungkin'], [4, '4 Sering'], [5, '5 Hampir pasti']], s.kemungkinan || '', { onchange: e => ubahNilai('kemungkinan', angka(e.target.value)) }))),
          h('div', { class: 'baris' }, h('span', { class: 'kecil', text: 'Risiko awal: ' }), A.badgeTingkat(s.dampak && s.kemungkinan ? s.dampak * s.kemungkinan : null), h('span', { class: 'kecil', text: ' → perkiraan sisa (residual): ' }), A.badgeTingkat(s.dampak && s.kemungkinan ? r.skor : null)),
          bidang('Pengendalian yang sudah ada', inp('kontrol_ada', 'Contoh: tangga lipat, rambu')),
          h('details', { class: 'hirarki-isian', open: s.bahaya.length ? true : null }, h('summary', { text: 'Rencana pengendalian sesuai hierarki' }),
            I.URUTAN_KONTROL.map(l => bidang(I.NAMA_KONTROL[l] + ' — ' + I.KET_KONTROL[l], h('input', { maxlength: 300, value: s.kontrol[l] || '', 'data-level': l, oninput: e => { s.kontrol[l] = e.target.value; } }))),
            tombol([ikon('otak'), 'Isi saran pengendalian'], () => { const b = s.bahaya.length ? s.bahaya : deteksi(s); if (!b.length) return toast('Pilih bahaya dulu', 'galat'); I.URUTAN_KONTROL.forEach(l => { if (!(s.kontrol[l] || '').trim()) s.kontrol[l] = [...new Set(b.flatMap(x => (I.BAHAYA[x].kontrol[l] || []).slice(0, 1)))].join('; '); }); gambarLangkah(); }, 'kedua kecil')),
          h('div', { class: 'tombol-baris' }, i > 0 ? tombol([ikon('kiri'), 'Naik'], () => { [j.langkah[i - 1], j.langkah[i]] = [j.langkah[i], j.langkah[i - 1]]; gambarLangkah(); }, 'teks kecil') : null,
            tombol([ikon('hapus'), 'Hapus langkah'], () => { j.langkah.splice(i, 1); gambarLangkah(); }, 'teks kecil')));
      }), j.langkah.length ? null : h('p', { class: 'kecil', text: 'Belum ada langkah. Tambah manual atau buat langkah awal otomatis.' }));
    }
    gambarLangkah();
    const btnSimpan = h('button', { type: 'submit', class: 'btn utama besar' }, ikon('simpan'), 'Simpan JSA');
    const form = h('form', { class: 'form-jsa', onsubmit: async e => {
      e.preventDefault();
      if (!j.langkah.length) return toast('Tambahkan minimal satu langkah kerja', 'galat');
      if (j.langkah.some(s => !(s.langkah || '').trim())) return toast('Setiap langkah perlu uraian', 'galat');
      const data = { pekerjaan: pekerjaan.value.trim(), unit_id: +unit.value, lokasi: lokasi.value.trim(), tanggal: tanggal.value, shift: shift.value || null, luar_ruangan: luar.checked, pj_nama: pj.value.trim(), target_tanggal: target.value || null,
        langkah: j.langkah.map(s => ({ langkah: (s.langkah || '').trim().slice(0, 200), uraian_bahaya: (s.uraian_bahaya || '').slice(0, 200), bahaya: s.bahaya || [], dampak: angka(s.dampak), kemungkinan: angka(s.kemungkinan), kontrol_ada: (s.kontrol_ada || '').slice(0, 200), kontrol: s.kontrol || {} })) };
      if (lama) { data.id = lama.id; data.status = lama.status === 'disetujui' && peran() !== 'k3rs' ? 'draf' : lama.status; } else data.status = 'draf';
      await sibuk(btnSimpan, async () => { const r = await API.simpanModul('jsa', data); A.resetData && A.resetData(); toast('JSA tersimpan' + (data.status === 'draf' ? ' sebagai draf. Menunggu persetujuan K3RS.' : ''), 'ok'); pergi('/jsa?id=' + encodeURIComponent(r.id || data.id)); }).catch(() => {});
    } },
      h('section', { class: 'kartu' }, h('h2', { text: 'Pekerjaan' }), bidang('Nama pekerjaan', pekerjaan),
        h('div', { class: 'dua' }, bidang('Unit', unit), bidang('Lokasi', lokasi)), h('div', { class: 'dua' }, bidang('Tanggal', tanggal), bidang('Shift', shift)),
        h('div', { class: 'dua' }, bidang('Penanggung jawab', pj), bidang('Target selesai', target)), h('label', { class: 'saklar' }, luar, h('span', { text: 'Pekerjaan di luar ruangan (dipantau peringatan cuaca)' }))),
      h('section', { class: 'kartu' }, h('div', { class: 'kartu-kepala' }, h('h2', { text: 'Langkah kerja, bahaya, dan pengendalian' })),
        h('div', { class: 'tombol-baris' }, tombol([ikon('tambah'), 'Tambah langkah'], () => { j.langkah.push({ langkah: '', bahaya: [], kontrol: {} }); gambarLangkah(); }, 'kedua'),
          tombol([ikon('otak'), 'Buat langkah awal otomatis'], () => {
            const b = I.deteksiBahaya(pekerjaan.value + (luar.checked ? ' luar ruangan' : '')).map(x => x.id);
            const dasar = [['Persiapan: izin kerja, briefing, periksa alat dan APD', ['ketinggian', 'listrik', 'ruang_terbatas', 'kebakaran'].filter(x => b.includes(x))], ['Pelaksanaan: ' + (pekerjaan.value || 'pekerjaan utama'), b], ['Penyelesaian: rapikan area, lepas LOTO/barikade, laporkan', ['licin', 'tertimpa'].filter(x => b.includes(x))]];
            dasar.forEach(([t, bh]) => j.langkah.push({ langkah: t, bahaya: bh, uraian_bahaya: bh.map(x => I.BAHAYA[x].skenario[0]).join('; '), dampak: bh.length ? Math.max(...bh.map(x => I.BAHAYA[x].keparahan)) : null, kemungkinan: bh.length ? 3 : null, kontrol: {} }));
            gambarLangkah(); toast(b.length ? 'Langkah awal dibuat dengan ' + b.length + ' bahaya terdeteksi. Periksa dan sesuaikan.' : 'Langkah awal dibuat. Bahaya belum dikenali, isi manual.', 'info');
          }, 'teks')), wadahLangkah),
      h('div', { class: 'kirim-lekat' }, btnSimpan));
    tampil(halaman(lama ? 'Ubah JSA ' + lama.nomor : 'JSA baru', '/jsa', [form], { kembali: true, sempit: true }));
  }

  function detailJsa(j) {
    const bh = [...new Set((j.langkah || []).flatMap(s => s.bahaya || []))];
    const bolehUbah = peran() === 'k3rs' || (peran() === 'pj_unit' && j.unit_id === unitSaya() && ['draf', 'disetujui'].includes(j.status));
    const ubahStatus = async (st, pesan) => { if (!await konfirmasi(pesan, 'Status JSA ' + j.nomor + ' akan diubah. Perubahan tercatat di log.', 'Ya, lanjutkan')) return; await API.simpanModul('jsa', { id: j.id, status: st }); A.resetData && A.resetData(); toast('Status diperbarui', 'ok'); A.jalankan(); };
    const teksBaca = () => 'Analisis keselamatan kerja: ' + j.pekerjaan + '. ' + (j.langkah || []).map((s, i) => 'Langkah ' + (i + 1) + ': ' + s.langkah + '. Bahaya: ' + (s.uraian_bahaya || '-') + '. Pengendalian: ' + I.URUTAN_KONTROL.map(l => (s.kontrol || {})[l]).filter(Boolean).join('; ')).join('. ');
    tampil(halaman('JSA ' + j.nomor, '/jsa', [
      h('section', { class: 'kartu' }, h('div', { class: 'kartu-kepala' }, h('h2', { text: j.pekerjaan }), badgeJsa(j.status)),
        h('dl', { class: 'rincian' }, h('dt', { text: 'Unit' }), h('dd', { text: namaUnit(j.unit_id) + (j.lokasi ? ' · ' + j.lokasi : '') }), h('dt', { text: 'Tanggal' }), h('dd', { text: A.tgl(j.tanggal) + (j.shift ? ' · shift ' + j.shift : '') + (j.luar_ruangan ? ' · luar ruangan' : '') }),
          h('dt', { text: 'Penanggung jawab' }), h('dd', { text: j.pj_nama || '—' }), h('dt', { text: 'Target' }), h('dd', { text: A.tgl(j.target_tanggal) }), h('dt', { text: 'Risiko tertinggi' }), h('dd', {}, A.badgeTingkat(j.skor_maks || null))),
        h('div', { class: 'tombol-baris' }, bolehUbah ? h('a', { class: 'btn kedua', href: '#/jsa?id=' + encodeURIComponent(j.id) + '&ubah=1' }, ikon('pensil'), 'Ubah') : null,
          peran() === 'k3rs' && j.status === 'draf' ? tombol([ikon('centang'), 'Setujui'], () => ubahStatus('disetujui', 'Setujui JSA ini?'), 'utama') : null,
          staf() && j.status === 'disetujui' && (peran() === 'k3rs' || j.unit_id === unitSaya()) ? tombol([ikon('berhasil'), 'Tandai selesai'], () => ubahStatus('selesai', 'Pekerjaan selesai?'), 'kedua') : null,
          peran() === 'k3rs' && !['dibatalkan', 'selesai'].includes(j.status) ? tombol([ikon('silang'), 'Batalkan'], () => ubahStatus('dibatalkan', 'Batalkan JSA ini?'), 'teks') : null,
          tombol([ikon('suara'), 'Bacakan'], () => bacakan(teksBaca()), 'teks'), tombol([ikon('cetak'), 'Cetak'], () => window.print(), 'teks'))),
      h('section', { class: 'kartu' }, h('h2', { text: 'Langkah kerja' }), h('ol', { class: 'jsa-langkah' }, (j.langkah || []).map(s => h('li', {},
        h('div', { class: 'kartu-kepala' }, h('strong', { text: s.langkah }), A.badgeTingkat(s.dampak && s.kemungkinan ? s.dampak * s.kemungkinan : null)),
        h('p', {}, h('strong', { text: 'Bahaya: ' }), s.uraian_bahaya || '—'), (s.bahaya || []).length ? h('div', { class: 'chip-baris' }, s.bahaya.map(b => h('span', { class: 'chip pasif' }, ikon(A.ikonBahaya[b] || 'awas'), (I.BAHAYA[b] || {}).judul || b))) : null,
        s.kontrol_ada ? h('p', { class: 'kecil' }, h('strong', { text: 'Sudah ada: ' }), s.kontrol_ada) : null,
        h('ul', { class: 'hirarki kompak' }, I.URUTAN_KONTROL.filter(l => (s.kontrol || {})[l]).map(l => h('li', { class: 'lv-' + l }, h('strong', { text: I.NAMA_KONTROL[l] + ': ' }), s.kontrol[l]))),
        s.dampak && s.kemungkinan ? h('p', { class: 'kecil' }, 'Perkiraan risiko sisa setelah pengendalian: ', A.badgeTingkat(I.residual(s.dampak, s.kemungkinan, I.URUTAN_KONTROL.find(l => ((s.kontrol || {})[l] || '').trim())).skor)) : null)))),
      bh.length ? h('section', { class: 'kartu' }, h('h2', { text: 'Kartu keselamatan untuk pekerjaan ini' }), h('div', { class: 'kartu-k3-daftar' }, bh.map((b, i) => A.kartuKeselamatan(b, { buka: i === 0 })))) : null], { kembali: true }));
  }

  // =====================================================================
  // INSPEKSI terpandu (dengan suara opsional)
  // =====================================================================
  async function hInspeksi() {
    const q = qs(); let daftar;
    try { daftar = await API.daftarModul('inspeksi'); } catch (e) { return tampil(galatModul(e)); }
    if (q.get('baru')) return mulaiInspeksi();
    if (q.get('id')) { const x = daftar.find(z => z.id === q.get('id')); return x ? detailInspeksi(x) : tampil(halaman('Inspeksi', '/inspeksi', [kosong('Inspeksi tidak ditemukan.')], { kembali: true })); }
    const rata = daftar.filter(x => x.skor_kepatuhan != null);
    tampil(halaman('Inspeksi K3', '/inspeksi', [
      h('div', { class: 'tombol-baris antara' }, h('span', { class: 'kecil', text: daftar.length + ' inspeksi · kepatuhan rata-rata ' + (rata.length ? Math.round(rata.reduce((s, x) => s + +x.skor_kepatuhan, 0) / rata.length) + '%' : '—') }),
        staf() ? h('a', { class: 'btn utama', href: '#/inspeksi?baru=1' }, ikon('tambah'), 'Mulai inspeksi') : null),
      rata.length > 1 ? h('section', { class: 'kartu' }, h('h2', { text: 'Kepatuhan per daftar periksa' }), G.batang(Object.entries(rata.reduce((o, x) => { (o[x.judul] = o[x.judul] || []).push(+x.skor_kepatuhan); return o; }, {})).map(([k, v]) => ({ label: k, n: Math.round(v.reduce((a, b) => a + b, 0) / v.length), w: v.reduce((a, b) => a + b, 0) / v.length >= 90 ? 'aman' : v.reduce((a, b) => a + b, 0) / v.length >= 75 ? 'waspada' : 'kritis' })), { persen: false })) : null,
      h('div', { class: 'daftar' }, daftar.length ? daftar.map(x => h('a', { class: 'kartu laporan', href: '#/inspeksi?id=' + encodeURIComponent(x.id) },
        h('div', { class: 'kartu-kepala' }, h('strong', { text: x.judul }), badge((x.skor_kepatuhan == null ? '—' : x.skor_kepatuhan) + '% patuh', x.skor_kepatuhan >= 90 ? 'rk-0' : x.skor_kepatuhan >= 75 ? 'rk-1' : 'rk-3')),
        h('div', { class: 'meta kecil', text: x.nomor + ' · ' + namaUnit(x.unit_id) + (x.lokasi ? ' · ' + x.lokasi : '') + ' · ' + A.tgl(x.tanggal) + ' · ' + x.jumlah_temuan + ' temuan' }))) : [kosong('Belum ada inspeksi.')])]));
  }

  function mulaiInspeksi() {
    const unit = pilih([['', '— pilih unit —'], ...opsiUnit()], unitSaya() || '', { required: true }), lokasi = h('input', { maxlength: 120, placeholder: 'Contoh: ruang panel lantai 1' });
    let templat = null;
    const kartu = Object.entries(I.DAFTAR_PERIKSA).map(([id, t]) => h('button', { type: 'button', class: 'kartu templat', role: 'radio', 'aria-checked': 'false', 'data-templat': id, onclick: e => { templat = id; document.querySelectorAll('.templat').forEach(b => { b.classList.toggle('dipilih', b.dataset.templat === id); b.setAttribute('aria-checked', String(b.dataset.templat === id)); }); } },
      G.ilustrasi(t.butir[0][1], { label: t.judul }), h('strong', { text: t.judul }), h('small', { text: t.butir.length + ' butir periksa' })));
    tampil(halaman('Inspeksi baru', '/inspeksi', [
      h('section', { class: 'kartu' }, h('h2', { text: '1. Pilih daftar periksa' }), h('div', { class: 'grid-templat', role: 'radiogroup', 'aria-label': 'Daftar periksa' }, kartu)),
      h('section', { class: 'kartu' }, h('h2', { text: '2. Lokasi' }), h('div', { class: 'dua' }, bidang('Unit', unit), bidang('Lokasi (opsional)', lokasi))),
      h('div', { class: 'tombol-baris' }, tombol([ikon('suara'), 'Mulai mode terpandu'], () => { if (!templat) return toast('Pilih daftar periksa', 'galat'); if (!unit.value) return toast('Pilih unit', 'galat'); terpandu(templat, +unit.value, lokasi.value.trim(), true); }, 'utama besar'),
        tombol([ikon('daftar'), 'Isi sebagai daftar'], () => { if (!templat) return toast('Pilih daftar periksa', 'galat'); if (!unit.value) return toast('Pilih unit', 'galat'); terpandu(templat, +unit.value, lokasi.value.trim(), false); }, 'kedua'))], { kembali: true, sempit: true }));
  }

  function terpandu(id, unitId, lokasi, mode1) {
    const t = I.DAFTAR_PERIKSA[id]; const hasil = t.butir.map(([butir, bh]) => ({ butir, bahaya: bh, nilai: null, catatan: '' }));
    let i = 0;
    const wadah = h('div');
    const jawab = (nilai) => { hasil[i].nilai = nilai; if (nilai !== 'tidak' || hasil[i].catatan) { i++; } gambar(); };
    function gambar() {
      if (!mode1) return gambarDaftar();
      if (i >= hasil.length) return ringkasan();
      const r = hasil[i], b = I.BAHAYA[r.bahaya] || {};
      const catatan = h('input', { maxlength: 200, value: r.catatan, placeholder: 'Apa yang tidak sesuai? (wajib bila tidak sesuai)', oninput: e => { r.catatan = e.target.value; } });
      wadah.replaceChildren(h('section', { class: 'kartu terpandu' },
        h('div', { class: 'progres', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': hasil.length, 'aria-valuenow': i, 'aria-label': 'Kemajuan inspeksi' }, h('span', { style: 'width:' + Math.round(i / hasil.length * 100) + '%' })),
        h('p', { class: 'kecil', text: 'Butir ' + (i + 1) + ' dari ' + hasil.length + ' · ' + t.judul }),
        h('div', { class: 'terpandu-isi' }, G.ilustrasi(r.bahaya, { label: b.judul || '' }), h('h2', { class: 'pertanyaan', text: r.butir })),
        h('div', { class: 'jawab-baris' }, tombol('✓ Sesuai', () => jawab('ya'), 'aman besar'), tombol('✕ Tidak sesuai', () => { r.nilai = 'tidak'; gambar(); setTimeout(() => catatan.focus(), 50); }, 'bahaya besar'), tombol('– Tidak berlaku', () => jawab('na'), 'kedua')),
        r.nilai === 'tidak' ? h('div', { class: 'temuan-isi' }, bidang('Catatan temuan', catatan), h('p', { class: 'kecil', text: 'Saran pengendalian: ' + ((b.kontrol || {}).rekayasa || [])[0] + ' · ' + ((b.kontrol || {}).administratif || [])[0] }), tombol([ikon('kanan'), 'Lanjut'], () => { if (!r.catatan.trim()) return toast('Tulis catatan temuan', 'galat'); i++; gambar(); }, 'utama')) : null,
        h('div', { class: 'tombol-baris' }, i > 0 ? tombol([ikon('kiri'), 'Kembali'], () => { i--; gambar(); }, 'teks') : null, tombol([ikon('suara'), 'Bacakan'], () => bacakan(r.butir + '. Sesuai, atau tidak sesuai?'), 'teks'),
          AS && AS.bisaDengar && AS.bisaDengar() ? tombol([ikon('mik'), 'Jawab dengan suara'], () => AS.dengar(teks => { const a = AS.artiJawabanYa(teks); if (a === 'ya') jawab('ya'); else if (a === 'tidak') { r.nilai = 'tidak'; r.catatan = r.catatan || ''; gambar(); } else toast('Ucapkan "ya" atau "tidak"', 'info'); }, null, m => toast(m, 'galat')), 'teks') : null)));
      if (A.suaraAktif()) bacakan(r.butir);
    }
    function gambarDaftar() {
      wadah.replaceChildren(h('section', { class: 'kartu' }, h('h2', { text: t.judul }), h('ol', { class: 'daftar-periksa' }, hasil.map(r => {
        const grup = 'b' + Math.random().toString(36).slice(2);
        return h('li', {}, h('span', { text: r.butir }), h('div', { class: 'radio-baris', role: 'radiogroup', 'aria-label': r.butir }, [['ya', '✓ Sesuai'], ['tidak', '✕ Tidak'], ['na', '– N/A']].map(([v, l]) => h('label', { class: 'pil' }, h('input', { type: 'radio', name: grup, value: v, checked: r.nilai === v, onchange: () => { r.nilai = v; } }), l))),
          h('input', { maxlength: 200, placeholder: 'Catatan (wajib bila tidak sesuai)', value: r.catatan, oninput: e => { r.catatan = e.target.value; } }));
      })), tombol([ikon('kanan'), 'Lihat ringkasan'], () => { if (hasil.some(r => !r.nilai)) return toast('Masih ada butir yang belum diisi', 'galat'); if (hasil.some(r => r.nilai === 'tidak' && !r.catatan.trim())) return toast('Tulis catatan untuk butir yang tidak sesuai', 'galat'); ringkasan(); }, 'utama')));
    }
    function ringkasan() {
      const dinilai = hasil.filter(r => r.nilai !== 'na'), temuan = hasil.filter(r => r.nilai === 'tidak');
      const skor = dinilai.length ? Math.round(dinilai.filter(r => r.nilai === 'ya').length / dinilai.length * 1000) / 10 : null;
      const catatan = h('textarea', { rows: 2, maxlength: 1000, placeholder: 'Catatan umum (opsional)' });
      const btn = h('button', { type: 'button', class: 'btn utama besar' }, ikon('simpan'), 'Simpan inspeksi');
      btn.addEventListener('click', async () => { await sibuk(btn, async () => { const r = await API.simpanModul('inspeksi', { templat: id, judul: t.judul, unit_id: unitId, lokasi, tanggal: I.tanggalLokal(), shift: I.shiftSekarang(), hasil, catatan: catatan.value.trim() }); A.resetData && A.resetData(); toast('Inspeksi tersimpan', 'ok'); pergi('/inspeksi?id=' + encodeURIComponent(r.id)); }).catch(() => {}); });
      wadah.replaceChildren(h('section', { class: 'kartu' }, h('h2', { text: 'Ringkasan inspeksi' }),
        h('div', { class: 'grid-angka' }, A.ubin('Kepatuhan', skor == null ? '—' : String(skor).replace('.', ',') + '%', dinilai.length + ' butir dinilai', skor != null && skor < 75 ? 'merah' : skor != null && skor < 90 ? 'kuning' : '', 'inspeksi'), A.ubin('Temuan', temuan.length, 'Butir tidak sesuai', temuan.length ? 'kuning' : '', 'awas')),
        temuan.length ? h('div', { class: 'daftar-ringkas' }, temuan.map(r => h('div', { class: 'baris-ringkas' }, h('strong', { text: r.butir }), h('span', { text: r.catatan }))) ) : h('p', { class: 'ok-teks' }, ikon('centang'), ' Semua butir sesuai.'),
        bidang('Catatan', catatan), btn, h('p', { class: 'kecil', text: 'Setelah disimpan, setiap temuan dapat langsung dilaporkan sebagai bahaya agar masuk alur CAPA (penanggung jawab dan target).' })));
      if (A.suaraAktif()) bacakan('Inspeksi selesai. Kepatuhan ' + skor + ' persen, ' + temuan.length + ' temuan.');
    }
    tampil(halaman('Inspeksi: ' + t.judul, '/inspeksi', [wadah], { kembali: true, sempit: true }));
    gambar();
  }

  function laporkanTemuan(x, r) {
    const b = I.BAHAYA[r.bahaya] || {};
    LS.set(A.KUNCI_DRAF, { kategori: b.kategori || null, jenis: 'bahaya', unit_id: x.unit_id, uraian: ('Temuan inspeksi ' + x.nomor + ': ' + r.butir + ' — ' + (r.catatan || '')).slice(0, 1000), lokasi: x.lokasi || '', mendesak: (b.keparahan || 0) >= 5 });
    toast('Formulir lapor sudah terisi dari temuan. Periksa lalu kirim.', 'info'); pergi('/lapor');
  }
  function detailInspeksi(x) {
    const temuan = (x.hasil || []).filter(r => r.nilai === 'tidak');
    tampil(halaman('Inspeksi ' + x.nomor, '/inspeksi', [
      h('section', { class: 'kartu' }, h('div', { class: 'kartu-kepala' }, h('h2', { text: x.judul }), badge((x.skor_kepatuhan == null ? '—' : x.skor_kepatuhan) + '% patuh', x.skor_kepatuhan >= 90 ? 'rk-0' : x.skor_kepatuhan >= 75 ? 'rk-1' : 'rk-3')),
        h('p', { class: 'kecil', text: namaUnit(x.unit_id) + (x.lokasi ? ' · ' + x.lokasi : '') + ' · ' + A.tgl(x.tanggal) + (x.shift ? ' · shift ' + x.shift : '') }), x.catatan ? h('p', { text: x.catatan }) : null,
        h('div', { class: 'tombol-baris' }, tombol([ikon('cetak'), 'Cetak'], () => window.print(), 'teks'))),
      h('section', { class: 'kartu' }, h('h2', { text: 'Temuan (' + temuan.length + ')' }), temuan.length ? h('div', { class: 'daftar' }, temuan.map(r => h('div', { class: 'temuan' },
        h('div', { class: 'kartu-kepala' }, h('strong', { text: r.butir }), badge('✕ Tidak sesuai', 'rk-3')), h('p', { text: r.catatan || '—' }),
        h('p', { class: 'kecil', text: 'Rekomendasi: ' + [((I.BAHAYA[r.bahaya] || {}).kontrol || {}).rekayasa, ((I.BAHAYA[r.bahaya] || {}).kontrol || {}).administratif].map(z => (z || [])[0]).filter(Boolean).join(' · ') }),
        tombol([ikon('awas'), 'Laporkan sebagai bahaya'], () => laporkanTemuan(x, r), 'kedua kecil')))) : h('p', { class: 'ok-teks' }, ikon('centang'), ' Tidak ada temuan.')),
      h('section', { class: 'kartu' }, h('h2', { text: 'Semua butir' }), h('ol', { class: 'daftar-periksa baca' }, (x.hasil || []).map(r => h('li', {}, h('span', { text: r.butir }), badge(r.nilai === 'ya' ? '✓ Sesuai' : r.nilai === 'tidak' ? '✕ Tidak sesuai' : '– N/A', r.nilai === 'ya' ? 'rk-0' : r.nilai === 'tidak' ? 'rk-3' : 'rk-x')))))], { kembali: true }));
  }

  // =====================================================================
  // PEMANTAUAN K3 — lingkungan kerja & kesehatan kerja (agregat)
  // =====================================================================
  async function hPemantauan() {
    let daftar;
    try { daftar = await API.daftarModul('pemantauan'); } catch (e) { return tampil(galatModul(e)); }
    let jenis = qs().get('jenis') === 'kesehatan' && staf() ? 'kesehatan' : 'lingkungan';
    const wadah = h('div'), tabBar = h('div');
    const gambar = () => {
      tabBar.replaceChildren(A.tab([['lingkungan', 'Lingkungan kerja', 'monitor']].concat(staf() ? [['kesehatan', 'Kesehatan kerja', 'virus']] : []), jenis, id => { jenis = id; gambar(); }));
      const x = daftar.filter(m => m.jenis === jenis);
      const ringkas = jenis === 'lingkungan' ? G.batang(I.urutHitung(I.hitung(x.filter(m => ['melebihi', 'kurang'].includes(m.status)), m => (I.PARAMETER[m.parameter] || {}).label || m.parameter)).map(z => ({ label: z.k, n: z.n, w: 'tinggi' })), { persen: false, kosong: 'Tidak ada hasil di luar ambang.' })
        : G.batang(I.urutHitung(x.reduce((o, m) => { o[m.parameter] = (o[m.parameter] || 0) + (+m.jumlah_kasus || 0); return o; }, {})).map(z => ({ label: I.JENIS_KELUHAN[z.k] || z.k, n: z.n })), { kosong: 'Belum ada data.' });
      wadah.replaceChildren(
        staf() ? formPemantauan(jenis, async () => { daftar = await API.daftarModul('pemantauan'); A.resetData && A.resetData(); gambar(); }) : h('p', { class: 'kecil', text: 'Hasil pengukuran lingkungan kerja di unit Anda.' }),
        h('section', { class: 'kartu' }, h('h2', { text: jenis === 'lingkungan' ? 'Hasil di luar ambang' : 'Kasus per jenis keluhan' }), ringkas, jenis === 'kesehatan' ? h('a', { class: 'btn teks kecil', href: '#/intel?tab=tren' }, ikon('grafik'), 'Lihat epidemiologi lengkap') : null),
        h('section', { class: 'kartu' }, h('h2', { text: 'Riwayat (' + x.length + ')' }), x.length ? h('div', { class: 'tabel-gulir' }, h('table', { class: 'tabel tumpuk' },
          h('thead', {}, h('tr', {}, (jenis === 'lingkungan' ? ['Tanggal', 'Unit', 'Parameter', 'Nilai', 'Ambang', 'Status'] : ['Tanggal', 'Unit', 'Keluhan', 'Kasus', 'Diperiksa', 'Angka /100']).map(t => h('th', { scope: 'col', text: t })))),
          h('tbody', {}, x.map(m => h('tr', {}, h('td', { 'data-label': 'Tanggal', text: A.tgl(m.tanggal) }), h('td', { 'data-label': 'Unit', text: namaUnit(m.unit_id) + (m.lokasi ? ' · ' + m.lokasi : '') }),
            ...(jenis === 'lingkungan' ? [h('td', { 'data-label': 'Parameter', text: (I.PARAMETER[m.parameter] || {}).label || m.parameter }), h('td', { 'data-label': 'Nilai', class: 'angka-tab', text: m.nilai == null ? '—' : m.nilai + ' ' + m.satuan }),
              h('td', { 'data-label': 'Ambang', text: [m.ambang_min != null ? '≥ ' + m.ambang_min : null, m.ambang_maks != null ? '≤ ' + m.ambang_maks : null].filter(Boolean).join(' · ') || '—' }), h('td', { 'data-label': 'Status' }, A.K3Status(m.status))]
              : [h('td', { 'data-label': 'Keluhan', text: I.JENIS_KELUHAN[m.parameter] || m.parameter }), h('td', { 'data-label': 'Kasus', class: 'angka-tab', text: String(m.jumlah_kasus || 0) }), h('td', { 'data-label': 'Diperiksa', class: 'angka-tab', text: m.jumlah_diperiksa == null ? '—' : String(m.jumlah_diperiksa) }),
                h('td', { 'data-label': 'Angka /100', class: 'angka-tab', text: m.jumlah_diperiksa ? String(Math.round(m.jumlah_kasus / m.jumlah_diperiksa * 1000) / 10).replace('.', ',') : '—' })])))))) : kosong('Belum ada data.')));
    };
    tampil(halaman('Pemantauan K3', '/pemantauan', [tabBar, wadah]));
    gambar();
  }
  function formPemantauan(jenis, sesudah) {
    const params = jenis === 'lingkungan' ? Object.entries(I.PARAMETER).filter(([k]) => k !== 'keluhan').map(([k, v]) => [k, v.label + ' (' + v.satuan + ')']) : Object.entries(I.JENIS_KELUHAN);
    const param = pilih(params, params[0][0]), unit = pilih([['', '— pilih unit —'], ...opsiUnit()], unitSaya() || '', { required: true }), lokasi = h('input', { maxlength: 120 });
    const tanggal = h('input', { type: 'date', value: I.tanggalLokal(), required: true }), shift = pilih(opsiShift, I.shiftSekarang());
    const nilai = h('input', { type: 'number', step: 'any', inputmode: 'decimal' }), amin = h('input', { type: 'number', step: 'any' }), amaks = h('input', { type: 'number', step: 'any' });
    const kasus = h('input', { type: 'number', min: 0, step: 1, inputmode: 'numeric' }), diperiksa = h('input', { type: 'number', min: 0, step: 1, inputmode: 'numeric' });
    const catatan = h('input', { maxlength: 500 }), ket = h('p', { class: 'kecil' }), status = h('div', { 'aria-live': 'polite' });
    const isiAmbang = () => { const p = I.PARAMETER[param.value]; if (!p) return; amin.value = p.min != null ? p.min : ''; amaks.value = p.maks != null ? p.maks : ''; ket.textContent = 'Rujukan: ' + p.ket + '. Ambang dapat diubah sesuai ketentuan RS.'; perbarui(); };
    const perbarui = () => { if (jenis !== 'lingkungan') return; const s = I.nilaiStatus(param.value, nilai.value, amin.value, amaks.value); status.replaceChildren(nilai.value !== '' ? A.K3Status(s.status) : h('span')); };
    param.addEventListener('change', isiAmbang); [nilai, amin, amaks].forEach(e => e.addEventListener('input', perbarui));
    if (jenis === 'lingkungan') isiAmbang();
    const btn = h('button', { type: 'submit', class: 'btn utama' }, ikon('simpan'), 'Simpan');
    return h('form', { class: 'kartu', onsubmit: async e => {
      e.preventDefault();
      const d = { jenis, parameter: param.value, unit_id: +unit.value, lokasi: lokasi.value.trim(), tanggal: tanggal.value, shift: shift.value || null, catatan: catatan.value.trim() };
      if (jenis === 'lingkungan') { if (nilai.value === '') return toast('Isi nilai pengukuran', 'galat'); Object.assign(d, { nilai: +nilai.value, satuan: I.PARAMETER[param.value].satuan, ambang_min: angka(amin.value), ambang_maks: angka(amaks.value) }); }
      else { if (kasus.value === '') return toast('Isi jumlah kasus (boleh 0)', 'galat'); if (diperiksa.value !== '' && +diperiksa.value < +kasus.value) return toast('Jumlah diperiksa tidak boleh lebih kecil dari jumlah kasus', 'galat'); Object.assign(d, { jumlah_kasus: +kasus.value, jumlah_diperiksa: angka(diperiksa.value), satuan: 'kasus' }); }
      await sibuk(btn, async () => { await API.simpanModul('pemantauan', d); toast('Data tersimpan', 'ok'); nilai.value = kasus.value = diperiksa.value = catatan.value = ''; await sesudah(); }).catch(() => {});
    } }, h('h2', { text: jenis === 'lingkungan' ? 'Catat pengukuran lingkungan' : 'Catat keluhan kesehatan kerja (agregat)' }),
      jenis === 'kesehatan' ? h('p', { class: 'catatan-batas' }, ikon('gembok'), h('span', { text: 'Isi JUMLAH kasus saja. Jangan menulis nama, NIK, atau diagnosis perorangan. Data hanya dapat dilihat K3RS dan PJ unit.' })) : null,
      h('div', { class: 'dua' }, bidang(jenis === 'lingkungan' ? 'Parameter' : 'Jenis keluhan', param), bidang('Unit', unit)), h('div', { class: 'dua' }, bidang('Tanggal', tanggal), bidang('Shift', shift)),
      jenis === 'lingkungan' ? [h('div', { class: 'tiga' }, bidang('Nilai', nilai), bidang('Ambang minimum', amin), bidang('Ambang maksimum', amaks)), ket, status]
        : h('div', { class: 'dua' }, bidang('Jumlah kasus', kasus), bidang('Jumlah pekerja diperiksa', diperiksa)),
      h('div', { class: 'dua' }, bidang('Lokasi (opsional)', lokasi), bidang('Catatan (opsional)', catatan)), btn);
  }

  Object.assign(A.RUTE, { '/jsa': hJsa, '/inspeksi': hInspeksi, '/pemantauan': hPemantauan });
})();
