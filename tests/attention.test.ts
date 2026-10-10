import { describe, it, expect } from "vitest";
import { newUserClient } from "./setup";
import type { SaleSaveInput } from "@/lib/ventas/schema";
import { createDraft, emitSale } from "@/lib/ventas/mutations";
import { registerAdjustment } from "@/lib/inventario/mutations";
import { attentionItems } from "@/lib/dashboard/attention";

const HOY = "2026-10-09";

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
const saleOf = (branchId: string, items: SaleSaveInput["items"], clientId: string | null = null): SaleSaveInput =>
  ({ clientId, branchId, globalDiscountPct: 0, notes: undefined, items });

describe("attentionItems", () => {
  it("sin datos → lista vacía", async () => {
    const a = await makeTenant("att0");
    expect(await attentionItems(a.client, HOY)).toEqual([]);
  });

  it("venta vencida, producto agotado y producto bajo mínimo, en ese orden, con enlace", async () => {
    const a = await makeTenant("att"); const b = await mainBranch(a);
    const { data: cli } = await a.client.from("clients").insert({ tenant_id: a.tenantId, kind: "company", name: "El Sol" }).select("id").single();
    const { data: p1 } = await a.client.from("products").insert({ tenant_id: a.tenantId, kind: "good", name: "Cloro", price: 2, min_stock: 10 }).select("id").single();
    const { data: p2 } = await a.client.from("products").insert({ tenant_id: a.tenantId, kind: "good", name: "Refresco", price: 2, min_stock: 12 }).select("id").single();
    await registerAdjustment(a.client, a.tenantId, a.id, { productId: p2!.id, branchId: b, direction: "in", quantity: 5, reason: "inicial" });
    // Cloro: sin existencias (agotado). Refresco: 5 ≤ mín 12 (bajo).
    const id = await createDraft(a.client, a.tenantId, a.id, "USD", saleOf(b, [
      { productId: p1!.id, description: "Cloro", quantity: 1, unitPrice: 10, discountPct: 0, taxRate: 0 },
    ], cli!.id));
    await emitSale(a.client, id, { paymentType: "credito", dueDate: "2026-10-01" }, HOY);

    const items = await attentionItems(a.client, HOY);
    expect(items.map((i) => i.kind)).toEqual(["vencida", "agotado", "bajo"]);
    expect(items[0]).toMatchObject({ tone: "danger", href: `/operaciones/facturacion/${id}` });
    expect(items[0].title).toMatch(/Venta #1 vencida/);
    expect(items[0].detail).toMatch(/El Sol/);
    expect(items[1]).toMatchObject({ tone: "danger", title: "Cloro agotado", href: "/operaciones/inventario?status=agotado" });
    expect(items[2]).toMatchObject({ tone: "warn", title: "Refresco con stock bajo" });
    expect(items[2].detail).toMatch(/5 .* 12/);
    expect(items[2].href).toBe("/operaciones/inventario?status=bajo");
  });

  // Cupo por categoría: las vencidas no pueden tapar el inventario (5 + lo que quepa hasta 8).
  it("corta en 5 vencidas (las más antiguas) y deja hueco para el inventario", async () => {
    const a = await makeTenant("attcap"); const b = await mainBranch(a);
    // Jabón nunca tuvo existencias: agotado con mínimo 10
    await a.client.from("products").insert({ tenant_id: a.tenantId, kind: "good", name: "Jabón", price: 2, min_stock: 10 });
    for (let i = 1; i <= 7; i++) {
      const id = await createDraft(a.client, a.tenantId, a.id, "USD", saleOf(b, [
        { productId: null, description: "Servicio", quantity: 1, unitPrice: 10, discountPct: 0, taxRate: 0 },
      ]));
      // día 01..07 de octubre: todas vencidas al 09, la #1 es la más antigua
      await emitSale(a.client, id, { paymentType: "credito", dueDate: `2026-10-0${i}` }, HOY);
    }
    const items = await attentionItems(a.client, HOY);
    expect(items.map((i) => i.kind)).toEqual(["vencida", "vencida", "vencida", "vencida", "vencida", "agotado"]);
    expect(items.slice(0, 5).map((i) => i.detail.match(/venció el (\S+)/)![1]))
      .toEqual(["01/10/2026", "02/10/2026", "03/10/2026", "04/10/2026", "05/10/2026"]);
    expect(items[5].title).toBe("Jabón agotado");
  });

  // Sin mínimo declarado no hay nada que reponer: no es una alerta.
  it("un producto con mínimo 0 y sin existencias no se lista", async () => {
    const a = await makeTenant("attmin");
    await a.client.from("products").insert({ tenant_id: a.tenantId, kind: "good", name: "Vaso", price: 1, min_stock: 0 });
    expect(await attentionItems(a.client, HOY)).toEqual([]);
  });

  it("una fecha que no es YYYY-MM-DD se rechaza en vez de consultar", async () => {
    const a = await makeTenant("attbad");
    await expect(attentionItems(a.client, "basura")).rejects.toThrow(/Fecha local inválida/);
  });
});
