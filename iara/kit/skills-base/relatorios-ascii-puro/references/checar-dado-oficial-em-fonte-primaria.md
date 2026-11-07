# Checar numero em fonte primaria (dado aberto), nao em noticia

Caso medido em 02/11/2026: ela pediu *"checar se os incendios de fato aumentaram apos o 2o turno"*.
A resposta honesta so apareceu quando eu parei de ler manchete e baixei o dado bruto do INPE.

## 1. Antes de tudo: conferir a DATA da materia

- A busca devolveu "Queimadas disparam na Amazonia apos segundo turno das eleicoes" com numeros
  exatamente do tipo que eu queria (Rondonia 149 -> 1,5 mil focos; Acre 40 -> 882). Fui abrir: a
  materia era de **11/11/2022**, sobre a eleicao de 2022. Em 2026 os numeros sao outros.
- Snippet de busca nunca traz o ano. `defuddle parse <url>` e ler a data ANTES de citar o numero.
- Se o numero parecer bom demais para o que ela perguntou, desconfiar do ano.

## 2. Dado aberto do INPE (queimadas)

Listagem de diretorio funciona (nao precisa de API):
```
https://dataserver-coids.inpe.br/queimadas/queimadas/focos/csv/diario/Brasil/
  -> focos_diario_br_YYYYMMDD.csv   (um arquivo por dia)
```
- Colunas: `id,lat,lon,data_hora_gmt,satelite,municipio,estado,pais,municipio_id,estado_id,
  pais_id,numero_dias_sem_chuva,precipitacao,risco_fogo,bioma,frp`.
- Cada arquivo traz **todas as deteccoes do dia, somando os 12 satelites** — dezenas de milhares de
  linhas. Nao e "numero de incendios"; e deteccao por satelite, com o mesmo fogo podendo aparecer
  em mais de um satelite.
- **Satelite de referencia (Aqua)** e a metrica oficial do INPE. Filtrar `satelite.startswith("AQUA")`
  para o numero comparavel com a imprensa; o total de todos os satelites serve para tendencia, nao
  para citar como "focos de queimada".
- O portal `data.inpe.br/queimadas/dados-abertos/` e renderizado por JS: nao tem link `.csv` no
  HTML. Ir direto na listagem `dataserver-coids`.

## 3. PITFALL que estraga a conta: nome de UF com acento

Primeira rodada contou `Amazonia Legal = 0` e depois subcontou pela metade, porque o campo `estado`
vem escrito por extenso **com acento**: PARA, AMAPA, RONDONIA, MARANHAO. Comparar com sigla ou com
nome sem acento da zero silencioso.
```python
import unicodedata
def sem_acento(s):
    return "".join(c for c in unicodedata.normalize("NFD", s)
                   if unicodedata.category(c) != "Mn").upper().strip()
uf = sem_acento(linha["estado"])      # -> "PARA", "AMAPA", "RONDONIA"
```
- O mesmo vale para `bioma` (`AMAZONIA`).
- Contagem que volta zero onde deveria ter milhar e sinal de comparacao quebrada, nao de ausencia
  de dado. Checar a normalizacao antes de escrever qualquer conclusao.

## 4. Metodo que produziu resposta defensavel

- Duas janelas de **7 dias** de cada lado do evento (dia do evento fora; dia corrente fora porque o
  arquivo esta incompleto).
- Media diaria em cada janela e variacao percentual. Comparar tambem por UF, senao o agregado
  esconde o que esta localizado.
- Resultado do caso (1o turno 04/10, 2o turno 25/10/2026):
  - 1o turno: Brasil 18.754 -> 46.054 por dia (**+145,6%**); Aqua 690 -> 1.271 (+84,4%).
  - 2o turno: Brasil 22.269 -> 22.570 (**+1,3%**); Aqua 1.132 -> 972 (**-14,1%**).
  - Por UF depois do 2o turno: AP +117%, RR +82%, PA +35% subiram; AM -41%, RO -61%, TO -73%,
    MT -74%, MA -19% cairam.
- Conclusao que ela aceitou: **nao houve alta nacional depois do 2o turno**; o salto foi depois do
  1o. Aumento localizado em tres estados, nao no pais.
- Entregar o numero com a ressalva que muda a leitura: a semana anterior ao 2o turno ja era alta
  (pico em 24/10), entao a comparacao e contra base elevada, nao contra patamar calmo.

## 5. Como relatar resultado que CONTRARIA o que ela ouviu

- Dizer na primeira linha: "checado com dado bruto, nao com noticia" e a resposta direta.
- Mostrar as duas janelas e as duas metricas (total x satelite de referencia) — quando as duas
  divergem em sinal, a divergencia e o achado, nao um detalhe a esconder.
- Listar o que subiu e o que caiu por estado antes de concluir; ela usa isso para decidir o post.
- Registrar o limite (7 dias de cada lado, arquivo do dia corrente incompleto).
- Se a checagem for para virar documento, o dado entra como secao propria com tabela e link do
  arquivo usado (`focos_diario_br_<data>.csv` no dataserver).
