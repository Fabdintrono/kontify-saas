// Textos de ayuda por módulo (aprobados en la auditoría UX 2026-10-10, spec §4.2).
// Un solo sitio para corregir copy. Sin emojis; español neutro.

export const MODULE_IDS = [
  "dashboard", "clientes", "productos", "inventario", "ventas", "presupuestos",
  "cuentas_por_cobrar", "reportes_ventas", "reportes_inventario",
  "config_tipos_cliente", "config_categorias", "config_tasas", "config_preferencias",
] as const;
export type ModuleId = (typeof MODULE_IDS)[number];

export type Guide = {
  title: string;
  /** Una línea bajo el título: qué es este módulo. */
  subtitle: string;
  /** Pasos numerados del panel «¿Cómo funciona?». Vacío = sin panel. */
  steps: string[];
  /** «Lo que NO hace», para evitar expectativas equivocadas. */
  notDoes?: string[];
};

export const GUIDES: Record<ModuleId, Guide> = {
  dashboard: {
    title: "Inicio",
    subtitle: "Lo importante de tu negocio en un vistazo: ventas y utilidad del mes, clientes, inventario y lo que requiere atención.",
    steps: [
      "Los indicadores de arriba resumen el mes en curso de toda la empresa.",
      "«Requieren atención» lista ventas vencidas y productos agotados o bajo mínimo; cada fila lleva al detalle.",
      "El selector de sucursal (arriba) cambia entre una sede y el consolidado.",
    ],
    notDoes: ["No reemplaza a los reportes: para períodos y desgloses usa Reportes › Ventas."],
  },
  clientes: {
    title: "Clientes",
    subtitle: "Personas o empresas a las que vendes. Los tipos (Mayorista, Minorista…) te sirven para filtrar y reportar.",
    steps: [
      "Crea el cliente con «Nuevo cliente»: basta el nombre; el resto es opcional.",
      "Asígnale un tipo para filtrar listas y ver «Clientes por tipo» en el inicio.",
      "En su ficha ves el historial de compras y cuánto te debe.",
      "Archivar no borra: lo oculta de las listas y conserva su historial. Puedes reactivarlo cuando quieras.",
    ],
    notDoes: ["No hace falta crear un cliente para vender: existe «Consumidor final»."],
  },
  productos: {
    title: "Productos",
    subtitle: "Tu catálogo: lo que vendes, a qué precio y con qué impuesto. Las existencias se manejan en Inventario.",
    steps: [
      "Crea el producto como bien (lleva stock) o servicio (no lleva).",
      "Precio es lo que cobras; costo es lo que te cuesta y sirve para calcular la utilidad. El costo solo lo ven dueño y administradores.",
      "Categoría e impuesto se eligen de listas que puedes ampliar al vuelo.",
      "Stock mínimo: por debajo de ese número el inicio te avisa «bajo».",
    ],
    notDoes: ["Aquí no se cargan existencias: eso se hace en Inventario con «Ajustar stock»."],
  },
  inventario: {
    title: "Inventario",
    subtitle: "Cuánto tienes de cada producto por sucursal. Baja solo con ventas emitidas; sube con ajustes o anulaciones.",
    steps: [
      "Carga la existencia inicial de cada producto con «Ajustar stock» (entrada).",
      "Cada venta emitida descuenta; anularla lo repone.",
      "«Bajo» = existencia por debajo del mínimo del producto. «Agotado» = cero o menos.",
      "Un número negativo significa que vendiste sin haber cargado el stock: ajústalo con una entrada.",
    ],
    notDoes: ["No bloquea la venta sin stock: Kontify deja vender y te avisa."],
  },
  ventas: {
    title: "Ventas",
    subtitle: "Documento de venta interno (no fiscal). Guarda como borrador o emite: al emitir toma número, descuenta stock y queda listo para cobrar.",
    steps: [
      "Elige el cliente o deja «Consumidor final».",
      "Agrega productos; puedes ajustar cantidad, precio, descuento e IVA por línea.",
      "Guardar borrador no afecta nada. Emitir asigna el número, descuenta el stock y fija el cobro.",
      "Contado registra el cobro completo en el acto; crédito deja saldo pendiente con fecha de vencimiento opcional.",
      "Anular una venta emitida repone el stock. No se puede anular si ya tiene cobros.",
    ],
    notDoes: ["No es una factura fiscal: no sustituye tu facturación legal."],
  },
  presupuestos: {
    title: "Presupuestos",
    subtitle: "Cotizaciones para el cliente. No tocan stock ni numeración de ventas; al aceptarse se convierten en venta.",
    steps: [
      "Crea el presupuesto como una venta: cliente, productos y vigencia opcional.",
      "Enviar le asigna un número propio (serie aparte de las ventas).",
      "Márcalo aceptado o rechazado según responda el cliente.",
      "Convertir en venta crea un borrador de venta con las mismas líneas: revísalo y emítelo.",
    ],
    notDoes: ["No descuenta stock ni genera cobros hasta que la venta resultante se emite."],
  },
  cuentas_por_cobrar: {
    title: "Cuentas por cobrar",
    subtitle: "Lo que te deben, por cliente. Registra abonos totales o parciales.",
    steps: [
      "La lista muestra cuánto debe cada cliente y qué parte está vencida.",
      "Entra al cliente para ver cada venta con saldo y registrar un abono.",
      "Un abono puede ser parcial; la venta queda «Parcial» hasta saldarse.",
      "Anular un abono devuelve el saldo a la venta.",
    ],
  },
  reportes_ventas: {
    title: "Reporte de ventas",
    subtitle: "Ventas, ingresos y utilidad por período. La utilidad usa el costo que tenía cada producto al venderse.",
    steps: [
      "Elige un período con los botones o un rango de fechas.",
      "Filtra por sucursal si tienes más de una.",
      "Los desgloses muestran ventas por día, top de productos, por vendedor y por cliente.",
    ],
    notDoes: ["No incluye borradores ni ventas anuladas."],
  },
  reportes_inventario: {
    title: "Valorización de inventario",
    subtitle: "Valor de lo que tienes en almacén: existencia por costo de cada producto.",
    steps: ["Cada fila es un producto en una sucursal; el total suma todas."],
    notDoes: ["Los servicios y los productos sin costo no se valorizan."],
  },
  config_tipos_cliente: {
    title: "Tipos de cliente",
    subtitle: "Etiquetas para agrupar clientes (Mayorista, Minorista…). Los tipos inactivos no aparecen al crear clientes, pero se conservan en los existentes.",
    steps: [],
  },
  config_categorias: {
    title: "Categorías de producto",
    subtitle: "Agrupan el catálogo. Las categorías inactivas no aparecen al crear productos, pero se conservan en los existentes.",
    steps: [],
  },
  config_tasas: {
    title: "Tasas de impuesto",
    subtitle: "Porcentajes que se aplican por producto. La predeterminada se preselecciona al crear productos; solo puede haber una.",
    steps: [],
  },
  config_preferencias: {
    title: "Preferencias",
    subtitle: "Ajustes de este dispositivo, como el tema claro u oscuro.",
    steps: [],
  },
};
