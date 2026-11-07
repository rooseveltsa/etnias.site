# Fichas de noticia (dossie) + PDF com links clicaveis e versao editavel

Formato que ela pediu em 31/10/2026 para organizar noticias antes de virar arte.
Serve de base para a serie de artes.

## Campo de cada ficha

```
- Povo:
- Cidade/Estado:
- Ocorrido:
- Data:
- referencias : link(s) clicavel(a)
```

Acrescentar sempre, no alto do documento, a **observacao sobre quantidade de
fontes** e um selo por ficha:

- `[P]` fonte primaria (nota oficial, material original)
- `[2+]` dois ou mais veiculos independentes
- `[1]` fonte unica, usar sempre com "segundo..."
- `[~]` contestado / desmentido (nao publicar como fato)

Placar honesto no cabecalho ("21 afirmacoes centrais: 13 confirmadas, 7 com fonte
unica, 1 contestada"). Nao inflar numero de fontes.

## PDF com links de verdade (nao texto solto)

- montar HTML com `<a href="url">rotulo</a>` e imprimir com Chromium headless:
  `chromium --headless=new --disable-gpu --no-sandbox
  --user-data-dir=/tmp/chrome-pdf --no-pdf-header-footer --print-to-pdf=saida.pdf file:///...`
- CSS: `@page { size: A4; margin: 14mm }`, `word-break: break-word` nas URLs,
  `break-inside: avoid` nos cartoes.
- conferir se os links entraram: procurar `/URI` no PDF (cada URL unica vira uma
  anotacao) e checar visualmente o rodape com URL longa.

## Versao editavel (Word/Excel)

- `.docx` com `python-docx` (instalar em `~/.pluma-venv`). Hiperlink nao existe
  na API: montar na mao com
  `part.relate_to(url, RELATIONSHIP_TYPE.HYPERLINK, is_external=True)` e um
  elemento `w:hyperlink` com `r:id`, cor e sublinhado em `rPr`.
  - `relate_to` DEDUPLICA URL repetida: o numero de relacoes e de URLs unicas,
    nao de links (nao confundir com perda de link).
  - `p.runs` fica vazio depois de inserir hyperlink (hiperlink nao e run).
- `.xlsx` com `openpyxl`: uma linha por caso, colunas = os campos da ficha,
  filtro automatico e aba "Legenda".

## Erros que ja custaram tempo

- `image_generate` bate em 402 do OpenRouter quando nao ha US$ 1,00 de saldo.
  Nao forcar: avisar e desenhar em vetor (PIL) ou usar o emoji tingido.
- `pdftotext`/`pymupdf` podem nao existir; `read_file` le `.docx`/`.xlsx`
  direto, e o PDF sai do Chromium.
- Texto saido do PDF nao e pesquisavel em `strings`: as fontes usam subset com
  indice de glifo. Validar por contagem de `/URI` e por render, nao por grep.
