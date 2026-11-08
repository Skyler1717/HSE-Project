-- =====================================================================
-- 21_jejak_dan_dokumen.sql — jejak perubahan lengkap + metadata dokumen
-- Prasyarat: 20_modul_hse.sql. Sifat: HANYA MENAMBAH; aman dijalankan ulang.
--   (1) public.jejak_perubahan: siapa, kapan, aksi, nilai lama, nilai baru, ID rujukan
--       untuk laporan, tindak lanjut (CAPA), JSA, inspeksi, pemantauan, dan dokumen.
--       Kolom identitas pelapor/kode lacak TIDAK pernah dicatat; pelaku laporan anonim tidak dicatat.
--   (2) Dokumen: tanggal tinjau ulang, pemilik dokumen, catatan revisi.
-- Rollback: supabase/29b_rollback_jejak_dan_dokumen.sql
-- =====================================================================

create table if not exists public.jejak_perubahan (
  id        bigserial primary key,
  pada      timestamptz not null default now(),
  aktor     uuid,
  tabel     text not null,
  rec_id    text not null,
  rujukan   text not null default '',          -- nomor laporan/JSA/inspeksi atau judul dokumen
  aksi      text not null check (aksi in ('buat','ubah','hapus')),
  sebelum   jsonb,
  sesudah   jsonb
);
create index if not exists jejak_rec_idx on public.jejak_perubahan(tabel, rec_id, pada desc);

create or replace function public.trg_jejak() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  rahasia text[] := array['pelapor_id','kode_lacak_hash','id_klien','foto_path','bukti_foto_path','diperbarui_pada','tsv'];
  a jsonb; b jsonb; s jsonb := '{}'; t jsonb := '{}'; k text; r jsonb; aktor uuid := auth.uid();
begin
  if tg_op <> 'INSERT' then a := to_jsonb(old); end if;
  if tg_op <> 'DELETE' then b := to_jsonb(new); end if;
  r := coalesce(b, a);
  if tg_op = 'UPDATE' then
    for k in select jsonb_object_keys(b) loop
      if k = any(rahasia) then continue; end if;
      if (a -> k) is distinct from (b -> k) then s := s || jsonb_build_object(k, a -> k); t := t || jsonb_build_object(k, b -> k); end if;
    end loop;
    if t = '{}' then return null; end if;
  else
    if a is not null then s := a; end if; if b is not null then t := b; end if;
    foreach k in array rahasia loop s := s - k; t := t - k; end loop;
  end if;
  -- Laporan anonim: pembuat tidak dicatat
  if tg_table_name = 'laporan' and tg_op = 'INSERT' and coalesce((r->>'anonim')::boolean, false) then aktor := null; end if;
  insert into public.jejak_perubahan(aktor, tabel, rec_id, rujukan, aksi, sebelum, sesudah)
  values (aktor, tg_table_name, r->>'id', left(coalesce(r->>'nomor', r->>'judul', ''), 200),
          case tg_op when 'INSERT' then 'buat' when 'UPDATE' then 'ubah' else 'hapus' end,
          case when tg_op = 'INSERT' then null else s end, case when tg_op = 'DELETE' then null else t end);
  return null;
exception when others then
  return null;   -- jejak tidak boleh menggagalkan penyimpanan data utama
end $$;

do $$ declare t text; begin
  foreach t in array array['laporan','tindak_lanjut','jsa','inspeksi','pemantauan','dokumen'] loop
    execute format('drop trigger if exists %1$s_jejak on public.%1$s', t);
    execute format('create trigger %1$s_jejak after insert or update or delete on public.%1$s for each row execute function public.trg_jejak()', t);
  end loop;
end $$;

alter table public.jejak_perubahan enable row level security;
revoke all on public.jejak_perubahan from anon, authenticated;
revoke all on sequence public.jejak_perubahan_id_seq from anon, authenticated;
grant select on public.jejak_perubahan to authenticated;
drop policy if exists jejak_baca on public.jejak_perubahan;
create policy jejak_baca on public.jejak_perubahan for select to authenticated using (public.fn_k3rs());

-- Dokumen: metadata pengendalian dokumen
alter table public.dokumen add column if not exists tanggal_tinjau date;
alter table public.dokumen add column if not exists pemilik text not null default '' check (length(pemilik) <= 80);
alter table public.dokumen add column if not exists catatan_revisi text not null default '' check (length(catatan_revisi) <= 500);

-- Konsistensi perhitungan: "JSA risiko tinggi" mengikuti pita risiko di Pengaturan (sama dengan aplikasi)
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
    'jsa_risiko_tinggi', (select count(*) from public.jsa where tanggal >= a and tanggal < b and skor_maks > coalesce((select (e->>'maks')::int from jsonb_array_elements(pita) e order by (e->>'maks')::int offset 1 limit 1), 9)),
    'pemantauan_jumlah', (select count(*) from public.pemantauan where tanggal >= a and tanggal < b),
    'pemantauan_melebihi', (select count(*) from public.pemantauan where tanggal >= a and tanggal < b and status in ('melebihi','kurang')),
    'keluhan_kesehatan', (select coalesce(sum(jumlah_kasus), 0) from public.pemantauan where jenis = 'kesehatan' and tanggal >= a and tanggal < b)
  ) into hasil;
  return hasil;
end $$;

revoke execute on function public.trg_jejak() from public, anon, authenticated;
