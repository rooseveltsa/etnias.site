# Mapa mental do fluxo (pedido junto com o inventario)

Origem: pedido dela em 13/10/2026 — "me de um relatorio completo de todos os seus
fluxos, skills, plugins, cron jobs e etc. faca um documento txt e um mapa mental".

Quando o pedido de inventario vem acompanhado de "mapa mental" (ou "mapa", "arvore",
"diagrama do fluxo"), a entrega e TRIO, nao um arquivo:

1. `FLUXO-COMPLETO-<AAAA-MM-DD>.txt` — o relatorio em ASCII puro (ver SKILL.md §
   Relatorio de INVENTARIO DO FLUXO INTEIRO).
2. `MAPA-MENTAL-FLUXO-<AAAA-MM-DD>.txt` — a arvore em texto ASCII.
3. `MAPA-MENTAL-FLUXO-<AAAA-MM-DD>.html` — a versao visual, um arquivo unico que
   abre no navegador.

Pasta canonica: `~/Hermes/Pexinxavel/A.R.A.R.A/Relatorios/`. Copiar os dois `.txt` tambem para
`/mnt/shared/MyFiles/Hermes/` (regra das duas copias). O `.html` fica so na pasta de
relatorios — ela abre pelo app Arquivos / navegador.

## 1. Arvore em texto (ASCII puro)

Mesmo conteudo do relatorio, so a hierarquia. Regras que funcionaram:

- Raiz = `HERMES (assistente da Vytorya - <maquina>, versao X.Y.Z)`.
- Ramos numerados `[1]`, `[2]`, ... na ordem do relatorio, para ela casar documento
  e mapa item a item.
- Desenho com `+--` e `|`, sem caractere Unicode de caixa (nao passa no check ASCII).
- Cada linha com no maximo ~70 colunas: o WhatsApp e o terminal quebram linha longa.
- Nos folha sao acoes ou numeros medidos (taxa, horario do cron, contagem de pecas),
  nunca frases soltas.
- Idade do documento vai no rodape (`FIM DO MAPA MENTAL` + data).

## 2. Versao visual (HTML unico, sem dependencia externa)

Template pronto: `templates/mapa-mental.html` — copiar e trocar o conteudo dos cards.

Padrao que deu certo (13/10/2026):

- 1 arquivo, zero CDN, zero JS de terceiro: so HTML + CSS. Ela abre local, sem rede.
- Grade de cards (`display:grid` + `repeat(auto-fit,minmax(320px,1fr))`) — um card por
  ramo, nao um grafo SVG. Card legivel vence linha bonita.
- Cada ramo com uma cor propria via `--accent` no card (`.b1`, `.b2`, ...), fundo escuro
  (`#0c0a10`) com dois gradientes radiais; combina com a identidade do brecho.
- Sub-itens em `<details>/<summary>` — o ramo abre e fecha no clique. Ramos importantes
  saem com `<details open>`.
- Marcadores de estado com classe, nao emoji: `<span class="on">ATIVO</span>`,
  `<span class="off">PAUSADO</span>`, `<span class="warn">BLOQUEIO</span>` e o
  `<span class="tag">FUTURO</span>` para o que ainda nao existe.
- Rodape com o caminho absoluto da pasta e o nome dos irmaos `.txt`.
- Conferir ASCII igual ao `.txt` (`grep -cP '[^\x00-\x7F]' arquivo.html` = 0): evita
  mojibake se ela mandar o arquivo para outro lugar.
- Nao abrir o navegador por conta propria — entregar o caminho e OFERECER abrir.

## 3. Checagem antes de entregar

```bash
cd ~/Hermes/Pexinxavel/A.R.A.R.A/Relatorios
for f in FLUXO-COMPLETO-<data>.txt MAPA-MENTAL-FLUXO-<data>.txt MAPA-MENTAL-FLUXO-<data>.html; do
  echo "$f -> $(grep -cP '[^\x00-\x7F]' "$f")"
done
python3 ~/.hermes/skills/relatorios-ascii-puro/scripts/verificar-ascii.py <arquivo.txt>
cp -f FLUXO-COMPLETO-<data>.txt MAPA-MENTAL-FLUXO-<data>.txt /mnt/shared/MyFiles/Hermes/
wc -l -c MAPA-MENTAL-FLUXO-<data>.txt
```

E na mensagem: dizer quantas linhas/bytes de cada arquivo e colar o conteudo completo
dos dois `.txt` (regra da skill). O `.html` vai so como caminho + convite para abrir.
