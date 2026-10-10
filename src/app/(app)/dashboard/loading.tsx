import { Loading, HeaderSkeleton, CardsSkeleton, Skeleton } from "@/components/ui/skeleton";
import { Page } from "@/components/shared/page";

/** Carga del dashboard: cabecera, primeros pasos, los ocho indicadores y los paneles. */
export default function Loading_() {
  return (
    <Page>
      <HeaderSkeleton />
      <Loading>
        <div className="space-y-5">
          <Skeleton className="h-28 w-full rounded-2xl" />
          <CardsSkeleton count={8} />
          <div className="hidden gap-4 lg:grid lg:grid-cols-3">
            <Skeleton className="h-56 rounded-2xl lg:col-span-2" />
            <Skeleton className="h-56 rounded-2xl" />
          </div>
        </div>
      </Loading>
    </Page>
  );
}
