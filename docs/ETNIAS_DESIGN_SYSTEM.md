# Etnias 2.0 — Design system

> **Atualização 2026-11-07:** a proposta azul abaixo foi **descartada** pelo usuário. Vale a paleta Opy de `DESIGN.md` (vermelho `#bd171c`, tinta `#182c34`, fundo `#f5f5f1`). Os padrões de componente, estados, espaçamento e acessibilidade deste documento continuam válidos. O chat (`preview/chat.php`, `preview/preview.css`) já segue esse padrão com as cores Opy.

Estado: **proposta documentada, ainda não implementada.** Substitui a paleta vermelha de `DESIGN.md` só depois que `DESIGN.md` e `PRODUCT.md` forem atualizados no mesmo PR (hoje os dois mandam usar “vermelho como destaque”).

## 1. Origem dos valores

- A logo oficial (`preview/dist/public/assets/opy/etnias-logo.png`) é monocromática marrom-escura. Não há azul oficial nos ativos. Os azuis abaixo são **propostos**, conforme a missão (“caso ainda não existam tokens oficiais, propor uma paleta azul e documentá-la”).
- A referência visual enviada (Inbox mobile) usa azul saturado nas bolhas e no envio. A proposta segue essa linha com um tom levemente mais profundo, para ler como premium e passar AA com folga.
- A logo continua no tom original. Não recolorir a logo.

## 2. Tokens de cor

Contraste calculado pela fórmula WCAG 2.x (script em `ETNIAS_QA_REPORT.md` §3).

| Token | Valor | Uso | Contraste |
|---|---|---|---|
| `--brand-900` | `#0B1F4D` | Identidade profunda: cabeçalhos de destaque, item ativo da navegação lateral | 15,94:1 sobre branco |
| `--brand-700` | `#1B39B0` | Hover/pressed da ação primária | 9,30:1 sobre branco |
| `--brand-600` | `#2347D6` | **Ação primária**, bolha própria do chat, foco, seleção, botão Criar | 7,13:1 sobre branco; branco sobre ele 7,13:1 |
| `--brand-100` | `#EAF0FE` | Fundo de seleção (aba/filtro ativo, destino atual da barra inferior) | `--brand-700` sobre ele: 8,14:1 |
| `--ink` | `#0F1B2D` | Texto principal | 16,11:1 sobre `--ground` |
| `--muted` | `#55627A` | Texto secundário, horários | 6,15:1 sobre branco; 5,73:1 sobre `--ground` |
| `--paper` | `#FFFFFF` | Superfícies de conteúdo, bolha recebida | — |
| `--ground` | `#F5F7FA` | Fundo da aplicação, fundo da conversa | — |
| `--line` | `#E3E7EE` | Divisórias | Decorativo |
| `--danger` | `#C42A2F` | Erro, ação destrutiva, **badge do Maracá** | 5,65:1 sobre branco |
| `--success` | `#1E7A4C` | Confirmação, online (se a presença for aprovada) | 5,33:1 sobre branco |
| `--focus-ring` | `0 0 0 3px #2347D6` com offset de 2px | Foco visível universal | — |

Regras:
- Azul é só para ação, seleção, foco e identidade. Nunca para texto corrido.
- Vermelho passa a ser **semântico** (erro/badge) e deixa de ser cor de marca.
- Sem gradientes decorativos. Uma única sombra de elevação por nível.

## 3. Tipografia

Mantém **Krub** (já auto-hospedada em `preview/fonts`, compatível com a CSP `font-src 'self'`). Não trocar a fonte nesta fase: é um custo de identidade sem ganho funcional.

| Papel | Tamanho / altura de linha / peso |
|---|---|
| Display (título de tela) | 24/30, 650 |
| Título de seção | 18/24, 650 |
| Corpo | 15/24, 400 (16 em campos, para evitar zoom no iOS) |
| Corpo pequeno | 14/20, 400 |
| Rótulo | 13/16, 600 |
| Legenda (horários, contadores) | 12/16, 400 |

## 4. Espaçamento, raio e elevação

- Escala de espaçamento: 4, 8, 12, 16, 24, 32, 48.
- Raio: 8 (controles), 12 (cards e bolhas), 16 (sheets e diálogos), 999 (avatar, chips). Nada acima de 16 em contêineres.
- Elevação: `e0` borda `--line`; `e1` `0 1px 2px rgb(15 27 45 / .06)`; `e2` (sheet/diálogo) `0 12px 40px rgb(15 27 45 / .18)`.

## 5. Componentes e estados

Todo componente define: normal, hover (só ponteiro fino), focus-visible, active, loading, disabled, error, success.

| Componente | Notas |
|---|---|
| Botão primário/secundário/fantasma/destrutivo | Altura mínima 44; loading mantém a largura e mostra spinner + `aria-busy` |
| Campo de texto / busca | Borda `--line`, foco `--focus-ring`, erro em `--danger` com mensagem ligada por `aria-describedby` |
| Abas e chips de filtro | `aria-pressed`/`aria-selected`; ativo em `--brand-100` + `--brand-700`; rolagem horizontal com `scroll-snap` em telas pequenas |
| Card de publicação | Sem card dentro de card; ações em linha única com contadores |
| Bolha de chat | Própria: `--brand-600` + branco; recebida: `--paper` sobre `--ground`; horário e status abaixo, em `--muted` |
| Bottom sheet | `<dialog>` nativo, alça visível, fecha com Esc, arrastar ou toque fora; foco volta ao gatilho |
| Toast | `role="status"`; erros usam `role="alert"` |
| Skeleton | Só onde a espera é maior que 300 ms; respeita `prefers-reduced-motion` |
| Estado vazio | Frase específica do contexto + uma ação. Nada de ilustração genérica |
| Estado de falha | Mensagem do servidor + “Tentar novamente” que preserva o rascunho |
| Barra inferior | 5 destinos, Criar no centro em `--brand-600`, safe-area, rótulos visíveis |

## 6. Grafismos e cultura

Nenhum grafismo indígena entra no design system. Uso de grafismos só com autoria, povo de origem e permissão documentados, por conteúdo e não como ornamento de interface.

## 7. Migração (Fase 1)

1. Centralizar em `:root` as cores hexadecimais de `preview/preview.css` e `assets/opy/opy.css`, **sem mudar valores** (diff visual nulo, verificável por screenshot).
2. Trocar os valores dos tokens e atualizar `DESIGN.md`/`PRODUCT.md` no mesmo commit.
3. Validar contraste e screenshots em 320, 390, 768 e 1440 px.
