// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { Button } from "./button";

afterEach(cleanup);

describe("Button", () => {
  it("cargando queda deshabilitado, ocupado y conserva su nombre", () => {
    render(<Button loading>Guardar</Button>);
    const b = screen.getByRole("button", { name: "Guardar" });
    expect((b as HTMLButtonElement).disabled).toBe(true);
    expect(b.getAttribute("aria-busy")).toBe("true");
  });

  it("cargando cambia el icono por la rueda, no lo suma", () => {
    const { container } = render(<Button icon="plus" loading>Añadir</Button>);
    expect(container.querySelectorAll("svg").length).toBe(1);
    expect(container.querySelector("svg")!.getAttribute("class")).toContain("animate-spin");
  });

  it("en reposo no declara aria-busy", () => {
    render(<Button>Guardar</Button>);
    expect(screen.getByRole("button").hasAttribute("aria-busy")).toBe(false);
  });

  it("acepta el atributo form para enviar un formulario que está fuera", () => {
    render(<Button form="mi-form">Guardar</Button>);
    expect(screen.getByRole("button").getAttribute("form")).toBe("mi-form");
  });
});
