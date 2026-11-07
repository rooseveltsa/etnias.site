# Auditoria de qualidade e usabilidade da Casa Opy

Plano: [plans/etnias-qualidade-usabilidade.md](../plans/etnias-qualidade-usabilidade.md). Ferramenta: `tests/opy/audit-screens.cjs` (29 rotas × 375/768/1440 px, axe-core WCAG, alvos de toque, overflow, erros JS), sempre em servidor local descartável. Screenshots em `audit-reports/` (fora do git).

## Medições automáticas

| Critério | 1ª rodada (2026-11-07) | Depois das correções (r2) |
|---|---|---|
| Overflow horizontal | 0 | 0 |
| Violações axe sérias/críticas | 0 | 0 |
| Erros de JavaScript | 0 | 0 |
| Alvos de toque < 44 px | 26 no feed + 1 em chat, conta, perfil e configurações | 0 (último caso, nome curto no feed, corrigido depois) |
| Telas genéricas no menu | 8 | 8 (aguarda decisão de Produto, Etapa 4) |

## Achados heurísticos (revisão dos screenshots)

| Tela | Severidade | Achado | Causa | Etapa | Estado |
|---|---|---|---|---|---|
| Todas (desktop) | Alta | Barra inferior flutuante cobre o conteúdo no meio da tela | `.opy-bottom` fixa também ≥ 992 px, duplicando o menu lateral | 3 | ✅ escondida no desktop |
| Comunidades | Alta | Filtros quebram em duas linhas dentro de uma caixa; estilo diferente do feed | regras antigas de `.feed-float` | 3 | ✅ fileira única de chips |
| Comunidades | Média | Quatro rótulos para a mesma ação (“Participar do grupo”, “Participar”, “Solicitar entrada”, “Pedir entrada”) | textos espalhados no JS | 3 | ✅ unificados com a coluna lateral |
| Comunidades | Baixa | “0 participante(s) · 0 publicação(ões)” | plural com parênteses | 3 | ✅ plural correto |
| Feed | Média | Avatares (42 px), atualizar (36 px) e nomes curtos abaixo de 44 px | tamanhos fixos | 3 | ✅ |
| Perfil | Baixa | Botão da câmera com 40 px | tamanho fixo | 3 | ✅ |
| Mercado, Eventos, Filmes, Empregos, Coletas, Álbuns, Recordações, Minhas páginas | Alta | Mesmo bloco genérico “em breve” | rotas sem conteúdo na prévia | 4 | ⏳ decisão do Produto: esconder do menu ou página-ponte |
| Menu lateral | Média | Item “Grupos” enquanto a tela e a coluna dizem “Comunidades” | menu vem de `public_html/assets/opy/views/sidebar.php`, compartilhado com o legado | 6 | ⏳ resolver só na prévia |
| Maracá | Baixa | Estado vazio sem ação | texto genérico | 7 | ⏳ |
| CSS (todas) | Alta (causa raiz) | Duas folhas concorrentes; 95 regras `body.opy-preview` do `opy.css` vencem as da prévia | especificidade | 2 | ⏳ |

## Próximos passos
Etapa 2 (tokens e isolamento do `opy.css`), Etapa 4 (após decisão), telas restantes e regressão visual, conforme o plano.
