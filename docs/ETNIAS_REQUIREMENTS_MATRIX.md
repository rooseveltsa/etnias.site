# Etnias 2.0 — Matriz de homologação

Referência: “ETNIAS.SITE 2.0 — Documento de Homologação, Testes e Correções do Sistema” (47 itens, 1.1 a 6.13). Ambiente: prévia `preview/` (casa-opy-preview.vercel.app). Auditoria em 2026-11-07, commit `4869d23c`.

**Estados:** ✅ IMPLEMENTADO E VALIDADO · 🟡 IMPLEMENTADO PARCIALMENTE · ⛔ NÃO IMPLEMENTADO · 🔒 BLOQUEADO POR DEPENDÊNCIA · ❔ NÃO VERIFICADO

**Teste:** `A` = automatizado e executado nesta sessão · `A*` = automatizado, executado em sessão anterior (handoff) e não repetido · `M` = manual · `—` = nenhum

Itens do documento são requisitos, não defeitos confirmados.

## Resumo

| Módulo | Itens | ✅ | 🟡 | ⛔ | 🔒 | ❔ |
|---|---|---|---|---|---|---|
| 01 Login e cadastro | 9 | 0 | 3 | 4 | 2 | 0 |
| 02 Chat | 9 | 1 | 7 | 1 | 0 | 0 |
| 03 Notificações | 8 | 0 | 1 | 4 | 3 | 0 |
| 04 Logo e menu | 2 | 0 | 2 | 0 | 0 | 0 |
| 05 Stories | 6 | 0 | 2 | 4 | 0 | 0 |
| 06 Feed e publicações | 13 | 0 | 7 | 5 | 1 | 0 |
| **Total** | **47** | **1** | **22** | **18** | **6** | **0** |

## Módulo 01 — Login, autenticação e cadastro

| ID | Requisito | Estado | Evidência no código | Teste | Dependência | Critério de aceite |
|---|---|---|---|---|---|---|
| 1.1 | WhatsApp: OTP, recuperação, validação de telefone, avisos | 🔒 | Telefone coletado no cadastro (`community.mjs` `phoneOf`) sem verificação. Nenhum envio. | — | Provedor WhatsApp Business (Meta Cloud API ou BSP), templates aprovados, número verificado | Código chega no WhatsApp, expira, tem limite de tentativas; troca de telefone só após OTP no número novo |
| 1.2 | E-mail: confirmação, recuperação de senha, avisos, troca de endereço | 🔒 | Campo “Chave Google” (e-mail) coletado sem confirmação. Não há recuperação de senha. | — | Provedor de e-mail transacional + domínio com SPF/DKIM/DMARC | Link/código de uso único; recuperação não revela se o e-mail existe |
| 1.3 | Preferências por canal, separando transacional de opcional | ⛔ | — | — | 1.1, 1.2, 3.8 | Tela com canal × categoria; transacionais não podem ser desligados |
| 1.4 | 2FA, limite de tentativas, recuperação segura | 🟡 | Limite de 8 tentativas de login por 10 min (`community.mjs:283`) e 30 ações/min por conta (`:345`). Sem 2º fator. | A (integração: “limite”) | 1.1/1.2 para o 2º fator | Login com 2FA ativo exige código; códigos de recuperação de uso único |
| 1.5 | Histórico de acessos, dispositivos, sessões ativas, encerramento remoto, alertas | 🟡 | Sessões por conta com expiração e revogação; dispositivos independentes (`account.sessions`). Não há tela de sessões, histórico nem alerta. | A (integração: “sessões com expiração/revogação, dispositivos independentes”) | UI; 3.8 para alertas | Usuário vê sessões com navegador/data e encerra outra sessão; a sessão encerrada recebe 401 |
| 1.6 | Painel admin de integrações (status, falhas, testes, modelos) | ⛔ | — | — | Painel admin (inexistente) + 1.1/1.2 | Admin envia mensagem de teste e vê o log de falhas |
| 1.7 | LGPD: consentimento, separação promocional/segurança, atualização de dados, rastreabilidade | 🟡 | Edição de perfil (`profile_update`); teste de PII na integração; aviso de privacidade no chat. Sem registro de consentimento nem trilha de alterações. | A (integração: “PII”) | Base legal definida pelo controlador | Consentimento registrado com data/versão; exportação e exclusão de dados |
| 1.8 | Personalização visual do cadastro via painel | ⛔ | Tela `/entrar/` fixa em `page.php:13` | — | Painel admin | Admin altera textos/cores com pré-visualização; contraste validado antes de publicar |
| 1.9 | Templates sazonais agendados | ⛔ | — | — | 1.8 | Template ativa e desativa sozinho nas datas; volta ao padrão |

## Módulo 02 — Inbox e chat

| ID | Requisito | Estado | Evidência no código | Teste | Dependência | Critério de aceite |
|---|---|---|---|---|---|---|
| 2.1 | Conversas privadas: envio, histórico, data/hora, enviado/entregue/visto, tempo real | 🟡 | `server/chat.mjs` (`dm`, paginação, `chat_read`), `chat.js` | A (unit), A* (E2E 2 contas) | Eventos (WebSocket/SSE) para tempo real; decisão sobre recibo de leitura | Mensagem aparece na outra sessão em menos de 2 s; remetente vê entregue/visto se o destinatário permitir. **Hoje:** polling de 4 s, sem recibos para o remetente |
| 2.2 | Solicitação de conversa (aceitar, recusar, bloquear, notificar) | ✅ | `relationOf()` em `preview/server/chat.mjs`: sem vínculo (amizade, seguir de volta ou aceite), a 1ª mensagem vira solicitação só de texto; caixas Principal/Solicitações; Aceitar/Recusar/Bloquear; contador no cabeçalho | A (2 testes “Direct” em `tests/opy/chat.mjs`), A (E2E `chat-browser.cjs` aceita pela interface) | — | Atendido |
| 2.3 | Grupos: criar, nome e imagem, membros, admin/criador, sair, histórico | 🟡 | `chat_group_*` (criar, convite, aceitar, admin, remover, sair); sem leitura retroativa | A (unit “grupos exigem convite aceito…”) | Upload de imagem do grupo | Falta só a imagem do grupo |
| 2.4 | Notificações do chat: mensagem, solicitação, aprovação, grupo, contador | 🟡 | Contador de não lidas por conversa e badge no cabeçalho (`preview.js:543`); convites de grupo no chat | A (unit “paginação… leitura”) | 3.1/3.8 para push | Badge correto entre sessões; push fora do app |
| 2.5 | Presença online/ausente/offline com privacidade | ⛔ | Desligada de propósito (decisão CARE em `auditoria-comunitaria` §5) | — | Eventos + decisão de produto | Presença só visível com opt-in; atualiza em menos de 30 s |
| 2.6 | Indicador de digitação em tempo real | 🟡 | `chat_typing` com expiração, sem persistência longa | A (unit “indicador de digitação…”) | Eventos para baixa latência | Aparece em menos de 2 s; hoje depende do polling de 4 s |
| 2.7 | Arquivos: áudio, imagem, vídeo, documento, validação no back-end | 🟡 | Validação de tipo/tamanho em `mediaInput`; anexo privado em `/api/media`; gravação de voz | A (unit “anexos…”), A* (`media-private.cjs`) | Storage maior que 2 MB (limite atual) | Vídeo de 30 s envia; tipo forjado é rejeitado |
| 2.8 | Denúncia e bloqueio; ferramentas de moderação | 🟡 | `chat_block` bilateral, `chat_report` gravado | A (unit “bloqueio bilateral…”) | Painel de moderação + protocolo comunitário | Moderador vê a denúncia, decide e o resultado fica registrado |
| 2.9 | Privacidade: quem inicia conversa, status online, validação no back-end | 🟡 | Validação no servidor em todas as ações; quem inicia conversa é regido por vínculo (amizade/seguir/aceite) e desconhecidos só mandam solicitação. Falta a preferência explícita “quem pode me enviar mensagem” e o controle de status online. | A | 2.5 | Preferências respeitadas no servidor |

> Nenhum item do Módulo 02 está completo de ponta a ponta. O núcleo da mensageria 1:1 (envio, recebimento, histórico e data entre duas sessões) está validado por E2E com duas contas (`chat-browser.cjs`), mas 2.1 continua 🟡 por causa dos recibos e do tempo real.

## Módulo 03 — Central de notificações

| ID | Requisito | Estado | Evidência no código | Teste | Dependência | Critério de aceite |
|---|---|---|---|---|---|---|
| 3.1 | Push (Android/iOS/Web), badge numerado, navegação ao conteúdo | 🟡 | Central interna Maracá (`/notificacoes/`), badges no cabeçalho com link. `sw.js` sem `push`. | M (código) | Chaves VAPID, fila de envio, banco | Push chega com a aba fechada; clique abre o conteúdo; badge zera ao ler |
| 3.2 | WhatsApp | 🔒 | — | — | 1.1 | Opt-in registrado; desligar canal para os envios |
| 3.3 | E-mail | 🔒 | — | — | 1.2 | Idem |
| 3.4 | Preferências por canal e categoria | ⛔ | — | — | 3.8 | Matriz canal × categoria persistida e respeitada |
| 3.5 | Painel admin (eventos, modelos, histórico, falhas, campanhas) | ⛔ | — | — | Painel admin | — |
| 3.6 | Visitantes de perfis verificados | ⛔ | — | — | Selo de verificação, base legal, opt-out do visitante | Visitante com modo privado não aparece; histórico tem prazo de retenção |
| 3.7 | Premium: alertas de novos usuários | 🔒 | — | — | Provedor de pagamento, regras comerciais, consentimento | Não ativar cobrança sem os três |
| 3.8 | Serviço central: destinatários, preferências, canais, logs, deduplicação, reprocessamento | ⛔ | Notificações derivadas no snapshot, sem fila nem log | — | Banco relacional + worker | Evento gera 1 entrega por canal (chave de idempotência); falha reprocessável |

## Módulo 04 — Logo Etnias.site e menu

| ID | Requisito | Estado | Evidência no código | Teste | Dependência | Critério de aceite |
|---|---|---|---|---|---|---|
| 4.1 | Trocar o ícone Opy pela logo oficial, à direita, clicável, abrindo o menu | 🟡 | Logo oficial existe (`assets/opy/etnias-logo.png`, usada em `/entrar/`). No cabeçalho, o gatilho é um botão de texto “Opy” (`header.php`). | A* (`navigation.php` 18/18, sessão anterior) | Confirmar a posição “direita” num layout de 375 px | Logo à direita abre o menu; `aria-expanded` correto; foco volta ao gatilho |
| 4.2 | Menu por categorias, abrir/fechar, desktop/mobile, gestão pelo admin, permissões | 🟡 | Drawer `#opy-menu` com `<dialog>`, permissões no `sidebar.php`. Categorias fixas no código, sem admin. | A* (`navigation.php`) | Painel admin | Admin oculta um item e ele some para quem não tem permissão |

## Módulo 05 — Stories

| ID | Requisito | Estado | Evidência no código | Teste | Dependência | Critério de aceite |
|---|---|---|---|---|---|---|
| 5.1 | Formato atual mais compacto; ocultar na rolagem; reaparecer no topo | 🟡 | Cards `.story-card` (`preview.js:563`). Não há ocultação por rolagem. | — | — | Rolar 1 card para baixo oculta os Stories sem salto de layout (CLS < 0,05); voltar ao topo reexibe |
| 5.2 | Mobile: sem barra de navegação, gestos, avanço automático, pausar/retomar | 🟡 | Swipe, segurar para pausar, autoavanço com `requestAnimationFrame`, barra de progresso (`preview.js:714-808`) | A* (`stories-browser.cjs`) | — | Validar em dispositivo real; a barra de progresso é indicador, não navegação |
| 5.3 | Interações: curtir, comentar, compartilhar, contagem, respostas, notificar autor | ⛔ | `story_create`/`story_delete` apenas | — | — | Curtida persiste e notifica o autor |
| 5.4 | Privacidade: quem comenta/compartilha/vê, lista de bloqueio, padrão ou por Story | ⛔ | Story sem campo de público | — | — | Pessoa na lista de exclusão recebe 404 no Story e na mídia |
| 5.5 | Público: público, seguidores, personalizado, restrito | ⛔ | — | — | 5.4 | Idem, aplicado no servidor e em `/api/media` |
| 5.6 | Notificações de Story | ⛔ | — | — | 5.3, 3.8 | — |

## Módulo 06 — Feed, publicações, filtros e transmissões

| ID | Requisito | Estado | Evidência no código | Teste | Dependência | Critério de aceite |
|---|---|---|---|---|---|---|
| 6.1 | Barra de modalidades após ocultar Stories, sem recarregar | 🟡 | Barra `data-feed-view` com filtragem no cliente (`preview.js:580-587`). Não está ligada à rolagem. | M (código) | 5.1 | A barra fica fixa (sticky) quando os Stories saem; troca sem recarregar |
| 6.2 | Seguindo | 🟡 | O filtro “Amigos” mistura seguir e amizade (`p.following || friendStatus==='friends'`) | — | — | Filtro “Seguindo” mostra só autores seguidos |
| 6.3 | Descobrir pessoas | ⛔ | — | — | Regra de distribuição para novos integrantes | Só autores não seguidos; botão Seguir no post; rodízio que não depende só de popularidade |
| 6.4 | Microblog: textos curtos, respostas encadeadas | ⛔ | Comentários planos, sem encadeamento | — | 6.12 (respostas) | Post curto com respostas em thread |
| 6.5 | Arquivos: só posts com anexo, tipo, visualizar/baixar, PDF/DOC/DOCX/planilhas | 🟡 | Filtro “Documentos”; PDF/TXT/DOC/DOCX até 2 MB, validados por assinatura (`pdfAt`, `mediaInput`). Sem planilhas. | A* (`uploads.cjs`) | — | Adicionar XLSX/ODS/CSV com validação de assinatura |
| 6.6 | Áudios: tocar no feed, pausar, duração, interações | 🟡 | Filtro “Áudios”; player nativo | — | — | Só um áudio toca por vez; a duração aparece |
| 6.7 | Localidade: filtrar, buscar regiões, entrada manual, sem localização exata | 🟡 | Campo de localização em texto livre na publicação (`community.mjs:314`). Sem filtro. | — | Decisão sobre privacidade territorial | Filtro por texto de região; nenhuma coordenada é gravada |
| 6.8 | Transmissões ao vivo | 🔒 | Só o estúdio local de teste de câmera (“FORA DO AR”), sem transmissão falsa | — | Servidor de mídia (WHIP/LL-HLS), custo, moderação | Um 2º usuário assiste à transmissão real |
| 6.9 | Comportamento dos filtros (estado ativo, desktop/mobile, privacidade, voltar, rolagem horizontal) | 🟡 | `aria-pressed` no filtro ativo; privacidade aplicada no snapshot do servidor (`visible()`) | — | 6.2–6.7 | Rolagem horizontal em 320 px sem overflow da página |
| 6.10 | Vídeos verticais (Reels) | ⛔ | — | — | Transcodificação/streaming progressivo | Ver critérios em `ETNIAS_UX_ARCHITECTURE.md` §5 |
| 6.11 | Criação pelo botão central e pelo balão do feed, mesmo fluxo | 🟡 | O Composer com 6 abas está no feed. O botão central “Postagem” só foca o textarea (`DESIGN.md` §Composer). | — | — | Os dois caminhos abrem o mesmo painel, já com as abas |
| 6.12 | Comentários: curtir, responder, compartilhar, emojis, contagens | ⛔ | Comentário = `{author, text, createdAt}` (`community.mjs:423`) | — | — | Curtida e resposta persistem e são autorizadas no servidor |
| 6.13 | Emojis e figurinhas como bibliotecas distintas, geridas pelo admin, validadas no back-end | ⛔ | Lista fixa de 8 emojis no cliente (`preview.js:7`). Sem figurinhas. | — | Painel admin + acervo de figurinhas com licença | O servidor rejeita figurinha desativada |

## Requisitos complementares (fora dos 47)

IDs próprios, para não alterar a contagem oficial.

| ID | Requisito | Estado | Evidência |
|---|---|---|---|
| CX-COM-01 | Descobrir e buscar comunidades | ✅ | `communities.mjs`, `tests/opy/communities.mjs` (A) |
| CX-COM-02 | Página da comunidade com regras, papéis e feed próprio | 🟡 | Sem capa/imagem |
| CX-COM-03 | Entrada por solicitação, aprovação e convite | ✅ | Teste “criação de comunidade privada…” (A) |
| CX-COM-04 | Moderação e denúncia | 🟡 | Denúncia gravada; falta a fila humana |
| CX-COM-05 | Visibilidade para conhecimento tradicional restrito | ⛔ | Só público/privado; requer definição com as comunidades |
| CX-NAV-02 | Coluna lateral com comunidades por tema em vez de lista de pessoas | ✅ | `paintCommunity()` em `preview/preview.js` |
| CX-NAV-01 | Barra inferior com Criar central | 🟡 | Hoje: Feed, Mercado, Postagem, Saberes, EtnIA. Comunidades, Inbox e Maracá ficam fora da barra |
| CX-DS-01 | Design system azul premium com tokens centralizados | ⛔ | Proposta em `ETNIAS_DESIGN_SYSTEM.md` |
| CX-QA-01 | Textos de ajuda coerentes com o comportamento real | ✅ (corrigido nesta sessão) | D1/D2 em `ETNIAS_AUDIT.md` |
| CX-QA-02 | Remover a sala pública oculta (D4) | ✅ | Ação `message` rejeitada (400) e `messages` fora do snapshot; dados antigos preservados em `state.messages`; código morto removido de `preview.js`; `tests/opy/live-api.cjs` atualizado |
| CX-CALL-01 | Chamadas de voz e vídeo 1:1 (WebRTC + TURN próprio) | ✅ | `preview/server/calls.mjs`, `preview/calls.js`; 5 testes unitários (`tests/opy/calls.mjs`) + E2E com 2 navegadores e mídia real (`tests/opy/calls-browser.cjs`), inclusive contra o container da VPS |
| CX-CALL-02 | Chamadas em grupo | ⛔ | Depende de SFU (LiveKit self-hosted); a UI informa que ainda não existe |
| CX-CHAT-UI | Chat no estilo da referência com as cores Opy | ✅ | `preview/chat.php`, `preview/chat.js`, `preview/preview.css`; E2E `chat-browser.cjs` e revisão visual em 375 px e 1280 px |
