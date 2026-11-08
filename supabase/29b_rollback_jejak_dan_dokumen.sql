-- ROLLBACK untuk 21_jejak_dan_dokumen.sql. Riwayat jejak perubahan dan metadata dokumen tambahan ikut terhapus.
begin;
do $$ declare t text; begin
  foreach t in array array['laporan','tindak_lanjut','jsa','inspeksi','pemantauan','dokumen'] loop
    execute format('drop trigger if exists %1$s_jejak on public.%1$s', t);
  end loop;
end $$;
drop function if exists public.trg_jejak();
drop table if exists public.jejak_perubahan;
alter table public.dokumen drop column if exists tanggal_tinjau, drop column if exists pemilik, drop column if exists catatan_revisi;
commit;
