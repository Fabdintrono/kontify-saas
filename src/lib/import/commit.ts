import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizar } from "./sheet";
import type { FilaRevisada } from "./analyze";
import { getTenantSettings } from "@/lib/tenant";

export type Resultado = {
  insertados: number;
  /** Categorías o tipos que hubo que crear sobre la marcha. */
  creadas: string[];
  /** Filas que no entraron, con su número de línea y el motivo. */
  rechazadas: { linea: number; motivo: string }[];
};

const LOTE = 100;

/** Busca el id de un catálogo por nombre; si no está, lo crea.
 *  Devuelve un mapa nombre normalizado → id, y los nombres que tuvo que crear. */
async function resolverCatalogo(
  sb: SupabaseClient, tabla: "product_categories" | "client_types" | "expense_categories",
  tenantId: string, nombres: string[],
): Promise<{ porNombre: Map<string, string>; creadas: string[] }> {
  const porNombre = new Map<string, string>();
  const creadas: string[] = [];

  // Se deduplica por la forma normalizada: «Ferretería» y «ferreteria» son la misma
  // categoría y no pueden crearse dos veces. Gana la primera grafía que aparece.
  const pedidos = new Map<string, string>();
  for (const n of nombres) {
    const limpio = n.trim();
    if (limpio === "") continue;
    const k = normalizar(limpio);
    if (!pedidos.has(k)) pedidos.set(k, limpio);
  }

  const { data } = await sb.from(tabla).select("id, name");
  for (const r of (data ?? []) as { id: string; name: string }[]) porNombre.set(normalizar(r.name), r.id);

  const faltan = [...pedidos].filter(([k]) => !porNombre.has(k)).map(([, nombre]) => nombre);
  if (faltan.length > 0) {
    const { data: nuevas, error } = await sb.from(tabla)
      .insert(faltan.map((name) => ({ tenant_id: tenantId, name }))).select("id, name");
    if (error) throw error;
    for (const r of (nuevas ?? []) as { id: string; name: string }[]) {
      porNombre.set(normalizar(r.name), r.id);
      creadas.push(r.name);
    }
  }
  return { porNombre, creadas };
}

/** Inserta por lotes y cuenta lo que entró. Un lote que falle no tumba a los demás:
 *  se reintenta fila por fila para saber exactamente cuál dio problema. */
async function insertarPorLotes(
  sb: SupabaseClient, tabla: "products" | "clients" | "expenses",
  filas: { linea: number; row: Record<string, unknown> }[],
): Promise<{ insertados: number; rechazadas: { linea: number; motivo: string }[] }> {
  let insertados = 0;
  const rechazadas: { linea: number; motivo: string }[] = [];

  for (let i = 0; i < filas.length; i += LOTE) {
    const lote = filas.slice(i, i + LOTE);
    const { error } = await sb.from(tabla).insert(lote.map((f) => f.row));
    if (!error) { insertados += lote.length; continue; }

    // El lote falló: se reparte para que el usuario sepa qué fila exacta lo rompió
    // y para que las buenas del lote sí entren.
    for (const f of lote) {
      const { error: e } = await sb.from(tabla).insert(f.row);
      if (e) rechazadas.push({ linea: f.linea, motivo: e.message });
      else insertados++;
    }
  }
  return { insertados, rechazadas };
}

export async function importarProductos(
  sb: SupabaseClient, tenantId: string, userId: string, branchId: string | null, filas: FilaRevisada[],
): Promise<Resultado> {
  const { porNombre, creadas } = await resolverCatalogo(
    sb, "product_categories", tenantId,
    filas.map((f) => String(f.valores.category ?? "")),
  );

  const { data: tasa } = await sb.from("tax_rates")
    .select("id").eq("is_default", true).eq("active", true).maybeSingle();

  const payload = filas.map((f) => {
    const v = f.valores;
    const cat = v.category ? porNombre.get(normalizar(String(v.category))) ?? null : null;
    return {
      linea: f.linea,
      row: {
        tenant_id: tenantId, created_by: userId, created_branch_id: branchId,
        kind: (v.kind as string) ?? "good",
        name: v.name as string,
        sku: (v.sku as string) ?? null,
        description: (v.description as string) ?? null,
        category_id: cat,
        price: (v.price as number) ?? 0,
        cost: v.cost as number | null,
        tax_rate_id: tasa?.id ?? null,
        unit: (v.unit as string) ?? "unidad",
        min_stock: (v.minStock as number) ?? 0,
      },
    };
  });

  const { insertados, rechazadas } = await insertarPorLotes(sb, "products", payload);
  return { insertados, creadas, rechazadas };
}

export async function importarClientes(
  sb: SupabaseClient, tenantId: string, userId: string, branchId: string | null, filas: FilaRevisada[],
): Promise<Resultado> {
  const { porNombre, creadas } = await resolverCatalogo(
    sb, "client_types", tenantId,
    filas.map((f) => String(f.valores.type ?? "")),
  );

  const payload = filas.map((f) => {
    const v = f.valores;
    const tipo = v.type ? porNombre.get(normalizar(String(v.type))) ?? null : null;
    return {
      linea: f.linea,
      row: {
        tenant_id: tenantId, created_by: userId, created_branch_id: branchId,
        kind: (v.kind as string) ?? "person",
        name: v.name as string,
        doc_id: (v.docId as string) ?? null,
        email: (v.email as string) ?? null,
        phone: (v.phone as string) ?? null,
        address: (v.address as string) ?? null,
        contact_name: (v.contactName as string) ?? null,
        type_id: tipo,
        notes: (v.notes as string) ?? null,
      },
    };
  });

  const { insertados, rechazadas } = await insertarPorLotes(sb, "clients", payload);
  return { insertados, creadas, rechazadas };
}

export async function importarGastos(
  sb: SupabaseClient, tenantId: string, userId: string, branchId: string | null, filas: FilaRevisada[],
): Promise<Resultado> {
  const { porNombre, creadas } = await resolverCatalogo(
    sb, "expense_categories", tenantId,
    filas.map((f) => String(f.valores.category ?? "")),
  );

  // La moneda es la del negocio: un archivo no la trae y mezclarlas sin tipo de cambio
  // daría totales sin sentido.
  const { currency } = await getTenantSettings(sb);

  const payload = filas.map((f) => {
    const v = f.valores;
    const cat = v.category ? porNombre.get(normalizar(String(v.category))) ?? null : null;
    return {
      linea: f.linea,
      row: {
        tenant_id: tenantId, created_by: userId, branch_id: branchId,
        category_id: cat,
        description: v.description as string,
        amount: v.amount as number,
        currency,
        spent_on: v.spentOn as string,
        payment_method: (v.paymentMethod as string) ?? null,
        supplier: (v.supplier as string) ?? null,
        notes: (v.notes as string) ?? null,
      },
    };
  });

  const { insertados, rechazadas } = await insertarPorLotes(sb, "expenses", payload);
  return { insertados, creadas, rechazadas };
}
