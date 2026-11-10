# Changelog

## 2.2.0 — 10 November 2026
- **Investigasi kecelakaan & RCA** (`/investigasi`): dibuat dari laporan kejadian/nyaris celaka (satu investigasi aktif per laporan), tim, kronologi, bukti, saksi, 5 Why bercabang (jumlah "mengapa" dapat diatur), Fishbone 6M interaktif dengan sub-penyebab dan unduh SVG, laporan cetak. Alur: draf → analisis → menunggu persetujuan → disetujui → ditutup; tidak dapat diajukan tanpa CAPA; penyetuju harus K3RS selain ketua tim.
- **CAPA lintas modul** (`/capa`): sumber investigasi, toolbox, pelatihan, inspeksi; PJ hanya mengubah status/bukti; verifikasi efektivitas oleh K3RS selain PJ.
- **Izin kerja / PTW** (`/izin`): kerja panas, ketinggian, listrik, ruang terbatas (daftar periksa dapat diatur admin); alur draf → supervisor → tinjauan K3 → pengesahan → aktif → selesai → ditutup (+ ditolak/ditangguhkan/dibatalkan/kedaluwarsa); masa berlaku ≤ 72 jam, kedaluwarsa otomatis, uji gas dengan ambang, Stop Work Authority untuk semua petugas unit, perpanjangan dengan persetujuan, penutupan wajib konfirmasi area aman; terhubung JSA — JSA berubah → izin ditandai perlu ditinjau dan izin aktif ditangguhkan; dasbor PTW.
- **Toolbox meeting & pelatihan** (`/kegiatan`): nomor TBM/TRN, kalender, peserta internal/eksternal, kehadiran (hadir/absen/izin), presensi QR, pre/post-test, evaluasi, kompetensi terpisah dari kehadiran (wajib metode asesmen), sertifikat, tindak lanjut → CAPA, dasbor.
- **Paginasi sisi server** untuk laporan, risk register, pengguna, investigasi, CAPA, PTW, kegiatan, notifikasi: 10/25/50/100 per halaman, total dari basis data, pencarian/filter/urutan/rentang tanggal di server, ekspor seluruh hasil filter. Kebijakan RLS laporan dioptimalkan (setara, diuji untuk semua peran).
- **Pusat notifikasi**: kotak masuk server (dibaca/belum, tandai semua, filter kategori, riwayat), pengingat terhitung, pengaturan saluran & kategori; notifikasi wajib tidak dapat dimatikan; tanpa duplikat (kunci unik).
- **Antrean email & push** + Edge Function `supabase/functions/kirim-notifikasi` (Resend + Web Push VAPID, coba ulang eksponensial, idempotensi, status pengiriman). **Belum aktif** sampai kunci diatur dan diuji di produksi — lihat panduan bagian 7.
- SQL: `supabase/23_modul_lanjutan.sql` (rollback `29c_…`), `supabase/24_jadwal_kirim_notifikasi.sql` (opsional).

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
