#!/usr/bin/env python3
"""Converte um relatorio ASCII puro (.txt) em documento de texto (.docx).

Uso:
    ~/.pluma-venv/bin/python txt-para-docx.py ENTRADA.txt [SAIDA.docx]

Se SAIDA for omitida, troca a extensao do ENTRADA.

Por que existe: ela pede o relatorio em .txt (para colar no DeepSeek) e depois
pede "faca o relatorio em arquivo de texto". Nesse segundo pedido o que ela
quer e um documento abrivel (DOCX), com o MESMO conteudo do .txt. Nao refazer
a coleta: so reembalar.

Regras que fazem o ASCII sobreviver no Word/Google Docs:
- fonte monoespaçada (Courier New) e pequena (8.5 pt);
- margem estreita (0.6") para as linhas de ~72 colunas nao quebrarem;
- space_after/space_before = 0 e line_spacing 1.0: sem isso cada linha vira
  paragrafo com espaco e o alinhamento vertical se perde;
- linha vazia vira " " (espaco), nunca string vazia — paragrafo vazio colapsa.

Requer python-docx (~/.pluma-venv tem).
"""
import os
import sys

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.shared import Inches, Pt

MARCA = "=" * 60  # qualquer linha de borda com 10+ '=' conta como marca


def eh_marca(linha: str) -> bool:
    s = linha.strip()
    return len(s) >= 10 and set(s) == {"="}


def eh_titulo_secao(linha: str) -> bool:
    """'3. SETORES (quem responde o que)' — numero + texto em maiusculas."""
    s = linha.strip()
    if not s or not s[0].isdigit():
        return False
    cabeca = s.split(".", 1)[0]
    if not cabeca.isdigit():
        return False
    resto = s.split(".", 1)[1].strip() if "." in s else ""
    letras = [c for c in resto if c.isalpha()]
    return len(letras) > 3 and sum(c.isupper() for c in letras) / len(letras) > 0.7


def converter(origem: str, destino: str) -> tuple[int, int]:
    linhas = open(origem, encoding="utf-8").read().splitlines()

    doc = Document()
    sec = doc.sections[0]
    sec.left_margin = Inches(0.6)
    sec.right_margin = Inches(0.6)
    sec.top_margin = Inches(0.5)
    sec.bottom_margin = Inches(0.5)

    estilo = doc.styles["Normal"]
    estilo.font.name = "Courier New"
    estilo.font.size = Pt(8.5)
    estilo.paragraph_format.space_after = Pt(0)
    estilo.paragraph_format.space_before = Pt(0)
    estilo.paragraph_format.line_spacing = 1.0

    i = 0
    while i < len(linhas):
        linha = linhas[i]

        if eh_marca(linha):
            # bloco de titulo: marca / texto / marca -> um titulo centralizado
            if (i + 2 < len(linhas) and eh_marca(linhas[i + 2])
                    and linhas[i + 1].strip()):
                p = doc.add_paragraph()
                p.alignment = WD_ALIGN_PARAGRAPH.CENTER
                r = p.add_run(linhas[i + 1].strip())
                r.bold = True
                r.font.size = Pt(12)
                i += 3
                continue
            i += 1
            continue

        if eh_titulo_secao(linha):
            p = doc.add_paragraph()
            r = p.add_run(linha.strip())
            r.bold = True
            r.font.size = Pt(10)
            p.paragraph_format.space_before = Pt(6)
            i += 1
            continue

        p = doc.add_paragraph()
        r = p.add_run(linha if linha.strip() else " ")
        if linha.startswith(("FIM DO", "RELATORIO DE", "Arquivo:", "Gerado em")):
            r.bold = True
        i += 1

    doc.save(destino)
    return len(doc.paragraphs), os.path.getsize(destino)


def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__)
        return 2
    origem = sys.argv[1]
    destino = sys.argv[2] if len(sys.argv) > 2 else os.path.splitext(origem)[0] + ".docx"

    if not os.path.isfile(origem):
        print("ERRO: nao achei", origem)
        return 1

    # o .docx nao deve carregar acento do .txt (regra do ASCII puro)
    nao_ascii = {c for c in open(origem, encoding="utf-8").read() if ord(c) > 127}
    if nao_ascii:
        print("AVISO: o .txt tem caractere nao-ASCII:", sorted(nao_ascii))
        print("       corrija o .txt antes (verificar-ascii.py) e rode de novo.")

    paragrafos, tamanho = converter(origem, destino)
    print(f"ok: {destino}")
    print(f"paragrafos: {paragrafos} | bytes: {tamanho}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
