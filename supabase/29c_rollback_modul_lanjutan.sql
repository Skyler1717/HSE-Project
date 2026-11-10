-- =====================================================================
-- ROLLBACK untuk 23_modul_lanjutan.sql. PERHATIAN: data investigasi, CAPA lintas modul, izin kerja,
-- kegiatan/pelatihan, dan notifikasi IKUT TERHAPUS (ekspor dulu bila perlu). Laporan & data lama tidak tersentuh.
-- Kebijakan RLS laporan dikembalikan ke definisi asli.
-- =====================================================================
do $$ begin perform cron.unschedule('hse-izin-kedaluwarsa'); perform cron.unschedule('hse-notifikasi-terjadwal'); exception when others then null; end $$;
begin;
drop policy if exists baca_laporan on public.laporan;
create policy baca_laporan on public.laporan for select to authenticated using (public.fn_boleh_lihat(id));
drop trigger if exists laporan_notif on public.laporan;
drop trigger if exists jsa_ke_izin on public.jsa;
drop index if exists public.laporan_cari_trgm;
alter table public.laporan drop column if exists cari;
drop table if exists public.notifikasi_kirim, public.notifikasi, public.preferensi_notifikasi, public.push_langganan,
  public.capa, public.izin_jurnal, public.izin_kerja, public.jenis_izin, public.kegiatan_peserta, public.kegiatan, public.investigasi cascade;
drop function if exists public.fn_notif(uuid,text,text,text,text,text,boolean), public.fn_notif_k3rs(text,text,text,text,text,boolean,uuid), public.trg_notif_laporan(),
  public.trg_investigasi_aturan(), public.trg_investigasi_notif(), public.trg_capa_aturan(), public.trg_capa_notif(), public.trg_izin_aturan(),
  public.fn_izin_notif(public.izin_kerja,text,text), public.izin_proses(uuid,text,text,jsonb), public.izin_periksa_kedaluwarsa(), public.trg_jsa_ke_izin(),
  public.fn_penyelenggara(uuid), public.fn_peserta_saya(uuid), public.trg_kegiatan_aturan(), public.trg_peserta_aturan(), public.kegiatan_hadir(text),
  public.kegiatan_kode(uuid), public.notifikasi_terjadwal(), public.notif_ambil(int), public.notif_lapor(jsonb), public.notif_tandai_dibaca(bigint[]),
  public.daftar_pengguna_halaman(text,text,text,int,int) cascade;
commit;
