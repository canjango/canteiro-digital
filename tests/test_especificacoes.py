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
    assert "Detalhe técnico da etapa" in html and "<figure" not in html   # desenho não ocupa mais o cartão
    assert html.count("<details>") == len(ETAPAS_PADRAO[2]["servicos"])
    assert especificacao("FUN", "Viga baldrame")["especificacao"][:30] in html
    assert "Aceitação" in html


def test_servico_sem_especificacao_nao_quebra():
    s = Sistema(hoje=date(2026, 10, 26))
    s.despachar("obra.criar", {"nome": "Casa"})
    s.obra.etapa("ALV").servicos.append({"servico": "Serviço antigo", "un": "vb", "qtd": 1})
    s.ui.update(aba="etapas", abertas=["ALV"])
    assert "Serviço antigo" in render(s)


# ---------------------------------------------------------------- imagem por item
from gestao_obras.figuras import FIGURAS, figura  # noqa: E402


def test_cada_item_do_checklist_tem_imagem_propria():
    itens = [t for e in ETAPAS_PADRAO for t in e["checklist"]]
    assert set(itens) == set(FIGURAS)
    svgs = {}
    for t in itens:
        svg = figura(t)
        ElementTree.fromstring(svg)
        assert 'viewBox="0 0 360 220"' in svg
        for x in re.findall(r'<text x="([\d.]+)"', svg):
            assert 0 <= float(x) <= 360, t
        svgs[t] = svg
    assert len(set(svgs.values())) == len(itens)           # nenhuma imagem repetida


def test_botao_abre_e_fecha_imagem_do_item():
    s = Sistema(hoje=date(2026, 10, 26))
    s.despachar("obra.criar", {"nome": "Casa"})
    s.ui.update(aba="etapas", abertas=["IMP"])
    item = s.obra.etapa("IMP").checklist[5]                  # teste de lâmina d'água
    html = render(s)
    assert html.count('data-action="ui.figura"') == len(s.obra.etapa("IMP").checklist) + 1
    assert s.despachar("ui.figura", {"codigo": "IMP", "item": item.id})["ok"]
    html = render(s)
    from html import escape
    assert 'role="dialog"' in html and "72 h" in html and escape(item.texto) in html
    s.despachar("ui.figura_fechar", {})
    assert 'role="dialog"' not in render(s)
    assert s.despachar("ui.figura", {"codigo": "IMP", "item": "_etapa"})["ok"]
    assert "detalhe técnico" in render(s)
    s.despachar("ui.aba", {"aba": "painel"})              # trocar de aba fecha a janela
    assert s.ui["figura"] is None
    assert not s.despachar("ui.figura", {"codigo": "IMP", "item": "inexistente"})["ok"]


def test_item_criado_pelo_usuario_nao_tem_botao_de_imagem():
    s = Sistema(hoje=date(2026, 10, 26))
    s.despachar("obra.criar", {"nome": "Casa"})
    s.despachar("etapa.novo_item", {"codigo": "TER", "texto": "Item meu"})
    s.ui.update(aba="etapas", abertas=["TER"])
    html = render(s)
    novo = s.obra.etapa("TER").checklist[-1]
    assert f'data-action="ui.figura" data-codigo="TER" data-item="{novo.id}"' not in html
