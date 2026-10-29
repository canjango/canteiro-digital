import { Router } from "express";
import { z } from "zod";
import type { Config } from "../config.js";
import { transacao, type Banco } from "../db.js";
import { ErroApi } from "../erros.js";
import { novaSenha, validarNome, validarSenha, validarUsuario } from "../seguranca.js";
import { exigirAdmin, exigirSessao } from "../sessao.js";

const PAPEL = z.enum(["admin", "membro"]);
const esquemaNovo = z.object({ nome: z.string().max(80), usuario: z.string().max(32), senha: z.string().max(128), papel: PAPEL.optional() });
const esquemaAlterar = z.object({ papel: PAPEL.optional(), senha: z.string().max(128).optional(), ativo: z.boolean().optional(), nome: z.string().max(80).optional() });
const UUID = z.string().uuid();

interface Linha {
  id: string;
  nome: string;
  usuario: string;
  papel: "admin" | "membro";
  ativo: boolean;
  criada_em: Date;
  ultimo_acesso: Date | null;
}
const publico = (l: Linha) => ({ ...l, criada_em: l.criada_em.toISOString(), ultimo_acesso: l.ultimo_acesso?.toISOString() ?? null });
const COLUNAS = "id, nome, usuario, papel, ativo, criado_em as criada_em, ultimo_acesso";

export function rotasUsuarios(banco: Banco, cfg: Config): Router {
  const r = Router();
  r.use(exigirSessao(banco));

  r.get("/", async (req, res) => {
    const q = await banco.query<Linha>(`select ${COLUNAS} from usuarios where escritorio_id = $1 order by papel, nome`, [req.conta!.escritorio_id]);
    res.json({ usuarios: q.rows.map(publico) });
  });

  r.post("/", exigirAdmin, async (req, res) => {
    const d = esquemaNovo.parse(req.body);
    const nome = validarNome(d.nome);
    const usuario = validarUsuario(d.usuario);
    validarSenha(d.senha, usuario);
    const s = await novaSenha(d.senha, cfg.iteracoes);
    const q = await banco.query<Linha>(
      `insert into usuarios (escritorio_id, nome, usuario, papel, sal, hash, iteracoes) values ($1, $2, $3, $4, $5, $6, $7)
       on conflict (usuario) do nothing returning ${COLUNAS}`,
      [req.conta!.escritorio_id, nome, usuario, d.papel ?? "membro", s.sal, s.hash, s.iteracoes],
    );
    if (!q.rows[0]) throw new ErroApi(409, `O usuário “${usuario}” já existe.`, "usuario_existe");
    res.status(201).json({ usuario: publico(q.rows[0]) });
  });

  r.patch("/:id", exigirAdmin, async (req, res) => {
    const id = UUID.parse(req.params.id);
    const d = esquemaAlterar.parse(req.body);
    const linha = await transacao(banco, async (c) => {
      const alvo = (await c.query<Linha>(`select ${COLUNAS} from usuarios where id = $1 and escritorio_id = $2 for update`, [id, req.conta!.escritorio_id])).rows[0];
      if (!alvo) throw new ErroApi(404, "Conta não encontrada.");
      const perdeAdmin = alvo.papel === "admin" && ((d.papel && d.papel !== "admin") || d.ativo === false);
      if (perdeAdmin) {
        const n = await c.query<{ n: number }>("select count(*)::int as n from usuarios where escritorio_id = $1 and papel = 'admin' and ativo", [req.conta!.escritorio_id]);
        if (n.rows[0].n <= 1) throw new ErroApi(400, "É preciso manter pelo menos um administrador.");
      }
      if (id === req.conta!.id && (d.ativo === false || (d.papel && d.papel !== req.conta!.papel))) throw new ErroApi(400, "Você não pode mudar a própria permissão nem se desativar.");
      if (d.nome !== undefined) await c.query("update usuarios set nome = $2 where id = $1", [id, validarNome(d.nome)]);
      if (d.papel) await c.query("update usuarios set papel = $2 where id = $1", [id, d.papel]);
      if (d.ativo !== undefined) await c.query("update usuarios set ativo = $2 where id = $1", [id, d.ativo]);
      if (d.senha !== undefined) {
        validarSenha(d.senha, alvo.usuario);
        const s = await novaSenha(d.senha, cfg.iteracoes);
        await c.query("update usuarios set sal = $2, hash = $3, iteracoes = $4, senha_trocada_em = now() where id = $1", [id, s.sal, s.hash, s.iteracoes]);
      }
      // senha redefinida ou acesso desativado: derruba as sessões abertas dessa pessoa
      if (d.senha !== undefined || d.ativo === false) await c.query("delete from sessoes where usuario_id = $1", [id]);
      return (await c.query<Linha>(`select ${COLUNAS} from usuarios where id = $1`, [id])).rows[0];
    });
    res.json({ usuario: publico(linha) });
  });

  r.delete("/:id", exigirAdmin, async (req, res) => {
    const id = UUID.parse(req.params.id);
    if (id === req.conta!.id) throw new ErroApi(400, "Você não pode remover o seu próprio acesso.");
    await transacao(banco, async (c) => {
      const alvo = (await c.query<{ papel: string }>("select papel from usuarios where id = $1 and escritorio_id = $2 for update", [id, req.conta!.escritorio_id])).rows[0];
      if (!alvo) throw new ErroApi(404, "Conta não encontrada.");
      if (alvo.papel === "admin") {
        const n = await c.query<{ n: number }>("select count(*)::int as n from usuarios where escritorio_id = $1 and papel = 'admin' and ativo", [req.conta!.escritorio_id]);
        if (n.rows[0].n <= 1) throw new ErroApi(400, "É preciso manter pelo menos um administrador.");
      }
      await c.query("delete from usuarios where id = $1", [id]);
    });
    res.status(204).end();
  });

  return r;
}
