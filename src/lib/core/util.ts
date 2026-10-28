/** Utilidades do núcleo: erros de validação, números e datas no formato brasileiro. */

export class ValidacaoErro extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "ValidacaoErro";
  }
}

/** Identificador curto e único (mesmo formato da versão anterior: "obra-1a2b3c4d"). */
export function novoId(prefixo: string): string {
  let hex = "";
  const c = globalThis.crypto as Crypto | undefined;
  if (c && typeof c.getRandomValues === "function") {
    const b = new Uint8Array(4);
    c.getRandomValues(b);
    hex = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  } else {
    hex = Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, "0");
  }
  return `${prefixo}-${hex}`;
}

/** Arredondamento a n casas, sem o erro clássico de 1,005 → 1,00. */
export function arred(v: number, casas = 2): number {
  if (!Number.isFinite(v) || v === 0) return 0;
  const f = 10 ** casas;
  // toPrecision(15) remove o ruído binário (1,005 × 100 = 100,4999…); o sinal é tratado à parte
  // para o arredondamento ser simétrico (−2,675 → −2,68, como 2,675 → 2,68).
  const n = Number((Math.abs(v) * f).toPrecision(15));
  return (Math.sign(v) * Math.round(n)) / f;
}

/** Arredonda para inteiro com empate para o par (mesmo critério do round() do Python). */
export function arredPar(v: number): number {
  const f = Math.floor(v);
  const d = v - f;
  if (Math.abs(d - 0.5) < 1e-9) return f % 2 === 0 ? f : f + 1;
  return Math.round(v);
}

export function soma<T>(itens: Iterable<T>, f: (x: T) => number): number {
  let s = 0;
  for (const x of itens) s += f(x);
  return s;
}

/** Normaliza espaços: "  a   b " → "a b". */
export function limparTexto(v: unknown): string {
  return String(v ?? "").split(/\s+/).filter(Boolean).join(" ");
}

export function lerTexto(v: unknown, nome: string, obrigatorio = true, maximo = 200): string {
  const t = limparTexto(v);
  if (obrigatorio && !t) throw new ValidacaoErro(`Informe ${nome}`);
  if (t.length > maximo) {
    throw new ValidacaoErro(`${nome.charAt(0).toUpperCase()}${nome.slice(1)} muito longo (máx. ${maximo} caracteres)`);
  }
  return t;
}

export function lerOpcao<T extends string>(v: unknown, opcoes: readonly T[], nome: string): T {
  if (!opcoes.includes(v as T)) throw new ValidacaoErro(`${nome} inválido: '${String(v)}'`);
  return v as T;
}

/**
 * Lê número digitado no formato brasileiro.
 * Aceita "300.000", "300.000,00", "300000", "R$ 1.234,56", "25,5".
 */
export function lerNumero(valor: unknown, nome: string, minimo = 0): number {
  if (valor === null || valor === undefined || valor === "") return 0;
  if (typeof valor === "number") {
    if (!Number.isFinite(valor)) throw new ValidacaoErro(`${nome}: número inválido`);
    if (valor < minimo) throw new ValidacaoErro(`${nome} não pode ser menor que ${minimo}`);
    return valor;
  }
  let texto = String(valor).trim().replace(/R\$/g, "").replace(/[\s ]/g, "");
  if (texto.includes(",")) {
    texto = texto.replace(/\./g, "").replace(",", ".");
  } else if (/^-?\d{1,3}(\.\d{3})+$/.test(texto)) {
    texto = texto.replace(/\./g, "");
  }
  if (!/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(texto)) {
    throw new ValidacaoErro(`${nome}: número inválido ('${String(valor)}')`);
  }
  const n = Number(texto);
  if (!Number.isFinite(n)) throw new ValidacaoErro(`${nome}: número inválido`);
  if (n < minimo) throw new ValidacaoErro(`${nome} não pode ser menor que ${minimo}`);
  return n;
}

// ---------------------------------------------------------------- datas (sempre "AAAA-MM-DD", sem fuso)
const RE_DATA = /^(\d{4})-(\d{2})-(\d{2})/;

/** Valida e normaliza uma data ISO; vazio → "". */
export function lerData(valor: unknown): string {
  if (valor === null || valor === undefined || valor === "") return "";
  const m = RE_DATA.exec(String(valor));
  if (!m) throw new ValidacaoErro(`Data inválida: '${String(valor)}' (use AAAA-MM-DD)`);
  const [a, mes, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(a, mes - 1, d));
  if (dt.getUTCFullYear() !== a || dt.getUTCMonth() !== mes - 1 || dt.getUTCDate() !== d) {
    throw new ValidacaoErro(`Data inválida: '${String(valor)}' (use AAAA-MM-DD)`);
  }
  return `${m[1]}-${m[2]}-${m[3]}`;
}

/** Igual a lerData, mas devolve "" em vez de lançar erro (para dados gravados). */
export function dataSegura(valor: unknown): string {
  try {
    return lerData(valor);
  } catch {
    return "";
  }
}

function paraUTC(iso: string): number {
  const m = RE_DATA.exec(iso)!;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function deUTC(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

const DIA = 86_400_000;

export function somarDias(iso: string, dias: number): string {
  return deUTC(paraUTC(iso) + dias * DIA);
}

/** b − a, em dias. */
export function diasEntre(a: string, b: string): number {
  return Math.round((paraUTC(b) - paraUTC(a)) / DIA);
}

/** Data de hoje no fuso do navegador. */
export function hojeLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function somarMeses(iso: string, n: number): [number, number] {
  const m = RE_DATA.exec(iso)!;
  const total = Number(m[2]) - 1 + n;
  return [Number(m[1]) + Math.floor(total / 12), (total % 12) + 1];
}

// ---------------------------------------------------------------- formatação
function milhares(inteiro: string): string {
  return inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** R$ 1.234,56 (negativos: -R$ 1.234,56). */
export function moeda(v: number | null | undefined): string {
  const n = Number(v) || 0;
  const [i, d] = Math.abs(n).toFixed(2).split(".");
  return `${n < 0 && Math.abs(n) >= 0.005 ? "-" : ""}R$ ${milhares(i)},${d}`;
}

/** 300000 → "300.000,00" (para preencher campos). Zero/vazio → "". */
export function valorBr(v: number | null | undefined, casas = 2): string {
  if (!v) return "";
  const [i, d] = Math.abs(v).toFixed(casas).split(".");
  return `${v < 0 ? "-" : ""}${milhares(i)}${casas ? "," + d : ""}`;
}

/** Número curto: 7500 → "7.500"; 5,38 → "5,38"; 2.5 → "2,5". */
export function num(x: number): string {
  const n = Number(x) || 0;
  if (Number.isInteger(n)) return `${n < 0 ? "-" : ""}${milhares(String(Math.abs(n)))}`;
  let s = Math.abs(n).toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
  const [i, d] = s.split(".");
  s = milhares(i) + (d ? "," + d : "");
  return `${n < 0 ? "-" : ""}${s}`;
}

export function pct(x: number | null | undefined, casas = 0): string {
  if (x === null || x === undefined || Number.isNaN(x)) return "—";
  return `${(x * 100).toFixed(casas).replace(".", ",")}%`;
}

export function pctSinal(x: number | null | undefined): string {
  if (x === null || x === undefined) return "—";
  const s = (x * 100).toFixed(1).replace(".", ",");
  return `${x >= 0 ? "+" : ""}${s}%`;
}

export function dataBr(iso: string | null | undefined): string {
  const d = dataSegura(iso);
  if (!d) return "—";
  const [a, m, dia] = d.split("-");
  return `${dia}/${m}/${a}`;
}
