"use client";

import * as React from "react";
import { CheckIcon, ChevronDownIcon, ChevronRightIcon, HardHatIcon, PencilIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import * as gs from "@/lib/core/gestao";
import { dataBr, moeda, num, pct, valorBr } from "@/lib/core/util";
import { cn } from "@/lib/utils";
import { Campo, CampoNumero, Nota, Pill } from "./comum";
import { BarraModulo, BotaoExcluir, Busca, casa, GRADE_FORM, Indicadores, Sugestoes, Vazio } from "./modulo-comum";
import { useEnviar, useSistema } from "./provedor";

const FILTROS = [
  ["ativos", "Em andamento"],
  ["Aguardando cliente", "Aguardando cliente"],
  ["Concluído", "Concluídos"],
  ["todos", "Todos"],
] as const;

export function TelaProjetos() {
  const { sis } = useSistema();
  const g = sis.cadastros;
  const [filtro, setFiltro] = React.useState<string>("ativos");
  const [busca, setBusca] = React.useState("");
  const r = gs.resumoProjetos(g, sis.hoje);
  const lista = g.projetos
    .filter((p) =>
      (filtro === "todos" ? true : filtro === "ativos" ? p.status !== "Concluído" && p.status !== "Cancelado" : p.status === filtro)
      && casa(busca, p.nome, p.codigo, p.cliente, p.responsavel, p.tipo))
    .sort((a, b) => Number(gs.projetoAtrasado(b, sis.hoje)) - Number(gs.projetoAtrasado(a, sis.hoje)) || (a.entrega || "9999").localeCompare(b.entrega || "9999"));
  return (
    <>
      <BarraModulo
        texto="Projetos do escritório por fase: levantamento, estudo preliminar, anteprojeto, aprovação, executivo, compatibilização e entrega. Quando o projeto vira obra, gere a obra com um clique."
        qual="projeto"
        rotuloNovo="Novo projeto"
      />
      <Indicadores
        itens={[
          { rotulo: "Em andamento", valor: String(r.ativos), sub: `${r.concluidos} concluído(s)` },
          { rotulo: "Prazo vencido", valor: String(r.atrasados), tom: r.atrasados ? "critico" : undefined, sub: r.atrasados ? "fase ou entrega atrasada" : "tudo no prazo" },
          { rotulo: "Aguardando cliente", valor: String(r.aguardando), tom: r.aguardando ? "atencao" : undefined },
          { rotulo: "Honorários em carteira", valor: moeda(r.honorarios_ativos), sub: "projetos não concluídos" },
        ]}
      />
      {sis.ui.novo === "projeto" && <FormProjeto />}
      <div className="flex flex-wrap items-center gap-2">
        <Busca valor={busca} aoMudar={setBusca} placeholder="Buscar projeto, cliente, código…" />
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar projetos">
          {FILTROS.map(([v, rot]) => (
            <Button key={v} size="sm" variant={filtro === v ? "default" : "outline"} aria-pressed={filtro === v} onClick={() => setFiltro(v)}>{rot}</Button>
          ))}
        </div>
      </div>
      {lista.length ? (
        <div className="flex flex-col gap-2.5">{lista.map((p) => <CartaoProjeto key={p.id} p={p} />)}</div>
      ) : (
        <Vazio>{g.projetos.length ? "Nenhum projeto neste filtro." : "Nenhum projeto cadastrado. Use “Novo projeto” para começar."}</Vazio>
      )}
    </>
  );
}

function FormProjeto({ p }: { p?: gs.Projeto }) {
  const { sis, acao } = useSistema();
  const enviar = useEnviar();
  return (
    <Card className="p-4">
      <h3 className="font-semibold">{p ? `Editar ${p.codigo}` : "Novo projeto"}</h3>
      <form className={GRADE_FORM} onSubmit={enviar("proj.salvar", p ? { id: p.id } : {}, { limpar: !p })}>
        <Campo rotulo="Nome do projeto" className="col-span-full"><Input name="nome" required maxLength={200} defaultValue={p?.nome} placeholder="Ex.: Residência Silva" /></Campo>
        <Campo rotulo="Cliente"><Input name="cliente" maxLength={200} defaultValue={p?.cliente} list="clientes-projeto" /></Campo>
        <Campo rotulo="Tipo"><NativeSelect name="tipo" defaultValue={p?.tipo ?? "Residencial"}>{gs.TIPOS_PROJETO.map((t) => <option key={t}>{t}</option>)}</NativeSelect></Campo>
        <Campo rotulo="Área (m²)"><CampoNumero name="area" texto={p?.area ? num(p.area) : ""} placeholder="0" /></Campo>
        <Campo rotulo="Código"><Input name="codigo" maxLength={20} defaultValue={p?.codigo} placeholder="Automático" /></Campo>
        <Campo rotulo="Endereço" className="col-span-full"><Input name="endereco" maxLength={200} defaultValue={p?.endereco} /></Campo>
        <Campo rotulo="Responsável"><Input name="responsavel" maxLength={80} defaultValue={p?.responsavel} list="responsaveis-projeto" /></Campo>
        <Campo rotulo="Início"><Input name="inicio" type="date" defaultValue={p?.inicio} /></Campo>
        <Campo rotulo="Entrega prevista"><Input name="entrega" type="date" defaultValue={p?.entrega} /></Campo>
        <Campo rotulo="Honorários (R$)"><CampoNumero name="honorarios" texto={p?.honorarios ? valorBr(p.honorarios) : ""} placeholder="0,00" /></Campo>
        <Campo rotulo="Situação"><NativeSelect name="status" defaultValue={p?.status ?? "Em andamento"}>{gs.STATUS_PROJETO.map((t) => <option key={t}>{t}</option>)}</NativeSelect></Campo>
        <Campo rotulo="Observação" className="col-span-full"><Textarea name="observacao" rows={2} maxLength={2000} defaultValue={p?.observacao} /></Campo>
        <Sugestoes id="clientes-projeto" valores={[...sis.cadastros.contatos.filter((c) => c.tipo === "Cliente").map((c) => c.nome), ...sis.cadastros.projetos.map((x) => x.cliente)].filter(Boolean)} />
        <Sugestoes id="responsaveis-projeto" valores={[...sis.cadastros.equipe.filter((m) => /arquit|engenh|projet/i.test(m.funcao)).map((m) => m.nome), ...sis.cadastros.projetos.map((x) => x.responsavel)].filter(Boolean)} />
        <div className="flex gap-2">
          <Button type="submit">{p ? "Salvar" : "Cadastrar projeto"}</Button>
          <Button type="button" variant="outline" onClick={() => (p ? acao("ui.editar", { id: p.id }) : acao("ui.novo", { qual: "projeto" }))}>Cancelar</Button>
        </div>
      </form>
      {!p && <Nota className="text-[0.76rem]">Com início e entrega preenchidos, os prazos de cada fase são sugeridos automaticamente (você pode ajustar depois).</Nota>}
    </Card>
  );
}

function CartaoProjeto({ p }: { p: gs.Projeto }) {
  const { sis, acao } = useSistema();
  const [aberto, setAberto] = React.useState(false);
  if (sis.ui.editando === p.id) return <FormProjeto p={p} />;
  const atual = gs.faseAtual(p);
  const atrasado = gs.projetoAtrasado(p, sis.hoje);
  const prog = gs.progressoProjeto(p);
  const obra = p.obra ? sis.obras.get(p.obra) : undefined;
  return (
    <Card className={cn("gap-0 p-0", atrasado && "border-critico shadow-[inset_3px_0_0_var(--critico)]")}>
      <div className="flex flex-col gap-3 p-3.5 md:p-4">
        <button type="button" className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 text-left" aria-expanded={aberto} onClick={() => setAberto((v) => !v)}>
          {aberto ? <ChevronDownIcon className="size-4 shrink-0" /> : <ChevronRightIcon className="size-4 shrink-0" />}
          <span className="font-mono text-[0.78rem] text-muted-foreground">{p.codigo}</span>
          <span className="min-w-0 flex-1 basis-48 font-semibold">{p.nome}</span>
          <Pill texto={p.status} />
          {atrasado && <Pill texto="Atrasada" />}
          <span className="font-mono text-sm">{p.honorarios ? moeda(p.honorarios) : ""}</span>
        </button>
        <p className="pl-7 text-[0.8rem] text-muted-foreground">
          {[p.cliente, p.tipo, p.area ? `${num(p.area)} m²` : "", p.responsavel ? `resp. ${p.responsavel}` : "", p.entrega ? `entrega ${dataBr(p.entrega)}` : ""].filter(Boolean).join(" · ")}
        </p>
        {/* faixa das fases: tocar conclui até ali (ou reabre) */}
        <ol className="grid grid-cols-7 gap-1" aria-label={`Fases de ${p.nome}`}>
          {p.fases.map((f, k) => {
            const feita = !!f.concluida_em;
            const corrente = k === atual.indice;
            const vencida = !feita && f.prazo && f.prazo < sis.hoje;
            return (
              <li key={f.fase}>
                <button
                  type="button"
                  onClick={() => acao("proj.fase", { id: p.id, indice: k })}
                  title={`${f.fase}${f.prazo ? ` · prazo ${dataBr(f.prazo)}` : ""}${feita ? ` · concluída em ${dataBr(f.concluida_em)}` : ""} — clique para ${feita ? "reabrir" : "concluir"}`}
                  aria-label={`${f.fase}: ${feita ? "concluída" : corrente ? "fase atual" : "pendente"}. Clique para ${feita ? "reabrir" : "concluir"}.`}
                  className={cn(
                    "flex h-8 w-full items-center justify-center rounded-sm border text-[0.72rem] font-semibold transition-colors",
                    feita ? "border-ok bg-ok text-selo-texto" : corrente ? "border-foreground bg-sinal text-sinal-foreground" : "bg-muted text-muted-foreground hover:border-foreground",
                    vencida && "border-critico",
                  )}
                >
                  {feita ? <CheckIcon className="size-3.5" /> : k + 1}
                </button>
              </li>
            );
          })}
        </ol>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.8rem]">
          <span className="font-medium">{atual.fase ? `Fase atual: ${atual.fase.fase}` : "Todas as fases concluídas"}</span>
          {atual.fase?.prazo && <span className={cn("text-muted-foreground", atual.fase.prazo < sis.hoje && "font-semibold text-critico")}>prazo {dataBr(atual.fase.prazo)}</span>}
          <span className="ml-auto flex min-w-40 items-center gap-2 text-muted-foreground"><Progress value={prog} className="w-24" />{pct(prog)}</span>
        </div>
      </div>
      {aberto && (
        <div className="flex flex-col gap-3 border-t p-3.5 md:p-4">
          <ul className="flex flex-col divide-y rounded-md border">
            {p.fases.map((f, k) => (
              <li key={f.fase} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2">
                <button
                  type="button"
                  onClick={() => acao("proj.fase", { id: p.id, indice: k })}
                  className={cn("grid size-6 shrink-0 place-items-center rounded-sm border", f.concluida_em ? "border-ok bg-ok text-selo-texto" : "hover:border-foreground")}
                  aria-label={`${f.concluida_em ? "Reabrir" : "Concluir"} ${f.fase}`}
                  aria-pressed={!!f.concluida_em}
                >
                  {f.concluida_em ? <CheckIcon className="size-4" /> : <span className="text-[0.72rem] font-semibold">{k + 1}</span>}
                </button>
                <span className={cn("min-w-0 flex-1 basis-40 text-sm", f.concluida_em && "text-muted-foreground line-through")}>{f.fase}</span>
                {f.concluida_em ? (
                  <span className="text-[0.78rem] text-ok">concluída em {dataBr(f.concluida_em)}</span>
                ) : (
                  <label className="flex items-center gap-1.5 text-[0.78rem] text-muted-foreground">
                    prazo
                    <Input
                      type="date"
                      key={f.prazo}
                      defaultValue={f.prazo}
                      onBlur={(e) => e.target.value !== f.prazo && acao("proj.prazo", { id: p.id, indice: k, prazo: e.target.value })}
                      className={cn("h-8 w-40", f.prazo && f.prazo < sis.hoje && "border-critico text-critico")}
                      aria-label={`Prazo de ${f.fase}`}
                    />
                  </label>
                )}
              </li>
            ))}
          </ul>
          {p.observacao && <Nota className="whitespace-pre-line">{p.observacao}</Nota>}
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => acao("ui.editar", { id: p.id })}><PencilIcon />Editar</Button>
            <Button size="sm" onClick={() => acao("proj.obra", { id: p.id })}>
              <HardHatIcon />{obra ? `Abrir a obra “${obra.nome}”` : "Gerar obra a partir do projeto"}
            </Button>
            <BotaoExcluir acaoNome="proj.remover" id={p.id} pergunta={`Excluir o projeto “${p.nome}”?`} />
          </div>
          {!obra && <Nota className="text-[0.76rem]">A obra nasce com nome, cliente, endereço e área do projeto, CUB-PB e as 17 etapas construtivas.</Nota>}
        </div>
      )}
    </Card>
  );
}
