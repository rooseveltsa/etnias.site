---
name: iara-log-publicacao
description: Registrar CADA publicacao feita em nome do Etnias com prova de quem aprovou, quando e em que URL ficou, chamando o iara-adapter — grava local em ~/.hermes/iara-data/publicacoes.json e, quando o banco estiver instalado, no Supabase sem mudar nada aqui. Usar sempre que uma peca for publicada ou quando o dono pedir "o log de publicacao", "quem aprovou", "prova de publicacao" ou auditar o historico de posts.
---

# IAra — Log de Publicacao (local-first)

Objetivo: nenhuma publicacao sem rastro. Cada publicacao vira UMA linha com
`peca_id`, `aprovador`, `canal`, `url` e `hora`.

Esta skill **nao conecta em nada**: chama o `iara-adapter`, que decide o
destino. Sem rede, sem Supabase, sem credencial.

## 1. Quando usar

- logo depois de publicar uma peca em qualquer canal
- quando o dono pede "o log", "quem aprovou", "a prova do post"
- antes de republicar: consultar se aquele `peca_id` ja saiu naquele canal

## 2. Como executar

```bash
python3 ~/.hermes/skills/iara-log-publicacao/scripts/log-publicacao.py \
  --peca-id   "etnias-opy-01" \
  --aprovador "Vytorya" \
  --canal     "instagram" \
  --url       "https://instagram.com/p/xxxx" \
  --hora      "2026-11-05T09:30:00-03:00"
```

Sem `--hora`, usa o instante atual. `--solicitacao-id` amarra a linha a uma
aprovacao: **se ela nao estiver `aprovado`, o registro e recusado** (exit 5,
`aprovacao_ausente`) — e assim que a aprovacao deixa de ser enfeite. Com
`--solicitacao-id`, `--peca-hash` passa a ser **obrigatorio** (exit 5,
`hash_obrigatorio`); com os dois, o hash e conferido contra o da aprovacao
(exit 5, `divergencia_hash`). Publicacao avulsa, sem `--solicitacao-id`, aceita
hash opcional.

Ler / validar / apagar (testes):

```bash
... --peca-id "etnias-opy-01" --consultar
... --check        # valida e sai, sem gravar
... --peca-id "etnias-opy-01" --limpar
```

Exit: `0` ok | `2` entrada invalida (aprovador vazio, canal errado, url invalida,
hora fora do ISO, `--peca-hash` que nao e hex de 32+) | `3` peca ja registrada
no canal (use `--forcar` so com ordem do dono) | `4` PII nao anonimizada
(telefone/email/CPF cru no texto) | `5` `aprovacao_ausente`, `hash_obrigatorio`
ou `divergencia_hash` | `5` `storage=supabase` sem modulo.

## 3. Campos

| campo | regra |
|---|---|
| `peca_id` | slug minusculo (`a-z 0-9 . _ -`) |
| `aprovador` | QUEM aprovou, pelo nome (`eu`/`teste` so com `--teste`) |
| `canal` | `instagram`, `tiktok`, `linkedin`, `site`, `shopee`, `enjoei`, `nuvemshop` |
| `url` | link do post, comecando com `http://` ou `https://` |
| `hora` | ISO-8601; sem valor, o script preenche |

## 4. Onde fica salvo

`~/.hermes/iara-data/publicacoes.json` (0600). Para o banco: `config.json`
com `"storage": "supabase"` — ver skill `iara-adapter`.

## 5. Regras duras

1. **Aprovacao antes do post.** Com `--solicitacao-id`, o log so aceita
   solicitacao aprovada (`iara-aprovacao`).
2. **Uma linha por publicacao.** Republicar = linha nova, nao editar a antiga.
3. **Nao inventar URL.** Plataforma sem link = espere e grave depois; link
   chutado envenena a auditoria.
4. **Nada de secret no log.** O log guarda aprovador, nao token.
5. **Banco/canal fora nao apaga prova.** Se a gravacao falhar, o evento nao e
   inventado: registra quando o destino voltar.

## 6. Legado

`scripts/log-publicacao-supabase.py` foi desativado no PEF 5-v2: nao grava, nao
le rede nem credencial, e apenas imprime a instrucao do caminho novo (exit 1).
O caminho unico agora e o adaptador.

## 7. Pitfalls

- **`--hora` sem fuso** e aceita mas ordena errado entre maquinas: em
  automacao, mande sempre com offset (`-03:00`).
- **`peca_id` com espaco ou acento** quebra o agrupamento; use slug.
- **Duplicata** no mesmo canal sai com exit 3: e guarda contra republicacao
  acidental, nao bug.
- **Apagar em vez de corrigir**: `--limpar` apaga por `peca_id`; se a peca tem
  varias publicacoes legitimas, o comando leva todas — conferir com
  `--consultar` antes.
