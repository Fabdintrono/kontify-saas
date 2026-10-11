import { describe, it, expect } from "vitest";
import { mapear, parseNumero, parseOpcion, validarFila, plantillaCsv } from "@/lib/import/columns";
import { COLUMNAS_PRODUCTOS, COLUMNAS_CLIENTES } from "@/lib/import/entities";

describe("parseNumero", () => {
  it("lee el decimal con coma, como se escribe aquí", () => {
    expect(parseNumero("2,50")).toBe(2.5);
    expect(parseNumero("0,99")).toBe(0.99);
  });

  it("lee el decimal con punto", () => {
    expect(parseNumero("2.50")).toBe(2.5);
  });

  it("entiende el punto como separador de miles", () => {
    expect(parseNumero("1.500")).toBe(1500);
    expect(parseNumero("1.234.567")).toBe(1234567);
  });

  it("con coma y punto, manda el que va último", () => {
    expect(parseNumero("1.234,56")).toBe(1234.56);
    expect(parseNumero("1,234.56")).toBe(1234.56);
  });

  it("aguanta espacios y el símbolo de moneda", () => {
    expect(parseNumero(" 8 ")).toBe(8);
    expect(parseNumero("$12,50")).toBe(12.5);
  });

  it("rechaza lo que no es un número", () => {
    expect(parseNumero("dos cincuenta")).toBeNull();
    expect(parseNumero("12ab")).toBeNull();
    expect(parseNumero("")).toBeNull();
  });

  it("acepta el negativo para que la validación pueda rechazarlo con un motivo", () => {
    expect(parseNumero("-5")).toBe(-5);
  });
});

describe("parseOpcion", () => {
  const opciones = { good: ["bien", "producto"], service: ["servicio"] };

  it("reconoce la clave y sus sinónimos sin mirar acentos ni mayúsculas", () => {
    expect(parseOpcion("Bien", opciones)).toBe("good");
    expect(parseOpcion("PRODUCTO", opciones)).toBe("good");
    expect(parseOpcion("servicio", opciones)).toBe("service");
    expect(parseOpcion("good", opciones)).toBe("good");
  });

  it("lo que no está devuelve null", () => {
    expect(parseOpcion("cosa", opciones)).toBeNull();
  });
});

describe("mapear", () => {
  it("empareja por el nombre de la plantilla", () => {
    const m = mapear(["Nombre", "SKU", "Precio de venta"], COLUMNAS_PRODUCTOS);
    expect(m.name).toBe(0);
    expect(m.sku).toBe(1);
    expect(m.price).toBe(2);
  });

  it("empareja aunque la columna venga con el asterisco de obligatoria", () => {
    expect(mapear(["Nombre *", "Precio de venta *"], COLUMNAS_PRODUCTOS).name).toBe(0);
  });

  it("reconoce los nombres que usa la gente", () => {
    const m = mapear(["Producto", "Código", "PVP", "Costo unitario"], COLUMNAS_PRODUCTOS);
    expect(m.name).toBe(0);
    expect(m.sku).toBe(1);
    expect(m.price).toBe(2);
    expect(m.cost).toBe(3);
  });

  it("no se pierde con acentos, mayúsculas ni guiones bajos", () => {
    const m = mapear(["NOMBRE", "categoria", "precio_de_venta"], COLUMNAS_PRODUCTOS);
    expect(m.name).toBe(0);
    expect(m.category).toBe(1);
    expect(m.price).toBe(2);
  });

  it("una columna del archivo no se asigna a dos campos", () => {
    // «Contacto» es alias de teléfono en clientes y también se parece a persona de contacto.
    const m = mapear(["Nombre", "Contacto"], COLUMNAS_CLIENTES);
    const asignadas = Object.values(m).filter((i) => i === 1);
    expect(asignadas.length).toBe(1);
  });

  it("lo que no reconoce queda en -1", () => {
    expect(mapear(["Nombre", "Vendedor favorito"], COLUMNAS_PRODUCTOS).cost).toBe(-1);
  });
});

describe("validarFila", () => {
  const cols = COLUMNAS_PRODUCTOS;
  const m = mapear(["Nombre", "Tipo", "SKU", "Precio de venta", "Costo"], cols);

  it("una fila buena no da errores", () => {
    const r = validarFila(["Agua", "Bien", "AGU-1", "2,50", "1,10"], cols, m);
    expect(r.errores).toEqual([]);
    expect(r.valores).toMatchObject({ name: "Agua", kind: "good", sku: "AGU-1", price: 2.5, cost: 1.1 });
  });

  it("avisa del campo obligatorio vacío, nombrándolo", () => {
    const r = validarFila(["", "Bien", "AGU-1", "2,50", ""], cols, m);
    expect(r.errores).toEqual([{ columna: "name", mensaje: "Falta nombre" }]);
  });

  it("avisa del número mal escrito citando lo que puso el usuario", () => {
    const r = validarFila(["Agua", "Bien", "", "dos cincuenta", ""], cols, m);
    expect(r.errores[0]).toEqual({ columna: "price", mensaje: "«dos cincuenta» no es un número" });
  });

  it("rechaza el precio negativo", () => {
    const r = validarFila(["Agua", "Bien", "", "-3", ""], cols, m);
    expect(r.errores[0].mensaje).toBe("No puede ser negativo");
  });

  it("dice qué valores admite una opción equivocada", () => {
    const r = validarFila(["Agua", "gaseosa", "", "2", ""], cols, m);
    expect(r.errores[0].mensaje).toContain("good o service");
  });

  it("un texto demasiado largo se recorta y se avisa, no se pierde la fila", () => {
    const largo = "x".repeat(130);
    const r = validarFila([largo, "", "", "2", ""], cols, m);
    expect(r.errores[0].mensaje).toBe("Son 130 caracteres y caben 120");
    expect(String(r.valores.name).length).toBe(120);
  });

  it("los campos opcionales vacíos quedan en null, sin error", () => {
    const r = validarFila(["Agua", "", "", "2", ""], cols, m);
    expect(r.errores).toEqual([]);
    expect(r.valores.cost).toBeNull();
    expect(r.valores.kind).toBeNull();
  });
});

describe("plantillaCsv", () => {
  it("marca los obligatorios y trae una fila de ejemplo", () => {
    const csv = plantillaCsv(COLUMNAS_PRODUCTOS);
    const [titulos, ejemplo] = csv.replace("﻿", "").trim().split("\n");
    expect(titulos).toContain("Nombre *");
    expect(titulos).toContain("Precio de venta *");
    expect(titulos).toContain("Costo");
    expect(titulos).not.toContain("Costo *");
    expect(ejemplo).toContain("Agua mineral 1.5L");
  });

  it("lleva BOM para que Excel abra los acentos bien", () => {
    expect(plantillaCsv(COLUMNAS_CLIENTES).charCodeAt(0)).toBe(0xfeff);
  });

  it("entrecomilla lo que lleva coma", () => {
    expect(plantillaCsv(COLUMNAS_CLIENTES)).toContain('"Av. Principal, local 3"');
  });

  it("la plantilla que genera se vuelve a leer sin perder el emparejamiento", async () => {
    const { parseCsv } = await import("@/lib/import/csv");
    const [titulos] = parseCsv(plantillaCsv(COLUMNAS_PRODUCTOS));
    const m = mapear(titulos, COLUMNAS_PRODUCTOS);
    expect(Object.values(m).every((i) => i >= 0)).toBe(true);
  });
});
