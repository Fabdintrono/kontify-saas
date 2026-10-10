import { Loading, HeaderSkeleton, ToolbarSkeleton, TableSkeleton } from "@/components/ui/skeleton";
import { Page } from "@/components/shared/page";

/** Carga de la deuda por cliente. */
export default function Loading_() {
  return (
    <Page>
      <HeaderSkeleton />
      <ToolbarSkeleton filters={1} />
      <Loading><TableSkeleton widths={["40%", "20%", "20%", "20%"]} /></Loading>
    </Page>
  );
}
