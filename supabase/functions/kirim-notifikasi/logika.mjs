// Logika murni pengiriman notifikasi (tanpa jaringan) — dipakai index.ts dan diuji di Node.
// Semua akses jaringan diberikan lewat parameter `kirim` sehingga dapat diganti tiruan saat pengujian.

const LABEL = { insiden: 'Insiden', investigasi: 'Investigasi', capa: 'CAPA', izin: 'Izin kerja', kegiatan: 'Pelatihan & toolbox', sistem: 'Sistem' };

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** Tautan absolut ke aplikasi. Hanya tautan internal (#/...) yang diizinkan. */
export function tautanAbsolut(basis, tautan) {
  const b = String(basis || '').replace(/[#/]+$/, '') + '/';
  const t = String(tautan || '');
  return /^#?\/[\w\-/?=&.%]*$/.test(t) ? b + '#' + t.replace(/^#/, '') : b;
}

/** Templat email (HTML + teks polos). Tidak memuat data sensitif selain judul & ringkasan notifikasi. */
export function buatEmail(n, basis, namaAplikasi = 'HSE SAFETY FIRST') {
  const url = tautanAbsolut(basis, n.tautan);
  const kat = LABEL[n.kategori] || 'Notifikasi';
  const subjek = (n.wajib ? '[WAJIB] ' : '') + '[' + kat + '] ' + String(n.judul || '').slice(0, 150);
  const html = `<!doctype html><html lang="id"><body style="margin:0;background:#f3f5f7;font-family:Arial,Helvetica,sans-serif;color:#1d2733">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:10px;overflow:hidden">
<tr><td style="background:#0b5d3b;color:#ffffff;padding:16px 20px;font-weight:bold;letter-spacing:.5px">${esc(namaAplikasi)}</td></tr>
<tr><td style="padding:20px">
<p style="margin:0 0 6px;font-size:12px;color:#5b6775;text-transform:uppercase">${esc(kat)}${n.wajib ? ' · <strong style="color:#b42318">wajib</strong>' : ''}</p>
<h1 style="margin:0 0 12px;font-size:18px">${esc(n.judul)}</h1>
<p style="margin:0 0 18px;font-size:14px;line-height:1.5">Yth. ${esc(n.nama || 'Pengguna')},<br>${esc(n.isi)}</p>
<p style="margin:0 0 18px"><a href="${esc(url)}" style="display:inline-block;background:#0b5d3b;color:#ffffff;text-decoration:none;padding:10px 16px;border-radius:6px;font-weight:bold">Buka di aplikasi</a></p>
<p style="margin:0;font-size:12px;color:#5b6775">Email ini dikirim otomatis oleh sistem K3RS. Pengaturan email dapat diubah di menu Notifikasi → Pengaturan${n.wajib ? ', kecuali notifikasi wajib' : ''}. Jangan membalas email ini.</p>
</td></tr></table></td></tr></table></body></html>`;
  const teks = `${namaAplikasi}\n${kat}${n.wajib ? ' (WAJIB)' : ''}\n\n${n.judul}\n\nYth. ${n.nama || 'Pengguna'},\n${n.isi || ''}\n\nBuka: ${url}\n\nEmail otomatis — jangan dibalas.`;
  return { subjek, html, teks, url };
}

/** Isi pesan push (≤ 4 KB). */
export function buatPush(n, basis) {
  return JSON.stringify({ judul: String(n.judul || '').slice(0, 120), isi: String(n.isi || '').slice(0, 300), tautan: ('#' + String(tautanAbsolut('', n.tautan)).replace(/^\/#?/, '')).replace(/^#$/, '#/notifikasi'), url: tautanAbsolut(basis, n.tautan), tag: 'notif-' + n.notifikasi_id, wajib: !!n.wajib });
}

function pesanGalat(e) { return String((e && (e.message || e.body)) || e || 'galat').slice(0, 300); }

/**
 * Memproses satu batch dari public.notif_ambil(). Mengembalikan array hasil untuk public.notif_lapor().
 * kirim.email(item, surat) → resolve jika diterima penyedia; throw jika gagal (akan dicoba ulang).
 * kirim.push(langganan, payload) → resolve; throw dengan .statusCode 404/410 bila langganan kedaluwarsa.
 */
export async function prosesBatch(items, kirim, cfg) {
  const hasil = [];
  for (const it of items || []) {
    const r = { kirim_id: it.kirim_id };
    try {
      if (it.saluran === 'email') {
        if (!cfg.emailAktif) { r.status = 'dilewati'; r.galat = 'Saluran email belum dikonfigurasi (RESEND_API_KEY / NOTIF_EMAIL_DARI)'; }
        else if (!it.email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(it.email)) { r.status = 'dilewati'; r.galat = 'Alamat email penerima tidak valid'; }
        else { await kirim.email(it, buatEmail(it, cfg.basisUrl, cfg.namaAplikasi)); r.status = 'terkirim'; }
      } else if (it.saluran === 'push') {
        const subs = it.push || [];
        if (!cfg.pushAktif) { r.status = 'dilewati'; r.galat = 'Saluran push belum dikonfigurasi (kunci VAPID)'; }
        else if (!subs.length) { r.status = 'dilewati'; r.galat = 'Penerima tidak memiliki langganan push'; }
        else {
          const payload = buatPush(it, cfg.basisUrl); let berhasil = 0; const galat = []; const kedaluwarsa = [];
          for (const s of subs) {
            try { await kirim.push(s, payload); berhasil++; }
            catch (e) { if (e && (e.statusCode === 404 || e.statusCode === 410)) kedaluwarsa.push(s.endpoint); else galat.push(pesanGalat(e)); }
          }
          if (kedaluwarsa.length) r.hapus_endpoint = kedaluwarsa;               // langganan 404/410 dihapus oleh notif_lapor
          if (berhasil) r.status = 'terkirim';
          else if (galat.length) { r.status = 'gagal'; r.galat = galat[0]; }
          else { r.status = 'dilewati'; r.galat = 'Semua langganan push kedaluwarsa'; }
        }
      } else { r.status = 'dilewati'; r.galat = 'Saluran tidak dikenal'; }
    } catch (e) { r.status = 'gagal'; r.galat = pesanGalat(e); }
    hasil.push(r);
  }
  return hasil;
}

/** Bandingkan rahasia dengan waktu konstan. */
export function samaAman(a, b) {
  a = String(a || ''); b = String(b || '');
  if (!a || !b || a.length !== b.length) return false;
  let x = 0; for (let i = 0; i < a.length; i++) x |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return x === 0;
}
