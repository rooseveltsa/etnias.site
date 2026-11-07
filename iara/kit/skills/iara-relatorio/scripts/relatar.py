#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""relatar.py — relatorio de publicacoes/metricas a partir dos JSONs locais.

So LE ~/.hermes/iara-data/{publicacoes,metricas,aprovacoes,calendario}.json
e escreve em ~/.hermes/iara-data/relatorios.json (acrescenta; nunca substitui).

    relatar.py --periodo 2026-11
    relatar.py --de 2026-11-01 --ate 2026-11-30
    relatar.py --consultar
    relatar.py --limpar --periodo 2026-11      # so teste

Regra de ouro: numero que nao existe vira "sem dado", nao vira zero inventado.
Sem rede, sem credencial.
"""
import argparse
import json
import os
import sys
import uuid
from datetime import datetime

BASE = os.path.expanduser("~/.hermes/iara-data")
ARQUIVOS = {
    "publicacoes": os.path.join(BASE, "publicacoes.json"),
    "metricas": os.path.join(BASE, "metricas.json"),
    "aprovacoes": os.path.join(BASE, "aprovacoes.json"),
    "calendario": os.path.join(BASE, "calendario.json"),
}
RELATORIOS = os.path.join(BASE, "relatorios.json")

SEM_DADO = "sem dado"

ACENTOS = str.maketrans(
    "áàâãäåéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÅÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ",
    "aaaaaaeeeeiiiiooooouuuucnaaaaaaeeeeiiiiooooouuuucn")


def ascii_puro(texto):
    """Relatorio dela e ASCII puro: acento e pontuacao tipografica fora."""
    texto = texto.translate(ACENTOS)
    for de, para in (("—", "-"), ("–", "-"), ("…", "..."), ("“", '"'),
                     ("”", '"'), ("‘", "'"), ("’", "'"), ("•", "-"),
                     ("º", "o"), ("ª", "a")):
        texto = texto.replace(de, para)
    return texto


def agora():
    return datetime.now().astimezone().isoformat(timespec="seconds")


def carregar(nome):
    caminho = ARQUIVOS[nome]
    if not os.path.exists(caminho):
        return []
    try:
        d = json.load(open(caminho, encoding="utf-8"))
    except json.JSONDecodeError:
        print(json.dumps({"erro": "%s ilegivel: nao leio pela metade" % nome},
                         ensure_ascii=False))
        sys.exit(3)
    return d if isinstance(d, list) else []


def carregar_relatorios():
    if not os.path.exists(RELATORIOS):
        return []
    try:
        d = json.load(open(RELATORIOS, encoding="utf-8"))
    except json.JSONDecodeError as exc:
        print(json.dumps({"erro": "relatorios.json ilegivel (%s): nao sobrescrevo "
                                  "historico" % exc}, ensure_ascii=False))
        sys.exit(3)
    return d if isinstance(d, list) else []


def gravar_relatorios(lista):
    tmp = RELATORIOS + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(lista, f, ensure_ascii=False, indent=2)
        f.write("\n")
    os.chmod(tmp, 0o600)
    os.replace(tmp, RELATORIOS)


def dia(iso):
    return (iso or "")[:10]


def mes(iso):
    return (iso or "")[:7]


def no_periodo(data_iso, periodo, de, ate):
    d = dia(data_iso)
    if not d:
        return False
    if periodo:
        return mes(d) == periodo
    if de and d < de:
        return False
    if ate and d > ate:
        return False
    return True


def pct(anterior, atual):
    if anterior in (None, 0):
        return None
    return round((atual - anterior) / anterior * 100, 2)


def alcance_por_publicacao(publicacoes, metricas):
    """Alcance de cada publicacao = metrica de maior `dia` (7 vale mais que 1)."""
    por_pub = {}
    for m in metricas:
        pid = m.get("publicacao_id")
        if not pid:
            continue
        atual = por_pub.get(pid)
        if atual is None or (m.get("dia") or 0) > (atual.get("dia") or 0):
            por_pub[pid] = m
    resultado = {}
    for p in publicacoes:
        m = por_pub.get(p.get("peca_id")) or por_pub.get(p.get("id"))
        resultado[p.get("peca_id") or p.get("id")] = (m or {}).get("alcance")
    return resultado


def tempo_medio_aprovacao(aprovacoes):
    """Media de (aprovado_em - criado_em) em horas, so das aprovadas."""
    deltas = []
    for a in aprovacoes:
        ini, fim = a.get("criado_em"), a.get("aprovado_em")
        if not ini or not fim:
            continue
        try:
            t0 = datetime.fromisoformat(ini)
            t1 = datetime.fromisoformat(fim)
        except ValueError:
            continue
        deltas.append((t1 - t0).total_seconds() / 3600)
    if not deltas:
        return None, 0
    return round(sum(deltas) / len(deltas), 2), len(deltas)


def indicadores_do_periodo(periodo, de, ate, ignorar_periodo=False):
    pubs_all = carregar("publicacoes")
    mets_all = carregar("metricas")
    apros_all = carregar("aprovacoes")
    cals_all = carregar("calendario")

    if ignorar_periodo:
        pubs = pubs_all
    else:
        pubs = [p for p in pubs_all if no_periodo(p.get("publicado_em"), periodo, de, ate)]

    ids_validos = {p.get("peca_id") for p in pubs} | {p.get("id") for p in pubs}
    mets = [m for m in mets_all if m.get("publicacao_id") in ids_validos]
    if ignorar_periodo:
        apros = apros_all
    else:
        apros = [a for a in apros_all
                 if no_periodo(a.get("aprovado_em") or a.get("criado_em"), periodo, de, ate)]

    alcances = alcance_por_publicacao(pubs, mets)
    com_alcance = {k: v for k, v in alcances.items() if isinstance(v, int)}
    sem_metrica = sorted(k for k, v in alcances.items() if v is None)

    ordenado = sorted(com_alcance.items(), key=lambda kv: (-kv[1], kv[0]))
    top3 = [{"peca_id": k, "alcance": v} for k, v in ordenado[:3]]
    pior = ({"peca_id": ordenado[-1][0], "alcance": ordenado[-1][1]}
            if ordenado else None)

    canais = {}
    for p in pubs:
        c = p.get("canal") or "sem_canal"
        canais[c] = canais.get(c, 0) + 1

    canais_esperados = sorted({c.get("canal") for c in cals_all if c.get("canal")})
    canais_parados = [c for c in canais_esperados if c not in canais]

    media_t, n_aprov = tempo_medio_aprovacao(apros)
    total_alcance = sum(com_alcance.values())

    indicadores = {
        "total_publicacoes": len(pubs),
        "total_aprovacoes": len(apros),
        "total_metricas": len(mets),
        "top_3_alcance": top3,
        "pior_alcance": pior,
        "distribuicao_canal": canais,
        "canais_sem_publicacao": canais_parados,
        "alcance_total": total_alcance if com_alcance else None,
        "alcance_medio": (round(total_alcance / len(com_alcance), 2)
                          if com_alcance else None),
        "tempo_medio_aprovacao_horas": media_t,
        "publicacoes_sem_metrica": sem_metrica,
        "sem_dado": [],
    }
    for campo in ("top_3_alcance", "pior_alcance", "distribuicao_canal",
                  "alcance_total", "alcance_medio", "tempo_medio_aprovacao_horas"):
        v = indicadores[campo]
        if v in (None, [], {}):
            indicadores["sem_dado"].append(campo)
    if not apros:
        indicadores["sem_dado"].append("total_aprovacoes")
    return indicadores, n_aprov


def periodo_anterior(periodo):
    """Mes anterior no calendario (YYYY-MM -> YYYY-MM)."""
    if not periodo:
        return None
    ano, m = int(periodo[:4]), int(periodo[5:7])
    m -= 1
    if m == 0:
        ano, m = ano - 1, 12
    return "%04d-%02d" % (ano, m)


def comparativo(periodo, indicadores, de, ate):
    ant = periodo_anterior(periodo) if periodo else None
    if not ant:
        return {"periodo_anterior": None, "sem_dado": True,
                "motivo": "comparativo exige --periodo (mes); intervalo livre nao compara"}
    ind_ant, _ = indicadores_do_periodo(ant, None, None)
    if ind_ant["total_publicacoes"] == 0:
        return {"periodo_anterior": ant, "sem_dado": True,
                "motivo": "periodo anterior (%s) sem publicacao: nao ha base" % ant}
    comp = {
        "periodo_anterior": ant,
        "publicacoes": {"anterior": ind_ant["total_publicacoes"],
                        "atual": indicadores["total_publicacoes"],
                        "variacao_pct": pct(ind_ant["total_publicacoes"],
                                            indicadores["total_publicacoes"])},
        "alcance_total": {"anterior": ind_ant["alcance_total"],
                          "atual": indicadores["alcance_total"],
                          "variacao_pct": pct(ind_ant["alcance_total"],
                                              indicadores["alcance_total"])},
        "alcance_medio": {"anterior": ind_ant["alcance_medio"],
                          "atual": indicadores["alcance_medio"],
                          "variacao_pct": pct(ind_ant["alcance_medio"],
                                              indicadores["alcance_medio"])},
        "sem_dado": False,
    }
    return comp


def recomendacoes_de(indicadores, comp):
    recs = []

    def add(regra, texto):
        if len(recs) < 5:
            recs.append({"regra": regra, "texto": texto})

    if indicadores["total_publicacoes"] == 0:
        add("sem_publicacao",
            "Sem publicacao no periodo: nada a comparar. Conferir se o calendario "
            "tem pauta aprovada e se a publicacao foi registrada no log.")

    media = indicadores["alcance_medio"]
    top3 = indicadores["top_3_alcance"]
    if media and top3:
        melhor = top3[0]
        fator = round(melhor["alcance"] / media, 1)
        if melhor["alcance"] > 2 * media:
            add("repetir_formato",
                "Post %s teve %.1fx o alcance medio (%.0f vs %.0f) — repetir "
                "esse formato." % (melhor["peca_id"], fator, melhor["alcance"], media))
        pior = indicadores["pior_alcance"]
        if pior and pior["alcance"] < 0.5 * media:
            add("revisar_formato",
                "Post %s ficou em %.0f de alcance, menos da metade da media (%.0f) — "
                "revisar formato ou horario." % (pior["peca_id"], pior["alcance"], media))

    for canal in indicadores["canais_sem_publicacao"][:2]:
        add("canal_parado",
            "Canal %s esta no calendario e teve 0 publicacoes no periodo — "
            "verificar se a pauta travou." % canal)

    t = indicadores["tempo_medio_aprovacao_horas"]
    if t is not None and t > 24:
        add("aprovacao_lenta",
            "Aprovacao levou em media %.1fh (> 24h) — acelerar a fila de aprovacao "
            "para nao perder a janela do tema." % t)

    if indicadores["publicacoes_sem_metrica"]:
        add("coleta_pendente",
            "%d publicacao(oes) sem metrica (%s) — rodar a coleta manual D+1/D+7."
            % (len(indicadores["publicacoes_sem_metrica"]),
               ", ".join(indicadores["publicacoes_sem_metrica"][:3])))

    if comp.get("sem_dado") is False and comp["publicacoes"]["variacao_pct"] is not None:
        v = comp["publicacoes"]["variacao_pct"]
        if v <= -30:
            add("queda_publicacao",
                "Publicacoes cairam %.1f%% contra %s — revisar a grade do mes."
                % (abs(v), comp["periodo_anterior"]))
    return recs[:5]


def texto_do_relatorio(rotulo, ind, comp, recs):
    """Relatorio em texto ASCII puro (a dona le e cola em outra ferramenta)."""
    linhas = ["RELATORIO " + rotulo, "=" * 40,
              "publicacoes: %d | aprovacoes: %d | metricas: %d"
              % (ind["total_publicacoes"], ind["total_aprovacoes"], ind["total_metricas"])]
    if ind["top_3_alcance"]:
        linhas.append("top 3 alcance:")
        for i, t in enumerate(ind["top_3_alcance"], start=1):
            linhas.append("  %d. %s - %s" % (i, t["peca_id"], t["alcance"]))
    else:
        linhas.append("top 3 alcance: %s" % SEM_DADO)
    linhas.append("pior alcance: %s" % (
        "%s - %s" % (ind["pior_alcance"]["peca_id"], ind["pior_alcance"]["alcance"])
        if ind["pior_alcance"] else SEM_DADO))
    if ind["distribuicao_canal"]:
        linhas.append("canais: " + ", ".join(
            "%s %d" % (k, v) for k, v in sorted(ind["distribuicao_canal"].items())))
    else:
        linhas.append("canais: %s" % SEM_DADO)
    linhas.append("alcance total: %s | medio: %s"
                  % (ind["alcance_total"] if ind["alcance_total"] is not None else SEM_DADO,
                     ind["alcance_medio"] if ind["alcance_medio"] is not None else SEM_DADO))
    linhas.append("tempo medio de aprovacao: %s"
                  % ("%.1fh" % ind["tempo_medio_aprovacao_horas"]
                     if ind["tempo_medio_aprovacao_horas"] is not None else SEM_DADO))
    if comp.get("sem_dado") is False:
        linhas.append("comparativo com %s: publicacoes %s%% | alcance %s%%"
                      % (comp["periodo_anterior"],
                         comp["publicacoes"]["variacao_pct"],
                         comp["alcance_total"]["variacao_pct"]))
    else:
        linhas.append("comparativo: %s" % SEM_DADO)
    linhas.append("recomendacoes:")
    if recs:
        for r in recs:
            linhas.append("  - " + r["texto"])
    else:
        linhas.append("  (nenhuma)")
    return ascii_puro("\n".join(linhas))


def main():
    ap = argparse.ArgumentParser(description="relatorio local da IAra (sem rede)")
    ap.add_argument("--periodo", default="", help="AAAA-MM")
    ap.add_argument("--de", default="", help="AAAA-MM-DD")
    ap.add_argument("--ate", default="", help="AAAA-MM-DD")
    ap.add_argument("--id", default="", help="id do relatorio (com --limpar)")
    ap.add_argument("--consultar", action="store_true")
    ap.add_argument("--limpar", action="store_true")
    a = ap.parse_args()

    if a.consultar:
        lista = carregar_relatorios()
        print(json.dumps({"total": len(lista),
                          "relatorios": [{"id": r["id"], "periodo": r["periodo"],
                                          "gerado_em": r["gerado_em"],
                                          "publicacoes": r["indicadores"]["total_publicacoes"],
                                          "recomendacoes": len(r["recomendacoes"])}
                                         for r in lista]}, indent=2, ensure_ascii=False))
        return 0

    if a.limpar:
        if not (a.periodo or a.id):
            print(json.dumps({"erro": "--limpar exige --periodo ou --id"},
                             ensure_ascii=False))
            return 2
        lista = carregar_relatorios()
        antes = len(lista)
        ficaram = [r for r in lista
                   if not ((a.periodo and r["periodo"] == a.periodo)
                           or (a.id and r["id"] == a.id))]
        gravar_relatorios(ficaram)
        print(json.dumps({"dry_run": False, "antes": antes, "depois": len(ficaram),
                          "removidos": antes - len(ficaram)}, ensure_ascii=False))
        return 0

    if not a.periodo and not (a.de and a.ate):
        print(json.dumps({"erro": "informe --periodo ou --de/--ate"}, ensure_ascii=False))
        return 2
    if a.periodo and not (len(a.periodo) == 7 and a.periodo[4] == "-"):
        print(json.dumps({"erro": "--periodo no formato AAAA-MM"}, ensure_ascii=False))
        return 2

    rotulo = a.periodo if a.periodo else "%s a %s" % (a.de, a.ate)
    ind, _ = indicadores_do_periodo(a.periodo or None, a.de or None, a.ate or None)
    comp = comparativo(a.periodo or None, ind, a.de or None, a.ate or None)
    recs = recomendacoes_de(ind, comp)

    relatorio = {
        "id": str(uuid.uuid4()),
        "periodo": rotulo,
        "tipo_periodo": "mes" if a.periodo else "intervalo",
        "sem_dado": ind["total_publicacoes"] == 0,
        "indicadores": ind,
        "comparativo": comp,
        "recomendacoes": recs,
        "texto": texto_do_relatorio(rotulo, ind, comp, recs),
        "gerado_em": agora(),
    }
    lista = carregar_relatorios()
    lista.append(relatorio)
    gravar_relatorios(lista)
    print(json.dumps({"ok": True, "relatorio": relatorio, "total": len(lista)},
                     indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
