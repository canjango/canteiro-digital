/** Testes de regressão dos bugs identificados na revisão (docs/REVISAO.md). */
import { describe, expect, it } from "vitest";
import * as ct from "@/lib/core/controle";
import * as sv from "@/lib/core/servicos";
import { fornecedorItem } from "@/lib/core/modelos";
import { Sistema } from "@/lib/core/sistema";
import { arred } from "@/lib/core/util";

const H = "2026-10-27";

describe("bugs corrigidos", () => {
  it("1 · total base igual ao da planilha (sem desvio de centavo)", () => {
    const o = sv.criarObra({ nome: "A" });
    ct.carregarBase(o);
    const r = ct.resumo(o);
    expect([r.base, r.base_materiais, r.base_mao_obra]).toEqual([253858.66, 167642.21, 86216.45]);
  });

  it("2 · escolha da cotação respeita a linha mesmo com linha vazia no meio", () => {
    const o = sv.criarObra({ nome: "A" });
    ct.carregarBase(o);
    const it = o.controle[0];
    ct.salvarItem(o, it.id, { fornecedor_1: "A", vista_1: "10", fornecedor_2: "", vista_2: "", fornecedor_3: "C", vista_3: "50", escolhida: "2" });
    expect(fornecedorItem(it)).toBe("C");
    ct.salvarItem(o, it.id, { fornecedor_1: "", vista_1: "", fornecedor_2: "B", vista_2: "20", escolhida: "1" });
    expect(fornecedorItem(it)).toBe("B");
    ct.salvarItem(o, it.id, { fornecedor_1: "A", vista_1: "10", escolhida: "2" }); // linha vazia escolhida → automático
    expect(fornecedorItem(it)).toBe("A");
  });

  it("3 · editar a obra mantém o valor por m² próprio; trocar estado ou padrão volta ao CUB", () => {
    const s = new Sistema(H);
    s.despachar("obra.criar", { nome: "A", padrao: "R1-N", uf_cub: "PB", valor_m2: "2.500" });
    const o = s.obra!;
    const base = { padrao: "R1-N", uf_cub: "PB", valor_m2: "2.500,00", orcamento_total: String(o.orcamento_total), area_construida: "100" };
    s.despachar("obra.editar", { ...base, nome: "A renomeada" });
    expect(o.valor_m2).toBe(2500);
    s.despachar("obra.editar", { ...base, nome: "A", uf_cub: "PE" });
    expect(o.valor_m2).toBe(2795.91);
    s.despachar("obra.editar", { ...base, nome: "A", uf_cub: "PE", valor_m2: "2.795,91", padrao: "R1-A" });
    expect(o.valor_m2).toBe(3422.72);
    s.despachar("obra.editar", { ...base, nome: "A", uf_cub: "PE", padrao: "R1-A", valor_m2: "" });
    expect(o.valor_m2).toBe(3422.72);
  });

  it("4 · orçamento em branco na edição estima pela área × m² (não zera)", () => {
    const s = new Sistema(H);
    s.despachar("obra.criar", { nome: "A", orcamento_total: "200.000", uf_cub: "PB" });
    s.despachar("obra.editar", { nome: "A", orcamento_total: "", uf_cub: "PB", area_construida: "100" });
    expect(s.obra!.orcamento_total).toBe(203727);
    expect(s.obra!.etapas.every((e) => e.orcamento > 0)).toBe(true);
  });

  it("5 · orçamento 0,00 no cadastro estima pela área × m²", () => {
    expect(sv.criarObra({ nome: "A", orcamento_total: "0,00", uf_cub: "PB" }).orcamento_total).toBe(203727);
  });

  it("6 · arredondamento simétrico e sem ruído binário", () => {
    expect([arred(2.675), arred(-2.675), arred(1.005), arred(-1.005), arred(0.125), arred(-0.125)])
      .toEqual([2.68, -2.68, 1.01, -1.01, 0.13, -0.13]);
    expect(arred(253858.6552)).toBe(253858.66);
  });

  it("11 · cancelar a remoção não fecha o item", () => {
    const s = new Sistema(H);
    s.despachar("obra.criar", { nome: "A" });
    s.despachar("ctrl.carregar", { ajustar: "0" });
    const id = s.obra!.controle[0].id;
    s.despachar("ui.ctrl_item", { id });
    s.despachar("ctrl.remover", { id });
    expect(s.ui.ctrl_excluir).toBe(id);
    s.despachar("ui.ctrl_cancelar_remocao");
    expect([s.ui.ctrl_excluir, s.ui.ctrl_item]).toEqual(["", id]);
  });
});
