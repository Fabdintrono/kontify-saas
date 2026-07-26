import { describe, it, expect } from "vitest";
import { newUserClient } from "./setup";
import type { SaleSaveInput } from "@/lib/ventas/schema";
import { createDraft, emitSale, voidSale } from "@/lib/ventas/mutations";
import { registerAdjustment } from "@/lib/inventario/mutations";
import { listStock, stockKpi, inventoryStatusBreakdown } from "@/lib/inventario/queries";

async function makeTenant(name: string) {
  const u = await newUserClient();
  const { data: tenantId } = await u.client.rpc("bootstrap_tenant", {
    p_name: name, p_slug: `${name}-${Date.now()}-${Math.random()}`, p_full_name: name,
  });
  return { ...u, tenantId: tenantId as string };
}
async function mainBranch(t: Awaited<ReturnType<typeof makeTenant>>) {
  const { data } = await t.client.from("branches").select("id").eq("tenant_id", t.tenantId).eq("is_main", true).single();
  return data!.id as string;
}
async function makeProduct(t: any, over: Record<string, any> = {}) {
  const { data } = await t.client.from("products")
    .insert({ tenant_id: t.tenantId, kind: "good", name: "Café", price: 10, cost: 4, min_stock: 5, ...over })
    .select("id").single();
  return data!.id as string;
}
async function qtyOf(t: any, productId: string, branchId: string) {
  const { data } = await t.client.from("stock_levels").select("qty").eq("product_id", productId).eq("branch_id", branchId).maybeSingle();
  return data ? Number(data.qty) : 0;
}
const saleOf = (branchId: string, productId: string, quantity: number): SaleSaveInput => ({
  clientId: null, branchId, globalDiscountPct: 0, notes: undefined,
  items: [{ productId, description: "Café", quantity, unitPrice: 10, discountPct: 0, taxRate: 0 }],
});

describe("inventario — ajustes y trigger", () => {
  it("entrada suma, salida resta; permite negativo", async () => {
    const a = await makeTenant("adj"); const b = await mainBranch(a); const p = await makeProduct(a);
    await registerAdjustment(a.client, a.tenantId, a.id, { productId: p, branchId: b, direction: "in", quantity: 10 });
    expect(await qtyOf(a, p, b)).toBe(10);
    await registerAdjustment(a.client, a.tenantId, a.id, { productId: p, branchId: b, direction: "out", quantity: 3 });
    expect(await qtyOf(a, p, b)).toBe(7);
    await registerAdjustment(a.client, a.tenantId, a.id, { productId: p, branchId: b, direction: "out", quantity: 20 });
    expect(await qtyOf(a, p, b)).toBe(-13); // negativo permitido
  });
});

describe("inventario — integración con ventas", () => {
  it("emitir descuenta stock; anular lo repone", async () => {
    const a = await makeTenant("sale"); const b = await mainBranch(a); const p = await makeProduct(a);
    await registerAdjustment(a.client, a.tenantId, a.id, { productId: p, branchId: b, direction: "in", quantity: 10 });
    const id = await createDraft(a.client, a.tenantId, a.id, "USD", saleOf(b, p, 4));
    await emitSale(a.client, id, { paymentType: "contado", paymentMethod: "efectivo" });
    expect(await qtyOf(a, p, b)).toBe(6);
    await voidSale(a.client, id);
    expect(await qtyOf(a, p, b)).toBe(10); // repuesto
  });

  it("un ítem 'service' no genera movimiento", async () => {
    const a = await makeTenant("svc"); const b = await mainBranch(a);
    const svc = await makeProduct(a, { kind: "service", name: "Corte", min_stock: 0 });
    const id = await createDraft(a.client, a.tenantId, a.id, "USD", saleOf(b, svc, 2));
    await emitSale(a.client, id, { paymentType: "credito" });
    expect(await qtyOf(a, svc, b)).toBe(0); // sin stock_levels
  });
});

describe("inventario — queries", () => {
  it("listStock clasifica estados y stockKpi valoriza", async () => {
    const a = await makeTenant("q"); const b = await mainBranch(a);
    const p1 = await makeProduct(a, { name: "Café", cost: 4, min_stock: 5 });
    const p2 = await makeProduct(a, { name: "Té", cost: 2, min_stock: 5 });
    await registerAdjustment(a.client, a.tenantId, a.id, { productId: p1, branchId: b, direction: "in", quantity: 10 }); // en stock
    await registerAdjustment(a.client, a.tenantId, a.id, { productId: p2, branchId: b, direction: "in", quantity: 3 });  // bajo

    const rows = await listStock(a.client, {});
    expect(rows.find((r) => r.productId === p1)?.status).toBe("en_stock");
    expect(rows.find((r) => r.productId === p2)?.status).toBe("bajo");
    expect((await listStock(a.client, { status: "bajo" })).map((r) => r.productId)).toEqual([p2]);

    const kpi = await stockKpi(a.client);
    expect(kpi.value).toBe(46); // 10*4 + 3*2
    expect(kpi.lowCount).toBe(1);
    const bd = await inventoryStatusBreakdown(a.client);
    expect(bd).toMatchObject({ inStock: 1, low: 1, out: 0 });
  });

  it("scoping por sucursal: operativo de otra sucursal no ve el stock", async () => {
    const a = await makeTenant("scope"); const main = await mainBranch(a);
    const { data: otra } = await a.client.from("branches").insert({ tenant_id: a.tenantId, name: "Sur" }).select("id").single();
    const p = await makeProduct(a);
    await registerAdjustment(a.client, a.tenantId, a.id, { productId: p, branchId: main, direction: "in", quantity: 8 });

    const u = await newUserClient();
    await a.client.from("memberships").insert({ user_id: u.id, tenant_id: a.tenantId, role: "vendedor", branch_id: otra!.id });
    const { data } = await u.client.from("stock_levels").select("qty").eq("product_id", p);
    expect(data).toHaveLength(0); // RLS: solo su sucursal (otra), donde no hay stock
  });
});
