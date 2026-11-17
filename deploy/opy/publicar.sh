#!/usr/bin/env bash
# Publica a Casa Opy na VPS: testes, páginas, cópia de segurança do que vai ser trocado, envio (sem --delete), containers,
# teste de fumaça (somente leitura) e volta automática se o app novo não responder.
# Uso, na raiz do repositório:  bash deploy/opy/publicar.sh
# Não lê nem envia segredos: o .env fica só na VPS.
#   OPY_DEPLOY_ALLOW_DIRTY=1  publica mesmo com alterações não salvas no git (não recomendado)
#   OPY_SKIP_TESTS=1          pula os testes automáticos locais
set -euo pipefail
cd "$(dirname "$0")/../.."
HOST="${OPY_VPS:-root@179.66.136.125}"
KEY="${OPY_SSH_KEY:-$HOME/.ssh/casa_opy_deploy}"
SITE="${OPY_SITE:-https://etnias.site}"
SSH=(ssh -i "${KEY}" -o BatchMode=yes "${HOST}")
APP=/srv/casa-opy

# S-15: só publica um commit conhecido (árvore limpa), para saber sempre o que está no ar.
if [ -n "$(git status --porcelain --untracked-files=no)" ] && [ "${OPY_DEPLOY_ALLOW_DIRTY:-0}" != 1 ]; then
  echo "Há alterações não salvas no git. Faça commit (ou use OPY_DEPLOY_ALLOW_DIRTY=1) e rode de novo." >&2; exit 1
fi
COMMIT="$(git rev-parse --short HEAD)"
if [ "${OPY_SKIP_TESTS:-0}" != 1 ]; then echo "0/5 Testes automáticos…"; node --test tests/opy/*.mjs >/dev/null || { echo "Os testes falharam; nada foi publicado." >&2; exit 1; }; fi

# Assinantes do Etnias 1.0: regenerados quando o banco recuperado está rodando neste computador (só leitura).
if docker ps --format "{{.Names}}" | grep -q "^etnias-recovery-db-1$"; then bash scripts/opy-legacy-plans.sh; python3 -I scripts/opy-legacy-areas.py; fi
echo "1/5 Gerando as páginas…"
docker run --rm -v "$PWD":/app -w /app php:8.2-cli php scripts/export-opy-preview.php

echo "2/5 Guardando o que vai ser trocado (imagem, compose e banco)…"
STAMP="$("${SSH[@]}" "set -e; S=\$(date +%Y%m%d-%H%M%S); D=${APP}/deploys/\$S; mkdir -p \$D; cd ${APP}/deploy/opy
for f in compose.yaml compose.vps-caddy.yaml Dockerfile mediamtx.yml turnserver.conf; do [ -f \$f ] && cp -a \$f \$D/; done
docker tag casa-opy:local casa-opy:antes-\$S
docker cp casa-opy-opy-1:/data/community.json \$D/community.json
chmod 600 \$D/community.json; ls -t ${APP}/deploys | tail -n +8 | while read old; do rm -rf ${APP}/deploys/\$old; done
echo \$S")"
echo "   ponto de volta: ${STAMP} (imagem casa-opy:antes-${STAMP})"

echo "3/5 Enviando ${COMMIT} para ${HOST}…"
rsync -az -e "ssh -i ${KEY}" --relative preview/package.json preview/package-lock.json preview/server preview/middleware.js preview/public-posts.json preview/i18n preview/dist/public scripts/opy-preview-server.mjs scripts/opy-import-legacy.mjs deploy/opy/Dockerfile deploy/opy/Dockerfile.dockerignore deploy/opy/compose.yaml deploy/opy/compose.vps-caddy.yaml deploy/opy/mediamtx.yml deploy/opy/turnserver.conf deploy/opy/backup deploy/opy/monitor "${HOST}:${APP}/"
# Fotos das áreas do OPY (Blogs, Mercado, Eventos…): só acrescenta arquivos que faltam na VPS, nunca apaga.
if [ -s preview/legacy/areas-media-manifest.txt ]; then rsync -a --partial -e "ssh -i ${KEY}" --files-from=preview/legacy/areas-media-manifest.txt public_html/ "${HOST}:${APP}/legacy-media/"; fi
COMPOSE='docker compose -f compose.yaml -f compose.vps-caddy.yaml --env-file .env'

echo "4/5 Subindo os containers…"
"${SSH[@]}" "set -e; cd ${APP}/deploy/opy; echo ${COMMIT} > ${APP}/COMMIT_NO_AR
${COMPOSE} up -d --build
cmp -s turnserver.conf ${APP}/deploys/${STAMP}/turnserver.conf || ${COMPOSE} restart turn
docker ps --format '{{.Names}} {{.Status}}' | grep -E 'casa-opy|etnias-caddy'"

echo "5/5 Teste de fumaça (somente leitura)…"
ok=0
for i in $(seq 1 24); do
  sleep 5
  if [ "$(curl -s -o /dev/null -w '%{http_code}' --max-time 8 "${SITE}/api/health")" = 200 ] && [ "$(curl -s -o /dev/null -w '%{http_code}' --max-time 8 "${SITE}/entrar/")" = 200 ] \
     && [ "$(curl -s -o /dev/null -w '%{http_code}' --max-time 8 "${SITE}/api/community")" = 401 ]; then ok=1; break; fi
done
if [ "$ok" != 1 ]; then
  echo "O app novo não respondeu direito. Voltando para ${STAMP}…" >&2
  "${SSH[@]}" "set -e; cd ${APP}/deploy/opy; D=${APP}/deploys/${STAMP}
for f in compose.yaml compose.vps-caddy.yaml Dockerfile mediamtx.yml turnserver.conf; do [ -f \$D/\$f ] && cp -a \$D/\$f .; done
docker tag casa-opy:antes-${STAMP} casa-opy:local
${COMPOSE} stop opy
docker run --rm --user root --entrypoint sh -v casa-opy_opy-data:/data -v \$D:/b:ro casa-opy:antes-${STAMP} -c 'cp /b/community.json /data/community.json && chown node:node /data/community.json'
${COMPOSE} up -d --no-build --force-recreate opy turn"
  echo "Voltou para a versão anterior (banco restaurado da cópia de ${STAMP}). Veja ${SITE}/ e os logs." >&2; exit 1
fi
echo "Pronto: ${COMMIT} no ar. Confira ${SITE}/ (ponto de volta ${STAMP})."
