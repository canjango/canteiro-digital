import type { NextConfig } from "next";

// Exportação estática (GitHub Pages / artifact da Claude). NEXT_BASE_PATH define o subcaminho do site,
// ex.: "/canteiro-digital" no GitHub Pages; vazio para servir na raiz.
const basePath = process.env.NEXT_BASE_PATH || "";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  assetPrefix: basePath || undefined,
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
};

export default nextConfig;
