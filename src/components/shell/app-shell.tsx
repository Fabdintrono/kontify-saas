"use client";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Store, Bell, ChevronDown } from "lucide-react";
import { navForRole, configForRole } from "@/lib/nav";
import { Rail } from "@/components/shell/rail";
import { SubNav } from "@/components/shell/subnav";
import { TopBar } from "@/components/shell/topbar";
import { FabVender } from "@/components/shell/fab-vender";
import { MobileBottomNav } from "@/components/shell/mobile-bottom-nav";
import { DropdownMenu, DropdownItem, DropdownLabel } from "@/components/ui/dropdown-menu";
import { Popover } from "@/components/ui/popover";
import { EmptyState } from "@/components/shared/empty-state";
import type { ShellUser, ShellBranch } from "@/components/shell/types";

export type { ShellUser, ShellBranch } from "@/components/shell/types";

const COLLAPSE_KEY = "kontify-panel-collapsed";

export function AppShell({ user, branches, children }: {
  user: ShellUser; branches: ShellBranch[]; children: ReactNode;
}) {
  const sections = navForRole(user.role);
  const config = configForRole(user.role);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => { setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1"); }, []);
  function toggle() {
    setCollapsed((c) => { const n = !c; localStorage.setItem(COLLAPSE_KEY, n ? "1" : "0"); return n; });
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--bg)]">
      {/* Escritorio: dual-tier */}
      <div className="hidden lg:flex"><Rail sections={sections} config={config} /></div>
      <div className="hidden lg:block"><SubNav sections={sections} config={config} collapsed={collapsed} /></div>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="hidden lg:block"><TopBar user={user} branches={branches} onToggle={toggle} /></div>

        {/* Top bar móvil: selector de sucursal + campana (design-system §6, sin avatar) */}
        <div className="flex h-14 items-center justify-between gap-2 border-b border-[var(--border)] bg-[var(--surface)] px-4 lg:hidden">
          <DropdownMenu align="start" trigger={
            <button className="flex h-9 items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2.5 text-sm text-[var(--text)]">
              <Store className="h-4 w-4" strokeWidth={2} /> Todas <ChevronDown className="h-3.5 w-3.5" />
            </button>}>
            <DropdownLabel>Sucursal</DropdownLabel>
            <DropdownItem>Todas (consolidado)</DropdownItem>
            {branches.map((b) => <DropdownItem key={b.id}>{b.name}</DropdownItem>)}
          </DropdownMenu>
          <Popover trigger={
            <button aria-label="Notificaciones" className="grid h-9 w-9 place-items-center rounded-lg text-[var(--text-soft)] hover:bg-[var(--bg)]">
              <Bell className="h-5 w-5" strokeWidth={2} />
            </button>}>
            <p className="mb-2 text-sm font-bold text-[var(--text)]">Notificaciones</p>
            <EmptyState icon={Bell} title="Sin novedades" hint="Aquí verás alertas de stock, pagos y ventas." />
          </Popover>
        </div>

        <main className="flex-1 overflow-y-auto pb-20 lg:pb-0">{children}</main>
      </div>

      <FabVender />
      <MobileBottomNav user={user} />
    </div>
  );
}
