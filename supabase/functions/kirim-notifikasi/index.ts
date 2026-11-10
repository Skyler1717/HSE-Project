// Supabase Edge Function: kirim-notifikasi
// Mengambil antrean public.notifikasi_kirim (via notif_ambil), mengirim email (Resend) dan Web Push (VAPID),
// lalu melaporkan status pengiriman (via notif_lapor). Coba ulang dengan jeda eksponensial diatur di basis data.
//
// SEMUA kunci dibaca dari secret Edge Function — tidak pernah dari frontend:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  (disediakan otomatis oleh Supabase)
//   NOTIF_CRON_SECRET     wajib; pemanggil (pg_cron) mengirim header  x-hse-cron: <nilai>
//   APP_URL               mis. https://skyler1717.github.io/HSE-Project/
//   RESEND_API_KEY, NOTIF_EMAIL_DARI   (opsional; tanpa keduanya email ditandai "dilewati")
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT  (opsional; tanpa ketiganya push ditandai "dilewati")
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import webpush from 'npm:web-push@3.6.7';
import { prosesBatch, samaAman } from './logika.mjs';

const env = (k: string) => Deno.env.get(k) ?? '';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Metode tidak diizinkan', { status: 405 });
  if (!env('NOTIF_CRON_SECRET') || !samaAman(req.headers.get('x-hse-cron'), env('NOTIF_CRON_SECRET'))) return new Response('Tidak berwenang', { status: 401 });

  const db = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });
  const cfg = {
    basisUrl: env('APP_URL') || 'https://skyler1717.github.io/HSE-Project/',
    namaAplikasi: 'HSE SAFETY FIRST',
    emailAktif: !!(env('RESEND_API_KEY') && env('NOTIF_EMAIL_DARI')),
    pushAktif: !!(env('VAPID_PUBLIC_KEY') && env('VAPID_PRIVATE_KEY') && env('VAPID_SUBJECT')),
  };
  if (cfg.pushAktif) webpush.setVapidDetails(env('VAPID_SUBJECT'), env('VAPID_PUBLIC_KEY'), env('VAPID_PRIVATE_KEY'));

  const kirim = {
    async email(it: any, surat: any) {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + env('RESEND_API_KEY'), 'Content-Type': 'application/json', 'Idempotency-Key': 'hse-notif-' + it.kirim_id },
        body: JSON.stringify({ from: env('NOTIF_EMAIL_DARI'), to: [it.email], subject: surat.subjek, html: surat.html, text: surat.teks }),
      });
      if (!r.ok) throw new Error('Resend ' + r.status + ': ' + (await r.text()).slice(0, 200));
    },
    async push(s: any, payload: string) {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 86400, urgency: 'high' });
    },
  };

  const { data: batch, error } = await db.rpc('notif_ambil', { p_batas: 50 });
  if (error) return Response.json({ galat: error.message }, { status: 500 });
  const hasil = await prosesBatch(batch ?? [], kirim, cfg);
  if (!hasil.length) return Response.json({ diproses: 0 });
  const { data: ringkas, error: e2 } = await db.rpc('notif_lapor', { p_hasil: hasil });
  if (e2) return Response.json({ galat: e2.message }, { status: 500 });
  return Response.json({ diproses: hasil.length, ...ringkas, email: cfg.emailAktif, push: cfg.pushAktif });
});
