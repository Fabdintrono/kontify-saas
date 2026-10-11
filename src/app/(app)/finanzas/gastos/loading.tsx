import { Loading, HeaderSkeleton, ToolbarSkeleton, TableSkeleton, CardsSkeleton } from "@/components/ui/skeleton";
import { Page } from "@/components/shared/page";

/** Carga de Gastos: cabecera, pestañas, filtros, tarjetas y la lista. */
export default function Loading_() {
  return (
    <Page>
      <HeaderSkeleton />
      <ToolbarSkeleton filters={2} />
      <Loading>
        <div className="space-y-5">
          <CardsSkeleton count={3} />
          <TableSkeleton widths={["13%", "37%", "18%", "18%", "14%"]} />
        </div>
      </Loading>
    </Page>
  );
}
