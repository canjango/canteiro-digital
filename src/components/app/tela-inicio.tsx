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
import * as pl from "@/lib/paleta";
import { cn } from "@/lib/utils";
import { Nota } from "./comum";
import { useSistema } from "./provedor";
import { useAparencia } from "./tema";

type Icone = React.ComponentType<{ className?: string }>;
interface Botao {
  aba: string;
  vista?: string;
  titulo: string;
  descricao: string;
  Icone: Icone;
  info?: (o: Obra | null, hoje: string) => { texto: string; alerta?: boolean } | null;
  novo?: boolean;
}

const GRUPOS: { titulo: string; botoes: Botao[]; span?: string }[] = [
  {
    titulo: "Acompanhamento da obra",
    botoes: [
      {
        aba: "painel", titulo: "Painel", descricao: "Avanço físico, prazo (IDP), medição, custos e alertas", Icone: LayoutDashboardIcon,
        info: (o, h) => (o ? { texto: `${pct(an.progressoFisico(o))} executado · ${an.alertas(o, h).filter((a) => a.nivel === "critico").length} alerta(s) crítico(s)` } : null),
      },
      {
        aba: "etapas", titulo: "Etapas construtivas", descricao: "17 etapas com checklist de qualidade, escopo e detalhes técnicos", Icone: ListChecksIcon,
        info: (o, h) => {
          if (!o) return null;
          const atrasadas = o.etapas.filter((e) => an.statusEtapa(o, e, h) === "Atrasada").length;
          return { texto: atrasadas ? `${atrasadas} etapa(s) atrasada(s)` : `${o.etapas.filter(an.etapaConcluida).length}/${o.etapas.length} concluídas`, alerta: atrasadas > 0 };
        },
      },
      {
        aba: "diario", titulo: "Diário de obra", descricao: "RDO: clima, efetivo, equipamentos, atividades e ocorrências do dia", Icone: NotebookPenIcon, novo: true,
        info: (o) => {
          if (!o) return null;
          const r = md.resumoDiario(o);
          return { texto: r.dias ? `${r.dias} dia(s) registrados · ${r.chuva} com chuva` : "Nenhum registro ainda" };
        },
      },
      {
        aba: "medicoes", titulo: "Medição de obra", descricao: "Boletim por etapa: % medido, valor do período com BDI e aprovação", Icone: RulerIcon, novo: true,
        info: (o) => {
          if (!o) return null;
          const elab = o.medicoes.find((m) => m.status === "Em elaboração");
          const aprov = o.medicoes.filter((m) => m.status === "Aprovada").length;
          return elab ? { texto: `${md.numeroMed(elab.numero)} em elaboração`, alerta: true } : { texto: `${aprov} medição(ões) aprovada(s)` };
        },
      },
    ],
  },
  {
    titulo: "Suprimentos",
    botoes: [
      {
        aba: "solicitacoes", titulo: "Solicitações de compras", descricao: "Pedidos do canteiro com aprovação antes da compra", Icone: ClipboardListIcon, novo: true,
        info: (o) => {
          if (!o) return null;
          const n = o.solicitacoes.filter((s) => s.status === "Aguardando aprovação").length;
          const ap = o.solicitacoes.filter((s) => s.status === "Aprovada").length;
          return { texto: n ? `${n} aguardando aprovação` : ap ? `${ap} aprovada(s) sem ordem` : `${o.solicitacoes.length} solicitação(ões)`, alerta: n > 0 };
        },
      },
      {
        aba: "ordens", titulo: "Ordem de compra", descricao: "Fornecedor, preços, pagamento, aprovação e recebimento do material", Icone: ReceiptIcon, novo: true,
        info: (o, h) => {
          if (!o) return null;
          const abertas = o.ordens.filter((x) => ["Aprovada", "Enviada", "Recebida parcialmente"].includes(x.status));
          const atrasadas = abertas.filter((x) => x.entrega_prevista && x.entrega_prevista < h).length;
          return { texto: atrasadas ? `${atrasadas} entrega(s) atrasada(s)` : `${abertas.length} aguardando entrega`, alerta: atrasadas > 0 };
        },
      },
      {
        aba: "compras", vista: "controle", titulo: "Controle de compras", descricao: "Planilha de compras: base, cotação, decisão, compra e entrega", Icone: ShoppingCartIcon,
        info: (o) => (o ? { texto: o.controle.length ? `${o.controle.filter((i) => i.status === "Comprado" || i.status === "Entregue").length}/${o.controle.length} itens comprados` : "Base da planilha não carregada" } : null),
      },
      {
        aba: "compras", vista: "pedidos", titulo: "Pedidos de compra", descricao: "Pedidos simples com cotação, aprovação e entrega", Icone: PackageIcon,
        info: (o, h) => {
          if (!o) return null;
          const atrasadas = an.comprasAtrasadas(o, h).length;
          return { texto: atrasadas ? `${atrasadas} atrasado(s)` : `${o.compras.length} pedido(s)`, alerta: atrasadas > 0 };
        },
      },
      {
        aba: "compras", vista: "materiais", titulo: "Lista de materiais", descricao: "Materiais por etapa, ajustados à área e ao padrão", Icone: ListOrderedIcon,
        info: (o) => (o ? { texto: `${o.etapas.filter((e) => !an.etapaConcluida(e)).reduce((s, e) => s + situacaoMateriais(o, e.codigo).filter((x) => x.situacao === "Não solicitado").length, 0)} a pedir` } : null),
      },
      {
        aba: "insumos", titulo: "Insumos", descricao: "Cadastro de materiais, mão de obra e equipamentos com preço de referência", Icone: BoxesIcon, novo: true,
      },
    ],
  },
  {
    titulo: "Financeiro",
    span: "sm:col-span-1",
    botoes: [
      {
        aba: "recebimentos", titulo: "Recebimentos", descricao: "Contas a receber do cliente: parcelas do contrato e das medições", Icone: HandCoinsIcon, novo: true,
        info: (o, h) => {
          if (!o) return null;
          const r = md.resumoRecebimentos(o, an.precoVenda(o), h);
          return r.n_atrasados ? { texto: `${moeda(r.atrasado)} em atraso`, alerta: true } : { texto: `${moeda(r.recebido)} recebido · ${moeda(r.a_receber)} a receber` };
        },
      },
    ],
  },
  {
    titulo: "Gestão e cadastros",
    span: "sm:col-span-2 lg:col-span-3",
    botoes: [
      {
        aba: "tarefas", titulo: "Tarefas", descricao: "Quadro de tarefas com responsável, prazo e checklist", Icone: KanbanSquareIcon,
        info: (o, h) => {
          if (!o) return null;
          const atrasadas = an.tarefasAtrasadas(o, h).length;
          return { texto: atrasadas ? `${atrasadas} atrasada(s)` : `${o.tarefas.filter((t) => t.status !== "Concluída").length} em aberto`, alerta: atrasadas > 0 };
        },
      },
      { aba: "contatos", titulo: "Contatos", descricao: "Fornecedores, prestadores, clientes, funcionários e projetistas", Icone: UsersIcon, novo: true },
      {
        aba: "obras", titulo: "Obras", descricao: "Cadastro das obras, padrão construtivo, CUB por estado e BDI", Icone: Building2Icon,
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
    <div className="grid grid-cols-2 gap-x-2.5 gap-y-5 sm:grid-cols-3 lg:grid-cols-4">
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
              return (
                <button
                  key={`${b.aba}-${b.vista ?? ""}`}
                  type="button"
                  disabled={bloqueado}
                  onClick={() => acao("ui.aba", { aba: b.aba, vista: b.vista ?? "" })}
                  className={cn(
                    "group flex min-h-[128px] min-w-0 flex-col items-start gap-2 rounded-lg border bg-card p-3.5 text-left transition-[border-color,box-shadow]",
                    "hover:border-foreground hover:shadow-[inset_0_-3px_0_var(--sinal)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                    "disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:border-border disabled:hover:shadow-none",
                  )}
                >
                  <span className="flex w-full items-start justify-between gap-2">
                    <span className="grid size-10 place-items-center rounded-md bg-trilho text-sinal transition-colors group-hover:bg-sinal group-hover:text-sinal-foreground">
                      <b.Icone className="size-5" />
                    </span>
                    {b.novo && <span className="rounded-sm border border-foreground/15 bg-sinal px-1 text-[0.68rem] font-bold uppercase leading-4 text-sinal-foreground">novo</span>}
                  </span>
                  <span className="flex w-full items-center gap-1 text-[0.95rem] font-semibold leading-tight break-words">
                    {b.titulo}
                    <ChevronRightIcon className="ml-auto size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </span>
                  <span className="hidden text-[0.76rem] leading-snug text-muted-foreground sm:block">{b.descricao}</span>
                  {info && (
                    <span className={cn("mt-auto text-[0.74rem] font-medium", info && "alerta" in info && info.alerta ? "text-critico" : "text-muted-foreground")}>
                      {info.texto}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>
      ))}
      <Aparencia />
    </div>
  );
}

/** Escolha da paleta e do tema (por pessoa, guardado só neste navegador). */
function Aparencia() {
  const { a } = useAparencia();
  const mudar = (novo: Partial<pl.Aparencia>) => pl.definirAparencia(novo);
  return (
    <section className="col-span-full flex flex-col gap-2.5" aria-label="Aparência">
      <h2 className="text-[0.78rem] font-semibold uppercase tracking-wider text-muted-foreground">Aparência</h2>
      <Card className="flex-row flex-wrap items-start gap-x-6 gap-y-3 p-3.5">
        <div className="flex min-w-0 flex-col gap-1.5">
          <span className="text-[0.82rem] font-medium">Paleta de cores</span>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Paleta de cores">
            {pl.PALETAS.map((p) => (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={a.paleta === p.id}
                onClick={() => mudar({ paleta: p.id })}
                className={cn(
                  "flex items-center gap-2.5 rounded-md border px-3 py-2 text-left transition-colors hover:border-foreground",
                  a.paleta === p.id && "border-foreground shadow-[inset_0_-3px_0_var(--sinal)]",
                )}
              >
                <span className="flex overflow-hidden rounded-sm border border-foreground/20" aria-hidden>
                  {p.amostra.map((c) => <span key={c} className="size-4" style={{ background: c }} />)}
                </span>
                <span className="flex flex-col">
                  <span className="text-[0.86rem] font-semibold">{p.nome}</span>
                  <span className="text-[0.76rem] text-muted-foreground">{p.desc}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-[0.82rem] font-medium">Tema</span>
          <div className="flex rounded-md border p-0.5" role="radiogroup" aria-label="Tema">
            {pl.TEMAS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={a.tema === t.id}
                onClick={() => mudar({ tema: t.id })}
                className={cn("rounded px-3 py-1.5 text-[0.84rem] font-medium hover:bg-muted", a.tema === t.id && "bg-primary text-primary-foreground hover:bg-primary")}
              >
                {t.nome}
              </button>
            ))}
          </div>
        </div>
        <Nota className="basis-full text-[0.78rem]">A escolha vale só para você, neste navegador.</Nota>
      </Card>
    </section>
  );
}
