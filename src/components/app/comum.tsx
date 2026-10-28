"use client";

import * as React from "react";
import { CheckIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { valorBr } from "@/lib/core/util";

// cor de cada fase: escala do preto ao amarelo, na ordem em que a obra avança
export const COR_FASE: Record<string, string> = {
  Preparação: "#1f1d19",
  Infraestrutura: "#4a463d",
  Supraestrutura: "#77705f",
  "Vedação e cobertura": "#a39673",
  Instalações: "#c9a92e",
  Acabamentos: "#e8bf0e",
  Entrega: "#f7dc3c",
};
export const corFase = (categoria: string) => COR_FASE[categoria] ?? "#9a958a";

type VarianteBadge = "ok" | "info" | "sinal" | "atencao" | "critico" | "outline" | "secondary" | "riscado";
const VARIANTE: Record<string, VarianteBadge> = {
  Concluída: "ok",
  "Em andamento": "info",
  Liberada: "sinal",
  Aguardando: "outline",
  Atrasada: "critico",
  Solicitada: "outline",
  "Em cotação": "sinal",
  Aprovada: "info",
  "Pedido feito": "info",
  Entregue: "ok",
  Cancelada: "riscado",
  "A fazer": "sinal",
  Bloqueada: "critico",
  Baixa: "outline",
  Média: "secondary",
  Alta: "atencao",
  Urgente: "critico",
  "A cotar": "outline",
  "Cotação solicitada": "sinal",
  Comprado: "info",
  "Não solicitado": "outline",
  Parcial: "atencao",
  "Aguardando aprovação": "atencao",
  Atendida: "ok",
  Recusada: "riscado",
  Rascunho: "outline",
  Enviada: "info",
  "Recebida parcialmente": "atencao",
  Recebida: "ok",
  Previsto: "outline",
  Recebido: "ok",
  "Em elaboração": "sinal",
  Impraticável: "critico",
  "Parcialmente praticável": "atencao",
  Praticável: "ok",
};

/** Etiqueta pequena e sólida de situação/prioridade. */
export function Pill({ texto, className }: { texto: string; className?: string }) {
  return (
    <Badge variant={VARIANTE[texto] ?? "secondary"} className={className}>
      {texto}
    </Badge>
  );
}

export interface Passo {
  rotulo: string;
  sub: string;
  estado: "feita" | "atual" | "";
  valor: string;
}

/** Faixa de fases em seta (Levantamento → … → Liberado), com a atual em amarelo. */
export function Chevrons({ passos, aoEscolher, rotulo }: { passos: Passo[]; aoEscolher: (v: string) => void; rotulo: string }) {
  return (
    <nav aria-label={rotulo} className="flex overflow-x-auto bg-muted [scrollbar-width:thin]">
      {passos.map((p, i) => (
        <button
          key={p.valor}
          type="button"
          onClick={() => aoEscolher(p.valor)}
          aria-current={p.estado === "atual" ? "step" : undefined}
          className={cn(
            "chevron flex min-w-[104px] flex-[1_0_auto] cursor-pointer flex-col items-center gap-px py-2 pl-7 pr-5 first:pl-4",
            i % 2 ? "bg-accent" : "bg-muted",
            p.estado === "atual" && "bg-sinal text-sinal-foreground",
            "hover:brightness-95 focus-visible:relative focus-visible:z-10 focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-ring",
          )}
        >
          <span className={cn("inline-flex items-center gap-1 whitespace-nowrap text-[0.82rem] font-semibold", p.estado === "feita" && "text-ok")}>
            {p.estado === "feita" && <CheckIcon className="size-3.5" />}
            {p.rotulo}
          </span>
          <span className={cn("font-mono text-[0.7rem] text-muted-foreground", p.estado === "atual" && "text-sinal-foreground/75")}>{p.sub}</span>
        </button>
      ))}
    </nav>
  );
}

/** Campo numérico em texto com teclado decimal: aceita 300.000 / 300.000,00 / 300000. */
export function CampoNumero({
  valor,
  texto,
  className,
  ...props
}: Omit<React.ComponentProps<"input">, "type" | "defaultValue"> & { valor?: number | null; texto?: string }) {
  const inicial = texto !== undefined ? texto : valor ? valorBr(valor) : "";
  return (
    <Input type="text" inputMode="decimal" autoComplete="off" defaultValue={inicial} className={className} {...props} />
  );
}

export function Campo({ rotulo, children, className }: { rotulo: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn("flex min-w-0 flex-col gap-1 text-xs font-medium text-muted-foreground", className)}>
      {rotulo}
      {children}
    </label>
  );
}

export function Nota({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("text-[0.82rem] text-muted-foreground", className)}>{children}</p>;
}

export function Secao({ titulo, contagem, children, className, acoes }: {
  titulo: string;
  contagem?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  acoes?: React.ReactNode;
}) {
  return (
    <section className={cn("flex flex-col gap-2.5 border-b p-4 last:border-b-0", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-[0.86rem] font-semibold">{titulo}</h3>
        {contagem !== undefined && <span className="font-mono text-xs text-muted-foreground">{contagem}</span>}
        {acoes && <div className="ml-auto flex gap-2">{acoes}</div>}
      </div>
      {children}
    </section>
  );
}

/** Diferença em R$ colorida (verde = economia, vermelho = estouro). */
export function Diferenca({ valor, formatar }: { valor: number | null; formatar: (v: number) => string }) {
  if (valor === null) return <span className="text-muted-foreground">—</span>;
  return <span className={cn(valor > 0.005 ? "text-ok" : valor < -0.005 ? "text-critico" : "")}>{formatar(valor)}</span>;
}
