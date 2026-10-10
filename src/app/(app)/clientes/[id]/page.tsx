import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getClient } from "@/lib/clientes/queries";
import { canArchiveClient } from "@/lib/clientes/permissions";
import { archiveClientAction } from "@/app/(app)/clientes/actions";
import { TypeBadge } from "@/components/clientes/type-badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ActionButton } from "@/components/ui/action-button";
import { flashFor } from "@/lib/flash";
import { salesByClient } from "@/lib/ventas/queries";
import { formatMoney, formatDate } from "@/lib/format";
import { getTenantSettings } from "@/lib/tenant";
import type { Role } from "@/lib/auth/roles";

export default async function ClienteDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await createClient();
  const c = await getClient(sb, id);
  if (!c) notFound();
  const { data: { user } } = await sb.auth.getUser();
  const { data: mem } = await sb.from("memberships").select("role").eq("user_id", user!.id).single();
  const role = (mem?.role ?? "vendedor") as Role;

  const [history, settings] = await Promise.all([salesByClient(sb, c.id), getTenantSettings(sb)]);
  const { currency, timezone: tz } = settings;

  const field = (label: string, value: string | null) => (
    <div><p className="text-xs text-[var(--text-soft)]">{label}</p><p className="text-sm text-[var(--text)]">{value || "—"}</p></div>
  );
  const secondaryBtn = "rounded-[10px] border border-[var(--border)] px-3 py-2 text-sm text-[var(--text)]";

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
          {canArchiveClient(role) && (c.active ? (
            <ConfirmDialog action={archiveClientAction} payload={{ id: c.id, active: "false" }}
              title={`¿Archivar a ${c.name}?`}
              description="Deja de aparecer en listas y al vender. Su historial y sus ventas se conservan; puedes reactivarlo cuando quieras."
              confirmLabel="Archivar" successToast={flashFor("cliente-archivado")} triggerClassName={secondaryBtn}>
              Archivar
            </ConfirmDialog>
          ) : (
            <ActionButton action={archiveClientAction} payload={{ id: c.id, active: "true" }}
              successToast={flashFor("cliente-reactivado")} className={secondaryBtn}>
              Reactivar
            </ActionButton>
          ))}
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
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-bold text-[var(--text)]">Historial de compras</p>
            {history.purchasedTotal > 0 && <span className="text-xs text-[var(--text-soft)]">{formatMoney(history.purchasedTotal, currency)}</span>}
          </div>
          {history.list.length === 0 ? (
            <p className="py-6 text-center text-sm text-[var(--text-soft)]">Sin compras registradas.</p>
          ) : (
            <ul className="space-y-2">
              {history.list.map((s) => (
                <li key={s.id} className="flex items-center justify-between text-sm">
                  <Link href={`/operaciones/facturacion/${s.id}`} className="text-[var(--text)] hover:text-[#0e7490]">
                    Venta #{s.number} · {formatDate(s.issuedAt, tz)}
                  </Link>
                  <span className="font-medium text-[var(--text)]">{formatMoney(s.total, currency)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <p className="mb-3 text-sm font-bold text-[var(--text)]">Por cobrar</p>
          {history.receivable > 0
            ? <p className="text-2xl font-extrabold text-[#dc2626]">{formatMoney(history.receivable, currency)}</p>
            : <p className="py-6 text-center text-sm text-[var(--text-soft)]">Sin saldos pendientes.</p>}
        </div>
      </div>
    </div>
  );
}
