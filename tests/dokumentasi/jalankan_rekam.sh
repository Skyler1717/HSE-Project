#!/bin/bash
# Rekam dokumentasi untuk ketiga tema; basis data uji dipulihkan dari templat sebelum tiap tema agar datanya sama.
# Prasyarat: PGHOST/PGPORT/PGUSER menunjuk ke PostgreSQL uji; hse_dok_tpl = salinan hse_demo; server statis :8765.
set -e
OUT=${1:?dir keluar}; shift; TEMA=${TEMA:-"bentenan navy aksesibel"}; AKAR=$(cd "$(dirname "$0")/../.." && pwd)
for t in $TEMA; do
  pkill -f "rest-uji.js 3101" || true; sleep 1
  psql -q -c "drop database if exists hse_dok" -c "create database hse_dok template hse_dok_tpl"
  psql -q -d hse_dok -c "set session_replication_role = replica; update izin_kerja set mulai=now()-interval '1 hour', selesai=now()+interval '8 hours' where status='aktif'"
  (cd "$AKAR" && PGDATABASE=hse_dok nohup node tests/server/rest-uji.js 3101 > "$OUT/rest_$t.log" 2>&1 &); sleep 2
  node "$AKAR/tests/dokumentasi/rekam_fitur.js" "$t" "$OUT" "$@"
done
