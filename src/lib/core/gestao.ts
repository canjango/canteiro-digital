/**
 * Gestão de equipe (a gestão de projetos fica em projetos.ts).
 * Ficam nos cadastros compartilhados (valem para todas as obras), sem React.
 */
import type { Obra } from "./modelos";
import { ValidacaoErro, arred, lerData, lerNumero, lerOpcao, lerTexto, limparTexto, novoId } from "./util";

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
  equipe: Membro[];
}

// ================================================================ leitura tolerante
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
  return { equipe: l_(d.equipe).map(lerMembro).filter((x): x is Membro => x !== null) };
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
