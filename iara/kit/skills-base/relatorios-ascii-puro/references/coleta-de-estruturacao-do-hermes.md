# Coleta do relatorio de estruturacao do Hermes (I.T.A.)

Detalhe da variante "toda a sua estruturacao atual" da SKILL.md.
Coletor pronto: `scripts/coleta-estruturacao-hermes.sh` (so leitura).

## Regra do pedido

- Pedido curto dela ("gere um novo relatorio de status de estruturacao do Hermes
  e apague o ultimo") = **gerar + substituir**. O "apague o ultimo" faz parte da
  ordem; nao perguntar de novo.
- Nada e movido, criado ou apagado durante a COLETA. O cabecalho do arquivo diz
  isso explicitamente.
- Todo numero vem de comando. Se um dado nao foi medido no dia, escrever
  "ultima medicao: <data>", nunca apresentar como estado de agora.

## Armadilhas medidas

1. `hermes --version | tail -3` **perde a linha da versao** — ela sai primeiro
   (`Hermes Agent v0.19.0 (2026.7.20) · upstream ... · local ...`). Usar a saida
   inteira ou `head -5`.
2. `~/.optmem/memo` e o **programa** do OptMem (859 linhas de Python), nao o log.
   A contagem de registros esta em `~/.optmem/memory/LOG.txt` (`wc -l`); os nos
   de compressao ficam em `~/.optmem/memory/TREE`.
3. `du -sh skills/*` **nao ve pasta com ponto** — o total nao fecha com o `du -sh
   skills`. Rodar tambem `du -sh skills/.[!.]*`.
4. `systemctl is-active` sai com codigo 3 quando o servico esta parado (o
   `chromium-mp` fica parado de proposito). Encadear com `&&` mata o resto da
   coleta; usar `;`. Escopo sempre `--user`.
5. `du -sh` num atalho do motor da 4K: e o esperado, nao erro.
6. `enviar-whats.py` abre `sys.argv[1]` como arquivo — sondar com `--help`
   estoura `FileNotFoundError`. Escrever o texto num `.txt` e chamar com o
   caminho.
7. Apagar a versao anterior so depois de provar a nova:
   `test -s novo && rm -f antigo`, e fechar com `ls` mostrando que sobrou um.

## Snapshot de 03/11/2026 (usar como linha do tempo)

Motor: Hermes Agent v0.19.0 (2026.7.20), upstream 63c6d9a4, local b60cbc50
(+4 commits), git com 4 arquivos modificados e 9 nao rastreados (5 deles
`bridge.js.bak-*`).

| Medida | 02/11 | 03/11 |
|---|---|---|
| crons registrados | 20 (9 ativos / 11 pausados) | 21 (3 / 18) |
| profiles | 5 | 6 (entrou `impl`, 680M) |
| skills SKILL.md | 177 | 185 |
| scripts | 212 | 238 |
| disco livre | 3,1G (85%) | 1,6G (92%) |
| MEMORY.md | 7.953 | 7.914 chars |
| USER.md | 4.977 | 5.105 chars (estourou o teto de 5.000) |
| OptMem | 135 registros | 152 registros |
| Agente-do-Caos | 251M | 258M |
| Relatorios (~/Hermes) | 32 itens | 33 itens |
| Supabase midias | 655 | 655 (parado) |
| pecas ativas / vendidas | 56 / 3 | 56 / 3 |

Crons ativos em 03/11: vigia WhatsApp (3 min), ITA pesquisa (5 min),
limpeza de cache (09:30). O resto pausado por ordem dela em 02/11.

## O peso do disco (achado de 03/11)

`~/Hermes/Backups` e `OpenMontage` (803M) sao conhecidos. O que nao aparece na
varredura normal:

- `~/.hermes/skills/.curator_backups` .... 513M
- `~/.hermes/skills/.hub` ................ 50M
- `~/.hermes/profiles/impl/skills` ....... 673M (clone trouxe os mesmos 513M)
- `~/.hermes/state.db` ................... 369M
- `~/.cache` ............................. 1,3G
- `~/.hermes/whatsapp` ................... 318M

Recuperavel sem perder dado: os 513M de backup do curador e a copia deles dentro
do `impl`. `.cache` e recriavel. **Decisao de apagar e dela** — o relatorio
aponta, nao executa.

## Estado do inventario em 11/2026 (secoes que ela aprovou)

motor / arvore de ~/Hermes / setores (I.T.A., ARARA, PLUMA, Curator.X, Cultural
com T.R.A.M.A., Caos, IMPL, SEMEA planejado) / brecho em detalhe / skills /
scripts / crons / profiles / plugins-MCP-servicos / memoria em camadas / dados /
canais / **o que mudou desde o relatorio anterior** / pendencias reais / regras
que valem em todo setor.

## Entrega

- Arquivo canonico atual: `~/Hermes/Relatorios/RELATORIO-ESTRUTURACOES-<AAAA-MM-DD>.txt`
  (02/11 e 03/11 sairam ali; a pasta `A.R.A.R.A/Relatorios` continua existindo
  em paralelo e a decisao de qual e a canonica e dela).
- Espelhar o resumo no WhatsApp dela em sessao CLI
  (`~/.hermes/scripts/enviar-whats.py /tmp/msg-<assunto>.txt`) e citar o
  `messageId` devolvido.
- A regra das duas copias (`/mnt/shared/MyFiles/Hermes/`) vale quando o share
  existe; conferir com `test -d` antes de prometer. Em 03/11 nao foi copiado —
  se ela cobrar o arquivo no app Arquivos, esse e o passo que faltou.
