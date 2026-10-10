import { Loading, HeaderSkeleton, TableSkeleton, CardsSkeleton } from "@/components/ui/skeleton";
import { Page } from "@/components/shared/page";

/** Carga de la ficha del cliente. */
export default function Loading_() {
  return (
    <Page>
      <HeaderSkeleton />
      <Loading>
        <div className="space-y-5">
          <CardsSkeleton count={3} height="h-24" />
          <TableSkeleton widths={["30%", "25%", "25%", "20%"]} rows={6} />
        </div>
      </Loading>
    </Page>
  );
}
