"use client";

import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import * as an from "@/lib/core/analise";
import {
  CODIGOS_PADRAO, CUB_ESTADOS, UF_SEM_PADRAO, UF_SUGERIDA, UFS, referenciaCub, rotuloPadrao, rotuloUf, valorReferencia,
} from "@/lib/core/catalogo";
import type { Obra } from "@/lib/core/modelos";
import { BDI_SUGERIDO } from "@/lib/core/servicos";
import { moeda, num, pct } from "@/lib/core/util";
import { cn } from "@/lib/utils";
import { Campo, CampoNumero, Nota } from "./comum";
import { useEnviar, useSistema } from "./provedor";
import { ConfigIa } from "./revisao-ia";
import { BlocoPadrao } from "./tela-painel";

export function TelaObras() {
  const { sis, acao } = useSistema();
  const o = sis.obra;
  const enviar = useEnviar();
  const vazia = sis.obras.size === 0;
  return (
    <>
      {vazia && (
        <Card className="gap-2.5 p-5">
          <h2 className="text-xl font-bold">Comece cadastrando a primeira obra</h2>
          <p className="max-w-[65ch] text-sm text-muted-foreground">
            Ao criar uma obra, o sistema monta automaticamente as 17 etapas construtivas com checklists de qualidade, distribui o
            orçamento pelos pesos típicos de cada etapa e calcula o cronograma respeitando a sequência executiva.
          </p>
          <Button variant="outline" className="self-start" onClick={() => acao("obra.exemplo")}>Ver com uma obra de exemplo</Button>
        </Card>
      )}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,420px),1fr))] items-start gap-4">
        <section className="flex flex-col gap-2.5">
          <h2 className="font-bold">Nova obra</h2>
          <Card className="p-4">
            <form className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,180px),1fr))] items-end gap-2.5" onSubmit={enviar("obra.criar", {}, { limpar: true })}>
              <Campo rotulo="Nome da obra" className="col-span-full"><Input name="nome" required maxLength={200} placeholder="Ex.: Residência Silva" /></Campo>
              <Campo rotulo="Cliente"><Input name="cliente" maxLength={200} /></Campo>
              <Campo rotulo="Responsável técnico"><Input name="responsavel_tecnico" maxLength={200} /></Campo>
              <Campo rotulo="Endereço" className="col-span-full"><Input name="endereco" maxLength={200} /></Campo>
              <Campo rotulo="Início"><Input name="inicio" type="date" /></Campo>
              <Campo rotulo="Término previsto"><Input name="fim_previsto" type="date" /></Campo>
              <Campo rotulo="Área construída (m²)"><CampoNumero name="area_construida" texto="100" placeholder="100" /></Campo>
              <CamposPadrao padrao="R1-N" valorM2={null} bdi={num(BDI_SUGERIDO)} uf={UF_SUGERIDA} />
              <Campo rotulo="Orçamento — custo direto (R$)" className="col-span-full">
                <CampoNumero name="orcamento_total" placeholder="Em branco = área × valor do m²" />
              </Campo>
              <Button type="submit">Criar obra com etapas padrão</Button>
            </form>
          </Card>
          {!vazia && (
            <Button variant="link" className="self-start px-0 text-muted-foreground underline" onClick={() => acao("obra.exemplo")}>
              Criar também uma obra de exemplo
            </Button>
          )}
        </section>
        <section className="flex flex-col gap-2.5">
          <h2 className="flex items-center gap-2 font-bold">Obras cadastradas <span className="font-mono text-xs font-normal text-muted-foreground">{sis.obras.size}</span></h2>
          {sis.ordenadas().map((x) => <CartaoObra key={x.id} x={x} ativa={o?.id === x.id} />)}
          {vazia && <Nota>Nenhuma obra cadastrada.</Nota>}
          {o && <FormEditar o={o} />}
          <ConfigIa />
        </section>
      </div>
    </>
  );
}

function CartaoObra({ x, ativa }: { x: Obra; ativa: boolean }) {
  const { sis, acao } = useSistema();
  const pf = an.progressoFisico(x);
  const confirmar = sis.ui.confirmar_exclusao === x.id;
  return (
    <Card className={cn("gap-2 p-3.5", ativa && "border-foreground shadow-[inset_3px_0_0_var(--sinal)]")}>
      <div className="flex flex-wrap items-start justify-between gap-2.5">
        <h3 className="min-w-0 break-words font-semibold">{x.nome} {x.exemplo && <Badge variant="secondary">exemplo</Badge>}</h3>
        {ativa ? <Badge variant="ok">Ativa</Badge> : <Button size="sm" onClick={() => acao("obra.selecionar", { id: x.id })}>Abrir</Button>}
      </div>
      <p className="text-[0.8rem] text-muted-foreground">
        {x.cliente || "—"} · {moeda(x.orcamento_total)} · {x.compras.length} compras · {x.tarefas.length} tarefas
      </p>
      <Progress value={pf} />
      <p className="text-[0.8rem] text-muted-foreground">Avanço físico {pct(pf)}</p>
      <div className="flex flex-wrap items-center gap-2">
        {confirmar ? (
          <span className="flex flex-wrap items-center gap-2 text-sm font-semibold text-critico">
            Excluir “{x.nome}” e todos os dados?
            <Button variant="destructive" size="sm" onClick={() => acao("obra.excluir", { id: x.id })}>Sim, excluir</Button>
            <Button variant="outline" size="sm" onClick={() => acao("obra.cancelar_exclusao")}>Cancelar</Button>
          </span>
        ) : (
          <Button variant="link" size="sm" className="px-0 text-muted-foreground underline" onClick={() => acao("obra.excluir", { id: x.id })}>Excluir</Button>
        )}
      </div>
    </Card>
  );
}

function FormEditar({ o }: { o: Obra }) {
  const enviar = useEnviar();
  // remonta o formulário quando os dados gravados mudam (valores padrão sempre atuais)
  const chave = [o.id, o.nome, o.cliente, o.endereco, o.responsavel_tecnico, o.inicio, o.fim_previsto, o.area_construida,
    o.padrao, o.valor_m2, o.uf_cub, o.bdi, o.orcamento_total].join("|");
  return (
    <>
      <h2 className="mt-2 font-bold">Dados da obra ativa</h2>
      <Card className="p-4">
        <form key={chave} className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,180px),1fr))] items-end gap-2.5" onSubmit={enviar("obra.editar")}>
          <Campo rotulo="Nome" className="col-span-full"><Input name="nome" defaultValue={o.nome} required maxLength={200} /></Campo>
          <Campo rotulo="Cliente"><Input name="cliente" defaultValue={o.cliente} maxLength={200} /></Campo>
          <Campo rotulo="Responsável técnico"><Input name="responsavel_tecnico" defaultValue={o.responsavel_tecnico} maxLength={200} /></Campo>
          <Campo rotulo="Endereço" className="col-span-full"><Input name="endereco" defaultValue={o.endereco} maxLength={200} /></Campo>
          <Campo rotulo="Início"><Input name="inicio" type="date" defaultValue={o.inicio} /></Campo>
          <Campo rotulo="Término previsto"><Input name="fim_previsto" type="date" defaultValue={o.fim_previsto} /></Campo>
          <Campo rotulo="Área construída (m²)"><CampoNumero name="area_construida" texto={num(o.area_construida)} placeholder="100" /></Campo>
          <CamposPadrao padrao={o.padrao} valorM2={o.valor_m2} bdi={num(o.bdi)} uf={o.uf_cub} />
          <Campo rotulo="Orçamento — custo direto (R$)" className="col-span-full"><CampoNumero name="orcamento_total" valor={o.orcamento_total} /></Campo>
          <Button type="submit">Salvar dados</Button>
        </form>
      </Card>
      <BlocoPadrao o={o} comAcao />
    </>
  );
}

function CamposPadrao({ padrao, valorM2, bdi, uf }: { padrao: string; valorM2: number | null; bdi: string; uf: string }) {
  // o estado escolhido atualiza na hora os valores da lista de padrões, a referência e a tabela
  const [ufValida, setUf] = React.useState(uf in CUB_ESTADOS ? uf : UF_SUGERIDA);
  return (
    <>
      <Campo rotulo="CUB do estado">
        <NativeSelect name="uf_cub" value={ufValida} onChange={(e) => setUf(e.target.value)}>
          {UFS.map((u) => <option key={u} value={u}>{rotuloUf(u)}</option>)}
        </NativeSelect>
      </Campo>
      <Campo rotulo="Padrão construtivo">
        <NativeSelect name="padrao" defaultValue={padrao}>
          {CODIGOS_PADRAO.map((c) => (
            <option key={c} value={c}>
              {c === "PERS" ? "Personalizado (informe o valor)" : `${rotuloPadrao(c)} — ${moeda(valorReferencia(c, ufValida))}/m² (${ufValida})`}
            </option>
          ))}
        </NativeSelect>
      </Campo>
      <Campo rotulo="Valor por m² (R$)"><CampoNumero name="valor_m2" valor={valorM2} placeholder="Em branco = CUB do padrão no estado" /></Campo>
      <Campo rotulo="BDI (%)"><CampoNumero name="bdi" texto={bdi} placeholder="0" aria-label="BDI em porcentagem" /></Campo>
      <Nota className="col-span-full">
        Referência: {referenciaCub(ufValida)}. Ao trocar o estado ou o padrão, o valor por m² passa a ser o CUB correspondente; para usar
        um custo próprio, digite outro valor por m². O orçamento é o custo direto (comparável ao CUB); o BDI (administração, riscos,
        impostos e lucro) entra por cima e forma o preço de venda. Faixa usual em residências: 20% a 30%.
      </Nota>
      <details className="col-span-full">
        <summary className="cursor-pointer text-[0.82rem] font-semibold">Tabela CUB por estado (R1-B, R1-N, R1-A)</summary>
        <Table className="mt-2 text-[0.78rem]">
          <TableHeader>
            <TableRow><TableHead>UF</TableHead><TableHead>Estado</TableHead><TableHead>Baixo R1-B</TableHead><TableHead>Normal R1-N</TableHead><TableHead>Alto R1-A</TableHead><TableHead>Mês</TableHead></TableRow>
          </TableHeader>
          <TableBody>
            {UFS.map((u) => {
              const [nome, , mes, b, n, a] = CUB_ESTADOS[u];
              return (
                <TableRow key={u} className={cn(u === ufValida && "[&>td]:bg-sinal! [&>td]:font-semibold [&>td]:text-sinal-foreground")}>
                  <TableCell>{u}</TableCell><TableCell>{nome}</TableCell>
                  <TableCell className="text-right font-mono">{moeda(b)}</TableCell>
                  <TableCell className="text-right font-mono">{moeda(n)}</TableCell>
                  <TableCell className="text-right font-mono">{moeda(a)}</TableCell>
                  <TableCell>{mes}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        <Nota className="mt-1.5">
          Valores sem desoneração da folha, publicados pelos sindicatos da construção de cada estado (NBR 12721).{" "}
          {UF_SEM_PADRAO.join(", ")} não publicam os padrões R1: use “Personalizado” com o valor do seu orçamento.
        </Nota>
      </details>
    </>
  );
}

export { CardContent, CardHeader, CardTitle };
