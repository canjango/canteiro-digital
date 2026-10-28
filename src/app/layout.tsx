import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Canteiro Digital",
  description: "Gestão de obras, compras e tarefas: etapas construtivas com checklist, controle de compras, CUB por estado e revisão com Claude.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2f1ec" },
    { media: "(prefers-color-scheme: dark)", color: "#0f0e0b" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        {/* aplica a aparência escolhida antes de desenhar (sem piscar a paleta padrão) */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var a=JSON.parse(localStorage.getItem("canteiro-digital:aparencia")||"{}"),h=document.documentElement;if(a.paleta&&a.paleta!=="leitura")h.dataset.paleta=a.paleta;if(a.tema==="escuro")h.classList.add("dark");if(a.tema==="claro")h.classList.add("light")}catch(e){}`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
