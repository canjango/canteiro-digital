"use client";

import * as React from "react";
import { DownloadIcon, MailIcon, PencilIcon, PhoneIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import * as md from "@/lib/core/modulos";
import { dataBr, moeda, valorBr } from "@/lib/core/util";
import { cn } from "@/lib/utils";
import { Campo, CampoNumero, Nota } from "./comum";
import { BarraModulo, BotaoExcluir, Busca, casa, GRADE_FORM, Sugestoes, Vazio } from "./modulo-comum";
import { useEnviar, useSistema } from "./provedor";

// ================================================================ contatos
export function TelaContatos() {
  const { sis, acao } = useSistema();
  const [busca, setBusca] = React.useState("");
  const [tipo, setTipo] = React.useState("");
  const lista = sis.cadastros.contatos
    .filter((c) => (!tipo || c.tipo === tipo) && casa(busca, c.nome, c.especialidade, c.cidade, c.documento, c.telefone, c.email))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  const editando = sis.cadastros.contatos.find((c) => c.id === sis.ui.editando);
  return (
    <>
      <BarraModulo
        texto="Agenda única de fornecedores, prestadores, clientes, funcionários e projetistas — vale para todas as obras. Os fornecedores aparecem nas ordens de compra."
        qual="contato"
        rotuloNovo="Novo contato"
      />
      {sis.ui.novo === "contato" && <FormContato />}
      <div className="flex flex-wrap items-center gap-2">
        <Busca valor={busca} aoMudar={setBusca} placeholder="Buscar por nome, cidade, o que fornece…" />
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar por tipo">
          {["", ...md.TIPOS_CONTATO].map((t) => {
            const n = t ? sis.cadastros.contatos.filter((c) => c.tipo === t).length : sis.cadastros.contatos.length;
            return (
              <Button key={t || "todos"} size="sm" variant={tipo === t ? "default" : "outline"} aria-pressed={tipo === t} onClick={() => setTipo(t)}>
                {t || "Todos"} <span className="font-mono text-[0.74rem] opacity-70">{n}</span>
              </Button>
            );
          })}
        </div>
      </div>
      {lista.length ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,300px),1fr))] items-start gap-2.5">
          {lista.map((c) =>
            editando?.id === c.id ? (
              <FormContato key={c.id} c={c} className="col-span-full" />
            ) : (
              <Card key={c.id} className="gap-1.5 p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="min-w-0 break-words font-semibold">{c.nome}</h3>
                  <span className="shrink-0 rounded-sm border px-1.5 text-[0.7rem] font-semibold uppercase">{c.tipo}</span>
                </div>
                {c.especialidade && <p className="text-[0.82rem]">{c.especialidade}</p>}
                <p className="flex flex-wrap gap-x-3 gap-y-1 text-[0.8rem] text-muted-foreground">
                  {c.telefone && <a className="inline-flex items-center gap-1 hover:underline" href={`tel:${c.telefone.replace(/[^\d+]/g, "")}`}><PhoneIcon className="size-3.5" />{c.telefone}</a>}
                  {c.email && <a className="inline-flex min-w-0 items-center gap-1 break-all hover:underline" href={`mailto:${c.email}`}><MailIcon className="size-3.5 shrink-0" />{c.email}</a>}
                  {c.cidade && <span>{c.cidade}</span>}
                  {c.documento && <span className="font-mono">{c.documento}</span>}
                </p>
                {c.observacao && <Nota>{c.observacao}</Nota>}
                <div className="flex flex-wrap items-center gap-3">
                  <Button variant="link" size="sm" className="px-0 underline" onClick={() => acao("ui.editar", { id: c.id })}><PencilIcon />Editar</Button>
                  <BotaoExcluir acaoNome="contato.remover" id={c.id} pergunta={`Excluir “${c.nome}”?`} />
                </div>
              </Card>
            ),
          )}
        </div>
      ) : (
        <Vazio>{sis.cadastros.contatos.length ? "Nenhum contato encontrado com esse filtro." : "Nenhum contato cadastrado. Comece pelos seus fornecedores."}</Vazio>
      )}
    </>
  );
}

function FormContato({ c, className }: { c?: md.Contato; className?: string }) {
  const { acao } = useSistema();
  const enviar = useEnviar();
  return (
    <Card className={cn("p-4", className)}>
      <h3 className="font-semibold">{c ? `Editar ${c.nome}` : "Novo contato"}</h3>
      <form className={GRADE_FORM} onSubmit={enviar("contato.salvar", c ? { id: c.id } : {}, { limpar: !c })}>
        <Campo rotulo="Nome / razão social" className="col-span-full"><Input name="nome" required maxLength={200} defaultValue={c?.nome} /></Campo>
        <Campo rotulo="Tipo">
          <NativeSelect name="tipo" defaultValue={c?.tipo ?? "Fornecedor"}>{md.TIPOS_CONTATO.map((t) => <option key={t}>{t}</option>)}</NativeSelect>
        </Campo>
        <Campo rotulo="CPF / CNPJ"><Input name="documento" maxLength={30} defaultValue={c?.documento} /></Campo>
        <Campo rotulo="Telefone / WhatsApp"><Input name="telefone" type="tel" maxLength={40} defaultValue={c?.telefone} placeholder="(83) 9 0000-0000" /></Campo>
        <Campo rotulo="E-mail"><Input name="email" type="email" maxLength={200} defaultValue={c?.email} /></Campo>
        <Campo rotulo="Cidade"><Input name="cidade" maxLength={80} defaultValue={c?.cidade} placeholder="João Pessoa - PB" /></Campo>
        <Campo rotulo="Fornece / função"><Input name="especialidade" maxLength={200} defaultValue={c?.especialidade} placeholder="Ex.: cimento, areia e brita" /></Campo>
        <Campo rotulo="Observação" className="col-span-full"><Textarea name="observacao" rows={2} maxLength={500} defaultValue={c?.observacao} /></Campo>
        <div className="flex gap-2">
          <Button type="submit">{c ? "Salvar" : "Cadastrar contato"}</Button>
          {c && <Button type="button" variant="outline" onClick={() => acao("ui.editar", { id: c.id })}>Cancelar</Button>}
        </div>
      </form>
    </Card>
  );
}

// ================================================================ insumos
export function TelaInsumos() {
  const { sis, acao } = useSistema();
  const [busca, setBusca] = React.useState("");
  const [tipo, setTipo] = React.useState("");
  const todos = sis.cadastros.insumos;
  const lista = todos
    .filter((i) => (!tipo || i.tipo === tipo) && casa(busca, i.descricao, i.codigo, i.grupo, i.fonte))
    .sort((a, b) => a.grupo.localeCompare(b.grupo, "pt-BR") || a.descricao.localeCompare(b.descricao, "pt-BR"));
  const LIMITE = 200;
  return (
    <>
      <BarraModulo
        texto="Catálogo de insumos (materiais, mão de obra, equipamentos e serviços) com preço de referência. Serve de sugestão nas solicitações e ordens de compra de todas as obras."
        qual="insumo"
        rotuloNovo="Novo insumo"
      />
      {sis.ui.novo === "insumo" && <FormInsumo />}
      <Card className="gap-2 p-3.5">
        <h3 className="text-[0.86rem] font-semibold">Importar para o catálogo</h3>
        <Nota>Itens já cadastrados (mesma descrição e unidade) não são duplicados.</Nota>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => acao("insumo.importar", { origem: "planilha" })}><DownloadIcon />Planilha de compras (itens com preço)</Button>
          <Button size="sm" variant="outline" onClick={() => acao("insumo.importar", { origem: "materiais" })}><DownloadIcon />Lista de materiais por etapa</Button>
          {sis.obra && <Button size="sm" variant="outline" onClick={() => acao("insumo.importar", { origem: "ordens" })}><DownloadIcon />Preços das ordens de compra desta obra</Button>}
        </div>
      </Card>
      <div className="flex flex-wrap items-center gap-2">
        <Busca valor={busca} aoMudar={setBusca} placeholder="Buscar insumo, código ou grupo…" />
        <NativeSelect aria-label="Tipo de insumo" value={tipo} onChange={(e) => setTipo(e.target.value)} className="w-auto">
          <option value="">Todos os tipos</option>
          {md.TIPOS_INSUMO.map((t) => <option key={t}>{t}</option>)}
        </NativeSelect>
        <span className="font-mono text-xs text-muted-foreground">{lista.length} de {todos.length}</span>
      </div>
      {lista.length ? (
        <Card className="gap-0 overflow-hidden p-0">
          <div className="overflow-x-auto">
            <Table className="text-[0.82rem]">
              <TableHeader>
                <TableRow>
                  <TableHead>Insumo</TableHead><TableHead className="hidden md:table-cell">Grupo</TableHead><TableHead>Un</TableHead>
                  <TableHead className="text-right">Preço ref.</TableHead><TableHead className="hidden lg:table-cell">Fonte</TableHead><TableHead className="w-px" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {lista.slice(0, LIMITE).map((i) =>
                  sis.ui.editando === i.id ? (
                    <TableRow key={i.id}><TableCell colSpan={6} className="whitespace-normal"><FormInsumo i={i} /></TableCell></TableRow>
                  ) : (
                    <TableRow key={i.id}>
                      <TableCell className="whitespace-normal">
                        <span className="font-medium">{i.descricao}</span>
                        <span className="block text-[0.76rem] text-muted-foreground">{i.tipo}{i.codigo ? ` · ${i.codigo}` : ""}</span>
                      </TableCell>
                      <TableCell className="hidden whitespace-normal text-muted-foreground md:table-cell">{i.grupo || "—"}</TableCell>
                      <TableCell>{i.unidade}</TableCell>
                      <TableCell className="text-right font-mono">{i.preco ? moeda(i.preco) : "—"}</TableCell>
                      <TableCell className="hidden whitespace-normal text-[0.76rem] text-muted-foreground lg:table-cell">{i.fonte}{i.atualizado_em ? ` · ${dataBr(i.atualizado_em)}` : ""}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="sm" aria-label={`Editar ${i.descricao}`} onClick={() => acao("ui.editar", { id: i.id })}><PencilIcon /></Button>
                          <BotaoExcluir acaoNome="insumo.remover" id={i.id} rotulo="×" pergunta="Excluir?" />
                        </div>
                      </TableCell>
                    </TableRow>
                  ),
                )}
              </TableBody>
            </Table>
          </div>
          {lista.length > LIMITE && <Nota className="p-3">Mostrando {LIMITE} de {lista.length}. Use a busca para encontrar os demais.</Nota>}
        </Card>
      ) : (
        <Vazio>{todos.length ? "Nenhum insumo encontrado com esse filtro." : "Catálogo vazio. Importe a planilha de compras ou a lista de materiais acima."}</Vazio>
      )}
    </>
  );
}

function FormInsumo({ i }: { i?: md.Insumo }) {
  const { sis, acao } = useSistema();
  const enviar = useEnviar();
  return (
    <Card className={cn("p-4", i && "border-0 p-1 shadow-none")}>
      {!i && <h3 className="font-semibold">Novo insumo</h3>}
      <form className={GRADE_FORM} onSubmit={enviar("insumo.salvar", i ? { id: i.id } : {}, { limpar: !i })}>
        <Campo rotulo="Descrição" className="col-span-full"><Input name="descricao" required maxLength={200} defaultValue={i?.descricao} /></Campo>
        <Campo rotulo="Tipo"><NativeSelect name="tipo" defaultValue={i?.tipo ?? "Material"}>{md.TIPOS_INSUMO.map((t) => <option key={t}>{t}</option>)}</NativeSelect></Campo>
        <Campo rotulo="Unidade"><Input name="unidade" maxLength={20} defaultValue={i?.unidade ?? "un"} list="unidades-insumo" /></Campo>
        <Campo rotulo="Preço de referência (R$)"><CampoNumero name="preco" texto={i ? valorBr(i.preco) : ""} placeholder="0,00" /></Campo>
        <Campo rotulo="Código"><Input name="codigo" maxLength={30} defaultValue={i?.codigo} placeholder="Opcional (ex.: SINAPI)" /></Campo>
        <Campo rotulo="Grupo"><Input name="grupo" maxLength={80} defaultValue={i?.grupo} list="grupos-insumo" /></Campo>
        <Campo rotulo="Fonte do preço"><Input name="fonte" maxLength={80} defaultValue={i?.fonte} placeholder="Cotação, SINAPI-PB…" /></Campo>
        <Sugestoes id="unidades-insumo" valores={["un", "m", "m²", "m³", "kg", "sc", "l", "cj", "vb", "h", "dia", "mês", ...sis.cadastros.insumos.map((x) => x.unidade)]} />
        <Sugestoes id="grupos-insumo" valores={sis.cadastros.insumos.map((x) => x.grupo).filter(Boolean)} />
        <div className="flex gap-2">
          <Button type="submit">{i ? "Salvar" : "Cadastrar insumo"}</Button>
          {i && <Button type="button" variant="outline" onClick={() => acao("ui.editar", { id: i.id })}>Cancelar</Button>}
        </div>
      </form>
    </Card>
  );
}
