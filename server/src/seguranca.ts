import { createHash, pbkdf2, randomBytes, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { ErroApi } from "./erros.js";

const pbkdf2Async = promisify(pbkdf2);

/** PBKDF2-SHA-256, 32 bytes, em base64 — o mesmo formato do acesso local do aplicativo. */
export async function derivar(senha: string, salB64: string, iteracoes: number): Promise<string> {
  const bits = await pbkdf2Async(senha.normalize("NFC"), Buffer.from(salB64, "base64"), iteracoes, 32, "sha256");
  return bits.toString("base64");
}

export async function novaSenha(senha: string, iteracoes: number) {
  const sal = randomBytes(16).toString("base64");
  return { sal, hash: await derivar(senha, sal, iteracoes), iteracoes };
}

export function iguais(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Token de sessão: 32 bytes aleatórios. O banco guarda só o SHA-256. */
export const novoToken = () => randomBytes(32).toString("base64url");
export const hashToken = (t: string) => createHash("sha256").update(t).digest();

// ---------------------------------------------------------------- regras (iguais às do aplicativo)
export const normalizarUsuario = (u: string) => u.trim().toLowerCase();

export function validarUsuario(u: string): string {
  const v = normalizarUsuario(u);
  if (!/^[a-z0-9._-]{3,32}$/.test(v)) throw new ErroApi(400, "Usuário: 3 a 32 caracteres, só letras sem acento, números, ponto, hífen ou sublinhado.");
  return v;
}

export function validarSenha(senha: string, usuario = ""): void {
  if (senha.length < 8) throw new ErroApi(400, "A senha precisa ter pelo menos 8 caracteres.");
  if (senha.length > 128) throw new ErroApi(400, "Senha longa demais (máx. 128 caracteres).");
  if (!/[A-Za-zÀ-ÿ]/.test(senha) || !/\d/.test(senha)) throw new ErroApi(400, "Use letras e números na senha.");
  if (usuario && senha.toLowerCase().includes(normalizarUsuario(usuario))) throw new ErroApi(400, "A senha não pode conter o nome de usuário.");
}

export function validarNome(nome: string): string {
  const n = nome.trim().replace(/\s+/g, " ");
  if (n.length < 2) throw new ErroApi(400, "Informe o nome.");
  if (n.length > 80) throw new ErroApi(400, "Nome longo demais.");
  return n;
}
