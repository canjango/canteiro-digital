"use client";

import * as React from "react";
import { Trash2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import * as an from "@/lib/core/analise";
import { PRIORIDADES, STATUS_TAREFA, type Obra, type Tarefa } from "@/lib/core/modelos";
import { dataBr } from "@/lib/core/util";
import { cn } from "@/lib/utils";
import { Campo, Nota, Pill } from "./comum";
import { useEnviar, useSistema } from "./provedor";

const ORDEM_PRIO = Object.fromEntries([...PRIORIDADES].reverse().map((p, i) => [p, i]));

export function TelaTarefas() {
  const { sis, acao } = useSistema();
  const o = sis.obra!;
  const atrasadas = new Set(an.tarefasAtrasadas(o, sis.hoje).map((t) => t.id));
  return (
    <>
      <Card className="flex-row flex-wrap items-center justify-between gap-2.5 p-3 md:p-4">
        <Nota>Marque os itens do checklist; a tarefa só pode ser concluída com todos os itens feitos.</Nota>
        <Button onClick={() => acao("ui.form", { qual: "tarefa" })}>{sis.ui.form_tarefa ? "Fechar formulário" : "Nova tarefa"}</Button>
      </Card>
      {sis.ui.form_tarefa && <FormTarefa o={o} />}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))] items-start gap-3">
        {STATUS_TAREFA.map((st) => {
          const ts = o.tarefas.filter((t) => t.status === st).sort((a, b) =>
            Number(!atrasadas.has(a.id)) - Number(!atrasadas.has(b.id))
            || (ORDEM_PRIO[a.prioridade] ?? 9) - (ORDEM_PRIO[b.prioridade] ?? 9)
            || (a.prazo || "9999").localeCompare(b.prazo || "9999"));
          return (
            <section key={st} className="flex min-w-0 flex-col gap-2 rounded-lg border bg-muted p-2.5">
              <h2 className="flex items-center gap-2 border-b pb-2 font-semibold"><Pill texto={st} /><span className="font-mono text-xs font-normal text-muted-foreground">{ts.length}</span></h2>
              {ts.length ? ts.map((t) => <CartaoTarefa key={t.id} t={t} atrasada={atrasadas.has(t.id)} />) : <Nota>—</Nota>}
            </section>
          );
        })}
      </div>
    </>
  );
}

function FormTarefa({ o }: { o: Obra }) {
  const enviar = useEnviar();
  return (
    <Card className="p-4">
      <form className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,180px),1fr))] items-end gap-2.5" onSubmit={enviar("tarefa.criar", {}, { limpar: true })}>
        <Campo rotulo="Título" className="col-span-full"><Input name="titulo" required maxLength={200} placeholder="Ex.: Conferir prumo da alvenaria" /></Campo>
        <Campo rotulo="Etapa">
          <NativeSelect name="etapa" defaultValue="">
            <option value="">(geral)</option>
            {o.etapas.map((e) => <option key={e.codigo} value={e.codigo}>{e.codigo} · {e.nome}</option>)}
          </NativeSelect>
        </Campo>
        <Campo rotulo="Responsável"><Input name="responsavel" maxLength={80} /></Campo>
        <Campo rotulo="Prazo"><Input name="prazo" type="date" /></Campo>
        <Campo rotulo="Prioridade"><NativeSelect name="prioridade" defaultValue="Média">{PRIORIDADES.map((p) => <option key={p}>{p}</option>)}</NativeSelect></Campo>
        <Campo rotulo="Checklist (um item por linha)" className="col-span-full"><Textarea name="itens" rows={3} placeholder={"Item 1\nItem 2"} /></Campo>
        <Button type="submit">Criar tarefa</Button>
      </form>
    </Card>
  );
}

function CartaoTarefa({ t, atrasada }: { t: Tarefa; atrasada: boolean }) {
  const { acao } = useSistema();
  return (
    <Card className={cn("gap-2 p-3", atrasada && "border-critico shadow-[inset_3px_0_0_var(--critico)]")}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="min-w-0 break-words font-semibold">{t.titulo}</h3>
        <div className="flex flex-wrap gap-1"><Pill texto={t.prioridade} />{atrasada && <Pill texto="Atrasada" />}</div>
      </div>
      <p className="text-[0.8rem] text-muted-foreground">
        {t.etapa && <span className="mr-1 font-mono text-xs">{t.etapa}</span>}
        {t.responsavel || "sem responsável"} · {t.prazo ? `prazo ${dataBr(t.prazo)}` : "sem prazo"}
      </p>
      {t.checklist.length > 0 && (
        <>
          <Progress value={an.progressoTarefa(t)} />
          <ul className="flex flex-col border-t">
            {t.checklist.map((i) => (
              <li key={i.id} className="border-b">
                <button type="button" aria-pressed={i.feito} onClick={() => acao("tarefa.item", { id: t.id, item: i.id })} className="flex min-h-9 w-full items-center gap-2 px-0.5 py-1.5 text-left text-[0.84rem]">
                  <span className={cn("grid size-4 shrink-0 place-items-center rounded-[3px] border-[1.5px] border-muted-foreground bg-card", i.feito && "border-ok bg-ok")} aria-hidden>
                    {i.feito && <span className="mb-0.5 h-2 w-[3px] rotate-45 border-b-2 border-r-2 border-white" />}
                  </span>
                  <span className={cn("min-w-0 flex-1 break-words", i.feito && "text-muted-foreground line-through decoration-ok")}>{i.texto}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      <div className="flex flex-wrap items-center gap-1.5">
        {STATUS_TAREFA.filter((s) => s !== t.status).map((s) => (
          <Button key={s} size="xs" variant="outline" onClick={() => acao("tarefa.status", { id: t.id, status: s })}>{s}</Button>
        ))}
        <Button variant="ghost" size="icon-sm" className="ml-auto hover:bg-critico-suave hover:text-critico" aria-label="Excluir tarefa" title="Excluir tarefa" onClick={() => acao("tarefa.remover", { id: t.id })}>
          <Trash2Icon />
        </Button>
      </div>
    </Card>
  );
}
