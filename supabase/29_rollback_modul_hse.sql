-- =====================================================================
-- ROLLBACK untuk 20_modul_hse.sql — mengembalikan database ke keadaan sebelumnya.
-- PERHATIAN: data JSA, inspeksi, pemantauan, dokumen, riwayat AI, laporan bulanan dan antrean
-- sinkron IKUT TERHAPUS. Ekspor dulu bila masih diperlukan. Laporan, tindak lanjut, pengguna,
-- dan tabel lama TIDAK tersentuh.
-- Berkas di bucket "dokumen" dihapus lewat Dashboard > Storage (Supabase melarang hapus langsung via SQL).
-- =====================================================================
do $$ begin
  perform cron.unschedule('hse-hapus-riwayat-ai'); perform cron.unschedule('hse-laporan-bulanan'); perform cron.unschedule('hse-sinkron-bersih');
exception when others then null; end $$;

begin;
drop trigger if exists laporan_sinkron on public.laporan;
drop trigger if exists tindak_lanjut_sinkron on public.tindak_lanjut;
drop policy if exists "hse unggah dokumen" on storage.objects;
drop policy if exists "hse baca dokumen" on storage.objects;
drop policy if exists "hse hapus dokumen" on storage.objects;
drop table if exists public.dokumen_bagian, public.dokumen, public.jsa, public.inspeksi, public.pemantauan, public.ai_riwayat,
  public.laporan_bulanan, public.sinkron_antrean, public.sinkron_log, public.sinkron_kunci cascade;
drop function if exists public.sinkron_ambil(text, int), public.sinkron_lapor(text, jsonb), public.sinkron_atur_token(text),
  public.sinkron_antre_ulang(text, boolean), public.sinkron_ringkas(), public.fn_cek_token_sinkron(text), public.fn_baris_sinkron(text, text),
  public.trg_antre_sinkron(), public.buat_laporan_bulanan(date, boolean), public.ringkasan_bulanan(date), public.trg_ai_riwayat(),
  public.cari_dokumen(text, int), public.trg_dokumen_aturan(), public.trg_modul_log(), public.trg_modul_aturan(), public.fn_nomor(text), public.fn_shift(timestamptz);
alter table public.pengaturan drop column if exists lintang, drop column if exists bujur;
commit;
-- Opsional (setelah bucket dikosongkan): delete from storage.buckets where id = 'dokumen';
