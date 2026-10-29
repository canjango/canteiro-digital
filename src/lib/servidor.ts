/**
 * Conexão com o servidor do escritório (API Node/Express + PostgreSQL, pasta server/).
 *
 * Como o endereço é decidido (o primeiro que valer):
 * 1. o que a pessoa escolheu na tela de entrada (guardado neste navegador);
 * 2. NEXT_PUBLIC_API_URL definido na hora de montar o site;
 * 3. o próprio endereço do site, quando a página é servida pelo servidor (ele marca a página).
 * Sem nenhum deles, o sistema funciona como antes: tudo guardado só neste navegador.
 */

const CHAVE_ENDERECO = "canteiro-digital:servidor";
const CHAVE_TOKEN = "canteiro-digital:token";
const LOCAL = "local"; // escolha explícita de não usar servidor

export class ErroServidor extends Error {
  constructor(
    mensagem: string,
    readonly status = 0,
    readonly codigo = "",
    readonly corpo: Record<string, unknown> = {},
  ) {
    super(mensagem);
  }
}

function ls(area: "local" | "sessao") {
  try {
    return area === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

export const normalizarEndereco = (u: string) => {
  let v = u.trim();
  if (!v) return "";
  if (!/^https?:\/\//i.test(v)) v = `https://${v}`;
  return v.replace(/\/+$/, "").replace(/\/api$/, "");
};

let endereco: string | null = null; // null = ainda não decidido; "" = sem servidor

/** Endereço base do servidor ("" = modo local). Decide uma vez por carga da página. */
export async function descobrirServidor(): Promise<string> {
  if (endereco !== null) return endereco;
  const escolhido = ls("local")?.getItem(CHAVE_ENDERECO) ?? "";
  if (escolhido === LOCAL) return (endereco = "");
  if (escolhido) return (endereco = escolhido);
  const doBuild = process.env.NEXT_PUBLIC_API_URL || ""; // substituído na montagem (Next e scripts/artifact.mjs)
  if (doBuild) return (endereco = normalizarEndereco(doBuild));
  // dentro da Claude a rede é isolada e o artefato não tem servidor próprio
  if (typeof window === "undefined" || window.claude || !/^https?:$/.test(location.protocol)) return (endereco = "");
  // servido pelo próprio servidor do escritório: a página vem com esta marca
  if (document.querySelector('meta[name="canteiro-api"]')) return (endereco = new URL(".", location.href).href.replace(/\/$/, ""));
  return (endereco = "");
}

export const enderecoAtual = () => endereco ?? "";
export const usandoServidor = () => Boolean(endereco);

/** Testa um endereço e, se responder, passa a usá-lo neste navegador. */
export async function conectar(u: string): Promise<string> {
  const base = normalizarEndereco(u);
  if (!base) throw new ErroServidor("Informe o endereço do servidor.");
  if (location.protocol === "https:" && base.startsWith("http:") && !/^http:\/\/(localhost|127\.0\.0\.1)/.test(base)) {
    throw new ErroServidor("O site está em https: o servidor também precisa estar em https.");
  }
  let r: Response;
  try {
    r = await fetch(`${base}/api/saude`, { signal: AbortSignal.timeout(8000), cache: "no-store" });
  } catch {
    throw new ErroServidor(`Não foi possível falar com ${base}. Confira o endereço e se o servidor permite este site (CORS_ORIGENS).`);
  }
  const j = (await r.json().catch(() => ({}))) as { servico?: string };
  if (!r.ok || j.servico !== "canteiro-digital") throw new ErroServidor(`${base} respondeu, mas não é um servidor do Canteiro Digital.`);
  ls("local")?.setItem(CHAVE_ENDERECO, base);
  guardarToken("", false);
  endereco = base;
  return base;
}

/** Volta a guardar tudo só neste navegador. */
export function desconectar(): void {
  ls("local")?.setItem(CHAVE_ENDERECO, LOCAL);
  guardarToken("", false);
  endereco = "";
}

/** Esquece a escolha (volta à descoberta automática na próxima carga). */
export function esquecerEscolha(): void {
  ls("local")?.removeItem(CHAVE_ENDERECO);
}

// ---------------------------------------------------------------- token da sessão
export function lerToken(): string {
  return ls("sessao")?.getItem(CHAVE_TOKEN) || ls("local")?.getItem(CHAVE_TOKEN) || "";
}

export function guardarToken(token: string, lembrar: boolean): void {
  for (const a of ["sessao", "local"] as const) ls(a)?.removeItem(CHAVE_TOKEN);
  if (token) ls(lembrar ? "local" : "sessao")?.setItem(CHAVE_TOKEN, token);
}

export const EVENTO_SESSAO_EXPIRADA = "canteiro:sessao-expirada";

/** Chamada à API com o token; erros viram ErroServidor com a mensagem do servidor. */
export async function api<T = unknown>(caminho: string, opcoes: { metodo?: string; corpo?: unknown; semSessao?: boolean; tempo?: number } = {}): Promise<T> {
  if (!endereco) throw new ErroServidor("Sem servidor configurado.");
  const token = lerToken();
  let r: Response;
  try {
    r = await fetch(`${endereco}/api${caminho}`, {
      method: opcoes.metodo ?? (opcoes.corpo === undefined ? "GET" : "POST"),
      headers: {
        ...(opcoes.corpo === undefined ? {} : { "content-type": "application/json" }),
        ...(token && !opcoes.semSessao ? { authorization: `Bearer ${token}` } : {}),
      },
      body: opcoes.corpo === undefined ? undefined : JSON.stringify(opcoes.corpo),
      signal: AbortSignal.timeout(opcoes.tempo ?? 30_000),
      cache: "no-store",
    });
  } catch (e) {
    throw new ErroServidor((e as Error)?.name === "TimeoutError" ? "O servidor demorou demais para responder." : "Sem conexão com o servidor.", 0, "rede");
  }
  if (r.status === 204) return undefined as T;
  const j = (await r.json().catch(() => ({}))) as Record<string, unknown>;
  if (!r.ok) {
    if (r.status === 401 && j.codigo === "sem_sessao" && token) {
      guardarToken("", false);
      window.dispatchEvent(new Event(EVENTO_SESSAO_EXPIRADA));
    }
    throw new ErroServidor(String(j.erro ?? `Erro ${r.status} no servidor.`), r.status, String(j.codigo ?? ""), j);
  }
  return j as T;
}
