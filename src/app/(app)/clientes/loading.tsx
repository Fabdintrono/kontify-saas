import { Loading, HeaderSkeleton, ToolbarSkeleton, TableSkeleton } from "@/components/ui/skeleton";
import { Page } from "@/components/shared/page";

/** Carga de la lista de clientes: misma forma que la página, sin salto al llegar los datos. */
export default function Loading_() {
  return (
    <Page>
      <HeaderSkeleton />
      <ToolbarSkeleton filters={2} />
      <Loading><TableSkeleton widths={["40%", "18%", "26%", "16%"]} /></Loading>
    </Page>
  );
}
