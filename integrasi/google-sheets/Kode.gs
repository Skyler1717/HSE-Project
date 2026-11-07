/**
 * Kode.gs — Sinkronisasi HSE (Supabase) → Google Sheets. GRATIS, tanpa server tambahan.
 * Supabase tetap sumber data resmi; Sheets hanya untuk pelaporan dan analisis.
 *
 * PEMASANGAN (sekali):
 *  1. Buat Google Spreadsheet baru → Extensions → Apps Script → hapus isi Code.gs → tempel berkas ini.
 *  2. Project Settings (ikon roda gigi) → Script properties → tambahkan:
 *       SUPABASE_URL       = https://fkynbegfeodymincuucy.supabase.co
 *       SUPABASE_ANON_KEY  = (kunci anon/publik yang sama dengan config.js)
 *       HSE_TOKEN          = (token dari aplikasi: Admin → Google Sheets → Buat token)
 *  3. Pilih fungsi "pasang" → Run → izinkan akses. Selesai: sinkron otomatis tiap 10 menit.
 *  4. Bagikan spreadsheet HANYA ke akun yang berwenang (berisi data K3 internal).
 *
 * Cara kerja: ambil antrean (sinkron_ambil) → tulis/perbarui baris berdasarkan kolom "id"
 * (tidak pernah menggandakan baris) → laporkan hasil (sinkron_lapor). Baris gagal dicoba ulang
 * otomatis oleh Supabase (maks. 10 kali). Penyimpanan di aplikasi tidak pernah menunggu Google.
 */
var TAB = {
  laporan: 'Risk Register',
  jenis: { bahaya: 'Hazard Report', nyaris_celaka: 'Near Miss', kejadian: 'Incident Report' },
  tindak_lanjut: 'CAPA', jsa: 'JSA', inspeksi: 'Inspection', pemantauan: 'HSE Monitoring', laporan_bulanan: 'Monthly Report'
};
var URUTAN_TAB = ['Dashboard', 'Risk Register', 'Hazard Report', 'Near Miss', 'Incident Report', 'CAPA', 'JSA', 'Inspection', 'HSE Monitoring', 'Monthly Report'];

function prop_(k) { var v = PropertiesService.getScriptProperties().getProperty(k); if (!v) throw new Error('Script property ' + k + ' belum diisi'); return v; }

function rpc_(fungsi, isi) {
  var url = prop_('SUPABASE_URL').replace(/\/+$/, '').replace(/\/(rest|auth)\/v1.*$/, '') + '/rest/v1/rpc/' + fungsi;
  var r = UrlFetchApp.fetch(url, { method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { apikey: prop_('SUPABASE_ANON_KEY'), Authorization: 'Bearer ' + prop_('SUPABASE_ANON_KEY') }, payload: JSON.stringify(isi) });
  var kode = r.getResponseCode(), teks = r.getContentText();
  if (kode >= 300) throw new Error('Supabase ' + fungsi + ' ' + kode + ': ' + teks.slice(0, 300));
  return teks ? JSON.parse(teks) : null;
}

/** Jalankan sekali: membuat tab, judul kolom, dan jadwal otomatis. */
function pasang() {
  var ss = SpreadsheetApp.getActive();
  URUTAN_TAB.forEach(function (n, i) { var sh = ss.getSheetByName(n) || ss.insertSheet(n, i); if (sh.getLastRow() === 0 && n !== 'Dashboard') { sh.getRange(1, 1).setValue('id'); sh.setFrozenRows(1); } });
  var awal = ss.getSheetByName('Sheet1') || ss.getSheetByName('Lembar1'); if (awal && ss.getSheets().length > 1 && awal.getLastRow() === 0) ss.deleteSheet(awal);
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'sinkron') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('sinkron').timeBased().everyMinutes(10).create();
  sinkron();
}

/** Dipanggil jadwal tiap 10 menit (juga boleh dijalankan manual). */
function sinkron() {
  var kunci = LockService.getScriptLock(); if (!kunci.tryLock(5000)) return;
  try {
    var ss = SpreadsheetApp.getActive(), token = prop_('HSE_TOKEN'), total = 0;
    for (var putaran = 0; putaran < 10; putaran++) {
      var antrean = rpc_('sinkron_ambil', { p_token: token, p_batas: 200 }) || [];
      if (!antrean.length) break;
      var hasil = [], cache = {};
      antrean.forEach(function (x) {
        try {
          if (!x.data) throw new Error('Data sumber tidak ditemukan (mungkin dihapus)');
          if (x.tabel === 'laporan') { tulis_(ss, TAB.laporan, x.data, cache); if (TAB.jenis[x.data.jenis]) tulis_(ss, TAB.jenis[x.data.jenis], x.data, cache); }
          else if (x.tabel === 'laporan_bulanan') tulis_(ss, TAB.laporan_bulanan, ratakanBulanan_(x.data), cache);
          else if (TAB[x.tabel]) tulis_(ss, TAB[x.tabel], x.data, cache);
          else throw new Error('Tabel tidak dikenal: ' + x.tabel);
          hasil.push({ antrean_id: x.antrean_id, ok: true });
        } catch (e) { hasil.push({ antrean_id: x.antrean_id, ok: false, galat: String(e.message || e).slice(0, 300) }); }
      });
      rpc_('sinkron_lapor', { p_token: token, p_hasil: hasil });
      total += antrean.length;
      if (antrean.length < 200) break;
    }
    if (total) dasbor_(ss);
    ss.getSheetByName('Dashboard') && ss.getSheetByName('Dashboard').getRange('A2').setValue('Sinkron terakhir: ' + Utilities.formatDate(new Date(), 'Asia/Makassar', 'dd MMM yyyy HH:mm') + ' WITA · ' + total + ' baris');
  } finally { kunci.releaseLock(); }
}

/** Upsert satu baris berdasarkan kolom "id"; kolom baru ditambahkan otomatis. */
function tulis_(ss, namaTab, data, cache) {
  var sh = ss.getSheetByName(namaTab) || ss.insertSheet(namaTab);
  var c = cache[namaTab];
  if (!c) {
    if (sh.getLastRow() === 0) sh.getRange(1, 1).setValue('id');
    var kepala = sh.getRange(1, 1, 1, Math.max(1, sh.getLastColumn())).getValues()[0].map(String);
    var ids = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues().map(function (r) { return String(r[0]); }) : [];
    var peta = {}; ids.forEach(function (id, i) { peta[id] = i + 2; });
    c = cache[namaTab] = { kepala: kepala, peta: peta };
  }
  Object.keys(data).forEach(function (k) { if (c.kepala.indexOf(k) < 0) { c.kepala.push(k); sh.getRange(1, c.kepala.length).setValue(k).setFontWeight('bold'); } });
  var baris = c.kepala.map(function (k) { var v = data[k]; return v === null || v === undefined ? '' : (typeof v === 'object' ? JSON.stringify(v) : v); });
  var id = String(data.id), no = c.peta[id];
  if (!no) { no = sh.getLastRow() + 1; c.peta[id] = no; }
  sh.getRange(no, 1, 1, baris.length).setValues([baris]);
}

function ratakanBulanan_(r) {
  var d = r.data || {}, s = d.sebelumnya || {}, o = { id: r.id, periode: r.periode, status: r.status, dibuat_pada: r.dibuat_pada };
  Object.keys(d).forEach(function (k) { if (k === 'sebelumnya' || k === 'dihitung_pada') return; o[k] = typeof d[k] === 'object' ? JSON.stringify(d[k]) : d[k]; });
  ['laporan_total', 'capa_ditutup', 'capa_terlambat', 'inspeksi_temuan', 'keluhan_kesehatan'].forEach(function (k) { if (s[k] !== undefined) o[k + '_bulan_lalu'] = s[k]; });
  return o;
}

/** Ringkasan pada tab Dashboard (dihitung ulang setiap sinkron). */
function dasbor_(ss) {
  var sh = ss.getSheetByName('Dashboard') || ss.insertSheet('Dashboard', 0);
  var rr = ss.getSheetByName('Risk Register'); var data = rr && rr.getLastRow() > 1 ? rr.getDataRange().getValues() : [[]];
  var kep = data[0].map(String), isi = data.slice(1), kol = function (n) { return kep.indexOf(n); };
  var hitung = function (n) { var o = {}; var i = kol(n); if (i < 0) return o; isi.forEach(function (r) { var k = String(r[i] || '—'); o[k] = (o[k] || 0) + 1; }); return o; };
  var hariIni = Utilities.formatDate(new Date(), 'Asia/Makassar', 'yyyy-MM-dd');
  var terbuka = isi.filter(function (r) { return ['baru', 'ditugaskan', 'dalam_tindak_lanjut'].indexOf(String(r[kol('status')])) >= 0; }).length;
  var terlambat = isi.filter(function (r) { var t = r[kol('target')]; t = t instanceof Date ? Utilities.formatDate(t, 'Asia/Makassar', 'yyyy-MM-dd') : String(t || ''); return t && t < hariIni && ['ditugaskan', 'dalam_tindak_lanjut'].indexOf(String(r[kol('status')])) >= 0; }).length;
  var jumlahTab = function (n) { var s = ss.getSheetByName(n); return s ? Math.max(0, s.getLastRow() - 1) : 0; };
  sh.clear();
  sh.getRange('A1').setValue('HSE — Dashboard (data dari Supabase; jangan diedit manual)').setFontWeight('bold').setFontSize(14);
  var baris = [['Indikator', 'Nilai'], ['Total laporan (risk register)', isi.length], ['Laporan terbuka', terbuka], ['CAPA terlambat', terlambat],
    ['Tindakan CAPA', jumlahTab('CAPA')], ['JSA', jumlahTab('JSA')], ['Inspeksi', jumlahTab('Inspection')], ['Data pemantauan', jumlahTab('HSE Monitoring')], ['', '']];
  var jenis = hitung('jenis'); baris.push(['Per jenis laporan', 'Jumlah']); Object.keys(jenis).forEach(function (k) { baris.push([k, jenis[k]]); });
  baris.push(['', '']); var tingkat = hitung('tingkat'); baris.push(['Per tingkat risiko', 'Jumlah']); Object.keys(tingkat).forEach(function (k) { baris.push([k, tingkat[k]]); });
  baris.push(['', '']); var unit = hitung('unit'); baris.push(['Per unit', 'Jumlah']); Object.keys(unit).sort(function (a, b) { return unit[b] - unit[a]; }).forEach(function (k) { baris.push([k, unit[k]]); });
  sh.getRange(4, 1, baris.length, 2).setValues(baris);
  sh.getRange(4, 1, 1, 2).setFontWeight('bold'); sh.autoResizeColumns(1, 2);
  sh.getCharts().forEach(function (c) { sh.removeChart(c); });
  var awalJenis = 4 + 9, nJenis = Object.keys(jenis).length;
  if (nJenis) sh.insertChart(sh.newChart().asColumnChart().addRange(sh.getRange(awalJenis, 1, nJenis + 1, 2)).setPosition(4, 4, 0, 0).setOption('title', 'Laporan per jenis').setOption('legend', { position: 'none' }).build());
}
