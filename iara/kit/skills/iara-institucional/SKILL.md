---
name: iara-institucional
description: Bloqueio institucional e autorização de imagem — classifica uma peça como institucional (nota pública, denúncia, crise, ameaça, violência, direito territorial, ação judicial, posicionamento oficial) e exige aprovador institucional nominal para liberar, além de conferir se cada imagem tem autorização liberada na biblioteca. Grava o rastro em ~/.hermes/iara-data/institucional.json. Usar quando o dono pedir "isso é posicionamento da marca?", "verifica a autorização das fotos", "quem autorizou", "pode publicar essa nota" ou antes de qualquer peça com imagem de terceiro.
---

# IAra — Institucional + Autorização de Imagem

Objetivo: barrar duas coisas que não têm conserto depois de publicadas —
posicionamento institucional sem responsável e imagem de pessoa sem
autorização.

Sem rede, sem modelo, sem credencial. Decisão por palavra-chave e por campo
da biblioteca, auditável.

## 1. Contrato

```bash
institucional.py classificar --peca-id nota-01 --texto "Nota pública sobre..."
institucional.py verificar_autorizacao --peca-id nota-01 --imagens foto-001,foto-002
institucional.py registrar_aprovador_institucional --peca-id nota-01 --aprovador "Maria Silva"
institucional.py status --peca-id nota-01
institucional.py limpar --peca-id nota-01            # só teste
```

Exit: `0` ok (inclusive `bloqueado: true` — bloqueio é resultado, não erro de
execução) | `2` entrada inválida.

## 2. `classificar`

Detecta sinal institucional por categoria:

| categoria | exemplos de gatilho |
|---|---|
| `nota_publica` | "nota pública", "nota oficial", "comunicado oficial", "carta aberta" |
| `posicionamento` | "posicionamento oficial", "nos posicionamos", "repudiamos" |
| `denuncia` | "denúncia", "denunciamos", "violação de direitos" |
| `crise` | "crise", "emergência", "situação crítica", "urgente" |
| `ameaca` | "ameaça", "intimidação", "atentado" |
| `violencia` | "violência", "agressão", "ataque", "invasão", "despejo" |
| `territorio` | "direito territorial", "demarcação", "retomada" |
| `judicial` | "ação judicial", "liminar", "ADPF", "STF", "Ministério Público" |

Saída:

```json
{"peca_id":"nota-01","institucional":true,"bloqueado":true,
 "motivo":"sinal institucional: ameaca (ameaça); nota_publica (nota pública)",
 "categorias":["ameaca","nota_publica"],"aprovador_institucional":null}
```

Regra: `institucional: true` **e** sem aprovador registrado → `bloqueado: true`.
Texto sem sinal → `institucional: false`, `bloqueado: false`.

## 3. `verificar_autorizacao`

Para cada ID, procura `autorizacao` em `biblioteca.json`:

```json
{"autorizacao": {"autor": "Maria Silva", "tipo": "liberada", "documento": "termo-001"}}
```

| situação | resultado |
|---|---|
| `tipo: "liberada"` + os 3 campos preenchidos | libera |
| `tipo: "restrita"` | **não bloqueia**, mas entra em `restritas` (conferir uso) |
| `tipo: "revogada"` | `bloqueado: true` |
| `autorizacao` ausente / vazia / incompleta | `bloqueado: true` |
| `item_id` fora da biblioteca | `bloqueado: true` (`item_fora_da_biblioteca`) |

Saída com bloqueio: `motivo: "imagem_sem_autorizacao"` e a lista `problemas`
dizendo qual ID e por quê. **Não existe autorização presumida.**

## 4. `registrar_aprovador_institucional`

Grava o nome de quem assumiu a peça institucional e desbloqueia.

- nome vazio → recusa (`2`), continua bloqueado;
- `eu`/`teste` → recusa em produção (só com `--teste`);
- o registro guarda `era_institucional` (se a peça já estava classificada).

Quem tem poder institucional é decisão do dono — a skill não tem lista de
cargos.

## 5. `status` (releitura)

Consolida o que está no log:

```json
{"institucional":true,"aprovador_institucional":"Maria Silva",
 "bloqueado_institucional":false,"bloqueado_autorizacao":false,"bloqueado":false}
```

## 6. Integração com a aprovação

`iara-aprovacao` **não** pode liberar peça bloqueada aqui. A porta está pronta:

```python
import sys, os
sys.path.insert(0, os.path.expanduser("~/.hermes/skills/iara-institucional/scripts"))
from institucional import esta_bloqueado
if esta_bloqueado(peca_id):
    ...  # não aprovar
```

A ligação dentro do adapter fica para o próximo PEF/júnior — esta skill não
modifica `iara_adapter.py` (escopo desta fase é criar o bloqueio e o rastro).

## 7. Regras duras

1. **Sem nome, não desbloqueia.** Aprovação institucional é nominal.
2. **Imagem de terceiro sem `autorizacao` bloqueia.** Sem exceção e sem
   "depois a gente vê".
3. **`revogada` é bloqueio**, não aviso: autorização revogada não vale.
4. **`restrita` não bloqueia** — mas fica registrada para conferência do uso.
5. **O log só acrescenta.** `institucional.json` ilegível → exit 3, sem zerar.

## 8. Pitfalls

- **Palavra-chave isolada gera falso positivo**: "crise" em texto de
  divulgação ("crise de audiência no curso") marca como institucional. O
  `motivo` mostra o gatilho — leia antes de tratar como posicionamento.
- **Acento não atrapalha** (texto e chave são dobrados), mas sinônimo
  atrapalha: "repúdio" não está na lista; ampliar junto com o dicionário.
- **Classificar de novo a mesma peça** cria novo registro e o `status` usa o
  **último**; histórico fica no arquivo.
- **Desbloqueio antigo continua valendo**: registrar aprovador sem nenhuma
  classificação prévia grava `era_institucional: false`, mas `status` mostra
  `institucional: false` — a aprovação não transforma a peça em institucional.
- **`verificar_autorizacao` com lista vazia** é recusado (nada a verificar não
  é o mesmo que liberado).
