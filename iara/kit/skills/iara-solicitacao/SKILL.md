---
name: iara-solicitacao
description: Central de solicitações internas — recebe pedido (arte, vídeo, comunicado, campanha, evento, projeto), calcula SLA por tipo e prioridade, organiza a fila por setor/status e, no aceite, cria a pauta correspondente no calendário via adapter (estado rascunho). Usar quando o dono pedir "abre uma solicitação", "quem pediu o quê", "fila do design", "prazo do vídeo" ou quando um setor precisar pedir peça para outro.
---

# IAra — Central de solicitações (intake + SLA + fila)

Objetivo: todo pedido interno entra com dono, prazo e SLA — e o aceite gera pauta
no calendário por um caminho único (adapter), nunca por escrita manual.

## 1. Contrato

```bash
solicitar.py criar --solicitante "Ana" --setor design --tipo arte \
  --descricao "Card do evento X" --prazo 2026-11-08 --prioridade media
solicitar.py listar [--filtro-setor design] [--filtro-status aberta]
solicitar.py aceitar --id <uuid>
solicitar.py concluir --id <uuid>
solicitar.py cancelar --id <uuid> --motivo "pedido duplicado"
solicitar.py limpar [--confirmar]      # limpeza de teste, com dry-run
```

Enums: `setor` = marketing | design | social | audiovisual | documentos | outro;
`tipo` = arte | video | comunicado | campanha | evento | projeto;
`prioridade` = baixa | media | alta.

Solicitação gravada em `~/.hermes/iara-data/solicitacoes.json` (0600):

```json
{"id":"<uuid>","solicitante":"Ana","setor_origem":"design","tipo":"arte",
 "descricao":"...","prazo":"2026-11-08","prazo_solicitado":"2026-11-08",
 "prioridade":"media","sla_horas":48,"status":"aberta","sla_risco":false,
 "motivo_sla_risco":"","criado_em":"...","aceito_em":null,
 "concluido_em":null,"calendario_id":null,"motivo":""}
```

## 2. SLA

| tipo | base | alta (×0,75) | baixa (×1,5) |
|---|---|---|---|
| comunicado | 24 h | 18 h | 36 h |
| arte | 48 h | 36 h | 72 h |
| evento | 48 h | 36 h | 72 h |
| vídeo | 72 h | 54 h | 108 h |
| campanha | 120 h | 90 h | 180 h |
| projeto | 120 h | 90 h | 180 h |

**Risco de SLA:** com `--prazo`, o script mede as horas até o fim do dia do prazo.
Se `horas_ate_prazo < sla_horas` → `sla_risco: true` e
`motivo_sla_risco: "prazo menor que SLA"`. Sem `--prazo`, o prazo é derivado do
SLA (`criado_em + sla_horas`) e não há risco a medir.

## 3. Fluxo de status

```
aberta --aceitar--> aceita --concluir--> concluida
   \--cancelar--> cancelada        (motivo obrigatório)
aceita --cancelar--> cancelada
concluida/cancelada = terminal (não reabre; abrir nova solicitação)
```

**Aceitar** exige `status == aberta` (senão exit 3) e faz três coisas numa ordem:
1. valida tudo (solicitação existe e está aberta);
2. `iara_adapter.registrar_calendario(solicitacao_id, titulo, canal="interno", data_prevista=prazo)`;
3. só então grava `status: aceita`, `aceito_em` e `calendario_id`.

Se o adapter recusar (prazo inválido, pauta duplicada), a solicitação **continua
aberta** e o script sai com exit 4 — nada de calendário órfão.

Concluir exige ter sido aceita antes (`aberta` → exit 3).

## 4. Regras de ouro

1. Nunca escrever `calendario.json` à mão: só `iara_adapter.registrar_calendario`
   / `avancar_estado` (a máquina de estados é do adapter).
2. Solicitação sem `solicitante`, `setor`, `tipo` ou `descricao` não entra (exit 2).
3. `titulo` do calendário é a descrição truncada em 140 caracteres (limite do adapter).
4. `canal` da pauta interna é sempre `interno` (evita publicar sem querer).
5. Sem rede; sem `.env`; sem credencial; nada de Supabase nesta fase.
6. Merge por id: criar/listar nunca apaga; apagar é só `limpar --confirmar`.

## 5. Pitfalls medidos (PEF 17-v3, 05/11/2026)

1. **`data_prevista` é obrigatória no adapter** e só aceita `AAAA-MM-DD`; por isso
   o script sempre calcula um prazo (pedido ou derivado do SLA) antes de aceitar.
2. **UUID tem hífen e o adapter aceita** (`^[A-Za-z0-9._-]+$`) — mas um id com `/`
   ou espaço quebraria a validação; não inventar formato de id.
3. **Aceitar duas vezes** faz o adapter acusar "pauta já existe"; o script já barra
   antes pelo status (`aberta` exigido), então o erro não chega no calendário.
4. **Restaurar calendário** é `apagar_calendario(id)` do próprio adapter; conferir
   md5 antes/depois para provar que voltou byte a byte.
5. **Prazo medido no fim do dia**: "prazo amanhã" às 20h dá ~28 h, não 24 h — o
   alerta de risco usa essa conta, e é ela que aparece em `horas_ate_prazo`.

## 6. O que esta skill NÃO faz

- Não produz a peça (arte/vídeo são de `conteudo-estatico` / `audiovisual`).
- Não publica, não aprova: aprovação é `iara-aprovacao`.
- Não notifica setor (e-mail/WhatsApp é do júnior).
- Não tem painel: a fila é o JSON + `listar`.
