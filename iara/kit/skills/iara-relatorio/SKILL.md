---
name: iara-relatorio
description: Gerar relatório de texto a partir dos JSONs locais da IAra (publicações, métricas, aprovações, calendário) — período, total de publicações, top 3 e pior por alcance, distribuição por canal, tempo médio de aprovação, comparativo entre períodos e até 5 recomendações por regra, gravando em ~/.hermes/iara-data/relatorios.json. Número inexistente aparece como "sem dado", nunca como zero inventado. Usar quando o dono pedir "relatório do mês", "como o perfil performou", "fechamento", "o que repetir" ou "comparar com o mês passado".
---

# IAra — Relatório Inteligente

Objetivo: transformar os registros locais em decisão ("o que repetir", "o que
travou"). Só lê JSON do próprio `iara-data`; não busca nada fora, não inventa
número, não desenha gráfico.

Sem rede, sem credencial, sem Supabase.

## 1. Contrato

```bash
relatar.py --periodo 2026-11                    # mês fechado
relatar.py --de 2026-11-01 --ate 2026-11-30     # intervalo livre
relatar.py --consultar
relatar.py --limpar --periodo 2026-11           # ou --id <uuid>
```

Saída em `~/.hermes/iara-data/relatorios.json` (0600, acrescenta):

```json
{"id":"<uuid>","periodo":"2026-11","tipo_periodo":"mes","sem_dado":false,
 "indicadores":{
   "total_publicacoes":3,"total_aprovacoes":0,"total_metricas":3,
   "top_3_alcance":[{"peca_id":"peca-a","alcance":5000},...],
   "pior_alcance":{"peca_id":"peca-c","alcance":1000},
   "distribuicao_canal":{"instagram":3},
   "canais_sem_publicacao":[],
   "alcance_total":8000,"alcance_medio":2666.67,
   "tempo_medio_aprovacao_horas":null,
   "publicacoes_sem_metrica":[],
   "sem_dado":["tempo_medio_aprovacao_horas","total_aprovacoes"]},
 "comparativo":{"periodo_anterior":"2026-10","sem_dado":false,
   "publicacoes":{"anterior":2,"atual":3,"variacao_pct":50.0},
   "alcance_total":{"anterior":2000,"atual":8000,"variacao_pct":300.0},
   "alcance_medio":{"anterior":1000.0,"atual":2666.67,"variacao_pct":166.67}},
 "recomendacoes":[{"regra":"repetir_formato","texto":"..."}],
 "texto":"RELATORIO 2026-11\n...","gerado_em":"..."}
```

`texto` é o relatório em **ASCII puro** (sem acento), pronto para colar no
WhatsApp ou em outra ferramenta.

## 2. Como os números são apurados

| indicador | fonte | regra |
|---|---|---|
| `total_publicacoes` | `publicacoes.json` | filtra por `publicado_em` no período |
| `total_metricas` | `metricas.json` | só as ligadas a publicação do período |
| `alcance` de um post | `metricas.json` | métrica de **maior `dia`** (7 vence 1) — não soma |
| `top_3_alcance` / `pior_alcance` | idem | ordena por alcance desc |
| `distribuicao_canal` | `publicacoes.json` | conta por `canal` |
| `canais_sem_publicacao` | `calendario.json` | canal que está na pauta e não publicou |
| `tempo_medio_aprovacao_horas` | `aprovacoes.json` | média de `aprovado_em - criado_em` |
| `comparativo` | mesmo cálculo | período = mês anterior ao pedido |

Publicação sem métrica **não vira alcance 0**: entra em `publicacoes_sem_metrica`
e o indicador fica `null` + nome na lista `sem_dado`.

## 3. Recomendações (máx. 5, por regra)

| regra | quando dispara | o que diz |
|---|---|---|
| `sem_publicacao` | 0 publicações no período | conferir pauta aprovada e log |
| `repetir_formato` | top 1 > 2× a média | repetir o formato do post |
| `revisar_formato` | pior < 0,5× a média | revisar formato/horário |
| `canal_parado` | canal no calendário com 0 posts | verificar se a pauta travou |
| `aprovacao_lenta` | tempo médio > 24h | acelerar a fila |
| `coleta_pendente` | publicação sem métrica | rodar coleta manual D+1/D+7 |
| `queda_publicacao` | queda ≥ 30% vs mês anterior | revisar a grade |

Só entram as 5 primeiras que dispararem, na ordem acima. Recomendação sem dado
para sustentar **não aparece** (nada de conselho genérico).

## 4. Regras duras

1. **Nunca inventar número.** Sem métrica → `null` + `sem_dado` + texto
   "sem dado".
2. **Só leitura dos JSONs de origem.** O script não escreve em
   `publicacoes/metricas/aprovacoes/calendario`.
3. **`relatorios.json` só acrescenta.** Arquivo ilegível → exit 3, sem zerar.
4. **Comparativo exige `--periodo`** (mês). Intervalo livre não compara, porque
   "mês anterior" de um intervalo arbitrário é arbitrário.
5. **Alcance de post = leitura mais recente**, não soma de D+1 com D+7 (somar
   contaria a mesma pessoa duas vezes).

## 5. Uso no fluxo

```
iara-log-publicacao + iara-metrica (dados)
   → iara-relatorio (este passo)     → recomendação
   → iara-calendario (o que entra na pauta do mês seguinte)
```

Relatório é insumo de decisão, não peça publicável: não passa por
`iara-revisao` nem por aprovação.

## 6. Pitfalls

- **`publicacoes.json` vazio** faz o relatório inteiro sair `sem_dado: true` —
  é o comportamento correto, não erro. Se o dono esperava número, o problema
  está no log, não no relatório.
- **Métrica órfã** (publicação não está no período) é ignorada de propósito:
  alcance de post de outro mês não entra no fechamento deste.
- **`dia` ausente** na métrica é tratado como 1; dado antigo pode não ter o
  campo.
- **Comparativo falso** acontece se o mês anterior tiver 1 post e o atual 3:
  +200% não significa crescimento, significa base pequena — o texto mostra os
  valores absolutos junto justamente para isso.
- **Dois relatórios do mesmo mês** convivem no arquivo (append). Para saber
  qual é o atual, use `gerado_em`, não a ordem.
