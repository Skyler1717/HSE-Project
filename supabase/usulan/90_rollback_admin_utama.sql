-- =====================================================================
-- ROLLBACK for 10_admin_utama.sql — puts the database back exactly as it was.
-- No user, profile or report data is touched. The audit trail is KEPT as evidence;
-- uncomment the last line only if you also want to delete it.
-- =====================================================================
begin;
drop trigger if exists profil_lindungi on public.profil;
drop trigger if exists pengaturan_lindungi on public.pengaturan;
drop function if exists public.alihkan_admin_utama(uuid, text);
drop function if exists public.saya_admin_utama();
drop function if exists public.trg_profil_lindungi();
drop function if exists public.trg_pengaturan_lindungi();
drop function if exists public.fn_admin_utama();
drop table if exists public.admin_utama;
commit;
-- drop table if exists public.audit_admin;
