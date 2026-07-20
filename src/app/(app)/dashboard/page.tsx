import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function Dashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("memberships")
    .select("role, tenant_id, tenants(name, slug)")
    .single();

  const { data: branches } = await supabase.from("branches").select("name, is_main");

  return (
    <main className="p-8 space-y-2">
      <h1 className="text-2xl font-bold">Dashboard (placeholder)</h1>
      <p>Usuario: {user.email}</p>
      <p>Empresa: {(membership as any)?.tenants?.name} ({(membership as any)?.tenants?.slug}.kontify.app)</p>
      <p>Rol: {membership?.role}</p>
      <p>Sucursales: {branches?.map((b) => b.name).join(", ")}</p>
      <p className="text-ink-soft text-sm">El shell dual-tier y el dashboard real llegan en el Plan 2.</p>
    </main>
  );
}
