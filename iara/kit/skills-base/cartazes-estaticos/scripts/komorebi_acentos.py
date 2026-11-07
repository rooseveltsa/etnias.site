#!/usr/bin/env python3
"""Texto em fonte display SEM acento nativo, com acentos montados.

Modelo testado com a Komorebi (VP Creative Shop), que mapeia Á-&gt;A no cmap e nao
tem @ # ? ! . , - / . Para outra fonte display, trocar KOMOREBI.

Como funciona:
  - desenha a letra base na fonte display;
  - desenha o acento como TRACO FINO no mesmo peso da haste (nao usa glifo de
    outra fonte, que fica grosso contra letras hairline);
  - til = faixa senoidal PREENCHIDA, levantada, porque o bico de "A" (corte
    stencil) engole marca desenhada perto;
  - pontuacao (@ # ? ! . , - / etc.) sai na DejaVu Sans a 62% do corpo.

API:
    desenhar(d, x, y, texto, tamanho, cor, tracking=0)
    largura_texto(d, texto, tamanho, tracking=0)
    quebrar(d, texto, tamanho, largura_max, tracking=0)

Antes de depurar acento, conferir a GRAFIA:
    [hex(ord(c)) for c in texto if ord(c) > 127]
"INDÍGENAS" tem acento so no I -- nao existe til no A.
"""
import math
import os
import unicodedata
from pathlib import Path

from PIL import ImageFont

KOMOREBI = Path(os.environ.get(
    "FONTE_DISPLAY",
    str(Path.home() / ".fonts/komorebi/Komorebi-PersonalUse.otf"),
))
SANS = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"

ACENTOS = {
    "Á": ("A", "agudo"), "À": ("A", "grave"), "Â": ("A", "circunflexo"), "Ã": ("A", "til"),
    "É": ("E", "agudo"), "È": ("E", "grave"), "Ê": ("E", "circunflexo"),
    "Í": ("I", "agudo"), "Ì": ("I", "grave"), "Î": ("I", "circunflexo"),
    "Ó": ("O", "agudo"), "Ò": ("O", "grave"), "Ô": ("O", "circunflexo"), "Õ": ("O", "til"),
    "Ú": ("U", "agudo"), "Ù": ("U", "grave"), "Û": ("U", "circunflexo"),
    "Ç": ("C", "cedilha"),
    "á": ("a", "agudo"), "ã": ("a", "til"), "â": ("a", "circunflexo"), "à": ("a", "grave"),
    "é": ("e", "agudo"), "ê": ("e", "circunflexo"), "í": ("i", "agudo"),
    "ó": ("o", "agudo"), "õ": ("o", "til"), "ô": ("o", "circunflexo"),
    "ú": ("u", "agudo"), "ç": ("c", "cedilha"),
}
PONTUACAO = set("@#&?!·:;,.()-—–/\\|°ºª*+=%$'\"")


def _marca(d, tipo, cx, topo_tinta, tamanho, cor):
    """Acento em traco fino, no peso da haste da fonte display."""
    esp = max(2, int(round(tamanho * 0.020)))
    h = max(6, int(tamanho * 0.10))
    w = max(8, int(tamanho * 0.14))
    y_base = topo_tinta - max(3, int(tamanho * 0.05))
    y_topo = y_base - h

    if tipo == "agudo":
        d.line([(cx - w * 0.55, y_base), (cx + w * 0.55, y_topo)], fill=cor, width=esp)
    elif tipo == "grave":
        d.line([(cx - w * 0.55, y_topo), (cx + w * 0.55, y_base)], fill=cor, width=esp)
    elif tipo == "circunflexo":
        d.line([(cx - w * 0.80, y_base), (cx, y_topo)], fill=cor, width=esp)
        d.line([(cx, y_topo), (cx + w * 0.80, y_base)], fill=cor, width=esp)
    elif tipo == "til":
        # faixa ondulada PREENCHIDA e elevada: sempre aparece
        y_topo -= int(h * 1.9)
        y_base -= int(h * 1.9)
        larg = w * 1.15
        esp_b = max(2.0, tamanho * 0.022)
        passos = 40
        cima, baixo = [], []
        for i in range(passos + 1):
            t = i / passos
            px = cx - larg + 2 * larg * t
            py = (y_topo + h * 0.55) + math.sin(t * math.pi * 2) * h * 0.32
            cima.append((px, py - esp_b / 2))
            baixo.append((px, py + esp_b / 2))
        d.polygon(cima + baixo[::-1], fill=cor)
    elif tipo == "cedilha":
        yb = topo_tinta + int(tamanho * 0.88)
        d.line([(cx, yb), (cx - w * 0.12, yb + h * 0.55)], fill=cor, width=esp)
        d.line([(cx - w * 0.12, yb + h * 0.55), (cx - w * 0.65, yb + h * 0.80)],
               fill=cor, width=esp)


def largura_texto(d, texto, tamanho, tracking=0.0):
    texto = unicodedata.normalize("NFC", texto)
    f = ImageFont.truetype(str(KOMOREBI), tamanho)
    fs = ImageFont.truetype(SANS, int(tamanho * 0.62))
    total = 0.0
    for ch in texto:
        base = ACENTOS.get(ch, (ch, None))[0]
        fonte = fs if ch in PONTUACAO else f
        total += d.textlength(base, font=fonte) + tracking
    return total - (tracking if texto else 0)


def desenhar(d, x, y, texto, tamanho, cor, tracking=0.0, altura_acento=None):
    texto = unicodedata.normalize("NFC", texto)
    f = ImageFont.truetype(str(KOMOREBI), tamanho)
    fs = ImageFont.truetype(SANS, int(tamanho * 0.62))
    cursor = x
    for ch in texto:
        base, marca = ACENTOS.get(ch, (ch, None))
        fonte = fs if ch in PONTUACAO else f
        w = d.textlength(base, font=fonte)
        if ch != " ":
            d.text((cursor, y), base, font=fonte, fill=cor)
            if marca:
                bb = d.textbbox((cursor, y), base, font=fonte)
                _marca(d, marca, (bb[0] + bb[2]) / 2, bb[1], tamanho, cor)
        cursor += w + tracking
    return cursor - x - (tracking if texto else 0)


def quebrar(d, texto, tamanho, largura_max, tracking=0.0):
    texto = unicodedata.normalize("NFC", texto)
    palavras, linhas, atual = texto.split(), [], []
    for p in palavras:
        teste = " ".join(atual + [p])
        if largura_texto(d, teste, tamanho, tracking) <= largura_max or not atual:
            atual.append(p)
        else:
            linhas.append(" ".join(atual))
            atual = [p]
    if atual:
        linhas.append(" ".join(atual))
    return linhas


if __name__ == "__main__":
    from PIL import Image, ImageDraw
    img = Image.new("RGB", (1000, 300), (44, 30, 22))
    d = ImageDraw.Draw(img)
    desenhar(d, 30, 60, "INDÍGENAS · SÓ DIA", 104, (255, 106, 19), tracking=4)
    desenhar(d, 30, 200, "DEMARCAÇÃO JÁ", 60, (244, 239, 231), tracking=3)
    img.save("/tmp/acentos-finos.png")
    print("ok -> /tmp/acentos-finos.png")
