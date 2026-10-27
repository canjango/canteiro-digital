import re
from datetime import date

import pytest

from gestao_obras import analise as an
from gestao_obras import servicos as sv
from gestao_obras.modelos import Obra, ValidacaoErro
from gestao_obras.sistema import Sistema
from gestao_obras.ui import render

HOJE = date(2026, 10, 27)


def test_ler_bdi():
    assert sv.ler_bdi("25") == 25 and sv.ler_bdi("25,5") == 25.5 and sv.ler_bdi("22%") == 22
    assert sv.ler_bdi("") == 0 and sv.ler_bdi(None) == 0
    with pytest.raises(ValidacaoErro):
        sv.ler_bdi("150")
    with pytest.raises(ValidacaoErro):
        sv.ler_bdi("-5")


def test_preco_de_venda_e_medicao_com_bdi():
    o = sv.criar_obra("Casa", area_construida=100, padrao="R1-N", orcamento_total="200.000", bdi="25")
    assert o.bdi == 25
    p = an.resumo_padrao(o)
    assert p["preco_venda"] == 250000 and p["valor_bdi"] == 50000 and p["preco_venda_m2"] == 2500
    # comparação com o padrão continua no custo direto (BDI não distorce)
    assert p["diferenca"] == pytest.approx(200000 / (100 * o.valor_m2) - 1)
    e = o.etapas[0]
    for i in e.checklist:
        i.feito = True
    fin = an.resumo_financeiro(o)
    assert fin["executado"] == pytest.approx(e.orcamento)
    assert fin["executado_bdi"] == pytest.approx(e.orcamento * 1.25, abs=0.01)
    linha = an.custos_por_etapa(o)[0]
    assert linha["executado_bdi"] == pytest.approx(linha["executado"] * 1.25, abs=0.01)


def test_obra_antiga_sem_bdi_carrega_com_zero():
    d = sv.criar_obra("Antiga").para_dict()
    d.pop("bdi")
    o = Obra.de_dict(d)
    assert o.bdi == 0 and an.preco_venda(o) == o.orcamento_total


def test_bdi_pela_interface():
    s = Sistema(hoje=HOJE)
    html = render(s)
    assert 'name="bdi"' in html and 'value="25"' in html  # sugestão na obra nova
    s.despachar("obra.criar", {"nome": "Casa", "orcamento_total": "100.000", "bdi": "20"})
    assert s.obra.bdi == 20
    r = s.despachar("obra.editar", {"nome": "Casa", "orcamento_total": "100.000", "bdi": "30", "area_construida": "100"})
    assert r["ok"] and s.obra.bdi == 30
    assert not s.despachar("obra.editar", {"nome": "Casa", "bdi": "300"})["ok"] and s.obra.bdi == 30
    s.despachar("ui.aba", {"aba": "painel"})
    html = render(s)
    assert "Preço de venda" in html and "R$ 130.000,00" in html and "Medição c/ BDI 30%" in html and "BDI 30%" in html
    # cabeçalho e linhas da tabela com o mesmo número de colunas
    tabela = html.split("Medição físico-financeira")[1]
    cab = len(re.findall(r"<th[ >]", tabela.split("</thead>")[0]))
    linha = re.search(r"<tbody><tr>(.*?)</tr>", tabela).group(1)
    assert linha.count("<td") == cab


def test_exemplo_tem_bdi():
    s = Sistema(hoje=HOJE)
    s.despachar("obra.exemplo", {})
    assert s.obra.bdi == 25
