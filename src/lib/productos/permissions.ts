import type { Role } from "@/lib/auth/roles";

const CRUD_ROLES: Role[] = ["owner", "admin", "administrativo", "almacen"];

export const canManageProducts = (role: Role): boolean => CRUD_ROLES.includes(role);
export const canArchiveProduct = (role: Role): boolean => role === "owner" || role === "admin";
export const canManageCategories = (role: Role): boolean => role === "owner" || role === "admin";
export const canManageTaxRates = (role: Role): boolean => role === "owner" || role === "admin";
