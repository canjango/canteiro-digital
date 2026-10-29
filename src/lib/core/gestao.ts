/**
 * Gestão de projetos (escritório de arquitetura) e gestão de equipe.
 * Ficam nos cadastros compartilhados (valem para todas as obras), sem React.
 */
import type { Obra } from "./modelos";
import { ValidacaoErro, arred, lerData, lerNumero, lerOpcao, lerTexto, limparTexto, novoId, somarDias } from "./util";

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
const textoLongo = (v: unknown, max = 2000) => String(v ?? "").replace(/\r\n/g, "\n").trim().slice(0, max);

// ================================================================ projetos
/** Fases de um projeto de arquitetura (NBR 13532 / prática de escritório). */
export const FASES_PROJETO = [
  "Levantamento e briefing",
  "Estudo preliminar",
  "Anteprojeto",
  "Projeto legal (aprovação)",
  "Projeto executivo",
  "Compatibilização",
  "Detalhamento e entrega",
] as const;
export const TIPOS_PROJETO = ["Residencial", "Comercial", "Interiores", "Reforma", "Legalização", "Paisagismo", "Outro"] as const;
export const STATUS_PROJETO = ["Em andamento", "Aguardando cliente", "Pausado", "Concluído", "Cancelado"] as const;

export interface FaseProjeto {
  fase: string;
  prazo: string;
  concluida_em: string; // "" = pendente
}

export interface Projeto {
  id: string;
  codigo: string;
  nome: string;
  cliente: string;
  tipo: (typeof TIPOS_PROJETO)[number];
  area: number;
  endereco: string;
  responsavel: string;
  inicio: string;
  entrega: string;
  honorarios: number;
  status: (typeof STATUS_PROJETO)[number];
  fases: FaseProjeto[];
  observacao: string;
  obra: string; // id da obra gerada a partir do projeto
  criado_em: string;
}

// ================================================================ equipe
export const FUNCOES = [
  "Arquiteto(a)", "Engenheiro(a)", "Mestre de obras", "Encarregado(a)", "Pedreiro(a)", "Servente", "Carpinteiro(a)", "Armador(a)",
  "Eletricista", "Encanador(a)", "Pintor(a)", "Gesseiro(a)", "Estagiário(a)", "Projetista", "Administrativo", "Outro",
] as const;
export const VINCULOS = ["CLT", "Diarista", "Empreiteiro", "Autônomo", "Sócio(a)", "Estagiário(a)", "Terceirizado"] as const;

export interface Membro {
  id: string;
  nome: string;
  funcao: string;
  vinculo: (typeof VINCULOS)[number];
  telefone: string;
  documento: string;
  custo_dia: number; // diária ou custo diário equivalente
  obra: string; // obra onde está alocado ("" = escritório / sem alocação)
  ativo: boolean;
  admissao: string;
  presencas: string[]; // datas (AAAA-MM-DD) em que esteve presente
  observacao: string;
}

export interface Gestao {
  projetos: Projeto[];
  equipe: Membro[];
}

// ================================================================ leitura tolerante
export function lerProjeto(v: unknown): Projeto | null {
  const d = o_(v);
  if (!d.nome) return null;
  const fasesGravadas = l_(d.fases).map((f) => ({ fase: t_(o_(f).fase), prazo: d_(o_(f).prazo), concluida_em: d_(o_(f).concluida_em) }));
  return {
    id: t_(d.id) || novoId("prj"), codigo: t_(d.codigo), nome: t_(d.nome), cliente: t_(d.cliente), tipo: op(d.tipo, TIPOS_PROJETO, "Residencial"),
    area: n_(d.area), endereco: t_(d.endereco), responsavel: t_(d.responsavel), inicio: d_(d.inicio), entrega: d_(d.entrega),
    honorarios: n_(d.honorarios), status: op(d.status, STATUS_PROJETO, "Em andamento"),
    fases: fasesGravadas.length ? fasesGravadas : FASES_PROJETO.map((fase) => ({ fase, prazo: "", concluida_em: "" })),
    observacao: t_(d.observacao), obra: t_(d.obra), criado_em: d_(d.criado_em),
  };
}

export function lerMembro(v: unknown): Membro | null {
  const d = o_(v);
  if (!d.nome) return null;
  return {
    id: t_(d.id) || novoId("mbr"), nome: t_(d.nome), funcao: t_(d.funcao) || "Outro", vinculo: op(d.vinculo, VINCULOS, "Diarista"),
    telefone: t_(d.telefone), documento: t_(d.documento), custo_dia: n_(d.custo_dia), obra: t_(d.obra), ativo: d.ativo !== false,
    admissao: d_(d.admissao), presencas: [...new Set(l_(d.presencas).map(d_).filter(Boolean))].sort(), observacao: t_(d.observacao),
  };
}

export function lerGestao(d: B): Gestao {
  return {
    projetos: l_(d.projetos).map(lerProjeto).filter((x): x is Projeto => x !== null),
    equipe: l_(d.equipe).map(lerMembro).filter((x): x is Membro => x !== null),
  };
}

// ================================================================ projetos: regras
const projetoDe = (g: Gestao, id: string) => {
  const p = g.projetos.find((x) => x.id === id);
  if (!p) throw new ValidacaoErro("Projeto não encontrado");
  return p;
};

/** Fase atual = primeira não concluída (ou a última, se tudo concluído). */
export function faseAtual(p: Projeto): { indice: number; fase: FaseProjeto | null } {
  const i = p.fases.findIndex((f) => !f.concluida_em);
  return i < 0 ? { indice: p.fases.length, fase: null } : { indice: i, fase: p.fases[i] };
}
export const progressoProjeto = (p: Projeto) => (p.fases.length ? p.fases.filter((f) => f.concluida_em).length / p.fases.length : 0);
export const projetoAtrasado = (p: Projeto, hoje: string) => {
  if (p.status === "Concluído" || p.status === "Cancelado") return false;
  const f = faseAtual(p).fase;
  return Boolean((f?.prazo && f.prazo < hoje) || (p.entrega && p.entrega < hoje));
};

/** Prazos sugeridos: divide o período início → entrega pelas fases (pesos típicos de escritório). */
const PESOS_FASES = [0.08, 0.17, 0.17, 0.15, 0.25, 0.1, 0.08];
function distribuirPrazos(inicio: string, entrega: string, n: number): string[] {
  if (!inicio || !entrega || entrega <= inicio) return Array(n).fill("");
  const total = Math.round((Date.parse(entrega) - Date.parse(inicio)) / 86400000);
  let acc = 0;
  return Array.from({ length: n }, (_, k) => {
    acc += PESOS_FASES[k] ?? 1 / n;
    return k === n - 1 ? entrega : somarDias(inicio, Math.round(total * acc));
  });
}

export function salvarProjeto(g: Gestao, d: B, hoje: string): Projeto {
  const nome = lerTexto(d.nome, "o nome do projeto");
  const inicio = lerData(d.inicio);
  const entrega = lerData(d.entrega);
  if (inicio && entrega && entrega <= inicio) throw new ValidacaoErro("A entrega deve ser depois do início");
  const area = lerNumero(d.area, "Área");
  if (area < 0) throw new ValidacaoErro("Área inválida");
  const honorarios = lerNumero(d.honorarios, "Honorários");
  const dados = {
    nome, codigo: cortar(d.codigo, 20), cliente: cortar(d.cliente), tipo: lerOpcao(d.tipo ?? "Residencial", TIPOS_PROJETO, "Tipo"),
    area, endereco: cortar(d.endereco), responsavel: cortar(d.responsavel, 80), inicio, entrega, honorarios: arred(honorarios),
    status: lerOpcao(d.status ?? "Em andamento", STATUS_PROJETO, "Situação"), observacao: textoLongo(d.observacao),
  };
  const id = t_(d.id);
  if (id) {
    const p = projetoDe(g, id);
    const mudouDatas = p.inicio !== inicio || p.entrega !== entrega;
    Object.assign(p, dados);
    // prazos das fases pendentes acompanham as novas datas, sem mexer no que já foi concluído
    if (mudouDatas) {
      const prazos = distribuirPrazos(inicio, entrega, p.fases.length);
      p.fases.forEach((f, k) => { if (!f.concluida_em) f.prazo = prazos[k]; });
    }
    return p;
  }
  const prazos = distribuirPrazos(inicio, entrega, FASES_PROJETO.length);
  const numero = g.projetos.length + 1;
  const p: Projeto = {
    id: novoId("prj"), ...dados, codigo: dados.codigo || `PRJ-${hoje.slice(0, 4)}-${String(numero).padStart(3, "0")}`,
    fases: FASES_PROJETO.map((fase, k) => ({ fase, prazo: prazos[k], concluida_em: "" })), obra: "", criado_em: hoje,
  };
  g.projetos.push(p);
  return p;
}

/** Marca/desmarca uma fase. Concluir uma fase conclui as anteriores; reabrir reabre as seguintes. */
export function alternarFase(g: Gestao, id: string, indice: number, hoje: string): Projeto {
  const p = projetoDe(g, id);
  const f = p.fases[indice];
  if (!f) throw new ValidacaoErro("Fase não encontrada");
  if (f.concluida_em) {
    p.fases.forEach((x, k) => { if (k >= indice) x.concluida_em = ""; });
    if (p.status === "Concluído") p.status = "Em andamento";
  } else {
    p.fases.forEach((x, k) => { if (k <= indice && !x.concluida_em) x.concluida_em = hoje; });
    if (p.fases.every((x) => x.concluida_em)) p.status = "Concluído";
  }
  return p;
}

export function prazoFase(g: Gestao, id: string, indice: number, prazo: unknown): Projeto {
  const p = projetoDe(g, id);
  const f = p.fases[indice];
  if (!f) throw new ValidacaoErro("Fase não encontrada");
  f.prazo = lerData(prazo);
  return p;
}

export function removerProjeto(g: Gestao, id: string): Projeto {
  const p = projetoDe(g, id);
  g.projetos = g.projetos.filter((x) => x !== p);
  return p;
}

export function vincularObra(g: Gestao, id: string, obra: Obra): Projeto {
  const p = projetoDe(g, id);
  p.obra = obra.id;
  return p;
}
export { projetoDe };

export function resumoProjetos(g: Gestao, hoje: string) {
  const ativos = g.projetos.filter((p) => p.status !== "Concluído" && p.status !== "Cancelado");
  return {
    total: g.projetos.length,
    ativos: ativos.length,
    atrasados: ativos.filter((p) => projetoAtrasado(p, hoje)).length,
    aguardando: g.projetos.filter((p) => p.status === "Aguardando cliente").length,
    honorarios_ativos: arred(ativos.reduce((s, p) => s + p.honorarios, 0)),
    concluidos: g.projetos.filter((p) => p.status === "Concluído").length,
  };
}

// ================================================================ equipe: regras
const membroDe = (g: Gestao, id: string) => {
  const m = g.equipe.find((x) => x.id === id);
  if (!m) throw new ValidacaoErro("Pessoa não encontrada na equipe");
  return m;
};

export function salvarMembro(g: Gestao, d: B, obras: Map<string, Obra>): Membro {
  const nome = lerTexto(d.nome, "o nome");
  const obra = t_(d.obra);
  if (obra && !obras.has(obra)) throw new ValidacaoErro("Obra não encontrada");
  const custo = lerNumero(d.custo_dia, "Custo por dia");
  if (custo < 0) throw new ValidacaoErro("Custo por dia inválido");
  const dados = {
    nome, funcao: cortar(d.funcao, 60) || "Outro", vinculo: lerOpcao(d.vinculo ?? "Diarista", VINCULOS, "Vínculo"),
    telefone: cortar(d.telefone, 40), documento: cortar(d.documento, 30), custo_dia: arred(custo), obra,
    ativo: t_(d.ativo ?? "1") !== "0", admissao: lerData(d.admissao), observacao: cortar(d.observacao, 500),
  };
  const id = t_(d.id);
  if (id) {
    const m = membroDe(g, id);
    Object.assign(m, dados);
    return m;
  }
  const m: Membro = { id: novoId("mbr"), ...dados, presencas: [] };
  g.equipe.push(m);
  return m;
}

export function removerMembro(g: Gestao, id: string): Membro {
  const m = membroDe(g, id);
  g.equipe = g.equipe.filter((x) => x !== m);
  return m;
}

export function marcarPresenca(g: Gestao, id: string, data: unknown, presente: boolean): Membro {
  const m = membroDe(g, id);
  const dia = lerData(data);
  if (!dia) throw new ValidacaoErro("Informe a data");
  const s = new Set(m.presencas);
  if (presente) s.add(dia);
  else s.delete(dia);
  m.presencas = [...s].sort();
  return m;
}

/** Presença de todos os ativos (opcionalmente só de uma obra) no dia. */
export function marcarTodos(g: Gestao, data: unknown, obra: string, presente: boolean): number {
  const dia = lerData(data);
  if (!dia) throw new ValidacaoErro("Informe a data");
  const alvo = g.equipe.filter((m) => m.ativo && (!obra || m.obra === obra));
  for (const m of alvo) marcarPresenca(g, m.id, dia, presente);
  return alvo.length;
}

/** Dias trabalhados e custo no mês (AAAA-MM). */
export function resumoMes(m: Membro, mes: string) {
  const dias = m.presencas.filter((d) => d.startsWith(mes)).length;
  return { dias, custo: arred(dias * m.custo_dia) };
}

export function resumoEquipe(g: Gestao, mes: string, hoje: string) {
  const ativos = g.equipe.filter((m) => m.ativo);
  const linhas = ativos.map((m) => resumoMes(m, mes));
  return {
    ativos: ativos.length,
    alocados: ativos.filter((m) => m.obra).length,
    presentes_hoje: ativos.filter((m) => m.presencas.includes(hoje)).length,
    dias_mes: linhas.reduce((s, l) => s + l.dias, 0),
    custo_mes: arred(linhas.reduce((s, l) => s + l.custo, 0)),
  };
}

/** Custo de mão de obra própria por obra no mês (para conferir com o orçamento). */
export function custoPorObra(g: Gestao, mes: string): Map<string, number> {
  const r = new Map<string, number>();
  for (const m of g.equipe) {
    const { custo } = resumoMes(m, mes);
    if (custo) r.set(m.obra, arred((r.get(m.obra) ?? 0) + custo));
  }
  return r;
}

export const nomeObraOu = (obras: Map<string, Obra>, id: string, padrao = "Escritório / sem obra") => obras.get(id)?.nome ?? padrao;
