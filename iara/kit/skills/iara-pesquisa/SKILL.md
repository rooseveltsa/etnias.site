---
name: iara-pesquisa
description: Montar dossie sobre um tema a partir das FONTES MANUAIS do dono em ~/.hermes/iara-data/fontes/ (.txt/.md), com trecho, arquivo e linha de origem, resumo limitado a 300 palavras e verificado=false. Sem fonte, devolve sem_fonte=true e status pendente_fonte — nunca inventa conteudo. Usar quando o dono pedir "pesquisa sobre X", "monta um dossie", "o que a gente tem sobre" ou antes de virar pauta no calendario.
---

# IAra — Pesquisa (dossie com fonte verificada)

Objetivo: transformar texto que o dono **já colocou no disco** em dossiê
citável. Cada frase do resumo aponta para arquivo e linha. O que não está na
fonte não entra — nem como "contexto", nem como "provavelmente".

Sem rede, sem credencial, sem conhecimento próprio.

## 1. Contrato

Entrada:

- `tema` — texto livre (a busca é por palavra-chave, sem acento/caixa)
- `profundidade` — `rapida` (3 trechos), `media` (5), `profunda` (8)

Saída (dossiê em `~/.hermes/iara-data/dossies.json`):

| campo | o que é |
|---|---|
| `id` | uuid do dossiê |
| `tema` | tema como foi pedido |
| `resumo` | até 300 palavras, montado **somente** de frases dos trechos, cada uma com `[arquivo, linha]` |
| `trechos` | lista de `{texto, fonte, linha, score}` — `texto` até 500 caracteres |
| `sem_fonte` | `true` quando nenhum arquivo casou |
| `status` | `ok` ou `pendente_fonte` |
| `arquivos_lidos` / `arquivos_com_match` | o que foi varrido e o que casou |
| `verificado` | sempre `false` ao nascer — verificação é humana |
| `criado_em` | ISO-8601 |

## 2. Como executar

```bash
# montar dossie
python3 ~/.hermes/skills/iara-pesquisa/scripts/pesquisar.py \
  --tema "letramento" --profundidade rapida

# o que existe de fonte
... --listar-fontes

# dossies ja montados (resumo de cada)
... --consultar

# remover dossie de teste (por tema ou id)
... --limpar --tema "letramento"
```

Exit: `0` ok (inclusive quando `sem_fonte` — falta de fonte não é erro, é
diagnóstico) | `2` entrada inválida | `3` `dossies.json` ilegível (não
sobrescreve histórico).

## 3. Regra dura: não inventar

Sem trecho que case com o tema, o dossiê sai assim:

```json
{"sem_fonte": true, "status": "pendente_fonte", "trechos": [], "resumo": ""}
```

O `motivo` diz o que fazer: colocar um arquivo em `iara-data/fontes/`. **Não**
preencher com conhecimento geral, **não** pedir para a IA "escrever o que sabe"
e **não** usar dossiê `pendente_fonte` como pauta no `iara-calendario`.

## 4. Como funciona a busca

1. lê `fontes/*.txt` e `fontes/*.md`;
2. quebra o arquivo em parágrafos (blocos de linhas não vazias) guardando a
   linha inicial;
3. dobra acento e caixa (`Letramento` = `letramento` = `LETRAMENTO`);
4. conta ocorrências das palavras do tema (≥ 3 letras) por parágrafo;
5. ordena por número de ocorrências, corta em 3/5/8 conforme profundidade;
6. corta cada trecho em 500 caracteres, preferindo fim de frase.

Consequência prática: **fonte é arquivo de texto simples**. PDF precisa ser
convertido antes (skill `ocr-and-documents`); link não é fonte nesta fase.

## 5. Ciclo de vida do dossiê

    pendente_fonte  --(dono coloca a fonte e roda de novo)-->  ok
    ok  --(humano le e confere)-->  verificado: true
    verificado: true  -->  pode virar pauta (iara-calendario)

`verificado` não muda por script: quem muda é o dono, depois de ler o trecho
na fonte. Dossiê não verificado não vira conteúdo publicado.

## 6. Ligação com as outras skills

- `iara-triagem-setorial` manda pedido de "pesquisa/achar" para cá;
- `iara-calendario` só aceita pauta cujo dossiê esteja `verificado: true`;
- `iara-biblioteca` guarda o dossiê como item `tipo: "documento"`, por id;
- `iara-metrica` não tem nada a ver com isto — métrica é depois de publicar.

## 7. Pitfalls

- **`dossies.json` é acrescentado, nunca sobrescrito.** Arquivo ilegível faz o
  script sair com 3 em vez de zerar o histórico.
- **Tema de uma letra/palavra curta** não casa (mínimo 3 letras): "IA" não
  acha nada — use "inteligência artificial" ou ajuste a fonte.
- **Fonte com tudo num parágrafo só** gera 1 trecho de 500 caracteres: quebre
  o texto em parágrafos para o dossiê ficar útil.
- **Acento na fonte e no tema** não atrapalha (dobra dos dois lados), mas
  sinônimo atrapalha: a busca é literal, não semântica.
- **`--limpar` sem `--tema`/`--id`** é recusado de propósito: apagar tudo por
  acidente custaria o histórico de dossiês.
