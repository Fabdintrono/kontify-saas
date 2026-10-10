"use client";
import { PanelLeft, Bell, LogOut, Settings, Search, Keyboard, Plus } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { DropdownMenu, DropdownItem, DropdownLabel, DropdownSeparator } from "@/components/ui/dropdown-menu";
import { Popover } from "@/components/ui/popover";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { buttonCls } from "@/components/ui/button";
import { canSell } from "@/lib/ventas/permissions";
import { EmptyState } from "@/components/shared/empty-state";
import type { ShellUser } from "@/components/shell/types";

export function TopBar({ user, onToggle, onSearch }: {
  user: ShellUser; onToggle: () => void; onSearch: () => void;
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

      {/* El buscador es un botón, no un campo: lo que abre es el buscador completo,
          con teclado y resultados agrupados. Un campo aquí prometería otra cosa. */}
      <button type="button" onClick={onSearch}
        className="flex h-9 w-full max-w-md items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 text-sm text-[var(--text-soft)] transition-colors hover:border-[var(--text-soft)]/40 active:scale-[0.99]">
        <Search className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden="true" />
        <span className="truncate">Buscar un cliente, un producto o una venta</span>
        <kbd className="ml-auto hidden shrink-0 items-center gap-0.5 rounded border border-[var(--border)] px-1.5 py-0.5 font-mono text-[10px] xl:flex">Ctrl K</kbd>
      </button>

      <div className="flex-1" />

      {/* Vender está siempre a un clic, en cualquier pantalla: es la acción que se repite
          todo el día y no debería obligar a volver al módulo de Ventas. */}
      {canSell(user.role) && (
        <Link href="/operaciones/facturacion/nueva" className={buttonCls("primary", "h-9")}>
          <Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" /> Nueva venta
        </Link>
      )}

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
        <DropdownItem onSelect={() => {
          // El panel de atajos escucha la tecla «?» en toda la app; aquí se simula para
          // quien lo busca con el ratón y no sabe que existe el atajo.
          window.dispatchEvent(new KeyboardEvent("keydown", { key: "?", bubbles: true }));
        }}><Keyboard className="h-4 w-4" /> Atajos de teclado</DropdownItem>
        <DropdownSeparator />
        <DropdownItem onSelect={signOut}><LogOut className="h-4 w-4" /> Cerrar sesión</DropdownItem>
      </DropdownMenu>
    </header>
  );
}
