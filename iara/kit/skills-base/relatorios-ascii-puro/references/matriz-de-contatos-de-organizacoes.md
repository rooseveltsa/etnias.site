# Matriz de contatos de organizacoes (ONGs, coletivos, instituicoes)

Pedido tipico (01/11/2026): *"Faca uma varredura na web, sites, blogs, Instagram, X,
TikTok, sobre a tematica desde documento ONGS ... Coloque um resumo das acoes, uma coluna
para cada tipo de contato inclusive numero de whatsapp. Destaque ongs que tem relacao
direta com Brasil, Amazonia e preservacao ambiental pelas Americas."*

E relatorio (ASCII puro) **mais** planilha. Duas saidas, um dado so.

## 1. Base: o PDF que ela manda
O documento dela ja traz nome, pais, e-mail e Instagram — e a fonte primaria da lista.
Extrair com `pymupdf` (esta no `~/.pluma-venv`):

```bash
~/.pluma-venv/bin/python -c "
import pymupdf
d = pymupdf.open('<caminho.pdf>')
open('/tmp/base.txt','w').write('\n'.join(f'=== PAGINA {i+1} ===\n{p.get_text()}' for i,p in enumerate(d)))
"
```

Pitfall: a tabela do PDF quebra palavra no meio da linha (`atendimento@soci\noambiental.org`,
`instagr\nam.com`). Reconstruir os valores a mao ao montar a base; nunca colar o texto cru.

## 2. Varredura (o que se confirma e o que nao)
- Site oficial: `web_search "<org> site oficial"` e conferir o dominio no resultado.
- E-mail/telefone: `defuddle parse <url-de-contato>` + grep de e-mail/telefone (o
  `web_extract` pode estar fora; o defuddle e o caminho).
- Instagram: os @ vem do PDF dela. Se o CDP 9222 estiver fora, **declarar que nao
  reconferiu** em vez de afirmar que o perfil existe.
- X e TikTok: `site:x.com <org>` e `site:tiktok.com <org>`; a busca devolve muito ruido —
  so aceitar handle quando a URL do resultado traz literalmente o @ da organizacao.

## 3. Regra de honestidade (a que da credito ao relatorio)
ONG grande quase nunca publica WhatsApp aberto. O canal real e formulario no site e e-mail;
as brasileiras e indigenas publicam telefone institucional. Escrever
`formulario no site` ou `nao divulgado` — **nunca inventar numero**. Fechar a resposta
dizendo explicitamente quais dados nao foram reconferidos.

## 4. Saida: um script, duas entregas
Manter os dados em UMA lista de tuplas no script e derivar dela:
- `.xlsx` (openpyxl) com uma coluna por canal: Organizacao | Pais/Sede | **Cidade/Sede** |
  Regiao | Acao | Site | E-mail | Instagram | X | TikTok | Telefone/WhatsApp; cabecalho com
  fundo cobre `B87333`, `wrap_text`, `freeze_panes="A2"`, e as linhas do Brasil/Amazonia
  pintadas de `FCE9D6` (o destaque que ela pediu).
- `.txt` ASCII puro, agrupado em A) Brasil/Amazonia (destaque), B) Americas, C) Global.
- O corpo da mensagem leva o conteudo COMPLETO (ela nao abre anexo), e o `MEDIA:` do xlsx
  vai junto.

Script reutilizavel desta sessao: `~/.hermes/scripts/ongs-ambientais.py` (40 organizacoes).

### Correcoes que ela pediu DEPOIS da primeira entrega (01/11/2026) — ja incorporar
- **"coloque de onde e a organizacao tbm"**: pais sozinho nao basta. Ela quer a CIDADE da
  sede (Belem (PA), Manaus (AM), Cuiaba (MT), Gland (Suica), Amsterda...). Coluna propria
  `Cidade/Sede`, com `-` quando a sede nao e publica. Nao inventar cidade: as que nao tem
  fonte ficam `-`.
- **"deixe todos os sites, link pra instagram etc como link clicavel"**: na planilha a
  celula precisa de hyperlink de verdade, nao so o texto do dominio:
  ```python
  cel = ws.cell(row=r, column=6, value="https://" + site)
  cel.hyperlink = cel.value
  cel.font = Font(color="0563C1", underline="single")
  ```
  Instagram com varias contas nao cabe em um hyperlink: a celula guarda as URLs separadas
  por `" | "` e o `hyperlink` recebe a PRIMEIRA. No chat, escrever a URL completa
  (`https://instagram.com/<handle>`, `https://x.com/<handle>`, `https://tiktok.com/@<handle>`)
  para o WhatsApp transformar em link — `@handle` sozinho nao vira clicavel.
- **"adicione as ongs que ja estavam nesse documento com as informacoes fornecidas nele"**:
  abrir uma SEGUNDA ABA `Do documento (PDF)` com o que ela mesma levantou (organizacao,
  pais, e-mail institucional, TODAS as contas de Instagram, inclusive as regionais:
  `@greenpeacebrasil`, `@gpbr.belem`, `@gpbr.manaus`, `@clientearthusa`, `@clientearthde`,
  `@janegoodallcl`...). A varredura acrescenta; a aba do PDF preserva o original dela.
- **"faca uma observacao sobre as ongs que estao em destaque"**: espera ANALISE, nao
  adjetivo. O que funcionou: separar o tipo (instituto de pesquisa x organizacao de base
  indigena), dizer quem financia quem (internacional financia a local, nao executa sozinha),
  apontar o gargalo de contato (quantas publicam telefone), o espaco vazio que sobra
  (comunicacao/arte), quem tem o dado tecnico e onde o mapa tem buraco geografico.

### Pitfall de idioma dos dados
`web_search` de `site:x.com <org>` devolve MUITO ruido (clube de futebol, conta pessoal).
So aceitar handle quando a URL do resultado traz literalmente o @; caso contrario escrever
`-`. Melhor uma coluna vazia que um perfil errado numa peca de divulgacao.

## 5. Estrutura da resposta que funcionou
1. Uma linha de numeros: quantas organizacoes, quantas com relacao direta com Brasil/Amazonia.
2. "O QUE A BUSCA MOSTROU" — 3-4 achados gerais (WhatsApp nao existe aberto, Instagram e o
   canal mais ativo, X so em parte das orgs, TikTok em poucas).
3. Blocos por organizacao: nome (pais) / Acao / site, e-mail / Instagram, X, TikTok /
   telefone.
4. Planilha + descricao das colunas.
5. Ressalvas honestas (o que nao foi reconferido e por que).

## 6. Acrescentar uma ABA nova a planilha que ja existe

Pedido recorrente (01/11 e 02/11/2026): *"acrescentar a essa pesquisa uma aba de <tema>"* —
primeiro LinkedIn, depois "Onde atua", "Acao no Brasil/LatAm", "Financiamento e doadores",
"Fontes oficiais" e por fim **"Investidores diretos e seus contatos"**.

**Pitfall de arquitetura:** a planilha nasceu de um gerador (`~/.hermes/scripts/ongs-ambientais.py`)
que recria o arquivo inteiro a partir da lista `DADOS`. Se a aba nova for criada com
`load_workbook` + `create_sheet`, ela **desaparece na proxima vez que o gerador rodar**. Escolher:

- **aba permanente** -> acrescentar a lista no gerador (e o certo quando o tema e estrutural);
- **aba avulsa** -> script separado que faz `load_workbook`, apaga a aba se existir
  (`if nome in wb.sheetnames: del wb[nome]`) e recria. Rodar de novo e sempre seguro, e nao
  toca nas outras abas nem nas edicoes manuais dela.

Script desta sessao: `~/.hermes/scripts/ongs-investidores-aba.py` (24 investidores, 9 colunas).

### Schema que funcionou — "Investidores diretos"
`Investidor | Tipo | Pais/Cidade | Foco de investimento | Site | E-mail | LinkedIn | Instagram | Observacao`

- Estruturado por tipo, nao por ordem alfabetica: **Brasil (5)** -> **multilaterais (7)** ->
  **gestoras de capital natural/carbono (5)** -> **filantropia internacional (7)**. Ela navega
  por bloco.
- Destaque `FCE9D6` nas linhas com "Brasil" na origem ou "Amazonia" no foco — a mesma convencao
  da aba principal.
- **E-mail: so 5 dos 24 publicam endereco aberto** (Kaete, MOV, Moore, Oak, Laudes). Nos outros
  19 escrever `formulario no site`. Nao inventar `contato@<fundo>.com` — fundo de investimento
  raramente expoe e-mail, e um endereco errado queima o contato.
- Onde o e-mail aparece: nao no site do fundo (JS), mas em **listagens de terceiros** do setor
  (ex.: `investircomimpacto.org.br/ator/<fundo>/` publica o e-mail da pessoa responsavel). Vale
  procurar `"<fundo>" contato email` antes de desistir.
- Instagram institucional de investidor praticamente nao existe: coluna fica `nao encontrado` de
  proposito, e isso se explica no fechamento.
