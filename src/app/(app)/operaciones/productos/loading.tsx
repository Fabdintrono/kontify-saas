import { Loading, HeaderSkeleton, ToolbarSkeleton, TableSkeleton } from "@/components/ui/skeleton";
import { Page } from "@/components/shared/page";

/** Carga del catálogo. */
export default function Loading_() {
  return (
    <Page>
      <HeaderSkeleton />
      <ToolbarSkeleton filters={3} />
      <Loading><TableSkeleton widths={["34%", "16%", "20%", "16%", "14%"]} /></Loading>
    </Page>
  );
}
