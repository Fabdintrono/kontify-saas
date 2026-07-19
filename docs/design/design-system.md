# Kontify — Sistema de Diseño (UX/UI)

> Fuente de verdad de todas las decisiones visuales y de interacción tomadas en el brainstorming.
> Todo lo que se implemente debe respetar este documento para que el producto quede idéntico a lo aprobado.
> Mockups de referencia en `docs/design/mockups/`.

Fecha de definición: 2026-07-19.

---

## 1. Marca

- **Nombre:** Kontify (raíz "cuenta / control" + sufijo `-fy` estilo Spotify/Shopify → "hacer / gestionar").
- **Dominio:** `kontify.app` (disponible). Subdominios por cliente: `cliente.kontify.app`.
- **Personalidad:** plataforma de gestión seria pero fresca, abarca todo el sistema (no un solo módulo). Debe sentirse más pulida y premium que Fina / Cuadra / Cachicamo.
- **Logo tentativo:** wordmark "Kontify" + isotipo tile "K" en gradiente teal. (Diseño final de logo pendiente).

## 2. Paleta — "Teal & Slate" (claro / oscuro)

Ambos modos son obligatorios desde el día uno.

| Rol | Claro | Oscuro |
|-----|-------|--------|
| Primario / acento | `#0e7490` (teal-700) | `#0e7490` / hover `#14b8a6` |
| Acento claro / gradiente | `#2dd4bf` → `#14b8a6` | `#2dd4bf` / `#5eead4` |
| Fondo app | `#f1f5f9` (slate-100) / `#f6f8fb` | `#0b1220` |
| Superficie / cards | `#ffffff` | `#111c30` |
| Borde | `#e8edf2` / `#eef2f6` | `#26334a` / `#334155` |
| Texto principal | `#0f172a` (slate-900) | `#e2e8f0` |
| Texto secundario | `#64748b` (slate-500) | `#94a3b8` |
| Éxito / positivo | `#0f766e` / `#059669` | `#5eead4` / `#6ee7b7` |
| Alerta / warning | `#b45309` / `#f59e0b` | `#fbbf24` |
| Peligro / negativo | `#dc2626` / `#ef4444` | `#f87171` |
| Info | `#1d4ed8` | `#7dd3fc` |

- Gradiente de marca (hero, FAB, tiles activos): `linear-gradient(135deg, #0e7490, #14b8a6)`.
- El riel nivel 1 (dual-tier) usa fondo slate-900 `#0f172a` en ambos modos.

## 3. Iconografía

- **Librería: Lucide** (line icons, stroke-width 2, `stroke: currentColor`).
- **Prohibido usar emojis en la UI** (salvo el 👋 del saludo, opcional). Cada acción/KPI tiene su icono Lucide adecuado.

## 4. Tipografía

- `system-ui` (stack nativo) por rendimiento y look limpio; se puede sustituir por Inter si se desea.
- Escala: títulos de página 20–23px/800; valores KPI 19–23px/800; labels 10–12px/600; cuerpo 12–14px.
- `letter-spacing: -0.4px` en títulos y valores grandes.

## 5. Navegación — Dual-tier sidebar (escritorio)

Patrón inspirado en Untitled UI (referencia Dribbble aprobada). **No** usar el sidebar oscuro pesado clásico.

- **Nivel 1 — riel de iconos (72px, fondo `#0f172a`):** un icono por sección de primer nivel: Inicio, Clientes, Operaciones, Reportes, Finanzas, y abajo Configuración + avatar. Icono activo en tile gradiente teal con glow. Tooltips al hover.
- **Nivel 2 — panel de sub-navegación (236px, claro):** muestra los ítems hijos de la sección seleccionada en nivel 1. Cambia al hacer clic en cada icono. Título de sección arriba.
  - Ítem activo: fondo teal tenue `#e6f7f4`, texto teal, barra de acento izquierda de 3px.
- **Toggle:** icono nativo **"panel-left"** (rectángulo con línea a la izquierda, tipo VS Code/Notion/Linear) en el **top bar arriba a la izquierda**. Colapsa/expande el nivel 2 con transición de ancho (0.28s). NO usar hamburguer, NO poner el toggle en la costura.
- **Top bar:** toggle · buscador global · selector de sucursal (chip) · campana con badge · avatar.
- **FAB "Vender":** botón flotante abajo a la derecha, **forma squircle** (border-radius ~40%, gradiente teal), con **solo el símbolo "+"** (sin texto). Acción: venta rápida.

### Agrupación (IA) del menú
- **Inicio** → Dashboard, Notificaciones, Actividad
- **Clientes** → Todos los clientes, Nuevo cliente
- **Operaciones** → Productos, Facturación, Presupuestos
- **Reportes** → Inventario, Ventas
- **Finanzas** → Cuentas por pagar, Cuentas por cobrar, Comisiones, Bancos, Gastos
- **Configuración** → Sucursales, Usuarios y roles, Preferencias

## 6. Navegación — Móvil (mobile-first)

- **Barra inferior:** Inicio · Vender · **[ + ]** (squircle central, gradiente teal, solo símbolo, elevado −18/22px) · Inventario · Más.
  - La forma del "+" central es **squircle** (border-radius ~22 sobre 46px), NO círculo pleno.
- **Top bar limpio:** solo selector de sucursal + campana con badge. **Sin avatar en el top bar.**
- **"Más":** hoja/sección que contiene arriba el **perfil** (avatar, nombre, rol, "Ver perfil"), y luego Cuenta (Cambiar sucursal, Configuración) / Módulos (Presupuestos, Reportes, Finanzas) / Otros (Ayuda, Cerrar sesión).
- **Sin scrollbar visible** (mobile se desplaza con el dedo): `scrollbar-width:none` + `::-webkit-scrollbar{display:none}`.

## 7. Dashboard

### Escritorio (completo) — ver `mockups/desktop-dashboard.html`
Orden de arriba a abajo:
1. Saludo ("Buenos días / Fabrizio") + selector de periodo (Hoy / Semana / Mes / Año).
2. **KPIs primarios (4):** Ventas del mes (+trend, sparkline) · Utilidad del mes (+margen %) · **Total de clientes** (+nuevos del mes) · **Valor de inventario** (+nº productos + rotación).
3. **KPIs secundarios (4):** Por cobrar · Por pagar · Ticket promedio · Bajo stock / agotados.
4. **Ventas de la semana** (barras) + **Estado del inventario** (donut: En stock / Bajo / Agotado, estilo supply-chain Zaiko).
5. **Top productos** (ranking con barras) · **Clientes por tipo** (Minorista/Mayorista/Frecuentes/Nuevos — segmentos configurables por negocio) · **Requieren atención** (bajo stock, factura vencida, pago a proveedor).
- El **selector de periodo** recalcula todo. El **selector de sucursal** permite ver una sede o el consolidado ("Todas").

### Móvil (resumido) — ver `mockups/mobile-dashboard-lean.html`
Solo lo esencial de un vistazo:
1. Saludo.
2. **Hero:** Utilidad del mes (+trend +margen, sparkline).
3. **4 KPIs:** Ventas del mes · Total clientes · Por cobrar · Bajo stock.
4. **Requieren atención** (2 ítems).
- El donut de inventario, top productos y clientes por tipo **no** van en el inicio móvil: viven dentro de sus módulos.

## 8. Componentes base (tokens de forma)

- Radios: cards 14px · inputs/botones 9–11px · tiles de icono 12–13px · FAB squircle ~40%.
- Cards: `1px` borde + fondo superficie; sombra sutil solo en elementos elevados (FAB, hover).
- KPI card: icono en tile de color tenue + label + valor grande + trend chip (▲/▼ con color semántico).
- Chips/badges de estado con colores semánticos de la paleta.

## 9. Multi-sucursal en la UI

- Selector de sucursal siempre visible (top bar escritorio / móvil). Opción "Todas" = consolidado.
- Owner/Admin/Administrativo ven todas las sedes y consolidado; Vendedor/Cajero/Almacén ven su sucursal.

## 10. Referencias de mockups aprobados

| Archivo | Qué muestra |
|---------|-------------|
| `mockups/naming.html` | Exploración de nombre (Kontify) |
| `mockups/palette-directions.html` | Direcciones de paleta (elegida: A · Teal & Slate) |
| `mockups/desktop-shell-dual-tier.html` | Shell dual-tier + toggle panel-left (aprobado) |
| `mockups/desktop-dashboard.html` | Dashboard escritorio completo |
| `mockups/mobile-dashboard-lean.html` | Dashboard móvil resumido |
| `mockups/mobile-fab-and-profile.html` | "+" squircle + perfil dentro de "Más" |

> Nota: algunos mockups fueron iterados; ante cualquier discrepancia, **este documento manda** (FAB = squircle "+", móvil sin avatar en top bar, perfil en "Más").
