"""Interface: gera o HTML de cada tela a partir do estado (`Sistema`).

Convenção de eventos (tratada por uma camada mínima no navegador):
- <button data-action="x" data-k="v">   clique envia {k: v}
- <form data-action="x">                envio manda os campos do formulário
- <select data-action="x" name="campo"> mudança envia {campo: valor}
Todo texto vindo do usuário passa por `esc()` (proteção contra injeção de HTML).
"""

from __future__ import annotations

from html import escape

from . import analise as an
from .etapas import CATEGORIAS, MODELO_VERSAO
from .padroes import CODIGOS_PADRAO, PADROES, REFERENCIA, rotulo as rotulo_padrao
from .modelos import (
    CATEGORIAS_COMPRA,
    PRIORIDADES,
    STATUS_TAREFA,
    TRANSICOES_COMPRA,
    UNIDADES,
    Obra,
)
from . import assistente as ia
from . import servicos as sv
from .detalhes import detalhe
from .figuras import figura as figura_item, tem_figura
from .especificacoes import especificacao
from .sistema import Sistema


def esc(v) -> str:
    return escape("" if v is None else str(v), quote=True)


def attrs(**kw) -> str:
    partes = []
    for k, v in kw.items():
        if v is None or v is False:
            continue
        nome = k.rstrip("_").replace("_", "-")
        partes.append(nome if v is True else f'{nome}="{esc(v)}"')
    return " ".join(partes)


def botao(rotulo: str, acao: str, classe: str = "btn", titulo: str | None = None, **dados) -> str:
    extra = " ".join(f'data-{k.replace("_", "-")}="{esc(v)}"' for k, v in dados.items())
    t = f' title="{esc(titulo)}" aria-label="{esc(titulo)}"' if titulo else ""
    return f'<button type="button" class="{classe}" data-action="{acao}" {extra}{t}>{rotulo}</button>'


def opcoes(valores, selecionado="", rotulos=None) -> str:
    out = []
    for i, v in enumerate(valores):
        r = rotulos[i] if rotulos else v
        sel = " selected" if str(v) == str(selecionado) else ""
        out.append(f'<option value="{esc(v)}"{sel}>{esc(r)}</option>')
    return "".join(out)


def valor_br(v: float | None, casas: int = 2) -> str:
    """Número no formato brasileiro para preencher campos: 300000 -> '300.000,00'."""
    if not v:
        return ""
    t = f"{v:,.{casas}f}".replace(",", "X").replace(".", ",").replace("X", ".")
    return t


def campo_num(id_: str, nome: str, valor: float | None = None, placeholder: str = "0,00",
              obrigatorio: bool = False, rotulo: str | None = None, texto: str | None = None) -> str:
    """Campo numérico em texto com teclado decimal: aceita 300.000 / 300.000,00 / 300000."""
    v = texto if texto is not None else (valor_br(valor) if valor is not None else "")
    req = " required" if obrigatorio else ""
    aria = f' aria-label="{esc(rotulo)}"' if rotulo else ""
    return (f'<input id="{esc(id_)}" name="{nome}" type="text" inputmode="decimal" autocomplete="off" '
            f'value="{esc(v)}" placeholder="{esc(placeholder)}"{req}{aria}>')


def pct(x: float | None) -> str:
    return "—" if x is None else f"{x * 100:.0f}%"


def barra(frac: float, classe: str = "", marca: float | None = None) -> str:
    frac = max(0.0, min(1.0, frac or 0.0))
    m = ""
    if marca is not None:
        m = f'<span class="barra-marca" style="left:{max(0, min(1, marca)) * 100:.1f}%" title="Previsto"></span>'
    # <span> (e não <div>) para poder ficar dentro de <button> com HTML válido
    return (f'<span class="barra {classe}" role="progressbar" aria-valuenow="{frac * 100:.0f}" '
            f'aria-valuemin="0" aria-valuemax="100"><span style="width:{frac * 100:.1f}%"></span>{m}</span>')


SLUG = {
    "Concluída": "ok", "Em andamento": "andamento", "Liberada": "liberada", "Aguardando": "aguardando",
    "Atrasada": "atraso", "Solicitada": "aguardando", "Em cotação": "liberada", "Aprovada": "andamento",
    "Pedido feito": "andamento", "Entregue": "ok", "Cancelada": "cancelada", "A fazer": "liberada",
    "Bloqueada": "atraso", "Baixa": "baixa", "Média": "media", "Alta": "alta", "Urgente": "urgente",
    "A cotar": "aguardando", "Cotação solicitada": "liberada", "Comprado": "andamento",
}


def pill(texto: str) -> str:
    return f'<span class="pill pill-{SLUG.get(texto, "neutro")}">{esc(texto)}</span>'


# ======================================================================= ícones
def _ico(caminho: str, tam: int = 20) -> str:
    return (f'<svg viewBox="0 0 24 24" width="{tam}" height="{tam}" aria-hidden="true" class="ico" fill="none" '
            f'stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">{caminho}</svg>')


ICONES = {
    "painel": '<rect x="3.5" y="3.5" width="7" height="7" rx="1"/><rect x="13.5" y="3.5" width="7" height="7" rx="1"/><rect x="3.5" y="13.5" width="7" height="7" rx="1"/><rect x="13.5" y="13.5" width="7" height="7" rx="1"/>',
    "etapas": '<rect x="5" y="3.5" width="14" height="17" rx="1.5"/><path d="M9 3.5v2h6v-2"/><path d="M8.5 11l2 2 4-4"/><path d="M8.5 16.5h7"/>',
    "compras": '<path d="M3.5 4.5h2.2l2.1 10.2h10.4l2-7.2H6.6"/><circle cx="9.5" cy="18.7" r="1.3"/><circle cx="16.5" cy="18.7" r="1.3"/>',
    "tarefas": '<rect x="3.5" y="4" width="17" height="16" rx="1.5"/><path d="M9.5 4v16M15 4v16"/><path d="M5.5 8h2M11 8h2.5M16.5 8h2M5.5 11.5h2M11 11.5h2.5"/>',
    "obras": '<path d="M3.5 20.5h17"/><path d="M5.5 20.5V9l6.5-4.5 6.5 4.5v11.5"/><path d="M10 20.5v-5h4v5"/><path d="M9 11h1.5M13.5 11H15"/>',
    "bandeira": '<path d="M5.5 21V4"/><path d="M5.5 4.5h11l-2 3.5 2 3.5h-11"/>',
    "calendario": '<rect x="3.5" y="5" width="17" height="15" rx="1.5"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/>',
    "seta": '<path d="M9 6l6 6-6 6"/>',
    "baixo": '<path d="M6 9l6 6 6-6"/>',
    "lixo": '<path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13"/>',
    "check": '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    "filtro": '<path d="M4 5h16l-6.2 7.3V19l-3.6-2v-4.7z"/>',
    "mais": '<path d="M12 5v14M5 12h14"/>',
}


def ico(nome: str, tam: int = 18) -> str:
    return _ico(ICONES[nome], tam)


# cor de cada fase (quadradinho colorido na lista de etapas, como as disciplinas de um projeto)
COR_FASE = {
    "Preparação": "#8d6e4f", "Infraestrutura": "#e0782f", "Supraestrutura": "#c8372d",
    "Vedação e cobertura": "#2f9a58", "Instalações": "#2c87d0", "Acabamentos": "#7e3fa0", "Entrega": "#d9b40f",
}

TITULOS = {"painel": "Painel da obra", "etapas": "Etapas construtivas", "compras": "Compras e materiais",
           "tarefas": "Tarefas", "obras": "Obras"}


# ======================================================================= raiz
def render(sis: Sistema) -> str:
    o = sis.obra
    aba = sis.ui["aba"] if o else "obras"
    corpo = {
        "painel": render_painel, "etapas": render_etapas, "compras": render_compras,
        "tarefas": render_tarefas, "obras": render_obras,
    }[aba](sis)
    return f"""
<div class="app">
{render_trilho(sis)}
<div class="principal">
{render_topo(sis)}
{render_mensagens(sis)}
<main class="conteudo conteudo-{aba}" id="conteudo">{corpo}</main>
<footer class="rodape">Canteiro Digital · núcleo em Python {esc(_versao())} · dados salvos automaticamente</footer>
</div>
</div>
{render_figura(sis) if o else ""}
"""


def _versao() -> str:
    from . import __version__
    return __version__


def render_trilho(sis: Sistema) -> str:
    o = sis.obra
    abas = [("painel", "Painel"), ("etapas", "Etapas"), ("compras", "Compras"), ("tarefas", "Tarefas"), ("obras", "Obras")]
    ativa = sis.ui["aba"] if o else "obras"
    nav = "".join(
        f'<button type="button" class="aba{" ativa" if k == ativa else ""}" data-action="ui.aba" data-aba="{k}" title="{r}"'
        f'{"" if o or k == "obras" else " disabled"}{" aria-current=page" if k == ativa else ""}>'
        f'{ico(k, 21)}<span class="aba-rot">{r}</span>{_contador(sis, k)}</button>'
        for k, r in abas
    )
    return f"""
<nav class="trilho" aria-label="Seções">
  <div class="trilho-marca" title="Canteiro Digital"><span class="marca-ico" aria-hidden="true"></span></div>
  {nav}
</nav>"""


def render_topo(sis: Sistema) -> str:
    o = sis.obra
    aba = sis.ui["aba"] if o else "obras"
    if o:
        seletor = (f'<select id="sel-obra" class="sel-obra" data-action="obra.selecionar" name="id" aria-label="Obra ativa">'
                   + opcoes([x.id for x in _ordenadas(sis)], o.id, [x.nome for x in _ordenadas(sis)]) + "</select>")
        padrao_txt = PADROES.get(o.padrao, {}).get("nome", o.padrao).lower()
        meta = " · ".join(esc(x) for x in (o.cliente, o.endereco, f"{_num(o.area_construida)} m²",
                                          f"padrão {padrao_txt} · {an.moeda(o.valor_m2)}/m²", f"BDI {_num(o.bdi)}%" if o.bdi else "") if x)
        datas = f"{an.data_br(o.inicio)} → {an.data_br(o.fim_previsto)}" if o.inicio else "sem cronograma"
        info = f'<p class="topo-meta">{meta}{" · " if meta else ""}{datas}</p>'
        selo = f'<span class="selo">{"EXEMPLO · " if o.exemplo else ""}{esc(o.padrao)}</span>'
        trilha = (f'<button type="button" class="migalha-link" data-action="ui.aba" data-aba="obras">Obras</button>'
                  f'<span class="migalha-sep" aria-hidden="true">›</span><span class="migalha-atual">{esc(o.nome)}</span>{selo}')
    else:
        seletor, info, trilha = '<span class="sel-obra vazio">Nenhuma obra</span>', "", '<span class="migalha-atual">Obras</span>'
    return f"""
<header class="topo">
  <div class="topo-linha">
    <div class="topo-tit">
      <p class="migalha">{trilha}</p>
      <h1>{TITULOS[aba]}</h1>
    </div>
    <div class="topo-dir">{seletor}</div>
  </div>
  {info}
</header>"""


def _ordenadas(sis: Sistema) -> list[Obra]:
    return sorted(sis.obras.values(), key=lambda x: (x.exemplo, x.nome.lower()))


def _contador(sis: Sistema, aba: str) -> str:
    o = sis.obra
    if not o:
        return ""
    if aba == "compras":
        n = len(an.compras_atrasadas(o, sis.hoje))
    elif aba == "tarefas":
        n = len(an.tarefas_atrasadas(o, sis.hoje))
    else:
        return ""
    return f' <span class="badge" title="atrasadas">{n}</span>' if n else ""


def render_mensagens(sis: Sistema) -> str:
    if sis.ui["erro"]:
        return f'<div class="aviso aviso-erro" role="alert">{esc(sis.ui["erro"])}</div>'
    if sis.ui["msg"]:
        return f'<div class="aviso aviso-ok" role="status">{esc(sis.ui["msg"])}</div>'
    return ""


# ======================================================================= painel
def render_painel(sis: Sistema) -> str:
    o, hoje = sis.obra, sis.hoje
    r = an.resumo(o, hoje)
    fin = r["financeiro"]
    indice = r["idp"]
    idp_txt = "—" if indice is None else f"{indice:.2f}"
    idp_cls = "" if indice is None else ("ok" if indice >= 0.95 else "atencao" if indice >= 0.8 else "critico")
    uso = fin["uso"]
    uso_cls = "" if uso is None else ("critico" if uso > 1 else "atencao" if uso > 0.9 else "ok")

    kpis = f"""
<section class="kpis">
  <div class="kpi">
    <span class="kpi-rot">Avanço físico</span>
    <span class="kpi-val">{pct(r['progresso_fisico'])}</span>
    {barra(r['progresso_fisico'], '', r['progresso_previsto'])}
    <span class="kpi-sub">previsto hoje: {pct(r['progresso_previsto'])}</span>
  </div>
  <div class="kpi kpi-{idp_cls}">
    <span class="kpi-rot">IDP (prazo)</span>
    <span class="kpi-val">{idp_txt}</span>
    <span class="kpi-sub">{'no prazo' if idp_cls == 'ok' else 'atenção ao ritmo' if idp_cls == 'atencao' else 'atrasada' if idp_cls == 'critico' else 'sem previsão ainda'}</span>
  </div>
  <div class="kpi">
    <span class="kpi-rot">Executado (medição)</span>
    <span class="kpi-val">{an.moeda(fin['executado'])}</span>
    {barra(fin['executado_pct'] or 0)}
    <span class="kpi-sub">{pct(fin['executado_pct'])} do orçado · a executar {an.moeda(fin['a_executar'])}{f" · com BDI {_num(fin['bdi'])}%: <b>{an.moeda(fin['executado_bdi'])}</b>" if fin['bdi'] else ""}</span>
  </div>
  <div class="kpi kpi-{uso_cls}">
    <span class="kpi-rot">Comprometido em compras</span>
    <span class="kpi-val">{an.moeda(fin['comprometido'])}</span>
    {barra(uso or 0, 'barra-fin')}
    <span class="kpi-sub">{pct(uso)} de {an.moeda(fin['orcado'])} · entregue {an.moeda(fin['realizado'])}</span>
  </div>
</section>"""

    alertas = r["alertas"]
    if alertas:
        lis = "".join(
            f'<li class="alerta alerta-{a.nivel}"><button type="button" class="alerta-link" data-action="ui.aba" data-aba="{a.aba}">'
            f'<b>{esc(a.titulo)}</b><span>{esc(a.detalhe)}</span></button></li>'
            for a in alertas[:12]
        )
        mais = f'<p class="nota">+ {len(alertas) - 12} alerta(s)</p>' if len(alertas) > 12 else ""
        bloco_alertas = f'<ul class="alertas">{lis}</ul>{mais}'
    else:
        bloco_alertas = '<p class="vazio-txt">Nenhum alerta. Compras, tarefas e etapas em dia.</p>'

    fases = "".join(
        f'<div class="linha-barra"><span class="lb-rot">{esc(cat)}</span>{barra(g["progresso"])}'
        f'<span class="lb-val">{pct(g["progresso"])}<small>{an.moeda(g["executado"])}</small></span></div>'
        for cat, g in r["fases"].items()
    )
    st_et = "".join(f'<li>{pill(k)}<b>{v}</b></li>' for k, v in r["status_etapas"].items() if v)

    cats = r["custos_categoria"]
    maior = max(cats.values(), default=0) or 1
    custos = "".join(
        f'<div class="linha-barra"><span class="lb-rot">{esc(k)}</span>{barra(v / maior, "barra-fin")}'
        f'<span class="lb-val">{an.moeda(v)}</span></div>'
        for k, v in cats.items() if v
    ) or '<p class="vazio-txt">Nenhuma compra aprovada ainda.</p>'

    tarefas = "".join(f'<li>{pill(k)}<b>{v}</b></li>' for k, v in r["tarefas_status"].items() if v) or "<li>Nenhuma tarefa</li>"
    compras = "".join(f'<li>{pill(k)}<b>{v}</b></li>' for k, v in r["compras_status"].items() if v) or "<li>Nenhuma compra</li>"

    custos_etapa = an.custos_por_etapa(o)
    linhas = "".join(
        f'<tr><td><span class="cod">{esc(l["codigo"])}</span> {esc(l["nome"])}</td>'
        f'<td class="num">{pct(l["progresso"])}</td>'
        f'<td class="num">{an.moeda(l["orcado"])}</td>'
        f'<td class="num{" forte" if l["executado"] else ""}">{an.moeda(l["executado"])}</td>'
        + (f'<td class="num">{an.moeda(l["executado_bdi"])}</td>' if o.bdi else "") +
        f'<td class="num">{an.moeda(l["a_executar"])}</td>'
        f'<td class="num">{an.moeda(l["comprometido"])}</td>'
        f'<td class="num {"neg" if l["saldo"] < 0 else ""}">{an.moeda(l["saldo"])}</td></tr>'
        for l in custos_etapa
    )
    tot = {k: sum(l[k] for l in custos_etapa) for k in ("orcado", "executado", "a_executar", "comprometido", "saldo")}
    total = (
        f'<tr><td>Total da obra</td><td class="num">{pct(tot["executado"] / tot["orcado"] if tot["orcado"] else None)}</td>'
        f'<td class="num">{an.moeda(tot["orcado"])}</td><td class="num">{an.moeda(tot["executado"])}</td>'
        + (f'<td class="num">{an.moeda(an.com_bdi(o, tot["executado"]))}</td>' if o.bdi else "") +
        f'<td class="num">{an.moeda(tot["a_executar"])}</td><td class="num">{an.moeda(tot["comprometido"])}</td>'
        f'<td class="num {"neg" if tot["saldo"] < 0 else ""}">{an.moeda(tot["saldo"])}</td></tr>'
    )

    atual = next((c for c, g in r["fases"].items() if g["progresso"] < 1), None)
    trilha = chevrons([(cat, pct(g["progresso"]), "feita" if g["progresso"] >= 1 else "atual" if cat == atual else "",
                        {"fase": cat}) for cat, g in r["fases"].items()], "ui.fase_ir")
    return f"""
<section class="folha folha-fases">{trilha}</section>
{kpis}
{bloco_ia(sis, o, "obra")}
<div class="grade-2">
  <section class="painel-bloco">
    <h2>Alertas <span class="contagem">{len(alertas)}</span></h2>
    {bloco_alertas}
  </section>
  <section class="painel-bloco">
    <h2>Avanço por fase</h2>
    {fases}
    <ul class="contagens">{st_et}</ul>
  </section>
  {_bloco_padrao(o)}
  <section class="painel-bloco">
    <h2>Custos comprometidos por categoria</h2>
    {custos}
  </section>
  <section class="painel-bloco">
    <h2>Compras e tarefas</h2>
    <h3>Compras por situação</h3><ul class="contagens">{compras}</ul>
    <h3>Tarefas por situação</h3><ul class="contagens">{tarefas}</ul>
  </section>
</div>
<section class="painel-bloco">
  <h2>Medição físico-financeira por etapa</h2>
  <p class="nota">Executado = orçado da etapa × avanço do checklist (custo direto). Medição c/ BDI = executado + BDI, valor a faturar ao cliente. Comprometido = compras aprovadas, pedidas ou entregues. Saldo = orçado − comprometido.</p>
  <div class="tabela-wrap"><table class="tabela">
    <thead><tr><th>Etapa</th><th class="num">Avanço</th><th class="num">Orçado</th><th class="num">Executado</th>{f'<th class="num">Medição c/ BDI {_num(o.bdi)}%</th>' if o.bdi else ""}<th class="num">A executar</th><th class="num">Comprometido</th><th class="num">Saldo</th></tr></thead>
    <tbody>{linhas}</tbody>
    <tfoot>{total}</tfoot>
  </table></div>
</section>"""


# ======================================================================= etapas
def chevrons(passos, acao: str) -> str:
    """Faixa de fases em seta (Levantamento → … → Liberado), com a fase atual destacada."""
    out = []
    for rotulo, sub, estado, dados in passos:
        extra = " ".join(f'data-{k}="{esc(v)}"' for k, v in dados.items())
        marca = ico("check", 14) if estado == "feita" else ""
        out.append(f'<button type="button" class="chev{" chev-" + estado if estado else ""}" data-action="{acao}" {extra}>'
                   f'<span class="chev-rot">{marca}{esc(rotulo)}</span><span class="chev-sub">{esc(sub)}</span></button>')
    return f'<nav class="chevrons" aria-label="Fases da obra">{"".join(out)}</nav>'


def etapa_selecionada(sis: Sistema, o: Obra):
    for cod in reversed(sis.ui["abertas"]):
        try:
            return o.etapa(cod)
        except ValueError:
            continue
    pend = [e for e in o.etapas if not an.etapa_concluida(e)]
    return (pend or o.etapas or [None])[0]


def render_etapas(sis: Sistema) -> str:
    o, hoje = sis.obra, sis.hoje
    sel = etapa_selecionada(sis, o)
    fase = sis.ui.get("fase", "")
    banner = ""
    if o.modelo_etapas < MODELO_VERSAO:
        banner = f"""
<section class="folha banner-modelo">
  <h2>Modelo de etapas revisado para residência de 100 m²</h2>
  <p>Sequência corrigida (alvenaria em paralelo com a estrutura), pesos de custo revisados, novos itens de checklist e cronograma pela duração típica de cada etapa.
  Itens já marcados, itens que você criou, observações e orçamentos ajustados à mão são mantidos. Como entram itens novos, a porcentagem de avanço pode baixar.</p>
  <div class="linha-acoes">{botao("Aplicar modelo revisado", "obra.atualizar_modelo", "btn")}</div>
</section>"""

    # lista (mestre)
    grupos = []
    for cat in CATEGORIAS:
        if fase and cat != fase:
            continue
        etapas = [e for e in o.etapas if e.categoria == cat]
        if not etapas:
            continue
        linhas = "".join(
            f'<button type="button" class="md-item{" ativo" if sel and e.codigo == sel.codigo else ""}" data-action="ui.expandir" '
            f'data-codigo="{esc(e.codigo)}" aria-expanded="{str(bool(sel and e.codigo == sel.codigo)).lower()}">'
            f'<span class="cor" style="--cor:{COR_FASE.get(cat, "#888")}"></span><span class="md-cod">{esc(e.codigo)}</span>'
            f'<span class="md-nome">{esc(e.nome)}</span>'
            f'<span class="md-pct md-{SLUG.get(an.status_etapa(o, e, hoje), "")}">{pct(an.progresso_etapa(e))}</span></button>'
            for e in etapas
        )
        grupos.append(f'<div class="md-grupo"><p class="md-grupo-tit">{esc(cat)}</p>{linhas}</div>')
    filtro = (f'<button type="button" class="chip ativo" data-action="ui.fase" data-fase="">{ico("filtro", 14)} {esc(fase)} '
              f'<span class="chip-x" aria-hidden="true">×</span></button>' if fase else "")

    # faixa de fases
    progresso = {c: [] for c in CATEGORIAS}
    for e in o.etapas:
        progresso.setdefault(e.categoria, []).append(e)
    passos = []
    for cat in CATEGORIAS:
        es = progresso.get(cat) or []
        if not es:
            continue
        prog = sum(an.progresso_etapa(e) * (e.peso or 1) for e in es) / (sum(e.peso or 1 for e in es) or 1)
        estado = "atual" if (fase == cat or (not fase and sel and sel.categoria == cat)) else "feita" if prog >= 1 else ""
        passos.append((cat, pct(prog), estado, {"fase": cat}))

    detalhe_html = _card_etapa(sis, o, sel, hoje) if sel else '<p class="vazio-txt">Nenhuma etapa.</p>'
    return f"""
{banner}
<div class="md">
  <aside class="md-lista folha" aria-label="Etapas da obra">
    <div class="md-lista-cab"><span>Etapas da obra</span><span class="contagem">{len(o.etapas)}</span></div>
    {filtro}
    {''.join(grupos)}
  </aside>
  <section class="md-detalhe folha">
    {chevrons(passos, "ui.fase_ir")}
    {detalhe_html}
  </section>
</div>"""


def _card_etapa(sis: Sistema, o: Obra, e, hoje) -> str:
    st = an.status_etapa(o, e, hoje)
    prog = an.progresso_etapa(e)
    feitos = sum(1 for i in e.checklist if i.feito)
    datas = (f"{an.data_br(e.inicio_previsto)} – {an.data_br(e.fim_previsto)}" if e.inicio_previsto else "sem datas")
    itens = "".join(
        f'<li class="chk{" feito" if i.feito else ""}">'
        f'<button type="button" class="chk-btn" data-action="etapa.item" data-codigo="{esc(e.codigo)}" data-item="{esc(i.id)}" '
        f'aria-pressed="{str(i.feito).lower()}"><span class="chk-caixa" aria-hidden="true"></span>'
        f'<span class="chk-num">{n:02d}</span><span class="chk-txt">{esc(i.texto)}</span>'
        f'{f"<span class=chk-data>{an.data_br(i.concluido_em)}</span>" if i.feito else ""}</button>'
        f'<span class="chk-acoes">'
        f'{botao(ICONE_IMAGEM, "ui.figura", "btn-fig", "Ver imagem de referência", codigo=e.codigo, item=i.id) if tem_figura(i.texto) else ""}'
        f'{botao(ico("lixo", 16), "etapa.remover_item", "btn-x", "Remover item", codigo=e.codigo, item=i.id)}</span></li>'
        for n, i in enumerate(e.checklist, 1)
    )
    pend = an.predecessoras_pendentes(o, e)
    aviso_pred = (f'<p class="nota nota-atencao">Aguardando: {esc(", ".join(_nome_etapa(o, p) for p in pend))}</p>' if pend else "")
    normas = f'<p class="nota">Normas: {esc(" · ".join(e.normas))}</p>' if e.normas else ""
    todos = (botao("Desmarcar todos", "etapa.todos", "acao-link", codigo=e.codigo, feito="0") if feitos == len(e.checklist) and e.checklist
             else botao("Marcar todos", "etapa.todos", "acao-link", codigo=e.codigo, feito="1"))
    ver_detalhe = (botao("Detalhe técnico da etapa", "ui.figura", "acao-link", codigo=e.codigo, item="_etapa")
                   if detalhe(e.codigo) else "")
    replanejar = botao("Recalcular cronograma", "obra.replanejar", "acao-link") if o.inicio and o.fim_previsto else ""
    obs_tag = ' <span class="tag-obs">observação</span>' if e.observacao else ""
    return f"""
<article class="etapa-det etapa-{SLUG.get(st, "")}" aria-expanded="true">
  <div class="acoes-faixa">
    {todos}{ver_detalhe}{replanejar}
    <span class="acoes-info">Exibindo {len(e.checklist)} itens</span>
  </div>
  <header class="etapa-cab-det">
    <span class="tag-tipo" style="--cor:{COR_FASE.get(e.categoria, "#888")}">{esc(e.codigo)}</span>
    <div class="etapa-cab-txt">
      <h2><span class="cod-fraco">({esc(e.codigo)})</span> {esc(e.nome)}</h2>
      <p class="meta-linha">
        <span>{ico("bandeira", 15)} {esc(e.categoria)}</span><span class="sep">|</span>{pill(st)}<span class="sep">|</span>
        <span>{ico("calendario", 15)} {datas}</span><span class="sep">|</span><span>{an.moeda(e.orcamento)} · peso {e.peso:g}%{f" · {e.duracao_dias} dias úteis" if e.duracao_dias else ""}</span>{obs_tag}
      </p>
      {barra(prog, '', an.fracao_prevista(e, hoje) if e.inicio_previsto else None)}
    </div>
    <span class="etapa-pct">{pct(prog)}<small>{feitos}/{len(e.checklist)} itens</small></span>
  </header>
  {aviso_pred}
  <section class="etapa-sec">
    <h3>Checklist de execução e qualidade <span class="contagem">{feitos}/{len(e.checklist)}</span></h3>
    <ul class="checklist lista-linhas">{itens}</ul>
    <form class="form-inline form-novo-item" data-action="etapa.novo_item" data-codigo="{esc(e.codigo)}">
      <input id="novo-item-{esc(e.codigo)}" name="texto" placeholder="Novo item de checklist" aria-label="Novo item de checklist" maxlength="200" required>
      <button class="btn" type="submit">{ico("mais", 16)} Adicionar item</button>
    </form>
  </section>
  <section class="etapa-sec">
    <h3>Escopo e especificações técnicas</h3>
    {_detalhes_etapa(o, e)}
    {normas}
  </section>
  <div class="grade-2 etapa-forms">
    <section class="etapa-sec">
      <h3>Observações da etapa</h3>
      <form class="form-obs" data-action="etapa.observacao" data-codigo="{esc(e.codigo)}">
        <textarea id="obs-{esc(e.codigo)}" name="observacao" rows="3" maxlength="2000"
          placeholder="Ex.: fornecedor, alteração de projeto, condição do terreno, combinado com o cliente…"
          aria-label="Observações da etapa {esc(e.nome)}">{esc(e.observacao)}</textarea>
        <button class="btn btn-sec" type="submit">Salvar observação</button>
      </form>
    </section>
    <section class="etapa-sec">
      <h3>Prazo e orçamento</h3>
      <form class="form-grade form-etapa" data-action="etapa.salvar" data-codigo="{esc(e.codigo)}">
        <label>Início previsto<input id="ini-{esc(e.codigo)}" type="date" name="inicio_previsto" value="{esc(e.inicio_previsto)}"></label>
        <label>Fim previsto<input id="fim-{esc(e.codigo)}" type="date" name="fim_previsto" value="{esc(e.fim_previsto)}"></label>
        <label class="largo">Orçamento (R$){campo_num(f"orc-{e.codigo}", "orcamento", e.orcamento)}</label>
        <button class="btn btn-sec" type="submit">Salvar etapa</button>
      </form>
    </section>
  </div>
  {bloco_ia(sis, o, "etapa", e.codigo)}
</article>"""


def _nome_etapa(o: Obra, codigo: str) -> str:
    try:
        return o.etapa(codigo).nome
    except ValueError:
        return codigo


def qtd_escalada(qtd: float, un: str, area: float) -> str:
    """Quantitativo de referência (100 m²) ajustado à área da obra."""
    v = qtd * (area or 100) / 100
    if un in ("un", "vb", "mês"):
        v = max(1, round(v))
    elif v >= 10:
        v = round(v)
    else:
        v = round(v, 1)
    return _num(v)


def _detalhes_etapa(o: Obra, e) -> str:
    if not (e.descricao or e.servicos or e.equipe or e.atencao):
        return ""
    area = o.area_construida or 100
    itens = []
    for sv_ in e.servicos:
        nome = sv_.get("servico", "")
        qtd = f'{qtd_escalada(float(sv_.get("qtd", 0)), sv_.get("un", ""), area)} {esc(sv_.get("un", ""))}'
        spec = especificacao(e.codigo, nome)
        if spec:
            itens.append(
                f'<li><details><summary><span>{esc(nome)}</span><span class="qtd">{qtd}</span></summary>'
                f'<dl class="espec-corpo"><dt>Especificação</dt><dd>{esc(spec["especificacao"])}</dd>'
                f'<dt>Execução</dt><dd>{esc(spec["execucao"])}</dd>'
                f'<dt>Aceitação</dt><dd>{esc(spec["aceitacao"])}</dd></dl></details></li>')
        else:
            itens.append(f'<li><div class="espec-simples"><span>{esc(nome)}</span><span class="qtd">{qtd}</span></div></li>')
    quant = (f'<div class="det-bloco det-largo"><h4>Serviços, quantitativos e especificações técnicas · {_num(area)} m²</h4>'
             f'<ul class="espec-lista">{"".join(itens)}</ul>'
             f'<p class="nota">Toque em um serviço para ver especificação, execução e critério de aceitação. '
             f'Quantidades estimadas; o projeto e o memorial descritivo prevalecem.</p></div>') if itens else ""
    seq = ", ".join(_nome_etapa(o, p) for p in e.predecessoras) or "início da obra"
    prazo = f"{e.duracao_dias} dias úteis (típico)" if e.duracao_dias else "—"
    equipe = (f'<div class="det-bloco"><h4>Equipe e prazo</h4><dl class="det-dl">'
              f'<dt>Equipe</dt><dd>{esc(e.equipe or "—")}</dd><dt>Duração</dt><dd>{prazo}</dd>'
              f'<dt>Começa após</dt><dd>{esc(seq)}</dd></dl></div>')
    atencao = "".join(f"<li>{esc(a)}</li>" for a in e.atencao)
    atencao = f'<div class="det-bloco det-atencao"><h4>Pontos de atenção</h4><ul>{atencao}</ul></div>' if atencao else ""
    desc = f'<p class="etapa-desc">{esc(e.descricao)}</p>' if e.descricao else ""
    return f'{desc}<div class="det-grade">{quant}{equipe}{atencao}</div>'


# ======================================================================= compras
FILTROS_COMPRA = (("abertas", "Em aberto"), ("atrasadas", "Atrasadas"), ("todas", "Todas"),
                  ("Entregue", "Entregues"), ("Cancelada", "Canceladas"))


def _vistas_compras(sis: Sistema) -> str:
    atual = sis.ui["compras_vista"]
    o = sis.obra
    pend = sum(1 for e in o.etapas if not an.etapa_concluida(e)
               for x in sv.situacao_materiais(o, e.codigo) if x["situacao"] == "Não solicitado")
    ctl = f'<span class="contagem">{len(o.controle)} itens</span>' if o.controle else '<span class="contagem">novo</span>'
    opcoes_v = (("controle", f"Controle de compras {ctl}"),
                ("pedidos", f"Pedidos de compra <span class=\"contagem\">{len(o.compras)}</span>"),
                ("materiais", f"Lista de materiais por etapa <span class=\"contagem\">{pend} a pedir</span>"))
    return '<nav class="vistas" aria-label="Compras">' + "".join(
        f'<button type="button" class="vista{" ativa" if k == atual else ""}" data-action="ui.vista_compras" data-vista="{k}"'
        f'{" aria-current=page" if k == atual else ""}>{r}</button>' for k, r in opcoes_v) + "</nav>"


def render_compras(sis: Sistema) -> str:
    if sis.ui["compras_vista"] == "materiais":
        return _vistas_compras(sis) + render_materiais(sis)
    if sis.ui["compras_vista"] == "controle":
        return _vistas_compras(sis) + render_controle(sis)
    return _vistas_compras(sis) + _render_pedidos(sis)


# ----------------------------------------------------------------------- controle de compras (metodologia)
PASSOS_METODOLOGIA = (
    ("1. Base", "Quantidade × preço de referência de cada material e serviço (valor orçado, sem BDI). "
                "Linhas com quantidade estimada ficam marcadas para conferir no projeto."),
    ("2. Programação", "Cada item ganha um “comprar até”: início previsto da etapa menos 7 dias para material "
                       "e 3 dias para contratar mão de obra. Prazos vencidos ou da semana viram alerta no Painel."),
    ("3. Cotação", "Registre até 3 fornecedores com preço à vista e a prazo. O menor preço na forma de pagamento "
                   "escolhida é selecionado sozinho; você pode escolher outro."),
    ("4. Decisão", "Defina à vista ou a prazo e o nº de parcelas: o sistema calcula o valor aplicado, o total da compra e a parcela."),
    ("5. Compra e entrega", "“Comprado” exige cotação escolhida e registra a data; “Entregue” fecha o item. "
                            "Itens comprados entram no comprometido e na medição por etapa do Painel."),
    ("6. Controle", "Diferença compra × base por item e por etapa (verde = economia, vermelho = estouro) "
                    "e fluxo mensal de pagamentos das compras a prazo."),
)

PROXIMO_STATUS = {"A cotar": ("Cotação solicitada", "Solicitar cotação"),
                  "Cotação solicitada": ("Comprado", "Marcar comprado"),
                  "Comprado": ("Entregue", "Marcar entregue")}


def _cor_etapa_ctl(o: Obra, etapa_base: str) -> str:
    for i in o.controle:
        if i.etapa_base == etapa_base and i.etapa:
            try:
                return COR_FASE.get(o.etapa(i.etapa).categoria, "#888")
            except ValueError:
                continue
    return "#888"


def _pct_br(v: float | None) -> str:
    return "—" if v is None else f"{v:+.1%}".replace(".", ",")


def _dif(v: float | None) -> str:
    if v is None:
        return '<span class="nota">—</span>'
    cls = "ok-txt" if v > 0.005 else "neg" if v < -0.005 else ""
    return f'<span class="{cls}">{an.moeda(v)}</span>'


def render_controle(sis: Sistema) -> str:
    from . import controle as ct
    from .base_compras import AREA_REFERENCIA, ITENS_BASE

    o = sis.obra
    metodo = "".join(f"<li><b>{esc(t)}</b><span>{esc(d)}</span></li>" for t, d in PASSOS_METODOLOGIA)
    metodologia = f'<details class="metodologia"><summary>Metodologia de compras — como funciona</summary><ol>{metodo}</ol></details>'
    if not o.controle:
        total = sum(q * b for (_, _, _, _, _, _, q, b, *_r) in ITENS_BASE)
        ajustar = ""
        if o.area_construida and abs(o.area_construida - AREA_REFERENCIA) / AREA_REFERENCIA > 0.01:
            ajustar = botao(f"Carregar ajustando quantidades para {_num(o.area_construida)} m²", "ctrl.carregar", "btn btn-sec", ajustar="1")
        return f"""
<section class="folha vazio-ctl">
  <div class="vazio-ctl-txt">
    <h2>Controle de compras pela planilha</h2>
    <p>Carregue a base da planilha <b>Controle e Gestão de Compras da Obra</b>: {len(ITENS_BASE)} itens de material e mão de obra em 9 etapas,
    com quantidades e preços de referência (residência de {_num(AREA_REFERENCIA)} m², total base {an.moeda(total)}, sem BDI).
    Todos os itens entram como estão; depois é só cotar, decidir a forma de pagamento e registrar compra e entrega.</p>
    <div class="linha-acoes">{botao(f"Carregar base da planilha ({len(ITENS_BASE)} itens)", "ctrl.carregar", "btn", ajustar="0")}{ajustar}</div>
  </div>
  {metodologia}
</section>"""

    r = ct.resumo(o)
    filtro = sis.ui["ctrl_status"]
    passos = [(st, f"{n} {'item' if n == 1 else 'itens'}", "atual" if st == filtro else "", {"status": st}) for st, n in r["status"].items()]
    chev = chevrons(passos, "ui.ctrl_status").replace('aria-label="Fases da obra"', 'aria-label="Situação dos itens"')
    faixa = f"""
<div class="acoes-faixa ctl-totais">
  <span>Base <b>{an.moeda(r['base'])}</b></span>
  <span>Cotado <b>{an.moeda(r['compra'])}</b></span>
  <span>Comprado <b>{an.moeda(r['comprado'])}</b></span>
  <span>Diferença nos cotados <b>{_dif(r['diferenca'])}</b>{f" ({_pct_br(r['variacao'])})" if r['variacao'] is not None else ""}</span>
  <span class="acoes-info">{esc(o.controle_origem or "Itens incluídos manualmente")}</span>
</div>"""
    sel = sis.ui["ctrl_etapa"]
    etapas = ct.etapas_controle(o)
    if sel and sel not in etapas:
        sel = ""
    lista = [f'<button type="button" class="md-item{" ativo" if not sel else ""}" data-action="ui.ctrl_etapa" data-etapa="">'
             f'<span class="cor" style="--cor:var(--tinta)"></span><span class="md-cod">Σ</span><span class="md-nome">Resumo geral</span>'
             f'<span class="md-pct">{r["itens"]}</span></button>']
    for e in etapas:
        ln = r["linhas"][e]
        num, _, nome = e.partition(". ")
        cls = " md-ok" if ln["comprados"] == ln["itens"] else ""
        lista.append(
            f'<button type="button" class="md-item{" ativo" if e == sel else ""}" data-action="ui.ctrl_etapa" data-etapa="{esc(e)}">'
            f'<span class="cor" style="--cor:{_cor_etapa_ctl(o, e)}"></span><span class="md-cod">{esc(num)}</span>'
            f'<span class="md-nome" title="{esc(nome)}">{esc(nome)}</span><span class="md-pct{cls}">{ln["comprados"]}/{ln["itens"]}</span></button>')
    corpo = _ctl_etapa(sis, o, sel) if sel else _ctl_resumo(sis, o, r)
    return f"""
<section class="folha folha-fases">{chev}{faixa}</section>
{metodologia}
<div class="md">
  <aside class="md-lista folha" aria-label="Etapas do controle de compras">
    <div class="md-lista-cab"><span>Etapas da planilha</span>{botao("+ Item", "ui.ctrl_novo", "acao-link")}</div>
    {''.join(lista)}
  </aside>
  <section class="md-detalhe folha">{_ctl_form_novo(o, sel) if sis.ui["ctrl_novo"] else ""}{corpo}</section>
</div>"""


def _ctl_form_novo(o: Obra, sel: str) -> str:
    from . import controle as ct

    etapas = ct.etapas_controle(o)
    return f"""
<form class="form-grade ctl-novo" data-action="ctrl.novo">
  <label class="largo">Material / serviço<input id="cn-desc" name="descricao" required maxlength="200"></label>
  <label>Etapa<select id="cn-etapa" name="etapa_base">{opcoes(etapas, sel or (etapas[0] if etapas else ""))}</select></label>
  <label>Tipo<select id="cn-tipo" name="tipo">{opcoes(["material", "mao_de_obra"], "material", ["Material", "Mão de obra"])}</select></label>
  <label>Grupo<input id="cn-grupo" name="grupo" maxlength="60" placeholder="Ex.: Alvenaria"></label>
  <label>Especificação<input id="cn-esp" name="especificacao" maxlength="200"></label>
  <label>Unidade<input id="cn-un" name="unidade" maxlength="20" value="un"></label>
  <label>Quantidade{campo_num("cn-qtd", "quantidade", texto="1", placeholder="1")}</label>
  <label>Valor unit. base (R$){campo_num("cn-vb", "valor_base")}</label>
  <button class="btn" type="submit">Incluir item</button>
</form>"""


def _ctl_resumo(sis: Sistema, o: Obra, r: dict) -> str:
    from . import controle as ct

    linhas = "".join(
        f'<tr><td><button type="button" class="link-tab" data-action="ui.ctrl_etapa" data-etapa="{esc(e)}">{esc(e)}</button></td>'
        f'<td class="num">{ln["itens"]}</td><td class="num">{an.moeda(ln["base_materiais"])}</td>'
        f'<td class="num">{an.moeda(ln["base_mao_obra"])}</td><td class="num"><b>{an.moeda(ln["base"])}</b></td>'
        f'<td class="num">{an.moeda(ln["compra"])}</td><td class="num">{_dif(ln["diferenca"])}</td>'
        f'<td class="num">{_pct_br(ln["variacao"])}</td></tr>'
        for e, ln in r["linhas"].items()
    )
    total = (f'<tr><td>Total geral da obra</td><td class="num">{r["itens"]}</td><td class="num">{an.moeda(r["base_materiais"])}</td>'
             f'<td class="num">{an.moeda(r["base_mao_obra"])}</td><td class="num">{an.moeda(r["base"])}</td>'
             f'<td class="num">{an.moeda(r["compra"])}</td><td class="num">{_dif(r["diferenca"])}</td>'
             f'<td class="num">{_pct_br(r["variacao"])}</td></tr>')
    prog = ct.programacao(o, sis.hoje, dias=30)
    if prog:
        itens_p = "".join(
            f'<li class="{"vencido" if ate < sis.hoje else ""}"><span class="prog-data">{an.data_br(ate.isoformat())}</span>'
            f'<span class="prog-desc"><b>{esc(it.descricao)}</b> <span class="nota">{esc(it.etapa_base)} · {_num(it.quantidade)} {esc(it.unidade)}</span></span>'
            f'{pill(it.status)}</li>' for it, ate in prog[:15])
        mais = f'<p class="nota">+ {len(prog) - 15} item(ns)</p>' if len(prog) > 15 else ""
        programacao = f'<ul class="prog-lista">{itens_p}</ul>{mais}'
    elif not any(e.inicio_previsto for e in o.etapas):
        programacao = '<p class="nota">Defina o cronograma da obra (datas das etapas) para o sistema calcular os prazos de compra.</p>'
    else:
        programacao = '<p class="vazio-txt">Nenhum item com prazo de compra nos próximos 30 dias.</p>'
    fluxo = ct.fluxo_pagamentos(o)
    if fluxo:
        maior = max(fluxo.values()) or 1
        fluxo_html = "".join(
            f'<div class="linha-barra"><span class="lb-rot">{esc(m)}</span>{barra(v / maior, "barra-fin")}'
            f'<span class="lb-val">{an.moeda(v)}</span></div>' for m, v in fluxo.items())
    else:
        fluxo_html = '<p class="vazio-txt">Aparece quando houver itens comprados (à vista no mês da compra; a prazo em parcelas a partir do mês seguinte).</p>'
    est = (f'<p class="nota nota-atencao">{r["qtd_estimada"]} itens com quantidade estimada — confira com o projeto executivo antes de comprar.</p>'
           if r["qtd_estimada"] else "")
    return f"""
<div class="etapa-sec">
  <h3>Resumo geral por etapa</h3>
  <p class="nota">Valor de compra = soma das cotações escolhidas. Diferença e variação comparam só os itens já cotados com a base deles (positivo = economia).</p>
  {est}
  <div class="tabela-wrap"><table class="tabela tabela-ctl-resumo">
    <thead><tr><th>Etapa</th><th class="num">Nº de itens</th><th class="num">Base materiais</th><th class="num">Base mão de obra</th>
    <th class="num">Base total</th><th class="num">Valor de compra</th><th class="num">Diferença</th><th class="num">% variação</th></tr></thead>
    <tbody>{linhas}</tbody><tfoot>{total}</tfoot>
  </table></div>
</div>
<div class="grade-2 etapa-forms">
  <section class="etapa-sec"><h3>Programação de compras · próximos 30 dias</h3>{programacao}</section>
  <section class="etapa-sec"><h3>Fluxo de pagamentos (itens comprados)</h3>{fluxo_html}</section>
</div>"""


def _ctl_etapa(sis: Sistema, o: Obra, etapa_base: str) -> str:
    from . import controle as ct

    filtro = sis.ui["ctrl_status"]
    todos = [i for i in o.controle if i.etapa_base == etapa_base]
    itens = [i for i in todos if not filtro or i.status == filtro]
    blocos = []
    for tipo, titulo in (("material", "Materiais"), ("mao_de_obra", "Mão de obra — serviços desta etapa")):
        grupo = [i for i in itens if i.tipo == tipo]
        if not grupo:
            continue
        linhas = "".join(_ctl_linha(sis, o, i) for i in grupo)
        sub_base = sum(i.total_base for i in grupo)
        sub_compra = sum(i.total_compra for i in grupo)
        blocos.append(
            f'<tbody class="ctl-bloco"><tr class="ctl-sec"><td colspan="7">{titulo}</td></tr>{linhas}'
            f'<tr class="ctl-sub"><td colspan="2">Subtotal {titulo.split(" —")[0].lower()}</td><td class="num">{an.moeda(sub_base)}</td>'
            f'<td class="num">{an.moeda(sub_compra)}</td><td class="num">{_dif(round(sum(i.total_base for i in grupo if i.total_compra) - sub_compra, 2) if sub_compra else None)}</td><td colspan="2"></td></tr></tbody>')
    base = sum(i.total_base for i in todos)
    compra = sum(i.total_compra for i in todos)
    num, _, nome = etapa_base.partition(". ")
    vazio = '' if blocos else '<p class="vazio-txt" style="padding:16px">Nenhum item nesta situação.</p>'
    return f"""
<header class="etapa-cab-det">
  <span class="tag-tipo" style="--cor:{_cor_etapa_ctl(o, etapa_base)}">{esc(num)}</span>
  <div class="etapa-cab-txt">
    <h2>{esc(nome or etapa_base)}</h2>
    <p class="meta-linha"><span>{len(todos)} itens</span><span class="sep">|</span><span>Base {an.moeda(base)}</span><span class="sep">|</span>
    <span>Compra {an.moeda(compra)}</span>{f'<span class="sep">|</span><span class="chip ativo chip-mini">{esc(filtro)}</span>' if filtro else ""}</p>
  </div>
  <span class="etapa-pct">{sum(1 for i in todos if not ct.pendente(i))}/{len(todos)}<small>comprados</small></span>
</header>
<p class="nota ctl-legenda"><span class="leg leg-est"></span> quantidade estimada (validar no projeto) · <span class="leg leg-novo"></span> item novo ·
<span class="tag-mo">MO</span> mão de obra · toque em <b>Cotar</b> para registrar fornecedores e forma de pagamento.</p>
<div class="tabela-wrap"><table class="tabela tabela-ctl">
  <thead><tr><th>Material / serviço</th><th class="num">Qtd.</th><th class="num">Base</th>
  <th class="num">Compra</th><th class="num">Diferença</th><th>Situação</th><th>Ações</th></tr></thead>
  {''.join(blocos)}
</table></div>{vazio}"""


def _ctl_linha(sis: Sistema, o: Obra, it) -> str:
    from . import controle as ct

    aberto = sis.ui["ctrl_item"] == it.id
    ate = ct.comprar_ate(o, it)
    prazo = ""
    if ate and ct.pendente(it):
        venc = ate < sis.hoje
        prazo = f'<span class="ctl-prazo{" vencido" if venc else ""}">{"vencido " if venc else ""}até {an.data_br(ate.isoformat())}</span>'
    elif it.data_entrega:
        prazo = f'<span class="ctl-prazo">entregue {an.data_br(it.data_entrega)}</span>'
    elif it.data_compra:
        prazo = f'<span class="ctl-prazo">comprado {an.data_br(it.data_compra)}</span>'
    prox = PROXIMO_STATUS.get(it.status)
    avancar = ""
    if prox and not (prox[0] in ("Comprado", "Entregue") and not it.total_compra):
        avancar = botao(prox[1], "ctrl.status", "btn btn-mini", id=it.id, status=prox[0])
    cotar = botao("Fechar" if aberto else ("Editar" if it.cotacoes else "Cotar"), "ui.ctrl_item", "btn btn-sec btn-mini", id=it.id)
    forn = f'<small class="ctl-forn">{esc(it.fornecedor)} · {esc(it.forma or "")}{f" {it.parcelas}x {an.moeda(it.valor_parcela)}" if it.forma == "A Prazo" and it.parcelas > 1 else ""}</small>' if it.fornecedor else ""
    classes = "ctl-linha" + (" ctl-est" if it.qtd_estimada else "") + (" ctl-novo" if it.novo else "") + (" aberta" if aberto else "")
    mo = '<span class="tag-mo">MO</span> ' if it.tipo == "mao_de_obra" else ""
    compra = (f'{an.moeda(it.total_compra)}<small>{an.moeda(it.valor_aplicado)}/{esc(it.unidade)}</small>'
              if it.total_compra else "—")
    linha = (
        f'<tr class="{classes}">'
        f'<td class="ctl-desc"><span class="ctl-grupo">{mo}{esc(it.grupo)}</span><b>{esc(it.descricao)}</b>'
        f'{f"<small>{esc(it.especificacao)}</small>" if it.especificacao else ""}{forn}</td>'
        f'<td class="num">{_num(it.quantidade)} {esc(it.unidade)}</td>'
        f'<td class="num">{an.moeda(it.total_base)}<small class="ctl-base">{an.moeda(it.valor_base)}/{esc(it.unidade)}</small></td>'
        f'<td class="num">{compra}</td>'
        f'<td class="num">{_dif(it.diferenca)}</td>'
        f'<td class="ctl-st">{pill(it.status)}{prazo}</td>'
        f'<td class="ctl-acoes">{cotar}{avancar}</td></tr>'
    )
    if aberto:
        linha += f'<tr class="ctl-edicao"><td colspan="7">{_ctl_form(sis, it)}</td></tr>'
    return linha


def _ctl_form(sis: Sistema, it) -> str:
    from . import controle as ct
    from .modelos import FORMAS_PAGAMENTO

    melhor = ct.melhor_cotacao(it)
    auto = it.escolhida == melhor
    linhas = []
    for n in range(1, ct.MAX_COTACOES + 1):
        c = it.cotacoes[n - 1] if n <= len(it.cotacoes) else {}
        marca = ' <span class="tag-melhor">menor preço</span>' if melhor == n - 1 else ""
        chk = " checked" if (not auto and it.escolhida == n - 1) else ""
        linhas.append(
            f'<tr><td>{n}</td><td><input id="cf-{it.id}-{n}" name="fornecedor_{n}" value="{esc(c.get("fornecedor", ""))}" maxlength="200" '
            f'placeholder="Fornecedor {n}" aria-label="Fornecedor {n}"></td>'
            f'<td>{campo_num(f"cv-{it.id}-{n}", f"vista_{n}", c.get("vista") or None, rotulo=f"À vista, cotação {n}")}</td>'
            f'<td>{campo_num(f"cp-{it.id}-{n}", f"prazo_{n}", c.get("prazo") or None, rotulo=f"A prazo, cotação {n}")}</td>'
            f'<td><label class="radio"><input type="radio" name="escolhida" value="{n - 1}"{chk}> usar{marca}</label></td></tr>')
    excluir = ""
    if it.status not in ("Comprado", "Entregue"):
        if sis.ui["ctrl_excluir"] == it.id:
            excluir = (f'<span class="confirma">Remover este item do controle? '
                       f'{botao("Sim, remover", "ctrl.remover", "btn btn-perigo btn-mini", id=it.id)}'
                       f'{botao("Cancelar", "ui.ctrl_item", "btn btn-sec btn-mini", id=it.id)}</span>')
        else:
            excluir = botao("Remover item", "ctrl.remover", "btn-link", id=it.id)
    voltar = ""
    if it.status in ("Comprado", "Entregue"):
        voltar = botao("Voltar para cotação", "ctrl.status", "btn-link", id=it.id, status="Cotação solicitada")
    fonte = f" · preço {it.fonte_preco}" if it.fonte_preco else ""
    return f"""
<form class="ctl-form" data-action="ctrl.salvar" data-id="{esc(it.id)}">
  <div class="form-grade ctl-form-base">
    <label>Quantidade ({esc(it.unidade)}){campo_num(f"cq-{it.id}", "quantidade", texto=_num(it.quantidade))}</label>
    <label>Valor unit. base (R$){campo_num(f"cb-{it.id}", "valor_base", it.valor_base)}</label>
    <label>Forma de pagamento<select id="cfp-{it.id}" name="forma">{opcoes([""] + list(FORMAS_PAGAMENTO), it.forma, ["—"] + list(FORMAS_PAGAMENTO))}</select></label>
    <label>Nº de parcelas{campo_num(f"cpa-{it.id}", "parcelas", texto=str(it.parcelas or ""), placeholder="1")}</label>
  </div>
  <div class="tabela-wrap"><table class="tabela tabela-cot">
    <thead><tr><th>#</th><th>Fornecedor / prestador</th><th class="num">À vista (R$/{esc(it.unidade)})</th><th class="num">A prazo (R$/{esc(it.unidade)})</th><th>Escolha</th></tr></thead>
    <tbody>{''.join(linhas)}
    <tr><td></td><td colspan="3" class="nota">Sem escolha marcada, o sistema usa o menor preço na forma de pagamento.</td>
    <td><label class="radio"><input type="radio" name="escolhida" value=""{" checked" if auto else ""}> automático</label></td></tr></tbody>
  </table></div>
  <label class="ctl-obs">Observações<textarea id="co-{it.id}" name="observacao" rows="2" maxlength="500">{esc(it.observacao)}</textarea></label>
  <p class="nota">Base: {_num(it.quantidade)} {esc(it.unidade)} × {an.moeda(it.valor_base)} = <b>{an.moeda(it.total_base)}</b>{fonte}{" · quantidade estimada" if it.qtd_estimada else ""}.
  Situação: {esc(it.status)}{f" desde {an.data_br(it.data_compra)}" if it.data_compra else ""}.</p>
  <div class="linha-acoes"><button class="btn" type="submit">Salvar cotação</button>{voltar}{excluir}</div>
</form>"""


def render_materiais(sis: Sistema) -> str:
    o, hoje = sis.obra, sis.hoje
    f_etapa = sis.ui["filtro_etapa"]
    etapas = [e for e in o.etapas if not f_etapa or e.codigo == f_etapa]
    total = pedidos = entregues = 0
    blocos = []
    for e in etapas:
        linhas = sv.situacao_materiais(o, e.codigo)
        if not linhas:
            continue
        n_pend = sum(1 for x in linhas if x["situacao"] == "Não solicitado")
        n_ent = sum(1 for x in linhas if x["situacao"] == "Entregue")
        total += len(linhas)
        pedidos += len(linhas) - n_pend
        entregues += n_ent
        blocos.append(_bloco_materiais(sis, o, e, linhas, n_pend, n_ent, hoje))
    sel_etapa = (f'<select id="filtro-etapa-mat" data-action="ui.filtro" name="filtro_etapa" aria-label="Filtrar por etapa">'
                 + opcoes([""] + [e.codigo for e in o.etapas], f_etapa, ["Todas as etapas"] + [f"{e.codigo} · {e.nome}" for e in o.etapas])
                 + "</select>")
    return f"""
<div class="barra-acoes">
  <p class="nota">{total} materiais · <b>{pedidos}</b> já pedidos · {entregues} entregues · quantidades para {_num(o.area_construida)} m² (inclui perdas usuais).</p>
  {sel_etapa}
</div>
<p class="nota">Lista ajustada ao padrão <b>{esc(_rotulo_perfil(o))}</b>: especificação e quantidade de acabamentos e instalações
mudam com o padrão (itens marcados “ajustado ao padrão”); estrutura, alvenaria e cobertura não mudam. Troque o padrão em <b>Obras</b>.</p>
<p class="nota">Ao solicitar, o pedido entra em <b>Pedidos de compra</b> como “Solicitada”, com prazo de chegada 7 dias antes do início da etapa. O preço é informado na cotação.
Quantidades são estimativas para casa térrea; confira com o projeto executivo.</p>
<section class="folha folha-lista"><div class="mat-lista">{''.join(blocos)}</div></section>"""


def _rotulo_perfil(o: Obra) -> str:
    from .materiais import perfil_do_padrao

    perfil = perfil_do_padrao(o.padrao, o.valor_m2)
    nome = rotulo_padrao(perfil)
    if o.padrao == "PERS":
        return f"{nome} (mais próximo do valor personalizado de {an.moeda(o.valor_m2)}/m²)"
    return nome


def _bloco_materiais(sis: Sistema, o: Obra, e, linhas: list[dict], n_pend: int, n_ent: int, hoje) -> str:
    aberta = e.codigo in sis.ui["mat_abertas"]
    ini = sv.ler_data(e.inicio_previsto)
    quando = ""
    if ini:
        dias = (ini - hoje).days
        quando = (f"começa em {dias} dia(s)" if dias > 0 else "em andamento ou atrasada") if not an.etapa_concluida(e) else "concluída"
    urgente = bool(ini and n_pend and 0 <= (ini - hoje).days <= 15 and not an.etapa_concluida(e))
    concluida = an.etapa_concluida(e)
    estado = (pill("Entregue") if n_ent == len(linhas) else
              '<span class="pill pill-ok">Etapa concluída</span>' if concluida else
              f'<span class="pill pill-{"atraso" if urgente else "aguardando"}">{n_pend} a pedir</span>' if n_pend else '<span class="pill pill-andamento">Tudo pedido</span>')
    cab = f"""
<button type="button" class="mat-cab" data-action="ui.mat_expandir" data-codigo="{esc(e.codigo)}" aria-expanded="{str(aberta).lower()}">
  <span class="mat-seta" aria-hidden="true">{ico("baixo", 16)}</span>
  <span class="cor" style="--cor:{COR_FASE.get(e.categoria, "#888")}"></span>
  <span class="cod">{esc(e.codigo)}</span>
  <span class="etapa-nome">{esc(e.nome)}</span>
  {estado}
  <span class="etapa-info">{len(linhas)} materiais{f" · {an.data_br(e.inicio_previsto)} · {quando}" if ini else ""}</span>
</button>"""
    if not aberta:
        return f'<article class="mat-etapa{" mat-urgente" if urgente else ""}">{cab}</article>'
    rows = "".join(_linha_material(x) for x in linhas)
    todos = botao(f"Solicitar os {n_pend} pendentes", "mat.solicitar_etapa", "btn", codigo=e.codigo) if n_pend else ""
    if n_pend and an.etapa_concluida(e):
        todos = '<p class="nota">Etapa concluída: os materiais provavelmente já foram comprados fora do sistema.</p>' + todos
    return f"""
<article class="mat-etapa aberta{" mat-urgente" if urgente else ""}">
  {cab}
  <div class="mat-corpo">
    <div class="tabela-wrap"><table class="tabela tabela-mat">
      <thead><tr><th>Material</th><th class="num">Necessário</th><th>Situação</th><th>Pedir</th></tr></thead>
      <tbody>{rows}</tbody>
    </table></div>
    <div class="linha-acoes">{todos}</div>
  </div>
</article>"""


def _linha_material(x: dict) -> str:
    sit = x["situacao"]
    detalhe = f'<span class="nota"> {_num(x["pedido"])} {esc(x["un"])} pedido(s)</span>' if x["pedido"] and sit != "Entregue" else ""
    status = (f'<span class="pill pill-aguardando">Não solicitado</span>' if sit == "Não solicitado"
              else f'<span class="pill pill-alta">Parcial</span>{detalhe}' if sit == "Parcial" else pill(sit))
    if sit in ("Não solicitado", "Parcial"):
        sugerido = x["faltante"] or x["necessario"]
        acao = f"""<form class="form-inline mat-form" data-action="mat.solicitar" data-chave="{esc(x['chave'])}">
  {campo_num("q-" + x["chave"].replace(":", "-"), "quantidade", texto=_num(sugerido), rotulo=f"Quantidade de {x['material']}")}
  <button class="btn btn-mini" type="submit">Solicitar</button></form>"""
    else:
        acao = ""
    tags = ""
    if x["categoria"] != "Material":
        tags += f' <span class="tag-cat">{esc(x["categoria"])}</span>'
    if x.get("ajustado"):
        tags += ' <span class="tag-padrao">ajustado ao padrão</span>'
    return (f'<tr><td>{esc(x["material"])}{tags}</td>'
            f'<td class="num">{_num(x["necessario"])} {esc(x["un"])}</td><td>{status}</td><td>{acao}</td></tr>')


def _render_pedidos(sis: Sistema) -> str:
    o, hoje = sis.obra, sis.hoje
    filtro, f_etapa = sis.ui["filtro_compra"], sis.ui["filtro_etapa"]
    atrasadas = {c.id for c in an.compras_atrasadas(o, hoje)}

    def passa(c):
        if f_etapa and c.etapa != f_etapa:
            return False
        if filtro == "abertas":
            return c.status in an.ABERTAS
        if filtro == "atrasadas":
            return c.id in atrasadas
        if filtro == "todas":
            return True
        return c.status == filtro

    lista = [c for c in o.compras if passa(c)]
    ordem_prio = {p: i for i, p in enumerate(reversed(PRIORIDADES))}
    lista.sort(key=lambda c: (c.id not in atrasadas, ordem_prio.get(c.prioridade, 9), c.data_necessidade or "9999"))

    chips = "".join(
        f'<button type="button" class="chip{" ativo" if k == filtro else ""}" data-action="ui.filtro" data-filtro-compra="{k}">{r}</button>'
        for k, r in FILTROS_COMPRA
    )
    sel_etapa = (f'<select id="filtro-etapa-compra" data-action="ui.filtro" name="filtro_etapa" aria-label="Filtrar por etapa">'
                 + opcoes([""] + [e.codigo for e in o.etapas], f_etapa, ["Todas as etapas"] + [f"{e.codigo} · {e.nome}" for e in o.etapas])
                 + "</select>")
    fin = an.resumo_financeiro(o)
    cards = "".join(_card_compra(o, c, c.id in atrasadas) for c in lista) or '<p class="vazio-txt">Nenhuma compra neste filtro.</p>'
    return f"""
<section class="folha folha-lista">
  <div class="barra-ferr">
    <div class="chips">{chips}</div>
    {sel_etapa}
    {botao("Fechar formulário" if sis.ui["form_compra"] else "Nova compra", "ui.form", "btn", qual="compra")}
  </div>
  {_form_compra(o) if sis.ui["form_compra"] else ""}
  <div class="acoes-faixa">
    <span>Comprometido <b>{an.moeda(fin['comprometido'])}</b></span><span>Entregue <b>{an.moeda(fin['realizado'])}</b></span>
    <span>Aguardando aprovação <b>{an.moeda(fin['em_aberto'])}</b></span>
    <span class="acoes-info">Exibindo {len(lista)} pedido(s)</span>
  </div>
  <div class="lista-docs">{cards}</div>
</section>"""


def _form_compra(o: Obra) -> str:
    return f"""
<form class="form-grade cartao" data-action="compra.criar">
  <label class="largo">Descrição<input id="c-desc" name="descricao" required maxlength="200" placeholder="Ex.: Cimento CP-II 50 kg"></label>
  <label>Etapa<select id="c-etapa" name="etapa">{opcoes([e.codigo for e in o.etapas], "", [f"{e.codigo} · {e.nome}" for e in o.etapas])}</select></label>
  <label>Categoria<select id="c-cat" name="categoria">{opcoes(CATEGORIAS_COMPRA)}</select></label>
  <label>Quantidade<input id="c-qtd" name="quantidade" type="text" inputmode="decimal" autocomplete="off" value="1" required></label>
  <label>Unidade<select id="c-un" name="unidade">{opcoes(UNIDADES)}</select></label>
  <label>Valor unitário (R$){campo_num("c-vu", "valor_unitario")}</label>
  <label>Fornecedor<input id="c-forn" name="fornecedor" maxlength="200"></label>
  <label>Prioridade<select id="c-prio" name="prioridade">{opcoes(PRIORIDADES, "Média")}</select></label>
  <label>Precisa chegar até<input id="c-data" name="data_necessidade" type="date"></label>
  <button class="btn" type="submit">Solicitar compra</button>
</form>"""


SIGLA_CAT = {"Material": "MAT", "Mão de obra": "MO", "Serviço terceirizado": "SRV", "Equipamento/locação": "EQP",
             "Taxas e documentos": "TAX"}


def _card_compra(o: Obra, c, atrasada: bool) -> str:
    try:
        etapa_nome = o.etapa(c.etapa).nome
        cor = COR_FASE.get(o.etapa(c.etapa).categoria, "#888")
    except ValueError:
        etapa_nome, cor = c.etapa, "#888"
    proximos = TRANSICOES_COMPRA.get(c.status, ())
    acoes = "".join(
        botao(f"→ {s}", "compra.status", "btn btn-sec btn-mini" if s == "Cancelada" else "btn btn-mini", id=c.id, status=s) for s in proximos
    )
    editar_preco = ""
    if c.status in ("Solicitada", "Em cotação", "Aprovada"):
        editar_preco = f"""
<form class="form-inline form-cotacao" data-action="compra.preco" data-id="{esc(c.id)}">
  {campo_num(f"vu-{c.id}", "valor_unitario", c.valor_unitario, rotulo="Valor unitário")}
  <input id="fo-{esc(c.id)}" name="fornecedor" value="{esc(c.fornecedor)}" placeholder="Fornecedor" aria-label="Fornecedor" maxlength="200">
  <button class="btn btn-sec btn-mini" type="submit">Salvar cotação</button>
</form>"""
    excluir = "" if c.status in ("Pedido feito", "Entregue") else botao(ico("lixo", 16), "compra.remover", "btn-x", "Excluir compra", id=c.id)
    nec = f"até {an.data_br(c.data_necessidade)}" if c.data_necessidade else "sem data"
    entrega = f" · entregue em {an.data_br(c.data_entrega)}" if c.data_entrega else ""
    sigla = SIGLA_CAT.get(c.categoria, c.categoria[:3].upper())
    return f"""
<article class="linha-doc compra{' atrasada' if atrasada else ''}">
  <span class="tag-arq">{esc(sigla)}</span>
  <div class="ld-corpo">
    <h3 class="ld-tit"><span class="cod-fraco" style="--cor:{cor}">({esc(c.etapa)})</span> {esc(c.descricao)}</h3>
    <p class="ld-sub"><b>Etapa:</b> {esc(etapa_nome)} · <b>Qtd.:</b> {_num(c.quantidade)} {esc(c.unidade)} × {an.moeda(c.valor_unitario)}{f" · <b>Fornecedor:</b> {esc(c.fornecedor)}" if c.fornecedor else ""}{" · da lista de materiais" if c.material else ""}</p>
    <p class="meta-linha">
      <span>{ico("bandeira", 15)} {esc(c.categoria)}</span><span class="sep">|</span>{pill(c.status)}{'<span class="pill pill-atraso">Atrasada</span>' if atrasada else ''}
      <span class="sep">|</span><span>{ico("calendario", 15)} {nec}{entrega}</span><span class="sep">|</span>{pill(c.prioridade)}
    </p>
    {editar_preco}
  </div>
  <div class="ld-dir">
    <b class="ld-valor">{an.moeda(c.valor_total)}</b>
    <div class="ld-acoes">{acoes}{excluir}</div>
  </div>
</article>"""


def _num(x: float) -> str:
    s = f"{x:,.2f}".rstrip("0").rstrip(".") if x != int(x) else f"{int(x):,}"
    return s.replace(",", "X").replace(".", ",").replace("X", ".")


# ======================================================================= tarefas
def render_tarefas(sis: Sistema) -> str:
    o, hoje = sis.obra, sis.hoje
    atrasadas = {t.id for t in an.tarefas_atrasadas(o, hoje)}
    ordem_prio = {p: i for i, p in enumerate(reversed(PRIORIDADES))}
    colunas = []
    for st in STATUS_TAREFA:
        ts = sorted((t for t in o.tarefas if t.status == st),
                    key=lambda t: (t.id not in atrasadas, ordem_prio.get(t.prioridade, 9), t.prazo or "9999"))
        cards = "".join(_card_tarefa(o, t, t.id in atrasadas) for t in ts) or '<p class="vazio-txt">—</p>'
        colunas.append(f'<section class="coluna"><h2>{pill(st)} <span class="contagem">{len(ts)}</span></h2>{cards}</section>')
    return f"""
<div class="barra-ferr folha">
  <p class="nota">Marque os itens do checklist; a tarefa só pode ser concluída com todos os itens feitos.</p>
  {botao("Fechar formulário" if sis.ui["form_tarefa"] else "Nova tarefa", "ui.form", "btn", qual="tarefa")}
</div>
{_form_tarefa(o) if sis.ui["form_tarefa"] else ""}
<div class="kanban">{''.join(colunas)}</div>"""


def _form_tarefa(o: Obra) -> str:
    return f"""
<form class="form-grade cartao" data-action="tarefa.criar">
  <label class="largo">Título<input id="t-tit" name="titulo" required maxlength="200" placeholder="Ex.: Conferir prumo da alvenaria"></label>
  <label>Etapa<select id="t-etapa" name="etapa">{opcoes([""] + [e.codigo for e in o.etapas], "", ["(geral)"] + [f"{e.codigo} · {e.nome}" for e in o.etapas])}</select></label>
  <label>Responsável<input id="t-resp" name="responsavel" maxlength="80"></label>
  <label>Prazo<input id="t-prazo" name="prazo" type="date"></label>
  <label>Prioridade<select id="t-prio" name="prioridade">{opcoes(PRIORIDADES, "Média")}</select></label>
  <label class="largo">Checklist (um item por linha)<textarea id="t-itens" name="itens" rows="3" placeholder="Item 1&#10;Item 2"></textarea></label>
  <button class="btn" type="submit">Criar tarefa</button>
</form>"""


def _card_tarefa(o: Obra, t, atrasada: bool) -> str:
    itens = "".join(
        f'<li class="chk{" feito" if i.feito else ""}"><button type="button" class="chk-btn" data-action="tarefa.item" '
        f'data-id="{esc(t.id)}" data-item="{esc(i.id)}" aria-pressed="{str(i.feito).lower()}">'
        f'<span class="chk-caixa" aria-hidden="true"></span><span class="chk-txt">{esc(i.texto)}</span></button></li>'
        for i in t.checklist
    )
    mover = "".join(botao(s, "tarefa.status", "btn btn-mini", id=t.id, status=s) for s in STATUS_TAREFA if s != t.status)
    etapa = f'<span class="cod">{esc(t.etapa)}</span> ' if t.etapa else ""
    prazo = f"prazo {an.data_br(t.prazo)}" if t.prazo else "sem prazo"
    prog = an.progresso_tarefa(t)
    return f"""
<article class="cartao tarefa{' atrasada' if atrasada else ''}">
  <div class="cartao-cab"><h3>{esc(t.titulo)}</h3><div class="pills">{pill(t.prioridade)}{'<span class="pill pill-atraso">Atrasada</span>' if atrasada else ''}</div></div>
  <p class="cartao-meta">{etapa}{esc(t.responsavel or 'sem responsável')} · {prazo}</p>
  {barra(prog) if t.checklist else ''}
  {f'<ul class="checklist">{itens}</ul>' if itens else ''}
  <div class="linha-acoes">{mover}{botao("Excluir", "tarefa.remover", "btn btn-link", id=t.id)}</div>
</article>"""


# ======================================================================= obras
def render_obras(sis: Sistema) -> str:
    o = sis.obra
    lista = []
    for x in _ordenadas(sis):
        pf = an.progresso_fisico(x)
        conf = sis.ui["confirmar_exclusao"] == x.id
        excluir = (
            f'<span class="confirma">Excluir “{esc(x.nome)}” e todos os dados? '
            f'{botao("Sim, excluir", "obra.excluir", "btn btn-perigo", id=x.id)}'
            f'{botao("Cancelar", "obra.cancelar_exclusao", "btn btn-sec")}</span>'
            if conf else botao("Excluir", "obra.excluir", "btn btn-link", id=x.id)
        )
        lista.append(f"""
<article class="cartao obra-item{' ativa' if o and x.id == o.id else ''}">
  <div class="cartao-cab"><h3>{esc(x.nome)}{' <span class="pill pill-neutro">exemplo</span>' if x.exemplo else ''}</h3>
  {botao("Abrir", "obra.selecionar", "btn", id=x.id) if not (o and x.id == o.id) else '<span class="pill pill-ok">Ativa</span>'}</div>
  <p class="cartao-meta">{esc(x.cliente or '—')} · {an.moeda(x.orcamento_total)} · {len(x.compras)} compras · {len(x.tarefas)} tarefas</p>
  {barra(pf)}<p class="cartao-meta">Avanço físico {pct(pf)}</p>
  <div class="linha-acoes">{excluir}</div>
</article>""")
    vazio = ""
    if not sis.obras:
        vazio = f"""
<section class="vazio cartao">
  <h2>Comece cadastrando a primeira obra</h2>
  <p>Ao criar uma obra, o sistema monta automaticamente as 17 etapas construtivas com checklists de qualidade,
  distribui o orçamento pelos pesos típicos de cada etapa e calcula o cronograma respeitando a sequência executiva.</p>
  {botao("Ver com uma obra de exemplo", "obra.exemplo", "btn btn-sec")}
</section>"""
    editar = _form_editar(o) if o else ""
    return f"""
{vazio}
<div class="grade-2">
  <section>
    <h2>Nova obra</h2>
    <form class="form-grade cartao" data-action="obra.criar">
      <label class="largo">Nome da obra<input id="o-nome" name="nome" required maxlength="200" placeholder="Ex.: Residência Silva"></label>
      <label>Cliente<input id="o-cli" name="cliente" maxlength="200"></label>
      <label>Responsável técnico<input id="o-rt" name="responsavel_tecnico" maxlength="200"></label>
      <label class="largo">Endereço<input id="o-end" name="endereco" maxlength="200"></label>
      <label>Início<input id="o-ini" name="inicio" type="date"></label>
      <label>Término previsto<input id="o-fim" name="fim_previsto" type="date"></label>
      <label>Área construída (m²){campo_num("o-area", "area_construida", texto="100", placeholder="100")}</label>
      {_campos_padrao("o", "R1-N", None, _num(sv.BDI_SUGERIDO))}
      <label class="largo">Orçamento — custo direto (R$){campo_num("o-orc", "orcamento_total", placeholder="Em branco = área × valor do m²")}</label>
      <button class="btn" type="submit">Criar obra com etapas padrão</button>
    </form>
    {'' if not sis.obras else '<p class="nota">' + botao("Criar também uma obra de exemplo", "obra.exemplo", "btn btn-link") + '</p>'}
  </section>
  <section class="obras-sec">
    <h2>Obras cadastradas <span class="contagem">{len(sis.obras)}</span></h2>
    {''.join(lista) or '<p class="vazio-txt">Nenhuma obra cadastrada.</p>'}
    {editar}
    {config_ia(sis)}
  </section>
</div>"""


def _form_editar(o: Obra) -> str:
    return f"""
<h2>Dados da obra ativa</h2>
<form class="form-grade cartao" data-action="obra.editar">
  <label class="largo">Nome<input id="e-nome" name="nome" value="{esc(o.nome)}" required maxlength="200"></label>
  <label>Cliente<input id="e-cli" name="cliente" value="{esc(o.cliente)}" maxlength="200"></label>
  <label>Responsável técnico<input id="e-rt" name="responsavel_tecnico" value="{esc(o.responsavel_tecnico)}" maxlength="200"></label>
  <label class="largo">Endereço<input id="e-end" name="endereco" value="{esc(o.endereco)}" maxlength="200"></label>
  <label>Início<input id="e-ini" name="inicio" type="date" value="{esc(o.inicio)}"></label>
  <label>Término previsto<input id="e-fim" name="fim_previsto" type="date" value="{esc(o.fim_previsto)}"></label>
  <label>Área construída (m²){campo_num("e-area", "area_construida", texto=_num(o.area_construida), placeholder="100")}</label>
  {_campos_padrao("e", o.padrao, o.valor_m2, _num(o.bdi))}
  <label class="largo">Orçamento — custo direto (R$){campo_num("e-orc", "orcamento_total", o.orcamento_total)}</label>
  <button class="btn" type="submit">Salvar dados</button>
</form>
{_bloco_padrao(o, com_acao=True)}"""


def _campos_padrao(prefixo: str, padrao: str, valor_m2: float | None, bdi: str = "") -> str:
    rotulos = [
        f'{rotulo_padrao(c)} — {an.moeda(PADROES[c]["valor_m2"])}/m²' if c != "PERS" else "Personalizado (informe o valor)"
        for c in CODIGOS_PADRAO
    ]
    return (
        f'<label>Padrão construtivo<select id="{prefixo}-padrao" name="padrao">{opcoes(CODIGOS_PADRAO, padrao, rotulos)}</select></label>'
        f'<label>Valor por m² (R$){campo_num(f"{prefixo}-vm2", "valor_m2", valor_m2, placeholder="Em branco = valor do padrão")}</label>'
        f'<label>BDI (%){campo_num(f"{prefixo}-bdi", "bdi", texto=bdi, placeholder="0", rotulo="BDI em porcentagem")}</label>'
        f'<p class="nota largo">Referência: {esc(REFERENCIA)}. Troque o padrão para usar o valor dele, '
        f'ou digite o CUB do seu estado / custo próprio no valor por m². '
        f'O orçamento é o custo direto (comparável ao CUB); o BDI (administração, riscos, impostos e lucro) entra por cima '
        f'e forma o preço de venda. Faixa usual em residências: 20% a 30%.</p>'
    )


def _bloco_padrao(o: Obra, com_acao: bool = False) -> str:
    p = an.resumo_padrao(o)
    dif = p["diferenca"]
    if dif is None:
        comp = '<p class="nota">Informe o orçamento para comparar com o padrão.</p>'
    else:
        cls = "neg" if dif < -0.2 else "atencao-txt" if abs(dif) > 0.1 else "ok-txt"
        sentido = "acima" if dif > 0 else "abaixo"
        comp = (f'<p class="padrao-comp {cls}">Orçamento {abs(dif):.0%} {sentido} do custo pelo padrão'
                if abs(dif) >= 0.005 else '<p class="padrao-comp ok-txt">Orçamento igual ao custo pelo padrão') + "</p>"
    origem = "valor próprio" if p["valor_proprio"] else "CUB de referência"
    acao = ""
    if com_acao and p["estimado"] and abs(p["estimado"] - p["orcado"]) >= 0.01:
        acao = botao(f"Usar {an.moeda(p['estimado'])} como orçamento", "obra.orcamento_padrao", "btn btn-sec")
    return f"""
<section class="painel-bloco bloco-padrao">
  <h2>Padrão construtivo</h2>
  <dl class="det-dl padrao-dl">
    <dt>Padrão</dt><dd><b>{esc(p['rotulo'])}</b></dd>
    <dt>Valor do m²</dt><dd class="num-esq">{an.moeda(p['valor_m2'])}/m² <span class="nota">({origem})</span></dd>
    <dt>Área</dt><dd class="num-esq">{_num(p['area'])} m²</dd>
    <dt>Custo pelo padrão</dt><dd class="num-esq"><b>{an.moeda(p['estimado'])}</b></dd>
    <dt>Orçamento (custo direto)</dt><dd class="num-esq">{an.moeda(p['orcado'])}{f" · {an.moeda(p['orcado_m2'])}/m²" if p['orcado_m2'] else ""}</dd>
    <dt>BDI</dt><dd class="num-esq">{_num(p['bdi'])}% · {an.moeda(p['valor_bdi'])}</dd>
    <dt>Preço de venda</dt><dd class="num-esq"><b>{an.moeda(p['preco_venda'])}</b>{f" · {an.moeda(p['preco_venda_m2'])}/m²" if p['preco_venda_m2'] else ""}</dd>
  </dl>
  {comp}
  <p class="nota">A comparação é feita no custo direto (orçamento × CUB), sem BDI dos dois lados. O CUB não inclui terreno, projetos e taxas,
  fundações especiais e paisagismo; o BDI é somado à parte para chegar ao preço de venda.{"" if p['bdi'] else " <b>Esta obra está sem BDI</b> — informe em Obras."}</p>
  {f'<div class="linha-acoes">{acao}</div>' if acao else ''}
</section>"""


# ======================================================================= revisão com Claude
ROTULO_NIVEL = {"critico": "Crítico", "atencao": "Atenção", "ok": "OK"}


def bloco_ia(sis: Sistema, o: Obra, escopo: str, codigo: str = "") -> str:
    modo = sis.ui["ia_modo"]
    andamento = sis.ui["ia_em_andamento"]
    deste = bool(andamento and andamento["obra"] == o.id and andamento["escopo"] == escopo
                 and andamento["codigo"] == codigo)
    alvo = "esta etapa" if escopo == "etapa" else "a obra"
    sufixo = f"-{codigo}" if codigo else ""
    if deste:
        acao = (f'<div class="ia-andamento" role="status"><span class="ia-pulso" aria-hidden="true"></span>'
                f'<span>Claude está revisando {alvo}… costuma levar de 20 segundos a 1 minuto.</span>'
                f'{botao("Cancelar", "ia.cancelar", "btn btn-link")}</div>')
    elif modo == "nenhum":
        acao = (f'<p class="nota">Para revisar com a Claude, abra o sistema pela Claude ou conecte uma chave de API. '
                f'{botao("Configurar", "ui.aba", "btn btn-link", aba="obras")}</p>')
    else:
        ocupado = " disabled" if andamento else ""
        acao = f"""
<form class="form-inline ia-form" data-action="ia.revisar" data-escopo="{escopo}" data-codigo="{esc(codigo)}">
  <input id="ia-foco{esc(sufixo)}" name="foco" maxlength="300" placeholder="Foco opcional (ex.: orçamento, sequência, segurança)" aria-label="Foco da revisão">
  <button class="btn btn-ia" type="submit"{ocupado}>Revisar {alvo} com Claude</button>
</form>"""
    ultima = ia.ultima_revisao(o, escopo, codigo)
    corpo = render_revisao(ultima) if ultima else ""
    historico = ""
    if escopo == "obra":
        antigas = [r for r in o.revisoes if r is not ultima]
        if antigas:
            itens = "".join(
                f'<li>{botao(f"{an.data_br(r.get("data", ""))} · {_rotulo_rev(o, r)}", "ia.abrir", "btn btn-link", rev=r["id"])}'
                f'{render_revisao(r) if sis.ui["rev_aberta"] == r["id"] else ""}</li>'
                for r in antigas
            )
            historico = f'<details class="ia-historico"><summary>Revisões anteriores ({len(antigas)})</summary><ul>{itens}</ul></details>'
    titulo = "Revisão com Claude" if escopo == "obra" else "Revisão da etapa com Claude"
    tag = "section" if escopo == "obra" else "div"
    classe = "painel-bloco bloco-ia" if escopo == "obra" else "etapa-sec bloco-ia"
    nivel = "h2" if escopo == "obra" else "h3"
    return f"""
<{tag} class="{classe}">
  <{nivel}>{titulo}</{nivel}>
  {acao}
  {corpo}
  {historico}
</{tag}>"""


def _rotulo_rev(o: Obra, r: dict) -> str:
    if r.get("escopo") == "etapa":
        try:
            return f"etapa {o.etapa(r.get('codigo', '')).nome}"
        except ValueError:
            return f"etapa {r.get('codigo', '')}"
    return "obra inteira"


def render_revisao(r: dict) -> str:
    pontos = "".join(
        f'<li class="ia-ponto ia-{esc(p["nivel"])}"><span class="pill pill-{ {"critico": "atraso", "atencao": "alta", "ok": "ok"}.get(p["nivel"], "neutro") }">'
        f'{ROTULO_NIVEL.get(p["nivel"], "")}</span><div><b>{esc(p["titulo"])}</b>'
        f'{f"<p>{esc(p.get("detalhe", ""))}</p>" if p.get("detalhe") else ""}</div></li>'
        for p in r.get("pontos", [])
    )
    sugestoes = "".join(
        f'<li><span class="cod">{esc(sg["etapa"])}</span> {esc(sg["texto"])} '
        + ('<span class="pill pill-ok">no checklist</span>' if sg.get("adicionado")
           else botao("Adicionar ao checklist", "ia.adicionar", "btn btn-mini", rev=r["id"], idx=str(i)))
        + "</li>"
        for i, sg in enumerate(r.get("sugestoes", []))
    )
    perguntas = "".join(f"<li>{esc(q)}</li>" for q in r.get("perguntas", []))
    foco = f' · foco: {esc(r["foco"])}' if r.get("foco") else ""
    resumo = esc(r.get("resumo", "")).replace("\n", "<br>")
    return f"""
<article class="ia-revisao">
  <p class="ia-meta">{an.data_br(r.get("data", ""))} · {esc(r.get("origem", "Claude"))}{foco}</p>
  {f'<p class="ia-resumo">{resumo}</p>' if resumo else ''}
  {f'<ul class="ia-pontos">{pontos}</ul>' if pontos else ''}
  {f'<h4>Itens sugeridos para o checklist</h4><ul class="ia-sugestoes">{sugestoes}</ul>' if sugestoes else ''}
  {f'<h4>Informações que faltam</h4><ul class="ia-perguntas">{perguntas}</ul>' if perguntas else ''}
  <p class="nota">Revisão gerada por IA a partir dos dados do sistema. Confira antes de decidir. {botao("Apagar revisão", "ia.apagar", "btn btn-link", rev=r["id"])}</p>
</article>"""


def config_ia(sis: Sistema) -> str:
    modo = sis.ui["ia_modo"]
    if modo == "claude":
        return """
<section class="cartao config-ia">
  <h2>Revisão com Claude</h2>
  <p class="nota">Conectada pela sua conta da Claude. Cada revisão usa o seu limite de uso da Claude e pede permissão na primeira vez.</p>
</section>"""
    if modo == "nenhum" and not sis.ui.get("ia_chave_permitida"):
        return """
<section class="cartao config-ia">
  <h2>Revisão com Claude</h2>
  <p class="nota">Disponível quando o sistema é aberto pela Claude (usa a sua conta) ou pelo site, com uma chave de API própria.</p>
</section>"""
    if modo == "chave":
        estado = f'<p><span class="pill pill-ok">Conectada</span> chave terminada em <b>…{esc(sis.ui["ia_chave_final"])}</b></p>'
        acoes = '<button type="button" class="btn btn-sec" data-local="ia-remover">Remover chave deste navegador</button>'
    else:
        estado = '<p><span class="pill pill-aguardando">Não conectada</span></p>'
        acoes = ""
    return f"""
<section class="cartao config-ia">
  <h2>Revisão com Claude</h2>
  {estado}
  <p class="nota">Fora da Claude, a revisão usa uma chave da API da Anthropic (console.anthropic.com). A chave fica salva só neste navegador,
  nunca vai para o banco de dados nem para o código do site, e cada revisão é cobrada na sua conta da API.
  Use uma chave com limite de gastos e não conecte em computadores compartilhados.</p>
  <form class="form-inline" data-local="ia-chave" autocomplete="off">
    <input name="chave" type="password" autocomplete="off" spellcheck="false" placeholder="sk-ant-…" aria-label="Chave da API da Anthropic" required>
    <button class="btn" type="submit">{"Trocar chave" if modo == "chave" else "Conectar"}</button>
  </form>
  {acoes}
</section>"""


# ======================================================================= imagem de referência (janela)
ICONE_IMAGEM = ('<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true" class="ico">'
                '<rect x="2.5" y="4" width="15" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/>'
                '<circle cx="7.5" cy="8.5" r="1.6" fill="currentColor"/>'
                '<path d="M3.5 14.5l4.5-4 3 2.5 2.5-2 3 3" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>')


def render_figura(sis: Sistema) -> str:
    f = sis.ui.get("figura")
    if not f:
        return ""
    o = sis.obra
    try:
        etapa = o.etapa(f["codigo"])
    except ValueError:
        return ""
    if f["item"] == "_etapa":
        par = detalhe(etapa.codigo)
        if not par:
            return ""
        svg, titulo = par
        rotulo = f"{etapa.nome} · detalhe técnico"
    else:
        item = next((i for i in etapa.checklist if i.id == f["item"]), None)
        svg = figura_item(item.texto) if item else None
        if not svg:
            return ""
        titulo, rotulo = item.texto, f"{etapa.nome} · item do checklist"
    return f"""
<div class="modal-fundo" data-fechar-modal="1">
  <div class="modal" role="dialog" aria-modal="true" aria-label="{esc(titulo)}">
    <div class="modal-cab">
      <div><p class="modal-sub">{esc(rotulo)}</p><h2>{esc(titulo)}</h2></div>
      {botao("×", "ui.figura_fechar", "btn-x btn-fechar", "Fechar imagem")}
    </div>
    {svg}
    <p class="nota">Desenho esquemático de referência, sem escala. O projeto executivo prevalece.</p>
  </div>
</div>"""
