import { describe, it, expect } from "vitest";
import { newUserClient } from "./setup";
import type { SaleSaveInput } from "@/lib/ventas/schema";
import { createDraft, emitSale, voidSale } from "@/lib/ventas/mutations";
import { salesReport } from "@/lib/reportes/queries";

const WIDE = { from: "2000-01-01", to: "2100-01-01" };

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
    .insert({ tenant_id: t.tenantId, kind: "good", name: "Café", price: 10, cost: 4, ...over }).select("id").single();
  return data!.id as string;
}
const saleOf = (branchId: string, items: SaleSaveInput["items"], clientId: string | null = null): SaleSaveInput =>
  ({ clientId, branchId, globalDiscountPct: 0, notes: undefined, items });

describe("reportes — snapshot de costo", () => {
  it("createDraft guarda unit_cost del producto; línea libre queda null", async () => {
    const a = await makeTenant("cost"); const b = await mainBranch(a); const p = await makeProduct(a);
    const id = await createDraft(a.client, a.tenantId, a.id, "USD", saleOf(b, [
      { productId: p, description: "Café", quantity: 2, unitPrice: 10, discountPct: 0, taxRate: 16 },
      { productId: null, description: "Envío", quantity: 1, unitPrice: 5, discountPct: 0, taxRate: 0 },
    ]));
    const { data } = await a.client.from("sale_items").select("product_id, unit_cost").eq("sale_id", id);
    const conProd = data!.find((r: any) => r.product_id === p);
    const libre = data!.find((r: any) => r.product_id === null);
    expect(Number(conProd!.unit_cost)).toBe(4);
    expect(libre!.unit_cost).toBeNull();
  });
});

describe("reportes — salesReport", () => {
  it("resumen: revenue, utility, avgTicket, count; anulada no cuenta", async () => {
    const a = await makeTenant("rep"); const b = await mainBranch(a); const p = await makeProduct(a);
    const id = await createDraft(a.client, a.tenantId, a.id, "USD", saleOf(b, [
      { productId: p, description: "Café", quantity: 2, unitPrice: 10, discountPct: 0, taxRate: 16 },
    ]));
    await emitSale(a.client, id, { paymentType: "contado", paymentMethod: "efectivo" });
    // total 23.2 (2*10 +16%), neto 20, costo 8 → utilidad 12
    let r = await salesReport(a.client, WIDE);
    expect(r.summary.count).toBe(1);
    expect(r.summary.revenue).toBe(23.2);
    expect(r.summary.utility).toBe(12);
    expect(r.summary.avgTicket).toBe(23.2);
    expect(r.summary.marginPct).toBe(60);
    expect(r.summary.costIncompleteCount).toBe(0);

    const id2 = await createDraft(a.client, a.tenantId, a.id, "USD", saleOf(b, [
      { productId: p, description: "Café", quantity: 1, unitPrice: 10, discountPct: 0, taxRate: 0 },
    ]));
    await emitSale(a.client, id2, { paymentType: "credito" });
    await voidSale(a.client, id2);
    r = await salesReport(a.client, WIDE);
    expect(r.summary.count).toBe(1); // la anulada no cuenta
  });

  it("costo incompleto cuando una línea no tiene costo", async () => {
    const a = await makeTenant("inc"); const b = await mainBranch(a);
    const id = await createDraft(a.client, a.tenantId, a.id, "USD", saleOf(b, [
      { productId: null, description: "Servicio", quantity: 1, unitPrice: 50, discountPct: 0, taxRate: 0 },
    ]));
    await emitSale(a.client, id, { paymentType: "credito" });
    const r = await salesReport(a.client, WIDE);
    expect(r.summary.costIncompleteCount).toBe(1);
  });

  it("desgloses byProduct / bySeller / byClient", async () => {
    const a = await makeTenant("bd"); const b = await mainBranch(a); const p = await makeProduct(a);
    const { data: cli } = await a.client.from("clients").insert({ tenant_id: a.tenantId, kind: "person", name: "Ana" }).select("id").single();
    const id = await createDraft(a.client, a.tenantId, a.id, "USD", saleOf(b, [
      { productId: p, description: "Café", quantity: 3, unitPrice: 10, discountPct: 0, taxRate: 0 },
    ], cli!.id));
    await emitSale(a.client, id, { paymentType: "credito" });
    const r = await salesReport(a.client, WIDE);
    expect(r.byProduct[0]).toMatchObject({ productId: p, qty: 3, revenue: 30 });
    expect(r.bySeller[0]).toMatchObject({ userId: a.id, count: 1, revenue: 30 });
    expect(r.bySeller[0].name).toBe("bd"); // full_name del owner (bootstrap)
    expect(r.byClient[0]).toMatchObject({ clientId: cli!.id, name: "Ana", count: 1, revenue: 30 });
    expect(r.byDay).toHaveLength(1);
  });

  it("rango excluye ventas fuera de [from,to]", async () => {
    const a = await makeTenant("rg"); const b = await mainBranch(a); const p = await makeProduct(a);
    const id = await createDraft(a.client, a.tenantId, a.id, "USD", saleOf(b, [
      { productId: p, description: "Café", quantity: 1, unitPrice: 10, discountPct: 0, taxRate: 0 },
    ]));
    await emitSale(a.client, id, { paymentType: "credito" });
    const r = await salesReport(a.client, { from: "2000-01-01", to: "2000-01-02" });
    expect(r.summary.count).toBe(0);
  });
});
