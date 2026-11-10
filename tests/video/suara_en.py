"""English female narration with Kokoro-82M (official ONNX, voice af_heart) + per-scene timeline.
Usage: /opt/kokoro/venv/bin/python suara_en.py <workdir>   (writes <workdir>/audio_en/<v>/...)
"""
import json, os, subprocess, sys
import numpy as np, soundfile as sf
from kokoro_onnx import Kokoro

DIR = sys.argv[1]
SR = 24000
VOICE = os.environ.get('VOICE', 'af_heart')
SPEED = {'v1': 1.15, 'v2': 1.12}
LEAD = {'v1': 0.15, 'v2': 0.25}
TAIL = {'v1': 0.3, 'v2': 0.4}
GAP = 0.28          # natural breath between sentences
LONGGAP = 0.42      # after a sentence that contains two sentences
k = Kokoro('/opt/kokoro/model.onnx', '/opt/kokoro/voices.bin')
naskah = json.loads(subprocess.check_output(['node', '-e', "const n=require('" + os.path.join(os.path.dirname(os.path.abspath(__file__)), 'naskah_en.js') + "');console.log(JSON.stringify(n))"]))

def trim(a, thr=0.008, pad=0.03):
    idx = np.where(np.abs(a) > thr)[0]
    if not len(idx): return a
    s = max(0, idx[0] - int(pad * SR)); e = min(len(a), idx[-1] + int(pad * SR))
    return a[s:e]

for v in ('v1', 'v2'):
    out = os.path.join(DIR, 'audio_en', v); os.makedirs(out, exist_ok=True)
    garis, t = [], 0.0
    for sc in naskah[v.upper()]:
        bag, lokal = [], LEAD[v]; parts = []
        for i, s in enumerate(sc['s']):
            teks = s[2] if len(s) > 2 else s[0]
            a, sr = k.create(teks, voice=VOICE, speed=SPEED[v], lang='en-us')
            a = trim(np.asarray(a, dtype=np.float32))
            dur = len(a) / SR
            bag.append({'teks': s[0], 'id': s[1], 'mulai': round(lokal, 3), 'durasi': round(dur, 3)})
            parts.append((lokal, a))
            lokal += dur + (LONGGAP if s[0].count('. ') else GAP)
        total = lokal - (LONGGAP if sc['s'][-1][0].count('. ') else GAP) + TAIL[v]
        buf = np.zeros(int(total * SR) + 1, dtype=np.float32)
        for st, a in parts:
            i0 = int(st * SR); buf[i0:i0 + len(a)] += a
        mentah = os.path.join(out, sc['id'] + '_raw.wav'); sf.write(mentah, buf, SR)
        # Gentle mastering per scene: rumble cut, de-ess, light compression; loudness is normalised at final mix
        subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', mentah, '-af',
                        'aresample=48000:resampler=soxr,highpass=f=70,deesser=i=0.35:m=0.5:f=0.5,acompressor=threshold=-22dB:ratio=2.2:attack=8:release=120:makeup=1.5,equalizer=f=220:t=q:w=1:g=-1.5,equalizer=f=5000:t=q:w=1:g=1',
                        '-ac', '1', os.path.join(out, sc['id'] + '.wav')], check=True)
        os.remove(mentah)
        garis.append({'id': sc['id'], 'mulai': round(t, 3), 'durasi': round(total, 3), 'kalimat': bag}); t += total
    json.dump(garis, open(os.path.join(out, 'garis_waktu.json'), 'w'), indent=1, ensure_ascii=False)
    print(v, 'total %.1f s' % t, ' '.join('%s=%.1f' % (g['id'], g['durasi']) for g in garis))
