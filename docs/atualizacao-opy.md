# Atualização da navegação Opy

A primeira etapa implementa a Casa Opy na aplicação existente, com navegação compartilhada nos temas Sunshine e WoWonder. Os módulos sociais continuam usando os handlers, o banco e os controles de acesso do WoWonder. Esta entrega é local e não foi publicada no servidor.

## Implementado

- Menu completo Opy no desktop e em painel acessível no celular.
- Cabeçalho com busca, mensagens, Maracá e conta, preservando o componente original de notificações e seus contadores.
- Interatividade com descoberta de pessoas e jogos quando habilitados; explicações para experiências ainda não integradas.
- Barra de Feed, Mercado, Postagem, Saberes e EtnIA, com proteção de rascunho nas novas ações de navegação.
- Botão Postagem que retorna ao compositor original, mantendo o texto em edição.
- Opções secundárias de publicação recolhidas em Mais opções, sem substituir upload, audiência ou envio.
- Construção e codificação corrigidas das URLs de busca dos cabeçalhos anteriores.
- Marca Etnias existente em um arquivo compartilhado otimizado de aproximadamente 40 KB, em vez de carregar o original de 6,8 MB.
- Acesso a grupos participados e páginas acompanhadas para contas sem permissão de criação; Filmes respeita a permissão da conta.

## Prévia local

Aplicação real com banco exclusivo de teste: [Etnias local](http://127.0.0.1:8098/index.php). Conta demonstrativa: `opy_teste`; senha somente desse ambiente: `Opy-local-2026!`. O banco contém apenas a estrutura exportada e dados sintéticos criados para validação.

Prévia de interface sem banco: [Casa Opy demonstrativa](http://127.0.0.1:8097/preview). Esse endereço identifica os dados como demonstrativos e não envia publicações.

Os endereços dependem dos containers locais criados nesta sessão. Eles não substituem a homologação com dados e configurações representativos do servidor real.

## Arquivos e ativação

O código compartilhado está em [assets/opy](../public_html/assets/opy). A [configuração](../public_html/assets/opy/config.php) contém a chave `enabled` e os destinos opcionais dos serviços. O ambiente também pode desativar a camada com `ETNIAS_OPY_ENABLED=0`.

A camada se aplica a pessoas autenticadas, não bloqueadas, no modo social `facebook`. Visitantes, outros modos do fornecedor e telas de manutenção/ativação conservam sua navegação anterior.

Os dois temas recebem inclusões pequenas em:

- Layout principal para carregar os estilos e as interações.
- Cabeçalho para escolher a navegação Opy.
- Lateral esquerda para organizar os destinos.
- Feed para introduzir a comunidade e identificar seu layout.

As cópias anteriores desses oito arquivos estão em [.codex-tmp/opy-backup](../.codex-tmp/opy-backup). Para desativar a nova experiência basta mudar `enabled` para `false` ou definir a variável de ambiente como `0`; não há migração de banco para reverter. As correções de codificação da busca permanecem nos cabeçalhos anteriores.

## Serviços que ainda dependem de implementação

Saberes, EtnIA, catálogo musical, Guardião da Floresta, fotografia comercial e contribuição institucional não foram implementados como novos serviços. Sem uma URL operacional configurada, suas entradas explicam a indisponibilidade. Configurar uma URL apenas aponta para um serviço existente: não cria matrícula, progresso de cursos, inteligência artificial, licenciamento, atendimento de ocorrências ou processamento de pagamentos.

O mercado, campanhas, grupos e demais módulos existentes precisam estar habilitados. Cada destino continua aplicando suas próprias permissões no servidor.

## Validação executada

| Verificação | Resultado |
| --- | --- |
| Testes PHP da camada compartilhada | 16 verificações aprovadas de ativação, desativação, permissões, rotas, escape e URLs |
| Sintaxe PHP | Novos arquivos e oito adaptações verificados com PHP 8.3 |
| Prévia sem banco | Menu, Escape, retorno de foco, serviços indisponíveis, Mais opções, rascunho e pesquisa aprovados nos dois temas |
| Aplicação real em banco isolado | Feed HTTP 200, menu e compositor originais, cancelamento de saída e publicação aceita pelo backend nos dois temas |
| Responsividade | Desktop de 1440 px e telas de 390 e 320 px sem rolagem horizontal nos testes |
| Erros JavaScript no feed real | Nenhuma exceção detectada nos fluxos exercitados |
| Detector visual da camada nova | Resultado vazio, sem ocorrências determinísticas |
| Reversão na aplicação real | Variável de ambiente restaurou o cabeçalho anterior e removeu os carregamentos CSS/JS Opy |
| Revisão independente | Quatro problemas funcionais corrigidos e cobertos por regressão; correções do compositor móvel consideradas resolvidas na revisão visual |

Os testes de navegador estão em [tests/opy](../tests/opy); usam Playwright como dependência apenas de desenvolvimento. É possível instalar as dependências nessa pasta e executar os testes com `npm --prefix tests/opy test`. Para reaproveitar uma instalação existente, definir `PLAYWRIGHT_MODULE` com seu caminho. `CHROME_PATH` permite usar um Chrome já instalado.

O [teste de integração](../tests/opy/integration.cjs) destina-se exclusivamente à instância local de validação na porta 8098 e publica conteúdo sintético nesse banco. O [router da prévia](../scripts/opy-preview-router.php) serve apenas a interface de teste e os recursos estáticos; não carrega as credenciais da aplicação.

## Recuperação e runtime — avanço de 4 de novembro de 2026

O servidor de integração passou a usar PHP **8.3.36**, com a imagem reproduzível de [deploy](../deploy). Os testes da interface e de publicação foram repetidos nesse runtime, nos dois temas. Isso verifica os fluxos exercitados; não certifica todos os módulos do WoWonder.

O defeito anterior em `Wo_GetSideBarAds` foi corrigido no código: ausência de cookie não derruba o feed, e os IDs do cookie são convertidos em inteiros antes da consulta. A regressão reproduziu o erro antes da correção e passou depois. Os anúncios foram reativados na base fictícia para repetir os testes.

| Verificação adicional | Resultado |
| --- | --- |
| Acesso | Login bcrypt pelo formulário, rejeição de senha incorreta e encerramento de acesso após sair |
| URLs amigáveis | Home, busca, grupos, páginas, blogs, mercado, eventos, mensagens e configurações abrem o conteúdo equivalente à rota PHP |
| Mensagens | Envio pelo formulário em uma conta fictícia e leitura autenticada pela segunda conta |
| Anexos | Publicação de imagem, resposta HTTP da mídia e persistência após recarregar o feed |
| Arquivos privados | Configuração, diagnóstico, SQL, ZIP do backup, PHP INI, log e configuração Node recusados por HTTP |
| Pasta de mídia | ZIP de anexo disponível; execução PHP recusada; testes escrevem em uma pasta independente |
| Preparação | Três testes aprovados de chave preservada, permissões privadas, rotas, recusa de sobrescrita e proteção da mídia original inclusive via symlink |
| Banco recuperado | 139 tabelas e contagens iguais à restauração original; 7.418 IDs/logins/e-mails/hashes/estados idênticos |
| Backup | SQL compactado restaurado em base temporária, conteúdo exportado de todas as tabelas idêntico e base temporária removida |
| Revisão | Revisão independente da recuperação sem novos problemas materiais após os ajustes |

O banco real permanece separado da aplicação de navegação e das operações fictícias. A conexão PHP 8.3/MySQLi à base real foi conferida por leitura de contagem, sem login de usuário real. Os resultados não comprovam uma senha antiga conhecida, entrega de e-mail, pagamentos, chamadas ou recursos externos de tempo real.

O [procedimento de recuperação](./recuperacao-servidor.md) contém instalação, restauração, backup, proteção de mídias e retorno de versão. A prévia funcional está em `http://127.0.0.1:8098`, exclusivamente local, com a conta fictícia `opy_teste` e senha de teste `Opy-local-2026!`.

## Limites e próxima etapa

Gateways financeiros, recuperação de conta por e-mail, moderação e notificações externas exigem homologação no novo destino. As imagens e widgets internos herdados não foram redesenhados integralmente. Há 9.220 caminhos de mídia ausentes no material disponível.

Faltam acesso ao novo servidor/domínio e documentos/protocolos autorizados para a EtnIA. Os novos serviços descritos anteriormente continuam pendentes; a validação dos módulos existentes não equivale à sua implementação. A rede com banco real não foi publicada. Uma [prévia navegável de avaliação](./previa-vercel.md), com dados demonstrativos e interações somente no navegador, está disponível em https://casa-opy-preview.vercel.app.
