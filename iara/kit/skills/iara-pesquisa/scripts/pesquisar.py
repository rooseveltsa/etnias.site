#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""pesquisar.py — dossie a partir das FONTES MANUAIS do dono. Local, sem rede.

O que faz:
  le ~/.hermes/iara-data/fontes/*.txt e *.md, procura o tema por palavra-chave,
  extrai trechos (ate 500 chars) com arquivo + linha de origem e grava um
  dossie em ~/.hermes/iara-data/dossies.json (acrescenta, nunca substitui).

O que NAO faz:
  nao acessa web, nao le credencial, e **nao inventa** conteudo. Sem fonte,
  o dossie sai com sem_fonte=true, status="pendente_fonte" e trechos=[].

    pesquisar.py --tema "letramento" --profundidade rapida
    pesquisar.py --tema "astronomia" --profundidade rapida   # sem_fonte
    pesquisar.py --listar-fontes
    pesquisar.py --consultar
    pesquisar.py --limpar --tema "letramento"                # so para teste

Exit: 0 ok (inclusive sem_fonte) | 2 entrada invalida | 3 dossies.json ilegivel
"""
import argparse
import json
import os
import re
import sys
import uuid
from datetime import datetime
from pathlib import Path

DADOS = Path(os.path.expanduser("~/.hermes/iara-data"))
FONTES = DADOS / "fontes"
DOSSIES = DADOS / "dossies.json"

PROFUNDIDADES = {"rapida": 3, "media": 5, "profunda": 8}
MAX_TRECHO = 500
MAX_PALAVRAS_RESUMO = 300
EXTENSOES = (".txt", ".md")

# dobra de acento sem importar unicodedata (a lista de imports desta skill e fechada)
ACENTOS = str.maketrans(
    "áàâãäåéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÅÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ",
    "aaaaaaeeeeiiiiooooouuuucnaaaaaaeeeeiiiiooooouuuucn")


def normaliza(texto):
    return (texto or "").translate(ACENTOS).lower()


def palavras_do_tema(tema):
    return [p for p in re.findall(r"[a-z0-9]+", normaliza(tema)) if len(p) >= 3]


def agora():
    return datetime.now().astimezone().isoformat(timespec="seconds")


def paragrafos(caminho):
    """Blocos de linhas nao vazias, com o numero da primeira linha (1-based)."""
    blocos, atual, inicio = [], [], None
    try:
        linhas = caminho.read_text(encoding="utf-8", errors="replace").splitlines()
    except OSError:
        return []
    for i, linha in enumerate(linhas, start=1):
        if linha.strip():
            if inicio is None:
                inicio = i
            atual.append(linha.strip())
        elif atual:
            blocos.append((" ".join(atual), inicio))
            atual, inicio = [], None
    if atual:
        blocos.append((" ".join(atual), inicio))
    return blocos


def corta(texto, limite=MAX_TRECHO):
    if len(texto) <= limite:
        return texto
    corte = texto[:limite]
    fim = max(corte.rfind(". "), corte.rfind("! "), corte.rfind("? "))
    return (corte[:fim + 1] if fim > limite * 0.5 else corte.rsplit(" ", 1)[0]) + " […]"


def primeira_frase(texto):
    m = re.split(r"(?<=[.!?])\s", texto.strip(), maxsplit=1)
    return m[0].strip()


def arquivos_de_fonte():
    if not FONTES.exists():
        return []
    return sorted(p for p in FONTES.iterdir()
                  if p.is_file() and p.suffix.lower() in EXTENSOES)


def coletar(tema, profundidade):
    chaves = palavras_do_tema(tema)
    arquivos = arquivos_de_fonte()
    achados, arquivos_com_match = [], []
    for arq in arquivos:
        casou = False
        for texto, linha in paragrafos(arq):
            alvo = normaliza(texto)
            hits = sum(alvo.count(k) for k in chaves)
            if hits:
                casou = True
                achados.append({"texto": corta(texto), "fonte": arq.name,
                                "linha": linha, "score": hits})
        if casou:
            arquivos_com_match.append(arq.name)
    achados.sort(key=lambda t: (-t["score"], t["fonte"], t["linha"]))
    limite = PROFUNDIDADES[profundidade]
    return achados[:limite], arquivos, arquivos_com_match


def monta_resumo(tema, trechos, n_arquivos, n_com_match):
    """Resumo SO do que veio das fontes: nada de conhecimento proprio."""
    if not trechos:
        return ""
    partes = ["%d arquivo(s) em iara-data/fontes/ lidos; %d com ocorrencia de "
              "\"%s\"." % (n_arquivos, n_com_match, tema)]
    for t in trechos:
        frase = primeira_frase(t["texto"])
        partes.append("[%s, linha %d] %s" % (t["fonte"], t["linha"], frase))
    resumo = " ".join(partes)
    palavras = resumo.split()
    if len(palavras) > MAX_PALAVRAS_RESUMO:
        resumo = " ".join(palavras[:MAX_PALAVRAS_RESUMO]) + " […]"
    return resumo


def carregar_dossies():
    if not DOSSIES.exists():
        return []
    try:
        dados = json.loads(DOSSIES.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        print(json.dumps({"ok": False, "erro": "dossies.json ilegivel (%s): nao "
                           "sobrescrevo historico" % exc}, ensure_ascii=False))
        sys.exit(3)
    if not isinstance(dados, list):
        print(json.dumps({"ok": False, "erro": "dossies.json nao e lista"}))
        sys.exit(3)
    return dados


def salvar_dossies(dossies):
    DOSSIES.parent.mkdir(parents=True, exist_ok=True)
    tmp = DOSSIES.with_suffix(".tmp")
    tmp.write_text(json.dumps(dossies, indent=2, ensure_ascii=False) + "\n",
                   encoding="utf-8")
    os.chmod(tmp, 0o600)
    os.replace(tmp, DOSSIES)


def saida(obj, codigo=0):
    print(json.dumps(obj, indent=2, ensure_ascii=False))
    sys.exit(codigo)


def main():
    ap = argparse.ArgumentParser(description="dossie a partir de fontes manuais (sem rede)")
    ap.add_argument("--tema", default="")
    ap.add_argument("--profundidade", default="media",
                    choices=sorted(PROFUNDIDADES))
    ap.add_argument("--listar-fontes", action="store_true")
    ap.add_argument("--consultar", action="store_true")
    ap.add_argument("--limpar", action="store_true", help="apaga dossies do tema/id (teste)")
    ap.add_argument("--id", default="")
    a = ap.parse_args()

    if a.listar_fontes:
        arqs = arquivos_de_fonte()
        saida({"ok": True, "pasta": str(FONTES), "total": len(arqs),
               "arquivos": [{"nome": p.name, "bytes": p.stat().st_size,
                             "linhas": len(p.read_text(encoding="utf-8",
                                                       errors="replace").splitlines())}
                            for p in arqs]})

    if a.consultar:
        dossies = carregar_dossies()
        saida({"ok": True, "total": len(dossies),
               "dossies": [{"id": d["id"], "tema": d["tema"],
                            "profundidade": d.get("profundidade"),
                            "status": d.get("status"),
                            "sem_fonte": d.get("sem_fonte"),
                            "trechos": len(d.get("trechos") or []),
                            "verificado": d.get("verificado"),
                            "criado_em": d.get("criado_em")} for d in dossies]})

    if a.limpar:
        if not (a.tema or a.id):
            saida({"ok": False, "erros": ["--limpar exige --tema ou --id"]}, 2)
        dossies = carregar_dossies()
        antes = len(dossies)
        alvo = normaliza(a.tema)
        ficaram = [d for d in dossies
                   if not ((a.id and d["id"] == a.id)
                           or (a.tema and normaliza(d["tema"]) == alvo))]
        salvar_dossies(ficaram)
        saida({"limpo": True, "antes": antes, "depois": len(ficaram),
               "removidos": antes - len(ficaram)})

    if not a.tema.strip():
        saida({"ok": False, "erros": ["--tema obrigatorio"]}, 2)

    trechos, arquivos, com_match = coletar(a.tema.strip(), a.profundidade)
    sem_fonte = not trechos
    dossie = {
        "id": str(uuid.uuid4()),
        "tema": a.tema.strip(),
        "tema_normalizado": normaliza(a.tema.strip()),
        "profundidade": a.profundidade,
        "resumo": monta_resumo(a.tema.strip(), trechos, len(arquivos), len(com_match)),
        "trechos": trechos,
        "sem_fonte": sem_fonte,
        "status": "pendente_fonte" if sem_fonte else "ok",
        "motivo": ("nenhum trecho de fonte manual casou com o tema: nada foi "
                   "inventado, aguardando arquivo em iara-data/fontes/"
                   if sem_fonte else None),
        "arquivos_lidos": [p.name for p in arquivos],
        "arquivos_com_match": com_match,
        "total_trechos": len(trechos),
        "criado_em": agora(),
        "verificado": False,
        "verificado_por": None,
    }

    dossies = carregar_dossies()
    dossies.append(dossie)
    salvar_dossies(dossies)
    saida({"ok": True, "sem_fonte": sem_fonte, "status": dossie["status"],
           "dossie": dossie, "total_dossies": len(dossies)})


if __name__ == "__main__":
    main()
