# Varredura de noticias e redes (relatorio ASCII de conjuntura)

Pedido tipico (29/10/2026): *"faca uma varredura profunda na web, Instagram,
Facebook, TikTok atras de informacoes sobre <tema> depois de <evento>"*. A
entrega e relatorio ASCII puro, com o conteudo completo no chat.

## Coleta

- `web_search` em 4-6 rodadas, cada uma mirando um angulo diferente: o fato
  geral, o caso que ela ja conhece, a resposta oficial (PF/MPF/ministerio), as
  redes, e o outro estado/regiao. Uma busca so devolve so a manchete repetida.
- Abrir 5-6 fontes de verdade: `defuddle parse "<url>" > /tmp/x.txt`.
- **O defuddle devolve HTML cru.** Limpar antes de ler, senao o arquivo vem numa
  linha so:

      python3 - <<'EOF'
      import re, glob
      from pathlib import Path
      for f in glob.glob("/tmp/varredura/*.txt"):
          t = Path(f).read_text(errors="ignore")
          t = re.sub(r"<script.*?</script>|<style.*?</style>", " ", t, flags=re.S)
          t = re.sub(r"<[^>]+>", " ", t)
          t = re.sub(r"[ \t]+", " ", t)
          t = re.sub(r"(?<=[.!?])\s+", "\n", t)
          Path(f.replace(".txt", ".limpo.txt")).write_text(t.strip())
      EOF

  `| head -N` em script que gera saida mata por SIGPIPE — redirecionar para
  arquivo e ler o arquivo.
- Pagina longa: `read_file` com `offset` para o resto, nunca confiar no resumo.
- Instagram/Facebook/TikTok por dentro exigem login: declarar isso nas LACUNAS
  em vez de inventar. O que da para pegar sem login: reel/post citado na
  imprensa, o texto da descricao que aparece no resultado de busca, e paginas
  `tiktok.com/discover/<termo>`.

## Estrutura que funcionou (13 secoes)

1. Cabecalho: data, escopo, recorte de datas, o que ficou de fora de proposito.
2. Resumo em 8 linhas (o que ela le se nao ler mais nada).
3. Caso a caso, agrupado por estado/regiao, com cidade, data e nome quando ha.
4. Redes sociais: padrao do que circulou (audio de WhatsApp + video curto de
   TikTok costuma ser o vetor real; perfil grande e palco de denuncia).
5. Numeros que importam (contagens, series historicas, hectares, mortos).
6. **CONFIRMADO x RUMOR** — secao obrigatoria em tema quente.
7. LACUNAS da varredura (o que nao foi possivel checar).
8. Fontes, listadas pelo nome do veiculo.

## Cuidado com tema politico quente

- Separar o que a autoridade disse do que a organizacao denunciou do que a
  imprensa apurou. Ex.: "assassinatos em Navirai" era denuncia da APIB, mas a PF
  classificou como briga de familia — as duas coisas vao no relatorio.
- Marcar checagem de fato quando existir (AFP Checamos, Aos Fatos).
- Nao somar denuncias de periodos diferentes como se fossem o mesmo surto.
- Procurar o contraponto (quem nega, quem contesta) — ela usa o relatorio para
  falar em publico e nao pode ser desmentida no detalhe.

## Entrega

ASCII puro (0 byte > 127, conferir com `scripts/verificar-ascii.py`), duas
copias (home + `/mnt/shared/MyFiles/Hermes/`) e **conteudo completo no chat**
entre cercas de codigo. Fechar com 2-3 achados que ela nao esperava e uma oferta
concreta (ex.: varrer hashtags por dentro, que exige o login dela).
