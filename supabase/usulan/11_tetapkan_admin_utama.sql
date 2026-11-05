-- =====================================================================
-- LANGKAH 2: TETAPKAN ADMIN UTAMA (jalankan SETELAH 10_admin_utama.sql berhasil)
-- Syarat: akun Anda sudah AKTIF dengan peran K3RS.
-- 1) Ganti email di bawah dengan email akun Anda (di antara tanda kutip).
-- 2) Tekan "Run". Tanda berhasil: hasil akhir berisi tepat 1 baris berisi email Anda.
--    Bila hasilnya kosong: akun belum aktif/bukan K3RS, atau email salah ketik.
-- =====================================================================
insert into public.admin_utama(user_id)
select p.id from public.profil p join auth.users u on u.id = p.id
 where lower(u.email) = lower('GANTI-DENGAN-EMAIL-ANDA@contoh.com') and p.peran = 'k3rs' and p.aktif
on conflict (satu) do nothing;

insert into public.audit_admin(aksi, target, alasan)
select 'admin_utama.tetapkan', user_id, 'Penetapan awal lewat SQL Editor' from public.admin_utama
 where not exists (select 1 from public.audit_admin where aksi = 'admin_utama.tetapkan');

select u.email, a.ditetapkan_pada from public.admin_utama a join auth.users u on u.id = a.user_id;
