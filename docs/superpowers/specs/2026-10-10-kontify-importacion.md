# Importar desde Excel, y la auditoría del menú

**Fecha:** 2026-10-10 · **En `master`**, 424 pruebas.

---

## 1. Importar desde Excel o CSV

Es la pieza que Fina usa como puerta de entrada y la que faltaba para que alguien que
lleva su negocio en una hoja de cálculo pueda empezar sin teclear cien productos.

### Sin dependencias nuevas

Las dos librerías de npm que leen `.xlsx` no servían: `exceljs` ocupa 21 MB descomprimido,
y `xlsx` solo publica en npm la versión 0.18.5, con vulnerabilidades que solo están
corregidas fuera de npm. Lo que hacía falta es una fracción de lo que hacen, así que el
lector está escrito aquí: `src/lib/import/xlsx.ts`, 140 líneas.

Un `.xlsx` es un ZIP con XML dentro. Se leen tres piezas: qué hoja es la primera, la tabla
de textos compartidos y las celdas de esa hoja. El ZIP se recorre por su directorio
central y se descomprime con `zlib.inflateRawSync`, que ya viene en Node. No se interpretan
estilos ni fechas: ni productos ni clientes tienen columnas de fecha.

Lo que cubre, con prueba cada cosa:

| Caso | Por qué importa |
|---|---|
| Textos compartidos y textos en línea | Excel usa unos, LibreOffice a veces los otros |
| Hoja comprimida y hoja guardada tal cual | Algunos generadores no comprimen |
| Celda saltada en medio de la fila | Sin leer la referencia `C7`, el resto se desplazaba una columna |
| Fila vacía autocerrada `<row r="5"/>` | Emparejaba su apertura con el cierre de la siguiente y se perdía una fila |
| La hoja no se llama `sheet1.xml` | Se resuelve por la relación del libro |
| Acentos y entidades XML | «Café», «Categoría» |

Para CSV (`src/lib/import/csv.ts`) están las rarezas que de verdad salen de un Excel en
español: **separador punto y coma**, BOM al principio, saltos de línea dentro de una celda
entrecomillada y comillas escapadas por duplicación. El separador se detecta contando lo
que hay fuera de las comillas en la primera línea.

### No hay que renombrar nada

El archivo se empareja solo con las columnas del sistema por nombre o por alias, sin mirar
acentos, mayúsculas ni guiones bajos. Probado con un archivo real: `Producto` → nombre,
`Código` → SKU, `PVP` → precio, `Costo unitario` → costo, `Familia` → categoría. Y en
clientes: `Cédula` → documento, `Segmento` → tipo de cliente.

Lo que no reconoce se dice («No se usarán: Proveedor») y se puede corregir a mano con un
selector por campo, que vuelve a revisar el archivo al instante.

Los números se leen como los escribe la gente: `2,50`, `1.234,56`, `1,234.56`, `$12,50`,
` 8 `. La regla, cuando hay coma y punto, es que manda el último; cuando hay uno solo y
deja tres cifras detrás, es separador de miles, porque `1.500` son mil quinientos.

### Nada se guarda sin verse antes

Tres pasos: subir, revisar, listo. En revisar se ve el conteo («7 filas leídas · 4 listas ·
3 con problemas»), el emparejado de columnas y una vista previa con las celdas malas en
rojo y el motivo al lado, escrito en concreto:

- `Falta nombre`
- `«cuatro con veinte» no es un número`
- `El mismo SKU que la fila 2`
- `Ya existe un producto con ese SKU`

Las filas con problema **se quedan fuera y las buenas entran**, diciendo cuántas de cada.
Fina exige que todo esté bien antes de dejar importar; esto deja avanzar con lo que sirve.

### Doble validación

La revisión viaja al navegador para poder verla, y vuelve en la confirmación. Si solo se
confiara en ella, bastaría con editar la petición para colar una fila sin nombre, con un
precio negativo o con un campo que no existe en la plantilla. Por eso `revalidar()` vuelve
a comprobarlo todo en el servidor antes de escribir: obligatorios, tipos, longitudes,
opciones admitidas, campos desconocidos y duplicados, estos últimos otra vez contra la base.

Encima de eso están las políticas de la base. Hay una prueba que lo comprueba: un tenant
que intenta insertar poniendo el identificador de otro recibe cero insertados.

### Detalles que hacen que no duela

- **Plantilla descargable** en CSV con BOM, con asterisco en las obligatorias y una fila de
  ejemplo. Hay una prueba de que la plantilla que se genera se vuelve a leer y empareja
  todas sus columnas.
- **Categorías y tipos que no existen se crean**, y se dice cuáles. «Ferretería» y
  «ferreteria» son la misma y se crea una sola vez (lo encontró una prueba).
- **Inserción por lotes de 100.** Si un lote falla, se reparte fila por fila para decir
  exactamente cuál lo rompió, y las buenas del lote igual entran.
- Límites: 5 MB y 5000 filas, dichos antes de subir.

### Verificación de punta a punta

Con un archivo desordenado a propósito (títulos propios, decimales con coma, una fila sin
nombre, un precio escrito en letras, un SKU repetido y una columna de más):

```
emparejado:  Producto→nombre  Código→SKU  PVP→precio  Costo unitario→costo  Familia→categoría
avisa:       No se usarán: Proveedor.
detecta:     El mismo SKU que la fila 2 · Falta nombre · «cuatro con veinte» no es un número
importa:     4 productos · también creó la categoría Alimentos
reimportar:  7 filas leídas · 0 listas · 7 con problemas   (todos duplicados)
```

Y con un CSV de clientes guardado como lo guarda el Excel en español, con punto y coma
y BOM: dos clientes importados, con `Cédula` y `Segmento` emparejados solos.

---

## 2. Páginas que no se alcanzan desde el menú

**No hay ninguna.** Las 37 rutas se comprobaron de dos maneras: un barrido estático del
árbol de `src/app` contra `nav.ts`, y un recorrido real con navegador siguiendo enlaces
desde el inicio. Todo lo que no está en el menú (fichas, altas y ediciones) se alcanza
desde su lista.

**El hallazgo fue el contrario:** ocho de las veinticuatro entradas del menú llevaban a una
pantalla que solo dice «Este módulo llega pronto». Un tercio del menú gastaba el clic sin
avisar: Notificaciones, Actividad, Cuentas por pagar, Comisiones, Bancos, Gastos,
Sucursales y Usuarios y roles.

Ahora esas entradas llevan una marca **pronto** en el menú y en el buscador. No se quitan:
enseñan a dónde va el producto.

### Una prueba que lo mantiene así

`tests/nav.test.ts` ata el menú a las rutas de forma permanente:

1. Toda entrada del menú lleva a una página que existe.
2. Toda pantalla de módulo está en el menú, o es de crear, editar o importar y cuelga de
   una lista que sí lo está.
3. Cada pantalla accesoria tiene su lista en el menú.
4. Lo marcado «pronto» es **exactamente** lo que usa `ModulePlaceholder`. Al construir
   Gastos de verdad, la prueba falla hasta que se quite la marca.
5. Cada ruta del menú resuelve su sección, para que el riel se ilumine.
6. Un vendedor no ve lo que su rol no puede abrir.

---

## 3. Lo que sigue

1. **Gastos de verdad.** Es la mitad del valor que vende Fina: «si no agregas los gastos tu
   utilidad no va a ser la real».
2. **Importar también el stock inicial**, hoy hay que cargarlo producto por producto.
3. **Lector de código de barras** en la pantalla de venta.
4. Sucursales y Usuarios reales.
