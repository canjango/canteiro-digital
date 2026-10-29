import { Router } from "express";
import { z } from "zod";
import type { Config } from "../config.js";
import { transacao, type Banco } from "../db.js";
import { ErroApi } from "../erros.js";
import { validarNome, validarUsuario } from "../seguranca.js";
import { exigirAdmin, exigirSessao } from "../sessao.js";

const ID = z.string().regex(/^[A-Za-z0-9_.:-]{1,80}$/, "identificador inválido");
const DOC = z.record(z.string(), z.unknown());
const esquemaGravar = z.object({ dados: DOC, versao: z.number().int().min(0) });
const esquemaImportar = z.object({
  obras: z.array(DOC).max(2000).default([]),
  cadastros: DOC.nullable().optional(),
  contas: z.array(z.object({
    nome: z.string(), usuario: z.string(), papel: z.enum(["admin", "membro"]),
    sal: z.string().regex(/^[A-Za-z0-9+/=]{16,64}$/), hash: z.string().regex(/^[A-Za-z0-9+/=]{40,64}$/), iteracoes: z.number().int().min(100_000).max(10_000_000),
  })).max(500).default([]),
  /** true: substitui o que já existe no servidor com o mesmo id; false: só acrescenta o que falta */
  substituir: z.boolean().default(false),
});

interface LinhaObra { id: string; dados: Record<string, unknown>; versao: number; excluida: boolean; alteracao: number }
interface LinhaCad { dados: Record<string, unknown>; versao: number; alteracao: number }

const conflito = (atual: { dados: unknown; versao: number } | null, quem = "") =>
  new ErroApi(409, `${quem ? `${quem} alterou` : "Outra pessoa alterou"} este registro enquanto você editava.`, "conflito", { atual });

export function rotasDados(banco: Banco, _cfg: Config): Router {
  const r = Router();
  r.use(exigirSessao(banco));

  async function cursorAtual(esc: string): Promise<number> {
    const q = await banco.query<{ c: number | null }>(
      "select greatest((select max(alteracao) from obras where escritorio_id = $1), (select alteracao from cadastros where escritorio_id = $1)) as c",
      [esc],
    );
    return q.rows[0].c ?? 0;
  }

  async function nomeDe(id: string | null | undefined) {
    if (!id) return "";
    const q = await banco.query<{ nome: string }>("select nome from usuarios where id = $1", [id]);
    return q.rows[0]?.nome ?? "";
  }

  /** Carga completa: todas as obras + cadastros + cursor para as próximas alterações. */
  r.get("/dados", async (req, res) => {
    const esc = req.conta!.escritorio_id;
    const cursor = await cursorAtual(esc);
    const [o, c] = await Promise.all([
      banco.query<LinhaObra>("select id, dados, versao from obras where escritorio_id = $1 and excluida_em is null order by criado_em", [esc]),
      banco.query<LinhaCad>("select dados, versao from cadastros where escritorio_id = $1", [esc]),
    ]);
    res.json({ obras: o.rows, cadastros: c.rows[0] ?? null, cursor });
  });

  /** O que mudou depois do cursor (sincronização entre aparelhos). */
  r.get("/alteracoes", async (req, res) => {
    const esc = req.conta!.escritorio_id;
    const desde = z.coerce.number().int().min(0).parse(req.query.desde ?? 0);
    const [o, c] = await Promise.all([
      banco.query<LinhaObra>(
        "select id, dados, versao, excluida_em is not null as excluida, alteracao from obras where escritorio_id = $1 and alteracao > $2 order by alteracao",
        [esc, desde],
      ),
      banco.query<LinhaCad>("select dados, versao, alteracao from cadastros where escritorio_id = $1 and alteracao > $2", [esc, desde]),
    ]);
    const maior = Math.max(desde, ...o.rows.map((x) => x.alteracao), ...c.rows.map((x) => x.alteracao));
    res.json({
      obras: o.rows.filter((x) => !x.excluida).map(({ id, dados, versao }) => ({ id, dados, versao })),
      removidas: o.rows.filter((x) => x.excluida).map((x) => x.id),
      cadastros: c.rows[0] ? { dados: c.rows[0].dados, versao: c.rows[0].versao } : null,
      cursor: maior,
    });
  });

  /**
   * Grava uma obra. `versao` é a versão em que a edição se baseou (0 = obra nova).
   * Se alguém gravou antes, responde 409 com a versão atual para o aplicativo mesclar.
   */
  r.put("/obras/:id", async (req, res) => {
    const id = ID.parse(req.params.id);
    const { dados, versao } = esquemaGravar.parse(req.body);
    if (dados.id !== undefined && dados.id !== id) throw new ErroApi(400, "O id do documento não confere com o endereço.");
    const esc = req.conta!.escritorio_id;
    const q = await banco.query<{ versao: number }>(
      `insert into obras as o (escritorio_id, id, dados, versao, atualizado_por) values ($1, $2, $3, 1, $5)
       on conflict (escritorio_id, id) do update set dados = excluded.dados, versao = o.versao + 1, atualizado_por = excluded.atualizado_por, excluida_em = null
         where o.versao = $4 or o.excluida_em is not null
       returning versao`,
      [esc, id, dados, versao, req.conta!.id],
    );
    if (!q.rows[0]) {
      const atual = (await banco.query<{ dados: unknown; versao: number; atualizado_por: string }>("select dados, versao, atualizado_por from obras where escritorio_id = $1 and id = $2", [esc, id])).rows[0];
      throw conflito(atual ? { dados: atual.dados, versao: atual.versao } : null, await nomeDe(atual?.atualizado_por));
    }
    res.json({ versao: q.rows[0].versao });
  });

  /** Exclui (marca como excluída — fica no histórico e some dos outros aparelhos na próxima sincronização). */
  r.delete("/obras/:id", async (req, res) => {
    const id = ID.parse(req.params.id);
    const versao = req.query.versao === undefined ? null : z.coerce.number().int().min(0).parse(req.query.versao);
    const esc = req.conta!.escritorio_id;
    const q = await banco.query(
      `update obras set excluida_em = now(), versao = versao + 1, atualizado_por = $3
        where escritorio_id = $1 and id = $2 and excluida_em is null and ($4::int is null or versao = $4)`,
      [esc, id, req.conta!.id, versao],
    );
    if (!q.rowCount && versao !== null) {
      const atual = (await banco.query<{ dados: unknown; versao: number; excluida: boolean }>("select dados, versao, excluida_em is not null as excluida from obras where escritorio_id = $1 and id = $2", [esc, id])).rows[0];
      if (atual && !atual.excluida) throw conflito({ dados: atual.dados, versao: atual.versao });
    }
    res.status(204).end();
  });

  /** Cadastros do escritório (contatos, insumos, equipe, projetos, biblioteca…): mesmo controle de versão. */
  r.put("/cadastros", async (req, res) => {
    const { dados, versao } = esquemaGravar.parse(req.body);
    const esc = req.conta!.escritorio_id;
    const q = await banco.query<{ versao: number }>(
      `insert into cadastros as c (escritorio_id, dados, versao, atualizado_por) values ($1, $2, 1, $4)
       on conflict (escritorio_id) do update set dados = excluded.dados, versao = c.versao + 1, atualizado_por = excluded.atualizado_por
         where c.versao = $3
       returning versao`,
      [esc, dados, versao, req.conta!.id],
    );
    if (!q.rows[0]) {
      const atual = (await banco.query<{ dados: unknown; versao: number; atualizado_por: string }>("select dados, versao, atualizado_por from cadastros where escritorio_id = $1", [esc])).rows[0];
      throw conflito(atual ? { dados: atual.dados, versao: atual.versao } : null, await nomeDe(atual?.atualizado_por));
    }
    res.json({ versao: q.rows[0].versao });
  });

  // ---------------------------------------------------------------- histórico
  r.get("/historico", async (req, res) => {
    const tipo = z.enum(["obra", "cadastros"]).parse(req.query.tipo);
    const registro = tipo === "cadastros" ? "geral" : ID.parse(req.query.registro);
    const q = await banco.query(
      `select h.id, h.versao, h.acao, h.em, u.nome as por, pg_column_size(h.dados) as tamanho
         from historico h left join usuarios u on u.id = h.usuario_id
        where h.escritorio_id = $1 and h.tipo = $2 and h.registro = $3 order by h.em desc limit 200`,
      [req.conta!.escritorio_id, tipo, registro],
    );
    res.json({ versoes: q.rows });
  });

  r.get("/historico/:id", async (req, res) => {
    const id = z.coerce.number().int().positive().parse(req.params.id);
    const q = await banco.query("select id, tipo, registro, versao, acao, em, dados from historico where id = $1 and escritorio_id = $2", [id, req.conta!.escritorio_id]);
    if (!q.rows[0]) throw new ErroApi(404, "Versão não encontrada.");
    res.json(q.rows[0]);
  });

  // ---------------------------------------------------------------- importar / exportar (administrador)
  /** Traz para o servidor o que estava guardado no navegador (obras, cadastros e acessos locais). */
  r.post("/importar", exigirAdmin, async (req, res) => {
    const d = esquemaImportar.parse(req.body);
    const esc = req.conta!.escritorio_id;
    const resultado = await transacao(banco, async (c) => {
      let obras = 0;
      let obrasIgnoradas = 0;
      for (const o of d.obras) {
        const id = ID.safeParse(o.id);
        if (!id.success) { obrasIgnoradas++; continue; }
        const q = await c.query(
          `insert into obras as o (escritorio_id, id, dados, atualizado_por) values ($1, $2, $3, $4)
           on conflict (escritorio_id, id) do update set dados = excluded.dados, versao = o.versao + 1, excluida_em = null, atualizado_por = excluded.atualizado_por
             where $5 or o.excluida_em is not null`,
          [esc, id.data, o, req.conta!.id, d.substituir],
        );
        if (q.rowCount) obras++; else obrasIgnoradas++;
      }
      let cadastros = false;
      if (d.cadastros) {
        const q = await c.query(
          `insert into cadastros as c (escritorio_id, dados, atualizado_por) values ($1, $2, $3)
           on conflict (escritorio_id) do update set dados = excluded.dados, versao = c.versao + 1, atualizado_por = excluded.atualizado_por where $4`,
          [esc, d.cadastros, req.conta!.id, d.substituir],
        );
        cadastros = Boolean(q.rowCount);
      }
      let contas = 0;
      const contasIgnoradas: string[] = [];
      for (const x of d.contas) {
        let usuario: string;
        try { usuario = validarUsuario(x.usuario); validarNome(x.nome); } catch { contasIgnoradas.push(x.usuario); continue; }
        const q = await c.query(
          `insert into usuarios (escritorio_id, nome, usuario, papel, sal, hash, iteracoes) values ($1, $2, $3, $4, $5, $6, $7) on conflict (usuario) do nothing`,
          [esc, validarNome(x.nome), usuario, x.papel, x.sal, x.hash, x.iteracoes],
        );
        if (q.rowCount) contas++; else contasIgnoradas.push(usuario);
      }
      return { obras, obras_ignoradas: obrasIgnoradas, cadastros, contas, contas_ignoradas: contasIgnoradas };
    });
    res.json(resultado);
  });

  /** Cópia de segurança completa do escritório em JSON. */
  r.get("/exportar", exigirAdmin, async (req, res) => {
    const esc = req.conta!.escritorio_id;
    const [o, c] = await Promise.all([
      banco.query("select dados from obras where escritorio_id = $1 and excluida_em is null order by criado_em", [esc]),
      banco.query("select dados from cadastros where escritorio_id = $1", [esc]),
    ]);
    res.setHeader("content-disposition", `attachment; filename="canteiro-digital-${new Date().toISOString().slice(0, 10)}.json"`);
    res.json({ formato: "canteiro-digital/backup@1", gerado_em: new Date().toISOString(), escritorio: req.conta!.escritorio, obras: o.rows.map((x) => x.dados), cadastros: c.rows[0]?.dados ?? null });
  });

  return r;
}
