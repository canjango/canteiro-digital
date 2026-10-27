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
}


def pill(texto: str) -> str:
    return f'<span class="pill pill-{SLUG.get(texto, "neutro")}">{esc(texto)}</span>'


# ======================================================================= raiz
def render(sis: Sistema) -> str:
    o = sis.obra
    aba = sis.ui["aba"] if o else "obras"
    corpo = {
        "painel": render_painel, "etapas": render_etapas, "compras": render_compras,
        "tarefas": render_tarefas, "obras": render_obras,
    }[aba](sis)
    return f"""
{render_topo(sis)}
{render_mensagens(sis)}
<main class="conteudo" id="conteudo">{corpo}</main>
<footer class="rodape">Canteiro Digital · núcleo em Python {esc(_versao())} · dados salvos automaticamente</footer>
"""


def _versao() -> str:
    from . import __version__
    return __version__


def render_topo(sis: Sistema) -> str:
    o = sis.obra
    abas = [("painel", "Painel"), ("etapas", "Etapas"), ("compras", "Compras"), ("tarefas", "Tarefas"), ("obras", "Obras")]
    ativa = sis.ui["aba"] if o else "obras"
    nav = "".join(
        f'<button type="button" class="aba{" ativa" if k == ativa else ""}" data-action="ui.aba" data-aba="{k}"'
        f'{"" if o or k == "obras" else " disabled"}{" aria-current=page" if k == ativa else ""}>{r}{_contador(sis, k)}</button>'
        for k, r in abas
    )
    if o:
        seletor = (f'<select id="sel-obra" class="sel-obra" data-action="obra.selecionar" name="id" aria-label="Obra ativa">'
                   + opcoes([x.id for x in _ordenadas(sis)], o.id, [x.nome for x in _ordenadas(sis)]) + "</select>")
        meta = " · ".join(esc(x) for x in (o.cliente, o.endereco, f"{_num(o.area_construida)} m²",
                                          f"padrão {PADROES.get(o.padrao, {}).get('nome', o.padrao).lower()} · {an.moeda(o.valor_m2)}/m²") if x)
        datas = f"{an.data_br(o.inicio)} → {an.data_br(o.fim_previsto)}" if o.inicio else "sem cronograma"
        info = f'<p class="topo-meta">{meta}{" · " if meta else ""}{datas}{" · <b>exemplo</b>" if o.exemplo else ""}</p>'
    else:
        seletor, info = '<span class="sel-obra vazio">Nenhuma obra</span>', ""
    return f"""
<header class="topo">
  <div class="topo-linha">
    <div class="marca"><span class="marca-ico" aria-hidden="true"></span><span>Canteiro Digital</span></div>
    {seletor}
  </div>
  {info}
  <nav class="abas" aria-label="Seções">{nav}</nav>
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
    <span class="kpi-sub">{pct(fin['executado_pct'])} do orçado · a executar {an.moeda(fin['a_executar'])}</span>
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
        f'<td class="num">{an.moeda(l["a_executar"])}</td>'
        f'<td class="num">{an.moeda(l["comprometido"])}</td>'
        f'<td class="num {"neg" if l["saldo"] < 0 else ""}">{an.moeda(l["saldo"])}</td></tr>'
        for l in custos_etapa
    )
    tot = {k: sum(l[k] for l in custos_etapa) for k in ("orcado", "executado", "a_executar", "comprometido", "saldo")}
    total = (
        f'<tr><td>Total da obra</td><td class="num">{pct(tot["executado"] / tot["orcado"] if tot["orcado"] else None)}</td>'
        f'<td class="num">{an.moeda(tot["orcado"])}</td><td class="num">{an.moeda(tot["executado"])}</td>'
        f'<td class="num">{an.moeda(tot["a_executar"])}</td><td class="num">{an.moeda(tot["comprometido"])}</td>'
        f'<td class="num {"neg" if tot["saldo"] < 0 else ""}">{an.moeda(tot["saldo"])}</td></tr>'
    )

    return f"""
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
  <p class="nota">Executado = orçado da etapa × avanço do checklist. Comprometido = compras aprovadas, pedidas ou entregues. Saldo = orçado − comprometido.</p>
  <div class="tabela-wrap"><table class="tabela">
    <thead><tr><th>Etapa</th><th class="num">Avanço</th><th class="num">Orçado</th><th class="num">Executado</th><th class="num">A executar</th><th class="num">Comprometido</th><th class="num">Saldo</th></tr></thead>
    <tbody>{linhas}</tbody>
    <tfoot>{total}</tfoot>
  </table></div>
</section>"""


# ======================================================================= etapas
def render_etapas(sis: Sistema) -> str:
    o, hoje = sis.obra, sis.hoje
    grupos = []
    for cat in CATEGORIAS:
        etapas = [e for e in o.etapas if e.categoria == cat]
        if not etapas:
            continue
        cards = "".join(_card_etapa(sis, o, e, hoje) for e in etapas)
        grupos.append(f'<section class="fase"><h2 class="fase-tit">{esc(cat)}</h2>{cards}</section>')
    replanejar = (botao("Recalcular cronograma", "obra.replanejar", "btn btn-sec")
                  if o.inicio and o.fim_previsto else "")
    banner = ""
    if o.modelo_etapas < MODELO_VERSAO:
        banner = f"""
<section class="cartao banner-modelo">
  <h2>Modelo de etapas revisado para residência de 100 m²</h2>
  <p>Sequência corrigida (alvenaria em paralelo com a estrutura), pesos de custo revisados, novos itens de checklist e cronograma pela duração típica de cada etapa.
  Itens já marcados, itens que você criou, observações e orçamentos ajustados à mão são mantidos. Como entram itens novos, a porcentagem de avanço pode baixar.</p>
  <div class="linha-acoes">{botao("Aplicar modelo revisado", "obra.atualizar_modelo", "btn")}</div>
</section>"""
    return f"""
{banner}
<div class="barra-acoes">
  <p class="nota">Toque em uma etapa para ver escopo, quantitativos, checklist e observações. Etapas só ficam “Liberadas” quando as predecessoras terminam.</p>
  {replanejar}
</div>
{''.join(grupos)}"""


def _card_etapa(sis: Sistema, o: Obra, e, hoje) -> str:
    st = an.status_etapa(o, e, hoje)
    prog = an.progresso_etapa(e)
    aberta = e.codigo in sis.ui["abertas"]
    feitos = sum(1 for i in e.checklist if i.feito)
    datas = (f"{an.data_br(e.inicio_previsto)} – {an.data_br(e.fim_previsto)}" if e.inicio_previsto else "sem datas")
    cab = f"""
<button type="button" class="etapa-cab" data-action="ui.expandir" data-codigo="{esc(e.codigo)}" aria-expanded="{str(aberta).lower()}">
  <span class="cod">{esc(e.codigo)}</span>
  <span class="etapa-nome">{esc(e.nome)}</span>
  {pill(st)}
  <span class="etapa-info">{feitos}/{len(e.checklist)} itens · {datas} · {an.moeda(e.orcamento)} · peso {e.peso:g}%{f" · {e.duracao_dias} dias úteis" if e.duracao_dias else ""}{' <span class="tag-obs">observação</span>' if e.observacao else ""}</span>
  {barra(prog, '', an.fracao_prevista(e, hoje) if e.inicio_previsto else None)}
</button>"""
    if not aberta:
        return f'<article class="etapa etapa-{SLUG.get(st, "")}">{cab}</article>'

    itens = "".join(
        f'<li class="chk{" feito" if i.feito else ""}">'
        f'<button type="button" class="chk-btn" data-action="etapa.item" data-codigo="{esc(e.codigo)}" data-item="{esc(i.id)}" '
        f'aria-pressed="{str(i.feito).lower()}"><span class="chk-caixa" aria-hidden="true"></span>'
        f'<span class="chk-txt">{esc(i.texto)}</span>'
        f'{f"<span class=chk-data>{an.data_br(i.concluido_em)}</span>" if i.feito else ""}</button>'
        f'{botao("×", "etapa.remover_item", "btn-x", "Remover item", codigo=e.codigo, item=i.id)}</li>'
        for i in e.checklist
    )
    pend = an.predecessoras_pendentes(o, e)
    aviso_pred = (f'<p class="nota nota-atencao">Aguardando: {esc(", ".join(_nome_etapa(o, p) for p in pend))}</p>' if pend else "")
    normas = f'<p class="nota">Normas: {esc(" · ".join(e.normas))}</p>' if e.normas else ""
    todos = (botao("Desmarcar todos", "etapa.todos", "btn btn-sec", codigo=e.codigo, feito="0") if feitos == len(e.checklist) and e.checklist
             else botao("Marcar todos", "etapa.todos", "btn btn-sec", codigo=e.codigo, feito="1"))
    return f"""
<article class="etapa aberta etapa-{SLUG.get(st, "")}">
  {cab}
  <div class="etapa-corpo">
    {aviso_pred}
    {_detalhes_etapa(o, e)}
    <section class="etapa-sec">
      <h3>Checklist de execução e qualidade <span class="contagem">{feitos}/{len(e.checklist)}</span></h3>
      <ul class="checklist">{itens}</ul>
      <div class="linha-acoes">
        {todos}
        <form class="form-inline" data-action="etapa.novo_item" data-codigo="{esc(e.codigo)}">
          <input id="novo-item-{esc(e.codigo)}" name="texto" placeholder="Novo item de checklist" aria-label="Novo item de checklist" maxlength="200" required>
          <button class="btn" type="submit">Adicionar</button>
        </form>
      </div>
    </section>
    <section class="etapa-sec">
      <h3>Observações da etapa</h3>
      <form class="form-obs" data-action="etapa.observacao" data-codigo="{esc(e.codigo)}">
        <textarea id="obs-{esc(e.codigo)}" name="observacao" rows="3" maxlength="2000"
          placeholder="Ex.: fornecedor, alteração de projeto, condição do terreno, combinado com o cliente…"
          aria-label="Observações da etapa {esc(e.nome)}">{esc(e.observacao)}</textarea>
        <button class="btn btn-sec" type="submit">Salvar observação</button>
      </form>
    </section>
    <form class="form-grade form-etapa" data-action="etapa.salvar" data-codigo="{esc(e.codigo)}">
      <label>Início previsto<input id="ini-{esc(e.codigo)}" type="date" name="inicio_previsto" value="{esc(e.inicio_previsto)}"></label>
      <label>Fim previsto<input id="fim-{esc(e.codigo)}" type="date" name="fim_previsto" value="{esc(e.fim_previsto)}"></label>
      <label>Orçamento (R$){campo_num(f"orc-{e.codigo}", "orcamento", e.orcamento)}</label>
      <button class="btn btn-sec" type="submit">Salvar etapa</button>
    </form>
    {normas}
    {bloco_ia(sis, o, "etapa", e.codigo)}
  </div>
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
    linhas = "".join(
        f'<tr><td>{esc(s.get("servico", ""))}</td><td class="num">{qtd_escalada(float(s.get("qtd", 0)), s.get("un", ""), area)}</td>'
        f'<td>{esc(s.get("un", ""))}</td></tr>'
        for s in e.servicos
    )
    quant = (f'<div class="det-bloco det-largo"><h4>Serviços e quantitativos de referência · {_num(area)} m²</h4>'
             f'<div class="tabela-wrap"><table class="tabela tabela-compacta"><tbody>{linhas}</tbody></table></div>'
             f'<p class="nota">Estimativa para planejamento; confirme com o projeto e o orçamento executivo.</p></div>') if linhas else ""
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
    opcoes_v = (("pedidos", f"Pedidos de compra <span class=\"contagem\">{len(o.compras)}</span>"),
                ("materiais", f"Lista de materiais por etapa <span class=\"contagem\">{pend} a pedir</span>"))
    return '<nav class="vistas" aria-label="Compras">' + "".join(
        f'<button type="button" class="vista{" ativa" if k == atual else ""}" data-action="ui.vista_compras" data-vista="{k}"'
        f'{" aria-current=page" if k == atual else ""}>{r}</button>' for k, r in opcoes_v) + "</nav>"


def render_compras(sis: Sistema) -> str:
    if sis.ui["compras_vista"] == "materiais":
        return _vistas_compras(sis) + render_materiais(sis)
    return _vistas_compras(sis) + _render_pedidos(sis)


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
<p class="nota">Ao solicitar, o pedido entra em <b>Pedidos de compra</b> como “Solicitada”, com prazo de chegada 7 dias antes do início da etapa. O preço é informado na cotação.
Quantidades são estimativas para casa térrea padrão normal; confira com o projeto executivo.</p>
<div class="mat-lista">{''.join(blocos)}</div>"""


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
    return (f'<tr><td>{esc(x["material"])}{f" <span class=tag-cat>{esc(x["categoria"])}</span>" if x["categoria"] != "Material" else ""}</td>'
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
<div class="barra-acoes">
  <div class="chips">{chips}</div>
  {sel_etapa}
  {botao("Fechar formulário" if sis.ui["form_compra"] else "+ Nova compra", "ui.form", "btn", qual="compra")}
</div>
{_form_compra(o) if sis.ui["form_compra"] else ""}
<p class="nota">Comprometido {an.moeda(fin['comprometido'])} · entregue {an.moeda(fin['realizado'])} · aguardando aprovação {an.moeda(fin['em_aberto'])}</p>
<div class="lista-cards">{cards}</div>"""


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


def _card_compra(o: Obra, c, atrasada: bool) -> str:
    try:
        etapa_nome = o.etapa(c.etapa).nome
    except ValueError:
        etapa_nome = c.etapa
    proximos = TRANSICOES_COMPRA.get(c.status, ())
    acoes = "".join(
        botao(f"→ {s}", "compra.status", "btn btn-sec" if s == "Cancelada" else "btn", id=c.id, status=s) for s in proximos
    )
    editar_preco = ""
    if c.status in ("Solicitada", "Em cotação", "Aprovada"):
        editar_preco = f"""
<form class="form-inline" data-action="compra.preco" data-id="{esc(c.id)}">
  {campo_num(f"vu-{c.id}", "valor_unitario", c.valor_unitario, rotulo="Valor unitário")}
  <input id="fo-{esc(c.id)}" name="fornecedor" value="{esc(c.fornecedor)}" placeholder="Fornecedor" aria-label="Fornecedor" maxlength="200">
  <button class="btn btn-sec" type="submit">Salvar cotação</button>
</form>"""
    excluir = "" if c.status in ("Pedido feito", "Entregue") else botao("Excluir", "compra.remover", "btn btn-link", id=c.id)
    nec = f"até {an.data_br(c.data_necessidade)}" if c.data_necessidade else "sem data"
    entrega = f" · entregue em {an.data_br(c.data_entrega)}" if c.data_entrega else ""
    return f"""
<article class="cartao compra{' atrasada' if atrasada else ''}">
  <div class="cartao-cab">
    <h3>{esc(c.descricao)}</h3>
    <div class="pills">{pill(c.status)}{pill(c.prioridade)}{'<span class="pill pill-atraso">Atrasada</span>' if atrasada else ''}</div>
  </div>
  <p class="cartao-meta"><span class="cod">{esc(c.etapa)}</span> {esc(etapa_nome)} · {esc(c.categoria)} · {nec}{entrega}{" · da lista de materiais" if c.material else ""}</p>
  <p class="valores"><span>{_num(c.quantidade)} {esc(c.unidade)} × {an.moeda(c.valor_unitario)}</span><b>{an.moeda(c.valor_total)}</b></p>
  {f'<p class="cartao-meta">Fornecedor: {esc(c.fornecedor)}</p>' if c.fornecedor else ''}
  {editar_preco}
  <div class="linha-acoes">{acoes}{excluir}</div>
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
<div class="barra-acoes">
  <p class="nota">Marque os itens do checklist; a tarefa só pode ser concluída com todos os itens feitos.</p>
  {botao("Fechar formulário" if sis.ui["form_tarefa"] else "+ Nova tarefa", "ui.form", "btn", qual="tarefa")}
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
      {_campos_padrao("o", "R1-N", None)}
      <label class="largo">Orçamento total (R$){campo_num("o-orc", "orcamento_total", placeholder="Em branco = área × valor do m²")}</label>
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
  {_campos_padrao("e", o.padrao, o.valor_m2)}
  <label class="largo">Orçamento total (R$){campo_num("e-orc", "orcamento_total", o.orcamento_total)}</label>
  <button class="btn" type="submit">Salvar dados</button>
</form>
{_bloco_padrao(o, com_acao=True)}"""


def _campos_padrao(prefixo: str, padrao: str, valor_m2: float | None) -> str:
    rotulos = [
        f'{rotulo_padrao(c)} — {an.moeda(PADROES[c]["valor_m2"])}/m²' if c != "PERS" else "Personalizado (informe o valor)"
        for c in CODIGOS_PADRAO
    ]
    return (
        f'<label>Padrão construtivo<select id="{prefixo}-padrao" name="padrao">{opcoes(CODIGOS_PADRAO, padrao, rotulos)}</select></label>'
        f'<label>Valor por m² (R$){campo_num(f"{prefixo}-vm2", "valor_m2", valor_m2, placeholder="Em branco = valor do padrão")}</label>'
        f'<p class="nota largo">Referência: {esc(REFERENCIA)}. Troque o padrão para usar o valor dele, '
        f'ou digite o CUB do seu estado / custo próprio no valor por m².</p>'
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
    <dt>Orçamento da obra</dt><dd class="num-esq">{an.moeda(p['orcado'])}{f" · {an.moeda(p['orcado_m2'])}/m²" if p['orcado_m2'] else ""}</dd>
  </dl>
  {comp}
  <p class="nota">O CUB não inclui terreno, projetos e taxas, fundações especiais, paisagismo e BDI da construtora (costumam somar 15% a 30%).</p>
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
