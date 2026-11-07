# Casa Opy (prévia Node) para a VPS. Build a partir da raiz do repositório:
#   docker compose -f deploy/opy/compose.yaml build
# Antes do build, gere as páginas: docker run --rm -v "$PWD":/app -w /app php:8.2-cli php scripts/export-opy-preview.php
FROM node:22-alpine
WORKDIR /app
COPY preview/package.json preview/package-lock.json preview/
RUN cd preview && npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY preview/server preview/server
COPY preview/i18n preview/i18n
COPY preview/middleware.js preview/public-posts.json preview/
COPY preview/dist/public preview/dist/public
COPY scripts/opy-preview-server.mjs scripts/
RUN mkdir -p /data && chown node:node /data
USER node
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8101 OPY_LOCAL_DATA_DIR=/data
EXPOSE 8101
HEALTHCHECK --interval=30s --timeout=5s CMD wget -q -O /dev/null http://127.0.0.1:8101/entrar/ || exit 1
CMD ["node", "scripts/opy-preview-server.mjs"]
