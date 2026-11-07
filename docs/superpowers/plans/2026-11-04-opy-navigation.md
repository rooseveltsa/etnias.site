# Implementação da navegação Opy

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Implementar a primeira etapa da atualização autorizada, com Casa Opy, barras e compositor simplificado nos dois temas.

**Architecture:** Camada compartilhada em `public_html/assets/opy`, ativada para usuários autenticados no modo social compatível. Os temas recebem pontos pequenos de inclusão; rotas, autenticação e permissões permanecem na aplicação existente. Desativação por configuração ou variável de ambiente.

**Tech Stack:** PHP compatível com a base atual, CSS e JavaScript sem dependências novas em produção; PHP 8.3 em Docker e Playwright para verificação.

**Spec:** [Análise Opy](../../analise-opy-etnias-2.md) e documento-base do usuário. Execução autorizada em 04/11/2026.

## Global Constraints

- Preservar contas, conteúdo, mensagens e permissões existentes.
- Sem alteração de banco ou publicação remota nesta etapa.
- Vermelho Etnias, fundos claros, ícones SVG consistentes e rótulos claros.
- Não apresentar Saberes, EtnIA, Guardião ou fotografia comercial como integrações concluídas.
- Manter visitantes e usuários impedidos de usar a rede na experiência existente.

## Review Focus

- Recursos desativados não ganham links de acesso no novo menu.
- URLs externas configuráveis rejeitam protocolos executáveis.
- Fechar menu/dialog deve devolver foco e liberar rolagem.
- Navegação ou atualização não descartam rascunhos silenciosamente, inclusive anexos.
- Telas pequenas e zoom não deixam a barra inferior cobrir o conteúdo.

## Task 1 Navegação compartilhada

**Files:** `public_html/assets/opy/bootstrap.php`, `config.php`, `views/*.php`, `opy.css`; inclusões em `themes/{sunshine,wowonder}/layout/{container,header/content,sidebar/left-sidebar}.phtml`.

**Interfaces:** `Etnias_OpyEnabled()`, `Etnias_OpyItems()`, `Etnias_OpyUrl()`, `Etnias_OpyIcon()`, `Etnias_OpyEscape()`.

- [x] Criar e executar testes PHP de ativação, destinos, permissões e escape; confirmar falha inicial.
- [x] Implementar funções, configuração e views compartilhadas com destinos reais e estados indisponíveis.
- [x] Incluir nos dois temas e executar lint PHP e testes.

## Task 2 Interação e compositor

**Files:** `public_html/assets/opy/opy.js`, views da tarefa 1; correção das URLs de pesquisa nos dois cabeçalhos existentes.

**Interfaces:** atributos `data-opy-*`, painel nativo `dialog`, formulário existente `.publisher-box`, textarea `.postText`, opções `.sun_pub_more`.

- [x] Testar menu, Escape, foco, estado indisponível, busca com acentos e retorno ao compositor.
- [x] Implementar menu Opy e Interatividade, detalhes de integração e atalhos para o compositor existente.
- [x] Agrupar opções secundárias com controle “Mais opções” sem substituir envio, upload ou audiência.
- [x] Corrigir construção e codificação das URLs de pesquisa e preservar rascunhos nas novas ações.

## Task 3 Verificação e documentação

**Files:** `tests/opy/*`, `scripts/opy-preview-router.php`, `DESIGN.md`, `.impeccable/design.json`, `docs/atualizacao-opy.md`.

- [x] Criar prévia local com as views reais e dados explicitamente demonstrativos; não conectar ao banco de produção.
- [x] Verificar desktop, celular, teclado e comportamento em ambos os temas; capturar imagens locais.
- [x] Executar detector visual, revisão independente e corrigir problemas materiais.
- [x] Registrar arquivos alterados, testes executados, ativação/reversão e limites da primeira etapa.

## Decisões de execução

O usuário autorizou iniciar a atualização após receber a recomendação de evolução por etapas. A execução seguirá localmente nesse caminho. Não há Git neste diretório: preservar cópias dos arquivos existentes antes de editar, sem criar commits artificiais.

## Resultado da execução

Primeira etapa implementada localmente. Testes PHP16/16, lint de14 arquivos PHP, testes de prévia e integração aprovados em ambos os temas. A integração usou banco sintético isolado e publicou pelo compositor original. A chave de reversão restaurou o cabeçalho anterior. Revisão funcional independente: quatro problemas corrigidos com testes. Revisão visual: correções do compositor móvel resolvidas. DESIGN.md e sidecar verificados. Sem publicação remota.
