"""Especificações técnicas de cada serviço do catálogo de etapas.

Para cada serviço: o que especificar (material, dimensão, traço), como
executar e o critério de aceitação na inspeção. Referência: casa térrea de
~100 m², sistema convencional. São orientações gerais de boa prática; o
projeto executivo e o memorial descritivo da obra prevalecem.

Chave: (código da etapa, texto do serviço exatamente como no catálogo).
"""

from __future__ import annotations


def _e(espec: str, execucao: str, aceitacao: str) -> dict:
    return {"especificacao": espec, "execucao": execucao, "aceitacao": aceitacao}


ESPECIFICACOES: dict[tuple[str, str], dict] = {
    # ------------------------------------------------------------------ PRE
    ("PRE", "Fechamento do terreno (tapume)"): _e(
        "Chapas de compensado resinado 10 mm ou telha metálica, altura mínima 2,20 m, pontaletes 7,5×7,5 cm a cada 2,20 m.",
        "Pontaletes enterrados 50 cm, chapas pregadas em 3 linhas de sarrafo; portão com cadeado e largura para caminhão.",
        "Sem frestas para a via pública, prumo visual, estável ao vento; atende ao código de obras municipal."),
    ("PRE", "Barracão de obra (depósito e sanitário)"): _e(
        "Estrutura de madeira, fechamento em compensado, cobertura em telha de fibrocimento; sanitário com vaso, lavatório e chuveiro (NR-18).",
        "Piso elevado ou cimentado; depósito de cimento com estrado a 30 cm do chão e no máximo 10 sacos de altura.",
        "Cobertura estanque, porta com tranca, sanitário ligado à rede ou fossa provisória, água potável disponível."),
    ("PRE", "Ligação provisória de água e energia"): _e(
        "Padrão provisório conforme a concessionária, quadro com disjuntor e DR, cavalete com hidrômetro e registro.",
        "Pedir as ligações com antecedência; cabos aéreos fora do trânsito de máquinas ou enterrados em eletroduto.",
        "Ligações aprovadas pela concessionária, quadro fechado e aterrado, sem emendas expostas."),
    ("PRE", "Locação da obra (gabarito)"): _e(
        "Gabarito de tábuas 2,5×20 cm em todo o perímetro, a 1,20 m da projeção da casa, pregos marcando eixos.",
        "Marcar eixos de pilares e paredes a partir do alinhamento e da referência de nível (RN); conferir diagonais.",
        "Diagonais iguais (tolerância 1 cm), recuos conforme projeto aprovado, eixos conferidos pelo responsável técnico."),
    ("PRE", "Placa de obra"): _e(
        "Placa com nome do responsável técnico, número do CREA/CAU, ART/RRT e alvará, nas dimensões exigidas pelo conselho e pela prefeitura.",
        "Fixar em local visível da via pública, em estrutura estável.",
        "Dados legíveis e atualizados; placa instalada antes do início dos serviços."),
    # ------------------------------------------------------------------ TER
    ("TER", "Limpeza e raspagem do terreno"): _e(
        "Remoção de vegetação, raízes e camada orgânica (≈ 20 cm) em toda a área da casa e do entorno de trabalho.",
        "Raspagem mecânica ou manual; separar entulho e material orgânico para o bota-fora.",
        "Terreno sem raízes e matéria orgânica sob a projeção da casa; nível de referência preservado."),
    ("TER", "Escavação de valas para fundação"): _e(
        "Valas na largura do baldrame + 20 cm de folga de cada lado, profundidade conforme projeto de fundações.",
        "Escavar pelo gabarito, sem ultrapassar a cota; escorar paredes acima de 1,25 m de profundidade (NR-18).",
        "Fundo plano, nivelado e apiloado, cota conferida, sem água acumulada nem material solto."),
    ("TER", "Aterro interno compactado"): _e(
        "Solo selecionado, sem matéria orgânica e entulho, umidade próxima da ótima.",
        "Camadas de no máximo 20 cm, compactadas com sapo mecânico até não marcar o pisoteio.",
        "Superfície firme e nivelada na cota do contrapiso menos o lastro; sem recalque visível após molhar."),
    ("TER", "Bota-fora (caçamba de 5 m³)"): _e(
        "Caçambas de empresa cadastrada na prefeitura, com Controle de Transporte de Resíduos (CTR).",
        "Separar resíduos classe A (terra, entulho) dos demais; não deixar caçamba na calçada além do permitido.",
        "CTR arquivado para cada caçamba (exigido para o habite-se em várias cidades)."),
    # ------------------------------------------------------------------ FUN
    ("FUN", "Estaca broca Ø 25 cm (ou sapata, conforme projeto)"): _e(
        "Estaca escavada a trado Ø 25 cm, profundidade conforme projeto (≈ 3 m), concreto fck ≥ 25 MPa, armadura de arranque.",
        "Perfurar até a cota, limpar o fundo, lançar o concreto sem interrupção com funil; posicionar a armadura logo após.",
        "Profundidade e diâmetro conferidos em cada estaca (registro em planilha), concreto contínuo, sem desmoronamento."),
    ("FUN", "Viga baldrame"): _e(
        "Seção típica 15×30 cm (ou conforme projeto), 4 barras Ø 10 mm, estribos Ø 5 mm a cada 15 cm, cobrimento 3 cm.",
        "Fôrma travada sobre lastro de 5 cm, espaçadores em todas as faces, deixar passantes de esgoto antes de concretar.",
        "Nível do topo com tolerância de 5 mm, alinhamento com o gabarito, sem ninhos de concretagem."),
    ("FUN", "Concreto fck 25 MPa"): _e(
        "Concreto usinado fck 25 MPa, brita 1, abatimento (slump) 10 ± 2 cm, classe de agressividade conforme NBR 6118.",
        "Conferir nota fiscal (fck, slump, horário de saída); adensar com vibrador; não adicionar água na obra.",
        "Slump medido no recebimento, corpos de prova moldados por caminhão e resultado aos 28 dias ≥ fck."),
    ("FUN", "Aço CA-50/CA-60"): _e(
        "CA-50 para barras longitudinais (Ø 8 e 10 mm) e CA-60 para estribos (Ø 5 mm), sem oxidação em escamas.",
        "Cortar e dobrar conforme projeto; amarrar com arame 18 em todos os cruzamentos; usar espaçadores.",
        "Bitolas, quantidades e espaçamentos conferidos contra o projeto antes de cada concretagem."),
    ("FUN", "Fôrma de madeira"): _e(
        "Tábuas de pinus 2,5×30 cm com sarrafos de travamento a cada 50 cm; desmoldante nas faces internas.",
        "Montar alinhada pelo gabarito, travar contra o solo para não abrir no lançamento do concreto.",
        "Fôrma estanque (sem vazamento de nata), no prumo e nas dimensões do projeto."),
    ("FUN", "Impermeabilização do baldrame"): _e(
        "Emulsão asfáltica ou argamassa polimérica nas faces laterais e no topo do baldrame.",
        "Aplicar em 2 a 3 demãos cruzadas sobre superfície limpa, descendo 15 cm nas laterais.",
        "Cobertura contínua sem falhas; topo totalmente coberto antes de assentar a primeira fiada."),
    # ------------------------------------------------------------------ EST
    ("EST", "Pilares de concreto armado"): _e(
        "Seção típica 14×30 cm (ou conforme projeto), 4 Ø 10 mm, estribos Ø 5 mm a cada 15 cm, cobrimento 2,5 cm.",
        "Fôrma aprumada nas duas direções, concretar em camadas com vibrador; em casa térrea, junto com a alvenaria.",
        "Prumo com tolerância de 5 mm por andar, faces sem bicheiras, esperas na posição para as cintas."),
    ("EST", "Vigas e cintas de respaldo"): _e(
        "Cinta no topo das paredes, seção 14×20 cm (ou conforme projeto), 4 Ø 8 a 10 mm, estribos Ø 5 mm a cada 15 cm.",
        "Fôrma apoiada na alvenaria, armadura amarrada às esperas dos pilares, concretagem contínua por trecho.",
        "Nível do respaldo com tolerância de 5 mm, continuidade em todo o perímetro e nas paredes internas portantes."),
    ("EST", "Laje treliçada (vigotas + EPS ou lajota)"): _e(
        "Vigotas treliçadas H8 com enchimento de EPS, capa de 4 cm com tela soldada Q-92, altura total ≈ 12 cm.",
        "Escorar a cada 1,0–1,3 m com contraflecha do fabricante; molhar o EPS; concretar em sentido único.",
        "Escoramento conferido antes da concretagem, espessura da capa medida, nenhuma vigota trincada."),
    ("EST", "Concreto fck 25 MPa"): _e(
        "Concreto usinado fck 25 MPa, brita 1 (ou 0 para lajes finas), slump 10 ± 2 cm; bombeável se usar bomba.",
        "Lançar de altura máxima de 2 m, vibrar sem encostar na armadura, cura úmida por 7 dias.",
        "Slump conferido, corpos de prova moldados, cura feita e registrada."),
    ("EST", "Aço CA-50/CA-60"): _e(
        "Conforme projeto estrutural; tela soldada Q-92 na capa da laje; barras sem oxidação em escamas.",
        "Armar sobre espaçadores, emendas por traspasse no comprimento de projeto, negativos da laje sobre caranguejos.",
        "Conferência de armaduras assinada pelo responsável antes da concretagem."),
    ("EST", "Escoramento metálico (locação)"): _e(
        "Escoras metálicas reguláveis com guias de madeira, espaçamento conforme fabricante da laje.",
        "Apoiar sobre base firme (tábua sobre solo compactado), travar no sentido das vigotas.",
        "Retirada só após 21 dias (ou conforme projeto), do centro do vão para os apoios."),
    # ------------------------------------------------------------------ ALV
    ("ALV", "Alvenaria de bloco cerâmico 14x19x29"): _e(
        "Bloco cerâmico de vedação 14×19×29 cm (NBR 15270), juntas de 10 mm, amarração em ½ bloco.",
        "Primeira fiada sobre argamassa com aditivo impermeabilizante; subir com escantilhão e linha; tela nos pilares a cada 2 fiadas.",
        "Prumo e planeza com desvio máximo de 3 mm/m, juntas cheias, sem blocos quebrados nas faces aparentes."),
    ("ALV", "Blocos cerâmicos 14x19x29 (com perdas)"): _e(
        "Blocos com selo de qualidade, resistência e dimensões conforme NBR 15270; inclui 5% de perdas.",
        "Receber em paletes, estocar em local plano e protegido da chuva.",
        "Amostra conferida: dimensões ±3 mm, sem trincas e sem empenamento."),
    ("ALV", "Argamassa de assentamento"): _e(
        "Traço 1:2:8 (cimento, cal e areia média, em volume) ou argamassa industrializada para assentamento.",
        "Preparar em quantidade para uso em até 2 h; não reaproveitar argamassa endurecida.",
        "Consistência uniforme, aderência ao bloco, juntas sem falhas."),
    ("ALV", "Vergas e contravergas"): _e(
        "Concreto armado (canaleta com 2 Ø 8 mm e graute), passando 30 cm de cada lado do vão (mínimo).",
        "Executar sobre todas as portas e janelas (verga) e sob todas as janelas (contraverga).",
        "Todos os vãos com verga e contraverga no comprimento mínimo; sem trincas inclinadas nos cantos."),
    ("ALV", "Encunhamento"): _e(
        "Fechamento entre alvenaria e estrutura com argamassa expansiva ou tijolos inclinados.",
        "Executar no mínimo 7 dias após a alvenaria e depois de a estrutura acima receber carga.",
        "Contato pleno com a viga/laje, sem vazios."),
    # ------------------------------------------------------------------ COB
    ("COB", "Estrutura de madeira do telhado"): _e(
        "Madeira de lei ou eucalipto tratado: vigas 6×12, caibros 5×6 a cada 50 cm, ripas 1,5×5 conforme a galga da telha.",
        "Montar tesouras/terças conforme projeto, ancorar na cinta com chumbadores; imunizar a madeira.",
        "Caimento e alinhamento conferidos com linha, galga constante, peças sem fendas nem empenos."),
    ("COB", "Telha cerâmica"): _e(
        "Telha cerâmica (NBR 15310) tipo conforme projeto, ≈ 16 un/m², inclinação mínima indicada pelo fabricante (30–35%).",
        "Assentar de baixo para cima, com sobreposição correta; amarrar fiadas de beiral e em regiões de vento.",
        "Sem telhas trincadas, encaixes alinhados, teste com mangueira sem goteiras."),
    ("COB", "Manta de subcobertura"): _e(
        "Manta aluminizada/subcobertura com face refletiva voltada para cima, sobreposição de 10 cm.",
        "Instalar sobre os caibros, com leve catenária para escoar a água até a calha.",
        "Manta contínua, sem rasgos, sobreposições no sentido da água."),
    ("COB", "Calhas e rufos"): _e(
        "Aço galvanizado nº 24 ou alumínio, desenvolvimento conforme projeto; caimento mínimo de 0,5% para os condutores.",
        "Rufo embutido 3 cm na alvenaria com selante; emendas rebitadas e vedadas.",
        "Teste com água: escoamento total, sem transbordo nem gotejamento nas emendas."),
    ("COB", "Cumeeira"): _e(
        "Cumeeira cerâmica compatível com a telha, ≈ 3 un/m.",
        "Assentar com argamassa fraca (cimento, cal e areia) ou fixação a seco com espuma/peça própria.",
        "Alinhada, sem trincas, sem frestas para passagem de água."),
    # ------------------------------------------------------------------ HID
    ("HID", "Pontos de água fria e quente"): _e(
        "Água fria em PVC soldável; água quente em PPR ou CPVC; alturas conforme projeto (pia 1,10 m, chuveiro 2,10 m, tanque 1,10 m).",
        "Embutir em rasgos verticais, fixar com argamassa; tampar pontos com plugues até a instalação final.",
        "Teste de pressão (1,5× a pressão de serviço por 1 h) sem queda nem vazamento."),
    ("HID", "Pontos de esgoto"): _e(
        "Diâmetros mínimos: bacia 100 mm, chuveiro/lavatório 40 mm, pia e tanque 50 mm (NBR 8160).",
        "Ralos e caixas sifonadas nivelados com o piso acabado; desvios com curvas longas.",
        "Teste com água sem vazamentos; caimento conferido com nível."),
    ("HID", "Tubulação PVC soldável (água)"): _e(
        "Tubos e conexões PVC soldável marrom (NBR 5648), 25 a 50 mm conforme projeto.",
        "Lixar e limpar as pontas, aplicar adesivo nas duas faces e encaixar sem girar.",
        "Juntas sem excesso de adesivo, tubulação protegida antes do reboco."),
    ("HID", "Tubulação de esgoto 40/50/100 mm"): _e(
        "PVC série normal (NBR 5688), caimento 2% para Ø ≤ 75 mm e 1% para Ø 100 mm.",
        "Juntas com anel de borracha e pasta lubrificante; tubo de ventilação Ø 50 mm acima do telhado.",
        "Teste de estanqueidade com água; nenhuma contrapendência."),
    ("HID", "Caixa d'água 1.000 L"): _e(
        "Reservatório de polietileno 1.000 L com tampa, extravasor e registro de limpeza.",
        "Apoiar em base plana e dimensionada (≈ 1 t cheia), acesso para limpeza.",
        "Nivelada, sem vazamentos nos adaptadores, boia regulada."),
    ("HID", "Caixas de inspeção e de gordura"): _e(
        "Caixa de inspeção 60×60 cm a cada mudança de direção e no máximo 25 m; caixa de gordura na saída da pia.",
        "Fundo com canaleta e caimento, tampa removível e vedada.",
        "Fluxo livre testado com água, tampas no nível do piso externo."),
    # ------------------------------------------------------------------ ELE
    ("ELE", "Pontos de tomada"): _e(
        "Tomadas padrão NBR 14136, 10 A gerais e 20 A para cozinha/área de serviço; alturas 0,30 / 1,10 / 2,20 m.",
        "Caixas 4×2 niveladas com a face do reboco; circuitos de tomadas separados dos de iluminação.",
        "Polaridade e aterramento testados em todas as tomadas."),
    ("ELE", "Pontos de iluminação"): _e(
        "Caixas octogonais no teto (laje) ou ponto no forro; interruptores a 1,10 m do piso.",
        "Eletrodutos e caixas posicionados antes da concretagem da laje.",
        "Todos os pontos acendendo pelo interruptor correto."),
    ("ELE", "Quadro de distribuição (24 disjuntores)"): _e(
        "Quadro de embutir com barramento de neutro e terra, DR 30 mA geral ou por circuito, DPS classe II.",
        "Instalar a 1,50 m do piso, circuitos identificados; disjuntores conforme bitola dos cabos.",
        "Quadro etiquetado, DR testado no botão de teste, sem cabos expostos."),
    ("ELE", "Cabos 1,5 a 6 mm²"): _e(
        "Cabos flexíveis 750 V antichama; iluminação 1,5 mm², tomadas 2,5 mm², chuveiro 6 mm² (ou conforme cálculo).",
        "Cores: fase preto/vermelho, neutro azul, terra verde; emendas só nas caixas.",
        "Teste de isolamento e continuidade; nenhuma emenda dentro de eletroduto."),
    ("ELE", "Eletroduto corrugado"): _e(
        "Eletroduto corrugado antichama 3/4\" e 1\" em parede e laje; rígido em trechos externos.",
        "Embutir sem amassar, curvas suaves, passar guia de arame antes do reboco.",
        "Eletrodutos desobstruídos (guia passando em todos)."),
    ("ELE", "Padrão de entrada"): _e(
        "Padrão de entrada conforme norma da concessionária local (poste, caixa de medição, aterramento).",
        "Executar por eletricista habilitado e solicitar vistoria e ligação definitiva.",
        "Aprovado pela concessionária e ligação definitiva realizada."),
    # ------------------------------------------------------------------ IMP
    ("IMP", "Impermeabilização de áreas molhadas"): _e(
        "Argamassa polimérica ou manta líquida em banheiros, cozinha e área de serviço (NBR 9575).",
        "Regularização com caimento de 1% para o ralo, cantos em meia-cana, 3 demãos cruzadas com tela nos cantos.",
        "Camada contínua, subindo 30 cm nas paredes; teste de lâmina d'água aprovado."),
    ("IMP", "Reforço na área do box"): _e(
        "Reforço com tela de poliéster e subida da impermeabilização na parede do box (mínimo 1,00 m; ideal até o teto).",
        "Executar antes do revestimento; tratar ralos e registros com mangas e arremates.",
        "Sem falhas nos encontros parede-piso e nas tubulações."),
    ("IMP", "Teste de estanqueidade 72 h"): _e(
        "Lâmina d'água de 5 cm por 72 horas sobre a impermeabilização, com ralos tampados.",
        "Marcar o nível inicial e conferir diariamente, inclusive o teto/parede do outro lado.",
        "Nível constante e nenhuma mancha de umidade nas áreas vizinhas."),
    ("IMP", "Proteção mecânica"): _e(
        "Argamassa de cimento e areia 1:4, espessura 2 a 3 cm, sobre a impermeabilização.",
        "Executar logo após o teste de estanqueidade, sem perfurar a camada impermeável.",
        "Superfície com caimento mantido para o ralo, sem trincas."),
    # ------------------------------------------------------------------ REV
    ("REV", "Chapisco"): _e(
        "Argamassa de cimento e areia grossa 1:3, consistência fluida.",
        "Lançar com colher sobre a base limpa e úmida, cobrindo toda a superfície (inclusive estrutura).",
        "Camada áspera e aderida em 100% da base; cura de 3 dias antes do reboco."),
    ("REV", "Reboco interno"): _e(
        "Argamassa 1:2:8 ou industrializada, espessura 5 a 20 mm (NBR 13749).",
        "Taliscas e mestras para prumo, sarrafear e desempenar; tela nas ligações alvenaria × estrutura.",
        "Planeza com desvio ≤ 3 mm em régua de 2 m, sem fissuras nem som cavo."),
    ("REV", "Reboco externo"): _e(
        "Argamassa 1:2:8 com aditivo ou industrializada para fachada, espessura 20 a 30 mm.",
        "Executar em panos com juntas de trabalho, proteger do sol forte e da chuva nas primeiras 24 h.",
        "Sem fissuras, sem som cavo, juntas e pingadeiras executadas."),
    ("REV", "Revestimento cerâmico de parede"): _e(
        "Revestimento cerâmico ou porcelanato de parede conforme padrão, mesmo lote e tonalidade.",
        "Assentar sobre reboco curado (≥ 14 dias) com argamassa colante e desempenadeira dentada; juntas conforme fabricante.",
        "Prumo e alinhamento das juntas, ausência de peças ocas (teste de percussão), recortes limpos."),
    ("REV", "Argamassa colante"): _e(
        "AC-I para cerâmica em área interna; AC-II/AC-III para porcelanato e peças grandes (NBR 14081).",
        "Respeitar o tempo em aberto (cordões não podem formar película); dupla colagem em peças > 900 cm².",
        "Peça arrancada mostra pelo menos 80% de contato com a argamassa."),
    ("REV", "Rejunte"): _e(
        "Rejunte cimentício flexível ou acrílico/epóxi em áreas molhadas e de alto padrão.",
        "Aplicar no mínimo 72 h após o assentamento, juntas limpas e úmidas.",
        "Juntas totalmente preenchidas, cor uniforme, sem fissuras."),
    # ------------------------------------------------------------------ FOR
    ("FOR", "Forro de gesso/drywall"): _e(
        "Chapa de gesso acartonado 12,5 mm (ST; RU em áreas molhadas), perfis F530 a cada 60 cm, pendurais a cada 1,0 m.",
        "Nivelar a estrutura a laser, parafusar as chapas com juntas desencontradas, tratar juntas com fita e massa.",
        "Planeza com desvio ≤ 3 mm em 2 m, juntas invisíveis após pintura, sem fissuras."),
    ("FOR", "Tabica/negativo"): _e(
        "Perfil tabica metálico em todo o perímetro, criando negativo de 1 cm no encontro com as paredes.",
        "Fixar nivelado antes das chapas.",
        "Linha contínua e reta, sem trincas no encontro forro × parede."),
    ("FOR", "Alçapão de inspeção"): _e(
        "Alçapão 60×60 cm com quadro metálico e tampa removível.",
        "Posicionar sob caixa d'água, registros e pontos de manutenção.",
        "Abre e fecha sem esforço, alinhado ao forro."),
    # ------------------------------------------------------------------ PIS
    ("PIS", "Contrapiso (e = 4 cm)"): _e(
        "Argamassa de cimento e areia 1:4 (farofa), espessura 3 a 5 cm, sobre base compactada e limpa.",
        "Taliscas de nível, ponte de aderência (nata de cimento), caimento de 1% para ralos nas áreas molhadas.",
        "Nível conforme projeto (tolerância 3 mm em 2 m), superfície firme sem esfarelar, cura de 7 dias."),
    ("PIS", "Piso cerâmico/porcelanato (com 10% de perda)"): _e(
        "Especificação conforme padrão construtivo; mesmo lote, tonalidade e calibre; PEI e resistência a escorregamento adequados ao ambiente.",
        "Paginação aprovada antes de assentar; juntas de movimentação a cada 20 m² (internas) e no perímetro.",
        "Sem peças ocas, sem dentes entre peças (≤ 1 mm), alinhamento das juntas, caimentos preservados."),
    ("PIS", "Argamassa colante AC-II/AC-III"): _e(
        "AC-II para cerâmica e porcelanato até 60×60; AC-III para grandes formatos e áreas externas.",
        "Desempenadeira dentada 8 mm (ou maior para peças grandes); dupla colagem em peças > 900 cm².",
        "Contato ≥ 80% (ou ≥ 90% em áreas externas e molhadas) ao arrancar uma peça."),
    ("PIS", "Rodapé"): _e(
        "Rodapé do mesmo material do piso (7 cm) ou poliestireno/MDF (10 cm) conforme padrão.",
        "Assentar após o piso, alinhado e com junta para o piso.",
        "Alinhado, sem peças soltas, cantos bem resolvidos."),
    ("PIS", "Soleiras e peitoris"): _e(
        "Granito com espessura de 2 cm; peitoril com pingadeira e caimento para fora.",
        "Assentar com argamassa colante; peitoril avançando 2 cm além da face externa da parede.",
        "Pingadeira funcionando (água não escorre pela parede), sem trincas."),
    # ------------------------------------------------------------------ ESQ
    ("ESQ", "Portas internas completas"): _e(
        "Kit porta pronta (folha, batente, guarnição e ferragens) 0,70 a 0,80 m × 2,10 m.",
        "Instalar no vão conferido, com espuma de PU e calços; folga de 3 a 5 mm entre folha e batente.",
        "Abre e fecha sem raspar, prumo e esquadro, fechadura funcionando."),
    ("ESQ", "Portas externas"): _e(
        "Porta de madeira maciça, alumínio ou aço, resistente à umidade e ao sol.",
        "Soleira com caimento para fora e vedação nas laterais.",
        "Estanque à água de chuva, travamento seguro."),
    ("ESQ", "Janelas"): _e(
        "Alumínio (NBR 10821) com vidro conforme padrão; maxim-ar ou basculante em banheiros.",
        "Instalar sobre contramarco ou chumbada no prumo, vedar o perímetro externo com selante.",
        "Teste com jato d'água sem infiltração, abre e fecha sem esforço."),
    ("ESQ", "Vidros"): _e(
        "Vidro comum 4 mm ou laminado/temperado conforme posição e padrão (NBR 7199); box em temperado 8 mm.",
        "Fixar com gaxeta ou silicone, etiquetas removidas só na limpeza final.",
        "Sem trincas, riscos ou bolhas; box temperado com selo do fabricante."),
    ("ESQ", "Ferragens (fechaduras e dobradiças)"): _e(
        "Fechaduras e dobradiças de latão ou aço inox; 3 dobradiças por porta.",
        "Embutir sem enfraquecer a folha, parafusos na medida certa.",
        "Chaves entregues identificadas, todas as fechaduras testadas."),
    # ------------------------------------------------------------------ LOU
    ("LOU", "Bacias sanitárias com caixa acoplada"): _e(
        "Bacia com caixa acoplada 6 L (ou dual flush), conforme padrão (NBR 15097).",
        "Fixar com parafusos e anel de vedação, sem argamassa na base; ligar com engate flexível.",
        "Sem vazamento na descarga e na base, fixa e nivelada."),
    ("LOU", "Lavatórios/cubas"): _e(
        "Lavatório de louça ou cuba de apoio/embutir conforme padrão; cuba inox na cozinha.",
        "Fixar com parafusos/silicone, sifão acessível e ligado ao ponto de esgoto.",
        "Sem vazamentos com a cuba cheia escoando."),
    ("LOU", "Tanque"): _e(
        "Tanque de louça, mármore sintético ou inox com coluna ou suporte.",
        "Fixar nivelado, ligar à caixa sifonada/ponto de esgoto de 50 mm.",
        "Escoamento livre e sem vazamento."),
    ("LOU", "Torneiras e misturadores"): _e(
        "Metais compatíveis com a pressão da rede (alta ou baixa pressão) e com o padrão construtivo.",
        "Vedar roscas com fita veda-rosca; não apertar além do necessário.",
        "Sem gotejamento, fluxo adequado em cada ponto."),
    ("LOU", "Chuveiros"): _e(
        "Chuveiro elétrico com potência compatível com o circuito (disjuntor e cabo), ou misturador com aquecimento.",
        "Ligar ao circuito exclusivo com aterramento; altura de 2,10 m.",
        "Aquece sem desarmar o disjuntor, sem choque, sem vazamento."),
    ("LOU", "Tomadas e interruptores (módulos)"): _e(
        "Módulos e placas padrão NBR 14136, da mesma linha em toda a casa.",
        "Instalar após a pintura, com a energia desligada; fios bem presos aos bornes.",
        "Todas as tomadas com tensão e polaridade corretas, placas alinhadas."),
    ("LOU", "Luminárias"): _e(
        "Luminárias e lâmpadas LED com temperatura de cor definida no projeto (ex.: 3000 K salas, 4000 K serviço).",
        "Fixar em caixa ou forro com suporte próprio; ligar terra quando houver.",
        "Todas acendendo, firmes, sem aquecimento anormal."),
    # ------------------------------------------------------------------ PIN
    ("PIN", "Selador acrílico"): _e(
        "Selador acrílico pigmentado, diluição conforme fabricante.",
        "Aplicar sobre reboco curado (≥ 28 dias), limpo, seco e sem eflorescência.",
        "Absorção uniforme da superfície, sem manchas de umidade."),
    ("PIN", "Massa corrida/acrílica"): _e(
        "Massa corrida PVA só em áreas secas internas; massa acrílica em áreas úmidas e externas.",
        "2 demãos finas com lixamento entre elas e remoção do pó.",
        "Superfície lisa e plana sob luz rasante, sem ondulações."),
    ("PIN", "Tinta acrílica/látex (2 a 3 demãos)"): _e(
        "Tinta acrílica (NBR 15079) de linha compatível com o padrão; acrílica premium em fachada.",
        "Intervalo entre demãos conforme fabricante; cortar cantos com pincel antes do rolo.",
        "Cor uniforme, sem marcas de rolo, sem falhas de cobertura."),
    ("PIN", "Pintura de portas e madeiras"): _e(
        "Esmalte sintético/acrílico ou verniz para madeiras, conforme especificação.",
        "Lixar, aplicar fundo para madeira e 2 demãos de acabamento.",
        "Acabamento uniforme, sem escorrimentos, portas fechando sem colar."),
    # ------------------------------------------------------------------ EXT
    ("EXT", "Muro de divisa"): _e(
        "Bloco de concreto 14×19×39 cm, colunas a cada 3 m, cinta superior, altura conforme código de obras (≈ 2,0 m).",
        "Fundação corrida ou brocas, impermeabilizar a base, chapisco e reboco nas faces.",
        "Prumo, alinhamento na divisa, sem trincas."),
    ("EXT", "Calçada pública"): _e(
        "Concreto ou piso conforme padrão da prefeitura, faixa livre acessível (NBR 9050), piso tátil quando exigido.",
        "Base compactada, juntas de dilatação a cada 2 m, caimento de 2% para a rua.",
        "Aprovada na vistoria da prefeitura (exigência do habite-se em muitas cidades)."),
    ("EXT", "Portão"): _e(
        "Portão de aço galvanizado ou alumínio, com fechadura; automatização conforme padrão.",
        "Fixar em colunas armadas, folgas de abertura e trilho nivelados.",
        "Abre e fecha sem travar, fechadura e motor (se houver) funcionando."),
    ("EXT", "Drenagem e paisagismo"): _e(
        "Caimento do terreno de pelo menos 2% afastando a água da casa; dreno com manta geotêxtil em áreas encharcadas.",
        "Executar após o fim das obras pesadas; terra vegetal e plantio na época adequada.",
        "Sem empoçamento junto às paredes após chuva."),
    ("EXT", "Ligações definitivas (água, esgoto e energia)"): _e(
        "Ligações nas redes públicas conforme normas das concessionárias.",
        "Solicitar com antecedência; desativar as ligações provisórias.",
        "Ligações aprovadas e contas no nome do proprietário."),
    # ------------------------------------------------------------------ ENT
    ("ENT", "Limpeza fina"): _e(
        "Limpeza de pisos, revestimentos, vidros, louças e metais com produtos adequados a cada material.",
        "Remover respingos de tinta e argamassa sem riscar (nada de palha de aço em porcelanato e metais).",
        "Casa pronta para morar, sem resíduos de obra."),
    ("ENT", "Retirada de entulho (caçamba)"): _e(
        "Caçambas de empresa cadastrada, com CTR.",
        "Retirar sobras e entulho do terreno e da calçada.",
        "Terreno limpo e CTRs arquivados."),
    ("ENT", "Vistoria e lista de pendências"): _e(
        "Vistoria com o cliente usando a lista de verificação de todos os ambientes.",
        "Registrar pendências com foto, responsável e prazo; reinspecionar.",
        "Termo de vistoria assinado sem pendências abertas."),
    ("ENT", "Documentação (habite-se, averbação, CND)"): _e(
        "Habite-se, CND da obra (INSS) e averbação da construção na matrícula.",
        "Iniciar os pedidos antes do fim da obra; manter ART/RRT, CTRs e notas fiscais organizados.",
        "Documentos emitidos e entregues ao proprietário com o manual de uso (NBR 14037)."),
}


def especificacao(codigo: str, servico: str) -> dict | None:
    return ESPECIFICACOES.get((codigo, servico))
