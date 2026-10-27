"""Lista de materiais por etapa e geração de pedidos de compra."""

from datetime import date, timedelta

import pytest

from gestao_obras import analise as an
from gestao_obras import materiais as mt
from gestao_obras import servicos as sv
from gestao_obras.etapas import CODIGOS, etapa_padrao
from gestao_obras.modelos import ValidacaoErro
from gestao_obras.sistema import Sistema
from gestao_obras.ui import render

HOJE = date(2026, 10, 26)


@pytest.fixture
def obra():
    # obra começando em 10 dias: PRE inicia logo, demais etapas depois
    return sv.criar_obra("Casa", inicio=(HOJE + timedelta(days=10)).isoformat(),
                         fim_previsto=(HOJE + timedelta(days=250)).isoformat(), orcamento_total="280.000")


def test_catalogo_de_materiais_valido_e_completo():
    assert mt.validar() == []
    assert set(mt.MATERIAIS) == set(CODIGOS)
    assert sum(len(v) for v in mt.MATERIAIS.values()) >= 150


def test_coerente_com_quantitativos_das_etapas():
    def serv(cod, trecho):
        return next(s["qtd"] for s in etapa_padrao(cod)["servicos"] if trecho in s["servico"])
    assert mt.material("ALV:bloco")["qtd"] == serv("ALV", "Blocos cerâmicos")
    assert mt.material("COB:telha")["qtd"] == serv("COB", "Telha cerâmica")
    assert mt.material("FUN:concreto")["qtd"] == serv("FUN", "Concreto")
    assert mt.material("EST:concreto")["qtd"] == serv("EST", "Concreto")
    aco_fun = sum(mt.material(f"FUN:{k}")["qtd"] for k in ("aco10", "aco8", "aco5"))
    assert aco_fun == serv("FUN", "Aço")


def test_quantidade_pela_area_arredonda_para_cima():
    assert mt.quantidade(5000, "un", 150) == 7500
    assert mt.quantidade(9, "lata", 110) == 10          # 9,9 latas -> compra 10
    assert mt.quantidade(1.5, "m³", 120) == 1.8
    assert mt.quantidade(4.5, "m³", 130) == 5.9        # 5,85 -> 5,9
    assert mt.quantidade(1, "cj", 40) == 1             # nunca zera


def test_solicitar_material_cria_pedido(obra):
    c = sv.solicitar_material(obra, "PRE:tapume", hoje=HOJE)
    assert (c.descricao, c.etapa, c.quantidade, c.unidade, c.status) == (
        "Chapa de compensado resinado 2,20×1,10 m (tapume)", "PRE", 40, "un", "Solicitada")
    assert c.material == "PRE:tapume" and c.valor_unitario == 0
    ini = date.fromisoformat(obra.etapa("PRE").inicio_previsto)
    assert c.data_necessidade == max(HOJE, ini - timedelta(days=7)).isoformat()
    assert c.prioridade == "Alta"                       # etapa começa em menos de 15 dias
    loc = sv.solicitar_material(obra, "EST:escoras", hoje=HOJE)
    assert loc.categoria == "Equipamento/locação" and loc.prioridade == "Média"
    with pytest.raises(ValidacaoErro):
        sv.solicitar_material(obra, "PRE:nao-existe", hoje=HOJE)


def test_situacao_parcial_entregue_e_cancelada(obra):
    linha = lambda: next(x for x in sv.situacao_materiais(obra, "ALV") if x["chave"] == "ALV:bloco")  # noqa: E731
    assert linha()["situacao"] == "Não solicitado"
    c1 = sv.solicitar_material(obra, "ALV:bloco", "2.000", HOJE)
    assert linha()["situacao"] == "Parcial" and linha()["faltante"] == 3000
    c2 = sv.solicitar_material(obra, "ALV:bloco", hoje=HOJE)          # pede o que falta
    assert c2.quantidade == 3000 and linha()["situacao"] == "Solicitada"
    for c in (c1, c2):
        sv.atualizar_preco_compra(obra, c.id, "2,35")
        for st in ("Aprovada", "Pedido feito", "Entregue"):
            sv.mudar_status_compra(obra, c.id, st, HOJE)
    assert linha()["situacao"] == "Entregue"
    c3 = sv.solicitar_material(obra, "ALV:cal", hoje=HOJE)
    sv.mudar_status_compra(obra, c3.id, "Cancelada", HOJE)
    assert next(x for x in sv.situacao_materiais(obra, "ALV") if x["chave"] == "ALV:cal")["situacao"] == "Não solicitado"


def test_solicitar_etapa_inteira_pelo_sistema():
    s = Sistema(hoje=HOJE)
    s.despachar("obra.criar", {"nome": "Casa", "inicio": (HOJE + timedelta(days=5)).isoformat(),
                               "fim_previsto": (HOJE + timedelta(days=240)).isoformat()})
    o = s.obra
    sv.solicitar_material(o, "PRE:tapume", hoje=HOJE)
    assert any("materiais não solicitados" in a.titulo for a in an.alertas(o, HOJE))
    r = s.despachar("mat.solicitar_etapa", {"codigo": "PRE"})
    assert r["ok"] and r["alteradas"] == [o.id]
    assert len([c for c in o.compras if c.etapa == "PRE"]) == len(mt.materiais_da_etapa("PRE"))
    assert not any("Serviços preliminares começa" in a.titulo for a in an.alertas(o, HOJE))
    assert not s.despachar("mat.solicitar_etapa", {"codigo": "PRE"})["ok"]   # nada pendente


def test_tela_da_lista_de_materiais():
    s = Sistema(hoje=HOJE)
    s.despachar("obra.criar", {"nome": "Casa", "area_construida": "150"})
    s.despachar("ui.aba", {"aba": "compras"})
    assert "Lista de materiais por etapa" in render(s)
    assert s.despachar("ui.vista_compras", {"vista": "materiais"})["ok"]
    s.despachar("ui.mat_expandir", {"codigo": "ALV"})
    html = render(s)
    assert "Bloco cerâmico 14×19×29 cm" in html and "7.500 un" in html and 'data-action="mat.solicitar"' in html
    assert "Solicitar os 10 pendentes" in html
    r = s.despachar("mat.solicitar", {"chave": "ALV:bloco", "quantidade": "7.500"})
    assert r["ok"] and s.obra.compras[-1].quantidade == 7500
    assert not s.despachar("ui.vista_compras", {"vista": "x"})["ok"]
    s.despachar("ui.vista_compras", {"vista": "pedidos"})
    assert "da lista de materiais" in render(s)


# ---------------------------------------------------------------- padrão construtivo
def qtd(o, chave):
    cod = chave.split(":")[0]
    return next((x for x in sv.situacao_materiais(o, cod) if x["chave"] == chave), None)


def test_lista_proporcional_ao_padrao():
    obras = {p: sv.criar_obra("Casa", padrao=p) for p in ("R1-B", "R1-N", "R1-MA", "R1-A")}
    # acabamentos crescem com o padrão
    for chave in ("REV:ceramica", "LOU:luminaria", "ELE:disjuntor", "FOR:placa-st", "PIS:ac2"):
        b, n, ma, a = (qtd(obras[p], chave)["necessario"] for p in ("R1-B", "R1-N", "R1-MA", "R1-A"))
        assert b <= n <= ma <= a and b < a, chave
    # estrutura não muda
    for chave in ("ALV:bloco", "COB:telha", "EST:concreto", "FUN:aco10"):
        assert len({qtd(o, chave)["necessario"] for o in obras.values()}) == 1, chave
    # especificação muda
    assert qtd(obras["R1-B"], "PIS:piso")["material"].startswith("Piso cerâmico")
    assert "grande formato" in qtd(obras["R1-A"], "PIS:piso")["material"]
    assert qtd(obras["R1-N"], "PIS:piso")["material"] == "Porcelanato 60×60 cm"
    assert qtd(obras["R1-A"], "PIS:piso")["ajustado"] and not qtd(obras["R1-N"], "PIS:piso")["ajustado"]
    # baixo padrão sem água quente encanada (chuveiro elétrico)
    assert qtd(obras["R1-B"], "HID:ppr") is None and qtd(obras["R1-A"], "HID:ppr")["necessario"] == 45


def test_medio_alto_fica_entre_normal_e_alto():
    n = sv.criar_obra("N", padrao="R1-N")
    ma = sv.criar_obra("MA", padrao="R1-MA")
    a = sv.criar_obra("A", padrao="R1-A")
    assert qtd(ma, "LOU:luminaria")["necessario"] == mt.quantidade(18 * 1.5, "un", 100)  # média 1 e 2
    assert qtd(n, "ELE:cat6")["necessario"] < qtd(ma, "ELE:cat6")["necessario"] < qtd(a, "ELE:cat6")["necessario"]


def test_personalizado_usa_padrao_mais_proximo():
    assert mt.perfil_do_padrao("PERS", 2300) == "R1-B"
    assert mt.perfil_do_padrao("PERS", 3200) == "R1-A"
    assert mt.perfil_do_padrao("PERS", 0) == "R1-N"
    o = sv.criar_obra("Casa", padrao="PERS", valor_m2="3.200")
    assert "grande formato" in qtd(o, "PIS:piso")["material"]


def test_trocar_padrao_atualiza_lista_e_mantem_pedidos():
    s = Sistema(hoje=HOJE)
    s.despachar("obra.criar", {"nome": "Casa", "padrao": "R1-N"})
    o = s.obra
    sv.solicitar_material(o, "PIS:piso", hoje=HOJE)  # 110 m² pedidos
    base = {"nome": "Casa", "inicio": "", "fim_previsto": "", "area_construida": "100",
            "orcamento_total": f"{o.orcamento_total:.2f}".replace(".", ","), "valor_m2": "2.690,33"}
    assert s.despachar("obra.editar", {**base, "padrao": "R1-A"})["ok"]
    linha = qtd(o, "PIS:piso")
    assert linha["necessario"] == 116 and linha["pedido"] == 110 and linha["situacao"] == "Parcial"
    s.despachar("ui.aba", {"aba": "compras"})
    s.despachar("ui.vista_compras", {"vista": "materiais"})
    s.despachar("ui.mat_expandir", {"codigo": "PIS"})
    html = render(s)
    assert "Alto (R1-A)" in html and "ajustado ao padrão" in html
