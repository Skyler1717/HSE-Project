-- =====================================================================
-- APLIKASI K3 RUMAH SAKIT — SKRIP PENYIAPAN BASIS DATA (Supabase)
-- Versi 1.0 · Tempel seluruh isi berkas ini ke Supabase > SQL Editor,
-- lalu tekan tombol "Run". Aman dijalankan ulang (idempoten).
--
-- Isi: (1) jenis data, (2) tabel, (3) fungsi bantu peran,
--      (4) aturan status (D2–D4) sebagai pemicu, (5) log aktivitas,
--      (6) fungsi layanan (RPC), (7) Row Level Security + hak akses,
--      (8) penyimpanan foto, (9) data konfigurasi awal.
-- Prinsip: aplikasi TIDAK pernah menulis langsung ke tabel laporan;
-- semua perubahan lewat fungsi yang memeriksa peran ("satu pintu").
-- =====================================================================

-- ---------- (1) JENIS DATA ----------
do $$ begin
  create type public.peran_t as enum ('petugas','pj_unit','k3rs');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.status_t as enum
    ('baru','ditugaskan','dalam_tindak_lanjut','terkendali_sementara','tertutup','tidak_dilanjutkan');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.level_t as enum ('eliminasi','substitusi','rekayasa','administratif','apd');
exception when duplicate_object then null; end $$;

-- ---------- (2) TABEL ----------
create table if not exists public.pengaturan (
  id               int primary key default 1 check (id = 1),
  nama_instansi    text not null default 'Rumah Sakit (isi oleh admin)',
  wajib_mfa_admin  boolean not null default true,
  hari_eskalasi    int not null default 2 check (hari_eskalasi between 1 and 30),
  -- Pita tingkat risiko (skor = dampak x kemungkinan, 1–25).
  -- [Asumsi desain — konfirmasi promotor/SK Direktur]; dapat diubah admin.
  pita_risiko      jsonb not null default
    '[{"maks":4,"label":"Rendah"},{"maks":9,"label":"Sedang"},{"maks":14,"label":"Tinggi"},{"maks":25,"label":"Sangat Tinggi"}]',
  nomor_darurat    text not null default '[ISI: nomor darurat internal]',
  -- Zona waktu tanggal laporan: Asia/Jakarta (WIB), Asia/Makassar (WITA), Asia/Jayapura (WIT)
  zona_waktu       text not null default 'Asia/Makassar',
  diperbarui_pada  timestamptz not null default now()
);

alter table public.pengaturan add column if not exists zona_waktu text not null default 'Asia/Makassar';

create or replace function public.fn_hari_ini() returns date
language sql stable security definer set search_path = public, pg_temp as $$
  select (now() at time zone coalesce((select zona_waktu from public.pengaturan where id = 1), 'Asia/Makassar'))::date
$$;

create table if not exists public.unit (
  id     serial primary key,
  kode   text not null unique check (kode ~ '^[A-Z0-9_-]{2,20}$'),
  nama   text not null check (length(nama) between 2 and 80),
  aktif  boolean not null default true
);

create table if not exists public.kategori (
  kode    text primary key check (kode ~ '^[a-z_]{2,30}$'),
  nama    text not null,
  contoh  text not null default '',
  urutan  int not null default 0,
  aktif   boolean not null default true
);

create table if not exists public.profil (
  id              uuid primary key references auth.users(id) on delete cascade,
  nama_tampilan   text not null default 'Pengguna' check (length(nama_tampilan) between 1 and 80),
  peran           public.peran_t not null default 'petugas',
  unit_id         int references public.unit(id),
  aktif           boolean not null default false,   -- disetujui admin dulu
  dibuat_pada     timestamptz not null default now()
);

create sequence if not exists public.laporan_seq;

create table if not exists public.laporan (
  id                 uuid primary key default gen_random_uuid(),
  nomor              text not null unique,
  jenis              text not null check (jenis in ('bahaya','nyaris_celaka','kejadian')),
  kategori_kode      text not null references public.kategori(kode),
  unit_id            int  not null references public.unit(id),
  lokasi             text not null default '' check (length(lokasi) <= 120),
  uraian             text not null default '' check (length(uraian) <= 1000),
  mendesak           boolean not null default false,
  anonim             boolean not null default false,
  pelapor_id         uuid references public.profil(id) on delete set null,
  kode_lacak_hash    text,
  id_klien           uuid unique,
  dampak             smallint check (dampak between 1 and 5),
  kemungkinan        smallint check (kemungkinan between 1 and 5),
  skor               smallint generated always as (dampak * kemungkinan) stored,
  status             public.status_t not null default 'baru',
  pj_id              uuid references public.profil(id),
  target_tanggal     date,
  level_pengendalian public.level_t,
  foto_path          text,
  ai_kategori_saran  text,
  ai_saran_diterima  boolean,
  contoh             boolean not null default false,
  tanggal_lapor      date not null default public.fn_hari_ini(),
  dibuat_pada        timestamptz not null default now(),
  diperbarui_pada    timestamptz not null default now(),
  ditutup_pada       timestamptz,
  constraint anonim_tanpa_jejak check (not anonim or (pelapor_id is null and foto_path is null))
);
create index if not exists laporan_unit_idx   on public.laporan(unit_id);
create index if not exists laporan_status_idx on public.laporan(status);
create index if not exists laporan_pj_idx     on public.laporan(pj_id);
create index if not exists laporan_pel_idx    on public.laporan(pelapor_id);

create table if not exists public.tindak_lanjut (
  id                 uuid primary key default gen_random_uuid(),
  laporan_id         uuid not null references public.laporan(id) on delete cascade,
  oleh               uuid references public.profil(id) on delete set null,
  uraian             text not null check (length(uraian) between 5 and 1000),
  level_pengendalian public.level_t not null,
  bukti_teks         text not null default '' check (length(bukti_teks) <= 500),
  bukti_foto_path    text,
  dibuat_pada        timestamptz not null default now()
);
create index if not exists tl_laporan_idx on public.tindak_lanjut(laporan_id);

create table if not exists public.riwayat_status (
  id          bigserial primary key,
  laporan_id  uuid not null references public.laporan(id) on delete cascade,
  dari        public.status_t,
  ke          public.status_t not null,
  oleh        uuid,
  catatan     text not null default '',
  pada        timestamptz not null default now()
);
create index if not exists rs_laporan_idx on public.riwayat_status(laporan_id);

create table if not exists public.log_aktivitas (
  id        bigserial primary key,
  pada      timestamptz not null default now(),
  aktor     uuid,          -- kosong bila pelapor anonim
  peran     text,
  aksi      text not null,
  objek     text not null default '',
  objek_id  text not null default '',
  ringkas   text not null default ''   -- tanpa isi uraian / data sensitif
);

-- ---------- (3) FUNGSI BANTU PERAN ----------
drop function if exists public.fn_boleh_lihat(public.laporan) cascade;
create or replace function public.fn_peran() returns public.peran_t
language sql stable security definer set search_path = public, pg_temp as $$
  select peran from public.profil where id = auth.uid() and aktif
$$;

create or replace function public.fn_unit() returns int
language sql stable security definer set search_path = public, pg_temp as $$
  select unit_id from public.profil where id = auth.uid() and aktif
$$;

create or replace function public.fn_k3rs() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(public.fn_peran() = 'k3rs', false)
     and ( coalesce(auth.jwt()->>'aal','aal1') = 'aal2'
           or not coalesce((select wajib_mfa_admin from public.pengaturan where id = 1), true) )
$$;

create or replace function public.fn_boleh_lihat(p_id uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((
    select case public.fn_peran()
      when 'k3rs'    then public.fn_k3rs()
      when 'pj_unit' then l.unit_id = public.fn_unit() or l.pj_id = auth.uid() or l.pelapor_id = auth.uid()
      when 'petugas' then l.pelapor_id = auth.uid()
      else false end
    from public.laporan l where l.id = p_id), false)
$$;

create or replace function public.fn_ada_identitas_pasien(t text) returns boolean
language sql immutable as $$
  select coalesce(t,'') ~ '\d{16}'
      or coalesce(t,'') ~* '(no\.?|nomor)\s*(rm|rekam\s*medi[sk])'
      or coalesce(t,'') ~* '\mrm\s*[:.#]?\s*\d{4,}'
      or coalesce(t,'') ~* '\m(tn|ny|nn|sdr|sdri)\.\s*[a-z]'
      or coalesce(t,'') ~* 'pasien\s+(bernama|atas\s+nama|a\.\s*n\.)'
$$;

create or replace function public.fn_cek_path(p text) returns boolean
language sql stable as $$
  select nullif(btrim(p), '') is null or (
    split_part(p, '/', 1) = auth.uid()::text
    and p ~ '^[0-9a-f-]{36}/[0-9A-Za-z_-]{1,80}\.(jpg|jpeg|png|webp)$')
$$;

-- ---------- (4) ATURAN STATUS sebagai PEMICU (berlaku juga untuk Table Editor) ----------
create or replace function public.trg_laporan_aturan() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  new.diperbarui_pada := now();
  if new.anonim then new.pelapor_id := null; new.foto_path := null; end if;
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    -- D3: setiap butir berstatus dan bertanggal (target wajib setelah ditugaskan)
    if new.status in ('ditugaskan','dalam_tindak_lanjut','terkendali_sementara','tertutup')
       and (new.pj_id is null or new.target_tanggal is null) then
      raise exception 'Status % memerlukan penanggung jawab dan tanggal target', new.status;
    end if;
    if new.status = 'tertutup' then
      -- D2 + D4: satu penanggung jawab, satu bukti perubahan, pengendalian tingkat fisik
      if not exists (select 1 from public.tindak_lanjut t
                      where t.laporan_id = new.id
                        and t.level_pengendalian in ('eliminasi','substitusi','rekayasa')
                        and (length(btrim(t.bukti_teks)) >= 5 or t.bukti_foto_path is not null)) then
        raise exception 'Belum bisa ditutup: perlu tindak lanjut tingkat eliminasi/substitusi/rekayasa dengan bukti. Pengendalian administratif/APD memakai status "terkendali sementara".';
      end if;
      new.ditutup_pada := now();
    elsif new.status = 'terkendali_sementara' then
      if not exists (select 1 from public.tindak_lanjut t where t.laporan_id = new.id) then
        raise exception 'Status terkendali sementara memerlukan minimal satu tindak lanjut';
      end if;
      new.ditutup_pada := null;
    else
      new.ditutup_pada := null;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists laporan_aturan on public.laporan;
create trigger laporan_aturan before insert or update on public.laporan
  for each row execute function public.trg_laporan_aturan();

create or replace function public.trg_laporan_riwayat() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if tg_op = 'INSERT' then
    insert into public.riwayat_status(laporan_id, dari, ke, oleh, catatan, pada)
    values (new.id, null, new.status, null, 'Laporan diterima', new.dibuat_pada);
    insert into public.log_aktivitas(aktor, peran, aksi, objek, objek_id, ringkas)
    values (case when new.anonim then null else auth.uid() end,
            case when new.anonim then null else public.fn_peran()::text end,
            'laporan.kirim', 'laporan', new.nomor,
            'kategori=' || new.kategori_kode || case when new.anonim then '; anonim' else '' end);
  elsif new.status is distinct from old.status then
    insert into public.riwayat_status(laporan_id, dari, ke, oleh, catatan)
    values (new.id, old.status, new.status, auth.uid(),
            coalesce(nullif(current_setting('app.catatan', true), ''), ''));
    insert into public.log_aktivitas(aktor, peran, aksi, objek, objek_id, ringkas)
    values (auth.uid(), public.fn_peran()::text, 'laporan.status', 'laporan', new.nomor,
            old.status || ' -> ' || new.status);
  end if;
  return null;
end $$;
drop trigger if exists laporan_riwayat on public.laporan;
create trigger laporan_riwayat after insert or update on public.laporan
  for each row execute function public.trg_laporan_riwayat();

-- Profil baru otomatis dibuat saat akun dibuat (status belum aktif)
create or replace function public.trg_user_baru() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.profil(id, nama_tampilan)
  values (new.id, coalesce(nullif(left(new.raw_user_meta_data->>'nama', 80), ''),
                           split_part(coalesce(new.email,'pengguna'), '@', 1)))
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists user_baru on auth.users;
create trigger user_baru after insert on auth.users
  for each row execute function public.trg_user_baru();

-- ---------- (5) LOG AKTIVITAS ----------
create or replace function public.catat(p_aksi text, p_objek text, p_id text, p_ringkas text)
returns void language sql security definer set search_path = public, pg_temp as $$
  insert into public.log_aktivitas(aktor, peran, aksi, objek, objek_id, ringkas)
  values (auth.uid(), public.fn_peran()::text, p_aksi, coalesce(p_objek,''), coalesce(p_id,''), left(coalesce(p_ringkas,''), 200))
$$;

-- ---------- (6) FUNGSI LAYANAN (RPC) ----------
create or replace function public.kirim_laporan(
  p_jenis text, p_kategori text, p_unit int,
  p_uraian text default '', p_lokasi text default '',
  p_mendesak boolean default false, p_anonim boolean default false,
  p_foto_path text default null, p_kode_lacak text default null,
  p_ai_kategori text default null, p_ai_diterima boolean default null,
  p_id_klien uuid default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid(); v_nomor text; v_kode text;
begin
  if public.fn_peran() is null then raise exception 'Akun belum aktif. Hubungi admin K3RS.'; end if;
  if p_id_klien is not null then
    select nomor into v_nomor from public.laporan where id_klien = p_id_klien;
    if v_nomor is not null then return jsonb_build_object('nomor', v_nomor, 'duplikat', true); end if;
  end if;
  if p_jenis not in ('bahaya','nyaris_celaka','kejadian') then raise exception 'Jenis laporan tidak dikenal'; end if;
  if not exists (select 1 from public.kategori where kode = p_kategori and aktif) then raise exception 'Kategori tidak dikenal'; end if;
  if not exists (select 1 from public.unit where id = p_unit and aktif) then raise exception 'Unit tidak dikenal'; end if;
  p_uraian := btrim(coalesce(p_uraian, '')); p_lokasi := btrim(coalesce(p_lokasi, ''));
  p_foto_path := nullif(btrim(p_foto_path), '');
  if length(p_uraian) > 1000 or length(p_lokasi) > 120 then raise exception 'Teks terlalu panjang'; end if;
  if public.fn_ada_identitas_pasien(p_uraian || ' ' || p_lokasi) then
    raise exception 'Teks tampak memuat identitas pasien (nama/NIK/No. RM). Hapus dulu, lalu kirim ulang.';
  end if;
  if p_anonim and p_foto_path is not null then raise exception 'Laporan anonim tidak dapat memuat foto'; end if;
  if not public.fn_cek_path(p_foto_path) then raise exception 'Lokasi berkas foto tidak sah'; end if;
  if p_anonim then
    v_kode := upper(regexp_replace(coalesce(p_kode_lacak,''), '[^A-Za-z0-9]', '', 'g'));
    if v_kode !~ '^[A-Z0-9]{12}$' then raise exception 'Kode lacak tidak sah'; end if;
  end if;
  v_nomor := 'K3-' || to_char(public.fn_hari_ini(), 'YYMMDD') || '-' || lpad(nextval('public.laporan_seq')::text, 4, '0');
  insert into public.laporan(nomor, jenis, kategori_kode, unit_id, lokasi, uraian, mendesak, anonim,
                             pelapor_id, kode_lacak_hash, id_klien, foto_path,
                             ai_kategori_saran, ai_saran_diterima, dibuat_pada)
  values (v_nomor, p_jenis, p_kategori, p_unit, p_lokasi, p_uraian, coalesce(p_mendesak,false), coalesce(p_anonim,false),
          case when p_anonim then null else v_uid end,
          case when p_anonim then encode(sha256(convert_to(v_kode, 'UTF8')), 'hex') end,
          p_id_klien, p_foto_path, left(p_ai_kategori, 30), p_ai_diterima,
          case when p_anonim then date_trunc('day', now()) else now() end);
  return jsonb_build_object('nomor', v_nomor, 'duplikat', false);
end $$;

create or replace function public.cek_kode_lacak(p_kode text) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_hash text; l public.laporan;
begin
  if public.fn_peran() is null then raise exception 'Akun belum aktif'; end if;
  v_hash := encode(sha256(convert_to(upper(regexp_replace(coalesce(p_kode,''), '[^A-Za-z0-9]', '', 'g')), 'UTF8')), 'hex');
  select * into l from public.laporan where kode_lacak_hash = v_hash;
  if not found then return null; end if;
  return jsonb_build_object(
    'nomor', l.nomor, 'status', l.status, 'tanggal_lapor', l.tanggal_lapor,
    'kategori', (select nama from public.kategori where kode = l.kategori_kode),
    'unit', (select nama from public.unit where id = l.unit_id),
    'riwayat', coalesce((select jsonb_agg(jsonb_build_object('ke', r.ke, 'tanggal', r.pada::date) order by r.pada)
                         from public.riwayat_status r where r.laporan_id = l.id), '[]'),
    'tindak_lanjut', coalesce((select jsonb_agg(jsonb_build_object('tanggal', t.dibuat_pada::date,
                                 'level', t.level_pengendalian, 'uraian', t.uraian) order by t.dibuat_pada)
                         from public.tindak_lanjut t where t.laporan_id = l.id), '[]'));
end $$;

create or replace function public.tugaskan(
  p_laporan uuid, p_pj uuid, p_target date, p_dampak int, p_kemungkinan int, p_catatan text default '')
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare l public.laporan;
begin
  if not public.fn_k3rs() then raise exception 'Hanya K3RS (dengan MFA) yang dapat menugaskan'; end if;
  select * into l from public.laporan where id = p_laporan for update;
  if not found then raise exception 'Laporan tidak ditemukan'; end if;
  if l.status in ('tertutup','tidak_dilanjutkan') then raise exception 'Laporan sudah selesai; buka kembali dulu'; end if;
  if not exists (select 1 from public.profil where id = p_pj and aktif and peran in ('pj_unit','k3rs')) then
    raise exception 'Penanggung jawab harus akun PJ unit atau K3RS yang aktif';
  end if;
  if p_target is null or p_target < public.fn_hari_ini() then raise exception 'Tanggal target wajib dan tidak boleh lampau'; end if;
  if p_dampak not between 1 and 5 or p_kemungkinan not between 1 and 5 then raise exception 'Dampak dan kemungkinan bernilai 1–5'; end if;
  perform set_config('app.catatan', left(coalesce(p_catatan,''), 300), true);
  update public.laporan set pj_id = p_pj, target_tanggal = p_target,
         dampak = p_dampak, kemungkinan = p_kemungkinan,
         status = case when status = 'baru' then 'ditugaskan'::public.status_t else status end
   where id = p_laporan;
  perform public.catat('laporan.tugaskan', 'laporan', l.nomor, 'target=' || p_target);
end $$;

create or replace function public.tambah_tindak_lanjut(
  p_laporan uuid, p_uraian text, p_level public.level_t,
  p_bukti_teks text default '', p_bukti_foto text default null)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare l public.laporan;
begin
  select * into l from public.laporan where id = p_laporan for update;
  if not found then raise exception 'Laporan tidak ditemukan'; end if;
  if not (public.fn_k3rs() or (public.fn_peran() = 'pj_unit' and l.pj_id = auth.uid())) then
    raise exception 'Hanya penanggung jawab yang ditugaskan atau K3RS';
  end if;
  if l.status in ('baru','tertutup','tidak_dilanjutkan') then
    raise exception 'Tindak lanjut hanya untuk laporan yang sudah ditugaskan dan belum selesai';
  end if;
  if public.fn_ada_identitas_pasien(p_uraian || ' ' || coalesce(p_bukti_teks,'')) then
    raise exception 'Teks tampak memuat identitas pasien. Hapus dulu.';
  end if;
  p_bukti_foto := nullif(btrim(p_bukti_foto), '');
  if not public.fn_cek_path(p_bukti_foto) then raise exception 'Lokasi berkas foto tidak sah'; end if;
  insert into public.tindak_lanjut(laporan_id, oleh, uraian, level_pengendalian, bukti_teks, bukti_foto_path)
  values (p_laporan, auth.uid(), btrim(p_uraian), p_level, btrim(coalesce(p_bukti_teks,'')), p_bukti_foto);
  update public.laporan set level_pengendalian = p_level,
         status = case when status = 'ditugaskan' then 'dalam_tindak_lanjut'::public.status_t else status end
   where id = p_laporan;
  perform public.catat('tindak_lanjut.tambah', 'laporan', l.nomor, 'level=' || p_level);
end $$;

create or replace function public.ubah_status(p_laporan uuid, p_ke public.status_t, p_catatan text default '')
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare l public.laporan; v_k3rs boolean := public.fn_k3rs();
begin
  select * into l from public.laporan where id = p_laporan for update;
  if not found then raise exception 'Laporan tidak ditemukan'; end if;
  p_catatan := btrim(coalesce(p_catatan, ''));
  if p_ke = 'terkendali_sementara' then
    if not (v_k3rs or (public.fn_peran() = 'pj_unit' and l.pj_id = auth.uid())) then raise exception 'Tidak berwenang'; end if;
    if l.status <> 'dalam_tindak_lanjut' then raise exception 'Hanya dari status dalam tindak lanjut'; end if;
  elsif p_ke = 'tertutup' then
    if not v_k3rs then raise exception 'Penutupan diverifikasi oleh K3RS'; end if;
    if l.status not in ('dalam_tindak_lanjut','terkendali_sementara') then raise exception 'Belum ada tindak lanjut'; end if;
  elsif p_ke = 'tidak_dilanjutkan' then
    if not v_k3rs then raise exception 'Tidak berwenang'; end if;
    if l.status not in ('baru','ditugaskan') then raise exception 'Hanya untuk laporan baru/ditugaskan'; end if;
    if length(p_catatan) < 5 then raise exception 'Tulis alasan (min. 5 huruf)'; end if;
  elsif p_ke = 'dalam_tindak_lanjut' then
    if not v_k3rs then raise exception 'Tidak berwenang'; end if;
    if l.status not in ('tertutup','terkendali_sementara','tidak_dilanjutkan') then raise exception 'Hanya untuk membuka kembali'; end if;
    if length(p_catatan) < 5 then raise exception 'Tulis alasan membuka kembali'; end if;
  else
    raise exception 'Perubahan status ini dilakukan lewat penugasan';
  end if;
  perform set_config('app.catatan', left(p_catatan, 300), true);
  update public.laporan set status = p_ke where id = p_laporan;
end $$;

create or replace function public.nama_pelapor(p_laporan uuid) returns text
language plpgsql security definer set search_path = public, pg_temp as $$
declare v text; l public.laporan;
begin
  if not public.fn_k3rs() then raise exception 'Hanya K3RS'; end if;
  select * into l from public.laporan where id = p_laporan;
  if l.anonim or l.pelapor_id is null then return '(anonim)'; end if;
  select nama_tampilan into v from public.profil where id = l.pelapor_id;
  perform public.catat('identitas.lihat', 'laporan', l.nomor, 'K3RS melihat nama pelapor');
  return v;
end $$;

create or replace function public.laporan_saya() returns setof uuid
language sql stable security definer set search_path = public, pg_temp as $$
  select id from public.laporan where pelapor_id = auth.uid() and public.fn_peran() is not null
$$;

create or replace function public.daftar_pengguna()
returns table(id uuid, email text, nama text, peran public.peran_t, unit_id int, aktif boolean, dibuat date)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not public.fn_k3rs() then raise exception 'Hanya K3RS'; end if;
  return query select p.id, u.email::text, p.nama_tampilan, p.peran, p.unit_id, p.aktif, p.dibuat_pada::date
                 from public.profil p join auth.users u on u.id = p.id order by p.aktif, p.nama_tampilan;
end $$;

create or replace function public.daftar_pj()
returns table(id uuid, nama text, peran public.peran_t, unit_id int)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not public.fn_k3rs() then raise exception 'Hanya K3RS'; end if;
  return query select p.id, p.nama_tampilan, p.peran, p.unit_id from public.profil p
                where p.aktif and p.peran in ('pj_unit','k3rs') order by p.nama_tampilan;
end $$;

create or replace function public.atur_pengguna(p_id uuid, p_peran public.peran_t, p_unit int, p_aktif boolean)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.fn_k3rs() then raise exception 'Hanya K3RS'; end if;
  if p_id = auth.uid() then raise exception 'Tidak dapat mengubah peran/status akun sendiri'; end if;
  if p_peran = 'pj_unit' and p_unit is null then raise exception 'PJ unit wajib memiliki unit'; end if;
  update public.profil set peran = p_peran, unit_id = p_unit, aktif = p_aktif where id = p_id;
  perform public.catat('pengguna.atur', 'profil', p_id::text, 'peran=' || p_peran || '; aktif=' || p_aktif);
end $$;

create or replace function public.ubah_nama_saya(p_nama text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if length(btrim(coalesce(p_nama,''))) not between 1 and 80 then raise exception 'Nama 1–80 huruf'; end if;
  update public.profil set nama_tampilan = btrim(p_nama) where id = auth.uid();
end $$;

create or replace function public.catat_ekspor(p_jenis text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if public.fn_peran() not in ('k3rs','pj_unit') then raise exception 'Tidak berwenang'; end if;
  perform public.catat('ekspor', 'data', '', left(p_jenis, 40));
end $$;

-- Statistik untuk dasbor: hanya hitungan; tanpa deret waktu.
create or replace function public.statistik() returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_peran public.peran_t := public.fn_peran(); v jsonb; pita jsonb;
begin
  if v_peran is null or v_peran = 'petugas' then raise exception 'Tidak berwenang'; end if;
  if v_peran = 'k3rs' and not public.fn_k3rs() then raise exception 'Verifikasi MFA dulu'; end if;
  select pita_risiko into pita from public.pengaturan where id = 1;
  with l as (
    select x.*, (select count(*) from public.tindak_lanjut t where t.laporan_id = x.id) as n_tl
      from public.laporan x
     where v_peran = 'k3rs' or x.unit_id = public.fn_unit() or x.pj_id = auth.uid()
  ), lt as (
    select l.*, (select e->>'label' from jsonb_array_elements(pita) e
                  where l.skor is not null and l.skor <= (e->>'maks')::int
                  order by (e->>'maks')::int limit 1) as tingkat
      from l
  )
  select jsonb_build_object(
    'total', (select count(*) from lt),
    'per_status',   coalesce((select jsonb_object_agg(status, n) from (select status, count(*) n from lt group by 1) s), '{}'),
    'per_kategori', coalesce((select jsonb_agg(jsonb_build_object('label', k.nama, 'n', s.n) order by s.n desc)
                       from (select kategori_kode, count(*) n from lt group by 1) s join public.kategori k on k.kode = s.kategori_kode), '[]'),
    'per_unit',     coalesce((select jsonb_agg(jsonb_build_object('label', u.nama, 'n', s.n) order by s.n desc)
                       from (select unit_id, count(*) n from lt group by 1) s join public.unit u on u.id = s.unit_id), '[]'),
    'per_tingkat',  coalesce((select jsonb_object_agg(coalesce(tingkat,'Belum dinilai'), n) from (select tingkat, count(*) n from lt group by 1) s), '{}'),
    'per_level',    coalesce((select jsonb_object_agg(coalesce(level_pengendalian::text,'belum'), n) from (select level_pengendalian, count(*) n from lt group by 1) s), '{}'),
    'per_jenis',    coalesce((select jsonb_object_agg(jenis, n) from (select jenis, count(*) n from lt group by 1) s), '{}'),
    'titik_putus', jsonb_build_object(
        'a_belum_ditugaskan',      (select count(*) from lt where status = 'baru'),
        'b_belum_ditindaklanjuti', (select count(*) from lt where status = 'ditugaskan' and n_tl = 0),
        'c_belum_ditutup',         (select count(*) from lt where status = 'dalam_tindak_lanjut'),
        'd_terkendali_sementara',  (select count(*) from lt where status = 'terkendali_sementara'),
        'd_tertutup',              (select count(*) from lt where status = 'tertutup'),
        'tidak_dilanjutkan',       (select count(*) from lt where status = 'tidak_dilanjutkan')),
    'kesenjangan', jsonb_build_object(
        'tanpa_pj',     (select count(*) from lt where pj_id is null and status <> 'tidak_dilanjutkan'),
        'tanpa_target', (select count(*) from lt where target_tanggal is null and status <> 'tidak_dilanjutkan'),
        'tanpa_skor',   (select count(*) from lt where skor is null and status <> 'tidak_dilanjutkan'),
        'hanya_adm_apd',(select count(*) from lt where level_pengendalian in ('administratif','apd'))),
    'terlambat', (select count(*) from lt where target_tanggal < public.fn_hari_ini()
                    and status in ('ditugaskan','dalam_tindak_lanjut')),
    'mendesak_terbuka', (select count(*) from lt where mendesak and status in ('baru','ditugaskan','dalam_tindak_lanjut')),
    'baru_lewat_eskalasi', (select count(*) from lt where status = 'baru'
                    and tanggal_lapor <= public.fn_hari_ini() - (select hari_eskalasi from public.pengaturan where id = 1)),
    'ai', jsonb_build_object(
        'dengan_saran', (select count(*) from lt where ai_kategori_saran is not null),
        'diterima',     (select count(*) from lt where ai_saran_diterima))
  ) into v;
  return v;
end $$;

-- ---------- (7) ROW LEVEL SECURITY + HAK AKSES ----------
alter table public.pengaturan     enable row level security;
alter table public.unit           enable row level security;
alter table public.kategori       enable row level security;
alter table public.profil         enable row level security;
alter table public.laporan        enable row level security;
alter table public.tindak_lanjut  enable row level security;
alter table public.riwayat_status enable row level security;
alter table public.log_aktivitas  enable row level security;

-- Cabut semua hak bawaan, lalu beri hak seminimal mungkin
revoke all on public.pengaturan, public.unit, public.kategori, public.profil, public.laporan,
              public.tindak_lanjut, public.riwayat_status, public.log_aktivitas from anon, authenticated;
revoke all on sequence public.laporan_seq from anon, authenticated;
revoke all on sequence public.unit_id_seq from anon, authenticated;
revoke all on sequence public.riwayat_status_id_seq from anon, authenticated;
revoke all on sequence public.log_aktivitas_id_seq from anon, authenticated;

grant select on public.pengaturan, public.unit, public.kategori to authenticated;
grant update (nama_instansi, hari_eskalasi, pita_risiko, nomor_darurat, wajib_mfa_admin, zona_waktu, diperbarui_pada)
  on public.pengaturan to authenticated;
grant insert, update on public.unit, public.kategori to authenticated;
grant usage on sequence public.unit_id_seq to authenticated;
grant select on public.profil to authenticated;
-- Kolom pelapor_id, kode_lacak_hash, id_klien TIDAK diberikan: identitas pelapor tidak terbaca dari aplikasi
grant select (id, nomor, jenis, kategori_kode, unit_id, lokasi, uraian, mendesak, anonim, dampak, kemungkinan,
              skor, status, pj_id, target_tanggal, level_pengendalian, foto_path, ai_kategori_saran,
              ai_saran_diterima, contoh, tanggal_lapor, dibuat_pada, diperbarui_pada, ditutup_pada)
  on public.laporan to authenticated;
grant select on public.tindak_lanjut to authenticated;
grant select (id, laporan_id, dari, ke, catatan, pada) on public.riwayat_status to authenticated;
grant select on public.log_aktivitas to authenticated;

drop policy if exists baca_semua on public.pengaturan;
create policy baca_semua on public.pengaturan for select to authenticated using (public.fn_peran() is not null);
drop policy if exists ubah_admin on public.pengaturan;
create policy ubah_admin on public.pengaturan for update to authenticated using (public.fn_k3rs()) with check (public.fn_k3rs());

drop policy if exists baca_semua on public.unit;
create policy baca_semua on public.unit for select to authenticated using (true);
drop policy if exists tambah_admin on public.unit;
create policy tambah_admin on public.unit for insert to authenticated with check (public.fn_k3rs());
drop policy if exists ubah_admin on public.unit;
create policy ubah_admin on public.unit for update to authenticated using (public.fn_k3rs()) with check (public.fn_k3rs());

drop policy if exists baca_semua on public.kategori;
create policy baca_semua on public.kategori for select to authenticated using (true);
drop policy if exists tambah_admin on public.kategori;
create policy tambah_admin on public.kategori for insert to authenticated with check (public.fn_k3rs());
drop policy if exists ubah_admin on public.kategori;
create policy ubah_admin on public.kategori for update to authenticated using (public.fn_k3rs()) with check (public.fn_k3rs());

drop policy if exists baca_profil on public.profil;
create policy baca_profil on public.profil for select to authenticated
  using (id = auth.uid() or public.fn_k3rs());

drop policy if exists baca_laporan on public.laporan;
create policy baca_laporan on public.laporan for select to authenticated
  using (public.fn_boleh_lihat(id));

drop policy if exists baca_tl on public.tindak_lanjut;
create policy baca_tl on public.tindak_lanjut for select to authenticated
  using (public.fn_boleh_lihat(laporan_id));

drop policy if exists baca_riwayat on public.riwayat_status;
create policy baca_riwayat on public.riwayat_status for select to authenticated
  using (public.fn_boleh_lihat(laporan_id));

drop policy if exists baca_log on public.log_aktivitas;
create policy baca_log on public.log_aktivitas for select to authenticated using (public.fn_k3rs());

-- Fungsi: hanya pengguna masuk yang boleh memanggil
revoke execute on all functions in schema public from public, anon;
grant execute on function
  public.kirim_laporan(text,text,int,text,text,boolean,boolean,text,text,text,boolean,uuid),
  public.cek_kode_lacak(text), public.tugaskan(uuid,uuid,date,int,int,text),
  public.tambah_tindak_lanjut(uuid,text,public.level_t,text,text),
  public.ubah_status(uuid,public.status_t,text), public.nama_pelapor(uuid),
  public.daftar_pengguna(), public.daftar_pj(), public.atur_pengguna(uuid,public.peran_t,int,boolean),
  public.ubah_nama_saya(text), public.catat_ekspor(text), public.statistik(), public.laporan_saya(),
  public.fn_hari_ini(), public.fn_peran(), public.fn_unit(), public.fn_k3rs(), public.fn_boleh_lihat(uuid),
  public.fn_ada_identitas_pasien(text), public.fn_cek_path(text)
to authenticated;

-- ---------- (8) PENYIMPANAN FOTO (bucket privat, maks 5 MB, hanya gambar) ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('foto', 'foto', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = false, file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg','image/png','image/webp'];

drop policy if exists "k3 unggah foto" on storage.objects;
create policy "k3 unggah foto" on storage.objects for insert to authenticated
  with check (bucket_id = 'foto'
              and (storage.foldername(name))[1] = auth.uid()::text
              and public.fn_peran() is not null);
drop policy if exists "k3 lihat foto" on storage.objects;
create policy "k3 lihat foto" on storage.objects for select to authenticated
  using (bucket_id = 'foto' and (
         (storage.foldername(name))[1] = auth.uid()::text
      or public.fn_k3rs()
      or exists (select 1 from public.laporan l where l.foto_path = storage.objects.name)
      or exists (select 1 from public.tindak_lanjut t where t.bukti_foto_path = storage.objects.name)));
-- Tidak ada kebijakan ubah/hapus: bukti foto tidak dapat diubah dari aplikasi.

-- ---------- (9) KONFIGURASI AWAL ----------
insert into public.pengaturan(id) values (1) on conflict (id) do nothing;

-- Delapan kategori bahaya (mengacu kelompok bahaya K3RS; dapat diubah admin)
insert into public.kategori(kode, nama, contoh, urutan) values
 ('biologi',      'Biologi',              'Tertusuk jarum, terpapar darah/cairan tubuh, risiko infeksi', 1),
 ('kimia',        'Kimia / B3',           'Bahan kimia tumpah, uap, label B3 hilang, desinfektan', 2),
 ('fisik',        'Fisik',                'Lantai licin, bising, panas, radiasi, penerangan kurang', 3),
 ('ergonomi',     'Ergonomi',             'Mengangkat pasien/beban berat, posisi kerja janggal', 4),
 ('psikososial',  'Psikososial',          'Kekerasan/ancaman, beban kerja berlebih, perundungan', 5),
 ('mekanik',      'Mekanik / Listrik',    'Kabel terkelupas, alat rusak, terjepit, benda tajam', 6),
 ('kebakaran',    'Kebakaran / Darurat',  'Bau hangus, APAR kosong, jalur evakuasi terhalang', 7),
 ('limbah',       'Limbah',               'Safety box penuh, sampah medis tercampur, limbah tercecer', 8)
on conflict (kode) do nothing;

-- Unit contoh (nama umum; ubah sesuai rumah sakit lewat menu Pengaturan)
insert into public.unit(kode, nama) values
 ('IGD','Instalasi Gawat Darurat'), ('RANAP','Rawat Inap'), ('RAJAL','Rawat Jalan'),
 ('ICU','ICU'), ('OK','Kamar Operasi'), ('LAB','Laboratorium'), ('RAD','Radiologi'),
 ('FARMASI','Farmasi'), ('GIZI','Gizi'), ('LAUNDRY','Laundry'), ('CSSD','CSSD'),
 ('IPSRS','IPSRS'), ('KESLING','Kesehatan Lingkungan'), ('HD','Hemodialisis')
on conflict (kode) do nothing;

-- Selesai. Langkah berikutnya: jalankan 02_jadikan_admin.sql (ganti email).
