#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""iara_adapter.py — porta unica de escrita/leitura da IAra (local-first).

Porta-e-adaptador:
    as skills chamam registrar_aprovacao() / registrar_publicacao() /
    registrar_metrica() e ler_*(). Quem grava e decidido por
    ~/.hermes/iara-data/config.json -> {"storage": "local" | "supabase"}.

    storage = "local"     -> arquivos JSON em ~/.hermes/iara-data/ (padrao)
    storage = "supabase"  -> modulo Supabase (STUB nesta fase: responde
                             needs_install=True ate o junior instalar o banco)

Regras desta camada:
  * SEM rede. Nenhum import de urllib/requests/socket.
  * NAO le ~/.hermes/.env nem ~/.hermes/credentials/. Nunca.
  * A REGRA de aprovacao mora aqui, nao no script — assim local e supabase
    aprovam exatamente igual.
  * Escrita atomica (tmp + os.replace) e permissao 0600.

Uso:
    import sys; sys.path.insert(0, "/home/<user>/.hermes/skills/iara-adapter/scripts")
    from iara_adapter import registrar_aprovacao, ler_aprovacoes
"""
from __future__ import annotations

import json
import os
import re
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

DADOS = Path(os.path.expanduser("~/.hermes/iara-data"))
CONFIG = DADOS / "config.json"
ARQUIVOS = {
    "aprovacoes": DADOS / "aprovacoes.json",
    "publicacoes": DADOS / "publicacoes.json",
    "metricas": DADOS / "metricas.json",
    "calendario": DADOS / "calendario.json",
    "biblioteca": DADOS / "biblioteca.json",
}

HEX32 = re.compile(r"^[0-9a-fA-F]{32,}$")
SLUG = re.compile(r"^[a-z0-9][a-z0-9._-]*$")
SOLIC = re.compile(r"^[A-Za-z0-9._-]+$")
CANAIS = {"instagram", "tiktok", "linkedin", "site", "shopee", "enjoei", "nuvemshop", "interno"}
ESTADOS = {"rascunho", "revisao", "aprovado", "agendado", "publicado"}
DIAS = {1, 7}


class ErroDeValidacao(ValueError):
    """Entrada invalida. A skill traduz para exit 2."""


class NeedsInstall(RuntimeError):
    """storage=supabase sem o modulo instalado. A skill traduz para exit 5."""

    def __init__(self, mensagem, detalhes=None):
        super().__init__(mensagem)
        self.detalhes = detalhes or {}


class BloqueioInstitucional(RuntimeError):
    """Peca bloqueada pelo iara-institucional. A skill traduz para exit 3."""

    def __init__(self, mensagem, payload=None):
        super().__init__(mensagem)
        self.payload = payload or {"motivo": "bloqueado_institucional"}


class PiiNaoAnonimizada(ValueError):
    """Texto com telefone/email/CPF cru. A skill traduz para exit 4."""

    def __init__(self, mensagem, payload=None):
        super().__init__(mensagem)
        self.payload = payload or {"motivo": "pii_nao_anonimizada"}


class IntegridadePublicacao(RuntimeError):
    """Publicacao sem aprovacao ou com hash divergente. Skill traduz para exit 5."""

    def __init__(self, mensagem, payload=None):
        super().__init__(mensagem)
        self.payload = payload or {"motivo": "aprovacao_ausente"}


# ---------------------------------------------------------------- PII (buraco 3)
# Telefone, email e CPF. Texto com PII cru NAO entra em log nenhum: ou chega
# anonimizado (anonimizado=True), ou o registro e recusado.
PII_PADROES = {
    "telefone": re.compile(r"\b\d{10,11}\b"),
    "email": re.compile(r"\S+@\S+"),
    "cpf": re.compile(r"\b\d{3}\.\d{3}\.\d{3}-\d{2}\b"),
}
# campos de maquina: id/hash/data sao gerados pelo sistema, nao sao texto de gente
CAMPOS_MAQUINA = {"id", "peca_hash", "solicitacao_id", "item_id", "peca_id",
                  "publicacao_id", "criado_em", "publicado_em", "coleta_em",
                  "aprovado_em", "atualizado_em", "hora", "data_prevista"}


def _texto_do_registro(rec):
    """Junta so os valores de texto livre do registro (sem id/hash/data)."""
    partes = []
    for campo, valor in rec.items():
        if campo in CAMPOS_MAQUINA:
            continue
        if isinstance(valor, str):
            partes.append(valor)
        elif isinstance(valor, dict):
            partes.extend(str(v) for v in valor.values() if isinstance(v, str))
        elif isinstance(valor, (list, tuple)):
            partes.extend(str(v) for v in valor if isinstance(v, str))
    return "\n".join(partes)


def verificar_pii(texto):
    """{tem_pii: bool, achados: [tipos]} — nao altera o texto."""
    achados = [tipo for tipo, rx in PII_PADROES.items() if rx.search(texto or "")]
    return {"tem_pii": bool(achados), "achados": achados}


def _exigir_sem_pii(rec, anonimizado, contexto):
    pii = verificar_pii(_texto_do_registro(rec))
    if pii["tem_pii"] and not anonimizado:
        raise PiiNaoAnonimizada(
            "%s com PII cru (%s): anonimizar antes de gravar (telefone, email, CPF)"
            % (contexto, ", ".join(pii["achados"])),
            {"motivo": "pii_nao_anonimizada", "pii": pii["achados"],
             "contexto": contexto, "dica": "anonimizar o texto ou marcar anonimizado=True"})
    return pii


# ------------------------------------------------- bloqueio institucional (b1)
def _estado_institucional(peca_id):
    """(bloqueado, aviso). Modulo ausente NAO quebra o kit: so avisa."""
    if not peca_id:
        return False, "peca_id_ausente"
    script_dir = os.path.expanduser("~/.hermes/skills/iara-institucional/scripts")
    if not os.path.exists(os.path.join(script_dir, "institucional.py")):
        return False, "institucional_ausente"
    if script_dir not in sys.path:
        sys.path.insert(0, script_dir)
    try:
        from institucional import esta_bloqueado as _bloqueado
    except Exception:
        return False, "institucional_indisponivel"
    try:
        return bool(_bloqueado(peca_id)), None
    except Exception:
        return False, "institucional_erro"


def esta_bloqueado(peca_id):
    """True quando o iara-institucional marca bloqueio pendente para a peca.

    Sem o modulo instalado devolve False com aviso `institucional_ausente`
    (kit incompleto nao derruba aprovacao), visivel em aviso_institucional().
    """
    return _estado_institucional(peca_id)[0]


def aviso_institucional(peca_id):
    """Aviso do ultimo check institucional (None quando tudo certo)."""
    return _estado_institucional(peca_id)[1]


def agora():
    return datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")


# --------------------------------------------------------------------- config
def ler_config():
    """Config do adaptador. Ausente/corrompida = local (nunca explode)."""
    if not CONFIG.exists():
        return {"storage": "local", "version": "1", "origem": "padrao"}
    try:
        cfg = json.loads(CONFIG.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {"storage": "local", "version": "1", "origem": "config_ilegivel_local"}
    cfg.setdefault("storage", "local")
    cfg.setdefault("version", "1")
    cfg["origem"] = "arquivo"
    return cfg


def estado():
    """Snapshot para o ticket: onde grava e quantas linhas tem cada arquivo."""
    cfg = ler_config()
    linhas = {}
    for nome, caminho in ARQUIVOS.items():
        try:
            linhas[nome] = len(json.loads(caminho.read_text(encoding="utf-8")))
        except (OSError, json.JSONDecodeError):
            linhas[nome] = None
    return {"storage": cfg["storage"], "config": str(CONFIG), "dados": str(DADOS),
            "linhas": linhas}


# ------------------------------------------------------------- armazenamento
def _carregar(nome):
    caminho = ARQUIVOS[nome]
    if not caminho.exists():
        return []
    try:
        dados = json.loads(caminho.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise ErroDeValidacao("arquivo %s corrompido (%s): nao sobrescrevo historico"
                              % (caminho, exc))
    if not isinstance(dados, list):
        raise ErroDeValidacao("arquivo %s nao e uma lista" % caminho)
    return dados


def _salvar(nome, registros):
    caminho = ARQUIVOS[nome]
    caminho.parent.mkdir(parents=True, exist_ok=True)
    tmp = caminho.with_suffix(".tmp")
    tmp.write_text(json.dumps(registros, indent=2, ensure_ascii=False) + "\n",
                   encoding="utf-8")
    os.chmod(tmp, 0o600)
    os.replace(tmp, caminho)


class _Local:
    nome = "local"

    @staticmethod
    def inserir(tipo, registro):
        registros = _carregar(tipo)
        registros.append(registro)
        _salvar(tipo, registros)
        return registro

    @staticmethod
    def listar(tipo, campo=None, valor=None):
        registros = _carregar(tipo)
        if campo is None:
            return registros
        return [r for r in registros if r.get(campo) == valor]

    @staticmethod
    def atualizar(tipo, campo, valor, mudancas):
        registros = _carregar(tipo)
        achou = None
        for r in registros:
            if r.get(campo) == valor:
                r.update(mudancas)
                achou = r
        if achou:
            _salvar(tipo, registros)
        return achou

    @staticmethod
    def apagar(tipo, campo, valor):
        registros = _carregar(tipo)
        ficaram = [r for r in registros if r.get(campo) != valor]
        removidos = len(registros) - len(ficaram)
        _salvar(tipo, ficaram)
        return removidos


class _SupabaseStub:
    """Stub. Implementar aqui quando o banco entrar — os callers nao mudam."""

    nome = "supabase"

    def _erro(self, operacao):
        raise NeedsInstall(
            "storage=supabase configurado em %s, mas o modulo Supabase ainda nao "
            "foi instalado (stub). Troque config.json para \"local\" ou implemente "
            "_SupabaseStub.%s." % (CONFIG, operacao),
            {"needs_install": True, "operacao": operacao, "storage": "supabase",
             "config": str(CONFIG)})

    def inserir(self, tipo, registro):
        self._erro("inserir")

    def listar(self, tipo, campo=None, valor=None):
        self._erro("listar")

    def atualizar(self, tipo, campo, valor, mudancas):
        self._erro("atualizar")

    def apagar(self, tipo, campo, valor):
        self._erro("apagar")


def _store():
    cfg = ler_config()
    if cfg["storage"] == "supabase":
        return _SupabaseStub()
    return _Local()


def _novo_id():
    return str(uuid.uuid4())


# ------------------------------------------------------------------- validacao
def _exige(cond, msg):
    if not cond:
        raise ErroDeValidacao(msg)


def validar_aprovacao(rec, teste=False):
    _exige(rec.get("solicitacao_id"), "solicitacao_id vazio")
    _exige(SOLIC.match(rec["solicitacao_id"]),
           "solicitacao_id com caractere invalido (use letras, numero, . _ -)")
    ap = (rec.get("aprovador") or "").strip()
    _exige(ap, "aprovador vazio: aprovacao sem nome nao vale")
    _exige(not (ap.lower() in {"eu", "teste"} and not teste),
           "aprovador '%s' nao vale em producao (use o nome de quem aprovou)" % ap)
    _exige(HEX32.match((rec.get("peca_hash") or "").strip()),
           "peca_hash invalido: precisa ser hex de 32+ chars (md5/sha)")
    if rec.get("canal"):
        _exige(rec["canal"] in CANAIS, "canal invalido: %r" % rec["canal"])
    return rec


def validar_publicacao(rec, teste=False):
    _exige(SLUG.match((rec.get("peca_id") or "").strip()),
           "peca_id invalido: slug minusculo (a-z 0-9 . _ -)")
    ap = (rec.get("aprovador") or "").strip()
    _exige(ap, "aprovador vazio")
    _exige(not (ap.lower() in {"eu", "teste"} and not teste),
           "aprovador '%s' nao vale em producao (use o nome de quem aprovou)" % ap)
    _exige((rec.get("canal") or "") in CANAIS, "canal invalido: %r" % rec.get("canal"))
    _exige((rec.get("url") or "").startswith(("http://", "https://")),
           "url invalida: precisa comecar com http:// ou https://")
    try:
        datetime.fromisoformat(rec.get("hora") or "")
    except ValueError:
        raise ErroDeValidacao("hora invalida: use ISO-8601")
    return rec


def validar_metrica(rec):
    _exige(rec.get("publicacao_id"), "publicacao_id vazio")
    _exige(int(rec.get("dia", 0)) in DIAS, "dia invalido: use 1 ou 7")
    _exige(rec.get("origem") in {"manual", "coleta_real"},
           "origem invalida: use 'manual' (agora) ou 'coleta_real' (pos-instalacao)")
    for campo in ("alcance", "impressoes", "curtidas", "comentarios",
                  "salvamentos", "compartilhamentos"):
        valor = rec.get(campo)
        _exige(valor is None or (isinstance(valor, int) and valor >= 0),
               "%s invalido: inteiro >= 0 ou nulo" % campo)
    return rec


# ---------------------------------------------------------------- aprovacoes
def registrar_aprovacao(solicitacao_id, aprovador, peca_hash, canal=None,
                        peca_id=None, teste=False, anonimizado=False, **extras):
    """Cria a solicitacao em estado `rascunho`. Sempre devolve aprovado=False.

    Antes de gravar:
      * recusa texto com PII cru (exit 4 na skill);
      * recusa peca com bloqueio institucional pendente (exit 3 na skill).
    """
    rec = {"solicitacao_id": solicitacao_id, "aprovador": aprovador,
           "peca_hash": peca_hash, "canal": canal, "estado": "rascunho"}
    rec.update(extras)
    validar_aprovacao(rec, teste=teste)
    pii = _exigir_sem_pii(rec, anonimizado, "aprovacao")

    chave = (peca_id or solicitacao_id or "").strip()
    bloqueado, aviso = _estado_institucional(chave)
    if bloqueado:
        raise BloqueioInstitucional(
            "peca %r bloqueada pelo institucional: falta aprovador institucional nominal"
            % chave,
            {"aprovado": False, "motivo": "bloqueado_institucional", "peca_id": chave,
             "solicitacao_id": solicitacao_id,
             "dica": "iara-institucional registrar_aprovador_institucional "
                     "--peca-id %s --aprovador <nome>" % chave})

    rec = {"id": _novo_id(), "solicitacao_id": rec["solicitacao_id"].strip(),
           "aprovador": rec["aprovador"].strip(),
           "peca_hash": rec["peca_hash"].strip(),
           "canal": rec["canal"], "estado": "rascunho",
           "criado_em": agora(), "aprovado_em": None}
    _store().inserir("aprovacoes", rec)
    saida = {"aprovado": False, "estado": "rascunho", "registro": rec,
             "storage": _store().nome}
    if aviso:
        saida["aviso_institucional"] = aviso
    if pii["tem_pii"] and anonimizado:
        saida["pii_anonimizada"] = True
    return saida


def transicionar_aprovacao(solicitacao_id, aprovador, teste=False, peca_id=None):
    """APROVACAO EXPLICITA. Unica porta que devolve aprovado=True.

    Re-verifica o bloqueio institucional AQUI tambem (PEC 18.2): uma solicitacao
    aberta antes da classificacao nao pode virar `aprovado` com a peca bloqueada.
    """
    ap = (aprovador or "").strip()
    _exige(ap, "aprovador vazio: aprovacao sem nome nao vale")
    _exige(not (ap.lower() in {"eu", "teste"} and not teste),
           "aprovador '%s' nao vale em producao (use o nome de quem aprovou)" % ap)
    loja = _store()
    linhas = loja.listar("aprovacoes", "solicitacao_id", solicitacao_id)
    _exige(bool(linhas),
           "nenhuma solicitacao %r: solicite antes de aprovar" % solicitacao_id)
    atual = linhas[-1]
    _exige(atual["estado"] in {"rascunho", "revisao"},
           "solicitacao %r esta em %r: nao volta para aprovado"
           % (solicitacao_id, atual["estado"]))

    chave = (peca_id or atual.get("peca_id") or solicitacao_id or "").strip()
    bloqueado, aviso = _estado_institucional(chave)
    if bloqueado:
        raise BloqueioInstitucional(
            "peca %r bloqueada pelo institucional: --acao aprovar recusado" % chave,
            {"aprovado": False, "motivo": "bloqueado_institucional", "peca_id": chave,
             "solicitacao_id": solicitacao_id,
             "dica": "iara-institucional registrar_aprovador_institucional "
                     "--peca-id %s --aprovador <nome>" % chave})

    r = loja.atualizar("aprovacoes", "id", atual["id"],
                       {"estado": "aprovado", "aprovador": ap, "aprovado_em": agora()})
    saida = {"aprovado": True, "estado": "aprovado", "registro": r,
             "storage": loja.nome}
    if aviso:
        saida["aviso_institucional"] = aviso
    return saida


def ler_aprovacoes(solicitacao_id=None):
    return _store().listar("aprovacoes", "solicitacao_id", solicitacao_id)


def consultar_aprovacao(solicitacao_id):
    linhas = ler_aprovacoes(solicitacao_id)
    if not linhas:
        return {"encontrado": False, "aprovado": False, "registro": None}
    r = linhas[-1]
    return {"encontrado": True, "aprovado": r["estado"] in {"aprovado", "agendado", "publicado"},
            "registro": r}


# --------------------------------------------------------------- publicacoes
def registrar_publicacao(peca_id, aprovador, canal, url, hora=None,
                         solicitacao_id=None, peca_hash=None, teste=False,
                         anonimizado=False):
    """Registra a publicacao. Antes de gravar, confere a aprovacao de origem.

    * PII cru no texto -> PiiNaoAnonimizada (exit 4 na skill);
    * solicitacao sem aprovacao -> IntegridadePublicacao `aprovacao_ausente` (exit 5);
    * peca_hash diferente do aprovado -> `divergencia_hash` (exit 5).
    """
    hora = hora or agora()
    rec = {"peca_id": peca_id, "aprovador": aprovador, "canal": canal,
           "url": url, "hora": hora}
    validar_publicacao(rec, teste=teste)
    if peca_hash:
        _exige(HEX32.match(peca_hash.strip()),
               "peca_hash invalido: precisa ser hex de 32+ chars (md5/sha)")
    pii = _exigir_sem_pii(rec, anonimizado, "publicacao")

    conferencia = {"hash_conferido": False}
    if solicitacao_id:
        achou = consultar_aprovacao(solicitacao_id)
        if not achou["encontrado"]:
            raise IntegridadePublicacao(
                "solicitacao %r nao existe: publicacao sem aprovacao nao entra"
                % solicitacao_id,
                {"publicado": False, "motivo": "aprovacao_ausente",
                 "solicitacao_id": solicitacao_id, "encontrada": False})
        if not achou["aprovado"]:
            raise IntegridadePublicacao(
                "solicitacao %r esta em %r: falta aprovacao nominal"
                % (solicitacao_id, (achou["registro"] or {}).get("estado")),
                {"publicado": False, "motivo": "aprovacao_ausente",
                 "solicitacao_id": solicitacao_id, "encontrada": True,
                 "estado": (achou["registro"] or {}).get("estado")})
        aprovado_hash = ((achou["registro"] or {}).get("peca_hash") or "").strip()
        if not peca_hash:
            raise IntegridadePublicacao(
                "publicacao ligada a solicitacao %r exige peca_hash (PEC 18.2)"
                % solicitacao_id,
                {"publicado": False, "motivo": "hash_obrigatorio",
                 "solicitacao_id": solicitacao_id, "peca_hash_aprovado": aprovado_hash,
                 "dica": "repita --peca-hash com o mesmo hash que foi aprovado"})
        if peca_hash.strip().lower() != aprovado_hash.lower():
            raise IntegridadePublicacao(
                "hash da publicacao nao bate com o da aprovacao %r" % solicitacao_id,
                {"publicado": False, "motivo": "divergencia_hash",
                 "solicitacao_id": solicitacao_id,
                 "peca_hash_aprovado": aprovado_hash,
                 "peca_hash_publicado": peca_hash.strip()})
        conferencia = {"hash_conferido": True}

    rec = {"id": _novo_id(), "peca_id": rec["peca_id"].strip(),
           "aprovador": rec["aprovador"].strip(), "canal": rec["canal"],
           "url": rec["url"].strip(), "publicado_em": hora,
           "solicitacao_id": solicitacao_id,
           "peca_hash": peca_hash.strip() if peca_hash else None,
           "criado_em": agora()}
    rec.update(conferencia)
    _store().inserir("publicacoes", rec)
    saida = {"registrado": True, "registro": rec, "storage": _store().nome}
    if pii["tem_pii"] and anonimizado:
        saida["pii_anonimizada"] = True
    return saida


def ler_publicacoes(peca_id=None):
    return _store().listar("publicacoes", "peca_id", peca_id)


# ------------------------------------------------------------------- metricas
def registrar_metrica(publicacao_id, dia, origem="manual", canal="instagram",
                      alcance=None, impressoes=None, curtidas=None,
                      comentarios=None, salvamentos=None, compartilhamentos=None,
                      anonimizado=False):
    rec = {"publicacao_id": publicacao_id, "dia": int(dia), "origem": origem,
           "canal": canal, "alcance": alcance, "impressoes": impressoes,
           "curtidas": curtidas, "comentarios": comentarios,
           "salvamentos": salvamentos, "compartilhamentos": compartilhamentos}
    validar_metrica(rec)
    _exigir_sem_pii(rec, anonimizado, "metrica")
    if origem == "manual":
        rec["aguardando_coleta_real"] = True
    rec = dict(rec, id=_novo_id(), coleta_em=agora(), criado_em=agora())
    _store().inserir("metricas", rec)
    return {"registrado": True, "registro": rec, "storage": _store().nome}


def ler_metricas(publicacao_id=None):
    return _store().listar("metricas", "publicacao_id", publicacao_id)


# ----------------------------------------------------------------- calendario
# Maquina de estados da pauta editorial. Transicao fora daqui = erro.
TRANSICOES = {
    "rascunho": {"revisao"},
    "revisao": {"aprovado", "reprovado"},
    "aprovado": {"agendado"},
    "agendado": {"publicado"},
    "publicado": {"reaproveitado"},
    "reaproveitado": set(),      # terminal
    "reprovado": set(),          # terminal
}
# `aprovado` pode pular `revisao` quando a aprovacao vem da skill iara-aprovacao?
# Nao: pauta editorial entra em revisao SEMPRE — o aceite da peca e outra coisa.


def validar_calendario(rec):
    _exige(rec.get("solicitacao_id"), "solicitacao_id vazio")
    _exige(SOLIC.match(rec["solicitacao_id"]),
           "solicitacao_id com caractere invalido (use letras, numero, . _ -)")
    _exige((rec.get("titulo") or "").strip(), "titulo vazio")
    _exige(len(rec["titulo"]) <= 140, "titulo longo demais (max 140)")
    _exige(rec.get("canal") in CANAIS, "canal invalido: %r" % rec.get("canal"))
    try:
        datetime.strptime(rec.get("data_prevista") or "", "%Y-%m-%d")
    except ValueError:
        raise ErroDeValidacao("data_prevista invalida: use AAAA-MM-DD")
    _exige(rec.get("estado") in TRANSICOES,
           "estado invalido: %r (validos: %s)"
           % (rec.get("estado"), ", ".join(TRANSICOES)))
    return rec


def registrar_calendario(solicitacao_id, titulo, canal, data_prevista,
                         estado_inicial="rascunho", teste=False, anonimizado=False):
    """Cria UMA pauta. Estado inicial sempre `rascunho` (ou outro no inicio da cadeia)."""
    rec = {"solicitacao_id": solicitacao_id, "titulo": titulo, "canal": canal,
           "data_prevista": data_prevista, "estado": estado_inicial or "rascunho"}
    validar_calendario(rec)
    _exigir_sem_pii(rec, anonimizado, "calendario")
    _exige(TRANSICOES[rec["estado"]] != set() or rec["estado"] == "rascunho",
           "estado inicial %r nao serve para pauta nova" % rec["estado"])
    loja = _store()
    if loja.listar("calendario", "solicitacao_id", rec["solicitacao_id"]):
        raise ErroDeValidacao("pauta %r ja existe no calendario: use avancar_estado "
                              "para mudar o estado" % rec["solicitacao_id"])
    agora_iso = agora()
    linha = {"id": _novo_id(), "solicitacao_id": rec["solicitacao_id"],
             "titulo": rec["titulo"].strip(), "canal": rec["canal"],
             "data_prevista": rec["data_prevista"], "estado": rec["estado"],
             "historico": [{"de": None, "para": rec["estado"], "em": agora_iso}],
             "criado_em": agora_iso, "atualizado_em": agora_iso}
    loja.inserir("calendario", linha)
    return {"registrado": True, "registro": linha, "storage": loja.nome}


def avancar_estado(solicitacao_id, novo_estado):
    """Avanca a pauta UM passo na cadeia. Transicao ilegal = ErroDeValidacao."""
    _exige(novo_estado in TRANSICOES,
           "estado invalido: %r (validos: %s)" % (novo_estado, ", ".join(TRANSICOES)))
    loja = _store()
    linhas = loja.listar("calendario", "solicitacao_id", solicitacao_id)
    _exige(bool(linhas), "pauta %r nao existe no calendario" % solicitacao_id)
    atual = linhas[-1]
    de = atual["estado"]
    permitidos = TRANSICOES[de]
    _exige(novo_estado in permitidos,
           "transicao invalida: %r -> %r (de %r so vai para: %s)"
           % (de, novo_estado, de, ", ".join(sorted(permitidos)) or "nenhum (terminal)"))
    historico = list(atual.get("historico") or [])
    historico.append({"de": de, "para": novo_estado, "em": agora()})
    r = loja.atualizar("calendario", "id", atual["id"],
                       {"estado": novo_estado, "historico": historico,
                        "atualizado_em": agora()})
    return {"avancado": True, "de": de, "para": novo_estado, "registro": r,
            "storage": loja.nome}


def ler_calendario(solicitacao_id=None):
    return _store().listar("calendario", "solicitacao_id", solicitacao_id)


# ------------------------------------------------------------------ biblioteca
TIPOS_BIB = {"campanha", "video", "card", "historia", "documento"}
# chaves que denunciam binario colado no registro (a biblioteca nao guarda arquivo)
CHAVES_BINARIO = {"conteudo", "conteudo_base64", "base64", "binario", "bin",
                  "blob", "bytes", "arquivo", "arquivo_base64", "raw"}


def validar_biblioteca(rec):
    _exige(rec.get("item_id"), "item_id vazio")
    _exige(SOLIC.match(rec["item_id"]),
           "item_id com caractere invalido (use letras, numero, . _ -)")
    _exige(rec.get("tipo") in TIPOS_BIB,
           "tipo invalido: %r (aceitos: %s)"
           % (rec.get("tipo"), ", ".join(sorted(TIPOS_BIB))))
    _exige((rec.get("titulo") or "").strip(), "titulo vazio")
    metadado = rec.get("metadado") or {}
    _exige(isinstance(metadado, dict), "metadado precisa ser objeto (dict)")
    proibidas = CHAVES_BINARIO & set(metadado)
    _exige(not proibidas,
           "metadado traz chave de binario %s: a biblioteca guarda SO id e metadado"
           % sorted(proibidas))
    caminho = rec.get("caminho_referencia")
    _exige(caminho is None or isinstance(caminho, str),
           "caminho_referencia precisa ser texto (o caminho, nao o arquivo)")
    return rec


def registrar_biblioteca(item_id, tipo, titulo, metadado=None,
                         caminho_referencia=None, teste=False, anonimizado=False):
    """Guarda a REFERENCIA (id + metadado + caminho). NUNCA abre/copia o arquivo."""
    rec = {"item_id": item_id, "tipo": tipo, "titulo": titulo,
           "metadado": metadado or {}, "caminho_referencia": caminho_referencia}
    validar_biblioteca(rec)
    _exigir_sem_pii(rec, anonimizado, "biblioteca")
    loja = _store()
    existentes = loja.listar("biblioteca", "item_id", rec["item_id"])
    if existentes:
        return {"registrado": False, "ja_existia": True, "registro": existentes[-1],
                "storage": loja.nome}
    linha = {"id": _novo_id(), "item_id": rec["item_id"], "tipo": rec["tipo"],
             "titulo": rec["titulo"].strip(), "metadado": rec["metadado"],
             "caminho_referencia": caminho_referencia, "criado_em": agora()}
    loja.inserir("biblioteca", linha)
    return {"registrado": True, "registro": linha, "storage": loja.nome}


def ler_biblioteca(item_id=None):
    return _store().listar("biblioteca", "item_id", item_id)


# ------------------------------------------------------- limpeza (so testes)
def apagar_calendario(solicitacao_id):
    return _store().apagar("calendario", "solicitacao_id", solicitacao_id)


def apagar_biblioteca(item_id):
    return _store().apagar("biblioteca", "item_id", item_id)


def apagar_aprovacao(solicitacao_id):
    return _store().apagar("aprovacoes", "solicitacao_id", solicitacao_id)


def apagar_publicacao(peca_id):
    return _store().apagar("publicacoes", "peca_id", peca_id)


def apagar_metrica(publicacao_id):
    return _store().apagar("metricas", "publicacao_id", publicacao_id)


if __name__ == "__main__":
    print(json.dumps(estado(), indent=2, ensure_ascii=False))
