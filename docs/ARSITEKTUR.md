# Arsitektur & Matriks Akses — HSE Project

**Alur sistem:** Browser/PWA (GitHub Pages, JS murni tanpa build) → Supabase Auth (JWT, MFA admin) → PostgREST + fungsi SQL (`SECURITY DEFINER` dengan pemeriksaan peran) → PostgreSQL + RLS → Storage (`foto`, `dokumen`, privat) → pg_cron (laporan bulanan, retensi) → Google Apps Script (tarik antrean bertoken) → Google Sheets (hanya pelaporan).

**Sumber data resmi: Supabase.** Google Sheets hanya cermin baca-saja. Penulisan dari Sheets ke Supabase tidak didukung.

## Peta modul

| Modul | Rute | Berkas | Tabel / fungsi | Peran |
|---|---|---|---|---|
| Lapor bahaya / nyaris celaka / kejadian | `/lapor`, `/lacak` | app.js | `laporan`, `kirim_laporan`, `cek_kode_lacak` | semua aktif |
| Risk register & CAPA | `/semua`, `/tugas`, `/laporan/:id` | app.js | `laporan`, `tindak_lanjut`, `riwayat_status`, `tugaskan`, `tambah_tindak_lanjut`, `ubah_status` | PJ unit, K3RS |
| Dasbor | `/dasbor` | app.js | `statistik()` | PJ unit, K3RS |
| HSE Intelligence | `/intel` | modul.js, intel.js, grafik.js | data di atas + Open-Meteo | semua (sesuai RLS) |
| Pencarian & riwayat | `/cari` | modul.js | `cari_dokumen`, `ai_riwayat` | semua aktif |
| Notifikasi | `/notifikasi` | modul.js | dihitung dari data | semua aktif |
| JSA | `/jsa` | modul-kerja.js | `jsa` | baca: unit; buat: PJ/K3RS; setuju: K3RS |
| Inspeksi | `/inspeksi` | modul-kerja.js | `inspeksi` | baca: unit; buat: PJ/K3RS |
| Pemantauan | `/pemantauan` | modul-kerja.js | `pemantauan` | lingkungan: unit; kesehatan: PJ/K3RS |
| SOP & dokumen | `/sop` | modul-dok.js | `dokumen`, `dokumen_bagian`, bucket `dokumen` | baca: aktif; kelola: K3RS |
| Laporan bulanan | `/bulanan` | modul-dok.js | `ringkasan_bulanan`, `laporan_bulanan` | PJ/K3RS |
| Google Sheets | `/sinkron` | modul-dok.js, Kode.gs | `sinkron_*` | K3RS |
| Pengguna, pengaturan, log | `/pengguna`, `/pengaturan`, `/log` | app.js | `profil`, `atur_pengguna`, `admin_utama`, `audit_admin`, `log_aktivitas`, `jejak_perubahan` | K3RS (akun admin: Admin Utama) |

## Matriks akses (ditegakkan RLS/fungsi di server, bukan hanya tombol)

| Peran | Lihat | Buat | Ubah | Hapus | Setujui | Ekspor | Kelola |
|---|---|---|---|---|---|---|---|
| Petugas | laporan sendiri; JSA/inspeksi/lingkungan unitnya; SOP aktif | laporan | — | — | — | — | — |
| PJ unit (IPSRS, Kesling, dll.) | laporan unit & tugasnya; kesehatan agregat unitnya | laporan, JSA draf, inspeksi, pemantauan unitnya | tindak lanjut tugasnya; data buatannya | — | — | CSV unit | — |
| K3RS / Admin | semua (dengan MFA) | semua | semua | modul baru | JSA, penutupan laporan | semua + Sheets | pengguna non-admin, pengaturan, dokumen |
| Admin Utama | = K3RS | | | | | | + akun admin, kewajiban MFA |
| Akun menunggu | tidak ada | — | — | — | — | — | — |

## Tata kelola data

- **ID unik:** UUID + nomor terbaca (`K3-…`, `JSA-…`, `INS-…`).
- **Zona waktu:** Asia/Makassar.
- **Retensi:** riwayat pencarian 60 hari (pg_cron); data K3 resmi tidak dihapus otomatis.
- **Jejak perubahan:** `jejak_perubahan` mencatat pelaku, waktu, aksi, nilai lama, dan nilai baru. Pelapor anonim tidak pernah tercatat.
- **Cadangan:** Supabase Backups harian (paket gratis: 7 hari); ekspor CSV dari menu Ekspor.
