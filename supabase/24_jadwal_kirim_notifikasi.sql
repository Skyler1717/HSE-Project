-- =====================================================================
-- 24 — Penjadwalan Edge Function "kirim-notifikasi" (OPSIONAL)
-- Jalankan HANYA setelah:
--   1) 23_modul_lanjutan.sql berhasil,
--   2) Edge Function dideploy:  supabase functions deploy kirim-notifikasi --no-verify-jwt
--      (otorisasi memakai header x-hse-cron, bukan JWT pengguna)
--   3) secret Edge Function diatur (lihat docs/PANDUAN_HSE_INTELLIGENCE.md bagian Notifikasi).
-- Ganti dua nilai <...> di bawah. Nilai rahasia disimpan di Supabase Vault, bukan di kode.
-- Rollback: select cron.unschedule('hse-kirim-notifikasi');
-- =====================================================================
create extension if not exists pg_net;

-- Simpan sekali (ulangi dengan vault.update_secret bila perlu mengganti):
-- select vault.create_secret('https://<PROJECT_REF>.supabase.co/functions/v1/kirim-notifikasi', 'hse_notif_url');
-- select vault.create_secret('<NILAI NOTIF_CRON_SECRET YANG SAMA DENGAN SECRET EDGE FUNCTION>', 'hse_notif_rahasia');

select cron.unschedule('hse-kirim-notifikasi') where exists (select 1 from cron.job where jobname = 'hse-kirim-notifikasi');
select cron.schedule('hse-kirim-notifikasi', '* * * * *', $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'hse_notif_url'),
    headers := jsonb_build_object('Content-Type', 'application/json',
                                  'x-hse-cron', (select decrypted_secret from vault.decrypted_secrets where name = 'hse_notif_rahasia')),
    body := '{}'::jsonb, timeout_milliseconds := 25000)
  where exists (select 1 from public.notifikasi_kirim where status in ('menunggu','diproses') or (status = 'gagal' and percobaan < 5) limit 1);
$$);

-- Pemantauan status pengiriman:
-- select saluran, status, count(*), max(galat) from public.notifikasi_kirim group by 1,2 order by 1,2;
