#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""biblioteca.py — referencia de acervo por ID, local-first (via adaptador).

REGRA CRITICA: guarda so ID + metadado (+ o caminho como texto). Nunca abre,
copia, converte ou embute o arquivo. Nao existe base64 aqui.

    biblioteca.py --item-id etnias-video-001 --tipo video \
        --titulo "Retrospectiva 2026" \
        --metadado '{"duracao_s": 32, "autorizacao": "pendente"}'

    # referencia a arquivo existente: grava SO o caminho
    biblioteca.py --item-id card-opy-01 --tipo card --titulo "Capa Opy" \
        --caminho-referencia /caminho/absoluto/para/capa.png

    biblioteca.py --item-id etnias-video-001 --consultar
    biblioteca.py --item-id etnias-video-001 --limpar

Exit: 0 ok | 2 entrada invalida | 4 item nao encontrado | 5 supabase sem modulo
"""
import argparse
import json
import os
import sys

sys.path.insert(0, os.path.expanduser("~/.hermes/skills/iara-adapter/scripts"))
from iara_adapter import (  # noqa: E402
    ErroDeValidacao, NeedsInstall, TIPOS_BIB, apagar_biblioteca, estado,
    ler_biblioteca, registrar_biblioteca,)


def saida(obj, codigo=0):
    print(json.dumps(obj, indent=2, ensure_ascii=False))
    sys.exit(codigo)


def main():
    ap = argparse.ArgumentParser(description="biblioteca por ID da IAra (local-first)")
    ap.add_argument("--item-id", default="")
    ap.add_argument("--tipo", default="")
    ap.add_argument("--titulo", default="")
    ap.add_argument("--metadado", default="",
                    help="JSON com o metadado (nao vai arquivo aqui)")
    ap.add_argument("--caminho-referencia", default=None,
                    help="caminho absoluto do arquivo: gravado como TEXTO, sem abrir")
    ap.add_argument("--consultar", action="store_true")
    ap.add_argument("--limpar", action="store_true")
    ap.add_argument("--tipos", action="store_true")
    a = ap.parse_args()

    try:
        if a.tipos:
            saida({"tipos": sorted(TIPOS_BIB)})

        if not a.item_id:
            saida({"ok": False, "erros": ["--item-id obrigatorio"]}, 2)

        if a.consultar:
            linhas = ler_biblioteca(a.item_id)
            saida({"ok": True, "encontrado": bool(linhas), "total": len(linhas),
                   "registros": linhas, "storage": estado()["storage"]},
                  0 if linhas else 4)

        if a.limpar:
            antes = len(ler_biblioteca())
            removidos = apagar_biblioteca(a.item_id)
            saida({"limpo": True, "removidos": removidos, "antes": antes,
                   "depois": len(ler_biblioteca()), "storage": estado()["storage"]})

        metadado = {}
        if a.metadado:
            try:
                metadado = json.loads(a.metadado)
            except json.JSONDecodeError as exc:
                saida({"ok": False, "erros": ["--metadado nao e JSON valido: %s" % exc]}, 2)

        saida(dict(registrar_biblioteca(a.item_id, a.tipo, a.titulo, metadado,
                                        a.caminho_referencia), ok=True))

    except ErroDeValidacao as exc:
        saida({"ok": False, "erros": [str(exc)]}, 2)
    except NeedsInstall as exc:
        saida(dict({"ok": False, "erro": str(exc)}, **exc.detalhes), 5)
    except ValueError as exc:
        saida({"ok": False, "erros": [str(exc)]}, 2)


if __name__ == "__main__":
    main()
