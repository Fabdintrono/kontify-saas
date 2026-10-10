import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { TONE } from "@/components/ui/status-badge";

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
/** Mezcla `fg` al 10 % sobre `ground`: lo que Tailwind pinta con `bg-[#…]/10`. */
function composite(fg10: string, ground: string): string {
  const [f, g] = [fg10, ground].map((h) => (h.match(/\w\w/g) ?? []).map((x) => parseInt(x, 16)));
  return "#" + f.map((v, i) => Math.round(v * 0.1 + g[i] * 0.9).toString(16).padStart(2, "0")).join("");
}
/** `#rrggbb` tal cual, o el valor del token si la clase trae `var(--algo)`. */
function color(value: string, scope: ":root" | ".dark"): string {
  const v = value.match(/var\(--([a-z-]+)\)/);
  return v ? token(v[1], scope) : value;
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
  // Los chips son la única pieza que mezcla color sobre el fondo: si alguien retoca un tono,
  // el test falla antes de que llegue a producción con un texto ilegible.
  it("cada tono de StatusBadge cumple AA sobre su propio tinte, en claro y oscuro", () => {
    for (const [name, cls] of Object.entries(TONE)) {
      const tint = cls.match(/bg-\[(#[0-9a-fA-F]{6}|var\(--[a-z-]+\))\](\/10)?/);
      const light = cls.match(/(?:^|\s)text-\[(#[0-9a-fA-F]{6}|var\(--[a-z-]+\))\]/);
      const dark = cls.match(/dark:text-\[(#[0-9a-fA-F]{6}|var\(--[a-z-]+\))\]/);
      if (!tint || !light || !dark) throw new Error(`no se pudo leer el tono ${name}: ${cls}`);
      for (const scope of [":root", ".dark"] as const) {
        const fg = color(scope === ":root" ? light[1] : dark[1], scope);
        const base = color(tint[1], scope);
        for (const groundName of ["surface", "bg"] as const) {
          // Sin `/10` el fondo del chip es opaco y el del contenedor no lo atraviesa.
          const chip = tint[2] ? composite(base, token(groundName, scope)) : base;
          expect(ratio(fg, chip), `tono ${name} sobre --${groundName} en ${scope}`).toBeGreaterThanOrEqual(4.5);
        }
      }
    }
  });
  it("texto principal cumple AAA sobre superficie", () => {
    for (const scope of [":root", ".dark"] as const) {
      expect(ratio(token("text", scope), token("surface", scope))).toBeGreaterThanOrEqual(7);
    }
  });
});
