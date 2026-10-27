"""Modelos de dados do sistema (dataclasses serializáveis em JSON)."""

from __future__ import annotations

import re
import uuid
from dataclasses import asdict, dataclass, field, fields
from datetime import date

# ---------------------------------------------------------------- enumerações
STATUS_COMPRA = ("Solicitada", "Em cotação", "Aprovada", "Pedido feito", "Entregue", "Cancelada")
# transições permitidas no fluxo de compras
TRANSICOES_COMPRA = {
    "Solicitada": ("Em cotação", "Aprovada", "Cancelada"),
    "Em cotação": ("Aprovada", "Cancelada"),
    "Aprovada": ("Pedido feito", "Cancelada"),
    "Pedido feito": ("Entregue", "Cancelada"),
    "Entregue": (),
    "Cancelada": ("Solicitada",),
}
CATEGORIAS_COMPRA = ("Material", "Mão de obra", "Serviço terceirizado", "Equipamento/locação", "Taxas e documentos")
UNIDADES = ("un", "m", "m²", "m³", "kg", "t", "sc", "l", "vb", "h", "dia", "mês")

STATUS_TAREFA = ("A fazer", "Em andamento", "Bloqueada", "Concluída")
PRIORIDADES = ("Baixa", "Média", "Alta", "Urgente")


class ValidacaoErro(ValueError):
    """Erro de regra de negócio, com mensagem pronta para o usuário."""


def novo_id(prefixo: str) -> str:
    return f"{prefixo}-{uuid.uuid4().hex[:8]}"


def ler_data(valor) -> date | None:
    """Converte 'AAAA-MM-DD' (ou date) em date; vazio -> None."""
    if valor in (None, ""):
        return None
    if isinstance(valor, date):
        return valor
    try:
        return date.fromisoformat(str(valor)[:10])
    except ValueError as exc:
        raise ValidacaoErro(f"Data inválida: {valor!r} (use AAAA-MM-DD)") from exc


def ler_numero(valor, nome: str, minimo: float = 0.0) -> float:
    if valor in (None, ""):
        return 0.0
    texto = str(valor).strip().replace("R$", "").replace(" ", "").replace("\u00a0", "")
    if "," in texto:  # formato brasileiro: 1.234,56
        texto = texto.replace(".", "").replace(",", ".")
    elif re.fullmatch(r"-?\d{1,3}(\.\d{3})+", texto):  # 300.000 = trezentos mil
        texto = texto.replace(".", "")
    try:
        n = float(texto)
    except ValueError as exc:
        raise ValidacaoErro(f"{nome}: número inválido ({valor!r})") from exc
    if n != n or n in (float("inf"), float("-inf")):
        raise ValidacaoErro(f"{nome}: número inválido")
    if n < minimo:
        raise ValidacaoErro(f"{nome} não pode ser menor que {minimo:g}")
    return n


def _filtrar(cls, dados: dict) -> dict:
    nomes = {f.name for f in fields(cls)}
    return {k: v for k, v in dados.items() if k in nomes}


# ---------------------------------------------------------------- entidades
@dataclass
class ItemChecklist:
    texto: str
    feito: bool = False
    concluido_em: str = ""  # AAAA-MM-DD
    id: str = field(default_factory=lambda: novo_id("chk"))

    @classmethod
    def de_dict(cls, d: dict) -> "ItemChecklist":
        return cls(**_filtrar(cls, d))


@dataclass
class Etapa:
    codigo: str
    nome: str
    categoria: str
    peso: float
    predecessoras: list[str] = field(default_factory=list)
    normas: list[str] = field(default_factory=list)
    checklist: list[ItemChecklist] = field(default_factory=list)
    inicio_previsto: str = ""
    fim_previsto: str = ""
    orcamento: float = 0.0
    # detalhamento técnico (vem do catálogo de etapas)
    descricao: str = ""
    servicos: list[dict] = field(default_factory=list)  # {servico, un, qtd} para a área de referência
    equipe: str = ""
    atencao: list[str] = field(default_factory=list)
    duracao_dias: int = 0
    # anotação livre do usuário
    observacao: str = ""

    @classmethod
    def de_dict(cls, d: dict) -> "Etapa":
        d = _filtrar(cls, d)
        d["checklist"] = [ItemChecklist.de_dict(i) for i in d.get("checklist", [])]
        return cls(**d)


@dataclass
class Compra:
    descricao: str
    etapa: str
    categoria: str = "Material"
    quantidade: float = 1.0
    unidade: str = "un"
    valor_unitario: float = 0.0
    fornecedor: str = ""
    status: str = "Solicitada"
    prioridade: str = "Média"
    data_necessidade: str = ""
    data_entrega: str = ""
    historico: list[dict] = field(default_factory=list)
    id: str = field(default_factory=lambda: novo_id("cmp"))

    @property
    def valor_total(self) -> float:
        return round(self.quantidade * self.valor_unitario, 2)

    @classmethod
    def de_dict(cls, d: dict) -> "Compra":
        return cls(**_filtrar(cls, d))


@dataclass
class Tarefa:
    titulo: str
    etapa: str = ""
    responsavel: str = ""
    prazo: str = ""
    prioridade: str = "Média"
    status: str = "A fazer"
    checklist: list[ItemChecklist] = field(default_factory=list)
    concluida_em: str = ""
    id: str = field(default_factory=lambda: novo_id("tar"))

    @classmethod
    def de_dict(cls, d: dict) -> "Tarefa":
        d = _filtrar(cls, d)
        d["checklist"] = [ItemChecklist.de_dict(i) for i in d.get("checklist", [])]
        return cls(**d)


@dataclass
class Obra:
    nome: str
    cliente: str = ""
    endereco: str = ""
    responsavel_tecnico: str = ""
    inicio: str = ""
    fim_previsto: str = ""
    orcamento_total: float = 0.0
    etapas: list[Etapa] = field(default_factory=list)
    compras: list[Compra] = field(default_factory=list)
    tarefas: list[Tarefa] = field(default_factory=list)
    exemplo: bool = False
    area_construida: float = 100.0  # m²; escala os quantitativos de referência
    padrao: str = "R1-N"  # padrão construtivo (ver padroes.py)
    valor_m2: float = 2690.33  # R$/m² do padrão (CUB ou valor próprio)
    modelo_etapas: int = 1  # versão do catálogo de etapas aplicada (1 = obras antigas)
    revisoes: list[dict] = field(default_factory=list)  # revisões feitas com a Claude (mais recente primeiro)
    id: str = field(default_factory=lambda: novo_id("obra"))

    # ---------------------------------------------------------- serialização
    def para_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def de_dict(cls, d: dict) -> "Obra":
        d = _filtrar(cls, dict(d))
        d["etapas"] = [Etapa.de_dict(e) for e in d.get("etapas", [])]
        d["compras"] = [Compra.de_dict(c) for c in d.get("compras", [])]
        d["tarefas"] = [Tarefa.de_dict(t) for t in d.get("tarefas", [])]
        return cls(**d)

    # ---------------------------------------------------------- buscas
    def etapa(self, codigo: str) -> Etapa:
        for e in self.etapas:
            if e.codigo == codigo:
                return e
        raise ValidacaoErro(f"Etapa não encontrada: {codigo}")

    def compra(self, compra_id: str) -> Compra:
        for c in self.compras:
            if c.id == compra_id:
                return c
        raise ValidacaoErro("Compra não encontrada")

    def tarefa(self, tarefa_id: str) -> Tarefa:
        for t in self.tarefas:
            if t.id == tarefa_id:
                return t
        raise ValidacaoErro("Tarefa não encontrada")
