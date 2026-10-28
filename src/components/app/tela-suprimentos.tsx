"use client";

import * as React from "react";
import { ChevronDownIcon, ChevronRightIcon, PackageCheckIcon, PlusIcon, ReceiptIcon, TruckIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { PRIORIDADES, type Obra } from "@/lib/core/modelos";
import * as md from "@/lib/core/modulos";
import { dataBr, moeda, num, valorBr } from "@/lib/core/util";
import { cn } from "@/lib/utils";
import { Campo, CampoNumero, Nota, Pill } from "./comum";
import { BarraModulo, BotaoExcluir, GRADE_FORM, Indicadores, Sugestoes, Vazio } from "./modulo-comum";
import { useEnviar, useSistema } from "./provedor";

const nomeEtapa = (o: Obra, cod: string) => (cod ? `${cod} · ${o.etapas.find((e) => e.codigo === cod)?.nome ?? ""}` : "Geral");

function SeletorEtapa({ o, valor }: { o: Obra; valor?: string }) {
  return (
    <NativeSelect name="etapa" defaultValue={valor ?? ""}>
      <option value="">(geral)</option>
      {o.etapas.map((e) => <option key={e.codigo} value={e.codigo}>{e.codigo} · {e.nome}</option>)}
    </NativeSelect>
  );
}

/**
 * Itens em linhas "descrição; quantidade; unidade; valor" com ajudante que puxa do catálogo de insumos.
 * O texto continua editável à mão (rápido no celular e fácil de colar de uma planilha).
 */
function CampoItens({ inicial, comValor, rotulo }: { inicial?: string; comValor: boolean; rotulo: string }) {
  const { sis } = useSistema();
  const ref = React.useRef<HTMLTextAreaElement>(null);
  const [escolha, setEscolha] = React.useState("");
  const [qtd, setQtd] = React.useState("1");
  const insumos = sis.cadastros.insumos;
  const achado = insumos.find((i) => i.descricao === escolha);
  const adicionar = () => {
    const t = ref.current;
    if (!t || !escolha.trim()) return;
    const partes = [escolha.trim(), qtd.trim() || "1", achado?.unidade ?? "un"];
    if (comValor || achado?.preco) partes.push(achado?.preco ? valorBr(achado.preco) : "");
    t.value = [t.value.trimEnd(), partes.join("; ")].filter(Boolean).join("\n");
    setEscolha("");
    setQtd("1");
    t.focus();
  };
  return (
    <div className="col-span-full flex flex-col gap-1.5">
      <Campo rotulo={rotulo}>
        <Textarea
          ref={ref}
          name="itens"
          rows={4}
          required
          defaultValue={inicial}
          className="font-mono text-[0.8rem]"
          placeholder={comValor ? "Cimento CP-II 50 kg; 40; sc; 38,90\nAreia média; 6; m³; 120" : "Cimento CP-II 50 kg; 40; sc\nAreia média; 6; m³"}
        />
      </Campo>
      <Nota className="text-[0.76rem]">
        Um item por linha: <b>descrição; quantidade; unidade{comValor ? "; valor unitário" : ""}</b>.
        {insumos.length ? " Ou escolha do catálogo de insumos:" : " Cadastre insumos para ter sugestões com preço."}
      </Nota>
      {insumos.length > 0 && (
        <div className="flex flex-wrap items-end gap-2">
          <Input
            aria-label="Insumo do catálogo"
            list="catalogo-insumos"
            value={escolha}
            onChange={(e) => setEscolha(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); adicionar(); } }}
            placeholder="Buscar insumo…"
            className="min-w-0 flex-[1_1_220px]"
          />
          <Input aria-label="Quantidade" inputMode="decimal" value={qtd} onChange={(e) => setQtd(e.target.value)} className="w-20" />
          <span className="pb-2 text-xs text-muted-foreground">{achado ? `${achado.unidade}${achado.preco ? ` · ${moeda(achado.preco)}` : ""}` : ""}</span>
          <Button type="button" variant="outline" size="sm" onClick={adicionar} disabled={!escolha.trim()}><PlusIcon />Adicionar item</Button>
          <Sugestoes id="catalogo-insumos" valores={insumos.map((i) => i.descricao)} />
        </div>
      )}
    </div>
  );
}

function TabelaItens({ itens, comValor, recebido }: { itens: md.ItemPedido[]; comValor: boolean; recebido?: boolean }) {
  return (
    <div className="overflow-x-auto rounded-md border">
      <Table className="text-[0.8rem]">
        <TableHeader>
          <TableRow>
            <TableHead>Item</TableHead><TableHead className="text-right">Qtd</TableHead><TableHead>Un</TableHead>
            {recebido && <TableHead className="text-right">Recebido</TableHead>}
            {comValor && <><TableHead className="text-right">Unitário</TableHead><TableHead className="text-right">Total</TableHead></>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {itens.map((i, k) => (
            <TableRow key={k}>
              <TableCell className="whitespace-normal">{i.descricao}</TableCell>
              <TableCell className="text-right font-mono">{num(i.quantidade)}</TableCell>
              <TableCell>{i.unidade}</TableCell>
              {recebido && (
                <TableCell className={cn("text-right font-mono", i.recebido >= i.quantidade - 1e-9 ? "text-ok" : i.recebido > 0 ? "text-atencao" : "text-muted-foreground")}>
                  {num(i.recebido)}
                </TableCell>
              )}
              {comValor && (
                <>
                  <TableCell className="text-right font-mono">{i.valor_unitario ? moeda(i.valor_unitario) : "—"}</TableCell>
                  <TableCell className="text-right font-mono">{i.valor_unitario ? moeda(i.quantidade * i.valor_unitario) : "—"}</TableCell>
                </>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ================================================================ solicitações de compra
const ORDEM_SOL: Record<string, number> = { "Aguardando aprovação": 0, Aprovada: 1, Atendida: 2, Recusada: 3 };

export function TelaSolicitacoes() {
  const { sis } = useSistema();
  const o = sis.obra!;
  const [filtro, setFiltro] = React.useState<string>("abertas");
  const contagem = (st: string) => o.solicitacoes.filter((s) => s.status === st).length;
  const lista = o.solicitacoes
    .filter((s) => (filtro === "abertas" ? s.status === "Aguardando aprovação" || s.status === "Aprovada" : filtro === "todas" || s.status === filtro))
    .sort((a, b) => ORDEM_SOL[a.status] - ORDEM_SOL[b.status] || b.numero - a.numero);
  const estimado = o.solicitacoes.filter((s) => s.status === "Aguardando aprovação").reduce((t, s) => t + md.totalItens(s.itens), 0);
  return (
    <>
      <BarraModulo
        texto="O canteiro pede o material, o responsável aprova ou recusa e a solicitação aprovada vira ordem de compra com um clique."
        qual="solicitacao"
        rotuloNovo="Nova solicitação"
      />
      <Indicadores
        itens={[
          { rotulo: "Aguardando aprovação", valor: String(contagem("Aguardando aprovação")), sub: estimado ? `estimado ${moeda(estimado)}` : undefined, tom: contagem("Aguardando aprovação") ? "atencao" : undefined },
          { rotulo: "Aprovadas sem OC", valor: String(contagem("Aprovada")) },
          { rotulo: "Atendidas", valor: String(contagem("Atendida")), tom: "ok" },
          { rotulo: "Recusadas", valor: String(contagem("Recusada")) },
        ]}
      />
      {sis.ui.novo === "solicitacao" && <FormSolicitacao o={o} />}
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar solicitações">
        {[["abertas", "Em aberto"], ["Atendida", "Atendidas"], ["Recusada", "Recusadas"], ["todas", "Todas"]].map(([v, r]) => (
          <Button key={v} size="sm" variant={filtro === v ? "default" : "outline"} aria-pressed={filtro === v} onClick={() => setFiltro(v)}>{r}</Button>
        ))}
      </div>
      {lista.length ? (
        <div className="flex flex-col gap-2.5">{lista.map((s) => <CartaoSolicitacao key={s.id} o={o} s={s} />)}</div>
      ) : (
        <Vazio>{o.solicitacoes.length ? "Nada neste filtro." : "Nenhuma solicitação. Use “Nova solicitação” para pedir material do canteiro."}</Vazio>
      )}
    </>
  );
}

function FormSolicitacao({ o }: { o: Obra }) {
  const { sis } = useSistema();
  const enviar = useEnviar();
  return (
    <Card className="p-4">
      <h3 className="font-semibold">Nova solicitação de compra</h3>
      <form className={GRADE_FORM} onSubmit={enviar("sol.criar", {}, { limpar: true })}>
        <Campo rotulo="Solicitante"><Input name="solicitante" maxLength={80} placeholder="Ex.: mestre de obras" list="solicitantes" /></Campo>
        <Campo rotulo="Etapa"><SeletorEtapa o={o} /></Campo>
        <Campo rotulo="Necessário até"><Input name="necessario_ate" type="date" /></Campo>
        <Campo rotulo="Prioridade"><NativeSelect name="prioridade" defaultValue="Média">{PRIORIDADES.map((p) => <option key={p}>{p}</option>)}</NativeSelect></Campo>
        <CampoItens comValor={false} rotulo="Itens" />
        <Campo rotulo="Observação" className="col-span-full"><Textarea name="observacao" rows={2} maxLength={1000} placeholder="Onde entregar, marca preferida…" /></Campo>
        <Sugestoes id="solicitantes" valores={[...o.solicitacoes.map((s) => s.solicitante), ...sis.cadastros.contatos.filter((c) => c.tipo === "Funcionário").map((c) => c.nome)].filter(Boolean)} />
        <Button type="submit">Enviar para aprovação</Button>
      </form>
    </Card>
  );
}

function CartaoSolicitacao({ o, s }: { o: Obra; s: md.Solicitacao }) {
  const { sis, acao } = useSistema();
  const enviar = useEnviar();
  const aberto = sis.ui.editando === s.id;
  const atrasada = s.necessario_ate && s.necessario_ate < sis.hoje && (s.status === "Aguardando aprovação" || s.status === "Aprovada");
  const oc = s.ordem ? o.ordens.find((x) => x.id === s.ordem) : undefined;
  const fornecedores = sis.cadastros.contatos.filter((c) => c.tipo === "Fornecedor" || c.tipo === "Prestador de serviço");
  const estimado = md.totalItens(s.itens);
  return (
    <Card className={cn("gap-0 p-0", atrasada && "border-critico shadow-[inset_3px_0_0_var(--critico)]")}>
      <button type="button" className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 p-3.5 text-left" aria-expanded={aberto} onClick={() => acao("ui.editar", { id: s.id })}>
        {aberto ? <ChevronDownIcon className="size-4 shrink-0" /> : <ChevronRightIcon className="size-4 shrink-0" />}
        <span className="font-mono text-sm font-semibold">{md.numeroSC(s.numero)}</span>
        <Pill texto={s.status} />
        {s.prioridade !== "Média" && <Pill texto={s.prioridade} />}
        <span className="min-w-0 flex-1 basis-48 truncate text-sm">{s.itens.map((i) => i.descricao).join(", ")}</span>
        <span className="text-[0.78rem] text-muted-foreground">
          {nomeEtapa(o, s.etapa)} · {dataBr(s.data)}{s.necessario_ate ? ` · até ${dataBr(s.necessario_ate)}` : ""}
          {atrasada && <b className="text-critico"> · prazo vencido</b>}
        </span>
      </button>
      {aberto && (
        <div className="flex flex-col gap-3 border-t p-3.5">
          <p className="text-[0.82rem] text-muted-foreground">
            Solicitante: <b className="text-foreground">{s.solicitante || "—"}</b>
            {estimado > 0 && <> · estimado {moeda(estimado)}</>}
            {s.observacao && <> · {s.observacao}</>}
          </p>
          <TabelaItens itens={s.itens} comValor={estimado > 0} />
          {s.status === "Recusada" && s.motivo && <Nota>Motivo da recusa: {s.motivo}</Nota>}
          {oc && (
            <Button variant="link" size="sm" className="self-start px-0 underline" onClick={() => { acao("ui.aba", { aba: "ordens" }); acao("ui.editar", { id: oc.id }); }}>
              <ReceiptIcon />Ver {md.numeroOC(oc.numero)} ({oc.status.toLowerCase()})
            </Button>
          )}
          {s.status === "Aguardando aprovação" && (
            <div className="flex flex-wrap items-end gap-2">
              <Button onClick={() => acao("sol.aprovar", { id: s.id })}>Aprovar</Button>
              <form className="flex flex-wrap items-end gap-2" onSubmit={enviar("sol.recusar", { id: s.id })}>
                <Input name="motivo" maxLength={300} placeholder="Motivo da recusa (opcional)" className="w-60" aria-label="Motivo da recusa" />
                <Button type="submit" variant="outline">Recusar</Button>
              </form>
            </div>
          )}
          {s.status === "Recusada" && <Button variant="outline" className="self-start" onClick={() => acao("sol.aprovar", { id: s.id })}>Reconsiderar e aprovar</Button>}
          {s.status === "Aprovada" && (
            <form className="flex flex-col gap-2 rounded-md border border-dashed p-3" onSubmit={enviar("oc.criar", { solicitacao: s.id })}>
              <h4 className="text-[0.86rem] font-semibold">Gerar ordem de compra</h4>
              <div className={GRADE_FORM}>
                <Campo rotulo="Fornecedor cadastrado">
                  <NativeSelect name="contato" defaultValue="">
                    <option value="">(digitar ao lado)</option>
                    {fornecedores.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </NativeSelect>
                </Campo>
                <Campo rotulo="ou nome do fornecedor"><Input name="fornecedor" maxLength={200} /></Campo>
                <Campo rotulo="Entrega prevista"><Input name="entrega_prevista" type="date" defaultValue={s.necessario_ate} /></Campo>
                <Button type="submit"><ReceiptIcon />Gerar OC</Button>
              </div>
              <Nota className="text-[0.76rem]">A OC nasce em rascunho com os itens da solicitação; informe os preços negociados e aprove.</Nota>
              <Button type="button" variant="link" size="sm" className="self-start px-0 text-muted-foreground underline" onClick={() => acao("sol.recusar", { id: s.id, motivo: "" })}>
                Voltar atrás e recusar
              </Button>
            </form>
          )}
          {s.status !== "Atendida" && <BotaoExcluir acaoNome="sol.remover" id={s.id} rotulo="Excluir solicitação" pergunta={`Excluir ${md.numeroSC(s.numero)}?`} />}
        </div>
      )}
    </Card>
  );
}

// ================================================================ ordens de compra
const ORDEM_OC: Record<string, number> = { Rascunho: 0, Aprovada: 1, Enviada: 2, "Recebida parcialmente": 3, Recebida: 4, Cancelada: 5 };
const ROTULO_TRANSICAO: Record<string, string> = { Aprovada: "Aprovar", Enviada: "Marcar como enviada ao fornecedor", Cancelada: "Cancelar ordem", Rascunho: "Voltar para rascunho" };

export function TelaOrdens() {
  const { sis } = useSistema();
  const o = sis.obra!;
  const [filtro, setFiltro] = React.useState("abertas");
  const abertas = (x: md.OrdemCompra) => ["Rascunho", "Aprovada", "Enviada", "Recebida parcialmente"].includes(x.status);
  const lista = o.ordens
    .filter((x) => (filtro === "abertas" ? abertas(x) : filtro === "todas" || x.status === filtro))
    .sort((a, b) => ORDEM_OC[a.status] - ORDEM_OC[b.status] || b.numero - a.numero);
  const comprometidas = o.ordens.filter(md.ocComprometida);
  const total = comprometidas.reduce((t, x) => t + md.totalOC(x), 0);
  const aEntregar = o.ordens.filter((x) => ["Aprovada", "Enviada", "Recebida parcialmente"].includes(x.status));
  const atrasadas = aEntregar.filter((x) => x.entrega_prevista && x.entrega_prevista < sis.hoje);
  const pendSol = o.solicitacoes.filter((s) => s.status === "Aprovada").length;
  return (
    <>
      <BarraModulo
        texto="Ordem de compra: fornecedor, preço negociado, condição de pagamento e prazo. Depois de aprovada entra no comprometido do orçamento; o recebimento confere item a item com a nota fiscal."
        qual="ordem"
        rotuloNovo="Nova ordem de compra"
      />
      <Indicadores
        itens={[
          { rotulo: "Comprometido em OCs", valor: moeda(total), sub: `${comprometidas.length} ordem(ns) aprovadas` },
          { rotulo: "Em rascunho", valor: String(o.ordens.filter((x) => x.status === "Rascunho").length), sub: "aguardando preço/aprovação" },
          { rotulo: "A entregar", valor: String(aEntregar.length), sub: atrasadas.length ? `${atrasadas.length} atrasada(s)` : "no prazo", tom: atrasadas.length ? "critico" : undefined },
          { rotulo: "Solicitações aprovadas", valor: String(pendSol), sub: "sem ordem ainda", tom: pendSol ? "atencao" : undefined },
        ]}
      />
      {sis.ui.novo === "ordem" && <FormOrdem o={o} />}
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar ordens">
        {[["abertas", "Em aberto"], ["Recebida", "Recebidas"], ["Cancelada", "Canceladas"], ["todas", "Todas"]].map(([v, r]) => (
          <Button key={v} size="sm" variant={filtro === v ? "default" : "outline"} aria-pressed={filtro === v} onClick={() => setFiltro(v)}>{r}</Button>
        ))}
      </div>
      {lista.length ? (
        <div className="flex flex-col gap-2.5">{lista.map((x) => <CartaoOrdem key={x.id} o={o} oc={x} />)}</div>
      ) : (
        <Vazio>{o.ordens.length ? "Nada neste filtro." : "Nenhuma ordem de compra. Gere a partir de uma solicitação aprovada ou crie uma nova."}</Vazio>
      )}
    </>
  );
}

function CamposOrdem({ o, oc }: { o: Obra; oc?: md.OrdemCompra }) {
  const { sis } = useSistema();
  const fornecedores = sis.cadastros.contatos.filter((c) => c.tipo === "Fornecedor" || c.tipo === "Prestador de serviço");
  return (
    <>
      {!oc && (
        <Campo rotulo="Fornecedor cadastrado">
          <NativeSelect name="contato" defaultValue="">
            <option value="">(digitar ao lado)</option>
            {fornecedores.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </NativeSelect>
        </Campo>
      )}
      <Campo rotulo={oc ? "Fornecedor" : "ou nome do fornecedor"}>
        <Input name="fornecedor" maxLength={200} defaultValue={oc?.fornecedor} required={!!oc} list="fornecedores-oc" />
      </Campo>
      <Sugestoes id="fornecedores-oc" valores={fornecedores.map((c) => c.nome)} />
      <Campo rotulo="Etapa"><SeletorEtapa o={o} valor={oc?.etapa} /></Campo>
      <Campo rotulo="Entrega prevista"><Input name="entrega_prevista" type="date" defaultValue={oc?.entrega_prevista} /></Campo>
      <CampoItens comValor inicial={oc ? md.itensParaTexto(oc.itens) : undefined} rotulo="Itens e preços negociados" />
      <Campo rotulo="Frete (R$)"><CampoNumero name="frete" texto={oc?.frete ? valorBr(oc.frete) : ""} placeholder="0,00" /></Campo>
      <Campo rotulo="Desconto (R$)"><CampoNumero name="desconto" texto={oc?.desconto ? valorBr(oc.desconto) : ""} placeholder="0,00" /></Campo>
      <Campo rotulo="Condição de pagamento">
        <NativeSelect name="condicao_pagamento" defaultValue={oc?.condicao_pagamento || "À vista"}>
          {[...new Set([...md.CONDICOES_PAGAMENTO, oc?.condicao_pagamento || "À vista"])].map((c) => <option key={c}>{c}</option>)}
        </NativeSelect>
      </Campo>
      <Campo rotulo="Nº de parcelas"><Input name="parcelas" type="number" min={1} max={60} defaultValue={oc?.parcelas || 1} /></Campo>
      <Campo rotulo="Observação" className="col-span-full"><Textarea name="observacao" rows={2} maxLength={1000} defaultValue={oc?.observacao} placeholder="Local de entrega, horário, contato no canteiro…" /></Campo>
    </>
  );
}

function FormOrdem({ o }: { o: Obra }) {
  const enviar = useEnviar();
  return (
    <Card className="p-4">
      <h3 className="font-semibold">Nova ordem de compra</h3>
      <form className={GRADE_FORM} onSubmit={enviar("oc.criar", {}, { limpar: true })}>
        <CamposOrdem o={o} />
        <Button type="submit">Criar em rascunho</Button>
      </form>
    </Card>
  );
}

function CartaoOrdem({ o, oc }: { o: Obra; oc: md.OrdemCompra }) {
  const { sis, acao } = useSistema();
  const enviar = useEnviar();
  const aberto = sis.ui.editando === oc.id;
  const total = md.totalOC(oc);
  const aReceber = ["Aprovada", "Enviada", "Recebida parcialmente"].includes(oc.status);
  const atrasada = aReceber && oc.entrega_prevista && oc.entrega_prevista < sis.hoje;
  const sol = oc.solicitacao ? o.solicitacoes.find((s) => s.id === oc.solicitacao) : undefined;
  const contato = oc.contato ? sis.cadastros.contatos.find((c) => c.id === oc.contato) : undefined;
  const transicoes = md.transicoesOC(oc.status);
  return (
    <Card className={cn("gap-0 p-0", atrasada && "border-critico shadow-[inset_3px_0_0_var(--critico)]")}>
      <button type="button" className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 p-3.5 text-left" aria-expanded={aberto} onClick={() => acao("ui.editar", { id: oc.id })}>
        {aberto ? <ChevronDownIcon className="size-4 shrink-0" /> : <ChevronRightIcon className="size-4 shrink-0" />}
        <span className="font-mono text-sm font-semibold">{md.numeroOC(oc.numero)}</span>
        <Pill texto={oc.status} />
        <span className="min-w-0 flex-1 basis-40 truncate font-medium">{oc.fornecedor}</span>
        <span className="font-mono text-sm">{total > 0 ? moeda(total) : "sem preço"}</span>
        <span className="w-full pl-7 text-[0.78rem] text-muted-foreground sm:w-auto sm:pl-0">
          {nomeEtapa(o, oc.etapa)} · {oc.itens.length} item(ns){oc.entrega_prevista ? ` · entrega ${dataBr(oc.entrega_prevista)}` : ""}
          {atrasada && <b className="text-critico"> · entrega atrasada</b>}
        </span>
      </button>
      {aberto && (
        <div className="flex flex-col gap-3 border-t p-3.5">
          <p className="text-[0.82rem] text-muted-foreground">
            Emitida em {dataBr(oc.data)}
            {sol && <> · origem {md.numeroSC(sol.numero)}{sol.solicitante ? ` (${sol.solicitante})` : ""}</>}
            {" · "}{oc.condicao_pagamento}{oc.parcelas > 1 ? ` em ${oc.parcelas}x de ${moeda(total / oc.parcelas)}` : ""}
            {oc.aprovada_por && <> · aprovada por {oc.aprovada_por}</>}
            {contato?.telefone && <> · <a className="underline" href={`tel:${contato.telefone.replace(/[^\d+]/g, "")}`}>{contato.telefone}</a></>}
          </p>
          {oc.status === "Rascunho" ? (
            <form key={JSON.stringify(oc)} className={GRADE_FORM} onSubmit={enviar("oc.editar", { id: oc.id })}>
              <CamposOrdem o={o} oc={oc} />
              <Button type="submit" variant="outline">Salvar rascunho</Button>
            </form>
          ) : (
            <>
              <TabelaItens itens={oc.itens} comValor recebido={oc.status !== "Aprovada" || oc.recebimentos.length > 0} />
              <p className="text-right font-mono text-[0.82rem]">
                {oc.frete ? `frete ${moeda(oc.frete)} · ` : ""}{oc.desconto ? `desconto ${moeda(oc.desconto)} · ` : ""}<b>total {moeda(total)}</b>
              </p>
              {oc.observacao && <Nota>{oc.observacao}</Nota>}
            </>
          )}
          {transicoes.length > 0 && (
            <div className="flex flex-wrap items-end gap-2">
              {transicoes.includes("Aprovada") && (
                <form className="flex flex-wrap items-end gap-2" onSubmit={enviar("oc.status", { id: oc.id, status: "Aprovada" })}>
                  <Input name="aprovador" maxLength={80} placeholder="Aprovada por" aria-label="Aprovada por" className="w-44" />
                  <Button type="submit">Aprovar ({moeda(total)})</Button>
                </form>
              )}
              {transicoes.filter((t) => t !== "Aprovada").map((t) => (
                <Button key={t} variant={t === "Enviada" ? "default" : "outline"} onClick={() => acao("oc.status", { id: oc.id, status: t })}>
                  {t === "Enviada" && <TruckIcon />}
                  {t === "Cancelada" && oc.recebimentos.length ? "Encerrar com o que chegou" : ROTULO_TRANSICAO[t]}
                </Button>
              ))}
            </div>
          )}
          {aReceber && <FormRecebimentoMaterial oc={oc} />}
          {oc.recebimentos.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <h4 className="text-[0.86rem] font-semibold">Entregas recebidas</h4>
              {oc.recebimentos.map((r, k) => (
                <p key={k} className="text-[0.8rem] text-muted-foreground">
                  <PackageCheckIcon className="mr-1 inline size-3.5 text-ok" />
                  {dataBr(r.data)}{r.nota_fiscal ? ` · NF ${r.nota_fiscal}` : ""}{r.conferido_por ? ` · conferido por ${r.conferido_por}` : ""} —{" "}
                  {r.quantidades.map((q, i) => (q > 0 ? `${num(q)} ${oc.itens[i]?.unidade ?? ""} ${oc.itens[i]?.descricao ?? ""}` : "")).filter(Boolean).join("; ")}
                  {r.observacao ? ` (${r.observacao})` : ""}
                </p>
              ))}
            </div>
          )}
          {(oc.status === "Rascunho" || oc.status === "Cancelada") && !oc.recebimentos.length && (
            <BotaoExcluir acaoNome="oc.remover" id={oc.id} rotulo="Excluir ordem" pergunta={`Excluir ${md.numeroOC(oc.numero)}?`} />
          )}
        </div>
      )}
    </Card>
  );
}

function FormRecebimentoMaterial({ oc }: { oc: md.OrdemCompra }) {
  const { sis } = useSistema();
  const enviar = useEnviar();
  return (
    <form key={oc.recebimentos.length} className="flex flex-col gap-2 rounded-md border border-dashed p-3" onSubmit={enviar("oc.receber", { id: oc.id })}>
      <h4 className="flex items-center gap-1.5 text-[0.86rem] font-semibold"><PackageCheckIcon className="size-4" />Receber material</h4>
      <Nota className="text-[0.76rem]">Confira cada item com a nota fiscal. Já vem preenchido com o saldo; ajuste se chegou menos.</Nota>
      <div className="flex flex-col gap-1.5">
        {oc.itens.map((it, k) => {
          const saldo = Math.max(0, it.quantidade - it.recebido);
          return (
            <label key={k} className="flex flex-wrap items-center gap-2 text-[0.82rem]">
              <span className="min-w-0 flex-1 basis-48">{it.descricao}</span>
              <span className="text-xs text-muted-foreground">saldo {num(saldo)} {it.unidade}</span>
              <CampoNumero name={`qtd_${k}`} texto={num(saldo)} className="w-24" aria-label={`Quantidade recebida de ${it.descricao}`} disabled={!saldo} />
              {!saldo && <input type="hidden" name={`qtd_${k}`} value="0" />}
            </label>
          );
        })}
      </div>
      <div className={GRADE_FORM}>
        <Campo rotulo="Data"><Input name="data" type="date" defaultValue={sis.hoje} /></Campo>
        <Campo rotulo="Nota fiscal"><Input name="nota_fiscal" maxLength={40} /></Campo>
        <Campo rotulo="Conferido por"><Input name="conferido_por" maxLength={80} /></Campo>
        <Campo rotulo="Observação"><Input name="observacao" maxLength={500} placeholder="Avarias, falta…" /></Campo>
        <Button type="submit"><PackageCheckIcon />Registrar recebimento</Button>
      </div>
    </form>
  );
}

