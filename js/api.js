/* api.js — Lapisan data. Dua mode:
   (1) MODE SUPABASE: dipakai bila config.js berisi SUPABASE_URL dan SUPABASE_ANON_KEY.
       Semua aturan keamanan ditegakkan di server (RLS + fungsi), bukan di HP.
   (2) MODE DEMO: bila config.js masih kosong. Data CONTOH disimpan di HP ini saja,
       untuk mencoba tampilan sebelum basis data disiapkan. */
(function () {
  'use strict';
  const CFG = window.K3_CONFIG || {};
  const SUPABASE_JS = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js';
  const KOLOM_LAPORAN = 'id,nomor,jenis,kategori_kode,unit_id,lokasi,uraian,mendesak,anonim,dampak,kemungkinan,skor,status,pj_id,target_tanggal,level_pengendalian,foto_path,ai_kategori_saran,ai_saran_diterima,contoh,tanggal_lapor,dibuat_pada,diperbarui_pada,ditutup_pada';

  class GalatJaringan extends Error { constructor(m) { super(m || 'Tidak ada koneksi internet'); this.jaringan = true; } }

  function terjemahGalat(e) {
    const m = (e && (e.message || e.error_description || e.msg)) || String(e);
    if (/Failed to fetch|NetworkError|Load failed|network/i.test(m)) return new GalatJaringan();
    if (/Invalid login credentials/i.test(m)) return new Error('Email atau kata sandi salah.');
    if (/Email not confirmed/i.test(m)) return new Error('Email belum diverifikasi. Buka tautan di email Anda atau hubungi admin.');
    if (/JWT expired|invalid JWT/i.test(m)) return new Error('Sesi berakhir. Silakan masuk lagi.');
    if (/Invalid TOTP code|invalid.*code/i.test(m)) return new Error('Kode 6 angka salah atau kedaluwarsa. Coba kode terbaru.');
    if (/permission denied/i.test(m)) return new Error('Anda tidak berwenang melakukan ini.');
    if (/Password should be|weak/i.test(m)) return new Error('Kata sandi terlalu lemah. Pakai minimal 10 karakter: huruf besar, huruf kecil, dan angka.');
    return new Error(m.replace(/^.*?ERROR:\s*/, ''));
  }

  // ===================== MODE SUPABASE =====================
  function muatSkrip(src) {
    return new Promise((ok, gagal) => {
      if (window.supabase && window.supabase.createClient) return ok();
      const s = document.createElement('script'); s.src = src; s.crossOrigin = 'anonymous';
      s.onload = () => ok(); s.onerror = () => gagal(new GalatJaringan('Gagal memuat komponen basis data. Periksa internet.'));
      document.head.appendChild(s);
    });
  }

  function backendSupabase() {
    let sb = null;
    const cek = r => { if (r.error) throw terjemahGalat(r.error); return r.data; };
    const panggil = async (fn, arg) => { try { return cek(await sb.rpc(fn, arg || {})); } catch (e) { throw terjemahGalat(e); } };
    async function uid() { const { data } = await sb.auth.getSession(); return data.session ? data.session.user.id : null; }

    return {
      mode: 'supabase',
      async init() {
        await muatSkrip(SUPABASE_JS);
        sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY,
          { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });
      },
      async masuk(email, sandi) {
        try { cek(await sb.auth.signInWithPassword({ email: email.trim(), password: sandi })); }
        catch (e) { throw terjemahGalat(e); }
      },
      async keluar() { try { await sb.auth.signOut(); } catch (e) { /* tetap keluar lokal */ } },
      async sesi() {
        const { data } = await sb.auth.getSession();
        if (!data.session) return null;
        const user = data.session.user;
        const prof = cek(await sb.from('profil').select('id,nama_tampilan,peran,unit_id,aktif').eq('id', user.id).maybeSingle());
        let aal = { currentLevel: 'aal1', nextLevel: 'aal1' };
        try { aal = cek(await sb.auth.mfa.getAuthenticatorAssuranceLevel()); } catch (e) { /* lanjut */ }
        return { email: user.email, profil: prof, aal: aal.currentLevel, aalBerikut: aal.nextLevel };
      },
      async mfaFaktor() { const d = cek(await sb.auth.mfa.listFactors()); return (d.totp || []).filter(f => f.status === 'verified'); },
      async mfaDaftar() {
        const semua = cek(await sb.auth.mfa.listFactors());
        for (const f of (semua.all || [])) if (f.status !== 'verified') { try { await sb.auth.mfa.unenroll({ factorId: f.id }); } catch (e) { /* abaikan */ } }
        const d = cek(await sb.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'K3 ' + new Date().toISOString().slice(0, 16) }));
        return { factorId: d.id, qr: d.totp.qr_code, rahasia: d.totp.secret };
      },
      async mfaVerifikasi(factorId, kode) {
        try { cek(await sb.auth.mfa.challengeAndVerify({ factorId, code: String(kode).trim() })); }
        catch (e) { throw terjemahGalat(e); }
      },
      async gantiSandi(baru) { try { cek(await sb.auth.updateUser({ password: baru })); } catch (e) { throw terjemahGalat(e); } },
      ubahNama: n => panggil('ubah_nama_saya', { p_nama: n }),
      async referensi() {
        const [u, k, p] = await Promise.all([
          sb.from('unit').select('*').order('nama'), sb.from('kategori').select('*').order('urutan'),
          sb.from('pengaturan').select('*').eq('id', 1).maybeSingle()]);
        return { unit: cek(u), kategori: cek(k), pengaturan: cek(p) };
      },
      kirimLaporan: d => panggil('kirim_laporan', {
        p_jenis: d.jenis, p_kategori: d.kategori, p_unit: d.unit_id, p_uraian: d.uraian || '', p_lokasi: d.lokasi || '',
        p_mendesak: !!d.mendesak, p_anonim: !!d.anonim, p_foto_path: d.foto_path || null, p_kode_lacak: d.kode_lacak || null,
        p_ai_kategori: d.ai_kategori || null, p_ai_diterima: d.ai_diterima === undefined ? null : d.ai_diterima,
        p_id_klien: d.id_klien || null }),
      async unggahFoto(blob) {
        const id = await uid(); if (!id) throw new Error('Sesi berakhir');
        const path = id + '/' + crypto.randomUUID().replace(/-/g, '') + '.jpg';
        try { cek(await sb.storage.from('foto').upload(path, blob, { contentType: 'image/jpeg', upsert: false })); }
        catch (e) { throw terjemahGalat(e); }
        return path;
      },
      async urlFoto(path) { const d = cek(await sb.storage.from('foto').createSignedUrl(path, 300)); return d.signedUrl; },
      async daftarLaporan() {
        try { return cek(await sb.from('laporan').select(KOLOM_LAPORAN).order('dibuat_pada', { ascending: false }).limit(1000)); }
        catch (e) { throw terjemahGalat(e); }
      },
      async detailLaporan(id) {
        const [l, t, r] = await Promise.all([
          sb.from('laporan').select(KOLOM_LAPORAN).eq('id', id).maybeSingle(),
          sb.from('tindak_lanjut').select('*').eq('laporan_id', id).order('dibuat_pada'),
          sb.from('riwayat_status').select('id,dari,ke,catatan,pada').eq('laporan_id', id).order('pada')]);
        return { laporan: cek(l), tindak_lanjut: cek(t), riwayat: cek(r) };
      },
      async semuaTindakLanjut() { return cek(await sb.from('tindak_lanjut').select('*').order('dibuat_pada').limit(5000)); },
      async semuaRiwayat() { return cek(await sb.from('riwayat_status').select('id,laporan_id,dari,ke,catatan,pada').order('pada').limit(10000)); },
      async laporanSaya() { return ((await panggil('laporan_saya')) || []).map(x => (x && typeof x === 'object') ? Object.values(x)[0] : x); },
      cekKode: k => panggil('cek_kode_lacak', { p_kode: k }),
      tugaskan: (id, pj, target, d, p, cat) => panggil('tugaskan', { p_laporan: id, p_pj: pj, p_target: target, p_dampak: +d, p_kemungkinan: +p, p_catatan: cat || '' }),
      tambahTL: (id, uraian, level, buktiTeks, buktiFoto) => panggil('tambah_tindak_lanjut', { p_laporan: id, p_uraian: uraian, p_level: level, p_bukti_teks: buktiTeks || '', p_bukti_foto: buktiFoto || null }),
      ubahStatus: (id, ke, cat) => panggil('ubah_status', { p_laporan: id, p_ke: ke, p_catatan: cat || '' }),
      namaPelapor: id => panggil('nama_pelapor', { p_laporan: id }),
      statistik: () => panggil('statistik'),
      daftarPengguna: () => panggil('daftar_pengguna'),
      daftarPJ: () => panggil('daftar_pj'),
      aturPengguna: (id, peran, unit, aktif) => panggil('atur_pengguna', { p_id: id, p_peran: peran, p_unit: unit || null, p_aktif: !!aktif }),
      async simpanPengaturan(p) { cek(await sb.from('pengaturan').update(Object.assign({}, p, { diperbarui_pada: new Date().toISOString() })).eq('id', 1)); },
      async simpanUnit(u) {
        if (u.id) cek(await sb.from('unit').update({ nama: u.nama, aktif: u.aktif }).eq('id', u.id));
        else cek(await sb.from('unit').insert({ kode: u.kode, nama: u.nama }));
      },
      async simpanKategori(k) { cek(await sb.from('kategori').update({ nama: k.nama, contoh: k.contoh, aktif: k.aktif }).eq('kode', k.kode)); },
      async logAktivitas() { return cek(await sb.from('log_aktivitas').select('*').order('id', { ascending: false }).limit(2000)); },
      catatEkspor: j => panggil('catat_ekspor', { p_jenis: j }).catch(() => null)
    };
  }

  // ===================== MODE DEMO (data contoh di HP) =====================
  function backendDemo() {
    const KUNCI = 'k3demo_v1', KUNCI_SESI = 'k3demo_sesi';
    let db = null;
    const lokal = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    const hariIni = () => lokal(new Date());
    const tambahHari = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return lokal(d); };
    const simpan = () => { try { localStorage.setItem(KUNCI, JSON.stringify(db)); } catch (e) { /* penuh */ } };
    const sesiId = () => { try { return sessionStorage.getItem(KUNCI_SESI) || localStorage.getItem(KUNCI_SESI); } catch (e) { return null; } };
    const saya = () => db.profil.find(p => p.id === sesiId() && p.aktif) || null;
    const peran = () => (saya() || {}).peran || null;
    const k3rs = () => peran() === 'k3rs';
    const tolak = m => { throw new Error(m); };
    async function sha(t) { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t)); return Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2, '0')).join(''); }
    const ID_PASIEN = [/\d{16}/, /(no\.?|nomor)\s*(rm|rekam\s*medi[sk])/i, /\brm\s*[:.#]?\s*\d{4,}/i, /\b(tn|ny|nn|sdr|sdri)\.\s*[a-z]/i, /pasien\s+(bernama|atas\s+nama|a\.\s*n\.)/i];
    const adaIdPasien = t => ID_PASIEN.some(r => r.test(t || ''));
    function boleh(l) {
      const p = saya(); if (!p) return false;
      if (p.peran === 'k3rs') return true;
      if (p.peran === 'pj_unit') return l.unit_id === p.unit_id || l.pj_id === p.id || l.pelapor_id === p.id;
      return l.pelapor_id === p.id;
    }
    function bersih(l) { const c = Object.assign({}, l); delete c.pelapor_id; delete c.kode_lacak_hash; delete c.id_klien; return c; }
    function log(aksi, objek, id, ringkas, anon) { const p = saya(); db.log.unshift({ id: db.log.length + 1, pada: new Date().toISOString(), aktor: anon ? null : (p && p.id), peran: anon ? null : (p && p.peran), aksi, objek, objek_id: id, ringkas }); }
    function ubah(l, ke, catatan) {
      if (['ditugaskan', 'dalam_tindak_lanjut', 'terkendali_sementara', 'tertutup'].includes(ke) && (!l.pj_id || !l.target_tanggal)) tolak('Status ' + ke + ' memerlukan penanggung jawab dan tanggal target');
      const tls = db.tl.filter(t => t.laporan_id === l.id);
      if (ke === 'tertutup' && !tls.some(t => ['eliminasi', 'substitusi', 'rekayasa'].includes(t.level_pengendalian) && ((t.bukti_teks || '').trim().length >= 5 || t.bukti_foto_path)))
        tolak('Belum bisa ditutup: perlu tindak lanjut tingkat eliminasi/substitusi/rekayasa dengan bukti. Pengendalian administratif/APD memakai status "terkendali sementara".');
      if (ke === 'terkendali_sementara' && !tls.length) tolak('Status terkendali sementara memerlukan minimal satu tindak lanjut');
      const dari = l.status; l.status = ke; l.diperbarui_pada = new Date().toISOString();
      l.ditutup_pada = ke === 'tertutup' ? new Date().toISOString() : null;
      db.riwayat.push({ id: db.riwayat.length + 1, laporan_id: l.id, dari, ke, oleh: (saya() || {}).id, catatan: catatan || '', pada: new Date().toISOString() });
      log('laporan.status', 'laporan', l.nomor, dari + ' -> ' + ke);
    }
    function benih() {
      const unit = [['IGD', 'Instalasi Gawat Darurat'], ['RANAP', 'Rawat Inap'], ['RAJAL', 'Rawat Jalan'], ['ICU', 'ICU'], ['OK', 'Kamar Operasi'], ['LAB', 'Laboratorium'], ['RAD', 'Radiologi'], ['FARMASI', 'Farmasi'], ['GIZI', 'Gizi'], ['LAUNDRY', 'Laundry'], ['CSSD', 'CSSD'], ['IPSRS', 'IPSRS'], ['KESLING', 'Kesehatan Lingkungan'], ['HD', 'Hemodialisis']]
        .map((u, i) => ({ id: i + 1, kode: u[0], nama: u[1], aktif: true }));
      const kategori = [['biologi', 'Biologi', 'Tertusuk jarum, terpapar darah/cairan tubuh, risiko infeksi'], ['kimia', 'Kimia / B3', 'Bahan kimia tumpah, uap, label B3 hilang, desinfektan'], ['fisik', 'Fisik', 'Lantai licin, bising, panas, radiasi, penerangan kurang'], ['ergonomi', 'Ergonomi', 'Mengangkat pasien/beban berat, posisi kerja janggal'], ['psikososial', 'Psikososial', 'Kekerasan/ancaman, beban kerja berlebih, perundungan'], ['mekanik', 'Mekanik / Listrik', 'Kabel terkelupas, alat rusak, terjepit, benda tajam'], ['kebakaran', 'Kebakaran / Darurat', 'Bau hangus, APAR kosong, jalur evakuasi terhalang'], ['limbah', 'Limbah', 'Safety box penuh, sampah medis tercampur, limbah tercecer']]
        .map((k, i) => ({ kode: k[0], nama: k[1], contoh: k[2], urutan: i + 1, aktif: true }));
      const profil = [
        { id: 'demo-k3rs', email: 'k3rs@contoh.id', sandi: 'Demo-K3RS-2026', nama_tampilan: 'Admin K3RS (contoh)', peran: 'k3rs', unit_id: null, aktif: true, dibuat: hariIni() },
        { id: 'demo-pj', email: 'pj@contoh.id', sandi: 'Demo-PJ-2026', nama_tampilan: 'PJ Radiologi (contoh)', peran: 'pj_unit', unit_id: 7, aktif: true, dibuat: hariIni() },
        { id: 'demo-petugas', email: 'petugas@contoh.id', sandi: 'Demo-Petugas-2026', nama_tampilan: 'Petugas (contoh)', peran: 'petugas', unit_id: 7, aktif: true, dibuat: hariIni() },
        { id: 'demo-baru', email: 'baru@contoh.id', sandi: 'Demo-Baru-2026', nama_tampilan: 'Pendaftar baru (contoh)', peran: 'petugas', unit_id: null, aktif: false, dibuat: hariIni() }];
      db = { unit, kategori, profil, laporan: [], tl: [], riwayat: [], log: [], seq: 0,
        pengaturan: { id: 1, nama_instansi: 'Rumah Sakit Contoh', wajib_mfa_admin: false, hari_eskalasi: 2, nomor_darurat: '[ISI: nomor darurat internal]',
          pita_risiko: [{ maks: 4, label: 'Rendah' }, { maks: 9, label: 'Sedang' }, { maks: 14, label: 'Tinggi' }, { maks: 25, label: 'Sangat Tinggi' }] } };
      const contoh = [
        ['bahaya', 'fisik', 7, 'Lorong depan ruang tunggu', '[CONTOH] Lantai basah karena atap bocor saat hujan, belum ada rambu', true, 'tertutup', 4, 3, 'rekayasa', 'Atap ditambal dan talang diganti'],
        ['nyaris_celaka', 'biologi', 1, 'Ruang tindakan', '[CONTOH] Jarum bekas tertinggal di atas troli, hampir tertusuk', true, 'terkendali_sementara', 4, 3, 'administratif', 'Briefing ulang pembuangan jarum ke safety box'],
        ['bahaya', 'kimia', 6, 'Ruang reagen', '[CONTOH] Botol reagen tanpa label B3 di rak bawah', false, 'dalam_tindak_lanjut', 3, 3, 'administratif', 'Pelabelan ulang sedang berjalan'],
        ['bahaya', 'ergonomi', 2, 'Kamar perawatan', '[CONTOH] Memindahkan pasien tanpa alat bantu geser', false, 'ditugaskan', 3, 4],
        ['kejadian', 'psikososial', 1, 'Meja triase', '[CONTOH] Petugas dibentak dan diancam keluarga pengunjung', true, 'ditugaskan', 4, 3],
        ['bahaya', 'mekanik', 9, 'Dapur', '[CONTOH] Kabel blender terkelupas', false, 'baru'],
        ['bahaya', 'kebakaran', 12, 'Ruang panel listrik', '[CONTOH] Jalur evakuasi terhalang tumpukan kardus', true, 'baru'],
        ['bahaya', 'limbah', 2, 'Ruang perawat', '[CONTOH] Safety box sudah penuh lebih dari 3/4', false, 'tertutup', 3, 4, 'substitusi', 'Diganti safety box lebih besar dan jadwal angkut ditambah'],
        ['bahaya', 'fisik', 10, 'Area mesin cuci', '[CONTOH] Suara mesin sangat bising sepanjang shift', false, 'dalam_tindak_lanjut', 3, 4, 'apd', 'Penyediaan penutup telinga sementara'],
        ['nyaris_celaka', 'mekanik', 14, 'Ruang hemodialisis', '[CONTOH] Roda kursi pasien macet, hampir terjatuh', false, 'baru'],
        ['bahaya', 'kimia', 13, 'IPAL', '[CONTOH] Bau klorin menyengat di ruang dosing', false, 'ditugaskan', 3, 3]];
      contoh.forEach((c, i) => {
        const id = 'contoh-' + (i + 1), tgl = tambahHari(-(20 - i));
        const l = { id, nomor: 'CONTOH-' + String(i + 1).padStart(3, '0'), jenis: c[0], kategori_kode: c[1], unit_id: c[2], lokasi: c[3], uraian: c[4], mendesak: c[5], anonim: true,
          pelapor_id: null, dampak: c[7] || null, kemungkinan: c[8] || null, skor: c[7] ? c[7] * c[8] : null, status: 'baru', pj_id: null, target_tanggal: null,
          level_pengendalian: null, foto_path: null, contoh: true, tanggal_lapor: tgl, dibuat_pada: tgl + 'T00:00:00Z', diperbarui_pada: tgl + 'T00:00:00Z', ditutup_pada: null };
        db.laporan.push(l);
        db.riwayat.push({ id: db.riwayat.length + 1, laporan_id: id, dari: null, ke: 'baru', catatan: 'Laporan diterima', pada: l.dibuat_pada });
        if (c[6] === 'baru') return;
        l.pj_id = c[2] === 7 ? 'demo-pj' : 'demo-k3rs'; l.target_tanggal = tambahHari(i % 3 === 0 ? -2 : 5);
        db.riwayat.push({ id: db.riwayat.length + 1, laporan_id: id, dari: 'baru', ke: 'ditugaskan', catatan: '', pada: l.dibuat_pada }); l.status = 'ditugaskan';
        if (c[9]) {
          db.tl.push({ id: 'tl-' + id, laporan_id: id, oleh: l.pj_id, uraian: c[10], level_pengendalian: c[9], bukti_teks: '[CONTOH] Foto sebelum-sesudah disimpan di unit', bukti_foto_path: null, dibuat_pada: l.dibuat_pada });
          l.level_pengendalian = c[9]; l.status = 'dalam_tindak_lanjut';
          db.riwayat.push({ id: db.riwayat.length + 1, laporan_id: id, dari: 'ditugaskan', ke: 'dalam_tindak_lanjut', catatan: '', pada: l.dibuat_pada });
          if (c[6] !== 'dalam_tindak_lanjut') { db.riwayat.push({ id: db.riwayat.length + 1, laporan_id: id, dari: 'dalam_tindak_lanjut', ke: c[6], catatan: '', pada: l.dibuat_pada }); l.status = c[6]; if (c[6] === 'tertutup') l.ditutup_pada = l.dibuat_pada; }
        }
      });
      simpan();
    }

    return {
      mode: 'demo',
      async init() { try { db = JSON.parse(localStorage.getItem(KUNCI) || 'null'); } catch (e) { db = null; } if (!db) benih(); },
      reset() { try { localStorage.removeItem(KUNCI); } catch (e) { /* */ } benih(); },
      akunDemo() { return db.profil.filter(p => p.aktif).map(p => ({ email: p.email, sandi: p.sandi, peran: p.peran })); },
      async masuk(email, sandi) {
        const p = db.profil.find(x => x.email === String(email).trim().toLowerCase() && x.sandi === sandi);
        if (!p) tolak('Email atau kata sandi salah.');
        try { sessionStorage.setItem(KUNCI_SESI, p.id); localStorage.setItem(KUNCI_SESI, p.id); } catch (e) { /* */ }
      },
      async keluar() { try { sessionStorage.removeItem(KUNCI_SESI); localStorage.removeItem(KUNCI_SESI); } catch (e) { /* */ } },
      async sesi() {
        const id = sesiId(); const p = db.profil.find(x => x.id === id); if (!p) return null;
        return { email: p.email, profil: { id: p.id, nama_tampilan: p.nama_tampilan, peran: p.peran, unit_id: p.unit_id, aktif: p.aktif }, aal: 'aal2', aalBerikut: 'aal2' };
      },
      async mfaFaktor() { return [{ id: 'demo' }]; },
      async mfaDaftar() { tolak('MFA tidak tersedia di mode demo'); },
      async mfaVerifikasi() { },
      async gantiSandi(baru) { const p = saya(); if (p) { p.sandi = baru; simpan(); } },
      async ubahNama(n) { const p = saya(); if (p) { p.nama_tampilan = String(n).slice(0, 80); simpan(); } },
      async referensi() { return { unit: db.unit, kategori: db.kategori, pengaturan: db.pengaturan }; },
      async kirimLaporan(d) {
        if (!navigator.onLine) throw new GalatJaringan();
        const p = saya(); if (!p) tolak('Akun belum aktif. Hubungi admin K3RS.');
        if (d.id_klien) { const ada = db.laporan.find(l => l.id_klien === d.id_klien); if (ada) return { nomor: ada.nomor, duplikat: true }; }
        if (adaIdPasien((d.uraian || '') + ' ' + (d.lokasi || ''))) tolak('Teks tampak memuat identitas pasien (nama/NIK/No. RM). Hapus dulu, lalu kirim ulang.');
        if (d.anonim && d.foto_path) tolak('Laporan anonim tidak dapat memuat foto');
        if ((d.uraian || '').length > 1000 || (d.lokasi || '').length > 120) tolak('Teks terlalu panjang');
        db.seq++; const now = new Date().toISOString();
        const nomor = 'K3-' + hariIni().slice(2).replace(/-/g, '') + '-' + String(db.seq).padStart(4, '0');
        const l = { id: crypto.randomUUID(), nomor, jenis: d.jenis, kategori_kode: d.kategori, unit_id: +d.unit_id, lokasi: (d.lokasi || '').trim(), uraian: (d.uraian || '').trim(),
          mendesak: !!d.mendesak, anonim: !!d.anonim, pelapor_id: d.anonim ? null : p.id, kode_lacak_hash: d.anonim ? await sha(String(d.kode_lacak).replace(/[^A-Za-z0-9]/g, '').toUpperCase()) : null,
          id_klien: d.id_klien || null, dampak: null, kemungkinan: null, skor: null, status: 'baru', pj_id: null, target_tanggal: null, level_pengendalian: null,
          foto_path: d.anonim ? null : (d.foto_path || null), ai_kategori_saran: d.ai_kategori || null, ai_saran_diterima: d.ai_diterima === undefined ? null : d.ai_diterima,
          contoh: false, tanggal_lapor: hariIni(), dibuat_pada: d.anonim ? hariIni() + 'T00:00:00Z' : now, diperbarui_pada: now, ditutup_pada: null };
        db.laporan.unshift(l);
        db.riwayat.push({ id: db.riwayat.length + 1, laporan_id: l.id, dari: null, ke: 'baru', oleh: null, catatan: 'Laporan diterima', pada: l.dibuat_pada });
        log('laporan.kirim', 'laporan', nomor, 'kategori=' + d.kategori + (d.anonim ? '; anonim' : ''), d.anonim);
        simpan(); return { nomor, duplikat: false };
      },
      async unggahFoto(blob) {
        if (!navigator.onLine) throw new GalatJaringan();
        const p = saya(); const path = p.id + '/' + crypto.randomUUID().replace(/-/g, '') + '.jpg';
        const url = await new Promise(ok => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(blob); });
        try { localStorage.setItem('k3demo_foto_' + path, url); } catch (e) { tolak('Memori HP untuk foto demo penuh'); }
        return path;
      },
      async urlFoto(path) { try { return localStorage.getItem('k3demo_foto_' + path); } catch (e) { return null; } },
      async daftarLaporan() { return db.laporan.filter(boleh).map(bersih); },
      async detailLaporan(id) {
        const l = db.laporan.find(x => x.id === id); if (!l || !boleh(l)) return { laporan: null, tindak_lanjut: [], riwayat: [] };
        return { laporan: bersih(l), tindak_lanjut: db.tl.filter(t => t.laporan_id === id), riwayat: db.riwayat.filter(r => r.laporan_id === id).map(({ oleh, ...r }) => r) };
      },
      async semuaTindakLanjut() { const ids = new Set(db.laporan.filter(boleh).map(l => l.id)); return db.tl.filter(t => ids.has(t.laporan_id)); },
      async semuaRiwayat() { const ids = new Set(db.laporan.filter(boleh).map(l => l.id)); return db.riwayat.filter(t => ids.has(t.laporan_id)).map(({ oleh, ...r }) => r); },
      async laporanSaya() { const p = saya(); return p ? db.laporan.filter(l => l.pelapor_id === p.id).map(l => l.id) : []; },
      async cekKode(kode) {
        if (!saya()) tolak('Akun belum aktif');
        const h = await sha(String(kode || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase());
        const l = db.laporan.find(x => x.kode_lacak_hash === h); if (!l) return null;
        return { nomor: l.nomor, status: l.status, tanggal_lapor: l.tanggal_lapor, kategori: (db.kategori.find(k => k.kode === l.kategori_kode) || {}).nama,
          unit: (db.unit.find(u => u.id === l.unit_id) || {}).nama,
          riwayat: db.riwayat.filter(r => r.laporan_id === l.id).map(r => ({ ke: r.ke, tanggal: r.pada.slice(0, 10) })),
          tindak_lanjut: db.tl.filter(t => t.laporan_id === l.id).map(t => ({ tanggal: t.dibuat_pada.slice(0, 10), level: t.level_pengendalian, uraian: t.uraian })) };
      },
      async tugaskan(id, pj, target, d, p, cat) {
        if (!k3rs()) tolak('Hanya K3RS (dengan MFA) yang dapat menugaskan');
        const l = db.laporan.find(x => x.id === id); if (!l) tolak('Laporan tidak ditemukan');
        if (['tertutup', 'tidak_dilanjutkan'].includes(l.status)) tolak('Laporan sudah selesai; buka kembali dulu');
        if (!db.profil.some(x => x.id === pj && x.aktif && ['pj_unit', 'k3rs'].includes(x.peran))) tolak('Penanggung jawab harus akun PJ unit atau K3RS yang aktif');
        if (!target || target < hariIni()) tolak('Tanggal target wajib dan tidak boleh lampau');
        if (!(d >= 1 && d <= 5 && p >= 1 && p <= 5)) tolak('Dampak dan kemungkinan bernilai 1–5');
        Object.assign(l, { pj_id: pj, target_tanggal: target, dampak: +d, kemungkinan: +p, skor: d * p, diperbarui_pada: new Date().toISOString() });
        if (l.status === 'baru') ubah(l, 'ditugaskan', cat);
        log('laporan.tugaskan', 'laporan', l.nomor, 'target=' + target); simpan();
      },
      async tambahTL(id, uraian, level, buktiTeks, buktiFoto) {
        const l = db.laporan.find(x => x.id === id); if (!l) tolak('Laporan tidak ditemukan');
        const p = saya(); if (!(k3rs() || (p.peran === 'pj_unit' && l.pj_id === p.id))) tolak('Hanya penanggung jawab yang ditugaskan atau K3RS');
        if (['baru', 'tertutup', 'tidak_dilanjutkan'].includes(l.status)) tolak('Tindak lanjut hanya untuk laporan yang sudah ditugaskan dan belum selesai');
        if ((uraian || '').trim().length < 5) tolak('Uraian tindak lanjut minimal 5 huruf');
        if (adaIdPasien(uraian + ' ' + (buktiTeks || ''))) tolak('Teks tampak memuat identitas pasien. Hapus dulu.');
        db.tl.push({ id: crypto.randomUUID(), laporan_id: id, oleh: p.id, uraian: uraian.trim(), level_pengendalian: level, bukti_teks: (buktiTeks || '').trim(), bukti_foto_path: buktiFoto || null, dibuat_pada: new Date().toISOString() });
        l.level_pengendalian = level; if (l.status === 'ditugaskan') ubah(l, 'dalam_tindak_lanjut', '');
        log('tindak_lanjut.tambah', 'laporan', l.nomor, 'level=' + level); simpan();
      },
      async ubahStatus(id, ke, cat) {
        const l = db.laporan.find(x => x.id === id); if (!l) tolak('Laporan tidak ditemukan');
        const p = saya(); cat = (cat || '').trim();
        if (ke === 'terkendali_sementara') { if (!(k3rs() || (p.peran === 'pj_unit' && l.pj_id === p.id))) tolak('Tidak berwenang'); if (l.status !== 'dalam_tindak_lanjut') tolak('Hanya dari status dalam tindak lanjut'); }
        else if (ke === 'tertutup') { if (!k3rs()) tolak('Penutupan diverifikasi oleh K3RS'); if (!['dalam_tindak_lanjut', 'terkendali_sementara'].includes(l.status)) tolak('Belum ada tindak lanjut'); }
        else if (ke === 'tidak_dilanjutkan') { if (!k3rs()) tolak('Tidak berwenang'); if (!['baru', 'ditugaskan'].includes(l.status)) tolak('Hanya untuk laporan baru/ditugaskan'); if (cat.length < 5) tolak('Tulis alasan (min. 5 huruf)'); }
        else if (ke === 'dalam_tindak_lanjut') { if (!k3rs()) tolak('Tidak berwenang'); if (!['tertutup', 'terkendali_sementara', 'tidak_dilanjutkan'].includes(l.status)) tolak('Hanya untuk membuka kembali'); if (cat.length < 5) tolak('Tulis alasan membuka kembali'); }
        else tolak('Perubahan status ini dilakukan lewat penugasan');
        ubah(l, ke, cat); simpan();
      },
      async namaPelapor(id) {
        if (!k3rs()) tolak('Hanya K3RS'); const l = db.laporan.find(x => x.id === id);
        if (!l || l.anonim || !l.pelapor_id) return '(anonim)';
        log('identitas.lihat', 'laporan', l.nomor, 'K3RS melihat nama pelapor'); simpan();
        return (db.profil.find(p => p.id === l.pelapor_id) || {}).nama_tampilan;
      },
      async statistik() {
        const p = saya(); if (!p || p.peran === 'petugas') tolak('Tidak berwenang');
        const L = db.laporan.filter(l => p.peran === 'k3rs' || l.unit_id === p.unit_id || l.pj_id === p.id);
        const hit = (arr, f) => arr.reduce((o, x) => { const k = f(x); o[k] = (o[k] || 0) + 1; return o; }, {});
        const pita = db.pengaturan.pita_risiko.slice().sort((a, b) => a.maks - b.maks);
        const tingkat = l => l.skor == null ? 'Belum dinilai' : (pita.find(x => l.skor <= x.maks) || {}).label;
        const daftar = (o, nama) => Object.entries(o).map(([k, n]) => ({ label: nama(k), n })).sort((a, b) => b.n - a.n);
        const nTL = id => db.tl.filter(t => t.laporan_id === id).length, today = hariIni();
        const batas = tambahHari(-db.pengaturan.hari_eskalasi);
        return {
          total: L.length, per_status: hit(L, l => l.status),
          per_kategori: daftar(hit(L, l => l.kategori_kode), k => (db.kategori.find(x => x.kode === k) || {}).nama),
          per_unit: daftar(hit(L, l => l.unit_id), k => (db.unit.find(x => String(x.id) === String(k)) || {}).nama),
          per_tingkat: hit(L, tingkat), per_level: hit(L, l => l.level_pengendalian || 'belum'), per_jenis: hit(L, l => l.jenis),
          titik_putus: { a_belum_ditugaskan: L.filter(l => l.status === 'baru').length, b_belum_ditindaklanjuti: L.filter(l => l.status === 'ditugaskan' && !nTL(l.id)).length,
            c_belum_ditutup: L.filter(l => l.status === 'dalam_tindak_lanjut').length, d_terkendali_sementara: L.filter(l => l.status === 'terkendali_sementara').length,
            d_tertutup: L.filter(l => l.status === 'tertutup').length, tidak_dilanjutkan: L.filter(l => l.status === 'tidak_dilanjutkan').length },
          kesenjangan: { tanpa_pj: L.filter(l => !l.pj_id && l.status !== 'tidak_dilanjutkan').length, tanpa_target: L.filter(l => !l.target_tanggal && l.status !== 'tidak_dilanjutkan').length,
            tanpa_skor: L.filter(l => l.skor == null && l.status !== 'tidak_dilanjutkan').length, hanya_adm_apd: L.filter(l => ['administratif', 'apd'].includes(l.level_pengendalian)).length },
          terlambat: L.filter(l => l.target_tanggal && l.target_tanggal < today && ['ditugaskan', 'dalam_tindak_lanjut'].includes(l.status)).length,
          mendesak_terbuka: L.filter(l => l.mendesak && ['baru', 'ditugaskan', 'dalam_tindak_lanjut'].includes(l.status)).length,
          baru_lewat_eskalasi: L.filter(l => l.status === 'baru' && l.tanggal_lapor <= batas).length,
          ai: { dengan_saran: L.filter(l => l.ai_kategori_saran).length, diterima: L.filter(l => l.ai_saran_diterima).length }
        };
      },
      async daftarPengguna() { if (!k3rs()) tolak('Hanya K3RS'); return db.profil.map(p => ({ id: p.id, email: p.email, nama: p.nama_tampilan, peran: p.peran, unit_id: p.unit_id, aktif: p.aktif, dibuat: p.dibuat })); },
      async daftarPJ() { if (!k3rs()) tolak('Hanya K3RS'); return db.profil.filter(p => p.aktif && ['pj_unit', 'k3rs'].includes(p.peran)).map(p => ({ id: p.id, nama: p.nama_tampilan, peran: p.peran, unit_id: p.unit_id })); },
      async aturPengguna(id, peranBaru, unit, aktif) {
        if (!k3rs()) tolak('Hanya K3RS'); if (id === saya().id) tolak('Tidak dapat mengubah peran/status akun sendiri');
        if (peranBaru === 'pj_unit' && !unit) tolak('PJ unit wajib memiliki unit');
        const p = db.profil.find(x => x.id === id); Object.assign(p, { peran: peranBaru, unit_id: unit ? +unit : null, aktif: !!aktif });
        log('pengguna.atur', 'profil', id, 'peran=' + peranBaru + '; aktif=' + aktif); simpan();
      },
      async simpanPengaturan(p) { if (!k3rs()) tolak('Hanya K3RS'); Object.assign(db.pengaturan, p); simpan(); },
      async simpanUnit(u) {
        if (!k3rs()) tolak('Hanya K3RS');
        if (u.id) Object.assign(db.unit.find(x => x.id === u.id), { nama: u.nama, aktif: u.aktif });
        else { if (!/^[A-Z0-9_-]{2,20}$/.test(u.kode)) tolak('Kode unit 2–20 huruf besar/angka'); if (db.unit.some(x => x.kode === u.kode)) tolak('Kode unit sudah ada'); db.unit.push({ id: Math.max(...db.unit.map(x => x.id)) + 1, kode: u.kode, nama: u.nama, aktif: true }); }
        simpan();
      },
      async simpanKategori(k) { if (!k3rs()) tolak('Hanya K3RS'); Object.assign(db.kategori.find(x => x.kode === k.kode), { nama: k.nama, contoh: k.contoh, aktif: k.aktif }); simpan(); },
      async logAktivitas() { if (!k3rs()) tolak('Hanya K3RS'); return db.log; },
      async catatEkspor(j) { log('ekspor', 'data', '', j); simpan(); }
    };
  }

  const pakaiSupabase = !!(CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY) && !/[?&]demo=1/.test(location.search);
  window.K3Api = pakaiSupabase ? backendSupabase() : backendDemo();
  window.K3Api.GalatJaringan = GalatJaringan;
})();
