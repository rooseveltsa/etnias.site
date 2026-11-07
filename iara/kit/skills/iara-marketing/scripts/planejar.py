#!/usr/bin/env python3
"""planejar.py — briefing em texto livre -> plano de campanha em campanhas.json.

SEM REDE, SEM SUPABASE, SEM CREDENCIAL. Le apenas:
  ~/.hermes/iara-data/dossies.json   (se existir)
  ~/.hermes/iara-data/pautas.json    (se existir)
e escreve apenas:
  ~/.hermes/iara-data/campanhas.json

Uso:
  planejar.py --briefing "campanha de letramento para jovens"
  planejar.py --briefing-file /tmp/briefing.txt
  planejar.py --listar
  planejar.py --limpar [--confirmar]

Regras:
  - dossie/pauta entra por REFERENCIA (id), nunca por copia de conteudo;
  - sem material sobre o tema: base = "sem_dossie_sem_pauta" e o plano e
    estrutural (formato/agenda), com ZERO afirmacao factual;
  - campanha nasce com status "rascunho" (aprovacao e humana);
  - merge por id: nada e apagado sem --limpar --confirmar (com dry-run).
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
from datetime import datetime

BASE = os.path.expanduser("~/.hermes/iara-data")
DOSSIES = os.path.join(BASE, "dossies.json")
PAUTAS = os.path.join(BASE, "pautas.json")
CAMPANHAS = os.path.join(BASE, "campanhas.json")

STOP = {
    "para", "com", "uma", "umas", "uns", "dos", "das", "que", "por", "sobre", "entre",
    "campanha", "campanhas", "divulgar", "divulgacao", "fazer", "criar", "the", "and",
    "nosso", "nossa", "sera", "vao", "vai", "mais", "como", "pelo", "pela", "nos",
    "aos", "aum", "dia", "semana", "mes", "meses", "muito", "pouco", "tambem",
}

FORMATOS = ["reels", "carrossel", "stories", "post-estatico", "reels", "carrossel", "stories"]

CANAIS_PADRAO = ["instagram-reels", "instagram-carrossel", "instagram-stories", "whatsapp"]


def ler_lista(caminho: str) -> list:
    if not os.path.exists(caminho):
        return []
    try:
        d = json.load(open(caminho, encoding="utf-8"))
        return d if isinstance(d, list) else []
    except Exception:
        return []


def gravar_lista(caminho: str, dados: list) -> None:
    os.makedirs(os.path.dirname(caminho), exist_ok=True)
    tmp = caminho + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(dados, f, ensure_ascii=False, indent=2)
    os.chmod(tmp, 0o600)
    os.replace(tmp, caminho)


def palavras(briefing: str) -> list:
    toks = re.findall(r"[0-9a-zà-ÿ]{4,}", (briefing or "").lower())
    seen, out = set(), []
    for t in toks:
        if t in STOP or t in seen:
            continue
        seen.add(t)
        out.append(t)
    return out


def texto_de(item) -> str:
    partes = []

    def anda(x):
        if isinstance(x, str):
            partes.append(x)
        elif isinstance(x, dict):
            for v in x.values():
                anda(v)
        elif isinstance(x, list):
            for v in x:
                anda(v)

    anda(item)
    return " ".join(partes).lower()


def casar(briefing: str, itens: list, campo_id: str = "id", minimo: int = 1) -> list:
    """Devolve os itens cujo texto contem ao menos `minimo` palavras do briefing."""
    kws = palavras(briefing)
    achados = []
    for it in itens:
        if not isinstance(it, dict):
            continue
        txt = texto_de(it)
        pontos = [k for k in kws if k in txt]
        if len(pontos) >= minimo:
            achados.append({"pontos": pontos, "item": it})
    achados.sort(key=lambda a: -len(a["pontos"]))
    return achados


def extrair_publico(briefing: str) -> str:
    m = re.search(r"\bpara\s+([^,.;\n]{3,60})", briefing, re.I)
    if m:
        return m.group(1).strip()
    return "a definir com o dono (o briefing nao declara publico)"


def extrair_meta(briefing: str) -> str:
    m = re.search(r"(\d[\d\.\,]*\s*(mil|milhao|milhão|k)?)\s*(de\s*)?(alcance|views|seguidores|contas|pessoas)",
                  briefing, re.I)
    if m:
        return f"{m.group(4).lower()} de {m.group(1).strip()}"
    return "alcance de 5.000 contas (meta padrao do plano — ajustar com o dono)"


def extrair_canais(briefing: str) -> list:
    b = briefing.lower()
    canais = []
    if "reel" in b or "video" in b or "vídeo" in b:
        canais.append("instagram-reels")
    if "carrossel" in b or "card" in b:
        canais.append("instagram-carrossel")
    if "story" in b or "stories" in b:
        canais.append("instagram-stories")
    if "whatsapp" in b or "grupo" in b:
        canais.append("whatsapp")
    return canais or list(CANAIS_PADRAO)


def id_campanha(briefing: str) -> str:
    semente = f"{briefing.strip().lower()}|{datetime.now().date().isoformat()}"
    return "camp-" + hashlib.sha1(semente.encode("utf-8")).hexdigest()[:10]


def montar_plano(briefing: str, dossies: list, pautas: list) -> dict:
    achados_d = casar(briefing, dossies)
    achados_p = casar(briefing, pautas)

    referencias, base, titulo_ref = [], "sem_dossie_sem_pauta", ""
    if achados_d:
        base = "com_dossie"
        referencias = [a["item"].get("id") for a in achados_d[:2] if a["item"].get("id")]
        titulo_ref = achados_d[0]["item"].get("titulo") or achados_d[0]["item"].get("assunto") or ""
    elif achados_p:
        base = "com_pauta"
        referencias = [a["item"].get("id") for a in achados_p[:2] if a["item"].get("id")]
        titulo_ref = achados_p[0]["item"].get("titulo", "")

    kws = palavras(briefing)
    tema_txt = kws[0] if kws else "tema a definir"

    if base == "sem_dossie_sem_pauta":
        mensagem = ("A definir com o dono: este plano e estrutural e NAO afirma "
                    "nenhum fato sobre o tema (nenhum dossie nem pauta corresponde ao briefing).")
        apoio = [
            "Apoio 1 — contexto a redigir com o dono (sem fato assumido)",
            "Apoio 2 — prova/evidencia a levantar antes de publicar",
            "Apoio 3 — chamada para acao a definir",
        ]
        avisos = ["base sem dossie e sem pauta: nenhuma afirmacao factual foi gerada"]
    else:
        fonte_txt = "dossiê" if base == "com_dossie" else "pauta"
        artigo = "do" if base == "com_dossie" else "da"
        mensagem = (f"Mensagem a redigir a partir {artigo} {fonte_txt} {referencias[0] if referencias else '(sem id)'}"
                    + (f" — \"{titulo_ref[:80]}\"" if titulo_ref else "") + ".")
        apoio = [
            f"Apoio 1 — recorte {artigo} {fonte_txt} referenciado ({referencias[0] if referencias else 'sem id'})",
            "Apoio 2 — explicacao em linguagem simples para o publico do briefing",
            "Apoio 3 — chamada para acao com o link do etnias.site",
        ]
        avisos = []

    calendario = [
        {"dia": i + 1, "formato": FORMATOS[i], "tema": tema_txt if i % 2 == 0 else f"{tema_txt} (reforco)"}
        for i in range(7)
    ]

    plano = {
        "id": id_campanha(briefing),
        "briefing": briefing.strip(),
        "objetivo": f"Atender ao briefing: {briefing.strip()[:160]}",
        "publico": extrair_publico(briefing),
        "mensagem_principal": mensagem,
        "mensagens_apoio": apoio,
        "canais": extrair_canais(briefing),
        "calendario_7d": calendario,
        "meta": extrair_meta(briefing),
        "referencias": referencias,
        "base": base,
        "avisos": avisos,
        "status": "rascunho",
        "criado_em": datetime.now().isoformat(timespec="seconds"),
    }
    return plano


def cmd_planejar(args, verbose=True) -> dict:
    briefing = args.briefing or ""
    if args.briefing_file:
        briefing = open(os.path.expanduser(args.briefing_file), encoding="utf-8").read().strip()
    if not briefing.strip():
        print(json.dumps({"ok": False, "erro": "briefing_vazio"}))
        raise SystemExit(2)

    dossies = ler_lista(os.path.expanduser(args.dossies))
    pautas = ler_lista(os.path.expanduser(args.pautas))
    plano = montar_plano(briefing, dossies, pautas)

    campanhas = ler_lista(os.path.expanduser(args.campanhas))
    ids = {c.get("id") for c in campanhas}
    novo = plano["id"] not in ids
    if novo:
        gravar_lista(os.path.expanduser(args.campanhas), campanhas + [plano])

    saida = {"novo": novo, "total": len(campanhas) + (1 if novo else 0), "plano": plano}
    if verbose:
        print(json.dumps(saida, ensure_ascii=False, indent=2))
    return saida


def cmd_listar(args, verbose=True) -> dict:
    campanhas = ler_lista(os.path.expanduser(args.campanhas))
    if verbose:
        if not campanhas:
            print("(sem campanhas)")
        for c in campanhas:
            print(f"{c.get('id')}  [{c.get('base')}]  {c.get('briefing','')[:60]}  "
                  f"| meta: {c.get('meta')} | status: {c.get('status')}")
    return {"total": len(campanhas), "campanhas": campanhas}


def cmd_limpar(args, verbose=True) -> dict:
    caminho = os.path.expanduser(args.campanhas)
    campanhas = ler_lista(caminho)
    if verbose:
        print(json.dumps({"dry_run": not args.confirmar, "sairiam": len(campanhas),
                          "ids": [c.get("id") for c in campanhas]}, ensure_ascii=False))
    if args.confirmar and campanhas:
        gravar_lista(caminho, [])
    return {"antes": len(campanhas), "depois": len(ler_lista(caminho))}


def main() -> int:
    ap = argparse.ArgumentParser(description="briefing -> plano de campanha (sem rede)")
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("--briefing", default="")
    g.add_argument("--briefing-file", default="")
    g.add_argument("--listar", action="store_true")
    g.add_argument("--limpar", action="store_true")
    ap.add_argument("--confirmar", action="store_true")
    ap.add_argument("--dossies", default=DOSSIES)
    ap.add_argument("--pautas", default=PAUTAS)
    ap.add_argument("--campanhas", default=CAMPANHAS)
    args = ap.parse_args()

    if args.briefing or args.briefing_file:
        cmd_planejar(args)
        return 0
    if args.listar:
        cmd_listar(args)
        return 0
    if args.limpar:
        r = cmd_limpar(args)
        return 0 if (r["depois"] == 0 or not args.confirmar) else 1
    return 2


if __name__ == "__main__":
    sys.exit(main())
