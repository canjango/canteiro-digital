/**
 * Acessos: a mesma interface para os dois modos.
 * - local: contas neste navegador (lib/acesso.ts);
 * - servidor: contas no PostgreSQL, via API (lib/servidor.ts).
 */
import * as ac from "@/lib/acesso";
import { api, enderecoAtual, ErroServidor, guardarToken, lerToken, usandoServidor } from "@/lib/servidor";

export type ContaPublica = ac.ContaPublica & { escritorio?: string; ativo?: boolean; ultimo_acesso?: string | null };

interface RespSessao {
  token: string;
  expira_em: string;
  conta: ContaPublica;
}

/** Erros do servidor viram AcessoErro (mensagem pronta para a tela). */
async function remoto<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof ErroServidor) throw new ac.AcessoErro(e.status === 0 ? `${e.message} (${enderecoAtual()})` : e.message);
    throw e;
  }
}

const sessaoServidor = (r: RespSessao, lembrar: boolean) => {
  guardarToken(r.token, lembrar);
  return r.conta;
};

export const modo = () => (usandoServidor() ? "servidor" : "local") as "servidor" | "local";

/** O servidor (ou este navegador) já tem o primeiro administrador? */
export async function configurado(): Promise<boolean> {
  if (!usandoServidor()) return ac.existeConta();
  return remoto(async () => (await api<{ configurado: boolean }>("/estado", { semSessao: true })).configurado);
}

export async function sessaoAtual(): Promise<ContaPublica | null> {
  if (!usandoServidor()) return ac.sessaoAtual();
  if (!lerToken()) return null;
  try {
    return (await api<{ conta: ContaPublica }>("/eu")).conta;
  } catch (e) {
    if (e instanceof ErroServidor && e.status === 401) return null;
    throw e instanceof ErroServidor ? new ac.AcessoErro(e.message) : e;
  }
}

export async function listar(): Promise<ContaPublica[]> {
  if (!usandoServidor()) return ac.listarContas();
  return remoto(async () => (await api<{ usuarios: ContaPublica[] }>("/usuarios")).usuarios);
}

export async function entrar(usuario: string, senha: string, lembrar: boolean): Promise<ContaPublica> {
  if (!usandoServidor()) return ac.entrar(usuario, senha, lembrar);
  return remoto(async () => sessaoServidor(await api<RespSessao>("/entrar", { corpo: { usuario, senha, lembrar }, semSessao: true }), lembrar));
}

/** Primeiro acesso: cria o administrador (e, no servidor, o escritório) e já entra. */
export async function primeiroAcesso(d: { escritorio: string; nome: string; usuario: string; senha: string; lembrar: boolean }): Promise<ContaPublica> {
  if (!usandoServidor()) {
    const c = await ac.criarConta(d);
    return ac.entrar(c.usuario, d.senha, d.lembrar);
  }
  return remoto(async () => sessaoServidor(await api<RespSessao>("/configurar", { corpo: d, semSessao: true }), d.lembrar));
}

export async function criar(d: { nome: string; usuario: string; senha: string; papel: ac.Papel }, por: ContaPublica): Promise<ContaPublica> {
  if (!usandoServidor()) return ac.criarConta(d, por);
  return remoto(async () => (await api<{ usuario: ContaPublica }>("/usuarios", { corpo: d })).usuario);
}

export async function alterarSenha(id: string, atual: string, nova: string): Promise<void> {
  if (!usandoServidor()) return ac.alterarSenha(id, atual, nova);
  ac.validarSenha(nova);
  await remoto(() => api("/eu/senha", { corpo: { atual, nova } }));
}

export async function redefinirSenha(por: ContaPublica, id: string, nova: string): Promise<void> {
  if (!usandoServidor()) return ac.redefinirSenha(por, id, nova);
  ac.validarSenha(nova);
  await remoto(() => api(`/usuarios/${id}`, { metodo: "PATCH", corpo: { senha: nova } }));
}

export async function alterarPapel(por: ContaPublica, id: string, papel: ac.Papel): Promise<void> {
  if (!usandoServidor()) return ac.alterarPapel(por, id, papel);
  await remoto(() => api(`/usuarios/${id}`, { metodo: "PATCH", corpo: { papel } }));
}

export async function remover(por: ContaPublica, id: string): Promise<void> {
  if (!usandoServidor()) return ac.removerConta(por, id);
  await remoto(() => api(`/usuarios/${id}`, { metodo: "DELETE" }));
}

export async function sair(): Promise<void> {
  if (!usandoServidor()) return ac.sair();
  await api("/sair", { metodo: "POST" }).catch(() => {});
  guardarToken("", false);
}

/** Contas deste navegador no formato que o servidor importa (com o hash; a senha nunca sai daqui). */
export function contasLocaisParaImportar() {
  return ac.exportarContas();
}
