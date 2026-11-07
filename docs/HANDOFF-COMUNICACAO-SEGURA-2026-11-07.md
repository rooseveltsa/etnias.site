# Handoff — Comunicação Segura e Auditoria Casa Opy (2026-11-07)

> **Status:** Implementação local e testes automatizados concluídos. Mudanças **ainda são locais** (sem `git commit` e sem deploy automático para a Vercel ou VPS), respeitando `AGENTS.md`.

---

## 1. Onde a sessão anterior do Codex parou e o que foi concluído aqui

Na sessão anterior do Codex, o agente havia implementado o módulo de comunicação segura (`preview/server/chat.mjs`, `preview/chat.php`, `preview/chat.js`, correção do gate em `public_html/requests.php`) e iniciado a rodada de revisão independente (Tarefa 4 de `docs/superpowers/plans/2026-11-07-comunicacao-segura.md`), adicionando três testes RED de regressão antes de atingir o limite de uso:

1. `tests/opy/chat.mjs` (`apagar marcador para mim não torna mensagens antigas não lidas`): estava em estado RED porque `chatSnapshot()` e `chat_read` calculavam `readIndex` apenas sobre a lista filtrada de mensagens visíveis (`messagesOf()`), voltando a `-1` quando a última mensagem lida era apagada com `scope: 'me'`.
   - **Concluído:** `preview/server/chat.mjs` agora resolve a posição de `p.readId` diretamente na ordem cronológica de `state.dms`, preservando o marco de leitura mesmo após exclusão local (`scope: 'me'`).
2. `tests/opy/community-integration.mjs` (`action: 'friend'` para `name:Acervo` esperando HTTP `404`): estava em estado RED porque `case 'friend'` em `preview/server/community.mjs` ainda permitia `name:*`.
   - **Concluído:** `preview/server/community.mjs` agora exige conta registrada (`id:<uuid>` presente em `state.accounts`) e retorna `404` para perfis do acervo sem conta ativa.
3. Exportação e limpeza:
   - `scripts/export-opy-preview.php` foi reexecutado, atualizando `preview/dist` (29 páginas estáticas + `preview/dist/assets/chat.js` e `preview/dist/server/chat.mjs`).
   - Os 4 processos Node de teste órfãos da sessão anterior (`PIDs 66051, 66389, 86418, 94494`) foram encerrados após os testes.
   - O relatório completo de auditoria comunitária foi consolidado em `docs/auditoria-comunitaria-2026-11-07.md`.

---

## 2. Arquivos Criados e Modificados

### Criados
- `preview/server/chat.mjs`: Backend de conversas privadas 1:1 e grupos privados (até 12 membros, convite explícito, sem leitura retroativa antes do aceite, bloqueio bilateral, paginação, busca, reações, edição, resposta, apagar para mim/todos, anexos privados via `chatMedia`, envio idempotente com `clientId` + SHA-256).
- `preview/chat.php`: Marcação acessível da tela `/chat/` com aviso de privacidade, busca, filtro de arquivadas, convites de grupo, compositor com anexo/áudio/emoji e `<dialog>` nativo.
- `preview/chat.js`: Cliente DOM de `/chat/` com proteção contra condições de corrida (`generation`, `fileGeneration`, `recordingGeneration`), preservação de rascunho em falha de rede ou durante envio, e mídia sob demanda (`preload="none"`).
- `tests/opy/chat.mjs`: 9 suítes unitárias cobrindo autorização, IDOR, idempotência, limite de 10.000 mensagens, paginação/busca/leitura, edição/resposta/reações/exclusão, bloqueio/denúncia, anexos privados e grupos.
- `tests/opy/chat-races.mjs`: 3 suítes de concorrência no cliente (`choose` durante `refresh`, preservação de novo rascunho digitado durante `send`, e `FileReader` atrasado após troca de conversa).
- `tests/opy/chat-browser.cjs`: Teste E2E Playwright com duas contas reais (`Ana QA` e `Beto QA`), envio/recebimento, edição, queda de rede (`setOffline(true)`), retry idempotente e verificação de responsividade sem overflow em `320px`, `390px`, `768px` e `1440px`.
- `tests/opy/legacy-request-auth.php`: Teste de regressão do gate de autenticação em `public_html/requests.php`.
- `docs/auditoria-comunitaria-2026-11-07.md`: Diagnóstico arquitetural, matriz de funcionalidades, avaliação de chamadas/custos, princípios CARE e backlog.
- `docs/superpowers/specs/2026-11-07-comunicacao-segura-design.md` e `docs/superpowers/plans/2026-11-07-comunicacao-segura.md`: Especificação e plano de implementação.

### Modificados
- `public_html/requests.php`: Fechamento do bypass de autenticação anônima via `?s=load_more_posts|filter_posts|load-comments` em handlers arbitrários.
- `preview/server/community.mjs`: Integração de `chatActions`, `chatSnapshot`, `chatAction` e `chatMedia`, limpeza de mídia removida/duplicada e exigência de conta registrada em `friend`.
- `preview/page.php`: Inclusão de `preview/chat.php` e `/assets/chat.js?v=20261107.1` na rota `messages` (`/chat/`).
- `preview/preview.js`: Redirecionamento de mensagens privadas para `/chat/?p=...`, desativação de botões de DM/amizade para perfis do acervo sem conta (`name:*`) e suspensão do polling global duplicado quando na rota `messages`.
- `preview/preview.css`: Estilos responsivos de `.chat-workspace` (`320px` a `1440px`), foco visível e alvos de toque mínimos (`44px`).
- `scripts/export-opy-preview.php`: Inclusão de `chat.js` na exportação para `preview/dist/public/assets/`.
- `tests/opy/community-integration.mjs`: Suporte a `OPY_TEST_PORT`, testes de rejeição `404` para `name:Acervo` em `dm` e `friend`, anexo privado de chat em `/api/media` e bloqueio `403` ao tentar apagar mensagem alheia para todos.

---

## 3. Evidências de Testes Executados

- `node --test tests/opy/chat.mjs tests/opy/chat-races.mjs` → **12/12 PASS**
- `OPY_TEST_PORT=8119 node tests/opy/community-integration.mjs` → **PASS**
- `node tests/opy/chat-browser.cjs` (Playwright em `320/390/768/1440px`) → **PASS**
- `node tests/opy/etnia.mjs` → **PASS**
- `node tests/opy/local-store.mjs` → **PASS**
- `python3 tests/opy/iara-kit.py` → **PASS**
- `php scripts/export-opy-preview.php` (via container PHP) → **PASS** (`Exported 29 static preview pages`)
- `php tests/opy/legacy-request-auth.php` → **PASS**
- `php tests/opy/navigation.php` → **18/18 PASS**
- `php tests/opy/sidebar-ads.php` (`OPY_TEST_DATABASE=synthetic`) → **PASS**
- *Testes bloqueados / dependentes de container de auditoria desligado:* `tests/opy/preservation.py`, `prepare-recovery.py` e `backup-restore.py` exigem o container temporário `etnias-backup-audit` (desligado para não tocar no banco recuperado, conforme `AGENTS.md`).

---

## 4. Decisões Humanas Pendentes e Próximos Passos

1. **Chamadas de áudio/vídeo:** Definir se a primeira versão em produção na VPS usará apenas WebRTC P2P + `coturn` próprio (custo zero de API) ou LiveKit self-hosted na VPS.
2. **Moderação e denúncias (`chat_report`):** Definir fluxo e responsáveis pela revisão humana antes de abrir a rede para o público amplo.
3. **Publicação / Deploy:** Revisar `git status` / `git diff`, aprovar commit e decidir se deseja publicar a atualização na prévia Vercel (`preview/dist`) ou avançar para a configuração isolada na VPS Hostinger.
