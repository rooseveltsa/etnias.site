---
name: iara-marketing
description: Montar plano de campanha a partir de um briefing em texto livre (objetivo, público, prazo) e gravar em ~/.hermes/iara-data/campanhas.json com objetivo, público, mensagem principal, 3 mensagens de apoio, canais, calendário de 7 dias, meta mensurável e status rascunho. Referencia dossiê e pauta por ID (nunca copia conteúdo) e, sem base, monta plano estrutural sem afirmar fato. Usar quando o dono pedir "plano de campanha", "campanha para X", "como divulgar isso", "estratégia do mês".
---

# IAra — Marketing (plano de campanha)

Objetivo: transformar um briefing em plano executável de 7 dias, rastreável e
sem invenção. O plano nasce `rascunho`: só a aprovação humana o promove.

## 1. Contrato

```bash
planejar.py --briefing "campanha de letramento para jovens"
planejar.py --briefing-file /tmp/briefing.txt
planejar.py --listar
planejar.py --limpar            # dry-run: conta o que sairia
planejar.py --limpar --confirmar
```

Saída: `~/.hermes/iara-data/campanhas.json` (lista, permissão 0600).

Plano:

```json
{"id":"camp-<sha1 10>","briefing":"...","objetivo":"Atender ao briefing: ...",
 "publico":"jovens","mensagem_principal":"...","mensagens_apoio":["...","...","..."],
 "canais":["instagram-reels","instagram-carrossel","instagram-stories","whatsapp"],
 "calendario_7d":[{"dia":1,"formato":"reels","tema":"letramento"}, "...7 itens"],
 "meta":"alcance de 5.000 contas (meta padrao do plano — ajustar com o dono)",
 "referencias":["dos-letramento-001"],"base":"com_dossie|com_pauta|sem_dossie_sem_pauta",
 "avisos":[],"status":"rascunho","criado_em":"..."}
```

## 2. Como a base é escolhida (nesta ordem)

1. **`com_dossie`** — alguma entrada de `dossies.json` casa com palavra-chave do
   briefing (≥4 letras, sem stopwords). `referencias` recebe até 2 `id`.
2. **`com_pauta`** — senão, uma pauta de `pautas.json` casa. `referencias` recebe o `id`.
3. **`sem_dossie_sem_pauta`** — nada casou. O plano é **estrutural**: formato,
   agenda e canais. `mensagem_principal` diz explicitamente que nada foi afirmado
   e `avisos` registra o motivo.

**Referência, não cópia:** o plano guarda o `id` e um recorte do título; o conteúdo
do dossiê/pauta fica onde está. Quem for escrever a peça abre o material pelo id.

## 3. Campos derivados do briefing

| campo | regra |
|---|---|
| `publico` | trecho depois de "para ..." (até 60 letras); sem isso, "a definir com o dono" |
| `canais` | palavras reel/vídeo, carrossel/card, story/stories, whatsapp/grupo; vazio → os 4 canais padrão |
| `meta` | número + unidade quando o briefing declara ("5 mil de alcance"); sem número → meta padrão de 5.000, marcada como padrão |
| `calendario_7d` | 7 dias fixos: reels, carrossel, stories, post-estático, reels, carrossel, stories; tema = 1ª palavra-chave (dias alternados marcados "(reforco)") |
| `id` | sha1 de briefing + data do dia → rodar duas vezes no mesmo dia não duplica |

## 4. Regras de ouro

1. `status` só sai de `rascunho` com aprovação humana (skill `iara-aprovacao`).
2. Sem base, **nenhuma afirmação factual**: nem número, nem data, nem "pesquisa mostra".
3. Merge por id: `--briefing` nunca apaga campanha existente; apagar exige
   `--limpar` (dry-run) + `--confirmar`.
4. Sem rede. O script não importa urllib/requests/httpx e não abre `.env` nem
   `~/.hermes/credentials/`.
5. Meta é texto: quem mede é `iara-metrica` (Graph API), não esta skill.

## 5. Pitfalls medidos (PEF 10-v3, 05/11/2026)

1. **"campanha" e "divulgar" são stopwords** — se ficassem na lista de palavras,
   todo briefing casaria com todo dossiê.
2. **Fixture de teste por caminho**: `--dossies`/`--pautas` aceitam outro arquivo,
   para testar os 3 cenários sem sujar `dossies.json`/`pautas.json` reais.
3. **Dossiê e pauta têm formatos diferentes** — o casamento varre todo valor
   string do item (dict/list aninhados), não só `titulo`.
4. **`publico` "para jovens"** funciona; "para o público jovem das periferias de
   Manaus" corta em 60 letras — se o dono precisar do texto inteiro, ele escreve
   no campo do plano na aprovação.
5. **Duas campanhas no mesmo dia com o mesmo briefing colapsam** no mesmo id
   (dedupe proposital). Briefing diferente = campanha diferente.

## 6. O que esta skill NÃO faz

- Não escreve peça, não renderiza arte, não publica.
- Não agenda: `calendario-editorial` é quem marca data.
- Não lê dossiê por dentro para "resumir": só referencia.
- Não vai ao Supabase (campanhas em JSON local nesta fase).
