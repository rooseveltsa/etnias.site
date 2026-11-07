---
name: iara-atendimento
description: Triagem de mensagem que chega (comentário, DM, e-mail, WhatsApp ou formulário do site) em classificacao (duvida|reclamacao|sugestao|tecnico|elogio|sensivel), tema (cursos|eventos|projetos|doacao|parceria|outro), urgencia e resposta de FAQ, gravando em ~/.hermes/iara-data/atendimentos.json. Mensagem sensível SEMPRE escala para humano. Usar quando o dono pedir "responde esse comentário", "triagem das mensagens", "o que chegou hoje" ou antes de escrever qualquer resposta pública.
---

# IAra — Atendimento (triagem e FAQ)

Objetivo: separar o que a IAra pode responder sozinha do que precisa de gente.
Triagem primeiro, resposta depois — e `sensivel` nunca é automático.

## 1. Contrato

```bash
triar.py --mensagem "Como me inscrevo no curso X?" --canal instagram
triar.py --mensagem-file /tmp/msg.txt --canal email
triar.py --listar
triar.py --limpar            # dry-run
triar.py --limpar --confirmar
```

`--canal`: `instagram | linkedin | email | whatsapp | site`.
Saída: `~/.hermes/iara-data/atendimentos.json` (lista, 0600).

Triagem gravada:

```json
{"id":"atd-<hash12>","mensagem_id":"<hash12>","canal":"instagram",
 "classificacao":"duvida","tema":"cursos","urgencia":"baixa",
 "resposta_sugerida":"<texto do FAQ>","faq_id":"faq-curso-001",
 "precisa_humano":false,"motivo_escalada":"","evidencias":["como","inscrev"],
 "tamanho_mensagem":31,"status":"triada","criado_em":"..."}
```

**A mensagem bruta não é gravada.** Só `mensagem_id` (hash sha1 de 12) e o
tamanho — o texto fica com quem recebeu, não no JSON.

## 2. Matriz de decisão

| classificação | precisa_humano | motivo_escalada | resposta_sugerida |
|---|---|---|---|
| `sensivel` | **sempre true** | `tema sensivel` | vazia (proibido responder automático) |
| `reclamacao` | true | `reclamacao` | vazia |
| `tecnico` | true | `suporte_tecnico` | vazia |
| `duvida` com FAQ | false | — | texto do FAQ |
| `duvida` sem FAQ | true | `sem_faq` | vazia |
| `sugestao` | false | — | vazia (vira insumo de conteúdo) |
| `elogio` | false | — | vazia |

Urgência: `sensivel` → `alta` sempre; `reclamacao` → `alta` com
urgente/processo/denúncia/prazo/advogado/procon/judicial, senão `media`;
`tecnico` → `media` se "não consigo/erro/fora do ar", senão `baixa`; o resto `baixa`.

## 3. Ordem de classificação (importa)

`sensivel` → `reclamacao` → `tecnico` → `sugestao` → `elogio` → `duvida`.

Sensível vem primeiro porque "denunciar ameaça" também casa com dúvida ("quero
denunciar" tem "quero"). Se a ordem mudasse, a mensagem mais grave cairia no
balde de FAQ.

## 4. FAQ (`~/.hermes/iara-data/faq.json`)

Três entradas de exemplo: curso, evento, doação. Formato:

```json
{"id":"faq-curso-001","tema":"cursos","pergunta":"...","resposta":"..."}
```

Casamento por sobreposição de tokens (radicais de 5 letras: `inscrevo` ~
`inscrever`), corte em 0,34 dos tokens da mensagem. Abaixo disso, não casa —
e aí a dúvida escala com `sem_faq`, em vez de receber resposta errada.

**FAQ real do Etnias** (preços, prazos, editais) será preenchido pelo dono/júnior.
Não inventar resposta: sem FAQ, escala.

## 5. Regras de ouro

1. `sensivel` nunca recebe resposta automática — nem rascunho otimista.
2. `precisa_humano: false` só vale para `duvida` com FAQ, `sugestao` e `elogio`.
3. Não gravar texto de mensagem (privacidade): só hash + tamanho.
4. Merge por id (hash da mensagem): reprocessar a mesma mensagem não duplica.
5. Sem rede: o script não importa urllib/requests/httpx e não abre `.env` nem
   `~/.hermes/credentials/`.

## 6. Pitfalls medidos (PEF 12-v3, 05/11/2026)

1. **Ordem das regras é a decisão de segurança.** Sensível antes de tudo.
2. **`tema: outro` é resposta válida** — "denúncia de ameaça" não é curso, evento
   nem doação; forçar tema seria inventar.
3. **Token de 3 letras polui o FAQ** ("ter", "tem"); stopwords resolvem.
4. **Radical de 5 letras** é o mínimo que separa `inscrevo/inscrever` sem colar
   `evento/eventual`.
5. **Teste com `--out` apontando para o arquivo real** e limpeza por
   `--limpar` (dry-run) + `--confirmar`, conferindo contagem 0 no fim.

## 7. O que esta skill NÃO faz

- Não responde no canal (não publica, não manda DM).
- Não lê comentário/DM por API: a mensagem entra por `--mensagem` (manual).
- Não decide política de marca: caso sensível vai para o humano com o motivo.
- Não toca em Supabase nem em credencial.
