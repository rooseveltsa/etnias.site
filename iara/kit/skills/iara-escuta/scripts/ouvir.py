#!/usr/bin/env python3
"""ouvir.py — escuta comunitaria: lote de mensagens -> agregado em escuta.json.

SEM REDE, SEM SUPABASE, SEM CREDENCIAL. Le lotes .txt/.md de
~/.hermes/iara-data/escuta/ e escreve apenas ~/.hermes/iara-data/escuta.json.

Uso:
  ouvir.py --lote ~/.hermes/iara-data/escuta/lote-teste.txt
  ouvir.py --lote-dir ~/.hermes/iara-data/escuta/ --janela 2026-11
  ouvir.py --listar
  ouvir.py --limpar [--confirmar]

Regras:
  - telefone, email e CPF sao substituidos por [ANONIMIZADO] ANTES de qualquer grafico;
  - mensagem por linha, ou por bloco quando o arquivo tem linha em branco separando;
  - agregado: total, por_tema, por_sentimento, top_palavras (5), recomendacoes (ate 3);
  - nada e apagado sem --limpar --confirmar (dry-run antes).
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
import unicodedata
from datetime import datetime

BASE = os.path.expanduser("~/.hermes/iara-data")
ESCUTA_DIR = os.path.join(BASE, "escuta")
ESCUTA = os.path.join(BASE, "escuta.json")

RE_CPF = re.compile(r"\b\d{3}\.\d{3}\.\d{3}-\d{2}\b")
RE_EMAIL = re.compile(r"\b[\w.+-]+@[\w-]+\.[\w.]+\b")
RE_TEL = re.compile(r"(?:\+?55[\s-]?)?\(?\d{2}\)?[\s-]?\d{4,5}[\s-]?\d{4}\b")
RE_TEL_SIMPLES = re.compile(r"\b\d{10,11}\b")

TEMAS = [
    ("cursos", ["curso", "aula", "formacao", "formação", "inscri", "certificado", "turma", "letramento"]),
    ("eventos", ["evento", "encontro", "festival", "palestra", "seminario", "seminário", "agenda", "live"]),
    ("projetos", ["projeto", "iniciativa", "programa", "plataforma", "etnias", "opy", "tupiniquim"]),
    ("doacao", ["doac", "doaç", "apoiar", "apoio", "contribuir", "pix", "doar"]),
    ("parceria", ["parceria", "parceiro", "colabora", "convite", "imprensa", "midia", "mídia"]),
]

POSITIVAS = ["bom", "boa", "otimo", "ótimo", "adorei", "amei", "parabens", "parabéns",
             "obrigado", "obrigada", "excelente", "lindo", "maravilh", "legal",
             "incrivel", "incrível", "gostei", "top", "valeu"]
NEGATIVAS = ["ruim", "pessimo", "péssimo", "absurdo", "demora", "nao funciona",
             "não funciona", "problema", "reclama", "decepcion", "triste", "horrivel",
             "horrível", "descaso", "vergonha", "ninguem responde", "ninguém responde",
             "chuva", "cancelaram", "perdi"]

STOP = {"que", "com", "para", "por", "uma", "dos", "das", "como", "mais", "meu",
        "minha", "isso", "esta", "esse", "aqui", "tem", "ter", "foi", "ser", "sou",
        "voce", "voces", "nao", "não", "sim", "pelo", "pela", "nos", "mas", "muito",
        "todo", "toda", "quando", "onde", "sobre", "tambem", "também", "ja", "já"}


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


def anonimizar(txt: str) -> tuple[str, int]:
    """Troca CPF, email e telefone por [ANONIMIZADO]. Devolve (texto, quantos)."""
    n = 0
    for rx in (RE_CPF, RE_EMAIL, RE_TEL, RE_TEL_SIMPLES):
        txt, k = rx.subn("[ANONIMIZADO]", txt)
        n += k
    return txt, n


def sem_acento(txt: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", txt) if unicodedata.category(c) != "Mn")


def divisao_msgs(conteudo: str) -> list:
    blocos = [b.strip() for b in re.split(r"\n\s*\n", conteudo) if b.strip()]
    if len(blocos) > 1:
        return [" ".join(b.splitlines()).strip() for b in blocos]
    linhas = [l.strip() for l in conteudo.splitlines() if l.strip()]
    return linhas


def tema_de(msg: str) -> str:
    b = sem_acento(msg.lower())
    melhor, pontos = "outro", 0
    for nome, chaves in TEMAS:
        achados = [k for k in chaves if sem_acento(k) in b]
        if len(achados) > pontos:
            melhor, pontos = nome, len(achados)
    return melhor


def sentimento_de(msg: str) -> str:
    b = sem_acento(msg.lower())
    pos = sum(1 for p in POSITIVAS if sem_acento(p) in b)
    neg = sum(1 for p in NEGATIVAS if sem_acento(p) in b)
    if neg > pos:
        return "negativo"
    if pos > neg:
        return "positivo"
    return "neutro"


def top_palavras(msgs: list, limite: int = 5) -> list:
    freq = {}
    for m in msgs:
        for t in re.findall(r"[0-9a-zà-ÿ]{4,}", m.lower()):
            if t in STOP or t == "anonimizado":
                continue
            freq[t] = freq.get(t, 0) + 1
    ordenado = sorted(freq.items(), key=lambda kv: (-kv[1], kv[0]))
    return [{"palavra": p, "ocorrencias": n} for p, n in ordenado[:limite]]


def recomendacoes(por_tema: dict, por_sent: dict, total: int) -> list:
    recs = []
    neg = por_sent.get("negativo", 0)
    frac_neg = neg / total if total else 0
    tema_dom = max(por_tema.items(), key=lambda kv: kv[1])[0] if por_tema else "outro"
    if frac_neg > 0.30:
        recs.append(f"revisar atendimento: {round(frac_neg * 100)}% das mensagens "
                    f"({neg}/{total}) tem sentimento negativo")
    if frac_neg > 0.40:
        recs.append(f"investigar causa do sentimento negativo com o dono antes de publicar "
                    f"qualquer resposta ({round(frac_neg * 100)}% do lote)")
    if tema_dom != "outro":
        recs.append(f"ampliar conteudo sobre {tema_dom}: e o tema dominante do lote "
                    f"({por_tema.get(tema_dom)} de {total} mensagens)")
        if neg:
            recs.append(f"responder reclamacoes sobre {tema_dom} antes de novo conteudo do tema")
    return recs[:3]


def agregar(mensagens: list, janela: str, origem: str) -> dict:
    limpas, anonimizadas = [], 0
    for m in mensagens:
        t, n = anonimizar(m)
        anonimizadas += n
        limpas.append(t)

    por_tema, por_sent = {}, {}
    for t in limpas:
        tema = tema_de(t)
        sent = sentimento_de(t)
        por_tema[tema] = por_tema.get(tema, 0) + 1
        por_sent[sent] = por_sent.get(sent, 0) + 1

    semente = hashlib.sha1(("\n".join(limpas) + janela).encode("utf-8")).hexdigest()[:10]
    return {
        "id": "esc-" + semente,
        "janela": janela,
        "origem": origem,
        "total_mensagens": len(limpas),
        "por_tema": por_tema,
        "por_sentimento": por_sent,
        "top_palavras": top_palavras(limpas),
        "recomendacoes": recomendacoes(por_tema, por_sent, len(limpas)),
        "anonimizacoes": anonimizadas,
        "criado_em": datetime.now().isoformat(timespec="seconds"),
    }


def arquivos_de_lote(args) -> list:
    if args.lote:
        return [os.path.expanduser(args.lote)]
    d = os.path.expanduser(args.lote_dir or ESCUTA_DIR)
    if not os.path.isdir(d):
        return []
    return sorted(os.path.join(d, n) for n in os.listdir(d)
                  if n.lower().endswith((".txt", ".md")))


def cmd_ouvir(args, verbose=True) -> dict:
    janela = args.janela or datetime.now().strftime("%Y-%m")
    lotes = []
    for caminho in arquivos_de_lote(args):
        if not os.path.exists(caminho):
            print(json.dumps({"ok": False, "erro": "lote_nao_encontrado", "caminho": caminho}))
            raise SystemExit(2)
        conteudo = open(caminho, encoding="utf-8", errors="replace").read()
        msgs = divisao_msgs(conteudo)
        if not msgs:
            continue
        lotes.append(agregar(msgs, janela, os.path.basename(caminho)))

    salvos = ler_lista(os.path.expanduser(args.out))
    ids = {l.get("id") for l in salvos}
    novos = [l for l in lotes if l["id"] not in ids]
    if novos:
        gravar_lista(os.path.expanduser(args.out), salvos + novos)

    saida = {"novos": len(novos), "total_lotes": len(salvos) + len(novos), "lotes": novos or lotes}
    if verbose:
        print(json.dumps(saida, ensure_ascii=False, indent=2))
    return saida


def cmd_listar(args, verbose=True) -> dict:
    lotes = ler_lista(os.path.expanduser(args.out))
    if verbose:
        if not lotes:
            print("(sem lotes)")
        for l in lotes:
            print(f"{l.get('id')}  {l.get('janela')}  msgs={l.get('total_mensagens')}  "
                  f"tema={l.get('por_tema')}  sent={l.get('por_sentimento')}")
    return {"total": len(lotes), "lotes": lotes}


def cmd_limpar(args, verbose=True) -> dict:
    caminho = os.path.expanduser(args.out)
    lotes = ler_lista(caminho)
    if verbose:
        print(json.dumps({"dry_run": not args.confirmar, "sairiam": len(lotes),
                          "ids": [l.get("id") for l in lotes]}, ensure_ascii=False))
    if args.confirmar and lotes:
        gravar_lista(caminho, [])
    return {"antes": len(lotes), "depois": len(ler_lista(caminho))}


def main() -> int:
    ap = argparse.ArgumentParser(description="escuta comunitaria -> agregado (sem rede)")
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("--lote", default="")
    g.add_argument("--lote-dir", default="")
    g.add_argument("--listar", action="store_true")
    g.add_argument("--limpar", action="store_true")
    ap.add_argument("--janela", default="")
    ap.add_argument("--confirmar", action="store_true")
    ap.add_argument("--out", default=ESCUTA)
    args = ap.parse_args()

    if args.lote or args.lote_dir:
        cmd_ouvir(args)
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
