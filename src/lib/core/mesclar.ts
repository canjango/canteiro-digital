/**
 * Mescla em três vias: `base` (última versão que este aparelho recebeu do servidor), `local`
 * (o que a pessoa editou aqui) e `remoto` (o que outra pessoa gravou no servidor nesse meio-tempo).
 *
 * Regras:
 * - o que só um lado mudou, prevalece a mudança;
 * - listas de objetos com `id` (ou `codigo`) são mescladas item a item, então duas pessoas podem
 *   incluir/editar compras, tarefas ou projetos diferentes ao mesmo tempo sem perder nada;
 * - listas de textos (ex.: dias de presença) somam inclusões e removem exclusões de cada lado;
 * - se os dois mudaram o MESMO campo, vale a edição deste aparelho (a outra fica no histórico do servidor);
 * - item editado de um lado e excluído do outro: fica a versão editada (nada some sem querer).
 */
type Valor = unknown;
type Obj = Record<string, Valor>;

const ehObj = (v: Valor): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);

export function iguais(a: Valor, b: Valor): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b || a === null || b === null || typeof a !== "object") return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    const y = b as Valor[];
    return a.length === y.length && a.every((v, i) => iguais(v, y[i]));
  }
  const x = a as Obj;
  const y = b as Obj;
  const ka = Object.keys(x).filter((k) => x[k] !== undefined);
  const kb = Object.keys(y).filter((k) => y[k] !== undefined);
  return ka.length === kb.length && ka.every((k) => iguais(x[k], y[k]));
}

const chaveDe = (v: Valor): string | null => {
  if (!ehObj(v)) return null;
  if (typeof v.id === "string" && v.id) return `id:${v.id}`;
  if (typeof v.codigo === "string" && v.codigo) return `cod:${v.codigo}`;
  return null;
};

function listaComChave(...listas: Valor[][]): boolean {
  const todos = listas.flat();
  if (!todos.length) return false;
  if (!todos.every((v) => chaveDe(v) !== null)) return false;
  // chaves repetidas na mesma lista: não dá para casar itens com segurança
  return listas.every((l) => new Set(l.map(chaveDe)).size === l.length);
}

const ehPrimitivo = (v: Valor) => v === null || ["string", "number", "boolean"].includes(typeof v);

function mesclarListaChave(base: Valor[], local: Valor[], remoto: Valor[]): Valor[] {
  const mapa = (l: Valor[]) => new Map(l.map((v) => [chaveDe(v)!, v]));
  const b = mapa(base);
  const l = mapa(local);
  const r = mapa(remoto);
  const saida: Valor[] = [];
  const feito = new Set<string>();
  const decidir = (k: string): Valor | undefined => {
    const [vb, vl, vr] = [b.get(k), l.get(k), r.get(k)];
    if (vb !== undefined) {
      if (vl === undefined && vr === undefined) return undefined; // excluído dos dois lados
      if (vl === undefined) return iguais(vr, vb) ? undefined : vr; // excluído aqui; se lá editaram, mantém
      if (vr === undefined) return iguais(vl, vb) ? undefined : vl; // excluído lá; se aqui editamos, mantém
      return mesclar(vb, vl, vr);
    }
    if (vl !== undefined && vr !== undefined) return mesclar(undefined, vl, vr);
    return vl ?? vr;
  };
  // ordem: a do servidor, com os itens novos deste aparelho na posição em que foram incluídos
  const ordemLocal = local.map((v) => chaveDe(v)!);
  for (const v of remoto) {
    const k = chaveDe(v)!;
    // itens novos locais que vinham antes deste no array local
    const pos = ordemLocal.indexOf(k);
    if (pos > 0) {
      for (let i = 0; i < pos; i++) {
        const kl = ordemLocal[i];
        if (!feito.has(kl) && !r.has(kl) && !b.has(kl)) {
          feito.add(kl);
          const x = decidir(kl);
          if (x !== undefined) saida.push(x);
        }
      }
    }
    if (feito.has(k)) continue;
    feito.add(k);
    const x = decidir(k);
    if (x !== undefined) saida.push(x);
  }
  for (const k of ordemLocal) {
    if (feito.has(k)) continue;
    feito.add(k);
    const x = decidir(k);
    if (x !== undefined) saida.push(x);
  }
  return saida;
}

function mesclarListaSimples(base: Valor[], local: Valor[], remoto: Valor[]): Valor[] {
  const tem = (l: Valor[], v: Valor) => l.some((x) => iguais(x, v));
  const removidosAqui = base.filter((v) => !tem(local, v));
  const incluidosAqui = local.filter((v) => !tem(base, v));
  const saida = remoto.filter((v) => !tem(removidosAqui, v));
  for (const v of incluidosAqui) if (!tem(saida, v)) saida.push(v);
  return saida;
}

export function mesclar<T>(base: Valor, local: T, remoto: Valor): T {
  if (iguais(local, base)) return remoto as T;
  if (iguais(remoto, base) || iguais(local, remoto)) return local;
  if (ehObj(local) && ehObj(remoto)) {
    const b = ehObj(base) ? base : {};
    const saida: Obj = {};
    for (const k of new Set([...Object.keys(remoto), ...Object.keys(local)])) {
      const naBase = k in b;
      const [vb, vl, vr] = [b[k], local[k], remoto[k]];
      if (!(k in local) && naBase) { if (!iguais(vr, vb)) saida[k] = vr; continue; } // removido aqui
      if (!(k in remoto) && naBase) { if (!iguais(vl, vb)) saida[k] = vl; continue; } // removido lá
      const v = mesclar(vb, vl, vr);
      if (v !== undefined) saida[k] = v;
    }
    return saida as T;
  }
  if (Array.isArray(local) && Array.isArray(remoto)) {
    const b = Array.isArray(base) ? base : [];
    if (listaComChave(b, local, remoto)) return mesclarListaChave(b, local, remoto) as T;
    if ([...b, ...local, ...remoto].every(ehPrimitivo)) return mesclarListaSimples(b, local, remoto) as T;
  }
  return local; // os dois mudaram o mesmo valor: vale a edição deste aparelho
}
