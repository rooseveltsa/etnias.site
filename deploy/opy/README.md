# Casa Opy na VPS Hostinger

Sobe a Casa Opy (app Node com dados em disco) e o coturn (TURN/STUN para as chamadas) em Docker. Não toca no banco recuperado nem no domínio etnias.site sem decisão explícita (`AGENTS.md`).

Validado localmente em 2026-11-07: imagem construída, container servindo com CSP, E2E de chat e de chamadas (`tests/opy/chat-browser.cjs`, `tests/opy/calls-browser.cjs`) passando contra o container, coturn lendo `turnserver.conf`. **Nada foi publicado na VPS.**

## Pré-requisitos

- Docker com o plugin compose na VPS.
- Dois nomes DNS apontando para o IP da VPS: um para o app (ex.: `opy.seudominio`) e um para o TURN (ex.: `turn.seudominio`).
- Certificados Let's Encrypt para os dois (certbot). Navegadores só liberam câmera e microfone em HTTPS.
- Firewall da VPS (painel Hostinger + `ufw`): 80/443 TCP, 3478 TCP+UDP, 5349 TCP, 49160–49260 UDP.

## Passos

1. Na sua máquina, gere as páginas e envie o repositório para a VPS (git pull ou rsync, **sem** `public_html/upload`, `deploy/.env` ou dumps):
   ```bash
   docker run --rm -v "$PWD":/app -w /app php:8.2-cli php scripts/export-opy-preview.php
   ```
2. Na VPS: `cp deploy/opy/.env.example deploy/opy/.env`, preencha os valores e gere os segredos com `openssl rand -hex 32`. Ajuste o caminho `cert`/`pkey` em `turnserver.conf` para o certificado do subdomínio do TURN.
3. Suba:
   ```bash
   docker compose -f deploy/opy/compose.yaml --env-file deploy/opy/.env up -d --build
   ```
4. Proxy HTTPS do host para `127.0.0.1:8101` (nginx):
   ```nginx
   server {
     listen 443 ssl http2;
     server_name opy.seudominio;
     ssl_certificate     /etc/letsencrypt/live/opy.seudominio/fullchain.pem;
     ssl_certificate_key /etc/letsencrypt/live/opy.seudominio/privkey.pem;
     client_max_body_size 5m;
     location / {
       proxy_pass http://127.0.0.1:8101;
       proxy_set_header Host $host;
       proxy_set_header X-Forwarded-Proto https;
     }
   }
   ```
   O app confere o cabeçalho `Origin` contra o `Host` em todo POST: mantenha `proxy_set_header Host $host`.
5. Teste: crie duas contas em aparelhos de redes diferentes (ex.: Wi-Fi e 4G), troquem uma mensagem em cada sentido e façam uma chamada de vídeo. Em `chrome://webrtc-internals`, o par de candidatos `relay` confirma que o TURN está sendo usado quando preciso.

## Dados e backup

- Tudo fica no volume `casa-opy_opy-data` (`/data/community.json`, sessão e mídia).
- Backup diário: `docker run --rm -v casa-opy_opy-data:/d -v "$PWD":/b alpine tar czf /b/opy-$(date +%F).tgz -C /d .`
- Restaurar exige parar o container `opy` antes de extrair no volume.

## Limites conhecidos

- **Armazenamento em JSON único:** serve para a homologação e para os primeiros grupos de uso. Antes de abrir ao público, migrar para MariaDB/PostgreSQL (`docs/ETNIAS_IMPLEMENTATION_PLAN.md`).
- **Chamadas 1:1:** chamadas em grupo precisam de um SFU (LiveKit self-hosted é a próxima etapa).
- **Tempo real por consulta periódica:** a chamada toca em até ~3 s com a aba aberta e até ~8 s em segundo plano. Com o app fechado não há toque: isso depende de Web Push (Fase 6).
- **Navegar para outra página encerra a chamada** (o site não é SPA). O navegador avisa antes de sair durante uma chamada ativa.
- **Banda:** chamadas que passam pelo TURN consomem banda da VPS (~50 kbps de áudio, ~0,5–1,5 Mbps de vídeo por chamada). `total-quota=300` limita as sessões simultâneas.
