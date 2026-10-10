// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ModuleHeader } from "./module-header";
import { GUIDES } from "@/lib/guides";

afterEach(cleanup);

describe("ModuleHeader", () => {
  it("el subtítulo es solo texto: la ayuda ya no cuelga del párrafo", () => {
    const { container } = render(<ModuleHeader module="ventas" />);
    const parrafo = container.querySelector("p")!;
    expect(parrafo.textContent).toBe(GUIDES.ventas.subtitle);
    expect(parrafo.querySelector("button")).toBeNull();
  });

  it("la ayuda es el primer control de la derecha, antes de la acción primaria", () => {
    render(<ModuleHeader module="ventas" actions={<button type="button">Nueva venta</button>} />);
    const botones = screen.getAllByRole("button");
    expect(botones[0].getAttribute("aria-label")).toBe("Cómo funciona");
    expect(botones[1].textContent).toBe("Nueva venta");
  });

  it("la ayuda está aunque el módulo no tenga acción primaria", () => {
    render(<ModuleHeader module="cuentas_por_cobrar" />);
    expect(screen.getByRole("button", { name: "Cómo funciona" })).toBeTruthy();
  });

  it("el botón de ayuda abre un diálogo y lo declara", () => {
    render(<ModuleHeader module="clientes" />);
    const ayuda = screen.getByRole("button", { name: "Cómo funciona" });
    expect(ayuda.getAttribute("aria-haspopup")).toBe("dialog");
    expect(ayuda.getAttribute("aria-expanded")).toBe("false");
  });

  it("todos los módulos con guía ponen la ayuda en el mismo sitio", () => {
    for (const id of Object.keys(GUIDES) as (keyof typeof GUIDES)[]) {
      if (GUIDES[id].steps.length === 0) continue;
      cleanup();
      render(<ModuleHeader module={id} actions={<button type="button">X</button>} />);
      expect(screen.getAllByRole("button")[0].getAttribute("aria-label")).toBe("Cómo funciona");
    }
  });
});
