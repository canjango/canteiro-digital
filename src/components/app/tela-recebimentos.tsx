"use client";

import * as React from "react";
import { CheckIcon, Undo2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import * as an from "@/lib/core/analise";
import * as md from "@/lib/core/modulos";
import { dataBr, moeda, pct, valorBr } from "@/lib/core/util";
import { cn } from "@/lib/utils";
import { Campo, CampoNumero, Nota, Pill } from "./comum";
import { BarraModulo, BotaoExcluir, GRADE_FORM, Indicadores, Vazio } from "./modulo-comum";
import { useEnviar, useSistema } from "./provedor";

const FORMAS = ["PIX", "Transferência", "Boleto", "Dinheiro", "Cheque", "Cartão"];

export function TelaRecebimentos() {
  const { sis, acao } = useSistema();
  const o = sis.obra!;
  const enviar = useEnviar();
  const [filtro, setFiltro] = React.useState("todos");
  const contratado = an.precoVenda(o);
  const r = md.resumoRecebimentos(o, contratado, sis.hoje);
  const lista = o.recebimentos
    .filter((x) => filtro === "todos" || (filtro === "atrasados" ? x.status === "Previsto" && x.vencimento < sis.hoje : x.status === filtro))
    .sort((a, b) => a.vencimento.localeCompare(b.vencimento));
  return (
    <>
      <BarraModulo
        texto={<>Contas a receber do cliente: parcelas do contrato, adiantamentos, aditivos e as parcelas geradas pelas medições aprovadas. Valor contratado = orçamento com BDI ({moeda(contratado)}).</>}
      >
        <Button variant={sis.ui.novo === "parcelas" ? "outline" : "default"} onClick={() => acao("ui.novo", { qual: "parcelas" })}>Gerar parcelas</Button>
        <Button variant="outline" onClick={() => acao("ui.novo", { qual: "recebimento" })}>{sis.ui.novo === "recebimento" ? "Fechar" : "Lançamento avulso"}</Button>
      </BarraModulo>
      <Indicadores
        itens={[
          { rotulo: "Contratado (c/ BDI)", valor: moeda(r.contratado), sub: r.sem_parcela > 0.005 ? `${moeda(r.sem_parcela)} ainda sem parcela` : "100% parcelado" },
          { rotulo: "Recebido", valor: moeda(r.recebido), sub: r.contratado ? `${pct(r.recebido / r.contratado)} do contrato` : undefined, tom: "ok" },
          { rotulo: "A receber", valor: moeda(r.a_receber) },
          { rotulo: "Em atraso", valor: moeda(r.atrasado), sub: `${r.n_atrasados} parcela(s)`, tom: r.n_atrasados ? "critico" : undefined },
        ]}
      />
      {r.contratado > 0 && (
        <Card className="gap-1.5 p-3.5">
          <div className="flex justify-between text-[0.8rem]"><span>Recebido × avanço físico</span><span className="font-mono">{pct(r.recebido / r.contratado)} × {pct(an.progressoFisico(o))}</span></div>
          <Progress value={r.recebido / r.contratado} marca={an.progressoFisico(o)} />
          <Nota className="text-[0.76rem]">
            {r.recebido / r.contratado + 0.05 < an.progressoFisico(o)
              ? "A obra está à frente do que foi recebido: o caixa está financiando a execução. Cobre as parcelas ou faça uma medição."
              : "Recebimentos acompanhando o avanço físico."}
          </Nota>
        </Card>
      )}
      {sis.ui.novo === "parcelas" && (
        <Card className="p-4">
          <h3 className="font-semibold">Gerar parcelas mensais</h3>
          <form className={GRADE_FORM} onSubmit={enviar("rec.parcelas")}>
            <Campo rotulo="Descrição"><Input name="descricao" maxLength={120} defaultValue="Parcela do contrato" /></Campo>
            <Campo rotulo="Valor total (R$)"><CampoNumero name="total" texto={valorBr(r.sem_parcela || r.contratado)} /></Campo>
            <Campo rotulo="Nº de parcelas"><Input name="parcelas" type="number" min={1} max={120} defaultValue={6} /></Campo>
            <Campo rotulo="1º vencimento"><Input name="primeira" type="date" required defaultValue={sis.hoje} /></Campo>
            <Button type="submit">Gerar</Button>
          </form>
          <Nota className="text-[0.76rem]">Valores iguais; os centavos que sobram entram na última parcela.</Nota>
        </Card>
      )}
      {sis.ui.novo === "recebimento" && (
        <Card className="p-4">
          <h3 className="font-semibold">Lançamento avulso</h3>
          <form className={GRADE_FORM} onSubmit={enviar("rec.criar", {}, { limpar: true })}>
            <Campo rotulo="Descrição" className="col-span-full"><Input name="descricao" required maxLength={200} placeholder="Ex.: Sinal na assinatura" /></Campo>
            <Campo rotulo="Origem"><NativeSelect name="origem" defaultValue="Adiantamento">{md.ORIGENS_RECEBIMENTO.map((x) => <option key={x}>{x}</option>)}</NativeSelect></Campo>
            <Campo rotulo="Valor (R$)"><CampoNumero name="valor" required /></Campo>
            <Campo rotulo="Vencimento"><Input name="vencimento" type="date" required /></Campo>
            <Campo rotulo="Observação"><Input name="observacao" maxLength={300} /></Campo>
            <Button type="submit">Lançar</Button>
          </form>
        </Card>
      )}
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar recebimentos">
        {[["todos", "Todos"], ["Previsto", "A receber"], ["atrasados", "Em atraso"], ["Recebido", "Recebidos"]].map(([v, rot]) => (
          <Button key={v} size="sm" variant={filtro === v ? "default" : "outline"} aria-pressed={filtro === v} onClick={() => setFiltro(v)}>{rot}</Button>
        ))}
      </div>
      {lista.length ? (
        <Card className="gap-0 overflow-hidden p-0">
          <div className="overflow-x-auto">
            <Table className="text-[0.82rem]">
              <TableHeader>
                <TableRow>
                  <TableHead>Vencimento</TableHead><TableHead>Descrição</TableHead><TableHead className="text-right">Valor</TableHead>
                  <TableHead>Situação</TableHead><TableHead className="w-px">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lista.map((x) => {
                  const atrasado = x.status === "Previsto" && x.vencimento < sis.hoje;
                  const baixando = sis.ui.editando === x.id;
                  return (
                    <React.Fragment key={x.id}>
                      <TableRow className={cn(atrasado && "[&>td:first-child]:text-critico [&>td:first-child]:font-semibold")}>
                        <TableCell className="font-mono">{dataBr(x.vencimento)}</TableCell>
                        <TableCell className="whitespace-normal">
                          {x.descricao}
                          <span className="block text-[0.72rem] text-muted-foreground">{x.origem}{x.observacao ? ` · ${x.observacao}` : ""}</span>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {moeda(x.valor)}
                          {x.status === "Recebido" && Math.abs(x.valor_recebido - x.valor) > 0.005 && (
                            <span className="block text-[0.72rem] text-muted-foreground">recebido {moeda(x.valor_recebido)}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Pill texto={atrasado ? "Atrasada" : x.status} />
                          {x.status === "Recebido" && <span className="block text-[0.72rem] text-muted-foreground">{dataBr(x.recebido_em)}{x.forma ? ` · ${x.forma}` : ""}</span>}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {x.status === "Previsto" ? (
                              <Button size="sm" variant={baixando ? "outline" : "default"} onClick={() => acao("ui.editar", { id: x.id })}><CheckIcon />Receber</Button>
                            ) : (
                              <Button size="sm" variant="outline" onClick={() => acao("rec.estornar", { id: x.id })}><Undo2Icon />Estornar</Button>
                            )}
                            {x.status === "Previsto" && <BotaoExcluir acaoNome="rec.remover" id={x.id} rotulo="×" pergunta="Excluir?" />}
                          </div>
                        </TableCell>
                      </TableRow>
                      {baixando && (
                        <TableRow>
                          <TableCell colSpan={5} className="whitespace-normal bg-muted">
                            <form className={GRADE_FORM} onSubmit={enviar("rec.baixar", { id: x.id })}>
                              <Campo rotulo="Recebido em"><Input name="recebido_em" type="date" defaultValue={sis.hoje} /></Campo>
                              <Campo rotulo="Valor recebido (R$)"><CampoNumero name="valor_recebido" texto={valorBr(x.valor)} /></Campo>
                              <Campo rotulo="Forma"><NativeSelect name="forma" defaultValue="PIX">{FORMAS.map((f) => <option key={f}>{f}</option>)}</NativeSelect></Campo>
                              <Button type="submit"><CheckIcon />Confirmar recebimento</Button>
                            </form>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      ) : (
        <Vazio>{o.recebimentos.length ? "Nada neste filtro." : "Nenhum recebimento lançado. Gere as parcelas do contrato ou aprove uma medição."}</Vazio>
      )}
    </>
  );
}
