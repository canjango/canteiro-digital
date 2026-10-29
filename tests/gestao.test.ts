/** Painel de acesso: gestão de projetos, gestão de equipe e acesso por usuário e senha. */
import { beforeEach, describe, expect, it } from "vitest";
import * as gs from "@/lib/core/gestao";
import * as md from "@/lib/core/modulos";
import { Sistema } from "@/lib/core/sistema";

const H = "2026-10-28";
let s: Sistema;
const ok = (acao: string, d: Record<string, unknown> = {}) => {
  const r = s.despachar(acao, d);
  expect(s.ui.erro, `${acao}: ${s.ui.erro}`).toBe("");
  return r;
};
const falha = (acao: string, d: Record<string, unknown>, trecho: string) => {
  expect(s.despachar(acao, d).ok).toBe(false);
  expect(s.ui.erro).toContain(trecho);
};
beforeEach(() => { s = new Sistema(H); });

describe("áreas do sistema", () => {
  it("começa no painel de acesso e troca de área", () => {
    expect(s.ui.modulo).toBe("hub");
    ok("ui.modulo", { modulo: "equipe", sub: "acessos" });
    expect([s.ui.modulo, s.ui.sub]).toEqual(["equipe", "acessos"]);
    falha("ui.modulo", { modulo: "x" }, "Área inválida");
  });
  it("cadastros antigos (sem projetos/equipe) continuam carregando", () => {
    const c = md.lerCadastros({ contatos: [{ nome: "A" }] });
    expect([c.contatos.length, c.projetos, c.equipe]).toEqual([1, [], []]);
  });
});

describe("gestão de equipe", () => {
  it("cadastro, presença, dias e custo do mês por obra", () => {
    ok("obra.criar", { nome: "Obra 1", uf_cub: "PB" });
    const obra = s.obra!.id;
    ok("eq.salvar", { nome: "João", funcao: "Pedreiro(a)", vinculo: "Diarista", custo_dia: "180,00", obra });
    ok("eq.salvar", { nome: "Maria", funcao: "Arquiteto(a)", vinculo: "Sócio(a)", custo_dia: "400", obra: "" });
    ok("eq.salvar", { nome: "Zé", funcao: "Servente", custo_dia: "120", obra, ativo: "0" });
    const [joao, maria] = s.cadastros.equipe;
    ok("eq.todos", { data: "2026-10-27", obra, presente: "1" }); // só ativos da obra: João
    ok("eq.presenca", { id: joao.id, data: H, presente: "1" });
    ok("eq.presenca", { id: maria.id, data: H, presente: "1" });
    ok("eq.presenca", { id: joao.id, data: H, presente: "1" }); // repetir não duplica
    expect(joao.presencas).toEqual(["2026-10-27", H]);
    expect(gs.resumoMes(joao, "2026-10")).toEqual({ dias: 2, custo: 360 });
    const r = gs.resumoEquipe(s.cadastros, "2026-10", H);
    expect([r.ativos, r.alocados, r.presentes_hoje, r.dias_mes, r.custo_mes]).toEqual([2, 1, 2, 3, 760]);
    expect(gs.custoPorObra(s.cadastros, "2026-10")).toEqual(new Map([[obra, 360], ["", 400]]));
    ok("eq.presenca", { id: joao.id, data: H, presente: "0" });
    expect(joao.presencas).toEqual(["2026-10-27"]);
    falha("eq.salvar", { nome: "X", obra: "nao-existe" }, "Obra não encontrada");
    falha("eq.salvar", { nome: "X", custo_dia: "-5" }, "menor que 0");
  });
});

// ---------------------------------------------------------------- acesso (usuário e senha)
class Memoria {
  private m = new Map<string, string>();
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string) { this.m.set(k, String(v)); }
  removeItem(k: string) { this.m.delete(k); }
}

describe("acesso por usuário e senha", () => {
  beforeEach(() => {
    (globalThis as unknown as { window: unknown }).window = { localStorage: new Memoria(), sessionStorage: new Memoria() };
  });

  it("primeira conta vira administradora; senha só como hash; entrar e sair", async () => {
    const ac = await import("@/lib/acesso");
    expect(ac.existeConta()).toBe(false);
    const c = await ac.criarConta({ nome: "Gustavo Araújo", usuario: "Gustavo", senha: "obra2026segura" });
    expect([c.usuario, c.papel]).toEqual(["gustavo", "admin"]);
    const bruto = (globalThis as unknown as { window: { localStorage: Memoria } }).window.localStorage.getItem("canteiro-digital:acessos:v1")!;
    expect(bruto).not.toContain("obra2026segura");
    expect(JSON.parse(bruto).contas[0]).toHaveProperty("hash");
    await expect(ac.entrar("gustavo", "errada123", false)).rejects.toThrow("incorretos");
    await expect(ac.entrar("ninguem", "obra2026segura", false)).rejects.toThrow("incorretos");
    const e = await ac.entrar(" GUSTAVO ", "obra2026segura", false);
    expect(ac.sessaoAtual()?.id).toBe(e.id);
    ac.sair();
    expect(ac.sessaoAtual()).toBeNull();
  }, 20000);

  it("regras de senha, permissões e pausa após tentativas erradas", async () => {
    const ac = await import("@/lib/acesso");
    await expect(ac.criarConta({ nome: "A", usuario: "a", senha: "x" })).rejects.toThrow();
    await expect(ac.criarConta({ nome: "Ana", usuario: "ana", senha: "somenteletras" })).rejects.toThrow("letras e números");
    await expect(ac.criarConta({ nome: "Ana", usuario: "ana", senha: "ana12345" })).rejects.toThrow("nome de usuário");
    const adm = await ac.criarConta({ nome: "Ana", usuario: "ana", senha: "casa2026x" });
    await expect(ac.criarConta({ nome: "Beto", usuario: "beto", senha: "obra2026x" }, null)).rejects.toThrow("administrador");
    const beto = await ac.criarConta({ nome: "Beto", usuario: "beto", senha: "obra2026x" }, adm);
    expect(beto.papel).toBe("membro");
    expect(() => ac.removerConta(adm, adm.id)).toThrow("próprio");
    expect(() => ac.alterarPapel(adm, adm.id, "membro")).toThrow("pelo menos um administrador");
    await ac.redefinirSenha(adm, beto.id, "nova2026y");
    await expect(ac.entrar("beto", "nova2026y", true)).resolves.toMatchObject({ usuario: "beto" });
    for (let i = 0; i < 5; i++) await expect(ac.entrar("ana", "errada000", false)).rejects.toThrow();
    expect(ac.esperaRestante("ana")).toBeGreaterThan(0);
    await expect(ac.entrar("ana", "casa2026x", false)).rejects.toThrow("Aguarde");
  }, 30000);
});
