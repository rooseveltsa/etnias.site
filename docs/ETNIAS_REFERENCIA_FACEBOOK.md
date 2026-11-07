# Referência: o que aprender com o Facebook (usabilidade e ferramentas)

Objetivo: trazer para o Etnias os padrões que fazem o Facebook ser usado por bilhões de pessoas, inclusive em conexões lentas e celulares simples, sem copiar marca nem visual proprietário, e adaptando cada ponto às necessidades dos povos originários. Análise de 2026-11-07, baseada no conhecimento público do produto; não usa dados internos da Meta.

## 1. Por que o Facebook é usado por quem tem pouca familiaridade com tecnologia

| Princípio | Como o Facebook faz | O que fazemos no Etnias |
|---|---|---|
| **Uma tarefa principal por tela** | O feed é a casa; criar post fica no topo, sempre no mesmo lugar | Feed com compositor de uma linha (feito) |
| **Identidade sempre visível** | Foto da pessoa em todo post, comentário e mensagem | Foto de perfil real em posts, chat e perfil (esta entrega) |
| **Perfil como “casa” da pessoa** | Capa, foto, nome, apresentação, fotos, amigos e linha do tempo | Perfil em página própria (esta entrega) |
| **Contexto antes de contato** | Você conhece alguém pelo grupo, pela publicação ou por amigos em comum | Comunidades por tema e Direct com solicitação (feito) |
| **Funciona com internet ruim** | Facebook Lite, textos antes de mídia, carregamento progressivo | Mídia sob demanda (`preload="none"`), 2 MB por anexo; próximo passo: modo “economia de dados” |
| **Linguagem simples e ícones com rótulo** | “Curtir”, “Comentar”, “Compartilhar” sempre com texto | Rótulos visíveis em português; próximo passo: interface em línguas indígenas onde houver tradução aprovada |
| **Desfazer e corrigir é fácil** | Editar, apagar, arquivar, ocultar | Editar e apagar mensagens (feito); editar publicações (pendente) |

## 2. Ferramentas, uma a uma

Estado no Etnias: ✅ existe · 🟡 parcial · ⛔ não existe. Prioridade: **P1** próxima rodada · **P2** depois · **P3** quando houver demanda.

### Perfil
| Ferramenta | Etnias | Prioridade | Adaptação indígena |
|---|---|---|---|
| Capa e foto de perfil | ✅ nesta entrega | — | Nada de molduras com grafismos genéricos |
| Apresentação (bio, onde mora, organização) | ✅ nesta entrega | — | Campo “povo / território / organização” é **opcional e autodeclarado**; nunca inferido |
| Abas: Publicações, Sobre, Fotos, Amigos | ✅ nesta entrega (Comunidades no lugar de Amigos) | — | A lista de amigos de outra pessoa não é exibida, por privacidade |
| Destaques fixos no perfil | ⛔ | P2 | Fixar uma publicação importante (ex.: campanha da aldeia) |
| Perfil de página/organização (associações, coletivos) | ⛔ (o legado tem Páginas) | P1 | Aproveitar Páginas do WoWonder para associações e escolas indígenas |
| Selo de verificação | ⛔ (o legado tem) | P2 | Verificar **organizações e lideranças** com aval comunitário, não por documento pago |

### Feed e publicações
| Ferramenta | Etnias | Prioridade | Adaptação |
|---|---|---|---|
| Reações além do curtir | ✅ (5 reações) | — | Revisar com as comunidades se os ícones fazem sentido culturalmente |
| Comentários com resposta e curtida | ⛔ (só texto) | **P1** | Item 6.12 do documento |
| Compartilhar com comentário | ✅ (repost) | — | Respeitar quando o autor proíbe compartilhar (conteúdo sensível) |
| Editar publicação | ⛔ | P1 | — |
| Público por post (Público, Amigos, Somente eu) | 🟡 (Público / Somente eu) | P1 | Acrescentar “Minha comunidade” |
| Sentimento/atividade, enquete, local | ✅ | — | Local sem coordenadas (privacidade territorial) |
| Salvar | ✅ | — | — |
| Memórias (“neste dia”) | ⛔ (o legado tem) | P3 | Útil para datas da luta e da cultura |
| Hashtags | 🟡 (texto livre) | P2 | Tags de povos e temas só por autodeclaração |

### Grupos (Comunidades)
| Ferramenta | Etnias | Prioridade | Adaptação |
|---|---|---|---|
| Público/privado com aprovação | ✅ | — | — |
| Perguntas de entrada | ⛔ | **P1** | Fundamental para comunidades que guardam conhecimento restrito |
| Regras fixadas e moderadores | ✅ | — | — |
| Fila de denúncias para moderadores | 🟡 (grava, sem fila) | **P1** | Moderação feita pela própria comunidade |
| Unidades / trilhas de aprendizado | ⛔ (há “Saberes”) | P2 | Ligar Saberes às comunidades |
| Eventos do grupo | ⛔ (o legado tem Eventos) | P2 | Assembleias, rodas, festas |

### Mensagens (Messenger)
| Ferramenta | Etnias | Prioridade | Adaptação |
|---|---|---|---|
| Solicitações de mensagem | ✅ | — | — |
| Chamadas de voz e vídeo | ✅ (1:1) | — | Servidor próprio, dados não passam por terceiros |
| Áudio gravado | ✅ | — | Prioridade em territórios com baixa alfabetização na escrita |
| Grupos de conversa | ✅ | — | — |
| Status online | ⛔ | P2 | Desligado por padrão (proteção) |

### Descoberta e outras áreas
| Ferramenta | Etnias | Prioridade | Adaptação |
|---|---|---|---|
| Busca de pessoas, grupos e posts | ✅ | — | — |
| Sugestões de amizade | ⛔ | P2 | Baseadas em comunidade em comum, nunca em contatos do celular |
| Marketplace | ⛔ (o legado tem Mercado) | P2 | Artesanato e produção indígena com origem declarada |
| Eventos | ⛔ (o legado tem) | P2 | — |
| Vídeos/Reels | ⛔ (o legado tem Reels) | P2 | Item 6.10 |
| Ao vivo | 🟡 (estúdio de teste) | P2 | Servidor próprio (MediaMTX) |
| Notificações | 🟡 (central interna) | **P1** | Push sem depender de serviço externo |

### Segurança e privacidade
| Ferramenta | Etnias | Prioridade | Adaptação |
|---|---|---|---|
| Verificação de privacidade guiada | ⛔ | P2 | Linguagem simples, em áudio também |
| Bloquear e denunciar | ✅ | — | — |
| 2FA e alertas de login | ⛔ (o legado tem) | P1 | Item 1.4 |
| Baixar meus dados / excluir conta | ⛔ (o legado tem) | P1 | LGPD; respeitar também o direito coletivo sobre dados do povo (princípios CARE) |

## 3. O que **não** copiar

- **Algoritmo de engajamento a qualquer custo.** O feed do Etnias é cronológico, com Descobrir alternando autores. Nada de priorizar polêmica.
- **Anúncios direcionados e rastreamento entre sites.**
- **Lista pública de amigos e “pessoas que você talvez conheça” por contatos do celular.**
- **Reconhecimento facial e marcação automática.**
- **Identidade visual, ícones ou nomes proprietários** (“Curtir” com polegar azul, logotipos etc.).

## 4. Ordem recomendada (próximas rodadas)

1. **Perfil completo com foto e capa** (esta entrega).
2. Comentários com resposta e curtida (6.12) e edição de publicações.
3. Perguntas de entrada e fila de moderação nas comunidades.
4. Público “Minha comunidade” por publicação.
5. Notificações push.
6. Páginas de organizações, aproveitando o WoWonder.
