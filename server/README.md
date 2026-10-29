# Servidor do Canteiro Digital — Node.js + Express + PostgreSQL

API e banco de dados do escritório. O mesmo processo também serve o aplicativo (a exportação estática do
Next.js), então um único endereço atende a equipe toda.

## Rodar

**Com Docker** (PostgreSQL incluído), na raiz do projeto:

```bash
cp server/.env.example .env   # troque POSTGRES_PASSWORD
docker compose up -d --build
# abra http://localhost:3000 → “Primeiro acesso” cria o escritório e o administrador
```

**Sem Docker** (PostgreSQL 14+ já instalado):

```bash
createdb canteiro                       # ou crie pelo pgAdmin
npm ci && npm run build                 # na raiz: gera out/ (o aplicativo)
cd server && npm ci && npm run build
DATABASE_URL=postgres://usuario:senha@localhost:5432/canteiro PASTA_APP=../out npm start
```

As migrações do banco rodam sozinhas ao iniciar (`MIGRAR_AO_INICIAR=0` para desligar e usar `npm run migrar`).
Desenvolvimento com recarga automática: `npm run dev`.

### Variáveis

| Variável | Para quê |
|---|---|
| `DATABASE_URL` | Conexão PostgreSQL (obrigatória). Em serviço gerenciado, use a URL com `?sslmode=require`. |
| `PORT` | Porta HTTP (padrão 3000). |
| `PASTA_APP` | Pasta do aplicativo exportado (`out/`). Vazio = só a API. |
| `CORS_ORIGENS` | Sites que podem chamar a API pelo navegador, separados por vírgula (ex.: `https://canjango.github.io`). |
| `CONFIAR_PROXY` | `1` atrás de proxy/HTTPS (Render, Railway, Nginx, Caddy) — IP real para limites de tentativas. |
| `PBKDF2_ITERACOES` | Custo do hash de senha (padrão 210 000, mínimo 100 000). |
| `PG_CONEXOES` | Conexões no pool (padrão 10). |

### Hospedagem

Qualquer lugar que rode Node 20+ e PostgreSQL serve: um computador do escritório com Docker, uma VPS
(Hostinger, Locaweb, DigitalOcean) com Caddy/Nginx para o HTTPS, ou serviços gerenciados (Render/Railway para o
Node + Neon/Supabase/Render para o PostgreSQL). Para o site do GitHub Pages falar com o servidor, ele precisa
estar em **https** e com `CORS_ORIGENS=https://canjango.github.io`.

Faça cópias de segurança do banco (`pg_dump`) ou baixe a cópia JSON em **Gestão de equipe → Acessos**.

## Banco de dados

Migrações em [`migracoes/`](migracoes):

- **`escritorios`** — cada escritório tem seus usuários e dados, isolados (todas as consultas filtram por escritório).
- **`usuarios`** — nome, usuário, papel (`admin`/`membro`), ativo, senha como PBKDF2-SHA-256 com sal por conta
  (o mesmo formato do acesso local, por isso os acessos do navegador podem ser importados sem trocar senha).
- **`sessoes`** — o banco guarda só o SHA-256 do token; 12 h, ou 30 dias com “manter conectado”. Trocar ou
  redefinir a senha, ou desativar a conta, encerra as sessões.
- **`tentativas_login`** — pausa progressiva após 5 erros (30 s dobrando até 15 min), além de limite por IP.
- **`obras`** — um documento JSONB por obra (o mesmo formato do aplicativo), com `versao` e exclusão marcada
  (`excluida_em`), para os outros aparelhos saberem que ela saiu.
- **`cadastros`** — um documento JSONB por escritório: projetos, propostas e licitações, contatos, insumos, equipe,
  biblioteca de produtos, templates, regras.
- **`historico`** — versão anterior de cada documento a cada alteração (no máximo 1 a cada 5 min por pessoa,
  guardando as 200 mais recentes) e toda exclusão.
- **`seq_alteracao`** — cada gravação recebe um número crescente; os aparelhos pedem “o que mudou depois do nº X”.

**Visões SQL** (`002_visoes.sql`) transformam os documentos em tabelas para consultar, cruzar e levar para BI ou
planilhas: `v_obras`, `v_etapas`, `v_compras`, `v_tarefas_obra`, `v_projetos`, `v_parcelas`, `v_horas`,
`v_despesas`, `v_tarefas_projeto`, `v_orcamento_itens`, `v_oportunidades`, `v_contatos`, `v_insumos`, `v_equipe`,
`v_produtos`. Exemplo:

```sql
select projeto_codigo, projeto, sum(valor) filter (where status = 'Recebida') as recebido,
       sum(valor) filter (where status <> 'Recebida' and vencimento < current_date) as em_atraso
  from v_parcelas group by 1, 2 order by 1;
```

## Como a sincronização funciona

1. Ao entrar, o aplicativo baixa tudo (`GET /api/dados`) e guarda uma cópia local (abre mesmo sem internet).
2. Cada alteração grava o documento com a versão em que se baseou (`PUT … {dados, versao}`).
3. Se outra pessoa gravou antes, o servidor responde **409** com a versão atual; o aplicativo **mescla** as duas
   (lista a lista, item a item por `id` — ver `src/lib/core/mesclar.ts`) e grava de novo. Se as duas pessoas
   mudaram o mesmo campo, vale a última edição, e a anterior fica no histórico.
4. A cada 15 s (e ao voltar para a aba), `GET /api/alteracoes?desde=N` traz o que mudou.
5. Sem conexão, as alterações ficam na fila e são enviadas quando o servidor volta.

## API

Todas as rotas em `/api`. Autenticação por `Authorization: Bearer <token>`.

| Método e rota | O que faz |
|---|---|
| `GET /saude` | Teste de vida (inclui o banco). |
| `GET /estado` | `{configurado}` — já existe administrador? |
| `POST /configurar` | Primeiro acesso: `{escritorio, nome, usuario, senha}` → sessão. Só com o servidor vazio. |
| `POST /entrar` | `{usuario, senha, lembrar}` → `{token, expira_em, conta}`. |
| `POST /sair` · `GET /eu` · `POST /eu/senha` | Encerrar sessão, conta atual, trocar a própria senha. |
| `GET/POST /usuarios` · `PATCH/DELETE /usuarios/:id` | Acessos (alterar e criar: só administrador). |
| `GET /dados` · `GET /alteracoes?desde=N` | Carga completa e incremental. |
| `PUT /obras/:id` · `DELETE /obras/:id` | Gravar (com versão) e excluir obra. |
| `PUT /cadastros` | Gravar os cadastros do escritório (com versão). |
| `GET /historico?tipo=obra&registro=:id` · `GET /historico/:n` | Versões anteriores. |
| `POST /importar` | Administrador: traz obras, cadastros e acessos do modo local. |
| `GET /exportar` | Administrador: cópia de segurança JSON. |
| `GET /relatorios` · `GET /relatorios/:nome[?formato=csv]` | As visões acima em JSON ou CSV (abre no Excel). |

## Testes

```bash
DATABASE_URL_TESTE=postgres://usuario:senha@localhost:5432/canteiro_teste npm test
```

O banco de teste é **apagado** a cada execução. Sem a variável, os testes são pulados. No GitHub Actions eles
rodam com um PostgreSQL 16 de serviço.
