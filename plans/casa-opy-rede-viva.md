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
Gate (2026-11-08): 39 testes ok; E2E ok; snapshot 241 KB / ~170 ms local com 6.989 contas e 4.370 posts; auditoria 375 real: 0 overflow, alvos <44 só os 4 botões do compositor (40×40) e um chip em /grupos/. Produção: mesclagem feita em 2026-11-08 04:18 UTC (7.053 contas, 3.894 posts, 62 comunidades; backup `community.json.antes-importacao-*` em /data). **4 conflitos de username** (karuan, eliaquimterena, mistikah, ligiabremer: pessoas que recriaram a conta na Casa Opy com o mesmo @) → 480 posts delas ficaram de fora; decisão do usuário: vincular a conta antiga à nova (confirmar identidade) ou manter separadas. Vídeos (11 GB) ainda em rsync.
Gate original: `node --test tests/opy/*.mjs`; E2E local com dados importados (servidor local descartável); medir tamanho do snapshot (< 300 KB) e tempo do GET (< 150 ms local); auditoria 375/768/1440 refeita; login de uma conta legada (local, com hash de teste).

### Fase 2 — Experiência de app (Instagram/Facebook, identidade indígena sem grafismo inventado)
Feed com mídia em destaque (imagem de borda a borda, duplo toque para curtir, carrossel para álbuns, vídeo mudo em autoplay), linha de reações com rostos, barra de ações grande e igual, stories com anel e estado visto, barra inferior de app com 5 destinos + botão de publicar, perfil com grade de fotos e abas, notificações agregadas ("X e mais 3 curtiram"), sugestões "pessoas da sua comunidade", explorar em grade, busca unificada, pull-to-refresh, pílula "novas publicações". Detalhar quando a Fase 1 estiver no ar.

### Fase 3 — Base para crescer
SQLite (`node:sqlite`) no lugar do JSON único; push (VAPID); recuperação de senha por e-mail (precisa SMTP → decisão do usuário); vídeos do legado acima de 20 MB (218 arquivos, ~12 GB) transcodificados.

## O que fica com o usuário
Dinheiro (GitHub Pro, SMTP), apagar dados de pessoas reais, grafismos/povos/conhecimento tradicional, mudar esta direção.
