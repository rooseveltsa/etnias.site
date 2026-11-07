# Auditoria Comunitária e Comunicação Segura — Casa Opy / Etnias (2026-11-07)

> **Escopo:** Auditoria técnica, de segurança, UX/UI, acessibilidade, governança de dados indígenas (princípios CARE) e comunicação em tempo real nas duas superfícies do repositório (`public_html/` PHP/WoWonder legado + `public_html/nodejs/` Socket.IO e `preview/` Node ESM / Casa Opy). Nenhuma alteração em produção, domínio `etnias.site` ou banco recuperado.

---

## 1. Mapa Arquitetural: Legado (`public_html/`) vs. Prévia (`preview/`)

| Camada | Aplicação Legada (`public_html/`) | Prévia Homologação (`preview/`) |
|---|---|---|
| **Runtime & Entrada** | PHP (`public_html/index.php`, `public_html/requests.php`) + daemon Node (`public_html/nodejs/main.js`, Socket.IO + Sequelize/MySQL) | Node ESM serverless/local (`preview/server/community.mjs`, `preview/server/chat.mjs`, `scripts/opy-preview-server.mjs`) + páginas estáticas exportadas por `scripts/export-opy-preview.php` |
| **Autenticação & Sessão** | Cookie `user_id` (`Wo_UserSessions` no MySQL) + `hash_id` CSRF em formulários PHP; `requests.php` despacha `xhr/*.php` | Cookie HTTP-only assinado HMAC (`preview/server/session.mjs`) validado em `preview/middleware.js` e em `preview/server/community.mjs`, com verificação de `Origin` em `POST` |
| **Persistência** | MariaDB/MySQL (`Wo_Users`, `Wo_Messages`, `Wo_GroupChat`, `Wo_GroupChatUsers`, `Wo_AudioCalls`, `Wo_VideoCalles`, `Wo_Blocks`) | `preview/server/storage.mjs` (transação serializada sobre Vercel Blob privado ou arquivo JSON local com lock atômico em `preview/local-data/`) |
| **Chat & Mensagens** | `public_html/xhr/messages.php` + `public_html/nodejs/listeners/listeners.js` | `preview/server/chat.mjs` + `preview/chat.php` + `preview/chat.js` (`/chat/`, `/api/community?view=chat`) |
| **Mídia Privada** | Uploads em `public_html/upload/` (acesso direto por caminho ou S3 configurável) | `/api/media?id=<uuid>` autenticado e autorizado por participante (`post`, `story` ou `chatMedia(state, me, id)`) |

---

## 2. Achados de Segurança e Concorrência Corrigidos Localmente

1. **Bypass de autenticação em `public_html/requests.php` (Legado PHP — ALTO):**
   - **Causa:** A condição anterior `if ($wo['loggedin'] == false && ($s != 'load_more_posts' && $s != 'filter_posts')) { if ($s != 'load-comments') exit(...); }` permitia que qualquer handler `$f` fora de `$non_login_array` fosse invocado sem sessão autenticada bastando enviar `?f=<handler>&s=load_more_posts`, `filter_posts` ou `load-comments` com cabeçalho `X-Requested-With: XMLHttpRequest`.
   - **Correção (`public_html/requests.php:126-133`):** Restrição estrita das leituras públicas anônimas apenas aos pares legítimos `($f === 'posts' && in_array($s, ['load_more_posts', 'filter_posts'], true))`, `($f === 'watch' && $s === 'load_more_posts')` e `($f === 'movies' && $s === 'load-comments')`.
   - **Evidência:** `tests/opy/legacy-request-auth.php` (PASS).

2. **Destinatários sem conta (`name:*`) em DMs e amizades na prévia (`preview/server/community.mjs`, `preview/server/chat.mjs` — ALTO):**
   - **Causa:** O handler antigo de `dm` e `friend` aceitava chaves `name:<Autor do Acervo>`, permitindo enviar mensagens ou criar vínculo de amizade unilateral com perfis históricos do acervo que ainda não possuem conta ativa na prévia.
   - **Correção:** `chat.mjs` (`person()`) e `community.mjs` (`case 'friend'`) exigem conta registrada (`id:<uuid>` existente em `state.accounts`), retornando HTTP `404` para perfis sem conta; botões de DM e amizade na UI (`preview/preview.js`) ficam desabilitados com explicação clara para perfis do acervo.

3. **Autorização por operação, IDOR, exclusão e anexos privados no chat (`preview/server/chat.mjs` — ALTO):**
   - **Causa:** A prévia anterior tinha apenas lista simples de DMs em `snapshot()`, sem controle de acesso a anexos de chat após exclusão, sem bloqueio bilateral, sem idempotência de envio (`clientId`) e sem grupos privados com convite.
   - **Correção (`preview/server/chat.mjs`):**
     - `canRead(state, me, m)` valida participação na conversa individual ou membresia ativa no grupo a partir do marco de entrada (`joinedAfter` / `joinedAt`), impedindo leitura retroativa de mensagens anteriores ao aceite do convite mesmo no mesmo milissegundo.
     - `chatMedia(state, me, id)` autoriza download em `/api/media` exclusivamente para participantes que ainda podem ler a mensagem não apagada; apagar para todos remove o binário do storage (`removedId`), e apagar para mim oculta a mensagem e revoga acesso ao anexo para quem ocultou.
     - Reenvio idempotente via `clientId` + hash SHA-256 (`digest`) do payload evita duplicação após queda de rede e rejeita reutilização de `clientId` com conteúdo divergente (`409`).
     - Preservação do marcador de leitura (`readId`) indexado sobre `state.dms`, garantindo que apagar a última mensagem "para mim" não reabra mensagens anteriores como não lidas.

4. **Condições de corrida no cliente de chat (`preview/chat.js` — MÉDIO):**
   - **Causa:** Trocar de conversa durante `refresh()` em voo podia sobrescrever cabeçalho/mensagens; concluir `send()` limpava `#chat-text` mesmo se a pessoa já estivesse digitando novo rascunho; `FileReader` assíncrono lento ou `getUserMedia` podiam anexar arquivo/áudio na conversa trocada.
   - **Correção (`preview/chat.js`):** Contadores de geração (`generation`, `fileGeneration`, `recordingGeneration`), bloqueio de envio enquanto `data?.selected?.key !== key`, e limpeza condicional do campo de texto apenas se `$('#chat-text').value === submittedText`.
   - **Evidência:** `tests/opy/chat-races.mjs` (3/3 PASS).

---

## 3. Matriz de Funcionalidades de Comunicação (Prévia Casa Opy)

| Funcionalidade | Status na Prévia | Evidência / Observação |
|---|---|---|
| Conversa privada 1:1 entre contas registradas | **Implementado e testado** | `preview/server/chat.mjs`, `tests/opy/chat.mjs`, `tests/opy/chat-browser.cjs` |
| Grupos privados até 12 pessoas com convite explícito | **Implementado e testado** | Aceite obrigatório (`chat_group_accept`), admin (`chat_group_admin`, `chat_group_remove`, `chat_group_update`), sem leitura retroativa antes do aceite |
| Envio idempotente e recuperação offline/retry | **Implementado e testado** | `clientId` UUID + UI "Tentar novamente" preservando rascunho (`tests/opy/chat-browser.cjs`) |
| Edição, resposta (quote), reações e cópia | **Implementado e testado** | `chat_edit`, `replyTo`, `chat_react` (`👍 ❤️ 👏 😂 😢`), sanitização contra payloads arbitrários |
| Apagar para mim / Apagar para todos + limpeza de mídia | **Implementado e testado** | `chat_delete` (`scope: 'me' \| 'all'`), remoção de anexo privado em `community.mjs` |
| Anexos privados (imagem, áudio, vídeo, PDF, TXT até 2 MB) e gravação de voz local | **Implementado e testado** | `/api/media?id=...` protegido por `chatMedia()`; `MediaRecorder` com parada automática em ocultação/troca de conversa |
| Busca na conversa, paginação (`before`), fixar, silenciar, arquivar, marcar não lida | **Implementado e testado** | Paginação de 30 mensagens (`hasMore`), preferências isoladas por conta |
| Bloqueio bilateral e registro de denúncia | **Implementado com aviso de escopo** | Bloqueio impede novas mensagens/edições/convites imediatamente; denúncia (`chat_report`) informa explicitamente que a fila de revisão humana ainda não está conectada na prévia |
| Chamadas de áudio e vídeo (1:1 / grupo) | **Não ativado (decisão pendente)** | Nenhuma chamada falsa na UI; aviso explícito em Opções da conversa |

---

## 4. Avaliação de Chamadas de Áudio/Vídeo e Custos Oficiais

O código legado (`public_html/xhr/agora.php`, `twilio.php`, `nodejs/`) possui integrações antigas para Agora e Twilio dependentes de chaves pagas e tabelas MySQL (`Wo_AudioCalls`, `Wo_VideoCalles`) sem verificação rigorosa de participação no canal. Para a Casa Opy, as opções avaliadas são:

1. **WebRTC P2P com STUN + TURN próprio (`coturn` na VPS Hostinger):**
   - **Custo de API:** R$ 0 em provedores terceiros (consome apenas banda da VPS para conexões que exigem relay TURN, ~30–50 kbps para áudio Opus e ~300–800 kbps para vídeo).
   - **Limitação:** Adequado para chamadas 1:1 e pequenos grupos (até 3–4 pessoas em malha); requer sinalização autenticada (WebSocket/SSE) e credenciais TURN efêmeras (HMAC `use-auth-secret`).
2. **LiveKit Cloud / Self-Hosted (SFU WebRTC open-source):**
   - **Self-hosted na VPS:** Gratuito (open-source Apache 2.0), suporta salas maiores com controle fino de permissões via JWT assinado pelo backend.
   - **Cloud gerenciado (referência oficial LiveKit):** Tier inicial gratuito limitado de desenvolvimento; planos pagos cobram por minuto de participante conectado/banda.
3. **Cloudflare Realtime / Calls (SFU gerenciado WebRTC):**
   - **Referência oficial:** Inclui franquia mensal gratuita inicial de tráfego WebRTC e cobrança por GB de dados de saída excedente, sem custo por minuto de áudio/vídeo parado.
4. **Decisão aplicada nesta entrega:** Não simular botões de chamada inoperantes nem embutir SDKs pagos sem decisão da equipe. O chat funciona integralmente por texto, anexos e gravação de mensagem de voz assíncrona (muito mais resiliente em conexões móveis instáveis de territórios indígenas).

---

## 5. Governança de Dados Indígenas (Princípios CARE), UX e Acessibilidade

- **Collective Benefit & Authority to Control:**
  - Nenhuma conversa entra em "sala pública" por padrão (`/chat/` inicia sem destinatário selecionado e exige escolha explícita ou aceite de convite em grupo).
  - Perfis históricos recuperados do acervo (`name:*`) não recebem mensagens nem amizades simuladas antes que a pessoa titular crie e reivindique sua conta.
  - Presença online ("visto por último" / "digitando") e confirmação de leitura para terceiros ficam desativadas por padrão, evitando vigilância involuntária.
- **Responsibility & Ethics:**
  - Aviso claro no topo de `/chat/`: as mensagens são armazenadas pela plataforma (sem criptografia ponta a ponta nesta arquitetura) e encaminhamentos pedem confirmação de permissão e não copiam anexos privados.
  - Denúncias informam honestamente que a moderação humana ainda não está conectada nesta prévia e orientam o uso do bloqueio imediato.
- **Acessibilidade e Responsividade:**
  - Controles com `<label>`, `aria-pressed`, `role="log"`, `aria-live="polite"`, `<dialog>` nativo, alvos mínimos de toque e áudio/vídeo com `preload="none"` para economizar franquia de dados.
  - Layout validado sem overflow horizontal em `320px`, `390px`, `768px` e `1440px` (`tests/opy/chat-browser.cjs`).

---

## 6. Limites Conhecidos e Backlog para Produção

- **Persistência e Tempo Real:** O storage da prévia (Vercel Blob / JSON transacional local com limite de 10.000 mensagens e polling de 5s quando visível) atende à homologação funcional, mas deve ser migrado para banco relacional indexado (PostgreSQL/MariaDB) e transporte por eventos (WebSocket/SSE) na VPS antes de abertura ampla.
- **Fila de Moderação Humana:** Conectar `state.chatReports` a um painel administrativo com protocolo comunitário definido pelas lideranças.
- **Vinculação de Contas do Acervo:** Definir processo seguro para que titulares das 7.418 contas históricas reivindiquem seus perfis no novo ambiente.
