# Homologação funcional da Casa Opy

Atualização local de 06/11/2026, ainda não publicada: [recepção IAra, sessões com expiração/revogação e preservação de registros](./iara-implantacao.md). O pacote local contém 29 rotas. As descrições de deployments abaixo registram o que já foi publicado antes desta atualização.

Endereço: **https://casa-opy-preview.vercel.app**. Projeto separado `junior-mirandas-projects/casa-opy-preview`, ID `prj_cu788Lka8o124tRfYd3lldxyxteI`. Não altera o domínio Etnias nem o banco recuperado.

## Acervo autorizado

O usuário autorizou expressamente usar postagens públicas antigas em 4/11/2026. O [importador](../scripts/import-public-preview.py) consulta somente a cópia restaurada, em leitura, e seleciona 24 publicações pessoais públicas de contas ativas e não bloqueadas, com 8 fotos existentes. Preserva autoria, texto e data e resolve os identificadores internos de hashtags para as tags originais. Limita duas postagens por autor e evita textos duplicados para permitir uma avaliação variada.

São excluídos posts privados, destinatários individuais, grupos, páginas, eventos e compartilhamentos. Nenhuma mensagem privada, email, hash de senha ou sessão antiga é exportada. As fotos são apenas as referências desses posts públicos; não há cópia da árvore completa de uploads. O SQL original permanece intacto. Anexos ausentes são identificados na publicação.

## Fluxos que funcionam

- Publicar texto, emoji, sentimento, enquete e foto/vídeo/áudio/PDF de até 2 MB; gravação de áudio depende da permissão do microfone e do suporte do navegador.
- Publicações públicas aparecem para outras sessões. “Somente eu” restringe publicação e anexo à sessão autora.
- Reagir, comentar, votar, salvar e excluir a própria publicação, com persistência compartilhada.
- Pesquisar textos e autoria do feed, filtrar acervo/novas e abrir os salvos da sessão.
- Participar do grupo de avaliação; consultar reações/comentários nas próprias publicações no Maracá.
- Conversar na sala **pública de homologação**; a outra sessão recebe a mensagem por atualização periódica. Não é uma conversa privada com destinatário.

Cada pessoa cria a própria conta na tela **Entre na Casa Opy**. A sessão é um cookie HttpOnly assinado, SameSite=Lax e Secure na Vercel, com duração de sete dias. Não usa as contas antigas do Etnias. As novas reações e comentários são desta homologação; não são contagens históricas do acervo.

## UX e limites

Após o retorno do usuário, a organização anterior do menu foi restaurada: caminhos visíveis na lateral, Opy e Interatividade no cabeçalho, Chat e Maracá no cabeçalho e barra Feed/Mercado/Postagem/Saberes/EtnIA no computador e no celular. Salvos continua acessível diretamente na lateral. O compositor reúne seis ações rápidas: Foto/vídeo, Áudio, Arquivo, Emojis, Sentimento e Enquete. Comentários em edição sobrevivem a reações, votos e salvamentos.

Login antigo, migração efetiva das 7.418 contas para um servidor público, mensagens privadas com destinatário, catálogos completos e pagamentos ainda dependem da [recuperação do servidor](./recuperacao-servidor.md). A EtnIA, na prévia, é a conversa sobre o site e o projeto. Ela responde só com o material aprovado desta homologação, indica a fonte e recusa conhecimento restrito ou pergunta sem base, conforme os [requisitos](./etnia-requisitos.md). Protocolos culturais mais amplos continuam fora até haver documentos autorizados.

## Arquitetura isolada

O [exportador](../scripts/export-opy-preview.php) renderiza 28 rotas, incluindo a entrada e a EtnIA, reutilizando os fragmentos PHP da interface. Arquivos públicos ficam em `preview/dist/public`; funções Node ficam em `preview/dist/api`, com módulos privados em `preview/dist/server`. O exportador usa uma lista explícita, sem inicializador WoWonder ou credenciais antigas.

O [backend](../preview/server/community.mjs) usa um Vercel Blob **privado**, dedicado a esta homologação. Estado compartilhado: `opy-v2/community.json`; anexos privados: `opy-v2/media/`. Alterações usam comparação de ETag e repetição em conflito para preservar escritas concorrentes. A API aplica autorização sobre postagens e anexos, origem da requisição, validação de MIME/assinatura do arquivo e limites de tamanho/ações. Falhas preservam a edição e mostram erro.

As variáveis `BLOB_READ_WRITE_TOKEN` e `OPY_SESSION_SECRET` existem somente no ambiente servidor; nunca entram no JavaScript público. O `.vercelignore` exclui `.env*`, `.git*`, `.vercel`, logs e `node_modules`. Não publicar a raiz do projeto nem `public_html`. Este armazenamento não substitui o banco de produção para a migração completa; há limite de 100 novas publicações, 60 comentários por post e 100 mensagens recentes na sala.

## Reprodução e publicação

Para testar a versão local sem banco ou Blob, execute `node scripts/dev-opy.mjs` na raiz e abra `http://127.0.0.1:8101`. Crie uma conta de teste. Os dados persistem em `preview/local-data/8101`; detalhes e limites estão no [guia da implantação IAra](./iara-implantacao.md). Os comandos abaixo continuam sendo os de exportação/publicação da homologação na Vercel.

```bash
docker run --rm --entrypoint php -v "$PWD:/work" -w /work \
  etnias-recovery-php:8.3 scripts/export-opy-preview.php
vercel project inspect --non-interactive --cwd preview/dist \
  --scope junior-mirandas-projects
vercel deploy --prod --yes --cwd preview/dist \
  --scope junior-mirandas-projects \
  --project prj_cu788Lka8o124tRfYd3lldxyxteI
```

O destino production acima é somente o alias estável da homologação. A versão estática anterior permanece no histórico de deployments para rollback. O servidor Node local de avaliação usa [opy-preview-server.mjs](../scripts/opy-preview-server.mjs) e requer as mesmas duas variáveis privadas, sem imprimi-las.

## Verificação

[Testes da API](../tests/opy/live-api.cjs): sessões distintas, acervo, CSRF, publicação compartilhada, autorização de exclusão, reação/comentário concorrentes, enquete, salvos, sala pública e exclusão.

[Testes de anexos](../tests/opy/media-private.cjs): formato inválido rejeitado, PDF publicado/baixado, invisibilidade do post privado para outra sessão, acesso indevido ao anexo rejeitado e exclusão.

[Testes de navegador](../tests/opy/ux-live.cjs): acervo/fotos, seis atalhos, emoji inserido, publicação/enquete/reação/comentário entre sessões, salvos, preservação de comentário em edição, entrega da sala pública e menu restaurado em 1440, 390 e 320 px. Capturas e revisão visual preservam a identidade existente em DESIGN.md. O [teste PHP](../tests/opy/navigation.php) passou nos 16 casos de habilitação, permissões, URLs e escape.

Os testes antigos de prévia exclusivamente local em localStorage não descrevem mais esta versão; os testes de API, privacidade e UX acima são os controles atuais desta homologação.

Validação publicada concluída: API, anexos/privacidade e navegador passaram em https://casa-opy-preview.vercel.app. Funções e dados internos retornam 404 quando solicitados como arquivos públicos. A revisão de código teve um P2 de preservação de rascunhos corrigido e conferido; a revisão visual pediu restaurar hashtags e confirmou a correção.

Deployment com a EtnIA em conversa, sobre o material desta prévia: `casa-opy-preview-ekuhakoh8`. O ícone do Maracá na barra, no lugar do sino, está em `casa-opy-preview-mcz5ihump`. A entrada por conta própria permanece em `casa-opy-preview-ab5pzkjso`.

Cadastro com Chave Google e telefone, barra do feed (Amigos, Notícias, Fotos, Áudios, Documentos), câmera, vídeo e envio de PDF/TXT/DOC/DOCX: `casa-opy-preview-9fi5t1x5x`. A barra inferior (Feed, Mercado, Postagem, Saberes, EtnIA) e os painéis laterais permanecem os já validados. Contas já criadas continuam entrando sem esses campos; o telefone e a chave Google aparecem só na conta de quem os informou.

Publicações com Curtir, Comentar e Amei, bandeja de reações, player de áudio e comentários em fio: `casa-opy-preview-75nvgh1bl`, READY, alias estável confirmado em https://casa-opy-preview.vercel.app. A barra inferior e os painéis laterais não mudaram.

Ícones ilustrados de cada seção, recortados da folha colorida: `casa-opy-preview-7h233ro13`, READY, alias https://casa-opy-preview.vercel.app. O menu, o cabeçalho, a Interatividade e a barra inferior usam o desenho da própria seção. Curtir, Comentar, Amei e o player continuam como estavam.

Fluxo normal da publicação, sem a barra de filtros acompanhando a tela: `casa-opy-preview-3eruycjhh`. O texto escrito é o que fica visível para quem vê. A publicação leva um único vídeo, um único arquivo e uma localização.

O desenho da Casa Opy saiu de ao lado da logomarca: `casa-opy-preview-6j3p6hbu0`, READY, alias https://casa-opy-preview.vercel.app. Na barra larga fica só a logomarca; no celular e no tablet a palavra Opy continua abrindo o menu.

Uso no iPhone e instalação na tela inicial: `casa-opy-preview-gvqpovh9b`, READY, alias https://casa-opy-preview.vercel.app. O nome instalado é Etnias e o ícone é a maloca enviada. No Safari, Compartilhar e Adicionar à Tela de Início. No Android, o aviso Instalar aparece quando o navegador oferece. A barra, a busca e a entrada acompanham a largura do celular, inclusive deitado, sem rolagem horizontal.

Ícone recortado na parte marrom e orientação de instalação, sem o botão de dispensar: `casa-opy-preview-piom7p3n2`. O atalho usa a maloca no fundo marrom. No iPhone, o aviso indica Compartilhar e Adicionar à Tela de Início.

Toque, rolagem e menu no iPhone: `casa-opy-preview-9ywardsjq`. O aviso de instalação acompanha o feed em vez de ficar preso sobre os botões. O menu Opy abre na lateral, fecha no X ou no fundo e devolve a rolagem. Cada toque escurece o controle.

Conversa da EtnIA: `casa-opy-preview-a1wu9fo8p`, READY, alias https://casa-opy-preview.vercel.app. As mensagens rolam dentro do chat e o campo fica acima da barra. A página não precisa ser rolada para continuar a conversa. A resposta continua saindo do material desta prévia, com a fonte indicada.

Instalação pelo botão e toque visível: `casa-opy-preview-8vsufwc68`, READY, alias https://casa-opy-preview.vercel.app. O aviso mostra o botão Toque para instalar. No Android e no Chrome o toque abre a instalação do sistema. No iPhone o sistema não deixa o site abrir essa janela, então o toque escreve o caminho na barra do Safari. O toque em um controle o pinta de vermelho e escurece o desenho. O botão Agora não continua ausente.

[Teste de mídia no navegador](../tests/opy/media-browser.cjs) também passou no endereço publicado: foto enviada e decodificada, sentimento persistido, áudio gravado com dispositivo sintético do Chrome, publicado e carregado. As publicações de ensaio foram excluídas pelo próprio autor. Revisão final mobile: ship, com captura iniciada diretamente em 390px (evita artefato do Chrome ao redimensionar uma captura desktop).

## Correção das fotos de perfil

A importação original não incluía o campo avatar. O importador agora associa as fotos de perfil existentes dos autores selecionados: 8 autores, presentes em 10 publicações. Copia somente esses arquivos, com nomes derivados de hash, e não exporta outros campos pessoais. A API entrega o caminho do avatar e o feed o mostra em 42×42px, com nome acessível. Arquivo ausente, padrão genérico ou falha de carregamento mantém a inicial. O [teste de avatares](../tests/opy/avatars.cjs) confere carregamento, associação ao autor, dimensões e fallback.

## Entrada

Não há senha compartilhada nem a janela de senha do navegador. Quem abre o endereço cai em **Entre na Casa Opy** (`/entrar/`) e cria o próprio usuário e senha desta prévia. As contas antigas do Etnias não entram por aqui.

O middleware em `preview/middleware.js` deixa as páginas do aplicativo passarem só com o cookie de conta assinado. A tela de entrada, os arquivos visuais e a API ficam acessíveis para o cadastro funcionar. Sem sessão, a API responde que é preciso entrar. O exportador copia esse middleware em todo deploy.
