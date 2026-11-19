# Entrega do Etnias ao novo responsável

O que existe, onde fica e como passar cada parte. Regra geral: **acesso se transfere ou se recria, não se copia**. Senhas e chaves vão no arquivo criptografado (`segredos.tar.enc`) ou são trocadas no dia da entrega.

## 1. O que vai no pacote (`bash scripts/entrega-projeto.sh`)

| Arquivo | Conteúdo | Como usar |
|---|---|---|
| `etnias-codigo.bundle` | Código com todo o histórico e todos os branches | `git clone etnias-codigo.bundle etnias` |
| `segredos.tar.enc` | Chave de assinatura Android (`etnias-release.jks`), senha dela e chave dos backups | `openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -in segredos.tar.enc \| tar -xf -` (pede a frase) |
| `SHA256SUMS` | Conferência de integridade | `shasum -a 256 -c SHA256SUMS` |

A frase do `segredos.tar.enc` vai por outro canal (ligação ou pessoalmente). **Perder a chave Android = não conseguir mais atualizar o app na Play Store.**

## 2. O que fica fora do pacote

| Item | Onde está | Como entregar |
|---|---|---|
| Mídia do Etnias 1.0 (40 GB) | Este Mac, `public_html/upload` (a VPS tem a cópia em uso, 13 GB) | Copiar para HD externo: `rsync -a public_html/upload/ /Volumes/<HD>/etnias-upload/` |
| Dados de produção (contas, posts, chat, mídias novas) | VPS, volume Docker `casa-opy_opy-data` | Backup diário criptografado (03:30 BRT) em `/var/backups/casa-opy` (7 dias) e no Blob da Vercel (14 dias). Abre com a chave do backup. |
| Banco recuperado do Etnias 1.0 | Este Mac, container `etnias-recovery-db-1` | Só se ele for reimportar o legado; `docs/recuperacao-servidor.md` |

## 3. Contas e acessos: transferir, não copiar senha

| Serviço | O que é | O que fazer (você, no painel) |
|---|---|---|
| GitHub `rooseveltsa/etnias.site` (repositório público) | Código | Settings → Collaborators (adicionar) ou Transfer ownership |
| Hostinger (VPS srv2135798, 179.66.136.125) | Produção | hPanel → convidar o e-mail dele como membro ou transferir o serviço; depois ele cria o próprio token de API |
| HostGator | DNS do domínio etnias.site | Adicionar o e-mail dele ou transferir o domínio |
| Vercel (casa-opy-preview, Blob dos backups) | Prévia e cópia dos backups | Team → convidar como Owner |
| Google Play Console (quando houver) | App Android | Usuários e permissões → Admin |

**Acesso SSH à VPS:** ele gera a chave dele (`ssh-keygen -t ed25519`) e manda só a **pública** (`.pub`). Você adiciona em `/root/.ssh/authorized_keys` da VPS. Quando ele confirmar o acesso, remova a chave `casa_opy_deploy` deste Mac da lista. Não se envia chave privada.

**Segredos do servidor (`/srv/casa-opy/deploy/opy/.env`):** ficam na VPS; com o acesso SSH ele lê direto lá. Na passagem, troque `OPY_SESSION_SECRET` (isso desloga todo mundo uma vez) e as chaves de API que só você conhece.

**Admins do Centro de gestão:** `OPY_ADMIN_USERNAMES` no `.env` da VPS; inclua o @ dele.

## 4. Como o projeto funciona (para ele começar)

- Visão geral e regras: `AGENTS.md`, `DESIGN.md`, `PRODUCT.md`, `docs/ETNIAS_SERVIDOR.md`.
- Publicar: `bash deploy/opy/publicar.sh` (gera páginas com PHP em Docker, rsync sem `--delete`, `docker compose up -d --build`). Detalhes em `deploy/opy/README.md`.
- Testes: `node tests/opy/<arquivo>.mjs` (todos em `tests/opy/`).
- App Android: `bash apps/mobile/scripts/build-android.sh` (precisa da chave do pacote de segredos).
- Plano pendente: migração para SQLite (`docs/PLANO-SQLITE.md`).

## 5. Checklist do dia da entrega

- [ ] Pacote gerado e conferido (`shasum -a 256 -c SHA256SUMS`)
- [ ] Frase do `segredos.tar.enc` passada por outro canal
- [ ] HD com a mídia do legado entregue
- [ ] GitHub, Hostinger, HostGator e Vercel com o novo responsável como dono
- [ ] Chave SSH dele na VPS, acesso testado por ele, chave antiga removida
- [ ] `OPY_SESSION_SECRET` trocado e chaves de API pessoais revogadas
- [ ] Ele publicou uma vez sozinho (`publicar.sh`) e o site seguiu no ar
