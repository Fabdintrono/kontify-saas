import type { Role } from "@/lib/auth/roles";

const BACK_OFFICE: Role[] = ["owner", "admin", "administrativo"];

export const canRegisterPayment = (role: Role): boolean => BACK_OFFICE.includes(role);
export const canEditDueDate = (role: Role): boolean => BACK_OFFICE.includes(role);
export const canVoidPayment = (role: Role): boolean => role === "owner" || role === "admin";
