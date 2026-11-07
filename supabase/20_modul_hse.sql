-- =====================================================================
-- 20_modul_hse.sql — MODUL HSE LANJUTAN (jalankan SEKALI di Supabase > SQL Editor)
-- Prasyarat: 01_setup.sql dan supabase/usulan/10_admin_utama.sql sudah dijalankan.
-- Sifat: HANYA MENAMBAH. Tidak ada tabel, kebijakan, fungsi, atau data lama yang diubah/dihapus.
-- Isi:
--   (1) JSA, Inspeksi, Pemantauan (lingkungan & kesehatan kerja agregat)
--   (2) Dokumen & SOP + pencarian teks penuh
--   (3) Riwayat HSE Intelligence (retensi 60 hari)
--   (4) Laporan bulanan otomatis (angka dari SQL, bukan dari AI)
--   (5) Antrean sinkronisasi Google Sheets (anti-duplikasi, retry, log)
--   (6) Lokasi cuaca RS, jadwal otomatis (pg_cron), penyimpanan dokumen
-- Rollback: supabase/29_rollback_modul_hse.sql
-- =====================================================================

-- ---------- (0) Lokasi RS untuk peringatan cuaca (Open-Meteo, gratis) ----------
alter table public.pengaturan add column if not exists lintang numeric(8,5) not null default 1.47480 check (lintang between -90 and 90);
alter table public.pengaturan add column if not exists bujur   numeric(8,5) not null default 124.84210 check (bujur between -180 and 180);
grant update (lintang, bujur) on public.pengaturan to authenticated;   -- kebijakan lama "ubah_admin" tetap membatasi ke K3RS

-- Fungsi bantu: shift dari waktu (zona waktu RS)
create or replace function public.fn_shift(p_waktu timestamptz) returns text
language sql stable security definer set search_path = public, pg_temp as $$
  select case when h >= 7 and h < 14 then 'pagi' when h >= 14 and h < 21 then 'siang' else 'malam' end
    from (select extract(hour from p_waktu at time zone coalesce((select zona_waktu from public.pengaturan where id = 1), 'Asia/Makassar'))::int as h) x
$$;

-- Fungsi bantu: nomor dokumen kerja (JSA-yymmdd-XXXX)
create or replace function public.fn_nomor(p_awal text) returns text
language sql volatile security definer set search_path = public, pg_temp as $$
  select p_awal || '-' || to_char(public.fn_hari_ini(), 'YYMMDD') || '-' || upper(substr(md5(gen_random_uuid()::text), 1, 5))
$$;

-- ---------- (1) TABEL MODUL OPERASIONAL ----------
create table if not exists public.jsa (
  id               uuid primary key default gen_random_uuid(),
  nomor            text not null unique default public.fn_nomor('JSA'),
  pekerjaan        text not null check (length(pekerjaan) between 3 and 160),
  unit_id          int  not null references public.unit(id),
  lokasi           text not null default '' check (length(lokasi) <= 120),
  tanggal          date not null default public.fn_hari_ini(),
  shift            text check (shift in ('pagi','siang','malam')),
  luar_ruangan     boolean not null default false,
  langkah          jsonb not null default '[]' check (jsonb_typeof(langkah) = 'array' and jsonb_array_length(langkah) <= 30 and length(langkah::text) <= 60000),
  skor_maks        smallint check (skor_maks between 1 and 25),
  pj_nama          text not null default '' check (length(pj_nama) <= 80),
  target_tanggal   date,
  status           text not null default 'draf' check (status in ('draf','disetujui','selesai','dibatalkan')),
  dibuat_oleh      uuid not null default auth.uid() references public.profil(id),
  disetujui_oleh   uuid references public.profil(id),
  dibuat_pada      timestamptz not null default now(),
  diperbarui_pada  timestamptz not null default now()
);
create index if not exists jsa_unit_idx on public.jsa(unit_id);
create index if not exists jsa_tgl_idx on public.jsa(tanggal);

create table if not exists public.inspeksi (
  id               uuid primary key default gen_random_uuid(),
  nomor            text not null unique default public.fn_nomor('INS'),
  templat          text not null check (templat ~ '^[a-z_]{2,30}$'),
  judul            text not null check (length(judul) between 3 and 120),
  unit_id          int  not null references public.unit(id),
  lokasi           text not null default '' check (length(lokasi) <= 120),
  tanggal          date not null default public.fn_hari_ini(),
  shift            text check (shift in ('pagi','siang','malam')),
  hasil            jsonb not null default '[]' check (jsonb_typeof(hasil) = 'array' and jsonb_array_length(hasil) <= 80 and length(hasil::text) <= 60000),
  skor_kepatuhan   numeric(5,2) check (skor_kepatuhan between 0 and 100),
  jumlah_temuan    int not null default 0 check (jumlah_temuan >= 0),
  catatan          text not null default '' check (length(catatan) <= 1000),
  dibuat_oleh      uuid not null default auth.uid() references public.profil(id),
  dibuat_pada      timestamptz not null default now(),
  diperbarui_pada  timestamptz not null default now()
);
create index if not exists ins_unit_idx on public.inspeksi(unit_id);
create index if not exists ins_tgl_idx on public.inspeksi(tanggal);

-- Pemantauan lingkungan kerja & kesehatan kerja. Data kesehatan HANYA agregat (jumlah kasus), tanpa identitas pekerja.
create table if not exists public.pemantauan (
  id               uuid primary key default gen_random_uuid(),
  jenis            text not null check (jenis in ('lingkungan','kesehatan')),
  parameter        text not null check (parameter ~ '^[a-z0-9_]{2,40}$'),
  unit_id          int  not null references public.unit(id),
  lokasi           text not null default '' check (length(lokasi) <= 120),
  tanggal          date not null default public.fn_hari_ini(),
  shift            text check (shift in ('pagi','siang','malam')),
  nilai            numeric,
  satuan           text not null default '' check (length(satuan) <= 20),
  ambang_min       numeric,
  ambang_maks      numeric,
  jumlah_kasus     int check (jumlah_kasus >= 0),
  jumlah_diperiksa int check (jumlah_diperiksa >= 0),
  status           text not null default 'tidak_ada' check (status in ('normal','melebihi','kurang','tidak_ada')),
  catatan          text not null default '' check (length(catatan) <= 500),
  dibuat_oleh      uuid not null default auth.uid() references public.profil(id),
  dibuat_pada      timestamptz not null default now(),
  constraint kesehatan_agregat check (jenis <> 'kesehatan' or (jumlah_kasus is not null))
);
create index if not exists pem_unit_idx on public.pemantauan(unit_id);
create index if not exists pem_tgl_idx on public.pemantauan(tanggal);

-- Aturan bersama: nilai otomatis, pencipta tidak dapat dipalsukan, status persetujuan JSA, audit trail
create or replace function public.trg_modul_aturan() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if tg_op = 'UPDATE' then
    new.dibuat_oleh := old.dibuat_oleh; new.dibuat_pada := old.dibuat_pada;
    if tg_table_name in ('jsa','inspeksi') then new.nomor := old.nomor; end if;
  else
    if auth.uid() is not null then new.dibuat_oleh := auth.uid(); end if;
    new.dibuat_pada := now();
  end if;
  if tg_table_name in ('jsa','inspeksi') then new.diperbarui_pada := now(); end if;
  if tg_table_name = 'jsa' then
    if new.status = 'disetujui' and (tg_op = 'INSERT' or old.status is distinct from 'disetujui') then new.disetujui_oleh := auth.uid(); end if;
    if new.status = 'draf' then new.disetujui_oleh := null; end if;
    select max(least(25, greatest(1, coalesce((x->>'dampak')::int, 1) * coalesce((x->>'kemungkinan')::int, 1))))
      into new.skor_maks from jsonb_array_elements(new.langkah) x;
  end if;
  if tg_table_name = 'inspeksi' then
    select count(*) filter (where x->>'nilai' = 'tidak'),
           case when count(*) filter (where x->>'nilai' in ('ya','tidak')) = 0 then null
                else round(100.0 * count(*) filter (where x->>'nilai' = 'ya') / count(*) filter (where x->>'nilai' in ('ya','tidak')), 2) end
      into new.jumlah_temuan, new.skor_kepatuhan from jsonb_array_elements(new.hasil) x;
  end if;
  if tg_table_name = 'pemantauan' then
    new.status := case when new.nilai is null then 'tidak_ada'
                       when new.ambang_maks is not null and new.nilai > new.ambang_maks then 'melebihi'
                       when new.ambang_min is not null and new.nilai < new.ambang_min then 'kurang'
                       else 'normal' end;
  end if;
  return new;
end $$;

create or replace function public.trg_modul_log() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare r record;
begin
  r := case when tg_op = 'DELETE' then old else new end;
  insert into public.log_aktivitas(aktor, peran, aksi, objek, objek_id, ringkas)
  values (auth.uid(), public.fn_peran()::text, tg_table_name || '.' || lower(tg_op), tg_table_name, r.id::text,
          left(case tg_table_name when 'jsa' then 'status=' || coalesce(to_jsonb(r)->>'status','')
                                  when 'inspeksi' then 'temuan=' || coalesce(to_jsonb(r)->>'jumlah_temuan','')
                                  when 'pemantauan' then coalesce(to_jsonb(r)->>'parameter','') || '=' || coalesce(to_jsonb(r)->>'status','')
                                  when 'dokumen' then coalesce(to_jsonb(r)->>'judul','') || ' v' || coalesce(to_jsonb(r)->>'versi','') || ' ' || coalesce(to_jsonb(r)->>'status','')
                                  else '' end, 200));
  return null;
end $$;

do $$ declare t text; begin
  foreach t in array array['jsa','inspeksi','pemantauan'] loop
    execute format('drop trigger if exists %1$s_aturan on public.%1$s', t);
    execute format('create trigger %1$s_aturan before insert or update on public.%1$s for each row execute function public.trg_modul_aturan()', t);
    execute format('drop trigger if exists %1$s_log on public.%1$s', t);
    execute format('create trigger %1$s_log after insert or update or delete on public.%1$s for each row execute function public.trg_modul_log()', t);
  end loop;
end $$;

-- ---------- (2) DOKUMEN & SOP ----------
create table if not exists public.dokumen (
  id               uuid primary key default gen_random_uuid(),
  judul            text not null check (length(judul) between 3 and 200),
  nomor            text not null default '' check (length(nomor) <= 60),
  versi            text not null default '1' check (length(versi) between 1 and 20),
  jenis            text not null default 'sop' check (jenis in ('sop','ik','kebijakan','pedoman','formulir','lainnya')),
  berlaku_mulai    date,
  status           text not null default 'aktif' check (status in ('aktif','diganti','nonaktif')),
  menggantikan     uuid references public.dokumen(id) on delete set null,
  unit_id          int references public.unit(id),                 -- null = berlaku untuk semua unit
  path             text check (path is null or path ~ '^[0-9a-f-]{36}/[^/]{1,160}$'),
  nama_berkas      text not null default '' check (length(nama_berkas) <= 160),
  mime             text not null default '' check (length(mime) <= 100),
  ukuran           int check (ukuran between 0 and 20971520),
  metode_ekstraksi text not null default 'teks' check (metode_ekstraksi in ('teks','pdf','docx','ocr','manual')),
  dibuat_oleh      uuid not null default auth.uid() references public.profil(id),
  dibuat_pada      timestamptz not null default now(),
  diperbarui_pada  timestamptz not null default now()
);
create table if not exists public.dokumen_bagian (
  id          bigserial primary key,
  dokumen_id  uuid not null references public.dokumen(id) on delete cascade,
  halaman     int not null check (halaman between 1 and 5000),
  teks        text not null check (length(teks) <= 20000),
  tsv         tsvector generated always as (to_tsvector('simple', teks)) stored
);
create index if not exists dokbag_tsv_idx on public.dokumen_bagian using gin(tsv);
create index if not exists dokbag_dok_idx on public.dokumen_bagian(dokumen_id);

create or replace function public.trg_dokumen_aturan() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if tg_op = 'UPDATE' then new.dibuat_oleh := old.dibuat_oleh; new.dibuat_pada := old.dibuat_pada;
  else if auth.uid() is not null then new.dibuat_oleh := auth.uid(); end if; end if;
  new.diperbarui_pada := now();
  -- Versi baru otomatis menandai versi lama sebagai "diganti" (bukan dihapus)
  if new.menggantikan is not null and new.status = 'aktif' then
    update public.dokumen set status = 'diganti', diperbarui_pada = now() where id = new.menggantikan and status = 'aktif';
  end if;
  return new;
end $$;
drop trigger if exists dokumen_aturan on public.dokumen;
create trigger dokumen_aturan before insert or update on public.dokumen for each row execute function public.trg_dokumen_aturan();
drop trigger if exists dokumen_log on public.dokumen;
create trigger dokumen_log after insert or update or delete on public.dokumen for each row execute function public.trg_modul_log();

-- Pencarian SOP: teks penuh + judul/nomor. SECURITY INVOKER → RLS dokumen tetap berlaku untuk penanya.
create or replace function public.cari_dokumen(p_q text, p_batas int default 30)
returns table(dokumen_id uuid, judul text, nomor text, versi text, jenis text, status text, berlaku_mulai date, unit_id int, halaman int, cuplikan text, peringkat real)
language sql stable security invoker set search_path = public, pg_temp as $$
  with q as (select websearch_to_tsquery('simple', coalesce(p_q, '')) as tq, '%' || replace(replace(coalesce(p_q, ''), '%', ''), '_', '') || '%' as pola)
  select d.id, d.judul, d.nomor, d.versi, d.jenis, d.status, d.berlaku_mulai, d.unit_id, b.halaman,
         ts_headline('simple', b.teks, q.tq, 'MaxWords=40, MinWords=15, StartSel=«, StopSel=», MaxFragments=2, FragmentDelimiter= … '),
         (ts_rank(b.tsv, q.tq) + case when d.judul ilike q.pola or d.nomor ilike q.pola then 1 else 0 end
           + case when d.status = 'aktif' then 0.5 else 0 end)::real
    from public.dokumen d join public.dokumen_bagian b on b.dokumen_id = d.id, q
   where length(btrim(coalesce(p_q, ''))) >= 2 and (b.tsv @@ q.tq or d.judul ilike q.pola or d.nomor ilike q.pola)
   order by 11 desc, d.judul, b.halaman
   limit least(greatest(coalesce(p_batas, 30), 1), 100)
$$;

-- ---------- (3) RIWAYAT HSE INTELLIGENCE (retensi 60 hari) ----------
create table if not exists public.ai_riwayat (
  id            bigserial primary key,
  pengguna_id   uuid not null default auth.uid() references public.profil(id) on delete cascade,
  pada          timestamptz not null default now(),
  shift         text check (shift in ('pagi','siang','malam')),
  kategori      text not null check (kategori in ('pencarian','analisis','cuaca','sop','inspeksi','jsa','lainnya')),
  jenis_kejadian text[] not null default '{}',
  kueri         text not null check (length(kueri) between 1 and 300),
  filter        jsonb not null default '{}' check (length(filter::text) <= 4000),
  ringkasan     text not null default '' check (length(ringkasan) <= 1000),
  referensi     jsonb not null default '[]' check (jsonb_typeof(referensi) = 'array' and jsonb_array_length(referensi) <= 200),
  jumlah_hasil  int not null default 0,
  kedaluwarsa   timestamptz not null default now() + interval '60 days'
);
create index if not exists air_pengguna_idx on public.ai_riwayat(pengguna_id, pada desc);
create or replace function public.trg_ai_riwayat() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  new.pengguna_id := auth.uid(); new.pada := now(); new.kedaluwarsa := now() + interval '60 days';
  new.shift := public.fn_shift(now());
  -- pembersihan oportunistik (selain jadwal harian pg_cron)
  delete from public.ai_riwayat where pengguna_id = auth.uid() and kedaluwarsa < now();
  return new;
end $$;
drop trigger if exists ai_riwayat_aturan on public.ai_riwayat;
create trigger ai_riwayat_aturan before insert on public.ai_riwayat for each row execute function public.trg_ai_riwayat();

-- ---------- (4) LAPORAN BULANAN ----------
create table if not exists public.laporan_bulanan (
  periode       date primary key check (extract(day from periode) = 1),
  data          jsonb not null,
  dibuat_pada   timestamptz not null default now(),
  dibuat_oleh   text not null default 'otomatis',
  status        text not null default 'selesai' check (status in ('selesai','gagal')),
  galat         text not null default ''
);

-- Ringkasan bulan: SECURITY INVOKER → hanya menghitung data yang boleh dilihat pemanggil (RLS).
create or replace function public.ringkasan_bulanan(p_awal date)
returns jsonb language plpgsql stable security invoker set search_path = public, pg_temp as $$
declare
  a date := date_trunc('month', coalesce(p_awal, public.fn_hari_ini()))::date;
  b date := (date_trunc('month', coalesce(p_awal, public.fn_hari_ini())) + interval '1 month')::date;
  pita jsonb := coalesce((select pita_risiko from public.pengaturan where id = 1), '[]');
  hasil jsonb;
begin
  with L as (select id, jenis, kategori_kode, unit_id, mendesak, skor, status, tanggal_lapor from public.laporan where tanggal_lapor >= a and tanggal_lapor < b and not contoh),
  T as (select l.*, (select e->>'label' from jsonb_array_elements(pita) e where l.skor <= (e->>'maks')::int order by (e->>'maks')::int limit 1) as tingkat from L l)
  select jsonb_build_object(
    'periode', to_char(a, 'YYYY-MM'),
    'dihitung_pada', now(),
    'laporan_total', (select count(*) from L),
    'per_jenis', coalesce((select jsonb_object_agg(jenis, n) from (select jenis, count(*) n from L group by 1) x), '{}'),
    'per_kategori', coalesce((select jsonb_object_agg(kategori_kode, n) from (select kategori_kode, count(*) n from L group by 1) x), '{}'),
    'per_unit', coalesce((select jsonb_object_agg(u.nama, n) from (select unit_id, count(*) n from L group by 1) x join public.unit u on u.id = x.unit_id), '{}'),
    'per_tingkat', coalesce((select jsonb_object_agg(coalesce(tingkat, 'Belum dinilai'), n) from (select tingkat, count(*) n from T group by 1) x), '{}'),
    'mendesak', (select count(*) from L where mendesak),
    'capa_tindakan', (select count(*) from public.tindak_lanjut where dibuat_pada >= a and dibuat_pada < b),
    'capa_ditutup', (select count(*) from public.laporan where ditutup_pada >= a and ditutup_pada < b and not contoh),
    'capa_terbuka_akhir_bulan', (select count(*) from public.laporan where tanggal_lapor < b and not contoh and (ditutup_pada is null or ditutup_pada >= b) and status not in ('tidak_dilanjutkan')),
    'capa_terlambat', (select count(*) from public.laporan where not contoh and target_tanggal < least(b, public.fn_hari_ini()) and status in ('ditugaskan','dalam_tindak_lanjut')),
    'persen_selesai_bulan_ini', (select case when count(*) = 0 then null else round(100.0 * count(*) filter (where status = 'tertutup') / count(*), 1) end from L),
    'inspeksi_jumlah', (select count(*) from public.inspeksi where tanggal >= a and tanggal < b),
    'inspeksi_temuan', (select coalesce(sum(jumlah_temuan), 0) from public.inspeksi where tanggal >= a and tanggal < b),
    'inspeksi_kepatuhan_rata', (select round(avg(skor_kepatuhan), 1) from public.inspeksi where tanggal >= a and tanggal < b),
    'jsa_jumlah', (select count(*) from public.jsa where tanggal >= a and tanggal < b),
    'jsa_risiko_tinggi', (select count(*) from public.jsa where tanggal >= a and tanggal < b and skor_maks >= 10),
    'pemantauan_jumlah', (select count(*) from public.pemantauan where tanggal >= a and tanggal < b),
    'pemantauan_melebihi', (select count(*) from public.pemantauan where tanggal >= a and tanggal < b and status in ('melebihi','kurang')),
    'keluhan_kesehatan', (select coalesce(sum(jumlah_kasus), 0) from public.pemantauan where jenis = 'kesehatan' and tanggal >= a and tanggal < b)
  ) into hasil;
  return hasil;
end $$;

-- Dipanggil pg_cron tanggal 1 (periode = bulan sebelumnya). Tidak menimpa periode yang sudah ada kecuali p_paksa.
create or replace function public.buat_laporan_bulanan(p_awal date default null, p_paksa boolean default false)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare a date := coalesce(date_trunc('month', p_awal)::date, (date_trunc('month', public.fn_hari_ini()) - interval '1 month')::date);
        d jsonb; ada boolean;
begin
  if auth.uid() is not null and not public.fn_k3rs() then raise exception 'Hanya K3RS'; end if;
  select exists(select 1 from public.laporan_bulanan where periode = a) into ada;
  if ada and not p_paksa then return (select data from public.laporan_bulanan where periode = a); end if;
  begin
    d := public.ringkasan_bulanan(a);
    d := d || jsonb_build_object('sebelumnya', public.ringkasan_bulanan((a - interval '1 month')::date) - 'sebelumnya');
    insert into public.laporan_bulanan(periode, data, dibuat_oleh, status) values (a, d, case when auth.uid() is null then 'otomatis' else auth.uid()::text end, 'selesai')
    on conflict (periode) do update set data = excluded.data, dibuat_pada = now(), dibuat_oleh = excluded.dibuat_oleh, status = 'selesai', galat = '';
  exception when others then
    insert into public.laporan_bulanan(periode, data, status, galat) values (a, '{}', 'gagal', left(sqlerrm, 300))
    on conflict (periode) do update set status = 'gagal', galat = left(sqlerrm, 300), dibuat_pada = now();
    raise;
  end;
  insert into public.sinkron_antrean(tabel, rec_id) values ('laporan_bulanan', to_char(a, 'YYYY-MM-DD'))
  on conflict (tabel, rec_id) do update set status = 'menunggu', percobaan = 0, galat = '', diantre_pada = now();
  return d;
end $$;

-- ---------- (5) SINKRONISASI GOOGLE SHEETS (Supabase = sumber data resmi) ----------
create table if not exists public.sinkron_antrean (
  id            bigserial primary key,
  tabel         text not null check (tabel in ('laporan','tindak_lanjut','jsa','inspeksi','pemantauan','laporan_bulanan')),
  rec_id        text not null,
  status        text not null default 'menunggu' check (status in ('menunggu','diproses','terkirim','gagal')),
  percobaan     int  not null default 0,
  galat         text not null default '',
  diantre_pada  timestamptz not null default now(),
  diproses_pada timestamptz,
  terkirim_pada timestamptz,
  unique (tabel, rec_id)                                 -- satu baris per record: retry tidak menggandakan data
);
create index if not exists sinkron_status_idx on public.sinkron_antrean(status, id);
create table if not exists public.sinkron_log (
  id      bigserial primary key,
  pada    timestamptz not null default now(),
  jenis   text not null,
  jumlah  int not null default 0,
  galat   text not null default ''
);
create table if not exists public.sinkron_kunci (
  satu        boolean primary key default true check (satu),
  token_hash  text not null,
  diubah_pada timestamptz not null default now()
);

-- Pemicu antrean: TIDAK PERNAH menggagalkan penyimpanan data utama
create or replace function public.trg_antre_sinkron() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  begin
    insert into public.sinkron_antrean(tabel, rec_id) values (tg_table_name, new.id::text)
    on conflict (tabel, rec_id) do update set status = 'menunggu', percobaan = 0, galat = '', diantre_pada = now();
  exception when others then null;
  end;
  return null;
end $$;
do $$ declare t text; begin
  foreach t in array array['laporan','tindak_lanjut','jsa','inspeksi','pemantauan'] loop
    execute format('drop trigger if exists %1$s_sinkron on public.%1$s', t);
    execute format('create trigger %1$s_sinkron after insert or update on public.%1$s for each row execute function public.trg_antre_sinkron()', t);
  end loop;
end $$;

-- Proyeksi aman per tabel (tanpa pelapor_id, kode lacak, id klien, path foto)
create or replace function public.fn_baris_sinkron(p_tabel text, p_id text) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare r jsonb; zona text := coalesce((select zona_waktu from public.pengaturan where id = 1), 'Asia/Makassar');
        pita jsonb := coalesce((select pita_risiko from public.pengaturan where id = 1), '[]');
begin
  if p_tabel = 'laporan' then
    select jsonb_build_object('id', l.id, 'nomor', l.nomor, 'tanggal', l.tanggal_lapor,
      'jam', case when l.anonim then '' else to_char(l.dibuat_pada at time zone zona, 'HH24:MI') end,
      'shift', case when l.anonim then '' else public.fn_shift(l.dibuat_pada) end,
      'jenis', l.jenis, 'kategori', k.nama, 'unit', u.nama, 'lokasi', l.lokasi, 'uraian', l.uraian, 'mendesak', l.mendesak, 'anonim', l.anonim,
      'dampak', l.dampak, 'kemungkinan', l.kemungkinan, 'skor', l.skor,
      'tingkat', (select e->>'label' from jsonb_array_elements(pita) e where l.skor <= (e->>'maks')::int order by (e->>'maks')::int limit 1),
      'status', l.status, 'penanggung_jawab', coalesce(p.nama_tampilan, ''), 'target', l.target_tanggal, 'pengendalian', l.level_pengendalian,
      'ditutup_pada', to_char(l.ditutup_pada at time zone zona, 'YYYY-MM-DD HH24:MI'), 'contoh', l.contoh,
      'diperbarui', to_char(l.diperbarui_pada at time zone zona, 'YYYY-MM-DD HH24:MI'))
      into r from public.laporan l join public.kategori k on k.kode = l.kategori_kode join public.unit u on u.id = l.unit_id
      left join public.profil p on p.id = l.pj_id where l.id::text = p_id;
  elsif p_tabel = 'tindak_lanjut' then
    select jsonb_build_object('id', t.id, 'nomor_laporan', l.nomor, 'tanggal', to_char(t.dibuat_pada at time zone zona, 'YYYY-MM-DD HH24:MI'),
      'pengendalian', t.level_pengendalian, 'uraian', t.uraian, 'bukti', t.bukti_teks, 'status_laporan', l.status, 'unit', u.nama)
      into r from public.tindak_lanjut t join public.laporan l on l.id = t.laporan_id join public.unit u on u.id = l.unit_id where t.id::text = p_id;
  elsif p_tabel = 'jsa' then
    select jsonb_build_object('id', j.id, 'nomor', j.nomor, 'tanggal', j.tanggal, 'shift', j.shift, 'pekerjaan', j.pekerjaan, 'unit', u.nama, 'lokasi', j.lokasi,
      'luar_ruangan', j.luar_ruangan, 'jumlah_langkah', jsonb_array_length(j.langkah), 'skor_maks', j.skor_maks, 'penanggung_jawab', j.pj_nama,
      'target', j.target_tanggal, 'status', j.status,
      'bahaya', (select string_agg(coalesce(x->>'langkah', '') || ': ' || coalesce(x->>'uraian_bahaya', ''), ' | ') from jsonb_array_elements(j.langkah) x))
      into r from public.jsa j join public.unit u on u.id = j.unit_id where j.id::text = p_id;
  elsif p_tabel = 'inspeksi' then
    select jsonb_build_object('id', i.id, 'nomor', i.nomor, 'tanggal', i.tanggal, 'shift', i.shift, 'daftar_periksa', i.judul, 'unit', u.nama, 'lokasi', i.lokasi,
      'kepatuhan_persen', i.skor_kepatuhan, 'jumlah_temuan', i.jumlah_temuan, 'catatan', i.catatan,
      'temuan', (select string_agg(coalesce(x->>'butir', '') || case when coalesce(x->>'catatan', '') <> '' then ' (' || (x->>'catatan') || ')' else '' end, ' | ') from jsonb_array_elements(i.hasil) x where x->>'nilai' = 'tidak'))
      into r from public.inspeksi i join public.unit u on u.id = i.unit_id where i.id::text = p_id;
  elsif p_tabel = 'pemantauan' then
    select jsonb_build_object('id', m.id, 'tanggal', m.tanggal, 'shift', m.shift, 'jenis', m.jenis, 'parameter', m.parameter, 'unit', u.nama, 'lokasi', m.lokasi,
      'nilai', m.nilai, 'satuan', m.satuan, 'ambang_min', m.ambang_min, 'ambang_maks', m.ambang_maks, 'status', m.status,
      'jumlah_kasus', m.jumlah_kasus, 'jumlah_diperiksa', m.jumlah_diperiksa, 'catatan', m.catatan)
      into r from public.pemantauan m join public.unit u on u.id = m.unit_id where m.id::text = p_id;
  elsif p_tabel = 'laporan_bulanan' then
    select jsonb_build_object('id', to_char(periode, 'YYYY-MM'), 'periode', to_char(periode, 'YYYY-MM'), 'status', status, 'dibuat_pada', to_char(dibuat_pada at time zone zona, 'YYYY-MM-DD HH24:MI'), 'data', data)
      into r from public.laporan_bulanan where periode::text = p_id;
  end if;
  return r;
end $$;

create or replace function public.fn_cek_token_sinkron(p_token text) returns void
language plpgsql stable security definer set search_path = public, extensions, pg_temp as $$
begin
  if p_token is null or length(p_token) < 32 or not exists (select 1 from public.sinkron_kunci where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')) then
    raise exception 'Token sinkronisasi tidak valid';
  end if;
end $$;

-- Diambil Google Apps Script. Baris "diproses" > 15 menit dan "gagal" (< 10 percobaan, jeda 30 menit) diambil ulang (retry).
create or replace function public.sinkron_ambil(p_token text, p_batas int default 200)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare hasil jsonb;
begin
  perform public.fn_cek_token_sinkron(p_token);
  with pilih as (
    select id from public.sinkron_antrean
     where status = 'menunggu'
        or (status = 'diproses' and diproses_pada < now() - interval '15 minutes')
        or (status = 'gagal' and percobaan < 10 and diproses_pada < now() - interval '30 minutes')
     order by id limit least(greatest(coalesce(p_batas, 200), 1), 500) for update skip locked),
  tandai as (
    update public.sinkron_antrean a set status = 'diproses', percobaan = a.percobaan + 1, diproses_pada = now()
      from pilih where a.id = pilih.id returning a.id, a.tabel, a.rec_id)
  select coalesce(jsonb_agg(jsonb_build_object('antrean_id', id, 'tabel', tabel, 'id', rec_id, 'data', public.fn_baris_sinkron(tabel, rec_id)) order by id), '[]')
    into hasil from tandai;
  return hasil;
end $$;

create or replace function public.sinkron_lapor(p_token text, p_hasil jsonb)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare ok int := 0; gagal int := 0; x jsonb;
begin
  perform public.fn_cek_token_sinkron(p_token);
  if jsonb_typeof(p_hasil) <> 'array' or jsonb_array_length(p_hasil) > 500 then raise exception 'Format hasil tidak valid'; end if;
  for x in select * from jsonb_array_elements(p_hasil) loop
    if coalesce((x->>'ok')::boolean, false) then
      update public.sinkron_antrean set status = 'terkirim', terkirim_pada = now(), galat = '' where id = (x->>'antrean_id')::bigint and status = 'diproses'; ok := ok + 1;
    else
      update public.sinkron_antrean set status = 'gagal', galat = left(coalesce(x->>'galat', 'tidak diketahui'), 300) where id = (x->>'antrean_id')::bigint; gagal := gagal + 1;
    end if;
  end loop;
  insert into public.sinkron_log(jenis, jumlah, galat) values ('kirim', ok, case when gagal > 0 then gagal || ' baris gagal' else '' end);
  return jsonb_build_object('terkirim', ok, 'gagal', gagal);
end $$;

-- K3RS: atur token (disimpan sebagai hash), antre ulang, ringkasan status
create or replace function public.sinkron_atur_token(p_token text) returns void
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
begin
  if not public.fn_k3rs() then raise exception 'Hanya K3RS'; end if;
  if p_token is null or length(p_token) < 32 then raise exception 'Token minimal 32 karakter'; end if;
  insert into public.sinkron_kunci(satu, token_hash) values (true, encode(extensions.digest(p_token, 'sha256'), 'hex'))
  on conflict (satu) do update set token_hash = excluded.token_hash, diubah_pada = now();
  perform public.catat('sinkron.token', 'sinkron', '', 'Token sinkronisasi diganti');
end $$;

create or replace function public.sinkron_antre_ulang(p_tabel text default null, p_hanya_gagal boolean default false)
returns int language plpgsql security definer set search_path = public, pg_temp as $$
declare n int := 0; m int;
begin
  if not public.fn_k3rs() then raise exception 'Hanya K3RS'; end if;
  if p_hanya_gagal then
    update public.sinkron_antrean set status = 'menunggu', percobaan = 0, galat = '' where status = 'gagal' and (p_tabel is null or tabel = p_tabel);
    get diagnostics n = row_count;
  else
    if p_tabel is null or p_tabel = 'laporan' then insert into public.sinkron_antrean(tabel, rec_id) select 'laporan', id::text from public.laporan where not contoh on conflict (tabel, rec_id) do update set status = 'menunggu', percobaan = 0, galat = ''; get diagnostics m = row_count; n := n + m; end if;
    if p_tabel is null or p_tabel = 'tindak_lanjut' then insert into public.sinkron_antrean(tabel, rec_id) select 'tindak_lanjut', id::text from public.tindak_lanjut on conflict (tabel, rec_id) do update set status = 'menunggu', percobaan = 0, galat = ''; get diagnostics m = row_count; n := n + m; end if;
    if p_tabel is null or p_tabel = 'jsa' then insert into public.sinkron_antrean(tabel, rec_id) select 'jsa', id::text from public.jsa on conflict (tabel, rec_id) do update set status = 'menunggu', percobaan = 0, galat = ''; get diagnostics m = row_count; n := n + m; end if;
    if p_tabel is null or p_tabel = 'inspeksi' then insert into public.sinkron_antrean(tabel, rec_id) select 'inspeksi', id::text from public.inspeksi on conflict (tabel, rec_id) do update set status = 'menunggu', percobaan = 0, galat = ''; get diagnostics m = row_count; n := n + m; end if;
    if p_tabel is null or p_tabel = 'pemantauan' then insert into public.sinkron_antrean(tabel, rec_id) select 'pemantauan', id::text from public.pemantauan on conflict (tabel, rec_id) do update set status = 'menunggu', percobaan = 0, galat = ''; get diagnostics m = row_count; n := n + m; end if;
    if p_tabel is null or p_tabel = 'laporan_bulanan' then insert into public.sinkron_antrean(tabel, rec_id) select 'laporan_bulanan', periode::text from public.laporan_bulanan on conflict (tabel, rec_id) do update set status = 'menunggu', percobaan = 0, galat = ''; get diagnostics m = row_count; n := n + m; end if;
  end if;
  perform public.catat('sinkron.antre_ulang', 'sinkron', coalesce(p_tabel, 'semua'), n || ' baris');
  return n;
end $$;

create or replace function public.sinkron_ringkas() returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not public.fn_k3rs() then raise exception 'Hanya K3RS'; end if;
  return jsonb_build_object(
    'token_terpasang', exists(select 1 from public.sinkron_kunci),
    'per_status', coalesce((select jsonb_object_agg(status, n) from (select status, count(*) n from public.sinkron_antrean group by 1) x), '{}'),
    'gagal_terakhir', coalesce((select jsonb_agg(jsonb_build_object('tabel', tabel, 'id', rec_id, 'percobaan', percobaan, 'galat', galat) order by id desc) from (select * from public.sinkron_antrean where status = 'gagal' order by id desc limit 20) g), '[]'),
    'log', coalesce((select jsonb_agg(jsonb_build_object('pada', pada, 'jenis', jenis, 'jumlah', jumlah, 'galat', galat) order by id desc) from (select * from public.sinkron_log order by id desc limit 20) l), '[]'));
end $$;

-- ---------- (6) RLS & HAK AKSES ----------
alter table public.jsa              enable row level security;
alter table public.inspeksi         enable row level security;
alter table public.pemantauan       enable row level security;
alter table public.dokumen          enable row level security;
alter table public.dokumen_bagian   enable row level security;
alter table public.ai_riwayat       enable row level security;
alter table public.laporan_bulanan  enable row level security;
alter table public.sinkron_antrean  enable row level security;
alter table public.sinkron_log      enable row level security;
alter table public.sinkron_kunci    enable row level security;

revoke all on public.jsa, public.inspeksi, public.pemantauan, public.dokumen, public.dokumen_bagian, public.ai_riwayat,
              public.laporan_bulanan, public.sinkron_antrean, public.sinkron_log, public.sinkron_kunci from anon, authenticated;
grant select, insert, update, delete on public.jsa, public.inspeksi, public.pemantauan, public.dokumen to authenticated;
grant select, insert, delete on public.dokumen_bagian, public.ai_riwayat to authenticated;
grant select on public.laporan_bulanan, public.sinkron_antrean, public.sinkron_log to authenticated;
grant usage on sequence public.dokumen_bagian_id_seq, public.ai_riwayat_id_seq to authenticated;

-- JSA: dibaca semua pengguna aktif di unitnya (pekerja perlu membaca JSA pekerjaannya); dibuat K3RS/PJ unit
drop policy if exists jsa_baca on public.jsa;
create policy jsa_baca on public.jsa for select to authenticated
  using (public.fn_peran() is not null and (public.fn_k3rs() or unit_id = public.fn_unit() or dibuat_oleh = auth.uid()));
drop policy if exists jsa_tambah on public.jsa;
create policy jsa_tambah on public.jsa for insert to authenticated
  with check (public.fn_k3rs() or (public.fn_peran() = 'pj_unit' and unit_id = public.fn_unit() and status = 'draf'));
drop policy if exists jsa_ubah on public.jsa;
create policy jsa_ubah on public.jsa for update to authenticated
  using (public.fn_k3rs() or (public.fn_peran() = 'pj_unit' and dibuat_oleh = auth.uid() and status in ('draf','disetujui')))
  with check (public.fn_k3rs() or (public.fn_peran() = 'pj_unit' and unit_id = public.fn_unit() and status in ('draf','selesai')));
drop policy if exists jsa_hapus on public.jsa;
create policy jsa_hapus on public.jsa for delete to authenticated using (public.fn_k3rs());

-- Inspeksi
drop policy if exists ins_baca on public.inspeksi;
create policy ins_baca on public.inspeksi for select to authenticated
  using (public.fn_peran() is not null and (public.fn_k3rs() or unit_id = public.fn_unit() or dibuat_oleh = auth.uid()));
drop policy if exists ins_tambah on public.inspeksi;
create policy ins_tambah on public.inspeksi for insert to authenticated
  with check (public.fn_k3rs() or (public.fn_peran() = 'pj_unit' and unit_id = public.fn_unit()));
drop policy if exists ins_ubah on public.inspeksi;
create policy ins_ubah on public.inspeksi for update to authenticated
  using (public.fn_k3rs() or (public.fn_peran() = 'pj_unit' and dibuat_oleh = auth.uid()))
  with check (public.fn_k3rs() or (public.fn_peran() = 'pj_unit' and unit_id = public.fn_unit()));
drop policy if exists ins_hapus on public.inspeksi;
create policy ins_hapus on public.inspeksi for delete to authenticated using (public.fn_k3rs());

-- Pemantauan: data kesehatan (agregat) hanya untuk K3RS dan PJ unit terkait
drop policy if exists pem_baca on public.pemantauan;
create policy pem_baca on public.pemantauan for select to authenticated
  using (public.fn_k3rs() or (public.fn_peran() is not null and unit_id = public.fn_unit() and (jenis = 'lingkungan' or public.fn_peran() = 'pj_unit')));
drop policy if exists pem_tambah on public.pemantauan;
create policy pem_tambah on public.pemantauan for insert to authenticated
  with check (public.fn_k3rs() or (public.fn_peran() = 'pj_unit' and unit_id = public.fn_unit()));
drop policy if exists pem_ubah on public.pemantauan;
create policy pem_ubah on public.pemantauan for update to authenticated
  using (public.fn_k3rs() or (public.fn_peran() = 'pj_unit' and dibuat_oleh = auth.uid()))
  with check (public.fn_k3rs() or (public.fn_peran() = 'pj_unit' and unit_id = public.fn_unit()));
drop policy if exists pem_hapus on public.pemantauan;
create policy pem_hapus on public.pemantauan for delete to authenticated using (public.fn_k3rs());

-- Dokumen: dibaca pengguna aktif (sesuai unit bila dibatasi); versi nonaktif hanya K3RS; dikelola K3RS
drop policy if exists dok_baca on public.dokumen;
create policy dok_baca on public.dokumen for select to authenticated
  using (public.fn_k3rs() or (public.fn_peran() is not null and status <> 'nonaktif' and (unit_id is null or unit_id = public.fn_unit())));
drop policy if exists dok_kelola on public.dokumen;
create policy dok_kelola on public.dokumen for all to authenticated using (public.fn_k3rs()) with check (public.fn_k3rs());
drop policy if exists dokbag_baca on public.dokumen_bagian;
create policy dokbag_baca on public.dokumen_bagian for select to authenticated
  using (exists (select 1 from public.dokumen d where d.id = dokumen_id));           -- mengikuti RLS dokumen
drop policy if exists dokbag_tambah on public.dokumen_bagian;
create policy dokbag_tambah on public.dokumen_bagian for insert to authenticated with check (public.fn_k3rs());
drop policy if exists dokbag_hapus on public.dokumen_bagian;
create policy dokbag_hapus on public.dokumen_bagian for delete to authenticated using (public.fn_k3rs());

-- Riwayat HSE Intelligence: milik sendiri (K3RS dapat melihat untuk audit); hanya yang belum kedaluwarsa
drop policy if exists air_baca on public.ai_riwayat;
create policy air_baca on public.ai_riwayat for select to authenticated
  using (kedaluwarsa > now() and (pengguna_id = auth.uid() or public.fn_k3rs()));
drop policy if exists air_tambah on public.ai_riwayat;
create policy air_tambah on public.ai_riwayat for insert to authenticated with check (public.fn_peran() is not null);
drop policy if exists air_hapus on public.ai_riwayat;
create policy air_hapus on public.ai_riwayat for delete to authenticated using (pengguna_id = auth.uid());

drop policy if exists lb_baca on public.laporan_bulanan;
create policy lb_baca on public.laporan_bulanan for select to authenticated using (public.fn_peran() in ('k3rs','pj_unit'));
drop policy if exists sa_baca on public.sinkron_antrean;
create policy sa_baca on public.sinkron_antrean for select to authenticated using (public.fn_k3rs());
drop policy if exists sl_baca on public.sinkron_log;
create policy sl_baca on public.sinkron_log for select to authenticated using (public.fn_k3rs());
-- sinkron_kunci: tanpa kebijakan = tidak terbaca dari aplikasi

-- Fungsi baru: cabut akses bawaan, beri seperlunya
revoke execute on function public.fn_shift(timestamptz), public.fn_nomor(text), public.trg_modul_aturan(), public.trg_modul_log(),
  public.trg_dokumen_aturan(), public.cari_dokumen(text, int), public.trg_ai_riwayat(), public.ringkasan_bulanan(date),
  public.buat_laporan_bulanan(date, boolean), public.trg_antre_sinkron(), public.fn_baris_sinkron(text, text), public.fn_cek_token_sinkron(text),
  public.sinkron_ambil(text, int), public.sinkron_lapor(text, jsonb), public.sinkron_atur_token(text), public.sinkron_antre_ulang(text, boolean),
  public.sinkron_ringkas() from public, anon, authenticated;
grant execute on function public.fn_shift(timestamptz), public.fn_nomor(text), public.cari_dokumen(text, int), public.ringkasan_bulanan(date),
  public.buat_laporan_bulanan(date, boolean), public.sinkron_atur_token(text), public.sinkron_antre_ulang(text, boolean), public.sinkron_ringkas() to authenticated;
-- Google Apps Script memanggil dua fungsi ini dengan kunci anon + token rahasia (token diperiksa di dalam fungsi)
grant execute on function public.sinkron_ambil(text, int), public.sinkron_lapor(text, jsonb) to anon, authenticated;

-- ---------- (7) PENYIMPANAN BERKAS DOKUMEN (bucket privat, maks 20 MB) ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('dokumen', 'dokumen', false, 20971520, array['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/plain','image/png','image/jpeg'])
on conflict (id) do update set public = false, file_size_limit = 20971520,
  allowed_mime_types = array['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/plain','image/png','image/jpeg'];
drop policy if exists "hse unggah dokumen" on storage.objects;
create policy "hse unggah dokumen" on storage.objects for insert to authenticated
  with check (bucket_id = 'dokumen' and public.fn_k3rs());
drop policy if exists "hse baca dokumen" on storage.objects;
create policy "hse baca dokumen" on storage.objects for select to authenticated
  using (bucket_id = 'dokumen' and exists (select 1 from public.dokumen d where d.path = storage.objects.name));
drop policy if exists "hse hapus dokumen" on storage.objects;
create policy "hse hapus dokumen" on storage.objects for delete to authenticated
  using (bucket_id = 'dokumen' and public.fn_k3rs());

-- ---------- (8) JADWAL OTOMATIS (pg_cron) ----------
-- Bila pg_cron belum aktif: Dashboard > Database > Extensions > pg_cron > Enable, lalu jalankan blok ini lagi.
do $$ begin
  create extension if not exists pg_cron;
exception when others then raise notice 'pg_cron belum dapat diaktifkan: %', sqlerrm; end $$;
do $$ begin
  perform cron.schedule('hse-hapus-riwayat-ai', '20 18 * * *', 'delete from public.ai_riwayat where kedaluwarsa < now()');      -- 02.20 WITA
  perform cron.schedule('hse-laporan-bulanan', '35 0 1 * *', 'select public.buat_laporan_bulanan(null, false)');                  -- tgl 1, 08.35 WITA
  perform cron.schedule('hse-sinkron-bersih', '40 18 * * 0', $c$delete from public.sinkron_log where pada < now() - interval '180 days'$c$);
exception when others then raise notice 'Jadwal belum dibuat (pg_cron tidak tersedia): %', sqlerrm; end $$;

-- Selesai. Periksa: select * from cron.job;  ·  select public.ringkasan_bulanan(current_date);
