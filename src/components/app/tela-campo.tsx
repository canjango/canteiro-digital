"use client";

import * as React from "react";
import { CloudIcon, CloudRainIcon, HardHatIcon, PencilIcon, SunIcon, UsersIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import * as an from "@/lib/core/analise";
import type { Obra } from "@/lib/core/modelos";
import * as md from "@/lib/core/modulos";
import { dataBr, moeda, num, pct } from "@/lib/core/util";
import { cn } from "@/lib/utils";
import { Campo, CampoNumero, Nota, Pill, corFase } from "./comum";
import { BarraModulo, BotaoExcluir, GRADE_FORM, Indicadores, Vazio } from "./modulo-comum";
import { useEnviar, useSistema } from "./provedor";

/** % já em escala 0–100 (medição) */
const p100 = (x: number) => `${num(x)}%`;

const DIAS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const diaSemana = (iso: string) => DIAS[new Date(`${iso}T12:00:00`).getDay()] ?? "";

function IconeClima({ clima, className }: { clima: string; className?: string }) {
  const C = clima.startsWith("Chuva") ? CloudRainIcon : clima === "Nublado" ? CloudIcon : SunIcon;
  return <C className={cn("size-4", clima.startsWith("Chuva") ? "text-info" : clima === "Nublado" ? "text-muted-foreground" : "text-atencao", className)} aria-label={clima} />;
}

// ================================================================ diário de obra (RDO)
export function TelaDiario() {
  const { sis, acao } = useSistema();
  const o = sis.obra!;
  const r = md.resumoDiario(o);
  const lista = [...o.diario].sort((a, b) => b.data.localeCompare(a.data));
  const hojeFeito = o.diario.some((x) => x.data === sis.hoje);
  return (
    <>
      <BarraModulo
        texto="Relatório diário de obra (RDO): clima, condição de trabalho, efetivo, equipamentos, atividades e ocorrências. Um registro por dia."
        qual="diario"
        rotuloNovo={hojeFeito ? "Novo registro" : "Registrar o dia de hoje"}
      />
      <Indicadores
        itens={[
          { rotulo: "Dias registrados", valor: String(r.dias), sub: hojeFeito ? "hoje já registrado" : "hoje ainda sem registro", tom: hojeFeito ? "ok" : "atencao" },
          { rotulo: "Dias com chuva", valor: String(r.chuva), sub: `${r.impraticaveis} impraticável(is)` },
          { rotulo: "Homens-dia", valor: num(r.homens_dia), sub: `média ${num(Math.round(r.media_efetivo * 10) / 10)} por dia` },
        ]}
      />
      {sis.ui.novo === "diario" && <FormDiario o={o} base={lista[0]} />}
      {lista.length ? (
        <div className="flex flex-col gap-2.5">
          {lista.map((x) =>
            sis.ui.editando === x.id ? (
              <FormDiario key={x.id} o={o} d={x} />
            ) : (
              <Card key={x.id} className="gap-2 p-3.5">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <h3 className="font-semibold">{dataBr(x.data)} <span className="font-normal text-muted-foreground">· {diaSemana(x.data)}</span></h3>
                  <span className="inline-flex items-center gap-1 text-[0.8rem]"><IconeClima clima={x.clima_manha} />manhã {x.clima_manha.toLowerCase()}</span>
                  <span className="inline-flex items-center gap-1 text-[0.8rem]"><IconeClima clima={x.clima_tarde} />tarde {x.clima_tarde.toLowerCase()}</span>
                  <Pill texto={x.condicao} />
                  {x.responsavel && <span className="text-[0.78rem] text-muted-foreground">por {x.responsavel}</span>}
                </div>
                {x.efetivo.length > 0 && (
                  <p className="flex flex-wrap items-center gap-1.5 text-[0.8rem]">
                    <UsersIcon className="size-4 text-muted-foreground" />
                    {x.efetivo.map((e, k) => <span key={k} className="rounded-sm bg-muted px-1.5">{e.funcao} <b className="font-mono">{num(e.quantidade)}</b></span>)}
                    <span className="text-muted-foreground">= {num(x.efetivo.reduce((s, e) => s + e.quantidade, 0))}</span>
                  </p>
                )}
                {x.etapas.length > 0 && (
                  <p className="flex flex-wrap gap-1.5 text-[0.76rem]">
                    {x.etapas.map((c) => {
                      const e = o.etapas.find((y) => y.codigo === c);
                      return (
                        <span key={c} className="inline-flex items-center gap-1 rounded-sm border px-1.5">
                          <span className="size-2 rounded-[2px]" style={{ background: corFase(e?.categoria ?? "") }} />{c} · {e?.nome ?? c}
                        </span>
                      );
                    })}
                  </p>
                )}
                <p className="whitespace-pre-line text-[0.86rem]">{x.atividades}</p>
                {x.equipamentos && <Nota><HardHatIcon className="mr-1 inline size-3.5" />Equipamentos: {x.equipamentos}</Nota>}
                {x.ocorrencias && <p className="whitespace-pre-line rounded-md border-l-4 border-l-atencao bg-muted px-2.5 py-1.5 text-[0.82rem]"><b>Ocorrências:</b> {x.ocorrencias}</p>}
                {x.observacoes && <Nota className="whitespace-pre-line">{x.observacoes}</Nota>}
                <div className="flex flex-wrap items-center gap-3">
                  <Button variant="link" size="sm" className="px-0 underline" onClick={() => acao("ui.editar", { id: x.id })}><PencilIcon />Editar</Button>
                  <BotaoExcluir acaoNome="rdo.remover" id={x.id} pergunta={`Excluir o diário de ${dataBr(x.data)}?`} />
                </div>
              </Card>
            ),
          )}
        </div>
      ) : (
        <Vazio>Nenhum diário registrado. Registre o dia de hoje — leva menos de um minuto.</Vazio>
      )}
    </>
  );
}

const efetivoTexto = (d?: md.Diario) => (d?.efetivo ?? []).map((e) => `${e.funcao} ${num(e.quantidade)}`).join("\n");

function FormDiario({ o, d, base }: { o: Obra; d?: md.Diario; base?: md.Diario }) {
  const { sis, acao } = useSistema();
  const enviar = useEnviar();
  // sugestão: etapas em andamento hoje; efetivo e equipamentos do último registro
  const andamento = o.etapas.filter((e) => ["Em andamento", "Atrasada"].includes(an.statusEtapa(o, e, sis.hoje))).map((e) => e.codigo);
  const [etapas, setEtapas] = React.useState<string[]>(d?.etapas ?? andamento);
  const alternar = (c: string) => setEtapas((v) => (v.includes(c) ? v.filter((x) => x !== c) : [...v, c]));
  const usadas = o.diario.map((x) => x.data);
  const dataInicial = d?.data ?? (usadas.includes(sis.hoje) ? "" : sis.hoje);
  return (
    <Card className="p-4">
      <h3 className="font-semibold">{d ? `Editar diário de ${dataBr(d.data)}` : "Novo diário de obra"}</h3>
      <form className={GRADE_FORM} onSubmit={enviar("rdo.salvar", d ? { id: d.id } : {})}>
        <Campo rotulo="Data"><Input name="data" type="date" required defaultValue={dataInicial} /></Campo>
        <Campo rotulo="Clima — manhã"><NativeSelect name="clima_manha" defaultValue={d?.clima_manha || "Bom"}>{md.CLIMAS.map((c) => <option key={c}>{c}</option>)}</NativeSelect></Campo>
        <Campo rotulo="Clima — tarde"><NativeSelect name="clima_tarde" defaultValue={d?.clima_tarde || "Bom"}>{md.CLIMAS.map((c) => <option key={c}>{c}</option>)}</NativeSelect></Campo>
        <Campo rotulo="Condição de trabalho"><NativeSelect name="condicao" defaultValue={d?.condicao || "Praticável"}>{md.CONDICOES_TRABALHO.map((c) => <option key={c}>{c}</option>)}</NativeSelect></Campo>
        <Campo rotulo="Responsável pelo registro"><Input name="responsavel" maxLength={80} defaultValue={d?.responsavel ?? base?.responsavel} /></Campo>
        <Campo rotulo="Atividades executadas" className="col-span-full">
          <Textarea name="atividades" rows={3} required maxLength={3000} defaultValue={d?.atividades} placeholder="Ex.: Elevação da alvenaria do pavimento térreo, eixo A–C" />
        </Campo>
        <fieldset className="col-span-full flex flex-col gap-1.5">
          <legend className="mb-1 text-xs font-medium text-muted-foreground">Etapas trabalhadas</legend>
          <input type="hidden" name="etapas" value={etapas.join(",")} />
          <div className="flex flex-wrap gap-1.5">
            {o.etapas.map((e) => {
              const marcada = etapas.includes(e.codigo);
              return (
                <button
                  key={e.codigo}
                  type="button"
                  aria-pressed={marcada}
                  onClick={() => alternar(e.codigo)}
                  className={cn("inline-flex items-center gap-1 rounded-sm border px-2 py-1 text-[0.76rem]", marcada ? "border-foreground bg-foreground text-background" : "hover:bg-muted")}
                >
                  <span className="size-2 rounded-[2px]" style={{ background: corFase(e.categoria) }} />{e.codigo} · {e.nome}
                </button>
              );
            })}
          </div>
        </fieldset>
        <Campo rotulo="Efetivo (função e quantidade, um por linha)">
          <Textarea name="efetivo" rows={4} defaultValue={d ? efetivoTexto(d) : efetivoTexto(base)} placeholder={"Pedreiro 3\nServente 4\nEletricista 1"} className="font-mono text-[0.8rem]" />
        </Campo>
        <Campo rotulo="Equipamentos no canteiro"><Textarea name="equipamentos" rows={4} maxLength={1000} defaultValue={d?.equipamentos ?? base?.equipamentos} placeholder="Betoneira 400 L, andaime 20 m…" /></Campo>
        <Campo rotulo="Ocorrências (acidentes, paralisações, visitas, entregas)" className="col-span-full"><Textarea name="ocorrencias" rows={2} maxLength={3000} defaultValue={d?.ocorrencias} /></Campo>
        <Campo rotulo="Observações" className="col-span-full"><Textarea name="observacoes" rows={2} maxLength={1000} defaultValue={d?.observacoes} /></Campo>
        <div className="flex gap-2">
          <Button type="submit">{d ? "Salvar" : "Registrar diário"}</Button>
          <Button type="button" variant="outline" onClick={() => (d ? acao("ui.editar", { id: d.id }) : acao("ui.novo", { qual: "diario" }))}>Cancelar</Button>
        </div>
      </form>
      {!d && base && <Nota className="text-[0.76rem]">Efetivo e equipamentos vieram do último registro ({dataBr(base.data)}); ajuste o que mudou.</Nota>}
    </Card>
  );
}

// ================================================================ medição de obra
export function TelaMedicoes() {
  const { sis, acao } = useSistema();
  const o = sis.obra!;
  const enviar = useEnviar();
  const lista = [...o.medicoes].sort((a, b) => b.numero - a.numero);
  const aprovadas = lista.filter((m) => m.status === "Aprovada");
  const ultima = aprovadas[0];
  const acumulado = ultima ? md.calcularMedicao(o, ultima).acumulado : 0;
  const totalMedidoBdi = aprovadas.reduce((s, m) => s + md.calcularMedicao(o, m).total_bdi, 0);
  const emElaboracao = lista.find((m) => m.status === "Em elaboração");
  return (
    <>
      <BarraModulo texto="Boletim de medição por etapa: o % acumulado medido, descontado o que já foi medido antes, dá o valor do período. Ao aprovar, a parcela (com BDI) vai para Recebimentos.">
        {!emElaboracao && (
          <form className="flex flex-wrap items-end gap-2" onSubmit={enviar("med.criar")}>
            <Campo rotulo="Período até"><Input name="periodo_fim" type="date" defaultValue={sis.hoje} className="w-40" /></Campo>
            <Button type="submit">Nova medição</Button>
          </form>
        )}
      </BarraModulo>
      <Indicadores
        itens={[
          { rotulo: "Medições aprovadas", valor: String(aprovadas.length), sub: ultima ? `última em ${dataBr(ultima.aprovada_em)}` : "nenhuma ainda" },
          { rotulo: "Acumulado medido", valor: o.orcamento_total ? pct(acumulado / o.orcamento_total, 1) : "—", sub: `${moeda(acumulado)} de custo direto` },
          { rotulo: "Faturado (c/ BDI)", valor: moeda(totalMedidoBdi) },
          { rotulo: "Avanço do checklist", valor: pct(an.progressoFisico(o)), sub: "referência para a próxima medição" },
        ]}
      />
      {lista.length ? (
        <div className="flex flex-col gap-2.5">{lista.map((m) => <CartaoMedicao key={m.id} o={o} m={m} ultimaAprovada={ultima?.id === m.id} aberto={sis.ui.editando === m.id || m.status === "Em elaboração"} aoAbrir={() => acao("ui.editar", { id: m.id })} />)}</div>
      ) : (
        <Vazio>Nenhuma medição. A nova medição já vem preenchida com o avanço do checklist de cada etapa.</Vazio>
      )}
    </>
  );
}

function CartaoMedicao({ o, m, ultimaAprovada, aberto, aoAbrir }: { o: Obra; m: md.Medicao; ultimaAprovada: boolean; aberto: boolean; aoAbrir: () => void }) {
  const { sis, acao } = useSistema();
  const enviar = useEnviar();
  const calc = md.calcularMedicao(o, m);
  const editavel = m.status === "Em elaboração";
  const rec = m.recebimento ? o.recebimentos.find((r) => r.id === m.recebimento) : undefined;
  const linhas = editavel ? calc.linhas : calc.linhas.filter((l) => l.acumulado > 0 || l.periodo > 0);
  const formId = `med-${m.id}`;
  // aprova o que está na tela: grava os % digitados e, se deu certo, aprova
  const aprovar = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const doc = e.currentTarget.ownerDocument;
    const dadosMed: Record<string, string> = { id: m.id };
    const f = doc.getElementById(formId) as HTMLFormElement | null;
    if (f) new FormData(f).forEach((v, k) => { dadosMed[k] = String(v); });
    if (!acao("med.salvar", dadosMed).ok) return;
    const dados: Record<string, string> = { id: m.id };
    new FormData(e.currentTarget).forEach((v, k) => { dados[k] = String(v); });
    acao("med.aprovar", dados);
  };
  return (
    <Card className={cn("gap-0 p-0", editavel && "border-foreground shadow-[inset_3px_0_0_var(--sinal)]")}>
      <button type="button" className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 p-3.5 text-left" onClick={aoAbrir} aria-expanded={aberto} disabled={editavel}>
        <span className="font-semibold">{md.numeroMed(m.numero)}</span>
        <Pill texto={m.status} />
        <span className="text-[0.8rem] text-muted-foreground">{dataBr(m.periodo_inicio)} a {dataBr(m.periodo_fim)}</span>
        <span className="ml-auto font-mono text-sm">{moeda(calc.total_bdi)} <span className="text-[0.72rem] text-muted-foreground">c/ BDI</span></span>
      </button>
      {aberto && (
        <div className="flex flex-col gap-3 border-t p-3.5">
          {editavel && (
            <form id={formId} key={JSON.stringify(m)} className={GRADE_FORM} onSubmit={enviar("med.salvar", { id: m.id })}>
              <Campo rotulo="Período — início"><Input name="periodo_inicio" type="date" defaultValue={m.periodo_inicio} /></Campo>
              <Campo rotulo="Período — fim"><Input name="periodo_fim" type="date" defaultValue={m.periodo_fim} /></Campo>
              <Campo rotulo="Observação" className="col-span-2"><Input name="observacao" maxLength={1000} defaultValue={m.observacao} /></Campo>
            </form>
          )}
          <div className="overflow-x-auto rounded-md border">
            <Table className="text-[0.8rem]">
              <TableHeader>
                <TableRow>
                  <TableHead>Etapa</TableHead><TableHead className="hidden text-right sm:table-cell">Orçado</TableHead><TableHead className="hidden text-right sm:table-cell">Anterior</TableHead>
                  <TableHead className="text-right">Acumulado</TableHead><TableHead className="text-right">Período</TableHead><TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {linhas.map((l) => (
                  <TableRow key={l.etapa}>
                    <TableCell className="min-w-32 whitespace-normal">
                      <span className="font-mono text-[0.72rem] text-muted-foreground">{l.etapa}</span> {l.nome}
                      {l.anterior > 0 && <span className="block text-[0.7rem] text-muted-foreground sm:hidden">já medido {p100(l.anterior)}</span>}
                    </TableCell>
                    <TableCell className="hidden text-right font-mono sm:table-cell">{moeda(l.orcado)}</TableCell>
                    <TableCell className="hidden text-right font-mono text-muted-foreground sm:table-cell">{p100(l.anterior)}</TableCell>
                    <TableCell className="text-right">
                      {editavel ? (
                        <span className="inline-flex items-center gap-1">
                          <CampoNumero form={formId} name={`pct_${l.etapa}`} texto={num(l.acumulado)} className="h-8 w-20 text-right font-mono" aria-label={`% acumulado ${l.nome}`} />%
                        </span>
                      ) : (
                        <span className="font-mono">{p100(l.acumulado)}</span>
                      )}
                    </TableCell>
                    <TableCell className={cn("text-right font-mono", l.periodo > 0 && "font-semibold")}>{p100(l.periodo)}</TableCell>
                    <TableCell className="text-right font-mono">{l.valor ? moeda(l.valor) : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow><TableCell colSpan={5} className="whitespace-normal">Total do período (custo direto)</TableCell><TableCell className="text-right font-mono">{moeda(calc.total)}</TableCell></TableRow>
                <TableRow><TableCell colSpan={5} className="whitespace-normal">Com BDI de {num(o.bdi)}% — valor a faturar</TableCell><TableCell className="text-right font-mono font-bold">{moeda(calc.total_bdi)}</TableCell></TableRow>
              </TableFooter>
            </Table>
          </div>
          {m.observacao && !editavel && <Nota>{m.observacao}</Nota>}
          {editavel ? (
            <div className="flex flex-wrap items-end gap-3">
              <Button type="submit" form={formId} variant="outline">Salvar e recalcular</Button>
              <form className="flex flex-wrap items-end gap-2 rounded-md border border-dashed p-2.5" onSubmit={aprovar}>
                <Campo rotulo="Parcela a receber">
                  <NativeSelect name="gerar_recebimento" defaultValue="1">
                    <option value="1">Lançar em Recebimentos</option>
                    <option value="0">Não lançar</option>
                  </NativeSelect>
                </Campo>
                <Campo rotulo="Vencimento"><Input name="vencimento" type="date" defaultValue={sis.hoje} className="w-40" /></Campo>
                <Button type="submit">Aprovar medição</Button>
              </form>
              <BotaoExcluir acaoNome="med.remover" id={m.id} rotulo="Descartar" pergunta="Descartar esta medição?" />
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3 text-[0.82rem] text-muted-foreground">
              Aprovada em {dataBr(m.aprovada_em)}
              {rec && <span>· parcela {moeda(rec.valor)} vence {dataBr(rec.vencimento)} (<b>{rec.status.toLowerCase()}</b>)</span>}
              {ultimaAprovada && <BotaoExcluir acaoNome="med.remover" id={m.id} rotulo="Excluir medição" pergunta="Excluir esta medição e a parcela gerada?" />}
            </div>
          )}
          {editavel && <Nota className="text-[0.76rem]">Altere o % acumulado de cada etapa e clique em “Salvar e recalcular” antes de aprovar. Não é possível medir menos do que já foi medido.</Nota>}
        </div>
      )}
    </Card>
  );
}
