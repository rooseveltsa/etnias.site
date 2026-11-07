# Kit IAra — etnias (iara-v1.0)

Sistema completo de producao de conteudo do etnias.site para instalar em um
Hermes novo (o "junior"). Gerado pelo SEMEA na Fase 15 (v4).

## Conteudo

    skills/          19 skills iara-* — o fluxo inteiro: triagem, referencia,
                     adapter, aprovacao, log de publicacao, metrica, calendario,
                     biblioteca, pesquisa, radar, marketing, revisao, atendimento,
                     escuta, relatorio, misto, solicitacao, institucional e
                     iara-design-etnias (design oficial, com references/)
    skills-base/     8 skills de producao que as iara-* chamam:
                     cartazes-estaticos (F14), artes-de-campanha-em-serie (F15),
                     iara-design-etnias (F16), video-volito-com-narracao (F19),
                     montagem-final-de-video-em-camadas (F20),
                     legenda-cinetica-volito (F21), prova-visual-de-render (F23),
                     relatorios-ascii-puro (F24)
    scripts/         kit-design-etnias.py e kit-design-etnias-cores.py
                     (geradores das 4 folhas de cor e dos carrosseis)
    design-kit/      design oficial aprovado: DESIGN.md, 4 kits de cor,
                     carrossel Opy (4 cards), carrossel Karuan (4 cards),
                     2 videos do kit
    assets/          logos oficiais (opy, lockup, casa, arco, bandeira)
    data/            17 JSONs de estado + fontes/, clipping/, escuta/
    config/          config.json (storage local, version 1)

## Como instalar

1. Copiar `skills/*` para `~/.hermes/skills/`.
2. Copiar `skills-base/*` para `~/.hermes/skills/` (mantendo a categoria se
   quiser: creative/, peca-a-peca/, video/ — o nome da skill e o que importa).
3. Copiar `scripts/*` para `~/.hermes/scripts/`.
4. Criar `~/.hermes/iara-data/` e copiar `data/*` para dentro; o
   `data/config.json` vai para a raiz do iara-data.
5. Copiar `design-kit/` para `~/.hermes/profiles/<perfil>/design-kit/etnias/`
   e `assets/*` para `~/.hermes/assets/`.
6. Conferir integridade: `sha256sum -c CHECKSUMS` dentro da pasta do kit.

## Avisos (ler antes de publicar)

1. `config.json` esta com `storage: "local"`. Depois de instalar o banco,
   trocar para `"supabase"`.
2. Instalar as plataformas conforme o documento de implantacao.
3. Conectar Instagram e LinkedIn — sem isso a publicacao falha.
4. Design kit vai completo (9,3 MB). Nenhum modelo de voz clonada acompanha o
   kit: a voz da Karuan exige autorizacao explicita dela. Se precisar, gerar
   localmente com o material proprio.
5. Existem 8 pendencias deferidas do PEC 18.2 que NAO estao resolvidas:
   auto-aprovacao, timeout, rate limit, hash chain, exit codes, campo Fonte,
   rastro institucional e --peca-id.
6. `clipping/` vai com 5 arquivos: o `ig-3.txt` foi removido porque o print que
   ele referenciava estava com 0 bytes. Recriar o exemplo depois.
7. A skill `iara-triagem` já aponta o design oficial do etnias (secao 4).

## O que NAO vai no kit

Credenciais, `.env`, `state.db`, memoria/historico de sessao, tokens, chaves de
API, modelos de voz (`.pth`/`.safetensors`) e a copia duplicada da skill de
design do profile `iara` (idêntica em md5, descartada).

## Nota sobre duas copias da skill de design

`skills-base/iara-design-etnias` e a MESMA skill de `skills/iara-design-etnias`
(ela cobre o F16, carrossel). Ao instalar, copiar UMA vez so: as duas pastas tem
conteudo identico e se sobreporiam em `~/.hermes/skills/`.
