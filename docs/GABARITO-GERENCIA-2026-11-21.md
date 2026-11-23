# Gabarito: documentos da Gerência Etnias (20–21/11/2026)

Conferência de cada documento contra o código. **FEITO** = existe e foi testado; **PARCIAL** = existe uma parte; **FALTA** = não existe; **DECISÃO** = precisa da direção antes de construir (dinheiro, dados pessoais, contas de terceiros, cultura).

Commits desta rodada: `0ec467a9`, `9cf01f44`, `d27751f3`, `bc5166d1`, `837518eb`, `b7111ff1` (testes: `tests/opy/correcoes-gerencia.mjs`; todos os arquivos de `tests/opy/` passando).

## 1. Correção de alguns erros (Documento Mestre v1.8): 17 itens

| Código | Item | Status | Como conferir |
|---|---|---|---|
| NOTIF-001 | Notificações só no popup | FEITO | Maracá do topo abre o painel; sem "Abrir completo" |
| TEMA-001 | Modo escuro sem áreas brancas | FEITO | Varredura em 13 telas + menus e janelas abertas; cores fixas trocadas por variáveis |
| AMIZADE-001 | Popup não fecha ao aceitar | FEITO | Aceitar no painel ou em Solicitações: continua aberto e mostra "Pedido aceito" |
| STORY-001 | Não vistos primeiro, vistos no fim | FEITO | Assistir um story: a pessoa vai para o fim da fila |
| CURTIDA-001 | Número de reações abre quem reagiu | FEITO | Tocar no número: lista com foto, nome, reação e Seguir |
| POST-001 | Menu ⋯ em toda publicação | FEITO | Própria: editar/impulsionar/excluir. Alheia: denunciar |
| POST-002 | Admin/moderação excluem com registro | FEITO | Validado no servidor; motivo vai para o histórico do Centro de gestão |
| CURTIDA-002 | Maracá web × celular | FEITO | Web: passar o mouse. Celular: tocar curte, segurar abre as reações |
| COMENT-001 | Menu ⋯ nos comentários | FEITO | Excluir (autor, dono do post, equipe) e denunciar |
| COMENT-002 | Curtir respostas | FEITO | Mesmo botão em comentário e resposta |
| COMENT-003 | Foto em comentário com compressão | FEITO | Botão de foto no campo; reduzida no aparelho; só imagem |
| POST-003 | Curtir, Comentar, Salvar, Compartilhar | FEITO | Compartilhar reúne repostar, enviar pelo celular e copiar link |
| FOTO-001 | Zoom nas fotos | FEITO | Duplo toque, pinça ou roda do mouse; arrastar com zoom |
| PRESENÇA-001 | Verde/azul/vermelho | FEITO | Verde automático; ocupado e não incomodar na caixa de publicação |
| GEO-001 | Geolocalização com permissão | FEITO (anterior) | Configurações > Localização; só cidade, revogável |
| VIDEO-001 | Upload maior e compressão | FEITO | Até 40 MB, MOV do iPhone aceito, fila de compressão no servidor; o feed mostra "Processando o vídeo" enquanto a versão leve não fica pronta |
| VIDEO-002 | Aba Vídeos abre o reprodutor | FEITO | Tocar em Vídeos entra direto no MOMENTOS em tela cheia |

## 2. Segurança (auditorias da Lari e do Ramon)

| Achado | Status |
|---|---|
| @ da administração podia ser registrado por outra conta (tomada de admin) | CORRIGIDO |
| Backdoor ofuscado (WoWonder) e `_diag.php` no código legado | REMOVIDOS do repositório. **Conferir o servidor antigo**, onde o arquivo pode existir |
| Capa de vídeo órfã, exclusão LGPD incompleta no registro, `__proto__`, gravação sem fsync | CORRIGIDOS |
| Repositório público com senha antiga do banco e dados de infraestrutura | **DECISÃO**: tornar o repositório privado e trocar a senha |
| Lives sem checagem de quem pode ver (lista, ações e vídeo WHEP) | CORRIGIDO |
| Limite por minuto dentro da gravação do banco | CORRIGIDO (em memória, antes de gravar) |
| Tetos globais (o chat parava para todos com 10 mil mensagens) | CORRIGIDO (cotas por pessoa: 500 msg/dia, 20 grupos, 10 comunidades) |
| Uploads simultâneos sem limite; sessão revogada no /legado | CORRIGIDO (2 envios grandes por conta e 16 no servidor; /legado e live conferem a sessão ativa) |
| Banco em JSON único, tempo real (WebSocket/SSE), API para o app nativo | Projeto: migração SQLite já planejada (`docs/PLANO-SQLITE.md`) |

## 3. Demais documentos

| Documento | Situação | O que já existe | Maior lacuna | Decisões necessárias |
|---|---|---|---|---|
| Cadastro | PARCIAL | Cadastro por e-mail/celular, limites anti-robô, recuperação com código, LGPD, idiomas; **novo:** aviso de senha trocada | Telefone internacional (+DDI), trocar e-mail/telefone, textos do login pelo painel | CPF/documento, CAPTCHA de terceiro, provedor de e-mail/WhatsApp |
| Comunidade | PARCIAL | Públicas/privadas, pedidos, convites e links, papéis, denúncia, quem publica, conversa do grupo; **novo:** só o dono nomeia a equipe, remover e bloquear, histórico, fixar publicação, desligar comentários | ~~Suspender pelo painel central~~ (feito), foto de capa, permissões finas por pessoa, estatísticas | Aprovação central obrigatória; categorias |
| Página | PARCIAL | Criar, foto/capa, contatos, seguir, equipe, agenda | ~~Publicar como Página (feed próprio)~~ e ~~suspender~~ (feitos); eventos em /eventos/, denunciar | Loja na Página; fluxo de aprovação; categorias |
| Vídeos curtos (MOMENTOS) | PARCIAL | Tela cheia, 9:16, limite de 4 min, capa + ▶; **novo:** + para seguir no avatar, próximo vídeo não é baixado antes | ~~Abas Seguindo/Para você, atalho LIVE~~ (feitos); live no mesmo formato | — |
| Conexão | FALTA | Busca geral, cidade no perfil, pedido de conversa, bloqueio | Tela de cartões, favoritos, curtir perfil, visitas, sair das buscas | Busca por raio em km exige guardar localização aproximada |
| Mercado | PARCIAL | Classificados com fotos, avaliações, conversa pelo chat | Lojas, aprovação comercial, suspender produto, gestor de marketing | Pagamento, comissões, divulgadores, documentos (RG/CPF/RANI) |
| Modo Livros | FALTA | — | Catálogo, autores, didáticos, busca | Direitos autorais, PDF próprio, autoria |
| Blog | PARCIAL | Leitura dos 77 textos do Etnias 1.0 | Criar blog/artigos, aprovação, curtir/comentar | Categorias |
| Organização Etnias | FALTA | Papéis admin/moderador e registro de ações | Integrantes, departamentos, cargos, 5 níveis de acesso, painel com barra lateral | Quais dados e fotos de integrantes ficam públicos |
| IAra v1 | PARCIAL | Kit conferido (checksums, skills), recepção web com triagem | Motor Hermes, Supabase, Mixpost/Langfuse/Authentik, redes sociais | Contas e custos de servidor; voz clonada só com autorização escrita |

## 4. Fora do código (para a gestão)

- **Conta de suporte** (pedido do Karuan e da Judite): criar `@suporte.etnias` exige decidir quem a usa. O @ `suporte` é reservado pelo sistema. Depois de criada, um aviso fixo para todos pode ser publicado pelo Centro de gestão (Avisos).
- **Pacote `etnias-iara-v1.0.tar.gz`**: não foi aberto nem executado. Instalação só depois de revisão.
