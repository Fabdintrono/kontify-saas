// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ClientForm } from "./client-form";

afterEach(cleanup);

describe("ClientForm", () => {
  it("cada campo visible tiene su etiqueta asociada", () => {
    render(<ClientForm action={async () => ({ ok: false })} types={[]} submitLabel="Crear cliente" />);
    const labels = [
      "Tipo de registro", "Nombre / Razón social *", "Documento / ID", "Teléfono",
      "Email", "Dirección", "Persona de contacto", "Tipo de cliente", "Notas",
    ];
    for (const label of labels) {
      expect(screen.getByLabelText(label), label).toBeTruthy();
    }
  });
});
