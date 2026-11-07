#!/usr/bin/env python3
"""Kit de design do etnias.site em uma folha 1080x1350."""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

W, H = 1080, 1350
FUNDO = (18, 13, 8)
BASE2 = (46, 37, 27)
COBRE = (197, 139, 86)
TERRA = (184, 74, 39)
CLARO = (242, 237, 228)
MUTE = (176, 160, 140)

ARCHIVO = "/home/anaobranca/.fonts/ArchivoBlack-Regular.ttf"
SANS = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
SANS_B = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
SANS_F = "/usr/share/fonts/truetype/dejavu/DejaVuSans-ExtraLight.ttf"

ASSETS = Path.home() / ".hermes/assets"
SAIDA = Path("/home/anaobranca/Hermes/Agente-do-Caos/artes/etnias-kit-2026-11/kit-design-etnias.jpg")

img = Image.new("RGB", (W, H), FUNDO)
d = ImageDraw.Draw(img)


def t(s, x, y, size, cor=CLARO, fonte=ARCHIVO, anchor="la"):
    f = ImageFont.truetype(fonte, size)
    d.text((x, y), s, font=f, fill=cor, anchor=anchor)
    return f


def wrap(s, x, y, size, cor, largura, fonte=SANS, entrelinha=1.35):
    f = ImageFont.truetype(fonte, size)
    palavras, linhas, atual = s.split(), [], []
    for p in palavras:
        teste = " ".join(atual + [p])
        if d.textlength(teste, font=f) <= largura or not atual:
            atual.append(p)
        else:
            linhas.append(" ".join(atual))
            atual = [p]
    if atual:
        linhas.append(" ".join(atual))
    for ln in linhas:
        d.text((x, y), ln, font=f, fill=cor)
        y += int(size * entrelinha)
    return y


# ---- topo
logo = Image.open(ASSETS / "opy-logo-correto.png").convert("RGBA")
lw = 96
lh = int(lw * logo.height / logo.width)
logo_r = logo.resize((lw, lh), Image.LANCZOS)
img.paste(logo_r, (60, 52), logo_r)
t("ETNIAS.SITE", 176, 56, 40)
t("KIT DE DESIGN", 176, 106, 22, COBRE, SANS_B)
d.rectangle([60, 176, W - 60, 180], fill=COBRE)

y = 210

# ---- paleta
t("PALETA", 60, y, 30, COBRE)
t("só estas quatro cores", 60 + 160, y + 6, 20, MUTE, SANS)
y += 52

cores = [
    ("#120D08", FUNDO, "fundo — dominante", CLARO),
    ("#2E251B", BASE2, "painéis e superfícies", CLARO),
    ("#C58B56", COBRE, "símbolo e destaque", FUNDO),
    ("#B84A27", TERRA, "ação, etiqueta, botão", CLARO),
]
cw, gap = 230, 13
for i, (hexv, rgb, uso, texto) in enumerate(cores):
    x = 60 + i * (cw + gap)
    d.rounded_rectangle([x, y, x + cw, y + 150], radius=16, fill=rgb,
                        outline=BASE2 if rgb == FUNDO else None, width=2)
    t(hexv, x + 18, y + 96, 22, texto)
    wrap(uso, x + 18, y + 160, 17, MUTE, cw, SANS)
y += 232

# ---- simbolos
t("SÍMBOLOS", 60, y, 30, COBRE)
y += 50
d.rounded_rectangle([60, y, 330, y + 190], radius=16, fill=BASE2)
lg = Image.open(ASSETS / "opy-logo-correto.png").convert("RGBA")
gw = 210
gh = int(gw * lg.height / lg.width)
img.paste(lg.resize((gw, gh), Image.LANCZOS), (60 + (270 - gw) // 2, y + 24), lg.resize((gw, gh), Image.LANCZOS))
t("Opy — símbolo principal", 76, y + 152, 18, MUTE, SANS)

d.rounded_rectangle([360, y, 630, y + 190], radius=16, fill=BASE2)
lk = Image.open(ASSETS / "etnias-logo-completo.png").convert("RGBA")
kw = 230
kh = int(kw * lk.height / lk.width)
img.paste(lk.resize((kw, kh), Image.LANCZOS), (360 + (270 - kw) // 2, y + 60), lk.resize((kw, kh), Image.LANCZOS))
t("lockup com o nome", 376, y + 152, 18, MUTE, SANS)

d.rounded_rectangle([660, y, W - 60, y + 190], radius=16, fill=COBRE)
casa = Image.open(ASSETS / "opy-logo-correto.png").convert("RGBA")
pw = 210
ph = int(pw * casa.height / casa.width)
cr = casa.resize((pw, ph), Image.LANCZOS)
apenas = Image.new("RGBA", cr.size, FUNDO + (255,))
apenas.putalpha(cr.split()[-1])
bx, bw = 660, W - 60 - 660
img.paste(apenas, (bx + (bw - pw) // 2, y + 18), apenas)
t("símbolo sobre cobre", 676, y + 152, 18, FUNDO, SANS)
y += 226

# ---- tipografia
t("TIPOGRAFIA", 60, y, 30, COBRE)
y += 50
d.rounded_rectangle([60, y, W - 60, y + 158], radius=16, fill=BASE2)
t("Aa", 88, y + 22, 92, CLARO)
t("Archivo Black", 246, y + 34, 34, CLARO)
t("títulos e números — 900, caixa alta, pouco espaço entre letras", 246, y + 86, 19, MUTE, SANS)
t("Aa", 88, y + 108, 52, COBRE, SANS_B)
t("Inter", 246, y + 122, 26, COBRE, SANS_B)
t("texto corrido e legendas — 400 e 500", 340, y + 128, 19, MUTE, SANS)
y += 176

# ---- aplicação
t("APLICAÇÃO", 60, y, 30, COBRE)
y += 50
mini = Path("/home/anaobranca/Hermes/Agente-do-Caos/artes/etnias-opy-2026-11/etnias-opy-04.jpg")
if mini.exists():
    m = Image.open(mini).convert("RGB")
    mh = 250
    mw = int(m.width * mh / m.height)
    img.paste(m.resize((mw, mh), Image.LANCZOS), (60, y))
    x2 = 60 + mw + 30
else:
    x2 = 60
regras = [
    "Fundo escuro domina a peça.",
    "Cobre no símbolo e no que precisa aparecer.",
    "Terracota só na ação: etiqueta, botão, chamada.",
    "Título grande, texto curto, muito respiro.",
    "Logo e @etnias.site sempre no topo.",
]
yy = y + 6
for r in regras:
    d.ellipse([x2, yy + 8, x2 + 9, yy + 17], fill=COBRE)
    yy = wrap(r, x2 + 24, yy, 19, CLARO, W - 60 - x2 - 24, SANS, 1.25) + 7

# ---- rodapé
d.rectangle([0, H - 100, W, H], fill=FUNDO)
d.rectangle([60, H - 96, W - 60, H - 93], fill=BASE2)
t("etnias.site · rede social indígena · @etnias.site", 60, H - 78, 20, MUTE, SANS)

SAIDA.parent.mkdir(parents=True, exist_ok=True)
img.save(SAIDA, quality=94)
print(SAIDA)
