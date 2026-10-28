from datetime import date

import pytest

from gestao_obras import servicos as sv
from gestao_obras.modelos import Obra, ValidacaoErro
from gestao_obras.padroes import CUB_ESTADOS, UFS, valor_referencia
from gestao_obras.sistema import Sistema
from gestao_obras.ui import render

HOJE = date(2026, 10, 27)


def test_tabela_coerente():
    assert "PB" in UFS and "SP" in UFS and len(UFS) == 23
    for uf, (nome, sind, mes, b, n, a) in CUB_ESTADOS.items():
        assert b < n < a, uf
        assert valor_referencia("R1-MA", uf) == round((n + a) / 2, 2)
    assert valor_referencia("R1-N", "PB") == 2037.27 and valor_referencia("R1-N") == 2690.33  # padrão SP


def test_obra_nova_com_cub_pb():
    o = sv.criar_obra("Casa PB", area_construida="100", padrao="R1-N", uf_cub="pb")
    assert o.uf_cub == "PB" and o.valor_m2 == 2037.27 and o.orcamento_total == pytest.approx(203727.0)
    with pytest.raises(ValidacaoErro):
        sv.criar_obra("Casa SC", uf_cub="SC")  # SC não publica R1 por padrão


def test_trocar_estado_no_cadastro_atualiza_valor():
    s = Sistema(hoje=HOJE)
    html = render(s)
    assert 'name="uf_cub"' in html and '<option value="PB" selected>' in html and "Tabela CUB por estado" in html
    s.despachar("obra.criar", {"nome": "Casa", "padrao": "R1-A", "uf_cub": "PB", "orcamento_total": "300.000"})
    o = s.obra
    assert o.valor_m2 == 2510.14
    # troca só o estado (valor por m² igual ao gravado) → CUB do novo estado
    r = s.despachar("obra.editar", {"nome": "Casa", "padrao": "R1-A", "uf_cub": "PE", "valor_m2": "2.510,14",
                                    "orcamento_total": "300.000", "area_construida": "100"})
    assert r["ok"] and o.uf_cub == "PE" and o.valor_m2 == 3422.72
    # valor digitado diferente prevalece
    s.despachar("obra.editar", {"nome": "Casa", "padrao": "R1-A", "uf_cub": "PE", "valor_m2": "3.000",
                                "orcamento_total": "300.000", "area_construida": "100"})
    assert o.valor_m2 == 3000
    assert not s.despachar("obra.editar", {"nome": "Casa", "uf_cub": "XX"})["ok"]
    s.despachar("ui.aba", {"aba": "painel"})
    assert "CUB-PE" in render(s)


def test_obra_antiga_fica_em_sp():
    d = sv.criar_obra("Antiga").para_dict()
    d.pop("uf_cub")
    o = Obra.de_dict(d)
    assert o.uf_cub == "SP" and o.valor_m2 == 2690.33
