#!/usr/bin/env bash
# Basis data UAT (terpisah dari produksi): skema lengkap + akun persona SIMULASI_UAT (sandi: Uji-Sandi-2026)
set -euo pipefail
cd "$(dirname "$0")/../.."
P="psql -q -X"
$P -c "drop database if exists hse_uat with (force)" -c "create database hse_uat" >/dev/null
$P -d hse_uat -f tests/db/00_shim_supabase.sql >/dev/null 2>&1 || true
for f in supabase/01_setup.sql supabase/usulan/10_admin_utama.sql supabase/20_modul_hse.sql supabase/21_jejak_dan_dokumen.sql supabase/23_modul_lanjutan.sql; do
  $P -d hse_uat -v ON_ERROR_STOP=1 -f "$f" >/dev/null 2>&1 || { echo "GAGAL $f"; exit 1; }; done
$P -d hse_uat -v ON_ERROR_STOP=1 <<'SQL'
do $$ begin create role authenticator login noinherit; exception when duplicate_object then null; end $$;
update pengaturan set nama_instansi = 'SIMULASI_UAT — lingkungan uji (bukan data RS)' where id = 1;
insert into auth.users(id, email) values
 ('00000000-0000-0000-0000-0000000000a1','p1.koordinator@simulasi-uat.test'),
 ('00000000-0000-0000-0000-0000000000a2','p2.hira@simulasi-uat.test'),
 ('00000000-0000-0000-0000-0000000000a3','p3.insiden@simulasi-uat.test'),
 ('00000000-0000-0000-0000-0000000000b1','pj.ipsrs@simulasi-uat.test'),
 ('00000000-0000-0000-0000-0000000000b2','pj.kesling@simulasi-uat.test'),
 ('00000000-0000-0000-0000-0000000000c1','petugas.kesling@simulasi-uat.test'),
 ('00000000-0000-0000-0000-0000000000c2','petugas.farmasi@simulasi-uat.test');
update profil set nama_tampilan='SIMULASI_UAT P1 Koordinator K3', peran='k3rs', aktif=true where id='00000000-0000-0000-0000-0000000000a1';
update profil set nama_tampilan='SIMULASI_UAT P2 Identifikasi Bahaya', peran='k3rs', aktif=true where id='00000000-0000-0000-0000-0000000000a2';
update profil set nama_tampilan='SIMULASI_UAT P3 Insiden & Tindak Lanjut', peran='k3rs', aktif=true where id='00000000-0000-0000-0000-0000000000a3';
update profil set nama_tampilan='SIMULASI_UAT PJ IPSRS', peran='pj_unit', unit_id=(select id from unit where kode='IPSRS'), aktif=true where id='00000000-0000-0000-0000-0000000000b1';
update profil set nama_tampilan='SIMULASI_UAT PJ Kesling', peran='pj_unit', unit_id=(select id from unit where kode='KESLING'), aktif=true where id='00000000-0000-0000-0000-0000000000b2';
update profil set nama_tampilan='SIMULASI_UAT Petugas Kesling', peran='petugas', unit_id=(select id from unit where kode='KESLING'), aktif=true where id='00000000-0000-0000-0000-0000000000c1';
update profil set nama_tampilan='SIMULASI_UAT Petugas Farmasi', peran='petugas', unit_id=(select id from unit where kode='FARMASI'), aktif=true where id='00000000-0000-0000-0000-0000000000c2';
insert into admin_utama(user_id) values ('00000000-0000-0000-0000-0000000000a1');
SQL
echo "hse_uat siap"
