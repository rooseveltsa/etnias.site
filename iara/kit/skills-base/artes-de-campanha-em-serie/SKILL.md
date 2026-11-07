---
name: artes-de-campanha-em-serie
description: "Produzir SERIE de artes de campanha/noticia 1080x1350 em PIL com fonte propria, paleta ajustavel e elemento decorativo repetido (moldura, bandeira, flechas), e deixar a dona acompanhar cada versao na tela. Carregar quando ela pedir 'essa estetica', 'refaca as artes', arte de noticia/ataque, troca de fonte (Komorebi/Italiana), ajuste de tom do fundo ('5 tons mais claro', 'escureca 2'), quantidade ou direcao de elemento nos cantos, 'faz uma arte para cada ato' (lote a partir de lista/PDF) ou 'abra para eu ver como esta ficando'. Arte politica/editorial, nao e do brecho."
version: 1.0.0
author: Hermes (curadoria automatica)
enabled: true
metadata:
  hermes:
    tags: [artes, campanha, politica, pil, komorebi, tipografia, 1080x1350, cobre, iteracao]
    related_skills: [agente-do-caos, relatorios-ascii-puro]
---

# Artes de campanha em serie (1080x1350, PIL)

Classe de trabalho: uma arte-base aprovada, replicada em N variacoes (noticia,
idioma, peca), com ajustes finos pedidos em degraus ("mais claro", "menor",
"seta pra fora"). Dona: Vytorya. Texto e visual em pt-BR.

## 1. Regra de ouro da iteracao

- **Uma versao por vez, sempre em cima da ULTIMA aprovada.** Ela ajusta em
  degraus pequenos e cobra o resultado exato ("escureca 2 tons" = voltar 2 passos,
  nao reescalar do zero).
- Nunca responder com duas versoes concorrentes ("A e B") quando ela ja escolheu
  um caminho. So a FINAL.
- Se pedir teste, **nao escrever "teste" na arte** e nao mandar print de bastidor.
- Antes de mandar, confira OLHANDO a imagem pronta e com zoom por crop nas areas
  criticas (acento, canto, rodape). Miniatura esconde acento invisivel e seta
  apontando para o lado errado.

## 2. Anatomia minima da arte de noticia

1. moldura externa (cobre, 3px, ~24px da borda) + linha interna mais escura
2. bandeira do Brasil centralizada no topo
3. titulo na fonte display, ate 3 linhas, quebra por palavra com a metrica real
4. divisor decorativo repetido ate a largura alvo
5. local (linha curta) + corpo da noticia (2-3 linhas)
6. rodape: SO as tags pedidas, centralizadas, no ponto mais baixo

## 3. Paleta e a regra dos "N tons"

Implementacao correta (HLS, mantendo o matiz):

```python
import colorsys

def clarear(cor, passos=5, passo=0.02):
    r, g, b = [x / 255 for x in cor]
    h, l, s = colorsys.rgb_to_hls(r, g, b)
    return tuple(int(round(v * 255)) for v in
                 colorsys.hls_to_rgb(h, min(0.92, l + passos * passo), s))
```

- **Paleta FECHADA em 02/11/2026** (ela mandou a arte-modelo e disse *"estes sao os tons
  certos"*): fundo marrom `#241A11` (36,26,17), cobre `#B97232` (185,114,50), laranja
  `#FF6A13`, branco quente `#F4F0E7`, cobre claro `#D69E61`.
  Os antigos `#2C1E15`, `#B87333` e `#D69E60` estao **aposentados** — nao usar.
- `#17100B` segue so como base historica do `clarear()` (as artes de 31/10 usavam
  `clarear((23,16,11), passos=2)`, que dava o #2C1E15 hoje aposentado). Para arte nova,
  **comecar do #241A11 e nao clarear**.

## 4. Fonte custom: testar o ARQUIVO, nao o nome

- **Komorebi** (`~/.fonts/komorebi/Komorebi-PersonalUse.otf`): licenca
  **personal use** (comercial exige licenca paga). O cmap manda `Á -> A`, ou seja,
  nao ha glifo acentuado; e nao ha `@ # ? ! · , . -`.
  -> usar `~/.hermes/scripts/komorebi_acentos.py`, que desenha a base e cola o
  acento real recortado da DejaVu Sans Bold (til 1.25x mais largo), com
  pontuacao caindo para DejaVu.
- **Italiana** (SIL OFL, livre) e **Archivo Black** como alternativas.
- Pontuacao do titulo (`? ! : ; , .`) cai para a DejaVu: desenhar a **0.95 do corpo do
  titulo**, por baseline (`anchor="ls"`), mantendo `º`/`ª` em 0.55 — senao ela reclama que
  o ponto esta minusculo. Detalhe e codigo em `render-de-texto-em-artes` secao 2.1.
- Conferir com `fontTools`: `TTFont(...).getBestCmap()` devolve o NOME do glifo.
  Se `Á` mapeia para `A`, o acento nao existe no arquivo.

## 5. Elemento decorativo repetido nos cantos

Caso medido: emoji de arco e flecha tingido de cobre.

```python
from PIL import ImageOps
ico = Image.open(EMOJI).convert("RGBA")
alpha = ico.split()[-1]
tingido = ImageOps.colorize(ico.convert("L"), black=(70, 42, 20),
                            mid=COBRE, white=(255, 216, 165))
tingido.putalpha(alpha)
```

- **Descobrir para onde o elemento ja aponta antes de transformar.** O emoji do
  Twemoji aponta para CIMA-ESQUERDA; espelhar errado faz a seta apontar para
  DENTRO da arte (erro real, corrigido por ela).
- Mapa para "apontar para fora": sup. esq. = nada; sup. dir. = FLIP_H;
  inf. esq. = FLIP_V; inf. dir. = FLIP_H + FLIP_V.
- "Dentro da linha de borda": o centro do icone fica a `34 + 8 + TAM/2` da borda.
  Tamanho foi pedido em degraus (116 -> 92 -> **74 px** é o aprovado em 31/10/2026);
  ela reclama tanto de "muito afastado da borda" quanto de elemento cortado pela moldura —
  perto da linha, sem encostar.
- Poucos e maiores > muitos e miudos. Ela reclama de poluicao visual.

## 6. Conteudo: checar antes de cravar

Arte de noticia carrega afirmacao. Antes de escrever o corpo, confira a fonte e o
que esta contestado. Motivacao politica de conflito costuma ser versao de
testemunha; se a PF nao concluiu, o fato duro e o numero (ex. "3 mortos em um
dia, 13/10"), nao a acusacao. Texto que crava motivo entrega o flanco para a
resposta oficial.

## 7. Ela quer VER enquanto sai (preferencia dela)

Ela escolheu acompanhar na TELA, nao por print no WhatsApp:

1. HTML que recarrega a imagem a cada 2s (`img.src = CAMINHO + "?t=" + Date.now()`)
   salvo em `/tmp/viewer/index.html`.
2. Janela isolada, com env explicito (sem isso o processo morre calado):

```
setsid nohup env DISPLAY=:0 WAYLAND_DISPLAY=wayland-0 \
  XDG_RUNTIME_DIR=/run/user/$(id -u) \
  chromium --app=file:///tmp/viewer/index.html \
  --user-data-dir=/tmp/chrome-viewer2 --window-size=780,1010 &
```

3. Cada render novo aparece sozinho; avisar que a janela atualiza.
4. Limites do Crostini/Wayland: `xdotool` nao lista janela Wayland,
   `import -window root` falha e `cua-driver capture` volta 0x0. Verificar por
   `pgrep -c -f chrome-viewer` e perguntar se a janela apareceu.

## 8. Apoio

- `templates/gerar-artes-em-lote.py` — modelo do loop "uma arte por item": listar os
  dicts (`slug/titulo/local/povo/data/detalhe/tags`), chamar o `gerar-card.py` em serie.
- `references/fichas-de-noticia.md` — formato de ficha de noticia (Povo /
  Cidade-Estado / Ocorrido / Data / referencias) com selo de quantidade de
  fontes, PDF com links clicaveis e versao editavel (.docx/.xlsx).

## 8.1 Card parametrizado por JSON (receita aprovada em 31/10/2026)

Quando a estetica ja esta aprovada, o desenho vira **fixo** e so o conteudo varia:

- Gerador: `~/Hermes/Pexinxavel/P.L.U.M.A/Templates/pessoal-identidade/gerar-card.py`
  (recebe um JSON com `titulo`, `local`, `povo`, `data`, `detalhe`, `tags`; aceita
  caminho de saida como 2o argumento). Spec em `design-pessoal-cobre.md` na mesma pasta.
- Valores aprovados (nao alterar sem pedido): fundo **`#241A11`** (paleta fechada em
  02/11/2026 — o `#2C1E15` do `clarear((23,16,11), passos=2)` esta aposentado);
  titulo Komorebi 126 px laranja `#FF6A13` com sombra preta offset **+6/+7** e desfoque 2;
  faixa do titulo em `y=212`, entrelinha `corpo*1.24`; local DejaVu 29 branco; `povo` e `data`
  DejaVu 26 cobre claro; `detalhe` DejaVu 31 largura 862; tags DejaVu 28 no rodape
  (`y = A - 62 - n*41`); 4 arcos de 74 px com centro a `34+8+TAM/2` da borda.
- **Divisor que cabe inteiro**: montar repetindo o motivo enquanto couber em
  `L - 2*(34+40)` — nunca repetir "ate passar de 600" (a versao antiga estourava a moldura
  e cortava no canto direito).

### Lote: uma arte por ato/item de uma lista
Pedido tipico: "faz uma arte para cada ato" a partir de um PDF/lista de mobilizacoes.
1. Ler o PDF com `pymupdf` no `~/.pluma-venv` (`import pymupdf`, **nao** `fitz`) —
   extrai cidade, praca, hora, tema e quem convoca.
2. Montar uma lista de dicts (`slug`, `titulo`, `local`, `povo`, `data`, `detalhe`, `tags`)
   e chamar o `gerar-card.py` em loop — modelo: `~/.hermes/scripts/artes-atos-nov-2026.py`.
3. Mapa de campos para card de ATO: `titulo` = tema em caixa alta; `local` = "CIDADE — UF · PRAÇA";
   `povo` = linha do meio (tema curto); `data` = "DOMINGO 01/11/2026 · 9H";
   `detalhe` = "Convocação: @fulano, @ciclano".
4. Tags por tipo: indigena -> `#ProtejamOsPovosIndígenas #DemarcaçãoJá`;
   vitoria de Lula/antifascista -> `#AtoPelaDemocracia #ProtejamOsPovosIndígenas`.
5. Item que a lista marca como "informacoes nao encontradas" **nao vira arte**:
   entregar o lote e listar os nao confirmados a parte.

## 8.2 Linha de convite em laranja (campo `convite`) — 31/10/2026

Depois do lote pronto ela pediu para acrescentar uma chamada em laranja abaixo dos @s
("VENHA PARA RUA", "JUNTE-SE NA DEFESA AOS POVOS INDÍGENAS"). Virou campo do JSON:
`convite: ["linha 1", "linha 2"]`.

- **NUNCA em negrito** (ordem dela: *"não escreva em negrito"*). DejaVu Sans normal, 32 px,
  laranja `#FF6A13`, centralizado.
- Quebra automatica: juntar as linhas do campo e refazer com `quebrar()` em largura 900,
  reduzindo 1 pt ate caber em **2 linhas**. Frase longa ("VENHA PARA AS RUAS E JUNTE-SE NA
  DEFESA DOS POVOS INDÍGENAS!") fecha em 2 linhas sem cortar.
- **Ancorar ACIMA das tags**: `yc = max(fim_do_detalhe + 26, tags_top - 26 - altura)`.
  Com `min()` o card fica com um vazio grande no meio, porque a frase sobe e as tags
  continuam no rodape. Com `max()` a chamada vira um bloco no pé, equilibrado.
- Com `convite` presente, o `detalhe` desce para 29 px / entrelinha 42 — senao os blocos
  batem na nota ou nas tags.
- Troca por grupo de card e normal: num lote ela manda uma frase para os cards de "defesa dos
  povos indigenas" e outra para os de vitoria/incendio/antifascista. Aplicar so nos cards
  nomeados e avisar que os outros ficaram no padrao anterior.

## 8.3 Card de aviso / convite (fora do padrao noticia-ato)

Pedidos como *"faça um: QUER SOMAR COM OS POVOS INDÍGENAS? / SE LIGA NOS PRÓXIMOS ATOS!"*
mais blocos de texto nao entram no `gerar-card.py` (nao tem local/povo/data). Script proprio,
`~/.hermes/scripts/card-quer-somar.py`, reaproveitando as pecas: moldura, bandeira, titulo
Komorebi com sombra, divisor, nota pequena no rodape.

- **Elemento decorativo pode virar marcador de bloco**: ela pediu *"tire as flechas dos cantos
  e coloque no lugar das estrelas"* — mesmo emoji de arco, 46 px, alinhado ao topo da
  primeira linha do bloco, com o texto recuado para a direita dele.
- Texto dos blocos em caixa mista (como ela escreve), 27 px, entrelinha 36-37; nao forcar
  caixa alta em paragrafo longo.
- Nota de rodape em 23 px cobre claro, largura ~700 px para nao encostar nos arcos dos cantos.
- Lista de atos (estado/cidade/praca/hora) tambem tem script proprio:
  `~/.hermes/scripts/card-lista-atos.py` — UF em bold cobre, resto em branco quente,
  cabecalho de dia em laranja.

### Regra de escopo do refazer
Quando ela diz **"não refaça os demais"**, regenerar SO os cards nomeados. Se o ajuste e de
layout (ancorar o convite, trocar o marcador), avisar que os outros ficaram no padrao
anterior e oferecer alinhar depois — nao alinhar por conta propria.

## 9. Serie de CHAMADO PUBLICO por organizacao (02/11/2026)

Variante da serie: uma arte por organizacao, cobrando posicionamento publico sobre um tema
(queimadas, garimpo ilegal, povos indigenas). Receita de layout, ordem dos elementos,
acentos extras (ñ/Ø/Å/Ë) e a fonte serifada das hashtags estao em
`render-de-texto-em-artes` secao 6.2 — nao duplicar aqui.

Regras de escopo que ela deu:
- **Organizacao brasileira: so UMA, como exemplo** do texto que vai nas demais. Nao gerar o
  lote nacional inteiro.
- Cada arte no **idioma do pais de origem** da organizacao (EUA/UK ingles, Colombia/Equador/
  Mexico espanhol, Noruega noruegues, Holanda holandes, Suica frances), com pais, titulo,
  corpo, CTA, nota e rodape traduzidos.
- Handle oficial nao confirmado → **omitir a linha**, nunca inventar @.
- Sem logo da organizacao na arte (uso de marca).

### Estrategia de publicacao da serie (o que ela pediu no relatorio)

Quando ela pede "estrategia de postagens", entregar junto com o relatorio dos cards:
- **Ritmo**: 1 arte por dia (ciclo de ~3 semanas para 22) ou 2/dia no maximo. Nunca as 22 de
  uma vez — rajada corta alcance e a serie perde forca.
- **Ordem por peso**: primeiro as que atuam direto na Amazonia, depois as grandes globais,
  depois as de advocacia, por ultimo as financiadoras.
- **Formato**: feed 1080x1350 sem corte + story no mesmo dia com sticker de link para o site
  da organizacao; marcar a organizacao na arte, na legenda e no story.
- **Legenda**: uma frase no idioma da arte, traducao em portugues no primeiro comentario, e
  as duas hashtags fixas (`#ProtejamOsPovosIndígenas`, `#DemarcaçãoJá`).
- **Horario**: 8h ou 19h30 (BRT), terca e quinta.
- **Se a organizacao responder**, a resposta vale mais que o chamado: capturar e virar um
  segundo post.

Bloco do relatorio que ela cobrou: o que foi feito, os cards (estrutura de cada arte e
idiomas), proposito, estrategia de postagem, tags e pendencias. Tudo em ASCII puro.

## 9.2 Carrossel de OUTRA marca no mesmo motor (caso etnias.site, 03/11/2026)

Mesma classe de trabalho (serie de cards em PIL, identidade fixa, ajuste em degraus), marca
diferente. **Nao misturar com a paleta pessoal** — o etnias tem paleta propria, tirada do
documento "Design de Interface - Etnias":

    fundo  #120D08   secundaria #2E251B   cobre/Opy #C58B56   acao #B84A27
    fonte  Archivo Black (~/.fonts/ArchivoBlack-Regular.ttf); Inter e Space Grotesk no video

Assets: `~/.hermes/assets/etnias-logo-completo.png` (casa + "etnias.site", 598x88),
`opy-etnias.png`, `opy-grande.png`, `opy-logo-correto.png` (900x454, cobre sobre transparente).
Geradores: `post-etnias-opy.py` (4 cards base), `-estilos.py`, `-cores.py`, `-mix.py`,
`-selo.py`, `-painel.py`, `post-etnias-karuan.py` (apresentacao com foto).

Regras que ela cobrou, e que valem para qualquer serie de carrossel:

- **"Use esse design"** = a ultima versao aprovada vira o sistema dos proximos posts do mesmo
  assunto. Continuar dela, nao reinventar diagramacao.
- **Variantes por cor dominante**: mesma diagramacao, troca SO a cor que domina
  (#120D08 → #2E251B → #C58B56 → #B84A27), uma versao por cor. Ela pede isso em sequencia
  depois de aprovar o layout.
- **"Cada card com um design diferente, mesmo carrossel"**: dentro do MESMO carrossel variar a
  diagramacao por card (blocos / editorial / tipografico / chamada), mantendo paleta e
  cabecalho. Nao e inconsistencia — e o que ela pediu.
- **Contraste manda no resto**: fundo cobre → logo, icone e titulo em `#120D08`; botao cobre →
  texto escuro. Foi o que separou "bonito" de "ilegivel" na V3 terracota.
- **Caixa/painel com altura proporcional ao texto.** Caixa fixa de 520 px para duas linhas
  deixa um vazio preto que ela ve na hora. Medir o texto e fechar o painel em volta.
- **Logo sempre em arquivo**, no tamanho pedido, nunca recriado; cabecalho = logo pequeno +
  `@etnias.site` (canto superior esquerdo e a versao aprovada para card; topo centralizado no
  video).
- **Foto de pessoa**: duotone sombra `#120D08` / luz `#C58B56` + degrade para o fundo na base
  da imagem, senao o titulo nao assenta.

## 10. Pitfalls ja pagos

- **Conferir a GRAFIA antes de "consertar" acento.** Perdi varias iteracoes cacando um til
  que nao existia em "INDÍGENAS" — a palavra so tem acento no I (in-DI-ge-nas). O stencil do
  proprio "A" da Komorebi (barra no topo) parece acento faltando e engana.
- **O "J" maiusculo da DejaVu Sans nao tem serifa no topo**: em corpo 26-28 px a tag
  "#DemarcaçãoJá" parece "#Demarcaçãojá". Antes de mexer na tag, imprimir os codepoints do
  arquivo (`[hex(ord(c)) for c in tag]`); se for `0x4a`, esta certo.
- **Palavra orfa na ultima linha** (texto longo, tipico de espanhol): reduzir 1 pt por vez
  ate a ultima linha ter 2+ palavras (e no maximo 4 linhas). Nao cortar o texto.
- **Largura do corpo** manda no numero de linhas: com 33 pt o texto de 146 caracteres nao
  fecha em 3 linhas nem com 838 px — 31 pt com 862 px fecha.

- `d._image.paste()` do ImageDraw cola acento/imagem depois de desenhar; o objeto
  `ImageDraw` precisa ser o da imagem certa.
- Acento desenhado a mao em corpo pequeno vira risco: usar glifo real de outra
  fonte.
- Ao regenerar arte que ja tinha elemento antigo, gere do zero. Colar o novo por
  cima do antigo deixa dois elementos sobrepostos no canto.
- `pkill -f "<string>"` mata o proprio shell quando a string aparece na linha de
  comando do bash. Usar padrao especifico ou matar por PID.
- Scripts longos: conferir o caminho final impresso pelo script antes de enviar.
