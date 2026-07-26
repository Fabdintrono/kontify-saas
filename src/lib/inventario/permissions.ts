import type { Role } from "@/lib/auth/roles";

const MANAGE: Role[] = ["owner", "admin", "administrativo", "almacen"];
export const canManageStock = (role: Role): boolean => MANAGE.includes(role);
