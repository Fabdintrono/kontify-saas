import type { LucideIcon } from "lucide-react";
import {
  Home, Users, UserPlus, Package, BarChart3, Wallet, Percent, Landmark, Receipt, Settings, Building2, ShieldCheck, SlidersHorizontal, Tags,
} from "lucide-react";
import { canAccess, type Role, type Resource } from "@/lib/auth/roles";
import { MODULE_ICON } from "@/lib/module-icons";

export type NavLeaf = {
  label: string; href: string; icon: LucideIcon; resource?: Resource;
  /** La pantalla existe pero todavía no hace nada. Se marca en el menú para que
   *  nadie gaste un clic en averiguarlo. */
  pronto?: boolean;
};
export type NavSection = { id: string; label: string; icon: LucideIcon; resource: Resource; children: NavLeaf[] };

export const NAV: NavSection[] = [
  { id: "inicio", label: "Inicio", icon: Home, resource: "operaciones", children: [
    { label: "Dashboard", href: "/dashboard", icon: MODULE_ICON.dashboard },
    { label: "Notificaciones", href: "/notificaciones", icon: MODULE_ICON.notificaciones, pronto: true },
    { label: "Actividad", href: "/actividad", icon: MODULE_ICON.actividad, pronto: true },
  ]},
  { id: "clientes", label: "Clientes", icon: Users, resource: "clientes", children: [
    { label: "Todos los clientes", href: "/clientes", icon: MODULE_ICON.clientes },
    { label: "Nuevo cliente", href: "/clientes/nuevo", icon: UserPlus },
  ]},
  { id: "operaciones", label: "Operaciones", icon: Package, resource: "operaciones", children: [
    { label: "Productos", href: "/operaciones/productos", icon: MODULE_ICON.productos },
    { label: "Inventario", href: "/operaciones/inventario", icon: MODULE_ICON.inventario },
    { label: "Ventas", href: "/operaciones/facturacion", icon: MODULE_ICON.ventas },
    { label: "Presupuestos", href: "/operaciones/presupuestos", icon: MODULE_ICON.presupuestos },
  ]},
  { id: "reportes", label: "Reportes", icon: BarChart3, resource: "reportes", children: [
    { label: "Inventario", href: "/reportes/inventario", icon: MODULE_ICON.reportes_inventario },
    { label: "Ventas", href: "/reportes/ventas", icon: MODULE_ICON.reportes_ventas },
  ]},
  { id: "finanzas", label: "Finanzas", icon: Wallet, resource: "finanzas", children: [
    { label: "Cuentas por pagar", href: "/finanzas/cuentas-por-pagar", icon: MODULE_ICON.cuentas_por_pagar, pronto: true },
    { label: "Cuentas por cobrar", href: "/finanzas/cuentas-por-cobrar", icon: MODULE_ICON.cuentas_por_cobrar },
    { label: "Comisiones", href: "/finanzas/comisiones", icon: Percent, pronto: true },
    { label: "Bancos", href: "/finanzas/bancos", icon: Landmark, pronto: true },
    { label: "Gastos", href: "/finanzas/gastos", icon: Receipt, pronto: true },
  ]},
];

// Configuración vive abajo del riel. La sección es visible a todos (para el toggle de tema
// en Preferencias), pero Sucursales/Usuarios se gatean a owner/admin con resource "billing".
export const CONFIG_SECTION: NavSection = {
  id: "config", label: "Configuración", icon: Settings, resource: "operaciones", children: [
    { label: "Tipos de cliente", href: "/configuracion/tipos-de-cliente", icon: Tags, resource: "billing" },
    { label: "Categorías de producto", href: "/configuracion/categorias-de-producto", icon: Tags, resource: "billing" },
    { label: "Tasas de impuesto", href: "/configuracion/tasas-de-impuesto", icon: Percent, resource: "billing" },
    { label: "Sucursales", href: "/configuracion/sucursales", icon: Building2, resource: "billing", pronto: true },
    { label: "Usuarios y roles", href: "/configuracion/usuarios", icon: ShieldCheck, resource: "billing", pronto: true },
    { label: "Preferencias", href: "/configuracion/preferencias", icon: SlidersHorizontal },
  ],
};

const ALL_SECTIONS: NavSection[] = [...NAV, CONFIG_SECTION];

/** Filtra una sección y sus hijos por rol. Devuelve null si el rol no puede ver nada.
 *  Solo es UX (ocultar); la autorización real vive en RLS/endpoints. */
function filterSection(section: NavSection, role: Role): NavSection | null {
  if (!canAccess(role, section.resource)) return null;
  const children = section.children.filter((c) => !c.resource || canAccess(role, c.resource));
  return children.length ? { ...section, children } : null;
}

export function navForRole(role: Role): NavSection[] {
  return NAV.map((s) => filterSection(s, role)).filter((s): s is NavSection => s !== null);
}

export function configForRole(role: Role): NavSection | null {
  return filterSection(CONFIG_SECTION, role);
}

/** Sección nivel-1 activa derivada del pathname (o null). Gana el href más largo que casa. */
export function resolveActiveSection(pathname: string): NavSection | null {
  let best: { section: NavSection; len: number } | null = null;
  for (const section of ALL_SECTIONS) {
    for (const child of section.children) {
      if (pathname === child.href || pathname.startsWith(child.href + "/")) {
        if (!best || child.href.length > best.len) best = { section, len: child.href.length };
      }
    }
  }
  return best?.section ?? null;
}
