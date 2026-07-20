import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell, type ShellUser, type ShellBranch } from "@/components/shell/app-shell";
import type { Role } from "@/lib/auth/roles";

const ROLE_LABEL: Record<Role, string> = {
  owner: "Propietario", admin: "Administrador", administrativo: "Administrativo",
  vendedor: "Vendedor", cajero: "Cajero", almacen: "Almacén",
};

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // profiles y memberships NO tienen FK directa entre sí (ambas referencian auth.users),
  // así que se consultan por separado. memberships se filtra explícitamente por user_id
  // porque RLS solo scopea por tenant: sin ese filtro devolvería TODAS las membresías del
  // tenant y .single() fallaría (PGRST116) con 2+ usuarios.
  const { data: membership } = await supabase.from("memberships").select("role").eq("user_id", user.id).single();
  const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).single();
  const { data: branches } = await supabase.from("branches").select("id, name").order("is_main", { ascending: false });

  const role = (membership?.role ?? "vendedor") as Role;
  const fullName = profile?.full_name ?? "";
  const shellUser: ShellUser = {
    email: user.email ?? "",
    fullName,
    initial: (fullName || user.email || "K").trim().charAt(0).toUpperCase(),
    role,
    roleLabel: ROLE_LABEL[role],
  };
  const shellBranches: ShellBranch[] = (branches ?? []) as ShellBranch[];

  return <AppShell user={shellUser} branches={shellBranches}>{children}</AppShell>;
}
