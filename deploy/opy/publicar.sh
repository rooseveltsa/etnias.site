#!/usr/bin/env bash
# Publica a Casa Opy na VPS: gera as páginas, envia os arquivos (sem --delete) e sobe os containers.
# Uso, na raiz do repositório:  bash deploy/opy/publicar.sh
# Não lê nem envia segredos: o .env fica só na VPS.
set -euo pipefail
cd "$(dirname "$0")/../.."
HOST="${OPY_VPS:-root@179.66.136.125}"
KEY="${OPY_SSH_KEY:-$HOME/.ssh/casa_opy_deploy}"
# Assinantes do Etnias 1.0: regenerados quando o banco recuperado está rodando neste computador (só leitura).
if docker ps --format "{{.Names}}" | grep -q "^etnias-recovery-db-1$"; then bash scripts/opy-legacy-plans.sh; python3 -I scripts/opy-legacy-areas.py; fi
echo "1/3 Gerando as páginas…"
docker run --rm -v "$PWD":/app -w /app php:8.2-cli php scripts/export-opy-preview.php
echo "2/3 Enviando para $HOST…"
rsync -az -e "ssh -i $KEY" --relative preview/package.json preview/package-lock.json preview/server preview/middleware.js preview/public-posts.json preview/i18n preview/dist/public scripts/opy-preview-server.mjs scripts/opy-import-legacy.mjs deploy/opy/Dockerfile deploy/opy/Dockerfile.dockerignore deploy/opy/compose.yaml deploy/opy/compose.vps-caddy.yaml deploy/opy/mediamtx.yml "$HOST:/srv/casa-opy/"
# Fotos das áreas do OPY (Blogs, Mercado, Eventos…): só acrescenta arquivos que faltam na VPS, nunca apaga.
if [ -s preview/legacy/areas-media-manifest.txt ]; then rsync -a --partial -e "ssh -i $KEY" --files-from=preview/legacy/areas-media-manifest.txt public_html/ "$HOST:/srv/casa-opy/legacy-media/"; fi
echo "3/3 Subindo os containers…"
ssh -i "$KEY" "$HOST" 'cd /srv/casa-opy/deploy/opy && docker compose -f compose.yaml -f compose.vps-caddy.yaml --env-file .env up -d --build && docker ps --format "{{.Names}} {{.Status}}" | grep casa-opy'
echo "Pronto. Confira https://etnias.site/"
