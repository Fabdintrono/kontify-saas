import { describe, it, expect } from "vitest";
import { resolveSort, nextSortParams, toggleDir, compareBy, type SortSpec } from "@/lib/sorting";

const SPEC: SortSpec = {
  default: { key: "name", dir: "asc" },
  columns: {
    name: { column: "name", natural: "asc" },
    price: { column: "price", natural: "desc" },
    sku: { column: "sku", natural: "asc", nullsFirst: false },
  },
};

describe("resolveSort", () => {
  it("devuelve el defecto cuando no hay parámetros", () => {
    expect(resolveSort(SPEC, undefined, undefined)).toEqual({
      key: "name", dir: "asc", column: "name", ascending: true, nullsFirst: undefined,
    });
  });

  it("devuelve el defecto cuando la clave no está en la lista blanca", () => {
    expect(resolveSort(SPEC, "password", "asc").key).toBe("name");
    expect(resolveSort(SPEC, "name); drop table products; --", "asc").column).toBe("name");
  });

  it("una clave inválida tampoco impone su dirección: cae el defecto completo", () => {
    expect(resolveSort(SPEC, "password", "desc")).toEqual({
      key: "name", dir: "asc", column: "name", ascending: true, nullsFirst: undefined,
    });
    // Y una dirección suelta sin clave tampoco manda.
    expect(resolveSort(SPEC, undefined, "desc").dir).toBe("asc");
  });

  it("no acepta claves heredadas del prototipo", () => {
    expect(resolveSort(SPEC, "constructor", "asc").key).toBe("name");
    expect(resolveSort(SPEC, "toString", "asc").key).toBe("name");
  });

  it("ignora una dirección inventada y usa la natural de la columna", () => {
    expect(resolveSort(SPEC, "price", "arriba")).toEqual({
      key: "price", dir: "desc", column: "price", ascending: false, nullsFirst: undefined,
    });
  });

  it("respeta la dirección pedida", () => {
    expect(resolveSort(SPEC, "price", "asc").ascending).toBe(true);
  });

  it("arrastra nullsFirst de la columna", () => {
    expect(resolveSort(SPEC, "sku", "asc").nullsFirst).toBe(false);
  });
});

describe("nextSortParams", () => {
  it("al pulsar la columna activa invierte la dirección", () => {
    expect(nextSortParams(SPEC, { key: "name", dir: "asc" }, "name")).toEqual({ sort: "name", dir: "desc" });
    expect(nextSortParams(SPEC, { key: "name", dir: "desc" }, "name")).toEqual({ sort: "name", dir: "asc" });
  });

  it("al pulsar otra columna usa su dirección natural", () => {
    expect(nextSortParams(SPEC, { key: "name", dir: "asc" }, "price")).toEqual({ sort: "price", dir: "desc" });
  });

  it("una clave fuera de la lista blanca no cambia nada", () => {
    expect(nextSortParams(SPEC, { key: "name", dir: "asc" }, "drop")).toEqual({ sort: "name", dir: "asc" });
  });
});

describe("toggleDir", () => {
  it("invierte la activa y estrena las demás con su natural", () => {
    expect(toggleDir({ key: "total", dir: "desc" }, "total", "desc")).toBe("asc");
    expect(toggleDir({ key: "total", dir: "desc" }, "name", "asc")).toBe("asc");
    expect(toggleDir(null, "total", "desc")).toBe("desc");
  });
});

describe("compareBy", () => {
  const rows = [{ n: "Beta", v: 2 }, { n: "alfa", v: 10 }, { n: "Gamma", v: null as number | null }];

  it("ordena texto ignorando mayúsculas y acentos", () => {
    expect(compareBy(rows, (r) => r.n, true).map((r) => r.n)).toEqual(["alfa", "Beta", "Gamma"]);
  });

  it("ordena números como números, no como texto", () => {
    expect(compareBy(rows, (r) => r.v, true).map((r) => r.v)).toEqual([2, 10, null]);
  });

  it("deja los vacíos al final también al invertir", () => {
    expect(compareBy(rows, (r) => r.v, false).map((r) => r.v)).toEqual([10, 2, null]);
  });

  it("no muta el arreglo original", () => {
    const original = [...rows];
    compareBy(rows, (r) => r.n, false);
    expect(rows).toEqual(original);
  });
});
