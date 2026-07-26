import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getQuote } from "@/lib/presupuestos/queries";
import { canSell } from "@/lib/ventas/permissions";
import { deleteQuoteAction, setQuoteStatusAction, convertQuoteAction } from "@/app/(app)/operaciones/presupuestos/actions";
import { QuoteDocument } from "@/components/presupuestos/quote-document";
import { PendingButton } from "@/components/shared/pending-button";
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
              <form action={deleteQuoteAction}>
                <input type="hidden" name="id" value={quote.id} />
                <button className={`${btn} text-[#dc2626]`}>Eliminar</button>
              </form>
            </>
          )}
          {allowed && (quote.status === "sent" || quote.status === "accepted") && (
            <>
              {quote.status === "sent" && (
                <form action={setQuoteStatusAction}>
                  <input type="hidden" name="id" value={quote.id} />
                  <input type="hidden" name="status" value="accepted" />
                  <button className={btn}>Marcar aceptado</button>
                </form>
              )}
              <form action={setQuoteStatusAction}>
                <input type="hidden" name="id" value={quote.id} />
                <input type="hidden" name="status" value="rejected" />
                <button className={`${btn} text-[#dc2626]`}>Marcar rechazado</button>
              </form>
              <form action={convertQuoteAction}>
                <input type="hidden" name="id" value={quote.id} />
                <PendingButton className={primary} pendingLabel="Convirtiendo…">Convertir en venta</PendingButton>
              </form>
            </>
          )}
          {quote.status === "converted" && quote.converted_sale_id && (
            <Link href={`/operaciones/facturacion/${quote.converted_sale_id}`} className={primary}>Ver venta</Link>
          )}
        </div>
      </div>

      <QuoteDocument quote={quote as any} />
    </div>
  );
}
