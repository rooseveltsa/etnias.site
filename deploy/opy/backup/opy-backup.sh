#!/bin/sh
# Backup diário da Casa Opy: empacota o volume de dados, criptografa (AES-256) e envia para o Blob privado da Vercel.
# Guarda 14 dias na Vercel e 7 dias em /var/backups/casa-opy. Chave em /root/.casa-opy/backup.key (há cópia fora da VPS).
# Cada etapa é independente: se o envio falhar, a limpeza local continua e o script termina com erro registrado em
# /var/log/casa-opy-status/backup (lido por opy-monitor.sh, que avisa).
set -u
DAY=$(date -u +%Y-%m-%d); OUT=/var/backups/casa-opy; HERE=$(cd "$(dirname "$0")" && pwd)
ST=/var/log/casa-opy-status; mkdir -p "$OUT" "$ST"; chmod 700 "$OUT"
fail() { echo "$(date -u +%FT%TZ) FALHA: $1" >> /var/log/casa-opy-backup.log; echo "$1" > "$ST/backup.erro"; exit 1; }
rm -f "$ST/backup.erro"
docker run --rm -v casa-opy_opy-data:/d:ro -v "$OUT":/o alpine tar czf "/o/opy-$DAY.tgz" -C /d . || fail "tar"
openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt -in "$OUT/opy-$DAY.tgz" -out "$OUT/opy-$DAY.tgz.enc" -pass file:/root/.casa-opy/backup.key || fail "criptografia"
rm -f "$OUT/opy-$DAY.tgz"
(cd "$OUT" && sha256sum "opy-$DAY.tgz.enc" > "opy-$DAY.tgz.enc.sha256")
SIZE=$(wc -c < "$OUT/opy-$DAY.tgz.enc")
blob() { docker run --rm --user root --env-file /root/.casa-opy/blob.env -v "$OUT":/o -v "$HERE/blob.mjs":/app/preview/backup-blob.mjs:ro casa-opy:local node /app/preview/backup-blob.mjs "$@"; }
OK=1
blob upload "/o/opy-$DAY.tgz.enc" "backups/casa-opy/opy-$DAY.tgz.enc" >> /var/log/casa-opy-backup.log 2>&1 || OK=0
[ "$OK" = 1 ] && { blob prune backups/casa-opy/ 14 >> /var/log/casa-opy-backup.log 2>&1 || true; }
find "$OUT" -name 'opy-20*.tgz.enc*' -mtime +7 -delete
if [ "$OK" = 1 ]; then
  echo "$(date -u +%FT%TZ) backup ok opy-$DAY.tgz.enc $SIZE bytes (local + Blob)" | tee -a /var/log/casa-opy-backup.log
  date -u +%s > "$ST/backup.ok"
else
  echo "envio ao Blob falhou" > "$ST/backup.erro"
  echo "$(date -u +%FT%TZ) backup LOCAL ok, ENVIO AO BLOB FALHOU opy-$DAY.tgz.enc $SIZE bytes" >> /var/log/casa-opy-backup.log; exit 1
fi
