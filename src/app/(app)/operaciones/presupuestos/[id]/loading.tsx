import { Loading, HeaderSkeleton, TableSkeleton, Skeleton } from "@/components/ui/skeleton";
import { Page } from "@/components/shared/page";

/** Carga del presupuesto. */
export default function Loading_() {
  return (
    <Page>
      <HeaderSkeleton />
      <Loading>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <Skeleton className="mb-4 h-5 w-48" />
          <TableSkeleton widths={["46%", "14%", "20%", "20%"]} rows={5} />
        </div>
      </Loading>
    </Page>
  );
}
