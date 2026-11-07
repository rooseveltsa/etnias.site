#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""revisar.py — parecer editorial de uma peca, em 5 eixos. Local, sem rede.

Eixos: ortografia/gramatica · fonte · brand pack · CTA · tom.
Cada eixo devolve status ok|alerta|falha. Qualquer `falha` bloqueia a publicacao.

    revisar.py --peca-id nota-01 --tipo noticia --texto "Titulo. Corpo. Fonte: Agencia X"
    revisar.py --peca-id card-01 --tipo card --texto-file /tmp/card.txt \
               --brand-pack ~/.hermes/assets/etnios/brand.json
    revisar.py --consultar
    revisar.py --limpar --peca-id nota-01

Exit: 0 parecer gerado (inclusive quando bloqueado) | 2 entrada invalida |
      3 revisoes.json ilegivel | 4 brand pack ilegivel
"""
import argparse
import json
import os
import re
import sys
import uuid
from datetime import datetime

BASE = os.path.expanduser("~/.hermes/iara-data")
REVISOES = os.path.join(BASE, "revisoes.json")
TIPOS = ("noticia", "card", "carrossel", "video", "institucional")

# ---------------------------------------------------------------- ortografia
# Lista curada de erros comuns em pt-BR. Nao e corretor: e o que mais aparece
# em texto de rede social. Cada regra = (regex, explicacao).
ERROS_COMUNS = [
    (r"\ba\s+(dois|duas|três|tres|quatro|cinco|\d+)\s+(anos|meses|dias|semanas|horas)\b",
     "tempo decorrido pede 'há': 'há dois anos' (verbo haver, impessoal)"),
    (r"\bfazem\s+(dois|duas|três|tres|\d+)\s+(anos|meses|dias)\b",
     "'fazer' indicando tempo e impessoal: 'faz dois anos'"),
    (r"\bhouveram\s+(problemas|denúncias|denuncias|casos|relatos)\b",
     "'haver' no sentido de existir e impessoal: 'houve problemas'"),
    (r"\bas\s+vezes\b", "'às vezes' leva crase"),
    (r"\ba\s+vista\b(?!\s+de)", "'à vista' leva crase"),
    (r"\ba\s+medida\s+que\b", "'à medida que' leva crase"),
    (r"\bdevido\s+a\s+(que|o fato)\b", "use 'devido ao fato de' ou 'porque'"),
    (r"\ba\s+nível\s+de\b", "use 'em nível de' ou reescreva"),
    (r"\bmais\s+(eu|ele|ela|eles|elas|nós)\b", "oposição pede 'mas', não 'mais'"),
    (r"\bmenas\b", "'menos' é invariável"),
    (r"\b(eles|elas)\s+tem\b(?!\s+que)", "concordância: 'eles têm'"),
    (r"\b(eles|elas)\s+vem\b(?!\s+de)", "concordância: 'eles vêm'"),
    (r"\bpreciso\s+de\s+se\b", "evite 'preciso de se': use 'é preciso'"),
    (r"\bfazer\s+com\s+que\b", "prefira 'fazer que' ou reescreva a oração"),
    (r"\bde\s+encontro\s+a\b", "'de encontro a' significa oposição; para concordar use 'ao encontro de'"),
    (r"\bapesar\s+de\s+que\b", "use 'apesar de' ou 'embora'"),
    (r"\bonde\s+(vamos|iremos|foi)\b", "movimento pede 'aonde'"),
    (r"\bimprimido\b", "particípio irregular: 'impresso'"),
]

CTA_VERBOS = ("saiba", "acesse", "confira", "cadastre", "inscreva", "participe",
              "compartilhe", "siga", "leia", "veja", "conheça", "conheca", "apoie",
              "doe", "venha", "baixe", "assista", "ouça", "ouca", "clique", "garanta")

FONTE_ROTULO = re.compile(r"^\s*(fonte|veiculo|veículo|veículo)\s*:", re.I | re.M)
URL_RE = re.compile(r"https?://[^\s)>\]\"']+")

AGRESSIVOS = ("idiota", "burro", "burra", "imbecil", "vagabundo", "vagabunda",
              "lixo humano", "verme", "vermes", "canalha", "canalhas", "covarde",
              "covardes", "mentiroso", "mentirosos", "escória", "escoria", "odeio",
              "nojento", "nojenta", "cretino", "otário", "otario", "safado",
              "bandido", "bandidos", "pilantra", "desgraçado", "desgracado",
              "morte aos", "tem que morrer", "acabar com eles")

INFORMAIS = ("vc", "vcs", "pq", "tbm", "tá", "ta ", "né", "ne ", "kkk", "haha",
             "galera", "bora", "mano", "tipo assim", "demais", "muito bom",
             "topzera", "rolê", "role ")

FORMAIS = ("portanto", "destarte", "cumpre ressaltar", "convém", "conforme",
           "mediante", "por conseguinte", "outrossim", "prezado", "atenciosamente",
           "vossa", "supracitado", "doravante")


def agora():
    return datetime.now().astimezone().isoformat(timespec="seconds")


def carregar():
    if not os.path.exists(REVISOES):
        return []
    try:
        d = json.load(open(REVISOES, encoding="utf-8"))
    except json.JSONDecodeError as exc:
        print(json.dumps({"ok": False, "erro": "revisoes.json ilegivel (%s): nao "
                           "sobrescrevo historico" % exc}, ensure_ascii=False))
        sys.exit(3)
    if not isinstance(d, list):
        print(json.dumps({"ok": False, "erro": "revisoes.json nao e lista"}))
        sys.exit(3)
    return d


def gravar(lista):
    os.makedirs(BASE, exist_ok=True)
    tmp = REVISOES + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(lista, f, ensure_ascii=False, indent=2)
        f.write("\n")
    os.chmod(tmp, 0o600)
    os.replace(tmp, REVISOES)


# --------------------------------------------------------------------- eixos
def eixo_ortografia(texto):
    achados = []
    for padrao, explicacao in ERROS_COMUNS:
        for m in re.finditer(padrao, texto, re.I):
            trecho = texto[max(0, m.start() - 25):m.end() + 25].replace("\n", " ")
            achados.append({"trecho": trecho.strip(), "problema": explicacao})
    if not achados:
        return {"status": "ok", "comentario": "nenhum erro comum da lista encontrado",
                "achados": []}
    status = "falha" if len(achados) >= 3 else "alerta"
    return {"status": status,
            "comentario": "%d ocorrencia(s) de erro comum de pt-BR" % len(achados),
            "achados": achados}


def eixo_fonte(texto, tipo):
    tem_rotulo = bool(FONTE_ROTULO.search(texto))
    tem_url = bool(URL_RE.search(texto))
    if tipo != "noticia":
        return {"status": "ok", "comentario": "fonte nao exigida para tipo '%s'" % tipo,
                "tem_rotulo": tem_rotulo, "tem_url": tem_url}
    if tem_rotulo:
        return {"status": "ok", "comentario": "fonte identificada no texto",
                "tem_rotulo": True, "tem_url": tem_url}
    if tem_url:
        return {"status": "falha",
                "comentario": "URL presente, mas sem rotulo 'Fonte:' ou 'Veiculo:' — "
                              "noticia precisa dizer de onde veio",
                "tem_rotulo": False, "tem_url": True}
    return {"status": "falha",
            "comentario": "noticia sem fonte: incluir 'Fonte:' ou 'Veiculo:'",
            "tem_rotulo": False, "tem_url": False}


def ler_brand_pack(caminho):
    dados = json.load(open(caminho, encoding="utf-8"))
    cores = (dados.get("cores") or dados.get("paleta") or dados.get("colors")
             or (dados.get("brand") or {}).get("colors") or [])
    fontes = (dados.get("fontes") or dados.get("fonts")
              or (dados.get("brand") or {}).get("fonts") or [])
    return [str(c) for c in cores], [str(f) for f in fontes]


def eixo_brand(texto, caminho):
    if not caminho:
        return {"status": "alerta",
                "comentario": "brand pack nao informado: cor e fonte nao foram "
                              "conferidas (info so existe se --brand-pack for passado)"}
    cores, fontes = ler_brand_pack(caminho)
    if not cores and not fontes:
        return {"status": "alerta",
                "comentario": "brand pack sem 'cores'/'fontes' legiveis: nada a conferir",
                "esperado": {"cores": [], "fontes": []}}
    alvo = texto.lower()
    achou_cores = [c for c in cores if c.lower() in alvo]
    achou_fontes = [f for f in fontes if f.lower() in alvo]
    if achou_cores or achou_fontes:
        return {"status": "ok",
                "comentario": "texto referencia %d cor(es) e %d fonte(s) do brand pack"
                              % (len(achou_cores), len(achou_fontes)),
                "achou_cores": achou_cores, "achou_fontes": achou_fontes,
                "esperado": {"cores": cores, "fontes": fontes}}
    return {"status": "alerta",
            "comentario": "brand pack informado, mas o texto nao cita nenhuma cor/fonte "
                          "esperada — confira visualmente antes de publicar",
            "achou_cores": [], "achou_fontes": [],
            "esperado": {"cores": cores, "fontes": fontes}}


def eixo_cta(texto, tipo):
    if tipo not in ("card", "carrossel"):
        return {"status": "ok", "comentario": "CTA nao exigido para tipo '%s'" % tipo}
    baixo = texto.lower()
    achados = [v for v in CTA_VERBOS if re.search(r"\b" + re.escape(v) + r"\b", baixo)]
    if achados:
        return {"status": "ok", "comentario": "CTA presente: " + ", ".join(achados[:4]),
                "verbos": achados}
    return {"status": "alerta",
            "comentario": "sem CTA: peca de %s pede verbo no imperativo "
                          "(saiba, acesse, confira, cadastre-se...)" % tipo,
            "verbos": []}


def _marca(marcadores, texto_baixo):
    """Marcador so conta como PALAVRA inteira.

    Substring simples gerou falso positivo medido: "ta " casava dentro de
    "trinta vagas". Toda comparacao aqui e por \\b.
    """
    achados = []
    for m in marcadores:
        alvo = m.strip()
        if not alvo:
            continue
        if re.search(r"\b" + re.escape(alvo) + r"\b", texto_baixo):
            achados.append(alvo)
    return achados


def eixo_tom(texto):
    baixo = texto.lower()
    agressivos = _marca(AGRESSIVOS, baixo)
    informais = _marca(INFORMAIS, baixo)
    formais = _marca(FORMAIS, baixo)

    if agressivos:
        return {"status": "falha",
                "comentario": "tom agressivo (%s): ofensa/ataque nao passa na revisao"
                              % ", ".join(sorted(set(agressivos))[:3]),
                "classificacao": "agressivo", "marcadores": sorted(set(agressivos))}
    if len(formais) >= 2:
        return {"status": "ok", "comentario": "tom formal consistente",
                "classificacao": "formal", "marcadores": sorted(formais)}
    if len(informais) >= 2:
        return {"status": "alerta",
                "comentario": "tom informal (%s): conferir se combina com o canal"
                              % ", ".join(sorted(set(informais))[:3]),
                "classificacao": "informal", "marcadores": sorted(set(informais))}
    if informais:
        return {"status": "ok",
                "comentario": "tom levemente informal, sem excesso",
                "classificacao": "informal", "marcadores": sorted(informais)}
    return {"status": "ok", "comentario": "tom institucional neutro",
            "classificacao": "institucional", "marcadores": []}


def _institucional_mod():
    """Importa o modulo do iara-institucional; None quando o kit esta incompleto."""
    script_dir = os.path.expanduser("~/.hermes/skills/iara-institucional/scripts")
    if not os.path.exists(os.path.join(script_dir, "institucional.py")):
        return None
    if script_dir not in sys.path:
        sys.path.insert(0, script_dir)
    try:
        import institucional  # noqa: F401
        return institucional
    except Exception:
        return None


def eixo_institucional(texto, peca_id):
    """6o eixo: a peca e posicionamento institucional?

    NAO bloqueia aqui — bloqueio e na aprovacao, via adapter. Este eixo so
    levanta a bandeira para o parecer e deixa o rastro no iara-institucional.
    """
    mod = _institucional_mod()
    if mod is None:
        return {"status": "alerta", "requer_aprovador_institucional": False,
                "institucional": None,
                "comentario": "iara-institucional ausente: tema institucional NAO foi "
                              "verificado (instale a skill para fechar o buraco)"}
    try:
        r = mod.cmd_classificar(peca_id, texto)
    except Exception as exc:
        return {"status": "alerta", "requer_aprovador_institucional": False,
                "institucional": None,
                "comentario": "iara-institucional falhou (%s): tratar como nao "
                              "verificado" % str(exc)[:80]}
    institucional = bool(r.get("institucional"))
    if not institucional:
        return {"status": "ok", "institucional": False,
                "requer_aprovador_institucional": False,
                "comentario": "sem sinal institucional no texto"}
    requer = not r.get("aprovador_institucional")
    return {"status": "alerta", "institucional": True,
            "requer_aprovador_institucional": requer,
            "categorias": r.get("categorias"),
            "aprovador_institucional": r.get("aprovador_institucional"),
            "comentario": ("peca institucional (%s): exige aprovador institucional "
                           "nominal antes de publicar" % ", ".join(r.get("categorias") or []))
                          if requer else
                          ("peca institucional (%s), ja com aprovador institucional %r"
                           % (", ".join(r.get("categorias") or []),
                              r.get("aprovador_institucional")))}


def revisar(peca_id, texto, tipo, brand_pack):
    parecer = {
        "ortografia": eixo_ortografia(texto),
        "fonte": eixo_fonte(texto, tipo),
        "brand_pack": eixo_brand(texto, brand_pack),
        "cta": eixo_cta(texto, tipo),
        "tom": eixo_tom(texto),
        "institucional": eixo_institucional(texto, peca_id),
    }
    falhas = [k for k, v in parecer.items() if v["status"] == "falha"]
    alertas = [k for k, v in parecer.items() if v["status"] == "alerta"]
    return {
        "id": str(uuid.uuid4()),
        "peca_id": peca_id,
        "tipo": tipo,
        "parecer": parecer,
        "falhas": falhas,
        "alertas": alertas,
        "bloqueado": bool(falhas),
        "aprovado": not falhas,
        "requer_aprovador_institucional": bool(
            parecer["institucional"].get("requer_aprovador_institucional")),
        "resumo": ("bloqueado por: " + ", ".join(falhas)) if falhas
                  else ("aprovado com alerta em: " + ", ".join(alertas) if alertas
                        else "aprovado sem ressalva"),
        "criado_em": agora(),
    }


def main():
    ap = argparse.ArgumentParser(description="parecer editorial da IAra (sem rede)")
    ap.add_argument("--peca-id", default="")
    ap.add_argument("--texto", default="")
    ap.add_argument("--texto-file", default="")
    ap.add_argument("--tipo", default="institucional", choices=TIPOS)
    ap.add_argument("--brand-pack", default=None)
    ap.add_argument("--consultar", action="store_true")
    ap.add_argument("--limpar", action="store_true")
    a = ap.parse_args()

    if a.consultar:
        lista = carregar()
        print(json.dumps({"total": len(lista),
                          "revisoes": [{"id": r["id"], "peca_id": r["peca_id"],
                                        "tipo": r["tipo"], "aprovado": r["aprovado"],
                                        "bloqueado": r["bloqueado"],
                                        "falhas": r.get("falhas"),
                                        "alertas": r.get("alertas")} for r in lista]},
                         indent=2, ensure_ascii=False))
        return 0

    if a.limpar:
        if not a.peca_id:
            print(json.dumps({"erro": "--limpar exige --peca-id"}, ensure_ascii=False))
            return 2
        lista = carregar()
        antes = len(lista)
        ficaram = [r for r in lista if r["peca_id"] != a.peca_id]
        gravar(ficaram)
        print(json.dumps({"dry_run": False, "peca_id": a.peca_id, "antes": antes,
                          "depois": len(ficaram), "removidos": antes - len(ficaram)},
                         ensure_ascii=False))
        return 0

    if not a.peca_id:
        print(json.dumps({"erro": "--peca-id obrigatorio"}, ensure_ascii=False))
        return 2
    if a.texto_file:
        if not os.path.exists(a.texto_file):
            print(json.dumps({"erro": "arquivo nao encontrado: %s" % a.texto_file},
                             ensure_ascii=False))
            return 2
        texto = open(a.texto_file, encoding="utf-8", errors="replace").read()
    elif a.texto:
        texto = a.texto
    else:
        print(json.dumps({"erro": "informe --texto ou --texto-file"}, ensure_ascii=False))
        return 2
    if not texto.strip():
        print(json.dumps({"erro": "texto vazio: nada a revisar"}, ensure_ascii=False))
        return 2

    if a.brand_pack and not os.path.exists(a.brand_pack):
        print(json.dumps({"erro": "brand pack nao encontrado: %s" % a.brand_pack},
                         ensure_ascii=False))
        return 4
    if a.brand_pack:
        try:
            ler_brand_pack(a.brand_pack)
        except (json.JSONDecodeError, OSError) as exc:
            print(json.dumps({"erro": "brand pack ilegivel: %s" % exc}, ensure_ascii=False))
            return 4

    r = revisar(a.peca_id, texto, a.tipo, a.brand_pack)
    lista = carregar()
    lista.append(r)
    gravar(lista)
    print(json.dumps({"ok": True, "revisao": r, "total_revisoes": len(lista)},
                     indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
