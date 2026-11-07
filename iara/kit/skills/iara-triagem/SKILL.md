---
name: iara-triagem-setorial
description: Mapa setorial da IAra — classifica um pedido em UM setor e aponta o fluxo de destino por referencia. Cobre os setores marketing, social-media, gestao-redes, atendimento, conteudo-estatico, audiovisual, analytics, calendario-editorial, radar-noticias, escuta-comunitaria, memoria-institucional e central-solicitacoes, e resolve as tres fronteiras (Social vs Atendente, Editorial vs Recepcionista, Radarista vs Estrategista). Usar SEMPRE antes de rotear um pedido.
---

# IAra — Triagem Setorial

Objetivo: dado um pedido em linguagem natural, escolher UM setor e
apontar o fluxo de destino (skill/caminho). A IAra nao executa a tarefa.

## 1. Mapa dos setores

O envelope da Fase 1 fala em "10 setores", mas a lista nominal que ele
traz tem 12 itens. Vale a lista nominal (esta abaixo), que e a fonte
canonica deste mapa. Divergencia registrada no ticket da Fase 1.

### 1.1 marketing (estrategista)
- Entra: campanha, posicionamento, oferta, publico, metas, o que fazer
  com um tema/noticia que ja foi captado.
- Sai: plano/briefing de campanha.
- Destino tipico: skills de marketing (pluma-marketing), briefings.

### 1.2 social-media
- Entra: publicar e engajar PARA a rede — post, story, reels, comentario
  publico, resposta publica, calendario de publicacao em execucao.
- Sai: publicacao no canal.
- Destino tipico: pluma-pexinxavel, composio (Instagram), xurl.

### 1.3 gestao-redes
- Entra: saude das contas e canais — acesso, permissao, token, queda de
  conexao, pareamento, conta bloqueada, troca de senha.
- Sai: canal operante ou pendencia de acesso.
- Destino tipico: whatsapp-pareamento-e-reconexao,
  cron-job-scheduling, hermes-plugins-e-mcp.

### 1.4 atendimento (atendente)
- Entra: conversa 1:1 — duvida de cliente, pedido, troca, reclamacao,
  orcamento, DM respondida individualmente.
- Sai: resposta a uma pessoa.
- Destino tipico: caixa de entrada (WhatsApp/Instagram DM), roteiros de
  atendimento.

### 1.5 conteudo-estatico
- Entra: card, cartaz, arte estatica, post de imagem unica, carrossel
  montado, capa, banner.
- Sai: imagem/PDF final.
- Destino tipico: cartazes-estaticos, design-de-arte-de-campanha,
  artes-de-campanha-em-serie, render-de-texto-em-artes.

### 1.6 audiovisual
- Entra: video, corte, reels, motion, audio, narracao, transcricao.
- Sai: arquivo de video/audio.
- Destino tipico: pluma-video, edicao-video-sincronizada-a-batida,
  manim-video, ascii-video.

### 1.7 analytics
- Entra: medicao — alcance, engajamento, conversao, funil, relatorio de
  numero, comparativo de periodo.
- Sai: numero/relatorio.
- Destino tipico: Sheets/Supabase (leitura), planilhas.

### 1.8 calendario-editorial
- Entra: decidir O QUE e QUANDO publicar — pauta do mes, grade, tema por
  dia, planejamento de serie.
- Sai: calendario/pauta.
- Destino tipico: cron-job-scheduling (recorrencia), documento de pauta.

### 1.9 radar-noticias
- Entra: captar o que acontece fora — noticia, tendencia, concorrente,
  tema em alta, varredura de rede.
- Sai: lista de achados/dossie bruto.
- Destino tipico: arara-pesquisa-tendencias, varredura-redes-sociais,
  blogwatcher.

### 1.10 escuta-comunitaria
- Entra: o que a comunidade fala — comentarios, grupos, mencoes, clima,
  reclamacao recorrente, sinal de crise.
- Sai: leitura de clima + evidencias.
- Destino tipico: whatsapp-bridge-monitoring, varredura-redes-sociais.

### 1.11 memoria-institucional
- Entra: guardar/consultar o que a marca ja decidiu — historico,
  preferencia, decisao, aprendizado, acervo de conhecimento.
- Sai: registro/consulta de memoria.
- Destino tipico: hermes-knowledge-base, memoria do profile, Obsidian.

### 1.12 central-solicitacoes (recepcionista)
- Entra: pedido novo, cru, ambiguo, multi-setor ou de terceiro que ainda
  nao se sabe onde cai.
- Sai: pedido registrado e roteado.
- Destino tipico: este mapa (triagem) + ticket.

## 2. As tres fronteiras (regra de desempate)

### 2.1 Social vs Atendente
- Falar PARA a rede (muitos, publico) = social-media.
- Falar COM uma pessoa (1:1, privado) = atendimento.
- Teste: a resposta vai para o feed ou para uma conversa? Feed ->
  social-media. Conversa -> atendimento.
- Caso misto: reclamacao publica -> social-media responde em publico E
  atendimento assume no privado; setor de entrada = social-media.

### 2.2 Editorial vs Recepcionista
- Decidir pauta/calendario (o que e quando) = calendario-editorial.
- Receber, registrar e rotear pedido que chega = central-solicitacoes.
- Teste: o pedido ja tem destino claro? Se sim, nao e recepcao, e
  execucao do setor. Se nao, e central-solicitacoes.

### 2.3 Radarista vs Estrategista
- Captar o que acontece fora (noticia, tema, concorrente) =
  radar-noticias.
- Decidir o que fazer com o achado (campanha, resposta, oferta) =
  marketing.
- Teste: o pedido pede "achar" ou "decidir"? Achar -> radar. Decidir ->
  marketing.

## 3. Regra de decisao

1. Um pedido = UM setor de entrada.
2. Pedido com dois setores: escolher o de entrada (quem age primeiro) e
   listar o segundo em `next_action`.
3. Pedido ambiguo ou sem contexto: `central-solicitacoes`.
4. Pedido de terceiro sem identificacao: `central-solicitacoes`.
5. Nunca inventar setor fora dos 12.

## 4. Saida da triagem

Devolver no ticket: `setor` (um dos 12), `referencia` (skill de destino +
caminho absoluto), `next_action` (uma linha). Nao executar o setor.

## 4. Design do etnias.site

Todo pedido de arte, post, carrossel ou video do **etnias.site** usa a skill
`iara-design-etnias` como fonte da verdade: cores (#120D08, #2E251B, #C58B56, #B84A27),
regra do logo (nunca branco nem preto; cobre no painel, #2E251B na cor dominante,
laranja em detalhe e no lockup), tipografia (Archivo Black + Inter), as pecas
aprovadas em `~/Hermes/Agente-do-Caos/artes/etnias-design-oficial-2026-11/`
e os geradores em `~/.hermes/scripts/`.

Nao recriar arte aprovada: partir do gerador e conferir a regra do logo antes de entregar.
