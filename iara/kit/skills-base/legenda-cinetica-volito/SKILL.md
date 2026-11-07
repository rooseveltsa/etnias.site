---
name: legenda-cinetica-volito
description: Legenda cinetica no Volito — transcrever audio com tempo por palavra (faster-whisper) e fazer o texto entrar na tela exatamente na fala, com marca-texto na palavra-chave. Usar quando o pedido for legenda que acompanha a fala, legenda de reel, texto cinetico, karaoke, ou headline que aparece junto com a voz.
---

# Legenda cinetica no Volito (fala -> texto na tela)

Sincronia e por palavra, nao por frase. O texto entra 0,08 s ANTES da palavra
ser falada — e isso que da a sensacao de "acompanha a boca".

## 1. Duas correcoes que custaram teste (04/11/2026)

**a. Nao existe tool MCP `motion_sync`.** As tools reais: `motion_api`,
`motion_list`, `motion_info`, `motion_moves`, `motion_styles`, `motion_check`,
`motion_preview`, `motion_review`, `motion_still`, `motion_render`,
`motion_sound`, `motion_validate`. A sincronia entra pelo campo `words`
(lista `[{w,s,e}]` ou caminho de transcricao) e pelas funcoes `$.at`,
`$.atOr`, `$.sync`, `$.headline` dentro do programa.

**b. Programa solto (`code`/`program` na spec) NAO recebe props.** O Volito
monta `$.data` so com os props declarados no `item.json`; em programa solto o
manifest tem `props: {}` e `$.data` chega vazio (provado com still de
diagnostico: `props:` vazio, `destaque: undefined`). Por isso a legenda e
entregue como **ITEM** (pasta com `item.json` + `frame.js`), nunca como
programa solto.

## 2. Quando usar

- "legenda que acompanha a fala", "legenda de reel", "karaoke"
- headline que aparece palavra por palavra junto com a voz
- corte de video real (dela falando) onde a legenda precisa cair no tempo

Sem audio, gere o audio primeiro (Piper, ver skill `video-volito-com-narracao`)
e transcreva o audio gerado. Nunca invente tempo.

## 3. Pipeline

```
audio (wav/mp3/m4a)
  -> gerar-legenda.py      -> words.json  ([{w,s,e}], sem pontuacao)
  -> volito check          -> legenda-item --words words.json
  -> volito render (mp4 mudo, com ou sem --sound)
  -> ffmpeg mux + loudnorm -> final.mp4
```

O Volito **nao recebe faixa de audio de fora**: ele so sintetiza a propria
trilha (`--sound`). A narracao entra depois, no ffmpeg.

## 4. Passo 1 — transcrever com tempo por palavra

faster-whisper 1.2.1 esta em `~/.venvs/whisper` (NAO no python do sistema):

```bash
~/.venvs/whisper/bin/python \
  ~/.hermes/skills/legenda-cinetica-volito/scripts/gerar-legenda.py \
  --audio /caminho/fala.wav --language pt --model small \
  --out /caminho/words.json --srt /caminho/fala.srt --blocos-json /caminho/blocos.json
```

Opcoes: `--words arquivo.json|.srt|.vtt` (converter transcricao existente, sem
rodar Whisper), `--offset 0.35`, `--minusc`, `--blocos 3`, `--pausa 0.30`,
`--corrigir "DOP=drop; Causa=calças"` (token errado -> certo, mesmo tempo),
`--juntar "Cento e DS=110"` (varios tokens -> um, do inicio do primeiro ao fim
do ultimo).

**O Whisper small erra numero e nome proprio.** Teste real de 04/11/2026 com a
frase "O drop de calcas esta disponivel no site do Coletivo 110" voltou como
`DOP`, `Causa` e `Cento e DS`. Sempre ler o `words.json` antes de renderizar e
consertar com `--juntar`/`--corrigir`. Modelo `medium` reduz o erro mas custa
1,5 GB de download (disco: 13 GB livres).

Saida `words.json`: `[{"w":"palavra","s":1.24,"e":1.61}, ...]` — **so w/s/e**
(e o schema do Volito e estrito; campo extra quebra a validacao), `w` sem
pontuacao.

## 5. Passo 2 — renderizar

```bash
ITEM=~/.hermes/skills/legenda-cinetica-volito/scripts/legenda-item

volito check "$ITEM" --words words.json --aspect 9:16 \
  --prop linhas=3 --prop destaque=pexinxavel,garimpo

volito render "$ITEM" --words words.json --aspect 9:16 --format mp4 \
  --prop linhas=3 --prop destaque=pexinxavel,garimpo \
  --accent "#B97232" --accent2 "#B84A27" --ink "#120D08" --paper "#F4EFE7" \
  --mode dark --display "Archivo Black:900" --text "Inter:400" \
  --out legenda.mp4
```

**As cores TEM que ir por flag** (ou por spec). Sem elas o estilo `ember`
pinta de amarelo e a peca sai fora da marca — teste confirmado: o marca-texto
saiu amarelo `#FFE14D` em vez de terracota.

Props: `linhas` (3), `maxCaracteres` (22), `pausa` (0.30), `tamanho` (96),
`ancora` (0.72 — 0.72 e o limite seguro do 9:16), `modo` (`bloco`|`headline`),
`destaque` (virgula), `caixa` (true), `blocosJson`, `frases`.

Alternativa por spec (quando quiser um arquivo reproduzivel):

```json
{ "volito": 1, "item": "/caminho/legenda-item", "words": "words.json",
  "aspect": "9:16", "duration": 20,
  "colors": { "accent": "#B97232", "accent2": "#B84A27", "ink": "#120D08",
              "paper": "#F4EFE7", "mode": "dark",
              "display": "Archivo Black:900", "text": "Inter:400" },
  "props": { "linhas": 3, "destaque": "pexinxavel,garimpo" } }
```

## 6. Blocos: contagem, largura e pausa

O programa agrupa `$.words` em blocos de `linhas` palavras, respeitando
`maxCaracteres` e fechando o bloco quando o silencio passa de `pausa`.
`pausa` e o unico sinal de fim de frase que o programa tem acesso — o
`words.json` nao pode carregar pontuacao (schema estrito).

Para quebra exata por frase, gere `blocos.json` (o script fecha tambem em
`. ! ? … ; :`) e passe o conteudo em `blocosJson`:

```bash
volito render "$ITEM" --words words.json --prop linhas=3 \
  --prop blocosJson="$(python3 -c 'import json;print(json.dumps(json.load(open("blocos.json")),ensure_ascii=False))')"
```

## 7. Modo headline

`--prop modo=headline --prop frases="*PEXINXAVEL* novo\|peca usada, preco justo"`
(linhas separadas por `\|` na CLI, `\n` no item). O trecho entre `*asteriscos*`
ganha o marker. Usa `$.sync` + `$.headline`: as palavras popam no tempo falado.

## 8. API de sincronia (bolso)

- `$.words` -> `[{w,s,e}]`.
- `$.at("palavra", n=0, "s"|"e")` -> segundo da n-esima ocorrencia; `NaN` se
  nao e falada.
- `$.atOr("palavra", 1.5)` -> igual, com fallback.
- `$.sync([linhas]) -> [{text, at, hl}]` e `$.headline(t, rows, opts)`.
- Regra: entrar 0,04-0,12 s antes da palavra.
- `--offset` (CLI) / `offset` (spec) desloca o grafico dentro da transcricao —
  use quando renderizar so um trecho de uma fala longa.

## 9. Render + mux da narracao

```bash
ffmpeg -y -i legenda.mp4 -i fala.wav -filter_complex \
"[0:a]volume=0.35[bed];[1:a]volume=1.0[voz];[bed][voz]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[mix]" \
-map 0:v -map "[mix]" -c:v copy -c:a aac -b:a 192k mux.mp4

ffmpeg -y -i mux.mp4 -c:v copy -af "loudnorm=I=-14:TP=-1.5:LRA=11" -c:a aac -b:a 192k final.mp4
```

Render sem `--sound` gera faixa muda; entao `-map 0:v -map 1:a` resolve e o
filtro acima fica opcional.

## 10. Pitfalls

1. **Props em programa solto nao existem** (`$.data` vazio). Use o item.
2. **Cores nao vem sozinhas**: `--accent/--accent2/--ink/--paper/--display`
   em toda renderizacao por CLI.
3. **Pontuacao colada na palavra** (`"hermes,"`) faz `$.at("hermes")` voltar
   `NaN`. O `gerar-legenda.py` limpa; transcricao de fora precisa limpar antes.
4. **Palavra repetida**: `$.at("ela")` pega a primeira; a segunda e
   `$.at("ela", 1)`. Trabalhe por bloco quando importa.
5. **Acento preservado** em `w` ("voce" != "você" no casamento).
6. **Campo extra em `words.json` quebra o schema** (e estrito: so w, s, e).
7. **Legenda baixa demais**: plataforma cobre ~22% de baixo; `ancora` 0.72.
8. **Dois blocos no mesmo frame** = texto sobreposto. O programa corta a saida
   do bloco em `proximo.s - 0.02` (nao em `b.e + 0.30` puro): sem isso o bloco
   anterior continua desenhado por cima do novo quando a fala e rapida. Foi
   exatamente o defeito visto no primeiro render de 04/11/2026.
9. **Marca-texto cobre o bloco inteiro**, nao so a palavra-chave — o Volito
   nao desenha por palavra dentro de um `$.text`. Se precisar marcar uma unica
   palavra, quebre o bloco em `$.text` separados e meca cada um.
10. **Texto estourando**: sempre medir e reduzir (o `check` acusa).
11. **`/tmp` e apagado no restart**: guarde `words.json` e wav em `~/tmp-<projeto>/`.
12. **Render longo**: 30 s leva ~3 min; rodar em background com notify.

## 11. Conferir antes de entregar

1. `volito check` sem erro, nos aspectos que vai entregar.
2. `volito still --t <segundo de uma palavra>` e olhar: a palavra falada
   naquele instante tem que estar na tela.
3. Teste de deriva: comparar a palavra do meio e a ultima. Atraso constante =
   corrigir `--offset`.
4. `ffprobe` de duracao igual ao audio e `volumedetect` sem clip.

## 12. Arquivos

- `scripts/gerar-legenda.py` — audio -> `words.json` (+ SRT + blocos)
- `scripts/legenda-item/` — item do Volito (`item.json` + `frame.js`)
- Skill irma: `video-volito-com-narracao` (Piper, logo, cenas, mix)
- Skill irma: `pack-volito-da-marca` (paleta e fontes sem repetir flag)
