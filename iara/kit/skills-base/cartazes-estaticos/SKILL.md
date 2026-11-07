---
name: cartazes-estaticos
description: Produzir cartaz/card estatico (1080x1350 ou 1080x1080) desenhado em PIL - fonte display com acentos montados, paleta com "tons" em passos de luminosidade, elementos decorativos tintados (emoji/vetor) e preview ao vivo para a dona acompanhar cada versao. Carregar quando ela pedir arte, card, poster, capa, serie de posts ou "refaca a arte" com texto sobre fundo, principalmente no Agente do Caos (politico) e em series de noticias.
version: 1.0.0
author: Hermes
enabled: true
metadata:
  hermes:
    tags: [arte, cartaz, card, pil, tipografia, paleta, preview, aprovacao]
    related_skills: [agente-do-caos, artes-e-posts-criativos, geracao-de-imagens-e-posts]
---

# Cartazes estaticos (PIL) — arte de texto sobre fundo

Classe de trabalho: gerar um cartao estatico 1080x1350 com titulo, divisor,
corpo, tags e elementos decorativos, tudo desenhado em Python (PIL). Vale para
post politico, capa de serie, card de noticia.

Casos concretos e a receita exata da serie de ataques aos povos indigenas
(Komorebi + cobre) estao em `references/identidade-cobre-arte.md`.

## 1. Ciclo de trabalho (o que ela espera)

1. Ler o pedido e fixar os dados duros: titulo, local, corpo, tags.
2. Escrever/ajustar um script em `~/.hermes/scripts/`, nunca editar a imagem
   a mao.
3. Abrir o **preview ao vivo** (`templates/viewer-arte.html`, secao 5) para ela
   ver cada versao na tela.
4. Iterar **uma mudanca por vez**, olhando a imagem com `vision_analyze` antes
   de mandar.
5. Entregar **so a versao final** (1 imagem por arte). Ela rejeita versao de
   teste/intermediaria.

Sinais de correcao mais comuns dela (checar antes de enviar): acento grande ou
torto, elemento decorativo apontando para o lado errado, marrom "claro/lavado",
titulo pequeno, tag ou arroba a mais.

## 2. Tipografia de fonte display

Fontes display bonitas (Komorebi, e muitas de dafont/font.download) vem
**sem acento** — o cmap aceita o codepoint e devolve a letra base, entao o texto
sai "INDIGENA" sem acento. Tambem costumam nao ter `@ # ? ! · , .`.

Antes de qualquer depuracao de acento:

```python
[hex(ord(c)) for c in texto if ord(c) > 127]   # o que a string REALMENTE tem
unicodedata.normalize("NFC", texto)             # garante forma precomposta
```

Depois escolher:

- fonte tem acento nativo -> `ImageFont` direto
- nao tem -> desenhar a base na fonte display e o acento como **traco fino**
  (`scripts/komorebi_acentos.py` e o modelo pronto: espessura ~0.020 do corpo,
  altura ~0.10, largura ~0.14, folga 0.05 acima da tinta; til como faixa
  senoidal preenchida e levantada, porque bico de "A" engole marca proxima)
- pontuacao: trocar aquele caractere para uma sans com cobertura (DejaVu) a
  ~62% do corpo, para nao quebrar o ritmo do texto

Regra de licenca: conferir antes de usar em peca de marca/venda. Komorebi e
personal use only; uso comercial exige licenca paga do autor.

## 3. Paleta e "tons"

Quando ela pede "deixe o marrom N tons mais claro", 1 tom = **+2% de
luminosidade em HLS** (`colorsys`), mantendo matiz e saturacao:

```python
def clarear(cor, passos=5, passo=0.02):
    r, g, b = [x / 255 for x in cor]
    h, l, s = colorsys.rgb_to_hls(r, g, b)
    return tuple(int(round(x * 255)) for x in colorsys.hls_to_rgb(h, min(0.92, l + passos * passo), s))
```

Medido em fundo `(23,16,11)`: +5 tons = `(58,40,28)` (bom); +15 pontos de L
(`(75,52,36)`) fica **lavado** e mata o contraste do titulo laranja. Se ela
disser "escureca 2 tons", voltar 2 passos em vez de recalcular do zero.

## 4. Elementos decorativos

- **Emoji oficial, nao desenho proprio**: quando ela manda o emoji (🏹, 🇧🇷),
  usar o PNG do Twemoji em `~/.hermes/assets/` e tingir com
  `ImageOps.colorize(cinza, black=escuro, mid=tom, white=claro)` devolvendo o
  alpha original. Arco vetorial desenhado a mao foi rejeitado.
- **Direcao**: Twemoji tem direcao nativa propria (🏹 aponta para cima-esquerda).
  Mapear por canto com `FLIP_LEFT_RIGHT` / `FLIP_TOP_BOTTOM` — nao girar em 45°.
  Mapa invertido faz a seta apontar para DENTRO e ela reclama na hora.
- **Quantidade**: ela prefere poucos e grandes — "4, um para cada canto,
  apontando para fora, por dentro da moldura". Nunca encher as laterais.
- Conferir sempre: nada encostando na moldura, no titulo ou nas tags.

## 4b. Variar o design por COR DOMINANTE (pedido recorrente dela)

Pedido real (03/11/2026): *"faca mais 3 versoes, essa teve o marrom escuro como dominante,
agora use as outras cores do etnias como dominante"* e, antes: *"faca um design diferente para
cada cor de destaque, mude forma de letra e disposicao dos elementos"*. Ela pensa em
**sistema de cor**: cada cor da paleta vira a dona da peca, uma versao por cor.

Receita que funcionou:

1. Uma funcao de card recebe um dicionario de papeis, nao cores soltas:
   `pal = {bg, tinta (texto sobre o bg), painel, texto_painel, destaque, acao, acao_texto}`.
   Trocar a cor dominante = trocar o dicionario, o layout fica identico.
2. **Contraste segue a luminancia, nao o gosto**: fundo claro (cobre) -> tinta escura
   `#120D08`; fundo escuro -> tinta clara. Texto do BOTAO tambem inverte: botao cobre com
   texto creme some, com texto escuro le.
3. Uma versao por cor dominante, 4 cards cada; entregar em blocos rotulados por versao.
4. Quando ela pede "cada card com um design diferente", manter a paleta e trocar so a
   diagramacao card a card (blocos / editorial / tipografico / chamada) dentro do MESMO
   carrossel.

Pitfalls medidos nessas rodadas (visao antes de entregar pega todos):

- **Painel com altura fixa** sobrando preto embaixo do texto: calcular a altura pelo texto
  ou reduzir para ~350 px; painel folgado le como erro de diagramacao.
- **Titulo colidindo com o logo do topo** (cabecalho + titulo na mesma faixa): empurrar o
  titulo para depois da altura do logo, nunca "ajustar fino".
- **Pilulas/selos com tratamentos diferentes** no mesmo bloco (um preenchido, outros so
  texto): dar o mesmo desenho, mudando so preenchimento vs contorno.
- **Simbolo cortado na divisa de dois blocos de cor**: palavra grande que cruza a linha de
  corte entre campos precisa estar inteira dentro de um dos campos.
- **Fonte serifa**: conferir que a barra/divisor nao corte o descendente do "p" (subir o
  titulo, nao baixar a barra).

Identidade do etnias.site (paleta do PDF, logo oficial, 4 cards aprovados, scripts):
`references/identidade-etnias-site.md`.

## 5. Preview ao vivo (ela pede "abra para eu ver")

`templates/viewer-arte.html` e uma pagina que troca o `src` da imagem com
cache-bust a cada 2 s. Copiar para `/tmp/viewer/index.html`, apontar para o JPG
e abrir em janela propria:

```
setsid nohup env DISPLAY=:0 WAYLAND_DISPLAY=wayland-0 XDG_RUNTIME_DIR=/run/user/$(id -u) \
  chromium --app=file:///tmp/viewer/index.html --user-data-dir=/tmp/chrome-viewer2 \
  --window-size=780,1010 --window-position=140,50 --no-first-run >/tmp/viewer.log 2>&1
```

Cada render novo aparece sozinho. `user-data-dir` proprio nao conflita com o
Chromium do CDP 9222.

## 6. Pitfalls medidos

- **Depurar acento sem conferir a grafia** queima iteracao: "INDÍGENAS" tem
  acento so no I; o corte stencil do "A" da Komorebi parece um til e engana.
- **`xdg-open` pendura** sem handler; `eog` e `tkinter` nao existem no container;
  `import -window root` e `xdotool search` nao veem janelas Wayland.
- **Fallback silencioso de fonte**: conferir o nome exato do arquivo e olhar a
  imagem pronta; script que cai no DejaVu nao avisa.
- **`pkill -f "<trecho>"` mata o proprio shell** quando o comando em execucao
  contem o mesmo trecho. Usar padrao mais especifico ou o PID.
- **Geracao de imagem por IA** pode falhar por saldo (`402 ... requires at least
  $1.00 in balance`). Gasto e decisao dela: avisar e seguir no vetor/PIL.

## 7. Arquivos de apoio

- `references/identidade-cobre-arte.md` — receita fechada da serie de ataques
  (Komorebi, paleta cobre, emoji 🏹, tags aprovadas, script de referencia).
- `references/identidade-etnias-site.md` — identidade do etnias.site (paleta do PDF,
  assets do simbolo da Opy, scripts dos carrosseis, conteudo factual do criador e capa
  com foto em duotone).
- `scripts/komorebi_acentos.py` — texto em fonte display sem acento nativo,
  com acentos em traco fino e pontuacao pela DejaVu.
- `templates/viewer-arte.html` — preview que se atualiza sozinho.
