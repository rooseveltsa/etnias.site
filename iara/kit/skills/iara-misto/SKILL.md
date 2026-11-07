---
name: iara-misto
description: Montar o ROTEIRO de um vídeo misto (segmentos de acervo + segmentos gerados por IA) em ~/.hermes/iara-data/mistos.json, com tema, objetivo, duração-alvo, narração, legenda e status rascunho. Valida cada item_id contra biblioteca.json e falha com item_inexistente quando o ID não existe — nunca inventa acervo. Não gera vídeo, apenas o roteiro; o render fica com a skill de audiovisual. Usar quando o dono pedir "monta um roteiro", "vídeo com material nosso + IA", "mistura acervo com geração" ou antes de produzir um vídeo institucional.
---

# IAra — Conteúdo Misto (roteiro)

Objetivo: ter o **roteiro** antes da produção. Segmentos de acervo (o que já
existe, com ID) + segmentos de IA (o que precisa ser gerado, com descrição),
cada um com duração, narração e legenda.

Esta skill **não gera vídeo**, não chama modelo, não abre arquivo de mídia, não
toca em rede. Só escreve JSON.

## 1. Contrato

```bash
montar.py --tema "governanca de dados" --objetivo informar \
          --duracao-alvo 30 --referencias video-001,foto-001
montar.py --tema "retrospectiva do ano" --objetivo retrospectiva --duracao-alvo 30
montar.py --consultar
montar.py --limpar --tema "..."        # ou --id
```

| campo | regra |
|---|---|
| `--tema` | obrigatório, texto livre |
| `--objetivo` | `divulgar` \| `informar` \| `retrospectiva` \| `institucional` (padrão `informar`) |
| `--duracao-alvo` | segundos, 5..600 (padrão 30) |
| `--referencias` | lista separada por vírgula de `item_id` **que existe em `biblioteca.json`** |

Exit: `0` roteiro gravado | `2` entrada inválida **ou** ID inexistente |
`3` `mistos.json` ilegível.

## 2. Regra crítica: ID não se inventa

Cada `--referencias` é conferida contra `biblioteca.json`. Um ID que não está
lá faz o roteiro inteiro falhar:

```json
{"ok": false, "item_inexistente": true, "ids_invalidos": ["video-999"],
 "ids_disponiveis": ["foto-001", "video-001"]}
```

Nada é gravado nesse caso. Se o acervo não tem o material, o caminho é
registrar na `iara-biblioteca` primeiro ou trocar o segmento para `ia`.

## 3. Como o roteiro é montado

1. Cada referência válida vira um segmento `tipo: "biblioteca"` com `item_id`,
   `titulo` e `tipo_acervo` (copiados do índice — não inventados).
2. A cota de acervo é **60% do alvo**, dividida igualmente, limitada a
   **12s por segmento** (trecho de acervo não vira bloco arrastado).
3. O que sobra é preenchido com segmentos `tipo: "ia"` de ~6s, cada um com
   `descricao` do que gerar e foco diferente (contexto → prática → chamada).
4. `duracao_total` é conferido: tem que fechar **exatamente** com
   `duracao_alvo` (campo `duracao_ok`).
5. `status` nasce `"rascunho"` — roteiro não é peça aprovada.

Segmento:

```json
{"ordem":1,"tipo":"biblioteca","duracao_s":9,"item_id":"video-001",
 "titulo":"Retrospectiva 2026","tipo_acervo":"video",
 "narracao":"Explicar o ponto central de ... sem numero que nao esteja na fonte.",
 "legenda":"Retrospectiva 2026 | governanca de dados"}
```

```json
{"ordem":3,"tipo":"ia","duracao_s":6,
 "descricao":"Infografico animado com o conceito de ... — foco: contexto",
 "narracao":"... Ponto 1: contexto.","legenda":"..."}
```

## 4. O que a narração é (e não é)

É **diretiva de roteiro**: diz o que falar e qual material usar. Não é texto
factual final — não carrega número, nome ou data inventada. Por isso o roteiro
nasce `rascunho` e a narração passa por `iara-revisao` antes de gravar.

## 5. Fluxo

```
iara-biblioteca (IDs do acervo)
   → iara-misto (roteiro)          ← este passo
   → iara-revisao (texto da narração/legenda)
   → skill de audiovisual F19/F20 (render real)
   → iara-aprovacao → iara-log-publicacao
```

## 6. Regras duras

1. **Nenhum ID fora do índice.** Falha com `item_inexistente`, sem gravar.
2. **Não gera vídeo.** Se pediram arquivo de vídeo, esta skill não é a
   ferramenta — é a F19/F20.
3. **Duração fecha.** Se a soma não bate com o alvo, `duracao_ok: false` e o
   roteiro precisa ser refeito.
4. **`mistos.json` só acrescenta.** Arquivo ilegível → exit 3, sem zerar.
5. **Sem rede e sem credencial.** O acervo é um índice local.

## 7. Pitfalls

- **`--referencias` com espaço** (`"video-001, foto-001"`) funciona (o script
  faz `strip`), mas vírgula sobrando gera item vazio que é ignorado — conferir
  `referencias_pedidas` no JSON.
- **Alvo curto com muitas referências** (5s e 3 IDs) excede a cota: o script
  corta segmentos e completa com IA para fechar o alvo. Conferir `n_biblioteca`.
- **Item de acervo com `metadado.duracao_s`** não é respeitado: a cota vem do
  alvo, não do metadado (o roteiro manda; o material se ajusta no corte).
- **Roteiro duplicado**: dois `--tema` iguais geram dois registros. É de
  propósito (versão A/B de roteiro); use `--limpar --id` no antigo.
- **`status` sempre `rascunho`**: nada nesta skill promove roteiro para
  aprovado — isso é da `iara-aprovacao`.
