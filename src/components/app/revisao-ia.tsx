"use client";

import * as React from "react";
import { SparklesIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ultimaRevisao } from "@/lib/core/assistente";
import type { Obra, Revisao } from "@/lib/core/modelos";
import { dataBr } from "@/lib/core/util";
import { cn } from "@/lib/utils";
import { Nota } from "./comum";
import { useEnviar, useSistema } from "./provedor";

const ROTULO_NIVEL = { critico: "Crítico", atencao: "Atenção", ok: "OK" } as const;
const VARIANTE_NIVEL = { critico: "critico", atencao: "atencao", ok: "ok" } as const;

function rotuloRevisao(o: Obra, r: Revisao): string {
  if (r.escopo !== "etapa") return "obra inteira";
  return `etapa ${o.etapas.find((e) => e.codigo === r.codigo)?.nome ?? r.codigo}`;
}

/** Bloco "Revisar com Claude" para a obra ou para uma etapa. */
export function BlocoIa({ o, escopo, codigo = "", comoCartao = false }: { o: Obra; escopo: "obra" | "etapa"; codigo?: string; comoCartao?: boolean }) {
  const { sis, acao } = useSistema();
  const enviar = useEnviar();
  const andamento = sis.ui.ia_em_andamento;
  const deste = Boolean(andamento && andamento.obra === o.id && andamento.escopo === escopo && andamento.codigo === codigo);
  const alvo = escopo === "etapa" ? "esta etapa" : "a obra";
  let controle: React.ReactNode;
  if (deste) {
    controle = (
      <div role="status" className="flex flex-wrap items-center gap-2.5 text-sm text-muted-foreground">
        <span className="size-2.5 animate-pulse rounded-full bg-sinal" aria-hidden />
        Claude está revisando {alvo}… costuma levar de 20 segundos a 1 minuto.
        <Button variant="link" size="xs" onClick={() => acao("ia.cancelar")}>Cancelar</Button>
      </div>
    );
  } else if (sis.ui.ia_modo === "nenhum") {
    controle = (
      <Nota>
        Para revisar com a Claude, abra o sistema pela Claude ou conecte uma chave de API.{" "}
        <Button variant="link" size="xs" className="h-auto p-0 underline" onClick={() => acao("ui.aba", { aba: "obras" })}>Configurar</Button>
      </Nota>
    );
  } else {
    controle = (
      <form className="flex flex-wrap gap-2" onSubmit={enviar("ia.revisar", { escopo, codigo })}>
        <Input name="foco" maxLength={300} className="min-w-0 flex-[1_1_260px]" placeholder="Foco opcional (ex.: orçamento, sequência, segurança)" aria-label="Foco da revisão" />
        <Button type="submit" disabled={Boolean(andamento)}>
          <SparklesIcon className="text-sinal" /> Revisar {alvo} com Claude
        </Button>
      </form>
    );
  }
  const ultima = ultimaRevisao(o, escopo, codigo);
  const antigas = escopo === "obra" ? o.revisoes.filter((r) => r !== ultima) : [];
  const corpo = (
    <div className="flex flex-col gap-2.5">
      {controle}
      {ultima && <VerRevisao r={ultima} />}
      {antigas.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground">Revisões anteriores ({antigas.length})</summary>
          <ul className="mt-2 flex flex-col gap-1.5">
            {antigas.map((r) => (
              <li key={r.id}>
                <Button variant="link" size="xs" className="h-auto p-0 underline" onClick={() => acao("ia.abrir", { rev: r.id })}>
                  {dataBr(r.data)} · {rotuloRevisao(o, r)}
                </Button>
                {sis.ui.rev_aberta === r.id && <VerRevisao r={r} />}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
  const titulo = escopo === "obra" ? "Revisão com Claude" : "Revisão da etapa com Claude";
  if (comoCartao) {
    return (
      <Card>
        <CardHeader><CardTitle>{titulo}</CardTitle></CardHeader>
        <CardContent>{corpo}</CardContent>
      </Card>
    );
  }
  return (
    <section className="flex flex-col gap-2.5 p-4">
      <h3 className="text-[0.86rem] font-semibold">{titulo}</h3>
      {corpo}
    </section>
  );
}

export function VerRevisao({ r }: { r: Revisao }) {
  const { acao } = useSistema();
  return (
    <article className="flex flex-col gap-2 border-t pt-2.5">
      <p className="font-mono text-xs text-muted-foreground">
        {dataBr(r.data)} · {r.origem}{r.foco ? ` · foco: ${r.foco}` : ""}
      </p>
      {r.resumo && <p className="max-w-[80ch] whitespace-pre-line text-sm">{r.resumo}</p>}
      {r.pontos.length > 0 && (
        <ul className="flex flex-col">
          {r.pontos.map((p, i) => (
            <li key={i} className="grid grid-cols-1 gap-1 border-b py-2 sm:grid-cols-[5rem_1fr] sm:gap-2">
              <Badge variant={VARIANTE_NIVEL[p.nivel]} className="self-start">{ROTULO_NIVEL[p.nivel]}</Badge>
              <div>
                <b className="text-sm font-semibold">{p.titulo}</b>
                {p.detalhe && <p className="text-[0.86rem] text-muted-foreground">{p.detalhe}</p>}
              </div>
            </li>
          ))}
        </ul>
      )}
      {r.sugestoes.length > 0 && (
        <>
          <h4 className="text-xs font-semibold text-muted-foreground">Itens sugeridos para o checklist</h4>
          <ul className="flex flex-col gap-1.5 text-sm">
            {r.sugestoes.map((s, i) => (
              <li key={i} className="flex flex-wrap items-center gap-1.5">
                <span className="font-mono text-xs text-muted-foreground">{s.etapa}</span> {s.texto}
                {s.adicionado ? (
                  <Badge variant="ok">no checklist</Badge>
                ) : (
                  <Button variant="outline" size="xs" onClick={() => acao("ia.adicionar", { rev: r.id, idx: String(i) })}>
                    Adicionar ao checklist
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
      {r.perguntas.length > 0 && (
        <>
          <h4 className="text-xs font-semibold text-muted-foreground">Informações que faltam</h4>
          <ul className="list-disc pl-5 text-sm">
            {r.perguntas.map((q, i) => <li key={i}>{q}</li>)}
          </ul>
        </>
      )}
      <Nota>
        Revisão gerada por IA a partir dos dados do sistema. Confira antes de decidir.{" "}
        <Button variant="link" size="xs" className="h-auto p-0 underline" onClick={() => acao("ia.apagar", { rev: r.id })}>Apagar revisão</Button>
      </Nota>
    </article>
  );
}

/** Configuração da revisão com Claude (chave de API fica só neste navegador). */
export function ConfigIa() {
  const { sis, plataforma, atualizarModoIa } = useSistema();
  const [erro, setErro] = React.useState("");
  const modo = sis.ui.ia_modo;
  let corpo: React.ReactNode;
  if (modo === "claude") {
    corpo = <Nota>Conectada pela sua conta da Claude. Cada revisão usa o seu limite de uso da Claude e pede permissão na primeira vez.</Nota>;
  } else if (!plataforma?.chavePermitida) {
    corpo = <Nota>Disponível quando o sistema é aberto pela Claude (usa a sua conta) ou pelo site, com uma chave de API própria.</Nota>;
  } else {
    corpo = (
      <div className="flex flex-col gap-2.5">
        <p className="flex items-center gap-2 text-sm">
          {modo === "chave" ? (
            <><Badge variant="ok">Conectada</Badge> chave terminada em <b>…{sis.ui.ia_chave_final}</b></>
          ) : (
            <Badge variant="outline">Não conectada</Badge>
          )}
        </p>
        <Nota>
          Fora da Claude, a revisão usa uma chave da API da Anthropic (console.anthropic.com). A chave fica salva só neste navegador,
          nunca vai para o banco de dados nem para o código do site, e cada revisão é cobrada na sua conta da API. Use uma chave com
          limite de gastos e não conecte em computadores compartilhados.
        </Nota>
        <form
          className="flex flex-wrap gap-2"
          autoComplete="off"
          onSubmit={(e) => {
            e.preventDefault();
            const f = e.currentTarget;
            const msg = plataforma.salvarChave(String(new FormData(f).get("chave") ?? ""));
            setErro(msg);
            if (!msg) {
              f.reset();
              atualizarModoIa();
            }
          }}
        >
          <Input name="chave" type="password" autoComplete="off" spellCheck={false} placeholder="sk-ant-…" aria-label="Chave da API da Anthropic" required className="min-w-0 flex-[1_1_220px]" />
          <Button type="submit">{modo === "chave" ? "Trocar chave" : "Conectar"}</Button>
        </form>
        {erro && <p role="alert" className="text-sm font-medium text-critico">{erro}</p>}
        {modo === "chave" && (
          <Button variant="outline" className="self-start" onClick={() => { plataforma.removerChave(); atualizarModoIa(); }}>
            Remover chave deste navegador
          </Button>
        )}
      </div>
    );
  }
  return (
    <Card>
      <CardHeader><CardTitle>Revisão com Claude</CardTitle></CardHeader>
      <CardContent className={cn("flex flex-col gap-2")}>{corpo}</CardContent>
    </Card>
  );
}
