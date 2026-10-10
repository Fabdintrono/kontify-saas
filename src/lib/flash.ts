// Avisos de éxito que sobreviven a un redirect: la acción redirige a `?flash=clave&arg=…`
// y <FlashToast> (cliente) los muestra y limpia la URL.
export type FlashKey =
  | "venta-emitida" | "venta-borrador" | "venta-borrador-eliminado" | "venta-anulada"
  | "cliente-creado" | "cliente-guardado" | "cliente-archivado" | "cliente-reactivado"
  | "producto-creado" | "producto-guardado" | "producto-archivado" | "producto-reactivado"
  | "presupuesto-enviado" | "presupuesto-borrador" | "presupuesto-eliminado" | "presupuesto-aceptado" | "presupuesto-rechazado" | "presupuesto-convertido"
  | "abono-registrado" | "abono-anulado" | "vencimiento-guardado" | "stock-ajustado";

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
};

export function withFlash(path: string, key: FlashKey, arg?: string | number | null): string {
  const sep = path.includes("?") ? "&" : "?";
  const a = arg == null || arg === "" ? "" : `&arg=${encodeURIComponent(String(arg))}`;
  return `${path}${sep}flash=${key}${a}`;
}

// El `arg` llega de la URL: solo se acepta un número corto (es un número de documento).
// Solo números (los correlativos de venta/presupuesto). Una serie con prefijo (p. ej. "A-0001")
// degradaría al texto sin número: ampliar aquí si llega ese caso.
const ARG_OK = /^\d{1,9}$/;

export function flashMessage(key: string, arg: string | null): { title: string; description?: string } | null {
  const fn = (MESSAGES as Record<string, (a: string | null) => { title: string; description?: string }>)[key];
  return fn ? fn(arg && ARG_OK.test(arg) ? arg : null) : null;
}

/** Para llamadas internas con clave conocida (sin `!`). */
export function flashFor(key: FlashKey, arg: string | number | null = null): { title: string; description?: string } {
  return MESSAGES[key](arg == null ? null : String(arg));
}
