import { describe, it, expect } from "vitest";
import { newUserClient } from "./setup";

async function makeTenant(name: string) {
  const u = await newUserClient();
  const { data: tenantId } = await u.client.rpc("bootstrap_tenant", {
    p_name: name, p_slug: `${name}-${Date.now()}-${Math.random()}`, p_full_name: name,
  });
  return { ...u, tenantId };
}

describe("RLS tenant isolation", () => {
  it("un tenant no ve las sucursales de otro", async () => {
    const a = await makeTenant("aa");
    const b = await makeTenant("bb");

    const { data: aBranches } = await a.client.from("branches").select("*");
    const { data: bBranches } = await b.client.from("branches").select("*");

    expect(aBranches).toHaveLength(1);
    expect(bBranches).toHaveLength(1);
    expect(aBranches![0].tenant_id).not.toBe(bBranches![0].tenant_id);
  });

  it("un tenant no puede leer el tenant de otro por id", async () => {
    const a = await makeTenant("cc");
    const b = await makeTenant("dd");
    const { data } = await b.client.from("tenants").select("*").eq("id", a.tenantId);
    expect(data).toHaveLength(0); // RLS lo filtra
  });

  it("un usuario sin tenant no ve nada", async () => {
    const { client } = await newUserClient();
    const { data } = await client.from("branches").select("*");
    expect(data).toHaveLength(0);
  });
});
