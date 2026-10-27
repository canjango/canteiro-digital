"""Detalhes técnicos ilustrados (SVG) — um desenho esquemático por etapa.

Desenhos originais, gerados em Python, sem escala, para orientar a equipe
sobre o ponto crítico de cada etapa (cotas, camadas, alturas, sequência).
As cores vêm das variáveis CSS da página, então funcionam no tema claro e
no escuro. Não substituem o projeto executivo.
"""

from __future__ import annotations

from html import escape

L, A = 480, 280  # viewBox


class D:
    """Pequeno kit de desenho técnico."""

    def __init__(self, pref: str, largura: int = L, altura: int = A):
        self.p = pref
        self.w, self.h = largura, altura
        self.el: list[str] = []

    # -- primitivas
    def ret(self, x, y, w, h, cls="dt-linha", rx=0):
        self.el.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" class="{cls}"/>')

    def pad(self, x, y, w, h, padrao, borda=True):
        extra = ' class="dt-linha-fill"' if borda else ' stroke="none"'
        self.el.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="url(#{self.p}-{padrao})"{extra}/>')

    def lin(self, x1, y1, x2, y2, cls="dt-linha"):
        self.el.append(f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" class="{cls}"/>')

    def pol(self, pontos, cls="dt-linha", padrao=None):
        pts = " ".join(f"{x},{y}" for x, y in pontos)
        fill = f' fill="url(#{self.p}-{padrao})"' if padrao else ""
        if padrao and cls == "dt-linha":
            cls = "dt-linha-fill"
        self.el.append(f'<polygon points="{pts}" class="{cls}"{fill}/>')

    def cam(self, pontos, cls="dt-linha"):
        pts = " ".join(f"{x},{y}" for x, y in pontos)
        self.el.append(f'<polyline points="{pts}" class="{cls}"/>')

    def circ(self, x, y, r, cls="dt-barra"):
        self.el.append(f'<circle cx="{x}" cy="{y}" r="{r}" class="{cls}"/>')

    def txt(self, x, y, t, anc="start", cls="dt-txt"):
        self.el.append(f'<text x="{x}" y="{y}" text-anchor="{anc}" class="{cls}">{escape(t)}</text>')

    def nota(self, x, y, tx, ty, t, anc="start"):
        """Chamada: linha de chamada do ponto (x,y) até o texto em (tx,ty)."""
        self.circ(x, y, 2.2, "dt-ponto")
        self.lin(x, y, tx, ty - 4, "dt-chamada")
        self.txt(tx + (3 if anc == "start" else -3), ty, t, anc)

    def cota_h(self, x1, x2, y, t):
        self.lin(x1, y, x2, y, "dt-cota")
        for x in (x1, x2):
            self.lin(x, y - 5, x, y + 5, "dt-cota")
        self.txt((x1 + x2) / 2, y - 6, t, "middle", "dt-txt-cota")

    def cota_v(self, x, y1, y2, t, lado=1):
        self.lin(x, y1, x, y2, "dt-cota")
        for y in (y1, y2):
            self.lin(x - 5, y, x + 5, y, "dt-cota")
        self.txt(x + 8 * lado, (y1 + y2) / 2 + 4, t, "start" if lado > 0 else "end", "dt-txt-cota")

    def svg(self, titulo: str) -> str:
        p = self.p
        defs = f"""<defs>
<pattern id="{p}-concreto" width="14" height="14" patternUnits="userSpaceOnUse"><rect width="14" height="14" class="dt-f-concreto"/><circle cx="3" cy="4" r="1.1" class="dt-f-pt"/><circle cx="10" cy="9" r="1.4" class="dt-f-pt"/><circle cx="6" cy="12" r="0.8" class="dt-f-pt"/></pattern>
<pattern id="{p}-solo" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="10" height="10" class="dt-f-solo"/><line x1="0" y1="0" x2="0" y2="10" class="dt-f-tr"/></pattern>
<pattern id="{p}-tijolo" width="30" height="14" patternUnits="userSpaceOnUse"><rect width="30" height="14" class="dt-f-tijolo"/><path d="M0 0H30M0 7H30M10 0V7M25 7V14" class="dt-f-tr"/></pattern>
<pattern id="{p}-madeira" width="12" height="6" patternUnits="userSpaceOnUse"><rect width="12" height="6" class="dt-f-madeira"/><path d="M0 3Q3 1 6 3T12 3" class="dt-f-tr"/></pattern>
<pattern id="{p}-eps" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" class="dt-f-eps"/><circle cx="4" cy="4" r="1.6" class="dt-f-eps-pt"/></pattern>
<pattern id="{p}-arg" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" class="dt-f-arg"/><circle cx="2" cy="2" r="0.6" class="dt-f-pt"/><circle cx="6" cy="6" r="0.6" class="dt-f-pt"/></pattern>
<pattern id="{p}-ceramica" width="20" height="6" patternUnits="userSpaceOnUse"><rect width="20" height="6" class="dt-f-ceramica"/><line x1="19.5" y1="0" x2="19.5" y2="6" class="dt-f-tr"/></pattern>
</defs>"""
        return (f'<svg viewBox="0 0 {self.w} {self.h}" class="detalhe-svg" role="img" aria-label="{escape(titulo)}" '
                f'xmlns="http://www.w3.org/2000/svg">{defs}{"".join(self.el)}</svg>')


# ============================================================ desenhos
def _pre():
    d = D("pre")
    d.ret(110, 60, 260, 150, "dt-tracejada")
    d.txt(240, 140, "projeção da casa", "middle", "dt-txt-suave")
    d.ret(70, 25, 340, 220, "dt-madeira-linha")
    d.txt(75, 20, "gabarito (tábuas 2,5×20 cm)")
    for x in (110, 190, 290, 370):
        d.lin(x, 25, x, 245, "dt-fio")
    for y in (60, 140, 210):
        d.lin(70, y, 410, y, "dt-fio")
    d.lin(110, 60, 370, 210, "dt-diagonal")
    d.lin(370, 60, 110, 210, "dt-diagonal")
    d.txt(240, 100, "D1 = D2 (esquadro)", "middle", "dt-txt-forte")
    d.cota_v(440, 25, 60, "1,20 m")
    d.nota(190, 60, 250, 46, "linha de náilon nos eixos")
    d.circ(40, 255, 5, "dt-rn")
    d.txt(50, 259, "RN: nível de referência")
    return d, "Locação da obra com gabarito"


def _ter():
    d = D("ter")
    d.pol([(20, 80), (180, 80), (180, 250), (20, 250)], "dt-sem", "solo")
    d.pol([(300, 80), (460, 80), (460, 250), (300, 250)], "dt-sem", "solo")
    d.pol([(180, 210), (300, 210), (300, 250), (180, 250)], "dt-sem", "solo")
    d.lin(20, 80, 180, 80); d.lin(300, 80, 460, 80)
    d.cam([(180, 80), (180, 210), (300, 210), (300, 80)])
    d.ret(220, 160, 40, 50, "dt-tracejada")
    d.txt(240, 155, "baldrame", "middle", "dt-txt-suave")
    d.cota_h(180, 220, 232, "+10 cm")
    d.cota_h(220, 260, 232, "largura")
    d.cota_h(260, 300, 232, "+10 cm")
    d.nota(250, 210, 320, 268, "fundo nivelado e apiloado")
    for y in (96, 112, 128):
        d.lin(30, y, 170, y, "dt-camada")
    d.txt(20, 60, "aterro interno: camadas ≤ 20 cm compactadas")
    d.cota_v(176, 80, 96, "≤ 20 cm", -1)
    d.txt(320, 60, "escorar valas > 1,25 m")
    return d, "Escavação de vala e aterro compactado"


def _fun():
    d = D("fun")
    d.pad(20, 150, 440, 120, "solo", False)
    d.lin(20, 150, 460, 150)
    d.pad(190, 190, 50, 80, "concreto")
    d.txt(250, 250, "estaca broca Ø 25 cm (≈ 3 m)")
    d.pad(160, 180, 110, 10, "arg")
    d.txt(280, 189, "lastro 5 cm")
    d.pad(175, 100, 80, 80, "concreto")
    d.ret(183, 108, 64, 64, "dt-estribo")
    for x, y in ((189, 114), (241, 114), (189, 166), (241, 166)):
        d.circ(x, y, 3.2)
    d.cam([(171, 180), (171, 96), (259, 96), (259, 180)], "dt-imperm")
    d.ret(222, 70, 10, 30, "dt-tubo")
    d.nota(227, 72, 240, 30, "passante de esgoto antes de concretar")
    d.nota(259, 110, 290, 70, "impermeabilizar topo e laterais")
    d.nota(241, 130, 300, 125, "4 Ø 10 mm · estribo Ø 5 c/ 15 cm")
    d.nota(183, 160, 30, 200, "cobrimento 3 cm")
    d.cota_v(150, 100, 180, "30 cm", -1)
    d.cota_h(175, 255, 88, "15 cm")
    return d, "Estaca broca e viga baldrame"


def _est():
    d = D("est")
    d.pad(20, 70, 380, 16, "concreto")
    d.lin(20, 80, 400, 80, "dt-tela")
    for i in range(5):
        x = 36 + i * 86
        d.pol([(x - 10, 128), (x + 10, 128), (x + 10, 120), (x + 3, 120), (x + 3, 86), (x - 3, 86), (x - 3, 120), (x - 10, 120)],
              "dt-linha", "concreto")
        d.cam([(x - 5, 120), (x, 92), (x + 5, 120)], "dt-trelica")
        if i < 4:
            d.pad(x + 12, 88, 62, 40, "eps")
    d.cota_v(410, 70, 86, "capa 4 cm")
    d.cota_v(410, 86, 128, "EPS H8")
    d.nota(240, 80, 260, 45, "tela soldada Q-92 na capa")
    d.nota(126, 118, 110, 165, "vigota treliçada", "end")
    d.nota(170, 105, 200, 165, "enchimento EPS")
    for x in (50, 160, 270, 380):
        d.lin(x, 128, x, 250, "dt-escora")
        d.lin(x - 12, 250, x + 12, 250)
    d.lin(20, 128, 400, 128, "dt-guia")
    d.cota_h(50, 160, 268, "escoras a cada 1,0–1,3 m")
    d.txt(215, 215, "retirar após 21 dias, do meio para os apoios", "middle", "dt-txt-suave")
    return d, "Laje treliçada com EPS e escoramento"


def _alv():
    d = D("alv")
    d.pad(70, 30, 330, 220, "tijolo")
    d.pad(30, 30, 40, 220, "concreto")
    d.pad(30, 15, 400, 15, "concreto")
    d.ret(170, 80, 120, 90, "dt-vao")
    d.pad(140, 66, 180, 14, "concreto")
    d.pad(140, 170, 180, 14, "concreto")
    d.txt(230, 128, "vão da janela", "middle", "dt-txt-suave")
    d.cota_h(140, 170, 58, "30 cm")
    d.cota_h(290, 320, 58, "30 cm")
    d.nota(320, 73, 410, 80, "verga")
    d.nota(320, 177, 410, 190, "contraverga")
    for y in (58, 86, 114, 142, 170, 198, 226):
        d.lin(70, y, 92, y, "dt-tela-amarr")
    d.nota(80, 142, 110, 225, "tela de amarração a cada 2 fiadas")
    d.ret(70, 30, 330, 6, "dt-encunha")
    d.nota(250, 33, 330, 10, "encunhamento")
    d.txt(470, 250, "juntas de 10 mm", "end", "dt-txt-suave")
    return d, "Alvenaria com vergas, contravergas e amarração"


def _cob():
    d = D("cob")
    d.pad(40, 200, 30, 60, "tijolo"); d.pad(410, 200, 30, 60, "tijolo")
    d.pad(30, 188, 420, 12, "concreto")
    d.pol([(30, 188), (240, 70), (450, 188)], "dt-linha")
    d.lin(240, 70, 240, 188, "dt-linha")
    d.lin(135, 129, 240, 188, "dt-fina"); d.lin(345, 129, 240, 188, "dt-fina")
    for i in range(1, 7):
        x = 30 + i * 30
        y = 188 - (x - 30) * (118 / 210)
        d.circ(x, y - 4, 2.4, "dt-ripa")
    d.cam([(10, 200), (30, 188), (240, 70)], "dt-telha")
    d.cam([(238, 74), (30, 191)], "dt-manta")
    d.nota(120, 136, 20, 90, "telha cerâmica")
    d.nota(160, 117, 20, 70, "manta de subcobertura")
    d.nota(90, 152, 20, 110, "caibros 5×6 c/ 50 cm + ripas")
    d.ret(4, 196, 16, 12, "dt-calha")
    d.nota(12, 202, 60, 240, "calha (caimento ≥ 0,5%)")
    d.cam([(330, 120), (380, 120), (380, 150)], "dt-cota")
    d.txt(385, 140, "i = 30 a 35%", "start", "dt-txt-cota")
    d.nota(240, 70, 300, 40, "cumeeira")
    d.txt(240, 182, "cinta de respaldo", "middle", "dt-txt-suave")
    return d, "Telhado cerâmico: corte esquemático"


def _hid():
    d = D("hid")
    d.pad(20, 240, 440, 20, "concreto")
    d.lin(20, 240, 460, 240)
    d.pad(440, 20, 20, 220, "tijolo")
    for x, h, t in ((70, 200, "ducha 2,10 m"), (140, 105, "registro 1,10 m"), (215, 57, "lavatório 0,60 m"),
                    (290, 19, "bacia 0,20 m"), (370, 105, "pia/tanque 1,10 m")):
        y = 240 - h
        d.lin(x, 240, x, y, "dt-agua")
        d.circ(x, y, 4, "dt-ponto-agua")
        d.txt(x, y - 8, t, "middle")
    d.cam([(60, 252), (420, 258)], "dt-esgoto")
    d.txt(240, 276, "esgoto: caimento 1% (Ø 100) a 2% (Ø 40/50)", "middle", "dt-txt-cota")
    d.ret(85, 236, 24, 8, "dt-ralo")
    d.txt(100, 230, "caixa sifonada", "start", "dt-txt-suave")
    d.txt(430, 16, "alturas típicas do piso acabado — confira o projeto", "end", "dt-txt-suave")
    return d, "Alturas dos pontos hidráulicos de um banheiro"


def _ele():
    d = D("ele")
    d.pad(20, 240, 310, 20, "concreto")
    d.lin(20, 240, 330, 240)
    for x, h, t in ((50, 0.30, "tomada 0,30"), (125, 1.10, "interruptor 1,10"), (205, 1.10, "tomada 1,10"),
                    (285, 2.20, "ar-cond. 2,20")):
        y = 240 - h * 85
        d.ret(x - 7, y - 5, 14, 10, "dt-caixa")
        d.lin(x, y + 5, x, 240, "dt-fina")
        d.txt(x, y - 10, t, "middle")
    d.txt(20, 275, "alturas em metros, do piso acabado", "start", "dt-txt-suave")
    d.ret(350, 40, 110, 200, "dt-quadro", 4)
    d.txt(405, 58, "quadro", "middle", "dt-txt-forte")
    for i, t in enumerate(("geral", "DR 30 mA", "DPS", "ilum. 1,5 mm²", "tomadas 2,5 mm²", "chuveiro 6 mm²")):
        y = 76 + i * 26
        d.ret(362, y, 86, 18, "dt-disj", 2)
        d.txt(405, y + 13, t, "middle", "dt-txt-peq")
    d.txt(405, 256, "a 1,50 m do piso", "middle", "dt-txt-suave")
    d.txt(20, 16, "fase preto/vermelho · neutro azul · terra verde", "start", "dt-txt-suave")
    return d, "Alturas de pontos elétricos e quadro com DR e DPS"


def _imp():
    d = D("imp")
    d.pad(20, 210, 440, 50, "concreto")
    d.pad(400, 20, 60, 190, "tijolo")
    d.pol([(20, 202), (360, 196), (400, 194), (400, 210), (20, 210)], "dt-linha", "arg")
    d.cam([(20, 200), (360, 194), (392, 192), (398, 186), (398, 110)], "dt-imperm")
    d.cam([(20, 194), (360, 188), (394, 186)], "dt-linha")
    d.pad(20, 184, 360, 6, "ceramica", False)
    d.ret(60, 196, 20, 14, "dt-ralo")
    d.nota(70, 200, 40, 245, "ralo com reforço")
    d.nota(250, 196, 30, 130, "impermeabilização: 3 demãos + tela")
    d.nota(396, 189, 300, 95, "meia-cana", "end")
    d.nota(300, 187, 30, 75, "proteção mecânica + piso")
    d.cota_v(385, 110, 192, "≥ 30 cm", -1)
    d.txt(380, 100, "box: ≥ 1,00 m", "end", "dt-txt-cota")
    d.cam([(150, 168), (250, 166)], "dt-cota")
    d.txt(200, 161, "caimento 1% → ralo", "middle", "dt-txt-cota")
    d.txt(20, 40, "teste: lâmina d'água 5 cm por 72 h antes do piso", "start", "dt-txt-forte")
    return d, "Impermeabilização de área molhada (box)"


def _rev():
    d = D("rev")
    d.pad(40, 30, 120, 230, "tijolo")
    d.pad(160, 30, 6, 230, "arg")
    d.pad(166, 30, 34, 230, "arg")
    d.pad(200, 130, 8, 130, "arg")
    d.pad(208, 130, 10, 130, "ceramica")
    d.nota(100, 60, 260, 40, "alvenaria")
    d.nota(163, 80, 260, 70, "chapisco 1:3 (100% da base)")
    d.nota(183, 100, 260, 100, "reboco 5–20 mm, com taliscas")
    d.nota(204, 160, 260, 150, "argamassa colante")
    d.txt(263, 165, "(reboco curado ≥ 14 dias)", "start", "dt-txt-suave")
    d.nota(213, 190, 260, 195, "cerâmica: juntas e prumo")
    d.cota_h(166, 200, 22, "≤ 20 mm")
    d.txt(260, 240, "tela galvanizada nas ligações", "start", "dt-txt-suave")
    d.txt(260, 255, "alvenaria × estrutura antes do reboco", "start", "dt-txt-suave")
    return d, "Camadas do revestimento de parede"


def _for():
    d = D("for")
    d.pad(20, 20, 440, 30, "concreto")
    d.pad(420, 50, 40, 210, "tijolo")
    for x in (80, 200, 320):
        d.lin(x, 50, x, 150, "dt-pendural")
    d.lin(30, 150, 410, 150, "dt-perfil")
    d.pad(30, 154, 380, 8, "arg")
    d.lin(410, 150, 410, 162, "dt-linha")
    d.cam([(412, 150), (418, 150), (418, 166)], "dt-tabica")
    d.cota_h(80, 200, 135, "pendurais ≈ 1,0 m")
    d.nota(150, 150, 120, 200, "perfil F530 a cada 60 cm")
    d.nota(250, 158, 160, 228, "chapa de gesso 12,5 mm (RU no banheiro)")
    d.nota(415, 162, 410, 260, "tabica: negativo de 1 cm", "end")
    d.nota(80, 100, 90, 90, "regulador + arame")
    return d, "Forro de gesso acartonado com tabica"


def _pis():
    d = D("pis")
    d.pad(20, 200, 440, 60, "solo", False)
    d.lin(20, 200, 460, 200)
    d.pad(20, 160, 400, 40, "arg")
    d.pad(20, 152, 400, 8, "arg")
    d.pad(20, 140, 400, 12, "ceramica")
    d.pad(430, 20, 30, 240, "tijolo")
    d.pad(418, 110, 12, 30, "ceramica")
    d.lin(424, 140, 424, 200, "dt-junta")
    d.cota_v(40, 160, 200, "3–5 cm")
    d.nota(200, 185, 140, 240, "contrapiso 1:4 sobre base compactada")
    d.nota(250, 156, 230, 110, "argamassa colante AC-II/AC-III")
    d.nota(150, 146, 60, 80, "piso: mesmo lote e calibre")
    d.nota(424, 125, 380, 40, "rodapé", "end")
    d.nota(424, 170, 380, 60, "junta perimetral", "end")
    d.txt(20, 22, "juntas de movimentação a cada ≈ 20 m²", "start", "dt-txt-suave")
    return d, "Contrapiso e piso cerâmico/porcelanato"


def _esq():
    d = D("esq")
    x0 = 110
    d.pad(x0, 20, 120, 50, "concreto")
    d.pad(x0, 70, 120, 20, "tijolo")
    d.ret(x0 + 40, 90, 40, 100, "dt-janela")
    d.lin(x0 + 60, 90, x0 + 60, 190, "dt-vidro")
    d.pol([(x0 + 10, 190), (x0 + 140, 190), (x0 + 140, 202), (x0 + 136, 206), (x0 + 130, 202), (x0 + 10, 198)], "dt-linha", "arg")
    d.pad(x0, 206, 120, 20, "concreto")
    d.pad(x0, 226, 120, 40, "tijolo")
    d.cota_h(x0 + 120, x0 + 140, 180, "≥ 2 cm")
    d.nota(x0 + 136, 205, 290, 240, "pingadeira")
    d.nota(x0 + 100, 194, 290, 210, "peitoril com caimento para fora")
    d.nota(x0 + 80, 100, 290, 110, "selante no perímetro externo")
    d.nota(x0 + 40, 40, 60, 40, "verga", "end")
    d.nota(x0 + 40, 215, 100, 240, "contraverga", "end")
    d.txt(20, 150, "interno", "start", "dt-txt-suave")
    d.txt(460, 150, "externo", "end", "dt-txt-suave")
    return d, "Janela com peitoril e pingadeira (corte)"


def _lou():
    d = D("lou")
    d.pad(20, 250, 440, 12, "concreto")
    d.lin(20, 250, 460, 250)
    d.pad(440, 20, 20, 230, "tijolo")
    d.pad(200, 104, 240, 16, "ceramica")
    d.cam([(260, 120), (270, 150), (330, 150), (340, 120)], "dt-linha")
    d.cam([(300, 150), (300, 185), (330, 185), (330, 175)], "dt-sifao")
    d.cam([(330, 175), (440, 175)], "dt-esgoto")
    d.cam([(360, 104), (360, 84), (330, 84)], "dt-agua")
    d.cam([(440, 196), (400, 196), (360, 120)], "dt-agua")
    d.cota_v(190, 104, 250, "bancada 0,90 m", -1)
    d.nota(400, 196, 385, 232, "água 0,60 m + flexível", "end")
    d.nota(300, 175, 230, 215, "sifão acessível", "end")
    d.nota(420, 175, 175, 240, "esgoto 0,50 m (Ø 40/50)", "end")
    d.nota(345, 84, 330, 50, "torneira / misturador", "end")
    d.txt(20, 30, "testar com a cuba cheia escoando", "start", "dt-txt-forte")
    return d, "Bancada com cuba: alturas e ligações"


def _pin():
    d = D("pin")
    etapas = (("reboco curado ≥ 28 dias", "arg"), ("selador acrílico", "eps"), ("massa: 2 demãos + lixa", "arg"),
              ("tinta: 2 a 3 demãos", "ceramica"))
    for i, (t, pad) in enumerate(etapas):
        x = 30 + i * 110
        d.pad(x, 60, 96, 160, pad)
        d.txt(x + 48, 240, f"{i + 1}", "middle", "dt-txt-forte")
        d.txt(x + 48, 258, t, "middle", "dt-txt-peq")
        if i < 3:
            d.cam([(x + 98, 140), (x + 108, 140)], "dt-seta")
    d.txt(240, 40, "superfície limpa, seca e sem eflorescência antes de começar", "middle", "dt-txt-suave")
    return d, "Sequência de pintura"


def _ext():
    d = D("ext")
    d.pad(20, 210, 440, 50, "solo", False)
    d.lin(20, 210, 460, 210)
    d.pad(60, 200, 50, 20, "concreto")
    d.pad(70, 220, 30, 40, "concreto")
    d.pad(70, 40, 30, 160, "tijolo")
    d.pad(66, 30, 38, 12, "concreto")
    d.cam([(66, 200), (66, 180), (104, 180), (104, 200)], "dt-imperm")
    d.nota(85, 36, 140, 30, "cinta superior")
    d.nota(104, 190, 160, 160, "base impermeabilizada")
    d.nota(85, 240, 160, 245, "fundação corrida ou brocas")
    d.cota_v(40, 42, 200, "≈ 2,0 m", -1)
    d.pad(250, 196, 200, 10, "concreto")
    d.cam([(260, 190), (440, 196)], "dt-cota")
    d.txt(350, 182, "calçada: caimento 2% para a rua", "middle", "dt-txt-cota")
    d.txt(250, 110, "colunas armadas a cada ≈ 3 m", "start", "dt-txt-suave")
    return d, "Muro de divisa e calçada"


def _ent():
    d = D("ent")
    passos = ("Limpeza fina", "Vistoria com o cliente", "Correção das pendências", "Documentação", "Entrega das chaves")
    for i, t in enumerate(passos):
        x = 20 + i * 92
        d.ret(x, 100, 84, 64, "dt-caixa-passo", 6)
        d.txt(x + 42, 124, f"{i + 1}", "middle", "dt-txt-forte")
        palavras = t.split(" ")
        d.txt(x + 42, 142, " ".join(palavras[:2]), "middle", "dt-txt-peq")
        if len(palavras) > 2:
            d.txt(x + 42, 155, " ".join(palavras[2:]), "middle", "dt-txt-peq")
        if i < 4:
            d.cam([(x + 85, 132), (x + 91, 132)], "dt-seta")
    d.txt(240, 200, "habite-se, CND da obra (INSS), averbação, as built e manual (NBR 14037)", "middle", "dt-txt-suave")
    d.txt(240, 70, "iniciar a documentação antes do fim da obra", "middle", "dt-txt-cota")
    return d, "Sequência de entrega da obra"


DESENHOS = {
    "PRE": _pre, "TER": _ter, "FUN": _fun, "EST": _est, "ALV": _alv, "COB": _cob, "HID": _hid, "ELE": _ele,
    "IMP": _imp, "REV": _rev, "FOR": _for, "PIS": _pis, "ESQ": _esq, "LOU": _lou, "PIN": _pin, "EXT": _ext, "ENT": _ent,
}


def detalhe(codigo: str) -> tuple[str, str] | None:
    """(svg, título) do detalhe da etapa, ou None."""
    f = DESENHOS.get(codigo)
    if not f:
        return None
    d, titulo = f()
    return d.svg(titulo), titulo
