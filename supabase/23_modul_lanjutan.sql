-- =====================================================================
-- 23_modul_lanjutan.sql — Investigasi & RCA, CAPA lintas modul, Izin Kerja (PTW),
-- Toolbox Meeting & Pelatihan, Notifikasi (in-app + antrean email/push), indeks paginasi.
-- Prasyarat: 01, usulan/10, 20, 21. Sifat: HANYA MENAMBAH; aman dijalankan ulang.
-- Rollback: supabase/29c_rollback_modul_lanjutan.sql
-- Semua aturan alur kerja ditegakkan di server (pemicu/fungsi + RLS), bukan hanya di tampilan.
-- =====================================================================

create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------
-- (1) INVESTIGASI KECELAKAAN & ANALISIS AKAR MASALAH
-- ---------------------------------------------------------------------
create table if not exists public.investigasi (
  id                  uuid primary key default gen_random_uuid(),
  nomor               text not null unique default public.fn_nomor('INV'),
  laporan_id          uuid not null references public.laporan(id) on delete restrict,
  unit_id             int  not null references public.unit(id),
  ketua_id            uuid not null references public.profil(id),
  tim                 jsonb not null default '[]' check (jsonb_typeof(tim) = 'array' and jsonb_array_length(tim) <= 20),
  waktu_kejadian      timestamptz,
  lokasi              text not null default '' check (length(lokasi) <= 160),
  pekerjaan           text not null default '' check (length(pekerjaan) <= 200),
  pihak_terkait       text not null default '' check (length(pihak_terkait) <= 500),
  kronologi           jsonb not null default '[]' check (jsonb_typeof(kronologi) = 'array' and jsonb_array_length(kronologi) <= 60),
  bukti               jsonb not null default '[]' check (jsonb_typeof(bukti) = 'array' and jsonb_array_length(bukti) <= 40),
  saksi               jsonb not null default '[]' check (jsonb_typeof(saksi) = 'array' and jsonb_array_length(saksi) <= 30),
  tindakan_tidak_aman text not null default '' check (length(tindakan_tidak_aman) <= 2000),
  kondisi_tidak_aman  text not null default '' check (length(kondisi_tidak_aman) <= 2000),
  penyebab_langsung   text not null default '' check (length(penyebab_langsung) <= 2000),
  penyebab_dasar      text not null default '' check (length(penyebab_dasar) <= 2000),
  lima_why            jsonb not null default '[]' check (jsonb_typeof(lima_why) = 'array' and jsonb_array_length(lima_why) <= 10),
  fishbone            jsonb not null default '{}' check (jsonb_typeof(fishbone) = 'object'),
  akar_masalah        text not null default '' check (length(akar_masalah) <= 2000),
  status              text not null default 'draf' check (status in ('draf','analisis','menunggu_persetujuan','disetujui','ditutup','dibatalkan')),
  catatan_persetujuan text not null default '' check (length(catatan_persetujuan) <= 1000),
  disetujui_oleh      uuid references public.profil(id),
  disetujui_pada      timestamptz,
  ditutup_pada        timestamptz,
  capa_terbuka_saat_tutup int,
  dibuat_oleh         uuid not null default auth.uid() references public.profil(id),
  dibuat_pada         timestamptz not null default now(),
  diperbarui_pada     timestamptz not null default now(),
  constraint inv_ukuran check (length(kronologi::text) + length(bukti::text) + length(saksi::text) + length(lima_why::text) + length(fishbone::text) + length(tim::text) <= 200000)
);
create unique index if not exists investigasi_satu_aktif on public.investigasi(laporan_id) where status <> 'dibatalkan';
create index if not exists inv_status_idx on public.investigasi(status, dibuat_pada desc);
create index if not exists inv_unit_idx on public.investigasi(unit_id);

-- ---------------------------------------------------------------------
-- (2) TOOLBOX MEETING & PELATIHAN (satu tabel kegiatan, dua tipe dengan alur berbeda)
-- ---------------------------------------------------------------------
create table if not exists public.kegiatan (
  id              uuid primary key default gen_random_uuid(),
  nomor           text not null unique,
  tipe            text not null check (tipe in ('toolbox','pelatihan')),
  judul           text not null check (length(judul) between 3 and 160),
  kategori        text not null default '' check (length(kategori) <= 60),
  tujuan          text not null default '' check (length(tujuan) <= 1000),
  topik           text not null default '' check (length(topik) <= 2000),
  materi          text not null default '' check (length(materi) <= 6000),
  pemateri        text not null default '' check (length(pemateri) <= 120),
  supervisor_id   uuid references public.profil(id),
  unit_id         int  not null references public.unit(id),
  lokasi          text not null default '' check (length(lokasi) <= 120),
  mulai           timestamptz not null,
  durasi_menit    int  not null default 30 check (durasi_menit between 5 and 1440),
  status          text not null default 'terjadwal' check (status in ('terjadwal','selesai','dibatalkan')),
  catatan         text not null default '' check (length(catatan) <= 4000),
  isu_keselamatan text not null default '' check (length(isu_keselamatan) <= 4000),
  laporan_id      uuid references public.laporan(id),          -- risiko/bahaya yang menjadi dasar materi (opsional)
  berlaku_bulan   int check (berlaku_bulan between 1 and 120),  -- masa berlaku sertifikat pelatihan (opsional)
  kode_hadir      text not null default substr(md5(gen_random_uuid()::text), 1, 12),
  dibuat_oleh     uuid not null default auth.uid() references public.profil(id),
  dibuat_pada     timestamptz not null default now(),
  diperbarui_pada timestamptz not null default now()
);
create index if not exists keg_mulai_idx on public.kegiatan(mulai desc);
create index if not exists keg_unit_idx on public.kegiatan(unit_id);

create table if not exists public.kegiatan_peserta (
  id                       bigserial primary key,
  kegiatan_id              uuid not null references public.kegiatan(id) on delete cascade,
  profil_id                uuid references public.profil(id) on delete set null,
  nama                     text not null check (length(nama) between 1 and 80),
  kehadiran                text not null default 'belum' check (kehadiran in ('belum','hadir','absen','izin')),
  hadir_pada               timestamptz,
  cara_hadir               text check (cara_hadir in ('manual','qr')),
  nilai_pre                numeric(5,2) check (nilai_pre between 0 and 100),
  nilai_post               numeric(5,2) check (nilai_post between 0 and 100),
  evaluasi                 smallint check (evaluasi between 1 and 5),
  kompetensi               text not null default 'belum_dinilai' check (kompetensi in ('belum_dinilai','kompeten','belum_kompeten')),
  metode_asesmen           text not null default '' check (length(metode_asesmen) <= 200),
  dinilai_oleh             uuid references public.profil(id),
  sertifikat_nomor         text unique,
  sertifikat_berlaku_sampai date,
  -- Kehadiran ≠ kompetensi: kompetensi hanya boleh diisi dengan metode asesmen, dan hanya untuk peserta yang hadir
  constraint kompetensi_berbasis_asesmen check (kompetensi = 'belum_dinilai' or (length(metode_asesmen) >= 3 and kehadiran = 'hadir')),
  constraint sertifikat_hanya_kompeten check (sertifikat_nomor is null or kompetensi = 'kompeten')
);
create unique index if not exists peserta_unik on public.kegiatan_peserta(kegiatan_id, profil_id) where profil_id is not null;
create index if not exists peserta_profil_idx on public.kegiatan_peserta(profil_id);

-- ---------------------------------------------------------------------
-- (3) CAPA LINTAS MODUL (tindakan dari investigasi, toolbox, pelatihan, inspeksi)
--     CAPA dari laporan bahaya tetap memakai alur lama (penugasan + tindak lanjut) agar tidak ganda.
-- ---------------------------------------------------------------------
create table if not exists public.capa (
  id                 uuid primary key default gen_random_uuid(),
  nomor              text not null unique default public.fn_nomor('CAPA'),
  sumber             text not null check (sumber in ('investigasi','toolbox','pelatihan','inspeksi','lainnya')),
  investigasi_id     uuid references public.investigasi(id) on delete restrict,
  kegiatan_id        uuid references public.kegiatan(id) on delete restrict,
  laporan_id         uuid references public.laporan(id),
  unit_id            int  not null references public.unit(id),
  akar_masalah       text not null default '' check (length(akar_masalah) <= 1000),
  tindakan           text not null check (length(tindakan) between 5 and 1000),
  jenis              text not null check (jenis in ('korektif','preventif')),
  level_pengendalian public.level_t not null,
  prioritas          text not null default 'sedang' check (prioritas in ('rendah','sedang','tinggi','kritis')),
  pj_id              uuid not null references public.profil(id),
  target_tanggal     date not null,
  status             text not null default 'terbuka' check (status in ('terbuka','dalam_proses','selesai','terverifikasi','tidak_efektif','dibatalkan')),
  bukti              text not null default '' check (length(bukti) <= 1000),
  hasil_verifikasi   text not null default '' check (length(hasil_verifikasi) <= 1000),
  diverifikasi_oleh  uuid references public.profil(id),
  diverifikasi_pada  timestamptz,
  dibuat_oleh        uuid not null default auth.uid() references public.profil(id),
  dibuat_pada        timestamptz not null default now(),
  diperbarui_pada    timestamptz not null default now(),
  constraint capa_sumber_tertaut check ((sumber <> 'investigasi' or investigasi_id is not null) and (sumber not in ('toolbox','pelatihan') or kegiatan_id is not null))
);
create index if not exists capa_pj_idx on public.capa(pj_id, status);
create index if not exists capa_target_idx on public.capa(status, target_tanggal);
create index if not exists capa_inv_idx on public.capa(investigasi_id);
create index if not exists capa_keg_idx on public.capa(kegiatan_id);

-- ---------------------------------------------------------------------
-- (4) IZIN KERJA (PERMIT TO WORK)
-- ---------------------------------------------------------------------
create table if not exists public.jenis_izin (
  kode           text primary key check (kode ~ '^[a-z_]{2,30}$'),
  nama           text not null check (length(nama) between 3 and 80),
  ceklis         jsonb not null default '[]' check (jsonb_typeof(ceklis) = 'array'),
  butuh_uji_gas  boolean not null default false,
  aktif          boolean not null default true,
  urutan         int not null default 0
);
insert into public.jenis_izin(kode, nama, butuh_uji_gas, urutan, ceklis) values
 ('panas', 'Pekerjaan panas (hot work)', false, 1, '[
   {"butir":"Area kerja panas sudah diperiksa dan dibatasi","wajib":true},{"butir":"Bahan mudah terbakar dalam radius 11 m disingkirkan/ditutup","wajib":true},
   {"butir":"APAR sesuai kelas kebakaran tersedia di lokasi","wajib":true},{"butir":"Penjaga api (fire watch) ditunjuk, berjaga sampai 30 menit setelah selesai","wajib":true},
   {"butir":"Uji gas mudah terbakar dilakukan bila ada potensi uap/gas","wajib":false},{"butir":"Ventilasi memadai","wajib":true},
   {"butir":"APD las/gerinda lengkap (pelindung wajah, sarung tangan, apron)","wajib":true},{"butir":"Detektor asap/sprinkler setempat diisolasi sesuai prosedur","wajib":false},
   {"butir":"Pengaturan darurat dan jalur evakuasi diketahui pekerja","wajib":true}]'),
 ('ketinggian', 'Pekerjaan di ketinggian', false, 2, '[
   {"butir":"Platform kerja/tangga dalam kondisi baik dan stabil","wajib":true},{"butir":"Perancah (scaffold) diinspeksi dan bertanda layak pakai","wajib":false},
   {"butir":"Full body harness diperiksa sebelum dipakai","wajib":true},{"butir":"Lifeline terpasang","wajib":false},{"butir":"Titik jangkar (anchor) bersertifikat","wajib":true},
   {"butir":"Pelindung jatuh (guardrail/jaring) terpasang bila memungkinkan","wajib":false},{"butir":"Cuaca aman (tidak hujan lebat, petir, angin kencang)","wajib":true},
   {"butir":"Rencana penyelamatan (rescue plan) tersedia","wajib":true},{"butir":"APD: helm bertali dagu, sepatu antislip","wajib":true}]'),
 ('listrik', 'Pekerjaan listrik', false, 3, '[
   {"butir":"Sumber listrik diisolasi","wajib":true},{"butir":"Lockout–Tagout (LOTO) terpasang oleh pekerja yang bersangkutan","wajib":true},
   {"butir":"Verifikasi energi nol dengan alat uji yang layak","wajib":true},{"butir":"Peralatan listrik berisolasi dan layak pakai","wajib":true},
   {"butir":"Pekerja kompeten/berizin untuk tegangan tersebut","wajib":true},{"butir":"Perlindungan arc flash bila relevan","wajib":false},
   {"butir":"Pembumian (grounding) terpasang","wajib":false},{"butir":"Akses area dibatasi dan diberi rambu","wajib":true},{"butir":"Pengaturan darurat (P3K, pemutus darurat) siap","wajib":true}]'),
 ('ruang_terbatas', 'Masuk ruang terbatas (confined space)', true, 4, '[
   {"butir":"Ruang terbatas teridentifikasi dan bertanda","wajib":true},{"butir":"Otorisasi masuk diberikan","wajib":true},{"butir":"Pengujian atmosfer dilakukan sebelum masuk (O2, gas mudah terbakar, gas beracun)","wajib":true},
   {"butir":"Ventilasi paksa berjalan","wajib":true},{"butir":"Penjaga (standby person) di luar selama pekerjaan","wajib":true},{"butir":"Sistem komunikasi diuji","wajib":true},
   {"butir":"Peralatan penyelamatan (tripod, winch, SCBA) siap","wajib":true},{"butir":"Log masuk–keluar diisi","wajib":true},{"butir":"Rencana penyelamatan darurat dipahami tim","wajib":true}]')
on conflict (kode) do nothing;

create table if not exists public.izin_kerja (
  id                    uuid primary key default gen_random_uuid(),
  nomor                 text not null unique default public.fn_nomor('PTW'),
  jenis                 text not null references public.jenis_izin(kode),
  pekerjaan             text not null check (length(pekerjaan) between 3 and 160),
  deskripsi             text not null default '' check (length(deskripsi) <= 2000),
  lokasi                text not null default '' check (length(lokasi) <= 160),
  unit_id               int  not null references public.unit(id),
  pemohon_id            uuid not null default auth.uid() references public.profil(id),
  pelaksana             text not null default '' check (length(pelaksana) <= 500),
  jumlah_pekerja        int not null default 1 check (jumlah_pekerja between 1 and 500),
  supervisor_id         uuid not null references public.profil(id),
  petugas_k3_id         uuid references public.profil(id),
  pengesah_id           uuid references public.profil(id),
  mulai                 timestamptz not null,
  selesai               timestamptz not null,
  peralatan             text not null default '' check (length(peralatan) <= 1000),
  jsa_id                uuid references public.jsa(id),
  laporan_id            uuid references public.laporan(id),       -- rujukan risk register (opsional)
  bahaya                text not null default '' check (length(bahaya) <= 2000),
  pengendalian          text not null default '' check (length(pengendalian) <= 2000),
  kesiapan_darurat      text not null default '' check (length(kesiapan_darurat) <= 1000),
  lampiran              jsonb not null default '[]' check (jsonb_typeof(lampiran) = 'array' and jsonb_array_length(lampiran) <= 20),
  ceklis                jsonb not null default '[]' check (jsonb_typeof(ceklis) = 'array' and jsonb_array_length(ceklis) <= 60),
  uji_gas               jsonb not null default '{}' check (jsonb_typeof(uji_gas) = 'object'),
  status                text not null default 'draf' check (status in ('draf','diajukan','tinjau_k3','menunggu_pengesahan','disahkan','aktif','selesai_kerja','ditutup','ditolak','ditangguhkan','dibatalkan','kedaluwarsa')),
  jsa_versi             timestamptz,
  perlu_tinjau          boolean not null default false,
  alasan_tinjau         text not null default '' check (length(alasan_tinjau) <= 500),
  perpanjangan_diminta  timestamptz,
  catatan_status        text not null default '' check (length(catatan_status) <= 1000),
  dibuat_pada           timestamptz not null default now(),
  diperbarui_pada       timestamptz not null default now(),
  constraint izin_waktu check (selesai > mulai and selesai - mulai <= interval '72 hours')
);
create index if not exists izin_status_idx on public.izin_kerja(status, selesai);
create index if not exists izin_jsa_idx on public.izin_kerja(jsa_id);
create index if not exists izin_unit_idx on public.izin_kerja(unit_id, mulai desc);

create table if not exists public.izin_jurnal (
  id       bigserial primary key,
  izin_id  uuid not null references public.izin_kerja(id) on delete cascade,
  pada     timestamptz not null default now(),
  oleh     uuid,
  dari     text,
  ke       text,
  aksi     text not null,
  catatan  text not null default ''
);
create index if not exists izin_jurnal_idx on public.izin_jurnal(izin_id, pada);

-- ---------------------------------------------------------------------
-- (5) NOTIFIKASI: in-app + antrean pengiriman email/push (diproses Edge Function)
-- ---------------------------------------------------------------------
create table if not exists public.notifikasi (
  id           bigserial primary key,
  penerima_id  uuid not null references public.profil(id) on delete cascade,
  kategori     text not null check (kategori in ('insiden','investigasi','capa','izin','kegiatan','sistem')),
  judul        text not null check (length(judul) between 3 and 200),
  isi          text not null default '' check (length(isi) <= 500),
  tautan       text not null default '' check (tautan = '' or tautan ~ '^#/[A-Za-z0-9/_?=&%.-]*$'),
  wajib        boolean not null default false,
  kunci        text not null check (length(kunci) <= 200),           -- kunci idempoten: satu peristiwa = satu notifikasi
  dibuat_pada  timestamptz not null default now(),
  dibaca_pada  timestamptz,
  unique (penerima_id, kunci)
);
create index if not exists notif_penerima_idx on public.notifikasi(penerima_id, dibuat_pada desc);

create table if not exists public.preferensi_notifikasi (
  profil_id       uuid primary key references public.profil(id) on delete cascade,
  email           boolean not null default true,
  push            boolean not null default false,
  kategori_mati   text[] not null default '{}',
  diperbarui_pada timestamptz not null default now()
);

create table if not exists public.notifikasi_kirim (
  id             bigserial primary key,
  notifikasi_id  bigint not null references public.notifikasi(id) on delete cascade,
  saluran        text not null check (saluran in ('email','push')),
  status         text not null default 'menunggu' check (status in ('menunggu','diproses','terkirim','gagal','dilewati')),
  percobaan      int not null default 0,
  galat          text not null default '',
  diproses_pada  timestamptz,
  terkirim_pada  timestamptz,
  unique (notifikasi_id, saluran)                                  -- tidak pernah mengirim dua kali per saluran
);
create index if not exists notif_kirim_status_idx on public.notifikasi_kirim(status, id);

create table if not exists public.push_langganan (
  id          bigserial primary key,
  profil_id   uuid not null default auth.uid() references public.profil(id) on delete cascade,
  endpoint    text not null unique check (endpoint ~ '^https://' and length(endpoint) <= 1000),
  p256dh      text not null check (length(p256dh) <= 200),
  auth        text not null check (length(auth) <= 100),
  dibuat_pada timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- (6) INDEKS UNTUK PAGINASI & PENCARIAN SISI SERVER
-- ---------------------------------------------------------------------
create index if not exists laporan_dibuat_idx on public.laporan(dibuat_pada desc);
create index if not exists laporan_tgl_idx on public.laporan(tanggal_lapor desc);
alter table public.laporan add column if not exists cari text generated always as (lower(nomor || ' ' || lokasi || ' ' || uraian)) stored;
grant select (cari) on public.laporan to authenticated;      -- hanya teks yang memang sudah boleh dibaca
create index if not exists laporan_cari_trgm on public.laporan using gin (cari extensions.gin_trgm_ops);
create index if not exists jsa_dibuat_idx on public.jsa(dibuat_pada desc);
create index if not exists ins_dibuat_idx on public.inspeksi(dibuat_pada desc);
create index if not exists pem_dibuat_idx on public.pemantauan(dibuat_pada desc);

-- =====================================================================
-- (7) NOTIFIKASI: fungsi pembuat (idempoten) + antrean saluran
-- =====================================================================
create or replace function public.fn_notif(p_penerima uuid, p_kategori text, p_judul text, p_isi text, p_tautan text, p_kunci text, p_wajib boolean default false)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id bigint; pr public.preferensi_notifikasi;
begin
  if p_penerima is null or not exists (select 1 from public.profil where id = p_penerima and aktif) then return; end if;
  select * into pr from public.preferensi_notifikasi where profil_id = p_penerima;
  if not p_wajib and pr.profil_id is not null and p_kategori = any(pr.kategori_mati) then return; end if;   -- notifikasi wajib tidak dapat dimatikan
  insert into public.notifikasi(penerima_id, kategori, judul, isi, tautan, kunci, wajib)
  values (p_penerima, p_kategori, left(p_judul, 200), left(coalesce(p_isi, ''), 500), coalesce(p_tautan, ''), left(p_kunci, 200), p_wajib)
  on conflict (penerima_id, kunci) do nothing returning id into v_id;
  if v_id is null then return; end if;                                     -- peristiwa sama tidak dikirim dua kali
  if coalesce(pr.email, true) or p_wajib then insert into public.notifikasi_kirim(notifikasi_id, saluran) values (v_id, 'email') on conflict do nothing; end if;
  if coalesce(pr.push, false) and exists (select 1 from public.push_langganan where profil_id = p_penerima) then
    insert into public.notifikasi_kirim(notifikasi_id, saluran) values (v_id, 'push') on conflict do nothing;
  end if;
exception when others then
  raise warning 'fn_notif gagal: %', sqlerrm;                               -- notifikasi tidak boleh menggagalkan transaksi utama
end $$;

create or replace function public.fn_notif_k3rs(p_kategori text, p_judul text, p_isi text, p_tautan text, p_kunci text, p_wajib boolean default false, p_kecuali uuid default null)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare r record;
begin
  for r in select id from public.profil where aktif and peran = 'k3rs' and id is distinct from p_kecuali loop
    perform public.fn_notif(r.id, p_kategori, p_judul, p_isi, p_tautan, p_kunci, p_wajib);
  end loop;
end $$;

-- Laporan kejadian / nyaris celaka baru → K3RS (kejadian = wajib)
create or replace function public.trg_notif_laporan() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.jenis in ('kejadian','nyaris_celaka') and not new.contoh then
    perform public.fn_notif_k3rs('insiden', (case when new.jenis = 'kejadian' then 'Laporan kejadian baru ' else 'Laporan nyaris celaka baru ' end) || new.nomor,
      (select nama from public.kategori where kode = new.kategori_kode) || ' · ' || (select nama from public.unit where id = new.unit_id) || case when new.mendesak then ' · MENDESAK' else '' end,
      '#/laporan/' || new.id, 'laporan_baru:' || new.id, new.jenis = 'kejadian');
  end if;
  return null;
end $$;
drop trigger if exists laporan_notif on public.laporan;
create trigger laporan_notif after insert on public.laporan for each row execute function public.trg_notif_laporan();

-- =====================================================================
-- (8) ATURAN INVESTIGASI
-- =====================================================================
create or replace function public.trg_investigasi_aturan() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare l record; v_akar boolean; v_capa int; me uuid := auth.uid(); k3 boolean := public.fn_k3rs();
begin
  if tg_op = 'INSERT' then
    select id, jenis, unit_id, lokasi into l from public.laporan where id = new.laporan_id;
    if l.id is null then raise exception 'Laporan tidak ditemukan'; end if;
    if l.jenis not in ('kejadian','nyaris_celaka') then raise exception 'Investigasi hanya untuk laporan kejadian atau nyaris celaka'; end if;
    new.unit_id := l.unit_id; new.status := 'draf'; new.disetujui_oleh := null; new.disetujui_pada := null; new.ditutup_pada := null;
    if new.lokasi = '' then new.lokasi := coalesce(l.lokasi, ''); end if;
    if me is not null then new.dibuat_oleh := me; end if;
    new.dibuat_pada := now();
  else
    new.nomor := old.nomor; new.laporan_id := old.laporan_id; new.unit_id := old.unit_id; new.dibuat_oleh := old.dibuat_oleh; new.dibuat_pada := old.dibuat_pada;
    -- Setelah disetujui/ditutup, isi analisis terkunci (hanya K3RS yang dapat membuka kembali ke tahap analisis)
    if old.status in ('disetujui','ditutup','dibatalkan') and (to_jsonb(new) - array['status','catatan_persetujuan','disetujui_oleh','disetujui_pada','ditutup_pada','capa_terbuka_saat_tutup','diperbarui_pada'])
         is distinct from (to_jsonb(old) - array['status','catatan_persetujuan','disetujui_oleh','disetujui_pada','ditutup_pada','capa_terbuka_saat_tutup','diperbarui_pada']) then
      raise exception 'Investigasi % sudah %; buka kembali ke tahap analisis untuk mengubah isi', old.nomor, old.status;
    end if;
    if new.status is distinct from old.status then
      if not ((old.status, new.status) in (('draf','analisis'),('analisis','draf'),('analisis','menunggu_persetujuan'),('menunggu_persetujuan','analisis'),
              ('menunggu_persetujuan','disetujui'),('disetujui','ditutup'),('disetujui','analisis'),('draf','dibatalkan'),('analisis','dibatalkan'))) then
        raise exception 'Perubahan status investigasi % → % tidak diizinkan', old.status, new.status;
      end if;
      if new.status = 'menunggu_persetujuan' then
        if jsonb_array_length(new.kronologi) = 0 then raise exception 'Lengkapi kronologi kejadian sebelum diajukan'; end if;
        if btrim(new.penyebab_langsung) = '' then raise exception 'Isi penyebab langsung (immediate cause) sebelum diajukan'; end if;
        v_akar := btrim(new.akar_masalah) <> ''
          or exists (select 1 from jsonb_array_elements(new.lima_why) c where btrim(coalesce(c->>'akar', '')) <> '')
          or exists (select 1 from jsonb_each(coalesce(new.fishbone->'kategori', '{}')) k, jsonb_array_elements(case when jsonb_typeof(k.value) = 'array' then k.value else '[]' end) x where coalesce((x->>'akar')::boolean, false));
        if not v_akar then raise exception 'Tetapkan minimal satu akar masalah (5 Why, Fishbone, atau ringkasan akar masalah)'; end if;
        select count(*) into v_capa from public.capa where investigasi_id = new.id and status <> 'dibatalkan';
        if v_capa = 0 then raise exception 'Buat minimal satu CAPA dari hasil investigasi sebelum diajukan'; end if;
      end if;
      if new.status in ('disetujui','ditutup') or (old.status in ('disetujui','menunggu_persetujuan') and new.status = 'analisis' and me is not null and me <> new.ketua_id) then
        if me is not null and not k3 then raise exception 'Hanya K3RS yang dapat menyetujui, menutup, atau mengembalikan investigasi'; end if;
      end if;
      if new.status = 'disetujui' then
        if me is not null and me = new.ketua_id then raise exception 'Persetujuan harus oleh K3RS selain ketua tim investigasi'; end if;
        new.disetujui_oleh := me; new.disetujui_pada := now();
      end if;
      if new.status = 'ditutup' then
        new.ditutup_pada := now();
        select count(*) into new.capa_terbuka_saat_tutup from public.capa where investigasi_id = new.id and status in ('terbuka','dalam_proses','selesai','tidak_efektif');
      end if;
      if new.status = 'analisis' and old.status in ('disetujui','menunggu_persetujuan') then new.disetujui_oleh := null; new.disetujui_pada := null; end if;
    end if;
  end if;
  if not exists (select 1 from public.profil where id = new.ketua_id and aktif and peran in ('k3rs','pj_unit')) then raise exception 'Ketua tim harus PJ unit atau K3RS yang aktif'; end if;
  new.diperbarui_pada := now();
  return new;
end $$;
drop trigger if exists investigasi_aturan on public.investigasi;
create trigger investigasi_aturan before insert or update on public.investigasi for each row execute function public.trg_investigasi_aturan();

create or replace function public.trg_investigasi_notif() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if tg_op = 'INSERT' or new.ketua_id is distinct from old.ketua_id then
    perform public.fn_notif(new.ketua_id, 'investigasi', 'Anda ditugaskan memimpin investigasi ' || new.nomor, new.lokasi, '#/investigasi?id=' || new.id, 'inv_ketua:' || new.id || ':' || new.ketua_id, true);
  end if;
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    if new.status = 'menunggu_persetujuan' then perform public.fn_notif_k3rs('investigasi', 'Investigasi ' || new.nomor || ' menunggu persetujuan', new.akar_masalah, '#/investigasi?id=' || new.id, 'inv_ajukan:' || new.id || ':' || new.diperbarui_pada, false, new.ketua_id); end if;
    if new.status = 'disetujui' then perform public.fn_notif(new.ketua_id, 'investigasi', 'Investigasi ' || new.nomor || ' disetujui', new.catatan_persetujuan, '#/investigasi?id=' || new.id, 'inv_setuju:' || new.id || ':' || new.disetujui_pada); end if;
    if new.status = 'analisis' and old.status = 'menunggu_persetujuan' then perform public.fn_notif(new.ketua_id, 'investigasi', 'Investigasi ' || new.nomor || ' dikembalikan untuk diperbaiki', new.catatan_persetujuan, '#/investigasi?id=' || new.id, 'inv_kembali:' || new.id || ':' || new.diperbarui_pada); end if;
  end if;
  return null;
end $$;
drop trigger if exists investigasi_notif on public.investigasi;
create trigger investigasi_notif after insert or update on public.investigasi for each row execute function public.trg_investigasi_notif();

-- =====================================================================
-- (9) ATURAN CAPA
-- =====================================================================
create or replace function public.trg_capa_aturan() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare me uuid := auth.uid(); k3 boolean := public.fn_k3rs(); u int;
begin
  if not exists (select 1 from public.profil where id = new.pj_id and aktif and peran in ('k3rs','pj_unit')) then raise exception 'Penanggung jawab CAPA harus PJ unit atau K3RS yang aktif'; end if;
  if tg_op = 'INSERT' then
    if new.investigasi_id is not null then
      select unit_id into u from public.investigasi where id = new.investigasi_id;
      if exists (select 1 from public.investigasi where id = new.investigasi_id and status in ('disetujui','ditutup','dibatalkan')) then raise exception 'Investigasi sudah disetujui/ditutup; buka kembali untuk menambah CAPA'; end if;
      new.unit_id := u; new.laporan_id := (select laporan_id from public.investigasi where id = new.investigasi_id);
    elsif new.kegiatan_id is not null then new.unit_id := (select unit_id from public.kegiatan where id = new.kegiatan_id);
    end if;
    if new.target_tanggal < public.fn_hari_ini() then raise exception 'Tanggal target CAPA tidak boleh lampau'; end if;
    new.status := 'terbuka'; new.diverifikasi_oleh := null; new.diverifikasi_pada := null; new.hasil_verifikasi := '';
    if me is not null then new.dibuat_oleh := me; end if; new.dibuat_pada := now();
  else
    new.nomor := old.nomor; new.sumber := old.sumber; new.investigasi_id := old.investigasi_id; new.kegiatan_id := old.kegiatan_id; new.laporan_id := old.laporan_id;
    new.unit_id := old.unit_id; new.dibuat_oleh := old.dibuat_oleh; new.dibuat_pada := old.dibuat_pada;
    if me is not null and not k3 then
      -- Penanggung jawab hanya boleh melaporkan kemajuan dan bukti
      if me <> old.pj_id then raise exception 'Tidak berwenang'; end if;
      if (to_jsonb(new) - array['status','bukti','diperbarui_pada']) is distinct from (to_jsonb(old) - array['status','bukti','diperbarui_pada']) then raise exception 'Penanggung jawab hanya dapat mengubah status kemajuan dan bukti'; end if;
      if new.status not in ('dalam_proses','selesai') and new.status is distinct from old.status then raise exception 'Penanggung jawab hanya dapat menandai dalam proses atau selesai'; end if;
      if old.status in ('terverifikasi','dibatalkan') then raise exception 'CAPA sudah final'; end if;
    end if;
    if new.status is distinct from old.status then
      if not ((old.status, new.status) in (('terbuka','dalam_proses'),('terbuka','selesai'),('dalam_proses','selesai'),('selesai','terverifikasi'),('selesai','tidak_efektif'),
              ('selesai','dalam_proses'),('tidak_efektif','dalam_proses'),('terbuka','dibatalkan'),('dalam_proses','dibatalkan'),('tidak_efektif','terbuka'))) then
        raise exception 'Perubahan status CAPA % → % tidak diizinkan', old.status, new.status;
      end if;
      if new.status = 'selesai' and length(btrim(new.bukti)) < 5 then raise exception 'Isi bukti pelaksanaan (min. 5 huruf) sebelum menandai selesai'; end if;
      if new.status in ('terverifikasi','tidak_efektif') then
        if me is not null and not k3 then raise exception 'Verifikasi efektivitas dilakukan K3RS'; end if;
        if me is not null and me = new.pj_id then raise exception 'Verifikasi harus oleh orang lain selain penanggung jawab'; end if;
        if length(btrim(new.hasil_verifikasi)) < 5 then raise exception 'Tulis hasil verifikasi efektivitas (min. 5 huruf)'; end if;
        new.diverifikasi_oleh := me; new.diverifikasi_pada := now();
      end if;
      if new.status = 'dibatalkan' and me is not null and not k3 then raise exception 'Pembatalan CAPA oleh K3RS'; end if;
    end if;
  end if;
  new.diperbarui_pada := now();
  return new;
end $$;
drop trigger if exists capa_aturan on public.capa;
create trigger capa_aturan before insert or update on public.capa for each row execute function public.trg_capa_aturan();

create or replace function public.trg_capa_notif() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if tg_op = 'INSERT' then
    perform public.fn_notif(new.pj_id, 'capa', 'CAPA baru ' || new.nomor || ' untuk Anda', left(new.tindakan, 200) || ' · target ' || to_char(new.target_tanggal, 'DD-MM-YYYY'), '#/capa?id=' || new.id, 'capa_baru:' || new.id, true);
  elsif new.status is distinct from old.status then
    if new.status = 'selesai' then perform public.fn_notif_k3rs('capa', 'CAPA ' || new.nomor || ' selesai, perlu verifikasi', left(new.bukti, 200), '#/capa?id=' || new.id, 'capa_selesai:' || new.id || ':' || new.diperbarui_pada, false, new.pj_id); end if;
    if new.status in ('terverifikasi','tidak_efektif') then perform public.fn_notif(new.pj_id, 'capa', 'CAPA ' || new.nomor || case when new.status = 'terverifikasi' then ' terverifikasi efektif' else ' dinilai belum efektif' end, left(new.hasil_verifikasi, 200), '#/capa?id=' || new.id, 'capa_verif:' || new.id || ':' || new.diverifikasi_pada); end if;
  end if;
  return null;
end $$;
drop trigger if exists capa_notif on public.capa;
create trigger capa_notif after insert or update on public.capa for each row execute function public.trg_capa_notif();

-- =====================================================================
-- (10) ATURAN IZIN KERJA — status hanya berubah lewat public.izin_proses()
-- =====================================================================
create or replace function public.trg_izin_aturan() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare me uuid := auth.uid(); lewat_fungsi boolean := coalesce(current_setting('hse.izin_proses', true), '') = '1';
begin
  if not exists (select 1 from public.profil where id = new.supervisor_id and aktif and peran in ('k3rs','pj_unit')) then raise exception 'Supervisor harus PJ unit atau K3RS yang aktif'; end if;
  if tg_op = 'INSERT' then
    if me is not null then new.pemohon_id := me; end if;
    new.status := 'draf'; new.petugas_k3_id := null; new.pengesah_id := null; new.jsa_versi := null; new.perlu_tinjau := false; new.perpanjangan_diminta := null;
    if jsonb_array_length(new.ceklis) = 0 then
      select coalesce(jsonb_agg(x || '{"nilai":null,"catatan":""}'::jsonb), '[]') into new.ceklis from jsonb_array_elements((select ceklis from public.jenis_izin where kode = new.jenis and aktif)) x;
    end if;
    if not exists (select 1 from public.jenis_izin where kode = new.jenis and aktif) then raise exception 'Jenis izin tidak aktif'; end if;
    new.dibuat_pada := now();
  else
    new.nomor := old.nomor; new.pemohon_id := old.pemohon_id; new.dibuat_pada := old.dibuat_pada;
    if not lewat_fungsi then
      if new.status is distinct from old.status then raise exception 'Status izin hanya dapat diubah melalui alur persetujuan'; end if;
      if old.status not in ('draf','ditolak') then raise exception 'Izin % sudah diajukan; isi tidak dapat diubah', old.nomor; end if;
      if (new.petugas_k3_id, new.pengesah_id, new.jsa_versi, new.perlu_tinjau, new.perpanjangan_diminta) is distinct from (old.petugas_k3_id, old.pengesah_id, old.jsa_versi, old.perlu_tinjau, old.perpanjangan_diminta) then
        raise exception 'Kolom persetujuan hanya diubah oleh alur persetujuan';
      end if;
    end if;
  end if;
  new.diperbarui_pada := now();
  return new;
end $$;
drop trigger if exists izin_aturan on public.izin_kerja;
create trigger izin_aturan before insert or update on public.izin_kerja for each row execute function public.trg_izin_aturan();

create or replace function public.fn_izin_notif(r public.izin_kerja, p_ke text, p_catatan text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare tautan text := '#/izin?id=' || r.id; k text := 'izin:' || r.id || ':' || p_ke || ':' || to_char(now(), 'YYYYMMDDHH24MISSMS');
begin
  if p_ke = 'diajukan' then perform public.fn_notif(r.supervisor_id, 'izin', 'Izin kerja ' || r.nomor || ' menunggu tinjauan Anda', r.pekerjaan, tautan, k, true);
  elsif p_ke in ('tinjau_k3','menunggu_pengesahan') then perform public.fn_notif_k3rs('izin', 'Izin kerja ' || r.nomor || case when p_ke = 'tinjau_k3' then ' menunggu tinjauan K3' else ' menunggu pengesahan' end, r.pekerjaan, tautan, k, true, r.pemohon_id);
  elsif p_ke in ('disahkan','ditolak','ditangguhkan','kedaluwarsa','perlu_tinjau','perpanjangan') then
    perform public.fn_notif(r.pemohon_id, 'izin', 'Izin kerja ' || r.nomor || ' ' || case p_ke when 'disahkan' then 'disahkan' when 'ditolak' then 'ditolak' when 'ditangguhkan' then 'DITANGGUHKAN — hentikan pekerjaan'
       when 'kedaluwarsa' then 'kedaluwarsa' when 'perpanjangan' then 'diperpanjang' else 'perlu ditinjau ulang' end, coalesce(p_catatan, ''), tautan, k, p_ke in ('ditangguhkan','perlu_tinjau','kedaluwarsa'));
    if p_ke in ('ditangguhkan','perlu_tinjau') then perform public.fn_notif(r.supervisor_id, 'izin', 'Izin kerja ' || r.nomor || case when p_ke = 'ditangguhkan' then ' DITANGGUHKAN' else ' perlu ditinjau ulang' end, coalesce(p_catatan, ''), tautan, k, true); end if;
  end if;
end $$;

create or replace function public.izin_proses(p_id uuid, p_aksi text, p_catatan text default '', p_data jsonb default '{}')
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare r public.izin_kerja; me uuid := auth.uid(); k3 boolean := public.fn_k3rs(); ke text; j record; g jsonb; catat text := btrim(coalesce(p_catatan, ''));
begin
  if public.fn_peran() is null then raise exception 'Akun belum aktif'; end if;
  select * into r from public.izin_kerja where id = p_id for update;
  if r.id is null then raise exception 'Izin tidak ditemukan'; end if;
  if not (k3 or me in (r.pemohon_id, r.supervisor_id) or r.unit_id = public.fn_unit()) then raise exception 'Tidak berwenang'; end if;
  perform set_config('hse.izin_proses', '1', true);
  -- Izin yang sudah lewat masa berlaku otomatis kedaluwarsa dan tidak dapat dipakai
  if r.status in ('diajukan','tinjau_k3','menunggu_pengesahan','disahkan','aktif','ditangguhkan') and r.selesai < now() and p_aksi not in ('tutup','batalkan') then
    update public.izin_kerja set status = 'kedaluwarsa', catatan_status = 'Lewat masa berlaku' where id = r.id;
    insert into public.izin_jurnal(izin_id, oleh, dari, ke, aksi, catatan) values (r.id, me, r.status, 'kedaluwarsa', 'kedaluwarsa', 'Otomatis: lewat ' || to_char(r.selesai at time zone 'Asia/Makassar', 'DD-MM-YYYY HH24:MI'));
    perform public.fn_izin_notif(r, 'kedaluwarsa', 'Masa berlaku habis');
    return jsonb_build_object('status', 'kedaluwarsa', 'pesan', 'Izin sudah kedaluwarsa. Ajukan izin baru atau tutup izin ini.');
  end if;
  if p_aksi = 'ajukan' then
    if r.status not in ('draf','ditolak') then raise exception 'Hanya izin draf/ditolak yang dapat diajukan'; end if;
    if me <> r.pemohon_id then raise exception 'Hanya pemohon yang dapat mengajukan'; end if;
    if r.selesai <= now() then raise exception 'Waktu selesai sudah lewat; perbarui jadwal'; end if;
    if r.jsa_id is null then raise exception 'Izin kerja wajib merujuk JSA'; end if;
    select status into j from public.jsa where id = r.jsa_id;
    if j.status is distinct from 'disetujui' then raise exception 'JSA rujukan harus berstatus disetujui'; end if;
    if exists (select 1 from jsonb_array_elements(r.ceklis) x where coalesce(x->>'nilai', '') not in ('ya','tidak','na')) then raise exception 'Isi seluruh butir daftar periksa'; end if;
    if exists (select 1 from jsonb_array_elements(r.ceklis) x where coalesce((x->>'wajib')::boolean, false) and x->>'nilai' <> 'ya') then raise exception 'Semua butir wajib harus terpenuhi (Ya) sebelum diajukan'; end if;
    if (select butuh_uji_gas from public.jenis_izin where kode = r.jenis) then
      g := r.uji_gas;
      if g->>'o2' is null or g->>'lel' is null or g->>'h2s' is null or g->>'co' is null then raise exception 'Isi hasil uji atmosfer (O2, LEL, H2S, CO)'; end if;
      if (g->>'o2')::numeric not between 19.5 and 23.5 or (g->>'lel')::numeric >= 10 or (g->>'h2s')::numeric >= 10 or (g->>'co')::numeric >= 25 then
        raise exception 'Hasil uji atmosfer di luar batas aman umum (O2 19,5–23,5%%; LEL < 10%%; H2S < 10 ppm; CO < 25 ppm). Ikuti prosedur dan jangan masuk.';
      end if;
    end if;
    ke := 'diajukan';
  elsif p_aksi = 'setujui_supervisor' then
    if r.status <> 'diajukan' then raise exception 'Izin tidak menunggu tinjauan supervisor'; end if;
    if me <> r.supervisor_id then raise exception 'Hanya supervisor yang ditunjuk'; end if;
    ke := 'tinjau_k3';
  elsif p_aksi = 'setujui_k3' then
    if r.status <> 'tinjau_k3' then raise exception 'Izin tidak menunggu tinjauan K3'; end if;
    if not k3 then raise exception 'Hanya K3RS'; end if;
    update public.izin_kerja set petugas_k3_id = me where id = r.id;
    ke := 'menunggu_pengesahan';
  elsif p_aksi = 'sahkan' then
    if r.status <> 'menunggu_pengesahan' then raise exception 'Izin tidak menunggu pengesahan'; end if;
    if not k3 then raise exception 'Hanya K3RS yang berwenang mengesahkan'; end if;
    if me in (r.pemohon_id, r.supervisor_id) then raise exception 'Pengesah harus berbeda dari pemohon dan supervisor'; end if;
    select status, diperbarui_pada into j from public.jsa where id = r.jsa_id;
    if j.status is distinct from 'disetujui' then raise exception 'JSA rujukan tidak lagi berstatus disetujui'; end if;
    update public.izin_kerja set pengesah_id = me, jsa_versi = j.diperbarui_pada, perlu_tinjau = false, alasan_tinjau = '' where id = r.id;
    ke := 'disahkan';
  elsif p_aksi = 'tolak' then
    if not ((r.status = 'diajukan' and (me = r.supervisor_id or k3)) or (r.status in ('tinjau_k3','menunggu_pengesahan') and k3)) then raise exception 'Tidak dapat menolak pada tahap ini'; end if;
    if length(catat) < 5 then raise exception 'Tulis alasan penolakan'; end if;
    ke := 'ditolak';
  elsif p_aksi = 'tinjau_ulang' then
    if not k3 or me = r.pemohon_id then raise exception 'Tinjauan ulang oleh K3RS selain pemohon'; end if;
    if not r.perlu_tinjau then raise exception 'Izin tidak sedang perlu ditinjau'; end if;
    select status, diperbarui_pada into j from public.jsa where id = r.jsa_id;
    if j.status is distinct from 'disetujui' then raise exception 'JSA harus disetujui kembali sebelum izin ditinjau ulang'; end if;
    if length(catat) < 5 then raise exception 'Tulis hasil tinjauan ulang'; end if;
    update public.izin_kerja set perlu_tinjau = false, alasan_tinjau = '', jsa_versi = j.diperbarui_pada where id = r.id;
    insert into public.izin_jurnal(izin_id, oleh, dari, ke, aksi, catatan) values (r.id, me, r.status, r.status, 'tinjau_ulang', catat);
    return jsonb_build_object('status', r.status, 'pesan', 'Tinjauan ulang dicatat');
  elsif p_aksi = 'mulai' then
    if r.status <> 'disahkan' then raise exception 'Pekerjaan hanya dapat dimulai setelah izin disahkan'; end if;
    if not (k3 or me in (r.pemohon_id, r.supervisor_id)) then raise exception 'Tidak berwenang'; end if;
    if now() < r.mulai - interval '15 minutes' then raise exception 'Belum masuk waktu izin (mulai %)', to_char(r.mulai at time zone 'Asia/Makassar', 'DD-MM-YYYY HH24:MI'); end if;
    if r.perlu_tinjau then raise exception 'Izin perlu ditinjau ulang karena JSA berubah'; end if;
    ke := 'aktif';
  elsif p_aksi = 'tangguhkan' then
    -- Stop Work Authority: setiap pengguna aktif yang melihat izin boleh menghentikan pekerjaan
    if r.status not in ('disahkan','aktif') then raise exception 'Hanya izin yang disahkan/aktif yang dapat ditangguhkan'; end if;
    if length(catat) < 5 then raise exception 'Tulis kondisi tidak aman yang ditemukan'; end if;
    ke := 'ditangguhkan';
  elsif p_aksi = 'lanjutkan' then
    if r.status <> 'ditangguhkan' then raise exception 'Izin tidak sedang ditangguhkan'; end if;
    if not k3 then raise exception 'Melanjutkan pekerjaan setelah penangguhan hanya oleh K3RS'; end if;
    if r.perlu_tinjau then raise exception 'Tinjau ulang JSA terlebih dahulu'; end if;
    if length(catat) < 5 then raise exception 'Tulis tindakan yang sudah dilakukan sebelum dilanjutkan'; end if;
    ke := 'aktif';
  elsif p_aksi = 'selesai_kerja' then
    if r.status <> 'aktif' then raise exception 'Hanya izin aktif'; end if;
    if not (k3 or me in (r.pemohon_id, r.supervisor_id)) then raise exception 'Tidak berwenang'; end if;
    ke := 'selesai_kerja';
  elsif p_aksi = 'tutup' then
    if r.status not in ('selesai_kerja','kedaluwarsa','ditangguhkan') then raise exception 'Izin belum dapat ditutup'; end if;
    if not k3 then raise exception 'Penutupan izin oleh K3RS'; end if;
    if coalesce((p_data->>'area_aman')::boolean, false) is not true then raise exception 'Konfirmasi bahwa pekerjaan selesai dan area sudah aman'; end if;
    ke := 'ditutup';
  elsif p_aksi = 'batalkan' then
    if r.status not in ('draf','diajukan','tinjau_k3','menunggu_pengesahan','disahkan','ditolak') then raise exception 'Izin tidak dapat dibatalkan pada status ini'; end if;
    if not (k3 or me = r.pemohon_id) then raise exception 'Tidak berwenang'; end if;
    ke := 'dibatalkan';
  elsif p_aksi = 'minta_perpanjangan' then
    if r.status not in ('disahkan','aktif') then raise exception 'Perpanjangan hanya untuk izin disahkan/aktif'; end if;
    if not (me in (r.pemohon_id, r.supervisor_id)) then raise exception 'Hanya pemohon/supervisor'; end if;
    if (p_data->>'selesai_baru') is null or (p_data->>'selesai_baru')::timestamptz <= r.selesai or (p_data->>'selesai_baru')::timestamptz - r.mulai > interval '72 hours' then
      raise exception 'Waktu selesai baru harus setelah waktu selesai saat ini dan maksimal 72 jam dari mulai';
    end if;
    if length(catat) < 5 then raise exception 'Tulis alasan perpanjangan'; end if;
    update public.izin_kerja set perpanjangan_diminta = (p_data->>'selesai_baru')::timestamptz where id = r.id;
    insert into public.izin_jurnal(izin_id, oleh, dari, ke, aksi, catatan) values (r.id, me, r.status, r.status, 'minta_perpanjangan', catat);
    perform public.fn_notif_k3rs('izin', 'Permintaan perpanjangan izin ' || r.nomor, catat, '#/izin?id=' || r.id, 'izin_perpanjang:' || r.id || ':' || (p_data->>'selesai_baru'), true, me);
    return jsonb_build_object('status', r.status, 'pesan', 'Permintaan perpanjangan dikirim ke K3RS');
  elsif p_aksi = 'setujui_perpanjangan' then
    if not k3 or me = r.pemohon_id then raise exception 'Perpanjangan disetujui K3RS selain pemohon'; end if;
    if r.perpanjangan_diminta is null or r.status not in ('disahkan','aktif') then raise exception 'Tidak ada permintaan perpanjangan yang berlaku'; end if;
    update public.izin_kerja set selesai = perpanjangan_diminta, perpanjangan_diminta = null where id = r.id;
    insert into public.izin_jurnal(izin_id, oleh, dari, ke, aksi, catatan) values (r.id, me, r.status, r.status, 'perpanjangan', 'Sampai ' || to_char(r.perpanjangan_diminta at time zone 'Asia/Makassar', 'DD-MM-YYYY HH24:MI') || '. ' || catat);
    perform public.fn_izin_notif(r, 'perpanjangan', 'Sampai ' || to_char(r.perpanjangan_diminta at time zone 'Asia/Makassar', 'DD-MM-YYYY HH24:MI'));
    return jsonb_build_object('status', r.status, 'pesan', 'Izin diperpanjang');
  else
    raise exception 'Aksi tidak dikenal';
  end if;
  update public.izin_kerja set status = ke, catatan_status = left(catat, 1000) where id = r.id;
  insert into public.izin_jurnal(izin_id, oleh, dari, ke, aksi, catatan) values (r.id, me, r.status, ke, p_aksi, catat);
  perform public.fn_izin_notif(r, ke, catat);
  return jsonb_build_object('status', ke, 'pesan', 'Status izin: ' || ke);
end $$;

-- Izin lewat masa berlaku → kedaluwarsa (dijalankan pg_cron tiap 10 menit)
create or replace function public.izin_periksa_kedaluwarsa() returns int
language plpgsql security definer set search_path = public, pg_temp as $$
declare r public.izin_kerja; n int := 0;
begin
  perform set_config('hse.izin_proses', '1', true);
  for r in select * from public.izin_kerja where status in ('diajukan','tinjau_k3','menunggu_pengesahan','disahkan','aktif','ditangguhkan') and selesai < now() for update skip locked loop
    update public.izin_kerja set status = 'kedaluwarsa', catatan_status = 'Lewat masa berlaku' where id = r.id;
    insert into public.izin_jurnal(izin_id, oleh, dari, ke, aksi, catatan) values (r.id, null, r.status, 'kedaluwarsa', 'kedaluwarsa', 'Otomatis oleh sistem');
    perform public.fn_izin_notif(r, 'kedaluwarsa', 'Masa berlaku habis'); n := n + 1;
  end loop;
  return n;
end $$;

-- JSA berubah setelah izin disetujui → izin ditandai perlu tinjau; izin aktif ditangguhkan (keputusan konservatif)
create or replace function public.trg_jsa_ke_izin() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare r public.izin_kerja;
begin
  if new.langkah is not distinct from old.langkah and new.status is not distinct from old.status and new.pekerjaan is not distinct from old.pekerjaan then return null; end if;
  perform set_config('hse.izin_proses', '1', true);
  for r in select * from public.izin_kerja where jsa_id = new.id and status in ('diajukan','tinjau_k3','menunggu_pengesahan','disahkan','aktif') loop
    update public.izin_kerja set perlu_tinjau = true, alasan_tinjau = 'JSA ' || new.nomor || ' berubah pada ' || to_char(now() at time zone 'Asia/Makassar', 'DD-MM-YYYY HH24:MI'),
           status = case when r.status = 'aktif' then 'ditangguhkan' else r.status end where id = r.id;
    insert into public.izin_jurnal(izin_id, oleh, dari, ke, aksi, catatan) values (r.id, auth.uid(), r.status, case when r.status = 'aktif' then 'ditangguhkan' else r.status end, 'jsa_berubah', 'JSA rujukan berubah; izin perlu ditinjau ulang');
    perform public.fn_izin_notif(r, case when r.status = 'aktif' then 'ditangguhkan' else 'perlu_tinjau' end, 'JSA rujukan berubah');
  end loop;
  return null;
end $$;
drop trigger if exists jsa_ke_izin on public.jsa;
create trigger jsa_ke_izin after update on public.jsa for each row execute function public.trg_jsa_ke_izin();

-- =====================================================================
-- (11) ATURAN KEGIATAN (TOOLBOX & PELATIHAN) + PRESENSI QR
-- =====================================================================
create or replace function public.fn_penyelenggara(p_kegiatan uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select public.fn_k3rs() or exists (select 1 from public.kegiatan k where k.id = p_kegiatan and (k.dibuat_oleh = auth.uid() or k.supervisor_id = auth.uid()
    or (public.fn_peran() = 'pj_unit' and k.unit_id = public.fn_unit())))
$$;
create or replace function public.fn_peserta_saya(p_kegiatan uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.kegiatan_peserta p where p.kegiatan_id = p_kegiatan and p.profil_id = auth.uid())
$$;

create or replace function public.trg_kegiatan_aturan() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare r record;
begin
  if tg_op = 'INSERT' then
    new.nomor := public.fn_nomor(case when new.tipe = 'toolbox' then 'TBM' else 'TRN' end);
    if auth.uid() is not null then new.dibuat_oleh := auth.uid(); end if; new.dibuat_pada := now(); new.status := 'terjadwal';
  else
    new.nomor := old.nomor; new.tipe := old.tipe; new.dibuat_oleh := old.dibuat_oleh; new.dibuat_pada := old.dibuat_pada; new.kode_hadir := old.kode_hadir;
    if old.status = 'dibatalkan' and new.status <> 'dibatalkan' then raise exception 'Kegiatan yang dibatalkan tidak dapat diaktifkan kembali'; end if;
    if new.mulai is distinct from old.mulai or (new.status = 'dibatalkan' and old.status <> 'dibatalkan') then
      for r in select profil_id from public.kegiatan_peserta where kegiatan_id = new.id and profil_id is not null loop
        perform public.fn_notif(r.profil_id, 'kegiatan', case when new.status = 'dibatalkan' then 'Dibatalkan: ' else 'Perubahan jadwal: ' end || new.judul,
          to_char(new.mulai at time zone 'Asia/Makassar', 'DD-MM-YYYY HH24:MI') || ' WITA · ' || new.lokasi, '#/kegiatan?id=' || new.id, 'keg_ubah:' || new.id || ':' || new.mulai || ':' || new.status);
      end loop;
    end if;
  end if;
  new.diperbarui_pada := now();
  return new;
end $$;
drop trigger if exists kegiatan_aturan on public.kegiatan;
create trigger kegiatan_aturan before insert or update on public.kegiatan for each row execute function public.trg_kegiatan_aturan();

create or replace function public.trg_peserta_aturan() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare k public.kegiatan;
begin
  select * into k from public.kegiatan where id = new.kegiatan_id;
  if tg_op = 'INSERT' and new.profil_id is not null then
    new.nama := coalesce((select nama_tampilan from public.profil where id = new.profil_id), new.nama);
  end if;
  if new.kehadiran = 'hadir' and (tg_op = 'INSERT' or old.kehadiran is distinct from 'hadir') then new.hadir_pada := coalesce(new.hadir_pada, now()); new.cara_hadir := coalesce(new.cara_hadir, 'manual'); end if;
  if new.kehadiran <> 'hadir' then new.hadir_pada := null; end if;
  if (new.nilai_pre is not null or new.nilai_post is not null or new.kompetensi <> 'belum_dinilai') and k.tipe <> 'pelatihan' then raise exception 'Nilai dan kompetensi hanya untuk kegiatan pelatihan'; end if;
  if new.kompetensi <> 'belum_dinilai' and (tg_op = 'INSERT' or new.kompetensi is distinct from old.kompetensi) then new.dinilai_oleh := auth.uid(); end if;
  -- Sertifikat otomatis untuk peserta yang dinilai kompeten
  if new.kompetensi = 'kompeten' and new.sertifikat_nomor is null then
    new.sertifikat_nomor := k.nomor || '-' || lpad((select count(*) + 1 from public.kegiatan_peserta where kegiatan_id = k.id and sertifikat_nomor is not null)::text, 3, '0');
    new.sertifikat_berlaku_sampai := case when k.berlaku_bulan is not null then ((k.mulai at time zone 'Asia/Makassar')::date + make_interval(months => k.berlaku_bulan))::date end;
  end if;
  if new.kompetensi <> 'kompeten' then new.sertifikat_nomor := null; new.sertifikat_berlaku_sampai := null; end if;
  if tg_op = 'INSERT' and new.profil_id is not null and k.status = 'terjadwal' then
    perform public.fn_notif(new.profil_id, 'kegiatan', (case when k.tipe = 'toolbox' then 'Toolbox meeting: ' else 'Pelatihan: ' end) || k.judul,
      to_char(k.mulai at time zone 'Asia/Makassar', 'DD-MM-YYYY HH24:MI') || ' WITA · ' || k.lokasi, '#/kegiatan?id=' || k.id, 'keg_undang:' || k.id || ':' || new.profil_id);
  end if;
  return new;
end $$;
drop trigger if exists peserta_aturan on public.kegiatan_peserta;
create trigger peserta_aturan before insert or update on public.kegiatan_peserta for each row execute function public.trg_peserta_aturan();

-- Presensi mandiri dengan kode QR yang hanya ditampilkan penyelenggara di lokasi (30 menit sebelum s.d. 60 menit setelah kegiatan)
create or replace function public.kegiatan_hadir(p_kode text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare k public.kegiatan; me uuid := auth.uid();
begin
  if public.fn_peran() is null then raise exception 'Akun belum aktif'; end if;
  select * into k from public.kegiatan where kode_hadir = btrim(coalesce(p_kode, '')) and status <> 'dibatalkan';
  if k.id is null then raise exception 'Kode kehadiran tidak dikenali'; end if;
  if now() < k.mulai - interval '30 minutes' or now() > k.mulai + make_interval(mins => k.durasi_menit) + interval '60 minutes' then raise exception 'Presensi hanya dibuka 30 menit sebelum sampai 60 menit setelah kegiatan'; end if;
  insert into public.kegiatan_peserta(kegiatan_id, profil_id, nama, kehadiran, cara_hadir, hadir_pada)
  values (k.id, me, coalesce((select nama_tampilan from public.profil where id = me), 'Peserta'), 'hadir', 'qr', now())
  on conflict (kegiatan_id, profil_id) where profil_id is not null do update set kehadiran = 'hadir', cara_hadir = 'qr', hadir_pada = coalesce(public.kegiatan_peserta.hadir_pada, now());
  return jsonb_build_object('kegiatan', k.judul, 'nomor', k.nomor, 'id', k.id);
end $$;

create or replace function public.kegiatan_kode(p_id uuid) returns text
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not public.fn_penyelenggara(p_id) then raise exception 'Hanya penyelenggara'; end if;
  return (select kode_hadir from public.kegiatan where id = p_id);
end $$;

-- =====================================================================
-- (12) NOTIFIKASI TERJADWAL (tenggat, kedaluwarsa, pengingat) — pg_cron tiap jam
-- =====================================================================
create or replace function public.notifikasi_terjadwal() returns int
language plpgsql security definer set search_path = public, pg_temp as $$
declare r record; hari date := public.fn_hari_ini(); n int := 0;
begin
  for r in select * from public.capa where status in ('terbuka','dalam_proses','tidak_efektif') loop
    if r.target_tanggal < hari then perform public.fn_notif(r.pj_id, 'capa', 'CAPA ' || r.nomor || ' TERLAMBAT', 'Target ' || to_char(r.target_tanggal, 'DD-MM-YYYY'), '#/capa?id=' || r.id, 'capa_telat:' || r.id || ':' || r.target_tanggal, true);
      perform public.fn_notif_k3rs('capa', 'CAPA ' || r.nomor || ' terlambat', 'Target ' || to_char(r.target_tanggal, 'DD-MM-YYYY'), '#/capa?id=' || r.id, 'capa_telat:' || r.id || ':' || r.target_tanggal, false, r.pj_id); n := n + 1;
    elsif r.target_tanggal <= hari + 3 then perform public.fn_notif(r.pj_id, 'capa', 'CAPA ' || r.nomor || ' mendekati tenggat', 'Target ' || to_char(r.target_tanggal, 'DD-MM-YYYY'), '#/capa?id=' || r.id, 'capa_tempo:' || r.id || ':' || r.target_tanggal); n := n + 1;
    end if;
  end loop;
  for r in select * from public.izin_kerja where status in ('disahkan','aktif') and selesai between now() and now() + interval '2 hours' loop
    perform public.fn_notif(r.pemohon_id, 'izin', 'Izin kerja ' || r.nomor || ' berakhir dalam 2 jam', 'Berakhir ' || to_char(r.selesai at time zone 'Asia/Makassar', 'HH24:MI'), '#/izin?id=' || r.id, 'izin_hampir:' || r.id || ':' || r.selesai, true); n := n + 1;
  end loop;
  for r in select k.*, p.profil_id from public.kegiatan k join public.kegiatan_peserta p on p.kegiatan_id = k.id
           where k.status = 'terjadwal' and k.mulai between now() and now() + interval '24 hours' and p.profil_id is not null loop
    perform public.fn_notif(r.profil_id, 'kegiatan', 'Pengingat: ' || r.judul, to_char(r.mulai at time zone 'Asia/Makassar', 'DD-MM-YYYY HH24:MI') || ' WITA · ' || r.lokasi, '#/kegiatan?id=' || r.id, 'keg_ingat:' || r.id || ':' || r.mulai || ':' || r.profil_id); n := n + 1;
  end loop;
  for r in select k.* from public.kegiatan k where k.status = 'terjadwal' and k.mulai + make_interval(mins => k.durasi_menit) < now() - interval '1 hour'
           and exists (select 1 from public.kegiatan_peserta p where p.kegiatan_id = k.id and p.kehadiran = 'belum') loop
    perform public.fn_notif(r.dibuat_oleh, 'kegiatan', 'Kehadiran belum lengkap: ' || r.judul, 'Tandai hadir/absen/izin lalu selesaikan kegiatan', '#/kegiatan?id=' || r.id, 'keg_hadir:' || r.id); n := n + 1;
  end loop;
  for r in select k.* from public.kegiatan k where k.tipe = 'pelatihan' and k.status = 'selesai' and k.mulai < now() - interval '3 days'
           and exists (select 1 from public.kegiatan_peserta p where p.kegiatan_id = k.id and p.kehadiran = 'hadir' and p.kompetensi = 'belum_dinilai') loop
    perform public.fn_notif(r.dibuat_oleh, 'kegiatan', 'Pelatihan perlu evaluasi: ' || r.judul, 'Ada peserta hadir yang belum dinilai kompetensinya', '#/kegiatan?id=' || r.id, 'keg_evaluasi:' || r.id); n := n + 1;
  end loop;
  for r in select p.*, k.judul from public.kegiatan_peserta p join public.kegiatan k on k.id = p.kegiatan_id
           where p.sertifikat_berlaku_sampai between hari and hari + 30 and p.profil_id is not null loop
    perform public.fn_notif(r.profil_id, 'kegiatan', 'Sertifikat ' || r.judul || ' segera kedaluwarsa', 'Berlaku sampai ' || to_char(r.sertifikat_berlaku_sampai, 'DD-MM-YYYY'), '#/kegiatan?saya=1', 'sertifikat:' || r.id || ':' || r.sertifikat_berlaku_sampai); n := n + 1;
  end loop;
  return n;
end $$;

-- =====================================================================
-- (13) ANTREAN PENGIRIMAN untuk Edge Function (hanya service_role)
-- =====================================================================
create or replace function public.notif_ambil(p_batas int default 50) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare hasil jsonb;
begin
  with pilih as (
    select id from public.notifikasi_kirim
     where status = 'menunggu' or (status = 'diproses' and diproses_pada < now() - interval '10 minutes')
        or (status = 'gagal' and percobaan < 5 and diproses_pada < now() - make_interval(mins => 5 * power(2, percobaan)::int))
     order by id limit least(greatest(coalesce(p_batas, 50), 1), 200) for update skip locked),
  tandai as (update public.notifikasi_kirim a set status = 'diproses', percobaan = a.percobaan + 1, diproses_pada = now() from pilih where a.id = pilih.id
             returning a.id, a.notifikasi_id, a.saluran)
  select coalesce(jsonb_agg(jsonb_build_object('kirim_id', t.id, 'saluran', t.saluran, 'notifikasi_id', n.id, 'kategori', n.kategori, 'judul', n.judul, 'isi', n.isi,
           'tautan', n.tautan, 'wajib', n.wajib, 'dibuat_pada', n.dibuat_pada, 'email', u.email, 'nama', p.nama_tampilan,
           'push', (select coalesce(jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth)), '[]') from public.push_langganan s where s.profil_id = n.penerima_id))), '[]')
    into hasil
    from tandai t join public.notifikasi n on n.id = t.notifikasi_id join public.profil p on p.id = n.penerima_id join auth.users u on u.id = n.penerima_id;
  return hasil;
end $$;
create or replace function public.notif_lapor(p_hasil jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare x jsonb; ok int := 0; gagal int := 0;
begin
  for x in select * from jsonb_array_elements(p_hasil) loop
    if x->>'status' = 'terkirim' then update public.notifikasi_kirim set status = 'terkirim', terkirim_pada = now(), galat = '' where id = (x->>'kirim_id')::bigint; ok := ok + 1;
    elsif x->>'status' = 'dilewati' then update public.notifikasi_kirim set status = 'dilewati', galat = left(coalesce(x->>'galat', ''), 300) where id = (x->>'kirim_id')::bigint;
    else update public.notifikasi_kirim set status = 'gagal', galat = left(coalesce(x->>'galat', 'tidak diketahui'), 300) where id = (x->>'kirim_id')::bigint; gagal := gagal + 1; end if;
    if x ? 'hapus_endpoint' then delete from public.push_langganan where endpoint = x->>'hapus_endpoint'; end if;   -- langganan push kedaluwarsa (410)
  end loop;
  return jsonb_build_object('terkirim', ok, 'gagal', gagal);
end $$;
create or replace function public.notif_tandai_dibaca(p_ids bigint[] default null) returns int
language plpgsql security definer set search_path = public, pg_temp as $$
declare n int;
begin
  update public.notifikasi set dibaca_pada = now() where penerima_id = auth.uid() and dibaca_pada is null and (p_ids is null or id = any(p_ids));
  get diagnostics n = row_count; return n;
end $$;

-- Daftar pengguna berhalaman untuk K3RS (pencarian & filter di server)
create or replace function public.daftar_pengguna_halaman(p_q text default '', p_status text default '', p_peran text default '', p_batas int default 25, p_mulai int default 0)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare hasil jsonb; total int;
begin
  if not public.fn_k3rs() then raise exception 'Hanya K3RS'; end if;
  with x as (select p.id, u.email::text as email, p.nama_tampilan as nama, p.peran, p.unit_id, p.aktif, p.dibuat_pada::date as dibuat
               from public.profil p join auth.users u on u.id = p.id
              where (coalesce(p_q, '') = '' or p.nama_tampilan ilike '%' || p_q || '%' or u.email ilike '%' || p_q || '%')
                and (coalesce(p_status, '') = '' or (p_status = 'aktif') = p.aktif) and (coalesce(p_peran, '') = '' or p.peran::text = p_peran))
  select count(*), coalesce((select jsonb_agg(y) from (select * from x order by aktif, nama limit least(greatest(p_batas, 1), 100) offset greatest(p_mulai, 0)) y), '[]') into total, hasil from x;
  return jsonb_build_object('total', total, 'baris', hasil);
end $$;

-- =====================================================================
-- (14) AUDIT TRAIL, RLS, HAK AKSES
-- =====================================================================
do $$ declare t text; begin
  foreach t in array array['investigasi','capa','izin_kerja','kegiatan','kegiatan_peserta'] loop
    execute format('drop trigger if exists %1$s_jejak on public.%1$s', t);
    execute format('create trigger %1$s_jejak after insert or update or delete on public.%1$s for each row execute function public.trg_jejak()', t);
  end loop;
end $$;

alter table public.investigasi enable row level security; alter table public.capa enable row level security; alter table public.jenis_izin enable row level security;
alter table public.izin_kerja enable row level security; alter table public.izin_jurnal enable row level security; alter table public.kegiatan enable row level security;
alter table public.kegiatan_peserta enable row level security; alter table public.notifikasi enable row level security; alter table public.preferensi_notifikasi enable row level security;
alter table public.notifikasi_kirim enable row level security; alter table public.push_langganan enable row level security;

revoke all on public.investigasi, public.capa, public.jenis_izin, public.izin_kerja, public.izin_jurnal, public.kegiatan, public.kegiatan_peserta,
  public.notifikasi, public.preferensi_notifikasi, public.notifikasi_kirim, public.push_langganan from anon, authenticated;
grant select, insert, update on public.investigasi, public.capa, public.izin_kerja to authenticated;
grant select on public.jenis_izin, public.izin_jurnal to authenticated;
grant update (nama, ceklis, butuh_uji_gas, aktif, urutan) on public.jenis_izin to authenticated;
grant insert on public.jenis_izin to authenticated;
grant select (id, nomor, tipe, judul, kategori, tujuan, topik, materi, pemateri, supervisor_id, unit_id, lokasi, mulai, durasi_menit, status, catatan, isu_keselamatan, laporan_id, berlaku_bulan, dibuat_oleh, dibuat_pada, diperbarui_pada)
  on public.kegiatan to authenticated;                                           -- kode_hadir sengaja tidak diberikan
grant insert (tipe, judul, kategori, tujuan, topik, materi, pemateri, supervisor_id, unit_id, lokasi, mulai, durasi_menit, catatan, isu_keselamatan, laporan_id, berlaku_bulan) on public.kegiatan to authenticated;
grant update (judul, kategori, tujuan, topik, materi, pemateri, supervisor_id, unit_id, lokasi, mulai, durasi_menit, status, catatan, isu_keselamatan, laporan_id, berlaku_bulan) on public.kegiatan to authenticated;
grant select, insert, update, delete on public.kegiatan_peserta to authenticated;
grant usage on sequence public.kegiatan_peserta_id_seq, public.push_langganan_id_seq to authenticated;
grant select on public.notifikasi to authenticated;
grant select, insert, update on public.preferensi_notifikasi to authenticated;
grant select, insert, delete on public.push_langganan to authenticated;
grant select on public.notifikasi_kirim to authenticated;

drop policy if exists inv_baca on public.investigasi;
create policy inv_baca on public.investigasi for select to authenticated using (public.fn_k3rs() or ketua_id = auth.uid() or dibuat_oleh = auth.uid() or (public.fn_peran() = 'pj_unit' and unit_id = public.fn_unit()));
drop policy if exists inv_tambah on public.investigasi;
create policy inv_tambah on public.investigasi for insert to authenticated with check (public.fn_k3rs() or (public.fn_peran() = 'pj_unit' and unit_id = public.fn_unit()));
drop policy if exists inv_ubah on public.investigasi;
create policy inv_ubah on public.investigasi for update to authenticated using (public.fn_k3rs() or ketua_id = auth.uid()) with check (public.fn_k3rs() or ketua_id = auth.uid());

drop policy if exists capa_baca on public.capa;
create policy capa_baca on public.capa for select to authenticated using (public.fn_k3rs() or pj_id = auth.uid() or (public.fn_peran() = 'pj_unit' and unit_id = public.fn_unit())
  or (investigasi_id is not null and exists (select 1 from public.investigasi i where i.id = investigasi_id and i.ketua_id = auth.uid())));
drop policy if exists capa_tambah on public.capa;
create policy capa_tambah on public.capa for insert to authenticated with check (public.fn_k3rs() or (public.fn_peran() = 'pj_unit' and unit_id = public.fn_unit())
  or (investigasi_id is not null and exists (select 1 from public.investigasi i where i.id = investigasi_id and i.ketua_id = auth.uid())));
drop policy if exists capa_ubah on public.capa;
create policy capa_ubah on public.capa for update to authenticated using (public.fn_k3rs() or pj_id = auth.uid()) with check (public.fn_k3rs() or pj_id = auth.uid());

drop policy if exists ji_baca on public.jenis_izin;
create policy ji_baca on public.jenis_izin for select to authenticated using (public.fn_peran() is not null);
drop policy if exists ji_kelola on public.jenis_izin;
create policy ji_kelola on public.jenis_izin for all to authenticated using (public.fn_k3rs()) with check (public.fn_k3rs());

drop policy if exists izin_baca on public.izin_kerja;
create policy izin_baca on public.izin_kerja for select to authenticated using (public.fn_k3rs() or pemohon_id = auth.uid() or supervisor_id = auth.uid() or (public.fn_peran() is not null and unit_id = public.fn_unit()));
drop policy if exists izin_tambah on public.izin_kerja;
create policy izin_tambah on public.izin_kerja for insert to authenticated with check ((public.fn_k3rs() or (public.fn_peran() = 'pj_unit' and unit_id = public.fn_unit())) and status = 'draf');
drop policy if exists izin_ubah on public.izin_kerja;
create policy izin_ubah on public.izin_kerja for update to authenticated using (public.fn_k3rs() or pemohon_id = auth.uid()) with check (public.fn_k3rs() or pemohon_id = auth.uid());
drop policy if exists izj_baca on public.izin_jurnal;
create policy izj_baca on public.izin_jurnal for select to authenticated using (exists (select 1 from public.izin_kerja i where i.id = izin_id));

drop policy if exists keg_baca on public.kegiatan;
create policy keg_baca on public.kegiatan for select to authenticated using (public.fn_peran() is not null and (public.fn_k3rs() or unit_id = public.fn_unit() or dibuat_oleh = auth.uid() or supervisor_id = auth.uid() or public.fn_peserta_saya(id)));
drop policy if exists keg_tambah on public.kegiatan;
create policy keg_tambah on public.kegiatan for insert to authenticated with check (public.fn_k3rs() or (public.fn_peran() = 'pj_unit' and unit_id = public.fn_unit()));
drop policy if exists keg_ubah on public.kegiatan;
create policy keg_ubah on public.kegiatan for update to authenticated using (public.fn_penyelenggara(id)) with check (public.fn_k3rs() or (public.fn_peran() = 'pj_unit' and unit_id = public.fn_unit()));
drop policy if exists kp_baca on public.kegiatan_peserta;
create policy kp_baca on public.kegiatan_peserta for select to authenticated using (profil_id = auth.uid() or public.fn_penyelenggara(kegiatan_id));
drop policy if exists kp_kelola on public.kegiatan_peserta;
create policy kp_kelola on public.kegiatan_peserta for all to authenticated using (public.fn_penyelenggara(kegiatan_id)) with check (public.fn_penyelenggara(kegiatan_id));

drop policy if exists notif_baca on public.notifikasi;
create policy notif_baca on public.notifikasi for select to authenticated using (penerima_id = auth.uid());
drop policy if exists pref_saya on public.preferensi_notifikasi;
create policy pref_saya on public.preferensi_notifikasi for all to authenticated using (profil_id = auth.uid()) with check (profil_id = auth.uid());
drop policy if exists push_saya on public.push_langganan;
create policy push_saya on public.push_langganan for all to authenticated using (profil_id = auth.uid()) with check (profil_id = auth.uid());
drop policy if exists nk_baca on public.notifikasi_kirim;
create policy nk_baca on public.notifikasi_kirim for select to authenticated using (public.fn_k3rs() or exists (select 1 from public.notifikasi n where n.id = notifikasi_id and n.penerima_id = auth.uid()));

revoke execute on function public.fn_notif(uuid,text,text,text,text,text,boolean), public.fn_notif_k3rs(text,text,text,text,text,boolean,uuid), public.trg_notif_laporan(),
  public.trg_investigasi_aturan(), public.trg_investigasi_notif(), public.trg_capa_aturan(), public.trg_capa_notif(), public.trg_izin_aturan(), public.fn_izin_notif(public.izin_kerja,text,text),
  public.izin_proses(uuid,text,text,jsonb), public.izin_periksa_kedaluwarsa(), public.trg_jsa_ke_izin(), public.fn_penyelenggara(uuid), public.fn_peserta_saya(uuid),
  public.trg_kegiatan_aturan(), public.trg_peserta_aturan(), public.kegiatan_hadir(text), public.kegiatan_kode(uuid), public.notifikasi_terjadwal(),
  public.notif_ambil(int), public.notif_lapor(jsonb), public.notif_tandai_dibaca(bigint[]), public.daftar_pengguna_halaman(text,text,text,int,int) from public, anon, authenticated;
grant execute on function public.izin_proses(uuid,text,text,jsonb), public.fn_penyelenggara(uuid), public.fn_peserta_saya(uuid), public.kegiatan_hadir(text), public.kegiatan_kode(uuid),
  public.notif_tandai_dibaca(bigint[]), public.daftar_pengguna_halaman(text,text,text,int,int) to authenticated;
do $$ begin
  execute 'grant execute on function public.notif_ambil(int), public.notif_lapor(jsonb) to service_role';    -- hanya Edge Function (service role)
exception when undefined_object then raise notice 'role service_role tidak ada (lingkungan uji)'; end $$;

-- =====================================================================
-- (15) JADWAL (pg_cron)
-- =====================================================================
do $$ begin
  perform cron.schedule('hse-izin-kedaluwarsa', '*/10 * * * *', 'select public.izin_periksa_kedaluwarsa()');
  perform cron.schedule('hse-notifikasi-terjadwal', '5 * * * *', 'select public.notifikasi_terjadwal()');
exception when others then raise notice 'Jadwal belum dibuat (aktifkan pg_cron lalu jalankan ulang berkas ini): %', sqlerrm; end $$;

-- =====================================================================
-- (16) PERFORMA RLS LAPORAN — makna SAMA dengan public.fn_boleh_lihat(id), tetapi fungsi peran
--      dievaluasi sekali per kueri (subselect), sehingga hitungan total & pencarian berindeks tetap cepat
--      pada puluhan ribu laporan. Kebijakan lama dapat dipulihkan lewat rollback 29c.
-- =====================================================================
drop policy if exists baca_laporan on public.laporan;
create policy baca_laporan on public.laporan for select to authenticated using (
  (select public.fn_k3rs())
  or ((select public.fn_peran()) in ('pj_unit','petugas') and pelapor_id = (select auth.uid()))
  or ((select public.fn_peran()) = 'pj_unit' and (unit_id = (select public.fn_unit()) or pj_id = (select auth.uid())))
);

-- =====================================================================
-- (17) RINGKASAN DASBOR & DAFTAR PILIHAN (mengikuti hak akses pemanggil)
-- =====================================================================
create or replace function public.daftar_supervisor() returns table(id uuid, nama text, peran public.peran_t, unit_id int)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if public.fn_peran() not in ('k3rs','pj_unit') then raise exception 'Tidak berwenang'; end if;
  return query select p.id, p.nama_tampilan, p.peran, p.unit_id from public.profil p where p.aktif and p.peran in ('k3rs','pj_unit') order by p.peran, p.nama_tampilan;
end $$;
create or replace function public.daftar_rekan(p_q text default '', p_unit int default null) returns table(id uuid, nama text, unit_id int)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if public.fn_peran() not in ('k3rs','pj_unit') then raise exception 'Tidak berwenang'; end if;
  return query select p.id, p.nama_tampilan, p.unit_id from public.profil p
   where p.aktif and (coalesce(p_q, '') = '' or p.nama_tampilan ilike '%' || p_q || '%')
     and (public.fn_k3rs() or p.unit_id = public.fn_unit()) and (p_unit is null or p.unit_id = p_unit)
   order by p.nama_tampilan limit 100;
end $$;
-- SECURITY INVOKER: hanya menghitung data yang boleh dilihat pemanggil
create or replace function public.izin_ringkas(p_dari date default null, p_sampai date default null) returns jsonb
language sql stable security invoker set search_path = public, pg_temp as $$
  with i as (select * from public.izin_kerja where (p_dari is null or (mulai at time zone 'Asia/Makassar')::date >= p_dari) and (p_sampai is null or (mulai at time zone 'Asia/Makassar')::date <= p_sampai))
  select jsonb_build_object('total', (select count(*) from i),
    'menunggu', (select count(*) from i where status in ('diajukan','tinjau_k3','menunggu_pengesahan')), 'aktif', (select count(*) from i where status = 'aktif'),
    'disahkan', (select count(*) from i where status = 'disahkan'), 'kedaluwarsa', (select count(*) from i where status = 'kedaluwarsa'),
    'ditangguhkan', (select count(*) from i where status = 'ditangguhkan'), 'selesai', (select count(*) from i where status in ('selesai_kerja','ditutup')),
    'ditolak', (select count(*) from i where status = 'ditolak'), 'perlu_tinjau', (select count(*) from i where perlu_tinjau),
    'per_status', coalesce((select jsonb_object_agg(status, n) from (select status, count(*) n from i group by 1) x), '{}'),
    'per_jenis', coalesce((select jsonb_object_agg(jenis, n) from (select jenis, count(*) n from i group by 1) x), '{}'),
    'per_unit', coalesce((select jsonb_object_agg(u.nama, n) from (select unit_id, count(*) n from i group by 1) x join public.unit u on u.id = x.unit_id), '{}'),
    'per_lokasi', coalesce((select jsonb_object_agg(lokasi, n) from (select coalesce(nullif(lokasi, ''), '(tanpa lokasi)') lokasi, count(*) n from i group by 1 order by 2 desc limit 10) x), '{}'))
$$;
create or replace function public.kegiatan_ringkas(p_dari date default null, p_sampai date default null) returns jsonb
language sql stable security invoker set search_path = public, pg_temp as $$
  with k as (select * from public.kegiatan where status <> 'dibatalkan' and (p_dari is null or (mulai at time zone 'Asia/Makassar')::date >= p_dari) and (p_sampai is null or (mulai at time zone 'Asia/Makassar')::date <= p_sampai)),
       p as (select pp.*, k.tipe, k.mulai, k.status as status_kegiatan from public.kegiatan_peserta pp join k on k.id = pp.kegiatan_id)
  select jsonb_build_object(
    'pelatihan', (select count(*) from k where tipe = 'pelatihan'), 'toolbox', (select count(*) from k where tipe = 'toolbox'),
    'peserta', (select count(*) from p), 'peserta_unik', (select count(distinct coalesce(profil_id::text, nama)) from p),
    'tingkat_hadir', (select case when count(*) = 0 then null else round(100.0 * count(*) filter (where kehadiran = 'hadir') / count(*), 1) end from p where status_kegiatan = 'selesai'),
    'pelatihan_selesai_persen', (select case when count(*) = 0 then null else round(100.0 * count(*) filter (where status = 'selesai') / count(*), 1) end from k where tipe = 'pelatihan' and mulai < now()),
    'rata_pre', (select round(avg(nilai_pre), 1) from p where tipe = 'pelatihan'), 'rata_post', (select round(avg(nilai_post), 1) from p where tipe = 'pelatihan'),
    'kompeten', (select count(*) from p where kompetensi = 'kompeten'), 'dinilai', (select count(*) from p where kompetensi <> 'belum_dinilai'),
    'akan_datang', (select count(*) from k where status = 'terjadwal' and mulai >= now()),
    'terlambat', (select count(*) from k where status = 'terjadwal' and mulai + make_interval(mins => durasi_menit) < now()),
    'per_unit', coalesce((select jsonb_object_agg(u.nama, n) from (select unit_id, count(*) n from k group by 1) x join public.unit u on u.id = x.unit_id), '{}'),
    'per_kategori', coalesce((select jsonb_object_agg(kat, n) from (select coalesce(nullif(kategori, ''), '(tanpa kategori)') kat, count(*) n from k where tipe = 'pelatihan' group by 1) x), '{}'))
$$;
revoke execute on function public.daftar_supervisor(), public.daftar_rekan(text,int), public.izin_ringkas(date,date), public.kegiatan_ringkas(date,date) from public, anon;
grant execute on function public.daftar_supervisor(), public.daftar_rekan(text,int), public.izin_ringkas(date,date), public.kegiatan_ringkas(date,date) to authenticated;
