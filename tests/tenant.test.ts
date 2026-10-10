import { describe, it, expect } from "vitest";
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
});
