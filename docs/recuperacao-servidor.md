# Recuperação da Casa Opy / Etnias

Esta instalação preserva o modelo de dados e a autenticação do WoWonder. Não converte os usuários para Supabase nem exige redefinição coletiva de senhas. A nova interface compartilha o backend existente.

## Componentes

- [Dockerfile](../deploy/Dockerfile): Apache/PHP 8.3 com MySQLi, imagens, uploads e bibliotecas usadas pelo sistema.
- [Compose](../deploy/compose.yaml): MariaDB 11.4 em rede privada, banco persistente e HTTP vinculado exclusivamente a `127.0.0.1`.
- [Configuração de runtime](../deploy/config.php): credenciais novas por ambiente; chave `siteEncryptKey` preservada da instalação anterior.
- [Preparação](../scripts/prepare-recovery.py): gera credenciais privadas e preserva as regras originais de URLs amigáveis. Retira apenas o redirecionamento HTTPS do Apache interno; HTTPS deve terminar no proxy do novo servidor.
- [Operação do banco](../scripts/recovery-database.sh): restauração somente em banco vazio, contagens e backup com verificação gzip.

O código é montado somente para leitura. Mídias também são somente leitura por padrão. O cache tem volume próprio. A pasta original de mídias não pode ser selecionada como gravável pelo preparador.

## Preparar no novo servidor

Copiar o projeto para o destino e disponibilizar Docker com Compose. Copiar também o backup SQL e as mídias recuperadas. Manter uma cópia original independente; usar outra pasta como área de trabalho para uploads.

Exemplo a executar a partir da raiz do projeto, substituindo os caminhos e o domínio pelos valores do destino:

```bash
python3 scripts/prepare-recovery.py \
  --upload-directory /srv/etnias-dados/upload \
  --writable-uploads \
  --site-url https://DOMINIO-DO-PROJETO
docker compose -f deploy/compose.yaml build web
docker compose -f deploy/compose.yaml up -d db
bash scripts/recovery-database.sh restore /srv/backups/etnias-original.sql
bash scripts/recovery-database.sh counts
bash scripts/recovery-database.sh backup
```

Não usar `--fixture` com dados reais: essa opção gera outra chave e serve exclusivamente para testes fictícios. A preparação recusa sobrescrever [a configuração privada](../deploy/.env.example). O arquivo gerado `deploy/.env` deve ter permissão 600, ser guardado fora de repositórios e entrar no backup privado do operador.

A restauração deixa o serviço web parado. Antes de iniciá-lo, atualizar `Wo_Config.site_url` para o domínio novo, conferir a chave antiga e configurar as integrações do novo servidor. E-mail, SMS, pagamentos, notificações externas, logins sociais e tarefas agendadas dependem de credenciais e endpoints válidos. Não ligar a cópia de teste a esses serviços de produção. Verificar também a configuração do serviço de chat em tempo real caso seja utilizado.

Na cópia gravável de mídias do novo servidor, conferir a propriedade para o usuário do Apache (`www-data`, UID 33 na imagem), mantendo a cópia original separada. O volume de cache é preparado automaticamente pelo entrypoint.

Após essas conferências:

```bash
docker compose -f deploy/compose.yaml up -d web
```

Configurar um proxy HTTPS no servidor para encaminhar ao HTTP local `127.0.0.1:8099`, sem publicar a porta do banco. Habilitar cookies seguros no contexto HTTPS e conferir os callbacks do domínio antes da virada. O Compose não publica o site na internet sozinho.

## Conferência e ensaio

O [teste de preservação](../tests/opy/preservation.py) compara a restauração isolada original com a nova base: mesmas 139 tabelas e contagens, além de IDs, nomes de login, e-mails, hashes de senhas e estados de ativação exatamente iguais para as 7.418 contas. Não revela esses dados na saída e não testa senhas conhecidas de usuários reais.

O [teste funcional](../tests/opy/recovery.cjs) usa exclusivamente a base fictícia em `127.0.0.1:8098`. Verifica login real com bcrypt, rejeição de senha incorreta, telas próprias e equivalência das URLs amigáveis, sessão, saída e bloqueio HTTP de arquivos privados. O [teste de integração](../tests/opy/integration.cjs) publica textos fictícios e confere os dois temas e tamanhos de tela.

Não apontar esses testes de escrita para a base recuperada. Antes da virada pública, realizar um ensaio separado com contas autorizadas, incluindo anexos, mensagens entre contas de teste, recuperação de senha com o SMTP novo e administração. Os testes locais documentados não certificam integrações externas nem entrega de e-mail.

## Backup e retorno

O comando `backup` produz SQL compactado consistente para as tabelas transacionais, inclui rotinas/eventos/triggers e verifica a integridade do gzip. Guardar em destino independente e com acesso restrito. O banco contém dados pessoais e hashes de senha.

O backup do banco **não inclui arquivos**: copiar também upload, configuração privada e versão do código. Fazer um ensaio de restauração em volume novo. Não usar `docker compose down -v` em uma instalação com dados que precisem ser preservados.

Para retornar à interface anterior, configurar `ETNIAS_OPY_ENABLED=0` e recriar somente o serviço web. Para retornar de uma mudança de banco, restaurar o snapshot anterior em outro volume/base, conferir e então trocar o destino. A restauração automatizada recusa sobrepor tabelas existentes.

## Pendências reais

- Novo servidor, domínio e configuração HTTPS ainda não foram fornecidos; esta etapa não publica a versão.
- A auditoria encontrou 9.220 caminhos de mídia ausentes nos arquivos disponíveis. O SQL preserva as referências, mas não contém os arquivos perdidos. Consultar [diagnóstico](./diagnostico-backup-migracao.md).
- A EtnIA aguarda documentos, autorização de uso e protocolos das comunidades participantes. Não há base RAG aprovada nem geração ativada. Consultar [requisitos](./etnia-requisitos.md).
- Saberes, doações e serviços novos só recebem links operacionais quando as respectivas integrações existirem. A interface não apresenta operações simuladas como concluídas.
