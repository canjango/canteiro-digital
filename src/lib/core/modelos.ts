/**
 * Modelos de dados. Os nomes dos campos são os mesmos do JSON gravado pela
 * versão anterior (snake_case), para que as obras já salvas continuem abrindo.
 */
import { ValidacaoErro, arred, dataSegura, novoId } from "./util";
import { lerModulos, type ModulosObra } from "./modulos";

export const STATUS_COMPRA = ["Solicitada", "Em cotação", "Aprovada", "Pedido feito", "Entregue", "Cancelada"] as const;
export type StatusCompra = (typeof STATUS_COMPRA)[number];

export const TRANSICOES_COMPRA: Record<StatusCompra, readonly StatusCompra[]> = {
  Solicitada: ["Em cotação", "Aprovada", "Cancelada"],
  "Em cotação": ["Aprovada", "Cancelada"],
  Aprovada: ["Pedido feito", "Cancelada"],
  "Pedido feito": ["Entregue", "Cancelada"],
  Entregue: [],
  Cancelada: ["Solicitada"],
};

export const CATEGORIAS_COMPRA = [
  "Material", "Mão de obra", "Serviço terceirizado", "Equipamento/locação", "Taxas e documentos",
] as const;
export const UNIDADES = [
  "un", "m", "m²", "m³", "kg", "t", "sc", "l", "vb", "h", "dia", "mês",
  "lata", "galão", "rolo", "cj", "pç", "barra", "cx", "pct",
] as const;
export const STATUS_TAREFA = ["A fazer", "Em andamento", "Bloqueada", "Concluída"] as const;
export type StatusTarefa = (typeof STATUS_TAREFA)[number];
export const PRIORIDADES = ["Baixa", "Média", "Alta", "Urgente"] as const;
export type Prioridade = (typeof PRIORIDADES)[number];

export const STATUS_CONTROLE = ["A cotar", "Cotação solicitada", "Comprado", "Entregue"] as const;
export type StatusControle = (typeof STATUS_CONTROLE)[number];
export const FORMAS_PAGAMENTO = ["À Vista", "A Prazo"] as const;

// ---------------------------------------------------------------- entidades
export interface ItemChecklist {
  texto: string;
  feito: boolean;
  concluido_em: string;
  id: string;
}

export interface Servico {
  servico: string;
  un: string;
  qtd: number;
}

export interface Etapa {
  codigo: string;
  nome: string;
  categoria: string;
  peso: number;
  predecessoras: string[];
  normas: string[];
  checklist: ItemChecklist[];
  inicio_previsto: string;
  fim_previsto: string;
  orcamento: number;
  descricao: string;
  servicos: Servico[];
  equipe: string;
  atencao: string[];
  duracao_dias: number;
  observacao: string;
}

export interface Compra {
  descricao: string;
  etapa: string;
  categoria: string;
  quantidade: number;
  unidade: string;
  valor_unitario: number;
  fornecedor: string;
  status: StatusCompra;
  prioridade: Prioridade;
  data_necessidade: string;
  data_entrega: string;
  historico: { data: string; status: string }[];
  material: string;
  id: string;
}

export interface Cotacao {
  fornecedor: string;
  vista: number;
  prazo: number;
}

export interface ItemControle {
  descricao: string;
  etapa_base: string;
  etapa: string;
  grupo: string;
  tipo: "material" | "mao_de_obra";
  especificacao: string;
  unidade: string;
  quantidade: number;
  valor_base: number;
  cotacoes: Cotacao[];
  escolhida: number;
  forma: "" | "À Vista" | "A Prazo";
  parcelas: number;
  status: StatusControle;
  data_compra: string;
  data_entrega: string;
  fonte_preco: string;
  qtd_estimada: boolean;
  novo: boolean;
  observacao: string;
  id: string;
}

export interface Tarefa {
  titulo: string;
  etapa: string;
  responsavel: string;
  prazo: string;
  prioridade: Prioridade;
  status: StatusTarefa;
  checklist: ItemChecklist[];
  concluida_em: string;
  id: string;
}

export interface PontoRevisao {
  nivel: "critico" | "atencao" | "ok";
  titulo: string;
  detalhe: string;
}
export interface SugestaoRevisao {
  etapa: string;
  texto: string;
  adicionado: boolean;
}
export interface Revisao {
  id: string;
  data: string;
  escopo: "obra" | "etapa";
  codigo: string;
  foco: string;
  origem: string;
  resumo: string;
  pontos: PontoRevisao[];
  sugestoes: SugestaoRevisao[];
  perguntas: string[];
  formato_livre: boolean;
}

export interface Obra extends ModulosObra {
  nome: string;
  cliente: string;
  endereco: string;
  responsavel_tecnico: string;
  inicio: string;
  fim_previsto: string;
  orcamento_total: number;
  etapas: Etapa[];
  compras: Compra[];
  tarefas: Tarefa[];
  exemplo: boolean;
  area_construida: number;
  padrao: string;
  valor_m2: number;
  uf_cub: string;
  bdi: number;
  modelo_etapas: number;
  revisoes: Revisao[];
  controle: ItemControle[];
  controle_origem: string;
  id: string;
}

// ---------------------------------------------------------------- fábricas
export function novoItemChecklist(texto: string): ItemChecklist {
  return { texto, feito: false, concluido_em: "", id: novoId("chk") };
}

// ---------------------------------------------------------------- cálculos derivados
export const valorTotalCompra = (c: Compra) => arred(c.quantidade * c.valor_unitario);

export const totalBase = (i: ItemControle) => arred(i.quantidade * i.valor_base);
/** Base sem arredondar (para somas: arredonda só no total, como a planilha). */
export const baseBruta = (i: ItemControle) => i.quantidade * i.valor_base;

export function cotacaoEscolhida(i: ItemControle): Cotacao | null {
  return i.escolhida >= 0 && i.escolhida < i.cotacoes.length ? i.cotacoes[i.escolhida] : null;
}

export function fornecedorItem(i: ItemControle): string {
  return cotacaoEscolhida(i)?.fornecedor ?? "";
}

/** Valor aplicado: a prazo se a forma for "A Prazo", senão à vista (como na planilha). */
export function valorAplicado(i: ItemControle): number {
  const c = cotacaoEscolhida(i);
  if (!c) return 0;
  return i.forma === "A Prazo" ? Number(c.prazo || c.vista || 0) : Number(c.vista || c.prazo || 0);
}

export const totalCompraItem = (i: ItemControle) => arred(i.quantidade * valorAplicado(i));
/** Compra sem arredondar (para somas). */
export const compraBruta = (i: ItemControle) => i.quantidade * valorAplicado(i);

export function valorParcela(i: ItemControle): number {
  const t = totalCompraItem(i);
  return i.forma === "A Prazo" && i.parcelas > 0 ? arred(t / i.parcelas) : t;
}

/** Base − compra (positivo = economia). null enquanto não houver cotação. */
export function diferencaItem(i: ItemControle): number | null {
  const t = totalCompraItem(i);
  return t ? arred(totalBase(i) - t) : null;
}

// ---------------------------------------------------------------- leitura de dados gravados
// Cada função aceita um objeto qualquer vindo do banco e devolve um modelo completo,
// com valores padrão para campos ausentes (obras antigas) e sem campos desconhecidos.
type Bruto = Record<string, unknown>;
const obj = (v: unknown): Bruto => (v && typeof v === "object" && !Array.isArray(v) ? (v as Bruto) : {});
const lista = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const txt = (v: unknown, padrao = ""): string => (v === null || v === undefined ? padrao : String(v));
const numero = (v: unknown, padrao = 0): number => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : padrao;
};
const bool = (v: unknown): boolean => v === true || v === "true" || v === 1;
const textos = (v: unknown): string[] => lista(v).map((x) => String(x));

function exigir(d: Bruto, campo: string): string {
  const v = d[campo];
  if (v === null || v === undefined || String(v) === "") throw new Error(`campo obrigatório ausente: ${campo}`);
  return String(v);
}

export function lerItemChecklist(v: unknown): ItemChecklist {
  const d = obj(v);
  return {
    texto: exigir(d, "texto"),
    feito: bool(d.feito),
    concluido_em: dataSegura(d.concluido_em),
    id: txt(d.id) || novoId("chk"),
  };
}

export function lerEtapa(v: unknown): Etapa {
  const d = obj(v);
  return {
    codigo: exigir(d, "codigo"),
    nome: exigir(d, "nome"),
    categoria: txt(d.categoria),
    peso: numero(d.peso),
    predecessoras: textos(d.predecessoras),
    normas: textos(d.normas),
    checklist: lista(d.checklist).map(lerItemChecklist),
    inicio_previsto: dataSegura(d.inicio_previsto),
    fim_previsto: dataSegura(d.fim_previsto),
    orcamento: numero(d.orcamento),
    descricao: txt(d.descricao),
    servicos: lista(d.servicos).map((s) => {
      const o = obj(s);
      return { servico: txt(o.servico), un: txt(o.un), qtd: numero(o.qtd) };
    }),
    equipe: txt(d.equipe),
    atencao: textos(d.atencao),
    duracao_dias: Math.trunc(numero(d.duracao_dias)),
    observacao: txt(d.observacao),
  };
}

export function lerCompra(v: unknown): Compra {
  const d = obj(v);
  const status = STATUS_COMPRA.includes(d.status as StatusCompra) ? (d.status as StatusCompra) : "Solicitada";
  const prioridade = PRIORIDADES.includes(d.prioridade as Prioridade) ? (d.prioridade as Prioridade) : "Média";
  return {
    descricao: exigir(d, "descricao"),
    etapa: exigir(d, "etapa"),
    categoria: txt(d.categoria, "Material") || "Material",
    quantidade: numero(d.quantidade, 1),
    unidade: txt(d.unidade, "un") || "un",
    valor_unitario: numero(d.valor_unitario),
    fornecedor: txt(d.fornecedor),
    status,
    prioridade,
    data_necessidade: dataSegura(d.data_necessidade),
    data_entrega: dataSegura(d.data_entrega),
    historico: lista(d.historico).map((h) => {
      const o = obj(h);
      return { data: txt(o.data), status: txt(o.status) };
    }),
    material: txt(d.material),
    id: txt(d.id) || novoId("cmp"),
  };
}

export function lerItemControle(v: unknown): ItemControle {
  const d = obj(v);
  const forma = d.forma === "À Vista" || d.forma === "A Prazo" ? d.forma : "";
  const status = STATUS_CONTROLE.includes(d.status as StatusControle) ? (d.status as StatusControle) : "A cotar";
  return {
    descricao: exigir(d, "descricao"),
    etapa_base: exigir(d, "etapa_base"),
    etapa: txt(d.etapa),
    grupo: txt(d.grupo),
    tipo: d.tipo === "mao_de_obra" ? "mao_de_obra" : "material",
    especificacao: txt(d.especificacao),
    unidade: txt(d.unidade, "un") || "un",
    quantidade: numero(d.quantidade),
    valor_base: numero(d.valor_base),
    cotacoes: lista(d.cotacoes).slice(0, 3).map((c) => {
      const o = obj(c);
      return { fornecedor: txt(o.fornecedor), vista: numero(o.vista), prazo: numero(o.prazo) };
    }),
    escolhida: Math.trunc(numero(d.escolhida, -1)),
    forma,
    parcelas: Math.max(0, Math.trunc(numero(d.parcelas))),
    status,
    data_compra: dataSegura(d.data_compra),
    data_entrega: dataSegura(d.data_entrega),
    fonte_preco: txt(d.fonte_preco),
    qtd_estimada: bool(d.qtd_estimada),
    novo: bool(d.novo),
    observacao: txt(d.observacao),
    id: txt(d.id) || novoId("ctl"),
  };
}

export function lerTarefa(v: unknown): Tarefa {
  const d = obj(v);
  return {
    titulo: exigir(d, "titulo"),
    etapa: txt(d.etapa),
    responsavel: txt(d.responsavel),
    prazo: dataSegura(d.prazo),
    prioridade: PRIORIDADES.includes(d.prioridade as Prioridade) ? (d.prioridade as Prioridade) : "Média",
    status: STATUS_TAREFA.includes(d.status as StatusTarefa) ? (d.status as StatusTarefa) : "A fazer",
    checklist: lista(d.checklist).map(lerItemChecklist),
    concluida_em: dataSegura(d.concluida_em),
    id: txt(d.id) || novoId("tar"),
  };
}

function lerRevisao(v: unknown): Revisao | null {
  const d = obj(v);
  if (!d.id) return null;
  const niveis = ["critico", "atencao", "ok"];
  return {
    id: txt(d.id),
    data: dataSegura(d.data),
    escopo: d.escopo === "etapa" ? "etapa" : "obra",
    codigo: txt(d.codigo),
    foco: txt(d.foco),
    origem: txt(d.origem, "Claude"),
    resumo: txt(d.resumo),
    pontos: lista(d.pontos).map((p) => {
      const o = obj(p);
      return {
        nivel: (niveis.includes(String(o.nivel)) ? o.nivel : "atencao") as PontoRevisao["nivel"],
        titulo: txt(o.titulo),
        detalhe: txt(o.detalhe),
      };
    }),
    sugestoes: lista(d.sugestoes).map((s) => {
      const o = obj(s);
      return { etapa: txt(o.etapa), texto: txt(o.texto), adicionado: bool(o.adicionado) };
    }),
    perguntas: textos(d.perguntas),
    formato_livre: bool(d.formato_livre),
  };
}

export function lerObra(v: unknown): Obra {
  const d = obj(v);
  if (!Object.keys(d).length) throw new Error("documento vazio");
  return {
    nome: exigir(d, "nome"),
    cliente: txt(d.cliente),
    endereco: txt(d.endereco),
    responsavel_tecnico: txt(d.responsavel_tecnico),
    inicio: dataSegura(d.inicio),
    fim_previsto: dataSegura(d.fim_previsto),
    orcamento_total: numero(d.orcamento_total),
    etapas: lista(d.etapas).map(lerEtapa),
    compras: lista(d.compras).map(lerCompra),
    tarefas: lista(d.tarefas).map(lerTarefa),
    exemplo: bool(d.exemplo),
    area_construida: numero(d.area_construida, 100) || 100,
    padrao: txt(d.padrao, "R1-N") || "R1-N",
    valor_m2: numero(d.valor_m2, 2690.33),
    uf_cub: txt(d.uf_cub, "SP") || "SP",
    bdi: numero(d.bdi),
    modelo_etapas: Math.trunc(numero(d.modelo_etapas, 1)),
    revisoes: lista(d.revisoes).map(lerRevisao).filter((r): r is Revisao => r !== null),
    controle: lista(d.controle).map(lerItemControle),
    controle_origem: txt(d.controle_origem),
    ...lerModulos(d),
    id: txt(d.id) || novoId("obra"),
  };
}

/** Cópia profunda pronta para gravar (objeto JSON puro). */
export function exportarObra(o: Obra): Obra {
  return JSON.parse(JSON.stringify(o)) as Obra;
}

// ---------------------------------------------------------------- buscas

export function etapaDe(o: Obra, codigo: string): Etapa {
  const e = o.etapas.find((x) => x.codigo === codigo);
  if (!e) throw new ValidacaoErro(`Etapa não encontrada: ${codigo}`);
  return e;
}
export function compraDe(o: Obra, id: string): Compra {
  const c = o.compras.find((x) => x.id === id);
  if (!c) throw new ValidacaoErro("Compra não encontrada");
  return c;
}
export function tarefaDe(o: Obra, id: string): Tarefa {
  const t = o.tarefas.find((x) => x.id === id);
  if (!t) throw new ValidacaoErro("Tarefa não encontrada");
  return t;
}
export function itemControleDe(o: Obra, id: string): ItemControle {
  const i = o.controle.find((x) => x.id === id);
  if (!i) throw new ValidacaoErro("Item do controle de compras não encontrado");
  return i;
}
