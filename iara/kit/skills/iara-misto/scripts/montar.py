#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""montar.py — roteiro de video misto (biblioteca + IA). SO ROTEIRO.

Nao gera video, nao baixa nada, nao fala com modelo. Le:
  ~/.hermes/iara-data/biblioteca.json   (fonte dos IDs de acervo)
Escreve:
  ~/.hermes/iara-data/mistos.json       (roteiro com status "rascunho")

    montar.py --tema "governanca de dados" --objetivo informar \
              --duracao-alvo 30 --referencias video-001,foto-001
    montar.py --tema "retrospectiva do ano" --objetivo retrospectiva --duracao-alvo 30
    montar.py --consultar
    montar.py --limpar --tema "..."        # teste

Regra critica: ID de biblioteca NAO se inventa. `--referencias` com ID que nao
existe em biblioteca.json faz o roteiro falhar (item_inexistente: true) e
nada e gravado.

Exit: 0 roteiro gravado | 2 entrada invalida ou item inexistente |
      3 mistos.json ilegivel
"""
import argparse
import json
import os
import sys
import uuid
from datetime import datetime

BASE = os.path.expanduser("~/.hermes/iara-data")
BIBLIOTECA = os.path.join(BASE, "biblioteca.json")
MISTOS = os.path.join(BASE, "mistos.json")

OBJETIVOS = ("divulgar", "informar", "retrospectiva", "institucional")
MAX_SEG_BIB = 12          # segundos: trecho de acervo nao vira bloco arrastado
BLOCO_IA = 6              # segundos por segmento gerado
MIN_DURACAO, MAX_DURACAO = 5, 600

# frase-guia da narracao por objetivo (diretiva de roteiro, nao afirmacao factual)
GUIA = {
    "divulgar": "Apresentar {tema} em uma frase e chamar a comunidade para conhecer.",
    "informar": "Explicar o ponto central de {tema} sem numero que nao esteja na fonte.",
    "retrospectiva": "Retomar o que aconteceu em {tema}, do mais antigo ao mais recente.",
    "institucional": "Posicionar a marca sobre {tema} em tom institucional, sem promessa.",
}
DESCRICAO_IA = {
    "divulgar": "Cena de abertura ilustrando {tema}, grafismo indigena contemporaneo",
    "informar": "Infografico animado com o conceito de {tema}, tipografia grande",
    "retrospectiva": "Linha do tempo animada dos marcos de {tema}",
    "institucional": "Cena institucional neutra com a marca e {tema} ao fundo",
}
ASPEITOS = ["contexto", "o que muda na pratica", "chamada final"]


def agora():
    return datetime.now().astimezone().isoformat(timespec="seconds")


def carregar(caminho, nome, vazio_ok=True):
    if not os.path.exists(caminho):
        return []
    try:
        d = json.load(open(caminho, encoding="utf-8"))
    except json.JSONDecodeError as exc:
        print(json.dumps({"ok": False, "erro": "%s ilegivel (%s): nao sobrescrevo"
                          % (nome, exc)}, ensure_ascii=False))
        sys.exit(3)
    if not isinstance(d, list):
        print(json.dumps({"ok": False, "erro": "%s nao e lista" % nome}))
        sys.exit(3)
    return d


def gravar(caminho, lista):
    tmp = caminho + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(lista, f, ensure_ascii=False, indent=2)
        f.write("\n")
    os.chmod(tmp, 0o600)
    os.replace(tmp, caminho)


def planejar_duracoes(n_biblioteca, duracao_alvo):
    """Devolve lista de (tipo, duracao_s) somando EXATAMENTE duracao_alvo."""
    duracoes = []
    if n_biblioteca:
        cota = min(MAX_SEG_BIB, max(3, round(duracao_alvo * 0.6 / n_biblioteca)))
        duracoes = [("biblioteca", cota)] * n_biblioteca
    resto = duracao_alvo - sum(d for _, d in duracoes)
    if resto > 0:
        n_ia = max(1, round(resto / BLOCO_IA))
        base = resto // n_ia
        sobra = resto - base * n_ia
        for i in range(n_ia):
            duracoes.append(("ia", base + (1 if i < sobra else 0)))
    elif resto < 0:                      # alvo menor que a cota minima
        while sum(d for _, d in duracoes) > duracao_alvo and duracoes:
            duracoes.pop()
        resto = duracao_alvo - sum(d for _, d in duracoes)
        if resto > 0:
            duracoes.append(("ia", resto))
    return duracoes


def montar(tema, objetivo, duracao_alvo, refs):
    biblioteca = carregar(BIBLIOTECA, "biblioteca.json")
    por_id = {b.get("item_id"): b for b in biblioteca}

    pedidos = [r.strip() for r in refs if r.strip()] if refs else []
    faltando = [r for r in pedidos if r not in por_id]
    if faltando:
        return {"ok": False, "item_inexistente": True,
                "ids_invalidos": faltando,
                "ids_disponiveis": sorted(k for k in por_id if k),
                "motivo": "ID de biblioteca nao existe: a skill nao inventa acervo"}

    itens = [por_id[r] for r in pedidos]
    plano = planejar_duracoes(len(itens), duracao_alvo)

    segmentos = []
    i_bib = 0
    i_ia = 0
    for ordem, (tipo, dur) in enumerate(plano, start=1):
        if tipo == "biblioteca":
            item = itens[i_bib]
            i_bib += 1
            titulo = item.get("titulo") or item.get("item_id")
            segmentos.append({
                "ordem": ordem, "tipo": "biblioteca", "duracao_s": dur,
                "item_id": item["item_id"], "titulo": titulo,
                "tipo_acervo": item.get("tipo"),
                "narracao": "%s Usar trecho de \"%s\" (%s) como material real."
                            % (GUIA[objetivo].format(tema=tema), titulo, item["item_id"]),
                "legenda": ("%s | %s" % (titulo, tema))[:70],
            })
        else:
            aspeto = ASPEITOS[min(i_ia, len(ASPEITOS) - 1)]
            i_ia += 1
            segmentos.append({
                "ordem": ordem, "tipo": "ia", "duracao_s": dur,
                "descricao": DESCRICAO_IA[objetivo].format(tema=tema)
                             + " — foco: " + aspeto,
                "narracao": "%s Ponto %d: %s."
                            % (GUIA[objetivo].format(tema=tema), i_ia, aspeto),
                "legenda": ("%s: %s" % (tema, aspeto))[:70],
            })

    total = sum(s["duracao_s"] for s in segmentos)
    roteiro = {
        "id": str(uuid.uuid4()),
        "tema": tema,
        "objetivo": objetivo,
        "duracao_alvo": duracao_alvo,
        "duracao_total": total,
        "duracao_ok": total == duracao_alvo,
        "referencias_pedidas": pedidos,
        "segmentos": segmentos,
        "n_segmentos": len(segmentos),
        "n_biblioteca": len(itens),
        "n_ia": sum(1 for s in segmentos if s["tipo"] == "ia"),
        "status": "rascunho",
        "observacao": "roteiro apenas: render e da skill de audiovisual (F19/F20). "
                      "Narracao precisa de revisao humana antes de gravar.",
        "criado_em": agora(),
    }
    return {"ok": True, "roteiro": roteiro}


def main():
    ap = argparse.ArgumentParser(description="roteiro de video misto (biblioteca + IA)")
    ap.add_argument("--tema", default="")
    ap.add_argument("--objetivo", default="informar", choices=OBJETIVOS)
    ap.add_argument("--duracao-alvo", type=int, default=30)
    ap.add_argument("--referencias", default="")
    ap.add_argument("--consultar", action="store_true")
    ap.add_argument("--limpar", action="store_true")
    ap.add_argument("--id", default="")
    a = ap.parse_args()

    if a.consultar:
        lista = carregar(MISTOS, "mistos.json")
        print(json.dumps({"total": len(lista),
                          "roteiros": [{"id": r["id"], "tema": r["tema"],
                                        "objetivo": r["objetivo"],
                                        "duracao_alvo": r["duracao_alvo"],
                                        "total": r.get("duracao_total"),
                                        "segmentos": r.get("n_segmentos"),
                                        "status": r.get("status")} for r in lista]},
                         indent=2, ensure_ascii=False))
        return 0

    if a.limpar:
        if not (a.tema or a.id):
            print(json.dumps({"erro": "--limpar exige --tema ou --id"}, ensure_ascii=False))
            return 2
        lista = carregar(MISTOS, "mistos.json")
        antes = len(lista)
        ficaram = [r for r in lista
                   if not ((a.id and r["id"] == a.id)
                           or (a.tema and r["tema"] == a.tema))]
        gravar(MISTOS, ficaram)
        print(json.dumps({"dry_run": False, "antes": antes, "depois": len(ficaram),
                          "removidos": antes - len(ficaram)}, ensure_ascii=False))
        return 0

    if not a.tema.strip():
        print(json.dumps({"erro": "--tema obrigatorio"}, ensure_ascii=False))
        return 2
    if not (MIN_DURACAO <= a.duracao_alvo <= MAX_DURACAO):
        print(json.dumps({"erro": "--duracao-alvo fora da faixa %d..%d"
                          % (MIN_DURACAO, MAX_DURACAO)}, ensure_ascii=False))
        return 2
    if a.objetivo not in OBJETIVOS:
        print(json.dumps({"erro": "--objetivo invalido"}, ensure_ascii=False))
        return 2

    refs = a.referencias.split(",") if a.referencias else []
    r = montar(a.tema.strip(), a.objetivo, a.duracao_alvo, refs)
    if not r["ok"]:
        print(json.dumps(r, indent=2, ensure_ascii=False))
        return 2

    lista = carregar(MISTOS, "mistos.json")
    lista.append(r["roteiro"])
    gravar(MISTOS, lista)
    print(json.dumps({"ok": True, "roteiro": r["roteiro"], "total_roteiros": len(lista)},
                     indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
