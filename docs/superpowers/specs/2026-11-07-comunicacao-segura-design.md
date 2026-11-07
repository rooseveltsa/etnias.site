# Comunicação segura e auditoria Casa Opy

## Intenção e limites
Atender ao pedido de auditoria, correções, chat e avaliação de chamadas, preservando diversidade e autonomia. Implementação e testes locais; não alterar produção, domínio, credenciais ou banco recuperado. EtnIA continua limitada às fontes aprovadas. Decisões culturais e contratação de serviços dependem de pessoas responsáveis.

## Abordagens
1. Reescrever tudo: descartado; alto risco e duplica infraestrutura.
2. Ativar o chat Node legado na prévia: descartado; superfícies de autenticação distintas e falhas de autorização identificadas.
3. Melhorar incrementalmente a prévia e revisar separadamente o legado: escolha técnica do agente, dentro da autonomia solicitada. Reutilizar cookies, transações e armazenamento privado existentes. Nenhum serviço novo.

## Entrega local
Auditoria com evidências e classificação de implementação, protótipo e pendência. Chat individual e pequenos grupos privados com autorização em cada operação, anexos privados, paginação, edição, resposta, remoção, reações, bloqueio e preferências. Reenvio idempotente com rascunho preservado; sem prometer entrega/leitura que não foi confirmada. Interface com controles rotulados, estado de rede e preservação da posição de leitura. Não expor presença por padrão.

## Limites conhecidos
Blob JSON atende homologação, não substitui banco transacional indexado e canal realtime de produção. Polling não é WebSocket. Sem promessas de criptografia ponta a ponta, antivírus, push em segundo plano ou governança comunitária já implementada. Chamadas dependem da comparação de soluções, aprovação de eventual custo e infraestrutura verificável. Sem gravação.

## Validação
Dados sintéticos isolados; testes de autorização com três contas, perda de resposta/reenvio, mídia, grupos, sessões, fluxos de navegador e responsividade. Relatório explicita itens não implementados e não testados. Revisão independente conforme Superpowers.
