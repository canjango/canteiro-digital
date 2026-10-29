"use client";

import * as React from "react";
import { ArrowLeftIcon, CheckIcon, HardHatIcon, MinusIcon, PencilIcon, PlusIcon, RotateCcwIcon, Trash2Icon, UndoIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import * as pj from "@/lib/core/projetos";
import { arred, dataBr, moeda, num, pct } from "@/lib/core/util";
import { cn } from "@/lib/utils";
import { Campo, CampoNumero, Nota, Pill } from "./comum";
import { AbasArea, BotaoExcluir, GRADE_FORM, Indicadores, Sugestoes } from "./modulo-comum";
import { useEnviar, useSistema } from "./provedor";
import { ArquivosProjeto, DespesasLancamento, OrcamentoProjeto, TarefasDoProjeto } from "./projeto-telas";
import { FormProjeto } from "./tela-projetos";

const nomeFase = (c: string) => pj.faseCatalogo(c)?.nome ?? c;
const rev = (n: number) => `R${String(n).padStart(2, "0")}`;

export function DetalheProjeto({ p }: { p: pj.Projeto }) {
  const { sis, acao } = useSistema();
  const [aba, setAba] = React.useState("fases");
  const [editar, setEditar] = React.useState(false);
  const r = pj.resultado(p, sis.hoje);
  const av = pj.avancoProjeto(p);
  // o aviso de datas já aparece como formulário logo abaixo do cabeçalho
  const alertas = pj.alertasProjeto(p, sis.cadastros.regras, sis.hoje).filter((a) => !a.titulo.includes("sem início ou entrega"));
  const obra = p.obra ? sis.obras.get(p.obra) : undefined;
  const revUsadas = pj.revisoesUsadas(p);
  const horas = pj.horasTotais(p);
  const orcadas = pj.horasOrcadas(p);
  return (
    <>
      <div className="flex flex-wrap items-start gap-3">
        <Button variant="outline" size="sm" onClick={() => acao("proj.abrir", { id: "" })}><ArrowLeftIcon />Projetos</Button>
        <div className="min-w-0 flex-1 basis-64">
          <p className="font-mono text-[0.78rem] text-muted-foreground">{p.codigo}</p>
          <h2 className="break-words text-xl font-bold">{p.nome}</h2>
          <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[0.82rem] text-muted-foreground">
            <Pill texto={p.status} /><Pill texto={p.padrao} />
            <span>{p.categoria} · {p.tipo_obra}</span>
            {p.cliente && <span>· {p.cliente}</span>}
            {p.area > 0 && <span>· {num(p.area)} m²</span>}
            <span>· {p.origem}</span>
            {p.entrega && <span className={cn(p.entrega < sis.hoje && pj.projetoAtivo(p) && "font-semibold text-critico")}>· entrega {dataBr(p.entrega)}</span>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditar((x) => !x)}><PencilIcon />{editar ? "Fechar edição" : "Editar dados"}</Button>
          <Button variant="outline" size="sm" onClick={() => acao("tpl.do_projeto", { id: p.id, nome: `Modelo — ${p.nome}` })}>Salvar como template</Button>
          <Button size="sm" onClick={() => acao("proj.obra", { id: p.id })}><HardHatIcon />{obra ? "Abrir obra" : "Gerar obra"}</Button>
        </div>
      </div>
      {editar && <FormProjeto p={p} aoFechar={() => setEditar(false)} />}
      {(!p.inicio || !p.entrega) && !editar && <DefinirDatas p={p} />}
      <Indicadores
        itens={[
          { rotulo: "Contratado", valor: moeda(r.contratado), sub: p.aditivos.length ? `inclui ${moeda(pj.totalAditivos(p))} de aditivos` : p.honorarios.metodo },
          { rotulo: "Avanço", valor: pct(av), sub: `valor agregado ${moeda(r.agregado)}` },
          { rotulo: "Custo total", valor: moeda(r.custo), sub: `${num(horas)} h de ${num(orcadas)} h${r.despesas ? ` · ${moeda(r.despesas)} despesas` : " orçadas"}`, tom: orcadas && horas > orcadas ? "critico" : undefined },
          {
            rotulo: "Margem", valor: r.margem === null ? "—" : pct(r.margem),
            sub: r.margem_prevista === null ? "sobre as horas lançadas · projeção após 5% de avanço" : `sobre as horas lançadas · prevista no término ${pct(r.margem_prevista)}`,
            tom: r.margem_prevista !== null && r.margem_prevista * 100 < sis.cadastros.regras.margem_minima ? "critico" : r.margem !== null && r.margem > 0 ? "ok" : undefined,
          },
          { rotulo: "Recebido", valor: moeda(r.recebido), sub: r.atrasado ? `${moeda(r.atrasado)} em atraso` : `a receber ${moeda(r.a_receber)}`, tom: r.atrasado ? "critico" : undefined },
          { rotulo: "Revisões", valor: `${revUsadas}/${p.revisoes_incluidas}`, sub: revUsadas > p.revisoes_incluidas ? "acima do contrato — aditivo" : "usadas / incluídas", tom: revUsadas > p.revisoes_incluidas ? "atencao" : undefined },
        ]}
      />
      {alertas.length > 0 && (
        <Card className="gap-1 border-atencao/50 p-3">
          {alertas.map((a, k) => (
            <p key={k} className="flex items-start gap-2 text-[0.84rem]">
              <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", a.nivel === "critico" ? "bg-critico" : a.nivel === "atencao" ? "bg-atencao" : "bg-info")} />
              <span><b>{a.titulo.replace(`${p.codigo}: `, "")}</b> — <span className="text-muted-foreground">{a.detalhe}</span></span>
            </p>
          ))}
        </Card>
      )}
      <AbasArea
        rotulo="Seções do projeto"
        atual={aba}
        aoEscolher={setAba}
        abas={[
          { id: "fases", rotulo: "Fases e prazos", curto: "Fases", contagem: p.fases.length },
          { id: "financeiro", rotulo: "Honorários e parcelas", curto: "Financeiro", contagem: p.parcelas.length },
          { id: "horas", rotulo: "Horas", contagem: p.horas.length },
          { id: "entregaveis", rotulo: "Entregáveis", contagem: p.entregaveis.length },
          { id: "tarefas", rotulo: "Tarefas", contagem: p.tarefas.filter((t) => t.status !== "Concluída").length },
          { id: "orcamento", rotulo: "Orçamento", contagem: p.orcamento.length },
          { id: "arquivos", rotulo: "Arquivos", contagem: p.arquivos.length },
          { id: "despesas", rotulo: "Despesas", contagem: p.despesas.length },
          { id: "aditivos", rotulo: "Aditivos", contagem: p.aditivos.length },
        ]}
      />
      {aba === "fases" && <AbaFases p={p} />}
      {aba === "financeiro" && <AbaFinanceiro p={p} />}
      {aba === "horas" && <AbaHoras p={p} />}
      {aba === "entregaveis" && <AbaEntregaveis p={p} />}
      {aba === "aditivos" && <AbaAditivos p={p} />}
      {aba === "tarefas" && <TarefasDoProjeto p={p} />}
      {aba === "orcamento" && <OrcamentoProjeto p={p} />}
      {aba === "arquivos" && <ArquivosProjeto p={p} />}
      {aba === "despesas" && <DespesasLancamento p={p} />}
      <div className="flex flex-wrap items-center gap-3 border-t pt-3">
        {p.observacao && <Nota className="min-w-0 flex-1 whitespace-pre-line">{p.observacao}</Nota>}
        <BotaoExcluir acaoNome="proj.remover" id={p.id} rotulo="Excluir projeto" pergunta={`Excluir ${p.codigo} e todos os lançamentos?`} />
      </div>
    </>
  );
}

function DefinirDatas({ p }: { p: pj.Projeto }) {
  const { sis } = useSistema();
  const enviar = useEnviar();
  return (
    <Card className="gap-2 border-sinal p-3.5 shadow-[inset_4px_0_0_var(--sinal)]">
      <h3 className="text-[0.92rem] font-semibold">Defina o período do projeto</h3>
      <Nota className="text-[0.82rem]">Com início e entrega, os prazos das fases pendentes são distribuídos pelos pesos e as parcelas previstas ganham vencimento.</Nota>
      <form className="flex flex-wrap items-end gap-2" onSubmit={enviar("proj.datas", { id: p.id })}>
        <Campo rotulo="Início"><Input name="inicio" type="date" required defaultValue={p.inicio || sis.hoje} className="w-44" /></Campo>
        <Campo rotulo="Entrega final"><Input name="entrega" type="date" required defaultValue={p.entrega} className="w-44" /></Campo>
        <Button type="submit">Distribuir prazos</Button>
      </form>
    </Card>
  );
}

// ================================================================ fases
function AbaFases({ p }: { p: pj.Projeto }) {
  const { sis, acao } = useSistema();
  const enviar = useEnviar();
  const [editando, setEditando] = React.useState(false);
  const [pesos, setPesos] = React.useState<Record<string, string>>({});
  const [aprovando, setAprovando] = React.useState("");
  const regras = sis.cadastros.regras;
  const atual = pj.faseAtual(p);
  const soma = editando ? arred(p.fases.reduce((s, f) => s + Number((pesos[f.codigo] ?? String(f.peso)).replace(",", ".") || 0), 0), 2) : pj.somaPesos(p);
  const faltam = pj.FASES.filter((f) => !p.fases.some((x) => x.codigo === f.codigo));
  const abrirEdicao = () => { setPesos(Object.fromEntries(p.fases.map((f) => [f.codigo, num(f.peso)]))); setEditando(true); };
  return (
    <Card className="gap-0 overflow-hidden p-0">
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
        <h3 className="text-[0.92rem] font-semibold">Fases ({p.modelo})</h3>
        <span className={cn("font-mono text-[0.78rem]", Math.abs(soma - 100) > 0.01 ? "font-bold text-critico" : "text-muted-foreground")}>pesos {num(soma)}%</span>
        <div className="ml-auto flex flex-wrap gap-2">
          {!editando && faltam.length > 0 && (
            <NativeSelect aria-label="Incluir fase" value="" onChange={(e) => e.target.value && acao("proj.fase_add", { id: p.id, codigo: e.target.value })} className="h-8 w-auto text-sm">
              <option value="">+ incluir fase…</option>
              {faltam.map((f) => <option key={f.codigo} value={f.codigo}>{f.codigo} · {f.nome}</option>)}
            </NativeSelect>
          )}
          <Button size="sm" variant={editando ? "outline" : "default"} onClick={() => (editando ? setEditando(false) : abrirEdicao())}>{editando ? "Cancelar" : "Editar pesos, horas e prazos"}</Button>
        </div>
      </div>
      {!editando && (
        <ul className="divide-y md:hidden" aria-label="Fases">
          {p.fases.map((f, i) => {
            const hf = pj.horasFase(p, f.codigo);
            const exige = regras.fases_aprovacao.includes(f.codigo);
            const corrente = i === atual.indice;
            return (
              <li key={f.codigo} className={cn("flex flex-col gap-1.5 px-4 py-3", corrente && "bg-sinal-suave")}>
                <div className="flex items-start gap-2">
                  <span className="min-w-0 flex-1">
                    <span className="font-mono text-[0.74rem] text-muted-foreground">{f.codigo}</span> <b className="font-medium">{nomeFase(f.codigo)}</b>
                    <span className="block text-[0.76rem] text-muted-foreground">
                      {num(f.peso)}% · {moeda(pj.valorFase(p, f.codigo))} · {num(hf)}/{num(f.horas_orcadas)} h{f.prazo ? ` · até ${dataBr(f.prazo)}` : ""}
                    </span>
                  </span>
                  <Button type="button" size="sm" variant={!f.concluida_em && corrente ? "default" : "outline"} onClick={() => acao("proj.fase", { id: p.id, codigo: f.codigo })}>
                    {f.concluida_em ? <><UndoIcon />Reabrir</> : <><CheckIcon />Concluir</>}
                  </Button>
                </div>
                <span className="text-[0.76rem]">
                  {f.concluida_em ? <span className="text-ok">concluída {dataBr(f.concluida_em)}</span> : corrente ? <b>em andamento</b> : <span className="text-muted-foreground">pendente</span>}
                  {f.aprovada_em && <span> · aprovada {dataBr(f.aprovada_em)}</span>}
                  {exige && f.concluida_em && !f.aprovada_em && <span className="font-semibold text-atencao"> · aguardando aprovação</span>}
                  <span className="text-muted-foreground"> · revisões {f.revisoes}</span>
                </span>
                {exige && f.concluida_em && !f.aprovada_em && (
                  <Button type="button" size="sm" variant="outline" className="self-start" onClick={() => acao("proj.aprovar", { id: p.id, codigo: f.codigo, por: p.cliente })}>Registrar aprovação do cliente (hoje)</Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <form id={`fases-${p.id}`} onSubmit={(e) => { const r = enviar("proj.fases", { id: p.id })(e); if (r.ok) setEditando(false); }}>
        <div className={cn("overflow-x-auto", !editando && "hidden md:block")}>
          <Table className="text-[0.84rem]">
            <TableHeader>
              <TableRow>
                <TableHead>Fase</TableHead><TableHead className="text-right">Peso</TableHead><TableHead className="text-right">Valor</TableHead>
                <TableHead className="min-w-40">Horas</TableHead><TableHead>Prazo</TableHead><TableHead>Situação</TableHead><TableHead className="w-px">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {p.fases.map((f, i) => {
                const hf = pj.horasFase(p, f.codigo);
                const uso = f.horas_orcadas ? hf / f.horas_orcadas : 0;
                const exige = regras.fases_aprovacao.includes(f.codigo);
                const corrente = i === atual.indice;
                return (
                  <TableRow key={f.codigo} className={cn(corrente && "[&>td]:bg-sinal-suave")}>
                    <TableCell className="whitespace-normal">
                      <span className="font-mono text-[0.74rem] text-muted-foreground">{f.codigo}</span> <b className="font-medium">{nomeFase(f.codigo)}</b>
                      {exige && <span className="block text-[0.72rem] text-muted-foreground">exige aprovação do cliente</span>}
                    </TableCell>
                    <TableCell className="text-right">
                      {editando ? (
                        <Input name={`peso_${f.codigo}`} inputMode="decimal" value={pesos[f.codigo] ?? ""} onChange={(e) => setPesos((x) => ({ ...x, [f.codigo]: e.target.value }))} className="ml-auto h-8 w-16 text-right font-mono" aria-label={`Peso de ${f.codigo} (%)`} />
                      ) : <span className="font-mono">{num(f.peso)}%</span>}
                    </TableCell>
                    <TableCell className="text-right font-mono">{moeda(pj.valorFase(p, f.codigo))}</TableCell>
                    <TableCell>
                      {editando ? (
                        <CampoNumero name={`horas_${f.codigo}`} texto={f.horas_orcadas ? num(f.horas_orcadas) : ""} placeholder="0" className="h-8 w-20 text-right font-mono" aria-label={`Horas orçadas de ${f.codigo}`} />
                      ) : (
                        <span className="flex items-center gap-2">
                          <span className={cn("font-mono text-[0.78rem]", uso > 1 && "font-bold text-critico", uso * 100 >= regras.alerta_horas && uso <= 1 && "text-atencao")}>{num(hf)}/{num(f.horas_orcadas)} h</span>
                          {f.horas_orcadas > 0 && <Progress value={uso} className="w-16" cor={uso > 1 ? "bg-critico" : uso * 100 >= regras.alerta_horas ? "bg-atencao" : "bg-ok"} />}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {editando ? (
                        <span className="flex gap-1">
                          <Input type="date" name={`inicio_${f.codigo}`} defaultValue={f.inicio} className="h-8 w-36" aria-label={`Início de ${f.codigo}`} />
                          <Input type="date" name={`prazo_${f.codigo}`} defaultValue={f.prazo} className="h-8 w-36" aria-label={`Prazo de ${f.codigo}`} />
                        </span>
                      ) : (
                        <span className={cn("font-mono text-[0.78rem]", !f.concluida_em && f.prazo && f.prazo < sis.hoje && "font-bold text-critico")}>{f.prazo ? dataBr(f.prazo) : "—"}</span>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-normal text-[0.78rem]">
                      {f.concluida_em ? <span className="text-ok">concluída {dataBr(f.concluida_em)}</span> : corrente ? <b>em andamento</b> : <span className="text-muted-foreground">pendente</span>}
                      {f.aprovada_em && <span className="block">aprovada {dataBr(f.aprovada_em)}{f.aprovado_por ? ` · ${f.aprovado_por}` : ""}</span>}
                      {exige && f.concluida_em && !f.aprovada_em && <span className="block font-semibold text-atencao">aguardando aprovação</span>}
                      <span className="mt-0.5 flex items-center gap-1 text-muted-foreground">
                        revisões {f.revisoes}
                        {!editando && (
                          <>
                            <button type="button" className="grid size-5 place-items-center rounded border hover:bg-muted" aria-label={`Menos uma revisão em ${f.codigo}`} onClick={() => acao("proj.revisao", { id: p.id, codigo: f.codigo, delta: -1 })}><MinusIcon className="size-3" /></button>
                            <button type="button" className="grid size-5 place-items-center rounded border hover:bg-muted" aria-label={`Mais uma revisão em ${f.codigo}`} onClick={() => acao("proj.revisao", { id: p.id, codigo: f.codigo, delta: 1 })}><PlusIcon className="size-3" /></button>
                          </>
                        )}
                      </span>
                    </TableCell>
                    <TableCell>
                      {!editando && (
                        <div className="flex flex-col items-start gap-1">
                          <Button type="button" size="sm" variant={!f.concluida_em && corrente ? "default" : "outline"} onClick={() => acao("proj.fase", { id: p.id, codigo: f.codigo })}>
                            {f.concluida_em ? <><UndoIcon />Reabrir</> : <><CheckIcon />Concluir</>}
                          </Button>
                          {f.concluida_em && !f.aprovada_em && (
                            aprovando === f.codigo ? (
                              <span className="flex flex-col gap-1">
                                <Input id={`ap-por-${f.codigo}`} placeholder="Aprovado por" defaultValue={p.cliente} className="h-8 w-40" aria-label="Aprovado por" />
                                <span className="flex gap-1">
                                  <Button type="button" size="sm" onClick={() => { const por = (document.getElementById(`ap-por-${f.codigo}`) as HTMLInputElement | null)?.value ?? ""; if (acao("proj.aprovar", { id: p.id, codigo: f.codigo, por }).ok) setAprovando(""); }}>Registrar</Button>
                                  <Button type="button" size="sm" variant="outline" onClick={() => setAprovando("")}>×</Button>
                                </span>
                              </span>
                            ) : <Button type="button" size="sm" variant="outline" onClick={() => setAprovando(f.codigo)}>Aprovação do cliente</Button>
                          )}
                          {!f.concluida_em && !pj.horasFase(p, f.codigo) && !p.entregaveis.some((e) => e.fase === f.codigo) && p.fases.length > 1 && (
                            <button type="button" className="text-[0.74rem] text-muted-foreground underline hover:text-critico" onClick={() => acao("proj.fase_rem", { id: p.id, codigo: f.codigo })}>remover fase</button>
                          )}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell>Total</TableCell>
                <TableCell className={cn("text-right font-mono", Math.abs(soma - 100) > 0.01 && "text-critico")}>{num(soma)}%</TableCell>
                <TableCell className="text-right font-mono">{moeda(pj.honorarioBase(p))}</TableCell>
                <TableCell className="font-mono text-[0.78rem]">{num(pj.horasTotais(p))}/{num(pj.horasOrcadas(p))} h</TableCell>
                <TableCell colSpan={3} />
              </TableRow>
            </TableFooter>
          </Table>
        </div>
        {editando && (
          <div className="flex flex-wrap items-center gap-2 border-t px-4 py-3">
            <Button type="submit" disabled={Math.abs(soma - 100) > 0.01}>Salvar fases</Button>
            <span className={cn("text-sm", Math.abs(soma - 100) > 0.01 ? "font-semibold text-critico" : "text-muted-foreground")}>
              {Math.abs(soma - 100) > 0.01 ? `Os pesos somam ${num(soma)}% — faltam ${num(arred(100 - soma, 2))}% para fechar 100%` : "Pesos fecham 100%"}
            </span>
          </div>
        )}
      </form>
      <Nota className="border-t px-4 py-2.5 text-[0.76rem]">
        Concluir uma fase conclui as anteriores; reabrir reabre as seguintes. {regras.bloquear_sem_aprovacao && regras.fases_aprovacao.length ? `Regra ativa: ${regras.fases_aprovacao.join(", ")} precisam da aprovação do cliente antes de concluir as fases seguintes.` : "Sem bloqueio por aprovação (veja Regras)."} O avanço da fase em andamento conta os entregáveis aprovados.
      </Nota>
    </Card>
  );
}

// ================================================================ honorários e parcelas
function AbaFinanceiro({ p }: { p: pj.Projeto }) {
  const { sis, acao } = useSistema();
  const enviar = useEnviar();
  const r = pj.resultado(p, sis.hoje);
  const h = p.honorarios;
  const base = pj.honorarioBase(p);
  const [recebendo, setRecebendo] = React.useState("");
  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
      <Card className="gap-2 p-4">
        <h3 className="text-[0.92rem] font-semibold">Composição dos honorários</h3>
        <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 text-[0.86rem]">
          <dt className="text-muted-foreground">Forma de cálculo</dt><dd className="text-right">{h.metodo}</dd>
          {h.metodo === "Percentual do custo da obra" && <>
            <dt className="text-muted-foreground">Custo estimado da obra</dt><dd className="text-right font-mono">{moeda(pj.custoObraEstimado(p))}</dd>
            <dt className="text-muted-foreground">{num(p.area)} m² × {moeda(h.custo_m2)}/m²</dt><dd className="text-right font-mono">× {num(h.percentual)}%</dd>
          </>}
          {h.metodo === "Valor por m²" && <><dt className="text-muted-foreground">{num(p.area)} m² × {moeda(h.valor_m2)}</dt><dd className="text-right font-mono">{moeda(p.area * h.valor_m2)}</dd></>}
          {h.metodo === "Custo do serviço (horas × K)" && <>
            <dt className="text-muted-foreground">{num(h.horas_estimadas)} h × {moeda(h.custo_hora)}</dt><dd className="text-right font-mono">{moeda(h.horas_estimadas * h.custo_hora)}</dd>
            <dt className="text-muted-foreground">K (enc. {num(h.k.encargos)}% · ind. {num(h.k.indiretas)}% · lucro {num(h.k.lucro)}% · imp. {num(h.k.impostos)}%)</dt><dd className="text-right font-mono">× {pj.fatorK(h.k).toFixed(3).replace(".", ",")}</dd>
          </>}
          {h.desconto > 0 && <><dt className="text-muted-foreground">Desconto</dt><dd className="text-right font-mono">− {num(h.desconto)}%</dd></>}
          <dt className="font-semibold">Honorários contratados</dt><dd className="text-right font-mono font-semibold">{moeda(base)}</dd>
          {p.aditivos.length > 0 && <><dt className="text-muted-foreground">Aditivos ({p.aditivos.length})</dt><dd className="text-right font-mono">+ {moeda(pj.totalAditivos(p))}</dd></>}
          <dt className="border-t pt-1 font-bold">Total</dt><dd className="border-t pt-1 text-right font-mono font-bold">{moeda(r.contratado)}</dd>
          {p.area > 0 && <><dt className="text-muted-foreground">Por m²</dt><dd className="text-right font-mono">{moeda(r.contratado / p.area)}</dd></>}
          {h.metodo !== "Percentual do custo da obra" && pj.custoObraEstimado(p) > 0 && <><dt className="text-muted-foreground">% sobre a obra estimada</dt><dd className="text-right font-mono">{pct(r.contratado / pj.custoObraEstimado(p))}</dd></>}
        </dl>
        <div className="mt-2 grid grid-cols-2 gap-2 border-t pt-2 text-[0.82rem]">
          <span>Faturado <b className="block font-mono">{moeda(r.faturado)}</b></span>
          <span>Recebido <b className="block font-mono text-ok">{moeda(r.recebido)}</b></span>
          <span>A receber <b className="block font-mono">{moeda(r.a_receber)}</b></span>
          <span>Sem parcela <b className={cn("block font-mono", r.sem_parcela > 0.005 && "text-atencao")}>{moeda(r.sem_parcela)}</b></span>
        </div>
      </Card>
      <Card className="gap-0 overflow-hidden p-0">
        <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
          <h3 className="text-[0.92rem] font-semibold">Parcelas</h3>
          <form className="ml-auto flex flex-wrap items-end gap-2" onSubmit={enviar("proj.parcelas", { id: p.id })}>
            <label className="flex items-center gap-1.5 text-[0.8rem] text-muted-foreground">sinal <Input name="sinal" inputMode="decimal" defaultValue="20" className="h-8 w-14 text-right" aria-label="Sinal (%)" />%</label>
            <Button type="submit" size="sm" variant="outline" disabled={p.parcelas.some((x) => x.status !== "Prevista")}>{p.parcelas.length ? "Refazer por fase" : "Gerar por fase"}</Button>
          </form>
        </div>
        {p.parcelas.length ? (
          <ul className="divide-y">
            {[...p.parcelas].sort((a, b) => (a.vencimento || "9999").localeCompare(b.vencimento || "9999")).map((x) => {
              const atrasada = x.status !== "Recebida" && x.vencimento && x.vencimento < sis.hoje;
              const faseOk = x.fase ? p.fases.find((f) => f.codigo === x.fase)?.concluida_em : "";
              return (
                <li key={x.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2.5">
                  <span className="flex min-w-0 flex-1 basis-48 flex-col">
                    <span className="text-sm font-medium">{x.descricao}</span>
                    <span className={cn("text-[0.76rem] text-muted-foreground", atrasada && "font-semibold text-critico")}>
                      {x.vencimento ? `vence ${dataBr(x.vencimento)}` : "sem vencimento"}{x.fase && ` · ${x.fase} ${faseOk ? "concluída" : "pendente"}`}
                      {x.status === "Recebida" && ` · recebida ${dataBr(x.recebido_em)}`}
                    </span>
                  </span>
                  <span className="font-mono text-sm">{moeda(x.valor)}</span>
                  <Pill texto={atrasada ? "Atrasada" : x.status} />
                  <span className="flex flex-wrap gap-1">
                    {x.status === "Prevista" && <Button size="sm" variant="outline" onClick={() => acao("proj.parcela_status", { id: p.id, pid: x.id, status: "Faturada" })}>Faturar</Button>}
                    {x.status !== "Recebida" && (recebendo === x.id ? (
                      <span className="flex gap-1">
                        <Input id={`rec-${x.id}`} type="date" defaultValue={sis.hoje} className="h-8 w-36" aria-label="Data do recebimento" />
                        <Button size="sm" onClick={() => { const data = (document.getElementById(`rec-${x.id}`) as HTMLInputElement | null)?.value; if (acao("proj.parcela_status", { id: p.id, pid: x.id, status: "Recebida", data }).ok) setRecebendo(""); }}>OK</Button>
                      </span>
                    ) : <Button size="sm" variant={!x.fase || faseOk || (x.vencimento && x.vencimento <= sis.hoje) ? "default" : "outline"} onClick={() => setRecebendo(x.id)}>Receber</Button>)}
                    {x.status !== "Prevista" && <Button size="sm" variant="ghost" aria-label="Voltar para prevista" title="Voltar para prevista" onClick={() => acao("proj.parcela_status", { id: p.id, pid: x.id, status: "Prevista" })}><RotateCcwIcon /></Button>}
                    {x.status !== "Recebida" && <BotaoExcluir acaoNome="proj.parcela_rem" id={x.id} rotulo="×" pergunta="Excluir?" />}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : <p className="px-4 py-5 text-sm text-muted-foreground">Nenhuma parcela. Gere uma parcela por fase (o valor de cada fase, vencendo no prazo dela) ou inclua abaixo.</p>}
        <form className={cn(GRADE_FORM, "border-t px-4 py-3")} onSubmit={enviar("proj.parcela", { id: p.id }, { limpar: true })}>
          <Campo rotulo="Nova parcela"><Input name="descricao" required maxLength={120} placeholder="Ex.: Sinal" /></Campo>
          <Campo rotulo="Valor (R$)"><CampoNumero name="valor" required placeholder="0,00" /></Campo>
          <Campo rotulo="Vencimento"><Input name="vencimento" type="date" /></Campo>
          <Campo rotulo="Fase"><NativeSelect name="fase" defaultValue=""><option value="">(nenhuma)</option>{p.fases.map((f) => <option key={f.codigo} value={f.codigo}>{f.codigo}</option>)}</NativeSelect></Campo>
          <Button type="submit" variant="outline">Incluir</Button>
        </form>
      </Card>
    </div>
  );
}

// ================================================================ horas
function AbaHoras({ p }: { p: pj.Projeto }) {
  const { sis, acao } = useSistema();
  const enviar = useEnviar();
  const equipe = sis.cadastros.equipe.filter((m) => m.ativo);
  const [membro, setMembro] = React.useState(equipe[0]?.id ?? "");
  const [faseFiltro, setFaseFiltro] = React.useState("");
  const atual = pj.faseAtual(p).fase?.codigo ?? p.fases[0]?.codigo;
  const lista = [...p.horas].filter((h) => !faseFiltro || h.fase === faseFiltro).sort((a, b) => b.data.localeCompare(a.data));
  const porPessoa = new Map<string, { horas: number; custo: number }>();
  for (const h of p.horas) {
    const x = porPessoa.get(h.pessoa) ?? { horas: 0, custo: 0 };
    porPessoa.set(h.pessoa, { horas: x.horas + h.horas, custo: x.custo + h.horas * h.custo_hora });
  }
  const regras = sis.cadastros.regras;
  const m = equipe.find((x) => x.id === membro);
  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <Card className="gap-0 overflow-hidden p-0">
        <form className={cn(GRADE_FORM, "border-b px-4 py-3")} onSubmit={enviar("proj.horas", { id: p.id }, { limpar: true })}>
          <Campo rotulo="Data"><Input name="data" type="date" defaultValue={sis.hoje} max={sis.hoje} /></Campo>
          <Campo rotulo="Quem">
            <NativeSelect name="membro" value={membro} onChange={(e) => setMembro(e.target.value)}>
              {equipe.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
              <option value="">Outra pessoa…</option>
            </NativeSelect>
          </Campo>
          {!membro && <Campo rotulo="Nome"><Input name="pessoa" required maxLength={80} /></Campo>}
          <Campo rotulo="Fase"><NativeSelect name="fase" defaultValue={atual}>{p.fases.map((f) => <option key={f.codigo} value={f.codigo}>{f.codigo} · {nomeFase(f.codigo)}</option>)}</NativeSelect></Campo>
          <Campo rotulo="Horas"><CampoNumero name="horas" required placeholder="Ex.: 3,5" /></Campo>
          <Campo rotulo="O que foi feito" className="col-span-full sm:col-span-2"><Input name="descricao" maxLength={200} /></Campo>
          <Button type="submit">Lançar horas</Button>
          <Nota className="col-span-full text-[0.74rem]">
            Custo/hora: {m && m.custo_dia > 0 ? `${moeda(m.custo_dia)}/dia ÷ ${num(regras.horas_dia)} h = ${moeda(m.custo_dia / regras.horas_dia)}/h (da equipe)` : `${moeda(regras.custo_hora_padrao)}/h (padrão das regras)`}. O custo fica gravado no lançamento.
          </Nota>
        </form>
        <div className="flex items-center gap-2 px-4 py-2">
          <NativeSelect aria-label="Filtrar por fase" value={faseFiltro} onChange={(e) => setFaseFiltro(e.target.value)} className="h-8 w-auto text-sm">
            <option value="">Todas as fases</option>{p.fases.map((f) => <option key={f.codigo} value={f.codigo}>{f.codigo}</option>)}
          </NativeSelect>
          <span className="text-[0.78rem] text-muted-foreground">{lista.length} lançamento(s) · {num(arred(lista.reduce((s, h) => s + h.horas, 0), 2))} h</span>
        </div>
        {lista.length ? (
          <ul className="max-h-[28rem] divide-y overflow-y-auto">
            {lista.map((h) => (
              <li key={h.id} className="flex items-center gap-3 px-4 py-2 text-[0.84rem]">
                <span className="w-20 shrink-0 font-mono text-[0.78rem]">{dataBr(h.data)}</span>
                <span className="min-w-0 flex-1"><b className="font-medium">{h.pessoa}</b> · {h.fase}{h.descricao && <span className="block truncate text-[0.76rem] text-muted-foreground">{h.descricao}</span>}</span>
                <span className="font-mono">{num(h.horas)} h</span>
                <span className="hidden w-24 text-right font-mono text-muted-foreground sm:block">{moeda(h.horas * h.custo_hora)}</span>
                <button type="button" aria-label="Excluir lançamento" className="text-muted-foreground hover:text-critico" onClick={() => acao("proj.horas_rem", { id: p.id, hid: h.id })}><Trash2Icon className="size-4" /></button>
              </li>
            ))}
          </ul>
        ) : <p className="px-4 pb-4 text-sm text-muted-foreground">Nenhuma hora lançada.</p>}
      </Card>
      <Card className="gap-2 p-4">
        <h3 className="text-[0.92rem] font-semibold">Horas por pessoa</h3>
        {porPessoa.size ? (
          <Table className="text-[0.84rem]">
            <TableBody>
              {[...porPessoa.entries()].sort((a, b) => b[1].horas - a[1].horas).map(([nome, x]) => (
                <TableRow key={nome}><TableCell>{nome}</TableCell><TableCell className="text-right font-mono">{num(arred(x.horas, 2))} h</TableCell><TableCell className="text-right font-mono">{moeda(x.custo)}</TableCell></TableRow>
              ))}
            </TableBody>
            <TableFooter><TableRow><TableCell>Total</TableCell><TableCell className="text-right font-mono">{num(pj.horasTotais(p))} h</TableCell><TableCell className="text-right font-mono">{moeda(pj.custoHoras(p))}</TableCell></TableRow></TableFooter>
          </Table>
        ) : <Nota>Sem horas ainda.</Nota>}
        {!equipe.length && <Nota className="text-[0.76rem]">Cadastre a equipe (Gestão de equipe) para usar o custo real de cada pessoa.</Nota>}
      </Card>
    </div>
  );
}

// ================================================================ entregáveis
function AbaEntregaveis({ p }: { p: pj.Projeto }) {
  const { sis, acao } = useSistema();
  const enviar = useEnviar();
  const atual = pj.faseAtual(p).fase?.codigo ?? p.fases[0]?.codigo;
  return (
    <Card className="gap-0 overflow-hidden p-0">
      <form className={cn(GRADE_FORM, "border-b px-4 py-3")} onSubmit={enviar("proj.entregavel", { id: p.id }, { limpar: true })}>
        <Campo rotulo="Novo entregável (prancha / documento)" className="col-span-full sm:col-span-2"><Input name="titulo" required maxLength={200} placeholder="Ex.: Planta baixa — pavimento térreo" /></Campo>
        <Campo rotulo="Fase"><NativeSelect name="fase" defaultValue={atual}>{p.fases.map((f) => <option key={f.codigo} value={f.codigo}>{f.codigo} · {nomeFase(f.codigo)}</option>)}</NativeSelect></Campo>
        <Campo rotulo="Disciplina"><NativeSelect name="disciplina" defaultValue="Arquitetura">{pj.DISCIPLINAS.map((x) => <option key={x}>{x}</option>)}</NativeSelect></Campo>
        <Campo rotulo="Responsável"><Input name="responsavel" maxLength={80} defaultValue={p.responsavel} list="pessoas-entregavel" /></Campo>
        <Button type="submit">Incluir</Button>
        <Sugestoes id="pessoas-entregavel" valores={sis.cadastros.equipe.map((m) => m.nome)} />
      </form>
      {p.fases.map((f) => {
        const ents = p.entregaveis.filter((e) => e.fase === f.codigo);
        const prontos = ents.filter((e) => e.status === "Aprovado" || e.status === "Emitido p/ obra").length;
        return (
          <section key={f.codigo} className="border-b last:border-b-0">
            <div className="flex flex-wrap items-center gap-2 bg-muted px-4 py-2">
              <h4 className="text-[0.86rem] font-semibold">{f.codigo} · {nomeFase(f.codigo)}</h4>
              <span className="font-mono text-[0.76rem] text-muted-foreground">{prontos}/{ents.length} aprovados</span>
              {(pj.ENTREGAVEIS_SUGERIDOS[f.codigo]?.length ?? 0) > 0 && (
                <Button size="sm" variant="link" className="ml-auto h-auto px-0 underline" onClick={() => acao("proj.entregaveis_sugeridos", { id: p.id, codigo: f.codigo })}>incluir sugeridos</Button>
              )}
            </div>
            {ents.length ? (
              <ul className="divide-y">
                {ents.map((e) => (
                  <li key={e.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2">
                    <span className="font-mono text-[0.78rem] font-semibold">{rev(e.revisao)}</span>
                    <span className="min-w-0 flex-1 basis-48 text-sm">{e.titulo}<span className="block text-[0.74rem] text-muted-foreground">{e.disciplina}{e.responsavel && ` · ${e.responsavel}`}{e.data && ` · ${dataBr(e.data)}`}</span></span>
                    <NativeSelect aria-label={`Situação de ${e.titulo}`} value={e.status} onChange={(ev) => acao("proj.entregavel_status", { id: p.id, eid: e.id, status: ev.target.value })} className="h-8 w-auto text-[0.8rem]">
                      {pj.STATUS_ENTREGAVEL.map((x) => <option key={x}>{x}</option>)}
                    </NativeSelect>
                    <Button size="sm" variant="outline" onClick={() => acao("proj.entregavel_revisar", { id: p.id, eid: e.id })} title="Nova revisão (R+1)">Nova revisão</Button>
                    <BotaoExcluir acaoNome="proj.entregavel_rem" id={e.id} rotulo="×" pergunta="Excluir?" />
                  </li>
                ))}
              </ul>
            ) : <p className="px-4 py-2 text-[0.8rem] text-muted-foreground">Sem entregáveis nesta fase.</p>}
          </section>
        );
      })}
    </Card>
  );
}

// ================================================================ aditivos
function AbaAditivos({ p }: { p: pj.Projeto }) {
  const { sis, acao } = useSistema();
  const enviar = useEnviar();
  const extra = pj.revisoesUsadas(p) - p.revisoes_incluidas;
  return (
    <Card className="gap-0 overflow-hidden p-0">
      {extra > 0 && <p className="border-b bg-atencao-suave px-4 py-2.5 text-sm"><b>{extra} revisão(ões) além do contrato</b> ({p.revisoes_incluidas} incluídas). Registre um aditivo de valor e/ou horas.</p>}
      <form className={cn(GRADE_FORM, "border-b px-4 py-3")} onSubmit={enviar("proj.aditivo", { id: p.id }, { limpar: true })}>
        <Campo rotulo="Descrição" className="col-span-full sm:col-span-2"><Input name="descricao" required maxLength={200} placeholder="Ex.: Revisões extras do anteprojeto" /></Campo>
        <Campo rotulo="Valor (R$)"><CampoNumero name="valor" placeholder="0,00" /></Campo>
        <Campo rotulo="Horas a mais"><CampoNumero name="horas" placeholder="0" /></Campo>
        <Campo rotulo="Data"><Input name="data" type="date" defaultValue={sis.hoje} /></Campo>
        <Button type="submit">Registrar aditivo</Button>
      </form>
      {p.aditivos.length ? (
        <ul className="divide-y">
          {p.aditivos.map((a) => (
            <li key={a.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
              <span className="w-20 font-mono text-[0.78rem]">{dataBr(a.data)}</span>
              <span className="min-w-0 flex-1">{a.descricao}</span>
              {a.horas > 0 && <span className="font-mono text-[0.8rem] text-muted-foreground">+{num(a.horas)} h</span>}
              <span className="font-mono">{moeda(a.valor)}</span>
              <button type="button" aria-label="Excluir aditivo" className="text-muted-foreground hover:text-critico" onClick={() => acao("proj.aditivo_rem", { id: p.id, aid: a.id })}><Trash2Icon className="size-4" /></button>
            </li>
          ))}
        </ul>
      ) : <p className="px-4 py-5 text-sm text-muted-foreground">Nenhum aditivo. Use para revisões além do contrato, ampliação de escopo ou novas disciplinas.</p>}
      <Nota className="border-t px-4 py-2 text-[0.76rem]">Aditivos somam ao contratado e às horas orçadas, mas não entram no rateio das fases.</Nota>
    </Card>
  );
}
