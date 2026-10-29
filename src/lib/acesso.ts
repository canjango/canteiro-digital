/**
 * Acesso por usuário e senha, guardado NESTE navegador (localStorage).
 *
 * A senha nunca é gravada: só o hash PBKDF2-SHA-256 (210 mil iterações, sal aleatório por conta).
 * Importante: sem servidor, isto protege contra uso casual do aparelho — não é uma barreira de
 * segurança contra quem tem acesso técnico ao navegador. Os dados das obras continuam no mesmo navegador.
 */

export type Papel = "admin" | "membro";

export interface Conta {
  id: string;
  nome: string;
  usuario: string;
  papel: Papel;
  sal: string;
  hash: string;
  iteracoes: number;
  criada_em: string;
}

/** Conta sem os dados da senha (o que a interface usa). */
export type ContaPublica = Omit<Conta, "sal" | "hash" | "iteracoes">;

const CHAVE_CONTAS = "canteiro-digital:acessos:v1";
const CHAVE_SESSAO = "canteiro-digital:sessao";
const CHAVE_TENTATIVAS = "canteiro-digital:tentativas";
const ITERACOES = 210_000;
const DIAS_LEMBRAR = 30;
const LIVRES = 5; // tentativas erradas antes da pausa

export class AcessoErro extends Error {}

// ---------------------------------------------------------------- armazenamento (à prova de navegador sem storage)
function ler<T>(area: "local" | "sessao", chave: string, padrao: T): T {
  try {
    const st = area === "local" ? window.localStorage : window.sessionStorage;
    const v = st.getItem(chave);
    return v ? (JSON.parse(v) as T) : padrao;
  } catch {
    return padrao;
  }
}
function gravar(area: "local" | "sessao", chave: string, valor: unknown): boolean {
  try {
    const st = area === "local" ? window.localStorage : window.sessionStorage;
    if (valor === null) st.removeItem(chave);
    else st.setItem(chave, JSON.stringify(valor));
    return true;
  } catch {
    return false;
  }
}

const publica = ({ sal: _s, hash: _h, iteracoes: _i, ...c }: Conta): ContaPublica => c; // eslint-disable-line @typescript-eslint/no-unused-vars
const contasBrutas = (): Conta[] => {
  const v = ler<{ contas?: Conta[] }>("local", CHAVE_CONTAS, {});
  return Array.isArray(v.contas) ? v.contas.filter((c) => c && c.usuario && c.hash && c.sal) : [];
};
const salvarContas = (contas: Conta[]) => {
  if (!gravar("local", CHAVE_CONTAS, { contas })) throw new AcessoErro("Este navegador não permite guardar dados (modo privado?). Não foi possível salvar o acesso.");
};

export const listarContas = (): ContaPublica[] => contasBrutas().map(publica);
/** Para levar os acessos deste navegador ao servidor: vai o hash PBKDF2, nunca a senha. */
export const exportarContas = () => contasBrutas().map(({ nome, usuario, papel, sal, hash, iteracoes }) => ({ nome, usuario, papel, sal, hash, iteracoes }));
export const existeConta = () => contasBrutas().length > 0;

// ---------------------------------------------------------------- criptografia
const b64 = (b: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(b instanceof Uint8Array ? b : new Uint8Array(b))));
const deB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function derivar(senha: string, sal: Uint8Array, iteracoes: number): Promise<string> {
  if (!globalThis.crypto?.subtle) throw new AcessoErro("Este navegador não oferece criptografia segura (abra o sistema por https).");
  const chave = await crypto.subtle.importKey("raw", new TextEncoder().encode(senha.normalize("NFC")), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: sal as BufferSource, iterations: iteracoes }, chave, 256);
  return b64(bits);
}

/** Comparação em tempo constante (não revela quantos caracteres batem). */
function iguais(a: string, b: string) {
  let dif = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) dif |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return dif === 0;
}

const novoIdConta = () => `usr-${Array.from(crypto.getRandomValues(new Uint8Array(6)), (x) => x.toString(16).padStart(2, "0")).join("")}`;

// ---------------------------------------------------------------- validação
export const normalizarUsuario = (u: string) => u.trim().toLowerCase();

export function validarUsuario(u: string) {
  const v = normalizarUsuario(u);
  if (!/^[a-z0-9._-]{3,32}$/.test(v)) throw new AcessoErro("Usuário: 3 a 32 caracteres, só letras sem acento, números, ponto, hífen ou sublinhado.");
  return v;
}

/** Regras mínimas: 8+ caracteres, com letra e número; não pode ser o próprio usuário. */
export function validarSenha(senha: string, usuario = "") {
  if (senha.length < 8) throw new AcessoErro("A senha precisa ter pelo menos 8 caracteres.");
  if (senha.length > 128) throw new AcessoErro("Senha longa demais (máx. 128 caracteres).");
  if (!/[A-Za-zÀ-ÿ]/.test(senha) || !/\d/.test(senha)) throw new AcessoErro("Use letras e números na senha.");
  if (usuario && senha.toLowerCase().includes(normalizarUsuario(usuario))) throw new AcessoErro("A senha não pode conter o nome de usuário.");
}

export function forcaSenha(senha: string): { nivel: 0 | 1 | 2 | 3; rotulo: string } {
  let pts = 0;
  if (senha.length >= 8) pts++;
  if (senha.length >= 12) pts++;
  if (/[a-z]/.test(senha) && /[A-Z]/.test(senha)) pts++;
  if (/\d/.test(senha)) pts++;
  if (/[^A-Za-z0-9]/.test(senha)) pts++;
  const nivel = (senha.length < 8 ? 0 : pts <= 2 ? 1 : pts <= 3 ? 2 : 3) as 0 | 1 | 2 | 3;
  return { nivel, rotulo: ["Muito fraca", "Fraca", "Boa", "Forte"][nivel] };
}

// ---------------------------------------------------------------- contas
export async function criarConta(d: { nome: string; usuario: string; senha: string; papel?: Papel }, por?: ContaPublica | null): Promise<ContaPublica> {
  const contas = contasBrutas();
  if (contas.length && por?.papel !== "admin") throw new AcessoErro("Só um administrador pode criar acessos.");
  const nome = d.nome.trim().replace(/\s+/g, " ");
  if (nome.length < 2) throw new AcessoErro("Informe o nome.");
  if (nome.length > 80) throw new AcessoErro("Nome longo demais.");
  const usuario = validarUsuario(d.usuario);
  validarSenha(d.senha, usuario);
  if (contas.some((c) => c.usuario === usuario)) throw new AcessoErro(`O usuário “${usuario}” já existe.`);
  const sal = crypto.getRandomValues(new Uint8Array(16));
  const conta: Conta = {
    id: novoIdConta(), nome, usuario, papel: contas.length ? (d.papel ?? "membro") : "admin", // a primeira conta é sempre administradora
    sal: b64(sal), hash: await derivar(d.senha, sal, ITERACOES), iteracoes: ITERACOES, criada_em: new Date().toISOString(),
  };
  salvarContas([...contas, conta]);
  return publica(conta);
}

export async function alterarSenha(id: string, atual: string, nova: string): Promise<void> {
  const contas = contasBrutas();
  const c = contas.find((x) => x.id === id);
  if (!c) throw new AcessoErro("Conta não encontrada.");
  if (!iguais(await derivar(atual, deB64(c.sal), c.iteracoes), c.hash)) throw new AcessoErro("A senha atual não confere.");
  validarSenha(nova, c.usuario);
  const sal = crypto.getRandomValues(new Uint8Array(16));
  Object.assign(c, { sal: b64(sal), hash: await derivar(nova, sal, ITERACOES), iteracoes: ITERACOES });
  salvarContas(contas);
}

/** Administrador define uma senha provisória para outra conta. */
export async function redefinirSenha(por: ContaPublica, id: string, nova: string): Promise<void> {
  if (por.papel !== "admin") throw new AcessoErro("Só um administrador pode redefinir senhas.");
  const contas = contasBrutas();
  const c = contas.find((x) => x.id === id);
  if (!c) throw new AcessoErro("Conta não encontrada.");
  validarSenha(nova, c.usuario);
  const sal = crypto.getRandomValues(new Uint8Array(16));
  Object.assign(c, { sal: b64(sal), hash: await derivar(nova, sal, ITERACOES), iteracoes: ITERACOES });
  salvarContas(contas);
}

export function alterarPapel(por: ContaPublica, id: string, papel: Papel): void {
  if (por.papel !== "admin") throw new AcessoErro("Só um administrador pode mudar permissões.");
  const contas = contasBrutas();
  const c = contas.find((x) => x.id === id);
  if (!c) throw new AcessoErro("Conta não encontrada.");
  if (c.papel === "admin" && papel !== "admin" && contas.filter((x) => x.papel === "admin").length === 1) {
    throw new AcessoErro("É preciso manter pelo menos um administrador.");
  }
  c.papel = papel;
  salvarContas(contas);
}

export function removerConta(por: ContaPublica, id: string): void {
  if (por.papel !== "admin") throw new AcessoErro("Só um administrador pode remover acessos.");
  if (por.id === id) throw new AcessoErro("Você não pode remover o seu próprio acesso.");
  const contas = contasBrutas();
  const c = contas.find((x) => x.id === id);
  if (!c) throw new AcessoErro("Conta não encontrada.");
  if (c.papel === "admin" && contas.filter((x) => x.papel === "admin").length === 1) throw new AcessoErro("É preciso manter pelo menos um administrador.");
  salvarContas(contas.filter((x) => x.id !== id));
}

// ---------------------------------------------------------------- sessão e tentativas
interface Sessao {
  id: string;
  expira: number;
}
interface Tentativas {
  [usuario: string]: { erros: number; ate: number };
}

/** Segundos que ainda faltam para poder tentar de novo (0 = liberado). */
export function esperaRestante(usuario: string): number {
  const t = ler<Tentativas>("local", CHAVE_TENTATIVAS, {})[normalizarUsuario(usuario)];
  return t && t.ate > Date.now() ? Math.ceil((t.ate - Date.now()) / 1000) : 0;
}

function registrarErro(usuario: string) {
  const todas = ler<Tentativas>("local", CHAVE_TENTATIVAS, {});
  const u = normalizarUsuario(usuario);
  const t = todas[u] ?? { erros: 0, ate: 0 };
  t.erros += 1;
  // a partir da 5ª tentativa errada: pausa de 30 s, dobrando a cada erro (máx. 15 min)
  if (t.erros >= LIVRES) t.ate = Date.now() + Math.min(15 * 60, 30 * 2 ** (t.erros - LIVRES)) * 1000;
  todas[u] = t;
  gravar("local", CHAVE_TENTATIVAS, todas);
}

export async function entrar(usuario: string, senha: string, lembrar: boolean): Promise<ContaPublica> {
  const u = normalizarUsuario(usuario);
  const espera = esperaRestante(u);
  if (espera) throw new AcessoErro(`Muitas tentativas. Aguarde ${espera} s e tente de novo.`);
  const c = contasBrutas().find((x) => x.usuario === u);
  // mesmo sem conta, calcula um hash: o tempo de resposta não revela se o usuário existe
  const sal = c ? deB64(c.sal) : new Uint8Array(16);
  const hash = await derivar(senha, sal, c?.iteracoes ?? ITERACOES);
  if (!c || !iguais(hash, c.hash)) {
    registrarErro(u);
    throw new AcessoErro("Usuário ou senha incorretos.");
  }
  const todas = ler<Tentativas>("local", CHAVE_TENTATIVAS, {});
  delete todas[u];
  gravar("local", CHAVE_TENTATIVAS, todas);
  const sessao: Sessao = { id: c.id, expira: Date.now() + (lembrar ? DIAS_LEMBRAR * 86400000 : 12 * 3600000) };
  gravar("sessao", CHAVE_SESSAO, sessao);
  gravar("local", CHAVE_SESSAO, lembrar ? sessao : null);
  return publica(c);
}

export function sessaoAtual(): ContaPublica | null {
  const s = ler<Sessao | null>("sessao", CHAVE_SESSAO, null) ?? ler<Sessao | null>("local", CHAVE_SESSAO, null);
  if (!s || s.expira < Date.now()) return null;
  const c = contasBrutas().find((x) => x.id === s.id);
  return c ? publica(c) : null;
}

export function sair(): void {
  gravar("sessao", CHAVE_SESSAO, null);
  gravar("local", CHAVE_SESSAO, null);
}
