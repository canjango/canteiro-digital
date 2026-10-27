"""Lista de materiais por etapa — residência térrea de ~100 m², padrão normal.

Mesma referência construtiva do catálogo de etapas (estaca broca + viga
baldrame, pilares e cintas de concreto armado, laje treliçada com EPS,
alvenaria de bloco cerâmico 14x19x29, telhado cerâmico com madeiramento,
forro de gesso acartonado, piso cerâmico/porcelanato, pintura acrílica).

As quantidades são para 100 m² e já incluem perdas usuais; o sistema as
escala pela área construída da obra. São estimativas de consumo para
planejar compras — o quantitativo do projeto executivo prevalece.

Cada material: (chave, descrição, unidade, quantidade, categoria).
A chave é estável: liga o material aos pedidos de compra já feitos.
"""

from __future__ import annotations

import math

MAT = "Material"
LOC = "Equipamento/locação"
SRV = "Serviço terceirizado"

_LISTA: dict[str, list[tuple]] = {
    "PRE": [
        ("tapume", "Chapa de compensado resinado 2,20×1,10 m (tapume)", "un", 40, MAT),
        ("pontalete", "Pontalete de pinus 7,5×7,5 cm × 3 m", "un", 25, MAT),
        ("sarrafo", "Sarrafo de pinus 2,5×10 cm", "m", 120, MAT),
        ("tabua-gabarito", "Tábua de pinus 2,5×20 cm (gabarito)", "m", 60, MAT),
        ("prego", "Prego 17×21", "kg", 5, MAT),
        ("linha", "Linha de náilon para locação", "rolo", 2, MAT),
        ("chapa-barracao", "Chapa de compensado 12 mm (barracão)", "un", 15, MAT),
        ("telha-barracao", "Telha de fibrocimento 2,44×1,10 m (barracão)", "un", 6, MAT),
        ("energia-prov", "Padrão de entrada provisório de energia", "cj", 1, MAT),
        ("agua-prov", "Cavalete/ligação provisória de água", "cj", 1, MAT),
        ("caixa-prov", "Caixa d'água 500 L (provisória)", "un", 1, MAT),
        ("banheiro-quimico", "Banheiro químico (locação mensal)", "mês", 6, LOC),
        ("placa", "Placa de obra", "m²", 2, MAT),
    ],
    "TER": [
        ("retro", "Retroescavadeira (locação por hora)", "h", 16, LOC),
        ("sapo", "Compactador de solo tipo sapo (locação)", "dia", 3, LOC),
        ("aterro", "Terra para aterro (complemento)", "m³", 10, MAT),
        ("cacamba", "Caçamba de entulho 5 m³", "un", 4, SRV),
    ],
    "FUN": [
        ("concreto", "Concreto usinado fck 25 MPa (estacas e baldrame)", "m³", 9, MAT),
        ("aco10", "Aço CA-50 10 mm", "kg", 300, MAT),
        ("aco8", "Aço CA-50 8 mm", "kg", 200, MAT),
        ("aco5", "Aço CA-60 5 mm (estribos)", "kg", 150, MAT),
        ("arame", "Arame recozido nº 18", "kg", 10, MAT),
        ("espacador", "Espaçador plástico para armadura", "un", 300, MAT),
        ("cimento-lastro", "Cimento CP-II 50 kg (lastro e ajustes)", "sc", 6, MAT),
        ("areia", "Areia média", "m³", 1.5, MAT),
        ("brita", "Brita 1", "m³", 1.5, MAT),
        ("tabua-forma", "Tábua de pinus 2,5×30 cm (fôrmas)", "m", 150, MAT),
        ("sarrafo-forma", "Sarrafo de pinus 2,5×7 cm", "m", 100, MAT),
        ("prego", "Prego 18×27", "kg", 8, MAT),
        ("desmoldante", "Desmoldante para fôrmas", "l", 10, MAT),
        ("imperm-baldrame", "Emulsão asfáltica para baldrame (lata 18 L)", "lata", 3, MAT),
        ("passante", "Tubo PVC 100 mm para passantes no baldrame", "m", 6, MAT),
    ],
    "EST": [
        ("concreto", "Concreto usinado fck 25 MPa (pilares, cintas e laje)", "m³", 11, MAT),
        ("bomba", "Bomba de concreto (lança) — concretagem da laje", "un", 1, SRV),
        ("aco10", "Aço CA-50 10 mm", "kg", 350, MAT),
        ("aco8", "Aço CA-50 8 mm", "kg", 150, MAT),
        ("aco5", "Aço CA-60 5 mm (estribos)", "kg", 150, MAT),
        ("tela", "Tela soldada Q-92 (capa da laje)", "m²", 105, MAT),
        ("vigota", "Vigota treliçada", "m", 250, MAT),
        ("eps", "Enchimento de EPS para laje H8", "m²", 95, MAT),
        ("escoras", "Escoramento metálico (locação)", "mês", 1, LOC),
        ("compensado", "Chapa de compensado plastificado 12 mm (fôrmas)", "un", 12, MAT),
        ("tabua-forma", "Tábua de pinus 2,5×30 cm (fôrmas)", "m", 250, MAT),
        ("sarrafo", "Sarrafo de pinus 2,5×7 cm", "m", 200, MAT),
        ("prego", "Prego 17×27", "kg", 15, MAT),
        ("arame", "Arame recozido nº 18", "kg", 12, MAT),
        ("espacador", "Espaçador plástico para armadura", "un", 600, MAT),
        ("desmoldante", "Desmoldante para fôrmas", "l", 20, MAT),
    ],
    "ALV": [
        ("bloco", "Bloco cerâmico 14×19×29 cm", "un", 5000, MAT),
        ("meio-bloco", "Meio-bloco cerâmico 14×19×14 cm", "un", 300, MAT),
        ("canaleta", "Canaleta cerâmica 14×19×29 cm (vergas)", "un", 150, MAT),
        ("cimento", "Cimento CP-II 50 kg", "sc", 18, MAT),
        ("cal", "Cal hidratada CH-III 20 kg", "sc", 28, MAT),
        ("areia", "Areia média", "m³", 5, MAT),
        ("brita", "Brita 1 (vergas e contravergas)", "m³", 0.5, MAT),
        ("aco8", "Aço CA-50 8 mm (vergas e contravergas)", "kg", 60, MAT),
        ("tela-amarracao", "Tela galvanizada de amarração alvenaria × pilar", "un", 250, MAT),
        ("aditivo", "Impermeabilizante para argamassa (3 primeiras fiadas)", "l", 18, MAT),
    ],
    "COB": [
        ("telha", "Telha cerâmica", "un", 2100, MAT),
        ("cumeeira", "Cumeeira cerâmica", "un", 40, MAT),
        ("viga", "Viga de madeira 6×12 cm (tesouras e terças)", "m", 180, MAT),
        ("caibro", "Caibro de madeira 5×6 cm", "m", 260, MAT),
        ("ripa", "Ripa de madeira 1,5×5 cm", "m", 400, MAT),
        ("prego", "Prego 18×27", "kg", 10, MAT),
        ("prego-ripa", "Prego 15×15 (ripas)", "kg", 5, MAT),
        ("manta", "Manta de subcobertura aluminizada", "m²", 140, MAT),
        ("calha", "Calha de aço galvanizado", "m", 30, MAT),
        ("rufo", "Rufo de aço galvanizado", "m", 25, MAT),
        ("condutor", "Condutor de PVC 100 mm (águas pluviais)", "m", 15, MAT),
        ("imunizante", "Imunizante/cupinicida para madeira", "l", 10, MAT),
    ],
    "HID": [
        ("pvc25", "Tubo PVC soldável 25 mm (água fria)", "m", 60, MAT),
        ("pvc32", "Tubo PVC soldável 32 mm", "m", 18, MAT),
        ("pvc50", "Tubo PVC soldável 50 mm (alimentação da caixa)", "m", 12, MAT),
        ("ppr", "Tubo PPR/CPVC 22 mm (água quente)", "m", 25, MAT),
        ("conexoes-agua", "Conexões soldáveis (joelhos, tês, luvas)", "un", 120, MAT),
        ("esg100", "Tubo PVC esgoto 100 mm", "m", 24, MAT),
        ("esg50", "Tubo PVC esgoto 50 mm", "m", 24, MAT),
        ("esg40", "Tubo PVC esgoto 40 mm", "m", 18, MAT),
        ("conexoes-esgoto", "Conexões de esgoto (joelhos, junções, curvas)", "un", 60, MAT),
        ("caixa-sifonada", "Caixa sifonada 150×150 mm", "un", 4, MAT),
        ("ralo", "Ralo seco", "un", 2, MAT),
        ("reg-gaveta", "Registro de gaveta 3/4\"", "un", 6, MAT),
        ("reg-pressao", "Registro de pressão 3/4\"", "un", 4, MAT),
        ("caixa-dagua", "Caixa d'água de polietileno 1.000 L", "un", 1, MAT),
        ("kit-caixa", "Kit de adaptadores e torneira de boia", "cj", 1, MAT),
        ("caixa-inspecao", "Caixa de inspeção pré-moldada 60×60 cm", "un", 2, MAT),
        ("caixa-gordura", "Caixa de gordura", "un", 1, MAT),
        ("caixa-areia", "Caixa de areia (águas pluviais)", "un", 2, MAT),
        ("adesivo", "Adesivo para PVC (frasco 175 g)", "un", 6, MAT),
        ("veda-rosca", "Fita veda-rosca", "rolo", 10, MAT),
    ],
    "ELE": [
        ("cabo15", "Cabo flexível 1,5 mm² (iluminação)", "m", 300, MAT),
        ("cabo25", "Cabo flexível 2,5 mm² (tomadas)", "m", 500, MAT),
        ("cabo4", "Cabo flexível 4 mm²", "m", 100, MAT),
        ("cabo6", "Cabo flexível 6 mm² (chuveiros)", "m", 120, MAT),
        ("cabo10", "Cabo flexível 10 mm² (alimentação e aterramento)", "m", 60, MAT),
        ("eletroduto34", "Eletroduto corrugado 3/4\"", "m", 300, MAT),
        ("eletroduto1", "Eletroduto corrugado 1\"", "m", 50, MAT),
        ("caixa42", "Caixa de luz 4×2", "un", 70, MAT),
        ("caixa44", "Caixa de luz 4×4", "un", 10, MAT),
        ("octogonal", "Caixa octogonal de laje", "un", 18, MAT),
        ("quadro", "Quadro de distribuição 24 disjuntores", "un", 1, MAT),
        ("disjuntor", "Disjuntor DIN (mono e bipolar)", "un", 20, MAT),
        ("dr", "Interruptor diferencial residual (DR) 40 A", "un", 1, MAT),
        ("dps", "Dispositivo de proteção contra surtos (DPS)", "un", 3, MAT),
        ("haste", "Haste de aterramento 2,4 m com conector", "cj", 1, MAT),
        ("padrao", "Padrão de entrada definitivo (kit concessionária)", "cj", 1, MAT),
        ("cat6", "Cabo de rede Cat6", "m", 80, MAT),
        ("coaxial", "Cabo coaxial (TV)", "m", 40, MAT),
        ("fita", "Fita isolante", "un", 10, MAT),
    ],
    "IMP": [
        ("arg-polimerica", "Argamassa polimérica impermeabilizante (cx 18 kg)", "cx", 7, MAT),
        ("tela-poliester", "Tela de poliéster estruturante (cantos e ralos)", "m²", 15, MAT),
        ("cimento", "Cimento CP-II 50 kg (regularização)", "sc", 4, MAT),
        ("areia", "Areia média (regularização)", "m³", 1, MAT),
        ("manga-ralo", "Manga/arremate para ralo", "un", 6, MAT),
    ],
    "REV": [
        ("cimento", "Cimento CP-II 50 kg (chapisco e reboco)", "sc", 70, MAT),
        ("cal", "Cal hidratada CH-III 20 kg (reboco)", "sc", 95, MAT),
        ("areia", "Areia média", "m³", 18, MAT),
        ("tela-reforco", "Tela galvanizada para reforço (estrutura × alvenaria)", "m", 120, MAT),
        ("ceramica", "Revestimento cerâmico de parede", "m²", 66, MAT),
        ("ac1", "Argamassa colante AC-I (saco 20 kg)", "sc", 15, MAT),
        ("rejunte", "Rejunte", "kg", 30, MAT),
        ("cunhas", "Cunhas/espaçadores niveladores", "pct", 4, MAT),
        ("cantoneira", "Cantoneira de alumínio/PVC para quinas", "barra", 15, MAT),
    ],
    "FOR": [
        ("placa-st", "Placa de gesso acartonado ST 12,5 mm (1,20×1,80 m)", "un", 42, MAT),
        ("placa-ru", "Placa de gesso acartonado RU 12,5 mm (áreas molhadas)", "un", 8, MAT),
        ("perfil-f530", "Perfil F530", "m", 330, MAT),
        ("tabica", "Perfil tabica", "m", 120, MAT),
        ("pendural", "Regulador/pendural com arame galvanizado", "un", 120, MAT),
        ("parafuso", "Parafusos para drywall (placa e metal)", "un", 1500, MAT),
        ("fita", "Fita de papel para juntas (rolo 150 m)", "rolo", 3, MAT),
        ("massa", "Massa para juntas", "kg", 50, MAT),
        ("alcapao", "Alçapão de inspeção 60×60 cm", "un", 2, MAT),
    ],
    "PIS": [
        ("cimento", "Cimento CP-II 50 kg (contrapiso)", "sc", 28, MAT),
        ("areia", "Areia média (contrapiso)", "m³", 4.5, MAT),
        ("piso", "Piso cerâmico/porcelanato", "m²", 110, MAT),
        ("ac2", "Argamassa colante AC-II/AC-III (saco 20 kg)", "sc", 30, MAT),
        ("rejunte", "Rejunte", "kg", 25, MAT),
        ("rodape", "Rodapé", "m", 115, MAT),
        ("soleira", "Soleiras e peitoris de granito", "un", 12, MAT),
        ("cunhas", "Cunhas/espaçadores niveladores", "pct", 6, MAT),
        ("protecao", "Proteção de piso (papelão ondulado)", "m²", 110, MAT),
    ],
    "ESQ": [
        ("porta-int", "Kit porta interna (folha, batente e guarnição)", "un", 7, MAT),
        ("porta-ext", "Porta externa", "un", 2, MAT),
        ("fechadura-int", "Fechadura interna", "un", 7, MAT),
        ("fechadura-ext", "Fechadura externa", "un", 2, MAT),
        ("dobradica", "Dobradiça 3½\"", "un", 27, MAT),
        ("janela-correr", "Janela de alumínio de correr com vidro", "un", 5, MAT),
        ("janela-basculante", "Janela basculante/maxim-ar (banheiros e cozinha)", "un", 4, MAT),
        ("box", "Box de vidro temperado", "un", 2, MAT),
        ("selante", "Selante de silicone/PU (tubo)", "un", 10, MAT),
        ("espuma", "Espuma expansiva de PU", "un", 6, MAT),
    ],
    "LOU": [
        ("bacia", "Bacia sanitária com caixa acoplada", "un", 2, MAT),
        ("assento", "Assento sanitário", "un", 2, MAT),
        ("kit-bacia", "Kit de fixação e anel de vedação da bacia", "cj", 2, MAT),
        ("lavatorio", "Lavatório/cuba", "un", 3, MAT),
        ("tanque", "Tanque", "un", 1, MAT),
        ("bancada", "Bancadas de granito (cozinha e banheiros)", "m²", 3.5, MAT),
        ("torneira", "Torneiras (lavatório, cozinha, tanque, jardim)", "un", 6, MAT),
        ("chuveiro", "Chuveiro elétrico", "un", 2, MAT),
        ("ducha", "Ducha higiênica", "un", 2, MAT),
        ("acab-registro", "Acabamento de registro", "un", 10, MAT),
        ("sifao", "Sifão", "un", 4, MAT),
        ("flexivel", "Flexível/engate", "un", 8, MAT),
        ("acessorios", "Kit de acessórios de banheiro", "cj", 2, MAT),
        ("modulo", "Módulos de tomada e interruptor", "un", 65, MAT),
        ("placa", "Placas 4×2 e 4×4", "un", 60, MAT),
        ("luminaria", "Luminárias/plafons", "un", 18, MAT),
        ("lampada", "Lâmpadas LED", "un", 22, MAT),
    ],
    "PIN": [
        ("selador", "Selador acrílico (lata 18 L)", "lata", 9, MAT),
        ("massa-corrida", "Massa corrida PVA (lata 25 kg) — áreas secas", "lata", 22, MAT),
        ("massa-acrilica", "Massa acrílica (lata 25 kg) — áreas úmidas e externas", "lata", 5, MAT),
        ("tinta-int", "Tinta acrílica interna (lata 18 L)", "lata", 5, MAT),
        ("tinta-ext", "Tinta acrílica externa (lata 18 L)", "lata", 2, MAT),
        ("esmalte", "Esmalte/verniz para portas e madeiras (galão 3,6 L)", "galão", 4, MAT),
        ("lixa", "Lixa para massa", "un", 100, MAT),
        ("fita-crepe", "Fita crepe", "rolo", 20, MAT),
        ("rolos", "Rolos, pincéis e bandejas", "cj", 3, MAT),
        ("lona", "Lona plástica de proteção", "m²", 100, MAT),
    ],
    "EXT": [
        ("bloco-concreto", "Bloco de concreto 14×19×39 cm (muro)", "un", 1000, MAT),
        ("concreto", "Concreto fck 20 MPa (fundação do muro)", "m³", 3, MAT),
        ("aco8", "Aço CA-50 8 mm (cintas e colunas do muro)", "kg", 150, MAT),
        ("cimento", "Cimento CP-II 50 kg", "sc", 30, MAT),
        ("areia", "Areia média", "m³", 4, MAT),
        ("brita", "Brita 1", "m³", 3, MAT),
        ("calcada", "Concreto para calçada (e = 7 cm)", "m³", 2, MAT),
        ("portao-garagem", "Portão de garagem", "un", 1, MAT),
        ("portao-social", "Portão social", "un", 1, MAT),
        ("grama", "Grama em placas", "m²", 60, MAT),
        ("dreno", "Tubo dreno com manta geotêxtil", "m", 20, MAT),
        ("caixa-correio", "Caixa de correio e número do imóvel", "cj", 1, MAT),
    ],
    "ENT": [
        ("cacamba", "Caçamba de entulho 5 m³", "un", 3, SRV),
        ("limpeza", "Produtos de limpeza pós-obra", "cj", 2, MAT),
        ("sacos", "Sacos de ráfia para entulho", "un", 50, MAT),
    ],
}

# unidades compradas inteiras (arredonda para cima)
UNIDADES_INTEIRAS = {"un", "sc", "lata", "galão", "rolo", "cj", "pç", "barra", "cx", "pct", "mês", "vb", "dia", "h"}

MATERIAIS: dict[str, list[dict]] = {
    etapa: [
        {"chave": f"{etapa}:{chave}", "material": desc, "un": un, "qtd": float(qtd), "categoria": cat}
        for chave, desc, un, qtd, cat in itens
    ]
    for etapa, itens in _LISTA.items()
}


def materiais_da_etapa(codigo: str) -> list[dict]:
    return MATERIAIS.get(codigo, [])


def material(chave: str) -> dict:
    etapa = chave.split(":", 1)[0]
    for m in MATERIAIS.get(etapa, []):
        if m["chave"] == chave:
            return m
    raise KeyError(chave)


def quantidade(qtd_ref: float, un: str, area: float) -> float:
    """Quantidade para a área da obra (referência = 100 m²), arredondada
    para cima no formato de compra."""
    v = qtd_ref * (area or 100) / 100
    if un in UNIDADES_INTEIRAS:
        return float(max(1, math.ceil(v - 1e-9)))
    if v >= 10:
        return float(math.ceil(v - 1e-9))
    return math.ceil(v * 10 - 1e-9) / 10


def validar() -> list[str]:
    from .etapas import CODIGOS
    from .modelos import CATEGORIAS_COMPRA, UNIDADES

    problemas = []
    for etapa, itens in MATERIAIS.items():
        if etapa not in CODIGOS:
            problemas.append(f"Etapa inexistente: {etapa}")
        chaves = [m["chave"] for m in itens]
        if len(chaves) != len(set(chaves)):
            problemas.append(f"{etapa}: chave repetida")
        for m in itens:
            if m["un"] not in UNIDADES:
                problemas.append(f"{m['chave']}: unidade fora da lista ({m['un']})")
            if m["categoria"] not in CATEGORIAS_COMPRA:
                problemas.append(f"{m['chave']}: categoria inválida")
            if not m["qtd"] > 0:
                problemas.append(f"{m['chave']}: quantidade inválida")
    for cod in CODIGOS:
        if not MATERIAIS.get(cod):
            problemas.append(f"Etapa sem materiais: {cod}")
    return problemas
