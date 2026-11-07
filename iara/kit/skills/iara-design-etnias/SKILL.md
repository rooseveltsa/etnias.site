---
name: iara-design-etnias
description: Sistema de design oficial do etnias.site (cores, logo, tipografia, peças aprovadas e geradores). Use sempre que a IAra ou qualquer agente for produzir arte, post, carrossel ou vídeo do etnias.
---

# Design oficial do etnias.site

Fonte da verdade aprovada pela Vytorya em 05/11/2026. Tudo aqui foi feito e aprovado por ela:
4 kits de cor, carrossel da Opy (4 cards), carrossel do Karuãn (4 cards) e o vídeo de 30s explicando o kit.

## 1. Cores

- `#120D08` — base profunda, fundo do tema escuro
- `#2E251B` — base secundária, painéis e superfícies
- `#C58B56` — apoio, símbolo Opy, destaque tipográfico
- `#B84A27` — ação primária: botão, etiqueta, ícone ativo, marca d'água

Papéis fixos, definidos no documento de interface: o terracota guia o olhar para a ação; o cobre sustenta a identidade e desenha a Opy em fundos contrastantes.

## 2. Regra do logo (crítica)

O logo **nunca** vai em branco nem em preto puro. Usos aprovados:

- painel escuro: logo em **cobre** `#C58B56`
- sobre a cor dominante: logo em **`#2E251B`**
- detalhe, selo, marca d'água: logo em **laranja** `#B84A27`
- lockup (casa + etnias.site): também em **laranja**
- quando o fundo é cobre, o logo pode ir em marrom; se ficar invisível, usar chip `#2E251B` atrás

Texto é a única coisa que pode ser preto ou branco.

## 3. Tipografia

- **Archivo Black** (`/home/anaobranca/.fonts/ArchivoBlack-Regular.ttf`) — títulos e números, caixa alta, peso máximo
- **Inter** (400/500) — texto corrido, legendas e interface

## 4. Peças aprovadas (não recriar, usar estas)

Pasta oficial: `~/Hermes/Agente-do-Caos/artes/etnias-design-oficial-2026-11/`

- `kits/kit-design-etnias-escuro.jpg` — fundo `#120D08`
- `kits/kit-design-etnias-marrom.jpg` — fundo `#2E251B`
- `kits/kit-design-etnias-cobre.jpg` — fundo `#C58B56`
- `kits/kit-design-etnias-terracota.jpg` — fundo `#B84A27`
- `carrossel-opy/etnias-opy-01..04.jpg` — 1/4 Opy, 2/4 o que é, 3/4 por que é o símbolo, 4/4 chamada
- `carrossel-karuan/karuan-01..04.jpg` — capa com a foto do criador em duotone, quem é, o que constrói, por que importa
- `video/video-kit-30s.mp4` — 1080x1920, 30s, seis cenas, áudio do Volito

Cada kit mostra: paleta com o papel de cada cor, quatro usos do símbolo (painel, cor dominante, laranja, lockup), tipografia e regras com uma peça aplicada.

## 5. Geradores (fonte, não a imagem)

- `~/.hermes/scripts/kit-design-etnias-cores.py` — 4 kits; paletas na lista `PALETAS`
- `~/.hermes/scripts/post-etnias-opy.py` — carrossel da Opy
- `~/.hermes/scripts/post-etnias-karuan.py` — carrossel do criador (capa com foto em duotone)
- `~/motion/etnias-kit/` — programa do Volito do vídeo explicativo
- `~/.hermes/scripts/post-etnias-opy-estilos.py`, `-cores.py`, `-destaques.py`, `-mix.py`, `-painel.py`, `-selo.py` — variações de estudo aprovadas em partes

Assets: `~/.hermes/assets/opy-logo-correto.png` (900x454, símbolo oficial) e `etnias-logo-completo.png` (lockup).

## 6. Regras de composição

- Logo + `@etnias.site` no topo (centralizado no vídeo, à esquerda nas artes estáticas)
- Fundo escuro domina; cobre no símbolo e no destaque; terracota só na ação
- Título grande, texto curto, muito respiro
- Rodapé das peças estáticas: "Opy · casa de reza" à esquerda e o número do card à direita
- Vídeo 9:16: nada abaixo de 0,78H (área de legendas e botões do Instagram)

## 7. Como produzir peça nova

1. Escolher a cor dominante entre as quatro.
2. Partir do gerador correspondente, nunca de imagem achatada.
3. Conferir: logo em cobre (ou `#2E251B` na cor dominante), nunca branco/preto.
4. Gerar, olhar com `vision_analyze` e só entregar a versão final.
5. Peça publicada não se reescreve; ajuste cirúrgico só no campo pedido.

## Pitfalls

- Recorte pequeno do símbolo (`opy-etnias.png`) vinha cortado na base; usar sempre `opy-logo-correto.png`.
- Fundo cobre com logo cobre = invisível; usar marrom ou chip escuro.
- Kits com 4 caixas de símbolo: 222 px cada, 16 px de gap, dentro de 960 de largura útil.
- No vídeo, `$.chip(..., {op})` ignora opacidade: envolver em `<g opacity>`.
## 8. Onde o kit mora (dentro da IAra)

Kit de design da IAra: `~/.hermes/profiles/iara/design-kit/etnias/`

- `DESIGN.md` — este documento
- `kits/` — as quatro folhas de cor
- `carrossel-opy/` — 4 cards da Opy
- `carrossel-karuan/` — 4 cards do criador
- `video/` — video do kit (30s)

Copia de trabalho (fora do profile, para gerar pecas novas):
`~/Hermes/Agente-do-Caos/artes/etnias-design-oficial-2026-11/`
