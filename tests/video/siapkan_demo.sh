#!/usr/bin/env bash
# Basis data UAT (terpisah dari produksi): skema lengkap + akun persona Demo (sandi: Uji-Sandi-2026)
set -euo pipefail
cd "$(dirname "$0")/../.."
P="psql -q -X"
$P -c "drop database if exists hse_demo with (force)" -c "create database hse_demo" >/dev/null
$P -d hse_demo -f tests/db/00_shim_supabase.sql >/dev/null 2>&1 || true
for f in supabase/01_setup.sql supabase/usulan/10_admin_utama.sql supabase/20_modul_hse.sql supabase/21_jejak_dan_dokumen.sql supabase/23_modul_lanjutan.sql; do
  $P -d hse_demo -v ON_ERROR_STOP=1 -f "$f" >/dev/null 2>&1 || { echo "GAGAL $f"; exit 1; }; done
$P -d hse_demo -v ON_ERROR_STOP=1 <<'SQL'
do $$ begin create role authenticator login noinherit; exception when duplicate_object then null; end $$;
update pengaturan set nama_instansi = 'Rumah Sakit Demo — data demonstrasi', nomor_darurat = 'Ext. 000 (contoh)' where id = 1;
insert into auth.users(id, email) values
 ('00000000-0000-0000-0000-0000000000a1','p1.koordinator@demo.hse'),
 ('00000000-0000-0000-0000-0000000000a2','p2.hira@demo.hse'),
 ('00000000-0000-0000-0000-0000000000a3','p3.insiden@demo.hse'),
 ('00000000-0000-0000-0000-0000000000b1','pj.ipsrs@demo.hse'),
 ('00000000-0000-0000-0000-0000000000b2','pj.kesling@demo.hse'),
 ('00000000-0000-0000-0000-0000000000c1','petugas.kesling@demo.hse'),
 ('00000000-0000-0000-0000-0000000000c2','petugas.farmasi@demo.hse');
update profil set nama_tampilan='Demo Koordinator K3', peran='k3rs', aktif=true where id='00000000-0000-0000-0000-0000000000a1';
update profil set nama_tampilan='Demo Analis Risiko', peran='k3rs', aktif=true where id='00000000-0000-0000-0000-0000000000a2';
update profil set nama_tampilan='Demo Pengelola Insiden', peran='k3rs', aktif=true where id='00000000-0000-0000-0000-0000000000a3';
update profil set nama_tampilan='Demo PJ IPSRS', peran='pj_unit', unit_id=(select id from unit where kode='IPSRS'), aktif=true where id='00000000-0000-0000-0000-0000000000b1';
update profil set nama_tampilan='Demo PJ Kesling', peran='pj_unit', unit_id=(select id from unit where kode='KESLING'), aktif=true where id='00000000-0000-0000-0000-0000000000b2';
update profil set nama_tampilan='Demo Petugas Kesling', peran='petugas', unit_id=(select id from unit where kode='KESLING'), aktif=true where id='00000000-0000-0000-0000-0000000000c1';
update profil set nama_tampilan='Demo Petugas Farmasi', peran='petugas', unit_id=(select id from unit where kode='FARMASI'), aktif=true where id='00000000-0000-0000-0000-0000000000c2';
insert into admin_utama(user_id) values ('00000000-0000-0000-0000-0000000000a1');
SQL

# Riwayat laporan demonstrasi 120 hari terakhir (sintetis, bertanda [DEMO]) agar dasbor dan grafik berisi
$P -d hse_demo -v ON_ERROR_STOP=1 <<'SQL'
with t(jenis, kat, unit, lok, ur, d, p) as (values
 ('bahaya','fisik','RANAP','Koridor lantai 2','Lantai licin setelah dipel tanpa rambu',3,4),
 ('bahaya','mekanik','IPSRS','Ruang panel','Kabel terkelupas di dekat panel distribusi',4,3),
 ('nyaris_celaka','ergonomi','RANAP','Kamar perawatan','Hampir cedera punggung saat memindahkan pasien tanpa alat bantu',3,3),
 ('bahaya','kimia','LAB','Ruang reagen','Botol reagen tanpa label',3,3),
 ('bahaya','biologi','IGD','Ruang tindakan','Safety box penuh melewati batas',4,3),
 ('kejadian','biologi','OK','Kamar operasi 2','Petugas tertusuk jarum jahit setelah tindakan',4,2),
 ('bahaya','kebakaran','GIZI','Dapur','APAR terhalang troli makanan',4,2),
 ('bahaya','limbah','KESLING','TPS limbah B3','Pintu TPS limbah tidak terkunci',3,3),
 ('nyaris_celaka','fisik','LAUNDRY','Area cuci','Hampir terpeleset genangan air dekat mesin cuci',3,3),
 ('bahaya','psikososial','IGD','Meja triase','Petugas menerima ancaman verbal dari pengunjung',3,4),
 ('bahaya','fisik','RAD','Ruang X-ray','Tanda radiasi di pintu memudar',4,2),
 ('bahaya','kimia','CSSD','Ruang sterilisasi','Ventilasi ruang sterilisasi lemah',3,3),
 ('kejadian','fisik','IPSRS','Atap gedung','Teknisi tergelincir di tangga saat memeriksa talang',3,2),
 ('bahaya','mekanik','ICU','ICU bed 4','Stop kontak longgar pada alat medis',4,3),
 ('nyaris_celaka','kebakaran','FARMASI','Gudang farmasi','Bau hangus dari kipas angin gudang',4,2))
insert into laporan(nomor, jenis, kategori_kode, unit_id, lokasi, uraian, dampak, kemungkinan, status, tanggal_lapor, dibuat_pada, pj_id, target_tanggal, pelapor_id)
select 'K3-D' || lpad(row_number() over ()::text, 4, '0'), t.jenis, t.kat, u.id, t.lok, '[DEMO] ' || t.ur, t.d, t.p,
  (case when g % 4 = 0 then 'tertutup' when g % 4 = 1 then 'dalam_tindak_lanjut' when g % 4 = 2 then 'ditugaskan' else 'terkendali_sementara' end)::status_t,
  current_date - (g * 38 + (ascii(t.ur) % 20)), now() - make_interval(days => g * 38 + (ascii(t.ur) % 20)),
  '00000000-0000-0000-0000-0000000000b1', current_date + (g % 5) * 3 - 4, '00000000-0000-0000-0000-0000000000c1'
from t join unit u on u.kode = t.unit cross join generate_series(0, 3) g;
update laporan set ditutup_pada = dibuat_pada + interval '6 days' where status = 'tertutup' and nomor like 'K3-D%';
SQL
echo "hse_demo siap"
