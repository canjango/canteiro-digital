"use client";

import * as React from "react";
import { MoonIcon, SunIcon } from "lucide-react";

import * as pl from "@/lib/paleta";
import { cn } from "@/lib/utils";

export function useAparencia() {
  return React.useSyncExternalStore(pl.assinarAparencia, pl.aparenciaAtual, pl.aparenciaServidor);
}

/** Botão do canto superior direito: alterna entre tema claro e escuro. */
export function BotaoTema({ className }: { className?: string }) {
  const { escuro } = useAparencia();
  const rotulo = escuro ? "Mudar para o tema claro" : "Mudar para o tema escuro";
  return (
    <button
      type="button"
      onClick={() => pl.definirAparencia({ tema: escuro ? "claro" : "escuro" })}
      aria-label={rotulo}
      title={rotulo}
      className={cn(
        "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md border px-2.5 text-sm font-semibold transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        escuro
          ? "border-sinal bg-sinal text-sinal-foreground hover:bg-sinal/85"
          : "border-input bg-card text-foreground hover:bg-muted",
        className,
      )}
    >
      {escuro ? <SunIcon className="size-4" /> : <MoonIcon className="size-4" />}
      <span className="hidden sm:inline">{escuro ? "Claro" : "Escuro"}</span>
    </button>
  );
}
