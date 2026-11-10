#!/usr/bin/env bash
# Regresi basis data di PostgreSQL lokal (butuh: postgresql 16, server berjalan).
# Pemakaian: PGHOST=/var/lib/postgresql PGPORT=5544 PGUSER=postgres tests/db/jalankan.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
P="psql -q -X"
$P -c "drop database if exists hse_uji with (force)" -c "create database hse_uji" >/dev/null
$P -d hse_uji -f tests/db/00_shim_supabase.sql >/dev/null 2>&1 || true
for f in supabase/01_setup.sql supabase/usulan/10_admin_utama.sql supabase/20_modul_hse.sql supabase/21_jejak_dan_dokumen.sql supabase/23_modul_lanjutan.sql; do $P -d hse_uji -v ON_ERROR_STOP=1 -f "$f" >/dev/null 2>&1 || { echo "GAGAL memasang $f"; exit 1; }; done
$P -d hse_uji -v ON_ERROR_STOP=1 -f supabase/21_jejak_dan_dokumen.sql >/dev/null 2>&1 || { echo "GAGAL: migrasi 21 tidak aman diulang"; exit 1; }
out=$( { $P -d hse_uji -f tests/db/10_uji_rls_modul.sql; $P -d hse_uji -f tests/db/20_uji_jejak.sql; $P -d hse_uji -f tests/db/30_uji_modul_lanjutan.sql; } 2>&1 )
echo "$out" | grep -oE "(OK|GAGAL): .*" ; echo "$out" | grep -E "ERROR" && exit 1
echo "LULUS: $(echo "$out" | grep -c 'OK:') pemeriksaan"
