import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listCategories } from "@/lib/productos/queries";
import { canManageCategories } from "@/lib/productos/permissions";
import { createCategoryFormAction, updateCategoryAction } from "@/app/(app)/operaciones/productos/actions";
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
      <h1 className="text-xl font-extrabold tracking-[-0.4px] text-[var(--text)]">Categorías de producto</h1>

      <form action={createCategoryFormAction} className="flex gap-2">
        <input name="name" placeholder="Nueva categoría (ej. Repuestos)" className={`${inputCls} flex-1`} />
        <button className="rounded-[10px] bg-gradient-to-br from-[#0e7490] to-[#14b8a6] px-4 text-sm font-semibold text-white">Añadir</button>
      </form>

      <ul className="divide-y divide-[var(--border)] rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
        {categories.map((c) => (
          <li key={c.id} className="flex items-center gap-2 p-3">
            <form action={updateCategoryAction} className="flex flex-1 items-center gap-2">
              <input type="hidden" name="id" value={c.id} />
              <input name="name" defaultValue={c.name} className={`${inputCls} flex-1`} />
              <button className="rounded-[10px] border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--text)]">Guardar</button>
            </form>
            <form action={updateCategoryAction}>
              <input type="hidden" name="id" value={c.id} />
              <input type="hidden" name="active" value={c.active ? "false" : "true"} />
              <button className="rounded-[10px] border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--text-soft)]">
                {c.active ? "Desactivar" : "Activar"}
              </button>
            </form>
          </li>
        ))}
      </ul>
      <p className="text-xs text-[var(--text-soft)]">Las categorías inactivas no aparecen al crear productos, pero se conservan en los existentes.</p>
    </div>
  );
}
