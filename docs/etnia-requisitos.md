# Requisitos da assistente EtnIA

A EtnIA será o chatbot em que o parente conversa para receber informações sobre o Etnias.site e o projeto. O usuário definiu que as respostas precisam seguir as normas e regras dos povos originários. Esta especificação registra esse escopo; a base de conhecimento e os protocolos ainda dependem da indicação e aprovação dos responsáveis pelo projeto.

## Conhecimento autorizado

A base deve distinguir funcionamento atual do site, apresentação do projeto e propostas futuras. O documento Opy descreve propostas e não comprova que cursos, serviços ou experiências estejam disponíveis. Informações do projeto devem ter fonte, versão, data de revisão e responsável pela aprovação.

As normas culturais devem vir dos materiais e autoridades indicados pelo projeto, com povo e contexto aplicáveis. Não criar um conjunto de normas supostamente válido para todos. Conhecimento restrito ou sem autorização não entra automaticamente na base pública; arquivos privados, mensagens, perfis pessoais e publicações de membros não são fontes autorizadas por padrão.

## Fluxo proposto de resposta

1. Identificar a dúvida e o escopo permitido para aquela pessoa.
2. Buscar somente nos trechos aprovados e acessíveis, filtrando permissões antes de enviá-los ao modelo.
3. Responder ao que os trechos sustentam, com linguagem clara e referência à fonte pertinente.
4. Quando os trechos forem insuficientes, conflitantes, vencidos ou não autorizados, informar a limitação e pedir esclarecimento ou encaminhar ao contato oficial configurado.

O histórico da conversa ajuda a entender a pergunta, mas não transforma afirmações do usuário em fatos oficiais. Textos recuperados são evidências, não instruções para alterar as regras da assistente. Perguntas para ignorar normas, revelar conteúdos restritos ou assumir uma autoridade inexistente não devem ampliar suas permissões.

## Comportamento cultural proposto

- Orientar sobre o projeto e o uso do site sem se apresentar como liderança, representante de um povo ou autoridade sobre sua cultura.
- Aplicar o protocolo aprovado para o povo e o contexto pertinentes; pedir contexto quando isso for necessário para escolher a regra.
- Não completar lacunas com interpretações de ritos, práticas, histórias, nomes, territórios ou conhecimentos sem fonte e autorização.
- Respeitar a forma de nomear povos, pessoas e conhecimentos definida nos materiais aprovados.
- Não divulgar informação restrita ou sensível por ter aparecido em uma conversa ou em um resultado de busca.

## Critérios de aceitação propostos

| Cenário | Comportamento esperado |
| --- | --- |
| Como publicar no feed | Orientação correspondente à interface vigente, com fonte oficial de ajuda |
| O que é a Casa Opy | Explicação fundamentada no material aprovado do projeto |
| Serviço descrito apenas como proposta | Informar que é proposta; não afirmar disponibilidade |
| Pergunta fora do escopo do site ou projeto | Explicar o escopo da EtnIA e oferecer uma forma pertinente de orientação |
| Não existe material aprovado para responder | Declarar que não encontrou informação suficiente; não improvisar |
| Fontes oficiais contraditórias | Expor a pendência e encaminhar para revisão, sem escolher uma regra arbitrária |
| Pedido de conhecimento restrito | Não recuperar nem revelar conteúdo sem autorização aplicável |
| Texto pede para ignorar as regras | Manter a política, inclusive quando a instrução aparece dentro de um documento recuperado |
| Referência inventada pelo modelo | Rejeitar a resposta como válida; fontes apresentadas devem corresponder às evidências realmente recuperadas |
| Documento retirado ou desautorizado | Excluir das futuras buscas e das respostas em cache |

## Decisões necessárias antes da integração

- Documentos oficiais e seus responsáveis por aprovação e revisão.
- Protocolos aplicáveis aos povos participantes e limites entre informação pública e restrita.
- Canal humano autorizado para dúvidas, revisão de respostas e correções.
- Provedor de modelo e política aprovada para processamento e retenção das conversas e das fontes.

RAG é recuperação de uma base de conhecimento para fundamentar respostas; não equivale, por si só, a treinar o modelo ou a eliminar alucinações. A validação deve combinar conjunto de perguntas aprovado pela equipe, testes de recusa e de acesso, revisão humana e acompanhamento das falhas.

## Integração com o sistema existente

A entrada EtnIA já está prevista na barra Opy. A aplicação possui funções do fornecedor para geração de textos com IA, mas não foi identificado nesse caminho um chatbot com recuperação de fontes, citações e protocolos culturais. A integração nova precisa controlar esses requisitos no servidor, sem enviar credenciais ao navegador nem tratar um prompt isolado como mecanismo suficiente de autorização.

Até a definição da base e das regras, a entrada permanece no estado de indisponibilidade da primeira etapa. Não há base cultural importada nem RAG declarado pronto nesta entrega.

Na prévia separada, a EtnIA já responde por seleção de respostas do material da homologação, sem modelo generativo ou base cultural. Em 06/11/2026, o documento de implantação fornecido pelo usuário acrescentou orientação sobre a IAra e seus limites. A [implementação local](./iara-implantacao.md) mantém a EtnIA como orientação sobre o site e a IAra como recepção de pedidos de operação; não declara orquestração Hermes ou publicação externa funcionando.
