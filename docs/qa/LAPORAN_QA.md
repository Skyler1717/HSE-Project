# Laporan QA — HSE Project v2.1 (8 November 2026)

Dasar pengujian: repositori, PostgreSQL 16 lokal dengan tiruan Supabase, Chromium (Playwright).
**Tidak diuji langsung:** Supabase produksi, Apps Script produksi, dan situs GitHub Pages. Lingkungan pengujian tidak dapat menjangkau ketiganya; semua permintaan berakhir dengan batas waktu.

## 1. Ringkasan hasil uji

| Paket | Hasil |
|---|---|
| Basis data (RLS, fungsi, jejak, migrasi aman diulang, rollback) | 39/39 lulus + uji rollback/pasang ulang 20 & 21 |
| Apps Script ↔ basis data | 10/10 lulus |
| Smoke 44 halaman × 3 peran, desktop 1280 px | 0 galat, 0 overflow |
| Smoke 44 halaman × 3 peran, ponsel 360 px | 0 galat, 0 overflow |
| E2E | 31/31 lulus |
| Login Supabase (server tiruan) | lulus |
| Mode Supabase, modul belum aktif | aman, pesan jelas |

## 2. Register bug

| ID | Prio | Bug | Akar masalah | Status | Uji regresi |
|---|---|---|---|---|---|
| B-01 | P1 | Lebar grafik/progres tidak tampil | CSP melarang atribut `style` inline | Diperbaiki (CSSOM) | smoke, e2e |
| B-02 | P1 | Ringkasan bulanan gagal untuk PJ unit | `select *` menyentuh kolom pelapor yang tidak diberi hak | Diperbaiki | db 10 |
| B-03 | P1 | Pesan "modul belum aktif" hilang di sebagian halaman | Galat diterjemahkan dua kali sehingga penanda hilang | Diperbaiki | sbmode |
| B-04 | P1 (keselamatan) | JSA risiko tinggi dapat disetujui hanya dengan APD/administratif | Tidak ada validasi kecukupan pengendalian | Diperbaiki: peringatan saat simpan dan setuju, tanda "perlu ditinjau" | e2e 9 |
| B-05 | P1 | Lencana notifikasi kadang tidak muncul | Pembaruan bergantung jeda 400 ms | Diperbaiki (MutationObserver) | e2e 11 |
| B-06 | P2 | Ambang "risiko tinggi" tidak mengikuti pita risiko di Pengaturan | Angka 10/15 ditulis tetap | Diperbaiki di aplikasi & SQL (`21_…`) | e2e, db |
| B-07 | P2 | Tidak ada nilai lama/baru pada audit | Log hanya ringkasan | Diperbaiki: tabel `jejak_perubahan` | db 20, e2e 10 |
| B-08 | P2 | Dokumen tanpa pemilik, tanggal tinjau, riwayat versi | Metadata belum ada | Diperbaiki | e2e 12 |
| B-09 | P2 | Halaman Pengguna tanpa pencarian/filter | — | Diperbaiki | e2e 13 |
| B-10 | P3 | Desimal memakai titik | Format bawaan JS | Diperbaiki | e2e |
| B-11 | P3 | Glyph status ◐ ◑ tidak terbaca | Font tidak memiliki glyph | Diganti → ↻ | visual |

**Sisa terbuka:** Critical 0 · High 0 (pada kode) · Medium 1 (O-01, perlu pemeriksaan produksi) · Low 0.

## 3. Isu yang belum dapat diverifikasi (memerlukan akses)

- **O-01 (Medium, perlu dicek):** Apps Script produksi sebelumnya memuat kode lain (`tarik_`, `tarikSekarang`). Pesan "Token tidak dikenali atau sudah dicabut" berasal dari fungsi di Supabase produksi yang **tidak ada di repositori**. Kemungkinan ada mekanisme sinkron kedua yang dapat menggandakan data. Periksa dengan:
  `select proname from pg_proc where pronamespace = 'public'::regnamespace and prosrc ilike '%tidak dikenali atau sudah dicabut%';`
- **O-02:** Status migrasi 20/21 dan pg_cron di Supabase produksi belum terverifikasi.
- **O-03:** Versi yang tampil di GitHub Pages belum terverifikasi dari lingkungan ini.

## 4. Skor kualitas (skala 1–5, bukti di atas)

| Kategori | Bobot | Skor | Nilai |
|---|---:|---:|---:|
| Backend & arsitektur | 12 | 4 | 9,6 |
| Basis data & integritas | 10 | 4 | 8,0 |
| Frontend & teknis | 8 | 4 | 6,4 |
| UI | 8 | 4 | 6,4 |
| UX | 10 | 4 | 8,0 |
| Fungsi HSE | 15 | 4 | 12,0 |
| Keamanan & privasi | 12 | 4 | 9,6 |
| Performa | 8 | 3,5 | 5,6 |
| Bahasa & dokumentasi | 5 | 4 | 4,0 |
| Aksesibilitas & responsif | 5 | 4 | 4,0 |
| AI (berbasis aturan + statistik) | 7 | 3 | 4,2 |
| **Total** | 100 | | **77,8 — Good** |

Alasan skor tidak lebih tinggi:
- Produksi belum terverifikasi.
- Belum ada modul investigasi/RCA, izin kerja (permit to work), pelatihan, dan APD.
- JavaScript belum diperkecil (tanpa build step).
- Daftar laporan dibatasi 1.000 baris per muat.
- AI tidak generatif (sesuai keputusan tanpa layanan berbayar).

## 5. Backlog perbaikan (prioritas)

1. Investigasi kecelakaan + analisis akar masalah (5 Why/Fishbone) yang tertaut ke laporan kejadian dan CAPA.
2. Izin kerja (permit to work) untuk pekerjaan panas, ketinggian, listrik, dan ruang terbatas, tertaut ke JSA.
3. Paginasi sisi server untuk laporan di atas 1.000.
4. Notifikasi push/email (memerlukan layanan; pertimbangkan Supabase Edge Function + layanan email gratis).
5. Toolbox meeting dan rekap pelatihan.
