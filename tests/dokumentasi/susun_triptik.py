# Gabungkan tangkapan tiga tema per langkah menjadi satu gambar berlabel (Bentenan | Navy | Aksesibel).
# python3 susun_triptik.py <dir_rekam> <dir_keluar>
import json, os, sys
from PIL import Image, ImageDraw, ImageFont

SRC, OUT = sys.argv[1], sys.argv[2]
os.makedirs(OUT, exist_ok=True)
TEMA = [('bentenan', 'Bentenan Merah & Putih'), ('navy', 'Navy & Putih'), ('aksesibel', 'Aksesibel')]
W, GAP, LBL = 470, 18, 40
try:
    F = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 22)
except Exception:
    F = ImageFont.load_default()
man = json.load(open(os.path.join(SRC, 'manifest.json')))
hilang = []; dims = {}
for f in man:
    for l in f['langkah']:
        ims = []
        for t, _ in TEMA:
            p = os.path.join(SRC, t, l['kode'] + '.jpg')
            ims.append(Image.open(p).convert('RGB') if os.path.exists(p) else None)
            if not os.path.exists(p): hilang.append(t + '/' + l['kode'])
        if not any(ims): continue
        h = max(int(im.height * W / im.width) for im in ims if im)
        c = Image.new('RGB', (3 * W + 2 * GAP, h + LBL), 'white'); d = ImageDraw.Draw(c)
        for i, (im, (_, nama)) in enumerate(zip(ims, TEMA)):
            x = i * (W + GAP)
            tw = d.textlength(nama, font=F); d.text((x + (W - tw) / 2, 8), nama, fill='#222222', font=F)
            if im:
                c.paste(im.resize((W, int(im.height * W / im.width)), Image.LANCZOS), (x, LBL))
                d.rectangle([x, LBL, x + W - 1, LBL + h - 1], outline='#9AA0A6', width=2)
            else:
                d.text((x + 20, LBL + 40), 'SCREENSHOT REQUIRED', fill='#B00020', font=F)
        c.save(os.path.join(OUT, l['kode'] + '.jpg'), quality=80, optimize=True); dims[l['kode']] = c.size
json.dump(dims, open(os.path.join(OUT, 'dims.json'), 'w'))
print('selesai; hilang:', hilang or '-')
