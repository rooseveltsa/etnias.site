---
name: relatorios-ascii-puro
description: "PESQUISA, DOSSIE, COMPARATIVO, SURVEY, comparar apps/ferramentas, 'pesquisar a fundo', 'quais as opcoes', alternativas a X, relatorio, INVENTARIO DE FERRAMENTAS/FLUXOS/REUSO/REPLICACAO ('o que podemos aproveitar', 'o que replicar para outro agente'), BLOCO FALADO ('apenas me mande para eu ouvir'), PROPRIEDADES DO PC (armazenamento, memoria ram, saude da bateria, 'cabe num pendrive') -> ASCII puro via scripts/exportar-ascii.py + copia .txt em /mnt/shared/MyFiles/Hermes/ + conteudo completo no chat; o FORMATO pedido por ela vence (markdown com tabelas quando ela pede markdown; prosa corrida sem tabela quando e para ouvir). Toda saida escrita para a Vytorya. Inclui como EXPLICAR assunto tecnico pra ela - metafora simples, nunca jargao interno sem definir, modo caveman no chat com o coracao preservado."
version: 1.0.0
author: Hermes Agent
enabled: true
---

# Relatorios em ASCII puro (para colar em outra IA / documento)

## Quando usar
- Vytorya pede "relatorio", "a estruturacao atual", "o protocolo" ou qualquer texto
  "para conversar com meu DeepSeek" / "para colar em documento".
- Vale para QUALQUER relatorio pedido por ela, dentro ou fora do ARARA. Regra
  confirmada por ela em 09/09/2026 e reaplicada em toda saida que ela vai colar
  em outra ferramenta.
- VALE TAMBEM PARA PESQUISA E COMPARATIVO. Se ela pede "pesquisar a fundo",
  "comparar X e Y", "quais as opcoes de Z" com varios itens e tabela de
  pros/contras, o resultado e um relatorio na pratica — mesmo sem a palavra
  "relatorio". Entregar em ASCII puro + copia .txt, nao so markdown no chat.

### GATE OBRIGATORIO antes de fechar pesquisa/dossie (erro repetido 3x)

Esta falha ja aconteceu TRES vezes, TODAS em pesquisa de apps de notas/base de
conhecimento — por isso as palavras-chave PESQUISA/DOSSIE/COMPARATIVO agora
ABREM a descricao da skill (o trigger tem que aparecer mesmo se o description
vier truncado na varredura automatica de skills):

- 21/09/2026 (1a): survey de bases self-hosted saiu em markdown com tabelas e
  emojis, salvo so como .md na home, sem a copia .txt.
- 21/09/2026 (2a): dossie de apps PKM com banco local (10 apps) repetiu
  EXATAMENTE o mesmo erro — markdown, emojis coloridos de secao, salvo so em
  ~/dossie-apps-pkm-local-2026.md, sem conversao ASCII e sem .txt em
  /mnt/shared/MyFiles/Hermes/.
- 21/09/2026 (3a): dossie de apps PKM baseados em ARQUIVO MARKDOWN (~8 apps,
  alternativas ao Obsidian, com "para CADA um responda 1..6") repetiu o erro
  UMA TERCEIRA vez — resposta em markdown com titulos `##`, negrito, emojis de
  secao (estrela, X vermelho), zero conversao ASCII, zero copia .txt. A skill
  nem foi carregada: o pedido foi lido como "pesquisa/dossie tecnico", nao como
  "relatorio", e o description que apareceu na varredura estava truncado em
  "Como produzir saida escrita para a Vytorya. (a) Relatorio..." — as palavras
  PESQUISA/DOSSIE/COMPARATIVO nao estavam visiveis no momento da decisao.

CHECK DE 10 SEGUNDOS, antes de comecar a pesquisar (nao antes de responder):
o pedido dela tem "pesquisar a fundo", "alternativas a X", "comparar", "quais as
opcoes", "dossie", "cubra no minimo ... para CADA um", "ordenado por"? Se sim,
esta skill se aplica — carregar AGORA. O sinal mais forte continua sendo a
mensagem dela vir SEM ACENTO NENHUM.

Checklist que TEM que ser cumprido antes de responder a uma pesquisa:

1. Converter o .md com `scripts/exportar-ascii.py` (sem acentos, sem emojis,
   tabelas markdown viram lista "- c1 | c2").
2. Salvar a copia .txt em `/mnt/shared/MyFiles/Hermes/`.
3. MANDAR O CONTEUDO COMPLETO no chat (ela copia pro DeepSeek) — so passar o
   caminho do arquivo NAO resolve e nao conta como entrega.
4. Nao entregar dossie de pesquisa so como arquivo .md na home.

Sinal de disparo: pedido dela vem sem acento nenhum ("pesquisar a fundo",
"banco de dados local", "maquina fraca"), quase sempre pedindo para comparar
varias opcoes com pros/contras. Isso e relatorio.
- Sinal de que o pedido veio dela: mensagem sem acento nenhum e sem cedilha
  ("servidor proprio", "maquina fraca", "nao so ler"). O ASCII e o estilo dela —
  a resposta deve casar com o pedido, nao responder em markdown.

## Regras de formato (obrigatorias)
- Texto ASCII puro: sem acentos, sem cedilha (vira 'c'), sem emojis, sem
  ═ → — – · • (viram hifen '-'). ACENTO TAMBEM SAI — nao so o enfeite.
- Nada de tabelas markdown: virarem listas, ex.: "- coluna1 | coluna2".
- pt-BR, direto, sem enrolacao.

### PITFALL: acento + enfeite = texto trocado ao colar (caso real 22/09/2026)
A 1a versao do relatorio saiu com acentos, linhas ═══, travessao longo (—) e emoji de
secao. Ela colou no chat do DeepSeek e voltou TRUNCADO/ALTERADO (as bordas ═ sumiram,
o texto ficou ilegivel em trechos). Pediu reescrita; a versao que funcionou — aprovada
por ela com "agora esta certo" — foi 100% ASCII, SEM acento nenhum, com "=" no lugar das
linhas decorativas. Conclusao: nao tentar "so tirar o enfeite"; transliterar TUDO
(acento, cedilha, emoji, seta, travessao, borda). Foi a primeira vez que se provou que
o acento sozinho ja corrompe no destino.
- Relatorio escrito do zero (nao convertido de um .md) segue a mesma regra: salvar o .txt
  e colar o conteudo COMPLETO no chat. Caminhos usados na pratica:
  ~/relatorio-arara-acessos-mp.txt, ~/relatorio-arara-deepseek.txt. Se der, copiar tambem
  para /mnt/shared/MyFiles/Hermes/.

### PITFALL: citar a mensagem dela contamina o documento com acento (27/09/2026)

Documento escrito DO ZERO (nao convertido de .md) nao passa pelo `exportar-ascii.py` — e foi
assim que a primeira versao do "PLANO NUVEM" saiu com `ç é ê õ`: eu abri o documento colando o
PEDIDO LITERAL dela ("...quando eu terminar todas essas estruturas...") e o acento da citacao
veio junto. Nada mais no arquivo tinha acento; so a citacao.

- **Regra:** ao citar a fala dela dentro de um documento ASCII, transliterar a citacao tambem
  (ou marcar como parafrase). Nao existe "texto entre aspas pode ficar com acento".

#### A linha `Pedido:` e o vetor mais comum — e o CONSERTO tambem erra (30/10/2026)

Segunda ocorrencia do mesmo defeito, agora no cabecalho de um inventario de estruturas: o documento
inteiro saiu limpo, mas a linha `Pedido: "relatorio completo das estruturacões..."` carregou o
acento dela. O `verificar-ascii.py` pegou (`linha 7, coluna 43: 'o' com til`) antes de qualquer
entrega.

O erro NOVO foi no conserto: ao reescrever a linha eu RETIPE a palavra acentuada, o arquivo falhou
uma segunda vez e queimou mais um patch. Regras que fecham o buraco:

- **Conserto de ASCII se faz REFORMULANDO a frase, nunca retipando o original.** Trocar a citacao
  literal por parafrase ("palavras dela, transliteradas para ASCII") mata o problema na raiz. Se for
  obrigatorio manter a citacao, digitar a palavra inteira sem acento — nunca copiar e "limpar depois".
- **Nascer com a linha `Pedido:` ja em parafrase.** O acento entra ali porque a frase dela vem
  colada na cabeca do agente; escrever de primeira como resumo custa zero.
- **Rodar o `verificar-ascii.py` DEPOIS de cada `patch`, nao so depois do `write_file`.** Foi o check
  pos-patch que provou que o conserto tinha reaberto a falha. Um check unico no arquivo inicial teria
  deixado passar.
- **Copiar para o share DEPOIS da correcao e provar com `md5sum` nos dois caminhos.** Copia feita
  antes do conserto deixa a versao ruim no `/mnt/shared/MyFiles/Hermes/`, que e justamente a que ela
  abre pelo app Arquivos.
- **Limpeza em um comando** (para documento feito a mao, sem .md de origem):
  ```bash
  python3 - <<'EOF'
  import unicodedata
  from pathlib import Path
  p = Path("<arquivo.txt>")
  t = p.read_text(encoding="utf-8")
  p.write_text(unicodedata.normalize("NFKD", t).encode("ascii", "ignore").decode("ascii"),
               encoding="utf-8")
  print("nao-ASCII agora:", sorted({c for c in p.read_text(encoding='utf-8') if ord(c) > 127}))
  EOF
  ```
- **Antes de mandar o anexo no WhatsApp**, rodar a contagem de bytes > 127. Achando acento:
  corrigir o arquivo, **reenviar a versao corrigida** e avisar na legenda que a anterior tinha
  acento (ela valoriza a correcao explicita). Mandar arquivo com acento e o mesmo que entregar
  o relatorio quebrado — o destino dela (DeepSeek/documento) corrompe.
- Anexo de `.txt` funciona no bridge: `POST /send-media` com `mediaType: "document"` (testado
  27/09/2026, responde `success:true`). Para texto simples no chat, a rota e `POST /send` com o
  campo `message` (nao `text`, nao `/send-message` — essa da 404).

### PITFALL: pedido de relatorio nao vira investigacao (correcao dela em 22/09/2026)
Ela pediu o relatorio e eu comecei a explorar o painel do Mercado Pago por CDP para
"enriquecer" o documento. Resposta dela: "so quero o relatorio por favor" — seguida do
pedido repetido DUAS vezes na mesma conversa e de "se lembra da nossa ultima sessao?".
Pedido de relatorio repetido igual = sinal de frustracao: eu nao estava entregando o que
foi pedido.
- Regra: pedido de relatorio se entrega com o que ja se sabe. Leitura rapida de estado
  (1-2 checagens objetivas) e OK; abrir navegador, inspecionar painel, explorar fluxo novo
  NAO e — isso e tarefa separada, e vira o relatorio errado (fala do que eu descobri, nao
  do que ela pediu).
- Se faltar um dado, escrever "nao verificado" no documento em vez de ir buscar na hora.
- Antes de entregar, reler o pedido literal dela: "como esta o protocolo" + "o que preciso
  fazer para X" sao duas secoes, e ele quer as duas.

### Status de SISTEMA: uma rodada de medicao e obrigatoria, e a premissa do pedido pode estar vencida (03/11/2026)

Contraponto ao pitfall acima, e a distincao importa. Ali o erro era ABRIR FLUXO NOVO
(navegador, painel) quando ela so queria o documento. Aqui o pedido e relatorio de
status de um sistema que mudou desde o ultimo ticket — e entregar "com o que ja se
sabe" produz documento errado.

O caso: pedido de relatorio sobre a implementacao do MCP de memoria dizia na letra
"schema v2 versus v3, faltam as colunas classification/confidence/client_namespace".
Era verdade tres horas antes. Na hora do relatorio as colunas ja existiam, 56 no
lugar de 46, e o bloqueio real era outro (`42804`, funcao quebrada em execucao).
Repetir a premissa teria entregue um relatorio tecnicamente falso, com "o que falta"
apontando para o que ja estava feito.

- **Uma rodada de leitura, nao uma investigacao.** Medir a FONTE do estado (banco,
  `_traqr_migrations`, `schema_version`, colunas, contagem) e parar. Isso e 4 ou 5
  chamadas read-only, nao exploracao de fluxo novo.
- **Corrigir a premissa DENTRO do relatorio**, em paragrafo proprio ("a premissa X
  esta vencida; estado medido agora e Y"). Ela cobra o metodo ("como vc achou?") e
  aceita bem a correcao explicita — o que ela nao aceita e documento que confirma o
  que ela acreditava quando o mundo mudou.
- **Separar observado de inferido.** Numero medido leva o comando que o mediu;
  conclusao que veio de deducao leva a palavra "inferencia" ao lado. Ex.: colunas
  presentes = medido; "entao o memory_store deve passar" = inferencia, e foi escrito
  assim.
- **Evidencia antiga em `/tmp` nao existe mais.** Se o relatorio precisa citar uma
  tentativa anterior, puxar do historico de sessoes (`session_search`) e dizer que o
  arquivo original ja nao esta em disco — nunca escrever "conferi o print" sobre
  arquivo que sumiu.
- **Nao executar o conserto no meio do relatorio.** Ela pediu explicitamente "nao
  execute nenhuma ferramenta agora, apenas leia"; leitura de estado e escrita de
  arquivo de relatorio sao permitidas, migracao/gravacao nao. Fechar com as OPCOES
  e a ordem tecnica, e esperar a escolha.

### REGRA DA SUBSTITUICAO: relatorio novo apaga os antigos (ordem dela, 30/10/2026)

Pedido literal: *"sempre que eu pedir um novo, apague os antigos"*. Vale para
relatorio de INVENTARIO/ESTRUTURACAO/FLUXO — a familia do mesmo documento.

- Gerar o novo em `~/Hermes/Pexinxavel/A.R.A.R.A/Relatorios/RELATORIO-ESTRUTURACOES-<AAAA-MM-DD>.txt`
  (e a copia em `/mnt/shared/MyFiles/Hermes/`).
- Depois de salvar, APAGAR as versoes anteriores da MESMA familia
  (`ESTRUTURA-COMPLETA-*`, `FLUXO-COMPLETO-*`, `A.R.A.R.A-estruturacao-atual.txt`).
  Fica so a atual: o nome datado continua sendo a linha do tempo, mas com um arquivo so.
- NAO apagar por conta propria o que e de outra familia ou entrega diferente:
  `PROTOCOLO-ARARA-PEXINXAVEL.txt` (documento canonico), `MAPA-MENTAL-FLUXO-*`
  (trio pedido a parte), `relatorio-fluxos-*`, relatorio de setor especifico,
  relatorio de vendas. Se ficar em duvida, listar e perguntar.
- Reportar o que apagou pelo nome, um por um (ela confere).
- No fechamento, dizer explicitamente que o arquivo atual esta salvo e que os
  anteriores sairam — sem afirmar sem ter conferido com `ls`.

## Procedimento
1. Fonte da verdade: o .md original (ex.: ~/.hermes/skills/arara-pexinxavel/SKILL.md).
   NUNCA reproduzir o conteudo de memoria — converter do arquivo.
2. Converter com o script desta skill:
   python3 ~/.hermes/skills/relatorios-ascii-puro/scripts/exportar-ascii.py <entrada.md> /mnt/shared/MyFiles/Hermes/<NOME>.txt
3. Salvar a copia em /mnt/shared/MyFiles/Hermes/ (ela abre pelo Files do ChromeOS) E
   MANDAR O CONTEUDO COMPLETO na propria mensagem — ela copia do chat para o DeepSeek.
   So o caminho do arquivo nao resolve.
4. Se o assunto for ARARA/protocolo: acrescentar no fim um bloco
   "ESTADO ATUAL E PENDENCIAS (data)" com: o que funciona agora, crons
   pausados/ativos, bloqueios e pendentes, e as regras de ouro (nunca transferir
   sem OK dela; comprovante so print real, nunca imagem gerada).
5. Mensagens literais do protocolo (ex. "PAGO-LOJA" usa o emoji de aprovacao no
   WhatsApp real): incluir nota no topo do documento avisando que "[OK]" = emoji,
   mantido na execucao real.

## Script de conversao
scripts/exportar-ascii.py — converte Markdown em ASCII puro:
- Remove o frontmatter YAML (somente a 1a e a 2a linha '---').
- Remove acentos via NFD + descarte de combining marks.
- Emojis viram marcadores: [OK], [AVISO], [ERRO]; demais sao removidos.
- Setas/travessoes (→ — – · • ⇒) viram hifen '-'.
- Tabelas Markdown viram registros de lista '- c1 | c2' (cabecalho/separadores descartados).
- Saida garantida 100% ASCII; linhas dentro de ```fences``` passam intactas.

PITFALL validado (09/09/2026): NAO remover frontmatter com split('---') — o corpo
do markdown usa '---' como separador de secao e o texto sai truncado. Cortar apenas
a 1a e a 2a linha '---'.

## Exemplo real
09/09/2026: /mnt/shared/MyFiles/Hermes/A.R.A.R.A-estruturacao-atual.txt
(protocolo v2.0 completo + estado atual) gerado a partir de
~/.hermes/skills/arara-pexinxavel/SKILL.md.

## Como EXPLICAR assunto tecnico pra ela (alem do formato do relatorio)

Sao duas coisas separadas: o FORMATO do relatorio (ASCII puro, acima) e a EXPLICACAO. As duas valem.
Regras confirmadas em 21/09/2026.

### REGRA PERMANENTE: explicacao SEMPRE em DUAS CAMADAS (pedido explicito dela, 22/09/2026)

Pedido literal: *"preciso que sempre me explique de forma tecnica, mas tbm me de metaforas simples
do q vc fez pois nao entendo, estou aprendendo automacao atraves de todos esses projetos que estou
desenvolvendo"*. Deixou de ser "quando ela pede metafora" — virou o padrao de TODA explicacao de
trabalho feito, em qualquer sessao (chat, WhatsApp, cron).

Ordem e formato aprovados por ela:
1. **Camada tecnica primeiro** — nomes reais (arquivo, rota, env var, comando), o que muda e por que.
2. **Camada da metafora em seguida** — imagem concreta do mundo dela (porteiro na porta, dois
   cozinheiros na mesma boca do fogao, post-it grampeado na foto, caderninho de anotacao, passar a
   caneta num livro de biblioteca).
3. Encaixar as duas POR ITEM explicado (rotular ajuda: `Tecnico:` / `Em metafora:`), nao jogar todas
   as metaforas no fim do texto.

- **Ela esta aprendendo automacao com esses projetos.** Escolher UM ensinamento generalizavel do que
  aconteceu e dizer em uma frase (caso real 22/09: "falha em massa quase nunca e o seu codigo, e
  ambiente — 146 testes vermelhos de uma vez eram um plugin faltando"). Ensinar o padrao, nao so
  relatar o caso. Ela valoriza isso explicitamente.
- Quando ela perguntar "o que e X?" de um jargao (ex.: "o que e commite?"), comecar pelo caso REAL
  dela (o repo, o commit, o remote) e so depois a definicao generica — ela aprende pelo proprio
  ambiente.
- Toda explicacao com decisao embutida deve separar **o que e decisao dela** do **que e execucao
  minha** (ex.: commitar local = meu trabalho; dar push no GitHub = decisao dela).

### Relatorio de ESTADO DE FLUXO (template pronto)

Quando ela pedir "relatorio do que fizemos hoje", "como esta o fluxo X agora", "gera um relatorio
pra eu saber se todo o fluxo esta correto": usar `templates/relatorio-estado-fluxo.txt` — fluxo
ponta a ponta -> o que funciona HOJE (com prova) -> o que foi feito -> BLOQUEIOS x PENDENCIAS (com
dono de cada um) -> como conferir sozinha (comandos somente-leitura) -> riscos aprendidos -> ordem
dos proximos passos -> divisao de responsabilidade (decisao dela / execucao minha).
- Separar **BLOQUEIO** (impede o fluxo de rodar) de **PENDENCIA** (nao impede, mas fica devendo):
  foi a distincao que ela mais usou para entender o proprio projeto.
- **Conferir o ASCII antes de entregar** (contar bytes > 127 = 0). O relatorio de 22/09 saiu com uma
  palavra acentuada ("volatil" com acento) e so foi pego na checagem programatica, nao no olho.

### Relatorio de HARDWARE / PC (disco, RAM, bateria, "cabe num pendrive?")

Pedido tipico (28/09/2026): *"me gere um relatorio sobre o meu armazenamento do chromebook,
memoria ram, saude da bateria e tudo relacionado as propriedades do pc"* — contexto: ela ia
passar parte do fluxo para um pendrive. Pedido de propriedades do PC = relatorio: entra nesta skill.

- **Coleta dos dados**: skill `chromebook-linux-admin`,
  `references/inventario-hardware-e-pendrive.md` (comando unico read-only, campos de bateria,
  numeros ja medidos, o `df` mentiroso do 9p, plano de copia item a item para pendrive).
- **Nao inventar numero.** `health` da bateria vem `Unknown` e `cycle_count` vem 0 neste
  modelo (o ChromeOS nao entrega `charge_full_design` ao container). Escrever "Unknown" com o
  motivo e a resposta certa; chutar percentual de saude quebra a confianca no documento todo.
- **Estrutura que funcionou**: identificacao / CPU / RAM / armazenamento / bateria / o que
  ocupa o disco pasta por pasta / o que levar e o que nao levar para o pendrive / como o
  pendrive aparece no ChromeOS / AVISOS (seguranca dos tokens) / "FIM DO RELATORIO".
- **Separar o que e espaco dela do que nao e** (`/dev/vda` = imagem do Crostini, 100% usado;
  `/mnt/chromeos/fonts` = fontes do ChromeOS, 99%) — senao o relatorio assusta sem motivo.
- **Aviso de seguranca obrigatorio** ao falar de copia para pendrive: `~/.hermes/credentials` e
  `.env` tem tokens (MP, Google, WhatsApp) e `~/.config/chromium` tem login do Mercado Pago.
  Pendrive se perde; se levar, cifrar; se perder, revogar tudo.
- **PITFALL de entrega (28/09/2026)**: o `.txt` foi salvo so em
  `~/relatorio-chromebook-<data>.txt` e **nao** foi copiado para `/mnt/shared/MyFiles/Hermes/`.
  Regra: gravar sempre as DUAS copias — a da home e a do share (o share e o que ela abre pelo
  app Arquivos, e e ele que fica ao lado do pendrive).
- Fechar com oferta de acao concreta (o que ELA decide), nao com pergunta aberta.

### Relatorio para TERCEIRO (mensagem, nao documento) — 06/10/2026

Pedido tipico: *\"avise Ramon que voce terminou esta configuracao com um relatorio completo sobre o
que e o agente do caos\"*. Aqui o destino NAO e ela colando num DeepSeek — e uma pessoa lendo no
WhatsApp. Inverte as regras:

- **Prosa normal em pt-BR, COM acento.** Nada de ASCII puro, nada de caveman. A regra ASCII existe
  porque o destino dela corrompe acento; o WhatsApp de terceiro nao.
- **Sem tabelas** (regra dela para WhatsApp) e **sem anexo** — mandar o texto no CORPO da mensagem.
- Estruture em blocos com titulo em caixa-alta e paragrafos curtos: O QUE E / COMO PENSA O
  CONTEUDO / O PLANO / COMO E FEITO / A TRAVA / ONDE FICA NO COMPUTADOR. Terceiro nao conhece o
  contexto: explicar o objetivo politico e o isolamento do brecho sem jargao interno.
- Fechar com oferta concreta (\"se quiser detalhe de roteiro ou de um dia do plano, eu detalho\").
- **Apresentar-se pelo papel:** a mensagem chega de um numero que nao e dela — abrir com \"Oi,
  Ramon! Aqui e o Hermes, o assistente da Vytorya. Ela pediu pra eu te avisar...\".
- Depois de mandar, **avisar ELA que o terceiro foi avisado** (ela pediu os dois avisos na mesma
  ordem).

### Relatorio de INVENTARIO DO FLUXO INTEIRO ("todo o seu fluxo", "todos os agentes")

Pedido tipico (06/10/2026): *"me de um relatorio completo de todo o seu fluxo existente ate agora,
arara, pluma, agente do caos, etc"*. Nao e relatorio de UM fluxo — e o inventario do predio
inteiro: todos os setores, canais, crons, plugins, ferramentas e pendencias.

- **Nao responder de cabeca.** O inventario real sempre tem o que a memoria nao carrega (cron
  pausado, script novo, pendencia aberta). Coletar de fontes vivas antes de escrever — a lista de
  comandos e o snapshot de 06/10/2026 estao em
  `references/inventario-do-fluxo-completo.md`.
- **Coletor em UM bloco** (skills, scripts, setores com `mtime`, estoque, `du`, plugins/MCP e
  `cronjob list`) gravando em `/tmp/inv.txt` e lido com `read_file`: o rtk-rewrite comprime saida
  longa de `ls`/`find`/`du` e a compressao ESCONDE linha. Detalhe no item 1 daquela reference.
- **Variante "com data e hora" (30/10/2026):** quando ela pedir o inventario datado, cada estrutura
  leva o `mtime` real (`/bin/ls -la --time-style=long-iso`) e o cabecalho leva o carimbo de hora da
  geracao. Numero de nuvem que nao foi medido no dia entra como "ultima medicao: <data>", nunca como
  estado de agora. Snapshots 06/10, 13/10 e 30/10 na reference servem de linha do tempo.
**Variante "toda a sua estruturacao atual" (02/11/2026):** o pedido curto de inventario completo, com
dados de agora. O que a coleta precisa acrescentar ao coletor antigo:

- **Servicos no escopo certo:** `hermes-gateway`, `chromium-mp` e `vigia-whatsapp.timer` sao
  `systemctl --user`; consultar o escopo de sistema devolve `inactive` e parece queda do gateway.
  E `systemctl is-active` sai com codigo 3 quando o servico esta parado (o `chromium-mp` fica parado de
  proposito), entao **cadeia com `&&` morre ali** e as linhas seguintes nao rodam — separar com `;`.
- **Contagem no Supabase sem baixar linha:** `Prefer: count=exact` + `Range: 0-0`, ler o header
  `content-range` (`0-0/655` = 655 linhas), com `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` do
  `~/.hermes/.env`. `401` = nome da variavel errado, nao valor.
- **Duas pastas de mesmo nome nao sao atalho:** provar com `stat -c '%i %n'`. Medido em 02/11:
  `~/Hermes/Relatorios` (inode 1481054) e `~/Hermes/Pexinxavel/A.R.A.R.A/Relatorios` (1478181) sao
  DUAS pastas reais — a unificacao registrada em 16/10/2026 nao se manteve. Quem decide a canonica e
  ela; o relatorio registra o achado, nao conserta.
- **`du -sh` num atalho do motor da 4K** — e o esperado, nao erro.
- **Secao obrigatoria "o que mudou desde o relatorio anterior"**: diff dos numeros (skills 167 -> 177,
  scripts 201 -> 212, midias no Supabase 329 -> 655, disco livre 3,4G -> 3,1G). E o que transforma
  inventario em noticia e o que ela usa para decidir o proximo passo.

**Terceira rodada (03/11/2026): coletor pronto e cinco armadilhas medidas**

- Coletor re-executavel, so leitura: `bash scripts/coleta-estruturacao-hermes.sh [saida.txt]`
  (padrao `/tmp/coleta-estrutura.txt`). Cobre motor/git, arvore, brecho, skills, scripts,
  profiles, memoria, optmem, disco, servicos, plugins/MCP, backups, as duas pastas de relatorios
  e as contagens do Supabase por REST.
- **`hermes --version | tail -3` PERDE a linha da versao** — ela e a primeira. Saida inteira ou
  `head -5`. Foi assim que a versao sumiu da primeira coleta.
- **`~/.optmem/memo` e o programa do OptMem, nao o log.** Contar em
  `~/.optmem/memory/LOG.txt`; `memo` tem 859 linhas de Python e da numero falso.
- **`du -sh skills/*` nao ve pasta com ponto.** Rodar tambem `du -sh skills/.[!.]*`: em 03/11
  apareceram `.curator_backups` (513M) e `.hub` (50M), e o clone `profiles/impl/skills` (673M)
  carrega os mesmos 513M. Essa e a causa real do disco em 92%, nao o OpenMontage.
- **Nunca sondar `enviar-whats.py --help`**: ele abre `sys.argv[1]` como arquivo e estoura
  `FileNotFoundError`. Texto no `.txt`, caminho como argumento.
- **Apagar a versao anterior so depois de provar a nova**: `test -s novo && rm -f antigo`, e
  fechar com `ls` mostrando que sobrou um arquivo so. Local canonico atual:
  `~/Hermes/Relatorios/RELATORIO-ESTRUTURACOES-<data>.txt`.
- Snapshot de numeros (02/11 x 03/11) e o raio-x do disco:
  `references/coleta-de-estruturacao-do-hermes.md`.

**Regerar o mapa oficial e aposentar o antigo, sem quebrar o prompt:** gravar o novo em
`~/Hermes/Relatorios/RELATORIO-ESTRUTURACOES-<data>.txt`, copiar igual para
`~/.hermes/skills/atualizacao-arquitetura-agentes/references/mapa-oficial-<data>.txt`, **provar com
`md5sum` que os dois batem**, apagar o relatorio e o mapa antigos — e entao **recriar o nome antigo
como atalho** (`ln -sfn mapa-oficial-2026-11-02.txt mapa-oficial-2026-10-30.txt`), porque o prompt de
sistema cita o nome velho e a proxima sessao procuraria arquivo inexistente. Atalho de nome nao e
copia: a regra de substituicao continua valendo. A skill `atualizacao-arquitetura-agentes` e escrita a
mao (o curator nao consegue gravar nela em passada automatica) — o ponteiro do mapa tem que ser
patcheado na hora, pela sessao.

- Fontes: `cronjob(action='list')` (nao ler `jobs.json` a mao — a listagem ja separa ativo de
  pausado e traz `deliver`/`last_status`), `ls ~/.hermes/scripts/`, `ls ~/.hermes/skills/`, o
  `plugins` + `mcp_servers` do `config.yaml`, contagem das pastas de estoque e os arquivos de
  pendencia (`~/.hermes/pendente-deadarch.md`, `~/Hermes/Pexinxavel/A.R.A.R.A/Relatorios/pendente-*.md`).
- Descricao de cada setor: ler o `description:` do frontmatter das SKILL.md dos setores
  (`atualizacao-arquitetura-agentes`, `arara-pexinxavel`, `arara-pesquisa-tendencias`,
  `pluma-pexinxavel`, `pluma-video`, `video/curadoria-e-edicao-de-video` = Agente do Caos). Foi
  escrito para resumir o escopo inteiro em uma linha.
- Estrutura que funcionou (13 secoes): mapa dos setores > A.R.A.R.A. > Subagente de Pesquisa >
  P.L.U.M.A. > Curator.X > Agente do Caos > T.R.A.M.A. > canais de venda e conexoes > crons >
  plugins e MCP > ferramentas internas > regras que valem em todo setor > pendencias abertas.
- Marcar FUTURO (Gerente de Rendas) separado do que esta ATIVO — ela precisa saber o que ja roda
  hoje.
- Entrega: ASCII puro, salvo em `~/Hermes/Pexinxavel/A.R.A.R.A/Relatorios/FLUXO-COMPLETO-<AAAA-MM-DD>.txt` **e**
  conteudo completo no chat (o nome datado vira a linha do tempo dos inventarios).
- **Contagem que ela espera no inventario (13/10/2026):** skills (total + proprio x nativo), scripts
  proprios, servicos systemd, crons ativo x pausado, plugins ligados, MCP, plataforma conectada,
  contagem de pecas no acervo e as pendencias. Sem esses numeros o documento parece incompleto.

### Inventario de FERRAMENTAS, reuso e replicacao (05/11/2026)

Familia diferente do inventario de pastas: aqui o objeto e a FERRAMENTA (motor, modelo, MCP, CLI,
integracao, binario) e a decisao e REUSO ou REPLICACAO para outro projeto/agente. Receita com os
comandos de coleta, as duas escalas de classificacao, os pitfalls medidos e o snapshot de 05/11:
`references/inventario-de-ferramentas-e-reuso.md`.

- **Declarar o que NAO existe** (n8n, LangGraph, CrewAI, Ollama, ComfyUI local, LinkedIn/FB/TikTok/
  YouTube). "Nao existe" medido vale mais que silencio: sem isso ela assume que talvez exista.
- **Duas escalas que nao se misturam:** aderencia ao projeto (reaproveitar / adaptar / fundir /
  descartar / lacuna) e replicabilidade (direto / com adaptacao / nao replicavel / substituir).
  Toda linha leva justificativa de UMA linha, senao a tabela vira opiniao.
- **Separar configuracao, codigo, credencial e dado.** Regra que se repete: replicar configuracao e
  padrao; ferramenta pesada se compartilha por chamada, nunca se copia. Credencial vai no anexo so
  por NOME e ESCOPO, nunca pelo valor.
- **A conta tem que fechar:** total = soma das classes no resumo executivo (35 = 17+13+3+2). Se nao
  soma, a tabela esta errada.
- **Procurar arte pronta antes de propor construir:** `~/.hermes/assets/` e as pastas de arte ja
  tinham paleta, 6 logos e 4 MP4 do Etnias/Opy — achado que muda a conclusao do relatorio inteiro.

### "Apenas me mande de volta para que eu possa ouvir" = BLOCO FALADO

Pedido de 05/11/2026. Ela vai colar num leitor de voz — nao e relatorio ASCII.

- Um bloco corrido de prosa: **sem tabela, sem bullet, sem cabecalho markdown, sem caminho de
  arquivo**. Qualquer um dos quatro quebra a leitura em voz alta.
- Frase curta mais completa (TTS corta mal fragmento). Numero escrito como se fala
  ("dois tercos", nunca "2/3"). Sem emoji, exceto o ❤️ no fim.
- Comprimido, mas gramatical: o caveman vale para o estilo do chat, nao para texto que vira audio.
- Ordem que funcionou: o que ja existe -> o que e adaptacao -> o que e lacuna -> o que nao temos ->
  fecho com o caminho mais curto.

### O formato e o que o PEDIDO define (05/11/2026)

No mesmo dia ela pediu tres formatos: bloco falado, relatorio em texto, e **Markdown com tabelas e
sumario executivo**. Quando o pedido traz "formato da resposta: use tabelas" ou "entregue em
Markdown", a regra ASCII puro NAO se aplica — o pedido vence. Sem formato explicito, vale o padrao
desta skill (ASCII puro + copia .txt). Nunca "corrigir" para ASCII um documento que ela pediu em
markdown.

### Pedido de inventario COM mapa mental (13/10/2026)

Pedido tipico: *"...faca um documento txt e um mapa mental"*. Aqui a entrega e TRIO, nao um arquivo:
o relatorio `.txt` + a arvore em `.txt` + um `.html` visual (arquivo unico, um card por ramo, ramo
abrindo e fechando no clique).

- Receita completa (desenho da arvore, padrao do HTML, checagem): `references/mapa-mental-do-fluxo.md`.
- Template pronto do HTML: `templates/mapa-mental.html` — copiar e trocar o conteudo dos cards.
- Pasta: `~/Hermes/Pexinxavel/A.R.A.R.A/Relatorios/`; os dois `.txt` vao tambem para
  `/mnt/shared/MyFiles/Hermes/` (regra das duas copias); o `.html` fica so na pasta de relatorios.
- Conferir ASCII nos TRES arquivos antes de entregar (`grep -cP '[^\x00-\x7F]'` = 0) — inclusive no
  HTML, que escapa da checagem por nao parecer "documento".
- Nao abrir o navegador por conta propria para mostrar o mapa: entregar o caminho e OFERECER abrir.

### Entrega quando a sessao e CLI (terminal), nao WhatsApp (13/10/2026)

Em sessao de terminal nao existe canal de anexo: `MEDIA:<caminho>` nao e interceptado e aparece como
texto literal na resposta. Nesse caso a entrega e (1) o conteudo COMPLETO dos `.txt` no corpo da
resposta — ela copia dali — e (2) o **caminho absoluto** de cada arquivo em texto simples. Vale a
regra de sempre: so dar o caminho nao conta como entrega quando ela pediu o texto. Fechar oferecendo
a proxima acao concreta (ex.: "quer que eu abra o mapa na tela?"), nunca com pergunta aberta.

### Espelhar a resposta de terminal no WhatsApp dela (ordem de 01/11/2026)

Em sessao CLI, toda resposta minha vai tambem para o WhatsApp dela. Mecanica medida em
02/11/2026 e que funciona:

- Script generico: `~/.hermes/scripts/enviar-whats.py <arquivo.txt> [chatId]` — default
  `5511951728071@s.whatsapp.net` (o `@lid` nao chega). Ele faz `POST http://127.0.0.1:3000/send`
  com corpo JSON `{"chatId": ..., "message": ...}`; o campo e `message`, nao `text`.
- **Escrever o texto num arquivo antes** (`/tmp/aviso-<assunto>.txt`) e chamar o script com o
  caminho: comando inline longo e barrado nesta maquina, e heredoc no terminal vira rodada perdida.
- O bridge QUEBRA a mensagem sozinho: 13.575 bytes (relatorio de estruturas) sairam em 4 chunks e a
  resposta traz `messageIds` com os 4 ids. Nao picar na mao.
- Citar o `messageId` no fechamento da resposta ("espelhado no WhatsApp, id ...") e o que prova a
  entrega; sem o id, e promessa.
- Limite que nao se confunde: **espelhamento automatico e PRE-AUTORIZADO** (adendo do `SOUL.md`,
  02/11/2026); mensagem que EU decido mandar para cliente/terceiro continua exigindo OK dela.


### Relatorio DETALHADO de UM setor (pedido de 06/10/2026)

Pedido tipico: *"me de apenas um relatorio super detalhado do agente Pluma e o que ele faz"* —
um setor so, no maximo de detalhe. Mesmo formato do inventario, mas fundo em vez de largo.

- **Nao responder de cabeca nem so pela SKILL.md principal do setor.** Ler TODAS as skills do
  setor e a documentacao de apoio antes de escrever. No caso do P.L.U.M.A. foram 5 SKILL.md
  (`pluma-pexinxavel` com 781 linhas, `pluma-video`, `edicao-video-sincronizada-a-batida`,
  `geracao-de-imagens-e-posts`, `pluma-marketing`) + `essencia-pexinxavel.md` +
  `visual-style.md` + os scripts `pluma-*.py`. A skill principal e longa: ler em DUAS passadas
  (`offset 1-400` e `401-fim`) — so o cabecalho nao conta.
- **Cruzar o que a skill DIZ com o que o disco TEM.** Foi o que deu valor ao relatorio do PLUMA:
  a skill descreve o fluxo ideal; o disco mostra o estado real (`publicados/<canal>/` vazias,
  `templates/trilhas/` sem nenhuma trilha, 1 Reels publicado, 2 DROPs montados, 47 pastas de
  peca). Reportar a divergencia COM o caminho — e isso que ela usa para decidir o proximo passo.
- Coleta de estado usada: `ls -1 ~/Hermes/Pexinxavel/P.L.U.M.A/Publicados/*/ | wc -l`, `ls ~/Hermes/Pexinxavel/P.L.U.M.A/Templates/`,
  `ls -1 ~/Hermes/Pexinxavel/P.L.U.M.A/Processados/carrossel-drops/`, contagem das pastas do estoque,
  `cronjob(action='list')`. Nomear o que esta ATIVO, o que esta PROPOSTO e o que esta VAZIO.
- Estrutura que funcionou (14 secoes, caso PLUMA): identidade > skills que formam o setor >
  fluxo por fases > arvore de pastas > kit e regras tecnicas > scripts > video (motor +
  pitfalls) > publicacao por API > geracao de imagem > post de frase > carrossel/stories/grade >
  estado real hoje > travas e regras de ouro > pendencias do setor.
- Entrega: ASCII puro, em `~/Hermes/Pexinxavel/A.R.A.R.A/Relatorios/<SETOR>-RELATORIO-DETALHADO-<AAAA-MM-DD>.txt`
  + conteudo completo no chat.

### Relatorio de FLUXO DO PROTOCOLO (pedido recorrente dela) — regras de conteudo

Pedido tipico (22/09/2026): "me mostre como esta todo o fluxo do protocolo A.R.A.R.A detalhadamente"
+ "nao se esqueca das suas funcoes em cada grupo e nos directs".

- **OBRIGATORIO abrir com a secao "FUNCOES POR CANAL"** — um bloco por canal: grupo de vendas,
  grupo comissionado, grupo de duvidas, direct dela (comando/confirmacao), direct com as outras
  marcas (pedido de repasse) e atendimento ao cliente. Ela cobra isso explicitamente: fluxo sem a
  divisao por canal fica incompleto pra ela. Em cada bloco separar **LEITURA** de **ESCRITA** (e o
  que nunca fazer naquele canal).
- Fonte: SKILL.md da arara + as correcoes ditadas NA PROPRIA SESSAO. Elas chegam depois do
  documento nascer — **reescrever o .txt no mesmo dia**. Em 22/09/2026 o arquivo foi atualizado 3x
  (janela da loja, cobertura do Atila, print da simulacao x atividade vinculada).
- Caminho canonico: /mnt/shared/MyFiles/Hermes/protocolo-<assunto>-<AAAA-MM-DD>.txt
  (ex.: protocolo-arara-completo-22-09-2026.txt) + **conteudo completo no chat** + `MEDIA:` do .txt.
- Secoes que ela usa pra conferir se o agente "entendeu": funcoes por canal, janela de operacao,
  ordem de leitura (filtro da escala), o que muda em cada tipo de venda, regras de ouro (nunca
  transferir/postar sem OK; comprovante real; **simulacao sempre junto do comprovante**) e
  PENDENCIAS ABERTAS.
- Rodape de fechamento: `====` + `FIM` + `====`, e informar bytes/linhas na mensagem.
- **Verificar bytes nao-ASCII ANTES de entregar — com o script, nao no olho:**
  ```bash
  python3 ~/.hermes/skills/relatorios-ascii-puro/scripts/verificar-ascii.py \
      /mnt/shared/MyFiles/Hermes/<NOME>.txt
  # exit 0 = ASCII puro; exit 1 = lista linha/coluna/caractere + o que virar (nao entregar assim)
  ```
  (`scripts/verificar-ascii.py` = checagem byte a byte com sugestao de transliteracao; use
  `--silencioso` para encadear num script. Antes era feito "contando `b > 127` a mao" — o script
  faz isso e ainda mostra ONDE esta o problema.)

### Documento FINAL do protocolo (versionado) — pedido dela em 22/09/2026

Depois do fluxo detalhado, ela pede: *"gere o documento do protocolo A.R.A.R.A em txt para meu
brecho Pexinxavel"*. Diferenca do arquivo do dia:

- arquivo de trabalho (ditado na sessao): `protocolo-<assunto>-<AAAA-MM-DD>.txt` (minusculo, datado)
- **documento FINAL/canonico**: `PROTOCOLO-ARARA-PEXINXAVEL.txt` (MAIUSCULO, sem data, com
  `Versao X.Y - <data>` no cabecalho e **SUMARIO das secoes**) — e o "manual do balcao" que
  substitui os intermediarios. Ela aprovou esse formato com 17 secoes: identidade/sigilo, funcoes
  por canal, janela de operacao, escala+cobertura, filtro do dia, leitura de venda, calculos, os 4
  tipos de venda (simples, 2+ pecas, casada com dinheiro comigo, casada com dinheiro na outra
  marca), simulador do MP, comprovantes/legendas, planilha, crons, o que nunca fazer sem ela,
  pendencias e **HISTORICO DE REGRAS TRAVADAS na data**.
- Ao final: informar bytes/linhas/palavras, confirmar ASCII puro pelo script, entregar o conteudo
  COMPLETO no chat + `MEDIA:` do .txt, e avisar que o arquivo intermediario continua no disco
  (oferecer apagar — ela gosta do ambiente limpo).
- **Skill x documento:** se divergirem, a SKILL.md e o que o agente EXECUTA e o .txt e o que ela LE.
  Ao corrigir uma regra, corrigir nos DOIS (nesta sessao foram 5 rodadas de correcao).

- Ela pede METAFORA SIMPLES pra entender coisa tecnica ou interna do Hermes. Pedido literal:
  "me explique em metaforas simples". Concreto antes de abstrato — a memoria e "um post-it na
  testa", o app fechado e "o quarto escuro onde o armario esta", o teto de caracteres e "sobrou uma
  linha no post-it". Nomear o abstrato com uma imagem que ela ja conhece.
- NUNCA citar conceito interno sem definir na primeira mencao. Ela perguntou "qual memoria?" depois
  de eu dizer "a memoria ficou em 99%". Memoria, SOUL.md, MCP, skill, base externa: sempre com a
  traducao curta do que e, ANTES do nome.
- Explicar por camadas: ela pede o mesmo assunto em varios niveis (tecnico -> metafora -> mais
  simples). Se ela disser "nao entendi", descer um nivel IMEDIATAMENTE e descer de verdade —
  imagem nova, nao a mesma frase com outras palavras.
- Ao explicar algo com trade-off (custo, risco, o que falta), dar os numeros reais e o porem SEM
  maquiagem, e separar explicitamente o que depende dela do que e meu. Ela decide melhor com o preco
  na mesa.
- No chat vale modo caveman full (que vinha ligado em ~/.hermes/SOUL.md): curto, sem filler, sem
  narracao de ferramenta. EXCECAO: o ❤️ dela continua permitido, e a marca do tom. Arquitetura em
  hermes/hermes-knowledge-base (secao SOUL.md).
  **AVISO (02/11/2026):** o `SOUL.md` do default foi SOBRESCRITO por um script dela (v1.0, foco
  PEF/PEC) e nao carrega mais o bloco caveman, os setores nem as regras de ouro; a persona antiga
  esta em `~/.hermes/SOUL.md.bak.20261102-001035`. Antes de afirmar que o caveman esta ligado, ler o
  `SOUL.md` atual — e nao repor a persona por conta propria: a decisao e dela.
- Aviso de seguranca e confirmacao de acao irreversivel saem em PROSA NORMAL, nunca comprimidos.

### PITFALL: nao fechar dizendo que consertou o que nao foi consertado (06/10/2026)

No fechamento de uma configuracao eu escrevi \"corrigi o bug aqui **e na skill antiga tambem**\" —
mas so o arquivo NOVO tinha sido corrigido; o script da skill antiga continuava com o defeito. Ela
so descobriria ao usar. Regra: **antes de afirmar uma acao no fechamento, conferir o artefato** —
`read_file`/`grep` no arquivo, `ls` no caminho, `ffprobe` no video. Vale para \"corrigi\", \"movi\",
\"subi\", \"testei\". Se nao conferiu, escrever \"nao verificado\" (mesma regra do relatorio de
hardware). Corrigir na hora em que se descobre e dizer que corrigiu — transparencia vale mais que
perfeicao para ela.

### PITFALL: o check de ASCII NAO pega erro de CONTEUDO (22/09/2026)

O teste de bytes so olha ENCODING. Em documento longo (300+ linhas) escrito/patchado em rodadas,
passaram batido TRES defeitos de conteudo no mesmo dia:

- palavra truncada no meio do texto (saiu "1 peca PEQUENO/minha" no lugar de "1 peca minha");
- **cabecalho markdown DUPLICADO** depois de um patch;
- **linha colada sem quebra** (saiu "Licoes:- O print..." em vez de "Licoes:" + item).

Regras que evitam:
- Depois de ``write_file`` OU de qualquer ``patch`` em documento longo, **reler o trecho alterado**
  (grep pela secao + 10 linhas em volta) antes de entregar. Nao confiar no lint nem no check ASCII.
- Ao dar patch, se o texto NOVO tambem termina com o cabecalho que vem depois, **incluir esse
  cabecalho no `old_string`** — senao ele aparece duas vezes (foi assim que duplicou no protocolo).
- Corrigir na hora e mencionar a correcao na resposta ("corrigi um erro de digitacao que eu
  deixei") — ela valoriza transparencia mais que perfeicao.

### PITFALL: caractere nao-ASCII INVISIVEL entrou ao DIGITAR (30/09/2026)

Escrevendo um arquivo que devia ser 100% ASCII (um SKILL.md), entrou um "a" CIRILICO (U+0430) dentro da
palavra "ejeta". No olho e indistinguivel de um "a" normal — a conferencia de bytes pegou. Vale para
arquivo escrito A MAO, nao so convertido pelo `exportar-ascii.py`: skill, .md, .txt, script, .py.

```bash
grep -cP '[^\x00-\x7F]' <arquivo>     # 0 = ASCII puro
python3 ~/.hermes/skills/relatorios-ascii-puro/scripts/verificar-ascii.py <arquivo>
```

Rodar ANTES de salvar/entregar qualquer arquivo que promete ASCII puro — inclusive a propria SKILL.md
que ensina isso. Correcao: refazer a palavra inteira a mao, nunca com busca-e-troca do caractere
invisivel.

### Relatorio de PASTAS / DISCO real (pedido de 14/10/2026)

Pedido tipico: *"quero um retrato REAL da organizacao de pastas no disco, nao dos fluxos"*, quase
sempre com blocos numerados (arvore de ~/, conteudo de uma pasta, onde estao os arquivos do agente
X, pastas de trabalho x skills). Abre a descricao desta skill pelo gatilho PROPRIEDADES DO PC —
disco e a mesma familia.

- **Regra de ouro do pedido:** NAO mover, NAO criar, NAO apagar — so dizer o que existe, onde esta
  e quanto ocupa. Só comando de LEITURA (`du`, `find`, `ls`). Repetir essa garantia no cabecalho do
  arquivo E no fechamento da resposta.
- **Todo numero vem de comando, nunca da memoria.** O `du` real sempre traz o que a memoria nao
  carrega (pasta vazia, pasta que mudou de lugar, skill que virou pasta de trabalho).

Coleta (rodando de dentro da pasta alvo):
```bash
du -sh */ | sort -h              # 1o nivel
du -sh .[a-zA-Z]*/ | sort -h     # pastas com ponto (.hermes, .cache, ...)
find . -maxdepth 2 -type d | sort        # arvore 2 niveis
du -h --max-depth=3 . | sort -k2         # 3 niveis, tamanho por pasta, ordenado por caminho
find . -type d -iname '*curator*'; find . -type d -iname '*curador*'
ls -d ~/Hermes 2>/dev/null || echo "NAO EXISTE"
```
NAO tentar `du -sh . */ */*/` de uma vez — sai bagunçado. Um comando por nivel.

**PITFALL (14/10/2026): saida longa de `find`/`du` volta COLAPSADA no terminal.** O plugin de
compressao de saida troca o meio do resultado por `... (N filtered) [+N hidden: rtk recall <hash>]`
— voce PERDE linhas e entrega bloco incompleto sem perceber (na 1a rodada deste pedido, o bloco
"onde estao os arquivos do agente X" veio sem os caminhos). Contorno: redirecionar para arquivo e
ler o arquivo.
```bash
{ echo "### CURATOR"; find . -type d -iname '*curator*'; echo "### TRAMA"; find . -type d -iname '*trama*'; } \
  > /tmp/blocos.txt 2>&1
# depois: read_file /tmp/blocos.txt
```
Vale para qualquer coleta com muitas linhas (lista de skills, arvore, `du` profundo).

**Vale tambem para `ls` — e aqui o estrago e pior (medido 16/10/2026).** Um `ls -la` comum passa pelo
mesmo reformatador: no lugar de `drwxr-xr-x 1 user user 4096 Oct 15 09:44 Pasta/` volta uma forma
compacta do tipo `755  Pasta/`, que **borra a diferenca entre pasta, arquivo e symlink** — justamente
o que se precisa ver num retrato de disco. Contorno: chamar o binario, `/bin/ls -la <caminho>`
(vale para `/bin/ls -la ~/` e para provar `lrwxrwxrwx ... -> destino` de um atalho). Vale tambem
quando o objetivo NAO e relatorio: qualquer inspecao de estrutura usa `/bin/ls`.

**A distincao que organiza TODO relatorio desse tipo** (foi ela que pediu nesses termos):
- **SKILL** = pasta dentro de `~/.hermes/skills/` com arquivo `SKILL.md`. E texto de instrucao — a
  cabeca do agente. Nao tem foto nem video.
- **PASTA DE TRABALHO** = pasta FORA de `~/.hermes/` com arquivos reais (fotos, videos, PDFs,
  planilhas). E onde o trabalho acontece.

Ao responder "onde estao os arquivos do agente X", dizer EXPLICITAMENTE qual dos dois casos e; se
nao existir pasta com o nome do agente, dizer isso na letra (caso real: *nao existe `~/curator-x`;
o trabalho vive em `~/Hermes/Pexinxavel/Curator.X/Scripts` e `~/Hermes/Pexinxavel/Curator.X/Medicoes`*). Mapa ja
levantado em 14/10/2026 (caminho de cada setor + os achados que surpreendem):
`references/mapa-de-pastas-no-disco.md`, desta skill. A skill
`atualizacao-arquitetura-agentes` diz QUAL setor acionar — ela e escrita a mao e nao recebe
edicao automatica.

O documento nasce do `du`/`find`, nao de um `.md` — entao NAO passa pelo `exportar-ascii.py`. Rodar
o check ASCII (`grep -cP '[^\x00-\x7F]' <arquivo>` = 0) antes de entregar.

### PITFALL: em sessao CLI, "relatorio completo" e o CONTEUDO na resposta (14/10/2026)

Ela escreveu as duas coisas na mesma mensagem: *"salve em ~/relatorio-pastas-reais.txt"* **e** *"ao
final me mande o relatorio completo em ASCII puro"*. Entreguei o caminho + os achados decisivos
comprimidos e perguntei se ela queria o texto colado — **errado**. A regra ja estava escrita nesta
skill: o conteudo COMPLETO vai no corpo da resposta; o caminho absoluto em texto simples e
ADICIONAL, nunca substituto. Perguntar *"quer que eu cole?"* devolve trabalho pra ela. Arquivo
longo se cola assim mesmo — ela copia dali.

### Briefing para OUTRA IA DECIDIR (pedido de 15/10/2026)

Pedido tipico: *"quero que vc resolva da maneira que perguntei, mandando para o deepseek sua resposta
e colando sua resposta para o deepseek decidir o que vc deve fazer"*. Aqui ela entrega a DECISAO a
outra IA (o contexto do projeto dela mora no chat do DeepSeek) e o Hermes vira as maos. Nao e
relatorio informativo — e um **briefing de decisao**. Template pronto:
`templates/briefing-para-decisao-em-outra-ia.txt` (copiar e preencher).

- Secoes obrigatorias: quem e quem (a outra IA decide, o Hermes executa) > o pedido dela em
  PALAVRAS DELA (citado) > estado real medido AGORA (numeros do disco, nunca de memoria) > **o RISCO
  que nao se ve de fora** > OPCOES NUMERADAS (custo e risco de cada uma + qual o Hermes recomenda e
  por que) > pendencias abertas > o que se pede de volta (decisao numerada e curta + os limites do
  que NAO fazer).
- **O briefing carrega o risco, nao so a pergunta.** Foi a opcao perigosa marcada com numero (mover
  pasta sustentada por ~650 referencias) que deu valor ao documento — sem ela, o destino decide no
  escuro.
- ASCII puro (regra desta skill): ela cola no chat da outra IA e o destino corrompe acento.
- Salvar em `~/Hermes/Relatorios/briefing-<assunto>-<AAAA-MM-DD>.txt` e colar o conteudo no chat.
- **A entrega nao termina no texto.** Para o ciclo rodar (mandar -> ler a decisao -> executar), a
  outra IA tem que estar alcancavel: se o chat dela vive no navegador do ChromeOS, ver o pitfall
  "Navegador do CHROMEOS x navegador do LINUX" na skill `chromebook-linux` — o destrave e ela logar
  UMA vez no Chromium do LINUX, nao insistir em `computer_use`.

### O ciclo COMPLETO com o chat externo (validado 15–16/10/2026)

O briefing e o passo 1 de um ciclo que ja rodou inteiro. O que se aprendeu fechando o loop:

- **A thread e fixa:** `HERMES - Chromebook` em `chat.deepseek.com`. Nao abrir conversa nova — o
  contexto do projeto dela mora ali, e a thread ja vinha com um loop Hermes<->IA em andamento.
  ANTES de escrever, ler o FIM da thread (`innerText.slice(-3000)`): foi assim que apareceu que os
  testes A/B/C estavam pendentes e que uma vitoria ja tinha sido reportada.
- **Opcoes numeradas voltam como decisao numerada.** Nas duas rodadas o pedido terminou em
  `a) b) c) d)` e a resposta veio "1) Item 6 — escolho a Opcao A: ... 2) ... 3) Ordem de execucao".
  Formatar o pedido assim e o que faz a resposta ser executavel.
- **Ordem de execucao com PASSO numerado e "o que NAO fazer"** — a IA externa devolve os dois, e a
  lista do "nao fazer" e o que impede o Hermes de inventar. Rodar na ordem, conferindo cada passo.
- **Reportar o resultado de volta, sempre medido.** Cada rodada volta com numeros do disco (tamanho
  do tar, contagem de arquivos, saida do cron com carimbo de hora), nao com "deu certo".
- **A IA externa nao conhece as regras duras dela.** Em 16/10 ela mandou reiniciar o gateway: o
  Hermes recusou com justificativa (regra dela: restart apaga o store de citacao), pediu confirmacao,
  e a IA concordou em pular. **Segurar e explicar, nunca obedecer calado.**
- Como escrever/enviar/esperar a resposta por CDP (inclusive o fix do `node` 20 x 22 e a espera do
  streaming): `references/dirigir-chat-web-por-cdp.md` na skill `chromebook-linux`.
- **Backup antes, sempre** (ordem dela na mesma sessao): `scripts/backup-estrutura.sh` na skill
  `chromebook-linux` — ela so considera a mexida segura depois que o backup existe e foi conferido.

### Matriz de contatos de organizacoes (ONGs, coletivos, instituicoes)

Pedido tipico (01/11/2026): *"varredura na web, sites, blogs, Instagram, X, TikTok sobre
<documento que ela mandou> ... resumo das acoes, uma coluna para cada tipo de contato
inclusive numero de whatsapp"*. E relatorio ASCII **+ planilha**, gerados do MESMO script.

Receita em `references/matriz-de-contatos-de-organizacoes.md`: extrair a base do PDF dela
com `pymupdf` (a tabela quebra palavra no meio — reconstruir), confirmar site por busca,
`defuddle parse` para e-mail/telefone, X/TikTok so com o @ na URL do resultado, xlsx com
uma coluna por canal e Brasil/Amazonia destacado. **WhatsApp aberto quase nao existe nesse
setor: escrever "formulario no site", nunca inventar numero** — e declarar no fechamento o
que nao foi reconferido (ex.: Instagram quando o CDP esta fora).

Tres coisas que ela cobrou depois da primeira entrega e que ja devem nascer prontas:

- **Cidade, nao so pais** — coluna `Cidade/Sede` (Belem (PA), Manaus (AM), Gland (Suica)),
  com `-` quando nao ha fonte. Pais sozinho nao responde "de onde e a organizacao".
- **Link clicavel em tudo** — no xlsx a celula de Site/Instagram/X/TikTok leva
  `cel.hyperlink` + fonte azul sublinhada; no chat vai a URL completa
  (`https://instagram.com/<handle>`), porque `@handle` solto nao vira link no WhatsApp.
- **Segunda aba `Do documento (PDF)`** preservando o que veio no PDF dela, com TODAS as
  contas regionais — a varredura acrescenta, a aba do original nao se mistura.

Pedido de "observacao sobre as organizacoes em destaque" = analise (tipo, quem financia
quem, gargalo de contato, lacuna geografica), nunca adjetivo solto.

Depois vem sempre o pedido de **aba nova** ("acrescentar uma aba de LinkedIn", "de investidores
diretos e seus contatos"). A secao 6 daquela reference traz o pitfall de o gerador apagar a aba
na proxima rodada, o schema que funcionou e a regra de e-mail (`formulario no site`, nunca
inventar endereco de fundo).

### "Liste tudo que tem no documento" = mapa em TOPICOS, nao despejo item a item

Pedido tipico (02/11/2026): *"liste tudo que tem no doc"*, logo depois de receber uma planilha de
7 abas e 130 linhas. Listei as 43 ONGs uma por uma — resposta dela: **"bem resumido"** e, na
mensagem seguinte, **"em topicos"**. O que ela queria era uma linha por aba, nao o conteudo.

- Formato que ela aprovou: **uma linha por aba/secao**, com o nome, a contagem (linhas x colunas)
  e o que aquela aba cobre em cinco ou seis palavras. Sete linhas para sete abas.
- Nao abrir a lista de itens por padrao. Nomes item por item viram ruido e ela devolve pedindo
  compressao — o custo de errar para o lado longo e uma rodada perdida.
- Se ela insistir em "tudo" de novo, ai sim item a item, **mas ainda agrupado** por regiao/tipo
  ("Brasil e Amazonia (20): ...", "Global (11): ..."), nunca 130 linhas soltas.
- Fechar oferecendo o detalhe ("quer que eu abra a aba X linha a linha?"), nao entregando o
  detalhe de saida.
- Vale para planilha, DOCX, pasta e inventario de fluxo: **mapa primeiro, profundidade sob
  pedido.** E o mesmo padrao do mapa -> decisoes numeradas -> execucao que ela usa em refatoracao.

### "Faca o relatorio em arquivo de texto" = DOCX derivado do .txt (03/11/2026)

Depois de entregar o inventario em `.txt` (e so o resumo no chat), ela pediu:
*"faca o relatorio em arquivo de texto"*. Nao era pedido de novo conteudo nem de
outra pesquisa — era o **mesmo relatorio em documento abrivel**.

- O `.txt` continua sendo o arquivo canonico (e o que ela cola no DeepSeek). O
  DOCX e a mesma coisa em casca que abre no Google Docs / app de documentos.
  Nunca regerar a coleta para trocar de formato.
- Um comando, sem redigitar nada:
  ```bash
  ~/.pluma-venv/bin/python \
    ~/.hermes/skills/relatorios-ascii-puro/scripts/txt-para-docx.py \
    ~/Hermes/Relatorios/RELATORIO-ESTRUTURACOES-2026-11-03.txt
  # saida: mesma pasta, mesmo nome, .docx
  ```
- O script usa Courier New 8.5 pt, margem 0.6", espaco entre paragrafos 0 e
  line_spacing 1.0 — sem isso as ~72 colunas do ASCII quebram e o alinhamento
  vertical (as colunas de tamanho e caminho) se perde no Word.
- Linha vazia vira `" "` (paragrafo vazio colapsa no docx) e as bordas `====`
  viram titulo centralizado — o documento nao fica com cara de log.
- Ele mesmo avisa se o `.txt` de origem ainda tem caractere nao-ASCII; nesse
  caso consertar o `.txt` primeiro (`verificar-ascii.py`) e rodar de novo.
- Fechamento: dar o caminho absoluto do `.docx` E dizer que o `.txt` segue no
  lugar. Nao apagar o `.txt` — ele e a fonte da proxima reembalagem.

### Pediu planilha e depois "quero um documento de texto"

Aconteceu em 02/11/2026 com a mesma pesquisa (queimadas x governo): ela pediu planilha, recebeu,
e pediu o mesmo conteudo em documento de texto. Nao e retrabalho de pesquisa — e o mesmo dado em
outra casca.

- Guardar o conteudo em **uma lista de dados no script** e emitir as duas saidas do mesmo arquivo
  (xlsx com `openpyxl`, docx com `python-docx`). Refazer a pesquisa para trocar o formato e o erro.
- Documento de texto ganha o que a planilha nao tem: paragrafo de resposta direta no topo e bloco
  de **limites do metodo** no fim. A planilha perde isso; o DOCX e onde ele vive.
- Nas duas: link clicavel e o que da valor (`cel.hyperlink` no xlsx; `relate_to` + `w:hyperlink`
  no docx — ver `references/dossie-de-fichas-e-entrega-editavel.md`).

### Varredura de noticias e redes (conjuntura / tema politico quente)

Pedido tipico (29/10/2026): *"faca uma varredura profunda na web, Instagram,
Facebook, TikTok atras de informacoes sobre <tema> depois de <evento>"*. E
relatorio: ASCII puro, duas copias, conteudo COMPLETO no chat.

Receita em `references/varredura-de-noticias-e-redes.md`: 4-6 rodadas de busca
mirando angulos diferentes (fato geral, caso que ela ja conhece, resposta
oficial, redes, outro estado), `defuddle parse` + limpeza de HTML (o defuddle
devolve tags e o arquivo vem numa linha so — limpar antes de ler), estrutura de
13 secoes com duas obrigatorias: **CONFIRMADO x RUMOR** e **LACUNAS** (redes
sociais por dentro exigem login: declarar, nunca inventar).

**Depois do .txt ela pede PDF** (`"mande em outro formato de arquivo, PDF"`,
29/10/2026). Nao ha pandoc/wkhtmltopdf/libreoffice/reportlab nesta maquina — o
caminho que funciona e o Chromium headless:

```bash
chromium --headless=new --disable-gpu --no-sandbox --no-pdf-header-footer \
  --user-data-dir=/tmp/chrome-pdf --print-to-pdf=/tmp/relatorio.pdf \
  file:///tmp/relatorio.html
```

- `--user-data-dir` separado e obrigatorio: a janela do Chromium dela roda CDP em
  9222 e nao pode ser tocada.
- HTML com `<pre> white-space: pre-wrap`, monoespacada 9.2 pt, `@page A4` ~16/14 mm —
  preserva o alinhamento do ASCII e o PDF nao corrompe acento.
- Conferir paginas (`d.count(b"/Type /Page") - d.count(b"/Type /Pages")`) e olhar uma
  previa gerada com `--screenshot` antes de entregar; salvar as duas copias e mandar
  por `MEDIA:<caminho.pdf>`. O `.txt` continua sendo o arquivo para colar na outra IA.
- Receita completa: `references/varredura-de-noticias-e-entrega-em-pdf.md`.
- Atalho re-executavel (nao redigitar o HTML): `bash
  ~/.hermes/skills/relatorios-ascii-puro/scripts/txt-para-pdf.sh <arquivo.txt> [saida.pdf]` —
  monta o HTML, chama o Chromium com perfil separado e imprime bytes + numero de paginas.

### Checagem de veracidade da varredura ("confira se todas as informacoes sao veridicas")

Pedido que veio logo depois da varredura (29/10/2026): *"Confira se todas as informacoes sao
veridicas"*. Nao e revisao de texto — e **auditoria de fonte, afirmacao por afirmacao**, e o
resultado tem que ser um documento que ela possa usar para decidir o que vira post.

- Classificar CADA afirmacao em quatro estados: **CONFIRMADO** (fonte primaria ou 2+ veiculos
  independentes), **FONTE UNICA** (publicada com atribuicao nominal, sem cruzamento),
  **PRECISA CORRECAO/NUANCE** e **NAO CONSEGUI CHECAR**. Nunca um "esta tudo certo" global —
  o valor do documento e a separacao.
- **Fonte primaria resolve quase tudo**: nota do proprio orgao (MPF/PF/Funai/Ministerio). No caso
  de MS a nota do MPF/MS derrubou o "ataque em Navirai" (duplo homicidio por briga de familia,
  vitimas sem pertencimento indigena, fotos adulteradas) e fixou o prazo real de 48h em Tacuru —
  a imprensa tinha publicado 24h numa versao.
- **Fato contestado = as DUAS versoes no documento** e so o fato incontroverso no material de
  divulgacao. Ex.: TI Votouro (RS) — 3 mortos em 13/10 e fato; a motivacao (perseguicao politica
  segundo moradores x disputa de cacique segundo a Brigada Militar) segue em disputa, e a PF nao
  concluiu. Cravar a motivacao na manchete e erro de risco.
- **Nomes proprios conferem-se letra a letra**: "TI Sao Jeronimo" era **Sao Jeronimo da Serra**
  (PR); o municipio entra no documento com o nome completo.
- Fechar com **recomendacao de uso**: o que pode ser postado direto, o que so com atribuicao
  ("segundo o CIMI", "segundo a APIB") e o que nao deve ir para arte.
- Entregar em ASCII puro, duas copias, e dizer explicitamente o que estava errado no material
  anterior — ela valoriza a correcao transparente mais que a perfeicao.
- Protocolo completo, com o caso medido: `references/checagem-de-veracidade-da-varredura.md`.

### "Checar se e verdade que X aumentou/caiu" = dado aberto, nao manchete

Pedido de 02/11/2026: *"checar se os incendios de fato aumentaram apos o 2o turno"*. A resposta so
ficou defensavel quando baixei o CSV diario do INPE e calculei; a materia que "confirmava" o
aumento era de **2022**.
- Conferir a **data da materia** antes de citar qualquer numero — snippet de busca nao traz ano.
- Receita com a listagem do `dataserver-coids` do INPE, o filtro do satelite de referencia (Aqua),
  o pitfall do nome de UF com acento (`PARA`, `AMAPA`, `RONDONIA` dao zero silencioso) e o metodo
  de duas janelas de 7 dias: `references/checar-dado-oficial-em-fonte-primaria.md`.
- Quando o dado contraria o que ela ouviu, a primeira linha e a conclusao, e as duas metricas
  (total x referencia) vao juntas — se divergem em sinal, a divergencia e o achado.

### Dossie de FICHAS por caso e entrega editavel (29/10/2026)

Depois da checagem ela pediu o documento em outro formato, e o formato tem regra:

> *"Refaca o documento, coloque observacao de quantidade de fontes e classifique cada noticia
> assim: Povo: / Cidade/Estado: / Ocorrido: / Data: / referencias: link(s) clicavel(a)"*

- **Uma ficha por caso**, sempre com os 5 campos nessa ordem, **selo com o numero de fontes** e
  selo verde quando ha fonte primaria. Caso desmentido ENTRA na lista (rotulado), nao e omitido.
- **Nota no topo** com a escala (4+ pode publicar / 2-3 confirmado / 1 so com atribuicao /
  desmentido nao publicar) e o **placar honesto** das fichas.
- **PDF com link clicavel**: gerar HTML com `<a href>` (nao `<pre>`) e imprimir no Chromium —
  sai `/URI` de verdade. Verificar contando `/URI` no PDF (buscar a URL em claro nao funciona:
  o texto vai em glifo) e olhar preview por `--screenshot`.
- **"versao editavel" = .docx + .xlsx.** `~/.pluma-venv/bin/pip install python-docx openpyxl`;
  hyperlink no docx e XML na mao (`relate_to` + `w:hyperlink`) — `paragrafo.runs[-1]` depois de
  inserir hyperlink estoura `IndexError`; `relate_to` deduplica URL repetida (25 relacoes para
  39 referencias).
- Manter os dados das fichas em UM script e as tres saidas (txt/pdf/docx/xlsx) derivadas dele,
  para nao divergirem.
- Receita completa (schema da ficha, CSS dos cards, helper de hyperlink, colunas do xlsx,
  verificacao): `references/dossie-de-fichas-e-entrega-editavel.md`.

### Ela manda a mensagem do grupo para eu conferir ANTES de escrever o texto politico

Pedido tipico (29/10/2026): *"Me ajude a elaborar um texto. Do ministerio dos povos
originarios: Eloy Terena. Verifique todas as informacoes da mensagem:"* + print de conversa.

- **Conferir primeiro, escrever depois** — e o resultado da conferencia vai na resposta, item
  por item, com o status de cada afirmacao (confirmado / nao confirmavel / incompleto).
- **O que nao tem fonte publica nao entra no texto.** Ex.: "Lula postou nos storys o video do
  Eloy" nao se confirma por busca; o que estava documentado era o video divulgado **nas redes do
  ministro**. Escrever o que existe, nao a versao mais forte.
- **Antecipar a resposta oficial dentro do texto.** Se o orgao nega (ex.: Sejusp-MS: "nao procede
  genocidio") ou se a PF nao confirmou, o texto cita isso — senao o post e desmontado em uma nota.
- Fechar a entrega com as decisoes editoriais que sao DELA (cravar ou nao motivacao em disputa,
  marcar ou nao @ e #), nunca decidir sozinho o que vai ao ar.

## Escopos relacionados
- O conteudo do protocolo ARARA em si vive na skill arara-pexinxavel (da Vytorya) —
  esta skill cuida so do FORMATO ASCII e da entrega.
- A preferencia de ASCII puro tambem esta no perfil de usuario (memoria).
