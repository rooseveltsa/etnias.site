# Casa Opy — Rede viva (legado dentro da Casa Opy + experiência de app)

Decisão de 2026-11-08 (Claude, com autonomia delegada pelo usuário: "decida o que é melhor para o projeto"): **a Casa Opy é a mesma rede Etnias continuando**, não um recomeço. O que faz uma rede parecer "de verdade" é gente com rosto e memória visual; o Etnias já tem isso e a Casa Opy hoje nasce vazia. Complementa `plans/etnias-qualidade-usabilidade.md`.

## Diagnóstico (medido, não estimado)

Banco recuperado (MariaDB local `deploy/compose.yaml`, serviço `db`, base `etnias`; mesma cópia está na VPS em /srv/etnias):

| Dado | Quantidade |
|---|---|
| Contas | 7.418 (7.124 ativas, 136 banidas); 6.271 com foto de perfil; 539 com capa; 485 com "sobre" |
| Publicações ativas | 13.777 → 5.864 `post` + 783 sem tipo = **6.647 publicações reais**; 6.431 `profile_picture`; 698 `profile_cover_picture` |
| Privacidade | 13.456 públicas (`postPrivacy=0`); o resto não entra |
| Mídia referenciada | 16.804 refs; **7.743 existem** em `public_html/upload` (17,97 GB): 7.262 imagens (3,6 GB) + 455 vídeos (14 GB, 218 acima de 20 MB); 9.061 refs perdidas |
| Grupos | 58 (48 públicos, 10 privados), 1.817 participações. Maiores: Retomada 235, Nheengatu 195, AdminEtnias 148, saopaulo 92, Riotapajos 89 |
| Relações | 26.810 "seguir"; 8.824 mútuas (→ amizades) |
| Comentários / reações | 2.549 / 21.932 (1=like 16.653, 2=amei 2.632, 9: 1.010, 3–8 poucos) |
| Senhas | bcrypt (`password_hash`, 60 chars) em 100% → login antigo é possível com `bcryptjs` |
| Mensagens privadas | 2.925 — **não importar** (privacidade; chat novo tem regras próprias) |
| Usernames fora do padrão Opy | 16; e-mails inválidos: 0; telefones: 202 |

Mídia **não está na VPS** (`/srv/etnias/app/upload` tem 336 KB); está só neste Mac. VPS tem 188 GB livres.

Arquitetura atual que impede importar como está:
- `snapshot()` em `preview/server/community.mjs` envia **todos** os posts (com comentários) e **todas** as contas (`directory`) em cada GET, e calcula `followersCount` em O(contas × seguidores). Com 7 mil contas e 6 mil posts = payload de vários MB por requisição e cliente renderizando tudo.
- `local-store.mjs` lê e faz `JSON.parse` do arquivo inteiro a cada requisição e reescreve tudo a cada ação.
- Limite de 400 contas no `register`.
- Auditoria mobile nunca rodou em 375 px: `ctx.newPage({ viewport })` ignora o viewport no Playwright (tem de ir em `newContext`). As capturas "375" têm 1280 px.

## Fases

### Fase 0 — Correções de base (mesmo dia)
- [x] `tests/opy/audit-screens.cjs`: um `newContext({ viewport })` por largura; refazer a auditoria mobile depois da Fase 1.
- [x] Este plano commitado.

### Fase 1 — Pessoas e memória (legado dentro da Casa Opy)
Servidor:
- [x] `local-store.mjs`: cache em memória do estado (um processo); escrita continua atômica. Comentário `shortcut:` já existe.
- [x] Contas: `avatarUrl`/`coverUrl` (URL direta) além de `avatarId`; `legacyId`, `legacyPassword` (bcrypt). Login: se `legacyPassword` e sem `password`, verifica com `bcryptjs`, migra para scrypt e apaga o bcrypt. Dependência nova: `bcryptjs` (puro JS, sem build nativo) — justificada: Node não tem bcrypt.
- [x] Limite de contas: env `OPY_MAX_ACCOUNTS` (padrão 20000).
- [x] Mídia: `mapMedia` aceita `m.url` direto; posts legados usam `image: '/legado/upload/...'` ou `media: {kind:'video', url}`; cliente aceita prefixo `/legado/`.
- [x] Rota estática `/legado/*` em `scripts/opy-preview-server.mjs` lendo `OPY_LEGACY_MEDIA_DIR` (sem `..`, só extensões de imagem/vídeo/pdf/áudio, `Cache-Control: public, max-age=31536000, immutable`). Só mídia de posts públicos e fotos de perfil/capa.
- [x] Snapshot enxuto: `posts` = página (30 mais recentes visíveis; `?view=posts&before=<ts>&author=<key>&community=<id>&kind=`), `directory` = só pessoas relacionadas a mim (amigos, pedidos, seguindo) + 12 sugestões; `?view=search&q=` para pessoas e posts; contagens pré-computadas (Map) em vez de O(n²).
- [x] Cliente (`preview/preview.js`): "Carregar mais" + IntersectionObserver no feed; perfil e comunidade buscam posts do autor/comunidade; busca usa a API; convite para comunidade usa busca.
Importação:
- [x] `scripts/import-legacy.py` (reaproveita `rows()` de `import-public-preview.py`): gera `legacy-import.json` com contas (ativas e não banidas; username normalizado, 16 casos recebem sufixo), posts públicos (`post`/sem tipo, sem `group_id`/page/event/recipient/parent; texto limpo de HTML e `#[id]`→hashtag; `postFile` imagem/vídeo se existir no disco), comentários, reações (1→like, 2→heart, 3→laugh, 4→wow, 5→sad, demais→like), follows, amizades (mútuas), grupos→comunidades (privacy 1 pública/2 privada; membros; `legacyId`), e `media-manifest.txt` (caminhos relativos existentes). `profile_picture`/`profile_cover_picture` não viram posts.
- [x] `scripts/opy-import-legacy.mjs`: mescla `legacy-import.json` no `community.json` de forma **idempotente** (`legacyId`); nunca apaga nada; não toca em contas já existentes com mesmo username (relata conflito).
- [x] Mídia para a VPS: `rsync --files-from=media-manifest.txt` (imagens primeiro, vídeos depois, resumível) para `/srv/casa-opy/legacy-media`; bind mount em `compose.vps-caddy.yaml`; env `OPY_LEGACY_MEDIA_DIR=/legacy-media`.
- [x] Executar na VPS: copiar JSON, parar `opy`, rodar a mesclagem dentro do container (`docker compose run --rm opy node scripts/opy-import-legacy.mjs ...`), subir. Backup do `community.json` antes (já existe rotina diária em `deploy/opy/backup`).
Gate (2026-11-08): 39 testes ok; E2E ok; snapshot 241 KB / ~170 ms local com 6.989 contas e 4.370 posts; auditoria 375 real: 0 overflow, alvos <44 só os 4 botões do compositor (40×40) e um chip em /grupos/. Produção: mesclagem feita em 2026-11-08 04:18 UTC (7.053 contas, 3.894 posts, 62 comunidades; backup `community.json.antes-importacao-*` em /data). **4 conflitos de username** (karuan, eliaquimterena, mistikah, ligiabremer: pessoas que recriaram a conta na Casa Opy com o mesmo @) → 480 posts delas ficaram de fora; **vinculadas em 2026-11-08 05:44 UTC** por decisão do usuário (`--link karuan,eliaquimterena,mistikah,ligiabremer`): +480 publicações, 904 atualizadas, 4.797 relações; produção com 7.060 contas / 4.375 publicações. Mídia completa na VPS: 13 GB, 5.092 arquivos.
Gate original: `node --test tests/opy/*.mjs`; E2E local com dados importados (servidor local descartável); medir tamanho do snapshot (< 300 KB) e tempo do GET (< 150 ms local); auditoria 375/768/1440 refeita; login de uma conta legada (local, com hash de teste).

### Fase 2 — Experiência de app (Instagram/Facebook, identidade indígena sem grafismo inventado)
Decisão de 2026-11-08 (usuário: "seguir com a Fase 2"). Baseline medido em 375 px com dados de produção: barra de ações quebra em duas linhas (5 botões), stories são cartões com miniatura, comentários com avatar de letra, feed só cronológico, notificações calculadas no cliente a partir da página 1 (erradas com 30 posts por página), link `/#post-<id>` só funciona se o post está na página carregada.

Servidor (`preview/server/community.mjs`):
- [x] `projectPost`: `reactedBy` (até 3 nomes, "você" primeiro) e `avatar` em cada comentário.
- [x] `postsPage`: parâmetro `id` (uma publicação, para permalink `/#post-<id>`, notificações e explorar).
- [x] Sugestões com motivo: pessoas que dividem comunidade comigo ou são amigas de amigos antes das mais seguidas; campo `reason` ("Na comunidade X", "Amiga de Y", "Popular na rede").
- [x] `?view=notifications`: itens agregados por publicação ("Ana e mais 3 curtiram sua publicação", "Beto comentou: …", "X começou a seguir você", pedidos de amizade, convites e pedidos de entrada), com `createdAt`, `href` e ações; `unreadNotifications` no snapshot; ação `notifications_seen` grava `notificationsSeenAt` na conta. shortcut: reações e seguidores não têm data gravada, então entram com a data da publicação/agora e só contam como novos uma vez.
- [x] Testes em `tests/opy/community-integration.mjs`.

Cliente (`preview/preview.js`, `preview/preview.css`):
- [x] Cartão mídia-first: imagem de borda a borda no celular, altura máxima 4:5 (corte como no Instagram), carrossel com snap e contador para várias imagens, duplo toque curte (coração animado), vídeo em autoplay mudo quando visível e pausa fora da tela, toque na imagem abre visualizador em tela cheia.
- [x] Barra de ações em uma linha: Curtir (com bandeja de reações no toque longo; mostra a reação escolhida), Comentar, Repostar e Salvar à direita; o botão "Amei" separado sai (duplicava a bandeja). Linha de reações "👍❤️ Você, Ana e mais 12".
- [x] Comentários com foto.
- [x] Stories em anel: círculos com borda vermelha quando não vistos e cinza quando vistos, "Seu story" com +; viewer com foto do autor.
- [x] Perfil: contagem de publicações do servidor (não a página carregada).
- [x] Notificações: página lê `view=notifications`, marca vistas ao abrir; sino com contagem do servidor.
- [x] Sugestões "Pessoas para seguir" entre a 2ª e a 3ª publicação do feed padrão (carrossel horizontal, Seguir inline, fechar).
- [x] Explorar: `/search/` sem termo mostra grade de fotos recentes e comunidades.
- [x] Permalink: `/#post-<id>` fora da página carrega a publicação sozinha no topo com "Ver feed".
- [x] Pull-to-refresh no celular e pílula "N novas publicações" quando a atualização periódica traz posts e a pessoa está rolada para baixo (sem saltar o conteúdo).
- [x] Alvos < 44 px restantes (botões do compositor, chip em /grupos/).
Gate (2026-11-08): 40 testes ok; E2E community-entry e i18n ok; auditoria 375/768/1440 com 0 overflow, 0 axe sério, 0 alvo < 44 px; i18n 1.529 textos, 0 faltando em en/es. Extra feito: texto longo recolhido com "Ver mais"; "Acervo público" só para posts sem conta. Pendente para a Fase 3: miniaturas das fotos do legado (originais de até 5 MB pesam no celular; exige redimensionar no servidor).

### Fase 3 — Base para crescer
SQLite (`node:sqlite`) no lugar do JSON único; push (VAPID); recuperação de senha por e-mail (precisa SMTP → decisão do usuário); vídeos do legado acima de 20 MB (218 arquivos, ~12 GB) transcodificados.

## O que fica com o usuário
Dinheiro (GitHub Pro, SMTP), apagar dados de pessoas reais, grafismos/povos/conhecimento tradicional, mudar esta direção.
