import { describe, it, expect } from "vitest";
import { newUserClient } from "./setup";
import { importarProductos, importarClientes, importarGastos } from "@/lib/import/commit";
import { listProducts, listCategories } from "@/lib/productos/queries";
import { listClients, listClientTypes } from "@/lib/clientes/queries";
import { listExpenses, listExpenseCategories } from "@/lib/gastos/queries";
import type { FilaRevisada } from "@/lib/import/analyze";

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

const fila = (linea: number, valores: Record<string, unknown>): FilaRevisada =>
  ({ linea, valores: valores as never, errores: [] });

describe("importar productos", () => {
  it("guarda las filas y las deja listas en el catálogo", async () => {
    const a = await makeTenant("imp-prod");
    const r = await importarProductos(a.client, a.tenantId, a.id, null, [
      fila(2, { name: "Agua mineral 1.5L", sku: "AGU-15", price: 2.5, cost: 1.1, unit: "unidad", minStock: 10 }),
      fila(3, { name: "Café molido", price: 8, unit: "bolsa" }),
    ]);
    expect(r.insertados).toBe(2);
    expect(r.rechazadas).toEqual([]);

    const { rows } = await listProducts(a.client, { sort: "name", dir: "asc" });
    expect(rows.map((p) => p.name)).toEqual(["Agua mineral 1.5L", "Café molido"]);
    expect(rows[0].sku).toBe("AGU-15");
    expect(rows[0].price).toBe(2.5);
  });

  it("crea la categoría que no existe y reutiliza la que sí", async () => {
    const a = await makeTenant("imp-cat");
    const antes = await listCategories(a.client, { includeInactive: true });
    const existente = antes[0]?.name ?? "General";

    const r = await importarProductos(a.client, a.tenantId, a.id, null, [
      fila(2, { name: "Uno", price: 1, category: "Ferretería" }),
      fila(3, { name: "Dos", price: 1, category: "ferreteria" }),   // la misma, escrita distinto
      fila(4, { name: "Tres", price: 1, category: existente }),
    ]);
    expect(r.insertados).toBe(3);
    expect(r.creadas).toEqual(["Ferretería"]);

    const { rows } = await listProducts(a.client, { sort: "name", dir: "asc" });
    const porNombre = Object.fromEntries(rows.map((p) => [p.name, p.categoryName]));
    expect(porNombre["Uno"]).toBe("Ferretería");
    expect(porNombre["Dos"]).toBe("Ferretería");
    expect(porNombre["Tres"]).toBe(existente);
  });

  it("un bien sin tipo entra como bien y respeta el valor cuando viene", async () => {
    const a = await makeTenant("imp-tipo");
    await importarProductos(a.client, a.tenantId, a.id, null, [
      fila(2, { name: "Sin tipo", price: 1 }),
      fila(3, { name: "Un servicio", price: 1, kind: "service" }),
    ]);
    const { rows } = await listProducts(a.client, { sort: "name", dir: "asc" });
    expect(rows.find((p) => p.name === "Sin tipo")!.kind).toBe("good");
    expect(rows.find((p) => p.name === "Un servicio")!.kind).toBe("service");
  });

  it("una fila que la base rechaza no tumba al resto, y se dice cuál fue", async () => {
    const a = await makeTenant("imp-malo");
    const r = await importarProductos(a.client, a.tenantId, a.id, null, [
      fila(2, { name: "Buena", price: 1 }),
      fila(3, { name: "Rota", price: 1, kind: "inventado" }),   // el enum de la base no lo admite
      fila(4, { name: "Otra buena", price: 1 }),
    ]);
    expect(r.insertados).toBe(2);
    expect(r.rechazadas.map((x) => x.linea)).toEqual([3]);

    const { rows } = await listProducts(a.client);
    expect(rows.map((p) => p.name).sort()).toEqual(["Buena", "Otra buena"]);
  });

  it("importa un lote grande de una vez", async () => {
    const a = await makeTenant("imp-lote");
    const filas = Array.from({ length: 250 }, (_, i) =>
      fila(i + 2, { name: `Producto ${i}`, sku: `SKU-${i}`, price: i + 1 }));
    const r = await importarProductos(a.client, a.tenantId, a.id, null, filas);
    expect(r.insertados).toBe(250);

    const { total } = await listProducts(a.client);
    expect(total).toBe(250);
  });
});

describe("importar clientes", () => {
  it("guarda la cartera con su tipo", async () => {
    const a = await makeTenant("imp-cli");
    const r = await importarClientes(a.client, a.tenantId, a.id, null, [
      fila(2, { name: "Farmacia Central C.A.", kind: "company", docId: "J-123", phone: "0212", type: "Mayorista" }),
      fila(3, { name: "Juan Pérez", docId: "V-456" }),
    ]);
    expect(r.insertados).toBe(2);
    // «Mayorista» ya viene sembrado en un tenant nuevo: no debe duplicarse.
    expect(r.creadas).toEqual([]);

    const { rows } = await listClients(a.client, { sort: "name", dir: "asc" });
    expect(rows.map((c) => c.name)).toEqual(["Farmacia Central C.A.", "Juan Pérez"]);
    expect(rows[0].typeName).toBe("Mayorista");
    expect(rows[1].kind).toBe("person");   // sin tipo de registro, entra como persona
  });

  it("crea el tipo de cliente que no existía", async () => {
    const a = await makeTenant("imp-cli-tipo");
    const r = await importarClientes(a.client, a.tenantId, a.id, null, [
      fila(2, { name: "Cliente VIP", type: "Preferencial" }),
    ]);
    expect(r.creadas).toEqual(["Preferencial"]);
    const tipos = await listClientTypes(a.client, { includeInactive: true });
    expect(tipos.map((t) => t.name)).toContain("Preferencial");
  });

  it("lo importado por un tenant no se ve desde otro", async () => {
    const a = await makeTenant("imp-aisl-a");
    const b = await makeTenant("imp-aisl-b");
    await importarClientes(a.client, a.tenantId, a.id, null, [fila(2, { name: "Solo de A" })]);

    const desdeB = await listClients(b.client);
    expect(desdeB.rows.map((c) => c.name)).not.toContain("Solo de A");
  });

  it("un tenant no puede escribir en el tenant de otro", async () => {
    const a = await makeTenant("imp-rls-a");
    const b = await makeTenant("imp-rls-b");
    // B intenta insertar poniendo el tenant de A: las políticas lo deben frenar.
    const r = await importarClientes(b.client, a.tenantId, b.id, null, [fila(2, { name: "Intruso" })]);
    expect(r.insertados).toBe(0);
    expect(r.rechazadas.length).toBe(1);

    const enA = await listClients(a.client);
    expect(enA.rows.map((c) => c.name)).not.toContain("Intruso");
  });
});

describe("importar gastos", () => {
  it("guarda los gastos con su categoría y en la moneda del negocio", async () => {
    const a = await makeTenant("imp-gas");
    const r = await importarGastos(a.client, a.tenantId, a.id, null, [
      fila(2, { spentOn: "2026-10-05", description: "Alquiler del local", amount: 300, category: "Alquiler", supplier: "Inversiones López" }),
      fila(3, { spentOn: "2026-10-07", description: "Luz y agua", amount: 65.5, category: "Servicios" }),
    ]);
    expect(r.insertados).toBe(2);
    expect(r.rechazadas).toEqual([]);
    // Alquiler y Servicios vienen sembradas en un tenant nuevo: no debe crear nada.
    expect(r.creadas).toEqual([]);

    const { rows, suma } = await listExpenses(a.client, { sort: "date", dir: "asc" });
    expect(rows.map((e) => e.description)).toEqual(["Alquiler del local", "Luz y agua"]);
    expect(rows[0].categoryName).toBe("Alquiler");
    expect(rows[0].supplier).toBe("Inversiones López");
    expect(suma).toBe(365.5);
  });

  it("crea la categoría de gasto que no existía", async () => {
    const a = await makeTenant("imp-gas-cat");
    const r = await importarGastos(a.client, a.tenantId, a.id, null, [
      fila(2, { spentOn: "2026-10-05", description: "Anuncio en radio", amount: 50, category: "Publicidad" }),
    ]);
    expect(r.creadas).toEqual(["Publicidad"]);
    const cats = await listExpenseCategories(a.client, { includeInactive: true });
    expect(cats.map((c) => c.name)).toContain("Publicidad");
  });

  it("lo importado cuenta de inmediato en el total del mes", async () => {
    const a = await makeTenant("imp-gas-kpi");
    await importarGastos(a.client, a.tenantId, a.id, null, [
      fila(2, { spentOn: "2026-10-05", description: "Uno", amount: 100 }),
      fila(3, { spentOn: "2026-10-06", description: "Dos", amount: 50 }),
    ]);
    const { suma } = await listExpenses(a.client, { range: { from: "2026-10-01", to: "2026-10-31" } });
    expect(suma).toBe(150);
  });

  it("un vendedor no puede importar gastos", async () => {
    const a = await makeTenant("imp-gas-rls");
    const vendedor = await addMember(a, "vendedor");
    const r = await importarGastos(vendedor.client, a.tenantId, vendedor.id, null, [
      fila(2, { spentOn: "2026-10-05", description: "Intento", amount: 10 }),
    ]);
    expect(r.insertados).toBe(0);
    expect(r.rechazadas.length).toBe(1);
  });

  it("los gastos de un negocio no se ven desde otro", async () => {
    const a = await makeTenant("imp-gas-a");
    const b = await makeTenant("imp-gas-b");
    await importarGastos(a.client, a.tenantId, a.id, null, [
      fila(2, { spentOn: "2026-10-05", description: "Solo de A", amount: 10 }),
    ]);
    expect((await listExpenses(b.client)).total).toBe(0);
  });
});
