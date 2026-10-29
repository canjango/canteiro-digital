import type { NextFunction, Request, Response } from "express";
import type { Banco } from "./db.js";
import { ErroApi } from "./erros.js";
import { hashToken, novoToken } from "./seguranca.js";

export interface ContaSessao {
  id: string;
  nome: string;
  usuario: string;
  papel: "admin" | "membro";
  escritorio_id: string;
  escritorio: string;
  criada_em: string;
}

declare module "express-serve-static-core" {
  interface Request {
    conta?: ContaSessao;
    tokenHash?: Buffer;
  }
}

const HORAS_SESSAO = 12;
const DIAS_LEMBRAR = 30;

export async function criarSessao(banco: Banco, usuarioId: string, lembrar: boolean, req: Request) {
  const token = novoToken();
  const expira = new Date(Date.now() + (lembrar ? DIAS_LEMBRAR * 86_400_000 : HORAS_SESSAO * 3_600_000));
  await banco.query(
    "insert into sessoes (token_hash, usuario_id, expira_em, ip, agente) values ($1, $2, $3, $4, $5)",
    [hashToken(token), usuarioId, expira, req.ip || null, String(req.headers["user-agent"] ?? "").slice(0, 300)],
  );
  await banco.query("update usuarios set ultimo_acesso = now() where id = $1", [usuarioId]);
  return { token, expira_em: expira.toISOString() };
}

export const SQL_CONTA = `
  select u.id, u.nome, u.usuario, u.papel, u.escritorio_id, e.nome as escritorio, u.criado_em as criada_em
    from usuarios u join escritorios e on e.id = u.escritorio_id`;

/** Exige um token válido em `Authorization: Bearer …` e põe a conta em req.conta. */
export function exigirSessao(banco: Banco) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    const m = /^Bearer\s+([A-Za-z0-9_-]{20,200})$/.exec(String(req.headers.authorization ?? ""));
    if (!m) throw new ErroApi(401, "Entre com seu usuário e senha.", "sem_sessao");
    const th = hashToken(m[1]);
    const r = await banco.query<ContaSessao & { expira_em: Date; ultimo_uso: Date }>(
      `${SQL_CONTA} join sessoes s on s.usuario_id = u.id where s.token_hash = $1 and s.expira_em > now() and u.ativo`,
      [th],
    );
    const conta = r.rows[0];
    if (!conta) throw new ErroApi(401, "Sua sessão expirou. Entre de novo.", "sem_sessao");
    req.conta = { ...conta, criada_em: new Date(conta.criada_em).toISOString() };
    req.tokenHash = th;
    // marca o uso no máximo uma vez por minuto (evita uma gravação por requisição)
    void banco.query("update sessoes set ultimo_uso = now() where token_hash = $1 and ultimo_uso < now() - interval '1 minute'", [th]).catch(() => {});
    next();
  };
}

export function exigirAdmin(req: Request, _res: Response, next: NextFunction) {
  if (req.conta?.papel !== "admin") throw new ErroApi(403, "Só um administrador pode fazer isso.", "sem_permissao");
  next();
}

export const contaPublica = (c: ContaSessao) => ({
  id: c.id, nome: c.nome, usuario: c.usuario, papel: c.papel, criada_em: c.criada_em, escritorio: c.escritorio,
});
