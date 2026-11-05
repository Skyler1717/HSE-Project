/* asisten.js — "Asisten K3": AI sederhana berbasis aturan yang berjalan DI DALAM HP.
   Tidak mengirim teks ke layanan luar mana pun (gratis, offline, privasi terjaga).
   Kemampuan: (1) saran kategori bahaya dari kata kunci, (2) penanda "mendesak",
   (3) penjaga privasi: mendeteksi & menyamarkan identitas pasien,
   (4) tanya-jawab bantuan, (5) suara: dikte (bicara→teks) dan bacakan (teks→suara).
   Semua saran WAJIB dikonfirmasi manusia; asisten tidak pernah memutuskan. */
(function () {
  'use strict';

  // Kamus kata kunci per kategori (bobot 1–3). Dapat diperluas tanpa mengubah logika.
  const KAMUS = {
    biologi: { jarum: 3, tertusuk: 3, 'tusuk jarum': 3, suntik: 2, darah: 3, 'cairan tubuh': 3, percikan: 2, muntah: 2,
      infeksi: 3, infeksius: 3, tbc: 3, tb: 2, virus: 2, bakteri: 2, kuman: 2, masker: 1, 'sarung tangan': 1,
      tikus: 2, kecoa: 2, nyamuk: 2, lalat: 2, kucing: 1, isolasi: 2, menular: 3 },
    kimia: { kimia: 3, b3: 3, tumpah: 2, tumpahan: 2, klorin: 3, kaporit: 3, formalin: 3, alkohol: 2,
      desinfektan: 3, reagen: 3, uap: 2, 'bau menyengat': 2, sitostatika: 3, sitotoksik: 3, merkuri: 3,
      'air raksa': 3, label: 1, msds: 3, lds: 2, asam: 2, solar: 2, bensin: 2, cat: 1, oli: 2 },
    fisik: { licin: 3, basah: 2, genangan: 3, tergenang: 3, bocor: 2, terpeleset: 3, tergelincir: 3,
      bising: 3, berisik: 2, panas: 2, pengap: 2, 'suhu': 2, radiasi: 3, rontgen: 2, gelap: 2,
      'lampu mati': 3, penerangan: 2, debu: 2, getaran: 2, tangga: 2, jatuh: 2, berlubang: 2, retak: 2 },
    ergonomi: { angkat: 3, mengangkat: 3, 'angkat pasien': 3, memindahkan: 2, punggung: 3, pinggang: 3,
      membungkuk: 3, 'berdiri lama': 3, 'duduk lama': 3, posisi: 1, pegal: 2, keseleo: 2, troli: 1,
      berat: 2, berulang: 2, kursi: 1, 'tanpa alat bantu': 2, mendorong: 2 },
    psikososial: { kekerasan: 3, dipukul: 3, memukul: 3, diancam: 3, ancaman: 3, dibentak: 3, membentak: 3,
      dimaki: 3, memaki: 3, marah: 2, perundungan: 3, bully: 3, dilecehkan: 3, pelecehan: 3, intimidasi: 3,
      'beban kerja': 3, lembur: 2, kelelahan: 2, lelah: 2, stres: 3, tertekan: 2, 'kurang tenaga': 2, 'jam kerja': 2 },
    mekanik: { kabel: 3, listrik: 3, kesetrum: 3, tersengat: 3, korsleting: 3, 'stop kontak': 3, colokan: 2,
      terkelupas: 3, percikan: 1, terjepit: 3, pintu: 1, lift: 2, rusak: 2, macet: 2, tajam: 2, terpotong: 3,
      tergores: 2, tersayat: 3, roda: 2, 'kursi roda': 2, 'tempat tidur': 1, bed: 1, mesin: 2, alat: 1, baut: 2 },
    kebakaran: { api: 3, kebakaran: 3, terbakar: 3, asap: 3, hangus: 3, gosong: 3, apar: 3, hidran: 3,
      evakuasi: 3, 'jalur evakuasi': 3, 'pintu darurat': 3, 'tabung oksigen': 3, oksigen: 2, gas: 2,
      'gas bocor': 3, ledakan: 3, meledak: 3, alarm: 2, gempa: 3, banjir: 2 },
    limbah: { limbah: 3, sampah: 2, 'sampah medis': 3, 'safety box': 3, 'kotak jarum': 3, 'kantong kuning': 3,
      'kantong hitam': 2, tps: 3, ipal: 3, tercampur: 2, tercecer: 2, penuh: 1, 'tempat sampah': 2, popok: 2 }
  };
  const KATA_MENDESAK = ['api', 'asap', 'kebakaran', 'terbakar', 'kesetrum', 'tersengat', 'gas bocor', 'ledakan',
    'meledak', 'pingsan', 'berdarah', 'patah', 'dipukul', 'diancam', 'senjata', 'tidak sadar', 'sesak', 'runtuh',
    'roboh', 'tertusuk', 'jatuh', 'darurat', 'sekarang', 'segera', 'bahaya sekali'];

  function normal(t) { return ' ' + String(t || '').toLowerCase().replace(/[^a-z0-9à-ÿ\s/-]/g, ' ').replace(/\s+/g, ' ') + ' '; }

  function sarankanKategori(teks) {
    const t = normal(teks); const skor = {}; const bukti = {};
    for (const [kat, kata] of Object.entries(KAMUS)) {
      for (const [k, b] of Object.entries(kata)) {
        if (t.includes(' ' + k + ' ') || (k.length >= 5 && t.includes(' ' + k))) {
          skor[kat] = (skor[kat] || 0) + b; (bukti[kat] = bukti[kat] || []).push(k);
        }
      }
    }
    const urut = Object.keys(skor).sort((a, b) => skor[b] - skor[a]);
    if (!urut.length) return null;
    const total = urut.reduce((s, k) => s + skor[k], 0);
    return {
      kategori: urut[0], kata: bukti[urut[0]].slice(0, 4),
      keyakinan: skor[urut[0]] >= 3 && skor[urut[0]] / total >= 0.6 ? 'cukup' : 'rendah',
      alternatif: urut[1] || null
    };
  }

  function cekMendesak(teks) {
    const t = normal(teks);
    const kena = KATA_MENDESAK.filter(k => t.includes(' ' + k + ' ') || t.includes(' ' + k));
    return { mendesak: kena.length > 0, kata: kena.slice(0, 3) };
  }

  // Penjaga privasi: pola identitas pasien (sama dengan pemeriksaan di server)
  const POLA_ID = [
    { jenis: 'NIK/angka 16 digit', re: /\d{16}/g },
    { jenis: 'Nomor rekam medis', re: /\b(no\.?|nomor)\s*(rm|rekam\s*medi[sk])\b[^,.;\n]*/gi },
    { jenis: 'Nomor rekam medis', re: /\brm\s*[:.#]?\s*\d{4,}/gi },
    { jenis: 'Nama dengan sapaan', re: /\b(tn|ny|nn|sdr|sdri)\.\s*[a-z][a-z]*(\s+[A-Z][a-z]+)?/gi },
    { jenis: 'Nama pasien', re: /pasien\s+(bernama|atas\s+nama|a\.\s*n\.)\s+[^\s,.;]+(\s+[A-Z][a-z]+)?/gi },
    { jenis: 'Nomor telepon', re: /\b(\+62|62|0)8\d{7,11}\b/g }
  ];
  function cekIdentitas(teks) {
    const temuan = [];
    POLA_ID.forEach(p => { const m = String(teks || '').match(p.re); if (m) m.forEach(x => temuan.push({ jenis: p.jenis, teks: x })); });
    return temuan;
  }
  function samarkan(teks) {
    let t = String(teks || '');
    POLA_ID.forEach(p => { t = t.replace(p.re, '[disamarkan]'); });
    return t;
  }

  // Tanya-jawab bantuan (pencocokan kata kunci; jawaban tetap, dapat diperiksa)
  const FAQ = [
    { k: ['anonim', 'tanpa nama', 'identitas', 'rahasia', 'takut', 'nama'], j: 'Nyalakan pilihan "Kirim tanpa nama". Nama Anda tidak disimpan bersama laporan; Anda mendapat KODE LACAK untuk melihat perkembangannya. Laporan tanpa nama tidak bisa memuat foto.' },
    { k: ['siapa', 'melihat', 'siapa yang', 'baca'], j: 'Laporan dengan nama: Anda, tim K3RS, dan penanggung jawab unit terkait. Nama pelapor tidak ditampilkan ke penanggung jawab unit. Laporan tanpa nama: tidak ada yang tahu pelapornya.' },
    { k: ['lacak', 'kode', 'status', 'perkembangan', 'kabar'], j: 'Buka menu "Laporan Saya". Untuk laporan tanpa nama, buka "Lacak dengan Kode" lalu masukkan kode lacak Anda.' },
    { k: ['foto', 'gambar', 'kamera'], j: 'Foto boleh ditambahkan (maks. 1 foto). Jangan memotret wajah pasien atau dokumen pasien. Foto diperkecil otomatis dan data lokasi di dalam foto dihapus.' },
    { k: ['sinyal', 'offline', 'internet', 'jaringan'], j: 'Jika sinyal lemah, laporan disimpan di HP dan dikirim otomatis ketika internet kembali. Tanda "Menunggu dikirim" akan terlihat di beranda.' },
    { k: ['darurat', 'kebakaran', 'api', 'pingsan', 'luka'], j: 'DARURAT? Selamatkan diri dan orang lain dulu, lalu hubungi nomor darurat rumah sakit. Aplikasi ini BUKAN alat panggilan darurat.' },
    { k: ['pasien', 'nik', 'rekam', 'medis'], j: 'Jangan menulis nama, NIK, atau nomor rekam medis pasien. Asisten akan memperingatkan dan menawarkan penyamaran otomatis.' },
    { k: ['tutup', 'selesai', 'tertutup'], j: 'Laporan berstatus "Tertutup" bila ada satu penanggung jawab, ada bukti perubahan, dan pengendaliannya pada tingkat fisik (eliminasi, substitusi, atau rekayasa). Bila baru APD/administratif, statusnya "Terkendali sementara".' },
    { k: ['kategori', 'jenis', 'bahaya', 'apa'], j: 'Ada 8 jenis: Biologi, Kimia/B3, Fisik, Ergonomi, Psikososial, Mekanik/Listrik, Kebakaran/Darurat, Limbah. Bingung? Ceritakan saja dengan suara, asisten memberi saran jenisnya.' },
    { k: ['sandi', 'password', 'lupa', 'masuk', 'login'], j: 'Lupa kata sandi? Hubungi admin K3RS untuk diatur ulang. Ganti kata sandi di menu "Akun".' },
    { k: ['cara', 'lapor', 'melapor', 'bagaimana'], j: 'Tekan tombol merah besar "LAPOR BAHAYA", pilih jenis bahaya (gambar), lalu tekan "KIRIM". Hanya 3 ketukan. Uraian dan foto boleh dikosongkan.' }
  ];
  function jawab(pertanyaan) {
    const t = normal(pertanyaan); let terbaik = null, skor = 0;
    FAQ.forEach(f => { const s = f.k.reduce((n, k) => n + (t.includes(' ' + k) ? (k.includes(' ') ? 3 : 1) : 0), 0); if (s > skor) { skor = s; terbaik = f; } });
    return terbaik ? terbaik.j : 'Maaf, saya belum mengerti. Coba tanyakan: "cara melapor", "laporan tanpa nama", "lacak laporan", atau "darurat".';
  }

  // Suara (Web Speech API, gratis di peramban; dukungan tergantung HP)
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  function bisaDengar() { return !!SR; }
  function dengar(onHasil, onSelesai, onGagal) {
    if (!SR) { onGagal && onGagal('Peramban ini belum mendukung input suara. Gunakan ikon mikrofon pada papan ketik HP.'); return null; }
    const r = new SR(); r.lang = 'id-ID'; r.interimResults = true; r.maxAlternatives = 1; r.continuous = false;
    let akhir = '';
    r.onresult = e => {
      let s = ''; for (let i = 0; i < e.results.length; i++) s += e.results[i][0].transcript;
      akhir = s; onHasil && onHasil(s, e.results[e.results.length - 1].isFinal);
    };
    r.onerror = e => { onGagal && onGagal(e.error === 'not-allowed' ? 'Izin mikrofon ditolak. Izinkan mikrofon di pengaturan peramban.' : 'Suara tidak tertangkap. Coba lagi.'); };
    r.onend = () => { onSelesai && onSelesai(akhir); };
    try { r.start(); } catch (e) { onGagal && onGagal('Mikrofon sedang dipakai. Coba lagi.'); }
    return r;
  }
  function bacakan(teks) {
    try {
      if (!('speechSynthesis' in window)) return;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(teks); u.lang = 'id-ID'; u.rate = 1;
      window.speechSynthesis.speak(u);
    } catch (e) { /* abaikan */ }
  }
  function artiJawabanYa(teks) {
    const t = normal(teks);
    if (/ (ya|iya|kirim|benar|betul|oke|ok|setuju) /.test(t)) return 'ya';
    if (/ (tidak|batal|jangan|ubah|ulang) /.test(t)) return 'tidak';
    return null;
  }

  window.K3Asisten = { sarankanKategori, cekMendesak, cekIdentitas, samarkan, jawab, bisaDengar, dengar, bacakan, artiJawabanYa, KAMUS };
})();
