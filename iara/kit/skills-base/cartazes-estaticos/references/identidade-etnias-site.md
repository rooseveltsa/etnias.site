# Identidade etnias.site (rede social indigena) — paleta, logo e cards aprovados

Fonte da verdade da cor: PDF `Design_de_Interface_-_Etnias.pdf` (paginas renderizadas com
pymupdf). Nao inventar tom: extrair do documento.

## Paleta

| papel | hex | uso |
|---|---|---|
| fundo | `#120D08` | dominante escuro |
| secundaria | `#2E251B` | paineis, blocos, base de texto |
| apoio / simbolo | `#C58B56` | Opy, fios, titulos de apoio |
| acao | `#B84A27` | CTA, etiquetas, selos |

Fonte do documento: **Archivo Black** (`~/.fonts/ArchivoBlack-Regular.ttf`).
Apoio: Space Grotesk (labels com `ls` 0.2+) e Inter (corpo).

## Simbolo

A **Opy** (casa de reza Guarani): telhado com chevrons e arco da porta. Assets oficiais:

- `~/.hermes/assets/opy-logo-correto.png` — 900x454, cobre sobre transparente (extraido do
  JPG que ela mandou, alfa pela luminancia). **AR = 1.9824**. Este e o certo.
- `~/.hermes/assets/etnias-logo-completo.png` — 598x88, casa + "etnias.site" (cabecalho).
- `~/.hermes/assets/opy-grande.png` — 487x428 (casa isolada, recorte limpo do PDF).

Regra dura: **logo de marca e arquivo, nunca redesenho em codigo.** Ela rejeitou duas vezes o
simbolo desenhado em SVG, inclusive no video.

## Pecas produzidas e scripts

- `~/.hermes/scripts/post-etnias-opy.py` — carrossel base de 4 cards (aprovado): 1 capa com a
  Opy grande, 2 o que e a Opy, 3 por que e o simbolo, 4 chamada "Ocupe espaco na comunidade".
- `post-etnias-opy-estilos.py` — 3 estilos x 4 cards (blocos / editorial / tipografico).
- `post-etnias-opy-cores.py` — um design por cor de destaque (serifa+cobre, condensada+
  terracota, geometrica+secundaria).
- `post-etnias-opy-mix.py` — 2 versoes (cobre no comando / terracota no comando), **cada card
  com uma diagramacao diferente**.
- `post-etnias-opy-selo.py` — design "Selo": faixa terracota sangrando na direita com numero
  vazado, titulo terracota, Opy pequena no canto.
- `post-etnias-opy-painel.py` — design "Painel", o mais reaproveitado: fundo na cor dominante
  (3 versoes: `#2E251B`, `#C58B56`, `#B84A27`) + painel escuro arredondado com o corpo.
- `post-etnias-karuan.py` — carrossel de 4 paginas sobre o criador, capa com foto em
  **duotone** (sombra `#120D08` -> luz `#C58B56`).

Saida em `~/Hermes/Agente-do-Caos/artes/<slug>-<data>/`.

## Conteudo factual (Karuã Tataenday, criador)

Fonte: perfil dele no proprio site (`https://etnias.site/Karuan`), lido direto com curl +
strip de HTML (o Instagram exige login; o site entrega a bio completa).

- Fundador do Etnias.site, rede social brasileira criada e desenvolvida por indigenas.
- Tecnologo e desenvolvedor indigena; formacao em Gestao de Tecnologia da Informacao e em
  Governanca de IA e Auditoria Algoritmica.
- Governanca indigena de dados, soberania digital, IA.
- Tambem assina **Tupiniquim.Store** e **esydelivery**.
- Instagram: `@karuan_tataneady`.
- Argumento central dele: povos indigenas nao devem ser apenas representados pela tecnologia,
  mas protagonistas na criacao, na governanca e no futuro digital.

## Capa com foto da pessoa (duotone)

Foto dela veio 1017x1339. Recorte para a proporcao do quadro (corte pelo centro-alto, rosto),
`ImageOps` em L, normalizar `(g - 0.06) / 0.88`, e mapear sombra->`#120D08`, luz->`#C58B56`.
Por cima, degrade para o fundo na parte de baixo (mascara com `t^1.2` a partir de 55% da
altura) para o titulo assentar sem caixa. Marca do topo passa a ser desenhada em `#120D08`
(escura) porque o fundo da foto e claro no cobre.
