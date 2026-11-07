#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""LEGADO — caminho Supabase direto, substituido pelo adaptador no PEF 5-v2.

Este arquivo NAO grava nada e NAO acessa rede/credencial de proposito:

  * o destino agora e decidido por ~/.hermes/iara-data/config.json, lido pelo
    `iara_adapter` (skill iara-adapter);
  * com storage=local (padrao) a publicacao vai para
    ~/.hermes/iara-data/publicacoes.json via scripts/log-publicacao.py;
  * com storage=supabase o adaptador responde needs_install ate o junior
    implementar o modulo do banco.

Motivo de existir: manter o nome antigo respondendo com a instrucao certa em
vez de um erro de import, e garantir que nenhum caminho leia
~/.hermes/.env ou ~/.hermes/credentials/.
"""
import json
import sys

print(json.dumps({
    "ok": False,
    "legado": True,
    "erro": "script substituido pelo adaptador (PEF 5-v2)",
    "usar": "python3 ~/.hermes/skills/iara-log-publicacao/scripts/log-publicacao.py "
            "--peca-id <slug> --aprovador <nome> --canal <canal> --url <url>",
    "destino": "decidido por ~/.hermes/iara-data/config.json (storage local|supabase)",
    "rede": False,
    "credencial_lida": False,
}, indent=2, ensure_ascii=False))
sys.exit(1)
