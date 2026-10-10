"use client";
import { Suspense, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Store, Bell } from "lucide-react";
import { navForRole, configForRole } from "@/lib/nav";
import { Rail } from "@/components/shell/rail";
import { SubNav } from "@/components/shell/subnav";
import { TopBar } from "@/components/shell/topbar";
import { FabVender } from "@/components/shell/fab-vender";
import { MobileBottomNav } from "@/components/shell/mobile-bottom-nav";
import { Popover } from "@/components/ui/popover";
import { EmptyState } from "@/components/shared/empty-state";
import { ToastProvider } from "@/components/ui/toast";
import { FlashToast } from "@/components/shell/flash-toast";
import type { ShellUser } from "@/components/shell/types";

export type { ShellUser } from "@/components/shell/types";

const COLLAPSE_KEY = "kontify-panel-collapsed";

export function AppShell({ user, children }: {
  user: ShellUser; children: ReactNode;
}) {
  const pathname = usePathname();
  const sections = navForRole(user.role);
  const config = configForRole(user.role);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => { setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1"); }, []);
  function toggle() {
    setCollapsed((c) => { const n = !c; localStorage.setItem(COLLAPSE_KEY, n ? "1" : "0"); return n; });
  }

  return (
    <ToastProvider>
      <Suspense fallback={null}><FlashToast /></Suspense>
      <div className="flex h-screen overflow-hidden bg-[var(--bg)]">
        {/* Escritorio: dual-tier */}
        <div className="hidden lg:flex"><Rail sections={sections} config={config} /></div>
        <div className="hidden lg:block"><SubNav sections={sections} config={config} collapsed={collapsed} /></div>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="hidden lg:block"><TopBar user={user} onToggle={toggle} /></div>

          {/* Top bar móvil: selector de sucursal + campana (design-system §6, sin avatar) */}
          <div className="flex h-14 items-center justify-between gap-2 border-b border-[var(--border)] bg-[var(--surface)] px-4 lg:hidden">
            {/* Selector de sucursal: hoy todo es consolidado; vuelve cuando filtre (Fase D). */}
            <span className="flex h-9 items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 text-sm text-[var(--text-soft)]">
              <Store className="h-4 w-4" strokeWidth={2} aria-hidden="true" /> Todas
            </span>
            <Popover trigger={
              <button aria-label="Notificaciones" className="grid h-9 w-9 place-items-center rounded-lg text-[var(--text-soft)] hover:bg-[var(--bg)]">
                <Bell className="h-5 w-5" strokeWidth={2} />
              </button>}>
              <p className="mb-2 text-sm font-bold text-[var(--text)]">Notificaciones</p>
              <EmptyState icon={Bell} title="Sin novedades" hint="Aquí verás alertas de stock, pagos y ventas." />
            </Popover>
          </div>

          {/* tabIndex={-1}: destino de foco cuando un diálogo se cierra y su disparador ya no existe
              (p. ej. archivar, que reemplaza el botón por «Reactivar»). Ver ConfirmDialog. */}
          {/* `key={pathname}`: cada ruta monta de nuevo y entra con un fundido corto.
              Es el único elemento animado de la vista. */}
          <main tabIndex={-1} className="flex-1 overflow-y-auto pb-20 outline-none lg:pb-0">
            <div key={pathname} className="animate-fade-up">{children}</div>
          </main>
        </div>

        <FabVender />
        <MobileBottomNav user={user} />
      </div>
    </ToastProvider>
  );
}
