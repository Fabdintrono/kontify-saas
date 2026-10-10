"use server";
import { createClient } from "@/lib/supabase/server";

export type Hit = {
  kind: "cliente" | "producto" | "venta";
  id: string;
  title: string;
  subtitle: string;
  href: string;
};

// Mismo saneado que las listas: neutraliza lo que tiene significado en un filtro PostgREST.
function sanitize(term: string): string {
  return term.replace(/[%,()*]/g, " ").trim();
}

const LIMITE_POR_TIPO = 5;

/** Busca en lo que el usuario nombra a diario: clientes, productos y el número de una venta.
 *
 *  No lanza nunca: el buscador es un accesorio y un permiso denegado no debe romper la
 *  pantalla. Cada bloque degrada por separado, así un rol sin acceso a clientes sigue
 *  encontrando productos. Las políticas de la base son las que deciden qué se ve. */
export async function searchEverything(term: string): Promise<Hit[]> {
  const q = sanitize(term);
  if (q.length < 2) return [];
  const sb = await createClient();
  const like = `%${q}%`;
  const hits: Hit[] = [];

  try {
    const { data } = await sb.from("clients")
      .select("id, name, phone, email").eq("active", true)
      .or(`name.ilike.${like},phone.ilike.${like},email.ilike.${like},doc_id.ilike.${like}`)
      .order("name").limit(LIMITE_POR_TIPO);
    for (const c of (data ?? []) as any[]) {
      hits.push({ kind: "cliente", id: c.id, title: c.name, subtitle: c.phone || c.email || "Cliente", href: `/clientes/${c.id}` });
    }
  } catch { /* sin acceso a clientes: se omite el bloque */ }

  try {
    const { data } = await sb.from("products")
      .select("id, name, sku, price").eq("active", true)
      .or(`name.ilike.${like},sku.ilike.${like}`)
      .order("name").limit(LIMITE_POR_TIPO);
    for (const p of (data ?? []) as any[]) {
      hits.push({ kind: "producto", id: p.id, title: p.name, subtitle: p.sku || "Producto", href: `/operaciones/productos/${p.id}` });
    }
  } catch { /* sin acceso a productos */ }

  // Una venta se busca por su número, que es como la nombra todo el mundo.
  if (/^\d{1,9}$/.test(q)) {
    try {
      const { data } = await sb.from("sales")
        .select("id, number, total, currency, clients(name)")
        .eq("number", Number(q)).limit(1);
      for (const s of (data ?? []) as any[]) {
        hits.push({
          kind: "venta", id: s.id, title: `Venta #${s.number}`,
          subtitle: s.clients?.name ?? "Consumidor final",
          href: `/operaciones/facturacion/${s.id}`,
        });
      }
    } catch { /* sin acceso a ventas */ }
  }

  return hits;
}
