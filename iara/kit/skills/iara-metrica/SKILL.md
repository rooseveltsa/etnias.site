---
name: iara-metrica
description: Registrar metrica de um post (D+1 e D+7) de forma MANUAL e local-first, chamando o iara-adapter — grava em ~/.hermes/iara-data/metricas.json com origem manual e aguardando_coleta_real=true. Nao usa Graph API, nao usa rede, nao usa token. Usar quando o dono pedir "como o post performou", "anota o alcance", "fechamento da semana" ou quando o junior digitar os numeros do painel.
---

# IAra — Metrica (manual, local-first)

Objetivo: cada post publicado ganha duas leituras (D+1 e D+7) para o
fechamento semanal e para o calendario editorial decidir o que repetir.

**Nao existe Graph API aqui.** Nao existe rede. Nao existe token. O numero e
digitado por quem le o painel do Instagram, e a linha entra marcada com
`origem: "manual"` e `aguardando_coleta_real: true` — o marcador e honesto: o
dado de hoje e leitura humana, nao coleta automatica.

## 1. Contrato

Entrada:

- `--publicacao-id` — id/slug da publicacao (`peca_id` do log)
- `--dia` — `1` ou `7` (obrigatorio)
- `--canal` — default `instagram`
- `--origem` — `manual` (padrao) ou `coleta_real` (so quando o coletor existir)
- numeros, todos opcionais: `--alcance`, `--impressoes`, `--curtidas`,
  `--comentarios`, `--salvamentos`, `--compartilhamentos`

Saida: uma linha em `~/.hermes/iara-data/metricas.json` com os campos acima,
`origem`, `aguardando_coleta_real`, `coleta_em` e `id`.

## 2. Como rodar

```bash
# D+1 com os numeros do painel
python3 ~/.hermes/skills/iara-metrica/scripts/coletar.py \
  --publicacao-id "etnias-opy-01" --dia 1 \
  --alcance 1200 --impressoes 1800 --curtidas 84 --comentarios 6

# D+7 so marcando que a coleta esta pendente (sem numeros)
python3 ~/.hermes/skills/iara-metrica/scripts/coletar.py \
  --publicacao-id "etnias-opy-01" --dia 7

# ler / validar / apagar (testes)
... --publicacao-id "etnias-opy-01" --consultar
... --check
... --publicacao-id "etnias-opy-01" --limpar
```

Exit: `0` ok | `2` entrada invalida | `5` `storage=supabase` sem modulo.

## 3. O que foi removido do script antigo

O `coletar.py` anterior chamava `https://graph.facebook.com/v21.0`, lia
`~/.hermes/credentials/meta-etnias.json` e gravava em `"iara-core".iara_metricas`
via `SUPABASE_SERVICE_ROLE_KEY`. Tudo isso saiu: o arquivo atual nao importa
`urllib`, nao le `.env`, nao le credencial. Quando o junior instalar o coletor
real, ele entra como `origem: "coleta_real"` e — opcionalmente — como um
adaptador novo, nunca no meio desta skill.

## 4. Ordem de coleta (D+1 e D+7)

| quando | o que fazer |
|---|---|
| D+1 | ler o painel e registrar `--dia 1` com os numeros do primeiro dia |
| D+7 | reler e registrar `--dia 7` (o numero de 7 dias, nao a soma) |
| fechamento | comparar `dia 1` x `dia 7` por peca; repetir formato do que cresceu |

Sem coleta automatica, o lembrete e humano: entre no `iara-data/metricas.json`
ou peca "quais publicacoes ainda estao sem metrica" — o criterio e simples,
publicacao sem linha `dia: 1` esta pendente.

## 5. Regras duras

1. **Numero lido, nao estimado.** Se nao leu o painel, registre sem numeros
   (`aguardando_coleta_real` fica true) — nunca chute.
2. **D+7 nao e soma dos 7 dias.** E a leitura acumulada do post no setimo dia.
3. **Uma linha por publicacao+dia.** Recoletar = apagar a linha antiga e
   gravar de novo (o script nao duplica por conta propria: `--limpar` antes).
4. **`origem` sempre declarada.** `manual` e honestidade, nao vergonha.

## 6. Pitfalls

- **`--dia` fora de 1/7 e erro** (exit 2), de proposito: metrica solta em dia
  aleatorio nao entra em fechamento nenhum.
- **Numero negativo ou texto** e recusado — o adaptador valida inteiro ≥ 0.
- **Sem `--publicacao-id`** o script recusa: metrica orfa nao tem como ser
  cruzada com o post.
- **`aguardando_coleta_real` nao se apaga a mao**: ele e o rastro de que aquele
  numero veio de leitura humana.
