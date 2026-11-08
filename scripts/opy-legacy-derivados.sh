#!/usr/bin/env bash
# Derivados leves da mídia do Etnias antigo, gerados neste Mac (sips e ffmpeg já existem aqui; o servidor não redimensiona):
#   - miniaturas: imagens do manifesto acima de 300 KB → máx. 1280 px, JPEG 80  → $OUT/thumbs/upload/...  (rota /legado/thumbs/...)
#   - vídeos: acima de 20 MB → H.264 máx. 1280 px ~2 Mb/s, AAC 96k, faststart → $OUT/videos/upload/... (substituem a cópia da VPS)
# Idempotente: pula o que já existe. Uso: scripts/opy-legacy-derivados.sh [origem=public_html] [manifesto] [saída]
set -uo pipefail
SRC=${1:-public_html}; MANIFEST=${2:-preview/legacy/media-manifest.txt}; OUT=${3:-preview/legacy/derivados}
export SRC OUT
thumb() {
  local f=$1 in="$SRC/$1" out="$OUT/thumbs/$1"
  [ -f "$out" ] && return 0
  [ "$(stat -f %z "$in" 2>/dev/null || echo 0)" -gt 300000 ] || return 0
  mkdir -p "$(dirname "$out")"
  sips -Z 1280 -s formatOptions 80 "$in" --out "$out" >/dev/null 2>&1 || { echo "FALHA miniatura $f"; rm -f "$out"; }
}
video() {
  local f=$1 in="$SRC/$1" out="$OUT/videos/$1"
  [ -f "$out" ] && return 0
  local size; size=$(stat -f %z "$in" 2>/dev/null || echo 0)
  [ "$size" -gt 20000000 ] || return 0
  mkdir -p "$(dirname "$out")"
  if ffmpeg -nostdin -loglevel error -y -i "$in" \
      -vf "scale='if(gt(iw,ih),min(1280,iw),-2)':'if(gt(iw,ih),-2,min(1280,ih))'" \
      -c:v h264_videotoolbox -allow_sw 1 -b:v 2000k -pix_fmt yuv420p -c:a aac -b:a 96k -movflags +faststart "$out"; then
    # Se não encolheu, o original já era leve o bastante: fica como está.
    [ "$(stat -f %z "$out")" -lt "$size" ] || rm -f "$out"
  else echo "FALHA vídeo $f"; rm -f "$out"; fi
}
export -f thumb video
echo "miniaturas…"; grep -iE '\.(jpe?g|png)$' "$MANIFEST" | xargs -P 4 -I{} bash -c 'thumb "$1"' _ {}
echo "vídeos…";     grep -iE '\.(mp4|mov)$'   "$MANIFEST" | xargs -P 2 -I{} bash -c 'video "$1"' _ {}
echo "pronto: $(find "$OUT/thumbs" -type f 2>/dev/null | wc -l | tr -d ' ') miniaturas, $(find "$OUT/videos" -type f 2>/dev/null | wc -l | tr -d ' ') vídeos; $(du -sh "$OUT" | cut -f1)"
