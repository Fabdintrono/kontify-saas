import { describe, it, expect } from "vitest";
import { newUserClient } from "./setup";
import * as m from "@/lib/gastos/mutations";
import {
  listExpenses, listExpenseCategories, listRecurring, getRecurring,
  expensesKpi, upcomingRecurring, expensesByCategory,
} from "@/lib/gastos/queries";

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

const gasto = (over: Partial<Parameters<typeof m.createExpense>[5]> = {}) => ({
  description: "Alquiler del local", amount: 300, spentOn: "2026-10-05",
  categoryId: null, paymentMethod: "Transferencia", supplier: undefined, notes: undefined,
  ...over,
} as Parameters<typeof m.createExpense>[5]);

describe("gastos — catálogo y alta", () => {
  it("un tenant nuevo nace con categorías de gasto, no con una lista vacía", async () => {
    const a = await makeTenant("gas-seed");
    const cats = await listExpenseCategories(a.client);
    expect(cats.map((c) => c.name)).toContain("Alquiler");
    expect(cats.map((c) => c.name)).toContain("Nómina");
    expect(cats.length).toBe(8);
  });

  it("crear, listar y sumar", async () => {
    const a = await makeTenant("gas-crud");
    const cats = await listExpenseCategories(a.client);
    await m.createExpense(a.client, a.tenantId, a.id, null, "USD", gasto({ categoryId: cats[0].id }));
    await m.createExpense(a.client, a.tenantId, a.id, null, "USD", gasto({ description: "Internet", amount: 45.5 }));

    const r = await listExpenses(a.client);
    expect(r.total).toBe(2);
    expect(r.suma).toBe(345.5);
    expect(r.rows[0].description).toBeTruthy();
  });

  it("la suma es del filtro entero, no de la página que se ve", async () => {
    const a = await makeTenant("gas-suma");
    for (let i = 0; i < 25; i++) {
      await m.createExpense(a.client, a.tenantId, a.id, null, "USD", gasto({ description: `Gasto ${i}`, amount: 10 }));
    }
    const r = await listExpenses(a.client, { pageSize: 20 });
    expect(r.rows.length).toBe(20);
    expect(r.total).toBe(25);
    expect(r.suma).toBe(250);
  });

  it("filtra por rango de fechas", async () => {
    const a = await makeTenant("gas-rango");
    await m.createExpense(a.client, a.tenantId, a.id, null, "USD", gasto({ spentOn: "2026-09-20", amount: 100 }));
    await m.createExpense(a.client, a.tenantId, a.id, null, "USD", gasto({ spentOn: "2026-10-05", amount: 200 }));

    const oct = await listExpenses(a.client, { range: { from: "2026-10-01", to: "2026-10-31" } });
    expect(oct.total).toBe(1);
    expect(oct.suma).toBe(200);
  });

  it("ordena por monto de mayor a menor", async () => {
    const a = await makeTenant("gas-orden");
    for (const [d, amt] of [["Chico", 10], ["Grande", 500], ["Medio", 80]] as [string, number][]) {
      await m.createExpense(a.client, a.tenantId, a.id, null, "USD", gasto({ description: d, amount: amt }));
    }
    const r = await listExpenses(a.client, { sort: "amount", dir: "desc" });
    expect(r.rows.map((x) => x.description)).toEqual(["Grande", "Medio", "Chico"]);
  });

  it("reparte por categoría de mayor a menor", async () => {
    const a = await makeTenant("gas-cat");
    const cats = await listExpenseCategories(a.client);
    const alquiler = cats.find((c) => c.name === "Alquiler")!;
    const transporte = cats.find((c) => c.name === "Transporte")!;
    await m.createExpense(a.client, a.tenantId, a.id, null, "USD", gasto({ categoryId: alquiler.id, amount: 300 }));
    await m.createExpense(a.client, a.tenantId, a.id, null, "USD", gasto({ categoryId: transporte.id, amount: 50 }));
    await m.createExpense(a.client, a.tenantId, a.id, null, "USD", gasto({ categoryId: null, amount: 20 }));

    const rep = await expensesByCategory(a.client, { from: "2026-10-01", to: "2026-10-31" });
    expect(rep.map((x) => [x.name, x.total])).toEqual([["Alquiler", 300], ["Transporte", 50], ["Sin categoría", 20]]);
  });

  it("editar y borrar", async () => {
    const a = await makeTenant("gas-edit");
    const id = await m.createExpense(a.client, a.tenantId, a.id, null, "USD", gasto());
    await m.updateExpense(a.client, id, "USD", gasto({ description: "Alquiler corregido", amount: 350 }));
    let r = await listExpenses(a.client);
    expect(r.rows[0].description).toBe("Alquiler corregido");
    expect(r.rows[0].amount).toBe(350);

    await m.deleteExpense(a.client, id);
    r = await listExpenses(a.client);
    expect(r.total).toBe(0);
  });
});

describe("gastos fijos", () => {
  const fijo = (over = {}) => ({
    description: "Alquiler", amount: 300, frequency: "mensual" as const,
    nextDue: "2026-10-31", categoryId: null, ...over,
  });

  it("crear un fijo guarda el día de ancla", async () => {
    const a = await makeTenant("fij-crear");
    const id = await m.createRecurring(a.client, a.tenantId, a.id, "USD", fijo());
    const r = await getRecurring(a.client, id);
    expect(r!.anchorDay).toBe(31);
    expect(r!.nextDue).toBe("2026-10-31");
  });

  it("registrar el pago crea el gasto y mueve la fecha", async () => {
    const a = await makeTenant("fij-pago");
    const id = await m.createRecurring(a.client, a.tenantId, a.id, "USD", fijo({ nextDue: "2026-10-05" }));
    const f = (await getRecurring(a.client, id))!;

    const r = await m.pagarRecurring(a.client, a.tenantId, a.id, null, f, { spentOn: "2026-10-05", paymentMethod: "Efectivo" });
    expect(r.proximaFecha).toBe("2026-11-05");

    const gastos = await listExpenses(a.client);
    expect(gastos.total).toBe(1);
    expect(gastos.rows[0].amount).toBe(300);
    expect(gastos.rows[0].fromRecurring).toBe(true);

    expect((await getRecurring(a.client, id))!.nextDue).toBe("2026-11-05");
  });

  it("el gasto fijo del 31 pasa por febrero y vuelve al 31", async () => {
    const a = await makeTenant("fij-ancla");
    const id = await m.createRecurring(a.client, a.tenantId, a.id, "USD", fijo({ nextDue: "2026-01-31" }));

    let f = (await getRecurring(a.client, id))!;
    await m.pagarRecurring(a.client, a.tenantId, a.id, null, f, { spentOn: "2026-01-31" });
    expect((await getRecurring(a.client, id))!.nextDue).toBe("2026-02-28");

    f = (await getRecurring(a.client, id))!;
    await m.pagarRecurring(a.client, a.tenantId, a.id, null, f, { spentOn: "2026-02-28" });
    expect((await getRecurring(a.client, id))!.nextDue).toBe("2026-03-31");
  });

  it("lo que vence pronto llena la tarjeta «por pagar»", async () => {
    const a = await makeTenant("fij-pronto");
    await m.createRecurring(a.client, a.tenantId, a.id, "USD", fijo({ description: "Vencido", nextDue: "2026-10-01", amount: 100 }));
    await m.createRecurring(a.client, a.tenantId, a.id, "USD", fijo({ description: "Esta semana", nextDue: "2026-10-12", amount: 50 }));
    await m.createRecurring(a.client, a.tenantId, a.id, "USD", fijo({ description: "Lejano", nextDue: "2026-12-01", amount: 999 }));

    const r = await upcomingRecurring(a.client, "2026-10-10", 7);
    expect(r.filas.map((f) => f.description)).toEqual(["Vencido", "Esta semana"]);
    expect(r.total).toBe(150);
    expect(r.vencidos).toBe(1);
  });

  it("un fijo desactivado deja de aparecer y de contar", async () => {
    const a = await makeTenant("fij-off");
    const id = await m.createRecurring(a.client, a.tenantId, a.id, "USD", fijo({ nextDue: "2026-10-01" }));
    await m.setRecurringActive(a.client, id, false);

    expect((await listRecurring(a.client)).length).toBe(0);
    expect((await listRecurring(a.client, { includeInactive: true })).length).toBe(1);
    expect((await upcomingRecurring(a.client, "2026-10-10")).total).toBe(0);
  });
});

describe("gastos — quién puede verlos", () => {
  it("un vendedor no ve ningún gasto del negocio", async () => {
    const a = await makeTenant("gas-rls");
    await m.createExpense(a.client, a.tenantId, a.id, null, "USD", gasto({ description: "Secreto" }));
    const vendedor = await addMember(a, "vendedor");

    const r = await listExpenses(vendedor.client);
    expect(r.total).toBe(0);
    expect(r.rows).toEqual([]);
  });

  it("un vendedor tampoco puede cargar un gasto", async () => {
    const a = await makeTenant("gas-rls-w");
    const vendedor = await addMember(a, "vendedor");
    await expect(
      m.createExpense(vendedor.client, a.tenantId, vendedor.id, null, "USD", gasto()),
    ).rejects.toBeTruthy();
  });

  it("un administrativo sí los lleva", async () => {
    const a = await makeTenant("gas-rls-adm");
    const adm = await addMember(a, "administrativo");
    await m.createExpense(adm.client, a.tenantId, adm.id, null, "USD", gasto({ description: "Papelería" }));
    expect((await listExpenses(adm.client)).total).toBe(1);
  });

  it("los gastos de un negocio no se ven desde otro", async () => {
    const a = await makeTenant("gas-aisl-a");
    const b = await makeTenant("gas-aisl-b");
    await m.createExpense(a.client, a.tenantId, a.id, null, "USD", gasto({ description: "Solo de A" }));
    expect((await listExpenses(b.client)).total).toBe(0);
  });
});

describe("expensesKpi", () => {
  it("devuelve ceros, sin romper, para quien no puede ver gastos", async () => {
    const a = await makeTenant("gas-kpi");
    const vendedor = await addMember(a, "vendedor");
    const k = await expensesKpi(vendedor.client, "America/Caracas");
    expect(k).toEqual({ mes: 0, tramoAnterior: 0 });
  });
});
