"use client";

/**
 * Liga o núcleo (Sistema) ao React: guarda o estado, executa ações, grava as obras
 * alteradas e faz a ponte com a Claude.
 */
import * as React from "react";

import { Sistema, type Dados, type Resultado } from "@/lib/core/sistema";
import { Plataforma, type Status } from "@/lib/plataforma";

const TROCA_TELA = new Set(["ui.aba", "ui.fase_ir", "obra.selecionar", "obra.criar", "obra.exemplo"]);

interface Api {
  sis: Sistema;
  versao: number;
  /** Muda a cada ação executada (o aviso da última ação só aparece de novo depois de outra ação). */
  avisoId: number;
  carregado: boolean;
  status: Status;
  plataforma: Plataforma;
  acao: (nome: string, dados?: Dados) => Resultado;
  /** Reavalia o modo da revisão (depois de salvar/remover a chave de API). */
  atualizarModoIa: () => void;
}

const Contexto = React.createContext<Api | null>(null);

export function ProvedorSistema({ children, hoje = null }: { children: React.ReactNode; hoje?: string | null }) {
  const sisRef = React.useRef<Sistema | null>(null);
  if (!sisRef.current) sisRef.current = new Sistema(hoje);
  const sis = sisRef.current;
  const platRef = React.useRef<Plataforma | null>(null);
  if (!platRef.current && typeof window !== "undefined") platRef.current = new Plataforma();

  const [versao, setVersao] = React.useState(0);
  const [avisoId, setAvisoId] = React.useState(0);
  const [carregado, setCarregado] = React.useState(false);
  const [status, setStatus] = React.useState<Status>({ texto: "", tipo: "" });
  const redesenhar = React.useCallback(() => setVersao((v) => v + 1), []);

  const atualizarModoIa = React.useCallback(() => {
    const p = platRef.current;
    if (!p) return;
    sis.despachar("ia.modo", { modo: p.modoIa, final: p.lerChave().slice(-4), chave_permitida: p.chavePermitida });
    redesenhar();
  }, [sis, redesenhar]);

  const acaoRef = React.useRef<Api["acao"] | null>(null);
  const acao = React.useCallback(
    (nome: string, dados: Dados = {}): Resultado => {
      const p = platRef.current;
      if (nome === "ia.cancelar") p?.cancelar();
      let r: Resultado;
      try {
        r = sis.despachar(nome, dados);
      } catch (e) {
        console.error(e);
        sis.ui.erro = `Não foi possível concluir a ação: ${(e as Error).message}`;
        redesenhar();
        return { ok: false, alteradas: [], removidas: [] };
      }
      const gravar = r.alteradas.filter((id) => sis.obras.has(id)).map((id) => sis.exportar(id));
      if (p && (gravar.length || r.removidas.length)) p.persistir(gravar, r.removidas, sis.todas());
      if (p && r.cadastros) p.persistirCadastros(JSON.parse(JSON.stringify(sis.cadastros)));
      const pedido = sis.pedidoIa;
      if (pedido && p) {
        sis.pedidoIa = null;
        void p.perguntar(pedido.texto).then((res) => {
          acaoRef.current?.("ia.resultado", { id: pedido.id, texto: res.texto ?? "", erro: res.erro ?? "" });
        });
      }
      if (TROCA_TELA.has(nome) && r.ok && typeof window !== "undefined") window.scrollTo({ top: 0 });
      setAvisoId((n) => n + 1);
      redesenhar();
      return r;
    },
    [sis, redesenhar],
  );
  acaoRef.current = acao;

  React.useEffect(() => {
    const p = platRef.current;
    if (!p) return;
    atualizarModoIa();
    // os ouvintes mais recentes sempre recebem os eventos (seguro com o StrictMode do React)
    void p.iniciar({
      dados: (docs, primeira) => {
        const falhas = sis.carregar(docs);
        if (falhas.length) console.warn("Documentos ignorados:", falhas);
        if (primeira) {
          setCarregado((ja) => {
            if (!ja) window.scrollTo({ top: 0 });
            return true;
          });
        }
        redesenhar();
      },
      status: (s) => setStatus(s),
      modoIa: () => atualizarModoIa(),
      cadastros: (doc) => {
        sis.carregarCadastros(doc);
        redesenhar();
      },
    });
  }, [sis, redesenhar, atualizarModoIa]);

  const valor = React.useMemo<Api>(
    () => ({ sis, versao, avisoId, carregado, status, plataforma: platRef.current!, acao, atualizarModoIa }),
    [sis, versao, avisoId, carregado, status, acao, atualizarModoIa],
  );
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useSistema(): Api {
  const c = React.useContext(Contexto);
  if (!c) throw new Error("useSistema fora do ProvedorSistema");
  return c;
}

/** Envia um formulário como ação (campos pelo atributo name; números no formato brasileiro). */
export function useEnviar() {
  const { acao } = useSistema();
  return React.useCallback(
    (nome: string, extras: Dados = {}, opcoes: { limpar?: boolean } = {}) =>
      (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const form = e.currentTarget;
        const dados: Dados = { ...extras };
        new FormData(form).forEach((v, k) => {
          dados[k] = typeof v === "string" ? v : "";
        });
        const r = acao(nome, dados);
        if (r.ok && opcoes.limpar) form.reset();
        return r;
      },
    [acao],
  );
}
