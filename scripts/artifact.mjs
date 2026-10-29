// Gera a versão em arquivo único (publicada como artifact da Claude): o mesmo app React,
// empacotado com esbuild, com CSS (Tailwind), fontes e dados embutidos numa página HTML.
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const saida = path.join(raiz, "artifact");
mkdirSync(saida, { recursive: true });

// 1. Tailwind: compila globals.css varrendo os componentes
const twOut = path.join(raiz, "src/artifact/tailwind.out.css");
execFileSync(path.join(raiz, "node_modules/.bin/tailwindcss"), ["-i", "src/app/globals.css", "-o", twOut, "--minify"], {
  cwd: raiz, stdio: "inherit",
});

// 2. CSS final com fontes embutidas
const css = await esbuild.build({
  entryPoints: [path.join(raiz, "src/artifact/estilos.css")],
  bundle: true, minify: true, write: false, loader: { ".woff2": "dataurl", ".woff": "dataurl" },
  logLevel: "warning",
});

// 3. JavaScript (React + app + dados), sem divisão em pedaços
const js = await esbuild.build({
  entryPoints: [path.join(raiz, "src/artifact/entrada.tsx")],
  bundle: true, minify: true, write: false, format: "iife", target: "es2020", jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"', "process.env.NEXT_PUBLIC_API_URL": '""' }, tsconfig: path.join(raiz, "tsconfig.json"),
  logLevel: "warning", legalComments: "none",
});
rmSync(twOut, { force: true });

const fechar = (t) => t.replace(/<\/(script|style)/gi, "<\\/$1");
const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="claude:viewport-fit-sides" content="cover">
<title>Canteiro Digital</title>
<style>${fechar(css.outputFiles[0].text)}</style>
</head>
<body>
<div id="app"></div>
<script>${fechar(js.outputFiles[0].text)}</script>
</body>
</html>
`;
writeFileSync(path.join(saida, "index.html"), html);
console.log(`artifact/index.html — ${(Buffer.byteLength(html) / 1024).toFixed(0)} KB`);
