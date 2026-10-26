"""Servidor Flask para rodar o sistema localmente ou em qualquer hospedagem
Python (Render, Railway, PythonAnywhere...).

    pip install -r requirements.txt
    python app.py            # http://127.0.0.1:5000

Os dados ficam em dados/obras.json (um arquivo por instalação).
"""

from __future__ import annotations

import json
import os
import tempfile
import threading
from pathlib import Path

from flask import Flask, Response, jsonify, request

from gestao_obras import ponte_web
from gestao_obras.sistema import Sistema

BASE = Path(__file__).resolve().parent
STATIC = BASE / "gestao_obras" / "static"


def criar_app(arquivo_dados: str | os.PathLike | None = None, sistema: Sistema | None = None) -> Flask:
    app = Flask(__name__)
    caminho = Path(arquivo_dados or os.environ.get("OBRAS_DADOS", BASE / "dados" / "obras.json"))
    trava = threading.Lock()
    sis = sistema or Sistema()

    def ler() -> None:
        if caminho.exists():
            try:
                docs = json.loads(caminho.read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError):
                app.logger.exception("Arquivo de dados ilegível: %s", caminho)
                docs = []
            falhas = sis.carregar(docs if isinstance(docs, list) else [])
            for f in falhas:
                app.logger.warning("Obra ignorada: %s", f)

    def gravar() -> None:
        caminho.parent.mkdir(parents=True, exist_ok=True)
        # gravação atômica: escreve em arquivo temporário e renomeia
        fd, tmp = tempfile.mkstemp(dir=caminho.parent, suffix=".tmp")
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            f.write(ponte_web.todas(sis))
        os.replace(tmp, caminho)

    ler()

    @app.get("/")
    def index():
        css = (STATIC / "estilo.css").read_text(encoding="utf-8")
        js = (STATIC / "ponte.js").read_text(encoding="utf-8")
        with trava:
            tela = ponte_web.tela(sis)
        html = PAGINA.replace("/*CSS*/", css).replace("<!--TELA-->", tela).replace("/*PONTE*/", js)
        return Response(html, mimetype="text/html")

    @app.post("/api/acao")
    def api_acao():
        corpo = request.get_json(silent=True) or {}
        nome = str(corpo.get("acao", ""))
        dados = corpo.get("dados") if isinstance(corpo.get("dados"), dict) else {}
        with trava:
            r = json.loads(ponte_web.acao(nome, json.dumps(dados), sis))
            if r["gravar"] or r["remover"]:
                gravar()
        return jsonify({"ok": r["ok"], "html": r["html"]})

    @app.get("/api/obras")
    def api_obras():
        with trava:
            return Response(ponte_web.todas(sis), mimetype="application/json")

    app.config["ARQUIVO_DADOS"] = caminho
    return app


PAGINA = """<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Canteiro Digital</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@600;700;800&family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&display=swap">
<style>/*CSS*/</style></head>
<body><div id="app"><!--TELA--></div>
<script>
window.Backend = {
  async acao(acao, dados) {
    const r = await fetch("/api/acao", {method: "POST", headers: {"Content-Type": "application/json"},
                                         body: JSON.stringify({acao, dados})});
    if (!r.ok) throw new Error("Servidor respondeu " + r.status);
    return r.json();
  }
};
/*PONTE*/
</script></body></html>"""


if __name__ == "__main__":
    criar_app().run(host=os.environ.get("HOST", "127.0.0.1"), port=int(os.environ.get("PORT", 5000)), debug=False)
