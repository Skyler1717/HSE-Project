// English narration (female presenter) + Indonesian subtitle per sentence.
// Each sentence: [English text, Indonesian subtitle, optional spoken form for the TTS engine]
// Scene ids and sentence counts match naskah.js so the recording scripts keep their cue points.
const V1 = [
  { id: 'v1s1', s: [
    ['Safe hospitals turn what people notice into action.', 'Rumah sakit yang aman mengubah apa yang diamati menjadi tindakan.'],
    ['This is HSE Project, a digital platform for occupational health and safety.', 'Inilah HSE Project, platform digital untuk keselamatan dan kesehatan kerja.']] },
  { id: 'v1s2', s: [
    ['Safety records often sit in scattered forms and spreadsheets.', 'Catatan keselamatan sering tersebar di formulir dan spreadsheet yang terpisah.'],
    ['Reports are slow, and follow-up is hard to track.', 'Pelaporan lambat, dan tindak lanjut sulit dipantau.'],
    ['HSE Project connects it all in one workflow.', 'HSE Project menyatukan semuanya dalam satu alur kerja.']] },
  { id: 'v1s3', s: [
    ['It runs in any browser, on desktop or phone.', 'Aplikasi ini berjalan di peramban apa pun, di komputer maupun ponsel.'],
    ['Reporting, risk assessment, and follow-up share the same data.', 'Pelaporan, penilaian risiko, dan tindak lanjut memakai data yang sama.']] },
  { id: 'v1s4a', s: [
    ['Reporting a hazard takes a few taps, and the form stops patient record numbers before anything is sent.', 'Melaporkan bahaya cukup beberapa ketukan, dan formulir menahan nomor rekam medis pasien sebelum laporan dikirim.'],
    ['In the risk register, the safety team rates each risk, then assigns an owner and a deadline.', 'Di risk register, tim K3 menilai setiap risiko, lalu menetapkan penanggung jawab dan tenggat waktu.']] },
  { id: 'v1s4b', s: [
    ['The Job Safety Analysis drafts the steps and hazards, and flags controls that rely only on protective equipment.', 'Job Safety Analysis menyusun langkah dan bahaya, serta menandai pengendalian yang hanya mengandalkan APD.'],
    ['Inspections score compliance automatically, and a permit cannot start before approval. Anyone on the unit can stop unsafe work.', 'Inspeksi menghitung skor kepatuhan secara otomatis, dan izin kerja tidak dapat dimulai sebelum disahkan. Setiap petugas di unit dapat menghentikan pekerjaan yang tidak aman.']] },
  { id: 'v1s4c', s: [
    ['Incidents alert the safety team immediately.', 'Insiden langsung memberi notifikasi kepada tim K3.'],
    ['Investigations use a timeline, five whys, and a fishbone diagram, ending in verified corrective actions.', 'Investigasi memakai kronologi, analisis 5 Why, dan diagram Fishbone, lalu berakhir pada tindakan korektif yang diverifikasi.']] },
  { id: 'v1s4d', s: [
    ['Toolbox meetings and training track attendance by QR code, test scores, and competency.', 'Toolbox meeting dan pelatihan mencatat kehadiran dengan kode QR, nilai tes, dan kompetensi.', 'Toolbox meetings and training track attendance by Q R code, test scores, and competency.'],
    ['Procedures stay under document control, and user roles control access.', 'SOP berada dalam pengendalian dokumen, dan peran pengguna mengatur hak akses.']] },
  { id: 'v1s4e', s: [
    ['HSE Intelligence reveals risk patterns, and smart search answers plain questions.', 'HSE Intelligence mengungkap pola risiko, dan pencarian cerdas menjawab pertanyaan sehari-hari.'],
    ['Both are rule-based, not generative AI.', 'Keduanya berbasis aturan, bukan AI generatif.', 'Both are rule-based, not generative artificial intelligence.']] },
  { id: 'v1s5', s: [
    ['What sets HSE Project apart is one connected flow, from the first report to the final corrective action.', 'Yang membedakan HSE Project adalah satu alur yang terhubung, dari laporan pertama hingga tindakan perbaikan terakhir.'],
    ['No installation, access enforced in the database, a full change history, and an optional Google Sheets mirror.', 'Tanpa instalasi, akses ditegakkan di basis data, riwayat perubahan lengkap, dan salinan opsional ke Google Sheets.'],
    ['It is built to grow with your operations.', 'Aplikasi ini dibangun untuk berkembang bersama operasional Anda.']] },
  { id: 'v1s6', s: [
    ['The dashboard and monthly report show open and overdue actions at a glance.', 'Dasbor dan laporan bulanan menampilkan tindakan yang terbuka dan terlambat secara sekilas.'],
    ['Structured information supports sounder safety decisions.', 'Informasi yang terstruktur mendukung keputusan keselamatan yang lebih tepat.']] },
  { id: 'v1s7', s: [
    ['Structured, connected, and focused on continuous improvement.', 'Terstruktur, terhubung, dan berfokus pada perbaikan berkelanjutan.'],
    ['HSE Project. Smarter safety. Better management. Safer workplace.', 'HSE Project. Keselamatan lebih cerdas. Pengelolaan lebih baik. Tempat kerja lebih aman.']] }];

const V2 = [
  { id: 'v2s1', s: [
    ['Every useful application rests on a structure of data, business rules, integrations, and access control.', 'Setiap aplikasi yang berguna bertumpu pada struktur data, aturan bisnis, integrasi, dan kendali akses.'],
    ['Let\'s look under the hood of HSE Project, using its real source code and database.', 'Mari melihat bagian dalam HSE Project, langsung dari kode sumber dan basis datanya.']] },
  { id: 'v2s2', s: [
    ['The front end is plain HTML, CSS, and JavaScript, with no framework or build step, hosted on GitHub Pages.', 'Antarmuka dibangun dengan HTML, CSS, dan JavaScript murni, tanpa framework atau proses build, dihosting di GitHub Pages.', 'The front end is plain H T M L, C S S, and JavaScript, with no framework or build step, hosted on GitHub Pages.'],
    ['As a Progressive Web App, it can be installed on a phone.', 'Sebagai Progressive Web App, aplikasi ini dapat dipasang di ponsel.'],
    ['The back end is Supabase: a Postgres database with an automatic REST API, multi-factor sign-in, and private file storage.', 'Backend-nya Supabase: basis data PostgreSQL dengan API REST otomatis, login multifaktor, dan penyimpanan berkas privat.', 'The back end is Soopa-base: a Postgres database with an automatic rest A P I, multi-factor sign-in, and private file storage.'],
    ['Integrations include Google Apps Script for Sheets, Open-Meteo for weather, and in-browser document readers.', 'Integrasinya meliputi Google Apps Script untuk Sheets, Open-Meteo untuk cuaca, dan pembaca dokumen di peramban.', 'Integrations include Google Apps Script for Sheets, Open Meteo for weather, and in-browser document readers.']] },
  { id: 'v2s3', s: [
    ['It all starts in index dot html, which loads the configuration and modules under a strict content security policy.', 'Semuanya dimulai dari index.html, yang memuat konfigurasi dan modul di bawah kebijakan keamanan konten yang ketat.', 'It all starts in index dot H T M L, which loads the configuration and modules under a strict content security policy.'],
    ['Routing uses the address hash: a route table maps addresses to pages, and a permission table lists the allowed roles.', 'Routing memakai hash pada alamat: tabel rute memetakan alamat ke halaman, dan tabel hak menentukan peran yang diizinkan.'],
    ['A small helper builds the interface element by element, so user text is never executed as code.', 'Fungsi kecil membangun antarmuka elemen demi elemen, sehingga teks pengguna tidak pernah dieksekusi sebagai kode.'],
    ['All data access goes through api dot js, in demo mode or against Supabase.', 'Semua akses data melewati api.js, dalam mode demo atau terhubung ke Supabase.', 'All data access goes through A P I dot J S, in demo mode or against Soopa-base.']] },
  { id: 'v2s3b', s: [
    ['Here\'s a hazard report in action. The send button stays disabled until a category is chosen.', 'Berikut contoh pelaporan bahaya. Tombol kirim tetap nonaktif sampai kategori dipilih.'],
    ['On submit, the browser calls the report submission function through the API, and the server returns the new report number.', 'Saat dikirim, peramban memanggil fungsi kirim_laporan melalui API, dan server mengembalikan nomor laporan yang baru.', 'On submit, the browser calls the report submission function through the A P I, and the server returns the new report number.']] },
  { id: 'v2s4', s: [
    ['Critical rules run in the database, not the browser. This function checks the user\'s role, category, unit, text length, and patient identifiers.', 'Aturan penting berjalan di basis data, bukan di peramban. Fungsi ini memeriksa peran pengguna, kategori, unit, panjang teks, dan identitas pasien.'],
    ['It also blocks duplicates and generates a readable report number.', 'Fungsi ini juga mencegah duplikasi dan membuat nomor laporan yang mudah dibaca.'],
    ['Simple reads use the REST API, but key status changes, like assignment, closure, or permit approval, only happen through server functions that enforce the workflow.', 'Pembacaan sederhana memakai API REST, tetapi perubahan status penting, seperti penugasan, penutupan, atau pengesahan izin, hanya terjadi lewat fungsi server yang menegakkan alur kerja.', 'Simple reads use the rest A P I, but key status changes, like assignment, closure, or permit approval, only happen through server functions that enforce the workflow.'],
    ['Triggers then create notifications, record an audit trail, and queue data for synchronization.', 'Trigger kemudian membuat notifikasi, mencatat jejak audit, dan mengantrekan data untuk sinkronisasi.']] },
  { id: 'v2s5', s: [
    ['The schema has thirty-two tables, seventy-four functions, thirty-eight triggers, and fifty-nine row-level security policies.', 'Skemanya memiliki 32 tabel, 74 fungsi, 38 trigger, dan 59 kebijakan Row Level Security.'],
    ['Reports sit at the center. An investigation references one incident report, and a corrective action can reference an investigation, a report, or a training activity.', 'Laporan menjadi pusat. Investigasi merujuk satu laporan kejadian, dan CAPA dapat merujuk investigasi, laporan, atau kegiatan pelatihan.'],
    ['Root cause analysis is stored as JSON inside the investigation, not in a separate table.', 'Analisis akar masalah disimpan sebagai JSON di dalam investigasi, bukan di tabel terpisah.', 'Root cause analysis is stored as Jason inside the investigation, not in a separate table.'],
    ['Work permits reference a job safety analysis and a report, but the job safety analysis is not yet linked to the risk register.', 'Izin kerja merujuk JSA dan laporan, tetapi JSA belum terhubung langsung ke risk register.'],
    ['Unique keys prevent duplicates, such as two active investigations for one report, and constraints keep the data consistent.', 'Kunci unik mencegah duplikasi, misalnya dua investigasi aktif untuk satu laporan, dan constraint menjaga data tetap konsisten.']] },
  { id: 'v2s6', s: [
    ['The Google Sheets integration is one-way: Supabase remains the source of truth, and Sheets is a reporting mirror.', 'Integrasi Google Sheets bersifat satu arah: Supabase tetap menjadi sumber data resmi, dan Sheets hanya cermin pelaporan.', 'The Google Sheets integration is one-way: Soopa-base remains the source of truth, and Sheets is a reporting mirror.'],
    ['Every ten minutes, a time-based trigger pulls a queue of changes through a secured function.', 'Setiap sepuluh menit, pemicu waktu menarik antrean perubahan melalui fungsi yang diamankan.'],
    ['Rows are written by ID, so they never duplicate, and failures are retried up to ten times.', 'Baris ditulis berdasarkan ID sehingga tidak pernah tergandakan, dan kegagalan dicoba ulang hingga sepuluh kali.', 'Rows are written by I D, so they never duplicate, and failures are retried up to ten times.'],
    ['This code is from the repository; the production Apps Script project could not be inspected directly.', 'Kode ini berasal dari repositori; proyek Apps Script produksi tidak dapat diperiksa secara langsung.']] },
  { id: 'v2s7', s: [
    ['Let\'s follow one incident end to end. A staff member signs in and submits a report, which is validated and stored with a number and a status.', 'Mari ikuti satu insiden dari awal hingga akhir. Petugas masuk dan mengirim laporan, yang divalidasi lalu disimpan dengan nomor dan status.'],
    ['A trigger alerts every safety officer, and the team investigates with a timeline, five whys, and a fishbone diagram.', 'Trigger memberi notifikasi kepada semua petugas K3, dan tim menyelidiki dengan kronologi, 5 Why, dan diagram Fishbone.'],
    ['The investigation cannot be submitted without a corrective action, and someone other than the team lead must approve it.', 'Investigasi tidak dapat diajukan tanpa CAPA, dan harus disetujui oleh orang selain ketua tim.'],
    ['Once the action is completed and verified, the investigation closes, and the dashboard updates.', 'Setelah CAPA selesai dan diverifikasi, investigasi ditutup dan dasbor diperbarui.']] },
  { id: 'v2s8', s: [
    ['Users sign in through Supabase Auth, and safety administrators must use multi-factor authentication.', 'Pengguna masuk melalui Supabase Auth, dan admin K3 wajib memakai autentikasi multifaktor.', 'Users sign in through Soopa-base auth, and safety administrators must use multi-factor authentication.'],
    ['Three roles, staff, unit lead, and safety officer, are enforced by row-level security, so even a direct API call returns only permitted data.', 'Tiga peran, yaitu petugas, PJ unit, dan K3RS, ditegakkan oleh Row Level Security, sehingga panggilan API langsung pun hanya mengembalikan data yang diizinkan.', 'Three roles, staff, unit lead, and safety officer, are enforced by row-level security, so even a direct A P I call returns only permitted data.'],
    ['Anonymous reporters\' identities are never readable, and the only key in the browser is the public anonymous key.', 'Identitas pelapor anonim tidak pernah dapat dibaca, dan satu-satunya kunci di peramban adalah kunci publik anon.']] },
  { id: 'v2s9', s: [
    ['Changes are built on a separate branch, then merged into main, and GitHub Pages publishes them automatically.', 'Perubahan dikembangkan di cabang terpisah, lalu digabung ke main, dan GitHub Pages menerbitkannya secara otomatis.'],
    ['The database evolves through numbered, re-runnable migrations, each with a rollback.', 'Basis data berubah melalui migrasi bernomor yang aman dijalankan ulang, masing-masing dengan rollback.'],
    ['Every release is re-tested: one hundred nine database checks, fifty end-to-end scenarios, mobile layout checks, and persona-based acceptance tests.', 'Setiap rilis diuji ulang: 109 pemeriksaan basis data, 50 skenario ujung ke ujung, uji tampilan ponsel, dan uji penerimaan berbasis persona.'],
    ['Email and push notifications, a hospital-specific risk matrix, and residual risk scoring are planned, not yet active.', 'Notifikasi email dan push, matriks risiko sesuai rumah sakit, dan penilaian risiko residual masih direncanakan, belum aktif.']] },
  { id: 'v2s10', s: [
    ['HSE Project combines safety management practice with clear, traceable engineering.', 'HSE Project memadukan praktik manajemen keselamatan dengan rekayasa perangkat lunak yang jelas dan dapat ditelusuri.'],
    ['Its understandable architecture lets it keep evolving with each organization\'s needs.', 'Arsitekturnya yang mudah dipahami memungkinkan aplikasi ini terus berkembang sesuai kebutuhan setiap organisasi.']] }];
module.exports = { V1, V2 };
