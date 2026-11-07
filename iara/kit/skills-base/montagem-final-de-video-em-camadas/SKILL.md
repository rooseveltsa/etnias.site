---
name: montagem-final-de-video-em-camadas
description: Montar o video final do P.L.U.M.A. juntando as quatro camadas — video base, overlay do Volito com alpha, legenda e trilha — num mp4 H.264/AAC, com conversao de legenda mp4 sem alpha e audio nivelado sem clipping. Usar quando o pedido for "montar o video final", "juntar overlay + legenda + som", "fechar o reel", "camadas", ou quando houver video bruto + grafico + trilha para unir.
---

# Montagem final do video em camadas

Quatro entradas, uma saida:

```
video base (mp4, celular)      -> H.264
overlay Volito (webm VP9 alpha) -> sobreposto com overlay
legenda (mp4 sem alpha)         -> vira alpha por luminancia (alphamerge)
trilha (wav do Volito)          -> substitui o audio do base, nivelada
                                  = video-montagem-final.mp4 (H.264/AAC)
```

Comando unico, testado ponta a ponta em 04/11/2026:

```bash
~/.hermes/skills/montagem-final-de-video-em-camadas/scripts/montar-camadas.sh \
  base.mp4 overlay.webm legenda.mp4 trilha.wav saida.mp4
```

Camada ausente = `-`. Exemplo sem legenda:
`montar-camadas.sh base.mp4 overlay.webm - trilha.wav saida.mp4`

O script mede a base, monta o grafo de filtros na ordem certa, gera o video num
temporario, e depois cola o audio (segundo passe). No fim imprime
`OK: saida.mp4 LARGxALT duracao`.

## 1. As tres descobertas que custaram teste (04/11/2026)

### a. MP4 com fundo preto NAO e alpha — use alphamerge, nunca blend=screen

Um render do Volito em `--format mp4` (ou uma legenda exportada em mp4) nao tem
canal alpha: o fundo vem preto chapado. Colar direto com `overlay` pinta um
retangulo preto por cima do video.

A tentacao e `blend=all_mode=screen`, que "teoricamente" descarta o preto.
**Nao funciona**: o `blend` do FFmpeg opera plano por plano (Y, U, V
separados). Fazer screen nos planos de crominancia (que ficam em torno de 128)
produz um frame inteiro **ROXO/magenta**. Foi exatamente o defeito medido no
primeiro teste.

O caminho certo e transformar a luminancia da legenda em alpha:

```
[2:v]format=rgb24,split=2[cv][ca];
[ca]format=gray[alpha];
[cv][alpha]alphamerge,format=rgba[cap];
[bg][cap]overlay=0:0:shortest=0:eof_action=pass[v]
```

Como funciona (metafora): a legenda e tinta clara sobre papel preto. O
`alphamerge` le o "quanto de luz" de cada pixel e usa isso como transparencia.
Onde e preto (zero luz) fica 100% transparente; onde e creme (muita luz) fica
100% opaco; o anti-aliasing da borda vira transparencia parcial — o texto
mantem a borda suave, sem serrilhado e sem halo.

Limite honesto: **tudo** que for claro na legenda vira opaco. Placa escura
atras do texto some junto com o fundo. Se a legenda depender de uma placa
escura para ler sobre footage claro, renderize a legenda em **webm com alpha**
(como o overlay) em vez de mp4 — ai nao precisa de conversao nenhuma.

### b. loudnorm em passe unico estoura o true peak — dois passes

`-af loudnorm=I=-14:TP=-1.5` num passe so (modo dinamico) nao garante o teto:
no teste o arquivo saiu com true peak **-0.1 dBFS**, praticamente clipando, e
o AAC ainda acrescenta overshoot.

O script resolve com dois passes:

```
passe 1: monta o video (sem audio)          -> video.mp4
passe 2: copia o video (-c:v copy) e
         reencoda SO o audio de trilha.wav
         loudnorm=I=-14:TP=-2:LRA=11,alimiter=limit=0.891
```

Resultado medido: true peak **-0.6 dBFS**, LRA 2,8 LU, sem clip.

`alimiter` com `level=false` limita sem re-levantar o volume (senao o limitador
devolve o ganho que acabou de cortar). `TP=-2` em vez de `-1.5` e a folga para
o encoder AAC.

### c. Regra de ouro: legenda com a MESMA duracao do video base

Se a legenda tem 4 s e o video 5 s, o ultimo segundo fica mudo de texto e o
corte parece quebrado. Renderize a legenda no Volito com `--duration` igual a
duracao do video base:

```bash
volito render legenda-item --words words.json --aspect 9:16 --duration 5 --format mp4 --out legenda.mp4
```

Mesma regra vale para o overlay e para a trilha: **as quatro camadas com a
mesma duracao**. Conferir sempre:

```bash
ffprobe -v error -show_entries format=duration -of csv=p=0 arquivo
```

`eof_action=pass` no overlay segura o video quando uma camada acaba antes
(o video nao corta), mas ele nao substitui a regra: camada curta = buraco.

## 2. Ordem das camadas (importa)

```
1. overlay do Volito (webm alpha)   -> primeiro: e o grafico principal
2. legenda (alphamerge)             -> por cima: texto sempre legivel
3. audio: trilha substitui o audio do base
```

Se inverter (legenda embaixo), a placa do lower-third cobre o texto da legenda.
E o audio do video base **nao** entra: `-map 0:v -map 1:a` garante que so a
trilha toca. Quando a voz dela for necessaria, ver secao 5.

## 3. O que o script faz, linha por linha

- mede a base com `ffprobe` (largura x altura) e valida o que existe;
- monta o grafo de filtros conforme as camadas presentes (`-` pula);
- `-c:v libvpx-vp9` ANTES do `-i` do overlay: sem isso o webm perde o alpha;
- `shortest=0:eof_action=pass` em cada overlay: camada curta nao corta o video;
- `-r 30` na saida: celular grava VFR, e VFR dessincroniza camada;
- video em `libx264 -crf 20 -pix_fmt yuv420p`, `-movflags +faststart`;
- audio: segundo passe com `-c:v copy` (nao reencoda video de novo).

## 4. Conferir antes de entregar

```bash
# existe video E audio, na resolucao certa, na duracao certa
ffprobe -v error -show_entries stream=codec_type,codec_name,width,height,sample_rate,channels \
  -show_entries format=duration -of default=nw=1 saida.mp4

# volume final: true peak abaixo de -1 dBFS, sem clip
ffmpeg -hide_banner -i saida.mp4 -af ebur128=peak=true -f null - 2>&1 | grep -A2 "True peak"

# a trilha realmente subiu onde o efeito entra (prova por trecho)
ffmpeg -hide_banner -ss 0   -t 3.4 -i saida.mp4 -af volumedetect -f null - 2>&1 | grep max_volume
ffmpeg -hide_banner -ss 3.5 -t 1.5 -i saida.mp4 -af volumedetect -f null - 2>&1 | grep max_volume

# frame no segundo onde as camadas aparecem juntas
ffmpeg -y -ss 2 -i saida.mp4 -frames:v 1 -update 1 still.png
```

E olhar o still: fundo do video (nao preto chapado, nao roxo), placa no lugar,
texto legivel, nada atras da interface do app (250 px de topo e 400 px de
rodape para Reels).

## 5. Variantes

**Com a voz dela por cima da trilha** (trilha como cama, nao como audio unico):

```bash
ffmpeg -y -i video.mp4 -i trilha.wav -i voz.wav -filter_complex \
 "[1:a]volume=0.35[bed];[2:a]volume=1.0[voz];[bed][voz]amix=inputs=2:duration=first:normalize=0[m]" \
 -map 0:v -map "[m]" -c:v copy -c:a aac -b:a 192k -shortest final.mp4
```

**Sem overlay, so legenda** : `montar-camadas.sh base.mp4 - legenda.mp4 trilha.wav out.mp4`

**Sem legenda**: `montar-camadas.sh base.mp4 overlay.webm - trilha.wav out.mp4`

**So trilha** (o video ja tem grafico queimado): `montar-camadas.sh base.mp4 - - trilha.wav out.mp4`

## 6. Pitfalls

1. **`blend=all_mode=screen` para remover preto** -> frame roxo. Use alphamerge.
2. **Legenda mp4 colada direto** -> retangulo preto cobrindo o video.
3. **`-c:v libvpx-vp9` esquecido** antes do `-i` do webm -> alpha perdido.
4. **`loudnorm` de um passe** -> true peak estoura (medido -0.1 dBFS).
5. **`alimiter` com `level` no padrao** -> devolve o ganho cortado; use
   `level=false` e confie no loudnorm antes dele.
6. **`-shortest` ausente** -> a saida herda a camada mais longa.
7. **Duracao diferente entre camadas** -> buraco no fim ou texto cortado.
8. **`amix` com `normalize` no padrao** divide o volume pelo numero de entradas.
9. **Legenda com placa escura** -> alphamerge apaga a placa. Renderize a legenda
   em webm com alpha.
10. **Overlay 9:16 colado com posicao calculada** -> canvas inteiro desloca e a
    placa sai do lugar; ver skill `volito-overlay-em-video-real`, secao 4.1.
11. **`/tmp` e apagado no restart**: o script usa `mktemp -d` e limpa no `trap`;
    o arquivo final sempre em caminho de projeto, nunca em /tmp.

## 7. Estrutura de pastas do P.L.U.M.A.

```
Pexinxavel/P.L.U.M.A/
  Conteudos/brutos/            <- o DROP: video cru da Vytorya entra aqui
  Processados/testes/          <- provas de pipeline (referencia interna)
  Processados/videos-prontos/   <- videos finalizados, prontos para publicar
  Templates/                    <- identidade, trilhas, dados de peca
```

Fluxo real: video entra em `Conteudos/brutos/`, overlay+legenda+trilha sao
gerados na fase de criacao, o script fecha em `Processados/videos-prontos/`.
Publicar so com OK dela — montar nao e autorizar.

## 8. Teste de referencia (04/11/2026)

| item | resultado |
|---|---|
| base | `base-teste-5s.mp4` 1080x1920, 5,00 s, H.264 + AAC |
| overlay | `overlay-lower-third.webm` VP9 alpha, 5,00 s |
| legenda | `legenda-teste.mp4` 1080x1920, 4,00 s, H.264 sem alpha |
| trilha | `trilha-teste-final.wav` 5,00 s, 48 kHz estereo (bed + riser) |
| saida | `video-montagem-final.mp4` 1080x1920 5,000000 s, h264 + aac 48 kHz estereo, 292 KB |
| audio | true peak -0.6 dBFS, LRA 2,8 LU; 0-3,4 s = -3,8 dB e 3,5-5 s = -0,6 dB |
| still | `montagem-final-still.png` (t=2 s): placa + legenda juntas, fundo escuro |

## 9. Skills irmas

- `volito-overlay-em-video-real` — gerar e posicionar o overlay com alpha.
- `volito-som-proprio` — gerar a trilha/riser/hit no motor do Volito.
- `legenda-cinetica-volito` — legenda que acompanha a fala palavra por palavra.
