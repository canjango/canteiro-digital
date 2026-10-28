"""Padrão construtivo e valor de referência por m².

Base: CUB/m² (Custo Unitário Básico, NBR 12721) para residência unifamiliar
— projetos-padrão R1-B (baixo), R1-N (normal) e R1-A (alto).

O padrão "Médio/alto" (R1-MA) não existe na NBR 12721: o valor dele é a
média entre R1-N e R1-A, recalculada se esses valores forem atualizados.

O CUB muda por estado e todo mês. CUB_ESTADOS traz R1-B, R1-N e R1-A de cada
sindicato estadual (sem desoneração da folha), no mês mais recente publicado
até out/2026. AC, AM, SC e TO não divulgam (ou não foram encontrados) os
padrões R1 por projeto-padrão: nesses estados use "Personalizado". O valor por
m² de cada obra continua editável.

O CUB NÃO inclui: terreno, projetos e aprovações, fundações especiais,
elevadores, instalações especiais, paisagismo, impostos e BDI da construtora
(administração, imprevistos e lucro). Na prática esses itens costumam somar
15% a 30% ao valor do CUB.
"""

from __future__ import annotations

# CUB/m² sem desoneração por estado: (nome, sindicato, mês de referência, R1-B, R1-N, R1-A)
CUB_ESTADOS: dict[str, tuple] = {
    "AL": ("Alagoas", "Sinduscon-AL", "jun/2026", 2029.44, 2323.23, 3145.00),
    "AP": ("Amapá", "Sinduscon-AP", "set/2026", 2821.65, 3186.62, 4258.28),
    "BA": ("Bahia", "Sinduscon-BA", "set/2026", 2338.12, 2734.31, 3352.72),
    "CE": ("Ceará", "Sinduscon-CE", "set/2026", 2425.20, 2971.06, 3546.10),
    "DF": ("Distrito Federal", "Sinduscon-DF", "ago/2026", 2490.71, 2940.10, 3608.89),
    "ES": ("Espírito Santo", "Sinduscon-ES", "set/2026", 2891.16, 3479.99, 4261.81),
    "GO": ("Goiás", "Sinduscon-GO", "set/2026", 2302.55, 2795.37, 3430.67),
    "MA": ("Maranhão", "Sinduscon-MA", "set/2026", 1998.66, 2289.83, 2838.57),
    "MG": ("Minas Gerais", "Sinduscon-MG", "set/2026", 2552.62, 3118.02, 3884.77),
    "MS": ("Mato Grosso do Sul", "Sinduscon-MS", "set/2026", 1859.76, 2180.16, 2694.82),
    "MT": ("Mato Grosso", "Sinduscon-MT", "set/2026", 3337.14, 4009.00, 4899.76),
    "PA": ("Pará", "Sinduscon-PA", "set/2026", 2459.47, 2855.61, 3577.00),
    "PB": ("Paraíba", "Sinduscon-JP", "ago/2026", 1642.62, 2037.27, 2510.14),
    "PE": ("Pernambuco", "Sinduscon-PE", "set/2026", 2361.01, 2795.91, 3422.72),
    "PI": ("Piauí", "Sinduscon-PI", "ago/2026", 2873.09, 3644.79, 4879.17),
    "PR": ("Paraná", "Sinduscon-PR", "set/2026", 2681.59, 3365.21, 4109.51),
    "RJ": ("Rio de Janeiro", "Sinduscon-Rio", "set/2026", 2476.02, 2990.86, 3691.68),
    "RN": ("Rio Grande do Norte", "Sinduscon-RN", "ago/2026", 2296.38, 2583.52, 3201.37),
    "RO": ("Rondônia", "Sinduscon-RO", "set/2026", 2505.72, 2728.06, 3637.16),
    "RR": ("Roraima", "Sinduscon-RR", "ago/2026", 2918.56, 3280.51, 4646.70),
    "RS": ("Rio Grande do Sul", "Sinduscon-RS", "set/2026", 2567.33, 3452.09, 4664.55),
    "SE": ("Sergipe", "Sinduscon-SE", "ago/2026", 1896.68, 2381.49, 3064.02),
    "SP": ("São Paulo", "Sinduscon-SP", "set/2026", 2193.39, 2690.33, 3255.86),
}
UF_SEM_PADRAO = ("AC", "AM", "SC", "TO")  # sem R1-B/N/A publicados: usar "Personalizado"
UF_PADRAO = "SP"  # obras antigas foram calculadas com o CUB-SP
UF_SUGERIDA = "PB"  # estado sugerido para obras novas
UFS = tuple(sorted(CUB_ESTADOS))


def referencia(uf: str = UF_PADRAO) -> str:
    nome, sind, mes, *_ = CUB_ESTADOS.get(uf, CUB_ESTADOS[UF_PADRAO])
    return f"CUB/m² {sind} ({nome}) · {mes} · sem desoneração"


def rotulo_uf(uf: str) -> str:
    nome, _s, mes, *_ = CUB_ESTADOS[uf]
    return f"{uf} — {nome} ({mes})"


REFERENCIA = referencia(UF_PADRAO)

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


def valor_referencia(codigo: str, uf: str = UF_PADRAO) -> float:
    """CUB do padrão no estado (R1-MA = média de R1-N e R1-A)."""
    t = CUB_ESTADOS.get(uf or UF_PADRAO)
    if not t or codigo not in ("R1-B", "R1-N", "R1-MA", "R1-A"):
        return PADROES.get(codigo, {}).get("valor_m2", 0.0)
    b, n, a = t[3], t[4], t[5]
    return {"R1-B": b, "R1-N": n, "R1-A": a, "R1-MA": round((n + a) / 2, 2)}[codigo]
