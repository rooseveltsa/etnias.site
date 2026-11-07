---
name: iara-radar
description: Radar de notícias — ler o clipping local (arquivos .txt/.md em ~/.hermes/iara-data/clipping/), classificar cada item por tema indígena (letramento, tecnologia, política, cultura, direitos), exigir fonte (URL ou veículo) e gerar sugestões de pauta em ~/.hermes/iara-data/pautas.json. Usar quando o dono pedir "o que saiu sobre a gente", "radar de notícias", "sugestão de pauta", "clipping" ou antes de fechar o calendário editorial. Aceita item de Instagram com Origem+Perfil+Link ou Print, sem Graph API. Sem rede.
---

# IAra — Radar de notícias (clipping -> pauta)

Objetivo: transformar o clipping do dia em pauta com ângulo, sem inventar fato e
sem aceitar notícia sem fonte. Nada de rede, nada de Supabase, nada de credencial.

## 1. Contrato

```bash
radar.py --classificar          # lê todo o clipping e grava pautas novas
radar.py --listar               # lista as pautas salvas
radar.py --limpar               # dry-run: conta o que sairia
radar.py --limpar --confirmar   # apaga as pautas (depois do dry-run)
```

Entrada: `~/.hermes/iara-data/clipping/*.txt` e `*.md`.
Saída: `~/.hermes/iara-data/pautas.json` (lista, permissão 0600).

Por item do clipping:
1. **título** = primeira linha não vazia (sem `#`, sem linhas `Fonte:`/`Data:`);
2. **fonte** = linha `Fonte: ...`; se não houver, a primeira URL do texto;
   se não houver nenhuma das duas → `fonte_ausente: true` e o item **não** vira pauta;
3. **data** = linha `Data:` (ou `AAAA-MM-DD` no texto);
4. **tema** = classificação por palavra-chave em `letramento`, `tecnologia`,
   `politica`, `cultura`, `direitos`; sem nenhuma palavra-chave → `indefinido`
   (fica registrado, não é chute);
5. **sugestao_angulo** = uma frase montada a partir do lede do próprio texto
   (cita o fato e manda conferir número na fonte). Não inventa dado.

Pauta gerada:

```json
{"id":"<sha1 12>","titulo":"...","tema":"tecnologia","fonte":"https://...",
 "data":"2026-11-03","sugestao_angulo":"...","status":"sugerida",
 "arquivo":"noticia-2.txt","evidencias_tema":{"tecnologia":["dados","plataforma"]},
 "gerado_em":"2026-11-05T19:20:00"}
```

Recusada (vai no relatório, nunca no arquivo de pautas):

```json
{"arquivo":"noticia-3.txt","titulo":"...","fonte":"","fonte_ausente":true,
 "motivo":"sem linha 'Fonte:' e sem URL no texto"}
```

## 2. Fontes aceitas (PEC 9.1)

O item declara a origem na primeira faixa de linhas, no formato `Campo: valor`:

| `Origem:` | exige | vira pauta quando |
|---|---|---|
| `site` (padrão) | `Fonte: ...` ou URL no texto | tem fonte |
| `rss` | `Fonte: ...` ou URL no texto | tem fonte |
| `instagram` | `Perfil: @handle` **e** (`Link: URL` ou `Print: /caminho`) | tem perfil válido **e** referência válida |
| `outro` | `Fonte: ...` ou URL no texto | tem fonte |

Exemplo de item de Instagram com post:

```
Origem: instagram
Perfil: @etnias
Link: https://instagram.com/p/xxx
Data: 2026-11-04

Título da pauta vem aqui
Lede em uma frase.
```

Exemplo com print (quando o post não pode ser linkado):

```
Origem: instagram
Perfil: @etnias
Print: /home/anaobranca/Hermes/Prints/ig-story-2026-11-04.png
```

Regras do item de Instagram:

1. `Perfil` precisa casar `^@[A-Za-z0-9._]{1,30}$`.
2. `Link` precisa ser `http(s)://…`; `Print` precisa ser **caminho absoluto que
   existe no disco** (o script não copia o arquivo, só guarda o caminho).
3. Sem `Perfil`, ou sem `Link`/`Print` → item **recusado** com
   `motivo: "instagram_sem_referencia"` e a lista `faltando`.
4. `Print` apontando para arquivo inexistente → recusado com
   `motivo: "instagram_print_inexistente"`.
5. Pauta gerada grava `origem: "instagram"`, `perfil` e `link_post` **ou**
   `print_referencia` (a referência é a fonte: sem ela não há pauta).

> ⚠️ **Coleta automática de Instagram (Graph API) NÃO é feita aqui** — é
> responsabilidade do júnior, documentada no relatório de implantação. Esta
> skill só lê o que o dono salvou em `clipping/`. Item de Instagram entra
> manualmente (link copiado ou print salvo no disco).

## 3. Regras de ouro

1. **Sem fonte não é pauta.** O item aparece em `recusadas` para o dono cobrar a fonte.
2. **Merge, nunca overwrite.** `--classificar` só acrescenta pauta com `id` novo;
   pauta existente não é sobrescrita nem apagada. Sobrescrever exige decisão do dono
   (`--limpar --confirmar` mostra a contagem antes).
3. **Não inventar ângulo.** O ângulo sai do lede; se o texto não sustenta, o item
   continua pauta mas o ângulo é o próprio fato.
4. **Sem rede.** Nada de RSS, httpx, requests, urllib. Clipping é manual.
5. **Sem credencial.** O script não abre `.env` nem `~/.hermes/credentials/`.

## 4. Taxonomia (5 categorias)

| tema | palavras-chave (amostra) |
|---|---|
| letramento | educa, escola, alfabetiz, formação, curso, professor, leitura |
| tecnologia | tecnolog, internet, digital, algoritmo, IA, dados, conectividade, plataforma |
| politica | congresso, STF, ministério, deputad, senad, governo, FUNAI, demarcação, PL |
| cultura | arte, música, festival, cinema, livro, grafismo, ritual, língua, oralidade |
| direitos | violência, garimpo, invasão, desmatamento, território, saúde, justiça, consulta livre |

A lista completa está em `TEMAS` no `scripts/radar.py`. O dono pode ampliar no
SKILL.md e no dicionário — os dois andam juntos.

## 5. Pitfalls medidos (PEF 9-v3, 05/11/2026)

1. Notícia "sem fonte" que ainda tem URL no corpo **conta como fonte** (a URL é a
   prova). Para testar recusa, o arquivo precisa não ter `Fonte:` **nem** URL.
2. Título é a primeira linha *depois* de remover `Fonte:`/`Data:` — senão o título
   vira "Fonte: Agência Brasil".
3. `pautas.json` é gravado por arquivo temporário + `os.replace` (atômico) e com
   `chmod 0600`; não editar à mão com outro dono/permissão.
4. `--limpar` sem `--confirmar` é dry-run puro: imprime contagem e ids, não toca no arquivo.
5. Duas notícias com o mesmo título e a mesma fonte colapsam no mesmo `id` (dedupe
   proposital). Título diferente = pauta diferente, mesmo veículo.

## 6. O que esta skill NÃO faz

- Não baixa notícia, não lê RSS, não abre navegador.
- **Não chama a Graph API nem raspa o Instagram.** Item de Instagram entra
  manualmente (`Link:` ou `Print:`); coleta automática é do júnior, no relatório
  de implantação.
- Não publica nem agenda: quem decide data é o `calendario-editorial`.
- Não escreve no Supabase (pautas ficam em JSON local nesta fase).
- Não classifica com modelo: é palavra-chave, determinístico e auditável.
