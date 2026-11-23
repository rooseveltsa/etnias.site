# Como começar: programar e publicar o Etnias

Guia para quem entra no desenvolvimento. Nenhum segredo fica neste repositório: as senhas e chaves de produção ficam só no
arquivo `.env` da VPS e no cofre de senhas da equipe.

## 1. Instalar no seu computador

Precisa de: **git**, **Node 22 ou mais novo**, **Docker** (Docker Desktop no Mac/Windows) e, no Windows, **WSL** (Ubuntu).

```bash
git clone https://github.com/rooseveltsa/etnias.site.git
cd etnias.site
git checkout seguranca-usabilidade-17-11
cd preview && npm ci && cd ..
```

## 2. Rodar localmente

```bash
docker run --rm -v "$PWD":/app -w /app php:8.2-cli php scripts/export-opy-preview.php   # gera as páginas em preview/dist
node scripts/dev-opy.mjs                                                                  # http://127.0.0.1:8101
```

- Os dados locais ficam em `preview/local-data/8101/` (começam vazios; crie contas de teste pela tela de cadastro).
- O segredo de sessão local é criado sozinho. Não use nenhuma senha de produção aqui.
- Mexeu em `preview/page.php`, `preview/*.js` ou `preview/*.css`? Rode o export de novo e recarregue a página.
- Mexeu em `preview/server/*.mjs`? Pare (Ctrl+C) e suba o `dev-opy.mjs` de novo.
- Para ser administrador local: `OPY_ADMIN_USERNAMES=seu_usuario node scripts/dev-opy.mjs`.

## 3. Onde fica cada coisa

| Caminho | O que é |
|---|---|
| `preview/page.php` | HTML de todas as telas (exportado para `preview/dist`) |
| `preview/preview.js`, `stories.js`, `videos.js`, `pages.js`, `chat.js`… | Telas no navegador |
| `preview/preview.css` | Estilos (tema Dia e Noite) |
| `preview/server/community.mjs` | API principal: `POST {action}` e `GET ?view=` |
| `preview/server/*.mjs` | Contas, comunidades, Páginas, chat, live, gestão… |
| `scripts/opy-preview-server.mjs` | Servidor de produção (o mesmo código, sem o modo local) |
| `deploy/opy/` | Docker, compose, Caddy, TURN, MediaMTX, backup e o `publicar.sh` |
| `tests/opy/` | Testes automáticos |
| `docs/GABARITO-GERENCIA-*.md` | O que a gestão pediu e o que já foi feito |

O banco é um único JSON (`/data/community.json` no container). Não existe migração: campos novos precisam ser opcionais.

## 4. Antes de publicar

```bash
for f in tests/opy/*.mjs; do node "$f" || echo "FALHOU: $f"; done
```

Tudo precisa passar. O `publicar.sh` roda os testes de novo e não publica se algum falhar.

## 5. Publicar na VPS

Uma vez só: gere a sua chave SSH e mande **somente o arquivo `.pub`** para quem administra a VPS.

```bash
ssh-keygen -t ed25519 -f ~/.ssh/etnias_deploy -C "seu-nome"
cat ~/.ssh/etnias_deploy.pub
```

Depois que a chave for liberada, a partir de um commit salvo (árvore limpa):

```bash
OPY_SSH_KEY=~/.ssh/etnias_deploy bash deploy/opy/publicar.sh
```

O script faz, em ordem: testes, export das páginas, cópia de segurança do banco e da imagem atual na VPS, envio dos arquivos
(sem apagar nada lá), `docker compose up -d --build` e um teste de fumaça. Se o site novo não responder em 2 minutos, ele
**volta sozinho** para a versão anterior.

Conferir depois: abrir https://etnias.site, entrar, publicar algo e ver se aparece. `cat /srv/casa-opy/COMMIT_NO_AR` na VPS
mostra qual commit está no ar.

## 6. Regras da equipe

- **Repositório:** nunca commitar `.env`, chaves, senhas, `private_html`, o banco recuperado nem fotos de pessoas.
- **Segredos:** só pelo cofre de senhas da equipe (Bitwarden/1Password), nunca por WhatsApp ou e-mail. O modelo das variáveis
  está em `deploy/opy/.env.example`; o `.env` real só existe na VPS em `/srv/casa-opy/deploy/opy/.env`.
- **Publicar:** uma pessoa por vez, sempre do mesmo branch e depois de `git pull`. Avise no grupo antes e depois. Quem publica
  um commit antigo por cima de um novo desfaz o trabalho do outro.
- **VPS:** não apagar `/srv/casa-opy/data`, os backups nem a mídia antiga (`legacy-media`, ~40 GB). Nada de `rsync --delete`.
- **Dados pessoais (LGPD):** testes só no seu computador, nunca em produção. Nada de copiar o banco de produção para fora da VPS.
- **Cultura:** decisões sobre povos, línguas, grafismos e conteúdo cultural são da coordenação, não de quem programa.
