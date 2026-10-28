/**
 * Plataforma: onde os dados ficam e como falar com a Claude.
 *
 * - Dentro da Claude (artifact): banco compartilhado ("db", coleção "obras") e revisão pela
 *   capacidade "sample" (usa a conta de quem está vendo).
 * - Site externo (GitHub Pages): dados no localStorage deste navegador e revisão com a chave
 *   de API do próprio usuário, guardada só neste navegador (nunca vai para o banco nem para o código).
 */
import type { Obra } from "@/lib/core/modelos";

export const CHAVE_LOCAL = "canteiro-digital:v1";
export const CHAVE_CADASTROS = "canteiro-digital:cadastros:v1";
const CHAVE_IA = "canteiro-digital:chave-api";
export const MODELO_API = "claude-sonnet-5-5";
const RE_CHAVE = /^sk-ant-[A-Za-z0-9_-]{20,}$/;

export type TipoStatus = "ok" | "salvando" | "local" | "erro" | "";
export interface Status {
  texto: string;
  tipo: TipoStatus;
}

interface DocRef {
  set(v: unknown): Promise<void>;
  delete(): Promise<void>;
}
interface Colecao {
  doc(id: string): DocRef;
  onSnapshot(
    ok: (snap: { docs: { data(): unknown }[]; metadata?: { hasPendingWrites?: boolean } }) => void,
    erro: (e: unknown) => void,
  ): () => void;
}
type Amostra = (texto: string, opcoes: Record<string, unknown>) => Promise<{ text: string }>;
interface RuntimeClaude {
  use(nome: string): Promise<unknown>;
}

declare global {
  interface Window {
    claude?: RuntimeClaude;
  }
}

export interface RespostaIa {
  texto?: string;
  erro?: string;
}

export interface Eventos {
  /** Documentos vindos do banco (ou da cópia local). `primeira` = carga inicial. */
  dados(docs: unknown[], primeira: boolean): void;
  status(s: Status): void;
  /** O modo da revisão mudou (ex.: a capacidade "sample" ficou disponível). */
  modoIa(): void;
  /** Cadastros compartilhados (contatos e insumos). */
  cadastros(doc: unknown): void;
}

function lsLer(chave: string): string | null {
  try {
    return localStorage.getItem(chave);
  } catch {
    return null;
  }
}
function lsGravar(chave: string, valor: string): boolean {
  try {
    localStorage.setItem(chave, valor);
    return true;
  } catch {
    return false;
  }
}

function lerJsonLocal(chave: string): unknown {
  const t = lsLer(chave);
  if (!t) return null;
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
}

function lerCopiaLocal(): unknown[] {
  const t = lsLer(CHAVE_LOCAL);
  if (!t) return [];
  try {
    const v = JSON.parse(t);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export class Plataforma {
  private col: Colecao | null = null;
  private amostra: Amostra | null = null;
  private somenteLeitura = false;
  private ultimo = new Map<string, Obra | null>(); // id → doc mais recente (null = excluir)
  private emVoo = new Set<string>();
  private controle: AbortController | null = null;
  private eventos: Eventos | null = null;
  private eventosInternos: Eventos | null = null;
  private ultimaCarga: unknown[] | null = null;
  private ultimosCadastros: unknown = null;
  private colCad: Colecao | null = null;
  private cadPendentes = 0;
  private ultimoStatus: Status | null = null;
  private iniciada = false;
  /** Dentro da Claude a rede externa é bloqueada: a chave de API só vale no site. */
  readonly dentroDaClaude: boolean;

  constructor() {
    this.dentroDaClaude = typeof window !== "undefined" && Boolean(window.claude?.use);
  }

  get chavePermitida(): boolean {
    return !this.dentroDaClaude;
  }

  get modoIa(): "claude" | "chave" | "nenhum" {
    if (this.amostra) return "claude";
    return this.chavePermitida && this.lerChave() ? "chave" : "nenhum";
  }

  lerChave(): string {
    return lsLer(CHAVE_IA) ?? "";
  }

  /** Valida e guarda a chave só neste navegador. Devolve uma mensagem de erro ou "". */
  salvarChave(chave: string): string {
    const c = chave.trim();
    if (!RE_CHAVE.test(c)) return "Isso não parece uma chave da API da Anthropic (começa com sk-ant-).";
    if (!lsGravar(CHAVE_IA, c)) return "Este navegador não permite salvar a chave.";
    return "";
  }

  removerChave(): void {
    try {
      localStorage.removeItem(CHAVE_IA);
    } catch {
      /* nada a fazer */
    }
  }

  /**
   * Liga a plataforma. Pode ser chamada de novo (ex.: React StrictMode monta o efeito duas vezes):
   * os eventos passam a ir sempre para os ouvintes mais recentes.
   */
  async iniciar(ouvintes: Eventos): Promise<void> {
    this.eventos = ouvintes;
    if (this.iniciada) {
      if (this.ultimosCadastros) ouvintes.cadastros(this.ultimosCadastros);
      if (this.ultimaCarga) ouvintes.dados(this.ultimaCarga, true);
      if (this.ultimoStatus) ouvintes.status(this.ultimoStatus);
      if (this.amostra) ouvintes.modoIa();
      return;
    }
    this.iniciada = true;
    const eventos: Eventos = {
      dados: (docs, primeira) => {
        this.ultimaCarga = docs;
        this.eventos?.dados(docs, primeira);
      },
      status: (s) => {
        this.ultimoStatus = s;
        this.eventos?.status(s);
      },
      modoIa: () => this.eventos?.modoIa(),
      cadastros: (doc) => {
        this.ultimosCadastros = doc;
        this.eventos?.cadastros(doc);
      },
    };
    this.eventosInternos = eventos;
    const usar = (nome: string) =>
      window.claude?.use ? window.claude.use(nome).catch(() => null) : Promise.resolve(null);

    void usar("sample").then((s) => {
      if (typeof s === "function") {
        this.amostra = s as Amostra;
        eventos.modoIa();
      }
    });

    const db = (await usar("db")) as { collection(nome: string): Colecao } | null;
    if (!db) {
      eventos.cadastros(lerJsonLocal(CHAVE_CADASTROS));
      eventos.dados(lerCopiaLocal(), true);
      eventos.status({ texto: "Salvo apenas neste navegador", tipo: "local" });
      return;
    }
    // cadastros compartilhados: um documento "geral" na coleção "cadastros"
    eventos.cadastros(lerJsonLocal(CHAVE_CADASTROS));
    try {
      this.colCad = db.collection("cadastros");
      this.colCad.onSnapshot(
        (snap) => {
          if (this.cadPendentes) return; // eco da própria gravação
          const doc = snap.docs[0]?.data();
          if (!doc) return;
          lsGravar(CHAVE_CADASTROS, JSON.stringify(doc));
          eventos.cadastros(doc);
        },
        (e) => {
          console.error(e);
          this.colCad = null;
        },
      );
    } catch (e) {
      console.error(e);
      this.colCad = null;
    }
    this.col = db.collection("obras");
    let primeira = true;
    // se o banco demorar, abre com a cópia local para não travar na tela de carga
    const espera = setTimeout(() => {
      if (!primeira) return;
      eventos.dados(lerCopiaLocal(), true);
      eventos.status({ texto: "Aguardando o banco… mostrando a cópia deste navegador", tipo: "local" });
    }, 12000);
    this.col.onSnapshot(
      (snap) => {
        // ignora o eco das próprias gravações em andamento
        if (!primeira && (snap.metadata?.hasPendingWrites || this.emVoo.size || this.ultimo.size)) return;
        const docs = snap.docs.map((d) => d.data());
        lsGravar(CHAVE_LOCAL, JSON.stringify(docs));
        const era = primeira;
        primeira = false;
        clearTimeout(espera);
        eventos.dados(docs, era);
        if (era) eventos.status({ texto: "Salvo na nuvem · compartilhado", tipo: "ok" });
      },
      (e) => {
        console.error(e);
        clearTimeout(espera);
        if (primeira) {
          primeira = false;
          eventos.dados(lerCopiaLocal(), true);
        }
        eventos.status({ texto: "Sem conexão com o banco; alterações ficam neste navegador", tipo: "erro" });
        this.col = null;
      },
    );
  }

  /** Grava as obras alteradas/removidas (e a cópia completa neste navegador). */
  /** Grava contatos e insumos (compartilhados entre as obras). */
  persistirCadastros(doc: unknown): void {
    const ok = lsGravar(CHAVE_CADASTROS, JSON.stringify(doc));
    if (!this.colCad) {
      if (!ok) this.emitirStatus({ texto: "Não foi possível salvar neste navegador (espaço cheio ou navegação privada)", tipo: "erro" });
      return;
    }
    this.cadPendentes += 1;
    this.emitirStatus({ texto: "Salvando…", tipo: "salvando" });
    this.colCad.doc("geral").set(doc)
      .then(() => this.emitirStatus({ texto: "Salvo", tipo: "ok" }))
      .catch((e) => {
        console.error(e);
        this.emitirStatus({ texto: "Erro ao salvar os cadastros. Eles estão guardados neste navegador.", tipo: "erro" });
      })
      .finally(() => {
        setTimeout(() => { this.cadPendentes = Math.max(0, this.cadPendentes - 1); }, 300);
      });
  }

  persistir(gravar: Obra[], remover: string[], todas: Obra[]): void {
    if (!gravar.length && !remover.length) return;
    const salvouLocal = lsGravar(CHAVE_LOCAL, JSON.stringify(todas));
    if (!this.col || this.somenteLeitura) {
      if (this.col) return; // somente leitura: o aviso já foi dado
      this.emitirStatus(salvouLocal
        ? { texto: "Salvo apenas neste navegador", tipo: "local" }
        : { texto: "Não foi possível salvar neste navegador (espaço cheio ou navegação privada)", tipo: "erro" });
      return;
    }
    for (const o of gravar) this.agendar(o.id, o);
    for (const id of remover) this.agendar(id, null);
  }

  private emitirStatus(s: Status) {
    (this.eventosInternos ?? this.eventos)?.status(s);
  }

  private agendar(id: string, doc: Obra | null) {
    this.ultimo.set(id, doc);
    if (!this.emVoo.has(id)) void this.bombear(id);
  }

  private async bombear(id: string) {
    const col = this.col;
    if (!col) return;
    this.emVoo.add(id);
    this.emitirStatus({ texto: "Salvando…", tipo: "salvando" });
    try {
      while (this.ultimo.has(id)) {
        const doc = this.ultimo.get(id) ?? null;
        this.ultimo.delete(id);
        const ref = col.doc(id);
        const gravar = () => (doc === null ? ref.delete() : ref.set(doc));
        try {
          await gravar();
        } catch (e) {
          if ((e as { code?: string })?.code === "unavailable") {
            await new Promise((r) => setTimeout(r, 400 + Math.random() * 600)); // falha transitória: nova tentativa
            await gravar();
          } else throw e;
        }
      }
      if (this.emVoo.size <= 1 && !this.ultimo.size) this.emitirStatus({ texto: "Salvo", tipo: "ok" });
    } catch (e) {
      console.error(e);
      const code = (e as { code?: string })?.code;
      if (code === "invalid_argument" || code === "permission_denied") {
        this.somenteLeitura = true;
        this.emitirStatus({ texto: "Somente leitura: você não tem permissão para alterar", tipo: "erro" });
      } else if (code === "quota_exceeded") {
        this.emitirStatus({ texto: "Banco cheio: exclua obras antigas para continuar salvando", tipo: "erro" });
      } else {
        this.emitirStatus({ texto: "Erro ao salvar. Suas alterações estão guardadas neste navegador.", tipo: "erro" });
      }
    } finally {
      this.emVoo.delete(id);
    }
  }

  // ------------------------------------------------------------ Claude
  async perguntar(texto: string): Promise<RespostaIa> {
    this.controle?.abort();
    const controle = new AbortController();
    this.controle = controle;
    try {
      if (this.amostra) {
        const r = await this.amostra(texto, { modelTier: "default", cache: false, signal: controle.signal });
        return { texto: r.text };
      }
      const chave = this.chavePermitida ? this.lerChave() : "";
      if (!chave) return { erro: "sem_ia" };
      let resp: Response;
      try {
        resp = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          signal: controle.signal,
          headers: {
            "content-type": "application/json",
            "x-api-key": chave,
            "anthropic-version": "2023-06-01",
            "anthropic-dangerous-direct-browser-access": "true",
          },
          body: JSON.stringify({ model: MODELO_API, max_tokens: 4000, messages: [{ role: "user", content: texto }] }),
        });
      } catch (e) {
        return { erro: (e as Error)?.name === "AbortError" ? "cancelled" : "rede" };
      }
      const corpo = (await resp.json().catch(() => ({}))) as {
        error?: { message?: string };
        content?: { type: string; text?: string }[];
      };
      if (!resp.ok) {
        const msg = (corpo.error?.message ?? "").toLowerCase();
        if (resp.status === 401 || resp.status === 403) return { erro: "chave_invalida" };
        if (resp.status === 429) return { erro: "rate_limited" };
        if (msg.includes("credit") || msg.includes("billing") || msg.includes("spend")) return { erro: "sem_credito" };
        if (resp.status >= 500) return { erro: "sobrecarga" };
        return { erro: `HTTP ${resp.status}${msg ? ": " + msg.slice(0, 150) : ""}` };
      }
      return { texto: (corpo.content ?? []).filter((b) => b.type === "text").map((b) => b.text ?? "").join("") };
    } catch (e) {
      const err = e as { code?: string; name?: string };
      if (err?.name === "AbortError") return { erro: "cancelled" };
      return { erro: err?.code || "rede" }; // erros da capacidade sample têm "code"
    } finally {
      if (this.controle === controle) this.controle = null;
    }
  }

  cancelar(): void {
    this.controle?.abort();
    this.controle = null;
  }
}
