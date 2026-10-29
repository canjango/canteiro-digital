import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import type { Config } from "../config.js";
import { transacao, type Banco } from "../db.js";
import { ErroApi } from "../erros.js";
import { derivar, iguais, normalizarUsuario, novaSenha, validarNome, validarSenha, validarUsuario } from "../seguranca.js";
import { contaPublica, criarSessao, exigirSessao, SQL_CONTA, type ContaSessao } from "../sessao.js";

const LIVRES = 5; // tentativas erradas antes da pausa
const SAL_FALSO = Buffer.alloc(16).toString("base64");

const esquemaConfigurar = z.object({
  escritorio: z.string().max(120),
  nome: z.string().max(80),
  usuario: z.string().max(32),
  senha: z.string().max(128),
  lembrar: z.boolean().optional(),
});
const esquemaEntrar = z.object({ usuario: z.string().max(64), senha: z.string().max(128), lembrar: z.boolean().optional() });
const esquemaSenha = z.object({ atual: z.string().max(128), nova: z.string().max(128) });

async function lerConta(banco: Banco, id: string): Promise<ContaSessao> {
  const r = await banco.query<ContaSessao>(`${SQL_CONTA} where u.id = $1`, [id]);
  const c = r.rows[0];
  return { ...c, criada_em: new Date(c.criada_em).toISOString() };
}

export function rotasAcesso(banco: Banco, cfg: Config): Router {
  const r = Router();
  const sessao = exigirSessao(banco);
  // limite por IP para quem tenta adivinhar senhas (o bloqueio por usuário fica no banco)
  const limiteEntrada = rateLimit({ windowMs: 15 * 60_000, limit: 30, standardHeaders: "draft-8", legacyHeaders: false, message: { erro: "Muitas tentativas deste endereço. Aguarde alguns minutos.", codigo: "limite" } });

  /** Diz se o servidor já tem o primeiro administrador. */
  r.get("/estado", async (_req, res) => {
    const q = await banco.query<{ n: number }>("select count(*)::int as n from usuarios");
    res.json({ configurado: q.rows[0].n > 0, versao: 1 });
  });

  /** Primeiro acesso: cria o escritório e o administrador (só funciona com o servidor vazio). */
  r.post("/configurar", limiteEntrada, async (req, res) => {
    const ja = await banco.query<{ n: number }>("select count(*)::int as n from usuarios");
    if (ja.rows[0].n > 0) throw new ErroApi(409, "Este servidor já foi configurado. Entre com seu usuário.", "ja_configurado");
    const d = esquemaConfigurar.parse(req.body);
    const escritorio = d.escritorio.trim().replace(/\s+/g, " ");
    if (escritorio.length < 2) throw new ErroApi(400, "Informe o nome do escritório.");
    const nome = validarNome(d.nome);
    const usuario = validarUsuario(d.usuario);
    validarSenha(d.senha, usuario);
    const s = await novaSenha(d.senha, cfg.iteracoes);
    const id = await transacao(banco, async (c) => {
      await c.query("lock table usuarios in exclusive mode");
      const n = await c.query<{ n: number }>("select count(*)::int as n from usuarios");
      if (n.rows[0].n > 0) throw new ErroApi(409, "Este servidor já foi configurado. Entre com seu usuário.", "ja_configurado");
      const e = await c.query<{ id: string }>("insert into escritorios (nome) values ($1) returning id", [escritorio]);
      const u = await c.query<{ id: string }>(
        "insert into usuarios (escritorio_id, nome, usuario, papel, sal, hash, iteracoes) values ($1, $2, $3, 'admin', $4, $5, $6) returning id",
        [e.rows[0].id, nome, usuario, s.sal, s.hash, s.iteracoes],
      );
      return u.rows[0].id;
    });
    const t = await criarSessao(banco, id, d.lembrar ?? true, req);
    res.status(201).json({ ...t, conta: contaPublica(await lerConta(banco, id)) });
  });

  r.post("/entrar", limiteEntrada, async (req, res) => {
    const d = esquemaEntrar.parse(req.body);
    const usuario = normalizarUsuario(d.usuario);
    const bloq = await banco.query<{ espera: number }>(
      "select ceil(extract(epoch from bloqueado_ate - now()))::int as espera from tentativas_login where usuario = $1 and bloqueado_ate > now()",
      [usuario],
    );
    if (bloq.rows[0]) throw new ErroApi(429, `Muitas tentativas. Aguarde ${bloq.rows[0].espera} s e tente de novo.`, "bloqueado", { espera: bloq.rows[0].espera });
    const q = await banco.query<{ id: string; sal: string; hash: string; iteracoes: number; ativo: boolean }>(
      "select id, sal, hash, iteracoes, ativo from usuarios where usuario = $1",
      [usuario],
    );
    const u = q.rows[0];
    // mesmo sem conta calcula um hash: o tempo de resposta não revela se o usuário existe
    const h = await derivar(d.senha, u?.sal ?? SAL_FALSO, u?.iteracoes ?? cfg.iteracoes);
    if (!u || !iguais(h, u.hash) || !u.ativo) {
      // a partir da 5ª tentativa errada: pausa de 30 s, dobrando a cada erro (máx. 15 min)
      await banco.query(
        `insert into tentativas_login (usuario, erros) values ($1, 1)
         on conflict (usuario) do update set erros = tentativas_login.erros + 1, atualizado_em = now(),
           bloqueado_ate = case when tentativas_login.erros + 1 >= $2
             then now() + make_interval(secs => least(900, 30 * power(2, tentativas_login.erros + 1 - $2)))
             else null end`,
        [usuario, LIVRES],
      );
      throw new ErroApi(401, u && !u.ativo && iguais(h, u.hash) ? "Este acesso foi desativado. Fale com um administrador." : "Usuário ou senha incorretos.", "credenciais");
    }
    await banco.query("delete from tentativas_login where usuario = $1", [usuario]);
    // senha com menos iterações (ex.: importada de configuração antiga): reforça agora que a temos
    if (u.iteracoes < cfg.iteracoes) {
      const s = await novaSenha(d.senha, cfg.iteracoes);
      await banco.query("update usuarios set sal = $2, hash = $3, iteracoes = $4 where id = $1", [u.id, s.sal, s.hash, s.iteracoes]);
    }
    const t = await criarSessao(banco, u.id, d.lembrar ?? false, req);
    res.json({ ...t, conta: contaPublica(await lerConta(banco, u.id)) });
  });

  r.post("/sair", sessao, async (req, res) => {
    await banco.query("delete from sessoes where token_hash = $1", [req.tokenHash]);
    res.status(204).end();
  });

  r.get("/eu", sessao, (req, res) => {
    res.json({ conta: contaPublica(req.conta!) });
  });

  /** Troca a própria senha e encerra as outras sessões dessa pessoa. */
  r.post("/eu/senha", sessao, async (req, res) => {
    const d = esquemaSenha.parse(req.body);
    const q = await banco.query<{ sal: string; hash: string; iteracoes: number }>("select sal, hash, iteracoes from usuarios where id = $1", [req.conta!.id]);
    const u = q.rows[0];
    if (!iguais(await derivar(d.atual, u.sal, u.iteracoes), u.hash)) throw new ErroApi(400, "A senha atual não confere.", "senha_atual");
    validarSenha(d.nova, req.conta!.usuario);
    const s = await novaSenha(d.nova, cfg.iteracoes);
    await transacao(banco, async (c) => {
      await c.query("update usuarios set sal = $2, hash = $3, iteracoes = $4, senha_trocada_em = now() where id = $1", [req.conta!.id, s.sal, s.hash, s.iteracoes]);
      await c.query("delete from sessoes where usuario_id = $1 and token_hash <> $2", [req.conta!.id, req.tokenHash]);
    });
    res.status(204).end();
  });

  return r;
}
