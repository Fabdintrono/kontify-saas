import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProduct, listCategories, listTaxRates, getTenantCurrency } from "@/lib/productos/queries";
import { updateProductAction } from "@/app/(app)/operaciones/productos/actions";
import { ProductForm } from "@/components/productos/product-form";
import { FormHeader } from "@/components/shared/form-shell";
import { Page } from "@/components/shared/page";

export default async function EditarProductoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await createClient();
  const [p, categories, taxRates, currency] = await Promise.all([
    getProduct(sb, id), listCategories(sb), listTaxRates(sb), getTenantCurrency(sb),
  ]);
  if (!p) notFound();
  return (
    <Page>
      <FormHeader backHref={`/operaciones/productos/${p.id}`} backLabel={p.name} title="Editar producto"
        subtitle="El precio nuevo rige para las ventas que emitas desde ahora; las anteriores no cambian." />
      <ProductForm action={updateProductAction} categories={categories} taxRates={taxRates} currency={currency}
        submitLabel="Guardar cambios" cancelHref={`/operaciones/productos/${p.id}`}
        values={{ id: p.id, kind: p.kind, name: p.name, sku: p.sku ?? "", description: p.description ?? "",
          unit: p.unit ?? "unidad", categoryId: p.category_id ?? "",
          price: p.price != null ? String(p.price) : "0", cost: p.cost != null ? String(p.cost) : "",
          taxRateId: p.tax_rate_id ?? "", minStock: p.min_stock != null ? String(p.min_stock) : "0" }} />
    </Page>
  );
}
