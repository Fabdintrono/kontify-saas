import { describe, it, expect } from "vitest";
import { newUserClient } from "./setup";
import { createProduct, archiveProduct, createTaxRate, updateTaxRate } from "@/lib/productos/mutations";
import type { ProductInput } from "@/lib/productos/schema";
import { listProducts, listCategories, listTaxRates, productsKpi, productsByCategory } from "@/lib/productos/queries";

async function makeTenant(name: string) {
  const u = await newUserClient();
  const { data: tenantId } = await u.client.rpc("bootstrap_tenant", {
    p_name: name, p_slug: `${name}-${Date.now()}-${Math.random()}`, p_full_name: name,
  });
  return { ...u, tenantId: tenantId as string };
}

async function addMember(owner: Awaited<ReturnType<typeof makeTenant>>, role: string) {
  const u = await newUserClient();
  const { error } = await owner.client.from("memberships")
    .insert({ user_id: u.id, tenant_id: owner.tenantId, role });
  if (error) throw error;
  return u;
}

const base = (over: Partial<ProductInput> = {}): ProductInput =>
  ({ kind: "good", name: "Producto", unit: "unidad", price: 10, sku: undefined,
     description: undefined, categoryId: null, cost: undefined, taxRateId: null, minStock: 0, ...over });

describe("productos — seed y CRUD", () => {
  it("un tenant nuevo trae categoría General y tasas IVA 16% (default) + Exento 0%", async () => {
    const a = await makeTenant("seed");
    const cats = await listCategories(a.client);
    expect(cats.map((c) => c.name)).toEqual(["General"]);
    const taxes = await listTaxRates(a.client);
    expect(taxes.map((t) => t.name).sort()).toEqual(["Exento 0%", "IVA 16%"]);
    expect(taxes.find((t) => t.isDefault)?.name).toBe("IVA 16%");
  });

  it("crear, listar, archivar y contar", async () => {
    const a = await makeTenant("crud");
    const cats = await listCategories(a.client);
    const id = await createProduct(a.client, a.tenantId, a.id, null, base({ name: "Café", categoryId: cats[0].id, price: 12.5 }));
    expect(id).toBeTruthy();

    const activos = await listProducts(a.client, { status: "activos" });
    expect(activos.total).toBe(1);
    expect(activos.rows[0].categoryName).toBe("General");
    expect(activos.rows[0].price).toBe(12.5);

    expect((await productsKpi(a.client)).total).toBe(1);
    const byCat = await productsByCategory(a.client);
    expect(byCat.find((c) => c.categoryId === cats[0].id)?.count).toBe(1);

    await archiveProduct(a.client, id, false);
    expect((await listProducts(a.client, { status: "activos" })).total).toBe(0);
    expect((await listProducts(a.client, { status: "archivados" })).total).toBe(1);
  });

  it("búsqueda por nombre y SKU único por tenant", async () => {
    const a = await makeTenant("srch");
    await createProduct(a.client, a.tenantId, a.id, null, base({ name: "Filtro de aceite", sku: "F-100" }));
    await createProduct(a.client, a.tenantId, a.id, null, base({ name: "Bujía", sku: "B-200" }));
    const r = await listProducts(a.client, { search: "filtro" });
    expect(r.total).toBe(1);
    expect(r.rows[0].name).toBe("Filtro de aceite");

    // SKU duplicado en el mismo tenant → rechazado por índice único parcial
    await expect(createProduct(a.client, a.tenantId, a.id, null, base({ name: "Otro", sku: "F-100" }))).rejects.toBeTruthy();
  });

  it("marcar otra tasa como default desmarca la anterior", async () => {
    const a = await makeTenant("tax");
    await createTaxRate(a.client, a.tenantId, { name: "IVA reducido", rate: 8, isDefault: true });
    const taxes = await listTaxRates(a.client);
    const defaults = taxes.filter((t) => t.isDefault);
    expect(defaults).toHaveLength(1);
    expect(defaults[0].name).toBe("IVA reducido");
  });
});

describe("productos — RLS", () => {
  it("un tenant no ve productos de otro", async () => {
    const a = await makeTenant("aa");
    const b = await makeTenant("bb");
    await createProduct(a.client, a.tenantId, a.id, null, base({ name: "Producto A" }));
    const fromB = await listProducts(b.client, { status: "todos" });
    expect(fromB.total).toBe(0);
  });

  it("cajero y vendedor pueden LEER el catálogo pero no insertar", async () => {
    const a = await makeTenant("cc");
    await createProduct(a.client, a.tenantId, a.id, null, base({ name: "Visible" }));
    for (const role of ["cajero", "vendedor"]) {
      const m = await addMember(a, role);
      const { data: rows } = await m.client.from("products").select("*");
      expect(rows).toHaveLength(1); // RLS SELECT permite leer
      const { error } = await m.client.from("products")
        .insert({ tenant_id: a.tenantId, kind: "good", name: "X", price: 1 });
      expect(error).not.toBeNull(); // RLS INSERT niega
    }
  });

  it("almacen puede crear productos pero no renombrar una categoría", async () => {
    const a = await makeTenant("dd");
    const almacen = await addMember(a, "almacen");
    const cats = await listCategories(almacen.client);
    const pid = await createProduct(almacen.client, a.tenantId, almacen.id, null, base({ name: "Alm-prod", categoryId: cats[0].id }));
    expect(pid).toBeTruthy();

    const original = cats[0].name;
    await almacen.client.from("product_categories").update({ name: "Hackeado" }).eq("id", cats[0].id);
    const after = await listCategories(a.client);
    expect(after.find((c) => c.id === cats[0].id)?.name).toBe(original); // RLS impidió el cambio
  });
});
