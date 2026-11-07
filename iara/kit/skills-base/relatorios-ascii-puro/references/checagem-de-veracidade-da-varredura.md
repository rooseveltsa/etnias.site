# Checagem de veracidade de uma varredura (protocolo medido 29/10/2026)

Pedido dela, depois de receber uma varredura de noticias:
*"Confira se todas as informacoes sao veridicas"*.

Nao e revisao de estilo. E auditoria de fonte, afirmacao por afirmacao, porque o
material vai virar post politico e numero errado queima a campanha.

## 1. Antes de checar: extrair a lista de afirmacoes

Do proprio `.txt` da varredura, listar cada afirmacao que carrega fato verificavel
(numero, data, nome, local, atribuicao). Secao de resumo e texto de contexto nao
entram. No caso de 29/10/2026 deu **21 afirmacoes centrais**.

## 2. Onde checar (ordem de forca da fonte)

1. **Nota oficial do orgao**: MPF (mpf.mp.br), PF, Funai, Ministerio dos Povos
   Indigenas, secretarias estaduais. Resolve o maior numero de itens e derruba
   boato que a imprensa reproduziu.
2. **Segundo veiculo independente** do que publicou primeiro (G1, Agence Brasil,
   O Globo, GZH local quando o caso e regional — o jornal local costuma ter o nome
   das vitimas e a versao da policia).
3. **Pagina do proprio estudo/organizacao** (ex.: Justica Global publica o
   levantamento de violencia politica com a metodologia e o recorte de datas).
4. Busca com o **nome proprio exato** (municipio, terra indigena, vitima) — foi o
   que trouxe G1/GZH/Metropoles para o caso de Votouro, que a primeira busca por
   tema nao retornava.

Leitura das paginas com `defuddle parse` + limpeza de HTML (ver
`references/varredura-de-noticias-e-redes.md`).

## 3. Os quatro estados (nao usar "tudo certo" global)

- **CONFIRMADO** — fonte primaria ou 2+ veiculos independentes.
- **FONTE UNICA** — publicada com atribuicao nominal, sem cruzamento. Nao e falso:
  e "usar sempre com 'segundo ...'". Ex. no caso: "CIMI/MS contabiliza 5
  assassinatos desde 24/10" (Agencia Brasil, com o coordenador nomeado);
  "6 Guarani Kaiowa mortos em MS 2022-2026" (dado da APIB).
- **PRECISA CORRECAO/NUANCE** — o material anterior exagerou, simplificou ou fixou
  o que esta em disputa.
- **NAO CONSEGUI CHECAR** — dizer o que e por que (autoria de tiros sem conclusao
  da PF, laudo de agua inexistente, balanco oficial nao publicado, redes sociais
  por dentro exigem login).

## 4. Casos medidos nesta rodada (usar como exemplo)

| item | estado | o que a checagem mostrou |
|---|---|---|
| Ataque a indigenas em Navirai (MS) | FALSO | MPF/MS: tentativa de duplo homicidio por desentendimento familiar; vitimas (Junho Alves Fernandes e Renan Willian de Souza Vieira) sem pertencimento indigena na checagem RADAR/SPPA; fotos do crime circularam adulteradas |
| Prazo do MPF em Tacuru | CORRIGIDO | oficial 48h (a imprensa publicou 24h numa versao) |
| Mortes na TI Votouro (RS) | CONFIRMADO (fato) / CONTESTADO (motivacao) | 3 mortos em 13/10 e acao do Batalhao de Choque: G1, GZH, Metropoles. Motivacao: moradores (Agencia Publica) falam perseguicao politica; Brigada Militar e imprensa local falam disputa de cacicado; PF sem conclusao |
| Ataque com explosivos a Funai | CONFIRMADO | 08/10, UTL da TI **Sao Jeronimo da Serra** (PR), sem feridos: G1, UOL, Brasil de Fato, Agencia Brasil |
| 354 casos de violencia politica / 1 a cada 44h | CONFIRMADO | Terra de Direitos + Justica Global; reproduzido por G1, Agencia Brasil, Nexo |
| "134 casos na campanha, 1 a cada 9h" | FONTE UNICA | so Agencia Publica |
| "15 feridos" em Votouro | FONTE UNICA | relato de moradores; G1 registra 3 mortos + 1 motorista baleado que recebeu alta |

## 5. Formato do documento de checagem

ASCII puro (regra da skill), duas copias, com estas secoes:

```
VEREDITO GERAL (quantas confirmadas, quantas de fonte unica, quantas a corrigir)
1. CONFIRMADO POR 2 OU MAIS FONTES
2. FONTE UNICA (usar sempre com atribuicao)
3. PRECISA DE CORRECAO OU DE NUANCE  (o que eu escrevi x como esta)
4. O QUE ESTAVA CERTO E VALE REFORCAR
5. O QUE NAO CONSEGUI CHECAR
6. RECOMENDACAO DE USO
```

A secao 3 e a mais importante: escrever **"O QUE EU ESCREVI" / "COMO ESTA"** em cada
item. Ela corrige sem rodeios e prefere a correcao explicita a perfeicao.

### Versao REVISADA do relatorio (o que ela pediu em 29/10/2026)

Depois da checagem ela pediu: *"faca um pdf e coloque uma observacao sobre a
quantidade de fontes. Links das fontes tbm"*. O documento final virou o relatorio
revisado, nao um anexo de checagem:

- Cabecalho `VERSAO 2 - REVISADA APOS CHECAGEM DE VERACIDADE` + novo campo
  "Revisao: <data>".
- **Legenda de forca da fonte no TOPO**, e a marcacao repetida em CADA bloco do
  texto, nao so no veredito:
  `[P]` fonte primaria/nota oficial · `[2+]` 2+ veiculos independentes ·
  `[1]` fonte unica (sempre com "segundo X") · `[~]` contestado (ha versao
  divergente).
- **Placar honesto** logo abaixo da legenda: quantas afirmacoes centrais, quantas
  confirmadas, quantas de fonte unica, quantas contestadas, quantas desmentidas.
  ⚠️ **Nao inflar numero**: escrever "34 afirmacoes checadas" quando 34 era a
  contagem de LINKS foi erro meu e precisou ser corrigido — se nao contou, nao
  estime; dizer a contagem real e a quebra por estado.
- Secao nova **"CORRECOES APLICADAS NESTA VERSAO"** listando o que mudou do v1.
- Ultima secao **"LINKS DAS FONTES"**: lista numerada, agrupada por tema/estado
  (oficiais, MS, RS, PR, MG, PA/RR, estudo), com a URL inteira em linha propria.
  Ela pede isso explicitamente e usa para conferir.


## 6. Regra que sobra para o material de divulgacao

Numero confirmado pode ir na arte. Fato contestado entra so como o fato duro
("3 indigenas mortos em um dia"), nunca com a motivacao no titulo. Item de fonte
unica so com a atribuicao na legenda.
