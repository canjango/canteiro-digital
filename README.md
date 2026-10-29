# Canteiro Digital — gestão de obras, compras e tarefas

Site: https://canjango.github.io/canteiro-digital/

Feito em **Next.js 15 + React 19 + TypeScript**, com **Tailwind CSS 4** e componentes **shadcn/ui** (Radix).
A cada push na branch `main`, o GitHub Actions verifica os tipos, roda os testes, gera o site estático
(`next build` com `output: "export"`) e publica no GitHub Pages. No site, os dados ficam salvos no
navegador de cada pessoa (localStorage, chave `canteiro-digital:v1`, o mesmo formato da versão anterior).

## Acesso e áreas

Ao abrir, o sistema pede **usuário e senha** (no primeiro acesso cria-se o administrador). Depois, o
**painel de acesso** divide o sistema em três áreas: **Gestão de projetos** (projetos por fase, prazos e
honorários; gera a obra a partir do projeto), **Gestão de obras** (tudo abaixo) e **Gestão de equipe**
(pessoas, alocação por obra, presença, custo do mês e acessos ao sistema).

As contas ficam no navegador (`localStorage`), com a senha guardada só como hash PBKDF2-SHA-256
(210 mil iterações, sal por conta) e pausa progressiva após 5 tentativas erradas. Sem servidor, isso
protege contra uso casual do aparelho, mas não substitui autenticação no servidor.

## Gestão de projetos

- **Tipos de obra e categorias:** residencial, interiores, comercial e corporativo, institucional e público, urbanismo e
  paisagismo, reforma e regularização, industrial; padrão (alto, médio, econômico, público) e origem (particular, indicação,
  licitação, concurso).
- **Fases (CAU / NBR 16636):** LV, PN, EV, EP, AP (com projeto legal), PB (licitações), PE, CO, AO, com modelos por tipo de obra
  e pesos editáveis (fecham 100%).
- **Honorários:** % do custo da obra (área × CUB do padrão no estado), valor por m², valor fixo ou custo do serviço
  (horas × custo/hora × K — Modalidade 02 do CAU), desconto e aditivos; valor por fase e parcelas por fase com sinal.
- **Horas e resultado:** lançamentos por fase e pessoa (custo/hora da equipe), consumo de horas por fase, valor agregado,
  margem atual e prevista no término.
- **Entregáveis:** por fase e disciplina, com revisão R00, R01… e situação; aprovações do cliente e revisões além do contrato.
- **Propostas e licitações:** funil particular e de licitações com prazos da Lei 14.133 (art. 55 publicação, art. 164 impugnação,
  art. 165 recurso), garantias (arts. 58 e 98), checklist de habilitação e conversão em projeto.
- **Habilitação:** documentos da empresa com validade, conferidos na data da sessão.
- **Regras:** % e revisões por padrão, K, custo/hora, aprovação obrigatória (bloqueio), alertas de horas, prazos e margem mínima.
  Percentuais são referências editáveis do escritório, não a tabela oficial do CAU.

## Módulos (painel em grade da tela Início)

| Grupo | Módulos |
|---|---|
| Acompanhamento da obra | Painel, Etapas construtivas, Diário de obra (RDO), Medição de obra, Tarefas |
| Suprimentos | Solicitações de compras → Ordem de compra (aprovação, recebimento com NF), Controle de compras, Pedidos de compra, Lista de materiais, Insumos |
| Financeiro | Recebimentos (parcelas do contrato e das medições aprovadas) |
| Cadastros | Contatos (fornecedores, prestadores, clientes…), Obras |

Contatos e insumos são compartilhados entre as obras (coleção `cadastros`). Ordens de compra aprovadas
entram no comprometido do orçamento; o material recebido entra no realizado.

## Estrutura
- `src/lib/core/` — núcleo sem React (testável):
  - `modelos.ts` — Obra, Etapa, Compra, Tarefa, ItemControle (mesmos campos do JSON gravado) e leitura tolerante de dados antigos
  - `catalogo.ts` — 17 etapas construtivas em 7 fases, padrões e CUB por estado, materiais por etapa, especificações
  - `servicos.ts` — regras: criação de obra (orçamento pelo CUB, cronograma), checklists, compras, tarefas, lista de materiais
  - `analise.ts` — avanço físico, IDP, medição, custos, BDI e alertas
  - `controle.ts` — metodologia de compras (base da planilha → programação → cotação → decisão → compra → controle)
  - `assistente.ts` — pedido e leitura da revisão com Claude
  - `sistema.ts` — estado da tela e despachante de ações
- `src/lib/dados/*.json` — catálogos (etapas, materiais, especificações, CUB, base de compras, desenhos técnicos)
- `src/lib/plataforma.ts` — gravação (localStorage ou banco do artifact) e chamada à Claude
- `src/components/ui/` — componentes shadcn/ui; `src/components/app/` — telas
- `scripts/artifact.mjs` — versão em arquivo único (artifact da Claude), empacotada com esbuild

## Rodar
    npm install
    npm test            # vitest (inclui equivalência com a versão anterior)
    npm run dev         # http://localhost:3000
    npm run build       # site estático em out/
    npm run artifact    # artifact/index.html (arquivo único)

## Limitações conhecidas
- Cada obra é um documento: duas pessoas editando a mesma obra ao mesmo tempo → vale a última gravação.
- No site, os dados ficam só no navegador; para compartilhar entre pessoas use a versão aberta pela Claude.
