# Diagnóstico do backup e migração do Etnias

O arquivo `etnias_banco_1793632166.sql` contém os cadastros antigos, hashes de senha e dados sociais do Etnias. A restauração completa em um banco isolado terminou sem erros. É possível planejar a recuperação das contas preservando as senhas; a recuperação integral das mídias ainda depende de arquivos que não estão nas cópias locais verificadas.

## Backup analisado

- Origem: `/Users/juniormiranda/Downloads/etnias_banco_1793632166.sql`.
- Tamanho: 69.366.718 bytes, aproximadamente 66 MiB.
- Final do arquivo registra exportação concluída em 02/11/2026 às 12:09:29; fuso de geração não confirmado.
- Configuração exportada: WoWonder 4.3.4, tema Sunshine, modo social Facebook.
- SHA256: `556d54b55a89db0d889071a6094d66bfb1ab213449cf154ab8bf3c1457279e56`.

O checksum permaneceu igual após a análise. O original não foi modificado. A análise não exibiu nomes, emails, mensagens, senhas, hashes individuais ou credenciais de integração.

## Conteúdo confirmado

| Dados | Quantidade |
| --- | ---: |
| Tabelas restauradas | 139 |
| Contas | 7.418 |
| Contas com indicador ativo igual a 1 | 7.124 |
| Contas com indicador ativo igual a 0 | 294 |
| Publicações | 13.906 |
| Mensagens | 2.925 |
| Relações de seguidores | 26.969 |
| Grupos | 58 |
| Páginas | 33 |
| Comentários | 2.549 |
| Produtos | 39 |

Os 7.418 identificadores de usuários são distintos. Não foram encontrados nomes de usuário ou emails vazios, nem duplicidades desses campos na comparação sem diferenciação de maiúsculas. As publicações com `user_id` positivo têm usuário correspondente no banco restaurado.

Essas verificações confirmam o conteúdo e a restauração deste arquivo. Não demonstram que ele inclua alterações feitas no servidor depois da exportação de 2 de novembro.

## Senhas e continuidade das contas

Todas as 7.418 contas têm um valor de senha com formato bcrypt e comprimento de 60 caracteres. São hashes de verificação, não as senhas em texto legível.

O [login atual](../public_html/assets/includes/functions_one.php) reconhece hashes nesse formato e usa `password_verify`. A primeira etapa Opy preserva esse backend, portanto não exige converter os hashes ou solicitar uma redefinição geral de senhas.

Na migração, preservar o valor exato dos hashes, IDs, nomes de usuário, emails, status e permissões. Não aplicar hash novamente sobre um hash existente. O funcionamento de uma senha específica só pode ser confirmado por um teste de login com uma conta autorizada cujo titular conheça a senha; isso não foi realizado com contas antigas nesta análise.

## Mídias que precisam de recuperação

O banco referencia arquivos, mas a exportação SQL não contém os binários dessas fotos, áudios, vídeos e anexos. Foram verificados caminhos nos campos de avatar/capa, publicações, mensagens, álbuns, produtos e stories.

| Conjunto de referências | Caminhos distintos no conjunto | Presentes na cópia local | Ausentes |
| --- | ---: | ---: | ---: |
| Perfis e capas | 5.890 | 2.103 | 3.787 |
| Mídias e miniaturas de publicações | 11.156 | 5.765 | 5.391 |
| Anexos de mensagens | 105 | 95 | 10 |
| Imagens de álbuns | 2.165 | 1.763 | 402 |
| Imagens de produtos | 80 | 68 | 12 |
| Mídias de stories | 311 | 291 | 20 |

Há sobreposição entre conjuntos; não somar as linhas. A união contém **17.568 caminhos locais distintos**, dos quais **8.348 existem e 9.220 não foram encontrados**. O diagnóstico diz respeito aos campos examinados, não a todos os possíveis vínculos de arquivos da plataforma.

A cópia em `Downloads/etnias.site/public_html`, o arquivo `public_html/enviar-etnias.zip` e a outra cópia conhecida em `/Users/juniormiranda/Projetos 2026/etnias.site/public_html` foram verificados. Nenhum dos caminhos ausentes foi recuperado nessas alternativas.

Isso não impede a restauração das contas e dos dados textuais. Impede afirmar que fotos, capas e anexos estarão integralmente recuperados. É necessário localizar uma cópia mais completa da pasta `upload`, um backup integral da hospedagem ou outro armazenamento que contenha esses arquivos. Referências ausentes não devem ser apagadas: preservá-las permite recuperar as mídias depois.

## Compatibilidade com a aplicação local

As 139 tabelas correspondem em nomes às da estrutura incluída no projeto. A comparação dos nomes de colunas encontrou uma diferença em `Wo_Langs`: o backup contém menos colunas de idiomas do que a estrutura de instalação. A comparação não constitui uma auditoria integral de tipos, índices e rotinas.

Preservar a personalização de idiomas e verificar o idioma padrão em homologação. Não substituir a tabela de traduções pelo arquivo de instalação sem analisar o conteúdo.

Também existe uma definição local de `siteEncryptKey` no arquivo de configuração do sistema. Essa configuração precisa acompanhar, de forma privada, a validação das integrações que usam valores criptografados; sua existência não prova que todas as credenciais antigas continuarão válidas.

## Caminho proposto para a virada

1. Preservar o SQL original e as cópias de arquivos existentes como ponto de recuperação.
2. Preparar o novo servidor e restaurar o backup em um banco exclusivo e vazio, sem misturar dados demonstrativos.
3. Instalar a versão compatível da aplicação e validar primeiro o comportamento existente; depois habilitar a camada Opy, que possui chave de reversão.
4. Recuperar a pasta `upload` mais completa disponível e conferir novamente as referências ausentes.
5. Validar, com contas autorizadas, login com a senha antiga, recuperação de senha, permissões, perfis, feed, publicações, grupos, páginas, mensagens e mídias. Configurar e testar domínio, HTTPS, email e recursos de tempo real no novo ambiente.
6. Confirmar qual é o backup mais recente disponível. Sem acesso ao servidor antigo não há sincronização final garantida; documentar o ponto de corte e eventuais dados posteriores não recuperados.
7. Fazer um snapshot da homologação aprovada antes da virada. O retorno operacional deve existir no novo servidor, pois não se pode contar com o servidor antigo.
8. Publicar e acompanhar a experiência dos usuários após aprovação da homologação.

A prioridade é manter contas, senhas e relações existentes, reduzindo mudanças simultâneas. A troca de tecnologia de autenticação ou reconstrução completa exige uma validação adicional e não deve ser confundida com a restauração deste backup.

## Ambiente de verificação

A restauração foi executada em MariaDB 11, no container `etnias-backup-audit`, sem rede e sem porta publicada. O banco é `etnias_restore`. Ele não foi conectado à aplicação de prévia, não substituiu o banco de teste da interface e não publicou os dados pessoais em um novo serviço.

Não foi realizada migração para um servidor remoto. Faltam a definição do novo destino, a recuperação das mídias e a homologação com contas autorizadas.

## Dimensionamento medido para avaliar hospedagem

Na restauração MariaDB, as estatísticas das tabelas indicam aproximadamente 85,42 MiB de dados e 80,09 MiB de índices, totalizando 165,52 MiB. Esse valor não é uma medição do tamanho que a base teria após conversão para Postgres.

Os 8.348 arquivos locais distintos, já existentes e referenciados nos campos examinados, somam 20.197.016.670 bytes: aproximadamente 20,2 GB decimais ou 18,81 GiB. O total não inclui os 9.220 caminhos ausentes, portanto não representa o tamanho final de um acervo integralmente recuperado.

Para avaliar Supabase, considerar separadamente banco, arquivos, tráfego e modelo de autenticação. A aplicação atual usa MySQL/MariaDB por `mysqli`; converter os dados para Postgres exige adaptar o código, não apenas importar o SQL ou trocar uma URL. A recomendação para reduzir o impacto da virada é recuperar primeiro a aplicação compatível no novo servidor e avaliar Supabase para módulos novos, como a base RAG da EtnIA, antes de uma migração integral.

Preços e quotas devem ser confirmados na [página oficial do Supabase](https://supabase.com/pricing). A escolha do provedor ainda não foi executada.

## Ensaio de recuperação realizado

Foi criada outra base em MariaDB 11.4, separada do banco fictício e sem porta publicada, pelo [Compose de recuperação](../deploy/compose.yaml). O teste comparou as 139 tabelas e suas contagens com a restauração original. IDs, nomes de login, e-mails, hashes e estados de ativação das 7.418 contas ficaram idênticos. A chave de criptografia antiga foi preservada na configuração privada.

Uma execução CLI com PHP 8.3.36/MySQLi consultou a contagem da base real. O serviço web dessa base permanece parado; não foram feitos testes de escrita ou autenticação de pessoas reais. O container original de auditoria foi parado após a comparação, preservando seus dados.

Um novo backup SQL compactado foi produzido e restaurado em base temporária. A comparação do conteúdo exportado de todas as tabelas retornou igualdade; a base temporária foi removida. As mídias originais ficam somente leitura na configuração de recuperação. Esse ensaio local não substitui os arquivos ausentes nem publica o projeto.

Consultar o [procedimento do novo servidor](./recuperacao-servidor.md) e o [registro dos testes funcionais](./atualizacao-opy.md).
