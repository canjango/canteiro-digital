/**
 * Dias úteis e prazos de licitação (Lei 14.133/2021).
 * Feriados nacionais fixos + Sexta-feira Santa. Carnaval e Corpus Christi são ponto facultativo: para ficar do lado
 * seguro, contam como dia sem expediente ao RECUAR (impugnação fica mais cedo) e como dia útil ao AVANÇAR
 * (recurso fica mais cedo). Feriados estaduais e municipais não entram: confira no edital.
 */
import { somarDias } from "./util";

/** Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher). */
export function pascoa(ano: number): string {
  const a = ano % 19, b = Math.floor(ano / 100), c = ano % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1;
  return `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

const cache = new Map<number, { feriados: Set<string>; facultativos: Set<string> }>();
export function calendario(ano: number) {
  const c = cache.get(ano);
  if (c) return c;
  const fixos = ["01-01", "04-21", "05-01", "09-07", "10-12", "11-02", "11-15", "11-20", "12-25"].map((d) => `${ano}-${d}`);
  const p = pascoa(ano);
  const r = {
    feriados: new Set([...fixos, somarDias(p, -2)]), // + sexta-feira santa
    facultativos: new Set([somarDias(p, -48), somarDias(p, -47), somarDias(p, 60)]), // carnaval (seg e ter), corpus christi
  };
  cache.set(ano, r);
  return r;
}
export const feriados = (ano: number) => calendario(ano).feriados;

/** Dia útil: não é sábado, domingo nem feriado; com `facultativoUtil = false`, ponto facultativo também não conta. */
export function diaUtil(iso: string, facultativoUtil = false): boolean {
  const dow = new Date(`${iso}T12:00:00Z`).getUTCDay();
  if (dow === 0 || dow === 6) return false;
  const c = calendario(Number(iso.slice(0, 4)));
  if (c.feriados.has(iso)) return false;
  return facultativoUtil || !c.facultativos.has(iso);
}

/** Avança (n > 0) ou recua (n < 0) n dias úteis (a data inicial não conta), escolhendo sempre o lado seguro. */
export function somarDiasUteis(iso: string, n: number): string {
  let d = iso;
  let falta = Math.abs(n);
  const passo = n >= 0 ? 1 : -1;
  while (falta > 0) {
    d = somarDias(d, passo);
    if (diaUtil(d, passo > 0)) falta--;
  }
  return d;
}

/** Dias úteis entre a e b (exclui a, inclui b — regra de contagem do art. 183). */
export function diasUteisEntre(a: string, b: string): number {
  if (!a || !b || b <= a) return 0;
  let n = 0;
  for (let d = somarDias(a, 1); d <= b; d = somarDias(d, 1)) if (diaUtil(d)) n++;
  return n;
}

/** Próximo dia útil (a própria data, se já for útil): vencimento em dia sem expediente prorroga (art. 183, § 1º). */
export function proximoUtil(iso: string): string {
  let d = iso;
  while (!diaUtil(d)) d = somarDias(d, 1);
  return d;
}

// ---------------------------------------------------------------- Lei 14.133
export const MODALIDADES = ["Concorrência", "Pregão eletrônico", "Concurso", "Diálogo competitivo", "Dispensa", "Inexigibilidade"] as const;
export const CRITERIOS = ["Menor preço", "Maior desconto", "Técnica e preço", "Melhor técnica ou conteúdo artístico"] as const;
export const OBJETOS = ["Serviço comum", "Serviço especial", "Obra ou serviço comum de engenharia", "Obra ou serviço especial de engenharia", "Contratação integrada", "Contratação semi-integrada"] as const;

/** Prazo mínimo (dias úteis) entre a divulgação do edital e a apresentação de propostas — art. 55. */
export function prazoMinimoPublicacao(criterio: string, objeto: string): { dias: number; base: string } | null {
  if (criterio === "Técnica e preço" || criterio === "Melhor técnica ou conteúdo artístico") return { dias: 35, base: "art. 55, IV" };
  if (objeto === "Contratação integrada") return { dias: 60, base: "art. 55, II, c" };
  if (objeto === "Contratação semi-integrada") return { dias: 35, base: "art. 55, II, d" };
  const menor = criterio === "Menor preço" || criterio === "Maior desconto";
  if (!menor) return null;
  if (objeto === "Serviço comum" || objeto === "Obra ou serviço comum de engenharia") return { dias: 10, base: "art. 55, II, a" };
  if (objeto === "Serviço especial" || objeto === "Obra ou serviço especial de engenharia") return { dias: 25, base: "art. 55, II, b" };
  return null;
}

/** Último dia para impugnar ou pedir esclarecimento: até 3 dias úteis antes da abertura — art. 164. */
export const limiteImpugnacao = (abertura: string) => (abertura ? somarDiasUteis(abertura, -3) : "");
/** Prazo para razões de recurso: 3 dias úteis da intimação/ata — art. 165, I. Contrarrazões: mais 3 dias úteis (§ 3º). */
export const limiteRecurso = (intimacao: string) => (intimacao ? somarDiasUteis(intimacao, 3) : "");
export const limiteContrarrazoes = (intimacao: string) => (intimacao ? somarDiasUteis(intimacao, 6) : "");
/** Garantia de proposta: até 1% do valor estimado (art. 58). Garantia contratual: até 5%, ou 10% justificado (art. 98). */
export const LIMITE_GARANTIA_PROPOSTA = 1;
export const LIMITE_GARANTIA_CONTRATO = 5;
export const LIMITE_GARANTIA_CONTRATO_MAJORADA = 10;
