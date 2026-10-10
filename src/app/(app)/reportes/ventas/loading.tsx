import { Loading, HeaderSkeleton, ToolbarSkeleton, CardsSkeleton, Skeleton } from "@/components/ui/skeleton";
import { Page } from "@/components/shared/page";

/** Carga del reporte de ventas: selector de período, cuatro indicadores y los gráficos. */
export default function Loading_() {
  return (
    <Page>
      <HeaderSkeleton />
      <ToolbarSkeleton filters={3} />
      <Loading>
        <div className="space-y-5">
          <CardsSkeleton count={4} />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      </Loading>
    </Page>
  );
}
