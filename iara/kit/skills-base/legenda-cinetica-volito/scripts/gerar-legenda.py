#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""gerar-legenda.py — audio -> words.json para legenda cinetica no Volito.

Saida principal: [{"w": "palavra", "s": 1.24, "e": 1.61}, ...]
e, opcionalmente, um SRT e um agrupamento em blocos para conferencia.

Rode com o venv do whisper (faster-whisper NAO esta no python do sistema):

    ~/.venvs/whisper/bin/python gerar-legenda.py --audio fala.wav --language pt \
        --out words.json --srt fala.srt --blocos 3

Converter transcricao que ja existe (nao roda Whisper):

    ~/.venvs/whisper/bin/python gerar-legenda.py --words fala.srt --out words.json
"""

import argparse
import json
import os
import re
import sys

PONTUACAO = '.,!?;:"\u201c\u201d\'()[]{}|\u2014\u2013-*_~\u2026'
VAZIAS = {"", "-", "\u2014", "\u2013"}


def limpar(tok: str) -> str:
    """Tira pontuacao das pontas, preserva acento e hifen/apostrofo interno."""
    t = tok.strip()
    t = t.strip(PONTUACAO + " ")
    t = re.sub(r"^[^\w\u00c0-\u024f]+|[^\w\u00c0-\u024f]+$", "", t)
    return t.strip()


def normalizar(words, minusc: bool, offset: float):
    """Ordena, remove invalidas/vazias e deixa o tempo monotonico.

    Guarda `fim` (a palavra fecha frase) para o agrupamento em blocos — esse
    campo NAO vai para o words.json, que e estrito [{w,s,e}].
    """
    saida = []
    anterior = 0.0
    for w in words:
        bruto = str(w.get("w", "")).strip()
        tok = limpar(bruto)
        if tok in VAZIAS or not tok:
            continue
        s = float(w.get("s", 0.0)) + offset
        e = float(w.get("e", s + 0.2)) + offset
        if e <= s:
            e = s + 0.18
        if s < anterior:
            s = anterior
        if e < s:
            e = s + 0.18
        anterior = e
        saida.append({
            "w": tok.lower() if minusc else tok,
            "s": round(s, 3),
            "e": round(e, 3),
            "fim": bool(bruto) and bruto[-1] in '.!?\u2026;:',
        })
    return saida


def repartir(texto, ini, fim):
    """Sem tempo por palavra: divide o tempo do trecho por tamanho de palavra."""
    tokens = [t for t in texto.split() if limpar(t)]
    if not tokens:
        return []
    total = sum(len(limpar(t)) + 1 for t in tokens)
    dur = max(fim - ini, 0.05)
    out, acc = [], 0.0
    for t in tokens:
        frac = (len(limpar(t)) + 1) / total
        s = ini + acc * dur
        acc += frac
        # guarda o token BRUTO: a pontuacao final e o sinal de fim de frase
        out.append({"w": t, "s": s, "e": ini + acc * dur})
    return out


def ler_srt(caminho: str):
    with open(caminho, encoding="utf-8-sig") as f:
        txt = f.read()
    words = []
    for bloco in re.split(r"\n\s*\n", txt.replace("\r\n", "\n")):
        linhas = [l.strip() for l in bloco.split("\n") if l.strip()]
        if not linhas:
            continue
        idx_tempo = next((i for i, l in enumerate(linhas) if "-->" in l), None)
        if idx_tempo is None:
            continue
        m = re.match(
            r"(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})\s*-->\s*(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})",
            linhas[idx_tempo],
        )
        if not m:
            continue
        g = [int(x) for x in m.groups()]
        ini = g[0] * 3600 + g[1] * 60 + g[2] + g[3] / 1000.0
        fim = g[4] * 3600 + g[5] * 60 + g[6] + g[7] / 1000.0
        texto = " ".join(linhas[idx_tempo + 1:])
        words.extend(repartir(texto, ini, fim))
    return words


def ler_json(caminho: str):
    with open(caminho, encoding="utf-8") as f:
        d = json.load(f)
    if isinstance(d, list):
        achatar = []
        for item in d:
            if isinstance(item, dict) and ("w" in item or "word" in item):
                achatar.append(palavra_de(item))
            elif isinstance(item, dict):
                achatar.extend(repartir(item.get("text", ""), item.get("start", 0.0), item.get("end", 0.0)))
        return achatar
    if isinstance(d, dict):
        if isinstance(d.get("words"), list):
            return [palavra_de(x) for x in d["words"]]
        out = []
        for seg in d.get("segments", []):
            if isinstance(seg.get("words"), list) and seg["words"]:
                out.extend(palavra_de(x) for x in seg["words"])
            else:
                out.extend(repartir(seg.get("text", ""), seg.get("start", 0.0), seg.get("end", 0.0)))
        return out
    raise SystemExit("JSON nao reconhecido: esperava lista [{w,s,e}] ou Whisper JSON com 'segments'")


def palavra_de(obj: dict) -> dict:
    return {
        "w": obj.get("w", obj.get("word", "")),
        "s": obj.get("s", obj.get("start", 0.0)),
        "e": obj.get("e", obj.get("end", 0.0)),
    }


def transcrever(audio: str, modelo: str, idioma: str):
    try:
        from faster_whisper import WhisperModel
    except ModuleNotFoundError:
        sys.exit(
            "faster-whisper ausente neste python.\n"
            "Rode com: ~/.venvs/whisper/bin/python " + os.path.abspath(__file__) + " ...\n"
            "ou passe --words <json|srt> com uma transcricao pronta."
        )
    if not os.path.isfile(audio):
        sys.exit("audio nao encontrado: " + audio)
    print("[1/3] carregando modelo", modelo, "(cpu, int8) ...", flush=True)
    m = WhisperModel(modelo, device="cpu", compute_type="int8")
    print("[2/3] transcrevendo com tempo por palavra ...", flush=True)
    segs, info = m.transcribe(
        audio,
        language=idioma,
        word_timestamps=True,
        vad_filter=True,
        beam_size=5,
        condition_on_previous_text=False,
    )
    out = []
    for seg in segs:
        for w in seg.words or []:
            out.append({"w": w.word, "s": w.start, "e": w.end})
    print("[3/3] %d palavras (audio ~%.2fs, idioma %s)" % (len(out), info.duration, info.language), flush=True)
    return out


def juntar(words, regras):
    """Junta sequencias de tokens ('Cento e DS' -> '110'), mantendo o tempo total."""
    if not regras:
        return words
    out = list(words)
    for seq, novo in regras:
        alvo = [limpar(t).lower() for t in seq.split()]
        if not alvo:
            continue
        i = 0
        while i <= len(out) - len(alvo):
            janela = [limpar(out[i + j]["w"]).lower() for j in range(len(alvo))]
            if janela == alvo:
                primeiro, ultimo = out[i], out[i + len(alvo) - 1]
                out[i:i + len(alvo)] = [{
                    "w": novo, "s": primeiro["s"], "e": ultimo["e"],
                    "fim": ultimo.get("fim", False),
                }]
            i += 1
    return out


def corrigir(words, mapa):
    """Troca um token por outro (mesmo tempo): 'DOP' -> 'drop'."""
    if not mapa:
        return words
    for w in words:
        chave = limpar(str(w["w"])).lower()
        if chave in mapa:
            w["w"] = mapa[chave]
    return words


def agrupar(words, max_palavras: int, max_chars: int, pausa: float = 0.35):
    """Blocos por contagem, largura e PAUSA: silencio maior que `pausa` fecha o bloco."""
    blocos, atual = [], []
    for i, w in enumerate(words):
        tentativa = atual + [w]
        texto = " ".join(x["w"] for x in tentativa)
        silencio = (w["s"] - words[i - 1]["e"]) if i else 0.0
        fechaFrase = bool(i and words[i - 1].get("fim"))
        fecha = atual and (len(tentativa) > max_palavras or len(texto) > max_chars
                           or silencio > pausa or fechaFrase)
        if fecha:
            blocos.append(atual)
            atual = [w]
        else:
            atual = tentativa
    if atual:
        blocos.append(atual)
    return [
        {
            "i": i,
            "texto": " ".join(x["w"] for x in b),
            "s": b[0]["s"],
            "e": b[-1]["e"],
            "palavras": b,
        }
        for i, b in enumerate(blocos)
    ]


def srt_de(blocos):
    def ts(t):
        ms = int(round(t * 1000))
        h, ms = divmod(ms, 3600000)
        m, ms = divmod(ms, 60000)
        s, ms = divmod(ms, 1000)
        return "%02d:%02d:%02d,%03d" % (h, m, s, ms)

    linhas = []
    for n, b in enumerate(blocos, 1):
        linhas.append(str(n))
        linhas.append("%s --> %s" % (ts(b["s"]), ts(b["e"])))
        linhas.append(b["texto"])
        linhas.append("")
    return "\n".join(linhas).rstrip() + "\n"


def parse_mapa(txt: str):
    """'DOP=drop; Causa=calças' -> {'dop': 'drop', 'causa': 'calças'}"""
    mapa = {}
    if not txt:
        return mapa
    for par in txt.split(";"):
        par = par.strip()
        if not par or "=" not in par:
            continue
        de, para = par.split("=", 1)
        chave = limpar(de).lower()
        if chave:
            mapa[chave] = para.strip()
    return mapa


def parse_seq(txt: str):
    """'Cento e DS=110' -> [('Cento e DS', '110')]"""
    regras = []
    if not txt:
        return regras
    for par in txt.split(";"):
        par = par.strip()
        if not par or "=" not in par:
            continue
        seq, novo = par.split("=", 1)
        if seq.strip():
            regras.append((seq.strip(), novo.strip()))
    return regras


def main():
    p = argparse.ArgumentParser(description="audio -> words.json para legenda cinetica no Volito")
    p.add_argument("--audio", help="audio de entrada (wav, mp3, m4a...)")
    p.add_argument("--words", help="transcricao pronta: .json (lista ou Whisper) ou .srt/.vtt")
    p.add_argument("--language", default="pt", help="idioma (padrao pt)")
    p.add_argument("--model", default="small", help="modelo faster-whisper (padrao small; base e mais rapido)")
    p.add_argument("--offset", type=float, default=0.0, help="segundos somados a todos os tempos")
    p.add_argument("--minusc", action="store_true", help="caixa baixa em w")
    p.add_argument("--blocos", type=int, default=3, help="palavras por bloco (padrao 3)")
    p.add_argument("--max-caracteres", type=int, default=22, help="teto de caracteres por bloco (padrao 22)")
    p.add_argument("--pausa", type=float, default=0.30, help="silencio em segundos que fecha o bloco (padrao 0.30)")
    p.add_argument("--corrigir", default="", help="troca token errado: \"DOP=drop; Causa=calças\"")
    p.add_argument("--juntar", default="", help="junta sequencia errada: \"Cento e DS=110\"")
    p.add_argument("--out", default="words.json", help="saida words.json")
    p.add_argument("--srt", help="tambem escrever SRT dos blocos")
    p.add_argument("--blocos-json", help="tambem escrever blocos.json (conferencia)")
    a = p.parse_args()

    if not a.audio and not a.words:
        p.error("informe --audio ou --words")

    if a.words:
        ext = os.path.splitext(a.words)[1].lower()
        print("[1/1] lendo", a.words, flush=True)
        brutas = ler_json(a.words) if ext == ".json" else ler_srt(a.words)
    else:
        brutas = transcrever(a.audio, a.model, a.language)

    words = normalizar(brutas, a.minusc, a.offset)
    words = juntar(words, parse_seq(a.juntar))
    words = corrigir(words, parse_mapa(a.corrigir))
    if not words:
        sys.exit("nenhuma palavra valida extraida — confira audio/transcricao")

    blocos = agrupar(words, a.blocos, a.max_caracteres, a.pausa)

    with open(a.out, "w", encoding="utf-8") as f:
        json.dump([{"w": w["w"], "s": w["s"], "e": w["e"]} for w in words], f, ensure_ascii=False, indent=0)
    print("words.json ->", a.out, "(%d palavras, %d blocos)" % (len(words), len(blocos)))

    if a.srt:
        with open(a.srt, "w", encoding="utf-8") as f:
            f.write(srt_de(blocos))
        print("srt ->", a.srt)

    if a.blocos_json:
        with open(a.blocos_json, "w", encoding="utf-8") as f:
            json.dump(blocos, f, ensure_ascii=False, indent=1)
        print("blocos ->", a.blocos_json)

    dur = words[-1]["e"]
    vazios = [i for i, b in enumerate(blocos) if not b["texto"].strip()]
    print("duracao falada: %.2fs | primeira: '%s' @%.2fs | ultima: '%s' @%.2fs"
          % (dur, words[0]["w"], words[0]["s"], words[-1]["w"], words[-1]["s"]))
    if vazios:
        print("ATENCAO: blocos vazios:", vazios, file=sys.stderr)
    if any(b["e"] - b["s"] > 4.0 for b in blocos):
        print("ATENCAO: algum bloco passa de 4s na tela — reduza --blocos ou revise a transcricao", file=sys.stderr)


if __name__ == "__main__":
    main()
