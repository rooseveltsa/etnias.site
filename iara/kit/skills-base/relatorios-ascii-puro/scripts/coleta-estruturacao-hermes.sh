#!/bin/bash
# Coletor READ-ONLY do estado do Hermes para o relatorio de estruturacao.
# Uso: bash coleta-estruturacao-hermes.sh [arquivo_de_saida]
# Padrao de saida: /tmp/coleta-estrutura.txt (ler com read_file; o rtk-rewrite
# comprime saida longa no terminal e ESCONDE linha).
#
# Nada aqui move, cria ou apaga nada dentro do Hermes. So leitura.

set -u
OUT="${1:-/tmp/coleta-estrutura.txt}"
HOME_DIR="$HOME"
: > "$OUT"

sec() { echo "" >> "$OUT"; echo "=== $1 ===" >> "$OUT"; }

sec "DATA"
TZ=America/Sao_Paulo date '+%d/%m/%Y %H:%M' >> "$OUT"

sec "MOTOR"
# NAO usar `| tail -3`: a linha da versao sai primeiro e e cortada.
hermes --version 2>&1 >> "$OUT"
git -C "$HOME_DIR/hermes-agent" describe --tags --always 2>&1 >> "$OUT"
echo "-- modificados/nao rastreados --" >> "$OUT"
git -C "$HOME_DIR/hermes-agent" status --short 2>&1 >> "$OUT"

sec "ARVORE HERMES"
du -sh "$HOME_DIR"/Hermes/* 2>/dev/null | sort -k2 >> "$OUT"

sec "HOME TOP"
find "$HOME_DIR" -maxdepth 1 -mindepth 1 2>/dev/null | sort >> "$OUT"

sec "PEXINXAVEL"
du -sh "$HOME_DIR"/Hermes/Pexinxavel/* 2>/dev/null | sort -k2 >> "$OUT"
echo "-- estoque / vendidas --" >> "$OUT"
ls -1 "$HOME_DIR/Hermes/Pexinxavel/Estoque" 2>/dev/null | grep -c '^PXX-' >> "$OUT"
ls -1 "$HOME_DIR/Hermes/Pexinxavel/Vendidas" 2>/dev/null | grep -c '^PXX-' >> "$OUT"
du -sh "$HOME_DIR/Hermes/Pexinxavel/Tools"/* 2>/dev/null | sort -h >> "$OUT"

sec "SKILLS"
find "$HOME_DIR/.hermes/skills" -name SKILL.md 2>/dev/null | wc -l >> "$OUT"
find "$HOME_DIR/.hermes/skills" -maxdepth 1 -mindepth 1 -type d 2>/dev/null | wc -l >> "$OUT"
echo "-- criadas/alteradas nos ultimos 5 dias --" >> "$OUT"
find "$HOME_DIR/.hermes/skills" -name SKILL.md -mtime -5 2>/dev/null \
  | sed "s#$HOME_DIR/.hermes/skills/##" >> "$OUT"
echo "-- peso escondido (pasta com ponto: skills/* nao ve) --" >> "$OUT"
du -sh "$HOME_DIR"/.hermes/skills/.[!.]* 2>/dev/null | sort -h >> "$OUT"
du -sh "$HOME_DIR"/.hermes/skills/* 2>/dev/null | sort -h | tail -6 >> "$OUT"

sec "SCRIPTS"
find "$HOME_DIR/.hermes/scripts" -maxdepth 1 -type f 2>/dev/null | wc -l >> "$OUT"

sec "PROFILES"
du -sh "$HOME_DIR"/.hermes/profiles/* 2>/dev/null | sort -h >> "$OUT"

sec "MEMORIA"
wc -c "$HOME_DIR/.hermes/memories/MEMORY.md" "$HOME_DIR/.hermes/memories/USER.md" 2>/dev/null >> "$OUT"
ls -1 "$HOME_DIR/.hermes/memories/" 2>/dev/null >> "$OUT"

sec "OPTMEM"
# ~/.optmem/memo e o PROGRAMA do OptMem. O log real e memory/LOG.txt.
wc -l "$HOME_DIR/.optmem/memory/LOG.txt" 2>/dev/null >> "$OUT"
ls -1 "$HOME_DIR/.optmem/memory/TREE" 2>/dev/null | wc -l >> "$OUT"

sec "DISCO"
df -h / 2>/dev/null >> "$OUT"
echo "-- maiores dentro de .hermes --" >> "$OUT"
du -sh "$HOME_DIR"/.hermes/* 2>/dev/null | sort -h | tail -8 >> "$OUT"
du -sh "$HOME_DIR/.cache" 2>/dev/null >> "$OUT"

sec "SERVICOS"
# `systemctl is-active` sai com codigo 3 quando parado: separar com ';',
# nunca com '&&' (mata o resto da coleta). Escopo SEMPRE --user.
systemctl --user is-active hermes-gateway.service 2>&1 >> "$OUT"
systemctl --user is-active vigia-whatsapp.timer 2>&1 >> "$OUT"
systemctl --user is-active chromium-mp.service 2>&1 >> "$OUT"
curl -s --max-time 5 http://127.0.0.1:3000/health >> "$OUT" 2>&1
echo "" >> "$OUT"

sec "PLUGINS E MCP"
find "$HOME_DIR/.hermes/plugins" -maxdepth 1 -mindepth 1 -type d 2>/dev/null >> "$OUT"
grep -A6 '^plugins:' "$HOME_DIR/.hermes/config.yaml" 2>/dev/null >> "$OUT"
grep -A20 '^mcp_servers:' "$HOME_DIR/.hermes/config.yaml" 2>/dev/null >> "$OUT"

sec "BACKUPS"
du -sh "$HOME_DIR"/Hermes/Backups/* 2>/dev/null | sort -k2 >> "$OUT"

sec "RELATORIOS (duas pastas reais - nao sao atalho)"
du -sh "$HOME_DIR/Hermes/Relatorios" 2>/dev/null >> "$OUT"
ls -1 "$HOME_DIR/Hermes/Relatorios" 2>/dev/null | wc -l >> "$OUT"
du -sh "$HOME_DIR/Hermes/Pexinxavel/A.R.A.R.A/Relatorios" 2>/dev/null >> "$OUT"
ls -1 "$HOME_DIR/Hermes/Pexinxavel/A.R.A.R.A/Relatorios" 2>/dev/null | wc -l >> "$OUT"

sec "SUPABASE (contagem sem baixar linha)"
python3 - "$HOME_DIR" >> "$OUT" 2>&1 <<'PY'
import sys, json, urllib.request
env, home = {}, sys.argv[1]
try:
    with open(home + '/.hermes/.env') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#') or '=' not in line:
                continue
            k, v = line.split('=', 1)
            env[k.strip()] = v.strip().strip('"').strip("'")
except FileNotFoundError:
    print('sem .env'); sys.exit(0)

url = env.get('SUPABASE_URL', '').rstrip('/')
key = env.get('SUPABASE_SERVICE_ROLE_KEY', '')
if not url or not key:
    print('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY ausentes'); sys.exit(0)
print('projeto:', url.split('//')[-1].split('.')[0])
# Prefer: count=exact + Range 0-0 -> header content-range "0-0/655"
for tbl in ['produtos', 'vendas', 'midias', 'medicoes']:
    req = urllib.request.Request(
        f'{url}/rest/v1/{tbl}?select=id',
        headers={'apikey': key, 'Authorization': f'Bearer {key}',
                 'Prefer': 'count=exact', 'Range': '0-0'})
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            print(f'{tbl:10s} {r.headers.get("Content-Range", "?")}')
    except Exception as e:
        print(f'{tbl:10s} ERRO {e}')
req = urllib.request.Request(f'{url}/storage/v1/bucket',
                             headers={'apikey': key, 'Authorization': f'Bearer {key}'})
try:
    with urllib.request.urlopen(req, timeout=20) as r:
        print('buckets:', ', '.join(b['name'] for b in json.load(r)))
except Exception as e:
    print('buckets ERRO', e)
PY

sec "CRONS"
echo "Rodar a ferramenta cronjob(action='list'): ela ja separa ativo de pausado" >> "$OUT"
echo "e traz deliver/last_status. NAO ler jobs.json a mao." >> "$OUT"

echo "" >> "$OUT"
wc -l "$OUT"
