// Naskah narasi kedua video. Setiap adegan: id, judul, visual (ringkasan storyboard), kalimat (teks subtitle).
// Teks ucapan untuk mesin suara dibentuk otomatis oleh fonetik() agar singkatan dibaca benar.
const V1 = [
  { id: 'v1s1', judul: 'Pembukaan', visual: 'Animasi logo HSE Safety First, motif Bentenan, kata kunci K3 muncul berurutan; ilustrasi bahaya dari aplikasi.', kalimat: [
    'Di tengah kompleksitas operasional organisasi, pengelolaan keselamatan dan kesehatan kerja membutuhkan sistem yang terintegrasi, cepat, dan dapat diandalkan.',
    'Inilah HSE Project, solusi digital untuk mendukung transformasi manajemen K3.'] },
  { id: 'v1s2', judul: 'Tantangan', visual: 'Grafik gerak: formulir kertas, berkas spreadsheet terpisah, pesan tercecer → menyatu menjadi satu layar aplikasi.', kalimat: [
    'Pengelolaan K3 sering menghadapi tantangan: pencatatan yang terpisah, proses pelaporan yang panjang, tindak lanjut yang sulit dipantau,',
    'serta data yang belum diolah menjadi informasi yang bermanfaat.',
    'HSE Project dirancang untuk menyatukan proses tersebut.'] },
  { id: 'v1s3', judul: 'Gambaran aplikasi', visual: 'Rekaman aplikasi asli: beranda, navigasi samping, menu modul, tampilan ponsel 360 piksel.', kalimat: [
    'HSE Project menghadirkan pengelolaan K3 dalam satu platform digital yang dapat dibuka di komputer maupun ponsel.',
    'Modulnya mendukung identifikasi bahaya, penilaian risiko, pelaporan, pemantauan, dan pengelolaan informasi keselamatan kerja.'] },
  { id: 'v1s4a', judul: 'Fitur: pelaporan & risk register', visual: 'Formulir lapor bahaya; deteksi identitas pasien; daftar risk register dengan pencarian; penilaian dampak × kemungkinan.', kalimat: [
    'Petugas melaporkan bahaya dalam beberapa ketukan, dan sistem menolak teks yang memuat identitas pasien.',
    'Setiap laporan masuk ke risk register, dinilai dengan dampak dan kemungkinan, lalu ditugaskan kepada penanggung jawab dengan tenggat waktu.'] },
  { id: 'v1s4b', judul: 'Fitur: JSA, inspeksi, izin kerja', visual: 'JSA dengan langkah otomatis dan peringatan hierarki pengendalian; inspeksi terpandu dengan skor kepatuhan; izin kerja dengan Stop Work.', kalimat: [
    'Job Safety Analysis menyusun langkah kerja dan bahaya secara otomatis, serta memperingatkan bila pengendalian hanya mengandalkan APD.',
    'Inspeksi terpandu menghitung skor kepatuhan, dan izin kerja tidak dapat dimulai sebelum disahkan. Setiap petugas dapat menghentikan pekerjaan berbahaya.'] },
  { id: 'v1s4c', judul: 'Fitur: insiden, investigasi, CAPA', visual: 'Investigasi: kronologi, 5 Why, diagram Fishbone; CAPA dengan penanggung jawab dan verifikasi.', kalimat: [
    'Laporan kejadian langsung memberi notifikasi kepada tim K3.',
    'Investigasi terstruktur dengan kronologi, analisis 5 Why, dan diagram Fishbone, lalu dilanjutkan dengan CAPA yang diverifikasi efektivitasnya.'] },
  { id: 'v1s4d', judul: 'Fitur: pelatihan, dokumen, laporan, pengguna', visual: 'Toolbox meeting dengan QR presensi; SOP & dokumen; laporan bulanan; pengguna dan peran.', kalimat: [
    'Toolbox meeting dan pelatihan dicatat dengan presensi QR, nilai pre-test dan post-test, serta penilaian kompetensi.',
    'SOP dan dokumen terkendali, laporan bulanan tersusun otomatis, dan hak akses diatur berdasarkan peran pengguna.'] },
  { id: 'v1s4e', judul: 'Fitur: HSE Intelligence & notifikasi', visual: 'HSE Intelligence: peta risiko, tren, peringatan cuaca; pencarian cerdas; pusat notifikasi.', kalimat: [
    'HSE Intelligence membaca pola dari data laporan, dan pencarian cerdas menemukan laporan maupun SOP dengan bahasa sehari-hari.',
    'Analisis ini berbasis aturan yang transparan, bukan kecerdasan buatan generatif.'] },
  { id: 'v1s5', judul: 'Pembeda', visual: 'Perbandingan konseptual manual vs terintegrasi; bukti: berbasis peramban/PWA, hak akses di basis data, jejak perubahan, sinkron Google Sheets, komponen gratis.', kalimat: [
    'Keunggulan HSE Project terletak pada integrasi proses K3 dalam satu alur: dari laporan, analisis, sampai tindakan perbaikan.',
    'Aplikasi berjalan di peramban tanpa instalasi, hak akses dijaga di basis data, setiap perubahan tercatat, dan data dapat disalin ke Google Sheets.',
    'Sistem ini dirancang untuk berkembang bersama kebutuhan operasional, bukan sekadar menjadi tempat penyimpanan laporan.'] },
  { id: 'v1s6', judul: 'Nilai bisnis', visual: 'Dasbor, laporan bulanan, status tindak lanjut.', kalimat: [
    'Dengan informasi yang lebih terstruktur, HSE Project berpotensi meningkatkan efisiensi administrasi, mempercepat akses informasi,',
    'mendukung pemantauan tindakan keselamatan, dan menyediakan dasar pengambilan keputusan K3 yang lebih baik.'] },
  { id: 'v1s7', judul: 'Penutup', visual: 'Logo, nama produk, tagline.', kalimat: [
    'Transformasikan pengelolaan K3 menjadi lebih terstruktur, terintegrasi, dan berorientasi pada perbaikan berkelanjutan.',
    'HSE Project. Smarter Safety. Better Management. Safer Workplace.'] }];

const V2 = [
  { id: 'v2s1', judul: 'Pendahuluan', visual: 'Logo, cuplikan aplikasi, cuplikan kode, diagram arsitektur.', kalimat: [
    'Di balik aplikasi HSE yang dapat digunakan, terdapat rangkaian proses pengembangan, struktur data, logika bisnis, integrasi sistem, dan pengelolaan hak akses.',
    'Video ini menjelaskan bagaimana HSE Project dibangun dan bagaimana setiap komponennya bekerja, berdasarkan kode sumber dan basis data yang sebenarnya.'] },
  { id: 'v2s2', judul: 'Teknologi', visual: 'Kartu teknologi terverifikasi beserta bukti berkas.', kalimat: [
    'Antarmuka dibangun dengan HTML, CSS, dan JavaScript murni, tanpa framework dan tanpa proses build. Situs dihosting di GitHub Pages.',
    'Aplikasi berupa Progressive Web App, dengan service worker dan manifest, sehingga dapat dipasang di ponsel.',
    'Backend menggunakan Supabase: PostgreSQL, API REST otomatis, autentikasi dengan MFA, dan penyimpanan berkas privat. Klien yang dipakai adalah supabase-js versi 2.45.4.',
    'Integrasi eksternal: Google Apps Script untuk menyalin data ke Google Sheets, Open-Meteo untuk cuaca, serta pdf.js, mammoth, dan tesseract untuk membaca dokumen di peramban.'] },
  { id: 'v2s3', judul: 'Arsitektur frontend', visual: 'Struktur folder; index.html; router hash; fungsi h(); api.js.', kalimat: [
    'Titik masuk aplikasi adalah index.html, yang memuat config.js lalu modul JavaScript secara berurutan, dengan kebijakan keamanan konten yang ketat.',
    'Routing memakai hash pada alamat. Objek RUTE memetakan setiap alamat ke fungsi halaman, dan objek HAK menentukan peran yang boleh membukanya.',
    'Antarmuka dibentuk oleh fungsi h, yang membuat elemen DOM langsung tanpa template HTML, sehingga teks pengguna tidak pernah dieksekusi sebagai kode.',
    'Semua akses data melewati satu lapisan, api.js. Lapisan ini memiliki dua mode: demo di peramban, dan Supabase untuk data nyata.'] },
  { id: 'v2s3b', judul: 'Dari klik ke penyimpanan', visual: 'Rekaman: isi formulir lapor → validasi → permintaan RPC → respons nomor laporan.', kalimat: [
    'Contohnya formulir lapor bahaya. Tombol kirim hanya aktif setelah jenis bahaya dipilih, dan teks diperiksa dari kemungkinan identitas pasien.',
    'Setelah dikirim, frontend memanggil fungsi kirim_laporan melalui API, lalu menampilkan nomor laporan dari respons server. Bila jaringan putus, laporan disimpan di antrean perangkat dan dikirim ulang.'] },
  { id: 'v2s4', judul: 'Backend & logika bisnis', visual: 'Kode SQL kirim_laporan; aturan validasi; CRUD melalui PostgREST & RPC.', kalimat: [
    'Logika bisnis yang penting dijalankan di basis data, bukan di peramban. Fungsi kirim_laporan memeriksa peran pengguna, jenis, kategori, unit, panjang teks, dan identitas pasien sekali lagi.',
    'Fungsi ini juga mencegah laporan ganda melalui ID klien, lalu membuat nomor laporan dengan format K3, tanggal, dan nomor urut.',
    'Operasi baca dan ubah sederhana memakai API REST yang dibentuk otomatis dari tabel. Perubahan status penting, seperti penugasan, penutupan, atau persetujuan izin kerja, hanya dapat dilakukan melalui fungsi server yang memeriksa aturan alurnya.',
    'Trigger basis data menambahkan notifikasi, mencatat jejak perubahan, dan menyalin data ke antrean sinkronisasi.'] },
  { id: 'v2s5', judul: 'Arsitektur basis data', visual: 'Statistik skema nyata; ERD dari foreign key; contoh kebijakan RLS.', kalimat: [
    'Skema basis data terdiri dari 32 tabel, 74 fungsi, 38 trigger, dan 59 kebijakan Row Level Security, sesuai berkas migrasi di repositori.',
    'Laporan menjadi pusat. Investigasi merujuk satu laporan kejadian atau nyaris celaka, dan CAPA merujuk investigasi, laporan, atau kegiatan pelatihan.',
    'Analisis akar masalah tidak disimpan di tabel terpisah. 5 Why dan Fishbone tersimpan sebagai kolom JSON di tabel investigasi.',
    'Izin kerja merujuk JSA dan laporan. JSA sendiri belum terhubung langsung ke risk register. Kegiatan pelatihan terhubung ke peserta, yang mencatat kehadiran, nilai, dan kompetensi.',
    'Duplikasi dicegah dengan kunci unik, misalnya satu investigasi aktif per laporan dan satu notifikasi per peristiwa. Konsistensi dijaga oleh constraint dan trigger.'] },
  { id: 'v2s6', judul: 'Google Apps Script & integrasi', visual: 'Kode Kode.gs; diagram tarik antrean; pemicu 10 menit.', kalimat: [
    'Integrasi Google Sheets bekerja satu arah. Supabase tetap sumber data resmi, dan Sheets hanya cermin untuk pelaporan.',
    'Apps Script dipasang dengan fungsi pasang, yang membuat pemicu waktu setiap 10 menit. Fungsi sinkron mengambil antrean melalui RPC sinkron_ambil dengan token khusus.',
    'Setiap baris ditulis berdasarkan kolom id, sehingga tidak pernah tergandakan, lalu hasilnya dilaporkan melalui sinkron_lapor. Baris yang gagal dicoba ulang sampai sepuluh kali.',
    'Kode yang ditampilkan berasal dari repositori. Isi proyek Apps Script di akun produksi tidak dapat diperiksa langsung dari lingkungan pembuatan video ini.'] },
  { id: 'v2s7', judul: 'Alur kerja & aliran data', visual: 'Animasi alur insiden 14 langkah dengan rekaman aplikasi.', kalimat: [
    'Mari ikuti satu kejadian dari awal sampai akhir. Petugas masuk, melaporkan kejadian, dan sistem memvalidasi lalu menyimpannya dengan nomor dan status baru.',
    'Trigger mengirim notifikasi wajib kepada semua akun K3. Petugas K3 memulai investigasi, menyusun kronologi, 5 Why, dan Fishbone.',
    'Investigasi tidak dapat diajukan tanpa CAPA, dan persetujuannya harus dilakukan oleh petugas K3 selain ketua tim.',
    'Penanggung jawab menandai CAPA selesai dengan bukti, petugas K3 lain memverifikasi efektivitasnya, lalu investigasi ditutup dan dasbor menampilkan angka terbaru.'] },
  { id: 'v2s8', judul: 'Keamanan & hak akses', visual: 'Alur autentikasi; peran; RLS; demonstrasi petugas ditolak membuka risk register.', kalimat: [
    'Pengguna masuk melalui Supabase Auth. Peran admin K3 wajib memakai MFA, dan aturan aksesnya menuntut sesi berlevel aal2.',
    'Ada tiga peran: petugas, penanggung jawab unit, dan K3RS. Pembatasan ditegakkan oleh Row Level Security, sehingga meskipun API dipanggil langsung, petugas hanya menerima data miliknya.',
    'Kolom sensitif, seperti identitas pelapor anonim, tidak diberikan hak baca. Kunci yang ada di frontend hanyalah kunci publik anon. Kunci service role tidak pernah disimpan di peramban.'] },
  { id: 'v2s9', judul: 'Proses pengembangan & pemeliharaan', visual: 'Riwayat commit git; migrasi SQL bernomor; hasil uji otomatis; deployment GitHub Pages.', kalimat: [
    'Perubahan dikembangkan di cabang terpisah, dikomit, lalu digabung ke cabang main. GitHub Pages menerbitkan versi baru secara otomatis.',
    'Basis data diubah melalui berkas migrasi SQL bernomor yang aman dijalankan ulang, masing-masing dengan berkas rollback.',
    'Setiap rilis diuji ulang: 109 pemeriksaan basis data, 50 skenario ujung ke ujung, uji tampilan di layar ponsel, dan pengujian penerimaan pengguna berbasis persona.',
    'Pengembangan berikutnya meliputi notifikasi email dan push yang kodenya sudah tersedia tetapi belum diaktifkan, matriks risiko lima kali lima sesuai rumah sakit, dan penilaian risiko residual. Semua itu masih rencana, belum fitur aktif.'] },
  { id: 'v2s10', judul: 'Penutup', visual: 'Diagram arsitektur akhir dan logo.', kalimat: [
    'HSE Project merupakan hasil pengembangan sistem digital yang menggabungkan proses manajemen K3 dengan teknologi perangkat lunak.',
    'Melalui arsitektur yang dapat dipahami, pengelolaan data yang terstruktur, dan pengembangan berkelanjutan, sistem ini dapat terus dikembangkan sesuai kebutuhan organisasi.'] }];

// Ejaan ucapan untuk mesin suara bahasa Indonesia (tidak memengaruhi subtitle)
const UCAP = [
  [/HSE Project/g, 'ha es e projek'], [/\bHSE\b/g, 'ha es e'], [/\bK3RS\b/g, 'ka tiga er es'], [/\bK3\b/g, 'ka tiga'], [/Job Safety Analysis/g, 'jop sefti analisis'], [/\bJSA\b/g, 'je es a'], [/\bCAPA\b/g, 'kapa'],
  [/\bAPD\b/g, 'a pe de'], [/\bQR\b/g, 'kiu er'], [/\bSOP\b/g, 'es o pe'], [/\bMFA\b/g, 'em ef a'], [/\bAPI\b/g, 'a pe i'], [/\bREST\b/g, 'rest'], [/\bRPC\b/g, 'er pe se'], [/\bID\b/g, 'ai di'], [/\bJSON\b/g, 'jeison'],
  [/\bDOM\b/g, 'dom'], [/\bHTML\b/g, 'ha te em el'], [/\bCSS\b/g, 'se es es'], [/JavaScript/g, 'jawaskrip'], [/supabase-js/g, 'supabes je es'], [/Supabase Auth/g, 'supabes os'], [/Supabase/g, 'supabes'], [/PostgreSQL/g, 'posgres kiu el'],
  [/GitHub Pages/g, 'githab pejes'], [/Progressive Web App/g, 'progresif web ep'], [/service worker/g, 'servis worker'], [/framework/g, 'fremwork'], [/\bbuild\b/g, 'bild'], [/Google Apps Script/g, 'gugel eps skrip'], [/Apps Script/g, 'eps skrip'],
  [/Google Sheets/g, 'gugel sits'], [/\bSheets\b/g, 'sits'], [/Open-Meteo/g, 'open meteo'], [/pdf\.js/g, 'pe de ef je es'], [/tesseract/g, 'teserak'], [/index\.html/g, 'indeks titik ha te em el'], [/config\.js/g, 'konfig titik je es'], [/api\.js/g, 'a pe i titik je es'],
  [/Kode\.gs/g, 'kode titik ge es'], [/kirim_laporan/g, 'kirim laporan'], [/sinkron_ambil/g, 'sinkron ambil'], [/sinkron_lapor/g, 'sinkron lapor'], [/Row Level Security/g, 'rou level sekuriti'], [/\bRLS\b/g, 'er el es'], [/\baal2\b/g, 'a a el dua'],
  [/service role/g, 'servis rol'], [/\banon\b/g, 'anon'], [/risk register/g, 'risk rejister'], [/Fishbone/g, 'fisbon'], [/5 Why/g, 'lima wai'], [/pre-test/g, 'pri tes'], [/post-test/g, 'pos tes'], [/[Tt]oolbox meeting/g, 'tulboks miting'],
  [/Stop Work/g, 'stop werk'], [/HSE Intelligence/g, 'ha es e intelijens'], [/Intelligence/g, 'intelijens'], [/Smarter Safety\. Better Management\. Safer Workplace\./g, 'smarter sefti. beter menejmen. sefer werkples.'], [/\bemail\b/g, 'imel'], [/\bpush\b/g, 'pus'],
  [/\btrigger\b/gi, 'triger'], [/\bconstraint\b/g, 'konstren'], [/\bfrontend\b/g, 'fronen'], [/\bbackend\b/g, 'beken'], [/\brollback\b/g, 'rolbek'], [/\bmain\b/g, 'men'], [/\bplatform\b/g, 'pletform'], [/spreadsheet/g, 'spredsit'],
  [/2\.45\.4/g, 'dua titik empat puluh lima titik empat'], [/\bmanifest\b/g, 'manifes'], [/\bhash\b/g, 'hes'], [/\bRUTE\b/g, 'rute'], [/\bHAK\b/g, 'hak'], [/mammoth/g, 'mamot'], [/\bdemo\b/g, 'demo'], [/\bh\b,/g, 'ha,']];
const fonetik = t => UCAP.reduce((s, [a, b]) => s.replace(a, b), t);
module.exports = { V1, V2, fonetik };
