/** Módulos do painel em grade: solicitações, ordens de compra, recebimentos, diário, medição, contatos e insumos. */
import { beforeEach, describe, expect, it } from "vitest";
import * as an from "@/lib/core/analise";
import * as md from "@/lib/core/modulos";
import { lerObra } from "@/lib/core/modelos";
import { Sistema } from "@/lib/core/sistema";

const H = "2026-10-27";
let s: Sistema;
const ok = (acao: string, d: Record<string, unknown> = {}) => {
  const r = s.despachar(acao, d);
  expect(s.ui.erro, `${acao}: ${s.ui.erro}`).toBe("");
  return r;
};
const falha = (acao: string, d: Record<string, unknown>, trecho: string) => {
  const r = s.despachar(acao, d);
  expect(r.ok).toBe(false);
  expect(s.ui.erro).toContain(trecho);
};

beforeEach(() => {
  s = new Sistema(H);
  ok("obra.criar", { nome: "Residência teste", uf_cub: "PB", area_construida: "100", orcamento_total: "200.000", bdi: "25", inicio: "2026-09-01" });
});

describe("navegação e painel em grade", () => {
  it("abre em Início; sem obra só cadastros e obras ficam liberados", () => {
    const v = new Sistema(H);
    expect(v.ui.aba).toBe("inicio");
    expect(v.despachar("ui.aba", { aba: "ordens" }).ok).toBe(false);
    expect(v.despachar("ui.aba", { aba: "contatos" }).ok).toBe(true);
    expect(v.despachar("ui.aba", { aba: "insumos" }).ok).toBe(true);
  });

  it("botões de Compras abrem direto na vista certa", () => {
    ok("ui.aba", { aba: "compras", vista: "materiais" });
    expect([s.ui.aba, s.ui.compras_vista]).toEqual(["compras", "materiais"]);
    falha("ui.aba", { aba: "compras", vista: "x" }, "Vista inválida");
  });

  it("obra antiga (sem os módulos) carrega com listas vazias", () => {
    const o = lerObra({ id: "x", nome: "Antiga", etapas: [] });
    expect([o.solicitacoes, o.ordens, o.recebimentos, o.diario, o.medicoes]).toEqual([[], [], [], [], []]);
  });
});

describe("solicitação → ordem de compra → recebimento", () => {
  it("fluxo completo com entrega parcial e comprometido no orçamento", () => {
    ok("sol.criar", { solicitante: "Mestre", etapa: "ALV", itens: "Bloco cerâmico 9x19x19; 2000; un\nArgamassa; 30; sc", necessario_ate: "2026-11-05" });
    const sol = s.obra!.solicitacoes[0];
    expect([md.numeroSC(sol.numero), sol.status, sol.itens.length]).toEqual(["SC-001", "Aguardando aprovação", 2]);
    falha("oc.criar", { solicitacao: sol.id, fornecedor: "X" }, "aprovadas");
    ok("sol.aprovar", { id: sol.id });
    ok("contato.salvar", { nome: "Cerâmica Paraíba", tipo: "Fornecedor", telefone: "83 9999-0000" });
    const forn = s.cadastros.contatos[0];
    ok("oc.criar", { solicitacao: sol.id, contato: forn.id, fornecedor: "", entrega_prevista: "2026-11-04" });
    const oc = s.obra!.ordens[0];
    expect([s.ui.aba, s.ui.editando, oc.fornecedor, oc.status, sol.status, sol.ordem]).toEqual(["ordens", oc.id, "Cerâmica Paraíba", "Rascunho", "Atendida", oc.id]);
    falha("oc.status", { id: oc.id, status: "Aprovada" }, "preços");
    ok("oc.editar", {
      id: oc.id, fornecedor: "Cerâmica Paraíba", etapa: "ALV", itens: "Bloco cerâmico 9x19x19; 2000; un; 0,85\nArgamassa; 30; sc; 32",
      frete: "150", desconto: "50", condicao_pagamento: "30/60/90 dias", parcelas: "3", entrega_prevista: "2026-11-04",
    });
    expect(md.totalOC(oc)).toBe(2000 * 0.85 + 30 * 32 + 150 - 50);
    const antes = an.resumoFinanceiro(s.obra!).comprometido;
    ok("oc.status", { id: oc.id, status: "Aprovada", aprovador: "Eng. Gustavo" });
    expect(an.resumoFinanceiro(s.obra!).comprometido).toBeCloseTo(antes + 2760, 2);
    falha("oc.receber", { id: oc.id, qtd_0: "2500", qtd_1: "0" }, "acima do saldo");
    ok("oc.receber", { id: oc.id, qtd_0: "1.000", qtd_1: "30", nota_fiscal: "123", conferido_por: "Mestre" });
    expect([oc.status, oc.itens[0].recebido, oc.itens[1].recebido]).toEqual(["Recebida parcialmente", 1000, 30]);
    // frete e desconto rateados pelo valor dos itens recebidos
    expect(an.valorRecebidoOC(oc)).toBeCloseTo(((850 + 960) / 2660) * 2760, 2);
    ok("oc.receber", { id: oc.id, qtd_0: "1000", qtd_1: "0" });
    expect(oc.status).toBe("Recebida");
    s.despachar("oc.remover", { id: oc.id }); // 1º clique pede confirmação
    falha("oc.remover", { id: oc.id }, "Cancele");
  });

  it("cancelar OC sem recebimento devolve a solicitação; com recebimento encerra pelo que chegou", () => {
    ok("sol.criar", { itens: "Cimento; 10; sc" });
    const sol = s.obra!.solicitacoes[0];
    ok("sol.aprovar", { id: sol.id });
    ok("oc.criar", { solicitacao: sol.id, fornecedor: "Depósito A" });
    const oc = s.obra!.ordens[0];
    ok("oc.status", { id: oc.id, status: "Cancelada" });
    expect([sol.status, sol.ordem]).toEqual(["Aprovada", ""]);

    ok("oc.criar", { fornecedor: "Depósito B", itens: "Areia; 6; m³; 120" });
    const oc2 = s.obra!.ordens[1];
    ok("oc.status", { id: oc2.id, status: "Aprovada" });
    ok("oc.receber", { id: oc2.id, qtd_0: "4" });
    ok("oc.status", { id: oc2.id, status: "Cancelada" });
    expect([oc2.status, oc2.itens[0].quantidade, md.totalOC(oc2)]).toEqual(["Recebida", 4, 480]);
  });

  it("excluir pede confirmação (segundo clique)", () => {
    ok("sol.criar", { itens: "Prego; 2; kg" });
    const id = s.obra!.solicitacoes[0].id;
    ok("sol.remover", { id });
    expect([s.ui.confirmar, s.obra!.solicitacoes.length]).toEqual([id, 1]);
    ok("ui.cancelar");
    ok("sol.remover", { id });
    ok("sol.remover", { id });
    expect(s.obra!.solicitacoes.length).toBe(0);
  });

  it("itens digitados: validação de quantidade e valor", () => {
    expect(md.lerItensTexto("Tijolo; 1.500; un; 0,90\n\n; 3\nCal")).toEqual([
      { descricao: "Tijolo", quantidade: 1500, unidade: "un", valor_unitario: 0.9, recebido: 0 },
      { descricao: "Cal", quantidade: 1, unidade: "un", valor_unitario: 0, recebido: 0 },
    ]);
    falha("sol.criar", { itens: "Tijolo; 0; un" }, "maior que zero");
    falha("sol.criar", { itens: "" }, "pelo menos um item");
  });
});

describe("recebimentos (contas a receber)", () => {
  it("parcelas somam o total exato e fim de mês é respeitado", () => {
    ok("rec.parcelas", { total: "250.000,00", parcelas: "3", primeira: "2026-01-31", descricao: "Contrato" });
    const r = s.obra!.recebimentos;
    expect(r.map((x) => x.vencimento)).toEqual(["2026-01-31", "2026-02-28", "2026-03-31"]);
    expect(r.map((x) => x.valor)).toEqual([83333.33, 83333.33, 83333.34]);
    const res = md.resumoRecebimentos(s.obra!, an.precoVenda(s.obra!), H);
    expect([res.contratado, res.previsto, res.sem_parcela, res.n_atrasados]).toEqual([250000, 250000, 0, 3]);
    ok("rec.baixar", { id: r[0].id, recebido_em: "2026-02-02", valor_recebido: "", forma: "PIX" });
    expect([r[0].status, r[0].valor_recebido]).toEqual(["Recebido", 83333.33]);
    ok("rec.remover", { id: r[0].id });
    falha("rec.remover", { id: r[0].id }, "Estorne");
    ok("rec.estornar", { id: r[0].id });
    expect(r[0].status).toBe("Previsto");
  });
});

describe("diário de obra", () => {
  it("um registro por dia, efetivo lido das linhas", () => {
    ok("rdo.salvar", { data: "2026-10-26", clima_manha: "Bom", clima_tarde: "Chuva forte", condicao: "Parcialmente praticável", atividades: "Alvenaria", efetivo: "Pedreiro 3\nServente: 4\nMestre", etapas: "ALV" });
    const d = s.obra!.diario[0];
    expect(d.efetivo).toEqual([{ funcao: "Pedreiro", quantidade: 3 }, { funcao: "Servente", quantidade: 4 }, { funcao: "Mestre", quantidade: 1 }]);
    falha("rdo.salvar", { data: "2026-10-26", atividades: "Outra" }, "Já existe diário");
    ok("rdo.salvar", { id: d.id, data: "2026-10-26", atividades: "Alvenaria e vergas", efetivo: "Pedreiro 2" });
    expect(md.resumoDiario(s.obra!)).toMatchObject({ dias: 1, chuva: 0, homens_dia: 2 });
    falha("rdo.salvar", { data: "2026-10-25", atividades: "" }, "atividades");
    falha("rdo.salvar", { data: "2026-10-25", atividades: "x", etapas: "NAOEXISTE" }, "");
  });
});

describe("medição de obra", () => {
  it("medição → aprovação → parcela com BDI; a seguinte desconta o já medido", () => {
    const o = s.obra!;
    const [e1, e2] = o.etapas;
    ok("med.criar", { periodo_fim: "2026-10-15" });
    const m1 = o.medicoes[0];
    falha("med.criar", {}, "em elaboração");
    ok("med.salvar", { id: m1.id, [`pct_${e1.codigo}`]: "100", [`pct_${e2.codigo}`]: "50" });
    const c1 = md.calcularMedicao(o, m1);
    const esperado = e1.orcamento + e2.orcamento * 0.5;
    expect(c1.total).toBeCloseTo(esperado, 2);
    expect(c1.total_bdi).toBeCloseTo(esperado * 1.25, 1);
    ok("med.aprovar", { id: m1.id, vencimento: "2026-10-30" });
    expect(o.recebimentos).toHaveLength(1);
    expect(o.recebimentos[0]).toMatchObject({ origem: "Medição", medicao: m1.id, valor: c1.total_bdi, vencimento: "2026-10-30" });

    ok("med.criar", {});
    const m2 = o.medicoes[1];
    expect(m2.periodo_inicio).toBe("2026-10-15");
    falha("med.salvar", { id: m2.id, [`pct_${e2.codigo}`]: "40" }, "menor que o já medido");
    falha("med.salvar", { id: m2.id, [`pct_${e2.codigo}`]: "120" }, "acima de 100");
    ok("med.salvar", { id: m2.id, [`pct_${e2.codigo}`]: "80" });
    expect(md.calcularMedicao(o, m2).total).toBeCloseTo(e2.orcamento * 0.3, 2);
    ok("med.aprovar", { id: m2.id, gerar_recebimento: "0" });
    expect(o.recebimentos).toHaveLength(1);
    ok("med.remover", { id: m1.id });
    falha("med.remover", { id: m1.id }, "última");
  });
});

describe("cadastros compartilhados", () => {
  it("contato e insumo marcam os cadastros para gravar; importação não duplica", () => {
    expect(ok("contato.salvar", { nome: "Fulano", tipo: "Funcionário" }).cadastros).toBe(true);
    falha("contato.salvar", { nome: "fulano", tipo: "Funcionário" }, "Já existe");
    falha("contato.salvar", { nome: "Beltrano", email: "x@" }, "E-mail");
    ok("insumo.importar", { origem: "planilha" });
    const n = s.cadastros.insumos.length;
    expect(n).toBeGreaterThan(100);
    ok("insumo.importar", { origem: "planilha" });
    expect(s.cadastros.insumos.length).toBe(n);
    expect(s.ui.msg).toContain("Nenhum insumo novo");
    ok("insumo.importar", { origem: "materiais" });
    expect(s.cadastros.insumos.length).toBeGreaterThan(n);
    const copia = new Sistema(H);
    copia.carregarCadastros(JSON.parse(JSON.stringify(s.cadastros)));
    expect(copia.cadastros).toEqual(s.cadastros);
  });
});
