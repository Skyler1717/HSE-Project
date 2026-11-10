// Uji logika Edge Function kirim-notifikasi dengan penyedia tiruan (tanpa jaringan).
import { prosesBatch, buatEmail, buatPush, tautanAbsolut, samaAman, esc } from '../../supabase/functions/kirim-notifikasi/logika.mjs';
let n = 0, gagal = 0; const ok = (c, m) => { n++; if (!c) { gagal++; console.log('GAGAL', m); } else console.log('LULUS', m); };
const basis = 'https://skyler1717.github.io/HSE-Project/';
const it = (o) => Object.assign({ kirim_id: 1, saluran: 'email', notifikasi_id: 9, kategori: 'insiden', judul: 'Kejadian baru <b>IGD</b>', isi: 'Pasien jatuh', tautan: '/laporan/5', wajib: true, email: 'a@b.id', nama: 'Rina', push: [] }, o);

const e = buatEmail(it(), basis);
ok(e.subjek.startsWith('[WAJIB] [Insiden]'), 'subjek memuat penanda wajib & kategori');
ok(!e.html.includes('<b>IGD</b>') && e.html.includes('&lt;b&gt;IGD'), 'isi email di-escape (anti injeksi HTML)');
ok(e.url === basis + '#/laporan/5', 'tautan email menuju rute aplikasi');
ok(tautanAbsolut(basis, 'javascript:alert(1)') === basis && tautanAbsolut(basis, 'https://jahat.id') === basis, 'tautan eksternal/berbahaya diganti beranda');
ok(JSON.parse(buatPush(it(), basis)).tag === 'notif-9', 'payload push memiliki tag unik (tidak ganda di perangkat)');
ok(JSON.parse(buatPush(it(), basis)).tautan === '#/laporan/5' && JSON.parse(buatPush(it({ tautan: 'https://x.id' }), basis)).tautan === '#/notifikasi', 'tautan push sesuai format service worker');
ok(esc(`"'&`) === '&quot;&#39;&amp;', 'escape lengkap');
ok(samaAman('abc', 'abc') && !samaAman('abc', 'abd') && !samaAman('', '') && !samaAman('abc', 'abcd'), 'pembanding rahasia');

const terkirim = [];
const kirim = {
  async email(x, s) { if (x.email === 'down@b.id') throw new Error('Resend 503: unavailable'); terkirim.push(['email', x.kirim_id, s.subjek]); },
  async push(s) { if (s.endpoint === 'mati') { const g = new Error('gone'); g.statusCode = 410; throw g; } if (s.endpoint === 'galat') throw new Error('timeout'); terkirim.push(['push', s.endpoint]); },
};
const cfg = { basisUrl: basis, emailAktif: true, pushAktif: true };
let h = await prosesBatch([it({ kirim_id: 1 }), it({ kirim_id: 2, email: 'down@b.id' }), it({ kirim_id: 3, email: 'bukan-email' }),
  it({ kirim_id: 4, saluran: 'push', push: [{ endpoint: 'hidup' }, { endpoint: 'mati' }] }), it({ kirim_id: 5, saluran: 'push', push: [{ endpoint: 'mati' }] }),
  it({ kirim_id: 6, saluran: 'push', push: [{ endpoint: 'galat' }] }), it({ kirim_id: 7, saluran: 'push', push: [] })], kirim, cfg);
const s = Object.fromEntries(h.map(r => [r.kirim_id, r]));
ok(s[1].status === 'terkirim', 'email sukses → terkirim');
ok(s[2].status === 'gagal' && /503/.test(s[2].galat), 'galat penyedia → gagal (dicoba ulang oleh antrean)');
ok(s[3].status === 'dilewati', 'alamat tidak valid → dilewati, tidak dicoba ulang');
ok(s[4].status === 'terkirim' && s[4].hapus_endpoint.join() === 'mati', 'push: satu perangkat sukses, langganan 410 dihapus');
ok(s[5].status === 'dilewati' && s[5].hapus_endpoint.join() === 'mati', 'push: semua langganan kedaluwarsa → dilewati + dihapus');
ok(s[6].status === 'gagal', 'push timeout → gagal (dicoba ulang)');
ok(s[7].status === 'dilewati', 'tanpa langganan → dilewati');
ok(h.length === 7, 'satu hasil per entri antrean');

terkirim.length = 0;
h = await prosesBatch([it({ kirim_id: 1 }), it({ kirim_id: 2, saluran: 'push', push: [{ endpoint: 'hidup' }] })], kirim, { basisUrl: basis, emailAktif: false, pushAktif: false });
ok(terkirim.length === 0 && h.every(r => r.status === 'dilewati' && /belum dikonfigurasi/.test(r.galat)), 'tanpa kunci: tidak ada yang dikirim, status jujur "dilewati — belum dikonfigurasi"');

console.log(gagal ? `GAGAL ${gagal} dari ${n}` : `LULUS: ${n} pemeriksaan`); process.exitCode = gagal ? 1 : 0;
