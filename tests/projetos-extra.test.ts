/** Cronograma, tarefas, orçamento, biblioteca/captura, templates, arquivos e financeiro do projeto. */
import { beforeEach, describe, expect, it } from "vitest";
import * as pj from "@/lib/core/projetos";
import * as px from "@/lib/core/projetos-extra";
import { Sistema } from "@/lib/core/sistema";

const H = "2026-10-28";
let s: Sistema;
const ok = (acao: string, d: Record<string, unknown> = {}) => {
  const r = s.despachar(acao, d);
  expect(s.ui.erro, `${acao}: ${s.ui.erro}`).toBe("");
  return r;
};
const falha = (acao: string, d: Record<string, unknown>, trecho: string) => {
  expect(s.despachar(acao, d).ok, `${acao} deveria falhar`).toBe(false);
  expect(s.ui.erro).toContain(trecho);
};
const g = () => s.cadastros;
const novo = (d: Record<string, unknown> = {}) => {
  ok("proj.salvar", { nome: "Casa Lima", tipo_obra: "Residência unifamiliar", padrao: "Alto padrão", area: "250", metodo: "Valor fixo", valor_fixo: "60.000", inicio: "2026-11-02", entrega: "2027-04-30", ...d });
  return g().projetos.at(-1)!;
};
beforeEach(() => { s = new Sistema(H); });

describe("templates", () => {
  it("cinco templates padrão; criar projeto a partir do template", () => {
    expect(g().templates.map((t) => t.id)).toContain("tpl-interiores");
    expect(g().templates).toHaveLength(5);
    const p = novo({ nome: "Apto Tambaú", tipo_obra: "Interiores residencial", template: "tpl-interiores" });
    expect(p.fases.map((f) => f.codigo)).toEqual(["LV", "PN", "EP", "AP", "PE", "AO"]);
    expect(p.tarefas.length).toBe(8);
    expect(p.tarefas.every((t) => t.prazo === p.fases.find((f) => f.codigo === t.fase)!.prazo)).toBe(true);
    expect(p.ambientes).toContain("Home office");
    expect([p.revisoes_incluidas, p.template]).toEqual([3, "tpl-interiores"]);
    falha("proj.salvar", { nome: "X", metodo: "Valor fixo", valor_fixo: "1", template: "nao-existe" }, "Template não encontrado");
  });
  it("salvar projeto como template e criar template próprio", () => {
    const p = novo({ template: "tpl-residencia-alto" });
    ok("tpl.do_projeto", { id: p.id, nome: "Meu padrão de casas" });
    const t = g().templates.at(-1)!;
    expect([t.tarefas.length, t.ambientes.length, t.pesos.PE]).toEqual([15, 11, 35]);
    falha("tpl.salvar", { nome: "Ruim", peso_LV: "50", peso_PE: "30" }, "somam 80%");
    ok("tpl.salvar", { nome: "Rápido", peso_LV: "20", peso_PE: "80", tarefas: "LV: Medir\nPE: Detalhar\nRevisar tudo", ambientes: "Sala, Cozinha" });
    const r = g().templates.at(-1)!;
    expect(r.tarefas).toEqual([{ fase: "LV", titulo: "Medir", prioridade: "Média" }, { fase: "PE", titulo: "Detalhar", prioridade: "Média" }, { fase: "", titulo: "Revisar tudo", prioridade: "Média" }]);
    const q = novo({ nome: "Com template próprio", template: r.id });
    expect(q.fases.map((f) => f.codigo)).toEqual(["LV", "PE"]);
    expect(pj.somaPesos(q)).toBe(100);
    ok("tpl.remover", { id: "tpl-comercial" }); ok("tpl.remover", { id: "tpl-comercial" });
    ok("tpl.restaurar");
    expect(g().templates.some((x) => x.id === "tpl-comercial")).toBe(true);
  });
});

describe("tarefas", () => {
  it("checklist obrigatório para concluir e atraso gera alerta", () => {
    const p = novo();
    ok("tpj.salvar", { id: p.id, titulo: "Protocolar na prefeitura", fase: "AP", prazo: "2026-10-20", prioridade: "Alta", checklist: "Plantas assinadas\nRRT pago" });
    const t = p.tarefas[0];
    expect(t.checklist).toHaveLength(2);
    expect(pj.alertasProjeto(p, g().regras, H).some((a) => a.titulo.includes("tarefa(s) atrasada(s)"))).toBe(true);
    falha("tpj.mover", { id: p.id, tid: t.id, status: "Concluída" }, "Faltam 2");
    ok("tpj.item", { id: p.id, tid: t.id, indice: 0 }); ok("tpj.item", { id: p.id, tid: t.id, indice: 1 });
    ok("tpj.mover", { id: p.id, tid: t.id, status: "Concluída" });
    expect([t.status, t.concluida_em]).toEqual(["Concluída", H]);
    ok("tpj.item", { id: p.id, tid: t.id, indice: 1 }); // desmarcar reabre
    expect(t.status).toBe("Em andamento");
    // editar mantém o que já estava marcado
    ok("tpj.salvar", { id: p.id, tid: t.id, titulo: t.titulo, fase: "AP", checklist: "Plantas assinadas\nRRT pago\nTaxa paga" });
    expect(t.checklist.map((c) => c.feito)).toEqual([true, false, false]);
    falha("tpj.salvar", { id: p.id, titulo: "X", fase: "PB" }, "Fase não está");
    expect(px.todasTarefas(g()).length).toBe(1);
  });
});

describe("biblioteca, captura e orçamento", () => {
  it("captura por JSON, base64 e link; produto vira item do orçamento", () => {
    const c = px.lerCaptura(JSON.stringify({ nome: "Cuba de apoio Deca", link: "https://www.loja.com.br/cuba", imagem: "https://img.loja.com.br/c.jpg", preco: "1299.90", marca: "Deca" }));
    expect(c).toMatchObject({ nome: "Cuba de apoio Deca", preco: 1299.9, fornecedor: "loja.com.br", marca: "Deca" });
    expect(px.lerCaptura(JSON.stringify({ nome: "Pendente", preco: "R$ 2.450,00" })).preco).toBe(2450);
    const b64 = Buffer.from(unescape(encodeURIComponent(JSON.stringify({ nome: "Ação", link: "https://x.com/a" }))), "binary").toString("base64");
    expect(px.lerCaptura(b64).nome).toBe("Ação");
    expect(px.lerCaptura("https://www.leroymerlin.com.br/porcelanato").fornecedor).toBe("leroymerlin.com.br");
    expect(() => px.lerCaptura("texto qualquer")).toThrow("Cole o conteúdo");
    expect(px.codigoCaptura("https://app.exemplo/").startsWith("javascript:")).toBe(true);

    ok("prd.salvar", { nome: c.nome, categoria: "Louças e metais", link: c.link, preco: "1.299,90", origem: "Captura" });
    falha("prd.salvar", { nome: "Dup", link: c.link }, "já está na biblioteca");
    falha("prd.salvar", { nome: "X", link: "ftp://x" }, "http");
    const prod = g().produtos[0];
    const p = novo();
    ok("orc.item", { id: p.id, ambiente: "Banheiro social", produto: prod.id, quantidade: "2" });
    const i = p.orcamento[0];
    expect([i.descricao, i.preco, i.categoria, px.totalItem(i), p.ambientes]).toEqual(["Cuba de apoio Deca", 1299.9, "Louças e metais", 2599.8, ["Banheiro social"]]);
    ok("orc.item", { id: p.id, ambiente: "Sala", descricao: "Sofá sob medida", categoria: "Mobiliário", quantidade: "1", preco: "18.500" });
    ok("orc.item", { id: p.id, ambiente: "Sala", descricao: "Tapete", categoria: "Decoração", quantidade: "1" });
    const r = px.resumoOrcamento(p);
    expect([r.total, r.porAmbiente.get("Sala"), r.sem_preco, r.por_m2]).toEqual([21099.8, 18500, 1, Math.round((21099.8 / 250) * 100) / 100]);
    ok("orc.status", { id: p.id, iid: i.id, status: "Aprovado pelo cliente" });
    expect(px.resumoOrcamento(p).aprovado).toBe(2599.8);
    // novo preço na biblioteca: só atualiza itens ainda "Especificado"
    ok("prd.salvar", { id: prod.id, nome: prod.nome, categoria: prod.categoria, link: prod.link, preco: "1.100" });
    ok("prd.precos", { id: prod.id });
    expect(i.preco).toBe(1299.9);
    falha("orc.ambientes", { id: p.id, ambientes: "Cozinha" }, "Há itens");
    ok("orc.ambientes", { id: p.id, ambientes: "Sala\nBanheiro social\nCozinha" });
    expect(p.ambientes).toEqual(["Sala", "Banheiro social", "Cozinha"]);
    falha("orc.item", { id: p.id, descricao: "X", quantidade: "0" }, "maior que zero");
  });
});

describe("arquivos e financeiro", () => {
  it("links com revisão automática por nome", () => {
    const p = novo();
    falha("arq.salvar", { id: p.id, nome: "Planta", link: "" }, "Informe o link");
    falha("arq.salvar", { id: p.id, nome: "Planta", link: "C:\\\\arq.dwg" }, "http");
    ok("arq.salvar", { id: p.id, nome: "Planta baixa térreo", pasta: "Projeto executivo", fase: "PE", link: "https://drive.google.com/file/d/1/planta.dwg" });
    ok("arq.salvar", { id: p.id, nome: "planta baixa térreo", pasta: "Projeto executivo", fase: "PE", link: "https://drive.google.com/file/d/2/planta.dwg" });
    expect(p.arquivos.map((a) => a.revisao)).toEqual([0, 1]);
    expect(px.tipoArquivo(p.arquivos[0])).toBe("CAD");
  });
  it("despesas entram no custo e no fluxo de caixa", () => {
    const p = novo();
    ok("dsp.salvar", { id: p.id, descricao: "Projeto estrutural (terceiro)", categoria: "Projetos complementares (terceiros)", valor: "8.000", data: "2026-10-10" });
    ok("dsp.salvar", { id: p.id, descricao: "RRT", categoria: "RRT / ART", valor: "120,50", data: "2026-10-12", pago: "0" });
    expect(px.totalDespesas(p)).toBe(8120.5);
    ok("proj.horas", { id: p.id, fase: "LV", pessoa: "Ana", horas: "10", data: "2026-10-20" });
    const r = pj.resultado(p, H);
    expect([r.custo_horas, r.despesas, r.custo]).toEqual([800, 8120.5, 8920.5]);
    ok("proj.parcela", { id: p.id, descricao: "Sinal", valor: "12.000", vencimento: "2026-11-05" });
    ok("proj.parcela", { id: p.id, descricao: "EP", valor: "9.000", vencimento: "2026-10-15" });
    ok("proj.parcela_status", { id: p.id, pid: p.parcelas[1].id, status: "Recebida", data: "2026-10-16" });
    const f = px.fluxoCaixa(g(), H, 1, 2);
    expect(f.map((x) => x.mes)).toEqual(["2026-09", "2026-10", "2026-11", "2026-12"]);
    const out = f.find((x) => x.mes === "2026-10")!;
    expect([out.recebido, out.despesas, out.horas, out.saldo]).toEqual([9000, 8120.5, 800, 79.5]);
    expect(f.find((x) => x.mes === "2026-11")!.previsto).toBe(12000);
    ok("dsp.pago", { id: p.id, did: p.despesas[1].id });
    expect(p.despesas[1].pago).toBe(true);
  });
});

describe("cronograma", () => {
  it("barras das fases e janela de meses", () => {
    const p = novo();
    const b = px.barrasProjeto(p, H);
    expect(b[0]).toMatchObject({ codigo: "LV", inicio: "2026-11-02" });
    expect(b.at(-1)!.fim).toBe("2027-04-30");
    const j = px.janelaCronograma([p], H);
    expect([j.inicio, j.fim]).toEqual(["2026-09-01", "2027-05-01"]);
  });
});
