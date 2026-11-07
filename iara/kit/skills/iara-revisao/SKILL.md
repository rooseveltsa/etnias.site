---
name: iara-revisao
description: Revisar uma peça pronta antes de publicar — parecer em 5 eixos (ortografia/gramática pt-BR, menção de fonte em notícia, adequação ao brand pack, presença de CTA em card/carrossel e tom institucional/agressivo), com status ok|alerta|falha por eixo, bloqueio quando há falha e registro em ~/.hermes/iara-data/revisoes.json. Usar quando o dono pedir "revisa isso", "olha antes de publicar", "esse texto tá bom?", "confere o tom" ou entre aprovação e publicação.
---

# IAra — Revisão Editorial

Objetivo: nenhuma peça vai para o canal sem parecer. Cinco eixos, um status
cada, e um veredito que pode **bloquear** a publicação.

Sem rede, sem corretor externo, sem credencial — tudo determinístico e
auditável.

## 1. Contrato

```bash
revisar.py --peca-id <id> --tipo <noticia|card|carrossel|video|institucional> \
           (--texto "..." | --texto-file /caminho.txt) [--brand-pack /caminho.json]
revisar.py --consultar
revisar.py --limpar --peca-id <id>
```

Saída (gravada em `~/.hermes/iara-data/revisoes.json`, permissão 0600):

```json
{"id":"<uuid>","peca_id":"nota-01","tipo":"noticia","criado_em":"2026-11-05T19:33:00-03:00",
 "parecer":{
   "ortografia":{"status":"ok|alerta|falha","comentario":"...","achados":[...]},
   "fonte":     {"status":"...","comentario":"...","tem_rotulo":true,"tem_url":true},
   "brand_pack":{"status":"...","comentario":"...","esperado":{"cores":[],"fontes":[]}},
   "cta":       {"status":"...","comentario":"...","verbos":[]},
   "tom":       {"status":"...","comentario":"...","classificacao":"institucional"}},
 "falhas":["fonte"], "alertas":["cta"],
 "bloqueado":true, "aprovado":false, "resumo":"bloqueado por: fonte"}
```

Exit: `0` parecer gerado (inclusive `bloqueado: true` — bloqueio não é erro de
execução) | `2` entrada inválida | `3` `revisoes.json` ilegível | `4` brand pack
ausente/ilegível.

## 2. Os 5 eixos

### 2.1 Ortografia/gramática
Lista curada dos erros que mais aparecem em texto de rede social, com a regra
explicita (crase em `às vezes`/`à vista`/`à medida que`, `há dois anos`,
`faz dois anos`, `houve problemas`, `mais/mas`, `menos`, `eles têm`, `aonde`,
`impresso`, `de encontro a`...).

- 0 achados → `ok`
- 1–2 → `alerta`
- ≥ 3 → `falha`

Não é corretor: erro fora da lista passa. Revisão humana continua necessária.

### 2.2 Fonte (obrigatória em notícia)
`tipo == noticia` exige rótulo `Fonte:` ou `Veículo:` no texto.

| situação | status |
|---|---|
| rótulo presente | `ok` |
| só URL, sem rótulo | `falha` (URL solta não diz de onde veio) |
| nada | `falha` |

Para os outros tipos o eixo é `ok` e diz que fonte não foi exigida.

### 2.3 Brand pack (opcional)
Com `--brand-pack caminho.json` (chaves aceitas: `cores`/`paleta`/`colors`,
`fontes`/`fonts`), o eixo confere se o texto cita alguma cor (hex) ou fonte
esperada.

- citou alguma → `ok`
- não citou nenhuma → `alerta` (o texto pode estar certo e o pack não; confira
  visualmente)
- sem `--brand-pack` → `alerta` (não é possível conferir)

### 2.4 CTA (card e carrossel)
`tipo in (card, carrossel)` exige verbo no imperativo ou chamada:
`saiba, acesse, confira, cadastre, inscreva, participe, compartilhe, siga, leia,
veja, conheça, apoie, doe, venha, baixe, assista, ouça, clique, garanta`.

- achou → `ok`
- não achou → `alerta` (não bloqueia: CTA é ajuste, não impedimento legal)

### 2.5 Tom
Classifica em `formal | institucional | informal | agressivo` por marcadores.

| classificação | status |
|---|---|
| `agressivo` (ofensa, ataque, "vermes", "canalha", "morte aos"...) | **`falha`** |
| `informal` com 2+ marcadores (`vc`, `pq`, `kkk`, `galera`...) | `alerta` |
| `formal` (2+ conectivos formais) | `ok` |
| resto | `ok` (institucional neutro) |

## 3. Veredito

- `bloqueado: true` ⇔ existe pelo menos um eixo em `falha`.
- `aprovado: true` ⇔ nenhuma `falha` (alertas são leves e não impedem).
- Peça bloqueada **não publica**: volta para quem escreveu com o motivo.

## 4. Uso no fluxo

```
iara-pesquisa (dossiê verificado)
   → iara-revisao (parecer)        ← este passo
   → iara-aprovacao (aprovador nominal + hash)
   → iara-log-publicacao (URL e hora)
```

Pauta no `iara-calendario` só chega a `agendado` com `aprovado: true` daqui e
aprovação nominal registrada.

## 5. Regras duras

1. **Falha bloqueia.** Nunca "aprovar porque está quase bom".
2. **`revisoes.json` só acrescenta.** Arquivo ilegível → exit 3, sem zerar histórico.
3. **Tom agressivo é falha, não alerta.** Ofensa a pessoa ou grupo não passa,
   mesmo que o resto esteja impecável.
4. **Fonte de notícia é rótulo, não link solto.**
5. **Brand pack ausente não inventa cor.** O eixo vira `alerta` e diz que não
   conferiu.

## 6. Pitfalls

- **Texto curto passa fácil**: card de 8 palavras pode não disparar nenhuma
  regra e sair `aprovado`. Parecer não substitui leitura humana.
- **`--texto-file` de PDF** traz binário lixo: converta antes (skill
  `ocr-and-documents`).
- **Falso positivo de ortografia**: a lista é conservadora, mas "as vezes" no
  sentido literal ainda dispara — leia o `achados` antes de corrigir.
- **Acento em `veículo`**: o regex cobre `veículo` e `veiculo`; se o autor
  escrever `Veículo:` com outro acento, o eixo falha — normalizar o rótulo na
  origem.
- **`--limpar` apaga todas as revisões daquele `peca_id`** (histórico incluso):
  use com `--consultar` antes.
- **Marcador de tom por substring mente.** Medido no PEF 11-v3: o marcador
  informal `ta ` casava dentro de "trin**ta **vagas" e rebaixava texto
  institucional para informal. A comparação é por **palavra inteira**
  (`\b`); ao ampliar `AGRESSIVOS`/`INFORMAIS`/`FORMAIS`, use palavra única ou
  frase curta — nunca prefixo solto.
