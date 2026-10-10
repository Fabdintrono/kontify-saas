import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

/** Luminancia relativa (WCAG 2.x) de un hex #rrggbb. */
function lum(hex: string): number {
  const c = (hex.match(/\w\w/g) ?? []).map((x) => parseInt(x, 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function ratio(a: string, b: string): number {
  const [x, y] = [lum(a), lum(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
/** Lee un token del bloque `:root` o `.dark` de globals.css. */
function token(name: string, scope: ":root" | ".dark"): string {
  const css = readFileSync("src/app/globals.css", "utf8");
  const re = scope === ":root" ? /:root\s*\{([^}]*)\}/ : /\.dark\s*\{([^}]*)\}/;
  const match = css.match(re);
  if (!match) throw new Error(`bloque ${scope} no encontrado en globals.css`);
  const block = match[1];
  const m = block.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`));
  if (!m) throw new Error(`token --${name} no encontrado en ${scope}`);
  return m[1];
}

describe("contraste de los tokens de texto", () => {
  it("texto secundario cumple AA sobre fondo y superficie, en claro y oscuro", () => {
    for (const scope of [":root", ".dark"] as const) {
      const soft = token("text-soft", scope);
      for (const bgName of ["bg", "surface"] as const) {
        const bg = token(bgName, scope);
        expect(ratio(soft, bg), `--text-soft sobre --${bgName} en ${scope}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
  it("texto principal cumple AAA sobre superficie", () => {
    for (const scope of [":root", ".dark"] as const) {
      expect(ratio(token("text", scope), token("surface", scope))).toBeGreaterThanOrEqual(7);
    }
  });
});
