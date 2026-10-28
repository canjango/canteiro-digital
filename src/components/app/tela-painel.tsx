"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import * as an from "@/lib/core/analise";
import { CUB_ESTADOS } from "@/lib/core/catalogo";
import type { Obra } from "@/lib/core/modelos";
import { moeda, num, pct } from "@/lib/core/util";
import { cn } from "@/lib/utils";
import { Chevrons, Nota, Pill, type Passo } from "./comum";
import { useSistema } from "./provedor";
import { BlocoIa } from "./revisao-ia";

const COR_ALERTA = { critico: "bg-critico", atencao: "bg-atencao", info: "bg-info" } as const;

export function TelaPainel() {
  const { sis, acao } = useSistema();
  const o = sis.obra!;
  const r = an.resumo(o, sis.hoje);
  const fin = r.financeiro;
  const indice = r.idp;
  const idpCls = indice === null ? "" : indice >= 0.95 ? "ok" : indice >= 0.8 ? "atencao" : "critico";
  const uso = fin.uso;
  const usoCls = uso === null ? "" : uso > 1 ? "critico" : uso > 0.9 ? "atencao" : "ok";

  const fases = [...r.fases.entries()];
  const atual = fases.find(([, g]) => g.progresso < 1)?.[0];
  const passos: Passo[] = fases.map(([cat, g]) => ({
    rotulo: cat, sub: pct(g.progresso), valor: cat,
    estado: g.progresso >= 1 ? "feita" : cat === atual ? "atual" : "",
  }));

  const custosEtapa = an.custosPorEtapa(o);
  const tot = {
    orcado: custosEtapa.reduce((s, l) => s + l.orcado, 0),
    executado: custosEtapa.reduce((s, l) => s + l.executado, 0),
    a_executar: custosEtapa.reduce((s, l) => s + l.a_executar, 0),
    comprometido: custosEtapa.reduce((s, l) => s + l.comprometido, 0),
    saldo: custosEtapa.reduce((s, l) => s + l.saldo, 0),
  };
  const cats = [...r.custos_categoria.entries()].filter(([, v]) => v);
  const maior = Math.max(...cats.map(([, v]) => v), 1);

  return (
    <>
      <Card className="overflow-hidden">
        <Chevrons rotulo="Fases da obra" passos={passos} aoEscolher={(fase) => acao("ui.fase_ir", { fase })} />
      </Card>

      <section className="grid grid-cols-[repeat(auto-fit,minmax(210px,1fr))] gap-3">
        <Kpi rotulo="Avanço físico" valor={pct(r.progresso_fisico)} sub={`previsto hoje: ${pct(r.progresso_previsto)}`}>
          <Progress value={r.progresso_fisico} marca={r.progresso_previsto} />
        </Kpi>
        <Kpi
          rotulo="IDP (prazo)" valor={indice === null ? "—" : indice.toFixed(2).replace(".", ",")} cls={idpCls}
          sub={idpCls === "ok" ? "no prazo" : idpCls === "atencao" ? "atenção ao ritmo" : idpCls === "critico" ? "atrasada" : "sem previsão ainda"}
        />
        <Kpi
          rotulo="Executado (medição)" valor={moeda(fin.executado)}
          sub={<>
            {pct(fin.executado_pct)} do orçado · a executar {moeda(fin.a_executar)}
            {fin.bdi ? <> · com BDI {num(fin.bdi)}%: <b>{moeda(fin.executado_bdi)}</b></> : null}
          </>}
        >
          <Progress value={fin.executado_pct ?? 0} />
        </Kpi>
        <Kpi
          rotulo="Comprometido em compras" valor={moeda(fin.comprometido)} cls={usoCls}
          sub={`${pct(uso)} de ${moeda(fin.orcado)} · entregue ${moeda(fin.realizado)}`}
        >
          <Progress value={uso ?? 0} cor="bg-foreground" />
        </Kpi>
      </section>

      <BlocoIa o={o} escopo="obra" comoCartao />

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,420px),1fr))] items-start gap-4">
        <Card>
          <CardHeader><CardTitle>Alertas <span className="font-mono text-xs font-normal text-muted-foreground">{r.alertas.length}</span></CardTitle></CardHeader>
          <CardContent>
            {r.alertas.length ? (
              <ul className="flex flex-col">
                {r.alertas.slice(0, 12).map((a, i) => (
                  <li key={i} className="relative border-b last:border-b-0">
                    <span className={cn("absolute left-0 top-2.5 size-2 rounded-sm", COR_ALERTA[a.nivel])} aria-hidden />
                    <button type="button" className="flex w-full flex-col gap-px py-1.5 pl-[18px] text-left hover:[&>b]:underline" onClick={() => acao("ui.aba", { aba: a.aba })}>
                      <b className="text-[0.86rem] font-semibold">{a.titulo}</b>
                      <span className="text-[0.78rem] text-muted-foreground">{a.detalhe}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <Nota>Nenhum alerta. Compras, tarefas e etapas em dia.</Nota>
            )}
            {r.alertas.length > 12 && <Nota className="mt-2">+ {r.alertas.length - 12} alerta(s)</Nota>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Avanço por fase</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-2">
            {fases.map(([cat, g]) => (
              <LinhaBarra key={cat} rotulo={cat} valor={g.progresso} direita={<>{pct(g.progresso)}<small className="block text-[0.7rem] text-muted-foreground">{moeda(g.executado)}</small></>} />
            ))}
            <Contagens mapa={r.status_etapas} />
          </CardContent>
        </Card>

        <BlocoPadrao o={o} />

        <Card>
          <CardHeader><CardTitle>Custos comprometidos por categoria</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-2">
            {cats.length ? cats.map(([k, v]) => (
              <LinhaBarra key={k} rotulo={k} valor={v / maior} cor="bg-foreground" direita={moeda(v)} />
            )) : <Nota>Nenhuma compra aprovada ainda.</Nota>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Compras e tarefas</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-2">
            <h3 className="text-xs font-semibold text-muted-foreground">Compras por situação</h3>
            <Contagens mapa={r.compras_status} vazio="Nenhuma compra" />
            <h3 className="mt-2 text-xs font-semibold text-muted-foreground">Tarefas por situação</h3>
            <Contagens mapa={r.tarefas_status} vazio="Nenhuma tarefa" />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Medição físico-financeira por etapa</CardTitle>
          <Nota>
            Executado = orçado da etapa × avanço do checklist (custo direto). Medição c/ BDI = executado + BDI, valor a faturar ao cliente.
            Comprometido = compras aprovadas, pedidas ou entregues. Saldo = orçado − comprometido.
          </Nota>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Etapa</TableHead><TableHead>Avanço</TableHead><TableHead>Orçado</TableHead><TableHead>Executado</TableHead>
                {o.bdi ? <TableHead>Medição c/ BDI {num(o.bdi)}%</TableHead> : null}
                <TableHead>A executar</TableHead><TableHead>Comprometido</TableHead><TableHead>Saldo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {custosEtapa.map((l) => (
                <TableRow key={l.codigo}>
                  <TableCell><span className="font-mono text-xs text-muted-foreground">{l.codigo}</span> {l.nome}</TableCell>
                  <TableCell className="text-right font-mono">{pct(l.progresso)}</TableCell>
                  <TableCell className="text-right font-mono">{moeda(l.orcado)}</TableCell>
                  <TableCell className={cn("text-right font-mono", l.executado && "font-semibold text-ok")}>{moeda(l.executado)}</TableCell>
                  {o.bdi ? <TableCell className="text-right font-mono">{moeda(l.executado_bdi)}</TableCell> : null}
                  <TableCell className="text-right font-mono">{moeda(l.a_executar)}</TableCell>
                  <TableCell className="text-right font-mono">{moeda(l.comprometido)}</TableCell>
                  <TableCell className={cn("text-right font-mono", l.saldo < 0 && "text-critico")}>{moeda(l.saldo)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell>Total da obra</TableCell>
                <TableCell className="text-right font-mono">{pct(tot.orcado ? tot.executado / tot.orcado : null)}</TableCell>
                <TableCell className="text-right font-mono">{moeda(tot.orcado)}</TableCell>
                <TableCell className="text-right font-mono">{moeda(tot.executado)}</TableCell>
                {o.bdi ? <TableCell className="text-right font-mono">{moeda(an.comBdi(o, tot.executado))}</TableCell> : null}
                <TableCell className="text-right font-mono">{moeda(tot.a_executar)}</TableCell>
                <TableCell className="text-right font-mono">{moeda(tot.comprometido)}</TableCell>
                <TableCell className={cn("text-right font-mono", tot.saldo < 0 && "text-critico")}>{moeda(tot.saldo)}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}

function Kpi({ rotulo, valor, sub, cls = "", children }: { rotulo: string; valor: string; sub: React.ReactNode; cls?: string; children?: React.ReactNode }) {
  const barra = { ok: "before:bg-ok", atencao: "before:bg-atencao", critico: "before:bg-critico", "": "before:bg-border" }[cls];
  return (
    <Card className={cn("relative gap-1.5 px-4 py-3.5 before:absolute before:-left-px before:top-3.5 before:bottom-3.5 before:w-[3px] before:rounded-r", barra)}>
      <span className="text-xs font-medium text-muted-foreground">{rotulo}</span>
      <span className="break-words text-2xl font-bold tabular-nums tracking-tight">{valor}</span>
      {children}
      <span className="text-[0.76rem] text-muted-foreground">{sub}</span>
    </Card>
  );
}

function LinhaBarra({ rotulo, valor, direita, cor }: { rotulo: string; valor: number; direita: React.ReactNode; cor?: string }) {
  return (
    <div className="grid grid-cols-[minmax(0,6rem)_1fr_7.5rem] items-center gap-2.5 text-[0.86rem] sm:grid-cols-[minmax(0,9.5rem)_1fr_8.5rem]">
      <span className="truncate">{rotulo}</span>
      <Progress value={valor} cor={cor} />
      <span className="text-right font-mono text-[0.78rem] tabular-nums">{direita}</span>
    </div>
  );
}

function Contagens({ mapa, vazio }: { mapa: Map<string, number>; vazio?: string }) {
  const itens = [...mapa.entries()].filter(([, v]) => v);
  if (!itens.length) return <Nota>{vazio ?? "—"}</Nota>;
  return (
    <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-2">
      {itens.map(([k, v]) => (
        <li key={k} className="flex items-center gap-1.5 font-mono text-sm"><Pill texto={k} /><b>{v}</b></li>
      ))}
    </ul>
  );
}

/** Padrão construtivo × orçamento (custo direto) e preço de venda com BDI. */
export function BlocoPadrao({ o, comAcao = false }: { o: Obra; comAcao?: boolean }) {
  const { acao } = useSistema();
  const p = an.resumoPadrao(o);
  const dif = p.diferenca;
  const mes = CUB_ESTADOS[p.uf]?.[2] ?? "";
  const origem = p.valor_proprio ? "valor próprio" : `CUB-${p.uf} ${mes}`;
  let comp: React.ReactNode;
  if (dif === null) comp = <Nota>Informe o orçamento para comparar com o padrão.</Nota>;
  else {
    const cls = dif < -0.2 ? "text-critico" : Math.abs(dif) > 0.1 ? "text-atencao" : "text-ok";
    comp = (
      <p className={cn("font-semibold", Math.abs(dif) < 0.005 ? "text-ok" : cls)}>
        {Math.abs(dif) < 0.005 ? "Orçamento igual ao custo pelo padrão" : `Orçamento ${pct(Math.abs(dif))} ${dif > 0 ? "acima" : "abaixo"} do custo pelo padrão`}
      </p>
    );
  }
  const linhas: [string, React.ReactNode][] = [
    ["Padrão", <b key="p">{p.rotulo}</b>],
    ["Valor do m²", <>{moeda(p.valor_m2)}/m² <span className="text-muted-foreground">({origem})</span></>],
    ["Área", `${num(p.area)} m²`],
    ["Custo pelo padrão", <b key="c">{moeda(p.estimado)}</b>],
    ["Orçamento (custo direto)", <>{moeda(p.orcado)}{p.orcado_m2 ? ` · ${moeda(p.orcado_m2)}/m²` : ""}</>],
    ["BDI", `${num(p.bdi)}% · ${moeda(p.valor_bdi)}`],
    ["Preço de venda", <><b>{moeda(p.preco_venda)}</b>{p.preco_venda_m2 ? ` · ${moeda(p.preco_venda_m2)}/m²` : ""}</>],
  ];
  return (
    <Card>
      <CardHeader><CardTitle>Padrão construtivo</CardTitle></CardHeader>
      <CardContent className="flex flex-col gap-2">
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[0.86rem]">
          {linhas.map(([k, v]) => (
            <React.Fragment key={k}><dt className="text-muted-foreground">{k}</dt><dd className="min-w-0 tabular-nums">{v}</dd></React.Fragment>
          ))}
        </dl>
        {comp}
        <Nota>
          A comparação é feita no custo direto (orçamento × CUB), sem BDI dos dois lados. O CUB não inclui terreno, projetos e taxas,
          fundações e paisagismo; o BDI é somado à parte para chegar ao preço de venda.
          {!p.bdi && <b> Esta obra está sem BDI — informe em Obras.</b>}
        </Nota>
        {comAcao && Math.abs(p.estimado - p.orcado) >= 0.01 && p.estimado > 0 && (
          <Button variant="outline" className="self-start" onClick={() => acao("obra.orcamento_padrao")}>
            Usar {moeda(p.estimado)} como orçamento
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
