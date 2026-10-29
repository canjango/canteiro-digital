"use client";

import * as React from "react";
import { ArrowRightIcon } from "lucide-react";

import * as an from "@/lib/core/analise";
import * as gs from "@/lib/core/gestao";
import * as pj from "@/lib/core/projetos";
import { dataBr, moeda } from "@/lib/core/util";
import { cn } from "@/lib/utils";
import { useAcesso } from "./acesso";
import { Carregando, Casca, Mensagens } from "./casca";
import { useSistema } from "./provedor";
import { TelaEquipe } from "./tela-equipe";
import { TelaProjetos } from "./tela-projetos";
import { AREAS, Topbar } from "./topbar";

/** Escolhe a área do sistema: painel de acesso, projetos, obras ou equipe. */
export function Raiz() {
  const { sis, carregado } = useSistema();
  if (!carregado) return <Carregando />;
  switch (sis.ui.modulo) {
    case "obras":
      return <Casca />;
    case "projetos":
      return <AreaModulo titulo="Gestão de projetos"><TelaProjetos /></AreaModulo>;
    case "equipe":
      return <AreaModulo titulo="Gestão de equipe"><TelaEquipe /></AreaModulo>;
    default:
      return <AreaModulo titulo="" larga={false}><PainelAcesso /></AreaModulo>;
  }
}

function AreaModulo({ titulo, children, larga = true }: { titulo: string; children: React.ReactNode; larga?: boolean }) {
  const { acao } = useSistema();
  return (
    <div className="min-h-dvh px-4 pb-12 md:px-5">
      <Topbar />
      <div className={cn("mx-auto w-full", larga ? "max-w-[1440px]" : "max-w-6xl")}>
        {titulo && (
          <header className="flex flex-col gap-1 border-b border-dashed pt-4 pb-3">
            <nav aria-label="Caminho" className="flex items-center gap-1.5 text-[0.85rem] text-muted-foreground">
              <button type="button" className="hover:text-foreground hover:underline" onClick={() => acao("ui.modulo", { modulo: "hub" })}>Painel de acesso</button>
              <span aria-hidden>›</span>
              <span className="text-foreground">{titulo}</span>
            </nav>
            <h1 className="text-xl font-bold md:text-[1.3rem]">{titulo}</h1>
          </header>
        )}
        <main id="conteudo" className="flex flex-col gap-4 pt-4">{children}</main>
      </div>
      <Mensagens />
    </div>
  );
}

// ---------------------------------------------------------------- painel de acesso (3 quadros)
function saudacao() {
  const h = new Date().getHours();
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}

function PainelAcesso() {
  const { sis, acao } = useSistema();
  const { conta } = useAcesso();
  const hoje = sis.hoje;
  const mes = hoje.slice(0, 7);
  const rp = pj.resumoGeral(sis.cadastros, hoje);
  const re = gs.resumoEquipe(sis.cadastros, mes, hoje);
  const obras = sis.ordenadas();
  const criticos = obras.reduce((s, o) => s + an.alertas(o, hoje).filter((a) => a.nivel === "critico").length, 0);
  const emAndamento = obras.filter((o) => an.progressoFisico(o) > 0 && an.progressoFisico(o) < 1).length;

  const numeros: Record<string, { valor: string; rotulo: string; alerta?: boolean }[]> = {
    projetos: [
      { valor: String(rp.ativos), rotulo: "em andamento" },
      { valor: String(rp.atrasados), rotulo: "com prazo vencido", alerta: rp.atrasados > 0 },
      { valor: moeda(rp.carteira), rotulo: "honorários em carteira" },
    ],
    obras: [
      { valor: String(obras.length), rotulo: obras.length === 1 ? "obra cadastrada" : "obras cadastradas" },
      { valor: String(emAndamento), rotulo: "em execução" },
      { valor: String(criticos), rotulo: "alertas críticos", alerta: criticos > 0 },
    ],
    equipe: [
      { valor: String(re.ativos), rotulo: "pessoas ativas" },
      { valor: String(re.presentes_hoje), rotulo: "presentes hoje" },
      { valor: moeda(re.custo_mes), rotulo: "custo no mês" },
    ],
  };

  return (
    <div className="flex flex-col gap-6 pt-4 md:pt-8">
      <div className="flex flex-col gap-1">
        <p className="text-sm text-muted-foreground">{dataBr(hoje)}</p>
        <h1 className="text-2xl font-bold md:text-3xl">{saudacao()}, {conta?.nome.split(" ")[0]}.</h1>
        <p className="text-muted-foreground">Escolha a área para começar.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {AREAS.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => acao("ui.modulo", { modulo: a.id })}
            className={cn(
              "group flex min-h-[300px] flex-col gap-5 rounded-xl border bg-card p-5 text-left text-card-foreground transition-[border-color,box-shadow] md:p-6",
              "hover:border-foreground hover:shadow-[inset_0_-4px_0_var(--sinal)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
            )}
          >
            <span className="grid size-14 place-items-center rounded-xl bg-sinal text-sinal-foreground transition-colors group-hover:bg-trilho group-hover:text-sinal">
              <a.Icone className="size-7" />
            </span>
            <span className="flex flex-col gap-1">
              <span className="text-xl font-bold">{a.nome}</span>
              <span className="text-sm text-muted-foreground">{a.desc}</span>
            </span>
            <span className="grid grid-cols-3 gap-2 border-t pt-4">
              {numeros[a.id].map((n) => (
                <span key={n.rotulo} className="flex min-w-0 flex-col">
                  <span className={cn("truncate font-mono text-[1.05rem] font-semibold", n.alerta && "text-critico")}>{n.valor}</span>
                  <span className="text-[0.74rem] leading-tight text-muted-foreground">{n.rotulo}</span>
                </span>
              ))}
            </span>
            <span className="mt-auto inline-flex items-center gap-1.5 self-start rounded-md bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground">
              Acessar <ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
