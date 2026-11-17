# Glossário e guia de escrita da interface (U-09)

Decisões **propostas** para a identidade do Etnias. Júnior e a comunidade podem trocar qualquer termo; o importante é um nome por coisa, em todas as telas.

| Coisa | Nome na interface | Observações |
|---|---|---|
| A rede | **Etnias** | Título, logo, e-mails, compartilhamentos. "Etnias 2.0" só em textos técnicos/administração. |
| O menu do logo | **Menu do Etnias** | Antes: "OPY — Encontre seu caminho no Etnias". |
| Avisos / notificações | **Avisos** (ícone do maracá) | O maracá é a marca visual; o nome escrito é "Avisos". Rótulo de acessibilidade: "Avisos (maracá)". |
| Assistente de conversa | **EtnIA** | Página /etnia/. |
| Assistente de pedidos | **IAra** | Página /iara/. |
| Comunidades | **Comunidades** | Evitar "grupos" nos textos novos (a URL antiga /grupos/ continua). |
| Mensagens privadas | **Mensagens** | |
| Dados de povo e pertencimento | **Povo e pertencimento** | Dado sensível (LGPD): sempre com consentimento e opção de apagar. |
| "Opy", "Casa Opy" | Nome interno/código | Não aparece para quem usa, exceto no item de menu "Opy" (feed), a decidir pela comunidade. |

## Regras de escrita
- Português do Brasil, frases curtas, sem jargão ("fazer login" → "entrar"; "notificações" → "avisos").
- Botão = verbo no infinitivo ("Publicar", "Enviar", "Silenciar").
- Erro diz o que aconteceu **e o que fazer** ("O PDF passou de 2 MB. Comprima o arquivo e tente de novo").
- Não culpar a pessoa; não usar "inválido" sozinho.
- Todo ícone sem texto precisa de `aria-label` e, no celular, de uma legenda no primeiro uso.
- Texto novo entra em `preview/i18n/source.json` (e en/es quando possível).

## Pendente
- Escolher com a comunidade se "Opy" continua visível.
- Línguas indígenas (U-06): saudações e botões principais com áudio curto, co-criados com lideranças. Não dá para fazer sem as pessoas.
