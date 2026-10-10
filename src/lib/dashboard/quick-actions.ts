import type { LucideIcon } from "lucide-react";
import { ShoppingCart, Package, Users, Boxes, FileText, ArrowDownCircle } from "lucide-react";
import { canAccess, type Role } from "@/lib/auth/roles";
import { canSell } from "@/lib/ventas/permissions";
import { canManageProducts } from "@/lib/productos/permissions";
import { canManageStock } from "@/lib/inventario/permissions";
import { canRegisterPayment } from "@/lib/cobros/permissions";

export type QuickAction = {
  key: string;
  label: string;
  /** Qué resuelve, en una línea. Lo lee quien nunca ha usado un sistema así. */
  hint: string;
  href: string;
  icon: LucideIcon;
  /** Tecla única que lleva ahí desde cualquier pantalla. */
  shortcut: string;
  allowed: (role: Role) => boolean;
};

/** Accesos rápidos del inicio. Son las seis cosas que de verdad se hacen a diario;
 *  el resto vive en el menú. Cada uno trae su tecla, que funciona en toda la app. */
export const QUICK_ACTIONS: QuickAction[] = [
  {
    key: "venta", label: "Nueva venta", hint: "Cobra y descuenta stock",
    href: "/operaciones/facturacion/nueva", icon: ShoppingCart, shortcut: "V",
    allowed: canSell,
  },
  {
    key: "producto", label: "Nuevo producto", hint: "Añade algo a tu catálogo",
    href: "/operaciones/productos/nuevo", icon: Package, shortcut: "P",
    allowed: canManageProducts,
  },
  {
    key: "cliente", label: "Nuevo cliente", hint: "Guarda a quién le vendes",
    href: "/clientes/nuevo", icon: Users, shortcut: "C",
    allowed: (r) => canAccess(r, "clientes"),
  },
  {
    key: "stock", label: "Ajustar stock", hint: "Corrige la existencia real",
    href: "/operaciones/inventario", icon: Boxes, shortcut: "I",
    allowed: canManageStock,
  },
  {
    key: "cobrar", label: "Cobrar", hint: "Registra un abono de un cliente",
    href: "/finanzas/cuentas-por-cobrar", icon: ArrowDownCircle, shortcut: "B",
    allowed: canRegisterPayment,
  },
  {
    key: "presupuesto", label: "Nuevo presupuesto", hint: "Cotiza sin tocar inventario",
    href: "/operaciones/presupuestos/nueva", icon: FileText, shortcut: "U",
    allowed: canSell,
  },
];

export function quickActionsFor(role: Role): QuickAction[] {
  return QUICK_ACTIONS.filter((a) => a.allowed(role));
}
