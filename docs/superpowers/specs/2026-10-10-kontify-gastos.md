# Gastos: de pantalla vacía a módulo real

**Fecha:** 2026-10-10 · **En `master`**, 476 pruebas · Migración `0030_expenses.sql`.

El motivo era concreto: la utilidad que mostraba el inicio era **bruta** (ventas menos
costo de lo vendido). Sin gastos, no decía si el negocio gana o pierde. Es el mismo
argumento con el que Fina vende su módulo: «si no agregas los gastos tu utilidad no va a
ser la real».

---

## 1. Dos tablas, dos papeles

| Tabla | Qué es |
|---|---|
| `expenses` | Lo que **ya se pagó**. Es el hecho. |
| `recurring_expenses` | Los **gastos fijos**: una plantilla con su frecuencia y la próxima fecha. |

Separarlas evita el error clásico de contar una previsión como si fuera un pago hecho.
El alquiler que vence el día 5 no es dinero que ya salió; cuenta en «Por pagar», no en
los gastos del mes. Solo al registrar el pago nace la fila de `expenses` y la plantilla
avanza a la fecha siguiente.

### El día de ancla

`recurring_expenses` guarda `anchor_day`, el día del mes que eligió el usuario. Sin esa
columna, un alquiler del 31 de enero se recorta al 28 de febrero y **a partir de ahí se
queda pegado al 28 para siempre**. Con el ancla, febrero recorta y marzo vuelve al 31.
Hay prueba de la secuencia completa, también contra el 30 (la quincena) y contra el 29
de febrero de un bisiesto.

### El orden al pagar

Primero se guarda el gasto, que es el hecho que no se puede perder; solo si eso sale
bien se mueve la fecha. Al revés, un fallo dejaría la plantilla apuntando al mes
siguiente sin que el pago exista en ninguna parte. Si el avance falla, el gasto recién
guardado se deshace: mejor repetir el registro que tener un pago huérfano.

### Quién los ve

Solo el back-office: dueño, administrador y administrativo. Un vendedor no tiene por qué
saber cuánto cuesta el alquiler, y las políticas de la base dicen lo mismo, no solo la
interfaz. Hay pruebas de que un vendedor no lee ni escribe gastos, y de que un negocio no
ve los de otro.

---

## 2. La pantalla

Dos pestañas. **Movimientos** trae el período (Hoy, Esta semana, Este mes, Mes pasado),
buscador, filtro por categoría, tres indicadores y la tabla ordenable por fecha,
concepto, categoría y monto. **Fijos** lista las plantillas por lo que vence antes, con
su estado en palabras («venció hace 3 días», «vence hoy», «en 4 días») y el botón
«Registrar pago», que se pone en primario cuando ya venció.

Debajo de la tabla, **«En qué se fue el dinero»**: el reparto por categoría con barra y
porcentaje. Es la respuesta a la pregunta que de verdad se hace quien mira sus gastos.

La suma del indicador es la del **filtro entero**, no la de la página que se ve: si no,
el total cambiaría al pasar de página y nadie se fiaría de él.

---

## 3. El inicio dice la verdad

| Antes | Ahora |
|---|---|
| `Utilidad del mes` (bruta, sin decirlo) | `Utilidad neta del mes`, con el subtítulo «USD 33,00 bruta menos USD 620,50 de gastos» |
| `Por pagar` vacío desde el primer día | Los gastos fijos que vencen en los próximos 7 días, y cuántos ya vencieron |
| — | `Gastos del mes` |

El subtítulo enseña la resta para que no haya que creérsela. Cedió el sitio la tarjeta
`Valor de inventario`, que sigue en el módulo de Inventario y era la menos diaria de las
ocho.

Para quien no puede ver gastos, esas consultas **no se lanzan** y las tarjetas salen
vacías en vez de mentir con un cero.

---

## 4. Tres defectos que encontraron las pruebas

| Dónde | Qué pasaba |
|---|---|
| `diasHasta` | `Date.UTC` cuenta los meses desde cero. Pasarle el mes tal cual desplazaba las dos fechas y la diferencia solo cuadraba por casualidad dentro del mismo mes: el 1 de noviembre daba 0 días desde el 31 de octubre. |
| Campo de monto | `<input type="number">` **rechaza «65,50»**. Quien escribe la coma, como se escribe aquí, veía el campo vaciarse sin explicación. Los montos pasaron a texto y se leen con el mismo analizador que usa la importación: «65,50», «1.234,56», «$300» y « 8 » valen todos. |
| `formatMoney` | En negativo devolvía `USD-587,50`, con el signo pegado a la moneda. Nunca se había visto porque hasta ahora ninguna cifra podía ser negativa. |

El de la coma es el más importante: es exactamente el tropiezo de alguien que viene de una
hoja de cálculo.

---

## 5. Lo que se tocó alrededor

- **Menú**: Gastos deja de estar marcado «pronto». La prueba que ata el menú a las rutas lo
  exige: lo marcado tiene que ser **exactamente** lo que usa `ModulePlaceholder`.
- **Configuración › Categorías de gasto**, con ocho sembradas en cada negocio nuevo
  (Alquiler, Nómina, Servicios, Compra de mercancía, Transporte, Impuestos,
  Mantenimiento, Otros) para que nadie empiece con una lista vacía.
- **Acceso rápido y atajo**: «Registrar gasto» en el inicio, con la tecla `G`.
- **Avisos**: nueve mensajes nuevos. El del pago de un fijo dice la próxima fecha, así que
  el argumento del aviso admite ahora una fecha además de un número, con el mismo filtro
  estricto de siempre.

---

## 6. Verificación

- `npx tsc --noEmit` limpio · `npm run build` correcto · **476 pruebas**.
- Pruebas nuevas: `src/lib/gastos/schedule.test.ts` (15, el calendario),
  `src/lib/gastos/schema.test.ts` (13, el monto escrito a mano),
  `tests/gastos.test.ts` (17, contra la base y sus políticas), más las de formato y avisos.
- Paseo completo en el navegador contra el servidor de producción: cargar un gasto, ver el
  reparto por categoría, crear un fijo, registrar su pago y comprobar que la fecha avanzó
  del 08/10 al 08/11, y que el inicio recalculó la utilidad neta. Sin un solo error de
  consola, y sin desbordamiento horizontal en teléfono.

**Nota del entorno:** el servidor de `next dev` se cierra solo entre llamadas en esta
máquina. La verificación se hizo con `npm run build` y `next start`, que además consume
mucha menos memoria. Hay que matar el anterior antes de levantar otro: dos servidores con
compilaciones distintas sirven fragmentos cruzados y el navegador falla con un 500.

---

## 7. Lo que sigue

1. **Importar gastos desde Excel**, reusando el lector que ya existe. Es el siguiente paso
   natural para quien llega con un año de gastos en una hoja.
2. **Importar el stock inicial**, hoy hay que cargarlo producto por producto.
3. **Lector de código de barras** al vender.
4. Cuentas por pagar a proveedores, que es distinto de un gasto fijo.
