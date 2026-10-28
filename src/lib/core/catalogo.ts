/**
 * Catálogos de referência (dados): etapas construtivas, padrões/CUB por estado,
 * lista de materiais por etapa e especificações técnicas por serviço.
 */
import etapasJson from "@/lib/dados/etapas.json";
import padroesJson from "@/lib/dados/padroes.json";
import materiaisJson from "@/lib/dados/materiais.json";
import especificacoesJson from "@/lib/dados/especificacoes.json";
import figurasChaves from "@/lib/dados/figuras-chaves.json";
import type { Servico } from "./modelos";

// ================================================================ etapas
export interface EtapaCatalogo {
  codigo: string;
  nome: string;
  categoria: string;
  peso: number;
  predecessoras: string[];
  duracao_dias: number;
  descricao: string;
  servicos: Servico[];
  equipe: string;
  atencao: string[];
  normas: string[];
  checklist: string[];
}

export const MODELO_VERSAO: number = etapasJson.modeloVersao;
export const CATEGORIAS: readonly string[] = etapasJson.categorias;
export const ETAPAS_PADRAO: readonly EtapaCatalogo[] = etapasJson.etapas as EtapaCatalogo[];
export const CODIGOS: readonly string[] = ETAPAS_PADRAO.map((e) => e.codigo);
export const CAMPOS_DESCRITIVOS = ["descricao", "servicos", "equipe", "atencao", "normas", "duracao_dias"] as const;

export function etapaPadrao(codigo: string): EtapaCatalogo {
  const e = ETAPAS_PADRAO.find((x) => x.codigo === codigo);
  if (!e) throw new Error(`Etapa desconhecida: ${codigo}`);
  return e;
}

export function validarCatalogo(): string[] {
  const problemas: string[] = [];
  const vistos = new Set<string>();
  for (const e of ETAPAS_PADRAO) {
    if (vistos.has(e.codigo)) problemas.push(`Código duplicado: ${e.codigo}`);
    if (!CATEGORIAS.includes(e.categoria)) problemas.push(`${e.codigo}: categoria inválida`);
    for (const p of e.predecessoras) if (!vistos.has(p)) problemas.push(`${e.codigo}: predecessora ${p} não vem antes`);
    if (!(e.duracao_dias > 0)) problemas.push(`${e.codigo}: duração inválida`);
    if (new Set(e.checklist).size !== e.checklist.length) problemas.push(`${e.codigo}: item de checklist repetido`);
    for (const s of e.servicos) if (!(s.servico && s.un && s.qtd > 0)) problemas.push(`${e.codigo}: quantitativo inválido`);
    vistos.add(e.codigo);
  }
  const somaPesos = Math.round(ETAPAS_PADRAO.reduce((s, e) => s + e.peso, 0) * 1e6) / 1e6;
  if (somaPesos !== 100) problemas.push(`Soma dos pesos = ${somaPesos}, esperado 100`);
  return problemas;
}

// ================================================================ padrões construtivos e CUB por estado
export interface Padrao {
  nome: string;
  valor_m2: number;
  descricao: string;
  derivado?: boolean;
}

export const PADROES: Record<string, Padrao> = padroesJson.padroes as Record<string, Padrao>;
export const CODIGOS_PADRAO = Object.keys(PADROES);
export const PADRAO_INICIAL = "R1-N";

/** UF → [nome, sindicato, mês de referência, R1-B, R1-N, R1-A] (sem desoneração). */
export const CUB_ESTADOS = padroesJson.cub as unknown as Record<string, [string, string, string, number, number, number]>;
export const UF_SEM_PADRAO: readonly string[] = padroesJson.semPadrao;
export const UF_PADRAO = "SP"; // obras antigas foram calculadas com o CUB-SP
export const UF_SUGERIDA = "PB"; // estado sugerido para obras novas
export const UFS = Object.keys(CUB_ESTADOS).sort();

export function referenciaCub(uf: string = UF_PADRAO): string {
  const [nome, sind, mes] = CUB_ESTADOS[uf] ?? CUB_ESTADOS[UF_PADRAO];
  return `CUB/m² ${sind} (${nome}) · ${mes} · sem desoneração`;
}

export function rotuloUf(uf: string): string {
  const [nome, , mes] = CUB_ESTADOS[uf];
  return `${uf} — ${nome} (${mes})`;
}

export function rotuloPadrao(codigo: string): string {
  const p = PADROES[codigo];
  if (!p) return codigo;
  if (codigo === "PERS") return p.nome;
  if (p.derivado) return `${p.nome} (entre R1-N e R1-A)`;
  return `${p.nome} (${codigo})`;
}

/** CUB do padrão no estado (R1-MA = média de R1-N e R1-A). */
export function valorReferencia(codigo: string, uf: string = UF_PADRAO): number {
  const t = CUB_ESTADOS[uf || UF_PADRAO];
  if (!t || !["R1-B", "R1-N", "R1-MA", "R1-A"].includes(codigo)) return PADROES[codigo]?.valor_m2 ?? 0;
  const [, , , b, n, a] = t;
  if (codigo === "R1-B") return b;
  if (codigo === "R1-N") return n;
  if (codigo === "R1-A") return a;
  return Math.round(((n + a) / 2) * 100) / 100;
}

// ================================================================ materiais por etapa
export interface MaterialCatalogo {
  chave: string;
  material: string;
  un: string;
  qtd: number;
  categoria: string;
}
export interface MaterialAjustado extends MaterialCatalogo {
  fator_padrao: number;
  ajustado: boolean;
}

export const MATERIAIS = materiaisJson.materiais as Record<string, MaterialCatalogo[]>;
const VARIACOES = materiaisJson.variacoes as unknown as Record<string, Record<string, [number, string | null]>>;
export const PERFIS_MATERIAIS: readonly string[] = materiaisJson.perfis;
const UNIDADES_INTEIRAS = new Set<string>(materiaisJson.inteiras);

/** Perfil de especificação da lista. Personalizado usa o padrão de valor por m² mais próximo no estado. */
export function perfilDoPadrao(padrao: string, valorM2 = 0, uf: string = UF_PADRAO): string {
  if (PERFIS_MATERIAIS.includes(padrao)) return padrao;
  if (!valorM2) return "R1-N";
  let melhor = PERFIS_MATERIAIS[0];
  for (const c of PERFIS_MATERIAIS) {
    if (Math.abs(valorReferencia(c, uf) - valorM2) < Math.abs(valorReferencia(melhor, uf) - valorM2)) melhor = c;
  }
  return melhor;
}

function variacao(chave: string, perfil: string): [number, string | null] {
  const v = VARIACOES[chave];
  if (perfil === "R1-N" || !v) return [1, null];
  if (perfil === "R1-MA" && !("R1-MA" in v)) {
    const [fa, da] = v["R1-A"] ?? [1, null];
    return [Math.round(((1 + fa) / 2) * 1000) / 1000, da];
  }
  return v[perfil] ?? [1, null];
}

/** Materiais da etapa ajustados ao padrão (quantidade de referência para 100 m²). Fator 0 sai da lista. */
export function materiaisDaEtapa(codigo: string, padrao = "R1-N", valorM2 = 0, uf: string = UF_PADRAO): MaterialAjustado[] {
  const perfil = perfilDoPadrao(padrao, valorM2, uf);
  const out: MaterialAjustado[] = [];
  for (const m of MATERIAIS[codigo] ?? []) {
    const [fator, desc] = variacao(m.chave, perfil);
    if (fator <= 0) continue;
    out.push({
      ...m,
      qtd: Math.round(m.qtd * fator * 10000) / 10000,
      material: desc || m.material,
      fator_padrao: fator,
      ajustado: fator !== 1 || Boolean(desc),
    });
  }
  return out;
}

export function materialDaChave(chave: string, padrao = "R1-N", valorM2 = 0, uf: string = UF_PADRAO): MaterialAjustado | null {
  const etapa = chave.split(":")[0];
  return materiaisDaEtapa(etapa, padrao, valorM2, uf).find((m) => m.chave === chave) ?? null;
}

/** Quantidade para a área da obra (referência = 100 m²), arredondada para cima no formato de compra. */
export function quantidadeParaArea(qtdRef: number, un: string, area: number): number {
  const v = (qtdRef * (area || 100)) / 100;
  if (UNIDADES_INTEIRAS.has(un)) return Math.max(1, Math.ceil(v - 1e-9));
  if (v >= 10) return Math.ceil(v - 1e-9);
  return Math.ceil(v * 10 - 1e-9) / 10;
}

// ================================================================ especificações e figuras
export interface Especificacao {
  especificacao: string;
  execucao: string;
  aceitacao: string;
}
const ESPECIFICACOES = especificacoesJson as Record<string, Especificacao>;

export function especificacao(codigo: string, servico: string): Especificacao | null {
  return ESPECIFICACOES[`${codigo}|${servico}`] ?? null;
}

const COM_FIGURA = new Set<string>(figurasChaves as string[]);
/** O item de checklist (pelo texto do catálogo) tem imagem de referência? */
export const temFigura = (texto: string) => COM_FIGURA.has(texto);

/** Carrega as imagens só quando o usuário abre uma (o arquivo é grande). */
export async function carregarFigura(texto: string): Promise<string | null> {
  const m = await import("@/lib/dados/figuras.json");
  return (m.default as Record<string, string>)[texto] ?? null;
}
export async function carregarDetalhe(codigo: string): Promise<{ svg: string; titulo: string } | null> {
  const m = await import("@/lib/dados/detalhes.json");
  return (m.default as Record<string, { svg: string; titulo: string }>)[codigo] ?? null;
}
export const ETAPAS_COM_DETALHE = new Set(CODIGOS);
