import { describe, expect, it } from "vitest";
import * as an from "@/lib/core/analise";
import * as ct from "@/lib/core/controle";
import * as sv from "@/lib/core/servicos";
import { interpretarResposta } from "@/lib/core/assistente";
import { validarCatalogo, CUB_ESTADOS, UFS, valorReferencia } from "@/lib/core/catalogo";
import { exportarObra, lerObra, totalCompraItem } from "@/lib/core/modelos";
import { Sistema } from "@/lib/core/sistema";
import { ValidacaoErro, lerNumero, moeda, num, valorBr } from "@/lib/core/util";

const H = "2026-10-27";
const novo = () => {
  const s = new Sistema(H);
  s.despachar("obra.exemplo");
  return s;
};

describe("números no formato brasileiro", () => {
  it("lê valores digitados", () => {
    expect(lerNumero("300.000", "x")).toBe(300000);
    expect(lerNumero("300.000,00", "x")).toBe(300000);
    expect(lerNumero("R$ 1.234,56", "x")).toBe(1234.56);
    expect(lerNumero("25,5", "x")).toBe(25.5);
    expect(lerNumero("2.5", "x")).toBe(2.5);
    expect(lerNumero("", "x")).toBe(0);
    expect(() => lerNumero("abc", "x")).toThrow(ValidacaoErro);
    expect(() => lerNumero("-3", "x")).toThrow(ValidacaoErro);
  });
  it("formata", () => {
    expect(moeda(1234.5)).toBe("R$ 1.234,50");
    expect(moeda(-10)).toBe("-R$ 10,00");
    expect(moeda(-0.001)).toBe("R$ 0,00");
    expect(valorBr(300000)).toBe("300.000,00");
    expect(num(7500)).toBe("7.500");
    expect(num(5.38)).toBe("5,38");
  });
});

describe("catálogo", () => {
  it("é consistente", () => {
    expect(validarCatalogo()).toEqual([]);
    expect(UFS).toContain("PB");
    for (const [uf, [, , , b, n, a]] of Object.entries(CUB_ESTADOS)) expect(b < n && n < a, uf).toBe(true);
    expect(valorReferencia("R1-N", "PB")).toBe(2037.27);
  });
});

describe("obra e etapas", () => {
  it("cria obra com 17 etapas, orçamento pelo CUB e cronograma", () => {
    const o = sv.criarObra({ nome: "Casa", area_construida: "100", uf_cub: "PB", inicio: "2026-11-02", fim_previsto: "2027-05-30" });
    expect(o.etapas).toHaveLength(17);
    expect(o.orcamento_total).toBeCloseTo(203727, 2);
    expect(o.etapas.every((e) => e.inicio_previsto && e.fim_previsto >= e.inicio_previsto)).toBe(true);
    expect(() => sv.criarObra({ nome: "X", inicio: "2026-11-02", fim_previsto: "2026-10-01" })).toThrow(ValidacaoErro);
    expect(() => sv.criarObra({ nome: "X", uf_cub: "SC" })).toThrow(/Personalizado/);
    expect(() => sv.criarObra({ nome: "X", area_construida: "3" })).toThrow(ValidacaoErro);
  });

  it("checklist por botão, marcar todos e status da etapa", () => {
    const s = novo();
    const o = s.obra!;
    const alv = o.etapas.find((e) => e.codigo === "ALV")!;
    const item = alv.checklist.find((i) => !i.feito)!;
    const r = s.despachar("etapa.item", { codigo: "ALV", item: item.id });
    expect(r).toEqual({ ok: true, alteradas: [o.id], removidas: [], cadastros: false });
    expect(item.feito).toBe(true);
    expect(item.concluido_em).toBe(H);
    s.despachar("etapa.todos", { codigo: "ALV", feito: "1" });
    expect(an.statusEtapa(o, alv, H)).toBe("Concluída");
    expect(s.despachar("etapa.item", { codigo: "ALV", item: "nao" }).ok).toBe(false);
  });

  it("aplicar modelo preserva itens marcados e itens do usuário", () => {
    const s = novo();
    const o = s.obra!;
    const e = o.etapas[3];
    const marcado = e.checklist[0];
    marcado.feito = true;
    sv.adicionarItemEtapa(o, e.codigo, "Item do usuário");
    e.checklist.splice(1, 1); // simula item que não existia no modelo antigo
    o.modelo_etapas = 1;
    const r = sv.aplicarModelo(o);
    expect(r.itens_novos).toBe(1);
    expect(e.checklist[0]).toBe(marcado);
    expect(e.checklist.at(-1)!.texto).toBe("Item do usuário");
    expect(o.modelo_etapas).toBeGreaterThan(1);
  });

  it("editar obra: troca de estado usa o CUB do novo estado; erro não altera nada", () => {
    const s = new Sistema(H);
    s.despachar("obra.criar", { nome: "Casa", padrao: "R1-A", uf_cub: "PB", orcamento_total: "300.000" });
    const o = s.obra!;
    expect(o.valor_m2).toBe(2510.14);
    s.despachar("obra.editar", { nome: "Casa", padrao: "R1-A", uf_cub: "PE", valor_m2: "2.510,14", orcamento_total: "300.000", area_construida: "100" });
    expect([o.uf_cub, o.valor_m2]).toEqual(["PE", 3422.72]);
    const antes = JSON.stringify(o);
    const r = s.despachar("obra.editar", { nome: "Outro nome", bdi: "300", orcamento_total: "500.000" });
    expect(r.ok).toBe(false);
    expect(JSON.stringify(o)).toBe(antes);
  });
});

describe("compras e tarefas", () => {
  it("fluxo de compra com validação de preço", () => {
    const s = novo();
    const o = s.obra!;
    s.despachar("compra.criar", { descricao: "Areia", etapa: "ALV", quantidade: "2", unidade: "m³" });
    const c = o.compras.at(-1)!;
    expect(s.despachar("compra.status", { id: c.id, status: "Aprovada" }).ok).toBe(false);
    s.despachar("compra.preco", { id: c.id, valor_unitario: "135,00", fornecedor: "Depósito" });
    expect(s.despachar("compra.status", { id: c.id, status: "Aprovada" }).ok).toBe(true);
    expect(s.despachar("compra.status", { id: c.id, status: "Entregue" }).ok).toBe(false);
    s.despachar("compra.status", { id: c.id, status: "Pedido feito" });
    expect(s.despachar("compra.remover", { id: c.id }).ok).toBe(false);
  });

  it("tarefa só conclui com checklist completo; desmarcar reabre", () => {
    const s = novo();
    const o = s.obra!;
    s.despachar("tarefa.criar", { titulo: "Teste", itens: "a\nb\n\n" });
    const t = o.tarefas.at(-1)!;
    expect(t.checklist).toHaveLength(2);
    expect(s.despachar("tarefa.status", { id: t.id, status: "Concluída" }).ok).toBe(false);
    for (const i of t.checklist) s.despachar("tarefa.item", { id: t.id, item: i.id });
    expect(t.status).toBe("Em andamento");
    s.despachar("tarefa.status", { id: t.id, status: "Concluída" });
    s.despachar("tarefa.item", { id: t.id, item: t.checklist[0].id });
    expect(t.status).toBe("Em andamento");
  });

  it("lista de materiais gera pedidos com prazo e prioridade", () => {
    const s = novo();
    const o = s.obra!;
    const r = s.despachar("mat.solicitar_etapa", { codigo: "COB" });
    expect(r.ok).toBe(true);
    const pedidos = o.compras.filter((c) => c.material.startsWith("COB:"));
    expect(pedidos.length).toBeGreaterThan(5);
    expect(pedidos.every((c) => c.status === "Solicitada" && c.data_necessidade)).toBe(true);
    expect(s.despachar("mat.solicitar_etapa", { codigo: "COB" }).ok).toBe(false);
  });
});

describe("controle de compras", () => {
  it("salvar é atômico: erro não deixa o item pela metade", () => {
    const o = sv.criarObra({ nome: "A" });
    ct.carregarBase(o);
    const it = o.controle[0];
    ct.salvarItem(o, it.id, { fornecedor_1: "Loja", vista_1: "10" });
    ct.mudarStatus(o, it.id, "Comprado", H);
    const antes = JSON.stringify(it);
    expect(() => ct.salvarItem(o, it.id, { quantidade: "5", fornecedor_1: "", vista_1: "" })).toThrow(ValidacaoErro);
    expect(JSON.stringify(it)).toBe(antes);
  });

  it("cálculos iguais aos da planilha e total sem desvio de arredondamento", () => {
    const o = sv.criarObra({ nome: "A" });
    ct.carregarBase(o);
    expect(ct.resumo(o).base).toBe(253858.66);
    const it = o.controle.find((i) => i.descricao === "Betoneira")!;
    ct.salvarItem(o, it.id, { fornecedor_1: "Loja", vista_1: "4.500", prazo_1: "4.800", forma: "A Prazo", parcelas: "10" });
    expect(totalCompraItem(it)).toBe(4800);
    ct.mudarStatus(o, it.id, "Comprado", H);
    const fluxo = ct.fluxoPagamentos(o, H);
    expect([...fluxo.keys()][0]).toBe("11/2026");
    expect([...fluxo.values()].reduce((a, b) => a + b, 0)).toBeCloseTo(4800, 2);
  });
});

describe("revisão com Claude", () => {
  it("interpreta JSON, texto livre e sugestões inválidas", () => {
    const r = interpretarResposta('```json\n{"resumo":"ok","pontos":[{"nivel":"crítico","titulo":"A"}],"sugestoes_checklist":[{"etapa":"est","texto":"X"},{"etapa":"ZZZ","texto":"Y"}]}\n```', ["EST"]);
    expect(r.pontos[0].nivel).toBe("critico");
    expect(r.sugestoes).toEqual([{ etapa: "EST", texto: "X", adicionado: false }]);
    expect(interpretarResposta("só texto", []).formato_livre).toBe(true);
    expect(() => interpretarResposta("", [])).toThrow(ValidacaoErro);
  });

  it("fluxo completo e resposta atrasada ignorada", () => {
    const s = novo();
    s.despachar("ia.modo", { modo: "chave", final: "abcd1234", chave_permitida: true });
    expect(s.ui.ia_chave_final).toBe("1234");
    s.despachar("ia.revisar", { escopo: "etapa", codigo: "EST" });
    const pedido = s.pedidoIa!;
    expect(pedido.texto).toContain("Revise a etapa EST");
    s.despachar("ia.cancelar");
    expect(s.despachar("ia.resultado", { id: pedido.id, texto: '{"resumo":"x"}' }).alteradas).toEqual([]);
    s.despachar("ia.revisar", { escopo: "obra" });
    const p2 = s.pedidoIa!;
    const r = s.despachar("ia.resultado", { id: p2.id, texto: '{"resumo":"Tudo certo","pontos":[]}' });
    expect(r.alteradas).toEqual([s.obra!.id]);
    expect(s.obra!.revisoes[0].resumo).toBe("Tudo certo");
  });
});

describe("persistência", () => {
  it("lê obras antigas e ignora documentos inválidos", () => {
    const o = sv.criarObra({ nome: "Antiga" });
    const doc = exportarObra(o) as unknown as Record<string, unknown>;
    delete doc.uf_cub;
    delete doc.bdi;
    delete doc.controle;
    (doc as { lixo?: number }).lixo = 1;
    const lida = lerObra(doc);
    expect([lida.uf_cub, lida.bdi, lida.controle]).toEqual(["SP", 0, []]);
    expect("lixo" in lida).toBe(false);
    const s = new Sistema(H);
    const falhas = s.carregar([doc, { id: "x" }, null, "texto"]);
    expect(s.obras.size).toBe(1);
    expect(falhas).toHaveLength(3);
  });

  it("ida e volta pelo JSON mantém tudo", () => {
    const s = novo();
    const o = s.obra!;
    ct.carregarBase(o);
    const copia = lerObra(JSON.parse(JSON.stringify(o)));
    expect(copia).toEqual(o);
  });

  it("ações inválidas não derrubam o sistema", () => {
    const s = novo();
    expect(s.despachar("nao.existe").ok).toBe(false);
    expect(s.ui.erro).toMatch(/desconhecida/);
    expect(s.despachar("ui.aba", { aba: "xyz" }).ok).toBe(false);
    expect(s.despachar("ui.ctrl_status", { status: "xyz" }).ok).toBe(false);
  });
});
