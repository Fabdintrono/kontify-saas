import { createClient } from "@/lib/supabase/server";
import { listCategories, listTaxRates } from "@/lib/productos/queries";
import { createProductAction } from "@/app/(app)/operaciones/productos/actions";
import { ProductForm } from "@/components/productos/product-form";
import { Page } from "@/components/shared/page";

export default async function NuevoProductoPage() {
  const sb = await createClient();
  const [categories, taxRates] = await Promise.all([listCategories(sb), listTaxRates(sb)]);
  return (
    <Page>
      <h1 className="mb-4 text-xl font-extrabold tracking-[-0.4px] text-[var(--text)]">Nuevo producto</h1>
      <ProductForm action={createProductAction} categories={categories} taxRates={taxRates} submitLabel="Crear producto" />
    </Page>
  );
}
