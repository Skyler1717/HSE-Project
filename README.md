# HSE — Platform Keselamatan Kerja Rumah Sakit (Lapor K3 + HSE Intelligence)

> **Versi 2.0:** HSE Intelligence (peringatan dini, peta risiko, epidemiologi, cuaca, kartu keselamatan), pencarian cerdas + riwayat 60 hari,
> JSA, inspeksi terpandu bersuara, pemantauan K3, SOP & dokumen (OCR), laporan bulanan, sinkron Google Sheets, dan tiga tema.
> Aktivasi: lihat **docs/PANDUAN_HSE_INTELLIGENCE.md**.

Aplikasi web yang bisa dipasang di layar HP (PWA) untuk sistem K3 empat tahap:
**(a) pencatatan bahaya → (b) penetapan penanggung jawab → (c) tindak lanjut pengendalian → (d) pemantauan status.**

> ⚠️ **Uji coba hanya dengan DATA CONTOH.** Data nyata baru boleh dipakai setelah persetujuan etik
> dan keputusan pengelola data rumah sakit. Aplikasi ini belum diaudit keamanan secara independen.

## Isi folder

| Berkas / folder | Gunanya |
|---|---|
| `index.html` | Halaman utama aplikasi |
| `config.js` | **Satu-satunya berkas yang perlu Anda ubah**: alamat dan kunci *anon* Supabase |
| `css/app.css` | Design system tampilan: merah–putih, navigasi samping di desktop, tombol besar, kontras WCAG AA, mode gelap |
| `js/app.js` | Layar dan alur aplikasi |
| `js/api.js` | Penghubung ke basis data (mode Supabase) atau data contoh di HP (mode demo) |
| `js/asisten.js` | Asisten K3: AI sederhana berbasis aturan, berjalan di HP, tanpa layanan luar |
| `js/qr.js` | Pembuat kode QR per unit (tanpa pustaka luar) |
| `js/intel.js`, `js/grafik.js` | Mesin HSE Intelligence (aturan + statistik) dan grafik/ilustrasi SVG |
| `js/modul.js`, `js/modul-kerja.js`, `js/modul-dok.js` | Halaman Intelligence, pencarian, JSA, inspeksi, pemantauan, SOP, laporan bulanan, Google Sheets |
| `supabase/20_modul_hse.sql`, `supabase/29_rollback_modul_hse.sql` | Migrasi modul baru dan pembatalannya |
| `integrasi/google-sheets/Kode.gs` | Skrip Google Sheets (gratis) |
| `sw.js`, `manifest.webmanifest`, `icons/` | Agar bisa dipasang di layar HP dan tetap terbuka saat sinyal lemah |
| `assets/` | Logo dan motif aksen (gambar geometris buatan sendiri yang terinspirasi tenun Bentenan, Sulawesi Utara) |
| `fonts/` | Huruf Inter (lisensi SIL OFL 1.1, lihat `fonts/LISENSI-Inter-OFL.txt`) — disimpan lokal, tanpa memuat dari luar |
| `supabase/01_setup.sql` | Membuat tabel, aturan status, keamanan (RLS), fungsi, penyimpanan foto |
| `supabase/02_jadikan_admin.sql` | Menjadikan satu akun sebagai admin K3RS |
| `supabase/03_data_contoh.sql` | Mengisi 12 laporan **fiktif** untuk uji coba |
| `docs/` | Panduan pemula, BRD/SRS, paket audit |

## Mencoba tanpa basis data (mode demo)

Biarkan `config.js` kosong, buka aplikasi → pilih "Masuk sebagai …". Data contoh tersimpan di HP itu saja.

## Memasang sungguhan

Ikuti **docs/Panduan_Membuat_Aplikasi_K3.docx** (langkah demi langkah ±5 jam, tanpa terminal).
Ringkasnya: buat proyek Supabase → jalankan 3 berkas SQL → isi `config.js` → unggah folder ini ke GitHub →
aktifkan GitHub Pages → buka alamatnya di HP → "Tambahkan ke Layar Utama".

## Keamanan singkat

- Semua perubahan data lewat fungsi server yang memeriksa peran ("satu pintu"); tabel tidak bisa ditulis langsung.
- Row Level Security: petugas hanya melihat laporannya; PJ unit melihat laporan unitnya; K3RS melihat semua (setelah MFA).
- Identitas pelapor tidak dapat dibaca dari aplikasi; laporan anonim tidak menyimpan nama, foto, maupun jam lapor.
- Teks yang tampak memuat nama/NIK/No. RM pasien ditolak, baik di HP maupun di server.
- Hanya kunci **anon** yang boleh ada di `config.js`. Jangan pernah menaruh kunci `service_role`.

## Batas klaim

Aplikasi ini adalah komponen operasional rancangan sistem K3 pada satu rumah sakit (studi kasus).
Tidak diklaim mengubah angka kecelakaan, tidak diklaim berhasil di rumah sakit lain.

Versi 1.1.0 (pembaruan tampilan; logika dan basis data sama dengan 1.0.0) · Lisensi: [ISI: lisensi pilihan peneliti, mis. MIT]
