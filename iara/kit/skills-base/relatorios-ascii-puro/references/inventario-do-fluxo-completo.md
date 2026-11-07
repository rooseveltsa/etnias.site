# Inventario do fluxo inteiro (relatorio do predio completo)

Origem: pedido dela em 06/10/2026 — "me de um relatorio completo de todo o meu
fluxo existente ate agora, arara, pluma, agente do caos, etc".

Usar quando o pedido for o predio INTEIRO (todos os agentes/setores). Para
relatorio de um fluxo so, ver o template `relatorio-estado-fluxo.txt` e as
secoes do SKILL.md.

Variante que apareceu em 30/10/2026: "me de um relatorio completo das
estruturacoes que vc possui, com data e hora" — mesmo relatorio, com a
exigencia de DATA/HORA por estrutura. Nesse caso cada item de pasta/setor leva
o `mtime` real (`/bin/ls -la --time-style=long-iso`) ao lado do nome, e o
cabecalho leva o carimbo de quando o documento foi gerado. Numero sem data
envelhece; data colada no numero deixa ela comparar dois inventarios.

## 1. De onde tirar os dados (fontes vivas, nao memoria)

### Coletor em UM bloco (evita saida colapsada pelo rtk)

O plugin `rtk-rewrite` comprime saida longa de `ls`/`find`/`du` e a compressao
ESCONDE linha — num inventario isso vira bloco incompleto sem aviso. Rodar tudo
num bloco so, gravando em arquivo, e ler o arquivo depois:

```bash
{ echo "=== SKILLS ==="; find ~/.hermes/skills -name SKILL.md -not -path "*/.archive/*" | wc -l
  ls -1d ~/.hermes/skills/*/
  echo "=== SCRIPTS ==="; ls -1 ~/.hermes/scripts/ | wc -l
  echo "=== SETORES ==="; /bin/ls -la --time-style=long-iso ~/Hermes/
  /bin/ls -la ~/Hermes/Pexinxavel/; /bin/ls -la ~/Hermes/Agente-Cultural/
  echo "=== ESTOQUE ==="; ls -1 ~/Hermes/Pexinxavel/Estoque | grep -c '^PXX'
  ls -1 ~/Hermes/Pexinxavel/Vendidas
  echo "=== DISCO ==="; du -sh ~/Hermes/* | sort -h; df -h ~ | tail -1
  echo "=== PLUGINS/MCP ==="
  python3 - <<'EOF'
import yaml, os
d = yaml.safe_load(open(os.path.expanduser("~/.hermes/config.yaml")))
print("plugins:", d.get("plugins"))
print("mcp:", {k: (v.get("enabled"), v.get("url")) for k, v in (d.get("mcp_servers") or {}).items()})
print("model:", d.get("model"))
EOF
} > /tmp/inv.txt 2>&1
```

Depois: `read_file /tmp/inv.txt`. Nunca `ls -la` puro (o rtk borra pasta x
arquivo x symlink) — usar `/bin/ls`.

```bash
# automacoes proprias e acervo
ls -1 ~/.hermes/scripts/
ls -1d ~/Hermes/Pexinxavel/Estoque/PXX-* | wc -l
ls -1d ~/Hermes/Pexinxavel/P.L.U.M.A/Processados/pecas/PXX-* | wc -l

# pendencias registradas
head -20 ~/.hermes/pendente-deadarch.md
head -25 ~/Hermes/Pexinxavel/A.R.A.R.A/Relatorios/pendente-camisetas-plataformas.md

# profiles (identidades separadas — o inventario esquece deles)
ls -1 ~/.hermes/profiles/
```

Cron: usar `cronjob(action='list')` — a listagem ja separa ativos de pausados e
traz `deliver`, `last_status` e o proximo disparo. Ler `~/.hermes/cron/jobs.json`
a mao da mais trabalho e menos contexto.

Descricao dos setores: ler o `description:` do frontmatter das SKILL.md de
`atualizacao-arquitetura-agentes`, `arara-pexinxavel`, `arara-pesquisa-tendencias`,
`pluma-pexinxavel`, `pluma-video` e `video/curadoria-e-edicao-de-video`
(Agente do Caos). Cada description resume o escopo inteiro em uma linha.

## 2. Snapshot medido em 06/10/2026 (baseline para comparar, NAO para copiar)

- 153 skills instaladas. Plugins ativos: hermes-handoff, hermes-jev, rtk-rewrite
  (optmem instalado, fora do enable, ativo por CLI). MCP: nuvemshop, unico,
  ligado mas sob demanda.
- 47 pastas de peca no estoque do PC; 35 originais em processados/pecas.
- Crons ATIVOS (5): medicao de tokens (seg 9h -> WhatsApp), ARARA-Pesquisa
  tendencias (seg+qui 9h, local), limpeza de cache (diario 9:30, local), DEADARCH
  Weekly Sync (seg 9h, local), Curator.X lembrete semanal (seg 9h, local).
- Crons PAUSADOS (11): noticias IA, noticias moda segunda mao, limpeza Gmail,
  conversas WhatsApp pendentes, ARARA relatorio diario/semanal/mensal, ARARA
  escala dia 5 e dia 20, monitor de bateria, monitorar-vendas-grupos, ARARA
  confirmar escala.
- Setores ATIVOS: A.R.A.R.A. (orquestrador do brecho), Subagente de Pesquisa,
  P.L.U.M.A. (+ P.L.U.M.A. VIDEO e geracao de imagens), Curator.X (+ Curador.Preco),
  T.R.A.M.A. (fora do brecho). FUTURO: Gerente de Rendas.
- Fora do brecho: Agente do Caos (video de terceiros), T.R.A.M.A., limpeza
  (PC/Gmail/cache), noticias, DEADARCH.
- Canais: Nuvemshop/C110 (link publico coletivo110.com, MCP sob demanda, painel
  via CDP), Instagram @pexinxavel (Composio; musica so pelo app), Shopee (painel
  CDP 9222, publicacao automatica nao fecha), Enjoei (navegador, cota gratis
  esgotada ate 31/12/2026), Mercado Pago (CDP 9222, token sem transfer/PIX),
  WhatsApp (bridge, DM dela em duas sessoes).
- Pendencias abertas nessa data: DEADARCH nunca testado com a pendrive plugada;
  Shopee nao fecha publicacao automatica (PXX-035 em rascunho); 3 pecas do site
  sem numero no SKU; 9 camisetas medidas esperando subir em site/Shopee/Enjoei a
  R$ 75; sigilo do agente (Ingridhy nao pode saber).

Reconferir cron e contagem de estoque antes de entregar: mudam toda semana. O
snapshot serve para achar o que mudou, nao para responder.

## 3. Snapshot medido em 13/10/2026 (2o ponto da linha do tempo)

- Skills: **154** = 82 proprias + 69 nativas do produto. Contar por fonte com
  `hermes skills list | awk -F'│' 'NF>3{gsub(/ /,"",$4); if($4=="builtin")b++; else if($4=="local")l++} END{print b,l}'`
  (a listagem tem a coluna Source = builtin/local; `find -name SKILL.md | wc -l` da so o total).
- Scripts proprios: **58** em `~/.hermes/scripts/`. Servicos systemd user: 4 —
  `hermes-gateway.service` (enabled), `limpar-screenshots.service`, `limpar-lixeira.service`,
  `chromium-mp.service` (desabilitado de proposito).
- Crons: 17 = **6 ativos** (medicao de tokens, pesquisa de tendencias, limpeza de cache, DEADARCH
  sync, Curator.X lembrete, monitor Ramon) + **11 pausados**. O monitor Ramon (20 min) e novo em
  relacao a 06/10.
- Acervo: 38 pastas em `~/pexinxavel/estoque/` e 35 originais em `processados/pecas/` (era 47/35 em
  06/10 — o estoque do site CAIU: venda na mao dela nao vira registro).
- Plugins ligados: hermes-handoff, hermes-jev, rtk-rewrite (+ optmem fora do enable). MCP: nuvemshop
  so. Plataforma conectada: whatsapp.
- Maquina: RAM 6,3 GB (1,5 GB disponiveis), disco 6,4 GB livres (68% usado).
- Versao do Hermes: 0.19.0 (tag v2026.7.20) contra 0.21.5 (tag v2026.9.24) no repo upstream — ver a
  secao de versao na skill `hermes-desktop`. O pip/PyPI fica parado no 0.19.0; aqui a instalacao e git.
- Pendencias novas em relacao a 06/10: senha de app do Gmail do pexinxavel invalida (limpeza dessa
  conta parada) e o Hermes 2 versoes atras. As antigas seguem: DEADARCH nunca testado com a pendrive,
  Shopee nao fecha publicacao automatica, 3 pecas sem SKU numerado, 9 camisetas a R$ 75 para subir,
  cota gratis do Enjoei esgotada ate 31/12/2026.

## 4. Snapshot medido em 30/10/2026 (3o ponto; ja na estrutura ~/Hermes)

Coleta feita com o bloco do item 1 + `cronjob(action='list')`. Todos os numeros
abaixo saem de comando, com carimbo 30/10/2026 17:09 BRT.

- Raiz de trabalho consolidada: `~/Hermes/` com Agente-Cultural, Agente-do-Caos,
  Backups, Downloads, Pexinxavel, Relatorios, skills-baixadas + 2 atalhos do
  motor (hermes-agent, hermes-jev-skills). A camada `~/Arquivos-Linux` nao
  existe mais (removida 16/10/2026).
- Skills: **167 arquivos SKILL.md** em **45 pastas de topo** em `~/.hermes/skills/`.
  (Cresceu de 154 para 167 em ~2 semanas; o numero de pastas de topo NAO cresceu
  na mesma proporcao porque skills novas entram dentro das categorias.)
- Scripts proprios: **201** em `~/.hermes/scripts/` (era 58 em 13/10 — salto
  grande, vale registrar no relatorio como crescimento, nao como erro).
- Crons: **20 registrados = 9 ativos + 11 pausados**. Ativos: vigia WhatsApp
  (*/3), monitor Ramon (*/20), Enjoei perguntas (11:30/15:30 e 21:00), limpeza
  de cache (9:30), medicao de tokens (seg 9h), DEADARCH sync (seg 9h),
  Curator.X lembrete (seg 9h), ARARA-Pesquisa (seg+qui 9h). Os 11 pausados sao
  os mesmos desde 21/08 e 06/09/2026 — pausa antiga, nao pausa recente.
- Profiles: `arara, caos, cultural, curator, pluma` + o `default` (WhatsApp).
- Plugins ligados: 3 (hermes-handoff, hermes-jev, rtk-rewrite). MCP: 1
  (nuvemshop, oauth, leitura). Modelo: deepseek-v4-flash / deepseek.
- Acervo: **56 pecas ativas** em `Estoque/` e **3 vendidas** (PXX-013, PXX-023,
  PXX-030) em `Vendidas/`.
- Disco: `/dev/vdb` 20 GB, 17 GB usados, 3,4 GB livres (83%). `~/Hermes` ~3,5 GB:
  Backups 2,0G > Pexinxavel 1,1G > Agente-do-Caos 244M > Agente-Cultural 136M >
  skills-baixadas 129M > Relatorios 284K > Downloads 0.
- Supabase (ultima medicao 25/10, ENTRA COM A DATA no relatorio): 505 objetos,
  produtos 56, vendas 21, midias 329, medicoes 26. Numero de nuvem que nao foi
  medido hoje vai marcado com "ultima medicao: <data>" — nunca apresentado como
  estado de agora.
- Pendencias que o relatorio levantou sozinho (o valor do inventario): gerar PDF
  do .txt se ela pedir; `Logos/` e `Marca/` vazias desde 14/10; `Downloads`
  vazia desde 14/10; memoria em 99% do teto; originais das pecas antigas ainda
  fora do bucket `fotos-produtos`.

### Fechamento que funcionou

Depois do documento completo colado no chat, destacar 2 achados no maximo (aqui:
9 de 20 crons rodando e as duas memorias em 99%) e oferecer UMA acao concreta
("quer o PDF?"). Nao transformar o fechamento em resumo do resumo — ela le o
documento inteiro.

## 5. Checagem de residuo antes de fechar o inventario

O inventario e a hora em que se olha a config inteira — aproveitar para cacar sobra de tarefa antiga.
Em 13/10/2026 `browser.cdp_url` estava apontando para `http://127.0.0.1:9222` com o Chromium MORTO
(a automacao sobe o navegador sob demanda). Regra: conferir o campo lendo o `config.yaml` com
`python3 -c` e devolver para vazio com `hermes config set browser.cdp_url ""`. Registrar no relatorio
que foi corrigido, com data — ela valoriza a limpeza registrada.

## 6. O que muda de um inventario para o outro (o que ela cobra)

- Numero de skills, scripts, crons (ativo x pausado) e pecas no acervo: SEMPRE.
- Data e hora por estrutura quando ela pedir "com data e hora": usar `mtime` real,
  nao a data que eu lembro.
- O que esta VAZIO (Logos, Marca, Downloads) — pasta vazia nao e erro, e estado,
  e ela quer saber.
- O que vivia no inventario anterior e sumiu (pasta removida, cron apagado).
  Comparar com os snapshots 2/3/4 acima e o que da a linha do tempo.
