#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""institucional.py — bloqueio institucional + autorizacao de imagem. Sem rede.

Tres comandos:

  classificar --peca-id X --texto "..."     diz se a peca e institucional
  verificar_autorizacao --peca-id X --imagens foto-001,foto-002
                                            confere `autorizacao` na biblioteca
  registrar_aprovador_institucional --peca-id X --aprovador "Nome"
                                            desbloqueia com nome de gente
  status --peca-id X                        releitura do estado consolidado

Regras:
  * institucional = sinal no texto (nota publica, denuncia, crise, ameaca,
    violencia, direito territorial, acao judicial, posicionamento oficial);
  * peca institucional so libera com `aprovador_institucional` nominal;
  * imagem sem `autorizacao` (ou revogada, ou fora da biblioteca) bloqueia;
  * quem decide o que e institucional aqui e palavra-chave, nao modelo.

Exit: 0 ok (inclusive bloqueado) | 2 entrada invalida | 3 arquivo ilegivel
"""
import argparse
import json
import os
import re
import sys
import uuid
from datetime import datetime

BASE = os.path.expanduser("~/.hermes/iara-data")
INSTITUCIONAL = os.path.join(BASE, "institucional.json")
BIBLIOTECA = os.path.join(BASE, "biblioteca.json")

ACENTOS = str.maketrans(
    "áàâãäåéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÅÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ",
    "aaaaaaeeeeiiiiooooouuuucnaaaaaaeeeeiiiiooooouuuucn")

# sinal institucional por categoria (a palavra-chave e dobrada na hora de casar)
CATEGORIAS = {
    "nota_publica": ["nota pública", "nota publica", "nota oficial", "comunicado oficial",
                     "carta aberta"],
    "posicionamento": ["posicionamento oficial", "nos posicionamos", "manifesto público",
                       "manifesto publico", "repudiamos"],
    "denuncia": ["denúncia", "denuncia", "denunciamos", "violação de direitos",
                 "violacao de direitos"],
    "crise": ["crise", "emergência", "emergencia", "situação crítica",
              "situacao critica", "urgente"],
    "ameaca": ["ameaça", "ameaca", "ameaçado", "ameacado", "intimidação", "intimidacao",
               "atentado"],
    "violencia": ["violência", "violencia", "agressão", "agressao", "ataque", "invasão",
                  "invasao", "despejo"],
    "territorio": ["direito territorial", "demarcação", "demarcacao", "território tradicional",
                   "territorio tradicional", "retomada"],
    "judicial": ["ação judicial", "acao judicial", "processo judicial", "liminar",
                 "adpf", "stf", "ministério público", "ministerio publico"],
}

TIPOS_AUTORIZACAO = ("liberada", "restrita", "revogada")
CAMPOS_AUTORIZACAO = ("autor", "tipo", "documento")


def dobra(texto):
    return (texto or "").translate(ACENTOS).lower()


def agora():
    return datetime.now().astimezone().isoformat(timespec="seconds")


def carregar(caminho, nome):
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


def agora_registros():
    return carregar(INSTITUCIONAL, "institucional.json")


def registrar(registro):
    lista = agora_registros()
    registro.setdefault("id", str(uuid.uuid4()))
    registro.setdefault("criado_em", agora())
    lista.append(registro)
    gravar(INSTITUCIONAL, lista)
    return registro


# ------------------------------------------------------------------ consultas
def aprovador_de(peca_id):
    """Ultimo aprovador institucional registrado para a peca (ou None)."""
    for r in reversed(agora_registros()):
        if r.get("tipo_registro") == "aprovador_institucional" \
                and r.get("peca_id") == peca_id and r.get("aprovador"):
            return r["aprovador"]
    return None


def classificacao_de(peca_id):
    for r in reversed(agora_registros()):
        if r.get("tipo_registro") == "classificacao" and r.get("peca_id") == peca_id:
            return r
    return None


def esta_bloqueado(peca_id):
    """Porta para outras skills: bloqueio institucional pendente?"""
    c = classificacao_de(peca_id)
    if not c or not c.get("institucional"):
        return False
    return not aprovador_de(peca_id)


# ---------------------------------------------------------------- classificacao
def detectar(texto):
    alvo = dobra(texto)
    achados = {}
    for categoria, chaves in CATEGORIAS.items():
        casadas = []
        for k in chaves:
            padrao = r"\b" + re.escape(dobra(k)) + r"\b"
            if re.search(padrao, alvo):
                casadas.append(k)
        if casadas:
            achados[categoria] = casadas
    return achados


def cmd_classificar(peca_id, texto, teste=False):
    achados = detectar(texto)
    institucional = bool(achados)
    aprovador = aprovador_de(peca_id)
    bloqueado = institucional and not aprovador

    if institucional:
        motivo = "sinal institucional: " + "; ".join(
            "%s (%s)" % (cat, ", ".join(kws[:3])) for cat, kws in achados.items())
    else:
        motivo = "sem sinal institucional no texto"

    registro = registrar({
        "tipo_registro": "classificacao", "peca_id": peca_id,
        "institucional": institucional, "bloqueado": bloqueado,
        "motivo": motivo, "categorias": sorted(achados),
        "aprovador_institucional": aprovador,
    })
    return {"ok": True, "peca_id": peca_id, "institucional": institucional,
            "bloqueado": bloqueado, "motivo": motivo,
            "categorias": sorted(achados), "aprovador_institucional": aprovador,
            "registro": registro}


# ------------------------------------------------------------------ autorizacao
def avaliar_imagens(imagens):
    biblioteca = carregar(BIBLIOTECA, "biblioteca.json")
    por_id = {b.get("item_id"): b for b in biblioteca}
    problemas, restritas, ok = [], [], []
    for item_id in imagens:
        item = por_id.get(item_id)
        if item is None:
            problemas.append({"item_id": item_id, "motivo": "item_fora_da_biblioteca"})
            continue
        aut = item.get("autorizacao")
        if not isinstance(aut, dict) or not aut:
            problemas.append({"item_id": item_id, "motivo": "autorizacao_ausente"})
            continue
        faltando = [c for c in CAMPOS_AUTORIZACAO if not str(aut.get(c) or "").strip()]
        tipo = str(aut.get("tipo") or "").strip().lower()
        if tipo not in TIPOS_AUTORIZACAO:
            problemas.append({"item_id": item_id,
                              "motivo": "tipo_invalido: %r" % aut.get("tipo")})
            continue
        if tipo == "revogada":
            problemas.append({"item_id": item_id, "motivo": "autorizacao_revogada"})
            continue
        if faltando:
            problemas.append({"item_id": item_id,
                              "motivo": "autorizacao_incompleta: falta %s" % faltando})
            continue
        if tipo == "restrita":
            restritas.append({"item_id": item_id, "autor": aut.get("autor"),
                              "documento": aut.get("documento")})
        ok.append(item_id)
    return problemas, restritas, ok


def cmd_verificar(peca_id, imagens):
    if not imagens:
        return {"ok": False, "erro": "--imagens vazio: nada a verificar"}, 2

    problemas, restritas, ok = avaliar_imagens(imagens)
    bloqueado = bool(problemas)
    motivo = ("imagem_sem_autorizacao" if bloqueado
              else ("autorizacao_restrita: conferir uso antes de publicar"
                    if restritas else "todas as imagens com autorizacao liberada"))

    registro = registrar({
        "tipo_registro": "autorizacao", "peca_id": peca_id,
        "imagens": imagens, "bloqueado": bloqueado, "motivo": motivo,
        "problemas": problemas, "restritas": restritas, "liberadas": ok,
    })
    return {"ok": True, "peca_id": peca_id, "imagens": imagens,
            "bloqueado": bloqueado, "motivo": motivo, "problemas": problemas,
            "restritas": restritas, "liberadas": ok, "registro": registro}, 0


# ------------------------------------------------------------------ aprovador
def cmd_registrar_aprovador(peca_id, aprovador, teste=False):
    nome = (aprovador or "").strip()
    if not nome:
        return {"ok": False, "erro": "aprovador vazio: desbloqueio sem nome nao vale",
                "bloqueado": True}, 2
    if nome.lower() in {"eu", "teste"} and not teste:
        return {"ok": False,
                "erro": "aprovador '%s' nao vale como institucional (use o nome)" % nome,
                "bloqueado": True}, 2

    classificacao = classificacao_de(peca_id)
    registro = registrar({
        "tipo_registro": "aprovador_institucional", "peca_id": peca_id,
        "aprovador": nome,
        "era_institucional": bool(classificacao and classificacao.get("institucional")),
    })
    return {"ok": True, "peca_id": peca_id, "aprovador": nome,
            "bloqueado": False, "registro": registro}, 0


def cmd_status(peca_id):
    c = classificacao_de(peca_id) or {}
    aprovador = aprovador_de(peca_id)
    institucional = bool(c.get("institucional"))
    auts = [r for r in agora_registros()
            if r.get("tipo_registro") == "autorizacao" and r.get("peca_id") == peca_id]
    ultima_aut = auts[-1] if auts else None
    bloqueado_aut = bool(ultima_aut and ultima_aut.get("bloqueado"))
    return {"ok": True, "peca_id": peca_id, "institucional": institucional,
            "aprovador_institucional": aprovador,
            "bloqueado_institucional": institucional and not aprovador,
            "bloqueado_autorizacao": bloqueado_aut,
            "bloqueado": (institucional and not aprovador) or bloqueado_aut,
            "ultima_verificacao_autorizacao": ultima_aut}


def main():
    ap = argparse.ArgumentParser(description="bloqueio institucional e autorizacao de imagem")
    sub = ap.add_subparsers(dest="cmd", required=True)

    c = sub.add_parser("classificar")
    c.add_argument("--peca-id", required=True)
    c.add_argument("--texto", required=True)
    c.add_argument("--teste", action="store_true")

    v = sub.add_parser("verificar_autorizacao")
    v.add_argument("--peca-id", required=True)
    v.add_argument("--imagens", required=True)

    r = sub.add_parser("registrar_aprovador_institucional")
    r.add_argument("--peca-id", required=True)
    r.add_argument("--aprovador", required=True)
    r.add_argument("--teste", action="store_true")

    s = sub.add_parser("status")
    s.add_argument("--peca-id", required=True)

    lim = sub.add_parser("limpar")
    lim.add_argument("--peca-id", required=True)

    a = ap.parse_args()

    if a.cmd == "classificar":
        saida = cmd_classificar(a.peca_id, a.texto, a.teste)
        codigo = 0
    elif a.cmd == "verificar_autorizacao":
        saida, codigo = cmd_verificar(a.peca_id,
                                      [i.strip() for i in a.imagens.split(",") if i.strip()])
    elif a.cmd == "registrar_aprovador_institucional":
        saida, codigo = cmd_registrar_aprovador(a.peca_id, a.aprovador, a.teste)
    elif a.cmd == "status":
        saida, codigo = cmd_status(a.peca_id), 0
    else:  # limpar
        lista = agora_registros()
        antes = len(lista)
        ficaram = [x for x in lista if x.get("peca_id") != a.peca_id]
        gravar(INSTITUCIONAL, ficaram)
        saida = {"ok": True, "limpo": True, "peca_id": a.peca_id,
                 "antes": antes, "depois": len(ficaram),
                 "removidos": antes - len(ficaram)}
        codigo = 0

    print(json.dumps(saida, indent=2, ensure_ascii=False))
    return codigo


if __name__ == "__main__":
    sys.exit(main())
