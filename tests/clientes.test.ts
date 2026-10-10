import { describe, it, expect } from "vitest";
import { newUserClient } from "./setup";
import { createClient, archiveClient } from "@/lib/clientes/mutations";
import { listClients, listClientTypes, clientsKpi, clientsByType } from "@/lib/clientes/queries";

async function makeTenant(name: string) {
  const u = await newUserClient();
  const { data: tenantId } = await u.client.rpc("bootstrap_tenant", {
    p_name: name, p_slug: `${name}-${Date.now()}-${Math.random()}`, p_full_name: name,
  });
  return { ...u, tenantId: tenantId as string };
}

// Crea un usuario con un rol dado dentro del tenant del owner (el owner puede insertar memberships por RLS)
async function addMember(owner: Awaited<ReturnType<typeof makeTenant>>, role: string) {
  const u = await newUserClient();
  const { error } = await owner.client.from("memberships")
    .insert({ user_id: u.id, tenant_id: owner.tenantId, role });
  if (error) throw error;
  return u;
}

describe("clientes — seed y CRUD", () => {
  it("un tenant nuevo trae Minorista y Mayorista", async () => {
    const a = await makeTenant("seed");
    const types = await listClientTypes(a.client);
    expect(types.map((t) => t.name).sort()).toEqual(["Mayorista", "Minorista"]);
  });

  it("crear, listar, archivar y contar", async () => {
    const a = await makeTenant("crud");
    const types = await listClientTypes(a.client);
    const id = await createClient(a.client, a.tenantId, a.id, null,
      { kind: "person", name: "Juan Pérez", phone: "0412", typeId: types[0].id });
    expect(id).toBeTruthy();

    const activos = await listClients(a.client, { status: "activos" });
    expect(activos.total).toBe(1);
    expect(activos.rows[0].typeName).toBe(types[0].name);

    const kpi = await clientsKpi(a.client, "UTC");
    expect(kpi.total).toBe(1);
    expect(kpi.newThisMonth).toBe(1);

    const byType = await clientsByType(a.client);
    expect(byType.find((t) => t.typeId === types[0].id)?.count).toBe(1);

    await archiveClient(a.client, id, false);
    expect((await listClients(a.client, { status: "activos" })).total).toBe(0);
    expect((await listClients(a.client, { status: "archivados" })).total).toBe(1);
  });

  it("búsqueda por nombre", async () => {
    const a = await makeTenant("srch");
    await createClient(a.client, a.tenantId, a.id, null, { kind: "company", name: "Farmacia Sol" });
    await createClient(a.client, a.tenantId, a.id, null, { kind: "person", name: "Pedro Luna" });
    const r = await listClients(a.client, { search: "farmacia" });
    expect(r.total).toBe(1);
    expect(r.rows[0].name).toBe("Farmacia Sol");
  });
});

describe("clientes — RLS", () => {
  it("un tenant no ve clientes de otro", async () => {
    const a = await makeTenant("aa");
    const b = await makeTenant("bb");
    await createClient(a.client, a.tenantId, a.id, null, { kind: "person", name: "Cliente A" });
    const fromB = await listClients(b.client, { status: "todos" });
    expect(fromB.total).toBe(0);
  });

  it("un cajero no puede ver ni crear clientes", async () => {
    const a = await makeTenant("cc");
    const cajero = await addMember(a, "cajero");
    const { data: rows } = await cajero.client.from("clients").select("*");
    expect(rows).toHaveLength(0); // RLS filtra
    const { error } = await cajero.client.from("clients")
      .insert({ tenant_id: a.tenantId, kind: "person", name: "X" });
    expect(error).not.toBeNull(); // RLS niega el insert
  });

  it("un vendedor puede crear clientes pero no renombrar un tipo", async () => {
    const a = await makeTenant("dd");
    const vendedor = await addMember(a, "vendedor");
    const cid = await createClient(vendedor.client, a.tenantId, vendedor.id, null, { kind: "person", name: "V-cliente" });
    expect(cid).toBeTruthy();

    const types = await listClientTypes(vendedor.client);
    const original = types[0].name;
    await vendedor.client.from("client_types").update({ name: "Hackeado" }).eq("id", types[0].id);
    const after = await listClientTypes(a.client);
    expect(after.find((t) => t.id === types[0].id)?.name).toBe(original); // RLS impidió el cambio
  });
});

describe("clientes — valor comercial en la lista", () => {
  it("un cliente sin ventas sale en cero, no en null", async () => {
    const a = await makeTenant("stats-cero");
    const types = await listClientTypes(a.client);
    await createClient(a.client, a.tenantId, a.id, null, { kind: "person", name: "Sin compras", typeId: types[0].id });

    const { rows } = await listClients(a.client);
    expect(rows[0].orders).toBe(0);
    expect(rows[0].spent).toBe(0);
    expect(rows[0].lastOrderAt).toBeNull();
  });

  it("la vista no deja ver clientes de otro tenant", async () => {
    const a = await makeTenant("stats-a");
    const b = await makeTenant("stats-b");
    const tA = await listClientTypes(a.client);
    await createClient(a.client, a.tenantId, a.id, null, { kind: "person", name: "Solo de A", typeId: tA[0].id });

    const desdeB = await listClients(b.client);
    expect(desdeB.rows.map((r) => r.name)).not.toContain("Solo de A");
  });

  it("ordenar por total comprado no revienta aunque nadie haya comprado", async () => {
    const a = await makeTenant("stats-orden");
    const types = await listClientTypes(a.client);
    for (const n of ["Uno", "Dos"]) {
      await createClient(a.client, a.tenantId, a.id, null, { kind: "person", name: n, typeId: types[0].id });
    }
    const r = await listClients(a.client, { sort: "spent", dir: "desc" });
    expect(r.rows.length).toBe(2);
    expect(r.total).toBe(2);
  });

  it("el tipo del cliente viaja en la vista, sin incrustar otra tabla", async () => {
    const a = await makeTenant("stats-tipo");
    const types = await listClientTypes(a.client);
    const mayorista = types.find((t) => t.name === "Mayorista")!;
    await createClient(a.client, a.tenantId, a.id, null, { kind: "company", name: "Empresa X", typeId: mayorista.id });

    const { rows } = await listClients(a.client);
    expect(rows[0].typeName).toBe("Mayorista");
  });
});
