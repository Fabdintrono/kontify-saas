// Avisos de éxito que sobreviven a un redirect: la acción redirige a `?flash=clave&arg=…`
// y <FlashToast> (cliente) los muestra y limpia la URL.
export type FlashKey =
  | "venta-emitida" | "venta-borrador" | "venta-borrador-eliminado" | "venta-anulada"
  | "cliente-creado" | "cliente-guardado" | "cliente-archivado" | "cliente-reactivado"
  | "producto-creado" | "producto-guardado" | "producto-archivado" | "producto-reactivado"
  | "presupuesto-enviado" | "presupuesto-borrador" | "presupuesto-eliminado" | "presupuesto-aceptado" | "presupuesto-rechazado" | "presupuesto-convertido"
  | "abono-registrado" | "abono-anulado" | "vencimiento-guardado" | "stock-ajustado"
  | "gasto-registrado" | "gasto-guardado" | "gasto-eliminado"
  | "fijo-creado" | "fijo-guardado" | "fijo-pagado" | "fijo-pausado" | "fijo-reactivado" | "fijo-eliminado"
  | "primeros-pasos-ocultos";

const MESSAGES: Record<FlashKey, (arg: string | null) => { title: string; description?: string }> = {
  "venta-emitida": (n) => ({ title: `Venta${n ? ` #${n}` : ""} emitida`, description: "Se asignó el número y se descontó el stock." }),
  "venta-borrador": () => ({ title: "Borrador guardado", description: "No descuenta stock ni toma número hasta que la emitas." }),
  "venta-borrador-eliminado": () => ({ title: "Borrador eliminado" }),
  "venta-anulada": (n) => ({ title: `Venta${n ? ` #${n}` : ""} anulada`, description: "El stock volvió al inventario." }),
  "cliente-creado": () => ({ title: "Cliente creado" }),
  "cliente-guardado": () => ({ title: "Cambios guardados" }),
  "cliente-archivado": () => ({ title: "Cliente archivado", description: "Ya no aparece en las listas; su historial se conserva." }),
  "cliente-reactivado": () => ({ title: "Cliente reactivado" }),
  "producto-creado": () => ({ title: "Producto creado", description: "Carga sus existencias en Inventario cuando quieras." }),
  "producto-guardado": () => ({ title: "Cambios guardados" }),
  "producto-archivado": () => ({ title: "Producto archivado", description: "Ya no aparece para vender; su historial se conserva." }),
  "producto-reactivado": () => ({ title: "Producto reactivado" }),
  "presupuesto-enviado": (n) => ({ title: `Presupuesto${n ? ` #${n}` : ""} enviado` }),
  "presupuesto-borrador": () => ({ title: "Borrador guardado" }),
  "presupuesto-eliminado": () => ({ title: "Presupuesto eliminado" }),
  "presupuesto-aceptado": () => ({ title: "Presupuesto marcado como aceptado" }),
  "presupuesto-rechazado": () => ({ title: "Presupuesto marcado como rechazado" }),
  "presupuesto-convertido": () => ({ title: "Presupuesto convertido en venta", description: "Revisa la venta y emítela cuando esté lista." }),
  "abono-registrado": () => ({ title: "Abono registrado" }),
  "abono-anulado": () => ({ title: "Abono anulado", description: "El saldo de la venta se restauró." }),
  "vencimiento-guardado": () => ({ title: "Vencimiento guardado" }),
  "stock-ajustado": () => ({ title: "Existencias actualizadas" }),
  "gasto-registrado": () => ({ title: "Gasto registrado", description: "Ya cuenta en la utilidad neta del mes." }),
  "gasto-guardado": () => ({ title: "Cambios guardados" }),
  "gasto-eliminado": () => ({ title: "Gasto eliminado", description: "Deja de restar en la utilidad." }),
  "fijo-creado": () => ({ title: "Gasto fijo creado", description: "Te avisaremos cuando se acerque la fecha." }),
  "fijo-guardado": () => ({ title: "Cambios guardados" }),
  "fijo-pagado": (f) => ({
    title: "Pago registrado",
    description: f && /^\d{4}-\d{2}-\d{2}$/.test(f)
      ? `El próximo vence el ${f.slice(8, 10)}/${f.slice(5, 7)}/${f.slice(0, 4)}.`
      : "El gasto fijo avanzó a su próxima fecha.",
  }),
  "fijo-pausado": () => ({ title: "Gasto fijo pausado", description: "Deja de avisarte; puedes reactivarlo cuando quieras." }),
  "fijo-reactivado": () => ({ title: "Gasto fijo reactivado" }),
  "fijo-eliminado": () => ({ title: "Gasto fijo eliminado", description: "Los pagos ya registrados se conservan." }),
  "primeros-pasos-ocultos": () => ({ title: "Primeros pasos ocultos", description: "Puedes seguir usando la guía «¿Cómo funciona?» de cada módulo." }),
};

export function withFlash(path: string, key: FlashKey, arg?: string | number | null): string {
  const sep = path.includes("?") ? "&" : "?";
  const a = arg == null || arg === "" ? "" : `&arg=${encodeURIComponent(String(arg))}`;
  return `${path}${sep}flash=${key}${a}`;
}

// El `arg` llega de la URL, así que se acepta solo lo que de verdad se usa: un número
// corto (los correlativos de venta y presupuesto) o una fecha «YYYY-MM-DD» (el próximo
// vencimiento de un gasto fijo). Cualquier otra cosa se descarta y el aviso sale sin dato.
// Una serie con prefijo (p. ej. "A-0001") degradaría así: ampliar aquí si llega ese caso.
const ARG_OK = /^(\d{1,9}|\d{4}-\d{2}-\d{2})$/;

export function flashMessage(key: string, arg: string | null): { title: string; description?: string } | null {
  const fn = (MESSAGES as Record<string, (a: string | null) => { title: string; description?: string }>)[key];
  return fn ? fn(arg && ARG_OK.test(arg) ? arg : null) : null;
}

/** Para llamadas internas con clave conocida (sin `!`). */
export function flashFor(key: FlashKey, arg: string | number | null = null): { title: string; description?: string } {
  return MESSAGES[key](arg == null ? null : String(arg));
}
