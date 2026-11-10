/* ==========================================================================
   config.js — SATU-SATUNYA BERKAS YANG PERLU ANDA UBAH.
   Isi dua nilai di bawah dari Supabase > Project Settings > API (atau "Data API"):
     - SUPABASE_URL      = "Project URL", bentuknya https://xxxxxxxx.supabase.co
                           (TANPA akhiran /rest/v1/ atau /auth/v1/ — pustaka Supabase menambahkannya sendiri)
     - SUPABASE_ANON_KEY = kunci "anon public" (diawali eyJ...)
   JANGAN PERNAH menaruh kunci "service_role" / "secret" di sini.
   Bila dikosongkan (''), aplikasi berjalan dalam MODE DEMO (data contoh di HP).
   ========================================================================== */
window.K3_CONFIG = {
  SUPABASE_URL: 'https://fkynbegfeodymincuucy.supabase.co',
  // Kunci publik VAPID untuk notifikasi push (opsional; pasangan kunci privatnya hanya di Supabase Edge Function)
  VAPID_PUBLIC_KEY: '',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZreW5iZWdmZW9keW1pbmN1dWN5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM4ODQ3NzgsImV4cCI6MjEwOTQ2MDc3OH0.cbJRBsuguorEmO9jkEwo04pzrRbFK2xJK-d7EQp0U7E'
};
