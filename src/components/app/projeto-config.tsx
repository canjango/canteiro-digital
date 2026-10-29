"use client";

import * as React from "react";
import { FileCheck2Icon, PencilIcon, RotateCcwIcon, ShieldCheckIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import * as pj from "@/lib/core/projetos";
import { arred, dataBr, diasEntre, moeda, num, valorBr } from "@/lib/core/util";
import { cn } from "@/lib/utils";
import { Campo, CampoNumero, Nota, Pill } from "./comum";
import { BotaoExcluir, GRADE_FORM, Indicadores, Vazio } from "./modulo-comum";
import { useEnviar, useSistema } from "./provedor";

// ================================================================ documentos de habilitação
export function TelaDocumentos() {
  const { sis, acao } = useSistema();
  const g = sis.cadastros;
  const ant = Math.max(g.regras.antecedencia_dias, 15);
  const sit = (d: pj.DocumentoEmpresa) => pj.situacaoDocumento(d, sis.hoje, ant);
  const cont = (s: string) => g.documentos.filter((d) => sit(d) === s).length;
  return (
    <>
      <Card className="flex-row flex-wrap items-center justify-between gap-2.5 p-3 md:p-4">
        <Nota className="min-w-0 flex-1 basis-72">Documentos de habilitação da empresa (Lei 14.133, arts. 66 a 69) com emissão e validade. Cada licitação nova já nasce com este checklist, e a validade é conferida na data da sessão.</Nota>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => acao("doc.padrao")}><FileCheck2Icon />Incluir documentos usuais</Button>
          <Button onClick={() => acao("ui.novo", { qual: "documento" })} variant={sis.ui.novo === "documento" ? "outline" : "default"}>{sis.ui.novo === "documento" ? "Fechar" : "Novo documento"}</Button>
        </div>
      </Card>
      <Indicadores
        itens={[
          { rotulo: "Válidos", valor: String(cont("Válido") + cont("Sem validade")), tom: "ok" },
          { rotulo: "Vencem em breve", valor: String(cont("Vence em breve")), sub: `próximos ${ant} dias`, tom: cont("Vence em breve") ? "atencao" : undefined },
          { rotulo: "Vencidos", valor: String(cont("Vencido")), tom: cont("Vencido") ? "critico" : undefined },
          { rotulo: "Sem data", valor: String(cont("Sem data")), sub: "preencha emissão/validade" },
        ]}
      />
      {sis.ui.novo === "documento" && <FormDocumento />}
      {g.documentos.length ? (
        pj.GRUPOS_DOC.map((grupo) => {
          const docs = g.documentos.filter((d) => d.grupo === grupo);
          if (!docs.length) return null;
          return (
            <Card key={grupo} className="gap-0 overflow-hidden p-0">
              <h3 className="border-b bg-muted px-4 py-2 text-[0.86rem] font-semibold">{grupo}</h3>
              <ul className="divide-y">
                {docs.map((d) => sis.ui.editando === d.id ? (
                  <li key={d.id} className="p-2"><FormDocumento d={d} /></li>
                ) : (
                  <li key={d.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5">
                    <span className="flex min-w-0 flex-1 basis-60 flex-col">
                      <span className="text-sm font-medium">{d.nome}</span>
                      <span className="text-[0.76rem] text-muted-foreground">
                        {d.emissao ? `emitido ${dataBr(d.emissao)}` : "sem emissão"}{d.validade ? ` · válido até ${dataBr(d.validade)}` : ""}
                        {d.validade && d.validade >= sis.hoje && ` (${diasEntre(sis.hoje, d.validade)} d)`}{d.observacao && ` · ${d.observacao}`}
                      </span>
                    </span>
                    <Pill texto={sit(d)} />
                    <Button size="sm" variant="ghost" aria-label={`Editar ${d.nome}`} onClick={() => acao("ui.editar", { id: d.id })}><PencilIcon /></Button>
                    <BotaoExcluir acaoNome="doc.remover" id={d.id} rotulo="×" pergunta="Excluir?" />
                  </li>
                ))}
              </ul>
            </Card>
          );
        })
      ) : (
        <Vazio>Nenhum documento. Use “Incluir documentos usuais” para começar com a lista de habilitação mais comum.</Vazio>
      )}
    </>
  );
}

function FormDocumento({ d }: { d?: pj.DocumentoEmpresa }) {
  const { acao } = useSistema();
  const enviar = useEnviar();
  return (
    <Card className={cn("p-4", d && "border-0 p-2 shadow-none")}>
      {!d && <h3 className="font-semibold">Novo documento</h3>}
      <form className={GRADE_FORM} onSubmit={enviar("doc.salvar", d ? { id: d.id } : {}, { limpar: !d })}>
        <Campo rotulo="Documento" className="col-span-full sm:col-span-2"><Input name="nome" required maxLength={200} defaultValue={d?.nome} /></Campo>
        <Campo rotulo="Grupo"><NativeSelect name="grupo" defaultValue={d?.grupo ?? "Fiscal, social e trabalhista"}>{pj.GRUPOS_DOC.map((x) => <option key={x}>{x}</option>)}</NativeSelect></Campo>
        <Campo rotulo="Emissão"><Input name="emissao" type="date" defaultValue={d?.emissao} /></Campo>
        <Campo rotulo="Validade (vazio = sem validade)"><Input name="validade" type="date" defaultValue={d?.validade} /></Campo>
        <Campo rotulo="Observação" className="col-span-full sm:col-span-2"><Input name="observacao" maxLength={300} defaultValue={d?.observacao} /></Campo>
        <div className="flex gap-2">
          <Button type="submit">{d ? "Salvar" : "Incluir"}</Button>
          {d && <Button type="button" variant="outline" onClick={() => acao("ui.editar", { id: d.id })}>Cancelar</Button>}
        </div>
      </form>
    </Card>
  );
}

// ================================================================ regras do escritório
export function TelaRegras() {
  const { sis, acao } = useSistema();
  const enviar = useEnviar();
  const r = sis.cadastros.regras;
  const [k, setK] = React.useState({ encargos: num(r.k.encargos), indiretas: num(r.k.indiretas), lucro: num(r.k.lucro), impostos: num(r.k.impostos) });
  const [aprov, setAprov] = React.useState<string[]>(r.fases_aprovacao);
  const [pesos, setPesos] = React.useState<Record<string, Record<string, string>>>(() =>
    Object.fromEntries(Object.entries(r.modelos).map(([m, p]) => [m, Object.fromEntries(Object.entries(p).map(([c, v]) => [c, num(v)]))])));
  const chave = JSON.stringify(r); // remonta os campos quando as regras mudam (ex.: restaurar)
  React.useEffect(() => {
    setK({ encargos: num(r.k.encargos), indiretas: num(r.k.indiretas), lucro: num(r.k.lucro), impostos: num(r.k.impostos) });
    setAprov(r.fases_aprovacao);
    setPesos(Object.fromEntries(Object.entries(r.modelos).map(([m, p]) => [m, Object.fromEntries(Object.entries(p).map(([c, v]) => [c, num(v)]))])));
  }, [chave]); // eslint-disable-line react-hooks/exhaustive-deps
  const nk = (t: string) => Number(t.replace(",", ".")) || 0;
  const fk = pj.fatorK({ encargos: nk(k.encargos), indiretas: nk(k.indiretas), lucro: nk(k.lucro), impostos: nk(k.impostos) });
  const somaModelo = (m: string) => arred(Object.values(pesos[m] ?? {}).reduce((s, v) => s + nk(v), 0), 2);
  const modelosOk = Object.keys(pesos).every((m) => Math.abs(somaModelo(m) - 100) < 0.01);
  return (
    <form key={chave} className="flex flex-col gap-4" onSubmit={enviar("regras.salvar", { fases_aprovacao: aprov.join(",") })}>
      <Card className="flex-row flex-wrap items-center gap-2.5 p-3.5">
        <ShieldCheckIcon className="size-5 shrink-0" />
        <Nota className="min-w-0 flex-1 basis-72">
          Regras do escritório: valem como padrão para os <b>novos</b> projetos (os existentes mantêm o que foi contratado). Os percentuais são referências do escritório, ajuste à sua realidade e à tabela do CAU do seu estado.
        </Nota>
        <Button type="button" variant="outline" size="sm" onClick={() => acao("regras.restaurar")}><RotateCcwIcon />Restaurar padrão</Button>
      </Card>
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Card className="gap-3 p-4">
          <h3 className="text-[0.92rem] font-semibold">Honorários e revisões por padrão</h3>
          <Table className="text-[0.84rem]">
            <TableHeader><TableRow><TableHead>Padrão</TableHead><TableHead className="text-right">% do custo da obra</TableHead><TableHead className="text-right">Revisões incluídas</TableHead></TableRow></TableHeader>
            <TableBody>
              {pj.PADROES_PROJETO.map((p) => {
                const c = p.replace(/\s/g, "_");
                return (
                  <TableRow key={p}>
                    <TableCell>{p} <span className="text-[0.74rem] text-muted-foreground">(CUB {pj.CUB_DO_PADRAO[p]})</span></TableCell>
                    <TableCell className="text-right"><Input name={`pct_${c}`} inputMode="decimal" defaultValue={num(r.percentual_padrao[p])} className="ml-auto h-8 w-20 text-right font-mono" aria-label={`% de honorários — ${p}`} /></TableCell>
                    <TableCell className="text-right"><Input name={`rev_${c}`} type="number" min={0} max={20} defaultValue={r.revisoes_padrao[p]} className="ml-auto h-8 w-20 text-right font-mono" aria-label={`Revisões incluídas — ${p}`} /></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <div className={GRADE_FORM}>
            <Campo rotulo="Custo por hora padrão (R$)"><CampoNumero name="custo_hora_padrao" texto={valorBr(r.custo_hora_padrao)} /></Campo>
            <Campo rotulo="Horas por dia (custo/hora da equipe)"><Input name="horas_dia" inputMode="decimal" defaultValue={num(r.horas_dia)} /></Campo>
          </div>
          <Nota className="text-[0.76rem]">Custo/hora de cada pessoa = custo por dia (Gestão de equipe) ÷ horas por dia. Sem custo na equipe, vale o padrão.</Nota>
        </Card>
        <Card className="gap-3 p-4">
          <h3 className="text-[0.92rem] font-semibold">Fator K — custo do serviço (Modalidade 02 CAU)</h3>
          <div className={GRADE_FORM}>
            {(["encargos", "indiretas", "lucro", "impostos"] as const).map((x) => (
              <Campo key={x} rotulo={{ encargos: "Encargos sociais (%)", indiretas: "Despesas indiretas (%)", lucro: "Lucro (%)", impostos: "Impostos e despesas legais (%)" }[x]}>
                <Input name={`k_${x}`} inputMode="decimal" value={k[x]} onChange={(e) => setK((v) => ({ ...v, [x]: e.target.value }))} />
              </Campo>
            ))}
          </div>
          <p className="text-sm">K = (1 + enc.)(1 + ind.)(1 + lucro)(1 + imp.) = <b className="font-mono">{fk.toFixed(3).replace(".", ",")}</b> · 100 h × {moeda(r.custo_hora_padrao)} = <b className="font-mono">{moeda(100 * r.custo_hora_padrao * fk)}</b></p>
          <h3 className="mt-2 text-[0.92rem] font-semibold">Alertas</h3>
          <div className={GRADE_FORM}>
            <Campo rotulo="Avisar horas da fase em (%)"><Input name="alerta_horas" inputMode="decimal" defaultValue={num(r.alerta_horas)} /></Campo>
            <Campo rotulo="Antecedência dos prazos (dias)"><Input name="antecedencia_dias" type="number" min={0} max={90} defaultValue={r.antecedencia_dias} /></Campo>
            <Campo rotulo="Margem mínima (%)"><Input name="margem_minima" inputMode="decimal" defaultValue={num(r.margem_minima)} /></Campo>
          </div>
        </Card>
      </div>
      <Card className="gap-3 p-4">
        <h3 className="text-[0.92rem] font-semibold">Aprovação do cliente</h3>
        <div className="flex flex-wrap gap-1.5">
          {pj.FASES.map((f) => {
            const on = aprov.includes(f.codigo);
            return (
              <button key={f.codigo} type="button" aria-pressed={on} onClick={() => setAprov((a) => (on ? a.filter((x) => x !== f.codigo) : [...a, f.codigo]))}
                className={cn("rounded-sm border px-2 py-1 text-[0.8rem]", on ? "border-foreground bg-foreground text-background" : "hover:bg-muted")}>
                {f.codigo} · {f.nome}
              </button>
            );
          })}
        </div>
        <label className="flex items-center gap-2 text-sm">
          <NativeSelect name="bloquear_sem_aprovacao" defaultValue={r.bloquear_sem_aprovacao ? "1" : "0"} className="h-8 w-auto">
            <option value="1">Bloquear</option><option value="0">Só avisar</option>
          </NativeSelect>
          a conclusão das fases seguintes enquanto essas fases não tiverem a aprovação do cliente registrada.
        </label>
      </Card>
      <Card className="gap-3 p-4">
        <h3 className="text-[0.92rem] font-semibold">Modelos de fases e distribuição dos honorários (%)</h3>
        <div className="overflow-x-auto">
          <Table className="text-[0.82rem]">
            <TableHeader>
              <TableRow><TableHead>Modelo</TableHead>{pj.FASES.map((f) => <TableHead key={f.codigo} className="text-center" title={f.nome}>{f.codigo}</TableHead>)}<TableHead className="text-right">Soma</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {Object.keys(pesos).map((m) => (
                <TableRow key={m}>
                  <TableCell className="whitespace-nowrap font-medium">{m}</TableCell>
                  {pj.FASES.map((f) => (
                    <TableCell key={f.codigo} className="text-center">
                      {f.codigo in (pesos[m] ?? {}) ? (
                        <Input name={`m_${m}_${f.codigo}`} inputMode="decimal" value={pesos[m][f.codigo]} onChange={(e) => setPesos((x) => ({ ...x, [m]: { ...x[m], [f.codigo]: e.target.value } }))} className="mx-auto h-8 w-14 text-center font-mono" aria-label={`${m} — ${f.codigo}`} />
                      ) : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                  ))}
                  <TableCell className={cn("text-right font-mono", Math.abs(somaModelo(m) - 100) > 0.01 ? "font-bold text-critico" : "")}>{num(somaModelo(m))}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <Nota className="text-[0.76rem]">
          {pj.FASES.map((f) => `${f.codigo} ${f.nome}`).join(" · ")}. O modelo é escolhido pelo tipo de obra e pela origem (licitações incluem o Projeto Básico).
        </Nota>
      </Card>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={!modelosOk}>Salvar regras</Button>
        {!modelosOk && <span className="text-sm font-semibold text-critico">Algum modelo não fecha 100%.</span>}
      </div>
    </form>
  );
}
