import { describe, it, expect } from "vitest";
import { newUserClient } from "./setup";
import type { QuoteSaveInput } from "@/lib/presupuestos/schema";
import { createDraft, sendQuote, setQuoteStatus, convertToSale, deleteDraft } from "@/lib/presupuestos/mutations";
import { emitSale } from "@/lib/ventas/mutations";
import { listQuotes } from "@/lib/presupuestos/queries";

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
async function addMember(owner: Awaited<ReturnType<typeof makeTenant>>, role: string, branchId: string | null = null) {
  const u = await newUserClient();
  const { error } = await owner.client.from("memberships").insert({ user_id: u.id, tenant_id: owner.tenantId, role, branch_id: branchId });
  if (error) throw error;
  return u;
}
const quote = (branchId: string, over: Partial<QuoteSaveInput> = {}): QuoteSaveInput => ({
  clientId: null, branchId, globalDiscountPct: 0, validUntil: null, notes: undefined,
  items: [{ productId: null, description: "Prod", quantity: 2, unitPrice: 10, discountPct: 0, taxRate: 16 }], ...over,
});

describe("presupuestos — flujo", () => {
  it("crear → enviar asigna correlativo propio; dos → consecutivos", async () => {
    const a = await makeTenant("flow"); const b = await mainBranch(a);
    const id1 = await createDraft(a.client, a.tenantId, a.id, "USD", quote(b));
    const id2 = await createDraft(a.client, a.tenantId, a.id, "USD", quote(b));
    await sendQuote(a.client, id1);
    await sendQuote(a.client, id2);
    const enviados = await listQuotes(a.client, { status: "enviados" });
    expect(enviados.rows.map((r) => r.number).sort((x, y) => (x! - y!))).toEqual([1, 2]);
  });

  it("aceptar/rechazar desde enviado", async () => {
    const a = await makeTenant("st"); const b = await mainBranch(a);
    const id = await createDraft(a.client, a.tenantId, a.id, "USD", quote(b));
    await sendQuote(a.client, id);
    await setQuoteStatus(a.client, id, "accepted");
    const { data } = await a.client.from("quotes").select("status").eq("id", id).single();
    expect(data!.status).toBe("accepted");
  });

  it("convertir crea una venta borrador con las mismas líneas y no se puede dos veces", async () => {
    const a = await makeTenant("cv"); const b = await mainBranch(a);
    const id = await createDraft(a.client, a.tenantId, a.id, "USD", quote(b));
    await sendQuote(a.client, id);
    const saleId = await convertToSale(a.client, a.tenantId, a.id, "USD", id);

    const { data: sale } = await a.client.from("sales").select("status, total").eq("id", saleId).single();
    expect(sale!.status).toBe("draft");           // venta creada como borrador
    expect(Number(sale!.total)).toBe(23.2);       // 2*10 + 16%
    const { count } = await a.client.from("sale_items").select("id", { count: "exact", head: true }).eq("sale_id", saleId);
    expect(count).toBe(1);

    const { data: q } = await a.client.from("quotes").select("status, converted_sale_id").eq("id", id).single();
    expect(q!.status).toBe("converted");
    expect(q!.converted_sale_id).toBe(saleId);

    await expect(convertToSale(a.client, a.tenantId, a.id, "USD", id)).rejects.toBeTruthy(); // dos veces no
  });

  it("la serie de presupuestos es independiente de la de ventas", async () => {
    const a = await makeTenant("ser"); const b = await mainBranch(a);
    // emitir una venta consume el correlativo de ventas, no el de presupuestos
    const { createDraft: saleDraft } = await import("@/lib/ventas/mutations");
    const sId = await saleDraft(a.client, a.tenantId, a.id, "USD", {
      clientId: null, branchId: b, globalDiscountPct: 0, notes: undefined,
      items: [{ productId: null, description: "X", quantity: 1, unitPrice: 5, discountPct: 0, taxRate: 0 }],
    });
    await emitSale(a.client, sId, { paymentType: "credito" });
    const qId = await createDraft(a.client, a.tenantId, a.id, "USD", quote(b));
    await sendQuote(a.client, qId);
    const { data: q } = await a.client.from("quotes").select("number").eq("id", qId).single();
    expect(Number(q!.number)).toBe(1); // primer presupuesto, aunque ya haya una venta #1
  });

  it("borrar un borrador elimina sus ítems (cascade)", async () => {
    const a = await makeTenant("del"); const b = await mainBranch(a);
    const id = await createDraft(a.client, a.tenantId, a.id, "USD", quote(b));
    await deleteDraft(a.client, id);
    const { count } = await a.client.from("quote_items").select("id", { count: "exact", head: true }).eq("quote_id", id);
    expect(count ?? 0).toBe(0);
  });
});

describe("presupuestos — RLS", () => {
  it("aislamiento entre tenants y almacén no inserta", async () => {
    const a = await makeTenant("aa"); const bb = await makeTenant("bb");
    await createDraft(a.client, a.tenantId, a.id, "USD", quote(await mainBranch(a)));
    expect((await listQuotes(bb.client, { status: "todos" })).total).toBe(0);
    const main = await mainBranch(a);
    const almacen = await addMember(a, "almacen", main);
    const { error } = await almacen.client.from("quotes")
      .insert({ tenant_id: a.tenantId, branch_id: main, status: "draft", currency: "USD" });
    expect(error).not.toBeNull();
  });

  it("scoping por sucursal: vendedor de otra sucursal no ve el presupuesto", async () => {
    const a = await makeTenant("scope"); const main = await mainBranch(a);
    const { data: otra } = await a.client.from("branches").insert({ tenant_id: a.tenantId, name: "Sur" }).select("id").single();
    await createDraft(a.client, a.tenantId, a.id, "USD", quote(main));
    const vOtra = await addMember(a, "vendedor", otra!.id);
    const vMain = await addMember(a, "vendedor", main);
    expect((await listQuotes(vOtra.client, { status: "todos" })).total).toBe(0);
    expect((await listQuotes(vMain.client, { status: "todos" })).total).toBe(1);
  });
});
