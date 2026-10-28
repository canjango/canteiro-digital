/**
 * Equivalência com a versão anterior (Python): os números de referência em golden.json
 * foram gerados pelo núcleo antigo com a mesma obra de exemplo e a mesma data.
 */
import { describe, expect, it } from "vitest";
import golden from "./golden.json";
import * as an from "@/lib/core/analise";
import * as ct from "@/lib/core/controle";
import * as sv from "@/lib/core/servicos";
import { montarPedido } from "@/lib/core/assistente";
import { obraExemplo } from "@/lib/core/sistema";

const H = "2026-10-27";
const perto = (a: number, b: number, tol = 0.011) => expect(Math.abs(a - b)).toBeLessThanOrEqual(tol);

describe("obra de exemplo", () => {
  const o = obraExemplo(H);
  const r = an.resumo(o, H);

  it("cronograma, orçamento e status por etapa", () => {
    expect(o.etapas.map((e) => e.codigo)).toEqual(golden.etapas.map((e) => e.codigo));
    o.etapas.forEach((e, i) => {
      const g = golden.etapas[i];
      expect([e.inicio_previsto, e.fim_previsto]).toEqual([g.ini, g.fim]);
      perto(e.orcamento, g.orc);
      expect(an.statusEtapa(o, e, H)).toBe(g.status);
      perto(an.progressoEtapa(e), g.prog, 1e-6);
    });
  });

  it("indicadores gerais", () => {
    perto(r.progresso_fisico, golden.progresso_fisico, 1e-6);
    perto(r.progresso_previsto, golden.progresso_previsto, 1e-6);
    perto(r.idp!, golden.idp, 1e-6);
    for (const [k, v] of Object.entries(golden.financeiro)) {
      if (typeof v === "number") perto((r.financeiro as unknown as Record<string, number>)[k], v, 1e-4);
    }
    for (const [k, v] of Object.entries(golden.padrao)) {
      const atual = (r.padrao as unknown as Record<string, unknown>)[k];
      if (typeof v === "number") perto(atual as number, v, 1e-4);
      else expect(atual).toEqual(v);
    }
    expect(Object.fromEntries(r.status_etapas)).toEqual(golden.status_etapas);
    expect(Object.fromEntries([...r.custos_categoria].map(([k, v]) => [k, v]))).toEqual(golden.custos_categoria);
    for (const [cat, g] of Object.entries(golden.fases)) {
      const f = r.fases.get(cat)!;
      perto(f.progresso, (g as { progresso: number }).progresso, 1e-6);
      perto(f.executado, (g as { executado: number }).executado, 1e-4);
    }
  });

  it("alertas iguais (mesma ordem e texto)", () => {
    expect(r.alertas.map((a) => [a.nivel, a.titulo, a.detalhe, a.aba])).toEqual(golden.alertas);
  });

  it("custos por etapa", () => {
    an.custosPorEtapa(o).forEach((l, i) => {
      const g = golden.custos_etapa[i] as unknown as Record<string, number | string | null>;
      for (const k of ["orcado", "executado", "executado_bdi", "a_executar", "comprometido", "realizado", "saldo"]) {
        perto((l as unknown as Record<string, number>)[k], g[k] as number);
      }
    });
  });

  it("lista de materiais por etapa", () => {
    for (const e of o.etapas) {
      const linhas = sv.situacaoMateriais(o, e.codigo).map((x) => [x.chave, x.material, x.necessario, x.pedido, x.faltante, x.situacao]);
      expect(linhas).toEqual((golden.materiais as Record<string, unknown[]>)[e.codigo]);
    }
  });

  it("pedido de revisão para a Claude tem os mesmos dados", () => {
    const dados = (t: string) => JSON.parse(t.split("\nDADOS:\n")[1]);
    expect(dados(montarPedido(o, "obra", "", "custo", H))).toEqual(dados(golden.pedido_obra));
    expect(dados(montarPedido(o, "etapa", "EST", "", H))).toEqual(dados(golden.pedido_etapa));
    expect(montarPedido(o, "obra", "", "custo", H).split("\nDADOS:\n")[0]).toBe(golden.pedido_obra.split("\nDADOS:\n")[0]);
  });
});

describe("controle de compras", () => {
  it("obra Azeneildo (PB, médio/alto) com a base da planilha", () => {
    const o = sv.criarObra({ nome: "Azeneildo", area_construida: "100,68", inicio: "2026-11-03", fim_previsto: "2027-04-15", uf_cub: "PB", padrao: "R1-MA" });
    // médio/alto PB = (2037,27 + 2510,14) / 2 = 2273,705 → 2273,71. O Python arredondava para 2273,70
    // por erro de ponto flutuante; aqui o arredondamento é o comercial (correção intencional).
    perto(golden.o2.valor_m2, 2273.7);
    expect(o.valor_m2).toBe(2273.71);
    perto(o.orcamento_total, Math.round(100.68 * 2273.71 * 100) / 100);
    expect(o.etapas.map((e) => [e.codigo, e.inicio_previsto, e.fim_previsto])).toEqual(golden.o2.etapas);
    ct.carregarBase(o);
    const r = ct.resumo(o);
    const g = golden.ctl_resumo as Record<string, unknown>;
    for (const k of ["itens", "base_materiais", "base_mao_obra", "base", "compra", "comprado", "base_cotada", "qtd_estimada", "a_prazo"]) {
      perto((r as unknown as Record<string, number>)[k], g[k] as number);
    }
    expect(Object.fromEntries(r.status)).toEqual(g.status);
    expect(ct.programacao(o, H, 30).map(([i, d]) => [i.descricao, d])).toEqual(golden.ctl_prog);
    expect(o.controle.map((i) => i.etapa)).toEqual(golden.ctl_etapas);
  });

  it("ajuste por área e lista de materiais em padrão personalizado", () => {
    const o = sv.criarObra({ nome: "Casa 150", area_construida: "150", padrao: "PERS", valor_m2: "2.300", uf_cub: "PB" });
    ct.carregarBase(o, true);
    o.controle.forEach((i, k) => perto(i.quantidade, golden.o3_qtds[k]));
    for (const [c, linhas] of Object.entries(golden.o3_mat)) {
      expect(sv.situacaoMateriais(o, c).map((x) => [x.chave, x.material, x.necessario])).toEqual(linhas);
    }
  });
});
