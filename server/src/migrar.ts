// Aplica as migrações e sai (útil no deploy: `npm run migrar`).
import { lerConfig } from "./config.js";
import { criarBanco, migrar } from "./db.js";

const banco = criarBanco(lerConfig().bancoUrl);
try {
  const feitas = await migrar(banco);
  console.log(feitas.length ? `Migrações aplicadas: ${feitas.join(", ")}` : "Banco já está atualizado.");
} finally {
  await banco.end();
}
