# Etnias 2.0 — Auditoria técnica e funcional (Fase 0)

Data: 2026-11-07 · Branch: `cursor/banco-etnias-recuperado` · Commit base: `4869d23c`

Fontes: código do repositório, `docs/auditoria-comunitaria-2026-11-07.md`, `docs/HANDOFF-COMUNICACAO-SEGURA-2026-11-07.md` e o documento oficial **“ETNIAS.SITE 2.0 — Documento de Homologação, Testes e Correções do Sistema”** (arquivo `~/Downloads/implementação inicial.docx`).

> Atenção: os arquivos `~/Downloads/etnias 2.0.docx` e `etnias 2.0 (1).docx` (idênticos, mesmo MD5) **não** são o documento de homologação. Eles pedem uma reconstrução do backend em Laravel 12. Esse é outro escopo, tratado em `ETNIAS_IMPLEMENTATION_PLAN.md` §4.

Documentos irmãos: [Matriz](ETNIAS_REQUIREMENTS_MATRIX.md) · [UX](ETNIAS_UX_ARCHITECTURE.md) · [Design system](ETNIAS_DESIGN_SYSTEM.md) · [Plano](ETNIAS_IMPLEMENTATION_PLAN.md) · [QA](ETNIAS_QA_REPORT.md)

## 1. Inventário de arquitetura

Há duas aplicações no repositório.

| Camada | Legado `public_html/` (produção etnias.site) | Prévia `preview/` (casa-opy-preview.vercel.app) |
|---|---|---|
| Runtime | PHP/WoWonder + daemon Node Socket.IO (`public_html/nodejs/`) | Páginas estáticas geradas por `scripts/export-opy-preview.php` a partir de `preview/page.php` + funções Vercel Node ESM (`preview/api/community.js`, `preview/api/media.js` → `preview/server/*.mjs`) |
| Frontend | Temas Sunshine/WoWonder + camada Opy (`public_html/assets/opy/`) | JS puro sem framework: `preview/preview.js` (1.045 linhas), `preview/chat.js`, CSS `preview/preview.css` + `assets/opy/opy.css` |
| Persistência | MariaDB (`Wo_*`), banco recuperado, **não tocar** (`AGENTS.md`) | **Um único documento JSON** (`opy-v2/community.json`) no Vercel Blob privado, com escrita otimista por ETag e 8 tentativas (`preview/server/store.mjs`); arquivo local com lock em desenvolvimento |
| Mídia | `public_html/upload/` (acesso direto) | Blob privado `opy-v2/media/<uuid>`, servido só por `/api/media` com autorização |
| Autenticação | Cookie `user_id` + sessões no MySQL | Cookie HMAC HTTP-only (`server/session.mjs`), validado no `middleware.js` e em cada POST com checagem de `Origin`; senha com hash + salt; 8 tentativas de login por 10 min; 30 ações por minuto por conta |
| Tempo real | Socket.IO (legado) | **Polling**: 4 s no chat, intervalo configurável no feed, só com aba visível |
| Deploy | VPS Hostinger (fora de escopo) | Vercel, `preview/dist/vercel.json`, CSP restritiva (`default-src 'self'`), `noindex` |
| Stack | — | Sem Next.js, React, Supabase, Tailwind ou shadcn. Única dependência de runtime: `@vercel/blob@2.8.2` |

### Implicações

1. **Estado único em JSON.** Toda escrita relê e regrava o documento inteiro. Funciona para homologação, mas tem teto: limite de 10.000 mensagens, contenção sob concorrência e custo crescente por requisição. Com usuários reais, vira o gargalo número 1. Push, OTP, filas de notificação, Live e Reels precisam de banco relacional e de um worker.
2. **Sem transporte de eventos.** Presença, digitação instantânea, “entregue/visto” e Live dependem de WebSocket/SSE, que a arquitetura serverless atual não oferece.
3. **CSP `connect-src 'self'`.** Qualquer provedor externo (streaming, push, OTP) exige revisão da CSP.

## 2. Mapa de funcionalidades (prévia)

| Área | Situação | Evidência |
|---|---|---|
| Cadastro e login próprio | Funciona | `server/community.mjs` (`register`/`login`), integração PASS |
| Feed com acervo + publicações novas | Funciona | `preview.js` (render), `public-posts.json` (acervo autorizado) |
| Composer com abas Texto/Foto/Vídeo/Arquivo/Local/Ao vivo | Funciona (mídia até 2 MB) | `page.php` `#opy-compose`, `community.mjs` `publish` |
| Reações, comentários (só texto), salvar, repost, enquete | Funciona | `community.mjs` 361–440 |
| Filtros do feed: Tudo, Amigos, Fotos, Vídeos, Documentos, Áudios | Funciona no cliente | `page.php` `data-feed-view`, `preview.js:580` |
| Stories 24h com visualizador, gestos, autoavanço, pausa | Funciona | `preview.js:714-808`, `tests/opy/stories-browser.cjs` |
| Chat privado 1:1 e grupos (até 12) | Funciona com polling | `server/chat.mjs`, `chat.js`, 9 testes + E2E com 2 contas |
| Comunidades públicas/privadas com papéis e moderação | Funciona | `server/communities.mjs`, 4 testes |
| Maracá (central interna) + badges no cabeçalho | Funciona | `preview.js:543-690` |
| Perfil editável, seguir, amizade | Funciona | `profile_update`, `follow`, `friend` |
| EtnIA (FAQ restrita ao material aprovado) / IAra | Funciona | `server/etnia.mjs`, `server/iara.mjs` |
| Live | Só estúdio local de teste de câmera, rotulado “FORA DO AR” | Sem servidor de mídia |
| Push, WhatsApp, e-mail, OTP, 2FA | Não existe | Nenhuma ocorrência no código; `sw.js` não trata `push` |
| Painel administrativo | Não existe na prévia | — |

## 3. Diagnósticos por área prioritária

### Inbox
- **Pontos fortes:** autorização por mensagem (`canRead`), proteção contra IDOR, envio idempotente com `clientId` + SHA-256, bloqueio bilateral, anexos privados revogáveis, master-detail no mobile, sem overflow de 320 a 1440 px.
- **Lacunas:** sem solicitação de conversa (2.2): qualquer conta registrada pode mandar DM. Sem “entregue/visto” para o remetente. Presença desligada de propósito (decisão CARE, a confirmar). Tempo real por polling de 4 s. Denúncias sem fila humana. Grupo sem imagem.
- **Visual (comparado à referência enviada):** a referência usa bolhas azuis, a faixa “Online friends”, botão “+” com bottom sheet de anexos (Documento, Câmera, Galeria, Áudio, Local, Contato, Enquete, GIF) e microfone no campo. O chat atual tem as funções principais, mas segue a paleta vermelha e o anexo/emoji em linha. A adaptação visual entra nas Fases 1 e 3. A faixa “Online” depende da decisão sobre presença.

### Comunidades
Ciclo completo implementado (descobrir, entrar, solicitar, aprovar, convidar, papéis, moderar, denunciar), com isolamento no servidor do feed privado. Falta: fila de denúncias para revisão humana, capa/imagem e regras para conteúdo culturalmente restrito (12.5) além de “privada”.

### Feed e Composer
- O Composer tem todas as ações exigidas (incluindo Ao vivo honesto). Falta comprovar que o caminho A (botão central) e o B (balão no feed) abrem o **mesmo** fluxo. Hoje o botão central só foca o textarea.
- Os filtros existem, mas não batem com o documento: faltam **Seguindo** (hoje “Amigos”, que mistura seguir e amizade), **Descobrir pessoas**, **Microblog** e **Localidade**. A barra não está ligada ao ocultamento dos Stories.
- Comentários são só texto: sem curtir, responder, compartilhar ou contagens (6.12).
- Áudio: o filtro existe; duração e “um áudio por vez” não foram verificados.

### Identidade visual
- A logo oficial (`assets/opy/etnias-logo.png`) é **monocromática marrom-escura**. O azul não conflita com ela.
- Os tokens atuais usam o vermelho `#bd171c` como cor principal (`DESIGN.md`; `PRODUCT.md`: “vermelho como destaque”). A direção **azul premium** aprovada nesta missão **contradiz os dois documentos de governança**. Eles precisam ser atualizados no mesmo PR da troca de tokens, senão agentes futuros vão reverter a mudança.
- No cabeçalho, o gatilho do menu é um botão de texto “Opy” (`public_html/assets/opy/views/header.php`). A logo Etnias só aparece na tela de entrada. O item 4.1 (logo à direita como gatilho do menu) não está implementado.
- Cores hexadecimais espalhadas: `preview.css` quase não usa variáveis. A troca de paleta exige primeiro centralizar em `:root`.

## 4. Defeitos confirmados nesta auditoria

| # | Severidade | Defeito | Arquivo |
|---|---|---|---|
| D1 | Alta (privacidade/confiança) | A ajuda e a EtnIA dizem que o Chat “é uma sala pública” e que “quem está no ambiente vê as mensagens”. O chat agora é privado. Usuários recebem informação falsa sobre quem lê suas mensagens. | `preview/page.php:35`, `preview/server/etnia.mjs:37,44,93` |
| D2 | Média | A ajuda diz que “conversas com destinatários” não estão ligadas. Elas estão. | `preview/page.php:35` |
| D3 | Baixa | `sw.js` registra um `fetch` vazio: não traz cache nem push, só o custo do registro. | `preview/sw.js` |
| D4 | Média (moderação) | A antiga **sala pública** continua viva no servidor: `action: 'message'` grava e todo snapshot devolve as últimas 100 mensagens a qualquer conta logada. Nenhuma página renderiza o formulário (`#preview-message-form` só existe em `preview.js:953`), então é um canal de broadcast invisível na interface e sem moderação. Um teste ainda confirma esse comportamento (`tests/opy/live-api.cjs:48-49`). | `preview/server/community.mjs:157,435-437`, `preview/preview.js:599-613,953` |

D1 e D2 foram corrigidos nesta sessão (ver [QA](ETNIAS_QA_REPORT.md)). D4 **não** foi alterado: remover a sala é tirar uma funcionalidade, e isso precisa de aprovação. Recomendação: remover a ação `message`, o campo `messages` do snapshot e o código morto do cliente, preservar `state.messages` armazenado (sem apagar dados) e atualizar `live-api.cjs`.

## 5. Estado dos testes (executados em 2026-11-07, nesta sessão)

| Suite | Resultado |
|---|---|
| `node --test chat.mjs chat-races.mjs communities.mjs local-store.mjs etnia.mjs` | **19/19 PASS** |
| `OPY_TEST_PORT=8127 node tests/opy/community-integration.mjs` | **PASS** |
| Testes PHP (`navigation.php`, `legacy-request-auth.php`, `sidebar-ads.php`) | **NÃO EXECUTADOS**: não há `php` instalado nesta máquina (a sessão anterior usava container) |
| Playwright (`chat-browser.cjs`, `stories-browser.cjs`, `browser.cjs`) | **NÃO EXECUTADOS** nesta sessão |
| `preservation.py`, `backup-restore.py` | **BLOQUEADOS**: dependem do container `etnias-backup-audit`, desligado de propósito |

## 6. Riscos e dependências

| Risco | Impacto | Mitigação |
|---|---|---|
| Estado em JSON único | Perda de desempenho e conflito de escrita com usuários reais | Migrar para banco relacional indexado antes de abrir ao público |
| Ausência de provedores (WhatsApp Business, e-mail transacional, Web Push VAPID, streaming) | Bloqueia todo o Módulo 01, o 03 e o 6.8 | Decisão e credenciais do responsável pelo produto |
| Conflito entre a reconstrução em Laravel 12 e a evolução da prévia Node | Trabalho duplicado | Decidir a plataforma de destino antes da Fase 6 |
| Moderação sem fila humana | Risco jurídico e comunitário ao abrir | Painel de moderação + protocolo definido pelas lideranças |
| Conteúdo cultural restrito | Exposição indevida | Níveis de visibilidade definidos com as comunidades (12.5) |
