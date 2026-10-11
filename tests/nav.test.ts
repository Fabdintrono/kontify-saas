import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { NAV, CONFIG_SECTION, navForRole, resolveActiveSection } from "@/lib/nav";

const BASE = "src/app/(app)";

function rutas(dir: string, url = ""): string[] {
  const out: string[] = [];
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) out.push(...rutas(p, `${url}/${n}`));
    else if (n === "page.tsx") out.push(url);
  }
  return out;
}

const TODAS = rutas(BASE);
const DINAMICA = (r: string) => r.includes("[");
const ESTATICAS = TODAS.filter((r) => !DINAMICA(r));
const HOJAS = [...NAV, CONFIG_SECTION].flatMap((s) => s.children);

describe("el menú y las rutas van de la mano", () => {
  it("toda entrada del menú lleva a una página que existe", () => {
    const rotas = HOJAS.filter((h) => !TODAS.includes(h.href)).map((h) => `${h.label} → ${h.href}`);
    expect(rotas).toEqual([]);
  });

  it("toda pantalla de módulo está en el menú o cuelga de una que sí lo está", () => {
    const enMenu = new Set(HOJAS.map((h) => h.href));
    // Las de crear y editar no van en el menú: se llega desde su lista.
    const accesorias = /\/(nuevo|nueva|editar|importar)$/;
    const huerfanas = ESTATICAS.filter((r) => !enMenu.has(r) && !accesorias.test(r));
    expect(huerfanas).toEqual([]);
  });

  it("cada pantalla accesoria cuelga de alguna del menú", () => {
    const enMenu = new Set(HOJAS.map((h) => h.href));
    // Se sube por la ruta hasta dar con una entrada del menú: «/finanzas/gastos/fijos/nuevo»
    // cuelga de «/finanzas/gastos», aunque «/fijos» sea solo una pestaña y no una ruta.
    const tieneAncestro = (r: string) => {
      let p = r;
      while (p.includes("/")) {
        p = p.slice(0, p.lastIndexOf("/"));
        if (enMenu.has(p)) return true;
      }
      return false;
    };
    const sinPadre = ESTATICAS
      .filter((r) => /\/(nuevo|nueva|editar|importar)$/.test(r))
      .filter((r) => !tieneAncestro(r));
    expect(sinPadre).toEqual([]);
  });

  it("lo marcado «pronto» es exactamente lo que aún no está construido", () => {
    const marcadas = HOJAS.filter((h) => h.pronto).map((h) => h.href).sort();
    const vacias = ESTATICAS
      .filter((r) => readFileSync(join(BASE, r, "page.tsx"), "utf8").includes("ModulePlaceholder"))
      .sort();
    expect(marcadas).toEqual(vacias);
  });

  it("cada ruta del menú resuelve su sección, para que el riel se ilumine", () => {
    for (const h of HOJAS) {
      expect(resolveActiveSection(h.href), h.href).not.toBeNull();
    }
  });

  it("un vendedor no ve en el menú lo que su rol no puede abrir", () => {
    const hrefs = navForRole("vendedor").flatMap((s) => s.children.map((c) => c.href));
    expect(hrefs).not.toContain("/finanzas/cuentas-por-cobrar");
    expect(hrefs).toContain("/operaciones/facturacion");
  });
});
