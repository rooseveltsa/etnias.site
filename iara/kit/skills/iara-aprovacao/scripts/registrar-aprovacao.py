#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""registrar-aprovacao.py — solicitacao e aprovacao NOMINAL (local-first).

Nao conecta em nada. Chama iara_adapter.registrar_aprovacao() /
transicionar_aprovacao(), que gravam em ~/.hermes/iara-data/aprovacoes.json
(storage=local) ou no Supabase (quando o adaptador for implementado).

    # solicitar (estado inicial rascunho, aprovado=false)
    registrar-aprovacao.py --solicitacao-id etnias-opy-01-v1 \
        --aprovador "Vytorya" --peca-hash a1b2... --canal instagram

    # aprovacao explicita (unica porta que devolve aprovado=true)
    ... --acao aprovar

    # ler de volta / validar sem gravar / apagar (testes)
    ... --acao consultar | --check | --limpar

Exit: 0 ok | 2 entrada invalida | 3 bloqueado_institucional |
      4 pii_nao_anonimizada | 5 storage=supabase sem instalar
"""
import argparse
import json
import os
import sys

sys.path.insert(0, os.path.expanduser("~/.hermes/skills/iara-adapter/scripts"))
from iara_adapter import (  # noqa: E402
    BloqueioInstitucional, ErroDeValidacao, NeedsInstall, PiiNaoAnonimizada,
    apagar_aprovacao, aviso_institucional, consultar_aprovacao, estado,
    ler_aprovacoes, registrar_aprovacao, transicionar_aprovacao,
    validar_aprovacao,)


def saida(obj, codigo=0):
    print(json.dumps(obj, indent=2, ensure_ascii=False))
    sys.exit(codigo)


def main():
    ap = argparse.ArgumentParser(description="aprovacao nominal da IAra (local-first)")
    ap.add_argument("--solicitacao-id", required=True)
    ap.add_argument("--aprovador", default="")
    ap.add_argument("--peca-hash", default="")
    ap.add_argument("--canal", default="")
    ap.add_argument("--peca-id", default="",
                    help="id da peca (chave do bloqueio institucional); "
                         "sem ele, usa a solicitacao")
    ap.add_argument("--acao", choices=["solicitar", "aprovar", "consultar", "limpar"],
                    default="solicitar")
    ap.add_argument("--check", action="store_true", help="valida e sai, sem gravar")
    ap.add_argument("--anonimizado", action="store_true",
                    help="texto ja passou por anonimizacao (libera PII conhecida)")
    ap.add_argument("--teste", action="store_true", help="aceita aprovador 'teste'/'eu'")
    a = ap.parse_args()

    try:
        if a.acao == "consultar":
            r = consultar_aprovacao(a.solicitacao_id)
            saida(dict(r, storage=estado()["storage"]), 0 if r["encontrado"] else 4)

        if a.acao == "limpar":
            antes = len(ler_aprovacoes())
            depois_apagar = apagar_aprovacao(a.solicitacao_id)
            saida({"limpo": True, "removidos": depois_apagar,
                   "antes": antes, "depois": len(ler_aprovacoes()),
                   "storage": estado()["storage"]})

        if a.check:
            rec = {"solicitacao_id": a.solicitacao_id, "aprovador": a.aprovador,
                   "peca_hash": a.peca_hash, "canal": a.canal or None}
            validar_aprovacao(rec, teste=a.teste)
            saida({"ok": True, "check": True, "aprovado": False, "valido": True,
                   "registro": rec, "storage": estado()["storage"],
                   "observacao": "aprovado:true so em --acao aprovar"})

        if a.acao == "aprovar":
            r = transicionar_aprovacao(a.solicitacao_id, a.aprovador, teste=a.teste,
                                       peca_id=a.peca_id or None)
            saida(dict(r, ok=True))

        r = registrar_aprovacao(a.solicitacao_id, a.aprovador, a.peca_hash,
                                canal=a.canal or None,
                                peca_id=a.peca_id or None,
                                teste=a.teste, anonimizado=a.anonimizado)
        r.setdefault("aviso_institucional", aviso_institucional(a.peca_id or a.solicitacao_id))
        saida(dict(r, ok=True))

    except BloqueioInstitucional as exc:
        saida(dict({"ok": False, "aprovado": False}, **exc.payload), 3)
    except PiiNaoAnonimizada as exc:
        saida(dict({"ok": False, "aprovado": False}, **exc.payload), 4)
    except ErroDeValidacao as exc:
        saida({"ok": False, "aprovado": False, "erros": [str(exc)]}, 2)
    except NeedsInstall as exc:
        saida(dict({"ok": False, "aprovado": False, "erro": str(exc)},
                   **exc.detalhes), 5)
    except ValueError as exc:  # dia/hora/int() de valor estranho
        saida({"ok": False, "aprovado": False, "erros": [str(exc)]}, 2)


if __name__ == "__main__":
    main()
