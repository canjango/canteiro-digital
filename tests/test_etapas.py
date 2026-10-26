"""Catálogo de etapas (residência de 100 m²), detalhamento, observações e
atualização de obras criadas no modelo antigo."""

import copy
import re
from datetime import date

import pytest

from gestao_obras import servicos as sv
from gestao_obras.etapas import ETAPAS_PADRAO, MODELO_VERSAO, etapa_padrao, validar_catalogo
from gestao_obras.modelos import Obra, ValidacaoErro
from gestao_obras.sistema import Sistema
from gestao_obras.ui import qtd_escalada, render

HOJE = date(2026, 10, 26)


def caminho_critico() -> float:
    fim = {}
    for e in ETAPAS_PADRAO:
        fim[e["codigo"]] = max((fim[p] for p in e["predecessoras"]), default=0) + e["duracao_dias"]
    return max(fim.values())


# ---------------------------------------------------------------- catálogo
def test_catalogo_completo_e_coerente():
    assert validar_catalogo() == []
    for e in ETAPAS_PADRAO:
        assert e["descricao"] and e["equipe"] and e["atencao"] and e["servicos"]
        assert len(e["checklist"]) >= 7, e["codigo"]


def test_prazo_compativel_com_casa_de_100m2():
    # casa térrea de 100 m²: 6 a 9 meses de obra (≈ 130 a 200 dias úteis)
    assert 130 <= caminho_critico() <= 200


def test_sequencia_executiva_casa_terrea():
    # em casa térrea, alvenaria sobe junto com pilares/cintas (não espera a estrutura toda)
    assert etapa_padrao("ALV")["predecessoras"] == ["FUN"]
    assert set(etapa_padrao("COB")["predecessoras"]) == {"EST", "ALV"}
    assert "IMP" in etapa_padrao("PIS")["predecessoras"]  # não assenta piso sem impermeabilizar
    assert set(etapa_padrao("ENT")["predecessoras"]) >= {"PIN", "LOU", "ESQ"}


def test_cronograma_usa_duracao_tipica_e_paralelismo():
    o = sv.criar_obra("Casa", inicio="2026-11-02", fim_previsto="2027-06-30")
    est, alv = o.etapa("EST"), o.etapa("ALV")
    assert est.inicio_previsto == alv.inicio_previsto  # começam juntas após a fundação
    assert o.etapa("COB").inicio_previsto >= max(est.fim_previsto, alv.fim_previsto)
    # a etapa mais longa (revestimentos) dura mais que a mais curta (movimento de terra)
    dur = lambda e: (date.fromisoformat(e.fim_previsto) - date.fromisoformat(e.inicio_previsto)).days  # noqa: E731
    assert dur(o.etapa("REV")) > dur(o.etapa("TER"))


def test_obra_nova_tem_detalhes_independentes_do_catalogo():
    o = sv.criar_obra("Casa")
    assert o.modelo_etapas == MODELO_VERSAO and o.area_construida == 100
    o.etapa("ALV").servicos[0]["qtd"] = 1  # editar a obra não pode alterar o catálogo
    assert etapa_padrao("ALV")["servicos"][0]["qtd"] == 270


# ---------------------------------------------------------------- área
def test_quantitativos_escalam_pela_area():
    assert qtd_escalada(4800, "un", 150) == "7.200"
    assert qtd_escalada(1, "un", 60) == "1"          # nunca zera unidade
    assert qtd_escalada(4, "m³", 150) == "6"
    assert qtd_escalada(9, "m³", 50) == "4,5"
    s = Sistema(hoje=HOJE)
    s.despachar("obra.criar", {"nome": "Casa 150", "area_construida": "150"})
    s.despachar("ui.expandir", {"codigo": "ALV"})
    html = render(s)
    assert "· 150 m²" in html and ">7.200<" in html


def test_area_invalida():
    with pytest.raises(ValidacaoErro):
        sv.criar_obra("X", area_construida="3")


# ---------------------------------------------------------------- observação
def test_observacao_da_etapa():
    s = Sistema(hoje=HOJE)
    s.despachar("obra.criar", {"nome": "Casa"})
    r = s.despachar("etapa.observacao", {"codigo": "FUN", "observacao": "  Solo argiloso <b>úmido</b>\r\nlinha 2  "})
    assert r["ok"] and r["alteradas"] == [s.obra.id]
    assert s.obra.etapa("FUN").observacao == "Solo argiloso <b>úmido</b>\nlinha 2"
    s.ui["abertas"] = ["FUN"]
    s.ui["aba"] = "etapas"
    html = render(s)
    assert "Solo argiloso &lt;b&gt;úmido&lt;/b&gt;" in html and "<b>úmido</b>" not in html
    assert 'class="tag-obs"' in html
    assert not s.despachar("etapa.observacao", {"codigo": "FUN", "observacao": "x" * 2001})["ok"]
    s.despachar("etapa.observacao", {"codigo": "FUN", "observacao": ""})
    assert s.obra.etapa("FUN").observacao == "" and "apagada" in s.ui["msg"]


def test_observacao_sobrevive_ao_salvar_e_carregar():
    o = sv.criar_obra("Casa")
    sv.salvar_observacao(o, "PIN", "Cor da fachada: aguardando cliente")
    assert Obra.de_dict(o.para_dict()).etapa("PIN").observacao == "Cor da fachada: aguardando cliente"


# ---------------------------------------------------------------- obras antigas
def obra_modelo_antigo() -> dict:
    """Documento como era gravado antes do catálogo detalhado (modelo 1)."""
    o = sv.criar_obra("Antiga", orcamento_total=500_000)
    d = o.para_dict()
    d.pop("modelo_etapas"); d.pop("area_construida")
    pesos_antigos = {"PRE": 3, "EST": 18, "FUN": 8}
    for e in d["etapas"]:
        for campo in ("descricao", "servicos", "equipe", "atencao", "duracao_dias", "observacao"):
            e.pop(campo)
        e["checklist"] = e["checklist"][:3]  # modelo antigo tinha menos itens
        if e["codigo"] in pesos_antigos:
            e["peso"] = pesos_antigos[e["codigo"]]
            e["orcamento"] = 500_000 * pesos_antigos[e["codigo"]] / 100
        if e["codigo"] == "ALV":
            e["predecessoras"] = ["EST"]
    fun = next(e for e in d["etapas"] if e["codigo"] == "FUN")
    fun["orcamento"] = 41_234.56  # ajustado à mão pelo usuário
    fun["checklist"][0]["feito"] = True
    fun["checklist"][0]["concluido_em"] = "2026-09-01"
    fun["checklist"].append({"texto": "Item criado pelo usuário", "feito": True, "concluido_em": "2026-09-02", "id": "chk-user"})
    return d


def test_carregar_obra_antiga_completa_detalhes_sem_mexer_no_checklist():
    s = Sistema(hoje=HOJE)
    assert s.carregar([obra_modelo_antigo()]) == []
    o = s.obra
    assert o.modelo_etapas == 1 and o.area_construida == 100
    assert o.etapa("FUN").descricao and o.etapa("FUN").servicos  # detalhes preenchidos
    assert len(o.etapa("FUN").checklist) == 4                     # checklist intacto
    s.ui["aba"] = "etapas"
    assert "Aplicar modelo revisado" in render(s)


def test_aplicar_modelo_preserva_o_que_foi_feito():
    s = Sistema(hoje=HOJE)
    s.carregar([obra_modelo_antigo()])
    o = s.obra
    fun_antes = copy.deepcopy(o.etapa("FUN"))
    feito_id = fun_antes.checklist[0].id
    r = s.despachar("obra.atualizar_modelo", {})
    assert r["ok"] and r["alteradas"] == [o.id]
    fun = o.etapa("FUN")
    textos = [i.texto for i in fun.checklist]
    assert len(textos) == len(set(textos))                         # sem duplicados
    assert textos[: len(etapa_padrao("FUN")["checklist"])] == etapa_padrao("FUN")["checklist"]
    marcado = next(i for i in fun.checklist if i.id == feito_id)   # mesmo item, ainda marcado
    assert marcado.feito and marcado.concluido_em == "2026-09-01"
    assert textos[-1] == "Item criado pelo usuário" and fun.checklist[-1].feito
    assert fun.orcamento == 41_234.56                               # ajuste manual mantido
    assert o.etapa("EST").peso == 12 and o.etapa("EST").orcamento == 60_000  # redistribuído
    assert o.etapa("ALV").predecessoras == ["FUN"]
    assert o.modelo_etapas == MODELO_VERSAO
    assert re.search(r"\d+ itens novos", s.ui["msg"])
    s.ui["aba"] = "etapas"
    assert "Aplicar modelo revisado" not in render(s)
    # aplicar de novo não muda nada
    antes = o.para_dict()
    sv.aplicar_modelo(o)
    assert o.para_dict() == antes
