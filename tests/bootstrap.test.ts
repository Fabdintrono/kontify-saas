import { describe, it, expect } from "vitest";
import { newUserClient } from "./setup";

describe("bootstrap_tenant", () => {
  it("crea tenant + sucursal principal + membership owner", async () => {
    const { client, id } = await newUserClient();
    const { data: tenantId, error } = await client.rpc("bootstrap_tenant", {
      p_name: "Acme", p_slug: `acme-${Date.now()}`, p_full_name: "Dueño Uno",
    });
    expect(error).toBeNull();
    expect(tenantId).toBeTruthy();

    const { data: branches } = await client.from("branches").select("*");
    expect(branches).toHaveLength(1);
    expect(branches![0].is_main).toBe(true);

    const { data: memberships } = await client.from("memberships").select("*");
    expect(memberships).toHaveLength(1);
    expect(memberships![0].role).toBe("owner");
    expect(memberships![0].user_id).toBe(id);
  });

  it("rechaza un segundo tenant para el mismo usuario", async () => {
    const { client } = await newUserClient();
    await client.rpc("bootstrap_tenant", { p_name: "A", p_slug: `a-${Date.now()}`, p_full_name: "x" });
    const { error } = await client.rpc("bootstrap_tenant", {
      p_name: "B", p_slug: `b-${Date.now()}`, p_full_name: "y",
    });
    expect(error).not.toBeNull();
  });
});
