"""Musik latar orisinal (disintesis dengan numpy; bebas lisensi): nuansa corporate technology.
python3 musik.py <keluar.wav> <durasi_detik> <gaya: promo|teknis>"""
import sys, wave, numpy as np
SR = 48000
out, dur, gaya = sys.argv[1], float(sys.argv[2]), sys.argv[3]
n = int(SR * dur); kiri = np.zeros(n); kanan = np.zeros(n)
bpm = 100 if gaya == 'promo' else 84
ketuk = 60 / bpm; birama = ketuk * 4
f = lambda m: 440 * 2 ** ((m - 69) / 12)
# progresi: Cmaj9 – Am9 – Fmaj7 – Gsus (diulang)
AKOR = [[48, 55, 59, 62, 64], [45, 52, 55, 59, 60], [41, 48, 52, 55, 57], [43, 50, 55, 57, 62]]
rng = np.random.default_rng(7)

def lpf(x, a):  # low-pass satu kutub
    y = np.empty_like(x); acc = 0.0
    # versi cepat dengan filter rekursif sederhana via cumulative (aproksimasi blok)
    from scipy.signal import lfilter  # noqa
    return lfilter([1 - a], [1, -a], x)

def tambah(buf, mulai, sig, gain=1.0):
    i = int(mulai * SR); j = min(n, i + len(sig))
    if i < n: buf[i:j] += sig[:j - i] * gain

def selubung(L, a, r):
    e = np.ones(L); A = int(a * SR); R = int(r * SR)
    if A: e[:A] = np.linspace(0, 1, A)
    if R: e[-R:] *= np.linspace(1, 0, R)
    return e

def intensitas(t):  # dinamika lagu
    if gaya == 'teknis': return 0.55
    if t < 12: return 0.35 + t / 12 * 0.25
    if dur - t < 12: return max(0.2, (dur - t) / 12)
    return 0.8

t = 0.0; k = 0
while t < dur:
    akor = AKOR[k % 4]; L = int(birama * SR) + int(1.2 * SR); tt = np.arange(L) / SR
    I = intensitas(t)
    # pad: gergaji ter-detune, low-pass
    pad = np.zeros(L)
    for m in akor:
        for d in (-0.08, 0.0, 0.07):
            fr = f(m + d); pad += 2 * ((tt * fr) % 1) - 1
    pad = lpf(pad / (len(akor) * 3), 0.985 if gaya == 'promo' else 0.99) * selubung(L, 0.6, 1.2)
    tambah(kiri, t, pad, 0.55 * I); tambah(kanan, t, np.roll(pad, 240), 0.55 * I)
    # bass
    b = np.sin(2 * np.pi * f(akor[0] - 12) * tt) * selubung(L, 0.02, 0.6)
    tambah(kiri, t, b, 0.22 * I); tambah(kanan, t, b, 0.22 * I)
    # arpeggio pluck seperdelapan
    langkah = 8 if gaya == 'promo' else 4
    for s in range(langkah):
        m = akor[[0, 2, 3, 4, 3, 2, 1, 2][s % 8]] + 12
        Lp = int(0.5 * SR); tp = np.arange(Lp) / SR
        pl = (np.sin(2 * np.pi * f(m) * tp) + 0.3 * np.sin(4 * np.pi * f(m) * tp)) * np.exp(-tp * 7)
        pan = 0.5 + 0.35 * np.sin(s)
        tambah(kiri, t + s * birama / langkah, pl, 0.16 * I * (1 - pan) * 2); tambah(kanan, t + s * birama / langkah, pl, 0.16 * I * pan * 2)
    # perkusi lembut (promo, setelah intro)
    if gaya == 'promo' and 10 < t < dur - 10:
        for s in range(4):
            Lk = int(0.35 * SR); tk = np.arange(Lk) / SR
            kick = np.sin(2 * np.pi * (50 + 90 * np.exp(-tk * 25)) * tk) * np.exp(-tk * 9)
            if s in (0, 2): tambah(kiri, t + s * ketuk, kick, 0.35 * I); tambah(kanan, t + s * ketuk, kick, 0.35 * I)
            hat = rng.standard_normal(int(0.06 * SR)) * np.exp(-np.arange(int(0.06 * SR)) / SR * 70)
            hat = hat - lpf(hat, 0.6)
            tambah(kiri, t + s * ketuk + ketuk / 2, hat, 0.05 * I); tambah(kanan, t + s * ketuk + ketuk / 2, hat, 0.06 * I)
    t += birama; k += 1

# reverb sederhana (beberapa tunda) dan normalisasi
for buf in (kiri, kanan):
    for dt, g in ((0.031, .25), (0.047, .2), (0.071, .15), (0.113, .1)):
        d = int(dt * SR); buf[d:] += buf[:-d] * g
st = np.stack([kiri, kanan], 1)
fade = int(2.5 * SR); st[:fade] *= np.linspace(0, 1, fade)[:, None]; st[-fade:] *= np.linspace(1, 0, fade)[:, None]
st = st / (np.max(np.abs(st)) + 1e-9) * 0.8
with wave.open(out, 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((st * 32767).astype('<i2').tobytes())
print('musik', out, dur)
