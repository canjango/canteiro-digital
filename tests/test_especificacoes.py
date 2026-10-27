"""Especificações técnicas por serviço e detalhes ilustrados por etapa."""

import re
from datetime import date
from xml.etree import ElementTree

from gestao_obras.detalhes import DESENHOS, detalhe
from gestao_obras.especificacoes import ESPECIFICACOES, especificacao
from gestao_obras.etapas import CODIGOS, ETAPAS_PADRAO
from gestao_obras.sistema import Sistema
from gestao_obras.ui import render


def test_todo_servico_tem_especificacao_completa():
    catalogo = {(e["codigo"], s["servico"]) for e in ETAPAS_PADRAO for s in e["servicos"]}
    assert catalogo == set(ESPECIFICACOES)
    for chave, spec in ESPECIFICACOES.items():
        for campo in ("especificacao", "execucao", "aceitacao"):
            assert len(spec[campo]) >= 25, (chave, campo)


def test_toda_etapa_tem_desenho_valido():
    assert set(DESENHOS) == set(CODIGOS)
    for cod in CODIGOS:
        svg, titulo = detalhe(cod)
        raiz = ElementTree.fromstring(svg)                   # XML bem formado
        assert raiz.get("viewBox") == "0 0 480 280" and titulo in raiz.get("aria-label")
        ids = re.findall(r'id="([^"]+)"', svg)
        assert all(i.startswith(cod.lower() + "-") for i in ids)  # ids únicos por desenho
        # nada desenhado fora da área visível (textos dentro da largura)
        for x in re.findall(r'<text x="([\d.]+)"', svg):
            assert 0 <= float(x) <= 480, cod
        assert "#000" not in svg and "#fff" not in svg.lower()   # cores vêm do tema


def test_etapa_aberta_mostra_desenho_e_especificacoes():
    s = Sistema(hoje=date(2026, 10, 26))
    s.despachar("obra.criar", {"nome": "Casa"})
    s.ui.update(aba="etapas", abertas=["FUN"])
    html = render(s)
    assert "Detalhe de referência: Estaca broca e viga baldrame" in html
    assert html.count("<details>") == len(ETAPAS_PADRAO[2]["servicos"])
    assert especificacao("FUN", "Viga baldrame")["especificacao"][:30] in html
    assert "Aceitação" in html


def test_servico_sem_especificacao_nao_quebra():
    s = Sistema(hoje=date(2026, 10, 26))
    s.despachar("obra.criar", {"nome": "Casa"})
    s.obra.etapa("ALV").servicos.append({"servico": "Serviço antigo", "un": "vb", "qtd": 1})
    s.ui.update(aba="etapas", abertas=["ALV"])
    assert "Serviço antigo" in render(s)
