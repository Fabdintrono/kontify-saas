import { describe, it, expect } from "vitest";
import { revisar, revalidar } from "@/lib/import/analyze";
import { mapear } from "@/lib/import/columns";
import { COLUMNAS_PRODUCTOS, COLUMNAS_CLIENTES } from "@/lib/import/entities";

const CAB = ["Nombre", "SKU", "Precio de venta", "Costo"];

function revisarProductos(filas: string[][], existentes: string[] = [], cabeceras = CAB) {
  return revisar({
    entidad: "productos", columnas: COLUMNAS_PRODUCTOS, cabeceras, filas,
    mapeo: mapear(cabeceras, COLUMNAS_PRODUCTOS), existentes: new Set(existentes),
  });
}

describe("revisar", () => {
  it("cuenta por separado las buenas y las que fallan", () => {
    const r = revisarProductos([
      ["Agua", "AGU-1", "2,50", "1"],
      ["", "PAN-1", "1", ""],          // sin nombre
      ["Café", "CAF-1", "ocho", ""],   // precio ilegible
    ]);
    expect(r.validas).toBe(1);
    expect(r.conError).toBe(2);
  });

  it("numera las filas como las ve el usuario en su hoja", () => {
    const r = revisarProductos([["Agua", "A", "1", ""], ["", "B", "1", ""]]);
    expect(r.filas[0].linea).toBe(2);
    expect(r.filas[1].linea).toBe(3);
  });

  it("detecta el repetido dentro del archivo y dice contra qué fila choca", () => {
    const r = revisarProductos([
      ["Agua", "AGU-1", "2", ""],
      ["Agua grande", "AGU-1", "3", ""],
    ]);
    expect(r.filas[1].errores[0].mensaje).toBe("El mismo SKU que la fila 2");
    expect(r.filas[0].errores).toEqual([]);
  });

  it("el repetido no distingue mayúsculas ni acentos", () => {
    const r = revisarProductos([["A", "agu 1", "1", ""], ["B", "AGÚ-1", "1", ""]]);
    expect(r.filas[1].errores.length).toBe(1);
  });

  it("marca lo que ya existe en la base", () => {
    const r = revisarProductos([["Agua", "AGU-1", "2", ""]], ["agu 1"]);
    expect(r.filas[0].errores[0].mensaje).toContain("Ya existe");
  });

  it("sin SKU no hay choque: dos filas sin código son dos productos", () => {
    const r = revisarProductos([["Agua", "", "2", ""], ["Pan", "", "1", ""]]);
    expect(r.validas).toBe(2);
  });

  it("avisa de las columnas del archivo que no se usan", () => {
    const cab = ["Nombre", "Precio de venta", "Proveedor habitual"];
    const r = revisarProductos([["Agua", "2", "Coca"]], [], cab);
    expect(r.ignoradas).toEqual(["Proveedor habitual"]);
  });

  it("avisa del obligatorio que el archivo no trae", () => {
    const cab = ["Nombre", "SKU"];
    const r = revisarProductos([["Agua", "A"]], [], cab);
    expect(r.faltantes).toEqual(["Precio de venta"]);
  });

  it("sin columnas que falten, la lista va vacía", () => {
    expect(revisarProductos([["Agua", "A", "2", ""]]).faltantes).toEqual([]);
  });
});

describe("revisar — clientes", () => {
  const cab = ["Nombre", "Documento", "Teléfono"];
  const rev = (filas: string[][], existentes: string[] = []) => revisar({
    entidad: "clientes", columnas: COLUMNAS_CLIENTES, cabeceras: cab, filas,
    mapeo: mapear(cab, COLUMNAS_CLIENTES), existentes: new Set(existentes),
  });

  it("el duplicado se mide por documento, no por nombre", () => {
    const r = rev([["Juan Pérez", "V-123", "0412"], ["Juan Pérez", "V-456", "0414"]]);
    expect(r.validas).toBe(2);
  });

  it("dos veces el mismo documento sí choca", () => {
    const r = rev([["Juan", "V-123", ""], ["Juan P.", "V-123", ""]]);
    expect(r.filas[1].errores[0].mensaje).toBe("El mismo documento que la fila 2");
  });

  it("solo el nombre basta para una fila válida", () => {
    expect(rev([["Consumidor X", "", ""]]).validas).toBe(1);
  });
});

describe("revalidar — la segunda comprobación, ya en el servidor", () => {
  const fila = (linea: number, valores: Record<string, unknown>) => ({ linea, valores: valores as never, errores: [] });

  const rev = (filas: ReturnType<typeof fila>[], existentes: string[] = []) =>
    revalidar({ entidad: "productos", columnas: COLUMNAS_PRODUCTOS, filas, existentes: new Set(existentes) });

  it("deja pasar una fila correcta", () => {
    const r = rev([fila(2, { name: "Agua", price: 2.5, sku: "AGU-1" })]);
    expect(r.buenas.length).toBe(1);
    expect(r.rechazadas).toEqual([]);
  });

  it("no se fía de que el navegador diga que la fila está bien: sin nombre, fuera", () => {
    const r = rev([fila(2, { name: null, price: 2 })]);
    expect(r.buenas.length).toBe(0);
    expect(r.rechazadas[0].motivo).toContain("falta nombre");
  });

  it("un precio negativo colado a mano se rechaza", () => {
    expect(rev([fila(2, { name: "A", price: -9 })]).rechazadas[0].motivo).toContain("no es un número válido");
  });

  it("un precio que llega como texto se rechaza", () => {
    expect(rev([fila(2, { name: "A", price: "2.5" })]).rechazadas[0].motivo).toContain("no es un número válido");
  });

  it("una opción inventada se rechaza", () => {
    expect(rev([fila(2, { name: "A", price: 1, kind: "gratis" })]).rechazadas[0].motivo).toContain("no admitido");
  });

  it("un campo que no existe en la plantilla no se cuela", () => {
    const r = rev([fila(2, { name: "A", price: 1, tenant_id: "otro-tenant" })]);
    expect(r.rechazadas[0].motivo).toContain("campo desconocido");
  });

  it("vuelve a detectar el SKU repetido aunque el navegador no lo marcara", () => {
    const r = rev([fila(2, { name: "A", price: 1, sku: "X" }), fila(3, { name: "B", price: 1, sku: "x" })]);
    expect(r.buenas.length).toBe(1);
    expect(r.rechazadas[0].linea).toBe(3);
  });

  it("vuelve a mirar contra lo ya guardado", () => {
    expect(rev([fila(2, { name: "A", price: 1, sku: "AGU-1" })], ["agu 1"]).buenas.length).toBe(0);
  });

  it("un texto más largo del límite se rechaza en vez de recortarse en silencio", () => {
    expect(rev([fila(2, { name: "x".repeat(200), price: 1 })]).rechazadas[0].motivo).toContain("demasiado largo");
  });
});
