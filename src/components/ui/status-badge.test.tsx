// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { StatusBadge, TONE } from "./status-badge";

afterEach(cleanup);

describe("StatusBadge", () => {
  it("pinta icono + texto y no depende solo del color", () => {
    const { container } = render(<StatusBadge tone="danger" icon="alert" label="Vencida" />);
    expect(screen.getByText("Vencida")).toBeTruthy();
    expect(container.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  });
  it("no se parte en dos líneas", () => {
    const { container } = render(<StatusBadge tone="ok" icon="check" label="En stock" />);
    expect(container.firstElementChild?.className).toMatch(/whitespace-nowrap/);
  });
  it("cada tono trae su variante oscura", () => {
    for (const cls of Object.values(TONE)) expect(cls).toMatch(/dark:/);
  });
  it("sin icono sigue siendo válido (etiquetas como el tipo de cliente)", () => {
    const { container } = render(<StatusBadge tone="info" label="Mayorista" />);
    expect(screen.getByText("Mayorista")).toBeTruthy();
    expect(container.querySelector("svg")).toBeNull();
  });
});
