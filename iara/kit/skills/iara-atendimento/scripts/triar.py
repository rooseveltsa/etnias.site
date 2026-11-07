#!/usr/bin/env python3
"""triar.py — triagem de mensagem (comentario, DM, e-mail) -> atendimentos.json.

SEM REDE, SEM SUPABASE, SEM CREDENCIAL. Le apenas faq.json e escreve apenas
atendimentos.json. A mensagem bruta NAO e gravada: so hash e tamanho.

Uso:
  triar.py --mensagem "Como me inscrevo no curso X?" --canal instagram
  triar.py --mensagem-file /tmp/msg.txt --canal email
  triar.py --listar
  triar.py --limpar [--confirmar]

Regras:
  - sensivel -> SEMPRE precisa_humano: true e urgencia alta (nada de resposta automatica);
  - reclamacao -> precisa_humano: true;
  - duvida com FAQ -> resposta_sugerida preenchida, precisa_humano: false;
  - duvida sem FAQ -> precisa_humano: true, motivo "sem_faq";
  - nada e apagado sem --limpar --confirmar (dry-run antes).
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
FAQ = os.path.join(BASE, "faq.json")
ATEND = os.path.join(BASE, "atendimentos.json")

CANAIS = ("instagram", "linkedin", "email", "whatsapp", "site")

STOP = {"que", "com", "para", "por", "uma", "dos", "das", "como", "mais", "meu",
        "minha", "isso", "esta", "esse", "aqui", "tem", "ter", "foi", "ser", "sou",
        "voce", "voces", "não", "nao", "sim", "the", "and"}

REGRA_CLASSIFICACAO = [
    ("sensivel", ["denunci", "ameac", "ameaç", "violenc", "violênc", "assedio", "assédi",
                  "racismo", "crime", "morte", "invasao", "invasão", "garimpo",
                  "perseguic", "perseguiç", "lideranca indigena", "liderança indígena"]),
    ("reclamacao", ["absurdo", "ninguem", "ninguém", "reclama", "demora", "pessimo",
                    "péssimo", "vergonha", "descaso", "decepcion", "nao funciona",
                    "não funciona", "ninguem responde", "ninguém responde"]),
    ("tecnico", ["bug", "travou", "nao abre", "não abre", "senha", "login", "erro",
                 "nao consigo acessar", "não consigo acessar", "fora do ar", "pagina em branco"]),
    ("sugestao", ["seria bom", "sugiro", "sugest", "ideia", "poderia", "seria interessante",
                  "proposta", "gostaria que", "seria util", "seria útil"]),
    ("elogio", ["parabens", "parabéns", "adorei", "amei", "otimo", "ótimo", "excelente",
                "muito bom", "obrigado", "obrigada", "lindo", "maravilh"]),
    ("duvida", ["como", "onde", "quando", "qual", "quais", "quanto", "inscrev", "inscri",
                "duvida", "dúvida", "posso", "tem como", "preciso", "gostaria de saber", "?"]),
]

TEMAS = [
    ("cursos", ["curso", "cursos", "formacao", "formação", "aula", "inscri", "certificado",
                "turma", "letramento"]),
    ("eventos", ["evento", "encontro", "festival", "palestra", "seminario", "seminário",
                 "agenda", "live", "roda de conversa"]),
    ("projetos", ["projeto", "iniciativa", "programa", "plataforma", "etnias.site",
                  "opy", "tupiniquim", "esydelivery"]),
    ("doacao", ["doac", "doaç", "apoiar", "apoio", "contribuir", "pix", "financiamento",
                "patrocinio", "patrocínio", "arrecad"]),
    ("parceria", ["parceria", "parceiro", "colabora", "convite", "midia", "mídia",
                  "imprensa", "proposta comercial", "editais"]),
]


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


def tokens(txt: str) -> list:
    t = re.findall(r"[0-9a-zà-ÿ]{3,}", (txt or "").lower())
    return [x for x in t if x not in STOP]


def casa(mensagem_baixa: str, chaves: list) -> list:
    return [k for k in chaves if k in mensagem_baixa]


def classificar(msg: str) -> tuple[str, list]:
    b = " " + msg.lower().strip() + " "
    for nome, chaves in REGRA_CLASSIFICACAO:
        achados = casa(b, chaves)
        if achados:
            return nome, achados
    return "duvida", []


def tema_de(msg: str) -> str:
    b = msg.lower()
    melhor, pontos = "outro", 0
    for nome, chaves in TEMAS:
        achados = casa(b, chaves)
        if len(achados) > pontos:
            melhor, pontos = nome, len(achados)
    return melhor


URGENTE_RECLAMACAO = ["urgente", "processo", "denuncia", "denúncia", "prazo",
                      "advogad", "procon", "judicial"]


def urgencia_de(classe: str, msg: str) -> str:
    b = msg.lower()
    if classe == "sensivel":
        return "alta"
    if classe == "reclamacao":
        return "alta" if any(p in b for p in URGENTE_RECLAMACAO) else "media"
    if classe == "tecnico":
        return "media" if any(p in b for p in ("nao consigo", "não consigo", "erro", "fora do ar")) else "baixa"
    return "baixa"


def similar(a: str, b: str) -> bool:
    if a == b:
        return True
    if len(a) >= 5 and len(b) >= 5:
        return a[:5] == b[:5]  # radical curto: inscrevo ~ inscrever, evento ~ eventos
    return False


def casar_faq(msg: str, faq: list) -> dict | None:
    tm = tokens(msg)
    if not tm:
        return None
    melhor, score = None, 0.0
    for item in faq:
        if not isinstance(item, dict):
            continue
        alvo = tokens((item.get("pergunta", "") or "") + " " + (item.get("tema", "") or ""))
        if not alvo:
            continue
        acertos = sum(1 for t in tm if any(similar(t, a) for a in alvo))
        s = acertos / len(tm)
        if s > score:
            melhor, score = item, s
    return melhor if melhor and score >= 0.34 else None


def triar(mensagem: str, canal: str, faq: list) -> dict:
    classe, evidencias = classificar(mensagem)
    tema = tema_de(mensagem)
    urgencia = urgencia_de(classe, mensagem)
    match = casar_faq(mensagem, faq) if classe in ("duvida", "sugestao", "tecnico") else None

    resposta, precisa, motivo = "", False, ""
    if classe == "sensivel":
        precisa, motivo = True, "tema sensivel"
    elif classe == "reclamacao":
        precisa, motivo = True, "reclamacao"
    elif classe == "duvida":
        if match:
            resposta, precisa = match.get("resposta", ""), False
        else:
            precisa, motivo = True, "sem_faq"
    elif classe == "tecnico":
        precisa, motivo = True, "suporte_tecnico"
    elif classe == "sugestao":
        precisa, motivo = False, ""

    mhash = hashlib.sha1(mensagem.encode("utf-8")).hexdigest()[:12]
    triagem = {
        "id": "atd-" + mhash,
        "mensagem_id": mhash,
        "canal": canal,
        "classificacao": classe,
        "tema": tema,
        "urgencia": urgencia,
        "resposta_sugerida": resposta,
        "faq_id": (match or {}).get("id", ""),
        "precisa_humano": precisa,
        "motivo_escalada": motivo,
        "evidencias": evidencias,
        "tamanho_mensagem": len(mensagem),
        "status": "triada",
        "criado_em": datetime.now().isoformat(timespec="seconds"),
    }
    return triagem


def cmd_triar(args, verbose=True) -> dict:
    msg = args.mensagem or ""
    if args.mensagem_file:
        msg = open(os.path.expanduser(args.mensagem_file), encoding="utf-8").read().strip()
    if not msg.strip():
        print(json.dumps({"ok": False, "erro": "mensagem_vazia"}))
        raise SystemExit(2)

    faq = ler_lista(os.path.expanduser(args.faq))
    triagem = triar(msg, args.canal, faq)
    atend = ler_lista(os.path.expanduser(args.out))
    ids = {a.get("id") for a in atend}
    novo = triagem["id"] not in ids
    if novo:
        gravar_lista(os.path.expanduser(args.out), atend + [triagem])
    saida = {"novo": novo, "total": len(atend) + (1 if novo else 0), "triagem": triagem}
    if verbose:
        print(json.dumps(saida, ensure_ascii=False, indent=2))
    return saida


def cmd_listar(args, verbose=True) -> dict:
    itens = ler_lista(os.path.expanduser(args.out))
    if verbose:
        if not itens:
            print("(sem atendimentos)")
        for a in itens:
            print(f"{a.get('id')}  {a.get('canal')}  [{a.get('classificacao')}/{a.get('tema')}]  "
                  f"urgencia={a.get('urgencia')}  humano={a.get('precisa_humano')}  {a.get('motivo_escalada')}")
    return {"total": len(itens), "atendimentos": itens}


def cmd_limpar(args, verbose=True) -> dict:
    caminho = os.path.expanduser(args.out)
    itens = ler_lista(caminho)
    if verbose:
        print(json.dumps({"dry_run": not args.confirmar, "sairiam": len(itens),
                          "ids": [a.get("id") for a in itens]}, ensure_ascii=False))
    if args.confirmar and itens:
        gravar_lista(caminho, [])
    return {"antes": len(itens), "depois": len(ler_lista(caminho))}


def main() -> int:
    ap = argparse.ArgumentParser(description="triagem de atendimento (sem rede)")
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("--mensagem", default="")
    g.add_argument("--mensagem-file", default="")
    g.add_argument("--listar", action="store_true")
    g.add_argument("--limpar", action="store_true")
    ap.add_argument("--confirmar", action="store_true")
    ap.add_argument("--canal", default="instagram", choices=list(CANAIS))
    ap.add_argument("--faq", default=FAQ)
    ap.add_argument("--out", default=ATEND)
    args = ap.parse_args()

    if args.mensagem or args.mensagem_file:
        cmd_triar(args)
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
