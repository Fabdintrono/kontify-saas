import { Loading, HeaderSkeleton, ToolbarSkeleton, TableSkeleton } from "@/components/ui/skeleton";
import { Page } from "@/components/shared/page";

/** Carga de existencias. */
export default function Loading_() {
  return (
    <Page>
      <HeaderSkeleton />
      <ToolbarSkeleton filters={2} />
      <Loading><TableSkeleton widths={["38%", "18%", "14%", "14%", "16%"]} /></Loading>
    </Page>
  );
}
