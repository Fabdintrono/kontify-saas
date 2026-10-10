import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { newUserClient } from "./setup";
import { getTenantSettings } from "@/lib/tenant";
import { getTenantCurrency } from "@/lib/productos/queries";

async function makeTenant(name: string) {
  const u = await newUserClient();
  const { data: tenantId } = await u.client.rpc("bootstrap_tenant", {
    p_name: name, p_slug: `${name}-${Date.now()}-${Math.random()}`, p_full_name: name,
  });
  return { ...u, tenantId: tenantId as string };
}

describe("getTenantSettings", () => {
  it("devuelve moneda y zona horaria con defaults USD / America/Caracas", async () => {
    const t = await makeTenant("tz");
    const s = await getTenantSettings(t.client);
    expect(s.currency).toBe("USD");
    expect(s.timezone).toBe("America/Caracas");
  });
  it("respeta la zona guardada en la empresa (el owner puede editarla)", async () => {
    const t = await makeTenant("tz2");
    const { error } = await t.client.from("tenants").update({ timezone: "America/Bogota" }).eq("id", t.tenantId);
    expect(error).toBeNull();
    expect((await getTenantSettings(t.client)).timezone).toBe("America/Bogota");
  });
  it("getTenantCurrency sigue funcionando (compatibilidad)", async () => {
    const t = await makeTenant("tz3");
    expect(await getTenantCurrency(t.client)).toBe("USD");
  });
  it("una zona guardada con forma válida pero inexistente cae al default (la app valida con Intl)", async () => {
    const t = await makeTenant("tz4");
    const { error } = await t.client.from("tenants").update({ timezone: "Foo/Bar" }).eq("id", t.tenantId);
    expect(error).toBeNull();
    expect((await getTenantSettings(t.client)).timezone).toBe("America/Caracas");
  });
  it("la base rechaza una zona con forma inválida", async () => {
    const t = await makeTenant("tz5");
    const { error } = await t.client.from("tenants").update({ timezone: "Foo Bar" }).eq("id", t.tenantId);
    expect(error?.code).toBe("23514"); // check_violation
  });
  it("usuario sin empresa → defaults, nunca lanza", async () => {
    const u = await newUserClient();
    expect(await getTenantSettings(u.client)).toEqual({ currency: "USD", timezone: "America/Caracas" });
  });
  it("si la columna timezone no existe, la moneda sigue siendo la real (no cae a USD)", async () => {
    const fake = { from: () => ({ select: (cols: string) => ({ maybeSingle: async () =>
      cols.includes("timezone")
        ? { data: null, error: { code: "42703", message: "column tenants.timezone does not exist" } }
        : { data: { currency: "VES" }, error: null } }) }) } as unknown as SupabaseClient;
    expect(await getTenantSettings(fake)).toEqual({ currency: "VES", timezone: "America/Caracas" });
  });
});
