import { createClient } from "@/lib/supabase/server";
import { listCategories, listTaxRates, getTenantCurrency } from "@/lib/productos/queries";
import { createProductAction } from "@/app/(app)/operaciones/productos/actions";
import { ProductForm } from "@/components/productos/product-form";
import { FormHeader } from "@/components/shared/form-shell";
import { Page } from "@/components/shared/page";

export default async function NuevoProductoPage() {
  const sb = await createClient();
  const [categories, taxRates, currency] = await Promise.all([
    listCategories(sb), listTaxRates(sb), getTenantCurrency(sb),
  ]);
  return (
    <Page>
      <FormHeader backHref="/operaciones/productos" backLabel="Productos" title="Nuevo producto"
        subtitle="Define qué vendes y a qué precio. La existencia se carga después, desde Inventario." />
      <ProductForm action={createProductAction} categories={categories} taxRates={taxRates}
        currency={currency} submitLabel="Crear producto" cancelHref="/operaciones/productos" />
    </Page>
  );
}
