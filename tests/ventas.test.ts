import { describe, it, expect } from "vitest";
import { newUserClient } from "./setup";
import type { SaleSaveInput } from "@/lib/ventas/schema";
import { createDraft, emitSale, voidSale, deleteDraft } from "@/lib/ventas/mutations";
import { listSales, salesKpi, receivablesTotal, salesByClient } from "@/lib/ventas/queries";
import { todayISO } from "@/lib/tz";

const HOY = todayISO("UTC");

async function makeTenant(name: string) {
  const u = await newUserClient();
  const { data: tenantId } = await u.client.rpc("bootstrap_tenant", {
    p_name: name, p_slug: `${name}-${Date.now()}-${Math.random()}`, p_full_name: name,
  });
  return { ...u, tenantId: tenantId as string };
}
async function addMember(owner: Awaited<ReturnType<typeof makeTenant>>, role: string, branchId: string | null = null) {
  const u = await newUserClient();
  const { error } = await owner.client.from("memberships").insert({ user_id: u.id, tenant_id: owner.tenantId, role, branch_id: branchId });
  if (error) throw error;
  return u;
}
async function mainBranch(t: Awaited<ReturnType<typeof makeTenant>>) {
  const { data } = await t.client.from("branches").select("id").eq("tenant_id", t.tenantId).eq("is_main", true).single();
  return data!.id as string;
}
const sale = (branchId: string, over: Partial<SaleSaveInput> = {}): SaleSaveInput => ({
  clientId: null, branchId, globalDiscountPct: 0, notes: undefined,
  items: [{ productId: null, description: "Prod", quantity: 2, unitPrice: 10, discountPct: 0, taxRate: 16 }], ...over,
});

describe("ventas — flujo y correlativo", () => {
  it("crear borrador → emitir asigna correlativo consecutivo; contado deja saldo 0", async () => {
    const a = await makeTenant("flow");
    const b = await mainBranch(a);
    const id1 = await createDraft(a.client, a.tenantId, a.id, "USD", sale(b));
    const id2 = await createDraft(a.client, a.tenantId, a.id, "USD", sale(b));
    await emitSale(a.client, id1, { paymentType: "contado", paymentMethod: "efectivo" }, HOY);
    await emitSale(a.client, id2, { paymentType: "credito" }, HOY);

    const emitidas = await listSales(a.client, { status: "emitidas", today: HOY });
    const nums = emitidas.rows.map((r) => r.number).sort((x, y) => (x! - y!));
    expect(nums).toEqual([1, 2]);

    const s1 = emitidas.rows.find((r) => r.number === 1)!;
    expect(s1.total).toBe(23.2);       // 2*10 + 16%
    expect(s1.balance).toBe(0);        // contado
    const s2 = emitidas.rows.find((r) => r.number === 2)!;
    expect(s2.balance).toBe(23.2);     // crédito
  });

  it("KPIs y por-cobrar; anular saca la venta de los totales", async () => {
    const a = await makeTenant("kpi");
    const b = await mainBranch(a);
    const id = await createDraft(a.client, a.tenantId, a.id, "USD", sale(b, { items: [{ productId: null, description: "X", quantity: 1, unitPrice: 100, discountPct: 0, taxRate: 0 }] }));
    await emitSale(a.client, id, { paymentType: "credito" }, HOY);
    expect((await salesKpi(a.client, "UTC")).monthTotal).toBe(100);
    expect((await receivablesTotal(a.client)).total).toBe(100);
    await voidSale(a.client, id);
    expect((await salesKpi(a.client, "UTC")).monthTotal).toBe(0);
    expect((await receivablesTotal(a.client)).total).toBe(0);
  });

  it("borrar un borrador elimina sus ítems (cascade)", async () => {
    const a = await makeTenant("del");
    const b = await mainBranch(a);
    const id = await createDraft(a.client, a.tenantId, a.id, "USD", sale(b));
    await deleteDraft(a.client, id);
    const { count } = await a.client.from("sale_items").select("id", { count: "exact", head: true }).eq("sale_id", id);
    expect(count ?? 0).toBe(0);
  });

  it("estado de pago en la lista: dueDate/paymentStatus por fila y filtro «vencidas»", async () => {
    const a = await makeTenant("pago");
    const b = await mainBranch(a);
    const HOY_FIJO = "2026-10-09";
    const vencida = await createDraft(a.client, a.tenantId, a.id, "USD", sale(b));
    await emitSale(a.client, vencida, { paymentType: "credito", dueDate: "2026-10-01" }, HOY);
    const futura = await createDraft(a.client, a.tenantId, a.id, "USD", sale(b));
    await emitSale(a.client, futura, { paymentType: "credito", dueDate: "2026-11-15" }, HOY);
    const sinFecha = await createDraft(a.client, a.tenantId, a.id, "USD", sale(b));
    await emitSale(a.client, sinFecha, { paymentType: "credito" }, HOY);

    const vencidas = await listSales(a.client, { payment: "vencidas", today: HOY_FIJO });
    expect(vencidas.rows.map((r) => r.id)).toEqual([vencida]);
    expect(vencidas.rows[0].dueDate).toBe("2026-10-01");
    expect(vencidas.rows[0].paymentStatus).toBe("vencida");

    const conSaldo = await listSales(a.client, { payment: "pendientes", today: HOY_FIJO });
    expect(conSaldo.total).toBe(3);
    const porId = new Map(conSaldo.rows.map((r) => [r.id, r]));
    expect(porId.get(vencida)!.paymentStatus).toBe("vencida");
    expect(porId.get(futura)!.paymentStatus).toBe("pendiente");
    expect(porId.get(futura)!.dueDate).toBe("2026-11-15");
    expect(porId.get(sinFecha)!.paymentStatus).toBe("pendiente");
    expect(porId.get(sinFecha)!.dueDate).toBeNull();

    // un `today` inválido es un error de programación: falla en vez de pintar estados inventados
    await expect(listSales(a.client, { payment: "pendientes", today: "basura" })).rejects.toThrow(/Fecha local inválida/);
  });

  it("historial por cliente", async () => {
    const a = await makeTenant("hist");
    const b = await mainBranch(a);
    const { data: cli } = await a.client.from("clients").insert({ tenant_id: a.tenantId, kind: "person", name: "Ana" }).select("id").single();
    const id = await createDraft(a.client, a.tenantId, a.id, "USD", sale(b, { clientId: cli!.id }));
    await emitSale(a.client, id, { paymentType: "credito" }, HOY);
    const h = await salesByClient(a.client, cli!.id);
    expect(h.list).toHaveLength(1);
    expect(h.purchasedTotal).toBe(23.2);
    expect(h.receivable).toBe(23.2);
  });
});

describe("ventas — RLS", () => {
  it("un tenant no ve ventas de otro", async () => {
    const a = await makeTenant("aa"); const b = await makeTenant("bb");
    await createDraft(a.client, a.tenantId, a.id, "USD", sale(await mainBranch(a)));
    expect((await listSales(b.client, { status: "todas", today: HOY })).total).toBe(0);
  });

  it("scoping por sucursal: vendedor de otra sucursal no ve la venta; back-office sí", async () => {
    const a = await makeTenant("scope");
    const main = await mainBranch(a);
    const { data: otra } = await a.client.from("branches").insert({ tenant_id: a.tenantId, name: "Sur" }).select("id").single();
    // venta en sucursal principal (creada por el owner)
    await createDraft(a.client, a.tenantId, a.id, "USD", sale(main));
    const vendedorOtra = await addMember(a, "vendedor", otra!.id);
    const vendedorMain = await addMember(a, "vendedor", main);
    const admin = await addMember(a, "administrativo", null);
    expect((await listSales(vendedorOtra.client, { status: "todas", today: HOY })).total).toBe(0); // otra sucursal
    expect((await listSales(vendedorMain.client, { status: "todas", today: HOY })).total).toBe(1); // su sucursal
    expect((await listSales(admin.client, { status: "todas", today: HOY })).total).toBe(1);        // back-office ve todo
  });

  it("almacen no puede insertar ventas (RLS niega)", async () => {
    const a = await makeTenant("alm");
    const main = await mainBranch(a);
    const almacen = await addMember(a, "almacen", main);
    const { error } = await almacen.client.from("sales")
      .insert({ tenant_id: a.tenantId, branch_id: main, status: "draft", currency: "USD" });
    expect(error).not.toBeNull();
  });

  it("un vendedor no puede insertar una venta en otra sucursal (RLS de escritura scopeada)", async () => {
    const a = await makeTenant("wscope");
    const main = await mainBranch(a);
    const { data: otra } = await a.client.from("branches").insert({ tenant_id: a.tenantId, name: "Sur" }).select("id").single();
    const vendedor = await addMember(a, "vendedor", main);
    // en su propia sucursal: permitido
    const ok = await vendedor.client.from("sales")
      .insert({ tenant_id: a.tenantId, branch_id: main, status: "draft", currency: "USD" });
    expect(ok.error).toBeNull();
    // en otra sucursal: RLS niega
    const bad = await vendedor.client.from("sales")
      .insert({ tenant_id: a.tenantId, branch_id: otra!.id, status: "draft", currency: "USD" });
    expect(bad.error).not.toBeNull();
  });
});
