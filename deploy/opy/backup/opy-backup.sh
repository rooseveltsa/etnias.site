#!/bin/sh
# Backup diário da Casa Opy: empacota o volume de dados, criptografa (AES-256) e envia para o Blob privado da Vercel.
# Guarda 14 dias na Vercel e 7 dias em /var/backups/casa-opy. Chave em /root/.casa-opy/backup.key (guarde uma cópia fora da VPS).
set -eu
DAY=$(date -u +%Y-%m-%d); OUT=/var/backups/casa-opy; HERE=$(cd "$(dirname "$0")" && pwd)
mkdir -p "$OUT"; chmod 700 "$OUT"
docker run --rm -v casa-opy_opy-data:/d:ro -v "$OUT":/o alpine tar czf "/o/opy-$DAY.tgz" -C /d .
openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt -in "$OUT/opy-$DAY.tgz" -out "$OUT/opy-$DAY.tgz.enc" -pass file:/root/.casa-opy/backup.key
rm -f "$OUT/opy-$DAY.tgz"
(cd "$OUT" && sha256sum "opy-$DAY.tgz.enc" > "opy-$DAY.tgz.enc.sha256")
blob() { docker run --rm --user root --env-file /root/.casa-opy/blob.env -v "$OUT":/o -v "$HERE/blob.mjs":/app/preview/backup-blob.mjs:ro casa-opy:local node /app/preview/backup-blob.mjs "$@"; }
blob upload "/o/opy-$DAY.tgz.enc" "backups/casa-opy/opy-$DAY.tgz.enc"
blob prune backups/casa-opy/ 14
find "$OUT" -name 'opy-*.tgz.enc*' -mtime +7 -delete
echo "$(date -u +%FT%TZ) backup ok opy-$DAY.tgz.enc $(wc -c < "$OUT/opy-$DAY.tgz.enc") bytes"
