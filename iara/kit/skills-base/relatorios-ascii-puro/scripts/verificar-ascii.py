#!/usr/bin/env python3
"""Confere se um relatorio entregue a Vytorya e ASCII PURO.

Uso:
    python3 verificar-ascii.py ARQ [ARQ ...]        # checa os arquivos
    python3 verificar-ascii.py ARQ --max 20         # limita as linhas ofensoras mostradas
    python3 verificar-ascii.py ARQ --silencioso     # so o resumo (bom para encadear em script)

Saida: bytes, linhas, palavras e as linhas OFENSORAS (numero da linha + coluna +
caractere + sugestao de transliteracao).
Exit 0 = ASCII puro, pode entregar. Exit 1 = achou caractere nao-ASCII, NAO entregar.

Por que existe: o olho nao pega. O relatorio de 22/09/2026 saiu com "volatil" acentuado
e outro termo com til; so a checagem programatica encontrou. O destino (chat do DeepSeek
dela / documento) corrompe o texto quando chega caractere acentuado ou decorativo.

Chamado pelo procedimento da skill ANTES de entregar qualquer relatorio:
    python3 ~/.hermes/skills/relatorios-ascii-puro/scripts/verificar-ascii.py \
        /mnt/shared/MyFiles/Hermes/<NOME>.txt
"""
from __future__ import annotations

import sys

# Caracteres decorativos que aparecem em relatorio escrito a mao (o exportador ja trata,
# mas texto escrito do zero escapa): travessao, seta, borda, bullet.
DECORATIVOS = {
    "\u2014": "-", "\u2013": "-", "\u2192": "-", "\u21d2": "-", "\u00b7": "-",
    "\u2022": "-", "\u2550": "=", "\u2500": "-", "\u201c": '"', "\u201d": '"',
    "\u2018": "'", "\u2019": "'", "\u2026": "...",
}


def sugerir(ch: str) -> str:
    """Diz o que fazer com o caractere ofensor."""
    if ch in DECORATIVOS:
        return f"trocar por '{DECORATIVOS[ch]}'"
    base = __import__("unicodedata").normalize("NFD", ch)
    limpo = "".join(c for c in base if not __import__("unicodedata").combining(c))
    if limpo and limpo != ch:
        return f"transliterar para '{limpo}'"
    return "remover ou substituir por ASCII"


def checar(caminho: str, max_linhas: int, silencioso: bool) -> tuple[int, int]:
    """Devolve (bytes_nao_ascii, linhas_com_problema)."""
    try:
        with open(caminho, "rb") as f:
            dados = f.read()
    except OSError as exc:
        print(f"ERRO ao abrir {caminho}: {exc}")
        return (1, 0)

    texto = dados.decode("utf-8", errors="replace")
    linhas = texto.splitlines()
    ofensoras: list[tuple[int, str, list[tuple[int, str]]]] = []
    total = 0

    for n, linha in enumerate(linhas, 1):
        ruins = [(i + 1, c) for i, c in enumerate(linha) if ord(c) > 127]
        if ruins:
            total += len(ruins)
            ofensoras.append((n, linha, ruins))

    if not silencioso:
        print(f"arquivo: {caminho}")
        print(f"  bytes: {len(dados)} | linhas: {len(linhas)} | palavras: {len(texto.split())}")
        print(f"  bytes nao-ASCII: {total}")

    if total == 0:
        if not silencioso:
            print("  RESULTADO: ASCII PURO (0 acento, 0 emoji, 0 seta, 0 linha decorativa)")
        else:
            print(f"OK  ASCII puro  {caminho}")
        return (0, 0)

    print(f"  RESULTADO: {total} caractere(s) nao-ASCII em {len(ofensoras)} linha(s) -> CORRIGIR")
    for n, linha, ruins in ofensoras[:max_linhas]:
        for col, ch in ruins[:6]:
            print(f"    linha {n}, coluna {col}: {ch!r} -> {sugerir(ch)}")
        print(f"      contexto: {linha[:90]}")
    if len(ofensoras) > max_linhas:
        print(f"    ... e mais {len(ofensoras) - max_linhas} linha(s)")
    return (total, len(ofensoras))


def main(argv: list[str]) -> int:
    if not argv:
        print("uso: verificar-ascii.py ARQ [ARQ ...] [--max N] [--silencioso]")
        return 2
    max_linhas = 10
    silencioso = "--silencioso" in argv
    argv = [a for a in argv if a != "--silencioso"]
    if "--max" in argv:
        i = argv.index("--max")
        try:
            max_linhas = int(argv[i + 1])
        except (IndexError, ValueError):
            max_linhas = 10
        del argv[i:i + 2]

    problemas = 0
    for caminho in argv:
        ruins, _ = checar(caminho, max_linhas, silencioso)
        problemas += 1 if ruins else 0

    if problemas:
        print(f"\nFALHOU: {problemas} arquivo(s) com caractere nao-ASCII. NAO entregar assim.")
        return 1
    print(f"\nOK: {len(argv)} arquivo(s) em ASCII puro.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
