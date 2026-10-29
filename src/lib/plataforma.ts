/**
 * Plataforma: onde os dados ficam e como falar com a Claude.
 *
 * - Dentro da Claude (artifact): banco compartilhado ("db", coleção "obras") e revisão pela
 *   capacidade "sample" (usa a conta de quem está vendo).
 * - Site externo (GitHub Pages): dados no localStorage deste navegador e revisão com a chave
 *   de API do próprio usuário, guardada só neste navegador (nunca vai para o banco nem para o código).
 * - Com servidor do escritório (pasta server/: Express + PostgreSQL): dados no banco, sincronizados
 *   entre aparelhos a cada 15 s; gravações com controle de versão e mescla automática quando duas
 *   pessoas alteram o mesmo documento (lib/core/mesclar.ts).
 */
import { mesclar } from "@/lib/core/mesclar";
import type { Obra } from "@/lib/core/modelos";
import { api, ErroServidor, lerToken, usandoServidor } from "@/lib/servidor";

export const CHAVE_LOCAL = "canteiro-digital:v1";
export const CHAVE_CADASTROS = "canteiro-digital:cadastros:v1";
const CHAVE_IA = "canteiro-digital:chave-api";
/** Cópia local do que veio do servidor (abre mesmo sem conexão). Separada dos dados do modo local. */
const CHAVE_CACHE = "canteiro-digital:cache-servidor:v1";
const CAD = "\u0000cadastros"; // chave da fila de gravação para os cadastros
const INTERVALO_SYNC = 15_000;
const INTERVALO_COMPLETA = 5 * 60_000;

interface Versionado<T = unknown> {
  versao: number;
  dados: T;
}
interface RespDados {
  obras: ({ id: string } & Versionado<Obra>)[];
  cadastros: Versionado | null;
  cursor: number;
}
interface RespAlteracoes extends RespDados {
  removidas: string[];
}
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
  // ---- modo servidor
  private srv = false;
  private srvCarregado = false;
  private base = new Map<string, Versionado>(); // última versão recebida/gravada no servidor (obras e CAD)
  private atuais = new Map<string, Obra>();
  private cadAtual: unknown = null;
  private cursor = 0;
  private ultimaCompleta = 0;
  private sincronizando = false;
  private relogio: ReturnType<typeof setInterval> | null = null;
  private espera = 3000;
  private semConexao = false;
  private aoFocar = () => { if (document.visibilityState !== "hidden") void this.sincronizar(); };
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
    if (usandoServidor() && lerToken()) {
      await this.iniciarServidor(eventos);
      return;
    }
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
    if (this.srv) {
      this.cadAtual = doc;
      this.guardarCache();
      this.agendar(CAD, doc as Obra);
      return;
    }
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
    if (this.srv) {
      for (const o of gravar) this.atuais.set(o.id, o);
      for (const id of remover) this.atuais.delete(id);
      this.guardarCache();
      for (const o of gravar) this.agendar(o.id, o);
      for (const id of remover) this.agendar(id, null);
      return;
    }
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
    if (!this.emVoo.has(id)) void (this.srv ? this.bombearServidor(id) : this.bombear(id));
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

  // ------------------------------------------------------------ servidor do escritório
  private async iniciarServidor(eventos: Eventos) {
    this.srv = true;
    try {
      const r = await api<RespDados>("/dados");
      this.aplicarCompleta(r, true);
      eventos.status({ texto: "Salvo no servidor · compartilhado com a equipe", tipo: "ok" });
    } catch (e) {
      if (e instanceof ErroServidor && e.status === 401) return; // a tela de entrada volta sozinha
      console.error(e);
      // sem conexão: abre com a última cópia recebida deste servidor
      const c = lerJsonLocal(CHAVE_CACHE) as (RespDados & { cadAtual?: unknown; atuais?: Obra[] }) | null;
      if (c) {
        for (const o of c.obras ?? []) this.base.set(o.id, { versao: o.versao, dados: o.dados });
        if (c.cadastros) this.base.set(CAD, c.cadastros);
        for (const o of c.atuais ?? c.obras?.map((x) => x.dados) ?? []) this.atuais.set(o.id, o);
        this.cadAtual = c.cadAtual ?? c.cadastros?.dados ?? null;
        this.cursor = c.cursor ?? 0;
      }
      this.srvCarregado = true;
      eventos.cadastros(this.cadAtual);
      eventos.dados([...this.atuais.values()], true);
      this.semConexao = true;
      eventos.status({ texto: "Sem conexão com o servidor: mostrando a última cópia deste aparelho", tipo: "erro" });
    }
    this.retomar();
  }

  /** Liga a sincronização periódica (e ao voltar para a aba). */
  retomar(): void {
    if (!this.srv || this.relogio || typeof window === "undefined") return;
    this.relogio = setInterval(() => void this.sincronizar(), INTERVALO_SYNC);
    window.addEventListener("focus", this.aoFocar);
    document.addEventListener("visibilitychange", this.aoFocar);
  }

  parar(): void {
    if (this.relogio) clearInterval(this.relogio);
    this.relogio = null;
    if (typeof window === "undefined") return;
    window.removeEventListener("focus", this.aoFocar);
    document.removeEventListener("visibilitychange", this.aoFocar);
  }

  private pendente(id: string) {
    return this.ultimo.has(id) || this.emVoo.has(id);
  }

  private aplicarCompleta(r: RespDados, primeira: boolean) {
    const vindas = new Set<string>();
    for (const o of r.obras) {
      vindas.add(o.id);
      if (this.pendente(o.id)) continue;
      this.base.set(o.id, { versao: o.versao, dados: o.dados });
      this.atuais.set(o.id, o.dados);
    }
    for (const id of [...this.atuais.keys()]) {
      if (!vindas.has(id) && !this.pendente(id)) { this.atuais.delete(id); this.base.delete(id); }
    }
    if (!this.pendente(CAD)) {
      if (r.cadastros) this.base.set(CAD, r.cadastros);
      this.cadAtual = r.cadastros?.dados ?? this.cadAtual;
      if (r.cadastros || primeira) this.eventosInternos?.cadastros(this.cadAtual);
    }
    this.cursor = r.cursor;
    this.ultimaCompleta = Date.now();
    this.srvCarregado = true;
    this.eventosInternos?.dados([...this.atuais.values()], primeira);
    this.guardarCache();
  }

  /** Busca o que outras pessoas mudaram desde a última vez. */
  async sincronizar(): Promise<void> {
    if (!this.srv || !this.srvCarregado || this.sincronizando || this.ultimo.size || this.emVoo.size) return;
    this.sincronizando = true;
    try {
      if (Date.now() - this.ultimaCompleta > INTERVALO_COMPLETA) {
        this.aplicarCompleta(await api<RespDados>("/dados"), false);
      } else {
        const r = await api<RespAlteracoes>(`/alteracoes?desde=${this.cursor}`);
        let mudou = false;
        for (const o of r.obras) {
          if (this.pendente(o.id)) continue;
          const b = this.base.get(o.id);
          if (b && o.versao <= b.versao) continue; // eco da própria gravação
          this.base.set(o.id, { versao: o.versao, dados: o.dados });
          this.atuais.set(o.id, o.dados);
          mudou = true;
        }
        for (const id of r.removidas) {
          if (this.pendente(id) || !this.atuais.has(id)) continue;
          this.atuais.delete(id);
          this.base.delete(id);
          mudou = true;
        }
        if (r.cadastros && !this.pendente(CAD) && r.cadastros.versao > (this.base.get(CAD)?.versao ?? 0)) {
          this.base.set(CAD, r.cadastros);
          this.cadAtual = r.cadastros.dados;
          this.eventosInternos?.cadastros(this.cadAtual);
        }
        this.cursor = r.cursor;
        if (mudou) this.eventosInternos?.dados([...this.atuais.values()], false);
        if (mudou || r.cadastros) this.guardarCache();
      }
      if (this.semConexao) {
        this.semConexao = false;
        this.emitirStatus({ texto: "Conectado ao servidor", tipo: "ok" });
      }
    } catch (e) {
      if (e instanceof ErroServidor && e.codigo === "rede" && !this.semConexao) {
        this.semConexao = true;
        this.emitirStatus({ texto: "Sem conexão com o servidor: as alterações ficam neste aparelho até voltar", tipo: "erro" });
      }
    } finally {
      this.sincronizando = false;
    }
  }

  private guardarCache() {
    const obras = [...this.base.entries()].filter(([k]) => k !== CAD).map(([id, v]) => ({ id, ...(v as Versionado<Obra>) }));
    lsGravar(CHAVE_CACHE, JSON.stringify({ obras, cadastros: this.base.get(CAD) ?? null, cursor: this.cursor, atuais: [...this.atuais.values()], cadAtual: this.cadAtual }));
  }

  private async bombearServidor(id: string) {
    this.emVoo.add(id);
    this.emitirStatus({ texto: "Salvando…", tipo: "salvando" });
    const ehCad = id === CAD;
    const caminho = ehCad ? "/cadastros" : `/obras/${encodeURIComponent(id)}`;
    let mesclou = false;
    try {
      while (this.ultimo.has(id)) {
        let doc = this.ultimo.get(id) ?? null;
        this.ultimo.delete(id);
        if (doc === null) {
          await api(caminho, { metodo: "DELETE" });
          this.base.delete(id);
          continue;
        }
        let b = this.base.get(id);
        for (let tentativa = 0; ; tentativa++) {
          try {
            const r = await api<{ versao: number }>(caminho, { metodo: "PUT", corpo: { dados: doc, versao: b?.versao ?? 0 } });
            this.base.set(id, { versao: r.versao, dados: doc });
            break;
          } catch (e) {
            if (!(e instanceof ErroServidor) || e.codigo !== "conflito" || tentativa >= 4) throw e;
            // outra pessoa gravou antes: mescla a edição daqui com a versão do servidor e tenta de novo
            const atual = (e.corpo.atual ?? null) as Versionado | null;
            const maisNova = this.ultimo.get(id);
            if (maisNova) { doc = maisNova; this.ultimo.delete(id); }
            doc = atual ? mesclar(b?.dados, doc, atual.dados) : doc;
            b = atual ?? undefined;
            if (ehCad) this.cadAtual = doc; else this.atuais.set(id, doc as Obra);
            mesclou = true;
          }
        }
      }
      this.espera = 3000;
      if (mesclou) {
        this.guardarCache();
        if (ehCad) this.eventosInternos?.cadastros(this.cadAtual);
        else this.eventosInternos?.dados([...this.atuais.values()], false);
      }
      if (this.semConexao) this.semConexao = false;
      if (this.emVoo.size <= 1 && !this.ultimo.size) {
        this.emitirStatus(mesclou
          ? { texto: "Salvo · mesclado com alterações de outra pessoa", tipo: "ok" }
          : { texto: "Salvo no servidor", tipo: "ok" });
      }
    } catch (e) {
      const err = e as ErroServidor;
      if (err instanceof ErroServidor && err.status === 401) return; // sessão expirou: a tela de entrada volta
      // devolve à fila para tentar de novo (sem apagar uma edição mais nova que já esteja lá)
      const atual = ehCad ? this.cadAtual : this.atuais.get(id) ?? null;
      if (!this.ultimo.has(id)) this.ultimo.set(id, (atual ?? null) as Obra | null);
      if (err instanceof ErroServidor && (err.codigo === "rede" || err.status >= 500 || err.status === 429)) {
        this.semConexao = err.codigo === "rede";
        this.emitirStatus({ texto: err.codigo === "rede" ? "Sem conexão: as alterações ficam neste aparelho e vão ao servidor quando voltar" : "O servidor está com problema; tentando de novo…", tipo: "erro" });
        const espera = this.espera;
        this.espera = Math.min(60_000, this.espera * 2);
        setTimeout(() => { if (this.ultimo.has(id) && !this.emVoo.has(id)) void this.bombearServidor(id); }, espera);
      } else {
        console.error(e);
        this.ultimo.delete(id);
        this.emitirStatus({ texto: `Não foi possível salvar no servidor: ${err.message}`, tipo: "erro" });
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
