/**
 * Estado da aplicação e despachante de ações. A interface chama
 * `despachar(acao, dados)` e recebe quais obras mudaram (para gravar).
 */
import * as ia from "./assistente";
import * as ct from "./controle";
import * as sv from "./servicos";
import { etapaConcluida } from "./analise";
import { CATEGORIAS, MATERIAIS, etapaPadrao } from "./catalogo";
import * as md from "./modulos";
import * as gs from "./gestao";
import { progressoEtapa } from "./analise";
import {
  STATUS_CONTROLE, etapaDe, exportarObra, itemControleDe, lerObra, type Obra,
} from "./modelos";
import { ValidacaoErro, hojeLocal, lerData, lerNumero, limparTexto, moeda, novoId, num, somarDias } from "./util";

export const ABAS = [
  "inicio", "painel", "etapas", "compras", "tarefas", "obras",
  "solicitacoes", "ordens", "recebimentos", "diario", "medicoes", "contatos", "insumos",
] as const;
/** Telas que funcionam sem obra selecionada (cadastros). */
export const ABAS_SEM_OBRA: readonly string[] = ["inicio", "obras", "contatos", "insumos"];
export type Aba = (typeof ABAS)[number];
export const FILTROS_COMPRA = ["abertas", "atrasadas", "todas", "Entregue", "Cancelada"] as const;
export type VistaCompras = "controle" | "pedidos" | "materiais";
export type ModoIa = "claude" | "chave" | "nenhum";

export const MODULOS = ["hub", "projetos", "obras", "equipe"] as const;
export type Modulo = (typeof MODULOS)[number];

export interface EstadoUi {
  /** Área do sistema: painel de acesso (hub), projetos, obras ou equipe. */
  modulo: Modulo;
  /** Sub-tela dentro de projetos/equipe (ex.: "membros", "presenca", "acessos"). */
  sub: string;
  obra: string;
  aba: Aba;
  abertas: string[]; // etapa selecionada na tela de etapas (a última)
  fase: string; // filtro de fase na tela de etapas
  filtro_compra: (typeof FILTROS_COMPRA)[number];
  filtro_etapa: string;
  form_compra: boolean;
  form_tarefa: boolean;
  confirmar_exclusao: string;
  msg: string;
  erro: string;
  ia_modo: ModoIa;
  ia_chave_final: string;
  ia_chave_permitida: boolean;
  ia_em_andamento: { id: string; obra: string; escopo: "obra" | "etapa"; codigo: string; foco: string } | null;
  rev_aberta: string;
  compras_vista: VistaCompras;
  ctrl_etapa: string;
  ctrl_status: string;
  ctrl_item: string;
  ctrl_excluir: string;
  ctrl_novo: boolean;
  figura: { codigo: string; item: string } | null;
  mat_abertas: string[];
  /** Registro aberto para edição/detalhe nas telas de módulos ("" = nenhum). */
  editando: string;
  /** Formulário de novo registro aberto (nome do módulo, "" = nenhum). */
  novo: string;
  /** Registro aguardando confirmação de exclusão. */
  confirmar: string;
}

export type Dados = Record<string, unknown>;
export interface Resultado {
  ok: boolean;
  alteradas: string[];
  removidas: string[];
  /** Os cadastros compartilhados (contatos e insumos) mudaram e precisam ser gravados. */
  cadastros?: boolean;
}

export const ERROS_IA: Record<string, string> = {
  sem_ia: "A revisão com Claude não está disponível aqui. Abra o sistema pela Claude ou conecte uma chave de API na aba Obras.",
  not_granted: "A revisão não foi autorizada. Clique de novo em revisar e permita o uso da Claude.",
  sampling_disabled: "A Claude não está disponível para esta conta.",
  session_expired: "Sua sessão na Claude expirou. Entre de novo e tente outra vez.",
  rate_limited: "Muitas revisões em pouco tempo. Espere um minuto e tente de novo.",
  cancelled: "Revisão cancelada.",
  chave_invalida: "A chave de API foi recusada. Confira a chave na aba Obras.",
  sem_credito: "A conta da chave de API está sem crédito ou atingiu o limite de gastos.",
  sobrecarga: "A Claude está sobrecarregada no momento. Tente de novo em alguns minutos.",
  rede: "Não foi possível falar com a Claude (sem internet ou bloqueio de rede).",
};

const s = (v: unknown) => (v === null || v === undefined ? "" : String(v));

type Acao = (d: Dados) => Partial<Resultado> | void;

export class Sistema {
  obras = new Map<string, Obra>();
  /** Pedido de revisão a enviar para a Claude (lido e limpo pela camada web). */
  pedidoIa: { id: string; texto: string } | null = null;
  ui: EstadoUi = {
    modulo: "hub",
    sub: "",
    obra: "",
    aba: "inicio",
    abertas: [],
    fase: "",
    filtro_compra: "abertas",
    filtro_etapa: "",
    form_compra: false,
    form_tarefa: false,
    confirmar_exclusao: "",
    msg: "",
    erro: "",
    ia_modo: "nenhum",
    ia_chave_final: "",
    ia_chave_permitida: false,
    ia_em_andamento: null,
    rev_aberta: "",
    compras_vista: "controle",
    ctrl_etapa: "",
    ctrl_status: "",
    ctrl_item: "",
    ctrl_excluir: "",
    ctrl_novo: false,
    figura: null,
    mat_abertas: [],
    editando: "",
    novo: "",
    confirmar: "",
  };
  /** Contatos e insumos, compartilhados entre as obras. */
  cadastros: md.Cadastros = { contatos: [], insumos: [], projetos: [], equipe: [] };

  constructor(private readonly hojeFixo: string | null = null) {}

  get hoje(): string {
    return this.hojeFixo ?? hojeLocal();
  }

  get obra(): Obra | null {
    return this.obras.get(this.ui.obra) ?? null;
  }

  private ativa(): Obra {
    const o = this.obra;
    if (!o) throw new ValidacaoErro("Selecione ou crie uma obra primeiro");
    return o;
  }

  /** Obras reais antes das de exemplo, depois em ordem alfabética. */
  ordenadas(): Obra[] {
    return [...this.obras.values()].sort((a, b) => Number(a.exemplo) - Number(b.exemplo) || a.nome.localeCompare(b.nome, "pt-BR"));
  }

  private garantirSelecao() {
    if (!this.obras.has(this.ui.obra)) this.ui.obra = this.ordenadas()[0]?.id ?? "";
  }

  // ------------------------------------------------------------ persistência
  /** Substitui as obras pelo conteúdo do banco; documentos inválidos são ignorados e reportados. */
  carregar(documentos: unknown[]): string[] {
    const novas = new Map<string, Obra>();
    const falhas: string[] = [];
    for (const doc of Array.isArray(documentos) ? documentos : []) {
      try {
        const o = lerObra(doc);
        sv.completarDetalhes(o);
        novas.set(o.id, o);
      } catch (e) {
        const id = doc && typeof doc === "object" ? s((doc as Dados).id) || "?" : "?";
        falhas.push(`${id}: ${(e as Error).message}`);
      }
    }
    this.obras = novas;
    this.garantirSelecao();
    // seleções que apontam para itens que sumiram
    const o = this.obra;
    if (this.ui.ia_em_andamento && !this.obras.has(this.ui.ia_em_andamento.obra)) this.ui.ia_em_andamento = null;
    if (o && this.ui.ctrl_item && !o.controle.some((i) => i.id === this.ui.ctrl_item)) this.ui.ctrl_item = "";
    if (o && this.ui.figura && !o.etapas.some((e) => e.codigo === this.ui.figura!.codigo)) this.ui.figura = null;
    return falhas;
  }

  exportar(id: string): Obra {
    return exportarObra(this.obras.get(id)!);
  }

  todas(): Obra[] {
    return [...this.obras.values()].map(exportarObra);
  }

  // ------------------------------------------------------------ despachante
  despachar(acao: string, dados: Dados = {}): Resultado {
    this.ui.msg = "";
    this.ui.erro = "";
    const fn = this.acoes[acao];
    if (!fn) {
      this.ui.erro = `Ação desconhecida: ${acao}`;
      return { ok: false, alteradas: [], removidas: [] };
    }
    try {
      const r = fn({ ...(dados ?? {}) }) ?? {};
      return { ok: true, alteradas: r.alteradas ?? [], removidas: r.removidas ?? [], cadastros: Boolean(r.cadastros) };
    } catch (e) {
      if (e instanceof ValidacaoErro) {
        this.ui.erro = e.message;
        return { ok: false, alteradas: [], removidas: [] };
      }
      throw e;
    }
  }

  private mudou(msg = ""): Partial<Resultado> {
    if (msg) this.ui.msg = msg;
    return { alteradas: [this.ui.obra] };
  }

  private mudouCadastro(msg: string): Partial<Resultado> {
    this.ui.msg = msg;
    return { cadastros: true };
  }

  /** Carrega os cadastros compartilhados vindos do banco. */
  carregarCadastros(doc: unknown): void {
    this.cadastros = md.lerCadastros(doc);
  }

  private limparEdicao() {
    Object.assign(this.ui, { editando: "", novo: "", confirmar: "" });
  }

  private readonly acoes: Record<string, Acao> = {
    // ---------------------------------------------------------- navegação
    "ui.modulo": (d) => {
      const m = s(d.modulo);
      if (!(MODULOS as readonly string[]).includes(m)) throw new ValidacaoErro("Área inválida");
      this.ui.modulo = m as Modulo;
      this.ui.sub = s(d.sub);
      this.ui.figura = null;
      this.limparEdicao();
      if (m === "obras" && !this.obra && !ABAS_SEM_OBRA.includes(this.ui.aba)) this.ui.aba = "inicio";
    },
    "ui.aba": (d) => {
      const aba = s(d.aba) || "painel";
      if (!(ABAS as readonly string[]).includes(aba)) throw new ValidacaoErro("Aba inválida");
      if (!this.obra && !ABAS_SEM_OBRA.includes(aba)) throw new ValidacaoErro("Selecione ou crie uma obra primeiro");
      this.ui.aba = aba as Aba;
      this.ui.confirmar_exclusao = "";
      this.ui.figura = null;
      if (s(d.vista)) {
        if (!["controle", "pedidos", "materiais"].includes(s(d.vista))) throw new ValidacaoErro("Vista inválida");
        this.ui.compras_vista = s(d.vista) as VistaCompras;
      }
      this.limparEdicao();
    },
    "ui.sub": (d) => {
      this.ui.sub = s(d.sub);
      this.limparEdicao();
    },
    "ui.editar": (d) => {
      const id = s(d.id);
      this.ui.editando = this.ui.editando === id ? "" : id;
      this.ui.confirmar = "";
      this.ui.novo = "";
    },
    "ui.novo": (d) => {
      const qual = s(d.qual);
      this.ui.novo = this.ui.novo === qual ? "" : qual;
      this.ui.editando = "";
      this.ui.confirmar = "";
    },
    "ui.cancelar": () => {
      this.ui.confirmar = "";
    },
    "ui.figura": (d) => {
      const etapa = etapaDe(this.ativa(), s(d.codigo));
      const item = s(d.item);
      if (item !== "_etapa" && !etapa.checklist.some((i) => i.id === item)) throw new ValidacaoErro("Item de checklist não encontrado");
      this.ui.figura = { codigo: etapa.codigo, item };
    },
    "ui.figura_fechar": () => {
      this.ui.figura = null;
    },
    "ui.expandir": (d) => {
      const cod = s(d.codigo);
      etapaDe(this.ativa(), cod);
      this.ui.abertas = [cod]; // mestre-detalhe: tocar numa etapa a seleciona
    },
    "ui.fase": (d) => {
      const fase = s(d.fase);
      if (fase && !CATEGORIAS.includes(fase)) throw new ValidacaoErro("Fase inválida");
      this.ui.fase = fase === this.ui.fase ? "" : fase;
    },
    "ui.fase_ir": (d) => {
      const o = this.ativa();
      const fase = s(d.fase);
      if (!CATEGORIAS.includes(fase)) throw new ValidacaoErro("Fase inválida");
      if (this.ui.aba === "etapas" && this.ui.fase === fase) {
        this.ui.fase = "";
        return;
      }
      this.ui.aba = "etapas";
      this.ui.fase = fase;
      this.ui.figura = null;
      const etapas = o.etapas.filter((e) => e.categoria === fase);
      const pend = etapas.filter((e) => !etapaConcluida(e));
      const alvo = (pend.length ? pend : etapas)[0];
      if (alvo) this.ui.abertas = [alvo.codigo];
    },
    "ui.filtro": (d) => {
      if ("filtro_compra" in d) {
        const f = s(d.filtro_compra);
        if (!(FILTROS_COMPRA as readonly string[]).includes(f)) throw new ValidacaoErro("Filtro inválido");
        this.ui.filtro_compra = f as EstadoUi["filtro_compra"];
      }
      if ("filtro_etapa" in d) {
        const f = s(d.filtro_etapa);
        if (f) etapaDe(this.ativa(), f);
        this.ui.filtro_etapa = f;
      }
    },
    "ui.form": (d) => {
      if (d.qual === "compra") this.ui.form_compra = !this.ui.form_compra;
      if (d.qual === "tarefa") this.ui.form_tarefa = !this.ui.form_tarefa;
    },
    "ui.vista_compras": (d) => {
      const v = s(d.vista) || "pedidos";
      if (!["controle", "pedidos", "materiais"].includes(v)) throw new ValidacaoErro("Vista inválida");
      this.ui.compras_vista = v as VistaCompras;
    },
    "ui.mat_expandir": (d) => {
      const cod = s(d.codigo);
      etapaDe(this.ativa(), cod);
      this.ui.mat_abertas = this.ui.mat_abertas.includes(cod)
        ? this.ui.mat_abertas.filter((x) => x !== cod)
        : [...this.ui.mat_abertas, cod];
    },

    // ---------------------------------------------------------- obras
    "obra.selecionar": (d) => {
      const id = s(d.id);
      if (!this.obras.has(id)) throw new ValidacaoErro("Obra não encontrada");
      Object.assign(this.ui, {
        obra: id, abertas: [], fase: "", figura: null, filtro_etapa: "", confirmar_exclusao: "", mat_abertas: [],
        ctrl_etapa: "", ctrl_status: "", ctrl_item: "", ctrl_excluir: "", ctrl_novo: false, rev_aberta: "",
        editando: "", novo: "", confirmar: "",
      });
      if (this.ui.aba === "obras") this.ui.aba = "inicio";
    },
    "obra.criar": (d) => {
      const o = sv.criarObra({
        nome: s(d.nome), cliente: s(d.cliente), endereco: s(d.endereco), responsavel_tecnico: s(d.responsavel_tecnico),
        inicio: s(d.inicio), fim_previsto: s(d.fim_previsto), orcamento_total: d.orcamento_total ?? "",
        area_construida: d.area_construida ?? 100, padrao: s(d.padrao) || "R1-N", valor_m2: d.valor_m2 ?? "",
        bdi: d.bdi ?? 0, uf_cub: s(d.uf_cub) || "SP",
      });
      this.obras.set(o.id, o);
      Object.assign(this.ui, {
        obra: o.id, aba: "etapas", abertas: [o.etapas[0].codigo], fase: "", filtro_etapa: "", mat_abertas: [],
        ctrl_etapa: "", ctrl_status: "", ctrl_item: "", ctrl_excluir: "", ctrl_novo: false,
      });
      return this.mudou(`Obra “${o.nome}” criada com ${o.etapas.length} etapas`);
    },
    "obra.exemplo": () => {
      const o = obraExemplo(this.hoje);
      this.obras.set(o.id, o);
      Object.assign(this.ui, { obra: o.id, aba: "painel", abertas: [], fase: "", ctrl_etapa: "", ctrl_item: "" });
      return this.mudou("Obra de exemplo criada");
    },
    "obra.editar": (d) => {
      const o = this.ativa();
      const ini = lerData(d.inicio);
      const fim = lerData(d.fim_previsto);
      if (ini && fim && fim <= ini) throw new ValidacaoErro("A data de término deve ser posterior ao início");
      const nome = limparTexto(d.nome);
      if (!nome) throw new ValidacaoErro("Informe o nome da obra");
      if (nome.length > 200) throw new ValidacaoErro("Nome muito longo (máx. 200 caracteres)");
      const area = sv.lerArea(d.area_construida ?? o.area_construida);
      const uf = sv.lerUf(d.uf_cub ?? o.uf_cub);
      const [padrao, vm2] = sv.resolverPadrao(s(d.padrao) || o.padrao, d.valor_m2 ?? "", [o.padrao, o.valor_m2], uf, o.uf_cub);
      // orçamento em branco ou zero = estimar pela área × valor do m² (como no cadastro)
      const orcInformado = lerNumero(d.orcamento_total ?? o.orcamento_total, "Orçamento");
      const novoOrc = orcInformado > 0 ? orcInformado : Math.round(area * vm2 * 100) / 100;
      const bdi = sv.lerBdi(d.bdi ?? o.bdi);
      // tudo validado: agora altera
      if (Math.abs(novoOrc - o.orcamento_total) >= 0.005) sv.redistribuirOrcamento(o, novoOrc);
      Object.assign(o, {
        area_construida: area, padrao, valor_m2: vm2, bdi, uf_cub: uf, nome,
        cliente: limparTexto(d.cliente).slice(0, 200), endereco: limparTexto(d.endereco).slice(0, 200),
        responsavel_tecnico: limparTexto(d.responsavel_tecnico).slice(0, 200), inicio: ini, fim_previsto: fim,
      });
      return this.mudou("Dados da obra salvos");
    },
    "obra.orcamento_padrao": () => {
      const o = this.ativa();
      const estimado = sv.custoEstimado(o);
      if (estimado <= 0) throw new ValidacaoErro("Defina área e valor por m² antes de calcular");
      sv.redistribuirOrcamento(o, estimado);
      return this.mudou(`Orçamento atualizado para ${moeda(estimado)} (área × valor do m²)`);
    },
    "obra.atualizar_modelo": () => {
      const o = this.ativa();
      const r = sv.aplicarModelo(o);
      if (o.inicio && o.fim_previsto) sv.planejarCronograma(o);
      return this.mudou(`Etapas atualizadas para o modelo de residência de 100 m² · ${r.itens_novos} itens novos de checklist`);
    },
    "obra.replanejar": () => {
      sv.planejarCronograma(this.ativa());
      return this.mudou("Cronograma das etapas recalculado");
    },
    "obra.excluir": (d) => {
      const id = s(d.id);
      if (!this.obras.has(id)) throw new ValidacaoErro("Obra não encontrada");
      if (this.ui.confirmar_exclusao !== id) {
        this.ui.confirmar_exclusao = id;
        return {};
      }
      const nome = this.obras.get(id)!.nome;
      this.obras.delete(id);
      this.ui.confirmar_exclusao = "";
      if (this.ui.ia_em_andamento?.obra === id) this.ui.ia_em_andamento = null;
      if (this.ui.obra === id) {
        Object.assign(this.ui, { obra: "", abertas: [], fase: "", ctrl_etapa: "", ctrl_item: "", figura: null });
      }
      this.garantirSelecao();
      this.ui.msg = `Obra “${nome}” excluída`;
      return { removidas: [id] };
    },
    "obra.cancelar_exclusao": () => {
      this.ui.confirmar_exclusao = "";
    },

    // ---------------------------------------------------------- revisão com Claude
    "ia.modo": (d) => {
      const modo = s(d.modo) || "nenhum";
      if (!["claude", "chave", "nenhum"].includes(modo)) throw new ValidacaoErro("Modo inválido");
      this.ui.ia_modo = modo as ModoIa;
      this.ui.ia_chave_final = modo === "chave" ? s(d.final).slice(-4) : "";
      this.ui.ia_chave_permitida = Boolean(d.chave_permitida);
    },
    "ia.revisar": (d) => {
      const o = this.ativa();
      if (this.ui.ia_em_andamento) throw new ValidacaoErro("Já existe uma revisão em andamento; aguarde ou cancele");
      if (this.ui.ia_modo === "nenhum") throw new ValidacaoErro(ERROS_IA.sem_ia);
      const escopo = s(d.escopo) === "etapa" ? "etapa" : "obra";
      const codigo = escopo === "etapa" ? s(d.codigo) : "";
      const foco = s(d.foco);
      const texto = ia.montarPedido(o, escopo, codigo, foco, this.hoje);
      const id = novoId("ia");
      this.ui.ia_em_andamento = { id, obra: o.id, escopo, codigo, foco };
      this.pedidoIa = { id, texto };
    },
    "ia.resultado": (d) => {
      const atual = this.ui.ia_em_andamento;
      if (!atual || s(d.id) !== atual.id) return {}; // resposta antiga ou cancelada
      this.ui.ia_em_andamento = null;
      if (d.erro) throw new ValidacaoErro(ERROS_IA[s(d.erro)] ?? `A revisão falhou: ${s(d.erro).slice(0, 200)}`);
      const o = this.obras.get(atual.obra);
      if (!o) throw new ValidacaoErro("A obra foi excluída durante a revisão");
      const resposta = ia.interpretarResposta(s(d.texto), o.etapas.map((e) => e.codigo));
      const origem = this.ui.ia_modo === "claude" ? "Claude" : "Claude (API)";
      const rev = ia.registrarRevisao(o, atual.escopo, atual.codigo, atual.foco, resposta, origem, this.hoje);
      this.ui.msg = rev.pontos.length ? `Revisão pronta: ${rev.pontos.length} ponto(s) para conferir` : "Revisão pronta";
      return { alteradas: [o.id] };
    },
    "ia.cancelar": () => {
      if (this.ui.ia_em_andamento) {
        this.ui.ia_em_andamento = null;
        this.pedidoIa = null;
        this.ui.msg = "Revisão cancelada";
      }
    },
    "ia.adicionar": (d) => {
      const o = this.ativa();
      const rev = ia.revisaoDe(o, s(d.rev));
      const idx = Number(d.idx);
      const sug = Number.isInteger(idx) && idx >= 0 ? rev.sugestoes[idx] : undefined;
      if (!sug) throw new ValidacaoErro("Sugestão não encontrada");
      const etapa = etapaDe(o, sug.etapa);
      if (!etapa.checklist.some((i) => i.texto.toLowerCase() === sug.texto.toLowerCase())) {
        sv.adicionarItemEtapa(o, etapa.codigo, sug.texto);
      }
      sug.adicionado = true;
      return this.mudou(`Item adicionado ao checklist de “${etapa.nome}”`);
    },
    "ia.apagar": (d) => {
      const o = this.ativa();
      const rev = ia.revisaoDe(o, s(d.rev));
      o.revisoes = o.revisoes.filter((r) => r !== rev);
      return this.mudou("Revisão apagada");
    },
    "ia.abrir": (d) => {
      const id = s(d.rev);
      this.ui.rev_aberta = this.ui.rev_aberta === id ? "" : id;
    },

    // ---------------------------------------------------------- etapas
    "etapa.item": (d) => {
      sv.alternarItemEtapa(this.ativa(), s(d.codigo), s(d.item), this.hoje);
      return this.mudou();
    },
    "etapa.todos": (d) => {
      const feito = ["1", "true", "sim"].includes(s(d.feito).toLowerCase());
      sv.marcarEtapa(this.ativa(), s(d.codigo), feito, this.hoje);
      return this.mudou(feito ? "Etapa marcada como concluída" : "Checklist da etapa reaberto");
    },
    "etapa.novo_item": (d) => {
      sv.adicionarItemEtapa(this.ativa(), s(d.codigo), d.texto);
      return this.mudou("Item adicionado");
    },
    "etapa.remover_item": (d) => {
      const o = this.ativa();
      sv.removerItemEtapa(o, s(d.codigo), s(d.item));
      if (this.ui.figura?.item === s(d.item)) this.ui.figura = null;
      return this.mudou("Item removido");
    },
    "etapa.observacao": (d) => {
      const e = sv.salvarObservacao(this.ativa(), s(d.codigo), d.observacao);
      return this.mudou(e.observacao ? `Observação de “${e.nome}” salva` : `Observação de “${e.nome}” apagada`);
    },
    "etapa.salvar": (d) => {
      sv.atualizarEtapa(this.ativa(), s(d.codigo), {
        orcamento: d.orcamento, inicio_previsto: d.inicio_previsto, fim_previsto: d.fim_previsto,
      });
      return this.mudou("Etapa atualizada");
    },

    // ---------------------------------------------------------- compras (pedidos)
    "compra.criar": (d) => {
      const c = sv.adicionarCompra(this.ativa(), {
        descricao: d.descricao, etapa: s(d.etapa), categoria: d.categoria || "Material", quantidade: d.quantidade ?? 1,
        unidade: d.unidade || "un", valor_unitario: d.valor_unitario ?? 0, fornecedor: d.fornecedor ?? "",
        prioridade: d.prioridade || "Média", data_necessidade: d.data_necessidade ?? "",
      }, this.hoje);
      this.ui.form_compra = false;
      return this.mudou(`Compra “${c.descricao}” solicitada`);
    },
    "compra.status": (d) => {
      const c = sv.mudarStatusCompra(this.ativa(), s(d.id), s(d.status), this.hoje);
      return this.mudou(`${c.descricao}: ${c.status}`);
    },
    "compra.preco": (d) => {
      const c = sv.atualizarPrecoCompra(this.ativa(), s(d.id), d.valor_unitario ?? 0, "fornecedor" in d ? d.fornecedor : undefined);
      return this.mudou(`Cotação de “${c.descricao}” registrada`);
    },
    "compra.remover": (d) => {
      sv.removerCompra(this.ativa(), s(d.id));
      return this.mudou("Compra excluída");
    },

    // ---------------------------------------------------------- lista de materiais
    "mat.solicitar": (d) => {
      const c = sv.solicitarMaterial(this.ativa(), s(d.chave), d.quantidade ?? null, this.hoje);
      return this.mudou(`Pedido criado: ${c.descricao} (${num(c.quantidade)} ${c.unidade}) — informe o preço na cotação`);
    },
    "mat.solicitar_etapa": (d) => {
      const o = this.ativa();
      const cod = s(d.codigo);
      const n = sv.solicitarEtapa(o, cod, this.hoje);
      if (!n) throw new ValidacaoErro("Todos os materiais desta etapa já foram solicitados");
      return this.mudou(`${n} pedido(s) de compra criados para “${etapaDe(o, cod).nome}” — informe os preços na cotação`);
    },

    // ---------------------------------------------------------- controle de compras (metodologia)
    "ctrl.carregar": (d) => {
      const n = ct.carregarBase(this.ativa(), s(d.ajustar) === "1");
      Object.assign(this.ui, { ctrl_etapa: "", ctrl_status: "", ctrl_item: "", ctrl_excluir: "" });
      return this.mudou(`${n} itens da planilha de compras carregados no controle`);
    },
    "ui.ctrl_etapa": (d) => {
      const e = s(d.etapa);
      if (e && !ct.etapasControle(this.ativa()).includes(e)) throw new ValidacaoErro("Etapa não encontrada no controle");
      Object.assign(this.ui, { ctrl_etapa: e, ctrl_item: "", ctrl_excluir: "", ctrl_novo: false });
    },
    "ui.ctrl_status": (d) => {
      const st = s(d.status);
      if (st && !(STATUS_CONTROLE as readonly string[]).includes(st)) throw new ValidacaoErro("Situação inválida");
      this.ui.ctrl_status = st === this.ui.ctrl_status ? "" : st;
    },
    "ui.ctrl_item": (d) => {
      const it = itemControleDe(this.ativa(), s(d.id));
      this.ui.ctrl_item = this.ui.ctrl_item === it.id ? "" : it.id;
      this.ui.ctrl_excluir = "";
    },
    "ui.ctrl_cancelar_remocao": () => {
      this.ui.ctrl_excluir = "";
    },
    "ui.ctrl_novo": () => {
      this.ui.ctrl_novo = !this.ui.ctrl_novo;
    },
    "ctrl.salvar": (d) => {
      const it = ct.salvarItem(this.ativa(), s(d.id), d);
      this.ui.ctrl_item = "";
      return this.mudou(`“${it.descricao}” atualizado`);
    },
    "ctrl.status": (d) => {
      const it = ct.mudarStatus(this.ativa(), s(d.id), s(d.status), this.hoje);
      return this.mudou(`“${it.descricao}”: ${it.status.toLowerCase()}`);
    },
    "ctrl.novo": (d) => {
      const it = ct.novoItem(this.ativa(), d);
      Object.assign(this.ui, { ctrl_etapa: it.etapa_base, ctrl_novo: false });
      return this.mudou(`Item “${it.descricao}” incluído`);
    },
    "ctrl.remover": (d) => {
      const o = this.ativa();
      const it = itemControleDe(o, s(d.id));
      if (this.ui.ctrl_excluir !== it.id) {
        this.ui.ctrl_excluir = it.id;
        return {};
      }
      ct.removerItem(o, it.id);
      Object.assign(this.ui, { ctrl_excluir: "", ctrl_item: "" });
      return this.mudou(`Item “${it.descricao}” removido do controle`);
    },

    // ---------------------------------------------------------- cadastros: contatos e insumos
    "contato.salvar": (d) => {
      const c = md.salvarContato(this.cadastros, d);
      this.limparEdicao();
      return this.mudouCadastro(s(d.id) ? `Contato “${c.nome}” atualizado` : `Contato “${c.nome}” cadastrado`);
    },
    "contato.remover": (d) => {
      const id = s(d.id);
      if (this.ui.confirmar !== id) {
        this.ui.confirmar = id;
        return {};
      }
      const c = md.removerContato(this.cadastros, id);
      this.limparEdicao();
      return this.mudouCadastro(`Contato “${c.nome}” excluído`);
    },
    "insumo.salvar": (d) => {
      const i = md.salvarInsumo(this.cadastros, d, this.hoje);
      this.limparEdicao();
      return this.mudouCadastro(s(d.id) ? `Insumo “${i.descricao}” atualizado` : `Insumo “${i.descricao}” cadastrado`);
    },
    "insumo.remover": (d) => {
      const id = s(d.id);
      if (this.ui.confirmar !== id) {
        this.ui.confirmar = id;
        return {};
      }
      const i = md.removerInsumo(this.cadastros, id);
      this.limparEdicao();
      return this.mudouCadastro(`Insumo “${i.descricao}” excluído`);
    },
    "insumo.importar": (d) => {
      const origem = s(d.origem);
      const novos: Omit<md.Insumo, "id" | "atualizado_em">[] = [];
      if (origem === "planilha") {
        for (const [ie, grupo, tipo, desc, , un, , base] of ct.ITENS_BASE) {
          novos.push({
            codigo: "", descricao: desc, unidade: un, tipo: tipo === "MO" ? "Mão de obra" : "Material",
            grupo: `${ct.ETAPAS_BASE[ie]} · ${grupo}`, preco: base, fonte: "Planilha de compras (out/2026)",
          });
        }
      } else if (origem === "materiais") {
        for (const [codigo, lista] of Object.entries(MATERIAIS)) {
          const etapa = etapaPadrao(codigo).nome;
          for (const m of lista) {
            novos.push({
              codigo: m.chave, descricao: m.material, unidade: m.un, preco: 0, grupo: etapa, fonte: "Lista de materiais (catálogo)",
              tipo: m.categoria === "Equipamento/locação" ? "Equipamento" : m.categoria === "Serviço terceirizado" ? "Serviço" : "Material",
            });
          }
        }
      } else if (origem === "ordens") {
        const o = this.ativa();
        for (const oc of [...o.ordens].filter(md.ocComprometida).sort((a, b) => b.data.localeCompare(a.data))) {
          for (const it of oc.itens) {
            if (it.valor_unitario > 0) {
              novos.push({
                codigo: "", descricao: it.descricao, unidade: it.unidade, tipo: "Material", grupo: "", preco: it.valor_unitario,
                fonte: `${md.numeroOC(oc.numero)} · ${oc.fornecedor}`,
              });
            }
          }
        }
      } else throw new ValidacaoErro("Origem de importação inválida");
      const n = md.importarInsumos(this.cadastros, novos, this.hoje);
      return this.mudouCadastro(n ? `${n} insumo(s) importado(s)` : "Nenhum insumo novo: todos já estavam cadastrados");
    },

    // ---------------------------------------------------------- solicitações de compra
    "sol.criar": (d) => {
      const x = md.criarSolicitacao(this.ativa(), d, this.hoje);
      this.limparEdicao();
      return this.mudou(`${md.numeroSC(x.numero)} enviada para aprovação`);
    },
    "sol.aprovar": (d) => {
      const x = md.decidirSolicitacao(this.ativa(), s(d.id), true);
      return this.mudou(`${md.numeroSC(x.numero)} aprovada — gere a ordem de compra`);
    },
    "sol.recusar": (d) => {
      const x = md.decidirSolicitacao(this.ativa(), s(d.id), false, s(d.motivo));
      this.limparEdicao();
      return this.mudou(`${md.numeroSC(x.numero)} recusada`);
    },
    "sol.remover": (d) => {
      const id = s(d.id);
      if (this.ui.confirmar !== id) {
        this.ui.confirmar = id;
        return {};
      }
      md.removerSolicitacao(this.ativa(), id);
      this.limparEdicao();
      return this.mudou("Solicitação excluída");
    },

    // ---------------------------------------------------------- ordens de compra
    "oc.criar": (d) => {
      const oc = md.criarOrdem(this.ativa(), this.cadastros, d, this.hoje);
      this.limparEdicao();
      this.ui.aba = "ordens";
      this.ui.editando = oc.id;
      return this.mudou(`${md.numeroOC(oc.numero)} criada em rascunho — confira preços e aprove`);
    },
    "oc.editar": (d) => {
      const oc = md.editarOrdem(this.ativa(), s(d.id), d);
      return this.mudou(`${md.numeroOC(oc.numero)} salva`);
    },
    "oc.status": (d) => {
      const oc = md.mudarStatusOrdem(this.ativa(), s(d.id), s(d.status), s(d.aprovador));
      return this.mudou(`${md.numeroOC(oc.numero)}: ${oc.status.toLowerCase()}`);
    },
    "oc.receber": (d) => {
      const oc = md.receberMaterial(this.ativa(), s(d.id), d, this.hoje);
      return this.mudou(`Recebimento registrado na ${md.numeroOC(oc.numero)} (${oc.status.toLowerCase()})`);
    },
    "oc.remover": (d) => {
      const id = s(d.id);
      if (this.ui.confirmar !== id) {
        this.ui.confirmar = id;
        return {};
      }
      md.removerOrdem(this.ativa(), id);
      this.limparEdicao();
      return this.mudou("Ordem de compra excluída");
    },

    // ---------------------------------------------------------- recebimentos (contas a receber)
    "rec.criar": (d) => {
      const r = md.criarRecebimento(this.ativa(), d);
      this.limparEdicao();
      return this.mudou(`Recebimento “${r.descricao}” lançado`);
    },
    "rec.parcelas": (d) => {
      const n = md.gerarParcelas(this.ativa(), d);
      this.limparEdicao();
      return this.mudou(`${n} parcela(s) geradas`);
    },
    "rec.baixar": (d) => {
      const r = md.baixarRecebimento(this.ativa(), s(d.id), d, this.hoje);
      this.limparEdicao();
      return this.mudou(`“${r.descricao}” recebido`);
    },
    "rec.estornar": (d) => {
      const r = md.estornarRecebimento(this.ativa(), s(d.id));
      return this.mudou(`“${r.descricao}” voltou para previsto`);
    },
    "rec.remover": (d) => {
      const id = s(d.id);
      if (this.ui.confirmar !== id) {
        this.ui.confirmar = id;
        return {};
      }
      md.removerRecebimento(this.ativa(), id);
      this.limparEdicao();
      return this.mudou("Recebimento excluído");
    },

    // ---------------------------------------------------------- diário de obra
    "rdo.salvar": (d) => {
      const x = md.salvarDiario(this.ativa(), d);
      this.limparEdicao();
      return this.mudou(`Diário de ${x.data.split("-").reverse().join("/")} salvo`);
    },
    "rdo.remover": (d) => {
      const id = s(d.id);
      if (this.ui.confirmar !== id) {
        this.ui.confirmar = id;
        return {};
      }
      md.removerDiario(this.ativa(), id);
      this.limparEdicao();
      return this.mudou("Diário excluído");
    },

    // ---------------------------------------------------------- medição de obra
    "med.criar": (d) => {
      const o = this.ativa();
      const m = md.criarMedicao(o, d, this.hoje, (cod) => progressoEtapa(etapaDe(o, cod)));
      this.limparEdicao();
      this.ui.editando = m.id;
      return this.mudou(`${md.numeroMed(m.numero)} criada com o avanço do checklist — confira e aprove`);
    },
    "med.salvar": (d) => {
      const m = md.salvarMedicao(this.ativa(), s(d.id), d);
      return this.mudou(`${md.numeroMed(m.numero)} salva`);
    },
    "med.aprovar": (d) => {
      const m = md.aprovarMedicao(this.ativa(), s(d.id), d, this.hoje);
      return this.mudou(`${md.numeroMed(m.numero)} aprovada${m.recebimento ? " — parcela lançada em Recebimentos" : ""}`);
    },
    "med.remover": (d) => {
      const id = s(d.id);
      if (this.ui.confirmar !== id) {
        this.ui.confirmar = id;
        return {};
      }
      md.removerMedicao(this.ativa(), id);
      this.limparEdicao();
      return this.mudou("Medição excluída");
    },

    // ---------------------------------------------------------- gestão de projetos
    "proj.salvar": (d) => {
      const p = gs.salvarProjeto(this.cadastros, d, this.hoje);
      this.limparEdicao();
      return this.mudouCadastro(s(d.id) ? `Projeto “${p.nome}” atualizado` : `Projeto “${p.nome}” cadastrado (${p.codigo})`);
    },
    "proj.fase": (d) => {
      const p = gs.alternarFase(this.cadastros, s(d.id), Math.trunc(lerNumero(d.indice, "Fase")), this.hoje);
      const f = gs.faseAtual(p).fase;
      return this.mudouCadastro(f ? `${p.nome}: fase atual “${f.fase}”` : `${p.nome}: todas as fases concluídas`);
    },
    "proj.prazo": (d) => {
      const p = gs.prazoFase(this.cadastros, s(d.id), Math.trunc(lerNumero(d.indice, "Fase")), d.prazo);
      return this.mudouCadastro(`Prazo atualizado em “${p.nome}”`);
    },
    "proj.remover": (d) => {
      const id = s(d.id);
      if (this.ui.confirmar !== id) {
        this.ui.confirmar = id;
        return {};
      }
      const p = gs.removerProjeto(this.cadastros, id);
      this.limparEdicao();
      return this.mudouCadastro(`Projeto “${p.nome}” excluído`);
    },
    "proj.obra": (d) => {
      const p = gs.projetoDe(this.cadastros, s(d.id));
      if (p.obra && this.obras.has(p.obra)) {
        Object.assign(this.ui, { modulo: "obras", obra: p.obra, aba: "inicio" });
        return {};
      }
      const o = sv.criarObra({
        nome: p.nome, cliente: p.cliente, endereco: p.endereco, responsavel_tecnico: p.responsavel,
        inicio: s(d.inicio), fim_previsto: "", orcamento_total: "", area_construida: p.area || 100,
        padrao: s(d.padrao) || "R1-N", valor_m2: "", bdi: d.bdi ?? 0, uf_cub: s(d.uf_cub) || "PB",
      });
      this.obras.set(o.id, o);
      gs.vincularObra(this.cadastros, p.id, o);
      this.limparEdicao();
      Object.assign(this.ui, { modulo: "obras", obra: o.id, aba: "etapas", abertas: [o.etapas[0].codigo], fase: "", filtro_etapa: "", mat_abertas: [] });
      this.ui.msg = `Obra “${o.nome}” criada a partir do projeto, com ${o.etapas.length} etapas`;
      return { alteradas: [o.id], cadastros: true };
    },

    // ---------------------------------------------------------- gestão de equipe
    "eq.salvar": (d) => {
      const m = gs.salvarMembro(this.cadastros, d, this.obras);
      this.limparEdicao();
      return this.mudouCadastro(s(d.id) ? `${m.nome} atualizado(a)` : `${m.nome} adicionado(a) à equipe`);
    },
    "eq.remover": (d) => {
      const id = s(d.id);
      if (this.ui.confirmar !== id) {
        this.ui.confirmar = id;
        return {};
      }
      const m = gs.removerMembro(this.cadastros, id);
      this.limparEdicao();
      return this.mudouCadastro(`${m.nome} removido(a) da equipe`);
    },
    "eq.presenca": (d) => {
      const m = gs.marcarPresenca(this.cadastros, s(d.id), d.data, s(d.presente) !== "0");
      return this.mudouCadastro(`${m.nome}: ${s(d.presente) !== "0" ? "presente" : "falta"}`);
    },
    "eq.todos": (d) => {
      const n = gs.marcarTodos(this.cadastros, d.data, s(d.obra), s(d.presente) !== "0");
      return this.mudouCadastro(n ? `${n} pessoa(s) marcadas como ${s(d.presente) !== "0" ? "presentes" : "ausentes"}` : "Ninguém ativo para marcar");
    },

    // ---------------------------------------------------------- tarefas
    "tarefa.criar": (d) => {
      const itens = s(d.itens).split(/\r?\n/);
      const t = sv.adicionarTarefa(this.ativa(), {
        titulo: d.titulo, etapa: s(d.etapa), responsavel: d.responsavel, prazo: d.prazo, prioridade: d.prioridade || "Média", itens,
      });
      this.ui.form_tarefa = false;
      return this.mudou(`Tarefa “${t.titulo}” criada`);
    },
    "tarefa.status": (d) => {
      const t = sv.mudarStatusTarefa(this.ativa(), s(d.id), s(d.status), this.hoje);
      return this.mudou(`${t.titulo}: ${t.status}`);
    },
    "tarefa.item": (d) => {
      sv.alternarItemTarefa(this.ativa(), s(d.id), s(d.item), this.hoje);
      return this.mudou();
    },
    "tarefa.remover": (d) => {
      sv.removerTarefa(this.ativa(), s(d.id));
      return this.mudou("Tarefa excluída");
    },
  };

  /** Nomes de todas as ações (para testes). */
  get nomesAcoes(): string[] {
    return Object.keys(this.acoes);
  }
}

// ================================================================ exemplo
/** Obra fictícia, com datas relativas a hoje, para demonstrar o sistema. */
export function obraExemplo(hoje: string): Obra {
  const o = sv.criarObra({
    nome: "Residência unifamiliar (exemplo)", cliente: "Cliente exemplo", endereco: "Rua Exemplo, 100",
    responsavel_tecnico: "Responsável técnico", inicio: somarDias(hoje, -95), fim_previsto: somarDias(hoje, 150),
    orcamento_total: 285000, exemplo: true, area_construida: 100, padrao: "R1-N", bdi: 25, uf_cub: "PB",
  });
  const feito: Record<string, number> = { PRE: 12, TER: 8, FUN: 11, EST: 8, ALV: 8 };
  for (const [cod, n] of Object.entries(feito)) {
    for (const item of etapaDe(o, cod).checklist.slice(0, n)) {
      item.feito = true;
      item.concluido_em = somarDias(hoje, -10);
    }
  }
  sv.salvarObservacao(o, "EST", "Laje do quarto 2 com escoramento reforçado (vão maior). "
    + "Concretagem condicionada à conferência das armaduras.");

  const compra = (
    descricao: string, etapa: string, categoria: string, quantidade: number, unidade: string, vu: number,
    fornecedor: string, status: string, dias: number, prioridade = "Média", material = "",
  ) => {
    const c = sv.adicionarCompra(o, {
      descricao, etapa, categoria, quantidade, unidade, valor_unitario: vu, fornecedor, prioridade,
      data_necessidade: somarDias(hoje, dias),
    }, hoje);
    c.material = material;
    const caminho: Record<string, string[]> = {
      "Em cotação": ["Em cotação"],
      Aprovada: ["Aprovada"],
      "Pedido feito": ["Aprovada", "Pedido feito"],
      Entregue: ["Aprovada", "Pedido feito", "Entregue"],
    };
    for (const st of caminho[status] ?? []) sv.mudarStatusCompra(o, c.id, st, hoje);
    return c;
  };
  compra("Concreto usinado fck 25 MPa", "FUN", "Material", 9, "m³", 520, "Concreteira", "Entregue", -95, "Média", "FUN:concreto");
  compra("Aço CA-50/CA-60", "EST", "Material", 0.75, "t", 7800, "Distribuidora de aço", "Entregue", -60);
  compra("Concreto usinado fck 25 MPa (laje e cintas)", "EST", "Material", 11, "m³", 540, "Concreteira", "Pedido feito", 4, "Alta", "EST:concreto");
  compra("Locação de escoramento metálico", "EST", "Equipamento/locação", 1, "mês", 2800, "Locadora", "Entregue", -40, "Média", "EST:escoras");
  compra("Bloco cerâmico 14×19×29 cm", "ALV", "Material", 5000, "un", 2.35, "Cerâmica", "Aprovada", 6, "Alta", "ALV:bloco");
  compra("Cimento CP-II 50 kg", "ALV", "Material", 18, "sc", 38.9, "", "Em cotação", -3, "Alta", "ALV:cimento");
  compra("Empreitada de alvenaria (mão de obra)", "ALV", "Mão de obra", 270, "m²", 38, "Equipe de alvenaria", "Aprovada", 10);
  compra("Tubos e conexões PVC (água e esgoto)", "HID", "Material", 1, "vb", 4200, "", "Solicitada", 25);

  const t1 = sv.adicionarTarefa(o, {
    titulo: "Conferir armaduras da laje do pavimento superior", etapa: "EST", responsavel: "Engenheiro de campo",
    prazo: somarDias(hoje, 2), prioridade: "Urgente",
    itens: ["Bitolas e espaçamento", "Cobrimento com espaçadores", "Passagens elétricas e hidráulicas"],
  });
  sv.alternarItemTarefa(o, t1.id, t1.checklist[0].id, hoje);
  sv.adicionarTarefa(o, {
    titulo: "Agendar concretagem com a concreteira", etapa: "EST", responsavel: "Mestre de obras",
    prazo: somarDias(hoje, -1), prioridade: "Alta", itens: ["Confirmar volume", "Reservar bomba"],
  });
  sv.adicionarTarefa(o, {
    titulo: "Fechar cotação de cimento (3 fornecedores)", etapa: "ALV", responsavel: "Compras",
    prazo: somarDias(hoje, 1), prioridade: "Alta",
  });
  sv.adicionarTarefa(o, {
    titulo: "Visita do cliente para aprovar layout de pontos elétricos", etapa: "ELE", responsavel: "Arquiteto",
    prazo: somarDias(hoje, 9), prioridade: "Média", itens: ["Enviar planta de pontos", "Registrar alterações"],
  });
  const t5 = sv.adicionarTarefa(o, {
    titulo: "Laudo de rompimento dos corpos de prova (28 dias)", etapa: "FUN", responsavel: "Laboratório",
    prazo: somarDias(hoje, -20), prioridade: "Média",
  });
  sv.mudarStatusTarefa(o, t5.id, "Concluída", somarDias(hoje, -21));
  return o;
}
