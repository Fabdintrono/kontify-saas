import { describe, it, expect } from "vitest";
import { newUserClient } from "./setup";
import { gettingStartedStatus } from "@/lib/dashboard/getting-started";
import { registerAdjustment } from "@/lib/inventario/mutations";
import { createDraft, emitSale } from "@/lib/ventas/mutations";

async function makeTenant(name: string) {
  const u = await newUserClient();
  const { data: tenantId } = await u.client.rpc("bootstrap_tenant", {
    p_name: name, p_slug: `${name}-${Date.now()}-${Math.random()}`, p_full_name: name,
  });
  return { ...u, tenantId: tenantId as string };
}
async function mainBranch(t: { client: Awaited<ReturnType<typeof newUserClient>>["client"]; tenantId: string }) {
  const { data } = await t.client.from("branches").select("id").eq("tenant_id", t.tenantId).eq("is_main", true).single();
  return data!.id as string;
}

describe("gettingStartedStatus", () => {
  it("empresa recién creada: 0 de 5, nada oculto, cada paso con enlace", async () => {
    const t = await makeTenant("gs0");
    const s = await gettingStartedStatus(t.client);
    expect(s.hidden).toBe(false);
    expect(s.items.map((i) => i.key)).toEqual(["producto", "existencias", "cliente", "venta", "equipo"]);
    expect(s.items.every((i) => !i.done && i.href.startsWith("/"))).toBe(true);
    expect(s.done).toBe(0); expect(s.total).toBe(5);
    // El paso de equipo todavía no tiene pantalla: se muestra pero no cuenta para el 100 %.
    expect(s.items.find((i) => i.key === "equipo")!.available).toBe(false);
    expect(s.items.filter((i) => i.available).map((i) => i.key)).toEqual(["producto", "existencias", "cliente", "venta"]);
    expect(s.complete).toBe(false);
  });
  it("va marcando pasos con datos reales (producto, existencias, cliente, venta)", async () => {
    const t = await makeTenant("gs1"); const b = await mainBranch(t);
    const { data: p } = await t.client.from("products").insert({ tenant_id: t.tenantId, kind: "good", name: "Café", price: 10, cost: 4 }).select("id").single();
    let s = await gettingStartedStatus(t.client);
    expect(s.items.find((i) => i.key === "producto")!.done).toBe(true);
    expect(s.done).toBe(1);
    await registerAdjustment(t.client, t.tenantId, t.id, { productId: p!.id, branchId: b, direction: "in", quantity: 5, reason: "inicial" });
    await t.client.from("clients").insert({ tenant_id: t.tenantId, kind: "person", name: "Ana" });
    const id = await createDraft(t.client, t.tenantId, t.id, "USD", { clientId: null, branchId: b, globalDiscountPct: 0, notes: undefined, items: [
      { productId: p!.id, description: "Café", quantity: 1, unitPrice: 10, discountPct: 0, taxRate: 0 },
    ] });
    await emitSale(t.client, id, { paymentType: "contado", paymentMethod: "efectivo" }, "2026-10-11");
    s = await gettingStartedStatus(t.client);
    expect(s.done).toBe(4);
    expect(s.items.find((i) => i.key === "equipo")!.done).toBe(false);
    // Los cuatro pasos disponibles están hechos: completo (y «Ocultar» disponible) aunque el total diga 5.
    expect(s.complete).toBe(true);
  });
  it("hidden refleja la columna", async () => {
    const t = await makeTenant("gs2");
    await t.client.from("tenants").update({ getting_started_hidden: true }).eq("id", t.tenantId);
    expect((await gettingStartedStatus(t.client)).hidden).toBe(true);
  });
});
