#!/bin/sh
# Vigia a Casa Opy a cada 10 min (cron). Problemas vão para /var/log/casa-opy-alertas.log e, se existir
# /root/.casa-opy/alert.url (webhook: ntfy, Slack, Discord…) ou /root/.casa-opy/alert.mail (e-mail, exige "mail" instalado),
# também são enviados — uma vez por problema novo e uma vez quando normaliza.
set -u
ST=/var/log/casa-opy-status; LOG=/var/log/casa-opy-alertas.log; mkdir -p "$ST"
now=$(date +%s); problems=""
add() { problems="$problems$1; "; }
# 1) backup recente e sem erro
if [ -f "$ST/backup.erro" ]; then add "backup falhou: $(cat "$ST/backup.erro")"; fi
if [ -f "$ST/backup.ok" ]; then age=$(( now - $(cat "$ST/backup.ok") )); [ "$age" -gt 108000 ] && add "último backup completo tem $((age/3600)) h"; else add "sem registro de backup completo"; fi
# 2) disco
use=$(df --output=pcent / | tail -1 | tr -dc 0-9); [ "$use" -ge 85 ] && add "disco em ${use}%"
# 3) containers
for c in casa-opy-opy-1 casa-opy-live-1 casa-opy-turn-1; do
  s=$(docker inspect -f '{{.State.Status}} {{if .State.Health}}{{.State.Health.Status}}{{end}}' "$c" 2>/dev/null || echo ausente)
  case "$s" in "running healthy"|"running ") ;; *) add "$c: $s";; esac
done
# 4) site de fora
code=$(curl -s -o /dev/null -m 15 -w '%{http_code}' https://etnias.site/entrar/ || echo 000); [ "$code" = 200 ] || add "etnias.site/entrar respondeu $code"
# 5) erros 5xx do app nos últimos 10 min
e5=$(docker logs --since 10m casa-opy-opy-1 2>&1 | grep -c 'ERRO 5' || true); [ "${e5:-0}" -ge 5 ] && add "$e5 erros 5xx em 10 min"
prev=""; [ -f "$ST/alerta.atual" ] && prev=$(cat "$ST/alerta.atual")
if [ "$problems" != "$prev" ]; then
  if [ -n "$problems" ]; then msg="Etnias ALERTA: $problems"; else msg="Etnias: tudo normal de novo"; fi
  echo "$(date -u +%FT%TZ) $msg" >> "$LOG"
  [ -f /root/.casa-opy/alert.url ] && curl -s -m 10 -d "$msg" "$(cat /root/.casa-opy/alert.url)" >/dev/null 2>&1
  [ -f /root/.casa-opy/alert.mail ] && command -v mail >/dev/null 2>&1 && echo "$msg" | mail -s "Etnias: alerta" "$(cat /root/.casa-opy/alert.mail)"
  echo "$problems" > "$ST/alerta.atual"
fi
date -u +%s > "$ST/monitor.ultimo"
