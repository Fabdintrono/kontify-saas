import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const css = readFileSync("src/app/globals.css", "utf8");

function allSources(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) allSources(p, out);
    else if (/\.tsx?$/.test(name) && !name.endsWith(".test.ts") && !name.endsWith(".test.tsx")) {
      out.push(readFileSync(p, "utf8"));
    }
  }
  return out;
}
const code = allSources("src").join("\n");

describe("movimiento", () => {
  it("respeta prefers-reduced-motion", () => {
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toMatch(/animation-duration:\s*1ms\s*!important/);
    expect(css).toMatch(/transition-duration:\s*1ms\s*!important/);
  });

  it("cada animación declarada se usa en algún sitio", () => {
    const declaradas = [...css.matchAll(/--animate-([a-z-]+):/g)].map((m) => m[1]);
    expect(declaradas.length).toBeGreaterThan(0);
    const sinUso = declaradas.filter((n) => !code.includes(`animate-${n}`));
    expect(sinUso).toEqual([]);
  });

  it("cada animación usada está declarada", () => {
    const declaradas = new Set([...css.matchAll(/--animate-([a-z-]+):/g)].map((m) => m[1]));
    // `animate-pulse` y `animate-spin` las trae Tailwind.
    const deTailwind = new Set(["pulse", "spin", "bounce", "ping"]);
    const usadas = [...code.matchAll(/\banimate-([a-z-]+)\b/g)].map((m) => m[1]);
    const huérfanas = [...new Set(usadas)].filter((n) => !declaradas.has(n) && !deTailwind.has(n));
    expect(huérfanas).toEqual([]);
  });

  it("solo se animan opacity y transform: nunca width ni height", () => {
    const keyframes = [...css.matchAll(/@keyframes\s+k-[a-z-]+\s*\{([\s\S]*?)\n\s*\}/g)].map((m) => m[1]);
    expect(keyframes.length).toBeGreaterThan(0);
    for (const k of keyframes) {
      expect(k).not.toMatch(/\b(width|height|top|left|right|bottom|margin)\s*:/);
    }
  });

  it("toda salida es más corta que su entrada", () => {
    const dur = (n: string) => {
      const m = css.match(new RegExp(`--animate-${n}:[^;]*?(\\d+)ms`));
      return m ? Number(m[1]) : null;
    };
    for (const [entrada, salida] of [
      ["fade-in", "fade-out"], ["scale-in", "scale-out"],
      ["slide-right-in", "slide-right-out"], ["slide-up-in", "slide-up-out"],
      ["dialog-in", "dialog-out"],
    ]) {
      const a = dur(entrada), b = dur(salida);
      expect(a, `falta --animate-${entrada}`).not.toBeNull();
      expect(b, `falta --animate-${salida}`).not.toBeNull();
      expect(b!).toBeLessThan(a!);
    }
  });
});
