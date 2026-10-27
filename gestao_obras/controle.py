"""Metodologia de compras: controle item a item, no formato da planilha
"Controle e Gestão de Compras da Obra".

Fluxo de cada item (material ou mão de obra):
  1. Base      — quantidade × preço de referência (orçado, sem BDI).
  2. Programação — "comprar até" = início previsto da etapa − antecedência
                 (7 dias para material, 3 dias para contratar mão de obra).
  3. Cotação   — até 3 fornecedores, com preço à vista e a prazo; o menor preço
                 na forma de pagamento escolhida é sugerido automaticamente.
  4. Decisão   — forma de pagamento (à vista / a prazo) e nº de parcelas.
  5. Compra    — status "Comprado" (exige cotação escolhida) e depois "Entregue".
  6. Controle  — diferença compra × base por item e por etapa, e fluxo mensal de pagamentos.
"""

from __future__ import annotations

from collections import OrderedDict
from datetime import date, timedelta

from .base_compras import AREA_REFERENCIA, ETAPAS_BASE, ITENS_BASE, ORIGEM
from .modelos import (
    FORMAS_PAGAMENTO,
    STATUS_CONTROLE,
    ItemControle,
    Obra,
    ValidacaoErro,
    ler_numero,
)

ANTECEDENCIA = {"material": 7, "mao_de_obra": 3}  # dias antes do início da etapa
MAX_COTACOES = 3

# --------------------------------------------------------------- etapa da planilha → etapa da obra
_ETAPA_FIXA = {"1": "PRE", "2": "FUN", "3": "EST", "4": "COB", "5": "ALV", "7": "LOU", "8": "ESQ"}


def etapa_sistema(etapa_base: str, grupo: str, descricao: str = "") -> str:
    """Liga o item à etapa da obra no sistema (para o prazo de compra e os alertas)."""
    n = (etapa_base or "").split(".")[0].strip()
    if n in _ETAPA_FIXA:
        return _ETAPA_FIXA[n]
    t = f"{grupo} {descricao}".lower()
    if n == "6":
        if any(k in t for k in ("pint", "selador", "tinta", "massa acrílica", "pintor")):
            return "PIN"
        if any(k in t for k in ("forro", "gesso", "gesseiro")):
            return "FOR"
        if any(k in t for k in ("contrapiso", "piso", "porcelanato", "rodapé", "soleira")):
            return "PIS"
        return "REV"
    if n == "9":
        if any(k in t for k in ("elétric", "eletric", "fio", "disjuntor", "tomada", "eletroduto", "quadro")):
            return "ELE"
        return "HID"
    return ""


# --------------------------------------------------------------- carga da base
def carregar_base(obra: Obra, ajustar_area: bool = False) -> int:
    """Carrega os 146 itens da planilha. Não apaga nada: só funciona com o controle vazio."""
    if obra.controle:
        raise ValidacaoErro("O controle de compras desta obra já tem itens")
    fator = (obra.area_construida / AREA_REFERENCIA) if ajustar_area and obra.area_construida else 1.0
    for (ie, grupo, tipo, desc, espec, un, qtd, base, fonte, obs, marcas, forma, parc) in ITENS_BASE:
        etapa_base = ETAPAS_BASE[ie]
        q = qtd
        if fator != 1.0:
            q = qtd * fator
            q = max(1, round(q)) if un in ("un", "vb", "chapa", "rolo", "jogo", "cj") or float(qtd).is_integer() else round(q, 2)
        obra.controle.append(ItemControle(
            descricao=desc, etapa_base=etapa_base, etapa=etapa_sistema(etapa_base, grupo, desc), grupo=grupo,
            tipo="mao_de_obra" if tipo == "MO" else "material", especificacao=espec, unidade=un,
            quantidade=float(q), valor_base=float(base), forma=forma or "", parcelas=int(parc or 0),
            fonte_preco={"P": "pesquisado", "E": "estimado"}.get(fonte, ""), qtd_estimada="E" in marcas,
            novo="N" in marcas, observacao=obs,
        ))
    obra.controle_origem = ORIGEM + (f" · quantidades ajustadas para {obra.area_construida:g} m²" if fator != 1.0 else "")
    return len(ITENS_BASE)


def etapas_controle(obra: Obra) -> list[str]:
    """Etapas do controle na ordem da planilha (e as criadas pelo usuário, no fim)."""
    vistas = list(ETAPAS_BASE)
    for i in obra.controle:
        if i.etapa_base not in vistas:
            vistas.append(i.etapa_base)
    presentes = {i.etapa_base for i in obra.controle}
    return [e for e in vistas if e in presentes]


# --------------------------------------------------------------- edição
def _texto(v, maximo=200) -> str:
    return " ".join(str(v or "").split())[:maximo]


def melhor_cotacao(item: ItemControle) -> int:
    """Índice da cotação mais barata na forma de pagamento do item (-1 se não houver preço)."""
    melhor, idx = None, -1
    for i, c in enumerate(item.cotacoes):
        v = (c.get("prazo") or c.get("vista")) if item.forma == "A Prazo" else (c.get("vista") or c.get("prazo"))
        if v and (melhor is None or v < melhor):
            melhor, idx = v, i
    return idx


def salvar_item(obra: Obra, item_id: str, d: dict) -> ItemControle:
    it = obra.item_controle(item_id)
    if "quantidade" in d:
        it.quantidade = ler_numero(d.get("quantidade"), "Quantidade")
    if "valor_base" in d:
        it.valor_base = ler_numero(d.get("valor_base"), "Valor base")
    cot = []
    for n in range(1, MAX_COTACOES + 1):
        forn = _texto(d.get(f"fornecedor_{n}"))
        vista = ler_numero(d.get(f"vista_{n}"), f"À vista (cotação {n})")
        prazo = ler_numero(d.get(f"prazo_{n}"), f"A prazo (cotação {n})")
        if forn or vista or prazo:
            cot.append({"fornecedor": forn or f"Fornecedor {n}", "vista": vista, "prazo": prazo})
    if any(f"fornecedor_{n}" in d or f"vista_{n}" in d for n in range(1, MAX_COTACOES + 1)):
        it.cotacoes = cot
    if "forma" in d:
        forma = d.get("forma") or ""
        if forma and forma not in FORMAS_PAGAMENTO:
            raise ValidacaoErro("Forma de pagamento inválida")
        it.forma = forma
    if "parcelas" in d:
        p = int(ler_numero(d.get("parcelas") or 0, "Nº de parcelas"))
        if p > 48:
            raise ValidacaoErro("Nº de parcelas acima de 48 — confira")
        it.parcelas = p
    if it.forma == "A Prazo" and it.parcelas < 1:
        it.parcelas = 1
    if it.forma != "A Prazo":
        it.parcelas = 0 if it.forma == "À Vista" else it.parcelas
    # cotação escolhida: a indicada pelo usuário, senão a mais barata
    esc = str(d.get("escolhida", "")).strip()
    if esc.isdigit() and int(esc) < len(it.cotacoes):
        it.escolhida = int(esc)
    else:  # "automático": menor preço na forma de pagamento
        it.escolhida = melhor_cotacao(it)
    if "observacao" in d:
        it.observacao = _texto(d.get("observacao"), 500)
    if it.cotacoes and it.status == "A cotar":
        it.status = "Cotação solicitada"
    if not it.cotacoes and it.status in ("Comprado", "Entregue"):
        raise ValidacaoErro("Item comprado precisa de pelo menos uma cotação")
    return it


def mudar_status(obra: Obra, item_id: str, status: str, hoje: date) -> ItemControle:
    it = obra.item_controle(item_id)
    if status not in STATUS_CONTROLE:
        raise ValidacaoErro("Situação inválida")
    if status in ("Comprado", "Entregue") and not it.total_compra:
        raise ValidacaoErro("Registre a cotação (fornecedor e preço) antes de marcar como comprado")
    if status in ("Comprado", "Entregue") and not it.forma:
        it.forma = "À Vista"
    if status in ("Comprado", "Entregue") and not it.data_compra:
        it.data_compra = hoje.isoformat()
    if status == "Entregue" and not it.data_entrega:
        it.data_entrega = hoje.isoformat()
    if status in ("A cotar", "Cotação solicitada"):
        it.data_compra = it.data_entrega = ""
    if status == "Comprado":
        it.data_entrega = ""
    it.status = status
    return it


def novo_item(obra: Obra, d: dict) -> ItemControle:
    desc = _texto(d.get("descricao"))
    if not desc:
        raise ValidacaoErro("Informe o material ou serviço")
    etapa_base = _texto(d.get("etapa_base")) or (ETAPAS_BASE[0])
    tipo = "mao_de_obra" if d.get("tipo") == "mao_de_obra" else "material"
    grupo = _texto(d.get("grupo"), 60) or ("Mão de Obra" if tipo == "mao_de_obra" else "Material")
    it = ItemControle(
        descricao=desc, etapa_base=etapa_base, etapa=etapa_sistema(etapa_base, grupo, desc), grupo=grupo, tipo=tipo,
        especificacao=_texto(d.get("especificacao")), unidade=_texto(d.get("unidade"), 20) or "un",
        quantidade=ler_numero(d.get("quantidade") or 1, "Quantidade"), valor_base=ler_numero(d.get("valor_base"), "Valor base"),
        novo=True,
    )
    obra.controle.append(it)
    return it


def remover_item(obra: Obra, item_id: str) -> None:
    it = obra.item_controle(item_id)
    if it.status in ("Comprado", "Entregue"):
        raise ValidacaoErro("Item já comprado não pode ser removido")
    obra.controle.remove(it)


# --------------------------------------------------------------- análise
def comprar_ate(obra: Obra, it: ItemControle) -> date | None:
    from .servicos import ler_data

    if not it.etapa:
        return None
    try:
        ini = ler_data(obra.etapa(it.etapa).inicio_previsto)
    except ValidacaoErro:
        return None
    if not ini:
        return None
    return ini - timedelta(days=ANTECEDENCIA.get(it.tipo, 7))


def pendente(it: ItemControle) -> bool:
    return it.status in ("A cotar", "Cotação solicitada")


def resumo(obra: Obra) -> dict:
    """Resumo geral no formato da planilha + indicadores da metodologia."""
    linhas = OrderedDict()
    for e in etapas_controle(obra):
        itens = [i for i in obra.controle if i.etapa_base == e]
        mat = sum(i.total_base for i in itens if i.tipo == "material")
        mo = sum(i.total_base for i in itens if i.tipo == "mao_de_obra")
        compra = sum(i.total_compra for i in itens)
        base_cotada = sum(i.total_base for i in itens if i.total_compra)
        linhas[e] = {
            "itens": len(itens), "base_materiais": round(mat, 2), "base_mao_obra": round(mo, 2),
            "base": round(mat + mo, 2), "compra": round(compra, 2),
            "base_cotada": round(base_cotada, 2),
            "diferenca": round(base_cotada - compra, 2) if compra else None,
            "variacao": ((base_cotada - compra) / base_cotada) if compra and base_cotada else None,
            "comprados": sum(1 for i in itens if not pendente(i)),
        }
    itens = obra.controle
    base = sum(i.total_base for i in itens)
    compra = sum(i.total_compra for i in itens)
    base_cotada = sum(i.total_base for i in itens if i.total_compra)
    comprado = sum(i.total_compra for i in itens if i.status in ("Comprado", "Entregue"))
    return {
        "linhas": linhas,
        "itens": len(itens),
        "base_materiais": round(sum(i.total_base for i in itens if i.tipo == "material"), 2),
        "base_mao_obra": round(sum(i.total_base for i in itens if i.tipo == "mao_de_obra"), 2),
        "base": round(base, 2),
        "compra": round(compra, 2),  # cotado (inclui não comprados com cotação escolhida)
        "comprado": round(comprado, 2),  # comprado ou entregue
        "base_cotada": round(base_cotada, 2),
        "diferenca": round(base_cotada - compra, 2) if compra else None,
        "variacao": ((base_cotada - compra) / base_cotada) if compra and base_cotada else None,
        "status": OrderedDict((s, sum(1 for i in itens if i.status == s)) for s in STATUS_CONTROLE),
        "qtd_estimada": sum(1 for i in itens if i.qtd_estimada),
        "a_prazo": round(sum(i.total_compra for i in itens if i.forma == "A Prazo" and i.status in ("Comprado", "Entregue")), 2),
    }


def _somar_meses(d: date, n: int) -> tuple[int, int]:
    m = d.month - 1 + n
    return d.year + m // 12, m % 12 + 1


def fluxo_pagamentos(obra: Obra) -> "OrderedDict[str, float]":
    """Desembolso mensal dos itens comprados: à vista no mês da compra; a prazo em
    parcelas mensais a partir do mês seguinte (como no cartão de crédito)."""
    meses: dict[tuple[int, int], float] = {}
    from .servicos import ler_data

    for it in obra.controle:
        if it.status not in ("Comprado", "Entregue") or not it.total_compra:
            continue
        d = ler_data(it.data_compra) or date.today()
        if it.forma == "A Prazo" and it.parcelas > 1:
            for k in range(1, it.parcelas + 1):
                chave = _somar_meses(d, k)
                meses[chave] = meses.get(chave, 0) + it.total_compra / it.parcelas
        else:
            chave = (d.year, d.month)
            meses[chave] = meses.get(chave, 0) + it.total_compra
    return OrderedDict((f"{m:02d}/{a}", round(v, 2)) for (a, m), v in sorted(meses.items()))


def programacao(obra: Obra, hoje: date, dias: int = 30) -> list[tuple[ItemControle, date]]:
    """Itens ainda não comprados cujo prazo de compra vence em até `dias` (ou já venceu)."""
    out = []
    for it in obra.controle:
        if not pendente(it):
            continue
        ate = comprar_ate(obra, it)
        if ate and ate <= hoje + timedelta(days=dias):
            out.append((it, ate))
    out.sort(key=lambda x: x[1])
    return out
