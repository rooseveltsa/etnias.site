#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""calendario.py — pauta editorial com estado, local-first (via adaptador).

    # criar pauta (nasce em rascunho)
    calendario.py --solicitacao-id curso-letramento-01 --titulo "Curso de Letramento" \
        --canal instagram --data-prevista 2026-12-01

    # avancar UM passo na cadeia
    calendario.py --solicitacao-id curso-letramento-01 --avancar revisao

    # ler / apagar (testes)
    calendario.py --solicitacao-id curso-letramento-01 --consultar
    calendario.py --solicitacao-id curso-letramento-01 --limpar

Exit: 0 ok | 2 entrada/transicao invalida | 4 pauta nao encontrada |
      5 storage=supabase sem modulo instalado
"""
import argparse
import json
import os
import sys

sys.path.insert(0, os.path.expanduser("~/.hermes/skills/iara-adapter/scripts"))
from iara_adapter import (  # noqa: E402
    ErroDeValidacao, NeedsInstall, TRANSICOES, apagar_calendario, avancar_estado,
    estado, ler_calendario, registrar_calendario,)


def saida(obj, codigo=0):
    print(json.dumps(obj, indent=2, ensure_ascii=False))
    sys.exit(codigo)


def main():
    ap = argparse.ArgumentParser(description="calendario editorial da IAra (local-first)")
    ap.add_argument("--solicitacao-id", default="")
    ap.add_argument("--titulo", default="")
    ap.add_argument("--canal", default="instagram")
    ap.add_argument("--data-prevista", default="")
    ap.add_argument("--estado-inicial", default="rascunho")
    ap.add_argument("--avancar", default=None,
                    help="estado novo; precisa ser o proximo valido da cadeia")
    ap.add_argument("--consultar", action="store_true")
    ap.add_argument("--limpar", action="store_true")
    ap.add_argument("--transicoes", action="store_true", help="imprime a maquina de estados")
    a = ap.parse_args()

    try:
        if a.transicoes:
            saida({"maquina_de_estados": {k: sorted(v) for k, v in TRANSICOES.items()},
                   "ordem": ["rascunho", "revisao", "aprovado", "agendado",
                             "publicado", "reaproveitado"],
                   "terminais": ["reprovado", "reaproveitado"]})

        if not a.solicitacao_id:
            saida({"ok": False, "erros": ["--solicitacao-id obrigatorio"]}, 2)

        if a.consultar:
            linhas = ler_calendario(a.solicitacao_id)
            saida({"ok": True, "encontrado": bool(linhas), "total": len(linhas),
                   "registros": linhas, "storage": estado()["storage"]},
                  0 if linhas else 4)

        if a.limpar:
            antes = len(ler_calendario())
            removidos = apagar_calendario(a.solicitacao_id)
            saida({"limpo": True, "removidos": removidos, "antes": antes,
                   "depois": len(ler_calendario()), "storage": estado()["storage"]})

        if a.avancar:
            saida(dict(avancar_estado(a.solicitacao_id, a.avancar), ok=True))

        for obrig, nome in ((a.titulo, "--titulo"), (a.data_prevista, "--data-prevista")):
            if not obrig:
                saida({"ok": False, "erros": ["%s obrigatorio para criar pauta" % nome]}, 2)

        saida(dict(registrar_calendario(a.solicitacao_id, a.titulo, a.canal,
                                        a.data_prevista, a.estado_inicial), ok=True))

    except ErroDeValidacao as exc:
        saida({"ok": False, "erros": [str(exc)]}, 2)
    except NeedsInstall as exc:
        saida(dict({"ok": False, "erro": str(exc)}, **exc.detalhes), 5)
    except ValueError as exc:
        saida({"ok": False, "erros": [str(exc)]}, 2)


if __name__ == "__main__":
    main()
