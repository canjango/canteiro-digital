/**
 * Módulos de gestão (referência: fluxo de ERPs de construção como o Mais Controle):
 *
 * - Cadastros (compartilhados entre obras): Contatos e Insumos.
 * - Suprimentos (por obra): Solicitação de compra (canteiro → aprovação) → Ordem de compra
 *   (fornecedor, preços, condição de pagamento, alçada de aprovação) → recebimento do material
 *   (conferência por item, nota fiscal, entrega parcial).
 * - Obra: Diário de obra (RDO: clima, efetivo, equipamentos, atividades, ocorrências) e
 *   Medição de obra (avanço por etapa, valor do período com BDI, aprovação).
 * - Financeiro: Recebimentos (contas a receber do cliente: parcelas do contrato e das medições).
 */
import { lerGestao, type Gestao } from "./gestao";
import { lerDadosProjetos, type DadosProjetos } from "./projetos";
import { etapaDe, type Obra } from "./modelos";
import { ValidacaoErro, arred, lerData, lerNumero, lerOpcao, lerTexto, limparTexto, novoId, somarMeses } from "./util";

// ================================================================ tipos
export const TIPOS_CONTATO = ["Fornecedor", "Prestador de serviço", "Cliente", "Funcionário", "Projetista", "Outro"] as const;
export interface Contato {
  id: string;
  nome: string;
  tipo: (typeof TIPOS_CONTATO)[number];
  documento: string; // CPF ou CNPJ
  telefone: string;
  email: string;
  cidade: string;
  especialidade: string; // o que fornece / função
  observacao: string;
}

export const TIPOS_INSUMO = ["Material", "Mão de obra", "Equipamento", "Serviço"] as const;
export interface Insumo {
  id: string;
  codigo: string;
  descricao: string;
  unidade: string;
  tipo: (typeof TIPOS_INSUMO)[number];
  grupo: string;
  preco: number; // preço de referência por unidade
  fonte: string; // ex.: "Planilha de compras", "Lista de materiais", "Cotação", "SINAPI-PB"
  atualizado_em: string;
}

/** Cadastros compartilhados entre as obras: contatos, insumos, projetos e equipe. */
export interface Cadastros extends Gestao, DadosProjetos {
  contatos: Contato[];
  insumos: Insumo[];
}

export interface ItemPedido {
  descricao: string;
  unidade: string;
  quantidade: number;
  valor_unitario: number; // na solicitação: estimativa; na OC: preço negociado
  recebido: number; // só na OC
}

export const STATUS_SOLICITACAO = ["Aguardando aprovação", "Aprovada", "Atendida", "Recusada"] as const;
export type StatusSolicitacao = (typeof STATUS_SOLICITACAO)[number];
export interface Solicitacao {
  id: string;
  numero: number;
  data: string;
  solicitante: string;
  etapa: string;
  necessario_ate: string;
  prioridade: string;
  itens: ItemPedido[];
  observacao: string;
  status: StatusSolicitacao;
  motivo: string; // motivo da recusa
  ordem: string; // id da OC gerada
}

export const STATUS_OC = ["Rascunho", "Aprovada", "Enviada", "Recebida parcialmente", "Recebida", "Cancelada"] as const;
export type StatusOC = (typeof STATUS_OC)[number];
export const CONDICOES_PAGAMENTO = ["À vista", "Boleto 28 dias", "30/60/90 dias", "Cartão de crédito", "Na entrega", "Outra"] as const;
export interface RecebimentoMaterial {
  data: string;
  nota_fiscal: string;
  quantidades: number[]; // por item da OC
  conferido_por: string;
  observacao: string;
}
export interface OrdemCompra {
  id: string;
  numero: number;
  data: string;
  fornecedor: string;
  contato: string; // id do contato (opcional)
  etapa: string;
  solicitacao: string; // id da solicitação de origem
  itens: ItemPedido[];
  frete: number;
  desconto: number;
  condicao_pagamento: string;
  parcelas: number;
  entrega_prevista: string;
  observacao: string;
  status: StatusOC;
  aprovada_por: string;
  recebimentos: RecebimentoMaterial[];
}

export const STATUS_RECEBIMENTO = ["Previsto", "Recebido"] as const;
export const ORIGENS_RECEBIMENTO = ["Contrato", "Medição", "Adiantamento", "Aditivo", "Outro"] as const;
export interface Recebimento {
  id: string;
  descricao: string;
  origem: (typeof ORIGENS_RECEBIMENTO)[number];
  medicao: string; // id da medição de origem
  vencimento: string;
  valor: number;
  status: (typeof STATUS_RECEBIMENTO)[number];
  recebido_em: string;
  valor_recebido: number;
  forma: string;
  observacao: string;
}

export const CLIMAS = ["Bom", "Nublado", "Chuva fraca", "Chuva forte"] as const;
export const CONDICOES_TRABALHO = ["Praticável", "Parcialmente praticável", "Impraticável"] as const;
export interface Diario {
  id: string;
  data: string;
  clima_manha: string;
  clima_tarde: string;
  condicao: string;
  efetivo: { funcao: string; quantidade: number }[];
  equipamentos: string;
  atividades: string;
  etapas: string[];
  ocorrencias: string;
  observacoes: string;
  responsavel: string;
}

export const STATUS_MEDICAO = ["Em elaboração", "Aprovada"] as const;
export interface Medicao {
  id: string;
  numero: number;
  data: string;
  periodo_inicio: string;
  periodo_fim: string;
  itens: { etapa: string; acumulado: number }[]; // % acumulado medido (0–100)
  observacao: string;
  status: (typeof STATUS_MEDICAO)[number];
  aprovada_em: string;
  recebimento: string; // id da parcela gerada
}

export interface ModulosObra {
  solicitacoes: Solicitacao[];
  ordens: OrdemCompra[];
  recebimentos: Recebimento[];
  diario: Diario[];
  medicoes: Medicao[];
}

// ================================================================ leitura tolerante (dados gravados)
type B = Record<string, unknown>;
const o_ = (v: unknown): B => (v && typeof v === "object" && !Array.isArray(v) ? (v as B) : {});
const l_ = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const t_ = (v: unknown) => (v === null || v === undefined ? "" : String(v));
const n_ = (v: unknown, p = 0) => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : p;
};
const d_ = (v: unknown) => {
  try {
    return lerData(v);
  } catch {
    return "";
  }
};
const op = <T extends string>(v: unknown, ops: readonly T[], p: T): T => (ops.includes(v as T) ? (v as T) : p);

const lerItem = (v: unknown): ItemPedido => {
  const d = o_(v);
  return { descricao: t_(d.descricao), unidade: t_(d.unidade) || "un", quantidade: n_(d.quantidade), valor_unitario: n_(d.valor_unitario), recebido: n_(d.recebido) };
};

export function lerContato(v: unknown): Contato | null {
  const d = o_(v);
  if (!d.nome) return null;
  return {
    id: t_(d.id) || novoId("ctt"), nome: t_(d.nome), tipo: op(d.tipo, TIPOS_CONTATO, "Fornecedor"), documento: t_(d.documento),
    telefone: t_(d.telefone), email: t_(d.email), cidade: t_(d.cidade), especialidade: t_(d.especialidade), observacao: t_(d.observacao),
  };
}

export function lerInsumo(v: unknown): Insumo | null {
  const d = o_(v);
  if (!d.descricao) return null;
  return {
    id: t_(d.id) || novoId("ins"), codigo: t_(d.codigo), descricao: t_(d.descricao), unidade: t_(d.unidade) || "un",
    tipo: op(d.tipo, TIPOS_INSUMO, "Material"), grupo: t_(d.grupo), preco: n_(d.preco), fonte: t_(d.fonte), atualizado_em: d_(d.atualizado_em),
  };
}

export function lerCadastros(v: unknown): Cadastros {
  const d = o_(v);
  return {
    contatos: l_(d.contatos).map(lerContato).filter((x): x is Contato => x !== null),
    insumos: l_(d.insumos).map(lerInsumo).filter((x): x is Insumo => x !== null),
    ...lerGestao(d),
    ...lerDadosProjetos(d),
  };
}

export function lerModulos(d: B): ModulosObra {
  return {
    solicitacoes: l_(d.solicitacoes).map((v) => {
      const s = o_(v);
      return {
        id: t_(s.id) || novoId("sol"), numero: n_(s.numero, 0), data: d_(s.data), solicitante: t_(s.solicitante), etapa: t_(s.etapa),
        necessario_ate: d_(s.necessario_ate), prioridade: t_(s.prioridade) || "Média", itens: l_(s.itens).map(lerItem),
        observacao: t_(s.observacao), status: op(s.status, STATUS_SOLICITACAO, "Aguardando aprovação"), motivo: t_(s.motivo), ordem: t_(s.ordem),
      };
    }),
    ordens: l_(d.ordens).map((v) => {
      const s = o_(v);
      return {
        id: t_(s.id) || novoId("oc"), numero: n_(s.numero, 0), data: d_(s.data), fornecedor: t_(s.fornecedor), contato: t_(s.contato),
        etapa: t_(s.etapa), solicitacao: t_(s.solicitacao), itens: l_(s.itens).map(lerItem), frete: n_(s.frete), desconto: n_(s.desconto),
        condicao_pagamento: t_(s.condicao_pagamento), parcelas: Math.max(0, Math.trunc(n_(s.parcelas))), entrega_prevista: d_(s.entrega_prevista),
        observacao: t_(s.observacao), status: op(s.status, STATUS_OC, "Rascunho"), aprovada_por: t_(s.aprovada_por),
        recebimentos: l_(s.recebimentos).map((r) => {
          const x = o_(r);
          return { data: d_(x.data), nota_fiscal: t_(x.nota_fiscal), quantidades: l_(x.quantidades).map((q) => n_(q)), conferido_por: t_(x.conferido_por), observacao: t_(x.observacao) };
        }),
      };
    }),
    recebimentos: l_(d.recebimentos).map((v) => {
      const s = o_(v);
      return {
        id: t_(s.id) || novoId("rec"), descricao: t_(s.descricao), origem: op(s.origem, ORIGENS_RECEBIMENTO, "Contrato"), medicao: t_(s.medicao),
        vencimento: d_(s.vencimento), valor: n_(s.valor), status: op(s.status, STATUS_RECEBIMENTO, "Previsto"), recebido_em: d_(s.recebido_em),
        valor_recebido: n_(s.valor_recebido), forma: t_(s.forma), observacao: t_(s.observacao),
      };
    }),
    diario: l_(d.diario).map((v) => {
      const s = o_(v);
      return {
        id: t_(s.id) || novoId("rdo"), data: d_(s.data), clima_manha: t_(s.clima_manha), clima_tarde: t_(s.clima_tarde), condicao: t_(s.condicao),
        efetivo: l_(s.efetivo).map((e) => ({ funcao: t_(o_(e).funcao), quantidade: n_(o_(e).quantidade) })),
        equipamentos: t_(s.equipamentos), atividades: t_(s.atividades), etapas: l_(s.etapas).map(t_), ocorrencias: t_(s.ocorrencias),
        observacoes: t_(s.observacoes), responsavel: t_(s.responsavel),
      };
    }),
    medicoes: l_(d.medicoes).map((v) => {
      const s = o_(v);
      return {
        id: t_(s.id) || novoId("med"), numero: n_(s.numero, 0), data: d_(s.data), periodo_inicio: d_(s.periodo_inicio), periodo_fim: d_(s.periodo_fim),
        itens: l_(s.itens).map((i) => ({ etapa: t_(o_(i).etapa), acumulado: n_(o_(i).acumulado) })), observacao: t_(s.observacao),
        status: op(s.status, STATUS_MEDICAO, "Em elaboração"), aprovada_em: d_(s.aprovada_em), recebimento: t_(s.recebimento),
      };
    }),
  };
}

// ================================================================ utilidades
const proximoNumero = (lista: { numero: number }[]) => lista.reduce((m, x) => Math.max(m, x.numero), 0) + 1;
export const numeroSC = (n: number) => `SC-${String(n).padStart(3, "0")}`;
export const numeroOC = (n: number) => `OC-${String(n).padStart(3, "0")}`;
export const numeroMed = (n: number) => `Medição nº ${n}`;
const cortar = (v: unknown, max = 200) => limparTexto(v).slice(0, max);
const textoLongo = (v: unknown, max = 3000) => String(v ?? "").replace(/\r\n/g, "\n").trim().slice(0, max);

export const totalItens = (itens: ItemPedido[]) => itens.reduce((s, i) => s + i.quantidade * i.valor_unitario, 0);
export const totalOC = (oc: OrdemCompra) => arred(totalItens(oc.itens) + oc.frete - oc.desconto);

/** Itens digitados em linhas: "descrição; quantidade; unidade; valor" (valor opcional). */
export function lerItensTexto(texto: unknown, comValor = false): ItemPedido[] {
  const itens: ItemPedido[] = [];
  String(texto ?? "").split(/\r?\n/).forEach((linha, k) => {
    if (!linha.trim()) return;
    const partes = linha.split(";").map((p) => p.trim());
    const descricao = cortar(partes[0]);
    if (!descricao) return;
    const quantidade = partes[1] ? lerNumero(partes[1], `Quantidade (linha ${k + 1})`) : 1;
    if (quantidade <= 0) throw new ValidacaoErro(`Quantidade deve ser maior que zero (linha ${k + 1})`);
    const unidade = cortar(partes[2], 20) || "un";
    const valor = comValor || partes[3] ? lerNumero(partes[3] ?? "", `Valor (linha ${k + 1})`) : 0;
    itens.push({ descricao, quantidade, unidade, valor_unitario: valor, recebido: 0 });
  });
  return itens;
}

export const itensParaTexto = (itens: ItemPedido[], comValor = true) =>
  itens.map((i) => [i.descricao, String(i.quantidade).replace(".", ","), i.unidade, ...(comValor ? [String(i.valor_unitario || "").replace(".", ",")] : [])].join("; ")).join("\n");

// ================================================================ cadastros: contatos
export function salvarContato(c: Cadastros, d: B): Contato {
  const nome = lerTexto(d.nome, "o nome do contato");
  const email = cortar(d.email);
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new ValidacaoErro("E-mail inválido");
  const dados: Omit<Contato, "id"> = {
    nome, tipo: lerOpcao(d.tipo ?? "Fornecedor", TIPOS_CONTATO, "Tipo"), documento: cortar(d.documento, 30), telefone: cortar(d.telefone, 40),
    email, cidade: cortar(d.cidade, 80), especialidade: cortar(d.especialidade), observacao: cortar(d.observacao, 500),
  };
  const id = t_(d.id);
  if (id) {
    const atual = c.contatos.find((x) => x.id === id);
    if (!atual) throw new ValidacaoErro("Contato não encontrado");
    Object.assign(atual, dados);
    return atual;
  }
  if (c.contatos.some((x) => x.nome.toLowerCase() === nome.toLowerCase() && x.tipo === dados.tipo)) {
    throw new ValidacaoErro(`Já existe um ${dados.tipo.toLowerCase()} com o nome “${nome}”`);
  }
  const novo = { id: novoId("ctt"), ...dados };
  c.contatos.push(novo);
  return novo;
}

export function removerContato(c: Cadastros, id: string): Contato {
  const atual = c.contatos.find((x) => x.id === id);
  if (!atual) throw new ValidacaoErro("Contato não encontrado");
  c.contatos = c.contatos.filter((x) => x !== atual);
  return atual;
}

// ================================================================ cadastros: insumos
export function salvarInsumo(c: Cadastros, d: B, hoje: string): Insumo {
  const descricao = lerTexto(d.descricao, "a descrição do insumo");
  const dados: Omit<Insumo, "id"> = {
    codigo: cortar(d.codigo, 30), descricao, unidade: cortar(d.unidade, 20) || "un", tipo: lerOpcao(d.tipo ?? "Material", TIPOS_INSUMO, "Tipo"),
    grupo: cortar(d.grupo, 80), preco: lerNumero(d.preco, "Preço"), fonte: cortar(d.fonte, 80) || "Cadastro manual", atualizado_em: hoje,
  };
  const id = t_(d.id);
  if (id) {
    const atual = c.insumos.find((x) => x.id === id);
    if (!atual) throw new ValidacaoErro("Insumo não encontrado");
    Object.assign(atual, dados);
    return atual;
  }
  const novo = { id: novoId("ins"), ...dados };
  c.insumos.push(novo);
  return novo;
}

export function removerInsumo(c: Cadastros, id: string): Insumo {
  const atual = c.insumos.find((x) => x.id === id);
  if (!atual) throw new ValidacaoErro("Insumo não encontrado");
  c.insumos = c.insumos.filter((x) => x !== atual);
  return atual;
}

/** Importa insumos sem duplicar (mesma descrição e unidade). Retorna quantos entraram. */
export function importarInsumos(c: Cadastros, novos: Omit<Insumo, "id" | "atualizado_em">[], hoje: string): number {
  const chave = (x: { descricao: string; unidade: string }) => `${x.descricao.toLowerCase()}|${x.unidade.toLowerCase()}`;
  const existentes = new Set(c.insumos.map(chave));
  let n = 0;
  for (const x of novos) {
    if (existentes.has(chave(x))) continue;
    existentes.add(chave(x));
    c.insumos.push({ ...x, id: novoId("ins"), atualizado_em: hoje });
    n++;
  }
  return n;
}

// ================================================================ solicitações de compra
export function criarSolicitacao(o: Obra, d: B, hoje: string): Solicitacao {
  const etapa = t_(d.etapa);
  if (etapa) etapaDe(o, etapa);
  const itens = lerItensTexto(d.itens);
  if (!itens.length) throw new ValidacaoErro("Informe pelo menos um item (um por linha: descrição; quantidade; unidade)");
  const s: Solicitacao = {
    id: novoId("sol"), numero: proximoNumero(o.solicitacoes), data: hoje, solicitante: lerTexto(d.solicitante, "o solicitante", false, 80),
    etapa, necessario_ate: lerData(d.necessario_ate), prioridade: lerOpcao(d.prioridade ?? "Média", ["Baixa", "Média", "Alta", "Urgente"], "Prioridade"),
    itens, observacao: textoLongo(d.observacao, 1000), status: "Aguardando aprovação", motivo: "", ordem: "",
  };
  o.solicitacoes.push(s);
  return s;
}

const solicitacaoDe = (o: Obra, id: string) => {
  const s = o.solicitacoes.find((x) => x.id === id);
  if (!s) throw new ValidacaoErro("Solicitação não encontrada");
  return s;
};

export function decidirSolicitacao(o: Obra, id: string, aprovar: boolean, motivo = ""): Solicitacao {
  const s = solicitacaoDe(o, id);
  if (s.status !== "Aguardando aprovação" && !(s.status === "Recusada" && aprovar) && !(s.status === "Aprovada" && !aprovar)) {
    throw new ValidacaoErro(`A solicitação está “${s.status}” e não pode mudar assim`);
  }
  s.status = aprovar ? "Aprovada" : "Recusada";
  s.motivo = aprovar ? "" : cortar(motivo, 300);
  return s;
}

export function removerSolicitacao(o: Obra, id: string): void {
  const s = solicitacaoDe(o, id);
  if (s.status === "Atendida") throw new ValidacaoErro("Solicitação já virou ordem de compra; cancele a OC");
  o.solicitacoes = o.solicitacoes.filter((x) => x !== s);
}

// ================================================================ ordens de compra
export function criarOrdem(o: Obra, c: Cadastros, d: B, hoje: string): OrdemCompra {
  const solId = t_(d.solicitacao);
  const sol = solId ? solicitacaoDe(o, solId) : null;
  if (sol && sol.status !== "Aprovada") throw new ValidacaoErro("Só solicitações aprovadas geram ordem de compra");
  const etapa = t_(d.etapa) || sol?.etapa || "";
  if (etapa) etapaDe(o, etapa);
  const contatoId = t_(d.contato);
  const contato = contatoId ? c.contatos.find((x) => x.id === contatoId) : undefined;
  const fornecedor = cortar(d.fornecedor) || contato?.nome || "";
  if (!fornecedor) throw new ValidacaoErro("Informe o fornecedor");
  const itens = "itens" in d ? lerItensTexto(d.itens, true) : (sol?.itens ?? []).map((i) => ({ ...i, recebido: 0 }));
  if (!itens.length) throw new ValidacaoErro("Informe pelo menos um item (descrição; quantidade; unidade; valor unitário)");
  const oc: OrdemCompra = {
    id: novoId("oc"), numero: proximoNumero(o.ordens), data: hoje, fornecedor, contato: contato?.id ?? "", etapa, solicitacao: sol?.id ?? "",
    itens, frete: lerNumero(d.frete, "Frete"), desconto: lerNumero(d.desconto, "Desconto"),
    condicao_pagamento: cortar(d.condicao_pagamento, 60) || "À vista", parcelas: Math.max(1, Math.trunc(lerNumero(d.parcelas || 1, "Parcelas"))),
    entrega_prevista: lerData(d.entrega_prevista) || sol?.necessario_ate || "", observacao: textoLongo(d.observacao, 1000),
    status: "Rascunho", aprovada_por: "", recebimentos: [],
  };
  if (totalOC(oc) < 0) throw new ValidacaoErro("Desconto maior que o valor da ordem");
  o.ordens.push(oc);
  if (sol) {
    sol.status = "Atendida";
    sol.ordem = oc.id;
  }
  return oc;
}

export const ordemDe = (o: Obra, id: string) => {
  const x = o.ordens.find((y) => y.id === id);
  if (!x) throw new ValidacaoErro("Ordem de compra não encontrada");
  return x;
};

export function editarOrdem(o: Obra, id: string, d: B): OrdemCompra {
  const oc = ordemDe(o, id);
  if (oc.status !== "Rascunho") throw new ValidacaoErro("Só ordens em rascunho podem ser editadas");
  const itens = lerItensTexto(d.itens, true);
  if (!itens.length) throw new ValidacaoErro("Informe pelo menos um item");
  const etapa = t_(d.etapa);
  if (etapa) etapaDe(o, etapa);
  const novo = {
    fornecedor: lerTexto(d.fornecedor, "o fornecedor"), etapa, itens, frete: lerNumero(d.frete, "Frete"), desconto: lerNumero(d.desconto, "Desconto"),
    condicao_pagamento: cortar(d.condicao_pagamento, 60) || "À vista", parcelas: Math.max(1, Math.trunc(lerNumero(d.parcelas || 1, "Parcelas"))),
    entrega_prevista: lerData(d.entrega_prevista), observacao: textoLongo(d.observacao, 1000),
  };
  if (totalItens(itens) + novo.frete - novo.desconto < 0) throw new ValidacaoErro("Desconto maior que o valor da ordem");
  Object.assign(oc, novo);
  return oc;
}

const TRANSICOES_OC: Record<StatusOC, StatusOC[]> = {
  Rascunho: ["Aprovada", "Cancelada"],
  Aprovada: ["Enviada", "Rascunho", "Cancelada"],
  Enviada: ["Cancelada"],
  "Recebida parcialmente": ["Cancelada"],
  Recebida: [],
  Cancelada: ["Rascunho"],
};
export const transicoesOC = (s: StatusOC) => TRANSICOES_OC[s];

export function mudarStatusOrdem(o: Obra, id: string, novo: string, aprovador = ""): OrdemCompra {
  const oc = ordemDe(o, id);
  if (!TRANSICOES_OC[oc.status].includes(novo as StatusOC)) throw new ValidacaoErro(`Não é possível passar de “${oc.status}” para “${novo}”`);
  if (novo === "Aprovada" && totalOC(oc) <= 0) throw new ValidacaoErro("Informe os preços antes de aprovar a ordem");
  if (novo === "Cancelada" && oc.recebimentos.length) {
    // material já entrou: encerra o saldo e a ordem fica como recebida (o que chegou continua comprometido)
    oc.itens.forEach((i) => { i.quantidade = i.recebido; });
    oc.status = "Recebida";
    return oc;
  }
  oc.status = novo as StatusOC;
  if (novo === "Aprovada") oc.aprovada_por = cortar(aprovador, 80);
  if (novo === "Rascunho") oc.aprovada_por = "";
  const sol = oc.solicitacao ? o.solicitacoes.find((s) => s.id === oc.solicitacao) : undefined;
  if (sol && novo === "Cancelada" && !oc.recebimentos.length) {
    sol.status = "Aprovada"; // volta para ser atendida por outra OC
    sol.ordem = "";
  }
  return oc;
}

/** Registra a entrega (total ou parcial) com conferência por item. */
export function receberMaterial(o: Obra, id: string, d: B, hoje: string): OrdemCompra {
  const oc = ordemDe(o, id);
  if (!["Aprovada", "Enviada", "Recebida parcialmente"].includes(oc.status)) {
    throw new ValidacaoErro("Só ordens aprovadas ou enviadas podem receber material");
  }
  const quantidades = oc.itens.map((it, k) => {
    const q = lerNumero(d[`qtd_${k}`] ?? "", `Quantidade recebida (${it.descricao})`);
    if (q > it.quantidade - it.recebido + 1e-9) {
      throw new ValidacaoErro(`“${it.descricao}”: recebido acima do saldo da ordem (${it.quantidade - it.recebido} ${it.unidade})`);
    }
    return q;
  });
  if (!quantidades.some((q) => q > 0)) throw new ValidacaoErro("Informe a quantidade recebida de pelo menos um item");
  const data = lerData(d.data) || hoje;
  oc.recebimentos.push({ data, nota_fiscal: cortar(d.nota_fiscal, 40), quantidades, conferido_por: cortar(d.conferido_por, 80), observacao: cortar(d.observacao, 500) });
  oc.itens.forEach((it, k) => { it.recebido = arred(it.recebido + quantidades[k], 4); });
  oc.status = oc.itens.every((it) => it.recebido >= it.quantidade - 1e-9) ? "Recebida" : "Recebida parcialmente";
  return oc;
}

export function removerOrdem(o: Obra, id: string): void {
  const oc = ordemDe(o, id);
  if (oc.status !== "Rascunho" && oc.status !== "Cancelada") throw new ValidacaoErro("Cancele a ordem antes de excluir");
  if (oc.recebimentos.length) throw new ValidacaoErro("Ordem com material recebido não pode ser excluída");
  const sol = oc.solicitacao ? o.solicitacoes.find((s) => s.id === oc.solicitacao) : undefined;
  if (sol && sol.ordem === oc.id) {
    sol.status = "Aprovada";
    sol.ordem = "";
  }
  o.ordens = o.ordens.filter((x) => x !== oc);
}

/** Ordens que comprometem o orçamento (aprovadas em diante, menos canceladas). */
export const ocComprometida = (oc: OrdemCompra) => ["Aprovada", "Enviada", "Recebida parcialmente", "Recebida"].includes(oc.status);

// ================================================================ recebimentos (contas a receber)
export function criarRecebimento(o: Obra, d: B): Recebimento {
  const valor = lerNumero(d.valor, "Valor");
  if (valor <= 0) throw new ValidacaoErro("Valor deve ser maior que zero");
  const r: Recebimento = {
    id: novoId("rec"), descricao: lerTexto(d.descricao, "a descrição"), origem: lerOpcao(d.origem ?? "Contrato", ORIGENS_RECEBIMENTO, "Origem"),
    medicao: "", vencimento: lerData(d.vencimento), valor: arred(valor), status: "Previsto", recebido_em: "", valor_recebido: 0, forma: "",
    observacao: cortar(d.observacao, 300),
  };
  if (!r.vencimento) throw new ValidacaoErro("Informe o vencimento");
  o.recebimentos.push(r);
  return r;
}

/** Gera N parcelas mensais iguais (centavos que sobram vão para a última). */
export function gerarParcelas(o: Obra, d: B): number {
  const total = lerNumero(d.total, "Valor total");
  const n = Math.trunc(lerNumero(d.parcelas, "Nº de parcelas"));
  const primeira = lerData(d.primeira);
  if (total <= 0) throw new ValidacaoErro("Valor total deve ser maior que zero");
  if (n < 1 || n > 120) throw new ValidacaoErro("Nº de parcelas entre 1 e 120");
  if (!primeira) throw new ValidacaoErro("Informe o vencimento da primeira parcela");
  const base = Math.floor((total / n) * 100) / 100;
  const dia = Number(primeira.slice(8, 10));
  for (let k = 0; k < n; k++) {
    const [a, m] = somarMeses(primeira, k);
    const ultimoDia = new Date(Date.UTC(a, m, 0)).getUTCDate();
    const venc = `${a}-${String(m).padStart(2, "0")}-${String(Math.min(dia, ultimoDia)).padStart(2, "0")}`;
    const valor = k === n - 1 ? arred(total - base * (n - 1)) : base;
    o.recebimentos.push({
      id: novoId("rec"), descricao: `${cortar(d.descricao, 120) || "Parcela do contrato"} ${k + 1}/${n}`, origem: "Contrato", medicao: "",
      vencimento: venc, valor, status: "Previsto", recebido_em: "", valor_recebido: 0, forma: "", observacao: "",
    });
  }
  return n;
}

const recebimentoDe = (o: Obra, id: string) => {
  const r = o.recebimentos.find((x) => x.id === id);
  if (!r) throw new ValidacaoErro("Recebimento não encontrado");
  return r;
};

export function baixarRecebimento(o: Obra, id: string, d: B, hoje: string): Recebimento {
  const r = recebimentoDe(o, id);
  const valor = String(d.valor_recebido ?? "").trim() ? lerNumero(d.valor_recebido, "Valor recebido") : r.valor;
  if (valor <= 0) throw new ValidacaoErro("Valor recebido deve ser maior que zero");
  r.status = "Recebido";
  r.recebido_em = lerData(d.recebido_em) || hoje;
  r.valor_recebido = arred(valor);
  r.forma = cortar(d.forma, 40);
  return r;
}

export function estornarRecebimento(o: Obra, id: string): Recebimento {
  const r = recebimentoDe(o, id);
  Object.assign(r, { status: "Previsto", recebido_em: "", valor_recebido: 0, forma: "" });
  return r;
}

export function removerRecebimento(o: Obra, id: string): void {
  const r = recebimentoDe(o, id);
  if (r.status === "Recebido") throw new ValidacaoErro("Estorne o recebimento antes de excluir");
  const m = r.medicao ? o.medicoes.find((x) => x.id === r.medicao) : undefined;
  if (m) m.recebimento = "";
  o.recebimentos = o.recebimentos.filter((x) => x !== r);
}

export function resumoRecebimentos(o: Obra, contratado: number, hoje: string) {
  const previsto = o.recebimentos.reduce((s, r) => s + r.valor, 0);
  const recebido = o.recebimentos.filter((r) => r.status === "Recebido").reduce((s, r) => s + r.valor_recebido, 0);
  const atrasados = o.recebimentos.filter((r) => r.status === "Previsto" && r.vencimento && r.vencimento < hoje);
  return {
    contratado: arred(contratado),
    previsto: arred(previsto),
    recebido: arred(recebido),
    a_receber: arred(o.recebimentos.filter((r) => r.status === "Previsto").reduce((s, r) => s + r.valor, 0)),
    atrasado: arred(atrasados.reduce((s, r) => s + r.valor, 0)),
    n_atrasados: atrasados.length,
    sem_parcela: arred(Math.max(0, contratado - previsto)),
  };
}

// ================================================================ diário de obra (RDO)
export function salvarDiario(o: Obra, d: B): Diario {
  const data = lerData(d.data);
  if (!data) throw new ValidacaoErro("Informe a data do diário");
  const efetivo: Diario["efetivo"] = [];
  String(d.efetivo ?? "").split(/\r?\n/).forEach((linha) => {
    if (!linha.trim()) return;
    const m = /^(.*?)[;:\s]+(\d+(?:[.,]\d+)?)\s*$/.exec(linha.trim());
    if (m) efetivo.push({ funcao: cortar(m[1], 60) || "Profissional", quantidade: lerNumero(m[2], "Quantidade") });
    else efetivo.push({ funcao: cortar(linha, 60), quantidade: 1 });
  });
  const etapas = String(d.etapas ?? "").split(",").map((x) => x.trim()).filter(Boolean);
  for (const e of etapas) etapaDe(o, e);
  const dados: Omit<Diario, "id"> = {
    data, clima_manha: lerOpcao(d.clima_manha || "Bom", CLIMAS, "Clima (manhã)"), clima_tarde: lerOpcao(d.clima_tarde || "Bom", CLIMAS, "Clima (tarde)"),
    condicao: lerOpcao(d.condicao || "Praticável", CONDICOES_TRABALHO, "Condição"), efetivo, equipamentos: textoLongo(d.equipamentos, 1000),
    atividades: textoLongo(d.atividades), etapas, ocorrencias: textoLongo(d.ocorrencias), observacoes: textoLongo(d.observacoes, 1000),
    responsavel: cortar(d.responsavel, 80),
  };
  if (!dados.atividades) throw new ValidacaoErro("Descreva as atividades do dia");
  const id = t_(d.id);
  const mesmoDia = o.diario.find((x) => x.data === data && x.id !== id);
  if (mesmoDia) throw new ValidacaoErro(`Já existe diário em ${data.split("-").reverse().join("/")}; edite o registro existente`);
  if (id) {
    const atual = o.diario.find((x) => x.id === id);
    if (!atual) throw new ValidacaoErro("Diário não encontrado");
    Object.assign(atual, dados);
    return atual;
  }
  const novo = { id: novoId("rdo"), ...dados };
  o.diario.push(novo);
  return novo;
}

export function removerDiario(o: Obra, id: string): void {
  if (!o.diario.some((x) => x.id === id)) throw new ValidacaoErro("Diário não encontrado");
  o.diario = o.diario.filter((x) => x.id !== id);
}

export function resumoDiario(o: Obra) {
  const dias = o.diario.length;
  const chuva = o.diario.filter((x) => x.clima_manha.startsWith("Chuva") || x.clima_tarde.startsWith("Chuva")).length;
  const impraticaveis = o.diario.filter((x) => x.condicao === "Impraticável").length;
  const homensDia = o.diario.reduce((s, x) => s + x.efetivo.reduce((a, e) => a + e.quantidade, 0), 0);
  return { dias, chuva, impraticaveis, homens_dia: homensDia, media_efetivo: dias ? homensDia / dias : 0 };
}

// ================================================================ medição de obra
const medicaoDe = (o: Obra, id: string) => {
  const m = o.medicoes.find((x) => x.id === id);
  if (!m) throw new ValidacaoErro("Medição não encontrada");
  return m;
};

/** % acumulado da última medição aprovada antes desta (por etapa). */
export function acumuladoAnterior(o: Obra, m: Medicao | null): Map<string, number> {
  const anteriores = o.medicoes.filter((x) => x.status === "Aprovada" && (!m || x.numero < m.numero)).sort((a, b) => b.numero - a.numero);
  const res = new Map<string, number>();
  const ultima = anteriores[0];
  if (ultima) for (const i of ultima.itens) res.set(i.etapa, i.acumulado);
  return res;
}

export function criarMedicao(o: Obra, d: B, hoje: string, avancoAtual: (codigo: string) => number): Medicao {
  if (o.medicoes.some((x) => x.status === "Em elaboração")) throw new ValidacaoErro("Já existe uma medição em elaboração; aprove ou exclua antes");
  const anterior = acumuladoAnterior(o, null);
  const ultima = [...o.medicoes].sort((a, b) => b.numero - a.numero)[0];
  const ini = lerData(d.periodo_inicio) || (ultima?.periodo_fim ? ultima.periodo_fim : o.inicio) || hoje;
  const fim = lerData(d.periodo_fim) || hoje;
  if (fim < ini) throw new ValidacaoErro("O fim do período não pode ser antes do início");
  const m: Medicao = {
    id: novoId("med"), numero: proximoNumero(o.medicoes), data: hoje, periodo_inicio: ini, periodo_fim: fim,
    // sugestão: avanço do checklist, nunca abaixo do já medido
    itens: o.etapas.map((e) => ({ etapa: e.codigo, acumulado: Math.max(anterior.get(e.codigo) ?? 0, arred(avancoAtual(e.codigo) * 100, 1)) })),
    observacao: "", status: "Em elaboração", aprovada_em: "", recebimento: "",
  };
  o.medicoes.push(m);
  return m;
}

export function salvarMedicao(o: Obra, id: string, d: B): Medicao {
  const m = medicaoDe(o, id);
  if (m.status !== "Em elaboração") throw new ValidacaoErro("Medição aprovada não pode ser alterada");
  const anterior = acumuladoAnterior(o, m);
  const itens = m.itens.map((i) => {
    const campo = `pct_${i.etapa}`;
    if (!(campo in d)) return { ...i };
    const v = lerNumero(d[campo], `% acumulado (${i.etapa})`);
    if (v > 100) throw new ValidacaoErro(`${i.etapa}: % acumulado acima de 100`);
    const ant = anterior.get(i.etapa) ?? 0;
    if (v < ant - 1e-9) throw new ValidacaoErro(`${i.etapa}: acumulado (${v}%) menor que o já medido (${ant}%)`);
    return { etapa: i.etapa, acumulado: arred(v, 1) };
  });
  const ini = lerData(d.periodo_inicio) || m.periodo_inicio;
  const fim = lerData(d.periodo_fim) || m.periodo_fim;
  if (fim < ini) throw new ValidacaoErro("O fim do período não pode ser antes do início");
  Object.assign(m, { itens, periodo_inicio: ini, periodo_fim: fim, observacao: textoLongo(d.observacao ?? m.observacao, 1000) });
  return m;
}

export interface LinhaMedicao {
  etapa: string;
  nome: string;
  orcado: number;
  anterior: number;
  acumulado: number;
  periodo: number; // % do período
  valor: number; // valor do período (custo direto)
}

export function calcularMedicao(o: Obra, m: Medicao): { linhas: LinhaMedicao[]; total: number; total_bdi: number; acumulado: number } {
  const anterior = acumuladoAnterior(o, m);
  const linhas = m.itens.map((i) => {
    const e = o.etapas.find((x) => x.codigo === i.etapa);
    const orcado = e?.orcamento ?? 0;
    const ant = anterior.get(i.etapa) ?? 0;
    const periodo = Math.max(0, i.acumulado - ant);
    return { etapa: i.etapa, nome: e?.nome ?? i.etapa, orcado, anterior: ant, acumulado: i.acumulado, periodo, valor: (orcado * periodo) / 100 };
  });
  const total = arred(linhas.reduce((s, l) => s + l.valor, 0));
  const acumulado = arred(linhas.reduce((s, l) => s + (l.orcado * l.acumulado) / 100, 0));
  return { linhas, total, total_bdi: arred(total * (1 + (o.bdi || 0) / 100)), acumulado };
}

/** Aprova a medição e gera a parcela a receber (valor do período com BDI). */
export function aprovarMedicao(o: Obra, id: string, d: B, hoje: string): Medicao {
  const m = medicaoDe(o, id);
  if (m.status !== "Em elaboração") throw new ValidacaoErro("Medição já aprovada");
  const { total_bdi } = calcularMedicao(o, m);
  m.status = "Aprovada";
  m.aprovada_em = hoje;
  if (total_bdi > 0 && String(d.gerar_recebimento ?? "1") === "1") {
    const venc = lerData(d.vencimento) || hoje;
    const r: Recebimento = {
      id: novoId("rec"), descricao: `${numeroMed(m.numero)} (${m.periodo_inicio.split("-").reverse().join("/")} a ${m.periodo_fim.split("-").reverse().join("/")})`,
      origem: "Medição", medicao: m.id, vencimento: venc, valor: total_bdi, status: "Previsto", recebido_em: "", valor_recebido: 0, forma: "",
      observacao: "",
    };
    o.recebimentos.push(r);
    m.recebimento = r.id;
  }
  return m;
}

export function removerMedicao(o: Obra, id: string): void {
  const m = medicaoDe(o, id);
  const ultima = [...o.medicoes].sort((a, b) => b.numero - a.numero)[0];
  if (m.status === "Aprovada" && ultima !== m) throw new ValidacaoErro("Só a última medição aprovada pode ser excluída");
  const r = m.recebimento ? o.recebimentos.find((x) => x.id === m.recebimento) : undefined;
  if (r && r.status === "Recebido") throw new ValidacaoErro("A parcela desta medição já foi recebida; estorne antes");
  if (r) o.recebimentos = o.recebimentos.filter((x) => x !== r);
  o.medicoes = o.medicoes.filter((x) => x !== m);
}

