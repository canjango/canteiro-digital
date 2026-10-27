"""Imagem de referência para cada item de checklist das etapas.

Cada item do catálogo aponta para um modelo de desenho (cena) com os textos
e cotas daquele item. Os desenhos são esquemáticos, originais e gerados em
Python (SVG), no tamanho de um cartão: abrem num botão ao lado do item.
"""

from __future__ import annotations

from .detalhes import D

W, H = 360, 220


def _d(pref: str) -> D:
    return D(pref, W, H)


# ============================================================ modelos de cena
def documento(p, titulo, linhas, carimbo="OK"):
    d = _d(p)
    d.ret(110, 18, 140, 186, "dt-papel", 4)
    d.txt(180, 42, titulo, "middle", "dt-txt-forte")
    for i in range(6):
        d.lin(126, 62 + i * 18, 234 - (i % 3) * 18, 62 + i * 18, "dt-fina")
    d.ret(160, 160, 84, 30, "dt-carimbo", 4)
    d.txt(202, 180, carimbo, "middle", "dt-txt-carimbo")
    for i, t in enumerate(linhas):
        d.txt(14 if i % 2 == 0 else 346, 60 + i * 34, t, "start" if i % 2 == 0 else "end", "dt-txt-peq")
    return d


def nivelamento(p, superficie, tolerancia, extra=""):
    d = _d(p)
    d.pad(20, 140, 320, 30, "concreto")
    d.ret(110, 112, 140, 22, "dt-instrumento", 4)
    d.ret(168, 117, 24, 12, "dt-bolha", 6)
    d.circ(180, 123, 4, "dt-ponto-agua")
    d.lin(30, 104, 330, 104, "dt-laser")
    d.txt(330, 98, "linha de nível / laser", "end", "dt-txt-suave")
    d.txt(180, 190, superficie, "middle")
    d.txt(180, 30, tolerancia, "middle", "dt-txt-cota")
    if extra:
        d.txt(180, 50, extra, "middle", "dt-txt-suave")
    return d


def prumo(p, elemento, tolerancia, padrao="tijolo"):
    d = _d(p)
    d.pad(150, 20, 70, 180, padrao)
    d.lin(240, 22, 240, 168, "dt-fio-prumo")
    d.pol([(232, 168), (248, 168), (240, 186)], "dt-prumo")
    d.lin(220, 22, 240, 22, "dt-fina")
    d.cota_h(220, 240, 60, "")
    d.txt(250, 64, "afastamento igual", "start", "dt-txt-peq")
    d.txt(250, 78, "em cima e embaixo", "start", "dt-txt-peq")
    d.txt(20, 40, elemento, "start", "dt-txt-forte")
    d.txt(20, 200, tolerancia, "start", "dt-txt-cota")
    return d


def esquadro(p, titulo, nota):
    d = _d(p)
    d.ret(60, 40, 240, 130, "dt-linha")
    d.lin(60, 40, 300, 170, "dt-diagonal")
    d.lin(300, 40, 60, 170, "dt-diagonal")
    d.txt(180, 100, "D1 = D2", "middle", "dt-txt-forte")
    d.txt(180, 26, titulo, "middle")
    d.txt(180, 200, nota, "middle", "dt-txt-cota")
    return d


def camadas(p, itens, titulo="", cota=""):
    """itens: lista (texto, padrão, espessura em px) de cima para baixo."""
    d = _d(p)
    y = 40
    for t, pad, e in itens:
        d.pad(30, y, 130, e, pad)
        d.nota(150, y + e / 2, 172, y + e / 2 + 4, t)
        y += e
    if titulo:
        d.txt(20, 22, titulo, "start", "dt-txt-forte")
    if cota:
        d.txt(20, 210, cota, "start", "dt-txt-cota")
    return d


def teste_agua(p, titulo, criterio, tempo):
    d = _d(p)
    d.pad(30, 150, 300, 30, "concreto")
    d.ret(40, 128, 280, 22, "dt-agua-fill")
    d.lin(40, 128, 320, 128, "dt-agua")
    d.lin(30, 120, 30, 180); d.lin(330, 120, 330, 180)
    d.cota_v(345, 128, 150, "5 cm", -1)
    d.circ(290, 70, 26, "dt-relogio")
    d.lin(290, 70, 290, 52, "dt-linha"); d.lin(290, 70, 304, 76, "dt-linha")
    d.txt(290, 112, tempo, "middle", "dt-txt-cota")
    d.txt(20, 30, titulo, "start", "dt-txt-forte")
    d.txt(20, 205, criterio, "start", "dt-txt-peq")
    return d


def teste_pressao(p, titulo, criterio):
    d = _d(p)
    d.lin(30, 130, 330, 130, "dt-tubo-grosso")
    d.lin(180, 130, 180, 92, "dt-tubo-grosso")
    d.circ(180, 70, 26, "dt-relogio")
    d.cam([(166, 82), (180, 70), (196, 60)], "dt-linha")
    d.txt(180, 40, "manômetro", "middle", "dt-txt-peq")
    d.ret(30, 120, 14, 20, "dt-tampao"); d.ret(316, 120, 14, 20, "dt-tampao")
    d.txt(20, 22, titulo, "start", "dt-txt-forte")
    d.txt(20, 170, criterio, "start", "dt-txt-cota")
    d.txt(20, 190, "pontos tampados, rede cheia, sem ar", "start", "dt-txt-peq")
    return d


def alturas(p, pontos, titulo):
    d = _d(p)
    d.pad(20, 190, 320, 14, "concreto")
    d.lin(20, 190, 340, 190)
    n = len(pontos)
    for i, (t, h) in enumerate(pontos):
        x = 40 + i * (280 / max(1, n - 1)) if n > 1 else 180
        y = 190 - h * 70
        d.lin(x, 190, x, y, "dt-agua")
        d.circ(x, y, 4, "dt-ponto-agua")
        d.txt(x, y - 8, t, "middle", "dt-txt-peq")
    d.txt(20, 18, titulo, "start", "dt-txt-forte")
    return d


def caimento(p, titulo, valor, destino):
    d = _d(p)
    d.pad(20, 160, 320, 30, "concreto")
    d.pol([(20, 132), (300, 150), (340, 150), (340, 160), (20, 160)], "dt-linha", "arg")
    d.ret(296, 148, 26, 12, "dt-ralo")
    d.txt(309, 140, destino, "middle", "dt-txt-peq")
    d.cam([(60, 120), (240, 132)], "dt-cota")
    d.pol([(240, 132), (230, 126), (229, 135)], "dt-seta-fill")
    d.txt(150, 112, valor, "middle", "dt-txt-cota")
    d.txt(20, 26, titulo, "start", "dt-txt-forte")
    d.txt(20, 210, "confira com nível ou mangueira antes de seguir", "start", "dt-txt-suave")
    return d


def junta(p, titulo, valor, padrao="tijolo"):
    d = _d(p)
    for i in range(3):
        d.pad(30 + i * 104, 70, 96, 46, padrao)
        d.pad(30 + i * 104 + (52 if i < 2 else 0), 124, 96 if i < 2 else 44, 46, padrao)
    d.cota_h(126, 134, 56, valor)
    d.cota_v(340, 116, 124, valor, -1)
    d.txt(20, 26, titulo, "start", "dt-txt-forte")
    d.txt(20, 205, "juntas cheias, alinhadas e com espessura constante", "start", "dt-txt-peq")
    return d


def armadura(p, titulo, barras, estribo, cobrimento):
    d = _d(p)
    d.pad(40, 40, 140, 140, "concreto")
    d.ret(58, 58, 104, 104, "dt-estribo")
    for x, y in ((66, 66), (154, 66), (66, 154), (154, 154)):
        d.circ(x, y, 5)
    d.ret(100, 162, 20, 18, "dt-espacador", 3)
    d.cota_h(40, 58, 200, "")
    d.txt(20, 22, titulo, "start", "dt-txt-forte")
    d.txt(20, 214, f"cobrimento: {cobrimento}", "start", "dt-txt-cota")
    d.nota(154, 66, 200, 70, barras)
    d.nota(162, 110, 200, 110, estribo)
    d.nota(110, 172, 200, 160, "espaçador plástico")
    return d


def concreto_recebimento(p, titulo, linhas):
    d = _d(p)
    d.pol([(60, 170), (100, 170), (90, 90), (70, 90)], "dt-linha", "concreto")
    d.pol([(130, 170), (170, 170), (164, 120), (136, 120)], "dt-linha", "concreto")
    d.cota_v(185, 90, 120, "slump", 1)
    d.txt(80, 190, "cone", "middle", "dt-txt-peq")
    d.txt(150, 190, "concreto", "middle", "dt-txt-peq")
    d.ret(240, 50, 100, 130, "dt-papel", 4)
    d.txt(290, 70, "nota fiscal", "middle", "dt-txt-forte")
    for i, t in enumerate(linhas):
        d.txt(250, 94 + i * 20, t, "start", "dt-txt-peq")
    d.txt(20, 22, titulo, "start", "dt-txt-forte")
    return d


def corpos_prova(p):
    d = _d(p)
    for i in range(4):
        x = 60 + i * 70
        d.ret(x, 80, 40, 90, "dt-linha-fill", 3)
        d.pad(x, 80, 40, 90, "concreto")
        d.txt(x + 20, 190, f"CP {i + 1}", "middle", "dt-txt-peq")
    d.cota_v(330, 80, 170, "20 cm", -1)
    d.cota_h(60, 100, 66, "10 cm")
    d.txt(20, 22, "Corpos de prova por caminhão", "start", "dt-txt-forte")
    d.txt(20, 210, "identifique local e data; rompimento aos 7 e 28 dias", "start", "dt-txt-cota")
    return d


def tempo(p, titulo, dias, texto, padrao="arg"):
    d = _d(p)
    d.pad(20, 150, 180, 40, padrao)
    d.ret(230, 40, 110, 110, "dt-papel", 6)
    d.ret(230, 40, 110, 26, "dt-cabecalho", 6)
    d.txt(285, 58, "calendário", "middle", "dt-txt-peq")
    d.txt(285, 112, dias, "middle", "dt-txt-grande")
    d.txt(285, 136, "dias", "middle", "dt-txt-peq")
    d.txt(20, 26, titulo, "start", "dt-txt-forte")
    d.txt(20, 210, texto, "start", "dt-txt-cota")
    return d


def escoras(p, titulo, nota):
    d = _d(p)
    d.pad(20, 50, 320, 20, "concreto")
    d.lin(20, 70, 340, 70, "dt-guia")
    for x in (50, 140, 230, 320):
        d.lin(x, 70, x, 180, "dt-escora")
        d.lin(x - 12, 180, x + 12, 180)
        d.ret(x - 14, 180, 28, 6, "dt-base")
    d.cota_h(50, 140, 198, "1,0–1,3 m")
    d.txt(20, 26, titulo, "start", "dt-txt-forte")
    d.txt(200, 120, nota, "middle", "dt-txt-suave")
    return d


def parede_vao(p, titulo, cota1, cota2, verga=False):
    d = _d(p)
    d.pad(30, 20, 300, 180, "tijolo")
    d.ret(120, 60, 110, 100, "dt-vao")
    if verga:
        d.pad(90, 46, 170, 14, "concreto")
        d.pad(90, 160, 170, 14, "concreto")
        d.cota_h(90, 120, 38, "30 cm")
        d.cota_h(230, 260, 38, "30 cm")
    d.cota_h(120, 230, 116 if verga else 52, cota1)
    d.cota_v(250 if not verga else 290, 60, 160, cota2)
    d.txt(20, 214, titulo, "start", "dt-txt-forte")
    return d


def fiada(p, titulo, nota):
    d = _d(p)
    d.pad(20, 150, 320, 30, "concreto")
    d.cam([(20, 150), (340, 150)], "dt-imperm")
    for i in range(6):
        d.pad(28 + i * 52, 124, 48, 26, "tijolo")
    d.lin(20, 118, 340, 118, "dt-laser")
    d.txt(330, 112, "linha esticada", "end", "dt-txt-suave")
    d.txt(20, 26, titulo, "start", "dt-txt-forte")
    d.txt(20, 205, nota, "start", "dt-txt-cota")
    return d


def tela_amarracao(p):
    d = _d(p)
    d.pad(40, 20, 50, 180, "concreto")
    d.pad(90, 20, 240, 180, "tijolo")
    for y in (40, 68, 96, 124, 152, 180):
        if y in (40, 96, 152):
            d.lin(70, y, 140, y, "dt-tela-amarr")
    d.txt(150, 64, "tela a cada 2 fiadas", "start", "dt-txt-cota")
    d.txt(150, 82, "metade no pilar, metade na junta", "start", "dt-txt-peq")
    d.txt(20, 214, "Amarração alvenaria × pilar", "start", "dt-txt-forte")
    return d


def rasgos(p):
    d = _d(p)
    d.pad(30, 30, 300, 160, "tijolo")
    d.ret(90, 30, 14, 160, "dt-rasgo-ok")
    d.txt(97, 22, "vertical: OK", "middle", "dt-txt-cota")
    d.ret(170, 110, 140, 12, "dt-rasgo-nao")
    d.lin(170, 104, 310, 128, "dt-x"); d.lin(170, 128, 310, 104, "dt-x")
    d.txt(240, 98, "horizontal longo: evitar", "middle", "dt-txt-alerta")
    d.txt(20, 212, "Rasgos marcados com régua antes de cortar", "start", "dt-txt-forte")
    return d


def encunhamento(p):
    d = _d(p)
    d.pad(30, 30, 300, 30, "concreto")
    d.pad(30, 72, 300, 120, "tijolo")
    d.ret(30, 60, 300, 12, "dt-encunha")
    d.nota(180, 66, 120, 100, "encunhamento (argamassa expansiva)")
    d.txt(20, 22, "viga / laje", "start", "dt-txt-peq")
    d.txt(20, 212, "executar ≥ 7 dias após a alvenaria e com a estrutura carregada", "start", "dt-txt-cota")
    return d


def telhado(p, titulo, destaque, nota):
    d = _d(p)
    d.pol([(30, 170), (180, 60), (330, 170)], "dt-linha")
    d.lin(180, 60, 180, 170, "dt-fina")
    d.cam([(14, 180), (30, 170), (180, 60)], "dt-telha")
    if destaque == "inclinacao":
        d.cam([(220, 90), (270, 90), (270, 127)], "dt-cota")
        d.txt(276, 112, "30–35%", "start", "dt-txt-cota")
    elif destaque == "manta":
        d.cam([(34, 174), (178, 66)], "dt-manta")
    elif destaque == "cumeeira":
        d.circ(180, 60, 9, "dt-destaque")
    elif destaque == "calha":
        d.ret(4, 176, 18, 12, "dt-calha")
        d.lin(13, 188, 13, 210, "dt-tubo-grosso")
    elif destaque == "beiral":
        d.circ(22, 176, 12, "dt-destaque")
    elif destaque == "agua":
        for x in (60, 100, 140):
            d.lin(x - 20, 40, x, 90 + (x - 60) * -0.2, "dt-agua")
    elif destaque == "estrutura":
        d.lin(105, 115, 180, 170, "dt-fina"); d.lin(255, 115, 180, 170, "dt-fina")
    elif destaque == "telhas":
        for i in range(5):
            d.circ(50 + i * 26, 155 - i * 19, 3, "dt-ripa")
    d.txt(20, 22, titulo, "start", "dt-txt-forte")
    d.txt(20, 210, nota, "start", "dt-txt-cota")
    return d


def madeira(p):
    d = _d(p)
    d.pad(40, 80, 280, 50, "madeira")
    d.txt(180, 110, "madeira tratada (autoclave) e seca", "middle", "dt-txt-peq")
    d.circ(300, 60, 18, "dt-destaque")
    d.txt(300, 64, "U%", "middle", "dt-txt-peq")
    d.txt(20, 26, "Madeira do telhado", "start", "dt-txt-forte")
    d.txt(20, 170, "sem cupim, fendas ou empeno; umidade abaixo de 20%", "start", "dt-txt-cota")
    d.txt(20, 190, "aplicar imunizante nos cortes feitos na obra", "start", "dt-txt-peq")
    return d


def tubos_parede(p, titulo, nota, tipo="agua"):
    d = _d(p)
    d.pad(30, 22, 300, 170, "tijolo")
    for x in (110, 150):
        d.lin(x, 192, x, 50, "dt-agua" if tipo == "agua" else "dt-eletroduto")
    d.cam([(110, 50), (200, 50)], "dt-agua" if tipo == "agua" else "dt-eletroduto")
    d.ret(195, 40, 18, 18, "dt-caixa")
    d.txt(20, 14, titulo, "start", "dt-txt-forte")
    d.txt(20, 214, nota, "start", "dt-txt-cota")
    return d


def esgoto(p, titulo, nota):
    d = _d(p)
    d.pad(20, 60, 320, 140, "solo", False)
    d.lin(20, 60, 340, 60)
    d.cam([(40, 100), (320, 130)], "dt-esgoto")
    d.ret(300, 110, 40, 40, "dt-caixa")
    d.txt(320, 165, "caixa", "middle", "dt-txt-peq")
    d.txt(180, 98, "1% (Ø 100) a 2% (Ø 40/50)", "middle", "dt-txt-cota")
    d.txt(20, 26, titulo, "start", "dt-txt-forte")
    d.txt(20, 214, nota, "start", "dt-txt-peq")
    return d


def ventilacao(p):
    d = _d(p)
    d.pol([(40, 120), (180, 50), (320, 120)], "dt-linha")
    d.lin(250, 200, 250, 40, "dt-esgoto")
    d.txt(258, 40, "≥ 30 cm acima", "start", "dt-txt-cota")
    d.txt(258, 54, "do telhado", "start", "dt-txt-cota")
    d.cam([(80, 200), (250, 190)], "dt-esgoto")
    d.txt(20, 26, "Coluna de ventilação Ø 50 mm", "start", "dt-txt-forte")
    d.txt(20, 214, "sem ventilação: mau cheiro e ralo borbulhando", "start", "dt-txt-peq")
    return d


def caixa_dagua(p):
    d = _d(p)
    d.pol([(100, 60), (260, 60), (250, 160), (110, 160)], "dt-caixa-agua")
    d.pad(90, 160, 180, 14, "concreto")
    d.lin(260, 150, 330, 150, "dt-agua"); d.txt(330, 144, "saída + registro", "end", "dt-txt-peq")
    d.lin(30, 80, 100, 80, "dt-agua"); d.txt(30, 74, "entrada + boia", "start", "dt-txt-peq")
    d.lin(260, 72, 330, 72, "dt-fina"); d.txt(330, 66, "extravasor", "end", "dt-txt-peq")
    d.txt(20, 26, "Caixa d'água 1.000 L", "start", "dt-txt-forte")
    d.txt(20, 200, "base plana dimensionada para ≈ 1 tonelada", "start", "dt-txt-cota")
    return d


def fossa(p):
    d = _d(p)
    d.pad(20, 60, 320, 140, "solo", False)
    d.lin(20, 60, 340, 60)
    for x, t in ((40, "fossa"), (150, "filtro"), (260, "sumidouro")):
        d.ret(x, 80, 70, 90, "dt-caixa")
        d.txt(x + 35, 190, t, "middle", "dt-txt-peq")
    d.lin(110, 100, 150, 100, "dt-esgoto"); d.lin(220, 100, 260, 100, "dt-esgoto")
    d.txt(20, 26, "Sem rede pública: fossa, filtro e sumidouro", "start", "dt-txt-forte")
    d.txt(20, 214, "dimensionar pela NBR 7229 / 13969", "start", "dt-txt-cota")
    return d


def padrao_entrada(p):
    d = _d(p)
    d.lin(80, 200, 80, 30, "dt-poste")
    d.ret(110, 110, 80, 70, "dt-quadro", 4)
    d.txt(150, 150, "medidor", "middle", "dt-txt-peq")
    d.lin(80, 40, 30, 20, "dt-fina")
    d.lin(150, 180, 150, 205, "dt-terra"); d.txt(160, 208, "aterramento", "start", "dt-txt-peq")
    d.txt(20, 16, "Padrão de entrada", "start", "dt-txt-forte")
    d.txt(210, 120, "conforme norma da", "start", "dt-txt-peq")
    d.txt(210, 136, "concessionária local", "start", "dt-txt-peq")
    return d


def quadro(p, titulo, linhas):
    d = _d(p)
    d.ret(190, 32, 150, 182, "dt-quadro", 4)
    for i, t in enumerate(linhas[:7]):
        y = 42 + i * 24
        d.ret(200, y, 130, 18, "dt-disj", 2)
        d.txt(265, y + 13, t, "middle", "dt-txt-peq")
    d.txt(20, 22, titulo, "start", "dt-txt-forte")
    return d


def fios(p):
    d = _d(p)
    cores = (("fase", "dt-fio-fase"), ("neutro", "dt-fio-neutro"), ("terra", "dt-fio-terra"), ("retorno", "dt-fio-retorno"))
    for i, (t, c) in enumerate(cores):
        y = 60 + i * 34
        d.lin(40, y, 240, y, c)
        d.txt(250, y + 4, t, "start", "dt-txt")
    d.txt(20, 26, "Cores e bitolas padronizadas", "start", "dt-txt-forte")
    d.txt(20, 205, "1,5 mm² iluminação · 2,5 mm² tomadas · 6 mm² chuveiro", "start", "dt-txt-cota")
    return d


def aterramento(p):
    d = _d(p)
    d.pad(20, 80, 320, 120, "solo", False)
    d.lin(20, 80, 340, 80)
    d.lin(120, 60, 120, 190, "dt-haste")
    d.ret(220, 30, 100, 50, "dt-instrumento", 4)
    d.txt(270, 60, "terrômetro", "middle", "dt-txt-peq")
    d.cota_v(100, 80, 190, "2,4 m", -1)
    d.txt(20, 26, "Haste de aterramento", "start", "dt-txt-forte")
    d.txt(150, 140, "medir a resistência e registrar", "start", "dt-txt-cota")
    return d


def teste_eletrico(p, titulo, criterio):
    d = _d(p)
    d.ret(40, 60, 90, 120, "dt-instrumento", 8)
    d.ret(52, 72, 66, 30, "dt-visor", 3)
    d.txt(85, 92, "OK", "middle", "dt-txt-forte")
    d.cam([(130, 150), (200, 150), (240, 110)], "dt-fio-fase")
    d.cam([(130, 165), (210, 165), (250, 120)], "dt-fio-neutro")
    d.ret(236, 90, 40, 40, "dt-caixa")
    d.txt(20, 26, titulo, "start", "dt-txt-forte")
    d.txt(20, 210, criterio, "start", "dt-txt-cota")
    return d


def tomadas(p, titulo, nota):
    d = _d(p)
    d.pad(20, 20, 320, 180, "arg")
    for x, y in ((80, 160), (180, 110), (280, 40)):
        d.ret(x - 14, y - 10, 28, 20, "dt-caixa", 3)
        d.circ(x - 5, y, 2.5, "dt-ponto"); d.circ(x + 5, y, 2.5, "dt-ponto")
    d.txt(80, 186, "0,30 m", "middle", "dt-txt-cota")
    d.txt(180, 136, "1,10 m", "middle", "dt-txt-cota")
    d.txt(280, 66, "2,20 m", "middle", "dt-txt-cota")
    d.txt(20, 14, titulo, "start", "dt-txt-forte")
    d.txt(30, 40, nota, "start", "dt-txt-peq")
    return d


def regua(p, titulo, criterio, padrao="arg"):
    d = _d(p)
    d.pad(20, 120, 320, 50, padrao)
    d.ret(40, 104, 280, 12, "dt-regua", 2)
    d.txt(180, 98, "régua de 2 m", "middle", "dt-txt-peq")
    d.cota_v(330, 116, 120, "≤ 3 mm", -1)
    d.txt(20, 26, titulo, "start", "dt-txt-forte")
    d.txt(20, 200, criterio, "start", "dt-txt-cota")
    return d


def percussao(p, titulo):
    d = _d(p)
    for i in range(4):
        d.pad(30 + i * 76, 120, 72, 40, "ceramica")
    d.cam([(190, 100), (230, 40)], "dt-cabo-martelo")
    d.ret(176, 92, 30, 14, "dt-martelo", 3)
    d.txt(240, 70, "som cheio: OK", "start", "dt-txt-cota")
    d.txt(240, 88, "som cavo: refazer", "start", "dt-txt-alerta")
    d.txt(20, 26, titulo, "start", "dt-txt-forte")
    d.txt(20, 200, "bater de leve com martelo de borracha ou cabo de madeira", "start", "dt-txt-peq")
    return d


def ceramica(p, titulo, nota, padrao="ceramica"):
    d = _d(p)
    for i in range(5):
        for j in range(3):
            d.pad(40 + i * 56, 50 + j * 46, 52, 42, padrao)
    d.txt(20, 26, titulo, "start", "dt-txt-forte")
    d.txt(20, 205, nota, "start", "dt-txt-cota")
    return d


def paginacao(p):
    d = _d(p)
    d.ret(40, 40, 280, 150, "dt-linha")
    for i in range(1, 7):
        d.lin(40 + i * 40, 40, 40 + i * 40, 190, "dt-fina")
    for j in range(1, 4):
        d.lin(40, 40 + j * 37.5, 320, 40 + j * 37.5, "dt-fina")
    d.lin(180, 30, 180, 200, "dt-diagonal")
    d.txt(186, 30, "eixo", "start", "dt-txt-cota")
    d.txt(20, 20, "Paginação aprovada antes de assentar", "start", "dt-txt-forte")
    d.txt(20, 212, "recortes simétricos nas bordas, nunca tiras estreitas", "start", "dt-txt-peq")
    return d


def colagem(p, titulo, nota):
    d = _d(p)
    d.pad(30, 150, 300, 20, "arg")
    for x in range(40, 320, 14):
        d.ret(x, 140, 8, 10, "dt-cordao")
    d.pad(80, 80, 200, 18, "ceramica")
    for x in range(90, 270, 14):
        d.ret(x, 98, 8, 6, "dt-cordao")
    d.txt(20, 26, titulo, "start", "dt-txt-forte")
    d.txt(20, 205, nota, "start", "dt-txt-cota")
    return d


def janela(p, titulo, destaque):
    d = _d(p)
    d.pad(30, 24, 300, 150, "tijolo")
    d.ret(110, 50, 140, 100, "dt-janela")
    d.lin(180, 50, 180, 150, "dt-vidro")
    if destaque == "peitoril":
        d.pol([(100, 150), (264, 150), (264, 160), (100, 158)], "dt-linha", "arg")
        d.txt(180, 196, "caimento para fora + pingadeira", "middle", "dt-txt-cota")
    elif destaque == "selante":
        d.ret(106, 46, 148, 108, "dt-selante")
        d.txt(180, 196, "selante no perímetro externo", "middle", "dt-txt-cota")
    elif destaque == "agua":
        for x in (120, 160, 200, 240):
            d.lin(x + 30, 20, x, 70, "dt-agua")
        d.txt(180, 196, "jato d'água por 5 min: sem infiltração", "middle", "dt-txt-cota")
    elif destaque == "etiqueta":
        d.ret(190, 60, 40, 20, "dt-papel", 2)
        d.txt(210, 74, "selo", "middle", "dt-txt-peq")
        d.txt(180, 196, "retirar a etiqueta só na limpeza final", "middle", "dt-txt-cota")
    d.txt(20, 14, titulo, "start", "dt-txt-forte")
    return d


def porta(p, titulo, nota):
    d = _d(p)
    d.ret(120, 20, 120, 180, "dt-linha")
    d.pad(126, 26, 108, 174, "madeira")
    for y in (40, 110, 180):
        d.ret(122, y, 6, 14, "dt-ferragem")
    d.circ(222, 110, 5, "dt-ferragem")
    d.cota_h(234, 240, 14, "3–5 mm")
    d.txt(20, 40, titulo, "start", "dt-txt-forte")
    d.txt(20, 214, nota, "start", "dt-txt-cota")
    return d


def louca(p, titulo, nota):
    d = _d(p)
    d.pad(20, 196, 320, 10, "concreto")
    d.pad(330, 20, 20, 186, "tijolo")
    d.pad(120, 90, 210, 14, "ceramica")
    d.cam([(170, 104), (180, 130), (240, 130), (250, 104)], "dt-linha")
    d.cam([(210, 130), (210, 160), (240, 160), (240, 150), (330, 150)], "dt-sifao")
    d.cam([(330, 170), (290, 170), (270, 104)], "dt-agua")
    d.txt(20, 26, titulo, "start", "dt-txt-forte")
    d.txt(20, 60, nota, "start", "dt-txt-cota")
    return d


def pintura(p, titulo, etapa_atual, nota):
    d = _d(p)
    passos = ("reboco", "selador", "massa", "tinta")
    for i, t in enumerate(passos):
        x = 30 + i * 80
        cls = "dt-passo-atual" if i == etapa_atual else "dt-caixa-passo"
        d.ret(x, 70, 70, 80, cls, 6)
        d.txt(x + 35, 115, t, "middle", "dt-txt-peq")
    d.txt(20, 26, titulo, "start", "dt-txt-forte")
    d.txt(20, 190, nota, "start", "dt-txt-cota")
    return d


def protecao(p, titulo, nota):
    d = _d(p)
    d.pad(20, 150, 320, 30, "ceramica")
    d.cam([(20, 146), (100, 140), (180, 146), (260, 140), (340, 146)], "dt-lona")
    d.txt(180, 128, "papelão / lona", "middle", "dt-txt-peq")
    d.txt(20, 26, titulo, "start", "dt-txt-forte")
    d.txt(20, 205, nota, "start", "dt-txt-cota")
    return d


def externo(p, titulo, destaque, nota):
    d = _d(p)
    d.pad(20, 160, 320, 36, "solo", False)
    d.lin(20, 160, 340, 160)
    d.pad(40, 70, 120, 90, "tijolo")
    d.pol([(30, 70), (100, 30), (170, 70)], "dt-linha")
    if destaque == "caimento":
        d.cam([(170, 156), (320, 166)], "dt-cota")
        d.txt(250, 150, "≥ 2% para longe da casa", "middle", "dt-txt-cota")
    elif destaque == "muro":
        d.pad(220, 70, 20, 90, "tijolo"); d.pad(214, 62, 32, 10, "concreto")
        d.txt(250, 90, "muro + portão", "start", "dt-txt-peq")
    elif destaque == "calcada":
        d.pad(190, 154, 150, 8, "concreto")
        d.txt(265, 146, "faixa livre ≥ 1,20 m", "middle", "dt-txt-cota")
    elif destaque == "ligacoes":
        for x, c in ((200, "dt-agua"), (240, "dt-esgoto"), (280, "dt-fio-fase")):
            d.lin(x, 120, x, 200, c)
        d.txt(240, 110, "água · esgoto · energia", "middle", "dt-txt-peq")
    elif destaque == "paisagismo":
        for x in (200, 250, 300):
            d.circ(x, 140, 16, "dt-planta")
    elif destaque == "numero":
        d.ret(200, 90, 60, 36, "dt-placa-num", 4)
        d.txt(230, 114, "123", "middle", "dt-txt-forte")
    d.txt(20, 16, titulo, "start", "dt-txt-forte")
    d.txt(20, 214, nota, "start", "dt-txt-peq")
    return d


def lista(p, titulo, itens, rodape=""):
    d = _d(p)
    d.ret(80, 20, 200, 180, "dt-papel", 6)
    d.txt(180, 42, titulo, "middle", "dt-txt-forte")
    for i, t in enumerate(itens[:6]):
        y = 66 + i * 22
        d.ret(94, y - 10, 12, 12, "dt-check", 2)
        d.cam([(96, y - 4), (100, y), (104, y - 9)], "dt-check-marca")
        d.txt(114, y, t, "start", "dt-txt-peq")
    if rodape:
        d.txt(180, 214, rodape, "middle", "dt-txt-cota")
    return d


def canteiro(p, titulo, destaque):
    d = _d(p)
    d.pad(20, 180, 320, 20, "solo", False)
    d.lin(20, 180, 340, 180)
    d.pad(20, 100, 120, 80, "madeira")
    d.txt(80, 94, "tapume ≥ 2,20 m", "middle", "dt-txt-peq")
    d.ret(170, 110, 90, 70, "dt-caixa", 2)
    d.pol([(165, 110), (215, 84), (265, 110)], "dt-linha")
    d.txt(215, 150, "barracão", "middle", "dt-txt-peq")
    d.ret(280, 60, 60, 40, "dt-papel", 2)
    d.lin(310, 100, 310, 180, "dt-fina")
    d.txt(310, 84, "placa", "middle", "dt-txt-peq")
    if destaque == "sanitario":
        d.circ(215, 140, 22, "dt-destaque")
        d.txt(215, 206, "sanitário, lavatório e água potável", "middle", "dt-txt-cota")
    elif destaque == "energia":
        d.lin(270, 180, 270, 120, "dt-poste")
        d.ret(258, 140, 24, 20, "dt-quadro", 2)
        d.txt(180, 206, "padrão provisório com DR + cavalete de água", "middle", "dt-txt-cota")
    d.txt(20, 22, titulo, "start", "dt-txt-forte")
    return d


def terreno(p, titulo, destaque, nota):
    d = _d(p)
    if destaque == "topografia":
        for i, r in enumerate((30, 55, 80, 105)):
            d.el.append(f'<ellipse cx="180" cy="115" rx="{r * 1.4}" ry="{r * 0.7}" class="dt-curva"/>')
            d.txt(180 + r * 1.4 - 4, 115, f"{100 + i}", "end", "dt-txt-peq")
        d.circ(60, 190, 5, "dt-rn")
        d.txt(70, 194, "RN", "start", "dt-txt-peq")
    elif destaque == "sondagem":
        d.pad(150, 40, 60, 160, "solo", False)
        d.lin(180, 30, 180, 200, "dt-haste")
        for i, n in enumerate((4, 7, 12, 18, 25)):
            d.txt(220, 60 + i * 30, f"{i + 1} m · N = {n}", "start", "dt-txt-peq")
    elif destaque == "limpeza":
        d.pad(20, 120, 320, 80, "solo", False)
        d.pad(20, 100, 160, 20, "madeira")
        d.lin(180, 120, 340, 120)
        d.cota_v(190, 100, 120, "≈ 20 cm", 1)
        d.txt(100, 94, "camada orgânica", "middle", "dt-txt-peq")
    elif destaque == "talude":
        d.pol([(20, 60), (140, 60), (140, 200), (20, 200)], "dt-sem", "solo")
        for y in (80, 120, 160):
            d.lin(140, y, 200, y, "dt-escora")
        d.ret(196, 70, 10, 110, "dt-base")
        d.txt(220, 120, "pranchas + estroncas", "start", "dt-txt-peq")
    elif destaque == "drenagem":
        d.pad(20, 120, 320, 80, "solo", False)
        d.lin(20, 120, 340, 120)
        d.cam([(40, 120), (60, 140), (300, 150), (320, 120)], "dt-agua")
        d.txt(180, 170, "canaleta provisória → saída", "middle", "dt-txt-peq")
    elif destaque == "valas":
        d.pad(20, 100, 320, 100, "solo", False)
        d.ret(120, 100, 80, 70, "dt-vazio")
        d.cam([(120, 100), (120, 170), (200, 170), (200, 100)])
        d.lin(160, 30, 160, 100, "dt-fio")
        d.txt(166, 40, "linha do gabarito = eixo", "start", "dt-txt-peq")
    elif destaque == "fundo":
        d.pad(20, 100, 320, 100, "solo", False)
        d.ret(110, 100, 140, 70, "dt-vazio")
        d.cam([(110, 100), (110, 170), (250, 170), (250, 100)])
        d.ret(150, 130, 60, 22, "dt-instrumento", 4)
        d.txt(180, 190, "fundo plano e apiloado", "middle", "dt-txt-peq")
    elif destaque == "aterro":
        for i in range(4):
            d.pad(40, 70 + i * 30, 200, 30, "solo")
        d.cota_v(260, 70, 100, "≤ 20 cm")
    elif destaque == "cortes":
        d.pol([(20, 200), (20, 120), (150, 120), (210, 90), (340, 90), (340, 200)], "dt-sem", "solo")
        d.cam([(20, 140), (340, 140)], "dt-laser")
        d.txt(330, 134, "cota do projeto", "end", "dt-txt-suave")
    elif destaque == "rn":
        d.pad(20, 150, 320, 50, "solo", False)
        d.ret(60, 100, 20, 50, "dt-caixa")
        d.circ(70, 96, 6, "dt-rn")
        d.lin(70, 96, 300, 96, "dt-laser")
        d.txt(90, 90, "RN = 0,00 (fixo e protegido)", "start", "dt-txt-cota")
    d.txt(20, 22, titulo, "start", "dt-txt-forte")
    d.txt(20, 214, nota, "start", "dt-txt-peq")
    return d


# ============================================================ mapa item → cena
def _m(fn, *args, **kw):
    return (fn, args, kw)


FIGURAS: dict[str, tuple] = {
    # ------------------------------------------------------------ PRE
    "Matrícula do imóvel e documentação do terreno conferidas": _m(documento, "Matrícula", ["confira titular", "área e medidas", "ônus e restrições", "recuos do loteamento"]),
    "Levantamento planialtimétrico do terreno": _m(terreno, "Planialtimétrico", "topografia", "curvas de nível, divisas, RN e árvores"),
    "Projetos executivos compatibilizados (arquitetura, estrutura, hidráulica e elétrica)": _m(lista, "Compatibilização", ["arquitetura", "estrutura", "hidráulica", "elétrica", "sem interferências"], "sobrepor as pranchas antes de construir"),
    "Alvará de construção emitido": _m(documento, "Alvará", ["prefeitura", "projeto aprovado", "manter na obra", "validade em dia"], "APROVADO"),
    "ART/RRT de projeto e execução registrada": _m(documento, "ART / RRT", ["projeto", "execução", "CREA / CAU", "taxa paga"], "REGISTRADA"),
    "Obra cadastrada no CNO (Receita Federal)": _m(documento, "CNO", ["Receita Federal", "até 30 dias do início", "base da CND final", "guarde o número"], "CNO"),
    "Sondagem SPT realizada e laudo arquivado": _m(terreno, "Sondagem SPT", "sondagem", "N = golpes por camada: define a fundação"),
    "Limpeza e regularização do terreno": _m(terreno, "Limpeza do terreno", "limpeza", "remover vegetação, raízes e entulho"),
    "Ligação provisória de água e energia": _m(canteiro, "Ligações provisórias", "energia"),
    "Tapume, barracão e placa de obra instalados": _m(canteiro, "Canteiro de obras", ""),
    "Banheiro e água potável para a equipe (NR-18)": _m(canteiro, "Área de vivência (NR-18)", "sanitario"),
    "Locação da obra (gabarito) conferida com o projeto": _m(esquadro, "Gabarito: eixos e esquadro", "diagonais iguais (± 1 cm) e recuos conferidos"),
    # ------------------------------------------------------------ TER
    "Nível de referência (RN) definido e marcado": _m(terreno, "Nível de referência", "rn", "todas as cotas da obra partem do RN"),
    "Cortes e aterros conforme níveis do projeto": _m(terreno, "Cortes e aterros", "cortes", "conferir cotas com nível a laser ou mangueira"),
    "Aterro compactado em camadas de até 20 cm": _m(terreno, "Aterro em camadas", "aterro", "compactar cada camada com sapo mecânico"),
    "Escavação das valas de fundação no gabarito": _m(terreno, "Valas pelo gabarito", "valas", "largura do baldrame + 20 cm de folga"),
    "Fundo das valas apiloado e nivelado": _m(terreno, "Fundo da vala", "fundo", "sem água acumulada nem solo solto"),
    "Escoramento de taludes quando necessário": _m(terreno, "Escoramento de talude", "talude", "obrigatório acima de 1,25 m de profundidade (NR-18)"),
    "Drenagem provisória de águas de chuva": _m(terreno, "Drenagem provisória", "drenagem", "não deixar água empoçar nas valas"),
    "Bota-fora com destinação licenciada (CTR)": _m(documento, "CTR", ["caçamba cadastrada", "destino licenciado", "1 CTR por caçamba", "exigido no habite-se"], "CTR"),
    # ------------------------------------------------------------ FUN
    "Escavação/perfuração conforme projeto de fundações": _m(terreno, "Perfuração das estacas", "sondagem", "Ø e profundidade registrados em cada estaca"),
    "Cota de assentamento verificada": _m(nivelamento, "fundo da vala / topo da estaca", "cota conferida a partir do RN", "tolerância: ± 1 cm"),
    "Lastro de concreto magro (5 cm) no fundo das valas": _m(camadas, [("baldrame", "concreto", 50), ("lastro de concreto magro", "arg", 14), ("solo apiloado", "solo", 50)], "Lastro sob o baldrame", "espessura: 5 cm"),
    "Armaduras de blocos e sapatas conferidas": _m(armadura, "Armadura conferida com o projeto", "bitolas e quantidade", "estribos e espaçamento", "3 cm"),
    "Esperas dos pilares posicionadas e travadas": _m(prumo, "Esperas dos pilares", "posição pelo gabarito e travadas antes de concretar", "concreto"),
    "Concreto com fck e slump conferidos na nota fiscal": _m(concreto_recebimento, "Recebimento do concreto", ["fck 25 MPa", "slump 10 ± 2 cm", "hora de saída", "volume (m³)"]),
    "Corpos de prova moldados": _m(corpos_prova),
    "Tubulações de esgoto que atravessam o baldrame deixadas (passantes)": _m(camadas, [("viga baldrame", "concreto", 70), ("passante de PVC 100 mm", "eps", 20), ("viga baldrame", "concreto", 30)], "Passantes antes de concretar", "furar depois enfraquece a viga"),
    "Vigas baldrame executadas e niveladas": _m(nivelamento, "topo da viga baldrame", "tolerância: 5 mm no nível", "alinhada com o gabarito"),
    "Impermeabilização do baldrame": _m(camadas, [("1ª fiada de alvenaria", "tijolo", 40), ("impermeabilização (2–3 demãos)", "eps", 8), ("viga baldrame", "concreto", 60)], "Impermeabilização do baldrame", "topo + 15 cm nas laterais"),
    "Reaterro e apiloamento interno após o baldrame": _m(terreno, "Reaterro interno", "aterro", "solo limpo, camadas compactadas até a cota do contrapiso"),
    # ------------------------------------------------------------ EST
    "Fôrmas no prumo, nível e esquadro": _m(prumo, "Fôrmas", "desvio máximo: 5 mm", "madeira"),
    "Armaduras e cobrimentos conferidos (espaçadores)": _m(armadura, "Cobrimento garantido", "barras conforme projeto", "estribos amarrados", "2,5 cm"),
    "Pilares executados conforme projeto estrutural": _m(armadura, "Pilar (seção típica 14×30)", "4 Ø 10 mm", "estribo Ø 5 c/ 15 cm", "2,5 cm"),
    "Vigas/cintas de respaldo concretadas": _m(camadas, [("cinta de respaldo 14×20", "concreto", 40), ("alvenaria", "tijolo", 80)], "Cinta no topo das paredes", "contínua em todo o perímetro"),
    "Escoramento conferido antes da concretagem": _m(escoras, "Escoramento da laje", "base firme + travamento"),
    "Laje treliçada com vigotas, EPS/lajotas e capa conferidas": _m(camadas, [("capa 4 cm + tela Q-92", "concreto", 24), ("EPS entre vigotas", "eps", 40), ("vigota treliçada", "concreto", 12)], "Laje treliçada", "altura total ≈ 12 cm"),
    "Passagens de instalações deixadas nas lajes e vigas": _m(tubos_parede, "Passagens antes da concretagem", "caixas e eletrodutos fixados na fôrma", "eletrica"),
    "Concretagem com adensamento por vibrador": _m(concreto_recebimento, "Adensamento", ["vibrar em pontos", "a cada 30–50 cm", "sem tocar a armadura", "até parar de sair bolha"]),
    "Cura úmida mínima de 7 dias": _m(tempo, "Cura úmida", "7", "molhar várias vezes ao dia ou cobrir com manta úmida", "concreto"),
    "Desforma dentro dos prazos de projeto": _m(escoras, "Desforma e retirada de escoras", "laje: ≥ 21 dias, do meio para os apoios"),
    # ------------------------------------------------------------ ALV
    "Marcação da primeira fiada conferida": _m(fiada, "Primeira fiada", "medidas, esquadro e vãos conferidos antes de subir"),
    "Impermeabilização das 3 primeiras fiadas (argamassa com aditivo)": _m(fiada, "Primeiras 3 fiadas impermeabilizadas", "argamassa com aditivo impermeabilizante"),
    "Prumo, nível e alinhamento das fiadas": _m(prumo, "Alvenaria", "desvio máximo: 3 mm por metro"),
    "Juntas de 10 mm preenchidas (horizontais e verticais)": _m(junta, "Juntas de assentamento", "10 mm"),
    "Amarração alvenaria x pilar (tela ou ferro-cabelo)": _m(tela_amarracao),
    "Vãos de portas e janelas conferidos com o projeto (largura e altura)": _m(parede_vao, "Vãos conferidos com o projeto", "largura", "altura"),
    "Vergas e contravergas em todos os vãos": _m(parede_vao, "Verga e contraverga: 30 cm além do vão", "vão", "", verga=True),
    "Contramarcos/batentes chumbados no prumo": _m(prumo, "Batente / contramarco", "prumo e esquadro antes de chumbar", "madeira"),
    "Shafts e rasgos para instalações marcados (sem cortes horizontais longos)": _m(rasgos),
    "Encunhamento executado após a alvenaria superior": _m(encunhamento),
    # ------------------------------------------------------------ COB
    "Madeira tratada e seca (cupim/umidade)": _m(madeira),
    "Estrutura do telhado (tesouras/terças) conferida": _m(telhado, "Estrutura do telhado", "estrutura", "peças, apoios e ancoragens conforme projeto"),
    "Inclinação mínima do telhado conforme fabricante": _m(telhado, "Inclinação do telhado", "inclinacao", "telha cerâmica: em geral 30% a 35%"),
    "Manta térmica/subcobertura instalada": _m(telhado, "Manta de subcobertura", "manta", "face refletiva para cima, sobreposição 10 cm"),
    "Telhamento com fixação e sobreposição corretas": _m(telhado, "Telhamento", "telhas", "de baixo para cima, galga constante, beirais amarrados"),
    "Cumeeiras e espigões emboçados ou fixados a seco": _m(telhado, "Cumeeira", "cumeeira", "sem frestas e alinhada"),
    "Calhas, rufos e condutores instalados": _m(telhado, "Calha e condutor", "calha", "caimento ≥ 0,5% para os condutores"),
    "Beirais e testeiras acabados": _m(telhado, "Beiral e testeira", "beiral", "acabamento protege a madeira da chuva"),
    "Teste de estanqueidade da cobertura": _m(telhado, "Teste com mangueira", "agua", "sem goteiras no forro após molhar"),
    # ------------------------------------------------------------ HID
    "Ramal de esgoto enterrado executado antes do contrapiso": _m(esgoto, "Ramal enterrado", "executar e testar antes do contrapiso"),
    "Tubulações de água fria e quente embutidas": _m(tubos_parede, "Água fria e quente embutidas", "rasgos verticais, tubos fixados"),
    "Pontos de água nas alturas do projeto (pia, chuveiro, tanque, máquina)": _m(alturas, [("bacia 0,20", 0.2), ("lavatório 0,60", 0.6), ("pia 1,10", 1.1), ("tanque 1,10", 1.1), ("ducha 2,10", 2.1)], "Alturas dos pontos de água (m)"),
    "Esgoto com caimento mínimo (1% a 2%)": _m(esgoto, "Caimento do esgoto", "conferir com nível em cada trecho"),
    "Ventilação do esgoto (coluna de ventilação) executada": _m(ventilacao),
    "Ralos sifonados e caixas sifonadas nos níveis do piso": _m(caimento, "Caixa sifonada no nível do piso acabado", "caimento 1%", "ralo"),
    "Teste de pressão na rede de água": _m(teste_pressao, "Teste de pressão", "1,5× a pressão de serviço por 1 h, sem queda"),
    "Teste de estanqueidade no esgoto": _m(teste_agua, "Teste do esgoto", "trecho cheio de água, sem vazamento nas juntas", "15 min"),
    "Águas pluviais: condutores e caixas de areia": _m(externo, "Águas pluviais", "ligacoes", "condutor → caixa de areia → rede pluvial"),
    "Caixa d'água, registros e caixas de inspeção instalados": _m(caixa_dagua),
    "Fossa/filtro ou ligação à rede pública conforme projeto": _m(fossa),
    "Tubulações protegidas antes do reboco": _m(tubos_parede, "Tubos protegidos", "tampar pontos e cobrir com argamassa"),
    # ------------------------------------------------------------ ELE
    "Padrão de entrada da concessionária instalado e aprovado": _m(padrao_entrada),
    "Eletrodutos e caixas embutidos conforme projeto": _m(tubos_parede, "Eletrodutos e caixas", "embutidos sem amassar, caixas no prumo", "eletrica"),
    "Caixas 4x2 nas alturas do projeto (tomadas baixas, médias e altas)": _m(tomadas, "Alturas das caixas 4×2", "baixa · média · alta (ar-condicionado)"),
    "Eletrodutos limpos e com guia antes da fiação": _m(tubos_parede, "Guia passada em todos os eletrodutos", "arame-guia confirma que não há obstrução", "eletrica"),
    "Circuitos independentes para chuveiros, ar-condicionado e cozinha": _m(quadro, "Circuitos independentes", ["geral", "DR 30 mA", "iluminação", "tomadas", "cozinha", "chuveiro 1", "ar-cond."]),
    "Quadro de distribuição com DR e DPS": _m(quadro, "Quadro de distribuição", ["geral", "DR 30 mA", "DPS", "circuitos", "barramento neutro", "barramento terra"]),
    "Fiação com bitolas e cores padronizadas": _m(fios),
    "Aterramento executado e medido": _m(aterramento),
    "Pontos de dados/telefonia/TV passados": _m(tomadas, "Dados, telefone e TV", "cabo Cat6 e coaxial em tubulação própria"),
    "Teste de continuidade e isolamento dos circuitos": _m(teste_eletrico, "Continuidade e isolamento", "nenhum curto, fuga ou emenda dentro de eletroduto"),
    # ------------------------------------------------------------ IMP
    "Regularização com caimento para os ralos": _m(caimento, "Regularização com caimento", "1% → ralo", "ralo"),
    "Cantos arredondados (meia-cana)": _m(camadas, [("parede", "tijolo", 50), ("meia-cana (raio ≈ 5 cm)", "arg", 16), ("regularização", "arg", 30)], "Meia-cana nos cantos", "a manta não dobra em canto vivo"),
    "Ralos com reforço (manga/arremate)": _m(caimento, "Reforço no ralo", "manga + tela no ralo", "ralo"),
    "Manta/membrana aplicada em boxes, varandas e lajes": _m(camadas, [("proteção mecânica", "arg", 24), ("manta / membrana (3 demãos)", "eps", 10), ("regularização com caimento", "arg", 30), ("laje / contrapiso", "concreto", 40)], "Camadas da impermeabilização"),
    "Subida mínima de 30 cm nas paredes e reforço na área do box": _m(camadas, [("box: subir ≥ 1,00 m", "ceramica", 50), ("demais paredes: ≥ 30 cm", "eps", 30), ("piso impermeabilizado", "arg", 30)], "Subida da impermeabilização", "medir a partir do piso acabado"),
    "Teste de lâmina d'água por 72 horas": _m(teste_agua, "Lâmina d'água por 72 h", "nível constante e nenhuma mancha nos ambientes vizinhos", "72 h"),
    "Proteção mecânica sobre a impermeabilização": _m(camadas, [("piso", "ceramica", 14), ("proteção mecânica 2–3 cm", "arg", 30), ("impermeabilização", "eps", 10), ("base", "concreto", 40)], "Proteção mecânica"),
    # ------------------------------------------------------------ REV
    "Instalações embutidas testadas antes do reboco": _m(teste_pressao, "Testar antes de rebocar", "água, esgoto e eletrodutos testados"),
    "Chapisco aplicado em toda a base": _m(camadas, [("chapisco 1:3 em 100% da base", "arg", 14), ("alvenaria e estrutura", "tijolo", 90)], "Chapisco", "aguardar 3 dias antes do reboco"),
    "Tela metálica nas ligações estrutura x alvenaria": _m(tela_amarracao),
    "Taliscas e mestras para prumo": _m(regua, "Taliscas e mestras", "taliscas a cada ≈ 1,5 m definem o prumo do reboco"),
    "Emboço/reboco desempenado e sem fissuras": _m(regua, "Planeza do reboco", "régua de 2 m: folga máxima de 3 mm"),
    "Espessura do reboco conforme norma (interno 5–20 mm, externo 20–30 mm)": _m(camadas, [("reboco interno 5–20 mm", "arg", 22), ("chapisco", "arg", 16), ("alvenaria", "tijolo", 70)], "Espessura do reboco", "externo: 20–30 mm"),
    "Requadro de vãos e quinas": _m(parede_vao, "Requadro de vãos", "esquadro", "prumo"),
    "Cura do reboco antes da cerâmica (mín. 14 dias)": _m(tempo, "Cura do reboco antes da cerâmica", "14", "assentar cerâmica só depois desse prazo"),
    "Cerâmica de parede com juntas e prumo conferidos": _m(ceramica, "Cerâmica de parede", "juntas alinhadas e prumo conferido"),
    "Rejuntamento e limpeza": _m(ceramica, "Rejuntamento", "≥ 72 h após assentar; juntas cheias e limpas"),
    "Teste de percussão nas paredes revestidas": _m(percussao, "Teste de percussão"),
    # ------------------------------------------------------------ FOR
    "Tipo de forro definido (laje, gesso, drywall, PVC ou madeira)": _m(lista, "Tipo de forro", ["laje pintada", "gesso / drywall", "PVC", "madeira", "definido no projeto"]),
    "Estrutura do forro nivelada": _m(nivelamento, "estrutura do forro (perfis F530)", "desvio máximo: 3 mm em 2 m", "nivelar com laser"),
    "Pontos de iluminação posicionados": _m(tomadas, "Pontos no forro", "posição conforme projeto luminotécnico"),
    "Alçapões de inspeção previstos": _m(lista, "Alçapões", ["sob caixa d'água", "registros", "caixas de passagem", "60 × 60 cm"]),
    "Tabica/negativo no encontro com paredes": _m(camadas, [("forro de gesso", "arg", 18), ("negativo de 1 cm (tabica)", "eps", 16), ("parede", "tijolo", 60)], "Tabica no encontro com a parede", "evita trinca entre forro e parede"),
    "Forro de áreas molhadas resistente à umidade": _m(lista, "Áreas molhadas", ["chapa RU (verde)", "banheiros", "área de serviço", "cozinha"]),
    "Juntas tratadas antes da pintura": _m(camadas, [("massa de acabamento", "arg", 18), ("fita de papel", "eps", 16), ("massa de junta", "arg", 18), ("chapas de gesso", "concreto", 34)], "Tratamento de juntas"),
    # ------------------------------------------------------------ PIS
    "Contrapiso sobre lastro/base compactada com espessura de 3–5 cm": _m(camadas, [("contrapiso 3–5 cm", "arg", 30), ("lastro / base compactada", "solo", 60)], "Contrapiso", "ponte de aderência antes de lançar"),
    "Contrapiso nivelado com caimentos nas áreas molhadas": _m(caimento, "Contrapiso com caimento", "1% → ralo", "ralo"),
    "Paginação do piso aprovada antes do assentamento": _m(paginacao),
    "Peças conferidas (lote, tonalidade, calibre)": _m(lista, "Conferência das peças", ["mesmo lote", "mesma tonalidade", "mesmo calibre", "sem lascas", "+10% de reserva"]),
    "Argamassa colante adequada ao formato da peça": _m(colagem, "Argamassa colante", "AC-II até 60×60 · AC-III em grandes formatos"),
    "Dupla colagem em peças acima de 900 cm²": _m(colagem, "Dupla colagem", "argamassa na base e no verso da peça"),
    "Juntas de assentamento e movimentação respeitadas": _m(junta, "Juntas do piso", "2–3 mm", "ceramica"),
    "Rodapés e soleiras instalados": _m(camadas, [("rodapé", "ceramica", 30), ("piso", "ceramica", 14), ("contrapiso", "arg", 30)], "Rodapé e soleira", "soleira nivelada entre ambientes"),
    "Teste de percussão (peças ocas)": _m(percussao, "Teste de percussão no piso"),
    "Proteção do piso até a entrega": _m(protecao, "Proteção do piso", "manter até a limpeza final"),
    # ------------------------------------------------------------ ESQ
    "Vãos conferidos antes da medição final": _m(parede_vao, "Medir o vão depois do reboco", "largura", "altura"),
    "Contramarcos/batentes no prumo e nível": _m(prumo, "Contramarco / batente", "prumo e nível antes de fixar", "madeira"),
    "Peitoris com pingadeira e caimento para fora": _m(janela, "Peitoril", "peitoril"),
    "Vedação com selante nas janelas": _m(janela, "Vedação da janela", "selante"),
    "Portas com folgas e ferragens reguladas": _m(porta, "Folgas da porta", "3 dobradiças, folga uniforme"),
    "Fechaduras, dobradiças e puxadores conferidos": _m(porta, "Ferragens", "testar chave e trinco"),
    "Vidros instalados e etiquetados": _m(janela, "Vidros", "etiqueta"),
    "Teste de estanqueidade das janelas (jato d'água)": _m(janela, "Teste com jato d'água", "agua"),
    # ------------------------------------------------------------ LOU
    "Bancadas e tampos instalados e nivelados": _m(louca, "Bancada", "nivelada · altura 0,90 m"),
    "Bacias, cubas e tanques instalados sem vazamento": _m(louca, "Louças", "testar cheio e escoando"),
    "Sifões, flexíveis e engates sem vazamento": _m(louca, "Sifão e flexível", "sem gotejamento nas conexões"),
    "Torneiras, registros e chuveiros testados": _m(louca, "Metais", "abrir e fechar todos os pontos"),
    "Chuveiro elétrico ligado em circuito e disjuntor próprios": _m(quadro, "Chuveiro em circuito exclusivo", ["geral", "DR 30 mA", "chuveiro 1 (6 mm²)", "chuveiro 2 (6 mm²)", "demais circuitos"]),
    "Tomadas e interruptores instalados": _m(tomadas, "Tomadas e interruptores", "placas alinhadas, polaridade correta"),
    "Luminárias instaladas e testadas": _m(teste_eletrico, "Luminárias", "todas acendem, firmes e sem aquecimento"),
    "Quadro identificado (circuitos etiquetados)": _m(quadro, "Quadro etiquetado", ["1 · iluminação sala", "2 · tomadas sala", "3 · cozinha", "4 · chuveiro", "5 · ar-cond.", "6 · área externa"]),
    "Teste de todos os pontos elétricos com a carga ligada": _m(teste_eletrico, "Teste com carga", "ligar aparelhos reais; nada desarma"),
    # ------------------------------------------------------------ PIN
    "Reboco curado (mínimo 28 dias) antes da pintura": _m(tempo, "Cura do reboco antes da pintura", "28", "pintar antes causa manchas e descascamento"),
    "Superfícies limpas, secas e sem eflorescência": _m(pintura, "Preparo da superfície", 0, "sem pó, umidade ou manchas brancas (eflorescência)"),
    "Proteção de pisos, esquadrias e louças": _m(protecao, "Proteção antes de pintar", "lona, papelão e fita crepe"),
    "Selador/fundo aplicado": _m(pintura, "Selador", 1, "uniformiza a absorção do reboco"),
    "Massa corrida/acrílica e lixamento": _m(pintura, "Massa e lixamento", 2, "2 demãos finas, lixar e tirar o pó"),
    "Massa acrílica em áreas úmidas e externas (corrida só em área seca)": _m(lista, "Qual massa usar", ["massa corrida: área seca", "acrílica: banheiro", "acrílica: cozinha", "acrílica: área externa"]),
    "Demãos de tinta conforme especificação": _m(pintura, "Demãos de tinta", 3, "2 a 3 demãos, respeitando o intervalo"),
    "Pintura de portas, rodapés e madeiras": _m(porta, "Madeiras", "fundo + 2 demãos"),
    "Retoques após instalação de louças e esquadrias": _m(pintura, "Retoques finais", 3, "última demão depois das instalações"),
    # ------------------------------------------------------------ EXT
    "Muros, portões e gradis": _m(externo, "Muros e portões", "muro", "prumo, alinhamento na divisa"),
    "Calçada e acessos": _m(externo, "Calçada e acessos", "calcada", "base compactada e juntas a cada 2 m"),
    "Calçada pública conforme padrão da prefeitura (acessível)": _m(externo, "Calçada pública", "calcada", "padrão municipal e NBR 9050"),
    "Caimento do terreno afastando água da casa": _m(externo, "Caimento do terreno", "caimento", "sem empoçamento junto às paredes"),
    "Paisagismo e drenagem externa": _m(externo, "Paisagismo e drenagem", "paisagismo", "terra vegetal, dreno onde encharca"),
    "Ligações definitivas de água, esgoto e energia": _m(externo, "Ligações definitivas", "ligacoes", "aprovadas pelas concessionárias"),
    "Número do imóvel e caixa de correio": _m(externo, "Número e caixa de correio", "numero", "visível da rua"),
    # ------------------------------------------------------------ ENT
    "Limpeza fina de toda a obra": _m(lista, "Limpeza fina", ["pisos e rejuntes", "vidros e esquadrias", "louças e metais", "sem palha de aço"]),
    "Remoção de entulho e sobras com CTR": _m(documento, "CTR final", ["entulho retirado", "terreno limpo", "CTRs arquivados", "calçada livre"], "CTR"),
    "Vistoria com o cliente e lista de pendências": _m(lista, "Vistoria com o cliente", ["ambiente por ambiente", "foto de cada pendência", "responsável e prazo", "assinatura"]),
    "Pendências da vistoria corrigidas e reinspecionadas": _m(lista, "Reinspeção", ["pendência corrigida", "foto do depois", "cliente confere", "item fechado"]),
    "Projetos as built entregues": _m(documento, "As built", ["como foi construído", "hidráulica", "elétrica", "estrutura"], "ENTREGUE"),
    "Manual do proprietário entregue": _m(documento, "Manual de uso", ["NBR 14037", "garantias", "manutenções", "fornecedores"], "ENTREGUE"),
    "Habite-se / certificado de conclusão": _m(documento, "Habite-se", ["vistoria municipal", "calçada aprovada", "CTRs", "projeto aprovado"], "EMITIDO"),
    "Baixa do CNO / CND da obra (INSS)": _m(documento, "CND da obra", ["Receita Federal", "CNO baixado", "INSS regular", "para averbar"], "CND"),
    "Averbação da construção no cartório de imóveis": _m(documento, "Averbação", ["cartório de imóveis", "habite-se", "CND", "matrícula atualizada"], "AVERBADA"),
    "Termo de entrega de chaves assinado": _m(documento, "Termo de entrega", ["chaves entregues", "manual entregue", "vistoria aceita", "assinaturas"], "ASSINADO"),
}


def _prefixo(texto: str) -> str:
    import hashlib

    return "f" + hashlib.md5(texto.encode()).hexdigest()[:6]


def figura(texto_item: str) -> str | None:
    """SVG de referência do item de checklist (pelo texto do catálogo), ou None."""
    entrada = FIGURAS.get(texto_item)
    if not entrada:
        return None
    fn, args, kw = entrada
    d = fn(_prefixo(texto_item), *args, **kw)
    return d.svg(texto_item)


def tem_figura(texto_item: str) -> bool:
    return texto_item in FIGURAS
