#!/usr/bin/env python3
"""radar.py — radar de noticias (clipping local -> sugestao de pauta).

SEM REDE, SEM SUPABASE, SEM CREDENCIAL. Le apenas:
  ~/.hermes/iara-data/clipping/*.txt|*.md
e escreve apenas:
  ~/.hermes/iara-data/pautas.json

Uso:
  radar.py --classificar            le o clipping e (re)grava as pautas
  radar.py --listar                 mostra as pautas salvas
  radar.py --limpar                 dry-run: conta o que sairia
  radar.py --limpar --confirmar     apaga as pautas (dry-run ja mostrado)

Origem do item (PEC 9.1):
  linha `Origem:` — site | rss | instagram | outro (padrao: site).
  Instagram exige `Perfil: @handle` E (`Link: URL` OU `Print: /caminho/existente`).
  Sem essa referencia o item e recusado com motivo "instagram_sem_referencia" —
  a skill NAO vai buscar o post na Graph API (isso e do junior, ver SKILL.md).

Regras:
  - item sem fonte (linha "Fonte:" ou URL) NUNCA vira pauta: entra em recusadas
    com fonte_ausente: true;
  - tema por palavra-chave em 5 categorias + "indefinido" quando nada casa;
  - pauta existente nao e sobrescrita nem apagada: merge por id;
  - sugestao_angulo e montada a partir do lede do proprio texto, sem inventar fato.
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
CLIPPING = os.path.join(BASE, "clipping")
PAUTAS = os.path.join(BASE, "pautas.json")

TEMAS = {
    "letramento": ["letramento", "educa", "escola", "alfabetiz", "formacao", "formação",
                   "curso", "professor", "aprendiz", "leitura"],
    "tecnologia": ["tecnolog", "internet", "digital", "algoritm", "inteligencia artificial",
                   "inteligência artificial", "ia ", "dados", "satelite", "satélite",
                   "conectividade", "starlink", "plataforma", "app"],
    "politica": ["politic", "polític", "congresso", "stf", "supremo", "ministerio",
                 "ministério", "deputad", "senad", "governo", "eleicao", "eleição",
                 "funai", "demarcacao", "demarcação", "projeto de lei", "pl "],
    "cultura": ["cultura", "arte", "musica", "música", "festival", "cinema", "livro",
                "exposicao", "exposição", "grafismo", "ritual", "lingua", "língua",
                "sabedoria", "oralidade", "artesanato"],
    "direitos": ["direito", "violencia", "violência", "garimpo", "invasao", "invasão",
                 "desmatamento", "territorio", "território", "demarcacao", "demarcação",
                 "saude", "saúde", "justica", "justiça", "crime", "ameaca", "ameaça",
                 "protecao", "proteção", "consulta livre"],
}

URL_RE = re.compile(r"https?://[^\s)>\]\"']+")
DATA_RE = re.compile(r"\b(20\d{2})-(\d{2})-(\d{2})\b")

# --- origem do item (PEC 9.1) ------------------------------------------------
# site | rss | instagram | outro  (padrao: site)
ORIGENS = ("site", "rss", "instagram", "outro")
PERFIL_RE = re.compile(r"^@[A-Za-z0-9._]{1,30}$")
CAMPOS_RESERVADOS = ("fonte", "data", "origem", "perfil", "link", "print")


def ler_pautas() -> list:
    if not os.path.exists(PAUTAS):
        return []
    try:
        d = json.load(open(PAUTAS, encoding="utf-8"))
        return d if isinstance(d, list) else []
    except Exception:
        return []


def gravar_pautas(pautas: list) -> None:
    os.makedirs(BASE, exist_ok=True)
    tmp = PAUTAS + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(pautas, f, ensure_ascii=False, indent=2)
    os.chmod(tmp, 0o600)
    os.replace(tmp, PAUTAS)


def id_pauta(titulo: str, fonte: str) -> str:
    return hashlib.sha1(f"{titulo}|{fonte}".encode("utf-8")).hexdigest()[:12]


def arquivos_clipping() -> list:
    if not os.path.isdir(CLIPPING):
        return []
    return sorted(
        os.path.join(CLIPPING, n) for n in os.listdir(CLIPPING)
        if n.lower().endswith((".txt", ".md"))
    )


def classificar_tema(texto: str) -> tuple[str, dict]:
    baixo = " " + texto.lower() + " "
    pontos = {}
    for tema, chaves in TEMAS.items():
        achados = []
        for k in chaves:
            # chave curta ("ia ", "pl ") so casa como palavra inteira: evita
            # falso positivo dentro de "propria", "plataforma" etc.
            if len(k.strip()) <= 2:
                if re.search(r"\b" + re.escape(k.strip()) + r"\b", baixo):
                    achados.append(k.strip())
            elif k in baixo:
                achados.append(k)
        if achados:
            pontos[tema] = achados
    if not pontos:
        return "indefinido", {}
    # mais palavras-chave distintas vence; empate fica na ordem do dicionario
    tema = sorted(pontos.items(), key=lambda kv: (-len(kv[1]), list(TEMAS).index(kv[0])))[0]
    return tema[0], {tema[0]: tema[1]}


def extrair_campo(linhas: list, nome: str) -> str:
    """Valor de uma linha `Nome: valor` (case-insensitive), ou ''."""
    for linha in linhas:
        m = re.match(r"^\s*" + re.escape(nome) + r"\s*:\s*(.+)$", linha, re.I)
        if m and m.group(1).strip():
            return m.group(1).strip()
    return ""


def extrair_fonte(linhas: list, texto: str) -> str:
    valor = extrair_campo(linhas, "fonte")
    if valor:
        return valor
    m = URL_RE.search(texto)
    return m.group(0) if m else ""


def extrair_data(linhas: list, texto: str) -> str:
    valor = extrair_campo(linhas, "data")
    if valor:
        achado = DATA_RE.search(valor)
        if achado:
            return achado.group(0)
    achado = DATA_RE.search(texto)
    return achado.group(0) if achado else ""


def extrair_origem(linhas: list) -> str:
    valor = (extrair_campo(linhas, "origem") or "site").lower()
    return valor if valor in ORIGENS else "outro"


def validar_instagram(linhas: list) -> dict:
    """Exige @perfil valido E (Link URL valido OU Print absoluto que existe)."""
    perfil = extrair_campo(linhas, "perfil")
    link = extrair_campo(linhas, "link")
    print_ref = extrair_campo(linhas, "print")
    faltando = []

    if not perfil:
        faltando.append("perfil")
    elif not PERFIL_RE.match(perfil):
        faltando.append("perfil_invalido")

    if link and not URL_RE.match(link):
        faltando.append("link_invalido")
    if not link and not print_ref:
        faltando.append("referencia")

    base = {"perfil": perfil, "link": link, "print": print_ref}
    if faltando:
        return dict(base, ok=False, faltando=faltando,
                    motivo="instagram_sem_referencia")

    if print_ref and not link:
        if not os.path.isabs(print_ref) or not os.path.exists(print_ref):
            return dict(base, ok=False, faltando=["print_inexistente"],
                        motivo="instagram_print_inexistente")
    return dict(base, ok=True, faltando=[])


def montar_angulo(tema: str, lede: str, fonte: str) -> str:
    base = lede.strip().rstrip(".")
    if len(base) > 150:
        base = base[:147].rsplit(" ", 1)[0] + "..."
    return (f"Partir do fato noticiado (\"{base}\") para explicar o efeito pratico "
            f"disso na vida das comunidades indigenas, conferindo numeros na fonte: {fonte}.")


def ler_item(caminho: str) -> dict:
    texto = open(caminho, encoding="utf-8", errors="replace").read()
    linhas = [l for l in texto.splitlines()]
    corpo = [l.strip() for l in linhas
             if l.strip() and not re.match(
                 r"^\s*(" + "|".join(CAMPOS_RESERVADOS) + r")\s*:", l, re.I)]
    titulo = corpo[0].lstrip("# ").strip() if corpo else os.path.basename(caminho)
    lede = corpo[1] if len(corpo) > 1 else titulo
    data = extrair_data(linhas, texto)
    tema, evidencias = classificar_tema(texto)
    origem = extrair_origem(linhas)

    item = {
        "arquivo": os.path.basename(caminho),
        "titulo": titulo,
        "tema": tema,
        "origem": origem,
        "fonte": "",
        "data": data,
        "evidencias_tema": evidencias,
    }

    if origem == "instagram":
        ref = validar_instagram(linhas)
        item["perfil"] = ref.get("perfil") or ""
        if not ref["ok"]:
            item["faltando"] = ref["faltando"]
            item["motivo"] = ref["motivo"]
            return {"ok": False, "item": item}
        # a referencia (post ou print) E a fonte: sem ela o item nem entra
        item["fonte"] = ref["link"] or ref["print"]
        if ref["link"]:
            item["link_post"] = ref["link"]
        if ref["print"]:
            item["print_referencia"] = ref["print"]
        rotulo = ref["perfil"] + (" — " + ref["link"] if ref["link"] else " — print local")
    else:
        fonte = extrair_fonte(linhas, texto)
        if not fonte:
            item["fonte_ausente"] = True
            item["motivo"] = "sem linha 'Fonte:' e sem URL no texto"
            return {"ok": False, "item": item}
        item["fonte"] = fonte
        rotulo = fonte

    item.update({
        "id": id_pauta(titulo, item["fonte"]),
        "sugestao_angulo": montar_angulo(tema, lede, rotulo),
        "status": "sugerida",
        "gerado_em": datetime.now().isoformat(timespec="seconds"),
    })
    return {"ok": True, "item": item}


def cmd_classificar(verbose: bool = True) -> dict:
    pautas = ler_pautas()
    ids = {p.get("id") for p in pautas}
    novas, recusadas, repetidas = [], [], []
    for caminho in arquivos_clipping():
        r = ler_item(caminho)
        if not r["ok"]:
            recusadas.append(r["item"])
            continue
        if r["item"]["id"] in ids:
            repetidas.append(r["item"]["id"])
            continue
        novas.append(r["item"])
        ids.add(r["item"]["id"])
    if novas:
        gravar_pautas(pautas + novas)
    saida = {
        "classificados": len(arquivos_clipping()),
        "novas_pautas": len(novas),
        "repetidas": len(repetidas),
        "recusadas": recusadas,
        "total_pautas": len(pautas) + len(novas),
        "pautas": novas,
    }
    if verbose:
        print(json.dumps(saida, ensure_ascii=False, indent=2))
    return saida


def cmd_listar(verbose: bool = True) -> dict:
    pautas = ler_pautas()
    if verbose:
        if not pautas:
            print("(sem pautas)")
        for p in pautas:
            print(f"{p.get('id')}  [{p.get('tema')}]  {p.get('titulo')}  "
                  f"| origem: {p.get('origem', 'site')} | fonte: {p.get('fonte')} | "
                  f"{p.get('data') or 'sem data'} | {p.get('status')}")
    return {"total": len(pautas), "pautas": pautas}


def cmd_limpar(confirmar: bool, verbose: bool = True) -> dict:
    pautas = ler_pautas()
    resumo = {"dry_run": not confirmar, "antes": len(pautas), "depois": len(pautas)}
    if verbose:
        print(json.dumps({"dry_run": not confirmar, "sairiam": len(pautas),
                          "ids": [p.get("id") for p in pautas]}, ensure_ascii=False))
    if confirmar and pautas:
        gravar_pautas([])
        resumo["depois"] = len(ler_pautas())
    return resumo


def main() -> int:
    ap = argparse.ArgumentParser(description="radar de noticias -> pautas (sem rede)")
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("--classificar", action="store_true")
    g.add_argument("--listar", action="store_true")
    g.add_argument("--limpar", action="store_true")
    ap.add_argument("--confirmar", action="store_true", help="com --limpar: apaga de verdade")
    args = ap.parse_args()

    if args.classificar:
        cmd_classificar()
        return 0
    if args.listar:
        cmd_listar()
        return 0
    if args.limpar:
        r = cmd_limpar(args.confirmar)
        return 0 if (r["depois"] == 0 or not args.confirmar) else 1
    return 2


if __name__ == "__main__":
    sys.exit(main())
