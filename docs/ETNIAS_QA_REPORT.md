# Etnias 2.0 — Relatório de QA

Sessão de 2026-11-07. Separação obrigatória entre teste automatizado executado, manual e não executado.

## 1. Testes automatizados executados nesta sessão

| Comando | Momento | Resultado |
|---|---|---|
| `node --test tests/opy/chat.mjs tests/opy/chat-races.mjs tests/opy/communities.mjs tests/opy/local-store.mjs tests/opy/etnia.mjs` | Antes das mudanças | 19/19 PASS |
| `OPY_TEST_PORT=8127 node tests/opy/community-integration.mjs` | Antes das mudanças | PASS |
| Mesmo conjunto `node --test` (19 testes) | Depois das mudanças | 19/19 PASS |
| `OPY_TEST_PORT=8128 node tests/opy/community-integration.mjs` | Depois das mudanças | PASS |
| `answerEtnia()` para “o chat é uma sala publica?”, “o que ja funciona”, “onde fica o chat” | Depois | Retornam as fontes `chat`, `previa` e `caminhos` com o texto corrigido |

## 2. Não executados

| Suite | Motivo |
|---|---|
| `tests/opy/navigation.php`, `legacy-request-auth.php`, `sidebar-ads.php`, `preview.php` | `php` não está instalado nesta máquina |
| `chat-browser.cjs`, `stories-browser.cjs`, `browser.cjs`, `media-browser.cjs`, `ux-live.cjs`, `iara-browser.cjs` (Playwright) | Não executados nesta sessão; últimos PASS registrados no handoff de 2026-11-07 |
| `live-api.cjs`, `vercel-preview.cjs` | Exigem a prévia publicada; nenhum deploy foi feito |
| `preservation.py`, `backup-restore.py`, `prepare-recovery.py` | Dependem do container `etnias-backup-audit`, desligado de propósito (`AGENTS.md`) |
| Homologação multi-sessão manual | Não realizada nesta sessão |

## 3. Verificações manuais e de inspeção

- Contraste da paleta proposta, calculado pela fórmula WCAG 2.x (luminância relativa). Todos os pares de texto ≥ 5,33:1 (`ETNIAS_DESIGN_SYSTEM.md` §2).
- Leitura do código para os 47 itens (evidências em `ETNIAS_REQUIREMENTS_MATRIX.md`).

## 4. Mudanças feitas nesta sessão

| Arquivo | Mudança | Requisito |
|---|---|---|
| `preview/server/etnia.mjs` | Entradas `caminhos`, `chat` e `previa`: deixam de dizer que o Chat é sala pública; `revised` → `2026-11-07` | D1 / CX-QA-01 |
| `preview/page.php` (rota `help`) | Mesmo ajuste; deixa de dizer que conversas com destinatário não estão ligadas; esclarece que as mensagens privadas **antigas** não foram importadas | D1, D2 |
| `docs/ETNIAS_*.md` (6 arquivos) | Entregáveis da Fase 0 | — |

Reversão: `git checkout -- preview/server/etnia.mjs preview/page.php`.

**Pendente para publicar:** `preview/dist/` (gitignored) **não** foi regenerado. É preciso rodar `php scripts/export-opy-preview.php` num ambiente com PHP antes de qualquer deploy. Nenhum deploy foi feito.

## 5. Regressões conhecidas

Nenhuma introduzida. O achado D4 (sala pública viva no servidor) foi resolvido na rodada 2 (§6).

## 6. Rodada 2 — chamadas, chat e VPS (2026-11-07)

### Executado

| Comando | Resultado |
|---|---|
| `node --test tests/opy/calls.mjs chat.mjs chat-races.mjs communities.mjs local-store.mjs etnia.mjs` | 24/24 PASS |
| `OPY_TEST_PORT=8129 node tests/opy/community-integration.mjs` | PASS |
| `php tests/opy/navigation.php` e `legacy-request-auth.php` (via `docker run php:8.2-cli`) | PASS, 0 falhas |
| `php scripts/export-opy-preview.php` (Docker) | 29 páginas, inclui `calls.js` |
| `chat-browser.cjs` (Chrome local, base limpa) | PASS |
| `calls-browser.cjs` (2 navegadores, câmera/microfone simulados) | PASS: vídeo conectado com quadros nas duas pontas, chamada recebida em outra página, mudo, encerrar com duração, voz recusada, mobile sem overflow |
| Os dois E2E contra a imagem Docker da VPS (`deploy/opy/Dockerfile`), com CSP ativa | PASS |
| coturn 4.6.3 com `deploy/opy/turnserver.conf` | Inicia; só avisos esperados de certificado ausente |

Observação: rodar `chat-browser.cjs` duas vezes na mesma base falha por nome de comunidade duplicado. É limitação do teste (nome fixo), não regressão. Rode sempre com base limpa.

### Não executado

- Chamada real entre redes diferentes (Wi-Fi × 4G) passando pelo TURN: exige a VPS publicada com DNS e certificado.
- `live-api.cjs` e `vercel-preview.cjs`: exigem ambiente publicado.
- Teste em iPhone/Safari real (o E2E usa Chromium).

### Mudanças

`preview/server/calls.mjs` (novo), `preview/calls.js` (novo), `preview/server/community.mjs` (rota `view=calls`, ações `call_*`, remoção da sala pública), `preview/server/chat.mjs` (`canCall`, registros de chamada imutáveis), `preview/chat.php` e `preview/chat.js` (novo visual), `preview/preview.css` (bloco do chat e tela de chamada), `preview/preview.js` (−37 linhas mortas), `preview/page.php` (carrega `calls.js`, versões de cache), `scripts/export-opy-preview.php`, `scripts/opy-preview-server.mjs` (`HOST` e cabeçalhos de segurança), `deploy/opy/*` (novo), testes `calls.mjs`, `calls-browser.cjs`, `chat-browser.cjs`, `live-api.cjs` e `chat-races.mjs` (o DOM simulado ganhou `style` e `classList`, usados pelo novo campo que cresce sozinho e pelo botão de gravação; sem isso 2 testes falhavam).

## 7. Rodada de usabilidade (2026-11-07, decisões delegadas pelo usuário)

**Mudanças:** barra flutuante só no celular; barra do celular Feed · Comunidades · Postagem · Saberes · EtnIA (criar no centro); “Grupos” → “Comunidades” na prévia; Mercado, Eventos, Filmes, Empregos, Coletas, Álbuns, Recordações e Minhas páginas fora do menu até existirem (rotas diretas com aviso honesto); filtros e rótulos de comunidades unificados; plurais corretos; alvos de toque ≥ 44 px. Detalhes em `docs/ETNIAS_UX_AUDIT.md`.

**Gate final (servidor local limpo):** `node --test` com admin, calls, chat, chat-races, communities, local-store e etnia: 31/31 PASS; `community-integration.mjs`: PASS; `chat-browser.cjs` e `calls-browser.cjs`: PASS; `audit-screens.cjs` (29 rotas × 375/768/1440): 0 overflow, 0 violação axe séria/crítica, 0 alvo < 44 px, 0 erro JS.

**Fica para depois:** isolar as regras `body.opy-preview` do `opy.css` e tokens de cor (Etapa 2 do plano); estados vazios com ação (Maracá); revisão visual de entrada, Stories, EtnIA e IAra; regressão visual automática; teste com 5 usuários reais.
