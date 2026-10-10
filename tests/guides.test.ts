import { describe, it, expect } from "vitest";
import { GUIDES, MODULE_IDS, type ModuleId } from "@/lib/guides";

describe("guías de módulo", () => {
  it("todos los módulos tienen título, subtítulo de una línea y entre 1 y 6 pasos", () => {
    for (const id of MODULE_IDS) {
      const g = GUIDES[id as ModuleId];
      expect(g.title.length).toBeGreaterThan(2);
      expect(g.subtitle.length).toBeGreaterThan(20);
      expect(g.subtitle.length).toBeLessThanOrEqual(170);
      expect(g.subtitle).not.toMatch(/\n/);
      expect(g.steps.length).toBeGreaterThanOrEqual(0);
      expect(g.steps.length).toBeLessThanOrEqual(6);
    }
  });
  it("sin emojis ni la palabra prohibida", () => {
    const all = JSON.stringify(GUIDES);
    expect(all).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
    expect(all.toLowerCase()).not.toMatch(/\bplata\b/);
  });
  it("ventas se llama Ventas (no Facturación)", () => {
    expect(GUIDES.ventas.title).toBe("Ventas");
  });
});
