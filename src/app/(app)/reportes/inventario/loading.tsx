import { Loading, HeaderSkeleton, ToolbarSkeleton, TableSkeleton, CardsSkeleton } from "@/components/ui/skeleton";
import { Page } from "@/components/shared/page";

/** Carga del reporte de inventario. */
export default function Loading_() {
  return (
    <Page>
      <HeaderSkeleton />
      <ToolbarSkeleton filters={2} />
      <Loading>
        <div className="space-y-5">
          <CardsSkeleton count={4} />
          <TableSkeleton widths={["40%", "20%", "20%", "20%"]} rows={6} />
        </div>
      </Loading>
    </Page>
  );
}
