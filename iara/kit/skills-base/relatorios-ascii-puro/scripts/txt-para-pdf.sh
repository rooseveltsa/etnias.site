#!/usr/bin/env bash
# Converte um relatorio .txt em PDF A4 sem pandoc/wkhtmltopdf/libreoffice/reportlab.
# Rota: HTML com <pre> (preserva o alinhamento ASCII) -> Chromium headless -> PDF.
#
# uso:  txt-para-pdf.sh <arquivo.txt> [saida.pdf]
#       (sem saida, grava ao lado do .txt com a mesma raiz)
#
# Por que --user-data-dir separado: a janela do Chromium da Vytorya roda CDP em 9222
# (login do Mercado Pago). Perfil proprio evita tocar/roubar a sessao dela e evita
# "outro processo esta usando este perfil".

set -euo pipefail

TXT="${1:?uso: txt-para-pdf.sh <arquivo.txt> [saida.pdf]}"
[ -f "$TXT" ] || { echo "nao existe: $TXT" >&2; exit 1; }
PDF="${2:-${TXT%.txt}.pdf}"
HTML="$(mktemp /tmp/doc-XXXXXX.html)"

python3 - "$TXT" "$HTML" <<'PY'
import html, sys
from pathlib import Path

txt = Path(sys.argv[1]).read_text(encoding="utf-8")
Path(sys.argv[2]).write_text(
    "<!doctype html><html lang=\"pt-BR\"><head><meta charset=\"utf-8\">"
    "<style>"
    "@page { size: A4; margin: 16mm 14mm; }"
    "body { font-family: \"DejaVu Sans Mono\",\"Liberation Mono\",monospace;"
    "       font-size: 9.2pt; line-height: 1.38; color: #111; }"
    "pre { white-space: pre-wrap; word-break: break-word; margin: 0; }"
    "</style></head><body><pre>" + html.escape(txt) + "</pre></body></html>",
    encoding="utf-8",
)
PY

chromium --headless=new --disable-gpu --no-sandbox --no-pdf-header-footer \
  --user-data-dir=/tmp/chrome-pdf --print-to-pdf="$PDF" "file://$HTML" >/dev/null 2>&1
rm -f "$HTML"

python3 - "$PDF" <<'PY'
import sys
d = open(sys.argv[1], "rb").read()
print(f"PDF: {sys.argv[1]} | {len(d)} bytes | "
      f"{d.count(b'/Type /Page') - d.count(b'/Type /Pages')} paginas")
PY
