import type { Role } from "@/lib/auth/roles";

export const canArchiveClient = (role: Role): boolean => role === "owner" || role === "admin";
export const canManageClientTypes = (role: Role): boolean => role === "owner" || role === "admin";
