from datetime import date

import pytest

from gestao_obras import analise as an
from gestao_obras import controle as ct
from gestao_obras import servicos as sv
from gestao_obras.base_compras import ITENS_BASE
from gestao_obras.modelos import Obra, ValidacaoErro
from gestao_obras.sistema import Sistema
from gestao_obras.ui import render

HOJE = date(2026, 10, 27)


def obra_com_base(area=100.68):
    o = sv.criar_obra("Residência Azeneildo", area_construida=str(area), inicio="2026-11-03", fim_previsto="2027-04-15")
    ct.carregar_base(o)
    return o


def test_base_identica_a_planilha():
    o = obra_com_base()
    r = ct.resumo(o)
    assert len(o.controle) == len(ITENS_BASE) == 146
    assert r["base"] == pytest.approx(253858.66, abs=0.01)
    assert r["base_materiais"] == pytest.approx(167642.21, abs=0.01)
    assert r["base_mao_obra"] == pytest.approx(86216.45, abs=0.01)
    esperado = {"1. Serviços Iniciais": 13351.78, "2. Fundação": 22973.16, "3. Estrutura de Concreto Armado": 35535.12,
                "4. Cobertura": 12121.00, "5. Vedações": 28475.46, "6. Revestimentos e Pisos": 99744.84,
                "7. Louças, Metais e Bancadas": 9640.40, "8. Esquadrias": 13944.30,
                "9. Instalações (Elétrica, Hidrossanitária e Drenagem)": 18072.60}
    for e, v in esperado.items():
        assert r["linhas"][e]["base"] == pytest.approx(v, abs=0.01)
    assert r["qtd_estimada"] == 33
    assert sum(1 for i in o.controle if i.tipo == "mao_de_obra") == 34
    betoneira = next(i for i in o.controle if i.descricao == "Betoneira")
    assert betoneira.novo and betoneira.forma == "A Prazo" and betoneira.parcelas == 10
    # todo item ligado a uma etapa da obra
    assert all(i.etapa in {e.codigo for e in o.etapas} for i in o.controle)
    with pytest.raises(ValidacaoErro):
        ct.carregar_base(o)  # não duplica nem apaga


def test_ajuste_por_area_mantem_todos_os_itens():
    o = sv.criar_obra("Casa 150", area_construida="150")
    ct.carregar_base(o, ajustar_area=True)
    assert len(o.controle) == 146 and "150" in o.controle_origem
    assert ct.resumo(o)["base"] > 253858.66 * 1.3


def test_calculos_iguais_a_planilha():
    o = obra_com_base()
    it = next(i for i in o.controle if i.descricao == "Cimento Portland CP-II-32")
    base = it.total_base
    ct.salvar_item(o, it.id, {"fornecedor_1": "Loja A", "vista_1": "36,50", "prazo_1": "39",
                              "fornecedor_2": "Loja B", "vista_2": "35,90", "prazo_2": "40", "forma": "À Vista"})
    assert it.escolhida == 1 and it.fornecedor == "Loja B"          # menor à vista
    assert it.valor_aplicado == 35.90 and it.total_compra == pytest.approx(it.quantidade * 35.90)
    assert it.diferenca == pytest.approx(base - it.total_compra, abs=0.01)
    assert it.status == "Cotação solicitada"
    ct.salvar_item(o, it.id, {"forma": "A Prazo", "parcelas": "3", "fornecedor_1": "Loja A", "vista_1": "36,50", "prazo_1": "39",
                              "fornecedor_2": "Loja B", "vista_2": "35,90", "prazo_2": "40"})
    assert it.escolhida == 0 and it.valor_aplicado == 39                 # menor a prazo
    assert it.valor_parcela == pytest.approx(it.total_compra / 3, abs=0.01)
    ct.salvar_item(o, it.id, {"escolhida": "1", "fornecedor_1": "Loja A", "vista_1": "36,50", "prazo_1": "39",
                              "fornecedor_2": "Loja B", "vista_2": "35,90", "prazo_2": "40"})
    assert it.escolhida == 1 and it.valor_aplicado == 40                 # escolha manual


def test_fluxo_de_status_e_pagamentos():
    o = obra_com_base()
    it = next(i for i in o.controle if i.descricao == "Betoneira")
    with pytest.raises(ValidacaoErro):
        ct.mudar_status(o, it.id, "Comprado", HOJE)                      # sem cotação não compra
    ct.salvar_item(o, it.id, {"fornecedor_1": "Loja", "vista_1": "4.500", "prazo_1": "4.800", "forma": "A Prazo", "parcelas": "10"})
    ct.mudar_status(o, it.id, "Comprado", HOJE)
    assert it.data_compra == "2026-10-27"
    fluxo = ct.fluxo_pagamentos(o)
    assert list(fluxo)[0] == "11/2026" and len(fluxo) == 10 and sum(fluxo.values()) == pytest.approx(4800)
    with pytest.raises(ValidacaoErro):
        ct.remover_item(o, it.id)                                       # comprado não sai
    # comprado entra no comprometido do painel e na medição da etapa
    assert an.resumo_financeiro(o)["comprometido"] == pytest.approx(4800)
    assert next(l for l in an.custos_por_etapa(o) if l["codigo"] == "PRE")["comprometido"] == pytest.approx(4800)
    ct.mudar_status(o, it.id, "Entregue", HOJE)
    assert it.data_entrega and an.resumo_financeiro(o)["realizado"] == pytest.approx(4800)


def test_programacao_e_alerta():
    o = obra_com_base()
    prog = ct.programacao(o, HOJE, dias=30)
    assert prog and prog[0][0].etapa == "PRE"
    assert prog[0][1] == date(2026, 10, 27)  # início 03/11 − 7 dias (material)
    assert any("Controle de compras" in a.titulo for a in an.alertas(o, HOJE))


def test_persistencia():
    o = obra_com_base()
    ct.salvar_item(o, o.controle[0].id, {"fornecedor_1": "X", "vista_1": "90"})
    o2 = Obra.de_dict(o.para_dict())
    assert len(o2.controle) == 146 and o2.controle[0].total_compra == o.controle[0].total_compra
    d = o.para_dict()
    d.pop("controle")
    assert Obra.de_dict(d).controle == []  # obras antigas


def test_interface_controle():
    s = Sistema(hoje=HOJE)
    s.despachar("obra.criar", {"nome": "Azeneildo", "area_construida": "100,68", "inicio": "2026-11-03", "fim_previsto": "2027-04-15"})
    s.despachar("ui.aba", {"aba": "compras"})
    html = render(s)
    assert 'data-action="ctrl.carregar"' in html and "Metodologia de compras" in html
    assert s.despachar("ctrl.carregar", {"ajustar": "0"})["ok"]
    html = render(s)
    assert "Resumo geral por etapa" in html and "R$ 253.858,66" in html and "Programação de compras" in html
    assert s.despachar("ui.ctrl_etapa", {"etapa": "2. Fundação"})["ok"]
    it = next(i for i in s.obra.controle if i.etapa_base == "2. Fundação")
    s.despachar("ui.ctrl_item", {"id": it.id})
    html = render(s)
    assert f'data-action="ctrl.salvar" data-id="{it.id}"' in html and 'name="vista_1"' in html
    r = s.despachar("ctrl.salvar", {"id": it.id, "fornecedor_1": "Depósito", "vista_1": "10", "forma": "À Vista"})
    assert r["ok"] and r["alteradas"] == [s.obra.id]
    assert s.despachar("ctrl.status", {"id": it.id, "status": "Comprado"})["ok"]
    assert s.despachar("ui.ctrl_status", {"status": "Comprado"})["ok"]
    html = render(s)
    assert html.count('class="ctl-linha') == 1
    # remoção pede confirmação
    outro = next(i for i in s.obra.controle if i.etapa_base == "2. Fundação" and i.status == "A cotar")
    s.despachar("ctrl.remover", {"id": outro.id})
    assert outro in s.obra.controle
    s.despachar("ctrl.remover", {"id": outro.id})
    assert outro not in s.obra.controle
    assert s.despachar("ctrl.novo", {"descricao": "Bloco extra", "etapa_base": "5. Vedações", "quantidade": "10", "valor_base": "3"})["ok"]
    assert s.obra.controle[-1].etapa == "ALV" and s.ui["ctrl_etapa"] == "5. Vedações"
    assert not s.despachar("ui.ctrl_status", {"status": "xyz"})["ok"]
