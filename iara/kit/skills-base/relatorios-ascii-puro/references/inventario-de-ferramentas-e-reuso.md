# Inventario de FERRAMENTAS, reuso e replicacao

Pedidos que abrem esta referencia (05/11/2026):

- "o que dos nossos fluxos podemos aproveitar para esse projeto?"
- "faca um levantamento completo dos fluxos existentes e avalie o que reaproveitar, adaptar ou
  descartar"
- "inventario de ferramentas e integracoes", "o que replicar para o IAra / outro agente"
- "relatorio tecnico que me permita decidir o que replicar" (replicar fluxo, nao remover nada)

Diferenca da familia "estruturacao de pastas": aqui o objeto e a FERRAMENTA (motor, modelo, MCP,
CLI, integracao, binario) e a decisao e REUSO/REPLICACAO, nao organizacao de arquivo.

---

## 1. Coletor: medir, nunca lembrar

Um bloco, saida em arquivo quando passar de ~40 linhas (o rtk-rewrite corta a saida longa).

```bash
hermes --version | head -5                      # versao + metodo de instalacao
grep -n -E "^[a-z_]+:|^  [a-z_]+:" ~/.hermes/config.yaml
grep -n -A8 -i "mcp" ~/.hermes/config.yaml      # mcp_servers: comando, url, auth, enabled
ls ~/.hermes/plugins/                            # plugins ligados
ls ~/.hermes/profiles/                           # agentes/profiles reais no disco
for b in ffmpeg ffprobe edge-tts piper sox yt-dlp node npx ollama; do
  printf "%-9s %s\n" "$b" "$(command -v $b || echo AUSENTE)"; done
python3 -m pip list | grep -i -E "langgraph|crewai|autogen|pillow|openai|playwright|supabase"
ls -d ~/ComfyUI ~/comfyui 2>/dev/null
ls ~/.venvs/                                     # venv fora do PATH (piper, whisper)
composio whoami; composio connections list       # canais sociais realmente conectados
df -h /                                          # capacidade de producao
find ~/.hermes/skills -name SKILL.md | sed 's|.*/skills/||; s|/SKILL.md$||' | sort
ls ~/.hermes/scripts/                            # familias de automacao
```

Nomes de credencial sem valor:

```bash
grep -ho "^[A-Z_]*=" ~/.hermes/.env | tr -d '='
for p in ~/.hermes/profiles/*/; do echo "-- $p"; grep -ho "^[A-Z_]*=" "$p/.env" 2>/dev/null | tr -d '='; done
```

## 2. Declarar o que NAO existe

O pedido quase sempre pergunta por n8n, LangGraph, CrewAI, MCP. Se nao existe, escrever
**"NAO EXISTE"** com o comando que provou — silencio deixa a leitora achando que talvez exista.

Medido em 05/11/2026: **nao existem** n8n, LangGraph, CrewAI, Autogen, Ollama, ComfyUI local,
edge-tts (bloqueado), LinkedIn, Facebook, TikTok, YouTube. A orquestracao e nativa: profiles +
skills + cron.

## 3. Duas escalas de classificacao (nao misturar)

Aderencia ao projeto alvo:

| Classe | Significa |
|---|---|
| REAPROVEITAR DIRETO | ja atende ao escopo |
| ADAPTAR | atende em parte; dizer o que muda |
| FUNDIR | dois fluxos viram um (nomear quem absorve quem) |
| DESCARTAR | fora do escopo ou redundante |
| LACUNA | nao existe fluxo para a necessidade |

Replicabilidade para outro agente:

| Classe | Significa |
|---|---|
| RD | copia sem alteracao (skill, procedimento, configuracao) |
| RA | precisa credencial, permissao, escopo ou nomenclatura propria |
| NR | depende de dado/contexto exclusivo (marca, cliente, brecho) |
| RS | existe alternativa melhor (API oficial no lugar de automacao de tela) |

Toda linha leva justificativa de UMA linha. Tabela sem justificativa vira opiniao.

## 4. Configuracao x codigo x credencial x dado

E a distincao que ela usa para decidir o que se copia. Fechar o relatorio com ela explicita:

- **Configuracao** — copiar e parametrizar (config.yaml do profile, mapa de roteamento, politica de
  canal).
- **Codigo** — copiar sem dado de marca (skill neutra de producao, script de render, documento).
- **Credencial** — nunca copiar; emitir nova por agente. No anexo vai so NOME e ESCOPO.
- **Dado** — nunca replicar entre tenants (memorias, sessoes, acervo, tabelas e buckets de cliente).

Regra de arquitetura que se repete: **replicar configuracao e padrao; ferramenta pesada e
compartilhada por chamada, nunca copiada** (ffmpeg, Pillow, Piper, Volito, Supabase).

## 5. A conta tem que fechar

O resumo executivo soma as classes e bate com o total inventariado (caso real: 35 = 17 RD + 13
adaptar + 3 fundir + 2 descartar). Se nao soma, a tabela esta errada — conferir antes de entregar.
Quando a contagem de fluxos parecer alta, entregar tambem a leitura qualitativa: reaproveitar 49%
em quantidade pode valer bem mais em valor, se os reaproveitados forem os de maior codigo pronto.

## 6. Pitfalls medidos

1. **`composio connected-accounts list` nao existe.** Subcomandos validos: `version, whoami,
   login, connections, tools, execute, run, proxy`. Usar `composio connections list` (JSON por
   toolkit com status ACTIVE/EXPIRED).
2. **Venv fora do PATH da falso "ausente".** `command -v piper` responde AUSENTE mas
   `~/.venvs/piper/bin/piper` funciona (idem voz em `~/.local/share/piper/*.onnx`). Antes de
   escrever "nao temos TTS", olhar `~/.venvs/`.
3. **Skill duplicada em dois caminhos e real.** `~/.hermes/skills/montagem-final-de-video-em-camadas`
   e `~/.hermes/skills/video/montagem-final-de-video-em-camadas` existiam ao mesmo tempo. Provar com
   `ls -d` nos dois caminhos completos, nao com `ls -d ~/.hermes/skills/<nome>` (o caminho curto ja
   gerou ticket errado). Checagem boa: `hermes skills list | grep <nome>`.
4. **Mapa oficial envelhece sem avisar.** O `mapa-oficial-2026-11-02.txt` diz 5 profiles e o disco
   tem 7 (arara, caos, cultural, curator, impl, pluma, semea); diz disco 20G/85% e o medido em
   05/11 foi 31G/53%. Reportar a divergencia no relatorio; nao corrigir o mapa por conta propria.
5. **Arte ja existe quando a leitora acha que nao.** Antes de propor "construir identidade visual",
   procurar em `~/.hermes/assets/` e nas pastas de arte: no caso Etnias/Opy ja havia paleta
   (#120D08, #2E251B, #C58B56, #B84A27), 6 PNGs de logo, 8 pastas de artes e 4 MP4 (o narrado com
   30,0 s medidos por ffprobe). Achado que muda a conclusao inteira do relatorio.
6. **`rtk-rewrite` esconde linha** de `ls`, `find` e `grep` longos ("... (1 filtered)", "[+N hidden]").
   Redirecionar para arquivo e ler, ou usar comando alvo.
7. Compactar a saida quando o pedido e de DECISAO: tabela com 8 colunas por fluxo e aceitavel para
   leitura, mas o fecho precisa de 5 recomendacoes priorizadas — e o que ela usa para decidir.

## 7. Snapshot 05/11/2026 (linha do tempo — reconferir antes de citar)

- Motor: Hermes Agent v0.19.0, instalacao git em `~/hermes-agent`.
- Modelos: principal `deepseek-v4-flash` (DeepSeek); delegacao `gemini-3.5-flash-lite` (Gemini);
  imagem `google/gemini-3-pro-image` via OpenRouter.
- MCP: `traqr-memory` (stdio, namespace por profile), `nuvemshop` (http/oauth, leitura),
  `volito` 0.3.1 (stdio, motion graphics + som + render).
- Plugins: `hermes-handoff`, `hermes-jev`, `rtk-rewrite`, `optmem`.
- Composio 0.4.1: instagram ACTIVE, googlesheets ACTIVE, gmail 1 ACTIVE + 1 EXPIRED.
- TTS local: `~/.venvs/piper` + `pt_BR-faber-medium.onnx` (60,3 MB). edge-tts ausente/bloqueado.
- Producao: Pillow 12.2.0, ffmpeg/ffprobe, yt-dlp, Node 22.23.4 (Volito).
- Dados: Supabase (15 tabelas, buckets `midias-pluma` e `fotos-produtos`), Google service account.
- Canais: WhatsApp bridge :3000 + gateway QR; Instagram so por Composio.
- Ausentes: n8n, LangGraph, CrewAI, Autogen, Ollama, ComfyUI local, LinkedIn, FB, TikTok, YouTube.
- Disco: 31G, 15G livres (53%).
