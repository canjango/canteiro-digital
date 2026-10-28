/** Regras de negócio: criação de obras, cronograma, checklists, compras, tarefas e lista de materiais. */
import {
  CAMPOS_DESCRITIVOS, CODIGOS_PADRAO, CUB_ESTADOS, ETAPAS_PADRAO, MODELO_VERSAO, PADRAO_INICIAL, UF_PADRAO,
  materialDaChave, materiaisDaEtapa, quantidadeParaArea, valorReferencia, type EtapaCatalogo, type MaterialAjustado,
} from "./catalogo";
import {
  CATEGORIAS_COMPRA, PRIORIDADES, STATUS_TAREFA, TRANSICOES_COMPRA, UNIDADES, compraDe, etapaDe, novoItemChecklist,
  tarefaDe, type Compra, type Etapa, type ItemChecklist, type Obra, type Prioridade, type StatusCompra,
  type StatusTarefa, type Tarefa,
} from "./modelos";
import {
  ValidacaoErro, arred, arredPar, diasEntre, hojeLocal, lerData, lerNumero, lerOpcao, lerTexto, limparTexto, novoId, somarDias,
} from "./util";

const clonar = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

// ============================================================== obra
export interface DadosObra {
  nome: string;
  cliente?: string;
  endereco?: string;
  responsavel_tecnico?: string;
  inicio?: string;
  fim_previsto?: string;
  orcamento_total?: unknown;
  exemplo?: boolean;
  area_construida?: unknown;
  padrao?: string;
  valor_m2?: unknown;
  bdi?: unknown;
  uf_cub?: string;
}

export const BDI_SUGERIDO = 25; // % típico de construtora em obra residencial (faixa usual 20% a 30%)

/** Cria a obra com as etapas padrão, orçamento distribuído pelo peso e cronograma pela sequência. */
export function criarObra(d: DadosObra): Obra {
  const ini = lerData(d.inicio);
  const fim = lerData(d.fim_previsto);
  if (ini && fim && fim <= ini) throw new ValidacaoErro("A data de término deve ser posterior ao início");
  const area = lerArea(d.area_construida);
  const uf = lerUf(d.uf_cub ?? UF_PADRAO);
  const [padrao, vm2] = resolverPadrao(d.padrao ?? PADRAO_INICIAL, d.valor_m2 ?? "", null, uf);
  // sem orçamento informado (em branco ou zero), estima pela área × valor do m² do padrão
  const orcInformado = lerNumero(d.orcamento_total ?? "", "Orçamento");
  const orc = orcInformado > 0 ? orcInformado : arred(area * vm2);
  const obra: Obra = {
    nome: lerTexto(d.nome, "o nome da obra"),
    cliente: lerTexto(d.cliente, "cliente", false),
    endereco: lerTexto(d.endereco, "endereço", false),
    responsavel_tecnico: lerTexto(d.responsavel_tecnico, "responsável técnico", false),
    inicio: ini,
    fim_previsto: fim,
    orcamento_total: orc,
    etapas: [],
    compras: [],
    tarefas: [],
    exemplo: Boolean(d.exemplo),
    area_construida: area,
    padrao,
    valor_m2: vm2,
    uf_cub: uf,
    bdi: lerBdi(d.bdi ?? 0),
    modelo_etapas: MODELO_VERSAO,
    revisoes: [],
    controle: [],
    controle_origem: "",
    solicitacoes: [],
    ordens: [],
    recebimentos: [],
    diario: [],
    medicoes: [],
    id: novoId("obra"),
  };
  obra.etapas = ETAPAS_PADRAO.map((e) => etapaDoCatalogo(e, orc));
  if (ini && fim) planejarCronograma(obra);
  return obra;
}

export function lerBdi(valor: unknown): number {
  const texto = String(valor ?? "").replace("%", "").trim();
  const b = lerNumero(texto, "BDI");
  if (b > 100) throw new ValidacaoErro("BDI acima de 100% — confira o valor (use a porcentagem, ex.: 25)");
  return arred(b);
}

export function lerArea(valor: unknown): number {
  const area = lerNumero(valor === null || valor === undefined || valor === "" ? 100 : valor, "Área construída");
  if (area < 10 || area > 5000) throw new ValidacaoErro("Área construída deve ficar entre 10 e 5.000 m²");
  return area;
}

export function lerUf(uf: unknown): string {
  const u = String(uf || UF_PADRAO).trim().toUpperCase();
  if (!(u in CUB_ESTADOS)) throw new ValidacaoErro(`Estado sem tabela CUB por padrão: ${u} — use o padrão Personalizado`);
  return u;
}

/**
 * Define padrão e R$/m².
 * - valor informado e diferente do gravado: vale o valor informado (custo próprio);
 * - caso contrário, usa o CUB do padrão no estado escolhido.
 * O padrão "Personalizado" exige um valor.
 */
export function resolverPadrao(
  padraoBruto: string, valorM2: unknown, anterior: [string, number] | null = null, uf: string = UF_PADRAO,
  ufAnterior: string | null = null,
): [string, number] {
  const padrao = padraoBruto || PADRAO_INICIAL;
  if (!CODIGOS_PADRAO.includes(padrao)) throw new ValidacaoErro(`Padrão construtivo inválido: '${padrao}'`);
  const informado = String(valorM2 ?? "").trim() ? lerNumero(valorM2, "Valor por m²") : 0;
  if (informado && (informado < 100 || informado > 50_000)) {
    throw new ValidacaoErro("Valor por m² deve ficar entre R$ 100 e R$ 50.000");
  }
  const mudouValor = Boolean(informado) && (anterior === null || Math.abs(informado - anterior[1]) >= 0.005);
  if (mudouValor) return [padrao, arred(informado)];
  // nada mudou (mesmo valor, padrão e estado): mantém o valor gravado, inclusive um custo próprio
  if (informado && anterior && padrao === anterior[0] && (ufAnterior === null || uf === ufAnterior)) {
    return [padrao, anterior[1]];
  }
  if (padrao === "PERS") {
    const atual = informado || (anterior ? anterior[1] : 0);
    if (!atual) throw new ValidacaoErro("Informe o valor por m² do padrão personalizado");
    return [padrao, arred(atual)];
  }
  return [padrao, valorReferencia(padrao, uf)];
}

export const custoEstimado = (o: Obra) => arred(o.area_construida * o.valor_m2);

/** Muda o orçamento total; etapas proporcionais ao peso acompanham, etapas ajustadas à mão ficam. */
export function redistribuirOrcamento(o: Obra, novoTotal: number): void {
  for (const e of o.etapas) {
    if (Math.abs(e.orcamento - arred((o.orcamento_total * e.peso) / 100)) < 0.01) {
      e.orcamento = arred((novoTotal * e.peso) / 100);
    }
  }
  o.orcamento_total = arred(novoTotal);
}

function etapaDoCatalogo(e: EtapaCatalogo, orcamentoTotal: number): Etapa {
  return {
    codigo: e.codigo,
    nome: e.nome,
    categoria: e.categoria,
    peso: e.peso,
    predecessoras: [...e.predecessoras],
    normas: [...e.normas],
    checklist: e.checklist.map(novoItemChecklist),
    inicio_previsto: "",
    fim_previsto: "",
    orcamento: arred((orcamentoTotal * e.peso) / 100),
    descricao: e.descricao,
    servicos: clonar(e.servicos),
    equipe: e.equipe,
    atencao: [...e.atencao],
    duracao_dias: e.duracao_dias,
    observacao: "",
  };
}

function copiarDescritivos(destino: Etapa, cat: EtapaCatalogo) {
  for (const c of CAMPOS_DESCRITIVOS) (destino as unknown as Record<string, unknown>)[c] = clonar(cat[c]);
}

/** Obras antigas ganham o detalhamento técnico (sem mexer em checklist, pesos ou valores). */
export function completarDetalhes(o: Obra): boolean {
  let mudou = false;
  for (const etapa of o.etapas) {
    const cat = ETAPAS_PADRAO.find((x) => x.codigo === etapa.codigo);
    if (cat && !etapa.descricao) {
      copiarDescritivos(etapa, cat);
      mudou = true;
    }
  }
  return mudou;
}

/** Atualiza as etapas para o catálogo atual preservando itens marcados, itens do usuário, datas e valores ajustados. */
export function aplicarModelo(o: Obra): { itens_novos: number } {
  const existentes = new Map(o.etapas.map((e) => [e.codigo, e]));
  const novas: Etapa[] = [];
  let itensNovos = 0;
  for (const cat of ETAPAS_PADRAO) {
    const atual = existentes.get(cat.codigo);
    existentes.delete(cat.codigo);
    if (!atual) {
      novas.push(etapaDoCatalogo(cat, o.orcamento_total));
      itensNovos += cat.checklist.length;
      continue;
    }
    const proporcional = Math.abs(atual.orcamento - arred((o.orcamento_total * atual.peso) / 100)) < 0.01;
    const porTexto = new Map<string, ItemChecklist>();
    for (const i of atual.checklist) if (!porTexto.has(i.texto)) porTexto.set(i.texto, i);
    const listaNova: ItemChecklist[] = [];
    const usados = new Set<ItemChecklist>();
    for (const texto of cat.checklist) {
      let item = porTexto.get(texto);
      if (item) porTexto.delete(texto);
      else {
        item = novoItemChecklist(texto);
        itensNovos += 1;
      }
      usados.add(item);
      listaNova.push(item);
    }
    listaNova.push(...atual.checklist.filter((i) => !usados.has(i))); // itens do usuário
    atual.checklist = listaNova;
    atual.nome = cat.nome;
    atual.categoria = cat.categoria;
    atual.peso = cat.peso;
    atual.predecessoras = [...cat.predecessoras];
    copiarDescritivos(atual, cat);
    if (proporcional) atual.orcamento = arred((o.orcamento_total * cat.peso) / 100);
    novas.push(atual);
  }
  novas.push(...existentes.values()); // etapas fora do catálogo ficam no fim
  o.etapas = novas;
  o.modelo_etapas = MODELO_VERSAO;
  return { itens_novos: itensNovos };
}

export function salvarObservacao(o: Obra, codigo: string, texto: unknown): Etapa {
  const etapa = etapaDe(o, codigo);
  const t = String(texto ?? "").replace(/\r\n/g, "\n").trim();
  if (t.length > 2000) throw new ValidacaoErro("Observação muito longa (máx. 2.000 caracteres)");
  etapa.observacao = t;
  return etapa;
}

/** Caminho crítico simplificado, escalado para caber entre início e término da obra. */
export function planejarCronograma(o: Obra): void {
  const ini = lerData(o.inicio);
  const fim = lerData(o.fim_previsto);
  if (!ini || !fim) throw new ValidacaoErro("Defina início e término da obra para planejar o cronograma");
  if (!o.etapas.length) return;
  const duracao = new Map(o.etapas.map((e) => [e.codigo, e.duracao_dias > 0 ? e.duracao_dias : Math.max(e.peso, 0.5)]));
  const iniRel = new Map<string, number>();
  const fimRel = new Map<string, number>();
  for (const e of o.etapas) {
    const i = Math.max(0, ...e.predecessoras.map((p) => fimRel.get(p) ?? 0));
    iniRel.set(e.codigo, i);
    fimRel.set(e.codigo, i + (duracao.get(e.codigo) ?? 1));
  }
  const total = Math.max(...fimRel.values());
  const dias = diasEntre(ini, fim);
  for (const e of o.etapas) {
    const a = somarDias(ini, arredPar(((iniRel.get(e.codigo) ?? 0) / total) * dias));
    const b = somarDias(ini, arredPar(((fimRel.get(e.codigo) ?? 0) / total) * dias));
    e.inicio_previsto = a;
    e.fim_previsto = b > a ? (somarDias(b, -1) > a ? somarDias(b, -1) : a) : a;
  }
}

export function atualizarEtapa(
  o: Obra, codigo: string, campos: { orcamento?: unknown; inicio_previsto?: unknown; fim_previsto?: unknown },
): Etapa {
  const etapa = etapaDe(o, codigo);
  if (campos.orcamento !== undefined) etapa.orcamento = lerNumero(campos.orcamento, "Orçamento da etapa");
  const ini = campos.inicio_previsto !== undefined ? lerData(campos.inicio_previsto) : lerData(etapa.inicio_previsto);
  const fim = campos.fim_previsto !== undefined ? lerData(campos.fim_previsto) : lerData(etapa.fim_previsto);
  if (ini && fim && fim < ini) throw new ValidacaoErro("O fim previsto da etapa não pode ser antes do início");
  if (campos.inicio_previsto !== undefined) etapa.inicio_previsto = ini;
  if (campos.fim_previsto !== undefined) etapa.fim_previsto = fim;
  return etapa;
}

// ============================================================== checklist
function alternar(item: ItemChecklist, hoje: string): ItemChecklist {
  item.feito = !item.feito;
  item.concluido_em = item.feito ? hoje : "";
  return item;
}

export function alternarItemEtapa(o: Obra, codigo: string, itemId: string, hoje = hojeLocal()): ItemChecklist {
  const item = etapaDe(o, codigo).checklist.find((i) => i.id === itemId);
  if (!item) throw new ValidacaoErro("Item de checklist não encontrado");
  return alternar(item, hoje);
}

export function marcarEtapa(o: Obra, codigo: string, feito: boolean, hoje = hojeLocal()): void {
  for (const item of etapaDe(o, codigo).checklist) if (item.feito !== feito) alternar(item, hoje);
}

export function adicionarItemEtapa(o: Obra, codigo: string, texto: unknown): ItemChecklist {
  const etapa = etapaDe(o, codigo);
  const item = novoItemChecklist(lerTexto(texto, "o texto do item"));
  etapa.checklist.push(item);
  return item;
}

export function removerItemEtapa(o: Obra, codigo: string, itemId: string): void {
  const etapa = etapaDe(o, codigo);
  const antes = etapa.checklist.length;
  etapa.checklist = etapa.checklist.filter((i) => i.id !== itemId);
  if (etapa.checklist.length === antes) throw new ValidacaoErro("Item de checklist não encontrado");
}

// ============================================================== compras
export interface DadosCompra {
  descricao: unknown;
  etapa: string;
  categoria?: unknown;
  quantidade?: unknown;
  unidade?: unknown;
  valor_unitario?: unknown;
  fornecedor?: unknown;
  prioridade?: unknown;
  data_necessidade?: unknown;
}

export function adicionarCompra(o: Obra, d: DadosCompra, hoje = hojeLocal()): Compra {
  etapaDe(o, d.etapa);
  const qtd = lerNumero(d.quantidade ?? 1, "Quantidade");
  if (qtd <= 0) throw new ValidacaoErro("Quantidade deve ser maior que zero");
  const compra: Compra = {
    descricao: lerTexto(d.descricao, "a descrição da compra"),
    etapa: d.etapa,
    categoria: lerOpcao(d.categoria ?? "Material", CATEGORIAS_COMPRA, "Categoria"),
    quantidade: qtd,
    unidade: lerOpcao(d.unidade ?? "un", UNIDADES, "Unidade"),
    valor_unitario: lerNumero(d.valor_unitario ?? 0, "Valor unitário"),
    fornecedor: lerTexto(d.fornecedor, "fornecedor", false),
    status: "Solicitada",
    prioridade: lerOpcao(d.prioridade ?? "Média", PRIORIDADES, "Prioridade") as Prioridade,
    data_necessidade: lerData(d.data_necessidade),
    data_entrega: "",
    historico: [{ data: hoje, status: "Solicitada" }],
    material: "",
    id: novoId("cmp"),
  };
  o.compras.push(compra);
  return compra;
}

export function mudarStatusCompra(o: Obra, id: string, novo: string, hoje = hojeLocal()): Compra {
  const c = compraDe(o, id);
  const permitidos = TRANSICOES_COMPRA[c.status] ?? [];
  if (!permitidos.includes(novo as StatusCompra)) {
    throw new ValidacaoErro(`Não é possível passar de '${c.status}' para '${novo}'`);
  }
  if ((novo === "Aprovada" || novo === "Pedido feito") && c.valor_unitario <= 0) {
    throw new ValidacaoErro("Informe o valor unitário antes de aprovar a compra");
  }
  c.status = novo as StatusCompra;
  c.data_entrega = novo === "Entregue" ? hoje : "";
  c.historico.push({ data: hoje, status: novo });
  return c;
}

export function atualizarPrecoCompra(o: Obra, id: string, valorUnitario: unknown, fornecedor?: unknown): Compra {
  const c = compraDe(o, id);
  if (c.status === "Pedido feito" || c.status === "Entregue") {
    throw new ValidacaoErro("Não é possível alterar o preço depois do pedido feito");
  }
  c.valor_unitario = lerNumero(valorUnitario, "Valor unitário");
  if (fornecedor !== undefined) c.fornecedor = lerTexto(fornecedor, "fornecedor", false);
  return c;
}

export function removerCompra(o: Obra, id: string): void {
  const c = compraDe(o, id);
  if (c.status === "Pedido feito" || c.status === "Entregue") {
    throw new ValidacaoErro("Compras com pedido feito ou entregues não podem ser excluídas; cancele-as");
  }
  o.compras = o.compras.filter((x) => x !== c);
}

// ============================================================== tarefas
export function adicionarTarefa(
  o: Obra,
  d: { titulo: unknown; etapa?: string; responsavel?: unknown; prazo?: unknown; prioridade?: unknown; itens?: string[] },
): Tarefa {
  if (d.etapa) etapaDe(o, d.etapa);
  const t: Tarefa = {
    titulo: lerTexto(d.titulo, "o título da tarefa"),
    etapa: d.etapa ?? "",
    responsavel: lerTexto(d.responsavel, "responsável", false, 80),
    prazo: lerData(d.prazo),
    prioridade: lerOpcao(d.prioridade ?? "Média", PRIORIDADES, "Prioridade") as Prioridade,
    status: "A fazer",
    checklist: (d.itens ?? []).filter((x) => String(x).trim()).map((x) => novoItemChecklist(lerTexto(x, "o item"))),
    concluida_em: "",
    id: novoId("tar"),
  };
  o.tarefas.push(t);
  return t;
}

export function mudarStatusTarefa(o: Obra, id: string, novo: string, hoje = hojeLocal()): Tarefa {
  const t = tarefaDe(o, id);
  lerOpcao(novo, STATUS_TAREFA, "Status");
  if (novo === "Concluída" && t.checklist.some((i) => !i.feito)) {
    throw new ValidacaoErro("Conclua todos os itens do checklist antes de concluir a tarefa");
  }
  t.status = novo as StatusTarefa;
  t.concluida_em = novo === "Concluída" ? hoje : "";
  return t;
}

export function alternarItemTarefa(o: Obra, id: string, itemId: string, hoje = hojeLocal()): ItemChecklist {
  const t = tarefaDe(o, id);
  const item = t.checklist.find((i) => i.id === itemId);
  if (!item) throw new ValidacaoErro("Item de checklist não encontrado");
  alternar(item, hoje);
  if (!item.feito && t.status === "Concluída") {
    t.status = "Em andamento"; // desmarcar reabre a tarefa
    t.concluida_em = "";
  } else if (item.feito && t.status === "A fazer") {
    t.status = "Em andamento"; // o primeiro item marcado inicia a tarefa
  }
  return item;
}

export function removerTarefa(o: Obra, id: string): void {
  const t = tarefaDe(o, id);
  o.tarefas = o.tarefas.filter((x) => x !== t);
}

// ============================================================== lista de materiais
export type SituacaoMaterial = "Não solicitado" | "Parcial" | "Entregue" | StatusCompra;
export interface LinhaMaterial extends MaterialAjustado {
  necessario: number;
  pedido: number;
  faltante: number;
  compras: Compra[];
  situacao: SituacaoMaterial;
}

const ORDEM_SITUACAO: StatusCompra[] = ["Solicitada", "Em cotação", "Aprovada", "Pedido feito", "Entregue"];

export function situacaoMateriais(o: Obra, codigo: string): LinhaMaterial[] {
  etapaDe(o, codigo);
  return materiaisDaEtapa(codigo, o.padrao, o.valor_m2, o.uf_cub).map((m) => {
    const necessario = quantidadeParaArea(m.qtd, m.un, o.area_construida);
    const compras = o.compras.filter((c) => c.material === m.chave && c.status !== "Cancelada");
    const pedido = Math.round(compras.reduce((s, c) => s + c.quantidade, 0) * 1000) / 1000;
    let situacao: SituacaoMaterial;
    if (!compras.length) situacao = "Não solicitado";
    else if (pedido + 1e-9 < necessario) situacao = "Parcial";
    else if (compras.every((c) => c.status === "Entregue")) situacao = "Entregue";
    else {
      situacao = compras
        .map((c) => c.status)
        .reduce((a, b) => (ORDEM_SITUACAO.indexOf(b) < ORDEM_SITUACAO.indexOf(a) ? b : a));
    }
    return {
      ...m, necessario, pedido, faltante: Math.max(0, Math.round((necessario - pedido) * 1000) / 1000), compras, situacao,
    };
  });
}

/** Data em que o material precisa chegar (7 dias antes do início da etapa) e prioridade. */
function prazoMaterial(o: Obra, codigo: string, hoje: string): [string, Prioridade] {
  const ini = etapaDe(o, codigo).inicio_previsto;
  if (!ini) return ["", "Média"];
  const chegada = somarDias(ini, -7);
  return [chegada > hoje ? chegada : hoje, diasEntre(hoje, ini) <= 15 ? "Alta" : "Média"];
}

export function solicitarMaterial(o: Obra, chave: string, quantidade: unknown = null, hoje = hojeLocal()): Compra {
  const m = materialDaChave(chave, o.padrao, o.valor_m2, o.uf_cub);
  if (!m) throw new ValidacaoErro("Material não encontrado na lista");
  const codigo = chave.split(":")[0];
  const linha = situacaoMateriais(o, codigo).find((x) => x.chave === chave)!;
  const qtd = quantidade === null || quantidade === undefined || quantidade === ""
    ? linha.faltante || linha.necessario
    : lerNumero(quantidade, "Quantidade");
  if (qtd <= 0) throw new ValidacaoErro("Quantidade deve ser maior que zero");
  const [data, prioridade] = prazoMaterial(o, codigo, hoje);
  const c = adicionarCompra(o, {
    descricao: m.material, etapa: codigo, categoria: m.categoria, quantidade: qtd, unidade: m.un,
    valor_unitario: 0, fornecedor: "", prioridade, data_necessidade: data,
  }, hoje);
  c.material = chave;
  return c;
}

/** Gera pedidos para todos os materiais da etapa ainda não solicitados. */
export function solicitarEtapa(o: Obra, codigo: string, hoje = hojeLocal()): number {
  const pendentes = situacaoMateriais(o, codigo).filter((x) => x.situacao === "Não solicitado");
  for (const x of pendentes) solicitarMaterial(o, x.chave, null, hoje);
  return pendentes.length;
}

export { limparTexto };
