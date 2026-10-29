import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";

/** Erro com status HTTP e mensagem que pode ir para a pessoa. */
export class ErroApi extends Error {
  constructor(
    readonly status: number,
    mensagem: string,
    readonly codigo = "",
    readonly extra: Record<string, unknown> = {},
  ) {
    super(mensagem);
  }
}

export const tratarErros: ErrorRequestHandler = (e, _req, res, _next) => {
  if (e instanceof ErroApi) {
    res.status(e.status).json({ erro: e.message, codigo: e.codigo || undefined, ...e.extra });
    return;
  }
  if (e instanceof ZodError) {
    const p = e.issues[0];
    res.status(400).json({ erro: `Dados inválidos${p?.path.length ? ` em “${p.path.join(".")}”` : ""}: ${p?.message ?? ""}`.trim(), codigo: "invalido" });
    return;
  }
  const tipo = (e as { type?: string; status?: number }).type;
  if (tipo === "entity.too.large") {
    res.status(413).json({ erro: "Documento grande demais para salvar.", codigo: "grande_demais" });
    return;
  }
  if (tipo === "entity.parse.failed") {
    res.status(400).json({ erro: "JSON inválido.", codigo: "invalido" });
    return;
  }
  console.error("[api]", e);
  res.status(500).json({ erro: "Erro interno do servidor.", codigo: "interno" });
};
