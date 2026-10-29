"use client";

import * as React from "react";
import { CheckIcon, KeyRoundIcon, PencilIcon, PhoneIcon, ShieldIcon, UserPlusIcon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import * as ac from "@/lib/acesso";
import * as ct from "@/lib/contas";
import * as gs from "@/lib/core/gestao";
import { dataBr, moeda, num, somarDias, valorBr } from "@/lib/core/util";
import { cn } from "@/lib/utils";
import { useAcesso } from "./acesso";
import { PainelServidor } from "./painel-servidor";
import { Campo, CampoNumero, Nota } from "./comum";
import { BarraModulo, BotaoExcluir, Busca, casa, GRADE_FORM, Indicadores, Sugestoes, Vazio } from "./modulo-comum";
import { useEnviar, useSistema } from "./provedor";

const SUBS = [
  ["membros", "Pessoas", "Pessoas"],
  ["presenca", "Presença", "Presença"],
  ["acessos", "Acessos ao sistema", "Acessos"],
] as const;

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const nomeMes = (m: string) => `${MESES[Number(m.slice(5, 7)) - 1]} de ${m.slice(0, 4)}`;

export function TelaEquipe() {
  const { sis, acao } = useSistema();
  const sub = SUBS.some(([v]) => v === sis.ui.sub) ? sis.ui.sub : "membros";
  return (
    <>
      <nav aria-label="Gestão de equipe" className="grid grid-cols-3 gap-1 rounded-lg border bg-card p-1">
        {SUBS.map(([v, rot, curto]) => (
          <button
            key={v}
            type="button"
            aria-current={sub === v ? "page" : undefined}
            onClick={() => acao("ui.sub", { sub: v })}
            className={cn(
              "truncate rounded-md px-2 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
              sub === v && "bg-trilho font-semibold text-white shadow-[inset_0_-3px_0_var(--sinal)] hover:bg-trilho hover:text-white",
            )}
          >
            <span className="sm:hidden">{curto}</span><span className="hidden sm:inline">{rot}</span>
          </button>
        ))}
      </nav>
      {sub === "membros" && <Membros />}
      {sub === "presenca" && <Presenca />}
      {sub === "acessos" && <Acessos />}
    </>
  );
}

// ================================================================ pessoas
function Membros() {
  const { sis, acao } = useSistema();
  const g = sis.cadastros;
  const mes = sis.hoje.slice(0, 7);
  const [busca, setBusca] = React.useState("");
  const [obra, setObra] = React.useState("todas");
  const [inativos, setInativos] = React.useState(false);
  const r = gs.resumoEquipe(g, mes, sis.hoje);
  const lista = g.equipe
    .filter((m) => (inativos || m.ativo) && (obra === "todas" || m.obra === obra) && casa(busca, m.nome, m.funcao, m.telefone, m.vinculo))
    .sort((a, b) => Number(b.ativo) - Number(a.ativo) || a.nome.localeCompare(b.nome, "pt-BR"));
  return (
    <>
      <BarraModulo
        texto="Pessoas do escritório e do canteiro, com função, vínculo, custo por dia e obra onde estão alocadas. A presença marcada gera os dias trabalhados e o custo do mês."
        qual="membro"
        rotuloNovo="Nova pessoa"
      />
      <Indicadores
        itens={[
          { rotulo: "Pessoas ativas", valor: String(r.ativos), sub: `${r.alocados} alocada(s) em obra` },
          { rotulo: "Presentes hoje", valor: String(r.presentes_hoje), sub: dataBr(sis.hoje) },
          { rotulo: "Dias trabalhados", valor: num(r.dias_mes), sub: nomeMes(mes) },
          { rotulo: "Custo de mão de obra", valor: moeda(r.custo_mes), sub: nomeMes(mes) },
        ]}
      />
      {sis.ui.novo === "membro" && <FormMembro />}
      <div className="flex flex-wrap items-center gap-2">
        <Busca valor={busca} aoMudar={setBusca} placeholder="Buscar nome, função, telefone…" />
        <NativeSelect aria-label="Filtrar por obra" value={obra} onChange={(e) => setObra(e.target.value)} className="w-auto max-w-64">
          <option value="todas">Todas as alocações</option>
          <option value="">Escritório / sem obra</option>
          {sis.ordenadas().map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
        </NativeSelect>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={inativos} onChange={(e) => setInativos(e.target.checked)} className="size-4" />Mostrar inativos</label>
      </div>
      {lista.length ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,320px),1fr))] items-start gap-2.5">
          {lista.map((m) => {
            if (sis.ui.editando === m.id) return <FormMembro key={m.id} m={m} className="col-span-full" />;
            const rm = gs.resumoMes(m, mes);
            return (
              <Card key={m.id} className={cn("gap-1.5 p-3.5", !m.ativo && "opacity-70")}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="break-words font-semibold">{m.nome}</h3>
                    <p className="text-[0.82rem] text-muted-foreground">{m.funcao} · {m.vinculo}{!m.ativo && " · inativo"}</p>
                  </div>
                  {m.presencas.includes(sis.hoje) && <span className="shrink-0 rounded-sm bg-ok px-1.5 text-[0.72rem] font-semibold text-selo-texto">presente hoje</span>}
                </div>
                <p className="text-[0.82rem]">{gs.nomeObraOu(sis.obras, m.obra)}</p>
                <p className="flex flex-wrap gap-x-3 text-[0.8rem] text-muted-foreground">
                  <span>{m.custo_dia ? `${moeda(m.custo_dia)}/dia` : "sem custo/dia"}</span>
                  <span>{rm.dias} dia(s) em {MESES[Number(mes.slice(5, 7)) - 1]} · {moeda(rm.custo)}</span>
                  {m.telefone && <a className="inline-flex items-center gap-1 hover:underline" href={`tel:${m.telefone.replace(/[^\d+]/g, "")}`}><PhoneIcon className="size-3.5" />{m.telefone}</a>}
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <Button variant="link" size="sm" className="px-0 underline" onClick={() => acao("ui.editar", { id: m.id })}><PencilIcon />Editar</Button>
                  <BotaoExcluir acaoNome="eq.remover" id={m.id} rotulo="Remover" pergunta={`Remover ${m.nome}?`} />
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Vazio>{g.equipe.length ? "Ninguém neste filtro." : "Nenhuma pessoa cadastrada. Use “Nova pessoa” para montar a equipe."}</Vazio>
      )}
    </>
  );
}

function FormMembro({ m, className }: { m?: gs.Membro; className?: string }) {
  const { sis, acao } = useSistema();
  const enviar = useEnviar();
  return (
    <Card className={cn("p-4", className)}>
      <h3 className="font-semibold">{m ? `Editar ${m.nome}` : "Nova pessoa na equipe"}</h3>
      <form className={GRADE_FORM} onSubmit={enviar("eq.salvar", m ? { id: m.id } : {}, { limpar: !m })}>
        <Campo rotulo="Nome" className="col-span-full"><Input name="nome" required maxLength={200} defaultValue={m?.nome} /></Campo>
        <Campo rotulo="Função"><Input name="funcao" maxLength={60} defaultValue={m?.funcao} list="funcoes-equipe" placeholder="Ex.: Pedreiro(a)" /></Campo>
        <Campo rotulo="Vínculo"><NativeSelect name="vinculo" defaultValue={m?.vinculo ?? "Diarista"}>{gs.VINCULOS.map((v) => <option key={v}>{v}</option>)}</NativeSelect></Campo>
        <Campo rotulo="Custo por dia (R$)"><CampoNumero name="custo_dia" texto={m?.custo_dia ? valorBr(m.custo_dia) : ""} placeholder="Ex.: 150,00" /></Campo>
        <Campo rotulo="Alocado em">
          <NativeSelect name="obra" defaultValue={m?.obra ?? sis.obra?.id ?? ""}>
            <option value="">Escritório / sem obra</option>
            {sis.ordenadas().map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
          </NativeSelect>
        </Campo>
        <Campo rotulo="Telefone / WhatsApp"><Input name="telefone" type="tel" maxLength={40} defaultValue={m?.telefone} /></Campo>
        <Campo rotulo="CPF"><Input name="documento" maxLength={30} defaultValue={m?.documento} /></Campo>
        <Campo rotulo="Início na equipe"><Input name="admissao" type="date" defaultValue={m?.admissao} /></Campo>
        <Campo rotulo="Situação"><NativeSelect name="ativo" defaultValue={m && !m.ativo ? "0" : "1"}><option value="1">Ativo</option><option value="0">Inativo</option></NativeSelect></Campo>
        <Campo rotulo="Observação" className="col-span-full"><Input name="observacao" maxLength={500} defaultValue={m?.observacao} /></Campo>
        <Sugestoes id="funcoes-equipe" valores={[...gs.FUNCOES, ...sis.cadastros.equipe.map((x) => x.funcao)]} />
        <div className="flex gap-2">
          <Button type="submit">{m ? "Salvar" : "Adicionar à equipe"}</Button>
          <Button type="button" variant="outline" onClick={() => (m ? acao("ui.editar", { id: m.id }) : acao("ui.novo", { qual: "membro" }))}>Cancelar</Button>
        </div>
      </form>
    </Card>
  );
}

// ================================================================ presença
function Presenca() {
  const { sis, acao } = useSistema();
  const g = sis.cadastros;
  const [data, setData] = React.useState(sis.hoje);
  const [obra, setObra] = React.useState(sis.obra?.id ?? "todas");
  const mes = data.slice(0, 7);
  const ativos = g.equipe.filter((m) => m.ativo && (obra === "todas" || m.obra === obra)).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  const presentes = ativos.filter((m) => m.presencas.includes(data)).length;
  const custoObra = gs.custoPorObra(g, mes);
  const filtroObra = obra === "todas" ? "" : obra;
  return (
    <>
      <Card className="flex-row flex-wrap items-end gap-3 p-3.5">
        <Campo rotulo="Dia">
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" aria-label="Dia anterior" onClick={() => setData((d) => somarDias(d, -1))}>‹</Button>
            <Input type="date" value={data} onChange={(e) => e.target.value && setData(e.target.value)} className="w-40" />
            <Button variant="outline" size="sm" aria-label="Dia seguinte" onClick={() => setData((d) => somarDias(d, 1))}>›</Button>
          </div>
        </Campo>
        <Campo rotulo="Obra">
          <NativeSelect value={obra} onChange={(e) => setObra(e.target.value)} className="w-auto max-w-64">
            <option value="todas">Todas</option>
            <option value="">Escritório / sem obra</option>
            {sis.ordenadas().map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
          </NativeSelect>
        </Campo>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => acao("eq.todos", { data, obra: filtroObra, presente: "1" })} disabled={!ativos.length}><CheckIcon />Todos presentes</Button>
          <Button size="sm" variant="outline" onClick={() => acao("eq.todos", { data, obra: filtroObra, presente: "0" })} disabled={!ativos.length}>Limpar o dia</Button>
        </div>
        <span className="ml-auto text-sm"><b className="font-mono">{presentes}</b> de {ativos.length} presente(s) em {dataBr(data)}</span>
      </Card>
      {ativos.length ? (
        <Card className="gap-0 overflow-hidden p-0">
          <ul className="divide-y">
            {ativos.map((m) => {
              const presente = m.presencas.includes(data);
              const rm = gs.resumoMes(m, mes);
              return (
                <li key={m.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3.5 py-2.5">
                  <span className="flex min-w-0 flex-1 basis-48 flex-col">
                    <span className="font-medium">{m.nome}</span>
                    <span className="text-[0.78rem] text-muted-foreground">{m.funcao} · {gs.nomeObraOu(sis.obras, m.obra)} · {rm.dias} dia(s) no mês</span>
                  </span>
                  <div className="flex rounded-md border p-0.5" role="radiogroup" aria-label={`Presença de ${m.nome} em ${dataBr(data)}`}>
                    <button
                      type="button" role="radio" aria-checked={presente}
                      onClick={() => !presente && acao("eq.presenca", { id: m.id, data, presente: "1" })}
                      className={cn("inline-flex items-center gap-1 rounded px-3 py-1.5 text-sm font-medium", presente ? "bg-ok text-selo-texto" : "text-muted-foreground hover:bg-muted")}
                    >
                      <CheckIcon className="size-4" />Presente
                    </button>
                    <button
                      type="button" role="radio" aria-checked={!presente}
                      onClick={() => presente && acao("eq.presenca", { id: m.id, data, presente: "0" })}
                      className={cn("inline-flex items-center gap-1 rounded px-3 py-1.5 text-sm font-medium", !presente ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted")}
                    >
                      <XIcon className="size-4" />Ausente
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      ) : (
        <Vazio>Nenhuma pessoa ativa {obra === "todas" ? "na equipe" : "nesta alocação"}. Cadastre em “Pessoas”.</Vazio>
      )}
      {g.equipe.length > 0 && (
        <Card className="gap-0 overflow-hidden p-0">
          <h3 className="px-3.5 pt-3 text-[0.9rem] font-semibold">Custo de mão de obra própria — {nomeMes(mes)}</h3>
          <div className="overflow-x-auto p-3.5 pt-2">
            <Table className="text-[0.84rem]">
              <TableHeader><TableRow><TableHead>Alocação</TableHead><TableHead className="text-right">Custo no mês</TableHead></TableRow></TableHeader>
              <TableBody>
                {[...custoObra.entries()].sort((a, b) => b[1] - a[1]).map(([id, v]) => (
                  <TableRow key={id || "escritorio"}><TableCell>{gs.nomeObraOu(sis.obras, id)}</TableCell><TableCell className="text-right font-mono">{moeda(v)}</TableCell></TableRow>
                ))}
                {!custoObra.size && <TableRow><TableCell colSpan={2} className="text-muted-foreground">Sem presenças registradas neste mês.</TableCell></TableRow>}
              </TableBody>
              {custoObra.size > 0 && (
                <TableFooter><TableRow><TableCell>Total</TableCell><TableCell className="text-right font-mono font-bold">{moeda([...custoObra.values()].reduce((s, v) => s + v, 0))}</TableCell></TableRow></TableFooter>
              )}
            </Table>
          </div>
        </Card>
      )}
    </>
  );
}

// ================================================================ acessos ao sistema
function useOperacao() {
  const [msg, setMsg] = React.useState<{ texto: string; erro: boolean } | null>(null);
  const [ocupado, setOcupado] = React.useState(false);
  const rodar = async (fn: () => Promise<unknown> | unknown, ok: string) => {
    setOcupado(true);
    setMsg(null);
    try {
      await fn();
      setMsg({ texto: ok, erro: false });
      return true;
    } catch (e) {
      setMsg({ texto: e instanceof ac.AcessoErro ? e.message : "Não foi possível concluir.", erro: true });
      return false;
    } finally {
      setOcupado(false);
    }
  };
  return { msg, ocupado, rodar };
}

function Aviso({ msg }: { msg: { texto: string; erro: boolean } | null }) {
  if (!msg) return null;
  return <p role={msg.erro ? "alert" : "status"} className={cn("text-sm font-medium", msg.erro ? "text-critico" : "text-ok")}>{msg.texto}</p>;
}

function Acessos() {
  const { conta, contas, recarregar, modo } = useAcesso();
  const admin = conta?.papel === "admin";
  if (!conta) return null;
  return (
    <>
      <Card className="flex-row flex-wrap items-center gap-2.5 p-3.5">
        <ShieldIcon className="size-5 shrink-0" />
        <Nota className="min-w-0 flex-1 basis-72">
          {modo === "servidor"
            ? <>Usuários e senhas ficam no <b>servidor do escritório</b>, com a senha criptografada: cada pessoa entra com o mesmo acesso em qualquer aparelho.</>
            : <>Usuários e senhas ficam guardados <b>neste aparelho</b>, com a senha criptografada. Cada pessoa que for usar outro celular ou computador
              precisa ter o acesso criado nele também — ou conecte um servidor do escritório.</>}{" "}
          {admin ? "Como administrador, você cria acessos e redefine senhas." : "Peça a um administrador para criar ou redefinir acessos."}
        </Nota>
      </Card>
      <PainelServidor />
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <MinhaSenha />
        {admin && <NovoAcesso aoCriar={recarregar} />}
      </div>
      <Card className="gap-0 overflow-hidden p-0">
        <h3 className="px-3.5 pt-3 text-[0.9rem] font-semibold">Acessos cadastrados ({contas.length})</h3>
        <ul className="divide-y">
          {contas.map((c) => <LinhaAcesso key={c.id} c={c} eu={c.id === conta.id} admin={admin} />)}
        </ul>
      </Card>
    </>
  );
}

function MinhaSenha() {
  const { conta, modo } = useAcesso();
  const { msg, ocupado, rodar } = useOperacao();
  const enviar = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const nova = String(f.get("nova") ?? "");
    if (nova !== String(f.get("confirmar") ?? "")) return rodar(() => { throw new ac.AcessoErro("As senhas novas não são iguais."); }, "");
    if (await rodar(() => ct.alterarSenha(conta!.id, String(f.get("atual") ?? ""), nova), modo === "servidor" ? "Senha alterada. Os outros aparelhos conectados precisarão entrar de novo." : "Senha alterada.")) form.reset();
  };
  return (
    <Card className="gap-3 p-4">
      <h3 className="flex items-center gap-2 font-semibold"><KeyRoundIcon className="size-4" />Minha senha</h3>
      <p className="text-[0.82rem] text-muted-foreground">{conta?.nome} · @{conta?.usuario}</p>
      <form className={GRADE_FORM} onSubmit={enviar}>
        <Campo rotulo="Senha atual" className="col-span-full"><Input name="atual" type="password" autoComplete="current-password" required /></Campo>
        <Campo rotulo="Nova senha"><Input name="nova" type="password" autoComplete="new-password" required minLength={8} /></Campo>
        <Campo rotulo="Confirmar nova senha"><Input name="confirmar" type="password" autoComplete="new-password" required minLength={8} /></Campo>
        <Button type="submit" disabled={ocupado}>Alterar senha</Button>
      </form>
      <Aviso msg={msg} />
    </Card>
  );
}

function NovoAcesso({ aoCriar }: { aoCriar: () => Promise<void> }) {
  const { conta } = useAcesso();
  const { sis } = useSistema();
  const { msg, ocupado, rodar } = useOperacao();
  const enviar = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const d = { nome: String(f.get("nome") ?? ""), usuario: String(f.get("usuario") ?? ""), senha: String(f.get("senha") ?? ""), papel: (String(f.get("papel")) === "admin" ? "admin" : "membro") as ac.Papel };
    if (await rodar(() => ct.criar(d, conta!), `Acesso de ${d.nome} criado. Passe o usuário e a senha provisória para a pessoa.`)) {
      form.reset();
      await aoCriar();
    }
  };
  return (
    <Card className="gap-3 p-4">
      <h3 className="flex items-center gap-2 font-semibold"><UserPlusIcon className="size-4" />Novo acesso</h3>
      <form className={GRADE_FORM} onSubmit={enviar}>
        <Campo rotulo="Nome" className="col-span-full"><Input name="nome" required maxLength={80} list="nomes-equipe" /></Campo>
        <Campo rotulo="Usuário"><Input name="usuario" required maxLength={32} autoCapitalize="none" spellCheck={false} placeholder="ex.: thamyris" /></Campo>
        <Campo rotulo="Senha provisória"><Input name="senha" type="text" required minLength={8} autoComplete="off" placeholder="mín. 8, letras e números" /></Campo>
        <Campo rotulo="Permissão">
          <NativeSelect name="papel" defaultValue="membro"><option value="membro">Membro</option><option value="admin">Administrador</option></NativeSelect>
        </Campo>
        <Sugestoes id="nomes-equipe" valores={sis.cadastros.equipe.map((m) => m.nome)} />
        <Button type="submit" disabled={ocupado}>Criar acesso</Button>
      </form>
      <Aviso msg={msg} />
    </Card>
  );
}

function LinhaAcesso({ c, eu, admin }: { c: ct.ContaPublica; eu: boolean; admin: boolean }) {
  const { conta, recarregar } = useAcesso();
  const { msg, ocupado, rodar } = useOperacao();
  const [modo, setModo] = React.useState<"" | "senha" | "remover">("");
  const redefinir = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const nova = String(new FormData(e.currentTarget).get("nova") ?? "");
    if (await rodar(() => ct.redefinirSenha(conta!, c.id, nova), "Senha redefinida. Passe a nova senha para a pessoa.")) setModo("");
  };
  return (
    <li className="flex flex-col gap-2 px-3.5 py-2.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-trilho text-[0.74rem] font-bold text-sinal" aria-hidden>
          {c.nome.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("")}
        </span>
        <span className="flex min-w-0 flex-1 basis-40 flex-col">
          <span className="font-medium">{c.nome}{eu && <span className="text-muted-foreground"> (você)</span>}</span>
          <span className="text-[0.78rem] text-muted-foreground">@{c.usuario} · desde {new Date(c.criada_em).toLocaleDateString("pt-BR")}{c.ultimo_acesso ? ` · último acesso ${new Date(c.ultimo_acesso).toLocaleDateString("pt-BR")}` : ""}</span>
        </span>
        {admin && !eu ? (
          <NativeSelect
            aria-label={`Permissão de ${c.nome}`}
            value={c.papel}
            onChange={(e) => rodar(async () => { await ct.alterarPapel(conta!, c.id, e.target.value as ac.Papel); await recarregar(); }, "Permissão alterada.")}
            className="h-8 w-auto"
          >
            <option value="membro">Membro</option>
            <option value="admin">Administrador</option>
          </NativeSelect>
        ) : (
          <span className="rounded-sm border px-1.5 text-[0.74rem] font-semibold">{c.papel === "admin" ? "Administrador" : "Membro"}</span>
        )}
        {admin && !eu && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setModo(modo === "senha" ? "" : "senha")}>Redefinir senha</Button>
            {modo === "remover" ? (
              <>
                <Button size="sm" variant="destructive" disabled={ocupado} onClick={() => rodar(async () => { await ct.remover(conta!, c.id); await recarregar(); }, "Acesso removido.")}>Sim, remover</Button>
                <Button size="sm" variant="outline" onClick={() => setModo("")}>Cancelar</Button>
              </>
            ) : (
              <Button size="sm" variant="link" className="px-0 text-muted-foreground underline" onClick={() => setModo("remover")}>Remover</Button>
            )}
          </div>
        )}
      </div>
      {modo === "senha" && (
        <form className="flex flex-wrap items-end gap-2 pl-11" onSubmit={redefinir}>
          <Campo rotulo={`Nova senha para @${c.usuario}`}><Input name="nova" type="text" required minLength={8} autoComplete="off" className="w-56" /></Campo>
          <Button type="submit" size="sm" disabled={ocupado}>Salvar</Button>
        </form>
      )}
      <div className="pl-11"><Aviso msg={msg} /></div>
    </li>
  );
}
