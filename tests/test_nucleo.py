from datetime import date, timedelta

import pytest

from gestao_obras import analise as an
from gestao_obras import servicos as sv
from gestao_obras.etapas import CODIGOS, ETAPAS_PADRAO, validar_catalogo
from gestao_obras.modelos import Obra, ValidacaoErro

HOJE = date(2026, 10, 26)


@pytest.fixture
def obra():
    return sv.criar_obra("Casa Teste", "Cliente", "Rua A", "RT", "2026-01-05", "2026-12-20", 1_000_000)


# ---------------------------------------------------------------- catálogo
def test_catalogo_consistente():
    assert validar_catalogo() == []
    assert len(ETAPAS_PADRAO) == 17
    assert len(set(CODIGOS)) == len(CODIGOS)


# ---------------------------------------------------------------- obra
def test_criar_obra_distribui_orcamento_e_cronograma(obra):
    assert len(obra.etapas) == 17
    assert sum(e.orcamento for e in obra.etapas) == pytest.approx(1_000_000, abs=1)
    assert obra.etapa("EST").orcamento == pytest.approx(120_000)
    for e in obra.etapas:
        assert obra.inicio <= e.inicio_previsto <= e.fim_previsto <= obra.fim_previsto
        for p in e.predecessoras:  # nenhuma etapa começa antes da predecessora terminar
            assert e.inicio_previsto >= obra.etapa(p).fim_previsto
    assert obra.etapa("PRE").inicio_previsto == obra.inicio
    assert obra.etapa("ENT").fim_previsto <= obra.fim_previsto


def test_criar_obra_validacoes():
    with pytest.raises(ValidacaoErro):
        sv.criar_obra("   ")
    with pytest.raises(ValidacaoErro):
        sv.criar_obra("X", inicio="2026-05-01", fim_previsto="2026-04-01")
    with pytest.raises(ValidacaoErro):
        sv.criar_obra("X", orcamento_total=-5)
    with pytest.raises(ValidacaoErro):
        sv.criar_obra("X", inicio="31/12/2026")
    o = sv.criar_obra("Sem datas", orcamento_total="250000,50")
    assert o.orcamento_total == 250000.5
    assert all(e.inicio_previsto == "" for e in o.etapas)


def test_checklists_sao_independentes_entre_obras():
    a, b = sv.criar_obra("A"), sv.criar_obra("B")
    sv.alternar_item_etapa(a, "PRE", a.etapa("PRE").checklist[0].id, HOJE)
    assert not b.etapa("PRE").checklist[0].feito
    assert a.etapa("PRE").checklist[0].id != b.etapa("PRE").checklist[0].id


def test_serializacao_ida_e_volta(obra):
    sv.adicionar_compra(obra, "Cimento", "ALV", quantidade=10, unidade="sc", valor_unitario=40, hoje=HOJE)
    sv.adicionar_tarefa(obra, "Tarefa", "EST", itens=["a", "b"])
    copia = Obra.de_dict(obra.para_dict())
    assert copia == obra
    # campos desconhecidos (versões futuras) são ignorados
    d = obra.para_dict()
    d["campo_novo"] = 1
    d["compras"][0]["outro"] = 2
    assert Obra.de_dict(d).compras[0].descricao == "Cimento"


# ---------------------------------------------------------------- checklist e avanço
def test_alternar_item_registra_data(obra):
    item = obra.etapa("PRE").checklist[0]
    sv.alternar_item_etapa(obra, "PRE", item.id, HOJE)
    assert item.feito and item.concluido_em == "2026-10-26"
    sv.alternar_item_etapa(obra, "PRE", item.id, HOJE)
    assert not item.feito and item.concluido_em == ""
    with pytest.raises(ValidacaoErro):
        sv.alternar_item_etapa(obra, "PRE", "inexistente", HOJE)


def test_progresso_ponderado(obra):
    assert an.progresso_fisico(obra) == 0
    sv.marcar_etapa(obra, "EST", True, HOJE)  # 12%
    assert an.progresso_fisico(obra) == pytest.approx(0.12)
    sv.marcar_etapa(obra, "PRE", True, HOJE)  # +4%
    assert an.progresso_fisico(obra) == pytest.approx(0.16)
    por_fase = an.por_categoria_etapa(obra)
    assert por_fase["Supraestrutura"]["progresso"] == pytest.approx(1)
    assert list(por_fase)[0] == "Preparação"


def test_status_etapa_respeita_sequencia(obra):
    antes = date(2026, 1, 1)
    assert an.status_etapa(obra, obra.etapa("PRE"), antes) == "Liberada"
    assert an.status_etapa(obra, obra.etapa("TER"), antes) == "Aguardando"
    sv.marcar_etapa(obra, "PRE", True, antes)
    assert an.status_etapa(obra, obra.etapa("PRE"), antes) == "Concluída"
    assert an.status_etapa(obra, obra.etapa("TER"), antes) == "Liberada"
    # depois do fim previsto e incompleta -> atrasada
    assert an.status_etapa(obra, obra.etapa("TER"), HOJE) == "Atrasada"


def test_etapa_sem_itens_nao_conta_como_concluida(obra):
    e = obra.etapa("TER")
    for i in list(e.checklist):
        sv.remover_item_etapa(obra, "TER", i.id)
    assert an.progresso_etapa(e) == 0
    assert not an.etapa_concluida(e)
    assert an.predecessoras_pendentes(obra, obra.etapa("FUN")) == ["TER"]


def test_idp_e_previsto(obra):
    assert an.idp(obra, date(2025, 12, 1)) is None  # antes do início
    assert an.progresso_previsto(obra, date(2027, 1, 1)) == pytest.approx(1)
    meio = date(2026, 6, 15)
    prev = an.progresso_previsto(obra, meio)
    assert 0 < prev < 1
    for cod in ("PRE", "TER", "FUN", "EST"):
        sv.marcar_etapa(obra, cod, True, meio)
    assert an.idp(obra, meio) == pytest.approx(an.progresso_fisico(obra) / prev)


# ---------------------------------------------------------------- compras
def test_fluxo_de_compra(obra):
    c = sv.adicionar_compra(obra, "Aço CA-50", "EST", "Material", 2, "t", 0, hoje=HOJE)
    assert c.status == "Solicitada" and c.valor_total == 0
    with pytest.raises(ValidacaoErro):  # sem preço não aprova
        sv.mudar_status_compra(obra, c.id, "Aprovada", HOJE)
    sv.mudar_status_compra(obra, c.id, "Em cotação", HOJE)
    sv.atualizar_preco_compra(obra, c.id, "7800", "Fornecedor X")
    sv.mudar_status_compra(obra, c.id, "Aprovada", HOJE)
    sv.mudar_status_compra(obra, c.id, "Pedido feito", HOJE)
    with pytest.raises(ValidacaoErro):  # pedido feito: preço travado
        sv.atualizar_preco_compra(obra, c.id, 1)
    with pytest.raises(ValidacaoErro):  # não pode pular de volta
        sv.mudar_status_compra(obra, c.id, "Solicitada", HOJE)
    with pytest.raises(ValidacaoErro):  # nem excluir
        sv.remover_compra(obra, c.id)
    sv.mudar_status_compra(obra, c.id, "Entregue", HOJE)
    assert c.data_entrega == "2026-10-26"
    assert [h["status"] for h in c.historico] == ["Solicitada", "Em cotação", "Aprovada", "Pedido feito", "Entregue"]
    assert c.valor_total == 15600
    assert an.resumo_financeiro(obra)["realizado"] == 15600


def test_compra_validacoes(obra):
    with pytest.raises(ValidacaoErro):
        sv.adicionar_compra(obra, "X", "NAO_EXISTE")
    with pytest.raises(ValidacaoErro):
        sv.adicionar_compra(obra, "X", "EST", quantidade=0)
    with pytest.raises(ValidacaoErro):
        sv.adicionar_compra(obra, "X", "EST", unidade="caixa")
    with pytest.raises(ValidacaoErro):
        sv.adicionar_compra(obra, "X", "EST", categoria="Outra")
    with pytest.raises(ValidacaoErro):
        sv.adicionar_compra(obra, "X", "EST", valor_unitario="abc")
    with pytest.raises(ValidacaoErro):
        sv.adicionar_compra(obra, "X", "EST", valor_unitario="nan")


def test_compra_cancelada_pode_ser_reaberta(obra):
    c = sv.adicionar_compra(obra, "Areia", "ALV", quantidade=5, unidade="m³", valor_unitario=120, hoje=HOJE)
    sv.mudar_status_compra(obra, c.id, "Cancelada", HOJE)
    sv.mudar_status_compra(obra, c.id, "Solicitada", HOJE)
    assert c.status == "Solicitada"


def test_custos_e_estouro(obra):
    est = obra.etapa("EST")
    c = sv.adicionar_compra(obra, "Concreto", "EST", quantidade=400, unidade="m³", valor_unitario=500, hoje=HOJE)
    sv.mudar_status_compra(obra, c.id, "Aprovada", HOJE)
    linha = next(l for l in an.custos_por_etapa(obra) if l["codigo"] == "EST")
    assert linha["comprometido"] == 200_000 and linha["saldo"] == est.orcamento - 200_000
    assert any(a.titulo.startswith("Estouro de orçamento") for a in an.alertas(obra, HOJE))
    assert an.custos_por_categoria(obra)["Material"] == 200_000


def test_compras_atrasadas_e_proximas(obra):
    a = sv.adicionar_compra(obra, "Atrasada", "ALV", valor_unitario=1, data_necessidade="2026-10-20", hoje=HOJE)
    p = sv.adicionar_compra(obra, "Próxima", "ALV", valor_unitario=1, data_necessidade="2026-10-30", hoje=HOJE)
    e = sv.adicionar_compra(obra, "Entregue", "ALV", valor_unitario=1, data_necessidade="2026-10-01", hoje=HOJE)
    for s in ("Aprovada", "Pedido feito", "Entregue"):
        sv.mudar_status_compra(obra, e.id, s, HOJE)
    assert [c.id for c in an.compras_atrasadas(obra, HOJE)] == [a.id]
    assert [c.id for c in an.compras_proximas(obra, HOJE)] == [p.id]


# ---------------------------------------------------------------- tarefas
def test_tarefa_com_checklist(obra):
    t = sv.adicionar_tarefa(obra, "Conferir armação", "EST", "João", "2026-10-28", "Alta", ["Bitolas", "", "Cobrimento"])
    assert len(t.checklist) == 2  # linha vazia ignorada
    with pytest.raises(ValidacaoErro):
        sv.mudar_status_tarefa(obra, t.id, "Concluída", HOJE)
    sv.alternar_item_tarefa(obra, t.id, t.checklist[0].id, HOJE)
    assert t.status == "Em andamento"
    sv.alternar_item_tarefa(obra, t.id, t.checklist[1].id, HOJE)
    sv.mudar_status_tarefa(obra, t.id, "Concluída", HOJE)
    assert t.concluida_em == "2026-10-26" and an.progresso_tarefa(t) == 1
    sv.alternar_item_tarefa(obra, t.id, t.checklist[1].id, HOJE)  # reabre
    assert t.status == "Em andamento" and t.concluida_em == ""


def test_tarefas_atrasadas(obra):
    t = sv.adicionar_tarefa(obra, "Atrasada", prazo=(HOJE - timedelta(days=1)).isoformat(), prioridade="Urgente")
    sv.adicionar_tarefa(obra, "No prazo", prazo=(HOJE + timedelta(days=1)).isoformat())
    assert [x.id for x in an.tarefas_atrasadas(obra, HOJE)] == [t.id]
    sv.mudar_status_tarefa(obra, t.id, "Concluída", HOJE)
    assert an.tarefas_atrasadas(obra, HOJE) == []
    with pytest.raises(ValidacaoErro):
        sv.mudar_status_tarefa(obra, t.id, "Feita", HOJE)


# ---------------------------------------------------------------- alertas
def test_alertas_ordenados_por_gravidade(obra):
    sv.adicionar_tarefa(obra, "Atrasada", prazo="2026-10-01", prioridade="Baixa")
    sv.adicionar_compra(obra, "Atrasada", "ALV", valor_unitario=1, data_necessidade="2026-10-01", hoje=HOJE)
    niveis = [a.ordem for a in an.alertas(obra, HOJE)]
    assert niveis == sorted(niveis)
    assert niveis[0] == 0


def test_moeda():
    assert an.moeda(1234567.891) == "R$ 1.234.567,89"
    assert an.moeda(-10) == "-R$ 10,00"
    assert an.moeda(0) == "R$ 0,00"


def test_numero_formato_brasileiro():
    from gestao_obras.modelos import ler_numero
    assert ler_numero("1.234,56", "v") == 1234.56
    assert ler_numero("R$ 2.500", "v") == 2500
    assert ler_numero("300.000", "v") == 300000  # bug relatado: virava R$ 300,00
    assert ler_numero("300.000,00", "v") == 300000
    assert ler_numero("1.250.000", "v") == 1250000
    assert ler_numero("300000", "v") == 300000
    assert ler_numero("39.90", "v") == 39.9  # ponto seguido de 2 casas continua decimal
    assert ler_numero("2.4", "v") == 2.4
    assert ler_numero("39,9", "v") == 39.9
    assert ler_numero("", "v") == 0


def test_medicao_valor_executado_pelo_checklist(obra):
    """Etapa concluída soma o valor orçado como executado, mesmo sem compras lançadas."""
    sv.marcar_etapa(obra, "PRE", True, HOJE)        # 100% de R$ 40.000 (peso 4%)
    fun = obra.etapa("FUN")                          # 2 itens de R$ 70.000 (peso 7%)
    n = len(fun.checklist)
    for i in fun.checklist[:2]:
        sv.alternar_item_etapa(obra, "FUN", i.id, HOJE)
    linhas = {l["codigo"]: l for l in an.custos_por_etapa(obra)}
    assert linhas["PRE"]["executado"] == 40_000 and linhas["PRE"]["a_executar"] == 0
    assert linhas["FUN"]["executado"] == pytest.approx(70_000 * 2 / n, abs=0.01)
    fin = an.resumo_financeiro(obra)
    assert fin["executado"] == pytest.approx(40_000 + 70_000 * 2 / n, abs=0.01)
    assert fin["executado"] + fin["a_executar"] == pytest.approx(1_000_000, abs=0.05)
    fases = an.por_categoria_etapa(obra)
    assert fases["Preparação"]["executado"] == pytest.approx(40_000)
