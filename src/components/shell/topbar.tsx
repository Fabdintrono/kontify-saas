"use client";
import { PanelLeft, Search, Store, Bell, ChevronDown, User, LogOut, Settings } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { DropdownMenu, DropdownItem, DropdownLabel, DropdownSeparator } from "@/components/ui/dropdown-menu";
import { Popover } from "@/components/ui/popover";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { EmptyState } from "@/components/shared/empty-state";
import type { ShellUser } from "@/components/shell/types";

export function TopBar({ user, branches, onToggle }: {
  user: ShellUser; branches: { id: string; name: string }[]; onToggle: () => void;
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

      <div className="flex h-9 w-full max-w-[330px] items-center gap-2 rounded-[9px] border border-[var(--border)] bg-[var(--bg)] px-[11px] text-[var(--text-soft)]">
        <Search className="h-[15px] w-[15px]" strokeWidth={2} />
        <input placeholder="Buscar productos, clientes, facturas…" className="w-full bg-transparent text-[12.5px] text-[var(--text)] outline-none placeholder:text-[var(--text-soft)]" />
      </div>

      <div className="flex-1" />

      <DropdownMenu trigger={
        <button className="flex h-9 items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 text-sm text-[var(--text)]">
          <Store className="h-4 w-4" strokeWidth={2} /> Todas <ChevronDown className="h-3.5 w-3.5" />
        </button>}>
        <DropdownLabel>Sucursal</DropdownLabel>
        <DropdownItem>Todas (consolidado)</DropdownItem>
        {branches.map((b) => <DropdownItem key={b.id}>{b.name}</DropdownItem>)}
      </DropdownMenu>

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
