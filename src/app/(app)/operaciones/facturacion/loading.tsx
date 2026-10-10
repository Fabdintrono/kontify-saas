import { Loading, HeaderSkeleton, ToolbarSkeleton, TableSkeleton } from "@/components/ui/skeleton";
import { Page } from "@/components/shared/page";

/** Carga de la lista de ventas. */
export default function Loading_() {
  return (
    <Page>
      <HeaderSkeleton />
      <ToolbarSkeleton filters={2} />
      <Loading><TableSkeleton widths={["8%", "14%", "32%", "16%", "16%", "14%"]} /></Loading>
    </Page>
  );
}
