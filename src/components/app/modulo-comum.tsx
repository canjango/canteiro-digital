"use client";

import * as React from "react";
import { PlusIcon, SearchIcon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Nota } from "./comum";
import { useSistema } from "./provedor";

/** Faixa do topo dos módulos: explicação curta + botão de novo registro. */
export function BarraModulo({ texto, qual, rotuloNovo, children }: { texto: React.ReactNode; qual?: string; rotuloNovo?: string; children?: React.ReactNode }) {
  const { sis, acao } = useSistema();
  const aberto = qual && sis.ui.novo === qual;
  return (
    <Card className="flex-row flex-wrap items-center justify-between gap-2.5 p-3 md:p-4">
      <Nota className="min-w-0 flex-1 basis-72">{texto}</Nota>
      <div className="flex flex-wrap gap-2">
        {children}
        {qual && (
          <Button onClick={() => acao("ui.novo", { qual })} variant={aberto ? "outline" : "default"}>
            {aberto ? <XIcon /> : <PlusIcon />}
            {aberto ? "Fechar formulário" : rotuloNovo}
          </Button>
        )}
      </div>
    </Card>
  );
}

/** Indicadores em blocos (como os números de topo do painel). */
export function Indicadores({ itens }: { itens: { rotulo: string; valor: string; sub?: string; tom?: "critico" | "ok" | "atencao" }[] }) {
  return (
    <div className="grid grid-cols-2 gap-2.5 md:grid-cols-[repeat(auto-fit,minmax(170px,1fr))]">
      {itens.map((i) => (
        <Card key={i.rotulo} className="gap-0.5 p-3">
          <span className="text-[0.76rem] font-medium uppercase tracking-wide text-muted-foreground">{i.rotulo}</span>
          <span className={cn("font-mono text-[1.05rem] font-semibold", i.tom === "critico" && "text-critico", i.tom === "ok" && "text-ok", i.tom === "atencao" && "text-atencao")}>
            {i.valor}
          </span>
          {i.sub && <span className="text-[0.74rem] text-muted-foreground">{i.sub}</span>}
        </Card>
      ))}
    </div>
  );
}

/** Excluir com confirmação no segundo clique (o sistema guarda qual registro está confirmando). */
export function BotaoExcluir({ acaoNome, id, rotulo = "Excluir", pergunta = "Excluir mesmo?" }: { acaoNome: string; id: string; rotulo?: string; pergunta?: string }) {
  const { sis, acao } = useSistema();
  if (sis.ui.confirmar === id) {
    return (
      <span className="flex flex-wrap items-center gap-2 text-sm font-semibold text-critico">
        {pergunta}
        <Button variant="destructive" size="sm" onClick={() => acao(acaoNome, { id })}>Sim, excluir</Button>
        <Button variant="outline" size="sm" onClick={() => acao("ui.cancelar")}>Cancelar</Button>
      </span>
    );
  }
  return (
    <Button variant="link" size="sm" className="px-0 text-muted-foreground underline" onClick={() => acao(acaoNome, { id })}>
      {rotulo}
    </Button>
  );
}

export function Busca({ valor, aoMudar, placeholder }: { valor: string; aoMudar: (v: string) => void; placeholder: string }) {
  return (
    <label className="relative block w-full md:w-72">
      <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input type="search" value={valor} onChange={(e) => aoMudar(e.target.value)} placeholder={placeholder} aria-label={placeholder} className="pl-8" />
    </label>
  );
}

export const normal = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
export const casa = (busca: string, ...campos: string[]) => {
  const b = normal(busca.trim());
  return !b || campos.some((c) => normal(c).includes(b));
};

/** Grade de formulário padrão (mesma usada no cadastro de obras). */
export const GRADE_FORM = "grid grid-cols-[repeat(auto-fit,minmax(min(100%,180px),1fr))] items-end gap-2.5";

export function Vazio({ children }: { children: React.ReactNode }) {
  return <Card className="items-center p-6 text-center text-sm text-muted-foreground">{children}</Card>;
}

/** Sugestões para campos de texto (datalist nativo: digita livre ou escolhe da lista). */
export function Sugestoes({ id, valores }: { id: string; valores: string[] }) {
  return (
    <datalist id={id}>
      {[...new Set(valores)].map((v) => <option key={v} value={v} />)}
    </datalist>
  );
}

/** Abas de uma área (controle segmentado; no celular usa o rótulo curto e rola na horizontal). */
export function AbasArea({ abas, atual, aoEscolher, rotulo }: {
  abas: { id: string; rotulo: string; curto?: string; contagem?: number; alerta?: boolean }[];
  atual: string;
  aoEscolher: (id: string) => void;
  rotulo: string;
}) {
  return (
    <nav aria-label={rotulo} className="flex gap-1 overflow-x-auto rounded-lg border bg-card p-1 [scrollbar-width:none]">
      {abas.map((a) => (
        <button
          key={a.id}
          type="button"
          aria-current={atual === a.id ? "page" : undefined}
          onClick={() => aoEscolher(a.id)}
          className={cn(
            "flex min-w-max flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
            atual === a.id && "bg-trilho font-semibold text-white shadow-[inset_0_-3px_0_var(--sinal)] hover:bg-trilho hover:text-white",
          )}
        >
          {a.curto ? <><span className="sm:hidden">{a.curto}</span><span className="hidden sm:inline">{a.rotulo}</span></> : a.rotulo}
          {a.contagem !== undefined && a.contagem > 0 && (
            <span className={cn("min-w-5 rounded-full px-1 text-center font-mono text-[0.7rem] leading-5", a.alerta ? "bg-critico text-selo-texto" : "bg-muted text-muted-foreground", atual === a.id && !a.alerta && "bg-white/15 text-white")}>
              {a.contagem}
            </span>
          )}
        </button>
      ))}
    </nav>
  );
}

/** Lista de barras horizontais (valor relativo ao maior). */
export function Barras({ linhas, formatar }: { linhas: { rotulo: string; valor: number; extra?: string; aoClicar?: () => void }[]; formatar: (v: number) => string }) {
  const maior = Math.max(1, ...linhas.map((l) => l.valor));
  return (
    <ul className="flex flex-col gap-1.5">
      {linhas.map((l) => (
        <li key={l.rotulo}>
          <button type="button" onClick={l.aoClicar} disabled={!l.aoClicar} className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2.5 gap-y-1 rounded-md px-1 py-1 text-left text-[0.84rem] enabled:hover:bg-muted sm:grid-cols-[minmax(0,10rem)_minmax(0,1fr)_auto]">
            <span className="truncate">{l.rotulo}</span>
            <span className="order-last col-span-full h-2 rounded-full bg-muted sm:order-none sm:col-span-1"><span className="block h-full rounded-full bg-foreground" style={{ width: `${(l.valor / maior) * 100}%` }} /></span>
            <span className="text-right font-mono text-[0.78rem]">{formatar(l.valor)}{l.extra ? <span className="text-muted-foreground"> · {l.extra}</span> : null}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
