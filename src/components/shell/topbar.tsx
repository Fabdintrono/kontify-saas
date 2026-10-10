"use client";
import { PanelLeft, Store, Bell, LogOut, Settings } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { DropdownMenu, DropdownItem, DropdownLabel, DropdownSeparator } from "@/components/ui/dropdown-menu";
import { Popover } from "@/components/ui/popover";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { EmptyState } from "@/components/shared/empty-state";
import type { ShellUser } from "@/components/shell/types";

export function TopBar({ user, onToggle }: {
  user: ShellUser; onToggle: () => void;
}) {
  async function signOut() {
    await createClient().auth.signOut();
    window.location.href = "/login";
  }
  return (
    <header className="flex h-14 items-center gap-3 border-b border-[var(--border)] bg-[var(--surface)] px-4">
      <button onClick={onToggle} aria-label="Alternar panel"
        className="grid h-9 w-9 place-items-center rounded-lg text-[var(--text-soft)] hover:bg-[var(--bg)]">
        <PanelLeft className="h-5 w-5" strokeWidth={2} />
      </button>

      {/* Buscador global: vuelve cuando busque de verdad (ver auditoría UX, B4). */}
      <div className="flex-1" />

      {/* Selector de sucursal: hoy todo es consolidado; vuelve cuando filtre (Fase D). */}
      <span className="flex h-9 items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 text-sm text-[var(--text-soft)]">
        <Store className="h-4 w-4" strokeWidth={2} aria-hidden="true" /> Todas
      </span>

      <Popover trigger={
        <button aria-label="Notificaciones" className="relative grid h-9 w-9 place-items-center rounded-lg text-[var(--text-soft)] hover:bg-[var(--bg)]">
          <Bell className="h-5 w-5" strokeWidth={2} />
        </button>}>
        <p className="mb-2 text-sm font-bold text-[var(--text)]">Notificaciones</p>
        <EmptyState icon={Bell} title="Sin novedades" hint="Aquí verás alertas de stock, pagos y ventas." />
      </Popover>

      <DropdownMenu trigger={
        <button aria-label="Cuenta" className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-[#0e7490] to-[#14b8a6] text-sm font-bold text-white">
          {user.initial}
        </button>}>
        <DropdownLabel>{user.fullName || user.email}</DropdownLabel>
        <DropdownLabel>{user.roleLabel}</DropdownLabel>
        <DropdownSeparator />
        <div className="px-1"><ThemeToggle withLabel /></div>
        <DropdownItem><Link href="/configuracion/preferencias" className="flex items-center gap-2"><Settings className="h-4 w-4" /> Configuración</Link></DropdownItem>
        <DropdownSeparator />
        <DropdownItem onSelect={signOut}><LogOut className="h-4 w-4" /> Cerrar sesión</DropdownItem>
      </DropdownMenu>
    </header>
  );
}
