/** Configuração lida das variáveis de ambiente (ver .env.example). */
export interface Config {
  porta: number;
  bancoUrl: string;
  /** Origens que podem chamar a API pelo navegador (além da própria). */
  origens: string[];
  /** Pasta com o aplicativo exportado (out/) para servir junto da API; vazio = só API. */
  pastaApp: string;
  /** Atrás de proxy (Render, Railway, Nginx): confiar no X-Forwarded-For para IP e limites. */
  confiarProxy: boolean;
  migrarAoIniciar: boolean;
  iteracoes: number;
  producao: boolean;
}

const bool = (v: string | undefined, padrao: boolean) => (v === undefined || v === "" ? padrao : ["1", "true", "sim", "yes"].includes(v.toLowerCase()));

export function lerConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const bancoUrl = env.DATABASE_URL ?? "";
  if (!bancoUrl) throw new Error("Defina DATABASE_URL (ex.: postgres://usuario:senha@localhost:5432/canteiro)");
  return {
    porta: Number(env.PORT) || 3000,
    bancoUrl,
    origens: (env.CORS_ORIGENS ?? "https://canjango.github.io,http://localhost:3000,http://127.0.0.1:3000")
      .split(",").map((s) => s.trim().replace(/\/$/, "")).filter(Boolean),
    pastaApp: env.PASTA_APP ?? "",
    confiarProxy: bool(env.CONFIAR_PROXY, false),
    migrarAoIniciar: bool(env.MIGRAR_AO_INICIAR, true),
    iteracoes: Math.max(100_000, Number(env.PBKDF2_ITERACOES) || 210_000),
    producao: env.NODE_ENV === "production",
  };
}
