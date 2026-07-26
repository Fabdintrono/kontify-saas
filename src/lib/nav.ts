import type { LucideIcon } from "lucide-react";
import {
  Home, LayoutDashboard, Bell, Activity, Users, UserPlus, Package, FileText,
  ClipboardList, BarChart3, Boxes, TrendingUp, Wallet, ArrowUpCircle, ArrowDownCircle,
  Percent, Landmark, Receipt, Settings, Building2, ShieldCheck, SlidersHorizontal, Tags,
} from "lucide-react";
import { canAccess, type Role, type Resource } from "@/lib/auth/roles";

export type NavLeaf = { label: string; href: string; icon: LucideIcon; resource?: Resource };
export type NavSection = { id: string; label: string; icon: LucideIcon; resource: Resource; children: NavLeaf[] };

export const NAV: NavSection[] = [
  { id: "inicio", label: "Inicio", icon: Home, resource: "operaciones", children: [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { label: "Notificaciones", href: "/notificaciones", icon: Bell },
    { label: "Actividad", href: "/actividad", icon: Activity },
  ]},
  { id: "clientes", label: "Clientes", icon: Users, resource: "clientes", children: [
    { label: "Todos los clientes", href: "/clientes", icon: Users },
    { label: "Nuevo cliente", href: "/clientes/nuevo", icon: UserPlus },
  ]},
  { id: "operaciones", label: "Operaciones", icon: Package, resource: "operaciones", children: [
    { label: "Productos", href: "/operaciones/productos", icon: Package },
    { label: "Inventario", href: "/operaciones/inventario", icon: Boxes },
    { label: "Facturación", href: "/operaciones/facturacion", icon: FileText },
    { label: "Presupuestos", href: "/operaciones/presupuestos", icon: ClipboardList },
  ]},
  { id: "reportes", label: "Reportes", icon: BarChart3, resource: "reportes", children: [
    { label: "Inventario", href: "/reportes/inventario", icon: Boxes },
    { label: "Ventas", href: "/reportes/ventas", icon: TrendingUp },
  ]},
  { id: "finanzas", label: "Finanzas", icon: Wallet, resource: "finanzas", children: [
    { label: "Cuentas por pagar", href: "/finanzas/cuentas-por-pagar", icon: ArrowUpCircle },
    { label: "Cuentas por cobrar", href: "/finanzas/cuentas-por-cobrar", icon: ArrowDownCircle },
    { label: "Comisiones", href: "/finanzas/comisiones", icon: Percent },
    { label: "Bancos", href: "/finanzas/bancos", icon: Landmark },
    { label: "Gastos", href: "/finanzas/gastos", icon: Receipt },
  ]},
];

// Configuración vive abajo del riel. La sección es visible a todos (para el toggle de tema
// en Preferencias), pero Sucursales/Usuarios se gatean a owner/admin con resource "billing".
export const CONFIG_SECTION: NavSection = {
  id: "config", label: "Configuración", icon: Settings, resource: "operaciones", children: [
    { label: "Tipos de cliente", href: "/configuracion/tipos-de-cliente", icon: Tags, resource: "billing" },
    { label: "Categorías de producto", href: "/configuracion/categorias-de-producto", icon: Tags, resource: "billing" },
    { label: "Tasas de impuesto", href: "/configuracion/tasas-de-impuesto", icon: Percent, resource: "billing" },
    { label: "Sucursales", href: "/configuracion/sucursales", icon: Building2, resource: "billing" },
    { label: "Usuarios y roles", href: "/configuracion/usuarios", icon: ShieldCheck, resource: "billing" },
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
