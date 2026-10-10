import { describe, it, expect } from "vitest";
import { DANGER_TEXT, DANGER_TEXT_STRONG, DANGER_TEXT_HOVER } from "@/lib/ui-tokens";

describe("token de texto de peligro", () => {
  it("trae variante oscura y no usa el rojo que no contrasta", () => {
    for (const cls of [DANGER_TEXT, DANGER_TEXT_STRONG, DANGER_TEXT_HOVER]) {
      expect(cls).toMatch(/dark:/);
      expect(cls).not.toContain("#dc2626");
    }
  });
});
