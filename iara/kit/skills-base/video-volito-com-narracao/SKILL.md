---
name: video-volito-com-narracao
description: Gerar video de motion graphics com o Volito (logo oficial como imagem, cores da marca) e narracao em portugues sintetizada local (Piper), entregando MP4 9:16 pronto para rede social.
---

# Video com Volito + narracao local

Use quando a Vytorya pedir "video com o Volito", video de apresentacao/campanha, ou video narrado.

## Por que assim

- O Volito e MCP + CLI (`~/.local/bin/volito`), 12 ferramentas MCP. Para programa proprio com
  varias cenas, usar a **CLI** (leva 2-3 min, roda em background) e nao o MCP (estoura contexto
  com codigo grande).
- **Logo oficial entra como IMAGEM** (prop `image`), nunca redesenhado em SVG a mao: o desenho
  manual sempre sai diferente do logo real.

## Passo 1 - preparar o logo (fundo transparente)

```python
from PIL import Image
import numpy as np
src = Image.open(LOGO_JPG).convert('L')          # logo cobre sobre preto
a = np.clip((np.array(src).astype(np.float32) - 12) / (200 - 12), 0, 1)
alpha = Image.fromarray((a * 255).astype(np.uint8), 'L')
bbox = alpha.point(lambda v: 255 if v > 40 else 0).getbbox()
alpha = alpha.crop(bbox)
al = alpha.point(lambda v: 255 if v > 110 else 0)  # 1 bit: borda limpa
cor = Image.new('RGBA', al.size, (197, 139, 86, 255)); cor.putalpha(al)
cor.resize((900, round(900 * al.height / al.width)), Image.LANCZOS).save(SAIDA_PNG)
```

## Passo 2 - item do Volito

`~/motion/<id>/item.json` com `"placement": "full"`, `"aspects": ["9:16"]`,
`"props": { "logo": { "type": "image", "default": "" } }`.
`frame.js` usa `$.image('logo', x, y, w, h, {fit:'contain'})`.

**Regra de ouro contra sobreposicao:** uma cena por vez.

```js
const LEN = $.dur / N;
let idx = Math.floor(t / LEN);            // exclusivo: 0..N-1
const u = t - idx * LEN;                  // tempo local da cena
const fin  = $.clamp($.seg(u, 0, 0.10));
const fout = 1 - $.clamp($.seg(u, LEN - 0.16, LEN));
// desenhar SO os elementos da cena idx (if (idx === 0) {...})
// e envolver tudo: '<g opacity="' + (fin*fout).toFixed(3) + '">' + cena.join('') + '</g>'
```

Nunca use janelas que se cruzam (`t > a-0.2 && t < b+0.35`) — e isso que gera desenho sobreposto.

## Passo 3 - cores e fontes (CLI)

A CLI nao herda o `--colors` do MCP: passar sempre.

```
volito render <id> --aspect 9:16 --format mp4 --sound --out /caminho/final.mp4 \
  --image logo=/caminho/logo.png \
  --accent "#C58B56" --accent2 "#B84A27" --ink "#120D08" --paper "#F2EDE4" \
  --mode dark --display "Archivo Black:900" --text "Inter:400"
```

Sem esses flags o estilo `ember` pinta tudo de laranja/amarelo e o video sai fora da marca.

## Passo 4 - narracao (Piper, offline e gratis)

edge-tts esta bloqueado (403 da Microsoft) e nao ha chave OpenAI/ElevenLabs no .env.
Instalacao ja feita: `~/.venvs/piper` + voz `~/.local/share/piper/pt_BR-faber-medium.onnx`.

```bash
echo "Frase da cena." | ~/.venvs/piper/bin/piper -m ~/.local/share/piper/pt_BR-faber-medium.onnx -f nar1.wav
```

Uma frase por cena, curta (2-4 s), testar duracao com `ffprobe` e manter abaixo do LEN da cena.

Montar a faixa com atraso por cena:

```bash
ffmpeg -y -i nar1.wav ... -i nar6.wav -filter_complex "\
[0:a]adelay=350|350[a1];[1:a]adelay=5350|5350[a2];\
[a1][a2]amix=inputs=2:duration=longest:dropout_transition=0,apad=whole_dur=30[voz]" \
-map "[voz]" -t 30 -ar 44100 -ac 2 narracao.wav
```

## Passo 5 - misturar e normalizar

```bash
ffmpeg -y -i video.mp4 -i narracao.wav -filter_complex \
"[0:a]volume=0.35[bed];[1:a]volume=1.9[voz];[bed][voz]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[mix]" \
-map 0:v -map "[mix]" -c:v copy -c:a aac -b:a 192k intermediario.mp4

ffmpeg -y -i intermediario.mp4 -c:v copy -af "loudnorm=I=-14:TP=-1.5:LRA=11" -c:a aac -b:a 192k final.mp4
```

## Passo 6 - conferir antes de entregar

1. `volito check <id>` sem erro de texto fora do quadro.
2. Folha de contato com frames **exatamente nas trocas** (ex.: 4.90 e 5.10) — se aparecer duas
   cenas no mesmo quadro, a janela esta errada.
3. Area segura 9:16: nada abaixo de ~0.78H (legendas/botoes do Instagram cobrem 22%).
4. `ffprobe` + `volumedetect` para confirmar duracao e volume.

## Pitfalls

- `$.chip(..., {op})` **ignora** opacidade: envolver em `<g opacity="...">` ou o chip aparece
  desde o primeiro frame da cena.
- `$.pop(u, t0)` ja e 0 antes de `t0`, mas qualquer opacidade passada a helpers de bloco pode
  ser descartada — na duvida, envolver em `<g>`.
- Render de 30 s leva ~3 min: rodar em `background=True` com `notify_on_complete=True`.
- `/tmp` e apagado no restart: guardar frames e audios em `~/tmp-etnias/` ou similar.
- Disco: 1,5 GB livres; o render gera ~3,4 MB, sem problema, mas nao instalar pacote grande.
