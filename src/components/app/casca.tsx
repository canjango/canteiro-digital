"use client";

import * as React from "react";
import {
  BoxesIcon, Building2Icon, ClipboardCheckIcon, ClipboardListIcon, HandCoinsIcon, HomeIcon, KanbanSquareIcon, LayoutGridIcon, Loader2Icon,
  NotebookPenIcon, ReceiptIcon, RulerIcon, ShoppingCartIcon, UsersIcon,
} from "lucide-react";

import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";
import * as an from "@/lib/core/analise";
import { PADROES } from "@/lib/core/catalogo";
import { dataBr, moeda, num } from "@/lib/core/util";
import { ABAS_SEM_OBRA, type Aba } from "@/lib/core/sistema";
import { useSistema } from "./provedor";
import { TelaPainel } from "./tela-painel";
import { TelaEtapas } from "./tela-etapas";
import { TelaCompras } from "./tela-compras";
import { TelaTarefas } from "./tela-tarefas";
import { TelaObras } from "./tela-obras";
import { JanelaFigura } from "./janela-figura";
import { TelaInicio } from "./tela-inicio";
import { TelaContatos, TelaInsumos } from "./tela-cadastros";
import { TelaOrdens, TelaSolicitacoes } from "./tela-suprimentos";
import { TelaRecebimentos } from "./tela-recebimentos";
import { TelaDiario, TelaMedicoes } from "./tela-campo";

// celular: só as 5 marcadas aparecem na barra de baixo; o resto fica no painel em grade (Início)
const ABAS_TRILHO: { chave: Aba; rotulo: string; Icone: React.ComponentType<{ className?: string }>; celular?: boolean }[] = [
  { chave: "inicio", rotulo: "Início", Icone: HomeIcon, celular: true },
  { chave: "painel", rotulo: "Painel", Icone: LayoutGridIcon, celular: true },
  { chave: "etapas", rotulo: "Etapas", Icone: ClipboardCheckIcon, celular: true },
  { chave: "diario", rotulo: "Diário", Icone: NotebookPenIcon },
  { chave: "medicoes", rotulo: "Medição", Icone: RulerIcon },
  { chave: "solicitacoes", rotulo: "Solicitar", Icone: ClipboardListIcon },
  { chave: "ordens", rotulo: "Ordens", Icone: ReceiptIcon },
  { chave: "compras", rotulo: "Compras", Icone: ShoppingCartIcon, celular: true },
  { chave: "recebimentos", rotulo: "Receber", Icone: HandCoinsIcon },
  { chave: "tarefas", rotulo: "Tarefas", Icone: KanbanSquareIcon },
  { chave: "contatos", rotulo: "Contatos", Icone: UsersIcon },
  { chave: "insumos", rotulo: "Insumos", Icone: BoxesIcon },
  { chave: "obras", rotulo: "Obras", Icone: Building2Icon, celular: true },
];

const TITULOS: Record<Aba, string> = {
  inicio: "Início",
  painel: "Painel da obra",
  etapas: "Etapas construtivas",
  compras: "Compras e materiais",
  tarefas: "Tarefas",
  obras: "Obras",
  solicitacoes: "Solicitações de compras",
  ordens: "Ordens de compra",
  recebimentos: "Recebimentos",
  diario: "Diário de obra",
  medicoes: "Medição de obra",
  contatos: "Contatos",
  insumos: "Insumos",
};

export function Casca() {
  const { sis, carregado } = useSistema();
  const o = sis.obra;
  const aba: Aba = o || ABAS_SEM_OBRA.includes(sis.ui.aba) ? sis.ui.aba : "inicio";
  if (!carregado) return <Carregando />;
  return (
    <div className="min-h-dvh">
      <Trilho aba={aba} />
      <div className="min-w-0 px-4 pb-24 md:ml-[76px] md:px-5 md:pb-8">
        <Topo aba={aba} />
        <main id="conteudo" className="flex flex-col gap-4 pt-4">
          {aba === "painel" && <TelaPainel />}
          {aba === "etapas" && <TelaEtapas />}
          {aba === "compras" && <TelaCompras />}
          {aba === "tarefas" && <TelaTarefas />}
          {aba === "obras" && <TelaObras />}
          {aba === "inicio" && <TelaInicio />}
          {aba === "solicitacoes" && <TelaSolicitacoes />}
          {aba === "ordens" && <TelaOrdens />}
          {aba === "recebimentos" && <TelaRecebimentos />}
          {aba === "diario" && <TelaDiario />}
          {aba === "medicoes" && <TelaMedicoes />}
          {aba === "contatos" && <TelaContatos />}
          {aba === "insumos" && <TelaInsumos />}
        </main>
        <footer className="mt-7 font-mono text-xs text-muted-foreground">
          Canteiro Digital · Next.js + React · dados salvos automaticamente
        </footer>
      </div>
      {o && <JanelaFigura />}
      <Mensagens />
    </div>
  );
}

function Carregando() {
  return (
    <div className="grid min-h-dvh place-items-center p-4 text-center text-muted-foreground">
      <div className="flex flex-col items-center gap-3">
        <span className="marca-listras size-10 animate-spin rounded-md [animation-duration:1.6s]" aria-hidden />
        <h1 className="text-lg font-bold text-foreground">Canteiro Digital</h1>
        <p className="flex items-center gap-2 text-sm"><Loader2Icon className="size-4 animate-spin" /> Carregando suas obras…</p>
      </div>
    </div>
  );
}

function Trilho({ aba }: { aba: Aba }) {
  const { sis, acao } = useSistema();
  const o = sis.obra;
  const contador = (k: Aba) => {
    if (!o) return 0;
    if (k === "compras") return an.comprasAtrasadas(o, sis.hoje).length;
    if (k === "tarefas") return an.tarefasAtrasadas(o, sis.hoje).length;
    if (k === "solicitacoes") return o.solicitacoes.filter((x) => x.status === "Aguardando aprovação").length;
    if (k === "ordens") return o.ordens.filter((x) => ["Aprovada", "Enviada", "Recebida parcialmente"].includes(x.status) && x.entrega_prevista && x.entrega_prevista < sis.hoje).length;
    if (k === "recebimentos") return o.recebimentos.filter((x) => x.status === "Previsto" && x.vencimento < sis.hoje).length;
    return 0;
  };
  return (
    <nav
      aria-label="Seções"
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 flex justify-around gap-0.5 border-t border-white/10 bg-trilho px-1 pt-1 pb-[calc(0.25rem+env(safe-area-inset-bottom))]",
        "md:inset-y-0 md:left-0 md:right-auto md:w-[76px] md:flex-col md:justify-start md:overflow-y-auto md:border-t-0 md:px-1.5 md:pt-[calc(0.6rem+env(safe-area-inset-top))] md:pb-2 md:[scrollbar-width:none]",
      )}
    >
      <div className="hidden h-12 place-items-center md:mb-2 md:grid" title="Canteiro Digital">
        <span className="marca-listras size-7 rounded" aria-hidden />
      </div>
      {ABAS_TRILHO.map(({ chave, rotulo, Icone, celular }) => {
        const ativa = chave === aba;
        const n = contador(chave);
        const desabilitada = !o && !ABAS_SEM_OBRA.includes(chave);
        return (
          <button
            key={chave}
            type="button"
            disabled={desabilitada}
            aria-current={ativa ? "page" : undefined}
            title={rotulo}
            onClick={() => acao("ui.aba", { aba: chave })}
            className={cn(
              "relative flex-1 flex-col items-center gap-0.5 rounded-md px-0.5 pt-2 pb-1.5 text-trilho-foreground transition-colors md:flex md:flex-none md:pt-1.5 md:pb-1",
              celular ? "flex" : "hidden",
              "hover:bg-white/10 hover:text-white disabled:opacity-35 disabled:hover:bg-transparent",
              ativa && "bg-white/10 text-white shadow-[inset_0_3px_0_var(--sinal)] md:shadow-[inset_3px_0_0_var(--sinal)]",
            )}
          >
            <Icone className="size-5" />
            <span className="text-[0.66rem] font-medium">{rotulo}</span>
            {n > 0 && (
              <span className="absolute right-[calc(50%-22px)] top-1 min-w-[1.4em] rounded-full bg-critico px-1 text-center font-mono text-[0.62rem] leading-[1.5] text-white" title="atrasadas">
                {n}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}

function Topo({ aba }: { aba: Aba }) {
  const { sis, acao } = useSistema();
  const o = sis.obra;
  return (
    <header className="flex flex-col gap-1.5 border-b border-dashed pt-[calc(0.85rem+env(safe-area-inset-top))] pb-3 md:sticky md:top-0 md:z-30 md:bg-background">
      <div className="flex flex-wrap items-end justify-between gap-x-5 gap-y-2">
        <div className="min-w-0">
          <p className="mb-1 flex flex-wrap items-center gap-1.5 text-[0.85rem] text-muted-foreground">
            <button type="button" className="hover:text-foreground hover:underline" onClick={() => acao("ui.aba", { aba: "inicio" })}>
              Início
            </button>
            <span aria-hidden>›</span>
            {o ? (
              <>
                <span className="text-foreground">{o.nome}</span>
                <span className="rounded-sm border bg-card px-1.5 text-[0.66rem] font-bold uppercase tracking-wide">
                  {o.exemplo ? "Exemplo · " : ""}{o.padrao}
                </span>
              </>
            ) : (
              <span className="text-foreground">sem obra selecionada</span>
            )}
          </p>
          <h1 className="text-xl font-bold md:text-[1.3rem]">{TITULOS[aba]}</h1>
        </div>
        <div className="w-full md:w-80">
          {o ? (
            <NativeSelect aria-label="Obra ativa" value={o.id} onChange={(e) => acao("obra.selecionar", { id: e.target.value })}>
              {sis.ordenadas().map((x) => (
                <option key={x.id} value={x.id}>{x.nome}</option>
              ))}
            </NativeSelect>
          ) : (
            <span className="flex h-9 items-center rounded-md border border-dashed px-3 text-sm text-muted-foreground">Nenhuma obra</span>
          )}
          <EstadoGravacao />
        </div>
      </div>
      {o && (
        <p className="text-[0.8rem] text-muted-foreground">
          {[
            o.cliente, o.endereco, `${num(o.area_construida)} m²`,
            `padrão ${(PADROES[o.padrao]?.nome ?? o.padrao).toLowerCase()} · ${moeda(o.valor_m2)}/m² · CUB-${o.uf_cub}`,
            o.bdi ? `BDI ${num(o.bdi)}%` : "",
            o.inicio ? `${dataBr(o.inicio)} → ${dataBr(o.fim_previsto)}` : "sem cronograma",
          ].filter(Boolean).join(" · ")}
        </p>
      )}
    </header>
  );
}

/** Mensagem da última ação (sucesso ou erro), como aviso flutuante. */
function Mensagens() {
  const { sis, avisoId } = useSistema();
  const { msg, erro } = sis.ui;
  const [visivel, setVisivel] = React.useState(true);
  // reaparece só depois de uma nova ação (dados chegando do banco não repetem o aviso)
  React.useEffect(() => {
    setVisivel(true);
    if (!msg && !erro) return;
    const t = setTimeout(() => setVisivel(false), erro ? 9000 : 4500);
    return () => clearTimeout(t);
  }, [avisoId]); // eslint-disable-line react-hooks/exhaustive-deps
  if ((!msg && !erro) || !visivel) return null;
  return (
    <div className="pointer-events-none fixed inset-x-4 top-3 z-50 flex justify-center md:left-[92px]">
      <div
        role={erro ? "alert" : "status"}
        className={cn(
          "pointer-events-auto flex max-w-xl items-start gap-3 rounded-md border-l-4 bg-card px-4 py-2.5 text-sm font-medium shadow-lg",
          erro ? "border-l-critico" : "border-l-ok",
        )}
      >
        <span className="min-w-0 flex-1">{erro || msg}</span>
        <button type="button" className="text-muted-foreground hover:text-foreground" aria-label="Fechar aviso" onClick={() => setVisivel(false)}>
          ×
        </button>
      </div>
    </div>
  );
}

function EstadoGravacao() {
  const { status } = useSistema();
  if (!status.texto) return null;
  const cor = { ok: "text-ok", salvando: "text-atencao", local: "text-info", erro: "text-critico", "": "" }[status.tipo];
  return (
    <div
      role="status"
      aria-live="polite"
      title={status.texto}
      className={cn(
        "mt-1 truncate font-mono md:text-right text-[0.7rem] text-muted-foreground",
        status.tipo === "erro" && "text-critico",
      )}
    >
      <span className={cn("mr-1", cor)}>●</span>
      {status.texto}
    </div>
  );
}
