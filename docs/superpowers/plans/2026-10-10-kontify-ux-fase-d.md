# Kontify UX Fase D — Plan de implementación

> **Para agentes:** SUB-SKILL REQUERIDA: `superpowers:subagent-driven-development`.
> Los pasos usan casillas `- [ ]`.

**Meta:** las tablas ocupan el ancho completo y se ordenan por columna, el botón de ayuda
deja de estorbar, y cada módulo muestra carga y movimiento.

**Arquitectura:** una primitiva `DataTable` con `<colgroup>` que sustituye a las seis tablas
a mano; el orden viaja por URL (`?sort=&dir=`) y se resuelve contra una lista blanca por
módulo (servidor para los cuatro paginados, memoria para los dos que no lo están); el botón
de ayuda sale del párrafo y se fija como primer control del grupo derecho de `ModuleHeader`;
`loading.tsx` por segmento más `useTransition` en las barras de filtro; keyframes propios en
`globals.css` enganchados a los `data-state` de Radix.

**Stack:** Next.js 16.2.10 App Router · React 19 · Tailwind 4 · Radix · Vitest 4.
**Sin dependencias nuevas.**

**Rama:** `feat/ux-fase-d` desde `master` (`ac8d496`).

**Regla de commits:** cada tarea cierra con `git commit -m "…" -- <rutas>`. Nunca `git add -A`.

---

## Estructura de archivos

**Nuevos**
- `src/components/ui/data-table.tsx` — tabla, `colgroup`, cabecera pegajosa
- `src/components/ui/sort-header.tsx` — cabecera ordenable (cliente)
- `src/components/ui/skeleton.tsx` — `Skeleton`, `TableSkeleton`, `CardsSkeleton`, `FormSkeleton`
- `src/components/shared/page.tsx` — envoltura de página con el ritmo único
- `src/lib/sorting.ts` — contrato de orden y resolución contra lista blanca
- `src/lib/module-icons.ts` — un icono por módulo
- `src/app/(app)/**/loading.tsx` — 13 archivos

**Modificados**
- Las seis tablas de lista y sus seis barras de herramientas
- Las seis queries de lista (`clientes`, `productos`, `ventas`, `presupuestos`, `inventario`, `cobros`)
- Las seis páginas de lista, más dashboard, reportes y las tres de configuración
- `src/components/shared/module-header.tsx`, `module-guide.tsx`
- `src/components/ui/button.tsx`, `sheet.tsx`, `dropdown-menu.tsx`, `popover.tsx`, `confirm-dialog.tsx`, `toast.tsx`
- `src/components/shell/app-shell.tsx`, `rail.tsx`, `mobile-bottom-nav.tsx`, `src/lib/nav.ts`
- `src/app/globals.css`

---

# TANDA D1 — Tablas

## Tarea 1: contrato de orden (`src/lib/sorting.ts`)

**Archivos:** Crear `src/lib/sorting.ts` · Probar `src/lib/sorting.test.ts`

- [ ] **Paso 1: prueba que falla**

```ts
import { describe, it, expect } from "vitest";
import { resolveSort, nextSortParams, type SortSpec } from "@/lib/sorting";

const SPEC: SortSpec = {
  default: { key: "name", dir: "asc" },
  columns: {
    name: { column: "name", natural: "asc" },
    price: { column: "price", natural: "desc" },
  },
};

describe("resolveSort", () => {
  it("devuelve el defecto cuando no hay parámetros", () => {
    expect(resolveSort(SPEC, undefined, undefined)).toEqual({ key: "name", dir: "asc", column: "name", ascending: true });
  });
  it("devuelve el defecto cuando la clave no está en la lista blanca", () => {
    expect(resolveSort(SPEC, "password", "asc").key).toBe("name");
  });
  it("ignora una dirección inventada y usa la natural de la columna", () => {
    expect(resolveSort(SPEC, "price", "arriba")).toEqual({ key: "price", dir: "desc", column: "price", ascending: false });
  });
  it("respeta la dirección pedida", () => {
    expect(resolveSort(SPEC, "price", "asc").ascending).toBe(true);
  });
});

describe("nextSortParams", () => {
  it("al pulsar la columna activa invierte la dirección", () => {
    expect(nextSortParams(SPEC, { key: "name", dir: "asc" }, "name")).toEqual({ sort: "name", dir: "desc" });
  });
  it("al pulsar otra columna usa su dirección natural", () => {
    expect(nextSortParams(SPEC, { key: "name", dir: "asc" }, "price")).toEqual({ sort: "price", dir: "desc" });
  });
  it("una clave fuera de la lista blanca no cambia nada", () => {
    expect(nextSortParams(SPEC, { key: "name", dir: "asc" }, "drop")).toEqual({ sort: "name", dir: "asc" });
  });
});
```

- [ ] **Paso 2: correr y verlo fallar**

`npx vitest run src/lib/sorting.test.ts` → FAIL, módulo no encontrado.

- [ ] **Paso 3: implementar**

```ts
export type SortDir = "asc" | "desc";
export type SortColumn = { column: string; natural: SortDir; nullsFirst?: boolean };
export type SortSpec = { default: { key: string; dir: SortDir }; columns: Record<string, SortColumn> };
export type ResolvedSort = { key: string; dir: SortDir; column: string; ascending: boolean };

/** Traduce lo que llega por URL a una orden segura. Lo que no esté en `spec.columns`
 *  cae al defecto: nada que escriba el usuario llega crudo a `.order()`. */
export function resolveSort(spec: SortSpec, key: string | undefined, dir: string | undefined): ResolvedSort {
  const k = key && key in spec.columns ? key : spec.default.key;
  const col = spec.columns[k];
  const d: SortDir = dir === "asc" || dir === "desc" ? dir : (col?.natural ?? spec.default.dir);
  return { key: k, dir: d, column: col?.column ?? k, ascending: d === "asc" };
}

/** Qué par (sort, dir) toca al pulsar `clicked`: invertir si ya era la activa,
 *  o estrenarla con su dirección natural. */
export function nextSortParams(spec: SortSpec, current: { key: string; dir: SortDir }, clicked: string): { sort: string; dir: SortDir } {
  if (!(clicked in spec.columns)) return { sort: current.key, dir: current.dir };
  if (clicked === current.key) return { sort: clicked, dir: current.dir === "asc" ? "desc" : "asc" };
  return { sort: clicked, dir: spec.columns[clicked].natural };
}

/** Comparador en memoria para las listas que no pagina el servidor. */
export function compareBy<T>(rows: T[], pick: (r: T) => string | number | null, ascending: boolean): T[] {
  const sign = ascending ? 1 : -1;
  return [...rows].sort((a, b) => {
    const x = pick(a), y = pick(b);
    if (x === null && y === null) return 0;
    if (x === null) return 1;   // los vacíos siempre al final, en los dos sentidos
    if (y === null) return -1;
    if (typeof x === "number" && typeof y === "number") return (x - y) * sign;
    return String(x).localeCompare(String(y), "es", { numeric: true, sensitivity: "base" }) * sign;
  });
}
```

- [ ] **Paso 4: correr y verlo pasar** — `npx vitest run src/lib/sorting.test.ts`
- [ ] **Paso 5: commit** — `git commit -m "feat(tablas): contrato de orden con lista blanca" -- src/lib/sorting.ts src/lib/sorting.test.ts`

---

## Tarea 2: `DataTable` y `SortHeader`

**Archivos:** Crear `src/components/ui/data-table.tsx`, `src/components/ui/sort-header.tsx` · Probar `src/components/ui/data-table.test.tsx`

- [ ] **Paso 1: prueba que falla** (`// @vitest-environment jsdom`, `afterEach(cleanup)`)

Debe verificar: que se emite un `<colgroup>` con un `<col>` por columna y su `width`; que
la columna activa lleva `aria-sort="ascending"` y las demás `"none"`; que una columna sin
`sortable` no renderiza botón; que las celdas `align: "right"` llevan `text-right` y
`tabular-nums`.

- [ ] **Paso 2: correr y verlo fallar**

- [ ] **Paso 3: implementar `data-table.tsx`** (servidor)

```tsx
import type { ReactNode } from "react";
import { SortHeader } from "./sort-header";
import type { SortDir } from "@/lib/sorting";

export type Align = "left" | "right" | "center";
export type Column<T> = {
  key: string; label: string; width: string;
  align?: Align; sortable?: boolean; cell: (row: T) => ReactNode;
};

const ALIGN: Record<Align, string> = { left: "text-left", right: "text-right tabular-nums", center: "text-center" };

/** Tabla de lista única de Kontify. El `<colgroup>` reparte el ancho de forma explícita:
 *  con `table-layout: auto` el sobrante se amontonaba al final y el contenido quedaba
 *  pegado al borde izquierdo. Se oculta bajo `lg`: ahí mandan las fichas por fila. */
export function DataTable<T>({ rows, columns, rowKey, sort }: {
  rows: T[]; columns: Column<T>[]; rowKey: (row: T) => string;
  sort?: { key: string; dir: SortDir };
}) {
  return (
    <div className="hidden overflow-x-auto lg:block">
      <table className="w-full text-sm">
        <colgroup>{columns.map((c) => <col key={c.key} style={{ width: c.width }} />)}</colgroup>
        <thead>
          <tr className="border-b border-[var(--border)] text-xs text-[var(--text-soft)]">
            {columns.map((c) => {
              const active = sort?.key === c.key;
              const align = ALIGN[c.align ?? "left"];
              return (
                <th key={c.key} scope="col"
                  aria-sort={!c.sortable ? undefined : active ? (sort!.dir === "asc" ? "ascending" : "descending") : "none"}
                  className={`sticky top-0 z-10 bg-[var(--surface)] px-3 py-2 font-medium ${align}`}>
                  {c.sortable
                    ? <SortHeader columnKey={c.key} label={c.label} align={c.align ?? "left"} active={active} dir={active ? sort!.dir : null} />
                    : c.label}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={rowKey(r)} className="border-b border-[var(--border)] transition-colors hover:bg-[var(--bg)]">
              {columns.map((c) => (
                <td key={c.key} className={`px-3 py-2.5 ${ALIGN[c.align ?? "left"]}`}>{c.cell(r)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Paso 4: implementar `sort-header.tsx`** (cliente)

Un `<button>` con el label y `ChevronUp`/`ChevronDown` cuando está activo, `ChevronsUpDown`
atenuado cuando no. Al pulsar: lee `useSearchParams`, calcula el siguiente par con
`nextSortParams`, **borra `page`** y hace `router.push` dentro de `useTransition`. Mientras
`isPending`, `aria-busy` en el botón. El icono es decorativo (`aria-hidden`): el estado lo
comunica el `aria-sort` del `<th>`.

El `SortSpec` no viaja al cliente: `nextSortParams` necesita solo la dirección natural de la
columna pulsada, así que `SortHeader` recibe `natural?: SortDir` como prop y hace el cálculo
en línea (activa → invertir; otra → su natural).

- [ ] **Paso 5: correr pruebas y commit**

`git commit -m "feat(tablas): primitiva DataTable con colgroup y cabecera ordenable" -- src/components/ui/data-table.tsx src/components/ui/sort-header.tsx src/components/ui/data-table.test.tsx`

---

## Tareas 3–8: un módulo por tarea

Mismo guion seis veces. Para cada módulo:

1. Definir su `SortSpec` junto a su query (`src/lib/<mod>/queries.ts`).
2. La query acepta `sort?: string; dir?: string`, resuelve con `resolveSort` y aplica
   `.order(column, { ascending, nullsFirst })` (paginados) o `compareBy` (en memoria).
3. La tabla pasa a `DataTable` con sus `Column[]`, anchos que sumen 100 % y las cifras a la
   derecha.
4. La página lee `sort`/`dir` de `searchParams`, los pasa a la query y a `DataTable`, y los
   arrastra en los enlaces de paginación.
5. Prueba: la query con una clave inventada devuelve el orden por defecto; con una válida,
   `.order()` recibe la columna esperada.

Reparto de anchos (suman 100):

| Tarea | Módulo | Columnas → ancho · alineación |
|---|---|---|
| 3 | Clientes | Nombre 40 I · Tipo 18 I · Contacto 26 I · Estado 16 I |
| 4 | Productos | Nombre 34 I · SKU 16 I · Categoría 20 I · Precio 16 **D** · Estado 14 I |
| 5 | Inventario | Producto 38 I · SKU 18 I · Existencia 14 **D** · Mínimo 14 **D** · Estado 16 I |
| 6 | Ventas | Nº 8 I · Fecha 14 I · Cliente 32 I · Total 16 **D** · Saldo 16 **D** · Estado 14 I |
| 7 | Presupuestos | Nº 8 I · Fecha 14 I · Cliente 32 I · Total 16 **D** · Vigencia 16 I · Estado 14 I |
| 8 | Cuentas por cobrar | Cliente 40 I · Total adeudado 20 **D** · Vencido 20 **D** · Vto. más antiguo 20 I |

`SortSpec` por módulo (clave → columna de base de datos · dirección natural):

- **Clientes** — defecto `name asc`. `name→name asc`, `type→client_types(name) asc`, `status→active desc`.
- **Productos** — defecto `name asc`. `name→name asc`, `sku→sku asc` (`nullsFirst: false`), `price→price desc`, `status→active desc`.
- **Ventas** — defecto `date desc`. `number→number desc` (`nullsFirst: false`), `date→created_at desc`, `client→clients(name) asc`, `total→total desc`, `balance→balance desc`.
- **Presupuestos** — defecto `date desc`. `number→number desc`, `date→created_at desc`, `client→clients(name) asc`, `total→total desc`, `validUntil→valid_until asc` (`nullsFirst: false`).
- **Inventario** (memoria) — defecto `name asc`. `name`, `sku`, `qty desc`, `minStock desc`, `status asc`.
- **Cuentas por cobrar** (memoria) — defecto `totalDue desc`. `name asc`, `totalDue desc`, `overdue desc`, `oldestDue asc`.

«Estado» en Ventas y Presupuestos **no** es ordenable: se calcula después de la consulta.

Commit por tarea, con las rutas de ese módulo solamente.

---

# TANDA D2 — Ayuda, ritmo y iconos

## Tarea 9: el botón de ayuda sale del párrafo

**Archivos:** Modificar `src/components/shared/module-header.tsx`, `module-guide.tsx` · Probar `src/components/shared/module-header.test.tsx`

- [ ] **Paso 1: prueba que falla** — el subtítulo no contiene ningún `<button>`; el grupo de
  la derecha existe aunque no haya `actions`; dentro de ese grupo el botón de ayuda es el
  **primer** hijo; su nombre accesible es «Cómo funciona».

- [ ] **Paso 2: correr y verlo fallar**

- [ ] **Paso 3: implementar**

`ModuleGuide` acepta `variant: "link" | "button"`. En `"button"` usa `buttonCls("secondary")`
con `<CircleHelp/>` más `<span className="hidden sm:inline">Ayuda</span>` y
`aria-label="Cómo funciona"`. En `"link"` se queda como está (lo usan los estados vacíos).

`ModuleHeader`:

```tsx
<div className="flex flex-wrap items-start justify-between gap-3">
  <div className="min-w-0">
    <h1 className="text-xl font-extrabold tracking-[-0.4px] text-[var(--text)]">{title ?? g.title}</h1>
    {sub && <p className="mt-1 max-w-3xl text-sm text-[var(--text-soft)]">{sub}</p>}
  </div>
  <div className="flex shrink-0 items-center gap-2">
    <ModuleGuide guide={g} variant="button" />
    {actions}
  </div>
</div>
```

- [ ] **Pasos 4–5: pruebas y commit**

## Tarea 10: envoltura `Page` y ritmo único

Crear `src/components/shared/page.tsx` (`space-y-5 p-4 sm:p-6`) y aplicarla en las 13
páginas con módulo. Formularios de alta/edición conservan su ancho máximo.

## Tarea 11: Configuración a ancho completo

Las tres páginas de lista (`categorias-de-producto`, `tipos-de-cliente`,
`tasas-de-impuesto`) pierden `max-w-lg`/`max-w-2xl` y pasan a `DataTable` con columna de
acciones a la derecha. Sin orden por columna: son listas cortas y ya vienen por nombre.

## Tarea 12: un icono por módulo

Crear `src/lib/module-icons.ts` y consumirlo desde `nav.ts`, `mobile-bottom-nav.tsx` y los
estados vacíos. Ventas → `ShoppingCart`, Presupuestos → `FileText`.

## Tarea 13: `Button` con estado de carga

`loading?: boolean` → `Loader2` con `animate-spin`, `disabled`, `aria-busy`. Prueba: con
`loading` el botón está deshabilitado y conserva su nombre accesible.

---

# TANDA D3 — Carga y movimiento

## Tarea 14: `Skeleton` y sus composiciones

`Skeleton` (`animate-pulse rounded bg-[var(--border)]`, `aria-hidden`), más `TableSkeleton`
(cabecera + N filas con los anchos de columna), `CardsSkeleton` y `FormSkeleton`. El
contenedor del loader lleva `role="status"` y un `<span className="sr-only">Cargando…</span>`
una sola vez, no por fila.

## Tarea 15: 13 `loading.tsx`

Uno por segmento: dashboard, clientes, clientes/[id], productos, productos/[id], inventario,
facturación, facturación/[id], presupuestos, presupuestos/[id], cuentas-por-cobrar,
reportes/ventas, reportes/inventario. Cada uno repite la forma de su página: cabecera, barra
y contenido. Las rutas `ModulePlaceholder` no llevan.

## Tarea 16: transición en las seis barras de filtro

Cada `*-toolbar.tsx` envuelve su `router.push` en `useTransition` y expone el estado por
`data-pending` en el contenedor de la barra. La caja de la tabla de cada página recibe
`aria-busy` y `opacity-60 transition-opacity` mientras haya navegación en curso. El buscador
pasa de «Enter» a un `onChange` con rebote de 300 ms, conservando Enter.

## Tarea 17: keyframes y respeto a la preferencia de movimiento

Los cinco `@keyframes` y el bloque `prefers-reduced-motion` de la §2.5 del diseño, en
`globals.css`. Prueba en `tests/`: el archivo contiene la media query y cada keyframe
declarado se usa al menos una vez en el código.

## Tarea 18: Radix animado

`sheet.tsx`, `dropdown-menu.tsx`, `popover.tsx`, `confirm-dialog.tsx` y `toast.tsx` reciben
las clases `data-[state=open]:animate-…` / `data-[state=closed]:animate-…` de la tabla de la
§2.5. **Cuidado:** no añadir `relative` ni ninguna clase de posición al contenido del Sheet
— ya rompió el panel una vez (quedó fuera de pantalla). La prueba existente
`src/components/ui/sheet.test.tsx` debe seguir pasando.

## Tarea 19: entrada de página

`app-shell.tsx` envuelve `children` con `key={pathname}` y la clase de `k-fade-up` 180 ms.
Un solo elemento animado por vista.

---

## Cierre

- `npx tsc --noEmit` limpio.
- `npx vitest run` — las 257 existentes más las nuevas, todas en verde.
- `npm run build` sin error.
- Paseo con navegador a 1366 px, 390 px y en modo oscuro: ordenar por tres columnas
  distintas, ver el esqueleto al navegar, ver la barra atenuada al filtrar, abrir el panel de
  ayuda desde la cabecera en tres módulos.
- Merge a `master` con `--no-ff`.


---

# Lo que realmente se construyó

Tres commits sobre `feat/ux-fase-d`, más uno de documentación.

## Piezas nuevas

| Archivo | Para qué |
|---|---|
| `src/lib/sorting.ts` | `resolveSort`, `nextSortParams`, `toggleDir`, `compareBy` |
| `src/components/ui/data-table.tsx` | tabla con `colgroup`, cabecera pegajosa, alineación por columna |
| `src/components/ui/sort-header.tsx` | cabecera ordenable (cliente) |
| `src/components/ui/skeleton.tsx` | `Skeleton`, `Loading`, `HeaderSkeleton`, `ToolbarSkeleton`, `TableSkeleton`, `CardsSkeleton`, `FormSkeleton` |
| `src/components/shared/page.tsx` | ritmo único de página |
| `src/components/shared/list-box.tsx` | caja de lista |
| `src/components/shared/pagination.tsx` | paginación que conserva filtros y orden |
| `src/components/shared/toolbar.tsx` | `useFilterParams`, `Toolbar`, `SearchField` con rebote |
| `src/components/configuracion/settings-list.tsx` | listas de Configuración a ancho completo |
| `src/lib/module-icons.ts` | un icono por módulo |
| 17 `loading.tsx` | esqueleto por segmento de ruta |

## Diferencias con el plan

1. **El esqueleto al filtrar no salió de `useTransition`, sino de `<Suspense>` con clave.**
   Cada página mueve su consulta a un componente hijo asíncrono envuelto en
   `<Suspense key={filtros}>`. Al cambiar cualquier parámetro la clave cambia, el bloque
   se vuelve a suspender y se ve el esqueleto en lugar de la lista vieja congelada.
   `useTransition` se quedó solo para atenuar la barra de filtros mientras navega.

2. **Las listas de Configuración no son `DataTable`.** Cada fila es un formulario con
   campos editables; una tabla no deja que un `<form>` cruce celdas. Son filas flexibles
   a ancho completo (`SettingsList`), con el botón «Guardar» fuera del formulario y
   atado a él por el atributo `form`. Verificado en navegador: guarda.

3. **La cabecera quedó en dos filas, no en una.** Título y botones arriba, subtítulo
   debajo a todo el ancho. Compartir fila dejaba el subtítulo en una columna de seis
   renglones en teléfono.

4. **Las cuatro guías de Configuración, que estaban vacías, se escribieron.** Sin pasos
   no se renderiza el botón de ayuda, así que esas cuatro pantallas se quedaban sin él y
   rompían la coherencia que busca el criterio WCAG 2.2 · 3.2.6.

5. **`resolveSort` ignora también la dirección cuando la clave no existe.** Lo descubrió
   la prueba de integración: con `?sort=basura&dir=desc` la lista salía al revés del
   orden por defecto. Una columna que no existe no es media orden válida.

6. **El botón de ayuda mide 44×44 en teléfono** (`max-sm:h-11 max-sm:w-11`), donde se
   queda solo con el icono.

## Verificación

- `npx tsc --noEmit` limpio · `npm run build` OK · **297 pruebas en verde** (257 antes).
- Pruebas nuevas: `src/lib/sorting.test.ts`, `src/components/ui/data-table.test.tsx`,
  `src/components/ui/button.test.tsx`, `src/components/shared/module-header.test.tsx`,
  `src/components/shared/toolbar.test.tsx`, `tests/sorting-lists.test.ts`, `tests/motion.test.ts`.
- Navegador a 1366 px, 390 px y en oscuro, sin un solo error de consola:
  - las seis tablas van de 349 a 1325 dentro de una caja de 332 a 1342, sin hueco muerto;
  - ordenar por Total invierte de verdad y pone `aria-sort`;
  - buscar «Farm» con rebote deja la URL en `?q=Farm` y una fila;
  - el botón de ayuda está a `y=80` en los 13 módulos;
  - las tres listas de Configuración van de 333 a 1341;
  - en teléfono no hay desbordamiento horizontal y la ayuda mide 44×44.
