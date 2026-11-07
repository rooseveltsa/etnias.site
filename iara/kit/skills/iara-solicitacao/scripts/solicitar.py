#!/usr/bin/env python3
"""solicitar.py — central de solicitacoes internas (intake + SLA + fila).

SEM REDE, SEM SUPABASE, SEM CREDENCIAL. Grava apenas
~/.hermes/iara-data/solicitacoes.json e, no aceite, usa o adaptador
(`iara_adapter.registrar_calendario`) — nunca escreve calendario.json a mao.

Uso:
  solicitar.py criar --solicitante "Ana" --setor design --tipo arte \
      --descricao "card do evento X" --prazo 2026-11-08 --prioridade media
  solicitar.py listar [--filtro-setor design] [--filtro-status aberta]
  solicitar.py aceitar --id <uuid>
  solicitar.py concluir --id <uuid>
  solicitar.py cancelar --id <uuid> --motivo "pedido duplicado"
  solicitar.py limpar [--confirmar]

SLA base por tipo (horas): arte 48, video 72, comunicado 24, campanha 120,
evento 48, projeto 120. Prioridade alta = x0,75; baixa = x1,5; media = x1,0.
Se o prazo pedido (fim do dia do prazo) ficar abaixo do SLA, grava
`sla_risco: true` e `motivo_sla_risco: "prazo menor que SLA"`.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import uuid
from datetime import datetime, time, timedelta

sys.path.insert(0, os.path.expanduser("~/.hermes/skills/iara-adapter/scripts"))
import iara_adapter  # noqa: E402

BASE = os.path.expanduser("~/.hermes/iara-data")
ARQ = os.path.join(BASE, "solicitacoes.json")

SETORES = ("marketing", "design", "social", "audiovisual", "documentos", "outro")
TIPOS = ("arte", "video", "comunicado", "campanha", "evento", "projeto")
PRIORIDADES = ("baixa", "media", "alta")
STATUS = ("aberta", "aceita", "em_andamento", "concluida", "cancelada")

SLA_BASE = {"arte": 48, "video": 72, "comunicado": 24, "campanha": 120,
            "evento": 48, "projeto": 120}
FATOR_PRIORIDADE = {"alta": 0.75, "media": 1.0, "baixa": 1.5}


def agora() -> str:
    return datetime.now().isoformat(timespec="seconds")


def ler() -> list:
    if not os.path.exists(ARQ):
        return []
    try:
        d = json.load(open(ARQ, encoding="utf-8"))
        return d if isinstance(d, list) else []
    except Exception:
        return []


def gravar(itens: list) -> None:
    os.makedirs(BASE, exist_ok=True)
    tmp = ARQ + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(itens, f, ensure_ascii=False, indent=2)
    os.chmod(tmp, 0o600)
    os.replace(tmp, ARQ)


def sla_de(tipo: str, prioridade: str) -> int:
    bruto = SLA_BASE[tipo] * FATOR_PRIORIDADE[prioridade]
    return int(round(bruto))


def horas_ate(prazo: str) -> float:
    """Horas entre agora e o fim do dia do prazo."""
    d = datetime.strptime(prazo, "%Y-%m-%d").date()
    fim = datetime.combine(d, time(23, 59, 59))
    return round((fim - datetime.now()).total_seconds() / 3600.0, 1)


def data_padrao(criado_iso: str, sla_horas: int) -> str:
    base = datetime.fromisoformat(criado_iso)
    return (base + timedelta(hours=sla_horas)).date().isoformat()


def achar(itens: list, sid: str):
    for i in itens:
        if i.get("id") == sid:
            return i
    return None


def cmd_criar(a) -> dict:
    faltando = [c for c, v in (("solicitante", a.solicitante), ("setor", a.setor),
                               ("tipo", a.tipo), ("descricao", a.descricao)) if not (v or "").strip()]
    if faltando:
        print(json.dumps({"ok": False, "erro": "campos_obrigatorios", "faltando": faltando}))
        raise SystemExit(2)
    if a.setor not in SETORES:
        print(json.dumps({"ok": False, "erro": "setor_invalido", "validos": list(SETORES)}))
        raise SystemExit(2)
    if a.tipo not in TIPOS:
        print(json.dumps({"ok": False, "erro": "tipo_invalido", "validos": list(TIPOS)}))
        raise SystemExit(2)
    if a.prioridade not in PRIORIDADES:
        print(json.dumps({"ok": False, "erro": "prioridade_invalida", "validos": list(PRIORIDADES)}))
        raise SystemExit(2)
    if a.prazo:
        try:
            datetime.strptime(a.prazo, "%Y-%m-%d")
        except ValueError:
            print(json.dumps({"ok": False, "erro": "prazo_invalido", "esperado": "AAAA-MM-DD"}))
            raise SystemExit(2)

    criado = agora()
    sla_horas = sla_de(a.tipo, a.prioridade)
    prazo = a.prazo or data_padrao(criado, sla_horas)

    sem = {
        "id": str(uuid.uuid4()),
        "solicitante": a.solicitante.strip(),
        "setor_origem": a.setor,
        "tipo": a.tipo,
        "descricao": a.descricao.strip(),
        "prazo": prazo,
        "prazo_solicitado": a.prazo or "",
        "prioridade": a.prioridade,
        "sla_horas": sla_horas,
        "status": "aberta",
        "sla_risco": False,
        "motivo_sla_risco": "",
        "criado_em": criado,
        "aceito_em": None,
        "concluido_em": None,
        "calendario_id": None,
        "motivo": "",
    }

    if a.prazo:
        h = horas_ate(a.prazo)
        sem["horas_ate_prazo"] = h
        if h < sla_horas:
            sem["sla_risco"] = True
            sem["motivo_sla_risco"] = "prazo menor que SLA"

    itens = ler()
    itens.append(sem)
    gravar(itens)
    print(json.dumps({"ok": True, "solicitacao": sem}, ensure_ascii=False, indent=2))
    return sem


def cmd_listar(a) -> dict:
    itens = ler()
    if a.filtro_setor:
        itens = [i for i in itens if i.get("setor_origem") == a.filtro_setor]
    if a.filtro_status:
        itens = [i for i in itens if i.get("status") == a.filtro_status]
    if not itens:
        print("(sem solicitacoes)")
    for i in itens:
        print(f"{i['id']}  {i['status']:12s} {i['prioridade']:5s} {i['tipo']:10s} "
              f"setor={i['setor_origem']:11s} sla={i['sla_horas']}h prazo={i['prazo']}"
              f"{'  SLA_RISCO' if i.get('sla_risco') else ''}")
    return {"total": len(itens), "solicitacoes": itens}


def cmd_aceitar(a) -> dict:
    itens = ler()
    s = achar(itens, a.id)
    if not s:
        print(json.dumps({"ok": False, "erro": "id_nao_encontrado"}))
        raise SystemExit(2)
    if s["status"] != "aberta":
        print(json.dumps({"ok": False, "erro": "status_invalido_para_aceite",
                          "status_atual": s["status"]}))
        raise SystemExit(3)

    titulo = s["descricao"] if len(s["descricao"]) <= 140 else s["descricao"][:137] + "..."
    try:
        r = iara_adapter.registrar_calendario(
            solicitacao_id=s["id"], titulo=titulo, canal="interno",
            data_prevista=s["prazo"])
    except iara_adapter.ErroDeValidacao as exc:
        print(json.dumps({"ok": False, "erro": "adapter_recusou", "detalhe": str(exc)}))
        raise SystemExit(4)

    s.update({"status": "aceita", "aceito_em": agora(),
              "calendario_id": r["registro"]["id"]})
    gravar(itens)
    print(json.dumps({"ok": True, "solicitacao": s, "calendario": r["registro"]},
                     ensure_ascii=False, indent=2))
    return s


def _fechar(a, novo_status: str, extra=None) -> dict:
    itens = ler()
    s = achar(itens, a.id)
    if not s:
        print(json.dumps({"ok": False, "erro": "id_nao_encontrado"}))
        raise SystemExit(2)
    if s["status"] in ("concluida", "cancelada"):
        print(json.dumps({"ok": False, "erro": "status_terminal", "status_atual": s["status"]}))
        raise SystemExit(3)
    if novo_status == "concluida" and s["status"] == "aberta":
        print(json.dumps({"ok": False, "erro": "precisa_aceitar_antes",
                          "status_atual": s["status"]}))
        raise SystemExit(3)
    s["status"] = novo_status
    s["concluido_em" if novo_status == "concluida" else "cancelado_em"] = agora()
    if extra:
        s.update(extra)
    gravar(itens)
    print(json.dumps({"ok": True, "solicitacao": s}, ensure_ascii=False, indent=2))
    return s


def cmd_cancelar(a) -> dict:
    if not (a.motivo or "").strip():
        print(json.dumps({"ok": False, "erro": "motivo_obrigatorio"}))
        raise SystemExit(2)
    return _fechar(a, "cancelada", {"motivo": a.motivo.strip()})


def cmd_limpar(a) -> dict:
    itens = ler()
    print(json.dumps({"dry_run": not a.confirmar, "sairiam": len(itens),
                      "ids": [i["id"] for i in itens]}, ensure_ascii=False))
    if a.confirmar and itens:
        gravar([])
    return {"antes": len(itens), "depois": len(ler())}


def main() -> int:
    ap = argparse.ArgumentParser(description="central de solicitacoes (sem rede)")
    sub = ap.add_subparsers(dest="cmd", required=True)

    c = sub.add_parser("criar")
    c.add_argument("--solicitante", default="")
    c.add_argument("--setor", default="")
    c.add_argument("--tipo", default="")
    c.add_argument("--descricao", default="")
    c.add_argument("--prazo", default="")
    c.add_argument("--prioridade", default="media")

    l = sub.add_parser("listar")
    l.add_argument("--filtro-setor", default="")
    l.add_argument("--filtro-status", default="")

    for nome in ("aceitar", "concluir", "cancelar"):
        p = sub.add_parser(nome)
        p.add_argument("--id", required=True)
        if nome == "cancelar":
            p.add_argument("--motivo", default="")

    li = sub.add_parser("limpar")
    li.add_argument("--confirmar", action="store_true")

    a = ap.parse_args()
    if a.cmd == "criar":
        cmd_criar(a)
    elif a.cmd == "listar":
        cmd_listar(a)
    elif a.cmd == "aceitar":
        cmd_aceitar(a)
    elif a.cmd == "concluir":
        _fechar(a, "concluida")
    elif a.cmd == "cancelar":
        cmd_cancelar(a)
    elif a.cmd == "limpar":
        cmd_limpar(a)
    return 0


if __name__ == "__main__":
    sys.exit(main())
