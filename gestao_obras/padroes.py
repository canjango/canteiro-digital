"""Padrão construtivo e valor de referência por m².

Base: CUB/m² (Custo Unitário Básico, NBR 12721) para residência unifamiliar
— projetos-padrão R1-B (baixo), R1-N (normal) e R1-A (alto).

O padrão "Médio/alto" (R1-MA) não existe na NBR 12721: o valor dele é a
média entre R1-N e R1-A, recalculada se esses valores forem atualizados.

Os valores padrão são de São Paulo (Sinduscon-SP), setembro/2026, sem
desoneração da folha. O CUB muda todo mês e por estado: o valor por m² de
cada obra é editável e deve ser atualizado com o CUB do estado da obra.

O CUB NÃO inclui: terreno, projetos e aprovações, fundações especiais,
elevadores, instalações especiais, paisagismo, impostos e BDI da construtora
(administração, imprevistos e lucro). Na prática esses itens costumam somar
15% a 30% ao valor do CUB.
"""

from __future__ import annotations

REFERENCIA = "CUB/m² Sinduscon-SP · setembro/2026 · sem desoneração"

PADROES: dict[str, dict] = {
    "R1-B": {
        "nome": "Baixo",
        "valor_m2": 2193.39,
        "descricao": "Acabamentos simples: piso cerâmico comum, esquadrias de alumínio ou ferro simples, "
                     "louças e metais básicos, forro de PVC ou laje pintada.",
    },
    "R1-N": {
        "nome": "Normal",
        "valor_m2": 2690.33,
        "descricao": "Acabamentos de linha intermediária: porcelanato ou cerâmica de boa qualidade, "
                     "esquadrias de alumínio, forro de gesso, louças e metais de linha média.",
    },
    "R1-MA": {
        "nome": "Médio/alto",
        "valor_m2": 2973.10,
        "descricao": "Entre o normal e o alto: base de padrão normal com acabamentos superiores em "
                     "áreas sociais e banheiros (porcelanato maior, esquadrias melhores, gesso com detalhes).",
        "derivado": True,  # não existe no CUB: média entre R1-N e R1-A
    },
    "R1-A": {
        "nome": "Alto",
        "valor_m2": 3255.86,
        "descricao": "Acabamentos de alto padrão: porcelanato grande formato ou pedras, esquadrias "
                     "especiais, gesso com sancas, louças e metais de linha superior.",
    },
    "PERS": {
        "nome": "Personalizado",
        "valor_m2": 0.0,
        "descricao": "Valor por m² informado pelo usuário (orçamento próprio ou CUB de outro estado).",
    },
}

# média entre normal e alto (mantida sempre coerente com a tabela)
PADROES["R1-MA"]["valor_m2"] = round((PADROES["R1-N"]["valor_m2"] + PADROES["R1-A"]["valor_m2"]) / 2, 2)

PADRAO_INICIAL = "R1-N"
CODIGOS_PADRAO = tuple(PADROES)


def rotulo(codigo: str) -> str:
    p = PADROES.get(codigo)
    if not p:
        return codigo
    if codigo == "PERS":
        return p["nome"]
    if p.get("derivado"):
        return f'{p["nome"]} (entre R1-N e R1-A)'
    return f'{p["nome"]} ({codigo})'


def valor_referencia(codigo: str) -> float:
    return PADROES.get(codigo, {}).get("valor_m2", 0.0)
