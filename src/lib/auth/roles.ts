export const ROLES = ["owner", "admin", "administrativo", "vendedor", "cajero", "almacen"] as const;
export type Role = (typeof ROLES)[number];

/** Recursos de alto nivel usados para gatear acceso. */
export type Resource = "billing" | "finanzas" | "caja" | "operaciones" | "reportes" | "clientes";

const BRANCH_SCOPED: Role[] = ["vendedor", "cajero", "almacen"];
export const isBranchScoped = (r: Role) => BRANCH_SCOPED.includes(r);

export function canAccess(role: Role, resource: Resource): boolean {
  if (role === "owner" || role === "admin") return true;
  if (role === "administrativo") {
    return ["finanzas", "operaciones", "reportes", "clientes"].includes(resource);
  }
  // operativos: acceso a operaciones/caja según corresponda (se refina por módulo)
  if (role === "cajero") return resource === "caja" || resource === "operaciones";
  if (role === "vendedor") return resource === "operaciones" || resource === "clientes";
  if (role === "almacen") return resource === "operaciones";
  return false;
}
