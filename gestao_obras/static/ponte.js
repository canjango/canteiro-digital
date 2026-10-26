/* Camada mínima de eventos: toda a lógica e o HTML vêm do Python.
   Espera window.Backend = { acao(nome, dados) -> Promise<{html, gravar, remover}> } */
(function () {
  const app = document.getElementById("app");
  const snake = (k) => k.replace(/[A-Z]/g, (m) => "_" + m.toLowerCase());
  let ocupado = false;

  function dadosDe(el) {
    const d = {};
    for (const [k, v] of Object.entries(el.dataset)) if (k !== "action") d[snake(k)] = v;
    return d;
  }
  function chave(el) {
    return el && el.dataset && el.dataset.action ? el.dataset.action + "|" + JSON.stringify(el.dataset) : null;
  }

  function pintar(html, opts) {
    opts = opts || {};
    const ativo = document.activeElement;
    const idFoco = ativo && app.contains(ativo) ? ativo.id : "";
    const chaveFoco = ativo && app.contains(ativo) ? chave(ativo) : null;
    const y = window.scrollY;
    // preserva rascunhos (texto digitado e ainda não salvo) de campos que não foram enviados
    const rascunhos = {};
    if (!opts.topo) app.querySelectorAll("input[id], textarea[id]").forEach((el) => {
      if (el.type !== "date" && el.value !== el.defaultValue && !(opts.enviado && opts.enviado.contains(el))) rascunhos[el.id] = el.value;
    });
    app.innerHTML = html;
    for (const [id, valor] of Object.entries(rascunhos)) {
      const el = document.getElementById(id);
      if (el) el.value = valor;
    }
    if (opts.topo) window.scrollTo(0, 0);
    else window.scrollTo(0, y);
    let alvo = idFoco ? document.getElementById(idFoco) : null;
    if (!alvo && chaveFoco) {
      alvo = Array.from(app.querySelectorAll("[data-action]")).find((el) => chave(el) === chaveFoco) || null;
    }
    if (alvo) try { alvo.focus({ preventScroll: true }); } catch (e) {}
  }

  async function executar(nome, dados, enviado) {
    if (ocupado) return;
    ocupado = true;
    try {
      const r = await window.Backend.acao(nome, dados);
      const trocaTela = nome === "ui.aba" || nome === "obra.selecionar" || nome === "obra.criar" || nome === "obra.exemplo";
      // ao trocar de tela ou quando a ação falha, o formulário enviado mantém o que foi digitado
      pintar(r.html, { topo: trocaTela && r.ok, enviado: r.ok ? enviado : null });
      if (window.Backend.persistir) window.Backend.persistir(r.gravar || [], r.remover || []);
    } catch (e) {
      console.error(e);
      const aviso = document.createElement("div");
      aviso.className = "aviso aviso-erro";
      aviso.setAttribute("role", "alert");
      aviso.textContent = "Não foi possível concluir a ação: " + (e && e.message ? e.message.split("\n").slice(-2).join(" ") : e);
      app.prepend(aviso);
    } finally {
      ocupado = false;
    }
  }

  app.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-action]");
    if (!b || b.type === "submit" || b.disabled) return;
    e.preventDefault();
    executar(b.dataset.action, dadosDe(b));
  });
  app.addEventListener("submit", (e) => {
    const f = e.target.closest("form[data-action]");
    if (!f) return;
    e.preventDefault();
    const d = dadosDe(f);
    for (const [k, v] of new FormData(f)) d[k] = v;
    executar(f.dataset.action, d, f);
  });
  app.addEventListener("change", (e) => {
    const s = e.target.closest("select[data-action]");
    if (!s) return;
    const d = dadosDe(s);
    d[s.name] = s.value;
    executar(s.dataset.action, d);
  });

  /* evita repintar por cima de um formulário sendo preenchido */
  function editando() {
    const a = document.activeElement;
    return !!(a && app.contains(a) && a.matches("input, textarea") && a.value);
  }

  window.Ponte = { pintar, executar, editando };
})();
