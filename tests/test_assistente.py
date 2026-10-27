"""Revisão com Claude: pedido, interpretação da resposta, fluxo e segurança."""

import json
from datetime import date

import pytest

from gestao_obras import assistente as ia
from gestao_obras import ponte_web
from gestao_obras.modelos import Obra, ValidacaoErro
from gestao_obras.sistema import Sistema
from gestao_obras.ui import render

HOJE = date(2026, 10, 26)

RESPOSTA = {
    "resumo": "Obra coerente com o padrão normal; atenção às compras da alvenaria.",
    "pontos": [
        {"nivel": "ok", "titulo": "Fundação concluída", "detalhe": "Checklist completo."},
        {"nivel": "crítico", "titulo": "Cimento atrasado", "detalhe": "Compra em cotação após a data."},
        {"nivel": "atencao", "titulo": "Laje", "detalhe": "Conferir escoramento."},
    ],
    "sugestoes_checklist": [
        {"etapa": "est", "texto": "Conferir contraflecha da laje antes da concretagem"},
        {"etapa": "EST", "texto": "Conferir contraflecha da laje antes da concretagem"},  # repetida
        {"etapa": "XYZ", "texto": "Etapa que não existe"},
        {"etapa": "ALV", "texto": "Marcação da primeira fiada conferida"},  # já existe no checklist
    ],
    "perguntas": ["Qual o tipo de solo indicado na sondagem?"],
}


@pytest.fixture
def sis():
    s = Sistema(hoje=HOJE)
    s.despachar("obra.exemplo")
    return s


# ---------------------------------------------------------------- pedido
def test_pedido_da_obra_tem_dados_e_formato(sis):
    p = ia.montar_pedido(sis.obra, "obra", foco="  orçamento   da cobertura ", hoje=HOJE)
    assert "Responda APENAS com um JSON" in p
    assert "Foco pedido pelo usuário: orçamento da cobertura" in p
    dados = json.loads(p.split("DADOS:\n", 1)[1])
    assert dados["obra"]["area_construida_m2"] == 100
    assert len(dados["etapas"]) == 17 and dados["compras"] and dados["alertas_do_sistema"]


def test_pedido_da_etapa_e_detalhado(sis):
    p = ia.montar_pedido(sis.obra, "etapa", "EST", hoje=HOJE)
    dados = json.loads(p.split("DADOS:\n", 1)[1])
    et = dados["etapa_em_revisao"]
    assert et["codigo"] == "EST" and et["checklist_pendente"] and et["quantitativos_ref_100m2"]
    assert et["observacao"].startswith("Laje do quarto 2")
    assert [x["codigo"] for x in dados["predecessoras"]] == ["FUN"]
    assert all(c["etapa"] == "EST" for c in dados["compras_da_etapa"])
    with pytest.raises(ValidacaoErro):
        ia.montar_pedido(sis.obra, "outra")
    assert len(ia.montar_pedido(sis.obra, "obra", foco="x" * 999, hoje=HOJE)) < 60_000


# ---------------------------------------------------------------- resposta
def test_interpretar_resposta_valida_e_limpa(sis):
    codigos = [e.codigo for e in sis.obra.etapas]
    r = ia.interpretar_resposta("Segue:\n```json\n" + json.dumps(RESPOSTA, ensure_ascii=False) + "\n```", codigos)
    assert [p["nivel"] for p in r["pontos"]] == ["critico", "atencao", "ok"]  # ordenado por gravidade
    assert [(s["etapa"], s["texto"]) for s in r["sugestoes"]] == [
        ("EST", "Conferir contraflecha da laje antes da concretagem"),
        ("ALV", "Marcação da primeira fiada conferida"),
    ]
    assert r["perguntas"] == ["Qual o tipo de solo indicado na sondagem?"] and not r["formato_livre"]


def test_resposta_em_texto_livre_e_vazia():
    r = ia.interpretar_resposta("Não consegui gerar JSON, mas a obra parece ok.", ["PRE"])
    assert r["formato_livre"] and r["resumo"].startswith("Não consegui")
    with pytest.raises(ValidacaoErro):
        ia.interpretar_resposta("   ", ["PRE"])
    with pytest.raises(ValidacaoErro):
        ia.interpretar_resposta('{"resumo": "", "pontos": []}', ["PRE"])


# ---------------------------------------------------------------- fluxo
def pedir(s, dados):
    return json.loads(ponte_web.acao("ia.revisar", json.dumps(dados), s))


def test_sem_claude_conectada_nao_revisa(sis):
    r = pedir(sis, {"escopo": "obra"})
    assert not r["ok"] and r["ia"] is None and "não está disponível" in sis.ui["erro"]


def test_fluxo_completo_de_revisao(sis):
    sis.despachar("ia.modo", {"modo": "claude"})
    r = pedir(sis, {"escopo": "etapa", "codigo": "EST", "foco": "laje"})
    assert r["ok"] and r["ia"]["texto"].startswith("Você é um engenheiro")
    pid = r["ia"]["id"]
    sis.ui.update(aba="etapas", abertas=["EST"])
    assert "Claude está revisando esta etapa" in render(sis)
    assert not pedir(sis, {"escopo": "obra"})["ok"]                   # uma revisão por vez
    assert sis.despachar("ia.resultado", {"id": "outro", "texto": "{}"})["alteradas"] == []  # resposta velha
    res = sis.despachar("ia.resultado", {"id": pid, "texto": json.dumps(RESPOSTA)})
    assert res["ok"] and res["alteradas"] == [sis.obra.id]
    rev = sis.obra.revisoes[0]
    assert rev["escopo"] == "etapa" and rev["codigo"] == "EST" and rev["foco"] == "laje"
    assert rev["sugestoes"][1]["adicionado"] is True  # já estava no checklist
    assert sis.ui["ia_em_andamento"] is None and "3 ponto(s)" in sis.ui["msg"]
    # aplicar sugestão
    antes = len(sis.obra.etapa("EST").checklist)
    assert sis.despachar("ia.adicionar", {"rev": rev["id"], "idx": "0"})["ok"]
    assert len(sis.obra.etapa("EST").checklist) == antes + 1 and rev["sugestoes"][0]["adicionado"]
    sis.despachar("ia.adicionar", {"rev": rev["id"], "idx": "0"})  # repetir não duplica
    assert len(sis.obra.etapa("EST").checklist) == antes + 1
    assert not sis.despachar("ia.adicionar", {"rev": rev["id"], "idx": "9"})["ok"]
    # aparece no cartão da etapa
    sis.ui.update(aba="etapas", abertas=["EST"])
    html = render(sis)
    assert "Cimento atrasado" in html and "no checklist" in html
    # sobrevive a salvar e carregar
    assert Obra.de_dict(sis.obra.para_dict()).revisoes[0]["id"] == rev["id"]
    assert sis.despachar("ia.apagar", {"rev": rev["id"]})["ok"] and not sis.obra.revisoes


def test_erros_e_cancelamento(sis):
    sis.despachar("ia.modo", {"modo": "chave", "final": "sk-ant-api03-SEGREDO-abcd"})
    assert sis.ui["ia_chave_final"] == "abcd"  # só os 4 últimos caracteres ficam no estado
    pid = pedir(sis, {"escopo": "obra"})["ia"]["id"]
    r = sis.despachar("ia.resultado", {"id": pid, "erro": "chave_invalida"})
    assert not r["ok"] and "chave de API foi recusada" in sis.ui["erro"] and sis.ui["ia_em_andamento"] is None
    pid = pedir(sis, {"escopo": "obra"})["ia"]["id"]
    sis.despachar("ia.cancelar", {})
    assert sis.ui["ia_em_andamento"] is None
    assert sis.despachar("ia.resultado", {"id": pid, "texto": json.dumps(RESPOSTA)})["alteradas"] == []
    assert sis.obra.revisoes == []


def test_texto_da_ia_e_escapado(sis):
    sis.despachar("ia.modo", {"modo": "claude"})
    pid = pedir(sis, {"escopo": "obra"})["ia"]["id"]
    malicioso = {"resumo": "<script>alert(1)</script>", "pontos": [{"nivel": "ok", "titulo": "<img src=x onerror=alert(1)>"}]}
    sis.despachar("ia.resultado", {"id": pid, "texto": json.dumps(malicioso)})
    sis.ui["aba"] = "painel"
    html = render(sis)
    assert "<script>alert" not in html and "<img src=x" not in html and "&lt;img src=x" in html


def test_limite_de_revisoes_guardadas(sis):
    for _ in range(ia.MAX_REVISOES + 5):
        ia.registrar_revisao(sis.obra, "obra", "", "", {"resumo": "ok", "pontos": [], "sugestoes": [], "perguntas": []}, "Claude", HOJE)
    assert len(sis.obra.revisoes) == ia.MAX_REVISOES
    assert len(json.dumps(sis.obra.para_dict()).encode()) < 256 * 1024


def test_config_nao_mostra_campo_de_chave_dentro_da_claude(sis):
    sis.ui["aba"] = "obras"
    sis.despachar("ia.modo", {"modo": "nenhum", "chave_permitida": False})
    assert 'data-local="ia-chave"' not in render(sis)
    sis.despachar("ia.modo", {"modo": "nenhum", "chave_permitida": True})
    assert 'data-local="ia-chave"' in render(sis)
    sis.despachar("ia.modo", {"modo": "claude"})
    assert "Conectada pela sua conta da Claude" in render(sis)
