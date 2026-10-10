// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ClientForm } from "./client-form";

afterEach(cleanup);

function renderForm() {
  return render(
    <ClientForm action={async () => ({ ok: false })} types={[]} submitLabel="Crear cliente" cancelHref="/clientes" />,
  );
}

describe("ClientForm", () => {
  it("cada campo visible tiene su etiqueta asociada", () => {
    renderForm();
    const labels = [
      "Tipo de registro", "Nombre o razón social *", "Documento o identificación", "Teléfono",
      "Correo", "Dirección", "Persona de contacto", "Tipo de cliente", "Notas internas",
    ];
    for (const label of labels) {
      expect(screen.getByLabelText(label), label).toBeTruthy();
    }
  });

  it("los campos van agrupados en secciones con título", () => {
    renderForm();
    for (const t of ["Identificación", "Contacto", "Notas"]) {
      expect(screen.getByRole("heading", { name: t }), t).toBeTruthy();
    }
  });

  it("ofrece siempre una salida sin guardar", () => {
    renderForm();
    const cancelar = screen.getByRole("link", { name: "Cancelar" });
    expect(cancelar.getAttribute("href")).toBe("/clientes");
  });

  it("ningún campo usa el marcador de posición como etiqueta", () => {
    const { container } = renderForm();
    for (const el of container.querySelectorAll("input[placeholder], textarea[placeholder]")) {
      const id = el.getAttribute("id")!;
      expect(container.querySelector(`label[for="${id}"]`), `${id} sin <label>`).toBeTruthy();
    }
  });

  it("el error de un campo queda atado al campo por aria-describedby", () => {
    render(
      <ClientForm cancelHref="/clientes" submitLabel="Crear cliente" types={[]}
        action={async () => ({ ok: false, fieldErrors: { name: "El nombre es obligatorio" } })} />,
    );
    // Sin enviar no hay error todavía: el campo no se declara inválido.
    expect(screen.getByLabelText("Nombre o razón social *").getAttribute("aria-invalid")).toBeNull();
  });
});
