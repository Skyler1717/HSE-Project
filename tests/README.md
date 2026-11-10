# Pengujian regresi HSE Project

| Paket | Isi | Jalankan |
|---|---|---|
| `tests/db/` | Skema, RLS, fungsi, jejak perubahan, idempotensi migrasi (PostgreSQL 16 + tiruan Supabase) | `PGHOST=… PGPORT=… PGUSER=postgres tests/db/jalankan.sh` |
| `tests/sheets/` | Apps Script `Kode.gs` terhadap basis data uji (anti-duplikasi, retry, galat, privasi) | `PGHOST=… node tests/sheets/uji_apps_script.js` (setelah `tests/db/jalankan.sh`) |
| `tests/browser/smoke.js` | Semua halaman × 3 peran: galat JS, halaman kendala, overflow horizontal | `node tests/browser/smoke.js` · ponsel: `LEBAR=360 node …` |
| `tests/browser/e2e.js` | 31 skenario ujung-ke-ujung (tema, JSA, validasi kritis, inspeksi, pemantauan, OCR/PDF/DOCX, pencarian, riwayat, notifikasi, jejak, dokumen, pengguna) | `node tests/browser/e2e.js` |
| `tests/browser/login_supabase.js` | Login ke URL Supabase yang benar (server tiruan) | `node tests/browser/login_supabase.js` |
| `tests/browser/sbmode.js` | Mode Supabase saat modul belum diaktifkan | `node tests/browser/sbmode.js` |
| `tests/browser/e2e_supabase.js` | 50 skenario mode Supabase terhadap basis data nyata: investigasi→RCA→CAPA→verifikasi→penutupan, PTW (alur, SWA, JSA berubah, dasbor), toolbox/pelatihan (QR, pre/post, kompetensi, sertifikat), notifikasi, paginasi 1.250+ laporan | `tests/server/siapkan_e2e.sh && PGDATABASE=hse_e2e node tests/server/rest-uji.js 3101 &` lalu `node tests/browser/e2e_supabase.js` |
| `tests/notifikasi/uji_logika.mjs` | Logika Edge Function kirim-notifikasi dengan penyedia tiruan (escape HTML, tautan aman, retry, 410, tanpa kunci → dilewati) | `node tests/notifikasi/uji_logika.mjs` |

Prasyarat: aplikasi disajikan di `http://localhost:8765` (`python3 -m http.server 8765` dari akar repo) dan Playwright + Chromium.
Pustaka pihak ketiga untuk uji luring diunduh sekali ke `tests/.cache/` (tidak di-commit):

```bash
mkdir -p tests/.cache/sb tests/.cache/cdn && cd tests/.cache
(cd sb && npm pack @supabase/supabase-js@2.45.4 && tar xzf *.tgz)
cd cdn && for p in pdfjs-dist@3.11.174 mammoth@1.8.0 tesseract.js@5.1.1 tesseract.js-core@5.1.1 @tesseract.js-data/ind@1.0.0 @tesseract.js-data/eng@1.0.0; do npm pack $p; done
for f in *.tgz; do d=${f%.tgz}; mkdir -p $d && tar xzf $f -C $d; done
```

`tests/server/rest-uji.js` adalah emulator kecil PostgREST/Auth/Storage (Node + `pg`) untuk pengujian lokal saja: JWT uji diteruskan sebagai `request.jwt.claims` sehingga RLS dan hak kolom yang diuji adalah milik basis data. Pasang dependensinya dengan `cd tests/server && npm ci`.
