# Etnias 2.0 — Plano de implementação priorizado

Ordem ajustada às dependências reais encontradas na auditoria. Toda mudança: escopo mínimo, teste, atualização da [matriz](ETNIAS_REQUIREMENTS_MATRIX.md).

## 1. Decisões que bloqueiam o plano (responsável: produto)

| # | Decisão | Bloqueia | Recomendação |
|---|---|---|---|
| P1 | Plataforma de destino | Fases 6–8 | **Decidido (2026-11-07): VPS Hostinger.** A Casa Opy Node roda em Docker na VPS com dados em disco e coturn próprio (`deploy/opy/`). A reconstrução em Laravel 12 continua como projeto separado para o banco legado. |
| P2 | Paleta | Fase 1 | **Decidido (2026-11-07): manter as cores do projeto (vermelho Opy)** e aplicar o estilo de chat da referência. A proposta azul foi descartada. |
| P3 | Aprovar a nova barra inferior (`ETNIAS_UX_ARCHITECTURE.md` §1) | Fase 2 | O usuário já reverteu uma mudança de navegação. Pedir confirmação antes. |
| P4 | Provedores | Fases 6–7 | **Decidido pela engenharia (delegado pelo usuário em 2026-11-07):** ver §1.1. |
| P5 | Presença online e recibos de leitura: opt-in ou desligado | 2.1, 2.5 | Opt-in, desligado por padrão (já é a postura CARE do projeto). |
| P6 | Protocolo de moderação e responsáveis | 2.8, CX-COM-04 | Definido pelas lideranças antes de abrir ao público. |

### 1.1 Provedores escolhidos

| Necessidade | Escolha | Por quê | Custo de partida |
|---|---|---|---|
| Chamadas de voz e vídeo 1:1 | WebRTC no navegador + **coturn próprio na VPS** | Sem custo por minuto, dados não passam por terceiros, funciona em 4G/CGNAT via TURN | Só banda da VPS |
| Chamadas em grupo (próxima etapa) | **LiveKit self-hosted** na VPS | SFU open-source; reaproveita o mesmo TURN | Só CPU e banda da VPS |
| Notificações push (Web Push/PWA) | **VAPID próprio** no servidor | Padrão aberto, sem conta em terceiros | Zero |
| E-mail transacional (OTP, recuperação) | **SMTP do Brevo** | Plano gratuito de 300 e-mails/dia, painel em português, troca de provedor só muda a credencial SMTP. Enviar direto da VPS cai em spam | Zero até 300/dia |
| WhatsApp (OTP e avisos) | **WhatsApp Cloud API da Meta, direto** | Sem mensalidade de intermediário; exige número verificado e templates aprovados | Por conversa (categoria autenticação) |
| Transmissão ao vivo | **MediaMTX self-hosted** (WHIP para entrada, WebRTC/LL-HLS para saída) | Sem licença, roda na mesma VPS; trocar para Cloudflare Stream se a audiência passar de ~100 simultâneos | Só banda da VPS |

Pendências que dependem de você: contas da Meta (WhatsApp) e do Brevo, DNS dos subdomínios do app e do TURN, e a liberação das portas no painel da Hostinger.

## 2. Fases

### Fase 1 — Design system (sem mudar comportamento)
1. Centralizar as cores de `preview.css`/`opy.css` em variáveis `:root` com os valores atuais. Diff visual zero, comparado por screenshot. **Baixo risco.**
2. Aplicar a paleta azul (após P2). Atualizar `DESIGN.md` e `PRODUCT.md`.
3. Bolhas e composer do chat no padrão da referência.

### Fase 2 — Navegação e Composer
1. Composer como `<dialog>` único, aberto pelos dois caminhos (6.11).
2. Logo à direita como gatilho do menu (4.1), com categorias (4.2).
3. Barra inferior nova (após P3).
4. Stories somem ao rolar; barra de modalidades sticky (5.1, 6.1).
5. Filtros renomeados e novos: Seguindo (6.2), Descobrir (6.3), Localidade (6.7), estado na URL.

### Fase 3 — Inbox
1. Solicitação de conversa com regra no servidor (2.2, 2.9).
2. Imagem de grupo (2.3).
3. Recibos de entrega/leitura com opt-in (2.1, P5).
4. Bottom sheet de anexos e microfone no campo.
5. Tempo real: substituir o polling por SSE, depende de P1. Na Vercel, SSE em funções tem limite de duração. A solução definitiva fica no backend escolhido.

### Fase 4 — Comunidades
Capa/imagem, fila de denúncias, nível “restrito” para conhecimento tradicional (CX-COM-05, depende de P6).

### Fase 5 — Feed e Stories
Comentários com curtida e resposta (6.12) → Microblog (6.4); um áudio por vez e duração (6.6); planilhas (6.5); interações e privacidade de Stories (5.3–5.6); Reels (6.10, depende de storage com Range/HLS).

### Fase 6 — Autenticação e notificações
Serviço central de eventos com idempotência e reprocessamento (3.8) → Web Push (3.1) → e-mail (1.2, 3.3) → preferências (1.3, 3.4) → sessões e 2FA (1.4, 1.5) → WhatsApp (1.1, 3.2). Todos dependem de P1 e P4.

### Fase 7 — Live
Só depois de definir o provedor (comparativo em `auditoria-comunitaria-2026-11-07.md` §7). Homologação com 2 usuários.

### Fase 8 — Administração
Painel único: integrações (1.6), cadastro e templates (1.8, 1.9), notificações (3.5), menu (4.2), emojis e figurinhas (6.13), moderação.

### Fase 9 — Homologação final
E2E multi-sessão, testes em dispositivo real, avaliação com usuários indígenas (`PRODUCT.md` §Accessibility).

## 3. Correções de baixo risco: próximas, sem decisão pendente

| Item | Escopo |
|---|---|
| Fase 1.1 | Tokens em `:root` com valores atuais |
| 6.6 | Pausar os outros `<audio>`/`<video>` quando um começa a tocar (um listener `play` em captura) |
| 6.11 | Botão central abre o mesmo Composer |
| 5.1 | Ocultar Stories por sentinela |
| D3 | Remover o `fetch` vazio do `sw.js` ou adicionar o handler `push` na Fase 6 |

## 4. Sobre o pedido de reconstrução em Laravel 12

> Ver também [o que aproveitar do legado](ETNIAS_LEGADO_APROVEITAMENTO.md): a API v2 do WoWonder já cobre boa parte dos módulos 01, 03, 05 e 06 sobre o banco recuperado.

O documento `etnias 2.0.docx` pede auditoria reversa do WoWonder + backend Laravel 12 sobre o MariaDB existente, com API para web e Flutter. É um projeto de semanas e independente desta missão de UX. Ele **define onde os itens das Fases 3 (tempo real), 6, 7 e 8 vão morar**. Por isso P1 precisa ser decidido antes de investir em backend na prévia Node.
