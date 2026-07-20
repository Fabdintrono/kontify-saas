// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Inbox } from "lucide-react";
import { EmptyState } from "./empty-state";

describe("EmptyState", () => {
  it("muestra título y pista", () => {
    render(<EmptyState icon={Inbox} title="Sin datos aún" hint="Vuelve pronto" />);
    expect(screen.getByText("Sin datos aún")).toBeTruthy();
    expect(screen.getByText("Vuelve pronto")).toBeTruthy();
  });
});
