import { headers } from "next/headers";

/** Slug del tenant resuelto por el proxy desde el subdominio (o "" en el dominio raíz). */
export async function getTenantSlug(): Promise<string> {
  const h = await headers();
  return h.get("x-tenant-slug") ?? "";
}
