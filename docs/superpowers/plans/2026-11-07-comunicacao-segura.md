# Plano de implementação: comunicação segura

> Execução nativa com Superpowers: TDD, systematic-debugging, requesting-code-review e verification-before-completion. Autonomia explicitamente solicitada dispensa gates de confirmação para mudanças locais. Sem commit/deploy automático.

**Objetivo:** auditar ambas as aplicações e corrigir a comunicação local com evidência.
**Arquitetura:** manter PHP legado e prévia Node separados. Reutilizar a sessão e o storage da prévia; módulo de chat responsável por autorização e projeções privadas.
**Stack:** PHP, Node ESM, JavaScript DOM, node:test e Playwright existente.
**Spec:** `docs/superpowers/specs/2026-11-07-comunicacao-segura-design.md`.

## Restrições globais
Sem produção, banco recuperado, dados reais ou serviços pagos. Sem políticas culturais presumidas. Sem EtnIA aberta.

## Foco da revisão
- Destinatário inexistente, terceiro ou removido não lê mensagens/anexos.
- Reenvio após resposta perdida não duplica nem descarta história.
- Reações/respostas/edições não reexpõem mensagens apagadas.
- Polling não interrompe escrita, áudio, foco ou leitura do histórico.
- Erros, limites e pendências não são apresentados como sucesso.

## Tarefa 1: mapa e diagnóstico
- [x] Mapear rotas, handlers, banco/modelos, autenticação, APIs e UI; distinguir legado da prévia.
- [x] Revisar riscos e conferir preços/documentação oficiais para chamadas.
- [x] Registrar matriz de funcionalidades, UX, CARE, backlog e limites em `docs/auditoria-comunitaria-2026-11-07.md`.

## Tarefa 2: backend de chat
Arquivos: `preview/server/chat.mjs`, `preview/server/community.mjs`, `tests/opy/chat.mjs`, `tests/opy/community-integration.mjs`.
Interface: `chatSnapshot(state, me, URLSearchParams)`, `chatAction(state, me, body, upload)`, `chatMedia(state, me, id)`; ações persistem no mesmo transact.
- [x] Testes RED para destinatários, IDOR, reenvio, paginação, apagar/editar/reagir, bloqueio, mídia e grupos.
- [x] Implementar autorização, projeção mínima e ações; manter ação dm compatível com clientes existentes.
- [x] GREEN: `node --test tests/opy/chat.mjs` e `node tests/opy/community-integration.mjs`.

## Tarefa 3: interface e fluxos
Arquivos: `preview/chat.js`, `preview/page.php`, `preview/preview.js`, `preview/preview.css`, `scripts/export-opy-preview.php`, testes de navegador.
- [x] Testes de navegador RED para seleção, envio, leitura em outra sessão, erro/retry e histórico.
- [x] Reutilizar estilos e mídia; controles acessíveis, pesquisa, grupos e estados de conexão; não simular chamadas.
- [x] Exportar páginas e executar testes locais mobile/tablet/desktop.

## Tarefa 4: revisão e entrega
- [x] Revisor independente do diff, corrigir problemas graves com regressão.
- [x] Rodar suítes locais aplicáveis e registrar testes bloqueados com motivo.
- [x] Entregar relatório completo com evidências, mudanças, decisões humanas e pendências.
