"""Catálogo de etapas construtivas — residência térrea de ~100 m².

Referência: casa térrea, padrão normal, sistema convencional (fundação rasa
ou estaca broca + viga baldrame, pilares e cintas de concreto armado, laje
treliçada, alvenaria de bloco cerâmico, telhado cerâmico com madeiramento).

Cada etapa traz:
- codigo / nome / categoria (fase macro)
- peso: participação típica no custo da obra (%), soma = 100
- predecessoras: etapas que precisam estar concluídas antes de iniciar
- duracao_dias: duração típica em dias úteis para 100 m² (usada no cronograma)
- descricao: escopo da etapa
- servicos: serviços e materiais principais com quantitativo de referência
  para 100 m² (escalados pela área construída da obra)
- equipe: mão de obra típica
- atencao: pontos de atenção / erros mais comuns
- normas: principais normas de referência
- checklist: verificações de execução e qualidade (botões no sistema)

Quantitativos e pesos são estimativas de referência para planejamento e
orçamento paramétrico; o orçamento executivo da obra prevalece.

Regra de versão: ao revisar, não reescreva itens de checklist existentes
(só acrescente). Assim obras antigas mantêm os itens já marcados ao aplicar
o modelo novo.
"""

from __future__ import annotations

MODELO_VERSAO = 2
AREA_REFERENCIA = 100.0  # m²

CATEGORIAS = (
    "Preparação",
    "Infraestrutura",
    "Supraestrutura",
    "Vedação e cobertura",
    "Instalações",
    "Acabamentos",
    "Entrega",
)


def _s(servico: str, un: str, qtd: float) -> dict:
    return {"servico": servico, "un": un, "qtd": qtd}


ETAPAS_PADRAO: list[dict] = [
    {
        "codigo": "PRE",
        "nome": "Serviços preliminares",
        "categoria": "Preparação",
        "peso": 4.0,
        "predecessoras": [],
        "duracao_dias": 10,
        "descricao": "Documentação, projetos, mobilização do canteiro e marcação da casa no terreno.",
        "servicos": [
            _s("Fechamento do terreno (tapume)", "m", 40),
            _s("Barracão de obra (depósito e sanitário)", "m²", 9),
            _s("Ligação provisória de água e energia", "vb", 1),
            _s("Locação da obra (gabarito)", "m²", 100),
            _s("Placa de obra", "m²", 2),
        ],
        "equipe": "Mestre de obras + 2 serventes",
        "atencao": [
            "Não começar sem alvará e ART/RRT: obra embargada atrasa tudo.",
            "Conferir recuos, afastamentos e a cota de soleira antes de cravar o gabarito.",
            "Gabarito no esquadro (diagonais iguais) evita paredes tortas lá na frente.",
        ],
        "normas": ["NR-18", "NBR 6484 (sondagem SPT)", "NBR 13133 (topografia)"],
        "checklist": [
            "Matrícula do imóvel e documentação do terreno conferidas",
            "Levantamento planialtimétrico do terreno",
            "Projetos executivos compatibilizados (arquitetura, estrutura, hidráulica e elétrica)",
            "Alvará de construção emitido",
            "ART/RRT de projeto e execução registrada",
            "Obra cadastrada no CNO (Receita Federal)",
            "Sondagem SPT realizada e laudo arquivado",
            "Limpeza e regularização do terreno",
            "Ligação provisória de água e energia",
            "Tapume, barracão e placa de obra instalados",
            "Banheiro e água potável para a equipe (NR-18)",
            "Locação da obra (gabarito) conferida com o projeto",
        ],
    },
    {
        "codigo": "TER",
        "nome": "Movimento de terra",
        "categoria": "Preparação",
        "peso": 1.0,
        "predecessoras": ["PRE"],
        "duracao_dias": 5,
        "descricao": "Acerto de níveis do terreno, escavação das valas de fundação e aterro interno.",
        "servicos": [
            _s("Limpeza e raspagem do terreno", "m²", 250),
            _s("Escavação de valas para fundação", "m³", 18),
            _s("Aterro interno compactado", "m³", 12),
            _s("Bota-fora (caçamba de 5 m³)", "un", 4),
        ],
        "equipe": "Retroescavadeira (diárias) + 2 serventes",
        "atencao": [
            "Aterro mal compactado causa recalque e trinca no contrapiso.",
            "Proteger as valas da chuva; vala encharcada precisa ser limpa antes do concreto.",
        ],
        "normas": ["NBR 9061 (segurança de escavação)", "NBR 5681 (controle de aterro)"],
        "checklist": [
            "Nível de referência (RN) definido e marcado",
            "Cortes e aterros conforme níveis do projeto",
            "Aterro compactado em camadas de até 20 cm",
            "Escavação das valas de fundação no gabarito",
            "Fundo das valas apiloado e nivelado",
            "Escoramento de taludes quando necessário",
            "Drenagem provisória de águas de chuva",
            "Bota-fora com destinação licenciada (CTR)",
        ],
    },
    {
        "codigo": "FUN",
        "nome": "Fundações",
        "categoria": "Infraestrutura",
        "peso": 7.0,
        "predecessoras": ["TER"],
        "duracao_dias": 15,
        "descricao": "Estacas ou sapatas conforme sondagem, blocos e vigas baldrame com impermeabilização.",
        "servicos": [
            _s("Estaca broca Ø 25 cm (ou sapata, conforme projeto)", "m", 90),
            _s("Viga baldrame", "m", 75),
            _s("Concreto fck 25 MPa", "m³", 9),
            _s("Aço CA-50/CA-60", "kg", 650),
            _s("Fôrma de madeira", "m²", 50),
            _s("Impermeabilização do baldrame", "m²", 45),
        ],
        "equipe": "Pedreiro, armador, carpinteiro + 2 serventes",
        "atencao": [
            "Fundação definida pela sondagem, nunca 'pelo costume'.",
            "Deixar passantes de esgoto no baldrame: furar depois enfraquece a viga.",
            "Baldrame sem impermeabilização gera umidade subindo nas paredes.",
        ],
        "normas": ["NBR 6122 (fundações)", "NBR 6118 (concreto)", "NBR 12655 (controle do concreto)"],
        "checklist": [
            "Escavação/perfuração conforme projeto de fundações",
            "Cota de assentamento verificada",
            "Lastro de concreto magro (5 cm) no fundo das valas",
            "Armaduras de blocos e sapatas conferidas",
            "Esperas dos pilares posicionadas e travadas",
            "Concreto com fck e slump conferidos na nota fiscal",
            "Corpos de prova moldados",
            "Tubulações de esgoto que atravessam o baldrame deixadas (passantes)",
            "Vigas baldrame executadas e niveladas",
            "Impermeabilização do baldrame",
            "Reaterro e apiloamento interno após o baldrame",
        ],
    },
    {
        "codigo": "EST",
        "nome": "Estrutura",
        "categoria": "Supraestrutura",
        "peso": 12.0,
        "predecessoras": ["FUN"],
        "duracao_dias": 25,
        "descricao": "Pilares, vigas/cintas de respaldo e laje treliçada. Em casa térrea corre junto com a alvenaria.",
        "servicos": [
            _s("Pilares de concreto armado", "un", 18),
            _s("Vigas e cintas de respaldo", "m", 75),
            _s("Laje treliçada (vigotas + EPS ou lajota)", "m²", 100),
            _s("Concreto fck 25 MPa", "m³", 11),
            _s("Aço CA-50/CA-60", "kg", 750),
            _s("Escoramento metálico (locação)", "mês", 1),
        ],
        "equipe": "Carpinteiro, armador, pedreiro + 3 serventes",
        "atencao": [
            "Escoras da laje a cada 1,0–1,3 m, com contraflecha conforme fabricante.",
            "Eletrodutos e caixas de luz no teto antes da capa de concreto.",
            "Não retirar escoramento antes do prazo: laje sem cura deforma.",
        ],
        "normas": ["NBR 6118 (concreto)", "NBR 14931 (execução de concreto)", "NBR 15696 (fôrmas e escoramentos)", "NBR 14859 (lajes pré-fabricadas)"],
        "checklist": [
            "Fôrmas no prumo, nível e esquadro",
            "Armaduras e cobrimentos conferidos (espaçadores)",
            "Pilares executados conforme projeto estrutural",
            "Vigas/cintas de respaldo concretadas",
            "Escoramento conferido antes da concretagem",
            "Laje treliçada com vigotas, EPS/lajotas e capa conferidas",
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
        "predecessoras": ["FUN"],
        "duracao_dias": 20,
        "descricao": "Paredes de bloco cerâmico até o respaldo, com vãos, vergas, contravergas e encunhamento.",
        "servicos": [
            _s("Alvenaria de bloco cerâmico 14x19x29", "m²", 270),
            _s("Blocos cerâmicos 14x19x29", "un", 4800),
            _s("Argamassa de assentamento", "m³", 4),
            _s("Vergas e contravergas", "m", 40),
            _s("Encunhamento", "m", 75),
        ],
        "equipe": "2 pedreiros + 2 serventes",
        "atencao": [
            "Primeira fiada define tudo: conferir esquadro e medidas antes de subir.",
            "Vergas e contravergas passando 30 cm de cada lado do vão evitam trincas a 45°.",
            "Encunhar só depois que a estrutura acima recebeu carga.",
        ],
        "normas": ["NBR 15270 (blocos cerâmicos)", "NBR 8545 (execução de alvenaria)"],
        "checklist": [
            "Marcação da primeira fiada conferida",
            "Impermeabilização das 3 primeiras fiadas (argamassa com aditivo)",
            "Prumo, nível e alinhamento das fiadas",
            "Juntas de 10 mm preenchidas (horizontais e verticais)",
            "Amarração alvenaria x pilar (tela ou ferro-cabelo)",
            "Vãos de portas e janelas conferidos com o projeto (largura e altura)",
            "Vergas e contravergas em todos os vãos",
            "Contramarcos/batentes chumbados no prumo",
            "Shafts e rasgos para instalações marcados (sem cortes horizontais longos)",
            "Encunhamento executado após a alvenaria superior",
        ],
    },
    {
        "codigo": "COB",
        "nome": "Cobertura",
        "categoria": "Vedação e cobertura",
        "peso": 9.0,
        "predecessoras": ["EST", "ALV"],
        "duracao_dias": 15,
        "descricao": "Madeiramento, telhas cerâmicas, subcobertura, calhas e rufos (área de telhado ~130 m² com beirais).",
        "servicos": [
            _s("Estrutura de madeira do telhado", "m²", 130),
            _s("Telha cerâmica", "un", 2100),
            _s("Manta de subcobertura", "m²", 130),
            _s("Calhas e rufos", "m", 30),
            _s("Cumeeira", "m", 12),
        ],
        "equipe": "Carpinteiro + telhadista + servente",
        "atencao": [
            "Inclinação abaixo da mínima da telha causa goteira mesmo com telha nova.",
            "Madeira verde empena e desalinha o telhado.",
            "Rufo bem embutido na alvenaria evita infiltração na platibanda.",
        ],
        "normas": ["NBR 7190 (estruturas de madeira)", "NBR 15310 (telhas cerâmicas)", "NBR 15575-5 (coberturas)"],
        "checklist": [
            "Madeira tratada e seca (cupim/umidade)",
            "Estrutura do telhado (tesouras/terças) conferida",
            "Inclinação mínima do telhado conforme fabricante",
            "Manta térmica/subcobertura instalada",
            "Telhamento com fixação e sobreposição corretas",
            "Cumeeiras e espigões emboçados ou fixados a seco",
            "Calhas, rufos e condutores instalados",
            "Beirais e testeiras acabados",
            "Teste de estanqueidade da cobertura",
        ],
    },
    {
        "codigo": "HID",
        "nome": "Instalações hidrossanitárias",
        "categoria": "Instalações",
        "peso": 7.0,
        "predecessoras": ["ALV"],
        "duracao_dias": 12,
        "descricao": "Água fria e quente, esgoto, ventilação, águas pluviais e reservatório (2 banheiros, cozinha e serviço).",
        "servicos": [
            _s("Pontos de água fria e quente", "un", 20),
            _s("Pontos de esgoto", "un", 14),
            _s("Tubulação PVC soldável (água)", "m", 80),
            _s("Tubulação de esgoto 40/50/100 mm", "m", 60),
            _s("Caixa d'água 1.000 L", "un", 1),
            _s("Caixas de inspeção e de gordura", "un", 4),
        ],
        "equipe": "Encanador + ajudante",
        "atencao": [
            "Testar pressão e estanqueidade antes de fechar parede e contrapiso.",
            "Esgoto sem ventilação dá mau cheiro e ralo borbulhando.",
            "Caixa d'água precisa de base dimensionada: 1.000 L pesam 1 tonelada.",
        ],
        "normas": ["NBR 5626 (água fria e quente)", "NBR 8160 (esgoto)", "NBR 10844 (águas pluviais)", "NBR 7229 (tanque séptico)"],
        "checklist": [
            "Ramal de esgoto enterrado executado antes do contrapiso",
            "Tubulações de água fria e quente embutidas",
            "Pontos de água nas alturas do projeto (pia, chuveiro, tanque, máquina)",
            "Esgoto com caimento mínimo (1% a 2%)",
            "Ventilação do esgoto (coluna de ventilação) executada",
            "Ralos sifonados e caixas sifonadas nos níveis do piso",
            "Teste de pressão na rede de água",
            "Teste de estanqueidade no esgoto",
            "Águas pluviais: condutores e caixas de areia",
            "Caixa d'água, registros e caixas de inspeção instalados",
            "Fossa/filtro ou ligação à rede pública conforme projeto",
            "Tubulações protegidas antes do reboco",
        ],
    },
    {
        "codigo": "ELE",
        "nome": "Instalações elétricas e dados",
        "categoria": "Instalações",
        "peso": 6.0,
        "predecessoras": ["ALV"],
        "duracao_dias": 12,
        "descricao": "Entrada de energia, eletrodutos, caixas, quadro, fiação, aterramento, dados e TV.",
        "servicos": [
            _s("Pontos de tomada", "un", 45),
            _s("Pontos de iluminação", "un", 18),
            _s("Quadro de distribuição (24 disjuntores)", "un", 1),
            _s("Cabos 1,5 a 6 mm²", "m", 1200),
            _s("Eletroduto corrugado", "m", 350),
            _s("Padrão de entrada", "un", 1),
        ],
        "equipe": "Eletricista + ajudante",
        "atencao": [
            "Chuveiro, ar-condicionado e forno em circuitos próprios.",
            "DR obrigatório nas áreas molhadas e tomadas externas.",
            "Pedir a ligação definitiva cedo: a concessionária tem prazo.",
        ],
        "normas": ["NBR 5410 (instalações elétricas)", "NR-10"],
        "checklist": [
            "Padrão de entrada da concessionária instalado e aprovado",
            "Eletrodutos e caixas embutidos conforme projeto",
            "Caixas 4x2 nas alturas do projeto (tomadas baixas, médias e altas)",
            "Eletrodutos limpos e com guia antes da fiação",
            "Circuitos independentes para chuveiros, ar-condicionado e cozinha",
            "Quadro de distribuição com DR e DPS",
            "Fiação com bitolas e cores padronizadas",
            "Aterramento executado e medido",
            "Pontos de dados/telefonia/TV passados",
            "Teste de continuidade e isolamento dos circuitos",
        ],
    },
    {
        "codigo": "IMP",
        "nome": "Impermeabilização",
        "categoria": "Instalações",
        "peso": 2.0,
        "predecessoras": ["HID"],
        "duracao_dias": 6,
        "descricao": "Áreas molhadas (banheiros, cozinha, serviço), box e lajes expostas.",
        "servicos": [
            _s("Impermeabilização de áreas molhadas", "m²", 22),
            _s("Reforço na área do box", "m²", 8),
            _s("Teste de estanqueidade 72 h", "un", 1),
            _s("Proteção mecânica", "m²", 22),
        ],
        "equipe": "Aplicador de impermeabilização",
        "atencao": [
            "Sem teste de lâmina d'água de 72 h não se assenta piso.",
            "Ralos e cantos são onde a impermeabilização mais falha.",
        ],
        "normas": ["NBR 9575 (projeto)", "NBR 9574 (execução)"],
        "checklist": [
            "Regularização com caimento para os ralos",
            "Cantos arredondados (meia-cana)",
            "Ralos com reforço (manga/arremate)",
            "Manta/membrana aplicada em boxes, varandas e lajes",
            "Subida mínima de 30 cm nas paredes e reforço na área do box",
            "Teste de lâmina d'água por 72 horas",
            "Proteção mecânica sobre a impermeabilização",
        ],
    },
    {
        "codigo": "REV",
        "nome": "Revestimentos de parede",
        "categoria": "Acabamentos",
        "peso": 10.0,
        "predecessoras": ["HID", "ELE"],
        "duracao_dias": 30,
        "descricao": "Chapisco, reboco interno e externo e cerâmica de parede em banheiros, cozinha e serviço.",
        "servicos": [
            _s("Chapisco", "m²", 650),
            _s("Reboco interno", "m²", 520),
            _s("Reboco externo", "m²", 130),
            _s("Revestimento cerâmico de parede", "m²", 60),
            _s("Argamassa colante", "kg", 300),
            _s("Rejunte", "kg", 30),
        ],
        "equipe": "3 pedreiros + 2 serventes",
        "atencao": [
            "Reboco grosso demais fissura e encarece; usar taliscas.",
            "Tela nas ligações pilar/alvenaria evita a trinca vertical clássica.",
        ],
        "normas": ["NBR 13749 (revestimento de argamassa)", "NBR 13754 (cerâmica em paredes internas)"],
        "checklist": [
            "Instalações embutidas testadas antes do reboco",
            "Chapisco aplicado em toda a base",
            "Tela metálica nas ligações estrutura x alvenaria",
            "Taliscas e mestras para prumo",
            "Emboço/reboco desempenado e sem fissuras",
            "Espessura do reboco conforme norma (interno 5–20 mm, externo 20–30 mm)",
            "Requadro de vãos e quinas",
            "Cura do reboco antes da cerâmica (mín. 14 dias)",
            "Cerâmica de parede com juntas e prumo conferidos",
            "Rejuntamento e limpeza",
            "Teste de percussão nas paredes revestidas",
        ],
    },
    {
        "codigo": "FOR",
        "nome": "Forros",
        "categoria": "Acabamentos",
        "peso": 3.0,
        "predecessoras": ["COB", "ELE"],
        "duracao_dias": 7,
        "descricao": "Forro de gesso/drywall ou acabamento da laje, com tabicas e alçapões.",
        "servicos": [
            _s("Forro de gesso/drywall", "m²", 100),
            _s("Tabica/negativo", "m", 120),
            _s("Alçapão de inspeção", "un", 2),
        ],
        "equipe": "Gesseiro + ajudante",
        "atencao": [
            "Fechar o forro só com fiação passada e telhado estanque.",
            "Em banheiro usar placa resistente à umidade (RU).",
        ],
        "normas": ["NBR 15758 (drywall)"],
        "checklist": [
            "Tipo de forro definido (laje, gesso, drywall, PVC ou madeira)",
            "Estrutura do forro nivelada",
            "Pontos de iluminação posicionados",
            "Alçapões de inspeção previstos",
            "Tabica/negativo no encontro com paredes",
            "Forro de áreas molhadas resistente à umidade",
            "Juntas tratadas antes da pintura",
        ],
    },
    {
        "codigo": "PIS",
        "nome": "Contrapiso e pisos",
        "categoria": "Acabamentos",
        "peso": 9.0,
        "predecessoras": ["IMP", "REV"],
        "duracao_dias": 15,
        "descricao": "Contrapiso, piso cerâmico/porcelanato, rodapés, soleiras e peitoris.",
        "servicos": [
            _s("Contrapiso (e = 4 cm)", "m²", 100),
            _s("Piso cerâmico/porcelanato (com 10% de perda)", "m²", 110),
            _s("Argamassa colante AC-II/AC-III", "kg", 550),
            _s("Rodapé", "m", 110),
            _s("Soleiras e peitoris", "un", 12),
        ],
        "equipe": "2 pedreiros/azulejistas + servente",
        "atencao": [
            "Caimento de 1% para o ralo nas áreas molhadas.",
            "Peças grandes exigem dupla colagem e argamassa certa (AC-III).",
            "Comprar todo o piso do mesmo lote (tonalidade e calibre).",
        ],
        "normas": ["NBR 13753 (piso cerâmico)", "NBR 15575-3 (pisos)"],
        "checklist": [
            "Contrapiso sobre lastro/base compactada com espessura de 3–5 cm",
            "Contrapiso nivelado com caimentos nas áreas molhadas",
            "Paginação do piso aprovada antes do assentamento",
            "Peças conferidas (lote, tonalidade, calibre)",
            "Argamassa colante adequada ao formato da peça",
            "Dupla colagem em peças acima de 900 cm²",
            "Juntas de assentamento e movimentação respeitadas",
            "Rodapés e soleiras instalados",
            "Teste de percussão (peças ocas)",
            "Proteção do piso até a entrega",
        ],
    },
    {
        "codigo": "ESQ",
        "nome": "Esquadrias e vidros",
        "categoria": "Acabamentos",
        "peso": 8.0,
        "predecessoras": ["REV"],
        "duracao_dias": 7,
        "descricao": "Portas, janelas, vidros, ferragens e peitoris.",
        "servicos": [
            _s("Portas internas completas", "un", 7),
            _s("Portas externas", "un", 2),
            _s("Janelas", "un", 9),
            _s("Vidros", "m²", 14),
            _s("Ferragens (fechaduras e dobradiças)", "vb", 1),
        ],
        "equipe": "Serralheiro/vidraceiro + carpinteiro",
        "atencao": [
            "Medir os vãos depois do reboco, não pelo projeto.",
            "Janela sem selante e sem pingadeira é infiltração garantida.",
        ],
        "normas": ["NBR 10821 (esquadrias)", "NBR 7199 (vidros)"],
        "checklist": [
            "Vãos conferidos antes da medição final",
            "Contramarcos/batentes no prumo e nível",
            "Peitoris com pingadeira e caimento para fora",
            "Vedação com selante nas janelas",
            "Portas com folgas e ferragens reguladas",
            "Fechaduras, dobradiças e puxadores conferidos",
            "Vidros instalados e etiquetados",
            "Teste de estanqueidade das janelas (jato d'água)",
        ],
    },
    {
        "codigo": "LOU",
        "nome": "Louças, metais e acabamento elétrico",
        "categoria": "Acabamentos",
        "peso": 4.0,
        "predecessoras": ["PIS"],
        "duracao_dias": 6,
        "descricao": "Bacias, cubas, tanque, metais, bancadas, tomadas, interruptores e luminárias.",
        "servicos": [
            _s("Bacias sanitárias com caixa acoplada", "un", 2),
            _s("Lavatórios/cubas", "un", 3),
            _s("Tanque", "un", 1),
            _s("Torneiras e misturadores", "un", 6),
            _s("Chuveiros", "un", 2),
            _s("Tomadas e interruptores (módulos)", "un", 65),
            _s("Luminárias", "un", 18),
        ],
        "equipe": "Encanador + eletricista",
        "atencao": [
            "Testar cada ponto com água e energia ligadas antes da limpeza final.",
            "Conferir a tensão (127/220 V) de chuveiros e eletrodomésticos.",
        ],
        "normas": ["NBR 15097 (louças sanitárias)", "NBR 5410"],
        "checklist": [
            "Bancadas e tampos instalados e nivelados",
            "Bacias, cubas e tanques instalados sem vazamento",
            "Sifões, flexíveis e engates sem vazamento",
            "Torneiras, registros e chuveiros testados",
            "Chuveiro elétrico ligado em circuito e disjuntor próprios",
            "Tomadas e interruptores instalados",
            "Luminárias instaladas e testadas",
            "Quadro identificado (circuitos etiquetados)",
            "Teste de todos os pontos elétricos com a carga ligada",
        ],
    },
    {
        "codigo": "PIN",
        "nome": "Pintura",
        "categoria": "Acabamentos",
        "peso": 6.0,
        "predecessoras": ["FOR", "PIS", "ESQ"],
        "duracao_dias": 18,
        "descricao": "Preparo, selador, massa e tinta em paredes e tetos internos, fachada e esquadrias de madeira. "
                     "Acabamento final depois de piso e esquadrias, com o reboco já curado.",
        "servicos": [
            _s("Selador acrílico", "m²", 750),
            _s("Massa corrida/acrílica", "m²", 620),
            _s("Tinta acrílica/látex (2 a 3 demãos)", "m²", 750),
            _s("Pintura de portas e madeiras", "m²", 30),
        ],
        "equipe": "2 pintores",
        "atencao": [
            "Pintar reboco sem cura dá manchas e descascamento.",
            "Massa corrida (PVA) só em área seca; em área úmida e externa, acrílica.",
        ],
        "normas": ["NBR 13245 (execução de pintura)"],
        "checklist": [
            "Reboco curado (mínimo 28 dias) antes da pintura",
            "Superfícies limpas, secas e sem eflorescência",
            "Proteção de pisos, esquadrias e louças",
            "Selador/fundo aplicado",
            "Massa corrida/acrílica e lixamento",
            "Massa acrílica em áreas úmidas e externas (corrida só em área seca)",
            "Demãos de tinta conforme especificação",
            "Pintura de portas, rodapés e madeiras",
            "Retoques após instalação de louças e esquadrias",
        ],
    },
    {
        "codigo": "EXT",
        "nome": "Serviços complementares e área externa",
        "categoria": "Entrega",
        "peso": 3.0,
        "predecessoras": ["COB"],
        "duracao_dias": 15,
        "descricao": "Muros, portão, calçada pública, drenagem, paisagismo e ligações definitivas.",
        "servicos": [
            _s("Muro de divisa", "m", 40),
            _s("Calçada pública", "m²", 25),
            _s("Portão", "un", 1),
            _s("Drenagem e paisagismo", "m²", 60),
            _s("Ligações definitivas (água, esgoto e energia)", "vb", 1),
        ],
        "equipe": "Pedreiro + servente + serralheiro",
        "atencao": [
            "Calçada fora do padrão da prefeitura pode travar o habite-se.",
            "Terreno deve escoar água para longe da casa.",
        ],
        "normas": ["NBR 9050 (acessibilidade)", "Código de obras municipal"],
        "checklist": [
            "Muros, portões e gradis",
            "Calçada e acessos",
            "Calçada pública conforme padrão da prefeitura (acessível)",
            "Caimento do terreno afastando água da casa",
            "Paisagismo e drenagem externa",
            "Ligações definitivas de água, esgoto e energia",
            "Número do imóvel e caixa de correio",
        ],
    },
    {
        "codigo": "ENT",
        "nome": "Limpeza final e entrega",
        "categoria": "Entrega",
        "peso": 1.0,
        "predecessoras": ["PIN", "LOU", "ESQ", "EXT"],
        "duracao_dias": 7,
        "descricao": "Limpeza, vistoria com o cliente, documentação final e entrega das chaves.",
        "servicos": [
            _s("Limpeza fina", "m²", 100),
            _s("Retirada de entulho (caçamba)", "un", 3),
            _s("Vistoria e lista de pendências", "vb", 1),
            _s("Documentação (habite-se, averbação, CND)", "vb", 1),
        ],
        "equipe": "2 serventes + responsável técnico",
        "atencao": [
            "Habite-se e CND da obra levam semanas: iniciar antes do fim da obra.",
            "Registrar a vistoria com fotos e assinatura do cliente.",
        ],
        "normas": ["NBR 14037 (manual de uso)", "NBR 5674 (manutenção)", "NBR 15575 (desempenho)"],
        "checklist": [
            "Limpeza fina de toda a obra",
            "Remoção de entulho e sobras com CTR",
            "Vistoria com o cliente e lista de pendências",
            "Pendências da vistoria corrigidas e reinspecionadas",
            "Projetos as built entregues",
            "Manual do proprietário entregue",
            "Habite-se / certificado de conclusão",
            "Baixa do CNO / CND da obra (INSS)",
            "Averbação da construção no cartório de imóveis",
            "Termo de entrega de chaves assinado",
        ],
    },
]

CODIGOS = [e["codigo"] for e in ETAPAS_PADRAO]
CAMPOS_DESCRITIVOS = ("descricao", "servicos", "equipe", "atencao", "normas", "duracao_dias")


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
        cod = e["codigo"]
        if cod in vistos:
            problemas.append(f"Código duplicado: {cod}")
        if e["categoria"] not in CATEGORIAS:
            problemas.append(f"{cod}: categoria inválida")
        for p in e["predecessoras"]:
            if p not in vistos:
                problemas.append(f"{cod}: predecessora {p} não vem antes")
        if not e.get("duracao_dias", 0) > 0:
            problemas.append(f"{cod}: duração inválida")
        if len(set(e["checklist"])) != len(e["checklist"]):
            problemas.append(f"{cod}: item de checklist repetido")
        for s in e.get("servicos", []):
            if not (s["servico"] and s["un"] and s["qtd"] > 0):
                problemas.append(f"{cod}: quantitativo inválido ({s})")
        for campo in ("descricao", "equipe", "atencao", "servicos", "checklist"):
            if not e.get(campo):
                problemas.append(f"{cod}: campo vazio: {campo}")
        vistos.add(cod)
    soma = round(sum(e["peso"] for e in ETAPAS_PADRAO), 6)
    if soma != 100:
        problemas.append(f"Soma dos pesos = {soma}, esperado 100")
    return problemas
