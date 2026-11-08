const fs = require('fs'), { execFileSync } = require('child_process');
const kode = fs.readFileSync(require('path').join(__dirname, '..', '..', 'integrasi/google-sheets/Kode.gs'), 'utf8');
const sql = q => execFileSync('psql', ['-d', process.env.HSE_DB || 'hse_uji', '-tAq', '-c', q]).toString().trim();
// Lembar tiruan
function Lembar(nama) { this.nama = nama; this.sel = []; this.grafik = []; }
Lembar.prototype = {
  getLastRow() { return this.sel.length; }, getLastColumn() { return Math.max(0, ...this.sel.map(r => r.length)); },
  getRange(r, c, nr, nc) { const L = this; nr = nr || 1; nc = nc || 1; if (typeof r === 'string') { const m = r.match(/([A-Z])(\d+)/); c = m[1].charCodeAt(0) - 64; r = +m[2]; }
    return { setValue(v) { L._set(r, c, v); return this; }, setValues(v) { v.forEach((row, i) => row.forEach((x, j) => L._set(r + i, c + j, x))); return this; },
      getValues() { return Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => ((L.sel[r - 1 + i] || [])[c - 1 + j] ?? ''))); }, setFontWeight() { return this; }, setFontSize() { return this; } }; },
  _set(r, c, v) { while (this.sel.length < r) this.sel.push([]); const row = this.sel[r - 1]; while (row.length < c) row.push(''); row[c - 1] = v; },
  getDataRange() { return this.getRange(1, 1, this.getLastRow(), this.getLastColumn()); }, setFrozenRows() {}, clear() { this.sel = []; }, autoResizeColumns() {},
  getCharts() { return this.grafik.slice(); }, removeChart(c) { this.grafik.splice(this.grafik.indexOf(c), 1); }, insertChart(g) { this.grafik.push(g); }, newChart() { const o = { asColumnChart: () => o, addRange: () => o, setPosition: () => o, setOption: () => o, build: () => 'grafik' }; return o; }
};
const lembar = {}; const ss = { getSheetByName: n => lembar[n] || null, insertSheet: n => (lembar[n] = new Lembar(n)), getSheets: () => Object.values(lembar), deleteSheet: s => delete lembar[s.nama] };
const props = { SUPABASE_URL: 'https://fkynbegfeodymincuucy.supabase.co/rest/v1/', SUPABASE_ANON_KEY: 'anon', HSE_TOKEN: 'tokenrahasia-0123456789abcdef-0123456789' };
let gagalkanInspeksi = true;
const g = {
  SpreadsheetApp: { getActive: () => ss }, PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] }) },
  LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) },
  ScriptApp: { getProjectTriggers: () => [], newTrigger: () => ({ timeBased: () => ({ everyMinutes: () => ({ create() {} }) }) }) },
  Utilities: { formatDate: (d, z, f) => f === 'yyyy-MM-dd' ? new Date(d).toISOString().slice(0, 10) : new Date(d).toISOString() },
  UrlFetchApp: { fetch(url, o) {
    const fn = url.split('/rpc/')[1], isi = JSON.parse(o.payload);
    if (!url.startsWith('https://fkynbegfeodymincuucy.supabase.co/rest/v1/rpc/')) throw new Error('URL salah: ' + url);
    const q = fn === 'sinkron_ambil' ? `set role anon; select public.sinkron_ambil('${isi.p_token}', ${isi.p_batas});` : `set role anon; select public.sinkron_lapor('${isi.p_token}', '${JSON.stringify(isi.p_hasil).replace(/'/g, "''")}'::jsonb);`;
    const out = sql(q); return { getResponseCode: () => 200, getContentText: () => out };
  } }
};
new Function(...Object.keys(g), kode + '\n;this.pasang = pasang; this.sinkron = sinkron; this.TAB = TAB;').call(g, ...Object.values(g));
// Simulasi: satu baris inspeksi gagal ditulis (lembar Inspection terkunci)
const tulisAsli = Lembar.prototype.getRange;
sql("update sinkron_antrean set status='menunggu', percobaan=0");
const sebelum = sql("select count(*) from laporan");
lembar['Inspection'] = new Lembar('Inspection'); lembar['Inspection'].getRange = function () { const r = tulisAsli.apply(this, arguments); const sv = r.setValues; r.setValues = function (v) { if (gagalkanInspeksi) throw new Error('Lembar terkunci (simulasi)'); return sv.call(this, v); }; return r; };
g.pasang();
const cek = (b, m) => console.log((b ? 'LULUS ' : 'GAGAL ') + m);
cek(lembar['Risk Register'].getLastRow() - 1 === +sebelum, 'Risk Register berisi ' + (lembar['Risk Register'].getLastRow() - 1) + ' laporan (= ' + sebelum + ' di Supabase)');
cek(lembar['Near Miss'] && lembar['Near Miss'].getLastRow() === 2, 'laporan nyaris celaka juga masuk tab Near Miss');
cek(lembar['JSA'].getLastRow() === 2 && lembar['HSE Monitoring'].getLastRow() === 3 && lembar['Monthly Report'].getLastRow() === 2, 'JSA, HSE Monitoring, Monthly Report terisi');
cek(!lembar['Risk Register'].sel[0].includes('pelapor_id') && !lembar['Risk Register'].sel[0].includes('kode_lacak_hash'), 'tidak ada kolom identitas pelapor/kode lacak');
cek(sql("select status||':'||percobaan||':'||galat from sinkron_antrean where tabel='inspeksi'").startsWith('gagal:1:Lembar terkunci'), 'kegagalan Google tercatat di Supabase dengan pesan galat');
// Data berubah → disinkron ulang, tidak digandakan
sql("update laporan set lokasi='Lorong lantai 3'"); gagalkanInspeksi = false; sql("update sinkron_antrean set diproses_pada = now() - interval '1 hour' where status='gagal'");
g.sinkron();
const kep = lembar['Risk Register'].sel[0], iLok = kep.indexOf('lokasi');
cek(lembar['Risk Register'].getLastRow() - 1 === +sebelum && lembar['Risk Register'].sel[1][iLok] === 'Lorong lantai 3', 'perubahan diperbarui di baris yang sama (tanpa duplikasi)');
cek(lembar['Inspection'].getLastRow() === 2 && sql("select status from sinkron_antrean where tabel='inspeksi'") === 'terkirim', 'retry berhasil setelah Google pulih');
g.sinkron(); cek(lembar['Risk Register'].getLastRow() - 1 === +sebelum, 'sinkron berulang tanpa data baru tidak menambah baris');
cek(/Total laporan/.test(JSON.stringify(lembar['Dashboard'].sel)) && lembar['Dashboard'].grafik.length === 1, 'tab Dashboard dibangun dengan grafik');
cek(sql("select count(*) from sinkron_log") >= '2', 'log sinkronisasi tercatat');
