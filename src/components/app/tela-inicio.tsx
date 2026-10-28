"use client";

import * as React from "react";
import {
  BoxesIcon, Building2Icon, ChevronRightIcon, ClipboardListIcon, HandCoinsIcon, KanbanSquareIcon, LayoutDashboardIcon,
  ListChecksIcon, ListOrderedIcon, NotebookPenIcon, PackageIcon, ReceiptIcon, RulerIcon, ShoppingCartIcon, UsersIcon,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import * as an from "@/lib/core/analise";
import * as md from "@/lib/core/modulos";
import { situacaoMateriais } from "@/lib/core/servicos";
import type { Obra } from "@/lib/core/modelos";
import { ABAS_SEM_OBRA } from "@/lib/core/sistema";
import { moeda, pct } from "@/lib/core/util";
import { cn } from "@/lib/utils";
import { Nota } from "./comum";
import { useSistema } from "./provedor";

type Icone = React.ComponentType<{ className?: string }>;
interface Botao {
  aba: string;
  vista?: string;
  titulo: string;
  descricao: string;
  Icone: Icone;
  cor: string;
  info?: (o: Obra | null, hoje: string) => { texto: string; alerta?: boolean } | null;
  novo?: boolean;
}

const GRUPOS: { titulo: string; botoes: Botao[]; span?: string }[] = [
  {
    titulo: "Acompanhamento da obra",
    botoes: [
      {
        aba: "painel", titulo: "Painel", descricao: "Avanço físico, prazo (IDP), medição, custos e alertas", Icone: LayoutDashboardIcon, cor: "#2c87d0",
        info: (o, h) => (o ? { texto: `${pct(an.progressoFisico(o))} executado · ${an.alertas(o, h).filter((a) => a.nivel === "critico").length} alerta(s) crítico(s)` } : null),
      },
      {
        aba: "etapas", titulo: "Etapas construtivas", descricao: "17 etapas com checklist de qualidade, escopo e detalhes técnicos", Icone: ListChecksIcon, cor: "#2f9a58",
        info: (o, h) => {
          if (!o) return null;
          const atrasadas = o.etapas.filter((e) => an.statusEtapa(o, e, h) === "Atrasada").length;
          return { texto: atrasadas ? `${atrasadas} etapa(s) atrasada(s)` : `${o.etapas.filter(an.etapaConcluida).length}/${o.etapas.length} concluídas`, alerta: atrasadas > 0 };
        },
      },
      {
        aba: "diario", titulo: "Diário de obra", descricao: "RDO: clima, efetivo, equipamentos, atividades e ocorrências do dia", Icone: NotebookPenIcon, cor: "#8d6e4f", novo: true,
        info: (o) => {
          if (!o) return null;
          const r = md.resumoDiario(o);
          return { texto: r.dias ? `${r.dias} dia(s) registrados · ${r.chuva} com chuva` : "Nenhum registro ainda" };
        },
      },
      {
        aba: "medicoes", titulo: "Medição de obra", descricao: "Boletim por etapa: % medido, valor do período com BDI e aprovação", Icone: RulerIcon, cor: "#c8372d", novo: true,
        info: (o) => {
          if (!o) return null;
          const elab = o.medicoes.find((m) => m.status === "Em elaboração");
          const aprov = o.medicoes.filter((m) => m.status === "Aprovada").length;
          return elab ? { texto: `${md.numeroMed(elab.numero)} em elaboração`, alerta: true } : { texto: `${aprov} medição(ões) aprovada(s)` };
        },
      },
      {
        aba: "tarefas", titulo: "Tarefas", descricao: "Quadro de tarefas com responsável, prazo e checklist", Icone: KanbanSquareIcon, cor: "#7e3fa0",
        info: (o, h) => {
          if (!o) return null;
          const atrasadas = an.tarefasAtrasadas(o, h).length;
          return { texto: atrasadas ? `${atrasadas} atrasada(s)` : `${o.tarefas.filter((t) => t.status !== "Concluída").length} em aberto`, alerta: atrasadas > 0 };
        },
      },
    ],
  },
  {
    titulo: "Suprimentos",
    botoes: [
      {
        aba: "solicitacoes", titulo: "Solicitações de compras", descricao: "Pedidos do canteiro com aprovação antes da compra", Icone: ClipboardListIcon, cor: "#e0782f", novo: true,
        info: (o) => {
          if (!o) return null;
          const n = o.solicitacoes.filter((s) => s.status === "Aguardando aprovação").length;
          const ap = o.solicitacoes.filter((s) => s.status === "Aprovada").length;
          return { texto: n ? `${n} aguardando aprovação` : ap ? `${ap} aprovada(s) sem ordem` : `${o.solicitacoes.length} solicitação(ões)`, alerta: n > 0 };
        },
      },
      {
        aba: "ordens", titulo: "Ordem de compra", descricao: "Fornecedor, preços, pagamento, aprovação e recebimento do material", Icone: ReceiptIcon, cor: "#d9b40f", novo: true,
        info: (o, h) => {
          if (!o) return null;
          const abertas = o.ordens.filter((x) => ["Aprovada", "Enviada", "Recebida parcialmente"].includes(x.status));
          const atrasadas = abertas.filter((x) => x.entrega_prevista && x.entrega_prevista < h).length;
          return { texto: atrasadas ? `${atrasadas} entrega(s) atrasada(s)` : `${abertas.length} aguardando entrega`, alerta: atrasadas > 0 };
        },
      },
      {
        aba: "compras", vista: "controle", titulo: "Controle de compras", descricao: "Planilha de compras: base, cotação, decisão, compra e entrega", Icone: ShoppingCartIcon, cor: "#2c87d0",
        info: (o) => (o ? { texto: o.controle.length ? `${o.controle.filter((i) => i.status === "Comprado" || i.status === "Entregue").length}/${o.controle.length} itens comprados` : "Base da planilha não carregada" } : null),
      },
      {
        aba: "compras", vista: "pedidos", titulo: "Pedidos de compra", descricao: "Pedidos simples com cotação, aprovação e entrega", Icone: PackageIcon, cor: "#5b6b7a",
        info: (o, h) => {
          if (!o) return null;
          const atrasadas = an.comprasAtrasadas(o, h).length;
          return { texto: atrasadas ? `${atrasadas} atrasado(s)` : `${o.compras.length} pedido(s)`, alerta: atrasadas > 0 };
        },
      },
      {
        aba: "compras", vista: "materiais", titulo: "Lista de materiais", descricao: "Materiais por etapa, ajustados à área e ao padrão", Icone: ListOrderedIcon, cor: "#2f9a58",
        info: (o) => (o ? { texto: `${o.etapas.filter((e) => !an.etapaConcluida(e)).reduce((s, e) => s + situacaoMateriais(o, e.codigo).filter((x) => x.situacao === "Não solicitado").length, 0)} a pedir` } : null),
      },
      {
        aba: "insumos", titulo: "Insumos", descricao: "Cadastro de materiais, mão de obra e equipamentos com preço de referência", Icone: BoxesIcon, cor: "#7e3fa0", novo: true,
      },
    ],
  },
  {
    titulo: "Financeiro",
    span: "sm:col-span-1",
    botoes: [
      {
        aba: "recebimentos", titulo: "Recebimentos", descricao: "Contas a receber do cliente: parcelas do contrato e das medições", Icone: HandCoinsIcon, cor: "#2f9a58", novo: true,
        info: (o, h) => {
          if (!o) return null;
          const r = md.resumoRecebimentos(o, an.precoVenda(o), h);
          return r.n_atrasados ? { texto: `${moeda(r.atrasado)} em atraso`, alerta: true } : { texto: `${moeda(r.recebido)} recebido · ${moeda(r.a_receber)} a receber` };
        },
      },
    ],
  },
  {
    titulo: "Cadastros",
    span: "sm:col-span-2",
    botoes: [
      { aba: "contatos", titulo: "Contatos", descricao: "Fornecedores, prestadores, clientes, funcionários e projetistas", Icone: UsersIcon, cor: "#c8372d", novo: true },
      {
        aba: "obras", titulo: "Obras", descricao: "Cadastro das obras, padrão construtivo, CUB por estado e BDI", Icone: Building2Icon, cor: "#1b1d21",
      },
    ],
  },
];

export function TelaInicio() {
  const { sis, acao } = useSistema();
  const o = sis.obra;
  const extras: Record<string, (o: Obra | null) => { texto: string } | null> = {
    insumos: () => ({ texto: `${sis.cadastros.insumos.length} insumo(s) cadastrados` }),
    contatos: () => ({ texto: `${sis.cadastros.contatos.length} contato(s)` }),
    obras: () => ({ texto: `${sis.obras.size} obra(s)` }),
  };
  return (
    <div className="grid grid-cols-2 gap-x-2.5 gap-y-5 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
      {!o && (
        <Card className="col-span-full gap-1.5 p-4 shadow-[inset_4px_0_0_var(--sinal)]">
          <h2 className="font-semibold">Nenhuma obra selecionada</h2>
          <Nota>Cadastre uma obra (ou abra a obra de exemplo) em <b>Obras</b> para liberar os módulos da obra. Contatos e insumos já podem ser cadastrados.</Nota>
        </Card>
      )}
      {GRUPOS.map((g) => (
        <section key={g.titulo} className={cn("col-span-full grid grid-cols-subgrid content-start gap-y-2.5", g.span)} aria-label={g.titulo}>
          <h2 className="col-span-full text-[0.74rem] font-semibold uppercase tracking-wider text-muted-foreground">{g.titulo}</h2>
          <div className="col-span-full grid grid-cols-subgrid gap-y-2.5">
            {g.botoes.map((b) => {
              const bloqueado = !o && !ABAS_SEM_OBRA.includes(b.aba);
              const info = b.info ? b.info(o, sis.hoje) : extras[b.aba]?.(o) ?? null;
              const ativo = sis.ui.aba === b.aba && (!b.vista || sis.ui.compras_vista === b.vista);
              return (
                <button
                  key={`${b.aba}-${b.vista ?? ""}`}
                  type="button"
                  disabled={bloqueado}
                  onClick={() => acao("ui.aba", { aba: b.aba, vista: b.vista ?? "" })}
                  className={cn(
                    "group relative flex min-h-[132px] flex-col items-start gap-2 rounded-lg border bg-card p-3.5 text-left transition-colors",
                    "hover:border-foreground/40 hover:shadow-sm focus-visible:outline-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-45",
                    ativo && "border-foreground",
                  )}
                >
                  <span className="grid size-10 place-items-center rounded-md text-white" style={{ background: b.cor }}>
                    <b.Icone className="size-5" />
                  </span>
                  <span className="flex w-full items-center gap-1 text-[0.95rem] font-semibold leading-tight">
                    {b.titulo}
                    <ChevronRightIcon className="ml-auto size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </span>
                  <span className="hidden text-[0.76rem] leading-snug text-muted-foreground sm:block">{b.descricao}</span>
                  {info && (
                    <span className={cn("mt-auto text-[0.74rem] font-medium", info && "alerta" in info && info.alerta ? "text-critico" : "text-muted-foreground")}>
                      {info.texto}
                    </span>
                  )}
                  {b.novo && <span className="absolute right-2.5 top-2.5 rounded-sm bg-sinal px-1 text-[0.6rem] font-bold uppercase text-sinal-foreground">novo</span>}
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
