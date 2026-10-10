import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listCategories } from "@/lib/productos/queries";
import { canManageCategories } from "@/lib/productos/permissions";
import { createCategoryFormAction, updateCategoryAction } from "@/app/(app)/operaciones/productos/actions";
import { ModuleHeader } from "@/components/shared/module-header";
import { Button } from "@/components/ui/button";
import type { Role } from "@/lib/auth/roles";

export default async function CategoriasDeProductoPage() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  const { data: mem } = await sb.from("memberships").select("role").eq("user_id", user!.id).single();
  const role = (mem?.role ?? "vendedor") as Role;
  if (!canManageCategories(role)) redirect("/dashboard");

  const categories = await listCategories(sb, { includeInactive: true });
  const inputCls = "h-9 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--text)] outline-none focus:border-[#0e7490]";

  return (
    <div className="max-w-lg space-y-4 p-6">
      <ModuleHeader module="config_categorias" />

      <form action={createCategoryFormAction} className="flex gap-2">
        <input name="name" placeholder="Nueva categoría (ej. Repuestos)" className={`${inputCls} flex-1`} />
        <Button variant="primary">Añadir</Button>
      </form>

      <ul className="divide-y divide-[var(--border)] rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
        {categories.map((c) => (
          <li key={c.id} className="flex items-center gap-2 p-3">
            <form action={updateCategoryAction} className="flex flex-1 items-center gap-2">
              <input type="hidden" name="id" value={c.id} />
              <input name="name" defaultValue={c.name} className={`${inputCls} flex-1`} />
              <Button variant="secondary">Guardar</Button>
            </form>
            <form action={updateCategoryAction}>
              <input type="hidden" name="id" value={c.id} />
              <input type="hidden" name="active" value={c.active ? "false" : "true"} />
              <Button variant="secondary">
                {c.active ? "Desactivar" : "Activar"}
              </Button>
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
}
