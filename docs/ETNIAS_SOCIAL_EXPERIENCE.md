# Etnias — Social Experience Excellence (ciclo de 2026-11-08)

Missão: elevar a fluidez e a previsibilidade da Casa Opy sem tocar no design (cores, tipografia, componentes e estrutura congelados). Tudo aqui é comportamento, desempenho e validação. Referência de método: auditoria de caminhos de clique + jornadas reais em Playwright com emulação de celular (390×844, toque) e rede lenta (perfil Slow 4G do Chrome: 1,6 Mbps, 150 ms, CPU 4×). Complementa `ETNIAS_UX_AUDIT.md` e `ETNIAS_QA_REPORT.md`.

## Linha de base × resultado (celular, Slow 4G, CPU 4×, cache frio) — `tests/opy/vitals.cjs`

| Tela | LCP antes | LCP depois | CLS antes | CLS depois | Transferido antes | depois | Toque |
|---|---|---|---|---|---|---|---|
| / (feed) | 9,9 s | 1,9 s | 0,364 | 0 | 2.263 KB | 509 KB | 88 ms |
| /chat/ | 5,6 s | 0,7 s | 0,004 | 0 | 1.854 KB | 66 KB | 32 ms |
| /grupos/ | 9,6 s | 0,8 s | 0,004 | 0 | 1.820 KB | 54 KB | 40 ms |
| /notificacoes/ | — | 0,2 s | 0 | 0 | 29 KB | 59 KB | — |
| /conta/ | 9,9 s | 1,0 s | 0,004 | 0 | 1.820 KB | 55 KB | 16 ms |

Metas (INP ≤ 200 ms, LCP ≤ 2,5 s, CLS ≤ 0,1) atendidas em todas as telas medidas. Zero erros de console.

O que mudou para chegar aí (sem alterar nada visual):
- Assets com versão na URL agora têm `Cache-Control: immutable` (antes nenhum cabeçalho: cada página baixava 1,8 MB de novo).
- Respostas de texto (JSON da API, JS, CSS, HTML) saem com gzip do próprio servidor Node (o snapshot do feed caiu de 253 KB para 55 KB).
- Os 30 ícones do menu foram recomprimidos (mesma arte, mesmos 177 px): 1.187 KB → 306 KB; e carregam de forma preguiçosa (no celular ficam dentro do menu fechado).
- Fontes com `font-display: swap`; fileira de stories com altura reservada; cartão "Boas-vindas" passou a ser o primeiro cartão do feed (antes empurrava compositor e feed quando os dados chegavam: 0,36 de CLS).
- O snapshot da API é pré-carregado no `<head>` (`<link rel="preload" as="fetch">`), paralelo ao JS.
- Vídeos do feed só carregam metadados quando se aproximam da tela.

## Auditoria de caminhos de clique (30 achados confirmados, todos corrigidos)

Feed: redesenho só quando algo mudou e, quando só uma publicação muda, troca só aquele cartão (áudio/vídeo não param mais a cada 20 s; menus, "Ver mais" e seletor de emoji não fecham sozinhos); ação não é sobrescrita por atualização em voo; curtir, reagir e salvar são otimistas com reversão em erro; anexo escolhido em outra aba vai junto ao publicar; seguir atualiza todos os cartões e o perfil; excluir/repostar não perdem a paginação; responder a comentário limpa o chip; live não cria publicação fantasma sem câmera e tenta encerrar de novo em falha de rede; compositor não colapsa durante a live.

Chat: não congela mais depois de enviar rápido ou de abrir o histórico; lista reconstruída só quando muda; Enter respeita envio pendente; contador do cabeçalho acompanha a leitura; sair do grupo volta à lista; busca na conversa é imediata.

Centro de gestão: não recarrega enquanto se digita; rascunhos de tradução sobrevivem; busca de pessoas mantida após ação; erro de rede não rebaixa para tradutor; hash inválido cai em Visão geral.

## Stories (padrão Instagram, sem a aparência do Instagram)

Barra só anda com a mídia pronta (indicador de carregamento até lá); vídeo guia a barra pelo tempo real e pausa em buffering; toque à direita/esquerda avança/volta; segurar pausa (com captura do ponteiro: soltar fora também retoma); deslizar para baixo fecha; deslizar para o lado troca de autor; pré-carrega o próximo story; pausa quando a aba perde o foco; toque no nome abre o perfil; reações rápidas e resposta pelo chat; autor vê "Visto por N"; atualização periódica da página espera enquanto o visualizador está aberto.

## Mobile e navegação

- Voltar de um perfil ou publicação restaura as mesmas publicações e a publicação que estava no topo da tela (sessionStorage + âncora por cartão; realinha enquanto as mídias ganham altura).
- `interactive-widget=resizes-content`: o teclado encolhe a janela em vez de cobrir campos e barras fixas.
- Compartilhamento nativo (`navigator.share`) no painel de repost, quando o aparelho oferece.

## Jornadas validadas — `tests/opy/journeys-mobile.cjs` (12/12)

1. Abrir o feed e ver um story · 2. Pausar, avançar, voltar, reagir e fechar · 3. Curtir (imediato) e comentar sem mover a tela · 4. Perfil pelo feed, seguir e voltar à mesma publicação · 5. Encontrar comunidade e participar · 6. Conversa: digitar e enviar · 7. Rascunho de comentário sobrevive à atualização · 8. Trocar filtro e voltar · 9. Rede lenta: primeira publicação em menos de 8 s · 10. Toques duplos rápidos coerentes com o servidor · 11. Campo de comentário visível com janela reduzida (teclado) · 12. Estados vazios e permissão (403 no painel para conta comum).

Também: `node --test tests/opy/*.mjs` (48), `tests/opy/community-integration.mjs`, `tests/opy/live-browser.cjs`, `tests/opy/audit-screens.cjs` (87 telas: 0 estouros, 0 falhas sérias de acessibilidade, 0 alvos < 44 px).

## Etapas por jornada (antes → depois)

| Jornada | Antes | Depois |
|---|---|---|
| Ver um story de alguém | 1 toque, mas barra corria antes da mídia e sem interação | 1 toque; reagir = +1 toque; responder = digitar e enviar |
| Voltar do perfil ao feed | voltar + rolar até achar o ponto (perdia a posição) | voltar (posição restaurada) |
| Curtir | toque + espera do servidor para ver o resultado | toque (resultado imediato) |
| Começar uma conversa com alguém que já conheço | lápis + digitar nome + escolher (3) | tocar na pessoa em "Pessoas" (1) |
| Abrir mensagens recentes no desktop | ir para /chat/ (1 navegação) | painel no ícone (0 navegações) |

## Fora deste ciclo (registrado, não feito)

- Indicador de "online" no chat (não há serviço de presença).
- Notificações em tempo real por WebSocket (hoje atualização periódica: 20 s no feed, 4 s no chat).
- Rascunho do compositor principal persistido entre navegações.
- Testes em aparelhos reais (Android/iOS): tudo acima foi emulação; teclado virtual real e orientação só se validam no aparelho.
- Duas pendências pequenas de ARIA em botões de comentário.
