# Kontify — Auditoría UX/UI y propuesta de ayuda contextual

Fecha: 2026-10-10 · Estado: **PROPUESTA, pendiente de OK de Fabrizio** · Respeta `docs/design/design-system.md` (paleta Teal & Slate, Lucide, dual-tier, FAB squircle: nada de eso cambia).

## 1. Resumen

Base visual sólida y coherente: paleta, riel, panel, cards y chips se ven premium en claro y oscuro. Lo que falta para que "cualquier negocio" lo use sin manual es **explicar y guiar**: ningún módulo dice para qué sirve ni cómo empezar, los vacíos no llevan a la acción, las acciones destructivas no piden confirmación y varios controles están muertos (buscador, campana). Además aparecieron **4 bugs funcionales** (1 ya corregido).

Método: recorrido real con usuario `demo@kontify.app` (datos sembrados: 4 clientes, 6 productos, stock, 3 ventas emitidas, 1 borrador, 1 presupuesto), 60 capturas escritorio / móvil 390px / modo oscuro, auditoría DOM (labels, nombres accesibles, tamaños), cálculo de contrastes, guía `ui-ux-pro-max` e investigación de Shopify Polaris, Alegra, Odoo, Cachicamo, Zoho Books, QuickBooks y Square.

## 2. Bugs funcionales encontrados

| # | Bug | Estado |
|---|-----|--------|
| B1 | **Emitir una venta fallaba siempre** desde la UI: los inputs que no se renderizan (método de pago en crédito, vencimiento en contado) llegan como `null` por `FormData.get` y Zod 4 rechaza `null` en `.optional()`. Error en pantalla: "Invalid input: expected string, received null". | **CORREGIDO** (`optStr` y `dueDate` tratan `null` como ausente en las 6 schemas + test `tests/schema-formdata-null.test.ts`; 122/122 verdes). Sin commit. |
| B2 | **Rangos de fecha en UTC**: una venta hecha a las 23:56 (VE) aparece en la lista con fecha 9/10 pero el dashboard dice "Ventas de la semana: sin datos", "Top productos: aún sin ventas", "Utilidad 0,00" mientras "Ventas del mes" sí la cuenta; pasada la medianoche local cambia a "sábado". `ranges.ts` usa fecha local del servidor y las consultas comparan contra `issued_at` UTC. | Pendiente: zona horaria por empresa (`tenants.timezone`, default America/Caracas) y rangos construidos en esa zona. |
| B3 | **Anular / Eliminar / Archivar / Desactivar actúan con un clic**, sin confirmación (0 confirmaciones en todo el código). Anulé la venta #2 sin querer durante la auditoría. | Pendiente: `ConfirmDialog` (modal propio, no `confirm()` nativo por PWA). |
| B4 | **Buscador global y campana no hacen nada** (el input solo escribe; la campana abre "Sin novedades"). | Pendiente: buscador real (clientes/productos/ventas) o esconderlo hasta que exista. |

Menores: venta anulada sigue mostrando "saldo USD 79,34" en lista; texto viejo "Los abonos parciales llegan con el módulo de Cobros" (Cobros ya existe); en el detalle de una venta **pagada** sigue apareciendo "Vencimiento + Guardar"; `.next` de julio devolvía 404 en todos los editores (caché, no código).

## 3. Hallazgos UX por prioridad

### P0 — Bloquean que un usuario nuevo entienda la app
1. **Ningún módulo se explica.** Título solo ("Facturación", "Inventario"). Nadie sabe que Facturación es un documento interno no fiscal, que Emitir descuenta stock y asigna número, que Inventario se alimenta desde ventas y ajustes, o que Presupuestos no toca stock.
2. **Vacíos sin acción.** "Agrega productos a la venta.", "No hay ventas en el período seleccionado.", "Aún sin clientes registrados." → sin botón, sin causa, sin siguiente paso (Polaris: *decir por qué está vacío y qué hacer*).
3. **Sin primeros pasos.** Una empresa recién creada ve ocho KPIs en "—". Shopify/Square/Zoho ponen un checklist de 5-7 tareas en el inicio hasta completarlo.
4. **Destructivas sin confirmación** (B3).
5. **Contradicciones numéricas en el dashboard** (B2) minan la confianza en el primer día.

### P1 — Fricción en el uso diario
6. **Formularios sin ayuda**: "Tipo de registro", "Documento / ID", "Unidad", "Stock mínimo", "Costo" vs "Precio", "Descuento global %", "+ Tipo", "+ Categoría" sin una línea de explicación. Labels no están asociados a los inputs (`label for`): 0/10 en Nuevo cliente, 0/6 en Nueva venta.
7. **Jerarquía de botones inconsistente**: "Añadir" (tasas) es un pill pequeño, "Registrar movimiento" es gradiente grande sin "+", "Anular" es borde gris con texto rojo, "Marcar aceptado / rechazado / Convertir" tres botones iguales de peso. "Guardar" aparece al lado de cada fila en Configuración aunque nada cambió.
8. **Estados y colores**: "Emitida" (teal) y "Enviado" (teal) no distinguen pagada / pendiente / vencida; la lista de ventas pinta en rojo todo saldo > 0 aunque no esté vencido; la venta #2 vencida solo se sabe en CxC. Chips sin icono (solo color + texto; falta el icono para no depender del color).
9. **Nombres**: "Facturación" promete factura fiscal; en la barra móvil "Vender" lleva a la lista y "+" a la venta nueva (dos entradas al mismo sitio); "Registrar movimiento" vs "Ajustar stock"; "Inventario" en la barra móvil abre el **reporte** de valorización, no Operaciones › Inventario.
10. **Tabla de líneas de venta en móvil rota**: Desc% e IVA% quedan como astillas de 10px y el detalle solapa "USD 5,000%" (grid de 12 columnas fijo).
11. **Sin feedback de éxito** al crear/guardar (no hay toast); ambos botones del builder entran en "Guardando… / Emitiendo…" a la vez porque comparten `pending`.
12. **Requieren atención** siempre vacío aunque haya venta vencida y 2 productos bajo mínimo (`items={[]}`).

### P2 — Pulido
13. Contraste: `--text-soft` #64748b sobre fondo #f1f5f9 = **4,34:1** (bajo 4,5 para 12px); el extremo claro del gradiente #14b8a6 con texto blanco = 2,49:1 (el texto cae sobre la zona clara en botones anchos). Oscuro bien (6,6:1).
14. Emoji 👋 en el saludo (el design system lo permite opcional; hoy es lo único no-Lucide).
15. "Ayuda" en móvil lleva a Preferencias; "Cambiar sucursal" lleva al placeholder de Sucursales; "Ver perfil" lleva a Preferencias.
16. Formularios ocupan 42% del ancho con 58% vacío a la derecha en escritorio; sin botón Cancelar.
17. Placeholders "Este módulo llega pronto" sin decir qué hará el módulo.
18. Tipografía KPI label 12px/600 ok; la etiqueta "Persona/Bien" junto al nombre va en 11px gris sobre blanco (4,76:1, justo).

## 4. Propuesta: sistema de ayuda contextual "Kontify te guía"

Principio (de Polaris + Odoo): **cada pantalla responde en una línea qué es, el vacío dice qué hacer, y cada campo raro tiene un "?"**. Sin tours bloqueantes, sin overlays.

### 4.1 Componentes nuevos (todos con tokens actuales)
| Componente | Dónde | Qué muestra |
|---|---|---|
| `ModuleHeader` | arriba de cada módulo | Título · **subtítulo de una línea** · enlace "¿Cómo funciona?" (icono `circle-help`) que abre un **panel lateral** (Radix Sheet, 360px) con 3-5 pasos numerados y "Lo que NO hace". Se recuerda cerrado por módulo (localStorage). |
| `EmptyState` v2 | listas y widgets | icono · título (causa) · hint (1 línea) · **botón primario** (p. ej. "+ Nuevo producto") · enlace secundario ("¿Cómo funciona?"). |
| `FieldHelp` | junto al label | icono "?" (Radix Popover, también por teclado/touch) con 1-2 líneas. Nunca por hover sobre el input (Odoo). |
| `ConfirmDialog` | toda acción destructiva | título verbo + sustantivo ("¿Anular la venta #2?"), consecuencia ("Repone el stock y no se puede deshacer."), botón rojo con el verbo + "Cancelar". Error en línea dentro del modal. |
| `Button` 3 variantes | global | `primary` (gradiente, con icono `plus` cuando crea), `secondary` (borde), `danger` (rojo sólido solo en el modal; en la página es `secondary` con texto rojo). Misma altura 40px. |
| `StatusBadge` unificado | ventas, presupuestos, stock, cobros | color + **icono Lucide** + texto: Borrador `pencil` gris · Emitida `check` teal · Pagada `circle-check` verde · Parcial `circle-dot` ámbar · Pendiente `clock` ámbar · **Vencida** `alert-triangle` rojo · Anulada `x` rojo · Enviado `send` azul · Aceptado verde · Rechazado rojo · Convertido teal · En stock verde · Bajo ámbar · Agotado rojo. |
| `GettingStarted` | dashboard, hasta completar | "Primeros pasos" 5 tareas con check real: 1 Crear un producto · 2 Cargar existencias · 3 Crear un cliente · 4 Hacer la primera venta · 5 Invitar a tu equipo. Persistido por empresa; botón "Ocultar" cuando esté al 100 %. |
| `Toast` | tras guardar/emitir | "Venta #4 emitida" / "Cliente creado" con enlace "Ver". Radix Toast, 4 s. |

### 4.2 Textos propuestos por módulo (copy literal para aprobar)
| Módulo | Subtítulo (1 línea) | Panel "¿Cómo funciona?" (pasos) | Vacío |
|---|---|---|---|
| Dashboard | "Lo importante de tu negocio en un vistazo. Cambia el período arriba a la derecha." | KPIs · período · sucursal · "Requieren atención" | Checklist de primeros pasos |
| Clientes | "Personas o empresas a las que vendes. Los tipos (Mayorista, Minorista…) te sirven para filtrar y reportar." | 1 Crear cliente · 2 Asignar tipo · 3 Ver historial y saldo en su ficha · "Archivar no borra: oculta de las listas" | "Aún no tienes clientes" + "+ Nuevo cliente" + "También puedes vender a Consumidor final sin crear uno." |
| Productos | "Tu catálogo: lo que vendes, a qué precio y con qué impuesto. Las existencias se manejan en Inventario." | 1 Crear producto (bien o servicio) · 2 Precio y costo (el costo solo lo ven dueño/admin y sirve para la utilidad) · 3 Categoría e impuesto · 4 Stock mínimo para alertas | "Tu catálogo está vacío" + "+ Nuevo producto" |
| Inventario | "Cuánto tienes de cada producto por sucursal. Baja solo con ventas emitidas; sube con ajustes o anulaciones." | 1 Cargar existencia inicial con "Ajustar stock" · 2 Mínimo = alerta "Bajo" · 3 Negativo = vendiste sin stock cargado | "Sin existencias registradas" + "Ajustar stock" |
| Facturación → **Ventas** | "Documento de venta interno (no fiscal). Guarda como borrador o emite: al emitir toma número, descuenta stock y queda listo para cobrar." | 1 Cliente (o Consumidor final) · 2 Productos · 3 Contado o crédito · 4 Emitir · 5 Anular repone stock | "Aún no hay ventas" + "+ Nueva venta" |
| Presupuestos | "Cotizaciones para el cliente. No tocan stock ni numeración de ventas; al aceptarse se convierten en venta." | Borrador → Enviar (toma número) → Aceptado/Rechazado → Convertir | "Sin presupuestos" + "+ Nuevo presupuesto" |
| Cuentas por cobrar | "Lo que te deben, por cliente. Registra abonos totales o parciales." | 1 Ver saldo y vencido · 2 Registrar abono · 3 Anular un abono devuelve el saldo | "Nadie te debe" (estado bueno, icono `circle-check`) |
| Reportes › Ventas | "Ventas, ingresos y utilidad por período. La utilidad usa el costo que tenía cada producto al venderse." | presets · rango · sucursal · desgloses | "Sin ventas en este período" + "Cambiar período" |
| Reportes › Inventario | "Valor de lo que tienes en almacén (existencia × costo)." | — | "Carga existencias para ver el valor" |
| Configuración | cada pantalla con su línea (ya tienen pie; subir arriba) | — | — |

Campos con "?": Tipo de registro, Documento / ID, Tipo de cliente, SKU, Unidad, Costo, Stock mínimo, Impuesto, Descuento global %, Método de pago, Vencimiento, Válido hasta, Sucursal.

### 4.3 Cambios de nombres y navegación (a decidir)
- "Facturación" → **"Ventas"** en nav, títulos y botón ("+ Nueva venta" ya existe). Mantener la ruta.
- "Registrar movimiento" → **"Ajustar stock"**.
- Barra móvil: "Vender" → lista de ventas (ok) pero la pestaña "Inventario" debe ir a Operaciones › Inventario, no al reporte.
- Lista de ventas: columna "Estado" muestra el **estado de pago** cuando está emitida (Pagada / Pendiente / Vencida), y "Saldo" solo rojo si está vencida.

### 4.4 Accesibilidad y pulido (sin cambio visual grande)
`label htmlFor` en todos los campos · `aria-label` en los icon-buttons (basura, campana) · `--text-soft` claro → `#5b6b80` (4,9:1 sobre #f1f5f9) · texto blanco solo sobre la mitad teal oscura del gradiente (`from-[#0e7490] to-[#0f8c93]`) o texto 600 con sombra sutil · chips `nowrap` · tabla de líneas en móvil → tarjeta por línea (producto arriba, cantidad/precio/desc/iva en 2×2, neto y basura abajo).

## 5. Plan de implementación propuesto (spec → plan → impl, subagent-driven como siempre)

| Fase | Contenido | Tamaño |
|---|---|---|
| **A · Confianza** | ConfirmDialog en 7 acciones · toasts · fix `pending` doble · estado de pago + Vencida en lista y detalle · saldo oculto en anuladas · texto viejo de Cobros · "Requieren atención" real (vencidas + bajo stock, ya existe `receivablesKpi`) · zona horaria por empresa (B2) | 1 plan |
| **B · Guía** | ModuleHeader + panel "¿Cómo funciona?" en 9 módulos con los textos de 4.2 · EmptyState v2 con botón · FieldHelp en 13 campos · GettingStarted en dashboard · renombres de 4.3 | 1 plan |
| **C · Pulido** | Button/StatusBadge unificados con icono · móvil (líneas de venta en tarjeta, pestaña Inventario) · accesibilidad y contraste · formularios a 2 columnas con Cancelar · placeholders que digan qué hará el módulo · buscador global real o escondido | 1 plan |

Nada de esto cambia la paleta, el riel, el panel ni el FAB. Capturas de referencia de la auditoría: `/tmp/claude-1000/-home-fabriziodp/cfa2dc5b-01ea-4a44-bbfb-026fe572e854/scratchpad/shots/` (sesión del 10-10-2026).
