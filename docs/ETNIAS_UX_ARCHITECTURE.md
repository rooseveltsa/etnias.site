# Etnias 2.0 — Arquitetura de UX

Base: navegação atual da prévia (`DESIGN.md` §Layout, `public_html/assets/opy/views/*.php`) e requisitos 4.x, 5.x, 6.x, 11 e 13 da missão.

## 1. Navegação

**Hoje:** barra inferior = Feed, Mercado, Postagem, Saberes, EtnIA. Chat e Maracá ficam no cabeçalho. O menu Opy abre um drawer à esquerda. O usuário já pediu uma vez para restaurar essa organização (`DESIGN.md`, extensão de 4/11), então **mudar a barra inferior exige aprovação explícita**.

**Proposta (mobile):**

| Posição | Destino | Motivo |
|---|---|---|
| 1 | Feed | Área principal |
| 2 | Comunidades | Uso frequente, hoje enterrado no menu |
| 3 | **Criar** (central, azul) | Caminho A do 6.11 |
| 4 | Inbox (com badge) | Prioridade da missão |
| 5 | Perfil | Padrão de redes sociais |

- Maracá (notificações) fica no cabeçalho com badge, à esquerda da logo.
- A **logo Etnias à direita do cabeçalho** abre o menu de ferramentas (4.1), com categorias: Comunidade (Grupos, Páginas, Eventos), Saberes (Saberes, Fotógrafos, Música, Filmes), Economia (Mercado, Empregos, Coletas, Doar), Assistentes (EtnIA, IAra), Conta. Mercado, Saberes e EtnIA saem da barra e vão para o menu.
- Desktop: a barra lateral esquerda mantém o menu completo. A barra inferior flutuante segue com os mesmos 5 destinos.

Risco: tirar Mercado, Saberes e EtnIA da barra reduz a descoberta deles. Medir os cliques antes e depois.

## 2. Feed

```
[Cabeçalho: busca · Maracá · logo(menu)]
[Stories compactos]           ← some ao rolar para baixo (5.1)
[Balão “O que você quer compartilhar?”]  ← caminho B do 6.11
[Barra de modalidades sticky]  ← aparece quando os Stories saem (6.1)
  Para você · Seguindo · Descobrir · Microblog · Arquivos · Áudios · Localidade
[Publicações]
```

- Ocultar os Stories com `IntersectionObserver` numa sentinela, sem medir rolagem a cada frame. A altura fica reservada para não haver salto (CLS).
- Filtros: estado na URL (`?v=seguindo`) para preservar ao voltar e permitir compartilhar. Troca sem recarregar.
- “Descobrir”: autores não seguidos, com intercalação de contas novas (menos de 30 dias) e limite de N posts por autor por página.
- “Microblog”: posts só de texto com até 500 caracteres, com respostas encadeadas (depende de 6.12).
- “Localidade”: texto livre de cidade/região/território. Nenhuma coordenada é gravada. Geolocalização só por ação explícita e convertida no cliente para um nome de município.

## 3. Composer (6.11, seção 10)

Um único componente `<dialog>` aberto pelos dois caminhos (botão central e balão do feed):

1. Tipos: Texto, Foto, Vídeo, Arquivo, Localidade, **Ao vivo** (visível e rotulado).
2. Seleção → pré-visualização → legenda → público → comunidade (opcional) → publicar.
3. Progresso de upload real (bytes enviados). Falha preserva o rascunho.
4. Ao concluir, fecha e rola até o post novo no topo do feed.

O Composer embutido de hoje vira o conteúdo desse diálogo (reaproveitamento, não reescrita).

## 4. Inbox (seção 4 da missão + referência visual)

- **Mobile:** lista → conversa em tela cheia → voltar (já existe: `data-mobile-view`). Ajustes: cabeçalho com avatar, nome e menu “⋯”; botão “+” que abre bottom sheet com Documento, Câmera, Galeria, Áudio, Localização, Enquete. Microfone dentro do campo; enviar em `--brand-600`.
- **Desktop:** 3 zonas (lista, conversa, painel de contexto sob demanda). Já existe.
- **Solicitações (2.2):** aba “Solicitações” na lista. A conversa pendente mostra Aceitar, Recusar e Bloquear. O servidor rejeita novas mensagens até o aceite.
- **Fora de escopo até haver infraestrutura:** botões de chamada de vídeo e voz da referência. Não exibir botão inoperante.
- **“Online friends”:** só se a presença com opt-in for aprovada (2.5).

## 5. Vídeos verticais (6.10)

- Rota `/videos/`, feed vertical com `scroll-snap-type: y mandatory`, um `<video>` por tela.
- `IntersectionObserver` com threshold de 0,75: toca o visível e pausa todos os outros (nunca dois ao mesmo tempo).
- `preload="metadata"` para o próximo e `none` para os demais. Respeitar `navigator.connection.saveData`.
- Ações laterais: perfil/seguir, curtir, comentar (sheet), salvar, compartilhar. Toque pausa ou retoma.
- Dependência: o limite de 2 MB por vídeo inviabiliza Reels reais. É preciso storage com Range requests e, de preferência, HLS.

## 6. Live (seção 11)

- No Composer, “Ao vivo” abre: título → público → permissão de câmera e microfone → preview local → **Iniciar** (desabilitado com explicação enquanto não houver servidor).
- Estado atual honesto: “Estúdio de teste · fora do ar”. Manter assim até a infraestrutura existir.
- Homologação só com um 2º usuário assistindo à transmissão real.

## 7. Comunidades vs. grupos de chat

| | Comunidade | Grupo de chat |
|---|---|---|
| Natureza | Espaço temático com feed, regras e moderação | Conversa entre participantes |
| Entrada | Pública, por solicitação ou por convite | Só por convite aceito |
| Conteúdo | Publicações e comentários | Mensagens |
| Código | `server/communities.mjs` | `server/chat.mjs` (`chatGroups`) |

Os dois módulos já estão separados. Manter assim.

## 8. Qualidade de interação (seção 14)

Checklist por tela: loading, vazio específico, erro com retry, sucesso, disabled, teclado (ordem de Tab e Esc fecha), toque (44 px), contraste AA, `prefers-reduced-motion`, sem overflow em 320 px.
