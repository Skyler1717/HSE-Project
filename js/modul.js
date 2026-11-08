/* modul.js — HSE Intelligence & Pencarian Cerdas.
   Semua data diambil dengan sesi pengguna (RLS Supabase berlaku), lalu dianalisis di perangkat
   dengan aturan K3 dan statistik (js/intel.js). Tidak ada layanan AI berbayar. */
(function () {
  'use strict';
  const A = window.K3App, I = window.K3Intel, G = window.K3Grafik, AS = window.K3Asisten;
  if (!A || !I || !G) return;
  const { h, ikon, badge, tombol, sibuk, bidang, pilih, toast, tampil, halaman, kosong, pergi, peran, namaUnit, kat, LS, JENIS, STATUS, LEVEL } = A;
  const API = A.API;
  const qs = () => new URLSearchParams((location.hash.split('?')[1]) || '');
  const bacakan = t => { if (AS && AS.bacakan) AS.bacakan(t); };
  const suaraAktif = () => LS.get('k3_suara', false);
  const LV = I.URUTAN_KONTROL;
  const NAMA_SHIFT = s => s ? I.SHIFT[s].label + ' (' + I.SHIFT[s].jam + ')' : 'Tidak diketahui';
  const ikonBahaya = { ketinggian: 'tangga', listrik: 'petir', kimia: 'labu', kebakaran: 'api', ledakan: 'awas', tertimpa: 'awas', terjepit: 'awas', panas: 'tetes', bising: 'suara', biologi: 'virus', ergonomi: 'angkat', licin: 'tetes', ruang_terbatas: 'awas', radiasi: 'awas', psikososial: 'pesan', limbah: 'sampah' };

  // ---------- Pemuatan data (per sumber; modul yang belum aktif tidak menggagalkan halaman) ----------
  let cache = null, cacheWaktu = 0;
  async function muatData(paksa) {
    if (cache && !paksa && Date.now() - cacheWaktu < 60000) return cache;
    const d = { laporan: [], tl: [], jsa: [], inspeksi: [], pemantauan: [], belumSiap: false, galat: [] };
    const coba = async (k, f) => { try { d[k] = (await f()) || []; } catch (e) { if (e.belumSiap) d.belumSiap = true; else d.galat.push(k + ': ' + e.message); } };
    const staf = ['k3rs', 'pj_unit'].includes(peran());
    await Promise.all([
      coba('laporan', async () => staf ? A.ambilLaporan(true) : (await Promise.all((await API.laporanSaya()).map(async id => (await API.detailLaporan(id)).laporan))).filter(Boolean)),
      staf ? coba('tl', () => API.semuaTindakLanjut()) : null,
      coba('jsa', () => API.daftarModul('jsa')), coba('inspeksi', () => API.daftarModul('inspeksi')), coba('pemantauan', () => API.daftarModul('pemantauan'))]);
    cache = d; cacheWaktu = Date.now(); return d;
  }
  A.muatData = muatData; A.resetData = () => { cache = null; };
  const bannerBelumSiap = d => d.belumSiap ? h('p', { class: 'catatan-batas' }, ikon('info'), h('span', { text: 'Sebagian modul (JSA, inspeksi, pemantauan, SOP) belum aktif di basis data. Admin perlu menjalankan supabase/20_modul_hse.sql. Analisis di bawah memakai data yang tersedia.' })) : null;
  const terbuka = l => ['baru', 'ditugaskan', 'dalam_tindak_lanjut'].includes(l.status);
  const terlambat = l => l.target_tanggal && l.target_tanggal < I.tanggalLokal() && ['ditugaskan', 'dalam_tindak_lanjut'].includes(l.status);
  const dalamHari = (tg, n) => tg && tg >= I.geserHari(I.tanggalLokal(), -(n - 1));
  const bahayaLaporan = l => { const t = I.deteksiBahaya((l.uraian || '') + ' ' + (l.lokasi || '')); return t.length ? t[0].id : I.BAHAYA_KATEGORI[l.kategori_kode] || null; };

  function tab(daftar, aktif, onPilih) {
    return h('div', { class: 'tab-baris', role: 'tablist' }, daftar.map(([id, label, ik]) => h('button', { type: 'button', role: 'tab', class: 'tab' + (id === aktif ? ' aktif' : ''), 'aria-selected': String(id === aktif), onclick: () => onPilih(id) }, ikon(ik), h('span', { text: label }))));
  }
  function ubin(label, nilai, ket, kls, ik, href) {
    return h(href ? 'a' : 'div', { class: 'angka ' + (kls || ''), href: href || null, title: ket || null }, h('span', { class: 'ikon-kotak ' + (kls === 'merah' ? 'merah' : kls === 'kuning' ? 'kuning' : '') }, ikon(ik || 'grafik')),
      h('span', { class: 'n', text: String(nilai) }), h('span', { class: 'lbl', text: label }), ket ? h('small', { class: 'ket-ubin', text: ket }) : null);
  }
  function peringatan(tingkat, judul, isi, ik, href) {
    const nama = ['Info', 'Perhatian', 'Waspada', 'Bahaya', 'Kritis'][tingkat] || 'Info';
    return h(href ? 'a' : 'div', { class: 'peringatan-dini lv-' + Math.min(3, tingkat), href: href || null, role: 'listitem' },
      h('span', { class: 'pd-ikon', 'aria-hidden': 'true' }, ikon(ik || 'awas')), h('span', { class: 'pd-isi' }, h('span', { class: 'pd-tingkat', text: ['ℹ', '●', '▲', '◆', '✕'][tingkat] + ' ' + nama }), h('strong', { text: judul }), isi ? h('small', { text: isi }) : null),
      href ? ikon('kanan') : null);
  }

  // ---------- Cuaca (Open-Meteo, gratis tanpa kunci; cache 30 menit) ----------
  async function ambilCuaca(paksa) {
    const p = A.S.ref.pengaturan, lat = p.lintang != null ? p.lintang : 1.4748, lon = p.bujur != null ? p.bujur : 124.8421;
    const simpanan = LS.get('k3_cuaca', null);
    if (!paksa && simpanan && simpanan.lat === lat && simpanan.lon === lon && Date.now() - simpanan.waktu < 30 * 60000) return simpanan.data;
    const r = await fetch(I.urlCuaca(lat, lon, p.zona_waktu || 'Asia/Makassar'), { referrerPolicy: 'no-referrer' });
    if (!r.ok) throw new Error('Layanan cuaca tidak merespons (' + r.status + ')');
    const j = await r.json(); LS.set('k3_cuaca', { lat, lon, waktu: Date.now(), data: j }); return j;
  }
  function ringkasCuaca(j) {
    const c = j.current || {}, hr = j.hourly || {}; const now = (c.time || '').slice(0, 13);
    let i0 = (hr.time || []).findIndex(t => t.slice(0, 13) >= now); if (i0 < 0) i0 = 0;
    const rentang = (k, n) => (hr[k] || []).slice(i0, i0 + n);
    const kode6 = rentang('weather_code', 6), embus6 = rentang('wind_gusts_10m', 6), hujan6 = rentang('precipitation', 6), pel6 = rentang('precipitation_probability', 6), suhu6 = rentang('apparent_temperature', 6);
    return {
      kini: { kode: c.weather_code, suhu: c.temperature_2m, terasa: c.apparent_temperature, rh: c.relative_humidity_2m, hujan: c.precipitation, angin: c.wind_speed_10m, embusan: c.wind_gusts_10m },
      gabungan: { kode: Math.max(c.weather_code || 0, ...kode6.filter(k => [95, 96, 99].includes(k))), suhu: Math.max(c.temperature_2m || 0, ...rentang('temperature_2m', 6)), rh: c.relative_humidity_2m,
        hujan: Math.max(c.precipitation || 0, ...hujan6), embusan: Math.max(c.wind_gusts_10m || 0, ...embus6), peluangHujan: Math.max(0, ...pel6), petirJamDepan: kode6.some(k => [95, 96, 99].includes(k)), terasaMaks: Math.max(...suhu6, c.apparent_temperature || 0) },
      jam: rentang('time', 12).map(t => t.slice(11, 16)), pel12: rentang('precipitation_probability', 12), suhu12: rentang('temperature_2m', 12), embus12: rentang('wind_gusts_10m', 12)
    };
  }

  // =====================================================================
  // HSE INTELLIGENCE
  // =====================================================================
  async function hIntel() {
    const d = await muatData();
    let aktif = qs().get('tab') || 'ringkas';
    const wadah = h('div', { class: 'intel-isi' });
    const tabs = [['ringkas', 'Peringatan & shift', 'lonceng'], ['risiko', 'Peta risiko', 'kisi'], ['tren', 'Tren & epidemiologi', 'grafik'], ['cuaca', 'Cuaca', 'awan'], ['kartu', 'Kartu & hierarki', 'piramida']];
    const tabBar = h('div');
    const gambar = () => {
      tabBar.replaceChildren(tab(tabs, aktif, id => { aktif = id; history.replaceState(null, '', '#/intel?tab=' + id); gambar(); }));
      wadah.replaceChildren(h('p', { class: 'kecil memuat-kecil', text: 'Menganalisis…' }));
      ({ ringkas: tRingkas, risiko: tRisiko, tren: tTren, cuaca: tCuaca, kartu: tKartu }[aktif] || tRingkas)(d, wadah);
    };
    tampil(halaman('HSE Intelligence', '/intel', [
      h('div', { class: 'intel-kepala' }, h('p', { class: 'kecil', text: 'Analisis otomatis dari data yang boleh Anda lihat · diperbarui ' + I.formatWaktu(new Date()) + ' WITA' }),
        tombol([ikon('muat'), 'Muat ulang'], async ev => { await sibuk(ev.currentTarget, async () => { const baru = await muatData(true); Object.assign(d, baru); gambar(); }).catch(() => {}); }, 'teks')),
      bannerBelumSiap(d), tabBar, wadah]));
    gambar();
    API.catatRiwayat && API.catatRiwayat({ kategori: 'analisis', kueri: 'Membuka HSE Intelligence', ringkasan: d.laporan.length + ' laporan, ' + d.jsa.length + ' JSA, ' + d.inspeksi.length + ' inspeksi dianalisis', jumlah_hasil: d.laporan.length }).catch(() => {});
  }

  // ---------- Tab 1: Peringatan dini, indikator kinerja, serah terima shift ----------
  function tRingkas(d, w) {
    const L = d.laporan, kini = I.tanggalLokal();
    const L30 = L.filter(l => dalamHari(l.tanggal_lapor, 30));
    const kejadian30 = L30.filter(l => l.jenis === 'kejadian').length, nyaris30 = L30.filter(l => l.jenis === 'nyaris_celaka').length;
    const tl = d.tl || [], efektif = tl.filter(t => ['eliminasi', 'substitusi', 'rekayasa'].includes(t.level_pengendalian)).length;
    const ins90 = d.inspeksi.filter(x => dalamHari(x.tanggal, 90) && x.skor_kepatuhan != null);
    const kepatuhan = ins90.length ? Math.round(ins90.reduce((s, x) => s + +x.skor_kepatuhan, 0) / ins90.length) : null;
    const pm30 = d.pemantauan.filter(x => dalamHari(x.tanggal, 30) && ['melebihi', 'kurang'].includes(x.status));
    const kpi = h('div', { class: 'grid-angka spi' },
      ubin('Laporan 30 hari', L30.length, 'Semua jenis laporan yang dapat Anda lihat', '', 'dokumen'),
      ubin('Kejadian / cedera 30 hari', kejadian30, 'Laporan jenis kejadian', kejadian30 ? 'merah' : '', 'awas'),
      ubin('Rasio nyaris celaka : kejadian', kejadian30 ? (Math.round(nyaris30 / kejadian30 * 10) / 10) + ' : 1' : nyaris30 + ' : 0', 'Semakin banyak nyaris celaka dilaporkan, semakin baik budaya lapor', '', 'tanda'),
      ubin('CAPA terlambat', L.filter(terlambat).length, 'Melewati tanggal target', L.filter(terlambat).length ? 'kuning' : '', 'jam', '#/tugas'),
      ubin('Pengendalian efektif', tl.length ? Math.round(efektif / tl.length * 100) + '%' : '—', 'Tindakan tingkat eliminasi/substitusi/rekayasa', '', 'piramida'),
      ubin('Kepatuhan inspeksi 90 hari', kepatuhan == null ? '—' : kepatuhan + '%', ins90.length + ' inspeksi', kepatuhan != null && kepatuhan < 80 ? 'kuning' : '', 'inspeksi', '#/inspeksi'),
      ubin('Pemantauan di luar ambang', pm30.length, '30 hari terakhir', pm30.length ? 'kuning' : '', 'monitor', '#/pemantauan'));

    // Peringatan dini
    const P = [];
    const lonjakUnit = I.deteksiLonjakan(L, l => l.unit_id, l => l.tanggal_lapor);
    lonjakUnit.forEach(x => P.push([3, 'Lonjakan laporan di ' + namaUnit(x.k), x.baru + ' laporan dalam 30 hari; biasanya ±' + x.harapan + ' (peluang kebetulan ' + (x.p < .001 ? '<0,1' : (x.p * 100).toFixed(1).replace('.', ',')) + '%)', 'grafik', '#/semua']));
    I.deteksiLonjakan(L, l => l.kategori_kode, l => l.tanggal_lapor).forEach(x => P.push([2, 'Bahaya ' + kat(x.k).nama + ' meningkat', x.baru + ' laporan dalam 30 hari vs ±' + x.harapan + ' biasanya', 'grafik', null]));
    const mendesak = L.filter(l => l.mendesak && terbuka(l)); if (mendesak.length) P.push([3, mendesak.length + ' laporan mendesak belum selesai', mendesak.slice(0, 3).map(l => l.nomor).join(', '), 'awas', '#/semua?mendesak=1']);
    const telat = L.filter(terlambat); if (telat.length) P.push([2, telat.length + ' CAPA melewati target', 'Tertua: ' + telat.map(l => l.target_tanggal).sort()[0], 'jam', '#/tugas']);
    const tinggiTerbuka = L.filter(l => terbuka(l) && A.levelRisiko(l.skor) >= 3); if (tinggiTerbuka.length) P.push([3, tinggiTerbuka.length + ' risiko tingkat tertinggi masih terbuka', 'Sesuai pita risiko di Pengaturan (dampak × kemungkinan)', 'awas', null]);
    pm30.forEach(m => P.push([2, (I.PARAMETER[m.parameter] || { label: m.parameter }).label + ' ' + (m.status === 'melebihi' ? 'melebihi' : 'di bawah') + ' ambang di ' + namaUnit(m.unit_id), m.nilai + ' ' + m.satuan + ' (ambang ' + (m.status === 'melebihi' ? m.ambang_maks : m.ambang_min) + ')', 'monitor', '#/pemantauan']));
    d.jsa.filter(j => j.status === 'draf' && A.levelRisiko(j.skor_maks) >= 2).forEach(j => P.push([2, 'JSA risiko tinggi belum disetujui', j.nomor + ' · ' + j.pekerjaan, 'jsa', '#/jsa?id=' + encodeURIComponent(j.id)]));
    const temuanBaru = d.inspeksi.filter(x => dalamHari(x.tanggal, 14) && x.jumlah_temuan > 0); if (temuanBaru.length) P.push([1, temuanBaru.reduce((s, x) => s + x.jumlah_temuan, 0) + ' temuan inspeksi 14 hari terakhir', 'Pastikan setiap temuan ditindaklanjuti', 'inspeksi', '#/inspeksi']);
    const cu = LS.get('k3_cuaca', null);
    if (cu && Date.now() - cu.waktu < 3 * 3600e3) I.risikoCuaca(ringkasCuaca(cu.data).gabungan).forEach(x => P.push([x.tingkat, 'Cuaca: ' + x.judul, x.saran[0], 'awan', '#/intel?tab=cuaca']));
    P.sort((a, b) => b[0] - a[0]);

    // Serah terima shift
    const shift = I.shiftSekarang(), batas = Date.now() - 12 * 3600e3;
    const baru12 = L.filter(l => !l.anonim && new Date(l.dibuat_pada).getTime() >= batas);
    const anonHariIni = L.filter(l => l.anonim && l.tanggal_lapor === kini).length;
    const jsaHariIni = d.jsa.filter(j => j.tanggal === kini && j.status !== 'dibatalkan');
    const jatuhTempo = L.filter(l => l.target_tanggal === kini && terbuka(l));
    const teksSerah = () => ['SERAH TERIMA SHIFT ' + I.SHIFT[shift].label.toUpperCase() + ' — ' + I.formatWaktu(new Date()) + ' WITA',
      '• Laporan baru 12 jam terakhir: ' + baru12.length + (anonHariIni ? ' (+' + anonHariIni + ' anonim hari ini)' : ''),
      ...baru12.slice(0, 8).map(l => '   - ' + l.nomor + ' ' + (JENIS[l.jenis] || l.jenis).split(' /')[0] + ', ' + kat(l.kategori_kode).nama + ', ' + namaUnit(l.unit_id) + (l.mendesak ? ' [MENDESAK]' : '')),
      '• Mendesak belum selesai: ' + mendesak.length, '• CAPA jatuh tempo hari ini: ' + jatuhTempo.length + '; terlambat: ' + telat.length,
      '• Pekerjaan ber-JSA hari ini: ' + (jsaHariIni.map(j => j.pekerjaan + ' (' + namaUnit(j.unit_id) + ')').join('; ') || '-'),
      '• Peringatan aktif: ' + (P.slice(0, 5).map(p => p[1]).join('; ') || '-')].join('\n');
    const serah = h('section', { class: 'kartu serah' }, h('div', { class: 'kartu-kepala' }, h('h2', {}, ikon('serah'), ' Serah terima shift'), badge('Shift ' + NAMA_SHIFT(shift), 'netral')),
      h('ul', { class: 'serah-daftar' },
        h('li', {}, h('strong', { text: String(baru12.length) }), ' laporan baru dalam 12 jam', anonHariIni ? h('small', { text: ' (+' + anonHariIni + ' anonim; jam tidak dicatat demi privasi)' }) : null),
        h('li', {}, h('strong', { text: String(mendesak.length) }), ' mendesak belum selesai'),
        h('li', {}, h('strong', { text: String(jatuhTempo.length) }), ' CAPA jatuh tempo hari ini · ', h('strong', { text: String(telat.length) }), ' terlambat'),
        h('li', {}, h('strong', { text: String(jsaHariIni.length) }), ' pekerjaan ber-JSA hari ini')),
      baru12.length ? h('div', { class: 'daftar-ringkas' }, baru12.slice(0, 6).map(l => h('a', { class: 'baris-ringkas', href: '#/laporan/' + encodeURIComponent(l.id) },
        h('span', { class: 'angka-tab', text: new Date(l.dibuat_pada).toLocaleTimeString('id-ID', { timeZone: 'Asia/Makassar', hour: '2-digit', minute: '2-digit' }) }), h('span', { text: kat(l.kategori_kode).nama + ' · ' + namaUnit(l.unit_id) }), l.mendesak ? badge('Mendesak', 'rk-3') : null))) : null,
      h('div', { class: 'tombol-baris' }, tombol([ikon('salin'), 'Salin ringkasan'], async () => { try { await navigator.clipboard.writeText(teksSerah()); toast('Ringkasan serah terima disalin', 'ok'); } catch (e) { toast('Tidak dapat menyalin otomatis', 'galat'); } }, 'kedua kecil'),
        tombol([ikon('suara'), 'Bacakan'], () => bacakan(teksSerah().replace(/•|-/g, '')), 'teks kecil')));
    w.replaceChildren(kpi,
      h('div', { class: 'intel-grid' },
        h('section', { class: 'kartu' }, h('div', { class: 'kartu-kepala' }, h('h2', {}, ikon('lonceng'), ' Peringatan dini'), badge(P.length + ' aktif', P.length ? 'rk-2' : 'rk-0')),
          P.length ? h('div', { class: 'daftar-peringatan', role: 'list' }, P.slice(0, 12).map(p => peringatan(...p))) : h('p', { class: 'ok-teks' }, ikon('centang'), ' Tidak ada peringatan saat ini.'),
          h('p', { class: 'kecil', text: 'Lonjakan dihitung dengan membandingkan 30 hari terakhir terhadap rata-rata 90 hari sebelumnya (uji Poisson, p < 0,05, minimal 3 laporan). Lonjakan bisa juga berarti budaya lapor membaik.' })),
        serah));
    if (suaraAktif() && P.length) bacakan('Ada ' + P.length + ' peringatan. ' + P.slice(0, 2).map(p => p[1]).join('. '));
  }

  // ---------- Tab 2: Peta risiko ----------
  function tRisiko(d, w) {
    let sumber = 'laporan';
    const daftar = h('div', { class: 'daftar-pilih', 'aria-live': 'polite' });
    const tampilkanDaftar = (judul, item) => daftar.replaceChildren(h('h3', { text: judul + ' (' + item.length + ')' }), item.length ? h('div', { class: 'daftar-ringkas' }, item.slice(0, 50).map(x => x.el)) : kosong('Tidak ada data.'));
    const isiL = l => ({ el: h('a', { class: 'baris-ringkas', href: '#/laporan/' + encodeURIComponent(l.id) }, h('strong', { text: l.nomor }), h('span', { text: kat(l.kategori_kode).nama + ' · ' + namaUnit(l.unit_id) + ' · ' + (l.uraian || '').slice(0, 60) }), A.badgeTingkat(l.skor)) });
    const langkahJsa = d.jsa.flatMap(j => (j.langkah || []).map((s, i) => ({ j, s, i, d: +s.dampak || null, k: +s.kemungkinan || null })));
    const isiJ = x => ({ el: h('a', { class: 'baris-ringkas', href: '#/jsa?id=' + encodeURIComponent(x.j.id) }, h('strong', { text: x.j.nomor }), h('span', { text: x.j.pekerjaan + ' — ' + (x.s.langkah || '') }), A.badgeTingkat(x.d && x.k ? x.d * x.k : null)) });
    const wadahMatriks = h('div');
    const gambarMatriks = () => {
      const jml = {};
      if (sumber === 'laporan') d.laporan.filter(l => l.dampak && l.kemungkinan).forEach(l => { jml[l.dampak] = jml[l.dampak] || {}; jml[l.dampak][l.kemungkinan] = (jml[l.dampak][l.kemungkinan] || 0) + 1; });
      else langkahJsa.filter(x => x.d && x.k).forEach(x => { jml[x.d] = jml[x.d] || {}; jml[x.d][x.k] = (jml[x.d][x.k] || 0) + 1; });
      const pita = (A.S.ref.pengaturan.pita_risiko || []).slice().sort((a, b) => a.maks - b.maks);
      wadahMatriks.replaceChildren(G.matriks(jml, { level: s => Math.min(3, Math.max(0, pita.findIndex(p => s <= p.maks))), namaLevel: pita.map(p => p.label),
        onKlik: (dd, kk) => sumber === 'laporan' ? tampilkanDaftar('Dampak ' + dd + ' × kemungkinan ' + kk, d.laporan.filter(l => l.dampak === dd && l.kemungkinan === kk).map(isiL))
          : tampilkanDaftar('Langkah JSA dampak ' + dd + ' × kemungkinan ' + kk, langkahJsa.filter(x => x.d === dd && x.k === kk).map(isiJ)) }));
    };
    const pilihSumber = pilih([['laporan', 'Laporan (risk register)'], ['jsa', 'Langkah JSA']], sumber, { 'aria-label': 'Sumber matriks', onchange: e => { sumber = e.target.value; gambarMatriks(); daftar.replaceChildren(); } });
    gambarMatriks();
    // Heatmap unit × kategori
    const unitAda = [...new Set(d.laporan.map(l => l.unit_id))].sort((a, b) => namaUnit(a).localeCompare(namaUnit(b)));
    const katAda = A.S.ref.kategori.filter(k => d.laporan.some(l => l.kategori_kode === k.kode));
    const nilai = unitAda.map(u => katAda.map(k => d.laporan.filter(l => l.unit_id === u && l.kategori_kode === k.kode).length));
    const hm = G.heatmap(unitAda.map(u => ({ label: namaUnit(u) })), katAda.map(k => ({ label: k.nama.split(' /')[0], ikon: A.ikonKat(k.kode), ket: k.nama })), nilai,
      { judul: 'Jumlah laporan per unit dan jenis bahaya', sudut: 'Unit \\ Bahaya', onKlik: (i, j) => tampilkanDaftar(namaUnit(unitAda[i]) + ' · ' + katAda[j].nama, d.laporan.filter(l => l.unit_id === unitAda[i] && l.kategori_kode === katAda[j].kode).map(isiL)) });
    // Ranking pekerjaan berisiko tinggi (JSA)
    const rank = d.jsa.map(j => ({ j, skor: j.skor_maks || 0, bahaya: [...new Set((j.langkah || []).flatMap(s => s.bahaya || []).concat(I.deteksiBahaya(j.pekerjaan).map(b => b.id)))] })).sort((a, b) => b.skor - a.skor).slice(0, 10);
    // Lokasi dengan hazard terbanyak
    const lokasi = I.urutHitung(I.hitung(d.laporan, l => (namaUnit(l.unit_id) + (l.lokasi ? ' — ' + l.lokasi : '')))).slice(0, 10);
    // Tren skor risiko bulanan
    const bulan = I.deretBulan(6), skorBulan = bulan.map(b => { const x = d.laporan.filter(l => (l.tanggal_lapor || '').startsWith(b) && l.skor); return x.length ? Math.round(x.reduce((s, l) => s + l.skor, 0) / x.length * 10) / 10 : 0; });
    const tinggiBulan = bulan.map(b => d.laporan.filter(l => (l.tanggal_lapor || '').startsWith(b) && A.levelRisiko(l.skor) >= 2).length);
    w.replaceChildren(
      h('div', { class: 'intel-grid' },
        h('section', { class: 'kartu' }, h('h2', { text: 'Matriks risiko 5 × 5' }), bidang('Sumber data', pilihSumber), h('p', { class: 'kecil', text: 'Ketuk sel untuk melihat catatan di dalamnya. Simbol ○ △ ◇ ✕ membedakan tingkat tanpa bergantung warna.' }), wadahMatriks, daftar),
        h('section', { class: 'kartu' }, h('h2', { text: 'Pekerjaan berisiko tertinggi (JSA)' }), rank.length ? h('ol', { class: 'ranking' }, rank.map(x => h('li', {}, h('a', { href: '#/jsa?id=' + encodeURIComponent(x.j.id) }, h('strong', { text: x.j.pekerjaan }), h('small', { text: namaUnit(x.j.unit_id) + ' · ' + (x.j.lokasi || '') })),
          h('span', { class: 'bahaya-ikon' }, x.bahaya.slice(0, 4).map(b => h('span', { class: 'chip-ikon', title: (I.BAHAYA[b] || {}).judul }, ikon(ikonBahaya[b] || 'awas')))), A.badgeTingkat(x.skor || null)))) : kosong('Belum ada JSA. Buat JSA untuk pekerjaan berisiko.'))),
      h('section', { class: 'kartu' }, h('h2', { text: 'Peta hazard: unit × jenis bahaya' }), h('p', { class: 'kecil', text: 'Angka = jumlah laporan. Semakin gelap semakin banyak. Ketuk angka untuk melihat laporannya.' }), unitAda.length ? hm : kosong('Belum ada laporan.')),
      h('div', { class: 'intel-grid' },
        h('section', { class: 'kartu' }, h('h2', { text: 'Lokasi dengan laporan terbanyak' }), G.batang(lokasi.map(x => ({ label: x.k, n: x.n, w: 'navy' })), { persen: false })),
        h('section', { class: 'kartu' }, h('h2', { text: 'Tren risiko 6 bulan' }), G.garis(bulan.map(b => b.slice(5) + '/' + b.slice(2, 4)), [{ nama: 'Rata-rata skor', data: skorBulan, w: 'waspada' }, { nama: 'Risiko tinggi+', data: tinggiBulan, w: 'kritis' }], { judul: 'Tren skor risiko bulanan' }))));
  }

  // ---------- Tab 3: Tren & epidemiologi ----------
  function tTren(d, w) {
    const L = d.laporan, bulan = I.deretBulan(6), lbl = bulan.map(b => b.slice(5) + '/' + b.slice(2, 4));
    const seri = ['bahaya', 'nyaris_celaka', 'kejadian'].map((j, i) => ({ nama: ['Bahaya', 'Nyaris celaka', 'Kejadian'][i], w: ['info', 'waspada', 'kritis'][i], data: bulan.map(b => L.filter(l => l.jenis === j && (l.tanggal_lapor || '').startsWith(b)).length) }));
    const berjam = L.filter(l => !l.anonim && l.dibuat_pada), anon = L.length - berjam.length;
    const perJam = Array.from({ length: 24 }, (_, j) => berjam.filter(l => I.bagianWaktu(l.dibuat_pada).jam === j).length);
    const perShift = ['pagi', 'siang', 'malam'].map(s => ({ label: NAMA_SHIFT(s), n: berjam.filter(l => I.shiftLaporan(l) === s).length, w: ['info', 'waspada', 'navy'][['pagi', 'siang', 'malam'].indexOf(s)] }));
    const hariNama = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
    const perHari = hariNama.map((_, i) => L.filter(l => l.tanggal_lapor && new Date(l.tanggal_lapor + 'T12:00:00Z').getUTCDay() === (i + 1) % 7).length);
    const perKat = I.urutHitung(I.hitung(L, l => l.kategori_kode)).map(x => ({ label: kat(x.k).nama, n: x.n }));
    // Epidemiologi kesehatan kerja (agregat)
    const K = d.pemantauan.filter(m => m.jenis === 'kesehatan');
    const perKeluhan = I.urutHitung(K.reduce((o, m) => { o[m.parameter] = (o[m.parameter] || 0) + (+m.jumlah_kasus || 0); return o; }, {})).map(x => ({ label: I.JENIS_KELUHAN[x.k] || x.k, n: x.n }));
    const unitK = [...new Set(K.map(m => m.unit_id))];
    const angkaUnit = unitK.map(u => { const x = K.filter(m => m.unit_id === u), kasus = x.reduce((s, m) => s + (+m.jumlah_kasus || 0), 0), diperiksa = x.reduce((s, m) => s + (+m.jumlah_diperiksa || 0), 0); return { label: namaUnit(u), n: diperiksa ? Math.round(kasus / diperiksa * 1000) / 10 : 0, kasus, diperiksa }; }).sort((a, b) => b.n - a.n);
    const klaster = [];
    unitK.forEach(u => Object.keys(I.JENIS_KELUHAN).forEach(p => {
      const x = K.filter(m => m.unit_id === u && m.parameter === p); if (!x.length) return;
      const baru = x.filter(m => dalamHari(m.tanggal, 30)).reduce((s, m) => s + (+m.jumlah_kasus || 0), 0), dasar = x.filter(m => !dalamHari(m.tanggal, 30) && dalamHari(m.tanggal, 120)).reduce((s, m) => s + (+m.jumlah_kasus || 0), 0) / 3;
      const pv = I.poissonAtas(baru, Math.max(dasar, .5)); if (baru >= 3 && pv < .05) klaster.push({ u, p, baru, dasar: Math.round(dasar * 10) / 10, pv });
    }));
    const paparan = I.urutHitung(I.hitung(d.pemantauan.filter(m => m.jenis === 'lingkungan' && ['melebihi', 'kurang'].includes(m.status)), m => namaUnit(m.unit_id) + ' — ' + ((I.PARAMETER[m.parameter] || {}).label || m.parameter))).map(x => ({ label: x.k, n: x.n, w: 'tinggi' }));
    const est = I.estimasiFrekuensi(L, l => l.kategori_kode, l => l.tanggal_lapor), estU = I.estimasiFrekuensi(L, l => l.unit_id, l => l.tanggal_lapor);
    const tabelEst = (e, nama) => e.cukup ? h('div', { class: 'tabel-gulir' }, h('table', { class: 'tabel' }, h('thead', {}, h('tr', {}, ['Kelompok', 'Catatan historis', 'Rata-rata per 30 hari', 'Peluang ≥ 1 laporan dalam 30 hari'].map(t => h('th', { scope: 'col', text: t })))),
      h('tbody', {}, e.baris.slice(0, 8).map(b => h('tr', {}, h('td', { text: nama(b.k) }), h('td', { class: 'angka-tab', text: String(b.n) }), h('td', { class: 'angka-tab', text: String(b.lam).replace('.', ',') }), h('td', {}, h('span', { class: 'meter' }, h('span', { class: 'meter-isi', style: 'width:' + b.peluang + '%' })), ' ' + b.peluang + '%'))))))
      : h('p', { class: 'catatan-batas' }, ikon('info'), h('span', { text: e.alasan }));
    w.replaceChildren(
      h('section', { class: 'kartu' }, h('h2', { text: 'Tren laporan per jenis (6 bulan)' }), G.garis(lbl, seri, { judul: 'Tren jumlah laporan bulanan per jenis' })),
      h('div', { class: 'intel-grid' },
        h('section', { class: 'kartu' }, h('h2', { text: 'Distribusi per jam' }), G.kolom(Array.from({ length: 24 }, (_, j) => String(j).padStart(2, '0')), perJam, { judul: 'Jumlah laporan per jam kejadian', lompat: 3, warna: perJam.map((_, j) => ['w-info', 'w-waspada', 'w-navy'][['pagi', 'siang', 'malam'].indexOf(I.shiftDariJam(j))]) }),
          h('p', { class: 'kecil', text: anon ? anon + ' laporan anonim tidak dihitung karena jamnya sengaja tidak dicatat (privasi).' : 'Warna kolom mengikuti shift.' })),
        h('section', { class: 'kartu' }, h('h2', { text: 'Per shift' }), G.batang(perShift), h('h2', { class: 'mt', text: 'Per hari' }), G.kolom(hariNama, perHari, { judul: 'Jumlah laporan per hari dalam minggu' }))),
      h('div', { class: 'intel-grid' },
        h('section', { class: 'kartu' }, h('h2', { text: 'Komposisi jenis bahaya' }), G.donat(perKat, { judul: 'Komposisi laporan per jenis bahaya', satuan: 'laporan' })),
        h('section', { class: 'kartu' }, h('h2', { text: 'Estimasi risiko 30 hari ke depan' }),
          h('p', { class: 'kecil', text: 'Estimasi berbasis frekuensi historis (model Poisson): peluang setidaknya satu laporan dalam 30 hari bila pola lama berlanjut. BUKAN prediksi pasti kecelakaan.' }),
          h('h3', { text: 'Per jenis bahaya' }), tabelEst(est, k => kat(k).nama), h('h3', { text: 'Per unit' }), tabelEst(estU, namaUnit))),
      h('section', { class: 'kartu' }, h('div', { class: 'kartu-kepala' }, h('h2', { text: 'Epidemiologi kesehatan kerja' }), badge('Data agregat · tanpa identitas', 'netral')),
        K.length ? h('div', { class: 'intel-grid' },
          h('div', {}, h('h3', { text: 'Jumlah kasus per jenis keluhan' }), G.batang(perKeluhan)),
          h('div', {}, h('h3', { text: 'Angka keluhan per 100 pekerja diperiksa' }), G.batang(angkaUnit.map(x => ({ label: x.label + ' (' + x.kasus + '/' + x.diperiksa + ')', n: x.n, w: 'waspada' })), { persen: false })))
          : kosong(['k3rs', 'pj_unit'].includes(peran()) ? 'Belum ada data kesehatan kerja. Catat lewat menu Pemantauan K3.' : 'Data kesehatan kerja hanya dapat dilihat K3RS dan PJ unit.'),
        klaster.length ? h('div', { class: 'daftar-peringatan', role: 'list' }, klaster.map(c => peringatan(3, 'Kemungkinan klaster: ' + (I.JENIS_KELUHAN[c.p] || c.p) + ' di ' + namaUnit(c.u), c.baru + ' kasus dalam 30 hari vs ±' + c.dasar + ' biasanya. Perlu verifikasi oleh dokter/K3RS.', 'virus'))) : null,
        h('h3', { text: 'Paparan lingkungan kerja di luar ambang' }), paparan.length ? G.batang(paparan, { persen: false }) : h('p', { class: 'kecil', text: 'Tidak ada hasil pengukuran di luar ambang.' })));
  }

  // ---------- Tab 4: Cuaca ----------
  async function tCuaca(d, w) {
    const p = A.S.ref.pengaturan;
    const gambar = async paksa => {
      w.replaceChildren(h('p', { class: 'kecil', text: 'Mengambil data cuaca…' }));
      let j;
      try { j = await ambilCuaca(paksa); }
      catch (e) { w.replaceChildren(h('div', { class: 'kartu bahaya-kotak' }, h('strong', { text: 'Data cuaca belum dapat diambil' }), h('p', { text: (e.message || '') + '. Periksa koneksi internet, lalu coba lagi.' }), tombol([ikon('muat'), 'Coba lagi'], () => gambar(true), 'kedua'))); return; }
      const r = ringkasCuaca(j), c = r.kini, alarm = I.risikoCuaca(r.gabungan);
      const kemarin = I.geserHari(I.tanggalLokal(), -1);
      const jsaAktif = d.jsa.filter(x => !['dibatalkan', 'selesai'].includes(x.status) && (!x.tanggal || x.tanggal >= kemarin || (x.target_tanggal && x.target_tanggal >= kemarin))).map(x => Object.assign({}, x, { luar: x.luar_ruangan }));
      const ilKini = [95, 96, 99].includes(c.kode) ? 'petir' : (c.hujan > 0 || [51, 53, 55, 61, 63, 65, 80, 81, 82].includes(c.kode)) ? 'hujan' : c.embusan >= 40 ? 'angin' : 'panas';
      w.replaceChildren(
        h('section', { class: 'kartu cuaca-kini' },
          h('div', { class: 'cuaca-ilustrasi' }, G.ilustrasi(ilKini, { label: I.WMO[c.kode] || 'Cuaca' })),
          h('div', { class: 'cuaca-angka' }, h('h2', { text: (I.WMO[c.kode] || 'Cuaca') + ' · ' + Math.round(c.suhu) + '°C' }),
            h('p', { class: 'kecil', text: 'Terasa ' + Math.round(c.terasa) + '°C · kelembapan ' + c.rh + '% · angin ' + Math.round(c.angin) + ' km/jam (embusan ' + Math.round(c.embusan) + ') · hujan ' + c.hujan + ' mm' }),
            h('p', { class: 'kecil', text: 'Lokasi ' + (p.lintang != null ? p.lintang : 1.4748) + ', ' + (p.bujur != null ? p.bujur : 124.8421) + ' · sumber Open-Meteo (gratis) · ' + I.formatWaktu(new Date()) + ' WITA' }),
            tombol([ikon('muat'), 'Perbarui'], () => gambar(true), 'teks kecil'))),
        h('section', { class: 'kartu' }, h('h2', { text: '12 jam ke depan' }), G.garis(r.jam, [{ nama: 'Peluang hujan %', data: r.pel12, w: 'info' }, { nama: 'Suhu °C', data: r.suhu12.map(Math.round), w: 'tinggi' }, { nama: 'Embusan km/j', data: r.embus12.map(Math.round), w: 'waspada' }], { judul: 'Prakiraan 12 jam', lompat: 2 })),
        alarm.length ? h('div', { class: 'cuaca-alarm' }, alarm.map(a => {
          const terdampak = I.pekerjaanTerdampak(a, jsaAktif);
          return h('section', { class: 'kartu alarm lv-' + Math.min(3, a.tingkat - 1) },
            h('div', { class: 'alarm-kepala' }, G.rambu(a.id === 'hujan' ? 'licin' : a.id === 'angin' ? 'tertimpa' : a.id === 'petir' ? 'listrik' : 'panas', a.judul),
              h('div', {}, h('span', { class: 'pd-tingkat', text: ['', '●', '▲ Waspada', '◆ Bahaya', '✕ Kritis'][a.tingkat] || '' }), h('h2', { text: a.judul }), h('p', { class: 'kecil', text: 'Dampak: ' + a.dampak.join(', ') }))),
            a.evaluasi ? h('p', { class: 'evaluasi' }, ikon('awas'), h('strong', { text: 'Perlu evaluasi petugas berwenang' }), ' untuk pekerjaan luar ruangan/ketinggian. Aplikasi tidak menghentikan pekerjaan secara otomatis.') : null,
            h('h3', { text: 'Rekomendasi pengendalian' }), h('ul', {}, a.saran.map(s => h('li', { text: s }))),
            h('h3', { text: 'Pekerjaan terdampak (JSA aktif)' }), terdampak.length ? h('div', { class: 'daftar-ringkas' }, terdampak.map(x => h('a', { class: 'baris-ringkas', href: '#/jsa?id=' + encodeURIComponent(x.id) }, h('strong', { text: x.nomor }), h('span', { text: x.pekerjaan + ' · ' + namaUnit(x.unit_id) }), x.luar_ruangan ? badge('Luar ruangan', 'rk-2') : null)))
              : h('p', { class: 'kecil', text: 'Tidak ada JSA aktif yang cocok. Tetap periksa pekerjaan luar ruangan yang tidak memakai JSA.' }),
            tombol([ikon('suara'), 'Bacakan peringatan'], () => bacakan(a.judul + '. ' + a.saran.join('. ')), 'teks kecil'));
        })) : h('section', { class: 'kartu' }, h('p', { class: 'ok-teks' }, ikon('centang'), ' Tidak ada peringatan cuaca untuk 6 jam ke depan.')));
      if (suaraAktif() && alarm.length) bacakan('Peringatan cuaca: ' + alarm.map(a => a.judul).join(', '));
      API.catatRiwayat({ kategori: 'cuaca', kueri: 'Cek cuaca & risiko kerja', ringkasan: (I.WMO[c.kode] || '') + ', ' + Math.round(c.suhu) + '°C; peringatan: ' + (alarm.map(a => a.judul).join(', ') || 'tidak ada'), jumlah_hasil: alarm.length }).catch(() => {});
    };
    gambar(false);
  }

  // ---------- Tab 5: Kartu keselamatan & hierarki pengendalian ----------
  function kartuKeselamatan(id, opsi) {
    opsi = opsi || {}; const b = I.BAHAYA[id]; if (!b) return null;
    const serius = b.keparahan >= 4;
    const det = h('details', { class: 'kartu-k3' + (serius ? ' serius' : ''), open: opsi.buka ? true : null },
      h('summary', {}, h('span', { class: 'kk-gambar' }, serius ? G.rambu(id, b.judul) : G.ilustrasi(id, { label: b.judul })),
        h('span', { class: 'kk-judul' }, h('strong', { text: b.judul }), h('small', { text: opsi.ket || ('Keparahan terburuk: ' + b.dampak[b.dampak.length - 1][0]) }),
          h('span', { class: 'kk-lencana' }, A.badgeTingkat(opsi.skor || null), opsi.n ? badge(opsi.n + ' catatan', 'netral') : null)), ikon('kanan', 'kk-panah')),
      h('div', { class: 'kk-isi' },
        serius ? null : h('div', { class: 'kk-maskot' }, G.maskot(b.keparahan >= 3 ? 'cemas' : 'senyum'), h('p', { class: 'gelembung', text: 'Si Aman mengingatkan: ' + (b.kontrol.administratif[0] || '') + '.' })),
        h('h3', { text: 'Skenario kecelakaan yang mungkin' }), h('ol', { class: 'rantai' }, b.skenario.map(s => h('li', { text: s }))),
        h('h3', { text: 'Dampak terhadap pekerja' }), h('ul', { class: 'dampak' }, b.dampak.map(([t, k]) => h('li', {}, h('span', { text: t }), h('span', { class: 'keparahan', 'aria-label': 'keparahan ' + k + ' dari 5' }, Array.from({ length: 5 }, (_, i) => h('span', { class: i < k ? 'on' : '' })))))),
        h('h3', { text: 'Hierarki pengendalian (paling efektif lebih dulu)' }),
        h('ol', { class: 'hirarki' }, I.rekomendasi(id).map((r, i) => h('li', { class: 'lv-' + r.level }, h('strong', { text: (i + 1) + '. ' + r.nama }), h('small', { text: r.ket }), h('ul', {}, r.butir.map(x => h('li', { text: x })))))),
        opsi.sop || null,
        h('div', { class: 'tombol-baris' }, tombol([ikon('suara'), 'Bacakan'], () => bacakan(b.judul + '. Kemungkinan: ' + b.skenario.join('. ') + '. Pengendalian utama: ' + (b.kontrol.eliminasi[0] || '') + '. ' + (b.kontrol.rekayasa[0] || '') + '.'), 'teks kecil'),
          h('a', { class: 'btn teks kecil', href: '#/cari?q=' + encodeURIComponent('SOP ' + b.judul.split(' /')[0]) }, ikon('sop'), 'Cari SOP terkait'))));
    return det;
  }
  A.kartuKeselamatan = kartuKeselamatan;
  function tKartu(d, w) {
    const tl = d.tl || [];
    const tingkat = LV.map(l => ({ level: l, nama: I.NAMA_KONTROL[l], ket: I.KET_KONTROL[l], n: tl.filter(t => t.level_pengendalian === l).length + d.jsa.reduce((s, j) => s + (j.langkah || []).filter(x => x.kontrol && x.kontrol[l]).length, 0) }));
    const ketPir = h('div', { class: 'pir-ket', 'aria-live': 'polite' });
    const pilihLevel = x => { ketPir.replaceChildren(h('h3', { text: x.nama }), h('p', { text: x.ket + '. Tercatat ' + x.n + ' tindakan/rencana pada tingkat ini.' }),
      h('ul', {}, Object.keys(I.BAHAYA).slice(0, 6).map(id => h('li', {}, h('strong', { text: I.BAHAYA[id].judul + ': ' }), (I.BAHAYA[id].kontrol[x.level] || [])[0] || '—')))); };
    pilihLevel(tingkat[0]);
    const total = tingkat.reduce((s, x) => s + x.n, 0), lemah = tingkat.filter(x => ['administratif', 'apd'].includes(x.level)).reduce((s, x) => s + x.n, 0);
    // Bahaya utama dari data
    const hit = {}; const skorMaks = {};
    d.laporan.forEach(l => { const b = bahayaLaporan(l); if (!b) return; hit[b] = (hit[b] || 0) + 1; skorMaks[b] = Math.max(skorMaks[b] || 0, l.skor || 0); });
    d.jsa.forEach(j => (j.langkah || []).forEach(s => (s.bahaya || []).forEach(b => { hit[b] = (hit[b] || 0) + 1; skorMaks[b] = Math.max(skorMaks[b] || 0, (+s.dampak || 0) * (+s.kemungkinan || 0)); })));
    const urut = Object.keys(hit).sort((a, b) => (skorMaks[b] || 0) - (skorMaks[a] || 0) || hit[b] - hit[a]);
    // Analisis pekerjaan instan
    const masukan = h('input', { type: 'search', maxlength: 200, placeholder: 'Contoh: mengganti lampu plafon di lorong saat hujan', 'aria-label': 'Uraian pekerjaan untuk dianalisis' });
    const hasil = h('div', { class: 'kartu-k3-daftar', 'aria-live': 'polite' });
    const analisis = () => {
      const t = masukan.value.trim(); if (!t) return;
      const b = I.deteksiBahaya(t);
      hasil.replaceChildren(b.length ? h('p', { class: 'kecil', text: 'Ditemukan ' + b.length + ' potensi bahaya dari kata: ' + b.flatMap(x => x.kata).join(', ') + '. Periksa kembali di lapangan — daftar ini bantuan, bukan pengganti JSA.' }) : h('p', { class: 'kecil', text: 'Tidak ada kata kunci bahaya yang dikenali. Tulis lebih rinci (alat, tempat, ketinggian, bahan).' }),
        b.map((x, i) => kartuKeselamatan(x.id, { buka: i === 0, ket: 'Terdeteksi dari: ' + x.kata.join(', ') })),
        b.length && ['k3rs', 'pj_unit'].includes(peran()) ? h('a', { class: 'btn utama', href: '#/jsa?baru=1&pekerjaan=' + encodeURIComponent(t) }, ikon('jsa'), 'Buat JSA dari pekerjaan ini') : null);
      API.catatRiwayat({ kategori: 'analisis', kueri: 'Analisis pekerjaan: ' + t, ringkasan: 'Bahaya: ' + (b.map(x => I.BAHAYA[x.id].judul).join(', ') || 'tidak dikenali'), jumlah_hasil: b.length }).catch(() => {});
    };
    w.replaceChildren(
      h('section', { class: 'kartu' }, h('h2', {}, ikon('otak'), ' Analisis bahaya pekerjaan'), h('p', { class: 'kecil', text: 'Tulis pekerjaan yang akan dilakukan. Sistem menampilkan bahaya, skenario kecelakaan, dampak, dan pengendalian sesuai hierarki.' }),
        h('form', { class: 'baris-tanya', onsubmit: e => { e.preventDefault(); analisis(); } }, masukan, h('button', { type: 'submit', class: 'btn utama' }, ikon('cari'), 'Analisis')), hasil),
      h('div', { class: 'intel-grid' },
        h('section', { class: 'kartu' }, h('h2', { text: 'Piramida hierarki pengendalian' }), G.piramida(tingkat, { onKlik: pilihLevel, satuan: 'tindakan' }),
          h('p', { class: 'kecil', text: total ? Math.round(lemah / total * 100) + '% pengendalian masih di tingkat administratif/APD. Utamakan eliminasi, substitusi, dan rekayasa.' : 'Belum ada tindakan pengendalian tercatat.' })),
        h('section', { class: 'kartu' }, ketPir)),
      h('section', { class: 'kartu' }, h('h2', { text: 'Kartu keselamatan: bahaya utama dari data Anda' }), urut.length ? h('div', { class: 'kartu-k3-daftar' }, urut.slice(0, 8).map((id, i) => kartuKeselamatan(id, { buka: i === 0, skor: skorMaks[id] || null, n: hit[id] }))) : kosong('Belum ada data untuk dianalisis.')),
      h('section', { class: 'kartu' }, h('h2', { text: 'Perpustakaan kartu keselamatan' }), h('div', { class: 'kartu-k3-daftar' }, Object.keys(I.BAHAYA).filter(id => !urut.includes(id)).map(id => kartuKeselamatan(id)))));
  }

  // =====================================================================
  // PENCARIAN CERDAS + RIWAYAT 60 HARI
  // =====================================================================
  const CONTOH_Q = ['Near miss shift malam 30 hari terakhir', 'Kejadian tertusuk jarum bulan ini', 'Tampilkan SOP pekerjaan listrik', 'JSA ketinggian minggu ini', 'Temuan inspeksi APAR 3 bulan terakhir', 'Laporan mendesak yang masih terbuka', 'Kebisingan laundry'];
  async function hCari() {
    const q0 = qs().get('q') || '';
    let mode = qs().get('tab') === 'riwayat' ? 'riwayat' : 'cari';
    const wadah = h('div'), tabBar = h('div');
    const gambar = () => { tabBar.replaceChildren(tab([['cari', 'Cari', 'cari'], ['riwayat', 'Riwayat 60 hari', 'riwayat']], mode, id => { mode = id; gambar(); })); mode === 'cari' ? gCari(wadah, q0) : gRiwayat(wadah); };
    tampil(halaman('Pencarian cerdas', '/cari', [tabBar, wadah]));
    gambar();
  }
  function gCari(w, q0) {
    const masukan = h('input', { type: 'search', maxlength: 300, placeholder: 'Tulis seperti bertanya: "near miss maintenance shift malam 30 hari terakhir"', 'aria-label': 'Kata pencarian', value: q0 });
    const hasil = h('div', { class: 'hasil-cari', 'aria-live': 'polite' });
    const mik = AS && AS.bisaDengar && AS.bisaDengar() ? h('button', { type: 'button', class: 'btn kedua ikon-saja', 'aria-label': 'Cari dengan suara', title: 'Cari dengan suara', onclick: () => AS.dengar(t => { masukan.value = t; }, () => jalankanCari(masukan.value, hasil), m => toast(m, 'galat')) }, ikon('mik')) : null;
    w.replaceChildren(h('form', { class: 'kartu cari-kotak', onsubmit: e => { e.preventDefault(); jalankanCari(masukan.value, hasil); } },
      h('div', { class: 'baris-tanya' }, masukan, mik, h('button', { type: 'submit', class: 'btn utama' }, ikon('cari'), 'Cari')),
      h('div', { class: 'chip-baris', 'aria-label': 'Contoh pertanyaan' }, CONTOH_Q.map(c => h('button', { type: 'button', class: 'chip', onclick: () => { masukan.value = c; jalankanCari(c, hasil); } }, c)))), hasil);
    if (q0) jalankanCari(q0, hasil);
  }
  async function jalankanCari(teks, wadah, opsi) {
    teks = String(teks || '').trim(); if (!teks) return;
    wadah.replaceChildren(h('p', { class: 'kecil', text: 'Mencari…' }));
    const f = I.parseKueri(teks, A.S.ref); const d = await muatData();
    const dalamTgl = t => (!f.dari || (t && t >= f.dari)) && (!f.sampai || (t && t <= f.sampai));
    const sumberSaja = f.modul.length ? f.modul : null;
    const ingin = m => !sumberSaja || sumberSaja.includes(m);
    const katDariBahaya = new Set(f.bahaya.map(b => I.BAHAYA[b].kategori));
    // Laporan (risk register / hazard / near miss / incident)
    let L = [];
    if (ingin('laporan') || f.jenis.length || (sumberSaja && sumberSaja.includes('capa'))) {
      L = d.laporan.filter(l => dalamTgl(l.tanggal_lapor) && (!f.jenis.length || f.jenis.includes(l.jenis)) && (!f.kategori.length || f.kategori.includes(l.kategori_kode)) && (!f.unit.length || f.unit.includes(l.unit_id))
        && (!f.shift || I.shiftLaporan(l) === f.shift) && (!f.mendesak || l.mendesak)
        && (!f.status || (f.status === 'terbuka' ? terbuka(l) : f.status === 'terlambat' ? terlambat(l) : ['tertutup'].includes(l.status)))
        && (!f.bahaya.length || f.bahaya.some(b => I.cocokTeks(l.uraian + ' ' + l.lokasi, I.BAHAYA[b].kata.slice(0, 1)) || I.deteksiBahaya(l.uraian + ' ' + l.lokasi).some(x => x.id === b)) || katDariBahaya.has(l.kategori_kode))
        && I.cocokTeks([l.uraian, l.lokasi, l.nomor, kat(l.kategori_kode).nama, namaUnit(l.unit_id)].join(' '), f.kata));
    }
    const cocokUmum = (teksIsi, unit, tg) => dalamTgl(tg) && (!f.unit.length || f.unit.includes(unit)) && (!f.bahaya.length || I.deteksiBahaya(teksIsi).some(x => f.bahaya.includes(x.id))) && I.cocokTeks(teksIsi, f.kata);
    const capa = (ingin('capa') && sumberSaja) ? (d.tl || []).filter(t => { const l = d.laporan.find(x => x.id === t.laporan_id); return l && cocokUmum(t.uraian + ' ' + t.bukti_teks + ' ' + (l.uraian || ''), l.unit_id, (t.dibuat_pada || '').slice(0, 10)); }) : [];
    const J = ingin('jsa') && !f.jenis.length ? d.jsa.filter(j => cocokUmum([j.pekerjaan, j.lokasi, j.nomor, ...(j.langkah || []).map(s => s.langkah + ' ' + s.uraian_bahaya)].join(' '), j.unit_id, j.tanggal) && (!f.shift || j.shift === f.shift)) : [];
    const INS = ingin('inspeksi') && !f.jenis.length ? d.inspeksi.filter(x => cocokUmum([x.judul, x.lokasi, x.catatan, ...(x.hasil || []).filter(r => r.nilai === 'tidak').map(r => r.butir + ' ' + (r.catatan || ''))].join(' '), x.unit_id, x.tanggal) && (!f.shift || x.shift === f.shift)) : [];
    const PM = ingin('pemantauan') && !f.jenis.length ? d.pemantauan.filter(m => cocokUmum([(I.PARAMETER[m.parameter] || {}).label, I.JENIS_KELUHAN[m.parameter], m.parameter, m.lokasi, m.catatan, namaUnit(m.unit_id)].join(' '), m.unit_id, m.tanggal)) : [];
    let SOP = [];
    const kataSop = [...f.kata, ...f.bahaya.map(b => I.BAHAYA[b].kata[0])].join(' ');
    if ((ingin('sop') || f.bahaya.length || f.kata.length) && !f.jenis.length && kataSop.trim()) { try { SOP = await API.cariDokumen(kataSop) || []; } catch (e) { SOP = []; } }
    // Ringkasan (hanya hitungan; tidak mengarang isi)
    const total = L.length + J.length + INS.length + PM.length + SOP.length + capa.length;
    const bagianTeks = [L.length && L.length + ' laporan', capa.length && capa.length + ' tindakan CAPA', J.length && J.length + ' JSA', INS.length && INS.length + ' inspeksi', PM.length && PM.length + ' data pemantauan', SOP.length && SOP.length + ' bagian dokumen SOP'].filter(Boolean);
    const ringkasan = total ? 'Ditemukan ' + bagianTeks.join(', ') + (f.rentangLabel ? ' (' + f.rentangLabel + ')' : '') + '.' : 'Tidak ada data yang cocok.';
    const chip = [f.jenis.map(j => JENIS[j].split(' /')[0]), f.kategori.map(k => kat(k).nama), f.unit.map(namaUnit), f.shift ? 'Shift ' + I.SHIFT[f.shift].label : null, f.rentangLabel || null,
      f.mendesak ? 'Mendesak' : null, f.status ? 'Status: ' + f.status : null, f.bahaya.map(b => I.BAHAYA[b].judul), f.modul.map(m => m.toUpperCase()), f.kata.map(k => '"' + k + '"')].flat().filter(Boolean);
    const blok = [];
    blok.push(h('section', { class: 'kartu ringkas-cari' }, h('div', { class: 'kartu-kepala' }, h('h2', { text: ringkasan }), tombol([ikon('suara')], () => bacakan(ringkasan), 'teks kecil', { 'aria-label': 'Bacakan ringkasan' })),
      chip.length ? h('div', { class: 'chip-baris' }, h('span', { class: 'kecil', text: 'Dipahami sebagai:' }), chip.map(c => h('span', { class: 'chip pasif', text: c }))) : null,
      L.length > 1 ? h('div', { class: 'intel-grid' }, h('div', {}, h('h3', { text: 'Per jenis' }), G.batang(I.urutHitung(I.hitung(L, l => l.jenis)).map(x => ({ label: JENIS[x.k].split(' /')[0], n: x.n, w: { bahaya: 'info', nyaris_celaka: 'waspada', kejadian: 'kritis' }[x.k] })))),
        h('div', {}, h('h3', { text: 'Per unit' }), G.batang(I.urutHitung(I.hitung(L, l => l.unit_id)).slice(0, 6).map(x => ({ label: namaUnit(+x.k), n: x.n })))),
        h('div', {}, h('h3', { text: 'Per shift' }), G.batang(['pagi', 'siang', 'malam', null].map(s => ({ label: s ? I.SHIFT[s].label : 'Anonim (jam tidak dicatat)', n: L.filter(l => I.shiftLaporan(l) === s).length })).filter(x => x.n)))) : null));
    if (L.length) blok.push(h('section', { class: 'kartu' }, h('h2', { text: 'Laporan (' + L.length + ')' }), h('div', { class: 'daftar-ringkas' }, L.slice(0, 60).map(l => h('a', { class: 'baris-ringkas', href: '#/laporan/' + encodeURIComponent(l.id) },
      h('strong', { text: l.nomor }), h('span', { text: A.tgl(l.tanggal_lapor) + (I.shiftLaporan(l) ? ' · ' + I.SHIFT[I.shiftLaporan(l)].label : '') + ' · ' + (JENIS[l.jenis] || '').split(' /')[0] + ' · ' + kat(l.kategori_kode).nama + ' · ' + namaUnit(l.unit_id) + ' — ' + (l.uraian || '').slice(0, 80) }), A.badgeStatus(l.status))))));
    if (capa.length) blok.push(h('section', { class: 'kartu' }, h('h2', { text: 'Tindakan korektif/preventif (' + capa.length + ')' }), h('div', { class: 'daftar-ringkas' }, capa.slice(0, 40).map(t => { const l = d.laporan.find(x => x.id === t.laporan_id); return h('a', { class: 'baris-ringkas', href: '#/laporan/' + encodeURIComponent(t.laporan_id) }, h('strong', { text: l.nomor }), h('span', { text: A.tgl(t.dibuat_pada) + ' · ' + (LEVEL[t.level_pengendalian] || '').split(' (')[0] + ' — ' + t.uraian.slice(0, 90) })); }))));
    if (J.length) blok.push(h('section', { class: 'kartu' }, h('h2', { text: 'JSA (' + J.length + ')' }), h('div', { class: 'daftar-ringkas' }, J.map(j => h('a', { class: 'baris-ringkas', href: '#/jsa?id=' + encodeURIComponent(j.id) }, h('strong', { text: j.nomor }), h('span', { text: A.tgl(j.tanggal) + ' · ' + j.pekerjaan + ' · ' + namaUnit(j.unit_id) }), A.badgeTingkat(j.skor_maks || null))))));
    if (INS.length) blok.push(h('section', { class: 'kartu' }, h('h2', { text: 'Inspeksi (' + INS.length + ')' }), h('div', { class: 'daftar-ringkas' }, INS.map(x => h('a', { class: 'baris-ringkas', href: '#/inspeksi?id=' + encodeURIComponent(x.id) }, h('strong', { text: x.nomor }), h('span', { text: A.tgl(x.tanggal) + ' · ' + x.judul + ' · ' + namaUnit(x.unit_id) + ' · ' + x.jumlah_temuan + ' temuan' }), badge((x.skor_kepatuhan == null ? '—' : x.skor_kepatuhan) + '%', x.skor_kepatuhan >= 90 ? 'rk-0' : x.skor_kepatuhan >= 75 ? 'rk-1' : 'rk-3'))))));
    if (PM.length) blok.push(h('section', { class: 'kartu' }, h('h2', { text: 'Pemantauan (' + PM.length + ')' }), h('div', { class: 'daftar-ringkas' }, PM.map(m => h('a', { class: 'baris-ringkas', href: '#/pemantauan' }, h('strong', { text: A.tgl(m.tanggal) }), h('span', { text: ((I.PARAMETER[m.parameter] || {}).label || I.JENIS_KELUHAN[m.parameter] || m.parameter) + ' · ' + namaUnit(m.unit_id) + ' · ' + (m.nilai != null ? m.nilai + ' ' + m.satuan : (m.jumlah_kasus || 0) + ' kasus') }), A.K3Status ? A.K3Status(m.status) : badge(m.status, 'netral'))))));
    if (SOP.length) blok.push(h('section', { class: 'kartu' }, h('h2', { text: 'SOP & dokumen (' + SOP.length + ' bagian)' }), h('p', { class: 'kecil', text: 'Isi di bawah adalah kutipan langsung dari dokumen yang diunggah, bukan ringkasan buatan sistem.' }),
      h('div', { class: 'daftar-sop' }, SOP.map(s => h('a', { class: 'sop-hasil' + (s.status !== 'aktif' ? ' lama' : ''), href: '#/sop?id=' + encodeURIComponent(s.dokumen_id) + '&hal=' + s.halaman },
        h('strong', { text: s.judul }), h('small', { text: [s.nomor, 'versi ' + s.versi, s.berlaku_mulai ? 'berlaku ' + A.tgl(s.berlaku_mulai) : null, 'halaman/bagian ' + s.halaman].filter(Boolean).join(' · ') }),
        s.status !== 'aktif' ? h('span', { class: 'badge rk-2', text: '⚠ Versi ' + (s.status === 'diganti' ? 'lama (sudah diganti) — bukan SOP aktif' : 'nonaktif') }) : badge('✓ Aktif', 'rk-0'),
        h('span', { class: 'cuplikan' }, ...String(s.cuplikan || '').split(/(«[^»]*»)/).map(x => x.startsWith('«') ? h('mark', { text: x.slice(1, -1) }) : x)))))));
    if (!total) blok.push(kosong('Coba kata lain, perluas rentang waktu, atau hapus nama unit/shift.'));
    wadah.replaceChildren(...blok);
    if (!opsi || !opsi.tanpaRiwayat) {
      const ref = [...L.slice(0, 80).map(l => ({ t: 'laporan', id: l.id, n: l.nomor })), ...J.slice(0, 30).map(j => ({ t: 'jsa', id: j.id, n: j.nomor })), ...INS.slice(0, 30).map(x => ({ t: 'inspeksi', id: x.id, n: x.nomor })), ...SOP.slice(0, 30).map(s => ({ t: 'sop', id: s.dokumen_id, n: s.judul + ' h.' + s.halaman }))];
      API.catatRiwayat({ kategori: f.modul.length === 1 && f.modul[0] === 'sop' ? 'sop' : 'pencarian', kueri: teks, filter: f, ringkasan, referensi: ref, jumlah_hasil: total, jenis_kejadian: f.jenis }).catch(() => {});
    }
  }
  async function gRiwayat(w) {
    let R = [];
    try { R = await API.daftarRiwayat(); } catch (e) { w.replaceChildren(h('p', { class: 'catatan-batas', text: e.message })); return; }
    const tgl = h('input', { type: 'date', 'aria-label': 'Tanggal' }), shift = pilih([['', 'Semua shift'], ['pagi', 'Pagi'], ['siang', 'Siang'], ['malam', 'Malam']], '', { 'aria-label': 'Shift' });
    const jenis = pilih([['', 'Semua jenis kejadian'], ...Object.entries(JENIS).map(([k, v]) => [k, v.split(' /')[0]])], '', { 'aria-label': 'Jenis kejadian' });
    const kategori = pilih([['', 'Semua kategori'], ['pencarian', 'Pencarian'], ['sop', 'SOP'], ['analisis', 'Analisis'], ['cuaca', 'Cuaca']], '', { 'aria-label': 'Kategori' });
    const teks = h('input', { type: 'search', placeholder: 'Cari di riwayat…', 'aria-label': 'Cari di riwayat' });
    const daftar = h('div', { class: 'daftar-riwayat' });
    const gambar = () => {
      const x = R.filter(r => (!tgl.value || I.bagianWaktu(r.pada).tanggal === tgl.value) && (!shift.value || r.shift === shift.value) && (!jenis.value || (r.jenis_kejadian || []).includes(jenis.value) || (r.filter && (r.filter.jenis || []).includes(jenis.value)))
        && (!kategori.value || r.kategori === kategori.value) && (!teks.value || I.cocokTeks(r.kueri + ' ' + r.ringkasan, teks.value.toLowerCase().split(/\s+/).filter(Boolean))));
      daftar.replaceChildren(x.length ? h('ul', { class: 'linimasa-riwayat' }, x.map(r => h('li', {},
        h('div', { class: 'lr-waktu' }, h('strong', { text: I.formatWaktu(r.pada) }), h('small', { text: 'Shift ' + (r.shift ? I.SHIFT[r.shift].label : '—') + ' · ' + r.kategori })),
        h('div', { class: 'lr-isi' }, h('strong', { text: r.kueri }), h('small', { text: r.ringkasan || '' }), (r.referensi || []).length ? h('small', { class: 'kecil', text: 'Rujukan: ' + r.referensi.slice(0, 6).map(z => z.n).join(', ') + (r.referensi.length > 6 ? ' …' : '') }) : null),
        h('div', { class: 'lr-aksi' }, ['pencarian', 'sop'].includes(r.kategori) ? h('a', { class: 'btn kedua kecil', href: '#/cari?q=' + encodeURIComponent(r.kueri) }, ikon('muat'), 'Jalankan lagi') : null,
          r.pengguna_id === A.S.sesi.profil.id ? tombol([ikon('hapus')], async ev => { await sibuk(ev.currentTarget, async () => { await API.hapusRiwayat(r.id); R = R.filter(z => z.id !== r.id); gambar(); }).catch(() => {}); }, 'teks kecil', { 'aria-label': 'Hapus riwayat ini' }) : null))))
        : kosong('Belum ada riwayat yang cocok.'));
    };
    [tgl, shift, jenis, kategori].forEach(e => e.addEventListener('change', gambar)); teks.addEventListener('input', gambar);
    w.replaceChildren(h('p', { class: 'catatan-batas' }, ikon('info'), h('span', { text: 'Riwayat pencarian dan analisis disimpan 60 hari (waktu WITA), lalu terhapus otomatis. Catatan resmi K3 (laporan, JSA, SOP) tidak ikut terhapus.' })),
      h('div', { class: 'kartu filter' }, tgl, shift, jenis, kategori, teks), daftar);
    gambar();
  }

  // =====================================================================
  // RIWAYAT PERUBAHAN (jejak: nilai lama → baru, pelaku, waktu) — khusus K3RS
  // =====================================================================
  const NAMA_KOLOM = { status: 'Status', pj_id: 'Penanggung jawab', target_tanggal: 'Target', dampak: 'Dampak', kemungkinan: 'Kemungkinan', skor: 'Skor risiko', level_pengendalian: 'Pengendalian',
    lokasi: 'Lokasi', uraian: 'Uraian', pekerjaan: 'Pekerjaan', langkah: 'Langkah kerja', pj_nama: 'Penanggung jawab', skor_maks: 'Skor tertinggi', disetujui_oleh: 'Disetujui oleh', hasil: 'Hasil periksa',
    skor_kepatuhan: 'Kepatuhan', jumlah_temuan: 'Temuan', nilai: 'Nilai', ambang_min: 'Ambang min', ambang_maks: 'Ambang maks', judul: 'Judul', versi: 'Versi', tanggal_tinjau: 'Tanggal tinjau', pemilik: 'Pemilik', mendesak: 'Mendesak', ditutup_pada: 'Ditutup' };
  let namaPengguna = null;
  const tampilNilai = v => v === null || v === undefined || v === '' ? '—' : typeof v === 'object' ? (Array.isArray(v) ? v.length + ' butir' : '{…}') : String(v).slice(0, 80);
  function panelJejak(tabel, id) {
    const isi = h('div', { class: 'jejak-isi' }, h('p', { class: 'kecil', text: 'Memuat…' }));
    let dimuat = false;
    const d = h('details', { class: 'kartu jejak', ontoggle: async () => {
      if (!d.open || dimuat) return; dimuat = true;
      try {
        const [J] = await Promise.all([API.jejak(tabel, id), namaPengguna ? null : API.daftarPengguna().then(P => { namaPengguna = Object.fromEntries(P.map(u => [u.id, u.nama])); }).catch(() => { namaPengguna = {}; })]);
        if (J === null) return isi.replaceChildren(h('p', { class: 'kecil', text: 'Riwayat perubahan aktif setelah admin menjalankan supabase/21_jejak_dan_dokumen.sql.' }));
        isi.replaceChildren(J.length ? h('ol', { class: 'jejak-daftar' }, J.map(j => h('li', {},
          h('div', { class: 'kecil' }, h('strong', { text: I.formatWaktu(j.pada) + ' WITA' }), ' · ' + ({ buat: 'Dibuat', ubah: 'Diubah', hapus: 'Dihapus' }[j.aksi] || j.aksi) + ' oleh ' + (j.aktor ? (namaPengguna[j.aktor] || 'pengguna ' + String(j.aktor).slice(0, 8)) : 'anonim/sistem')),
          j.aksi === 'ubah' ? h('ul', {}, Object.keys(j.sesudah || {}).map(k => h('li', {}, h('span', { text: (NAMA_KOLOM[k] || k) + ': ' }), h('del', { text: tampilNilai((j.sebelum || {})[k]) }), ' → ', h('ins', { text: tampilNilai(j.sesudah[k]) })))) : null)))
          : h('p', { class: 'kecil', text: 'Belum ada perubahan tercatat.' }));
      } catch (e) { isi.replaceChildren(h('p', { class: 'kecil', text: e.message })); }
    } }, h('summary', {}, ikon('riwayat'), ' Riwayat perubahan'), isi);
    return d;
  }
  A.panelJejak = panelJejak;

  // =====================================================================
  // NOTIFIKASI & ESKALASI (dihitung dari data aktual sesuai hak akses; tanpa duplikat)
  // =====================================================================
  const KUNCI_BACA = () => 'k3_notif_dibaca_' + ((A.S.sesi && A.S.sesi.profil.id) || '');
  async function daftarNotifikasi() {
    const p = peran(); if (!p) return [];
    const d = await muatData(), kini = I.tanggalLokal(), saya = A.S.sesi.profil.id, N = [];
    const dalam3 = I.geserHari(kini, 3), L = d.laporan;
    const tambah = (id, tingkat, judul, isi, href, ik) => N.push({ id, tingkat, judul, isi, href, ik });
    if (p === 'k3rs') L.filter(l => l.status === 'baru').forEach(l => tambah('baru:' + l.id, l.mendesak ? 3 : 1, 'Laporan baru belum ditugaskan: ' + l.nomor, kat(l.kategori_kode).nama + ' · ' + namaUnit(l.unit_id) + (l.mendesak ? ' · MENDESAK' : ''), '#/laporan/' + encodeURIComponent(l.id), 'kotakmasuk'));
    if (p !== 'petugas') {
      L.filter(l => terbuka(l) && A.levelRisiko(l.skor) >= 2 && (p === 'k3rs' || l.pj_id === saya || l.unit_id === A.S.sesi.profil.unit_id)).forEach(l => tambah('tinggi:' + l.id, A.levelRisiko(l.skor) >= 3 ? 3 : 2, 'Risiko ' + A.tingkat(l.skor).toLowerCase() + ' masih terbuka: ' + l.nomor, kat(l.kategori_kode).nama + ' · ' + namaUnit(l.unit_id), '#/laporan/' + encodeURIComponent(l.id), 'awas'));
      L.filter(l => (p === 'k3rs' || l.pj_id === saya) && ['ditugaskan', 'dalam_tindak_lanjut'].includes(l.status) && l.target_tanggal).forEach(l => {
        if (l.target_tanggal < kini) tambah('telat:' + l.id + ':' + l.target_tanggal, 3, 'CAPA terlambat: ' + l.nomor, 'Target ' + A.tgl(l.target_tanggal), '#/laporan/' + encodeURIComponent(l.id), 'jam');
        else if (l.target_tanggal <= dalam3) tambah('tempo:' + l.id + ':' + l.target_tanggal, 2, 'CAPA jatuh tempo: ' + l.nomor, 'Target ' + A.tgl(l.target_tanggal), '#/laporan/' + encodeURIComponent(l.id), 'kalender');
      });
    }
    if (p === 'k3rs') {
      L.filter(l => l.status === 'terkendali_sementara').forEach(l => tambah('verif:' + l.id, 1, 'Belum diverifikasi permanen: ' + l.nomor, 'Pengendalian baru administratif/APD; perlu rekayasa atau eliminasi', '#/laporan/' + encodeURIComponent(l.id), 'piramida'));
      d.jsa.filter(j => j.status === 'draf').forEach(j => tambah('jsa:' + j.id + ':' + (j.diperbarui_pada || j.dibuat_pada), A.levelRisiko(j.skor_maks) >= 2 ? 2 : 1, 'JSA menunggu persetujuan: ' + j.nomor, j.pekerjaan + ' · ' + namaUnit(j.unit_id), '#/jsa?id=' + encodeURIComponent(j.id), 'jsa'));
      try { (await API.daftarDokumen()).filter(x => x.status === 'aktif' && x.tanggal_tinjau && x.tanggal_tinjau <= I.geserHari(kini, 30)).forEach(x => tambah('tinjau:' + x.id + ':' + x.tanggal_tinjau, x.tanggal_tinjau < kini ? 2 : 1, (x.tanggal_tinjau < kini ? 'Dokumen lewat tanggal tinjau: ' : 'Dokumen perlu ditinjau segera: ') + x.judul, 'Tanggal tinjau ' + A.tgl(x.tanggal_tinjau), '#/sop?id=' + encodeURIComponent(x.id), 'sop')); } catch (e) { /* modul dokumen belum aktif */ }
      // Rekomendasi prioritas inspeksi: unit dengan laporan terbanyak 30 hari tetapi tanpa inspeksi 30 hari
      const unitLapor = I.urutHitung(I.hitung(L.filter(l => dalamHari(l.tanggal_lapor, 30)), l => l.unit_id));
      unitLapor.filter(u => u.n >= 3 && !d.inspeksi.some(x => String(x.unit_id) === u.k && dalamHari(x.tanggal, 30))).slice(0, 3).forEach(u => tambah('inspeksi:' + u.k + ':' + kini.slice(0, 7), 1, 'Prioritas inspeksi: ' + namaUnit(+u.k), u.n + ' laporan dalam 30 hari dan belum ada inspeksi 30 hari terakhir', '#/inspeksi?baru=1', 'inspeksi'));
    }
    const dibaca = new Set(LS.get(KUNCI_BACA(), []));
    return N.sort((a, b) => b.tingkat - a.tingkat).map(n => Object.assign(n, { dibaca: dibaca.has(n.id) }));
  }
  async function perbaruiLonceng() {
    const el = document.querySelector('.lonceng-n'); if (!el || !peran()) return;
    try { const n = (await daftarNotifikasi()).filter(x => !x.dibaca).length; el.hidden = !n; el.textContent = n > 99 ? '99+' : String(n); el.parentElement.setAttribute('aria-label', 'Notifikasi' + (n ? ', ' + n + ' belum dibaca' : '')); } catch (e) { el.hidden = true; }
  }
  // Perbarui lencana setiap kali halaman baru dirender (bukan berdasarkan jeda waktu)
  const wadahApp = document.getElementById('app');
  if (wadahApp && window.MutationObserver) new MutationObserver(() => { const el = document.querySelector('.lonceng-n'); if (el && !el.dataset.diisi) { el.dataset.diisi = '1'; perbaruiLonceng(); } }).observe(wadahApp, { childList: true });
  async function hNotifikasi() {
    const N = await daftarNotifikasi();
    const tandai = ids => { const s = new Set(LS.get(KUNCI_BACA(), [])); ids.forEach(i => s.add(i)); LS.set(KUNCI_BACA(), [...s].slice(-1000)); };
    tampil(halaman('Notifikasi', '/notifikasi', [
      h('div', { class: 'tombol-baris antara' }, h('p', { class: 'kecil', text: N.filter(x => !x.dibaca).length + ' belum dibaca · dihitung dari data terbaru sesuai hak akses Anda' }),
        N.length ? tombol([ikon('centang'), 'Tandai semua dibaca'], () => { tandai(N.map(x => x.id)); A.jalankan(); }, 'teks') : null),
      N.length ? h('div', { class: 'daftar-peringatan', role: 'list' }, N.map(n => { const el = peringatan(n.tingkat, n.judul, n.isi, n.ik, n.href); if (n.dibaca) el.classList.add('dibaca'); el.addEventListener('click', () => tandai([n.id])); return el; }))
        : h('section', { class: 'kartu' }, h('p', { class: 'ok-teks' }, ikon('centang'), ' Tidak ada notifikasi. Semua tindakan sesuai jadwal.'))]));
    setTimeout(perbaruiLonceng, 100);
  }
  A.daftarNotifikasi = daftarNotifikasi;

  // ---------- Daftarkan rute ----------
  Object.assign(A.RUTE, { '/intel': hIntel, '/cari': hCari, '/notifikasi': hNotifikasi });
  A.jalankanCari = jalankanCari; A.tab = tab; A.ubin = ubin; A.peringatan = peringatan; A.ikonBahaya = ikonBahaya; A.qs = qs; A.bacakan = bacakan; A.suaraAktif = suaraAktif;
})();
