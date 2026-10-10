import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard, Users, Package, Boxes, ShoppingCart, FileText,
  TrendingUp, ArrowDownCircle, ArrowUpCircle, Settings, Bell, Activity,
} from "lucide-react";

/** Un icono por módulo, el mismo en el riel, el subnav, el nav móvil y los estados vacíos.
 *  Antes Ventas era un documento en escritorio y un carrito en teléfono, y compartía
 *  familia de icono con Presupuestos. */
export const MODULE_ICON = {
  dashboard: LayoutDashboard,
  notificaciones: Bell,
  actividad: Activity,
  clientes: Users,
  productos: Package,
  inventario: Boxes,
  ventas: ShoppingCart,
  presupuestos: FileText,
  reportes_ventas: TrendingUp,
  reportes_inventario: Boxes,
  cuentas_por_cobrar: ArrowDownCircle,
  cuentas_por_pagar: ArrowUpCircle,
  configuracion: Settings,
} as const satisfies Record<string, LucideIcon>;

export type ModuleIconId = keyof typeof MODULE_ICON;
