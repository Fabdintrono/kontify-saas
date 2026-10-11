import { describe, it, expect } from "vitest";
import { parseCsv, detectarDelimitador } from "@/lib/import/csv";

describe("detectarDelimitador", () => {
  it("reconoce la coma", () => {
    expect(detectarDelimitador("a,b,c\n1,2,3")).toBe(",");
  });

  it("reconoce el punto y coma del Excel en español", () => {
    expect(detectarDelimitador("Nombre;Precio;Costo\nAgua;2,50;1,00")).toBe(";");
  });

  it("reconoce la tabulación", () => {
    expect(detectarDelimitador("a\tb\tc")).toBe("\t");
  });

  it("no se confunde con las comas que van dentro de comillas", () => {
    expect(detectarDelimitador('"Pérez, Juan";0412;activo')).toBe(";");
  });
});

describe("parseCsv", () => {
  it("lee una tabla sencilla", () => {
    expect(parseCsv("a,b\n1,2")).toEqual([["a", "b"], ["1", "2"]]);
  });

  it("quita el BOM que escribe Excel", () => {
    const [cabeceras] = parseCsv("﻿Nombre,Precio\nAgua,2");
    expect(cabeceras[0]).toBe("Nombre");
  });

  it("respeta el separador dentro de comillas", () => {
    expect(parseCsv('"Pérez, Juan",0412').at(0)).toEqual(["Pérez, Juan", "0412"]);
  });

  it("desescapa las comillas dobles", () => {
    expect(parseCsv('"Dice ""hola""",x').at(0)).toEqual(['Dice "hola"', "x"]);
  });

  it("admite un salto de línea dentro de una celda", () => {
    const filas = parseCsv('nombre,notas\nAgua,"paga a 15 días\ndespachar martes"');
    expect(filas.length).toBe(2);
    expect(filas[1][1]).toBe("paga a 15 días\ndespachar martes");
  });

  it("acepta fin de línea de Windows", () => {
    expect(parseCsv("a,b\r\n1,2\r\n")).toEqual([["a", "b"], ["1", "2"]]);
  });

  it("descarta las filas vacías del final", () => {
    expect(parseCsv("a,b\n1,2\n\n,\n")).toEqual([["a", "b"], ["1", "2"]]);
  });

  it("conserva las celdas vacías del medio, que marcan la columna", () => {
    expect(parseCsv("a,b,c\n1,,3").at(1)).toEqual(["1", "", "3"]);
  });

  it("un archivo vacío devuelve una lista vacía, no revienta", () => {
    expect(parseCsv("")).toEqual([]);
    expect(parseCsv("\n\n")).toEqual([]);
  });

  it("una comilla sin cerrar no se come el resto en silencio: devuelve lo leído", () => {
    const filas = parseCsv('a,b\n"roto,2');
    expect(filas.length).toBe(2);
    expect(filas[1][0]).toBe("roto,2");
  });
});
