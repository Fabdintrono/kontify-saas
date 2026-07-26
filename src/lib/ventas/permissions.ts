import type { Role } from "@/lib/auth/roles";

const SELL_ROLES: Role[] = ["owner", "admin", "administrativo", "vendedor", "cajero"];

export const canSell = (role: Role): boolean => SELL_ROLES.includes(role);
export const canVoidSale = (role: Role): boolean => role === "owner" || role === "admin";
