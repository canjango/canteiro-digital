"""Monta a página publicada (Python rodando no navegador via Pyodide).

    python build_artifact.py   ->  publicar/index.html

O pacote gestao_obras é embutido na página; o runtime do Pyodide é publicado
junto (pasta pyodide/) e os scripts de carga vêm do CDN jsDelivr.
"""

from __future__ import annotations

import json
from pathlib import Path

BASE = Path(__file__).resolve().parent
PKG = BASE / "gestao_obras"
SAIDA = BASE / "publicar" / "index.html"
PYODIDE = "0.27.7"


def fontes() -> dict[str, str]:
    return {
        f"gestao_obras/{p.name}": p.read_text(encoding="utf-8")
        for p in sorted(PKG.glob("*.py"))
    }


def montar() -> str:
    css = (PKG / "static" / "estilo.css").read_text(encoding="utf-8")
    ponte = (PKG / "static" / "ponte.js").read_text(encoding="utf-8")
    plataforma = (BASE / "web" / "plataforma.js").read_text(encoding="utf-8")
    # "</" dentro do JSON fecharia a tag <script>; escapa
    dados = json.dumps(fontes(), ensure_ascii=False).replace("</", "<\\/")
    cdn = f"https://cdn.jsdelivr.net/npm/pyodide@{PYODIDE}"
    return f"""<title>Canteiro Digital</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>
{css}
.estado-gravacao {{ position: fixed; right: max(12px, env(safe-area-inset-right, 0px)); bottom: calc(12px + env(safe-area-inset-bottom, 0px)); z-index: 20;
  background: var(--superficie); border: 1px solid var(--linha); border-radius: 20px; padding: 4px 12px; font-size: 0.75rem; color: var(--tinta-2);
  font-family: var(--fonte-dado); max-width: calc(100vw - 32px); }}
.estado-gravacao:empty {{ display: none; }}
@media (max-width: 760px) {{ .estado-gravacao {{ bottom: calc(70px + env(safe-area-inset-bottom, 0px)); }} }}
.estado-gravacao[data-tipo="ok"]::before {{ content: "● "; color: var(--ok); }}
.estado-gravacao[data-tipo="salvando"]::before {{ content: "● "; color: var(--atencao); }}
.estado-gravacao[data-tipo="local"]::before {{ content: "● "; color: var(--info); }}
.estado-gravacao[data-tipo="erro"] {{ color: var(--critico); border-color: var(--critico); }}
</style>
<div id="app">
  <div class="carregando">
    <div>
      <span class="marca-ico" aria-hidden="true"></span>
      <h2>Canteiro Digital</h2>
      <p id="passo-carga">Preparando…</p>
      <p class="nota">Etapas construtivas, compras e tarefas da obra. O sistema roda em Python no próprio navegador; a primeira carga leva alguns segundos.</p>
    </div>
  </div>
</div>
<div id="estado-gravacao" class="estado-gravacao" role="status" aria-live="polite"></div>
<script type="application/json" id="fontes-python">{dados}</script>
<script src="{cdn}/pyodide.asm.js"></script>
<script src="{cdn}/pyodide.js"></script>
<script>
{ponte}
</script>
<script>
{plataforma}
</script>
"""


def montar_site() -> str:
    """Versão para hospedagem estática (GitHub Pages etc.): página completa,
    runtime do Pyodide carregado do CDN e dados salvos no navegador."""
    cdn = f"https://cdn.jsdelivr.net/npm/pyodide@{PYODIDE}/"
    corpo = montar().replace(
        '<script src="' + cdn + 'pyodide.asm.js"></script>\n', ""
    ).replace("<script>\n", f'<script>window.PYODIDE_CDN = "{cdn}";</script>\n<script>\n', 1)
    # título, fontes e estilo vão para o <head>; o restante para o <body>
    corte = corpo.index("</style>") + len("</style>")
    cabeca, resto = corpo[:corte], corpo[corte:]
    return (
        '<!doctype html>\n<html lang="pt-BR"><head><meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
        '<meta name="color-scheme" content="light dark">\n'
        + cabeca + "\n</head><body>" + resto + "\n</body></html>\n"
    )


if __name__ == "__main__":
    import sys

    if "--site" in sys.argv:
        destino = BASE / "site" / "index.html"
        destino.parent.mkdir(parents=True, exist_ok=True)
        destino.write_text(montar_site(), encoding="utf-8")
        (destino.parent / ".nojekyll").write_text("")
        print(f"{destino} ({destino.stat().st_size / 1024:.0f} KB)")
    else:
        SAIDA.parent.mkdir(parents=True, exist_ok=True)
        SAIDA.write_text(montar(), encoding="utf-8")
        print(f"{SAIDA} ({SAIDA.stat().st_size / 1024:.0f} KB)")
