#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""verificar-render.py — prova visual de um render (video ou imagem).

Extrai frames nos tempos pedidos, monta uma folha de contato rotulada e conta
pixels de cada cor esperada. Imprime relatorio ASCII.

Rode com um python que tenha PIL (o do sistema normalmente nao tem):

    ~/.pluma-venv/bin/python verificar-render.py final.mp4 \
        --tempos 0.3,1.2,2.9 --cor "#B84A27" --out /tmp/prova

    ~/.pluma-venv/bin/python verificar-render.py still.png \
        --cor "#B84A27" --out /tmp/prova

Sem --cor, so extrai frames e monta a folha.
Exit code 0 = tudo extraido e todas as cores apareceram (quando pedidas).
"""

import argparse
import os
import shutil
import subprocess
import sys

try:
    from PIL import Image, ImageDraw
except ModuleNotFoundError:
    sys.exit("PIL ausente neste python. Use ~/.pluma-venv/bin/python ou instale pillow num venv.")

TOLERANCIA = 30


def hex_para_rgb(h: str):
    h = h.strip().lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    if len(h) != 6:
        raise SystemExit("cor invalida: %r (use #RRGGBB)" % h)
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def extrair_frames(video: str, tempos, pasta: str):
    if not shutil.which("ffmpeg"):
        sys.exit("ffmpeg nao encontrado no PATH")
    saida = []
    for t in tempos:
        nome = os.path.join(pasta, "f-%05.2f.png" % t)
        cmd = ["ffmpeg", "-y", "-v", "error", "-ss", str(t), "-i", video,
               "-frames:v", "1", nome]
        r = subprocess.run(cmd, capture_output=True, text=True)
        if r.returncode != 0 or not os.path.exists(nome):
            print("  [FALHA] t=%s: %s" % (t, (r.stderr or "").strip()[:160]))
            continue
        saida.append((t, nome))
    return saida


def contar_cor(caminho: str, alvo, tol=TOLERANCIA):
    im = Image.open(caminho).convert("RGB")
    n = 0
    caixa = [im.width, im.height, 0, 0]
    for y in range(0, im.height, 2):
        for x in range(0, im.width, 2):
            p = im.getpixel((x, y))
            if all(abs(p[i] - alvo[i]) < tol for i in range(3)):
                n += 1
                caixa[0] = min(caixa[0], x)
                caixa[1] = min(caixa[1], y)
                caixa[2] = max(caixa[2], x)
                caixa[3] = max(caixa[3], y)
    return n * 4, (caixa if n else None)


def folha(frames, pasta: str, largura=320):
    if not frames:
        return None
    alturas = []
    ims = []
    for _, caminho in frames:
        im = Image.open(caminho).convert("RGB")
        alt = int(im.height * largura / im.width)
        ims.append(im.resize((largura, alt)))
        alturas.append(alt)
    alt = max(alturas) + 28
    sheet = Image.new("RGB", (largura * len(frames), alt), (255, 255, 255))
    d = ImageDraw.Draw(sheet)
    for i, (t, _) in enumerate(frames):
        sheet.paste(ims[i], (largura * i, 0))
        d.text((largura * i + 6, alturas[i] + 6), "t=%.2fs" % t, fill=(0, 0, 0))
    destino = os.path.join(pasta, "folha-contato.png")
    sheet.save(destino)
    return destino


def main():
    p = argparse.ArgumentParser(description="prova visual de render: frames + folha + cor")
    p.add_argument("entrada", help="video (mp4/mov/webm) ou imagem (png/jpg)")
    p.add_argument("--tempos", default="0.3,1.2,2.9", help="segundos separados por virgula")
    p.add_argument("--cor", action="append", default=[], help="hex a conferir (pode repetir)")
    p.add_argument("--tol", type=int, default=TOLERANCIA, help="tolerancia por canal (padrao 30)")
    p.add_argument("--out", default="/tmp/prova-render", help="pasta de saida")
    a = p.parse_args()

    if not os.path.isfile(a.entrada):
        sys.exit("entrada nao encontrada: " + a.entrada)
    os.makedirs(a.out, exist_ok=True)

    eh_video = a.entrada.lower().endswith((".mp4", ".mov", ".webm", ".mkv", ".gif"))
    if eh_video:
        tempos = [float(x) for x in a.tempos.split(",") if x.strip()]
        frames = extrair_frames(a.entrada, tempos, a.out)
    else:
        frames = [(0.0, a.entrada)]

    if not frames:
        sys.exit("nenhum frame extraido")

    print("frames: %d" % len(frames))
    falhou = False
    for cor in a.cor:
        alvo = hex_para_rgb(cor)
        print("cor %s -> %s" % (cor, alvo))
        for t, caminho in frames:
            n, caixa = contar_cor(caminho, alvo, a.tol)
            marca = "ok" if n else "AUSENTE"
            print("  t=%.2fs  %8d px  %-8s %s" % (t, n, marca, caixa or ""))
            if not n:
                falhou = True

    f = folha(frames, a.out)
    if f:
        print("folha de contato:", f)
    print("frames em:", a.out)
    sys.exit(1 if falhou else 0)


if __name__ == "__main__":
    main()
