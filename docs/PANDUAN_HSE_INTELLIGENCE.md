# Panduan Aktivasi — HSE Intelligence & Modul K3 (versi 2.2)

Semua komponen **gratis**: Supabase (paket gratis), GitHub Pages, Open-Meteo (cuaca, tanpa kunci),
Google Apps Script, serta pustaka sumber terbuka pdf.js, mammoth, dan tesseract.js (OCR) yang berjalan di perangkat pengguna.
Tidak ada OpenAI atau API berbayar.

## 1. Aktifkan modul di basis data (wajib, sekali)

1. Supabase → **Database → Backups**: pastikan ada cadangan terbaru.
2. Supabase → **Database → Extensions**: aktifkan **pg_cron** (untuk laporan bulanan otomatis dan hapus riwayat 60 hari).
3. Supabase → **SQL Editor** → tempel seluruh isi `supabase/20_modul_hse.sql` → **Run**.
   Hasil benar: *Success*. Bila muncul NOTICE "pg_cron belum dapat diaktifkan", aktifkan pg_cron lalu jalankan ulang berkas yang sama (aman diulang).
4. Jalankan juga `supabase/21_jejak_dan_dokumen.sql` (jejak perubahan + metadata dokumen; aman diulang; rollback `29b_…`).
5. Jalankan `supabase/23_modul_lanjutan.sql` **setelah 21** (investigasi & RCA, CAPA, izin kerja, toolbox/pelatihan, notifikasi, paginasi; aman diulang; rollback `29c_…`).
6. Periksa: `select jobname, schedule from cron.job;` → harus ada `hse-laporan-bulanan`, `hse-hapus-riwayat-ai`, dan (setelah 23) job izin kedaluwarsa & notifikasi terjadwal.

Sebelum langkah ini dijalankan, aplikasi tetap berfungsi. Menu JSA, Inspeksi, Pemantauan, dan SOP menampilkan pesan "Modul belum diaktifkan".

**Rollback:** `supabase/29_rollback_modul_hse.sql`. Berkas ini menghapus hanya objek baru; laporan, tindak lanjut, dan pengguna tidak tersentuh.

## 2. Lokasi cuaca

Masuk sebagai K3RS → **Pengaturan** → kartu *Lokasi rumah sakit untuk peringatan cuaca* → isi lintang/bujur (bawaan: Manado) → Simpan.

## 3. Google Sheets (sinkron otomatis tiap 10 menit)

1. Di aplikasi: **Admin → Google Sheets → Buat token** → salin token (hanya ditampilkan sekali).
2. Buat Google Spreadsheet baru → **Extensions → Apps Script** → tempel isi `integrasi/google-sheets/Kode.gs`.
3. **Project Settings → Script properties**:
   - `SUPABASE_URL` = `https://fkynbegfeodymincuucy.supabase.co`
   - `SUPABASE_ANON_KEY` = kunci anon (sama dengan di `config.js`)
   - `HSE_TOKEN` = token dari langkah 1
4. Pilih fungsi **pasang** → **Run** → izinkan. Tab yang dibuat: Dashboard, Risk Register, Hazard Report, Near Miss, Incident Report, CAPA, JSA, Inspection, HSE Monitoring, Monthly Report.
5. Bagikan spreadsheet hanya ke akun berwenang. Kolom `uraian` dikirim apa adanya sesuai keputusan pengelola data; identitas pelapor, kode lacak, dan foto **tidak** dikirim.

Status, kegagalan, dan tombol *ulang yang gagal / sinkron ulang semua* tersedia di **Admin → Google Sheets**. Baris diperbarui berdasarkan ID, sehingga data tidak pernah digandakan.

## 4. Yang dihitung oleh "HSE Intelligence" (dan batasnya)

| Fitur | Cara kerja |
|---|---|
| Peringatan dini | Lonjakan 30 hari vs rata-rata 90 hari sebelumnya (uji Poisson, p < 0,05, min. 3 laporan); mendesak, CAPA terlambat, risiko ≥ 15 terbuka, pemantauan di luar ambang, JSA risiko tinggi belum disetujui, cuaca |
| Estimasi risiko 30 hari | Frekuensi historis (Poisson). Baru tampil bila ≥ 20 catatan dalam ≥ 90 hari; bila kurang, sistem menyatakan "data belum cukup". **Bukan prediksi pasti.** |
| Analisis bahaya pekerjaan & JSA otomatis | Aturan kata kunci + basis pengetahuan 16 jenis bahaya dengan hierarki pengendalian. Wajib diperiksa di lapangan. |
| Cuaca | Open-Meteo (6 jam ke depan): hujan, petir, angin, indeks panas → pekerjaan terdampak (JSA). **Tidak** menghentikan pekerjaan otomatis. |
| Epidemiologi | Distribusi waktu/shift/hari/unit/jenis; keluhan kesehatan **agregat** per 100 pekerja; deteksi kemungkinan klaster |
| Pencarian cerdas | Pengurai kalimat Indonesia → filter (jenis, unit, shift, rentang waktu, status, bahaya) + teks penuh SOP (PostgreSQL) dengan kutipan halaman |
| Laporan bulanan | Angka dari fungsi SQL `ringkasan_bulanan`; insight disusun dengan aturan dari angka tersebut |

Laporan **anonim** hanya menyimpan tanggal (privasi), sehingga tidak masuk analisis jam/shift. Hal ini dinyatakan di layar.
Model AI generatif (mis. Ollama) dan *machine learning* (scikit-learn) **belum** dipasang karena memerlukan server sendiri.
Arsitekturnya sudah memisahkan mesin analisis (`js/intel.js`), sehingga model dapat ditambahkan kemudian.

## 5. Hak akses (ditegakkan RLS di server)

| Data | Petugas | PJ unit (IPSRS, Kesling, dll.) | K3RS / Admin |
|---|---|---|---|
| JSA | baca JSA unitnya | buat/ubah draf unitnya | semua + menyetujui |
| Inspeksi | baca unitnya | buat untuk unitnya | semua |
| Pemantauan lingkungan | baca unitnya | buat untuk unitnya | semua |
| Pemantauan kesehatan (agregat) | — | baca/buat unitnya | semua |
| SOP & dokumen | baca yang aktif & berlaku untuk unitnya | sama | kelola, unggah versi |
| Riwayat pencarian (60 hari) | milik sendiri | milik sendiri | milik sendiri + audit |

Akun yang belum disetujui tidak dapat membaca apa pun. Semua perubahan JSA, inspeksi, pemantauan, dan dokumen tercatat di Log aktivitas.

## 6. Pengujian yang sudah dijalankan

- **Basis data** (PostgreSQL 16 + tiruan Supabase): 34 pemeriksaan RLS & fungsi, uji rollback, dan uji pasang ulang.
- **Google Apps Script** terhadap basis data sungguhan: 10 pemeriksaan (anti-duplikasi, retry, galat tercatat, tanpa data identitas).
- **Aplikasi** (mode demo, Chromium): 36 halaman × 3 peran tanpa galat, serta 22 skenario ujung-ke-ujung (tema, JSA, inspeksi terpandu, pemantauan, unggah PDF/DOCX/TXT/PNG/PDF pindaian dengan OCR, pencarian SOP, riwayat, laporan bulanan).
- **Mode Supabase dengan modul belum aktif**: aplikasi menampilkan pesan, tidak rusak.


## 7. Notifikasi email & push (opsional — belum aktif sampai diuji)

Notifikasi **di aplikasi** langsung berfungsi setelah berkas 23 dijalankan. Email dan push **tidak** otomatis tersedia di Supabase; keduanya dikirim oleh Edge Function `kirim-notifikasi` yang membaca antrean `notifikasi_kirim`. Tanpa langkah di bawah, entri antrean tetap tersimpan dan akan berstatus `dilewati — belum dikonfigurasi` bila fungsi dijalankan tanpa kunci. Tidak ada kunci rahasia di frontend.

1. **Email (Resend, paket gratis 3.000 email/bulan):** daftar di resend.com, verifikasi domain pengirim, buat API key.
2. **Push (VAPID, gratis):** di komputer jalankan `npx web-push generate-vapid-keys`. Kunci **publik** diisi ke `js/config.js` → `VAPID_PUBLIC_KEY` (aman untuk publik). Kunci **privat** hanya menjadi secret Edge Function.
3. Pasang Supabase CLI, lalu dari akar repo:
   ```bash
   supabase login
   supabase link --project-ref fkynbegfeodymincuucy
   supabase secrets set NOTIF_CRON_SECRET=<acak-panjang> APP_URL=https://skyler1717.github.io/HSE-Project/ RESEND_API_KEY=<kunci> NOTIF_EMAIL_DARI="HSE K3RS <notifikasi@domain-anda>" VAPID_PUBLIC_KEY=<publik> VAPID_PRIVATE_KEY=<privat> VAPID_SUBJECT=mailto:<email-admin>
   supabase functions deploy kirim-notifikasi --no-verify-jwt
   ```
4. Jalankan `supabase/24_jadwal_kirim_notifikasi.sql` (isi dua nilai Vault sesuai petunjuk di berkas). pg_cron memanggil fungsi tiap menit hanya bila ada antrean.
5. **Uji nyata:** buat laporan kejadian uji, tunggu 1–2 menit, lalu periksa
   `select saluran, status, count(*), max(galat) from notifikasi_kirim group by 1,2;` dan kotak masuk email. Saluran baru boleh dianggap aktif setelah status `terkirim` dan email/push benar-benar diterima.

Gagal kirim dicoba ulang otomatis (jeda 10, 20, 40, 80 menit; maksimal 5 kali). Email memakai `Idempotency-Key` per entri sehingga tidak terkirim ganda. Langganan push yang kedaluwarsa (404/410) dihapus otomatis.
