#!/usr/bin/env bash
# Basis data uji ujung-ke-ujung: skema lengkap + akun uji (sandi semua: Uji-Sandi-2026)
set -euo pipefail
cd "$(dirname "$0")/../.."
P="psql -q -X"
$P -c "drop database if exists hse_e2e with (force)" -c "create database hse_e2e" >/dev/null
$P -d hse_e2e -f tests/db/00_shim_supabase.sql >/dev/null 2>&1 || true
for f in supabase/01_setup.sql supabase/usulan/10_admin_utama.sql supabase/20_modul_hse.sql supabase/21_jejak_dan_dokumen.sql supabase/23_modul_lanjutan.sql; do
  $P -d hse_e2e -v ON_ERROR_STOP=1 -f "$f" >/dev/null 2>&1 || { echo "GAGAL $f"; exit 1; }; done
$P -d hse_e2e -v ON_ERROR_STOP=1 <<'SQL'
do $$ begin create role authenticator login noinherit; exception when duplicate_object then null; end $$;
insert into auth.users(id, email) values
 ('00000000-0000-0000-0000-00000000000a','k3rs@uji.id'),('00000000-0000-0000-0000-00000000000f','k3rs2@uji.id'),
 ('00000000-0000-0000-0000-00000000000b','pj.ipsrs@uji.id'),('00000000-0000-0000-0000-00000000000c','petugas@uji.id'),
 ('00000000-0000-0000-0000-00000000000d','pj.igd@uji.id'),('00000000-0000-0000-0000-00000000000e','baru@uji.id');
update profil set nama_tampilan='Kepala K3RS', peran='k3rs', aktif=true where id='00000000-0000-0000-0000-00000000000a';
update profil set nama_tampilan='Petugas K3 Senior', peran='k3rs', aktif=true where id='00000000-0000-0000-0000-00000000000f';
update profil set nama_tampilan='Koordinator IPSRS', peran='pj_unit', unit_id=(select id from unit where kode='IPSRS'), aktif=true where id='00000000-0000-0000-0000-00000000000b';
update profil set nama_tampilan='Teknisi IPSRS', peran='petugas', unit_id=(select id from unit where kode='IPSRS'), aktif=true where id='00000000-0000-0000-0000-00000000000c';
update profil set nama_tampilan='Kepala Ruang IGD', peran='pj_unit', unit_id=(select id from unit where kode='IGD'), aktif=true where id='00000000-0000-0000-0000-00000000000d';
insert into admin_utama(user_id) values ('00000000-0000-0000-0000-00000000000a');
SQL
echo "hse_e2e siap"
