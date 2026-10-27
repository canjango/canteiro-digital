"""Padrão construtivo e valor por m²."""

from datetime import date

import pytest

from gestao_obras import analise as an
from gestao_obras import servicos as sv
from gestao_obras.modelos import Obra, ValidacaoErro
from gestao_obras.padroes import PADROES, valor_referencia
from gestao_obras.sistema import Sistema
from gestao_obras.ui import render

HOJE = date(2026, 10, 26)


def test_padroes_em_ordem_crescente_de_custo():
    assert valor_referencia("R1-B") < valor_referencia("R1-N") < valor_referencia("R1-MA") < valor_referencia("R1-A")
    assert list(PADROES) == ["R1-B", "R1-N", "R1-MA", "R1-A", "PERS"]  # ordem do seletor


def test_padrao_medio_alto_e_a_media_entre_normal_e_alto():
    assert valor_referencia("R1-MA") == round((valor_referencia("R1-N") + valor_referencia("R1-A")) / 2, 2)
    o = sv.criar_obra("Casa", padrao="R1-MA", area_construida="100")
    assert o.padrao == "R1-MA" and o.orcamento_total == pytest.approx(100 * valor_referencia("R1-MA"))
    s = Sistema(hoje=HOJE)
    s.despachar("obra.criar", {"nome": "Casa", "padrao": "R1-MA"})
    s.despachar("ui.aba", {"aba": "obras"})
    html = render(s)
    assert "Médio/alto (entre R1-N e R1-A)" in html and "padrão médio/alto" in html


def test_obra_sem_orcamento_usa_area_vezes_m2():
    o = sv.criar_obra("Casa", area_construida="100", padrao="R1-N")
    assert o.valor_m2 == valor_referencia("R1-N")
    assert o.orcamento_total == pytest.approx(100 * valor_referencia("R1-N"), abs=0.01)
    assert sum(e.orcamento for e in o.etapas) == pytest.approx(o.orcamento_total, abs=0.1)


def test_orcamento_informado_prevalece():
    o = sv.criar_obra("Casa", orcamento_total="300.000", padrao="R1-A")
    assert o.orcamento_total == 300_000 and o.padrao == "R1-A"


def test_valor_m2_proprio_e_personalizado():
    o = sv.criar_obra("Casa", padrao="R1-N", valor_m2="2.450,00", area_construida="120")
    assert o.valor_m2 == 2450 and o.orcamento_total == 294_000
    p = sv.criar_obra("Casa", padrao="PERS", valor_m2="3100")
    assert p.valor_m2 == 3100
    with pytest.raises(ValidacaoErro):
        sv.criar_obra("Casa", padrao="PERS")             # personalizado sem valor
    with pytest.raises(ValidacaoErro):
        sv.criar_obra("Casa", padrao="R9")
    with pytest.raises(ValidacaoErro):
        sv.criar_obra("Casa", valor_m2="12")             # valor absurdo


def test_trocar_padrao_na_edicao_atualiza_valor():
    s = Sistema(hoje=HOJE)
    s.despachar("obra.criar", {"nome": "Casa", "orcamento_total": "250.000"})
    o = s.obra
    base = {"nome": "Casa", "inicio": "", "fim_previsto": "", "area_construida": "100",
            "orcamento_total": "250.000,00", "valor_m2": "2.690,33"}  # campo como a tela mostra
    assert s.despachar("obra.editar", {**base, "padrao": "R1-A"})["ok"]
    assert o.padrao == "R1-A" and o.valor_m2 == valor_referencia("R1-A")
    # usuário digita o CUB do estado dele: valor próprio é mantido
    assert s.despachar("obra.editar", {**base, "padrao": "R1-A", "valor_m2": "2.980,00"})["ok"]
    assert o.valor_m2 == 2980
    assert o.orcamento_total == 250_000  # editar padrão não mexe no orçamento sozinho


def test_usar_estimativa_como_orcamento():
    s = Sistema(hoje=HOJE)
    s.despachar("obra.criar", {"nome": "Casa", "orcamento_total": "200.000", "area_construida": "100"})
    o = s.obra
    o.etapa("FUN").orcamento = 12_345  # ajuste manual preservado
    r = s.despachar("obra.orcamento_padrao", {})
    assert r["ok"] and r["alteradas"] == [o.id]
    assert o.orcamento_total == pytest.approx(100 * o.valor_m2, abs=0.01)
    assert o.etapa("FUN").orcamento == 12_345
    assert o.etapa("EST").orcamento == pytest.approx(o.orcamento_total * 0.12, abs=0.01)


def test_comparacao_e_alerta_de_orcamento_baixo():
    o = sv.criar_obra("Casa", orcamento_total="150.000", padrao="R1-N")
    p = an.resumo_padrao(o)
    assert p["estimado"] == pytest.approx(269_033, abs=1)
    assert p["diferenca"] == pytest.approx(150_000 / 269_033 - 1, abs=0.001)
    assert any("abaixo do padrão" in a.titulo for a in an.alertas(o, HOJE))
    o2 = sv.criar_obra("Casa", padrao="R1-N")  # orçamento = estimativa
    assert not any("abaixo do padrão" in a.titulo for a in an.alertas(o2, HOJE))


def test_telas_mostram_padrao():
    s = Sistema(hoje=HOJE)
    s.despachar("obra.criar", {"nome": "Casa", "padrao": "R1-B", "orcamento_total": "100.000"})
    s.despachar("ui.aba", {"aba": "painel"})
    html = render(s)
    assert "Padrão construtivo" in html and "Baixo (R1-B)" in html and "padrão baixo · R$ 2.193,39/m²" in html
    s.despachar("ui.aba", {"aba": "obras"})
    html = render(s)
    assert 'name="padrao"' in html and 'data-action="obra.orcamento_padrao"' in html


def test_obra_antiga_sem_padrao_carrega_com_normal():
    d = sv.criar_obra("Antiga", orcamento_total="1").para_dict()
    d.pop("padrao"); d.pop("valor_m2")
    o = Obra.de_dict(d)
    assert o.padrao == "R1-N" and o.valor_m2 == valor_referencia("R1-N")
