# Mapa de pastas no disco — quem é SKILL e quem é TRABALHO

**Estado: 15/10/2026 (pós-reforma final).** Substitui o mapa de 14/10/2026, que descrevia a camada
intermediária `~/Arquivos-Linux/` — **essa pasta não existe mais** (removida de vez em 16/10/2026;
ela havia sido recriada em 15/10/2026 08:48 com um link de compatibilidade dentro).

> **ATENÇÃO (16/10/2026): este mapa é HISTÓRICO.** O mapa VIVO é
> `~/Hermes/Relatorios/mapa-de-pastas-vivo.txt`. Mudou desde então: a camada de atalhos
> `~/pexinxavel/` (13 symlinks) foi **REMOVIDA em 16/10/2026**, assim como `~/edital`; a home agora
> tem 3 itens. Os trechos abaixo que citam `~/pexinxavel/` descrevem o estado de 15/10 — não usar
> como caminho de trabalho.

Levantado a pedido dela: *"um retrato REAL da organizacao de pastas no disco, nao dos fluxos"*.
Comandos somente-leitura (`du`, `find`, `ls`); nada foi movido, criado ou apagado.
Relatório original (histórico, 14/10/2026): `~/Hermes/Relatorios/relatorio-pastas-reais.txt`.

**Como usar:** para responder rápido "onde estão os arquivos do agente X" sem varrer o disco de
novo. Os CAMINHOS são a parte durável; os TAMANHOS são foto de 15/10/2026. Se um número não bater,
o disco está certo — confira com `du` antes de citar.

## A distinção que responde quase toda pergunta desse tipo

- **SKILL** = pasta dentro de `~/.hermes/skills/` com arquivo `SKILL.md`. Texto de instrução, a
  cabeça do agente. Sem foto, sem vídeo. **Nunca se move.** Hoje: **157 `SKILL.md`**.
- **PASTA DE TRABALHO** = pasta com arquivos reais (fotos, vídeos, PDFs, planilhas). Depois de
  15/10/2026 vivem TODAS em **`~/Hermes/<Setor>/`**, direto na home, sem camada no meio.

## Raiz de trabalho: `~/Hermes/` — 2.0G, 6 setores

| Setor | Tamanho | O que é |
|---|---|---|
| `Pexinxavel/` | 1.1G | brechó (A.R.A.R.A., P.L.U.M.A., Curator.X, Estoque, Tools) |
| `Backups/` | 548M | backups (migração 323M + tar do brechó 226M) |
| `Agente-do-Caos/` | 229M | vídeo político (perfil `caos`) |
| `Agente-Cultural/` | 136M | editais, certidões, T.R.A.M.A., documentos pessoais |
| `Relatorios/` | 144K | 10 relatórios antigos da home + `skills-lock.json` |
| `Downloads/` | 0 (vazia) | reservada |

No app Arquivos do ChromeOS: **Arquivos do Linux > Hermes > (os setores)** — 2 níveis.

## Onde cada setor guarda ARQUIVO (15/10/2026)

| Setor | Skill (`~/.hermes/skills/`) | Pasta de trabalho |
|---|---|---|
| A.R.A.R.A. / P.L.U.M.A. | `arara-pexinxavel/`, `pluma-pexinxavel`, `pluma-video`, `pluma-marketing/` | `~/Hermes/Pexinxavel/` (1.1G) |
| Curator.X | `arara-pexinxavel/curator-x`, `arara-pexinxavel/curador-preco` | `Pexinxavel/Curator.X/Scripts` (scripts) + `Pexinxavel/Curator.X/Medicoes` (medidas) |
| Agente do Caos | `agente-do-caos`, `video/curadoria-e-edicao-de-video`, `media/cortes-de-video-por-tema` | `~/Hermes/Agente-do-Caos/` (229M) |
| Agente Cultural (certidões) | `editais-culturais/agente-cultural-editais` | `Agente-Cultural/Editais/Edital_Cultura_2026/` (912K) |
| T.R.A.M.A. (documento/portfólio) | `documentos/documento-final-de-prints` | `Agente-Cultural/T.R.A.M.A/` (135M) |
| Subagente de Pesquisa | `arara/arara-pesquisa-tendencias` | (nada próprio; escreve em `Pexinxavel/Logs/`) |

## O lado ChromeOS TAMBEM guarda trabalho dela — `/mnt/shared/MyFiles`

O mapa deste arquivo cobre o `~` do Linux e **nao termina aí**. O que ela chama de "Meus arquivos" e
o lado ChromeOS, e so aparece no Linux depois de *Compartilhar com o Linux* no app Arquivos (ver a
skill `chromebook-linux`, secao "Acesso aos ficheiros do ChromeOS"). Medido em 16/10/2026:

```
/mnt/shared/MyFiles/      Meus arquivos do ChromeOS
  Camera/     584K
  Downloads/  373M    audios/videos da Bella, Portfolio PDF, prints, docx
  Hermes/     4,6M    <- 25 arquivos de fluxo: protocolos do ARARA, MAPA-MENTAL,
                         FLUXO-COMPLETO, comprovantes/pix, os 4 de QR do WhatsApp
                         e curator-x/ com 8 JPG. RECOLHIDOS para ~/Hermes em 16/10/2026
  .Trash/
```

Esses 25 arquivos ficaram de fora das reformas de 14 e 15/10 — e o pedido dela de recolher "morreu"
DUAS vezes, porque a busca varreu so o `~` e concluiu que nao havia nada solto (a FASE 2 do pedido
chegou a ser dada como "nao se aplica, 0 arquivos"). **Antes de afirmar que nao ha arquivo solto,
varrer `/mnt/shared/MyFiles`.**

Recolha que funcionou: `cp -a` → `md5sum` um por um → so entao `rm` a origem (nunca mover no escuro
dentro do mount compartilhado). E cruzar md5 contra `~/Hermes` ANTES de copiar: 5 dos 25 ja existiam
identicos (`CONFERIR-PXX-035.jpg` = `Curator.X/Medicoes/PXX-035-medidas.jpg`, idem 037 e
`exemplo-camiseta-medida.jpg` = `PXX-002-medidas.jpg`, mais o par MAPA-MENTAL/FLUXO-COMPLETO) — nao
recriar duplicata. Destino usado: `Relatorios/` (relatorio de compra + `visual-style.md`),
`A.R.A.R.A/Comprovantes/` (4), `A.R.A.R.A/Relatorios/` (5 protocolos), `A.R.A.R.A/Integracoes/`
(4 de QR) e `Curator.X/Medicoes/` (5 fotos). Achado que e decisao DELA: o `visual-style.md` da
origem nao era igual ao de `P.L.U.M.A/Templates/` — mesmo nome, conteudo diferente.

## `~/Arquivos-Linux/` — NÃO EXISTE MAIS (removido em 16/10/2026)

Até 16/10/2026 essa pasta era a camada intermediária da raiz de trabalho e, depois da migração,
continha **um único link** (`Hermes -> ~/Hermes`) mantido por compatibilidade. Decisão dela em
15/10/2026 (executada em 16/10/2026): atualizar os arquivos que ainda citavam o caminho antigo e
**apagar a pasta** (`rm -rf ~/Arquivos-Linux/`). Nada mais depende dela — nenhum cron, script,
systemd ou `.bashrc`.

## Árvore de `~/Hermes/` (3 níveis)

```
Downloads/                 vazia
Relatorios/                144K   10 relatorios antigos + skills-lock.json
Backups/                   548M   pre-migracao-2026-10-15 (323M), pexinxavel-backup-2026-09-25.tar.gz (226M),
                                   edicao-caminhos-2026-10-15, edicao-caminhos-caos-2026-10-15,
                                   edicao-caminhos-final-2026-10-15
Pexinxavel/                1.1G
  A.R.A.R.A/               118M   Entrada, Relatorios, Comprovantes, Referencias, Integracoes,
                                   Vendas/*, Repasses/* (as duas ultimas vazias)
  P.L.U.M.A/                76M   Conteudos, Processados, Publicados, Templates,
                                   Curadoria-Video/{Entrada,Transcricoes,Cortes} (vazias), Teste/
  Curator.X/                12M   Scripts 380K, Medicoes 12M
  Estoque/                  78M    38 pastas PXX-NNN
  Tools/                    815M   OpenMontage (803M), marketingskills, models
  Logs/                     6.1M
  relatorios/               2.4M   relatorios/curator-x -> Curator.X/Medicoes
  Logos/ Marca/ Vendidas/ Downloads/   VAZIAS
  LEIA-ME.txt
Agente-do-Caos/            229M
  Entrada/                  154M   videos-brutos, referencias, trilhas
  Curadoria-Video/          76M    {Entrada,Transcricoes,Cortes}
  Relatorios/ Templates/ Logs/ Processados/ Publicados/ Downloads/
Agente-Cultural/           136M
  T.R.A.M.A/                135M   PORTFOLIO/, _MEMORIA/ (OCR, render, mapa-imagens.json), prints_finais/
  Editais/                  912K   Edital_Cultura_2026 (7 certidoes), Edital_2026 (VAZIA, reservada)
  Documentos-Pessoais/      480K   RG, comprovante de residencia, certidao
  Downloads/                vazia
```

Numeração do acervo tem buracos: não existem PXX-003, 006, 022, 028, 033.

### Curadoria de vídeo — ferramentas compartilhadas, resultados separados

Regra dela: `yt-dlp`, `ffmpeg`, `whisper` (`~/.venvs/whisper`) e as skills de edição são
COMPARTILHADOS; o RESULTADO fica na pasta do fluxo dono.

- brechó / P.L.U.M.A.: `Pexinxavel/P.L.U.M.A/Curadoria-Video/{Entrada,Transcricoes,Cortes}`
- Caos: `Agente-do-Caos/Curadoria-Video/{Entrada,Transcricoes,Cortes}`

Nunca cruzar os dois.

## Atalhos que NÃO se apagam (referências antigas apontam para eles)

`~/pexinxavel/` = **camada de atalhos do brechó: 13 symlinks** (`entrada`, `conteudos`, `estoque`,
`integracoes`, `logs`, `marca`, `processados`, `publicados`, `referencias`, `relatorios`,
`templates`, `tools`, `vendidas`). Medido em 15/10/2026: ~650 referências no total, 380 em código.
**Apagar quebra o brechó.**

Atalhos soltos na home em 16/10/2026: **1** (`~/pexinxavel/`, com os 13 sub-atalhos). Ja REMOVIDOS:
`~/comprovantes`, `~/skills-lock.json`, `~/Downloads`, `~/agente-do-caos` e `~/edital`.
(este é link de arquivo, não de pasta). Mais `~/Hermes/Agente-Cultural/Editais/Edital_Cultura_2026`.

**Atalhos de SETOR na raiz de `~/Hermes/` (4, criados 16/10/2026 — so visual, nenhum arquivo movido):**

| atalho | aponta para | itens |
|---|---|---|
| `~/Hermes/A.R.A.R.A` | `Pexinxavel/A.R.A.R.A` | 7 |
| `~/Hermes/P.L.U.M.A` | `Pexinxavel/P.L.U.M.A` | 6 |
| `~/Hermes/Curator.X` | `Pexinxavel/Curator.X` | 2 |
| `~/Hermes/Estoque` | `Pexinxavel/Estoque` | 43 |

Pedido dela: *"quero ver as pastas dos agentes na raiz do Hermes"*. Atalho entrega o mesmo visual no
app com risco ZERO (nenhuma das ~280 referencias a `pexinxavel/` muda, reversivel com um `rm`).
⚠️ **Efeito colateral conhecido:** um `for d in ~/Hermes/*/` passa a ver 4 entradas a mais — nenhum
script faz isso hoje. **Mover as pastas de verdade** (A.R.A.R.A./P.L.U.M.A. para a raiz, Curator.X
para dentro de A.R.A.R.A.) e cirurgia: quebra os 13 atalhos de `~/pexinxavel/` (que apontam PARA
DENTRO de `Pexinxavel/`) e exige reescrever ~24 refs de codigo + ~368 de skills. E decisao DELA.

## Achados que surpreendem (e por isso estão aqui)

- **Curator.X TEM pasta de trabalho — mas não na home.** Não existe `~/curator-x` nem `~/curador`.
  São duas: `Pexinxavel/Curator.X/Scripts` (`medir.py`, `planilha.py`, `precificar.py`,
  `subir-sheets.py`, `scan-etiqueta.py`, `delegar-curator.sh`) e `Pexinxavel/Curator.X/Medicoes`
  (`PXX-NNN-medidas.jpg` por peça, pares de treino, `camisetas-medidas.csv`).
- **T.R.A.M.A. não tem pasta com esse nome na home** — o trabalho é `Agente-Cultural/T.R.A.M.A/`
  (135M, ~229 arquivos). Era o alvo do atalho `~/edital`, removido em 16/10/2026.
- **Agente Cultural (certidões) é só skill** (`editais-culturais/agente-cultural-editais`). O
  trabalho é `Agente-Cultural/Editais/Edital_Cultura_2026/` com 7 certidões numeradas.
- **Não existe nenhuma pasta "dossie"** no disco.
- **`Agente-Cultural/Editais/Edital_2026/` existe VAZIA** — reservada, não é o portfólio.
- **O `_MEMORIA/fluxo-agente-cultural.md` do Agente Cultural está dentro de `T.R.A.M.A/_MEMORIA/`**
  (foi junto quando `~/edital` virou T.R.A.M.A; o atalho foi removido em 16/10/2026). Lembrar disso ao
  mexer em qualquer um dos dois.
- **O `background curator` do Hermes reescreve estes docs** ao fim dos turnos. Ele é BLOQUEADO em
  skills escritas à mão (`atualizacao-arquitetura-agentes`) — essas só mudam por edição manual.
- **`~/teste-video/` e `Arquivos-Linux/Hermes/Teste-Video/` foram apagados** (14/10/2026, 35M).

## `~/` — primeiro nível (15/10/2026)

```
2.2G  hermes-agent/       codigo-fonte do Hermes (repo git, com .venv) — NAO SE MOVE
2.0G  Hermes/             RAIZ DO TRABALHO (6 setores)
1.6G  .local/             1.3G .cache/   1.1G .hermes/   1.1G .pluma-venv/
434M  .venvs/             394M .agent-browser/   341M .composio/   335M .config/
 44M  .cua-driver/        7.0M hermes-jev-skills/ (repo de terceiro; o binario jev e symlink) — NAO SE MOVE
704K  .npm/               416K .agents/   68K .pki/   52K pexinxavel/ (SO symlinks)
 40K  .optmem/            8K .hyperframes/   4.0K .cua-driver-rs/   0 Downloads/ (ATALHO p/ Hermes/Downloads)
```

Home inteira: **~14G**; disco de 20G com **6.2G livres** (69% usado). `~/.hermes/` também **não se move**.

## Receita de coleta (para repetir sem pensar)

```bash
cd ~ && du -sh */ | sort -h; du -sh .[a-zA-Z]*/ | sort -h
find ~ -mindepth 1 -maxdepth 2 -type d | sort
du -h --max-depth=3 ~/Hermes/Pexinxavel | sort -k2
# busca por nome de agente (contorno do colapso de saida):
{ echo "### CURATOR"; find ~ -type d -iname '*curator*'; \
  echo "### TRAMA"; find ~ -type d -iname '*trama*'; } > /tmp/blocos.txt 2>&1
# read_file /tmp/blocos.txt
# conferir todos os symlinks de uma vez:
find ~ -maxdepth 3 -type l -not -path '*/.hermes/*' -printf '%p -> %l\n'
# confirmar que a camada antiga nao voltou:
ls -d ~/Arquivos-Linux 2>/dev/null || echo "NAO EXISTE"
```

Saída longa de `find`/`du` no terminal volta COMPRIMIDA pelo plugin de saída
(`... (N filtered) [+N hidden: rtk recall <hash>]`) — sempre mandar para arquivo e ler o arquivo.
