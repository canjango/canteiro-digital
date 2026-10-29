"use client";

import * as React from "react";
import { DatabaseIcon, DownloadIcon, Loader2Icon, UploadIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/native-select";
import * as ct from "@/lib/contas";
import { CHAVE_CADASTROS, CHAVE_LOCAL } from "@/lib/plataforma";
import { api, enderecoAtual, ErroServidor, lerToken } from "@/lib/servidor";
import { useAcesso } from "./acesso";
import { Nota } from "./comum";

function lerLocal<T>(chave: string, padrao: T): T {
  try {
    const v = localStorage.getItem(chave);
    return v ? (JSON.parse(v) as T) : padrao;
  } catch {
    return padrao;
  }
}

/** Baixa um arquivo da API (com o token) e entrega como download. */
async function baixar(caminho: string, nome: string) {
  const r = await fetch(`${enderecoAtual()}/api${caminho}`, { headers: { authorization: `Bearer ${lerToken()}` }, cache: "no-store" });
  if (!r.ok) {
    const j = (await r.json().catch(() => ({}))) as { erro?: string };
    throw new ErroServidor(j.erro ?? `Erro ${r.status}`, r.status);
  }
  const url = URL.createObjectURL(await r.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

const RELATORIOS: [string, string][] = [
  ["projetos", "Projetos"], ["parcelas", "Parcelas de honorários"], ["horas", "Horas lançadas"], ["despesas", "Despesas dos projetos"],
  ["tarefas_projeto", "Tarefas dos projetos"], ["orcamento_itens", "Itens de orçamento"], ["oportunidades", "Propostas e licitações"],
  ["obras", "Obras"], ["etapas", "Etapas das obras"], ["compras", "Compras das obras"], ["tarefas_obra", "Tarefas das obras"],
  ["contatos", "Contatos"], ["insumos", "Insumos"], ["equipe", "Equipe"], ["produtos", "Biblioteca de produtos"],
];

/** Servidor do escritório: situação, envio dos dados deste navegador, cópia de segurança e relatórios. */
export function PainelServidor() {
  const { modo, endereco, conta } = useAcesso();
  const admin = conta?.papel === "admin";
  const [msg, setMsg] = React.useState<{ texto: string; erro: boolean } | null>(null);
  const [ocupado, setOcupado] = React.useState("");
  const [rel, setRel] = React.useState("projetos");
  const obrasLocais = React.useMemo(() => lerLocal<{ id?: string; exemplo?: boolean }[]>(CHAVE_LOCAL, []).filter((o) => o && o.id), []);
  const cadLocal = React.useMemo(() => lerLocal<Record<string, unknown> | null>(CHAVE_CADASTROS, null), []);
  const contasLocais = React.useMemo(() => (modo === "servidor" ? ct.contasLocaisParaImportar() : []), [modo]);

  if (modo !== "servidor") {
    return (
      <Card className="flex-row flex-wrap items-center gap-2.5 p-3.5">
        <DatabaseIcon className="size-5 shrink-0" />
        <Nota className="min-w-0 flex-1 basis-72">
          <b>Servidor do escritório:</b> para a equipe usar os mesmos dados em vários aparelhos, instale o servidor (Node + PostgreSQL, pasta <span className="font-mono">server/</span> do projeto) e,
          na tela de entrada, use “conectar a um servidor”. Depois, entre como administrador e envie para lá o que está neste navegador.
        </Nota>
      </Card>
    );
  }

  const rodar = async (qual: string, fn: () => Promise<string>) => {
    setOcupado(qual);
    setMsg(null);
    try {
      setMsg({ texto: await fn(), erro: false });
    } catch (e) {
      setMsg({ texto: e instanceof Error ? e.message : "Não foi possível concluir.", erro: true });
    } finally {
      setOcupado("");
    }
  };
  const temLocal = obrasLocais.length > 0 || Boolean(cadLocal) || contasLocais.length > 0;
  const importar = (substituir: boolean, comContas: boolean) =>
    rodar("importar", async () => {
      const r = await api<{ obras: number; obras_ignoradas: number; cadastros: boolean; contas: number; contas_ignoradas: string[] }>("/importar", {
        corpo: { obras: obrasLocais, cadastros: cadLocal, contas: comContas ? contasLocais : [], substituir },
        tempo: 120_000,
      });
      const partes = [
        `${r.obras} obra(s) enviada(s)${r.obras_ignoradas ? ` (${r.obras_ignoradas} já existia(m) no servidor)` : ""}`,
        cadLocal ? (r.cadastros ? "cadastros enviados" : "cadastros mantidos (o servidor já tinha)") : "",
        comContas ? `${r.contas} acesso(s) criado(s)${r.contas_ignoradas.length ? ` — já existiam: ${r.contas_ignoradas.map((u) => `@${u}`).join(", ")}` : ""}` : "",
      ].filter(Boolean);
      setTimeout(() => location.reload(), 2500);
      return `${partes.join("; ")}. Recarregando…`;
    });

  return (
    <Card className="gap-3 p-4">
      <h3 className="flex items-center gap-2 font-semibold"><DatabaseIcon className="size-4" />Servidor do escritório</h3>
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-[0.84rem]">
        <dt className="text-muted-foreground">Endereço</dt><dd className="truncate font-mono">{endereco.replace(/^https?:\/\//, "")}</dd>
        <dt className="text-muted-foreground">Escritório</dt><dd>{conta?.escritorio ?? "—"}</dd>
        <dt className="text-muted-foreground">Banco</dt><dd>PostgreSQL · sincroniza a cada 15 s entre os aparelhos</dd>
      </dl>
      {admin && temLocal && (
        <div className="flex flex-col gap-2 rounded-md border border-dashed p-3">
          <p className="text-[0.86rem]">
            <b>Este navegador tem dados do modo local</b>: {obrasLocais.length} obra(s){cadLocal ? ", cadastros (projetos, contatos, equipe…)" : ""}
            {contasLocais.length ? ` e ${contasLocais.length} acesso(s)` : ""}. Envie para o servidor para a equipe toda ver.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={Boolean(ocupado)} onClick={() => importar(false, true)}>
              {ocupado === "importar" ? <Loader2Icon className="animate-spin" /> : <UploadIcon />}Enviar o que falta no servidor
            </Button>
            <Button size="sm" variant="outline" disabled={Boolean(ocupado)} onClick={() => importar(true, true)}>Enviar e substituir o que já existe</Button>
          </div>
          <Nota className="text-[0.76rem]">Os acessos vão com a senha criptografada (cada pessoa continua com a mesma senha). Nada é apagado deste navegador.</Nota>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <NativeSelect aria-label="Relatório" value={rel} onChange={(e) => setRel(e.target.value)} className="w-auto">
          {RELATORIOS.map(([n, t]) => <option key={n} value={n}>{t}</option>)}
        </NativeSelect>
        <Button size="sm" variant="outline" disabled={Boolean(ocupado)} onClick={() => rodar("csv", async () => { await baixar(`/relatorios/${rel}?formato=csv`, `${rel}.csv`); return "Planilha baixada (abre no Excel)."; })}>
          {ocupado === "csv" ? <Loader2Icon className="animate-spin" /> : <DownloadIcon />}Baixar planilha (CSV)
        </Button>
        {admin && (
          <Button size="sm" variant="outline" disabled={Boolean(ocupado)} onClick={() => rodar("backup", async () => { await baixar("/exportar", `canteiro-digital-${new Date().toISOString().slice(0, 10)}.json`); return "Cópia de segurança baixada."; })}>
            {ocupado === "backup" ? <Loader2Icon className="animate-spin" /> : <DownloadIcon />}Cópia de segurança (JSON)
          </Button>
        )}
      </div>
      {msg && <p role={msg.erro ? "alert" : "status"} className={msg.erro ? "text-sm font-medium text-critico" : "text-sm font-medium text-ok"}>{msg.texto}</p>}
    </Card>
  );
}
