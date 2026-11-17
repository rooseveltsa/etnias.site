# Servidor de produção (VPS) — o que foi feito e como desfazer

Servidor: `root@179.66.136.125` (15,6 GB RAM, 4 CPUs, disco de 193 GB). Alterações feitas em **17/11/2026** (horário de Belém), na ordem. Tudo que mexe no sistema tem cópia ou comando de volta.

## Alterações no sistema operacional
| O quê | Onde | Como desfazer |
|---|---|---|
| SSH só com chave; root só por chave; 3 tentativas; 30 s para entrar | `/etc/ssh/sshd_config.d/00-casa-opy-hardening.conf` | Apagar o arquivo e `systemctl reload ssh`. **Antes de qualquer mudança no SSH, mantenha uma sessão aberta e teste outra.** |
| Firewall ufw ligado: libera só 22/tcp, 80/tcp, 443/tcp+udp, 8189/tcp+udp (live), 3478/tcp+udp e 5349/tcp (TURN), 49160–49260/udp (mídia TURN) | ufw (regras 1–20) | `ufw disable` (desliga tudo) ou `ufw delete <n>` |
| fail2ban para SSH: 4 falhas em 10 min = bloqueio de 12 h | `/etc/fail2ban/jail.d/*.local` | `systemctl disable --now fail2ban`; `fail2ban-client unban <ip>` |
| Rotação dos logs do Docker (5 × 20 MB por contêiner) | `/etc/docker/daemon.json` (vale para contêineres **recriados**) | Apagar o arquivo e `systemctl restart docker` (derruba contêineres por segundos; todos têm `restart: unless-stopped`) |
| Rotação dos logs do app e do monitor | `/etc/logrotate.d/casa-opy`, `/etc/logrotate.d/docker-containers` | Apagar os arquivos |
| Vigia a cada 10 min (disco, contêineres, saúde do app, idade do backup) | `/etc/cron.d/casa-opy-monitor` → `deploy/opy/monitor/opy-monitor.sh`; log em `/var/log/casa-opy-monitor.log` | Apagar `/etc/cron.d/casa-opy-monitor` |
| Backup diário 06:30 (cifrado, local + Vercel Blob em partes) | `/etc/cron.d/casa-opy-backup`; arquivos em `/var/backups/casa-opy/` | Ver `docs/diagnostico-backup-migracao.md` |
| Sistema antigo (Etnias 1.0 / WoWonder) **parado**, não apagado | contêineres `etnias-web-1` e `etnias-db-1` (Exited); cron do antigo comentado em `/etc/cron.d/etnias` (linhas com `#DESATIVADO-17-11`); Caddyfile com cópias `.bak-20261117-042954` em `/srv/etnias/deploy/` | Religar: `cd /srv/etnias/deploy && docker compose up -d`, descomentar a linha do cron, e restaurar o Caddyfile (`cp Caddyfile.bak-20261117-042954 Caddyfile` e recarregar o Caddy) |

## Cópias de segurança (onde estão)
- `/var/backups/casa-opy/opy-AAAA-MM-DD.tgz.enc` (+ `.sha256`): diárias, cifradas (a chave de decifrar está **no Mac**, `~/.cleo-tmp/etnias-chave-backup.key`, e não no servidor; guarde também num cofre).
- `/var/backups/casa-opy/opy-pre-fase3-20261117-0351.tgz.enc` e `codigo-pre-fase3-20261117-0351.tgz`: antes das mudanças de hoje.
- `/var/backups/etnias-legacy/`: dump do MariaDB e arquivos do sistema antigo (parado), com `SHA256SUMS`. Cópia também no Mac: `~/.cleo-tmp/etnias-legado-backup/`.
- Imagem Docker de volta: `casa-opy:pre-fase3-20261117-0351`.
- A cada publicação, `publicar.sh` cria `/srv/casa-opy/deploys/<carimbo>/` (compose, Dockerfile, `community.json`) e a imagem `casa-opy:antes-<carimbo>`.

## Pendências do servidor (dependem de você)
- **Reiniciar para o kernel novo** (`/var/run/reboot-required`; 7.0.0-38 instalado) e aplicar as atualizações pendentes do apt. Reinício leva ~1 min fora do ar; todos os contêineres têm `unless-stopped`. Faça em horário de pouco uso.
- **Canal de alerta**: o vigia grava em log e sai com erro; falta definir para onde avisar (e-mail, WhatsApp, Telegram, Healthchecks.io). Dê o canal e ligo.
- **Usuário de deploy sem root** (S-15): hoje o deploy usa root com chave. Criar um usuário `deploy` no grupo docker exige a decisão de quem mais acessará o servidor.
- **Gravações de live** (S-14): ficam apagadas junto com a conta, mas não há prazo automático. Decida a retenção (ex.: 90 dias) e eu configuro `recordDeleteAfter` no `mediamtx.yml`.

## Variáveis de ambiente do app (arquivo `.env` do servidor, não vai ao Git)
`OPY_SESSION_SECRET` (obrigatória), `OPY_MAX_STORIES` (5000), `OPY_MAX_POSTS_PER_USER_DAY` (60), `OPY_MAX_POSTS` (500000), `OPY_MAX_ACCOUNTS` (100000), `OPY_REQUIRE_CONSENT` (`0` desliga o aceite de termos; só testes), `OPY_SECURITY_CONTACT`, `OPY_CODE_WEBHOOK_URL` e `OPY_CODE_WEBHOOK_TOKEN` (envio de códigos de recuperação; sem isso a recuperação automática fica desligada), `OPY_TRANSCODE=0` (desliga o ffmpeg).
