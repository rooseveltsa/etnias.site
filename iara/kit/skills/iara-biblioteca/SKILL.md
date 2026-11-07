---
name: iara-biblioteca
description: Biblioteca do acervo do Etnias por ID — registra referencia (item_id, tipo, titulo, metadado e no maximo o caminho como texto) sem NUNCA copiar, abrir ou embutir o arquivo binario. Grava local-first via iara-adapter em ~/.hermes/iara-data/biblioteca.json. Usar quando o dono pedir "guarda essa peca no acervo", "qual o id daquele video", "onde esta o card da campanha" ou ao reaproveitar conteudo ja publicado.
---

# IAra — Biblioteca por ID (local-first)

Objetivo: achar o que ja existe sem duplicar arquivo. A biblioteca e um
**indice**: `item_id` + metadado + (quando muito) o caminho de onde o arquivo
mora. O binario fica onde esta.

## 1. Regra critica — sem copia

O registro guarda **so ID e metadado**. O script:

- **nao abre** o arquivo referenciado (`open()` nao existe nesta skill);
- **nao copia** para `iara-data/`;
- **nao converte** para base64;
- **nao calcula hash** (hash exige ler o arquivo — quando precisar, use a skill
  `iara-aprovacao`, que trabalha com o hash de uma peca aprovada).

Se o chamador passar um caminho, grava apenas `caminho_referencia` com o texto
do caminho. Chave de binario no metadado (`conteudo`, `base64`, `blob`,
`bytes`, `arquivo`...) e **recusada** pelo adaptador.

## 2. Contrato

Entrada:

- `item_id` — identificador estavel (`etnias-video-001`)
- `tipo` — `campanha | video | card | historia | documento`
- `titulo` — nome legivel
- `metadado` — opcional, objeto JSON (duracao, autorizacao, autor, data...)
- `caminho_referencia` — opcional, caminho absoluto como TEXTO

Saida: `{registrado: true, registro}` ou `{registrado: false, ja_existia: true,
registro}` quando o `item_id` ja esta na biblioteca (idempotente de proposito:
nao duplica indice).

## 3. Como executar

```bash
# so metadado
python3 ~/.hermes/skills/iara-biblioteca/scripts/biblioteca.py \
  --item-id etnias-video-001 --tipo video --titulo "Retrospectiva 2026" \
  --metadado '{"duracao_s": 32, "autorizacao": "pendente"}'

# com referencia de caminho (grava o TEXTO do caminho, nao o arquivo)
python3 ~/.hermes/skills/iara-biblioteca/scripts/biblioteca.py \
  --item-id card-opy-01 --tipo card --titulo "Capa Opy" \
  --caminho-referencia /home/anaobranca/Hermes/Agente-do-Caos/artes/etnias-opy-01.png

# ler / apagar / tipos aceitos
... --item-id etnias-video-001 --consultar
... --item-id etnias-video-001 --limpar
... --tipos
```

Exit: `0` ok | `2` entrada invalida (inclusive binario no metadado) |
`4` item nao encontrado | `5` `storage=supabase` sem modulo.

## 4. Onde fica salvo

`~/.hermes/iara-data/biblioteca.json` (0600). Um registro por `item_id`.

## 5. Regras duras

1. **`item_id` e a chave**, nao o nome do arquivo. CamelCase com espaco quebra
   busca; use slug (`etnias-video-001`).
2. **`tipo` vem da lista fechada.** Tipo novo = combinar antes, senao o indice
   vira sacola.
3. **Metadado sem binario.** O arquivo nao entra no JSON — nem pequeno, nem
   "so um pedacinho".
4. **Duplicata nao sobrescreve.** Reenviar o mesmo `item_id` devolve o registro
   existente; para corrigir metadado, apague e registre de novo (registrando o
   motivo no ticket).
5. **Indice nao e backup.** Se o arquivo sumir do disco, a biblioteca continua
   apontando para o vazio — ela nao guarda o conteudo.

## 6. Ligacao com as outras skills

- peca com `aprovado: true` em `iara-aprovacao` → referencia aqui com o hash no
  metadado (`{"peca_hash": "..."}`), sem guardar o arquivo;
- pauta em `reaproveitado` no `iara-calendario` → vira item da biblioteca com
  `tipo` do formato original;
- `iara-log-publicacao` responde "onde saiu"; a biblioteca responde "o que
  temos".

## 7. Pitfalls

- **Passar o caminho de um arquivo enorme**: nao ha custo, nada e lido — se o
  processo demorar, o problema e outro.
- **Esperar hash no registro**: nao existe, de proposito (ler o arquivo
  contradiz a regra de nao abrir). Hash mora na aprovacao.
- **`--metadado` com JSON invalido** (aspas simples) sai com exit 2: use aspas
  duplas no JSON.
- **`item_id` com barra ou espaco** e recusado: o id precisa sobreviver a copia
  de texto e a planilha.
