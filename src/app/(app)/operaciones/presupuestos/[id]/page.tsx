import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getQuote } from "@/lib/presupuestos/queries";
import { canSell } from "@/lib/ventas/permissions";
import { deleteQuoteAction, setQuoteStatusAction, convertQuoteAction } from "@/app/(app)/operaciones/presupuestos/actions";
import { QuoteDocument } from "@/components/presupuestos/quote-document";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ActionButton } from "@/components/ui/action-button";
import { flashFor } from "@/lib/flash";
import { getTenantSettings } from "@/lib/tenant";
import { todayISO } from "@/lib/tz";
import type { Role } from "@/lib/auth/roles";

export default async function PresupuestoDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await createClient();
  const quote = await getQuote(sb, id);
  if (!quote) notFound();
  const { data: { user } } = await sb.auth.getUser();
  const { data: mem } = await sb.from("memberships").select("role").eq("user_id", user!.id).single();
  const role = (mem?.role ?? "vendedor") as Role;
  const allowed = canSell(role);
  const { timezone: tz } = await getTenantSettings(sb);

  const btn = "rounded-[10px] border border-[var(--border)] px-3 py-2 text-sm text-[var(--text)]";
  const primary = "rounded-[10px] bg-gradient-to-br from-[#0e7490] to-[#14b8a6] px-3 py-2 text-sm font-semibold text-white";

  return (
    <div className="space-y-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href="/operaciones/presupuestos" className="text-sm text-[var(--text-soft)] hover:text-[#0e7490]">← Presupuestos</Link>
        <div className="flex flex-wrap items-center gap-2">
          {allowed && quote.status === "draft" && (
            <>
              <Link href={`/operaciones/presupuestos/${quote.id}/editar`} className={`flex items-center gap-1.5 ${btn}`}>
                <Pencil className="h-4 w-4" /> Editar
              </Link>
              <ConfirmDialog action={deleteQuoteAction} payload={{ id: quote.id }}
                title="¿Eliminar este presupuesto?" description="Se borra el borrador. No afecta ventas ni stock."
                confirmLabel="Eliminar" triggerClassName={`${btn} text-[#dc2626]`}>
                Eliminar
              </ConfirmDialog>
            </>
          )}
          {allowed && (quote.status === "sent" || quote.status === "accepted") && (
            <>
              {quote.status === "sent" && (
                <ActionButton action={setQuoteStatusAction} payload={{ id: quote.id, status: "accepted" }}
                  successToast={flashFor("presupuesto-aceptado")} pendingLabel="Guardando…" className={btn}>
                  Marcar aceptado
                </ActionButton>
              )}
              <ConfirmDialog action={setQuoteStatusAction} payload={{ id: quote.id, status: "rejected" }}
                title={`¿Marcar el presupuesto #${quote.number} como rechazado?`}
                description="Queda cerrado y no podrá convertirse en venta."
                confirmLabel="Marcar rechazado" successToast={flashFor("presupuesto-rechazado")}
                triggerClassName={`${btn} text-[#dc2626]`}>
                Marcar rechazado
              </ConfirmDialog>
              {/* Redirige con ?flash=: el aviso lo da el destino, aquí no hace falta successToast. */}
              <ActionButton action={convertQuoteAction} payload={{ id: quote.id }}
                pendingLabel="Convirtiendo…" className={primary}>
                Convertir en venta
              </ActionButton>
            </>
          )}
          {quote.status === "converted" && quote.converted_sale_id && (
            <Link href={`/operaciones/facturacion/${quote.converted_sale_id}`} className={primary}>Ver venta</Link>
          )}
        </div>
      </div>

      <QuoteDocument quote={quote as any} today={todayISO(tz)} />
    </div>
  );
}
