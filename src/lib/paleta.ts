/** Aparência por pessoa (fica só neste navegador): paleta de cores e tema claro/escuro. */
export const PALETAS = [
  { id: "leitura", nome: "Leitura fácil", desc: "Contraste alto e textos mais escuros", amostra: ["#ffffff", "#1d1b17", "#f2cf1d", "#2f6b33", "#b23a2a"] },
  { id: "canteiro", nome: "Canteiro (anterior)", desc: "Tons mais suaves, cinzas mais claros", amostra: ["#f2f1ec", "#2a2824", "#f5d90a", "#5e8a3a", "#c9532e"] },
] as const;
export type Paleta = (typeof PALETAS)[number]["id"];

export const TEMAS = [
  { id: "auto", nome: "Automático" },
  { id: "claro", nome: "Claro" },
  { id: "escuro", nome: "Escuro" },
] as const;
export type Tema = (typeof TEMAS)[number]["id"];

const CHAVE = "canteiro-digital:aparencia";

export interface Aparencia {
  paleta: Paleta;
  tema: Tema;
}
const PADRAO: Aparencia = { paleta: "leitura", tema: "auto" };

export function lerAparencia(): Aparencia {
  try {
    const v = JSON.parse(localStorage.getItem(CHAVE) || "{}");
    return {
      paleta: PALETAS.some((p) => p.id === v.paleta) ? v.paleta : PADRAO.paleta,
      tema: TEMAS.some((t) => t.id === v.tema) ? v.tema : PADRAO.tema,
    };
  } catch {
    return PADRAO;
  }
}

export function aplicarAparencia(a: Aparencia, gravar = false): void {
  const html = document.documentElement;
  if (a.paleta === "leitura") delete html.dataset.paleta;
  else html.dataset.paleta = a.paleta;
  html.classList.toggle("dark", a.tema === "escuro");
  html.classList.toggle("light", a.tema === "claro");
  if (gravar) {
    try {
      localStorage.setItem(CHAVE, JSON.stringify(a));
    } catch {
      /* sem armazenamento: vale só nesta visita */
    }
  }
}
