/**
 * Itens complementares da gestão de projetos: tarefas, orçamento por ambiente, biblioteca de produtos,
 * captura de produtos, templates, arquivos (links), despesas, financeiro consolidado e cronograma.
 * Sem React. Não importa valores de projetos.ts (só tipos) para evitar ciclo.
 */
import type { DadosProjetos, Fase, Projeto } from "./projetos";
import { ValidacaoErro, arred, diasEntre, lerData, lerNumero, lerOpcao, lerTexto, limparTexto, novoId, somarDias, somarMeses } from "./util";

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
const urlOk = (v: unknown, nome: string) => {
  const u = cortar(v, 600);
  if (u && !/^https?:\/\//i.test(u)) throw new ValidacaoErro(`${nome}: use um endereço que comece com http:// ou https://`);
  return u;
};
const achar = (g: DadosProjetos, id: string) => {
  const p = g.projetos.find((x) => x.id === id);
  if (!p) throw new ValidacaoErro("Projeto não encontrado");
  return p;
};

// ================================================================ tipos
export const STATUS_TAREFA = ["A fazer", "Em andamento", "Em revisão", "Concluída"] as const;
export const PRIORIDADES_TAREFA = ["Baixa", "Média", "Alta", "Urgente"] as const;
export interface TarefaProjeto {
  id: string;
  titulo: string;
  fase: string;
  responsavel: string;
  prazo: string;
  prioridade: (typeof PRIORIDADES_TAREFA)[number];
  status: (typeof STATUS_TAREFA)[number];
  checklist: { texto: string; feito: boolean }[];
  descricao: string;
  criada_em: string;
  concluida_em: string;
}

export const CATEGORIAS_PRODUTO = [
  "Revestimentos", "Louças e metais", "Iluminação", "Mobiliário", "Marcenaria", "Eletrodomésticos", "Esquadrias e vidros",
  "Tecidos e cortinas", "Decoração", "Paisagismo", "Elétrica e automação", "Climatização", "Outro",
] as const;
export const STATUS_ITEM = ["Especificado", "Aprovado pelo cliente", "Comprado", "Entregue"] as const;
export interface ItemOrcamento {
  id: string;
  ambiente: string;
  produto: string; // id na biblioteca ("" = avulso)
  descricao: string;
  categoria: string;
  quantidade: number;
  unidade: string;
  preco: number;
  fornecedor: string;
  link: string;
  status: (typeof STATUS_ITEM)[number];
}

export const PASTAS = ["Contrato e documentos", "Levantamento", "Estudos e apresentações", "Imagens e 3D", "Aprovação legal", "Projeto executivo", "Complementares", "Obra", "Outros"] as const;
export interface Arquivo {
  id: string;
  nome: string;
  pasta: (typeof PASTAS)[number];
  fase: string;
  disciplina: string;
  revisao: number;
  link: string;
  data: string;
  autor: string;
  observacao: string;
}

export const CATEGORIAS_DESPESA = [
  "Projetos complementares (terceiros)", "Taxas e aprovações", "RRT / ART", "Impressões e plotagens", "Deslocamento", "Maquete / renderização terceirizada", "Software e licenças", "Outros",
] as const;
export interface Despesa {
  id: string;
  data: string;
  descricao: string;
  categoria: (typeof CATEGORIAS_DESPESA)[number];
  valor: number;
  pago: boolean;
  fornecedor: string;
}

/** Campos que entram no Projeto. */
export interface ExtrasProjeto {
  tarefas: TarefaProjeto[];
  ambientes: string[];
  orcamento: ItemOrcamento[];
  arquivos: Arquivo[];
  despesas: Despesa[];
  template: string;
}

export interface Produto {
  id: string;
  nome: string;
  categoria: (typeof CATEGORIAS_PRODUTO)[number];
  marca: string;
  codigo: string;
  fornecedor: string;
  link: string;
  imagem: string;
  preco: number;
  unidade: string;
  dimensoes: string;
  acabamento: string;
  ambientes: string;
  observacao: string;
  origem: "Manual" | "Captura";
  atualizado_em: string;
}

export interface Template {
  id: string;
  nome: string;
  descricao: string;
  tipo_obra: string;
  padrao: string;
  pesos: Record<string, number>; // fase → %
  tarefas: { fase: string; titulo: string; prioridade: (typeof PRIORIDADES_TAREFA)[number] }[];
  entregaveis: { fase: string; disciplina: string; titulo: string }[];
  ambientes: string[];
  revisoes: number | null;
  padrao_sistema: boolean;
}

export interface ExtrasDados {
  produtos: Produto[];
  templates: Template[];
}

// ================================================================ templates padrão
const T = (fase: string, titulo: string, prioridade: TarefaProjeto["prioridade"] = "Média") => ({ fase, titulo, prioridade });
export const TEMPLATES_PADRAO: Template[] = [
  {
    id: "tpl-residencia-alto", nome: "Residência alto padrão", descricao: "Casa unifamiliar com projeto completo, aprovação e executivo detalhado",
    tipo_obra: "Residência unifamiliar", padrao: "Alto padrão", pesos: { LV: 5, PN: 5, EV: 5, EP: 15, AP: 25, PE: 35, CO: 10 }, revisoes: 3, padrao_sistema: true,
    tarefas: [
      T("LV", "Visita técnica e levantamento fotográfico", "Alta"), T("LV", "Solicitar levantamento planialtimétrico"), T("LV", "Consultar parâmetros urbanísticos e regras do condomínio"),
      T("PN", "Reunião de briefing com a família", "Alta"), T("PN", "Aprovar programa de necessidades"),
      T("EP", "Apresentar estudo preliminar", "Alta"), T("EP", "Imagens 3D da proposta"),
      T("AP", "Compatibilizar com o estrutural"), T("AP", "Emitir RRT"), T("AP", "Protocolar projeto legal na prefeitura", "Alta"),
      T("PE", "Detalhamento de marcenaria"), T("PE", "Paginação de pisos e revestimentos"), T("PE", "Memorial descritivo e especificações"),
      T("CO", "Reunião de compatibilização com projetistas"), T("CO", "Relatório de interferências"),
    ],
    entregaveis: [], ambientes: ["Sala de estar", "Sala de jantar", "Cozinha", "Área gourmet", "Suíte master", "Suítes", "Banheiros", "Lavabo", "Área de serviço", "Varanda", "Área externa / piscina"],
  },
  {
    id: "tpl-interiores", nome: "Interiores residencial", descricao: "Interiores com layout, marcenaria, iluminação e lista de compras",
    tipo_obra: "Interiores residencial", padrao: "Alto padrão", pesos: { LV: 5, PN: 5, EP: 20, AP: 25, PE: 35, AO: 10 }, revisoes: 3, padrao_sistema: true,
    tarefas: [
      T("LV", "Medição do imóvel", "Alta"), T("PN", "Briefing e referências do cliente"), T("EP", "Layout e moodboard"), T("AP", "Imagens 3D dos ambientes", "Alta"),
      T("PE", "Detalhamento de marcenaria"), T("PE", "Projeto luminotécnico"), T("PE", "Lista de compras e orçamento"), T("AO", "Acompanhar montagem e instalação"),
    ],
    entregaveis: [], ambientes: ["Sala de estar", "Sala de jantar", "Cozinha", "Home office", "Suíte master", "Quarto", "Banheiro social", "Lavabo", "Varanda"],
  },
  {
    id: "tpl-licitacao", nome: "Edificação pública (licitação)", descricao: "Projeto básico e executivo conforme Lei 14.133 e normas técnicas",
    tipo_obra: "Edifício público / administrativo", padrao: "Público", pesos: { LV: 5, PN: 5, EV: 5, EP: 15, AP: 20, PB: 15, PE: 25, CO: 10 }, revisoes: 1, padrao_sistema: true,
    tarefas: [
      T("LV", "Reunião de partida com a fiscalização do contrato", "Alta"), T("LV", "Levantamento cadastral e topográfico"),
      T("AP", "Acessibilidade (NBR 9050)"), T("AP", "Aprovação no Corpo de Bombeiros (PPCI)"),
      T("PB", "Orçamento sintético com referência SINAPI", "Alta"), T("PB", "Cronograma físico-financeiro"), T("PB", "Memorial descritivo e especificações técnicas"),
      T("PE", "ART/RRT de todas as disciplinas"), T("CO", "Compatibilização das disciplinas"), T("CO", "Entrega formal e termo de recebimento", "Alta"),
    ],
    entregaveis: [], ambientes: [],
  },
  {
    id: "tpl-comercial", nome: "Loja / comercial", descricao: "Ponto comercial com identidade visual, vitrine e aprovação",
    tipo_obra: "Loja / varejo", padrao: "Médio padrão", pesos: { LV: 5, PN: 5, EP: 20, AP: 25, PE: 35, CO: 10 }, revisoes: 2, padrao_sistema: true,
    tarefas: [T("LV", "Medição e levantamento das instalações"), T("PN", "Briefing de marca e fluxo de clientes"), T("EP", "Layout e vitrine"), T("AP", "Aprovação no shopping / prefeitura", "Alta"), T("PE", "Detalhamento de mobiliário e expositores"), T("CO", "Compatibilizar elétrica e climatização")],
    entregaveis: [], ambientes: ["Fachada / vitrine", "Salão de vendas", "Caixa", "Provadores", "Estoque", "Copa", "Banheiro"],
  },
  {
    id: "tpl-regularizacao", nome: "Regularização / legalização", descricao: "Levantamento e projeto legal para regularizar a edificação",
    tipo_obra: "Regularização / legalização", padrao: "Médio padrão", pesos: { LV: 30, AP: 70 }, revisoes: 1, padrao_sistema: true,
    tarefas: [T("LV", "Levantamento cadastral da edificação", "Alta"), T("LV", "Reunir documentos e certidões do imóvel"), T("AP", "Projeto legal de regularização"), T("AP", "Protocolo na prefeitura", "Alta"), T("AP", "Atender exigências"), T("AP", "Acompanhar emissão do habite-se")],
    entregaveis: [], ambientes: [],
  },
];

// ================================================================ leitura tolerante
export function lerExtrasProjeto(d: B): ExtrasProjeto {
  return {
    template: t_(d.template),
    ambientes: [...new Set(l_(d.ambientes).map((x) => cortar(x, 60)).filter(Boolean))],
    tarefas: l_(d.tarefas).map((x) => {
      const e = o_(x);
      return {
        id: t_(e.id) || novoId("tpj"), titulo: t_(e.titulo), fase: t_(e.fase), responsavel: t_(e.responsavel), prazo: d_(e.prazo),
        prioridade: op(e.prioridade, PRIORIDADES_TAREFA, "Média"), status: op(e.status, STATUS_TAREFA, "A fazer"),
        checklist: l_(e.checklist).map((c) => ({ texto: t_(o_(c).texto), feito: Boolean(o_(c).feito) })).filter((c) => c.texto),
        descricao: t_(e.descricao), criada_em: d_(e.criada_em), concluida_em: d_(e.concluida_em),
      };
    }).filter((x) => x.titulo),
    orcamento: l_(d.orcamento).map((x) => {
      const e = o_(x);
      return {
        id: t_(e.id) || novoId("orc"), ambiente: t_(e.ambiente) || "Geral", produto: t_(e.produto), descricao: t_(e.descricao), categoria: t_(e.categoria) || "Outro",
        quantidade: n_(e.quantidade, 1), unidade: t_(e.unidade) || "un", preco: n_(e.preco), fornecedor: t_(e.fornecedor), link: t_(e.link),
        status: op(e.status, STATUS_ITEM, "Especificado"),
      };
    }).filter((x) => x.descricao),
    arquivos: l_(d.arquivos).map((x) => {
      const e = o_(x);
      return {
        id: t_(e.id) || novoId("arq"), nome: t_(e.nome), pasta: op(e.pasta, PASTAS, "Outros"), fase: t_(e.fase), disciplina: t_(e.disciplina) || "Arquitetura",
        revisao: Math.max(0, Math.trunc(n_(e.revisao))), link: t_(e.link), data: d_(e.data), autor: t_(e.autor), observacao: t_(e.observacao),
      };
    }).filter((x) => x.nome),
    despesas: l_(d.despesas).map((x) => {
      const e = o_(x);
      return {
        id: t_(e.id) || novoId("dsp"), data: d_(e.data), descricao: t_(e.descricao), categoria: op(e.categoria, CATEGORIAS_DESPESA, "Outros"),
        valor: n_(e.valor), pago: Boolean(e.pago), fornecedor: t_(e.fornecedor),
      };
    }).filter((x) => x.valor > 0),
  };
}

function lerProduto(v: unknown): Produto | null {
  const d = o_(v);
  if (!d.nome) return null;
  return {
    id: t_(d.id) || novoId("prd"), nome: t_(d.nome), categoria: op(d.categoria, CATEGORIAS_PRODUTO, "Outro"), marca: t_(d.marca), codigo: t_(d.codigo),
    fornecedor: t_(d.fornecedor), link: t_(d.link), imagem: t_(d.imagem), preco: n_(d.preco), unidade: t_(d.unidade) || "un", dimensoes: t_(d.dimensoes),
    acabamento: t_(d.acabamento), ambientes: t_(d.ambientes), observacao: t_(d.observacao), origem: d.origem === "Captura" ? "Captura" : "Manual", atualizado_em: d_(d.atualizado_em),
  };
}

function lerTemplate(v: unknown): Template | null {
  const d = o_(v);
  if (!d.nome) return null;
  const pesos = Object.fromEntries(Object.entries(o_(d.pesos)).map(([k, x]) => [k, n_(x)]));
  return {
    id: t_(d.id) || novoId("tpl"), nome: t_(d.nome), descricao: t_(d.descricao), tipo_obra: t_(d.tipo_obra), padrao: t_(d.padrao), pesos,
    tarefas: l_(d.tarefas).map((x) => ({ fase: t_(o_(x).fase), titulo: t_(o_(x).titulo), prioridade: op(o_(x).prioridade, PRIORIDADES_TAREFA, "Média") })).filter((x) => x.titulo),
    entregaveis: l_(d.entregaveis).map((x) => ({ fase: t_(o_(x).fase), disciplina: t_(o_(x).disciplina) || "Arquitetura", titulo: t_(o_(x).titulo) })).filter((x) => x.titulo),
    ambientes: l_(d.ambientes).map((x) => t_(x)).filter(Boolean), revisoes: d.revisoes === null || d.revisoes === undefined ? null : n_(d.revisoes),
    padrao_sistema: Boolean(d.padrao_sistema),
  };
}

export function lerExtrasDados(d: B): ExtrasDados {
  const templates = Array.isArray(d.templates) ? l_(d.templates).map(lerTemplate).filter((x): x is Template => x !== null) : JSON.parse(JSON.stringify(TEMPLATES_PADRAO));
  return { produtos: l_(d.produtos).map(lerProduto).filter((x): x is Produto => x !== null), templates };
}

// ================================================================ tarefas
export function salvarTarefa(g: DadosProjetos, id: string, d: B, hoje: string): TarefaProjeto {
  const p = achar(g, id);
  const fase = t_(d.fase);
  if (fase && !p.fases.some((f) => f.codigo === fase)) throw new ValidacaoErro("Fase não está no projeto");
  const itens = String(d.checklist ?? "").split(/\r?\n/).map((x) => x.trim()).filter(Boolean).slice(0, 30);
  const dados = {
    titulo: lerTexto(d.titulo, "o título da tarefa"), fase, responsavel: cortar(d.responsavel, 80), prazo: lerData(d.prazo),
    prioridade: lerOpcao(d.prioridade ?? "Média", PRIORIDADES_TAREFA, "Prioridade"), descricao: cortar(d.descricao, 1000),
  };
  const tid = t_(d.tid);
  if (tid) {
    const t = p.tarefas.find((x) => x.id === tid);
    if (!t) throw new ValidacaoErro("Tarefa não encontrada");
    Object.assign(t, dados);
    if ("checklist" in d) {
      const antigos = new Map(t.checklist.map((c) => [c.texto, c.feito]));
      t.checklist = itens.map((texto) => ({ texto, feito: antigos.get(texto) ?? false }));
    }
    return t;
  }
  const t: TarefaProjeto = { id: novoId("tpj"), ...dados, status: "A fazer", checklist: itens.map((texto) => ({ texto, feito: false })), criada_em: hoje, concluida_em: "" };
  p.tarefas.push(t);
  return t;
}
const tarefaDe = (p: Projeto, tid: string) => {
  const t = p.tarefas.find((x) => x.id === tid);
  if (!t) throw new ValidacaoErro("Tarefa não encontrada");
  return t;
};
/** Regra: só conclui com o checklist todo marcado. */
export function moverTarefa(g: DadosProjetos, id: string, tid: string, status: string, hoje: string): TarefaProjeto {
  const t = tarefaDe(achar(g, id), tid);
  const novo = lerOpcao(status, STATUS_TAREFA, "Situação");
  if (novo === "Concluída" && t.checklist.some((c) => !c.feito)) throw new ValidacaoErro(`Faltam ${t.checklist.filter((c) => !c.feito).length} item(ns) do checklist para concluir “${t.titulo}”`);
  t.status = novo;
  t.concluida_em = novo === "Concluída" ? hoje : "";
  return t;
}
export function marcarItemTarefa(g: DadosProjetos, id: string, tid: string, indice: number): TarefaProjeto {
  const t = tarefaDe(achar(g, id), tid);
  const c = t.checklist[indice];
  if (!c) throw new ValidacaoErro("Item não encontrado");
  c.feito = !c.feito;
  if (!c.feito && t.status === "Concluída") { t.status = "Em andamento"; t.concluida_em = ""; }
  return t;
}
export function removerTarefa(g: DadosProjetos, id: string, tid: string) {
  const p = achar(g, id);
  tarefaDe(p, tid);
  p.tarefas = p.tarefas.filter((x) => x.id !== tid);
}
export const tarefaAtrasada = (t: TarefaProjeto, hoje: string) => t.status !== "Concluída" && !!t.prazo && t.prazo < hoje;

/** Todas as tarefas de projetos ativos, com o projeto junto. */
export function todasTarefas(g: DadosProjetos) {
  return g.projetos.filter((p) => p.status !== "Cancelado").flatMap((p) => p.tarefas.map((t) => ({ p, t })));
}

// ================================================================ ambientes e orçamento
export function salvarAmbientes(g: DadosProjetos, id: string, texto: unknown): Projeto {
  const p = achar(g, id);
  const novos = [...new Set(String(texto ?? "").split(/[\n,;]/).map((x) => cortar(x, 60)).filter(Boolean))];
  const usados = new Set(p.orcamento.map((i) => i.ambiente));
  const faltando = [...usados].filter((a) => a !== "Geral" && !novos.includes(a));
  if (faltando.length) throw new ValidacaoErro(`Há itens no orçamento em: ${faltando.join(", ")} — mova ou exclua os itens antes de remover o ambiente`);
  p.ambientes = novos;
  return p;
}

export function salvarItem(g: DadosProjetos, id: string, d: B): ItemOrcamento {
  const p = achar(g, id);
  const produto = t_(d.produto) ? g.produtos.find((x) => x.id === t_(d.produto)) : undefined;
  const ambiente = cortar(d.ambiente, 60) || "Geral";
  if (ambiente !== "Geral" && !p.ambientes.includes(ambiente)) p.ambientes.push(ambiente);
  const quantidade = lerNumero(d.quantidade ?? 1, "Quantidade");
  if (quantidade <= 0) throw new ValidacaoErro("Quantidade deve ser maior que zero");
  const precoTxt = String(d.preco ?? "").trim();
  const dados = {
    ambiente, produto: produto?.id ?? "",
    descricao: cortar(d.descricao, 200) || produto?.nome || lerTexto(d.descricao, "a descrição do item"),
    categoria: lerOpcao(d.categoria || produto?.categoria || "Outro", CATEGORIAS_PRODUTO, "Categoria"), quantidade,
    unidade: cortar(d.unidade, 20) || produto?.unidade || "un",
    preco: precoTxt ? lerNumero(precoTxt, "Preço unitário") : produto?.preco ?? 0,
    fornecedor: cortar(d.fornecedor, 120) || produto?.fornecedor || "", link: urlOk(d.link || produto?.link || "", "Link"),
    status: lerOpcao(d.status ?? "Especificado", STATUS_ITEM, "Situação"),
  };
  const iid = t_(d.iid);
  if (iid) {
    const i = p.orcamento.find((x) => x.id === iid);
    if (!i) throw new ValidacaoErro("Item não encontrado");
    Object.assign(i, dados);
    return i;
  }
  const i: ItemOrcamento = { id: novoId("orc"), ...dados };
  p.orcamento.push(i);
  return i;
}
export function statusItem(g: DadosProjetos, id: string, iid: string, status: string): ItemOrcamento {
  const i = achar(g, id).orcamento.find((x) => x.id === iid);
  if (!i) throw new ValidacaoErro("Item não encontrado");
  i.status = lerOpcao(status, STATUS_ITEM, "Situação");
  return i;
}
export function removerItem(g: DadosProjetos, id: string, iid: string) {
  const p = achar(g, id);
  if (!p.orcamento.some((x) => x.id === iid)) throw new ValidacaoErro("Item não encontrado");
  p.orcamento = p.orcamento.filter((x) => x.id !== iid);
}
export const totalItem = (i: ItemOrcamento) => arred(i.quantidade * i.preco);
export function resumoOrcamento(p: Projeto) {
  const porAmbiente = new Map<string, number>();
  const porCategoria = new Map<string, number>();
  const porStatus = new Map<string, number>();
  let total = 0;
  for (const i of p.orcamento) {
    const v = i.quantidade * i.preco;
    total += v;
    porAmbiente.set(i.ambiente, (porAmbiente.get(i.ambiente) ?? 0) + v);
    porCategoria.set(i.categoria, (porCategoria.get(i.categoria) ?? 0) + v);
    porStatus.set(i.status, (porStatus.get(i.status) ?? 0) + v);
  }
  const r = (m: Map<string, number>) => new Map([...m.entries()].map(([k, v]) => [k, arred(v)]));
  const aprovado = arred([...porStatus.entries()].filter(([k]) => k !== "Especificado").reduce((s, [, v]) => s + v, 0));
  return { total: arred(total), porAmbiente: r(porAmbiente), porCategoria: r(porCategoria), porStatus: r(porStatus), aprovado, por_m2: p.area ? arred(total / p.area) : 0, itens: p.orcamento.length, sem_preco: p.orcamento.filter((i) => !i.preco).length };
}

// ================================================================ biblioteca de produtos e captura
export function salvarProduto(g: DadosProjetos, d: B, hoje: string): Produto {
  const dados = {
    nome: lerTexto(d.nome, "o nome do produto"), categoria: lerOpcao(d.categoria ?? "Outro", CATEGORIAS_PRODUTO, "Categoria"), marca: cortar(d.marca, 80),
    codigo: cortar(d.codigo, 60), fornecedor: cortar(d.fornecedor, 120), link: urlOk(d.link, "Link do produto"), imagem: urlOk(d.imagem, "Imagem"),
    preco: lerNumero(d.preco, "Preço"), unidade: cortar(d.unidade, 20) || "un", dimensoes: cortar(d.dimensoes, 80), acabamento: cortar(d.acabamento, 120),
    ambientes: cortar(d.ambientes, 200), observacao: cortar(d.observacao, 500), origem: (d.origem === "Captura" ? "Captura" : "Manual") as Produto["origem"], atualizado_em: hoje,
  };
  const id = t_(d.id);
  if (id) {
    const x = g.produtos.find((y) => y.id === id);
    if (!x) throw new ValidacaoErro("Produto não encontrado");
    Object.assign(x, dados, { origem: x.origem });
    return x;
  }
  if (dados.link && g.produtos.some((y) => y.link === dados.link)) throw new ValidacaoErro("Este produto (mesmo link) já está na biblioteca");
  const x: Produto = { id: novoId("prd"), ...dados };
  g.produtos.push(x);
  return x;
}
export function removerProduto(g: DadosProjetos, id: string): Produto {
  const x = g.produtos.find((y) => y.id === id);
  if (!x) throw new ValidacaoErro("Produto não encontrado");
  g.produtos = g.produtos.filter((y) => y !== x);
  for (const p of g.projetos) for (const i of p.orcamento) if (i.produto === id) i.produto = "";
  return x;
}
/** Atualiza o preço do produto em todos os itens ainda “Especificado” que usam ele. */
export function propagarPreco(g: DadosProjetos, id: string): number {
  const x = g.produtos.find((y) => y.id === id);
  if (!x) throw new ValidacaoErro("Produto não encontrado");
  let n = 0;
  for (const p of g.projetos) for (const i of p.orcamento) if (i.produto === id && i.status === "Especificado" && i.preco !== x.preco) { i.preco = x.preco; n++; }
  return n;
}

/** Dados vindos da captura (atalho de favoritos): JSON ou só um link. */
export interface Captura { nome: string; link: string; imagem: string; preco: number; marca: string; fornecedor: string; codigo: string }
export function lerCaptura(texto: string): Captura {
  const t = String(texto ?? "").trim();
  if (!t) throw new ValidacaoErro("Cole o conteúdo capturado ou o link do produto");
  let d: B = {};
  if (t.startsWith("{")) {
    try { d = o_(JSON.parse(t)); } catch { throw new ValidacaoErro("O conteúdo colado não é uma captura válida"); }
  } else if (/^https?:\/\//i.test(t)) {
    d = { link: t };
  } else {
    try { d = o_(JSON.parse(decodeURIComponent(escape(atob(t))))); } catch { throw new ValidacaoErro("Cole o conteúdo capturado (começa com {) ou um link https://"); }
  }
  const link = cortar(d.link ?? d.url, 600);
  let fornecedor = cortar(d.loja ?? d.fornecedor ?? d.site, 120);
  if (!fornecedor && link) {
    try { fornecedor = new URL(link).hostname.replace(/^www\./, ""); } catch { /* link inválido: fica sem loja */ }
  }
  const precoTxt = String(d.preco ?? "").replace(/[^\d.,]/g, "");
  let preco = 0;
  if (precoTxt) {
    // "1.299,90" (pt-BR) ou "1299.90" (padrão das lojas no meta tag)
    const normal = /,\d{1,2}$/.test(precoTxt) ? precoTxt.replace(/\./g, "").replace(",", ".") : precoTxt.replace(/,/g, "");
    preco = Number(normal) || 0;
  }
  return {
    nome: cortar(d.nome ?? d.titulo ?? d.title, 200), link: /^https?:\/\//i.test(link) ? link : "", imagem: /^https?:\/\//i.test(t_(d.imagem)) ? cortar(d.imagem, 600) : "",
    preco: arred(preco), marca: cortar(d.marca, 80), fornecedor, codigo: cortar(d.codigo ?? d.sku, 60),
  };
}

/**
 * Código do atalho de favoritos (bookmarklet). Lê só metadados públicos da página da loja (título, imagem,
 * preço, marca, SKU via Open Graph, microdados e JSON-LD), copia para a área de transferência e,
 * se `app` for informado, abre o sistema com a captura no endereço (#captura=…), sem enviar nada a servidores.
 */
export function codigoCaptura(app: string): string {
  const js = `(function(){try{var q=function(s){var e=document.querySelector(s);return e?(e.getAttribute('content')||e.getAttribute('value')||e.textContent||'').trim():''};var d={nome:q('meta[property="og:title"]')||document.title,link:location.href.split('#')[0],imagem:q('meta[property="og:image"]'),preco:q('meta[property="product:price:amount"]')||q('meta[itemprop="price"]')||q('[itemprop="price"]'),marca:q('meta[property="product:brand"]')||q('[itemprop="brand"]'),loja:q('meta[property="og:site_name"]')||location.hostname.replace(/^www\\./,''),codigo:q('[itemprop="sku"]')};document.querySelectorAll('script[type="application/ld+json"]').forEach(function(s){try{var j=JSON.parse(s.textContent);(Array.isArray(j)?j:(j['@graph']||[j])).forEach(function(x){if(x&&/Product/.test(x['@type'])){d.nome=x.name||d.nome;var im=Array.isArray(x.image)?x.image[0]:x.image;d.imagem=(im&&im.url)||im||d.imagem;d.codigo=x.sku||d.codigo;d.marca=(x.brand&&(x.brand.name||x.brand))||d.marca;var o=Array.isArray(x.offers)?x.offers[0]:x.offers;if(o)d.preco=o.price||o.lowPrice||d.preco}})}catch(e){}});var t=JSON.stringify(d);var app=${JSON.stringify(app)};if(navigator.clipboard)navigator.clipboard.writeText(t).catch(function(){});if(app){window.open(app+'#captura='+encodeURIComponent(btoa(unescape(encodeURIComponent(t)))),'_blank')}else{prompt('Copie e cole na Biblioteca de produtos (Capturar):',t)}}catch(e){alert('Não foi possível capturar esta página.')}})();`;
  return `javascript:${js}`;
}

// ================================================================ arquivos (links)
export function salvarArquivo(g: DadosProjetos, id: string, d: B, hoje: string): Arquivo {
  const p = achar(g, id);
  const fase = t_(d.fase);
  if (fase && !p.fases.some((f) => f.codigo === fase)) throw new ValidacaoErro("Fase não está no projeto");
  const link = urlOk(d.link, "Link do arquivo");
  if (!link) throw new ValidacaoErro("Informe o link do arquivo (Google Drive, Dropbox, OneDrive…)");
  const dados = {
    nome: lerTexto(d.nome, "o nome do arquivo"), pasta: lerOpcao(d.pasta ?? "Outros", PASTAS, "Pasta"), fase, disciplina: cortar(d.disciplina, 40) || "Arquitetura",
    revisao: Math.max(0, Math.trunc(lerNumero(d.revisao ?? 0, "Revisão"))), link, autor: cortar(d.autor, 80), observacao: cortar(d.observacao, 300),
  };
  const aid = t_(d.aid);
  if (aid) {
    const a = p.arquivos.find((x) => x.id === aid);
    if (!a) throw new ValidacaoErro("Arquivo não encontrado");
    Object.assign(a, dados, { data: hoje });
    return a;
  }
  // mesmo nome na mesma pasta: vira nova revisão
  const anterior = p.arquivos.filter((x) => x.nome.toLowerCase() === dados.nome.toLowerCase() && x.pasta === dados.pasta).sort((a, b) => b.revisao - a.revisao)[0];
  if (anterior && !String(d.revisao ?? "").trim()) dados.revisao = anterior.revisao + 1;
  const a: Arquivo = { id: novoId("arq"), ...dados, data: hoje };
  p.arquivos.push(a);
  return a;
}
export function removerArquivo(g: DadosProjetos, id: string, aid: string) {
  const p = achar(g, id);
  if (!p.arquivos.some((x) => x.id === aid)) throw new ValidacaoErro("Arquivo não encontrado");
  p.arquivos = p.arquivos.filter((x) => x.id !== aid);
}
export function tipoArquivo(a: Arquivo): string {
  const u = `${a.link} ${a.nome}`.toLowerCase();
  if (/\.dwg|\.dxf/.test(u)) return "CAD";
  if (/\.rvt|\.ifc|\.skp/.test(u)) return "BIM / 3D";
  if (/\.pdf/.test(u)) return "PDF";
  if (/\.(jpe?g|png|webp)/.test(u)) return "Imagem";
  if (/\.(xlsx?|csv)|spreadsheets/.test(u)) return "Planilha";
  if (/\.(docx?)|document/.test(u)) return "Documento";
  if (/drive\.google|dropbox|onedrive|sharepoint/.test(u)) return "Nuvem";
  return "Link";
}

// ================================================================ despesas
export function salvarDespesa(g: DadosProjetos, id: string, d: B, hoje: string): Despesa {
  const p = achar(g, id);
  const valor = lerNumero(d.valor, "Valor");
  if (valor <= 0) throw new ValidacaoErro("Valor deve ser maior que zero");
  const x: Despesa = {
    id: novoId("dsp"), data: lerData(d.data) || hoje, descricao: lerTexto(d.descricao, "a descrição da despesa"),
    categoria: lerOpcao(d.categoria ?? "Outros", CATEGORIAS_DESPESA, "Categoria"), valor: arred(valor), pago: String(d.pago ?? "1") === "1", fornecedor: cortar(d.fornecedor, 120),
  };
  p.despesas.push(x);
  return x;
}
export function alternarPagamento(g: DadosProjetos, id: string, did: string): Despesa {
  const x = achar(g, id).despesas.find((y) => y.id === did);
  if (!x) throw new ValidacaoErro("Despesa não encontrada");
  x.pago = !x.pago;
  return x;
}
export function removerDespesa(g: DadosProjetos, id: string, did: string) {
  const p = achar(g, id);
  if (!p.despesas.some((x) => x.id === did)) throw new ValidacaoErro("Despesa não encontrada");
  p.despesas = p.despesas.filter((x) => x.id !== did);
}
export const totalDespesas = (p: Projeto) => arred(p.despesas.reduce((s, x) => s + x.valor, 0));

/** Fluxo de caixa mensal: entradas previstas/realizadas (parcelas) e saídas (despesas e horas). */
export function fluxoCaixa(g: DadosProjetos, hoje: string, mesesAntes = 3, mesesDepois = 8) {
  const [a, m] = [Number(hoje.slice(0, 4)), Number(hoje.slice(5, 7))];
  const meses: string[] = [];
  for (let k = -mesesAntes; k <= mesesDepois; k++) {
    const [y, mm] = somarMeses(`${a}-${String(m).padStart(2, "0")}-01`, k);
    meses.push(`${y}-${String(mm).padStart(2, "0")}`);
  }
  const linhas = meses.map((mes) => ({ mes, previsto: 0, recebido: 0, despesas: 0, horas: 0 }));
  const idx = new Map(meses.map((x, i) => [x, i]));
  for (const p of g.projetos) {
    if (p.status === "Cancelado") continue;
    for (const x of p.parcelas) {
      if (x.status === "Recebida") { const i = idx.get(x.recebido_em.slice(0, 7)); if (i !== undefined) linhas[i].recebido += x.valor; }
      else if (x.vencimento) { const i = idx.get(x.vencimento.slice(0, 7)); if (i !== undefined) linhas[i].previsto += x.valor; }
    }
    for (const x of p.despesas) { const i = idx.get(x.data.slice(0, 7)); if (i !== undefined) linhas[i].despesas += x.valor; }
    for (const h of p.horas) { const i = idx.get(h.data.slice(0, 7)); if (i !== undefined) linhas[i].horas += h.horas * h.custo_hora; }
  }
  return linhas.map((l) => ({ ...l, previsto: arred(l.previsto), recebido: arred(l.recebido), despesas: arred(l.despesas), horas: arred(l.horas), saldo: arred(l.recebido + l.previsto - l.despesas - l.horas) }));
}

// ================================================================ templates: aplicar e salvar
export function salvarTemplate(g: DadosProjetos & ExtrasDados, d: B): Template {
  const pesos: Record<string, number> = {};
  for (const [k, v] of Object.entries(d)) if (k.startsWith("peso_") && String(v).trim()) pesos[k.slice(5)] = lerNumero(v, `Peso ${k.slice(5)}`);
  const soma = arred(Object.values(pesos).reduce((s, v) => s + v, 0), 2);
  if (Object.keys(pesos).length && Math.abs(soma - 100) > 0.01) throw new ValidacaoErro(`Os pesos do template somam ${soma}% — ajuste para 100%`);
  const tarefas = String(d.tarefas ?? "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((l) => {
    const m = /^([A-Z]{2})\s*[:·-]\s*(.+)$/.exec(l);
    return { fase: m ? m[1] : "", titulo: cortar(m ? m[2] : l, 200), prioridade: "Média" as const };
  });
  const ambientes = [...new Set(String(d.ambientes ?? "").split(/[\n,;]/).map((x) => cortar(x, 60)).filter(Boolean))];
  const dados = {
    nome: lerTexto(d.nome, "o nome do template"), descricao: cortar(d.descricao, 300), tipo_obra: cortar(d.tipo_obra, 80), padrao: cortar(d.padrao, 40),
    pesos, tarefas, ambientes, revisoes: String(d.revisoes ?? "").trim() ? Math.max(0, Math.trunc(lerNumero(d.revisoes, "Revisões"))) : null,
  };
  const id = t_(d.id);
  if (id) {
    const x = g.templates.find((y) => y.id === id);
    if (!x) throw new ValidacaoErro("Template não encontrado");
    Object.assign(x, dados, { entregaveis: x.entregaveis });
    return x;
  }
  const x: Template = { id: novoId("tpl"), ...dados, entregaveis: [], padrao_sistema: false };
  g.templates.push(x);
  return x;
}

/** Template a partir de um projeto existente (fases/pesos, tarefas, entregáveis e ambientes). */
export function templateDoProjeto(g: DadosProjetos & ExtrasDados, id: string, nome: unknown): Template {
  const p = achar(g, id);
  const x: Template = {
    id: novoId("tpl"), nome: lerTexto(nome, "o nome do template"), descricao: `Criado a partir de ${p.codigo}`, tipo_obra: p.tipo_obra, padrao: p.padrao,
    pesos: Object.fromEntries(p.fases.map((f) => [f.codigo, f.peso])),
    tarefas: p.tarefas.map((t) => ({ fase: t.fase, titulo: t.titulo, prioridade: t.prioridade })),
    entregaveis: p.entregaveis.map((e) => ({ fase: e.fase, disciplina: e.disciplina, titulo: e.titulo })),
    ambientes: [...p.ambientes], revisoes: p.revisoes_incluidas, padrao_sistema: false,
  };
  g.templates.push(x);
  return x;
}

export function removerTemplate(g: DadosProjetos & ExtrasDados, id: string): Template {
  const x = g.templates.find((y) => y.id === id);
  if (!x) throw new ValidacaoErro("Template não encontrado");
  g.templates = g.templates.filter((y) => y !== x);
  return x;
}
export function restaurarTemplates(g: DadosProjetos & ExtrasDados): number {
  let n = 0;
  for (const t of TEMPLATES_PADRAO) if (!g.templates.some((x) => x.id === t.id)) { g.templates.push(JSON.parse(JSON.stringify(t))); n++; }
  return n;
}

/** Aplica o template ao projeto recém-criado: pesos das fases, tarefas (com prazo da fase), entregáveis e ambientes. */
export function aplicarTemplate(p: Projeto, t: Template, hoje: string, montarFases: (pesos: Record<string, number>) => Fase[]) {
  if (Object.keys(t.pesos).length) p.fases = montarFases(t.pesos);
  const prazoFase = (c: string) => p.fases.find((f) => f.codigo === c)?.prazo ?? "";
  for (const x of t.tarefas) {
    const fase = p.fases.some((f) => f.codigo === x.fase) ? x.fase : "";
    p.tarefas.push({ id: novoId("tpj"), titulo: x.titulo, fase, responsavel: p.responsavel, prazo: fase ? prazoFase(fase) : "", prioridade: x.prioridade, status: "A fazer", checklist: [], descricao: "", criada_em: hoje, concluida_em: "" });
  }
  for (const e of t.entregaveis) {
    if (!p.fases.some((f) => f.codigo === e.fase)) continue;
    p.entregaveis.push({ id: novoId("ent"), fase: e.fase, disciplina: e.disciplina, titulo: e.titulo, revisao: 0, status: "Em elaboração", responsavel: p.responsavel, data: hoje });
  }
  p.ambientes = [...new Set([...p.ambientes, ...t.ambientes])];
  if (t.revisoes !== null) p.revisoes_incluidas = t.revisoes;
  p.template = t.id;
}

// ================================================================ cronograma
export interface BarraCronograma { codigo: string; inicio: string; fim: string; concluida: boolean; atrasada: boolean }
/** Barras das fases (início → prazo). Sem início, a fase começa no prazo da anterior (ou no início do projeto). */
export function barrasProjeto(p: Projeto, hoje: string): BarraCronograma[] {
  let anterior = p.inicio;
  return p.fases.map((f) => {
    const inicio = f.inicio || anterior || f.prazo;
    const fim = f.prazo || inicio;
    if (f.prazo) anterior = f.prazo;
    return { codigo: f.codigo, inicio, fim, concluida: !!f.concluida_em, atrasada: !f.concluida_em && !!f.prazo && f.prazo < hoje };
  }).filter((b) => b.inicio && b.fim);
}
export function janelaCronograma(projetos: Projeto[], hoje: string) {
  const datas = projetos.flatMap((p) => [p.inicio, p.entrega, ...p.fases.map((f) => f.prazo)]).filter(Boolean).sort();
  const ini = datas[0] && datas[0] < hoje ? datas[0] : somarDias(hoje, -30);
  const fim = datas.at(-1) && datas.at(-1)! > hoje ? datas.at(-1)! : somarDias(hoje, 120);
  const inicio = `${ini.slice(0, 7)}-01`;
  const [a, m] = somarMeses(`${fim.slice(0, 7)}-01`, 1);
  const termino = `${a}-${String(m).padStart(2, "0")}-01`;
  return { inicio, fim: termino, dias: Math.max(1, diasEntre(inicio, termino)) };
}
