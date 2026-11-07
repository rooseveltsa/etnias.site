# Varredura de noticias (web + redes) e entrega em PDF

Receita medida em 29/10/2026 na varredura "ataques aos povos indigenas depois do 2o
turno". Serve para qualquer pedido de "faca uma varredura profunda na web, Instagram,
Facebook, TikTok atras de X".

## 1. Coleta

1. `web_search` em pt-BR, **varias rodadas, uma por frente**. A primeira rodada da o
   eixo (quem denunciou, qual orgao investiga); as seguintes abrem caso, lugar e dado.
   Rodadas que funcionaram: (a) tema + "apos o segundo turno"; (b) o nome da entidade
   que denunciou + o fato especifico; (c) assassinatos/atropelamentos + estado;
   (d) "outros estados" / o caso que apareceu de raspao; (e) redes sociais.
2. Abrir 4-6 materiais com `defuddle parse <URL> > /tmp/varredura/<hash>.txt`
   (`web_extract` esta fora). O HTML vem numa linha so — converter antes de ler:

   ```python
   import re, glob
   from pathlib import Path
   for f in glob.glob("*.txt"):
       t = Path(f).read_text(errors="ignore")
       t = re.sub(r"<script.*?</script>|<style.*?</style>", " ", t, flags=re.S)
       t = re.sub(r"<[^>]+>", " ", t)
       t = re.sub(r"[ \t]+", " ", t)
       t = re.sub(r"(?<=[.!?])\s+", "\n", t)      # uma frase por linha
       Path(f.replace(".txt", ".limpo.txt")).write_text(t.strip())
   ```

3. Priorizar a fonte que traz NUMERO e LUGAR (agencia publica, MPF, CIMI, APIB) sobre
   a que so repercutiu o post.

## 2. Instagram / Facebook / TikTok

Sem login nao se varre por dentro. O que da certo:

- o que a imprensa e as organizacoes CITARAM (perfil, data, curtidas, comentario);
- o que aparece em busca publica (reel, video do TikTok com legenda);
- declarar isso na secao LACUNAS, com o nome das hashtags que ficaram por varrer, e
  oferecer uma segunda passada com o login dela.

Nunca escrever "nao ha nada nas redes" quando so nao foi possivel entrar.

## 3. Estrutura do relatorio

A secao que deu valor ao documento foi **"o que esta confirmado x o que e rumor"**:
o "assassinato em Navirai" tinha sido classificado pelas autoridades como briga de
familia e as fotos circulavam adulteradas; um video sobre prefeito foi marcado como
enganoso pela AFP Checamos. Sem essa separacao o relatorio repete boato como fato.

Ordem que funcionou: cabecalho (data, escopo, recorte) / resumo em 8 linhas / um bloco
por estado-caso / redes sociais / numeros que importam / confirmado x rumor / lacunas /
fontes. Rodape `FIM`.

## 4. Entrega em PDF (quando ela pede "mande em outro formato, PDF")

Nesta maquina NAO ha `pandoc`, `wkhtmltopdf`, `libreoffice` nem `reportlab`/`fpdf`.
O caminho que funciona e o **Chromium headless**:

```bash
chromium --headless=new --disable-gpu --no-sandbox --no-pdf-header-footer \
  --user-data-dir=/tmp/chrome-pdf \
  --print-to-pdf=/tmp/relatorio.pdf file:///tmp/relatorio.html
```

- `--user-data-dir` separado e **obrigatorio**: a janela do Chromium dela roda com CDP
  em 9222 e nao pode ser tocada.
- HTML minimo: `<pre>` com `white-space: pre-wrap` e fonte monoespacada 9.2 pt, `@page
  A4` com margens ~16/14 mm. Preserva o alinhamento do ASCII e nao precisa converter
  acento (PDF nao corrompe).
- Conferir: contar paginas no PDF e olhar a primeira pagina.

  ```python
  d = open("/tmp/relatorio.pdf","rb").read()
  print("paginas:", d.count(b"/Type /Page") - d.count(b"/Type /Pages"))
  ```

  ```bash
  chromium --headless=new --disable-gpu --no-sandbox --user-data-dir=/tmp/chrome-pdf \
    --window-size=900,1270 --screenshot=/tmp/preview.png file:///tmp/relatorio.html
  ```

  Anexar a previa na visao antes de entregar (margens, corte lateral, linha decorativa).
- Salvar as duas copias, como sempre: pasta de relatorios da home + `/mnt/shared/MyFiles/Hermes/`,
  e entregar por `MEDIA:<caminho.pdf>`.
- O PDF e ADICIONAL: o `.txt` ASCII continua sendo o arquivo para colar em outra IA.
