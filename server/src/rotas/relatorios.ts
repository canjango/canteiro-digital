import { Router } from "express";
import { z } from "zod";
import type { Banco } from "../db.js";
import { ErroApi } from "../erros.js";
import { exigirSessao } from "../sessao.js";

/** Visões SQL que podem ser consultadas (nome → descrição e ordenação). Lista fechada: nada de SQL vindo do cliente. */
export const RELATORIOS: Record<string, { titulo: string; ordem: string }> = {
  obras: { titulo: "Obras", ordem: "nome" },
  etapas: { titulo: "Etapas das obras", ordem: "obra, codigo" },
  compras: { titulo: "Compras das obras", ordem: "obra, data_necessidade nulls last" },
  tarefas_obra: { titulo: "Tarefas das obras", ordem: "obra, prazo nulls last" },
  projetos: { titulo: "Projetos", ordem: "codigo" },
  parcelas: { titulo: "Parcelas de honorários", ordem: "vencimento nulls last" },
  horas: { titulo: "Horas lançadas", ordem: "data desc nulls last" },
  despesas: { titulo: "Despesas dos projetos", ordem: "data desc nulls last" },
  tarefas_projeto: { titulo: "Tarefas dos projetos", ordem: "projeto_codigo, prazo nulls last" },
  orcamento_itens: { titulo: "Itens de orçamento", ordem: "projeto_codigo, ambiente" },
  oportunidades: { titulo: "Propostas e licitações", ordem: "data desc nulls last" },
  contatos: { titulo: "Contatos", ordem: "nome" },
  insumos: { titulo: "Insumos", ordem: "descricao" },
  equipe: { titulo: "Equipe", ordem: "nome" },
  produtos: { titulo: "Biblioteca de produtos", ordem: "nome" },
};

const csv = (v: unknown) => {
  if (v === null || v === undefined) return "";
  const t = v instanceof Date ? v.toISOString() : typeof v === "number" ? String(v).replace(".", ",") : String(v);
  return /[";\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
};

export function rotasRelatorios(banco: Banco): Router {
  const r = Router();
  r.use(exigirSessao(banco));

  r.get("/", (_req, res) => {
    res.json({ relatorios: Object.entries(RELATORIOS).map(([nome, x]) => ({ nome, titulo: x.titulo })) });
  });

  /** ?formato=csv devolve planilha (separador “;”, decimal com vírgula — abre direto no Excel em português). */
  r.get("/:nome", async (req, res) => {
    const rel = RELATORIOS[req.params.nome];
    if (!rel) throw new ErroApi(404, "Relatório não encontrado.");
    const limite = z.coerce.number().int().min(1).max(50_000).parse(req.query.limite ?? 10_000);
    const q = await banco.query(`select * from v_${req.params.nome} where escritorio_id = $1 order by ${rel.ordem} limit $2`, [req.conta!.escritorio_id, limite]);
    const colunas = q.fields.map((f) => f.name).filter((n) => n !== "escritorio_id");
    const linhas = q.rows.map((l) => Object.fromEntries(colunas.map((c) => [c, l[c]])));
    if (req.query.formato === "csv") {
      res.setHeader("content-type", "text/csv; charset=utf-8");
      res.setHeader("content-disposition", `attachment; filename="${req.params.nome}.csv"`);
      res.send("﻿" + [colunas.join(";"), ...linhas.map((l) => colunas.map((c) => csv(l[c])).join(";"))].join("\r\n"));
      return;
    }
    res.json({ relatorio: req.params.nome, titulo: rel.titulo, colunas, linhas });
  });

  return r;
}
