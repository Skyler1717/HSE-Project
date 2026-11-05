-- =====================================================================
-- JADIKAN SATU AKUN SEBAGAI ADMIN K3RS
-- 1) Buat akun dulu di Supabase > Authentication > Users > "Add user".
-- 2) Ganti alamat email di bawah (di antara tanda kutip) dengan email akun itu.
-- 3) Tekan "Run". Tanda berhasil: tabel kecil berisi 1 baris, peran = k3rs.
-- =====================================================================
update public.profil
   set peran = 'k3rs', aktif = true
 where id = (select id from auth.users where email = 'GANTI-DENGAN-EMAIL-ADMIN@contoh.com');

select u.email, p.nama_tampilan, p.peran, p.aktif
  from public.profil p join auth.users u on u.id = p.id
 where p.peran = 'k3rs';
