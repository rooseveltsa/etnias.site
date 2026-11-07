# Dossie de FICHAS por caso + entrega em PDF, DOCX e XLSX

Origem: 29/10/2026, depois da varredura sobre ataques a povos indigenas pos-2o turno e da
checagem de veracidade. Tres pedidos dela, nesta ordem:

1. *"mande em outro formato de arquivo, PDF"* -> PDF.
2. *"Refaca o documento, coloque observacao de quantidade de fontes e classifique cada
   noticia assim: Povo / Cidade-Estado / Ocorrido / Data / referencias: link(s)
   clicavel(a)"* -> **dossie de fichas**, com links que abrem no PDF.
3. *"me de este arquivo em versao editavel"* -> **.docx** (documento) e **.xlsx** (planilha).

## 1. O formato FICHA (o que ela pediu, ao pe da letra)

Uma ficha por caso, sempre nesta ordem de campos:

```
[NN] TITULO DO CASO                        [N fontes]
Povo:              <povo / comunidade / aldeia>
Cidade/Estado:     <municipio / UF>
Ocorrido:          <2 a 5 linhas, so o fato; versao divergente entra nomeada>
Data:              <data ou periodo>
Referencias:       <fonte primaria, se houver> + lista de links clicaveis
```

Regras de conteudo que vieram junto:

- **Selo com o numero de fontes em cada ficha**, e selo verde separado quando existe
  **fonte primaria** (nota oficial, material original, reportagem que teve acesso ao audio).
- **Nota no topo** explicando a escala usada e o que fazer com cada nivel:
  `4+ fontes -> pode publicar` / `2-3 -> confirmado, cite uma` / `1 -> sempre com
  "segundo ..."` / `desmentido ou enganoso -> nao publicar como fato`.
- **Placar honesto** no topo: quantas fichas, quantas confirmadas, quantas de fonte unica,
  quantas contestadas. Nao arredondar para "esta tudo certo".
- Caso desmentido **entra na lista** (ex.: "CASO DESMENTIDO: NAO FOI ATAQUE A INDIGENAS"),
  nao e omitido — e o que protege ela de repostar desinformacao.
- Caso que ela ja declarou conhecer fica fora da serie e isso e dito na entrega.

## 2. PDF com LINK CLICAVEL (o que o `<pre>` do ASCII nao faz)

O `scripts/txt-para-pdf.sh` (relatorio ASCII) envolve tudo em `<pre>` — otimo para texto
corrido, **sem link clicavel**. Para dossie de fichas, gerar HTML estruturado com `<a href>`;
o Chromium, ao imprimir, cria as anotacoes `/URI` e o link abre no leitor.

```bash
chromium --headless=new --disable-gpu --no-sandbox --no-pdf-header-footer \
  --user-data-dir=/tmp/chrome-pdf --print-to-pdf=/tmp/fichas.pdf \
  file:///tmp/fichas-indigenas.html
```

CSS que funcionou (A4, card por ficha, sem quebrar card no meio da pagina):

```css
@page { size: A4; margin: 14mm 13mm; }
.card { border: 1px solid #e0d4c6; border-left: 5px solid #b87333; border-radius: 3px;
        padding: 3.5mm 4mm; margin-bottom: 4mm; page-break-inside: avoid; }
dl { display: grid; grid-template-columns: 34mm 1fr; row-gap: 1.2mm; }
dt { font-weight: bold; text-transform: uppercase; padding-right: 3mm; }  /* 30mm cola no valor */
a  { color: #0b4f8a; text-decoration: underline; word-break: break-all; }  /* URL longa quebra */
```

- `word-break: break-all` no `a` e obrigatorio: as URLs do MPF/GZH passam de 150 caracteres e
  sem isso estouram a margem direita.
- `grid-template-columns: 30mm` deixa "CIDADE/ESTADO" encostado no valor — usar 34mm + `padding-right`.

### Verificacao (o teste obvio nao funciona)

`grep`/busca de URL **dentro** do PDF entregue nao serve: o Chromium grava o texto com
subconjunto de fonte (glifos), entao `mpf.mp.br` nao aparece em claro nos streams. Verificar por:

```python
import re
d = open("/tmp/fichas.pdf","rb").read()
print("paginas:", d.count(b"/Type /Page") - d.count(b"/Type /Pages"))
print("links:", len(re.findall(rb"/URI", d)))     # 25 = 25 URLs distintas
```

E para o layout (URL longa quebrando dentro da margem): gerar `--screenshot` do HTML e olhar
com visao. Ja feito: 5 paginas, 78 `/URI`, URLs quebrando certo.

## 3. DOCX editavel (python-docx) — com link de verdade

Sem python-docx na maquina: `~/.pluma-venv/bin/pip install python-docx openpyxl`
(1.2.0 / 3.1.5 instalados 29/10/2026).

`add_hyperlink` nao existe na lib — montar no XML:

```python
from docx.opc.constants import RELATIONSHIP_TYPE as RT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

def hyperlink(paragrafo, url, texto):
    r_id = paragrafo.part.relate_to(url, RT.HYPERLINK, is_external=True)
    h = OxmlElement("w:hyperlink"); h.set(qn("r:id"), r_id)
    r = OxmlElement("w:r"); rPr = OxmlElement("w:rPr")
    cor = OxmlElement("w:color"); cor.set(qn("w:val"), "0B4F8A"); rPr.append(cor)
    sub = OxmlElement("w:u");     sub.set(qn("w:val"), "single"); rPr.append(sub)
    tam = OxmlElement("w:sz");    tam.set(qn("w:val"), "16");     rPr.append(tam)
    r.append(rPr)
    t = OxmlElement("w:t"); t.text = texto; r.append(t)
    h.append(r); paragrafo._p.append(h)
```

Pitfalls medidos:

- **`paragrafo.runs[-1]` depois de `add_hyperlink` estoura `IndexError`**: o hyperlink nao e
  `run`, e a lista continua vazia. O tamanho da fonte vai no `w:sz` dentro do `rPr` (acima).
- **`relate_to` deduplica URL repetida.** Em 14 fichas com 39 referencias saíram **25**
  relacionamentos externos (as URLs repetidas compartilham `r_id`) — conferir contando
  `TargetMode="External"` em `word/_rels/document.xml.rels` da para provar que os links estao
  no arquivo, mas nao espere o numero da soma.
- Uma `doc.add_table(rows=5, cols=2)` por ficha (campos na coluna 1, `shade` `F7EFE5`) fica
  editavel de verdade no Word/Docs; `Nota` do topo em tabela 1x1 com `w:shd` `FDF3E8`.

## 4. XLSX (quando ela vai mexer/ampliar)

`openpyxl`, uma linha por ficha, colunas:
`No | Povo | Cidade/Estado | Ocorrido | Data | Fontes | Fonte primaria | Referencias`
(Referencias = `Rotulo: URL` uma por linha, `wrap_text`). Extras que ela usa:
`freeze_panes="A2"`, `auto_filter.ref` na tabela toda e uma aba **Legenda** com a escala de
fontes — a mesma do topo do PDF.

## 5. Scripts re-executaveis desta sessao

- `~/.hermes/scripts/dossie-fichas-indigenas.py` — dados (fichas + dicionario de URLs) e
  geracao do `.txt` ASCII + HTML dos cards.
- `~/.hermes/scripts/dossie-fichas-editavel.py` — importa os dados do anterior
  (`importlib.util.spec_from_file_location`) e gera `.docx` + `.xlsx`. Assim a fonte de dados
  fica em **um** lugar e as tres saidas nunca divergem.

## 6. Ordem de entrega que ela aceitou

1. PDF (para ler e circular).
2. .docx (para editar o documento).
3. .xlsx (para editar/ampliar em tabela).

Os tres no mesmo caminho base (`VARREDURA-<tema>-FICHAS-<AAAA-MM-DD>.{pdf,docx,xlsx}`) +
copias em `/mnt/shared/MyFiles/Hermes/`, e no chat a explicacao de uma linha do que cada
formato serve. O `.txt` ASCII continua existindo como arquivo para colar em outra IA.
