import { criarApp } from "./app.js";
import { lerConfig } from "./config.js";
import { criarBanco, migrar } from "./db.js";

const cfg = lerConfig();
const banco = criarBanco(cfg.bancoUrl);

if (cfg.migrarAoIniciar) {
  const feitas = await migrar(banco);
  if (feitas.length) console.log(`[banco] migrações aplicadas: ${feitas.join(", ")}`);
}

const app = criarApp(banco, cfg);
const servidor = app.listen(cfg.porta, () => {
  console.log(`[api] Canteiro Digital ouvindo na porta ${cfg.porta}${cfg.pastaApp ? ` (aplicativo em ${cfg.pastaApp})` : ""}`);
});

// limpeza periódica: sessões vencidas e bloqueios antigos
const limpar = () =>
  banco.query("delete from sessoes where expira_em < now(); delete from tentativas_login where atualizado_em < now() - interval '1 day'")
    .catch((e) => console.error("[banco] limpeza falhou:", e.message));
const relogio = setInterval(limpar, 60 * 60_000);
void limpar();

const encerrar = (sinal: string) => {
  console.log(`[api] ${sinal}: encerrando…`);
  clearInterval(relogio);
  servidor.close(() => void banco.end().then(() => process.exit(0)));
  setTimeout(() => process.exit(1), 10_000).unref();
};
process.on("SIGTERM", () => encerrar("SIGTERM"));
process.on("SIGINT", () => encerrar("SIGINT"));
