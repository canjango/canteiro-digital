"""Estado da aplicação e despachante de ações.

A mesma classe atende à versão web (navegador via Pyodide) e ao servidor
Flask: a interface envia `acao` + `dados` e recebe de volta quais obras
mudaram (para gravar) e uma mensagem para o usuário.
"""

from __future__ import annotations

from datetime import date, timedelta

from . import servicos as sv
from .modelos import Obra, ValidacaoErro

ABAS = ("painel", "etapas", "compras", "tarefas", "obras")
FILTROS_COMPRA = ("abertas", "atrasadas", "todas", "Entregue", "Cancelada")


class Sistema:
    def __init__(self, hoje: date | None = None):
        self.obras: dict[str, Obra] = {}
        self.hoje_fixo = hoje
        self.ui = {
            "obra": "",
            "aba": "painel",
            "abertas": [],          # etapas expandidas
            "filtro_compra": "abertas",
            "filtro_etapa": "",
            "form_compra": False,
            "form_tarefa": False,
            "confirmar_exclusao": "",
            "msg": "",
            "erro": "",
        }

    # ------------------------------------------------------------ util
    @property
    def hoje(self) -> date:
        return self.hoje_fixo or date.today()

    @property
    def obra(self) -> Obra | None:
        return self.obras.get(self.ui["obra"])

    def _obra_ativa(self) -> Obra:
        if not self.obra:
            raise ValidacaoErro("Selecione ou crie uma obra primeiro")
        return self.obra

    def _garantir_selecao(self) -> None:
        if self.ui["obra"] not in self.obras:
            # obras reais antes das de exemplo, depois ordem alfabética
            ordenadas = sorted(self.obras.values(), key=lambda o: (o.exemplo, o.nome.lower()))
            self.ui["obra"] = ordenadas[0].id if ordenadas else ""

    # ------------------------------------------------------------ persistência
    def carregar(self, documentos: list[dict]) -> list[str]:
        """Substitui as obras pelo conteúdo do banco. Documentos inválidos
        são ignorados e reportados (sem derrubar o sistema)."""
        novas: dict[str, Obra] = {}
        falhas: list[str] = []
        for doc in documentos or []:
            try:
                o = Obra.de_dict(doc)
                sv.completar_detalhes(o)  # obras antigas ganham o detalhamento técnico
                novas[o.id] = o
            except (TypeError, ValueError, KeyError) as exc:
                falhas.append(f"{doc.get('id', '?') if isinstance(doc, dict) else '?'}: {exc}")
        self.obras = novas
        self._garantir_selecao()
        return falhas

    def exportar(self, obra_id: str) -> dict:
        return self.obras[obra_id].para_dict()

    # ------------------------------------------------------------ despachante
    def despachar(self, acao: str, dados: dict | None = None) -> dict:
        """Executa uma ação. Retorna {'alteradas': [...], 'removidas': [...],
        'ok': bool}. Mensagens ficam em self.ui['msg'] / ['erro']."""
        dados = dict(dados or {})
        self.ui["msg"] = ""
        self.ui["erro"] = ""
        metodo = getattr(self, "_a_" + acao.replace(".", "_"), None)
        if metodo is None:
            self.ui["erro"] = f"Ação desconhecida: {acao}"
            return {"ok": False, "alteradas": [], "removidas": []}
        try:
            r = metodo(dados) or {}
        except ValidacaoErro as exc:
            self.ui["erro"] = str(exc)
            return {"ok": False, "alteradas": [], "removidas": []}
        return {"ok": True, "alteradas": r.get("alteradas", []), "removidas": r.get("removidas", [])}

    def _mudou(self, msg: str = "") -> dict:
        if msg:
            self.ui["msg"] = msg
        return {"alteradas": [self.ui["obra"]]}

    # ---------------------------------------------------------- navegação
    def _a_ui_aba(self, d):
        aba = d.get("aba", "painel")
        if aba not in ABAS:
            raise ValidacaoErro("Aba inválida")
        self.ui["aba"] = aba
        self.ui["confirmar_exclusao"] = ""

    def _a_ui_expandir(self, d):
        cod = d.get("codigo", "")
        self._obra_ativa().etapa(cod)  # valida
        abertas = self.ui["abertas"]
        if cod in abertas:
            abertas.remove(cod)
        else:
            abertas.append(cod)

    def _a_ui_filtro(self, d):
        if "filtro_compra" in d:
            if d["filtro_compra"] not in FILTROS_COMPRA:
                raise ValidacaoErro("Filtro inválido")
            self.ui["filtro_compra"] = d["filtro_compra"]
        if "filtro_etapa" in d:
            if d["filtro_etapa"]:
                self._obra_ativa().etapa(d["filtro_etapa"])
            self.ui["filtro_etapa"] = d["filtro_etapa"]

    def _a_ui_form(self, d):
        chave = "form_" + d.get("qual", "")
        if chave in ("form_compra", "form_tarefa"):
            self.ui[chave] = not self.ui[chave]

    # ---------------------------------------------------------- obras
    def _a_obra_selecionar(self, d):
        if d.get("id") not in self.obras:
            raise ValidacaoErro("Obra não encontrada")
        self.ui["obra"] = d["id"]
        self.ui["abertas"] = []
        self.ui["filtro_etapa"] = ""
        self.ui["confirmar_exclusao"] = ""
        if self.ui["aba"] == "obras":
            self.ui["aba"] = "painel"

    def _a_obra_criar(self, d):
        o = sv.criar_obra(
            d.get("nome", ""), d.get("cliente", ""), d.get("endereco", ""),
            d.get("responsavel_tecnico", ""), d.get("inicio", ""), d.get("fim_previsto", ""),
            d.get("orcamento_total", ""), area_construida=d.get("area_construida", 100),
            padrao=d.get("padrao", "R1-N"), valor_m2=d.get("valor_m2", ""),
        )
        self.obras[o.id] = o
        self.ui.update(obra=o.id, aba="etapas", abertas=[o.etapas[0].codigo], filtro_etapa="")
        return self._mudou(f"Obra “{o.nome}” criada com {len(o.etapas)} etapas")

    def _a_obra_exemplo(self, d):
        o = obra_exemplo(self.hoje)
        self.obras[o.id] = o
        self.ui.update(obra=o.id, aba="painel", abertas=[])
        return self._mudou("Obra de exemplo criada")

    def _a_obra_editar(self, d):
        o = self._obra_ativa()
        ini, fim = sv.ler_data(d.get("inicio")), sv.ler_data(d.get("fim_previsto"))
        if ini and fim and fim <= ini:
            raise ValidacaoErro("A data de término deve ser posterior ao início")
        nome = " ".join(str(d.get("nome", "")).split())
        if not nome:
            raise ValidacaoErro("Informe o nome da obra")
        novo_orc = sv.ler_numero(d.get("orcamento_total", o.orcamento_total), "Orçamento")
        area = sv._area(d.get("area_construida", o.area_construida))
        padrao, vm2 = sv.resolver_padrao(d.get("padrao", o.padrao), d.get("valor_m2", ""), (o.padrao, o.valor_m2))
        if novo_orc != o.orcamento_total:
            sv.redistribuir_orcamento(o, novo_orc)
        o.area_construida, o.padrao, o.valor_m2 = area, padrao, vm2
        o.nome = nome
        o.cliente = " ".join(str(d.get("cliente", "")).split())
        o.endereco = " ".join(str(d.get("endereco", "")).split())
        o.responsavel_tecnico = " ".join(str(d.get("responsavel_tecnico", "")).split())
        o.inicio = ini.isoformat() if ini else ""
        o.fim_previsto = fim.isoformat() if fim else ""
        return self._mudou("Dados da obra salvos")

    def _a_obra_orcamento_padrao(self, d):
        o = self._obra_ativa()
        estimado = sv.custo_estimado(o)
        if estimado <= 0:
            raise ValidacaoErro("Defina área e valor por m² antes de calcular")
        sv.redistribuir_orcamento(o, estimado)
        from .analise import moeda
        return self._mudou(f"Orçamento atualizado para {moeda(estimado)} (área × valor do m²)")

    def _a_obra_atualizar_modelo(self, d):
        o = self._obra_ativa()
        r = sv.aplicar_modelo(o)
        if o.inicio and o.fim_previsto:
            sv.planejar_cronograma(o)
        return self._mudou(f"Etapas atualizadas para o modelo de residência de 100 m² · {r['itens_novos']} itens novos de checklist")

    def _a_obra_replanejar(self, d):
        o = self._obra_ativa()
        sv.planejar_cronograma(o)
        return self._mudou("Cronograma das etapas recalculado")

    def _a_obra_excluir(self, d):
        oid = d.get("id", "")
        if oid not in self.obras:
            raise ValidacaoErro("Obra não encontrada")
        if self.ui["confirmar_exclusao"] != oid:
            self.ui["confirmar_exclusao"] = oid
            return {}
        nome = self.obras.pop(oid).nome
        self.ui["confirmar_exclusao"] = ""
        if self.ui["obra"] == oid:
            self.ui["obra"] = ""
        self._garantir_selecao()
        self.ui["msg"] = f"Obra “{nome}” excluída"
        return {"removidas": [oid]}

    def _a_obra_cancelar_exclusao(self, d):
        self.ui["confirmar_exclusao"] = ""

    # ---------------------------------------------------------- etapas
    def _a_etapa_item(self, d):
        sv.alternar_item_etapa(self._obra_ativa(), d.get("codigo", ""), d.get("item", ""), self.hoje)
        return self._mudou()

    def _a_etapa_todos(self, d):
        feito = str(d.get("feito", "")).lower() in ("1", "true", "sim")
        sv.marcar_etapa(self._obra_ativa(), d.get("codigo", ""), feito, self.hoje)
        return self._mudou("Etapa marcada como concluída" if feito else "Checklist da etapa reaberto")

    def _a_etapa_novo_item(self, d):
        sv.adicionar_item_etapa(self._obra_ativa(), d.get("codigo", ""), d.get("texto", ""))
        return self._mudou("Item adicionado")

    def _a_etapa_remover_item(self, d):
        sv.remover_item_etapa(self._obra_ativa(), d.get("codigo", ""), d.get("item", ""))
        return self._mudou("Item removido")

    def _a_etapa_observacao(self, d):
        e = sv.salvar_observacao(self._obra_ativa(), d.get("codigo", ""), d.get("observacao", ""))
        return self._mudou(f"Observação de “{e.nome}” salva" if e.observacao else f"Observação de “{e.nome}” apagada")

    def _a_etapa_salvar(self, d):
        sv.atualizar_etapa(self._obra_ativa(), d.get("codigo", ""), orcamento=d.get("orcamento"),
                           inicio_previsto=d.get("inicio_previsto"), fim_previsto=d.get("fim_previsto"))
        return self._mudou("Etapa atualizada")

    # ---------------------------------------------------------- compras
    def _a_compra_criar(self, d):
        c = sv.adicionar_compra(
            self._obra_ativa(), d.get("descricao", ""), d.get("etapa", ""), d.get("categoria", "Material"),
            d.get("quantidade", 1), d.get("unidade", "un"), d.get("valor_unitario", 0), d.get("fornecedor", ""),
            d.get("prioridade", "Média"), d.get("data_necessidade", ""), self.hoje,
        )
        self.ui["form_compra"] = False
        return self._mudou(f"Compra “{c.descricao}” solicitada")

    def _a_compra_status(self, d):
        c = sv.mudar_status_compra(self._obra_ativa(), d.get("id", ""), d.get("status", ""), self.hoje)
        return self._mudou(f"{c.descricao}: {c.status}")

    def _a_compra_preco(self, d):
        c = sv.atualizar_preco_compra(self._obra_ativa(), d.get("id", ""), d.get("valor_unitario", 0), d.get("fornecedor"))
        return self._mudou(f"Cotação de “{c.descricao}” registrada")

    def _a_compra_remover(self, d):
        sv.remover_compra(self._obra_ativa(), d.get("id", ""))
        return self._mudou("Compra excluída")

    # ---------------------------------------------------------- tarefas
    def _a_tarefa_criar(self, d):
        itens = str(d.get("itens", "")).splitlines()
        t = sv.adicionar_tarefa(self._obra_ativa(), d.get("titulo", ""), d.get("etapa", ""), d.get("responsavel", ""),
                                d.get("prazo", ""), d.get("prioridade", "Média"), itens)
        self.ui["form_tarefa"] = False
        return self._mudou(f"Tarefa “{t.titulo}” criada")

    def _a_tarefa_status(self, d):
        t = sv.mudar_status_tarefa(self._obra_ativa(), d.get("id", ""), d.get("status", ""), self.hoje)
        return self._mudou(f"{t.titulo}: {t.status}")

    def _a_tarefa_item(self, d):
        sv.alternar_item_tarefa(self._obra_ativa(), d.get("id", ""), d.get("item", ""), self.hoje)
        return self._mudou()

    def _a_tarefa_remover(self, d):
        sv.remover_tarefa(self._obra_ativa(), d.get("id", ""))
        return self._mudou("Tarefa excluída")


# ================================================================ exemplo
def obra_exemplo(hoje: date) -> Obra:
    """Obra fictícia, com datas relativas a hoje, para demonstrar o sistema."""
    ini = hoje - timedelta(days=95)
    fim = hoje + timedelta(days=150)
    o = sv.criar_obra(
        "Residência unifamiliar (exemplo)", "Cliente exemplo", "Rua Exemplo, 100",
        "Responsável técnico", ini.isoformat(), fim.isoformat(), 285000, exemplo=True,
        area_construida=100, padrao="R1-N",
    )
    feito = {"PRE": 12, "TER": 8, "FUN": 11, "EST": 8, "ALV": 8}
    for cod, n in feito.items():
        etapa = o.etapa(cod)
        for item in etapa.checklist[:n]:
            sv._alternar(item, hoje - timedelta(days=10))

    sv.salvar_observacao(o, "EST", "Laje do quarto 2 com escoramento reforçado (vão maior). "
                                    "Concretagem condicionada à conferência das armaduras.")

    def compra(desc, et, cat, q, un, vu, forn, status, dias, prio="Média"):
        c = sv.adicionar_compra(o, desc, et, cat, q, un, vu, forn, prio, (hoje + timedelta(days=dias)).isoformat(), hoje)
        caminho = {
            "Em cotação": ["Em cotação"],
            "Aprovada": ["Aprovada"],
            "Pedido feito": ["Aprovada", "Pedido feito"],
            "Entregue": ["Aprovada", "Pedido feito", "Entregue"],
        }.get(status, [])
        for s in caminho:
            sv.mudar_status_compra(o, c.id, s, hoje)
        return c

    compra("Concreto usinado fck 25 MPa", "FUN", "Material", 9, "m³", 520, "Concreteira", "Entregue", -95)
    compra("Aço CA-50/CA-60", "EST", "Material", 0.75, "t", 7800, "Distribuidora de aço", "Entregue", -60)
    compra("Concreto usinado fck 25 MPa (laje e cintas)", "EST", "Material", 11, "m³", 540, "Concreteira", "Pedido feito", 4, "Alta")
    compra("Locação de escoramento metálico", "EST", "Equipamento/locação", 1, "mês", 2800, "Locadora", "Entregue", -40)
    compra("Bloco cerâmico 14x19x29", "ALV", "Material", 4800, "un", 2.35, "Cerâmica", "Aprovada", 6, "Alta")
    compra("Cimento CP-II 50 kg", "ALV", "Material", 60, "sc", 38.9, "", "Em cotação", -3, "Alta")
    compra("Empreitada de alvenaria (mão de obra)", "ALV", "Mão de obra", 270, "m²", 40, "Equipe de alvenaria", "Aprovada", 10)
    compra("Tubos e conexões PVC (água e esgoto)", "HID", "Material", 1, "vb", 4200, "", "Solicitada", 25)
    compra("Telha cerâmica e madeiramento", "COB", "Material", 1, "vb", 0, "", "Solicitada", 40)

    t1 = sv.adicionar_tarefa(o, "Conferir armaduras da laje do pavimento superior", "EST", "Engenheiro de campo",
                             (hoje + timedelta(days=2)).isoformat(), "Urgente",
                             ["Bitolas e espaçamento", "Cobrimento com espaçadores", "Passagens elétricas e hidráulicas"])
    sv.alternar_item_tarefa(o, t1.id, t1.checklist[0].id, hoje)
    sv.adicionar_tarefa(o, "Agendar concretagem com a concreteira", "EST", "Mestre de obras",
                        (hoje - timedelta(days=1)).isoformat(), "Alta", ["Confirmar volume", "Reservar bomba"])
    sv.adicionar_tarefa(o, "Fechar cotação de cimento (3 fornecedores)", "ALV", "Compras",
                        (hoje + timedelta(days=1)).isoformat(), "Alta")
    t4 = sv.adicionar_tarefa(o, "Visita do cliente para aprovar layout de pontos elétricos", "ELE", "Arquiteto",
                             (hoje + timedelta(days=9)).isoformat(), "Média", ["Enviar planta de pontos", "Registrar alterações"])
    t5 = sv.adicionar_tarefa(o, "Laudo de rompimento dos corpos de prova (28 dias)", "FUN", "Laboratório",
                             (hoje - timedelta(days=20)).isoformat(), "Média")
    sv.mudar_status_tarefa(o, t5.id, "Concluída", hoje - timedelta(days=21))
    sv.mudar_status_tarefa(o, t4.id, "A fazer", hoje)
    return o
