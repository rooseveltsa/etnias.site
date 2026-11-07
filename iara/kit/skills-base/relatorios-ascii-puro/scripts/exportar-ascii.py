#!/usr/bin/env python3
"""exportar-ascii.py - Converte arquivo Markdown em texto ASCII puro.

Motivo: Vytorya pede relatorios/protocolos/estruturacao em texto puro
(sem acentos, cedilha, emojis, setas, travessoes) para colar em outra
IA (DeepSeek) ou em documento. Este conversor gera esse texto a partir
do Markdown original (skill/protocolo/relatorio).

Uso:
  python3 exportar-ascii.py <entrada.md> [<saida.txt>]

Sem <saida.txt> imprime na stdout; com <saida.txt> grava o arquivo.

Regras aplicadas:
- Remove o frontmatter YAML do topo (somente 1a e 2a linha '---').
- Remove acentos: NFD + descarta combining marks ('e'+acento -> 'e',
  'c'+cedilha -> 'c').
- Emojis viram marcadores legiveis: 'OK' -> [OK], 'AVISO' -> [AVISO],
  'ERRO' -> [ERRO]; demais emojis sao removidos.
- Setas/travessoes ('->', '—', '-', '-', '=>') viram hifen simples '-'.
- Tabelas Markdown viram registros de lista '- celula1 | celula2'
  (linha de cabecalho e separadores sao descartados).
- Saida garantida 100% ASCII (residuo nao-ASCII e descartado).
- Linhas dentro de ```fences``` passam intactas (so perdem acentos).

PITFALL validado em 09/09/2026:
- NAO tirar frontmatter com texto.split('---'): o corpo do arquivo usa
  '---' como separador de secao e o texto sai truncado. Cortar apenas
  a 1a e a 2a linha '---'.
"""
import sys
import re
import unicodedata

SUBST = {
    '✅': '[OK]', '⚠️': '[AVISO]', '⚠': '[AVISO]', '❌': '[ERRO]',
    '🧠': '', '📝': '',
    '→': '-', '—': '-', '–': '-', '·': '-', '•': '-', '⇒': '-',
}


def clean(line: str) -> str:
    line = unicodedata.normalize('NFD', line)
    line = ''.join(ch for ch in line if unicodedata.category(ch) != 'Mn')
    for k, v in SUBST.items():
        line = line.replace(k, v)
    line = ''.join(ch for ch in line if ord(ch) < 128)
    return re.sub(r' +', ' ', line).rstrip()


def converter(caminho: str) -> str:
    raw = open(caminho, encoding='utf-8').read()
    linhas = raw.split('\n')
    # remove so o frontmatter YAML do topo (1a e 2a linha '---')
    if linhas and linhas[0].strip() == '---':
        fim = next((i for i in range(1, len(linhas))
                    if linhas[i].strip() == '---'), None)
        if fim is not None:
            linhas = linhas[fim + 1:]

    out = []
    em_codigo = False
    em_tabela = False
    primeira_linha_tabela = False

    for ln in linhas:
        if ln.strip().startswith('```'):
            em_codigo = not em_codigo
            out.append('')
            continue
        t = ln.strip()

        # dentro de fence de codigo: so limpa, sem virar tabela
        if em_codigo:
            out.append(clean(ln))
            continue

        # tabela markdown -> registros de lista
        if t.startswith('|') and t.endswith('|'):
            if not em_tabela:
                em_tabela = True
                primeira_linha_tabela = True
            celulas = [clean(c).strip() for c in t.split('|')]
            celulas = [c for c in celulas if c != '']
            if not celulas or all(re.fullmatch(r':?-+:?', c) for c in celulas):
                continue  # separador de tabela
            if primeira_linha_tabela:
                primeira_linha_tabela = False
                continue  # descarta cabecalho
            out.append('- ' + ' | '.join(celulas))
            continue

        em_tabela = False
        primeira_linha_tabela = False
        c = clean(ln)
        if c.strip() == '':
            if out and out[-1] != '':
                out.append('')
        else:
            out.append(c)

    while out and out[0] == '':
        out.pop(0)
    while out and out[-1] == '':
        out.pop()
    return '\n'.join(out) + '\n'


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    texto = converter(sys.argv[1])
    if len(sys.argv) >= 3:
        open(sys.argv[2], 'w', encoding='utf-8').write(texto)
        print('Salvo em:', sys.argv[2])
        print('Bytes:', len(texto.encode('utf-8')))
    else:
        print(texto, end='')
