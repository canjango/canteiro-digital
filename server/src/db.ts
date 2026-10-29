import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

export type Banco = pg.Pool;
export type Cliente = pg.PoolClient;

// datas e números do Postgres chegam como texto previsível (numeric → number nas visões de relatório)
pg.types.setTypeParser(pg.types.builtins.NUMERIC, (v) => (v === null ? null : Number(v)));
pg.types.setTypeParser(pg.types.builtins.INT8, (v) => (v === null ? null : Number(v)));
pg.types.setTypeParser(pg.types.builtins.DATE, (v) => v);

export function criarBanco(url: string): Banco {
  const ssl = /sslmode=(require|verify)/.test(url) || process.env.PGSSL === "1" ? { rejectUnauthorized: process.env.PGSSL_VERIFICAR !== "0" } : undefined;
  const pool = new pg.Pool({ connectionString: url, max: Number(process.env.PG_CONEXOES) || 10, ssl, idleTimeoutMillis: 30_000 });
  pool.on("error", (e) => console.error("[banco] conexão ociosa falhou:", e.message));
  return pool;
}

/** Executa `fn` numa transação; desfaz tudo se der erro. */
export async function transacao<T>(banco: Banco, fn: (c: Cliente) => Promise<T>): Promise<T> {
  const c = await banco.connect();
  try {
    await c.query("begin");
    const r = await fn(c);
    await c.query("commit");
    return r;
  } catch (e) {
    await c.query("rollback").catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}

const PASTA_MIGRACOES = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "migracoes");

/**
 * Aplica, em ordem, os arquivos .sql de migracoes/ que ainda não rodaram. Usa um bloqueio
 * consultivo para que duas instâncias subindo juntas não apliquem a mesma migração.
 */
export async function migrar(banco: Banco, pasta = PASTA_MIGRACOES): Promise<string[]> {
  const arquivos = (await readdir(pasta)).filter((f) => /^\d+_.+\.sql$/.test(f)).sort();
  const aplicadas: string[] = [];
  const c = await banco.connect();
  try {
    await c.query("select pg_advisory_lock(727274)");
    await c.query("create table if not exists migracoes (nome text primary key, aplicada_em timestamptz not null default now())");
    const feitas = new Set((await c.query<{ nome: string }>("select nome from migracoes")).rows.map((r) => r.nome));
    for (const f of arquivos) {
      if (feitas.has(f)) continue;
      const sql = await readFile(path.join(pasta, f), "utf8");
      try {
        await c.query("begin");
        await c.query(sql);
        await c.query("insert into migracoes (nome) values ($1)", [f]);
        await c.query("commit");
        aplicadas.push(f);
      } catch (e) {
        await c.query("rollback").catch(() => {});
        throw new Error(`Migração ${f} falhou: ${(e as Error).message}`);
      }
    }
  } finally {
    await c.query("select pg_advisory_unlock(727274)").catch(() => {});
    c.release();
  }
  return aplicadas;
}
