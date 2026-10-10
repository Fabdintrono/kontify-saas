// Ayudas cortas por campo (1-2 líneas). Un «?» junto a la etiqueta las muestra en un popover.
export const FIELD_HELP = {
  tipoRegistro: "Persona natural o empresa. Solo cambia qué datos tienen sentido (p. ej. razón social).",
  documentoId: "Cédula, RIF, NIT o el documento fiscal de tu país. Opcional, pero útil para buscar y para tus facturas.",
  tipoCliente: "Etiqueta para agrupar clientes (Mayorista, Minorista…). Se usa en filtros y en «Clientes por tipo».",
  sku: "Código corto y único del producto (p. ej. AGU-15). Sirve para buscar rápido. Opcional.",
  unidad: "Cómo se cuenta: unidad, caja, kg, litro… Es solo un texto que se muestra al vender.",
  costo: "Lo que te cuesta a ti. Vendedores y cajeros no lo ven; sirve para calcular la utilidad.",
  stockMinimo: "Por debajo de esta existencia el inicio te avisa «bajo». Déjalo en 0 si no quieres alertas.",
  impuesto: "Tasa que se aplica al vender este producto. Se puede cambiar línea por línea en la venta.",
  sucursal: "Sede donde se registra la operación. Afecta el stock que se descuenta y los reportes por sucursal.",
  descuentoGlobal: "Porcentaje que se aplica a toda la venta, prorrateado antes del impuesto. Los descuentos por línea van en cada fila.",
  metodoPago: "Texto libre para recordar cómo pagó (efectivo, transferencia, pago móvil…). Opcional.",
  vencimiento: "Fecha límite de pago de una venta a crédito. Pasada esa fecha, la venta aparece como «Vencida».",
  validoHasta: "Hasta cuándo mantienes el precio cotizado. Pasada la fecha, el presupuesto se marca «vencido» (no se bloquea).",
} as const;
export type FieldHelpKey = keyof typeof FIELD_HELP;
