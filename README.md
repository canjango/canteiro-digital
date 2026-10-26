# Canteiro Digital — gestão de obras, compras e tarefas (Python)

Site: https://canjango.github.io/canteiro-digital/

A cada push na branch `main`, o GitHub Actions roda os testes, monta o site (`python build_artifact.py --site`) e publica no GitHub Pages. No site, os dados ficam salvos no navegador de cada pessoa.

## Estrutura
- `gestao_obras/etapas.py` — 17 etapas construtivas em 7 fases (preparação → entrega), com pesos de custo, predecessoras, normas ABNT e checklists
- `gestao_obras/modelos.py` — Obra, Etapa, Compra, Tarefa, ItemChecklist (dataclasses, JSON)
- `gestao_obras/servicos.py` — regras: criação de obra com orçamento/cronograma, fluxo de compras, tarefas
- `gestao_obras/analise.py` — avanço físico ponderado, previsto, IDP, custos por etapa/categoria, alertas
- `gestao_obras/ui.py` + `sistema.py` + `ponte_web.py` — interface gerada em Python e despachante de ações
- `app.py` — servidor Flask (rodar local ou hospedar)
- `build_artifact.py` + `web/plataforma.js` — versão publicada (Python no navegador via Pyodide)

## Rodar
    pip install -r requirements.txt
    python -m pytest          # 33 testes
    python app.py             # http://127.0.0.1:5000

## Limitações conhecidas
- Cada obra é um documento: duas pessoas editando a mesma obra ao mesmo tempo → vale a última gravação.
- O servidor Flask não tem login; para expor na internet, coloque atrás de autenticação.
