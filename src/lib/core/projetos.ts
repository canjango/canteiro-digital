/**
 * Gestão de projetos para escritório de arquitetura (alto padrão e licitações), sem React.
 *
 * Referências: fases de serviço técnico de arquitetura (LV, PN, EV, EP, AP, PB, PE, CO — CAU/NBR 16636),
 * honorários por fase e consumo de horas (modelo de escritórios como Monograph/BQE), remuneração pelo custo
 * do serviço PV = custo × K (Modalidade 02 da tabela do CAU) e prazos da Lei 14.133/2021.
 * Percentuais e pesos sugeridos são REGRAS EDITÁVEIS do escritório (não são a tabela oficial do CAU).
 */
import { valorReferencia } from "./catalogo";
import type { Obra } from "./modelos";
import * as pz from "./prazos";
import * as px from "./projetos-extra";
import { ValidacaoErro, arred, diasEntre, lerData, lerNumero, lerOpcao, lerTexto, limparTexto, novoId, somarDias } from "./util";

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
const cortar = (v: unknown, max = 200) => limparTexto(v).slice(0, max);
const longo = (v: unknown, max = 3000) => String(v ?? "").replace(/\r\n/g, "\n").trim().slice(0, max);
const pctLer = (v: unknown, nome: string, max = 100) => {
  const x = lerNumero(v, nome);
  if (x < 0 || x > max) throw new ValidacaoErro(`${nome}: use um valor entre 0 e ${max}%`);
  return x;
};

// ================================================================ catálogo: tipos de obra, categorias e padrões
export const CATEGORIAS_OBRA: Record<string, readonly string[]> = {
  Residencial: ["Residência unifamiliar", "Casa em condomínio", "Casa de praia / campo", "Edifício residencial"],
  Interiores: ["Interiores residencial", "Interiores corporativo", "Interiores comercial / varejo"],
  "Comercial e corporativo": ["Loja / varejo", "Escritório / corporativo", "Restaurante / gastronomia", "Hotel / pousada"],
  "Institucional e público": ["Escola / educação", "Unidade de saúde", "Edifício público / administrativo", "Equipamento esportivo ou cultural"],
  "Urbanismo e paisagismo": ["Paisagismo", "Praça / urbanização", "Loteamento / condomínio"],
  "Reforma e regularização": ["Reforma / retrofit", "Regularização / legalização", "Laudo / vistoria técnica"],
  Industrial: ["Galpão / industrial", "Centro logístico"],
};
export const CATEGORIAS = Object.keys(CATEGORIAS_OBRA);
export const TIPOS_OBRA = Object.values(CATEGORIAS_OBRA).flat();
export const categoriaDoTipo = (tipo: string) => CATEGORIAS.find((c) => CATEGORIAS_OBRA[c].includes(tipo)) ?? "Residencial";

export const PADROES_PROJETO = ["Alto padrão", "Médio padrão", "Econômico", "Público"] as const;
export type PadraoProjeto = (typeof PADROES_PROJETO)[number];
/** Padrão do projeto → padrão CUB usado para estimar o custo da obra (base do % de honorários). */
export const CUB_DO_PADRAO: Record<PadraoProjeto, string> = { "Alto padrão": "R1-A", "Médio padrão": "R1-N", Econômico: "R1-B", Público: "R1-N" };
export const ORIGENS = ["Cliente particular", "Indicação", "Licitação pública", "Concurso"] as const;
export const STATUS_PROJETO = ["Em andamento", "Aguardando cliente", "Pausado", "Concluído", "Cancelado"] as const;
export const DISCIPLINAS = [
  "Arquitetura", "Interiores", "Luminotécnico", "Paisagismo", "Estrutural", "Fundações", "Elétrico", "Hidrossanitário",
  "Climatização", "Incêndio (PPCI)", "Acessibilidade", "Orçamento", "Compatibilização", "Outro",
] as const;
export const STATUS_ENTREGAVEL = ["Em elaboração", "Em revisão interna", "Enviado ao cliente", "Aprovado", "Emitido p/ obra"] as const;
export const METODOS_HONORARIO = ["Percentual do custo da obra", "Valor por m²", "Valor fixo", "Custo do serviço (horas × K)"] as const;
export type MetodoHonorario = (typeof METODOS_HONORARIO)[number];

// ================================================================ fases
export interface FaseCatalogo { codigo: string; nome: string; descricao: string }
export const FASES: FaseCatalogo[] = [
  { codigo: "LV", nome: "Levantamento de dados", descricao: "Terreno, legislação, levantamento planialtimétrico e cadastral" },
  { codigo: "PN", nome: "Programa de necessidades", descricao: "Briefing, ambientes, áreas e expectativas do cliente" },
  { codigo: "EV", nome: "Estudo de viabilidade", descricao: "Potencial construtivo, custos e alternativas" },
  { codigo: "EP", nome: "Estudo preliminar", descricao: "Partido arquitetônico, implantação, volumetria e plantas" },
  { codigo: "AP", nome: "Anteprojeto e projeto legal", descricao: "Solução definida, compatibilizada com complementares; aprovação na prefeitura" },
  { codigo: "PB", nome: "Projeto básico", descricao: "Nível de detalhe para licitar a obra (Lei 14.133, art. 6º, XXV)" },
  { codigo: "PE", nome: "Projeto para execução", descricao: "Executivo, detalhamentos, memoriais e quantitativos" },
  { codigo: "CO", nome: "Coordenação e compatibilização", descricao: "Compatibilização das disciplinas e coordenação de projetistas" },
  { codigo: "AO", nome: "Assistência à execução da obra", descricao: "Visitas, esclarecimentos e as built" },
];
export const faseCatalogo = (codigo: string) => FASES.find((f) => f.codigo === codigo);

/** Modelos de fases por tipo de trabalho, com distribuição sugerida dos honorários (%). Editáveis nas regras. */
export const MODELOS_FASES: Record<string, Record<string, number>> = {
  "Edificação particular": { LV: 5, PN: 5, EV: 5, EP: 15, AP: 25, PE: 35, CO: 10 },
  "Edificação pública (licitação)": { LV: 5, PN: 5, EV: 5, EP: 15, AP: 20, PB: 15, PE: 25, CO: 10 },
  Interiores: { LV: 5, PN: 5, EP: 20, AP: 25, PE: 35, AO: 10 },
  "Paisagismo e urbanismo": { LV: 10, PN: 10, EP: 20, AP: 25, PE: 35 },
  "Regularização / laudo": { LV: 30, AP: 70 },
};
export function modeloSugerido(categoria: string, tipo: string, origem: string): string {
  if (categoria === "Interiores") return "Interiores";
  if (categoria === "Urbanismo e paisagismo") return "Paisagismo e urbanismo";
  if (tipo === "Regularização / legalização" || tipo === "Laudo / vistoria técnica") return "Regularização / laudo";
  if (origem === "Licitação pública" || categoria === "Institucional e público") return "Edificação pública (licitação)";
  return "Edificação particular";
}

export interface Fase {
  codigo: string;
  peso: number; // % dos honorários
  horas_orcadas: number;
  inicio: string;
  prazo: string;
  concluida_em: string;
  aprovada_em: string; // aprovação do cliente
  aprovado_por: string;
  revisoes: number; // rodadas de revisão já feitas
}

export interface Entregavel {
  id: string;
  fase: string;
  disciplina: string;
  titulo: string;
  revisao: number; // R00, R01…
  status: (typeof STATUS_ENTREGAVEL)[number];
  responsavel: string;
  data: string; // última emissão
}

export interface LancamentoHoras {
  id: string;
  data: string;
  pessoa: string; // nome (vem da equipe quando houver)
  membro: string; // id da equipe ("" = avulso)
  fase: string;
  horas: number;
  custo_hora: number; // congelado no lançamento
  descricao: string;
}

export interface Parcela {
  id: string;
  descricao: string;
  fase: string; // "" = sinal / avulsa
  valor: number;
  vencimento: string;
  status: "Prevista" | "Faturada" | "Recebida";
  recebido_em: string;
}

export interface Aditivo {
  id: string;
  data: string;
  descricao: string;
  valor: number;
  horas: number;
}

export interface Honorarios {
  metodo: MetodoHonorario;
  percentual: number; // % do custo da obra
  custo_m2: number; // custo estimado da obra por m² (CUB do padrão por padrão)
  valor_m2: number; // honorário por m²
  valor_fixo: number;
  horas_estimadas: number;
  custo_hora: number;
  k: { encargos: number; indiretas: number; lucro: number; impostos: number }; // % (Modalidade 02 CAU)
  desconto: number; // %
}

export interface Projeto extends px.ExtrasProjeto {
  id: string;
  codigo: string;
  nome: string;
  cliente: string;
  categoria: string;
  tipo_obra: string;
  padrao: PadraoProjeto;
  origem: (typeof ORIGENS)[number];
  oportunidade: string; // proposta/licitação de origem
  endereco: string;
  uf: string;
  area: number;
  responsavel: string;
  inicio: string;
  entrega: string;
  status: (typeof STATUS_PROJETO)[number];
  modelo: string;
  honorarios: Honorarios;
  revisoes_incluidas: number;
  fases: Fase[];
  entregaveis: Entregavel[];
  horas: LancamentoHoras[];
  parcelas: Parcela[];
  aditivos: Aditivo[];
  observacao: string;
  obra: string;
  criado_em: string;
}

// ================================================================ oportunidades: propostas particulares e licitações
export const ETAPAS_PROPOSTA = ["Prospecção", "Proposta em elaboração", "Proposta enviada", "Negociação", "Ganha", "Perdida"] as const;
export const ETAPAS_LICITACAO = [
  "Análise do edital", "Em preparação", "Proposta enviada", "Sessão / julgamento", "Habilitação", "Recurso", "Homologada", "Perdida", "Desistência",
] as const;
export const FINAIS = ["Ganha", "Perdida", "Homologada", "Desistência"];
export const GANHAS = ["Ganha", "Homologada"];

export interface DocLicitacao {
  documento: string; // id do documento da empresa ("" = específico do edital)
  nome: string;
  ok: boolean;
}

export interface Oportunidade {
  id: string;
  tipo: "Proposta" | "Licitação";
  titulo: string;
  cliente: string; // cliente ou órgão
  categoria: string;
  tipo_obra: string;
  padrao: PadraoProjeto;
  area: number;
  valor_estimado: number; // valor de referência (edital) ou expectativa
  valor_proposta: number;
  etapa: string;
  probabilidade: number; // %
  responsavel: string;
  contato: string;
  data: string; // criada / recebida
  validade: string; // validade da proposta
  // licitação
  orgao_uasg: string;
  edital: string;
  processo: string;
  modalidade: string;
  criterio: string;
  objeto: string;
  plataforma: string;
  link: string;
  publicacao: string;
  abertura: string; // data da sessão / entrega das propostas
  intimacao: string; // data da ata/intimação do resultado (conta prazo de recurso)
  garantia_proposta: number; // %
  garantia_contrato: number; // %
  documentos: DocLicitacao[];
  classificacao: number; // posição final (0 = sem)
  motivo: string; // motivo da perda/desistência
  observacao: string;
  projeto: string; // projeto gerado
}

// ================================================================ documentos de habilitação da empresa
export const GRUPOS_DOC = ["Habilitação jurídica", "Fiscal, social e trabalhista", "Econômico-financeira", "Qualificação técnica", "Declarações"] as const;
/** Documentos usuais (Lei 14.133, arts. 66 a 69). Validade: a impressa em cada certidão. */
export const DOCS_PADRAO: { nome: string; grupo: (typeof GRUPOS_DOC)[number]; dica: string }[] = [
  { nome: "Contrato social e alterações", grupo: "Habilitação jurídica", dica: "sem validade; manter consolidado" },
  { nome: "Cartão CNPJ", grupo: "Fiscal, social e trabalhista", dica: "emitir atualizado" },
  { nome: "CND federal (Receita/PGFN, inclui INSS)", grupo: "Fiscal, social e trabalhista", dica: "normalmente 180 dias" },
  { nome: "Certificado de regularidade do FGTS (CRF)", grupo: "Fiscal, social e trabalhista", dica: "normalmente 30 dias" },
  { nome: "Certidão negativa de débitos trabalhistas (CNDT)", grupo: "Fiscal, social e trabalhista", dica: "normalmente 180 dias" },
  { nome: "Certidão estadual", grupo: "Fiscal, social e trabalhista", dica: "conforme a SEFAZ" },
  { nome: "Certidão municipal", grupo: "Fiscal, social e trabalhista", dica: "conforme a prefeitura" },
  { nome: "Certidão de falência e recuperação judicial", grupo: "Econômico-financeira", dica: "conforme o tribunal" },
  { nome: "Balanço patrimonial do último exercício", grupo: "Econômico-financeira", dica: "renovar a cada exercício" },
  { nome: "Registro da empresa no CAU (PJ)", grupo: "Qualificação técnica", dica: "anuidade em dia" },
  { nome: "Certidões de acervo técnico (CAT) / atestados", grupo: "Qualificação técnica", dica: "sem validade" },
  { nome: "Declarações (menor, inexistência de fato impeditivo etc.)", grupo: "Declarações", dica: "assinar para cada edital" },
];

export interface DocumentoEmpresa {
  id: string;
  nome: string;
  grupo: (typeof GRUPOS_DOC)[number];
  emissao: string;
  validade: string; // "" = sem validade
  observacao: string;
}

// ================================================================ regras do escritório
export interface RegrasProjetos {
  percentual_padrao: Record<PadraoProjeto, number>; // % do custo da obra
  revisoes_padrao: Record<PadraoProjeto, number>;
  modelos: Record<string, Record<string, number>>;
  fases_aprovacao: string[]; // fases que exigem aprovação do cliente para seguir
  bloquear_sem_aprovacao: boolean;
  custo_hora_padrao: number;
  horas_dia: number;
  k: Honorarios["k"];
  alerta_horas: number; // % das horas orçadas
  antecedencia_dias: number; // avisar prazos com N dias
  margem_minima: number; // %
}

export const REGRAS_PADRAO: RegrasProjetos = {
  percentual_padrao: { "Alto padrão": 8, "Médio padrão": 6, Econômico: 5, Público: 5 },
  revisoes_padrao: { "Alto padrão": 3, "Médio padrão": 2, Econômico: 1, Público: 1 },
  modelos: MODELOS_FASES,
  fases_aprovacao: ["EP", "AP"],
  bloquear_sem_aprovacao: true,
  custo_hora_padrao: 80,
  horas_dia: 8,
  k: { encargos: 0, indiretas: 25, lucro: 20, impostos: 11 },
  alerta_horas: 80,
  antecedencia_dias: 7,
  margem_minima: 20,
};

export interface DadosProjetos extends px.ExtrasDados {
  projetos: Projeto[];
  oportunidades: Oportunidade[];
  documentos: DocumentoEmpresa[];
  regras: RegrasProjetos;
}

// ================================================================ leitura tolerante
function lerRegras(v: unknown): RegrasProjetos {
  const d = o_(v);
  const num = (x: unknown, p: number) => n_(x, p);
  const porPadrao = (x: unknown, p: Record<PadraoProjeto, number>) => {
    const o = o_(x);
    return Object.fromEntries(PADROES_PROJETO.map((k) => [k, num(o[k], p[k])])) as Record<PadraoProjeto, number>;
  };
  const modelos: Record<string, Record<string, number>> = {};
  const mg = o_(d.modelos);
  for (const [nome, padrao] of Object.entries(MODELOS_FASES)) {
    const m = o_(mg[nome]);
    modelos[nome] = Object.keys(m).length ? Object.fromEntries(Object.entries(m).filter(([c]) => faseCatalogo(c)).map(([c, p]) => [c, n_(p)])) : { ...padrao };
  }
  const k = o_(d.k);
  return {
    percentual_padrao: porPadrao(d.percentual_padrao, REGRAS_PADRAO.percentual_padrao),
    revisoes_padrao: porPadrao(d.revisoes_padrao, REGRAS_PADRAO.revisoes_padrao),
    modelos,
    fases_aprovacao: Array.isArray(d.fases_aprovacao) ? l_(d.fases_aprovacao).map(t_).filter((c) => faseCatalogo(c)) : [...REGRAS_PADRAO.fases_aprovacao],
    bloquear_sem_aprovacao: d.bloquear_sem_aprovacao === undefined ? true : Boolean(d.bloquear_sem_aprovacao),
    custo_hora_padrao: num(d.custo_hora_padrao, REGRAS_PADRAO.custo_hora_padrao),
    horas_dia: num(d.horas_dia, REGRAS_PADRAO.horas_dia) || 8,
    k: {
      encargos: num(k.encargos, REGRAS_PADRAO.k.encargos), indiretas: num(k.indiretas, REGRAS_PADRAO.k.indiretas),
      lucro: num(k.lucro, REGRAS_PADRAO.k.lucro), impostos: num(k.impostos, REGRAS_PADRAO.k.impostos),
    },
    alerta_horas: num(d.alerta_horas, REGRAS_PADRAO.alerta_horas),
    antecedencia_dias: num(d.antecedencia_dias, REGRAS_PADRAO.antecedencia_dias),
    margem_minima: num(d.margem_minima, REGRAS_PADRAO.margem_minima),
  };
}

/** Nomes das fases da versão anterior (7 fases) → códigos atuais. */
const FASE_ANTIGA: Record<string, string> = {
  "Levantamento e briefing": "LV", "Estudo preliminar": "EP", Anteprojeto: "AP", "Projeto legal (aprovação)": "AP",
  "Projeto executivo": "PE", Compatibilização: "CO", "Detalhamento e entrega": "PE",
};

export function lerProjeto(v: unknown, regras: RegrasProjetos = REGRAS_PADRAO): Projeto | null {
  const d = o_(v);
  if (!d.nome) return null;
  const tipo = TIPOS_OBRA.includes(t_(d.tipo_obra)) ? t_(d.tipo_obra) : "Residência unifamiliar";
  const categoria = CATEGORIAS.includes(t_(d.categoria)) ? t_(d.categoria) : categoriaDoTipo(tipo);
  const padrao = op(d.padrao, PADROES_PROJETO, "Médio padrão");
  const origem = op(d.origem, ORIGENS, "Cliente particular");
  const h = o_(d.honorarios);
  const k = o_(h.k);
  const area = n_(d.area);
  const uf = t_(d.uf) || "PB";
  const honorarios: Honorarios = {
    metodo: op(h.metodo, METODOS_HONORARIO, typeof d.honorarios === "number" ? "Valor fixo" : "Percentual do custo da obra"),
    percentual: n_(h.percentual, regras.percentual_padrao[padrao]),
    custo_m2: n_(h.custo_m2, valorReferencia(CUB_DO_PADRAO[padrao], uf)),
    valor_m2: n_(h.valor_m2), valor_fixo: typeof d.honorarios === "number" ? d.honorarios : n_(h.valor_fixo),
    horas_estimadas: n_(h.horas_estimadas), custo_hora: n_(h.custo_hora, regras.custo_hora_padrao),
    k: { encargos: n_(k.encargos, regras.k.encargos), indiretas: n_(k.indiretas, regras.k.indiretas), lucro: n_(k.lucro, regras.k.lucro), impostos: n_(k.impostos, regras.k.impostos) },
    desconto: n_(h.desconto),
  };
  let fases: Fase[] = l_(d.fases).map((x) => {
    const f = o_(x);
    const codigo = faseCatalogo(t_(f.codigo)) ? t_(f.codigo) : FASE_ANTIGA[t_(f.fase)] ?? "";
    return {
      codigo, peso: n_(f.peso), horas_orcadas: n_(f.horas_orcadas), inicio: d_(f.inicio), prazo: d_(f.prazo), concluida_em: d_(f.concluida_em),
      aprovada_em: d_(f.aprovada_em), aprovado_por: t_(f.aprovado_por), revisoes: Math.max(0, Math.trunc(n_(f.revisoes))),
    };
  }).filter((f) => f.codigo);
  // versão anterior: fases repetidas (mapeadas para o mesmo código) viram uma só
  fases = fases.filter((f, i) => fases.findIndex((x) => x.codigo === f.codigo) === i);
  const modelo = MODELOS_FASES[t_(d.modelo)] ? t_(d.modelo) : modeloSugerido(categoria, tipo, origem);
  if (!fases.length) fases = fasesDoModelo(regras, modelo, t_(d.inicio), t_(d.entrega));
  if (fases.every((f) => !f.peso)) {
    const m = regras.modelos[modelo] ?? MODELOS_FASES[modelo];
    fases.forEach((f) => { f.peso = m?.[f.codigo] ?? 0; });
    if (fases.every((f) => !f.peso)) fases.forEach((f) => { f.peso = arred(100 / fases.length, 2); });
  }
  return {
    id: t_(d.id) || novoId("prj"), codigo: t_(d.codigo), nome: t_(d.nome), cliente: t_(d.cliente), categoria, tipo_obra: tipo, padrao, origem,
    oportunidade: t_(d.oportunidade), endereco: t_(d.endereco), uf, area, responsavel: t_(d.responsavel), inicio: d_(d.inicio), entrega: d_(d.entrega),
    status: op(d.status, STATUS_PROJETO, "Em andamento"), modelo, honorarios,
    revisoes_incluidas: Math.max(0, Math.trunc(n_(d.revisoes_incluidas, regras.revisoes_padrao[padrao]))),
    fases,
    entregaveis: l_(d.entregaveis).map((x) => {
      const e = o_(x);
      return {
        id: t_(e.id) || novoId("ent"), fase: t_(e.fase), disciplina: t_(e.disciplina) || "Arquitetura", titulo: t_(e.titulo),
        revisao: Math.max(0, Math.trunc(n_(e.revisao))), status: op(e.status, STATUS_ENTREGAVEL, "Em elaboração"), responsavel: t_(e.responsavel), data: d_(e.data),
      };
    }).filter((e) => e.titulo),
    horas: l_(d.horas).map((x) => {
      const e = o_(x);
      return {
        id: t_(e.id) || novoId("hr"), data: d_(e.data), pessoa: t_(e.pessoa), membro: t_(e.membro), fase: t_(e.fase), horas: n_(e.horas),
        custo_hora: n_(e.custo_hora), descricao: t_(e.descricao),
      };
    }).filter((e) => e.horas > 0),
    parcelas: l_(d.parcelas).map((x) => {
      const e = o_(x);
      return {
        id: t_(e.id) || novoId("par"), descricao: t_(e.descricao), fase: t_(e.fase), valor: n_(e.valor), vencimento: d_(e.vencimento),
        status: op(e.status, ["Prevista", "Faturada", "Recebida"] as const, "Prevista"), recebido_em: d_(e.recebido_em),
      };
    }).filter((e) => e.valor > 0),
    aditivos: l_(d.aditivos).map((x) => {
      const e = o_(x);
      return { id: t_(e.id) || novoId("adt"), data: d_(e.data), descricao: t_(e.descricao), valor: n_(e.valor), horas: n_(e.horas) };
    }),
    observacao: t_(d.observacao), obra: t_(d.obra), criado_em: d_(d.criado_em),
    ...px.lerExtrasProjeto(d),
  };
}

function lerOportunidade(v: unknown): Oportunidade | null {
  const d = o_(v);
  if (!d.titulo) return null;
  const tipo = d.tipo === "Licitação" ? "Licitação" : "Proposta";
  const etapas: readonly string[] = tipo === "Licitação" ? ETAPAS_LICITACAO : ETAPAS_PROPOSTA;
  const tipoObra = TIPOS_OBRA.includes(t_(d.tipo_obra)) ? t_(d.tipo_obra) : "Residência unifamiliar";
  return {
    id: t_(d.id) || novoId("opo"), tipo, titulo: t_(d.titulo), cliente: t_(d.cliente), categoria: categoriaDoTipo(tipoObra), tipo_obra: tipoObra,
    padrao: op(d.padrao, PADROES_PROJETO, tipo === "Licitação" ? "Público" : "Alto padrão"), area: n_(d.area), valor_estimado: n_(d.valor_estimado),
    valor_proposta: n_(d.valor_proposta), etapa: etapas.includes(t_(d.etapa)) ? t_(d.etapa) : etapas[0], probabilidade: n_(d.probabilidade, 30),
    responsavel: t_(d.responsavel), contato: t_(d.contato), data: d_(d.data), validade: d_(d.validade), orgao_uasg: t_(d.orgao_uasg), edital: t_(d.edital),
    processo: t_(d.processo), modalidade: op(d.modalidade, pz.MODALIDADES, "Concorrência"), criterio: op(d.criterio, pz.CRITERIOS, "Técnica e preço"),
    objeto: op(d.objeto, pz.OBJETOS, "Serviço especial"), plataforma: t_(d.plataforma), link: t_(d.link), publicacao: d_(d.publicacao), abertura: d_(d.abertura),
    intimacao: d_(d.intimacao), garantia_proposta: n_(d.garantia_proposta), garantia_contrato: n_(d.garantia_contrato),
    documentos: l_(d.documentos).map((x) => ({ documento: t_(o_(x).documento), nome: t_(o_(x).nome), ok: Boolean(o_(x).ok) })).filter((x) => x.nome),
    classificacao: Math.max(0, Math.trunc(n_(d.classificacao))), motivo: t_(d.motivo), observacao: t_(d.observacao), projeto: t_(d.projeto),
  };
}

function lerDocumento(v: unknown): DocumentoEmpresa | null {
  const d = o_(v);
  if (!d.nome) return null;
  return { id: t_(d.id) || novoId("doc"), nome: t_(d.nome), grupo: op(d.grupo, GRUPOS_DOC, "Fiscal, social e trabalhista"), emissao: d_(d.emissao), validade: d_(d.validade), observacao: t_(d.observacao) };
}

export function lerDadosProjetos(d: B): DadosProjetos {
  const regras = lerRegras(d.regras);
  return {
    regras,
    projetos: l_(d.projetos).map((x) => lerProjeto(x, regras)).filter((x): x is Projeto => x !== null),
    oportunidades: l_(d.oportunidades).map(lerOportunidade).filter((x): x is Oportunidade => x !== null),
    documentos: l_(d.documentos).map(lerDocumento).filter((x): x is DocumentoEmpresa => x !== null),
    ...px.lerExtrasDados(d),
  };
}

// ================================================================ cálculos: honorários
/** K = (1 + encargos)(1 + indiretas)(1 + lucro)(1 + impostos) — fator de venda da Modalidade 02 (CAU). */
export const fatorK = (k: Honorarios["k"]) => (1 + k.encargos / 100) * (1 + k.indiretas / 100) * (1 + k.lucro / 100) * (1 + k.impostos / 100);
export const custoObraEstimado = (p: Projeto) => arred(p.area * p.honorarios.custo_m2);

/** Honorários contratados (sem aditivos), já com desconto. */
export function honorarioBase(p: Projeto): number {
  const h = p.honorarios;
  let bruto = 0;
  if (h.metodo === "Percentual do custo da obra") bruto = custoObraEstimado(p) * (h.percentual / 100);
  else if (h.metodo === "Valor por m²") bruto = p.area * h.valor_m2;
  else if (h.metodo === "Valor fixo") bruto = h.valor_fixo;
  else bruto = h.horas_estimadas * h.custo_hora * fatorK(h.k);
  return arred(bruto * (1 - h.desconto / 100));
}
export const totalAditivos = (p: Projeto) => arred(p.aditivos.reduce((s, a) => s + a.valor, 0));
export const honorarioTotal = (p: Projeto) => arred(honorarioBase(p) + totalAditivos(p));
export const somaPesos = (p: Projeto) => arred(p.fases.reduce((s, f) => s + f.peso, 0), 2);
/** Valor de cada fase = honorário base × peso / soma dos pesos (aditivos ficam fora da distribuição). */
export function valorFase(p: Projeto, codigo: string): number {
  const soma = somaPesos(p);
  const f = p.fases.find((x) => x.codigo === codigo);
  return f && soma ? arred((honorarioBase(p) * f.peso) / soma) : 0;
}

// ================================================================ cálculos: andamento, horas e resultado
export function faseAtual(p: Projeto): { indice: number; fase: Fase | null } {
  const i = p.fases.findIndex((f) => !f.concluida_em);
  return i < 0 ? { indice: p.fases.length, fase: null } : { indice: i, fase: p.fases[i] };
}
/** Avanço da fase: 1 se concluída; senão, fração de entregáveis aprovados/emitidos daquela fase (0 se não houver). */
export function avancoFase(p: Projeto, f: Fase): number {
  if (f.concluida_em) return 1;
  const ents = p.entregaveis.filter((e) => e.fase === f.codigo);
  if (!ents.length) return 0;
  return ents.filter((e) => e.status === "Aprovado" || e.status === "Emitido p/ obra").length / ents.length * 0.9; // 10% reservado à conclusão formal
}
/** Avanço físico do projeto ponderado pelos pesos de honorários. */
export function avancoProjeto(p: Projeto): number {
  const soma = somaPesos(p);
  if (!soma) return 0;
  return p.fases.reduce((s, f) => s + f.peso * avancoFase(p, f), 0) / soma;
}
export const horasFase = (p: Projeto, codigo: string) => arred(p.horas.filter((h) => h.fase === codigo).reduce((s, h) => s + h.horas, 0), 2);
export const horasTotais = (p: Projeto) => arred(p.horas.reduce((s, h) => s + h.horas, 0), 2);
export const horasOrcadas = (p: Projeto) => arred(p.fases.reduce((s, f) => s + f.horas_orcadas, 0) + p.aditivos.reduce((s, a) => s + a.horas, 0), 2);
export const custoHoras = (p: Projeto) => arred(p.horas.reduce((s, h) => s + h.horas * h.custo_hora, 0));

export interface Resultado {
  contratado: number; // honorários + aditivos
  agregado: number; // valor ganho pelo avanço (earned)
  custo: number; // horas lançadas × custo/hora + despesas do projeto
  custo_horas: number;
  despesas: number;
  margem: number | null; // (agregado − custo) / agregado
  custo_previsto: number | null; // custo projetado no término (EAC = custo / avanço)
  margem_prevista: number | null;
  faturado: number;
  recebido: number;
  a_receber: number;
  atrasado: number;
  sem_parcela: number; // contratado ainda não programado em parcelas
}
export function resultado(p: Projeto, hoje: string): Resultado {
  const contratado = honorarioTotal(p);
  const av = avancoProjeto(p);
  const agregado = arred(contratado * av);
  const custo_horas = custoHoras(p);
  const despesas = px.totalDespesas(p);
  const custo = arred(custo_horas + despesas);
  const custoPrev = av > 0.05 ? arred(custo / av) : null; // com menos de 5% de avanço a projeção não é confiável
  const prog = arred(p.parcelas.reduce((s, x) => s + x.valor, 0));
  return {
    contratado, agregado, custo, custo_horas, despesas,
    margem: agregado > 0 ? (agregado - custo) / agregado : null,
    custo_previsto: custoPrev,
    margem_prevista: custoPrev !== null && contratado > 0 ? (contratado - custoPrev) / contratado : null,
    faturado: arred(p.parcelas.filter((x) => x.status !== "Prevista").reduce((s, x) => s + x.valor, 0)),
    recebido: arred(p.parcelas.filter((x) => x.status === "Recebida").reduce((s, x) => s + x.valor, 0)),
    a_receber: arred(p.parcelas.filter((x) => x.status !== "Recebida").reduce((s, x) => s + x.valor, 0)),
    atrasado: arred(p.parcelas.filter((x) => x.status !== "Recebida" && x.vencimento && x.vencimento < hoje).reduce((s, x) => s + x.valor, 0)),
    sem_parcela: arred(Math.max(0, contratado - prog)),
  };
}

export const projetoAtivo = (p: Projeto) => p.status !== "Concluído" && p.status !== "Cancelado";
export function projetoAtrasado(p: Projeto, hoje: string) {
  if (!projetoAtivo(p)) return false;
  const f = faseAtual(p).fase;
  return Boolean((f?.prazo && f.prazo < hoje) || (p.entrega && p.entrega < hoje));
}
export const revisoesUsadas = (p: Projeto) => p.fases.reduce((s, f) => s + f.revisoes, 0);

// ================================================================ alertas (regras em ação)
export type NivelAlertaP = "critico" | "atencao" | "info";
export interface AlertaProjeto {
  nivel: NivelAlertaP;
  titulo: string;
  detalhe: string;
  tipo: "projeto" | "oportunidade" | "documento";
  id: string;
  data: string; // data de referência (para ordenar)
}

export function alertasProjeto(p: Projeto, r: RegrasProjetos, hoje: string): AlertaProjeto[] {
  const out: AlertaProjeto[] = [];
  const add = (nivel: NivelAlertaP, titulo: string, detalhe: string, data = "") => out.push({ nivel, titulo, detalhe, tipo: "projeto", id: p.id, data });
  if (!projetoAtivo(p)) {
    // projeto encerrado: só cobra o que ficou a receber em atraso
    const atrasado = resultado(p, hoje).atrasado;
    if (p.status !== "Cancelado" && atrasado > 0) add("critico", `${p.codigo}: ${atrasado.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} a receber em atraso`, `${p.nome} (projeto ${p.status.toLowerCase()})`);
    return out;
  }
  const limite = somarDias(hoje, r.antecedencia_dias);
  const atual = faseAtual(p).fase;
  if (atual?.prazo && atual.prazo < hoje) add("critico", `${p.codigo}: ${faseCatalogo(atual.codigo)?.nome} atrasada`, `Prazo era ${atual.prazo.split("-").reverse().join("/")} (${diasEntre(atual.prazo, hoje)} dia(s))`, atual.prazo);
  else if (atual?.prazo && atual.prazo <= limite) add("atencao", `${p.codigo}: ${faseCatalogo(atual.codigo)?.nome} vence em ${diasEntre(hoje, atual.prazo)} dia(s)`, p.nome, atual.prazo);
  if (p.entrega && p.entrega < hoje) add("critico", `${p.codigo}: entrega final vencida`, `${p.nome} — prevista para ${p.entrega.split("-").reverse().join("/")}`, p.entrega);
  // aprovação do cliente pendente numa fase já concluída
  for (const f of p.fases) {
    if (r.fases_aprovacao.includes(f.codigo) && f.concluida_em && !f.aprovada_em) {
      add("atencao", `${p.codigo}: ${faseCatalogo(f.codigo)?.nome} sem aprovação do cliente`, "Registre a aprovação antes de avançar (evita retrabalho)", f.concluida_em);
    }
  }
  // horas
  for (const f of p.fases) {
    if (!f.horas_orcadas || f.concluida_em) continue;
    const usado = horasFase(p, f.codigo) / f.horas_orcadas;
    if (usado > 1) add("critico", `${p.codigo}: ${f.codigo} estourou as horas (${Math.round(usado * 100)}%)`, `${horasFase(p, f.codigo)} h de ${f.horas_orcadas} h orçadas`);
    else if (usado * 100 >= r.alerta_horas) add("atencao", `${p.codigo}: ${f.codigo} consumiu ${Math.round(usado * 100)}% das horas`, `${horasFase(p, f.codigo)} h de ${f.horas_orcadas} h — confira o avanço da fase`);
  }
  // revisões além do contratado
  const rev = revisoesUsadas(p);
  if (p.revisoes_incluidas >= 0 && rev > p.revisoes_incluidas) {
    const extra = rev - p.revisoes_incluidas;
    const cobrado = p.aditivos.length > 0;
    add(cobrado ? "info" : "atencao", `${p.codigo}: ${extra} revisão(ões) além do contrato`, cobrado ? "Há aditivo registrado; confira se cobre as revisões" : `Contrato inclui ${p.revisoes_incluidas}; registre um aditivo`);
  }
  // financeiro
  const res = resultado(p, hoje);
  if (res.atrasado > 0) add("critico", `${p.codigo}: ${res.atrasado.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} a receber em atraso`, p.cliente || p.nome);
  for (const f of p.fases) {
    if (!f.concluida_em) continue;
    const temParcela = p.parcelas.some((x) => x.fase === f.codigo);
    if (!temParcela && f.peso > 0 && p.parcelas.length) add("info", `${p.codigo}: ${f.codigo} concluída sem parcela vinculada`, "Fature a fase concluída");
  }
  if (res.margem_prevista !== null && res.margem_prevista * 100 < r.margem_minima) {
    add(res.margem_prevista < 0 ? "critico" : "atencao", `${p.codigo}: margem prevista ${Math.round(res.margem_prevista * 100)}%`, `Abaixo da mínima de ${r.margem_minima}% (custo projetado ao término)`);
  }
  const av = avancoProjeto(p);
  const orc = horasOrcadas(p);
  if (av >= 0.2 && (orc ? horasTotais(p) < orc * av * 0.25 : horasTotais(p) === 0)) {
    add("info", `${p.codigo}: poucas horas lançadas para ${Math.round(av * 100)}% de avanço`, "A margem só considera as horas lançadas — sem os lançamentos ela fica superestimada");
  }
  const tarefasAtrasadas = p.tarefas.filter((t) => px.tarefaAtrasada(t, hoje));
  if (tarefasAtrasadas.length) add("atencao", `${p.codigo}: ${tarefasAtrasadas.length} tarefa(s) atrasada(s)`, tarefasAtrasadas.slice(0, 3).map((t) => t.titulo).join(" · "), tarefasAtrasadas[0].prazo);
  const semPreco = p.orcamento.filter((i) => !i.preco).length;
  if (semPreco) add("info", `${p.codigo}: ${semPreco} item(ns) do orçamento sem preço`, "Complete os preços para o total do orçamento ficar correto");
  if (!p.inicio || !p.entrega) add("info", `${p.codigo}: sem início ou entrega definidos`, "Defina as datas para distribuir os prazos das fases e o vencimento das parcelas");
  if (Math.abs(somaPesos(p) - 100) > 0.01) add("atencao", `${p.codigo}: pesos das fases somam ${somaPesos(p)}%`, "A distribuição dos honorários deve fechar 100%");
  return out;
}

/** Situação do documento numa data: válido, vence em breve, vencido ou sem validade. */
export function situacaoDocumento(d: DocumentoEmpresa, data: string, antecedencia: number): "Válido" | "Vence em breve" | "Vencido" | "Sem validade" | "Sem data" {
  if (!d.validade) return d.emissao ? "Sem validade" : "Sem data";
  if (d.validade < data) return "Vencido";
  if (d.validade <= somarDias(data, antecedencia)) return "Vence em breve";
  return "Válido";
}

export interface PrazosLicitacao {
  impugnacao: string;
  minimo: { dias: number; base: string } | null;
  dias_publicacao: number; // dias úteis entre publicação e abertura
  prazo_irregular: boolean;
  recurso: string;
  contrarrazoes: string;
  garantia_proposta_valor: number;
  garantia_contrato_valor: number;
  desconto: number | null; // % da proposta sobre o estimado
}
export function prazosLicitacao(o: Oportunidade): PrazosLicitacao {
  const minimo = pz.prazoMinimoPublicacao(o.criterio, o.objeto);
  const dias = o.publicacao && o.abertura ? pz.diasUteisEntre(o.publicacao, o.abertura) : 0;
  return {
    impugnacao: pz.limiteImpugnacao(o.abertura),
    minimo,
    dias_publicacao: dias,
    prazo_irregular: Boolean(minimo && o.publicacao && o.abertura && dias < minimo.dias),
    recurso: pz.limiteRecurso(o.intimacao),
    contrarrazoes: pz.limiteContrarrazoes(o.intimacao),
    garantia_proposta_valor: arred((o.valor_estimado * o.garantia_proposta) / 100),
    garantia_contrato_valor: arred(((o.valor_proposta || o.valor_estimado) * o.garantia_contrato) / 100),
    desconto: o.valor_estimado > 0 && o.valor_proposta > 0 ? (1 - o.valor_proposta / o.valor_estimado) * 100 : null,
  };
}

export function alertasOportunidade(o: Oportunidade, docs: DocumentoEmpresa[], r: RegrasProjetos, hoje: string): AlertaProjeto[] {
  if (FINAIS.includes(o.etapa)) return [];
  const out: AlertaProjeto[] = [];
  const add = (nivel: NivelAlertaP, titulo: string, detalhe: string, data = "") => out.push({ nivel, titulo, detalhe, tipo: "oportunidade", id: o.id, data });
  const br = (d: string) => d.split("-").reverse().join("/");
  const limite = somarDias(hoje, r.antecedencia_dias);
  if (o.tipo === "Licitação") {
    const pzs = prazosLicitacao(o);
    if (o.abertura && o.abertura >= hoje && o.abertura <= limite) add("atencao", `Sessão em ${diasEntre(hoje, o.abertura)} dia(s): ${o.titulo}`, `${o.modalidade} ${o.edital} · ${br(o.abertura)}`, o.abertura);
    if (o.abertura && o.abertura < hoje && ["Análise do edital", "Em preparação"].includes(o.etapa)) add("critico", `Sessão já passou: ${o.titulo}`, `Abertura em ${br(o.abertura)} e a proposta não foi marcada como enviada`, o.abertura);
    if (pzs.impugnacao && pzs.impugnacao >= hoje && pzs.impugnacao <= limite && ["Análise do edital", "Em preparação"].includes(o.etapa)) {
      add("atencao", `Último dia para impugnar/esclarecer: ${br(pzs.impugnacao)}`, `${o.titulo} (art. 164: até 3 dias úteis antes da abertura)`, pzs.impugnacao);
    }
    if (pzs.prazo_irregular) add("atencao", `Prazo de publicação abaixo do mínimo: ${o.titulo}`, `${pzs.dias_publicacao} dia(s) úteis; mínimo ${pzs.minimo!.dias} (${pzs.minimo!.base}) — cabe impugnação`, o.publicacao);
    if (o.garantia_proposta > pz.LIMITE_GARANTIA_PROPOSTA) add("atencao", `Garantia de proposta acima de 1%: ${o.titulo}`, "Art. 58 limita a garantia de proposta a 1% do valor estimado — cabe impugnação");
    if (o.garantia_contrato > pz.LIMITE_GARANTIA_CONTRATO_MAJORADA) add("atencao", `Garantia contratual acima de 10%: ${o.titulo}`, "Art. 98 limita a 5% (até 10% justificado)");
    if (pzs.recurso && pzs.recurso >= hoje && o.etapa === "Recurso") add("critico", `Prazo de recurso até ${br(pzs.recurso)}`, `${o.titulo} (art. 165: 3 dias úteis)`, pzs.recurso);
    // documentos
    const ref = o.abertura || hoje;
    for (const dl of o.documentos) {
      const doc = dl.documento ? docs.find((x) => x.id === dl.documento) : undefined;
      if (doc && situacaoDocumento(doc, ref, 0) === "Vencido") add("critico", `${doc.nome} vencida na data da sessão`, `${o.titulo} · validade ${br(doc.validade)}`, doc.validade);
    }
    const faltam = o.documentos.filter((x) => !x.ok).length;
    if (faltam && o.abertura && o.abertura <= limite && o.abertura >= hoje) add("atencao", `${faltam} documento(s) de habilitação pendente(s)`, o.titulo, o.abertura);
  } else {
    if (o.validade && o.validade < hoje && ["Proposta enviada", "Negociação"].includes(o.etapa)) add("atencao", `Proposta vencida: ${o.titulo}`, `Validade até ${br(o.validade)} — renove ou atualize`, o.validade);
    if (o.etapa === "Proposta enviada" && o.data && diasEntre(o.data, hoje) >= 7) add("info", `Fazer follow-up: ${o.titulo}`, `Proposta enviada há ${diasEntre(o.data, hoje)} dias`, o.data);
  }
  return out;
}

export function alertasDocumentos(docs: DocumentoEmpresa[], r: RegrasProjetos, hoje: string): AlertaProjeto[] {
  return docs.flatMap((d): AlertaProjeto[] => {
    const s = situacaoDocumento(d, hoje, Math.max(r.antecedencia_dias, 15));
    if (s === "Vencido") return [{ nivel: "critico" as const, titulo: `${d.nome} vencida`, detalhe: `Venceu em ${d.validade.split("-").reverse().join("/")}`, tipo: "documento" as const, id: d.id, data: d.validade }];
    if (s === "Vence em breve") return [{ nivel: "atencao" as const, titulo: `${d.nome} vence em ${diasEntre(hoje, d.validade)} dia(s)`, detalhe: "Renove antes da próxima licitação", tipo: "documento" as const, id: d.id, data: d.validade }];
    return [];
  });
}

const ORDEM: Record<NivelAlertaP, number> = { critico: 0, atencao: 1, info: 2 };
export function todosAlertas(g: DadosProjetos, hoje: string): AlertaProjeto[] {
  return [
    ...g.projetos.flatMap((p) => alertasProjeto(p, g.regras, hoje)),
    ...g.oportunidades.flatMap((o) => alertasOportunidade(o, g.documentos, g.regras, hoje)),
    ...alertasDocumentos(g.documentos, g.regras, hoje),
  ].sort((a, b) => ORDEM[a.nivel] - ORDEM[b.nivel] || (a.data || "9999").localeCompare(b.data || "9999"));
}

export function resumoGeral(g: DadosProjetos, hoje: string) {
  const ativos = g.projetos.filter(projetoAtivo);
  const rs = ativos.map((p) => resultado(p, hoje));
  const soma = (k: keyof Resultado) => arred(rs.reduce((s, r) => s + ((r[k] as number) || 0), 0));
  const abertas = g.oportunidades.filter((o) => !FINAIS.includes(o.etapa));
  const decididas = g.oportunidades.filter((o) => FINAIS.includes(o.etapa) && o.etapa !== "Desistência");
  const ganhas = decididas.filter((o) => GANHAS.includes(o.etapa));
  const agregado = soma("agregado");
  const custo = soma("custo");
  const mes = hoje.slice(0, 7);
  return {
    ativos: ativos.length,
    atrasados: ativos.filter((p) => projetoAtrasado(p, hoje)).length,
    carteira: soma("contratado"),
    agregado, custo,
    margem: agregado > 0 ? (agregado - custo) / agregado : null,
    a_receber: soma("a_receber"),
    atrasado: soma("atrasado"),
    recebido_mes: arred(g.projetos.flatMap((p) => p.parcelas).filter((x) => x.status === "Recebida" && x.recebido_em.startsWith(mes)).reduce((s, x) => s + x.valor, 0)),
    horas_mes: arred(g.projetos.flatMap((p) => p.horas).filter((h) => h.data.startsWith(mes)).reduce((s, h) => s + h.horas, 0), 2),
    em_disputa: arred(abertas.reduce((s, o) => s + (o.valor_proposta || o.valor_estimado), 0)),
    ponderado: arred(abertas.reduce((s, o) => s + ((o.valor_proposta || o.valor_estimado) * o.probabilidade) / 100, 0)),
    oportunidades_abertas: abertas.length,
    conversao: decididas.length ? ganhas.length / decididas.length : null,
  };
}

export function porCategoria(g: DadosProjetos, hoje: string) {
  const m = new Map<string, { quantidade: number; carteira: number; ativos: number }>();
  for (const c of CATEGORIAS) m.set(c, { quantidade: 0, carteira: 0, ativos: 0 });
  for (const p of g.projetos) {
    const x = m.get(p.categoria)!;
    x.quantidade++;
    if (projetoAtivo(p)) {
      x.ativos++;
      x.carteira = arred(x.carteira + resultado(p, hoje).contratado);
    }
  }
  return m;
}

// ================================================================ operações: projetos
export const projetoDe = (g: DadosProjetos, id: string) => {
  const p = g.projetos.find((x) => x.id === id);
  if (!p) throw new ValidacaoErro("Projeto não encontrado");
  return p;
};

/** Prazos sugeridos: divide o período início → entrega pelos pesos das fases. */
export function fasesDoModelo(r: RegrasProjetos, modelo: string, inicio: string, entrega: string): Fase[] {
  const pesos = r.modelos[modelo] ?? MODELOS_FASES[modelo] ?? MODELOS_FASES["Edificação particular"];
  const codigos = FASES.map((f) => f.codigo).filter((c) => c in pesos);
  const fases = codigos.map((codigo) => ({ codigo, peso: pesos[codigo], horas_orcadas: 0, inicio: "", prazo: "", concluida_em: "", aprovada_em: "", aprovado_por: "", revisoes: 0 }));
  distribuirPrazos(fases, inicio, entrega);
  return fases;
}

function distribuirPrazos(fases: Fase[], inicio: string, entrega: string, soPendentes = false) {
  if (!inicio || !entrega || entrega <= inicio) return;
  const total = diasEntre(inicio, entrega);
  const soma = fases.reduce((s, f) => s + (f.peso || 0), 0) || fases.length;
  let acc = 0;
  let anterior = inicio;
  fases.forEach((f, k) => {
    acc += f.peso || (soma === fases.length ? 1 : 0);
    const prazo = k === fases.length - 1 ? entrega : somarDias(inicio, Math.round((total * acc) / soma));
    if (!soPendentes || !f.concluida_em) {
      f.inicio = anterior;
      f.prazo = prazo;
    }
    anterior = prazo;
  });
}

/** Horas orçadas por fase a partir das horas estimadas (proporcionais aos pesos). */
function distribuirHoras(p: Projeto) {
  const h = p.honorarios.horas_estimadas;
  const soma = somaPesos(p);
  if (!h || !soma) return;
  p.fases.forEach((f) => { f.horas_orcadas = arred((h * f.peso) / soma, 1); });
}

export function salvarProjeto(g: DadosProjetos, d: B, hoje: string): Projeto {
  const nome = lerTexto(d.nome, "o nome do projeto");
  const tipo = lerOpcao(d.tipo_obra ?? "Residência unifamiliar", TIPOS_OBRA, "Tipo de obra");
  const categoria = categoriaDoTipo(tipo);
  const padrao = lerOpcao(d.padrao ?? "Médio padrão", PADROES_PROJETO, "Padrão");
  const origem = lerOpcao(d.origem ?? "Cliente particular", ORIGENS, "Origem");
  const inicio = lerData(d.inicio);
  const entrega = lerData(d.entrega);
  if (inicio && entrega && entrega <= inicio) throw new ValidacaoErro("A entrega deve ser depois do início");
  const area = lerNumero(d.area, "Área");
  const uf = cortar(d.uf, 2).toUpperCase() || "PB";
  const metodo = lerOpcao(d.metodo ?? "Percentual do custo da obra", METODOS_HONORARIO, "Forma de cálculo dos honorários");
  const r = g.regras;
  const custoM2Txt = String(d.custo_m2 ?? "").trim();
  const honorarios: Honorarios = {
    metodo,
    percentual: String(d.percentual ?? "").trim() ? pctLer(d.percentual, "Percentual") : r.percentual_padrao[padrao],
    custo_m2: custoM2Txt ? lerNumero(custoM2Txt, "Custo da obra por m²") : valorReferencia(CUB_DO_PADRAO[padrao], uf),
    valor_m2: lerNumero(d.valor_m2, "Honorário por m²"),
    valor_fixo: lerNumero(d.valor_fixo, "Valor fixo"),
    horas_estimadas: lerNumero(d.horas_estimadas, "Horas estimadas"),
    custo_hora: String(d.custo_hora ?? "").trim() ? lerNumero(d.custo_hora, "Custo por hora") : r.custo_hora_padrao,
    k: { ...r.k },
    desconto: pctLer(d.desconto ?? 0, "Desconto"),
  };
  if (metodo === "Valor por m²" && !honorarios.valor_m2) throw new ValidacaoErro("Informe o honorário por m²");
  if (metodo === "Valor fixo" && !honorarios.valor_fixo) throw new ValidacaoErro("Informe o valor fixo dos honorários");
  if (metodo === "Custo do serviço (horas × K)" && (!honorarios.horas_estimadas || !honorarios.custo_hora)) throw new ValidacaoErro("Informe as horas estimadas e o custo por hora");
  if (metodo === "Percentual do custo da obra" && (!area || !honorarios.custo_m2)) throw new ValidacaoErro("Para % do custo da obra, informe a área e o custo por m²");
  const revTxt = String(d.revisoes_incluidas ?? "").trim();
  const dados = {
    nome, codigo: cortar(d.codigo, 20), cliente: cortar(d.cliente), categoria, tipo_obra: tipo, padrao, origem, endereco: cortar(d.endereco), uf, area,
    responsavel: cortar(d.responsavel, 80), inicio, entrega, status: lerOpcao(d.status ?? "Em andamento", STATUS_PROJETO, "Situação"),
    revisoes_incluidas: revTxt ? Math.max(0, Math.trunc(lerNumero(revTxt, "Revisões incluídas"))) : r.revisoes_padrao[padrao],
    observacao: longo(d.observacao), honorarios,
  };
  const id = t_(d.id);
  if (id) {
    const p = projetoDe(g, id);
    const mudouDatas = p.inicio !== inicio || p.entrega !== entrega;
    const mudouHoras = p.honorarios.horas_estimadas !== honorarios.horas_estimadas;
    honorarios.k = p.honorarios.k; // K do projeto fica como contratado
    Object.assign(p, dados);
    if (mudouDatas) distribuirPrazos(p.fases, inicio, entrega, true);
    if (mudouHoras) distribuirHoras(p);
    return p;
  }
  const modelo = MODELOS_FASES[t_(d.modelo)] ? t_(d.modelo) : modeloSugerido(categoria, tipo, origem);
  const ano = (inicio || hoje).slice(0, 4);
  const seq = g.projetos.filter((x) => x.codigo.startsWith(`PRJ-${ano}-`)).length + 1;
  const p: Projeto = {
    id: novoId("prj"), ...dados, codigo: dados.codigo || `PRJ-${ano}-${String(seq).padStart(3, "0")}`, oportunidade: cortar(d.oportunidade, 40),
    modelo, fases: fasesDoModelo(r, modelo, inicio, entrega), entregaveis: [], horas: [], parcelas: [], aditivos: [], obra: "", criado_em: hoje,
    tarefas: [], ambientes: [], orcamento: [], arquivos: [], despesas: [], template: "",
  };
  if (g.projetos.some((x) => x.codigo === p.codigo)) throw new ValidacaoErro(`Já existe um projeto com o código ${p.codigo}`);
  const tid = t_(d.template);
  if (tid) {
    const tpl = g.templates.find((x) => x.id === tid);
    if (!tpl) throw new ValidacaoErro("Template não encontrado");
    px.aplicarTemplate(p, tpl, hoje, (pesos) => {
      const codigos = FASES.map((f) => f.codigo).filter((c) => c in pesos);
      const fases = codigos.map((codigo) => ({ codigo, peso: pesos[codigo], horas_orcadas: 0, inicio: "", prazo: "", concluida_em: "", aprovada_em: "", aprovado_por: "", revisoes: 0 }));
      distribuirPrazos(fases, inicio, entrega);
      return fases;
    });
    if (!revTxt && tpl.revisoes !== null) p.revisoes_incluidas = tpl.revisoes;
  }
  distribuirHoras(p);
  g.projetos.push(p);
  return p;
}

/** Define início e entrega: redistribui os prazos das fases pendentes e completa o vencimento das parcelas previstas. */
export function definirDatas(g: DadosProjetos, id: string, d: B): Projeto {
  const p = projetoDe(g, id);
  const inicio = lerData(d.inicio);
  const entrega = lerData(d.entrega);
  if (!inicio || !entrega) throw new ValidacaoErro("Informe o início e a entrega");
  if (entrega <= inicio) throw new ValidacaoErro("A entrega deve ser depois do início");
  p.inicio = inicio;
  p.entrega = entrega;
  distribuirPrazos(p.fases, inicio, entrega, true);
  for (const x of p.parcelas) {
    if (x.status !== "Prevista" || x.vencimento) continue;
    x.vencimento = x.fase ? p.fases.find((f) => f.codigo === x.fase)?.prazo ?? "" : inicio;
  }
  return p;
}

/** Pesos (%), horas orçadas e prazos das fases editados na tabela. */
export function salvarFases(g: DadosProjetos, id: string, d: B): Projeto {
  const p = projetoDe(g, id);
  const novas = p.fases.map((f) => {
    const c = f.codigo;
    const peso = `peso_${c}` in d ? pctLer(d[`peso_${c}`], `Peso de ${c}`) : f.peso;
    const horas = `horas_${c}` in d ? lerNumero(d[`horas_${c}`], `Horas de ${c}`) : f.horas_orcadas;
    const inicio = `inicio_${c}` in d ? lerData(d[`inicio_${c}`]) : f.inicio;
    const prazo = `prazo_${c}` in d ? lerData(d[`prazo_${c}`]) : f.prazo;
    if (inicio && prazo && prazo < inicio) throw new ValidacaoErro(`${c}: o prazo não pode ser antes do início`);
    return { ...f, peso, horas_orcadas: horas, inicio, prazo };
  });
  const soma = arred(novas.reduce((s, f) => s + f.peso, 0), 2);
  if (Math.abs(soma - 100) > 0.01) throw new ValidacaoErro(`Os pesos das fases somam ${soma}% — ajuste para fechar 100%`);
  p.fases = novas;
  return p;
}

export function adicionarFase(g: DadosProjetos, id: string, codigo: string): Projeto {
  const p = projetoDe(g, id);
  if (!faseCatalogo(codigo)) throw new ValidacaoErro("Fase inválida");
  if (p.fases.some((f) => f.codigo === codigo)) throw new ValidacaoErro("Essa fase já está no projeto");
  const ordem = FASES.map((f) => f.codigo);
  p.fases.push({ codigo, peso: 0, horas_orcadas: 0, inicio: "", prazo: "", concluida_em: "", aprovada_em: "", aprovado_por: "", revisoes: 0 });
  p.fases.sort((a, b) => ordem.indexOf(a.codigo) - ordem.indexOf(b.codigo));
  return p;
}

export function removerFase(g: DadosProjetos, id: string, codigo: string): Projeto {
  const p = projetoDe(g, id);
  const f = p.fases.find((x) => x.codigo === codigo);
  if (!f) throw new ValidacaoErro("Fase não encontrada");
  if (f.concluida_em || p.horas.some((h) => h.fase === codigo) || p.entregaveis.some((e) => e.fase === codigo)) {
    throw new ValidacaoErro("Fase com horas, entregáveis ou concluída não pode ser removida");
  }
  if (p.fases.length === 1) throw new ValidacaoErro("O projeto precisa de pelo menos uma fase");
  p.fases = p.fases.filter((x) => x !== f);
  for (const t of p.tarefas) if (t.fase === codigo) t.fase = "";
  return p;
}

/** Concluir/reabrir fase. Regra: não conclui se uma fase anterior que exige aprovação não foi aprovada. */
export function alternarFase(g: DadosProjetos, id: string, codigo: string, hoje: string): Projeto {
  const p = projetoDe(g, id);
  const i = p.fases.findIndex((f) => f.codigo === codigo);
  if (i < 0) throw new ValidacaoErro("Fase não encontrada");
  const f = p.fases[i];
  if (f.concluida_em) {
    p.fases.forEach((x, k) => { if (k >= i) { x.concluida_em = ""; x.aprovada_em = ""; x.aprovado_por = ""; } });
    if (p.status === "Concluído") p.status = "Em andamento";
    return p;
  }
  if (g.regras.bloquear_sem_aprovacao) {
    const pendente = p.fases.slice(0, i).find((x) => g.regras.fases_aprovacao.includes(x.codigo) && !x.aprovada_em);
    if (pendente) throw new ValidacaoErro(`Regra: ${faseCatalogo(pendente.codigo)?.nome} precisa da aprovação do cliente antes de concluir as fases seguintes`);
  }
  p.fases.forEach((x, k) => { if (k <= i && !x.concluida_em) x.concluida_em = hoje; });
  if (p.fases.every((x) => x.concluida_em)) p.status = "Concluído";
  return p;
}

export function aprovarFase(g: DadosProjetos, id: string, codigo: string, d: B, hoje: string): Projeto {
  const p = projetoDe(g, id);
  const f = p.fases.find((x) => x.codigo === codigo);
  if (!f) throw new ValidacaoErro("Fase não encontrada");
  if (!f.concluida_em) throw new ValidacaoErro("Conclua a fase antes de registrar a aprovação do cliente");
  f.aprovada_em = lerData(d.data) || hoje;
  if (f.aprovada_em < f.concluida_em) throw new ValidacaoErro("A aprovação não pode ser antes da conclusão da fase");
  f.aprovado_por = cortar(d.por, 80) || p.cliente;
  return p;
}

export function registrarRevisao(g: DadosProjetos, id: string, codigo: string, delta: number): Projeto {
  const p = projetoDe(g, id);
  const f = p.fases.find((x) => x.codigo === codigo);
  if (!f) throw new ValidacaoErro("Fase não encontrada");
  f.revisoes = Math.max(0, f.revisoes + (delta < 0 ? -1 : 1));
  return p;
}

// entregáveis
export function salvarEntregavel(g: DadosProjetos, id: string, d: B, hoje: string): Entregavel {
  const p = projetoDe(g, id);
  const fase = t_(d.fase);
  if (!p.fases.some((f) => f.codigo === fase)) throw new ValidacaoErro("Escolha uma fase do projeto");
  const dados = {
    fase, disciplina: lerOpcao(d.disciplina ?? "Arquitetura", DISCIPLINAS, "Disciplina"), titulo: lerTexto(d.titulo, "o título do entregável"),
    status: lerOpcao(d.status ?? "Em elaboração", STATUS_ENTREGAVEL, "Situação"), responsavel: cortar(d.responsavel, 80),
  };
  const eid = t_(d.eid);
  if (eid) {
    const e = p.entregaveis.find((x) => x.id === eid);
    if (!e) throw new ValidacaoErro("Entregável não encontrado");
    Object.assign(e, dados);
    return e;
  }
  const e: Entregavel = { id: novoId("ent"), ...dados, revisao: 0, data: hoje };
  p.entregaveis.push(e);
  return e;
}

/** Nova revisão (R00 → R01…): volta para “Em revisão interna”. */
export function revisarEntregavel(g: DadosProjetos, id: string, eid: string, hoje: string): Entregavel {
  const p = projetoDe(g, id);
  const e = p.entregaveis.find((x) => x.id === eid);
  if (!e) throw new ValidacaoErro("Entregável não encontrado");
  e.revisao += 1;
  e.status = "Em revisão interna";
  e.data = hoje;
  return e;
}

export function statusEntregavel(g: DadosProjetos, id: string, eid: string, status: string, hoje: string): Entregavel {
  const p = projetoDe(g, id);
  const e = p.entregaveis.find((x) => x.id === eid);
  if (!e) throw new ValidacaoErro("Entregável não encontrado");
  e.status = lerOpcao(status, STATUS_ENTREGAVEL, "Situação");
  if (e.status === "Enviado ao cliente" || e.status === "Emitido p/ obra") e.data = hoje;
  return e;
}

export function removerEntregavel(g: DadosProjetos, id: string, eid: string) {
  const p = projetoDe(g, id);
  if (!p.entregaveis.some((x) => x.id === eid)) throw new ValidacaoErro("Entregável não encontrado");
  p.entregaveis = p.entregaveis.filter((x) => x.id !== eid);
}

/** Lista padrão de entregáveis da fase (pranchas e documentos usuais). */
export const ENTREGAVEIS_SUGERIDOS: Record<string, [string, string][]> = {
  LV: [["Arquitetura", "Levantamento cadastral / fotográfico"], ["Arquitetura", "Consulta de legislação e parâmetros urbanísticos"]],
  PN: [["Arquitetura", "Programa de necessidades e briefing"]],
  EV: [["Arquitetura", "Estudo de massa e viabilidade"], ["Orçamento", "Estimativa de custo"]],
  EP: [["Arquitetura", "Implantação e plantas do estudo preliminar"], ["Arquitetura", "Volumetria / imagens 3D"]],
  AP: [["Arquitetura", "Anteprojeto (plantas, cortes e fachadas)"], ["Arquitetura", "Projeto legal para aprovação"], ["Acessibilidade", "Memorial de acessibilidade"]],
  PB: [["Arquitetura", "Projeto básico"], ["Orçamento", "Orçamento sintético e cronograma físico-financeiro"], ["Arquitetura", "Memorial descritivo e especificações"]],
  PE: [["Arquitetura", "Executivo de arquitetura"], ["Arquitetura", "Detalhamentos (esquadrias, áreas molhadas, escadas)"], ["Interiores", "Paginação de pisos e revestimentos"], ["Luminotécnico", "Projeto luminotécnico"]],
  CO: [["Compatibilização", "Relatório de compatibilização (clash)"], ["Compatibilização", "Ata de reunião com projetistas"]],
  AO: [["Arquitetura", "Relatórios de visita à obra"], ["Arquitetura", "As built"]],
};
export function gerarEntregaveis(g: DadosProjetos, id: string, codigo: string, hoje: string): number {
  const p = projetoDe(g, id);
  if (!p.fases.some((f) => f.codigo === codigo)) throw new ValidacaoErro("Fase não está no projeto");
  let n = 0;
  for (const [disciplina, titulo] of ENTREGAVEIS_SUGERIDOS[codigo] ?? []) {
    if (p.entregaveis.some((e) => e.fase === codigo && e.titulo === titulo)) continue;
    p.entregaveis.push({ id: novoId("ent"), fase: codigo, disciplina, titulo, revisao: 0, status: "Em elaboração", responsavel: p.responsavel, data: hoje });
    n++;
  }
  return n;
}

// horas
export function lancarHoras(g: DadosProjetos, id: string, d: B, equipe: { id: string; nome: string; custo_dia: number }[], hoje: string): LancamentoHoras {
  const p = projetoDe(g, id);
  const fase = t_(d.fase);
  if (!p.fases.some((f) => f.codigo === fase)) throw new ValidacaoErro("Escolha a fase");
  const horas = lerNumero(d.horas, "Horas");
  if (horas <= 0 || horas > 24) throw new ValidacaoErro("Horas: informe entre 0 e 24 por lançamento");
  const data = lerData(d.data) || hoje;
  if (data > hoje) throw new ValidacaoErro("Não é possível lançar horas no futuro");
  const membro = equipe.find((m) => m.id === t_(d.membro));
  const pessoa = membro?.nome ?? lerTexto(d.pessoa, "quem trabalhou");
  const mesmo = (h: LancamentoHoras) => h.data === data && (membro ? h.membro === membro.id : !h.membro && h.pessoa.toLowerCase() === pessoa.toLowerCase());
  const noDia = g.projetos.flatMap((x) => x.horas).filter(mesmo).reduce((s, h) => s + h.horas, 0);
  if (noDia + horas > 24) throw new ValidacaoErro(`${pessoa} já tem ${String(noDia).replace(".", ",")} h lançadas em ${data.split("-").reverse().join("/")} — o dia não passa de 24 h`);
  // custo/hora: da pessoa na equipe (custo do dia ÷ horas do dia); senão, o padrão das regras
  const custo = membro && membro.custo_dia > 0 ? arred(membro.custo_dia / g.regras.horas_dia, 2) : g.regras.custo_hora_padrao;
  const h: LancamentoHoras = { id: novoId("hr"), data, pessoa, membro: membro?.id ?? "", fase, horas: arred(horas, 2), custo_hora: custo, descricao: cortar(d.descricao, 200) };
  p.horas.push(h);
  return h;
}
export function removerHoras(g: DadosProjetos, id: string, hid: string) {
  const p = projetoDe(g, id);
  if (!p.horas.some((x) => x.id === hid)) throw new ValidacaoErro("Lançamento não encontrado");
  p.horas = p.horas.filter((x) => x.id !== hid);
}

// parcelas
/** Gera uma parcela por fase (valor da fase), com vencimento no prazo da fase; opcionalmente um sinal (% do total). */
export function gerarParcelasPorFase(g: DadosProjetos, id: string, d: B): number {
  const p = projetoDe(g, id);
  if (p.parcelas.some((x) => x.status !== "Prevista")) throw new ValidacaoErro("Já há parcelas faturadas/recebidas; ajuste manualmente");
  const sinal = pctLer(d.sinal ?? 0, "Sinal", 50);
  const base = honorarioBase(p);
  if (base <= 0) throw new ValidacaoErro("Defina os honorários antes de gerar as parcelas");
  const valorSinal = arred((base * sinal) / 100);
  const restante = base - valorSinal;
  const soma = somaPesos(p) || 100;
  const novas: Parcela[] = [];
  if (valorSinal > 0) novas.push({ id: novoId("par"), descricao: "Sinal na assinatura", fase: "", valor: valorSinal, vencimento: p.inicio, status: "Prevista", recebido_em: "" });
  let acumulado = valorSinal;
  const comPeso = p.fases.filter((f) => f.peso > 0);
  comPeso.forEach((f, k) => {
    const valor = k === comPeso.length - 1 ? arred(base - acumulado) : arred((restante * f.peso) / soma);
    acumulado = arred(acumulado + valor);
    novas.push({ id: novoId("par"), descricao: `Conclusão — ${faseCatalogo(f.codigo)?.nome}`, fase: f.codigo, valor, vencimento: f.prazo, status: "Prevista", recebido_em: "" });
  });
  p.parcelas = novas;
  return novas.length;
}
export function salvarParcela(g: DadosProjetos, id: string, d: B): Parcela {
  const p = projetoDe(g, id);
  const valor = lerNumero(d.valor, "Valor");
  if (valor <= 0) throw new ValidacaoErro("Valor deve ser maior que zero");
  const fase = t_(d.fase);
  if (fase && !p.fases.some((f) => f.codigo === fase)) throw new ValidacaoErro("Fase inválida");
  const x: Parcela = { id: novoId("par"), descricao: lerTexto(d.descricao, "a descrição"), fase, valor: arred(valor), vencimento: lerData(d.vencimento), status: "Prevista", recebido_em: "" };
  p.parcelas.push(x);
  return x;
}
export function mudarParcela(g: DadosProjetos, id: string, pid: string, status: string, hoje: string, data?: unknown): Parcela {
  const p = projetoDe(g, id);
  const x = p.parcelas.find((y) => y.id === pid);
  if (!x) throw new ValidacaoErro("Parcela não encontrada");
  x.status = lerOpcao(status, ["Prevista", "Faturada", "Recebida"] as const, "Situação");
  x.recebido_em = x.status === "Recebida" ? lerData(data) || hoje : "";
  return x;
}
export function removerParcela(g: DadosProjetos, id: string, pid: string) {
  const p = projetoDe(g, id);
  const x = p.parcelas.find((y) => y.id === pid);
  if (!x) throw new ValidacaoErro("Parcela não encontrada");
  if (x.status === "Recebida") throw new ValidacaoErro("Parcela recebida não pode ser excluída; volte para prevista antes");
  p.parcelas = p.parcelas.filter((y) => y !== x);
}

// aditivos
export function salvarAditivo(g: DadosProjetos, id: string, d: B, hoje: string): Aditivo {
  const p = projetoDe(g, id);
  const valor = lerNumero(d.valor, "Valor");
  const horas = lerNumero(d.horas, "Horas");
  if (valor <= 0 && horas <= 0) throw new ValidacaoErro("Informe o valor e/ou as horas do aditivo");
  const a: Aditivo = { id: novoId("adt"), data: lerData(d.data) || hoje, descricao: lerTexto(d.descricao, "a descrição do aditivo"), valor: arred(valor), horas };
  p.aditivos.push(a);
  return a;
}
export function removerAditivo(g: DadosProjetos, id: string, aid: string) {
  const p = projetoDe(g, id);
  if (!p.aditivos.some((x) => x.id === aid)) throw new ValidacaoErro("Aditivo não encontrado");
  p.aditivos = p.aditivos.filter((x) => x.id !== aid);
}

export function removerProjeto(g: DadosProjetos, id: string): Projeto {
  const p = projetoDe(g, id);
  if (p.parcelas.some((x) => x.status === "Recebida")) throw new ValidacaoErro("Projeto com parcelas recebidas não pode ser excluído; mude a situação para Cancelado");
  g.projetos = g.projetos.filter((x) => x !== p);
  for (const o of g.oportunidades) if (o.projeto === p.id) o.projeto = "";
  return p;
}

export function vincularObra(g: DadosProjetos, id: string, obra: Obra): Projeto {
  const p = projetoDe(g, id);
  p.obra = obra.id;
  return p;
}

// ================================================================ operações: oportunidades
export const oportunidadeDe = (g: DadosProjetos, id: string) => {
  const o = g.oportunidades.find((x) => x.id === id);
  if (!o) throw new ValidacaoErro("Oportunidade não encontrada");
  return o;
};

export function salvarOportunidade(g: DadosProjetos, d: B, hoje: string): Oportunidade {
  const tipo = d.tipo === "Licitação" ? "Licitação" : "Proposta";
  const etapas: readonly string[] = tipo === "Licitação" ? ETAPAS_LICITACAO : ETAPAS_PROPOSTA;
  const tipoObra = lerOpcao(d.tipo_obra ?? "Residência unifamiliar", TIPOS_OBRA, "Tipo de obra");
  const publicacao = lerData(d.publicacao);
  const abertura = lerData(d.abertura);
  if (publicacao && abertura && abertura < publicacao) throw new ValidacaoErro("A abertura não pode ser antes da publicação do edital");
  const dados = {
    tipo: tipo as Oportunidade["tipo"], titulo: lerTexto(d.titulo, tipo === "Licitação" ? "o objeto da licitação" : "o título da proposta"),
    cliente: cortar(d.cliente), tipo_obra: tipoObra, categoria: categoriaDoTipo(tipoObra),
    padrao: lerOpcao(d.padrao ?? (tipo === "Licitação" ? "Público" : "Alto padrão"), PADROES_PROJETO, "Padrão"),
    area: lerNumero(d.area, "Área"), valor_estimado: lerNumero(d.valor_estimado, "Valor estimado"), valor_proposta: lerNumero(d.valor_proposta, "Valor da proposta"),
    etapa: lerOpcao(d.etapa ?? etapas[0], etapas, "Etapa"), probabilidade: pctLer(d.probabilidade ?? 30, "Probabilidade"),
    responsavel: cortar(d.responsavel, 80), contato: cortar(d.contato), validade: lerData(d.validade),
    orgao_uasg: cortar(d.orgao_uasg, 40), edital: cortar(d.edital, 40), processo: cortar(d.processo, 60),
    modalidade: lerOpcao(d.modalidade ?? "Concorrência", pz.MODALIDADES, "Modalidade"), criterio: lerOpcao(d.criterio ?? "Técnica e preço", pz.CRITERIOS, "Critério"),
    objeto: lerOpcao(d.objeto ?? "Serviço especial", pz.OBJETOS, "Objeto"), plataforma: cortar(d.plataforma, 80), link: cortar(d.link, 300),
    publicacao, abertura, intimacao: lerData(d.intimacao),
    garantia_proposta: pctLer(d.garantia_proposta ?? 0, "Garantia de proposta"), garantia_contrato: pctLer(d.garantia_contrato ?? 0, "Garantia contratual"),
    observacao: longo(d.observacao),
  };
  if (dados.link && !/^https?:\/\//i.test(dados.link)) throw new ValidacaoErro("O link deve começar com http:// ou https://");
  const id = t_(d.id);
  if (id) {
    const o = oportunidadeDe(g, id);
    if (o.tipo !== dados.tipo) throw new ValidacaoErro("Não é possível mudar o tipo; crie uma nova oportunidade");
    Object.assign(o, dados);
    return o;
  }
  const o: Oportunidade = {
    id: novoId("opo"), ...dados, data: lerData(d.data) || hoje, classificacao: 0, motivo: "", projeto: "",
    // licitação já nasce com o checklist de habilitação (documentos da empresa + declarações)
    documentos: tipo === "Licitação" ? g.documentos.map((x) => ({ documento: x.id, nome: x.nome, ok: false })) : [],
  };
  if (tipo === "Licitação" && !o.documentos.length) o.documentos = DOCS_PADRAO.map((x) => ({ documento: "", nome: x.nome, ok: false }));
  g.oportunidades.push(o);
  return o;
}

export function moverOportunidade(g: DadosProjetos, id: string, etapa: string, d: B = {}): Oportunidade {
  const o = oportunidadeDe(g, id);
  const etapas: readonly string[] = o.tipo === "Licitação" ? ETAPAS_LICITACAO : ETAPAS_PROPOSTA;
  o.etapa = lerOpcao(etapa, etapas, "Etapa");
  if (o.etapa === "Proposta enviada" && !o.valor_proposta && o.tipo === "Proposta") throw new ValidacaoErro("Informe o valor da proposta antes de marcar como enviada");
  if (["Perdida", "Desistência"].includes(o.etapa)) o.motivo = cortar(d.motivo, 300);
  if (GANHAS.includes(o.etapa)) o.probabilidade = 100;
  if (["Perdida", "Desistência"].includes(o.etapa)) o.probabilidade = 0;
  if (d.classificacao !== undefined && String(d.classificacao).trim()) o.classificacao = Math.max(0, Math.trunc(lerNumero(d.classificacao, "Classificação")));
  if (d.intimacao !== undefined) o.intimacao = lerData(d.intimacao);
  return o;
}

export function marcarDocumento(g: DadosProjetos, id: string, indice: number): Oportunidade {
  const o = oportunidadeDe(g, id);
  const x = o.documentos[indice];
  if (!x) throw new ValidacaoErro("Documento não encontrado");
  x.ok = !x.ok;
  return o;
}
export function adicionarDocLicitacao(g: DadosProjetos, id: string, nome: unknown): Oportunidade {
  const o = oportunidadeDe(g, id);
  o.documentos.push({ documento: "", nome: lerTexto(nome, "o nome do documento"), ok: false });
  return o;
}
export function removerOportunidade(g: DadosProjetos, id: string): Oportunidade {
  const o = oportunidadeDe(g, id);
  g.oportunidades = g.oportunidades.filter((x) => x !== o);
  return o;
}

/** Proposta ganha ou licitação homologada → projeto (honorários = valor da proposta, fases do modelo). */
export function converterEmProjeto(g: DadosProjetos, id: string, hoje: string): Projeto {
  const o = oportunidadeDe(g, id);
  if (!GANHAS.includes(o.etapa)) throw new ValidacaoErro("Só propostas ganhas ou licitações homologadas viram projeto");
  if (!(o.valor_proposta || o.valor_estimado) && !o.area) throw new ValidacaoErro("Informe o valor da proposta (ou a área) antes de gerar o projeto");
  if (o.projeto && g.projetos.some((p) => p.id === o.projeto)) throw new ValidacaoErro("Esta oportunidade já gerou um projeto");
  const valor = o.valor_proposta || o.valor_estimado;
  const p = salvarProjeto(g, {
    nome: o.titulo, cliente: o.cliente, tipo_obra: o.tipo_obra, padrao: o.padrao, origem: o.tipo === "Licitação" ? "Licitação pública" : "Cliente particular",
    area: o.area, metodo: valor ? "Valor fixo" : "Percentual do custo da obra", valor_fixo: valor, responsavel: o.responsavel, oportunidade: o.id,
    inicio: hoje, observacao: [o.edital && `Edital ${o.edital}`, o.processo && `Processo ${o.processo}`, o.observacao].filter(Boolean).join(" · "),
  }, hoje);
  o.projeto = p.id;
  return p;
}

// ================================================================ operações: documentos e regras
export function salvarDocumento(g: DadosProjetos, d: B): DocumentoEmpresa {
  const emissao = lerData(d.emissao);
  const validade = lerData(d.validade);
  if (emissao && validade && validade < emissao) throw new ValidacaoErro("A validade não pode ser antes da emissão");
  const dados = { nome: lerTexto(d.nome, "o nome do documento"), grupo: lerOpcao(d.grupo ?? "Fiscal, social e trabalhista", GRUPOS_DOC, "Grupo"), emissao, validade, observacao: cortar(d.observacao, 300) };
  const id = t_(d.id);
  if (id) {
    const x = g.documentos.find((y) => y.id === id);
    if (!x) throw new ValidacaoErro("Documento não encontrado");
    Object.assign(x, dados);
    return x;
  }
  const x: DocumentoEmpresa = { id: novoId("doc"), ...dados };
  g.documentos.push(x);
  return x;
}
export function documentosPadrao(g: DadosProjetos): number {
  let n = 0;
  for (const x of DOCS_PADRAO) {
    if (g.documentos.some((y) => y.nome === x.nome)) continue;
    g.documentos.push({ id: novoId("doc"), nome: x.nome, grupo: x.grupo, emissao: "", validade: "", observacao: x.dica });
    n++;
  }
  return n;
}
export function removerDocumento(g: DadosProjetos, id: string): DocumentoEmpresa {
  const x = g.documentos.find((y) => y.id === id);
  if (!x) throw new ValidacaoErro("Documento não encontrado");
  g.documentos = g.documentos.filter((y) => y !== x);
  for (const o of g.oportunidades) for (const dl of o.documentos) if (dl.documento === id) dl.documento = "";
  return x;
}

export function salvarRegras(g: DadosProjetos, d: B): RegrasProjetos {
  const r = g.regras;
  const novo: RegrasProjetos = JSON.parse(JSON.stringify(r));
  for (const p of PADROES_PROJETO) {
    const k = p.replace(/\s/g, "_");
    if (`pct_${k}` in d) novo.percentual_padrao[p] = pctLer(d[`pct_${k}`], `% de ${p}`, 30);
    if (`rev_${k}` in d) novo.revisoes_padrao[p] = Math.max(0, Math.trunc(lerNumero(d[`rev_${k}`], `Revisões de ${p}`)));
  }
  for (const [nome, pesos] of Object.entries(novo.modelos)) {
    let mudou = false;
    for (const c of Object.keys(pesos)) {
      const campo = `m_${nome}_${c}`;
      if (campo in d) { pesos[c] = pctLer(d[campo], `${nome} · ${c}`); mudou = true; }
    }
    const soma = arred(Object.values(pesos).reduce((s, v) => s + v, 0), 2);
    if (mudou && Math.abs(soma - 100) > 0.01) throw new ValidacaoErro(`Modelo “${nome}”: os pesos somam ${soma}% — ajuste para 100%`);
  }
  if ("fases_aprovacao" in d) novo.fases_aprovacao = String(d.fases_aprovacao).split(",").map((x) => x.trim()).filter((c) => faseCatalogo(c));
  if ("bloquear_sem_aprovacao" in d) novo.bloquear_sem_aprovacao = String(d.bloquear_sem_aprovacao) === "1";
  if ("custo_hora_padrao" in d) novo.custo_hora_padrao = lerNumero(d.custo_hora_padrao, "Custo por hora padrão");
  if ("horas_dia" in d) {
    novo.horas_dia = lerNumero(d.horas_dia, "Horas por dia");
    if (novo.horas_dia <= 0 || novo.horas_dia > 16) throw new ValidacaoErro("Horas por dia: entre 1 e 16");
  }
  for (const k of ["encargos", "indiretas", "lucro", "impostos"] as const) if (`k_${k}` in d) novo.k[k] = pctLer(d[`k_${k}`], `K · ${k}`, 300);
  if ("alerta_horas" in d) novo.alerta_horas = pctLer(d.alerta_horas, "Alerta de horas");
  if ("antecedencia_dias" in d) novo.antecedencia_dias = Math.max(0, Math.trunc(lerNumero(d.antecedencia_dias, "Antecedência")));
  if ("margem_minima" in d) novo.margem_minima = pctLer(d.margem_minima, "Margem mínima");
  g.regras = novo;
  return novo;
}
