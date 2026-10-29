"use client";

import * as React from "react";
import {
  BookmarkPlusIcon, CheckIcon, ClipboardPasteIcon, CopyIcon, ExternalLinkIcon, ImageOffIcon, PencilIcon, PlusIcon, PrinterIcon, Trash2Icon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import * as pj from "@/lib/core/projetos";
import * as px from "@/lib/core/projetos-extra";
import { dataBr, diasEntre, moeda, num, pct, valorBr } from "@/lib/core/util";
import { cn } from "@/lib/utils";
import { Campo, CampoNumero, Nota, Pill } from "./comum";
import { Barras, BotaoExcluir, Busca, casa, GRADE_FORM, Indicadores, Sugestoes, Vazio } from "./modulo-comum";
import { useEnviar, useSistema } from "./provedor";

const nomeFase = (c: string) => pj.faseCatalogo(c)?.nome ?? c;
const rev = (n: number) => `R${String(n).padStart(2, "0")}`;
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const rotuloMes = (m: string) => `${MESES[Number(m.slice(5, 7)) - 1]}/${m.slice(2, 4)}`;

/** Escolha do projeto nas telas que trabalham com um projeto por vez. */
function useProjetoEscolhido(inicial: string) {
  const { sis } = useSistema();
  const lista = [...sis.cadastros.projetos].sort((a, b) => Number(pj.projetoAtivo(b)) - Number(pj.projetoAtivo(a)) || b.codigo.localeCompare(a.codigo));
  const [id, setId] = React.useState(inicial && lista.some((p) => p.id === inicial) ? inicial : lista[0]?.id ?? "");
  React.useEffect(() => { if (inicial && lista.some((p) => p.id === inicial)) setId(inicial); }, [inicial]); // eslint-disable-line react-hooks/exhaustive-deps
  const p = lista.find((x) => x.id === id) ?? lista[0];
  const seletor = (
    <NativeSelect aria-label="Projeto" value={p?.id ?? ""} onChange={(e) => setId(e.target.value)} className="w-full sm:w-auto sm:min-w-80">
      {lista.map((x) => <option key={x.id} value={x.id}>{x.codigo} · {x.nome}{pj.projetoAtivo(x) ? "" : ` (${x.status.toLowerCase()})`}</option>)}
    </NativeSelect>
  );
  return { p, seletor, vazio: !lista.length };
}

function SemProjetos() {
  const { acao } = useSistema();
  return (
    <Vazio>
      Nenhum projeto ainda. <button type="button" className="font-semibold underline" onClick={() => { acao("ui.sub", { sub: "projetos" }); acao("ui.novo", { qual: "projeto" }); }}>Criar o primeiro projeto</button>
    </Vazio>
  );
}

// ================================================================ cronograma (Gantt)
export function TelaCronograma() {
  const { sis, acao } = useSistema();
  const g = sis.cadastros;
  const [cat, setCat] = React.useState("");
  const [todos, setTodos] = React.useState(false);
  const [abertos, setAbertos] = React.useState<string[]>([]);
  const projetos = g.projetos.filter((p) => (todos || pj.projetoAtivo(p)) && (!cat || p.categoria === cat)).sort((a, b) => (a.inicio || "9999").localeCompare(b.inicio || "9999"));
  const comDatas = projetos.filter((p) => px.barrasProjeto(p, sis.hoje).length);
  const semDatas = projetos.filter((p) => !px.barrasProjeto(p, sis.hoje).length);
  const j = px.janelaCronograma(comDatas, sis.hoje);
  const pos = (d: string) => Math.min(100, Math.max(0, (diasEntre(j.inicio, d) / j.dias) * 100));
  const meses: string[] = [];
  for (let d = j.inicio; d < j.fim; ) {
    meses.push(d.slice(0, 7));
    const [a, m] = [Number(d.slice(0, 4)), Number(d.slice(5, 7))];
    d = m === 12 ? `${a + 1}-01-01` : `${a}-${String(m + 1).padStart(2, "0")}-01`;
  }
  const cor = (b: px.BarraCronograma, atual: boolean) => (b.concluida ? "bg-ok" : b.atrasada ? "bg-critico" : atual ? "bg-sinal" : "bg-muted-foreground/40");
  const hojeX = pos(sis.hoje);
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <NativeSelect aria-label="Tipo de obra" value={cat} onChange={(e) => setCat(e.target.value)} className="w-auto"><option value="">Todos os tipos de obra</option>{pj.CATEGORIAS.map((c) => <option key={c}>{c}</option>)}</NativeSelect>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={todos} onChange={(e) => setTodos(e.target.checked)} className="size-4" />Incluir concluídos</label>
        <span className="ml-auto flex flex-wrap items-center gap-3 text-[0.76rem] text-muted-foreground">
          <span className="flex items-center gap-1"><span className="size-3 rounded-sm bg-ok" />concluída</span>
          <span className="flex items-center gap-1"><span className="size-3 rounded-sm bg-sinal" />em andamento</span>
          <span className="flex items-center gap-1"><span className="size-3 rounded-sm bg-muted-foreground/40" />a fazer</span>
          <span className="flex items-center gap-1"><span className="size-3 rounded-sm bg-critico" />atrasada</span>
        </span>
      </div>
      {comDatas.length ? (
        <Card className="gap-0 overflow-hidden p-0">
          <div className="overflow-x-auto">
            <div className="min-w-[860px]">
              <div className="grid grid-cols-[240px_minmax(0,1fr)] border-b bg-muted text-[0.74rem] font-semibold">
                <span className="px-3 py-2">Projeto / fase</span>
                <div className="relative flex">
                  {meses.map((m) => <span key={m} className="flex-1 border-l px-1.5 py-2 text-muted-foreground" style={{ flexBasis: 0 }}>{rotuloMes(m)}</span>)}
                </div>
              </div>
              {comDatas.map((p) => {
                const barras = px.barrasProjeto(p, sis.hoje);
                const atual = pj.faseAtual(p).fase?.codigo;
                const aberto = abertos.includes(p.id);
                const ini = barras[0].inicio;
                const fim = barras.at(-1)!.fim;
                return (
                  <div key={p.id} className="border-b last:border-b-0">
                    <div className="grid grid-cols-[240px_minmax(0,1fr)] items-center hover:bg-muted/50">
                      <button type="button" className="flex min-w-0 items-center gap-1.5 px-3 py-2 text-left" onClick={() => setAbertos((a) => (aberto ? a.filter((x) => x !== p.id) : [...a, p.id]))} aria-expanded={aberto}>
                        <span className="text-muted-foreground">{aberto ? "▾" : "▸"}</span>
                        <span className="min-w-0"><span className="block truncate text-sm font-medium">{p.nome}</span><span className="block truncate font-mono text-[0.7rem] text-muted-foreground">{p.codigo} · {pct(pj.avancoProjeto(p))}</span></span>
                      </button>
                      <div className="relative h-9">
                        <span className="absolute inset-y-0 w-px bg-critico/70" style={{ left: `${hojeX}%` }} aria-hidden />
                        <button type="button" onClick={() => acao("proj.abrir", { id: p.id })} title={`${p.codigo} ${p.nome}: ${dataBr(ini)} → ${dataBr(fim)}`} className="absolute top-2 flex h-5 overflow-hidden rounded-sm border border-foreground/20" style={{ left: `${pos(ini)}%`, width: `${Math.max(0.8, pos(fim) - pos(ini))}%` }}>
                          {barras.map((b) => (
                            <span key={b.codigo} className={cn("h-full border-r border-background/60 last:border-r-0", cor(b, b.codigo === atual))} style={{ flexGrow: Math.max(1, diasEntre(b.inicio, b.fim)) }} title={`${b.codigo} ${nomeFase(b.codigo)}: ${dataBr(b.inicio)} → ${dataBr(b.fim)}`} />
                          ))}
                        </button>
                      </div>
                    </div>
                    {aberto && barras.map((b) => (
                      <div key={b.codigo} className="grid grid-cols-[240px_minmax(0,1fr)] items-center">
                        <span className="truncate py-1 pl-9 pr-3 text-[0.78rem] text-muted-foreground">{b.codigo} · {nomeFase(b.codigo)}</span>
                        <div className="relative h-7">
                          <span className="absolute inset-y-0 w-px bg-critico/70" style={{ left: `${hojeX}%` }} aria-hidden />
                          <span className={cn("absolute top-1.5 h-4 rounded-sm", cor(b, b.codigo === atual))} style={{ left: `${pos(b.inicio)}%`, width: `${Math.max(0.6, pos(b.fim) - pos(b.inicio))}%` }} title={`${dataBr(b.inicio)} → ${dataBr(b.fim)}`} />
                          {p.tarefas.filter((t) => t.fase === b.codigo && t.prazo && t.status !== "Concluída").map((t) => (
                            <span key={t.id} className={cn("absolute top-1 size-2.5 -translate-x-1/2 rotate-45 border border-background", px.tarefaAtrasada(t, sis.hoje) ? "bg-critico" : "bg-foreground")} style={{ left: `${pos(t.prazo)}%` }} title={`Tarefa: ${t.titulo} · ${dataBr(t.prazo)}`} />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
          <Nota className="border-t px-4 py-2 text-[0.76rem]">Linha vermelha: hoje ({dataBr(sis.hoje)}). Toque no nome para ver as fases e os prazos das tarefas (◆); toque na barra para abrir o projeto.</Nota>
        </Card>
      ) : <Vazio>Nenhum projeto com prazos para mostrar. Defina início e entrega nos projetos.</Vazio>}
      {semDatas.length > 0 && (
        <Card className="gap-1 p-3.5">
          <h3 className="text-[0.86rem] font-semibold">Sem prazos definidos ({semDatas.length})</h3>
          <div className="flex flex-wrap gap-2">{semDatas.map((p) => <Button key={p.id} size="sm" variant="outline" onClick={() => acao("proj.abrir", { id: p.id })}>{p.codigo} · {p.nome}</Button>)}</div>
        </Card>
      )}
    </>
  );
}

// ================================================================ tarefas (todos os projetos)
const COR_PRIO: Record<string, string> = { Baixa: "Baixa", Média: "Média", Alta: "Alta", Urgente: "Urgente" };

export function TelaTarefasProjetos() {
  const { sis, acao } = useSistema();
  const g = sis.cadastros;
  const [projeto, setProjeto] = React.useState("");
  const [resp, setResp] = React.useState("");
  const [busca, setBusca] = React.useState("");
  const [atrasadas, setAtrasadas] = React.useState(false);
  const todas = px.todasTarefas(g);
  const lista = todas.filter(({ p, t }) => (!projeto || p.id === projeto) && (!resp || t.responsavel === resp) && (!atrasadas || px.tarefaAtrasada(t, sis.hoje)) && casa(busca, t.titulo, p.nome, p.codigo, t.responsavel));
  const responsaveis = [...new Set(todas.map(({ t }) => t.responsavel).filter(Boolean))].sort();
  const ativos = g.projetos.filter(pj.projetoAtivo);
  if (!g.projetos.length) return <SemProjetos />;
  return (
    <>
      <Indicadores
        itens={[
          { rotulo: "Em aberto", valor: String(todas.filter(({ t }) => t.status !== "Concluída").length) },
          { rotulo: "Atrasadas", valor: String(todas.filter(({ t }) => px.tarefaAtrasada(t, sis.hoje)).length), tom: todas.some(({ t }) => px.tarefaAtrasada(t, sis.hoje)) ? "critico" : undefined },
          { rotulo: "Vencem em 7 dias", valor: String(todas.filter(({ t }) => t.status !== "Concluída" && t.prazo >= sis.hoje && diasEntre(sis.hoje, t.prazo) <= 7).length) },
          { rotulo: "Concluídas", valor: String(todas.filter(({ t }) => t.status === "Concluída").length), tom: "ok" },
        ]}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Busca valor={busca} aoMudar={setBusca} placeholder="Buscar tarefa ou projeto…" />
        <NativeSelect aria-label="Projeto" value={projeto} onChange={(e) => setProjeto(e.target.value)} className="w-auto max-w-72"><option value="">Todos os projetos</option>{g.projetos.map((p) => <option key={p.id} value={p.id}>{p.codigo} · {p.nome}</option>)}</NativeSelect>
        <NativeSelect aria-label="Responsável" value={resp} onChange={(e) => setResp(e.target.value)} className="w-auto"><option value="">Todos os responsáveis</option>{responsaveis.map((r) => <option key={r}>{r}</option>)}</NativeSelect>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={atrasadas} onChange={(e) => setAtrasadas(e.target.checked)} className="size-4" />Só atrasadas</label>
        <Button className="ml-auto" onClick={() => acao("ui.novo", { qual: "tarefa-projeto" })} variant={sis.ui.novo === "tarefa-projeto" ? "outline" : "default"} disabled={!ativos.length}>{sis.ui.novo === "tarefa-projeto" ? "Fechar" : "Nova tarefa"}</Button>
      </div>
      {sis.ui.novo === "tarefa-projeto" && <FormTarefa projetos={ativos} projetoInicial={projeto} />}
      <QuadroTarefas itens={lista} mostrarProjeto />
    </>
  );
}

export function TarefasDoProjeto({ p }: { p: pj.Projeto }) {
  const { sis, acao } = useSistema();
  return (
    <>
      <div className="flex justify-end"><Button size="sm" onClick={() => acao("ui.novo", { qual: "tarefa-projeto" })} variant={sis.ui.novo === "tarefa-projeto" ? "outline" : "default"}><PlusIcon />{sis.ui.novo === "tarefa-projeto" ? "Fechar" : "Nova tarefa"}</Button></div>
      {sis.ui.novo === "tarefa-projeto" && <FormTarefa projetos={[p]} projetoInicial={p.id} />}
      <QuadroTarefas itens={p.tarefas.map((t) => ({ p, t }))} />
    </>
  );
}

function FormTarefa({ projetos, projetoInicial, t, aoFechar }: { projetos: pj.Projeto[]; projetoInicial?: string; t?: { p: pj.Projeto; t: px.TarefaProjeto }; aoFechar?: () => void }) {
  const { sis, acao } = useSistema();
  const enviar = useEnviar();
  const [pid, setPid] = React.useState(t?.p.id ?? (projetoInicial && projetos.some((x) => x.id === projetoInicial) ? projetoInicial : projetos[0]?.id ?? ""));
  const p = projetos.find((x) => x.id === pid) ?? t?.p;
  if (!p) return null;
  return (
    <Card className="p-4">
      <h3 className="font-semibold">{t ? "Editar tarefa" : "Nova tarefa"}</h3>
      <form className={GRADE_FORM} onSubmit={(e) => { const r = enviar("tpj.salvar", { id: p.id, ...(t ? { tid: t.t.id } : {}) }, { limpar: !t })(e); if (r.ok) aoFechar?.(); }}>
        <Campo rotulo="Tarefa" className="col-span-full sm:col-span-2"><Input name="titulo" required maxLength={200} defaultValue={t?.t.titulo} placeholder="Ex.: Enviar estudo preliminar ao cliente" /></Campo>
        {!t && projetos.length > 1 && (
          <Campo rotulo="Projeto"><NativeSelect value={pid} onChange={(e) => setPid(e.target.value)}>{projetos.map((x) => <option key={x.id} value={x.id}>{x.codigo} · {x.nome}</option>)}</NativeSelect></Campo>
        )}
        <Campo rotulo="Fase"><NativeSelect name="fase" defaultValue={t?.t.fase ?? pj.faseAtual(p).fase?.codigo ?? ""}><option value="">(geral)</option>{p.fases.map((f) => <option key={f.codigo} value={f.codigo}>{f.codigo} · {nomeFase(f.codigo)}</option>)}</NativeSelect></Campo>
        <Campo rotulo="Responsável"><Input name="responsavel" maxLength={80} defaultValue={t?.t.responsavel ?? p.responsavel} list="pessoas-tarefa" /></Campo>
        <Campo rotulo="Prazo"><Input name="prazo" type="date" defaultValue={t?.t.prazo} /></Campo>
        <Campo rotulo="Prioridade"><NativeSelect name="prioridade" defaultValue={t?.t.prioridade ?? "Média"}>{px.PRIORIDADES_TAREFA.map((x) => <option key={x}>{x}</option>)}</NativeSelect></Campo>
        <Campo rotulo="Checklist (um item por linha)" className="col-span-full sm:col-span-2"><Textarea name="checklist" rows={3} defaultValue={t?.t.checklist.map((c) => c.texto).join("\n")} placeholder={"Plantas assinadas\nRRT pago"} /></Campo>
        <Campo rotulo="Detalhes" className="col-span-full sm:col-span-2"><Textarea name="descricao" rows={2} maxLength={1000} defaultValue={t?.t.descricao} /></Campo>
        <Sugestoes id="pessoas-tarefa" valores={sis.cadastros.equipe.filter((m) => m.ativo).map((m) => m.nome)} />
        <div className="flex gap-2">
          <Button type="submit">{t ? "Salvar" : "Criar tarefa"}</Button>
          <Button type="button" variant="outline" onClick={() => (aoFechar ? aoFechar() : acao("ui.novo", { qual: "tarefa-projeto" }))}>Cancelar</Button>
        </div>
      </form>
    </Card>
  );
}

function QuadroTarefas({ itens, mostrarProjeto }: { itens: { p: pj.Projeto; t: px.TarefaProjeto }[]; mostrarProjeto?: boolean }) {
  const { sis, acao } = useSistema();
  const [aberta, setAberta] = React.useState("");
  const [editando, setEditando] = React.useState("");
  const ordem = (a: px.TarefaProjeto, b: px.TarefaProjeto) =>
    Number(px.tarefaAtrasada(b, sis.hoje)) - Number(px.tarefaAtrasada(a, sis.hoje)) || px.PRIORIDADES_TAREFA.indexOf(b.prioridade) - px.PRIORIDADES_TAREFA.indexOf(a.prioridade) || (a.prazo || "9999").localeCompare(b.prazo || "9999");
  if (!itens.length) return <Vazio>Nenhuma tarefa. Crie tarefas aqui ou use um template ao criar o projeto.</Vazio>;
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,250px),1fr))] items-start gap-3">
      {px.STATUS_TAREFA.map((st) => {
        const col = itens.filter(({ t }) => t.status === st).sort((a, b) => ordem(a.t, b.t));
        return (
          <section key={st} className="flex min-w-0 flex-col gap-2 rounded-lg border bg-muted p-2.5" aria-label={st}>
            <h3 className="flex items-center gap-2 border-b pb-2 text-[0.86rem] font-semibold">{st}<span className="font-mono text-xs font-normal text-muted-foreground">{col.length}</span></h3>
            {col.map(({ p, t }) => {
              if (editando === t.id) return <FormTarefa key={t.id} projetos={[p]} t={{ p, t }} aoFechar={() => setEditando("")} />;
              const atrasada = px.tarefaAtrasada(t, sis.hoje);
              const feitos = t.checklist.filter((c) => c.feito).length;
              const idx = px.STATUS_TAREFA.indexOf(t.status);
              return (
                <Card key={t.id} className={cn("gap-1.5 p-2.5", atrasada && "border-critico shadow-[inset_3px_0_0_var(--critico)]")}>
                  <button type="button" className="text-left" onClick={() => setAberta(aberta === t.id ? "" : t.id)} aria-expanded={aberta === t.id}>
                    <span className="block text-sm font-semibold">{t.titulo}</span>
                    <span className="block text-[0.74rem] text-muted-foreground">
                      {mostrarProjeto && `${p.codigo} · `}{t.fase ? `${t.fase} · ` : ""}{t.responsavel || "sem responsável"}
                      {t.prazo && <span className={cn(atrasada && "font-semibold text-critico")}> · {atrasada ? "venceu" : "até"} {dataBr(t.prazo)}</span>}
                    </span>
                  </button>
                  <span className="flex flex-wrap items-center gap-1.5">
                    {t.prioridade !== "Média" && <Pill texto={COR_PRIO[t.prioridade]} />}
                    {t.checklist.length > 0 && <span className="flex items-center gap-1.5 text-[0.72rem] text-muted-foreground"><Progress value={feitos / t.checklist.length} className="w-14" />{feitos}/{t.checklist.length}</span>}
                  </span>
                  {aberta === t.id && (
                    <div className="flex flex-col gap-1.5 border-t pt-1.5">
                      {t.checklist.map((c, k) => (
                        <label key={k} className="flex items-center gap-2 text-[0.82rem]">
                          <input type="checkbox" checked={c.feito} onChange={() => acao("tpj.item", { id: p.id, tid: t.id, indice: k })} className="size-4" />
                          <span className={cn(c.feito && "text-muted-foreground line-through")}>{c.texto}</span>
                        </label>
                      ))}
                      {t.descricao && <Nota className="whitespace-pre-line text-[0.78rem]">{t.descricao}</Nota>}
                      <div className="flex flex-wrap items-center gap-2">
                        <Button size="sm" variant="ghost" aria-label="Editar tarefa" onClick={() => setEditando(t.id)}><PencilIcon /></Button>
                        <BotaoExcluir acaoNome="tpj.remover" id={t.id} rotulo="Excluir" pergunta="Excluir?" />
                        {mostrarProjeto && <Button size="sm" variant="link" className="px-0 underline" onClick={() => acao("proj.abrir", { id: p.id })}>abrir projeto</Button>}
                      </div>
                    </div>
                  )}
                  <div className="flex gap-1">
                    {idx > 0 && <Button size="sm" variant="outline" className="h-7 px-2 text-[0.74rem]" onClick={() => acao("tpj.mover", { id: p.id, tid: t.id, status: px.STATUS_TAREFA[idx - 1] })}>← {px.STATUS_TAREFA[idx - 1]}</Button>}
                    {idx < px.STATUS_TAREFA.length - 1 && <Button size="sm" className="ml-auto h-7 px-2 text-[0.74rem]" onClick={() => acao("tpj.mover", { id: p.id, tid: t.id, status: px.STATUS_TAREFA[idx + 1] })}>{px.STATUS_TAREFA[idx + 1]} →</Button>}
                  </div>
                </Card>
              );
            })}
            {!col.length && <Nota className="px-1 text-[0.78rem]">—</Nota>}
          </section>
        );
      })}
    </div>
  );
}

// ================================================================ orçamento
export function TelaOrcamento({ projetoInicial }: { projetoInicial: string }) {
  const { p, seletor, vazio } = useProjetoEscolhido(projetoInicial);
  if (vazio || !p) return <SemProjetos />;
  return (
    <>
      <div className="flex flex-wrap items-center gap-2 print:hidden">{seletor}<Button variant="outline" size="sm" className="ml-auto" onClick={() => window.print()}><PrinterIcon />Imprimir</Button></div>
      <OrcamentoProjeto p={p} />
    </>
  );
}

export function OrcamentoProjeto({ p }: { p: pj.Projeto }) {
  const { sis, acao } = useSistema();
  const enviar = useEnviar();
  const r = px.resumoOrcamento(p);
  const [editarAmb, setEditarAmb] = React.useState(false);
  const [produto, setProduto] = React.useState("");
  const prod = sis.cadastros.produtos.find((x) => `${x.nome}${x.marca ? ` — ${x.marca}` : ""}` === produto || x.nome === produto);
  const ambientes = [...new Set([...p.ambientes, ...p.orcamento.map((i) => i.ambiente)])];
  return (
    <>
      <Indicadores
        itens={[
          { rotulo: "Total do orçamento", valor: moeda(r.total), sub: `${r.itens} item(ns)${p.area ? ` · ${moeda(r.por_m2)}/m²` : ""}` },
          { rotulo: "Aprovado pelo cliente", valor: moeda(r.aprovado), sub: r.total ? `${pct(r.aprovado / r.total)} do total` : "—", tom: "ok" },
          { rotulo: "Comprado / entregue", valor: moeda((r.porStatus.get("Comprado") ?? 0) + (r.porStatus.get("Entregue") ?? 0)) },
          { rotulo: "Sem preço", valor: String(r.sem_preco), sub: r.sem_preco ? "complete os preços" : "todos com preço", tom: r.sem_preco ? "atencao" : undefined },
        ]}
      />
      <Card className="gap-2 p-3.5 print:hidden">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-[0.9rem] font-semibold">Ambientes</h3>
          {!editarAmb && <span className="flex flex-wrap gap-1">{p.ambientes.map((a) => <span key={a} className="rounded-sm border px-1.5 text-[0.76rem]">{a}</span>)}{!p.ambientes.length && <span className="text-[0.8rem] text-muted-foreground">nenhum ainda</span>}</span>}
          <Button size="sm" variant="link" className="ml-auto px-0 underline" onClick={() => setEditarAmb((x) => !x)}>{editarAmb ? "Fechar" : "Editar ambientes"}</Button>
        </div>
        {editarAmb && (
          <form className="flex flex-col gap-2" onSubmit={(e) => { const res = enviar("orc.ambientes", { id: p.id })(e); if (res.ok) setEditarAmb(false); }}>
            <Textarea name="ambientes" rows={4} defaultValue={p.ambientes.join("\n")} placeholder={"Sala de estar\nCozinha\nSuíte master"} aria-label="Ambientes, um por linha" />
            <Button type="submit" size="sm" className="self-start">Salvar ambientes</Button>
          </form>
        )}
      </Card>
      <Card className="p-4 print:hidden">
        <h3 className="font-semibold">Incluir item</h3>
        <form className={GRADE_FORM} onSubmit={(e) => { const res = enviar("orc.item", { id: p.id, produto: prod?.id ?? "" }, { limpar: true })(e); if (res.ok) setProduto(""); }}>
          <Campo rotulo="Da biblioteca (opcional)" className="col-span-full sm:col-span-2">
            <Input value={produto} onChange={(e) => setProduto(e.target.value)} list="produtos-orc" placeholder={sis.cadastros.produtos.length ? "Buscar produto da biblioteca…" : "Biblioteca vazia — digite a descrição ao lado"} />
          </Campo>
          <Campo rotulo="Descrição"><Input name="descricao" maxLength={200} placeholder={prod?.nome ?? "Ex.: Porcelanato 90×90"} required={!prod} /></Campo>
          <Campo rotulo="Ambiente"><Input name="ambiente" maxLength={60} list="ambientes-orc" defaultValue={ambientes[0] ?? ""} placeholder="Geral" /></Campo>
          <Campo rotulo="Categoria"><NativeSelect name="categoria" key={prod?.id ?? "x"} defaultValue={prod?.categoria ?? "Revestimentos"}>{px.CATEGORIAS_PRODUTO.map((c) => <option key={c}>{c}</option>)}</NativeSelect></Campo>
          <Campo rotulo="Quantidade"><CampoNumero name="quantidade" texto="1" /></Campo>
          <Campo rotulo="Unidade"><Input name="unidade" maxLength={20} key={`u${prod?.id ?? ""}`} defaultValue={prod?.unidade ?? "un"} /></Campo>
          <Campo rotulo="Preço unitário (R$)"><CampoNumero name="preco" key={`p${prod?.id ?? ""}`} texto={prod?.preco ? valorBr(prod.preco) : ""} placeholder="0,00" /></Campo>
          <Button type="submit"><PlusIcon />Incluir</Button>
          <Sugestoes id="produtos-orc" valores={sis.cadastros.produtos.map((x) => `${x.nome}${x.marca ? ` — ${x.marca}` : ""}`)} />
          <Sugestoes id="ambientes-orc" valores={ambientes} />
        </form>
      </Card>
      {p.orcamento.length ? (
        <Card className="gap-0 overflow-hidden p-0">
          {ambientes.filter((a) => p.orcamento.some((i) => i.ambiente === a)).map((a) => (
            <section key={a} className="border-b last:border-b-0">
              <h4 className="flex items-center justify-between bg-muted px-4 py-2 text-[0.86rem] font-semibold">{a}<span className="font-mono">{moeda(r.porAmbiente.get(a) ?? 0)}</span></h4>
              <ul className="divide-y">
                {p.orcamento.filter((i) => i.ambiente === a).map((i) => (
                  <li key={i.id} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-2 text-[0.82rem]">
                    <span className="min-w-0 flex-1 basis-full sm:basis-56">
                      <span className="font-medium">{i.descricao}</span>
                      <span className="block text-[0.72rem] text-muted-foreground">{i.categoria}{i.fornecedor && ` · ${i.fornecedor}`}{i.link && <> · <a className="underline" href={i.link} target="_blank" rel="noopener noreferrer">ver produto</a></>}</span>
                    </span>
                    <span className="font-mono">{num(i.quantidade)} {i.unidade} × <span className={cn(!i.preco && "font-semibold text-atencao")}>{i.preco ? moeda(i.preco) : "sem preço"}</span></span>
                    <span className="ml-auto font-mono font-semibold sm:ml-0 sm:w-28 sm:text-right">{moeda(px.totalItem(i))}</span>
                    <NativeSelect aria-label={`Situação de ${i.descricao}`} value={i.status} onChange={(e) => acao("orc.status", { id: p.id, iid: i.id, status: e.target.value })} className="h-8 w-auto text-[0.78rem] print:hidden">{px.STATUS_ITEM.map((x) => <option key={x}>{x}</option>)}</NativeSelect>
                    <span className="print:hidden"><BotaoExcluir acaoNome="orc.remover" id={i.id} rotulo="Excluir" pergunta="Excluir?" /></span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3">
            <span className="text-sm font-bold">Total</span><span className="font-mono text-base font-bold">{moeda(r.total)}</span>
          </div>
        </Card>
      ) : <Vazio>Nenhum item. Inclua os itens por ambiente: da biblioteca de produtos ou digitando.</Vazio>}
      {r.porCategoria.size > 0 && (
        <Card className="gap-3 p-4">
          <h3 className="text-[0.9rem] font-semibold">Por categoria</h3>
          <Barras formatar={moeda} linhas={[...r.porCategoria.entries()].sort((a, b) => b[1] - a[1]).map(([c, v]) => ({ rotulo: c, valor: v, extra: r.total ? pct(v / r.total) : "" }))} />
        </Card>
      )}
    </>
  );
}

// ================================================================ extensão de captura (atalho de favoritos)
const CHAVE_CAPTURA = "canteiro-digital:captura";
/** Endereço do sistema para a captura voltar direto (no artefato da Claude não há endereço próprio: usa a área de transferência). */
function enderecoApp(): string {
  if (typeof window === "undefined") return "";
  if ((window as unknown as { claude?: unknown }).claude) return "";
  return /^https?:/.test(location.protocol) ? location.href.split("#")[0] : "";
}

export function lerCapturaPendente(): string {
  try { const v = sessionStorage.getItem(CHAVE_CAPTURA) ?? ""; sessionStorage.removeItem(CHAVE_CAPTURA); return v; } catch { return ""; }
}
export function guardarCapturaPendente(v: string) {
  try { sessionStorage.setItem(CHAVE_CAPTURA, v); } catch { /* sem armazenamento: o usuário cola manualmente */ }
}

export function TelaCaptura() {
  const { sis, acao } = useSistema();
  const enviar = useEnviar();
  const ref = React.useRef<HTMLAnchorElement>(null);
  const app = enderecoApp();
  const codigo = px.codigoCaptura(app);
  const [texto, setTexto] = React.useState(() => lerCapturaPendente());
  const [captura, setCaptura] = React.useState<px.Captura | null>(null);
  const [erro, setErro] = React.useState("");
  const [copiado, setCopiado] = React.useState(false);
  // React bloqueia href "javascript:" em JSX; o atalho precisa dele, então é definido direto no elemento
  React.useEffect(() => { ref.current?.setAttribute("href", codigo); }, [codigo]);
  const ler = (t = texto) => {
    setErro("");
    try { setCaptura(px.lerCaptura(t)); } catch (e) { setCaptura(null); setErro(e instanceof Error ? e.message : "Captura inválida"); }
  };
  React.useEffect(() => {
    if (texto) ler(texto);
    // captura que chega com a tela já aberta (outra aba do favorito apontando para esta)
    const chegou = () => { const v = lerCapturaPendente(); if (v) { setTexto(v); ler(v); } };
    window.addEventListener("canteiro:captura", chegou);
    return () => window.removeEventListener("canteiro:captura", chegou);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const colar = async () => {
    try { const t = await navigator.clipboard.readText(); setTexto(t); ler(t); } catch { setErro("O navegador não liberou a área de transferência: cole com Ctrl+V no campo abaixo."); }
  };
  return (
    <>
      <Card className="gap-3 p-4">
        <h3 className="flex items-center gap-2 font-semibold"><BookmarkPlusIcon className="size-5" />Capture produtos de qualquer loja</h3>
        <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-[0.88rem]">
          <li>Arraste o botão abaixo para a <b>barra de favoritos</b> do navegador (no computador: Ctrl+Shift+B mostra a barra).</li>
          <li>Abra a página do produto na loja (Leroy Merlin, Telha Norte, Tok&Stok, Deca, Portobello…).</li>
          <li>Clique no favorito <b>“Capturar p/ Canteiro”</b>. Ele lê nome, foto, preço, marca e código da página{app ? " e abre o sistema já com o produto preenchido" : ", copia para a área de transferência, e você cola aqui"}.</li>
        </ol>
        <div className="flex flex-wrap items-center gap-2">
          <a ref={ref} draggable onClick={(e) => e.preventDefault()} className="inline-flex items-center gap-2 rounded-md border-2 border-dashed border-foreground bg-sinal px-4 py-2 font-semibold text-sinal-foreground" title="Arraste para a barra de favoritos">
            <BookmarkPlusIcon className="size-4" />Capturar p/ Canteiro
          </a>
          <Button variant="outline" size="sm" onClick={() => { navigator.clipboard?.writeText(codigo).then(() => setCopiado(true), () => setCopiado(false)); }}><CopyIcon />{copiado ? "Código copiado" : "Copiar código do favorito"}</Button>
        </div>
        <Nota className="text-[0.76rem]">
          No celular, crie um favorito qualquer e troque o endereço pelo código copiado. A captura só lê informações públicas da página (o mesmo que aparece ao compartilhar o link) e não envia nada para outros sites. Algumas lojas escondem o preço; nesse caso, preencha à mão.
        </Nota>
      </Card>
      <Card className="gap-3 p-4">
        <h3 className="font-semibold">Receber captura</h3>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={colar}><ClipboardPasteIcon />Colar da área de transferência</Button>
        </div>
        <Textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={3} placeholder='Cole aqui o conteúdo capturado ({"nome": …}) ou só o link do produto (https://…)' aria-label="Conteúdo capturado" className="font-mono text-[0.78rem]" />
        <Button className="self-start" onClick={() => ler()} disabled={!texto.trim()}>Ler captura</Button>
        {erro && <p role="alert" className="text-sm font-medium text-critico">{erro}</p>}
        {captura && (
          <form className="flex flex-col gap-3 rounded-md border border-dashed p-3" onSubmit={(e) => { const r = enviar("prd.salvar", { origem: "Captura" })(e); if (r.ok) { setTexto(""); setCaptura(null); acao("ui.sub", { sub: "biblioteca" }); } }}>
            <div className="flex flex-wrap items-start gap-3">
              <Miniatura src={captura.imagem} alt={captura.nome} grande />
              <div className={cn(GRADE_FORM, "min-w-0 flex-1")}>
                <Campo rotulo="Nome" className="col-span-full"><Input name="nome" required defaultValue={captura.nome} maxLength={200} /></Campo>
                <Campo rotulo="Categoria"><NativeSelect name="categoria" defaultValue="Outro">{px.CATEGORIAS_PRODUTO.map((c) => <option key={c}>{c}</option>)}</NativeSelect></Campo>
                <Campo rotulo="Preço (R$)"><CampoNumero name="preco" texto={captura.preco ? valorBr(captura.preco) : ""} placeholder="0,00" /></Campo>
                <Campo rotulo="Marca"><Input name="marca" defaultValue={captura.marca} maxLength={80} /></Campo>
                <Campo rotulo="Loja / fornecedor"><Input name="fornecedor" defaultValue={captura.fornecedor} maxLength={120} /></Campo>
                <Campo rotulo="Código / SKU"><Input name="codigo" defaultValue={captura.codigo} maxLength={60} /></Campo>
                <Campo rotulo="Unidade"><Input name="unidade" defaultValue="un" maxLength={20} /></Campo>
                <input type="hidden" name="link" value={captura.link} />
                <input type="hidden" name="imagem" value={captura.imagem} />
              </div>
            </div>
            {captura.link && <a className="text-[0.8rem] underline" href={captura.link} target="_blank" rel="noopener noreferrer">{captura.link}</a>}
            <Button type="submit" className="self-start"><CheckIcon />Salvar na biblioteca</Button>
          </form>
        )}
        <Nota className="text-[0.76rem]">Capturados: {sis.cadastros.produtos.filter((x) => x.origem === "Captura").length} produto(s) na biblioteca.</Nota>
      </Card>
    </>
  );
}

function Miniatura({ src, alt, grande }: { src: string; alt: string; grande?: boolean }) {
  const [erro, setErro] = React.useState(false);
  const cls = grande ? "size-28" : "size-16";
  if (!src || erro) return <span className={cn("grid shrink-0 place-items-center rounded-md border bg-muted text-muted-foreground", cls)} aria-hidden><ImageOffIcon className="size-5" /></span>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} loading="lazy" referrerPolicy="no-referrer" onError={() => setErro(true)} className={cn("shrink-0 rounded-md border bg-white object-contain", cls)} />;
}

// ================================================================ biblioteca de produtos
export function TelaBiblioteca() {
  const { sis, acao } = useSistema();
  const g = sis.cadastros;
  const [busca, setBusca] = React.useState("");
  const [cat, setCat] = React.useState("");
  const [usando, setUsando] = React.useState("");
  const lista = g.produtos.filter((x) => (!cat || x.categoria === cat) && casa(busca, x.nome, x.marca, x.fornecedor, x.codigo, x.ambientes, x.acabamento)).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  const usos = (id: string) => g.projetos.reduce((s, p) => s + p.orcamento.filter((i) => i.produto === id).length, 0);
  return (
    <>
      <Card className="flex-row flex-wrap items-center justify-between gap-2.5 p-3 md:p-4">
        <Nota className="min-w-0 flex-1 basis-72">Produtos especificados pelo escritório (revestimentos, louças, iluminação, mobiliário…), com foto, preço e link. Use nos orçamentos dos projetos ou capture direto das lojas.</Nota>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => acao("ui.sub", { sub: "captura" })}><BookmarkPlusIcon />Capturar de uma loja</Button>
          <Button onClick={() => acao("ui.novo", { qual: "produto" })} variant={sis.ui.novo === "produto" ? "outline" : "default"}>{sis.ui.novo === "produto" ? "Fechar" : "Novo produto"}</Button>
        </div>
      </Card>
      {sis.ui.novo === "produto" && <FormProduto />}
      <div className="flex flex-wrap items-center gap-2">
        <Busca valor={busca} aoMudar={setBusca} placeholder="Buscar produto, marca, loja…" />
        <NativeSelect aria-label="Categoria" value={cat} onChange={(e) => setCat(e.target.value)} className="w-auto"><option value="">Todas as categorias</option>{px.CATEGORIAS_PRODUTO.map((c) => <option key={c}>{c} ({g.produtos.filter((x) => x.categoria === c).length})</option>)}</NativeSelect>
        <span className="font-mono text-xs text-muted-foreground">{lista.length} de {g.produtos.length}</span>
      </div>
      {lista.length ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,300px),1fr))] items-start gap-2.5">
          {lista.map((x) => sis.ui.editando === x.id ? <FormProduto key={x.id} x={x} className="col-span-full" /> : (
            <Card key={x.id} className="gap-2 p-3">
              <div className="flex gap-3">
                <Miniatura src={x.imagem} alt={x.nome} />
                <div className="min-w-0 flex-1">
                  <h3 className="break-words text-sm font-semibold">{x.nome}</h3>
                  <p className="text-[0.76rem] text-muted-foreground">{[x.categoria, x.marca, x.codigo].filter(Boolean).join(" · ")}</p>
                  <p className="font-mono text-sm">{x.preco ? `${moeda(x.preco)}/${x.unidade}` : "sem preço"}</p>
                  <p className="text-[0.74rem] text-muted-foreground">{[x.fornecedor, x.acabamento, x.dimensoes].filter(Boolean).join(" · ")}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-[0.78rem]">
                {x.origem === "Captura" && <span className="rounded-sm border px-1 text-[0.7rem]">capturado</span>}
                {usos(x.id) > 0 && <span className="text-muted-foreground">em {usos(x.id)} orçamento(s)</span>}
                {x.link && <a className="inline-flex items-center gap-1 underline" href={x.link} target="_blank" rel="noopener noreferrer"><ExternalLinkIcon className="size-3.5" />loja</a>}
              </div>
              {usando === x.id ? <UsarEmOrcamento produto={x} aoFechar={() => setUsando("")} /> : (
                <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm" onClick={() => setUsando(x.id)} disabled={!g.projetos.some(pj.projetoAtivo)}><PlusIcon />Usar em orçamento</Button>
                  <Button size="sm" variant="ghost" aria-label={`Editar ${x.nome}`} onClick={() => acao("ui.editar", { id: x.id })}><PencilIcon /></Button>
                  {usos(x.id) > 0 && <Button size="sm" variant="link" className="px-0 underline" onClick={() => acao("prd.precos", { id: x.id })}>atualizar preço nos orçamentos</Button>}
                  <BotaoExcluir acaoNome="prd.remover" id={x.id} rotulo="×" pergunta="Excluir?" />
                </div>
              )}
            </Card>
          ))}
        </div>
      ) : <Vazio>{g.produtos.length ? "Nenhum produto com esse filtro." : "Biblioteca vazia. Cadastre os produtos que o escritório costuma especificar ou capture das lojas."}</Vazio>}
    </>
  );
}

function UsarEmOrcamento({ produto, aoFechar }: { produto: px.Produto; aoFechar: () => void }) {
  const { sis } = useSistema();
  const enviar = useEnviar();
  const ativos = sis.cadastros.projetos.filter(pj.projetoAtivo);
  const [pid, setPid] = React.useState(ativos[0]?.id ?? "");
  const p = ativos.find((x) => x.id === pid);
  return (
    <form className="flex flex-wrap items-end gap-2 border-t pt-2" onSubmit={(e) => { const r = enviar("orc.item", { id: pid, produto: produto.id })(e); if (r.ok) aoFechar(); }}>
      <Campo rotulo="Projeto"><NativeSelect value={pid} onChange={(e) => setPid(e.target.value)} className="max-w-48">{ativos.map((x) => <option key={x.id} value={x.id}>{x.codigo} · {x.nome}</option>)}</NativeSelect></Campo>
      <Campo rotulo="Ambiente"><Input name="ambiente" list={`amb-${produto.id}`} defaultValue={p?.ambientes[0] ?? ""} className="w-36" placeholder="Geral" /></Campo>
      <Campo rotulo="Qtd"><CampoNumero name="quantidade" texto="1" className="w-16" /></Campo>
      <Sugestoes id={`amb-${produto.id}`} valores={p?.ambientes ?? []} />
      <Button type="submit" size="sm">Incluir</Button>
      <Button type="button" size="sm" variant="outline" onClick={aoFechar}>×</Button>
    </form>
  );
}

function FormProduto({ x, className }: { x?: px.Produto; className?: string }) {
  const { acao } = useSistema();
  const enviar = useEnviar();
  return (
    <Card className={cn("p-4", className)}>
      <h3 className="font-semibold">{x ? `Editar ${x.nome}` : "Novo produto"}</h3>
      <form className={GRADE_FORM} onSubmit={enviar("prd.salvar", x ? { id: x.id } : {}, { limpar: !x })}>
        <Campo rotulo="Produto" className="col-span-full sm:col-span-2"><Input name="nome" required maxLength={200} defaultValue={x?.nome} placeholder="Ex.: Porcelanato Calacatta 120×120 polido" /></Campo>
        <Campo rotulo="Categoria"><NativeSelect name="categoria" defaultValue={x?.categoria ?? "Revestimentos"}>{px.CATEGORIAS_PRODUTO.map((c) => <option key={c}>{c}</option>)}</NativeSelect></Campo>
        <Campo rotulo="Marca"><Input name="marca" maxLength={80} defaultValue={x?.marca} /></Campo>
        <Campo rotulo="Código / referência"><Input name="codigo" maxLength={60} defaultValue={x?.codigo} /></Campo>
        <Campo rotulo="Fornecedor / loja"><Input name="fornecedor" maxLength={120} defaultValue={x?.fornecedor} /></Campo>
        <Campo rotulo="Preço (R$)"><CampoNumero name="preco" texto={x?.preco ? valorBr(x.preco) : ""} placeholder="0,00" /></Campo>
        <Campo rotulo="Unidade"><Input name="unidade" maxLength={20} defaultValue={x?.unidade ?? "un"} list="un-prod" /></Campo>
        <Campo rotulo="Dimensões"><Input name="dimensoes" maxLength={80} defaultValue={x?.dimensoes} placeholder="Ex.: 120×120 cm" /></Campo>
        <Campo rotulo="Acabamento / cor"><Input name="acabamento" maxLength={120} defaultValue={x?.acabamento} /></Campo>
        <Campo rotulo="Ambientes de uso"><Input name="ambientes" maxLength={200} defaultValue={x?.ambientes} placeholder="Ex.: banheiros, áreas molhadas" /></Campo>
        <Campo rotulo="Link do produto" className="col-span-full sm:col-span-2"><Input name="link" type="url" maxLength={600} defaultValue={x?.link} placeholder="https://…" /></Campo>
        <Campo rotulo="Imagem (link)"><Input name="imagem" type="url" maxLength={600} defaultValue={x?.imagem} placeholder="https://…jpg" /></Campo>
        <Campo rotulo="Observação" className="col-span-full"><Input name="observacao" maxLength={500} defaultValue={x?.observacao} /></Campo>
        <Sugestoes id="un-prod" valores={["un", "m²", "m", "cx", "pç", "jg", "kg", "l", "vb"]} />
        <div className="flex gap-2">
          <Button type="submit">{x ? "Salvar" : "Incluir na biblioteca"}</Button>
          <Button type="button" variant="outline" onClick={() => (x ? acao("ui.editar", { id: x.id }) : acao("ui.novo", { qual: "produto" }))}>Cancelar</Button>
        </div>
      </form>
    </Card>
  );
}

// ================================================================ templates
export function TelaTemplates() {
  const { sis, acao } = useSistema();
  const g = sis.cadastros;
  const usos = (id: string) => g.projetos.filter((p) => p.template === id).length;
  return (
    <>
      <Card className="flex-row flex-wrap items-center justify-between gap-2.5 p-3 md:p-4">
        <Nota className="min-w-0 flex-1 basis-72">Templates padronizam projetos: fases e pesos dos honorários, tarefas por fase, ambientes do orçamento e revisões incluídas. Escolha um ao criar o projeto, ou salve um projeto pronto como template.</Nota>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => acao("tpl.restaurar")}>Restaurar padrões</Button>
          <Button onClick={() => acao("ui.novo", { qual: "template" })} variant={sis.ui.novo === "template" ? "outline" : "default"}>{sis.ui.novo === "template" ? "Fechar" : "Novo template"}</Button>
        </div>
      </Card>
      {sis.ui.novo === "template" && <FormTemplate />}
      {g.templates.length ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,340px),1fr))] items-start gap-2.5">
          {g.templates.map((t) => sis.ui.editando === t.id ? <FormTemplate key={t.id} t={t} className="col-span-full" /> : (
            <Card key={t.id} className="gap-2 p-3.5">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold">{t.nome}</h3>
                  <p className="text-[0.78rem] text-muted-foreground">{t.descricao}</p>
                </div>
                {t.padrao_sistema && <span className="shrink-0 rounded-sm border px-1 text-[0.7rem]">padrão</span>}
              </div>
              <p className="text-[0.78rem]">{[t.tipo_obra, t.padrao].filter(Boolean).join(" · ")}</p>
              <div className="flex flex-wrap gap-1">
                {Object.entries(t.pesos).map(([c, v]) => <span key={c} className="rounded-sm bg-muted px-1.5 font-mono text-[0.72rem]" title={nomeFase(c)}>{c} {num(v)}%</span>)}
              </div>
              <p className="text-[0.76rem] text-muted-foreground">{t.tarefas.length} tarefa(s) · {t.ambientes.length} ambiente(s){t.revisoes !== null ? ` · ${t.revisoes} revisões` : ""}{usos(t.id) ? ` · usado em ${usos(t.id)} projeto(s)` : ""}</p>
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" onClick={() => { acao("ui.sub", { sub: "projetos" }); acao("ui.novo", { qual: `projeto:${t.id}` }); }}><PlusIcon />Novo projeto com este template</Button>
                <Button size="sm" variant="ghost" aria-label={`Editar ${t.nome}`} onClick={() => acao("ui.editar", { id: t.id })}><PencilIcon /></Button>
                <BotaoExcluir acaoNome="tpl.remover" id={t.id} rotulo="×" pergunta="Excluir?" />
              </div>
            </Card>
          ))}
        </div>
      ) : <Vazio>Nenhum template. Use “Restaurar padrões” ou crie o seu.</Vazio>}
    </>
  );
}

function FormTemplate({ t, className }: { t?: px.Template; className?: string }) {
  const { acao } = useSistema();
  const enviar = useEnviar();
  const [pesos, setPesos] = React.useState<Record<string, string>>(() => Object.fromEntries(pj.FASES.map((f) => [f.codigo, t?.pesos[f.codigo] !== undefined ? num(t.pesos[f.codigo]) : ""])));
  const soma = Object.values(pesos).reduce((s, v) => s + (Number(v.replace(",", ".")) || 0), 0);
  const algum = Object.values(pesos).some((v) => v.trim());
  return (
    <Card className={cn("p-4", className)}>
      <h3 className="font-semibold">{t ? `Editar ${t.nome}` : "Novo template"}</h3>
      <form className="flex flex-col gap-3" onSubmit={enviar("tpl.salvar", t ? { id: t.id } : {}, { limpar: !t })}>
        <div className={GRADE_FORM}>
          <Campo rotulo="Nome" className="col-span-full sm:col-span-2"><Input name="nome" required maxLength={120} defaultValue={t?.nome} /></Campo>
          <Campo rotulo="Tipo de obra"><NativeSelect name="tipo_obra" defaultValue={t?.tipo_obra ?? "Residência unifamiliar"}>{pj.CATEGORIAS.map((c) => <optgroup key={c} label={c}>{pj.CATEGORIAS_OBRA[c].map((x) => <option key={x}>{x}</option>)}</optgroup>)}</NativeSelect></Campo>
          <Campo rotulo="Padrão"><NativeSelect name="padrao" defaultValue={t?.padrao ?? "Alto padrão"}>{pj.PADROES_PROJETO.map((x) => <option key={x}>{x}</option>)}</NativeSelect></Campo>
          <Campo rotulo="Revisões incluídas"><Input name="revisoes" type="number" min={0} max={20} defaultValue={t?.revisoes ?? ""} placeholder="das regras" /></Campo>
          <Campo rotulo="Descrição" className="col-span-full"><Input name="descricao" maxLength={300} defaultValue={t?.descricao} /></Campo>
        </div>
        <fieldset className="flex flex-col gap-1.5">
          <legend className="text-xs font-medium text-muted-foreground">Fases e pesos dos honorários (%) — deixe em branco as fases que não entram</legend>
          <div className="flex flex-wrap gap-2">
            {pj.FASES.map((f) => (
              <label key={f.codigo} className="flex flex-col items-center gap-0.5 text-[0.74rem]" title={f.nome}>
                {f.codigo}
                <Input name={`peso_${f.codigo}`} inputMode="decimal" value={pesos[f.codigo]} onChange={(e) => setPesos((x) => ({ ...x, [f.codigo]: e.target.value }))} className="h-8 w-14 text-center font-mono" aria-label={`Peso de ${f.nome}`} />
              </label>
            ))}
          </div>
          <span className={cn("text-[0.8rem]", algum && Math.abs(soma - 100) > 0.01 ? "font-semibold text-critico" : "text-muted-foreground")}>soma {num(Math.round(soma * 100) / 100)}%{algum && Math.abs(soma - 100) > 0.01 ? " — precisa fechar 100%" : ""}</span>
        </fieldset>
        <div className="grid gap-3 md:grid-cols-2">
          <Campo rotulo="Tarefas (uma por linha; “EP: título” para ligar à fase)"><Textarea name="tarefas" rows={6} defaultValue={t?.tarefas.map((x) => (x.fase ? `${x.fase}: ${x.titulo}` : x.titulo)).join("\n")} placeholder={"LV: Visita técnica\nEP: Apresentar estudo preliminar"} className="font-mono text-[0.8rem]" /></Campo>
          <Campo rotulo="Ambientes do orçamento (um por linha)"><Textarea name="ambientes" rows={6} defaultValue={t?.ambientes.join("\n")} placeholder={"Sala de estar\nCozinha"} /></Campo>
        </div>
        <div className="flex gap-2">
          <Button type="submit" disabled={algum && Math.abs(soma - 100) > 0.01}>{t ? "Salvar" : "Criar template"}</Button>
          <Button type="button" variant="outline" onClick={() => (t ? acao("ui.editar", { id: t.id }) : acao("ui.novo", { qual: "template" }))}>Cancelar</Button>
        </div>
      </form>
    </Card>
  );
}

// ================================================================ arquivos
export function TelaArquivos({ projetoInicial }: { projetoInicial: string }) {
  const { p, seletor, vazio } = useProjetoEscolhido(projetoInicial);
  if (vazio || !p) return <SemProjetos />;
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">{seletor}</div>
      <ArquivosProjeto p={p} />
    </>
  );
}

export function ArquivosProjeto({ p }: { p: pj.Projeto }) {
  const { sis } = useSistema();
  const enviar = useEnviar();
  const [busca, setBusca] = React.useState("");
  const [pasta, setPasta] = React.useState("");
  const lista = p.arquivos.filter((a) => (!pasta || a.pasta === pasta) && casa(busca, a.nome, a.disciplina, a.observacao, a.autor));
  return (
    <>
      <Card className="p-4">
        <h3 className="font-semibold">Adicionar arquivo</h3>
        <form className={GRADE_FORM} onSubmit={enviar("arq.salvar", { id: p.id }, { limpar: true })}>
          <Campo rotulo="Nome" className="col-span-full sm:col-span-2"><Input name="nome" required maxLength={200} placeholder="Ex.: Planta baixa — térreo" /></Campo>
          <Campo rotulo="Pasta"><NativeSelect name="pasta" defaultValue="Projeto executivo">{px.PASTAS.map((x) => <option key={x}>{x}</option>)}</NativeSelect></Campo>
          <Campo rotulo="Fase"><NativeSelect name="fase" defaultValue={pj.faseAtual(p).fase?.codigo ?? ""}><option value="">(geral)</option>{p.fases.map((f) => <option key={f.codigo} value={f.codigo}>{f.codigo}</option>)}</NativeSelect></Campo>
          <Campo rotulo="Disciplina"><NativeSelect name="disciplina" defaultValue="Arquitetura">{pj.DISCIPLINAS.map((x) => <option key={x}>{x}</option>)}</NativeSelect></Campo>
          <Campo rotulo="Link (Drive, Dropbox, OneDrive…)" className="col-span-full sm:col-span-2"><Input name="link" type="url" required maxLength={600} placeholder="https://drive.google.com/…" /></Campo>
          <Campo rotulo="Revisão"><Input name="revisao" type="number" min={0} max={99} placeholder="automática" /></Campo>
          <Campo rotulo="Autor"><Input name="autor" maxLength={80} list="pessoas-arq" /></Campo>
          <Button type="submit"><PlusIcon />Adicionar</Button>
          <Sugestoes id="pessoas-arq" valores={sis.cadastros.equipe.map((m) => m.nome)} />
        </form>
        <Nota className="mt-2 text-[0.76rem]">Os arquivos ficam no seu armazenamento em nuvem; aqui o escritório organiza por pasta, fase e revisão e abre com um clique. Mesmo nome na mesma pasta vira a revisão seguinte automaticamente.</Nota>
      </Card>
      <div className="flex flex-wrap items-center gap-2">
        <Busca valor={busca} aoMudar={setBusca} placeholder="Buscar arquivo…" />
        <NativeSelect aria-label="Pasta" value={pasta} onChange={(e) => setPasta(e.target.value)} className="w-auto"><option value="">Todas as pastas</option>{px.PASTAS.map((x) => <option key={x}>{x} ({p.arquivos.filter((a) => a.pasta === x).length})</option>)}</NativeSelect>
      </div>
      {lista.length ? (
        <Card className="gap-0 overflow-hidden p-0">
          {px.PASTAS.filter((x) => lista.some((a) => a.pasta === x)).map((x) => (
            <section key={x} className="border-b last:border-b-0">
              <h4 className="bg-muted px-4 py-2 text-[0.86rem] font-semibold">{x}</h4>
              <ul className="divide-y">
                {lista.filter((a) => a.pasta === x).sort((a, b) => a.nome.localeCompare(b.nome) || b.revisao - a.revisao).map((a) => {
                  const ultima = !p.arquivos.some((y) => y !== a && y.pasta === a.pasta && y.nome.toLowerCase() === a.nome.toLowerCase() && y.revisao > a.revisao);
                  return (
                    <li key={a.id} className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2", !ultima && "bg-muted/40")}>
                      <span className="w-20 shrink-0 rounded-sm border px-1 text-center text-[0.7rem] font-semibold">{px.tipoArquivo(a)}</span>
                      <span className="min-w-0 flex-1 basis-48 text-sm">
                        <a className="font-medium hover:underline" href={a.link} target="_blank" rel="noopener noreferrer">{a.nome}</a> <span className="font-mono text-[0.76rem]">{rev(a.revisao)}</span>{!ultima && <span className="text-[0.72rem]"> · substituída</span>}
                        <span className="block text-[0.74rem] text-muted-foreground">{[a.fase, a.disciplina, a.autor, dataBr(a.data)].filter(Boolean).join(" · ")}</span>
                      </span>
                      <a className="inline-flex items-center gap-1 text-[0.8rem] underline" href={a.link} target="_blank" rel="noopener noreferrer"><ExternalLinkIcon className="size-3.5" />abrir</a>
                      <BotaoExcluir acaoNome="arq.remover" id={a.id} rotulo="×" pergunta="Remover?" />
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </Card>
      ) : <Vazio>{p.arquivos.length ? "Nenhum arquivo com esse filtro." : "Nenhum arquivo ainda."}</Vazio>}
    </>
  );
}

// ================================================================ financeiro do projeto (consolidado)
export function TelaFinanceiro() {
  const { sis, acao } = useSistema();
  const g = sis.cadastros;
  const [todos, setTodos] = React.useState(false);
  const projetos = g.projetos.filter((p) => p.status !== "Cancelado" && (todos || pj.projetoAtivo(p) || pj.resultado(p, sis.hoje).a_receber > 0));
  const rs = projetos.map((p) => ({ p, r: pj.resultado(p, sis.hoje) }));
  const soma = (k: keyof pj.Resultado) => rs.reduce((s, x) => s + ((x.r[k] as number) || 0), 0);
  const fluxo = px.fluxoCaixa(g, sis.hoje);
  const mesAtual = sis.hoje.slice(0, 7);
  const maior = Math.max(1, ...fluxo.map((f) => Math.max(f.recebido + f.previsto, f.despesas + f.horas)));
  const aPagar = g.projetos.flatMap((p) => p.despesas.filter((d) => !d.pago).map((d) => ({ p, d })));
  if (!g.projetos.length) return <SemProjetos />;
  return (
    <>
      <Indicadores
        itens={[
          { rotulo: "Receita contratada", valor: moeda(soma("contratado")), sub: `${projetos.length} projeto(s)` },
          { rotulo: "Recebido", valor: moeda(soma("recebido")), tom: "ok" },
          { rotulo: "A receber", valor: moeda(soma("a_receber")), sub: soma("atrasado") ? `${moeda(soma("atrasado"))} em atraso` : "nada em atraso", tom: soma("atrasado") ? "critico" : undefined },
          { rotulo: "Despesas", valor: moeda(soma("despesas")), sub: aPagar.length ? `${moeda(aPagar.reduce((s, x) => s + x.d.valor, 0))} a pagar` : "todas pagas" },
          { rotulo: "Custo das horas", valor: moeda(soma("custo_horas")) },
          { rotulo: "Resultado realizado", valor: moeda(soma("recebido") - soma("despesas") - soma("custo_horas")), sub: "recebido − despesas − horas", tom: soma("recebido") - soma("despesas") - soma("custo_horas") < 0 ? "critico" : "ok" },
        ]}
      />
      <Card className="gap-3 p-4">
        <h3 className="text-[0.92rem] font-semibold">Fluxo de caixa mensal</h3>
        <div className="overflow-x-auto" aria-hidden><div className="flex h-40 min-w-[560px] items-end gap-1.5">
          {fluxo.map((f) => (
            <div key={f.mes} className={cn("flex h-full flex-1 flex-col justify-end gap-0.5", f.mes === mesAtual && "rounded-sm bg-sinal-suave")}>
              <div className="flex flex-1 items-end justify-center gap-0.5">
                <span className="w-1/3 rounded-t-sm bg-ok" style={{ height: `${((f.recebido + f.previsto) / maior) * 100}%`, opacity: f.recebido ? 1 : 0.45 }} title={`Entradas ${moeda(f.recebido + f.previsto)}`} />
                <span className="w-1/3 rounded-t-sm bg-critico" style={{ height: `${((f.despesas + f.horas) / maior) * 100}%` }} title={`Saídas ${moeda(f.despesas + f.horas)}`} />
              </div>
              <span className="text-center font-mono text-[0.66rem] text-muted-foreground">{rotuloMes(f.mes)}</span>
            </div>
          ))}
        </div></div>
        <div className="overflow-x-auto">
          <Table className="text-[0.8rem]">
            <TableHeader><TableRow><TableHead>Mês</TableHead><TableHead className="text-right">Recebido</TableHead><TableHead className="text-right">Previsto</TableHead><TableHead className="text-right">Despesas</TableHead><TableHead className="text-right">Horas</TableHead><TableHead className="text-right">Saldo</TableHead></TableRow></TableHeader>
            <TableBody>
              {fluxo.map((f) => (
                <TableRow key={f.mes} className={cn(f.mes === mesAtual && "[&>td]:font-semibold")}>
                  <TableCell>{rotuloMes(f.mes)}{f.mes === mesAtual && " (atual)"}</TableCell>
                  <TableCell className="text-right font-mono">{f.recebido ? moeda(f.recebido) : "—"}</TableCell>
                  <TableCell className="text-right font-mono text-muted-foreground">{f.previsto ? moeda(f.previsto) : "—"}</TableCell>
                  <TableCell className="text-right font-mono">{f.despesas ? moeda(f.despesas) : "—"}</TableCell>
                  <TableCell className="text-right font-mono">{f.horas ? moeda(f.horas) : "—"}</TableCell>
                  <TableCell className={cn("text-right font-mono", f.saldo < 0 && "text-critico")}>{moeda(f.saldo)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <Nota className="text-[0.74rem]">Barras: verde = entradas (cheio: recebido; claro: previsto pelas parcelas), vermelho = saídas (despesas + custo das horas lançadas).</Nota>
      </Card>
      <Card className="gap-0 overflow-hidden p-0">
        <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
          <h3 className="text-[0.92rem] font-semibold">Resultado por projeto</h3>
          <label className="ml-auto flex items-center gap-2 text-sm"><input type="checkbox" checked={todos} onChange={(e) => setTodos(e.target.checked)} className="size-4" />Incluir concluídos</label>
        </div>
        <div className="overflow-x-auto">
          <Table className="text-[0.8rem]">
            <TableHeader><TableRow><TableHead>Projeto</TableHead><TableHead className="text-right">Contratado</TableHead><TableHead className="text-right">Recebido</TableHead><TableHead className="text-right">A receber</TableHead><TableHead className="text-right">Despesas</TableHead><TableHead className="text-right">Horas</TableHead><TableHead className="text-right">Margem atual</TableHead><TableHead className="text-right">Prevista</TableHead></TableRow></TableHeader>
            <TableBody>
              {rs.map(({ p, r }) => (
                <TableRow key={p.id} className="cursor-pointer" onClick={() => acao("proj.abrir", { id: p.id })}>
                  <TableCell className="whitespace-normal"><span className="font-mono text-[0.72rem] text-muted-foreground">{p.codigo}</span> {p.nome}</TableCell>
                  <TableCell className="text-right font-mono">{moeda(r.contratado)}</TableCell>
                  <TableCell className="text-right font-mono">{moeda(r.recebido)}</TableCell>
                  <TableCell className={cn("text-right font-mono", r.atrasado > 0 && "text-critico")}>{moeda(r.a_receber)}</TableCell>
                  <TableCell className="text-right font-mono">{moeda(r.despesas)}</TableCell>
                  <TableCell className="text-right font-mono">{moeda(r.custo_horas)}</TableCell>
                  <TableCell className={cn("text-right font-mono", r.margem !== null && r.margem < 0 && "text-critico")}>{r.margem === null ? "—" : pct(r.margem)}</TableCell>
                  <TableCell className={cn("text-right font-mono", r.margem_prevista !== null && r.margem_prevista * 100 < g.regras.margem_minima && "text-critico")}>{r.margem_prevista === null ? "—" : pct(r.margem_prevista)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell>Total</TableCell><TableCell className="text-right font-mono">{moeda(soma("contratado"))}</TableCell><TableCell className="text-right font-mono">{moeda(soma("recebido"))}</TableCell>
                <TableCell className="text-right font-mono">{moeda(soma("a_receber"))}</TableCell><TableCell className="text-right font-mono">{moeda(soma("despesas"))}</TableCell><TableCell className="text-right font-mono">{moeda(soma("custo_horas"))}</TableCell><TableCell colSpan={2} />
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      </Card>
      <DespesasLancamento />
    </>
  );
}

function DespesasLancamento({ p }: { p?: pj.Projeto }) {
  const { sis, acao } = useSistema();
  const enviar = useEnviar();
  const ativos = sis.cadastros.projetos.filter((x) => x.status !== "Cancelado");
  const [pid, setPid] = React.useState(p?.id ?? ativos[0]?.id ?? "");
  const lista = (p ? [p] : sis.cadastros.projetos).flatMap((x) => x.despesas.map((d) => ({ x, d }))).sort((a, b) => b.d.data.localeCompare(a.d.data));
  return (
    <Card className="gap-0 overflow-hidden p-0">
      <form className={cn(GRADE_FORM, "border-b px-4 py-3")} onSubmit={enviar("dsp.salvar", { id: p?.id ?? pid }, { limpar: true })}>
        <h3 className="col-span-full text-[0.92rem] font-semibold">Lançar despesa do projeto</h3>
        {!p && <Campo rotulo="Projeto"><NativeSelect value={pid} onChange={(e) => setPid(e.target.value)}>{ativos.map((x) => <option key={x.id} value={x.id}>{x.codigo} · {x.nome}</option>)}</NativeSelect></Campo>}
        <Campo rotulo="Descrição" className="sm:col-span-2"><Input name="descricao" required maxLength={200} placeholder="Ex.: Projeto estrutural (terceirizado)" /></Campo>
        <Campo rotulo="Categoria"><NativeSelect name="categoria" defaultValue="Projetos complementares (terceiros)">{px.CATEGORIAS_DESPESA.map((x) => <option key={x}>{x}</option>)}</NativeSelect></Campo>
        <Campo rotulo="Valor (R$)"><CampoNumero name="valor" required placeholder="0,00" /></Campo>
        <Campo rotulo="Data"><Input name="data" type="date" defaultValue={sis.hoje} /></Campo>
        <Campo rotulo="Fornecedor"><Input name="fornecedor" maxLength={120} list="forn-dsp" /></Campo>
        <Campo rotulo="Situação"><NativeSelect name="pago" defaultValue="1"><option value="1">Paga</option><option value="0">A pagar</option></NativeSelect></Campo>
        <Button type="submit" disabled={!p && !pid}>Lançar</Button>
        <Sugestoes id="forn-dsp" valores={sis.cadastros.contatos.filter((c) => c.tipo !== "Cliente").map((c) => c.nome)} />
      </form>
      {lista.length ? (
        <ul className="max-h-96 divide-y overflow-y-auto">
          {lista.map(({ x, d }) => (
            <li key={d.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-[0.84rem]">
              <span className="w-20 font-mono text-[0.78rem]">{dataBr(d.data)}</span>
              <span className="min-w-0 flex-1 basis-48">{d.descricao}<span className="block text-[0.74rem] text-muted-foreground">{!p && `${x.codigo} · `}{d.categoria}{d.fornecedor && ` · ${d.fornecedor}`}</span></span>
              <span className="font-mono">{moeda(d.valor)}</span>
              <Button size="sm" variant={d.pago ? "outline" : "default"} onClick={() => acao("dsp.pago", { id: x.id, did: d.id })}>{d.pago ? "Paga" : "Marcar paga"}</Button>
              <button type="button" aria-label="Excluir despesa" className="text-muted-foreground hover:text-critico" onClick={() => acao("dsp.remover", { id: x.id, did: d.id })}><Trash2Icon className="size-4" /></button>
            </li>
          ))}
        </ul>
      ) : <p className="px-4 py-4 text-sm text-muted-foreground">Nenhuma despesa lançada (projetos complementares, taxas, RRT, plotagens, deslocamentos…).</p>}
    </Card>
  );
}
export { DespesasLancamento };
