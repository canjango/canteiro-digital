import json
import re
from datetime import date

import pytest

from app import criar_app
from gestao_obras import ponte_web
from gestao_obras.sistema import Sistema, obra_exemplo
from gestao_obras.ui import render

HOJE = date(2026, 10, 26)


@pytest.fixture
def sis():
    s = Sistema(hoje=HOJE)
    s.despachar("obra.exemplo")
    return s


def test_todas_as_telas_renderizam(sis):
    for aba in ("painel", "etapas", "compras", "tarefas", "obras"):
        assert sis.despachar("ui.aba", {"aba": aba})["ok"]
        html = render(sis)
        assert 'id="conteudo"' in html


def test_sem_obra_mostra_cadastro():
    s = Sistema(hoje=HOJE)
    html = render(s)
    assert "Comece cadastrando a primeira obra" in html
    assert 'data-action="obra.criar"' in html
    r = s.despachar("etapa.item", {"codigo": "PRE", "item": "x"})
    assert not r["ok"] and "Selecione" in s.ui["erro"]


def test_checklist_por_botao(sis):
    sis.despachar("ui.aba", {"aba": "etapas"})
    sis.despachar("ui.expandir", {"codigo": "ALV"})
    html = render(sis)
    m = re.search(r'data-action="etapa.item" data-codigo="ALV" data-item="([^"]+)" aria-pressed="false"', html)
    assert m, "botão de checklist não encontrado"
    r = sis.despachar("etapa.item", {"codigo": "ALV", "item": m.group(1)})
    assert r["ok"] and r["alteradas"] == [sis.obra.id]
    assert f'data-item="{m.group(1)}" aria-pressed="true"' in render(sis)


def test_html_escapa_texto_do_usuario(sis):
    sis.despachar("tarefa.criar", {"titulo": '<img src=x onerror="alert(1)">', "itens": "<b>x</b>"})
    sis.despachar("ui.aba", {"aba": "tarefas"})
    html = render(sis)
    assert "<img src=x" not in html and "&lt;img src=x" in html
    assert "<b>x</b>" not in html


def test_acao_invalida_nao_derruba(sis):
    r = sis.despachar("nao.existe", {})
    assert not r["ok"] and "desconhecida" in sis.ui["erro"]
    r = sis.despachar("compra.status", {"id": "nao", "status": "Entregue"})
    assert not r["ok"]
    r = sis.despachar("ui.aba", {"aba": "hack"})
    assert not r["ok"]


def test_excluir_obra_pede_confirmacao(sis):
    oid = sis.obra.id
    sis.despachar("ui.aba", {"aba": "obras"})
    r = sis.despachar("obra.excluir", {"id": oid})
    assert r["ok"] and r["removidas"] == [] and oid in sis.obras
    assert "Sim, excluir" in render(sis)
    sis.despachar("ui.aba", {"aba": "painel"})  # sair da tela cancela a confirmação
    assert sis.ui["confirmar_exclusao"] == ""
    sis.despachar("obra.excluir", {"id": oid})
    r = sis.despachar("obra.excluir", {"id": oid})
    assert r["removidas"] == [oid] and oid not in sis.obras and sis.obra is None


def test_editar_obra_redistribui_orcamento(sis):
    o = sis.obra
    o.etapa("EST").orcamento = 999  # ajuste manual deve ser preservado
    d = {"nome": o.nome, "cliente": "", "endereco": "", "responsavel_tecnico": "",
         "inicio": o.inicio, "fim_previsto": o.fim_previsto, "orcamento_total": "1000000"}
    assert sis.despachar("obra.editar", d)["ok"]
    assert o.etapa("FUN").orcamento == 80_000
    assert o.etapa("EST").orcamento == 999


def test_ponte_json_ida_e_volta():
    ponte_web.iniciar(Sistema(hoje=HOJE))
    r = json.loads(ponte_web.acao("obra.exemplo", "{}"))
    assert r["ok"] and len(r["gravar"]) == 1
    doc = r["gravar"][0]["doc"]
    # recarregar como se viesse do banco
    novo = Sistema(hoje=HOJE)
    ponte_web.iniciar(novo)
    falhas = json.loads(ponte_web.carregar(json.dumps([doc, {"lixo": True}, "texto"])))
    assert len(novo.obras) == 1 and len(falhas) == 1
    assert novo.obra.nome == doc["nome"]
    # JSON malformado não quebra
    assert json.loads(ponte_web.acao("ui.aba", "{quebrado"))["ok"] is False


def test_documento_cabe_no_limite_do_banco():
    o = obra_exemplo(HOJE)
    assert len(json.dumps(o.para_dict()).encode()) < 256 * 1024


# ---------------------------------------------------------------- Flask
@pytest.fixture
def cliente(tmp_path):
    app = criar_app(tmp_path / "obras.json", Sistema(hoje=HOJE))
    return app.test_client(), tmp_path / "obras.json"


def test_flask_fluxo_completo(cliente):
    c, arquivo = cliente
    assert c.get("/").status_code == 200
    r = c.post("/api/acao", json={"acao": "obra.criar", "dados": {"nome": "Obra Flask", "orcamento_total": "500000",
                                                                    "inicio": "2026-11-01", "fim_previsto": "2027-06-30"}})
    assert r.status_code == 200 and r.get_json()["ok"]
    dados = json.loads(arquivo.read_text(encoding="utf-8"))
    assert dados[0]["nome"] == "Obra Flask" and len(dados[0]["etapas"]) == 17
    r = c.post("/api/acao", json={"acao": "compra.criar", "dados": {"descricao": "Cimento", "etapa": "ALV",
                                                                      "quantidade": "100", "unidade": "sc", "valor_unitario": "39,90"}})
    assert r.get_json()["ok"]
    obras = c.get("/api/obras").get_json()
    assert obras[0]["compras"][0]["valor_unitario"] == 39.9
    # dados persistem após reiniciar o servidor
    app2 = criar_app(arquivo, Sistema(hoje=HOJE))
    assert "Obra Flask" in app2.test_client().get("/").get_data(as_text=True)


def test_flask_corpo_invalido(cliente):
    c, _ = cliente
    r = c.post("/api/acao", data="nada", content_type="text/plain")
    assert r.status_code == 200 and r.get_json()["ok"] is False


def test_filtros_validados(sis):
    assert not sis.despachar("ui.filtro", {"filtro_compra": "xyz"})["ok"]
    assert not sis.despachar("ui.filtro", {"filtro_etapa": "ZZZ"})["ok"]
    assert sis.despachar("ui.filtro", {"filtro_etapa": "EST", "filtro_compra": "todas"})["ok"]
    sis.despachar("ui.aba", {"aba": "compras"})
    html = render(sis)
    assert "Concreto usinado fck 30" in html and "Bloco cerâmico" not in html


def test_dois_servidores_nao_compartilham_estado(tmp_path):
    a = criar_app(tmp_path / "a.json", Sistema(hoje=HOJE)).test_client()
    b = criar_app(tmp_path / "b.json", Sistema(hoje=HOJE)).test_client()
    a.post("/api/acao", json={"acao": "obra.criar", "dados": {"nome": "Só no A"}})
    assert b.get("/api/obras").get_json() == []


def test_orcamento_digitado_com_ponto_de_milhar(sis):
    o = sis.obra
    d = {"nome": o.nome, "cliente": "", "endereco": "", "responsavel_tecnico": "",
         "inicio": o.inicio, "fim_previsto": o.fim_previsto, "orcamento_total": "300.000"}
    assert sis.despachar("obra.editar", d)["ok"]
    assert o.orcamento_total == 300000
    sis.despachar("ui.aba", {"aba": "obras"})
    assert 'value="300.000,00"' in render(sis)  # campo mostra o valor no formato brasileiro
    # salvar de novo sem mexer no campo mantém o valor
    d["orcamento_total"] = "300.000,00"
    assert sis.despachar("obra.editar", d)["ok"] and o.orcamento_total == 300000
    assert 'type="number"' not in render(sis)
