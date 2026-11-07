---
name: iara-adapter
description: Porta unica de escrita e leitura da IAra (aprovacoes, publicacoes, metricas) com troca de destino por configuracao — local (arquivos JSON em ~/.hermes/iara-data/) ou supabase (quando o banco estiver instalado), sem alterar nenhuma skill. Usar sempre que precisar gravar ou ler aprovacao, publicacao ou metrica, quando o dono perguntar "onde isso fica salvo", "como troco para o Supabase" ou quando for implementar o modulo do banco.
---

# IAra — Adapter (porta unica, local-first)

Toda a IAra grava por aqui. Nenhuma skill fala direto com arquivo, banco ou
API: elas chamam uma funcao deste modulo, e o modulo decide o destino pelo
`config.json`. Trocar de destino = editar uma linha de config; zero mudanca
nas skills.

## 1. O botao de troca

`~/.hermes/iara-data/config.json`

```json
{"storage": "local", "version": "1"}
```

| `storage` | destino | estado |
|---|---|---|
| `local` | `~/.hermes/iara-data/{aprovacoes,publicacoes,metricas,calendario,biblioteca}.json` | **ativo agora** |
| `supabase` | modulo do banco (classe `_SupabaseStub`) | **stub**: responde `needs_install: true` |

Sem arquivo de config, o padrao e `local`. Config ilegivel tambem cai em
`local` (nunca explode por causa de JSON quebrado).

## 2. API

```python
import sys, os
sys.path.insert(0, os.path.expanduser("~/.hermes/skills/iara-adapter/scripts"))
import iara_adapter as ia

ia.registrar_aprovacao(solicitacao_id, aprovador, peca_hash, canal=None,
                       peca_id=None, teste=False, anonimizado=False)
ia.transicionar_aprovacao(solicitacao_id, aprovador, teste=False, peca_id=None)
ia.consultar_aprovacao(solicitacao_id) -> {encontrado, aprovado, registro}
ia.ler_aprovacoes(solicitacao_id=None)

ia.registrar_publicacao(peca_id, aprovador, canal, url, hora=None,
                        solicitacao_id=None, peca_hash=None, teste=False,
                        anonimizado=False)
ia.ler_publicacoes(peca_id=None)

ia.registrar_metrica(publicacao_id, dia, origem="manual", canal="instagram", **numeros)
ia.ler_metricas(publicacao_id=None)

ia.registrar_calendario(solicitacao_id, titulo, canal, data_prevista, estado_inicial="rascunho")
ia.avancar_estado(solicitacao_id, novo_estado)      # UM passo; ilegal -> ErroDeValidacao
ia.ler_calendario(solicitacao_id=None)

ia.registrar_biblioteca(item_id, tipo, titulo, metadado=None, caminho_referencia=None)
ia.ler_biblioteca(item_id=None)

# seguranca (PEC 18.1 / 18.2)
ia.esta_bloqueado(peca_id) -> bool                  # consulta o iara-institucional
ia.aviso_institucional(peca_id) -> str | None       # "institucional_ausente" etc.
ia.verificar_pii(texto) -> {tem_pii, achados:[telefone|email|cpf]}

ia.estado()   # {storage, config, dados, linhas:{...}}  -> vai no ticket
ia.ler_config()
```

Limpeza de teste: `apagar_aprovacao(solicitacao_id)`, `apagar_publicacao(peca_id)`,
`apagar_metrica(publicacao_id)`, `apagar_calendario(solicitacao_id)`,
`apagar_biblioteca(item_id)`.

Erros: `ErroDeValidacao` (entrada invalida → exit 2 na skill), `NeedsInstall`
(`storage=supabase` sem modulo → exit 5, com `needs_install: true`).

## 2.0 Seguranca: 4 portas que o adapter fecha

Toda escrita passa por aqui, entao a regra vale igual em local e no Supabase.

| funcao | o que faz | falha como |
|---|---|---|
| `esta_bloqueado(peca_id)` | pergunta ao `iara-institucional` se a peca tem bloqueio pendente. Modulo ausente → `False` + `aviso_institucional() == "institucional_ausente"` (kit incompleto nao derruba aprovacao) | — |
| `verificar_pii(texto)` | telefone `\d{10,11}`, email `\S+@\S+`, CPF `\d{3}\.\d{3}\.\d{3}-\d{2}` | — |
| `registrar_aprovacao` | PII cru → recusa; peca bloqueada → recusa | `PiiNaoAnonimizada` (exit 4), `BloqueioInstitucional` (exit 3) |
| `transicionar_aprovacao` (`--acao aprovar`) | re-verifica o bloqueio (PEC 18.2): solicitacao aberta antes da classificacao nao vira `aprovado` | `BloqueioInstitucional` (exit 3) |
| `registrar_publicacao` | PII cru → recusa; com `solicitacao_id`, `peca_hash` e **obrigatorio**; hash conferido contra a aprovacao | `PiiNaoAnonimizada` (4), `IntegridadePublicacao` (5: `aprovacao_ausente` / `hash_obrigatorio` / `divergencia_hash`) |

`registrar_metrica`, `registrar_calendario` e `registrar_biblioteca` tambem
chamam o guarda de PII (aceitam `anonimizado=True` quando o texto ja foi
tratado). PII nao entra em log nenhum — nem em titulo de pauta.

## 2.1 Calendario: maquina de estados (fonte da verdade)

`TRANSICOES` no adaptador. A skill `iara-calendario` so espelha isto:

| de | vai para |
|---|---|
| `rascunho` | `revisao` |
| `revisao` | `aprovado`, `reprovado` |
| `aprovado` | `agendado` |
| `agendado` | `publicado` |
| `publicado` | `reaproveitado` |
| `reaproveitado` | terminal |
| `reprovado` | terminal (so a partir de `revisao`) |

`avancar_estado()` aceita **um** passo. Pular etapa (`rascunho` → `publicado`)
devolve `ErroDeValidacao` com a lista do que era permitido — de proposito: a
regra mora em um lugar so.

## 2.2 Biblioteca: so referencia

`registrar_biblioteca()` guarda `item_id`, `tipo`, `titulo`, `metadado` e, no
maximo, `caminho_referencia` como **texto**. Nao abre o arquivo, nao copia, nao
converte para base64, nao calcula hash. Metadado com chave de binario
(`conteudo`, `base64`, `blob`, `bytes`, `arquivo`, `raw`...) e recusado.

## 3. Onde a regra mora

A **regra de aprovacao** fica no adaptador, nao no script:

- `aprovado: true` so por `transicionar_aprovacao()`, nunca no registro inicial;
- `aprovador` vazio nao aprova; `eu`/`teste` so com `teste=True`;
- `peca_hash` precisa ser hex de 32+ chars (md5/sha);
- `publicacao` com `solicitacao_id` exige aprovacao previa no estado aprovado;
- `metrica` aceita `dia` 1 ou 7, `origem` `manual` ou `coleta_real`, e so
  inteiro ≥ 0 nos numeros.

Assim local e supabase aprovam exatamente igual — a regra nao se duplica.

## 4. Regras duras do modo local

1. **Sem rede.** O adaptador nao importa `urllib`, `requests`, `socket` nem
   `http.client`. Se precisa de rede, e o outro lado do adaptador.
2. **Sem credencial.** Nao le `~/.hermes/.env` nem `~/.hermes/credentials/`.
   Nenhum token passa por aqui.
3. **Escrita atomica.** Grava em `.tmp`, `chmod 600`, `os.replace` — queda no
   meio da escrita nao deixa JSON pela metade.
4. **Arquivo corrompido nao se sobrescreve.** `ErroDeValidacao` e o certo; zerar
   o historico para "fazer passar" nao.
5. **Uma linha por evento.** Republicar/solicitar de novo = linha nova.

## 5. Como implementar o lado Supabase (junior)

1. Preencher em `_SupabaseStub` os quatro metodos (`inserir`, `listar`,
   `atualizar`, `apagar`) com as tabelas `"iara-core".iara_aprovacoes`,
   `iara_publicacoes` e `iara_metricas` — os nomes e campos ja saem prontos do
   adaptador (`id`, `criado_em`, `aprovado_em`, `publicado_em`, `coleta_em`).
2. Credencial fica em `~/.hermes/.env` (`SUPABASE_URL`,
   `SUPABASE_SERVICE_ROLE_KEY`) e o adaptador e o **unico** lugar que a le.
3. Trocar `config.json` para `"storage": "supabase"`.
4. Rodar `ia.estado()` e conferir `linhas`; depois migrar o conteudo dos JSONs
   locais para as tabelas (mesmos nomes de campo).
5. DDL continua manual no SQL Editor: `service_role` nao faz DDL.

Nada nas skills `iara-aprovacao`, `iara-log-publicacao` e `iara-metrica` muda.

## 6. Pitfalls

- **Nao chamar `_store()` para "ver" o storage** e depois gravar em outro
  objeto: cada chamada monta um adaptador novo (sem estado). Use `estado()`.
- **`dia` vem de CLI como texto**: converta antes (`int`), senao `dia="1"` nao
  casa com `{1, 7}`.
- **Ordem de import**: o `sys.path.insert` tem que vir antes do `import
  iara_adapter`; sem isso o script quebra com `ModuleNotFoundError` e a skill
  parece "nao instalada".
- **`~` nao expande sozinho** dentro de JSON/str: use `os.path.expanduser`.
- **Config com `storage` desconhecido** (ex.: `"postgres"`) cai em local de
  proposito — mas registre no ticket, porque o junior achou que tinha trocado.
