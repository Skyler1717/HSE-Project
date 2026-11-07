/* intel.js — Mesin HSE Intelligence (berjalan di peramban, tanpa layanan berbayar).
   Isi: basis pengetahuan bahaya + hierarki pengendalian, deteksi bahaya dari teks (rule-based),
   penentuan shift (zona waktu RS), pengurai kueri bahasa Indonesia untuk Pencarian Cerdas,
   statistik deskriptif & epidemiologi (tren, distribusi, deteksi lonjakan berbasis Poisson),
   estimasi risiko berbasis frekuensi historis, serta aturan risiko berbasis cuaca (Open-Meteo).
   Semua angka dihitung dari data yang boleh dilihat pengguna (data diambil dengan sesi pengguna,
   sehingga RLS Supabase tetap berlaku). Mesin ini TIDAK memprediksi kecelakaan secara pasti. */
(function (root) {
  'use strict';

  // ---------- 1. Basis pengetahuan bahaya ----------
  // keparahan: 1 ringan … 5 fatal. kategori: kode kategori aplikasi yang paling dekat.
  const BAHAYA = {
    ketinggian: {
      judul: 'Bekerja di ketinggian', ilustrasi: 'ketinggian', kategori: 'fisik', keparahan: 5, luar: true,
      kata: ['ketinggian', 'tangga', 'atap', 'plafon', 'scaffold', 'perancah', 'genteng', 'talang', 'lantai atas', 'menara', 'tower', 'gondola', 'naik ke', 'memanjat', 'lift barang', 'reservoir'],
      skenario: ['Pekerja terjatuh dari tangga/perancah', 'Benda atau alat kerja jatuh menimpa orang di bawah', 'Tangga tergelincir di lantai licin'],
      dampak: [['Memar dan keseleo', 2], ['Patah tulang', 4], ['Cedera kepala dan tulang belakang', 5], ['Kematian (fatality)', 5]],
      kontrol: {
        eliminasi: ['Kerjakan dari permukaan tanah (alat bergagang panjang, pemasangan di bawah lalu diangkat)'],
        substitusi: ['Ganti tangga biasa dengan platform kerja beragang (MEWP) atau perancah bersertifikat'],
        rekayasa: ['Pasang pagar pengaman (guardrail) dan penutup lubang', 'Titik jangkar (anchor) bersertifikat', 'Jaring pengaman dan toe-board untuk benda jatuh'],
        administratif: ['Izin kerja di ketinggian (work permit) dan JSA sebelum mulai', 'Sistem dua orang (buddy) dan pengawas', 'Tutup area di bawah dengan barikade dan rambu', 'Hentikan pekerjaan luar saat hujan, angin kencang, atau petir'],
        apd: ['Full body harness dengan lanyard ganda dan shock absorber', 'Helm dengan tali dagu', 'Sepatu keselamatan antislip']
      }
    },
    listrik: {
      judul: 'Bahaya listrik', ilustrasi: 'listrik', kategori: 'mekanik', keparahan: 5,
      kata: ['listrik', 'kabel', 'panel', 'mcb', 'stop kontak', 'colokan', 'korsleting', 'konslet', 'kesetrum', 'tersengat', 'genset', 'trafo', 'tegangan', 'instalasi listrik', 'terkelupas', 'ups'],
      skenario: ['Tersengat listrik saat menyentuh kabel terkelupas', 'Busur api (arc flash) saat membuka panel bertegangan', 'Korsleting memicu kebakaran'],
      dampak: [['Luka bakar listrik', 4], ['Gangguan irama jantung', 5], ['Kebakaran', 5], ['Kematian (fatality)', 5]],
      kontrol: {
        eliminasi: ['Matikan sumber listrik (de-energize) sebelum bekerja'],
        substitusi: ['Gunakan peralatan bertegangan rendah atau berbaterai di area basah'],
        rekayasa: ['Pasang ELCB/RCD (pemutus arus bocor)', 'Ganti kabel rusak dan tutup panel dengan pengunci', 'Pembumian (grounding) yang diperiksa berkala'],
        administratif: ['Prosedur LOTO (lockout–tagout)', 'Hanya teknisi berkompeten/berizin', 'Inspeksi instalasi berkala dan label "Bahaya Listrik"'],
        apd: ['Sarung tangan isolasi sesuai kelas tegangan', 'Sepatu isolasi', 'Pelindung wajah arc flash']
      }
    },
    kimia: {
      judul: 'Paparan bahan kimia / B3', ilustrasi: 'kimia', kategori: 'kimia', keparahan: 4,
      kata: ['kimia', 'b3', 'klorin', 'kaporit', 'formalin', 'alkohol', 'desinfektan', 'reagen', 'uap', 'tumpah', 'tumpahan', 'sitostatika', 'sitotoksik', 'merkuri', 'asam', 'solar', 'bensin', 'cat', 'thinner', 'glutaraldehid', 'msds', 'lds'],
      skenario: ['Terhirup uap kimia di ruang tertutup', 'Percikan ke mata atau kulit saat menuang', 'Salah pakai karena wadah tanpa label'],
      dampak: [['Iritasi kulit dan mata', 2], ['Gangguan pernapasan', 3], ['Luka bakar kimia', 4], ['Keracunan berat', 5]],
      kontrol: {
        eliminasi: ['Hentikan pemakaian bahan yang tidak perlu'],
        substitusi: ['Ganti dengan bahan kurang berbahaya (mis. desinfektan berbasis non-aldehid)'],
        rekayasa: ['Lemari asam / ventilasi keluar setempat (LEV)', 'Wadah tertutup dan bak penampung tumpahan', 'Eyewash dan safety shower dekat area kerja'],
        administratif: ['Label B3 dan Lembar Data Keselamatan (LDK/SDS) tersedia', 'Pelatihan penanganan tumpahan (spill kit)', 'Batasi jumlah bahan di ruang kerja'],
        apd: ['Sarung tangan tahan kimia sesuai jenis bahan', 'Kacamata/face shield', 'Masker respirator sesuai paparan', 'Apron tahan kimia']
      }
    },
    kebakaran: {
      judul: 'Kebakaran', ilustrasi: 'api', kategori: 'kebakaran', keparahan: 5,
      kata: ['api', 'kebakaran', 'terbakar', 'asap', 'hangus', 'gosong', 'apar', 'hidran', 'jalur evakuasi', 'pintu darurat', 'mudah terbakar', 'oksigen', 'tabung gas', 'lpg', 'kompor', 'las', 'pengelasan', 'gerinda'],
      skenario: ['Api menjalar dari korsleting atau pekerjaan panas (las/gerinda)', 'Evakuasi terhambat karena jalur darurat terhalang', 'Kebakaran diperkuat oksigen medis'],
      dampak: [['Menghirup asap', 3], ['Luka bakar', 4], ['Korban massal saat evakuasi', 5], ['Kematian (fatality)', 5]],
      kontrol: {
        eliminasi: ['Singkirkan bahan mudah terbakar dari sumber panas'],
        substitusi: ['Ganti metode panas dengan metode dingin (mis. baut/klem, bukan las)'],
        rekayasa: ['Detektor asap dan sprinkler berfungsi', 'Pintu tahan api tertutup otomatis', 'APAR dan hidran sesuai kelas kebakaran'],
        administratif: ['Izin kerja panas (hot work permit) dan penjaga api', 'Jalur evakuasi bebas hambatan, diperiksa tiap shift', 'Simulasi kebakaran berkala', 'Kode darurat RS diketahui semua petugas'],
        apd: ['Pakaian kerja tahan api untuk pekerjaan panas', 'Masker evakuasi (escape hood) di area kritis']
      }
    },
    ledakan: {
      judul: 'Ledakan / bejana bertekanan', ilustrasi: 'ledakan', kategori: 'kebakaran', keparahan: 5,
      kata: ['ledakan', 'meledak', 'tabung', 'bejana tekan', 'boiler', 'autoclave', 'kompresor', 'gas medis', 'tekanan tinggi', 'regulator', 'bocor gas'],
      skenario: ['Tabung gas jatuh dan katup patah', 'Boiler/autoclave melebihi tekanan kerja', 'Kebocoran gas tersulut percikan'],
      dampak: [['Cedera akibat serpihan', 4], ['Luka bakar', 4], ['Kematian (fatality)', 5]],
      kontrol: {
        eliminasi: ['Kosongkan tekanan sebelum perawatan'],
        substitusi: ['Gunakan sistem gas sentral daripada tabung lepas di ruang kerja'],
        rekayasa: ['Rantai/rak pengikat tabung', 'Katup pengaman (safety valve) teruji', 'Detektor kebocoran gas'],
        administratif: ['Riksa uji bejana tekan berkala (berizin)', 'Operator bersertifikat', 'Larangan sumber api di area gas'],
        apd: ['Pelindung wajah dan sarung tangan saat menangani tabung']
      }
    },
    tertimpa: {
      judul: 'Tertimpa / terbentur benda', ilustrasi: 'tertimpa', kategori: 'mekanik', keparahan: 4,
      kata: ['tertimpa', 'jatuh dari rak', 'rak', 'tumpukan', 'material', 'angkat beban', 'crane', 'hoist', 'plafon runtuh', 'kardus', 'lemari', 'benda jatuh', 'terbentur'],
      skenario: ['Barang dari rak tinggi jatuh menimpa kepala', 'Tumpukan material roboh', 'Plafon/lampu jatuh'],
      dampak: [['Memar', 2], ['Cedera kepala', 4], ['Patah tulang', 4]],
      kontrol: {
        eliminasi: ['Jangan menyimpan barang berat di rak atas'],
        substitusi: ['Gunakan wadah lebih kecil/ringan'],
        rekayasa: ['Rak diangkur ke dinding dan diberi bibir pengaman', 'Batas tinggi tumpukan ditandai'],
        administratif: ['Penataan 5R gudang', 'Inspeksi rak dan plafon berkala'],
        apd: ['Helm di gudang/area konstruksi', 'Sepatu keselamatan']
      }
    },
    terjepit: {
      judul: 'Terjepit / bagian mesin bergerak', ilustrasi: 'terjepit', kategori: 'mekanik', keparahan: 4,
      kata: ['terjepit', 'mesin', 'mesin cuci', 'pintu lift', 'roda', 'conveyor', 'gerinda', 'blender', 'pisau', 'tajam', 'terpotong', 'tersayat', 'pompa', 'bergerak', 'pintu otomatis', 'bed', 'tempat tidur'],
      skenario: ['Tangan masuk ke bagian mesin yang berputar', 'Jari terjepit pintu atau rangka tempat tidur', 'Tersayat bilah tajam'],
      dampak: [['Luka sayat', 2], ['Jari remuk', 4], ['Amputasi', 5]],
      kontrol: {
        eliminasi: ['Matikan dan kunci mesin saat membersihkan/memperbaiki'],
        substitusi: ['Gunakan alat dengan bilah tersembunyi/otomatis'],
        rekayasa: ['Pelindung mesin (machine guarding) dan sakelar interlock', 'Tombol henti darurat mudah dijangkau'],
        administratif: ['Prosedur LOTO dan pelatihan operator', 'Larangan perhiasan/pakaian longgar di dekat mesin'],
        apd: ['Sarung tangan tahan potong (bukan untuk mesin berputar)', 'Kacamata pengaman']
      }
    },
    panas: {
      judul: 'Tekanan panas (heat stress)', ilustrasi: 'panas', kategori: 'fisik', keparahan: 4, luar: true,
      kata: ['panas', 'gerah', 'pengap', 'suhu tinggi', 'dapur', 'boiler', 'laundry', 'incinerator', 'insinerator', 'terik', 'dehidrasi', 'pingsan', 'luar ruangan', 'outdoor', 'lapangan', 'parkir'],
      skenario: ['Bekerja lama di ruang panas tanpa istirahat', 'Kurang minum saat bekerja di bawah terik'],
      dampak: [['Dehidrasi dan kram panas', 2], ['Kelelahan panas (heat exhaustion)', 3], ['Sengatan panas (heat stroke)', 5]],
      kontrol: {
        eliminasi: ['Jadwalkan pekerjaan berat ke jam yang lebih sejuk'],
        substitusi: ['Gunakan alat mekanis untuk mengurangi beban fisik'],
        rekayasa: ['Ventilasi, kipas, peneduh, dan penyekat panas', 'Ruang istirahat sejuk'],
        administratif: ['Siklus kerja–istirahat sesuai ISBB', 'Air minum tersedia, minum tiap 15–20 menit', 'Aklimatisasi pekerja baru', 'Kenali gejala heat stroke dan pertolongan pertama'],
        apd: ['Pakaian kerja ringan berwarna terang', 'Topi/pelindung kepala untuk kerja luar']
      }
    },
    bising: {
      judul: 'Kebisingan', ilustrasi: 'bising', kategori: 'fisik', keparahan: 3,
      kata: ['bising', 'berisik', 'kebisingan', 'genset', 'mesin cuci', 'kompresor', 'gerinda', 'desibel', 'dba', 'suara keras'],
      skenario: ['Bekerja di dekat genset/laundry sepanjang shift tanpa pelindung telinga'],
      dampak: [['Gangguan komunikasi dan konsentrasi', 2], ['Telinga berdenging (tinnitus)', 3], ['Gangguan pendengaran permanen', 4]],
      kontrol: {
        eliminasi: ['Pindahkan sumber bising dari area kerja'],
        substitusi: ['Ganti mesin dengan tipe lebih senyap'],
        rekayasa: ['Peredam, enklosur, dan bantalan antigetar'],
        administratif: ['Batasi lama paparan (NAB 85 dBA untuk 8 jam)', 'Rambu wajib pelindung telinga', 'Audiometri berkala'],
        apd: ['Penyumbat/penutup telinga sesuai tingkat bising']
      }
    },
    biologi: {
      judul: 'Bahaya biologi / infeksi', ilustrasi: 'biologi', kategori: 'biologi', keparahan: 4,
      kata: ['jarum', 'tertusuk', 'tusuk jarum', 'suntik', 'darah', 'cairan tubuh', 'infeksi', 'infeksius', 'tbc', 'virus', 'bakteri', 'isolasi', 'menular', 'safety box', 'limbah medis', 'percikan'],
      skenario: ['Tertusuk jarum bekas saat merapikan troli', 'Percikan darah ke mata saat tindakan', 'Penularan droplet di ruang isolasi'],
      dampak: [['Infeksi lokal', 2], ['Penularan hepatitis B/C atau HIV', 5], ['Tuberkulosis', 4]],
      kontrol: {
        eliminasi: ['Kurangi tindakan dengan jarum yang tidak perlu'],
        substitusi: ['Gunakan jarum dengan pengaman (safety-engineered sharps)'],
        rekayasa: ['Safety box di titik pakai, tidak lebih dari 3/4 penuh', 'Ruang isolasi bertekanan negatif'],
        administratif: ['Larangan menutup kembali jarum (no recapping)', 'Prosedur pasca-pajanan (PEP) dan pelaporan segera', 'Vaksinasi hepatitis B petugas'],
        apd: ['Sarung tangan, masker bedah/N95 sesuai risiko', 'Pelindung mata/face shield', 'Gaun pelindung']
      }
    },
    ergonomi: {
      judul: 'Ergonomi / angkat-angkut', ilustrasi: 'ergonomi', kategori: 'ergonomi', keparahan: 3,
      kata: ['angkat', 'mengangkat', 'angkat pasien', 'memindahkan', 'punggung', 'pinggang', 'membungkuk', 'berdiri lama', 'duduk lama', 'mendorong', 'menarik', 'berat', 'berulang', 'troli', 'tabung'],
      skenario: ['Mengangkat pasien tanpa alat bantu', 'Mendorong troli berat di lantai menanjak', 'Gerakan berulang sepanjang shift'],
      dampak: [['Pegal dan nyeri otot', 2], ['Cedera punggung bawah (LBP)', 3], ['Hernia nukleus pulposus', 4]],
      kontrol: {
        eliminasi: ['Hilangkan kebutuhan mengangkat manual (alur kerja diubah)'],
        substitusi: ['Gunakan lift pasien, papan geser (slide sheet), troli bermotor'],
        rekayasa: ['Tinggi meja kerja dapat diatur', 'Roda troli dirawat agar ringan'],
        administratif: ['Angkat bersama tim (2–4 orang)', 'Rotasi tugas dan peregangan', 'Pelatihan teknik angkat aman'],
        apd: ['Sepatu antislip', 'Sarung tangan pegangan']
      }
    },
    licin: {
      judul: 'Terpeleset / tersandung', ilustrasi: 'licin', kategori: 'fisik', keparahan: 3,
      kata: ['licin', 'basah', 'genangan', 'tergenang', 'terpeleset', 'tergelincir', 'tersandung', 'kabel melintang', 'lantai', 'bocor', 'pel', 'hujan'],
      skenario: ['Terpeleset di lantai basah tanpa rambu', 'Tersandung kabel yang melintang di lorong'],
      dampak: [['Memar', 2], ['Keseleo', 2], ['Patah tulang pergelangan/panggul', 4]],
      kontrol: {
        eliminasi: ['Perbaiki sumber kebocoran/genangan'],
        substitusi: ['Lantai bertekstur antislip di area basah'],
        rekayasa: ['Penutup kabel (cable protector)', 'Keset dan talang air di pintu masuk'],
        administratif: ['Rambu "Lantai Basah" saat mengepel', 'Jadwal mengepel di luar jam sibuk', 'Housekeeping tiap shift'],
        apd: ['Sepatu antislip']
      }
    },
    ruang_terbatas: {
      judul: 'Ruang terbatas', ilustrasi: 'ruang', kategori: 'kimia', keparahan: 5,
      kata: ['ruang terbatas', 'tangki', 'septic', 'septik', 'ipal', 'sumur', 'manhole', 'gorong', 'saluran', 'bak kontrol', 'ground tank'],
      skenario: ['Pekerja pingsan karena kekurangan oksigen/gas beracun di tangki', 'Penolong ikut menjadi korban'],
      dampak: [['Pusing dan sesak', 3], ['Keracunan gas (H₂S, CO)', 5], ['Kematian (fatality)', 5]],
      kontrol: {
        eliminasi: ['Kerjakan dari luar (kamera, alat jarak jauh)'],
        substitusi: ['Metode pembersihan tanpa masuk'],
        rekayasa: ['Ventilasi paksa', 'Pengukuran gas (O₂, H₂S, CO, LEL) sebelum dan selama bekerja', 'Tripod dan alat penarik'],
        administratif: ['Izin masuk ruang terbatas', 'Penjaga di luar (attendant) dan rencana penyelamatan', 'Hanya petugas terlatih'],
        apd: ['Full body harness', 'Alat bantu napas (SCBA) bila diperlukan']
      }
    },
    radiasi: {
      judul: 'Radiasi pengion', ilustrasi: 'radiasi', kategori: 'fisik', keparahan: 4,
      kata: ['radiasi', 'rontgen', 'x-ray', 'ct scan', 'fluoroskopi', 'cath lab', 'radioaktif', 'kedokteran nuklir', 'apron timbal'],
      skenario: ['Paparan hambur saat tindakan fluoroskopi', 'Pintu ruang radiologi terbuka saat penyinaran'],
      dampak: [['Paparan melebihi nilai batas dosis', 3], ['Efek kesehatan jangka panjang', 4]],
      kontrol: {
        eliminasi: ['Hindari pemeriksaan yang tidak terindikasi'],
        substitusi: ['Modalitas tanpa radiasi pengion bila setara (USG/MRI)'],
        rekayasa: ['Dinding/pintu berlapis timbal, lampu indikator penyinaran', 'Tabir pelindung bergerak'],
        administratif: ['Prinsip waktu–jarak–perisai', 'Dosimeter perorangan dan pemantauan dosis', 'Petugas proteksi radiasi'],
        apd: ['Apron timbal, pelindung tiroid, kacamata timbal']
      }
    },
    psikososial: {
      judul: 'Kekerasan & beban psikososial', ilustrasi: 'psikososial', kategori: 'psikososial', keparahan: 3,
      kata: ['kekerasan', 'dipukul', 'diancam', 'ancaman', 'dibentak', 'dimaki', 'perundungan', 'bully', 'pelecehan', 'intimidasi', 'beban kerja', 'lembur', 'kelelahan', 'lelah', 'stres', 'kurang tenaga'],
      skenario: ['Petugas diancam keluarga pasien di triase', 'Kelelahan karena lembur berturut-turut'],
      dampak: [['Stres kerja', 2], ['Cedera akibat kekerasan', 4], ['Burnout', 3]],
      kontrol: {
        eliminasi: ['Hilangkan situasi kerja sendirian di area berisiko'],
        substitusi: ['Atur ulang alur pelayanan untuk mengurangi antrean dan konflik'],
        rekayasa: ['Tombol panik, CCTV, desain meja triase yang aman'],
        administratif: ['Kebijakan nol toleransi kekerasan dan alur pelaporan', 'Pengaturan shift dan batas lembur', 'Dukungan psikologis/konseling'],
        apd: ['—']
      }
    },
    limbah: {
      judul: 'Limbah medis & B3', ilustrasi: 'limbah', kategori: 'limbah', keparahan: 3,
      kata: ['limbah', 'sampah medis', 'safety box', 'tercampur', 'tercecer', 'tps', 'kantong kuning', 'insinerator', 'incinerator', 'ipal'],
      skenario: ['Limbah infeksius tercampur sampah biasa', 'Petugas kebersihan tertusuk benda tajam di kantong sampah'],
      dampak: [['Infeksi', 3], ['Pencemaran lingkungan', 3], ['Tertusuk benda tajam', 4]],
      kontrol: {
        eliminasi: ['Kurangi timbulan limbah B3 di sumber'],
        substitusi: ['Wadah dan kantong sesuai warna dan jenis limbah'],
        rekayasa: ['TPS limbah B3 tertutup, berventilasi, berlantai kedap'],
        administratif: ['Pemilahan di sumber dan jadwal pengangkutan', 'Manifest limbah dan logbook'],
        apd: ['Sarung tangan tebal, sepatu bot, apron, masker']
      }
    }
  };
  const URUTAN_KONTROL = ['eliminasi', 'substitusi', 'rekayasa', 'administratif', 'apd'];
  const NAMA_KONTROL = { eliminasi: 'Eliminasi', substitusi: 'Substitusi', rekayasa: 'Rekayasa teknik', administratif: 'Administratif', apd: 'APD' };
  const KET_KONTROL = { eliminasi: 'Menghilangkan bahaya — paling efektif', substitusi: 'Mengganti dengan yang lebih aman', rekayasa: 'Memisahkan orang dari bahaya secara fisik', administratif: 'Mengubah cara kerja: prosedur, izin, pelatihan, rambu', apd: 'Melindungi pekerja — benteng terakhir, paling lemah' };
  // Kategori aplikasi → bahaya utama (untuk laporan yang tidak memuat kata kunci khusus)
  const BAHAYA_KATEGORI = { biologi: 'biologi', kimia: 'kimia', fisik: 'licin', ergonomi: 'ergonomi', psikososial: 'psikososial', mekanik: 'terjepit', kebakaran: 'kebakaran', limbah: 'limbah' };

  // ---------- 2. Deteksi bahaya dari teks (rule-based) ----------
  const normal = t => ' ' + String(t || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9₂\s/-]/g, ' ').replace(/\s+/g, ' ') + ' ';
  function deteksiBahaya(teks) {
    const t = normal(teks); const hasil = [];
    for (const [id, b] of Object.entries(BAHAYA)) {
      const kena = b.kata.filter(k => t.includes(' ' + k + ' ') || t.includes(' ' + k));
      if (kena.length) hasil.push({ id, skor: kena.length, kata: kena });
    }
    return hasil.sort((a, b) => b.skor - a.skor || BAHAYA[b.id].keparahan - BAHAYA[a.id].keparahan);
  }
  // Perkiraan tindakan tidak aman vs kondisi tidak aman (hanya indikasi dari kata kunci, bukan penetapan)
  const KATA_TINDAKAN = ['tidak memakai', 'tanpa apd', 'tidak pakai', 'lalai', 'terburu', 'menutup kembali jarum', 'recapping', 'merokok', 'bercanda', 'melanggar', 'tidak mengikuti', 'mengabaikan', 'tidak menggunakan', 'lupa'];
  function sifatTemuan(teks) {
    const t = normal(teks);
    return KATA_TINDAKAN.some(k => t.includes(k)) ? 'tindakan' : 'kondisi';
  }
  // Rekomendasi pengendalian berurutan hierarki (yang paling efektif lebih dulu)
  function rekomendasi(idBahaya) {
    const b = BAHAYA[idBahaya]; if (!b) return [];
    return URUTAN_KONTROL.map(l => ({ level: l, nama: NAMA_KONTROL[l], ket: KET_KONTROL[l], butir: b.kontrol[l] || [] }));
  }
  // Risiko residual perkiraan: tiap tingkat pengendalian efektif menurunkan kemungkinan/dampak (aturan sederhana, untuk diskusi)
  function residual(dampak, kemungkinan, levelTerkuat) {
    const turunK = { eliminasi: 5, substitusi: 2, rekayasa: 2, administratif: 1, apd: 1 }[levelTerkuat] || 0;
    const turunD = { eliminasi: 5, substitusi: 1, rekayasa: 0, administratif: 0, apd: 1 }[levelTerkuat] || 0;
    const d = Math.max(1, (dampak || 1) - turunD), k = Math.max(1, (kemungkinan || 1) - turunK);
    return { dampak: d, kemungkinan: k, skor: d * k };
  }

  // ---------- 3. Waktu, shift, zona waktu ----------
  let ZONA = 'Asia/Makassar';
  const setZona = z => { if (z) ZONA = z; };
  const SHIFT = { pagi: { label: 'Pagi', jam: '07.00–14.00' }, siang: { label: 'Siang', jam: '14.00–21.00' }, malam: { label: 'Malam', jam: '21.00–07.00' } };
  function bagianWaktu(d) {
    const p = new Intl.DateTimeFormat('en-GB', { timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short', hourCycle: 'h23' }).formatToParts(new Date(d));
    const o = {}; p.forEach(x => { o[x.type] = x.value; });
    return { tanggal: o.year + '-' + o.month + '-' + o.day, jam: +o.hour, menit: +o.minute, hari: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(o.weekday) };
  }
  const shiftDariJam = j => j >= 7 && j < 14 ? 'pagi' : j >= 14 && j < 21 ? 'siang' : 'malam';
  // Laporan anonim hanya menyimpan tanggal (privasi): jamnya tidak diketahui → shift null.
  function shiftLaporan(l) { if (!l || l.anonim || !l.dibuat_pada) return null; return shiftDariJam(bagianWaktu(l.dibuat_pada).jam); }
  const shiftSekarang = () => shiftDariJam(bagianWaktu(new Date()).jam);
  const tanggalLokal = d => bagianWaktu(d || new Date()).tanggal;
  function geserHari(tgl, n) { const d = new Date(tgl + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
  const formatWaktu = d => new Date(d).toLocaleString('id-ID', { timeZone: ZONA, day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  // ---------- 4. Pengurai kueri bahasa Indonesia ----------
  const BULAN = ['januari', 'februari', 'maret', 'april', 'mei', 'juni', 'juli', 'agustus', 'september', 'oktober', 'november', 'desember'];
  const KATA_ABAI = new Set('cari carikan tampilkan lihat semua yang di pada dan atau untuk dari ke dengan selama terakhir hari minggu bulan tahun ini lalu kemarin laporan data tolong saya mau ingin apa ada berapa jumlah daftar shift pagi siang malam bahaya pekerjaan kerja masih sudah belum oleh tentang terkait soal mengenai'.split(' '));
  const PETA_JENIS = [[/near ?miss|nyaris( celaka)?|hampir celaka/, 'nyaris_celaka'], [/insiden|kecelakaan|kejadian|accident|incident|cedera/, 'kejadian'], [/hazard|kondisi tidak aman|unsafe/, 'bahaya']];
  const PETA_MODUL = [[/\bjsa\b|analisis keselamatan kerja|job safety/, 'jsa'], [/inspeksi|inspection|temuan inspeksi/, 'inspeksi'], [/monitoring|pemantauan|pengukuran|kebisingan|pencahayaan|kesehatan kerja|keluhan/, 'pemantauan'],
    [/\bsop\b|prosedur|dokumen|pedoman|instruksi kerja|\bik\b|kebijakan/, 'sop'], [/capa|tindak lanjut|tindakan korektif|perbaikan|corrective/, 'capa']];
  function parseKueri(teks, ref) {
    const t = normal(teks), hasil = { teks: String(teks || '').trim(), jenis: [], kategori: [], unit: [], modul: [], shift: null, dari: null, sampai: null, mendesak: false, status: null, kata: [], bahaya: [], rentangLabel: '' };
    PETA_JENIS.forEach(([r, j]) => { if (r.test(t)) hasil.jenis.push(j); });
    PETA_MODUL.forEach(([r, m]) => { if (r.test(t)) hasil.modul.push(m); });
    if (/shift pagi|\bpagi\b/.test(t)) hasil.shift = 'pagi'; else if (/shift siang|\bsiang\b|\bsore\b/.test(t)) hasil.shift = 'siang'; else if (/shift malam|\bmalam\b/.test(t)) hasil.shift = 'malam';
    if (/mendesak|darurat|urgent/.test(t)) hasil.mendesak = true;
    if (/terbuka|belum selesai|open/.test(t)) hasil.status = 'terbuka'; else if (/tertutup|selesai|closed/.test(t)) hasil.status = 'tertutup';
    if (/terlambat|lewat target|overdue/.test(t)) hasil.status = 'terlambat';
    const kini = tanggalLokal();
    let m;
    if ((m = t.match(/(\d{1,3}) hari terakhir/))) { hasil.dari = geserHari(kini, -(+m[1] - 1)); hasil.sampai = kini; hasil.rentangLabel = m[1] + ' hari terakhir'; }
    else if ((m = t.match(/(\d{1,2}) minggu terakhir/))) { hasil.dari = geserHari(kini, -(+m[1] * 7 - 1)); hasil.sampai = kini; hasil.rentangLabel = m[1] + ' minggu terakhir'; }
    else if ((m = t.match(/(\d{1,2}) bulan terakhir/))) { hasil.dari = geserHari(kini, -(+m[1] * 30 - 1)); hasil.sampai = kini; hasil.rentangLabel = m[1] + ' bulan terakhir'; }
    else if (/hari ini/.test(t)) { hasil.dari = hasil.sampai = kini; hasil.rentangLabel = 'hari ini'; }
    else if (/kemarin/.test(t)) { hasil.dari = hasil.sampai = geserHari(kini, -1); hasil.rentangLabel = 'kemarin'; }
    else if (/minggu ini|pekan ini/.test(t)) { hasil.dari = geserHari(kini, -6); hasil.sampai = kini; hasil.rentangLabel = '7 hari terakhir'; }
    else if (/bulan ini/.test(t)) { hasil.dari = kini.slice(0, 8) + '01'; hasil.sampai = kini; hasil.rentangLabel = 'bulan ini'; }
    else if (/bulan lalu/.test(t)) { const d = new Date(kini.slice(0, 8) + '01T12:00:00Z'); d.setUTCMonth(d.getUTCMonth() - 1); const a = d.toISOString().slice(0, 10); hasil.dari = a; hasil.sampai = geserHari(kini.slice(0, 8) + '01', -1); hasil.rentangLabel = 'bulan lalu'; }
    else if (/tahun ini/.test(t)) { hasil.dari = kini.slice(0, 4) + '-01-01'; hasil.sampai = kini; hasil.rentangLabel = 'tahun ini'; }
    else if ((m = t.match(/(\d{4})-(\d{2})-(\d{2})/))) { hasil.dari = hasil.sampai = m[0]; hasil.rentangLabel = m[0]; }
    else {
      const bi = BULAN.findIndex(b => t.includes(' ' + b + ' '));
      if (bi >= 0) { const th = (t.match(/ (20\d\d) /) || [])[1] || kini.slice(0, 4); const a = th + '-' + String(bi + 1).padStart(2, '0') + '-01'; const d = new Date(a + 'T12:00:00Z'); d.setUTCMonth(d.getUTCMonth() + 1); d.setUTCDate(0); hasil.dari = a; hasil.sampai = d.toISOString().slice(0, 10); hasil.rentangLabel = BULAN[bi] + ' ' + th; }
    }
    const pakai = new Set();
    if (ref) {
      (ref.kategori || []).forEach(k => { const n = normal(k.nama).trim(); if (t.includes(' ' + k.kode + ' ') || (n && t.includes(' ' + n.split(' ')[0] + ' '))) { hasil.kategori.push(k.kode); pakai.add(k.kode); n.split(' ').forEach(x => pakai.add(x)); } });
      (ref.unit || []).forEach(u => { const n = normal(u.nama).trim(); const kode = u.kode.toLowerCase(); if ((kode.length > 2 && t.includes(' ' + kode + ' ')) || (n.length > 3 && t.includes(' ' + n + ' '))) { hasil.unit.push(u.id); pakai.add(kode); n.split(' ').forEach(x => pakai.add(x)); } });
    }
    deteksiBahaya(teks).forEach(b => { hasil.bahaya.push(b.id); b.kata.forEach(k => k.split(' ').forEach(x => pakai.add(x))); });
    hasil.kata = t.trim().split(' ').filter(w => w.length > 2 && !KATA_ABAI.has(w) && !pakai.has(w) && !/^\d+$/.test(w) && !BULAN.includes(w)
      && !/^(near|miss|nyaris|celaka|insiden|kecelakaan|kejadian|hazard|jsa|inspeksi|monitoring|pemantauan|sop|prosedur|dokumen|capa|mendesak|terbuka|tertutup|terlambat|selesai|tindak|lanjut|korektif|terakhir|minggu|pekan|tindakan)$/.test(w));
    return hasil;
  }
  // Sinonim istilah lapangan (Indonesia/Inggris) agar pencarian tidak kaku
  const SINONIM = [['maintenance', 'pemeliharaan', 'perbaikan', 'perawatan', 'servis', 'ipsrs'], ['cleaning', 'kebersihan', 'mengepel', 'cleaning service', 'cs'],
    ['laundry', 'binatu', 'cuci'], ['dapur', 'gizi', 'masak'], ['gudang', 'logistik', 'penyimpanan'], ['jatuh', 'terjatuh', 'terpeleset', 'tergelincir'],
    ['luka', 'cedera', 'terluka'], ['genset', 'generator'], ['ac', 'pendingin', 'hvac']];
  const kelompokSinonim = w => (SINONIM.find(g => g.includes(w)) || [w]);
  function cocokTeks(isi, kata) { if (!kata || !kata.length) return true; const t = normal(isi); return kata.every(k => kelompokSinonim(k).some(x => t.includes(x))); }

  // ---------- 5. Statistik & epidemiologi ----------
  const hitung = (arr, f) => arr.reduce((o, x) => { const k = f(x); if (k === null || k === undefined) return o; o[k] = (o[k] || 0) + 1; return o; }, {});
  const urutHitung = o => Object.entries(o).map(([k, n]) => ({ k, n })).sort((a, b) => b.n - a.n);
  function deretBulan(n, akhir) {
    const out = []; const d = new Date((akhir || tanggalLokal()).slice(0, 7) + '-15T12:00:00Z');
    for (let i = n - 1; i >= 0; i--) { const x = new Date(d); x.setUTCMonth(d.getUTCMonth() - i); out.push(x.toISOString().slice(0, 7)); }
    return out;
  }
  // P(X ≥ k) untuk Poisson(λ) — uji lonjakan sederhana
  function poissonAtas(k, lam) {
    if (k <= 0) return 1; let p = Math.exp(-lam), s = p;
    for (let i = 1; i < k; i++) { p *= lam / i; s += p; }
    return Math.max(0, 1 - s);
  }
  // Bandingkan laju 30 hari terakhir dengan laju 90 hari sebelumnya per kelompok.
  function deteksiLonjakan(daftar, fKelompok, fTanggal, opsi) {
    opsi = opsi || {}; const kini = tanggalLokal(); const batasBaru = geserHari(kini, -29), batasDasar = geserHari(kini, -119);
    const g = {};
    daftar.forEach(x => { const tg = fTanggal(x); if (!tg || tg < batasDasar) return; const k = fKelompok(x); if (k == null) return; g[k] = g[k] || { baru: 0, dasar: 0 }; if (tg >= batasBaru) g[k].baru++; else g[k].dasar++; });
    return Object.entries(g).map(([k, v]) => {
      const harapan = v.dasar / 3; // rata-rata per 30 hari dari periode dasar 90 hari
      const p = poissonAtas(v.baru, Math.max(harapan, 0.5));
      return { k, baru: v.baru, harapan: Math.round(harapan * 10) / 10, p, sinyal: v.baru >= (opsi.minimal || 3) && p < 0.05 };
    }).filter(x => x.sinyal).sort((a, b) => a.p - b.p);
  }
  // Estimasi risiko 30 hari ke depan berbasis frekuensi historis (BUKAN prediksi pasti).
  function estimasiFrekuensi(daftar, fKelompok, fTanggal) {
    const tg = daftar.map(fTanggal).filter(Boolean).sort();
    if (!tg.length) return { cukup: false, alasan: 'Belum ada data.' };
    const rentangHari = Math.max(1, (new Date(tanggalLokal() + 'T12:00:00Z') - new Date(tg[0] + 'T12:00:00Z')) / 864e5 + 1);
    if (daftar.length < 20 || rentangHari < 90) return { cukup: false, alasan: 'Data belum cukup untuk estimasi: perlu minimal 20 catatan dalam rentang ≥ 90 hari (sekarang ' + daftar.length + ' catatan, ' + Math.round(rentangHari) + ' hari).' };
    const g = hitung(daftar, fKelompok);
    const baris = Object.entries(g).map(([k, n]) => { const lam = n / rentangHari * 30; return { k, n, lam: Math.round(lam * 100) / 100, peluang: Math.round((1 - Math.exp(-lam)) * 100) }; }).sort((a, b) => b.lam - a.lam);
    return { cukup: true, rentangHari: Math.round(rentangHari), baris };
  }

  // ---------- 6. Risiko berbasis cuaca (Open-Meteo, gratis tanpa kunci) ----------
  // Kode cuaca WMO → teks
  const WMO = { 0: 'Cerah', 1: 'Cerah berawan', 2: 'Berawan sebagian', 3: 'Mendung', 45: 'Berkabut', 48: 'Kabut beku', 51: 'Gerimis ringan', 53: 'Gerimis', 55: 'Gerimis lebat', 61: 'Hujan ringan', 63: 'Hujan sedang', 65: 'Hujan lebat', 80: 'Hujan lokal ringan', 81: 'Hujan lokal sedang', 82: 'Hujan lokal sangat lebat', 95: 'Badai petir', 96: 'Badai petir + hujan es', 99: 'Badai petir hebat' };
  const urlCuaca = (lat, lon, zona) => 'https://api.open-meteo.com/v1/forecast?latitude=' + encodeURIComponent(lat) + '&longitude=' + encodeURIComponent(lon) +
    '&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_gusts_10m' +
    '&hourly=temperature_2m,apparent_temperature,precipitation_probability,precipitation,weather_code,wind_gusts_10m&forecast_days=2&wind_speed_unit=kmh&timezone=' + encodeURIComponent(zona || ZONA);
  // Indeks panas sederhana (Steadman/NOAA, °C) dari suhu & kelembapan
  function indeksPanas(c, rh) {
    const f = c * 9 / 5 + 32; if (f < 80) return c;
    const hi = -42.379 + 2.04901523 * f + 10.14333127 * rh - .22475541 * f * rh - .00683783 * f * f - .05481717 * rh * rh + .00122874 * f * f * rh + .00085282 * f * rh * rh - .00000199 * f * f * rh * rh;
    return Math.round((hi - 32) * 5 / 9 * 10) / 10;
  }
  function risikoCuaca(c) {
    if (!c) return [];
    const out = [], kode = c.kode, hujan = c.hujan || 0, embusan = c.embusan || 0, hi = indeksPanas(c.suhu, c.rh || 70);
    const petir = [95, 96, 99].includes(kode) || (c.petirJamDepan || false);
    const lebat = hujan >= 5 || [65, 82].includes(kode);
    const adaHujan = hujan > 0 || [51, 53, 55, 61, 63, 65, 80, 81, 82, 95, 96, 99].includes(kode) || (c.peluangHujan || 0) >= 60;
    if (petir) out.push({ id: 'petir', tingkat: 4, judul: 'Badai petir', ikon: 'petir', bahaya: ['listrik', 'ketinggian'], dampak: ['Tersambar petir', 'Kebakaran', 'Gangguan listrik'],
      pekerjaan: ['ketinggian', 'atap', 'luar ruangan', 'outdoor', 'crane', 'menara', 'parkir', 'listrik', 'genset'],
      saran: ['Hentikan sementara pekerjaan di luar ruangan dan di ketinggian (keputusan petugas berwenang)', 'Jauhi tiang, menara, dan logam tinggi', 'Tunda pekerjaan pada panel listrik luar'], evaluasi: true });
    if (lebat || adaHujan) out.push({ id: 'hujan', tingkat: lebat ? 3 : 2, judul: lebat ? 'Hujan lebat' : 'Hujan', ikon: 'hujan', bahaya: ['licin', 'listrik', 'ketinggian'], dampak: ['Terpeleset dan jatuh', 'Tersengat listrik di area basah', 'Genangan/banjir', 'Jarak pandang menurun'],
      pekerjaan: ['ketinggian', 'atap', 'talang', 'luar ruangan', 'outdoor', 'listrik', 'parkir', 'lorong', 'saluran', 'ipal'],
      saran: ['Pasang rambu lantai basah di pintu masuk dan lorong', 'Periksa kebocoran atap dan genangan', 'Tunda pekerjaan atap dan instalasi listrik luar', 'Pastikan panel dan kabel luar terlindung air'], evaluasi: lebat });
    if (embusan >= 40) out.push({ id: 'angin', tingkat: embusan >= 60 ? 4 : 3, judul: 'Angin kencang (' + Math.round(embusan) + ' km/jam)', ikon: 'angin', bahaya: ['ketinggian', 'tertimpa'], dampak: ['Benda terbang', 'Kegagalan angkat material', 'Pekerja terdorong saat di ketinggian'],
      pekerjaan: ['ketinggian', 'atap', 'crane', 'angkat', 'perancah', 'scaffold', 'luar ruangan', 'outdoor'],
      saran: ['Ikat atau simpan material lepas di area terbuka', 'Evaluasi pekerjaan angkat dan di ketinggian', 'Periksa pohon/papan reklame di sekitar gedung'], evaluasi: embusan >= 50 });
    if (hi >= 32) out.push({ id: 'panas', tingkat: hi >= 41 ? 4 : hi >= 37 ? 3 : 2, judul: 'Indeks panas ' + String(hi).replace('.', ',') + '°C', ikon: 'panas', bahaya: ['panas'], dampak: ['Dehidrasi', 'Kelelahan panas (heat exhaustion)', 'Sengatan panas (heat stroke)'],
      pekerjaan: ['luar ruangan', 'outdoor', 'parkir', 'atap', 'dapur', 'laundry', 'boiler', 'insinerator', 'incinerator', 'angkat'],
      saran: ['Sediakan air minum dan ingatkan minum tiap 15–20 menit', 'Atur siklus kerja–istirahat di tempat teduh', 'Pindahkan pekerjaan berat ke pagi/sore', 'Awasi gejala pusing, mual, kulit panas kering'], evaluasi: hi >= 41 });
    return out.sort((a, b) => b.tingkat - a.tingkat);
  }
  // Cocokkan peringatan cuaca dengan pekerjaan (JSA) yang direncanakan
  function pekerjaanTerdampak(peringatan, daftarJsa) {
    return daftarJsa.filter(j => { const t = normal((j.pekerjaan || '') + ' ' + (j.lokasi || '') + ' ' + (j.luar ? 'luar ruangan' : '')); return peringatan.pekerjaan.some(k => t.includes(k)); });
  }

  // ---------- 7. Nilai ambang pemantauan (rujukan umum; dapat diubah di formulir) ----------
  // Sumber rujukan: Permenaker 5/2018 (NAB kebisingan, iklim kerja), Permenkes 7/2019 (kesehatan lingkungan RS).
  const PARAMETER = {
    kebisingan: { label: 'Kebisingan', satuan: 'dBA', maks: 85, ket: 'NAB 85 dBA untuk 8 jam/hari (Permenaker 5/2018)' },
    pencahayaan: { label: 'Pencahayaan', satuan: 'lux', min: 250, ket: 'Ruang perawatan minimal 250 lux; kamar operasi lebih tinggi (Permenkes 7/2019)' },
    suhu_ruang: { label: 'Suhu ruang', satuan: '°C', min: 22, maks: 26, ket: 'Suhu ruang umum 22–26 °C (Permenkes 7/2019)' },
    kelembapan: { label: 'Kelembapan', satuan: '%', min: 40, maks: 60, ket: 'Kelembapan 40–60% (Permenkes 7/2019)' },
    isbb: { label: 'Iklim kerja (ISBB)', satuan: '°C', maks: 28, ket: 'Contoh NAB ISBB beban sedang, 75–100% kerja: 28 °C (Permenaker 5/2018)' },
    debu: { label: 'Debu (PM2.5)', satuan: 'µg/m³', maks: 35, ket: 'Rujukan indikatif kualitas udara dalam ruang' },
    klorin_sisa: { label: 'Sisa klor air', satuan: 'mg/L', min: 0.2, maks: 0.5, ket: 'Air minum/bersih: sisa klor 0,2–0,5 mg/L' },
    bod_ipal: { label: 'BOD outlet IPAL', satuan: 'mg/L', maks: 30, ket: 'Baku mutu air limbah fasyankes (PermenLHK 68/2016)' },
    keluhan: { label: 'Keluhan kesehatan kerja', satuan: 'kasus', ket: 'Jumlah kasus (agregat, tanpa identitas pekerja)' }
  };
  const JENIS_KELUHAN = { muskuloskeletal: 'Nyeri otot/tulang (muskuloskeletal)', kulit: 'Gangguan kulit/dermatitis', pernapasan: 'Gangguan pernapasan', pendengaran: 'Gangguan pendengaran', mata: 'Iritasi mata', tertusuk: 'Tertusuk jarum/benda tajam', kelelahan: 'Kelelahan/stres kerja', infeksi: 'Infeksi terkait kerja', lain: 'Lainnya' };
  function nilaiStatus(param, nilai, ambangMin, ambangMaks) {
    const p = PARAMETER[param] || {}; const mn = ambangMin != null && ambangMin !== '' ? +ambangMin : p.min, mx = ambangMaks != null && ambangMaks !== '' ? +ambangMaks : p.maks;
    if (nilai == null || nilai === '' || isNaN(+nilai)) return { status: 'tidak_ada', label: '—' };
    if (mx != null && +nilai > mx) return { status: 'melebihi', label: 'Melebihi ambang', ambang: mx };
    if (mn != null && +nilai < mn) return { status: 'kurang', label: 'Di bawah ambang', ambang: mn };
    return { status: 'normal', label: 'Memenuhi', ambang: mx != null ? mx : mn };
  }

  // ---------- 8. Daftar periksa inspeksi (dapat diperluas) ----------
  const DAFTAR_PERIKSA = {
    umum: { judul: 'Inspeksi umum K3 ruangan', butir: [
      ['Lantai kering, tidak licin, tidak ada genangan', 'licin'], ['Lorong dan jalur evakuasi bebas hambatan', 'kebakaran'], ['Kabel tidak melintang dan tidak terkelupas', 'listrik'],
      ['Penerangan cukup dan lampu berfungsi', 'licin'], ['Barang di rak tertata, yang berat di bawah', 'tertimpa'], ['Safety box tersedia dan terisi kurang dari 3/4', 'biologi'],
      ['Tempat sampah dipilah sesuai warna', 'limbah'], ['Hand hygiene (sabun/handrub) tersedia', 'biologi'], ['Rambu K3 terpasang dan terbaca', 'kebakaran']] },
    kebakaran: { judul: 'Proteksi kebakaran', butir: [
      ['APAR ada, tidak terhalang, tekanan di zona hijau', 'kebakaran'], ['Label pemeriksaan APAR diperbarui bulan ini', 'kebakaran'], ['Pintu darurat tidak terkunci dan menutup sendiri', 'kebakaran'],
      ['Tanda EXIT menyala', 'kebakaran'], ['Detektor asap tidak tertutup', 'kebakaran'], ['Tabung gas medis terikat rantai', 'ledakan'], ['Denah evakuasi terpasang', 'kebakaran']] },
    listrik: { judul: 'Keselamatan listrik', butir: [
      ['Panel listrik tertutup dan terkunci', 'listrik'], ['Tidak ada colokan bertumpuk (T-kontak berantai)', 'listrik'], ['Kabel peralatan medis utuh', 'listrik'],
      ['Ada label bahaya listrik di panel', 'listrik'], ['Area panel kering dan bebas barang', 'listrik'], ['ELCB/RCD diuji dan berfungsi', 'listrik']] },
    b3: { judul: 'Bahan kimia / B3', butir: [
      ['Semua wadah B3 berlabel dan bersimbol', 'kimia'], ['Lembar Data Keselamatan (SDS) tersedia', 'kimia'], ['Spill kit lengkap', 'kimia'],
      ['Bahan tidak kompatibel dipisahkan', 'kimia'], ['Ventilasi ruang penyimpanan berfungsi', 'kimia'], ['Eyewash berfungsi', 'kimia']] },
    limbah: { judul: 'Limbah & sanitasi', butir: [
      ['TPS limbah B3 tertutup dan berlabel', 'limbah'], ['Logbook dan manifest limbah terisi', 'limbah'], ['Limbah tidak tersimpan lebih dari batas waktu', 'limbah'],
      ['IPAL beroperasi normal (tidak berbau menyengat)', 'ruang_terbatas'], ['Petugas memakai APD lengkap', 'limbah']] },
    ketinggian: { judul: 'Pekerjaan di ketinggian (IPSRS)', butir: [
      ['Izin kerja di ketinggian tersedia', 'ketinggian'], ['Tangga/perancah dalam kondisi baik dan stabil', 'ketinggian'], ['Harness dan lanyard diperiksa sebelum dipakai', 'ketinggian'],
      ['Area bawah dibarikade', 'tertimpa'], ['Cuaca aman (tidak hujan/petir/angin kencang)', 'ketinggian'], ['Ada pengawas di lokasi', 'ketinggian']] }
  };

  const api = { BAHAYA, URUTAN_KONTROL, NAMA_KONTROL, KET_KONTROL, BAHAYA_KATEGORI, deteksiBahaya, sifatTemuan, rekomendasi, residual,
    setZona, SHIFT, bagianWaktu, shiftDariJam, shiftLaporan, shiftSekarang, tanggalLokal, geserHari, formatWaktu,
    parseKueri, cocokTeks, normal, hitung, urutHitung, deretBulan, poissonAtas, deteksiLonjakan, estimasiFrekuensi,
    WMO, urlCuaca, indeksPanas, risikoCuaca, pekerjaanTerdampak, PARAMETER, JENIS_KELUHAN, nilaiStatus, DAFTAR_PERIKSA };
  root.K3Intel = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
