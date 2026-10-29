/**
 * Testes de integração: API real contra um PostgreSQL de verdade.
 * Defina DATABASE_URL_TESTE (o banco é APAGADO a cada execução). Sem a variável, os testes são pulados.
 */
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { criarApp } from "../src/app.js";
import { lerConfig } from "../src/config.js";
import { criarBanco, migrar, type Banco } from "../src/db.js";

const URL = process.env.DATABASE_URL_TESTE;
const d = URL ? describe : describe.skip;

let banco: Banco;
let app: ReturnType<typeof criarApp>;
let token = "";
const auth = () => ({ Authorization: `Bearer ${token}` });

d("API do Canteiro Digital", () => {
  beforeAll(async () => {
    banco = criarBanco(URL!);
    await banco.query("drop schema public cascade; create schema public;");
    expect(await migrar(banco)).toEqual(["001_inicial.sql", "002_visoes.sql"]);
    expect(await migrar(banco)).toEqual([]); // idempotente
    app = criarApp(banco, { ...lerConfig({ DATABASE_URL: URL } as NodeJS.ProcessEnv), iteracoes: 100_000 });
  });
  afterAll(async () => { await banco?.end(); });

  it("saúde e estado inicial", async () => {
    expect((await request(app).get("/api/saude")).body.ok).toBe(true);
    expect((await request(app).get("/api/estado")).body.configurado).toBe(false);
    expect((await request(app).get("/api/dados")).status).toBe(401);
  });

  it("primeiro acesso cria escritório e administrador, uma vez só", async () => {
    const fraca = await request(app).post("/api/configurar").send({ escritorio: "ARQX Arquitetura", nome: "Gustavo Araújo", usuario: "gustavo", senha: "abc" });
    expect([fraca.status, fraca.body.erro]).toEqual([400, "A senha precisa ter pelo menos 8 caracteres."]);
    const r = await request(app).post("/api/configurar").send({ escritorio: "ARQX Arquitetura", nome: "Gustavo Araújo", usuario: "Gustavo", senha: "obra2026segura" });
    expect(r.status).toBe(201);
    expect(r.body.conta).toMatchObject({ usuario: "gustavo", papel: "admin", escritorio: "ARQX Arquitetura" });
    token = r.body.token;
    const de_novo = await request(app).post("/api/configurar").send({ escritorio: "X", nome: "Outro", usuario: "outro", senha: "obra2026segura" });
    expect([de_novo.status, de_novo.body.codigo]).toEqual([409, "ja_configurado"]);
    expect((await request(app).get("/api/eu").set(auth())).body.conta.nome).toBe("Gustavo Araújo");
  });

  it("entrar, senha errada e bloqueio progressivo", async () => {
    const ok = await request(app).post("/api/entrar").send({ usuario: "GUSTAVO ", senha: "obra2026segura" });
    expect(ok.status).toBe(200);
    for (let i = 0; i < 5; i++) {
      const e = await request(app).post("/api/entrar").send({ usuario: "fulano", senha: "errada123" });
      expect(e.status).toBe(401);
    }
    const b = await request(app).post("/api/entrar").send({ usuario: "fulano", senha: "errada123" });
    expect([b.status, b.body.codigo]).toEqual([429, "bloqueado"]);
    // sair invalida só aquela sessão
    expect((await request(app).post("/api/sair").set({ Authorization: `Bearer ${ok.body.token}` })).status).toBe(204);
    expect((await request(app).get("/api/eu").set({ Authorization: `Bearer ${ok.body.token}` })).status).toBe(401);
    expect((await request(app).get("/api/eu").set(auth())).status).toBe(200);
  });

  it("administração de acessos", async () => {
    const n = await request(app).post("/api/usuarios").set(auth()).send({ nome: "Thamyris Guedes", usuario: "thamyris", senha: "projeto2026" });
    expect(n.status).toBe(201);
    expect((await request(app).post("/api/usuarios").set(auth()).send({ nome: "Dup", usuario: "thamyris", senha: "projeto2026" })).status).toBe(409);
    const t = await request(app).post("/api/entrar").send({ usuario: "thamyris", senha: "projeto2026" });
    const tauth = { Authorization: `Bearer ${t.body.token}` };
    // membro não administra
    expect((await request(app).post("/api/usuarios").set(tauth).send({ nome: "X Y", usuario: "xy1", senha: "projeto2026" })).status).toBe(403);
    expect((await request(app).get("/api/usuarios").set(tauth)).body.usuarios).toHaveLength(2);
    // único admin não pode deixar de ser admin
    const eu = (await request(app).get("/api/eu").set(auth())).body.conta;
    expect((await request(app).patch(`/api/usuarios/${eu.id}`).set(auth()).send({ papel: "membro" })).status).toBe(400);
    // redefinir senha derruba as sessões da pessoa
    expect((await request(app).patch(`/api/usuarios/${n.body.usuario.id}`).set(auth()).send({ senha: "nova2026senha" })).status).toBe(200);
    expect((await request(app).get("/api/eu").set(tauth)).status).toBe(401);
    expect((await request(app).post("/api/entrar").send({ usuario: "thamyris", senha: "nova2026senha" })).status).toBe(200);
    // trocar a própria senha
    const s = await request(app).post("/api/eu/senha").set(auth()).send({ atual: "errada000", nova: "outra2026segura" });
    expect(s.status).toBe(400);
  });

  it("obras: criar, versão, conflito e exclusão sincronizada", async () => {
    const ini = await request(app).get("/api/dados").set(auth());
    expect(ini.body).toMatchObject({ obras: [], cadastros: null });
    const cursor0 = ini.body.cursor;
    const obra = { id: "obra-1", nome: "Residência Lima", cliente: "Lima", inicio: "2026-11-02", orcamento_total: 850000, etapas: [{ codigo: "01", nome: "Fundação", orcamento: 90000 }], compras: [{ id: "c1", descricao: "Cimento CP-II", quantidade: 200, valor_unitario: 38.9, status: "Cotação" }] };
    const a = await request(app).put("/api/obras/obra-1").set(auth()).send({ dados: obra, versao: 0 });
    expect(a.body.versao).toBe(1);
    const b = await request(app).put("/api/obras/obra-1").set(auth()).send({ dados: { ...obra, nome: "Residência Lima (rev.)" }, versao: 1 });
    expect(b.body.versao).toBe(2);
    // outra pessoa editando a partir da versão 1 → conflito com a versão atual para mesclar
    const c = await request(app).put("/api/obras/obra-1").set(auth()).send({ dados: obra, versao: 1 });
    expect([c.status, c.body.codigo, c.body.atual.versao, c.body.atual.dados.nome]).toEqual([409, "conflito", 2, "Residência Lima (rev.)"]);
    expect((await request(app).put("/api/obras/outra").set(auth()).send({ dados: obra, versao: 0 })).status).toBe(400); // id não confere
    const alt = await request(app).get(`/api/alteracoes?desde=${cursor0}`).set(auth());
    expect(alt.body.obras.map((o: { id: string; versao: number }) => [o.id, o.versao])).toEqual([["obra-1", 2]]);
    // exclusão aparece como "removida" para os outros aparelhos
    expect((await request(app).delete("/api/obras/obra-1?versao=2").set(auth())).status).toBe(204);
    const alt2 = await request(app).get(`/api/alteracoes?desde=${alt.body.cursor}`).set(auth());
    expect([alt2.body.obras, alt2.body.removidas]).toEqual([[], ["obra-1"]]);
    expect((await request(app).get("/api/dados").set(auth())).body.obras).toEqual([]);
    // recriar com o mesmo id funciona
    expect((await request(app).put("/api/obras/obra-1").set(auth()).send({ dados: obra, versao: 0 })).status).toBe(200);
    // histórico guardou as versões anteriores
    const h = await request(app).get("/api/historico?tipo=obra&registro=obra-1").set(auth());
    expect(h.body.versoes.map((v: { acao: string }) => v.acao)).toContain("exclusao");
  });

  it("cadastros, visões SQL e relatórios em CSV", async () => {
    const cad = {
      contatos: [{ id: "ct1", nome: "Casa do Construtor", tipo: "Fornecedor", cidade: "João Pessoa" }],
      insumos: [{ id: "i1", descricao: "Cimento CP-II 50kg", unidade: "sc", preco: 38.9, tipo: "Material" }],
      equipe: [{ id: "m1", nome: "João Pereira", funcao: "Pedreiro", custo_dia: 180, ativo: true, presencas: ["2026-10-27", "2026-10-28"] }],
      projetos: [{
        id: "p1", codigo: "PRJ-2026-001", nome: "Apto Cabo Branco", status: "Em andamento", area: 160, inicio: "2026-10-01", entrega: "data ruim",
        parcelas: [{ id: "pa1", valor: 12000, status: "Recebida", vencimento: "2026-10-05" }, { id: "pa2", valor: 8000, status: "Prevista", vencimento: "" }],
        horas: [{ id: "h1", horas: 10, custo_hora: 80, data: "2026-10-20", pessoa: "Ana" }],
        despesas: [{ id: "d1", valor: 3500, pago: true, data: "2026-10-28", descricao: "Luminotécnico" }],
        orcamento: [{ id: "o1", ambiente: "Sala", descricao: "Sofá; sob medida", quantidade: 1, preco: 18500 }],
      }],
      produtos: [], oportunidades: [],
    };
    const p = await request(app).put("/api/cadastros").set(auth()).send({ dados: cad, versao: 0 });
    expect(p.body.versao).toBe(1);
    expect((await request(app).put("/api/cadastros").set(auth()).send({ dados: cad, versao: 0 })).status).toBe(409);
    // duas atualizações seguidas (o gatilho de histórico precisa servir às duas tabelas)
    expect((await request(app).put("/api/cadastros").set(auth()).send({ dados: { ...cad, x: 1 }, versao: 1 })).body.versao).toBe(2);
    expect((await request(app).put("/api/cadastros").set(auth()).send({ dados: cad, versao: 2 })).body.versao).toBe(3);
    expect((await request(app).get("/api/historico?tipo=cadastros").set(auth())).body.versoes.length).toBe(1); // 1 a cada 5 min por pessoa
    const proj = await request(app).get("/api/relatorios/projetos").set(auth());
    expect(proj.body.linhas[0]).toMatchObject({ codigo: "PRJ-2026-001", area: 160, recebido: 12000, parcelas_total: 20000, custo_horas: 800, despesas: 3500, entrega: null, inicio: "2026-10-01" });
    expect(proj.body.colunas).not.toContain("escritorio_id");
    const eq = await request(app).get("/api/relatorios/equipe").set(auth());
    expect(eq.body.linhas[0]).toMatchObject({ nome: "João Pereira", presencas: 2, custo_dia: 180 });
    const comp = await request(app).get("/api/relatorios/compras").set(auth());
    expect(comp.body.linhas[0]).toMatchObject({ descricao: "Cimento CP-II", total: 7780 });
    const c = await request(app).get("/api/relatorios/orcamento_itens?formato=csv").set(auth());
    expect(c.headers["content-type"]).toContain("text/csv");
    expect(c.text).toContain('"Sofá; sob medida"');
    expect(c.text).toContain("18500");
    expect((await request(app).get("/api/relatorios/nao_existe").set(auth())).status).toBe(404);
    expect((await request(app).get("/api/relatorios").set(auth())).body.relatorios.length).toBe(15);
  });

  it("importar dados e acessos do navegador; exportar backup", async () => {
    const r = await request(app).post("/api/importar").set(auth()).send({
      obras: [{ id: "obra-local", nome: "Obra do navegador" }, { id: "obra-1", nome: "não deve sobrescrever" }, { nome: "sem id" }],
      cadastros: { contatos: [] },
      contas: [{ nome: "Maria Souza", usuario: "maria", papel: "membro", sal: Buffer.alloc(16, 1).toString("base64"), hash: Buffer.alloc(32, 2).toString("base64"), iteracoes: 210000 }, { nome: "Dup", usuario: "gustavo", papel: "admin", sal: Buffer.alloc(16).toString("base64"), hash: Buffer.alloc(32).toString("base64"), iteracoes: 210000 }],
    });
    expect(r.body).toEqual({ obras: 1, obras_ignoradas: 2, cadastros: false, contas: 1, contas_ignoradas: ["gustavo"] });
    const e = await request(app).get("/api/exportar").set(auth());
    expect(e.body.obras.map((o: { id: string }) => o.id).sort()).toEqual(["obra-1", "obra-local"]);
    expect(e.body.cadastros.contatos).toHaveLength(1);
  });

  it("isola escritórios: um não enxerga o outro", async () => {
    const outro = await banco.query<{ id: string }>("insert into escritorios (nome) values ('Outro escritório') returning id");
    await banco.query("insert into obras (escritorio_id, id, dados) values ($1, 'obra-1', '{\"nome\":\"secreta\"}')", [outro.rows[0].id]);
    const obras = (await request(app).get("/api/dados").set(auth())).body.obras;
    expect(obras.some((o: { dados: { nome: string } }) => o.dados.nome === "secreta")).toBe(false);
  });
});
