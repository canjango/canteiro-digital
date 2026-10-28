"use client";

import * as React from "react";
import { PlusIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import * as ct from "@/lib/core/controle";
import {
  FORMAS_PAGAMENTO, STATUS_CONTROLE, baseBruta, compraBruta, diferencaItem, fornecedorItem, totalBase, totalCompraItem, valorAplicado, valorParcela,
  type ItemControle, type Obra,
} from "@/lib/core/modelos";
import { dataBr, moeda, num, pctSinal } from "@/lib/core/util";
import { cn } from "@/lib/utils";
import { Campo, CampoNumero, Chevrons, Diferenca, Nota, Pill, Secao, corFase, type Passo } from "./comum";
import { useEnviar, useSistema } from "./provedor";

const PASSOS_METODOLOGIA: [string, string][] = [
  ["1. Base", "Quantidade × preço de referência de cada material e serviço (valor orçado, sem BDI). Linhas com quantidade estimada ficam marcadas para conferir no projeto."],
  ["2. Programação", "Cada item ganha um “comprar até”: início previsto da etapa menos 7 dias para material e 3 dias para contratar mão de obra. Prazos vencidos ou da semana viram alerta no Painel."],
  ["3. Cotação", "Registre até 3 fornecedores com preço à vista e a prazo. O menor preço na forma de pagamento escolhida é selecionado sozinho; você pode escolher outro."],
  ["4. Decisão", "Defina à vista ou a prazo e o nº de parcelas: o sistema calcula o valor aplicado, o total da compra e a parcela."],
  ["5. Compra e entrega", "“Comprado” exige cotação escolhida e registra a data; “Entregue” fecha o item. Itens comprados entram no comprometido e na medição por etapa do Painel."],
  ["6. Controle", "Diferença compra × base por item e por etapa (verde = economia, vermelho = estouro) e fluxo mensal de pagamentos das compras a prazo."],
];

const PROXIMO: Record<string, [string, string]> = {
  "A cotar": ["Cotação solicitada", "Solicitar cotação"],
  "Cotação solicitada": ["Comprado", "Marcar comprado"],
  Comprado: ["Entregue", "Marcar entregue"],
};

function corEtapaCtl(o: Obra, etapaBase: string): string {
  for (const i of o.controle) {
    if (i.etapa_base === etapaBase && i.etapa) {
      const e = o.etapas.find((x) => x.codigo === i.etapa);
      if (e) return corFase(e.categoria);
    }
  }
  return "#888";
}

function Metodologia({ embutida = false }: { embutida?: boolean }) {
  return (
    <details className={cn("rounded-lg border bg-card px-4 py-2.5", embutida && "border-0 p-0")}>
      <summary className="cursor-pointer text-sm font-semibold">Metodologia de compras — como funciona</summary>
      <ol className="mt-2.5 grid grid-cols-[repeat(auto-fit,minmax(min(100%,250px),1fr))] gap-2">
        {PASSOS_METODOLOGIA.map(([t, d]) => (
          <li key={t} className="flex flex-col gap-0.5 rounded border-l-[3px] border-l-sinal bg-muted px-2.5 py-2 text-[0.82rem]">
            <b>{t}</b><span className="text-muted-foreground">{d}</span>
          </li>
        ))}
      </ol>
    </details>
  );
}

export function ControleCompras() {
  const { sis, acao } = useSistema();
  const o = sis.obra!;
  if (!o.controle.length) {
    const ajustar = o.area_construida && Math.abs(o.area_construida - ct.AREA_REFERENCIA) / ct.AREA_REFERENCIA > 0.01;
    return (
      <Card className="gap-3.5 p-4 md:p-5">
        <h2 className="text-lg font-bold">Controle de compras pela planilha</h2>
        <p className="max-w-[80ch] text-sm text-muted-foreground">
          Carregue a base da planilha <b className="text-foreground">Controle e Gestão de Compras da Obra</b>: {ct.ITENS_BASE.length} itens de
          material e mão de obra em 9 etapas, com quantidades e preços de referência (residência de {num(ct.AREA_REFERENCIA)} m²,
          total base {moeda(ct.TOTAL_BASE_PLANILHA)}, sem BDI). Todos os itens entram como estão; depois é só cotar, decidir a forma
          de pagamento e registrar compra e entrega.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => acao("ctrl.carregar", { ajustar: "0" })}>Carregar base da planilha ({ct.ITENS_BASE.length} itens)</Button>
          {ajustar && (
            <Button variant="outline" onClick={() => acao("ctrl.carregar", { ajustar: "1" })}>
              Carregar ajustando quantidades para {num(o.area_construida)} m²
            </Button>
          )}
        </div>
        <Metodologia embutida />
      </Card>
    );
  }

  const r = ct.resumo(o);
  const filtro = sis.ui.ctrl_status;
  const passos: Passo[] = STATUS_CONTROLE.map((st) => {
    const n = r.status.get(st) ?? 0;
    return { rotulo: st, sub: `${n} ${n === 1 ? "item" : "itens"}`, estado: st === filtro ? "atual" : "", valor: st };
  });
  const etapas = ct.etapasControle(o);
  const sel = etapas.includes(sis.ui.ctrl_etapa) ? sis.ui.ctrl_etapa : "";
  return (
    <>
      <Card className="overflow-hidden">
        <Chevrons rotulo="Situação dos itens" passos={passos} aoEscolher={(st) => acao("ui.ctrl_status", { status: st })} />
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-t px-4 py-2 text-[0.8rem]">
          <span>Base <b>{moeda(r.base)}</b></span>
          <span>Cotado <b>{moeda(r.compra)}</b></span>
          <span>Comprado <b>{moeda(r.comprado)}</b></span>
          <span>
            Diferença nos cotados <b><Diferenca valor={r.diferenca} formatar={moeda} /></b>
            {r.variacao !== null && ` (${pctSinal(r.variacao)})`}
          </span>
          <span className="ml-auto text-muted-foreground">{o.controle_origem || "Itens incluídos manualmente"}</span>
        </div>
      </Card>
      <Metodologia />
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(230px,290px)_minmax(0,1fr)]">
        <Card className="flex flex-row gap-2 overflow-x-auto p-2 lg:sticky lg:top-[108px] lg:max-h-[calc(100dvh-124px)] lg:flex-col lg:gap-1 lg:overflow-y-auto lg:p-3" aria-label="Etapas do controle de compras">
          <div className="mb-1.5 hidden items-center justify-between border-b-2 border-foreground px-1 pb-2 font-semibold lg:flex">
            <span>Etapas da planilha</span>
            <button type="button" className="text-[0.8rem] font-medium hover:underline" onClick={() => acao("ui.ctrl_novo")}>+ Item</button>
          </div>
          <ItemLista ativo={!sel} cor="var(--foreground)" codigo="Σ" nome="Resumo geral" direita={String(r.itens)} onClick={() => acao("ui.ctrl_etapa", { etapa: "" })} />
          {etapas.map((e) => {
            const ln = r.linhas.get(e)!;
            const [n, ...resto] = e.split(". ");
            return (
              <ItemLista
                key={e} ativo={e === sel} cor={corEtapaCtl(o, e)} codigo={n} nome={resto.join(". ") || e}
                direita={`${ln.comprados}/${ln.itens}`} completo={ln.comprados === ln.itens}
                onClick={() => acao("ui.ctrl_etapa", { etapa: e })}
              />
            );
          })}
          <Button variant="outline" size="sm" className="shrink-0 lg:hidden" onClick={() => acao("ui.ctrl_novo")}><PlusIcon /> Item</Button>
        </Card>
        <Card className="overflow-hidden">
          {sis.ui.ctrl_novo && <FormNovoItem o={o} sel={sel} />}
          {sel ? <EtapaControle o={o} etapaBase={sel} /> : <ResumoControle o={o} r={r} />}
        </Card>
      </div>
    </>
  );
}

function ItemLista({ ativo, cor, codigo, nome, direita, completo, onClick }: {
  ativo: boolean; cor: string; codigo: string; nome: string; direita: string; completo?: boolean; onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-current={ativo ? "true" : undefined}
      onClick={onClick}
      title={nome}
      className={cn(
        "grid min-h-[30px] shrink-0 grid-cols-[6px_auto_auto] items-center gap-x-2.5 overflow-hidden whitespace-nowrap rounded-sm border border-transparent bg-muted pr-2 text-left lg:w-full lg:grid-cols-[6px_1.6rem_1fr_auto]",
        "hover:border-border",
        ativo && "border-foreground bg-card shadow-[inset_0_0_0_1px_var(--foreground)]",
      )}
    >
      <span className="block h-full min-h-[30px] w-1.5" style={{ background: cor }} />
      <span className="font-mono text-[0.74rem] text-muted-foreground">{codigo}</span>
      <span className="max-w-[9rem] truncate text-[0.85rem] lg:max-w-none">{nome}</span>
      <span className={cn("hidden font-mono text-[0.72rem] text-muted-foreground lg:inline", completo && "font-semibold text-ok")}>{direita}</span>
    </button>
  );
}

function FormNovoItem({ o, sel }: { o: Obra; sel: string }) {
  const enviar = useEnviar();
  const etapas = ct.etapasControle(o);
  return (
    <form className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,160px),1fr))] items-end gap-2.5 border-b bg-muted p-4" onSubmit={enviar("ctrl.novo", {}, { limpar: true })}>
      <Campo rotulo="Material / serviço" className="col-span-full"><Input name="descricao" required maxLength={200} /></Campo>
      <Campo rotulo="Etapa">
        <NativeSelect name="etapa_base" defaultValue={sel || etapas[0]}>{etapas.map((e) => <option key={e} value={e}>{e}</option>)}</NativeSelect>
      </Campo>
      <Campo rotulo="Tipo">
        <NativeSelect name="tipo" defaultValue="material"><option value="material">Material</option><option value="mao_de_obra">Mão de obra</option></NativeSelect>
      </Campo>
      <Campo rotulo="Grupo"><Input name="grupo" maxLength={60} placeholder="Ex.: Alvenaria" /></Campo>
      <Campo rotulo="Especificação"><Input name="especificacao" maxLength={200} /></Campo>
      <Campo rotulo="Unidade"><Input name="unidade" maxLength={20} defaultValue="un" /></Campo>
      <Campo rotulo="Quantidade"><CampoNumero name="quantidade" texto="1" /></Campo>
      <Campo rotulo="Valor unit. base (R$)"><CampoNumero name="valor_base" placeholder="0,00" /></Campo>
      <Button type="submit">Incluir item</Button>
    </form>
  );
}

function ResumoControle({ o, r }: { o: Obra; r: ReturnType<typeof ct.resumo> }) {
  const { sis, acao } = useSistema();
  const prog = ct.programacao(o, sis.hoje, 30);
  const fluxo = [...ct.fluxoPagamentos(o, sis.hoje).entries()];
  const maior = Math.max(...fluxo.map(([, v]) => v), 1);
  return (
    <>
      <Secao titulo="Resumo geral por etapa">
        <Nota>Valor de compra = soma das cotações escolhidas. Diferença e variação comparam só os itens já cotados com a base deles (positivo = economia).</Nota>
        {r.qtd_estimada > 0 && <p className="text-sm font-semibold text-atencao">{r.qtd_estimada} itens com quantidade estimada — confira com o projeto executivo antes de comprar.</p>}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Etapa</TableHead><TableHead>Nº de itens</TableHead><TableHead>Base materiais</TableHead><TableHead>Base mão de obra</TableHead>
              <TableHead>Base total</TableHead><TableHead>Valor de compra</TableHead><TableHead>Diferença</TableHead><TableHead>% variação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...r.linhas.entries()].map(([e, ln]) => (
              <TableRow key={e}>
                <TableCell className="min-w-56 whitespace-normal">
                  <button type="button" className="text-left font-medium hover:underline" onClick={() => acao("ui.ctrl_etapa", { etapa: e })}>{e}</button>
                </TableCell>
                <TableCell className="text-right font-mono">{ln.itens}</TableCell>
                <TableCell className="text-right font-mono">{moeda(ln.base_materiais)}</TableCell>
                <TableCell className="text-right font-mono">{moeda(ln.base_mao_obra)}</TableCell>
                <TableCell className="text-right font-mono font-semibold">{moeda(ln.base)}</TableCell>
                <TableCell className="text-right font-mono">{moeda(ln.compra)}</TableCell>
                <TableCell className="text-right font-mono"><Diferenca valor={ln.diferenca} formatar={moeda} /></TableCell>
                <TableCell className="text-right font-mono">{pctSinal(ln.variacao)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell>Total geral da obra</TableCell>
              <TableCell className="text-right font-mono">{r.itens}</TableCell>
              <TableCell className="text-right font-mono">{moeda(r.base_materiais)}</TableCell>
              <TableCell className="text-right font-mono">{moeda(r.base_mao_obra)}</TableCell>
              <TableCell className="text-right font-mono">{moeda(r.base)}</TableCell>
              <TableCell className="text-right font-mono">{moeda(r.compra)}</TableCell>
              <TableCell className="text-right font-mono"><Diferenca valor={r.diferenca} formatar={moeda} /></TableCell>
              <TableCell className="text-right font-mono">{pctSinal(r.variacao)}</TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </Secao>
      <div className="grid grid-cols-1 lg:grid-cols-2">
        <Secao titulo="Programação de compras · próximos 30 dias" className="border-b lg:border-b-0 lg:border-r">
          {prog.length ? (
            <>
              <ul className="flex flex-col">
                {prog.slice(0, 15).map(([it, ate]) => (
                  <li key={it.id} className="grid grid-cols-[4.8rem_1fr] items-center gap-2.5 border-b py-1.5 text-[0.84rem] sm:grid-cols-[5.6rem_1fr_auto]">
                    <span className={cn("font-mono text-[0.76rem]", ate < sis.hoje && "font-semibold text-critico")}>{dataBr(ate)}</span>
                    <span className="min-w-0"><b className="font-semibold">{it.descricao}</b> <span className="text-muted-foreground">{it.etapa_base} · {num(it.quantidade)} {it.unidade}</span></span>
                    <Pill texto={it.status} className="col-start-2 sm:col-auto" />
                  </li>
                ))}
              </ul>
              {prog.length > 15 && <Nota>+ {prog.length - 15} item(ns)</Nota>}
            </>
          ) : !o.etapas.some((e) => e.inicio_previsto) ? (
            <Nota>Defina o cronograma da obra (datas das etapas) para o sistema calcular os prazos de compra.</Nota>
          ) : (
            <Nota>Nenhum item com prazo de compra nos próximos 30 dias.</Nota>
          )}
        </Secao>
        <Secao titulo="Fluxo de pagamentos (itens comprados)" className="border-b-0">
          {fluxo.length ? fluxo.map(([m, v]) => (
            <div key={m} className="grid grid-cols-[4.5rem_1fr_7.5rem] items-center gap-2.5 text-[0.86rem]">
              <span className="font-mono">{m}</span><Progress value={v / maior} cor="bg-foreground" /><span className="text-right font-mono text-[0.78rem]">{moeda(v)}</span>
            </div>
          )) : (
            <Nota>Aparece quando houver itens comprados (à vista no mês da compra; a prazo em parcelas a partir do mês seguinte).</Nota>
          )}
        </Secao>
      </div>
    </>
  );
}

function EtapaControle({ o, etapaBase }: { o: Obra; etapaBase: string }) {
  const { sis } = useSistema();
  const filtro = sis.ui.ctrl_status;
  const todos = o.controle.filter((i) => i.etapa_base === etapaBase);
  const itens = todos.filter((i) => !filtro || i.status === filtro);
  const base = todos.reduce((s, i) => s + baseBruta(i), 0);
  const compra = todos.reduce((s, i) => s + compraBruta(i), 0);
  const [n, ...resto] = etapaBase.split(". ");
  const blocos = (["material", "mao_de_obra"] as const).map((tipo) => {
    const grupo = itens.filter((i) => i.tipo === tipo);
    if (!grupo.length) return null;
    const titulo = tipo === "material" ? "Materiais" : "Mão de obra — serviços desta etapa";
    const subBase = grupo.reduce((s, i) => s + baseBruta(i), 0);
    const subCompra = grupo.reduce((s, i) => s + compraBruta(i), 0);
    const subCotada = grupo.filter((i) => totalCompraItem(i)).reduce((s, i) => s + baseBruta(i), 0);
    return (
      <TableBody key={tipo} className="[&_tr:nth-child(odd)>td]:bg-transparent">
        <TableRow className="max-xl:block"><TableCell colSpan={7} className="bg-muted! text-[0.74rem] font-semibold uppercase tracking-wide text-muted-foreground max-xl:block">{titulo}</TableCell></TableRow>
        {grupo.map((i) => <LinhaItem key={i.id} o={o} it={i} />)}
        <TableRow className="font-semibold max-xl:flex max-xl:flex-wrap max-xl:gap-x-4 max-xl:gap-y-1 max-xl:border-b-2 max-xl:px-2.5 max-xl:py-2 max-xl:[&>td]:border-0 max-xl:[&>td]:p-0">
          <TableCell colSpan={2} className="max-xl:basis-full">Subtotal {tipo === "material" ? "materiais" : "mão de obra"}</TableCell>
          <TableCell className="text-right font-mono"><span className="mr-1 font-sans font-normal text-muted-foreground xl:hidden">Base</span>{moeda(subBase)}</TableCell>
          <TableCell className="text-right font-mono"><span className="mr-1 font-sans font-normal text-muted-foreground xl:hidden">Compra</span>{moeda(subCompra)}</TableCell>
          <TableCell className="text-right font-mono"><Diferenca valor={subCompra ? subCotada - subCompra : null} formatar={moeda} /></TableCell>
          <TableCell colSpan={2} className="max-xl:hidden" />
        </TableRow>
      </TableBody>
    );
  });
  return (
    <>
      <header className="grid grid-cols-[1fr_auto] items-start gap-3.5 border-b p-4 sm:grid-cols-[auto_1fr_auto]">
        <span className="mt-1 hidden rounded-sm border border-l-4 bg-card px-1.5 py-0.5 font-mono text-[0.68rem] font-semibold text-muted-foreground sm:inline" style={{ borderLeftColor: corEtapaCtl(o, etapaBase) }}>{n}</span>
        <div className="flex min-w-0 flex-col gap-1.5">
          <h2 className="text-lg font-bold leading-tight">{resto.join(". ") || etapaBase}</h2>
          <p className="flex flex-wrap items-center gap-x-2 text-[0.8rem] text-muted-foreground">
            <span>{todos.length} itens</span><span className="text-border">|</span><span>Base {moeda(base)}</span>
            <span className="text-border">|</span><span>Compra {moeda(compra)}</span>
            {filtro && <><span className="text-border">|</span><Pill texto={filtro} /></>}
          </p>
        </div>
        <span className="text-right text-2xl font-bold leading-none tabular-nums">
          {todos.filter((i) => !ct.pendente(i)).length}/{todos.length}
          <small className="mt-1 block text-[0.72rem] font-normal text-muted-foreground">comprados</small>
        </span>
      </header>
      <p className="flex flex-wrap items-center gap-1.5 px-4 pt-2.5 text-[0.82rem] text-muted-foreground">
        <span className="inline-block size-3 rounded-sm border bg-atencao-suave" /> quantidade estimada (validar no projeto) ·
        <span className="inline-block size-3 rounded-sm bg-atencao" /> item novo ·
        <span className="rounded-sm bg-mo px-1 text-[0.62rem] font-bold text-white">MO</span> mão de obra · toque em <b>Cotar</b> para registrar fornecedores e forma de pagamento.
      </p>
      {itens.length ? (
        <div className="p-2 md:p-3">
          <Table className="max-xl:block max-xl:[&_tbody]:block max-xl:[&_thead]:hidden">
            <TableHeader>
              <TableRow>
                <TableHead>Material / serviço</TableHead><TableHead>Qtd.</TableHead><TableHead>Base</TableHead><TableHead>Compra</TableHead>
                <TableHead>Diferença</TableHead><TableHead>Situação</TableHead><TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            {blocos}
          </Table>
        </div>
      ) : (
        <Nota className="p-4">Nenhum item nesta situação.</Nota>
      )}
    </>
  );
}

function LinhaItem({ o, it }: { o: Obra; it: ItemControle }) {
  const { sis, acao } = useSistema();
  const aberto = sis.ui.ctrl_item === it.id;
  const ate = ct.comprarAte(o, it);
  let prazo: React.ReactNode = null;
  if (ate && ct.pendente(it)) {
    const venc = ate < sis.hoje;
    prazo = <span className={cn("mt-1 block font-mono text-[0.7rem] text-muted-foreground", venc && "font-semibold text-critico")}>{venc ? "vencido " : ""}até {dataBr(ate)}</span>;
  } else if (it.data_entrega) prazo = <span className="mt-1 block font-mono text-[0.7rem] text-muted-foreground">entregue {dataBr(it.data_entrega)}</span>;
  else if (it.data_compra) prazo = <span className="mt-1 block font-mono text-[0.7rem] text-muted-foreground">comprado {dataBr(it.data_compra)}</span>;
  const prox = PROXIMO[it.status];
  const total = totalCompraItem(it);
  const podeAvancar = prox && !((prox[0] === "Comprado" || prox[0] === "Entregue") && !total);
  const forn = fornecedorItem(it);
  const celula = "max-xl:border-0 max-xl:p-0 max-xl:bg-transparent!";
  return (
    <>
      <TableRow className={cn(
        "max-xl:grid max-xl:grid-cols-2 max-xl:gap-x-2.5 max-xl:gap-y-1.5 max-xl:border-b max-xl:px-2.5 max-xl:py-2.5 sm:max-xl:grid-cols-4",
        it.qtd_estimada && "[&>td]:bg-atencao-suave!",
        it.novo && "[&>td:first-child]:shadow-[inset_4px_0_0_var(--atencao)]",
      )}>
        <TableCell className={cn("min-w-48 whitespace-normal align-top max-xl:col-span-full max-xl:min-w-0", celula)}>
          <span className="mb-px block text-[0.72rem] text-muted-foreground">
            {it.tipo === "mao_de_obra" && <span className="mr-1 rounded-sm bg-mo px-1 text-[0.62rem] font-bold text-white">MO</span>}{it.grupo}
          </span>
          <b className="font-semibold">{it.descricao}</b>
          {it.especificacao && <small className="block text-[0.74rem] text-muted-foreground">{it.especificacao}</small>}
          {forn && (
            <small className="block text-[0.74rem] text-info">
              {forn} · {it.forma}{it.forma === "A Prazo" && it.parcelas > 1 ? ` ${it.parcelas}x ${moeda(valorParcela(it))}` : ""}
            </small>
          )}
        </TableCell>
        <TableCell className={cn("text-right align-top font-mono max-xl:text-left max-xl:text-[0.78rem]", celula)}>
          <span className="block text-[0.68rem] text-muted-foreground xl:hidden">Quantidade</span>{num(it.quantidade)} {it.unidade}
        </TableCell>
        <TableCell className={cn("text-right align-top font-mono max-xl:text-left max-xl:text-[0.78rem]", celula)}>
          <span className="block text-[0.68rem] text-muted-foreground xl:hidden">Base</span>
          {moeda(totalBase(it))}<small className="block text-[0.7rem] text-ok">{moeda(it.valor_base)}/{it.unidade}</small>
        </TableCell>
        <TableCell className={cn("text-right align-top font-mono max-xl:text-left max-xl:text-[0.78rem]", celula)}>
          <span className="block text-[0.68rem] text-muted-foreground xl:hidden">Compra</span>
          {total ? <>{moeda(total)}<small className="block text-[0.7rem] text-muted-foreground">{moeda(valorAplicado(it))}/{it.unidade}</small></> : "—"}
        </TableCell>
        <TableCell className={cn("text-right align-top font-mono max-xl:text-left max-xl:text-[0.78rem]", celula)}>
          <span className="block text-[0.68rem] text-muted-foreground xl:hidden">Diferença</span>
          <Diferenca valor={diferencaItem(it)} formatar={moeda} />
        </TableCell>
        <TableCell className={cn("whitespace-normal align-top max-xl:col-span-2 sm:max-xl:col-span-4", celula)}><Pill texto={it.status} />{prazo}</TableCell>
        <TableCell className={cn("align-top max-xl:col-span-full", celula)}>
          <div className="flex flex-wrap gap-1">
            <Button size="xs" variant="outline" aria-expanded={aberto} onClick={() => acao("ui.ctrl_item", { id: it.id })}>
              {aberto ? "Fechar" : it.cotacoes.length ? "Editar" : "Cotar"}
            </Button>
            {podeAvancar && <Button size="xs" onClick={() => acao("ctrl.status", { id: it.id, status: prox[0] })}>{prox[1]}</Button>}
          </div>
        </TableCell>
      </TableRow>
      {aberto && (
        <TableRow className="max-xl:block">
          <TableCell colSpan={7} className="bg-muted! whitespace-normal p-3 max-xl:block">
            <FormItem it={it} />
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

function FormItem({ it }: { it: ItemControle }) {
  const { sis, acao } = useSistema();
  const enviar = useEnviar();
  const melhor = ct.melhorCotacao(it.cotacoes, it.forma);
  const auto = it.escolhida === melhor;
  const comprado = it.status === "Comprado" || it.status === "Entregue";
  return (
    <form className="flex max-w-[900px] flex-col gap-2.5" onSubmit={enviar("ctrl.salvar", { id: it.id })}>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,150px),1fr))] items-end gap-2.5">
        <Campo rotulo={`Quantidade (${it.unidade})`}><CampoNumero name="quantidade" texto={num(it.quantidade)} /></Campo>
        <Campo rotulo="Valor unit. base (R$)"><CampoNumero name="valor_base" valor={it.valor_base} placeholder="0,00" /></Campo>
        <Campo rotulo="Forma de pagamento">
          <NativeSelect name="forma" defaultValue={it.forma}>
            <option value="">—</option>
            {FORMAS_PAGAMENTO.map((f) => <option key={f} value={f}>{f}</option>)}
          </NativeSelect>
        </Campo>
        <Campo rotulo="Nº de parcelas"><CampoNumero name="parcelas" texto={it.parcelas ? String(it.parcelas) : ""} placeholder="1" /></Campo>
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="hidden grid-cols-[1.5rem_minmax(10rem,1fr)_8rem_8rem_auto] gap-2 px-1 text-xs font-medium text-muted-foreground sm:grid">
          <span>#</span><span>Fornecedor / prestador</span><span>À vista (R$/{it.unidade})</span><span>A prazo (R$/{it.unidade})</span><span>Escolha</span>
        </div>
        {[0, 1, 2].map((k) => {
          const c = it.cotacoes[k];
          return (
            <div key={k} className="grid grid-cols-2 gap-2 border-b pb-2 sm:grid-cols-[1.5rem_minmax(10rem,1fr)_8rem_8rem_auto] sm:items-center sm:border-0 sm:pb-0">
              <span className="hidden font-mono text-xs text-muted-foreground sm:inline">{k + 1}</span>
              <Input name={`fornecedor_${k + 1}`} defaultValue={c?.fornecedor ?? ""} maxLength={200} placeholder={`Fornecedor ${k + 1}`} aria-label={`Fornecedor ${k + 1}`} className="col-span-2 sm:col-span-1" />
              <CampoNumero name={`vista_${k + 1}`} valor={c?.vista || null} placeholder="À vista" aria-label={`À vista, cotação ${k + 1}`} />
              <CampoNumero name={`prazo_${k + 1}`} valor={c?.prazo || null} placeholder="A prazo" aria-label={`A prazo, cotação ${k + 1}`} />
              <label className="flex items-center gap-1 whitespace-nowrap text-[0.8rem]">
                <input type="radio" name="escolhida" value={k} defaultChecked={!auto && it.escolhida === k} /> usar
                {melhor === k && <span className="rounded-sm bg-ok px-1 text-[0.64rem] font-bold text-selo-texto">menor preço</span>}
              </label>
            </div>
          );
        })}
        <label className="flex items-center gap-1.5 self-end text-[0.8rem]">
          <input type="radio" name="escolhida" value="" defaultChecked={auto} /> automático (menor preço na forma de pagamento)
        </label>
      </div>
      <Campo rotulo="Observações"><Textarea name="observacao" rows={2} maxLength={500} defaultValue={it.observacao} /></Campo>
      <Nota>
        Base: {num(it.quantidade)} {it.unidade} × {moeda(it.valor_base)} = <b>{moeda(totalBase(it))}</b>
        {it.fonte_preco ? ` · preço ${it.fonte_preco}` : ""}{it.qtd_estimada ? " · quantidade estimada" : ""}.
        Situação: {it.status}{it.data_compra ? ` desde ${dataBr(it.data_compra)}` : ""}.
      </Nota>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit">Salvar cotação</Button>
        {comprado && (
          <Button variant="link" size="sm" onClick={() => acao("ctrl.status", { id: it.id, status: "Cotação solicitada" })}>Voltar para cotação</Button>
        )}
        {!comprado && (sis.ui.ctrl_excluir === it.id ? (
          <span className="flex flex-wrap items-center gap-2 text-sm font-semibold text-critico">
            Remover este item do controle?
            <Button variant="destructive" size="xs" onClick={() => acao("ctrl.remover", { id: it.id })}>Sim, remover</Button>
            <Button variant="outline" size="xs" onClick={() => acao("ui.ctrl_cancelar_remocao")}>Cancelar</Button>
          </span>
        ) : (
          <Button variant="link" size="sm" className="text-muted-foreground" onClick={() => acao("ctrl.remover", { id: it.id })}>Remover item</Button>
        ))}
      </div>
    </form>
  );
}
