/* Plataforma: carrega o Python (Pyodide) no navegador, instala o pacote
   gestao_obras e liga a gravação no banco compartilhado do artifact.
   Toda regra de negócio e todo HTML vêm do Python. */
(async function () {
  const app = document.getElementById("app");
  const statusEl = document.getElementById("estado-gravacao");
  const CHAVE_LOCAL = "canteiro-digital:v1";
  let py = null, col = null, somenteLeitura = false;

  function status(texto, tipo) {
    statusEl.textContent = texto;
    statusEl.dataset.tipo = tipo || "";
  }
  function etapa(texto) {
    const el = document.getElementById("passo-carga");
    if (el) el.textContent = texto;
  }
  function lsLer() { try { return localStorage.getItem(CHAVE_LOCAL); } catch (e) { return null; } }
  function lsGravar() { try { localStorage.setItem(CHAVE_LOCAL, py.todas()); } catch (e) {} }

  // o banco é pedido já no início (responde em paralelo ao carregamento do Python)
  const dbPromessa = (window.claude && window.claude.use ? window.claude.use("db") : Promise.resolve(null)).catch(() => null);

  try {
    etapa("Carregando o Python no navegador…");
    // site externo: runtime direto do CDN; artifact: runtime publicado junto da página
    const pyodide = window.PYODIDE_CDN
      ? await loadPyodide({ indexURL: window.PYODIDE_CDN })
      : await (async () => {
          const base = new URL("pyodide/", location.href).href;
          // a biblioteca padrão vai publicada com extensão binária servida pela plataforma
          return loadPyodide({ indexURL: base, stdLibURL: base + "python_stdlib.zip.wasm" });
        })();
    etapa("Instalando o sistema…");
    const fontes = JSON.parse(document.getElementById("fontes-python").textContent);
    for (const [caminho, codigo] of Object.entries(fontes)) {
      const partes = ("/app/" + caminho).split("/");
      let dir = "";
      for (const p of partes.slice(1, -1)) {
        dir += "/" + p;
        try { pyodide.FS.mkdir(dir); } catch (e) {}
      }
      pyodide.FS.writeFile("/app/" + caminho, codigo);
    }
    pyodide.runPython("import sys; sys.path.insert(0, '/app')");
    const ponte = pyodide.pyimport("gestao_obras.ponte_web");
    py = { acao: ponte.acao, carregar: ponte.carregar, tela: ponte.tela, todas: ponte.todas };
  } catch (e) {
    console.error(e);
    app.innerHTML = '<div class="carregando"><div><h2>Não foi possível iniciar o Python neste navegador</h2>' +
      '<p>Atualize a página. Se persistir, use um navegador atualizado (Chrome, Edge, Safari ou Firefox).</p></div></div>';
    return;
  }

  // ------------------------------------------------------------ gravação
  const ultimo = new Map();   // id -> doc mais recente (null = excluir)
  const emVoo = new Set();
  async function bombear(id) {
    emVoo.add(id);
    status("Salvando…", "salvando");
    try {
      while (ultimo.has(id)) {
        const doc = ultimo.get(id);
        ultimo.delete(id);
        const ref = col.doc(id);
        try {
          if (doc === null) await ref.delete(); else await ref.set(doc);
        } catch (e) {
          if (e && e.code === "unavailable") {   // falha transitória: uma nova tentativa
            await new Promise((r) => setTimeout(r, 400 + Math.random() * 600));
            if (doc === null) await ref.delete(); else await ref.set(doc);
          } else throw e;
        }
      }
      if (!emVoo.size || emVoo.size === 1) status("Salvo", "ok");
    } catch (e) {
      console.error(e);
      if (e && e.code === "invalid_argument") {
        somenteLeitura = true;
        status("Somente leitura: você não tem permissão para alterar", "erro");
      } else if (e && e.code === "quota_exceeded") {
        status("Banco cheio: exclua obras antigas para continuar salvando", "erro");
      } else {
        status("Erro ao salvar. Suas alterações estão guardadas neste navegador.", "erro");
      }
    } finally {
      emVoo.delete(id);
    }
  }
  function agendar(id, doc) {
    ultimo.set(id, doc);
    if (!emVoo.has(id)) bombear(id);
  }

  window.Backend = {
    async acao(nome, dados) { return JSON.parse(py.acao(nome, JSON.stringify(dados))); },
    persistir(gravar, remover) {
      if (!gravar.length && !remover.length) return;
      lsGravar();
      if (!col || somenteLeitura) return;
      for (const g of gravar) agendar(g.id, g.doc);
      for (const id of remover) agendar(id, null);
    },
  };

  // ------------------------------------------------------------ banco
  etapa("Conectando ao banco de dados…");
  const db = await dbPromessa;
  if (db) {
    col = db.collection("obras");
    let primeira = true;
    // se o banco demorar, abre com a cópia local para não travar na tela de carga
    setTimeout(() => {
      if (!primeira) return;
      const local = lsLer();
      if (local) py.carregar(local);
      status("Aguardando o banco… mostrando a cópia deste navegador", "local");
      window.Ponte.pintar(py.tela(), { topo: true });
    }, 12000);
    col.onSnapshot(
      (snap) => {
        // ignora o eco das próprias gravações em andamento
        if (!primeira && (snap.metadata.hasPendingWrites || emVoo.size || ultimo.size)) return;
        const docs = snap.docs.map((d) => d.data());
        py.carregar(JSON.stringify(docs));
        lsGravar();
        if (primeira) {
          primeira = false;
          status("Salvo na nuvem · compartilhado", "ok");
          window.Ponte.pintar(py.tela(), { topo: true });
        } else if (!window.Ponte.editando()) {
          window.Ponte.pintar(py.tela());
        }
      },
      (e) => {
        console.error(e);
        status("Sem conexão com o banco; alterações ficam neste navegador", "erro");
        col = null;
      }
    );
  } else {
    const local = lsLer();
    if (local) py.carregar(local);
    status("Salvo apenas neste navegador", "local");
    window.Ponte.pintar(py.tela(), { topo: true });
  }
})();
