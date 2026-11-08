# Casa Opy na VPS Hostinger

Sobe a Casa Opy (app Node com dados em disco) e o coturn (TURN/STUN para as chamadas) em Docker. Não toca no banco recuperado nem no domínio etnias.site sem decisão explícita (`AGENTS.md`).

Validado localmente em 2026-11-07: imagem construída, container servindo com CSP, E2E de chat e de chamadas (`tests/opy/chat-browser.cjs`, `tests/opy/calls-browser.cjs`) passando contra o container, coturn lendo `turnserver.conf`. Publicado na VPS no mesmo dia; ver a seção abaixo.

## Instalação atual (2026-11-07)

- **Endereço:** https://opy.179-66-136-125.sslip.io (nome automático que aponta para o IP; trocar quando houver subdomínio próprio).
- **VPS:** `srv2135798.hstgr.cloud` (179.66.136.125), Ubuntu 26.04, Docker 29. O sistema antigo continua em `/srv/etnias` (Caddy + WoWonder + MariaDB) e responde em https://srv2135798.hstgr.cloud.
- **Casa Opy:** `/srv/casa-opy`, subida com `docker compose -f compose.yaml -f compose.vps-caddy.yaml --env-file .env up -d --build` em `deploy/opy`. O `.env` foi gerado na própria VPS (permissão 600) e não sai de lá.
- **HTTPS:** bloco `opy.179-66-136-125.sslip.io` acrescentado a `/srv/etnias/deploy/Caddyfile` (cópia anterior em `Caddyfile.bak-20261107-201940`), apontando para `casa-opy-opy-1:8101` pela rede `etnias_frontend`.
- **TURN:** coturn em rede do host, 3478 UDP/TCP e 49160–49260 UDP, sem TLS. Testado com `turnutils_uclient` (12 pacotes retransmitidos, 0 perdidos).
- **Acesso:** chave `~/.ssh/casa_opy_deploy` (comentário `casa-opy-deploy`) em `/root/.ssh/authorized_keys`. Para revogar: `sed -i '/casa-opy-deploy/d' /root/.ssh/authorized_keys`.
- **Atualizar** (da raiz do repositório, depois de exportar as páginas). Sempre envie a lista completa e **sem `--delete`**, senão arquivos irmãos de `preview/` somem no servidor:
- **Atalho:** `bash deploy/opy/publicar.sh` faz os três passos abaixo (gerar páginas, enviar, subir) e mostra os containers no fim.
  ```bash
  rsync -az -e "ssh -i ~/.ssh/casa_opy_deploy" --relative preview/package.json preview/package-lock.json preview/server preview/middleware.js preview/public-posts.json preview/i18n preview/dist/public scripts/opy-preview-server.mjs scripts/opy-import-legacy.mjs deploy/opy/Dockerfile deploy/opy/Dockerfile.dockerignore deploy/opy/compose.yaml deploy/opy/compose.vps-caddy.yaml deploy/opy/mediamtx.yml root@179.66.136.125:/srv/casa-opy/
  ssh -i ~/.ssh/casa_opy_deploy root@179.66.136.125 'cd /srv/casa-opy/deploy/opy && docker compose -f compose.yaml -f compose.vps-caddy.yaml --env-file .env up -d --build'
  ```
  (Sem o nome do serviço no `up`, para que o servidor de live `live` também suba; o TURN não é recriado se nada mudou.)
- **Live (Fase 4, `plans/casa-opy-fase4-live.md`):** serviço `live` (MediaMTX, `mediamtx.yml`) só com WebRTC. O navegador publica por WHIP e assiste por WHEP pelo próprio app (`/live/<postId>/whip|whep`, com sessão); a mídia vai direto ao MediaMTX pela porta **8189 UDP e TCP**, que precisa estar aberta no firewall da VPS (painel Hostinger e `ufw`, se ativo). `MTX_WEBRTCADDITIONALHOSTS` vem de `OPY_PUBLIC_IP` do `.env` (já usado pelo TURN). Gravações em fMP4 no volume `live-recordings` (`/recordings/<postId>/`), servidas em `/live/recordings/*` e nunca apagadas automaticamente; publicação apagada não apaga o arquivo (limpar à mão se precisar).
- **Desfazer:** restaurar o `Caddyfile.bak-*`, rodar `docker exec etnias-caddy-1 caddy reload --config /etc/caddy/Caddyfile` e `docker compose ... down` em `/srv/casa-opy/deploy/opy`.

## Legado do Etnias dentro da Casa Opy (2026-11-08, plano `plans/casa-opy-rede-viva.md`)
- **Mídia:** `public_html/upload` (só o que o banco referencia e existe no disco, lista gerada por `scripts/import-legacy.py` em `preview/legacy/media-manifest.txt`) vai por `rsync -a --partial --files-from=<manifesto> public_html/ root@…:/srv/casa-opy/legacy-media/`. O container monta essa pasta em `/legacy-media` (só leitura) e serve em `/legado/*` para quem tem sessão.
- **Dados:** `python3 scripts/import-legacy.py` (banco recuperado local) gera `preview/legacy/legacy-import.json`; copie-o para a VPS (`/srv/casa-opy/legacy-import.json`) e mescle **com o app parado**, dentro do container, que faz backup do `community.json` antes de gravar:
  ```bash
  ssh -i ~/.ssh/casa_opy_deploy root@179.66.136.125 'cd /srv/casa-opy/deploy/opy && docker compose -f compose.yaml -f compose.vps-caddy.yaml --env-file .env stop opy && docker compose -f compose.yaml -f compose.vps-caddy.yaml --env-file .env run --rm -v /srv/casa-opy/legacy-import.json:/import.json:ro opy node scripts/opy-import-legacy.mjs --state /data --input /import.json && docker compose -f compose.yaml -f compose.vps-caddy.yaml --env-file .env up -d opy'
  ```
  A mesclagem é idempotente (ids derivados do `legacyId`); rodar de novo não duplica nada. Conta antiga cujo @ já existe na Casa Opy é relatada como conflito e fica de fora; se o responsável confirmar que é a mesma pessoa, acrescente `--link user1,user2` e a conta nova herda o conteúdo antigo (senha e foto novas mantidas). Contas antigas entram com a senha original (bcrypt) e são migradas para scrypt na primeira entrada.
- **Derivados leves (Fase 3):** `scripts/opy-legacy-derivados.sh` gera no Mac miniaturas (fotos acima de 300 KB → máx. 1280 px) e recodifica vídeos acima de 20 MB em `preview/legacy/derivados/`. Enviar com `rsync -a --partial preview/legacy/derivados/thumbs/ root@…:/srv/casa-opy/legacy-media/thumbs/` (servidas em `/legado/thumbs/*`, com o original como reserva) e `rsync -a --partial preview/legacy/derivados/videos/ root@…:/srv/casa-opy/legacy-media/` (substituem a cópia da VPS; os originais ficam só no Mac).
- **Senha esquecida (sem e-mail):** no Centro de gestão → Pessoas → "Nova senha", a administração gera uma senha provisória, registra o motivo e passa à pessoa pelo canal em que ela pediu (WhatsApp, ligação). A pessoa é obrigada a criar uma senha nova na primeira entrada.
- **Avisos no aparelho (Web Push):** gere as chaves uma vez com `cd preview && npx web-push generate-vapid-keys` e grave no `.env` da VPS `OPY_VAPID_PUBLIC_KEY=…`, `OPY_VAPID_PRIVATE_KEY=…` e `OPY_VAPID_SUBJECT=https://etnias.site`; sem as chaves o recurso fica oculto. Trocar as chaves invalida todas as inscrições (as pessoas precisam ativar de novo).

## Backup e reserva na Vercel (2026-11-07)

**Arquitetura:** produção na VPS; backup diário criptografado no Blob privado da Vercel; o app da Vercel (casa-opy-preview.vercel.app) serve de reserva de emergência, porque lê o mesmo formato de dados.

- **Quando:** todo dia às 03:30 de Brasília (`/etc/cron.d/casa-opy-backup`), log em `/var/log/casa-opy-backup.log`.
- **O quê:** volume `casa-opy_opy-data` inteiro (contas, publicações, mensagens, fotos e anexos), compactado e criptografado com AES-256 (`openssl enc -aes-256-cbc -pbkdf2 -iter 200000`).
- **Onde:** `backups/casa-opy/opy-AAAA-MM-DD.tgz.enc` no Blob da Vercel (14 dias) e `/var/backups/casa-opy` na VPS (7 dias).
- **Chaves (só root, permissão 600):** `/root/.casa-opy/backup.key` (criptografia) e `/root/.casa-opy/blob.env` (acesso ao Blob). Há uma cópia da chave de criptografia nas Senhas do Mac do responsável, no item **“Casa Opy - chave do backup”**. Sem ela os backups não abrem.
- **Testado em 2026-11-07:** backup enviado; restauração num local de teste do Blob com `community.json` idêntico byte a byte ao da VPS; anexo sintético restaurado idêntico; local de teste apagado.
- **Snapshot da máquina:** criado pela API da Hostinger em 2026-11-07 (a VPS não tinha backup nem snapshot). Recomendado ativar backups automáticos no hPanel.

### Emergência: VPS fora do ar
1. Restaurar o backup mais recente na Vercel (de qualquer máquina com a chave e o acesso ao Blob, ou da própria VPS se ainda responder):
   ```bash
   /srv/casa-opy/deploy/opy/backup/restore-to-vercel.sh            # último backup, no prefixo opy-v2 da prévia
   /srv/casa-opy/deploy/opy/backup/restore-to-vercel.sh 2026-11-07 # um dia específico
   ```
2. No painel da Vercel, adicionar `opy.etnias.site` ao projeto `casa-opy-preview` e trocar o registro DNS `opy` para o CNAME indicado pela Vercel.
3. Limitação no modo reserva: sem o TURN da VPS, chamadas entre redes móveis podem falhar.

**Atenção:** restaurar no prefixo `opy-v2` substitui os dados atuais da prévia na Vercel. Para testar, use um prefixo de teste: `restore-to-vercel.sh "" restore-test/opy-v2` e depois apague com `blob.mjs remove restore-test/`.

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
