// Merakit video final: klip adegan + transisi silang, narasi, musik ber-ducking, subtitle (ASS terbakar + SRT terpisah), H.264/AAC.
// node rakit.js <dir_kerja> <v1|v2> <keluar.mp4> <adegan_grafik_dipisah_koma>
const fs = require('fs'), path = require('path');
const { execFileSync } = require('child_process');
const [DIR, V, KELUAR, MGARG] = process.argv.slice(2);
const MG = new Set((MGARG || '').split(','));
const G = JSON.parse(fs.readFileSync(path.join(DIR, 'audio', V, 'garis_waktu.json')));
const TRANS = 0.4, KERJA = path.join(DIR, 'rakit_' + V); fs.mkdirSync(KERJA, { recursive: true });
const jalan = a => execFileSync('ffmpeg', ['-y', '-v', 'error', ...a], { maxBuffer: 1 << 26 });
const total = G.reduce((a, g) => a + g.durasi, 0);

// 1) Video: rantai xfade
const masuk = G.map(g => ['-i', path.join(DIR, 'klip', V, g.id + '.mp4')]).flat();
let filt = '', kini = '[0:v]', cum = 0;
G.forEach((g, i) => { if (i === 0) { cum = g.durasi; return; } const o = '[x' + i + ']'; filt += `${kini}[${i}:v]xfade=transition=${i % 3 === 0 ? 'smoothleft' : 'fade'}:duration=${TRANS}:offset=${cum.toFixed(3)}${o};`; kini = o; cum += g.durasi; });
filt += `${kini}format=yuv420p,trim=0:${total.toFixed(3)}[v]`;
const vid = path.join(KERJA, 'video.mp4');
jalan([...masuk, '-filter_complex', filt, '-map', '[v]', '-r', '30', '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', vid]);

// 2) Audio: narasi berurutan + musik ber-ducking
const daftar = path.join(KERJA, 'vo.txt'); fs.writeFileSync(daftar, G.map(g => "file '" + path.join(DIR, 'audio', V, g.id + '.wav') + "'").join('\n'));
const vo = path.join(KERJA, 'vo.wav'); jalan(['-f', 'concat', '-safe', '0', '-i', daftar, '-af', 'loudnorm=I=-16:TP=-1.5:LRA=7', '-ar', '48000', '-ac', '1', vo]);
const musik = path.join(DIR, 'audio', 'musik_' + V + '.wav'), campur = path.join(KERJA, 'campur.wav');
const volMusik = V === 'v1' ? 0.22 : 0.12;
jalan(['-i', vo, '-i', musik, '-filter_complex',
  `[1:a]atrim=0:${total.toFixed(3)},afade=t=out:st=${(total - 3).toFixed(3)}:d=3,volume=${volMusik}[m];[0:a]asplit=2[v1][v2];[v2]aformat=channel_layouts=stereo[sc];[m][sc]sidechaincompress=threshold=0.03:ratio=6:attack=40:release=500[md];[v1]aformat=channel_layouts=stereo[vs];[vs][md]amix=inputs=2:normalize=0:duration=first,loudnorm=I=-16:TP=-2:LRA=9,alimiter=limit=0.79:level=false[o]`,
  '-map', '[o]', '-ar', '48000', '-ac', '2', campur]);
fs.copyFileSync(vo, path.join(path.dirname(KELUAR), path.basename(KELUAR, '.mp4') + '_narasi.wav'));

// 3) Subtitle: pecah kalimat menjadi tayangan ≤ 2 baris × 46 karakter
const ts = (t, sep) => { const j = Math.floor(t / 3600), m = Math.floor(t % 3600 / 60), s = t % 60; return sep === ',' ? `${String(j).padStart(2, '0')}:${String(m).padStart(2, '0')}:${s.toFixed(3).padStart(6, '0').replace('.', ',')}` : `${j}:${String(m).padStart(2, '0')}:${s.toFixed(2).padStart(5, '0')}`; };
function bungkus(teks, maks = 46) { const kata = teks.split(' '), baris = []; let b = ''; for (const k of kata) { if ((b + ' ' + k).trim().length > maks) { baris.push(b.trim()); b = k; } else b += ' ' + k; } if (b.trim()) baris.push(b.trim()); return baris; }
const cue = []; let awal = 0;
G.forEach(g => { g.kalimat.forEach(k => { const baris = bungkus(k.teks); const grup = []; for (let i = 0; i < baris.length; i += 2) grup.push(baris.slice(i, i + 2)); const nch = grup.map(x => x.join(' ').length), tot = nch.reduce((a, b) => a + b, 0); let t = awal + k.mulai;
  grup.forEach((x, i) => { const d = k.durasi * nch[i] / tot; cue.push({ a: t, b: t + d - 0.05, teks: x, mg: MG.has(g.id) }); t += d; }); }); awal += g.durasi; });
const srt = cue.map((c, i) => `${i + 1}\n${ts(c.a, ',')} --> ${ts(c.b, ',')}\n${c.teks.join('\n')}\n`).join('\n');
const fSrt = path.join(path.dirname(KELUAR), path.basename(KELUAR, '.mp4') + '.srt'); fs.writeFileSync(fSrt, srt);
const ass = `[Script Info]\nScriptType: v4.00+\nPlayResX: 1920\nPlayResY: 1080\nWrapStyle: 2\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n` +
  `Style: Tengah,Inter,40,&H00FFFFFF,&H00FFFFFF,&H00101010,&H8C0E1726,0,0,0,0,100,100,0,0,3,14,0,2,160,160,46,1\n` +
  `Style: Kanan,Inter,38,&H00FFFFFF,&H00FFFFFF,&H00101010,&H8C0E1726,0,0,0,0,100,100,0,0,3,14,0,2,940,70,46,1\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n` +
  cue.map(c => `Dialogue: 0,${ts(c.a)},${ts(c.b)},${c.mg ? 'Tengah' : 'Kanan'},,0,0,0,,${c.teks.join('\\N')}`).join('\n') + '\n';
const fAss = path.join(KERJA, 'sub.ass'); fs.writeFileSync(fAss, ass);

// 4) Gabung: video + audio + subtitle terbakar; juga lampirkan subtitle lunak (mov_text)
jalan(['-i', vid, '-i', campur, '-i', fSrt, '-filter_complex', `[0:v]ass=${fAss}[v]`, '-map', '[v]', '-map', '1:a', '-map', '2:s', '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-r', '30',
  '-c:a', 'aac', '-b:a', '192k', '-c:s', 'mov_text', '-metadata:s:s:0', 'language=ind', '-metadata', 'title=' + path.basename(KELUAR, '.mp4'), '-movflags', '+faststart', '-shortest', KELUAR]);
console.log('selesai', KELUAR, total.toFixed(1), 'dtk,', cue.length, 'subtitle');
