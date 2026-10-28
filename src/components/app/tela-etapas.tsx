"use client";

import * as React from "react";
import { CalendarIcon, FilterIcon, FlagIcon, ImageIcon, PlusIcon, Trash2Icon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import * as an from "@/lib/core/analise";
import { CATEGORIAS, MODELO_VERSAO, especificacao, temFigura } from "@/lib/core/catalogo";
import type { Etapa, Obra } from "@/lib/core/modelos";
import { dataBr, moeda, num, pct } from "@/lib/core/util";
import { cn } from "@/lib/utils";
import { Campo, CampoNumero, Chevrons, Nota, Pill, Secao, corFase, type Passo } from "./comum";
import { useEnviar, useSistema } from "./provedor";
import { BlocoIa } from "./revisao-ia";

function etapaSelecionada(abertas: string[], o: Obra): Etapa | null {
  for (let i = abertas.length - 1; i >= 0; i--) {
    const e = o.etapas.find((x) => x.codigo === abertas[i]);
    if (e) return e;
  }
  return o.etapas.find((e) => !an.etapaConcluida(e)) ?? o.etapas[0] ?? null;
}

export function TelaEtapas() {
  const { sis, acao } = useSistema();
  const o = sis.obra!;
  const hoje = sis.hoje;
  const sel = etapaSelecionada(sis.ui.abertas, o);
  const fase = sis.ui.fase;

  const passos: Passo[] = CATEGORIAS.flatMap((cat) => {
    const es = o.etapas.filter((e) => e.categoria === cat);
    if (!es.length) return [];
    const pesos = es.reduce((s, e) => s + (e.peso || 1), 0) || 1;
    const prog = es.reduce((s, e) => s + an.progressoEtapa(e) * (e.peso || 1), 0) / pesos;
    const atual = fase === cat || (!fase && sel?.categoria === cat);
    return [{ rotulo: cat, sub: pct(prog), valor: cat, estado: atual ? "atual" : prog >= 1 ? "feita" : "" } as Passo];
  });

  return (
    <>
      {o.modelo_etapas < MODELO_VERSAO && (
        <Card className="gap-2 p-4 shadow-[inset_4px_0_0_var(--sinal)]">
          <h2 className="font-semibold">Modelo de etapas revisado para residência de 100 m²</h2>
          <Nota className="max-w-[80ch]">
            Sequência corrigida (alvenaria em paralelo com a estrutura), pesos de custo revisados, novos itens de checklist e cronograma
            pela duração típica de cada etapa. Itens já marcados, itens que você criou, observações e orçamentos ajustados à mão são
            mantidos. Como entram itens novos, a porcentagem de avanço pode baixar.
          </Nota>
          <Button className="self-start" onClick={() => acao("obra.atualizar_modelo")}>Aplicar modelo revisado</Button>
        </Card>
      )}
      <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-[minmax(230px,290px)_minmax(0,1fr)]">
        <Card className="flex flex-row gap-2 overflow-x-auto p-2 md:sticky md:top-[108px] md:max-h-[calc(100dvh-124px)] md:flex-col md:gap-2.5 md:overflow-y-auto md:p-3" aria-label="Etapas da obra">
          <div className="hidden items-center justify-between border-b-2 border-foreground px-1 pb-2 font-semibold md:flex">
            <span>Etapas da obra</span>
            <span className="font-mono text-xs font-normal text-muted-foreground">{o.etapas.length}</span>
          </div>
          {fase && (
            <Button variant="sinal" size="sm" className="shrink-0 self-start" onClick={() => acao("ui.fase", { fase: "" })}>
              <FilterIcon /> {fase} <XIcon />
            </Button>
          )}
          {CATEGORIAS.filter((c) => !fase || c === fase).map((cat) => {
            const etapas = o.etapas.filter((e) => e.categoria === cat);
            if (!etapas.length) return null;
            return (
              <div key={cat} className="flex shrink-0 flex-row gap-1.5 md:flex-col md:gap-1">
                <p className="mx-1 mt-1 hidden text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground md:block">{cat}</p>
                {etapas.map((e) => {
                  const ativo = sel?.codigo === e.codigo;
                  const st = an.statusEtapa(o, e, hoje);
                  return (
                    <button
                      key={e.codigo}
                      type="button"
                      aria-current={ativo ? "true" : undefined}
                      onClick={() => acao("ui.expandir", { codigo: e.codigo })}
                      className={cn(
                        "grid min-h-[30px] shrink-0 grid-cols-[6px_auto_auto] items-center gap-x-2.5 overflow-hidden whitespace-nowrap rounded-sm border border-transparent bg-muted pr-2 text-left md:w-full md:grid-cols-[6px_2.6rem_1fr_auto]",
                        "hover:border-border",
                        ativo && "border-foreground bg-card shadow-[inset_0_0_0_1px_var(--foreground)]",
                      )}
                    >
                      <span className="block h-full min-h-[30px] w-1.5" style={{ background: corFase(cat) }} />
                      <span className="font-mono text-[0.74rem] text-muted-foreground">{e.codigo}</span>
                      <span className="max-w-[9rem] truncate text-[0.85rem] md:max-w-none">{e.nome}</span>
                      <span className={cn(
                        "hidden font-mono text-[0.72rem] text-muted-foreground md:inline",
                        st === "Concluída" && "font-semibold text-ok", st === "Atrasada" && "font-semibold text-critico",
                        st === "Em andamento" && "font-semibold text-info",
                      )}>{pct(an.progressoEtapa(e))}</span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </Card>
        <Card className="overflow-hidden">
          <Chevrons rotulo="Fases da obra" passos={passos} aoEscolher={(f) => acao("ui.fase_ir", { fase: f })} />
          {sel ? <DetalheEtapa key={sel.codigo} o={o} e={sel} /> : <Nota className="p-4">Nenhuma etapa.</Nota>}
        </Card>
      </div>
    </>
  );
}

function DetalheEtapa({ o, e }: { o: Obra; e: Etapa }) {
  const { sis, acao } = useSistema();
  const enviar = useEnviar();
  const hoje = sis.hoje;
  const st = an.statusEtapa(o, e, hoje);
  const prog = an.progressoEtapa(e);
  const feitos = e.checklist.filter((i) => i.feito).length;
  const todosFeitos = feitos === e.checklist.length && e.checklist.length > 0;
  const pend = an.predecessorasPendentes(o, e);
  const datas = e.inicio_previsto ? `${dataBr(e.inicio_previsto)} – ${dataBr(e.fim_previsto)}` : "sem datas";
  return (
    <article className="flex flex-col">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-b px-4 py-2 text-[0.8rem]">
        <button type="button" className="font-medium hover:underline" onClick={() => acao("etapa.todos", { codigo: e.codigo, feito: todosFeitos ? "0" : "1" })}>
          {todosFeitos ? "Desmarcar todos" : "Marcar todos"}
        </button>
        <button type="button" className="font-medium hover:underline" onClick={() => acao("ui.figura", { codigo: e.codigo, item: "_etapa" })}>
          Detalhe técnico da etapa
        </button>
        {o.inicio && o.fim_previsto && (
          <button type="button" className="font-medium hover:underline" onClick={() => acao("obra.replanejar")}>Recalcular cronograma</button>
        )}
        <span className="ml-auto text-muted-foreground">Exibindo {e.checklist.length} itens</span>
      </div>

      <header className="grid grid-cols-[1fr_auto] items-start gap-3.5 border-b p-4 sm:grid-cols-[auto_1fr_auto]">
        <span className="mt-1 hidden rounded-sm border border-l-4 bg-card px-1.5 py-0.5 font-mono text-[0.68rem] font-semibold text-muted-foreground sm:inline" style={{ borderLeftColor: corFase(e.categoria) }}>
          {e.codigo}
        </span>
        <div className="flex min-w-0 flex-col gap-2">
          <h2 className="text-lg font-bold leading-tight"><span className="font-semibold text-muted-foreground">({e.codigo})</span> {e.nome}</h2>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.8rem] text-muted-foreground">
            <span className="inline-flex items-center gap-1"><FlagIcon className="size-3.5" /> {e.categoria}</span>
            <span className="text-border">|</span><Pill texto={st} />
            <span className="text-border">|</span>
            <span className="inline-flex items-center gap-1"><CalendarIcon className="size-3.5" /> {datas}</span>
            <span className="text-border">|</span>
            <span>{moeda(e.orcamento)} · peso {num(e.peso)}%{e.duracao_dias ? ` · ${e.duracao_dias} dias úteis` : ""}</span>
            {e.observacao && <span className="rounded-sm bg-info px-1.5 text-[0.66rem] font-semibold text-selo-texto">observação</span>}
          </p>
          <Progress value={prog} marca={e.inicio_previsto ? an.fracaoPrevista(e, hoje) : null} />
        </div>
        <span className="text-right text-2xl font-bold leading-none tabular-nums">
          {pct(prog)}<small className="mt-1 block text-[0.72rem] font-normal text-muted-foreground">{feitos}/{e.checklist.length} itens</small>
        </span>
      </header>

      {pend.length > 0 && (
        <p className="px-4 pt-3 text-sm font-semibold text-atencao">Aguardando: {pend.map((p) => an.nomeEtapa(o, p)).join(", ")}</p>
      )}

      <Secao titulo="Checklist de execução e qualidade" contagem={`${feitos}/${e.checklist.length}`}>
        <ul className="flex flex-col border-t">
          {e.checklist.map((i, n) => (
            <li key={i.id} className="flex items-center gap-1 border-b">
              <button
                type="button"
                aria-pressed={i.feito}
                onClick={() => acao("etapa.item", { codigo: e.codigo, item: i.id })}
                className="flex min-h-11 min-w-0 flex-1 items-center gap-3 px-1.5 py-2.5 text-left focus-visible:outline-2"
              >
                <span className={cn("grid size-[18px] shrink-0 place-items-center rounded-[3px] border-[1.5px] border-muted-foreground bg-card", i.feito && "border-ok bg-ok")} aria-hidden>
                  {i.feito && <span className="mb-0.5 h-[9px] w-1 rotate-45 border-b-2 border-r-2 border-white" />}
                </span>
                <span className="hidden shrink-0 rounded-sm border px-1 font-mono text-[0.7rem] text-muted-foreground sm:inline">{String(n + 1).padStart(2, "0")}</span>
                <span className={cn("min-w-0 flex-1 break-words text-[0.88rem]", i.feito && "text-muted-foreground line-through decoration-ok")}>{i.texto}</span>
                {i.feito && <span className="hidden shrink-0 rounded-sm bg-ok px-1.5 font-mono text-[0.7rem] text-selo-texto sm:inline">{dataBr(i.concluido_em)}</span>}
              </button>
              {temFigura(i.texto) && (
                <Button variant="ghost" size="icon-sm" title="Ver imagem de referência" aria-label="Ver imagem de referência" onClick={() => acao("ui.figura", { codigo: e.codigo, item: i.id })}>
                  <ImageIcon />
                </Button>
              )}
              <Button variant="ghost" size="icon-sm" className="hover:bg-critico-suave hover:text-critico" title="Remover item" aria-label="Remover item" onClick={() => acao("etapa.remover_item", { codigo: e.codigo, item: i.id })}>
                <Trash2Icon />
              </Button>
            </li>
          ))}
        </ul>
        <form className="flex flex-wrap gap-2" onSubmit={enviar("etapa.novo_item", { codigo: e.codigo }, { limpar: true })}>
          <Input name="texto" placeholder="Novo item de checklist" aria-label="Novo item de checklist" maxLength={200} required className="min-w-0 flex-[1_1_220px]" />
          <Button type="submit"><PlusIcon /> Adicionar item</Button>
        </form>
      </Secao>

      <Secao titulo="Escopo e especificações técnicas">
        <DetalhesTecnicos o={o} e={e} />
        {e.normas.length > 0 && <Nota>Normas: {e.normas.join(" · ")}</Nota>}
      </Secao>

      <div className="grid grid-cols-1 border-b lg:grid-cols-2">
        <Secao titulo="Observações da etapa" className="border-b lg:border-b-0 lg:border-r">
          <form key={e.observacao} className="flex flex-col items-start gap-2" onSubmit={enviar("etapa.observacao", { codigo: e.codigo })}>
            <Textarea
              name="observacao" rows={3} maxLength={2000} defaultValue={e.observacao}
              placeholder="Ex.: fornecedor, alteração de projeto, condição do terreno, combinado com o cliente…"
              aria-label={`Observações da etapa ${e.nome}`}
            />
            <Button type="submit" variant="outline">Salvar observação</Button>
          </form>
        </Secao>
        <Secao titulo="Prazo e orçamento" className="border-b-0">
          <form
            key={`${e.inicio_previsto}|${e.fim_previsto}|${e.orcamento}`}
            className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,150px),1fr))] items-end gap-2.5"
            onSubmit={enviar("etapa.salvar", { codigo: e.codigo })}
          >
            <Campo rotulo="Início previsto"><Input type="date" name="inicio_previsto" defaultValue={e.inicio_previsto} /></Campo>
            <Campo rotulo="Fim previsto"><Input type="date" name="fim_previsto" defaultValue={e.fim_previsto} /></Campo>
            <Campo rotulo="Orçamento (R$)" className="col-span-full"><CampoNumero name="orcamento" valor={e.orcamento} placeholder="0,00" /></Campo>
            <Button type="submit" variant="outline">Salvar etapa</Button>
          </form>
        </Secao>
      </div>
      <BlocoIa o={o} escopo="etapa" codigo={e.codigo} />
    </article>
  );
}

function qtdEscalada(qtd: number, un: string, area: number): string {
  let v = (qtd * (area || 100)) / 100;
  if (["un", "vb", "mês"].includes(un)) v = Math.max(1, Math.round(v));
  else if (v >= 10) v = Math.round(v);
  else v = Math.round(v * 10) / 10;
  return num(v);
}

function DetalhesTecnicos({ o, e }: { o: Obra; e: Etapa }) {
  if (!(e.descricao || e.servicos.length || e.equipe || e.atencao.length)) return null;
  const area = o.area_construida || 100;
  const seq = e.predecessoras.map((p) => an.nomeEtapa(o, p)).join(", ") || "início da obra";
  return (
    <>
      {e.descricao && <p className="max-w-[80ch] text-sm text-muted-foreground">{e.descricao}</p>}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))] gap-2.5">
        {e.servicos.length > 0 && (
          <div className="col-span-full rounded-md border p-3">
            <h4 className="mb-1.5 text-[0.74rem] font-semibold text-muted-foreground">
              Serviços, quantitativos e especificações técnicas · {num(area)} m²
            </h4>
            <ul className="flex flex-col">
              {e.servicos.map((s) => {
                const qtd = `${qtdEscalada(s.qtd, s.un, area)} ${s.un}`;
                const spec = especificacao(e.codigo, s.servico);
                return (
                  <li key={s.servico} className="border-b last:border-b-0">
                    {spec ? (
                      <details className="group">
                        <summary className="grid cursor-pointer list-none grid-cols-[1fr_auto] gap-2.5 py-1.5 pl-4 text-[0.9rem] marker:hidden before:absolute before:-ml-4 before:text-info before:content-['▸'] group-open:before:content-['▾'] [&::-webkit-details-marker]:hidden relative">
                          <span>{s.servico}</span><span className="whitespace-nowrap font-mono tabular-nums">{qtd}</span>
                        </summary>
                        <dl className="grid grid-cols-1 gap-x-2.5 gap-y-1 pb-2.5 pl-4 text-[0.86rem] sm:grid-cols-[7.5rem_1fr]">
                          <dt className="font-semibold text-muted-foreground">Especificação</dt><dd>{spec.especificacao}</dd>
                          <dt className="font-semibold text-muted-foreground">Execução</dt><dd>{spec.execucao}</dd>
                          <dt className="font-semibold text-muted-foreground">Aceitação</dt><dd>{spec.aceitacao}</dd>
                        </dl>
                      </details>
                    ) : (
                      <div className="grid grid-cols-[1fr_auto] gap-2.5 py-1.5 pl-4 text-[0.9rem]"><span>{s.servico}</span><span className="font-mono">{qtd}</span></div>
                    )}
                  </li>
                );
              })}
            </ul>
            <Nota className="mt-1.5">Toque em um serviço para ver especificação, execução e critério de aceitação. Quantidades estimadas; o projeto e o memorial descritivo prevalecem.</Nota>
          </div>
        )}
        <div className="rounded-md bg-muted p-3">
          <h4 className="mb-1.5 text-[0.74rem] font-semibold text-muted-foreground">Equipe e prazo</h4>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[0.86rem]">
            <dt className="text-muted-foreground">Equipe</dt><dd>{e.equipe || "—"}</dd>
            <dt className="text-muted-foreground">Duração</dt><dd>{e.duracao_dias ? `${e.duracao_dias} dias úteis (típico)` : "—"}</dd>
            <dt className="text-muted-foreground">Começa após</dt><dd>{seq}</dd>
          </dl>
        </div>
        {e.atencao.length > 0 && (
          <div className="rounded-md bg-atencao-suave p-3">
            <h4 className="mb-1.5 text-[0.74rem] font-semibold text-atencao">Pontos de atenção</h4>
            <ul className="flex list-disc flex-col gap-1 pl-4 text-[0.86rem]">{e.atencao.map((a) => <li key={a}>{a}</li>)}</ul>
          </div>
        )}
      </div>
    </>
  );
}
