# Implantação IAra e situação da entrega — 06/11/2026

A implementação desta etapa é local. A rede recuperada em PHP/MariaDB e a prévia da Vercel continuam sendo aplicações separadas. Nenhum domínio, banco recuperado, conta antiga ou serviço externo foi alterado. A versão nova da prévia ainda não foi publicada.

## Testar no computador, sem banco externo

Na raiz do projeto:

```bash
node scripts/dev-opy.mjs
```

Abra `http://127.0.0.1:8101`. A primeira tela é **Entre na Casa Opy**: crie uma conta de teste. As contas antigas do Etnias não são usadas. Experimente publicar, reagir, comentar, anexar arquivos, conversar com a EtnIA e abrir **Precisa de conteúdo? Peça à IAra**. Para conferir duas pessoas, use uma janela anônima e crie outra conta de teste.

O comando gera uma chave de sessão privada e usa arquivos em `preview/local-data/8101`, ignorados pelo Git e fora da pasta pública. Ao parar com Ctrl+C e iniciar novamente, as contas e os registros continuam disponíveis. Não precisa configurar banco, Blob, `.env` ou credenciais externas. Se as dependências Node não estiverem instaladas em outra cópia do projeto, execute `npm --prefix preview ci` primeiro. O Node precisa suportar a sintaxe já usada pelo projeto (Node 22.12 ou superior).

Se a porta estiver ocupada, use a prévia já aberta ou execute `PORT=8102 node scripts/dev-opy.mjs`. Cada porta usa uma pasta de dados separada. O servidor escuta somente em `127.0.0.1`; o modo local não é uma configuração de produção. Na Vercel, a variável de armazenamento local é recusada e o armazenamento privado existente continua sendo usado.

O teste `node tests/opy/local-store.mjs` passou com a API real e persistência em disco: cadastro, pedido IAra, consulta, saída e revogação persistidas, anexos, reabertura, vinte gravações concorrentes e recusa de sobrescrever JSON corrompido. A tentativa de abrir o servidor neste ambiente retornou `listen EPERM: operation not permitted 127.0.0.1:8101`; portanto, a abertura e a revisão visual precisam ser feitas no terminal normal do usuário. Não foi declarada verificação de navegador concluída.

O kit fornecido pela Vitória foi conferido antes da instalação. O arquivo `etnias-iara-v1.0.tar.gz` tem o SHA256 `737f67f1a0a7e371ae475c989281dc0fdc851fc801e52702da6925b8be1181db`; os 129 arquivos listados em CHECKSUMS passaram. A cópia original está em [iara/kit](../iara/kit/README.md), intacta. O instalador também fixa o hash do manifesto, recusa caminhos externos e arquivos inesperados.

## O que funciona nesta etapa

A rota `/iara/` da prévia permite registrar um pedido privado, obter protocolo e triagem inicial, baixar o briefing em TXT, consultar o pedido após recarregar e cancelá-lo. O acesso fica na conversa da EtnIA. Texto inválido preserva a edição; o navegador renderiza o pedido como texto. Cada conta vê somente os próprios pedidos.

A triagem usa as palavras-chave dos 12 setores do kit. Se nenhum setor ou mais de um setor for identificado, encaminha para a central de solicitações. Não é inferência de um modelo, treinamento ou delegação real aos agentes. Os pedidos ficam no Blob privado da homologação; a equipe precisa baixar o briefing e encaminhá-lo. Não existe fila administrativa nem sincronização automática com o Hermes nesta etapa. O limite é de cinco novos pedidos por minuto, vinte por conta e quatrocentos no ambiente, sem descarte automático. Pedidos cancelados continuam no histórico e contam no limite total.

A EtnIA continua respondendo sobre o site e o projeto, com fontes identificadas e recusas para conhecimento restrito. O material da IAra acrescentado à resposta explica a implantação e seus limites. Os exemplos de FAQ, notícias, cursos e doações do kit não foram incorporados como fatos reais da comunidade.

O instalador cria `iara/local`, com 19 skills IAra e sete skills-base adicionais. A oitava skill-base é a duplicata de design e foi instalada uma única vez, usando a versão de `skills/` com as referências. O perfil `profiles/iara/skills` referencia essas mesmas 19 skills. Os 17 JSONs, design kit, assets e geradores estão instalados. Os caminhos dos scripts foram ajustados para esta pasta, sem copiar credenciais, memória ou sessões de outro Hermes. Reinstalar atualiza código e preserva os arquivos de dados já existentes. `iara/local` está ignorado pelo Git e não faz parte do pacote da Vercel.

Os nomes dos metadados de triagem e referência foram alinhados aos nomes reais das pastas. Referências ao diretório Hermes da máquina de origem foram ajustadas. Os geradores usam os assets desta instalação e saída separada em `generated/design`, preservando o kit aprovado. Renderização nova permanece pendente: as fontes Archivo Black/DejaVu usadas pelos geradores não vieram no pacote, e o caminho Linux de DejaVu precisa ser provisionado ou adaptado antes de renderizar. As receitas também citam ferramentas e scripts adicionais ausentes no kit; isso deve aparecer como dependência pendente, sem simular execução.

```bash
python3 scripts/iara.py verify
python3 scripts/iara.py install
python3 scripts/iara.py run iara-adapter iara_adapter.py --test-connection
python3 scripts/iara.py run iara-solicitacao solicitar.py --help
python3 scripts/iara.py run iara-relatorio relatar.py --help
```

Os scripts funcionam em modo local sem o motor Hermes. O executável Hermes encontrado no computador não inicia: `no dependency environment is committed for this install; run hermes pm repair`. Não foi reparado o ambiente global, nem instalada uma versão diferente da solicitada. A compatibilidade com Hermes 0.19.0 permanece sem validação. As instruções operacionais do perfil estão em [profile-instructions.md](../iara/profile-instructions.md).

## Correções aplicadas ao kit instalado

As correções estão em [hardening.patch](../iara/patches/hardening.patch), aplicado pelo instalador, sem alterar o material original.

| Pendência do documento | Resultado e limite |
| --- | --- |
| Autoaprovação | Solicitante obrigatório; aprovação pelo mesmo nome é recusada. É conferência nominal em uma CLI de operador, sem identidade autenticada. RBAC real continua pendente. |
| Expiração de aprovação | Aprovação com mais de sete dias não autoriza novo registro de publicação. A verificação ocorre ao consultar/publicar, sem depender de cron. É preciso solicitar nova aprovação para uma nova versão. |
| Rate limit de atendimento | Recepção web tem limite por conta. Atendimento real em DM/comentário e limite no gateway Hermes continuam pendentes. |
| Hash chain | Pendente. Os cinco arquivos escritos pelo adaptador têm lock entre processos e escrita atômica, mas isso não detecta alteração manual de histórico. Os demais scripts locais não ganharam transação global. |
| Exit codes de PII | `solicitar.py` e `calendario.py` recusam PII identificada com motivo `pii_nao_anonimizada` e código 4. |
| `Fonte:` dentro da linha | O revisor reconhece o rótulo dentro da frase. Isso identifica o rótulo, não certifica a veracidade da fonte. |
| Rastro institucional | Mantido deliberadamente. Limpar revisões não remove o histórico de `institucional.json`; não representa desbloqueio institucional. |
| `--peca-id` | Exigido na solicitação/aprovação e persistido no registro. Divergência entre peça solicitada e peça aprovada é recusada. |

Também foi fechado o registro de publicação sem solicitação vinculada. Agora ele exige aprovação vigente, hash igual e correspondência de peça, canal e aprovador. Falha ao consultar a classificação institucional bloqueia a operação. Registros de autorização de imagem bloqueada ou restrita também são respeitados; resolver a restrição exige rever a autorização e verificar novamente. Marcar `anonimizado` não libera um texto que ainda contém PII detectada. Configuração corrompida ou armazenamento desconhecido não muda silenciosamente para local.

Esses comandos **registram aprovações e publicações**; não enviam conteúdo às redes sociais:

```bash
python3 scripts/iara.py run iara-aprovacao registrar-aprovacao.py \
  --solicitacao-id pedido-exemplo-v1 --peca-id card-exemplo-v1 \
  --solicitante "Pessoa que solicitou" --aprovador "Pessoa revisora" \
  --peca-hash HASH_SHA256_DA_PECA --canal instagram

python3 scripts/iara.py run iara-aprovacao registrar-aprovacao.py \
  --acao aprovar --solicitacao-id pedido-exemplo-v1 \
  --peca-id card-exemplo-v1 --aprovador "Pessoa revisora"
```

`HASH_SHA256_DA_PECA` é um marcador a substituir pelo hash real. A revisão de conteúdo, autorização de imagem e aprovação nominal precisam preceder o uso em produção. A CLI não substitui o RBAC do servidor.

## Sessões e preservação da homologação

As sessões novas têm ID individual, assinatura e expiração de sete dias validada no servidor e no middleware. O servidor mantém até dez sessões ativas por conta. Sair revoga a sessão usada; copiar seu cookie não mantém acesso à API depois da saída. Outras sessões da mesma pessoa continuam válidas. A API revalida a sessão dentro da transação de escrita.

**Quando esta versão for publicada, as sessões antigas da prévia serão rejeitadas e as pessoas precisarão entrar novamente.** As contas e publicações continuam preservadas. O middleware valida assinatura e prazo para servir a estrutura estática; a revogação individual é conferida na API, onde ficam os dados privados.

Ao alcançar cem registros dos módulos, a prévia passa a recusar novos envios com erro 409, preservando os anteriores. Os limites de homologação continuam existindo: não foi transformado esse armazenamento em banco de produção.

## Cinco caixas: situação real

| Caixa | Situação |
| --- | --- |
| 1 — Kit | Integridade, README, inventário e instalação isolada concluídos. |
| 2 — Plataformas | Kit local funcional; motor Hermes, banco IAra, Mixpost, Authentik e serviços opcionais não estão provisionados e homologados. |
| 3 — Conexões | Instagram, LinkedIn, WhatsApp, e-mail e APIs de produção não estão conectados. Facebook, TikTok e YouTube ficam pendentes no config. |
| 4 — Validação | Integridade, skills, dados, design, adaptador local, aprovação, preservação e relatório ASCII testados. Testes 8 e 9 para Supabase permanecem pendentes. |
| 5 — Restrições e pendências | Sem cópia de segredos/histórico/modelo de voz; correções e limites discriminados acima. Voz da Karuãn não foi recriada. |

**Não mudar `storage` para `supabase` nesta instalação.** O adapter original contém `_SupabaseStub`; o pacote não traz a migração SQL completa anunciada no documento de implantação. Vários scripts ainda leem diretamente os JSONs locais, inclusive relatórios. Implementar somente uma conexão de cinco tabelas deixaria o fluxo parcialmente dividido. A migração precisa cobrir todos os estados, importar dados, validar permissões e conferir o fluxo completo em um projeto novo dedicado à IAra, preservando o banco recuperado.

No documento de instalação há colisões de portas: Authentik e MinIO usam 9000; Langfuse e o bridge WhatsApp usam 3000. Os exemplos de `docker run` precisam ser substituídos pela configuração oficial de cada serviço. Um container Postgres isolado não fornece todos os serviços do Supabase. A exposição de um schema próprio na API também exige configuração explícita, conforme a [documentação oficial do Supabase](https://supabase.com/docs/guides/api/using-custom-schemas). Não foram executados esses comandos incompletos.

## Verificação executada

```bash
python3 tests/opy/iara-kit.py
node tests/opy/community-integration.mjs
node tests/opy/etnia.mjs
```

Os testes passaram com dados sintéticos e sem serviços remotos: instalação e reinstalação preservando dados, 129 checksums, 19 + 7 skills, 17 JSONs, vínculo de aprovação, expiração, recusa institucional e PII, oito gravações concorrentes, calendário, relatório ASCII, fonte dentro de linha, sessões e revogação individual, CSRF, privacidade/cancelamento/limites da IAra e preservação dos registros de módulos. A API foi exercitada diretamente com o handler real e armazenamento em memória, sem gravar no Blob da prévia ou no banco recuperado.

A exportação PHP gerou 29 páginas. Foram conferidos os rótulos, IDs e links internos da nova página. O teste PHP de navegação passou. Para contornar a indisponibilidade de PHP nativo/Docker, esses dois passos rodaram com PHP 8.3 em WebAssembly, usando os pacotes PHP.wasm 3.1.62 instalados somente em pasta temporária. Isso não certifica Apache, MySQLi ou o servidor de produção.

O teste de navegador está em [iara-browser.cjs](../tests/opy/iara-browser.cjs). Não foi executado: a abertura do Chrome automatizado e de portas locais foi bloqueada pelo ambiente. Portanto, download, teclado, layout em 320/390 px e comportamento visual ainda precisam de verificação real. A sintaxe do teste passou. Quando houver servidor de teste disponível:

```bash
OPY_PREVIEW_URL=http://127.0.0.1:8101 node tests/opy/iara-browser.cjs
```

O código exportado está em `preview/dist`. Publicação e teste com Vercel Blob real permanecem pendentes; não usar esta evidência como aprovação de produção.

## O que bloqueia a rede em produção

É preciso definir o servidor de destino. O projeto tem um [procedimento de recuperação](./recuperacao-servidor.md), mas nenhum host definitivo foi identificado na documentação. O diagnóstico da outra sessão permanece aplicável: preparar PHP/MariaDB e HTTPS, testar contas antigas e recuperação de senha, mídias e mensagens entre duas contas autorizadas, configurar SMTP/cron/chat, ensaiar backup e restauração, homologar os módulos que serão oferecidos e recuperar as mídias ausentes ou explicitar a entrega parcial do acervo.

Para a IAra, faltam o motor com versão validada e provedor de modelo, persistência de produção, fila administrativa/integração com a recepção web, RBAC real com os seis perfis, auditoria, Mixpost e credenciais próprias dos canais. Criar apps, obter tokens e escanear o QR do WhatsApp dependem dos responsáveis pelos canais. Segredos devem ser inseridos no servidor por canal privado; não em código público ou neste relatório.

O domínio `etnias.site` e o banco recuperado permanecem preservados, conforme AGENTS.md. Uma implantação futura deve usar destino isolado até a homologação dos fluxos completos.
