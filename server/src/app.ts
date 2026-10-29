import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import type { Config } from "./config.js";
import type { Banco } from "./db.js";
import { ErroApi, tratarErros } from "./erros.js";
import { rotasAcesso } from "./rotas/acesso.js";
import { rotasDados } from "./rotas/dados.js";
import { rotasRelatorios } from "./rotas/relatorios.js";
import { rotasUsuarios } from "./rotas/usuarios.js";

export function criarApp(banco: Banco, cfg: Config) {
  const app = express();
  app.disable("x-powered-by");
  if (cfg.confiarProxy) app.set("trust proxy", 1);

  // o aplicativo exportado usa scripts inline e chama a API da Anthropic com a chave do próprio usuário:
  // a CSP padrão do helmet bloquearia isso, então ela fica desligada; os demais cabeçalhos de proteção ficam.
  app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));

  const api = express.Router();
  api.use(cors({
    origin: (origem, ok) => ok(null, !origem || cfg.origens.includes(origem)),
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Authorization", "Content-Type"],
    maxAge: 600,
  }));
  api.use(express.json({ limit: "15mb" }));
  api.use(rateLimit({ windowMs: 60_000, limit: 900, standardHeaders: "draft-8", legacyHeaders: false, message: { erro: "Muitas requisições. Aguarde um instante.", codigo: "limite" } }));
  api.use((_req, res, next) => { res.setHeader("cache-control", "no-store"); next(); });

  api.get("/saude", async (_req, res) => {
    const t = Date.now();
    await banco.query("select 1");
    res.json({ ok: true, servico: "canteiro-digital", banco_ms: Date.now() - t });
  });
  api.use("/", rotasAcesso(banco, cfg));
  api.use("/usuarios", rotasUsuarios(banco, cfg));
  api.use("/relatorios", rotasRelatorios(banco));
  api.use("/", rotasDados(banco, cfg));
  api.use((_req) => { throw new ErroApi(404, "Rota não encontrada.", "nao_encontrado"); });
  api.use(tratarErros);
  app.use("/api", api);

  // aplicativo (exportação estática do Next) servido no mesmo endereço da API
  const pasta = cfg.pastaApp && path.resolve(cfg.pastaApp);
  if (pasta && existsSync(path.join(pasta, "index.html"))) {
    // a página leva uma marca dizendo que a API está no mesmo endereço (o aplicativo conecta sozinho)
    const pagina = readFileSync(path.join(pasta, "index.html"), "utf8").replace("<head>", '<head><meta name="canteiro-api" content="mesmo-endereco">');
    const enviarPagina = (_req: express.Request, res: express.Response) => { res.setHeader("cache-control", "no-cache"); res.type("html").send(pagina); };
    app.get(["/", "/index.html"], enviarPagina);
    app.use(express.static(pasta, { index: false, maxAge: "1h" }));
    app.get(/^(?!\/api\/).*/, enviarPagina);
  } else {
    app.get("/", (_req, res) => res.type("text").send("API do Canteiro Digital no ar. Use /api/saude para testar."));
  }
  return app;
}
