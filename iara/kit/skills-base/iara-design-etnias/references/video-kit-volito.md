# Vídeo do kit no Volito — cenas casadas com a narração

Detalhe de execução do vídeo que explica o kit (30 s mudo / 45 s com voz clonada).
Programa: `~/motion/etnias-kit/` (`item.json` + `frame.js`).

## Fronteiras de cena vindas da fala

Falas sintetizadas saem desiguais (5,5 s / 9,3 s / 3,3 s / 16 s / 4,7 s / 5,8 s).
Dividir a duração por N faz a fala vazar para a cena seguinte. Use fronteiras
explícitas, medidas por `ffprobe`, somando as falas + ~0,05 s de folga por cena:

```js
const S = [0, 5.62, 14.95, 18.29, 34.35, 39.13, DUR];   // 7 fronteiras, 6 cenas
let idx = 0;
for (let i = 0; i < N; i++) { if (t >= S[i] && t < S[i + 1]) { idx = i; break; } }
if (t >= S[N]) idx = N - 1;
const u = t - S[idx];
const LEN = S[idx + 1] - S[idx];
```

Se a soma não couber na duração, encurtar o texto da fala — nunca acelerar o áudio.

Cena longa (15 s+) precisa de conteúdo progressivo dentro dela, revelado com
`up(u, 6.5, 40)`, `up(u, 9.4, 40)`: senão o vídeo fica parado.

## Pitfalls que custaram render

- **Bloco novo fora do `if (idx === N)` desenha em todas as cenas.** Ao acrescentar
  um estado extra, conferir que ele está dentro do `if` da cena — sintoma: o exemplo
  de tipografia aparecendo por cima da paleta.
- **Fade-out de estado interno deixa a cena vazia.** Se um bloco tem `aOp` com
  `(1 - seg(u, 6.0, 6.6))` e o estado seguinte é removido, tudo desaparece no meio da
  cena. Ao enxugar, apagar também o fade-out.
- **`$.chip` não aceita a cor da paleta**: `fill: c.accent2` cai no default do estilo
  (amarelo). Desenhar `$.rect` + `$.text` com hex literal (`#B84A27`) garante a cor.
- **Conferir com `volito sheet --times a,b,c`** em pontos específicos (inclusive os
  longos e o último terço), não só na folha padrão de 8 quadros.

## Áudio final (45 s com voz clonada)

```bash
# 1. faixa da narração, um adelay por cena, na fronteira + 0.05 s
ffmpeg -y -i n1.wav -i n2.wav -i n3.wav -i n4.wav -i n5.wav -i n6.wav \
 -filter_complex "[0:a]adelay=50|50[a0];[1:a]adelay=5670|5670[a1];\
[2:a]adelay=15000|15000[a2];[3:a]adelay=18340|18340[a3];\
[4:a]adelay=34400|34400[a4];[5:a]adelay=39180|39180[a5];\
[a0][a1][a2][a3][a4][a5]amix=inputs=6:normalize=0[nar]" \
 -map "[nar]" -t 45 -ar 48000 -ac 1 voz45.wav

# 2. mixar por cima da trilha do Volito e normalizar
ffmpeg -y -i video.mp4 -i voz45.wav -filter_complex \
"[0:a]volume=0.28[bed];[1:a]volume=2.0[voz];\
[bed][voz]amix=inputs=2:normalize=0:duration=first,\
loudnorm=I=-14:TP=-1.5:LRA=11[a]" \
-map 0:v -map "[a]" -c:v copy -c:a aac -b:a 192k final.mp4
```

Verificar presença de voz em vários pontos (não só o início):

```bash
for s in 1 8 16 22 36 41; do ffmpeg -hide_banner -ss $s -t 2 -i final.mp4 \
  -af volumedetect -f null /dev/null 2>&1 | grep mean_volume; done
```

## Render

30 s ≈ 190 s; 45 s ≈ 250 s de processamento. Sempre em background com
`notify_on_complete=True`, e nunca junto de outra tarefa pesada (XTTS, por exemplo).
