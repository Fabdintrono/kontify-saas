"use client";
import Link from "next/link";
import { Store, Settings, FileText, BarChart3, Wallet, HelpCircle, LogOut } from "lucide-react";
import { Sheet } from "@/components/ui/sheet";
import { createClient } from "@/lib/supabase/client";
import type { ShellUser } from "@/components/shell/types";

const GROUPS = [
  { title: "Cuenta", items: [
    { label: "Cambiar sucursal", href: "/configuracion/sucursales", icon: Store },
    { label: "Configuración", href: "/configuracion/preferencias", icon: Settings },
  ]},
  { title: "Módulos", items: [
    { label: "Presupuestos", href: "/operaciones/presupuestos", icon: FileText },
    { label: "Reportes", href: "/reportes/inventario", icon: BarChart3 },
    { label: "Finanzas", href: "/finanzas/cuentas-por-cobrar", icon: Wallet },
  ]},
  { title: "Otros", items: [
    { label: "Ayuda", href: "/configuracion/preferencias", icon: HelpCircle },
  ]},
];

export function MobileMoreSheet({ open, onOpenChange, user }: {
  open: boolean; onOpenChange: (o: boolean) => void; user: ShellUser;
}) {
  async function signOut() { await createClient().auth.signOut(); window.location.href = "/login"; }
  return (
    <Sheet open={open} onOpenChange={onOpenChange} side="bottom" title="Más">
      <div className="mb-4 flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3">
        <div className="grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br from-[#0e7490] to-[#14b8a6] text-base font-bold text-white">{user.initial}</div>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-[var(--text)]">{user.fullName || user.email}</p>
          <p className="text-xs text-[var(--text-soft)]">{user.roleLabel}</p>
        </div>
        <Link href="/configuracion/preferencias" onClick={() => onOpenChange(false)} className="ml-auto text-xs font-semibold text-[#0e7490] dark:text-[#5eead4]">Ver perfil</Link>
      </div>
      {GROUPS.map((g) => (
        <div key={g.title} className="mb-4">
          <p className="mb-1 px-1 text-xs font-semibold text-[var(--text-soft)]">{g.title}</p>
          <ul className="space-y-1">
            {g.items.map((it) => {
              const Icon = it.icon;
              return (
                <li key={it.label}>
                  <Link href={it.href} onClick={() => onOpenChange(false)}
                    className="flex items-center gap-3 rounded-lg px-2.5 py-2.5 text-sm text-[var(--text)] hover:bg-[var(--bg)]">
                    <Icon className="h-4 w-4" strokeWidth={2} /> {it.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      <button onClick={signOut} className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2.5 text-sm font-semibold text-[#dc2626] hover:bg-[var(--bg)]">
        <LogOut className="h-4 w-4" strokeWidth={2} /> Cerrar sesión
      </button>
    </Sheet>
  );
}
