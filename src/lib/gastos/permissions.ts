import type { Role } from "@/lib/auth/roles";

/** Los gastos son del back-office. Un vendedor o un cajero no tienen por qué saber
 *  cuánto cuesta el alquiler, y la política de la base dice lo mismo. */
const BACK_OFFICE: Role[] = ["owner", "admin", "administrativo"];

export const canSeeExpenses = (role: Role): boolean => BACK_OFFICE.includes(role);
export const canManageExpenses = (role: Role): boolean => BACK_OFFICE.includes(role);
/** Borrar y desactivar categorías se queda en dueño y administrador. */
export const canDeleteExpense = (role: Role): boolean => role === "owner" || role === "admin";
export const canManageExpenseCategories = (role: Role): boolean => role === "owner" || role === "admin";
