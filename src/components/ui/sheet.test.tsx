// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { Sheet } from "./sheet";

afterEach(cleanup);

describe("Sheet", () => {
  it("side=\"right\" queda fixed, no relative, y tiene el botón Cerrar", () => {
    render(
      <Sheet open onOpenChange={() => {}} side="right" title="x">
        hola
      </Sheet>,
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog.className).toContain("fixed");
    expect(dialog.className).not.toContain("relative");
    expect(screen.getByRole("button", { name: /cerrar/i })).toBeTruthy();
  });

  it("side=\"bottom\" queda fixed, no relative, y tiene el botón Cerrar", () => {
    render(
      <Sheet open onOpenChange={() => {}} side="bottom" title="x">
        hola
      </Sheet>,
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog.className).toContain("fixed");
    expect(dialog.className).not.toContain("relative");
    expect(screen.getByRole("button", { name: /cerrar/i })).toBeTruthy();
  });
});
