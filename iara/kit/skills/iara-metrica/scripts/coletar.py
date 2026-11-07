#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""coletar.py — metrica de UM post, MANUAL e local-first.

Nao existe Graph API aqui. Nao existe rede. Nao existe credencial.
O numero e digitado por quem le o painel do Instagram, e a linha entra
marcada com `origem: "manual"` + `aguardando_coleta_real: true` para que o
junior (ou o coletor real, um dia) saiba o que ainda falta medir.

    # grava a metrica manual de D+1
    coletar.py --publicacao-id peca-01 --dia 1 --alcance 1200 --curtidas 84

    # sem numeros: registra a coleta como pendente (so o marcador)
    coletar.py --publicacao-id peca-01 --dia 7

    # ler / validar sem gravar / apagar (testes)
    coletar.py --publicacao-id peca-01 --consultar | --check | --limpar

Exit: 0 ok | 2 entrada invalida | 5 storage=supabase sem instalar
"""
import argparse
import json
import os
import sys

sys.path.insert(0, os.path.expanduser("~/.hermes/skills/iara-adapter/scripts"))
from iara_adapter import (  # noqa: E402
    ErroDeValidacao, NeedsInstall, apagar_metrica, estado, ler_metricas,
    registrar_metrica, validar_metrica,)

NUMEROS = ("alcance", "impressoes", "curtidas", "comentarios",
           "salvamentos", "compartilhamentos")


def saida(obj, codigo=0):
    print(json.dumps(obj, indent=2, ensure_ascii=False))
    sys.exit(codigo)


def main():
    ap = argparse.ArgumentParser(description="metrica manual da IAra (local-first)")
    ap.add_argument("--publicacao-id", default="")
    ap.add_argument("--dia", type=int, default=None, help="1 ou 7")
    ap.add_argument("--canal", default="instagram")
    ap.add_argument("--origem", default="manual", choices=["manual", "coleta_real"])
    for campo in NUMEROS:
        ap.add_argument("--" + campo.replace("_", "-"), dest=campo, type=int, default=None)
    ap.add_argument("--consultar", action="store_true")
    ap.add_argument("--limpar", action="store_true")
    ap.add_argument("--check", action="store_true", help="valida e sai, sem gravar")
    a = ap.parse_args()

    try:
        if a.consultar:
            if not a.publicacao_id:
                saida({"ok": False, "erros": ["--publicacao-id obrigatorio"]}, 2)
            linhas = ler_metricas(a.publicacao_id)
            saida({"ok": True, "total": len(linhas), "registros": linhas,
                   "storage": estado()["storage"]})

        if a.limpar:
            if not a.publicacao_id:
                saida({"ok": False, "erros": ["--publicacao-id obrigatorio"]}, 2)
            antes = len(ler_metricas())
            removidos = apagar_metrica(a.publicacao_id)
            saida({"limpo": True, "removidos": removidos, "antes": antes,
                   "depois": len(ler_metricas()), "storage": estado()["storage"]})

        if not a.publicacao_id:
            saida({"ok": False, "erros": ["--publicacao-id obrigatorio"]}, 2)
        if a.dia is None:
            saida({"ok": False, "erros": ["--dia obrigatorio (1 ou 7)"]}, 2)

        rec = {"publicacao_id": a.publicacao_id, "dia": a.dia,
               "origem": a.origem, "canal": a.canal}
        rec.update({c: getattr(a, c) for c in NUMEROS})

        if a.check:
            validar_metrica(rec)
            saida({"ok": True, "check": True, "valido": True, "registro": rec,
                   "storage": estado()["storage"]})

        r = registrar_metrica(a.publicacao_id, a.dia, origem=a.origem,
                              canal=a.canal,
                              **{c: getattr(a, c) for c in NUMEROS})
        saida(dict(r, ok=True))

    except ErroDeValidacao as exc:
        saida({"ok": False, "registrado": False, "erros": [str(exc)]}, 2)
    except NeedsInstall as exc:
        saida(dict({"ok": False, "registrado": False, "erro": str(exc)},
                   **exc.detalhes), 5)
    except ValueError as exc:
        saida({"ok": False, "registrado": False, "erros": [str(exc)]}, 2)


if __name__ == "__main__":
    main()
