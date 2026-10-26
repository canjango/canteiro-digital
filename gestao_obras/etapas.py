"""Catálogo de etapas construtivas de uma obra residencial/comercial de pequeno e
médio porte (sistema convencional: estrutura de concreto armado + alvenaria).

Cada etapa traz:
- codigo: identificador estável (usado nas compras e tarefas)
- nome / categoria (fase macro da obra)
- peso: participação típica no custo total da obra (%), soma = 100
- predecessoras: etapas que devem estar concluídas antes de iniciar
- normas: principais normas ABNT de referência
- checklist: itens de verificação/controle de qualidade da etapa

Os pesos são referências médias de mercado para orçamento paramétrico e devem
ser ajustados ao orçamento real de cada obra.
"""

from __future__ import annotations

# Fases macro (categorias) na ordem em que acontecem
CATEGORIAS = (
    "Preparação",
    "Infraestrutura",
    "Supraestrutura",
    "Vedação e cobertura",
    "Instalações",
    "Acabamentos",
    "Entrega",
)

ETAPAS_PADRAO: list[dict] = [
    {
        "codigo": "PRE",
        "nome": "Serviços preliminares",
        "categoria": "Preparação",
        "peso": 3.0,
        "predecessoras": [],
        "normas": ["NR-18", "NBR 6484 (sondagem SPT)"],
        "checklist": [
            "Alvará de construção emitido",
            "ART/RRT de projeto e execução registrada",
            "Sondagem SPT realizada e laudo arquivado",
            "Limpeza e regularização do terreno",
            "Ligação provisória de água e energia",
            "Tapume, barracão e placa de obra instalados",
            "Locação da obra (gabarito) conferida com o projeto",
        ],
    },
    {
        "codigo": "TER",
        "nome": "Movimento de terra",
        "categoria": "Preparação",
        "peso": 1.0,
        "predecessoras": ["PRE"],
        "normas": ["NBR 9061 (segurança de escavação)"],
        "checklist": [
            "Cortes e aterros conforme níveis do projeto",
            "Aterro compactado em camadas de até 20 cm",
            "Escoramento de taludes quando necessário",
            "Bota-fora com destinação licenciada (CTR)",
        ],
    },
    {
        "codigo": "FUN",
        "nome": "Fundações",
        "categoria": "Infraestrutura",
        "peso": 8.0,
        "predecessoras": ["TER"],
        "normas": ["NBR 6122 (fundações)", "NBR 6118 (concreto)"],
        "checklist": [
            "Escavação/perfuração conforme projeto de fundações",
            "Cota de assentamento verificada",
            "Armaduras de blocos e sapatas conferidas",
            "Concreto com fck e slump conferidos na nota fiscal",
            "Corpos de prova moldados",
            "Vigas baldrame executadas e niveladas",
            "Impermeabilização do baldrame",
        ],
    },
    {
        "codigo": "EST",
        "nome": "Estrutura",
        "categoria": "Supraestrutura",
        "peso": 18.0,
        "predecessoras": ["FUN"],
        "normas": ["NBR 6118 (concreto)", "NBR 14931 (execução de concreto)", "NBR 15696 (fôrmas e escoramentos)"],
        "checklist": [
            "Fôrmas no prumo, nível e esquadro",
            "Escoramento conferido antes da concretagem",
            "Armaduras e cobrimentos conferidos (espaçadores)",
            "Passagens de instalações deixadas nas lajes e vigas",
            "Concretagem com adensamento por vibrador",
            "Cura úmida mínima de 7 dias",
            "Desforma dentro dos prazos de projeto",
        ],
    },
    {
        "codigo": "ALV",
        "nome": "Alvenaria e vedações",
        "categoria": "Vedação e cobertura",
        "peso": 8.0,
        "predecessoras": ["EST"],
        "normas": ["NBR 15270 (blocos cerâmicos)", "NBR 8545 (execução de alvenaria)"],
        "checklist": [
            "Marcação da primeira fiada conferida",
            "Prumo, nível e alinhamento das fiadas",
            "Amarração alvenaria x pilar (tela ou ferro-cabelo)",
            "Vergas e contravergas em todos os vãos",
            "Encunhamento executado após a alvenaria superior",
        ],
    },
    {
        "codigo": "COB",
        "nome": "Cobertura",
        "categoria": "Vedação e cobertura",
        "peso": 7.0,
        "predecessoras": ["ALV"],
        "normas": ["NBR 7190 (madeira)", "NBR 15575-5 (coberturas)"],
        "checklist": [
            "Estrutura do telhado (tesouras/terças) conferida",
            "Inclinação mínima do telhado conforme fabricante",
            "Telhamento com fixação e sobreposição corretas",
            "Calhas, rufos e condutores instalados",
            "Teste de estanqueidade da cobertura",
        ],
    },
    {
        "codigo": "HID",
        "nome": "Instalações hidrossanitárias",
        "categoria": "Instalações",
        "peso": 6.0,
        "predecessoras": ["ALV"],
        "normas": ["NBR 5626 (água fria e quente)", "NBR 8160 (esgoto)", "NBR 10844 (águas pluviais)"],
        "checklist": [
            "Tubulações de água fria e quente embutidas",
            "Esgoto com caimento mínimo (1% a 2%)",
            "Teste de pressão na rede de água",
            "Teste de estanqueidade no esgoto",
            "Caixa d'água, registros e caixas de inspeção instalados",
        ],
    },
    {
        "codigo": "ELE",
        "nome": "Instalações elétricas e dados",
        "categoria": "Instalações",
        "peso": 6.0,
        "predecessoras": ["ALV"],
        "normas": ["NBR 5410 (instalações elétricas)", "NBR 5419 (SPDA)"],
        "checklist": [
            "Eletrodutos e caixas embutidos conforme projeto",
            "Quadro de distribuição com DR e DPS",
            "Fiação com bitolas e cores padronizadas",
            "Aterramento executado e medido",
            "Pontos de dados/telefonia/TV passados",
        ],
    },
    {
        "codigo": "IMP",
        "nome": "Impermeabilização",
        "categoria": "Instalações",
        "peso": 2.0,
        "predecessoras": ["HID"],
        "normas": ["NBR 9575 (projeto)", "NBR 9574 (execução)"],
        "checklist": [
            "Regularização com caimento para os ralos",
            "Cantos arredondados (meia-cana)",
            "Manta/membrana aplicada em boxes, varandas e lajes",
            "Teste de lâmina d'água por 72 horas",
            "Proteção mecânica sobre a impermeabilização",
        ],
    },
    {
        "codigo": "REV",
        "nome": "Revestimentos de parede",
        "categoria": "Acabamentos",
        "peso": 9.0,
        "predecessoras": ["HID", "ELE"],
        "normas": ["NBR 13749 (revestimento de argamassa)", "NBR 13755 (cerâmica em fachada)"],
        "checklist": [
            "Chapisco aplicado em toda a base",
            "Taliscas e mestras para prumo",
            "Emboço/reboco desempenado e sem fissuras",
            "Cerâmica de parede com juntas e prumo conferidos",
            "Rejuntamento e limpeza",
        ],
    },
    {
        "codigo": "FOR",
        "nome": "Forros",
        "categoria": "Acabamentos",
        "peso": 3.0,
        "predecessoras": ["COB", "ELE"],
        "normas": ["NBR 15758 (drywall)"],
        "checklist": [
            "Estrutura do forro nivelada",
            "Pontos de iluminação posicionados",
            "Alçapões de inspeção previstos",
            "Juntas tratadas antes da pintura",
        ],
    },
    {
        "codigo": "PIS",
        "nome": "Contrapiso e pisos",
        "categoria": "Acabamentos",
        "peso": 8.0,
        "predecessoras": ["IMP", "REV"],
        "normas": ["NBR 13753 (piso cerâmico)", "NBR 15575-3 (pisos)"],
        "checklist": [
            "Contrapiso nivelado com caimentos nas áreas molhadas",
            "Argamassa colante adequada ao formato da peça",
            "Dupla colagem em peças acima de 900 cm²",
            "Juntas de assentamento e movimentação respeitadas",
            "Rodapés e soleiras instalados",
            "Teste de percussão (peças ocas)",
        ],
    },
    {
        "codigo": "ESQ",
        "nome": "Esquadrias e vidros",
        "categoria": "Acabamentos",
        "peso": 7.0,
        "predecessoras": ["REV"],
        "normas": ["NBR 10821 (esquadrias)", "NBR 7199 (vidros)"],
        "checklist": [
            "Vãos conferidos antes da medição final",
            "Contramarcos/batentes no prumo e nível",
            "Vedação com selante nas janelas",
            "Portas com folgas e ferragens reguladas",
            "Vidros instalados e etiquetados",
        ],
    },
    {
        "codigo": "LOU",
        "nome": "Louças, metais e acabamento elétrico",
        "categoria": "Acabamentos",
        "peso": 4.0,
        "predecessoras": ["PIS"],
        "normas": ["NBR 15097 (louças)", "NBR 5410"],
        "checklist": [
            "Bacias, cubas e tanques instalados sem vazamento",
            "Torneiras, registros e chuveiros testados",
            "Tomadas e interruptores instalados",
            "Luminárias instaladas e testadas",
            "Quadro identificado (circuitos etiquetados)",
        ],
    },
    {
        "codigo": "PIN",
        "nome": "Pintura",
        "categoria": "Acabamentos",
        "peso": 6.0,
        "predecessoras": ["REV", "FOR"],
        "normas": ["NBR 13245 (execução de pintura)"],
        "checklist": [
            "Reboco curado (mínimo 28 dias) antes da pintura",
            "Selador/fundo aplicado",
            "Massa corrida/acrílica e lixamento",
            "Demãos de tinta conforme especificação",
            "Retoques após instalação de louças e esquadrias",
        ],
    },
    {
        "codigo": "EXT",
        "nome": "Serviços complementares e área externa",
        "categoria": "Entrega",
        "peso": 3.0,
        "predecessoras": ["COB"],
        "normas": ["NBR 9050 (acessibilidade)"],
        "checklist": [
            "Muros, portões e gradis",
            "Calçada e acessos",
            "Paisagismo e drenagem externa",
            "Ligações definitivas de água, esgoto e energia",
        ],
    },
    {
        "codigo": "ENT",
        "nome": "Limpeza final e entrega",
        "categoria": "Entrega",
        "peso": 1.0,
        "predecessoras": ["PIN", "LOU", "ESQ", "EXT"],
        "normas": ["NBR 14037 (manual de uso)", "NBR 15575 (desempenho)"],
        "checklist": [
            "Limpeza fina de toda a obra",
            "Vistoria com o cliente e lista de pendências",
            "Projetos as built entregues",
            "Manual do proprietário entregue",
            "Habite-se / certificado de conclusão",
            "Termo de entrega de chaves assinado",
        ],
    },
]

CODIGOS = [e["codigo"] for e in ETAPAS_PADRAO]


def etapa_padrao(codigo: str) -> dict:
    for e in ETAPAS_PADRAO:
        if e["codigo"] == codigo:
            return e
    raise KeyError(f"Etapa desconhecida: {codigo}")


def validar_catalogo() -> list[str]:
    """Verifica a consistência do catálogo; retorna a lista de problemas."""
    problemas: list[str] = []
    vistos: set[str] = set()
    for e in ETAPAS_PADRAO:
        if e["codigo"] in vistos:
            problemas.append(f"Código duplicado: {e['codigo']}")
        if e["categoria"] not in CATEGORIAS:
            problemas.append(f"{e['codigo']}: categoria inválida")
        for p in e["predecessoras"]:
            if p not in vistos:
                problemas.append(f"{e['codigo']}: predecessora {p} não vem antes")
        vistos.add(e["codigo"])
    soma = round(sum(e["peso"] for e in ETAPAS_PADRAO), 6)
    if soma != 100:
        problemas.append(f"Soma dos pesos = {soma}, esperado 100")
    return problemas
