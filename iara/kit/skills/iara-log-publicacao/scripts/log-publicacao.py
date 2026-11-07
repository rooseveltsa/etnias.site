#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""log-publicacao.py — registra a publicacao (local-first, via adaptador).

Grava em ~/.hermes/iara-data/publicacoes.json quando storage=local.
Sem rede, sem Supabase, sem credencial.

    log-publicacao.py --peca-id etnias-opy-01 --aprovador "Vytorya" \
        --canal instagram --url https://instagram.com/p/xxxx \
        --hora 2026-11-05T09:30:00-03:00

    # ligado a uma aprovacao (recusa se ela nao estiver aprovada)
    ... --solicitacao-id etnias-opy-01-v1

    # ler / validar sem gravar / apagar (testes)
    ... --consultar | --check | --limpar

Exit: 0 ok | 2 entrada invalida | 3 peca_id ja registrada no canal |
      4 pii_nao_anonimizada | 5 divergencia_hash ou aprovacao_ausente |
      5 storage=supabase sem instalar
"""
import argparse
import json
import os
import sys

sys.path.insert(0, os.path.expanduser("~/.hermes/skills/iara-adapter/scripts"))
from iara_adapter import (  # noqa: E402
    ErroDeValidacao, IntegridadePublicacao, NeedsInstall, PiiNaoAnonimizada,
    apagar_publicacao, estado, ler_publicacoes, registrar_publicacao,
    validar_publicacao,)


def saida(obj, codigo=0):
    print(json.dumps(obj, indent=2, ensure_ascii=False))
    sys.exit(codigo)


def main():
    ap = argparse.ArgumentParser(description="log de publicacao da IAra (local-first)")
    ap.add_argument("--peca-id", default="")
    ap.add_argument("--aprovador", default="")
    ap.add_argument("--canal", default="")
    ap.add_argument("--url", default="")
    ap.add_argument("--hora", default=None)
    ap.add_argument("--solicitacao-id", default=None)
    ap.add_argument("--peca-hash", default=None,
                    help="hash do que foi publicado; conferido contra a aprovacao")
    ap.add_argument("--anonimizado", action="store_true",
                    help="texto ja passou por anonimizacao (libera PII conhecida)")
    ap.add_argument("--consultar", action="store_true", help="lista as publicacoes da peca")
    ap.add_argument("--limpar", action="store_true", help="apaga as linhas da peca (testes)")
    ap.add_argument("--check", action="store_true", help="valida e sai, sem gravar")
    ap.add_argument("--teste", action="store_true", help="aceita aprovador 'teste'/'eu'")
    ap.add_argument("--forcar", action="store_true",
                    help="permite a mesma peca no mesmo canal (republicacao)")
    a = ap.parse_args()

    try:
        if a.consultar:
            if not a.peca_id:
                saida({"ok": False, "erros": ["--peca-id obrigatorio para consultar"]}, 2)
            linhas = ler_publicacoes(a.peca_id)
            saida({"ok": True, "total": len(linhas), "registros": linhas,
                   "storage": estado()["storage"]})

        if a.limpar:
            if not a.peca_id:
                saida({"ok": False, "erros": ["--peca-id obrigatorio para limpar"]}, 2)
            antes = len(ler_publicacoes())
            removidos = apagar_publicacao(a.peca_id)
            saida({"limpo": True, "removidos": removidos, "antes": antes,
                   "depois": len(ler_publicacoes()), "storage": estado()["storage"]})

        for obrig in ("peca_id", "aprovador", "canal", "url"):
            if not getattr(a, obrig):
                saida({"ok": False, "erros": ["--%s obrigatorio" % obrig.replace("_", "-")]}, 2)

        if a.check:
            rec = {"peca_id": a.peca_id, "aprovador": a.aprovador, "canal": a.canal,
                   "url": a.url, "hora": a.hora or "2026-01-01T00:00:00"}
            validar_publicacao(rec, teste=a.teste)
            saida({"ok": True, "check": True, "valido": True, "registro": rec,
                   "storage": estado()["storage"]})

        if not a.forcar:
            for r in ler_publicacoes(a.peca_id):
                if r.get("canal") == a.canal.lower():
                    saida({"ok": False, "registrado": False,
                           "erro": "peca %r ja registrada no canal %r em %s "
                                   "(use --forcar so com ordem do dono)"
                                   % (a.peca_id, a.canal, r.get("publicado_em"))}, 3)

        r = registrar_publicacao(a.peca_id, a.aprovador, a.canal.lower(), a.url,
                                 hora=a.hora, solicitacao_id=a.solicitacao_id,
                                 peca_hash=a.peca_hash, teste=a.teste,
                                 anonimizado=a.anonimizado)
        saida(dict(r, ok=True))

    except IntegridadePublicacao as exc:
        saida(dict({"ok": False, "registrado": False, "publicado": False},
                   **exc.payload), 5)
    except PiiNaoAnonimizada as exc:
        saida(dict({"ok": False, "registrado": False, "publicado": False},
                   **exc.payload), 4)
    except ErroDeValidacao as exc:
        saida({"ok": False, "registrado": False, "erros": [str(exc)]}, 2)
    except NeedsInstall as exc:
        saida(dict({"ok": False, "registrado": False, "erro": str(exc)},
                   **exc.detalhes), 5)
    except ValueError as exc:
        saida({"ok": False, "registrado": False, "erros": [str(exc)]}, 2)


if __name__ == "__main__":
    main()
