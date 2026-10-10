import { describe, it, expect } from "vitest";
import { newUserClient } from "./setup";
import { createClient as createClientRow } from "@/lib/clientes/mutations";
import { listClients, listClientTypes } from "@/lib/clientes/queries";
import { createProduct } from "@/lib/productos/mutations";
import { listProducts, listCategories } from "@/lib/productos/queries";

async function makeTenant(name: string) {
  const u = await newUserClient();
  const { data: tenantId } = await u.client.rpc("bootstrap_tenant", {
    p_name: name, p_slug: `${name}-${Date.now()}-${Math.random()}`, p_full_name: name,
  });
  return { ...u, tenantId: tenantId as string };
}

describe("orden de listas — clientes", () => {
  it("ordena por nombre en los dos sentidos", async () => {
    const a = await makeTenant("ord-cli");
    const types = await listClientTypes(a.client);
    for (const n of ["Carlos", "Ana", "Bruno"]) {
      await createClientRow(a.client, a.tenantId, a.id, null, { kind: "person", name: n, typeId: types[0].id });
    }

    const asc = await listClients(a.client, { sort: "name", dir: "asc" });
    expect(asc.rows.map((r) => r.name)).toEqual(["Ana", "Bruno", "Carlos"]);

    const desc = await listClients(a.client, { sort: "name", dir: "desc" });
    expect(desc.rows.map((r) => r.name)).toEqual(["Carlos", "Bruno", "Ana"]);
  });

  it("ordena por el nombre del tipo, que vive en otra tabla", async () => {
    const a = await makeTenant("ord-tipo");
    const types = await listClientTypes(a.client); // Mayorista, Minorista
    const mayorista = types.find((t) => t.name === "Mayorista")!;
    const minorista = types.find((t) => t.name === "Minorista")!;
    await createClientRow(a.client, a.tenantId, a.id, null, { kind: "person", name: "Zoe", typeId: minorista.id });
    await createClientRow(a.client, a.tenantId, a.id, null, { kind: "person", name: "Abel", typeId: mayorista.id });

    const asc = await listClients(a.client, { sort: "type", dir: "asc" });
    expect(asc.rows.map((r) => r.typeName)).toEqual(["Mayorista", "Minorista"]);
  });

  it("una clave fuera de la lista blanca cae al orden por defecto, no revienta", async () => {
    const a = await makeTenant("ord-malo");
    const types = await listClientTypes(a.client);
    for (const n of ["Beta", "Alfa"]) {
      await createClientRow(a.client, a.tenantId, a.id, null, { kind: "person", name: n, typeId: types[0].id });
    }

    const raro = await listClients(a.client, { sort: "doc_id); drop table clients; --", dir: "desc" });
    expect(raro.rows.map((r) => r.name)).toEqual(["Alfa", "Beta"]);
  });
});

describe("orden de listas — productos", () => {
  it("ordena por precio descendente y mantiene el total", async () => {
    const a = await makeTenant("ord-prod");
    const cats = await listCategories(a.client);
    for (const [name, price] of [["Barato", 1], ["Caro", 100], ["Medio", 50]] as [string, number][]) {
      await createProduct(a.client, a.tenantId, a.id, null, { kind: "good", name, price, unit: "unidad", minStock: 0, categoryId: cats[0]?.id ?? null });
    }

    const desc = await listProducts(a.client, { sort: "price", dir: "desc" });
    expect(desc.rows.map((r) => r.name)).toEqual(["Caro", "Medio", "Barato"]);
    expect(desc.total).toBe(3);

    const asc = await listProducts(a.client, { sort: "price", dir: "asc" });
    expect(asc.rows.map((r) => r.name)).toEqual(["Barato", "Medio", "Caro"]);
  });

  it("al ordenar por SKU los productos sin SKU quedan al final", async () => {
    const a = await makeTenant("ord-sku");
    const cats = await listCategories(a.client);
    await createProduct(a.client, a.tenantId, a.id, null, { kind: "good", name: "Sin código", price: 1, unit: "unidad", minStock: 0, categoryId: cats[0]?.id ?? null });
    await createProduct(a.client, a.tenantId, a.id, null, { kind: "good", name: "Con código", price: 1, sku: "AAA-1", unit: "unidad", minStock: 0, categoryId: cats[0]?.id ?? null });

    const asc = await listProducts(a.client, { sort: "sku", dir: "asc" });
    expect(asc.rows.map((r) => r.sku)).toEqual(["AAA-1", null]);
  });
});

describe("los vacíos van al final en los dos sentidos", () => {
  it("al ordenar por SKU descendente, el producto sin SKU sigue al final", async () => {
    const a = await makeTenant("ord-nulos");
    const cats = await listCategories(a.client);
    await createProduct(a.client, a.tenantId, a.id, null, { kind: "good", name: "Sin código", price: 1, unit: "unidad", minStock: 0, categoryId: cats[0]?.id ?? null });
    await createProduct(a.client, a.tenantId, a.id, null, { kind: "good", name: "A", price: 1, sku: "AAA-1", unit: "unidad", minStock: 0, categoryId: cats[0]?.id ?? null });
    await createProduct(a.client, a.tenantId, a.id, null, { kind: "good", name: "Z", price: 1, sku: "ZZZ-9", unit: "unidad", minStock: 0, categoryId: cats[0]?.id ?? null });

    const desc = await listProducts(a.client, { sort: "sku", dir: "desc" });
    expect(desc.rows.map((r) => r.sku)).toEqual(["ZZZ-9", "AAA-1", null]);
  });
});
