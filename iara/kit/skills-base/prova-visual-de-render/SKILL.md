---
name: prova-visual-de-render
description: Provar que um video/arte/documento renderizado por codigo esta correto olhando pixel e frame, em vez de confiar em exit_code ou em "o arquivo existe". Usar sempre que a entrega for mp4/mov/png/pdf gerado por Volito, PIL, ffmpeg ou PIL+Manim, ou um .html interativo (mapa mental, diagrama navegavel) que precisa abrir limpo e responder a clique — e sempre que a cor, a posicao ou a sincronia forem criterio de aceite.
---

# Prova visual de render (exit code nao prova nada)

`ls -la` prova que o arquivo existe. `volito check` prova que o codigo roda.
Nenhum dos dois prova que a peca esta CERTA. Esta skill e o passo que falta:
extrair frames nos tempos que importam, medir a cor por pixel e LER a imagem.

## 1. Quando usar

- entrega e video, card, arte, PDF ou still gerado por codigo
- a cor da marca e criterio ("tem que ser terracota, nao amarelo")
- a posicao e criterio (area segura 9:16, legenda fora da UI da plataforma)
- a sincronia e criterio (legenda presa na fala, texto no tempo do audio)
- o dono pede PROVA (ela pede: md5 para backup, frame para render)

## 2. Metodo (4 passos)

1. Escolher os tempos que importam: as trocas de cena, o segundo de uma
   palavra falada, o pico de uma animacao. Nunca um frame so.
2. Extrair com ffmpeg:

```bash
for t in 0.30 1.20 2.90; do
  ffmpeg -y -v error -ss $t -i final.mp4 -frames:v 1 f-$t.png
done
```

3. Montar folha de contato horizontal com PIL, rotulando o tempo, e ler a
   imagem (vision) perguntando o que DEVERIA estar ali.
4. Medir a cor por pixel quando a cor for o criterio:

```python
from PIL import Image
im = Image.open('f-1.20.png').convert('RGB')
alvo = (184, 74, 39)   # #B84A27
n = 0
for y in range(0, im.height, 2):
    for x in range(0, im.width, 2):
        p = im.getpixel((x, y))
        if all(abs(p[i] - alvo[i]) < 30 for i in range(3)):
            n += 1
print('px da cor:', n * 4)   # 0 = a cor nao entrou
```

Script pronto: `scripts/verificar-render.py` (frames + folha + relatorio de cor
num comando).

## 3. Pitfalls

1. **PNG transparente sobre branco esconde texto branco.** Still de overlay
   lido fora de contexto parece vazio. Renderize com fundo (`--bg`) ou desenhe
   em cor escura para conferir, e sempre desconfie de "imagem em branco".
2. **Amostrar todo pixel e lento** em 1080x1920: pule de 2 em 2 e multiplique
   por 4. Para contagem relativa, isso basta.
3. **Tolerancia de cor**: 25-30 por canal cobre antialiasing e opacidade;
   abaixo disso o texto por cima da barra derruba a contagem.
4. **Um frame so mente.** Defeito de sobreposicao aparece em 1 de 10 frames —
   por isso a folha de contato em varios tempos.
5. **`ffmpeg -ss` antes de `-i`** e rapido (busca por keyframe) e pode cair
   alguns frames antes; para precisao cirurgica use `-ss` depois de `-i`.
6. **Ordem dos eventos importa**: se o roteiro diz "A depois B", extraia um
   frame de cada e confirme que nao aparecem juntos.

## 4. O que essa prova ja pegou

- Marca-texto amarelo no lugar do terracota da marca (estilo `ember` assumindo
  a cor porque as flags `--accent2` nao foram passadas).
- Dois blocos de legenda desenhados no mesmo frame, quando a fala era rapida
  (bloco anterior nao saia antes do proximo entrar).
- `$.data` vazio em programa solto do Volito (props nao chegam) — descoberto
  com um still de diagnostico que imprimia as chaves dos props na tela.

## 5. Artefato interativo (HTML) tem prova propria

Frame e cor nao provam clique. Quando a entrega e `.html` standalone (mapa
mental, diagrama navegavel, painel), a prova e por CDP: Chromium headless com
`--remote-debugging-port`, `Runtime.enable` + `Log.enable` para pegar excecao e
`console.error`, `Runtime.evaluate` para contar nos do DOM real e acionar os
botoes, `Emulation.setEmulatedMedia {media:'print'}` para medir o CSS de
impressao e `Input.dispatchMouseEvent` para disparar hover de verdade.

Armadilha: `--dump-dom` nao prova interacao e engana na contagem (traz tambem
o codigo fonte embutido — o `<svg` de dentro de uma string JS conta como no).
Quem manda e `Runtime.evaluate`.

Receita, script pronto e pitfalls: skill `html-interativo-standalone`.

## 6. Skills irmas

- `html-interativo-standalone` — prova de HTML interativo por CDP
- `legenda-cinetica-volito` — legenda presa na fala (auditar com esta prova)
- `pack-volito-da-marca` — paleta e fontes num `shared.js`
- `video-volito-com-narracao` — render + narracao Piper + mix no ffmpeg
