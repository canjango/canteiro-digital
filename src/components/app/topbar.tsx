"use client";

import * as React from "react";
import {
  BellIcon, BotIcon, Building2Icon, CheckIcon, ChevronsUpDownIcon, ClipboardListIcon, CornerDownLeftIcon, HandCoinsIcon,
  KanbanSquareIcon, LayoutGridIcon, ListChecksIcon, MoreVerticalIcon, NotebookPenIcon, PackageIcon, PaletteIcon, PlusIcon,
  ReceiptIcon, RulerIcon, SearchIcon, ShoppingCartIcon, UserPlusIcon, BoxesIcon,
} from "lucide-react";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuAtalho, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioGroup,
  DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import * as an from "@/lib/core/analise";
import * as md from "@/lib/core/modulos";
import { ABAS_SEM_OBRA } from "@/lib/core/sistema";
import { pct } from "@/lib/core/util";
import * as pl from "@/lib/paleta";
import { cn } from "@/lib/utils";
import { normal } from "./modulo-comum";
import { useSistema } from "./provedor";
import { BotaoTema, useAparencia } from "./tema";

type Icone = React.ComponentType<{ className?: string }>;
type Acao = (nome: string, dados?: Record<string, unknown>) => { ok: boolean };

/** Vai para uma tela e, opcionalmente, executa um passo seguinte (abrir formulário, registro…). */
function irPara(acao: Acao, aba: string, depois?: () => void, vista = "") {
  if (acao("ui.aba", { aba, vista }).ok) depois?.();
}

const BOTAO_ICONE =
  "inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-input bg-card text-foreground transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring [&_svg]:size-4";

export function Topbar() {
  const [busca, setBusca] = React.useState(false);
  // Ctrl+K / ⌘K abre a busca de qualquer tela; "/" também, fora de campos de texto
  React.useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement | null;
      const digitando = alvo && (alvo.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(alvo.tagName));
      if ((e.key.toLowerCase() === "k" && (e.ctrlKey || e.metaKey)) || (e.key === "/" && !digitando)) {
        e.preventDefault();
        setBusca(true);
      }
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, []);
  return (
    <div
      role="banner"
      className="sticky top-0 z-40 -mx-4 border-b bg-card/95 px-3 pt-[env(safe-area-inset-top)] backdrop-blur supports-[backdrop-filter]:bg-card/85 md:-mx-5 md:px-5"
    >
      <div className="flex h-14 items-center gap-2">
        <span className="marca-listras hidden size-7 shrink-0 rounded sm:block md:hidden" aria-hidden title="Canteiro Digital" />
        <SeletorObra />
        <button
          type="button"
          onClick={() => setBusca(true)}
          className="ml-auto hidden h-9 min-w-0 max-w-md flex-1 items-center gap-2 rounded-md border border-input bg-background px-3 text-sm text-muted-foreground transition-colors hover:border-foreground lg:flex"
        >
          <SearchIcon className="size-4 shrink-0" />
          <span className="truncate">Buscar telas, etapas, ordens, contatos…</span>
          <kbd className="ml-auto rounded border bg-card px-1.5 font-mono text-[0.72rem]">Ctrl K</kbd>
        </button>
        <div className="ml-auto flex shrink-0 items-center gap-1.5 lg:ml-0">
          <button type="button" className={cn(BOTAO_ICONE, "lg:hidden")} aria-label="Buscar" title="Buscar (Ctrl K)" onClick={() => setBusca(true)}>
            <SearchIcon />
          </button>
          <MenuNovo />
          <Avisos />
          <StatusGravacao />
          <BotaoTema />
          <MenuMais />
        </div>
      </div>
      <PaletaComandos aberta={busca} aoMudar={setBusca} />
    </div>
  );
}

// ---------------------------------------------------------------- obra ativa
function SeletorObra() {
  const { sis, acao } = useSistema();
  const o = sis.obra;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex h-10 min-w-0 max-w-[min(22rem,100%)] items-center gap-2 rounded-md px-2 text-left transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring data-[state=open]:bg-muted"
        aria-label="Trocar de obra"
      >
        <span className="grid size-8 shrink-0 place-items-center rounded-md bg-sinal text-sinal-foreground">
          <Building2Icon className="size-4" />
        </span>
        <span className="flex min-w-0 flex-col leading-tight">
          <span className="truncate text-sm font-semibold">{o ? o.nome : "Nenhuma obra"}</span>
          <span className="hidden truncate text-[0.74rem] text-muted-foreground sm:block">
            {o ? `${o.padrao} · CUB-${o.uf_cub} · ${pct(an.progressoFisico(o))} executado` : "Escolha ou cadastre uma obra"}
          </span>
        </span>
        <ChevronsUpDownIcon className="size-4 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[min(22rem,calc(100vw-1.5rem))]">
        <DropdownMenuLabel>Obras ({sis.obras.size})</DropdownMenuLabel>
        {sis.ordenadas().map((x) => {
          const pf = an.progressoFisico(x);
          return (
            <DropdownMenuItem key={x.id} onSelect={() => x.id !== o?.id && acao("obra.selecionar", { id: x.id })} className="flex-col items-stretch gap-1">
              <span className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate font-medium">{x.nome}</span>
                {x.id === o?.id && <CheckIcon className="text-ok" />}
              </span>
              <span className="flex items-center gap-2 text-[0.74rem] text-muted-foreground">
                <Progress value={pf} className="w-20" />
                {pct(pf)} · {x.cliente || "sem cliente"}
              </span>
            </DropdownMenuItem>
          );
        })}
        {!sis.obras.size && <p className="px-2.5 py-2 text-sm text-muted-foreground">Nenhuma obra cadastrada.</p>}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => irPara(acao, "obras")}><PlusIcon />Nova obra / gerenciar obras</DropdownMenuItem>
        {!sis.obras.size && <DropdownMenuItem onSelect={() => acao("obra.exemplo")}><LayoutGridIcon />Abrir obra de exemplo</DropdownMenuItem>}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ---------------------------------------------------------------- novo lançamento
function MenuNovo() {
  const { sis, acao } = useSistema();
  const temObra = !!sis.obra;
  const abrirNovo = (aba: string, qual: string) => irPara(acao, aba, () => sis.ui.novo !== qual && acao("ui.novo", { qual }));
  const itens: { rotulo: string; Icone: Icone; executar: () => void; obra?: boolean }[] = [
    { rotulo: "Solicitação de compra", Icone: ClipboardListIcon, obra: true, executar: () => abrirNovo("solicitacoes", "solicitacao") },
    { rotulo: "Ordem de compra", Icone: ReceiptIcon, obra: true, executar: () => abrirNovo("ordens", "ordem") },
    { rotulo: "Pedido de compra", Icone: PackageIcon, obra: true, executar: () => irPara(acao, "compras", () => !sis.ui.form_compra && acao("ui.form", { qual: "compra" }), "pedidos") },
    { rotulo: "Diário de obra (hoje)", Icone: NotebookPenIcon, obra: true, executar: () => abrirNovo("diario", "diario") },
    { rotulo: "Medição de obra", Icone: RulerIcon, obra: true, executar: () => irPara(acao, "medicoes") },
    { rotulo: "Recebimento", Icone: HandCoinsIcon, obra: true, executar: () => abrirNovo("recebimentos", "recebimento") },
    { rotulo: "Tarefa", Icone: KanbanSquareIcon, obra: true, executar: () => irPara(acao, "tarefas", () => !sis.ui.form_tarefa && acao("ui.form", { qual: "tarefa" })) },
  ];
  const cadastros: typeof itens = [
    { rotulo: "Contato", Icone: UserPlusIcon, executar: () => abrirNovo("contatos", "contato") },
    { rotulo: "Insumo", Icone: BoxesIcon, executar: () => abrirNovo("insumos", "insumo") },
    { rotulo: "Obra", Icone: Building2Icon, executar: () => irPara(acao, "obras") },
  ];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md bg-primary px-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        aria-label="Novo lançamento"
      >
        <PlusIcon className="size-4" />
        <span className="hidden sm:inline">Novo</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Na obra{temObra ? "" : " (selecione uma obra)"}</DropdownMenuLabel>
        {itens.map((i) => (
          <DropdownMenuItem key={i.rotulo} disabled={i.obra && !temObra} onSelect={i.executar}><i.Icone />{i.rotulo}</DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Cadastros</DropdownMenuLabel>
        {cadastros.map((i) => <DropdownMenuItem key={i.rotulo} onSelect={i.executar}><i.Icone />{i.rotulo}</DropdownMenuItem>)}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ---------------------------------------------------------------- avisos (alertas da obra)
/** Alertas de compras abrem a vista certa: lista de materiais ou pedidos de compra. */
function vistaDoAlerta(a: an.Alerta) {
  if (/materiais/i.test(a.titulo) || /Lista de materiais/i.test(a.detalhe)) return "materiais";
  return "pedidos";
}

const COR_NIVEL = { critico: "bg-critico", atencao: "bg-atencao", info: "bg-info" } as const;

function Avisos() {
  const { sis, acao } = useSistema();
  const o = sis.obra;
  const lista = o ? an.alertas(o, sis.hoje) : [];
  const criticos = lista.filter((a) => a.nivel === "critico").length;
  return (
    <Popover>
      <PopoverTrigger className={cn(BOTAO_ICONE, "relative")} aria-label={`Avisos: ${lista.length}${criticos ? `, ${criticos} crítico(s)` : ""}`} title="Avisos da obra">
        <BellIcon />
        {lista.length > 0 && (
          <span className={cn("absolute -right-1.5 -top-1.5 min-w-[1.25rem] rounded-full px-1 text-center font-mono text-[0.68rem] font-bold leading-5 text-selo-texto", criticos ? "bg-critico" : "bg-atencao")}>
            {lista.length}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent>
        <div className="flex items-center justify-between border-b px-3.5 py-2.5">
          <h2 className="text-sm font-semibold">Avisos da obra</h2>
          <span className="text-[0.74rem] text-muted-foreground">{criticos} crítico(s) · {lista.length} no total</span>
        </div>
        <ul className="max-h-[min(60dvh,28rem)] overflow-y-auto p-1">
          {lista.map((a, k) => (
            <li key={k}>
              <PopoverClose asChild>
                <button
                  type="button"
                  className="flex w-full items-start gap-2.5 rounded-md px-2.5 py-2 text-left hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
                  onClick={() => irPara(acao, a.aba, undefined, a.aba === "compras" ? vistaDoAlerta(a) : "")}
                >
                  <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", COR_NIVEL[a.nivel])} aria-label={a.nivel} />
                  <span className="flex min-w-0 flex-col">
                    <span className="text-sm font-medium">{a.titulo}</span>
                    <span className="text-[0.78rem] text-muted-foreground">{a.detalhe}</span>
                  </span>
                </button>
              </PopoverClose>
            </li>
          ))}
          {!lista.length && <li className="px-3 py-6 text-center text-sm text-muted-foreground">{o ? "Nenhum aviso. Obra em dia." : "Selecione uma obra para ver os avisos."}</li>}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

// ---------------------------------------------------------------- gravação
function StatusGravacao() {
  const { status } = useSistema();
  if (!status.texto) return null;
  const cor = { ok: "bg-ok", salvando: "bg-atencao animate-pulse", local: "bg-info", erro: "bg-critico", "": "bg-border" }[status.tipo];
  return (
    <span role="status" aria-live="polite" title={status.texto} className={cn("hidden items-center gap-1.5 px-1 text-[0.74rem] text-muted-foreground md:inline-flex", status.tipo === "erro" && "inline-flex text-critico")}>
      <span className={cn("size-2 shrink-0 rounded-full", cor)} aria-hidden />
      <span className="hidden max-w-48 truncate 2xl:inline">{status.texto}</span>
      <span className="sr-only 2xl:hidden">{status.texto}</span>
    </span>
  );
}

// ---------------------------------------------------------------- mais opções
function MenuMais() {
  const { acao } = useSistema();
  const { a } = useAparencia();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={cn(BOTAO_ICONE, "hidden sm:inline-flex")} aria-label="Mais opções" title="Mais opções">
        <MoreVerticalIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel><PaletteIcon className="mr-1 inline size-3.5" />Paleta de cores</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={a.paleta} onValueChange={(v) => pl.definirAparencia({ paleta: v as pl.Paleta })}>
          {pl.PALETAS.map((p) => <DropdownMenuRadioItem key={p.id} value={p.id}>{p.nome}</DropdownMenuRadioItem>)}
        </DropdownMenuRadioGroup>
        <DropdownMenuLabel>Tema</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={a.tema} onValueChange={(v) => pl.definirAparencia({ tema: v as pl.Tema })}>
          {pl.TEMAS.map((t) => <DropdownMenuRadioItem key={t.id} value={t.id}>{t.nome}</DropdownMenuRadioItem>)}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => irPara(acao, "obras")}><BotIcon />Revisão com Claude (configurar)</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => irPara(acao, "inicio")}><LayoutGridIcon />Painel de módulos<DropdownMenuAtalho>Início</DropdownMenuAtalho></DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ---------------------------------------------------------------- busca geral (paleta de comandos)
interface Resultado {
  grupo: string;
  titulo: string;
  sub?: string;
  Icone: Icone;
  executar: () => void;
}

const TELAS: { aba: string; vista?: string; titulo: string; Icone: Icone; termos?: string }[] = [
  { aba: "inicio", titulo: "Início — painel de módulos", Icone: LayoutGridIcon, termos: "home grade" },
  { aba: "painel", titulo: "Painel da obra", Icone: LayoutGridIcon, termos: "dashboard idp avanço custos" },
  { aba: "etapas", titulo: "Etapas construtivas", Icone: ListChecksIcon, termos: "checklist cronograma" },
  { aba: "diario", titulo: "Diário de obra", Icone: NotebookPenIcon, termos: "rdo clima efetivo" },
  { aba: "medicoes", titulo: "Medição de obra", Icone: RulerIcon, termos: "boletim faturamento" },
  { aba: "solicitacoes", titulo: "Solicitações de compras", Icone: ClipboardListIcon, termos: "sc pedido canteiro" },
  { aba: "ordens", titulo: "Ordens de compra", Icone: ReceiptIcon, termos: "oc fornecedor" },
  { aba: "compras", vista: "controle", titulo: "Controle de compras (planilha)", Icone: ShoppingCartIcon, termos: "cotação metodologia" },
  { aba: "compras", vista: "pedidos", titulo: "Pedidos de compra", Icone: PackageIcon },
  { aba: "compras", vista: "materiais", titulo: "Lista de materiais por etapa", Icone: ListChecksIcon, termos: "quantitativo" },
  { aba: "recebimentos", titulo: "Recebimentos", Icone: HandCoinsIcon, termos: "contas a receber parcelas financeiro" },
  { aba: "tarefas", titulo: "Tarefas", Icone: KanbanSquareIcon, termos: "kanban" },
  { aba: "contatos", titulo: "Contatos", Icone: UserPlusIcon, termos: "fornecedores clientes" },
  { aba: "insumos", titulo: "Insumos", Icone: BoxesIcon, termos: "materiais preços catálogo" },
  { aba: "obras", titulo: "Obras", Icone: Building2Icon, termos: "cadastro cub bdi" },
];

function PaletaComandos({ aberta, aoMudar }: { aberta: boolean; aoMudar: (v: boolean) => void }) {
  const { sis, acao } = useSistema();
  const [texto, setTexto] = React.useState("");
  const [sel, setSel] = React.useState(0);
  const listaRef = React.useRef<HTMLUListElement>(null);
  const o = sis.obra;

  const resultados = React.useMemo<Resultado[]>(() => {
    if (!aberta) return [];
    const r: Resultado[] = [];
    for (const t of TELAS) {
      if (!o && !ABAS_SEM_OBRA.includes(t.aba)) continue;
      r.push({ grupo: "Telas", titulo: t.titulo, Icone: t.Icone, sub: t.termos, executar: () => irPara(acao, t.aba, undefined, t.vista) });
    }
    for (const x of sis.ordenadas()) {
      if (x.id !== o?.id) r.push({ grupo: "Obras", titulo: x.nome, sub: x.cliente, Icone: Building2Icon, executar: () => acao("obra.selecionar", { id: x.id }) });
    }
    if (o) {
      for (const e of o.etapas) {
        r.push({
          grupo: "Etapas", titulo: `${e.codigo} · ${e.nome}`, sub: `${e.categoria} · ${pct(an.progressoEtapa(e))}`, Icone: ListChecksIcon,
          executar: () => irPara(acao, "etapas", () => acao("ui.expandir", { codigo: e.codigo })),
        });
      }
      for (const s of o.solicitacoes) {
        r.push({
          grupo: "Solicitações", titulo: `${md.numeroSC(s.numero)} · ${s.itens.map((i) => i.descricao).join(", ")}`, sub: s.status, Icone: ClipboardListIcon,
          executar: () => irPara(acao, "solicitacoes", () => acao("ui.editar", { id: s.id })),
        });
      }
      for (const x of o.ordens) {
        r.push({
          grupo: "Ordens de compra", titulo: `${md.numeroOC(x.numero)} · ${x.fornecedor}`, sub: `${x.status} · ${x.itens.map((i) => i.descricao).join(", ")}`, Icone: ReceiptIcon,
          executar: () => irPara(acao, "ordens", () => acao("ui.editar", { id: x.id })),
        });
      }
      for (const c of o.compras) {
        r.push({ grupo: "Pedidos de compra", titulo: c.descricao, sub: [c.status, c.etapa, c.fornecedor].filter(Boolean).join(" · "), Icone: PackageIcon, executar: () => irPara(acao, "compras", undefined, "pedidos") });
      }
      for (const t of o.tarefas) {
        r.push({ grupo: "Tarefas", titulo: t.titulo, sub: `${t.status}${t.responsavel ? ` · ${t.responsavel}` : ""}`, Icone: KanbanSquareIcon, executar: () => irPara(acao, "tarefas") });
      }
      for (const m of o.medicoes) {
        r.push({ grupo: "Medições", titulo: md.numeroMed(m.numero), sub: m.status, Icone: RulerIcon, executar: () => irPara(acao, "medicoes", () => acao("ui.editar", { id: m.id })) });
      }
    }
    for (const c of sis.cadastros.contatos) {
      r.push({
        grupo: "Contatos", titulo: c.nome, sub: [c.tipo, c.especialidade, c.telefone].filter(Boolean).join(" · "), Icone: UserPlusIcon,
        executar: () => irPara(acao, "contatos", () => acao("ui.editar", { id: c.id })),
      });
    }
    for (const i of sis.cadastros.insumos) {
      r.push({ grupo: "Insumos", titulo: i.descricao, sub: [i.unidade, i.grupo].filter(Boolean).join(" · "), Icone: BoxesIcon, executar: () => irPara(acao, "insumos") });
    }
    const termos = normal(texto.trim()).split(/\s+/).filter(Boolean);
    if (!termos.length) return r.filter((x) => x.grupo === "Telas" || x.grupo === "Obras");
    const filtrados = r.filter((x) => {
      const alvo = normal(`${x.titulo} ${x.sub ?? ""} ${x.grupo}`);
      return termos.every((t) => alvo.includes(t));
    });
    // no máximo 8 por grupo, para a lista não ficar enorme
    const porGrupo = new Map<string, number>();
    return filtrados.filter((x) => {
      const n = (porGrupo.get(x.grupo) ?? 0) + 1;
      porGrupo.set(x.grupo, n);
      return n <= 8;
    });
  }, [aberta, texto, sis, o, acao]);

  React.useEffect(() => setSel(0), [texto, aberta]);
  React.useEffect(() => {
    listaRef.current?.querySelector(`[data-i="${sel}"]`)?.scrollIntoView({ block: "nearest" });
  }, [sel]);

  const executar = (r?: Resultado) => {
    if (!r) return;
    aoMudar(false);
    setTexto("");
    r.executar();
  };
  const tecla = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setSel((v) => Math.min(resultados.length - 1, v + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSel((v) => Math.max(0, v - 1)); }
    else if (e.key === "Enter") { e.preventDefault(); executar(resultados[sel]); }
  };
  let grupoAnterior = "";
  return (
    <Dialog open={aberta} onOpenChange={(v) => { aoMudar(v); if (!v) setTexto(""); }}>
      <DialogContent className="top-[12vh] max-w-2xl translate-y-0 gap-0 overflow-hidden p-0">
        <DialogTitle className="sr-only">Buscar</DialogTitle>
        <DialogDescription className="sr-only">Digite para buscar telas, etapas, ordens, contatos e insumos. Use as setas e Enter.</DialogDescription>
        <div className="flex items-center gap-2 border-b px-3.5 pr-12">
          <SearchIcon className="size-4 shrink-0 text-muted-foreground" />
          <input
            autoFocus
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={tecla}
            placeholder="Buscar telas, etapas, OC-001, fornecedor, insumo…"
            aria-label="Buscar"
            role="combobox"
            aria-expanded
            aria-controls="resultados-busca"
            aria-activedescendant={resultados[sel] ? `res-${sel}` : undefined}
            className="h-12 min-w-0 flex-1 bg-transparent text-[0.95rem] outline-none placeholder:text-muted-foreground"
          />
        </div>
        <ul id="resultados-busca" ref={listaRef} role="listbox" className="max-h-[min(60dvh,26rem)] overflow-y-auto p-1.5">
          {resultados.map((r, k) => {
            const cabecalho = r.grupo !== grupoAnterior;
            grupoAnterior = r.grupo;
            return (
              <React.Fragment key={`${r.grupo}-${k}`}>
                {cabecalho && <li role="presentation" className="px-2.5 pb-1 pt-2.5 text-[0.72rem] font-semibold uppercase tracking-wider text-muted-foreground">{r.grupo}</li>}
                <li
                  id={`res-${k}`}
                  data-i={k}
                  role="option"
                  aria-selected={k === sel}
                  onMouseMove={() => setSel(k)}
                  onClick={() => executar(r)}
                  className={cn("flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2", k === sel && "bg-accent")}
                >
                  <span className={cn("grid size-7 shrink-0 place-items-center rounded-md bg-muted", k === sel && "bg-sinal text-sinal-foreground")}>
                    <r.Icone className="size-4" />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium">{r.titulo}</span>
                    {r.sub && r.grupo !== "Telas" && <span className="truncate text-[0.76rem] text-muted-foreground">{r.sub}</span>}
                  </span>
                  {k === sel && <CornerDownLeftIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />}
                </li>
              </React.Fragment>
            );
          })}
          {!resultados.length && <li className="px-3 py-8 text-center text-sm text-muted-foreground">Nada encontrado para “{texto}”.</li>}
        </ul>
        <div className="flex flex-wrap gap-x-4 gap-y-1 border-t bg-muted px-3.5 py-2 text-[0.74rem] text-muted-foreground">
          <span><kbd className="font-mono">↑ ↓</kbd> navegar</span>
          <span><kbd className="font-mono">Enter</kbd> abrir</span>
          <span><kbd className="font-mono">Esc</kbd> fechar</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
