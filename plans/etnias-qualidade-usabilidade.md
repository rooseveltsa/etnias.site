# Blueprint: auditoria e correção de qualidade e usabilidade da Casa Opy

- **Objetivo:** tirar a rede do aspecto genérico e desalinhado, com uma auditoria completa de todas as telas, um sistema visual único e responsáveis definidos para cada frente.
- **Projeto:** `/Users/juniormiranda/Downloads/etnias.site` (prévia Node em `preview/`, publicada na VPS e na Vercel).
- **Criado em:** 2026-11-07 · **Branch base:** `cursor/banco-etnias-recuperado` · **Remoto:** `github.com/rooseveltsa/etnias.site` (gh autenticado).
- **Modo:** branch + PR por etapa, com merge na branch base, export, deploy na Vercel (prévia) e depois na VPS (produção).

## Diagnóstico de partida (medido em 2026-11-07)

| Sintoma relatado | Causa encontrada | Evidência |
|---|---|---|
| “Desalinhado” | Duas folhas de estilo concorrentes: `preview/preview.css` (691 linhas) e `public_html/assets/opy/opy.css` (404 linhas). Regras `body.opy-preview …` do opy.css vencem as da prévia por especificidade. | Corrigido caso a caso no chat, no compositor, no perfil e na coluna lateral |
| “Genérico” | 10 rotas mostram o mesmo bloco “em breve”: Mercado, Eventos, Filmes, Empregos, Coletas, Blogs, Páginas, Álbuns, Recordações, Minhas páginas | `preview/page.php` (`$catalogues` e fallback) |
| Inconsistência visual | 32 cores hexadecimais soltas em `preview.css`; 18 `!important` (9 em cada arquivo); sem tokens | `grep` em 2026-11-07 |
| Componentes desiguais | Botões, chips, cards e avatares com estilos diferentes por tela (`preview-secondary`, `opy-primary`, `chat-icon-btn`, `rail-community-join`, `pf-link`…) | Leitura do CSS |

## Responsáveis (agentes e pessoas)

Os agentes rodam no Claude Code. **Pré-requisito:** nesta máquina, um roteador de modelos mandou subagentes para `grok-cli` (sem créditos) e eles falharam. A etapa 0 corrige isso.

| Frente | Agente responsável | Modelo | Papel humano que aprova |
|---|---|---|---|
| Auditoria heurística e visual | `design:design-critique` (skill) + `ecc:gan-evaluator` (Playwright com pontuação) | mais forte | Produto (Roosevelt) |
| Acessibilidade (WCAG 2.2 AA) | `ecc:a11y-architect` + skill `design:accessibility-review` | mais forte | Produto |
| Tokens e sistema visual | skill `design:design-system` + `ecc:code-architect` | mais forte | Produto + design |
| Limpeza de CSS (duplicação, especificidade) | `ecc:refactor-cleaner` + `ecc:code-simplifier` | padrão | Engenharia |
| Textos e microcopy | skill `design:ux-copy` | padrão | Produto + conselho cultural |
| Fluxos e cliques sem saída | skill `ecc:click-path-audit` + `ecc:browser-qa` | padrão | Produto |
| Regressão visual automática | `ecc:e2e-runner` | padrão | Engenharia |
| Revisão de código de cada PR | `ecc:typescript-reviewer` (JS) + `ecc:code-reviewer` | padrão | Engenharia |
| Adequação cultural (grafismos, linguagem, povos) | **humano**: lideranças e conselho cultural | — | Conselho |
| Teste com usuários reais | **humano**: 5 pessoas de comunidades diferentes, 2 em 4G | — | Produto |

## Grafo de dependências

```
0 (agentes) ─► 1 (auditoria) ─┬─► 2 (tokens + limpeza CSS) ─► 3 (componentes) ─┬─► 5 (feed e posts)
                              │                                                 ├─► 6 (comunidades)
                              │                                                 ├─► 7 (chat, perfil, Maracá, busca)
                              └─► 4 (telas genéricas: decidir e tratar) ────────┘
                                   8 (regressão visual) depende de 3; roda em paralelo com 5–7
5, 6, 7 ─► 9 (acessibilidade final) ─► 10 (teste com usuários) ─► 11 (correções do teste)
```

Paralelo: **4** com **2–3**; **5, 6 e 7** entre si (arquivos de tela diferentes; CSS em blocos separados por tela); **8** com **5–7**.

---

## Etapa 0: deixar os agentes funcionando no Claude
- **Contexto:** subagentes desta sessão falharam com “grok-cli credits exhausted”, porque o `ANTHROPIC_MODEL=claude-pro` e um roteador local desviam o tráfego.
- **Tarefas:** localizar a configuração do roteador (claude-code-router ou equivalente) e garantir que subagentes usem modelos Claude (`CLAUDE_CODE_SUBAGENT_MODEL` ou o mapa do roteador); disparar um subagente de teste (`Explore`, pergunta simples).
- **Verificação:** o subagente responde sem erro 402/429.
- **Saída:** registro em `docs/ETNIAS_QA_REPORT.md` de qual configuração foi usada.
- **Responsável:** pessoa (Roosevelt), com orientação do agente principal. **Rollback:** restaurar a configuração anterior.

## Etapa 1: auditoria completa de qualidade e usabilidade (somente leitura)
- **Contexto:** 30 rotas exportadas por `scripts/export-opy-preview.php`; servidor local `PORT=… node scripts/dev-opy.mjs`; Chrome em `/Applications/Google Chrome.app` (`CHROME_PATH`). Contas de teste criadas pela API `POST /api/community {action:'register'}`.
- **Tarefas:**
  1. Script `tests/opy/audit-screens.cjs`: abre cada rota logada em 375, 768 e 1440 px; salva screenshot; mede overflow horizontal, elementos sobrepostos (`elementFromPoint` em botões) e alvos de toque menores que 44 px; roda axe-core (via CDN não é possível pela CSP: injetar o pacote local `axe-core` pelo Playwright `addScriptTag({path})`).
  2. Avaliação heurística (Nielsen + consistência + adequação cultural) tela a tela, com nota de 0 a 3 por critério.
  3. Inventário de CSS: cores, tamanhos de fonte, raios, sombras e regras sobrepostas entre `opy.css` e `preview.css`.
- **Verificação:** relatório com screenshots, tabela de achados (tela × severidade × causa × etapa que resolve).
- **Saída:** `docs/ETNIAS_UX_AUDIT.md` + pasta de screenshots fora do git (`audit-reports/`).
- **Responsáveis:** `ecc:gan-evaluator` (screenshots e pontuação), `design:design-critique` (heurística), `ecc:a11y-architect` (axe). **Rollback:** não altera código.

## Etapa 2: tokens e limpeza de CSS (base de tudo)
- **Contexto:** depende da Etapa 1 (inventário). Paleta Opy em `DESIGN.md` (vermelho `#bd171c`, tinta `#182c34`, fundo `#f5f5f1`, linha `#dde2df`, foco `#176b87`). O `opy.css` é compartilhado com o legado PHP: **não alterar** regras usadas pelo `public_html`.
- **Tarefas:**
  1. Criar `preview/tokens.css` com variáveis (cores, espaçamento 4/8/12/16/24/32, raios 8/12/16/999, sombras, tipografia) e carregá-lo antes do `preview.css`.
  2. Substituir as cores soltas do `preview.css` pelos tokens, **sem mudar valores** (diff visual zero).
  3. Isolar a prévia do `opy.css`: as regras `body.opy-preview …` que conflitam passam a ter equivalente na prévia com o escopo certo, e os `!important` da prévia são removidos onde a especificidade resolver.
- **Verificação:** screenshots da Etapa 1 refeitos e comparados pixel a pixel (diferença ≤ 0,1 %); E2E `chat-browser.cjs` e `calls-browser.cjs` passando; `grep -c '#[0-9a-f]\{6\}' preview/preview.css` tendendo a 0.
- **Responsáveis:** `ecc:code-architect` (desenho dos tokens), `ecc:refactor-cleaner` (substituição), `ecc:code-reviewer`. **Rollback:** reverter o PR (tokens são aditivos).

## Etapa 3: biblioteca de componentes
- **Contexto:** depende da Etapa 2. Hoje existem cerca de 8 estilos de botão.
- **Tarefas:** definir em `preview/components.css` os componentes únicos, com todos os estados (normal, hover, foco, ativo, carregando, desabilitado, erro): botão (primário, secundário, fantasma, perigo, ícone), chip/filtro, card, avatar (tamanhos 28/36/40/48/72/168), cabeçalho de seção, estado vazio, linha de lista, campo e diálogo/painel. Migrar as classes atuais para elas.
- **Verificação:** página interna `/sobre-a-previa/#componentes` (ou rota de teste) mostrando todos os componentes; screenshots; E2E passando.
- **Responsáveis:** skill `design:design-system`, `ecc:code-simplifier`. **Rollback:** reverter o PR.

## Etapa 4: telas genéricas (decisão + tratamento) · paralela às etapas 2 e 3
- **Contexto:** 10 rotas mostram “em breve”. O legado WoWonder (mesma VPS) tem Mercado, Eventos, Blogs, Páginas, Filmes, Empregos e Coletas funcionando sobre o banco recuperado (`docs/ETNIAS_LEGADO_APROVEITAMENTO.md`).
- **Tarefas:** para cada rota, decidir com o Produto entre (a) **esconder do menu** até existir, (b) **página-ponte** honesta com um uso real (ex.: Eventos → criar evento numa comunidade), ou (c) **integrar o legado** via API v2. Aplicar a decisão; nenhum item de menu leva a uma tela vazia.
- **Verificação:** auditoria de cliques (`ecc:click-path-audit`) sem becos sem saída.
- **Responsáveis:** Produto decide; `design:ux-copy` para os textos; engenharia aplica. **Rollback:** reverter o PR.

## Etapas 5, 6 e 7: telas principais · paralelas entre si
Cada uma aplica os componentes da Etapa 3 e corrige os achados da Etapa 1 da sua área.
- **5. Feed e publicações:** cards de post, ações (Curtir, Comentar, Amei, Repostar, Salvar), resumo de reações, enquete, anexos, “2 comentários”.
- **6. Comunidades:** lista, página da comunidade (capa, regras, membros, feed), criação, convites e moderação.
- **7. Chat, perfil, Maracá (notificações) e busca.**
- **Verificação por etapa:** screenshots antes e depois em 3 larguras, E2E, axe sem violações sérias na tela.
- **Responsáveis:** `ecc:gan-evaluator` (pontuação de 0 a 10 por tela, meta ≥ 8), `ecc:typescript-reviewer`. **Rollback:** reverter o PR da tela.

## Etapa 8: regressão visual automática · paralela a 5–7
- **Tarefas:** transformar `audit-screens.cjs` em teste de regressão (`tests/opy/visual.cjs`) com screenshots de referência e tolerância; rodar antes de cada deploy.
- **Responsável:** `ecc:e2e-runner`. **Rollback:** remover o teste.

## Etapa 9: acessibilidade final
- **Tarefas:** WCAG 2.2 AA em todas as telas: contraste, foco visível, ordem de tabulação, rótulos, leitor de tela (VoiceOver no iPhone), `prefers-reduced-motion`, alvos de 44 px.
- **Responsáveis:** `ecc:a11y-architect`, skill `design:accessibility-review`.

## Etapa 10: teste com usuários reais (humano)
- **Tarefas:** 5 pessoas de povos e regiões diferentes (2 em 4G, 1 com pouca familiaridade digital). Tarefas: criar conta, publicar foto, entrar numa comunidade, mandar mensagem, fazer uma chamada, editar o perfil. Medir conclusão, tempo e dúvidas. Protocolo de consentimento simples.
- **Responsáveis:** Produto + conselho cultural; o agente principal prepara o roteiro e consolida os resultados.

## Etapa 11: correções do teste com usuários
- Lista priorizada vinda da Etapa 10, executada no mesmo fluxo de PR.

## Invariantes (verificar após toda etapa)
1. `node --test tests/opy/*.mjs` sem falhas (exceto `community-integration.mjs`, que roda com `OPY_TEST_PORT`).
2. `chat-browser.cjs` e `calls-browser.cjs` passando em base limpa.
3. Sem overflow horizontal em 320, 375, 768 e 1440 px.
4. Nenhuma regra do `opy.css` alterada sem checar o legado PHP (`tests/opy/navigation.php` via Docker).
5. Deploy primeiro na Vercel (prévia), validação, depois na VPS.

## Critério de pronto do plano
Todas as telas com nota ≥ 8 na avaliação da Etapa 1 refeita, zero violação axe séria, nenhuma rota vazia no menu e o teste com usuários com taxa de conclusão ≥ 80 %.

## Revisão crítica incorporada (2026-11-07, subagente Opus)
- **Etapa 0 resolvida na prática:** o subagente de revisão rodou no Claude sem erro.
- **Série, não paralelo:** `preview/preview.css` está minificado em linhas gigantes; as etapas 5, 6 e 7 rodam em série até ele ser formatado (nova etapa **2a: formatar o preview.css, uma regra por linha, em seções por tela**).
- **Tokens no `:root` do próprio `preview.css`** (arquivo novo não entra no export nem nos dois `<head>`).
- **Isolamento correto:** as 95 regras `body.opy-preview …` do `opy.css` são exclusivas da prévia; mover para o `preview.css` (após confirmar com `grep` que o `opy.js` só usa a classe para detectar a prévia). Nada muda para o legado.
- **Axe:** contexto Playwright com `bypassCSP: true` só na auditoria; `axe-core` como devDependency de `tests/opy`.
- **Ordem:** a regressão visual (antiga Etapa 8) vem logo após a auditoria, com dados fixos.
- **Escopo ampliado:** navegação (cabeçalho, menu Opy, barra inferior, chat-dock, Interatividade), entrada/cadastro, Stories, EtnIA, IAra e módulos.
- **Critérios numéricos:** 0 violação axe `serious`/`critical`, 0 overflow, 0 alvo < 44 px, 0 `!important` na prévia exceto `[hidden]`; nota dos agentes é informativa.
- **Ambiente:** auditoria e E2E só em servidor local descartável (`scripts/dev-opy.mjs`), nunca na VPS.
- **`?v=` atualizado em todo PR de CSS**; ao tocar em `public_html/assets/opy/**`, rodar os testes PHP do legado.
