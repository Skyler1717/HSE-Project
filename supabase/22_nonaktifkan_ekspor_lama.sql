-- =====================================================================
-- 22_nonaktifkan_ekspor_lama.sql
-- Menutup jalur ekspor lama public.ekspor_laporan_sheets (bukan bagian aplikasi ini, dapat
-- dipanggil tanpa login dengan token dari public.token_sheets). Sinkron resmi tetap lewat
-- sinkron_ambil/sinkron_lapor (antrean, anti-duplikasi, tanpa identitas pelapor).
-- TIDAK menghapus fungsi, tabel, atau data apa pun. Pembatalan ada di bagian bawah.
-- =====================================================================

-- LANGKAH 1 (hanya membaca): kapan token lama terakhir dipakai?
select count(*) filter (where aktif) as token_aktif, max(dipakai_pada) as terakhir_dipakai from public.token_sheets;

-- LANGKAH 2: cabut hak memanggil fungsi lama
revoke execute on function public.ekspor_laporan_sheets(text) from public, anon, authenticated;

-- LANGKAH 3 (verifikasi): ketiga kolom harus false
select has_function_privilege('anon', 'public.ekspor_laporan_sheets(text)', 'execute') as anon,
       has_function_privilege('authenticated', 'public.ekspor_laporan_sheets(text)', 'execute') as login,
       has_function_privilege('public', 'public.ekspor_laporan_sheets(text)', 'execute') as publik;

-- PEMBATALAN (hanya bila benar-benar diperlukan):
-- grant execute on function public.ekspor_laporan_sheets(text) to anon, authenticated;
