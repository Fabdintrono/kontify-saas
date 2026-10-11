"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient as serverSupabase } from "@/lib/supabase/server";
import { leerHoja, normalizar, EXTENSIONES, TAMANO_MAXIMO } from "@/lib/import/sheet";
import { mapear, type Mapeo } from "@/lib/import/columns";
import { revisar, revalidar, type Revision } from "@/lib/import/analyze";
import { importarProductos, importarClientes, type Resultado } from "@/lib/import/commit";
import { COLUMNAS, ENTIDADES, type Entidad } from "@/lib/import/entities";
import { canManageProducts } from "@/lib/productos/permissions";
import { canAccess, type Role } from "@/lib/auth/roles";
import { GENERIC_ERROR } from "@/lib/action-result";

export type RevisionResult = { ok: true; revision: Revision } | { ok: false; error: string };
export type ImportResult = { ok: true; resultado: Resultado } | { ok: false; error: string };

async function ctx() {
  const sb = await serverSupabase();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");
  const { data: mem } = await sb.from("memberships").select("role, branch_id").eq("user_id", user.id).single();
  const { data: tenantId } = await sb.rpc("current_tenant_id");
  return {
    sb, userId: user.id, branchId: (mem?.branch_id ?? null) as string | null,
    role: (mem?.role ?? "vendedor") as Role, tenantId: tenantId as string,
  };
}

function puede(role: Role, entidad: Entidad): boolean {
  return entidad === "productos" ? canManageProducts(role) : canAccess(role, "clientes");
}

function esEntidad(v: unknown): v is Entidad {
  return typeof v === "string" && (ENTIDADES as readonly string[]).includes(v);
}

/** Claves que ya están guardadas, para avisar del duplicado antes de escribir nada. */
async function clavesExistentes(sb: Awaited<ReturnType<typeof ctx>>["sb"], entidad: Entidad): Promise<Set<string>> {
  const tabla = entidad === "productos" ? "products" : "clients";
  const campo = entidad === "productos" ? "sku" : "doc_id";
  const { data } = await sb.from(tabla).select(campo).not(campo, "is", null);
  return new Set((data ?? []).map((r: any) => normalizar(String(r[campo]))).filter(Boolean));
}

/** Lee el archivo y devuelve la revisión. No escribe nada en la base. */
export async function revisarArchivo(fd: FormData): Promise<RevisionResult> {
  const entidad = fd.get("entidad");
  if (!esEntidad(entidad)) return { ok: false, error: "No sé qué se está importando." };

  const { sb, role } = await ctx();
  if (!puede(role, entidad)) return { ok: false, error: "Tu rol no puede importar aquí." };

  const archivo = fd.get("archivo");
  if (!(archivo instanceof File) || archivo.size === 0) return { ok: false, error: "Elige un archivo." };
  if (archivo.size > TAMANO_MAXIMO) return { ok: false, error: "El archivo pesa más de 5 MB. Divídelo en varios." };

  const nombre = archivo.name.toLowerCase();
  if (!EXTENSIONES.some((e) => nombre.endsWith(e))) {
    return { ok: false, error: `Solo se admiten archivos ${EXTENSIONES.join(", ")}. Desde Excel, «Guardar como».` };
  }

  const columnas = COLUMNAS[entidad];
  try {
    const bytes = Buffer.from(await archivo.arrayBuffer());
    const hoja = leerHoja(bytes, archivo.name);
    const mapeoPropuesto = fd.get("mapeo");
    const mapeo: Mapeo = typeof mapeoPropuesto === "string" && mapeoPropuesto
      ? JSON.parse(mapeoPropuesto)
      : mapear(hoja.cabeceras, columnas);

    const revision = revisar({
      entidad, columnas, cabeceras: hoja.cabeceras, filas: hoja.filas, mapeo,
      existentes: await clavesExistentes(sb, entidad),
    });
    return { ok: true, revision };
  } catch (e) {
    // Los errores de lectura están escritos para el usuario; los demás, no.
    const msg = e instanceof Error ? e.message : "";
    return { ok: false, error: msg && msg.length < 200 ? msg : GENERIC_ERROR };
  }
}

/** Guarda las filas que vienen sin errores. Las que fallen en la base se devuelven
 *  con su número de línea: nunca se pierde la cuenta de lo que entró y lo que no. */
export async function confirmarImportacion(entidad: Entidad, revision: Revision): Promise<ImportResult> {
  if (!esEntidad(entidad)) return { ok: false, error: "No sé qué se está importando." };
  const { sb, userId, branchId, tenantId, role } = await ctx();
  if (!puede(role, entidad)) return { ok: false, error: "Tu rol no puede importar aquí." };
  if (revision.faltantes.length > 0) {
    return { ok: false, error: `Falta la columna ${revision.faltantes.join(", ")}.` };
  }

  // La revisión llega del navegador: se vuelve a validar aquí antes de escribir nada.
  const { buenas, rechazadas } = revalidar({
    entidad, columnas: COLUMNAS[entidad],
    filas: revision.filas.filter((f) => f.errores.length === 0),
    existentes: await clavesExistentes(sb, entidad),
  });
  if (buenas.length === 0) return { ok: false, error: "No hay ninguna fila válida que guardar." };

  try {
    const importar = entidad === "productos" ? importarProductos : importarClientes;
    const resultado = await importar(sb, tenantId, userId, branchId, buenas);
    resultado.rechazadas = [...rechazadas, ...resultado.rechazadas].sort((a, b) => a.linea - b.linea);
    revalidatePath(entidad === "productos" ? "/operaciones/productos" : "/clientes");
    revalidatePath("/dashboard");
    return { ok: true, resultado };
  } catch (e) {
    console.error("confirmarImportacion", e);
    return { ok: false, error: GENERIC_ERROR };
  }
}

