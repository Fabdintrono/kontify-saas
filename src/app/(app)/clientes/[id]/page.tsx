import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil, ShoppingBag, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getClient } from "@/lib/clientes/queries";
import { canArchiveClient } from "@/lib/clientes/permissions";
import { archiveClientAction } from "@/app/(app)/clientes/actions";
import { EmptyState } from "@/components/shared/empty-state";
import { TypeBadge } from "@/components/clientes/type-badge";
import type { Role } from "@/lib/auth/roles";

export default async function ClienteDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await createClient();
  const c = await getClient(sb, id);
  if (!c) notFound();
  const { data: { user } } = await sb.auth.getUser();
  const { data: mem } = await sb.from("memberships").select("role").eq("user_id", user!.id).single();
  const role = (mem?.role ?? "vendedor") as Role;

  const field = (label: string, value: string | null) => (
    <div><p className="text-xs text-[var(--text-soft)]">{label}</p><p className="text-sm text-[var(--text)]">{value || "—"}</p></div>
  );

  return (
    <div className="space-y-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-extrabold tracking-[-0.4px] text-[var(--text)]">{c.name}</h1>
          <TypeBadge name={c.client_types?.name ?? null} />
          {!c.active && <span className="rounded-full bg-[var(--bg)] px-2 py-0.5 text-xs text-[var(--text-soft)]">Archivado</span>}
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/clientes/${c.id}/editar`}
            className="flex items-center gap-1.5 rounded-[10px] border border-[var(--border)] px-3 py-2 text-sm text-[var(--text)]">
            <Pencil className="h-4 w-4" /> Editar
          </Link>
          {canArchiveClient(role) && (
            <form action={archiveClientAction}>
              <input type="hidden" name="id" value={c.id} />
              <input type="hidden" name="active" value={c.active ? "false" : "true"} />
              <button className="rounded-[10px] border border-[var(--border)] px-3 py-2 text-sm text-[var(--text)]">
                {c.active ? "Archivar" : "Reactivar"}
              </button>
            </form>
          )}
        </div>
      </div>

      <div className="grid gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:grid-cols-2">
        {field("Tipo de registro", c.kind === "company" ? "Empresa" : "Persona")}
        {field("Documento / ID", c.doc_id)}
        {field("Teléfono", c.phone)}
        {field("Email", c.email)}
        {field("Dirección", c.address)}
        {field("Persona de contacto", c.contact_name)}
        <div className="sm:col-span-2">{field("Notas", c.notes)}</div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
          <EmptyState icon={ShoppingBag} title="Historial de compras" hint="Llega con el módulo de Facturación." />
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
          <EmptyState icon={Wallet} title="Por cobrar" hint="Llega con el módulo de Facturación." />
        </div>
      </div>
    </div>
  );
}
