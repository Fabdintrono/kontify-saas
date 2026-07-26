import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProduct, listCategories, listTaxRates } from "@/lib/productos/queries";
import { updateProductAction } from "@/app/(app)/operaciones/productos/actions";
import { ProductForm } from "@/components/productos/product-form";

export default async function EditarProductoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await createClient();
  const [p, categories, taxRates] = await Promise.all([getProduct(sb, id), listCategories(sb), listTaxRates(sb)]);
  if (!p) notFound();
  return (
    <div className="p-6">
      <h1 className="mb-4 text-xl font-extrabold tracking-[-0.4px] text-[var(--text)]">Editar producto</h1>
      <ProductForm action={updateProductAction} categories={categories} taxRates={taxRates} submitLabel="Guardar cambios"
        values={{ id: p.id, kind: p.kind, name: p.name, sku: p.sku ?? "", description: p.description ?? "",
          unit: p.unit ?? "unidad", categoryId: p.category_id ?? "",
          price: p.price != null ? String(p.price) : "0", cost: p.cost != null ? String(p.cost) : "",
          taxRateId: p.tax_rate_id ?? "", minStock: p.min_stock != null ? String(p.min_stock) : "0" }} />
    </div>
  );
}
