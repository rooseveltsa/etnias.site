"""Gera os ícones do Android a partir de public_html/assets/opy/icon-512.png (rodar na pasta apps/mobile; precisa do Pillow)."""
import sys
from pathlib import Path
from PIL import Image, ImageDraw

src = Image.open(sys.argv[1] if len(sys.argv) > 1 else '../../public_html/assets/opy/icon-512.png').convert('RGBA')
bg = src.getpixel((4, 4))
res = Path('android/app/src/main/res')
for folder, legacy in {'mdpi': 48, 'hdpi': 72, 'xhdpi': 96, 'xxhdpi': 144, 'xxxhdpi': 192}.items():
    out = res / f'mipmap-{folder}'
    square = src.resize((legacy, legacy), Image.LANCZOS)
    square.save(out / 'ic_launcher.png')
    mask = Image.new('L', (legacy, legacy), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, legacy - 1, legacy - 1), fill=255)
    round_icon = Image.new('RGBA', (legacy, legacy), (0, 0, 0, 0))
    round_icon.paste(square, (0, 0), mask)
    round_icon.save(out / 'ic_launcher_round.png')
    # Adaptativo: camada de 108 dp; o desenho ocupa 72 dp no centro (zona segura de 66 dp + folga do fundo igual).
    full = legacy * 108 // 48
    inner = full * 72 // 108
    fg = Image.new('RGBA', (full, full), bg)
    fg.paste(src.resize((inner, inner), Image.LANCZOS), ((full - inner) // 2, (full - inner) // 2))
    fg.save(out / 'ic_launcher_foreground.png')
color = '#%02X%02X%02X' % bg[:3]
(res / 'values/ic_launcher_background.xml').write_text(f'<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">{color}</color>\n</resources>\n')
print('ícones gerados, fundo', color)

# Tela de abertura: fundo da marca com a casa no centro (40% do lado menor), em todas as densidades já criadas.
for splash in res.glob('drawable*/splash.png'):
    w, h = Image.open(splash).size
    side = min(w, h) * 2 // 5
    canvas = Image.new('RGBA', (w, h), bg)
    canvas.paste(src.resize((side, side), Image.LANCZOS), ((w - side) // 2, (h - side) // 2))
    canvas.convert('RGB').save(splash)
print('abertura gerada')
