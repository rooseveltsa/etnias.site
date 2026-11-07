# Identidade "cobre" — receita da serie de ataques (30-31/10/2026)

Estado final aprovado pela Vytorya para os cards de noticia do Agente do Caos.
Sucede a estetica vermelho-sobre-marrom (v1/v2).

Script de referencia: `~/.hermes/scripts/arte-v4-quatro-flechas.py`
Saida: `~/Hermes/Agente-do-Caos/artes/ataques-2026-10-30-v4/post-01-votouro-rs.jpg`
Identidade registrada tambem em `~/Hermes/Agente-do-Caos/Templates/visual-style-caos.md`.

## Fonte Komorebi

- Pacote: `https://font.download/dl/font/komorebi.zip` -> `Komorebi-PersonalUse.otf`
- Instalada em `~/.fonts/komorebi/` (`fc-cache -f`)
- **Licenca personal use only** (VP Creative Shop): campanha pessoal ok; peca de
  marca/produto exige licenca comercial.
- 124 glifos. **Acento nao existe desenhado** (`Á -> A`, `Ã -> A`); tambem nao
  tem `@ # & ? ! · : ; , . ( ) - — /`.
- Acentos e pontuacao: `scripts/komorebi_acentos.py` desta skill.

## Paleta (medida)

| Papel | Valor |
|---|---|
| fundo base | `(23,16,11)` — +5 tons = `(58,40,28)`; +3 tons quando ela pediu "escureca 2 tons" |
| titulo | laranja `#FF6A13` |
| moldura | cobre `#B87333` (3 px em `[24,24,L-24,A-24]`) + marrom (2 px em `[34,...]`) |
| divisor / tags claras | cobre claro `#D69E60` |
| corpo | branco quente `#F4EFE7` |

## Layout 1080x1350

- bandeira 🇧🇷 68 px, centro, topo `y=96`
- titulo Komorebi, corpo 104-126, quebra em ate 3 linhas, largura util 780-830
- divisor `—.--·-√\_/\__--°•O_-_–•···` (DejaVu 36, cobre claro), ~600 px
- local em caixa alta (DejaVu 29), depois corpo (DejaVu 32-34)
- rodape centralizado (DejaVu 28), **so as tags da ultima ordem dela**

## Emoji 🏹 em cobre

- Asset: `~/.hermes/assets/arco-flecha.png` (Twemoji 72x72)
- Tint: `ImageOps.colorize(gray, black=(70,42,20), mid=(184,115,51), white=(255,216,165))`
  + `putalpha(alpha original)`
- Direcao nativa: **cima-esquerda**

| Canto | Transformacao |
|---|---|
| superior esquerdo | nenhuma |
| superior direito | `FLIP_LEFT_RIGHT` |
| inferior esquerdo | `FLIP_TOP_BOTTOM` |
| inferior direito | flip H + flip V |

- Tamanho final: 92 px (ela pediu menor duas vezes: 152 -> 116 -> 92)
- Centro a ~110 px de cada borda, dentro da moldura; 4 unidades, uma por canto.
- Arco vetorial desenhado a mao (gradiente + nos de circuito) foi **rejeitado**.

## Tags aprovadas em 31/10/2026

`#ProtejamOsPovosIndígenas` e `#DemarcaçãoJá` — **sem arroba**.
Ela removeu `#Votouro`, `#JustiçaParaÁlvaro` e `@ExercitoDosPovosIndigenas`
da arte. Nao reintroduzir por conta propria: usar exatamente a ultima lista.

## Serie (5 noticias)

1. TI Votouro/RS — 3 mortos em um dia (13/10)
2. TI Yanomami/RR — garimpeiros voltando
3. TI Apyterewa/PA — invasao marcada para o 2o turno
4. Funai Sao Jeronimo da Serra/PR — explosivos (08/10)
5. TI Maxakali/MG — 65% queimada

## Redacao: cuidado medido na checagem

O card do Votouro crava "cacique bolsonarista atirou" (versao dos moradores).
A Brigada Militar trata como disputa de lideranca e a PF nao concluiu. Numa
auditoria de veracidade isso vira ponto fraco: ao escrever card de noticia,
preferir o fato duro + "PF investiga" e deixar a autoria fora do titulo.
