/**
 * Revisão técnica com Claude. O núcleo monta o pedido (dados + instruções + formato JSON),
 * a camada do navegador envia para a Claude e o núcleo valida a resposta e guarda a revisão.
 * Nada aqui acessa a rede: a chave de API nunca passa pelo estado do sistema.
 */
import * as an from "./analise";
import { rotuloPadrao } from "./catalogo";
import { etapaDe, valorTotalCompra, type Compra, type Etapa, type Obra, type Revisao, type SugestaoRevisao, type PontoRevisao, type Tarefa } from "./modelos";
import { situacaoMateriais } from "./servicos";
import { ValidacaoErro, hojeLocal, limparTexto, novoId, pct } from "./util";

const NIVEIS = ["critico", "atencao", "ok"] as const;
export const MAX_REVISOES = 20;
export const MAX_FOCO = 300;

export const INSTRUCOES = `Você é um engenheiro civil/arquiteto revisor de obras residenciais no Brasil, com experiência em \
execução, normas ABNT, orçamento (CUB/SINAPI) e planejamento. Revise os dados abaixo de um sistema de gestão de obras \
e aponte problemas concretos e verificáveis: incoerências entre quantitativos, área e padrão construtivo; orçamento \
de etapa fora do razoável; sequência executiva errada; itens de checklist de qualidade ou segurança que faltam; \
prazos incompatíveis; compras atrasadas ou faltando para etapas próximas; riscos citados nas observações.

Regras:
- Responda em português do Brasil, direto, como um colega técnico.
- Use somente os dados fornecidos; quando faltar informação, diga o que falta em "perguntas".
- Não invente valores de mercado precisos; se citar faixa de preço, diga que é estimativa.
- No máximo 8 pontos, do mais grave para o menos grave. Inclua pelo menos um ponto "ok" se algo estiver bem feito.
- Sugira itens de checklist só quando forem realmente necessários e ainda não existirem (no máximo 6), \
  cada um curto (até 120 caracteres) e indicando o código da etapa.

Responda APENAS com um JSON válido, sem texto antes ou depois, neste formato:
{
  "resumo": "2 a 3 frases com a avaliação geral",
  "pontos": [{"nivel": "critico|atencao|ok", "titulo": "curto", "detalhe": "o que verificar ou fazer"}],
  "sugestoes_checklist": [{"etapa": "CÓDIGO", "texto": "item de checklist"}],
  "perguntas": ["informação que falta para uma revisão melhor"]
}`;

function etapaResumo(o: Obra, e: Etapa, hoje: string, detalhado: boolean): Record<string, unknown> {
  const d: Record<string, unknown> = {
    codigo: e.codigo,
    nome: e.nome,
    fase: e.categoria,
    status: an.statusEtapa(o, e, hoje),
    avanco: pct(an.progressoEtapa(e)).replace(",", "."),
    orcamento: Math.round(e.orcamento * 100) / 100,
    peso_pct: e.peso,
    inicio_previsto: e.inicio_previsto,
    fim_previsto: e.fim_previsto,
    depende_de: e.predecessoras,
  };
  if (e.observacao) d.observacao = e.observacao;
  const pend = e.checklist.filter((i) => !i.feito).map((i) => i.texto);
  if (detalhado) {
    Object.assign(d, {
      escopo: e.descricao,
      equipe: e.equipe,
      duracao_tipica_dias: e.duracao_dias,
      quantitativos_ref_100m2: e.servicos,
      normas: e.normas,
      checklist_feito: e.checklist.filter((i) => i.feito).map((i) => i.texto),
      checklist_pendente: pend,
    });
  } else {
    d.itens_pendentes = pend.length;
  }
  return d;
}

const compraResumo = (c: Compra) => ({
  descricao: c.descricao, etapa: c.etapa, categoria: c.categoria, qtd: c.quantidade, un: c.unidade,
  valor_total: valorTotalCompra(c), status: c.status, precisa_ate: c.data_necessidade,
});
const tarefaResumo = (t: Tarefa) => ({
  titulo: t.titulo, etapa: t.etapa, responsavel: t.responsavel, prazo: t.prazo, prioridade: t.prioridade, status: t.status,
});

/** Texto completo enviado à Claude. */
export function montarPedido(o: Obra, escopo: string, codigo = "", foco = "", hoje = hojeLocal()): string {
  if (escopo !== "obra" && escopo !== "etapa") throw new ValidacaoErro("Escopo de revisão inválido");
  const focoLimpo = limparTexto(foco).slice(0, MAX_FOCO);
  const fin = an.resumoFinanceiro(o);
  const pad = an.resumoPadrao(o);
  const dados: Record<string, unknown> = {
    data_de_hoje: hoje,
    obra: {
      nome: o.nome,
      tipo: "residência unifamiliar",
      area_construida_m2: o.area_construida,
      padrao_construtivo: rotuloPadrao(o.padrao),
      valor_m2_referencia: o.valor_m2,
      tabela_cub: pad.referencia,
      custo_pelo_padrao: pad.estimado,
      orcamento_total_custo_direto: o.orcamento_total,
      bdi_percentual: o.bdi,
      preco_de_venda_com_bdi: pad.preco_venda,
      inicio: o.inicio,
      termino_previsto: o.fim_previsto,
      avanco_fisico: pct(an.progressoFisico(o)).replace(",", "."),
      avanco_previsto_hoje: pct(an.progressoPrevisto(o, hoje)).replace(",", "."),
      executado_medicao: fin.executado,
      comprometido_em_compras: fin.comprometido,
    },
    alertas_do_sistema: an.alertas(o, hoje).slice(0, 15).map((a) => `${a.nivel}: ${a.titulo} (${a.detalhe})`),
  };
  let alvo: string;
  if (escopo === "etapa") {
    const e = etapaDe(o, codigo);
    dados.etapa_em_revisao = etapaResumo(o, e, hoje, true);
    dados.predecessoras = e.predecessoras
      .filter((p) => o.etapas.some((x) => x.codigo === p))
      .map((p) => etapaResumo(o, etapaDe(o, p), hoje, false));
    dados.compras_da_etapa = o.compras.filter((c) => c.etapa === codigo).map(compraResumo);
    dados.tarefas_da_etapa = o.tarefas.filter((t) => t.etapa === codigo).map(tarefaResumo);
    dados.lista_de_materiais = situacaoMateriais(o, codigo).map((x) => ({
      material: x.material, necessario: x.necessario, un: x.un, situacao: x.situacao,
    }));
    alvo = `a etapa ${e.codigo} – ${e.nome}`;
  } else {
    dados.etapas = o.etapas.map((e) => etapaResumo(o, e, hoje, false));
    dados.compras = o.compras.filter((c) => c.status !== "Cancelada").slice(0, 60).map(compraResumo);
    dados.tarefas_abertas = o.tarefas.filter((t) => t.status !== "Concluída").slice(0, 40).map(tarefaResumo);
    alvo = "a obra inteira (visão geral de prazo, custo, sequência e riscos)";
  }
  let pedido = `${INSTRUCOES}\n\nRevise ${alvo}.`;
  if (focoLimpo) pedido += `\nFoco pedido pelo usuário: ${focoLimpo}`;
  return `${pedido}\n\nDADOS:\n${JSON.stringify(dados, null, 1)}`;
}

// ====================================================================== resposta
function extrairJson(texto: string): unknown {
  let t = (texto || "").trim();
  const bloco = /```(?:json)?\s*(\{[\s\S]*\})\s*```/.exec(t);
  if (bloco) t = bloco[1];
  else {
    const ini = t.indexOf("{");
    const fim = t.lastIndexOf("}");
    if (ini >= 0 && fim > ini) t = t.slice(ini, fim + 1);
  }
  return JSON.parse(t);
}

const corta = (v: unknown, maximo: number) => limparTexto(v).slice(0, maximo);

export type Resposta = Pick<Revisao, "resumo" | "pontos" | "sugestoes" | "perguntas" | "formato_livre">;

/** Valida e limpa a resposta. Se não vier JSON, guarda o texto como resumo. */
export function interpretarResposta(texto: string, codigosValidos: string[]): Resposta {
  let bruto: unknown;
  try {
    bruto = extrairJson(texto);
    if (!bruto || typeof bruto !== "object" || Array.isArray(bruto)) throw new Error("não é objeto");
  } catch {
    const limpo = (texto || "").trim();
    if (!limpo) throw new ValidacaoErro("A Claude não devolveu resposta");
    return { resumo: limpo.slice(0, 4000), pontos: [], sugestoes: [], perguntas: [], formato_livre: true };
  }
  const b = bruto as Record<string, unknown>;
  const pontos: PontoRevisao[] = [];
  for (const p of Array.isArray(b.pontos) ? b.pontos : []) {
    if (!p || typeof p !== "object") continue;
    const q = p as Record<string, unknown>;
    let nivel = String(q.nivel ?? "atencao").toLowerCase().replace("í", "i").replace("ç", "c").replace("ã", "a");
    if (!(NIVEIS as readonly string[]).includes(nivel)) nivel = "atencao";
    const titulo = corta(q.titulo, 140);
    if (titulo) pontos.push({ nivel: nivel as PontoRevisao["nivel"], titulo, detalhe: corta(q.detalhe, 600) });
  }
  pontos.sort((x, y) => NIVEIS.indexOf(x.nivel) - NIVEIS.indexOf(y.nivel));

  const sugestoes: SugestaoRevisao[] = [];
  const vistos = new Set<string>();
  for (const s of Array.isArray(b.sugestoes_checklist) ? b.sugestoes_checklist : []) {
    if (!s || typeof s !== "object") continue;
    const q = s as Record<string, unknown>;
    const etapa = String(q.etapa ?? "").trim().toUpperCase();
    const textoItem = corta(q.texto, 160);
    const chave = `${etapa}|${textoItem.toLowerCase()}`;
    if (codigosValidos.includes(etapa) && textoItem && !vistos.has(chave)) {
      vistos.add(chave);
      sugestoes.push({ etapa, texto: textoItem, adicionado: false });
    }
  }
  const perguntas = Array.isArray(b.perguntas) ? b.perguntas.map((q) => corta(q, 300)).filter(Boolean) : [];
  const resumo = corta(b.resumo, 1200);
  if (!resumo && !pontos.length) throw new ValidacaoErro("A resposta da Claude veio vazia");
  return { resumo, pontos: pontos.slice(0, 10), sugestoes: sugestoes.slice(0, 8), perguntas: perguntas.slice(0, 6), formato_livre: false };
}

export function registrarRevisao(
  o: Obra, escopo: "obra" | "etapa", codigo: string, foco: string, resposta: Resposta, origem: string, hoje = hojeLocal(),
): Revisao {
  const rev: Revisao = {
    id: novoId("rev"),
    data: hoje,
    escopo,
    codigo: escopo === "etapa" ? codigo : "",
    foco: limparTexto(foco).slice(0, MAX_FOCO),
    origem,
    ...resposta,
  };
  // sugestões que já existem no checklist chegam marcadas como adicionadas
  for (const s of rev.sugestoes) {
    const e = o.etapas.find((x) => x.codigo === s.etapa);
    if (e) s.adicionado = e.checklist.some((i) => i.texto.toLowerCase() === s.texto.toLowerCase());
  }
  o.revisoes.unshift(rev);
  o.revisoes.splice(MAX_REVISOES);
  return rev;
}

export function revisaoDe(o: Obra, id: string): Revisao {
  const r = o.revisoes.find((x) => x.id === id);
  if (!r) throw new ValidacaoErro("Revisão não encontrada");
  return r;
}

export function ultimaRevisao(o: Obra, escopo: string, codigo = ""): Revisao | null {
  return o.revisoes.find((r) => r.escopo === escopo && (escopo === "obra" || r.codigo === codigo)) ?? null;
}
