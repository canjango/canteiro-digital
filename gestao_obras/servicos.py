"""Regras de negócio: criação de obras, checklists, compras e tarefas.

Toda função recebe `hoje` opcional para que os testes sejam determinísticos.
"""

from __future__ import annotations

from datetime import date, timedelta

import copy

from .etapas import CAMPOS_DESCRITIVOS, ETAPAS_PADRAO, MODELO_VERSAO
from .modelos import (
    CATEGORIAS_COMPRA,
    PRIORIDADES,
    STATUS_TAREFA,
    TRANSICOES_COMPRA,
    UNIDADES,
    Compra,
    Etapa,
    ItemChecklist,
    Obra,
    Tarefa,
    ValidacaoErro,
    ler_data,
    ler_numero,
)


def _hoje(hoje: date | None) -> date:
    return hoje or date.today()


def _texto(valor, nome: str, obrigatorio: bool = True, maximo: int = 200) -> str:
    t = " ".join(str(valor or "").split())
    if obrigatorio and not t:
        raise ValidacaoErro(f"Informe {nome}")
    if len(t) > maximo:
        raise ValidacaoErro(f"{nome.capitalize()} muito longo (máx. {maximo} caracteres)")
    return t


def _opcao(valor, opcoes, nome: str) -> str:
    if valor not in opcoes:
        raise ValidacaoErro(f"{nome} inválido: {valor!r}")
    return valor


# ============================================================== obra
def criar_obra(
    nome: str,
    cliente: str = "",
    endereco: str = "",
    responsavel_tecnico: str = "",
    inicio: str = "",
    fim_previsto: str = "",
    orcamento_total=0,
    exemplo: bool = False,
    area_construida=100,
) -> Obra:
    """Cria a obra com todas as etapas padrão, distribuindo o orçamento pelo
    peso de cada etapa e o cronograma pela duração típica e pela sequência."""
    d_ini = ler_data(inicio)
    d_fim = ler_data(fim_previsto)
    if d_ini and d_fim and d_fim <= d_ini:
        raise ValidacaoErro("A data de término deve ser posterior ao início")
    orc = ler_numero(orcamento_total, "Orçamento")
    area = _area(area_construida)

    obra = Obra(
        nome=_texto(nome, "o nome da obra"),
        cliente=_texto(cliente, "cliente", obrigatorio=False),
        endereco=_texto(endereco, "endereço", obrigatorio=False),
        responsavel_tecnico=_texto(responsavel_tecnico, "responsável técnico", obrigatorio=False),
        inicio=d_ini.isoformat() if d_ini else "",
        fim_previsto=d_fim.isoformat() if d_fim else "",
        orcamento_total=orc,
        exemplo=exemplo,
        area_construida=area,
        modelo_etapas=MODELO_VERSAO,
    )
    obra.etapas = [_etapa_do_catalogo(e, orc) for e in ETAPAS_PADRAO]
    if d_ini and d_fim:
        planejar_cronograma(obra)
    return obra


def _area(valor) -> float:
    area = ler_numero(valor if valor not in (None, "") else 100, "Área construída")
    if not 10 <= area <= 5000:
        raise ValidacaoErro("Área construída deve ficar entre 10 e 5.000 m²")
    return area


def _etapa_do_catalogo(e: dict, orcamento_total: float) -> Etapa:
    return Etapa(
        codigo=e["codigo"],
        nome=e["nome"],
        categoria=e["categoria"],
        peso=e["peso"],
        predecessoras=list(e["predecessoras"]),
        checklist=[ItemChecklist(texto=t) for t in e["checklist"]],
        orcamento=round(orcamento_total * e["peso"] / 100, 2),
        **{c: copy.deepcopy(e[c]) for c in CAMPOS_DESCRITIVOS},
    )


def completar_detalhes(obra: Obra) -> bool:
    """Preenche o detalhamento técnico (escopo, quantitativos, equipe...) das
    etapas que ainda não têm, sem mexer em checklist, pesos ou valores.
    Usado ao carregar obras criadas antes do catálogo detalhado."""
    catalogo = {e["codigo"]: e for e in ETAPAS_PADRAO}
    mudou = False
    for etapa in obra.etapas:
        cat = catalogo.get(etapa.codigo)
        if cat and not etapa.descricao:
            for c in CAMPOS_DESCRITIVOS:
                setattr(etapa, c, copy.deepcopy(cat[c]))
            mudou = True
    return mudou


def aplicar_modelo(obra: Obra) -> dict:
    """Atualiza as etapas da obra para o catálogo atual, preservando o que já
    foi feito: itens marcados continuam marcados, itens criados pelo usuário
    são mantidos, observações, datas e orçamentos ajustados à mão também.
    Retorna um resumo do que mudou."""
    catalogo = {e["codigo"]: e for e in ETAPAS_PADRAO}
    existentes = {e.codigo: e for e in obra.etapas}
    novas: list[Etapa] = []
    itens_novos = 0
    for cat in ETAPAS_PADRAO:
        atual = existentes.pop(cat["codigo"], None)
        if atual is None:
            novas.append(_etapa_do_catalogo(cat, obra.orcamento_total))
            itens_novos += len(cat["checklist"])
            continue
        # orçamento: só redistribui se ainda era o valor proporcional ao peso antigo
        proporcional = abs(atual.orcamento - round(obra.orcamento_total * atual.peso / 100, 2)) < 0.01
        por_texto = {i.texto: i for i in atual.checklist}
        lista = []
        for texto in cat["checklist"]:
            item = por_texto.pop(texto, None)
            if item is None:
                item = ItemChecklist(texto=texto)
                itens_novos += 1
            lista.append(item)
        lista.extend(i for i in atual.checklist if i.texto in por_texto)  # itens do usuário
        atual.checklist = lista
        atual.nome, atual.categoria, atual.peso = cat["nome"], cat["categoria"], cat["peso"]
        atual.predecessoras = list(cat["predecessoras"])
        for c in CAMPOS_DESCRITIVOS:
            setattr(atual, c, copy.deepcopy(cat[c]))
        if proporcional:
            atual.orcamento = round(obra.orcamento_total * cat["peso"] / 100, 2)
        novas.append(atual)
    novas.extend(existentes.values())  # etapas fora do catálogo ficam no fim
    obra.etapas = novas
    obra.modelo_etapas = MODELO_VERSAO
    return {"itens_novos": itens_novos}


def salvar_observacao(obra: Obra, codigo: str, texto: str) -> Etapa:
    etapa = obra.etapa(codigo)
    t = str(texto or "").replace("\r\n", "\n").strip()
    if len(t) > 2000:
        raise ValidacaoErro("Observação muito longa (máx. 2.000 caracteres)")
    etapa.observacao = t
    return etapa


def planejar_cronograma(obra: Obra) -> None:
    """Cronograma pelo método do caminho crítico simplificado: cada etapa
    dura proporcionalmente ao seu peso e começa quando a última predecessora
    termina. O resultado é escalado para caber entre início e término."""
    d_ini, d_fim = ler_data(obra.inicio), ler_data(obra.fim_previsto)
    if not (d_ini and d_fim):
        raise ValidacaoErro("Defina início e término da obra para planejar o cronograma")
    # duração típica da etapa (dias); obras antigas sem esse dado usam o peso
    duracao = {e.codigo: float(e.duracao_dias) if e.duracao_dias > 0 else max(e.peso, 0.5) for e in obra.etapas}
    fim_rel: dict[str, float] = {}
    ini_rel: dict[str, float] = {}
    for e in obra.etapas:  # catálogo já está em ordem topológica
        ini_rel[e.codigo] = max((fim_rel.get(p, 0.0) for p in e.predecessoras), default=0.0)
        fim_rel[e.codigo] = ini_rel[e.codigo] + duracao[e.codigo]
    total = max(fim_rel.values())
    dias = (d_fim - d_ini).days
    for e in obra.etapas:
        a = d_ini + timedelta(days=round(ini_rel[e.codigo] / total * dias))
        b = d_ini + timedelta(days=round(fim_rel[e.codigo] / total * dias))
        e.inicio_previsto = a.isoformat()
        e.fim_previsto = max(a, b - timedelta(days=1)).isoformat() if b > a else a.isoformat()


def atualizar_etapa(obra: Obra, codigo: str, *, orcamento=None, inicio_previsto=None, fim_previsto=None) -> Etapa:
    etapa = obra.etapa(codigo)
    if orcamento is not None:
        etapa.orcamento = ler_numero(orcamento, "Orçamento da etapa")
    ini = ler_data(inicio_previsto) if inicio_previsto is not None else ler_data(etapa.inicio_previsto)
    fim = ler_data(fim_previsto) if fim_previsto is not None else ler_data(etapa.fim_previsto)
    if ini and fim and fim < ini:
        raise ValidacaoErro("O fim previsto da etapa não pode ser antes do início")
    if inicio_previsto is not None:
        etapa.inicio_previsto = ini.isoformat() if ini else ""
    if fim_previsto is not None:
        etapa.fim_previsto = fim.isoformat() if fim else ""
    return etapa


# ============================================================== checklist
def _alternar(item: ItemChecklist, hoje: date | None) -> ItemChecklist:
    item.feito = not item.feito
    item.concluido_em = _hoje(hoje).isoformat() if item.feito else ""
    return item


def alternar_item_etapa(obra: Obra, codigo: str, item_id: str, hoje: date | None = None) -> ItemChecklist:
    etapa = obra.etapa(codigo)
    for item in etapa.checklist:
        if item.id == item_id:
            return _alternar(item, hoje)
    raise ValidacaoErro("Item de checklist não encontrado")


def marcar_etapa(obra: Obra, codigo: str, feito: bool, hoje: date | None = None) -> None:
    """Marca/desmarca todos os itens de uma etapa."""
    for item in obra.etapa(codigo).checklist:
        if item.feito != feito:
            _alternar(item, hoje)


def adicionar_item_etapa(obra: Obra, codigo: str, texto: str) -> ItemChecklist:
    item = ItemChecklist(texto=_texto(texto, "o texto do item"))
    obra.etapa(codigo).checklist.append(item)
    return item


def remover_item_etapa(obra: Obra, codigo: str, item_id: str) -> None:
    etapa = obra.etapa(codigo)
    antes = len(etapa.checklist)
    etapa.checklist = [i for i in etapa.checklist if i.id != item_id]
    if len(etapa.checklist) == antes:
        raise ValidacaoErro("Item de checklist não encontrado")


# ============================================================== compras
def adicionar_compra(
    obra: Obra,
    descricao: str,
    etapa: str,
    categoria: str = "Material",
    quantidade=1,
    unidade: str = "un",
    valor_unitario=0,
    fornecedor: str = "",
    prioridade: str = "Média",
    data_necessidade: str = "",
    hoje: date | None = None,
) -> Compra:
    obra.etapa(etapa)  # valida a etapa
    qtd = ler_numero(quantidade, "Quantidade")
    if qtd <= 0:
        raise ValidacaoErro("Quantidade deve ser maior que zero")
    nec = ler_data(data_necessidade)
    compra = Compra(
        descricao=_texto(descricao, "a descrição da compra"),
        etapa=etapa,
        categoria=_opcao(categoria, CATEGORIAS_COMPRA, "Categoria"),
        quantidade=qtd,
        unidade=_opcao(unidade, UNIDADES, "Unidade"),
        valor_unitario=ler_numero(valor_unitario, "Valor unitário"),
        fornecedor=_texto(fornecedor, "fornecedor", obrigatorio=False),
        prioridade=_opcao(prioridade, PRIORIDADES, "Prioridade"),
        data_necessidade=nec.isoformat() if nec else "",
    )
    compra.historico.append({"data": _hoje(hoje).isoformat(), "status": compra.status})
    obra.compras.append(compra)
    return compra


def mudar_status_compra(obra: Obra, compra_id: str, novo: str, hoje: date | None = None) -> Compra:
    compra = obra.compra(compra_id)
    permitidos = TRANSICOES_COMPRA.get(compra.status, ())
    if novo not in permitidos:
        raise ValidacaoErro(f"Não é possível passar de '{compra.status}' para '{novo}'")
    if novo in ("Aprovada", "Pedido feito") and compra.valor_unitario <= 0:
        raise ValidacaoErro("Informe o valor unitário antes de aprovar a compra")
    compra.status = novo
    d = _hoje(hoje).isoformat()
    compra.data_entrega = d if novo == "Entregue" else ""
    compra.historico.append({"data": d, "status": novo})
    return compra


def atualizar_preco_compra(obra: Obra, compra_id: str, valor_unitario, fornecedor: str | None = None) -> Compra:
    compra = obra.compra(compra_id)
    if compra.status in ("Pedido feito", "Entregue"):
        raise ValidacaoErro("Não é possível alterar o preço depois do pedido feito")
    compra.valor_unitario = ler_numero(valor_unitario, "Valor unitário")
    if fornecedor is not None:
        compra.fornecedor = _texto(fornecedor, "fornecedor", obrigatorio=False)
    return compra


def remover_compra(obra: Obra, compra_id: str) -> None:
    compra = obra.compra(compra_id)
    if compra.status in ("Pedido feito", "Entregue"):
        raise ValidacaoErro("Compras com pedido feito ou entregues não podem ser excluídas; cancele-as")
    obra.compras.remove(compra)


# ============================================================== tarefas
def adicionar_tarefa(
    obra: Obra,
    titulo: str,
    etapa: str = "",
    responsavel: str = "",
    prazo: str = "",
    prioridade: str = "Média",
    itens: list[str] | None = None,
) -> Tarefa:
    if etapa:
        obra.etapa(etapa)
    p = ler_data(prazo)
    tarefa = Tarefa(
        titulo=_texto(titulo, "o título da tarefa"),
        etapa=etapa,
        responsavel=_texto(responsavel, "responsável", obrigatorio=False, maximo=80),
        prazo=p.isoformat() if p else "",
        prioridade=_opcao(prioridade, PRIORIDADES, "Prioridade"),
        checklist=[ItemChecklist(texto=_texto(t, "o item")) for t in (itens or []) if str(t).strip()],
    )
    obra.tarefas.append(tarefa)
    return tarefa


def mudar_status_tarefa(obra: Obra, tarefa_id: str, novo: str, hoje: date | None = None) -> Tarefa:
    tarefa = obra.tarefa(tarefa_id)
    _opcao(novo, STATUS_TAREFA, "Status")
    if novo == "Concluída" and any(not i.feito for i in tarefa.checklist):
        raise ValidacaoErro("Conclua todos os itens do checklist antes de concluir a tarefa")
    tarefa.status = novo
    tarefa.concluida_em = _hoje(hoje).isoformat() if novo == "Concluída" else ""
    return tarefa


def alternar_item_tarefa(obra: Obra, tarefa_id: str, item_id: str, hoje: date | None = None) -> ItemChecklist:
    tarefa = obra.tarefa(tarefa_id)
    for item in tarefa.checklist:
        if item.id == item_id:
            _alternar(item, hoje)
            # desmarcar um item reabre a tarefa concluída
            if not item.feito and tarefa.status == "Concluída":
                tarefa.status = "Em andamento"
                tarefa.concluida_em = ""
            # marcar o primeiro item coloca a tarefa em andamento
            elif item.feito and tarefa.status == "A fazer":
                tarefa.status = "Em andamento"
            return item
    raise ValidacaoErro("Item de checklist não encontrado")


def remover_tarefa(obra: Obra, tarefa_id: str) -> None:
    obra.tarefas.remove(obra.tarefa(tarefa_id))
