# Casa Opy — Fase 4: transmissão ao vivo (Live)

Decisão de 2026-11-08 (Claude, com autonomia delegada; o usuário aprovou "pode resolver tudo" depois da recomendação). Hoje o botão "Ao vivo" do compositor é um aviso honesto: não existe servidor de vídeo. Esta fase coloca a live para funcionar do celular, sem app externo e sem custo mensal.

## Objetivo

Quem tem conta inicia uma live pelo navegador (câmera e microfone do próprio aparelho), ela aparece no feed com o selo "AO VIVO" para quem segue (com aviso no aparelho quando a pessoa ativou o push), qualquer pessoa com conta assiste no próprio feed, e ao terminar a live vira uma publicação de vídeo com a gravação.

Não-objetivos: milhares de espectadores simultâneos (exige CDN paga), chat ao vivo, transmissão por OBS/RTMP (a live é do celular), contagem de espectadores.

## Caminhos considerados

1. **MediaMTX na própria VPS** (escolhido): servidor de mídia em Go, uma imagem Docker, publicação WHIP e leitura WHEP (WebRTC puro, nativo em Chrome, Safari e Firefox, sem biblioteca no cliente), gravação em fMP4 no disco. Sem custo. Cabe na VPS (4 CPU, 16 GB): o servidor não recodifica, só repassa pacotes. Limite honesto: dezenas de pessoas assistindo ao mesmo tempo.
2. Cloudflare Stream / Mux: escala sem esforço, mas é plano pago e dado de vídeo fora da VPS. Fica como upgrade se a audiência crescer (a troca é só a URL de publicação e o player).
3. Gravar no aparelho e subir o vídeo depois ("pseudo-live"): já existe ("Vídeo" e "Story"); não é live.

## Como fica

Infra (`deploy/opy/compose.yaml` + `deploy/opy/mediamtx.yml`):
- Serviço `live` (`bluenviron/mediamtx:1.21.3`) só com WebRTC ligado (RTSP/RTMP/HLS/SRT/API desligados). Porta pública 8189 UDP+TCP para a mídia; `MTX_WEBRTCADDITIONALHOSTS=${OPY_PUBLIC_IP}` (já está no `.env` para o coturn).
- Autenticação delegada ao app: `authHTTPAddress: http://opy:8101/api/live/auth`. Publicar exige a chave da live; assistir exige só que a live exista e esteja ativa.
- Gravação em `/recordings/<postId>/<data>.mp4` num volume compartilhado com o app (somente leitura no app).

Servidor (`preview/server/live.mjs`, `community.mjs`, `scripts/opy-preview-server.mjs`):
- Ações `live_start` (cria a publicação com `live: { key, startedAt }`, uma live ativa por pessoa, avisa seguidores por push) e `live_stop` (encerra e anexa a gravação como `media` de vídeo).
- Lives sem encerramento (aparelho desligou) são encerradas automaticamente após 6 h.
- `/api/live/auth`: webhook do MediaMTX (recusa pedidos que vieram pelo Caddy; só a rede interna do Docker chega sem `X-Forwarded-For`).
- `/live/<postId>/whip|whep…`: o app faz proxy da sinalização para o MediaMTX, com sessão obrigatória. Assim nada muda no Caddy e local e produção usam o mesmo caminho. `/live/recordings/<postId>/<arquivo>.mp4`: serve a gravação com sessão e Range.

Cliente (`preview/preview.js`, `preview/page.php`, `preview/preview.css`):
- Painel "Ao vivo" do compositor: prévia da câmera, "Iniciar live", "Encerrar live". Publicação por WHIP com H.264 preferido (é o que o MP4 grava e o iPhone toca).
- Card no feed: selo "AO VIVO" e botão "Assistir" que abre um visualizador (WHEP). Ao terminar: vídeo normal com rótulo "Gravação da live".
- Ao fechar a página durante a live, o navegador avisa o servidor (`fetch` com `keepalive`).

Testes: `tests/opy/live.mjs` (regras do módulo), `tests/opy/live-browser.cjs` (duas pessoas, câmera falsa do Chromium, uma transmite e a outra assiste e vê a gravação), atualização de `tests/opy/chat-browser.cjs` que esperava o aviso antigo.

## Riscos aceitos

- Navegador sem H.264 (Firefox sem OpenH264) publica VP8 e a gravação não é gerada; a live ao vivo funciona.
- Áudio Opus dentro de MP4 pode não tocar em iPhones antigos (iOS < 17) na gravação; a live ao vivo não é afetada. Se incomodar, recodificar com ffmpeg ao encerrar (imagem `-ffmpeg` do MediaMTX).
- Rede corporativa que bloqueia UDP: o cliente cai para TCP 8189; se também bloqueado, a live não conecta.

## Live Experience (2026-11-08, segunda etapa)

Missão colada pelo usuário: formatos, interação em tempo real, convidados, notificações, descoberta. Tudo sem infraestrutura nova.

**Arquitetura dos convidados (decisão).** O MediaMTX entrega um para muitos, mas não mistura participantes. Em vez de um SFU novo (LiveKit) mais um serviço de composição (Egress com Chrome headless, pesado para a VPS), o navegador do anfitrião faz a composição: recebe o convidado por WebRTC direto (1:1, baixa latência, TURN próprio já existente), desenha os dois num canvas (9:16 em cima/embaixo, 16:9 lado a lado), mistura o áudio pela Web Audio e publica o quadro único por WHIP. Espectadores seguem por WHEP, com a gravação intacta. Trade-offs: CPU e upload do aparelho do anfitrião (720p a 24 fps + receber o convidado); 1 convidado funcional agora.

**Extensão para 3 e 4 participantes.** O servidor já modela `post.live.guest` como um slot; para N convidados vira `post.live.guests[]` (cada um com chave, sinal e estado de mídia) e o anfitrião abre uma conexão WebRTC por convidado (estrela com centro no anfitrião). A composição no canvas ganha as grades (3: um grande + dois pequenos; 4: 2×2). Limite prático na estrela do anfitrião: 4 participantes em celular médio; acima disso o caminho é um SFU. Não anunciado até ser implementado e validado.

**Tempo real.** Bate-papo, reações, audiência, convites e sinalização usam a visão `?view=live` a cada 2 s (incremental por `since`), sem WebSocket. Batimento de audiência a cada 15 s (contagem = batimentos dos últimos 30 s). Reações rápidas em janela de 60 s; mensagens repetidas em 5 s e reações em 0,7 s são ignoradas no servidor. Respostas das ações frequentes são leves (sem snapshot).

**Segurança da participação.** Convite expira em 2 min; só quem aceita um convite válido recebe a chave de participação; sem a chave nenhum sinal WebRTC é aceito; só o anfitrião envia a oferta, só o convidado a resposta; publicar no MediaMTX continua exigindo a chave da live. Fila de pedidos limitada (20) e convites pendentes (5).

**Validação.** `tests/opy/live.mjs` (regras), `tests/opy/live-browser.cjs` (transmitir, assistir, gravar) e `tests/opy/live-journeys.cjs` (20 cenários da missão com três navegadores e câmera falsa; não automatizados: queda de conexão e push no aparelho).
