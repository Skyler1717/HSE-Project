# Fase 1: Audit Sistem HSE Project

Tanggal: 5 November 2026. Status: **hanya laporan, belum ada yang diubah.**

**Sumber audit:** kode di repo (`supabase/01_setup.sql`, `supabase/usulan/*.sql`, `js/*.js`, `css/app.css`, `index.html`, `sw.js`) dan hasil langkah sebelumnya yang dijalankan pemilik di SQL Editor.

**Keterbatasan:** lingkungan kerja saya tidak bisa terhubung ke Supabase. Struktur database *aktual* dianggap sama dengan `01_setup.sql` ditambah migrasi Admin Utama, sampai dikonfirmasi dengan `supabase/usulan/00_audit_hanya_baca.sql` (bagian 1, 7, 9, 10).

---

## 1. Struktur database (sesuai skrip setup)

| Tabel | Isi | Kunci dan relasi |
|---|---|---|
| `pengaturan` | 1 baris: nama instansi, `wajib_mfa_admin`, `hari_eskalasi`, `pita_risiko` (jsonb), `nomor_darurat`, `zona_waktu` | PK `id = 1` |
| `unit` | Daftar unit RS (IGD, ICU, IPSRS, KESLING, …) | PK `id` serial, `kode` unik |
| `kategori` | 8 kategori bahaya (biologi, kimia, fisik, ergonomi, psikososial, mekanik, kebakaran, limbah) | PK `kode` |
| `profil` | `id`, `nama_tampilan`, `peran`, `unit_id`, `aktif`, `dibuat_pada` | PK = FK `auth.users.id` (cascade); FK `unit` |
| `laporan` | Laporan bahaya, nyaris celaka, dan kejadian; penilaian risiko; status; penanggung jawab; target | PK uuid, `nomor` unik, `id_klien` unik; FK `kategori`, `unit`, `profil` (pelapor, PJ) |
| `tindak_lanjut` | Tindakan per laporan + tingkat pengendalian + bukti | FK `laporan` (cascade), `profil` |
| `riwayat_status` | Jejak perubahan status | FK `laporan` |
| `log_aktivitas` | Log tindakan (ringkas, tanpa data sensitif) | — |
| `admin_utama` | 1 baris: Admin Utama (migrasi baru) | FK `profil` |
| `audit_admin` | Audit tindakan admin, sebelum/sesudah (migrasi baru) | — |

**Tipe data enum:**
- `peran_t`: `petugas`, `pj_unit`, `k3rs`
- `status_t`: `baru`, `ditugaskan`, `dalam_tindak_lanjut`, `terkendali_sementara`, `tertutup`, `tidak_dilanjutkan`
- `level_t`: `eliminasi`, `substitusi`, `rekayasa`, `administratif`, `apd`

**Kolom yang diisi otomatis:**
- `laporan.skor` = `dampak × kemungkinan` (1–25). Labelnya mengikuti `pengaturan.pita_risiko`: Rendah ≤4, Sedang ≤9, Tinggi ≤14, Sangat Tinggi ≤25.

**Trigger:**
- `user_baru` (di `auth.users`)
- `laporan_aturan` dan `laporan_riwayat` (di `laporan`)
- `profil_lindungi` dan `pengaturan_lindungi` (baru)

**Storage:** bucket privat `foto` (maks. 5 MB; JPEG, PNG, WEBP). Tidak ada kebijakan ubah atau hapus, jadi bukti foto tidak bisa diubah.

## 2. Modul HSE yang benar-benar ada

| Modul aplikasi | Rute | Padanan istilah dalam permintaan |
|---|---|---|
| Lapor bahaya, nyaris celaka, kejadian (+ foto, anonim dengan kode lacak, QR per unit) | `/lapor`, `/lacak`, `/qr` | **Hazard Report**, **Incident Report** (`laporan.jenis`) |
| Penilaian risiko dampak × kemungkinan, pita risiko | detail laporan | **Risk Register** (ada ekspor "format register" CSV) |
| Penugasan PJ + target + tindak lanjut berhierarki pengendalian + status | `/tugas`, `/semua`, detail | **CAPA** (`tindak_lanjut` + status + `target_tanggal`) |
| Dasbor statistik | `/dasbor` (fungsi `statistik()`) | **Dashboard** |
| Ekspor CSV | `/ekspor` | — |
| Asisten K3 berbasis aturan, berjalan di HP tanpa internet | `/asisten` (`js/asisten.js`) | Cikal bakal AI Assistant |
| Admin: pengguna, pengaturan, log, MFA, riset, paket | `/pengguna`, `/pengaturan`, `/log`, `/mfa`, `/riset`, `/paket` | — |

**Belum ada di aplikasi:**
- Modul **Inspection** (temuan inspeksi)
- Modul **HSE Monitoring**
- **Manajemen dokumen/SOP**

Tab Google Sheets dan angka "temuan inspeksi" belum punya sumber data. Ini perlu diputuskan (lihat §10).

## 3. Role dan permission

| Peran | Akses data laporan | Menu |
|---|---|---|
| `petugas` | Hanya laporan miliknya | Lapor, laporan saya, lacak, asisten, akun |
| `pj_unit` | Laporan unitnya, laporan yang ditugaskan kepadanya, laporan miliknya | + tugas, laporan unit, dasbor (unit), ekspor |
| `k3rs` (Administrator) | Semua (wajib MFA bila `wajib_mfa_admin`) | + admin, pengguna, pengaturan, QR, log, riset, paket |
| Admin Utama (`k3rs` + `admin_utama`) | Sama seperti k3rs | + hak eksklusif: kelola akun admin, aturan MFA |

- IPSRS dan Kesling = `pj_unit` pada unit IPSRS dan KESLING (keputusan sebelumnya).
- Hak akses ditegakkan di database lewat RLS dan fungsi `SECURITY DEFINER` (`fn_peran`, `fn_k3rs`, `fn_boleh_lihat`).
- Pemeriksaan di frontend (`HAK` di `app.js`) hanya untuk menyembunyikan menu.

## 4. Status akun dan alur persetujuan

1. Akun dibuat di Supabase Auth (aplikasi tidak memiliki formulir daftar sendiri).
2. Trigger `user_baru` membuat profil `petugas` dengan **`aktif = false`**.
3. Admin menyetujui dan mengatur peran lewat `atur_pengguna()`. Perubahan yang menyangkut akun admin hanya bisa dilakukan Admin Utama.
4. Akun nonaktif: `fn_peran()` menghasilkan `null`, sehingga tidak ada laporan, statistik, atau unggahan foto yang bisa diakses. Aplikasi menampilkan layar "Menunggu persetujuan".

## 5. RLS per tabel

| Tabel | SELECT | Tulis dari aplikasi |
|---|---|---|
| `pengaturan` | Pengguna aktif | UPDATE kolom tertentu: k3rs (MFA: Admin Utama) |
| `unit`, `kategori` | Semua yang login (termasuk nonaktif, risiko sangat rendah) | INSERT/UPDATE: k3rs |
| `profil` | Diri sendiri; k3rs semua | Hanya lewat fungsi |
| `laporan` | `fn_boleh_lihat(id)`; kolom `pelapor_id`, `kode_lacak_hash`, `id_klien` **tidak diberikan** | Hanya lewat fungsi |
| `tindak_lanjut`, `riwayat_status` | Mengikuti laporan induk | Hanya lewat fungsi |
| `log_aktivitas`, `audit_admin` | k3rs | Hanya lewat fungsi/trigger |
| `admin_utama` | Tidak ada (tertutup) | Tidak ada |
| `storage.objects` (`foto`) | Folder sendiri, k3rs, atau foto dari laporan yang boleh dilihat | INSERT ke folder sendiri bila aktif |

**Penilaian:** baik. Tidak ada tulis langsung ke tabel inti, identitas pelapor tersembunyi, dan teks berisi identitas pasien ditolak (`fn_ada_identitas_pasien`).

## 6. Arsitektur saat ini

- **Frontend:** JavaScript murni (tanpa framework/build), PWA (`manifest.webmanifest`, `sw.js`), di-hosting **GitHub Pages** dari cabang `main`.
- **Mode ganda di `js/api.js`:** Supabase (bila `config.js` terisi) atau MODE DEMO (data contoh di HP).
- **Backend:** Supabase. Logika bisnis di fungsi SQL (`kirim_laporan`, `tugaskan`, `tambah_tindak_lanjut`, `ubah_status`, `statistik`, …).
- **Belum ada:** Edge Functions, cron, ekstensi `pg_net`/`pgvector`, rahasia server.
- **CSP (`index.html`):** `connect-src` hanya `*.supabase.co` dan `cdn.jsdelivr.net`. Edge Functions (`*.supabase.co/functions/v1`) sudah tercakup.

## 7. Risiko keamanan dan privasi yang relevan dengan rencana baru

| # | Temuan | Dampak | Rekomendasi |
|---|---|---|---|
| S1 | **Asisten saat ini sengaja offline** ("tidak mengirim teks ke layanan luar"). Aplikasi juga menampilkan peringatan: *"Data nyata baru boleh dipakai setelah persetujuan etik dan keputusan pengelola data rumah sakit."* | Mengirim data ke OpenAI dan Google adalah **perubahan kebijakan data**, bukan sekadar fitur | Perlu persetujuan tertulis pengelola data RS (dan etik bila untuk riset), sesuai UU No. 27/2022 tentang Pelindungan Data Pribadi. Perbarui teks privasi di aplikasi. |
| S2 | `laporan.uraian` adalah teks bebas: bisa memuat nama staf atau kondisi pasien meski ada filter | Kebocoran ke Sheets/AI | Minimisasi: jangan kirim `pelapor_id`, nama pelapor, kode lacak, `foto_path`. Untuk `uraian`, saring ulang di server. Opsi: Sheets tanpa uraian penuh. |
| S3 | Google Sheets mudah dibagikan ulang dan tidak mengenal RLS | Siapa pun yang memegang tautan melihat semua unit | Sheet dibagikan hanya ke akun Google tertentu; akses tulis hanya service account; sheet diperlakukan sebagai data k3rs. |
| S4 | Laporan anonim | Sheet/AI tidak boleh membuka jalan ke identitas | Pertahankan: tidak ada kolom pelapor sama sekali. |
| S5 | Prompt injection dari dokumen SOP yang diunggah | AI dibelokkan | Dokumen hanya sebagai data (kutipan), AI tanpa alat tulis, pembatas sistem, dan hanya k3rs yang boleh mengunggah. |
| S6 | Kebocoran antarunit lewat AI | Pengguna `pj_unit` melihat data unit lain | Edge Function memanggil database **dengan JWT pengguna**, sehingga RLS yang sudah ada berlaku otomatis; tidak memakai service role untuk data laporan. |
| S7 | Fungsi baru di Supabase otomatis bisa dipanggil `anon` | Eskalasi | Setiap fungsi baru: `revoke … from public, anon` (pola sudah dipakai). |
| S8 | Biaya OpenAI tak terkendali | Tagihan | Batas per pengguna per hari, catat token dan biaya, batas panjang input. |
| S9 | `pelapor_id` di tabel `laporan` tidak terbaca aplikasi | — (sudah baik) | Edge Function juga tidak boleh membacanya. |

## 8. Batasan teknis yang harus diketahui sejak awal

1. **Saya tidak bisa men-deploy atau menguji langsung ke Supabase/Google/OpenAI dari lingkungan ini** (jaringan diblokir). Saya menyiapkan kode dan skrip; Anda yang menjalankan deploy (Supabase CLI atau Dashboard) dan memasang rahasia. Pengujian otomatis saya jalankan dengan tiruan (mock).
2. **Edge Functions** punya batas waktu dan CPU per permintaan. Ekstraksi PDF/DOCX kecil–sedang memungkinkan; **OCR PDF hasil scan** tidak praktis di Edge Function. Usulan: render halaman lalu kirim ke model OpenAI yang bisa membaca gambar (berbayar per halaman), atau minta dokumen versi teks. Perlu keputusan.
3. **Supabase Cron (`pg_cron`) + `pg_net`** tersedia di semua paket, tetapi perlu diaktifkan di Dashboard > Database > Extensions.
4. **Google Sheets API** punya kuota sekitar 60 permintaan tulis per menit per akun. Sinkronisasi harus berkelompok (batch) lewat antrean, bukan satu panggilan per baris.
5. Menjaga **mode demo** tetap jalan: fitur Sheets dan AI hanya muncul di mode Supabase.

## 9. Tabel tambahan yang diusulkan (rancangan; detail SQL di Tahap 2)

| Tabel | Fungsi |
|---|---|
| `sinkron_antrean` | Kotak keluar (outbox): diisi trigger setiap laporan/tindak lanjut/status berubah. `(objek, objek_id, versi)` unik untuk mencegah duplikasi; status, jumlah percobaan, error terakhir, jadwal coba lagi. |
| `sinkron_riwayat` | Log setiap batch kirim ke Sheets (berhasil/gagal, jumlah baris, pesan error). |
| `laporan_bulanan` | `periode` (unik), waktu proses, status, angka hasil (jsonb), tautan sheet. Mencegah laporan ganda. |
| `ai_percakapan`, `ai_pesan` | Riwayat chat per pengguna (RLS: hanya pemilik); `hapus_setelah` untuk retensi. |
| `ai_penggunaan` | Token masuk/keluar, model, biaya perkiraan, latensi; dasar *rate limit*. |
| `dokumen`, `dokumen_versi`, `dokumen_potongan` | Metadata SOP (judul, nomor, versi, status aktif/diganti, unit/peran yang boleh akses), potongan teks + nomor halaman + `embedding vector(1536)` + indeks teks penuh. |
| Bucket `dokumen` (privat) | Berkas asli; akses lewat RLS sesuai `dokumen`. |

**Pendekatan sinkronisasi yang disarankan: trigger → outbox → cron (tiap 5 menit) → Edge Function.** Dibanding Database Webhooks langsung, pendekatan ini lebih tahan gangguan:
- Penyimpanan laporan **tidak pernah** menunggu Google.
- Retry dan sinkron ulang mudah.
- Idempoten: baris di Sheets dicari berdasarkan kolom ID lalu diperbarui (*upsert*), bukan ditambah lagi.

**Pendekatan AI yang disarankan:**
- Edge Function `ai-asisten` memverifikasi JWT, lalu memastikan `profil.aktif` dan peran dari database.
- Model hanya boleh memanggil **alat yang sudah ditentukan**: `ringkasan_statistik`, `cari_laporan`, `cari_dokumen`, `angka_bulanan`. Setiap alat menjalankan fungsi SQL dengan JWT pengguna.
- Tidak ada SQL bebas dan tidak ada alat tulis.
- Angka resmi selalu dari fungsi SQL, bukan dihitung oleh AI.

## 10. Keputusan yang dibutuhkan dari Anda

1. **Persetujuan tata kelola data:** apakah pengelola data RS sudah mengizinkan data laporan dikirim ke Google Sheets dan OpenAI (server di luar negeri)? Tanpa ini, saya sarankan AI hanya memakai **data agregat + dokumen SOP**, tanpa teks uraian laporan.
2. **Modul yang belum ada (Inspection, HSE Monitoring):**
   - (a) tab Sheets ditiadakan dulu dan "temuan inspeksi" diisi 0/"belum tersedia", **atau**
   - (b) dibuat modul baru (perluasan cakupan besar, tahap terpisah).
   - Saran: **(a)**.
3. **Kolom `uraian` di Sheets:** kirim penuh, dipotong, atau tidak dikirim? Saran: **dipotong 200 huruf setelah disaring**.
4. **OCR dokumen scan:** pakai OpenAI (berbayar) atau hanya terima PDF berteks/DOCX/TXT dulu? Saran: **tanpa OCR dulu**.
5. **Retensi percakapan AI:** misalnya 90 hari, lalu dihapus otomatis.
6. **Batas pemakaian AI:** misalnya 30 pertanyaan per pengguna per hari.
7. **Akun Google:** Anda perlu membuat Google Cloud project + service account + spreadsheet (saya pandu langkahnya di Tahap 3).
8. **Branding di dalam aplikasi** (catatan Anda): logo + "HSE" + "SAFETY FIRST" yang sama dengan halaman depan dipasang di sidebar dan bilah atas, dan motif Bentenan halus pada latar halaman. Ini perubahan tampilan kecil yang terpisah dari integrasi. Saran: dikerjakan lebih dulu sebagai **Tahap 1b** karena tidak menyentuh database.

## 11. Rencana migrasi dan rollback (garis besar)

| Tahap | Migrasi | Rollback |
|---|---|---|
| 1b Branding | Hanya CSS/JS | `git revert` |
| 2 | Aktifkan `pg_net`, `pg_cron`, `vector`; buat tabel §9 + RLS + fungsi; **tanpa mengubah tabel atau kebijakan lama** | Skrip `drop` untuk objek baru saja (data inti tidak tersentuh) |
| 3 | Trigger outbox pada `laporan`, `tindak_lanjut`, `riwayat_status` (AFTER, dibungkus `exception` agar tidak pernah menggagalkan penyimpanan) + Edge Function `sinkron-sheets` + jadwal cron | Hapus trigger dan jadwal cron; outbox dibiarkan |
| 4 | Fungsi `angka_bulanan(periode)` + Edge Function `laporan-bulanan` + cron tanggal 1 | Hapus jadwal dan fungsi |
| 5–7 | Edge Function `ai-asisten`, `dokumen-proses`; menu baru di sidebar | Matikan fungsi; sembunyikan menu (flag di `pengaturan` atau `config.js`) |

Sebelum setiap migrasi: cadangan database, skrip ditampilkan dan disetujui, lalu dijalankan oleh Anda di SQL Editor.
