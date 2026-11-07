---
name: iara-aprovacao
description: Registrar a solicitacao de aprovacao de uma peca e a aprovacao NOMINAL dela (quem aprovou, quando, hash da peca) chamando o iara-adapter — grava local em ~/.hermes/iara-data/aprovacoes.json e, quando o banco estiver instalado, no Supabase sem mudar nada aqui. Devolve aprovado=true apenas com nome de aprovador, hash valido e transicao explicita. Usar quando o dono pedir "manda para aprovacao", "quem aprovou isso", "aprova a peca X" ou antes de qualquer publicacao.
---

# IAra — Aprovacao (local-first)

Objetivo: nenhuma peca sai sem alguem com nome ter aprovado. O registro
guarda `solicitacao_id`, `aprovador`, `peca_hash`, `canal`, `estado` e a hora.

Esta skill **nao conecta em nada**. Ela chama o `iara-adapter`, que decide o
destino (local agora, Supabase quando o banco entrar). Sem rede, sem
credencial, sem Graph API.

## 1. Contrato

Entrada: `solicitacao_id`, `aprovador`, `peca_hash`, `canal`.
Saida: `aprovado: true` **somente** quando as tres condicoes valem:

1. `aprovador` nao vazio (nome de gente — `eu` e `teste` so com `--teste`);
2. `peca_hash` hexadecimal de 32+ caracteres (md5/sha da peca);
3. a chamada for a transicao explicita `--acao aprovar`.

Solicitar grava em `rascunho` e devolve `aprovado: false`. Aprovacao que nasce
verdadeira na solicitacao nao e aprovacao — e enfeite.

## 2. Ciclo de estados

    rascunho -> revisao -> aprovado -> agendado -> publicado

`aprovar` so sai de `rascunho`/`revisao`. Publicado nao volta.

## 3. Como executar

Solicitar (rascunho):

```bash
python3 ~/.hermes/skills/iara-aprovacao/scripts/registrar-aprovacao.py \
  --solicitacao-id "etnias-opy-01-v1" \
  --aprovador "Vytorya" \
  --peca-hash   "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6" \
  --canal       "instagram"
```

Aprovar (unica porta que devolve `aprovado: true`):

```bash
python3 ~/.hermes/skills/iara-aprovacao/scripts/registrar-aprovacao.py \
  --solicitacao-id "etnias-opy-01-v1" --aprovador "Vytorya" --acao aprovar
```

Ler de volta / validar sem gravar / apagar (testes):

```bash
... --solicitacao-id "etnias-opy-01-v1" --acao consultar
... --check        # valida e sai, sem gravar
... --acao limpar  # remove as linhas dessa solicitacao
```

Exit: `0` ok | `2` entrada invalida (aprovador vazio, hash invalido, canal errado) |
`3` bloqueio institucional (peca institucional sem aprovador nominal) |
`4` PII nao anonimizada (telefone/email/CPF cru) | `4` solicitacao nao encontrada
(consultar) | `5` `storage=supabase` sem modulo instalado.

`--acao aprovar` **tambem** consulta o `iara-institucional`: peca bloqueada nao
transiciona para `aprovado` (exit 3), mesmo que a solicitacao tenha sido aberta
antes da classificacao. Para liberar: `iara-institucional
registrar_aprovador_institucional --peca-id <peca> --aprovador "<nome>"`.

## 4. Onde fica salvo

`~/.hermes/iara-data/aprovacoes.json` (permissao 0600), uma linha por
solicitacao/transicao. Trocar para o banco e so mudar
`~/.hermes/iara-data/config.json` para `"storage": "supabase"` — ver skill
`iara-adapter`.

## 5. Regras duras

1. **Nome, nao apelido.** `aprovador` e a pessoa que autorizou. "o dono
   aprovou" nao entra.
2. **Hash e a identidade da peca.** Sem `peca_hash` valido nao existe
   aprovacao: aprovar "a peca" sem fixar o arquivo deixa passar versao errada.
   Use md5 do PNG final.
3. **Uma solicitacao por versao.** Peca refeita = novo `solicitacao_id`
   (`-v2`), nao reescrever a linha aprovada.
4. **Ninguem aprova a si mesmo em nome de outro.**
5. **Nao publicar nesta skill.** Aprovacao autoriza; publicar e do fluxo do
   canal, e quem registra e `iara-log-publicacao`.

## 6. Pitfalls

- **Aprovar antes de solicitar falha** (`nenhuma solicitacao ...`): o
  `solicitacao_id` tem que existir em `rascunho`.
- **`aprovado_em` fica `null` ate a transicao** — nao e bug; e a prova de que
  a data de aprovacao e a data da aprovacao, nao a do pedido.
- **Editar o JSON a mao** fura o adaptador e some na proxima escrita atomica;
  se precisar corrigir, use `--acao limpar` + solicitar de novo.
- **Texto do `peca_hash` com espaco** (colado de PDF) quebra a regex: `.strip()`
  resolve, mas conferir o tamanho antes de culpar a skill.
