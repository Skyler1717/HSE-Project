-- =====================================================================
-- PROPOSAL — DO NOT RUN BEFORE APPROVAL.
-- Primary Administrator + admin audit trail.
-- Additive only: no existing table, policy, function or account is changed or dropped.
-- While public.admin_utama is empty, behaviour is identical to today.
-- =====================================================================
begin;

-- A. Primary Administrator registry (exactly one row)
create table if not exists public.admin_utama (
  satu             boolean primary key default true check (satu),
  user_id          uuid not null unique references public.profil(id) on delete restrict,
  ditetapkan_pada  timestamptz not null default now(),
  ditetapkan_oleh  uuid
);
alter table public.admin_utama enable row level security;
revoke all on public.admin_utama from anon, authenticated;   -- no policy: unreachable from the app

-- B. Admin audit trail (append-only from the app's point of view)
create table if not exists public.audit_admin (
  id       bigserial primary key,
  pada     timestamptz not null default now(),
  aktor    uuid,                 -- null = SQL Editor / service role
  aksi     text not null,
  target   uuid,
  sebelum  jsonb,
  sesudah  jsonb,
  alasan   text not null default ''
);
alter table public.audit_admin enable row level security;
revoke all on public.audit_admin from anon, authenticated;
revoke all on sequence public.audit_admin_id_seq from anon, authenticated;
grant select on public.audit_admin to authenticated;
drop policy if exists baca_audit_admin on public.audit_admin;
create policy baca_audit_admin on public.audit_admin for select to authenticated using (public.fn_k3rs());

-- C. Helper: is the current user the Primary Administrator (active, MFA rules satisfied)?
create or replace function public.fn_admin_utama() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select public.fn_k3rs() and exists (select 1 from public.admin_utama where user_id = auth.uid())
$$;

-- D. Guard on profil (runs for EVERY write path, including existing atur_pengguna)
create or replace function public.trg_profil_lindungi() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_utama uuid := (select user_id from public.admin_utama);
  v_aktor uuid := auth.uid();
begin
  if tg_op = 'DELETE' then
    if old.id = v_utama then raise exception 'Admin Utama tidak dapat dihapus. Alihkan status Admin Utama terlebih dahulu.'; end if;
    insert into public.audit_admin(aktor, aksi, target, sebelum)
    values (v_aktor, 'profil.hapus', old.id, jsonb_build_object('peran', old.peran, 'aktif', old.aktif, 'unit_id', old.unit_id));
    return old;
  end if;

  if new.id is distinct from old.id then raise exception 'ID profil tidak dapat diubah'; end if;

  if (new.peran, new.aktif, new.unit_id) is distinct from (old.peran, old.aktif, old.unit_id) then
    -- 1) The Primary Administrator always stays an active Administrator
    if old.id = v_utama and (new.peran <> 'k3rs' or not new.aktif) then
      raise exception 'Admin Utama tidak dapat diturunkan atau dinonaktifkan.';
    end if;
    -- 2) App users may not change their own role/status
    if v_aktor is not null and old.id = v_aktor then
      raise exception 'Tidak dapat mengubah peran/status akun sendiri';
    end if;
    -- 3) Granting, revoking or touching an Administrator account = Primary Administrator only
    if v_aktor is not null and v_utama is not null
       and (old.peran = 'k3rs' or new.peran = 'k3rs')
       and v_aktor is distinct from v_utama then
      raise exception 'Hanya Admin Utama yang dapat memberi, mencabut, atau mengubah akun Administrator';
    end if;
    insert into public.audit_admin(aktor, aksi, target, sebelum, sesudah)
    values (v_aktor, 'profil.ubah', old.id,
            jsonb_build_object('peran', old.peran, 'aktif', old.aktif, 'unit_id', old.unit_id),
            jsonb_build_object('peran', new.peran, 'aktif', new.aktif, 'unit_id', new.unit_id));
  end if;
  return new;
end $$;
drop trigger if exists profil_lindungi on public.profil;
create trigger profil_lindungi before update or delete on public.profil
  for each row execute function public.trg_profil_lindungi();

-- E. Guard on settings: only the Primary Administrator may switch the admin MFA requirement
create or replace function public.trg_pengaturan_lindungi() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.wajib_mfa_admin is distinct from old.wajib_mfa_admin then
    if auth.uid() is not null and exists (select 1 from public.admin_utama) and not public.fn_admin_utama() then
      raise exception 'Hanya Admin Utama yang dapat mengubah kewajiban verifikasi 2 langkah admin';
    end if;
    insert into public.audit_admin(aktor, aksi, sebelum, sesudah)
    values (auth.uid(), 'pengaturan.wajib_mfa_admin',
            jsonb_build_object('wajib_mfa_admin', old.wajib_mfa_admin),
            jsonb_build_object('wajib_mfa_admin', new.wajib_mfa_admin));
  end if;
  return new;
end $$;
drop trigger if exists pengaturan_lindungi on public.pengaturan;
create trigger pengaturan_lindungi before update on public.pengaturan
  for each row execute function public.trg_pengaturan_lindungi();

-- F. Transfer Primary Administrator status (Primary Administrator only)
create or replace function public.alihkan_admin_utama(p_ke uuid, p_alasan text default '') returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_lama uuid := (select user_id from public.admin_utama);
begin
  if not public.fn_admin_utama() then raise exception 'Hanya Admin Utama'; end if;
  if p_ke = v_lama then raise exception 'Akun tersebut sudah Admin Utama'; end if;
  if not exists (select 1 from public.profil where id = p_ke and peran = 'k3rs' and aktif) then
    raise exception 'Penerima harus Administrator yang aktif';
  end if;
  update public.admin_utama set user_id = p_ke, ditetapkan_pada = now(), ditetapkan_oleh = auth.uid() where satu;
  insert into public.audit_admin(aktor, aksi, target, sebelum, sesudah, alasan)
  values (auth.uid(), 'admin_utama.alihkan', p_ke, jsonb_build_object('user_id', v_lama),
          jsonb_build_object('user_id', p_ke), left(coalesce(p_alasan, ''), 200));
end $$;

-- G. For the UI later: "am I the Primary Administrator?"
create or replace function public.saya_admin_utama() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select public.fn_admin_utama()
$$;

-- H. Function privileges (Supabase grants EXECUTE on new functions to anon by default)
revoke execute on function public.fn_admin_utama(), public.trg_profil_lindungi(), public.trg_pengaturan_lindungi(),
  public.alihkan_admin_utama(uuid, text), public.saya_admin_utama() from public, anon, authenticated;
grant execute on function public.fn_admin_utama(), public.alihkan_admin_utama(uuid, text), public.saya_admin_utama()
  to authenticated;

commit;

-- =====================================================================
-- STEP 2 (separate, after the block above succeeds): designate the Primary Administrator.
-- Precondition: YOUR account is already an ACTIVE k3rs (have the existing admin
-- approve you as K3RS in Settings > Users). Replace the email, then Run.
-- Success = exactly 1 row in the final result.
-- =====================================================================
-- insert into public.admin_utama(user_id)
-- select p.id from public.profil p join auth.users u on u.id = p.id
--  where lower(u.email) = lower('EMAIL-ANDA@contoh.com') and p.peran = 'k3rs' and p.aktif
-- on conflict (satu) do nothing;
-- insert into public.audit_admin(aksi, target, alasan)
-- select 'admin_utama.tetapkan', user_id, 'Penetapan awal lewat SQL Editor' from public.admin_utama;
-- select u.email, a.ditetapkan_pada from public.admin_utama a join auth.users u on u.id = a.user_id;
