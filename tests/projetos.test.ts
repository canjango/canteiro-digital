/** Gestão de projetos: tipos de obra, honorários, fases e regras, horas, parcelas, licitações (Lei 14.133). */
import { beforeEach, describe, expect, it } from "vitest";
import * as pj from "@/lib/core/projetos";
import * as pz from "@/lib/core/prazos";
import * as md from "@/lib/core/modulos";
import { valorReferencia } from "@/lib/core/catalogo";
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
  ok("proj.salvar", { nome: "Residência Silva", cliente: "Silva", tipo_obra: "Residência unifamiliar", padrao: "Alto padrão", area: "300", inicio: "2026-11-02", entrega: "2027-05-03", ...d });
  return g().projetos.at(-1)!;
};
beforeEach(() => { s = new Sistema(H); });

describe("prazos em dias úteis (Lei 14.133)", () => {
  it("Páscoa e feriados nacionais", () => {
    expect(pz.pascoa(2026)).toBe("2026-04-05");
    expect(pz.pascoa(2027)).toBe("2027-03-28");
    expect(pz.diaUtil("2026-11-20")).toBe(false); // Consciência Negra
    expect(pz.diaUtil("2026-04-03")).toBe(false); // sexta-feira santa
    expect(pz.diaUtil("2026-02-16")).toBe(false); // carnaval: ao recuar, não conta
    expect(pz.diaUtil("2026-02-16", true)).toBe(true); // ao avançar, conta (lado seguro)
    expect(pz.diaUtil("2026-10-30")).toBe(true);
  });
  it("impugnação 3 dias úteis antes, recurso 3 dias úteis depois", () => {
    // abertura qui 26/11/2026: recua 25 (qua), 24 (ter), 23 (seg) → 23/11
    expect(pz.limiteImpugnacao("2026-11-26")).toBe("2026-11-23");
    // abertura seg 23/11: recua sex 20 (feriado) → 19, 18, 17
    expect(pz.limiteImpugnacao("2026-11-23")).toBe("2026-11-17");
    // ata na sexta 30/10: seg 2/11 é feriado → 3, 4, 5
    expect(pz.limiteRecurso("2026-10-30")).toBe("2026-11-05");
    expect(pz.diasUteisEntre("2026-11-02", "2026-11-06")).toBe(4);
  });
  it("prazo mínimo de publicação (art. 55)", () => {
    expect(pz.prazoMinimoPublicacao("Técnica e preço", "Serviço comum")?.dias).toBe(35);
    expect(pz.prazoMinimoPublicacao("Menor preço", "Serviço comum")?.dias).toBe(10);
    expect(pz.prazoMinimoPublicacao("Menor preço", "Serviço especial")?.dias).toBe(25);
    expect(pz.prazoMinimoPublicacao("Maior desconto", "Contratação integrada")?.dias).toBe(60);
  });
});

describe("tipos de obra, categorias e modelos de fases", () => {
  it("categoria vem do tipo de obra e o modelo de fases do tipo/origem", () => {
    expect(pj.categoriaDoTipo("Interiores corporativo")).toBe("Interiores");
    expect(pj.modeloSugerido("Interiores", "Interiores corporativo", "Cliente particular")).toBe("Interiores");
    expect(pj.modeloSugerido("Residencial", "Edifício residencial", "Licitação pública")).toBe("Edificação pública (licitação)");
    expect(pj.modeloSugerido("Reforma e regularização", "Regularização / legalização", "Cliente particular")).toBe("Regularização / laudo");
    for (const [nome, pesos] of Object.entries(pj.MODELOS_FASES)) expect(Object.values(pesos).reduce((a, b) => a + b, 0), nome).toBe(100);
  });
  it("projeto público inclui Projeto Básico; particular não", () => {
    const pub = novo({ nome: "Escola", tipo_obra: "Escola / educação", padrao: "Público", origem: "Licitação pública" });
    const priv = novo({ nome: "Casa" });
    expect(pub.fases.map((f) => f.codigo)).toContain("PB");
    expect(priv.fases.map((f) => f.codigo)).not.toContain("PB");
    expect([pub.categoria, priv.categoria]).toEqual(["Institucional e público", "Residencial"]);
    expect(priv.codigo).toBe("PRJ-2026-002");
  });
});

describe("honorários", () => {
  it("percentual do custo da obra pelo CUB do padrão", () => {
    const p = novo();
    const cub = valorReferencia("R1-A", "PB");
    expect(p.honorarios.custo_m2).toBe(cub);
    expect(pj.custoObraEstimado(p)).toBeCloseTo(300 * cub, 2);
    expect(pj.honorarioBase(p)).toBeCloseTo(300 * cub * 0.08, 2); // regra: alto padrão 8%
    expect(p.revisoes_incluidas).toBe(3);
  });
  it("por m², fixo com desconto e custo do serviço (horas × K)", () => {
    expect(pj.honorarioBase(novo({ metodo: "Valor por m²", valor_m2: "120" }))).toBe(36000);
    expect(pj.honorarioBase(novo({ metodo: "Valor fixo", valor_fixo: "50.000", desconto: "10" }))).toBe(45000);
    const k = pj.fatorK(pj.REGRAS_PADRAO.k);
    expect(k).toBeCloseTo(1 * 1.25 * 1.2 * 1.11, 6);
    expect(pj.honorarioBase(novo({ metodo: "Custo do serviço (horas × K)", horas_estimadas: "400", custo_hora: "80" }))).toBeCloseTo(400 * 80 * k, 2);
    falha("proj.salvar", { nome: "X", metodo: "Valor fixo" }, "valor fixo");
    falha("proj.salvar", { nome: "X", metodo: "Percentual do custo da obra", area: "0" }, "área");
    falha("proj.salvar", { nome: "X", metodo: "Valor fixo", valor_fixo: "100", desconto: "120" }, "entre 0 e 100");
  });
  it("valor das fases fecha exatamente o total e as parcelas também", () => {
    const p = novo({ metodo: "Valor fixo", valor_fixo: "33.333,33" });
    const soma = p.fases.reduce((acc, f) => acc + pj.valorFase(p, f.codigo), 0);
    expect(Math.abs(soma - 33333.33)).toBeLessThan(0.05);
    ok("proj.parcelas", { id: p.id, sinal: "10" });
    expect(p.parcelas[0]).toMatchObject({ descricao: "Sinal na assinatura", valor: 3333.33 });
    expect(Math.round(p.parcelas.reduce((a, x) => a + x.valor, 0) * 100) / 100).toBe(33333.33);
    expect(p.parcelas.slice(1).every((x) => x.vencimento)).toBe(true);
    ok("proj.parcela_status", { id: p.id, pid: p.parcelas[0].id, status: "Recebida", data: "2026-11-03" });
    falha("proj.parcelas", { id: p.id }, "faturadas/recebidas");
    expect(pj.resultado(p, H)).toMatchObject({ recebido: 3333.33, sem_parcela: 0 });
  });
  it("aditivo soma ao contratado e às horas", () => {
    const p = novo({ metodo: "Valor fixo", valor_fixo: "20000", horas_estimadas: "100" });
    expect(pj.horasOrcadas(p)).toBe(100);
    ok("proj.aditivo", { id: p.id, descricao: "Revisões extras", valor: "3.000", horas: "20" });
    expect([pj.honorarioTotal(p), pj.horasOrcadas(p)]).toEqual([23000, 120]);
  });
});

describe("fases e regras", () => {
  it("pesos precisam fechar 100% e fases com uso não saem", () => {
    const p = novo();
    falha("proj.fases", { id: p.id, peso_LV: "50" }, "somam");
    ok("proj.fase_add", { id: p.id, codigo: "AO" });
    expect(pj.somaPesos(p)).toBe(100); // AO entra com 0
    ok("proj.fases", { id: p.id, peso_PE: "30", peso_AO: "5" });
    expect(pj.somaPesos(p)).toBe(100);
    ok("proj.horas", { id: p.id, fase: "LV", pessoa: "Ana", horas: "2" });
    falha("proj.fase_rem", { id: p.id, codigo: "LV" }, "não pode ser removida");
  });
  it("regra: sem aprovação do cliente no EP não conclui as fases seguintes", () => {
    const p = novo();
    ok("proj.fase", { id: p.id, codigo: "EP" }); // conclui LV, PN, EV, EP
    expect(p.fases.slice(0, 4).every((f) => f.concluida_em === H)).toBe(true);
    falha("proj.fase", { id: p.id, codigo: "AP" }, "aprovação do cliente");
    falha("proj.aprovar", { id: p.id, codigo: "AP" }, "Conclua a fase");
    ok("proj.aprovar", { id: p.id, codigo: "EP", por: "Sr. Silva" });
    ok("proj.fase", { id: p.id, codigo: "AP" });
    expect(pj.faseAtual(p).fase?.codigo).toBe("PE");
    // desligar a regra libera
    ok("regras.salvar", { bloquear_sem_aprovacao: "0" });
    ok("proj.fase", { id: p.id, codigo: "CO" });
    expect(p.status).toBe("Concluído");
    // reabrir volta o status e limpa aprovação dali em diante
    ok("proj.fase", { id: p.id, codigo: "AP" });
    expect([p.status, p.fases.find((f) => f.codigo === "AP")!.concluida_em]).toEqual(["Em andamento", ""]);
  });
  it("revisões acima do contrato geram alerta", () => {
    const p = novo({ padrao: "Econômico", metodo: "Valor fixo", valor_fixo: "10000" });
    expect(p.revisoes_incluidas).toBe(1);
    ok("proj.revisao", { id: p.id, codigo: "EP" });
    ok("proj.revisao", { id: p.id, codigo: "EP" });
    expect(pj.alertasProjeto(p, g().regras, H).some((a) => a.titulo.includes("além do contrato"))).toBe(true);
  });
});

describe("horas, avanço e resultado", () => {
  it("custo/hora vem da equipe; margem e custo previsto (EAC)", () => {
    ok("eq.salvar", { nome: "Thamyris", funcao: "Arquiteto(a)", custo_dia: "640", obra: "" }); // 80/h
    const m = g().equipe[0];
    const p = novo({ metodo: "Valor fixo", valor_fixo: "100.000", horas_estimadas: "500" });
    ok("proj.horas", { id: p.id, fase: "LV", membro: m.id, horas: "10" });
    ok("proj.horas", { id: p.id, fase: "LV", pessoa: "Freelancer", horas: "5" }); // custo padrão 80
    expect(pj.custoHoras(p)).toBe(15 * 80);
    falha("proj.horas", { id: p.id, fase: "LV", pessoa: "X", horas: "30" }, "entre 0 e 24");
    falha("proj.horas", { id: p.id, fase: "LV", pessoa: "X", horas: "2", data: "2027-01-01" }, "futuro");
    ok("proj.fase", { id: p.id, codigo: "LV" }); // LV = 5% concluído
    const r = pj.resultado(p, H);
    expect(r.agregado).toBe(5000);
    expect(r.margem).toBeCloseTo((5000 - 1200) / 5000, 6);
    expect(r.custo_previsto).toBeNull(); // avanço de 5% ainda não projeta
    ok("proj.fase", { id: p.id, codigo: "EV" }); // 15%
    const r2 = pj.resultado(p, H);
    expect(r2.custo_previsto).toBeCloseTo(1200 / 0.15, 2);
  });
  it("entregáveis aprovados contam no avanço da fase atual; revisão incrementa", () => {
    const p = novo({ metodo: "Valor fixo", valor_fixo: "10000" });
    ok("proj.entregaveis_sugeridos", { id: p.id, codigo: "AP" });
    const aps = p.entregaveis.filter((e) => e.fase === "AP");
    expect(aps.length).toBe(3);
    ok("proj.entregavel_status", { id: p.id, eid: aps[0].id, status: "Aprovado" });
    const f = p.fases.find((x) => x.codigo === "AP")!;
    expect(pj.avancoFase(p, f)).toBeCloseTo((1 / 3) * 0.9, 6);
    ok("proj.entregavel_revisar", { id: p.id, eid: aps[0].id });
    expect([aps[0].revisao, aps[0].status]).toEqual([1, "Em revisão interna"]);
  });
  it("horas acima do alerta e estouro", () => {
    const p = novo({ metodo: "Valor fixo", valor_fixo: "10000", horas_estimadas: "100" });
    const lv = p.fases.find((f) => f.codigo === "LV")!; // 5 h orçadas
    expect(lv.horas_orcadas).toBe(5);
    ok("proj.horas", { id: p.id, fase: "LV", pessoa: "Ana", horas: "4" });
    expect(pj.alertasProjeto(p, g().regras, H).some((a) => a.nivel === "atencao" && a.titulo.includes("80%"))).toBe(true);
    ok("proj.horas", { id: p.id, fase: "LV", pessoa: "Ana", horas: "2" });
    expect(pj.alertasProjeto(p, g().regras, H).some((a) => a.nivel === "critico" && a.titulo.includes("estourou"))).toBe(true);
  });
});

describe("propostas, licitações e documentos", () => {
  it("licitação: checklist, prazos, garantias e conversão em projeto", () => {
    ok("doc.padrao");
    const fgts = g().documentos.find((d) => d.nome.includes("FGTS"))!;
    ok("doc.salvar", { id: fgts.id, nome: fgts.nome, grupo: fgts.grupo, emissao: "2026-10-01", validade: "2026-10-31" });
    ok("opo.salvar", {
      tipo: "Licitação", titulo: "Projeto da UBS Centro", cliente: "Prefeitura de João Pessoa", tipo_obra: "Unidade de saúde", area: "800",
      valor_estimado: "250.000", valor_proposta: "212.500", modalidade: "Concorrência", criterio: "Técnica e preço", objeto: "Serviço especial",
      publicacao: "2026-10-26", abertura: "2026-11-26", garantia_proposta: "2", etapa: "Em preparação",
    });
    const o = g().oportunidades[0];
    expect(o.documentos.length).toBe(g().documentos.length);
    const pzs = pj.prazosLicitacao(o);
    expect(pzs.impugnacao).toBe("2026-11-23");
    expect(pzs.prazo_irregular).toBe(true); // < 35 dias úteis
    expect(pzs.desconto).toBeCloseTo(15, 6);
    expect(pzs.garantia_proposta_valor).toBe(5000);
    const al = pj.alertasOportunidade(o, g().documentos, g().regras, H).map((a) => a.titulo);
    expect(al.some((t) => t.includes("abaixo do mínimo"))).toBe(true);
    expect(al.some((t) => t.includes("acima de 1%"))).toBe(true);
    expect(al.some((t) => t.includes("FGTS") && t.includes("vencida"))).toBe(true);
    falha("opo.projeto", { id: o.id }, "homologadas");
    ok("opo.etapa", { id: o.id, etapa: "Homologada" });
    ok("opo.projeto", { id: o.id });
    const p = g().projetos[0];
    expect([p.origem, p.categoria, pj.honorarioBase(p), p.fases.some((f) => f.codigo === "PB"), o.projeto, s.ui.editando]).toEqual(
      ["Licitação pública", "Institucional e público", 212500, true, p.id, p.id],
    );
    falha("opo.projeto", { id: o.id }, "já gerou");
  });
  it("proposta particular: funil, probabilidade e conversão", () => {
    ok("opo.salvar", { tipo: "Proposta", titulo: "Casa de praia Cabedelo", cliente: "Lima", tipo_obra: "Casa de praia / campo", area: "250", probabilidade: "60" });
    const o = g().oportunidades[0];
    falha("opo.etapa", { id: o.id, etapa: "Proposta enviada" }, "valor da proposta");
    ok("opo.salvar", { id: o.id, tipo: "Proposta", titulo: o.titulo, tipo_obra: o.tipo_obra, area: "250", valor_proposta: "45.000", probabilidade: "60" });
    ok("opo.etapa", { id: o.id, etapa: "Proposta enviada" });
    const r = pj.resumoGeral(g(), H);
    expect([r.em_disputa, r.ponderado]).toEqual([45000, 27000]);
    ok("opo.etapa", { id: o.id, etapa: "Ganha" });
    expect(pj.resumoGeral(g(), H).conversao).toBe(1);
    ok("opo.projeto", { id: o.id });
    expect(g().projetos[0].padrao).toBe("Alto padrão");
    falha("opo.salvar", { tipo: "Licitação", titulo: "X", publicacao: "2026-11-10", abertura: "2026-11-01" }, "antes da publicação");
    falha("opo.salvar", { tipo: "Proposta", titulo: "X", link: "javascript:alert(1)" }, "http");
  });
  it("documentos: situação pela validade", () => {
    const d: pj.DocumentoEmpresa = { id: "d", nome: "CND", grupo: "Fiscal, social e trabalhista", emissao: "2026-05-01", validade: "2026-11-03", observacao: "" };
    expect(pj.situacaoDocumento(d, H, 7)).toBe("Vence em breve");
    expect(pj.situacaoDocumento(d, "2026-11-04", 7)).toBe("Vencido");
    expect(pj.situacaoDocumento({ ...d, validade: "" }, H, 7)).toBe("Sem validade");
  });
});

describe("correções da revisão como usuário novo", () => {
  it("projeto sem datas: aviso e distribuição de prazos e vencimentos", () => {
    const p = novo({ metodo: "Valor fixo", valor_fixo: "30000", inicio: "", entrega: "" });
    expect(p.fases.every((f) => !f.prazo)).toBe(true);
    expect(pj.alertasProjeto(p, g().regras, H).some((a) => a.titulo.includes("sem início ou entrega"))).toBe(true);
    ok("proj.parcelas", { id: p.id, sinal: "0" });
    expect(s.ui.msg).toContain("sem vencimento");
    falha("proj.datas", { id: p.id, inicio: "2026-11-01", entrega: "2026-10-01" }, "depois do início");
    ok("proj.datas", { id: p.id, inicio: "2026-11-02", entrega: "2027-04-30" });
    expect(p.fases.at(-1)!.prazo).toBe("2027-04-30");
    expect(p.parcelas.every((x) => x.vencimento)).toBe(true);
    expect(p.parcelas.at(-1)!.vencimento).toBe("2027-04-30");
  });
  it("uma pessoa não passa de 24 h no mesmo dia, somando projetos", () => {
    const a = novo({ nome: "A", metodo: "Valor fixo", valor_fixo: "1000" });
    const b = novo({ nome: "B", metodo: "Valor fixo", valor_fixo: "1000" });
    ok("proj.horas", { id: a.id, fase: "LV", pessoa: "Ana", horas: "14", data: H });
    falha("proj.horas", { id: b.id, fase: "LV", pessoa: "ana", horas: "11", data: H }, "24 h");
    ok("proj.horas", { id: b.id, fase: "LV", pessoa: "Ana", horas: "10", data: H });
  });
  it("projeto concluído com parcela atrasada continua avisando", () => {
    const p = novo({ metodo: "Valor fixo", valor_fixo: "10000" });
    ok("proj.parcela", { id: p.id, descricao: "Final", valor: "10000", vencimento: "2026-10-01" });
    ok("regras.salvar", { bloquear_sem_aprovacao: "0" });
    ok("proj.fase", { id: p.id, codigo: "CO" });
    expect(p.status).toBe("Concluído");
    expect(pj.alertasProjeto(p, g().regras, H).map((a) => a.titulo).join()).toContain("em atraso");
  });
  it("poucas horas lançadas para o avanço gera aviso de margem superestimada", () => {
    const p = novo({ metodo: "Valor fixo", valor_fixo: "10000", horas_estimadas: "200" });
    ok("regras.salvar", { bloquear_sem_aprovacao: "0" });
    ok("proj.fase", { id: p.id, codigo: "AP" }); // 55%
    expect(pj.alertasProjeto(p, g().regras, H).some((a) => a.titulo.includes("poucas horas"))).toBe(true);
  });
});

describe("regras do escritório e compatibilidade", () => {
  it("regras validadas e aplicadas nos novos projetos", () => {
    falha("regras.salvar", { "m_Interiores_LV": "50" }, "somam");
    ok("regras.salvar", { pct_Alto_padrão: "10", rev_Alto_padrão: "4", custo_hora_padrao: "95" });
    const p = novo();
    expect([p.honorarios.percentual, p.revisoes_incluidas, p.honorarios.custo_hora]).toEqual([10, 4, 95]);
    ok("regras.restaurar");
    expect(g().regras.percentual_padrao["Alto padrão"]).toBe(8);
  });
  it("projeto da versão anterior (7 fases por nome, honorário numérico) é convertido", () => {
    const c = md.lerCadastros({
      projetos: [{ nome: "Antigo", honorarios: 18000, fases: [
        { fase: "Levantamento e briefing", prazo: "2026-11-01", concluida_em: "2026-10-01" }, { fase: "Estudo preliminar" }, { fase: "Anteprojeto" },
        { fase: "Projeto legal (aprovação)" }, { fase: "Projeto executivo" }, { fase: "Compatibilização" }, { fase: "Detalhamento e entrega" },
      ] }],
    });
    const p = c.projetos[0];
    expect(p.fases.map((f) => f.codigo)).toEqual(["LV", "EP", "AP", "PE", "CO"]);
    expect(p.fases[0].concluida_em).toBe("2026-10-01");
    expect([p.honorarios.metodo, pj.honorarioBase(p)]).toEqual(["Valor fixo", 18000]);
    expect(pj.somaPesos(p)).toBeGreaterThan(0);
  });
});
