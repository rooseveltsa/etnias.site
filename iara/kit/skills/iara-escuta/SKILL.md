---
name: iara-escuta
description: Escuta comunitária — ler um lote de mensagens (.txt/.md em ~/.hermes/iara-data/escuta/), anonimizar telefone/email/CPF, classificar tema e sentimento e gravar agregado em ~/.hermes/iara-data/escuta.json com total, distribuição por tema e sentimento, top 5 palavras e até 3 recomendações de ação. Usar quando o dono pedir "o que a comunidade está falando", "escuta", "termômetro do mês", "sentimento das mensagens" ou antes de fechar o calendário editorial.
---

# IAra — Escuta comunitária (lote -> agregado)

Objetivo: transformar um lote de mensagens em leitura de conjunto — sem guardar
dado pessoal e sem inventar causa.

## 1. Contrato

```bash
ouvir.py --lote ~/.hermes/iara-data/escuta/lote-teste.txt
ouvir.py --lote-dir ~/.hermes/iara-data/escuta/ --janela 2026-11
ouvir.py --listar
ouvir.py --limpar            # dry-run
ouvir.py --limpar --confirmar
```

Lote: `.txt`/`.md` em `~/.hermes/iara-data/escuta/`. Uma mensagem por **linha**,
ou um bloco por mensagem quando o arquivo separa com linha em branco (bloco tem
prioridade: comentário de várias linhas não vira várias mensagens).

Lote gravado em `~/.hermes/iara-data/escuta.json` (0600):

```json
{"id":"esc-<hash10>","janela":"2026-11","origem":"lote-teste.txt",
 "total_mensagens":6,"por_tema":{"cursos":2,"eventos":2,"projetos":1,"doacao":1},
 "por_sentimento":{"positivo":2,"neutro":2,"negativo":2},
 "top_palavras":[{"palavra":"curso","ocorrencias":2},"..."],
 "recomendacoes":["revisar atendimento: 33% ...","ampliar conteudo sobre cursos: ..."],
 "anonimizacoes":2,"criado_em":"..."}
```

**As mensagens em si não são gravadas.** O JSON guarda só o agregado e quantas
substituições de dado pessoal foram feitas.

## 2. Anonimização (antes de qualquer conta)

| dado | regex | vira |
|---|---|---|
| CPF | `\d{3}\.\d{3}\.\d{3}-\d{2}` | `[ANONIMIZADO]` |
| e-mail | `\S+@\S+\.\S+` | `[ANONIMIZADO]` |
| telefone com máscara | `(11) 98765-4321`, `+55 11 98765-4321` | `[ANONIMIZADO]` |
| telefone cru | `\d{10,11}` | `[ANONIMIZADO]` |

A ordem importa: CPF e e-mail primeiro (têm formato próprio), telefone depois —
senão o regex de 10–11 dígitos pode comer pedaço do CPF e sobrar sujeira.
`anonimizacoes` no lote é a contagem de substituições: se der 0 num lote com
telefone, a regex falhou.

## 3. Classificação

- **tema**: `cursos | eventos | projetos | doacao | parceria | outro` por palavra-chave.
- **sentimento**: conta palavras positivas e negativas (sem acento, para pegar
  "ótimo/otimo"); `neg > pos` → negativo, `pos > neg` → positivo, empate ou zero → neutro.
- **top_palavras**: tokens ≥4 letras, stopwords pt-BR mínimas fora, o próprio
  `[ANONIMIZADO]` fora. Top 5 por frequência.

## 4. Recomendações (até 3, nesta ordem)

1. negativo > 30% → `revisar atendimento: X% das mensagens (n/total) tem sentimento negativo`
2. negativo > 40% → `investigar causa do sentimento negativo com o dono antes de publicar qualquer resposta`
3. tema dominante ≠ `outro` → `ampliar conteudo sobre <tema>: é o tema dominante do lote`
4. se o tema dominante tem mensagem negativa → `responder reclamacoes sobre <tema> antes de novo conteudo do tema`

Corta em 3. Recomendação é ação de leitura de conjunto — não é afirmação sobre
fato: a causa continua sendo pergunta para o dono.

## 5. Regras de ouro

1. Nenhum telefone/email/CPF sai do script — nem em log, nem no JSON.
2. Não gravar nome de pessoa: o script não tenta identificar nome; se o lote
   vier com nome próprio no corpo, ele não é extraído para campo nenhum.
3. Merge por id (hash do conteúdo + janela): reouvir o mesmo lote não duplica.
4. Sem rede; sem `.env`; sem credencial.
5. Apagar lote exige `--limpar` (dry-run) + `--confirmar`.

## 6. Pitfalls medidos (PEF 13-v3, 05/11/2026)

1. **`[ANONIMIZADO]` entrava no top 5** como palavra — o placeholder é filtrado
   agora, senão o agregado fica falando do próprio mecanismo.
2. **Bloco vence linha**: sem isso, um comentário de 3 linhas virava 3 mensagens
   e inflava `total_mensagens`.
3. **Acento**: comparar sentimento sem normalizar perde "ótimo/péssimo" — o
   script compara com texto sem acento.
4. **Regex de telefone antes de CPF** quebra o CPF em pedaços; ordem é CPF →
   email → telefone com máscara → telefone cru.
5. **Sentimento é proxy, não verdade**: ironia ("ótimo, mais uma demora") cai em
   positivo se só contar palavra. Para lote com ironia, ler o lote à mão.

## 7. O que esta skill NÃO faz

- Não coleta mensagem de canal (lote é manual; API é do júnior).
- Não responde ninguém (isso é `iara-atendimento`).
- Não decide pauta (isso é `iara-radar` + `calendario-editorial`).
- Não guarda texto de mensagem nem dado pessoal.
