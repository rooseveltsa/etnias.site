---
name: iara-calendario
description: Pauta editorial com estado (rascunho, revisao, aprovado, agendado, publicado, reaproveitado, mais reprovado terminal) gravada local-first no iara-adapter — cadastra a pauta, avanca UM passo por vez e recusa transicao ilegal. Usar quando o dono pedir "o que vamos postar", "coloca na pauta", "muda o status do post", "o que esta agendado" ou ao montar a grade do mes.
---

# IAra — Calendario Editorial (local-first)

Objetivo: cada pauta tem UM estado, e o estado so anda para a frente. O
calendario e a resposta para "o que vamos postar", "o que esta travado em
revisao" e "o que ja virou conteudo reaproveitavel".

Grava via `iara-adapter` (local agora, banco quando o junior instalar).
Sem rede, sem credencial.

## 1. Maquina de estados

    rascunho -> revisao -> aprovado -> agendado -> publicado -> reaproveitado
                    \-> reprovado (terminal)

| de | pode ir para |
|---|---|
| `rascunho` | `revisao` |
| `revisao` | `aprovado`, `reprovado` |
| `aprovado` | `agendado` |
| `agendado` | `publicado` |
| `publicado` | `reaproveitado` |
| `reaproveitado` | — (terminal) |
| `reprovado` | — (terminal) |

Pular etapa (`rascunho` → `publicado`) e **erro**, nao atalho: pauta que nao
passou por revisao nao pode ser considerada aprovada.

## 2. Contratos

Criar pauta:

- entrada: `solicitacao_id`, `titulo`, `canal`, `data_prevista` (`AAAA-MM-DD`)
- saide: registro com `estado: "rascunho"` e `historico` com o primeiro evento

Avancar:

- entrada: `solicitacao_id`, `novo_estado`
- saida: `{avancado: true, de, para, registro}` — `de`/`para` sao a prova da
  transicao

## 3. Como executar

```bash
# criar
python3 ~/.hermes/skills/iara-calendario/scripts/calendario.py \
  --solicitacao-id curso-letramento-01 --titulo "Curso de Letramento" \
  --canal instagram --data-prevista 2026-12-01

# avancar um passo
... --solicitacao-id curso-letramento-01 --avancar revisao
... --solicitacao-id curso-letramento-01 --avancar aprovado

# ler / apagar / ver a maquina
... --solicitacao-id curso-letramento-01 --consultar
... --solicitacao-id curso-letramento-01 --limpar
... --transicoes
```

Exit: `0` ok | `2` entrada ou transicao invalida | `4` pauta nao encontrada |
`5` `storage=supabase` sem modulo.

## 4. Onde fica salvo

`~/.hermes/iara-data/calendario.json` (0600). **Uma linha por pauta**: o
`historico` guarda cada passo (`de`, `para`, `em`), entao a linha nao se
multiplica a cada avanco.

## 5. Regras duras

1. **Um passo por chamada.** Nada de `--avancar publicado` vindo de `rascunho`.
2. **`reprovado` e terminal.** Pauta reprovada nao volta: nova ideia = novo
   `solicitacao_id` (`-v2`). Reaproveitar texto de pauta reprovada e outro
   assunto, e vira pauta nova.
3. **`data_prevista` e compromisso, nao sugestao.** Mudou a data? registre
   nova pauta ou documente; nao editar o JSON a mao.
4. **Pauta nao se apaga para "limpar a tela"**: `--limpar` existe para teste.
5. **Calendario nao publica.** `publicado` e registro de fato consumado; quem
   publica e o canal, quem prova e `iara-log-publicacao`.

## 6. Ligacao com as outras skills

- pauta em `aprovado` → a peca passa por `iara-aprovacao` (hash + nome);
- pauta em `publicado` → `iara-log-publicacao` grava URL e hora;
- pauta em `reaproveitado` → a peca vira referencia em `iara-biblioteca`.

## 7. Pitfalls

- **`solicitacao_id` duplicado** e recusado: use `--consultar` antes de criar.
- **Data em formato brasileiro** (`01/12/2026`) quebra: o campo e `AAAA-MM-DD`.
- **`--avancar` com o estado atual** (rascunho → rascunho) e transicao
  invalida, nao no-op silencioso.
- **Terminal nao volta**: se precisar "desfazer", o caminho e `--limpar` +
  criar de novo — e isso apaga o historico, entao registre o motivo.
