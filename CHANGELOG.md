# Changelog

## 2.1.0 — 8 November 2026
- Validasi kritis keselamatan: JSA berisiko tinggi tanpa eliminasi/substitusi/rekayasa wajib ditinjau.
- Pusat notifikasi dan eskalasi: laporan baru, risiko tinggi terbuka, CAPA jatuh tempo/terlambat, JSA menunggu persetujuan, verifikasi permanen, dokumen perlu ditinjau, prioritas inspeksi.
- Jejak perubahan lengkap (nilai lama → baru, pelaku, waktu) untuk laporan, CAPA, JSA, inspeksi, pemantauan, dan dokumen (`supabase/21_jejak_dan_dokumen.sql`).
- Pengendalian dokumen: pemilik, tanggal tinjau, catatan revisi, riwayat versi.
- Ambang risiko konsisten dengan pita risiko di Pengaturan (aplikasi dan SQL).
- Pencarian dan filter di halaman Pengguna.
- Paket uji regresi di `tests/` (DB 39, Sheets 10, E2E 31, smoke 44 halaman × 3 peran × 2 lebar layar).
- Apps Script mendukung proyek mandiri (`SHEET_ID`).

## 2.0.0 — 7 November 2026
HSE Intelligence, pencarian cerdas, JSA, inspeksi terpandu, pemantauan, SOP dengan OCR, laporan bulanan, sinkron Google Sheets, tiga tema, dan penghapusan komponen riset.
