# Kontify — Auditoría UX/UI Fase D: tablas, navegación, movimiento y carga

**Fecha:** 2026-10-10
**Alcance:** los 13 módulos con pantalla propia + el armazón (riel, subnav, barra superior, nav móvil).
**Base:** `master` en `ac8d496` (Fases A/B/C cerradas, 257 pruebas).
**Método:** skill `ui-ux-pro-max` (dominios `ux`, `icons`) + lectura de los 68 componentes y 37 rutas.

---

## 0. El encargo, en sus palabras

1. Revisar todos los módulos: navegación inteligente, espaciados, iconos, textos, botones, cajas.
2. **Las tablas deben ocupar la caja completa de la pantalla, nada centrado hacia la izquierda.**
3. **El botón de ayuda está mal ubicado, estorba en esas posiciones.**
4. **Las tablas deben ser organizables** (ordenables por columna).
5. **Animaciones en los desplazamientos.**
6. **Loaders en todos los módulos.**

---

## 1. Hallazgos

### 1.1 Tablas apelotonadas a la izquierda — P0

Las seis tablas de lista (`clients-table`, `products-table`, `stock-table`, `sales-table`,
`quotes-table`, `receivables-table`) son `<table className="hidden w-full text-sm lg:table">`
sin `colgroup`, sin anchos y sin alineación.

`table-layout: auto` reparte por contenido: «Nº», «Total», «Saldo» y «Estado» ocupan lo que
mide su texto y el sobrante se acumula al final. Medido en Ventas a 1366 px: la última
columna termina en x=1210 y la caja en x=1340 — **130 px muertos** y todo el peso visual
pegado al borde izquierdo. Es exactamente lo que él describe.

Además: cifras alineadas a la izquierda (deberían ir a la derecha, con `tabular-nums`, para
que el ojo compare magnitudes), cabecera no pegajosa, y cero envoltorio `overflow-x-auto`
(la guía `Responsive › Table Handling` lo marca como Medium).

### 1.2 Ninguna tabla se puede ordenar — P0

No existe `sort` en ninguna query ni en ninguna URL. El orden está clavado:

| Módulo | Orden fijo hoy | Paginado en servidor |
|---|---|---|
| Clientes | `name` asc | sí (20) |
| Productos | `name` asc | sí (20) |
| Ventas | `created_at` desc | sí |
| Presupuestos | `created_at` desc | sí |
| Inventario | `name` asc | **no** (array completo) |
| Cuentas por cobrar | `totalDue` desc | **no** (array completo) |

Los cuatro paginados **tienen que ordenar en el servidor**: ordenar en el cliente solo
reordena la página visible y miente sobre el total. Los dos no paginados pueden ordenar en
memoria sin engañar a nadie.

### 1.3 El botón de ayuda estorba — P0

`ModuleHeader` mete «¿Cómo funciona?» **dentro del párrafo del subtítulo**:

```tsx
<p className="mt-0.5 max-w-3xl text-sm">{sub} <ModuleGuide guide={g} /></p>
```

Tres problemas:

- **Se mueve.** Cuelga del final del texto, así que su posición depende del largo del
  subtítulo y del ancho de la ventana. En Ventas cae en la segunda línea, en Clientes en la
  primera. WCAG 2.2 criterio 3.2.6 (*Consistent Help*, el buscador de la skill lo devuelve
  como `Accessibility › Consistent Help`) pide justo lo contrario: el mecanismo de ayuda
  repetido debe conservar **el mismo orden relativo en todas las páginas**.
- **Parte la frase.** Un control azul subrayado en medio del párrafo compite con el texto
  que explica el módulo y rompe la lectura.
- **Es minúsculo.** `text-xs` con icono de 14 px: por debajo del objetivo táctil de 44×44.

### 1.4 Cero carga visible — P1

No hay **ni un solo** `loading.tsx` en las 37 rutas, y el único `<Suspense>` del proyecto
envuelve el `FlashToast`. Consecuencias:

- Entrar a Ventas, Clientes o Reportes deja la pantalla anterior congelada mientras corre la
  consulta. Sin señal de que algo pasa.
- Cambiar un filtro o buscar hace `router.push` sin `useTransition`: la tabla se queda con
  los datos viejos, sin atenuar, hasta que el servidor responde.
- `ActionButton` sí tiene `aria-busy` y texto «…», pero `Button` no tiene estado de carga.

### 1.5 Cero movimiento — P1

`globals.css` tiene 38 líneas: tokens de color y nada más. Sin `@keyframes`, sin
`prefers-reduced-motion`. Sheet, Dialog y Popover de Radix aparecen de golpe. Los toasts
aparecen de golpe. Las únicas transiciones del proyecto son tres `transition` sueltas en
riel, subnav y fichas.

La guía `Animation › Excessive Motion` avisa del extremo opuesto: máximo 1–2 elementos
animados por vista. Y `Animation › Reduced Motion` (severidad High) exige respetar la
preferencia del sistema.

### 1.6 Páginas de Configuración encajonadas — P1

Tres pantallas de lista viven dentro de una columna estrecha pegada a la izquierda:

| Página | Ancho |
|---|---|
| Categorías de producto | `max-w-lg` (512 px) |
| Tipos de cliente | `max-w-lg` |
| Tasas de impuesto | `max-w-2xl` (672 px) |

En un monitor de 1366 px eso deja dos tercios de pantalla vacíos. Son listas con acciones
por fila, no formularios: les toca el ancho completo.

### 1.7 Iconos incoherentes — P2

El mismo módulo usa iconos distintos según dónde se mire:

| Módulo | Riel/Subnav | Nav móvil | Estado vacío |
|---|---|---|---|
| Ventas | `FileText` | `ShoppingCart` | `FileText` |
| Presupuestos | `ClipboardList` | — | `ClipboardList` |

Ventas y Presupuestos comparten familia de icono «documento», y encima Ventas cambia de cara
entre escritorio y teléfono.

### 1.8 Espaciado sin ritmo — P2

Cada página elige su propio relleno: `p-6` en nueve, `max-w-lg … p-6` en tres,
`space-y-4` en casi todas pero `mt-4` suelto en Preferencias. En teléfono `p-6` (24 px) se
come ancho útil: debería ser 16 px y crecer a 24 desde `sm`.

### 1.9 Resto de la revisión — sin hallazgo

Botones, colores, contraste y textos quedaron cerrados en la Fase C y siguen bien: una sola
primitiva `Button` con tres variantes, `StatusBadge` con seis tonos y par claro/oscuro, el
test `tests/contrast.test.ts` cubriendo las 24 combinaciones, copy centralizado en
`guides.ts` y `field-help.ts`. **No los toco.** Lo que entra en esta fase es lo que él pidió.

---

## 2. Decisiones de diseño

### 2.1 Primitiva `DataTable`

Una sola tabla para los seis módulos, en `src/components/ui/data-table.tsx`.

```ts
export type Align = "left" | "right" | "center";
export type Column<T> = {
  key: string;              // clave de orden; única en la tabla
  label: string;
  width: string;            // "22%" — suma 100 % entre todas
  align?: Align;            // por defecto "left"
  sortable?: boolean;
  cell: (row: T) => ReactNode;
};
```

- `<colgroup>` con los `width` declarados: reparto explícito, cero espacio muerto.
- `w-full` sobre `<table>` dentro de un `<div className="overflow-x-auto">`.
- Cabecera pegajosa: `sticky top-0 z-10 bg-[var(--surface)]`.
- Columnas de cifras: `text-right tabular-nums`.
- Fila: `transition-colors hover:bg-[var(--bg)]`.
- Celdas: `px-3 py-2.5` (ritmo único).

La tabla se renderiza en el servidor. Solo la cabecera ordenable es cliente.

### 2.2 Orden por columna

Contrato de URL, igual en los seis módulos: `?sort=<key>&dir=asc|desc`.

- Clic en una columna ordenable → si ya es la activa, invierte `dir`; si no, la activa con
  su dirección natural (`asc` para texto, `desc` para cifras y fechas).
- El `<th>` activo lleva `aria-sort="ascending" | "descending"`; los demás `"none"`.
- El indicador es un icono `ChevronUp`/`ChevronDown` **más** el `aria-sort`: nunca solo color
  (guía `Charts & Data › no depender del color`).
- Cambiar el orden borra `page`: volver a la página 7 de otro orden no significa nada.
- **Lista blanca por módulo.** El valor de `sort` que llega por URL se resuelve contra un
  mapa `key → columna de base de datos`; lo que no esté en el mapa cae al orden por defecto.
  Nada que venga del usuario entra crudo en `.order()`.

Dónde ordena cada uno:

| Módulo | Dónde | Columnas ordenables |
|---|---|---|
| Clientes | servidor | Nombre, Tipo, Estado |
| Productos | servidor | Nombre, SKU, Precio, Estado |
| Ventas | servidor | Nº, Fecha, Cliente, Total, Saldo |
| Presupuestos | servidor | Nº, Fecha, Cliente, Total, Vigencia |
| Inventario | memoria | Producto, SKU, Existencia, Mínimo, Estado |
| Cuentas por cobrar | memoria | Cliente, Total adeudado, Vencido, Vto. más antiguo |

«Estado» en Ventas y Presupuestos no es ordenable: su valor se calcula después de la
consulta (`paymentStatusOf`), así que ordenar por él en el servidor daría un orden falso.

### 2.3 El botón de ayuda, fuera del párrafo

`ModuleHeader` queda:

```
┌──────────────────────────────────────────────────────────────┐
│ Ventas                                   [Ayuda ?] [+ Nueva] │
│ Documento de venta interno (no fiscal)…                      │
└──────────────────────────────────────────────────────────────┘
```

- **Siempre el primer control del grupo de la derecha**, antes de la acción primaria, en los
  13 módulos. Mismo orden relativo en todas las páginas → WCAG 3.2.6.
- Variante `secondary` del `Button` ya existente: 40 px de alto, borde, icono `CircleHelp`
  más la palabra «Ayuda». Bajo `sm` la palabra se oculta (`hidden sm:inline`) y queda el
  icono con `aria-label="Cómo funciona"`.
- El subtítulo vuelve a ser solo texto.
- El `ModuleGuide` con texto «¿Cómo funciona?» **se queda** dentro de los estados vacíos: ahí
  no compite con nada y es donde más falta hace.

### 2.4 Carga visible en los 13 módulos

Tres piezas:

1. **`Skeleton`** (`src/components/ui/skeleton.tsx`): bloque con `animate-pulse` y
   `aria-hidden`, más tres composiciones — `TableSkeleton`, `CardsSkeleton`, `FormSkeleton`.
2. **`loading.tsx` por segmento de ruta.** Uno por módulo, con la forma de su página:
   cabecera + barra de filtros + 8 filas. Lo pinta Next en cuanto se navega al segmento.
3. **Transición en los filtros.** Las barras de herramientas (`*-toolbar.tsx`) pasan a
   `useTransition` alrededor del `router.push`, y la caja de la tabla recibe
   `aria-busy` + `opacity-60` mientras `isPending`. Esto cubre lo que `loading.tsx` no cubre:
   cambiar `?q=`, `?status=` o `?sort=` dentro de la misma ruta.

Y `Button` gana `loading?: boolean` → spinner `Loader2` girando, `disabled`, `aria-busy`.

Un `loading.tsx` también en las pantallas sin tabla (dashboard, reportes, detalle de venta,
detalle de presupuesto, ficha de cliente, ficha de producto, configuración), con la
composición que le toque. **Trece módulos, trece loaders.** Las pantallas que hoy son
`ModulePlaceholder` (Cuentas por pagar, Comisiones, Bancos, Gastos) no llevan: no consultan
nada, pintan al instante.

### 2.5 Movimiento

En `globals.css`, cinco keyframes y una regla de respeto:

```css
@keyframes k-fade-in      { from { opacity: 0 } to { opacity: 1 } }
@keyframes k-fade-up      { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: none } }
@keyframes k-slide-right  { from { transform: translateX(100%) }  to { transform: none } }
@keyframes k-slide-up     { from { transform: translateY(100%) }  to { transform: none } }
@keyframes k-scale-in     { from { opacity: 0; transform: scale(.96) } to { opacity: 1; transform: none } }

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 1ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 1ms !important;
    scroll-behavior: auto !important;
  }
}
```

Dónde se usan, y en ningún sitio más (regla de 1–2 elementos por vista):

| Sitio | Entrada | Salida | Duración |
|---|---|---|---|
| Contenido de página (`<main>`) | `k-fade-up` | — | 180 ms |
| Sheet lateral | `k-slide-right` | invertida | 220 / 160 ms |
| Sheet inferior | `k-slide-up` | invertida | 220 / 160 ms |
| Velo de Sheet y Dialog | `k-fade-in` | invertida | 160 / 120 ms |
| Dialog, Popover, Dropdown | `k-scale-in` | invertida | 140 / 110 ms |
| Toast | `k-fade-up` | — | 180 ms |

La salida siempre más corta que la entrada (`exit-faster-than-enter`). Solo se anima
`opacity` y `transform`: nunca `width`/`height`.

Radix expone `data-[state=open]` y `data-[state=closed]`, así que la salida se engancha con
`data-[state=closed]:animate-…` sin librería de animación. Cero dependencias nuevas.

El `<main>` se anima por navegación usando `key={pathname}`: cada ruta monta de nuevo y
dispara el `fade-up`. Es el «desplazamiento» que él pide, en su versión sobria.

### 2.6 Ritmo de espaciado

Una sola envoltura de página, `src/components/shared/page.tsx`:

```tsx
export function Page({ children }: { children: ReactNode }) {
  return <div className="space-y-5 p-4 sm:p-6">{children}</div>;
}
```

Las 13 páginas con módulo la usan. Las tres de Configuración pierden su `max-w-*` y pasan a
ancho completo con `DataTable`. Los formularios (nuevo/editar cliente, producto) **sí**
conservan ancho máximo: un campo de texto de 1300 px es peor, no mejor.

### 2.7 Iconos, uno por módulo

Mapa único en `src/lib/module-icons.ts`, consumido por nav, nav móvil, estados vacíos y
cabeceras:

| Módulo | Icono |
|---|---|
| Dashboard | `LayoutDashboard` |
| Clientes | `Users` |
| Productos | `Package` |
| Inventario | `Boxes` |
| Ventas | `ShoppingCart` |
| Presupuestos | `FileText` |
| Reportes de ventas | `TrendingUp` |
| Reportes de inventario | `Boxes` |
| Cuentas por cobrar | `ArrowDownCircle` |
| Configuración | `Settings` |

Cambia `FileText` → `ShoppingCart` en Ventas (riel y vacío) y `ClipboardList` → `FileText` en
Presupuestos. El resto ya coincide.

---

## 3. Lo que NO entra

- Buscador global funcional y selector de sucursal: siguen apagados, siguen fuera.
- Pantallas reales de Sucursales, Usuarios, Cuentas por pagar, Comisiones, Bancos, Gastos.
- Selección múltiple y acciones en lote (`Data Entry › Bulk Actions`, severidad Low).
- Migas de pan: la guía las pide desde tres niveles de profundidad; Kontify tiene dos.
- Columnas configurables por el usuario y orden persistido por perfil.

---

## 4. Plan de ejecución

| Tanda | Qué | Tareas |
|---|---|---|
| **D1 Tablas** | `DataTable` + orden en los seis módulos | 8 |
| **D2 Ayuda y ritmo** | botón de ayuda, `Page`, Configuración a ancho completo, iconos | 5 |
| **D3 Carga y movimiento** | `Skeleton`, 13 `loading.tsx`, `useTransition` en barras, keyframes, Radix | 6 |

Cada tarea: implementador nuevo, revisión de spec, revisión de calidad. Pruebas con Vitest y
verificación en navegador a 1366 px, 390 px y modo oscuro antes de cerrar cada tanda.
