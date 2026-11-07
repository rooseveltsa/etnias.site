# Análise da modernização do Opy Etnias 2.0

O Etnias 2.0 deve organizar a plataforma como a Casa Opy, preservando as relações e os conteúdos da comunidade. A recomendação inicial é reconstruir a navegação e os fluxos de uso sobre a aplicação existente, validar em ambiente de teste e depois decidir quais módulos precisam de substituição. A escolha de arquitetura ainda depende do alinhamento com a equipe.

## Referência e limites da análise

Base: documento Projeto Opy Etnias 2.0 com Imagens fornecido pelo usuário, incluindo as duas imagens incorporadas, e inspeção dos arquivos locais. A primeira imagem registra uma interface existente; a segunda apresenta o conceito desktop e celular. O próprio documento identifica suas referências como propostas, não como funcionalidades implementadas.

A inspeção foi estática. A presença de arquivos indica implementação disponível para investigação, não funcionamento validado. O tema ativo e os recursos habilitados dependem do banco do ambiente real. Os temas Sunshine e WoWonder estão presentes. A exportação SQL contém configuração de versão 4.3.4, mas isso não confirma a versão em produção.

## O que muda na experiência

### Casa Opy e acesso às áreas

A navegação atual mistura ações pessoais, formatos de mídia e áreas da plataforma. No Sunshine, a lateral inclui álbuns, vídeos, reels, itens salvos, memórias, cutucadas, grupos, páginas, blogs, produtos, diretório e outras entradas. A prioridade dessas opções não corresponde à arquitetura Opy.

A proposta é usar os nomes e a ordem do documento: Opy, Saberes, Conexões, Grupos, Páginas, Blogs, Mercado, Eventos, Filmes, Música, Empregos, Coletas e Sobre, com apoio ao Instituto em uma área própria. Itens pessoais como salvos e configurações continuam acessíveis pelo contexto da conta. Reduzir a lateral não deve eliminar recursos existentes.

O botão Opy abre a navegação completa. É necessário distinguir essa ação de voltar ao feed: um botão que abre menu não pode parecer um link que troca de página. No celular, o menu deve abrir como painel com fechamento explícito, Escape, foco contido e retorno do foco ao acionador.

### Barras superior e inferior

A barra superior reúne Opy, Maracá, Chat, busca e Interatividade. Maracá deve ter o nome acessível “Maracá — notificações”, contador de não lidas e estados de carregamento, vazio e falha. Chat deve reutilizar as conversas e seus contadores existentes.

A barra inferior mantém Feed, Mercado, Postagem, Saberes e EtnIA. No celular, deve respeitar a área segura e não cobrir conteúdo, botões de publicação ou campos quando o teclado estiver aberto. No desktop, os mesmos destinos precisam permanecer claros sem duplicar toda a navegação.

“Atualizar Feed” precisa de comportamento específico: fora do feed, voltar ao feed; no feed, solicitar novas publicações sem duplicar itens. Uma publicação em edição não pode ser descartada nessa ação. Voltar de um post deve recuperar a posição anterior da leitura.

### Publicação

O compositor atual reúne enquete, áudio gravado, sentimentos, arquivo, produto e outras opções em um componente extenso. A imagem atual mostra essas opções competindo com o conteúdo.

A proposta é manter texto e anexos frequentes visíveis e agrupar opções secundárias em “Mais”. O botão central de postagem abre esse mesmo compositor, evitando dois fluxos diferentes. A audiência da publicação deve estar visível antes do envio. O fluxo precisa informar progresso de upload, permitir corrigir falhas sem perder o texto e impedir envio duplicado.

Interatividade reúne aplicações e experiências. Ela não substitui ações básicas de criação como foto, áudio e enquete, que continuam pertencendo à publicação.

### Busca

A busca existente tem sugestões no cabeçalho e uma página com filtros. Há montagens diferentes de URL no mesmo cabeçalho: a tecla Enter usa `link1=search?query=`, enquanto sugestões usam `link1=search&query=`. O comportamento precisa ser verificado e unificado com codificação dos parâmetros.

A busca global proposta deve separar resultados por pessoas, publicações, grupos, páginas, eventos e conteúdos. Nenhuma busca pode revelar grupos privados, posts restritos ou conteúdo ao qual a pessoa não tem acesso. Consultas sem resultados devem oferecer alteração da pesquisa e filtros claros.

## Mapeamento dos requisitos

| Área do Opy | Evidência local | Trabalho necessário |
| --- | --- | --- |
| Opy e Feed | [Roteador](../public_html/index.php), [home](../public_html/sources/home.php) | Criar hierarquia Opy e definir retorno e atualização do feed. |
| Saberes | Não foi identificado módulo próprio nos caminhos examinados | Definir plataforma de cursos, matrícula, progresso, Área do Aluno e acesso OnDemand. Confirmar eventual sistema externo já existente. |
| Conexões | Busca, perfis, sugestões e descoberta de pessoas na base social | Distinguir a área social principal da experiência de descoberta em Interatividade; definir seguir, conectar ou solicitar amizade segundo a configuração vigente. |
| Grupos | [Grupos](../public_html/sources/my_groups.php), grupos sugeridos e participações | Separar descobrir comunidades de administrar as próprias; preservar privacidade e permissões. |
| Páginas | [Páginas](../public_html/sources/my_pages.php) e páginas sugeridas | Distinguir descoberta, acompanhamento e gestão de povos, organizações, projetos e criadores. |
| Blogs | [Blogs](../public_html/sources/blog.php), criação e leitura | Reorganizar descoberta e leitura; manter autoria e permissões de publicação. |
| Mercado | [Produtos](../public_html/sources/products.php), pedidos e checkout | Revisar descoberta, anúncio e compra; verificar regras de visibilidade e pagamentos antes de alterar. |
| Eventos | [Eventos](../public_html/sources/events/) | Revisar descoberta, inscrição ou presença, horários e eventos online/presenciais. |
| Filmes | [Filmes](../public_html/sources/movies/) | Preservar catálogo e controles de acesso; avaliar experiência de reprodução e legendas. |
| Música | Publicação de áudio no [compositor](../public_html/themes/sunshine/layout/story/publisher-box.phtml) | Áudio no feed não equivale a catálogo musical. Definir artistas, faixas, créditos e direitos. |
| Empregos | [Empregos](../public_html/sources/jobs.php) | Revisar consulta de oportunidades, publicação e candidatura. |
| Coletas | [Arrecadação](../public_html/sources/funding.php) | Diferenciar campanhas comunitárias da doação institucional; verificar fluxos financeiros. |
| Sobre | [Páginas institucionais](../public_html/sources/term.php) | Confirmar conteúdo oficial do Etnias e do Instituto. |
| Doe para o Instituto | Existem mecanismos financeiros, mas não foi confirmado destino institucional específico | Definir recebedor, modalidades e confirmação; não reutilizar uma campanha qualquer como doação oficial. |
| Maracá e Chat | [Cabeçalho](../public_html/themes/sunshine/layout/header/) e [mensagens](../public_html/sources/messages.php) | Reorganizar apresentação preservando contadores, leitura e conversas. |
| EtnIA | Há ferramentas de IA do fornecedor, incluindo criação de blog; não foi identificada experiência própria EtnIA | Definir tarefas, fontes, tratamento dos dados, custos e limites antes da integração. |

## Interatividade

| Experiência | Escopo a especificar |
| --- | --- |
| Guardião da Floresta | Tipos de ocorrência, registro, evidências, localização, encaminhamento, responsáveis e acompanhamento. Alertas de incêndio e conflitos não podem ser anunciados como serviço operacional sem uma cadeia real de atendimento. Localizações de pessoas e territórios exigem regras de visibilidade específicas. |
| Fotógrafos indígenas | Perfis e biografias, autoria, licenciamento de imagens, compra, entrega e remuneração. Fotos publicadas no feed não constituem esse serviço. |
| Descoberta de conexões | Critérios de descoberta e consentimento, diferenciados da rede social principal. |
| Jogos | Existe módulo de jogos na base. Conteúdo cultural, curadoria e adequação precisam ser definidos; um catálogo genérico não atende ao requisito. |

O documento repete “Fotógrafos indígenas” com uma descrição de busca global. Esse trecho precisa ser esclarecido para não gerar dois módulos com o mesmo nome e funções incompatíveis.

## Identidade e acessibilidade

Preservar a marca Etnias e adotar vermelho como destaque em fundos claros, conforme a referência. Não reproduzir nomes, contadores, eventos, cursos ou afirmações da imagem conceitual como se fossem dados reais. Grafismos, retratos e referências culturais precisam ter origem e contexto adequados; a imagem ilustrativa não autoriza o uso de qualquer representação como identidade dos povos.

Critérios propostos: navegação por teclado, foco visível, ícones com rótulos, contraste WCAG AA, alvos de toque de pelo menos 44 por 44 pixels e leitura sem rolagem horizontal a 320 pixels. Validar também zoom de 200%, títulos longos, nomes de povos com caracteres especiais, conexão lenta e preferência por movimento reduzido.

## Caminhos técnicos

| Caminho | Benefício | Custo e limite |
| --- | --- | --- |
| Modernizar por etapas sobre a base atual | Preserva usuários, relações, conteúdo e integrações; permite testar a nova experiência com comportamento real | Exige trabalhar com o legado e separar customizações das atualizações do fornecedor. É a recomendação inicial. |
| Reconstruir a plataforma com migração | Permite redesenhar a arquitetura inteira e substituir limitações estruturais | Requer inventário e migração de contas, senhas, relações, permissões, mídia, mensagens, URLs e pagamentos, além de operação paralela e reversão. |

Uma simples troca de cores não atende ao documento. Uma reconstrução completa também não deve ser escolhida apenas porque os arquivos são antigos. Primeiro é necessário confirmar a versão instalada, a licença e as atualizações disponíveis, as customizações e a compatibilidade com uma versão de PHP suportada.

## Sequência recomendada para a primeira entrega

1. Confirmar tema e configuração ativos e preparar uma cópia de teste com dados adequados ao desenvolvimento.
2. Validar wireframes desktop e celular da Casa Opy, incluindo menu aberto, compositor e busca.
3. Implementar navegação, barras e compositor sobre os módulos existentes, com chave de ativação e retorno à experiência anterior.
4. Validar login, feed, publicação, anexos, notificações, chat, grupos privados, mercado e histórico do navegador.
5. Especificar e implementar Saberes e as experiências novas conforme suas dependências reais.
6. Publicar somente após validação no ambiente de teste e aprovação, conforme o documento-base.

## Condições do ambiente local

Não há repositório Git na raiz examinada nem em `public_html`. PHP, Node, npm e Docker não foram encontrados no PATH desta sessão. Git e Python do sistema falham por configuração ausente das Command Line Tools do macOS. Essas condições impedem executar e testar a aplicação localmente com as ferramentas encontradas; não demonstram falha do servidor em produção.

Até este diagnóstico, nenhum arquivo da aplicação foi alterado. A próxima decisão é escolher evolução sobre a base atual ou reconstrução com migração; depois disso, aprovar uma proposta concreta da primeira entrega.
