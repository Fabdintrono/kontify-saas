import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parseXlsx, columnaDeRef } from "@/lib/import/xlsx";

const leer = (n: string) => readFileSync(`tests/fixtures/${n}`);

describe("columnaDeRef", () => {
  it("traduce la referencia de celda a índice de columna", () => {
    expect(columnaDeRef("A1")).toBe(0);
    expect(columnaDeRef("B2")).toBe(1);
    expect(columnaDeRef("Z9")).toBe(25);
    expect(columnaDeRef("AA1")).toBe(26);
    expect(columnaDeRef("AB12")).toBe(27);
  });
});

describe("parseXlsx", () => {
  it("lee la hoja con sus cabeceras y sus filas", () => {
    const filas = parseXlsx(leer("productos.xlsx"));
    expect(filas[0]).toEqual(["Nombre", "SKU", "Precio", "Costo", "Categoría"]);
    expect(filas.length).toBe(4);
  });

  it("conserva los acentos", () => {
    const filas = parseXlsx(leer("productos.xlsx"));
    expect(filas[2][0]).toBe("Café molido 500g");
    expect(filas[0][4]).toBe("Categoría");
  });

  it("los números llegan como texto, sin perder decimales", () => {
    const filas = parseXlsx(leer("productos.xlsx"));
    expect(filas[1][2]).toBe("2.5");
    expect(filas[1][3]).toBe("1.1");
  });

  it("una celda saltada deja hueco y no desplaza a las de su derecha", () => {
    const filas = parseXlsx(leer("productos.xlsx"));
    // «Café molido» no tiene SKU: el precio tiene que seguir en la columna 2.
    expect(filas[2][1]).toBe("");
    expect(filas[2][2]).toBe("8");
  });

  it("lee los textos escritos en línea, no solo los compartidos", () => {
    const filas = parseXlsx(leer("inline.xlsx"));
    expect(filas).toEqual([["Nombre", "Precio"], ["Pan", "1.2"]]);
  });

  it("lee una hoja guardada sin comprimir", () => {
    const filas = parseXlsx(leer("stored.xlsx"));
    expect(filas).toEqual([["Nombre", "Precio"], ["Sal", "0.9"]]);
  });

  it("encuentra la hoja aunque no se llame sheet1.xml", () => {
    // El fixture de productos la guarda como «hoja_de_datos.xml».
    expect(parseXlsx(leer("productos.xlsx")).length).toBeGreaterThan(0);
  });

  it("un archivo que no es xlsx da un error con sentido, no una excepción opaca", () => {
    expect(() => parseXlsx(Buffer.from("esto no es un zip"))).toThrow(/no parece un .xlsx/);
  });
});

describe("parseXlsx — rarezas de un Excel real", () => {
  it("una fila vacía autocerrada no se come la fila siguiente", () => {
    const filas = parseXlsx(leer("filas-vacias.xlsx"));
    expect(filas).toEqual([["Nombre", "Precio"], ["Arroz", "7.5"], ["Sal", "1"]]);
  });

  it("ignora dimension, cols y spans sin tropezar", () => {
    expect(parseXlsx(leer("filas-vacias.xlsx"))[0]).toEqual(["Nombre", "Precio"]);
  });

  it("acepta que la relación apunte con barra inicial", () => {
    expect(parseXlsx(leer("filas-vacias.xlsx")).length).toBe(3);
  });
});
