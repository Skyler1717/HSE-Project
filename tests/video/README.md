# Produksi video HSE Project

Alat untuk membuat ulang kedua video, yaitu *Product Showcase* (≤ 3 menit) dan *Technical Architecture Documentary* (±7 menit), dari aplikasi asli dan data demonstrasi sintetis.

1. Siapkan basis data demonstrasi: `tests/video/siapkan_demo.sh`, lalu jalankan `UAT_DB=hse_demo UAT_TAG='[DEMO]' UAT_DOMAIN=demo.hse UAT_NAMA=Demo node tests/uat/uat_komite_k3.js` dan `node tests/video/persiapan_demo.js`.
2. Jalankan layanan uji: `PGDATABASE=hse_demo node tests/server/rest-uji.js 3101` dan `python3 -m http.server 8765` dari akar repositori.
3. Bangkitkan narasi: `node tests/video/suara.js <dir>` (memerlukan espeak-ng dan mbrola-id1). Bangkitkan musik: `python3 tests/video/musik.py <dir>/audio/musik_v1.wav 175 promo` (untuk Video 2 gunakan `musik_v2.wav 410 teknis`).
4. Rekam adegan: `node tests/video/produksi_v1.js <dir>` dan `node tests/video/produksi_v2.js <dir>` (Video 2 memerlukan highlight.js di `<dir>/hl` dan keluaran terminal di `<dir>/term`).
5. Rakit: `node tests/video/rakit.js <dir> v1 <keluar.mp4> v1s1,v1s2,v1s5,v1s7`. Untuk Video 2, ganti `v1` dengan `v2` dan isi daftar adegan grafik sesuai `docs/video`.
6. Jalankan pemeriksaan kualitas: `node tests/video/qc.js <dir>`. Lalu susun dokumen pendukung: `node tests/video/susun_dokumen.js <dir> <keluar.docx>`.

Narasi saat ini memakai suara sintetis luring. Untuk mengganti dengan pengisi suara manusia, rekam ulang tiap kalimat sesuai `naskah.js`, lalu jalankan ulang langkah 5.
