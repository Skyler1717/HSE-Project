// Assemble the English-narrated versions: scene clips + crossfades, female narration, ducked music,
// premium Indonesian subtitles (burned in + soft track + .srt). H.264/AAC MP4.
// node rakit_en.js <workdir> <v1|v2> <out.mp4> <motion-graphic scene ids, comma separated>
const fs = require('fs'), path = require('path');
const { execFileSync } = require('child_process');
const [DIR, V, KELUAR, MGARG] = process.argv.slice(2);
const AUDIO = path.join(DIR, 'audio_en'), KLIP = path.join(DIR, 'klip_en', V);
const G = JSON.parse(fs.readFileSync(path.join(AUDIO, V, 'garis_waktu.json')));
const TRANS = 0.4, KERJA = path.join(DIR, 'rakit_en_' + V); fs.mkdirSync(KERJA, { recursive: true });
const jalan = a => execFileSync('ffmpeg', ['-y', '-v', 'error', ...a], { maxBuffer: 1 << 26 });
const total = G.reduce((a, g) => a + g.durasi, 0);

// 1) Video: crossfade chain; slight grade (contrast/saturation) for a cleaner corporate look
const masuk = G.map(g => ['-i', path.join(KLIP, g.id + '.mp4')]).flat();
let filt = '', kini = '[0:v]', cum = 0;
G.forEach((g, i) => { if (i === 0) { cum = g.durasi; return; } const o = '[x' + i + ']'; filt += `${kini}[${i}:v]xfade=transition=${i % 3 === 0 ? 'smoothleft' : 'fade'}:duration=${TRANS}:offset=${cum.toFixed(3)}${o};`; kini = o; cum += g.durasi; });
filt += `${kini}eq=contrast=1.03:saturation=1.04,format=yuv420p,trim=0:${total.toFixed(3)}[v]`;
const vid = path.join(KERJA, 'video.mp4');
if (!process.env.HANYA_SUB && !process.env.HANYA_MUX) jalan([...masuk, '-filter_complex', filt, '-map', '[v]', '-r', '30', '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', vid]);

// 2) Audio: narration + music ducked under the voice; loudness -16 LUFS, peak-limited
const daftar = path.join(KERJA, 'vo.txt'); fs.writeFileSync(daftar, G.map(g => "file '" + path.join(AUDIO, V, g.id + '.wav') + "'").join('\n'));
const vo = path.join(KERJA, 'vo.wav'); if (!process.env.HANYA_SUB && !process.env.HANYA_MUX) jalan(['-f', 'concat', '-safe', '0', '-i', daftar, '-af', 'loudnorm=I=-16:TP=-2:LRA=7', '-ar', '48000', '-ac', '1', vo]);
const musik = path.join(AUDIO, 'musik_' + V + '.wav'), campur = path.join(KERJA, 'campur.wav');
const volMusik = V === 'v1' ? 0.16 : 0.09;
if (!process.env.HANYA_SUB && !process.env.HANYA_MUX) jalan(['-i', vo, '-i', musik, '-filter_complex',
  `[1:a]atrim=0:${total.toFixed(3)},afade=t=in:st=0:d=1.5,afade=t=out:st=${(total - 3).toFixed(3)}:d=3,volume=${volMusik}[m];[0:a]asplit=2[v1][v2];[v2]aformat=channel_layouts=stereo[sc];[m][sc]sidechaincompress=threshold=0.025:ratio=7:attack=30:release=450[md];[v1]aformat=channel_layouts=stereo,afade=t=in:st=0:d=0.05[vs];[vs][md]amix=inputs=2:normalize=0:duration=first,loudnorm=I=-16:TP=-2:LRA=8,alimiter=limit=0.79:level=false[o]`,
  '-map', '[o]', '-ar', '48000', '-ac', '2', campur]);
fs.copyFileSync(vo, KELUAR.replace(/\.mp4$/, '_narration.wav'));

// 3) Indonesian subtitles: ≤ 2 balanced lines, split at natural boundaries, timed to the English speech
const MAKS = 44;
function seimbang(teks) { // break into 1–2 balanced lines
  if (teks.length <= MAKS) return [teks];
  const kata = teks.split(' '); let best = null;
  for (let i = 1; i < kata.length; i++) { const a = kata.slice(0, i).join(' '), b = kata.slice(i).join(' '); const skor = Math.max(a.length, b.length) - (/[,;:]$/.test(a) ? 6 : 0); if (a.length <= MAKS + 4 && b.length <= MAKS + 4 && (!best || skor < best[0])) best = [skor, [a, b]]; }
  return best ? best[1] : [teks];
}
function potong(teks) { // chunks that each fit in two lines; prefer sentence/clause boundaries
  if (teks.length <= MAKS * 2) return [teks];
  const klausa = teks.match(/[^.;:]+[.;:]?|[^,]+,?/g).map(s => s.trim()).filter(Boolean);
  const out = []; let cur = '';
  for (const k of teks.split(/(?<=[.;:])\s+/)) {
    if ((cur + ' ' + k).trim().length <= MAKS * 2) cur = (cur + ' ' + k).trim();
    else { if (cur) out.push(cur); cur = k; }
  }
  if (cur) out.push(cur);
  return out.flatMap(c => { if (c.length <= MAKS * 2) return [c]; const b = c.split(/(?<=,)\s+/); const r = []; let x = ''; for (const s of b) { if ((x + ' ' + s).trim().length <= MAKS * 2) x = (x + ' ' + s).trim(); else { if (x) r.push(x); x = s; } } if (x) r.push(x); return r; }).flatMap(c => { if (c.length <= MAKS * 2) return [c]; const w = c.split(' '), n = Math.ceil(c.length / (MAKS * 1.8)), per = Math.ceil(w.length / n), r = []; for (let i = 0; i < w.length; i += per) r.push(w.slice(i, i + per).join(' ')); return r; });
}
const cue = []; let awal = 0;
G.forEach(g => { g.kalimat.forEach(k => { const bag = potong(k.id); const n = bag.map(x => x.length), tot = n.reduce((a, b) => a + b, 0); let t = awal + k.mulai;
  bag.forEach((x, i) => { const d = k.durasi * n[i] / tot; cue.push({ a: t, b: t + d + (i === bag.length - 1 ? 0.15 : -0.04), baris: seimbang(x) }); t += d; }); }); awal += g.durasi; });
for (let i = 0; i + 1 < cue.length; i++) if (cue[i].b > cue[i + 1].a - 0.02) cue[i].b = cue[i + 1].a - 0.02; // never overlap
const ts = (t, srt) => { const j = Math.floor(t / 3600), m = Math.floor(t % 3600 / 60), s = t % 60; return srt ? `${String(j).padStart(2, '0')}:${String(m).padStart(2, '0')}:${s.toFixed(3).padStart(6, '0').replace('.', ',')}` : `${j}:${String(m).padStart(2, '0')}:${s.toFixed(2).padStart(5, '0')}`; };
fs.writeFileSync(KELUAR.replace(/\.mp4$/, '_ID.srt'), cue.map((c, i) => `${i + 1}\n${ts(c.a, 1)} --> ${ts(c.b, 1)}\n${c.baris.join('\n')}\n`).join('\n'));
// Two layers: one soft rounded translucent plate (sized from real font metrics), then warm-white bold text with restrained depth
const FONT = execFileSync('fc-match', ['-f', '%{file}', 'Inter:bold']).toString();
const semua = [...new Set(cue.flatMap(c => c.baris))];
const lebar = JSON.parse(execFileSync('python3', ['-c', 'import sys,json\nfrom PIL import ImageFont\nf=ImageFont.truetype(sys.argv[1],42)\nprint(json.dumps([f.getlength(t)+0.6*len(t) for t in json.load(sys.stdin)]))', FONT], { input: JSON.stringify(semua) }).toString());
const L = Object.fromEntries(semua.map((t, i) => [t, lebar[i]]));
const DASAR = 1080 - 56, PAD_X = 34, PAD_Y = 14, TINGGI_BARIS = 52, R = 18;
function pelat(w, h) { const x0 = 0, x1 = w, y0 = 0, y1 = h, r = R, c = 0.55 * r; const f = n => n.toFixed(1);
  return `m ${f(x0 + r)} ${f(y0)} l ${f(x1 - r)} ${f(y0)} b ${f(x1 - r + c)} ${f(y0)} ${f(x1)} ${f(y0 + r - c)} ${f(x1)} ${f(y0 + r)} l ${f(x1)} ${f(y1 - r)} b ${f(x1)} ${f(y1 - r + c)} ${f(x1 - r + c)} ${f(y1)} ${f(x1 - r)} ${f(y1)} l ${f(x0 + r)} ${f(y1)} b ${f(x0 + r - c)} ${f(y1)} ${f(x0)} ${f(y1 - r + c)} ${f(x0)} ${f(y1 - r)} l ${f(x0)} ${f(y0 + r)} b ${f(x0)} ${f(y0 + r - c)} ${f(x0 + r - c)} ${f(y0)} ${f(x0 + r)} ${f(y0)}`; }
const ass = `[Script Info]\nScriptType: v4.00+\nPlayResX: 1920\nPlayResY: 1080\nWrapStyle: 2\nScaledBorderAndShadow: yes\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n` +
  `Style: Pelat,Inter,42,&H5C0A111C,&H5C0A111C,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,7,0,0,0,1\n` +
  `Style: Teks,Inter,42,&H00EEF4FA,&H00EEF4FA,&H8C0B0F18,&H7A000000,1,0,0,0,100,100,0.6,0,1,1.1,2.2,2,150,150,0,1\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n` +
  cue.map(c => { const t = c.baris.join('\\N'); const w = Math.max(...c.baris.map(x => L[x])) + 2 * PAD_X, h = c.baris.length * TINGGI_BARIS + 2 * PAD_Y;
    return `Dialogue: 0,${ts(c.a)},${ts(c.b)},Pelat,,0,0,0,,{\\fad(140,140)\\blur1.2\\an7\\pos(${(960 - w / 2).toFixed(1)},${(DASAR - h).toFixed(1)})\\p1}${pelat(w, h)}{\\p0}\nDialogue: 1,${ts(c.a)},${ts(c.b)},Teks,,0,0,0,,{\\fad(140,140)\\blur0.5\\an2\\pos(960,${DASAR - PAD_Y + 4})}${t}`; }).join('\n') + '\n';
const fAss = path.join(KERJA, 'sub.ass'); fs.writeFileSync(fAss, ass);
if (process.env.HANYA_SUB) { console.log('sub only', fAss); process.exit(0); }

// 4) Mux: burned subtitles + soft subtitle track + audio
jalan(['-i', vid, '-i', campur, '-i', KELUAR.replace(/\.mp4$/, '_ID.srt'), '-filter_complex', `[0:v]ass=${fAss}[v]`, '-map', '[v]', '-map', '1:a', '-map', '2:s', '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-r', '30',
  '-c:a', 'aac', '-b:a', '192k', '-c:s', 'mov_text', '-metadata:s:s:0', 'language=ind', '-metadata', 'title=' + path.basename(KELUAR, '.mp4'), '-movflags', '+faststart', '-shortest', KELUAR]);
console.log('done', KELUAR, total.toFixed(1), 's,', cue.length, 'subtitle cues');
