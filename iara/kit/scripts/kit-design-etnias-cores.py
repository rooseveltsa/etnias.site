#!/usr/bin/env python3
"""Kit de design do etnias.site — uma folha por cor de predominancia."""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

W, H = 1080, 1350
FUNDO = (18, 13, 8)
BASE2 = (46, 37, 27)
COBRE = (197, 139, 86)
TERRA = (184, 74, 39)
CLARO = (242, 237, 228)

ARCHIVO = "/home/anaobranca/.fonts/ArchivoBlack-Regular.ttf"
SANS = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
SANS_B = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

ASSETS = Path.home() / ".hermes/assets"
SAIDA_DIR = Path("/home/anaobranca/Hermes/Agente-do-Caos/artes/etnias-kit-2026-11")

CORES = [
    ("#120D08", FUNDO, "fundo — dominante"),
    ("#2E251B", BASE2, "painéis e superfícies"),
    ("#C58B56", COBRE, "símbolo e destaque"),
    ("#B84A27", TERRA, "ação, etiqueta, botão"),
]


def logo_pintado(cor, larg):
    base = Image.open(ASSETS / "opy-logo-correto.png").convert("RGBA")
    alt = int(larg * base.height / base.width)
    base = base.resize((larg, alt), Image.LANCZOS)
    pint = Image.new("RGBA", base.size, cor + (255,))
    pint.putalpha(base.split()[-1])
    return pint


def montar(pal, nome_arquivo):
    bg = pal["bg"]
    ink = pal["ink"]
    sub = pal["sub"]
    box = pal["box"]
    box_ink = pal["box_ink"]
    box_sub = pal["box_sub"]
    secao = pal["secao"]

    img = Image.new("RGB", (W, H), bg)
    d = ImageDraw.Draw(img)

    def t(s, x, y, size, cor=ink, fonte=ARCHIVO):
        f = ImageFont.truetype(fonte, size)
        d.text((x, y), s, font=f, fill=cor)
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

    # topo
    cor_topo = FUNDO if bg == COBRE else COBRE
    lg = logo_pintado(cor_topo, 96)
    if cor_topo == COBRE:
        d.rounded_rectangle([46, 40, 46 + lg.width + 30, 40 + lg.height + 30], radius=14, fill=BASE2)
    img.paste(lg, (60, 52), lg)
    t("ETNIAS.SITE", 176, 56, 40)
    t("KIT DE DESIGN", 176, 106, 22, pal["sub2"], SANS_B)
    d.rectangle([60, 176, W - 60, 180], fill=secao)

    y = 210
    t("PALETA", 60, y, 30, secao)
    t("só estas quatro cores", 220, y + 6, 20, sub, SANS)
    y += 52

    cw, gap = 230, 13
    for i, (hexv, rgb, uso) in enumerate(CORES):
        x = 60 + i * (cw + gap)
        borda = None if rgb != bg else box_sub
        d.rounded_rectangle([x, y, x + cw, y + 150], radius=16, fill=rgb, outline=borda, width=2)
        lum = 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]
        cor_hex = FUNDO if lum > 120 else CLARO
        t(hexv, x + 18, y + 96, 22, cor_hex)
        wrap(uso, x + 18, y + 160, 17, sub, cw, SANS)
    y += 232

    t("SÍMBOLOS", 60, y, 30, secao)
    y += 50
    maior = CORES[0][1] if bg == CORES[0][1] else None

    # quatro caixas de simbolo: painel, cor dominante, laranja (detalhe) e lockup
    def caixa_simbolo(x, largura, fundo_caixa, rotulo, cor_rotulo, cor_logo, borda=None):
        d.rounded_rectangle([x, y, x + largura, y + 172], radius=16, fill=fundo_caixa,
                            outline=(borda if borda else (box_sub if fundo_caixa == bg else None)), width=3)
        alvo = largura - 52
        s1 = logo_pintado(cor_logo, alvo)
        img.paste(s1, (x + (largura - s1.width) // 2, y + 26), s1)
        t(rotulo, x + 14, y + 140, 16, cor_rotulo, SANS)

    larg = 222
    xs = [60, 60 + larg + 16, 60 + 2 * (larg + 16), 60 + 3 * (larg + 16)]
    caixa_simbolo(xs[0], larg, BASE2, "no painel", box_sub, COBRE)
    caixa_simbolo(xs[1], larg, bg, "cor dominante", sub, (COBRE if bg == BASE2 else BASE2))
    caixa_simbolo(xs[2], larg, BASE2, "laranja · detalhe", box_sub, TERRA)
    d.rounded_rectangle([xs[3], y, xs[3] + larg, y + 172], radius=16, fill=BASE2)
    lk = Image.open(ASSETS / "etnias-logo-completo.png").convert("RGBA")
    pint = Image.new("RGBA", lk.size, TERRA + (255,))
    pint.putalpha(lk.split()[-1])
    kw = 158
    kh = int(kw * pint.height / pint.width)
    pint = pint.resize((kw, kh), Image.LANCZOS)
    img.paste(pint, (xs[3] + (larg - kw) // 2, y + 68), pint)
    t("lockup em laranja", xs[3] + 14, y + 140, 16, box_sub, SANS)

    y += 200

    t("TIPOGRAFIA", 60, y, 30, secao)
    y += 50
    d.rounded_rectangle([60, y, W - 60, y + 212], radius=16, fill=box)
    t("Aa", 92, y + 16, 84, box_ink)
    t("Archivo Black", 252, y + 28, 34, box_ink)
    t("títulos e números — peso máximo, caixa alta", 252, y + 80, 19, box_sub, SANS)
    d.rectangle([92, y + 126, W - 92, y + 128], fill=box_sub)
    t("Aa", 92, y + 138, 56, COBRE, SANS_B)
    t("Inter", 252, y + 146, 26, COBRE, SANS_B)
    t("texto corrido e legendas — 400 e 500", 346, y + 152, 19, box_sub, SANS)
    y += 236

    t("APLICAÇÃO", 60, y, 30, secao)
    y += 50
    mini = Path("/home/anaobranca/Hermes/Agente-do-Caos/artes/etnias-opy-2026-11/etnias-opy-04.jpg")
    x2 = 60
    if mini.exists():
        m = Image.open(mini).convert("RGB")
        mh = 178
        mw = int(m.width * mh / m.height)
        img.paste(m.resize((mw, mh), Image.LANCZOS), (60, y))
        x2 = 60 + mw + 30
    regras = [
        "Fundo escuro domina a peça.",
        "Cobre no símbolo e no destaque.",
        "Terracota só na ação.",
        "Título grande, texto curto.",
        "Logo e @ no topo, sempre.",
    ]
    yy = y + 6
    for r in regras:
        d.ellipse([x2, yy + 8, x2 + 9, yy + 17], fill=secao)
        yy = wrap(r, x2 + 24, yy, 19, ink, W - 60 - x2 - 24, SANS, 1.2) + 5

    # rodapé
    d.rectangle([0, H - 100, W, H], fill=bg)
    d.rectangle([60, H - 96, W - 60, H - 93], fill=ink)
    d.text((60, H - 78), "etnias.site · rede social indígena · @etnias.site",
           font=ImageFont.truetype(SANS, 20), fill=sub)

    destino = SAIDA_DIR / nome_arquivo
    destino.parent.mkdir(parents=True, exist_ok=True)
    img.save(destino, quality=94)
    print(destino)


PALETAS = [
    (dict(bg=FUNDO, ink=CLARO, sub=(176, 160, 140), sub2=COBRE, box=BASE2,
          box_ink=CLARO, box_sub=(176, 160, 140), secao=COBRE, logo_cor=COBRE),
     "kit-design-etnias-escuro.jpg"),
    (dict(bg=COBRE, ink=FUNDO, sub=(46, 37, 27), sub2=FUNDO, box=FUNDO,
          box_ink=CLARO, box_sub=(176, 160, 140), secao=FUNDO, logo_cor=FUNDO),
     "kit-design-etnias-cobre.jpg"),
    (dict(bg=TERRA, ink=CLARO, sub=(250, 224, 208), sub2=CLARO, box=FUNDO,
          box_ink=CLARO, box_sub=(200, 180, 165), secao=CLARO, logo_cor=FUNDO),
     "kit-design-etnias-terracota.jpg"),
    (dict(bg=BASE2, ink=CLARO, sub=(196, 180, 158), sub2=COBRE, box=FUNDO,
          box_ink=CLARO, box_sub=(180, 165, 145), secao=COBRE, logo_cor=COBRE),
     "kit-design-etnias-marrom.jpg"),
]

if __name__ == "__main__":
    for pal, nome in PALETAS:
        montar(pal, nome)
