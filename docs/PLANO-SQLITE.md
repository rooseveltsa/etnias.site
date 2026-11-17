# S-05 — Plano de migração do JSON único para SQLite

## Situação medida na produção (17/11/2026)
- `community.json`: 11,4 MB, 8.270 contas, 5.612 publicações, 603 DMs. Cada ação reescreve o arquivo inteiro (de forma atômica), então o custo por ação cresce com a rede.
- 2.088 anexos em `media-<id>.json` (base64, 33% maiores que o binário). Total do volume: 1,6 GB.

## O que já foi feito (paliativo, seguro, sem migração)
1. Anexos **novos** passam a ser gravados em binário (`media-<id>.bin` + `.type`). Os antigos continuam legíveis. `scripts/opy-media-binarize.mjs <pasta> [--apply]` converte os antigos (ensaio na produção: 2.088 anexos, **397 MB a menos**, 0 falhas). Não foi aplicado na produção; pode ser rodado a qualquer momento depois do deploy, com o app no ar.
2. Tentativas de login falhas não gravam mais no banco (eram a maior fonte de reescrita) e há limite por pessoa de publicações e buscas.
3. Cache de mídia em memória é invalidado ao regravar o anexo.

## Ensaio da migração (feito)
`scripts/opy-migrar-sqlite.mjs <community.json> [saida.sqlite]` lê uma cópia, cria um SQLite à parte (contas, publicações, DMs, stories, comunidades e mercado em tabelas com uma linha por item; o resto em `kv`) e **reconstrói o JSON a partir do SQLite**, comparando byte a byte com o original.
- Rodado na produção em modo somente leitura (volume montado `:ro`, sem rede): **idêntico = true, `integrity_check` ok, migrar 0,36 s, reconstruir 0,17 s, arquivo de 14,5 MB**. O arquivo de ensaio foi apagado em seguida (tinha dados pessoais).

## O que falta para migrar de verdade (não feito de propósito)
1. Trocar `preview/server/local-store.mjs` por uma versão que lê/grava no SQLite (mesma interface `transaction/readMedia/saveMedia`), gravando só as linhas que mudaram. Hoje o código inteiro de `community.mjs` trabalha com o objeto `state` em memória e depende de gravação "tudo ou nada"; mudar isso toca todas as ações (119) e precisa de revisão e testes de carga.
2. Rodar o app com `node:sqlite` (Node 22.13+ sem flag; a imagem `node:22-alpine` já serve).
3. Janela de manutenção: parar o app, backup, `opy-migrar-sqlite.mjs`, conferir "idêntico", subir a versão nova apontando para o `.sqlite`, teste de fumaça. **Volta:** o `community.json` original não é alterado; basta subir a imagem anterior.
4. Teste de carga com ~10x os dados atuais antes de decidir.

## Quando vale a pena
O gargalo hoje é de milissegundos por ação (11 MB). Passa a incomodar quando o JSON chegar a algumas centenas de MB (dezenas de milhares de contas ativas) ou se houver mais de uma instância. Recomendo planejar a etapa 1 quando passar de ~30 mil contas ou 50 MB de JSON.
