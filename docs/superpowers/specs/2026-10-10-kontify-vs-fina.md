# Kontify frente a Fina: qué copiamos, qué mejoramos y qué falta

**Fecha:** 2026-10-10
**Competidor estudiado:** Fina (finapartner.com), sistema administrativo venezolano para pymes.
Más de 5.000 negocios, ronda semilla de un millón de dólares. Mismo mercado que Kontify.
**Fuentes:** su centro de ayuda (29 artículos en guias.finapartner.com), los siete videos de
producto de su landing, las capturas publicadas en su sitio y su catálogo de 33 tutoriales.
**Método de diseño:** skills `design-taste` (síntesis de Emil Kowalski, impeccable y
taste-skill), `emil-design-eng` y `ui-ux-pro-max`. Modo **Operate**, diales 4 / 3 / 6.

---

## 1. Cómo está armada Fina

**Navegación.** Barra lateral fija con acordeones, más barra superior. Módulos, en su orden:
`Home`, `Pedidos`, `Inventario`, `Cuentas`, `Gastos`, `Resumen Financiero`, `Marketing`,
`Estadísticas`. Configuración abajo, con `Centro de ayuda` al lado.

**Lo mejor que hacen, y que vale copiar:**

1. **Dos botones de acción permanentes en la barra superior** (`Vender` y `Agregar gasto`),
   visibles desde cualquier pantalla. No hay menú de creación: hay dos botones que nunca
   se mueven. Su propio artículo lo repite: «el botón Agregar gasto que siempre está
   arriba en la barra».
2. **Indicadores con comparación.** Sus cuatro tarjetas de inicio (`Facturación mensual`,
   `Ticket promedio`, `Ordenes diarias`, `Utilidad neta mensual`) llevan flecha, porcentaje
   y la base contra la que comparan: `vs. mes anterior ($1.056,00)`.
3. **La tabla de clientes es comercial, no una agenda.** Columnas: `Producto más comprado`,
   `Última orden`, `Órdenes Totales`, `Total gastado`, `Ticket promedio`. Y tres tarjetas
   arriba: activos, inactivos, totales.
4. **Utilidad estimada viva** en el alta de producto, mientras se escribe precio y costo.
5. **Importación desde Excel con plantilla, instructivo, video y leyenda de colores**
   dentro del propio modal. Es su mejor pieza de aprendizaje.
6. **Sin fotos de producto, a propósito.** Lo declaran: «así la plataforma pesa menos y
   abre con muy poca data, incluso cuando el internet no acompaña».

**Dónde flojean:**

- **Cero atajos de teclado.** Nada en 29 artículos ni en 33 tutoriales. Un cajero con cola
  depende del ratón.
- **Sin filtro por estado de venta**, y lo admiten: «tienes que revisar la columna
  visualmente».
- **La IA que venden no existe aún.** El asistente «Nina» aparece en el hero como presente;
  su propia página de historia dice «estamos desarrollando a Nina». Lo real es la lectura
  de facturas de proveedor.
- **Erratas en producto**: `esta listo`, `Ordenes diarias`, `Utilidad/Perdida`,
  `Fecha y hora incial`, `Bolivares`, `Sin Categoria`, `Comision`, `Granularidad: week`,
  y el pie de la app congelado en `Copyright © FINA PARTNER 2022`.
- Dos estilos de buscador y dos de paginador conviviendo.

---

## 2. Qué hicimos nosotros

### 2.1 Copiado y mejorado

| Fina | Kontify |
|---|---|
| `Vender` fijo en la barra superior | `Nueva venta` fijo en la barra, **más** seis accesos rápidos en el inicio y **más** una tecla para cada uno |
| `vs. mes anterior ($1.056,00)` | `vs. USD 1.056,00 en los mismos días del mes pasado` |
| Tabla de clientes con valor comercial | Lo mismo, **ordenable por cualquier columna** sobre el total, no solo sobre la página |
| `Utilidad estimada` en el alta de producto | Margen y ganancia por unidad, vivos, con el negativo en rojo en vez de escondido |
| Tres tarjetas en Clientes | Activos, Nuevos este mes, Archivados |

**Por qué «los mismos días del mes pasado» y no «el mes pasado».** Comparar diez días
contra treinta hace quedar mal a cualquier negocio el día 5 y bien el día 28. `sameSpanLastMonth`
compara del 1 al mismo número de día, y recorta cuando ese día no existe (31 de marzo
frente a febrero). Si el tramo anterior fue cero, **no se pinta porcentaje**: un «+100 %»
porque antes no había nada no informa de nada.

### 2.2 Donde ya les ganábamos, y se amplió

- **Atajos de teclado.** `Ctrl+K` o `/` abren el buscador; `V`, `P`, `C`, `I`, `B`, `U`
  crean; `D`, `L`, `T` navegan; `?` muestra la lista completa. Todos respetan el foco:
  no disparan mientras se escribe ni pisan las combinaciones del sistema.
- **Buscador real.** Antes era una caja muerta. Ahora encuentra clientes por nombre,
  teléfono, correo o documento; productos por nombre o SKU; y una venta por su número.
  Con flechas, Enter y resultados agrupados.
- **Ayuda en el mismo sitio en los 13 módulos**, más un panel «qué hace esta pantalla» al
  lado de cada formulario.
- **Esqueletos de carga** con la forma exacta del contenido, en las 17 rutas con datos.
- **Orden por columna** en las seis listas.

### 2.3 Formularios a ancho completo

Antes vivían en una columna de 576 px pegada al borde izquierdo. Ahora:

- **Secciones con nombre**: Identificación, Contacto, Notas · Qué vendes, Precio e
  impuesto, Inventario. Veinte casillas sueltas no se entienden; seis campos bajo un
  título, sí.
- **Columna de ayuda** a la derecha, pegada al desplazar, con cuatro frases de qué pasa al
  guardar. En teléfono sube arriba del todo, que es donde sirve a quien llega nuevo.
- **Barra de acciones pegada al fondo**: Cancelar y Guardar siempre a la vista.
- **Marcadores de posición con ejemplos reales** (`Ej. Farmacia Central C.A.`,
  `Ej. J-12345678-9`, `Ej. AGU-15`), nunca como sustituto de la etiqueta.
- Elegir «Servicio» esconde el bloque de inventario, porque un servicio no tiene existencia.

### 2.4 Oficio de interfaz (design-taste y Emil Kowalski)

| Antes | Ahora | Por qué |
| --- | --- | --- |
| `outline-none` + cambio de color de borde al enfocar | Anillo global `:focus-visible` de 2 px con separación | Un borde de color no llega al 3:1 que exige el foco visible, y quien navega con el teclado se perdía |
| 12 cadenas de clases de campo repetidas | Una primitiva con sus variantes | El mismo campo se veía distinto en dos pantallas |
| `ease-in` en las salidas, curvas de serie | `cubic-bezier(0.23, 1, 0.32, 1)` propia, nunca `ease-in` | `ease-in` arranca lento justo en el instante que el usuario mira |
| Botones sin respuesta al pulsar | `active:scale-[0.98]` | Es el acuse de recibo más barato que existe, y llega antes que el servidor |
| `h-screen` | `h-dvh` | En el teléfono la barra del navegador se comía el alto |
| `transition-colors` sin más | Propiedades y duración explícitas, 150 ms | Nada de animar lo que no se dijo |
| Animación al abrir el buscador | Sin animación de apertura | Es la acción más repetida del día: cualquier retardo se nota |

**No se tocó** lo que ya estaba bien de las fases anteriores: la paleta Teal & Slate, los
seis tonos de etiqueta de estado con su par claro y oscuro, y la prueba de contraste que
cubre las 24 combinaciones.

---

## 3. Lo que falta, por orden de valor

1. **Importar desde Excel o CSV** productos y clientes, con plantilla descargable, vista
   previa y validación fila por fila. Es su mejor pieza y la puerta de entrada de
   cualquiera que venga de una hoja de cálculo. **Es lo siguiente que haría.**
2. **Gastos de verdad.** Hoy es una pantalla vacía; en Fina es la mitad del valor
   («si no agregas los gastos tu utilidad no va a ser la real»).
3. **Lector de código de barras** en la pantalla de venta.
4. **Cierre de caja** por cuenta y por moneda.
5. **Producto más comprado** por cliente, en su ficha.
6. Sucursales y Usuarios reales, selector de sucursal que filtre.

---

## 4. Verificación

- `npx tsc --noEmit` limpio · `npm run build` correcto · **336 pruebas en verde**.
- Pruebas nuevas de esta tanda: `tests/same-span.test.ts`, `tests/trends.test.ts`,
  aislamiento multiempresa de la vista nueva en `tests/clientes.test.ts`,
  `src/components/shell/command-palette.test.tsx`,
  `src/components/shell/keyboard-shortcuts.test.tsx`,
  `src/components/productos/product-form.test.tsx`,
  `src/components/clientes/client-form.test.tsx`.
- Migración `0029_clients_with_stats.sql`: vista con `security_invoker = true`, así que
  las políticas de la base siguen mandando. Probado que un tenant no ve clientes de otro.
- Revisión mecánica con `design-taste/scripts/preflight.mjs`: los avisos de foco bajaron
  de 21 a 3, y los tres que quedan son falsos positivos (el anillo lo pone `globals.css`).
