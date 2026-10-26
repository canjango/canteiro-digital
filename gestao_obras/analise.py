"""Análise e categorização: avanço físico, prazo, custos, compras e tarefas,
com geração de alertas priorizados."""

from __future__ import annotations

from collections import OrderedDict
from dataclasses import dataclass
from datetime import date, timedelta

from .etapas import CATEGORIAS
from .modelos import CATEGORIAS_COMPRA, PRIORIDADES, STATUS_COMPRA, STATUS_TAREFA, Etapa, Obra, ler_data

COMPROMETIDAS = ("Aprovada", "Pedido feito", "Entregue")
ABERTAS = ("Solicitada", "Em cotação", "Aprovada", "Pedido feito")


@dataclass
class Alerta:
    nivel: str  # "critico" | "atencao" | "info"
    titulo: str
    detalhe: str
    aba: str = "painel"

    @property
    def ordem(self) -> int:
        return {"critico": 0, "atencao": 1, "info": 2}[self.nivel]


# ================================================================ etapas
def progresso_etapa(etapa: Etapa) -> float:
    if not etapa.checklist:
        return 0.0
    return sum(1 for i in etapa.checklist if i.feito) / len(etapa.checklist)


def etapa_concluida(etapa: Etapa) -> bool:
    return bool(etapa.checklist) and all(i.feito for i in etapa.checklist)


def predecessoras_pendentes(obra: Obra, etapa: Etapa) -> list[str]:
    pend = []
    for cod in etapa.predecessoras:
        try:
            if not etapa_concluida(obra.etapa(cod)):
                pend.append(cod)
        except ValueError:
            continue  # predecessora removida do catálogo da obra
    return pend


def status_etapa(obra: Obra, etapa: Etapa, hoje: date | None = None) -> str:
    hoje = hoje or date.today()
    p = progresso_etapa(etapa)
    if etapa_concluida(etapa):
        return "Concluída"
    fim = ler_data(etapa.fim_previsto)
    atrasada = bool(fim and fim < hoje)
    if p > 0:
        return "Atrasada" if atrasada else "Em andamento"
    if predecessoras_pendentes(obra, etapa):
        return "Atrasada" if atrasada else "Aguardando"
    return "Atrasada" if atrasada else "Liberada"


def fracao_prevista(etapa: Etapa, hoje: date) -> float:
    """Quanto da etapa deveria estar pronto hoje, pelo cronograma (linear)."""
    ini, fim = ler_data(etapa.inicio_previsto), ler_data(etapa.fim_previsto)
    if not (ini and fim):
        return 0.0
    if hoje < ini:
        return 0.0
    if hoje >= fim:
        return 1.0
    total = (fim - ini).days + 1
    return ((hoje - ini).days + 1) / total


def progresso_fisico(obra: Obra) -> float:
    peso = sum(e.peso for e in obra.etapas)
    if not peso:
        return 0.0
    return sum(e.peso * progresso_etapa(e) for e in obra.etapas) / peso


def progresso_previsto(obra: Obra, hoje: date | None = None) -> float:
    hoje = hoje or date.today()
    peso = sum(e.peso for e in obra.etapas)
    if not peso:
        return 0.0
    return sum(e.peso * fracao_prevista(e, hoje) for e in obra.etapas) / peso


def idp(obra: Obra, hoje: date | None = None) -> float | None:
    """Índice de desempenho de prazo (realizado / previsto). None se ainda
    não há avanço previsto."""
    prev = progresso_previsto(obra, hoje)
    if prev <= 0:
        return None
    return progresso_fisico(obra) / prev


def por_categoria_etapa(obra: Obra) -> "OrderedDict[str, dict]":
    """Avanço agrupado por fase macro (categoria)."""
    novo = lambda: {"peso": 0.0, "feito": 0.0, "etapas": 0, "orcado": 0.0, "executado": 0.0}  # noqa: E731
    res: OrderedDict[str, dict] = OrderedDict((c, novo()) for c in CATEGORIAS)
    for e in obra.etapas:
        g = res.setdefault(e.categoria, novo())
        p = progresso_etapa(e)
        g["peso"] += e.peso
        g["feito"] += e.peso * p
        g["etapas"] += 1
        g["orcado"] += e.orcamento
        g["executado"] += e.orcamento * p
    for g in res.values():
        g["progresso"] = g["feito"] / g["peso"] if g["peso"] else 0.0
    return OrderedDict((k, v) for k, v in res.items() if v["etapas"])


# ================================================================ custos
def custos_por_etapa(obra: Obra) -> list[dict]:
    linhas = []
    for e in obra.etapas:
        compras = [c for c in obra.compras if c.etapa == e.codigo]
        comprometido = sum(c.valor_total for c in compras if c.status in COMPROMETIDAS)
        realizado = sum(c.valor_total for c in compras if c.status == "Entregue")
        prog = progresso_etapa(e)
        executado = round(e.orcamento * prog, 2)  # medição: orçado × avanço físico da etapa
        linhas.append(
            {
                "codigo": e.codigo,
                "nome": e.nome,
                "progresso": prog,
                "orcado": e.orcamento,
                "executado": executado,
                "a_executar": round(e.orcamento - executado, 2),
                "comprometido": round(comprometido, 2),
                "realizado": round(realizado, 2),
                "saldo": round(e.orcamento - comprometido, 2),
                "uso": (comprometido / e.orcamento) if e.orcamento else None,
            }
        )
    return linhas


def custos_por_categoria(obra: Obra) -> "OrderedDict[str, float]":
    res: OrderedDict[str, float] = OrderedDict((c, 0.0) for c in CATEGORIAS_COMPRA)
    for c in obra.compras:
        if c.status in COMPROMETIDAS:
            res[c.categoria] = round(res.get(c.categoria, 0.0) + c.valor_total, 2)
    return res


def resumo_financeiro(obra: Obra) -> dict:
    comprometido = sum(c.valor_total for c in obra.compras if c.status in COMPROMETIDAS)
    realizado = sum(c.valor_total for c in obra.compras if c.status == "Entregue")
    em_aberto = sum(c.valor_total for c in obra.compras if c.status in ("Solicitada", "Em cotação"))
    orc = obra.orcamento_total
    executado = sum(e.orcamento * progresso_etapa(e) for e in obra.etapas)
    orcado_etapas = sum(e.orcamento for e in obra.etapas)
    return {
        "orcado": orc,
        "orcado_etapas": round(orcado_etapas, 2),
        "executado": round(executado, 2),
        "a_executar": round(orcado_etapas - executado, 2),
        "executado_pct": (executado / orcado_etapas) if orcado_etapas else None,
        "comprometido": round(comprometido, 2),
        "realizado": round(realizado, 2),
        "em_aberto": round(em_aberto, 2),
        "saldo": round(orc - comprometido, 2),
        "uso": (comprometido / orc) if orc else None,
    }


# ================================================================ compras e tarefas
def contagem(itens, campo: str, ordem) -> "OrderedDict[str, int]":
    res: OrderedDict[str, int] = OrderedDict((k, 0) for k in ordem)
    for i in itens:
        v = getattr(i, campo)
        res[v] = res.get(v, 0) + 1
    return res


def compras_atrasadas(obra: Obra, hoje: date | None = None) -> list:
    hoje = hoje or date.today()
    return [
        c
        for c in obra.compras
        if c.status in ABERTAS and (d := ler_data(c.data_necessidade)) and d < hoje
    ]


def compras_proximas(obra: Obra, hoje: date | None = None, dias: int = 7) -> list:
    """Compras ainda sem pedido que vencem nos próximos `dias`."""
    hoje = hoje or date.today()
    limite = hoje + timedelta(days=dias)
    return [
        c
        for c in obra.compras
        if c.status in ("Solicitada", "Em cotação", "Aprovada")
        and (d := ler_data(c.data_necessidade))
        and hoje <= d <= limite
    ]


def tarefas_atrasadas(obra: Obra, hoje: date | None = None) -> list:
    hoje = hoje or date.today()
    return [t for t in obra.tarefas if t.status != "Concluída" and (d := ler_data(t.prazo)) and d < hoje]


def progresso_tarefa(tarefa) -> float:
    if tarefa.status == "Concluída":
        return 1.0
    if not tarefa.checklist:
        return 0.0
    return sum(1 for i in tarefa.checklist if i.feito) / len(tarefa.checklist)


# ================================================================ alertas
def alertas(obra: Obra, hoje: date | None = None) -> list[Alerta]:
    hoje = hoje or date.today()
    out: list[Alerta] = []

    for c in compras_atrasadas(obra, hoje):
        dias = (hoje - ler_data(c.data_necessidade)).days
        out.append(Alerta("critico", f"Compra atrasada: {c.descricao}", f"{c.status} · necessária há {dias} dia(s)", "compras"))
    for c in compras_proximas(obra, hoje):
        out.append(Alerta("atencao", f"Comprar até {_br(c.data_necessidade)}: {c.descricao}", f"Situação: {c.status}", "compras"))
    for t in tarefas_atrasadas(obra, hoje):
        out.append(Alerta("critico" if t.prioridade in ("Alta", "Urgente") else "atencao",
                          f"Tarefa atrasada: {t.titulo}", f"Prazo {_br(t.prazo)} · {t.responsavel or 'sem responsável'}", "tarefas"))

    for e in obra.etapas:
        st = status_etapa(obra, e, hoje)
        pend = predecessoras_pendentes(obra, e)
        if progresso_etapa(e) > 0 and pend:
            out.append(Alerta("atencao", f"{e.nome} iniciada fora de sequência",
                              "Predecessoras pendentes: " + ", ".join(pend), "etapas"))
        if st == "Atrasada":
            out.append(Alerta("critico", f"Etapa atrasada: {e.nome}",
                              f"Fim previsto {_br(e.fim_previsto)} · {progresso_etapa(e):.0%} concluída", "etapas"))
        ini = ler_data(e.inicio_previsto)
        if ini and hoje <= ini <= hoje + timedelta(days=15) and not etapa_concluida(e):
            if not any(c.etapa == e.codigo and c.status != "Cancelada" for c in obra.compras):
                out.append(Alerta("info", f"{e.nome} começa em {(ini - hoje).days} dia(s) sem compras lançadas",
                                  "Planeje materiais e mão de obra", "compras"))

    for linha in custos_por_etapa(obra):
        if linha["orcado"] and linha["comprometido"] > linha["orcado"]:
            out.append(Alerta("critico", f"Estouro de orçamento: {linha['nome']}",
                              f"Comprometido {moeda(linha['comprometido'])} de {moeda(linha['orcado'])}", "compras"))

    indice = idp(obra, hoje)
    if indice is not None and indice < 0.9:
        out.append(Alerta("critico" if indice < 0.75 else "atencao", "Obra abaixo do previsto",
                          f"Avanço físico {progresso_fisico(obra):.0%} contra {progresso_previsto(obra, hoje):.0%} previsto", "painel"))

    out.sort(key=lambda a: a.ordem)
    return out


def resumo(obra: Obra, hoje: date | None = None) -> dict:
    hoje = hoje or date.today()
    return {
        "progresso_fisico": progresso_fisico(obra),
        "progresso_previsto": progresso_previsto(obra, hoje),
        "idp": idp(obra, hoje),
        "financeiro": resumo_financeiro(obra),
        "fases": por_categoria_etapa(obra),
        "status_etapas": contagem_status_etapas(obra, hoje),
        "compras_status": contagem(obra.compras, "status", STATUS_COMPRA),
        "tarefas_status": contagem(obra.tarefas, "status", STATUS_TAREFA),
        "tarefas_prioridade": contagem([t for t in obra.tarefas if t.status != "Concluída"], "prioridade", PRIORIDADES),
        "custos_categoria": custos_por_categoria(obra),
        "alertas": alertas(obra, hoje),
    }


def contagem_status_etapas(obra: Obra, hoje: date) -> "OrderedDict[str, int]":
    ordem = ("Concluída", "Em andamento", "Liberada", "Aguardando", "Atrasada")
    res: OrderedDict[str, int] = OrderedDict((k, 0) for k in ordem)
    for e in obra.etapas:
        res[status_etapa(obra, e, hoje)] += 1
    return res


# ================================================================ formatação
def moeda(v: float) -> str:
    s = f"{abs(v):,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    return f"-R$ {s}" if v < 0 else f"R$ {s}"


def _br(iso: str) -> str:
    d = ler_data(iso)
    return d.strftime("%d/%m/%Y") if d else "—"


data_br = _br
