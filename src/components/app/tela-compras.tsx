"use client";

import * as React from "react";
import { CalendarIcon, ChevronDownIcon, FlagIcon, Trash2Icon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import * as an from "@/lib/core/analise";
import { PRIORIDADES, CATEGORIAS_COMPRA, TRANSICOES_COMPRA, UNIDADES, valorTotalCompra, type Compra, type Etapa, type Obra } from "@/lib/core/modelos";
import { perfilDoPadrao, rotuloPadrao } from "@/lib/core/catalogo";
import { situacaoMateriais, type LinhaMaterial } from "@/lib/core/servicos";
import { diasEntre, dataBr, moeda, num } from "@/lib/core/util";
import { cn } from "@/lib/utils";
import { Campo, CampoNumero, Nota, Pill, corFase } from "./comum";
import { ControleCompras } from "./controle-compras";
import { useEnviar, useSistema } from "./provedor";

export function TelaCompras() {
  const { sis, acao } = useSistema();
  const o = sis.obra!;
  const vista = sis.ui.compras_vista;
  const aPedir = o.etapas.filter((e) => !an.etapaConcluida(e))
    .reduce((s, e) => s + situacaoMateriais(o, e.codigo).filter((x) => x.situacao === "Não solicitado").length, 0);
  const vistas = [
    { k: "controle", rotulo: "Controle de compras", n: o.controle.length ? `${o.controle.length} itens` : "novo" },
    { k: "pedidos", rotulo: "Pedidos de compra", n: String(o.compras.length) },
    { k: "materiais", rotulo: "Lista de materiais por etapa", n: `${aPedir} a pedir` },
  ];
  return (
    <>
      <nav aria-label="Compras" className="flex overflow-x-auto border-b">
        {vistas.map((v) => (
          <button
            key={v.k}
            type="button"
            aria-current={vista === v.k ? "page" : undefined}
            onClick={() => acao("ui.vista_compras", { vista: v.k })}
            className={cn(
              "-mb-px whitespace-nowrap border-b-2 border-transparent px-3 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground md:px-4",
              vista === v.k && "border-foreground font-semibold text-foreground",
            )}
          >
            {v.rotulo} <span className="font-mono text-xs font-normal text-muted-foreground">{v.n}</span>
          </button>
        ))}
      </nav>
      {vista === "controle" && <ControleCompras />}
      {vista === "pedidos" && <Pedidos />}
      {vista === "materiais" && <Materiais />}
    </>
  );
}

// ======================================================================= pedidos
const FILTROS: [string, string][] = [
  ["abertas", "Em aberto"], ["atrasadas", "Atrasadas"], ["todas", "Todas"], ["Entregue", "Entregues"], ["Cancelada", "Canceladas"],
];
const ORDEM_PRIO = Object.fromEntries([...PRIORIDADES].reverse().map((p, i) => [p, i]));

function Pedidos() {
  const { sis, acao } = useSistema();
  const o = sis.obra!;
  const { filtro_compra: filtro, filtro_etapa: fEtapa } = sis.ui;
  const atrasadas = new Set(an.comprasAtrasadas(o, sis.hoje).map((c) => c.id));
  const lista = o.compras
    .filter((c) => {
      if (fEtapa && c.etapa !== fEtapa) return false;
      if (filtro === "abertas") return (an.ABERTAS as readonly string[]).includes(c.status);
      if (filtro === "atrasadas") return atrasadas.has(c.id);
      if (filtro === "todas") return true;
      return c.status === filtro;
    })
    .sort((a, b) =>
      Number(!atrasadas.has(a.id)) - Number(!atrasadas.has(b.id))
      || (ORDEM_PRIO[a.prioridade] ?? 9) - (ORDEM_PRIO[b.prioridade] ?? 9)
      || (a.data_necessidade || "9999").localeCompare(b.data_necessidade || "9999"));
  const fin = an.resumoFinanceiro(o);
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-start gap-2.5 border-b p-3 md:justify-end md:p-4">
        <div className="flex flex-wrap gap-1.5 md:mr-auto">
          {FILTROS.map(([k, r]) => (
            <Button key={k} size="sm" variant={k === filtro ? "sinal" : "outline"} onClick={() => acao("ui.filtro", { filtro_compra: k })}>{r}</Button>
          ))}
        </div>
        <NativeSelect className="w-auto min-w-48" aria-label="Filtrar por etapa" value={fEtapa} onChange={(e) => acao("ui.filtro", { filtro_etapa: e.target.value })}>
          <option value="">Todas as etapas</option>
          {o.etapas.map((e) => <option key={e.codigo} value={e.codigo}>{e.codigo} · {e.nome}</option>)}
        </NativeSelect>
        <Button className="ml-auto md:ml-0" onClick={() => acao("ui.form", { qual: "compra" })}>{sis.ui.form_compra ? "Fechar formulário" : "Nova compra"}</Button>
      </div>
      {sis.ui.form_compra && <FormCompra o={o} />}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-b px-4 py-2 text-[0.8rem]">
        <span>Comprometido <b>{moeda(fin.comprometido)}</b></span>
        <span>Entregue <b>{moeda(fin.realizado)}</b></span>
        <span>Aguardando aprovação <b>{moeda(fin.em_aberto)}</b></span>
        <span className="ml-auto text-muted-foreground">Exibindo {lista.length} pedido(s)</span>
      </div>
      <div className="flex flex-col">
        {lista.length ? lista.map((c) => <LinhaCompra key={c.id} o={o} c={c} atrasada={atrasadas.has(c.id)} />)
          : <Nota className="p-4">Nenhuma compra neste filtro.</Nota>}
      </div>
    </Card>
  );
}

function FormCompra({ o }: { o: Obra }) {
  const enviar = useEnviar();
  return (
    <form className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,180px),1fr))] items-end gap-2.5 border-b bg-muted p-4" onSubmit={enviar("compra.criar", {}, { limpar: true })}>
      <Campo rotulo="Descrição" className="col-span-full"><Input name="descricao" required maxLength={200} placeholder="Ex.: Cimento CP-II 50 kg" /></Campo>
      <Campo rotulo="Etapa">
        <NativeSelect name="etapa">{o.etapas.map((e) => <option key={e.codigo} value={e.codigo}>{e.codigo} · {e.nome}</option>)}</NativeSelect>
      </Campo>
      <Campo rotulo="Categoria"><NativeSelect name="categoria">{CATEGORIAS_COMPRA.map((c) => <option key={c}>{c}</option>)}</NativeSelect></Campo>
      <Campo rotulo="Quantidade"><CampoNumero name="quantidade" texto="1" required /></Campo>
      <Campo rotulo="Unidade"><NativeSelect name="unidade">{UNIDADES.map((u) => <option key={u}>{u}</option>)}</NativeSelect></Campo>
      <Campo rotulo="Valor unitário (R$)"><CampoNumero name="valor_unitario" placeholder="0,00" /></Campo>
      <Campo rotulo="Fornecedor"><Input name="fornecedor" maxLength={200} /></Campo>
      <Campo rotulo="Prioridade"><NativeSelect name="prioridade" defaultValue="Média">{PRIORIDADES.map((p) => <option key={p}>{p}</option>)}</NativeSelect></Campo>
      <Campo rotulo="Precisa chegar até"><Input name="data_necessidade" type="date" /></Campo>
      <Button type="submit">Solicitar compra</Button>
    </form>
  );
}

const SIGLA: Record<string, string> = {
  Material: "MAT", "Mão de obra": "MO", "Serviço terceirizado": "SRV", "Equipamento/locação": "EQP", "Taxas e documentos": "TAX",
};

function LinhaCompra({ o, c, atrasada }: { o: Obra; c: Compra; atrasada: boolean }) {
  const { acao } = useSistema();
  const enviar = useEnviar();
  const etapa = o.etapas.find((e) => e.codigo === c.etapa);
  const cor = etapa ? corFase(etapa.categoria) : "#888";
  const podeCotar = ["Solicitada", "Em cotação", "Aprovada"].includes(c.status);
  const podeExcluir = !["Pedido feito", "Entregue"].includes(c.status);
  return (
    <article className={cn("grid grid-cols-1 gap-2.5 border-b p-3.5 last:border-b-0 md:grid-cols-[auto_minmax(0,1fr)_auto] md:gap-3.5 md:p-4", atrasada && "shadow-[inset_3px_0_0_var(--critico)]")}>
      <span className="self-start justify-self-start rounded-sm border bg-card px-1.5 py-0.5 text-center font-mono text-[0.68rem] font-semibold text-muted-foreground md:mt-0.5 md:min-w-[2.9rem]">
        {SIGLA[c.categoria] ?? c.categoria.slice(0, 3).toUpperCase()}
      </span>
      <div className="flex min-w-0 flex-col gap-1.5">
        <h3 className="break-words font-bold"><span className="font-semibold text-muted-foreground" style={{ textDecorationColor: cor }}>({c.etapa})</span> {c.descricao}</h3>
        <p className="text-[0.82rem]">
          <b className="font-semibold">Etapa:</b> {etapa?.nome ?? c.etapa} · <b className="font-semibold">Qtd.:</b> {num(c.quantidade)} {c.unidade} × {moeda(c.valor_unitario)}
          {c.fornecedor && <> · <b className="font-semibold">Fornecedor:</b> {c.fornecedor}</>}
          {c.material && " · da lista de materiais"}
        </p>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.8rem] text-muted-foreground">
          <span className="inline-flex items-center gap-1"><FlagIcon className="size-3.5" /> {c.categoria}</span>
          <span className="text-border">|</span><Pill texto={c.status} />{atrasada && <Pill texto="Atrasada" />}
          <span className="text-border">|</span>
          <span className="inline-flex items-center gap-1"><CalendarIcon className="size-3.5" />
            {c.data_necessidade ? `até ${dataBr(c.data_necessidade)}` : "sem data"}{c.data_entrega ? ` · entregue em ${dataBr(c.data_entrega)}` : ""}
          </span>
          <span className="text-border">|</span><Pill texto={c.prioridade} />
        </p>
        {podeCotar && (
          <form key={`${c.valor_unitario}|${c.fornecedor}`} className="flex max-w-xl flex-wrap gap-1.5" onSubmit={enviar("compra.preco", { id: c.id })}>
            <CampoNumero name="valor_unitario" valor={c.valor_unitario} aria-label="Valor unitário" placeholder="0,00" className="min-w-0 flex-[1_1_120px]" />
            <Input name="fornecedor" defaultValue={c.fornecedor} placeholder="Fornecedor" aria-label="Fornecedor" maxLength={200} className="min-w-0 flex-[1_1_160px]" />
            <Button type="submit" variant="outline" size="sm" className="h-9">Salvar cotação</Button>
          </form>
        )}
      </div>
      <div className="flex flex-row items-center justify-between gap-2 md:flex-col md:items-end">
        <b className="whitespace-nowrap font-mono tabular-nums">{moeda(valorTotalCompra(c))}</b>
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          {TRANSICOES_COMPRA[c.status].map((st) => (
            <Button key={st} size="xs" variant={st === "Cancelada" ? "outline" : "default"} onClick={() => acao("compra.status", { id: c.id, status: st })}>→ {st}</Button>
          ))}
          {podeExcluir && (
            <Button variant="ghost" size="icon-sm" className="hover:bg-critico-suave hover:text-critico" aria-label="Excluir compra" title="Excluir compra" onClick={() => acao("compra.remover", { id: c.id })}>
              <Trash2Icon />
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}

// ======================================================================= lista de materiais
function Materiais() {
  const { sis, acao } = useSistema();
  const o = sis.obra!;
  const fEtapa = sis.ui.filtro_etapa;
  const etapas = o.etapas.filter((e) => !fEtapa || e.codigo === fEtapa);
  let total = 0;
  let pedidos = 0;
  let entregues = 0;
  const blocos = etapas.map((e) => {
    const linhas = situacaoMateriais(o, e.codigo);
    if (!linhas.length) return null;
    const nPend = linhas.filter((x) => x.situacao === "Não solicitado").length;
    const nEnt = linhas.filter((x) => x.situacao === "Entregue").length;
    total += linhas.length;
    pedidos += linhas.length - nPend;
    entregues += nEnt;
    return <BlocoMateriais key={e.codigo} e={e} linhas={linhas} nPend={nPend} nEnt={nEnt} />;
  });
  const perfil = perfilDoPadrao(o.padrao, o.valor_m2, o.uf_cub);
  const rotuloPerfil = o.padrao === "PERS"
    ? `${rotuloPadrao(perfil)} (mais próximo do valor personalizado de ${moeda(o.valor_m2)}/m²)` : rotuloPadrao(perfil);
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <Nota>{total} materiais · <b>{pedidos}</b> já pedidos · {entregues} entregues · quantidades para {num(o.area_construida)} m² (inclui perdas usuais).</Nota>
        <NativeSelect className="w-auto min-w-48" aria-label="Filtrar por etapa" value={fEtapa} onChange={(ev) => acao("ui.filtro", { filtro_etapa: ev.target.value })}>
          <option value="">Todas as etapas</option>
          {o.etapas.map((e) => <option key={e.codigo} value={e.codigo}>{e.codigo} · {e.nome}</option>)}
        </NativeSelect>
      </div>
      <Nota>
        Lista ajustada ao padrão <b>{rotuloPerfil}</b>: especificação e quantidade de acabamentos e instalações mudam com o padrão
        (itens marcados “ajustado ao padrão”); estrutura, alvenaria e cobertura não mudam. Troque o padrão em <b>Obras</b>.
      </Nota>
      <Nota>
        Ao solicitar, o pedido entra em <b>Pedidos de compra</b> como “Solicitada”, com prazo de chegada 7 dias antes do início da etapa.
        O preço é informado na cotação. Quantidades são estimativas para casa térrea; confira com o projeto executivo.
      </Nota>
      <Card className="overflow-hidden">{blocos}</Card>
    </>
  );
}

function BlocoMateriais({ e, linhas, nPend, nEnt }: { e: Etapa; linhas: LinhaMaterial[]; nPend: number; nEnt: number }) {
  const { sis, acao } = useSistema();
  const aberta = sis.ui.mat_abertas.includes(e.codigo);
  const hoje = sis.hoje;
  const concluida = an.etapaConcluida(e);
  const ini = e.inicio_previsto;
  const dias = ini ? diasEntre(hoje, ini) : null;
  const quando = ini ? (concluida ? "concluída" : dias! > 0 ? `começa em ${dias} dia(s)` : "em andamento ou atrasada") : "";
  const urgente = Boolean(ini && nPend && dias! >= 0 && dias! <= 15 && !concluida);
  const estado = nEnt === linhas.length ? <Pill texto="Entregue" />
    : concluida ? <Badge variant="ok">Etapa concluída</Badge>
    : nPend ? <span className={cn("rounded px-1.5 text-[0.68rem] font-semibold", urgente ? "bg-critico text-selo-texto" : "border text-muted-foreground")}>{nPend} a pedir</span>
    : <Badge variant="info">Tudo pedido</Badge>;
  return (
    <article className={cn("border-b last:border-b-0", urgente && "shadow-[inset_3px_0_0_var(--critico)]")}>
      <button
        type="button"
        aria-expanded={aberta}
        onClick={() => acao("ui.mat_expandir", { codigo: e.codigo })}
        className="grid w-full grid-cols-[auto_auto_auto_1fr] items-center gap-x-2.5 gap-y-1 px-3.5 py-3 text-left hover:bg-muted md:grid-cols-[auto_auto_auto_1fr_auto] md:px-4"
      >
        <ChevronDownIcon className={cn("size-4 text-muted-foreground transition-transform", !aberta && "-rotate-90")} />
        <span className="size-3 rounded-sm" style={{ background: corFase(e.categoria) }} />
        <span className="font-mono text-xs text-muted-foreground">{e.codigo}</span>
        <span className="min-w-0 font-medium">{e.nome}</span>
        <span className="col-start-2 col-end-[-1] justify-self-start md:col-auto md:justify-self-end">{estado}</span>
        <span className="col-start-2 col-end-[-1] text-[0.76rem] text-muted-foreground md:col-start-4">
          {linhas.length} materiais{ini ? ` · ${dataBr(ini)} · ${quando}` : ""}
        </span>
      </button>
      {aberta && (
        <div className="flex flex-col gap-2.5 px-3.5 pb-3.5 md:px-4">
          <Table className="max-sm:[&_thead]:hidden">
            <TableHeader>
              <TableRow><TableHead>Material</TableHead><TableHead>Necessário</TableHead><TableHead>Situação</TableHead><TableHead>Pedir</TableHead></TableRow>
            </TableHeader>
            <TableBody>{linhas.map((x) => <LinhaMaterialView key={x.chave} x={x} />)}</TableBody>
          </Table>
          {concluida && nPend > 0 && <Nota>Etapa concluída: os materiais provavelmente já foram comprados fora do sistema.</Nota>}
          {nPend > 0 && (
            <Button className="self-start" onClick={() => acao("mat.solicitar_etapa", { codigo: e.codigo })}>Solicitar os {nPend} pendentes</Button>
          )}
        </div>
      )}
    </article>
  );
}

function LinhaMaterialView({ x }: { x: LinhaMaterial }) {
  const enviar = useEnviar();
  const sit = x.situacao;
  const pedir = sit === "Não solicitado" || sit === "Parcial";
  return (
    <TableRow className="max-sm:grid max-sm:grid-cols-[1fr_auto] max-sm:gap-x-2.5 max-sm:gap-y-1.5 max-sm:border-b max-sm:py-2.5 max-sm:[&>td]:border-0 max-sm:[&>td]:bg-transparent! max-sm:[&>td]:p-0">
      <TableCell className="min-w-48 whitespace-normal max-sm:col-span-full max-sm:min-w-0 max-sm:font-semibold">
        {x.material}
        {x.categoria !== "Material" && <span className="ml-1 rounded-sm border border-info px-1 text-[0.66rem] font-normal text-info">{x.categoria}</span>}
        {x.ajustado && <span className="ml-1 whitespace-nowrap rounded-sm border border-atencao px-1 text-[0.66rem] font-normal text-atencao">ajustado ao padrão</span>}
      </TableCell>
      <TableCell className="text-right font-mono max-sm:text-left">{num(x.necessario)} {x.un}</TableCell>
      <TableCell className="whitespace-normal">
        <Pill texto={sit} />
        {sit === "Parcial" && x.pedido > 0 && <span className="ml-1 text-xs text-muted-foreground">{num(x.pedido)} {x.un} pedido(s)</span>}
      </TableCell>
      <TableCell className="max-sm:col-span-full max-sm:empty:hidden">
        {pedir && (
          <form className="flex flex-nowrap gap-1.5" onSubmit={enviar("mat.solicitar", { chave: x.chave })}>
            <CampoNumero name="quantidade" texto={num(x.faltante || x.necessario)} aria-label={`Quantidade de ${x.material}`} className="w-26" />
            <Button type="submit" size="sm" variant="outline" className="h-9">Solicitar</Button>
          </form>
        )}
      </TableCell>
    </TableRow>
  );
}
