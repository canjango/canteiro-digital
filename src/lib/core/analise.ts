/** Análise: avanço físico, prazo, custos, compras, tarefas e alertas priorizados. */
import { CATEGORIAS, referenciaCub, rotuloPadrao, valorReferencia } from "./catalogo";
import {
  CATEGORIAS_COMPRA, PRIORIDADES, STATUS_COMPRA, STATUS_TAREFA, etapaDe, totalCompraItem, valorTotalCompra,
  type Compra, type Etapa, type Obra, type Tarefa,
} from "./modelos";
import { arred, dataBr, diasEntre, hojeLocal, moeda, pct, somarDias } from "./util";
import { situacaoMateriais } from "./servicos";
import { programacao } from "./controle";
import { numeroOC, ocComprometida, totalItens, totalOC } from "./modulos";

export const COMPROMETIDAS = ["Aprovada", "Pedido feito", "Entregue"] as const;
export const ABERTAS = ["Solicitada", "Em cotação", "Aprovada", "Pedido feito"] as const;
const comprometida = (s: string) => (COMPROMETIDAS as readonly string[]).includes(s);
const aberta = (s: string) => (ABERTAS as readonly string[]).includes(s);
const ctlComprado = (s: string) => s === "Comprado" || s === "Entregue";

export type NivelAlerta = "critico" | "atencao" | "info";
export interface Alerta {
  nivel: NivelAlerta;
  titulo: string;
  detalhe: string;
  aba: string;
}
const ORDEM_NIVEL: Record<NivelAlerta, number> = { critico: 0, atencao: 1, info: 2 };

export type StatusEtapa = "Concluída" | "Em andamento" | "Liberada" | "Aguardando" | "Atrasada";

// ================================================================ etapas
export function progressoEtapa(e: Etapa): number {
  if (!e.checklist.length) return 0;
  return e.checklist.filter((i) => i.feito).length / e.checklist.length;
}

const etapaFinalConcluida = (o: Obra) => o.etapas.length > 0 && o.etapas.every((e) => e.checklist.length > 0 && e.checklist.every((i) => i.feito));

export const etapaConcluida = (e: Etapa) => e.checklist.length > 0 && e.checklist.every((i) => i.feito);

export function predecessorasPendentes(o: Obra, e: Etapa): string[] {
  const pend: string[] = [];
  for (const cod of e.predecessoras) {
    const p = o.etapas.find((x) => x.codigo === cod);
    if (p && !etapaConcluida(p)) pend.push(cod); // predecessora removida da obra é ignorada
  }
  return pend;
}

export function statusEtapa(o: Obra, e: Etapa, hoje = hojeLocal()): StatusEtapa {
  if (etapaConcluida(e)) return "Concluída";
  const atrasada = Boolean(e.fim_previsto && e.fim_previsto < hoje);
  if (progressoEtapa(e) > 0) return atrasada ? "Atrasada" : "Em andamento";
  if (predecessorasPendentes(o, e).length) return atrasada ? "Atrasada" : "Aguardando";
  return atrasada ? "Atrasada" : "Liberada";
}

/** Quanto da etapa deveria estar pronto hoje, pelo cronograma (linear). */
export function fracaoPrevista(e: Etapa, hoje: string): number {
  const ini = e.inicio_previsto;
  const fim = e.fim_previsto;
  if (!ini || !fim) return 0;
  if (hoje < ini) return 0;
  if (hoje >= fim) return 1;
  return (diasEntre(ini, hoje) + 1) / (diasEntre(ini, fim) + 1);
}

export function progressoFisico(o: Obra): number {
  const peso = o.etapas.reduce((s, e) => s + e.peso, 0);
  if (!peso) return 0;
  return o.etapas.reduce((s, e) => s + e.peso * progressoEtapa(e), 0) / peso;
}

export function progressoPrevisto(o: Obra, hoje = hojeLocal()): number {
  const peso = o.etapas.reduce((s, e) => s + e.peso, 0);
  if (!peso) return 0;
  return o.etapas.reduce((s, e) => s + e.peso * fracaoPrevista(e, hoje), 0) / peso;
}

/** Índice de desempenho de prazo (realizado / previsto); null se ainda não há avanço previsto. */
export function idp(o: Obra, hoje = hojeLocal()): number | null {
  const prev = progressoPrevisto(o, hoje);
  return prev <= 0 ? null : progressoFisico(o) / prev;
}

export interface GrupoFase {
  peso: number;
  feito: number;
  etapas: number;
  orcado: number;
  executado: number;
  progresso: number;
}

export function porCategoriaEtapa(o: Obra): Map<string, GrupoFase> {
  const res = new Map<string, GrupoFase>();
  const novo = (): GrupoFase => ({ peso: 0, feito: 0, etapas: 0, orcado: 0, executado: 0, progresso: 0 });
  for (const c of CATEGORIAS) res.set(c, novo());
  for (const e of o.etapas) {
    if (!res.has(e.categoria)) res.set(e.categoria, novo());
    const g = res.get(e.categoria)!;
    const p = progressoEtapa(e);
    g.peso += e.peso;
    g.feito += e.peso * p;
    g.etapas += 1;
    g.orcado += e.orcamento;
    g.executado += e.orcamento * p;
  }
  for (const g of res.values()) g.progresso = g.peso ? g.feito / g.peso : 0;
  for (const [k, g] of [...res]) if (!g.etapas) res.delete(k);
  return res;
}

// ================================================================ custos
/** Valor do material já recebido de uma ordem de compra (proporcional às quantidades). */
export function valorRecebidoOC(oc: import("./modulos").OrdemCompra): number {
  const bruto = totalItens(oc.itens);
  if (!bruto) return 0;
  const recebido = oc.itens.reduce((s, i) => s + i.recebido * i.valor_unitario, 0);
  return (recebido / bruto) * totalOC(oc);
}

export const comBdi = (o: Obra, valor: number) => arred(valor * (1 + (o.bdi || 0) / 100));
export const precoVenda = (o: Obra) => comBdi(o, o.orcamento_total);

export interface LinhaCusto {
  codigo: string;
  nome: string;
  progresso: number;
  orcado: number;
  executado: number;
  executado_bdi: number;
  a_executar: number;
  comprometido: number;
  realizado: number;
  saldo: number;
  uso: number | null;
}

export function custosPorEtapa(o: Obra): LinhaCusto[] {
  return o.etapas.map((e) => {
    const compras = o.compras.filter((c) => c.etapa === e.codigo);
    const ctl = o.controle.filter((i) => i.etapa === e.codigo);
    const comprometido = compras.filter((c) => comprometida(c.status)).reduce((s, c) => s + valorTotalCompra(c), 0)
      + ctl.filter((i) => ctlComprado(i.status)).reduce((s, i) => s + totalCompraItem(i), 0);
    const ocs = o.ordens.filter((x) => x.etapa === e.codigo && ocComprometida(x));
    const realizado = compras.filter((c) => c.status === "Entregue").reduce((s, c) => s + valorTotalCompra(c), 0)
      + ctl.filter((i) => i.status === "Entregue").reduce((s, i) => s + totalCompraItem(i), 0)
      + ocs.reduce((s, x) => s + valorRecebidoOC(x), 0);
    const comprometidoTotal = comprometido + ocs.reduce((s, x) => s + totalOC(x), 0);
    const prog = progressoEtapa(e);
    const executado = arred(e.orcamento * prog); // medição: orçado × avanço físico
    return {
      codigo: e.codigo,
      nome: e.nome,
      progresso: prog,
      orcado: e.orcamento,
      executado,
      executado_bdi: comBdi(o, executado),
      a_executar: arred(e.orcamento - executado),
      comprometido: arred(comprometidoTotal),
      realizado: arred(realizado),
      saldo: arred(e.orcamento - comprometidoTotal),
      uso: e.orcamento ? comprometidoTotal / e.orcamento : null,
    };
  });
}

export function custosPorCategoria(o: Obra): Map<string, number> {
  const res = new Map<string, number>(CATEGORIAS_COMPRA.map((c) => [c, 0]));
  for (const c of o.compras) {
    if (comprometida(c.status)) res.set(c.categoria, arred((res.get(c.categoria) ?? 0) + valorTotalCompra(c)));
  }
  for (const oc of o.ordens) {
    if (ocComprometida(oc)) res.set("Material", arred((res.get("Material") ?? 0) + totalOC(oc)));
  }
  for (const i of o.controle) {
    if (ctlComprado(i.status)) {
      const cat = i.tipo === "mao_de_obra" ? "Mão de obra" : "Material";
      res.set(cat, arred((res.get(cat) ?? 0) + totalCompraItem(i)));
    }
  }
  return res;
}

export interface ResumoPadrao {
  padrao: string;
  rotulo: string;
  valor_m2: number;
  valor_referencia: number;
  valor_proprio: boolean;
  referencia: string;
  uf: string;
  area: number;
  estimado: number;
  orcado: number;
  orcado_m2: number | null;
  diferenca: number | null;
  bdi: number;
  valor_bdi: number;
  preco_venda: number;
  preco_venda_m2: number | null;
  estimado_com_bdi: number;
}

/** Orçamento × custo pelo padrão (área × R$/m²). Os dois são custo direto; o BDI entra por cima. */
export function resumoPadrao(o: Obra): ResumoPadrao {
  const estimado = arred(o.area_construida * o.valor_m2);
  const orcado = o.orcamento_total;
  const ref = valorReferencia(o.padrao, o.uf_cub);
  const pv = precoVenda(o);
  return {
    padrao: o.padrao,
    rotulo: rotuloPadrao(o.padrao),
    valor_m2: o.valor_m2,
    valor_referencia: ref,
    valor_proprio: o.padrao === "PERS" || Math.abs(o.valor_m2 - ref) >= 0.005,
    referencia: referenciaCub(o.uf_cub),
    uf: o.uf_cub,
    area: o.area_construida,
    estimado,
    orcado,
    orcado_m2: o.area_construida ? arred(orcado / o.area_construida) : null,
    diferenca: estimado && orcado ? orcado / estimado - 1 : null,
    bdi: o.bdi,
    valor_bdi: arred((orcado * o.bdi) / 100),
    preco_venda: pv,
    preco_venda_m2: o.area_construida ? arred(pv / o.area_construida) : null,
    estimado_com_bdi: arred(estimado * (1 + o.bdi / 100)),
  };
}

export interface ResumoFinanceiro {
  orcado: number;
  orcado_etapas: number;
  executado: number;
  a_executar: number;
  executado_pct: number | null;
  comprometido: number;
  realizado: number;
  em_aberto: number;
  saldo: number;
  uso: number | null;
  bdi: number;
  executado_bdi: number;
  preco_venda: number;
}

export function resumoFinanceiro(o: Obra): ResumoFinanceiro {
  const comprometido = o.compras.filter((c) => comprometida(c.status)).reduce((s, c) => s + valorTotalCompra(c), 0)
    + o.controle.filter((i) => ctlComprado(i.status)).reduce((s, i) => s + totalCompraItem(i), 0);
  const realizado = o.compras.filter((c) => c.status === "Entregue").reduce((s, c) => s + valorTotalCompra(c), 0)
    + o.controle.filter((i) => i.status === "Entregue").reduce((s, i) => s + totalCompraItem(i), 0);
  const ocs = o.ordens.filter(ocComprometida);
  const comprometidoOC = ocs.reduce((s, x) => s + totalOC(x), 0);
  const realizadoOC = ocs.reduce((s, x) => s + valorRecebidoOC(x), 0);
  const emAberto = o.compras.filter((c) => c.status === "Solicitada" || c.status === "Em cotação")
    .reduce((s, c) => s + valorTotalCompra(c), 0);
  const orc = o.orcamento_total;
  const executado = o.etapas.reduce((s, e) => s + e.orcamento * progressoEtapa(e), 0);
  const orcadoEtapas = o.etapas.reduce((s, e) => s + e.orcamento, 0);
  return {
    orcado: orc,
    orcado_etapas: arred(orcadoEtapas),
    executado: arred(executado),
    a_executar: arred(orcadoEtapas - executado),
    executado_pct: orcadoEtapas ? executado / orcadoEtapas : null,
    comprometido: arred(comprometido + comprometidoOC),
    realizado: arred(realizado + realizadoOC),
    em_aberto: arred(emAberto),
    saldo: arred(orc - comprometido - comprometidoOC),
    uso: orc ? (comprometido + comprometidoOC) / orc : null,
    bdi: o.bdi,
    executado_bdi: comBdi(o, executado),
    preco_venda: precoVenda(o),
  };
}

// ================================================================ compras e tarefas
export function contagem<T>(itens: T[], campo: keyof T, ordem: readonly string[]): Map<string, number> {
  const res = new Map<string, number>(ordem.map((k) => [k, 0]));
  for (const i of itens) {
    const v = String(i[campo]);
    res.set(v, (res.get(v) ?? 0) + 1);
  }
  return res;
}

export function comprasAtrasadas(o: Obra, hoje = hojeLocal()): Compra[] {
  return o.compras.filter((c) => aberta(c.status) && c.data_necessidade && c.data_necessidade < hoje);
}

/** Compras ainda sem pedido que vencem nos próximos `dias`. */
export function comprasProximas(o: Obra, hoje = hojeLocal(), dias = 7): Compra[] {
  const limite = somarDias(hoje, dias);
  return o.compras.filter(
    (c) => ["Solicitada", "Em cotação", "Aprovada"].includes(c.status) && c.data_necessidade
      && hoje <= c.data_necessidade && c.data_necessidade <= limite,
  );
}

export function tarefasAtrasadas(o: Obra, hoje = hojeLocal()): Tarefa[] {
  return o.tarefas.filter((t) => t.status !== "Concluída" && t.prazo && t.prazo < hoje);
}

export function progressoTarefa(t: Tarefa): number {
  if (t.status === "Concluída") return 1;
  if (!t.checklist.length) return 0;
  return t.checklist.filter((i) => i.feito).length / t.checklist.length;
}

// ================================================================ alertas
export function alertas(o: Obra, hoje = hojeLocal()): Alerta[] {
  const out: Alerta[] = [];
  for (const c of comprasAtrasadas(o, hoje)) {
    const dias = diasEntre(c.data_necessidade, hoje);
    out.push({ nivel: "critico", titulo: `Compra atrasada: ${c.descricao}`, detalhe: `${c.status} · necessária há ${dias} dia(s)`, aba: "compras" });
  }
  for (const c of comprasProximas(o, hoje)) {
    out.push({ nivel: "atencao", titulo: `Comprar até ${dataBr(c.data_necessidade)}: ${c.descricao}`, detalhe: `Situação: ${c.status}`, aba: "compras" });
  }
  for (const t of tarefasAtrasadas(o, hoje)) {
    out.push({
      nivel: t.prioridade === "Alta" || t.prioridade === "Urgente" ? "critico" : "atencao",
      titulo: `Tarefa atrasada: ${t.titulo}`,
      detalhe: `Prazo ${dataBr(t.prazo)} · ${t.responsavel || "sem responsável"}`,
      aba: "tarefas",
    });
  }
  for (const e of o.etapas) {
    const st = statusEtapa(o, e, hoje);
    const pend = predecessorasPendentes(o, e);
    if (progressoEtapa(e) > 0 && pend.length) {
      out.push({ nivel: "atencao", titulo: `${e.nome} iniciada fora de sequência`, detalhe: `Predecessoras pendentes: ${pend.join(", ")}`, aba: "etapas" });
    }
    if (st === "Atrasada") {
      out.push({ nivel: "critico", titulo: `Etapa atrasada: ${e.nome}`, detalhe: `Fim previsto ${dataBr(e.fim_previsto)} · ${pct(progressoEtapa(e))} concluída`, aba: "etapas" });
    }
    const ini = e.inicio_previsto;
    if (ini && hoje <= ini && ini <= somarDias(hoje, 15) && !etapaConcluida(e)) {
      const faltam = situacaoMateriais(o, e.codigo).filter((x) => x.situacao === "Não solicitado").length;
      if (faltam) {
        const dias = diasEntre(hoje, ini);
        out.push({
          nivel: dias <= 7 ? "atencao" : "info",
          titulo: `${e.nome} começa em ${dias} dia(s) com ${faltam} materiais não solicitados`,
          detalhe: "Veja Compras → Lista de materiais",
          aba: "compras",
        });
      }
    }
  }
  if (o.controle.length) {
    const prog = programacao(o, hoje, 7);
    const vencidos = prog.filter(([, d]) => d < hoje);
    if (vencidos.length) {
      out.push({
        nivel: "critico",
        titulo: `Controle de compras: ${vencidos.length} item(ns) com prazo de compra vencido`,
        detalhe: `Ex.: ${vencidos[0][0].descricao} (até ${dataBr(vencidos[0][1])})`,
        aba: "compras",
      });
    }
    const proximos = prog.filter(([, d]) => d >= hoje);
    if (proximos.length) {
      out.push({
        nivel: "atencao",
        titulo: `Controle de compras: ${proximos.length} item(ns) a comprar nos próximos 7 dias`,
        detalhe: `Ex.: ${proximos[0][0].descricao} (até ${dataBr(proximos[0][1])})`,
        aba: "compras",
      });
    }
  }
  // suprimentos e financeiro (módulos)
  const aguardando = o.solicitacoes.filter((x) => x.status === "Aguardando aprovação");
  if (aguardando.length) {
    out.push({ nivel: "atencao", titulo: `${aguardando.length} solicitação(ões) de compra aguardando aprovação`, detalhe: "Aprove ou recuse em Solicitações de compras", aba: "solicitacoes" });
  }
  for (const oc of o.ordens) {
    if (["Aprovada", "Enviada", "Recebida parcialmente"].includes(oc.status) && oc.entrega_prevista && oc.entrega_prevista < hoje) {
      out.push({ nivel: "critico", titulo: `Entrega atrasada: ${numeroOC(oc.numero)} · ${oc.fornecedor}`, detalhe: `Previsto para ${dataBr(oc.entrega_prevista)} · ${oc.status}`, aba: "ordens" });
    }
  }
  const atrasados = o.recebimentos.filter((r) => r.status === "Previsto" && r.vencimento && r.vencimento < hoje);
  if (atrasados.length) {
    const v = atrasados.reduce((s, r) => s + r.valor, 0);
    out.push({ nivel: "critico", titulo: `${atrasados.length} recebimento(s) do cliente em atraso`, detalhe: `${moeda(v)} vencidos · veja Recebimentos`, aba: "recebimentos" });
  }
  if (o.inicio && o.inicio <= hoje && (!o.fim_previsto || hoje <= o.fim_previsto) && !etapaFinalConcluida(o)) {
    const ultimo = o.diario.reduce((m, d) => (d.data > m ? d.data : m), "");
    const dias = ultimo ? diasEntre(ultimo, hoje) : null;
    if (dias === null || dias > 2) {
      out.push({ nivel: "info", titulo: dias === null ? "Diário de obra ainda sem registros" : `Diário de obra sem registro há ${dias} dias`, detalhe: "Registre clima, efetivo e atividades do dia", aba: "diario" });
    }
  }

  for (const l of custosPorEtapa(o)) {
    if (l.orcado && l.comprometido > l.orcado) {
      out.push({ nivel: "critico", titulo: `Estouro de orçamento: ${l.nome}`, detalhe: `Comprometido ${moeda(l.comprometido)} de ${moeda(l.orcado)}`, aba: "compras" });
    }
  }
  const pad = resumoPadrao(o);
  if (pad.diferenca !== null && pad.diferenca < -0.2) {
    out.push({
      nivel: "atencao",
      titulo: `Orçamento ${pct(Math.abs(pad.diferenca))} abaixo do padrão ${pad.rotulo}`,
      detalhe: `${moeda(pad.orcado_m2 ?? 0)}/m² contra ${moeda(pad.valor_m2)}/m² de referência`,
      aba: "obras",
    });
  }
  const indice = idp(o, hoje);
  if (indice !== null && indice < 0.9) {
    out.push({
      nivel: indice < 0.75 ? "critico" : "atencao",
      titulo: "Obra abaixo do previsto",
      detalhe: `Avanço físico ${pct(progressoFisico(o))} contra ${pct(progressoPrevisto(o, hoje))} previsto`,
      aba: "painel",
    });
  }
  // ordenação estável por nível
  return out.map((a, i) => [a, i] as const).sort((x, y) => ORDEM_NIVEL[x[0].nivel] - ORDEM_NIVEL[y[0].nivel] || x[1] - y[1]).map(([a]) => a);
}

export const STATUS_ETAPA_ORDEM: StatusEtapa[] = ["Concluída", "Em andamento", "Liberada", "Aguardando", "Atrasada"];

export function contagemStatusEtapas(o: Obra, hoje: string): Map<StatusEtapa, number> {
  const res = new Map<StatusEtapa, number>(STATUS_ETAPA_ORDEM.map((k) => [k, 0]));
  for (const e of o.etapas) {
    const s = statusEtapa(o, e, hoje);
    res.set(s, (res.get(s) ?? 0) + 1);
  }
  return res;
}

export function resumo(o: Obra, hoje = hojeLocal()) {
  return {
    progresso_fisico: progressoFisico(o),
    progresso_previsto: progressoPrevisto(o, hoje),
    idp: idp(o, hoje),
    financeiro: resumoFinanceiro(o),
    padrao: resumoPadrao(o),
    fases: porCategoriaEtapa(o),
    status_etapas: contagemStatusEtapas(o, hoje),
    compras_status: contagem(o.compras, "status", STATUS_COMPRA),
    tarefas_status: contagem(o.tarefas, "status", STATUS_TAREFA),
    tarefas_prioridade: contagem(o.tarefas.filter((t) => t.status !== "Concluída"), "prioridade", PRIORIDADES),
    custos_categoria: custosPorCategoria(o),
    alertas: alertas(o, hoje),
  };
}

export function nomeEtapa(o: Obra, codigo: string): string {
  try {
    return etapaDe(o, codigo).nome;
  } catch {
    return codigo;
  }
}
