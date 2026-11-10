// Membangkitkan narasi (espeak-ng + MBROLA id1, luring) per kalimat dan menyusun garis waktu adegan.
// Keluaran: <dir>/<video>/<adegan>.wav (narasi adegan) dan <dir>/<video>/garis_waktu.json
const fs = require('fs'), path = require('path');
const { execFileSync } = require('child_process');
const { V1, V2, fonetik } = require('./naskah.js');
const DIR = process.argv[2]; const KEC = { v1: '168', v2: '152' };
const durasi = f => +execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString();
const JEDA = 0.36;
for (const [nama, V] of [['v1', V1], ['v2', V2]]) {
  const d = path.join(DIR, nama); fs.mkdirSync(d, { recursive: true }); const garis = []; let t = 0;
  for (const a of V) {
    const AWAL = nama === 'v1' ? 0.45 : 0.7, AKHIR = nama === 'v1' ? 0.55 : 0.9; const bag = []; let lokal = AWAL;
    a.kalimat.forEach((k, i) => {
      const mentah = path.join(d, a.id + '_' + i + '_m.wav'), olah = path.join(d, a.id + '_' + i + '.wav');
      execFileSync('espeak-ng', ['-v', 'mb-id1', '-s', KEC[nama], '-p', '45', '-w', mentah, fonetik(k)]);
      execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', mentah, '-af', 'aresample=48000,highpass=f=85,lowpass=f=7800,equalizer=f=180:t=q:w=1:g=2,equalizer=f=3000:t=q:w=1.2:g=3,acompressor=threshold=-20dB:ratio=3:attack=5:release=80,aecho=0.8:0.5:22:0.08,silenceremove=start_periods=1:start_threshold=-50dB:stop_periods=-1:stop_threshold=-50dB:stop_duration=0.3', '-ac', '1', olah]);
      const du = durasi(olah); bag.push({ i, teks: k, mulai: lokal, durasi: du, berkas: olah }); lokal += du + JEDA; fs.unlinkSync(mentah);
    });
    const total = lokal - JEDA + AKHIR;
    // gabungkan menjadi satu wav adegan dengan jeda
    const args = ['-y', '-v', 'error']; bag.forEach(b => args.push('-i', b.berkas));
    const filt = bag.map((b, i) => `[${i}]adelay=${Math.round(b.mulai * 1000)}|${Math.round(b.mulai * 1000)}[a${i}]`).join(';') + ';' + bag.map((_, i) => `[a${i}]`).join('') + `amix=inputs=${bag.length}:normalize=0,apad=whole_dur=${total.toFixed(3)}[o]`;
    args.push('-filter_complex', filt, '-map', '[o]', '-ar', '48000', '-ac', '1', path.join(d, a.id + '.wav'));
    execFileSync('ffmpeg', args);
    garis.push({ id: a.id, judul: a.judul, mulai: t, durasi: total, kalimat: bag.map(b => ({ teks: b.teks, mulai: b.mulai, durasi: b.durasi })) }); t += total;
  }
  fs.writeFileSync(path.join(d, 'garis_waktu.json'), JSON.stringify(garis, null, 1));
  console.log(nama, 'total', t.toFixed(1), 'dtk', garis.map(g => g.id + '=' + g.durasi.toFixed(1)).join(' '));
}
