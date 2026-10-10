import { Loading, HeaderSkeleton, FormSkeleton } from "@/components/ui/skeleton";
import { Page } from "@/components/shared/page";

/** Carga de cualquier pantalla de configuración. */
export default function Loading_() {
  return (
    <Page>
      <HeaderSkeleton />
      <Loading><FormSkeleton /></Loading>
    </Page>
  );
}
