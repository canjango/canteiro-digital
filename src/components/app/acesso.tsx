"use client";

import * as React from "react";
import { EyeIcon, EyeOffIcon, Loader2Icon, LockKeyholeIcon, ShieldCheckIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import * as ac from "@/lib/acesso";
import { cn } from "@/lib/utils";
import { BotaoTema } from "./tema";

interface ApiAcesso {
  conta: ac.ContaPublica | null;
  contas: ac.ContaPublica[];
  pronto: boolean;
  entrar: (usuario: string, senha: string, lembrar: boolean) => Promise<void>;
  sair: () => void;
  recarregar: () => void;
}

const Contexto = React.createContext<ApiAcesso | null>(null);

export function useAcesso(): ApiAcesso {
  const c = React.useContext(Contexto);
  if (!c) throw new Error("useAcesso fora do ProvedorAcesso");
  return c;
}

export function ProvedorAcesso({ children }: { children: React.ReactNode }) {
  const [estado, setEstado] = React.useState<{ conta: ac.ContaPublica | null; contas: ac.ContaPublica[]; pronto: boolean }>({
    conta: null, contas: [], pronto: false,
  });
  const recarregar = React.useCallback(() => {
    setEstado({ conta: ac.sessaoAtual(), contas: ac.listarContas(), pronto: true });
  }, []);
  React.useEffect(() => {
    recarregar();
    // outra aba saiu ou entrou: acompanha
    const ouvir = (e: StorageEvent) => { if (e.key?.startsWith("canteiro-digital:")) recarregar(); };
    window.addEventListener("storage", ouvir);
    return () => window.removeEventListener("storage", ouvir);
  }, [recarregar]);
  const api = React.useMemo<ApiAcesso>(
    () => ({
      ...estado,
      recarregar,
      entrar: async (u, s, l) => {
        await ac.entrar(u, s, l);
        recarregar();
      },
      sair: () => {
        ac.sair();
        recarregar();
      },
    }),
    [estado, recarregar],
  );
  return <Contexto.Provider value={api}>{children}</Contexto.Provider>;
}

/** Mostra a tela de entrada até haver uma sessão válida. */
export function Portao({ children }: { children: React.ReactNode }) {
  const { conta, pronto } = useAcesso();
  if (!pronto) return null;
  return conta ? <>{children}</> : <TelaEntrada />;
}

// ---------------------------------------------------------------- tela de entrada
function TelaEntrada() {
  const { contas } = useAcesso();
  const primeiro = contas.length === 0;
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <aside className="relative hidden overflow-hidden bg-trilho p-10 text-trilho-foreground lg:flex lg:flex-col lg:justify-between">
        <div className="flex items-center gap-3">
          <span className="marca-listras size-10 rounded-md" aria-hidden />
          <span className="text-lg font-bold text-white">Canteiro Digital</span>
        </div>
        <div className="flex max-w-md flex-col gap-4">
          <h2 className="text-3xl font-bold leading-tight text-white">Projetos, obras e equipe no mesmo lugar.</h2>
          <ul className="flex flex-col gap-2 text-[0.95rem]">
            <li>— Projetos por fase, do briefing ao detalhamento</li>
            <li>— Obras com etapas, compras, diário e medição</li>
            <li>— Equipe com alocação, presença e custo do mês</li>
          </ul>
        </div>
        <div className="marca-listras absolute -bottom-6 -right-16 h-24 w-[140%] -rotate-6 opacity-90" aria-hidden />
        <span aria-hidden className="h-16" />
      </aside>
      <main className="relative flex items-center justify-center p-4 py-16 sm:p-8">
        <div className="absolute right-4 top-[calc(1rem+env(safe-area-inset-top))]"><BotaoTema /></div>
        <div className="flex w-full max-w-sm flex-col gap-6">
          <div className="flex items-center gap-3 lg:hidden">
            <span className="marca-listras size-9 rounded-md" aria-hidden />
            <span className="text-lg font-bold">Canteiro Digital</span>
          </div>
          {primeiro ? <FormPrimeiroAcesso /> : <FormEntrar />}
          <p className="flex items-start gap-2 text-[0.78rem] text-muted-foreground">
            <ShieldCheckIcon className="mt-0.5 size-4 shrink-0" />
            O acesso fica guardado neste aparelho e a senha é salva apenas de forma criptografada.
          </p>
        </div>
      </main>
    </div>
  );
}

function CampoSenha({ id, rotulo, ...props }: React.ComponentProps<"input"> & { rotulo: string }) {
  const [ver, setVer] = React.useState(false);
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">{rotulo}</label>
      <div className="relative">
        <Input id={id} type={ver ? "text" : "password"} className="h-11 pr-11" {...props} />
        <button
          type="button"
          onClick={() => setVer((v) => !v)}
          className="absolute right-1 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label={ver ? "Ocultar senha" : "Mostrar senha"}
          aria-pressed={ver}
        >
          {ver ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
        </button>
      </div>
    </div>
  );
}

function Erro({ texto }: { texto: string }) {
  if (!texto) return null;
  return <p role="alert" className="rounded-md border border-critico/40 bg-critico-suave px-3 py-2 text-sm font-medium text-critico">{texto}</p>;
}

function FormEntrar() {
  const { entrar } = useAcesso();
  const [erro, setErro] = React.useState("");
  const [carregando, setCarregando] = React.useState(false);
  const enviar = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setErro("");
    setCarregando(true);
    try {
      await entrar(String(f.get("usuario") ?? ""), String(f.get("senha") ?? ""), f.get("lembrar") === "on");
    } catch (x) {
      setErro(x instanceof ac.AcessoErro ? x.message : "Não foi possível entrar.");
      setCarregando(false);
    }
  };
  return (
    <form className="flex flex-col gap-4" onSubmit={enviar} noValidate>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">Entrar</h1>
        <p className="text-sm text-muted-foreground">Use seu usuário e senha para acessar.</p>
      </div>
      <Erro texto={erro} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="usuario" className="text-sm font-medium">Usuário</label>
        <Input id="usuario" name="usuario" autoComplete="username" autoCapitalize="none" spellCheck={false} required autoFocus className="h-11" />
      </div>
      <CampoSenha id="senha" name="senha" rotulo="Senha" autoComplete="current-password" required />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="lembrar" className="size-4 accent-[var(--foreground)]" />
        Manter conectado neste aparelho por 30 dias
      </label>
      <Button type="submit" className="h-11 text-[0.95rem]" disabled={carregando}>
        {carregando ? <Loader2Icon className="animate-spin" /> : <LockKeyholeIcon />}
        {carregando ? "Verificando…" : "Entrar"}
      </Button>
      <p className="text-[0.78rem] text-muted-foreground">Esqueceu a senha? Peça a um administrador para redefinir em Gestão de equipe → Acessos.</p>
    </form>
  );
}

function FormPrimeiroAcesso() {
  const { entrar } = useAcesso();
  const [erro, setErro] = React.useState("");
  const [senha, setSenha] = React.useState("");
  const [carregando, setCarregando] = React.useState(false);
  const forca = ac.forcaSenha(senha);
  const enviar = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const d = { nome: String(f.get("nome") ?? ""), usuario: String(f.get("usuario") ?? ""), senha: String(f.get("senha") ?? "") };
    setErro("");
    if (d.senha !== String(f.get("confirmar") ?? "")) return setErro("As senhas não são iguais.");
    setCarregando(true);
    try {
      const c = await ac.criarConta(d);
      await entrar(c.usuario, d.senha, f.get("lembrar") === "on");
    } catch (x) {
      setErro(x instanceof ac.AcessoErro ? x.message : "Não foi possível criar o acesso.");
      setCarregando(false);
    }
  };
  return (
    <form className="flex flex-col gap-4" onSubmit={enviar} noValidate>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">Primeiro acesso</h1>
        <p className="text-sm text-muted-foreground">Crie o usuário administrador. Depois você cadastra os acessos da equipe.</p>
      </div>
      <Erro texto={erro} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="nome" className="text-sm font-medium">Seu nome</label>
        <Input id="nome" name="nome" autoComplete="name" required maxLength={80} autoFocus className="h-11" />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="usuario" className="text-sm font-medium">Usuário</label>
        <Input id="usuario" name="usuario" autoComplete="username" autoCapitalize="none" spellCheck={false} required maxLength={32} placeholder="ex.: gustavo" className="h-11" />
      </div>
      <div className="flex flex-col gap-1.5">
        <CampoSenha id="senha" name="senha" rotulo="Senha" autoComplete="new-password" required value={senha} onChange={(e) => setSenha(e.target.value)} />
        <div className="flex items-center gap-2" aria-live="polite">
          <div className="flex flex-1 gap-1" aria-hidden>
            {[1, 2, 3].map((n) => (
              <span key={n} className={cn("h-1.5 flex-1 rounded-full bg-muted", senha && forca.nivel >= n && (forca.nivel === 1 ? "bg-critico" : forca.nivel === 2 ? "bg-atencao" : "bg-ok"))} />
            ))}
          </div>
          <span className="w-24 text-right text-[0.76rem] text-muted-foreground">{senha ? forca.rotulo : "mín. 8, letras e números"}</span>
        </div>
      </div>
      <CampoSenha id="confirmar" name="confirmar" rotulo="Confirmar senha" autoComplete="new-password" required />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="lembrar" defaultChecked className="size-4 accent-[var(--foreground)]" />
        Manter conectado neste aparelho por 30 dias
      </label>
      <Button type="submit" className="h-11 text-[0.95rem]" disabled={carregando}>
        {carregando ? <Loader2Icon className="animate-spin" /> : <ShieldCheckIcon />}
        {carregando ? "Criando…" : "Criar acesso e entrar"}
      </Button>
    </form>
  );
}
