import { describe, it, expect } from "vitest";
import { withFlash, flashMessage } from "@/lib/flash";

describe("flash", () => {
  it("withFlash añade la clave (y el argumento) a la URL", () => {
    expect(withFlash("/operaciones/facturacion/abc", "venta-emitida", "4")).toBe("/operaciones/facturacion/abc?flash=venta-emitida&arg=4");
    expect(withFlash("/clientes?page=2", "cliente-creado")).toBe("/clientes?page=2&flash=cliente-creado");
  });
  it("flashMessage traduce la clave a texto; desconocida → null", () => {
    expect(flashMessage("venta-emitida", "4")).toEqual({ title: "Venta #4 emitida", description: "Se asignó el número y se descontó el stock." });
    expect(flashMessage("cliente-creado", null)?.title).toBe("Cliente creado");
    expect(flashMessage("lo-que-sea", null)).toBeNull();
  });
});
