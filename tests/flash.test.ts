import { describe, it, expect } from "vitest";
import { withFlash, flashMessage, flashFor } from "@/lib/flash";

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
  it("un arg que no es un número se descarta (viene de la URL)", () => {
    expect(flashMessage("venta-emitida", "0 — llame al 0800")?.title).toBe("Venta emitida");
  });
  it("flashFor no necesita `!`: la clave es conocida", () => {
    expect(flashFor("abono-registrado").title).toBe("Abono registrado");
    expect(flashFor("venta-emitida", 12).title).toBe("Venta #12 emitida");
  });
});

describe("flash — el argumento de los gastos fijos", () => {
  it("acepta una fecha y la muestra como la lee la gente", () => {
    expect(flashMessage("fijo-pagado", "2026-11-05")?.description).toBe("El próximo vence el 05/11/2026.");
  });

  it("sigue aceptando un número de documento", () => {
    expect(flashMessage("venta-emitida", "7")?.title).toBe("Venta #7 emitida");
  });

  it("descarta cualquier otra cosa en vez de pintarla", () => {
    expect(flashMessage("fijo-pagado", "<script>")?.description).toBe("El gasto fijo avanzó a su próxima fecha.");
    expect(flashMessage("venta-emitida", "7; drop")?.title).toBe("Venta emitida");
  });
});
