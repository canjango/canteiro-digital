"""Revisão técnica com Claude.

O Python monta o pedido (dados da obra ou da etapa + instruções + formato
de resposta em JSON), a camada do navegador envia para a Claude e devolve
o texto, e o Python valida a resposta e guarda a revisão na obra.

Nada aqui fala com a rede: assim a lógica é testável e a chave de API (no
site externo) nunca passa pelo estado do sistema.
"""

from __future__ import annotations

import json
import re
from datetime import date

from . import analise as an
from .modelos import Obra, ValidacaoErro, novo_id
from .padroes import rotulo as rotulo_padrao

NIVEIS = ("critico", "atencao", "ok")
MAX_REVISOES = 20
MAX_FOCO = 300

INSTRUCOES = """Você é um engenheiro civil/arquiteto revisor de obras residenciais no Brasil, com experiência em \
execução, normas ABNT, orçamento (CUB/SINAPI) e planejamento. Revise os dados abaixo de um sistema de gestão de obras \
e aponte problemas concretos e verificáveis: incoerências entre quantitativos, área e padrão construtivo; orçamento \
de etapa fora do razoável; sequência executiva errada; itens de checklist de qualidade ou segurança que faltam; \
prazos incompatíveis; compras atrasadas ou faltando para etapas próximas; riscos citados nas observações.

Regras:
- Responda em português do Brasil, direto, como um colega técnico.
- Use somente os dados fornecidos; quando faltar informação, diga o que falta em "perguntas".
- Não invente valores de mercado precisos; se citar faixa de preço, diga que é estimativa.
- No máximo 8 pontos, do mais grave para o menos grave. Inclua pelo menos um ponto "ok" se algo estiver bem feito.
- Sugira itens de checklist só quando forem realmente necessários e ainda não existirem (no máximo 6), \
  cada um curto (até 120 caracteres) e indicando o código da etapa.

Responda APENAS com um JSON válido, sem texto antes ou depois, neste formato:
{
  "resumo": "2 a 3 frases com a avaliação geral",
  "pontos": [{"nivel": "critico|atencao|ok", "titulo": "curto", "detalhe": "o que verificar ou fazer"}],
  "sugestoes_checklist": [{"etapa": "CÓDIGO", "texto": "item de checklist"}],
  "perguntas": ["informação que falta para uma revisão melhor"]
}"""


# ====================================================================== pedido
def _etapa_resumo(obra: Obra, e, hoje: date, detalhado: bool) -> dict:
    d = {
        "codigo": e.codigo,
        "nome": e.nome,
        "fase": e.categoria,
        "status": an.status_etapa(obra, e, hoje),
        "avanco": f"{an.progresso_etapa(e):.0%}",
        "orcamento": round(e.orcamento, 2),
        "peso_pct": e.peso,
        "inicio_previsto": e.inicio_previsto,
        "fim_previsto": e.fim_previsto,
        "depende_de": e.predecessoras,
    }
    if e.observacao:
        d["observacao"] = e.observacao
    pend = [i.texto for i in e.checklist if not i.feito]
    if detalhado:
        d.update(
            escopo=e.descricao,
            equipe=e.equipe,
            duracao_tipica_dias=e.duracao_dias,
            quantitativos_ref_100m2=e.servicos,
            normas=e.normas,
            checklist_feito=[i.texto for i in e.checklist if i.feito],
            checklist_pendente=pend,
        )
    else:
        d["itens_pendentes"] = len(pend)
    return d


def montar_pedido(obra: Obra, escopo: str, codigo: str = "", foco: str = "", hoje: date | None = None) -> str:
    """Texto completo enviado à Claude."""
    hoje = hoje or date.today()
    if escopo not in ("obra", "etapa"):
        raise ValidacaoErro("Escopo de revisão inválido")
    foco = " ".join(str(foco or "").split())[:MAX_FOCO]
    fin = an.resumo_financeiro(obra)
    pad = an.resumo_padrao(obra)
    dados: dict = {
        "data_de_hoje": hoje.isoformat(),
        "obra": {
            "nome": obra.nome,
            "tipo": "residência unifamiliar",
            "area_construida_m2": obra.area_construida,
            "padrao_construtivo": rotulo_padrao(obra.padrao),
            "valor_m2_referencia": obra.valor_m2,
            "tabela_cub": pad["referencia"],
            "custo_pelo_padrao": pad["estimado"],
            "orcamento_total_custo_direto": obra.orcamento_total,
            "bdi_percentual": obra.bdi,
            "preco_de_venda_com_bdi": pad["preco_venda"],
            "inicio": obra.inicio,
            "termino_previsto": obra.fim_previsto,
            "avanco_fisico": f"{an.progresso_fisico(obra):.0%}",
            "avanco_previsto_hoje": f"{an.progresso_previsto(obra, hoje):.0%}",
            "executado_medicao": fin["executado"],
            "comprometido_em_compras": fin["comprometido"],
        },
        "alertas_do_sistema": [f"{a.nivel}: {a.titulo} ({a.detalhe})" for a in an.alertas(obra, hoje)[:15]],
    }
    if escopo == "etapa":
        e = obra.etapa(codigo)
        dados["etapa_em_revisao"] = _etapa_resumo(obra, e, hoje, detalhado=True)
        dados["predecessoras"] = [_etapa_resumo(obra, obra.etapa(p), hoje, False) for p in e.predecessoras
                                  if any(x.codigo == p for x in obra.etapas)]
        dados["compras_da_etapa"] = [_compra(c) for c in obra.compras if c.etapa == codigo]
        dados["tarefas_da_etapa"] = [_tarefa(t) for t in obra.tarefas if t.etapa == codigo]
        from .servicos import situacao_materiais
        dados["lista_de_materiais"] = [
            {"material": x["material"], "necessario": x["necessario"], "un": x["un"], "situacao": x["situacao"]}
            for x in situacao_materiais(obra, codigo)
        ]
        alvo = f"a etapa {e.codigo} – {e.nome}"
    else:
        dados["etapas"] = [_etapa_resumo(obra, e, hoje, False) for e in obra.etapas]
        dados["compras"] = [_compra(c) for c in obra.compras if c.status != "Cancelada"][:60]
        dados["tarefas_abertas"] = [_tarefa(t) for t in obra.tarefas if t.status != "Concluída"][:40]
        alvo = "a obra inteira (visão geral de prazo, custo, sequência e riscos)"
    pedido = f"{INSTRUCOES}\n\nRevise {alvo}."
    if foco:
        pedido += f"\nFoco pedido pelo usuário: {foco}"
    return pedido + "\n\nDADOS:\n" + json.dumps(dados, ensure_ascii=False, indent=1)


def _compra(c) -> dict:
    return {"descricao": c.descricao, "etapa": c.etapa, "categoria": c.categoria, "qtd": c.quantidade,
            "un": c.unidade, "valor_total": c.valor_total, "status": c.status, "precisa_ate": c.data_necessidade}


def _tarefa(t) -> dict:
    return {"titulo": t.titulo, "etapa": t.etapa, "responsavel": t.responsavel, "prazo": t.prazo,
            "prioridade": t.prioridade, "status": t.status}


# ====================================================================== resposta
def _extrair_json(texto: str):
    texto = (texto or "").strip()
    bloco = re.search(r"```(?:json)?\s*(\{.*\})\s*```", texto, re.S)
    if bloco:
        texto = bloco.group(1)
    else:
        ini, fim = texto.find("{"), texto.rfind("}")
        if ini >= 0 and fim > ini:
            texto = texto[ini:fim + 1]
    return json.loads(texto)


def _txt(v, maximo: int) -> str:
    return " ".join(str(v or "").split())[:maximo]


def interpretar_resposta(texto: str, codigos_validos: list[str]) -> dict:
    """Valida e limpa a resposta. Se não vier JSON, guarda o texto como resumo."""
    try:
        bruto = _extrair_json(texto)
        if not isinstance(bruto, dict):
            raise ValueError
    except (ValueError, json.JSONDecodeError):
        limpo = (texto or "").strip()
        if not limpo:
            raise ValidacaoErro("A Claude não devolveu resposta")
        return {"resumo": limpo[:4000], "pontos": [], "sugestoes": [], "perguntas": [], "formato_livre": True}

    pontos = []
    for p in bruto.get("pontos", []) if isinstance(bruto.get("pontos"), list) else []:
        if not isinstance(p, dict):
            continue
        nivel = str(p.get("nivel", "atencao")).lower().replace("í", "i").replace("ç", "c").replace("ã", "a")
        nivel = nivel if nivel in NIVEIS else "atencao"
        titulo = _txt(p.get("titulo"), 140)
        if titulo:
            pontos.append({"nivel": nivel, "titulo": titulo, "detalhe": _txt(p.get("detalhe"), 600)})
    pontos.sort(key=lambda p: NIVEIS.index(p["nivel"]))

    sugestoes = []
    vistos = set()
    for s in bruto.get("sugestoes_checklist", []) if isinstance(bruto.get("sugestoes_checklist"), list) else []:
        if not isinstance(s, dict):
            continue
        etapa = str(s.get("etapa", "")).strip().upper()
        texto_item = _txt(s.get("texto"), 160)
        if etapa in codigos_validos and texto_item and (etapa, texto_item.lower()) not in vistos:
            vistos.add((etapa, texto_item.lower()))
            sugestoes.append({"etapa": etapa, "texto": texto_item, "adicionado": False})

    perguntas = [_txt(q, 300) for q in bruto.get("perguntas", []) if _txt(q, 300)] \
        if isinstance(bruto.get("perguntas"), list) else []
    resumo = _txt(bruto.get("resumo"), 1200)
    if not (resumo or pontos):
        raise ValidacaoErro("A resposta da Claude veio vazia")
    return {"resumo": resumo, "pontos": pontos[:10], "sugestoes": sugestoes[:8], "perguntas": perguntas[:6],
            "formato_livre": False}


def registrar_revisao(obra: Obra, escopo: str, codigo: str, foco: str, resposta: dict,
                      origem: str, hoje: date | None = None) -> dict:
    rev = {
        "id": novo_id("rev"),
        "data": (hoje or date.today()).isoformat(),
        "escopo": escopo,
        "codigo": codigo if escopo == "etapa" else "",
        "foco": " ".join(str(foco or "").split())[:MAX_FOCO],
        "origem": origem,
        **resposta,
    }
    # sugestões que já existem no checklist chegam marcadas como adicionadas
    for s in rev["sugestoes"]:
        try:
            textos = {i.texto.lower() for i in obra.etapa(s["etapa"]).checklist}
        except ValidacaoErro:
            continue
        s["adicionado"] = s["texto"].lower() in textos
    obra.revisoes.insert(0, rev)
    del obra.revisoes[MAX_REVISOES:]
    return rev


def revisao(obra: Obra, rev_id: str) -> dict:
    for r in obra.revisoes:
        if r.get("id") == rev_id:
            return r
    raise ValidacaoErro("Revisão não encontrada")


def ultima_revisao(obra: Obra, escopo: str, codigo: str = "") -> dict | None:
    for r in obra.revisoes:
        if r.get("escopo") == escopo and (escopo == "obra" or r.get("codigo") == codigo):
            return r
    return None
