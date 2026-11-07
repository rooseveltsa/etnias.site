#!/bin/sh
# Emergência: restaura o backup mais recente (ou o dia informado) no Blob da Vercel.
# Uso: restore-to-vercel.sh [AAAA-MM-DD] [prefixo]   (prefixo padrão: opy-v2, o usado pela prévia na Vercel)
# Para testar sem afetar a prévia: restore-to-vercel.sh "" restore-test/opy-v2
set -eu
DAY=${1:-}; PREFIX=${2:-opy-v2}; HERE=$(cd "$(dirname "$0")" && pwd); WORK=$(mktemp -d); trap 'rm -rf "$WORK"' EXIT
blob() { docker run --rm --user root --env-file /root/.casa-opy/blob.env -v "$WORK":/w -v "$HERE/blob.mjs":/app/preview/backup-blob.mjs:ro casa-opy:local node /app/preview/backup-blob.mjs "$@"; }
[ -n "$DAY" ] || DAY=$(blob list backups/casa-opy/ | awk '{print $1}' | sed -n 's#.*/opy-\(.*\)\.tgz\.enc#\1#p' | sort | tail -1)
blob download "backups/casa-opy/opy-$DAY.tgz.enc" /w/backup.enc
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -in "$WORK/backup.enc" -out "$WORK/backup.tgz" -pass file:/root/.casa-opy/backup.key
mkdir "$WORK/data"; tar xzf "$WORK/backup.tgz" -C "$WORK/data"
blob restore /w/data "$PREFIX"
echo "Restaurado opy-$DAY em $PREFIX. Para usar a Vercel como reserva, aponte o DNS para ela."
