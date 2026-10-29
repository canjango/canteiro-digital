"use client";

import * as React from "react";
import { AlertTriangleIcon, CalendarClockIcon, ChevronRightIcon, FileWarningIcon, GavelIcon, InfoIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { UFS, rotuloUf, valorReferencia } from "@/lib/core/catalogo";
import * as pj from "@/lib/core/projetos";
import { arred, dataBr, diasEntre, moeda, num, pct, somarDias, valorBr } from "@/lib/core/util";
import { cn } from "@/lib/utils";
import { Campo, Nota, Pill } from "./comum";
import { AbasArea, Barras, Busca, casa, GRADE_FORM, Indicadores, Sugestoes, Vazio } from "./modulo-comum";
import { DetalheProjeto } from "./projeto-detalhe";
import { TelaDocumentos, TelaRegras } from "./projeto-config";
import { TelaOportunidades } from "./projeto-oportunidades";
import { useEnviar, useSistema } from "./provedor";

export function TelaProjetos() {
  const { sis, acao } = useSistema();
  const g = sis.cadastros;
  const [subBase, filtroCat] = (sis.ui.sub || "visao").split("|");
  const sub = ["visao", "projetos", "oportunidades", "documentos", "regras"].includes(subBase) ? subBase : "visao";
  const alertas = pj.todosAlertas(g, sis.hoje);
  const abertas = g.oportunidades.filter((o) => !pj.FINAIS.includes(o.etapa)).length;
  const docsAlerta = pj.alertasDocumentos(g.documentos, g.regras, sis.hoje).length;
  const aberto = sub === "projetos" && sis.ui.editando ? g.projetos.find((p) => p.id === sis.ui.editando) : undefined;
  return (
    <>
      <AbasArea
        rotulo="Gestão de projetos"
        atual={sub}
        aoEscolher={(id) => acao("ui.sub", { sub: id })}
        abas={[
          { id: "visao", rotulo: "Visão geral", curto: "Visão", contagem: alertas.filter((a) => a.nivel === "critico").length, alerta: true },
          { id: "projetos", rotulo: "Projetos", contagem: g.projetos.filter(pj.projetoAtivo).length },
          { id: "oportunidades", rotulo: "Propostas e licitações", curto: "Propostas", contagem: abertas },
          { id: "documentos", rotulo: "Habilitação", contagem: docsAlerta, alerta: docsAlerta > 0 },
          { id: "regras", rotulo: "Regras" },
        ]}
      />
      {sub === "visao" && <VisaoGeral alertas={alertas} />}
      {sub === "projetos" && (aberto ? <DetalheProjeto p={aberto} /> : <ListaProjetos categoriaInicial={filtroCat ?? ""} />)}
      {sub === "oportunidades" && <TelaOportunidades />}
      {sub === "documentos" && <TelaDocumentos />}
      {sub === "regras" && <TelaRegras />}
    </>
  );
}

// ================================================================ visão geral
const ICONE_ALERTA = { projeto: AlertTriangleIcon, oportunidade: GavelIcon, documento: FileWarningIcon };

function VisaoGeral({ alertas }: { alertas: pj.AlertaProjeto[] }) {
  const { sis, acao } = useSistema();
  const g = sis.cadastros;
  const r = pj.resumoGeral(g, sis.hoje);
  const cats = pj.porCategoria(g, sis.hoje);
  const agenda = agendaProximos(g, sis.hoje, 30);
  const abrir = (a: pj.AlertaProjeto) => {
    if (a.tipo === "projeto") acao("proj.abrir", { id: a.id });
    else if (a.tipo === "oportunidade") { acao("ui.sub", { sub: "oportunidades" }); acao("ui.editar", { id: a.id }); }
    else acao("ui.sub", { sub: "documentos" });
  };
  if (!g.projetos.length && !g.oportunidades.length) return <PrimeirosPassos />;
  return (
    <>
      <Indicadores
        itens={[
          { rotulo: "Carteira ativa", valor: moeda(r.carteira), sub: `${r.ativos} projeto(s) · ${r.atrasados} atrasado(s)`, tom: r.atrasados ? "atencao" : undefined },
          { rotulo: "Valor agregado", valor: moeda(r.agregado), sub: r.margem === null ? "sem avanço ainda" : `margem ${pct(r.margem)} sobre o custo das horas`, tom: r.margem !== null && r.margem * 100 < g.regras.margem_minima ? "critico" : undefined },
          { rotulo: "A receber", valor: moeda(r.a_receber), sub: r.atrasado ? `${moeda(r.atrasado)} em atraso` : `recebido no mês ${moeda(r.recebido_mes)}`, tom: r.atrasado ? "critico" : undefined },
          { rotulo: "Em disputa", valor: moeda(r.em_disputa), sub: `${r.oportunidades_abertas} aberta(s) · ponderado ${moeda(r.ponderado)}${r.conversao === null ? "" : ` · conversão ${pct(r.conversao)}`}` },
          { rotulo: "Horas no mês", valor: `${num(r.horas_mes)} h`, sub: `custo total ${moeda(r.custo)}` },
        ]}
      />
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <Card className="gap-0 p-0">
          <h3 className="flex items-center gap-2 border-b px-4 py-3 text-[0.92rem] font-semibold">
            Regras e alertas <span className="font-mono text-xs font-normal text-muted-foreground">{alertas.length}</span>
          </h3>
          {alertas.length ? (
            <ul className="max-h-[28rem] divide-y overflow-y-auto">
              {alertas.slice(0, 40).map((a, k) => {
                const I = ICONE_ALERTA[a.tipo];
                return (
                  <li key={k}>
                    <button type="button" onClick={() => abrir(a)} className="flex w-full items-start gap-2.5 px-4 py-2.5 text-left hover:bg-muted">
                      <I className={cn("mt-0.5 size-4 shrink-0", a.nivel === "critico" ? "text-critico" : a.nivel === "atencao" ? "text-atencao" : "text-muted-foreground")} />
                      <span className="flex min-w-0 flex-col">
                        <span className="text-sm font-medium">{a.titulo}</span>
                        <span className="text-[0.78rem] text-muted-foreground">{a.detalhe}</span>
                      </span>
                      <ChevronRightIcon className="ml-auto mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="px-4 py-6 text-sm text-muted-foreground">Nenhum alerta. Prazos, horas, aprovações e documentos em dia.</p>
          )}
        </Card>
        <div className="flex flex-col gap-4">
          <Card className="gap-3 p-4">
            <h3 className="text-[0.92rem] font-semibold">Carteira por tipo de obra</h3>
            <Barras
              formatar={moeda}
              linhas={[...cats.entries()].filter(([, v]) => v.quantidade).sort((a, b) => b[1].carteira - a[1].carteira).map(([c, v]) => ({
                rotulo: c, valor: v.carteira, extra: `${v.ativos}/${v.quantidade}`, aoClicar: () => acao("ui.sub", { sub: `projetos|${c}` }),
              }))}
            />
            {![...cats.values()].some((v) => v.quantidade) && <Nota>Sem projetos ainda.</Nota>}
          </Card>
          <Card className="gap-0 p-0">
            <h3 className="flex items-center gap-2 border-b px-4 py-3 text-[0.92rem] font-semibold"><CalendarClockIcon className="size-4" />Próximos 30 dias</h3>
            {agenda.length ? (
              <ul className="max-h-80 divide-y overflow-y-auto">
                {agenda.map((e, k) => (
                  <li key={k}>
                    <button type="button" onClick={e.abrir} className="grid w-full grid-cols-[4.5rem_minmax(0,1fr)] gap-2 px-4 py-2 text-left hover:bg-muted">
                      <span className="font-mono text-[0.78rem]">{dataBr(e.data).slice(0, 5)}<span className="block text-[0.7rem] text-muted-foreground">{diasEntre(sis.hoje, e.data) === 0 ? "hoje" : `em ${diasEntre(sis.hoje, e.data)} d`}</span></span>
                      <span className="min-w-0"><span className="block truncate text-sm">{e.titulo}</span><span className="block truncate text-[0.76rem] text-muted-foreground">{e.sub}</span></span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-4 py-5 text-sm text-muted-foreground">Nada agendado para os próximos 30 dias.</p>
            )}
          </Card>
        </div>
      </div>
    </>
  );

  function agendaProximos(dados: pj.DadosProjetos, hoje: string, dias: number) {
    const fim = somarDias(hoje, dias);
    const ev: { data: string; titulo: string; sub: string; abrir: () => void }[] = [];
    const dentro = (d: string) => d && d >= hoje && d <= fim;
    for (const p of dados.projetos.filter(pj.projetoAtivo)) {
      for (const f of p.fases) if (!f.concluida_em && dentro(f.prazo)) ev.push({ data: f.prazo, titulo: `${f.codigo} · ${pj.faseCatalogo(f.codigo)?.nome}`, sub: `${p.codigo} ${p.nome}`, abrir: () => acao("proj.abrir", { id: p.id }) });
      for (const x of p.parcelas) if (x.status !== "Recebida" && dentro(x.vencimento)) ev.push({ data: x.vencimento, titulo: `Receber ${moeda(x.valor)}`, sub: `${p.codigo} · ${x.descricao}`, abrir: () => acao("proj.abrir", { id: p.id }) });
    }
    for (const o of dados.oportunidades.filter((x) => !pj.FINAIS.includes(x.etapa))) {
      const abrirO = () => { acao("ui.sub", { sub: "oportunidades" }); acao("ui.editar", { id: o.id }); };
      if (dentro(o.abertura)) ev.push({ data: o.abertura, titulo: `Sessão: ${o.titulo}`, sub: `${o.modalidade} ${o.edital}`, abrir: abrirO });
      const imp = o.tipo === "Licitação" ? pj.prazosLicitacao(o).impugnacao : "";
      if (dentro(imp) && ["Análise do edital", "Em preparação"].includes(o.etapa)) ev.push({ data: imp, titulo: `Limite p/ impugnar: ${o.titulo}`, sub: "art. 164 — 3 dias úteis antes", abrir: abrirO });
      if (o.tipo === "Proposta" && dentro(o.validade)) ev.push({ data: o.validade, titulo: `Validade da proposta: ${o.titulo}`, sub: o.cliente, abrir: abrirO });
    }
    for (const d of dados.documentos) if (dentro(d.validade)) ev.push({ data: d.validade, titulo: `Vence: ${d.nome}`, sub: d.grupo, abrir: () => acao("ui.sub", { sub: "documentos" }) });
    return ev.sort((a, b) => a.data.localeCompare(b.data));
  }
}

function PrimeirosPassos() {
  const { acao } = useSistema();
  const passos: [string, string, () => void][] = [
    ["1. Revise as regras do escritório", "Percentual de honorários por padrão, revisões incluídas, custo da hora, K e pesos das fases.", () => acao("ui.sub", { sub: "regras" })],
    ["2. Cadastre propostas e licitações", "Funil de propostas particulares e licitações com prazos da Lei 14.133.", () => acao("ui.sub", { sub: "oportunidades" })],
    ["3. Crie o primeiro projeto", "Escolha o tipo de obra: as fases e os honorários vêm calculados pelas regras.", () => { acao("ui.sub", { sub: "projetos" }); acao("ui.novo", { qual: "projeto" }); }],
    ["4. Documentos de habilitação", "Certidões com validade, usadas no checklist de cada licitação.", () => acao("ui.sub", { sub: "documentos" })],
  ];
  return (
    <Card className="gap-3 p-5">
      <h2 className="text-lg font-bold">Comece por aqui</h2>
      <Nota>Gestão de projetos por fase com honorários, horas, entregáveis, aprovações do cliente, propostas e licitações.</Nota>
      <div className="grid gap-2.5 md:grid-cols-2">
        {passos.map(([t, d, f]) => (
          <button key={t} type="button" onClick={f} className="flex flex-col gap-1 rounded-lg border p-3.5 text-left hover:border-foreground">
            <span className="font-semibold">{t}</span>
            <span className="text-[0.84rem] text-muted-foreground">{d}</span>
          </button>
        ))}
      </div>
    </Card>
  );
}

// ================================================================ lista separada por tipo de obra
function ListaProjetos({ categoriaInicial }: { categoriaInicial: string }) {
  const { sis, acao } = useSistema();
  const g = sis.cadastros;
  const [cat, setCat] = React.useState(pj.CATEGORIAS.includes(categoriaInicial) ? categoriaInicial : "");
  const [padrao, setPadrao] = React.useState("");
  const [origem, setOrigem] = React.useState("");
  const [situacao, setSituacao] = React.useState("ativos");
  const [busca, setBusca] = React.useState("");
  React.useEffect(() => { if (pj.CATEGORIAS.includes(categoriaInicial)) setCat(categoriaInicial); }, [categoriaInicial]);
  const filtrados = g.projetos.filter((p) =>
    (!cat || p.categoria === cat) && (!padrao || p.padrao === padrao) && (!origem || p.origem === origem)
    && (situacao === "todos" || (situacao === "ativos" ? pj.projetoAtivo(p) : p.status === situacao))
    && casa(busca, p.nome, p.codigo, p.cliente, p.tipo_obra, p.responsavel));
  const grupos = pj.CATEGORIAS.map((c) => [c, filtrados.filter((p) => p.categoria === c)] as const).filter(([, l]) => l.length);
  const contagem = (c: string) => g.projetos.filter((p) => p.categoria === c && (situacao === "todos" || (situacao === "ativos" ? pj.projetoAtivo(p) : p.status === situacao))).length;
  return (
    <>
      <Card className="flex-row flex-wrap items-center justify-between gap-2.5 p-3 md:p-4">
        <Nota className="min-w-0 flex-1 basis-72">Projetos separados por tipo de obra. As fases, os pesos e o % de honorários vêm das regras do escritório e podem ser ajustados em cada projeto.</Nota>
        <Button onClick={() => acao("ui.novo", { qual: "projeto" })} variant={sis.ui.novo === "projeto" ? "outline" : "default"}>{sis.ui.novo === "projeto" ? "Fechar formulário" : "Novo projeto"}</Button>
      </Card>
      {sis.ui.novo === "projeto" && <FormProjeto />}
      <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:thin]" role="group" aria-label="Tipo de obra">
        {["", ...pj.CATEGORIAS].map((c) => (
          <Button key={c || "todas"} size="sm" variant={cat === c ? "default" : "outline"} aria-pressed={cat === c} onClick={() => setCat(c)} className="shrink-0">
            {c || "Todos os tipos"} <span className="font-mono text-[0.7rem] opacity-70">{c ? contagem(c) : pj.CATEGORIAS.reduce((s, x) => s + contagem(x), 0)}</span>
          </Button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Busca valor={busca} aoMudar={setBusca} placeholder="Buscar projeto, cliente, código…" />
        <NativeSelect aria-label="Padrão" value={padrao} onChange={(e) => setPadrao(e.target.value)} className="w-auto"><option value="">Todos os padrões</option>{pj.PADROES_PROJETO.map((x) => <option key={x}>{x}</option>)}</NativeSelect>
        <NativeSelect aria-label="Origem" value={origem} onChange={(e) => setOrigem(e.target.value)} className="w-auto"><option value="">Todas as origens</option>{pj.ORIGENS.map((x) => <option key={x}>{x}</option>)}</NativeSelect>
        <NativeSelect aria-label="Situação" value={situacao} onChange={(e) => setSituacao(e.target.value)} className="w-auto">
          <option value="ativos">Em andamento (ativos)</option>
          {pj.STATUS_PROJETO.map((x) => <option key={x}>{x}</option>)}
          <option value="todos">Todas as situações</option>
        </NativeSelect>
      </div>
      {grupos.length ? (
        grupos.map(([c, lista]) => (
          <section key={c} className="flex flex-col gap-2" aria-label={c}>
            <h2 className="flex items-center gap-2 text-[0.78rem] font-semibold uppercase tracking-wider text-muted-foreground">
              {c} <span className="font-mono font-normal">{lista.length}</span>
            </h2>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,340px),1fr))] gap-2.5">
              {lista.map((p) => <CartaoProjeto key={p.id} p={p} />)}
            </div>
          </section>
        ))
      ) : (
        <Vazio>{g.projetos.length ? "Nenhum projeto com esses filtros." : "Nenhum projeto ainda. Use “Novo projeto” ou converta uma proposta ganha."}</Vazio>
      )}
    </>
  );
}

function CartaoProjeto({ p }: { p: pj.Projeto }) {
  const { sis, acao } = useSistema();
  const r = pj.resultado(p, sis.hoje);
  const av = pj.avancoProjeto(p);
  const atual = pj.faseAtual(p).fase;
  const atrasado = pj.projetoAtrasado(p, sis.hoje);
  const alertas = pj.alertasProjeto(p, sis.cadastros.regras, sis.hoje);
  return (
    <button
      type="button"
      onClick={() => acao("proj.abrir", { id: p.id })}
      className={cn("flex flex-col gap-2 rounded-lg border bg-card p-3.5 text-left text-card-foreground transition-colors hover:border-foreground", atrasado && "border-critico shadow-[inset_3px_0_0_var(--critico)]")}
    >
      <span className="flex w-full items-start gap-2">
        <span className="min-w-0 flex-1">
          <span className="block font-mono text-[0.74rem] text-muted-foreground">{p.codigo}</span>
          <span className="block break-words font-semibold">{p.nome}</span>
        </span>
        <Pill texto={p.padrao} />
      </span>
      <span className="text-[0.8rem] text-muted-foreground">{[p.tipo_obra, p.cliente, p.area ? `${num(p.area)} m²` : "", p.origem !== "Cliente particular" ? p.origem : ""].filter(Boolean).join(" · ")}</span>
      <span className="flex flex-wrap items-center gap-1.5">
        <Pill texto={p.status} />
        {atrasado && <Pill texto="Atrasada" />}
        {alertas.length > 0 && <span className="text-[0.74rem] font-medium text-atencao">{alertas.length} alerta(s)</span>}
      </span>
      <span className="text-[0.82rem]">{atual ? <>Fase atual: <b>{atual.codigo}</b> {pj.faseCatalogo(atual.codigo)?.nome}{atual.prazo && <span className={cn("text-muted-foreground", atual.prazo < sis.hoje && "text-critico")}> · até {dataBr(atual.prazo)}</span>}</> : "Todas as fases concluídas"}</span>
      <span className="flex items-center gap-2 text-[0.78rem] text-muted-foreground"><Progress value={av} className="flex-1" />{pct(av)}</span>
      <span className="grid grid-cols-3 gap-1 border-t pt-2 text-[0.74rem] text-muted-foreground">
        <span><b className="block font-mono text-[0.84rem] text-foreground">{moeda(r.contratado)}</b>contratado</span>
        <span><b className="block font-mono text-[0.84rem] text-foreground">{moeda(r.recebido)}</b>recebido</span>
        <span><b className={cn("block font-mono text-[0.84rem] text-foreground", r.margem !== null && r.margem < 0 && "text-critico")}>{r.margem === null ? "—" : pct(r.margem)}</b>margem</span>
      </span>
    </button>
  );
}

// ================================================================ formulário (novo e editar), com cálculo dos honorários na hora
export function FormProjeto({ p, aoFechar }: { p?: pj.Projeto; aoFechar?: () => void }) {
  const { sis, acao } = useSistema();
  const enviar = useEnviar();
  const r = sis.cadastros.regras;
  const [tipo, setTipo] = React.useState(p?.tipo_obra ?? "Residência unifamiliar");
  const [padrao, setPadrao] = React.useState<pj.PadraoProjeto>(p?.padrao ?? "Alto padrão");
  const [origem, setOrigem] = React.useState<string>(p?.origem ?? "Cliente particular");
  const [uf, setUf] = React.useState(p?.uf ?? "PB");
  const [metodo, setMetodo] = React.useState<pj.MetodoHonorario>(p?.honorarios.metodo ?? "Percentual do custo da obra");
  const [v, setV] = React.useState({
    area: p ? num(p.area) : "", percentual: p ? num(p.honorarios.percentual) : "", custo_m2: p ? valorBr(p.honorarios.custo_m2) : "",
    valor_m2: p?.honorarios.valor_m2 ? valorBr(p.honorarios.valor_m2) : "", valor_fixo: p?.honorarios.valor_fixo ? valorBr(p.honorarios.valor_fixo) : "",
    horas_estimadas: p?.honorarios.horas_estimadas ? num(p.honorarios.horas_estimadas) : "", custo_hora: p ? valorBr(p.honorarios.custo_hora) : "",
    desconto: p?.honorarios.desconto ? num(p.honorarios.desconto) : "",
  });
  const campo = (k: keyof typeof v) => ({ value: v[k], onChange: (e: React.ChangeEvent<HTMLInputElement>) => setV((x) => ({ ...x, [k]: e.target.value })) });
  const cub = valorReferencia(pj.CUB_DO_PADRAO[padrao], uf);
  const n = (t: string) => { const x = Number(String(t).replace(/\./g, "").replace(",", ".")); return Number.isFinite(x) ? x : 0; };
  const area = n(v.area);
  const custoM2 = v.custo_m2 ? n(v.custo_m2) : cub;
  const percentual = v.percentual ? n(v.percentual) : r.percentual_padrao[padrao];
  const custoHora = v.custo_hora ? n(v.custo_hora) : r.custo_hora_padrao;
  const k = pj.fatorK(p?.honorarios.k ?? r.k);
  const bruto = metodo === "Percentual do custo da obra" ? area * custoM2 * percentual / 100 : metodo === "Valor por m²" ? area * n(v.valor_m2) : metodo === "Valor fixo" ? n(v.valor_fixo) : n(v.horas_estimadas) * custoHora * k;
  const total = arred(bruto * (1 - n(v.desconto) / 100));
  const categoria = pj.categoriaDoTipo(tipo);
  const modelo = p?.modelo ?? pj.modeloSugerido(categoria, tipo, origem);
  const fases = Object.keys(r.modelos[modelo] ?? {});
  const pessoas = sis.cadastros.equipe.filter((m) => m.ativo).map((m) => m.nome);
  return (
    <Card className="p-4">
      <h3 className="font-semibold">{p ? `Editar ${p.codigo}` : "Novo projeto"}</h3>
      <form className="flex flex-col gap-4" onSubmit={(e) => { const res = enviar("proj.salvar", p ? { id: p.id } : {})(e); if (res.ok) aoFechar?.(); }}>
        <fieldset className={GRADE_FORM}>
          <legend className="mb-1 text-[0.78rem] font-semibold uppercase tracking-wider text-muted-foreground">Identificação</legend>
          <Campo rotulo="Nome do projeto" className="col-span-full"><Input name="nome" required maxLength={200} defaultValue={p?.nome} placeholder="Ex.: Residência Silva" /></Campo>
          <Campo rotulo="Tipo de obra">
            <NativeSelect name="tipo_obra" value={tipo} onChange={(e) => setTipo(e.target.value)}>
              {pj.CATEGORIAS.map((c) => <optgroup key={c} label={c}>{pj.CATEGORIAS_OBRA[c].map((t) => <option key={t}>{t}</option>)}</optgroup>)}
            </NativeSelect>
          </Campo>
          <Campo rotulo="Padrão">
            <NativeSelect name="padrao" value={padrao} onChange={(e) => setPadrao(e.target.value as pj.PadraoProjeto)}>{pj.PADROES_PROJETO.map((x) => <option key={x}>{x}</option>)}</NativeSelect>
          </Campo>
          <Campo rotulo="Origem">
            <NativeSelect name="origem" value={origem} onChange={(e) => setOrigem(e.target.value)}>{pj.ORIGENS.map((x) => <option key={x}>{x}</option>)}</NativeSelect>
          </Campo>
          <Campo rotulo="Cliente / órgão"><Input name="cliente" maxLength={200} defaultValue={p?.cliente} list="clientes-projeto" /></Campo>
          <Campo rotulo="Área (m²)"><Input name="area" inputMode="decimal" autoComplete="off" {...campo("area")} placeholder="0" /></Campo>
          <Campo rotulo="UF (CUB)">
            <NativeSelect name="uf" value={uf} onChange={(e) => setUf(e.target.value)}>{UFS.map((u) => <option key={u} value={u}>{rotuloUf(u)}</option>)}</NativeSelect>
          </Campo>
          <Campo rotulo="Endereço" className="col-span-full"><Input name="endereco" maxLength={200} defaultValue={p?.endereco} /></Campo>
          <Campo rotulo="Responsável"><Input name="responsavel" maxLength={80} defaultValue={p?.responsavel} list="pessoas-projeto" /></Campo>
          <Campo rotulo="Início"><Input name="inicio" type="date" defaultValue={p?.inicio} /></Campo>
          <Campo rotulo="Entrega final"><Input name="entrega" type="date" defaultValue={p?.entrega} /></Campo>
          <Campo rotulo="Situação"><NativeSelect name="status" defaultValue={p?.status ?? "Em andamento"}>{pj.STATUS_PROJETO.map((x) => <option key={x}>{x}</option>)}</NativeSelect></Campo>
          <Campo rotulo="Código"><Input name="codigo" maxLength={20} defaultValue={p?.codigo} placeholder="Automático (PRJ-ano-nº)" /></Campo>
          <Nota className="col-span-full text-[0.78rem]">
            Categoria: <b>{categoria}</b> · modelo de fases: <b>{modelo}</b> ({fases.join(" → ")}){p ? " — para mudar as fases, use a aba Fases do projeto." : "."}
          </Nota>
        </fieldset>
        <fieldset className={GRADE_FORM}>
          <legend className="mb-1 text-[0.78rem] font-semibold uppercase tracking-wider text-muted-foreground">Honorários</legend>
          <Campo rotulo="Forma de cálculo" className="col-span-full sm:col-span-2">
            <NativeSelect name="metodo" value={metodo} onChange={(e) => setMetodo(e.target.value as pj.MetodoHonorario)}>{pj.METODOS_HONORARIO.map((x) => <option key={x}>{x}</option>)}</NativeSelect>
          </Campo>
          {metodo === "Percentual do custo da obra" && (
            <>
              <Campo rotulo={`% sobre o custo da obra (regra: ${num(r.percentual_padrao[padrao])}%)`}><Input name="percentual" inputMode="decimal" {...campo("percentual")} placeholder={num(r.percentual_padrao[padrao])} /></Campo>
              <Campo rotulo={`Custo da obra por m² (CUB ${pj.CUB_DO_PADRAO[padrao]}-${uf}: ${moeda(cub)})`}><Input name="custo_m2" inputMode="decimal" {...campo("custo_m2")} placeholder={valorBr(cub)} /></Campo>
            </>
          )}
          {metodo === "Valor por m²" && <Campo rotulo="Honorário por m² (R$)"><Input name="valor_m2" inputMode="decimal" {...campo("valor_m2")} placeholder="0,00" /></Campo>}
          {metodo === "Valor fixo" && <Campo rotulo="Valor dos honorários (R$)"><Input name="valor_fixo" inputMode="decimal" {...campo("valor_fixo")} placeholder="0,00" /></Campo>}
          <Campo rotulo={metodo === "Custo do serviço (horas × K)" ? "Horas estimadas" : "Horas estimadas (orçamento de horas)"}><Input name="horas_estimadas" inputMode="decimal" {...campo("horas_estimadas")} placeholder="0" /></Campo>
          {metodo === "Custo do serviço (horas × K)" && <Campo rotulo={`Custo por hora (regra: ${moeda(r.custo_hora_padrao)})`}><Input name="custo_hora" inputMode="decimal" {...campo("custo_hora")} placeholder={valorBr(r.custo_hora_padrao)} /></Campo>}
          <Campo rotulo="Desconto (%)"><Input name="desconto" inputMode="decimal" {...campo("desconto")} placeholder="0" /></Campo>
          <Campo rotulo={`Revisões incluídas (regra: ${r.revisoes_padrao[padrao]})`}><Input name="revisoes_incluidas" type="number" min={0} max={20} defaultValue={p?.revisoes_incluidas} placeholder={String(r.revisoes_padrao[padrao])} /></Campo>
          <div className="col-span-full rounded-md border border-dashed bg-muted/60 px-3 py-2.5 text-sm" aria-live="polite">
            <span className="font-semibold">Honorários: <span className="font-mono">{moeda(total)}</span></span>
            <span className="block text-[0.78rem] text-muted-foreground">
              {metodo === "Percentual do custo da obra" && `${num(area)} m² × ${moeda(custoM2)} = ${moeda(area * custoM2)} de obra × ${num(percentual)}%`}
              {metodo === "Valor por m²" && `${num(area)} m² × ${moeda(n(v.valor_m2))}`}
              {metodo === "Valor fixo" && "Valor combinado"}
              {metodo === "Custo do serviço (horas × K)" && `${num(n(v.horas_estimadas))} h × ${moeda(custoHora)} × K ${k.toFixed(3).replace(".", ",")} (encargos, indiretas, lucro e impostos — Modalidade 02 CAU)`}
              {n(v.desconto) > 0 && ` − ${num(n(v.desconto))}% de desconto`}
              {area > 0 && total > 0 && ` · ${moeda(total / area)}/m²`}
            </span>
          </div>
        </fieldset>
        <Campo rotulo="Observação"><Textarea name="observacao" rows={2} maxLength={3000} defaultValue={p?.observacao} placeholder="Escopo, exclusões, condições do contrato…" /></Campo>
        <Sugestoes id="clientes-projeto" valores={[...sis.cadastros.contatos.filter((c) => c.tipo === "Cliente").map((c) => c.nome), ...sis.cadastros.projetos.map((x) => x.cliente)].filter(Boolean)} />
        <Sugestoes id="pessoas-projeto" valores={pessoas} />
        <div className="flex flex-wrap gap-2">
          <Button type="submit">{p ? "Salvar alterações" : "Criar projeto"}</Button>
          <Button type="button" variant="outline" onClick={() => (aoFechar ? aoFechar() : acao("ui.novo", { qual: "projeto" }))}>Cancelar</Button>
        </div>
        {!p && <Nota className="flex items-start gap-1.5 text-[0.76rem]"><InfoIcon className="mt-0.5 size-3.5 shrink-0" />Com início e entrega preenchidos, os prazos das fases são distribuídos pelos pesos. As horas estimadas viram o orçamento de horas de cada fase.</Nota>}
      </form>
    </Card>
  );
}
