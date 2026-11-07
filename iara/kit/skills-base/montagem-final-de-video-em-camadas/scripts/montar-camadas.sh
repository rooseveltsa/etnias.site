#!/usr/bin/env bash
# montar-camadas.sh — junta as 4 camadas do P.L.U.M.A. num mp4 final.
#
#   video base (mp4) + overlay Volito (webm alpha) + legenda (mp4 sem alpha)
#   + trilha (wav) -> saida.mp4 H.264/AAC
#
# Uso:
#   montar-camadas.sh <base.mp4> <overlay.webm|-> <legenda.mp4|-> <trilha.wav> <saida.mp4>
#
# "-" em overlay/legenda/trilha = camada ausente.
#
# Cinco decisoes que custaram teste (04/11/2026):
#  1. overlay webm precisa de -c:v libvpx-vp9 ANTES do -i, senao perde o alpha.
#  2. legenda mp4 (H.264) NAO tem alpha: colar direto pinta um retangulo preto.
#     A saida e `alphamerge` com a luminancia dela como alpha — o texto (claro)
#     fica, o fundo preto vira transparente. `blend=all_mode=screen` parece
#     funcionar e NAO funciona: o blend e por plano YUV e o resultado sai roxo.
#  3. audio do video base e DESCARTADO (-map so do wav): a trilha substitui.
#  4. -shortest sempre; sem ele a saida herda a duracao mais longa.
#  5. loudnorm em passe unico estoura o true peak; por isso o segundo passe
#     copia o video e reencoda so o audio com loudnorm + alimiter.

set -euo pipefail

BASE="${1:-}"; OV="${2:-}"; LEG="${3:-}"; TRILHA="${4:-}"; OUT="${5:-}"
die() { echo "ERRO: $*" >&2; exit 1; }

[ -n "$BASE" ] && [ -n "$OUT" ] || {
  echo "Uso: $0 <base.mp4> <overlay.webm|-> <legenda.mp4|-> <trilha.wav|-> <saida.mp4>" >&2
  exit 2
}
[ -f "$BASE" ] || die "base nao encontrada: $BASE"
[ "$OV" = "-" ] || [ -f "$OV" ] || die "overlay nao encontrado: $OV"
[ "$LEG" = "-" ] || [ -f "$LEG" ] || die "legenda nao encontrada: $LEG"
[ "$TRILHA" = "-" ] || [ -f "$TRILHA" ] || die "trilha nao encontrada: $TRILHA"

W="$(ffprobe -v error -select_streams v:0 -show_entries stream=width  -of csv=p=0 "$BASE" | awk 'NR==1')"
H="$(ffprobe -v error -select_streams v:0 -show_entries stream=height -of csv=p=0 "$BASE" | awk 'NR==1')"
[ -n "$W" ] && [ -n "$H" ] || die "nao consegui medir a base"

IN=(-i "$BASE")
IDX=1
OVI=""; LEGI=""; AI=""
if [ "$OV" != "-" ]; then IN+=(-c:v libvpx-vp9 -i "$OV"); OVI=$IDX; IDX=$((IDX+1)); fi
if [ "$LEG" != "-" ]; then IN+=(-i "$LEG"); LEGI=$IDX; IDX=$((IDX+1)); fi
if [ "$TRILHA" != "-" ]; then IN+=(-i "$TRILHA"); AI=$IDX; IDX=$((IDX+1)); fi

FC=""
LAST="0:v"
if [ -n "$OVI" ]; then
  FC+="[$LAST][$OVI:v]overlay=0:0:format=auto:shortest=0:eof_action=pass[s1];"
  LAST="s1"
fi
if [ -n "$LEGI" ]; then
  # luminancia da legenda -> alpha; o preto do fundo desaparece, o texto fica
  FC+="[$LEGI:v]format=rgb24,split=2[cv][ca];[ca]format=gray[alpha];"
  FC+="[cv][alpha]alphamerge,format=rgba[cap];"
  FC+="[$LAST][cap]overlay=0:0:shortest=0:eof_action=pass[s2];"
  LAST="s2"
fi

TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
STAGE="$TMP/video.mp4"

ffmpeg -y -hide_banner -loglevel warning "${IN[@]}" \
  -filter_complex "${FC}[$LAST]format=yuv420p[v]" \
  -map "[v]" -an \
  -c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p -r 30 \
  -movflags +faststart "$STAGE"

if [ -n "$AI" ]; then
  ffmpeg -y -hide_banner -loglevel warning -i "$STAGE" -i "$TRILHA" \
    -map 0:v -map 1:a -c:v copy \
    -af "loudnorm=I=-14:TP=-2:LRA=11,alimiter=limit=0.891:level=false" \
    -c:a aac -b:a 192k -ar 48000 -shortest -movflags +faststart "$OUT"
else
  cp "$STAGE" "$OUT"
fi

[ -s "$OUT" ] || die "saida vazia"
D="$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUT" | awk 'NR==1')"
echo "OK: $OUT  ${W}x${H}  ${D}s"
