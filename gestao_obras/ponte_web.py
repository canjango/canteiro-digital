"""Ponte entre a interface no navegador e o núcleo Python.

Usada tanto pelo Pyodide (Python rodando no navegador) quanto pelo servidor
Flask. Toda a troca é feita em JSON (texto), o que mantém a camada JavaScript
mínima: ela só repassa eventos e grava os documentos que o Python devolve.

No navegador há um único `Sistema` (global do módulo); o Flask passa o seu
próprio `Sistema` em `sis=` para não depender de estado global.
"""

from __future__ import annotations

import json

from .sistema import Sistema
from .ui import render

_sis: Sistema | None = None


def iniciar(sistema: Sistema | None = None) -> Sistema:
    global _sis
    _sis = sistema or Sistema()
    return _sis


def _s(sis: Sistema | None) -> Sistema:
    return sis or _sis or iniciar()


def carregar(documentos_json: str, sis: Sistema | None = None) -> str:
    """Recebe a lista de obras (JSON) do banco e devolve avisos (JSON)."""
    try:
        docs = json.loads(documentos_json or "[]")
    except json.JSONDecodeError:
        docs = []
    if not isinstance(docs, list):
        docs = []
    falhas = _s(sis).carregar([d for d in docs if isinstance(d, dict)])
    return json.dumps(falhas, ensure_ascii=False)


def acao(nome: str, dados_json: str = "{}", sis: Sistema | None = None) -> str:
    """Executa a ação e devolve JSON com o novo HTML e os documentos a gravar."""
    s = _s(sis)
    try:
        dados = json.loads(dados_json or "{}")
    except json.JSONDecodeError:
        dados = None
    if not isinstance(dados, dict):
        # nunca executa uma ação com dados corrompidos (poderia agir com valores padrão)
        s.ui["msg"], s.ui["erro"] = "", "Dados da ação inválidos; nada foi alterado"
        return json.dumps({"ok": False, "html": render(s), "gravar": [], "remover": []}, ensure_ascii=False)
    r = s.despachar(str(nome), {str(k): v for k, v in dados.items()})
    gravar = [{"id": oid, "doc": s.exportar(oid)} for oid in r["alteradas"] if oid in s.obras]
    return json.dumps(
        {"ok": r["ok"], "html": render(s), "gravar": gravar, "remover": r["removidas"]},
        ensure_ascii=False,
    )


def tela(sis: Sistema | None = None) -> str:
    return render(_s(sis))


def todas(sis: Sistema | None = None) -> str:
    """Todas as obras (para cópia local / backup)."""
    return json.dumps([o.para_dict() for o in _s(sis).obras.values()], ensure_ascii=False)
