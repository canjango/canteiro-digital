/**
 * Metodologia de compras: controle item a item no formato da planilha
 * "Controle e Gestão de Compras da Obra".
 *
 * 1. Base        — quantidade × preço de referência (orçado, sem BDI).
 * 2. Programação — "comprar até" = início da etapa − 7 dias (material) ou − 3 dias (mão de obra).
 * 3. Cotação     — até 3 fornecedores, à vista e a prazo; o menor preço é sugerido.
 * 4. Decisão     — forma de pagamento e nº de parcelas.
 * 5. Compra      — "Comprado" (exige cotação) e "Entregue".
 * 6. Controle    — diferença compra × base e fluxo mensal de pagamentos.
 */
import baseJson from "@/lib/dados/base-compras.json";
import {
  FORMAS_PAGAMENTO, STATUS_CONTROLE, baseBruta, compraBruta, diferencaItem, itemControleDe, totalCompraItem,
  type Cotacao, type ItemControle, type Obra, type StatusControle,
} from "./modelos";
import { ValidacaoErro, arred, arredPar, lerNumero, limparTexto, novoId, somarDias, somarMeses } from "./util";

type LinhaBase = [number, string, string, string, string, string, number, number, string, string, string, string, number];
export const AREA_REFERENCIA: number = baseJson.areaReferencia;
export const ORIGEM: string = baseJson.origem;
export const ETAPAS_BASE: readonly string[] = baseJson.etapas;
export const ITENS_BASE = baseJson.itens as unknown as LinhaBase[];
export const TOTAL_BASE_PLANILHA = arred(ITENS_BASE.reduce((s, i) => s + i[6] * i[7], 0));

export const ANTECEDENCIA = { material: 7, mao_de_obra: 3 } as const;
export const MAX_COTACOES = 3;

const UNIDADES_CONTAVEIS = new Set(["un", "vb", "chapa", "rolo", "jogo", "cj"]);
const ETAPA_FIXA: Record<string, string> = { "1": "PRE", "2": "FUN", "3": "EST", "4": "COB", "5": "ALV", "7": "LOU", "8": "ESQ" };

/** Liga o item da planilha à etapa da obra no sistema (prazo de compra e alertas). */
export function etapaSistema(etapaBase: string, grupo: string, descricao = ""): string {
  const n = (etapaBase || "").split(".")[0].trim();
  if (ETAPA_FIXA[n]) return ETAPA_FIXA[n];
  const t = `${grupo} ${descricao}`.toLowerCase();
  const tem = (...ks: string[]) => ks.some((k) => t.includes(k));
  if (n === "6") {
    if (tem("pint", "selador", "tinta", "massa acrílica", "pintor")) return "PIN";
    if (tem("forro", "gesso", "gesseiro")) return "FOR";
    if (tem("contrapiso", "piso", "porcelanato", "rodapé", "soleira")) return "PIS";
    return "REV";
  }
  if (n === "9") {
    if (tem("elétric", "eletric", "fio", "disjuntor", "tomada", "eletroduto", "quadro")) return "ELE";
    return "HID";
  }
  return "";
}

const cortar = (v: unknown, maximo = 200) => limparTexto(v).slice(0, maximo);

// --------------------------------------------------------------- carga da base
/** Carrega os itens da planilha. Não apaga nada: só funciona com o controle vazio. */
export function carregarBase(o: Obra, ajustarArea = false): number {
  if (o.controle.length) throw new ValidacaoErro("O controle de compras desta obra já tem itens");
  const fator = ajustarArea && o.area_construida ? o.area_construida / AREA_REFERENCIA : 1;
  for (const [ie, grupo, tipo, desc, espec, un, qtd, base, fonte, obs, marcas, forma, parc] of ITENS_BASE) {
    const etapaBase = ETAPAS_BASE[ie];
    let q = qtd;
    if (fator !== 1) {
      q = qtd * fator;
      q = UNIDADES_CONTAVEIS.has(un) || Number.isInteger(qtd) ? Math.max(1, arredPar(q)) : arred(q);
    }
    o.controle.push({
      descricao: desc,
      etapa_base: etapaBase,
      etapa: etapaSistema(etapaBase, grupo, desc),
      grupo,
      tipo: tipo === "MO" ? "mao_de_obra" : "material",
      especificacao: espec,
      unidade: un,
      quantidade: q,
      valor_base: base,
      cotacoes: [],
      escolhida: -1,
      forma: forma === "À Vista" || forma === "A Prazo" ? forma : "",
      parcelas: Math.trunc(parc || 0),
      status: "A cotar",
      data_compra: "",
      data_entrega: "",
      fonte_preco: fonte === "P" ? "pesquisado" : fonte === "E" ? "estimado" : "",
      qtd_estimada: marcas.includes("E"),
      novo: marcas.includes("N"),
      observacao: obs,
      id: novoId("ctl"),
    });
  }
  o.controle_origem = ORIGEM + (fator !== 1 ? ` · quantidades ajustadas para ${String(o.area_construida).replace(".", ",")} m²` : "");
  return ITENS_BASE.length;
}

/** Etapas do controle na ordem da planilha (as criadas pelo usuário no fim). */
export function etapasControle(o: Obra): string[] {
  const ordem = [...ETAPAS_BASE];
  for (const i of o.controle) if (!ordem.includes(i.etapa_base)) ordem.push(i.etapa_base);
  const presentes = new Set(o.controle.map((i) => i.etapa_base));
  return ordem.filter((e) => presentes.has(e));
}

// --------------------------------------------------------------- edição
/** Índice da cotação mais barata na forma de pagamento (−1 se não houver preço). */
export function melhorCotacao(cotacoes: Cotacao[], forma: string): number {
  let melhor: number | null = null;
  let idx = -1;
  cotacoes.forEach((c, i) => {
    const v = forma === "A Prazo" ? c.prazo || c.vista : c.vista || c.prazo;
    if (v && (melhor === null || v < melhor)) {
      melhor = v;
      idx = i;
    }
  });
  return idx;
}

export type DadosItem = Record<string, unknown>;

/**
 * Salva base, cotações, forma de pagamento e observação. Tudo é validado
 * antes de alterar o item (um erro não deixa o item pela metade).
 */
export function salvarItem(o: Obra, id: string, d: DadosItem): ItemControle {
  const atual = itemControleDe(o, id);
  const it: ItemControle = { ...atual, cotacoes: atual.cotacoes.map((c) => ({ ...c })) };
  if ("quantidade" in d) it.quantidade = lerNumero(d.quantidade, "Quantidade");
  if ("valor_base" in d) it.valor_base = lerNumero(d.valor_base, "Valor base");
  const temCotacoes = Array.from({ length: MAX_COTACOES }, (_, k) => k + 1)
    .some((n) => `fornecedor_${n}` in d || `vista_${n}` in d || `prazo_${n}` in d);
  // linha do formulário (0, 1, 2) → posição na lista de cotações (linhas vazias são descartadas)
  let posicaoDaLinha: (linha: number) => number = (linha) => linha;
  if (temCotacoes) {
    const cot: Cotacao[] = [];
    const posicoes = new Map<number, number>();
    for (let n = 1; n <= MAX_COTACOES; n++) {
      const forn = cortar(d[`fornecedor_${n}`]);
      const vista = lerNumero(d[`vista_${n}`], `À vista (cotação ${n})`);
      const prazo = lerNumero(d[`prazo_${n}`], `A prazo (cotação ${n})`);
      if (forn || vista || prazo) {
        posicoes.set(n - 1, cot.length);
        cot.push({ fornecedor: forn || `Fornecedor ${n}`, vista, prazo });
      }
    }
    it.cotacoes = cot;
    posicaoDaLinha = (linha) => posicoes.get(linha) ?? -1;
  }
  if ("forma" in d) {
    const forma = String(d.forma ?? "");
    if (forma && !(FORMAS_PAGAMENTO as readonly string[]).includes(forma)) throw new ValidacaoErro("Forma de pagamento inválida");
    it.forma = forma as ItemControle["forma"];
  }
  if ("parcelas" in d) {
    const p = Math.trunc(lerNumero(d.parcelas || 0, "Nº de parcelas"));
    if (p > 48) throw new ValidacaoErro("Nº de parcelas acima de 48 — confira");
    it.parcelas = p;
  }
  if (it.forma === "A Prazo" && it.parcelas < 1) it.parcelas = 1;
  if (it.forma === "À Vista") it.parcelas = 0;
  // cotação escolhida: a indicada pelo usuário, senão a mais barata ("automático")
  const esc = String(d.escolhida ?? "").trim();
  const escolhida = /^\d+$/.test(esc) ? posicaoDaLinha(Number(esc)) : -1;
  it.escolhida = escolhida >= 0 && escolhida < it.cotacoes.length ? escolhida : melhorCotacao(it.cotacoes, it.forma);
  if ("observacao" in d) it.observacao = cortar(d.observacao, 500);
  if ((it.status === "Comprado" || it.status === "Entregue") && !totalCompraItem(it)) {
    throw new ValidacaoErro("Item comprado precisa de uma cotação com preço");
  }
  if (it.cotacoes.length && it.status === "A cotar") it.status = "Cotação solicitada";
  Object.assign(atual, it);
  return atual;
}

export function mudarStatus(o: Obra, id: string, status: string, hoje: string): ItemControle {
  const it = itemControleDe(o, id);
  if (!(STATUS_CONTROLE as readonly string[]).includes(status)) throw new ValidacaoErro("Situação inválida");
  const comprado = status === "Comprado" || status === "Entregue";
  if (comprado && !totalCompraItem(it)) {
    throw new ValidacaoErro("Registre a cotação (fornecedor e preço) antes de marcar como comprado");
  }
  if (comprado && !it.forma) it.forma = "À Vista";
  if (comprado && !it.data_compra) it.data_compra = hoje;
  if (status === "Entregue" && !it.data_entrega) it.data_entrega = hoje;
  if (!comprado) {
    it.data_compra = "";
    it.data_entrega = "";
  }
  if (status === "Comprado") it.data_entrega = "";
  it.status = status as StatusControle;
  return it;
}

export function novoItem(o: Obra, d: DadosItem): ItemControle {
  const desc = cortar(d.descricao);
  if (!desc) throw new ValidacaoErro("Informe o material ou serviço");
  const etapaBase = cortar(d.etapa_base) || ETAPAS_BASE[0];
  const tipo = d.tipo === "mao_de_obra" ? "mao_de_obra" : "material";
  const grupo = cortar(d.grupo, 60) || (tipo === "mao_de_obra" ? "Mão de Obra" : "Material");
  const it: ItemControle = {
    descricao: desc,
    etapa_base: etapaBase,
    etapa: etapaSistema(etapaBase, grupo, desc),
    grupo,
    tipo,
    especificacao: cortar(d.especificacao),
    unidade: cortar(d.unidade, 20) || "un",
    quantidade: lerNumero(d.quantidade || 1, "Quantidade"),
    valor_base: lerNumero(d.valor_base, "Valor base"),
    cotacoes: [],
    escolhida: -1,
    forma: "",
    parcelas: 0,
    status: "A cotar",
    data_compra: "",
    data_entrega: "",
    fonte_preco: "",
    qtd_estimada: false,
    novo: true,
    observacao: "",
    id: novoId("ctl"),
  };
  o.controle.push(it);
  return it;
}

export function removerItem(o: Obra, id: string): void {
  const it = itemControleDe(o, id);
  if (it.status === "Comprado" || it.status === "Entregue") throw new ValidacaoErro("Item já comprado não pode ser removido");
  o.controle = o.controle.filter((x) => x !== it);
}

// --------------------------------------------------------------- análise
export function comprarAte(o: Obra, it: ItemControle): string | null {
  if (!it.etapa) return null;
  const e = o.etapas.find((x) => x.codigo === it.etapa);
  if (!e || !e.inicio_previsto) return null;
  return somarDias(e.inicio_previsto, -ANTECEDENCIA[it.tipo]);
}

export const pendente = (it: ItemControle) => it.status === "A cotar" || it.status === "Cotação solicitada";

export interface LinhaResumo {
  itens: number;
  base_materiais: number;
  base_mao_obra: number;
  base: number;
  compra: number;
  base_cotada: number;
  diferenca: number | null;
  variacao: number | null;
  comprados: number;
}

// somas feitas com os valores sem arredondar (arredonda só no total, como a planilha)
function resumir(itens: ItemControle[]): LinhaResumo {
  const mat = itens.filter((i) => i.tipo === "material").reduce((s, i) => s + baseBruta(i), 0);
  const mo = itens.filter((i) => i.tipo === "mao_de_obra").reduce((s, i) => s + baseBruta(i), 0);
  const compra = itens.reduce((s, i) => s + compraBruta(i), 0);
  const baseCotada = itens.filter((i) => totalCompraItem(i)).reduce((s, i) => s + baseBruta(i), 0);
  return {
    itens: itens.length,
    base_materiais: arred(mat),
    base_mao_obra: arred(mo),
    base: arred(mat + mo),
    compra: arred(compra),
    base_cotada: arred(baseCotada),
    diferenca: compra ? arred(baseCotada - compra) : null,
    variacao: compra && baseCotada ? (baseCotada - compra) / baseCotada : null,
    comprados: itens.filter((i) => !pendente(i)).length,
  };
}

export function resumo(o: Obra) {
  const linhas = new Map<string, LinhaResumo>();
  for (const e of etapasControle(o)) linhas.set(e, resumir(o.controle.filter((i) => i.etapa_base === e)));
  const geral = resumir(o.controle);
  return {
    linhas,
    ...geral,
    comprado: arred(o.controle.filter((i) => i.status === "Comprado" || i.status === "Entregue")
      .reduce((s, i) => s + compraBruta(i), 0)),
    status: new Map(STATUS_CONTROLE.map((s) => [s, o.controle.filter((i) => i.status === s).length])),
    qtd_estimada: o.controle.filter((i) => i.qtd_estimada).length,
    a_prazo: arred(o.controle.filter((i) => i.forma === "A Prazo" && (i.status === "Comprado" || i.status === "Entregue"))
      .reduce((s, i) => s + compraBruta(i), 0)),
  };
}

/**
 * Desembolso mensal dos itens comprados: à vista no mês da compra;
 * a prazo em parcelas mensais a partir do mês seguinte (como no cartão de crédito).
 */
export function fluxoPagamentos(o: Obra, hoje: string): Map<string, number> {
  const meses = new Map<string, number>();
  const somar = ([a, m]: [number, number], v: number) => {
    const chave = `${a}-${String(m).padStart(2, "0")}`;
    meses.set(chave, (meses.get(chave) ?? 0) + v);
  };
  for (const it of o.controle) {
    const total = totalCompraItem(it);
    if (!(it.status === "Comprado" || it.status === "Entregue") || !total) continue;
    const d = it.data_compra || hoje;
    if (it.forma === "A Prazo" && it.parcelas > 1) {
      for (let k = 1; k <= it.parcelas; k++) somar(somarMeses(d, k), total / it.parcelas);
    } else {
      somar(somarMeses(d, 0), total);
    }
  }
  return new Map(
    [...meses.entries()].sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => [`${k.slice(5, 7)}/${k.slice(0, 4)}`, arred(v)]),
  );
}

/** Itens ainda não comprados cujo prazo de compra vence em até `dias` (ou já venceu). */
export function programacao(o: Obra, hoje: string, dias = 30): [ItemControle, string][] {
  const limite = somarDias(hoje, dias);
  const out: [ItemControle, string][] = [];
  for (const it of o.controle) {
    if (!pendente(it)) continue;
    const ate = comprarAte(o, it);
    if (ate && ate <= limite) out.push([it, ate]);
  }
  return out.map((x, i) => [x, i] as const).sort((a, b) => a[0][1].localeCompare(b[0][1]) || a[1] - b[1]).map(([x]) => x);
}

export { diferencaItem };
