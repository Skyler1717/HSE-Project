-- =====================================================================
-- AUDIT READ-ONLY (SELECT only — changes nothing).
-- Run in Supabase > SQL Editor, one section at a time, and send the results back.
-- =====================================================================

-- 1. Tables and columns in the public schema
select table_name, column_name, udt_name, is_nullable, column_default
  from information_schema.columns
 where table_schema = 'public'
 order by table_name, ordinal_position;

-- 2. Enum values (role list = peran_t)
select t.typname, e.enumlabel
  from pg_type t join pg_enum e on e.enumtypid = t.oid
 where t.typnamespace = 'public'::regnamespace
 order by t.typname, e.enumsortorder;

-- 3. User counts per role and status
select peran, aktif, count(*) from public.profil group by 1, 2 order by 1, 2;

-- 4. Administrator accounts (peran = k3rs) + MFA status
select u.email, p.nama_tampilan, p.peran, p.aktif, p.unit_id, u.created_at, u.last_sign_in_at,
       exists (select 1 from auth.mfa_factors f where f.user_id = u.id and f.status = 'verified') as mfa_aktif
  from public.profil p join auth.users u on u.id = p.id
 where p.peran = 'k3rs'
 order by u.created_at;

-- 5. Data consistency: auth users without a profile
select u.id, u.email, u.created_at
  from auth.users u left join public.profil p on p.id = u.id
 where p.id is null;

-- 6. Constraints on public.profil
select conname, pg_get_constraintdef(oid)
  from pg_constraint where conrelid = 'public.profil'::regclass;

-- 7. RLS status per table, and every policy
select c.relname, c.relrowsecurity as rls_on, c.relforcerowsecurity as rls_force
  from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind = 'r' order by 1;
select schemaname, tablename, policyname, cmd, roles, qual, with_check
  from pg_policies where schemaname in ('public', 'storage') order by 1, 2, 3;

-- 8. Table/column privileges for anon and authenticated
select grantee, table_name, privilege_type
  from information_schema.role_table_grants
 where table_schema = 'public' and grantee in ('anon', 'authenticated') order by 2, 1, 3;
select grantee, table_name, column_name, privilege_type
  from information_schema.column_privileges
 where table_schema = 'public' and grantee in ('anon', 'authenticated') order by 2, 3, 1;

-- 9. Functions: SECURITY DEFINER, search_path, who may EXECUTE them
select p.proname, pg_get_function_identity_arguments(p.oid) as argumen,
       p.prosecdef as security_definer, p.proconfig as pengaturan,
       has_function_privilege('anon', p.oid, 'execute') as anon_boleh,
       has_function_privilege('authenticated', p.oid, 'execute') as authenticated_boleh
  from pg_proc p where p.pronamespace = 'public'::regnamespace order by 1;

-- 10. Triggers on public and auth (including the new-user trigger)
select tgrelid::regclass as tabel, tgname, tgenabled, pg_get_triggerdef(oid)
  from pg_trigger
 where not tgisinternal
   and tgrelid in (select oid from pg_class where relnamespace in ('public'::regnamespace, 'auth'::regnamespace))
 order by 1, 2;

-- 11. Live definitions of the role-check functions (spot differences from the repo)
select proname, pg_get_functiondef(oid) from pg_proc
 where pronamespace = 'public'::regnamespace
   and proname in ('fn_peran', 'fn_k3rs', 'fn_boleh_lihat', 'atur_pengguna', 'trg_user_baru', 'daftar_pengguna');

-- 12. Settings and the last 50 user-management actions
select * from public.pengaturan;
select pada, aktor, peran, aksi, objek_id, ringkas
  from public.log_aktivitas where aksi like 'pengguna.%' order by pada desc limit 50;
