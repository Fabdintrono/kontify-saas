import { describe, it, expect } from "vitest";
import { newUserClient } from "./setup";
import type { SaleSaveInput } from "@/lib/ventas/schema";
import { createDraft, emitSale, voidSale } from "@/lib/ventas/mutations";
import { registerPayment, voidPayment, setDueDate } from "@/lib/cobros/mutations";
import { listReceivablesByClient, getClientReceivable, listPayments } from "@/lib/cobros/queries";

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
async function makeClient(t: Awaited<ReturnType<typeof makeTenant>>, name: string) {
  const { data } = await t.client.from("clients").insert({ tenant_id: t.tenantId, kind: "person", name }).select("id").single();
  return data!.id as string;
}
const sale = (branchId: string, clientId: string | null, total = 100): SaleSaveInput => ({
  clientId, branchId, globalDiscountPct: 0, notes: undefined,
  items: [{ productId: null, description: "Prod", quantity: 1, unitPrice: total, discountPct: 0, taxRate: 0 }],
});
async function balanceOf(t: any, saleId: string) {
  const { data } = await t.client.from("sales").select("balance, paid_amount").eq("id", saleId).single();
  return { balance: Number(data.balance), paid: Number(data.paid_amount) };
}

describe("cobros — flujo con trigger", () => {
  it("emitir contado crea un cobro y deja la venta pagada", async () => {
    const a = await makeTenant("con");
    const id = await createDraft(a.client, a.tenantId, a.id, "USD", sale(await mainBranch(a), null, 100));
    await emitSale(a.client, id, { paymentType: "contado", paymentMethod: "efectivo" });
    expect((await balanceOf(a, id)).balance).toBe(0);
    const pays = await listPayments(a.client, id);
    expect(pays).toHaveLength(1);
    expect(pays[0].amount).toBe(100);
  });

  it("abono parcial baja el saldo; completar deja pagada; el trigger mantiene paid_amount", async () => {
    const a = await makeTenant("par");
    const cli = await makeClient(a, "Ana");
    const id = await createDraft(a.client, a.tenantId, a.id, "USD", sale(await mainBranch(a), cli, 100));
    await emitSale(a.client, id, { paymentType: "credito" });
    expect((await balanceOf(a, id)).balance).toBe(100);
    await registerPayment(a.client, a.tenantId, a.id, { saleId: id, amount: 40 });
    expect((await balanceOf(a, id)).balance).toBe(60);
    await registerPayment(a.client, a.tenantId, a.id, { saleId: id, amount: 60 });
    expect((await balanceOf(a, id)).balance).toBe(0);
  });

  it("un abono mayor al saldo es rechazado", async () => {
    const a = await makeTenant("ovr");
    const id = await createDraft(a.client, a.tenantId, a.id, "USD", sale(await mainBranch(a), null, 50));
    await emitSale(a.client, id, { paymentType: "credito" });
    await expect(registerPayment(a.client, a.tenantId, a.id, { saleId: id, amount: 51 })).rejects.toBeTruthy();
  });

  it("anular un cobro restaura el saldo (trigger)", async () => {
    const a = await makeTenant("vd");
    const id = await createDraft(a.client, a.tenantId, a.id, "USD", sale(await mainBranch(a), null, 100));
    await emitSale(a.client, id, { paymentType: "credito" });
    const pid = await registerPayment(a.client, a.tenantId, a.id, { saleId: id, amount: 100 });
    expect((await balanceOf(a, id)).balance).toBe(0);
    await voidPayment(a.client, pid);
    expect((await balanceOf(a, id)).balance).toBe(100);
  });

  it("no se puede anular una venta con cobros activos", async () => {
    const a = await makeTenant("blk");
    const id = await createDraft(a.client, a.tenantId, a.id, "USD", sale(await mainBranch(a), null, 100));
    await emitSale(a.client, id, { paymentType: "credito" });
    const pid = await registerPayment(a.client, a.tenantId, a.id, { saleId: id, amount: 30 });
    await expect(voidSale(a.client, id)).rejects.toBeTruthy();
    await voidPayment(a.client, pid);
    await voidSale(a.client, id); // ahora sí
  });
});

describe("cobros — Cuentas por Cobrar", () => {
  it("agrupa por cliente y calcula vencido con due_date en el pasado", async () => {
    const a = await makeTenant("cxc");
    const cli = await makeClient(a, "Zoe");
    const branch = await mainBranch(a);
    const id1 = await createDraft(a.client, a.tenantId, a.id, "USD", sale(branch, cli, 100));
    await emitSale(a.client, id1, { paymentType: "credito", dueDate: "2020-01-01" }); // vencida
    const id2 = await createDraft(a.client, a.tenantId, a.id, "USD", sale(branch, cli, 50));
    await emitSale(a.client, id2, { paymentType: "credito" }); // sin vencimiento

    const byClient = await listReceivablesByClient(a.client, {});
    const row = byClient.find((r) => r.clientId === cli);
    expect(row?.totalDue).toBe(150);
    expect(row?.overdueAmount).toBe(100);

    const soloVencidos = await listReceivablesByClient(a.client, { filter: "vencidos" });
    expect(soloVencidos.find((r) => r.clientId === cli)?.overdueAmount).toBe(100);

    const detail = await getClientReceivable(a.client, cli);
    expect(detail.totalDue).toBe(150);
    expect(detail.rows).toHaveLength(2);
    expect(detail.rows.find((r) => r.saleId === id1)?.overdue).toBe(true);
  });

  it("fijar vencimiento en una venta emitida", async () => {
    const a = await makeTenant("due");
    const id = await createDraft(a.client, a.tenantId, a.id, "USD", sale(await mainBranch(a), null, 100));
    await emitSale(a.client, id, { paymentType: "credito" });
    await setDueDate(a.client, id, "2027-06-30");
    const { data } = await a.client.from("sales").select("due_date").eq("id", id).single();
    expect(data!.due_date).toBe("2027-06-30");
  });
});
