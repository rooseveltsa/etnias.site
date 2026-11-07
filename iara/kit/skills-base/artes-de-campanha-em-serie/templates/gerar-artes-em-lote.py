#!/usr/bin/env python3
"""Modelo: gerar N cards (design pessoal Vytorya) a partir de uma lista.

Copiar para ~/.hermes/scripts/ e editar a lista ATOS + SAIDA.
Cada item vira um JSON + um JPG no mesmo padrao do card aprovado.

Campos: slug (nome do arquivo), titulo, local, povo, data, detalhe, tags.
Uso:  ~/.pluma-venv/bin/python gerar-artes-em-lote.py
"""
import json
import subprocess
from pathlib import Path

BASE = Path.home()
GEN = BASE / "Hermes/Pexinxavel/P.L.U.M.A/Templates/pessoal-identidade/gerar-card.py"
VENV = BASE / ".pluma-venv/bin/python"
SAIDA = BASE / "Hermes/Agente-do-Caos/artes/LOTE"          # <- trocar

TAGS_IND = ["#ProtejamOsPovosIndígenas", "#DemarcaçãoJá"]
TAGS_DEM = ["#AtoPelaDemocracia", "#ProtejamOsPovosIndígenas"]

ATOS = [
    dict(slug="01-exemplo",
         titulo="DEFESA DOS POVOS INDÍGENAS",     # tema, caixa alta, ate 3 linhas
         local="BELÉM — PA · PRAÇA DA REPÚBLICA",  # CIDADE — UF · PRAÇA
         povo="POVOS ORIGINÁRIOS NAS RUAS",        # linha do meio (tema curto)
         data="DOMINGO 01/11/2026 · 9H",
         detalhe="Convocação: @perfil1, @perfil2 e @perfil3.",
         tags=TAGS_IND),
]

SAIDA.mkdir(parents=True, exist_ok=True)
for ato in ATOS:
    js = SAIDA / f"{ato['slug']}.json"
    dados = {k: v for k, v in ato.items() if k != "slug"}
    js.write_text(json.dumps(dados, ensure_ascii=False, indent=2), encoding="utf-8")
    out = SAIDA / f"{ato['slug']}.jpg"
    r = subprocess.run([str(VENV), str(GEN), str(js), str(out)],
                       capture_output=True, text=True)
    print(("OK  " if r.returncode == 0 else "ERRO") + f" {out.name}"
          + ("" if r.returncode == 0 else r.stderr[-200:]))
