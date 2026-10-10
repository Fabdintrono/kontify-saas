import type { Role } from "@/lib/auth/roles";

export type ShellUser = { email: string; fullName: string; initial: string; role: Role; roleLabel: string };
