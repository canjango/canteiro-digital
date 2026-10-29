import { describe, expect, it } from "vitest";
import { iguais, mesclar } from "@/lib/core/mesclar";

describe("mesclar (três vias)", () => {
  it("mudança de um lado só prevalece", () => {
    const base = { nome: "Obra A", cliente: "X", orcamento: 100 };
    expect(mesclar(base, { ...base, nome: "Obra A1" }, base)).toEqual({ nome: "Obra A1", cliente: "X", orcamento: 100 });
    expect(mesclar(base, base, { ...base, cliente: "Y" })).toEqual({ nome: "Obra A", cliente: "Y", orcamento: 100 });
    expect(mesclar(base, { ...base, nome: "Aqui" }, { ...base, cliente: "Lá" })).toEqual({ nome: "Aqui", cliente: "Lá", orcamento: 100 });
  });
  it("mesmo campo nos dois lados: vale o local", () => {
    expect(mesclar({ v: 1 }, { v: 2 }, { v: 3 })).toEqual({ v: 2 });
  });
  it("listas com id: inclusões, edições e exclusões dos dois lados", () => {
    const base = { compras: [{ id: "a", q: 1 }, { id: "b", q: 1 }, { id: "c", q: 1 }] };
    const local = { compras: [{ id: "a", q: 5 }, { id: "c", q: 1 }, { id: "n1", q: 1 }] }; // edita a, exclui b, inclui n1
    const remoto = { compras: [{ id: "a", q: 1 }, { id: "b", q: 1 }, { id: "c", q: 9 }, { id: "n2", q: 2 }] }; // edita c, inclui n2
    expect(mesclar(base, local, remoto).compras).toEqual([{ id: "a", q: 5 }, { id: "c", q: 9 }, { id: "n2", q: 2 }, { id: "n1", q: 1 }]);
  });
  it("editado de um lado e excluído do outro: fica o editado", () => {
    const base = { t: [{ id: "x", s: "A fazer" }] };
    expect(mesclar(base, { t: [] }, { t: [{ id: "x", s: "Feito" }] }).t).toEqual([{ id: "x", s: "Feito" }]);
    expect(mesclar(base, { t: [{ id: "x", s: "Feito" }] }, { t: [] }).t).toEqual([{ id: "x", s: "Feito" }]);
    expect(mesclar(base, { t: [] }, base).t).toEqual([]);
  });
  it("mesclagem aninhada: projetos > parcelas", () => {
    const base = { projetos: [{ id: "p1", nome: "Casa", parcelas: [{ id: "s", valor: 10 }] }] };
    const local = { projetos: [{ id: "p1", nome: "Casa", parcelas: [{ id: "s", valor: 10 }, { id: "n", valor: 5 }] }] };
    const remoto = { projetos: [{ id: "p1", nome: "Casa Lima", parcelas: [{ id: "s", valor: 12 }] }, { id: "p2", nome: "Apto", parcelas: [] }] };
    expect(mesclar(base, local, remoto)).toEqual({
      projetos: [{ id: "p1", nome: "Casa Lima", parcelas: [{ id: "s", valor: 12 }, { id: "n", valor: 5 }] }, { id: "p2", nome: "Apto", parcelas: [] }],
    });
  });
  it("etapas por código e listas de textos (presenças)", () => {
    const base = { etapas: [{ codigo: "01", p: 1 }], presencas: ["2026-10-01", "2026-10-02"] };
    const local = { etapas: [{ codigo: "01", p: 2 }], presencas: ["2026-10-01", "2026-10-03"] };
    const remoto = { etapas: [{ codigo: "01", p: 1 }, { codigo: "02", p: 1 }], presencas: ["2026-10-01", "2026-10-02", "2026-10-04"] };
    expect(mesclar(base, local, remoto)).toEqual({ etapas: [{ codigo: "01", p: 2 }, { codigo: "02", p: 1 }], presencas: ["2026-10-01", "2026-10-04", "2026-10-03"] });
  });
  it("campos novos e removidos", () => {
    expect(mesclar({ a: 1, b: 2 }, { a: 1 }, { a: 1, b: 2, c: 3 })).toEqual({ a: 1, c: 3 });
    expect(mesclar({ a: 1 }, { a: 1, novo: true }, { a: 2 })).toEqual({ a: 2, novo: true });
  });
  it("iguais ignora ordem das chaves", () => {
    expect(iguais({ a: 1, b: [1, { c: 2 }] }, { b: [1, { c: 2 }], a: 1 })).toBe(true);
    expect(iguais({ a: 1 }, { a: 1, b: 1 })).toBe(false);
  });
});
