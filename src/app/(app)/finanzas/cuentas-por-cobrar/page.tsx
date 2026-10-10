import { Suspense } from "react";
import { redirect } from "next/navigation";
import { CircleCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { listReceivablesByClient, RECEIVABLES_SORT } from "@/lib/cobros/queries";
import { canRegisterPayment } from "@/lib/cobros/permissions";
import { resolveSort } from "@/lib/sorting";
import { formatMoney } from "@/lib/format";
import { getTenantSettings } from "@/lib/tenant";
import { todayISO } from "@/lib/tz";
import { ReceivablesToolbar } from "@/components/cobros/receivables-toolbar";
import { ReceivablesTable, RECEIVABLE_COL_WIDTHS } from "@/components/cobros/receivables-table";
import { ReceivableRowCard } from "@/components/cobros/receivable-row-card";
import { EmptyState } from "@/components/shared/empty-state";
import { ModuleHeader } from "@/components/shared/module-header";
import { ModuleGuide } from "@/components/shared/module-guide";
import { Page } from "@/components/shared/page";
import { ListBox } from "@/components/shared/list-box";
import { Loading, TableSkeleton } from "@/components/ui/skeleton";
import { GUIDES } from "@/lib/guides";
import type { Role } from "@/lib/auth/roles";
import { DANGER_TEXT } from "@/lib/ui-tokens";

type Params = { q?: string; filter?: string; sort?: string; dir?: string };

export default async function CuentasPorCobrarPage({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  const { data: mem } = await sb.from("memberships").select("role").eq("user_id", user!.id).single();
  const role = (mem?.role ?? "vendedor") as Role;
  if (!canRegisterPayment(role)) redirect("/dashboard");

  return (
    <Page>
      <ModuleHeader module="cuentas_por_cobrar" />
      <ReceivablesToolbar />

      <Suspense key={`${sp.q}|${sp.filter}|${sp.sort}|${sp.dir}`}
        fallback={<Loading><TableSkeleton widths={RECEIVABLE_COL_WIDTHS} /></Loading>}>
        <ReceivablesList sp={sp} />
      </Suspense>
    </Page>
  );
}

async function ReceivablesList({ sp }: { sp: Params }) {
  const sb = await createClient();
  const filter = (sp.filter === "vencidos" ? "vencidos" : "todos") as "todos" | "vencidos";
  const sort = resolveSort(RECEIVABLES_SORT, sp.sort, sp.dir);
  const { currency, timezone: tz } = await getTenantSettings(sb);
  const rows = await listReceivablesByClient(sb, { search: sp.q ?? "", filter, today: todayISO(tz), sort: sp.sort, dir: sp.dir });

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
        <EmptyState icon={CircleCheck} tone="ok" title="Nadie te debe"
          hint="Las ventas a crédito con saldo aparecen aquí."
          secondary={<ModuleGuide guide={GUIDES.cuentas_por_cobrar} />} />
      </div>
    );
  }

  const totalDue = rows.reduce((s, r) => s + r.totalDue, 0);
  const overdue = rows.reduce((s, r) => s + r.overdueAmount, 0);

  return (
    <div className="space-y-3">
      <p className="text-sm text-[var(--text-soft)]">
        Total: <span className="font-semibold text-[var(--text)]">{formatMoney(totalDue, currency)}</span>
        {overdue > 0 && <> · Vencido: <span className={`font-semibold ${DANGER_TEXT}`}>{formatMoney(overdue, currency)}</span></>}
      </p>
      <ListBox>
        <ReceivablesTable rows={rows} currency={currency} sort={sort} />
        <div className="space-y-2 lg:hidden">{rows.map((r) => <ReceivableRowCard key={r.clientId ?? "none"} r={r} currency={currency} />)}</div>
      </ListBox>
    </div>
  );
}
