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
    expect(items[1]).toMatchObject({ tone: "danger", title: "Cloro agotado", href: "/operaciones/inventario" });
    expect(items[2]).toMatchObject({ tone: "warn", title: "Refresco con stock bajo" });
    expect(items[2].detail).toMatch(/5 .* 12/);
  });
});
