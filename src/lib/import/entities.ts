import type { Columna } from "./columns";

export const ENTIDADES = ["productos", "clientes"] as const;
export type Entidad = (typeof ENTIDADES)[number];

export const COLUMNAS_PRODUCTOS: Columna[] = [
  {
    key: "name", label: "Nombre", obligatoria: true, tipo: "texto", maximo: 120,
    alias: ["producto", "descripcion", "descripción", "item", "ítem", "articulo", "artículo", "nombre del producto"],
    ejemplo: "Agua mineral 1.5L",
  },
  {
    key: "kind", label: "Tipo", obligatoria: false, tipo: "opcion",
    alias: ["clase", "bien o servicio", "tipo de producto"],
    opciones: {
      good: ["bien", "bienes", "producto", "productos", "mercancia", "mercancía", "articulo", "artículo"],
      service: ["servicio", "servicios"],
    },
    ejemplo: "Bien", ayuda: "Si la dejas vacía, entra como Bien.",
  },
  {
    key: "sku", label: "SKU", obligatoria: false, tipo: "texto", maximo: 40,
    alias: ["codigo", "código", "cod", "referencia", "ref", "codigo de barras", "código de barras", "sku o codigo"],
    ejemplo: "AGU-15",
  },
  {
    key: "price", label: "Precio de venta", obligatoria: true, tipo: "numero",
    alias: ["precio", "pvp", "precio venta", "precio publico", "precio público", "venta"],
    ejemplo: "2,50",
  },
  {
    key: "cost", label: "Costo", obligatoria: false, tipo: "numero",
    alias: ["costo unitario", "coste", "precio de compra", "compra"],
    ejemplo: "1,10",
  },
  {
    key: "unit", label: "Unidad", obligatoria: false, tipo: "texto", maximo: 20,
    alias: ["medida", "unidad de medida", "um"],
    ejemplo: "unidad", ayuda: "Si la dejas vacía, entra como «unidad».",
  },
  {
    key: "minStock", label: "Stock mínimo", obligatoria: false, tipo: "numero",
    alias: ["minimo", "mínimo", "stock min", "existencia minima", "existencia mínima", "punto de reorden"],
    ejemplo: "10",
  },
  {
    key: "category", label: "Categoría", obligatoria: false, tipo: "texto", maximo: 40,
    alias: ["familia", "rubro", "linea", "línea", "grupo"],
    ejemplo: "Bebidas", ayuda: "Si no existe, se crea.",
  },
  {
    key: "description", label: "Descripción", obligatoria: false, tipo: "texto", maximo: 500,
    alias: ["detalle", "notas", "observaciones"],
    ejemplo: "Botella de litro y medio",
  },
];

export const COLUMNAS_CLIENTES: Columna[] = [
  {
    key: "name", label: "Nombre", obligatoria: true, tipo: "texto", maximo: 120,
    alias: ["cliente", "razon social", "razón social", "nombre o razon social", "nombre completo", "empresa"],
    ejemplo: "Farmacia Central C.A.",
  },
  {
    key: "kind", label: "Tipo de registro", obligatoria: false, tipo: "opcion",
    alias: ["persona o empresa", "naturaleza", "tipo"],
    opciones: {
      person: ["persona", "natural", "persona natural", "particular", "individuo"],
      company: ["empresa", "compania", "compañia", "compañía", "juridica", "jurídica", "persona juridica", "negocio"],
    },
    ejemplo: "Empresa", ayuda: "Si la dejas vacía, entra como Persona.",
  },
  {
    key: "docId", label: "Documento", obligatoria: false, tipo: "texto", maximo: 40,
    alias: ["cedula", "cédula", "rif", "nit", "dni", "ruc", "identificacion", "identificación", "ci", "documento o identificacion"],
    ejemplo: "J-12345678-9",
  },
  {
    key: "phone", label: "Teléfono", obligatoria: false, tipo: "texto", maximo: 40,
    alias: ["telefono", "celular", "movil", "móvil", "whatsapp", "tlf", "contacto"],
    ejemplo: "0212-5551234",
  },
  {
    key: "email", label: "Correo", obligatoria: false, tipo: "texto", maximo: 120,
    alias: ["email", "e mail", "correo electronico", "correo electrónico", "mail"],
    ejemplo: "compras@farmacia.com",
  },
  {
    key: "address", label: "Dirección", obligatoria: false, tipo: "texto", maximo: 200,
    alias: ["direccion", "domicilio", "ubicacion", "ubicación"],
    ejemplo: "Av. Principal, local 3",
  },
  {
    key: "contactName", label: "Persona de contacto", obligatoria: false, tipo: "texto", maximo: 120,
    alias: ["contacto", "encargado", "responsable", "atencion", "atención"],
    ejemplo: "María González",
  },
  {
    key: "type", label: "Tipo de cliente", obligatoria: false, tipo: "texto", maximo: 40,
    alias: ["categoria", "categoría", "segmento", "clasificacion", "clasificación", "grupo"],
    ejemplo: "Mayorista", ayuda: "Si no existe, se crea.",
  },
  {
    key: "notes", label: "Notas", obligatoria: false, tipo: "texto", maximo: 500,
    alias: ["observaciones", "comentarios", "detalle"],
    ejemplo: "Paga a 15 días",
  },
];

export const COLUMNAS: Record<Entidad, Columna[]> = {
  productos: COLUMNAS_PRODUCTOS,
  clientes: COLUMNAS_CLIENTES,
};

export const ETIQUETA: Record<Entidad, { singular: string; plural: string; volver: string; titulo: string }> = {
  productos: { singular: "producto", plural: "productos", volver: "/operaciones/productos", titulo: "Importar productos" },
  clientes: { singular: "cliente", plural: "clientes", volver: "/clientes", titulo: "Importar clientes" },
};

/** Campo por el que se decide si dos filas son el mismo registro. */
export const CLAVE_DUPLICADO: Record<Entidad, { key: string; label: string }> = {
  productos: { key: "sku", label: "SKU" },
  clientes: { key: "docId", label: "documento" },
};
